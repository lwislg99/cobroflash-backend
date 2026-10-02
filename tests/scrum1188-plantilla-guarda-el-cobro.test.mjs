// SCRUM-1188 (parte A) · «GUARDAR COMO PLANTILLA» PERDÍA LAS CONDICIONES DE COBRO.
//
// `POST /admin/templates` acepta `paymentTerms` desde siempre, y el editor ya lo restaura al APLICAR
// una plantilla (SCRUM-926). Pero el único que guarda plantillas, el editor del presupuesto, mandaba
// solo `{ name, currency, lines }`: una plantilla hecha desde el panel nunca traía condiciones.
//
// Decisión del orquestador (Jira SCRUM-1188, c.17282): se guardan las tres que caben en
// `quote_templates.payment_terms` (FULL_UPFRONT, FIFTY_FIFTY, MANUAL). «CUSTOM» NO se guarda: sus
// tramos viajan aparte (`customBillingPlan`) y la plantilla no tiene columna para ellos.
//
// Se mide EL VIAJE, no el gesto: guardar desde el editor → lo que el servidor guardó → montar el
// editor OTRA VEZ con lo que el servidor devuelve → aplicar la plantilla → sale la condición.
// Un test que solo mirara el cuerpo del POST pasaría con la ficha rápida sin restaurar nada, que es
// justo lo que pasaba: `cargarPlantilla` (fichas y «Usar plantilla» dentro del editor) solo leía líneas.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { casosEscritos } from './_casos-escritos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const respirar = () => new Promise((r) => setTimeout(r, 80));

const texto = (n) => {
  const t = String((n && n.textContent) || '');
  if (t) return t;
  return (n && n._html && !/</.test(n._html)) ? String(n._html) : '';
};
const boton = (raiz, re) => todos(raiz).find((x) => x.tagName === 'BUTTON' && re.test(texto(x).trim()));
const hojas = (b) => todos(b.ctx.document.body).filter((x) => String(x.className || '').includes('modal-overlay'));

/** Pulsa como un navegador: oyentes de `addEventListener` Y el `onclick` de propiedad (ver scrum600g). */
async function pulsar(n) {
  n.disparar('click');
  if (typeof n.onclick === 'function') await n.onclick.call(n, { type: 'click', target: n, preventDefault() {} });
  await respirar();
}

/**
 * Un servidor de plantillas en memoria con la MISMA regla que `templates.routes.ts` (POST):
 * `paymentTerms ?? null`. Lo que se guarda en una montura es lo que la siguiente recibe.
 */
function servidor() {
  const guardadas = [];
  const peticiones = [];
  const fetch = async (url, opts) => {
    const u = String(url);
    const metodo = (opts && opts.method) || 'GET';
    peticiones.push({ metodo, url: u, cuerpo: opts && opts.body });
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
  return { guardadas, peticiones, fetch };
}

async function montar(srv, plantilla = null) {
  const red = { navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } }, fetch: srv.fetch };
  const b = cargarDashboard(RAIZ, { red });
  b.ctx.appDocumentoSuelto = 'no';
  b.ctx.appMerchantId = 1;
  b.ctx.renderAppView = () => {};
  const r = await pintarVista(b, 'renderQuotesView', plantilla, false);
  assert.equal(r.error, null, `🔴 SUELO: el editor no monta: ${r.error && r.error.message}`);
  await respirar(); // las fichas rápidas se pintan después de pedir las plantillas
  const condiciones = todos(r.contenedor).find((x) => x.tagName === 'SELECT' && x.name === 'payment_terms');
  assert.ok(condiciones, '🔴 SUELO: el editor no monta el selector de condiciones de pago');
  return { b, contenedor: r.contenedor, condiciones };
}

function teclearLinea(contenedor) {
  const n = todos(contenedor);
  const conceptos = n.filter((x) => x.tagName === 'INPUT' && x.placeholder === 'Concepto / servicio');
  const numeros = n.filter((x) => x.tagName === 'INPUT' && x.type === 'number');
  assert.ok(conceptos.length >= 1 && numeros.length >= 2, '🔴 SUELO: no se encuentran los campos de la primera línea');
  conceptos[0].value = 'Revisión de caldera';
  numeros[0].value = '1';
  numeros[1].value = '90';
}

function elegir(select, valor) {
  select.value = valor;
  select.disparar('change');
}

