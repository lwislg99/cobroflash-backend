// scripts/backup-restore.mjs — SCRUM-242 · la mitad que faltaba: ESCRIBIR DE VUELTA.
//
//   BACKUP_ENCRYPTION_KEY=… node scripts/backup-restore.mjs <fichero.gz.enc>
//
// `backup-dump.mjs` vuelca y verifica; ninguno de sus dos modos restaura. Sin esto, el formato
// LÓGICO —el que sale en Railway, porque su imagen de Node no trae `pg_dump`— no tenía forma de
// volver a una base. Un backup que no se puede restaurar no es un backup.
//
// ── LO QUE HACE, Y EL ORDEN IMPORTA ────────────────────────────────────────────────────────
//   1. descifra y valida el tag GCM (si el fichero está tocado, revienta aquí);
//   2. inserta las filas EN ORDEN DE PADRES→HIJOS, porque las claves ajenas lo exigen;
//   3. **repone las secuencias**, que es lo que nadie recuerda y deja la base rota en diferido.
//
// ⚠️ EL PASO 3 NO ES COSMÉTICO. El volcado hace `SELECT *`: trae los ids pero NO el estado de las
// secuencias. Restaurar sin reponerlas deja los 24 contadores en 1, y **el siguiente INSERT choca
// con una fila restaurada**. En facturas eso no se arregla borrando (regla 29).
//
// ⚠️ NO se ejecuta contra producción ni staging: usa `_scratch-run.mjs`, que lo impide.
import fs from 'node:fs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { Prisma } from '@prisma/client';
import {
  FORMATOS_QUE_SE_RESTAURAN, TIPOS_BINARIOS, decodificarBinario,
} from './_backup-codec.mjs';

/**
 * 🔴 EL CAST NO ES UN DETALLE: SIN ÉL LA RESTAURACIÓN NO EXISTE.
 *
 * Descubierto EJECUTÁNDOLO, que es la única forma en que podía descubrirse. El volcado va a JSON,
 * y JSON no tiene fechas ni decimales: una `DateTime` vuelve como cadena ISO y Postgres rechaza el
 * INSERT parametrizado —«column "created_at" is of type timestamp but expression is of type text»—.
 * Lo mismo con `Decimal` y `Json`.
 *
 * O sea: **el backup lógico no era restaurable**, y nadie lo sabía porque nadie lo había intentado.
 * Es exactamente lo que este ticket vino a comprobar.
 *
 * El mapa columna→tipo se DERIVA del DMMF (el schema compilado), no se escribe a mano: un campo
 * nuevo trae su cast solo. Una lista a mano aquí volvería a romperse en silencio, y el silencio
 * solo se rompe el día de la restauración.
 */
const CAST_POR_TIPO = { DateTime: '::timestamp', Decimal: '::numeric', Json: '::jsonb', BigInt: '::bigint' };

/**
 * 🔴 `Bytes` NO LLEVA CAST: LLEVA DECODIFICACIÓN. Y esto también salió ejecutándolo.
 *
 * `attachments.data` es `bytea` — las FOTOS de los trabajos viven dentro de Postgres (MEDIA-1,
 * fallback sin R2). Al restaurar llegaba como objeto y Postgres respondía:
 *
 *     column "data" is of type bytea but expression is of type jsonb
 *
 * O sea: **la restauración funcionaba para 23 tablas y se rompía justo en la que guarda ficheros.**
 * No se vio en la primera prueba porque aquel juego de datos no tenía ni un adjunto — un verde
 * hueco: el suelo tiene que estar también en los DATOS, no solo en el detector.
 *
 * `TIPOS_BINARIOS` y el códec viven en `_backup-codec.mjs`, **compartidos con el volcado**: dos
 * mitades que se leen la una a la otra no pueden vivir en dos sitios que nadie obliga a cuadrar, y
 * el día que se desincronizaran sería el día de la restauración. Ahí está también el porqué del
 * base64 y el número del techo.
 */

/**
 * EXHAUSTIVIDAD, no lista de excepciones. Estos tipos viajan por JSON sin perder nada y entran en
 * su columna tal cual; están NOMBRADOS para que ningún tipo del schema quede sin decisión. Es un
 * `switch` sin `default` silencioso: lo vigila
 * `tests/scrum242-restauracion-cubre-todos-los-tipos.test.mjs`, que compara este fichero contra los
 * tipos que el schema usa DE VERDAD. Un tipo nuevo pone el guard rojo hasta que alguien decida qué
 * hacer con él — que es exactamente lo que no pasó con `Bytes`.
 */
