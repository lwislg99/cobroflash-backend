// tests/scrum1247d-ia-no-disponible.test.mjs — SCRUM-1247d
//
// Sin gate: abre el modal «Sugerir con IA» en el banco de vistas con la red doblada. Ni BD, ni red real.
//
// Cuando la ruta contesta `ai_not_configured`, el modal le decía al profesional «La IA no está configurada.
// Añade GEMINI_API_KEY (gratis) en Railway.»: una instrucción de operador que además nombra al proveedor.
// Firma del fundador, SCRUM-1247 c.20779 (Q2, «FIRMADO (regla 39), literal»), que lo sustituye en
// `aiQuoteAssistant.js:74`:
//   «El asistente de IA no está disponible ahora mismo. Rellena las líneas a mano.»
// Se mide POR EFECTO: se pulsa «Generar sugerencias» y se lee el aviso PINTADO, no el fuente.
//   ① con `ai_not_configured` sale el texto firmado, y ni «GEMINI», ni «Railway»;
//   ② CONTROL: con otro fallo (502 `ai_provider_error`) sale el genérico, no el firmado — si el banco
//      pintara el firmado para cualquier error, ① no distinguiría nada.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard } from './_banco-vistas.mjs';

// El catálogo del meta-guard (`scripts/meta-guard-mutaciones.mjs`, SCRUM-1387).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'public/dashboard/js/aiQuoteAssistant.js',
    de: "        ? 'El asistente de IA no está disponible ahora mismo. Rellena las líneas a mano.'\n        : 'Error al generar sugerencias. Inténtalo de nuevo.';",
    a: "        ? 'La IA no está configurada. Añade GEMINI_API_KEY (gratis) en Railway.'\n        : 'Error al generar sugerencias. Inténtalo de nuevo.';",
    cae: 'SCRUM-1247d ① ·',
  },
  {
    fichero: 'public/dashboard/js/aiQuoteAssistant.js',
    de: "      const msg = err?.data?.error === 'ai_not_configured'\n        ? 'El asistente",
    a: "      const msg = err?.data?.error === 'ai_no_configurada'\n        ? 'El asistente",
    cae: 'SCRUM-1247d ① ·',
  },
];

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIRMADO = 'El asistente de IA no está disponible ahora mismo. Rellena las líneas a mano.';
const GENERICO = 'Error al generar sugerencias. Inténtalo de nuevo.';

const respirar = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };

/** Abre el modal, escribe una descripción, pulsa «Generar» y devuelve el texto del aviso pintado. */
async function avisoCon(status, cuerpo) {
  const pedidas = [];
  const fetch = async (url) => {
    const u = String(url);
    if (/\/admin\/ai\/suggest-quote$/.test(u)) pedidas.push(u);
    return {
      ok: false, status,
      headers: { get: () => 'application/json' },
      json: async () => cuerpo, text: async () => JSON.stringify(cuerpo),
    };
  };
  const b = cargarDashboard(RAIZ, {
    rol: 'admin',
    red: { navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } }, fetch },
  });
  assert.equal(typeof b.ctx.openAiSuggestModal, 'function', '🔴 NO PUDE MIRAR: el banco no carga `openAiSuggestModal`.');
  b.ctx.openAiSuggestModal(() => {});
  const doc = b.ctx.document;
  const ta = doc.querySelector('#ai-description');
  const btn = doc.querySelector('#ai-suggest-btn');
  const alerta = doc.querySelector('#ai-alert');
  assert.ok(ta && btn && alerta, '🔴 NO PUDE MIRAR: el modal no tiene descripción, botón o aviso en el banco.');
  ta.value = 'Cambiar el grifo de la cocina';
  await btn.onclick();
  await respirar();
  assert.equal(pedidas.length, 1, `🔴 NO PUDE MIRAR: pulsar «Generar» hizo ${pedidas.length} peticiones a suggest-quote, no 1.`);
  return String(alerta.textContent || '');
}

test('SCRUM-1247d ① · sin IA configurada, el profesional lee el texto FIRMADO (c.20779), sin proveedor ni Railway', async () => {
  const aviso = await avisoCon(503, { error: 'ai_not_configured', message: 'El asistente de IA no está configurado. Añade GEMINI_API_KEY (gratis) en Railway.' });
  assert.equal(aviso, FIRMADO, `🔴 el aviso no es el firmado en SCRUM-1247 c.20779: «${aviso}».`);
  assert.doesNotMatch(aviso, /GEMINI|Railway/i, `🔴 el aviso le sigue hablando de la clave o de Railway: «${aviso}».`);
});

test('SCRUM-1247d ② · CONTROL: otro fallo (502) da el genérico, NO el firmado', async () => {
  const aviso = await avisoCon(502, { error: 'ai_provider_error', message: 'La IA no respondió bien. Inténtalo de nuevo en un momento.' });
  assert.equal(aviso, GENERICO, `🔴 NO PUDE MIRAR: con un 502 el aviso no es el genérico: «${aviso}».`);
});
