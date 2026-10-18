// tests/scrum231b-exports-sin-cache-compartida.test.mjs — SCRUM-231b
//
// 🔴 LAS DESCARGAS DEL PANEL NO PUEDEN QUEDARSE EN UNA CACHÉ COMPARTIDA.
//
// Lo que sale de `/admin/exports/*` son datos de UN merchant: clientes con sus datos personales,
// facturas, cobros, gastos. Sus URL terminan en `.csv` y `.zip`, extensiones que una CDN cachea por
// defecto, y la respuesta salía SIN `Cache-Control`. La regla de la casa (`docs/CACHE_POLICY.md`)
// es que el ORIGEN decide la caché: aquí el origen no decía nada. Se exige `private` y `no-store`.
//
// ── QUÉ RUTAS ─────────────────────────────────────────────────────────────────────────────
// TODAS las GET del router, leídas de su `stack` en `dist/`, no de una lista escrita aquí: una
// descarga nueva que se añada mañana entra sola en este test. Suelo: las seis CSV del panel están
// en esa lista y responden 200 (la cabecera se mide en la respuesta de la ruta, no en un 401/403).
//
// La app REAL (`_banco-camino-real.mjs`) con Prisma doblado y vacío: sin base y sin red.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { montarAppReal, bancoDePrisma, sesionesDe } from './_banco-camino-real.mjs';

const require = createRequire(import.meta.url);
const app = await montarAppReal();
after(() => app.cerrar());
const ses = sesionesDe(231, { id: 9, role: 'tecnico', merchantId: 231 });

const router = require('../dist/modules/exports/app/routes/exports.routes.js').default;
const RUTAS = router.stack
  .filter((capa) => capa.route && capa.route.methods?.get)
  .map((capa) => capa.route.path);

const SEIS_CSV = ['/invoices.csv', '/expenses.csv', '/quotes.csv', '/jobs.csv', '/customers.csv', '/charges.csv'];

/** GET como el navegador del propietario, devolviendo también las CABECERAS (`app.pedir` no las da).
 *  Con `node:http` y `agent: false`, por el mismo motivo que el banco (SCRUM-1332). El cuerpo se
 *  consume y se descarta: aquí sólo importa la cabecera. */
function pedir(ruta) {
  return new Promise((resolver, rechazar) => {
    const p = http.request(`${app.base}${ruta}`, {
      method: 'GET', agent: false, headers: { cookie: `pf_session=${ses.PROPIETARIO}` },
    }, (res) => {
      const trozos = [];
      res.on('data', (t) => trozos.push(t));
      res.on('error', rechazar);
      res.on('end', () => resolver({
        status: res.statusCode, cabeceras: res.headers, texto: Buffer.concat(trozos).toString('utf8'),
      }));
    });
    p.on('error', rechazar);
    p.end();
  });
}

function programar() {
  bancoDePrisma().programar({
    authSession: ses.tabla,
    merchant: { findUnique: async () => ({ ...ses.merchant, country: 'ES', email: 'qa231@test.local', flags: null }) },
  });
}

test('SCRUM-231b · suelo: el router se lee y trae las seis CSV del panel', () => {
  for (const r of SEIS_CSV) assert.ok(RUTAS.includes(r), `suelo: ${r} no está entre las rutas del router (${RUTAS.join(', ')})`);
});

for (const ruta of SEIS_CSV) {
  test(`SCRUM-231b · suelo: GET /admin/exports${ruta} responde 200 como propietario`, async () => {
    programar();
    const r = await pedir(`/admin/exports${ruta}`);
    assert.equal(r.status, 200, `suelo: ${ruta} → ${r.status} ${r.texto?.slice(0, 160)}`);
  });
}

test('SCRUM-231b · 🔴 TODA ruta de /admin/exports sale con `private` y `no-store`', async () => {
  const mal = [];
  for (const ruta of RUTAS) {
    programar();
    const r = await pedir(`/admin/exports${ruta}`);
    const cc = String(r.cabeceras['cache-control'] ?? '');
    if (!/\bno-store\b/.test(cc) || !/\bprivate\b/.test(cc)) mal.push(`${ruta} (${r.status}) → «${cc}»`);
  }
  assert.deepEqual(mal, [], `🔴 rutas de exportación que una caché compartida puede guardar:\n  ${mal.join('\n  ')}`);
});
