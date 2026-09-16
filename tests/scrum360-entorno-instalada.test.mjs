// tests/scrum360-entorno-instalada.test.mjs — SCRUM-360 (H5 · fase 1)
//
// ¿ESTÁ LA APLICACIÓN INSTALADA EN LA PANTALLA DE INICIO?
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTE DATO Y NO OTRO
//
// iOS borra el origen entero —service worker, caché e IndexedDB— tras 7 días sin abrir la
// aplicación, y con él se llevaría una firma pendiente de subir. **Las aplicaciones añadidas a la
// pantalla de inicio están EXENTAS; una pestaña normal, no.** Así que la mitigación de H5 no es
// código: es que la aplicación esté instalada. Y hoy no sabemos en cuántos lo está.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 TRES ESTADOS, Y ÉSE ES EL SUELO DE ESTE FICHERO
//
// «No está instalada» y «no supe mirar» son lo CONTRARIO: el primero dice que hay riesgo, el
// segundo no dice nada. Un booleano los colapsa y produce un recuento tranquilo y falso — parecería
// que sabemos que N están en pestaña cuando no pudimos preguntárselo a nadie.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_JS = path.join(RAIZ, 'public/dashboard/js');

/**
 * Carga el dashboard y le pone el entorno del navegador que se quiera simular.
 *
 * `matchMedia` y `navigator.standalone` se sustituyen ANTES de leer, porque son justo las dos
 * vías que la función consulta.
 */
function conEntorno({ standaloneMedia = false, legacy = undefined, sinMatchMedia = false } = {}) {
  const b = cargarDashboard(RAIZ);
  if (sinMatchMedia) delete b.ctx.matchMedia;
  else b.ctx.matchMedia = (q) => ({ matches: /display-mode:\s*standalone/.test(q) && standaloneMedia });
  b.ctx.navigator = { ...b.ctx.navigator };
  if (legacy === undefined) delete b.ctx.navigator.standalone;
  else b.ctx.navigator.standalone = legacy;
  return b.ctx;
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-360 · 🔴 SUELO: la función existe y está publicada, o esto no mide nada', () => {
  const ctx = conEntorno();
  assert.equal(typeof ctx.entornoDeLaApp, 'function',
    '🔴 `entornoDeLaApp` no está publicada en `window`. Toda la fase 1 se apoya en poder leerla ' +
    'desde fuera del fichero donde vive.');
  for (const c of ['ENTORNO_INSTALADA', 'ENTORNO_PESTANA', 'ENTORNO_DESCONOCIDO']) {
    assert.equal(typeof ctx[c], 'string', `🔴 falta la constante ${c}.`);
  }
  assert.equal(new Set([ctx.ENTORNO_INSTALADA, ctx.ENTORNO_PESTANA, ctx.ENTORNO_DESCONOCIDO]).size, 3,
    '🔴 dos de los tres estados valen lo mismo: entonces no son tres.');
});

// ── CONTROL POSITIVO, LOS DOS POR SEPARADO ───────────────────────────────────────────────

test('SCRUM-360 · ✅ INSTALADA por `display-mode: standalone` (el estándar)', () => {
  const ctx = conEntorno({ standaloneMedia: true });
  assert.equal(ctx.entornoDeLaApp(), ctx.ENTORNO_INSTALADA);
});

test('SCRUM-360 · ✅ INSTALADA por `navigator.standalone` — la vía de Safari en iPhone', () => {
  // Sin esta vía, un iPhone instalado se contaría como pestaña. Y el iPhone es el caso peor
  // medido en H0: es justo el aparato que sufre el borrado a los 7 días.
  const ctx = conEntorno({ standaloneMedia: false, legacy: true });
  assert.equal(ctx.entornoDeLaApp(), ctx.ENTORNO_INSTALADA,
    '🔴 un iPhone con la app instalada se está contando como pestaña: `navigator.standalone` es la ' +
    'única vía que responde en Safari, y sin ella el recuento sale al revés justo donde importa.');
});

test('SCRUM-360 · ✅ PESTAÑA cuando SÍ se pudo evaluar y la respuesta es no', () => {
  const ctx = conEntorno({ standaloneMedia: false, legacy: false });
  assert.equal(ctx.entornoDeLaApp(), ctx.ENTORNO_PESTANA);
});

