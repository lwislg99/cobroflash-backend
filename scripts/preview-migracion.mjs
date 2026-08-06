// scripts/preview-migracion.mjs — SCRUM-385
//
// EL PREVIEW OBLIGATORIO ANTES DE UN `db push`, CON CONTROL POSITIVO DENTRO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ PASÓ, Y POR QUÉ ESTO NO ES «ARREGLAR LA CONFIG»
//
// El 5-ago-2026, preparando la migración de SCRUM-300, `prisma migrate diff` devolvió **salida
// vacía con exit 0**. Vacío y exit 0 es exactamente lo que devuelve un diff legítimo cuando NO
// hay cambios. O sea: el preview que protege producción decía «no hay nada que aplicar» mientras
// la migración real añadía cuatro columnas.
//
// 🔴 LA CAUSA NO FUE UNA SUBIDA DE VERSIÓN DEL PROYECTO — y esto importa, porque de la causa
// depende el arreglo. El proyecto FIJA `prisma@^6.18.0` y siempre lo fijó. Lo que ocurrió es que
// en un worktree con `node_modules` a medio instalar, **`npx prisma` no encontró el CLI local y
// se descargó `prisma@latest` (7.9.1) de la red, sin decir nada**. El 7 renombró los flags
// (`--from-schema-datamodel` → `--from-schema`) y dejó de leer la configuración de
// `package.json#prisma`; sin schema cargado, el diff sale vacío.
//
// Medido hoy en el árbol con el CLI fijado: `--from-empty --to-schema-datamodel … --script`
// devuelve 24.338 bytes y 24 `CREATE TABLE`. La herramienta está bien. Lo que falla es CUÁL se
// ejecuta.
//
// De ahí las dos decisiones de este fichero:
//
//   ① SE EJECUTA EL BINARIO LOCAL, resuelto por ruta. Nunca `npx prisma` a secas: `npx` sustituye
//      el binario en silencio, así que **fijar la versión en `package.json` NO protege** — es la
//      trampa que nos comió. Si el CLI local no está, esto se planta y lo dice.
//
//   ② CONTROL POSITIVO ANTES DE CREERSE UN VACÍO. Antes de dar por bueno un «no hay cambios» se
//      le pide a la herramienta un diff que OBLIGATORIAMENTE tiene que traer contenido: el
//      esquema actual contra vacío, que son todas las tablas del proyecto. Si ESE sale vacío, la
//      herramienta no está respondiendo y aquí se falla — nunca se informa de «no hay cambios».
//
// El control positivo es lo que hace que esto no vuelva a pasar por una causa distinta. La
// próxima ruptura no tiene por qué ser un `npx` traicionero: puede ser otro renombrado de flags,
// un binario corrupto o un fallo de permisos. El control no pregunta por la causa — pregunta si
// la herramienta contesta.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// USO
//
//   node scripts/preview-migracion.mjs                       # schema actual contra la BD del entorno
//   node scripts/preview-migracion.mjs --desde <schema.prisma>  # schema viejo → schema actual (offline)
//
// La segunda forma es la que se usa para revisar un cambio propio: no toca ninguna base de datos
// y aísla el cambio de la rama de cualquier deriva previa del entorno.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esInvocacionDirecta } from './_prisma-client-guard.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SCHEMA_POR_DEFECTO = path.join(RAIZ, 'prisma', 'schema.prisma');

/**
 * El CLI LOCAL, por ruta. `npx prisma` se descarga otro de la red cuando el local falta, y esa
 * sustitución silenciosa es la causa del incidente que abrió este ticket.
 */
export function rutaCliLocal(raiz = RAIZ) {
  const bin = path.join(raiz, 'node_modules', 'prisma', 'build', 'index.js');
  return fs.existsSync(bin) ? bin : null;
}

/** Ejecutor real: lanza el CLI local con node. Se inyecta para poder probar el guard en rojo. */
export function ejecutorLocal(raiz = RAIZ) {
  return (args) => {
    const bin = rutaCliLocal(raiz);
    if (!bin) {
      return { ok: false, salida: '', error: 'no encuentro el CLI de Prisma en node_modules (¿falta `npm install`?)' };
    }
    const r = spawnSync(process.execPath, [bin, ...args], {
      cwd: raiz,
      encoding: 'utf8',
      // `migrate diff` no necesita conectar en la forma datamodel→datamodel, pero el schema
      // declara `env("DATABASE_URL")` y Prisma exige que la variable EXISTA para resolverlo.
      // Se le da una que no lleva a ninguna parte: así no puede tocar nada por accidente.
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || 'postgresql://nadie:nadie@127.0.0.1:1/nada' },
    });
    if (r.error) return { ok: false, salida: '', error: r.error.message };
    return { ok: r.status === 0, salida: r.stdout || '', error: (r.stderr || '').trim() };
  };
}

/**
 * EL CONTROL POSITIVO. Le pide a la herramienta lo único que no puede salir vacío: el esquema
 * entero contra nada. Si esto no trae `CREATE TABLE`, la herramienta no está contestando.
 *
 * ⚠️ No basta con mirar el código de salida ni con que la salida sea no-vacía: el fallo original
 * salía con exit 0 y cero bytes. Se exige CONTENIDO RECONOCIBLE.
 */
