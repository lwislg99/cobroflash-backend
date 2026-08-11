// tests/scrum466-el-firmante-ve-el-albaran.test.mjs — SCRUM-466
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ ARREGLA
//
// SCRUM-463 midió —ejercitando la vista, no leyéndola— que quien firma en el móvil del
// profesional **no veía nada** de lo que firmaba: ni las líneas, ni la cantidad, ni el cliente.
// Nos habíamos gastado un bloque entero (SCRUM-438) congelando cinco campos para que nadie pudiera
// discutirlos, y el firmante no había leído ninguno.
//
// > No se sella lo que no se enseña, y no se enseña menos de lo que se sella.
//
// Ahora el albarán va **encima del recuadro y en la misma pantalla** (decisión del fundador): es
// lo que hace defendible el «lo vio» — estaba mirándolo mientras firmaba.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 SIN IMPORTES, Y ES LA MITAD DEL TICKET
//
// Ni unitario, ni de línea, ni total. **Un albarán no lleva importes** (regla del producto,
// fundador 11-ago-2026), y el motivo no es de maquetación: **quien firma en obra no es
// necesariamente quien acordó el precio** —un inquilino, un administrador de finca, el empleado de
// la tienda—. Hacerle firmar un importe convierte un acuse de «esto se ha hecho» en una aceptación
// de precio de alguien sin autoridad sobre él. El precio vive en el presupuesto (antes) y en la
// factura (después).
//
// El control negativo de abajo usa un albarán **VALORADO**, que es donde es fácil que se cuele.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cargarDashboard, todos } from './_banco-vistas.mjs';
import { leerFuente } from './_guard-texto.mjs';
import { ALBARAN_ROTULOS } from '../dist/modules/jobs/domain/albaranFirmante.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Valores DISTINTIVOS: si se pintan, se encuentran; y no salen por casualidad del marcado.
const CONCEPTO = 'ZZCONCEPTO sustitucion de bajante';
const CANTIDAD = 4321;
const PRECIO = 987654;          // 🔴 NO puede aparecer
const TOTAL = 4267652934;       // 🔴 NO puede aparecer
const CLIENTE = 'ZZCLIENTE comunidad alcala';
const LUGAR = 'ZZLUGAR nave cuatro';

/** El albarán tal y como el pad lo recibe hoy — el que compone `albaranDetailView.js`. */
const PARA_EL_PAD = Object.freeze({
  cliente: CLIENTE,
  fecha: '01/08/2026',
  lugar: LUGAR,
  lineas: [{ concepto: CONCEPTO, cantidad: CANTIDAD, unidad: 'm' }],
});

/**
 * Abre el pad DE VERDAD en el banco y devuelve todo el texto que dejó en el DOM.
 *
 * ⚠️ EL BANCO NO SABE DE `<canvas>`: su DOM de mentira no tiene `getContext`, y el pad revienta
 * antes de pintar nada. Se le da esa pieza aquí —acotada a este fichero, sin tocar el banco de
 * SCRUM-417, que es de otro carril— porque **el canvas no es lo que se mide**: lo que se mide es
 * si el ALBARÁN llega al DOM. Un contexto 2D de mentira no puede fabricar unas líneas que el pad
 * no pinte. Es la misma muleta que SCRUM-463 declaró con `destinoEfectivo`, y sigue siendo
 * hallazgo del banco, no de aquí.
 */
function abrirPad(albaran, extra = {}) {
  const banco = cargarDashboard(RAIZ);
  const crear = banco.ctx.document.createElement;
  banco.ctx.document.createElement = function (tag) {
    const n = crear.call(this, tag);
    if (String(tag).toLowerCase() === 'canvas') {
      n.getContext = () => ({
        scale() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, clearRect() {},
        getImageData: () => ({}), putImageData() {}, set strokeStyle(_) {}, set lineWidth(_) {},
        set lineCap(_) {}, set lineJoin(_) {},
      });
      n.toDataURL = () => 'data:image/png;base64,AA==';
      n.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 190 });
    }
    return n;
  };
  banco.ctx.window.appAlbaranRotulos = ALBARAN_ROTULOS;
  banco.ctx.window.appAlbaranFirmanteOpciones = [];
  const abrir = banco.ctx.openSignaturePad;
  if (typeof abrir !== 'function') return { error: 'el dashboard no publica `openSignaturePad`', texto: '', nodos: 0 };
  try {
    abrir({ title: 'Firma del cliente', albaran, onConfirm: async () => {}, ...extra });
  } catch (e) {
    return { error: `${e.name}: ${e.message}`, texto: '', nodos: 0 };
  }
  const raiz = banco.ctx.document.body;
  const nodos = todos(raiz);
  return {
    error: null,
    nodos: nodos.length,
    texto: nodos.map((n) => `${n.textContent || ''} ${n.innerHTML || ''}`).join(' ').replace(/\s+/g, ' '),
  };
}

