// SCRUM-930 (mitad de S2) · «GUARDAR COMO PLANTILLA» PERDÍA LA DESCRIPCIÓN Y EL «Dto. %» DE CADA LÍNEA.
//
// Medido en el PASO 0 del ticket (c.17206): la descripción es POR LÍNEA, viaja dentro de `lines` y el
// servidor la guarda sin mirarla. Se perdía en el panel, en dos puntos: al GUARDAR (cada línea se
// armaba con `{concept, qty, price, tax}`) y al CARGAR por la ficha rápida o por «Usar plantilla»
// dentro del editor (`cargarPlantilla` sólo pasaba esos cuatro campos a `addLine`).
// El «Dto. %» de la línea va por el mismo sitio y se perdía igual.
//
// Se mide EL VIAJE, como en `scrum1188`: guardar desde el editor → lo que el servidor guardó → montar
// el editor OTRA VEZ con lo que el servidor devuelve → cargar la plantilla → los campos vuelven.
//
// LO QUE NO ENTRA, y por qué:
//   · el SUPLIDO: decisión del ticket (un gasto de UN cliente no se arrastra a otros).
//   · el descuento GLOBAL: `quote_templates` no tiene columna; espera su ALTER.
//   · el DOCUMENTO SUELTO: allí descripción y descuento no se pintan porque el emisor los descarta
//     (SCRUM-616). Una plantilla con descuento cargada allí NO puede bajar el importe.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const respirar = () => new Promise((r) => setTimeout(r, 80));

const texto = (n) => {
  const t = String((n && n.textContent) || '');
  if (t) return t;
  return (n && n._html && !/</.test(n._html)) ? String(n._html) : '';
};
const boton = (raiz, re) => todos(raiz).find((x) => x.tagName === 'BUTTON' && re.test(texto(x).trim()));
const hojas = (b) => todos(b.ctx.document.body).filter((x) => String(x.className || '').includes('modal-overlay'));
const conClase = (raiz, clase) => todos(raiz).filter((x) => String(x.className || '').split(/\s+/).includes(clase));

// Pulsa como un navegador: oyentes de `addEventListener` Y el `onclick` de propiedad (ver scrum600g).
async function pulsar(n) {
  n.disparar('click');
  if (typeof n.onclick === 'function') await n.onclick.call(n, { type: 'click', target: n, preventDefault() {} });
  await respirar();
}

// Un servidor de plantillas en memoria con la MISMA regla que `templates.routes.ts`: `lines` tal cual.
function servidor(sembradas = []) {
  const guardadas = JSON.parse(JSON.stringify(sembradas));
  const fetch = async (url, opts) => {
    const u = String(url);
    const metodo = (opts && opts.method) || 'GET';
    let cuerpo = {};
    if (/\/admin\/templates$/.test(u) && metodo === 'POST') {
      const b = JSON.parse(opts.body);
      const fila = { id: guardadas.length + 1, name: b.name, currency: b.currency, lines: b.lines, tiers: b.tiers ?? null, paymentTerms: b.paymentTerms ?? null };
      guardadas.push(fila);
      cuerpo = fila;
    } else if (/\/admin\/templates$/.test(u)) cuerpo = JSON.parse(JSON.stringify(guardadas));
    else if (/\/admin\/customers/.test(u)) cuerpo = [];
    else if (/\/admin\/merchant/.test(u)) cuerpo = { id: 1, name: 'Taller', defaultCurrency: 'EUR', country: 'ES' };
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => cuerpo, text: async () => '' };
  };
  return { guardadas, fetch };
}

async function montar(srv, plantilla = null, suelto = false) {
  const red = { navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } }, fetch: srv.fetch };
  const b = cargarDashboard(RAIZ, { red });
  b.ctx.appDocumentoSuelto = suelto ? 'factura' : 'no';
  b.ctx.appMerchantId = 1;
  b.ctx.appUserRole = 'admin';
  b.ctx.renderAppView = () => {};
  const r = await pintarVista(b, 'renderQuotesView', plantilla, suelto);
  assert.equal(r.error, null, `🔴 SUELO: el editor no monta: ${r.error && r.error.message}`);
  await respirar(); // las fichas rápidas se pintan después de pedir las plantillas
  return { b, contenedor: r.contenedor };
}

