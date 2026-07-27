// tests/scrum128-frontend-census.test.mjs — SCRUM-128, capa (a) del frontend
//
// Capa BARATA del guard de envíos (la otra mitad, backend, es
// sendEndpointDeclarations.ts + su test — SCRUM-128 paso b·backend, ya mergeado).
// Censo de ficheros public/dashboard/js/*.js que llaman a alguna de las 8 rutas de
// envío y falla si aparece un fichero NUEVO que hace la llamada sin comprobar el
// resultado (waSendFailed/waCollectRestSent, o un `.sent` explícito) en las líneas
// siguientes — el patrón exacto del botón roto que SCRUM-115/126 encontraron a mano.
//
// LÍMITE HONESTO (mismo criterio que el censo de SCRUM-113 con el suyo, y que
// sendEndpointDeclarations.ts con el backend): esta heurística detecta LO OBVIO —
// una llamada nueva que nunca mira el resultado en su vecindad inmediata. NO detecta
// indirección real: un helper compartido que sí mira `sent` pero más lejos de lo que
// la ventana de líneas explora (el caso histórico: waFallbackBar antes de
// centralizarse). La capa que cierra la clase de verdad es la (b) — Playwright/
// puppeteer contra el DOM — DELIBERADAMENTE DIFERIDA (decisión del fundador,
// 24-jul-2026): se reconsidera SI aparece un endpoint de envío nuevo, o SI algo se
// cuela pese a esta capa. No antes, y no por inercia.
//
// SIN GATE: solo lee ficheros de public/dashboard/js/. No toca BD ni compila nada.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath y no url.pathname: la ruta del repo puede llevar espacios (SCRUM-113).
const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(REPO_ROOT, 'public', 'dashboard', 'js');

// Mismos 8 endpoints que SEND_ENDPOINTS_DECLARED (src/core/http/sendEndpointDeclarations.ts,
// SCRUM-128 backend). No se importa de ahí — ese vive en dist/, compilado de TS; este censo
// es JS puro de public/, sin paso de build — se repite el fragmento de URL a propósito.
// Colección INDEPENDIENTE de la del backend: si un día divergen, es una señal en sí misma,
// no un bug de este fichero.
const SEND_URL_FRAGMENTS = [
  'enviar-whatsapp', 'enviar-para-firmar', 'resend-whatsapp',
  'send-reminder', 'send-email', 'send-whatsapp', 'collect-rest',
];

/** Una línea que MENCIONA una de las 8 rutas — llamada real o comentario, sin distinguir aún. */
const MENCIONA_RUTA_DE_ENVIO = new RegExp(`\\b(${SEND_URL_FRAGMENTS.join('|')})\\b`);

/** Comentario de línea. Una mención dentro de un comentario no es una llamada. */
const ES_COMENTARIO = /^\s*\/\//;

/**
 * El resultado se mira: el helper compartido de api.js (waSendFailed/waCollectRestSent,
 * SCRUM-126) o un acceso directo a `.sent`. Deliberadamente amplio — más falsos negativos
 * de "esto es un chequeo" que al revés no ayuda a nadie; lo que importa es no dejar pasar
 * una llamada que NO mira nada.
 */
