// tests/scrum1219-plantilla-sin-condiciones.test.mjs — SCRUM-1219
//
// «SIN CONDICIONES ESPECÍFICAS» VOLVÍA COMO «PAGO 100% AL ACEPTAR», SIN AVISAR.
//
// El valor de la opción es `''`. Guardar la plantilla mandaba `null` (SCRUM-1188 solo guardaba las tres
// condiciones con nombre), y al usarla el editor, que nace en `FULL_UPFRONT`, no restauraba nada: la
// plantilla le cambiaba la condición de cobro al profesional. Decisión del orquestador (SCRUM-1219): se
// arregla guardando `''` y restaurándolo, NO con un aviso — aquí el dato cabe entero.
//
// Se mide EL VIAJE con los mismos ayudantes que SCRUM-1188: elegir → guardar → servidor en memoria con la
// regla de `templates.routes.ts` (`paymentTerms ?? null`, así que `''` se guarda tal cual) → montar OTRO
// editor → usar la plantilla (ficha rápida y «Usar» desde Plantillas) → sigue en «Sin condiciones».
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

async function pulsarFicha(m, nombre) {
  const ficha = todos(m.contenedor).find((x) => x.tagName === 'BUTTON'
    && String(x.className || '').includes('quote-plantilla-chip')
    && todos(x).some((h) => texto(h).trim() === nombre));
  assert.ok(ficha, `🔴 SUELO: la plantilla «${nombre}» no sale como ficha rápida al volver al editor`);
  await pulsar(ficha);
}

test('SCRUM-1219 · 🔴 EL VIAJE por la ficha rápida: «Sin condiciones específicas» vuelve como tal', async () => {
  const srv = servidor();
  const antes = await montar(srv);
  elegir(antes.condiciones, '');
  await guardarComoPlantilla(antes, 'Revisión');
  assert.equal(srv.guardadas.length, 1, 'SUELO: guardar no llegó al servidor');
  assert.equal(srv.guardadas[0].paymentTerms, '', '🔴 la plantilla no guarda «Sin condiciones específicas»');

  const despues = await montar(srv);
  assert.equal(despues.condiciones.value, 'FULL_UPFRONT', 'SUELO: el editor nace en FULL_UPFRONT');
  await pulsarFicha(despues, 'Revisión');
  assert.equal(despues.condiciones.value, '',
    '🔴 la plantilla convierte «Sin condiciones específicas» en «Pago 100% al aceptar» sin avisar');
});

test('SCRUM-1219 · 🔴 EL VIAJE por «Usar» desde Plantillas (la plantilla como argumento del editor)', async () => {
  const srv = servidor();
  const antes = await montar(srv);
  elegir(antes.condiciones, '');
  await guardarComoPlantilla(antes, 'Revisión');
  const despues = await montar(srv, srv.guardadas[0]);
  assert.equal(despues.condiciones.value, '', '🔴 «Usar» desde Plantillas no restaura «Sin condiciones específicas»');
});

test('SCRUM-1219 · CONTROL: una plantilla vieja (null) sigue abriendo como antes, en FULL_UPFRONT', async () => {
  const srv = servidor();
  const despues = await montar(srv, { id: 9, name: 'Vieja', currency: 'EUR', lines: [{ concept: 'Mano de obra', quantity: 1, price: 40 }], paymentTerms: null });
  assert.equal(despues.condiciones.value, 'FULL_UPFRONT', 'una plantilla sin condición no debe cambiar el editor');
});

test('SCRUM-1219 · CONTROL: «Personalizado» sigue sin guardarse (SCRUM-1188)', async () => {
  const srv = servidor();
  const antes = await montar(srv);
  elegir(antes.condiciones, 'CUSTOM');
  await guardarComoPlantilla(antes, 'Por tramos');
  assert.equal(srv.guardadas[0].paymentTerms, null);
});
