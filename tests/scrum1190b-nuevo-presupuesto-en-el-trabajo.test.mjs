// tests/scrum1190b-nuevo-presupuesto-en-el-trabajo.test.mjs — SCRUM-1190 (la pantalla)
//
// El servidor ya cuelga de un Trabajo el presupuesto que llega con `job_id` y, al aceptarlo, suma su
// importe (S1, docs/master/SCRUM-1190.md). Faltaba por dónde pedir un SEGUNDO presupuesto: el hueco
// «Hacer presupuesto» (SCRUM-1274) sólo sale cuando el Trabajo no tiene importe aceptado.
//
// Se mide sobre la ficha REAL (banco de vistas):
//   · con importe aceptado → «+ Nuevo presupuesto» en la barra de documentos, y al pulsarlo el editor
//     se abre con ESTE Trabajo y su cliente (el mismo `deTrabajo` que 1274);
//   · sin importe aceptado → NO sale (lo ofrece el hueco): uno de los dos, nunca los dos;
//   · el rótulo es el del locale (`L.quoteNew`): en MX sale la palabra de cotización sola;
//   · en un Trabajo cerrado la barra entera está oculta, y el botón con ella.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const respirar = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const texto = (n) => String(n.textContent || '');
const QUOTE = { id: 77, number: 3, total: 1210, currency: 'EUR', status: 'accepted' };
const base = (extra) => ({
  id: 42, status: 'en_curso', createdAt: '2026-09-01T09:00:00Z', titulo: 'Reforma baño',
  customer: { id: 5, name: 'Cliente de la obra', phone: '34000111222', mobile: null },
  asignados: [], operario: null, albaranes: [], gastos: [], notes: '', invoices: [],
  quote: QUOTE, direccion: null, totalAceptado: 1210, totalCobrado: 0, ...extra,
});

async function ficha(job, { locale } = {}) {
  const banco = cargarDashboard(RAIZ);
  banco.ctx.apiRequest = async (u) => {
    const url = String(u);
    if (/\/admin\/team/.test(url) || /gastos/.test(url)) return [];
    if (/\/admin\/partes/.test(url)) return { partes: [] };
    if (/\/admin\/merchant/.test(url)) return { name: 'Epipe' };
    return job;
  };
  banco.ctx.appUserRole = 'admin';
  if (locale) banco.ctx.appLocale = locale;
  const navegaciones = [];
  banco.ctx.renderAppView = (vista, opciones) => { navegaciones.push({ vista, opciones }); };
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `SUELO: la ficha no monta (${r.error && r.error.message})`);
  await respirar(20);
  const nodos = todos(banco.ctx.document.body);
  return {
    boton: nodos.find((n) => n.tagName === 'BUTTON' && n.getAttribute && n.getAttribute('data-presupuesto-del-trabajo') === '1'),
    hueco: nodos.find((n) => n.dataset && n.dataset.hueco === 'sin-presupuesto'),
    // CONTROL: la barra de documentos se pintó (si no, «no hay botón» no significaría nada).
    albaran: nodos.find((n) => n.tagName === 'BUTTON' && texto(n) === '+ Nuevo albarán'),
    navegaciones,
  };
}

const pulsar = (b) => ((b._oyentes && b._oyentes.click) || []).forEach((fn) => fn.call(b, { type: 'click', target: b, preventDefault() {}, stopPropagation() {} }));

test('SCRUM-1190 · con importe aceptado, «+ Nuevo presupuesto» abre el editor atado a ESTE Trabajo', async () => {
  const f = await ficha(base());
  assert.ok(f.albaran, 'CIEGO: la barra de documentos no se pintó');
  assert.ok(f.boton, 'el Trabajo con presupuesto aceptado no ofrece otro presupuesto');
  assert.equal(texto(f.boton), '+ Nuevo presupuesto');
  assert.equal(f.hueco, undefined, 'con importe aceptado no debe salir el hueco «sin presupuesto»');
  pulsar(f.boton);
  assert.equal(f.navegaciones.length, 1, 'el botón no navegó');
  assert.equal(f.navegaciones[0].vista, 'quotes-new');
  // Por JSON: el objeto nace en el contexto del banco (otro `Object.prototype`).
  assert.equal(JSON.stringify(f.navegaciones[0].opciones), JSON.stringify({ template: { deTrabajo: { jobId: 42, customerId: 5 } } }));
});

test('SCRUM-1190 · sin importe aceptado NO sale: lo ofrece el hueco «Hacer presupuesto» (uno, nunca los dos)', async () => {
  for (const extra of [{ quote: null, totalAceptado: null }, { quote: { ...QUOTE, status: 'sent' }, totalAceptado: null }]) {
    const f = await ficha(base(extra));
    assert.ok(f.albaran, 'CIEGO: la barra de documentos no se pintó');
    assert.ok(f.hueco, `CIEGO: sin importe aceptado (${extra.quote ? 'enviado' : 'sin presupuesto'}) falta el hueco`);
    assert.equal(f.boton, undefined, `con el hueco a la vista (${extra.quote ? 'enviado' : 'sin presupuesto'}) sale también el botón`);
  }
});

test('SCRUM-1190 · el rótulo es el del locale: en MX, «+ Nueva cotización»', async () => {
  const f = await ficha(base(), { locale: { quote: 'Cotización', quotePlural: 'Cotizaciones', quoteNew: 'Nueva cotización', currency: 'MXN' } });
  assert.ok(f.boton, 'CIEGO: no hay botón');
  assert.equal(texto(f.boton), '+ Nueva cotización');
});

test('SCRUM-1190 · en un Trabajo cerrado la barra de documentos está oculta, y el botón con ella', async () => {
  const f = await ficha(base({ status: 'cerrado' }));
  assert.ok(f.boton, 'CIEGO: no hay botón que mirar');
  let p = f.boton;
  let oculto = false;
  while (p) { if (p.hidden === true) { oculto = true; break; } p = p.parentNode; }
  assert.ok(oculto, 'en un Trabajo cerrado el botón queda a la vista');
});