const MIRA_EL_RESULTADO = /waSendFailed\(|waCollectRestSent\(|\.sent\b/;

/**
 * INDIRECCIÓN CONOCIDA Y VERIFICADA (no una excusa genérica): la clave `onEmail:` de un
 * objeto pasado a `waFallbackBar(...)` (api.js) es SIEMPRE un callback cuyo resultado
 * revisa la propia `waFallbackBar` — `if (waSendFailed(result)) throw ...` (api.js, línea
 * ~192) — no el call-site que lo declara. Es el patrón exacto que SCRUM-115 arregló
 * CENTRALIZANDO el chequeo ahí: exigir OTRO chequeo en cada `onEmail:` sería pedir que se
 * deshaga esa centralización. Confirmado a mano en los 4 usos actuales (invoiceDetailView.js
 * ×2, jobDetailView.js, quotesDetailView.js) antes de escribir esta excepción — no se acepta
 * a ciegas. Si `waFallbackBar` deja de comprobar `sent`, este censo no lo vería: esa garantía
 * la da la capa (b), no esta.
 */
const ES_CALLBACK_ONEMAIL = /\bonEmail\s*:/;

/** Líneas de código tras la llamada donde se admite que viva el chequeo. */
const VENTANA = 20;

/** Devuelve los números de línea (1-indexado) de llamadas a una ruta de envío SIN chequeo cercano. */
function llamadasSinMirar(contenido) {
  const lineas = contenido.split('\n');
  const sospechosas = [];
  lineas.forEach((linea, i) => {
    if (ES_COMENTARIO.test(linea)) return;
    if (!MENCIONA_RUTA_DE_ENVIO.test(linea)) return;
    // `onEmail:` suele quedar 1-2 líneas ARRIBA de la llamada (el ternario condicional
    // parte la propiedad de su valor): `onEmail: cond\n  ? () => apiRequest(...)`.
    const contexto = lineas.slice(Math.max(0, i - 3), i + 1).join('\n');
    if (ES_CALLBACK_ONEMAIL.test(contexto)) return;
    const ventana = lineas.slice(i, i + VENTANA).join('\n');
    if (!MIRA_EL_RESULTADO.test(ventana)) sospechosas.push(i + 1);
  });
  return sospechosas;
}

/**
 * CENSO DE CALIBRACIÓN — los ficheros que llaman a alguna de las 8 rutas cuando se midió
 * (24-jul-2026, tras retirar sendQuoteWhatsApp de api.js — wrapper muerto, cero llamadores,
 * que el detector marcaba sin poder distinguir "código muerto" de "bug real"). Los 7 están
 * limpios hoy: cada llamada mira waSendFailed/waCollectRestSent/`.sent` en su vecindad. NO
 * es la lista de pendientes — es la guarda contra que el detector se quede ciego, mismo
 * papel que CONOCIDOS_AL_MEDIR en scrum113-migracion-fixtures.test.mjs.
 *
 * Solo se toca si un fichero se BORRA del repo, y entonces con su motivo.
 */
const CONOCIDOS_AL_MEDIR = [
  'api.js', 'homeView.js', 'invoiceDetailView.js', 'jobDetailView.js',
  'jobsView.js', 'quotesDetailView.js', 'quotesView.js',
];

/** Suelo del censo — solo crece. Ver la doctrina completa en scrum113-migracion-fixtures.test.mjs. */
const CENSO_MIN = 7;

/**
 * Ficheros con llamadas sin mirar TODAVÍA sin arreglar. Solo mengua — un fichero nuevo con
 * el patrón malo NO se aparca aquí, sale rojo en el acto (ver el segundo test).
 */
const PENDIENTES = [];

/** Tope del ratchet: solo mengua. Bajarlo al arreglar cada fichero. */
const PENDIENTES_MAX = 0;

const ficheros = fs.readdirSync(DIR).filter((f) => f.endsWith('.js'));
const leer = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const mencionaAlguna = (f) => MENCIONA_RUTA_DE_ENVIO.test(leer(f));
const sospechosasDe = (f) => llamadasSinMirar(leer(f));

test('SCRUM-128 (frontend, capa a): el detector NO está ciego (guarda de calibración)', (t) => {
  assert.ok(
    CONOCIDOS_AL_MEDIR.length >= CENSO_MIN,
    `\n\n🔴 EL CENSO HA MENGUADO: ${CONOCIDOS_AL_MEDIR.length} entradas, el suelo es ${CENSO_MIN}.\n` +
      `Solo se baja si un fichero se BORRÓ del repo de verdad, a propósito y con el motivo.\n`,
  );

  const invisibles = CONOCIDOS_AL_MEDIR
    .filter((f) => fs.existsSync(path.join(DIR, f)))
    .filter((f) => !mencionaAlguna(f));

  assert.deepEqual(
    invisibles, [],
    `\n\n🔴 DETECTOR CIEGO: ${invisibles.length} fichero(s) del censo ya NO mencionan ninguna ruta de envío:\n` +
      invisibles.map((f) => `   · ${f}`).join('\n') + `\n\n` +
      `Llamaban a alguna de las 8 rutas cuando se midió. Si de verdad se quitó esa llamada,\n` +
      `sácalo del censo con el motivo; si no, el regex dejó de reconocer cómo se hace la\n` +
      `llamada ahora (una variable en vez de un literal, una plantilla distinta).\n`,
  );

  const conViolacion = CONOCIDOS_AL_MEDIR
    .filter((f) => fs.existsSync(path.join(DIR, f)))
    .filter((f) => sospechosasDe(f).length > 0);

  t.diagnostic(`censo ${CONOCIDOS_AL_MEDIR.length} · con violación ${conViolacion.length} · pendientes declarados ${PENDIENTES.length}`);
});

test('SCRUM-128 (frontend, capa a): ningún fichero nuevo llama a una ruta de envío sin mirar el resultado', () => {
  const conViolacion = ficheros.filter((f) => sospechosasDe(f).length > 0);
  const nuevos = conViolacion.filter((f) => !PENDIENTES.includes(f));

  assert.deepEqual(
    nuevos, [],
    `\n\n🔴 LLAMADA A RUTA DE ENVÍO SIN COMPROBAR EL RESULTADO:\n` +
      nuevos.map((f) => `   · ${f} (línea${sospechosasDe(f).length > 1 ? 's' : ''} ${sospechosasDe(f).join(', ')})`).join('\n') +
      `\n\nUn 200 no significa que el WhatsApp/email salió — mira waSendFailed(d) / ` +
      `waCollectRestSent(d.whatsapp) (api.js) antes de mostrar éxito. Ver el patrón ya\n` +
      `resuelto en cualquier llamada de jobDetailView.js a estas mismas 8 rutas.\n`,
  );
});

test('SCRUM-128 (frontend, capa a): la lista de pendientes solo mengua (ratchet)', (t) => {
  assert.equal(
    PENDIENTES.length, PENDIENTES_MAX,
    PENDIENTES.length > PENDIENTES_MAX
      ? `\n\n🔴 PENDIENTES ha CRECIDO: ${PENDIENTES.length} > ${PENDIENTES_MAX}. Un fichero nuevo con el\n` +
        `patrón malo no se aparca — sale rojo en el test anterior hasta que se arregle.\n`
      : `\n\n🔴 HOLGURA en el ratchet: ${PENDIENTES.length} pendientes con el tope en ${PENDIENTES_MAX}.\n` +
        `Baja PENDIENTES_MAX a ${PENDIENTES.length} en este mismo commit.\n`,
  );

  const yaLimpios = PENDIENTES.filter((f) => fs.existsSync(path.join(DIR, f)) && sospechosasDe(f).length === 0);
  assert.deepEqual(
    yaLimpios, [],
    `\n\n🔴 ${yaLimpios.length} fichero(s) siguen en PENDIENTES pero YA no tienen violación:\n` +
      yaLimpios.map((f) => `   · ${f}`).join('\n') +
      `\nSácalos de la lista y baja PENDIENTES_MAX en el mismo commit.\n`,
  );

  if (PENDIENTES.length === 0) {
    t.diagnostic('sin pendientes: todas las llamadas censadas comprueban el resultado 🎉');
  }
});
