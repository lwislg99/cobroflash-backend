// tests/scrum442-facturas-sin-justificantes.test.mjs — SCRUM-442 (B4 · punto 1)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// «Menú **Facturas** = solo facturas» (diseño §B4)
//
// La víctima: un profesional abre Facturas para contar cuántas ha emitido este mes y la lista le
// mezcla facturas con justificantes de cobro. El número que lee no es el que cree — y es un dato
// que se mira antes de hablar con la gestoría.
//
// 🔴 LAS DOS MITADES VAN EN EL MISMO TEST, y no es preferencia de estilo: **por separado, cada una
// puede pasar mientras el documento se pierde.** «Ya no está en Facturas» es verdad tanto si se
// mudó a Cobros como si se cayó del producto, y las dos cosas se ven igual desde un test que solo
// mire una lista. Es el defecto de SCRUM-420 al revés: allí una entrada sin pantalla, aquí un
// documento sin superficie.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_JS = path.join(RAIZ, 'public/dashboard/js');

/** Un justificante REAL: `type: 'JUST'` y número `J-`. Nace con `chargeId` a null — medido. */
const JUSTIFICANTE = {
  id: 7, number: 'J-20260802-AB12', type: 'JUST', status: 'paid',
  total: '250.00', currency: 'EUR', createdAt: '2026-08-02T10:00:00.000Z',
  customer: { name: 'Paca la fontanera' }, customerName: 'Paca la fontanera',
};
const FACTURA = {
  id: 8, number: 'F-2026-0008', type: 'F1', status: 'pending',
  total: '900.00', currency: 'EUR', createdAt: '2026-08-03T10:00:00.000Z',
  customer: { name: 'Obras del Sur' }, customerName: 'Obras del Sur',
};
const RECTIFICATIVA = {
  id: 9, number: 'R1-2026-0002', type: 'R1', status: 'paid',
  total: '-100.00', currency: 'EUR', createdAt: '2026-08-04T10:00:00.000Z',
  customer: { name: 'Obras del Sur' }, customerName: 'Obras del Sur',
};

/** El mismo cobro, tal y como lo devuelve `listarCobros` para un justificante sin charge. */
const COBRO_DEL_JUSTIFICANTE = {
  origen: 'invoice', id: 7, fecha: '2026-08-02T10:00:00.000Z', cliente: 'Paca la fontanera',
  concepto: null, importe: '250.00', moneda: 'EUR', metodo: null, estado: 'paid',
  referencia: null, numero: 'J-20260802-AB12', tipo: 'JUST', invoiceId: 7, chargeId: null,
};

const textos = (n) => todos(n).map((x) => x.textContent).filter(Boolean).join(' | ');

/**
 * Lo que el filtro deja pasar. Se ejercita **la función de la vista**, cargada como la carga el
 * navegador — no una copia de su lógica escrita aquí.
 *
 * 🔴 POR QUÉ NO SE PINTA LA VISTA, y es la parte que hay que leer: `renderInvoicesView` **todavía
 * no se puede pintar en el banco** (revienta con `Cannot read properties of null` — el mini-DOM no
 * representa su marcado anidado; es una de las cinco del hueco declarado en SCRUM-417).
 *
 * La primera versión de este fichero SÍ pintaba, y **pasaba en verde por avería**: la vista
 * reventaba, el árbol salía vacío, y «el justificante ya no está» era cierto por la razón
 * equivocada. Lo cazó el control positivo —«la factura tampoco está»— y por eso está escrito.
 */
function loQuePasaElFiltro(documentos) {
  const banco = cargarDashboard(RAIZ);
  assert.equal(typeof banco.ctx.soloFacturas, 'function',
    '🔴 la vista de Facturas no publica `soloFacturas`: este fichero estaría midiendo el aire.');
  return banco.ctx.soloFacturas(documentos).map((d) => d.number);
}

// ═══ SUELO ════════════════════════════════════════════════════════════════════════════════

