// SCRUM-1637 · PASO 1 — toda respuesta lleva la CSP en MODO INFORME, y sólo en modo informe.
//
// Se pide por la ruta DE VERDAD (`dist/app.js` montada con el doble de Prisma del banco): la
// página de firma, la del presupuesto, el panel sin sesión y un estático. Lo que se exige:
//   ① la cabecera `Content-Security-Policy-Report-Only` con la política del módulo;
//   ② que la política NO lleve `'unsafe-inline'` (decisión del orquestador, 2-nov: con ella no
//      habría parado el XSS de 1632c, que era script en línea inyectado);
//   ③ que NO salga la cabecera que BLOQUEA: con 24 páginas de script en línea, aplicarla hoy
//      rompería todas. Pasar a `Content-Security-Policy` es el paso 3, no éste.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { montarAppReal } from './_banco-camino-real.mjs';

const require = createRequire(import.meta.url);
const app = await montarAppReal();
after(() => app.cerrar());
const { POLITICA_CSP, CABECERA_CSP_INFORME } = require('../dist/core/http/csp.js');

/** GET sin sesión, con `node:http` y `agent: false` (SCRUM-1332). Sólo importan las cabeceras. */
function pedir(ruta) {
  return new Promise((resolver, rechazar) => {
    const p = http.request(`${app.base}${ruta}`, { method: 'GET', agent: false }, (res) => {
      res.resume();
      res.on('error', rechazar);
      res.on('end', () => resolver({ status: res.statusCode, cabeceras: res.headers }));
    });
    p.on('error', rechazar);
    p.end();
  });
}

// La página de firma primero: es la que más importa y la del XSS de 1632c.
const RUTAS = [
  '/albaran/0123456789abcdef0123456789abcdef',
  '/pay/quote/0123456789abcdef0123456789abcdef',
  '/admin/me',
  '/login.html',
];

test('SCRUM-1637 · SUELO: la política es estricta y no lleva unsafe-inline', () => {
  assert.equal(CABECERA_CSP_INFORME, 'Content-Security-Policy-Report-Only');
  assert.match(POLITICA_CSP, /(^|; )script-src 'self'(;|$)/,
    '🔴 la política no fija `script-src \'self\'`: entonces el informe no cuenta los scripts en línea');
  assert.doesNotMatch(POLITICA_CSP, /unsafe-inline|unsafe-eval/,
    '🔴 LA POLÍTICA LLEVA unsafe-inline/unsafe-eval. Con eso el XSS de SCRUM-1632c (script en línea ' +
    'inyectado) habría corrido igual: sería una cabecera puesta y cero protección.');
});

test('SCRUM-1637 · 🔴 toda respuesta lleva la CSP en modo informe, y NINGUNA la que bloquea', async () => {
  for (const ruta of RUTAS) {
    const r = await pedir(ruta);
    assert.ok(r.status > 0, `🔴 ${ruta} no respondió`);
    assert.equal(r.cabeceras['content-security-policy-report-only'], POLITICA_CSP,
      `🔴 ${ruta} (HTTP ${r.status}) no lleva \`Content-Security-Policy-Report-Only\` con la política del módulo`);
    assert.equal(r.cabeceras['content-security-policy'], undefined,
      `🔴 ${ruta} lleva la CSP que BLOQUEA. Con 24 páginas de script en línea eso las rompe: ` +
      'el paso 1 es sólo informe.');
  }
});
