// SCRUM-910 ①: admin.html leía paybank_url/paycard_url/charge_id de la respuesta de
// POST /quote/:token/accept, y esa ruta nunca los devuelve — pinta la palabra "undefined".
// Confirmado corriendo la ruta real (Jira SCRUM-910, comentario 15793): responde
// {ok, status, quote_id, accepted_at}. Lee el fuente como TEXTO: es una página vanilla sin
// bundler ni runtime que montar (regla 4 / A7).
//
// ⚠️ SCRUM-1202 · RETIRADA A PROPÓSITO del control positivo de abajo, no relajación. El control
// exigía que admin.html siguiera usando `accepted.quote_id` y `accepted.status`: la respuesta de
// POST /quote/:token/accept. Esa ruta se RETIRÓ en SCRUM-1202 (puerta pública que reescribía
// paymentTerms/evidence sin sello), y con ella el paso de admin.html que la llamaba —que además
// daba 404 siempre desde SCRUM-95, porque mandaba el id numérico—. Ya no hay `accepted` que leer.
// El control positivo pasa a ser el que sigue midiendo algo real: la consola SIGUE creando el
// presupuesto por /quote/create, y YA NO llama a /accept.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_HTML = path.join(DIR, '..', 'public', 'admin.html');

test('SCRUM-910 ①: admin.html no lee campos que /quote/:token/accept no devuelve', () => {
  const src = fs.readFileSync(ADMIN_HTML, 'utf8');

  for (const campo of ['paybank_url', 'paycard_url', 'charge_id']) {
    assert.ok(
      !src.includes(`accepted.${campo}`),
      `admin.html sigue leyendo accepted.${campo}, y /quote/:token/accept no lo devuelve ` +
        `(solo ok/status/quote_id/accepted_at) — pintaría "undefined".`,
    );
  }

  // Control positivo (guarda del detector, SCRUM-113) — reescrito en SCRUM-1202, ver cabecera.
  // Si el fichero se vaciara de más, `/quote/create` dejaría de aparecer y esto fallaría.
  assert.ok(
    src.includes("fetch('/quote/create'"),
    'control positivo ciego: admin.html debería seguir creando el presupuesto por /quote/create',
  );
});

test('SCRUM-1202: admin.html ya no llama a POST /quote/:id/accept (ruta retirada)', () => {
  const src = fs.readFileSync(ADMIN_HTML, 'utf8');
  assert.ok(
    !/fetch\(\s*`\/quote\/\$\{[^}]+\}\/accept`/.test(src),
    '🔴 admin.html vuelve a llamar a /quote/:id/accept, que ya no existe (daría 404 siempre)',
  );
  for (const id of ['qq-method', 'qq-send']) {
    assert.ok(!src.includes(`id="${id}"`), `🔴 volvió el mando «${id}», que solo alimentaba a /accept`);
  }
});