test('SCRUM-442 · SUELO: el escáner encuentra el filtro y la función que clasifica', () => {
  const vista = fs.readFileSync(path.join(DIR_JS, 'invoicesView.js'), 'utf8');
  assert.match(vista, /tipoDeFactura\(/,
    '🔴 la vista de Facturas ya no llama a `tipoDeFactura`: o se quitó el filtro, o alguien lo ' +
    'reescribió con otra forma de clasificar. Las dos cosas hay que verlas.');
  const reparto = fs.readFileSync(path.join(DIR_JS, 'jobDocsReparto.js'), 'utf8');
  assert.match(reparto, /function tipoDeFactura/,
    '🔴 no encuentro la definición de `tipoDeFactura`: si el escáner se rompe, «nadie clasifica a ' +
    'mano» y «no supe mirar» dan el mismo verde.');
});

// ═══ ① EL TEST QUE DECIDE: las dos mitades, juntas ═══════════════════════════════════════

test('SCRUM-442 · ① un `J-` SALE de Facturas Y SIGUE en Cobros — las dos mitades', async () => {
  // MITAD A · ya no está en Facturas. Con su control DENTRO: si el filtro no dejara pasar nada,
  // «el justificante ya no está» también sería cierto — y no significaría nada.
  const pasan = loQuePasaElFiltro([FACTURA, JUSTIFICANTE, RECTIFICATIVA]);
  assert.ok(pasan.length > 0,
    '🔴 el filtro no deja pasar NADA. Una lista vacía hace verdad «el justificante ya no está» sin ' +
    'que eso signifique nada: es el verde hueco que apareció al construir esto.');
  assert.ok(!pasan.includes('J-20260802-AB12'),
    '🔴 el justificante SIGUE en la lista de Facturas. El profesional que cuente cuántas ha ' +
    'emitido este mes leerá un número que no es.');

  // MITAD B · y sigue teniendo su sitio. Sin esto, la mitad A pasaría igual si el documento se
  // hubiera caído del producto — que es el defecto de SCRUM-420 al revés.
  const bancoCobros = cargarDashboard(RAIZ, { datos: [COBRO_DEL_JUSTIFICANTE] });
  const rc = await pintarVista(bancoCobros, 'renderCobrosView');
  assert.equal(rc.error, null, `🔴 la pantalla de Cobros revienta: ${rc.error && rc.error.message}`);
  const enCobros = textos(rc.contenedor);
  assert.match(enCobros, /J-20260802-AB12/,
    '🔴 el justificante ha salido de Facturas y NO está en Cobros: se ha quedado sin superficie. ' +
    'Sacarlo de donde no le toca no puede significar sacarlo del producto.');
  assert.match(enCobros, /justificante/,
    '🔴 en Cobros aparece pero sin decir que es un justificante: el documento pierde su naturaleza.');
});

test('SCRUM-442 · ① POSITIVO: la factura y la rectificativa NO desaparecen', () => {
  // El filtro quita solo lo que sobra. Una rectificativa ES una factura (`type: 'R1'`).
  const pasan = loQuePasaElFiltro([FACTURA, JUSTIFICANTE, RECTIFICATIVA]);
  assert.ok(pasan.includes('F-2026-0008'),
    '🔴 el filtro se ha llevado una factura por delante. Quita solo los justificantes.');
  assert.ok(pasan.includes('R1-2026-0002'),
    '🔴 el filtro se ha llevado una RECTIFICATIVA. Una R1 es una factura: rectifica a otra, y ' +
    'sacarla de Facturas la deja sin sitio igual que al justificante.');
});

test('SCRUM-442 · ① NEGATIVO: sin justificantes, la lista no cambia', () => {
  // Si el filtro tocara algo más, aquí se vería: un guard que se lleva cosas de más es tan malo
  // como uno que no se lleva nada.
  assert.deepEqual(loQuePasaElFiltro([FACTURA, RECTIFICATIVA]), ['F-2026-0008', 'R1-2026-0002']);
});

/**
 * Las CARGAS del listado de facturas en `public/`, y si cada una pasa por el filtro.
 *
 * Se censan las que piden `/admin/invoices` **como lista** — el `POST` de crear una factura
 * (`nuevaFacturaModal.js`) no lo es y queda fuera por construcción, no por lista blanca.
 */
function cargasDelListado() {
  const out = [];
  for (const f of fs.readdirSync(DIR_JS).filter((n) => n.endsWith('.js'))) {
    const codigo = fs.readFileSync(path.join(DIR_JS, f), 'utf8');
    codigo.split('\n').forEach((linea, i) => {
      if (/^\s*(\/\/|\*)/.test(linea)) return;
      if (!/['"`]\/admin\/invoices['"`]/.test(linea)) return;
      if (/method:\s*['"]POST['"]/.test(linea)) return; // crear no es listar
      // 🔴 Se mira si filtra **esta carga**, no si la palabra aparece en el fichero. Con lo
      // segundo, borrar el `soloFacturas(...)` de `fetchInvoices` seguiría dando verde porque la
      // DEFINICIÓN sigue ahí — y eso fue exactamente lo que pasó al probar el rojo la primera vez.
      const bloque = codigo.split('\n').slice(i, i + 14).join('\n');
      out.push({ sitio: `${f}:${i + 1}`, filtra: /soloFacturas\(/.test(bloque) });
    });
  }
  return out;
}

test('SCRUM-442 · ① TODA carga del listado pasa por el filtro — y el rojo dice CUÁNTAS no', () => {
  // Que `soloFacturas` exista y funcione no prueba que nadie la salte: **mencionar no es hacer**.
  // Y si mañana otra pantalla pide la lista, tiene que filtrar igual o volveremos a mezclar por
  // otro sitio — con la diferencia de que esta vez nadie estaría mirando.
  const cargas = cargasDelListado();
  assert.ok(cargas.length >= 1,
    '🔴 CENSO CIEGO: no encuentro NI la carga de `invoicesView`. «Nadie mezcla» y «no supe mirar» ' +
    'son el mismo verde.');

  const sinFiltrar = cargas.filter((c) => !c.filtra).map((c) => c.sitio);
  assert.deepEqual(sinFiltrar, [],
    `🔴 EL LISTADO VUELVE A MEZCLAR facturas con justificantes en ${sinFiltrar.length} de ` +
    `${cargas.length} carga(s):\n   · ${sinFiltrar.join('\n   · ')}\n\n` +
    '  Quien pide `/admin/invoices` tiene que pasar la respuesta por `soloFacturas`. El servidor ' +
    'devuelve los dos documentos a propósito —los usan el detalle y los exports—, así que el que ' +
    'separa es quien pinta la lista.');

  // Y el enlace exacto, en el sitio exacto: no basta con que la palabra aparezca en el fichero.
  const vista = fs.readFileSync(path.join(DIR_JS, 'invoicesView.js'), 'utf8');
  // `ok` y no `match`: un `match` que falla vuelca el fichero ENTERO en `actual` y entierra el
  // mensaje, que es lo único que quien lo lea necesita (misma corrección que en SCRUM-420).
  assert.ok(/return soloFacturas\(await res\.json\(\)\);/.test(vista),
    '🔴 `fetchInvoices` ya no devuelve la lista filtrada. La función seguiría estando y la lista ' +
    'volvería a mezclar: existir no es que alguien la llame.');
});

// ═══ ② LA RESTRICCIÓN: una sola forma de clasificar ══════════════════════════════════════

/** Sitios de `public/` que deciden si algo es un justificante SIN pasar por `tipoDeFactura`. */
function clasificacionesAMano() {
  const fuera = [];
  for (const f of fs.readdirSync(DIR_JS).filter((n) => n.endsWith('.js'))) {
    if (f === 'jobDocsReparto.js') continue; // aquí vive la definición: es la única legítima
    const codigo = fs.readFileSync(path.join(DIR_JS, f), 'utf8');
    codigo.split('\n').forEach((linea, i) => {
      if (/^\s*(\/\/|\*)/.test(linea)) return; // un comentario no clasifica nada (lección SCRUM-349)
      if (/startsWith\(['"]J-['"]\)|===\s*['"]JUST['"]/.test(linea)) fuera.push(`${f}:${i + 1}`);
    });
  }
  return fuera;
}

/**
 * TRINQUETE. Medido el 10-ago-2026: UNA sola copia a mano, en `invoiceDetailView.js`.
 *
 * ⚠️ SOLO PUEDE BAJAR. Nace en 1 y no en 0 a propósito: exigir 0 hoy pondría el guard rojo por una
 * copia que YA estaba y que no es de este ticket, y un guard que nace rojo lo apaga alguien en una
 * hora (la lección de SCRUM-402). Lo que sí impide desde hoy: que aparezca la SIGUIENTE.
 */
const CLASIFICAN_A_MANO_MAX = 1;

test('SCRUM-442 · ② nadie NUEVO clasifica un `J-` por su cuenta', () => {
  const aMano = clasificacionesAMano();
  assert.ok(aMano.length <= CLASIFICAN_A_MANO_MAX,
    `🔴 hay ${aMano.length} sitios que deciden si algo es un justificante sin pasar por ` +
    '`tipoDeFactura`, y el tope es ' + CLASIFICAN_A_MANO_MAX + '. Dos copias que divergen mandan ' +
    'el mismo documento a dos sitios, o a ninguno:\n   · ' + aMano.join('\n   · '));
  assert.equal(aMano.length, CLASIFICAN_A_MANO_MAX,
    `🔴 ahora hay ${aMano.length} y el tope dice ${CLASIFICAN_A_MANO_MAX}: si has quitado una, ` +
    'baja el tope en el mismo commit. Un tope con holgura es el descuadre silencioso.');
});

test('SCRUM-442 · ② SUELO del trinquete: el detector VE las copias', () => {
  // Si el detector se ciega, «nadie clasifica a mano» sale verde sobre un árbol lleno de copias.
  const aMano = clasificacionesAMano();
  assert.ok(aMano.length >= 1,
    '🔴 el detector no encuentra NI la copia conocida de `invoiceDetailView.js`. Está ciego, y su ' +
    'verde no dice nada.');
  assert.ok(aMano.some((s) => s.startsWith('invoiceDetailView.js')),
    `🔴 la copia conocida ha desaparecido del censo sin que nadie lo anote: ${aMano.join(', ')}`);
});

test('SCRUM-442 · ② CONTROL NEGATIVO: un comentario que menciona `J-` no cuenta', () => {
  // `jobRailBlocks.js:122` explica por qué NO se repite el `startsWith('J-')`. Cobrarle ese
  // comentario sería el impuesto sobre la claridad que SCRUM-349 quitó.
  const aMano = clasificacionesAMano();
  assert.ok(!aMano.some((s) => s.startsWith('jobRailBlocks.js')),
    '🔴 el detector cuenta un COMENTARIO como si clasificara. Así se paga por explicar la regla.');
});
