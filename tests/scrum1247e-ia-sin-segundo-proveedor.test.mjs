// SCRUM-1247d · SIN CLAVE DE GEMINI NO HAY IA — y no sale nada hacia ningún otro proveedor.
//
// LA DECISIÓN (fundador, 24-oct-2026; SCRUM-1247 c.20779, Q1 «Sí, quitarlo»): se retira de
// `ai.service.ts` el camino a Anthropic que se usaba cuando faltaba GEMINI_API_KEY. La política de
// privacidad sólo nombra a Google (SCRUM-1154): con ese camino, poner ANTHROPIC_API_KEY y quitar la de
// Gemini la dejaba falsa sin que cayera ningún test, porque era configuración y no código.
//
// POR EFECTO, no por texto: cada escenario corre en un proceso hijo con su entorno (la clave se lee al
// cargar `dist/core/config/env.js`, así que no se puede cambiar dentro del mismo proceso) y con `fetch`
// interceptado, que es por donde sale cualquier petición a un proveedor. Se mide qué dice
// `isAiConfigured()`, con qué falla `generateQuoteMessage` (la única función del servicio que llega
// al proveedor sin pasar por la base) y cuántas peticiones de red intentó.
//
// CONTROL POSITIVO: con GEMINI_API_KEY puesta, la misma sonda VE la petición a Google. Sin él, «0
// peticiones» podría ser un interceptor que no intercepta nada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVICIO = pathToFileURL(path.join(RAIZ, 'dist/modules/ai/domain/ai.service.js')).href;

const HIJO = `
const destinos = [];
globalThis.fetch = async (url) => {
  destinos.push(String(url));
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'hola' }] } }] }),
    { status: 200, headers: { 'content-type': 'application/json' } });
};
const ai = await import(${JSON.stringify(SERVICIO)});
let error = null;
try {
  await ai.generateQuoteMessage({ customerName: 'C', merchantName: 'M', concept: 'x', total: '1', currency: 'EUR' });
} catch (e) { error = e?.message ?? String(e); }
console.log('@@' + JSON.stringify({ configurada: ai.isAiConfigured(), error, destinos }));
`;

function escenario(claves) {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', HIJO], {
    cwd: RAIZ,
    env: { ...process.env, GEMINI_API_KEY: '', ANTHROPIC_API_KEY: '', ...claves },
    encoding: 'utf8',
    timeout: 60_000,
  });
  const linea = (r.stdout || '').split('\n').find((l) => l.startsWith('@@'));
  // Sin la línea, el hijo no llegó a medir: eso es CIEGO, no un verde.
  assert.ok(linea, `🔴 CIEGO: el proceso hijo no midió nada (status ${r.status})\n${r.stderr}`);
  return JSON.parse(linea.slice(2));
}

test('SCRUM-1247d · control positivo: con GEMINI_API_KEY, la IA está configurada y la sonda VE la petición a Google', () => {
  const m = escenario({ GEMINI_API_KEY: 'clave-de-prueba-1247d' });
  assert.equal(m.configurada, true);
  assert.ok(m.destinos.length >= 1, `la sonda no vio ninguna petición: el interceptor no mide (${JSON.stringify(m)})`);
  assert.ok(m.destinos.every((u) => /googleapis\.com/.test(u)), `con Gemini, todo va a Google: ${m.destinos.join(', ')}`);
});

test('SCRUM-1247d · 🔴 sin GEMINI_API_KEY y CON ANTHROPIC_API_KEY: «IA no configurada» y CERO peticiones de red', () => {
  const m = escenario({ ANTHROPIC_API_KEY: 'clave-de-prueba-1247d' });
  assert.equal(m.configurada, false, 'con sólo la clave de Anthropic, la IA NO cuenta como configurada (c.20779)');
  assert.equal(m.error, 'ai_not_configured', `tiene que fallar como «no configurada», no como otra cosa: ${m.error}`);
  assert.deepEqual(m.destinos, [], `no puede salir ninguna petición: ${m.destinos.join(', ')}`);
});

test('SCRUM-1247d · sin ninguna clave: «IA no configurada» y cero peticiones (lo de siempre, no cambia)', () => {
  const m = escenario({});
  assert.equal(m.configurada, false);
  assert.equal(m.error, 'ai_not_configured');
  assert.deepEqual(m.destinos, []);
});
