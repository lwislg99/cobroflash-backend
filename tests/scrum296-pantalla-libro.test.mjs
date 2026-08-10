// tests/scrum296-pantalla-libro.test.mjs — SCRUM-296 (A6) · la pantalla del Libro de Registro.
//
// ⚠️ ESTA PANTALLA SE MIDE EJECUTÁNDOLA, NO LEYÉNDOLA.
//
// Lo que hay que comprobar aquí no es qué pone en el fuente, es qué SALE pintado en tres
// situaciones que se parecen mucho y significan cosas opuestas:
//
//   · la carga FALLA                    → aviso, y NI UNA fila. Nunca una tabla vacía.
//   · el servidor miró 40 y salieron 0  → aviso de descuadre. NO «no tienes facturas».
//   · el servidor miró 0                → «no tienes facturas», que aquí sí es la verdad.
//
// Las tres pintarían lo mismo —una pantalla sin filas— si nadie las separase, y la primera se
// leería como «no facturaste nada»: ante Hacienda eso no es un hueco, es una afirmación.
//
// Un `grep` sobre el fuente no puede distinguirlas, así que el fichero se EJECUTA sobre un DOM
// mínimo de mentira (sin dependencias nuevas, regla 36) y se mira el árbol resultante.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
// SCRUM-437 · acotar por estructura, nunca por una longitud.
import { ramaDeCase } from './_bloque-estructural.mjs';

const RAIZ = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const VISTA = path.join(RAIZ, 'public/dashboard/js/libroRegistroView.js');
const API = path.join(path.dirname(VISTA), 'api.js');

// ── El DOM de mentira: lo justo para que la vista corra y se pueda mirar lo que pinta ────────
function nodo(tag) {
  const n = {
    tagName: String(tag).toUpperCase(),
    className: '', id: '', type: '',
    style: { cssText: '', color: '' },
    dataset: {},
    hijos: [],
    _texto: '',
    appendChild(h) { n.hijos.push(h); return h; },
    addEventListener() {},
    set textContent(v) { n._texto = String(v); n.hijos = []; },
    get textContent() { return n._texto; },
    set innerHTML(v) { if (v === '') n.hijos = []; },
    get innerHTML() { return ''; },
  };
  return n;
}

/** Todos los nodos del árbol, en orden. */
function todos(n, out = []) {
  out.push(n);
  for (const h of n.hijos) todos(h, out);
  return out;
}
const textos = (n) => todos(n).map((x) => x.textContent).filter(Boolean);
const filas = (n) => todos(n).filter((x) => x.tagName === 'TR' && x.dataset.numero);
const tablas = (n) => todos(n).filter((x) => x.tagName === 'TABLE');

/**
 * Ejecuta la vista con una respuesta dada y devuelve el contenedor pintado.
 * `respuesta` puede ser un objeto (éxito) o un Error (la petición falla).
 */
