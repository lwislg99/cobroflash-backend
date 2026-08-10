#!/usr/bin/env node
// scripts/aplicar-sql-dev.mjs — SCRUM-425
//
// APLICAR UN .sql A `yaqu_dev_javier` (y SOLO a ésa), con lo que `prisma db execute` no trae.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// POR QUÉ EXISTE, EN VEZ DE LLAMAR A PRISMA A PELO
//
// 1. **La URL NUNCA va en `argv`.** Ni `--url`, ni `--from-url`. Un argumento queda en `ps`, en
//    el historial del shell y —lo que costó una rotación de credencial— dentro del `e.message`
//    de cualquier error. Aquí la URL viaja en el ENTORNO del hijo y no se imprime jamás
//    (SCRUM-195; se parsea con `parseBDSegura`, que no tiene forma de devolver la cadena).
//
// 2. 🔴 **`--accept-data-loss` NO protege a `db execute --file`.** Medido en SCRUM-395: esa
//    bandera es de `db push`. `db execute` corre lo que le des, incluido un `DROP TABLE`, sin
//    preguntar nada. Así que la protección tiene que estar AQUÍ: se lee el fichero entero, se
//    enseña línea a línea, y **solo se aplican las formas de la LISTA BLANCA** de
//    `_aplicar-sql-dev.mjs` — lo que no se sabe clasificar se rechaza, no se permite.
//
// 3. **Destino comprobado con el mecanismo, no con la vista.** `exigirDestinoCorrecto` (SCRUM-383)
//    contrasta la clave contra su destino declarado. `staging` y `dev` COMPARTEN HOST, así que
//    mirar solo el host las daría por iguales: por eso también se exige el nombre de base.
//
// ⚠️ ACOTADO A DEV A PROPÓSITO, y no es una limitación pendiente de quitar: sólo acepta
// `DATABASE_URL_DEV`. Una herramienta genérica de «aplica este SQL a la base que le digas» es la
// que un día se apunta a producción. Producción y staging las aplica el fundador a mano.
//
// USO:
//   node scripts/aplicar-sql-dev.mjs --file docs/sql/x.sql          → ENSEÑA y no toca nada
//   node scripts/aplicar-sql-dev.mjs --file docs/sql/x.sql --go     → aplica
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describirBD, parseBDSegura } from './_db-guard.mjs';
import { exigirDestinoCorrecto } from './_clave-vs-destino.mjs';
import { revisar, PERMITIDAS } from './_aplicar-sql-dev.mjs';

const CLAVE = 'DATABASE_URL_DEV'; // única admitida: ver la nota de arriba
const WORKTREE = path.basename(process.cwd());

function morir(mensaje) {
  console.error(`\n🔴 ${mensaje}\n`);
  process.exit(1);
}

const args = process.argv.slice(2);
const iFile = args.indexOf('--file');
const GO = args.includes('--go');
if (iFile < 0 || !args[iFile + 1]) morir('falta `--file <ruta.sql>`');
const ruta = args[iFile + 1];
if (!fs.existsSync(ruta)) morir(`no existe el fichero: ${ruta}`);

const url = process.env[CLAVE];
if (!url) morir(`no hay ${CLAVE} en el entorno. (No se imprime ningún valor de .env.)`);

// ── 1 · ¿la clave apunta a donde promete? (SCRUM-383) ────────────────────────────────────
console.log('── DESTINO ─────────────────────────────────────────────────');
console.log(`   clave:   ${CLAVE}   (worktree: ${WORKTREE})`);
try {
  exigirDestinoCorrecto(CLAVE, url, WORKTREE);
} catch (e) {
  morir(`el destino NO cuadra:\n   ${e.message}`);
}
const bd = parseBDSegura(url);
if (!bd) morir('la URL de la base es ilegible (no se imprime: ilegible ya es toda la información)');
console.log(`   destino: ${describirBD(url)}`);
if (bd.base !== 'yaqu_dev_javier') {
  morir(`esta herramienta SOLO aplica a \`yaqu_dev_javier\`, y ${CLAVE} apunta a «${bd.base}».`);
}

// ── 2 · el SQL, ENTERO y a la vista, antes de conectar con nada ──────────────────────────
const sql = fs.readFileSync(ruta, 'utf8');
console.log(`\n── SQL (${ruta}) ───────────────────────────────────────────`);
sql.split(/\r?\n/).forEach((l, i) => console.log(`   ${String(i + 1).padStart(3)} │ ${l}`));

// El veredicto (lista blanca + suelo) lo da el módulo puro, para que su rojo se pueda ejercitar
// sin ficheros ni base de datos.
const veredicto = revisar(sql, { ruta });
if (!veredicto.ok) morir(veredicto.mensaje);

console.log(`\n   ✅ ${veredicto.permitidas.length} sentencia(s), todas de forma conocida:`);
for (const p of veredicto.permitidas) console.log(`      línea ${p.linea}: ${p.forma}`);

// ── 3 · aplicar, solo con --go ───────────────────────────────────────────────────────────
if (!GO) {
  console.log('\n── ENSAYO ──────────────────────────────────────────────────');
  console.log('   NO se ha tocado la base. Para aplicar, repite con `--go`.\n');
  process.exit(0);
}

console.log('\n── APLICANDO ───────────────────────────────────────────────');

// ⚠️ SE INVOCA EL ENTRYPOINT DE PRISMA CON `node`, NO `npx`. Dos motivos, los dos medidos:
//
//   · desde Node 20.12/22 (arreglo de CVE-2024-27980) `spawn` **se niega a ejecutar un `.cmd`**
//     sin `shell: true`. Con `npx.cmd` esto devolvía `status: null` y no aplicaba nada;
//   · y `shell: true` sería peor: mete un intérprete de por medio en el único sitio de este
//     script donde hay una URL de base en el entorno.
//
// Llamando al JS local no hay shell, no hay `.cmd` y no hay descarga silenciosa de un prisma de
// la red — el incidente del 5-ago con `npx` bajándose otro CLI y devolviendo «sin cambios».
const PRISMA_JS = path.join('node_modules', 'prisma', 'build', 'index.js');
if (!fs.existsSync(PRISMA_JS)) morir(`no encuentro el CLI local de Prisma en ${PRISMA_JS} (¿npm install?)`);

// La URL va en el ENTORNO del hijo, nunca en argv. El schema resuelve `env("DATABASE_URL")`.
const r = spawnSync(
  process.execPath,
  [PRISMA_JS, 'db', 'execute', '--file', ruta, '--schema', 'prisma/schema.prisma'],
  { encoding: 'utf8', stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } },
);
// 🔴 EL ERROR DEL SPAWN SE DICE. `status: null` significa que el hijo ni llegó a correr, y
// reportar solo el código deja al que lo lee sin saber si falló la base o el lanzamiento —
// exactamente el rojo mudo que SCRUM-388 acaba de quitar del censo. Esta línea nació por eso.
if (r.error) morir(`no se pudo lanzar Prisma: ${r.error.message}`);
if (r.status !== 0) morir(`\`prisma db execute\` terminó con código ${r.status} (señal: ${r.signal ?? 'ninguna'})`);
console.log('\n   ✅ aplicado. AHORA VERIFICA LEYENDO EL CATÁLOGO, no este mensaje.\n');
