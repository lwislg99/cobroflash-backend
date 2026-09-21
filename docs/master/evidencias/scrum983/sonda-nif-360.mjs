// Sonda (staging, merchant QA): ¿editar SÓLO la nota desde la ficha 360 borra el NIF y compañía?
// Uso: node sonda-nif-360.mjs <raiz-del-worktree>
// Crea 2 clientes «ZZZ PRUEBA 360 …» y los BORRA al final. El secreto se lee en runtime y no se imprime.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const raiz = process.argv[2];
const req = createRequire(path.join(raiz, 'package.json'));
const pmod = await import(pathToFileURL(req.resolve('puppeteer-core')).href);
const puppeteer = pmod.default || pmod;
const { lanzarNavegador } = await import(pathToFileURL(path.join(raiz, 'scripts/_navegador.mjs')).href);

const BASE = 'https://yaqu-staging-production.up.railway.app';
if (!/yaqu-staging/.test(BASE)) { console.error('no es staging'); process.exit(2); }
const m = fs.readFileSync('D:/MILLONARIO/cobroFlash/e2e-staging-secret.txt', 'utf8').match(/^E2E_TEST_LOGIN_SECRET=(.+)$/m);
if (!m) { console.error('sin clave de login'); process.exit(2); }
console.log('TESTIGO · sonda nif-360 contra ' + BASE);

const CAMPOS = ['name', 'notes', 'taxId', 'legalName', 'companyId', 'contactKind', 'tipoDestinatario', 'billingPeriodicity', 'phone', 'email', 'waOptOut'];
const nav = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
const pag = await nav.newPage();
const inf = {};
const creados = [];
let putBody = null;
try {
  pag.on('request', (r) => { if (r.method() === 'PUT' && /\/admin\/customers\/\d+$/.test(r.url())) putBody = r.postData(); });
  await pag.setViewport({ width: 1280, height: 900 });
  await pag.goto(BASE + '/login.html', { waitUntil: 'load' });
  inf.login = await pag.evaluate(async (s) => (await fetch('/auth/test-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'qa@staging.yaqu', secret: s }) })).status, m[1].trim());
  if (inf.login !== 200) throw new Error('login ' + inf.login);
  inf.version = await pag.evaluate(async () => (await (await fetch('/version')).json()).version);

  const alta = async (body) => pag.evaluate(async (b) => {
    const r = await fetch('/admin/customers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
    const j = await r.json().catch(() => null); return { status: r.status, id: j && j.id, err: j && (j.error || j.details) };
  }, body);
  const empresa = await alta({ name: 'ZZZ PRUEBA 360 empresa', contactKind: 'EMPRESA', legalName: 'ZZZ Prueba 360 SL' });
  inf.altaEmpresa = empresa; if (empresa.id) creados.push(empresa.id);
  const persona = await alta({ name: 'ZZZ PRUEBA 360 persona', notes: 'nota vieja', taxId: '12345678Z', legalName: 'ZZZ Razon Social', companyId: empresa.id, contactKind: 'PERSONA', tipoDestinatario: 'EMPRESARIO', billingPeriodicity: 'MENSUAL', phone: '34600111222', email: 'zzz.prueba360@example.com' });
  inf.altaPersona = persona; if (persona.id) creados.push(persona.id);
  if (!persona.id) throw new Error('no se creó el cliente de prueba: ' + JSON.stringify(persona));

  const leer = async (id) => pag.evaluate(async (i, campos) => {
    const c = await (await fetch('/admin/customers/' + i)).json();
    return Object.fromEntries(campos.map((k) => [k, c[k] === undefined ? '(ausente)' : c[k]]));
  }, id, CAMPOS);
  inf.antes = await leer(persona.id);

  await pag.goto(BASE + '/dashboard/#customer-360/' + persona.id, { waitUntil: 'networkidle2' });
  await pag.waitForSelector('#btn-edit-360', { timeout: 20000 });
  await pag.click('#btn-edit-360');
  await pag.waitForSelector('#e360-notes', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 1500)); // la lista de empresas llega después
  inf.modalAlAbrir = await pag.evaluate(() => ({
    taxId: document.getElementById('e360-taxid').value,
    legalName: document.getElementById('e360-legalname').value,
    tipo: document.getElementById('e360-tipodestinatario').value,
    periodicidad: document.getElementById('e360-periodicidad').value,
    notas: document.getElementById('e360-notes').value,
  }));
  // Cambiar SÓLO la nota, tecleando de verdad.
  await pag.click('#e360-notes', { clickCount: 3 });
  await pag.keyboard.type('nota nueva', { delay: 10 });
  await pag.click('#e360-save');
  await pag.waitForFunction(() => !document.getElementById('e360-save'), { timeout: 20000 }).catch(() => {});
  inf.putEnviado = putBody ? JSON.parse(putBody) : '(no se capturó el PUT)';
  inf.despues = await leer(persona.id);
} catch (e) {
  inf.error = e.message;
} finally {
  if (creados.length) {
    inf.borrado = await pag.evaluate(async (ids) => {
      const out = [];
      for (const id of ids.slice().reverse()) { const r = await fetch('/admin/customers/' + id, { method: 'DELETE' }); out.push({ id, status: r.status }); }
      const quedan = [];
      for (const id of ids) { const r = await fetch('/admin/customers/' + id); if (r.status !== 404) quedan.push({ id, status: r.status }); }
      return { out, quedan };
    }, creados).catch((e) => ({ error: e.message }));
  }
  await nav.close();
}
console.log(JSON.stringify(inf, null, 2));
if (inf.antes && inf.despues) {
  console.log('\n── CAMPO: antes → después ──');
  let perdidos = 0;
  for (const k of CAMPOS) {
    const a = JSON.stringify(inf.antes[k]); const d = JSON.stringify(inf.despues[k]);
    const esperado = k === 'notes' ? 'cambia' : 'igual';
    const ok = esperado === 'igual' ? a === d : a !== d;
    if (!ok && k !== 'notes') perdidos++;
    console.log(`${ok ? '✔' : '🔴'} ${k}: ${a} → ${d}`);
  }
  console.log(`\nPOBLACION campos=${CAMPOS.length} · control positivo (la nota cambió)=${JSON.stringify(inf.antes.notes) !== JSON.stringify(inf.despues.notes)} · perdidos=${perdidos}`);
}
console.log('EXIT=' + (inf.error ? 1 : 0));