// ── 🔴 EL SUELO QUE IMPORTA: NO SE PUEDE EVALUAR ≠ PESTAÑA ───────────────────────────────

test('SCRUM-360 · 🔴 sin ninguna vía consultable NO se dice «pestaña», se dice DESCONOCIDO', () => {
  const ctx = conEntorno({ sinMatchMedia: true, legacy: undefined });
  assert.equal(ctx.entornoDeLaApp(), ctx.ENTORNO_DESCONOCIDO,
    '🔴 SE ESTÁ REGISTRANDO «pestaña» SIN HABER PODIDO MIRAR. «No está instalada» dice que hay ' +
    'riesgo de perder una firma; «no supe mirar» no dice nada. Confundirlos da un recuento ' +
    'tranquilo y falso, que es peor que no tener recuento.');
});

test('SCRUM-360 · una sola vía disponible basta para contestar', () => {
  // Con `matchMedia` pero sin `navigator.standalone`: se puede evaluar, así que NO es desconocido.
  const soloMedia = conEntorno({ standaloneMedia: false, legacy: undefined });
  assert.equal(soloMedia.entornoDeLaApp(), soloMedia.ENTORNO_PESTANA);
  // Y al revés: sin `matchMedia` pero con la vía legacy.
  const soloLegacy = conEntorno({ sinMatchMedia: true, legacy: false });
  assert.equal(soloLegacy.entornoDeLaApp(), soloLegacy.ENTORNO_PESTANA);
});

// ── EL NEGATIVO: LA VOZ SIGUE COMPORTÁNDOSE IGUAL ────────────────────────────────────────

test('SCRUM-360 · NEGATIVO: sacar la función de la IIFE no cambia la entrada de voz', () => {
  // `voiceInput` apaga el dictado en iOS instalado, donde la API está declarada pero rota. Ese
  // comportamiento tiene que sobrevivir a la extracción, incluido el caso «no se pudo evaluar»,
  // que antes daba `false` y tiene que seguir dándolo.
  const src = fs.readFileSync(path.join(DIR_JS, 'voiceInput.js'), 'utf8');
  assert.match(src, /isStandalonePWA\(\)\s*\{[\s\S]*?window\.entornoDeLaApp/,
    '🔴 `voiceInput` ya no delega en la función compartida.');
  assert.match(src, /if \(isIOS\(\) && isStandalonePWA\(\)\) return false;/,
    '🔴 la regla de «iOS instalado apaga el dictado» ha desaparecido de `voiceSupportProbe`.');

  // Y el caso que no puede cambiar de resultado: sin poder evaluar, sigue siendo `false`.
  const ctx = conEntorno({ sinMatchMedia: true, legacy: undefined });
  assert.equal(ctx.entornoDeLaApp(), ctx.ENTORNO_DESCONOCIDO);
  assert.notEqual(ctx.ENTORNO_DESCONOCIDO, ctx.ENTORNO_INSTALADA,
    '🔴 «desconocido» está contando como instalada: el dictado se apagaría sin motivo.');
});

// ── NO SE HA DUPLICADO NADA ──────────────────────────────────────────────────────────────

test('SCRUM-360 · 🔴 la detección vive en UN SOLO sitio', () => {
  // El defecto que llevamos toda la semana persiguiendo: sacar algo a un sitio compartido y
  // dejarse la copia dentro. Se cuenta sobre el árbol, no de palabra.
  const conDeteccion = [];
  for (const f of fs.readdirSync(DIR_JS).filter((x) => x.endsWith('.js'))) {
    const s = fs.readFileSync(path.join(DIR_JS, f), 'utf8');
    // Sólo el código: un comentario que MENCIONE la vía no es una segunda detección.
    const soloCodigo = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    if (/display-mode:\s*standalone|navigator\.standalone/.test(soloCodigo)) conDeteccion.push(f);
  }
  assert.deepEqual(conDeteccion, ['api.js'],
    `🔴 la detección aparece en ${conDeteccion.length} ficheros: ${conDeteccion.join(', ')}. ` +
    'Dos detecciones del mismo hecho derivan en silencio — es el defecto que SCRUM-436 y SCRUM-447 ' +
    'acaban de cerrar con los formateadores de euros.');
});
