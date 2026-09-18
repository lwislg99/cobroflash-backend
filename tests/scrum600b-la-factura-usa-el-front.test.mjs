// tests/scrum600b-la-factura-usa-el-front.test.mjs — SCRUM-600 (DOC-10)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA FACTURA SUELTA USA EL FRONT DEL PRESUPUESTO. ESTO LO COMPRUEBA MONTANDO LAS DOS PANTALLAS.
//
// El fichero hermano (`scrum600-un-solo-front-documento.test.mjs`) mide el CENSO y sujeta las
// ocho funciones que no se pueden perder. Éste mide el CAMBIO: que la página nueva emita lo
// mismo que el modal viejo, que el presupuesto siga entero, y que con el flag en su valor por
// defecto la pantalla no le diga «factura» a quien emite justificantes.
//
// ── 🔴 POR QUÉ SE MONTA LA VISTA Y NO SE LEE EL FICHERO ─────────────────────────────────────
//
// Porque leyendo el código estas tres cosas salen VERDES y son falsas. Medido, con este banco,
// mientras se escribía el ticket: la página en modo justificante seguía enseñando **cinco**
// rótulos del presupuesto que ningún `grep` de este fichero habría relacionado con la pantalla —
// el selector de dirección de la obra (cuya opción dice «Utilizar dirección de FACTURACIÓN», o
// sea la palabra prohibida, en la pantalla de un justificante), el rótulo «IVA del presupuesto»,
// la pista «Añade los conceptos que vas a presupuestar.», el tooltip de la IA, y —la peor— la
// vista previa imprimiendo «Pago 100% al aceptar el presupuesto.», una condición que nadie había
// elegido, en el papel que ve el cliente.
//
// Ninguna de las cinco vivía en una ranura que el censo de ranuras marcara como pendiente. Vivían
// en piezas que se pintan y ya. **Montar la pantalla es la única forma de verlas.**
//
// ── LO QUE ESTE FICHERO NO MIDE, DICHO EN VOZ ALTA ──────────────────────────────────────────
// El mini-DOM del banco no es un navegador: no calcula estilos ni tamaños de caja. Que un rótulo
// QUEPA lo mide `npm run guard:caja-documento-suelto`, que arranca Edge y está fuera de la tanda
// a propósito. Aquí se mide QUÉ DICE y QUÉ MANDA, no cómo se ve.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url'; // NUNCA `new URL().pathname`: no decodifica el espacio
import ts from 'typescript';

import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { censarControles } from './_censo-dos-fronts.mjs';
import { recorrerDocumento } from './_camino-factura-suelta.mjs';
import { validarFacturaSuelta } from '../dist/modules/invoicing/domain/facturaSuelta.js';
import { calcVatBreakdown } from '../dist/modules/invoicing/domain/vat.service.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGINA = 'public/dashboard/js/quotesView.js';
const MODAL = 'public/dashboard/js/nuevaFacturaModal.js';   // SCRUM-867: RETIRADO. Se sigue nombrando para exigir que NO vuelva.
const PIEZA = 'public/dashboard/js/cuerpoDelDocumentoSuelto.js';

/**
 * 🔴 SCRUM-867 · EL CUERPO DEL MODAL, CONGELADO Y MEDIDO — no recordado.
 *
 * El control que decidía este ticket comparaba, byte a byte, lo que emite la PÁGINA con lo que
 * emitía el MODAL. Al retirar el modal (nadie lo abría) ese comparador desaparece, y con él la
 * prueba de que reutilizar la pantalla no cambió el camino de emisión (regla 38). No se borra: se
 * congela lo que el modal emitía.
 *
 * MEDIDO, no escrito de memoria: `docs/master/evidencias/SCRUM-867/cuerpo-congelado.mjs` restaura
 * el modal desde `77ce9d1e`, emite con las DOS pantallas la misma entrada y compara. Las tres
 * medidas —página hoy, modal antes, página antes— dieron esta misma cadena.
 */
const CUERPO_DEL_MODAL = '{"customerId":7,"lines":[{"concept":"Mano de obra","qty":2,"price":50,"tax":0.21}]}';
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

