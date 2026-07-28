// scripts/_console-guard.mjs — SCRUM-183
//
// POR QUÉ EXISTE. SCRUM-139 F6 se mergeó ROTA y estuvo así en producción: un `let` de ámbito de
// módulo (`plantillasRotulo`) se leía desde `recalcTotals()` ~1.700 líneas ANTES de su propia
// declaración, o sea dentro de su zona muerta (TDZ). El `ReferenceError` **abortaba el resto del
// render**: la fila de plantillas no se pintaba nunca y el listener de "📋 Usar plantilla" no
// llegaba a engancharse.
//
// Nada lo vio. `npm test` no ejecuta el navegador; `node --check` valida sintaxis, no orden de
// evaluación; y `scripts/e2e-critico.mjs` —que SÍ abre las pantallas de verdad— no escuchaba la
// consola, así que pasó por delante del error sin enterarse. Lo destapó por casualidad el E2E de
// SCRUM-162, al notar que sus propias fichas tampoco aparecían.
//
// La lección: **un error de JS en la página no rompe el E2E si nadie escucha**. Este módulo es la
// oreja, y vive aparte del E2E para poder probarse sin navegador ni BD.

/**
 * Errores de consola TOLERADOS, uno por uno y con su motivo.
 *
 * ALLOWLIST VISIBLE, nunca silenciosa (misma regla que el resto de los guards de la casa): si
 * algo se tolera, se ve aquí y se explica. Una lista vacía es la respuesta correcta por defecto —
 * cada entrada nueva es deuda que alguien tendrá que justificar en revisión.
 */
export const CONSOLA_ALLOWLIST = [
  // Favicon ausente en el server de test: ruido del navegador, no de la aplicación.
  { patron: /favicon\.ico/i, porque: 'el server de e2e no sirve favicon; no es un fallo de la app' },
  // El service worker no se registra contra 127.0.0.1 sin HTTPS en algunos motores.
  { patron: /ServiceWorker|sw\.js/i, porque: 'el SW no aplica en el entorno de e2e (sin HTTPS)' },
];

/**
 * ¿Este mensaje de consola delata un fallo REAL de la aplicación?
 *
 * Solo cuenta `error`: los `warning` son ruido legítimo en un producto vivo y convertirlos en
 * fallo entrenaría a ignorar el guard entero, que es cómo mueren los guards.
 */
export function esErrorRelevante(msg) {
  if (!msg || typeof msg !== 'object') return false;
  if (msg.tipo !== 'error') return false;
  const texto = String(msg.texto || '');
  if (!texto.trim()) return false;
  return !CONSOLA_ALLOWLIST.some((e) => e.patron.test(texto));
}

/**
 * Resume lo recogido durante el recorrido y decide si el E2E debe fallar.
 *
 * Devuelve el mensaje ya montado en vez de lanzar: quien decide abortar es el E2E, y así esta
 * función se puede probar sin navegador.
 */
export function resumirErroresConsola(mensajes) {
  const relevantes = (Array.isArray(mensajes) ? mensajes : []).filter(esErrorRelevante);
  if (relevantes.length === 0) return { ok: true, relevantes: [], informe: '' };

  const informe =
    `\n🔴 ${relevantes.length} error(es) de JS en la PÁGINA durante el recorrido:\n` +
    relevantes.map((m) => `   · [${m.donde || 'desconocido'}] ${m.texto}`).join('\n') +
    '\n\nUn ReferenceError en el navegador aborta el render sin que la petición falle: la pantalla\n' +
    'se queda a medias y el E2E sigue adelante tan contento. Así llegó SCRUM-139 F6 a producción.\n';
  return { ok: false, relevantes, informe };
}
