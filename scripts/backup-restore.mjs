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

function castsDeLaTabla(tabla) {
  const modelo = Prisma.dmmf.datamodel.models.find(
    (m) => (m.dbName || m.name) === tabla || `${(m.dbName || m.name)}` === tabla,
  );
  const mapa = new Map();
  if (!modelo) return mapa;
  for (const f of modelo.fields) {
    const cast = CAST_POR_TIPO[f.type];
    if (cast) mapa.set(f.dbName || f.name, cast);
  }
  return mapa;
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
  if (data.format !== 'yaqu-logical-v1') {
    console.error(`formato ${data.format}: esto solo restaura volcados lógicos. Para .pgdump usa pg_restore.`);
    process.exit(1);
  }
  const tablas = data.tables || {};
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  let filas = 0;
  for (const t of ordenDeInsercion(Object.keys(tablas))) {
    const rows = tablas[t];
    if (!Array.isArray(rows) || !rows.length) continue;
    const casts = castsDeLaTabla(t);
    for (const row of rows) {
      const cols = Object.keys(row);
      // Los Json se re-serializan: el driver los recibiría como objeto y `::jsonb` espera texto.
      const valores = cols.map((c) => {
        const v = row[c];
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
