// scripts/guards-entrada.mjs — SCRUM-414 · lo que hay que mirar ANTES de empujar, todo de golpe.
//
//   npm run guards:entrada
//
// ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────────────────────
// En tres días, las entradas de `docs/master/` han sido cazadas por CUATRO guards distintos, y cada
// sesión los ha descubierto **en rojo, después de empujar**: el nombre del fichero (SCRUM-273), el
// ancla de medición (SCRUM-267), los tests declarados (SCRUM-391) y no nombrar documentos que no
// existen (SCRUM-242).
//
// Eso no es descuido. Ninguna sesión los conoce todos hasta que le saltan, y **no había forma de
// comprobarlos de golpe antes de empujar**: `npm test` compila y corre 2.400 tests, así que nadie
// lo lanza para revisar un fichero de texto. Cada rojo de estos cuesta una vuelta completa de PR.
//
// Todos corren **sin compilar y sin base de datos** —son estructurales, leen ficheros— así que el
// comando tarda segundos. Ese es el punto: uno que tarde un minuto no se ejecuta.
//
// ── 🔴 EL CRITERIO SE ENSANCHÓ EL 20-SEP-2026, Y ÉSTE ES EL MOTIVO (SCRUM-964) ───────────────
// Hasta hoy la lista era «los guards de la ENTRADA DE REGISTRO», o sea del fichero de
// `docs/master/`. Entra un quinto que NO es de la entrada —`public-js-parsea`— y el criterio pasa
// a ser el que de verdad los unía: **lo que puede poner un PR en rojo, se comprueba sin compilar y
// sin base, y se mira en segundos**.
//
// El caso que lo decide, medido: un comentario HTML con acentos graves dentro de un literal de
// plantilla **cierra el literal** y la pantalla deja de existir para el navegador. Es la CUARTA vez
// que muerde el mismo mecanismo (`plansView` en SCRUM-345, `exportView` en el ticket del guard, un
// tercero la misma mañana, y `expensesView` en SCRUM-964). La cuarta la cometió una sesión que
// tenía el aviso escrito **en el propio fichero, en su línea 113** — y no lo leyó, porque editó por
// búsqueda en la línea 399. **Un comentario solo avisa a quien pasa por delante.** El guard sí
// existía y sí lo cazó; lo que fallaba era CUÁNDO se corría: después de empujar, no antes.
//
// ── 🔴 SE ESTRECHÓ EL 21-SEP-2026 (SCRUM-976): «SEGUNDOS» TIENE UN TECHO, Y CADA UNO LLEVA SU NOMBRE ─
// El criterio de arriba, aplicado tal cual, mete 313 ficheros de `tests/` (verdes sin `dist` ni base,
// medidos uno a uno): unos 14 minutos. Eso ya no es «comprobar lo barato». Entran SEIS, y no por
// deducción sino por decisión del orquestador con la medición delante: 237, 258, 514, 522, 548 y 723.
// Los seis pasan **sin `dist` y sin base**, con `tests > 0` y `skipped = 0` (leer el texto del fichero
// no basta para saberlo: 522 lo nombra «navegador» y es lectura pura).
//
// El caso que lo decide, medido: el #1541 cayó en CI por `scrum237-negacion-respaldada` (una negación
// sin respaldo en `scrum320…:418`) y ESE MISMO commit daba VERDE aquí, porque 237 no estaba en la lista.
// Para añadir un séptimo: que pase sin `dist` ni base, que quepa bajo el techo, y que lleve al lado el
// rojo de CI que este comando no cazó.
//
// El techo NO es un número en un comentario: es `TECHO_MS`, y `tests/scrum976-guards-entrada-con-techo`
// lanza este comando de verdad, lo cronometra y cae si se pasa. Para añadir el siguiente hay que
// dejarle sitio a alguno o subir el techo A PROPÓSITO, en un PR que lo diga.
//
// ⚠️ Esto NO sustituye a `npm test`. Comprueba lo barato de comprobar, no el trabajo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Cada uno con el motivo por el que está, para que quien añada el sexto sepa qué clase de cosa
 * entra aquí: **lo que puede poner en rojo un PR, se comprueba leyendo ficheros —sin compilar y
 * sin base— y tarda segundos**. Los cuatro primeros son de la entrada de `docs/master/`; el quinto
 * no, y por eso el criterio está escrito arriba en vez de deducirse de la lista.
 */
