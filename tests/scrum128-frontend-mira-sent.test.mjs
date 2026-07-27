import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = path.join(raiz, 'public', 'dashboard', 'js');

/**
 * SCRUM-128 · CAPA (a) — que nadie consuma una respuesta de envío sin mirar `sent`.
 *
 * El censo del BACKEND (SCRUM-126/128) garantiza que los 9 endpoints de envío devuelven
 * `{ok:true, sent:false, message}` cuando el envío FALLA pero la operación no. El agujero que
 * queda es el otro extremo: un `if (res.ok)` en el frontend da por enviado algo que no salió, y
 * el usuario ve "enviado" cuando no se ha enviado nada. Eso es exactamente la clase de mentira
 * que SCRUM-114/115/116/117 vinieron a cerrar en el backend.
 *
 * RATCHET, estilo SCRUM-113: la lista de pendientes SOLO MENGUA. Un call-site NUEVO que no mire
 * `sent` no se aparca aquí: se arregla. La lista es para lo que ya existía el día que se escribió
 * este guard, no para lo que se escriba mañana.
 *
 * Por qué ESTRUCTURAL y no e2e: la capa (b) —Playwright comprobando la UI de verdad— quedó
 * DIFERIDA con gate escrito en el ticket (se reconsidera si aparece un endpoint de envío nuevo o
 * si algo se cuela pese a esta capa). Esta es la barata.
 */

// Fragmentos de ruta que identifican una llamada de ENVÍO desde el frontend. Derivados de
// SEND_ENDPOINTS_DECLARED; se listan como texto porque el frontend es vanilla y construye las
// URLs con plantillas (`/admin/albaranes/${id}/enviar-whatsapp`), no importa el módulo.
const RUTAS_DE_ENVIO = [
  'enviar-whatsapp',
  'enviar-para-firmar',
  'resend-whatsapp',
  'send-reminder',
  'send-email',
  'send-whatsapp',
  'collect-rest',
];

// Cuántas líneas después de la llamada se acepta que aparezca la comprobación. Generoso a
// propósito: entre el `fetch` y la comprobación hay un `await res.json()`, el bloque de
// `!res.ok` con su mapa de errores, y solo después la rama del envío.
const VENTANA = 30;

/**
 * QUÉ CUENTA COMO "comprobar `sent`". Los tres, no solo el literal.
 *
 * La primera versión de este censo buscaba únicamente la palabra `sent` y marcó como
 * incumplidor a `quotesDetailView.js:send-whatsapp`, que SÍ comprueba — lo hace a través del
 * helper `waSendFailed(data)` (`api.js:149`, que es literalmente `result.sent === false`),
 * cuyo nombre no contiene "sent". Un censo que cuenta mal es peor que no tener censo, y lo
 * cazó revisar un call-site a mano, no el propio guard.
 */
