// docs/master/evidencias/scrum937/censo-proveedores-937c.mjs — SCRUM-937c · ¿de verdad hay CERO?
//
// El recorrido dio «total: 0» proveedores en el merchant QA, y un cero nunca significa «está
// limpio»: significa «no he mirado». Aquí se comprueba el INSTRUMENTO con DOS sondas
// independientes sobre la misma pregunta (A3):
//   ① la RESPUESTA CRUDA de /admin/providers (forma, claves y tamaño, sin interpretarla);
//   ② las OPCIONES del desplegable del modal ya pintado, que es lo que ve el profesional.
// Si las dos dicen cero, es cero. Si discrepan, la discrepancia ES el dato.
//
// Control positivo: se pide también /admin/expenses, una colección que SABEMOS que responde y
// cuyo formato es el mismo. Si el censo dijera cero de TODO, el roto sería la sonda.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from '../../../../scripts/_navegador.mjs';

const BASE = 'https://yaqu-staging-production.up.railway.app';
if (!/yaqu-staging/.test(BASE)) { console.error('no es staging: no se mide'); process.exit(2); }
const m = fs.readFileSync('D:/MILLONARIO/cobroFlash/e2e-staging-secret.txt', 'utf8').match(/^E2E_TEST_LOGIN_SECRET=(.+)$/m);
if (!m) { console.error('no encuentro la clave de login'); process.exit(2); }
console.log('TESTIGO · censo 937c arrancado contra ' + BASE);

const nav = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
const pag = await nav.newPage();
const informe = {};
try {
  await pag.goto(BASE + '/login.html', { waitUntil: 'load' });
  informe.login = await pag.evaluate(async (s) => (await fetch('/auth/test-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'qa@staging.yaqu', secret: s }),
  })).status, m[1].trim());

  // ① la respuesta CRUDA, sin interpretarla.
  informe.sonda1_crudo = await pag.evaluate(async () => {
    const r = await fetch('/admin/providers');
    const txt = await r.text();
    let j = null; try { j = JSON.parse(txt); } catch {}
    return {
      status: r.status,
      primeros200: txt.slice(0, 200),
      esArray: Array.isArray(j),
      claves: j && !Array.isArray(j) ? Object.keys(j) : null,
      largo: Array.isArray(j) ? j.length : (j && Array.isArray(j.items) ? j.items.length : null),
    };
  });

  // control positivo: una colección que sabemos que contesta.
  informe.controlPositivo_expenses = await pag.evaluate(async () => {
    const r = await fetch('/admin/expenses');
    const j = await r.json();
    return { status: r.status, claves: Array.isArray(j) ? 'array' : Object.keys(j), largo: (j.items || j).length };
  });

  // ② lo que ve el profesional: las opciones del desplegable del modal REAL.
  await pag.goto(BASE + '/dashboard/#expenses', { waitUntil: 'networkidle2' });
  await pag.waitForSelector('#exp-new-btn', { timeout: 15000 });
  await pag.click('#exp-new-btn');
  await pag.waitForSelector('#exp-providerid', { timeout: 10000 });
  await pag.waitForFunction(
    () => !document.querySelector('#exp-providerid').textContent.includes('Cargando'),
    { timeout: 15000 },
  ).catch(() => {});
  informe.sonda2_desplegable = await pag.evaluate(() => {
    const s = document.getElementById('exp-providerid');
    return {
      opciones: s.options.length,
      textos: Array.from(s.options).map((o) => o.textContent),
      conDataNif: Array.from(s.options).filter((o) => o.dataset.nif).length,
    };
  });
} catch (e) {
  informe.error = e.message;
} finally {
  await nav.close();
}
console.log(JSON.stringify(informe, null, 2));
const s1 = informe.sonda1_crudo?.largo;
const s2 = informe.sonda2_desplegable ? informe.sonda2_desplegable.opciones - 1 : null; // menos «Sin proveedor»
console.log(`\nPOBLACION sonda1=${s1} sonda2=${s2} · control positivo (gastos)=${informe.controlPositivo_expenses?.largo}`);
console.log(s1 === s2 ? 'Las dos sondas COINCIDEN.' : '🔴 LAS DOS SONDAS DISCREPAN: la discrepancia es el dato.');
console.log('EXIT=0');
