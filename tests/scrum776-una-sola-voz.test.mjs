// tests/scrum776-una-sola-voz.test.mjs — SCRUM-776
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL FLUJO DE LA FACTURA SUELTA HABLA CON UNA SOLA VOZ
//
// LA VÍCTIMA, medida en SCRUM-601 ejecutando la cadena entera (sin BD, funciones puras): un
// merchant español real con `INVOICING_ES_ENABLED` en su valor por defecto tiene
// `getEmissionMode` = 'receipt' y `modoDocumentoSuelto` = 'justificante'. El botón ya lo seguía;
// el modal que abría, no. Le decía «factura» seis veces y al terminar «Factura emitida»:
// le AFIRMABA EN PASADO que había emitido una factura que no había emitido.
//
// Medido en navegador antes de tocar nada (`npm run guard:caja-documento-suelto`): en modo
// justificante la pantalla salía IDÉNTICA a la de modo factura, rótulo a rótulo y caja a caja.
//
// ── QUÉ VIGILA ESTE FICHERO ──────────────────────────────────────────────────────────────
// El MECANISMO, que es estático y no caduca:
//   1. que exista UNA sola fuente y UN solo predicado (no dos formas de decidir el nombre);
//   2. que los siete rótulos firmados salgan de ella, con sus dos ramas;
//   3. que los consumidores NO reimplementen la decisión;
//   4. que el merchant DEMO siga leyendo «factura».
//
// La CAJA la mide `npm run guard:caja-documento-suelto` en navegador, fuera de `npm test`
// (la suite no arranca navegador). Aquí no se mide un píxel: se mediría un `innerHTML` inventado.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FUENTE = 'public/dashboard/js/rotulosDelDocumento.js';
const MODAL = 'public/dashboard/js/nuevaFacturaModal.js';
const VISTA = 'public/dashboard/js/invoicesView.js';
const INDEX = 'public/dashboard/index.html';

const leer = (rel) => {
  try { return fs.readFileSync(path.join(RAIZ, rel), 'utf8'); } catch (e) {
    assert.fail(`🔴 no se pudo leer ${rel} (${e && e.code ? e.code : e}). «Está bien» y «no supe ` +
      'mirar» son el mismo verde, y aquí el verde equivocado dice que nadie lee «factura» de más.');
  }
};

/**
 * LOS SIETE, FIRMADOS POR EL ASESOR el 6-sep-2026 (regla 30).
 *
 * Se firmaron DERIVANDO, no inventando: «justificante» ya es término oficial del máster y ya lo
 * decía el botón desde SCRUM-346. No entra palabra nueva; entra que siete sitios digan la que ya
 * estaba decidida.
 *
 * 🔴 LAS DOS RAMAS SE EXIGEN JUNTAS. Un rótulo con sólo la rama «justificante» rompería al
 * merchant demo y al no-ES, que emiten FACTURA de verdad — el defecto simétrico del que se
 * arregla aquí, y el que más fácil se cuela cuando se corrige «a mano».
 */
const FIRMADOS = [
  { fn: 'tituloListado', factura: 'Facturas', justificante: 'Justificantes' },
  { fn: 'columnaNumero', factura: 'Nº factura', justificante: 'Nº justificante' },
  { fn: 'tituloModal', factura: 'Nueva factura', justificante: 'Nuevo justificante' },
  { fn: 'accionPrimaria', factura: 'Emitir factura', justificante: 'Emitir justificante' },
  { fn: 'ariaDialogo', factura: 'Crear una factura nueva', justificante: 'Crear un justificante nuevo' },
  { fn: 'avisoEmitido', factura: 'Factura emitida', justificante: 'Justificante emitido' },
  { fn: 'errorAlEmitir', factura: 'No hemos podido emitir la factura. Inténtalo otra vez.', justificante: 'No hemos podido emitir el justificante. Inténtalo otra vez.' },
];

// ─────────────────────────────────────────────────────────────────────────────────────────
// 1 · LOS SIETE, EJECUTADOS EN LOS TRES MODOS QUE EXISTEN
// ─────────────────────────────────────────────────────────────────────────────────────────
/**
 * Se CARGA el fichero de verdad y se EJECUTA con un `window` de mentira. No se lee su texto con
 * expresiones regulares: un fichero puede contener la palabra correcta y devolver la otra, que es
 * exactamente el verde que falló en SCRUM-515 (el aviso estaba en el fuente y no en la pantalla).
 */