// La entrada que se teclea EN LAS DOS PANTALLAS. Un solo sitio: si las dos recibieran entradas
// distintas, comparar sus salidas no diría nada.
const CLIENTE = '7';
const LINEA = Object.freeze({ concepto: 'Mano de obra', cantidad: '2', precio: '50' });

// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL BANCO · montar de verdad, y recoger lo que sale por la red
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Un dashboard cargado, con la red servida y un registro de lo que se ENVÍA. */
function bancoConRed(documentoSuelto = 'justificante') {
  const enviado = [];
  const red = {
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
    fetch: async (url, opts) => {
      if (opts && opts.method === 'POST') enviado.push({ url: String(url), body: opts.body });
      const u = String(url);
      let cuerpo = { factura: { id: 1 } };
      if (/\/admin\/customers/.test(u)) cuerpo = [{ id: Number(CLIENTE), name: 'Cliente de prueba' }];
      else if (/\/admin\/merchant/.test(u)) cuerpo = { id: 1, name: 'Taller', defaultCurrency: 'EUR' };
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => cuerpo, text: async () => '' };
    },
  };
  const banco = cargarDashboard(RAIZ, { red });
  banco.ctx.appDocumentoSuelto = documentoSuelto;
  banco.ctx.appMerchantId = 1;
  return { banco, enviado };
}

const respirar = () => new Promise((r) => setTimeout(r, 60));
const texto = (n) => String((n && n.textContent) || '');

/** Teclea la línea y pulsa la acción primaria de LA PÁGINA. Devuelve lo enviado. */
async function emitirPorLaPagina(precio = LINEA.precio) {
  const { banco, enviado } = bancoConRed();
  const r = await pintarVista(banco, 'renderQuotesView', null, true);
  assert.equal(r.error, null, `🔴 la página no monta: ${r.error && r.error.message}`);
  const n = todos(r.contenedor);

  const sel = n.find((x) => x.tagName === 'SELECT' && x.name === 'customer_id');
  assert.ok(sel, '🔴 SUELO: no se encuentra el selector de cliente de la página');
  sel.value = CLIENTE;
  sel.disparar('change');

  const conceptos = n.filter((x) => x.tagName === 'INPUT' && x.placeholder === 'Concepto / servicio');
  const numeros = n.filter((x) => x.tagName === 'INPUT' && x.type === 'number');
  assert.ok(conceptos.length >= 1 && numeros.length >= 2,
    `🔴 SUELO: no se encuentran los campos de la primera línea (conceptos=${conceptos.length}, números=${numeros.length})`);
  conceptos[0].value = LINEA.concepto;
  numeros[0].value = LINEA.cantidad;
  numeros[1].value = precio;

  const emitir = n.find((x) => x.tagName === 'BUTTON' && /^Emitir/.test(texto(x)));
  assert.ok(emitir, '🔴 SUELO: la página no tiene acción primaria de emisión');
  emitir.disparar('click');
  await respirar();
  return enviado.filter((x) => /\/admin\/invoices/.test(x.url));
}

// SCRUM-867 · aquí vivía `emitirPorElModal`, que tecleaba lo mismo en el modal viejo. Se fue con
// el modal; lo que emitía está congelado y medido en `CUERPO_DEL_MODAL`, arriba.

/** Todo lo que un humano puede LEER en una pantalla montada, ranura por ranura. */
function ranurasLegibles(raiz) {
  const out = [];
  for (const n of todos(raiz)) {
    for (const via of ['textContent', 'placeholder', 'title']) {
      const v = n[via];
      if (typeof v === 'string' && v.trim()) out.push({ via, tag: n.tagName, texto: v.trim() });
    }
    const html = n._html;
    if (typeof html === 'string' && html.trim()) out.push({ via: 'innerHTML', tag: n.tagName, texto: html.trim() });
    const al = n._attrs && n._attrs['aria-label'];
    if (typeof al === 'string' && al.trim()) out.push({ via: 'aria-label', tag: n.tagName, texto: al.trim() });
  }
  return out;
}

