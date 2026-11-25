// tests/scrum1856a-salto-con-503.test.mjs — SCRUM-1856 tramo (a), SOLO SERVIDOR
//
// El fundador cazó en los logs de Railway ocho «HTTP 503 high demand» que tiraban el dictado del
// parte ENTERO con los otros dos modelos de la lista libres: `geminiCompleteConModelo` sólo saltaba
// de modelo con 429 / 404 / respuesta vacía, y un 503 caía en el `throw e` del final.
//
// Tres cosas, y ninguna toca texto que vea el usuario (el motivo de pantalla es el tramo b):
//   ① un 5xx TRANSITORIO (500/502/503/504) salta al siguiente modelo, como un 429;
//   ② el 429 LOGUEA sus `quotaId` (antes se calculaban y se tiraban: sólo viajaban en el error);
//   ③ «el modelo contestó y el saneador no sacó líneas» deja UNA línea de log, sin el dictado.
//
// No llama a Google: `fetch` simulado, sobre el código REAL de `dist/` (no una copia).
import test from 'node:test';
import assert from 'node:assert/strict';

const { geminiCompleteConModelo } = await import('../dist/integrations/gemini.js');
const { config } = await import('../dist/core/config/env.js');

const MODELOS = ['modelo-uno', 'modelo-dos', 'modelo-tres'];

// El mensaje es el LITERAL de la captura de Railway del fundador (producción, 25-nov-2026,
// 09:00–09:07 CET, ocho pares): «[gemini:gemini-2.5-flash] HTTP 503: This model is currently
// experiencing high demand. Spikes in demand are usually temporary. Please try again later.»,
// con su par «[POST /admin/partes/:id/dictado] ia: gemini_http_error». El log imprime
// `error.message` del cuerpo, así que el cuerpo es el sobre JSON de Google con ese mensaje.
const LOG_503_DE_RAILWAY = 'HTTP 503: This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.';
const CUERPO_503 = JSON.stringify({
  error: {
    code: 503,
    message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.',
    status: 'UNAVAILABLE',
  },
});

const QUOTA_ID = 'GenerateRequestsPerDayPerProjectPerModel-FreeTier';
const CUERPO_429 = JSON.stringify({
  error: {
    code: 429,
    message: 'You exceeded your current quota, please check your plan and billing details.',
    status: 'RESOURCE_EXHAUSTED',
    details: [{
      '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
      violations: [{ quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests', quotaId: QUOTA_ID }],
    }],
  },
});

function ok(texto) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: texto }] } }] }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}

/** `porModelo[nombre]` → la Response que da ese modelo. Apunta qué modelos se probaron. */
function simular(porModelo) {
  const real = globalThis.fetch;
  const vistos = [];
  globalThis.fetch = async (url) => {
    const m = String(url).match(/\/models\/([^:]+):/)?.[1];
    vistos.push(m);
    return porModelo(m);
  };
  return { vistos, restaurar: () => { globalThis.fetch = real; } };
}

/** Captura lo que se escribe por console.error/warn/log durante `fn`. */
async function conLog(fn) {
  const lineas = [];
  const orig = { e: console.error, w: console.warn, l: console.log };
  const apunta = (...a) => lineas.push(a.map(String).join(' '));
  console.error = apunta; console.warn = apunta; console.log = apunta;
  try { return { r: await fn(), lineas }; } finally {
    console.error = orig.e; console.warn = orig.w; console.log = orig.l;
  }
}

async function conClave(fn) {
  const antes = { g: config.GEMINI_API_KEY, m: config.GEMINI_MODEL };
  config.GEMINI_API_KEY = 'clave-de-mentira';
  config.GEMINI_MODEL = MODELOS.join(',');
  try { return await fn(); } finally { config.GEMINI_API_KEY = antes.g; config.GEMINI_MODEL = antes.m; }
}

// ─── ① el 503 salta ──────────────────────────────────────────────────────────────────────────

test('SCRUM-1856a · 🔴 un 503 «high demand» en el primer modelo SALTA al segundo y el texto sale', async () => {
  await conClave(async () => {
    const g = simular((m) => (m === 'modelo-uno' ? new Response(CUERPO_503, { status: 503 }) : ok('[]')));
    try {
      const { r, lineas } = await conLog(() => geminiCompleteConModelo({ system: 's', user: 'u' }));
      // El fixture reproduce la línea de Railway tal cual: si no, no es el 503 que cazó el fundador.
      assert.ok(lineas.includes(`[gemini:modelo-uno] ${LOG_503_DE_RAILWAY}`), `el log no es el de Railway: ${JSON.stringify(lineas)}`);
      assert.deepEqual(g.vistos, ['modelo-uno', 'modelo-dos'],
        '🔴 con el 503 no se probó el siguiente modelo: el dictado entero cae con dos modelos libres');
      assert.equal(r.modelo, 'modelo-dos');
      assert.equal(r.texto, '[]');
    } finally { g.restaurar(); }
  });
});

for (const status of [500, 502, 504]) {
  test(`SCRUM-1856a · un ${status} (5xx transitorio) también salta de modelo`, async () => {
    await conClave(async () => {
      const g = simular((m) => (m === 'modelo-uno' ? new Response('{}', { status }) : ok('hola')));
      try {
        const { r } = await conLog(() => geminiCompleteConModelo({ system: 's', user: 'u' }));
        assert.deepEqual(g.vistos, ['modelo-uno', 'modelo-dos']);
        assert.equal(r.modelo, 'modelo-dos');
      } finally { g.restaurar(); }
    });
  });
}

