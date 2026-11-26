// tests/scrum1805-editor-modo-factura.test.mjs — SCRUM-1805 ①
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL EDITOR EN MODO FACTURA: lo que el profesional teclea es lo que viaja al emisor.
//
// Tramo A (1787k): la DESCRIPCIÓN y el «Dto. %» de cada línea se pintan también en la factura
//   suelta y viajan como claves propias (`description`, `dto`). Decisión (a) del registro: la
//   descripción NO se pega al `concept` — el concepto que se sella no cambia.
// Tramo B (1787f, decisión SCRUM-1787 c.22325 ②): la factura tiene paso «Condiciones» con las
//   formas de pago (`payMethods`), «Vence el» (`dueDate`, +30 días por defecto) y la fila de
//   ajustes; SIN «Condiciones de pago». «Revisar y emitir» pasa a ser el paso 4.
// Texto firmado (SCRUM-1656, delegación c.21978, registro nº 13): el resumen del paso cerrado es
//   «<formas elegidas> · vence el <fecha corta>», y sin vencimiento sólo «<formas elegidas>».
//
// Se EJECUTA la pantalla en el banco de vistas (SCRUM-451) y se lee lo que sale por la red: un
// guard de texto diría que las líneas están, esto mira qué se manda.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

/** Catálogo de mutaciones (SCRUM-1294): cada una tumba el caso que nombra `cae`. */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'public/dashboard/js/cuerpoDelDocumentoSuelto.js',
    de: 'if (descripcion) linea.description = descripcion;',
    a: '',
    cae: 'SCRUM-1805 · 🔴 tramo A: descripción y «Dto. %» se pintan en la factura y VIAJAN',
  },
  {
    fichero: 'public/dashboard/js/cuerpoDelDocumentoSuelto.js',
    de: 'if (dto !== null) linea.dto = dto;',
    a: '',
    cae: 'SCRUM-1805 · el compositor: «Dto. %» con el criterio de `descuentoParaPayload`',
  },
  {
    fichero: 'public/dashboard/js/quotesView.js',
    de: 'if (!esDocumentoSuelto) blockConditions.appendChild(filaCobro);',
    a: 'blockConditions.appendChild(filaCobro);',
    cae: 'SCRUM-1805 · 🔴 tramo B: formas de pago y «Vence el» VIAJAN; sin «Condiciones de pago»',
  },
  {
    fichero: 'public/dashboard/js/quotesView.js',
    de: 'dueDate: dueInput.value ? new Date(dueInput.value + "T23:59:59").toISOString() : undefined,',
    a: 'dueDate: undefined,',
    cae: 'SCRUM-1805 · 🔴 tramo B: formas de pago y «Vence el» VIAJAN; sin «Condiciones de pago»',
  },
  {
    fichero: 'public/dashboard/js/quotesView.js',
    de: 'return formasElegidasTexto() + (dueInput.value ? " · vence el " + fechaCorta(dueInput.value) : "");',
    a: 'return formasElegidasTexto();',
    cae: 'SCRUM-1805 · 🔴 el resumen firmado del paso: «<formas> · vence el <fecha corta>», y sin fecha sólo las formas',
  },
  {
    fichero: 'public/dashboard/js/quotesView.js',
    de: 'blockActionsTitle.dataset.numero = "4";',
    a: 'blockActionsTitle.dataset.numero = esDocumentoSuelto ? "3" : "4";',
    cae: 'SCRUM-1805 · la numeración: «Condiciones» es el 3 y «Revisar y emitir» el 4 en la factura',
  },
];

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PIEZA = 'public/dashboard/js/cuerpoDelDocumentoSuelto.js';
const CLIENTE = '7';

const texto = (n) => String((n && n.textContent) || '');
const respirar = () => new Promise((r) => setTimeout(r, 60));
const clase = (n) => String((n && n.className) || '');

function compositor() {
  const win = {};
  new Function('window', fs.readFileSync(path.join(RAIZ, PIEZA), 'utf8'))(win);
  return win.documentoSuelto.cuerpoDelDocumentoSuelto;
}