// Lo que se ve de CADA línea en la fila: concepto, cantidad, precio, su total y su ficha de ajustes.
function lineas(m) {
  const campo = (clase, tag) => conClase(m.contenedor, clase).map((c) => todos(c).find((x) => x.tagName === tag));
  const conceptos = campo('quote-line__concept', 'INPUT');
  const cantidades = campo('quote-line__qty', 'INPUT');
  const precios = campo('quote-line__price', 'INPUT');
  const totales = conClase(m.contenedor, 'quote-line__total');
  const fichas = conClase(m.contenedor, 'quote-line__ajustes');
  return conceptos.map((c, i) => ({ concepto: c, cantidad: cantidades[i], precio: precios[i], total: totales[i], ficha: fichas[i] }));
}

// La descripción, el «Dto. %» y el suplido viven en la HOJA «Ajustes de la línea»: se abre como la
// abre el profesional, se devuelven los campos (son los mismos nodos, abierta o cerrada) y se cierra
// con «Listo».
async function ajustes(m, i = 0) {
  const l = lineas(m)[i];
  assert.ok(l && l.ficha, '🔴 SUELO: la línea no tiene la ficha que abre sus ajustes');
  await pulsar(l.ficha);
  const hoja = todos(m.b.ctx.document.body).find((x) => String(x.className || '').includes('quote-ajustes-modal'));
  assert.ok(hoja, '🔴 SUELO: la ficha no abre la hoja «Ajustes de la línea»');
  const en = (clase, tag) => { const c = conClase(hoja, clase)[0]; return c ? todos(c).find((x) => x.tagName === tag) : null; };
  const campos = { descripcion: en('quote-line__descripcion', 'TEXTAREA'), dto: en('quote-line__dto', 'INPUT'), suplido: en('quote-line__suplido', 'INPUT') };
  const listo = boton(hoja, /^Listo$/);
  assert.ok(listo, '🔴 SUELO: la hoja de ajustes no tiene «Listo»');
  return { ...campos, cerrar: () => pulsar(listo) };
}

async function teclear(m, { descripcion = '', dto = '', suplido = false } = {}) {
  const [l] = lineas(m);
  assert.ok(l && l.concepto && l.cantidad && l.precio, '🔴 SUELO: no se encuentran los campos de la primera línea');
  l.concepto.value = 'Revisión de caldera';
  l.cantidad.value = '1';
  l.precio.value = '90';
  l.precio.disparar('input');
  const a = await ajustes(m);
  assert.ok(a.descripcion && a.dto && a.suplido, '🔴 SUELO: la hoja no tiene descripción, «Dto. %» o suplido que rellenar');
  a.descripcion.value = descripcion;
  a.dto.value = dto;
  a.dto.disparar('input');
  if (suplido) { a.suplido.checked = true; a.suplido.disparar('change'); }
  await a.cerrar();
}

// Lo que hay en la hoja de ajustes de la línea `i`, leído abriéndola.
async function leerAjustes(m, i = 0) {
  const a = await ajustes(m, i);
  const leido = { descripcion: a.descripcion ? a.descripcion.value : null, dto: a.dto ? String(a.dto.value) : null };
  await a.cerrar();
  return leido;
}

async function guardarComoPlantilla(m, nombre) {
  const mas = todos(m.contenedor).find((x) => x.tagName === 'BUTTON' && x._attrs && x._attrs['aria-label'] === 'Más acciones');
  assert.ok(mas, '🔴 SUELO: no está el menú «⋯» donde vive «Guardar como plantilla»');
  mas.disparar('click');
  const menu = todos(m.b.ctx.document.body).find((x) => x._attrs && x._attrs.role === 'menu');
  const guardar = menu && boton(menu, /^💾 Guardar como plantilla$/);
  assert.ok(guardar, '🔴 SUELO: no está «💾 Guardar como plantilla»');
  await pulsar(guardar);
  const hoja = hojas(m.b).at(-1);
  assert.ok(hoja, '🔴 SUELO: «Guardar como plantilla» no abre su hoja');
  hoja.querySelector('#tpl-name-input').value = nombre;
  await pulsar(hoja.querySelector('#save-tpl-btn'));
}

