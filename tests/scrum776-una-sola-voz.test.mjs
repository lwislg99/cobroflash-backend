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
//   2. que los seis rótulos firmados salgan de ella, con sus dos ramas (eran siete; el del
//      `aria-label` del diálogo se retiró con su diálogo en SCRUM-875);
//   3. que los consumidores NO reimplementen la decisión;
//   4. que el merchant DEMO siga leyendo «factura».
//
// 🔴 SCRUM-825 D1 (firma del fundador, SCRUM-825 comentario 17446, 28-sep-2026) · LA RAMA
// «JUSTIFICANTE» SE RETIRA. Desde SCRUM-1027 `modoDocumentoSuelto` solo devuelve 'factura' o 'no', así
// que la rama no la veía nadie (grupo A del censo de SCRUM-1257, re-medido ejecutándolo). Lo de arriba
// era verdad cuando se escribió y no se borra. Lo que este fichero sigue vigilando: (1) UNA sola
// fuente, (2) que los seis rótulos salgan de ella, (3) que NADIE decida por el modo 'justificante'
// —el predicado pasa de dos sitios a CERO—, y (4) que el DEMO y cualquier valor lean «factura».
// Lo que DEJA de vigilar: que un merchant en modo justificante lea «justificante». Ese modo ya no existe.
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
// 🔴 SCRUM-867 · AQUÍ DECÍA `nuevaFacturaModal.js`, que era el otro consumidor de los rótulos. Ese
// modal se retiró —nadie lo abría desde que la lista navega a `invoices-new`— y su heredero es la
// PÁGINA del documento suelto: es quien pinta hoy el título, la acción primaria, el aviso de
// emitido y el error. Lo que este fichero vigila no cambia; cambia a quién se lo exige.
const PAGINA = 'public/dashboard/js/quotesView.js';
const VISTA = 'public/dashboard/js/invoicesView.js';
const INDEX = 'public/dashboard/index.html';

const leer = (rel) => {
  try { return fs.readFileSync(path.join(RAIZ, rel), 'utf8'); } catch (e) {
    assert.fail(`🔴 no se pudo leer ${rel} (${e && e.code ? e.code : e}). «Está bien» y «no supe ` +
      'mirar» son el mismo verde, y aquí el verde equivocado dice que nadie lee «factura» de más.');
  }
};

/**
 * LOS SEIS, FIRMADOS POR EL ASESOR el 6-sep-2026 (regla 30). Eran siete: ver `RETIRADOS`, abajo.
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
  // SCRUM-825 D1 (comentario 17446): se va la columna `justificante`. Queda el lado factura, que es
  // el que ya se pintaba y el que está aprobado.
  { fn: 'tituloListado', factura: 'Facturas' },
  { fn: 'columnaNumero', factura: 'Nº factura' },
  { fn: 'tituloModal', factura: 'Nueva factura' },
  { fn: 'accionPrimaria', factura: 'Emitir factura' },
  { fn: 'avisoEmitido', factura: 'Factura emitida' },
  { fn: 'errorAlEmitir', factura: 'No hemos podido emitir la factura. Inténtalo otra vez.' },
];

/**
 * 🔴 LOS RÓTULOS RETIRADOS, Y QUE NO VUELVEN SIN FIRMA.
 *
 * `ariaDialogo()` —el `aria-label` del diálogo: «Crear una factura nueva» / «Crear un justificante
 * nuevo»— lo leía SÓLO el modal viejo. Al retirarse el modal (SCRUM-867) se quedó sin consumidor, y
 * se declaró aquí en vez de taparlo. El fundador decidió en SCRUM-875: SE RETIRA. Una página no es
 * un diálogo, y cablearlo sería inventarle un uso para que un test pase. Si algún día hay un
 * diálogo, su texto se aprueba entonces.
 */
const RETIRADOS = ['ariaDialogo'];

// ─────────────────────────────────────────────────────────────────────────────────────────
// 1 · LOS SEIS, EJECUTADOS EN LOS TRES MODOS QUE EXISTEN
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

test('SCRUM-776 · 🔴 los rótulos RETIRADOS no vuelven a la fuente sin firma (SCRUM-875)', () => {
  for (const modo of ['justificante', 'factura']) {
    const r = cargarRotulos(modo);
    for (const fn of RETIRADOS) {
      assert.equal(typeof r[fn], 'undefined',
        `🔴 \`${fn}()\` ha vuelto a \`rotulosDelDocumento\`. Se retiró en SCRUM-875 por decisión del ` +
        'fundador: su único consumidor era un diálogo que ya no existe. Si hace falta otra vez, su ' +
        'texto se aprueba entonces (regla 30), no se resucita.');
    }
  }
});

