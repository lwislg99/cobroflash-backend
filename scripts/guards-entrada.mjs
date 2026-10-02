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
// 🔴 SCRUM-1179 · ESTO ES UN ATAJO, NO UNA RED MÁS. Todo lo de `GUARDS` es un `tests/*.test.mjs`, y
// el check obligatorio (`build + tests`) ya los corre y ya bloquea con ellos (`scrum711` comprueba
// que cada uno está en la tanda). Correrlo aquí adelanta el rojo, no añade protección: no se cite
// `guards:entrada` como segunda red de nada, que un guard citado dos veces parece el doble de lo
// que hay.
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
// ── 🔴 EL 1-OCT-2026 EL TECHO SE PARTIÓ EN DOS (SCRUM-1345): PLAZO NO ES PRESUPUESTO ──────────────
// Un solo número hacía dos trabajos: cortar a un runner que no acaba (PLAZO) y vigilar que la lista
// siga tardando segundos (PRESUPUESTO). Pasarse salía 1, el mismo código que «un guard encontró algo».
// Y cuánto tarda no lo decide este comando sino la máquina, medido sobre el mismo árbol y los mismos
// 122 tests: 13 s de mediana y 15,4 s de máximo en 597 pasadas de CI; aquí, de 10 s a más de 90
// según los núcleos libres, con 3 de 12 pasadas por encima sin que nadie tocara un guard.
//
//   · PLAZO: pasarse sale CIEGO —código 2, «no terminé; no sé nada de tus guards»—, salvo que antes
//     de cortar YA hubiera caído algún test: ése es un hallazgo real y manda (código 1).
//   · PRESUPUESTO: lo juzga `tests/scrum976-guards-entrada-con-techo` EN CI, donde la carga es constante.
//
// El número NO sube: siguen siendo 90 s. Las mediciones y los controles, en `docs/master/SCRUM-1345.md`.
//
// ── 🔴 EL 1-OCT-2026, POR LA TARDE (SCRUM-1386): UN RUNNER AL QUE MATAN TAMPOCO HA ENCONTRADO NADA ──
// El plazo era UNA forma de no terminar. La otra es que al runner lo maten desde fuera (el arnés, por
// memoria), y ésa seguía saliendo 1. Medido matándolo de verdad, siete casos con su testigo: a los 9 s
// había 97 tests en ✔ en su propio stdout y este comando dijo «solo se ejecutaron 0 tests». Contaba el
// resumen, no los tests. Y si el matado era UN proceso por fichero, el runner lo pintaba `✖ <ruta>` y
// de ahí salía «1 hallazgo».
//
// El código de salida NO lo distingue (`taskkill` y el kill de node dan 1; `Stop-Process`, 4294967295).
// Lo que sí: **un `node --test` que termina por su pie escribe SIEMPRE su resumen («tests N»), caiga lo
// que caiga; uno al que cortan no lo escribe nunca** (cinco formas de matar, cinco sin resumen).
//
//   · RUNNER SIN RESUMEN = no terminó: la MISMA rama que el plazo agotado. Un ciego, y de hallazgos
//     los ✖ que ya había escrito. Aquí no se mira ningún número de salida.
//   · FICHERO MUERTO (el caído es la RUTA del fichero, no un test): si no dejó NI UNA LETRA antes de
//     su ✖, es un ciego; si dejó su traza, arrancó y reventó: hallazgo. Es la regla de SCRUM-1343.
//
// ⚠️ El residuo, dicho: un fichero matado y uno que hace `process.exit(1)` callado son indistinguibles,
// y los dos salen ciegos. Las mediciones y los controles, en `docs/master/SCRUM-1386.md`.
//
// ⚠️ Esto NO sustituye a `npm test`. Comprueba lo barato de comprobar, no el trabajo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

