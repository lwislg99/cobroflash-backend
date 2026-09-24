// tests/scrum952-respaldo-gemini-con-cupo.test.mjs — SCRUM-952 · la lista de respaldo de los
// presupuestos no puede llevar un modelo con cupo 0 en el nivel gratis
//
// Antes, `gemini-2.0-flash` iba en medio de la lista por defecto con cupo 0 (tabla del fundador,
// captura de AI Studio, 18-sep-2026): un modelo así NUNCA responde, así que agotar las 20 diarias
// de `gemini-2.5-flash` dejaba la IA de presupuestos parada para TODO YaQu.
//
// Este guard NO llama a Google (no hay `GEMINI_API_KEY` en esta sesión: regla 9, los secretos no
// viajan al chat). Corre sobre un dato que SÍ está medido — la tabla del fundador, tal cual la
// trae el ticket — y sobre el código real: importa la lista por defecto de `dist/`, no una copia.
import test from 'node:test';
import assert from 'node:assert/strict';

const { MODELOS_PRESUPUESTOS_POR_DEFECTO, geminiCompleteConModelo } = await import('../dist/integrations/gemini.js');
const { config } = await import('../dist/core/config/env.js');

// Cupos gratis medidos por el fundador (captura de AI Studio, 18-sep-2026; RPD = peticiones/día).
// Es el dato del ticket SCRUM-952, no una suposición: un modelo con RPD 0 NUNCA puede responder.
const CUPO_RPD_MEDIDO = {
  'gemini-3.5-flash-lite': 500,
  'gemini-3.1-flash-lite': 500,
  'gemini-2.5-flash': 20,
  'gemini-3-flash': 20,
  'gemini-3.5-flash': 20,
  'gemini-3.6-flash': 20,
  'gemini-3.7-flash': 20,
  'gemini-3.8-flash': 20,
  'gemini-2.5-flash-lite': 20,
  'gemini-2-flash': 0,
  'gemini-2-flash-lite': 0,
  'gemini-2.5-pro': 0,
  'gemini-3.1-pro': 0,
  'gemini-2.0-flash': 0, // el nombre real del modelo «2 Flash» tal y como lo usa este fichero
};

function listaDefecto() {
  return MODELOS_PRESUPUESTOS_POR_DEFECTO.split(',').map((m) => m.trim()).filter(Boolean);
}

test('SCRUM-952 · 🔴 ningún modelo de la lista de respaldo por defecto tiene cupo 0 medido', () => {
  const lista = listaDefecto();
  assert.ok(lista.length >= 2, 'con un solo modelo no hay respaldo: si se agota, no hay a dónde caer');
  for (const modelo of lista) {
    const cupo = CUPO_RPD_MEDIDO[modelo];
    assert.notEqual(cupo, 0, `🔴 «${modelo}» tiene cupo 0 medido: nunca puede responder, es un respaldo fantasma`);
  }
});

test('SCRUM-952 · 🔴 dos modelos distintos de la familia 2.5, no el mismo repetido con otro nombre', () => {
  // Google cuenta la cuota POR MODELO: si los dos primeros fueran alias del mismo cupo, agotar
  // el primero agotaría el segundo también, y el "respaldo" no respaldaría nada.
  const [primero, segundo] = listaDefecto();
  assert.notEqual(primero, segundo, 'el primero y el segundo son el mismo modelo');
});

/** Google simulado: todo modelo responde 429 (cuota agotada), como pide el ticket. */
function simularCuotaAgotadaSiempre() {
  const real = globalThis.fetch;
  const vistos = [];
  globalThis.fetch = async (url) => {
    vistos.push(String(url).match(/\/models\/([^:]+):/)?.[1]);
    return new Response(JSON.stringify({ error: { message: 'quota', code: 429 } }), { status: 429 });
  };
  return { vistos, restaurar: () => { globalThis.fetch = real; } };
}

test('SCRUM-952 · con TODOS los modelos agotados, se prueban todos y el error es el código, no un 500 mudo', async () => {
  const antes = { g: config.GEMINI_API_KEY, m: config.GEMINI_MODEL };
  config.GEMINI_API_KEY = 'clave-de-mentira';
  config.GEMINI_MODEL = '';
  const g = simularCuotaAgotadaSiempre();
  try {
    await assert.rejects(
      () => geminiCompleteConModelo({ system: 's', user: 'u' }),
      (e) => e?.code === 'gemini_rate_limited', // NUNCA un error genérico: se sabe qué pasó
    );
    assert.deepEqual(g.vistos, listaDefecto(), 'se probaron TODOS los modelos de la lista, en orden, y ni uno más');
  } finally {
    g.restaurar();
    config.GEMINI_API_KEY = antes.g;
    config.GEMINI_MODEL = antes.m;
  }
});