async function pintarPagina(documentoSuelto, tercerArgumento) {
  const { banco } = bancoConRed(documentoSuelto);
  const r = await pintarVista(banco, 'renderQuotesView', null, tercerArgumento);
  assert.equal(r.error, null, `🔴 la vista no monta: ${r.error && r.error.message}`);
  return r;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SUELO · si el banco no encuentra las dos pantallas, se declara CIEGO y no da verde
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-600b · SUELO: la página y su pieza existen, y el modal retirado NO vuelve', () => {
  for (const rel of [PAGINA, PIEZA]) {
    assert.ok(fs.existsSync(path.join(RAIZ, rel)), `🔴 CIEGO: no existe ${rel}. Sin la pantalla y su pieza común no hay nada que medir, y un verde aquí significaría «no supe mirar».`);
  }
  // SCRUM-867: el modal se retiró. Que NO esté es parte de lo vigilado: si vuelve, vuelven dos
  // pantallas emitiendo, que es justo lo que este ticket unificó.
  assert.equal(fs.existsSync(path.join(RAIZ, MODAL)), false,
    `🔴 ${MODAL} ha vuelto al árbol. Se retiró en SCRUM-867 por muerto; si hace falta otra vez, es `
    + 'cambio de máster antes de código, no un fichero que reaparece.');
  const p = censarControles(leer(PAGINA), 'quotesView.js').controles;
  assert.ok(p.length >= 25, `🔴 CIEGO sobre la PÁGINA: ${p.length} controles`);
});

