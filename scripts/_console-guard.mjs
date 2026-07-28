// scripts/_console-guard.mjs — SCRUM-183, endurecido en SCRUM-184
//
// POR QUÉ EXISTE. SCRUM-139 F6 se mergeó ROTA y estuvo así en producción: un `let` de ámbito de
// módulo (`plantillasRotulo`) se leía desde `recalcTotals()` ~1.700 líneas ANTES de su propia
// declaración, o sea dentro de su zona muerta (TDZ). El `ReferenceError` **abortaba el resto del
// render**: la fila de plantillas no se pintaba nunca y el listener de "📋 Usar plantilla" no
// llegaba a engancharse. Nada lo vio: `npm test` no ejecuta el navegador, `node --check` valida
// sintaxis (no orden de evaluación) y el E2E no escuchaba la consola.
//
// ── LO QUE CORRIGE SCRUM-184 ─────────────────────────────────────────────────────────────────
//
// La primera versión mezclaba dos cosas que no son la misma, y por eso fallaba en las dos
// direcciones a la vez:
//
//   · UN ERROR DE JS aborta el render. Es el fallo que este guard nació para cazar y tiene que
//     ROMPER el E2E.
//   · UN RECURSO QUE NO CARGA (404 de un .png, un .css) no aborta nada: la página sigue viva y
//     un poco peor. Merece salir en el informe, no tumbar el recorrido — un guard que se dispara
//     con ruido se acaba ignorando, y entonces tampoco caza lo grave.
//
// Y había una trampa peor: la allowlist llevaba una entrada `/favicon\.ico/i` que **no podía
// filtrar nada**. El mensaje que Chrome manda a la consola por un subrecurso caído es
// `Failed to load resource: the server responded with a status of 404` **sin la URL**; lo único
// que traía el registro era la página, no el fichero. La entrada aparentaba cubrir un caso que
// era incapaz de reconocer: vocabulario declarado, mecanismo ausente — dentro del propio guard.
// Se retira. La identidad del recurso ya NO se adivina del texto: la aporta el E2E desde los
// eventos de red (`response` con status ≥ 400 / `requestfailed`), que sí saben qué URL falló.
export const CONSOLA_ALLOWLIST = [
  // El service worker no se registra contra 127.0.0.1 sin HTTPS en algunos motores.
  { patron: /ServiceWorker|sw\.js/i, porque: 'el SW no aplica en el entorno de e2e (sin HTTPS)' },
];

/** Texto con el que el navegador anuncia un subrecurso caído (sin decir cuál). */
const TEXTO_RECURSO = /Failed to load resource|net::ERR_|the server responded with a status of/i;

/**
 * Clasifica un registro recogido durante el recorrido.
 *   'js'       → error de JavaScript: rompe el render, ROMPE el E2E.
 *   'recurso'  → carga fallida: se informa, no rompe.
 *   'ignorado' → allowlist o ruido no accionable.
 */
export function clasificar(msg) {
  if (!msg || typeof msg !== 'object') return 'ignorado';
  if (msg.tipo === 'recurso') return 'recurso'; // viene de los eventos de red, ya identificado
  if (msg.tipo !== 'error') return 'ignorado';
  const texto = String(msg.texto || '');
  if (!texto.trim()) return 'ignorado';
  if (CONSOLA_ALLOWLIST.some((e) => e.patron.test(texto))) return 'ignorado';
  return TEXTO_RECURSO.test(texto) ? 'recurso' : 'js';
}

/** Compatibilidad: «¿este mensaje delata un fallo de JS?» (lo que antes decidía todo). */
export function esErrorRelevante(msg) {
  return clasificar(msg) === 'js';
}

/**
 * Resume lo recogido y decide si el E2E debe fallar.
 *
 * Devuelve el informe montado en vez de lanzar: quien decide abortar es el E2E, y así esto se
 * puede probar sin navegador. **Solo los errores de JS ponen `ok:false`**; los recursos caídos
 * viajan en `avisoRecursos` para que se vean —con su URL— sin tumbar el recorrido.
 */
export function resumirErroresConsola(mensajes) {
  const lista = Array.isArray(mensajes) ? mensajes : [];
  const js = lista.filter((m) => clasificar(m) === 'js');
  const recursos = lista.filter((m) => clasificar(m) === 'recurso');

  const avisoRecursos = recursos.length
    ? `\n⚠️  ${recursos.length} recurso(s) que no cargan (no rompen el render, pero el cliente los ve en su consola):\n` +
      recursos.map((m) => `   · ${m.url || m.texto}${m.status ? ` → ${m.status}` : ''} [en ${m.donde || 'desconocido'}]`).join('\n') + '\n'
    : '';

  if (js.length === 0) return { ok: true, relevantes: [], recursos, avisoRecursos, informe: '' };

  const informe =
    `\n🔴 ${js.length} error(es) de JS en la PÁGINA durante el recorrido:\n` +
    js.map((m) => `   · [${m.donde || 'desconocido'}] ${m.texto}`).join('\n') +
    '\n\nUn ReferenceError en el navegador aborta el render sin que la petición falle: la pantalla\n' +
    'se queda a medias y el E2E sigue adelante tan contento. Así llegó SCRUM-139 F6 a producción.\n' +
    avisoRecursos;
  return { ok: false, relevantes: js, recursos, avisoRecursos, informe };
}