// ── SUELO · SI EL BANCO NO MONTA EL PAD, EL TEST SE DECLARA CIEGO ────────────────────────

test('SCRUM-466 · SUELO: el pad se monta y deja nodos en el DOM', () => {
  // «No pinta importes» y «no supe leer el DOM» son el mismo verde con significados opuestos. Es
  // el control que SCRUM-463 ya llevaba y que aquí vale doble: sin él, TODO lo de abajo pasa.
  const r = abrirPad(PARA_EL_PAD);
  assert.equal(r.error, null, `🔴 el pad de firma no se puede montar en el banco: ${r.error}`);
  assert.ok(r.nodos > 5, `🔴 el pad solo dejó ${r.nodos} nodo(s): no se puede afirmar qué enseña ni qué esconde.`);
  assert.ok(r.texto.length > 50, `🔴 solo se han leído ${r.texto.length} caracteres del pad.`);
});

// ── 🔴 EL TEST · EL FIRMANTE VE LO QUE FIRMA ─────────────────────────────────────────────

test('SCRUM-466 · 🔴 el firmante VE el albarán: líneas, cliente, fecha y lugar', () => {
  const r = abrirPad(PARA_EL_PAD);
  assert.equal(r.error, null, `🔴 el pad no se monta: ${r.error}`);

  // Uno a uno y NOMBRADOS: «no ve el contenido» sin decir qué no sirve para arreglar nada.
  const faltan = [];
  if (!r.texto.includes(CONCEPTO)) faltan.push('las LÍNEAS (el concepto)');
  if (!r.texto.includes(String(CANTIDAD))) faltan.push('la CANTIDAD');
  if (!r.texto.includes(CLIENTE)) faltan.push('el CLIENTE');
  if (!r.texto.includes('01/08/2026')) faltan.push('la FECHA');
  if (!r.texto.includes(LUGAR)) faltan.push('el LUGAR de entrega');

  assert.deepEqual(faltan, [],
    `🔴 EL FIRMANTE NO VE LO QUE FIRMA: falta ${faltan.join(', ')}.\n\n` +
    '  Es el defecto entero que este ticket cierra. Un albarán firmado sirve para ganar la\n' +
    '  discusión de «yo no pedí eso»; si quien firma no vio las líneas, la firma prueba mucho\n' +
    '  menos de lo que le vendemos al profesional — y hemos congelado cinco campos (SCRUM-438)\n' +
    '  para certificar con enorme rigor algo que nadie leyó.\n\n' +
    '  No se sella lo que no se enseña, y no se enseña menos de lo que se sella.');
});

test('SCRUM-466 · 🔴 CONTROL NEGATIVO: NO aparece NINGÚN importe, ni con un albarán VALORADO', () => {
  // La decisión del fundador, protegida. Se le pasa al pad un albarán con precio, total y modo
  // VALORADO —lo que un llamador descuidado le daría— y NADA de eso puede acabar en pantalla.
  const conImportes = {
    ...PARA_EL_PAD,
    modoValoracion: 'VALORADO',
    totales: { base: TOTAL, cuota: 0, total: TOTAL },
    lineas: [{ concepto: CONCEPTO, cantidad: CANTIDAD, unidad: 'm', precioUnitario: PRECIO, tipoIva: 21 }],
  };
  const r = abrirPad(conImportes);
  assert.equal(r.error, null, `🔴 el pad no se monta: ${r.error}`);

  const colados = [];
  if (r.texto.includes(String(PRECIO))) colados.push(`el PRECIO UNITARIO (${PRECIO})`);
  if (r.texto.includes(String(TOTAL))) colados.push(`el TOTAL (${TOTAL})`);
  if (/€/.test(r.texto)) colados.push('el símbolo €');
  if (/\bBase\b|\bTotal\b|\bSubtotal\b|\bIVA\b/i.test(r.texto)) colados.push('un rótulo de importe (Base/Total/Subtotal/IVA)');

  assert.deepEqual(colados, [],
    `🔴 SE HA COLADO UN IMPORTE EN LA PANTALLA DE FIRMA: ${colados.join(', ')}.\n\n` +
    '  Un albarán NO lleva importes, y no es maquetación: quien firma en obra no es necesariamente\n' +
    '  quien acordó el precio —un inquilino, un administrador de finca, el empleado de la tienda—.\n' +
    '  Hacerle firmar un importe convierte un acuse de «esto se ha hecho» en una ACEPTACIÓN DE\n' +
    '  PRECIO de alguien sin autoridad sobre él.\n\n' +
    '  El precio vive en el presupuesto (antes) y en la factura (después).');

  // CONTROL POSITIVO dentro del mismo test: con el mismo albarán, lo que SÍ debe verse se ve. Sin
  // esto, «no hay importes» se cumpliría también con un pad que no pinta nada.
  assert.ok(r.texto.includes(CONCEPTO),
    '🔴 tampoco se ve el concepto: el test de arriba estaría pasando por no pintar nada.');
  assert.ok(r.texto.includes(String(CANTIDAD)), '🔴 tampoco se ve la cantidad.');
});