test('SCRUM-1856a · CONTROL: un 400 que no es transitorio NO salta (sigue lanzando en el primero)', async () => {
  await conClave(async () => {
    const g = simular(() => new Response(JSON.stringify({ error: { message: 'Invalid argument' } }), { status: 400 }));
    try {
      await conLog(() => assert.rejects(
        () => geminiCompleteConModelo({ system: 's', user: 'u' }),
        (e) => e?.code === 'gemini_http_error' && e?.httpStatus === 400,
      ));
      assert.deepEqual(g.vistos, ['modelo-uno'], 'un 400 no se arregla con otro modelo: no se reintenta');
    } finally { g.restaurar(); }
  });
});

test('SCRUM-1856a · con TODOS en 503 se prueban los tres y el error es el MISMO de antes (motivo de pantalla intacto)', async () => {
  await conClave(async () => {
    const g = simular(() => new Response(CUERPO_503, { status: 503 }));
    try {
      await conLog(() => assert.rejects(
        () => geminiCompleteConModelo({ system: 's', user: 'u' }),
        // `gemini_http_error` + 503: lo que lanzaba hoy con un solo modelo. El tramo b decide el texto.
        (e) => e?.code === 'gemini_http_error' && e?.httpStatus === 503,
      ));
      assert.deepEqual(g.vistos, MODELOS, 'se probaron TODOS, en orden, y ni uno más');
    } finally { g.restaurar(); }
  });
});

// ─── ② el 429 dice QUÉ cuota ─────────────────────────────────────────────────────────────────

test('SCRUM-1856a · 🔴 el 429 deja en el log su quotaId (diario o por minuto), no sólo en el error', async () => {
  await conClave(async () => {
    const g = simular((m) => (m === 'modelo-uno' ? new Response(CUERPO_429, { status: 429 }) : ok('hola')));
    try {
      const { lineas } = await conLog(() => geminiCompleteConModelo({ system: 's', user: 'u' }));
      // SUELO: el instrumento captura el log que YA existía («HTTP 429»). Sin esto, un «no sale» sería ciego.
      assert.ok(lineas.some((l) => /\[gemini:modelo-uno\] HTTP 429/.test(l)), 'CIEGO: no se capturó ni el log que ya había');
      assert.ok(lineas.some((l) => l.includes('modelo-uno') && l.includes(QUOTA_ID)),
        `🔴 el quotaId «${QUOTA_ID}» no aparece en el log: no se distingue «mañana» de «en un minuto»`);
      assert.ok(lineas.every((l) => !l.includes('clave-de-mentira')), '🔴 la clave se ha colado en el log');
    } finally { g.restaurar(); }
  });
});

// ─── ③ el vacío del saneador deja rastro ─────────────────────────────────────────────────────

const DICTADO = 'Sustituir el termo de la cocina de la señora Pilar';

for (const [nombre, respuesta] of [
  ['lista vacía', '[]'],
  ['sin JSON', 'Lo siento, no puedo ayudar con eso.'],
  ['JSON roto', '[{"descripcion": }]'],
  ['líneas sin descripción', '[{"descripcion": ""}, {"bloque": "materiales"}]'],
]) {
  test(`SCRUM-1856a · 🔴 «contestó y el saneador no sacó líneas» (${nombre}) deja UNA línea de log, sin el dictado`, async () => {
    await conClave(async () => {
      const g = simular(() => ok(respuesta));
      try {
        const { suggestLineasDeParte } = await import('../dist/modules/ai/domain/ai.service.js');
        const { r: p, lineas } = await conLog(() => suggestLineasDeParte({ dictado: DICTADO }));
        assert.equal(g.vistos.length, 1, 'CIEGO: no salió la petición al modelo');
        assert.equal(p.vacia, true);
        assert.equal(p.motivo, 'sin_lineas_reconocidas', 'el motivo de pantalla NO cambia (tramo b)');
        const mias = lineas.filter((l) => l.includes('[ai:dictado]'));
        assert.equal(mias.length, 1, `🔴 el caso silencioso sigue mudo (o habla de más): ${JSON.stringify(lineas)}`);
        assert.ok(!mias[0].includes('termo') && !mias[0].includes('Pilar'), '🔴 el dictado del técnico ha ido al log');
        assert.ok(mias[0].includes('modelo-uno'), 'el log dice QUÉ modelo contestó');
      } finally { g.restaurar(); }
    });
  });
}

test('SCRUM-1856a · CONTROL: un dictado que SÍ saca líneas no deja la línea de log del vacío', async () => {
  await conClave(async () => {
    const g = simular(() => ok('[{"bloque":"mano_obra","descripcion":"Sustituir el termo"}]'));
    try {
      const { suggestLineasDeParte } = await import('../dist/modules/ai/domain/ai.service.js');
      const { r: p, lineas } = await conLog(() => suggestLineasDeParte({ dictado: DICTADO }));
      assert.equal(p.vacia, false);
      assert.equal(lineas.filter((l) => l.includes('[ai:dictado]')).length, 0);
    } finally { g.restaurar(); }
  });
});
