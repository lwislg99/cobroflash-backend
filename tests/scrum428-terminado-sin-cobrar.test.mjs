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
  const iTerm = html.indexOf('terminadoSinCobrar.js');
  const iJobs = html.indexOf('jobsView.js');
  assert.ok(iTerm !== -1, '🔴 `terminadoSinCobrar.js` no está cargado en el dashboard: el cruce no llega al navegador.');
  assert.ok(iTerm < iJobs,
    '🔴 `terminadoSinCobrar.js` se carga DESPUÉS de `jobsView.js`. Con scripts clásicos eso deja ' +
    '`resumenTerminadoSinCobrar` sin definir cuando la vista se pinta, y el importe desaparece ' +
    'sin un solo error visible.');
  assert.match(leer('public/dashboard/js/jobsView.js'), /resumenTerminadoSinCobrar\(/,
    '🔴 la lista de Trabajos ya no llama al resumen: el motor existiría y no se vería, que es ' +
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

test('SCRUM-428 · 🔴 el importe se CALLA si no se puede decir entero', () => {
  // Con terminados de los que no se sabe cuánto falta, la suma de los demás es correcta y SE LEE
  // MAL: quien la ve la lee como el total. Enseñarla sin la frase que explica qué queda fuera es
  // exactamente el sesgo silencioso que este ticket existe para no cometer.
  const vista = leer('public/dashboard/js/jobsView.js');
  assert.match(vista, /resumen\.sinImporte\s*===\s*0/,
    '🔴 la vista pinta el importe aunque haya terminados sin importe conocido. «1.300 €» y ' +
    '«1.300 €, con 2 trabajos fuera de la cuenta» son dos afirmaciones distintas, y sin la segunda ' +
    'frase —que necesita aprobación (regla 30)— la primera induce a error.');
  assert.match(vista, /resumen\.cuantos\s*>\s*0/,
    '🔴 el importe se pinta siempre: con cero terminados con deuda, «0,00 €» afirma que no se debe ' +
    'nada, y eso solo es verdad si además se sabe de todos.');
});

test('SCRUM-428 · 🔴 el nombre del helper no puede chocar con otro script del dashboard', () => {
  // Los <script> clásicos comparten el nivel superior: dos declaraciones del mismo nombre son
  // SyntaxError EN PARSEO y el segundo fichero no se ejecuta entero — la pantalla desaparece sin
  // un 500 ni una línea de log. `num` ya existe en jobCobroHuecos.js:25 y me mordió aquí.
  const mio = leer('public/dashboard/js/terminadoSinCobrar.js');
  // ⚠️ El `` de la primera versión de esta regex entró en el fichero como el CARÁCTER de
  // retroceso (0x08), no como el metacarácter: `/…num/` no puede casar con nada y este guard
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
  const vista = leer('public/dashboard/js/jobsView.js');
  assert.match(vista, /resumenTerminadoSinCobrar\(g\.items\)/,
    '🔴 el resumen no se calcula sobre `g.items` (lo pintado). Un importe que no cuadra con las ' +
    'filas de debajo no se cree: se ignora, y entonces da igual haberlo puesto.');
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
