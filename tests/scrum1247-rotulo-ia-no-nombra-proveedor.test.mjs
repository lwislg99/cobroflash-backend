// tests/scrum1247-rotulo-ia-no-nombra-proveedor.test.mjs — SCRUM-1247
//
// EL ASISTENTE «SUGERIR CON IA» LE DECÍA AL PROFESIONAL QUE ESCRIBE CLAUDE, Y POR DEFECTO ESCRIBE
// GEMINI (GOOGLE). No es un error de marca: el rótulo le dice a qué empresa van su presupuesto y
// lo que escriba de su cliente. Medido por J4 ejecutando `aiComplete` con dobles, 9 escenarios
// (docs/master/SCRUM-1247.md §1): con `GEMINI_API_KEY` puesta, siempre Google.
//
// La opción firmada (A, SCRUM-1247 comentario 17425) no nombra la marca: dice QUÉ sale y que sale
// fuera. Así no se desfasa si mañana cambia la clave.
//
// Dos ranuras vivas, y solo esas dos:
//   · R1 · el párrafo del modal «Sugerir con IA» (`aiQuoteAssistant.js`, `openAiSuggestModal`).
//   · R2 · el `title` del botón «✨ Sugerir con IA» (`quotesView.js`).
// ⛔ La tercera, «Claude redactará…» del modal de mensaje, NO es de este ticket: ese modal no lo
// abre ninguna pantalla (SCRUM-1182) y su texto no está firmado. Por eso este test mira el PRIMER
// modal por su función, no el fichero entero: si mirase el fichero, caería por una ranura ajena.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { constaAprobado } from './_microcopy-aprobada.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

const R1 = 'Describe el trabajo con tus propias palabras y la IA te sugerirá las líneas del presupuesto usando tu catálogo. Lo que escribas aquí y tu catálogo se envían a nuestro proveedor de IA (lo tienes en la política de privacidad); no incluyas datos de tu cliente que no hagan falta.';
const R2 = 'Describe el trabajo y la IA te sugiere las líneas del presupuesto';

/** El cuerpo de `openAiSuggestModal`, hasta donde empieza el modal del mensaje (SCRUM-1182). */
function modalDeLineas() {
  const src = leer('public/dashboard/js/aiQuoteAssistant.js');
  const i = src.indexOf('function openAiSuggestModal(');
  const f = src.indexOf('function openAiMessageModal(');
  assert.ok(i >= 0 && f > i,
    '🔴 no encuentro openAiSuggestModal seguido de openAiMessageModal: el test miraría el vacío');
  return src.slice(i, f);
}

/**
 * El párrafo de ayuda del modal (el primer `<p` del cuerpo), con los espacios de la plantilla
 * colapsados. Sin el `>` pegado a un atributo (SCRUM-553): no se rompe si el `<p` gana una clase.
 */
function parrafoR1() {
  const m = modalDeLineas().match(/<p\b[^>]*>\s*([\s\S]*?)\s*<\/p>/);
  assert.ok(m, '🔴 no encuentro el párrafo de ayuda del modal «Sugerir con IA»');
  return m[1].replace(/\s+/g, ' ').trim();
}

function tituloR2() {
  const m = leer('public/dashboard/js/quotesView.js').match(/aiBtn\.title = "([^"]*)"/g) || [];
  assert.equal(m.length, 1, `🔴 esperaba UNA asignación de aiBtn.title y hay ${m.length}`);
  return m[0].slice('aiBtn.title = "'.length, -1);
}

test('SCRUM-1247 · R1 · el modal «Sugerir con IA» pinta el texto firmado en 17425', () => {
  assert.equal(parrafoR1(), R1);
});

test('SCRUM-1247 · R2 · el tooltip del botón pinta el texto firmado en 17425', () => {
  assert.equal(tituloR2(), R2);
});

test('SCRUM-1247 · ninguna de las dos ranuras nombra a un proveedor', () => {
  for (const [ranura, texto] of [['R1', parrafoR1()], ['R2', tituloR2()]]) {
    assert.doesNotMatch(texto, /Claude|Anthropic|Gemini|Google/i,
      `🔴 ${ranura} vuelve a nombrar la marca: «${texto}»`);
  }
  // Control positivo: el mismo patrón SÍ caza el texto viejo.
  assert.match('Describe el trabajo y Claude sugiere las líneas del presupuesto',
    /Claude|Anthropic|Gemini|Google/i);
});

test('SCRUM-1247 · los dos literales constan aprobados en docs/microcopy/', () => {
  for (const t of [R1, R2]) {
    const donde = constaAprobado(t);
    assert.ok(donde.some((r) => /2026-09-28-SCRUM-1247-/.test(r)),
      `🔴 «${t.slice(0, 40)}…» no consta en el registro de SCRUM-1247 (consta en: ${donde.join(', ') || 'ninguno'})`);
  }
});
