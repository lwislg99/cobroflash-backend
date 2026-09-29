// tests/scrum1274-presupuesto-desde-el-trabajo.test.mjs — SCRUM-1274
//
// «Hacer presupuesto» desde la ficha de un Trabajo abría el editor SIN estado. El presupuesto nacía
// suelto y, al aceptarlo, `ensureJobForQuote` no encontraba Trabajo y creaba OTRO: dos Trabajos para
// la misma obra, con el dinero repartido. El servidor ya sabía engancharlo con `job_id` (SCRUM-195).
//
// Se mide el VIAJE, de punta a punta:
//   ficha REAL del Trabajo → «Hacer presupuesto» → editor REAL con lo que se le pasó → «Generar» →
//   el cuerpo REAL del POST → el `CreateQuoteSchema` REAL (dist) → y lo que el servidor guardaría
//   (`Quote.jobId = job_id`) entra en el `ensureJobForQuote` REAL (dist), con una base de mentira que
//   cuenta cuántos Trabajos se crean al aceptar.
//
// Y el CONTROL NEGATIVO: un presupuesto desde cero, sin Trabajo de origen, SIGUE creando el suyo.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { CreateQuoteSchema } = require(path.join(RAIZ, 'dist/core/validation/schemas.js'));
const { ensureJobForQuote } = await import(pathToFileURL(path.join(RAIZ, 'dist/modules/jobs/domain/job.service.js')).href);

const respirar = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const texto = (n) => String(n.textContent || '');
const CLIENTE = { id: 5, name: 'Cliente de la obra', email: 'c@x.es', phone: '34000111222', mobile: null };
const OTRO = { id: 6, name: 'Otro cliente', email: 'o@x.es', phone: '34000111333', mobile: null };
const JOB = {
  id: 42, status: 'en_curso', createdAt: '2026-09-01T09:00:00Z', titulo: 'Reforma baño',
  customer: { id: CLIENTE.id, name: CLIENTE.name, phone: CLIENTE.phone, mobile: null },
  asignados: [], operario: null, albaranes: [], gastos: [], notes: '', invoices: [],
  quote: null, direccion: null, totalAceptado: null, totalCobrado: 0, // sin presupuesto aceptado
};

/** ① La ficha del Trabajo: pulsa «Hacer presupuesto» y devuelve adónde navegó y con qué. */
async function pulsarHacerPresupuesto() {
  const banco = cargarDashboard(RAIZ);
  banco.ctx.apiRequest = async (u) => {
    const url = String(u);
    if (/\/admin\/team/.test(url) || /gastos/.test(url)) return [];
    if (/\/admin\/partes/.test(url)) return { partes: [] };
    if (/\/admin\/merchant/.test(url)) return { name: 'Epipe' };
    return JOB;
  };
  banco.ctx.appUserRole = 'admin';
  const navegaciones = [];
  banco.ctx.renderAppView = (vista, opciones) => { navegaciones.push({ vista, opciones }); };
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `SUELO: la ficha no monta (${r.error && r.error.message})`);
  await respirar(20);
  const hueco = todos(banco.ctx.document.body).find((n) => n.dataset && n.dataset.hueco === 'sin-presupuesto');
  assert.ok(hueco, 'CIEGO: la ficha no pinta el hueco «sin presupuesto»; no hay botón que pulsar');
  const boton = todos(hueco).find((n) => n.tagName === 'BUTTON');
  assert.ok(boton && texto(boton) === 'Hacer presupuesto', 'CIEGO: el hueco no lleva «Hacer presupuesto»');
  const fns = (boton._oyentes && boton._oyentes.click) || [];
  assert.ok(fns.length, 'CIEGO: «Hacer presupuesto» no tiene oyente');
  fns.forEach((fn) => fn.call(boton, { type: 'click', target: boton, preventDefault() {}, stopPropagation() {} }));
  assert.equal(navegaciones.length, 1, 'SUELO: el botón no navegó');
  assert.equal(navegaciones[0].vista, 'quotes-new');
  return navegaciones[0].opciones || {};
}