async function pintar(respuesta) {
  const codigo = fs.readFileSync(VISTA, 'utf8');
  const contenedor = nodo('div');
  const ctx = {
    document: { createElement: nodo },
    window: {},
    apiRequest: async () => { if (respuesta instanceof Error) throw respuesta; return respuesta; },
    Intl, Date, Array, Number, String, Boolean, Object, JSON, isNaN, console,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  // SCRUM-436 · el banco carga ANTES `api.js`, como hace el navegador (`index.html:215` va
  // antes que `:257`). La vista formatea con `fmtMoneyEsOAusente`, que vive ahí: sin cargarlo,
  // este banco simulaba un navegador al que le falta un <script>, y su rojo no era del producto.
  vm.runInContext(fs.readFileSync(API, 'utf8'), ctx, { filename: 'api.js' });
  // ⚠️ `api.js` define su PROPIO `apiRequest` —el de red— y pisa el doble de arriba, que es quien
  // le da a este banco su respuesta. Se vuelve a poner DESPUÉS: si no, el test dejaría de controlar
  // los datos que pinta la pantalla y sus rojos serían de la red, no del producto.
  ctx.apiRequest = async () => { if (respuesta instanceof Error) throw respuesta; return respuesta; };
  vm.runInContext(codigo, ctx, { filename: 'libroRegistroView.js' });

  assert.equal(typeof ctx.window.renderLibroRegistroView, 'function',
    '🔴 la vista no ha publicado `renderLibroRegistroView`: el test no está midiendo la pantalla.');
  ctx.window.renderLibroRegistroView(contenedor);
  // La carga es asíncrona: se cede el turno hasta que el árbol deja de cambiar.
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
  return { contenedor, COPY: ctx.window.LIBRO_COPY };
}

const asiento = (o = {}) => ({
  numero: '2026-CF-001', fecha: '2026-03-04T10:00:00.000Z', tipo: 'F1', clienteId: 3,
  base: 100, cuota: 21, total: 121, moneda: 'EUR', estado: 'paid', importeIlegible: false,
  enlaces: { presupuestoId: 11, presupuestoFirmado: true, albaranes: [{ albaranId: 33, numero: 'ALB-2026-007' }], albaranesNoSellados: 0, cobroId: 22 },
  ...o,
});
const libro = (o = {}) => ({ asientos: [asiento()], miradas: 1, ajenas: 0, sinNumero: 0, importesIlegibles: [], ...o });

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-296 · SUELO: con datos buenos la pantalla PINTA el libro', async () => {
  // Sin esto, los tres tests de abajo («no pinta tabla») pasarían aunque la vista no pintara nunca.
  const { contenedor } = await pintar(libro({ asientos: [asiento(), asiento({ numero: '2026-CF-002' })], miradas: 2 }));
  assert.equal(tablas(contenedor).length, 1, '🔴 la pantalla no pinta ninguna tabla con datos correctos.');
  assert.equal(filas(contenedor).length, 2, '🔴 la pantalla no pinta los dos asientos.');
});

// ── LAS TRES SITUACIONES QUE NO SE PUEDEN CONFUNDIR ──────────────────────────────────────────

test('SCRUM-296 · si la carga FALLA no se pinta ni una fila — un fallo no puede parecer un libro vacío', async () => {
  const { contenedor, COPY } = await pintar(new Error('boom'));
  assert.equal(tablas(contenedor).length, 0,
    '🔴 la pantalla ha pintado una tabla con la carga rota. Una tabla vacía se lee como «no ' +
    'facturaste nada», y ante Hacienda eso es una afirmación, no un hueco.');
  assert.ok(textos(contenedor).includes(COPY.error), '🔴 no sale el aviso de error.');
  assert.ok(!textos(contenedor).includes(COPY.vacioDeVerdad),
    '🔴 con la carga rota la pantalla dice «no has emitido ninguna factura». Eso es AFIRMAR algo ' +
    'que no se sabe.');
});

test('SCRUM-296 · miró facturas y no salió ningún asiento → DESCUADRE, no «no tienes»', async () => {
  const { contenedor, COPY } = await pintar(libro({ asientos: [], miradas: 40 }));
  const t = textos(contenedor);
  assert.ok(t.includes(COPY.descuadre(40)),
    '🔴 con 40 facturas miradas y 0 asientos la pantalla no avisa del descuadre. Ese es el caso ' +
    'en el que el libro está ROTO, y es el único que no puede leerse como tranquilizador.');
  assert.ok(!t.includes(COPY.vacioDeVerdad),
    '🔴 la pantalla dice «no has emitido ninguna factura» habiendo mirado 40. Es la confusión que ' +
    'este ticket existe para impedir.');
});

