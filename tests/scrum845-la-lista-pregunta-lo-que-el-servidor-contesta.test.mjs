// tests/scrum845-la-lista-pregunta-lo-que-el-servidor-contesta.test.mjs — SCRUM-845
//
// LA LISTA DE FACTURAS NO OFRECE LO QUE EL LOTE VA A RECHAZAR.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE CIERRA, Y LO QUE **NO** ERA
//
// ✅ NO había daño de datos: `POST /admin/invoices/bulk-paid` ya filtraba por
// `NO_SE_MARCAN_PAGADAS_EN_LOTE` desde SCRUM-496. Ninguna anulada volvía a salir cobrada.
//
// 🔴 Lo que sí pasaba: la casilla se creaba en TODAS las filas sin mirar el estado. Con
// «Seleccionar todas» —el camino por defecto— entraban las anuladas y las ya pagadas, el servidor
// las descartaba en silencio, y la pantalla remataba pintando «✓ 3 facturas marcadas como
// pagadas» EN VERDE después de haber seleccionado 5. Sin decir cuáles no, ni por qué.
//
// La escritura siempre estuvo bien. La que mentía era la pantalla.
//
// ── LA PARTE QUE NO CADUCA ───────────────────────────────────────────────────────────────────
//
// El panel es vanilla sin bundler (regla 4) y no puede importar el TypeScript del servidor, así
// que `invoiceAccion.js` lleva un ESPEJO de `NO_SE_MARCAN_PAGADAS_EN_LOTE`. Un espejo sin
// mecanismo es una copia que diverge el día que alguien toque el original — y divergiría en
// silencio, porque las dos mitades seguirían funcionando por separado.
//
// Este fichero ES el mecanismo: importa la constante del SERVIDOR desde `dist/` y exige que sean
// el mismo CONJUNTO. Compara conjuntos y no cuentas: un número igual deja pasar «he perdido una y
// he ganado otra».
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PANEL = require(path.join(RAIZ, 'public/dashboard/js/invoiceAccion.js'));
const SERVIDOR = require(path.join(RAIZ, 'dist/modules/system/invoiceAdmin.js'));

const LISTA = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/invoicesView.js'), 'utf8');
const DETALLE = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/invoiceDetailView.js'), 'utf8');
const INDEX = fs.readFileSync(path.join(RAIZ, 'public/dashboard/index.html'), 'utf8');

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① EL SUELO: las dos piezas existen y contestan
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-845 · 🔴 SUELO: las dos fuentes se pueden leer y NO están vacías', () => {
  // Un conjunto vacío haría pasar la comparación de abajo por tautología: `[] vs []` es «idéntico»
  // y no prueba nada. Es el control positivo sobre el vacío que exige A3.
  assert.ok(Array.isArray(SERVIDOR.NO_SE_MARCAN_PAGADAS_EN_LOTE)
    && SERVIDOR.NO_SE_MARCAN_PAGADAS_EN_LOTE.length > 0,
    '🔴 no encuentro `NO_SE_MARCAN_PAGADAS_EN_LOTE` en `dist/`. Sin ella, la comparación de abajo\n'
    + '  sería «vacío contra vacío» y daría verde diciendo nada.');
  assert.ok(PANEL.FACTURA_NO_SE_MARCA_PAGADA_EN_LOTE.length > 0,
    '🔴 el espejo del panel está vacío: entonces la lista ofrecería la casilla en TODAS las filas,\n'
    + '  que es exactamente el defecto de este ticket.');
  assert.equal(typeof PANEL.sePuedeMarcarPagadaEnLote, 'function');
  assert.equal(typeof SERVIDOR.puedeMarcarsePagadaEnLote, 'function');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② EL ESPEJO NO PUEDE DIVERGIR
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-845 · 🔴 el espejo del panel y la lista del servidor son el MISMO conjunto', () => {
  const servidor = [...SERVIDOR.NO_SE_MARCAN_PAGADAS_EN_LOTE].sort();
  const panel = [...PANEL.FACTURA_NO_SE_MARCA_PAGADA_EN_LOTE].sort();
  const soloServidor = servidor.filter((x) => !panel.includes(x));
  const soloPanel = panel.filter((x) => !servidor.includes(x));
  assert.deepEqual({ soloServidor, soloPanel }, { soloServidor: [], soloPanel: [] },
    '🔴 EL ESPEJO HA DIVERGIDO.\n'
    + `     sólo en el servidor: ${soloServidor.join(', ') || '(nada)'}\n`
    + `     sólo en el panel:    ${soloPanel.join(', ') || '(nada)'}\n\n'`
    + '  `FACTURA_NO_SE_MARCA_PAGADA_EN_LOTE` (invoiceAccion.js) copia\n'
    + '  `NO_SE_MARCAN_PAGADAS_EN_LOTE` (src/modules/system/invoiceAdmin.ts) porque el panel es\n'
    + '  vanilla y no puede importar TypeScript. Si divergen, la lista vuelve a ofrecer lo que el\n'
    + '  servidor va a rechazar en silencio — el defecto de SCRUM-845, otra vez.\n\n'
    + '  QUÉ HACER: copiar el estado nuevo al espejo. NO relajar esta comparación.');
});