export const SIN_TRATAMIENTO = new Set(['String', 'Int', 'Boolean', 'Float']);

function columnasDeLaTabla(tabla) {
  const modelo = Prisma.dmmf.datamodel.models.find((m) => (m.dbName || m.name) === tabla);
  const casts = new Map();
  const binarias = new Set();
  if (!modelo) return { casts, binarias };
  for (const f of modelo.fields) {
    const col = f.dbName || f.name;
    if (TIPOS_BINARIOS.has(f.type)) { binarias.add(col); continue; } // sin cast: va el Buffer
    const cast = CAST_POR_TIPO[f.type];
    if (cast) casts.set(col, cast);
  }
  return { casts, binarias };
}

const KEY_RAW = process.env.BACKUP_ENCRYPTION_KEY || '';
if (KEY_RAW.length < 32) {
  console.error('Falta BACKUP_ENCRYPTION_KEY (32+ caracteres). Sin la clave con la que se cifró NO hay restauración.');
  process.exit(1);
}
const KEY = crypto.createHash('sha256').update(KEY_RAW).digest();
const FICHERO = process.argv[2];
if (!FICHERO) { console.error('uso: node scripts/backup-restore.mjs <fichero.gz.enc>'); process.exit(2); }

function decrypt(buf) {
  if (buf.subarray(0, 4).toString() !== 'YQB1') throw new Error('formato desconocido');
  const d = crypto.createDecipheriv('aes-256-gcm', KEY, buf.subarray(4, 16));
  d.setAuthTag(buf.subarray(16, 32));
  return Buffer.concat([d.update(buf.subarray(32)), d.final()]);
}

/**
 * PADRES ANTES QUE HIJOS, por ORDEN TOPOLÓGICO derivado del schema.
 *
 * 🔴 La primera versión invertía `ORDEN_BORRADO_MERCHANT` y **falló al ejecutarla**: esa lista
 * enumera los HIJOS de un merchant, así que `merchants` no está en ella y caía al final —
 * `customers` se insertaba antes que su padre y la clave ajena lo rechazaba.
 *
 * Reutilizar una lista pensada para otra pregunta parecía la opción sin duplicación, pero
 * respondía a otra cosa. Lo correcto se deriva del DMMF: una tabla va DESPUÉS de todas aquellas a
 * las que referencia. Así un modelo nuevo se coloca solo, sin que nadie mantenga un orden.
 */
function ordenDeInsercion(tablasDelDump) {
  const modelos = Prisma.dmmf.datamodel.models;
  const tablaDe = new Map(modelos.map((m) => [m.name, m.dbName || m.name]));
  const enElDump = new Set(tablasDelDump);

  const padresDe = new Map();
  for (const m of modelos) {
    const t = tablaDe.get(m.name);
    if (!enElDump.has(t)) continue;
    const padres = new Set();
    for (const f of m.fields) {
      // Solo el lado que TIENE la clave ajena: `relationFromFields` no vacío.
      if (f.relationFromFields?.length) {
        const pt = tablaDe.get(f.type);
        if (pt && enElDump.has(pt) && pt !== t) padres.add(pt);
      }
    }
    padresDe.set(t, padres);
  }

  const orden = [];
  const puestas = new Set();
  // Rondas: en cada una entran las que ya tienen todos sus padres puestos. Si una ronda no coloca
  // nada, hay un ciclo (o una autorreferencia) y se vuelcan las que queden — el INSERT dirá cuál.
  let quedan = [...padresDe.keys()];
  while (quedan.length) {
    const listas = quedan.filter((t) => [...padresDe.get(t)].every((p) => puestas.has(p)));
    if (!listas.length) { orden.push(...quedan); break; }
    for (const t of listas) { orden.push(t); puestas.add(t); }
    quedan = quedan.filter((t) => !puestas.has(t));
  }
  // Tablas del dump que el schema no conoce: van al final, pero NO se descartan.
  return [...orden, ...tablasDelDump.filter((t) => !orden.includes(t))];
}