test('SCRUM-466 · el llamador NO le pasa importes al pad — imposible por construcción', () => {
  // La otra mitad: que el pad no los pinte está bien, pero si le LLEGARAN bastaría un descuido
  // para sacarlos. Misma idea que SCRUM-452 con el PDF: lo que no se recibe no se puede pintar.
  const vista = leerFuente(path.join(RAIZ, 'public/dashboard/js/albaranDetailView.js'));
  const i = vista.indexOf('openSignaturePad({');
  assert.ok(i > 0, '🔴 no se encuentra la llamada al pad: este guard ha dejado de mirar.');
  const bloque = vista.slice(i, vista.indexOf('onConfirm', i));

  for (const prohibido of ['precioUnitario', 'totales', 'modoValoracion', 'tipoIva']) {
    assert.ok(!bloque.includes(prohibido),
      `🔴 la vista le pasa «${prohibido}» al pad de firma. Aunque hoy no se pinte, basta una línea ` +
      'para que se cuele — y un albarán no lleva importes.');
  }
  // CONTROL POSITIVO: lo que SÍ se pasa, se pasa. Si el bloque estuviera vacío, el bucle de
  // arriba pasaría sin comprobar nada.
  for (const debe of ['concepto', 'cantidad', 'cliente', 'lugar']) {
    assert.ok(bloque.includes(debe), `🔴 la vista NO le pasa «${debe}» al pad: el firmante no lo verá.`);
  }
});

// ── LA MICROCOPY, QUE LA APRUEBA EL ASESOR ───────────────────────────────────────────────