import { veredictoDe } from './_hallazgos-y-ciegos.mjs';
import { marcasHuerfanas } from './_marca-de-arbol.mjs'; // SCRUM-1349

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
  // SCRUM-811 · el duodécimo. Reutiliza el troceador de scrum267 (sin git, sin DB): añade ~0,3 s.
  { fichero: 'tests/scrum811c-skill-ui-declarada.test.mjs',
    porque: 'toda entrada nueva que toca public/ declara si cargó yaqu-premium-ui, o por qué no' },
];

// TECHO de este comando ENTERO, en milisegundos de reloj. Lo hace cumplir el propio comando (plazo
// del `spawnSync`) y `tests/scrum976-guards-entrada-con-techo.test.mjs` lo lanza de verdad, lo
// cronometra y cae si se pasa. Medido el 21-sep-2026 con los once: 11-17 s con la máquina en frío
// (solos, los seis nuevos suman ~20 s; el runner los reparte) y 44,5 s con la máquina cargada por
// otras sesiones. El techo era de 60 s y ese margen (1,3 veces) era demasiado justo: un guard que cae
// por sorteo enseña a desconfiar de los rojos. Son 90 s (orquestador, 21-sep-2026).
export const TECHO_MS = 90000;

// SCRUM-1345 · El PRESUPUESTO es el mismo número, y no se elige: se deriva. Lo que cambia es DÓNDE se
// juzga —en CI, por `tests/scrum976-guards-entrada-con-techo`— y qué significa pasarse aquí (ciego, no
// rojo). Bajarlo es una decisión aparte, con su PR: en CI el máximo medido son 15,4 s.
export const PRESUPUESTO_MS = TECHO_MS;

// SUELO Nº1. Un agregador que se queda corto es PEOR que no tenerlo: da la tranquilidad entera con
// la cobertura a medias, y quien lo corre en verde deja de mirar. Si mañana alguien borra una línea
// de la lista de arriba «porque molestaba», esto para.
export const MINIMO = 12;

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

/**
 * Los tests que la salida del runner da por CAÍDOS, uno por línea, en lo que llegó a escribir. Vale
 * para una salida CORTADA, que no trae resumen: lee las líneas de resultado (`✖` del reporter `spec`,
 * `not ok` del `tap`), no el recuento del final.
 *
 * Sólo cuenta lo que el runner escribió ESTANDO VIVO: al runner se le corta con SIGKILL, así que
 * después del corte no escribe nada. Lo que sale de un proceso matado no se cuenta.
 *
 * ⚠️ Límite: es texto. Un guard que imprimiera por su cuenta una línea que empiece por `✖` contaría
 * como caído; por eso quien llama ENSEÑA las líneas que contó. Medido el 1-oct-2026 sobre cinco
 * salidas reales en verde (una entera y cuatro cortadas): 0 líneas así.
 */
