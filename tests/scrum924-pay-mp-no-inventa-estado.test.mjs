// tests/scrum924-pay-mp-no-inventa-estado.test.mjs — SCRUM-924
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// `/pay/mp/:token/result` PINTABA EL ESTADO QUE TRAÍA LA QUERY STRING, NO EL DEL COBRO.
//
// `?status=approved` es un parámetro que controla quien manda el enlace, no Mercado Pago: la ruta
// lo tomaba con `String(req.query.status || 'pending')` y lo usaba TAL CUAL para elegir el mensaje.
// Un cobro `pending` (o `failed`) con esa query pintaba «¡Pago aprobado!» sin que hubiera pasado
// nada. Medido el 22-sep-2026 (población de caminos vivos a esta URL = 0 fuera de teclearla o de
// `POST /charges` con `method_preference:'mp'`, que nadie en el repo llama); el remedio decidido no
// depende de ese hueco: lee `charge.status`, que es donde escribe `webhooks/mp` (fail-closed,
// verificado), en vez de la cadena de la URL.
//
// ── QUÉ VIGILA ESTE FICHERO ───────────────────────────────────────────────────────────────────
//
//   ① 🔴 EL CASO DEL TICKET  cobro `pending` + `?status=approved` → NO dice «aprobado».
//   ② 404 real           token que no existe → `documentNotFoundHtml`, no una página con huecos.
//   ③ CONTROL POSITIVO   cobro `paid` de verdad sigue pintando «aprobado», query o no.
//
// 🔴 Ni BD, ni red. Ruta real con dobles en `require.cache`, mismo patrón que
//    `tests/scrum910-la-transferencia-que-no-mira.test.mjs`.
//
// SCRUM-556/SCRUM-100 · `node:http` con `agent:false`, NUNCA `fetch`: con 3+ peticiones sobre el
// mismo `app.listen(0)` (aquí, `pedir()` llamado varias veces por test) `fetch` (undici) deja el
// proceso en un estado que bajo `--test-force-exit` en Windows aborta con un crash nativo de
// libuv — los resultados salen todos en verde pero el fichero se marca como fallido igual.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));

const R_PRISMA = require_.resolve('./dist/core/db/prisma.js');
const R_MP = require_.resolve('./dist/modules/billing/app/routes/payMp.routes.js');

const poner = (r, e) => { require_.cache[r] = { id: r, filename: r, loaded: true, exports: e }; };

function charge(status, extra = {}) {
  return {
    id: 9, receiptToken: 'tok924', status, amount: 120, currency: 'EUR',
    concept: 'Revisión de caldera', intentId: null, ...extra,
  };
}

function getSinAgente(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path, method: 'GET', agent: false },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, cuerpo: data }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function pedir(url, ch) {
  delete require_.cache[R_MP];
  poner(R_PRISMA, { prisma: {
    charge: { findUnique: async () => ch, update: async () => ch },
  } });
  const express = require_('express');
  const app = express();
  app.use('/pay', require_(R_MP).default);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { status, cuerpo } = await getSinAgente(server.address().port, url);
  await new Promise((r) => server.close(r));
  return { status, cuerpo };
}

test('SCRUM-924 · 🔴 ① cobro `pending` + `?status=approved` NO pinta «aprobado»', async () => {
  const r = await pedir('/pay/mp/tok924/result?status=approved', charge('pending'));

  assert.equal(r.status, 200, `🔴 CIEGO: devolvió HTTP ${r.status}.`);
  assert.ok(r.cuerpo.includes('Pago en proceso') || r.cuerpo.includes('Pago pendiente'),
    '🔴 CIEGO: no se ve ningún mensaje de "pendiente" — el test no está mirando la página real.');
  assert.equal(r.cuerpo.includes('¡Pago aprobado!'), false,
    '🔴 SE INVENTA EL ESTADO: un cobro `pending` con `?status=approved` en la URL pinta «¡Pago\n'
    + '    aprobado!». La clienta se cree que ha pagado sin que el cobro se haya movido de sitio.');
});

test('SCRUM-924 · ② token que no existe → 404, no una página con huecos', async () => {
  const r = await pedir('/pay/mp/no-existe/result?status=approved', null);
  assert.equal(r.status, 404, `🔴 devolvió HTTP ${r.status} para un token inexistente.`);
});

test('SCRUM-924 · 🔴 ③ CONTROL: un cobro `paid` de verdad sigue pintando «aprobado» (con o sin query)', async () => {
  const sinQuery = await pedir('/pay/mp/tok924/result', charge('paid'));
  const conQueryContraria = await pedir('/pay/mp/tok924/result?status=rejected', charge('paid'));

  assert.ok(sinQuery.cuerpo.includes('¡Pago aprobado!'),
    '🔴 CIEGO: un cobro `paid` sin query no pinta «aprobado» — el remedio rompió el caso normal.');
  assert.ok(conQueryContraria.cuerpo.includes('¡Pago aprobado!'),
    '🔴 CIEGO: un cobro `paid` con `?status=rejected` en la URL debería seguir diciendo «aprobado»\n'
    + '    (el estado lo decide el cobro, no la query, en ningún sentido) — si esto falla, el remedio\n'
    + '    sigue leyendo la query en algún camino.');
});
