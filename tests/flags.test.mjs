import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isFlagEnabled, FLAG_DEFAULTS } from '../dist/core/flags.js';

// La tabla P es cerrada: estos son exactamente los 11 flags del master.
// SCRUM-71 añadió VOICE_ALBARAN_ENABLED con aprobación explícita del fundador (regla 5: la
// lista es cerrada, así que crecer exige cambio de máster). Que este test se pusiera rojo al
// añadirlo es el mecanismo funcionando: la tabla no puede crecer en silencio.
test('tabla P: exactamente los 11 flags del master con sus defaults', () => {
  assert.deepEqual(Object.keys(FLAG_DEFAULTS).sort(), [
    'BIZUM_MANUAL_ENABLED',
    'BOT_AI_ENABLED',
    'BOT_INBOUND_ENABLED',
    'INVOICING_ES_ENABLED',
    'MAINTENANCE_ENABLED',
    'PAYMENTS_CONNECT_ENABLED',
    'PUBLIC_PROFILE_ENABLED',
    'SIF_ENABLED',
    'VOICE_ALBARAN_ENABLED',
    'VOICE_QUOTE_ENABLED',
    'WHATSAPP_TEMPLATES_ENABLED',
  ]);
  // Único ON por defecto: el canal WhatsApp.
  assert.equal(FLAG_DEFAULTS.WHATSAPP_TEMPLATES_ENABLED, true);
  assert.equal(FLAG_DEFAULTS.INVOICING_ES_ENABLED, false);
  assert.equal(FLAG_DEFAULTS.SIF_ENABLED, false);
});

test('default de la tabla cuando no hay env ni overrides', () => {
  delete process.env.VOICE_QUOTE_ENABLED;
  assert.equal(isFlagEnabled('VOICE_QUOTE_ENABLED'), false);
  delete process.env.WHATSAPP_TEMPLATES_ENABLED;
  assert.equal(isFlagEnabled('WHATSAPP_TEMPLATES_ENABLED'), true);
});

test('env override: true/1 encienden, false/0 apagan', () => {
  process.env.VOICE_QUOTE_ENABLED = 'true';
  assert.equal(isFlagEnabled('VOICE_QUOTE_ENABLED'), true);
  process.env.VOICE_QUOTE_ENABLED = '0';
  assert.equal(isFlagEnabled('VOICE_QUOTE_ENABLED'), false);
  process.env.WHATSAPP_TEMPLATES_ENABLED = 'false';
  assert.equal(isFlagEnabled('WHATSAPP_TEMPLATES_ENABLED'), false);
  delete process.env.VOICE_QUOTE_ENABLED;
  delete process.env.WHATSAPP_TEMPLATES_ENABLED;
});

test('precedencia: merchant gana a env', () => {
  process.env.BIZUM_MANUAL_ENABLED = 'true';
  assert.equal(
    isFlagEnabled('BIZUM_MANUAL_ENABLED', { merchant: { id: 7, flags: { BIZUM_MANUAL_ENABLED: false } } }),
    false,
  );
  assert.equal(
    isFlagEnabled('BIZUM_MANUAL_ENABLED', { merchant: { id: 7, flags: {} } }),
    true, // sin override del merchant, manda el env
  );
  delete process.env.BIZUM_MANUAL_ENABLED;
});

test('país: INVOICING_ES_ENABLED y SIF_ENABLED jamás se encienden fuera de ES', () => {
  process.env.INVOICING_ES_ENABLED = 'true';
  process.env.SIF_ENABLED = 'true';
  const mx = { merchant: { id: 2, country: 'MX' } };
  assert.equal(isFlagEnabled('INVOICING_ES_ENABLED', mx), false);
  assert.equal(isFlagEnabled('SIF_ENABLED', mx), false);
  // Incluso con override de merchant a true: el scope de país manda.
  assert.equal(
    isFlagEnabled('INVOICING_ES_ENABLED', { merchant: { id: 2, country: 'mx', flags: { INVOICING_ES_ENABLED: true } } }),
    false,
  );
  // Para ES sí aplica el env.
  assert.equal(isFlagEnabled('INVOICING_ES_ENABLED', { merchant: { id: 3, country: 'ES' } }), true);
  delete process.env.INVOICING_ES_ENABLED;
  delete process.env.SIF_ENABLED;
});

test('default OFF de INVOICING_ES_ENABLED para merchant ES sin env (estado pre-SIF)', () => {
  delete process.env.INVOICING_ES_ENABLED;
  assert.equal(isFlagEnabled('INVOICING_ES_ENABLED', { merchant: { id: 5, country: 'ES' } }), false);
});