function cargarRotulos(documentoSuelto) {
  const ventana = { appDocumentoSuelto: documentoSuelto };
  const codigo = leer(FUENTE);
  // eslint-disable-next-line no-new-func
  new Function('window', codigo)(ventana);
  assert.ok(ventana.rotulosDelDocumento, `🔴 ${FUENTE} no dejó nada en \`window.rotulosDelDocumento\``);
  return ventana.rotulosDelDocumento;
}

test('SCRUM-776 · los siete rótulos siguen al documento, en los tres modos', () => {
  // 'justificante' = merchant ES real con el flag en su valor por defecto (el 80 % de la
  // clientela). 'factura' = merchant DEMO y merchant no-ES. Los dos valores salen de
  // `modoDocumentoSuelto`, medido en SCRUM-601.
  const enJust = cargarRotulos('justificante');
  const enFact = cargarRotulos('factura');

  for (const r of FIRMADOS) {
    assert.equal(typeof enJust[r.fn], 'function', `🔴 falta el rótulo \`${r.fn}\` en la fuente única`);
    assert.equal(enJust[r.fn](), r.justificante,
      `🔴 en modo JUSTIFICANTE, \`${r.fn}()\` no dice lo firmado. Un merchant español real ` +
      'leería el nombre de un documento que NO está emitiendo.');
    assert.equal(enFact[r.fn](), r.factura,
      `🔴 en modo FACTURA, \`${r.fn}()\` ha cambiado. El merchant DEMO y los no-ES emiten factura ` +
      'de verdad: romperlos por arreglar el otro lado es el defecto simétrico.');
  }
});

test('SCRUM-776 · ✅ el merchant DEMO y cualquier valor desconocido leen «factura»', () => {
  // El demo es el único merchant que existe hoy de verdad (regla 8) y está en modo 'factura':
  // `getEmissionMode` lo desvía por `isDemoMerchant` ANTES de mirar el flag. Su pantalla no puede
  // cambiar por este ticket.
  for (const modo of ['factura', 'no', undefined, null, '', 'JUSTIFICANTE', 'otra-cosa']) {
    const r = cargarRotulos(modo);
    assert.equal(r.esJustificante(), false,
      `🔴 \`${JSON.stringify(modo)}\` se está tomando por justificante. Sólo el valor exacto ` +
      "'justificante' lo es: cualquier otra cosa —incluido un `/admin/me` viejo en caché— cae al " +
      'lado «factura», que es lo que la pantalla decía antes de este ticket.');
    assert.equal(r.tituloListado(), 'Facturas');
    assert.equal(r.avisoEmitido(), 'Factura emitida');
  }

  // CONTROL POSITIVO: el detector de arriba tiene que saber decir que SÍ. Sin esto, una función
  // que devolviera `false` siempre pasaría los siete casos y no probaría nada.
  assert.equal(cargarRotulos('justificante').esJustificante(), true,
    '🔴 el predicado no distingue: dice «no» también al único valor que es «sí».');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 2 · UNA SOLA FUENTE — que nadie reimplemente la decisión
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-776 · 🔴 la decisión vive en UN sitio: los consumidores no la reimplementan', () => {
  // El predicado `appDocumentoSuelto === 'justificante'` puede aparecer en DOS sitios y sólo dos:
  // la fuente única y el rótulo del botón de la vista, que ya existía desde SCRUM-346 y es el que
  // esta fuente copia A PROPÓSITO para no discrepar con él.
  const conPredicado = [];
  for (const rel of [FUENTE, MODAL, VISTA]) {
    // 🔴 SÓLO CÓDIGO EJECUTABLE. La primera versión contaba sobre el fuente crudo y salió roja
    // por el COMENTARIO de la fuente única, que cita el predicado para explicar que es uno solo.
    // Es el mismo defecto que SCRUM-601 documentó en su cierre —`getText()` incluye comentarios—
    // y me lo he vuelto a hacer, ahora en un guard de texto. `soloEjecutable` ya existía.
    const veces = (soloEjecutable(leer(rel)).match(/appDocumentoSuelto\s*===\s*'justificante'/g) || []).length;
    if (veces) conPredicado.push(`${rel} × ${veces}`);
  }
  assert.deepEqual(conPredicado, [`${FUENTE} × 1`, `${VISTA} × 1`],
    '🔴 el criterio de «qué documento es» se ha copiado o se ha movido. Dos sitios decidiendo el ' +
    'nombre del documento es la regla 2 esperando a morder, y aquí morder significa decirle a ' +
    `alguien que emitió una factura que no emitió.\n  encontrado: ${JSON.stringify(conPredicado)}`);

  // Y el modal NO decide nada por su cuenta: consume la fuente.
  assert.ok(!/appDocumentoSuelto/.test(soloEjecutable(leer(MODAL))),
    '🔴 el modal ha vuelto a mirar `appDocumentoSuelto` directamente. Tiene que pedirle el rótulo ' +
    'a `rotulosDelDocumento`, no reimplementar la decisión.');
});

