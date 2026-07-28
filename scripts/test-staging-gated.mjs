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
import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
// SCRUM-182: la tanda dura ~11 min leyendo dist/, tests/ y el cliente de Prisma. Si algo los
// reescribe mientras corre, los resultados no valen. El detalle, en el propio módulo.
import {
  huellaArtefactos,
  compararHuellas,
  mensajeArbolMovido,
  CODIGO_SALIDA_ARBOL_MOVIDO,
} from './_artefactos-guard.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // resolver el preflight junto a este script (SCRUM-167)
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
    // SCRUM-180: `WHATSAPP_DRY_RUN` lo fijaba SOLO la línea 26 de bot-suite.test.mjs, cuando
    // sus dos hermanos de esta lista ya lo traían del runner. La asimetría no se veía y es
    // justo el hijo peor: bot-suite simula un flujo entero, once mensajes, no uno. Ponerlo
    // aquí no sustituye al freno del sender (whatsappPolicy.esProcesoDeTest) — lo dobla, que
    // es lo que toca cuando el fallo se paga en el número de WhatsApp Business.
    env: { BOT_SUITE_TEST: '1', WHATSAPP_DRY_RUN: '1', QA_DB_TEST: undefined, A55_DB_TEST: undefined },
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

// ── PREFLIGHT (SCRUM-167): antes de lanzar ningún hijo, comprobar que el esquema de la BD
// coincide con prisma/schema.prisma. Los tres hijos corren contra DATABASE_URL_STAGING (vía
// _staging-db.mjs); el preflight lee ESA MISMA variable (sin pasarle URL) para mirar
// EXACTAMENTE la misma BD. Si no da luz verde → ABORTA aquí con la causa nombrada, en vez de
// dejar caer 16 errores crípticos de Prisma repartidos por los ficheros (SCRUM-160).
if (!override) {
  const preflightPath = path.join(HERE, 'preflight-schema-drift.mjs');
  // AUSENTE ≠ deriva. `node <script-ausente>` arranca node (pf.error vacío) y sale 1 por
  // «Cannot find module» — indistinguible de una deriva (exit 1) si no se comprueba antes.
  // Caso real: un cherry-pick del enganche sin el preflight (van juntos, pero se pueden separar).
  if (!existsSync(preflightPath)) {
    console.error('\n❌ tanda gateada ABORTADA: falta scripts/preflight-schema-drift.mjs — el preflight no pudo ejecutarse. NO es una deriva de esquema; no toques la BD por esto.');
    process.exit(2);
  }
  // Está pero podría REVENTAR con un error de SINTAXIS (edición a medias): `node --check` lo
  // detecta sin ejecutarlo y da un mensaje específico. (--check valida sintaxis, NO resuelve
  // imports: un import roto pasa --check y revienta en runtime con exit 1 — pero ESE caso lo
  // cierra el código distintivo de abajo: exit 1 ≠ 3, así que no se lee como deriva.)
  const chk = spawnSync(process.execPath, ['--check', preflightPath], { stdio: 'inherit' });
  if (chk.status !== 0) {
    console.error('\n❌ tanda gateada ABORTADA: el preflight tiene un error de sintaxis (ver arriba) — no se pudo ejecutar. NO es una deriva de esquema; no toques la BD por esto.');
    process.exit(2);
  }
  const pf = spawnSync(process.execPath, [preflightPath], { stdio: 'inherit' });
  // Códigos del preflight: 0 = en sync · 2 = no se pudo comparar / guard anti-prod · 3 = DERIVA.
  // El 3 es DISTINTIVO: SOLO él autoriza a sugerir `db push`. node sale 1 ante cualquier fallo de
  // arranque (import roto, crash) — que aquí cae en «no lo tomes como deriva», jamás en push.
  if (pf.error) {
    console.error(`\n❌ tanda gateada ABORTADA: el preflight no pudo ejecutarse (${pf.error.code || pf.error.message}). NO es una deriva de esquema — no toques la BD por esto.`);
    process.exit(2);
  } else if (pf.status === 3) {
    // DERIVA de esquema: la BD no coincide con el fichero. ÚNICO caso en que se sincroniza.
    console.error('\n❌ tanda gateada ABORTADA: DERIVA DE ESQUEMA. Sincroniza esa BD con `db push` — el sentido (por detrás / por delante) está impreso arriba.');
    process.exit(1);
  } else if (pf.status === 2) {
    // Guard anti-prod o no se pudo comparar: la causa la imprimió el preflight. Nunca db push.
    console.error('\n❌ tanda gateada ABORTADA: el preflight no dio luz verde (no se pudo comparar / guard anti-prod). La causa está impresa arriba. NO apliques nada hasta leerla.');
    process.exit(2);
  } else if (pf.status !== 0) {
    // DEFECTO SEGURO: cualquier código NO RECONOCIDO (1 y demás) = el preflight no llegó a un
    // veredicto (crash de Node, import roto). Cae AQUÍ, jamás en la rama de `db push`.
    console.error(`\n❌ tanda gateada ABORTADA: el preflight no dio luz verde (código no reconocido: exit=${pf.status}; probable crash / import roto). La causa está arriba. NO es una deriva; NO apliques nada.`);
    process.exit(2);
  }
  // pf.status === 0 → en sync: sigue.
} else {
  // El preflight NO se omite en silencio: se declara. En autotest no hay BD real que comprobar.
  console.log('preflight OMITIDO (modo autotest: sin BD real que comprobar).');
}

// SCRUM-182: huella de dist/, tests/ y el cliente de Prisma justo ANTES del bucle. El preflight
// de arriba solo hace `migrate diff` (lectura), no mueve el árbol, así que va antes como gate.
const huellaAntes = huellaArtefactos(process.cwd());

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