const COMPRUEBA = /waSendFailed\s*\(|waCollectRestSent\s*\(|\bsent\b/;

/**
 * PENDIENTES — call-sites que HOY no miran `sent`, con su ticket.
 * Formato: 'fichero.js:fragmento'. Este número solo puede BAJAR.
 */
const PENDIENTES = [
  // Estado el 27-jul-2026, día en que se escribió este censo. Son los call-sites que la
  // heurística marca HOY; se declaran para que el ratchet nazca en verde y bloquee lo NUEVO.
  //
  // ⚠️ NO están verificados uno a uno. La heurística ya produjo un falso positivo comprobado
  // (`quotesDetailView.js:send-whatsapp` comprueba vía `waSendFailed`, y la primera versión
  // del censo lo acusaba), así que alguno de estos puede estarlo también. Aquí eso es
  // INOFENSIVO: un pendiente de más solo sobra en la lista; lo que el ratchet impide es que
  // aparezca uno NUEVO. Quien arregle o descarte cada uno, que lo borre de aquí.
  // Los TRES son la misma forma: `onEmail: () => apiRequest('.../send-email', ...)` — un
  // callback que se le pasa a un helper de UI y que no mira el resultado en el call-site.
  // Verificados uno a uno el 27-jul-2026.
  'invoiceDetailView.js:send-email',
  'jobDetailView.js:send-email',
  'quotesDetailView.js:send-email',
  // RETIRADOS (ya comprueban, verificado línea a línea):
  //  · jobDetailView.js:resend-whatsapp → `if (waSendFailed(d))`  (jobDetailView.js:1210)
  //  · jobDetailView.js:send-reminder   → `if (d && d.sent === false)` (jobDetailView.js:229)
  // Los arregló otra sesión mientras se escribía este censo. El ratchet los delató en el CI
  // en cuanto la lista dejó de cuadrar con el árbol — que es exactamente su trabajo.
];
const PENDIENTES_MAX = PENDIENTES.length;

function ficherosJs() {
  return fs.readdirSync(JS).filter((f) => f.endsWith('.js')).sort();
}

function censar() {
  const sinComprobar = [];
  const total = [];
  for (const f of ficherosJs()) {
    // ⚠️ Se NORMALIZAN los finales de línea antes de nada. La primera versión hacía
    // `split('\n')` a secas y quitaba comentarios con `/\/\/.*$/`: en un checkout de Windows
    // (CRLF) cada línea acaba en `\r`, `.` no cruza un retorno de carro y `$` solo casa al
    // final de la CADENA, así que el reemplazo NO ocurría y los comentarios se contaban como
    // llamadas. En Linux (LF) sí se quitaban. Resultado: verde en local, ROJO en el CI, con
    // el ratchet acusando pendientes "ya arreglados" que en realidad eran comentarios.
    // El censo contaba mal, que es peor que no censar.
    const lineas = fs.readFileSync(path.join(JS, f), 'utf8').replace(/\r/g, '').split('\n');
    for (let i = 0; i < lineas.length; i++) {
      // Una línea que MENCIONA la ruta en un comentario no es una llamada.
      const linea = lineas[i].replace(/\/\/.*/, '');
      const ruta = RUTAS_DE_ENVIO.find((r) => linea.includes(r));
      if (!ruta) continue;
      const clave = `${f}:${ruta}`;
      total.push(clave);
      const ventana = lineas.slice(i, i + VENTANA).join('\n');
      if (!COMPRUEBA.test(ventana)) sinComprobar.push(clave);
    }
  }
  return { total, sinComprobar };
}

test('SCRUM-128: el censo ENCUENTRA llamadas de envío (guarda de presencia)', () => {
  // Sin esto, el guard de abajo pasaría en vacío el día que alguien mueva los ficheros o cambie
  // cómo se construyen las URLs — indistinguible de "todo correcto".
  const { total } = censar();
  assert.ok(
    total.length >= 5,
    `el censo solo ve ${total.length} llamadas de envío en el frontend; o se movieron los ficheros o cambió cómo se arman las URLs. ACTUALIZA este guard, no lo borres.`
  );
});

test('SCRUM-128: toda llamada de envío del frontend comprueba `sent`', () => {
  const { sinComprobar } = censar();
  const nuevos = sinComprobar.filter((c) => !PENDIENTES.includes(c));
  assert.deepEqual(
    nuevos, [],
    `\n\n🔴 Llamada(s) a un endpoint de ENVÍO sin mirar \`sent\` en las ${VENTANA} líneas siguientes:\n` +
    nuevos.map((c) => `   · ${c}`).join('\n') +
    '\n\nEl backend devuelve `{ok:true, sent:false, message}` cuando el envío falla y la operación\n' +
    'no: un `if (res.ok)` da por enviado algo que no salió y se lo dice al usuario. Comprueba\n' +
    '`sent` y enseña `message` cuando sea false.\n'
  );
});

test('SCRUM-128: la lista de pendientes solo MENGUA (ratchet)', () => {
  const { sinComprobar } = censar();
  const vivos = PENDIENTES.filter((c) => sinComprobar.includes(c));
  assert.ok(
    PENDIENTES.length <= PENDIENTES_MAX,
    'la lista de pendientes ha crecido: un call-site nuevo se arregla, no se aparca'
  );
  assert.deepEqual(
    PENDIENTES.filter((c) => !sinComprobar.includes(c)), [],
    'hay pendientes ya arreglados que siguen en la lista: bórralos para que el ratchet baje de verdad'
  );
  assert.equal(vivos.length, PENDIENTES.length);
});