/** ② El editor, montado con lo que le pasó la ficha. `cambiarA` simula que el profesional elige otro cliente. */
async function generarDesdeElEditor(deTrabajo, { cambiarA = null } = {}) {
  const posts = [];
  const red = {
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
    fetch: async (url, opts) => {
      const u = String(url);
      const metodo = (opts && opts.method) || 'GET';
      let cuerpo = {};
      if (/\/admin\/customers/.test(u)) cuerpo = [CLIENTE, OTRO];
      else if (/\/admin\/merchant$/.test(u)) cuerpo = { id: 1, name: 'Taller', defaultCurrency: 'EUR', clausulasPresupuesto: [] };
      else if (/\/quote\/create/.test(u) && metodo === 'POST') {
        posts.push(JSON.parse(String(opts.body)));
        cuerpo = { id: 99, number: 'P-2026-0003', status: 'draft' };
      } else if (/\/admin\/quotes\/\d+$/.test(u)) cuerpo = { id: 99, pdfUrl: '/pdf/99.pdf' };
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => cuerpo, text: async () => '' };
    },
  };
  const b = cargarDashboard(RAIZ, { red });
  b.ctx.appMerchantId = 1;
  b.ctx.renderAppView = () => {};
  // Las líneas entran como las de una plantilla (mismo recurso que el test de SCRUM-1180): el banco no teclea.
  const LINEAS = { name: 'x', currency: 'EUR', lines: [{ concept: 'Alicatado', qty: 1, price: 100 }] };
  const r = await pintarVista(b, 'renderQuotesView', LINEAS, undefined, deTrabajo);
  assert.equal(r.error, null, `SUELO: el editor no monta: ${r.error && r.error.message}`);
  await respirar();
  const n = todos(r.contenedor);
  const sel = n.find((x) => x.tagName === 'SELECT' && x.name === 'customer_id');
  assert.ok(sel, 'SUELO: no se encuentra el selector de cliente');
  const clienteAlAbrir = sel.value;
  if (cambiarA != null || !sel.value) { sel.value = String(cambiarA != null ? cambiarA : CLIENTE.id); sel.disparar('change'); }
  const lineas = n.filter((x) => x.tagName === 'INPUT');
  const concepto = lineas.find((x) => x.name === 'concept' || x.placeholder === 'Concepto');
  if (concepto && !concepto.value) { concepto.value = 'Alicatado'; concepto.disparar && concepto.disparar('input'); }
  const primaria = n.find((x) => x.tagName === 'BUTTON' && /^Generar/.test(texto(x)));
  assert.ok(primaria, 'SUELO: la pantalla no tiene «Generar»');
  primaria.disparar('click');
  await respirar(20);
  assert.equal(posts.length, 1, 'SUELO: «Generar» no ha llegado al POST /quote/create');
  return { cuerpo: posts[0], clienteAlAbrir };
}

/** ③ Lo que guarda el servidor y lo que pasa al ACEPTAR: cuántos Trabajos crea `ensureJobForQuote`. */
async function trabajosCreadosAlAceptar(cuerpo) {
  const leido = CreateQuoteSchema.parse(cuerpo);
  const quoteGuardado = {
    id: 99, merchantId: 1, customerId: leido.customer_id, status: 'accepted', total: '100.00',
    quoteNumber: 3, teamMemberId: null, jobId: leido.job_id ?? null, // quotes.routes.ts: `jobId: jobIdDelAdicional`
    customer: { name: CLIENTE.name },
  };
  const creados = [];
  const noop = new Proxy({}, { get: () => async () => null });
  const prismaFalso = new Proxy({
    quote: { findUnique: async () => quoteGuardado, update: async () => ({}), findFirst: async () => quoteGuardado },
    job: { findUnique: async () => null, findFirst: async () => null, create: async (a) => { creados.push(a); return { id: 500 }; }, update: async () => ({}) },
  }, { get: (t, k) => (k in t ? t[k] : noop) });
  await ensureJobForQuote(99, prismaFalso);
  return { creados: creados.length, leido };
}

test('SCRUM-1274 · 🔴 EL VIAJE: desde el Trabajo, «Hacer presupuesto» → aceptar → sigue habiendo UN solo Trabajo', async () => {
  const opciones = await pulsarHacerPresupuesto();
  assert.ok(opciones.deTrabajo, '🔴 «Hacer presupuesto» abre el editor SIN el Trabajo de origen');
  assert.equal(opciones.deTrabajo.jobId, JOB.id);
  const { cuerpo, clienteAlAbrir } = await generarDesdeElEditor(opciones.deTrabajo);
  assert.equal(clienteAlAbrir, String(CLIENTE.id), '🔴 el editor no abre con el cliente del Trabajo');
  assert.equal(cuerpo.job_id, JOB.id, '🔴 el POST no lleva `job_id`: el presupuesto nace suelto');
  const { creados, leido } = await trabajosCreadosAlAceptar(cuerpo);
  assert.equal(leido.job_id, JOB.id, '🔴 el esquema del servidor pierde `job_id`');
  assert.equal(creados, 0, `🔴 al aceptar se crean ${creados} Trabajo(s) nuevo(s): la obra se parte en dos`);
});

test('SCRUM-1274 · CONTROL NEGATIVO: un presupuesto desde cero SIGUE creando su Trabajo al aceptarse', async () => {
  const { cuerpo } = await generarDesdeElEditor(null);
  assert.equal('job_id' in cuerpo && cuerpo.job_id !== undefined, false, 'un presupuesto desde cero no lleva `job_id`');
  const { creados } = await trabajosCreadosAlAceptar(cuerpo);
  assert.equal(creados, 1, `🔴 sin Trabajo de origen, aceptar tiene que crear UNO; crea ${creados}`);
});

test('SCRUM-1274 · 🔴 si el profesional cambia de cliente, el `job_id` NO viaja (no es de esta obra)', async () => {
  const { cuerpo } = await generarDesdeElEditor({ jobId: JOB.id, customerId: CLIENTE.id }, { cambiarA: OTRO.id });
  assert.equal(cuerpo.customer_id, OTRO.id, 'SUELO: el cambio de cliente no llegó al POST');
  assert.equal(cuerpo.job_id, undefined, '🔴 un presupuesto de OTRO cliente se engancharía al Trabajo de éste');
});
