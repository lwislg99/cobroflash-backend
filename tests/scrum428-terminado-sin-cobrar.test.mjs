// tests/scrum428-terminado-sin-cobrar.test.mjs — SCRUM-428
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE MIDIÓ EL PASO 0, Y POR QUÉ ESTE TICKET ES SUPERFICIE Y NO MOTOR
//
// Los dos ejes existen y VIAJAN YA en cada fila de `GET /admin/jobs`:
//   · `status`            → `'terminado'`   (`src/modules/jobs/domain/job.service.ts:9`)
//   · `estadoCobro`       → `estadoCobroFor` (`job.service.ts:333`), serializado en
//                            `jobs.routes.ts:263`, con `totalCobrado` e `importeReferencia`
//
// Lo que NO existía es el CRUCE: en `src/` el literal `'terminado'` aparece 5 veces y ninguna es
// una consulta. Así que aquí no se calcula dinero nuevo — se cruza lo que el servidor ya manda.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CONTROL QUE DECIDE: «no se sabe» NUNCA se suma como 0
//
// Un terminado sin eje de cobro (`estadoCobro === null`) no es un terminado de 0 €: es uno del
// que no se sabe cuánto falta. Contarlo como 0 diría que no debe nada; tomar su `totalCobrado`
// como referencia diría que está pagado. Las dos mienten y en direcciones opuestas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(import.meta.url);
const { esTerminadoSinCobrar, faltaPorCobrarDe, resumenTerminadoSinCobrar, ESTADOS_CON_DEUDA } =
  require_(path.join(RAIZ, 'public/dashboard/js/terminadoSinCobrar.js'));

const leer = (rel) => {
  const p = path.join(RAIZ, rel);
  assert.ok(fs.existsSync(p), `🔴 no existe ${rel}: el guard no puede mirar, y FALLA.`);
  return fs.readFileSync(p, 'utf8');
};

/** Un Trabajo como lo serializa `jobs.routes.ts:263-275`, no como me convenga inventarlo. */
const job = (o) => ({ id: 1, status: 'terminado', estadoCobro: 'Pendiente', totalCobrado: 0, importeReferencia: 1000, ...o });

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-428 · SUELO: los dos ejes que se cruzan siguen existiendo donde se midieron', () => {
  // Si el servidor deja de mandar uno de los dos, el cruce se queda callado y esta pantalla
  // volvería a no decir nada — sin que ningún test de aquí abajo se enterase.
  const rutas = leer('src/modules/jobs/app/routes/jobs.routes.ts');
  for (const campo of ['estadoCobro:', 'importeReferencia:', 'totalCobrado:']) {
    assert.ok(rutas.includes(campo),
      `🔴 «${campo}» ya no se serializa en jobs.routes.ts. El cruce de SCRUM-428 se calcula en el ` +
      'navegador con lo que manda esta ruta: sin ese campo, el importe sale mudo o mentiroso.');
  }
  const estados = leer('src/modules/jobs/domain/job.service.ts');
  assert.match(estados, /'terminado'/,
    '🔴 el estado «terminado» ya no está en JOB_STATES: el cruce apunta a un estado que no existe.');
});