test('SCRUM-296 · miró CERO → ahí sí, «todavía no has emitido ninguna»', async () => {
  // El hermano positivo: sin él, «nunca digas que está vacío» daría verde tapando el vacío real.
  const { contenedor, COPY } = await pintar(libro({ asientos: [], miradas: 0 }));
  const t = textos(contenedor);
  assert.ok(t.includes(COPY.vacioDeVerdad), '🔴 con cero facturas miradas la pantalla no lo dice.');
  assert.ok(!t.includes(COPY.descuadre(0)), '🔴 un libro legítimamente vacío se presenta como roto.');
});

test('SCRUM-296 · una respuesta SIN `miradas` es un fallo, no un cero', async () => {
  // `miradas` es lo único que distingue «no había» de «no supe leer». Si no viene, la pantalla no
  // puede saber cuál de las dos cosas está pasando — y entonces no afirma ninguna.
  const { contenedor } = await pintar({ asientos: [] });
  assert.equal(tablas(contenedor).length, 0);
  const t = textos(contenedor);
  assert.ok(!t.some((x) => /no has emitido/i.test(x)),
    '🔴 sin `miradas` la pantalla afirma que no has facturado.');
});

// ── LOS IMPORTES ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-296 · un importe ILEGIBLE se pinta «—», nunca 0,00 €', async () => {
  const { contenedor, COPY } = await pintar(libro({
    asientos: [asiento({ total: null, importeIlegible: true })],
    importesIlegibles: ['2026-CF-001'],
  }));
  const t = textos(contenedor);
  assert.ok(!t.some((x) => /^0,00/.test(x)),
    '🔴 un importe que no se pudo leer se ha pintado como 0,00 €: eso AFIRMA que esa factura no ' +
    'cobró nada, y es peor que no tener la fila.');
  assert.ok(t.includes(COPY.avisoIlegibles(['2026-CF-001'])),
    '🔴 el importe ilegible no se avisa con su número de factura delante.');
});

test('SCRUM-296 · un CERO legítimo sí se pinta como 0,00 €', async () => {
  const { contenedor } = await pintar(libro({ asientos: [asiento({ total: 0, importeIlegible: false })] }));
  assert.ok(textos(contenedor).some((x) => /0,00/.test(x)),
    '🔴 un cero de verdad se está ocultando: «no se sabe» y «cero» no son lo mismo en ninguna de ' +
    'las dos direcciones.');
});

// ── LA TRAZABILIDAD, QUE ES LO QUE HACE ESTE LIBRO NUESTRO ────────────────────────────────────

test('SCRUM-296 · cada asiento enseña presupuesto firmado, albarán y cobro', async () => {
  const { contenedor, COPY } = await pintar(libro());
  const t = textos(contenedor);
  assert.ok(t.includes(COPY.trazaPresupuestoFirmado), '🔴 no se ve el presupuesto firmado.');
  assert.ok(t.some((x) => x.startsWith(COPY.trazaAlbaran)), '🔴 no se ve el albarán.');
  assert.ok(t.includes(COPY.trazaCobro), '🔴 no se ve el cobro.');
});

test('SCRUM-296 · «firmado» y «sin firmar» NO se pintan igual', async () => {
  const { contenedor, COPY } = await pintar(libro({
    asientos: [asiento({ enlaces: { presupuestoId: 11, presupuestoFirmado: false, albaranes: [], albaranesNoSellados: 0, cobroId: null } })],
  }));
  const t = textos(contenedor);
  assert.ok(t.includes(COPY.trazaPresupuestoSinFirmar),
    '🔴 un presupuesto sin firma se presenta como firmado. La firma es la prueba el día que el ' +
    'cliente diga que no lo pidió; el botón de aceptar no lo es.');
  assert.ok(!t.includes(COPY.trazaPresupuestoFirmado));
});