test('SCRUM-776 · los seis rótulos dicen lo firmado, con cualquier valor del modo', () => {
  // 🔴 SCRUM-825 D1 (comentario 17446) · ANTES: «siguen al documento, en los tres modos», con una rama
  // por modo. La rama «justificante» se retiró; ahora el rótulo es UNO y no depende del valor. Se
  // ejecuta con los valores que el servidor puede mandar hoy ('factura' y el 'no' de app.js) y con el
  // viejo 'justificante', para que su vuelta se note.
  for (const modo of ['factura', 'no', 'justificante']) {
    const r = cargarRotulos(modo);
    for (const f of FIRMADOS) {
      assert.equal(typeof r[f.fn], 'function', `🔴 falta el rótulo \`${f.fn}\` en la fuente única`);
      assert.equal(r[f.fn](), f.factura,
        `🔴 con ${JSON.stringify(modo)}, \`${f.fn}()\` no dice lo firmado. El merchant DEMO y los no-ES ` +
        'emiten factura de verdad: romperlos es el defecto simétrico del que SCRUM-776 vino a arreglar.');
    }
  }
});

test('SCRUM-776 · ✅ el merchant DEMO y cualquier valor desconocido leen «factura»', () => {
  // El demo es el único merchant que existe hoy de verdad (regla 8) y está en modo 'factura':
  // `getEmissionMode` lo desvía por `isDemoMerchant` ANTES de mirar el flag. Su pantalla no puede
  // cambiar por este ticket.
  for (const modo of ['factura', 'no', undefined, null, '', 'JUSTIFICANTE', 'otra-cosa']) {
    const r = cargarRotulos(modo);
    assert.equal(r.tituloListado(), 'Facturas');
    assert.equal(r.avisoEmitido(), 'Factura emitida');
  }
  // SCRUM-825 D1 · el predicado `esJustificante()` se retiró con su rama. Si vuelve, vuelve la rama.
  assert.equal(typeof cargarRotulos('justificante').esJustificante, 'undefined',
    '🔴 `esJustificante()` ha vuelto a `rotulosDelDocumento`: la rama muerta se retiró por firma del ' +
    'fundador (SCRUM-825 comentario 17446). Si hace falta otra vez, es otra decisión.');

  // CONTROL POSITIVO: el cargador ejecuta de verdad lo que hay en la fuente. Una fuente sintética que
  // devuelve otra cosa TIENE que verse distinta; si no, los verdes de arriba no significarían nada.
  const ventana = { appDocumentoSuelto: 'factura' };
  // eslint-disable-next-line no-new-func
  new Function('window', "window.rotulosDelDocumento = { tituloListado: function () { return 'X'; } };")(ventana);
  assert.equal(ventana.rotulosDelDocumento.tituloListado(), 'X', '🔴 el cargador no ejecuta la fuente');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 2 · UNA SOLA FUENTE — que nadie reimplemente la decisión
// ─────────────────────────────────────────────────────────────────────────────────────────
const PREDICADO = /appDocumentoSuelto\s*===\s*'justificante'/g;

test('SCRUM-776 · 🔴 nadie decide ya el nombre del documento por el modo «justificante»', () => {
  // ANTES (SCRUM-776): el predicado podía estar en DOS sitios y sólo dos, la fuente única y el botón
  // de la vista. 🔴 SCRUM-825 D1 (comentario 17446): los dos se retiran con la rama, así que ahora son
  // CERO. Si vuelve a aparecer en cualquiera de los tres ficheros del flujo, ha vuelto la rama.
  const conPredicado = [];
  for (const rel of [FUENTE, PAGINA, VISTA]) {
    // 🔴 SÓLO CÓDIGO EJECUTABLE: los comentarios citan el predicado para explicar su retirada.
    const veces = (soloEjecutable(leer(rel)).match(PREDICADO) || []).length;
    if (veces) conPredicado.push(`${rel} × ${veces}`);
  }
  assert.deepEqual(conPredicado, [],
    '🔴 ha vuelto una rama por modo «justificante», que se retiró por firma del fundador (SCRUM-825 ' +
    `comentario 17446).\n  encontrado: ${JSON.stringify(conPredicado)}`);

  // CONTROL POSITIVO: el detector SÍ ve el predicado cuando está en código, y NO cuando está en un
  // comentario. Sin esto, el cero de arriba podría ser un detector ciego.
  assert.equal((soloEjecutable("const a = window.appDocumentoSuelto === 'justificante';").match(PREDICADO) || []).length, 1);
  assert.equal((soloEjecutable("// window.appDocumentoSuelto === 'justificante'\nconst a = 1;").match(PREDICADO) || []).length, 0);

  // Y la PÁGINA no decide nada por su cuenta: consume la fuente. Hasta SCRUM-867 esto se le exigía
  // al modal, que era quien pintaba el documento suelto.
  assert.ok(!/appDocumentoSuelto/.test(soloEjecutable(leer(PAGINA))),
    '🔴 la página del documento suelto ha empezado a mirar `appDocumentoSuelto` por su cuenta. ' +
    'Tiene que pedirle el rótulo a `rotulosDelDocumento`, no reimplementar la decisión.');
});

test('SCRUM-776 · los seis se CONSUMEN, y ninguno se quedó escrito a pelo', () => {
  const pagina = leer(PAGINA);
  const vista = leer(VISTA);
  const juntos = pagina + vista;

  for (const r of FIRMADOS) {
    assert.ok(juntos.includes(`rotulosDelDocumento.${r.fn}()`),
      `🔴 nadie llama a \`${r.fn}()\`: el rótulo existe en la fuente y no llega a la pantalla. ` +
      'Un texto construido y no cableado es el patrón «construido ≠ alcanzable».');
    // Y su texto de modo factura NO puede seguir escrito a mano EN LA PÁGINA, que es el flujo que
    // pinta hoy el documento suelto.
    //
    // ⚠️ SE MIRA LA PÁGINA Y NO LA VISTA, y es una decisión medida, no un atajo para pasar: la
    // vista conserva a propósito UN `'Nueva factura'` propio —el respaldo del rótulo del BOTÓN,
    // `window.atajoNuevo.textoDe('invoices') || 'Nueva factura'`, que viene de SCRUM-346—. Es OTRA
    // ranura: el botón dice cómo se llama la ACCIÓN en la lista y la página cómo se titula la
    // PANTALLA. Coinciden en las palabras, no en el sitio. Exigir aquí que la vista no contenga
    // esa cadena obligaría a meter el botón en este ticket, que es alcance que nadie ha firmado.
    assert.ok(!soloEjecutable(pagina).includes(`'${r.factura}'`),
      `🔴 «${r.factura}» está escrito a pelo en la página del documento suelto. Si se queda, el ` +
      'día que alguien cambie el rótulo en la fuente habrá dos textos y sólo uno se moverá.');
  }
});

test('SCRUM-776 · la fuente se carga ANTES que quien la consume', () => {
  const html = leer(INDEX);
  const pos = (f) => html.indexOf(f);
  assert.ok(pos('js/rotulosDelDocumento.js') > 0, `🔴 ${FUENTE} no está cableado en ${INDEX}: la ` +
    'pantalla reventaría en cuanto alguien abriera Facturas.');
  // SCRUM-867: el segundo consumidor ya no es el modal retirado, sino la página. Y la fuente SUBIÓ
  // en el índice para quedar por delante de las dos: hasta ahora `quotesView.js` se cargaba antes
  // que ella, así que el invariante sólo se cumplía para uno de los dos consumidores.
  for (const consumidor of ['js/invoicesView.js', 'js/quotesView.js']) {
    assert.ok(pos('js/rotulosDelDocumento.js') < pos(consumidor),
      `🔴 ${consumidor} se carga ANTES que la fuente de rótulos. En vanilla sin bundler eso es un ` +
      '`undefined` en tiempo de render, no un aviso del compilador.');
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 3 · EL SÉPTIMO, EL QUE NO SE FIRMÓ
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-776 · 🔴 el `aria-label` sin firmar se fue con su pantalla, y no vuelve sin firma', () => {
  // ANTES (hasta SCRUM-867): este test exigía que el `aria-label` del selector de cliente del modal
  // conservara su texto —«Cliente al que facturas»— y su marcador `[PENDIENTE microcopy oficial]`,
  // porque era el ÚNICO rótulo del flujo que seguía diciendo «facturas» en modo justificante y el
  // asesor no lo firmó: «cliente al que justificas» no existe en castellano.
  //
  // 🟢 AHORA NO HAY NADA QUE MARCAR: la pantalla que lo pintaba se retiró, así que la deuda de
  // microcopy se cerró por desaparición, no por firma. Lo que queda vigilado es que NO VUELVA sin
  // pasar por la firma: si alguien lo reescribe en cualquier pantalla del panel, este test lo dice.
  const enPublic = [];
  const recorrer = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { recorrer(p); continue; }
      if (/\.(js|html)$/.test(e.name) && fs.readFileSync(p, 'utf8').includes('Cliente al que facturas')) {
        enPublic.push(path.relative(RAIZ, p).replace(/\\/g, '/'));
      }
    }
  };
  recorrer(path.join(RAIZ, 'public'));
  assert.deepEqual(enPublic, [],
    '🔴 «Cliente al que facturas» ha vuelto al panel. Es el rótulo que el asesor NO firmó, y con el ' +
    'flag en su valor por defecto le dice «facturas» a quien emite justificantes. Se firma antes de ' +
    `escribirlo (regla 30).\n  ${enPublic.join('\n  ')}`);
});
