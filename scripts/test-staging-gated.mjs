// scripts/test-staging-gated.mjs — SCRUM-157
//
// EL COMANDO QUE LA GENTE EJECUTA para la tanda gateada COMPLETA. Antes, la tanda de
// rutina era `QA_DB_TEST=1 npm run test:staging`, tecleada a mano: exportaba SOLO
// QA_DB_TEST, así que `a55-window-quote` (A55_DB_TEST) y `bot-suite` (BOT_SUITE_TEST)
// NO corrían ni en CI (gateados) ni en esa tanda (su variable no se exportaba). Contaban
// como cobertura y no se ejecutaban NUNCA. Este runner los mete en el comando.
//
// POR QUÉ TRES PROCESOS Y NO UNO. a55 y bot-suite:
//   · mutan el merchant DEMO id=1 (no el QA id≥2 del resto) y son más lentos;
//   · a55 exige config propia (WHATSAPP_DRY_RUN, DEMO_SAFE_NUMBERS) que el resto no;
//   · la config de `dist` se CONGELA al primer import — mezclarlos en un mismo `node --test`
//     arriesga que las envs de uno pisen al otro. Por eso cada uno corre AISLADO, con sus
//     envs, en su propio proceso. El bloque QA_DB_TEST excluye esos dos ficheros para que
//     cada uno de los 51 gateados se cuente EXACTAMENTE UNA VEZ (ni skip fantasma ni doble).
//
// EXIT CODE: ≠0 si CUALQUIER hijo falla, nombrando cuál. `res.status` MANDA sobre los
// contadores parseados (ver abajo): un proceso que revienta con 0 tests no es "0 fallos",
// es "NO EJECUTÓ". Y se lee directo, sin tubería — la trampa 5 del runbook, aquí dentro.
//
// ── AUTOTEST / CONTRAPRUEBA (NO es la vía de uso normal) ──────────────────────
// Con un argumento de fichero, los TRES hijos apuntan a ESE fichero en vez de a sus
// objetivos reales. Existe SOLO para verificar el propio runner:
//   · fichero trivial VERDE  → los tres pasan → el runner debe salir 0 (no lleva un "1" fijo);
//   · fichero con un assert que FALLA → los tres rojos → el runner sale ≠0 nombrándolos.
// Uso normal: SIN argumentos (`npm run test:staging:gated`). El argumento es de diagnóstico.
//
// ⚠️ ALCANCE (SCRUM-157): este ticket entrega el MECANISMO. Hoy a55 y bot-suite salen
// ROJOS por bitrot del seed demo (P3-9 / SCRUM-159): «cliente seed no encontrado». Es lo
// esperado y correcto — un test que se ejecuta y falla grita; uno que no se ejecuta miente
// en el recuento. El verde de esos dos es cosa de SCRUM-159, no de aquí.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
// SCRUM-182: la tanda dura ~11 min leyendo dist/, tests/ y el cliente de Prisma. Si algo los
// reescribe mientras corre, los resultados no valen. El detalle, en el propio módulo.
import {
  huellaArtefactos,
  compararHuellas,
  mensajeArbolMovido,
  CODIGO_SALIDA_ARBOL_MOVIDO,
} from './_artefactos-guard.mjs';

const override = process.argv[2] || null; // contraprueba/diagnóstico: si viene, todos lo usan

const TESTS_DIR = 'tests';
const AISLADOS = ['a55-window-quote.test.mjs', 'bot-suite.test.mjs'];

// El bloque QA_DB_TEST corre TODOS los *.test.mjs MENOS los dos aislados (para no contarlos
// dos veces: aquí saltarían, y abajo se ejecutan de verdad). DERIVADO DEL DIRECTORIO, no
// una lista literal: un fichero de test nuevo entra solo — si fuese enumeración a mano,
// un test que nadie añada aquí no correría nunca (sería SCRUM-158 dentro de este runner).
const ficherosQa = readdirSync(TESTS_DIR)
  .filter((f) => f.endsWith('.test.mjs') && !AISLADOS.includes(f))
  .map((f) => `${TESTS_DIR}/${f}`);

// ⚠️ INVARIANTE DE ORDEN — NO es preferencia, es requisito de Windows.
// El hijo `pesado` (la suite QA: `node --test` sobre ~337 ficheros) deja el proceso/DLL de
// Prisma en un estado que hace CRASHear al SIGUIENTE hijo con exit=3221225794
// (0xC0000142 / STATUS_DLL_INIT_FAILED) y 0 tests — el lock de DLL que avisa el CLAUDE.md.
// Medido: dos procesos Prisma ligeros seguidos corren limpios; el crash solo aparece DESPUÉS
// del pesado. Por eso EL HIJO PESADO VA SIEMPRE EL ÚLTIMO. El síntoma (0xC0000142) no se
// parece a la causa (reordenar este array), así que hay un chequeo mecánico abajo que lo
// impide: reordenar y dejar el pesado sin ser el último ABORTA antes de lanzar nada.
const hijos = [
  {
    nombre: 'a55-window-quote (aislado)',
    env: { A55_DB_TEST: '1', WHATSAPP_DRY_RUN: '1', DEMO_SAFE_NUMBERS: '34611000001', QA_DB_TEST: undefined, BOT_SUITE_TEST: undefined },
    args: ['--test', '--test-force-exit', '--test-concurrency=1', override || `${TESTS_DIR}/a55-window-quote.test.mjs`],
  },
  {
    nombre: 'bot-suite (aislado)',
    env: { BOT_SUITE_TEST: '1', QA_DB_TEST: undefined, A55_DB_TEST: undefined },
    args: ['--test', '--test-force-exit', '--test-concurrency=1', override || `${TESTS_DIR}/bot-suite.test.mjs`],
  },
  {
    nombre: 'suite QA_DB_TEST (gateados QA + ungated, sin a55/bot)',
    pesado: true, // node --test sobre ~337 ficheros → deja el DLL de Prisma bloqueado
    env: { QA_DB_TEST: '1', WHATSAPP_DRY_RUN: '1', A55_DB_TEST: undefined, BOT_SUITE_TEST: undefined },
    args: ['--test', '--test-force-exit', '--test-concurrency=1', ...(override ? [override] : ficherosQa)],
  },
];

