// SCRUM-910 ①: admin.html leía paybank_url/paycard_url/charge_id de la respuesta de
// POST /quote/:token/accept, y esa ruta nunca los devuelve — pinta la palabra "undefined".
// Confirmado corriendo la ruta real (Jira SCRUM-910, comentario 15793): responde
// {ok, status, quote_id, accepted_at}. Lee el fuente como TEXTO: es una página vanilla sin
// bundler ni runtime que montar (regla 4 / A7).
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

  // Control positivo (guarda del detector, SCRUM-113): si esto también fallara, el assert.ok
  // de arriba estaría pasando por estar ciego a TODO "accepted.", no por el fichero estar limpio.
  // accepted.quote_id y accepted.status SÍ existen en la respuesta real (quotes.routes.ts:373-378)
  // y admin.html debe seguir usándolos.
  assert.ok(
    src.includes('accepted.quote_id'),
    'control positivo ciego: accepted.quote_id debería seguir usándose (si no aparece, el fichero se vació de más)',
  );
  assert.ok(
    src.includes('accepted.status'),
    'control positivo ciego: accepted.status debería seguir usándose',
  );
});