test('SCRUM-845 · 🔴 y los dos predicados responden IGUAL, estado por estado', () => {
  // El conjunto igual no basta: los dos podrían leerlo y usarlo al revés. Se prueba el HECHO —qué
  // contesta cada uno— sobre filas de verdad, que es lo que hace el propio test de SCRUM-496.
  const estados = ['pending', 'paid', 'annulled', 'expired', 'PAID', ''];
  for (const status of estados) {
    assert.equal(
      PANEL.sePuedeMarcarPagadaEnLote({ status }),
      SERVIDOR.puedeMarcarsePagadaEnLote({ status: String(status).toLowerCase() }),
      `🔴 con status "${status}" el panel y el servidor no dicen lo mismo sobre si se puede marcar\n`
      + '  pagada en lote. Uno de los dos está mintiendo, y el que se ve es el panel.');
  }
});

test('SCRUM-845 · una RECTIFICATIVA queda fuera por su ESTADO, no por su tipo', () => {
  // Medido al abrir el ticket: una R1 nace con `status: 'paid'` (invoicesAdmin.routes.ts), así que
  // el lote ya la excluye por estado. Preguntarlo por el TIPO sería una segunda regla con el mismo
  // nombre — y `R1` es `type`, columna DISTINTA de `status`. Queda escrito para que nadie
  // «arregle» esto añadiendo un caso por tipo.
  assert.equal(PANEL.sePuedeMarcarPagadaEnLote({ status: 'paid', type: 'R1' }), false);
  assert.equal(PANEL.estadoDeFactura({ status: 'paid', type: 'R1' }), 'R1',
    '🔴 el estado del PATRÓN sí distingue la rectificativa: `R1` manda sobre el status.');
  assert.equal(PANEL.estadoDeFactura({ status: 'paid' }), 'paid');
  assert.equal(PANEL.estadoDeFactura({ status: 'expired' }), 'pending',
    '🔴 `expired` es un `pending` vencido y se trata como `pending` (Parte L).');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ③ LA LISTA PREGUNTA, Y NO SE LO INVENTA
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** El código sin comentarios: un guard de texto se caza a sí mismo en el párrafo que lo explica. */
function soloCodigo(fuente) {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
    .map((l) => l.replace(/^\s*\/\/.*$/, '')).join('\n');
}

test('SCRUM-845 · 🔴 la casilla de la lista está CONDICIONADA al estado', () => {
  const codigo = soloCodigo(LISTA);
  assert.match(codigo, /if\s*\(\s*window\.sePuedeMarcarPagadaEnLote\(\s*inv\s*\)\s*\)/,
    '🔴 la casilla vuelve a crearse en TODAS las filas. Con «Seleccionar todas» eso mete anuladas y\n'
    + '  ya pagadas en el lote, el servidor las descarta en silencio y la pantalla dice «✓ N\n'
    + '  facturas marcadas» EN VERDE con una N más pequeña que lo seleccionado.');

  // Y que se pregunta SIN guarda `typeof`: con ella, un resolutor ausente degradaría al
  // comportamiento viejo —casilla en todas— sin que nada se pusiera rojo. Un fallo tiene que
  // reventar, no volver al defecto.
  assert.ok(!/typeof\s+window\.sePuedeMarcarPagadaEnLote/.test(codigo),
    '🔴 la llamada lleva guarda `typeof`. Si el resolutor faltara, esto caería al comportamiento\n'
    + '  ANTERIOR, que es el defecto — y en silencio. Se llama a pelo, como `soloFacturas`.');

  // La lista NO reimplementa el criterio: ni la lista de estados ni el registro a mano.
  assert.ok(!/NO_SE_MARCAN|'annulled'\s*,\s*'paid'|'paid'\s*,\s*'annulled'/.test(codigo),
    '🔴 la lista escribe su PROPIA lista de estados excluidos. Dos listas para la misma pregunta es\n'
    + '  cómo nacen las divergencias que este ticket cierra: se pregunta, no se copia.');
});

test('SCRUM-845 · 🔴 el DETALLE ya no calcula el estado ni el contexto por su cuenta', () => {
  const codigo = soloCodigo(DETALLE);
  assert.match(codigo, /window\.estadoDeFactura\(invoice\)/,
    '🔴 el detalle vuelve a mapear el estado a mano. Ése es el sitio donde vivía encerrado.');
  assert.match(codigo, /window\.destinoDeAccionFactura\(/,
    '🔴 el detalle vuelve a resolver el registro por su cuenta en vez de preguntar al fichero\n'
    + '  compartido. El criterio sería el mismo HOY y divergiría el día que uno de los dos cambie.');
  assert.ok(!/'bizum-no-disponible'\s*:/.test(codigo),
    '🔴 el contexto de Bizum se ha vuelto a escribir aquí. Estaba a medias en `jobDetailView` en\n'
    + '  SCRUM-831 por esto mismo: dos copias del mismo contexto y una se queda corta.');
});

test('SCRUM-845 · el fichero compartido SE CARGA, y detrás de quien lee', () => {
  const orden = (f) => INDEX.indexOf(`js/${f}`);
  assert.ok(orden('invoiceAccion.js') > 0,
    '🔴 `invoiceAccion.js` no está en `index.html`: las dos pantallas llamarían a funciones que no\n'
    + '  existen. Un fichero que no se carga no es una fuente compartida, es un fichero.');
  for (const antes of ['patronDetalleAcciones.js', 'invoiceActionsRegistry.js']) {
    assert.ok(orden(antes) < orden('invoiceAccion.js'),
      `🔴 \`invoiceAccion.js\` carga ANTES que \`${antes}\`, que es de quien lee.`);
  }
  assert.ok(orden('invoiceAccion.js') < orden('invoiceDetailView.js'),
    '🔴 el detalle carga antes que el resolutor que consume.');
});