async function pulsarFicha(m, nombre) {
  const ficha = todos(m.contenedor).find((x) => x.tagName === 'BUTTON'
    && String(x.className || '').includes('quote-plantilla-chip')
    && todos(x).some((h) => texto(h).trim() === nombre));
  assert.ok(ficha, `🔴 SUELO: la plantilla «${nombre}» no sale como ficha rápida al volver al editor`);
  await pulsar(ficha);
}

const totalDe = (m, i = 0) => texto(lineas(m)[i].total).replace(/\s+/g, ' ').trim();

const DESCRIPCION = 'Limpieza del quemador, comprobación de presión y análisis de combustión.';
const LINEA = { concept: 'Revisión de caldera', qty: 1, price: 90, tax: 0.21 };
const CON_TODO = { id: 7, name: 'Caldera', currency: 'EUR', paymentTerms: 'FULL_UPFRONT', tiers: null, lines: [{ ...LINEA, description: DESCRIPCION, dto: 10 }] };
const SIN_DTO = { id: 7, name: 'Caldera', currency: 'EUR', paymentTerms: 'FULL_UPFRONT', tiers: null, lines: [{ ...LINEA, description: DESCRIPCION }] };
const DE_ANTES = { id: 8, name: 'Antigua', currency: 'EUR', paymentTerms: null, tiers: null, lines: [{ concept: 'Desatasco', qty: 2, price: 45, tax: 0.21 }] };

test('SCRUM-930 · 🔴 EL VIAJE: guardar con descripción y «Dto. %» → recargar → la ficha rápida los devuelve', async () => {
  const srv = servidor();
  const antes = await montar(srv);
  await teclear(antes, { descripcion: DESCRIPCION, dto: '10' });
  await guardarComoPlantilla(antes, 'Caldera');
  assert.equal(srv.guardadas.length, 1, '🔴 guardar no llegó al servidor');
  assert.equal(srv.guardadas[0].lines[0].description, DESCRIPCION, '🔴 la plantilla se guarda SIN la descripción de la línea');
  assert.equal(srv.guardadas[0].lines[0].dto, 10, '🔴 la plantilla se guarda SIN el descuento de la línea');

  const despues = await montar(srv); // editor nuevo: lo único que sabe es lo que devuelve el servidor
  assert.deepEqual(await leerAjustes(despues), { descripcion: '', dto: '' }, 'SUELO: el editor nace sin descripción ni descuento');
  await pulsarFicha(despues, 'Caldera');
  assert.equal(lineas(despues)[0].concepto.value, 'Revisión de caldera', 'SUELO: la ficha carga la línea');
  const leido = await leerAjustes(despues);
  assert.equal(leido.descripcion, DESCRIPCION, '🔴 cargar la plantilla no trae la descripción: el profesional la vuelve a escribir');
  assert.equal(leido.dto, '10', '🔴 cargar la plantilla no trae el descuento de la línea');
});

test('SCRUM-930 · 🔴 el descuento que trae la plantilla SE VE en la fila: en el total de la línea y en su ficha', async () => {
  const sin = await montar(servidor([SIN_DTO]));
  await pulsarFicha(sin, 'Caldera');
  const con = await montar(servidor([CON_TODO]));
  await pulsarFicha(con, 'Caldera');
  assert.match(totalDe(sin), /108[.,]90/, 'SUELO: sin descuento, 90 € + 21 % son 108,90');
  assert.match(totalDe(con), /98[.,]01/, '🔴 con el 10 % de la plantilla el total de la línea no baja a 98,01');
  assert.match(texto(lineas(con)[0].ficha), /10\s*%/, '🔴 la ficha de la línea no dice que lleva un 10 % de descuento');
  // La ficha se oculta (`is-de-siempre`) cuando la línea va con lo de siempre: la de SIN descuento sí; la otra no.
  assert.match(String(lineas(sin)[0].ficha.className), /is-de-siempre/, 'SUELO: la línea sin descuento va con «lo de siempre» y su ficha se oculta');
  assert.doesNotMatch(String(lineas(con)[0].ficha.className), /is-de-siempre/, '🔴 la ficha de una línea con descuento queda oculta como si fuera «lo de siempre»');
});