export function controlPositivo(ejecutor, schema = SCHEMA_POR_DEFECTO) {
  const r = ejecutor(['migrate', 'diff', '--from-empty', '--to-schema-datamodel', schema, '--script']);
  const tablas = (r.salida.match(/CREATE TABLE/g) || []).length;
  if (!r.ok || tablas === 0) {
    return {
      ok: false,
      tablas,
      motivo:
        '🔴 LA HERRAMIENTA NO RESPONDE — el preview NO es fiable y NO se puede aplicar nada.\n\n' +
        '   Se le ha pedido el esquema ENTERO contra vacío, que tiene que devolver todas las\n' +
        '   tablas del proyecto, y ha devuelto ' + (r.salida.length === 0 ? 'CERO BYTES' : `${tablas} CREATE TABLE`) + '.\n\n' +
        '   ⚠️ Esto NO significa «no hay cambios». Un diff vacío por avería y uno vacío porque\n' +
        '   no hay nada que migrar se leen IGUAL, y uno de los dos te deja aplicar a ciegas.\n\n' +
        (r.error ? `   La herramienta dijo: ${r.error.split('\n').slice(0, 3).join(' ')}\n\n` : '') +
        '   Qué mirar, por orden: que exista node_modules/prisma (¿falta `npm install`?), que\n' +
        '   la versión instalada sea la de package.json, y que no se esté ejecutando un CLI\n' +
        '   bajado por `npx` (que sustituye el binario en silencio y cambió los flags en el 7).',
    };
  }
  return { ok: true, tablas };
}

/**
 * HAY DOS VACÍOS Y NO SE PARECEN EN NADA.
 *
 * Medido con el CLI fijado: cuando de verdad no hay cambios, Prisma **lo dice con palabras** —
 * escribe `-- This is an empty migration.`. Cero bytes NO es eso: cero bytes es la herramienta
 * sin contestar, que es como se presentó la avería del 5-ago.
 *
 * Por eso «no hay cambios» se reconoce por la FRASE y no por la longitud. Si algún día Prisma
 * deja de escribirla, esto no dará un falso «no hay cambios»: dará `sospechoso`, que es el lado
 * seguro por el que equivocarse.
 */
const MARCA_VACIO_LEGITIMO = /^--\s*This is an empty migration\.?\s*$/im;

export function clasificarSalida(sql) {
  if (sql.length === 0) return 'sospechoso';
  if (MARCA_VACIO_LEGITIMO.test(sql)) return 'sin_cambios';
  return 'con_cambios';
}

/**
 * El preview de verdad. Devuelve `{ ok, sql, clase, control }`, donde `clase` es
 * `sin_cambios | con_cambios | sospechoso`.
 *
 * `sin_cambios` SOLO se devuelve cuando el control positivo ha pasado Y Prisma lo ha dicho por
 * escrito: es entonces —y solo entonces— cuando «no hay nada que aplicar» significa lo que dice.
 */
export function previewMigracion({ ejecutor = ejecutorLocal(), schema = SCHEMA_POR_DEFECTO, desde = null } = {}) {
  const control = controlPositivo(ejecutor, schema);
  if (!control.ok) return { ok: false, sql: '', clase: 'sospechoso', control };

  const args = desde
    ? ['migrate', 'diff', '--from-schema-datamodel', desde, '--to-schema-datamodel', schema, '--script']
    : ['migrate', 'diff', '--from-schema-datasource', schema, '--to-schema-datamodel', schema, '--script'];
  const r = ejecutor(args);
  if (!r.ok) return { ok: false, sql: '', clase: 'sospechoso', control, error: r.error };

  const sql = r.salida.trim();
  return { ok: true, sql, clase: clasificarSalida(sql), control };
}

/** Las sentencias que NO pueden colarse en una migración aditiva, para que salten a la vista. */
export function sentenciasDestructivas(sql) {
  const patrones = [/\bDROP\b/i, /\bRENAME\b/i, /\bTRUNCATE\b/i, /DELETE\s+FROM/i, /SET\s+NOT\s+NULL/i];
  return sql.split('\n').filter((l) => patrones.some((p) => p.test(l)));
}

if (esInvocacionDirecta(import.meta.url, process.argv[1])) {
  const i = process.argv.indexOf('--desde');
  const desde = i > 0 ? process.argv[i + 1] : null;
  const r = previewMigracion({ desde });

  if (!r.ok) {
    console.error(r.control.ok ? `🔴 el diff falló: ${r.error}` : r.control.motivo);
    process.exit(1);
  }
  console.log(`✔ control positivo: la herramienta responde (${r.control.tablas} tablas).`);
  if (r.clase === 'sin_cambios') {
    console.log('✔ sin cambios pendientes — y el vacío está COMPROBADO, no supuesto: la propia');
    console.log('  herramienta lo ha escrito, y antes ha demostrado que sabe contestar.');
    process.exit(0);
  }
  if (r.clase === 'sospechoso') {
    console.error('🔴 el diff devolvió CERO BYTES pese a que el control positivo pasó.');
    console.error('   No se informa de «no hay cambios»: no se sabe. NO se aplica nada.');
    process.exit(1);
  }
  console.log('\n──────── SQL QUE SE APLICARÍA ────────');
  console.log(r.sql);
  const malas = sentenciasDestructivas(r.sql);
  console.log('\n──────── VEREDICTO ────────');
  if (malas.length) {
    console.log(`🔴 ${malas.length} sentencia(s) DESTRUCTIVA(S) — esto no es aditivo:`);
    for (const l of malas) console.log('   ' + l.trim());
    process.exit(2);
  }
  console.log('✔ aditiva: ni DROP, ni RENAME, ni TRUNCATE, ni DELETE, ni SET NOT NULL.');
}
