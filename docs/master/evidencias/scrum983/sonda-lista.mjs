// SCRUM-983 · la sonda gemela, para el modal de la LISTA de clientes (customersView.js).
// Uso: node docs/master/evidencias/scrum983/sonda-lista.mjs <raiz-del-worktree>
// Staging, merchant QA. Crea UN cliente «ZZZ PRUEBA 983 lista» con TODOS los campos editables
// rellenos (y una empresa para el vínculo), lo edita desde la LISTA cambiando SÓLO la nota, y
// compara el cliente ENTERO antes/después con GET /admin/customers/:id. Borra los dos al final.
// El secreto se lee en tiempo de ejecución y no se imprime (regla 9). Teléfonos: rango imposible.
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
const NOMBRE = 'ZZZ PRUEBA 983 lista ' + Date.now();
console.log('TESTIGO · sonda 983-lista contra ' + BASE);

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
  const empresa = await alta({ name: 'ZZZ PRUEBA 983 empresa', contactKind: 'EMPRESA', legalName: 'ZZZ Prueba 983 SL' });
  inf.altaEmpresa = empresa; if (empresa.id) creados.push(empresa.id);
  const persona = await alta({
    name: NOMBRE, notes: 'nota vieja', phone: telefonoDePrueba(9831), mobile: telefonoDePrueba(9832),
    email: 'zzz.prueba983@example.com', taxId: '12345678Z', legalName: 'ZZZ Razon Social', companyId: empresa.id,
    contactKind: 'PERSONA', tipoDestinatario: 'EMPRESARIO', billingPeriodicity: 'MENSUAL',
    recargoEquivalencia: true, dtoPorDefecto: 5, internalRef: 'EXP-983', tags: ['zzz983'],
    billingAddress: 'Calle Prueba 1', billingCity: 'Bilbao', billingPostalCode: '48001', billingProvince: 'Bizkaia', billingCountry: 'ES',
  });
  inf.altaPersona = persona; if (persona.id) creados.push(persona.id);
  if (!persona.id) throw new Error('no se creó el cliente de prueba: ' + JSON.stringify(persona));

  const leer = async (id) => pag.evaluate(async (i) => (await fetch('/admin/customers/' + i)).json(), id);
  inf.antes = await leer(persona.id);

  await pag.goto(BASE + '/dashboard/#customers', { waitUntil: 'networkidle2' });
  // La fila del cliente de prueba, por su NOMBRE (no por posición), y su botón «Editar».
  inf.filaEncontrada = await pag.waitForFunction((n) => [...document.querySelectorAll('tr')].some((tr) => tr.textContent.includes(n)), { timeout: 20000 }, NOMBRE).then(() => true, () => false);
  if (!inf.filaEncontrada) throw new Error('la fila del cliente de prueba no aparece en la lista');
  await pag.evaluate((n) => {
    const tr = [...document.querySelectorAll('tr')].find((t) => t.textContent.includes(n));
    [...tr.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Editar').click();
  }, NOMBRE);
  await pag.waitForSelector('textarea[name="notes"], input[name="notes"]', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 1000));
  await pag.evaluate(() => { document.querySelector('[name="notes"]').value = ''; });
  await pag.click('[name="notes"]');
  await pag.keyboard.type('nota nueva', { delay: 10 });
  await pag.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Guardar cambios').click(); });
  for (let i = 0; i < 40 && !putBody; i++) await new Promise((r) => setTimeout(r, 250));
  await new Promise((r) => setTimeout(r, 1500));
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
console.log(JSON.stringify({ ...inf, antes: undefined, despues: undefined }, null, 2));
if (inf.antes && inf.despues && typeof inf.putEnviado === 'object') {
  const IGNORAR = new Set(['updatedAt', 'notes']);
  const campos = Object.keys(inf.antes).filter((k) => !IGNORAR.has(k));
  const cambiados = campos.filter((k) => JSON.stringify(inf.antes[k]) !== JSON.stringify(inf.despues[k]));
  console.log('\n── CAMPO: antes → después (sólo los que cambian) ──');
  for (const k of cambiados) console.log(`🔴 ${k}: ${JSON.stringify(inf.antes[k])} → ${JSON.stringify(inf.despues[k])}`);
  const notaCambio = inf.despues.notes === 'nota nueva';
  console.log(`\nPOBLACION campos=${campos.length} (sin notes ni updatedAt) · rellenos antes=${campos.filter((k) => inf.antes[k] != null && inf.antes[k] !== '' && !(Array.isArray(inf.antes[k]) && !inf.antes[k].length)).length} · control positivo (la nota pasó a «nota nueva»)=${notaCambio} · cambiados=${cambiados.length}`);
  console.log('EXIT=' + (!inf.error && notaCambio && cambiados.length === 0 ? 0 : 1));
} else {
  console.log('ERROR: ' + (inf.error || 'sin antes/después o sin PUT'));
  console.log('EXIT=1');
}