function bancoConRed(documentoSuelto) {
  const enviado = [];
  const red = {
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
    fetch: async (url, opts) => {
      if (opts && opts.method === 'POST') enviado.push({ url: String(url), body: opts.body });
      const u = String(url);
      let cuerpo = { factura: { id: 1 } };
      if (/\/admin\/customers/.test(u)) cuerpo = [{ id: Number(CLIENTE), name: 'Cliente de prueba' }];
      else if (/\/admin\/merchant/.test(u)) cuerpo = { id: 1, name: 'Taller', defaultCurrency: 'EUR' };
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => cuerpo, text: async () => '' };
    },
  };
  const banco = cargarDashboard(RAIZ, { red });
  banco.ctx.appDocumentoSuelto = documentoSuelto;
  banco.ctx.appMerchantId = 1;
  return { banco, enviado };
}

/** Monta el editor (factura si `suelto`), rellena cliente y una línea, y devuelve los nodos. */
async function montar({ suelto = true } = {}) {
  const { banco, enviado } = bancoConRed('factura');
  const r = await pintarVista(banco, 'renderQuotesView', null, suelto ? true : undefined);
  assert.equal(r.error, null, `🔴 la página no monta: ${r.error && r.error.message}`);
  const n = todos(r.contenedor);
  const sel = n.find((x) => x.tagName === 'SELECT' && x.name === 'customer_id');
  assert.ok(sel, '🔴 SUELO: no está el selector de cliente');
  sel.value = CLIENTE;
  sel.disparar('change');
  const concepto = n.find((x) => x.tagName === 'INPUT' && x.placeholder === 'Concepto / servicio');
  const numeros = n.filter((x) => x.tagName === 'INPUT' && x.type === 'number');
  assert.ok(concepto && numeros.length >= 2, '🔴 SUELO: no están los campos de la primera línea');
  concepto.value = 'Cambio de grifo';
  numeros[0].value = '1';
  numeros[1].value = '100';
  // La descripción y el descuento viven en la HOJA de ajustes de la línea, que se abre con su botón
  // (como lo haría el profesional) y se cuelga fuera del contenedor: se buscan en todo el documento.
  const abrirAjustes = () => {
    const b = n.find((x) => x.tagName === 'BUTTON' && clase(x).split(/\s+/).includes('quote-line__ajustes'));
    assert.ok(b, '🔴 SUELO: la línea no tiene su botón de ajustes');
    b.disparar('click');
    const enDoc = todos(banco.ctx.document.body);
    const dentro = (cls, tag) => {
      const td = enDoc.find((x) => clase(x).split(/\s+/).includes(cls));
      return td ? todos(td).find((x) => x.tagName === tag) : null;
    };
    return { desc: dentro('quote-line__descripcion', 'TEXTAREA'), dto: dentro('quote-line__dto', 'INPUT') };
  };
  // Las tres casillas de forma de pago, en el orden de `pmDefs` (card, bizum, transfer). El banco no
  // compone el texto de la etiqueta, así que se toman por posición y se exige que sean tres.
  const casillas = n.filter((x) => x.tagName === 'INPUT' && x.type === 'checkbox');
  return {
    r, n, enviado, abrirAjustes,
    due: n.find((x) => x.tagName === 'INPUT' && x.id === 'invoice-due-date'),
    pm: (clave) => {
      assert.equal(casillas.length, 3, `🔴 SUELO: la factura debía tener 3 casillas de forma de pago y tiene ${casillas.length}`);
      return casillas[['card', 'bizum', 'transfer'].indexOf(clave)];
    },
    emitir: async () => {
      const b = n.find((x) => x.tagName === 'BUTTON' && /^Emitir/.test(texto(x)));
      assert.ok(b, '🔴 SUELO: no está «Emitir factura»');
      b.disparar('click');
      await respirar();
      return enviado.filter((x) => /\/admin\/invoices/.test(x.url)).map((x) => JSON.parse(x.body));
    },
  };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA PIEZA · el compositor, con sus reglas
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1805 · el compositor: «Dto. %» con el criterio de `descuentoParaPayload`', () => {
  const cuerpo = compositor();
  const dtoDe = (dto) => cuerpo(7, [{ concepto: 'X', cantidad: '1', precio: '10', iva: '21', dto }]).lines[0].dto;
  assert.equal(dtoDe('10'), 10);
  assert.equal(dtoDe('12,5'), 12.5, '🔴 la coma decimal no se acepta, como en el campo del presupuesto');
  assert.equal(dtoDe('150'), 100, '🔴 por encima de 100 no se recorta a 100');
  for (const vacio of ['', '0', '-3', 'abc', null, undefined]) {
    assert.equal(dtoDe(vacio), undefined, `🔴 un descuento ${JSON.stringify(vacio)} viaja: la clave no debía ir`);
  }
  assert.equal(typeof dtoDe('7'), 'number', '🔴 el servidor quiere un NÚMERO: una cadena sería un 400');
});