test('SCRUM-930 · 🔴 EL VIAJE por «Usar» desde Plantillas (la plantilla como argumento del editor)', async () => {
  const srv = servidor();
  const antes = await montar(srv);
  await teclear(antes, { descripcion: DESCRIPCION, dto: '10' });
  await guardarComoPlantilla(antes, 'Caldera');
  const despues = await montar(srv, srv.guardadas[0]);
  assert.deepEqual(await leerAjustes(despues), { descripcion: DESCRIPCION, dto: '10' });
});

test('SCRUM-930 · 🔴 el SUPLIDO no se guarda en la plantilla (decisión del ticket): la marca no viaja', async () => {
  const srv = servidor();
  const m = await montar(srv);
  await teclear(m, { descripcion: DESCRIPCION, suplido: true });
  await guardarComoPlantilla(m, 'Con tasa');
  assert.equal(srv.guardadas.length, 1, '🔴 guardar no llegó al servidor');
  assert.equal('suplido' in srv.guardadas[0].lines[0], false, '🔴 la plantilla guarda la marca de suplido: un gasto de un cliente acabaría en el presupuesto de otro');
  assert.equal(srv.guardadas[0].lines[0].description, DESCRIPCION, 'CONTROL: la descripción de esa misma línea sí se guarda');
});

test('SCRUM-930 · CONTROL: sin descripción ni descuento, la línea se guarda con las cuatro claves de siempre', async () => {
  const srv = servidor();
  const m = await montar(srv);
  await teclear(m);
  await guardarComoPlantilla(m, 'Sencilla');
  assert.deepEqual(Object.keys(srv.guardadas[0].lines[0]).sort(), ['concept', 'price', 'qty', 'tax'],
    '🔴 una plantilla sin descripción ni descuento ya no sale como antes (clave vacía de más)');
});

test('SCRUM-930 · POSITIVO: una plantilla guardada ANTES de este cambio se carga igual, con los campos nuevos vacíos', async () => {
  const m = await montar(servidor([DE_ANTES]));
  await pulsarFicha(m, 'Antigua');
  const [l] = lineas(m);
  assert.equal(l.concepto.value, 'Desatasco');
  assert.equal(String(l.cantidad.value), '2');
  assert.equal(String(l.precio.value), '45');
  assert.deepEqual(await leerAjustes(m), { descripcion: '', dto: '' }, '🔴 una plantilla sin descripción ni descuento se los inventa');
});

test('SCRUM-930 · 🔴 DOCUMENTO SUELTO: una plantilla con descuento NO baja el importe de un documento que no lo recoge', async () => {
  const suelto = await montar(servidor([CON_TODO]), null, true);
  await pulsarFicha(suelto, 'Caldera');
  const [l] = lineas(suelto);
  assert.equal(l.concepto.value, 'Revisión de caldera', 'SUELO: la ficha carga la línea también en el documento suelto');
  assert.match(totalDe(suelto), /108[.,]90/, '🔴 el total de la línea sale rebajado por un descuento que en el documento suelto no se ve ni se emite');
  // CONTROL del mismo dato en el presupuesto: ahí SÍ baja (si no, la fila de arriba no mediría nada).
  const presupuesto = await montar(servidor([CON_TODO]));
  await pulsarFicha(presupuesto, 'Caldera');
  assert.match(totalDe(presupuesto), /98[.,]01/, 'CONTROL: la misma plantilla, en el presupuesto, sí aplica su descuento');
});