// CHEQUEO MECÁNICO del invariante de orden (condición 1): el pesado, si existe, es el último.
{
  const idxPesado = hijos.findIndex((h) => h.pesado);
  if (idxPesado !== -1 && idxPesado !== hijos.length - 1) {
    console.error(
      '\n❌ test-staging-gated: el hijo PESADO no es el último de la lista.\n' +
      '   Debe ir SIEMPRE al final: en Windows deja el DLL de Prisma bloqueado y el hijo\n' +
      '   siguiente crashea con exit=3221225794 (0xC0000142). Reordena `hijos` y vuelve.\n',
    );
    process.exit(2);
  }
}

// node --test cierra con líneas de resumen prefijadas por `ℹ` (spec) o `#` (tap). Se cuentan
// TODAS las categorías para poder cuadrar la suma; si node reporta cancelled/todo y no se
// cuentan, la suma no daría el total por diseño.
const CATS = ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'];
function parseCuenta(salida) {
  const c = Object.fromEntries(CATS.map((k) => [k, 0]));
  const re = /^[#ℹ]\s+(tests|pass|fail|cancelled|skipped|todo)\s+(\d+)/gm;
  let m;
  while ((m = re.exec(salida)) !== null) c[m[1]] = Number(m[2]);
  return c;
}

const agg = Object.fromEntries(CATS.map((k) => [k, 0]));
const fallaron = [];

console.log(`\n── SCRUM-157 · tanda gateada COMPLETA (3 procesos)${override ? ` · AUTOTEST → ${override}` : ''} ──\n`);

const huellaAntes = huellaArtefactos(process.cwd()); // SCRUM-182

for (let i = 0; i < hijos.length; i++) {
  const h = hijos[i];
  const env = { ...process.env };
  for (const [k, v] of Object.entries(h.env)) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
  const res = spawnSync(process.execPath, h.args, { env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const salida = (res.stdout || '') + (res.stderr || '');
  process.stdout.write(salida); // que la salida del hijo NO se pierda
  const code = res.status; // ← se lee directo, sin tubería (trampa 5)
  const c = parseCuenta(salida);

  // REGLA A · si status≠0 y no ejecutó ningún test, NO es "0 fallos": es un proceso que NO
  //           arrancó (crash, DLL, lo que sea). Se nombra como tal y NO se agregan sus ceros.
  if (code !== 0 && c.tests === 0) {
    fallaron.push(`${h.nombre} [NO EJECUTÓ · exit=${code}]`);
    console.log(`\n[${i + 1}/${hijos.length}] ${h.nombre}: ❌ NO EJECUTÓ (exit=${code}, 0 tests) — no me fío de sus contadores.`);
    continue;
  }

  // REGLA B · la suma de categorías tiene que dar el total del propio hijo. Si no cuadra,
  //           el parseo miente o node cambió de formato: se ABORTA, no se sigue agregando.
  const sumaHijo = c.pass + c.fail + c.cancelled + c.skipped + c.todo;
  if (sumaHijo !== c.tests) {
    console.error(
      `\n❌ test-staging-gated: los números del hijo «${h.nombre}» no cuadran ` +
      `(tests=${c.tests}, pass+fail+cancelled+skip+todo=${sumaHijo}). No me fío — abortado.\n`,
    );
    process.exit(3);
  }

  for (const k of CATS) agg[k] += c[k];
  // REGLA C · status≠0 MANDA sobre los contadores: aunque el parseo diga 0 fallos, si el
  //           proceso salió ≠0 el hijo cuenta como fallido.
  if (code !== 0) fallaron.push(h.nombre);
  console.log(`\n[${i + 1}/${hijos.length}] ${h.nombre}: exit=${code}  tests=${c.tests} pass=${c.pass} fail=${c.fail} skip=${c.skipped} cancelled=${c.cancelled} todo=${c.todo}`);
}

// SCRUM-182 · ¿leyó la tanda un árbol quieto? Va ANTES del agregado y del recuento de
// fallos a propósito: si el árbol se movió, ni el verde ni el rojo son evidencia, así que no
// tiene sentido presentar unos números que invitan a interpretarlos. Sale con su propio
// código (4) para no confundirse con "hubo tests rojos" (1) ni con "los números no cuadran" (3).
{
  const cambios = compararHuellas(huellaAntes, huellaArtefactos(process.cwd()));
  if (cambios.length) {
    console.error(mensajeArbolMovido(cambios));
    process.exit(CODIGO_SALIDA_ARBOL_MOVIDO);
  }
}

const suma = agg.pass + agg.fail + agg.cancelled + agg.skipped + agg.todo;
console.log('\n──────────────────────────────────────────────────────────────');
console.log(`AGREGADO · total=${agg.tests} pass=${agg.pass} fail=${agg.fail} skip=${agg.skipped} cancelled=${agg.cancelled} todo=${agg.todo}` +
  `  (suma=${suma} ${suma === agg.tests ? '✓ cuadra' : '✗ NO cuadra'})`);
if (fallaron.length) {
  console.log(`\n❌ FALLARON ${fallaron.length}: ${fallaron.join(' · ')}`);
  process.exit(1);
}
console.log('\n✅ Todos los procesos en verde.');
process.exit(0);
