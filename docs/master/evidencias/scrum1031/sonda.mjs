// Sonda (staging, merchant QA): SCRUM-1031 — los tres fallos de la ficha del cliente.
// Uso: node sonda.mjs <raiz-con-node_modules>
// A: GET /admin/customers/duplicados (¿la captura /:id primero?)
// B: PATCH /admin/customers/:id (jobDetailView.js:3058) contra una ruta que solo tiene PUT
// C: las cifras (stats) de la ficha, ¿cuentan más de 20 documentos?
// Crea 1 cliente «ZZZ PRUEBA 1031 …» y N presupuestos, y los BORRA al final.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const raiz = process.argv[2];
const req = createRequire(path.join(raiz, 'package.json'));
const pmod = await import(pathToFileURL(req.resolve('puppeteer-core')).href);
const puppeteer = pmod.default || pmod;
const { lanzarNavegador } = await import(pathToFileURL(path.join(raiz, 'scripts/_navegador.mjs')).href);
const { telefonoDePrueba } = await import(pathToFileURL(path.join(raiz, 'scripts/_telefonos-prueba.mjs')).href);

const BASE = 'https://yaqu-staging-production.up.railway.app';
if (!/yaqu-staging/.test(BASE)) { console.error('no es staging'); process.exit(2); }
const m = fs.readFileSync('D:/MILLONARIO/cobroFlash/e2e-staging-secret.txt', 'utf8').match(/^E2E_TEST_LOGIN_SECRET=(.+)$/m);
if (!m) { console.error('sin clave de login'); process.exit(2); }
console.log('TESTIGO · sonda SCRUM-1031 contra ' + BASE);

const N_QUOTES = 21; // uno más que el take:20 de la lista de documentos
const nav = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
const pag = await nav.newPage();
const inf = {};
const clientesCreados = [];
try {
  await pag.setViewport({ width: 1280, height: 900 });
  await pag.goto(BASE + '/login.html', { waitUntil: 'load' });
  inf.login = await pag.evaluate(async (s) => (await fetch('/auth/test-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'qa@staging.yaqu', secret: s }) })).status, m[1].trim());
  if (inf.login !== 200) throw new Error('login ' + inf.login);
  inf.version = await pag.evaluate(async () => (await (await fetch('/version')).json()).version);
  inf.merchant = await pag.evaluate(async () => (await (await fetch('/admin/merchant')).json()));
  const merchantId = inf.merchant && inf.merchant.id;

  // ── A: GET /admin/customers/duplicados ──────────────────────────────────────
  inf.A_duplicados = await pag.evaluate(async () => {
    const r = await fetch('/admin/customers/duplicados?phone=34000009999');
    const j = await r.json().catch(() => null);
    return { status: r.status, body: j };
  });

  // ── Cliente de prueba ────────────────────────────────────────────────────────
  const alta = async (body) => pag.evaluate(async (b) => {
    const r = await fetch('/admin/customers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
    const j = await r.json().catch(() => null); return { status: r.status, id: j && j.id, err: j && (j.error || j.details) };
  }, body);
  const cliente = await alta({ name: 'ZZZ PRUEBA 1031 cliente', taxId: null, phone: telefonoDePrueba(1031) });
  inf.altaCliente = cliente;
  if (!cliente.id) throw new Error('no se creó el cliente de prueba: ' + JSON.stringify(cliente));
  clientesCreados.push(cliente.id);

  // ── B: PATCH vs PUT en /admin/customers/:id ──────────────────────────────────
  inf.B_patch = await pag.evaluate(async (id) => {
    const r = await fetch('/admin/customers/' + id, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ taxId: 'B12345678' }) });
    const j = await r.json().catch(() => null);
    return { status: r.status, body: j };
  }, cliente.id);
  inf.B_putControl = await pag.evaluate(async (id) => {
    const r = await fetch('/admin/customers/' + id, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ taxId: 'B12345678' }) });
    const j = await r.json().catch(() => null);
    return { status: r.status, body: j };
  }, cliente.id);

  // ── C: cifras con más de 20 documentos ───────────────────────────────────────
  const leerDetail = async (id) => pag.evaluate(async (i) => (await fetch('/admin/customers/' + i + '/detail')).json(), id);
  inf.C_antes = await leerDetail(cliente.id);

  const crearPresupuesto = async (body) => pag.evaluate(async (b) => {
    const r = await fetch('/quote/create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
    const j = await r.json().catch(() => null); return { status: r.status, id: j && j.id, err: j && (j.error || j.details) };
  }, body);
  const cuerpoPresupuesto = {
    merchant_id: merchantId,
    customer_id: cliente.id,
    lines: [{ concept: 'ZZZ línea de prueba 1031', qty: 1, price: 10 }],
    currency: 'EUR',
  };
  inf.creacionPresupuestos = [];
  for (let i = 0; i < N_QUOTES; i += 1) {
    const p = await crearPresupuesto(cuerpoPresupuesto);
    inf.creacionPresupuestos.push(p);
    if (!p.id && i === 0) break; // si el primero falla, la forma del body está mal: no insistir 21 veces
  }
  inf.presupuestosCreados = inf.creacionPresupuestos.filter((p) => p.id).length;

  inf.C_despues = await leerDetail(cliente.id);
} catch (e) {
  inf.error = e.message;
} finally {
  if (clientesCreados.length) {
    inf.borrado = await pag.evaluate(async (ids) => {
      const out = [];
      for (const id of ids) { const r = await fetch('/admin/customers/' + id, { method: 'DELETE' }); out.push({ id, status: r.status }); }
      return out;
    }, clientesCreados).catch((e) => ({ error: e.message }));
  }
  await nav.close();
}

console.log(JSON.stringify(inf, null, 2));

console.log('\n── VEREDICTOS ──');
const aOcurre = inf.A_duplicados && inf.A_duplicados.status === 400;
console.log(`A (ruta duplicados capturada por /:id): ${aOcurre ? 'OCURRE 🔴' : 'no ocurre ✔'} · status=${inf.A_duplicados && inf.A_duplicados.status}`);
const bOcurre = inf.B_patch && inf.B_patch.status === 404;
console.log(`B (PATCH del NIF sin ruta): ${bOcurre ? 'OCURRE 🔴' : 'no ocurre ✔'} · PATCH status=${inf.B_patch && inf.B_patch.status} · PUT control status=${inf.B_putControl && inf.B_putControl.status}`);
if (inf.C_despues && inf.C_despues.stats) {
  const total = inf.presupuestosCreados ?? 0;
  const cOcurre = total > 20 && inf.C_despues.stats.totalQuotes < total;
  console.log(`C (cifras truncadas a 20): ${cOcurre ? 'OCURRE 🔴' : 'no ocurre ✔'} · presupuestos creados=${total} · stats.totalQuotes=${inf.C_despues.stats.totalQuotes} · quotes.length (lista, esperado ≤20)=${inf.C_despues.quotes ? inf.C_despues.quotes.length : '?'}`);
}
console.log('EXIT=' + (inf.error ? 1 : 0));