export const GUARDS = [
  { fichero: 'tests/scrum273-registro-por-fichero.test.mjs',
    porque: 'el fichero se llama SCRUM-<n>.md y el trabajo no se escribe en YAQU_MASTER.md' },
  { fichero: 'tests/scrum267-ancla-de-medicion.test.mjs',
    porque: 'la entrada declara contra qué `origin/main` se midió, con sha de 40 y hora con huso' },
  { fichero: 'tests/scrum391-guards-declarados-presentes.test.mjs',
    porque: 'todo test que la entrada DECLARA existe en el árbol' },
  { fichero: 'tests/scrum242-scripts-no-prometen-documentos.test.mjs',
    porque: 'no se nombra un documento que no existe (la promesa que se lee y no se busca)' },
  // SCRUM-964 · el quinto, y el primero que no es de la entrada: mira el CÓDIGO del front.
  { fichero: 'tests/public-js-parsea.test.mjs',
    porque: 'todo .js que se sirve al navegador PARSEA (un backtick suelto borra una pantalla entera)' },
  // SCRUM-976 · los seis de lectura pura. Sin `dist`, sin base, `skipped = 0`; solos suman ~20 s.
  { fichero: 'tests/scrum237-negacion-respaldada.test.mjs',
    porque: 'ninguna negación de la suite se queda sin respaldo (el rojo del #1541: cayó en CI y aquí salía verde)' },
  { fichero: 'tests/scrum258-nota-por-sesion.test.mjs',
    porque: 'la nota del turno es de la SESIÓN: una no puede soltar el turno vivo de otra' },
  { fichero: 'tests/scrum514-aprobado-y-aplicado.test.mjs',
    porque: 'todo texto APROBADO está aplicado en la pantalla (la mitad de la regla 30 que faltaba)' },
  { fichero: 'tests/scrum522-guards-fuera-de-la-tanda.test.mjs',
    porque: 'la puerta de los guards de navegador sigue existiendo, el workflow la invoca y su lista sale derivada' },
  { fichero: 'tests/scrum548-peaje-package-json.test.mjs',
    porque: 'el censo de guards cuenta todos los declarados y el detector de solape sigue discriminando' },
  { fichero: 'tests/scrum723-guard-contra-su-base.test.mjs',
    porque: 'un guard compara contra el punto de partida de la rama, no contra la punta móvil de main' },
];

// TECHO de este comando ENTERO, en milisegundos de reloj. Lo hace cumplir el propio comando (plazo
// del `spawnSync`) y `tests/scrum976-guards-entrada-con-techo.test.mjs` lo lanza de verdad, lo
// cronometra y cae si se pasa. Medido el 21-sep-2026 con los once: 17,2 s (solos, los seis nuevos
// suman ~20 s; el runner los reparte), o sea ~3,5 veces de margen para una máquina cargada.
export const TECHO_MS = 60000;

// SUELO Nº1. Un agregador que se queda corto es PEOR que no tenerlo: da la tranquilidad entera con
// la cobertura a medias, y quien lo corre en verde deja de mirar. Si mañana alguien borra una línea
// de la lista de arriba «porque molestaba», esto para.
export const MINIMO = 11;