test('SCRUM-1805 · el compositor: la descripción como clave propia, el concepto INTACTO (decisión (a))', () => {
  const l = compositor()(7, [{ concepto: '  Grifo  ', cantidad: '1', precio: '10', iva: '21', descripcion: '  Incluye sifón ' }]).lines[0];
  assert.equal(l.description, 'Incluye sifón');
  assert.equal(l.concept, 'Grifo', '🔴 el concepto ha cambiado: la descripción no puede tocar lo que se sella');
});

test('SCRUM-1805 · el compositor: condiciones — sólo viaja lo que hay, y sin ellas el cuerpo es el de antes', () => {
  const cuerpo = compositor();
  const FILA = [{ concepto: 'X', cantidad: '1', precio: '10', iva: '21' }];
  assert.deepEqual(Object.keys(cuerpo(7, FILA)), ['customerId', 'lines'], '🔴 sin condiciones el cuerpo ha cambiado de forma');
  assert.deepEqual(Object.keys(cuerpo(7, FILA, {})), ['customerId', 'lines']);
  assert.deepEqual(Object.keys(cuerpo(7, FILA, { payMethods: [], dueDate: '' })), ['customerId', 'lines'],
    '🔴 una lista vacía o un vencimiento vacío viajan: `undefined` = todas las formas / sin vencimiento');
  const lleno = cuerpo(7, FILA, { payMethods: ['bizum'], dueDate: '2026-12-26T22:59:59.000Z' });
  assert.deepEqual(lleno.payMethods, ['bizum']);
  assert.equal(lleno.dueDate, '2026-12-26T22:59:59.000Z');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA PANTALLA · montada y pulsada
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1805 · 🔴 tramo A: descripción y «Dto. %» se pintan en la factura y VIAJAN', async () => {
  const p = await montar();
  Object.assign(p, p.abrirAjustes());
  assert.ok(p.desc, '🔴 la factura no pinta la descripción de la línea (1787k)');
  assert.ok(p.dto, '🔴 la factura no pinta el «Dto. %» de la línea (1787k)');
  p.desc.value = 'Incluye sifón';
  p.dto.value = '10';
  const [cuerpo] = await p.emitir();
  assert.ok(cuerpo, '🔴 no se emitió nada');
  assert.equal(cuerpo.lines[0].description, 'Incluye sifón', '🔴 la descripción tecleada no viaja');
  assert.equal(cuerpo.lines[0].dto, 10, '🔴 el descuento tecleado no viaja');
  assert.equal(cuerpo.lines[0].concept, 'Cambio de grifo', '🔴 el concepto ha cambiado (decisión (a))');
});

test('SCRUM-1805 · 🔴 tramo B: formas de pago y «Vence el» VIAJAN; sin «Condiciones de pago»', async () => {
  const p = await montar();
  const textos = todos(p.r.contenedor).map((x) => texto(x).trim());
  assert.ok(!textos.includes('Condiciones de pago'), '🔴 la factura pinta «Condiciones de pago», que no tiene dónde ir');
  assert.ok(p.due, '🔴 la factura no tiene «Vence el»');

  // Por defecto, +30 días: la fecha que propone la pieza de SCRUM-633 con 30.
  const hoy = new Date();
  const en30 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 30);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // Tolerancia de UN día por la zona del negocio (la pieza calcula en Europe/Madrid, el banco en la local).
  const valido = [iso(en30), iso(new Date(en30.getTime() - 864e5)), iso(new Date(en30.getTime() + 864e5))];
  assert.ok(valido.includes(p.due.value), `🔴 «Vence el» no nace a +30 días: ${p.due.value}`);

  const transfer = p.pm('transfer');
  assert.ok(transfer, '🔴 SUELO: no encuentro la casilla de Transferencia');
  transfer.checked = false;
  p.due.value = '2026-12-26';
  const [cuerpo] = await p.emitir();
  assert.deepEqual(cuerpo.payMethods, ['card', 'bizum'], '🔴 las formas marcadas no viajan');
  assert.equal(cuerpo.dueDate, new Date('2026-12-26T23:59:59').toISOString(), '🔴 el vencimiento no viaja como fin del día');
});