test('SCRUM-296 · la factura SUELTA se ve como suelta, no como una fila a la que le falta algo', async () => {
  const { contenedor, COPY } = await pintar(libro({
    asientos: [asiento({ enlaces: { presupuestoId: null, presupuestoFirmado: null, albaranes: [], albaranesNoSellados: 0, cobroId: null } })],
  }));
  assert.ok(textos(contenedor).includes(COPY.sinTrazas),
    '🔴 la factura suelta (SCRUM-289) sale con la celda en blanco, que se lee como «falta un dato».');
});

// ── QUE LOS AVISOS SE VEAN, QUE NO ES LO MISMO QUE EXISTIR ───────────────────────────────────

test('SCRUM-296 · todo aviso lleva un tono que el CSS conoce (si no, es INVISIBLE)', async () => {
  // `styles.css` oculta con `display:none` toda `.alert` que no lleve un modificador conocido.
  // Un tono inventado no se ve raro: NO SE VE — y aquí el aviso que desaparece es el que dice
  // «este importe no es cero, es que no se pudo leer».
  //
  // ⚠️ LOS TONOS VÁLIDOS SE DERIVAN DEL CSS, no se escriben aquí: una lista a mano se queda
  // desfasada el día que el CSS cambie, y este guard daría verde sobre avisos invisibles.
  const css = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');
  const validos = new Set();
  for (const m of css.matchAll(/\.alert\.([a-z-]+)/g)) validos.add(m[1]);
  assert.ok(validos.size >= 3,
    `🔴 solo se han derivado ${validos.size} tonos del CSS: el extractor no está mirando bien y ` +
    'este guard no comprobaría nada.');

  const invisibles = [];
  for (const respuesta of [
    libro({ importesIlegibles: ['2026-CF-001'] }),
    libro({ ajenas: 2 }),
    libro({ sinNumero: 1 }),
    libro({ asientos: [], miradas: 40 }),
    new Error('boom'),
  ]) {
    const { contenedor } = await pintar(respuesta);
    for (const n of todos(contenedor)) {
      const clases = String(n.className || '').split(/\s+/);
      if (!clases.includes('alert')) continue;
      if (!clases.some((c) => c !== 'alert' && validos.has(c))) invisibles.push(n.className);
    }
  }

  assert.deepEqual(invisibles, [],
    `🔴 estos avisos se pintan con un tono que el CSS no conoce y quedan OCULTOS: ` +
    `${invisibles.join(', ')}.\n\n  Tonos válidos (derivados de styles.css): ${[...validos].join(', ')}.`);
});

// ── MICROCOPY (regla 30) ─────────────────────────────────────────────────────────────────────

test('SCRUM-296 · SUELO del guard de microcopy: hay ranuras que revisar', async () => {
  const { COPY } = await pintar(libro());
  assert.ok(Object.keys(COPY).length >= 10,
    `🔴 solo hay ${Object.keys(COPY).length} ranuras de copy: el guard de abajo no estaría ` +
    'comprobando nada.');
});

test('SCRUM-296 · TODA la copy de esta pantalla va marcada como PENDIENTE (regla 30)', async () => {
  const { COPY } = await pintar(libro());
  const MARCADOR = '[PENDIENTE microcopy oficial]';
  // `cargando` queda fuera y se declara: es la cadena que ya usan otras pantallas, copiada tal
  // cual. Someterla aquí la convertiría en texto oficial de pantallas que este ticket no toca.
  const DECLARADAS_FUERA = ['cargando'];

  const sinMarcar = [];
  for (const [ranura, v] of Object.entries(COPY)) {
    if (DECLARADAS_FUERA.includes(ranura)) continue;
    // `[1]` y no `1`: las ranuras con parámetro reciben unas un número y otras una lista, y un
    // array vale para las dos (`.join` funciona, y concatenado da «1»). Con `1` a secas el guard
    // reventaba en `avisoIlegibles` — y un guard que revienta no es un guard rojo, es uno ciego.
    const texto = typeof v === 'function' ? v([1]) : v;
    if (!String(texto).startsWith(MARCADOR)) sinMarcar.push(`${ranura}: ${JSON.stringify(texto)}`);
  }

  assert.deepEqual(sinMarcar, [],
    `🔴 estas ranuras llevan texto que NADIE ha aprobado y no lo dicen:\n   ${sinMarcar.join('\n   ')}\n\n` +
    '  El microcopy lo aprueba el fundador (regla 30). Un rótulo que «suena bien» es exactamente\n' +
    '  lo que el marcador existe para impedir que se cuele como si estuviera decidido.\n' +
    '  Y va DELANTE del texto, no en vez de él: con el marcador solo, «no tienes facturas» y «el\n' +
    '  libro no cuadra» dirían lo mismo, que son los dos mensajes que esta pantalla NO puede\n' +
    '  confundir.');
});