// Secuencias de escape ANSI (CSI). El runner de node colorea su resumen cuando cree que hay un
// terminal detrás —o cuando el entorno trae `FORCE_COLOR`—, y entonces la línea del recuento llega
// como `\x1b[34mℹ tests 26\x1b[39m`.
const ANSI = /\u001B\[[0-9;]*[A-Za-z]/g;

/**
 * El recuento de tests que imprime el runner de node, leído de su salida.
 *
 * Está aquí fuera, y exportada, porque es lo único de este script que se puede equivocar en
 * silencio: si devuelve 0 cuando han corrido 26, el comando dice «tus guards no han corrido» y
 * manda a quien lo lea a buscar un guard roto que no existe. Pasó de verdad el 17-sep-2026, a tres
 * sesiones el mismo día (SCRUM-928): el `\x1b[39m` del final rompía el ancla de fin de línea, el
 * recuento salía 0 y `guards:entrada` moría en rojo **con los 26 tests en verde**.
 *
 * Se limpia el color ANTES de leer, y no se afloja la expresión: el ancla es el suelo que
 * distingue la línea del recuento de cualquier otra que mencione «tests».
 *
 * Se arregla AQUÍ, en quien lee, y no en quien llama, porque poner `FORCE_COLOR=0` delante del
 * comando NO basta: se midió que una sesión lanzada así sigue trayendo `FORCE_COLOR=3` en su
 * entorno. Un arreglo que depende de que todo el mundo invoque bien no es un arreglo.
 */
export function recuentoDeTests(salida) {
  const limpia = (salida || '').replace(ANSI, '');
  const m = /^[^\n]*\btests\s+(\d+)\s*$/m.exec(limpia);
  return m ? Number(m[1]) : 0;
}

/**
 * El plazo que se le da al runner: el techo, o uno MENOR si el entorno lo pide. Un valor que no es
 * un número positivo se ignora y vale el techo (no se cae en «sin plazo»).
 */
export function techoEfectivo(pedido) {
  const n = Number(pedido);
  return Number.isFinite(n) && n > 0 ? Math.min(n, TECHO_MS) : TECHO_MS;
}

function main() {
const faltan = GUARDS.filter((g) => !fs.existsSync(path.join(RAIZ, g.fichero)));
if (faltan.length) {
  console.error('🔴 FALTAN GUARDS DE ENTRADA — no se ejecuta nada:\n');
  for (const g of faltan) console.error(`   · ${g.fichero}\n     (vigilaba: ${g.porque})`);
  console.error('\n  O el fichero se ha renombrado y hay que actualizar esta lista, o el guard ha');
  console.error('  desaparecido y hay que decidirlo a propósito. Correr los que quedan y decir');
  console.error('  «verde» sería exactamente el fallo que este comando viene a evitar.');
  process.exit(1);
}
if (GUARDS.length < MINIMO) {
  console.error(`🔴 la lista tiene ${GUARDS.length} guards y el mínimo son ${MINIMO}. No se ejecuta nada.`);
  process.exit(1);
}

console.log(`Guards de entrada del registro (${GUARDS.length}):`);
for (const g of GUARDS) console.log(`  · ${path.basename(g.fichero)} — ${g.porque}`);
console.log();

// El techo es del comando ENTERO y lo hace cumplir `spawnSync`: pasado el plazo mata al runner y
// `r.error` trae ETIMEDOUT. Se puede BAJAR con `GUARDS_ENTRADA_TECHO_MS` (así lo prueba el test, sin
// esperar un minuto), nunca subir: un plazo que cualquiera alarga desde el entorno es una sugerencia.
const techo = techoEfectivo(process.env.GUARDS_ENTRADA_TECHO_MS);
const t0 = Date.now();
const r = spawnSync(process.execPath, ['--test', ...GUARDS.map((g) => g.fichero)], {
  cwd: RAIZ, encoding: 'utf8', timeout: techo,
});
const ms = Date.now() - t0;
process.stdout.write(r.stdout || '');
process.stderr.write(r.stderr || '');

if (r.error && r.error.code === 'ETIMEDOUT') {
  console.error(`\n🔴 los guards de entrada se pasaron del TECHO: más de ${techo} ms (el techo es ${TECHO_MS} ms).`);
  console.error('  Un comando que tarda un minuto no se ejecuta, y entonces no vigila nada. Deja sitio a');
  console.error('  alguno de la lista o sube el techo A PROPÓSITO, en un PR que lo diga (SCRUM-976).');
  process.exit(1);
}

// SUELO Nº2: que además de correr, HAYAN CORRIDO. Un fichero que existe pero se quedó sin tests
// —o un runner que no encuentra nada— saldría con éxito y en silencio, y «0 tests, 0 fallos» es
// verde. Se lee el recuento que imprime el propio runner.
const ejecutados = recuentoDeTests(r.stdout || '');
if (ejecutados < MINIMO) {
  console.error(`\n🔴 solo se ejecutaron ${ejecutados} tests entre ${GUARDS.length} ficheros.`);
  console.error('  Los ficheros están, pero no han corrido: «0 tests, 0 fallos» también sale verde.');
  process.exit(1);
}

if (r.status !== 0) {
  console.error('\n🔴 Algún guard de entrada está en rojo. Arréglalo ANTES de empujar: si entra así,');
  console.error('  el PR sale rojo y cuesta una vuelta entera.');
  process.exit(r.status ?? 1);
}
console.log(`\n✓ ${GUARDS.length} guards de entrada en verde (${ejecutados} tests, ${(ms / 1000).toFixed(1)} s de ${TECHO_MS / 1000}). La entrada puede empujarse.`);
}

// Solo corre cuando se le llama como comando. Importarlo —para probar el lector de arriba— no
// debe lanzar 23 s de guards ni, peor, matar a quien lo importa con un `process.exit(1)`.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