test('SCRUM-428 · SUELO: la vista carga el módulo y lo usa', () => {
  const html = leer('public/dashboard/index.html');
  // 🔒 SE BUSCA LA ETIQUETA, NO EL NOMBRE SUELTO. Preguntaba por `indexOf('jobsView.js')` sobre el
  // HTML entero, y eso casa también con un COMENTARIO que mencione el fichero: SCRUM-823 añadió
  // uno explicando qué se carga antes que él, y este test se puso rojo diciendo que el orden
  // estaba mal cuando el orden no había cambiado. La pregunta es de ORDEN DE CARGA, así que el
  // ancla tiene que ser lo que carga — el `<script src=`, no una mención.
  const posicionDe = (fichero) => html.indexOf(`<script src="./js/${fichero}"`);
  const iTerm = posicionDe('terminadoSinCobrar.js');
  const iJobs = posicionDe('jobsView.js');
  assert.ok(iTerm !== -1, '🔴 `terminadoSinCobrar.js` no está cargado en el dashboard: el cruce no llega al navegador.');
  assert.ok(iTerm < iJobs,
    '🔴 `terminadoSinCobrar.js` se carga DESPUÉS de `jobsView.js`. Con scripts clásicos eso deja ' +
    '`resumenTerminadoSinCobrar` sin definir cuando la vista se pinta, y el importe desaparece ' +
    'sin un solo error visible.');
  // SCRUM-1725g · AQUÍ SE EXIGÍA `resumenTerminadoSinCobrar(` (el subtotal de la cabecera «Terminados»).
  // El requisito cambió: veredicto del fundador (SCRUM-1725 c.22073) + P4 firmada (c.22076) → la lista
  // es plana, la cabecera desaparece y lo que falta por cobrar queda en la tarjeta «Por cobrar» y fila a
  // fila. Cambio de exigencia AUTORIZADO con nombre en SCRUM-1725 c.22077. Lo que queda de la intención
  // («el motor existe Y se ve»): la lista sigue sumando con `faltaPorCobrarDe`, la resta de este módulo.
  // Sobre el código SIN comentarios: la prosa que explica la retirada nombra lo retirado.
  assert.match(soloEjecutable(leer('public/dashboard/js/jobsView.js')), /faltaPorCobrarDe\(/,
    '🔴 la lista de Trabajos ya no llama a `faltaPorCobrarDe`: el motor existiría y no se vería, que es ' +
    'exactamente el estado del que sale este ticket.');
});

// ── EL CRUCE ─────────────────────────────────────────────────────────────────────────────────

test('SCRUM-428 · terminado + con deuda = sí; el resto = no', () => {
  assert.equal(esTerminadoSinCobrar(job({ estadoCobro: 'Pendiente' })), true);
  assert.equal(esTerminadoSinCobrar(job({ estadoCobro: 'Parcial' })), true,
    '🔴 un Trabajo cobrado A MEDIAS tiene dinero pendiente igual que uno sin cobrar nada, y son ' +
    'los que más se olvidan: dejarlos fuera esconde justo el caso peor.');
  assert.equal(esTerminadoSinCobrar(job({ estadoCobro: 'Pagado' })), false);
  assert.equal(esTerminadoSinCobrar(job({ estadoCobro: null })), false,
    '🔴 sin eje de cobro NO se afirma que deba dinero: no se sabe.');
  for (const otro of ['en_curso', 'agendado', 'pendiente_agendar', 'cerrado']) {
    assert.equal(esTerminadoSinCobrar(job({ status: otro })), false, `🔴 «${otro}» no es «terminado».`);
  }
  assert.deepEqual(ESTADOS_CON_DEUDA, ['Pendiente', 'Parcial']);
});

test('SCRUM-428 · lo que falta se RESTA, y sin referencia vale null (no 0)', () => {
  assert.equal(faltaPorCobrarDe(job({ importeReferencia: 1000, totalCobrado: 400 })), 600);
  assert.equal(faltaPorCobrarDe(job({ importeReferencia: 1000, totalCobrado: 0 })), 1000);
  assert.equal(faltaPorCobrarDe(job({ importeReferencia: 1000, totalCobrado: 1500 })), 0,
    '🔴 un cobro por encima de la referencia no puede dar negativo: restaría de la suma de los demás.');
  assert.equal(faltaPorCobrarDe(job({ importeReferencia: null })), null,
    '🔴 sin referencia devuelve 0 en vez de null. 0 € es una AFIRMACIÓN sobre el dinero de alguien.');
});

test('SCRUM-428 · 🔴 EL CONTROL: «no se sabe» se cuenta aparte y NO entra en el importe', () => {
  const lista = [
    job({ id: 1, estadoCobro: 'Pendiente', importeReferencia: 1000, totalCobrado: 0 }),    // falta 1000
    job({ id: 2, estadoCobro: 'Parcial', importeReferencia: 500, totalCobrado: 200 }),      // falta 300
    job({ id: 3, estadoCobro: 'Pagado', importeReferencia: 800, totalCobrado: 800 }),       // fuera
    job({ id: 4, estadoCobro: null, importeReferencia: null, totalCobrado: 0 }),            // NO SE SABE
    job({ id: 5, status: 'en_curso', estadoCobro: 'Pendiente' }),                           // fuera
  ];
  const r = resumenTerminadoSinCobrar(lista);

  assert.equal(r.cuantos, 2, '🔴 el recuento no son los dos terminados con deuda conocida.');
  assert.equal(r.importe, 1300,
    `🔴 el importe sale ${r.importe} y son 1300. Si sale 1300 pero «sinImporte» es 0, el Trabajo ` +
    'del que no se sabe nada se ha colado como 0 € — y eso INFLA la sensación de estar al día.');
  assert.equal(r.sinImporte, 1,
    '🔴 el Trabajo sin eje de cobro no se está contando aparte. Excluirlo en silencio es el sesgo ' +
    'que este control existe para impedir: la cifra se leería como si lo contara todo.');
});

/**
 * El texto aprobado por el fundador (10-ago-2026), LITERAL y con su `{N}` sustituido.
 * Consta en: SCRUM-1502 comentario 20702.
 *
 * Vive aquí como constante para que el guard compare contra el texto oficial y no contra una
 * paráfrasis: «no se sabe cuánto falta» y «pendiente de calcular» dicen cosas distintas, y sólo
 * una está aprobada (regla 30).
 */
const SALVEDAD_APROBADA = 'sin importe de referencia: no se sabe cuánto falta y no entran en el total.';

test('SCRUM-428 · 🔴 la cifra y su SALVEDAD viajan juntas, o ninguna de las dos es verdad', () => {
  // Hasta que hubo texto aprobado, la cabecera se callaba el importe: la suma de los demás es
  // correcta y se lee como el total. Con la frase puesta la decisión se invierte por su propio
  // motivo — callarse el importe pasa a ser contar MENOS de lo que se sabe.
  //
  // Lo que este guard fija NO es cuál de las dos versiones está pintada, sino que **las dos
  // piezas van juntas**: enseñar la cifra sin la salvedad vuelve a inducir a error, y romper el
  // texto oficial la deja diciendo otra cosa.
  //
  // SCRUM-1725g · LA CIFRA Y LA SALVEDAD SE MUDARON, JUNTAS. Vivían en la cabecera «Terminados», que la
  // lista plana ya no tiene (veredicto del fundador, SCRUM-1725 c.22073; P4 firmada, c.22076). La cifra
  // que queda es la de la tarjeta «Por cobrar», y su salvedad es la corta que esa tarjeta ya llevaba,
  // firmada en SCRUM-917 c.15881: «N sin importe de referencia, no entra(n)». La frase larga
  // (`SALVEDAD_APROBADA`, arriba) deja de exigirse: es la pérdida declarada en P4. Cambio de exigencia
  // AUTORIZADO con nombre en SCRUM-1725 c.22078. La intención es la misma: las dos piezas van juntas.
  const vista = soloEjecutable(leer('public/dashboard/js/jobsView.js'));

  assert.match(vista, /if\s*\(\s*porCobrar\.conFalta\s*\)/,
    '🔴 el pie de «Por cobrar» dice «en N trabajos sin cerrar» siempre: con cero trabajos con deuda ' +
    'afirmaría algo de un importe que no se debe.');

  assert.match(vista, /if\s*\(\s*porCobrar\.sinImporte\s*\)/,
    '🔴 la tarjeta «Por cobrar» ya no dice nada cuando hay trabajos sin importe conocido. Si desaparece ' +
    'la salvedad, el importe de arriba vuelve a leerse como si lo contara todo — y entonces ese ' +
    'importe tampoco se puede enseñar.');

  assert.ok(vista.includes('${porCobrar.sinImporte} sin importe de referencia, '),
    '🔴 no aparece el texto APROBADO de la salvedad de la tarjeta, literal:\n' +
    '      «{N} sin importe de referencia, no entra(n)»\n\n' +
    '  Es microcopy firmada (SCRUM-917, comentario 15881): no se reescribe ni se «mejora». Una ' +
    'paráfrasis afirma algo que nadie ha aprobado sobre el dinero de un profesional.');

  assert.doesNotMatch(vista, /\[PENDIENTE microcopy oficial\]/,
    '🔴 ha vuelto un marcador a esta vista: el texto ya está aprobado y pintarlo como pendiente ' +
    'sería enseñar un hueco donde hay una frase.');
});

test('SCRUM-428 · 🔴 el nombre del helper no puede chocar con otro script del dashboard', () => {
  // Los <script> clásicos comparten el nivel superior: dos declaraciones del mismo nombre son
  // SyntaxError EN PARSEO y el segundo fichero no se ejecuta entero — la pantalla desaparece sin
  // un 500 ni una línea de log. `num` ya existe en jobCobroHuecos.js:25 y me mordió aquí.
  const mio = leer('public/dashboard/js/terminadoSinCobrar.js');
  // ⚠️ El `\b` de la primera versión de esta regex entró en el fichero como el CARÁCTER de
  // retroceso (0x08), no como el metacarácter: `/…num\b/` no puede casar con nada y este guard
  // habría pasado SIEMPRE. Lo descubrí al inyectar el rojo — un guard que nunca falla no es un
  // guard, y sólo se distingue de uno bueno probándolo en rojo.
  assert.doesNotMatch(mio, /^(function|const|let|var)[ 	]+num[^A-Za-z0-9_]/m,
    '🔴 este fichero vuelve a declarar `num` en el nivel superior, que ya es global de ' +
    '`jobCobroHuecos.js`. Con scripts clásicos eso rompe el fichero entero en parseo.');
});

test('SCRUM-428 · el importe se calcula sobre lo que se VE, no sobre la lista entera', () => {
  // El filtro de cobro (`jobsView.js`) es client-side: si el importe se sumara sobre `jobs` y no
  // sobre el grupo pintado, con el chip «Pagado» activo la cabecera diría un total que no cuadra
  // con ninguna fila de debajo.
  //
  // SCRUM-1725g · exigía `resumenTerminadoSinCobrar(g.items)`: el subtotal de la cabecera, sobre el grupo
  // pintado. Sin cabecera (c.22073, c.22076) no hay subtotal que pueda descuadrar. Cambio de exigencia
  // AUTORIZADO con nombre en SCRUM-1725 c.22077. Lo que queda de la intención —el importe que se enseña
  // junto a una fila es el de ESA fila— es el botón del terminado con saldo: «💰 Cobrar el resto», con
  // lo que le falta a ese Trabajo y no con una suma de otros.
  // (La tarjeta «Por cobrar» suma TODOS los sin cerrar, no lo filtrado: decisión de SCRUM-917c, que
  // este ticket no toca; por eso aquí no se le exige «lo que se ve».)
  const vista = soloEjecutable(leer('public/dashboard/js/jobsView.js'));
  assert.ok(vista.includes('`💰 Cobrar el resto (${fmtMoneyEs(j.remaining.amount, j.remaining.currency)})`'),
    '🔴 el botón del terminado con saldo ya no dice lo que falta de SU fila (`j.remaining`). Un importe ' +
    'que no cuadra con la fila en la que está no se cree: se ignora, y entonces da igual haberlo puesto.');
});

test('SCRUM-428 · nada de esto revienta con datos ausentes', () => {
  // La lista viene de la red: un campo que falta no puede tumbar la pantalla entera.
  assert.deepEqual(resumenTerminadoSinCobrar(undefined), { cuantos: 0, importe: 0, sinImporte: 0 });
  assert.deepEqual(resumenTerminadoSinCobrar([null, undefined, {}]), { cuantos: 0, importe: 0, sinImporte: 0 });
  assert.equal(esTerminadoSinCobrar(null), false);
  assert.equal(faltaPorCobrarDe({}), null);
  // Y un importe ilegible NO se convierte en 0: se cuenta como desconocido.
  const r = resumenTerminadoSinCobrar([job({ importeReferencia: 'no-es-un-numero' })]);
  assert.deepEqual(r, { cuantos: 0, importe: 0, sinImporte: 1 },
    '🔴 un importe ilegible se ha tratado como 0. «Ilegible» y «cero» no son el mismo número.');
});