async function guardarComoPlantilla(m, nombre) {
  teclearLinea(m.contenedor);
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

// El aviso que queda a la vista del editor tras guardar (la caja `.alert` de la vista, visible).
function alertaVisible(m) {
  const cajas = todos(m.contenedor).filter((x) => /(^|\s)alert(\s|$)/.test(String(x.className || '')) && x.style && x.style.display === 'block');
  assert.equal(cajas.length, 1, '🔴 SUELO: tras guardar no queda UNA alerta a la vista');
  return { texto: texto(cajas[0]).trim(), clase: String(cajas[0].className) };
}

async function pulsarFicha(m, nombre) {
  const ficha = todos(m.contenedor).find((x) => x.tagName === 'BUTTON'
    && String(x.className || '').includes('quote-plantilla-chip')
    && todos(x).some((h) => texto(h).trim() === nombre));
  assert.ok(ficha, `🔴 SUELO: la plantilla «${nombre}» no sale como ficha rápida al volver al editor`);
  await pulsar(ficha);
}

const FILAS = ['FIFTY_FIFTY', 'MANUAL'];
const caso = casosEscritos(FILAS, (condicion) => `SCRUM-1188 · 🔴 EL VIAJE: guardar con ${condicion} → recargar → la ficha rápida la devuelve`, async (condicion) => {
  const srv = servidor();
  const antes = await montar(srv);
  elegir(antes.condiciones, condicion);
  await guardarComoPlantilla(antes, 'Caldera');
  assert.equal(srv.guardadas.length, 1, '🔴 guardar no llegó al servidor');
  assert.equal(srv.guardadas[0].paymentTerms, condicion, '🔴 la plantilla se guarda SIN la condición de cobro elegida');
  const a = alertaVisible(antes);
  assert.match(a.texto, /^Plantilla "Caldera" guardada\. /, 'con una condición que SÍ se guarda sale el éxito de siempre');
  assert.doesNotMatch(a.texto, /sin el plan de cobro/, '🔴 el aviso de «Personalizado» sale donde la condición sí se guardó');

  const despues = await montar(srv); // editor nuevo: lo único que sabe es lo que devuelve el servidor
  assert.equal(despues.condiciones.value, 'FULL_UPFRONT', 'SUELO: el editor nace en FULL_UPFRONT');
  await pulsarFicha(despues, 'Caldera');
  assert.equal(despues.condiciones.value, condicion,
    '🔴 empezar con la plantilla no trae su condición de cobro: se queda en la de por defecto, sin que se vea');
});
test('SCRUM-1188 · 🔴 EL VIAJE: guardar con FIFTY_FIFTY → recargar → la ficha rápida la devuelve', caso(0));
test('SCRUM-1188 · 🔴 EL VIAJE: guardar con MANUAL → recargar → la ficha rápida la devuelve', caso(1));
caso.todos();

test('SCRUM-1188 · 🔴 EL VIAJE por «Usar» desde Plantillas (la plantilla como argumento del editor)', async () => {
  const srv = servidor();
  const antes = await montar(srv);
  elegir(antes.condiciones, 'FIFTY_FIFTY');
  await guardarComoPlantilla(antes, 'Caldera');
  const despues = await montar(srv, srv.guardadas[0]);
  assert.equal(despues.condiciones.value, 'FIFTY_FIFTY');
});

test('SCRUM-1188 · 🔴 «Personalizado» NO se guarda como condición: sin sus tramos sería una plantilla que miente', async () => {
  const srv = servidor();
  const antes = await montar(srv);
  elegir(antes.condiciones, 'CUSTOM');
  await guardarComoPlantilla(antes, 'Por tramos');
  assert.equal(srv.guardadas.length, 1, '🔴 guardar no llegó al servidor');
  assert.equal(srv.guardadas[0].paymentTerms, null, '🔴 se guardó una condición para un plan por tramos que la plantilla no puede reproducir');
  // Aviso FIRMADO (SCRUM-1188 c.17332), letra por letra, en lugar del éxito.
  const a = alertaVisible(antes);
  assert.equal(a.texto, 'Plantilla "Por tramos" guardada sin el plan de cobro. Los tramos de un plan personalizado no se guardan en las plantillas: al usarla, elige el cobro en el presupuesto.',
    '🔴 la plantilla se guarda sin el plan de cobro y el profesional no se entera');
  assert.doesNotMatch(a.clase, /success/, 'no es un éxito a secas: algo NO se guardó');

  const despues = await montar(srv);
  await pulsarFicha(despues, 'Por tramos');
  assert.notEqual(despues.condiciones.value, 'CUSTOM', '🔴 la plantilla abre «Personalizado» con cero tramos');
});

test('SCRUM-1188 · CONTROL: añadir la plantilla a un presupuesto EMPEZADO solo suma líneas, no cambia sus condiciones', async () => {
  const srv = servidor();
  const antes = await montar(srv);
  elegir(antes.condiciones, 'FIFTY_FIFTY');
  await guardarComoPlantilla(antes, 'Caldera');

  const otro = await montar(srv);
  teclearLinea(otro.contenedor); // ya hay una línea: la ficha AÑADE (semántica de SCRUM-139 F2)
  elegir(otro.condiciones, 'MANUAL');
  await pulsarFicha(otro, 'Caldera');
  assert.equal(otro.condiciones.value, 'MANUAL', '🔴 la plantilla ha pisado las condiciones que el profesional ya había elegido');
});