test('SCRUM-466 · los dos textos son los APROBADOS, y salen de su fuente única', () => {
  assert.equal(ALBARAN_ROTULOS.confirmacionFirma,
    'Con tu firma confirmas que este trabajo se ha hecho.',
    '🔴 el texto de encima del recuadro no es el aprobado (asesor, 11-ago-2026).');
  assert.equal(ALBARAN_ROTULOS.recuadroFirma, 'Firma aquí',
    '🔴 el rótulo del recuadro no es el aprobado.');

  // 🔴 Nombra el acto SIN mencionar precio, que es lo que la decisión del fundador exige.
  const HABLA_DE_DINERO = /precio|importe|total|€|euro|pag|cobr/i;
  const SIN_APROBAR = /PENDIENTE|TODO|\[.*microcopy/i;

  // ⚠️ EL RESPALDO DE LA NEGACIÓN (SCRUM-237), y no es burocracia: una regex rota pasa SIEMPRE, y
  // este assert es lo único que separa «la microcopy no habla de dinero» de «mi patrón no sabe
  // buscarlo». Se comprueba contra textos que SÍ deberían caer, antes de usarlo para absolver.
  for (const conDinero of ['Confirmas el importe de 120 €', 'Aceptas el precio acordado', 'Firma para pagar']) {
    assert.match(conDinero, HABLA_DE_DINERO,
      `🔴 el patrón NO detecta dinero en «${conDinero}»: entonces su silencio sobre la microcopy real ` +
      'no significa nada.');
  }
  assert.match('[PENDIENTE microcopy oficial]', SIN_APROBAR,
    '🔴 el patrón no detecta un marcador de microcopy sin aprobar: no vigila nada.');

  for (const t of [ALBARAN_ROTULOS.confirmacionFirma, ALBARAN_ROTULOS.recuadroFirma]) {
    assert.doesNotMatch(t, HABLA_DE_DINERO,
      `🔴 la microcopy de la firma menciona dinero: «${t}». Firmar un albarán no es aceptar un precio.`);
    assert.doesNotMatch(t, SIN_APROBAR, `🔴 microcopy sin aprobar en producción: «${t}»`);
  }

  // Y llegan al pad: se pintan, no solo existen. «Mencionar no es hacer».
  const r = abrirPad(PARA_EL_PAD);
  assert.ok(r.texto.includes(ALBARAN_ROTULOS.confirmacionFirma),
    '🔴 el texto aprobado NO se pinta encima del recuadro: existe y no lo lee nadie.');
  assert.ok(r.texto.includes(ALBARAN_ROTULOS.recuadroFirma),
    '🔴 el rótulo «Firma aquí» no se pinta.');
});

// ── REGRESIÓN · LA PÁGINA PÚBLICA SIGUE ENSEÑANDO LO SUYO ────────────────────────────────

test('SCRUM-466 · REGRESIÓN: la página pública sigue enseñando líneas y cliente', () => {
  // Ya lo hacía antes de este ticket (medido en SCRUM-463). El cambio del panel no puede
  // quitárselo de paso.
  //
  // ⚠️ ENMIENDA SCRUM-468 (11-ago-2026). Este bloque pedía además que la pública NO mencionara
  // importes. **Eso era justo el defecto que este ticket midió y aparcó** (§2 de
  // `docs/master/SCRUM-466.md`): el firmante veía una pantalla sin importes y recibía un PDF con
  // `Base` y `Total`. SCRUM-468 lo cierra por el lado de la PANTALLA —el PDF firmado va sellado y
  // no se reescribe (regla 29)—, así que la prohibición se levanta AQUÍ, y solo aquí.
  //
  // 🔴 LO QUE NO SE MUEVE: el pad de obra (`signaturePad.js`) ni lo que su llamador le pasa. Esa es
  // LA decisión de SCRUM-466 —quien firma en obra no es necesariamente quien acordó el precio— y
  // sus dos guards siguen intactos, arriba en este mismo fichero.
  const publica = fs.readFileSync(path.join(RAIZ, 'src/modules/jobs/app/routes/albaranPublic.routes.ts'), 'utf8');
  const vista = fs.readFileSync(path.join(RAIZ, 'src/modules/jobs/app/routes/albaranPublicVista.ts'), 'utf8');
  assert.ok(publica.length > 5000, `🔴 solo se han leído ${publica.length} caracteres: el guard está ciego.`);
  assert.ok(vista.length > 500, `🔴 solo se han leído ${vista.length} caracteres de la vista: guard ciego.`);
  assert.match(vista, /class="lines-table"/, '🔴 la página pública ha dejado de pintar la tabla de líneas.');
  assert.match(vista, /l\?\.concepto/, '🔴 ya no pinta el concepto de cada línea.');
  assert.match(vista, /l\?\.cantidad/, '🔴 ya no pinta la cantidad de cada línea.');
  assert.match(publica, /Hola, \$\{customerName\}/, '🔴 ya no saluda al cliente por su nombre.');
  assert.match(publica, /renderLineasAlbaran\(/, '🔴 la página ya no llama a la vista de líneas.');
});

// ── SIN RED · EL CASO DEL BLOQUE H ───────────────────────────────────────────────────────

test('SCRUM-466 · SIN RED: el pad pinta el albarán con los datos que ya tiene, sin pedir nada', () => {
  // El caso de H: el pro está en un sótano. El pad recibe el albarán YA RESUELTO por el llamador,
  // así que no depende de ninguna petición — y esto lo fija: si mañana alguien le mete un `fetch`
  // dentro, sin cobertura dejaría de pintar justo cuando más falta hace.
  const pad = leerFuente(path.join(RAIZ, 'public/dashboard/js/signaturePad.js'));
  for (const red of ['fetch(', 'apiRequest(', 'XMLHttpRequest']) {
    assert.ok(!pad.includes(red),
      `🔴 el pad de firma usa «${red}». Sin cobertura no pintaría el albarán, que es justo el caso ` +
      'para el que existe el bloque H: el cliente firma en el móvil del pro, en una obra sin red.');
  }

  // Y se ejercita: con el albarán en la mano y NADA más disponible, pinta.
  const r = abrirPad(PARA_EL_PAD);
  assert.equal(r.error, null, `🔴 el pad no se monta: ${r.error}`);
  assert.ok(r.texto.includes(CONCEPTO) && r.texto.includes(CLIENTE),
    '🔴 el pad no pinta el albarán a partir de los datos que ya tiene.');
});

test('SCRUM-466 · sin albarán, el pad sigue funcionando como antes', () => {
  // Control de que el cambio es ADITIVO: quien no le pase albarán —hoy nadie, pero el componente
  // es global— no puede quedarse sin poder firmar.
  const r = abrirPad(undefined);
  assert.equal(r.error, null, `🔴 el pad revienta si no se le pasa albarán: ${r.error}`);
  assert.ok(r.nodos > 5, `🔴 el pad sin albarán solo deja ${r.nodos} nodo(s).`);
  assert.ok(!r.texto.includes(CONCEPTO), '🔴 pinta un albarán que nadie le pasó.');
});
