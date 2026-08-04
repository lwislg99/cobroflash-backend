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
// es "NO EJECUTÓ". Y se lee directo, sin tubería — la trampa 5 del «Runbook de ejecución de los
// tests gateados» de docs/QA/SUITE_REGRESION.md, aquí dentro.
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
//
// ⚠️ ESTE SCRIPT ESCRIBE EN STAGING (SCRUM-188). Desde que toma el turno, ya no es solo un
// lanzador: modifica el comentario de catálogo de la BD. Por eso aplica la allowlist de host
// de `_db-guard.mjs` de forma INCONDICIONAL, igual que `marcar-staging.mjs` — misma razón:
// una herramienta que escribe no puede depender de que alguien recuerde comprobar antes.
import 'dotenv/config'; // el turno necesita DATABASE_URL_STAGING en el PADRE, no solo en los hijos
import { spawnSync } from 'node:child_process';
import { readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { PrismaClient } from '@prisma/client';
import { assertSafeStagingUrl, STAGING_HOST } from './_db-guard.mjs';
// SCRUM-253 · la identidad de la sesión, derivada del árbol de trabajo.
import { dueñoActual } from './_identidad-sesion.mjs';
// SCRUM-265 · los límites por hijo y la lectura del override, con su porqué medido y con red.
import { LIGHT_MS, HEAVY_MS, VAR_OVERRIDE, resolverOverride } from './_timeouts-tanda.mjs';
// SCRUM-182: la tanda dura ~31 min (SCRUM-265: MEDIDO en el recibo, no estimado) leyendo
// dist/, tests/ y el cliente de Prisma. Si algo los
// reescribe mientras corre, los resultados no valen. El detalle, en el propio módulo.
import {
  huellaArtefactos,
  compararHuellas,
  mensajeArbolMovido,
  CODIGO_SALIDA_ARBOL_MOVIDO,
} from './_artefactos-guard.mjs';
// SCRUM-188: R6 («una sola tanda contra staging a la vez») era una convención que ninguna
// máquina podía leer. El turno vive ahora como sufijo del marcador de SCRUM-118.
import {
  adquirirLock,
  refrescarLock,
  soltarLock,
  ttlParaTanda,
  MARGEN_TTL_MS,   // SCRUM-249 · margen del compromiso, el mismo que usa el TTL
  formatearDuracion,
  mensajeLockAjeno,
  mensajeLockPerdido,
  CODIGO_SALIDA_LOCK_AJENO,
  CODIGO_SALIDA_LOCK_PERDIDO,
} from './_staging-lock.mjs';
// SCRUM-249: la nota local, para que `turno:soltar` pueda liberar una tanda que murio mal.
import { guardarNota, borrarNota } from './_turno-nota.mjs';
// SCRUM-161: al terminar, el runner deja un RECIBO de que la tanda corrió. Es lo único que el
// guard de cierre acepta como evidencia, porque es lo único que no se puede teclear.
// SCRUM-239: `huellaDeCodigo` es el ANCLA del recibo, y se importa (no se reimplementa) para
// que el runner y el verificador no puedan calcular cosas distintas.
import { RUTA_RECIBO, HIJOS_SPEC, AISLADOS, pesadoEsElUltimo, huellaDeCodigo } from './_evidencia-tanda.mjs';
// SCRUM-265: piezas puras del margen. Viven fuera porque este fichero es un SCRIPT — importarlo
// desde un test lanzaría una tanda —, y sin poder importarlas no habría forma de darles red.
import { medirMargen, textoDeMargen, esAbortadoPorTiempo, margenesVacios } from './_margen-tanda.mjs';
// SCRUM-197: el parseo del resumen de node:test vive extraído, para que un test lo ejercite sin
// arrancar la tanda. De su comportamiento con salida truncada depende la distinción crash-vs-rojo.
import { CATS, parseCuenta } from './_parse-cuenta.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // resolver el preflight junto a este script (SCRUM-167)
const override = process.argv[2] || null; // contraprueba/diagnóstico: si viene, todos lo usan

const TESTS_DIR = 'tests';
// SCRUM-199: AISLADOS ya NO vive aquí — se IMPORTA de _evidencia-tanda.mjs (fuente única, derivada
// de HIJOS_SPEC). El guard de texto scrum199 impide que vuelva a escribirse a mano en este fichero.

// El bloque QA_DB_TEST corre TODOS los *.test.mjs MENOS los aislados (para no contarlos
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
// SCRUM-199: los hijos se CONSTRUYEN iterando HIJOS_SPEC (la fuente única en _evidencia-tanda.mjs).
// El runner solo añade lo runtime: los `args` (que dependen de `override` y de `ficherosQa`, que sí
// necesitan fs y no caben en la hoja). No re-lista claves ni ficheros — el guard scrum199 lo impide.
const hijos = HIJOS_SPEC.map((s) => ({
  nombre: s.nombre,
  clave: s.clave,
  ...(s.pesado ? { pesado: true } : {}),
  env: s.env,
  args: ['--test', '--test-force-exit', '--test-concurrency=1',
    ...(override ? [override] : (s.aislado ? [`${TESTS_DIR}/${s.fichero}`] : ficherosQa))],
}));

// CHEQUEO MECÁNICO del invariante de orden: el pesado, si existe, es el último. Se comprueba contra
// HIJOS_SPEC (la fuente única, SCRUM-199), no contra `hijos`, para no crear una CUARTA lista.
if (!pesadoEsElUltimo()) {
  console.error(
    '\n❌ test-staging-gated: el hijo PESADO no es el último de HIJOS_SPEC (_evidencia-tanda.mjs).\n' +
    '   Debe ir SIEMPRE al final: en Windows deja el DLL de Prisma bloqueado y el hijo\n' +
    '   siguiente crashea con exit=3221225794 (0xC0000142). Reordena HIJOS_SPEC y vuelve.\n',
  );
  process.exit(2);
}

// SCRUM-197: `CATS` y `parseCuenta` se importan de _parse-cuenta.mjs (arriba). Se extrajeron para
// que un test las ejercite sin arrancar la tanda; su comportamiento con salida truncada —del que
// depende la distinción crash-vs-rojo del recibo— queda fijado en tests/scrum197-parse-cuenta.test.mjs.

const agg = Object.fromEntries(CATS.map((k) => [k, 0]));
const fallaron = [];
// SCRUM-161/197 · DESGLOSE por hijo para el recibo de evidencia. Arranca en `null` = «no llegó a
// terminar»; se sustituye por `{exit, tests, pass, fail}` cuando el proceso de verdad terminó.
// SCRUM-197: guardar el fail PROPIO de cada hijo (no solo el exit) es lo que deja distinguir un
// CRASH (exit≠0, fail propio 0) de un ROJO (exit≠0, fail propio >0) sin heurística sobre el agregado.
const desgloseHijos = Object.fromEntries(hijos.map((h) => [h.clave, null]));

// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-265 · EL MARGEN VA EN UN MAPA APARTE. NO SE FUSIONA CON `desgloseHijos`. NUNCA.
//
// El criterio, y es el que decide: **el desglose de hijos es un dato de VEREDICTO; el margen es
// un dato de OBSERVACIÓN.** El validador decide si la tanda vale mirando el desglose; el margen
// no debe poder influir en esa decisión jamás. Separados, esa independencia es ESTRUCTURAL —
// imposible antes que vigilada.
//
// QUÉ SE ROMPE SI ALGUIEN LOS FUSIONA, con los números delante (medido en `_evidencia-tanda.mjs`):
//   1. Un hijo abortado por tiempo hoy deja su entrada en `null`, y el validador lo clasifica
//      con la clave `hijo` → «no llegó a terminar» (`_evidencia-tanda.mjs`, rama `h === null`).
//   2. Si el margen se metiera dentro, esa entrada YA NO sería `null`: sería un objeto sin `exit`
//      entero, así que caería en la rama siguiente → clave `incompleto` («recibo viejo o corrupto»).
//   3. Y `remedioDominante` SOLO escala con la clave `hijo`. `incompleto` no escala.
//   4. Resultado: una tanda abortada por tiempo dejaría de decir «inválida, re-córrela»; y si
//      además hubiera rojos, ganaría el remedio de ROJO → se pondría en CUARENTENA algo que ni
//      siquiera llegó a medir.
//
// Ese es exactamente el fallo que SCRUM-197 vino a impedir («el remedio DIVERGE: incompleta >
// roja, nunca los dos»). Fusionar estos dos mapas lo reintroduce entero, y el diff no lo enseña
// porque ninguna línea estaría mal: el defecto viviría en la composición.
//
// `null` = ese hijo NO LLEGÓ A LANZARSE. Un hijo que arrancó tiene SIEMPRE sus dos números,
// aunque muriera por timeout o crasheara. El detalle, en `_margen-tanda.mjs`.
// ─────────────────────────────────────────────────────────────────────────────────────────
const margenes = margenesVacios(hijos.map((h) => h.clave));

// ── BANNER (SCRUM-166): test:staging y test:staging:gated apuntan AQUÍ. Sale ANTES de nada,
// ruidoso, para que quien teclee el nombre viejo con memoria muscular vea QUÉ es esto y cuál es
// la rápida — en vez de descubrir a los ~31 min que se equivocó de comando (la tanda perdida del
// 27-jul). Dice la VERDAD en los DOS modos: en autotest declara que NO es la real, mismo
// principio que el "preflight OMITIDO" — un mecanismo que declara lo que NO hace no engaña.
if (override) {
  console.log(`\n⚠️  MODO AUTOTEST — fichero trivial (${override}), NO es la tanda real.`);
  console.log('    Los tres hijos apuntan a ese fichero: es diagnóstico del runner, no cobertura.');
} else {
  console.log('\n▶  TANDA GATEADA COMPLETA — 51 gateados + ungated, ~31 min.');
  console.log('    ¿Solo querías la rápida (ungated, sin staging)? → npm test');
}

console.log(`\n── SCRUM-157 · tanda gateada COMPLETA (3 procesos)${override ? ` · AUTOTEST → ${override}` : ''} ──\n`);

// ── TIMEOUT POR HIJO + SEÑAL DE VIDA (SCRUM-181) ─────────────────────────────
// Sin timeout, un hijo colgado dejaba la tanda muerta EN SILENCIO: la salida de cada hijo se
// escribe DESPUÉS de que vuelve (más abajo), así que un cuelgue no imprimía nada. Ahora el
// padre ANUNCIA antes de lanzar (con el límite efectivo) y ABORTA al hijo que se pase.
// Medido en el recibo del 2-ago-2026: a55 25,5 s · bot-suite 68,7 s · bloque QA 1.769,7 s.
// (SCRUM-188 lo subió aquí arriba: el TTL del turno se DERIVA de estos límites, y el turno se
// toma antes del preflight — o sea, antes de donde vivían estas constantes.)
//
// SCRUM-265 · los números y la lectura del override viven en `_timeouts-tanda.mjs`, con su
// porqué y con red. Aquí estaban SIN red, porque este fichero es un script: importarlo desde un
// test lanzaría una tanda entera. El comentario que había aquí decía «bloque QA (~10 min): ~3×
// de margen» y llevaba meses siendo falso — el bloque iba por 29,5 min contra un límite de 30.
const OVERRIDE = resolverOverride(process.env[VAR_OVERRIDE]);
if (!OVERRIDE.ok) {
  // PRESENTE E ILEGIBLE = error. Antes esto era `Number(…) || 0`: un valor que no se entendía
  // se convertía en «no hay override» y la tanda corría con el límite por defecto sin avisar.
  // Se aborta ANTES de tomar el turno: pedir la base para correr con una configuración que no
  // es la que se pidió sería bloquear a las demás sesiones para nada.
  console.error(`\n❌ ${OVERRIDE.motivo}\n`);
  console.error('   Ausente = se usan los límites por defecto. Presente e ilegible = esto.\n');
  process.exit(2);
}
const OVERRIDE_MS = OVERRIDE.ms; // 0 = sin override

// ── SCRUM-188 · EL TURNO DE STAGING ──────────────────────────────────────────
// Va ANTES del preflight a propósito: el preflight ya toca la BD, así que el turno tiene que
// estar tomado antes de la primera consulta y no solo antes del primer hijo.
//
// SE TOMA TAMBIÉN EN MODO AUTOTEST. El autotest no es «sin BD»: lanza los tres mismos procesos
// con la misma configuración de staging, y si el fichero que se le pasa es un gateado toca la
// base igual. Fingir que no la necesita convertiría el ensayo en un ensayo de otra cosa
// (lección de SCRUM-168: un artefacto que nunca se ejecuta como se va a ejecutar no está
// verificado). Lo que sí se omite en autotest es el preflight, y se declara.
//
// NO HAY VARIABLE PARA SALTÁRSELO, y es deliberado: una puerta de escape en un mecanismo de
// coordinación se acaba usando siempre, y entonces no coordina nada. Si el turno está tomado
// por una sesión muerta, el TTL lo libera solo; si hay prisa, `marcar-staging.mjs` lo limpia.
const TIMEOUT_MAYOR_MS = Math.max(...hijos.map((h) => OVERRIDE_MS || (h.pesado ? HEAVY_MS : LIGHT_MS)));
const TTL_MS = ttlParaTanda(TIMEOUT_MAYOR_MS);
// SCRUM-253 · la identidad sale de DÓNDE se trabaja, no del PID. Con el PID, este proceso y el
// del `turno:tomar` que lo precede eran «dueños» distintos, así que el runner se daba `exit 5`
// contra su propio turno. El porqué —y por qué no vale ni el host solo (SCRUM-258) ni una
// variable de entorno— está en `_identidad-sesion.mjs`.
const DUENO = dueñoActual();

// SCRUM-232 · QUÉ va a correr, para que quien llegue no tenga que adivinarlo.
//
// La REF sale de la rama, que es el dato que un humano reconoce a las once de la noche y el que
// dice si lo que corre es más urgente que lo suyo. Si `git` falla —worktree raro, HEAD suelto—
// se cae a `sin-ref` en vez de reventar: el contexto es informativo y no puede tumbar la tanda.
//
// La DURACIÓN PREVISTA es la suma de los timeouts de los hijos, no el TTL. Son cosas distintas y
// confundirlas es justo lo que hace inútil el mensaje de hoy: el TTL dice cuándo caduca el turno
// (1h 10min), no cuánto va a tardar esto (~27 min). Quien espera necesita lo segundo.
const REF_TANDA = (() => {
  const r = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' });
  const nombre = r.status === 0 ? (r.stdout || '').trim() : '';
  return nombre && nombre !== 'HEAD' ? nombre : 'sin-ref';
})();
const DURACION_PREVISTA_MS = hijos.reduce(
  (t, h) => t + (OVERRIDE_MS || (h.pesado ? HEAVY_MS : LIGHT_MS)), 0);

// La allowlist de host, INCONDICIONAL y antes de construir el cliente: desde SCRUM-188 este
// script escribe, y lo que escribe es la barrera de seguridad de SCRUM-118.
const urlStaging = process.env.DATABASE_URL_STAGING;
if (!urlStaging) {
  console.error('\n❌ tanda gateada ABORTADA: falta DATABASE_URL_STAGING en el entorno — sin ella no hay ni turno ni tanda.\n');
  process.exit(2);
}
{
  const check = assertSafeStagingUrl(urlStaging, process.env.DATABASE_URL);
  if (!check.safe) {
    console.error(
      `\n❌ tanda gateada ABORTADA: DATABASE_URL_STAGING no es una URL de staging segura (${check.reason}).\n` +
      `   Solo se opera contra el host de STAGING: ${STAGING_HOST}. Esta comprobación no se puede desactivar.\n`,
    );
    process.exit(2);
  }
}

const clienteTurno = new PrismaClient({ datasources: { db: { url: urlStaging } } });
let marcaPropia = null; // el marcador exacto que escribimos; sirve para no pisar el de otro

{
  let res;
  try {
    res = await adquirirLock(clienteTurno, {
      dueño: DUENO, ttlMs: TTL_MS,
      tipo: 'gated', ref: REF_TANDA, finPrevistoMs: Date.now() + DURACION_PREVISTA_MS,
      // SCRUM-249 · el primer compromiso cubre el preflight más el primer hijo. Sin esto, entre
      // tomar el turno y terminar el primer hijo el estado sería «sin compromiso», que es
      // justamente el hueco que este ticket cierra.
      señalAntesDeMs: Date.now() + (OVERRIDE_MS || (hijos[0]?.pesado ? HEAVY_MS : LIGHT_MS)) + MARGEN_TTL_MS,
    });
  } catch (err) {
    // Fail-closed, igual que la barrera: si no se puede COORDINAR, no se corre.
    console.error(`\n❌ tanda gateada ABORTADA: no se pudo tomar el turno de staging (${err?.message || err}).`);
    console.error('   Si no se puede coordinar, no se corre: dos tandas solapadas pueden salir VERDES por accidente.\n');
    await clienteTurno.$disconnect().catch(() => {});
    process.exit(2);
  }

  if (!res.ok && res.motivo === 'no-es-staging') {
    // Este script NUNCA marca una base. Si no llevaba ya el marcador de SCRUM-118, aborta.
    console.error(`\n❌ tanda gateada ABORTADA: la base "${res.db}" NO lleva el marcador de staging (leído: ${JSON.stringify(res.marca)}).`);
    console.error('   El turno solo se escribe sobre una base YA marcada: marcar una es cosa de');
    console.error('   scripts/marcar-staging.mjs, que es el único con esa responsabilidad.\n');
    await clienteTurno.$disconnect().catch(() => {});
    process.exit(2);
  }

  if (!res.ok && res.motivo === 'ocupado') {
    console.error(mensajeLockAjeno({
      db: res.db, lock: res.lock, ahoraMs: res.ahoraMs, ttlMs: res.ttlMs,
      contexto: res.contexto, // SCRUM-232: qué está corriendo y cuánto le queda
    }));
    await clienteTurno.$disconnect().catch(() => {});
    process.exit(CODIGO_SALIDA_LOCK_AJENO);
  }

  marcaPropia = res.marca;
  // SCRUM-249: sin esta nota, una tanda que muere de forma anomala deja el turno secuestrado
  // hasta el TTL, porque la marca lleva el PID y nadie puede recomponerla.
  guardarNota({ marca: res.marca, db: res.db });
  // SCRUM-253 · ADOPTADO ≠ TOMADO ≠ RECLAMADO. Quien lee esta línea está intentando saber quién
  // escribe en la base; la palabra tiene que decir la verdad de lo que acaba de pasar.
  console.log(`🔒 turno de staging ${res.adoptado ? 'ADOPTADO' : 'TOMADO'} en "${res.db}" por «${DUENO}» (caduca solo en ${formatearDuracion(TTL_MS)}).`);
  if (res.adoptado) {
    console.log('   (ya era de esta sesión: lo tomaste con `turno:tomar` desde este mismo árbol. No se le ha quitado a nadie.)');
  }
  if (res.reclamado) {
    console.log(`   (reclamado: lo tenía «${res.lockPrevio.dueño}» desde ${res.lockPrevio.desdeIso} y había caducado.)`);
  }
  if (res.sufijoIgnorado) {
    console.log('   (el marcador traía un sufijo que no se entiende; se ha ignorado y reescrito — la barrera nunca dependió de él.)');
  }
}

// A partir de AQUÍ el turno está tomado: todo va dentro del try/finally que lo suelta.
// ⚠️ `process.exit()` NO ejecuta los `finally`. Por eso, de aquí abajo, ninguna salida usa
// `process.exit`: se lanza `salir(n)` y el código real se aplica al final, tras soltar.
// Aun así, el `finally` es BEST-EFFORT: un SIGKILL o un portátil cerrado no pasan por él.
// Lo que de verdad garantiza que el turno se libera es el TTL.
class SalidaTanda extends Error {
  constructor(codigo) { super(`salida ${codigo}`); this.codigo = codigo; }
}
const salir = (codigo) => { throw new SalidaTanda(codigo); };

/** Timeout del hijo que se va a lanzar. Es la base del compromiso de SCRUM-249. */
const timeoutDe = (h) => (h ? (OVERRIDE_MS || (h.pesado ? HEAVY_MS : LIGHT_MS)) : 0);

/**
 * Renueva el turno entre hijos. Si ya no es nuestro, aborta: la tanda deja de ser evidencia.
 *
 * SCRUM-249 · aquí se PUBLICA EL COMPROMISO: «vuelvo a dar señales antes de X», donde X es lo que
 * como mucho puede tardar el hijo que se va a lanzar, más el margen. Quien llegue compara ese
 * instante con el reloj de la BASE y sabe si el turno está vivo o huérfano sin esperar el TTL y
 * sin mirar un proceso que, si es de otra máquina, no puede ver.
 *
 * ⚠️ ESTO NO ES UN TEMPORIZADOR, Y ESA ES LA GARANTÍA. Se llama al terminar cada hijo, así que la
 * señal es de PROGRESO. Un proceso colgado pero vivo no termina hijos, no renueva, y su
 * compromiso vence solo. Con un `setInterval` pasaría lo contrario y el lock sería eterno.
 */
async function refrescarTurno(siguienteHijo = null) {
  const señalAntesDeMs = siguienteHijo
    ? Date.now() + timeoutDe(siguienteHijo) + MARGEN_TTL_MS
    : null;
  const r = await refrescarLock(clienteTurno, { marcaPropia, dueño: DUENO, señalAntesDeMs });
  if (!r.ok) {
    console.error(mensajeLockPerdido({ db: r.db, marcaPropia, marcaActual: r.marcaActual }));
    salir(CODIGO_SALIDA_LOCK_PERDIDO);
  }
  marcaPropia = r.marca;
}

let codigoFinal = 0;
try {
  await tanda();
} catch (err) {
  if (err instanceof SalidaTanda) {
    codigoFinal = err.codigo;
  } else {
    console.error('\n❌ tanda gateada ABORTADA por un error inesperado del runner:', err?.stack || err, '\n');
    codigoFinal = 2;
  }
} finally {
  try {
    const s = await soltarLock(clienteTurno, { marcaPropia });
    if (s.soltado) console.log(`\n🔓 turno de staging SOLTADO en "${s.db}".`);
    else console.log(`\n🔓 turno de staging: ya no era mío (marcador actual: ${JSON.stringify(s.marcaActual)}); no lo toco.`);
  } catch (err) {
    // No se convierte en fallo de la tanda: el TTL lo limpia. Pero se DICE, para que quien
    // encuentre el turno ocupado dentro de un rato sepa de dónde salió.
    console.error(`\n⚠️  no pude soltar el turno de staging (${err?.message || err}). Caducará solo en ${formatearDuracion(TTL_MS)}.`);
  }
  await clienteTurno.$disconnect().catch(() => {});
}
process.exit(codigoFinal);

// El cuerpo de la tanda. Declaración de función (se hoistea), así que puede quedar debajo del
// try/finally que la llama y el flujo se lee en orden: turno → tanda → soltar.
async function tanda() {

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
      salir(2);
    }
    // Está pero podría REVENTAR con un error de SINTAXIS (edición a medias): `node --check` lo
    // detecta sin ejecutarlo y da un mensaje específico. (--check valida sintaxis, NO resuelve
    // imports: un import roto pasa --check y revienta en runtime con exit 1 — pero ESE caso lo
    // cierra el código distintivo de abajo: exit 1 ≠ 3, así que no se lee como deriva.)
    const chk = spawnSync(process.execPath, ['--check', preflightPath], { stdio: 'inherit' });
    if (chk.status !== 0) {
      console.error('\n❌ tanda gateada ABORTADA: el preflight tiene un error de sintaxis (ver arriba) — no se pudo ejecutar. NO es una deriva de esquema; no toques la BD por esto.');
      salir(2);
    }
    const pf = spawnSync(process.execPath, [preflightPath], { stdio: 'inherit' });
    // Códigos del preflight: 0 = en sync · 2 = no se pudo comparar / guard anti-prod · 3 = DERIVA.
    // El 3 es DISTINTIVO: SOLO él autoriza a sugerir `db push`. node sale 1 ante cualquier fallo de
    // arranque (import roto, crash) — que aquí cae en «no lo tomes como deriva», jamás en push.
    if (pf.error) {
      console.error(`\n❌ tanda gateada ABORTADA: el preflight no pudo ejecutarse (${pf.error.code || pf.error.message}). NO es una deriva de esquema — no toques la BD por esto.`);
      salir(2);
    } else if (pf.status === 3) {
      // DERIVA de esquema: la BD no coincide con el fichero. ÚNICO caso en que se sincroniza.
      console.error('\n❌ tanda gateada ABORTADA: DERIVA DE ESQUEMA. Sincroniza esa BD con `db push` — el sentido (por detrás / por delante) está impreso arriba.');
      salir(1);
    } else if (pf.status === 2) {
      // Guard anti-prod o no se pudo comparar: la causa la imprimió el preflight. Nunca db push.
      console.error('\n❌ tanda gateada ABORTADA: el preflight no dio luz verde (no se pudo comparar / guard anti-prod). La causa está impresa arriba. NO apliques nada hasta leerla.');
      salir(2);
    } else if (pf.status !== 0) {
      // DEFECTO SEGURO: cualquier código NO RECONOCIDO (1 y demás) = el preflight no llegó a un
      // veredicto (crash de Node, import roto). Cae AQUÍ, jamás en la rama de `db push`.
      console.error(`\n❌ tanda gateada ABORTADA: el preflight no dio luz verde (código no reconocido: exit=${pf.status}; probable crash / import roto). La causa está arriba. NO es una deriva; NO apliques nada.`);
      salir(2);
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
    // SCRUM-188 · RENOVAR EL TURNO ENTRE HIJOS. El padre está bloqueado dentro de `spawnSync`
    // mientras un hijo corre: no hay bucle de eventos donde poner un temporizador, así que el
    // único sitio donde se puede refrescar es aquí. Eso acota el hueco sin renovar a lo que
    // tarde UN hijo — y por eso el TTL se deriva del timeout del hijo más lento (SCRUM-181).
    // Va al PRINCIPIO y no al final: si hemos perdido el turno, se sabe ANTES de lanzar el
    // siguiente proceso contra una base que ya está usando otro.
    // SCRUM-249 · se le pasa el hijo que se va a lanzar para publicar el compromiso ajustado a SU
    // timeout: prometer el del pesado mientras corre uno ligero daría 40 min de gracia a un
    // proceso que debería responder en 5, y el huérfano tardaría lo mismo en verse.
    await refrescarTurno(hijos[i]);

    const h = hijos[i];
    const env = { ...process.env };
    // SCRUM-253 · aquí se exportaba `YAQU_LOCK_DUENO` para que los hijos no avisaran de «turno
    // ajeno» al ver el del padre. Ya no hace falta: se lanzan SIN `cwd` propio, así que heredan
    // el del padre y calculan la MISMA identidad ellos solos. Y quitarlo importa más de lo que
    // parece — mientras esa variable existiera, la identidad se podía DECLARAR, y quien tomaba
    // el turno a mano sin exportarla se veía a sí mismo como ajeno (el hueco que la sesión 4
    // dejó anotado en SCRUM-260). Se deriva o no vale.
    for (const [k, v] of Object.entries(h.env)) {
      if (v === undefined) delete env[k];
      else env[k] = v;
    }
    const timeoutMs = OVERRIDE_MS || (h.pesado ? HEAVY_MS : LIGHT_MS);
    const limiteTxt = OVERRIDE_MS ? `${Math.round(OVERRIDE_MS / 1000)}s (override)` : `${Math.round(timeoutMs / 60000)} min`;
    // SEÑAL DE VIDA: se anuncia ANTES de lanzar, con el límite EFECTIVO (SCRUM-181 cond. 1). Si el
    // hijo cuelga, al menos se sabe cuál y con qué límite; su salida real llega cuando vuelve.
    console.log(`\n▶ [${i + 1}/${hijos.length}] lanzando ${h.nombre}… (límite ${limiteTxt})`);
    const t0 = Date.now();
    const res = spawnSync(process.execPath, h.args, {
      env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
      timeout: timeoutMs, killSignal: 'SIGTERM',
    });
    // SCRUM-265 · EL MARGEN SE ANOTA AQUÍ, ANTES DEL CORTE POR TIEMPO — y ese orden ES el ticket.
    // El hijo que agota su límite es el ÚNICO caso en que el margen importa de verdad, y con el
    // `continue` de abajo era justamente el que no dejaba nada escrito. Medir después del corte
    // sería medir todos los casos menos el que motiva la medición.
    const margen = medirMargen(t0, timeoutMs);
    margenes[h.clave] = margen;
    const durS = (margen.durMs / 1000).toFixed(1);
    const salida = (res.stdout || '') + (res.stderr || '');
    process.stdout.write(salida); // que la salida del hijo NO se pierda

    // TIMEOUT ≠ fallo normal (SCRUM-181). Al vencer el límite, spawnSync mata al hijo con
    // killSignal y devuelve status=null, signal='SIGTERM' y error.code='ETIMEDOUT' (los tres,
    // medido en Windows). Se nombra ABORTADO POR TIEMPO, cuenta como fallido y NO se agregan sus
    // contadores — un proceso que no terminó miente («no pude comprobar» ≠ «falló un test»).
    // NO se hace tree-kill: medido que matar a `node --test` reapea también su subproceso
    // por-fichero (el nieto NO queda huérfano con la conexión). Y un taskkill defensivo sobre un
    // res.pid YA MUERTO sería peligroso: si el SO reusó ese pid, mataría a otro proceso.
    if (esAbortadoPorTiempo(res)) {
      fallaron.push(`${h.nombre} [ABORTADO POR TIEMPO · ${durS}s > ${limiteTxt}]`);
      console.log(`\n[${i + 1}/${hijos.length}] ${h.nombre}: ⏱  ABORTADO POR TIEMPO tras ${durS}s (límite ${limiteTxt}${textoDeMargen(margen)}; signal=${res.signal || res.error?.code}). No agrego sus contadores.`);
      continue;
    }

    const code = res.status; // ← directo, sin tubería (trampa 5 del runbook de SUITE_REGRESION.md)
    // SCRUM-161 · el exit REAL de cada hijo va al recibo de evidencia. Se anota AQUÍ, después
    // del corte por timeout, para que un hijo abortado por tiempo se quede en `null` y no en
    // «0»: un proceso que no terminó no es un proceso que pasó. Los dos caminos que quedan por
    // debajo (el «NO EJECUTÓ» con su `continue`, y el normal) pasan los dos por esta línea.
    const c = parseCuenta(salida);
    // SCRUM-197: se guarda el DESGLOSE del hijo, no solo su exit. `c` sale de parseCuenta (lo que ya
    // se calcula para agregar): un crash sin resumen lo deja en ceros (fail=0), así el validador lo
    // lee como crash y no como rojo. Un resumen truncado no llega a escribirse: REGLA B (abajo) aborta.
    desgloseHijos[h.clave] = { exit: code, tests: c.tests, pass: c.pass, fail: c.fail };

    // REGLA A · si status≠0 y no ejecutó ningún test, NO es "0 fallos": es un proceso que NO
    //           arrancó (crash, DLL, lo que sea). Se nombra como tal y NO se agregan sus ceros.
    if (code !== 0 && c.tests === 0) {
      fallaron.push(`${h.nombre} [NO EJECUTÓ · exit=${code}]`);
      console.log(`\n[${i + 1}/${hijos.length}] ${h.nombre}: ❌ NO EJECUTÓ (exit=${code}, 0 tests, ${durS}s) — no me fío de sus contadores.`);
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
      salir(3);
    }

    for (const k of CATS) agg[k] += c[k];
    // REGLA C · status≠0 MANDA sobre los contadores: aunque el parseo diga 0 fallos, si el
    //           proceso salió ≠0 el hijo cuenta como fallido.
    if (code !== 0) fallaron.push(h.nombre);
    console.log(`\n[${i + 1}/${hijos.length}] ${h.nombre}: exit=${code} (${durS}s${textoDeMargen(margen)})  tests=${c.tests} pass=${c.pass} fail=${c.fail} skip=${c.skipped} cancelled=${c.cancelled} todo=${c.todo}`);
  }

  // SCRUM-188 · ¿seguía siendo nuestra la base al terminar? El refresco de dentro del bucle no
  // cubre lo que pasó DURANTE el último hijo, que es justo el más largo. Sin esta comprobación,
  // perder el turno en el bloque QA —el de ~10 min— sería el único caso que pasaría inadvertido.
  await refrescarTurno();

  // SCRUM-182 · ¿leyó la tanda un árbol quieto? Va ANTES del agregado y del recuento de
  // fallos a propósito: si el árbol se movió, ni el verde ni el rojo son evidencia, así que no
  // tiene sentido presentar unos números que invitan a interpretarlos. Sale con su propio
  // código (4) para no confundirse con "hubo tests rojos" (1) ni con "los números no cuadran" (3).
  {
    const cambios = compararHuellas(huellaAntes, huellaArtefactos(process.cwd()));
    if (cambios.length) {
      console.error(mensajeArbolMovido(cambios));
      salir(CODIGO_SALIDA_ARBOL_MOVIDO);
    }
  }

  // ── SCRUM-161 · EL RECIBO DE EVIDENCIA ───────────────────────────────────────
  // Va AQUÍ, y el sitio importa. Todo lo que aborta por encima —turno ajeno (5), deriva de
  // esquema, preflight sin veredicto (2), números que no cuadran (3), árbol movido (4)— son
  // casos de «NO PUDE COMPROBAR», y un recibo con esos números diría más de lo que se sabe.
  // A partir de esta línea los tres hijos han terminado y el agregado significa algo, tanto si
  // es verde como si es rojo: **el recibo se escribe también en rojo, a propósito**. Si solo se
  // escribiera en verde, «no hay recibo» sería ambiguo entre «no la corriste» y «salió roja», y
  // el validador no podría distinguir el descuido del rojo. Prefiere decir la verdad y que sea
  // el validador quien rechace un recibo con `fail > 0`.
  //
  // En MODO AUTOTEST se escribe igual, marcado `autotest: true`. Así el camino de escritura es
  // EL MISMO en los dos modos y se puede ensayar sin BD real (lección de SCRUM-168: un artefacto
  // que nunca se ejecuta como se va a ejecutar no está verificado), y el validador lo rechaza
  // por su nombre. De paso pisa cualquier recibo bueno anterior: falla cerrado.
  try {
    const commit = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout?.trim() || null;
    // SCRUM-239 · EL ANCLA. El `commit` se queda como CONTEXTO DECLARADO (contra qué se midió);
    // lo que el guard compara es la HUELLA del contenido, que sí ve las ediciones sin commitear.
    // Mismo `huellaDeCodigo` que usa el verificador: no hay dos cálculos capaces de divergir.
    const gitParaHuella = (args, stdin) => {
      const r = spawnSync('git', args, { encoding: 'utf8', input: stdin, maxBuffer: 64 * 1024 * 1024 });
      return r.status === 0 ? (r.stdout ?? '') : null;
    };
    const huella = huellaDeCodigo(gitParaHuella);
    const recibo = {
      commit,
      // `null` si no se pudo calcular, y el validador lo rechaza. Escribir un recibo SIN huella
      // es mejor que escribir uno con una huella a medias: el fallo se ve en vez de heredarse.
      huella: huella?.huella ?? null,
      huellaFicheros: huella?.ficheros ?? null,
      terminadaEn: new Date().toISOString(),
      total: agg.tests, pass: agg.pass, fail: agg.fail, skip: agg.skipped,
      ficheros: override ? 1 : ficherosQa.length,
      hijos: desgloseHijos,
      // SCRUM-265 · OBSERVACIÓN, no veredicto. Mapa hermano de `hijos`, jamás dentro: el porqué
      // y qué se rompe al fusionarlos está donde se declara `margenes`, arriba.
      margenes,
      autotest: Boolean(override),
      runner: 'scripts/test-staging-gated.mjs',
    };
    mkdirSync(path.dirname(RUTA_RECIBO), { recursive: true });
    writeFileSync(RUTA_RECIBO, JSON.stringify(recibo, null, 2) + '\n');
    console.log(`\n🧾 recibo de evidencia escrito en ${RUTA_RECIBO} (SCRUM-161).`);
  } catch (err) {
    // No convierte la tanda en fallida: el recibo es para el guard de cierre, no para la tanda.
    // Pero se DICE, porque su ausencia se lee como «no la corriste» y eso mandaría a repetir
    // once minutos de tests por un fallo de escritura de fichero.
    console.error(`\n⚠️  SCRUM-161: no pude escribir ${RUTA_RECIBO} (${err?.message || err}). La tanda SÍ corrió; el guard de cierre no lo sabrá.`);
  }

  const suma = agg.pass + agg.fail + agg.cancelled + agg.skipped + agg.todo;
  console.log('\n──────────────────────────────────────────────────────────────');
  console.log(`AGREGADO · total=${agg.tests} pass=${agg.pass} fail=${agg.fail} skip=${agg.skipped} cancelled=${agg.cancelled} todo=${agg.todo}` +
    `  (suma=${suma} ${suma === agg.tests ? '✓ cuadra' : '✗ NO cuadra'})`);
  if (fallaron.length) {
    console.log(`\n❌ FALLARON ${fallaron.length}: ${fallaron.join(' · ')}`);
    salir(1);
  }
  console.log('\n✅ Todos los procesos en verde.');
  salir(0);
}