test('SCRUM-776 · los siete se CONSUMEN, y ninguno se quedó escrito a pelo', () => {
  const modal = leer(MODAL);
  const vista = leer(VISTA);
  const juntos = modal + vista;

  for (const r of FIRMADOS) {
    assert.ok(juntos.includes(`rotulosDelDocumento.${r.fn}()`),
      `🔴 nadie llama a \`${r.fn}()\`: el rótulo existe en la fuente y no llega a la pantalla. ` +
      'Un texto construido y no cableado es el patrón «construido ≠ alcanzable».');
    // Y su texto de modo factura NO puede seguir escrito a mano EN EL MODAL, que es el flujo que
    // este ticket cierra.
    //
    // ⚠️ SE MIRA EL MODAL Y NO LA VISTA, y es una decisión medida, no un atajo para pasar: la
    // vista conserva a propósito UN `'Nueva factura'` propio —el respaldo del rótulo del BOTÓN,
    // `window.atajoNuevo.textoDe('invoices') || 'Nueva factura'`, que viene de SCRUM-346—. Es OTRA
    // ranura: el botón dice cómo se llama la ACCIÓN en la lista y el modal cómo se titula la
    // VENTANA. Coinciden en las palabras, no en el sitio. Exigir aquí que la vista no contenga
    // esa cadena obligaría a meter el botón en este ticket, que es alcance que nadie ha firmado.
    assert.ok(!soloEjecutable(leer(MODAL)).includes(`'${r.factura}'`),
      `🔴 «${r.factura}» sigue escrito a pelo en el modal. Si se queda, el día que alguien ` +
      'cambie el rótulo en la fuente habrá dos textos y sólo uno se moverá.');
  }
});

test('SCRUM-776 · la fuente se carga ANTES que quien la consume', () => {
  const html = leer(INDEX);
  const pos = (f) => html.indexOf(f);
  assert.ok(pos('js/rotulosDelDocumento.js') > 0, `🔴 ${FUENTE} no está cableado en ${INDEX}: la ` +
    'pantalla reventaría en cuanto alguien abriera Facturas.');
  for (const consumidor of ['js/invoicesView.js', 'js/nuevaFacturaModal.js']) {
    assert.ok(pos('js/rotulosDelDocumento.js') < pos(consumidor),
      `🔴 ${consumidor} se carga ANTES que la fuente de rótulos. En vanilla sin bundler eso es un ` +
      '`undefined` en tiempo de render, no un aviso del compilador.');
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 3 · EL SÉPTIMO, EL QUE NO SE FIRMÓ
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-776 · el `aria-label` sin firmar sigue con su texto Y con su marcador', () => {
  const modal = leer(MODAL);
  assert.ok(modal.includes("selCliente.setAttribute('aria-label', 'Cliente al que facturas')"),
    '🔴 el `aria-label` del selector de cliente ha cambiado. El asesor NO lo firmó: «cliente al ' +
    'que justificas» no existe en castellano y necesita redacción nueva (regla 30). Hasta que se ' +
    'firme se queda con su texto aprobado de 17-ago-2026.');
  assert.ok(/\[PENDIENTE microcopy oficial\]/.test(modal),
    '🔴 se ha borrado el marcador `[PENDIENTE microcopy oficial]`. Sin él, el único rótulo del ' +
    'flujo que sigue diciendo «facturas» en modo justificante deja de estar señalado, y nadie ' +
    'vuelve a mirar un texto que no chirría.');
});