test('SCRUM-296 · el título de la vista sale de LIBRO_COPY, y el rótulo del MENÚ es el aprobado', () => {
  // ── SCRUM-420 · POR QUÉ ESTE TEST CAMBIÓ, y no es que se haya relajado ─────────────────────
  //
  // Hasta el 10-ago-2026 exigía que la entrada del menú llevase el MARCADOR, y tenía razón: nadie
  // había aprobado ese rótulo, y el sitio más visible de la pantalla habría sido el único texto
  // presentándose como decidido.
  //
  // El asesor lo aprobó al reordenar la barra (SCRUM-420) y aprobó **exactamente esto**: «Libro de
  // registro» como RÓTULO DE NAVEGACIÓN, **no como copy de VeriFactu**. Todo lo que se pinta DENTRO
  // de la pantalla sigue bajo la regla 26 y sale del guion H2 — y eso lo sigue vigilando el test de
  // arriba, que exige marcador en todas las ranuras de `LIBRO_COPY`.
  //
  // Mantener la exigencia del marcador habría sido **fijar el estado anterior como requisito**: un
  // test que cae el día que alguien hace el trabajo BIEN (aquí, conseguir la aprobación). Es la
  // misma corrección que SCRUM-388 se hizo a sí mismo con el banco de A9.
  const app = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/app.js'), 'utf8');
  // SCRUM-437 · la RAMA del `case`, no 500 caracteres. Hoy mide 412 y `LIBRO_COPY` está en el 236:
  // con 88 caracteres más en esa rama, el guard habría dejado de verlo sin ponerse rojo.
  const caso = ramaDeCase(app, "case 'libro-registro':");
  assert.ok(caso,
    "🔴 ESCÁNER CIEGO: no se localiza la rama `case 'libro-registro':` en app.js. No se puede "
    + 'afirmar si el título sale de `LIBRO_COPY` o está escrito a mano.');
  assert.ok(caso.includes('LIBRO_COPY'),
    '🔴 el título de la vista está escrito a mano en app.js en vez de salir de `LIBRO_COPY`.');

  const html = fs.readFileSync(path.join(RAIZ, 'public/dashboard/index.html'), 'utf8');
  assert.ok(/id="nav-libro-registro-label">Libro de registro</.test(html),
    '🔴 el rótulo de navegación aprobado es EXACTAMENTE «Libro de registro». Ni con marcador ' +
    '(ya está decidido) ni con otra redacción (cambiarlo es microcopy nueva, regla 30).');

  // Y la propiedad que de verdad protege la pantalla sigue en pie: lo de DENTRO no está aprobado.
  // Se comprueba en la FUENTE de la vista, no en el DOM, para que este test no dependa del banco.
  const vista = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/libroRegistroView.js'), 'utf8');
  assert.match(vista, /titulo:\s*rotulo\(/,
    '🔴 el título DE LA PANTALLA ha dejado de pasar por `rotulo()`, que es quien le pone el ' +
    'marcador. Lo que se aprobó el 10-ago es el rótulo de NAVEGACIÓN; el contenido del libro es ' +
    'copy de VeriFactu y va por el guion H2 (regla 26).');
});