export function fallosVistos(salida) {
  return (salida || '').replace(ANSI, '').split(/\r?\n/)
    .filter((l) => /^\s*(?:✖|not ok\b)/.test(l))
    .filter((l) => !/^\s*✖ failing tests:\s*$/.test(l) && !/#\s*(?:SKIP|TODO)\b/i.test(l))
    .map((l) => l.trim());
}

/** El `fail N` del resumen del runner; 0 si la salida no trae resumen. Mismo lector que el de arriba. */
function fallosDelResumen(salida) {
  const m = /^[^\n]*\bfail\s+(\d+)\s*$/m.exec((salida || '').replace(ANSI, ''));
  return m ? Number(m[1]) : 0;
}

/**
 * SCRUM-1386 · ¿Trae la salida EL RESUMEN del runner? Es lo que separa «terminó» de «lo cortaron»: un
 * `node --test` que acaba por su pie lo escribe siempre, con tests caídos o sin ellos; uno al que matan
 * no lo escribe nunca. Mismo lector que `recuentoDeTests`, pero sin confundir «no hay resumen» con
 * «el resumen dice 0» (esa confusión era el «solo se ejecutaron 0 tests» con 97 en verde delante).
 */
export function traeResumen(salida) {
  return /^[^\n]*\btests\s+\d+\s*$/m.test((salida || '').replace(ANSI, ''));
}

/** Los resultados en verde que el runner llegó a escribir. Sólo para DECIRLOS: no deciden nada. */
export function verdesVistos(salida) {
  return (salida || '').replace(ANSI, '').split(/\r?\n/).filter((l) => /^\s*(?:✔|ok\b)/.test(l)).length;
}

// Una línea que escribe EL RUNNER (reporter `spec`): un resultado, un diagnóstico o un grupo.
const LINEA_DEL_RUNNER = /^\s*(?:✔|✖|ℹ|﹣|▶)/;
// El resultado de primer nivel de algo que cayó: `✖ <nombre> (12.3ms)`. Sin sangría: no es un subtest.
const CAIDO_DE_PRIMER_NIVEL = /^✖ (.+) \(\d+(?:\.\d+)?ms\)\s*$/;

/**
 * SCRUM-1386 · LOS FICHEROS MUERTOS de una pasada que terminó: aquellos cuyo caído es LA RUTA del
 * fichero y no uno de sus tests. El runner lo pinta así cuando el proceso de ese fichero acabó mal sin
 * que el fallo fuera de un test: lo mataron, salió solo, o reventó al cargar.
 *
 * De cada uno dice si `callado`: no dejó NI UNA LETRA suya antes de su ✖ (lo que le precede es otra
 * línea del runner, o nada). Con traza delante, arrancó y reventó: eso es suyo.
 *
 * La ruta se compara RESUELTA contra la lista, no por texto (`tests\x` y `tests/x` son el mismo). Y
 * sólo se mira ANTES del resumen: después, el runner repite los caídos en «failing tests».
 *
 * ⚠️ Límites: es texto, y del reporter `spec`. Con otro reporter no reconoce ningún muerto y todo
 * caído sigue contando como hallazgo: el lado cerrado. Y si OTRO fichero deja texto suelto justo
 * delante del ✖ de un muerto callado, ése sale «con traza»: también el lado cerrado.
 */
export function ficherosMuertos(salida, { raiz = RAIZ, ficheros = GUARDS.map((g) => g.fichero) } = {}) {
  const lineas = (salida || '').replace(ANSI, '').split(/\r?\n/);
  const fin = lineas.findIndex((l) => /^[^\n]*\btests\s+\d+\s*$/.test(l));
  const hasta = fin === -1 ? lineas.length : fin;
  const rutas = new Map(ficheros.map((f) => [path.resolve(raiz, f), f]));
  const muertos = [];
  for (let i = 0; i < hasta; i += 1) {
    const m = CAIDO_DE_PRIMER_NIVEL.exec(lineas[i]);
    const fichero = m && rutas.get(path.resolve(raiz, m[1]));
    if (!fichero) continue;
    let j = i - 1;
    while (j >= 0 && lineas[j].trim() === '') j -= 1;
    muertos.push({ fichero, callado: j < 0 || LINEA_DEL_RUNNER.test(lineas[j]) });
  }
  return muertos;
}

/**
 * Las DOS cuentas de una pasada, para dárselas a `veredictoDe` (SCRUM-1320). Aquí no se decide ningún
 * código de salida: sólo se cuenta.
 *
 *   · NO TERMINÓ —se cortó por el plazo (`agotado`), o acabó sin dejar su resumen (SCRUM-1386: lo
 *     mataron, o ni se pudo lanzar)—: un ciego SIEMPRE —de lo que no acabó no se sabe nada—, y de
 *     hallazgos, los tests que ya habían caído antes del corte. Ésos son reales y no se pierden.
 *   · terminó con estado ≠ 0: hallazgos, los que dice su resumen MENOS los ficheros que murieron sin
 *     decir una letra, que son ciegos (SCRUM-1386). Y si no queda nada contado, al menos un hallazgo:
 *     salió distinto de 0.
 *   · terminó con 0: ni una cosa ni otra.
 *
 * `opciones` es sólo para probar `ficherosMuertos` contra una lista que no es la del árbol.
 */
export function cuentasDeLaPasada({ agotado, status, salida }, opciones) {
  const terminado = !agotado && traeResumen(salida);
  if (!terminado) {
    const vistos = fallosVistos(salida);
    return { hallazgos: vistos.length, ciegos: 1, vistos, terminado, callados: [] };
  }
  if (status !== 0) {
    const callados = ficherosMuertos(salida, opciones).filter((f) => f.callado).map((f) => f.fichero);
    const hallazgos = Math.max(0, fallosDelResumen(salida) - callados.length);
    return { hallazgos: hallazgos === 0 && callados.length === 0 ? 1 : hallazgos, ciegos: callados.length, vistos: [], terminado, callados };
  }
  return { hallazgos: 0, ciegos: 0, vistos: [], terminado, callados: [] };
}

/** La línea que sale SIEMPRE, también en verde y también si no se lanzó nada: población, tiempo y plazo. */
export function lineaDeLaPasada({ guards, ms, plazoMs }) {
  return `${guards} guards · ${(ms / 1000).toFixed(1)} s · plazo ${plazoMs / 1000} s`;
}

/**
 * 🔴 SCRUM-1349 · ¿HAY UNA MUTACIÓN PUESTA EN ESTE ÁRBOL? Entonces no se empuja.
 *
 * Los instrumentos que mutan el árbol (`meta:mutaciones`, `censo:mudez`) dejan una MARCA antes de
 * escribir y la borran al restaurar (SCRUM-808). Si los matan a mitad, la marca sobrevive y la
 * reparan ellos mismos LA PRÓXIMA VEZ QUE SE LANCEN. Hasta entonces el fichero mutado está en el
 * árbol con pinta de cambio propio, y lo único que lo delataba era un test de la tanda completa
 * —`scrum808`, «no hay una marca huérfana»— que en CI no puede caer nunca: la marca vive en
 * `.cache/`, que no viaja. Medido el 1-oct-2026 matando la pasada de verdad: árbol mutado, ese
 * test en rojo en local… y un `git add -A && git push` habría salido verde en CI con la mutación
 * dentro. Pasó ese mismo día con una línea de `homeView.js`, y la paró un `git status` mirado a ojo.
 *
 * Por eso va AQUÍ, en lo que se corre antes de empujar: es el único sitio donde la marca y el
 * árbol que se va a empujar están en la misma máquina.
 *
 * `extra` es una carpeta MÁS que mirar (así lo prueba su test, con una marca fabricada en el
 * temporal). Sólo AÑADE: la del árbol se mira siempre, y no hay forma de apartarla desde el entorno.
 */
export function mutacionesPuestas(extra = process.env.GUARDS_ENTRADA_CACHE_EXTRA) {
  return [...marcasHuerfanas(), ...(extra ? marcasHuerfanas(extra) : [])];
}

/** Lo que se le dice a quien iba a empujar. Una línea por marca, con el fichero y el remedio. */
export function avisoDeMutacionPuesta(marcas) {
  const lineas = ['🔴 HAY UNA MUTACIÓN PUESTA EN ESTE ÁRBOL — no se empuja nada:\n'];
  for (const m of marcas) {
    lineas.push(m.ilegible
      ? `   · \`${m.herramienta}\` dejó una marca que no se puede leer: no sé qué quedó puesto.`
      : `   · \`${m.herramienta}\` murió (pid ${m.pid}, ${m.cuando}) y dejó mutado: ${m.sucias.join(', ')}`);
  }
  lineas.push('\n  Lo devuelve a sus bytes ESA herramienta la próxima vez que arranca. Para');
  lineas.push('  `meta-guard-mutaciones` basta `node scripts/meta-guard-mutaciones.mjs --solo-censo`');
  lineas.push('  (segundos). Después, `git status`: no tiene que quedar nada que no sea tuyo.');
  return lineas.join('\n');
}

function main() {
const techo = techoEfectivo(process.env.GUARDS_ENTRADA_TECHO_MS);
const puestas = mutacionesPuestas();
if (puestas.length) {
  console.error(avisoDeMutacionPuesta(puestas));
  console.log(lineaDeLaPasada({ guards: 0, ms: 0, plazoMs: techo }));
  process.exit(1);
}
const faltan = GUARDS.filter((g) => !fs.existsSync(path.join(RAIZ, g.fichero)));
if (faltan.length) {
  console.error('🔴 FALTAN GUARDS DE ENTRADA — no se ejecuta nada:\n');
  for (const g of faltan) console.error(`   · ${g.fichero}\n     (vigilaba: ${g.porque})`);
  console.error('\n  O el fichero se ha renombrado y hay que actualizar esta lista, o el guard ha');
  console.error('  desaparecido y hay que decidirlo a propósito. Correr los que quedan y decir');
  console.error('  «verde» sería exactamente el fallo que este comando viene a evitar.');
  console.log(lineaDeLaPasada({ guards: 0, ms: 0, plazoMs: techo }));
  process.exit(1);
}
if (GUARDS.length < MINIMO) {
  console.error(`🔴 la lista tiene ${GUARDS.length} guards y el mínimo son ${MINIMO}. No se ejecuta nada.`);
  console.log(lineaDeLaPasada({ guards: 0, ms: 0, plazoMs: techo }));
  process.exit(1);
}

console.log(`Guards de entrada del registro (${GUARDS.length}):`);
for (const g of GUARDS) console.log(`  · ${path.basename(g.fichero)} — ${g.porque}`);
console.log();

// El plazo es del comando ENTERO y lo hace cumplir `spawnSync`: pasado, mata al runner y `r.error`
// trae ETIMEDOUT. Se puede BAJAR con `GUARDS_ENTRADA_TECHO_MS` (así lo prueba el test, sin esperar un
// minuto), nunca subir: un plazo que cualquiera alarga desde el entorno es una sugerencia.
// SCRUM-1345 · se le corta con SIGKILL para que NO escriba nada después del corte: lo que hay en
// `r.stdout` es lo que dijo estando vivo, y sólo eso se cuenta.
const t0 = Date.now();
const r = spawnSync(process.execPath, ['--test', ...GUARDS.map((g) => g.fichero)], {
  cwd: RAIZ, encoding: 'utf8', timeout: techo, killSignal: 'SIGKILL',
});
const ms = Date.now() - t0;
process.stdout.write(r.stdout || '');
process.stderr.write(r.stderr || '');

// SCRUM-1345 · las dos cuentas de la pasada y, de ellas, el veredicto: lo decide `veredictoDe`
// (SCRUM-1320), igual que en los guards de navegador. Aquí no se elige ningún código a mano.
const agotado = Boolean(r.error && r.error.code === 'ETIMEDOUT');
const cuentas = cuentasDeLaPasada({ agotado, status: r.status, salida: r.stdout || '' });
const veredicto = veredictoDe(cuentas);
const linea = lineaDeLaPasada({ guards: GUARDS.length, ms, plazoMs: techo });

// SCRUM-1386 · NO TERMINÓ: por el plazo, o porque acabó sin dejar su resumen (lo mataron, o ni se pudo
// lanzar). Las dos son la misma rama: de lo que no acabó no se sabe nada, y lo que ya había caído vale.
if (!cuentas.terminado) {
  const vistos = cuentas.vistos;
  const corte = agotado ? `plazo de ${techo / 1000} s`
    : (r.error ? `no se pudo lanzar: ${r.error.code || r.error.message}` : 'el runner acabó sin dejar su resumen');
  if (vistos.length > 0) {
    console.error(`\n🔴 HALLAZGO, y además no terminé. Antes del corte (${corte}) ya habían caído ${vistos.length}:`);
    for (const l of vistos) console.error(`   ${l}`);
    console.error('  Ésos son reales: arréglalos ANTES de empujar. Y la lista NO es completa: de los guards');
    console.error('  que no llegaron a acabar no sé nada.');
  } else if (!agotado) {
    console.error('\n⬜ CIEGO — no terminé; no sé nada de tus guards. ' + (r.error
      ? `El runner no llegó a arrancar (${r.error.code || r.error.message}).`
      : `El runner acabó sin escribir su resumen (estado ${r.status}${r.signal ? ', señal ' + r.signal : ''}).`));
    console.error('  Esto NO es un rojo: ningún guard ha dicho que algo esté mal. Tampoco es un verde: ninguno ha');
    console.error(`  dicho que esté bien. Había escrito ${verdesVistos(r.stdout || '')} resultado(s) en verde y ninguno caído.`);
    console.error('  Un runner que termina por su pie escribe SIEMPRE su resumen, caiga lo que caiga; uno al que');
    console.error('  cortan desde fuera, no (SCRUM-1386). Relánzalo; si se repite, mira qué lo mata.');
  } else {
    console.error(`\n⬜ CIEGO — no terminé; no sé nada de tus guards. Corté al runner al pasar el plazo de ${techo / 1000} s.`);
    console.error('  Esto NO es un rojo: ningún guard ha dicho que algo esté mal. Tampoco es un verde: ninguno ha');
    console.error('  dicho que esté bien. Cuánto tarda este comando lo decide la carga de la máquina, no la lista');
    console.error('  (mismo árbol: de 10 s a más de 90 según los núcleos libres, SCRUM-1345). Relánzalo cuando la');
    console.error('  máquina afloje. El presupuesto de tiempo de la lista se juzga en CI, no aquí.');
  }
  console.error(`  ${veredicto.linea}`);
  console.log(linea);
  process.exit(veredicto.codigo);
}

// SUELO Nº2: que además de correr, HAYAN CORRIDO. Un fichero que existe pero se quedó sin tests
// —o un runner que no encuentra nada— saldría con éxito y en silencio, y «0 tests, 0 fallos» es
// verde. Se lee el recuento que imprime el propio runner.
const ejecutados = recuentoDeTests(r.stdout || '');
if (ejecutados < MINIMO) {
  console.error(`\n🔴 solo se ejecutaron ${ejecutados} tests entre ${GUARDS.length} ficheros.`);
  console.error('  Los ficheros están, pero no han corrido: «0 tests, 0 fallos» también sale verde.');
  console.log(linea);
  process.exit(1);
}

if (r.status !== 0) {
  // SCRUM-1386 · un fichero cuyo proceso murió sin decir una letra no ha encontrado nada: se nombra
  // aparte. Si además hay un caído de verdad, manda el caído (lo decide `veredictoDe`, no este `if`).
  if (cuentas.callados.length > 0) {
    console.error(`\n⬜ ${cuentas.callados.length} guard(s) NO ACABARON DE MEDIR: su proceso murió sin dejar una letra de por qué.`);
    for (const f of cuentas.callados) console.error(`   · ${f}`);
    console.error('  Ningún test suyo ha caído: el que cae es el fichero entero, y callado. Es lo que deja un');
    console.error('  proceso al que matan desde fuera (SCRUM-1386). No es un rojo ni un verde. Relánzalo.');
  }
  if (cuentas.hallazgos > 0) {
    console.error('\n🔴 Algún guard de entrada está en rojo. Arréglalo ANTES de empujar: si entra así,');
    console.error('  el PR sale rojo y cuesta una vuelta entera.');
  }
  console.error(`  ${veredicto.linea}`);
  console.log(linea);
  process.exit(veredicto.codigo);
}
console.log(`\n✓ ${GUARDS.length} guards de entrada en verde (${ejecutados} tests, ${(ms / 1000).toFixed(1)} s de ${TECHO_MS / 1000}). La entrada puede empujarse.`);
console.log(linea);
}

// Solo corre cuando se le llama como comando. Importarlo —para probar el lector de arriba— no
// debe lanzar 23 s de guards ni, peor, matar a quien lo importa con un `process.exit(1)`.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