async function main() {
  const plano = zlib.gunzipSync(decrypt(fs.readFileSync(FICHERO)));
  const data = JSON.parse(plano.toString());
  if (!FORMATOS_QUE_SE_RESTAURAN.includes(data.format)) {
    console.error(`formato ${data.format}: esto solo restaura volcados lógicos (${FORMATOS_QUE_SE_RESTAURAN.join(', ')}). Para .pgdump usa pg_restore.`);
    process.exit(1);
  }
  const tablas = data.tables || {};
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  // ── EL DESTINO TIENE QUE ESTAR VACÍO, Y SE COMPRUEBA ANTES DE ESCRIBIR ────────────────────
  // 🔴 También esto salió ejecutándolo: **la restauración no es transaccional**. Un fallo a mitad
  // —el de `bytea`, por ejemplo— deja la base a medias, y el reintento muere con `Key (id)=(1)
  // already exists`, que no dice nada de lo que pasa de verdad. A las tres de la mañana eso son
  // veinte minutos perdidos persiguiendo el error equivocado.
  //
  // Se para ANTES en vez de envolverlo todo en una transacción: una restauración grande en una sola
  // transacción es un candado larguísimo, y aquí el destino DEBE estar vacío de todas formas (R14
  // §2). Fail-closed y con la instrucción dentro del mensaje.
  const ocupadas = [];
  for (const t of Object.keys(tablas)) {
    const [{ n } = {}] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "${t}"`);
    if (n > 0) ocupadas.push(`${t} (${n})`);
  }
  if (ocupadas.length) {
    await prisma.$disconnect();
    console.error(
      `🔴 EL DESTINO NO ESTÁ VACÍO: ${ocupadas.join(', ')}\n\n`
      + '  No se escribe nada. Restaurar encima mezclaría el backup con lo que ya hay, y los ids\n'
      + '  chocarían a mitad dejando la base peor que antes.\n\n'
      + '  Si vienes de una restauración que falló, la base quedó A MEDIAS: vacíala y vuelve a\n'
      + '  empezar desde el paso 2 de R14 (`prisma db push` sobre una base limpia).');
    process.exit(1);
  }

  let filas = 0;
  for (const t of ordenDeInsercion(Object.keys(tablas))) {
    const rows = tablas[t];
    if (!Array.isArray(rows) || !rows.length) continue;
    const { casts, binarias } = columnasDeLaTabla(t);
    for (const row of rows) {
      const cols = Object.keys(row);
      // Los Json se re-serializan: el driver los recibiría como objeto y `::jsonb` espera texto.
      // Los Bytes se reconstruyen a Buffer, que es lo que el driver sabe meter en un `bytea`.
      const valores = cols.map((c) => {
        const v = row[c];
        if (binarias.has(c)) return decodificarBinario(v);
        if (casts.get(c) === '::jsonb' && v !== null && typeof v === 'object') return JSON.stringify(v);
        return v;
      });
      const marcas = cols.map((c, i) => `$${i + 1}${casts.get(c) || ''}`).join(', ');
      const nombres = cols.map((c) => `"${c}"`).join(', ');
      await prisma.$executeRawUnsafe(`INSERT INTO "${t}" (${nombres}) VALUES (${marcas})`, ...valores);
      filas += 1;
    }
    console.log(`  ✓ ${t}: ${rows.length} fila(s)`);
  }

  // ── LAS SECUENCIAS ────────────────────────────────────────────────────────────────────────
  let secuencias = 0;
  for (const t of Object.keys(tablas)) {
    const [{ seq } = {}] = await prisma.$queryRawUnsafe(
      `SELECT pg_get_serial_sequence('"${t}"', 'id') AS seq`,
    );
    if (!seq) continue; // tabla sin id autoincremental
    await prisma.$executeRawUnsafe(
      `SELECT setval('${seq}', COALESCE((SELECT MAX(id) FROM "${t}"), 1))`,
    );
    secuencias += 1;
  }

  await prisma.$disconnect();
  console.log(`✓ restauradas ${filas} filas en ${Object.keys(tablas).length} tablas · ${secuencias} secuencias repuestas`);
}

main().catch((e) => {
  // Sin volcar la cadena de conexión: un error de Prisma puede llevarla dentro.
  console.error('restauración FALLÓ:', String(e?.message || e).replace(/postgres(ql)?:\/\/[^\s"']+/g, '<url redactada>'));
  process.exit(1);
});