test('SCRUM-600b · SUELO: el banco MONTA las dos pantallas sin errores', async () => {
  const { banco } = bancoConRed();
  assert.deepEqual(banco.fallos, [], `🔴 el dashboard no carga entero: ${JSON.stringify(banco.fallos)}`);
  const r = await pintarVista(banco, 'renderQuotesView', null, true);
  assert.equal(r.error, null, `🔴 la PÁGINA revienta al montarse: ${r.error && r.error.message}`);
  assert.deepEqual(r.rechazos, [], `🔴 la página deja promesas sueltas: ${JSON.stringify(r.rechazos)}`);
  assert.ok(r.nodos > 80, `🔴 la página pinta ${r.nodos} nodos: eso no es la pantalla entera`);
  // SCRUM-867: antes se exigía lo contrario —que el modal SIGUIERA publicado, porque era el
  // comparador—. Ahora el comparador es `CUERPO_DEL_MODAL`, congelado y medido, y lo que se exige
  // es que el panel ya no publique aquella global.
  assert.equal(typeof banco.ctx.openNuevaFacturaModal, 'undefined',
    '🔴 `openNuevaFacturaModal` vuelve a publicarse en el panel: el modal retirado ha vuelto a cargarse.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CONTROL QUE DECIDE EL TICKET
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-600b · 🔴 EL CONTROL QUE DECIDE: la PÁGINA emite EXACTAMENTE lo que emitía el MODAL', async () => {
  const dePagina = await emitirPorLaPagina();

  assert.equal(dePagina.length, 1, `🔴 la página no hizo UN alta: hizo ${dePagina.length}`);
  assert.equal(dePagina[0].url, '/admin/invoices', '🔴 el alta ha cambiado de ruta');

  // BYTE A BYTE. No `deepEqual`: el orden de las claves también viaja, y dos cuerpos con las
  // mismas claves en otro orden no son «el mismo cuerpo» para nadie que lea un log.
  assert.equal(dePagina[0].body, CUERPO_DEL_MODAL,
    '🔴 LA PÁGINA YA NO EMITE LO QUE EMITÍA EL MODAL VIEJO. El camino de emisión no se toca al\n'
    + '  cambiar el front (regla 38): si el cuerpo tenía que cambiar, es cambio con diff delante.\n'
    + `  página : ${dePagina[0].body}\n  congelado: ${CUERPO_DEL_MODAL}`);
});

test('SCRUM-600b · ✅ CONTROL NEGATIVO: si la página divergiera del cuerpo congelado, esto CAERÍA', async () => {
  // 🔴 La comparación de arriba da verde también si el recolector no recoge nada o si el cuerpo se
  // compone solo con constantes. Se teclea OTRO precio y se exige que deje de cuadrar.
  const otra = await emitirPorLaPagina('999');
  assert.notEqual(otra[0].body, CUERPO_DEL_MODAL,
    '🔴 el comparador da IGUAL con precios distintos: no está comparando nada.');
});

test('SCRUM-600b · 🔴 y lo que se GUARDA es lo mismo: mismas líneas y mismo total', async () => {
  const dePagina = await emitirPorLaPagina();
  const cuerpo = JSON.parse(dePagina[0].body);

  // El camino REAL del servidor, con sus funciones puras (regla 38: esto sólo LEE).
  const doc = recorrerDocumento({ validarFacturaSuelta, calcVatBreakdown }, cuerpo.lines, cuerpo.customerId);
  assert.equal(doc.ok, true, `🔴 el servidor RECHAZA lo que manda la página: ${doc.error}`);
  assert.deepEqual(doc.guardado, [{ concept: 'Mano de obra', qty: 2, price: 50, tax: 0.21 }],
    '🔴 lo que queda guardado no es lo que se tecleó');
  assert.equal(doc.total, '121.00',
    `🔴 el total guardado sería ${doc.total} y no 121.00 (2 × 50 = 100 + 21 % de IVA)`);
});

test('SCRUM-600b · 🔴 DIVERGENCIA IMPOSIBLE: la pantalla llama a la MISMA pieza', () => {
  // Que hoy emita lo congelado es un hecho; que no pueda dejar de hacerlo es la propiedad. Se
  // comprueba que NO compone el cuerpo por su cuenta.
  //
  // SCRUM-867: este bucle recorría las DOS pantallas. Queda una, y la propiedad es la misma: si la
  // página compusiera el cuerpo a mano, el control de arriba pasaría a ser una casualidad.
  for (const rel of [PAGINA]) {
    const fuente = leer(rel);
    const sf = ts.createSourceFile(rel, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    let llama = 0;
    const mirar = (n) => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
          && ts.isIdentifier(n.expression.name)
          && n.expression.name.text === 'cuerpoDelDocumentoSuelto') llama++;
      ts.forEachChild(n, mirar);
    };
    ts.forEachChild(sf, mirar);
    assert.equal(llama, 1,
      `🔴 ${rel} llama ${llama} veces a la pieza común. Tiene que llamarla UNA: si compusiera el `
      + 'cuerpo por su cuenta, las dos pantallas volverían a poder divergir y el control de arriba '
      + 'pasaría a ser una casualidad en vez de una propiedad.');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL QUE MÁS IMPORTA · con `INVOICING_ES_ENABLED` en su valor por defecto, un merchant ES real
// emite JUSTIFICANTES, y la pantalla NO puede decirle «factura» en ningún sitio.
// ═════════════════════════════════════════════════════════════════════════════════════════════

const DIANA = /factura/i;

test('SCRUM-600b · 🔴 en modo JUSTIFICANTE la página no dice «factura» EN NINGÚN SITIO', async () => {
  const r = await pintarPagina('justificante', true);
  const dicen = ranurasLegibles(r.contenedor).filter((x) => DIANA.test(x.texto));
  assert.deepEqual(dicen, [],
    '🔴 LA PANTALLA LE DICE «FACTURA» A QUIEN EMITE JUSTIFICANTES. Con el flag en su valor por\n'
    + '  defecto eso es afirmarle que ha emitido un documento que NO ha emitido (reglas 7/24).\n'
    + '  El rótulo sale de `rotulosDelDocumento`, o el bloque no se pinta. NO se reescribe a mano:\n'
    + '  el microcopy lo firma el fundador (regla 30).\n  '
    + dicen.map((x) => `${x.via} ${x.tag}: ${JSON.stringify(x.texto.slice(0, 90))}`).join('\n  '));
});

test('SCRUM-600b · ✅ CONTROL POSITIVO: en modo FACTURA la MISMA página sí dice «factura»', async () => {
  // Sin esto, el test de arriba daría verde sobre una pantalla en blanco, sobre un banco que no
  // monta nada, o sobre un detector que no sabe leer. Aquí se le exige que ENCUENTRE.
  const r = await pintarPagina('factura', true);
  const dicen = ranurasLegibles(r.contenedor).filter((x) => DIANA.test(x.texto)).map((x) => x.texto);
  assert.ok(dicen.length > 0,
    '🔴 NO SUPE MIRAR: en modo factura la pantalla tampoco dice «factura», así que el verde de '
    + 'arriba no significa nada.');
  // Y son EXACTAMENTE los dos rótulos aprobados de este flujo, no un texto suelto.
  assert.deepEqual([...new Set(dicen)].sort(), ['Emitir factura', 'Nueva factura'],
    '🔴 en modo factura la pantalla dice «factura» en sitios que no son sus dos rótulos aprobados '
    + '(SCRUM-289b): el título y la acción primaria.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ✅ POSITIVO · el presupuesto sigue siendo el de antes. Cambiar lo que funcionaba por lo que no
// es la forma más cara de entregar este ticket.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-600b · ✅ EL PRESUPUESTO NO PIERDE NADA al compartir la página', async () => {
  const r = await pintarPagina('justificante', undefined); // sin tercer argumento = presupuesto
  const todas = ranurasLegibles(r.contenedor).map((x) => x.texto);
  const hay = (t) => todas.some((x) => x.includes(t));
  // SCRUM-915d · los bloques son ahora PASOS con los títulos firmados en SCRUM-915 comentario 15868.
  // Se comprueban por IGUALDAD: «Condiciones» por subcadena lo daría por bueno «Condiciones de pago».
  const TITULOS_DE_PASO = ['Cliente', 'Conceptos', 'Condiciones', 'Ajustes del documento', 'Revisar y enviar'];
  const titulosPerdidos = TITULOS_DE_PASO.filter((t) => !todas.some((x) => x === t));
  assert.deepEqual(titulosPerdidos, [], '🔴 el presupuesto ha perdido pasos: ' + titulosPerdidos.join(', '));

  const IMPRESCINDIBLES = [
    // (los cuatro bloques, que eran '1. Cliente'…'4. Envío', se comprueban arriba como PASOS)
    'Estado del presupuesto',                                   // el panel de estado
    'Total presupuesto',                                        // el KPI y el pie de la vista previa
    'Generar presupuesto',                                      // la acción primaria, reversible
    'Presupuesto válido durante 30 días salvo indicación en contrario.', // la coletilla del papel
    'Guardar como plantilla', 'Usar plantilla',                 // F11
    'Guardado automáticamente',                                 // el borrador
    'IVA del presupuesto',                                      // el IVA por documento
    'Añade los conceptos que vas a presupuestar.',              // la pista del bloque de líneas
    'Vista previa del documento',                               // F7
    'Dirección de la obra',                                     // DOC-12
  ];
  const perdidas = IMPRESCINDIBLES.filter((t) => !hay(t));
  assert.deepEqual(perdidas, [],
    '🔴 EL PRESUPUESTO HA PERDIDO PIEZAS al compartir su página con la factura. Compartir el front\n'
    + '  no es recortar el presupuesto: lo que se omite se omite SÓLO en modo documento suelto.\n  '
    + perdidas.join('\n  '));
});

test('SCRUM-600b · 🔴 y el modo documento suelto NO arrastra lo que el emisor no puede guardar', async () => {
  // La otra cara del test de arriba, y el criterio del ticket: un control aparece en modo
  // documento suelto **si y sólo si su dato sobrevive a `validarFacturaSuelta`**. Recoger lo que
  // el servidor tira en silencio (SCRUM-616) sería peor que el modal estrecho que se sustituye.
  const r = await pintarPagina('justificante', true);
  const todas = ranurasLegibles(r.contenedor).map((x) => x.texto);
  const NO_DEBEN_ESTAR = [
    // SCRUM-915d · «Condiciones» por subcadena caza el paso Y sus filas («Condiciones de pago»).
    'Condiciones',             // plazos y formas de pago: no viajan
    'Ajustes del documento',   // qué datos salen, dirección e IVA del documento: no viajan (era «4. Envío»)
    'Estado del presupuesto',  // el documento nace emitido y no cambia de estado (regla 29)
    // «Guardar como plantilla» y «Usar plantilla» SALIERON de esta lista con SCRUM-600g. Eran
    // parada declarada porque sus hojas nombraban el presupuesto, no porque su dato no viajara: una
    // plantilla sólo guarda líneas. Firmadas las dos frases, están, y lo exige `scrum600g`.
    'Guardado automáticamente',// la ranura de borrador es UNA y es la del presupuesto
    'Dirección de la obra',    // `shippingAddress*`: no viajan
    'IVA del presupuesto',     // `ivaModo`: no viaja
    'Suplido',                 // la MARCA no sobrevive, sólo el `tax: 0` (SCRUM-616 §4)
  ];
  const coladas = NO_DEBEN_ESTAR.filter((t) => todas.some((x) => x.includes(t)));
  assert.deepEqual(coladas, [],
    '🔴 LA PANTALLA PIDE DATOS QUE EL EMISOR DESCARTA EN SILENCIO. El profesional los teclea y no\n'
    + '  llegan al documento: ni error, ni aviso, ni diferencia de importe. Es el defecto que midió\n'
    + '  SCRUM-616 y el motivo por el que estos bloques no se pintan.\n  '
    + coladas.join('\n  '));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA FORMA DE LA RUTA · que el instrumento pueda VER esta pantalla
//
// El guard de marcadores (SCRUM-722) monta cada vista del router con UN argumento como mucho. La
// ruta llamaba `renderQuotesView(cont, null, true)`, así que el guard la montaba sin el tercero:
// pintaba el PRESUPUESTO y contaba sus 6 marcadores como si fueran de la factura. No se midió
// mal — se midió OTRA PANTALLA, que es peor, porque el número parecía real.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-600b · 🔴 la ruta se monta con UN argumento: el instrumento tiene que poder verla', async () => {
  const app = leer('public/dashboard/js/app.js');

  // ① El `case` llama a la puerta, no a la vista con tres argumentos.
  const caso = (app.match(/case 'invoices-new':([\s\S]*?)break;/) || [])[1] || '';
  assert.ok(caso, '🔴 no existe el `case` de `invoices-new` en el router');
  assert.match(caso, /renderDocumentoSueltoView\(\s*viewContainer\s*\)/,
    '🔴 la ruta ha vuelto a montarse con más de un argumento. El guard de SCRUM-722 deriva las '
    + 'vistas del router y las llama con `window[fn](cont)`: con tres argumentos monta OTRA '
    + 'pantalla y cuenta sus marcadores como si fueran de ésta.');
  assert.doesNotMatch(caso, /renderQuotesView\s*\(/,
    '🔴 el `case` vuelve a llamar directamente a `renderQuotesView`: eso es la forma que el guard '
    + 'no sabe montar.');

  // ② Y la puerta existe, se publica y lleva el tercer argumento puesto.
  const vista = leer(PAGINA);
  assert.match(vista, /function renderDocumentoSueltoView\(\s*container\s*\)/,
    '🔴 la puerta `renderDocumentoSueltoView` ya no existe');
  assert.match(vista, /renderQuotesView\(\s*container\s*,\s*null\s*,\s*true\s*\)/,
    '🔴 la puerta ya no pide el documento suelto: montaría el presupuesto en la ruta de la factura');
  assert.match(vista, /window\.renderDocumentoSueltoView\s*=/,
    '🔴 la puerta no se publica en `window`: el router no la encontraría');

  // ③ Y montada POR LA PUERTA pinta lo mismo que montada a mano. Si no, la puerta miente.
  const { banco } = bancoConRed('justificante');
  const porLaPuerta = await pintarVista(banco, 'renderDocumentoSueltoView');
  assert.equal(porLaPuerta.error, null, `🔴 la puerta no monta: ${porLaPuerta.error && porLaPuerta.error.message}`);
  const textos = ranurasLegibles(porLaPuerta.contenedor).map((x) => x.texto);
  assert.ok(textos.some((t) => t.includes('Emitir justificante')),
    '🔴 montada por la puerta, la pantalla no es la del documento suelto');
  assert.ok(!textos.some((t) => t.includes('Condiciones')), // SCRUM-915d: era «3. Condiciones»
    '🔴 montada por la puerta, la pantalla trae bloques del presupuesto');
});

test('SCRUM-600b · 🔴 la tira de propuesta de descuento NO se pinta en el documento suelto', async () => {
  // En el DOCUMENTO SUELTO el descuento no sobrevive al emisor —`dto` y `discountGlobalAmount` se
  // descartan en la puerta—, así que este ticket ya retiró los DOS campos. (SCRUM-887 hace que el
  // `dto` de línea SÍ llegue a la factura que sale de un PRESUPUESTO, por `lineasParaFacturar`;
  // este documento no tiene presupuesto detrás y no cambia.) La tira que PROPONE rellenarlos se había quedado: un
  // control que el profesional acepta, que no cambia nada en pantalla porque sus campos no están,
  // y cuyo dato el servidor tiraría igual. Medido en navegador: pintaba 1 nodo por estado.
  const r = await pintarPagina('justificante', true);
  const clases = todos(r.contenedor).map((n) => String(n.className || ''));
  assert.ok(!clases.some((c) => c.includes('quote-propuesta-dto')),
    '🔴 ha vuelto la tira de la propuesta de descuento a la pantalla del documento suelto.');
  // SUELO: en el presupuesto SÍ está — si no, este test daría verde por mirar mal.
  const q = await pintarPagina('justificante', undefined);
  const clasesQ = todos(q.contenedor).map((n) => String(n.className || ''));
  assert.ok(clasesQ.some((c) => c.includes('quote-propuesta-dto')),
    '🔴 CIEGO: la tira tampoco está en el presupuesto, así que el cero de arriba no significa nada.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 REGLA 29 · una factura emitida no se edita, no se borra y no se renumera
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-600b · 🔴 REGLA 29: la página SÓLO da de alta — no edita nada emitido', () => {
  const fuente = leer(PAGINA);
  const sf = ts.createSourceFile(PAGINA, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

  // ① Ninguna llamada de esta vista escribe sobre una factura YA EMITIDA. Se busca por el ÁRBOL
  //    —no por texto— cualquier petición a `/admin/invoices/...` con método de escritura.
  const pecados = [];
  const mirar = (n) => {
    if (ts.isCallExpression(n)) {
      const arg = n.arguments[0];
      const ruta = arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)
        ? arg.text : (ts.isTemplateExpression(arg) ? arg.getText(sf) : ''));
      if (/\/admin\/invoices\//.test(String(ruta || ''))) {
        const metodo = n.arguments[1] && n.arguments[1].getText(sf);
        if (/PUT|PATCH|DELETE/i.test(String(metodo || ''))) {
          pecados.push(`${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}: ${String(ruta).slice(0, 60)}`);
        }
      }
    }
    ts.forEachChild(n, mirar);
  };
  ts.forEachChild(sf, mirar);
  assert.deepEqual(pecados, [],
    '🔴 REGLA 29 ROTA: esta pantalla escribe sobre una factura ya emitida. Una factura emitida no '
    + 'se edita, no se borra y no se renumera — sólo cabe R1 o anulación con registro.\n  '
    + pecados.join('\n  '));

  // ② Y no puede CARGAR un documento emitido: su firma no tiene por dónde recibir un id. Sin id
  //    no hay nada que editar, que es una barrera más fuerte que no pintar el botón.
  assert.match(fuente, /function renderQuotesView\(\s*container\s*,\s*template\s*,\s*documentoSuelto\s*\)/,
    '🔴 la firma ha cambiado: si algún día recibe el id de una factura, esta garantía se cae.');
});

test('SCRUM-600b · 🔴 REGLA 29: y en pantalla no hay ninguna acción de editar/borrar/renumerar', async () => {
  const r = await pintarPagina('justificante', true);
  const botones = todos(r.contenedor)
    .filter((n) => n.tagName === 'BUTTON')
    .map((n) => (texto(n) || String(n._html || '') || n.title || '').trim())
    .filter(Boolean);
  const prohibidas = botones.filter((b) => /(^|\s)(editar|borrar|eliminar|anular|renumerar|rectificar)/i.test(b));
  assert.deepEqual(prohibidas, [],
    '🔴 la pantalla del documento suelto ofrece una acción sobre un documento emitido: ' + prohibidas.join(' · '));
  // SUELO del propio detector: si no viera NINGÚN botón, su cero no significaría nada.
  assert.ok(botones.length >= 4, `🔴 CIEGO: sólo veo ${botones.length} botones en la pantalla`);
});