test('SCRUM-1805 · ✅ CONTROL: «Vence el» vacío = sin vencimiento, la clave NO viaja', async () => {
  const p = await montar();
  p.due.value = '';
  const [cuerpo] = await p.emitir();
  assert.equal(Object.hasOwn(cuerpo, 'dueDate'), false, '🔴 un vencimiento vaciado viaja');
  assert.equal(Object.hasOwn(cuerpo, 'payMethods'), false, '🔴 con todas las formas marcadas viaja la lista (debía ser `undefined`)');
});

test('SCRUM-1805 · 🔴 el resumen firmado del paso: «<formas> · vence el <fecha corta>», y sin fecha sólo las formas', async () => {
  const p = await montar();
  p.pm('transfer').checked = false;
  p.due.value = '2026-12-26';
  const continuar = p.n.filter((x) => x.tagName === 'BUTTON' && texto(x).trim() === 'Continuar');
  assert.equal(continuar.length, 3, `🔴 la factura debe tener 3 pasos con «Continuar» (Cliente, Conceptos, Condiciones): ${continuar.length}`);
  for (const b of continuar) b.disparar('click');
  const resumen = () => p.n.filter((x) => clase(x).split(/\s+/).includes('quote-paso__resumen')).map((x) => texto(x));
  assert.ok(resumen().includes('💳 Tarjeta · 📲 Bizum · vence el 26/12/2026'),
    `🔴 el resumen del paso Condiciones no es el firmado: ${JSON.stringify(resumen())}`);

  // Sin vencimiento: sólo las formas. Se cambia y se refresca como lo haría el profesional.
  p.due.value = '';
  p.due.disparar('input');
  p.r.contenedor.disparar && p.r.contenedor.disparar('input');
  for (const b of p.n.filter((x) => x.tagName === 'BUTTON' && texto(x).trim() === 'Continuar')) b.disparar('click');
  assert.ok(resumen().includes('💳 Tarjeta · 📲 Bizum'),
    `🔴 sin vencimiento el resumen no es sólo las formas: ${JSON.stringify(resumen())}`);
  assert.ok(!resumen().some((t) => /vence el\s*$/.test(t)), '🔴 el resumen deja un «vence el» colgando');
});

test('SCRUM-1805 · la numeración: «Condiciones» es el 3 y «Revisar y emitir» el 4 en la factura', async () => {
  const p = await montar();
  const titulo = (t) => p.n.find((x) => x.tagName === 'H3' && texto(x).trim() === t);
  const cond = titulo('Condiciones');
  const rev = titulo('Revisar y emitir');
  assert.ok(cond && rev, '🔴 SUELO: no están los títulos de los pasos');
  assert.equal(cond.dataset.numero, '3');
  assert.equal(rev.dataset.numero, '4');
});

test('SCRUM-1805 · ✅ EL PRESUPUESTO NO CAMBIA: sin «Vence el», con «Válido hasta» y su resumen de siempre', async () => {
  const p = await montar({ suelto: false });
  assert.equal(p.due, undefined, '🔴 el presupuesto ha ganado «Vence el», que es de la factura');
  const textos = todos(p.r.contenedor).map((x) => texto(x).trim());
  for (const t of ['Condiciones de pago', 'Válido hasta']) {
    assert.ok(textos.includes(t), `🔴 el presupuesto ha perdido «${t}»`);
  }
  const rev = p.n.find((x) => x.tagName === 'H3' && texto(x).trim() === 'Revisar y enviar');
  assert.equal(rev && rev.dataset.numero, '4');
});
