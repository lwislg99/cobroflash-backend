// SCRUM-1351 · EL VIAJE de la firma sin red en la pantalla del ALBARÁN.
//
// ── POR QUÉ EXISTE (1-oct-2026) ──────────────────────────────────────────────────────────────
// Once ficheros de test tocan la cola de firmas y pasan 118 de 118. NINGUNO ejecuta el viaje con
// la vista del albarán: llaman a `firmarConRedDeSeguridad` a mano, usan el pad del PARTE o miran
// `albaranDetailView.js` por AST. Era cobertura que parecía existir, en el camino de la firma de
// un cliente. Recorrerlo de verdad (SCRUM-1302 c.17880) sacó seis defectos que nadie medía.
//
// ── QUÉ EJECUTA ──────────────────────────────────────────────────────────────────────────────
// El código REAL, sin dobles de la vista ni de la cola: `renderAlbaranDetailView` + `signaturePad.js`
// (trazo, nombre, «Confirmar firma») + `colaDeFirmas.js` + `almacenLocal.js` + `api.js` sobre un
// `fetch` que se enciende y se apaga.
//
// ⚠️ EL BANCO ES `_banco-almacen-local.mjs`, que monta IndexedDB con `fake-indexeddb`.
// `_banco-vistas.mjs` a secas NO la trae (y el banco de #1971 tampoco): por eso este viaje quedó
// «sin poder medirse» el 29-sep. Estaba al lado.
//
// ── LOS DEFECTOS, DECLARADOS (trinquete de dos mitades) ──────────────────────────────────────
// Los de `scripts/_defectos-viaje-firma-declarados.json` existen HOY y este fichero no los
// arregla: `colaDeFirmas.js`, `almacenLocal.js` y `app.js` son de otro carril. Nacieron seis;
// SCRUM-1353 arregló los dos de `albaranDetailView.js` y borró sus líneas. El test los MIDE y
// exige que lo medido sea exactamente lo declarado:
//   · arreglas uno → cae, y te pide retirar su entrada (se BORRA, no se comenta);
//   · aparece uno nuevo → cae también.
// Así ninguno se arregla ni se rompe sin que este fichero se entere.
//
// Lo que NO mide: un navegador de verdad. `fake-indexeddb` cumple el estándar, no la cuota de
// Safari, el desalojo ni el orden real de la carrera del arranque (`app.js`, drenado y resistencia
// sin `await`). De esa carrera aquí sólo se mide la marca que la hace posible.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { montarAlmacen, porQueEstariaCiego, indexedDBQueAbortaTrasEscribir } from './_banco-almacen-local.mjs';
import { pintarVista, todos } from './_banco-vistas.mjs';
import { defectosDeclarados } from './_defectos-viaje-firma.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const dom = require('../dist/modules/jobs/domain/albaranFirmante.js');

/**
 * Los defectos que el viaje tiene HOY. Viven en `scripts/_defectos-viaje-firma-declarados.json`
 * (SCRUM-1362): quien arregla uno BORRA su entrada ALLÍ, sin tocar este fichero. Si el JSON no se
 * puede leer, el cargador lanza y el test sale en rojo diciéndolo: nunca una lista vacía.
 */
const DEFECTOS_DECLARADOS = defectosDeclarados();
/** Todo lo que `defectosObservados()` sabe detectar. Una clave del JSON que no esté aquí es una errata. */
const DEFECTOS_QUE_SE_SABEN_MEDIR = [
  'firmar-lo-ya-subido-dice-que-no-se-registro-y-reencola',
  'reabrir-sin-red-calla-la-firma-guardada-y-refirmar-la-sobrescribe',
  'el-detalle-abierto-no-se-entera-de-que-la-cola-subio',
  'rechazo-definitivo-del-drenado-no-se-ve-en-el-albaran',
  'cerrar-sesion-borra-la-cola-sin-avisar',
  'firmar-con-red-deja-la-marca-de-que-hubo-cola',
];

const ID = 7;
const CLAVE = 'firma:albaran:' + ID;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const albaranDelServidor = (estado, cliente = {}) => ({
  id: ID, numero: 'ALB-2026-007', estado, fecha: '2026-09-29T08:00:00.000Z', lugarEntrega: 'C/ Mayor 3',
  lineas: [{ concepto: 'Sustituir bajante', cantidad: 1, unidad: 'ud' }], customer: { name: 'Comunidad Los Olivos', ...cliente },
  job: { id: 3, titulo: 'Baño Los Olivos', direccion: 'C/ Mayor 3' }, estadoFacturacion: 'sin_facturar',
  modoValoracion: 'SIN_VALORAR', pendientes: [], enviadoParaFirma: false,
});
const PRECARGADO = {
  id: ID, numero: 'ALB-2026-007', estado: 'emitido', jobId: 3, jobTitulo: 'Baño Los Olivos',
  clienteNombre: 'Comunidad Los Olivos', fecha: '2026-09-29T08:00:00.000Z',
  lineas: [{ concepto: 'Sustituir bajante', cantidad: 1, unidad: 'ud' }],
};

/** Un servidor que se enciende y se apaga, y que recuerda si ya tiene la firma. */
function nuevaRed() {
  // `cliente` y `respuestaWhatsApp` son de SCRUM-1460: lo que el servidor dice del cliente del
  // albarán, y lo que contesta al mandar la copia. Vacíos, el banco se porta como antes.
  const e = { conRed: true, modoPost: 'ok', servidorFirmado: false, posts: [], gets: [], cliente: {}, respuestaWhatsApp: {} };
  const responder = (status, data) => ({
    ok: status >= 200 && status < 300, status, statusText: String(status),
    headers: { get: () => 'application/json' },
    json: async () => data, blob: async () => ({}), text: async () => JSON.stringify(data),
  });
  e.fetch = async (url, opts) => {
    const u = String(url);
    const metodo = (opts && opts.method) || 'GET';
    if (!e.conRed) throw new TypeError('Failed to fetch');
    if (metodo === 'GET') {
      e.gets.push(u);
      if (/\/admin\/albaranes\/\d+\/fotos/.test(u)) return responder(200, []);
      if (/\/admin\/albaranes\/\d+$/.test(u)) return responder(200, albaranDelServidor(e.servidorFirmado ? 'firmado' : 'emitido', e.cliente));
      return responder(200, {});
    }
    e.posts.push(u);
    if (/\/firmar$/.test(u)) {
      if (e.servidorFirmado) return responder(409, { error: 'albaran_locked', message: 'Este albarán ya está firmado.' });
      if (e.modoPost === 'firma_invalida') return responder(400, { error: 'firma_invalida', message: 'La firma debe ser una imagen PNG o JPEG (data-URI base64).' });
      if (e.modoPost === 'invalid_id') return responder(400, { error: 'invalid_id', message: 'Identificador no válido.' });
      e.servidorFirmado = true;
      return responder(200, { id: ID, estado: 'firmado' });
    }
    if (/\/enviar-whatsapp$/.test(u)) return responder(200, e.respuestaWhatsApp);
    return responder(200, {});
  };
  e.navigator = { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } };
  return e;
}

function montar(opciones = {}) {
  const red = nuevaRed();
  const b = montarAlmacen(RAIZ, { ...opciones, dashboard: { red } });
  // `acepta` decide qué contesta el profesional al `confirm`; `preguntas` guarda lo que se le dijo.
  const avisos = { confirm: 0, alert: 0, acepta: true, preguntas: [] };
  b.ctx.confirm = (texto) => { avisos.confirm += 1; avisos.preguntas.push(String(texto)); return avisos.acepta; };
  b.ctx.alert = () => { avisos.alert += 1; };
  b.ctx.appAlbaranRotulos = dom.ALBARAN_ROTULOS;
  b.ctx.appAlbaranAyudas = dom.ALBARAN_AYUDAS;
  b.ctx.appAlbaranFirmanteOpciones = dom.firmanteCalidadOpciones();
  // El mini-DOM no dibuja: el canvas recibe un contexto inerte y un `toDataURL` con forma de PNG.
  const crear = b.ctx.document.createElement.bind(b.ctx.document);
  b.ctx.document.createElement = (tag) => {
    const n = crear(tag);
    if (String(tag).toLowerCase() === 'canvas') {
      const nada = () => {};
      n.getContext = () => new Proxy({}, { get: () => nada, set: () => true });
      n.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 150 });
      n.setPointerCapture = nada;
      n.toDataURL = () => 'data:image/png;base64,' + 'A'.repeat(400);
    }
    return n;
  };
  return { b, red, avisos };
}

const textoDe = (n) => todos(n)
  .filter((x) => x && x._texto && !(x.style && x.style.display === 'none'))
  .map((x) => x._texto).join(' | ');
const enDocumento = (b, n) => { let p = n; while (p) { if (p === b.ctx.document.body) return true; p = p._padre; } return false; };
const botonDe = (raiz, rotulo) => todos(raiz).find((n) => n.tagName === 'BUTTON' && n._texto === rotulo);
const ofreceFirmar = (cont) => todos(cont).some((n) => n && n.dataset && n.dataset.accion === 'btnFirmarAqui');

async function cola(b) {
  const r = await b.ctx.leerFirmasPendientes();
  const firmas = r.firmas || [];
  return { estado: r.estado, n: firmas.length, claves: firmas.map((f) => f.claveIdempotencia), nombres: firmas.map((f) => f.firmadoPorNombre) };
}

/**
 * Abre el detalle. SIN red la vista pasa por su `catch` y pinta lo PRECARGADO: el banco lo marca
 * `noMedida` (acabó en su camino de error) y aquí es justo lo que se quiere medir — así que el
 * suelo deja de ser «no hubo error» y pasa a ser «se pintó el albarán y ofrece firmar».
 */
async function abrirDetalle(b, { sinRed = false } = {}) {
  const v = await pintarVista(b, 'renderAlbaranDetailView', ID);
  await esperar(60);
  assert.equal(v.error || null, null, 'el detalle del albarán tiene que pintarse sin error');
  if (sinRed) {
    assert.match(textoDe(v.contenedor), /ALB-2026-007/, 'sin red tiene que pintarse el albarán precargado, no una pantalla vacía');
    assert.equal(ofreceFirmar(v.contenedor), true, 'y el precargado tiene que ofrecer «Firmar aquí mismo»');
  } else {
    assert.equal(v.noMedida || null, null, 'el banco tiene que haber medido la vista, no su pantalla de error');
  }
  return v;
}

async function confirmarPad(b, pad) {
  pad.ok.click();
  await esperar(150);
  return {
    padAbierto: enDocumento(b, pad.overlay),
    aviso: pad.aviso.style.display === 'none' ? '' : pad.aviso._texto,
    boton: pad.ok._texto,
  };
}

/** Pulsa «Firmar aquí mismo» en la vista real, traza en el pad real, pone el nombre y confirma. */
const padsAbiertos = (b) => todos(b.ctx.document.body)
  .filter((n) => n && n.hasAttribute && n.hasAttribute('data-sp-aviso') && enDocumento(b, n));

/** Pulsa «Firmar aquí mismo» y devuelve el aviso del pad que se ha abierto, o `null` si no se abrió. */
async function pulsarFirmar(b, cont) {
  const btn = todos(cont).find((n) => n && n.dataset && n.dataset.accion === 'btnFirmarAqui');
  assert.ok(btn, 'la pantalla tiene que ofrecer «Firmar aquí mismo»: sin botón no hay viaje que medir');
  const antes = padsAbiertos(b).length;
  btn.click();
  await esperar(40); // el clic consulta la cola antes de abrir el pad (SCRUM-1353)
  const ahora = padsAbiertos(b);
  return ahora.length > antes ? ahora.pop() : null;
}

async function firmarEnPantalla(b, cont, nombre = 'Ana Ruiz') {
  const cuerpo = b.ctx.document.body;
  const aviso = await pulsarFirmar(b, cont);
  assert.ok(aviso, 'el pad de firma tiene que abrirse');
  let overlay = aviso;
  while (overlay._padre && overlay._padre !== cuerpo) overlay = overlay._padre;
  const canvas = todos(overlay).find((n) => n.tagName === 'CANVAS');
  canvas.disparar('pointerdown'); canvas.disparar('pointermove'); canvas.disparar('pointerup');
  for (const i of todos(overlay).filter((n) => n.tagName === 'INPUT' && n.type !== 'radio' && n.type !== 'checkbox')) {
    i.value = nombre;
    i.disparar('input');
  }
  const pad = { overlay, aviso, ok: botonDe(overlay, 'Confirmar firma') };
  assert.ok(pad.ok, 'el pad tiene que traer su botón de confirmar');
  return { pad, ...(await confirmarPad(b, pad)) };
}
const cerrarPad = (pad) => botonDe(pad.overlay, 'Cancelar').click();

function emisores() {
  const hacer = () => {
    const oy = {};
    return { addEventListener(t, fn) { (oy[t] = oy[t] || []).push(fn); }, disparar(t) { (oy[t] || []).forEach((fn) => fn({ type: t })); } };
  };
  const win = hacer();
  const doc = hacer();
  doc.visibilityState = 'visible';
  return { win, doc };
}

/** Deja UNA firma del albarán 7 en la cola, hecha con el pad, sin red. Devuelve el banco. */
async function conUnaFirmaEnCola() {
  const m = montar();
  await m.b.ctx.guardarAlbaranPrecargado(PRECARGADO);
  m.red.conRed = false;
  const v = await abrirDetalle(m.b, { sinRed: true });
  const r = await firmarEnPantalla(m.b, v.contenedor);
  cerrarPad(r.pad);
  assert.deepEqual((await cola(m.b)).claves, [CLAVE], 'suelo: tras firmar sin red la cola tiene esa firma y sólo ésa');
  return m;
}

// ═══ EL SUELO ═══════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1351 · suelo: el banco ve el almacén y el camino entero está cargado', () => {
  const { b } = montar();
  assert.equal(porQueEstariaCiego(b, RAIZ), null);
  const camino = /albaranDetailView|signaturePad|colaDeFirmas|almacenLocal|estadoFirma|api\.js|app\.js|resistenciaAlmacen/;
  assert.deepEqual(b.fallos.filter((f) => camino.test(f.fichero)), [], 'ningún fichero del camino puede fallar al cargar');
  for (const fn of ['renderAlbaranDetailView', 'openSignaturePad', 'firmarConRedDeSeguridad', 'drenarAlAbrir',
    'activarDrenadoAlVolver', 'logout', 'leerFirmasPendientes', 'leerRechazosDeFirma', 'huboColaAlgunaVez', 'pendientesDeSubir']) {
    assert.equal(typeof b.ctx[fn], 'function', `${fn} tiene que existir: sin ella este fichero no mide el viaje`);
  }
});

// ═══ CONTROL POSITIVO: con red, la misma secuencia llega al final ═══════════════════════════════

test('SCRUM-1351 · control: CON red, firmar en el pad hace 1 POST, vacía la cola y la pantalla pasa a firmado', async () => {
  const { b, red } = montar();
  const v = await abrirDetalle(b);
  assert.match(textoDe(v.contenedor), /emitido/);
  const r = await firmarEnPantalla(b, v.contenedor);
  assert.equal(r.padAbierto, false, 'con red el pad se cierra');
  assert.deepEqual(red.posts, [`/admin/albaranes/${ID}/firmar`]);
  assert.equal((await cola(b)).n, 0);
  const despues = textoDe(b.ctx.document.body);
  assert.match(despues, /firmado/, 'la pantalla se repinta sola a «firmado»');
  assert.equal(/Firmar aquí mismo/.test(despues), false);
});

// ═══ LOS TRAMOS LIMPIOS ═════════════════════════════════════════════════════════════════════════

test('SCRUM-1351 · firmar SIN red: se encola, el pad lo dice y es verdad; «Reintentar» no duplica', async () => {
  const { b, red } = montar();
  await b.ctx.guardarAlbaranPrecargado(PRECARGADO);
  red.conRed = false;
  const v = await abrirDetalle(b, { sinRed: true });
  const r = await firmarEnPantalla(b, v.contenedor);
  assert.equal(r.padAbierto, true, 'sin red el pad NO se cierra: el trazo sigue a la vista');
  assert.match(r.aviso, /La firma está guardada en este móvil/);
  assert.deepEqual(await cola(b), { estado: b.ctx.GUARDADO, n: 1, claves: [CLAVE], nombres: ['Ana Ruiz'] },
    'el texto dice «guardada» y la transacción confirmó: la firma ESTÁ en la cola');
  assert.equal((await b.ctx.pendientesDeSubir()).n, 1, 'y el contador de la home la cuenta');
  const r2 = await confirmarPad(b, r.pad);
  assert.match(r2.aviso, /La firma está guardada en este móvil/);
  assert.equal((await cola(b)).n, 1, 'reintentar sin red no mete una segunda');
  assert.deepEqual(red.posts, [], 'y nada llegó al servidor');
});

test('SCRUM-1351 · cola en el tope: no entra otra y el pad no afirma que se guardó', async () => {
  for (const yaHabia of [49, 50]) {
    const { b, red } = montar();
    const tope = b.ctx.TOPE_FIRMAS_EN_COLA;
    assert.equal(tope, 50, 'el control de 49/50 está escrito para un tope de 50');
    for (let i = 0; i < yaHabia; i += 1) {
      await b.ctx.encolarFirma(9000 + i, { signatureData: 'data:image/png;base64,AAAA', firmadoPorNombre: 'X' }, 'albaran');
    }
    const v = await abrirDetalle(b);
    red.conRed = false;
    const r = await firmarEnPantalla(b, v.contenedor);
    const c = await cola(b);
    if (yaHabia < tope) {
      // control: por debajo del tope SÍ entra — si no, el caso de abajo no distinguiría nada.
      assert.equal(c.claves.includes(CLAVE), true);
      assert.match(r.aviso, /La firma está guardada en este móvil/);
    } else {
      assert.equal(c.claves.includes(CLAVE), false, 'con la cola llena la firma NO se guarda');
      assert.equal(c.n, tope);
      assert.equal(/guardada en este móvil/.test(r.aviso), false, 'y el pad no puede decir que sí');
      assert.match(r.aviso, /No cabe otra firma en este móvil/);
      assert.equal(r.padAbierto, true);
    }
  }
});

test('SCRUM-1351 · sin IndexedDB, o si la escritura aborta: el pad no afirma que la firma está guardada', async () => {
  for (const caso of ['sinIndexedDB', 'aborta']) {
    const idb = caso === 'aborta' ? indexedDBQueAbortaTrasEscribir() : null;
    const { b, red } = montar(idb ? { indexedDB: idb } : { sinIndexedDB: true });
    const v = await abrirDetalle(b); // con red: sin almacén no hay precarga que abrir
    red.conRed = false;
    const r = await firmarEnPantalla(b, v.contenedor);
    assert.equal((await cola(b)).n, 0, `${caso}: no hay firma guardada`);
    assert.equal(/guardada en este móvil/.test(r.aviso), false, `${caso}: el pad no puede decir que se guardó`);
    assert.notEqual(r.aviso, '', `${caso}: y tampoco puede callar`);
    assert.equal(r.padAbierto, true, `${caso}: el trazo sigue en pantalla`);
    // control: el escenario OCURRIÓ — hubo una escritura y una transacción abortada de verdad.
    if (idb) assert.ok(idb._testigo.transaccionesAbortadas >= 1, 'el aborto tiene que haber pasado, no sólo estar configurado');
  }
});

test('SCRUM-1351 · el drenado con «ya firmado» (409 albaran_locked) saca la firma de la cola', async () => {
  const { b, red } = await conUnaFirmaEnCola();
  red.conRed = true;
  red.servidorFirmado = true;
  const d = await b.ctx.drenarAlAbrir();
  assert.equal(d.yaEstaban, 1);
  assert.equal((await cola(b)).n, 0);
  assert.equal(red.posts.length, 1, 'un solo intento');
});

// ═══ SCRUM-1353 · LO QUE EL MÓVIL SABE Y EL SERVIDOR NO, DICHO EN EL DETALLE ═══════════════════
//
// Dos de los seis defectos de arriba se arreglaron aquí (por eso ya no están en la lista). Estos
// tests fijan la conducta nueva caso a caso; el de los defectos sólo dice «ya no se observa».

const cajaDeFirmaGuardada = (cont) => todos(cont).find((n) => n && n.dataset && n.dataset.firmaGuardadaAqui === '1');
const avisoDeRechazo = (cont) => todos(cont).find((n) => n && n.dataset && n.dataset.firmaRechazada === '1');
const acciones = (cont) => todos(cont).filter((n) => n && n.dataset && n.dataset.accion).map((n) => n.dataset.accion);

test('SCRUM-1353 · control: un albarán sin firmar y SIN nada en el móvil se pinta como siempre', async () => {
  const { b } = montar();
  const v = await abrirDetalle(b);
  assert.equal(cajaDeFirmaGuardada(v.contenedor), undefined, 'sin firma en la cola no hay caja: si saliera, saldría en todos');
  assert.equal(avisoDeRechazo(v.contenedor), undefined);
  assert.ok(acciones(v.contenedor).includes('btnEnviarFirmar'), '«Enviar para firmar» se ofrece');
  assert.ok(acciones(v.contenedor).includes('btnFirmarAqui'));
});

test('SCRUM-1353 · reabrir con una firma de ESTE albarán en la cola: lo dice, deja firmar y no ofrece mandarlo a firmar', async () => {
  const { b, red } = await conUnaFirmaEnCola();
  for (const conRed of [false, true]) {
    red.conRed = conRed;
    const v = await abrirDetalle(b, { sinRed: !conRed });
    const caja = cajaDeFirmaGuardada(v.contenedor);
    assert.ok(caja, `${conRed ? 'con' : 'sin'} red: la caja de «solo en este móvil» tiene que estar`);
    const t = textoDe(v.contenedor);
    assert.ok(t.includes(b.ctx.TEXTO_FIRMA[b.ctx.FIRMA_SOLO_EN_ESTE_MOVIL].etiqueta), 'con la etiqueta YA aprobada del estado ①');
    assert.ok(t.includes(b.ctx.TEXTO_FIRMA[b.ctx.FIRMA_SOLO_EN_ESTE_MOVIL].detalle), 'y su detalle, letra por letra');
    assert.ok(acciones(v.contenedor).includes('btnFirmarAqui'), '«Firmar aquí mismo» se queda');
    assert.equal(acciones(v.contenedor).includes('btnEnviarFirmar'), false, '«Enviar para firmar» no: serían dos firmas en dos dispositivos');
  }
  // la firma de OTRO albarán no pinta nada en éste
  const otro = montar();
  await otro.b.ctx.encolarFirma(ID + 1, { signatureData: 'data:image/png;base64,AAAA', firmadoPorNombre: 'X' }, 'albaran');
  assert.equal(cajaDeFirmaGuardada((await abrirDetalle(otro.b)).contenedor), undefined, 'la cola de otro albarán no es la de éste');
});

test('SCRUM-1353 · firmar encima de una firma guardada AVISA antes de abrir el pad; si dice que no, no se toca nada', async () => {
  const { b, avisos } = await conUnaFirmaEnCola();
  const v = await abrirDetalle(b, { sinRed: true });
  assert.equal(avisos.confirm, 0, 'suelo: la primera firma, con la cola vacía, no preguntó nada');

  avisos.acepta = false;
  assert.equal(await pulsarFirmar(b, v.contenedor), null, 'si no acepta, el pad NO se abre');
  assert.deepEqual(avisos.preguntas, [b.ctx.TEXTO_YA_HAY_FIRMA_GUARDADA], 'y se le preguntó con el literal firmado');
  assert.deepEqual((await cola(b)).nombres, ['Ana Ruiz'], 'la firma guardada sigue siendo la misma');

  avisos.acepta = true;
  const r = await firmarEnPantalla(b, v.contenedor, 'OTRO FIRMANTE');
  cerrarPad(r.pad);
  assert.equal(avisos.confirm, 2, 'aceptando también se pregunta antes');
  assert.deepEqual((await cola(b)).nombres, ['OTRO FIRMANTE'], 'y entonces sí: la nueva sustituye a la anterior, como dice el texto');
});

test('SCRUM-1353 · en la MISMA pantalla, sin reabrir: firmar sin red, cancelar y volver a pulsar también avisa', async () => {
  const { b, red, avisos } = montar();
  await b.ctx.guardarAlbaranPrecargado(PRECARGADO);
  red.conRed = false;
  const v = await abrirDetalle(b, { sinRed: true });
  const r = await firmarEnPantalla(b, v.contenedor);
  cerrarPad(r.pad);
  assert.equal(avisos.confirm, 0);
  avisos.acepta = false;
  assert.equal(await pulsarFirmar(b, v.contenedor), null, 'la pantalla se pintó sin cola, pero el clic la consulta');
  assert.equal(avisos.confirm, 1);
});

test('SCRUM-1353 · el rechazo definitivo del servidor se dice en el albarán — salvo donde el texto sería falso', async () => {
  async function trasElRechazo(codigo) {
    const m = await conUnaFirmaEnCola();
    m.red.conRed = true;
    m.red.modoPost = codigo;
    const d = await m.b.ctx.drenarAlAbrir();
    assert.deepEqual(Array.from(d.rechazadas, (x) => x.codigo), [codigo], `suelo: el drenado rechaza con ${codigo}`);
    assert.equal((await m.b.ctx.leerRechazosDeFirma()).rechazos.length, 1, 'suelo: la constancia existe');
    return m;
  }

  {
    const { b } = await trasElRechazo('firma_invalida');
    const aviso = avisoDeRechazo((await abrirDetalle(b)).contenedor);
    assert.ok(aviso, 'con un rechazo que se arregla firmando otra vez, se avisa');
    assert.equal(aviso._texto, b.ctx.TEXTO_FIRMA_RECHAZADA_ALBARAN);
    assert.match(aviso.className, /alert/);
  }
  {
    // 🔴 `invalid_id`: repetir la firma da el mismo no. «Vuelve a firmar» sería falso → no se pinta.
    const { b } = await trasElRechazo('invalid_id');
    assert.equal(avisoDeRechazo((await abrirDetalle(b)).contenedor), undefined);
  }
  {
    // ya volvió a firmar (hay una nueva en la cola): el rechazo es viejo; manda la caja.
    const { b, red } = await trasElRechazo('firma_invalida');
    red.conRed = false;
    const v = await abrirDetalle(b, { sinRed: true });
    const r = await firmarEnPantalla(b, v.contenedor);
    cerrarPad(r.pad);
    const v2 = await abrirDetalle(b, { sinRed: true });
    assert.ok(cajaDeFirmaGuardada(v2.contenedor));
    assert.equal(avisoDeRechazo(v2.contenedor), undefined, 'no se le pide volver a firmar a quien ya lo ha hecho');
  }
  {
    // el servidor ya lo da por firmado: el rechazo no pide nada.
    const { b, red } = await trasElRechazo('firma_invalida');
    red.servidorFirmado = true;
    const v = await abrirDetalle(b);
    assert.match(textoDe(v.contenedor), /firmado/);
    assert.equal(avisoDeRechazo(v.contenedor), undefined);
  }
});

// SCRUM-1376 · visto en yaqu.app: el aviso de rechazo se pintaba suelto en la página y su borde
// tocaba la barra de acciones. La caja «Solo en este móvil», que ocupa ese mismo sitio en el otro
// caso, va dentro de un envoltorio que deja aire debajo. Los dos van en el MISMO envoltorio.
test('SCRUM-1376 · el aviso de rechazo va en el mismo envoltorio que la caja «Solo en este móvil», no suelto sobre los botones', async () => {
  // La referencia: el envoltorio de la caja, que es el que ya separa bien.
  const guardada = await conUnaFirmaEnCola();
  const caja = cajaDeFirmaGuardada((await abrirDetalle(guardada.b, { sinRed: true })).contenedor);
  assert.ok(caja, 'suelo: la caja se pinta');
  const separacion = caja.style.cssText;
  assert.match(separacion, /margin/, 'suelo: el envoltorio de la caja lleva su separación (si no, comparo «» con «»)');

  const m = await conUnaFirmaEnCola();
  m.red.conRed = true;
  m.red.modoPost = 'firma_invalida';
  await m.b.ctx.drenarAlAbrir();
  const v = await abrirDetalle(m.b);
  const aviso = avisoDeRechazo(v.contenedor);
  assert.ok(aviso, 'suelo: el aviso de rechazo se pinta');
  const barra = todos(v.contenedor).find((n) => n && n.className === 'job-doc-toolbar');
  assert.ok(barra, 'suelo: la barra de acciones está');
  assert.notEqual(aviso._padre, barra._padre, 'el aviso NO es hermano directo de la barra de acciones');
  assert.equal(aviso._padre.style.cssText, separacion, 'su envoltorio separa igual que el de la caja');
  assert.match(aviso.className, /^alert warning$/, 'y el aviso sigue siendo el componente de siempre');
});

test('SCRUM-1353 · sin almacén que leer no se afirma nada: ni caja, ni aviso, ni pregunta', async () => {
  const { b, avisos } = montar({ sinIndexedDB: true });
  const v = await abrirDetalle(b);
  assert.equal(cajaDeFirmaGuardada(v.contenedor), undefined);
  assert.ok(acciones(v.contenedor).includes('btnEnviarFirmar'));
  const aviso = await pulsarFirmar(b, v.contenedor);
  assert.ok(aviso, 'el pad se abre igual');
  assert.equal(avisos.confirm, 0);
});

// ═══ SCRUM-1374 · EL DETALLE ABIERTO SE ENTERA DE QUE SU FIRMA HA SUBIDO ═══════════════════════
//
// La cola avisa (`alConfirmarseFirmas`, SCRUM-1373) y la vista decide. Cada «no se repinta» de
// abajo lleva al lado su suelo: el drenado SUBIÓ y el aviso SALIÓ. Sin eso, una pantalla quieta
// porque no pasó nada se leería igual que una pantalla que supo no repintarse.

const getsDelAlbaran = (red) => red.gets.filter((u) => /\/admin\/albaranes\/\d+$/.test(u)).length;

/** Vuelve la red con el drenado enganchado, como en la app. Devuelve lo que la cola avisó. */
async function vuelveLaRed(b, red) {
  const avisado = [];
  const dejar = b.ctx.alConfirmarseFirmas((l) => { avisado.push(...l.map((c) => `${c.tipo}:${c.documentoId}`)); });
  const { win, doc } = emisores();
  b.ctx.activarDrenadoAlVolver(win, doc);
  red.conRed = true;
  win.disparar('online');
  await esperar(300);
  dejar();
  return avisado;
}

test('SCRUM-1374 · detalle abierto + firma en la cola + vuelve la red: pasa a «firmado» solo y deja de ofrecer firmar', async () => {
  const { b, red } = await conUnaFirmaEnCola();
  const v = await abrirDetalle(b, { sinRed: true });
  assert.equal(ofreceFirmar(v.contenedor), true, 'suelo: antes de volver la red la pantalla ofrece firmar');
  assert.deepEqual(await vuelveLaRed(b, red), [`albaran:${ID}`], 'suelo: la cola subió y avisó de ESTE albarán');
  assert.match(textoDe(v.contenedor), /firmado/, 'la pantalla pasa a «firmado» sin recargar a mano');
  assert.equal(ofreceFirmar(v.contenedor), false, 'y ya no ofrece «Firmar aquí mismo»');
  assert.equal(cajaDeFirmaGuardada(v.contenedor), undefined, 'ni dice que la firma sigue sólo en este móvil');
});

test('SCRUM-1374 · con el pad de firma ABIERTO no se repinta', async () => {
  const { b, red } = montar();
  await b.ctx.guardarAlbaranPrecargado(PRECARGADO);
  red.conRed = false;
  const v = await abrirDetalle(b, { sinRed: true });
  const r = await firmarEnPantalla(b, v.contenedor);
  assert.equal(r.padAbierto, true, 'suelo: sin red el pad se queda abierto, con el trazo a la vista');
  const antes = textoDe(v.contenedor);
  const lecturas = getsDelAlbaran(red);
  assert.deepEqual(await vuelveLaRed(b, red), [`albaran:${ID}`], 'suelo: la cola subió y avisó de ESTE albarán');
  assert.equal(enDocumento(b, r.pad.overlay), true, 'el pad sigue en pantalla');
  assert.equal(getsDelAlbaran(red), lecturas, 'la ficha no se ha vuelto a pedir');
  assert.equal(textoDe(v.contenedor), antes, 'y lo de debajo del pad está como estaba');
});

test('SCRUM-1374 · el aviso de OTRO documento no repinta: ni otro albarán, ni un parte con el mismo número', async () => {
  const { b, red } = montar();
  const v = await abrirDetalle(b);
  const antes = textoDe(v.contenedor);
  const lecturas = getsDelAlbaran(red);
  red.conRed = false;
  const firma = { signatureData: 'data:image/png;base64,AAAA', firmadoPorNombre: 'X' };
  await b.ctx.encolarFirma(ID + 1, firma, 'albaran');
  await b.ctx.encolarFirma(ID, firma, 'parte');
  const avisado = await vuelveLaRed(b, red);
  assert.deepEqual([...avisado].sort(), [`albaran:${ID + 1}`, `parte:${ID}`], 'suelo: las dos subieron y de las dos se avisó');
  assert.equal(getsDelAlbaran(red), lecturas, 'la ficha no se ha vuelto a pedir');
  assert.equal(textoDe(v.contenedor), antes, 'y la pantalla está como estaba');
});

test('SCRUM-1374 · una ficha que ya no está en pantalla no se repinta, y deja de escuchar', async () => {
  const { b, red } = await conUnaFirmaEnCola();
  const v = await abrirDetalle(b, { sinRed: true });
  v.contenedor.innerHTML = ''; // se navegó a otra pantalla: el contenedor es el mismo, la ficha no está
  const lecturas = getsDelAlbaran(red);
  assert.deepEqual(await vuelveLaRed(b, red), [`albaran:${ID}`], 'suelo: la cola subió y avisó de ESTE albarán');
  assert.equal(getsDelAlbaran(red), lecturas, 'nadie ha vuelto a pedir la ficha');
  assert.equal(/ALB-2026-007/.test(textoDe(v.contenedor)), false, 'ni la ha pintado encima de lo que haya ahora');
});

// ═══ SCRUM-1420 · EL AVISO QUE LLEGÓ CON EL PAD ABIERTO SE RECUERDA HASTA QUE SE CIERRA ════════
//
// SCRUM-1374 no repinta debajo de un pad abierto, y nadie se acordaba después: al cerrarlo la
// ficha seguía en «emitido». El pad dice cuándo se cierra (`onClose`, contrato en
// `docs/master/SCRUM-1420.md`); la vista recuerda el aviso y se pone al día entonces.

/** Sin red: abre la ficha, firma, y deja el pad ABIERTO con su aviso. */
async function conElPadAbiertoSinRed() {
  const { b, red } = montar();
  await b.ctx.guardarAlbaranPrecargado(PRECARGADO);
  red.conRed = false;
  const v = await abrirDetalle(b, { sinRed: true });
  const r = await firmarEnPantalla(b, v.contenedor);
  assert.equal(r.padAbierto, true, 'suelo: sin red el pad se queda abierto');
  return { b, red, v, pad: r.pad };
}

test('SCRUM-1420 · pad abierto + la firma sube + se cierra el pad: la ficha pasa a «firmado» sin recargar a mano', async () => {
  const { b, red, v, pad } = await conElPadAbiertoSinRed();
  const lecturas = getsDelAlbaran(red);
  assert.deepEqual(await vuelveLaRed(b, red), [`albaran:${ID}`], 'suelo: la cola subió y avisó de ESTE albarán');
  // El control: mientras el pad siga abierto NO se repinta (aceptación 2 de SCRUM-1374).
  assert.equal(enDocumento(b, pad.overlay), true, 'el pad sigue en pantalla');
  assert.equal(getsDelAlbaran(red), lecturas, 'con el pad abierto la ficha no se ha vuelto a pedir');
  assert.equal(ofreceFirmar(v.contenedor), true, 'y debajo sigue lo que había');

  cerrarPad(pad);
  await esperar(150);
  assert.equal(enDocumento(b, pad.overlay), false, 'suelo: el pad se ha cerrado');
  assert.equal(getsDelAlbaran(red), lecturas + 1, 'al cerrarse el pad la ficha se pide UNA vez');
  assert.match(textoDe(v.contenedor), /firmado/, 'la pantalla pasa a «firmado»');
  assert.equal(ofreceFirmar(v.contenedor), false, 'y ya no ofrece «Firmar aquí mismo»');
});

test('SCRUM-1420 · el pad se cierra sin que haya llegado ningún aviso: ni una lectura de más', async () => {
  const { b, red, v, pad } = await conElPadAbiertoSinRed();
  red.conRed = true; // hay red: si la ficha se pidiera, se vería. Pero nadie ha drenado ni avisado.
  const lecturas = getsDelAlbaran(red);
  const antes = textoDe(v.contenedor);
  cerrarPad(pad);
  await esperar(150);
  assert.equal(enDocumento(b, pad.overlay), false, 'suelo: el pad se ha cerrado');
  assert.equal(getsDelAlbaran(red), lecturas, 'nadie ha vuelto a pedir la ficha');
  assert.equal(textoDe(v.contenedor), antes, 'y la pantalla está como estaba');
});

test('SCRUM-1420 · con el pad abierto llega el aviso de OTRO documento: al cerrarlo no se lee nada', async () => {
  const { b, red, v, pad } = await conElPadAbiertoSinRed();
  // La firma de este albarán sale de la cola a mano: lo que suba será sólo lo ajeno.
  await b.ctx.quitarFirmaPendiente(CLAVE);
  assert.equal((await cola(b)).n, 0, 'suelo: la firma de este albarán ya no está en la cola');
  const firma = { signatureData: 'data:image/png;base64,AAAA', firmadoPorNombre: 'X' };
  await b.ctx.encolarFirma(ID + 1, firma, 'albaran');
  await b.ctx.encolarFirma(ID, firma, 'parte');
  const avisado = await vuelveLaRed(b, red);
  assert.deepEqual([...avisado].sort(), [`albaran:${ID + 1}`, `parte:${ID}`], 'suelo: las dos ajenas subieron y de las dos se avisó');
  const lecturas = getsDelAlbaran(red);
  cerrarPad(pad);
  await esperar(150);
  assert.equal(enDocumento(b, pad.overlay), false, 'suelo: el pad se ha cerrado');
  assert.equal(getsDelAlbaran(red), lecturas, 'un aviso que no es de este albarán no se recuerda');
  assert.equal(ofreceFirmar(v.contenedor), true, 'la ficha sigue ofreciendo firmar: su firma no ha subido');
});

test('SCRUM-1420 · el aviso llega con el pad abierto y la ficha deja de estar en pantalla: cerrar el pad no la pinta encima', async () => {
  const { b, red, v, pad } = await conElPadAbiertoSinRed();
  assert.deepEqual(await vuelveLaRed(b, red), [`albaran:${ID}`], 'suelo: la cola subió y avisó de ESTE albarán');
  v.contenedor.innerHTML = ''; // se navegó con el pad aún abierto
  const lecturas = getsDelAlbaran(red);
  cerrarPad(pad);
  await esperar(150);
  assert.equal(getsDelAlbaran(red), lecturas, 'nadie ha vuelto a pedir la ficha');
  assert.equal(/ALB-2026-007/.test(textoDe(v.contenedor)), false, 'ni la ha pintado encima de lo que haya ahora');
});

test('SCRUM-1420 · control: firmar CON red sigue leyendo la ficha UNA vez (el cierre del pad no añade otra)', async () => {
  const { b, red } = montar();
  const v = await abrirDetalle(b);
  const lecturas = getsDelAlbaran(red);
  const r = await firmarEnPantalla(b, v.contenedor);
  await esperar(150);
  assert.equal(r.padAbierto, false, 'suelo: con red el pad se cierra');
  assert.equal(getsDelAlbaran(red), lecturas + 1, 'una lectura: la del refresco tras firmar');
  assert.match(textoDe(v.contenedor), /firmado/);
});

// ═══ SCRUM-1460 · LA COPIA DEL CLIENTE, RECORDADA JUSTO DESPUÉS DE FIRMAR EN EL PAD ════════════
//
// Firmar en el pad no manda la copia (SCRUM-47, a propósito). Medido en yaqu.app el 6-oct-2026:
// tras «Confirmar firma» sólo se leía «A salvo — Guardado en YaQu». Los dos literales y dónde salen
// están firmados en SCRUM-1460 comentario 18330; aquí van letra por letra.
//
// Cada «no sale» de abajo lleva su suelo al lado: la ficha SÍ está firmada y SÍ pinta «A salvo».
// Sin eso, un recordatorio que no sale porque la ficha no se pintó se leería igual.

const R1_COPIA = 'El cliente todavía no tiene su copia. Envíasela por WhatsApp.';
const R2_COPIA = 'No podemos enviarle la copia por WhatsApp a este cliente. Descarga el PDF para dársela.';
const recordatorios = (cont) => todos(cont).filter((n) => n && n.dataset && n.dataset.copiaSinEnviar);
const firmadaYASalvo = (cont) => /firmado/.test(textoDe(cont)) && /A salvo/.test(textoDe(cont));

/** Con red: abre la ficha, firma en el pad y devuelve la ficha que queda. */
async function recienFirmadoConRed(cliente = {}) {
  const m = montar();
  m.red.cliente = cliente;
  const v = await abrirDetalle(m.b);
  assert.deepEqual(recordatorios(v.contenedor), [], 'suelo: antes de firmar no hay recordatorio');
  const r = await firmarEnPantalla(m.b, v.contenedor);
  await esperar(150);
  assert.equal(r.padAbierto, false, 'suelo: con red el pad se cierra');
  assert.equal(firmadaYASalvo(v.contenedor), true, 'suelo: la ficha que queda está firmada y dice «A salvo»');
  return { ...m, v };
}

async function recuerdaMandarLaCopiaPorWhatsApp(cliente) {
  const { v } = await recienFirmadoConRed(cliente);
  const [aviso, ...mas] = recordatorios(v.contenedor);
  assert.ok(aviso, 'tiene que salir el recordatorio: sin él lo último que se lee es «A salvo»');
  assert.deepEqual(mas, [], 'y uno solo');
  assert.equal(aviso._texto, R1_COPIA, 'el literal firmado, letra por letra');
  assert.equal(aviso.className, 'alert info');
  assert.equal(aviso.dataset.copiaSinEnviar, 'whatsapp');
  assert.ok(acciones(v.contenedor).includes('btnWhatsApp'), 'el botón que el texto manda pulsar está en la barra');
}

test('SCRUM-1460 · tras firmar en el pad, la ficha recuerda mandar la copia (el servidor dice que el cliente puede recibir WhatsApp)', async () => {
  await recuerdaMandarLaCopiaPorWhatsApp({ puedeRecibirWhatsApp: true });
});

test('SCRUM-1460 · tras firmar en el pad, la ficha recuerda mandar la copia (el servidor no dice nada del canal y el botón se ofrece igual)', async () => {
  await recuerdaMandarLaCopiaPorWhatsApp({});
});

test('SCRUM-1460 · el recordatorio va DEBAJO de «A salvo» y ENCIMA de los botones, con la separación de la caja', async () => {
  const { v } = await recienFirmadoConRed();
  const nodos = todos(v.contenedor);
  const aSalvo = nodos.findIndex((n) => n && n._texto === 'A salvo');
  const aviso = nodos.indexOf(recordatorios(v.contenedor)[0]);
  const barra = nodos.findIndex((n) => n && n.className === 'job-doc-toolbar');
  assert.ok(aSalvo >= 0 && aviso >= 0 && barra >= 0, `suelo: los tres están en la ficha (${aSalvo}, ${aviso}, ${barra})`);
  assert.ok(aSalvo < aviso && aviso < barra, `orden en pantalla: «A salvo» ${aSalvo} · recordatorio ${aviso} · botones ${barra}`);
  // Como el rechazo (SCRUM-1376): en un envoltorio con el margen de la caja, no pegado a la barra.
  const envoltorio = nodos[aviso]._padre;
  assert.notEqual(envoltorio, nodos[barra]._padre, 'no es hermano directo de la barra de acciones');
  const cajaASalvo = nodos[aSalvo]._padre;
  assert.match(cajaASalvo.style.cssText, /margin/, 'suelo: el envoltorio de «A salvo» lleva su separación');
  assert.equal(envoltorio.style.cssText, cajaASalvo.style.cssText, 'el del recordatorio separa igual');
});

test('SCRUM-1460 · cliente que NO puede recibir WhatsApp: se dice eso y se manda al PDF, que sí está', async () => {
  const { v } = await recienFirmadoConRed({ puedeRecibirWhatsApp: false });
  const [aviso, ...mas] = recordatorios(v.contenedor);
  assert.ok(aviso, 'tiene que salir: es el cliente al que no le queda nada que hable de su copia');
  assert.deepEqual(mas, []);
  assert.equal(aviso._texto, R2_COPIA, 'el literal firmado, letra por letra');
  assert.equal(aviso.className, 'alert warning');
  assert.equal(aviso.dataset.copiaSinEnviar, 'pdf');
  const barra = acciones(v.contenedor);
  assert.ok(barra.includes('btnPdf'), 'el botón que el texto manda pulsar está en la barra');
  assert.equal(barra.includes('btnWhatsApp'), false, 'y el de WhatsApp no se ofrece: por eso no se le nombra');
});

test('SCRUM-1460 · al REABRIR la ficha ya firmada el recordatorio no sale: la ficha no sabe si la copia se mandó', async () => {
  const { b, v } = await recienFirmadoConRed();
  assert.equal(recordatorios(v.contenedor).length, 1, 'suelo: recién firmado sí sale');
  const otra = await abrirDetalle(b);
  assert.equal(firmadaYASalvo(otra.contenedor), true, 'suelo: la ficha reabierta está firmada y dice «A salvo»');
  assert.deepEqual(recordatorios(otra.contenedor), [], 'reabierta, no afirma nada de la copia');
});

test('SCRUM-1460 · LÍMITE FIRMADO: la firma que sube desde la cola SIN pad abierto no trae recordatorio', async () => {
  const { b, red } = await conUnaFirmaEnCola();
  const v = await abrirDetalle(b, { sinRed: true });
  assert.deepEqual(await vuelveLaRed(b, red), [`albaran:${ID}`], 'suelo: la cola subió y avisó de ESTE albarán');
  assert.equal(firmadaYASalvo(v.contenedor), true, 'suelo: la ficha pasó sola a firmada');
  assert.deepEqual(recordatorios(v.contenedor), [],
    'la firma de SCRUM-1460 (c.18330 y c.18374) deja fuera la subida por la cola sin pad; ampliarlo pide firma');
});

// c.18374 amplía la firma: firmar sin red, vuelve la señal con el pad abierto, y al cerrarlo la
// ficha pasa a firmada. La cola no manda la copia y quien cierra el pad está mirando la ficha.
test('SCRUM-1460 · firmar sin red, sube con el pad ABIERTO y se cierra el pad: la ficha firmada recuerda la copia', async () => {
  const { b, red, v, pad } = await conElPadAbiertoSinRed();
  assert.deepEqual(await vuelveLaRed(b, red), [`albaran:${ID}`], 'suelo: la cola subió y avisó de ESTE albarán');
  assert.deepEqual(recordatorios(v.contenedor), [], 'suelo: con el pad abierto la ficha de debajo no se ha tocado');
  cerrarPad(pad);
  await esperar(150);
  assert.equal(firmadaYASalvo(v.contenedor), true, 'suelo: al cerrar el pad la ficha pasa a firmada');
  const [aviso, ...mas] = recordatorios(v.contenedor);
  assert.ok(aviso, 'tiene que salir: la copia no ha salido por ningún camino y hay alguien mirando');
  assert.deepEqual(mas, []);
  assert.equal(aviso._texto, R1_COPIA, 'el mismo literal: c.18374 cambia cuándo, no qué');
});

test('SCRUM-1460 · mandar la copia y que salga bien QUITA el recordatorio', async () => {
  const { red, v } = await recienFirmadoConRed();
  assert.equal(recordatorios(v.contenedor).length, 1, 'suelo: antes de mandarla el recordatorio está');
  red.respuestaWhatsApp = { sent: true };
  todos(v.contenedor).find((n) => n && n.dataset && n.dataset.accion === 'btnWhatsApp').click();
  await esperar(150);
  assert.deepEqual(red.posts.slice(-1), [`/admin/albaranes/${ID}/enviar-whatsapp`], 'suelo: el envío se pidió');
  assert.equal(firmadaYASalvo(v.contenedor), true, 'suelo: la ficha sigue pintada y firmada');
  assert.deepEqual(recordatorios(v.contenedor), [], 'la copia ya salió: «todavía no tiene su copia» sería falso');
});

test('SCRUM-1460 · si el envío NO sale, el recordatorio se queda (el cliente sigue sin su copia)', async () => {
  const { red, v } = await recienFirmadoConRed();
  red.respuestaWhatsApp = { sent: false, message: 'No se pudo enviar el WhatsApp.' };
  todos(v.contenedor).find((n) => n && n.dataset && n.dataset.accion === 'btnWhatsApp').click();
  await esperar(150);
  assert.deepEqual(red.posts.slice(-1), [`/admin/albaranes/${ID}/enviar-whatsapp`], 'suelo: el envío se pidió');
  assert.match(textoDe(v.contenedor), /No se pudo enviar el WhatsApp\./, 'suelo: el fallo se dice');
  assert.equal(recordatorios(v.contenedor).length, 1, 'y el recordatorio sigue ahí');
  assert.equal(recordatorios(v.contenedor)[0]._texto, R1_COPIA);
});

test('SCRUM-1460 · el decisor: cada texto pide SU botón, y «no podemos» pide SABER que no hay canal', () => {
  const { recordatorioDeLaCopia } = require('../public/dashboard/js/albaranDetailView.js');
  const base = { recienFirmadoEnElPad: true, estado: 'firmado', ofreceEnviarPorWhatsApp: true, ofreceDescargarPdf: true, clienteConWhatsApp: true };
  assert.equal(recordatorioDeLaCopia(base).texto, R1_COPIA, 'suelo: el caso normal contesta');
  assert.equal(recordatorioDeLaCopia({ ...base, recienFirmadoEnElPad: undefined }), null, 'sin venir de firmar en el pad');
  assert.equal(recordatorioDeLaCopia({ ...base, estado: 'emitido' }), null, 'el servidor aún no lo da por firmado');
  const sinBoton = { ...base, ofreceEnviarPorWhatsApp: false };
  assert.equal(recordatorioDeLaCopia({ ...sinBoton, clienteConWhatsApp: false }).texto, R2_COPIA, 'suelo: sin canal, contesta el otro');
  assert.equal(recordatorioDeLaCopia({ ...sinBoton, clienteConWhatsApp: undefined }), null, 'sin botón y sin saber del canal: no se afirma');
  assert.equal(recordatorioDeLaCopia({ ...sinBoton, clienteConWhatsApp: true }), null, 'sin botón, no se manda a pulsarlo');
  assert.equal(recordatorioDeLaCopia({ ...sinBoton, clienteConWhatsApp: false, ofreceDescargarPdf: false }), null, 'sin PDF, no se manda a descargarlo');
});

// ═══ LOS DEFECTOS: se MIDEN, y lo medido tiene que ser lo declarado ═════════════════════════════

/**
 * Recorre los tramos defectuosos y devuelve los que HOY se observan.
 *
 * Cada detector compara conductas, no busca frases: un arreglo futuro traerá un texto que hoy no
 * existe, y un detector por `/pendiente|guardada/` lo dejaría pasar sin enterarse.
 */
async function defectosObservados() {
  const vistos = [];

  // ① y ⑥ salen del caso NORMAL y del detalle que se quedó abierto.
  {
    const { b } = montar();
    const v = await abrirDetalle(b);
    await firmarEnPantalla(b, v.contenedor);
    // ⑥ · firmar con red no deja nada pendiente; la marca «hubo cola» dice lo contrario, y el
    //     arranque siguiente puede pintar «el móvil ha borrado firmas sin subir».
    if ((await cola(b)).n === 0 && b.ctx.huboColaAlgunaVez() === true) vistos.push('firmar-con-red-deja-la-marca-de-que-hubo-cola');
  }
  {
    const { b, red } = await conUnaFirmaEnCola();
    const v = await abrirDetalle(b, { sinRed: true });
    const antes = textoDe(v.contenedor);
    const { win, doc } = emisores();
    b.ctx.activarDrenadoAlVolver(win, doc);
    red.conRed = true;
    win.disparar('online');
    await esperar(300);
    assert.deepEqual(red.posts, [`/admin/albaranes/${ID}/firmar`], 'suelo: al volver la red la cola SUBE');
    assert.equal((await cola(b)).n, 0, 'suelo: y queda vacía');
    // ③ · el servidor ya la tiene y la pantalla abierta sigue igual, ofreciendo firmar.
    if (textoDe(v.contenedor) === antes && ofreceFirmar(v.contenedor)) vistos.push('el-detalle-abierto-no-se-entera-de-que-la-cola-subio');
    // ① · el profesional, que sigue viendo «emitido», firma otra vez. El servidor contesta «ya
    //     está firmado»: la firma ESTÁ registrada. Decirle que no, y volver a encolarla, es falso.
    if (ofreceFirmar(v.contenedor)) {
      const r = await firmarEnPantalla(b, v.contenedor);
      const reencolada = (await cola(b)).n > 0;
      if (reencolada || /No hemos podido registrar la firma/.test(r.aviso)) vistos.push('firmar-lo-ya-subido-dice-que-no-se-registro-y-reencola');
    }
  }

  // ② · reabrir sin red con una firma guardada: la pantalla es la MISMA que sin ninguna, y firmar
  //     otra vez reemplaza la guardada sin decirlo.
  {
    const limpio = montar();
    await limpio.b.ctx.guardarAlbaranPrecargado(PRECARGADO);
    limpio.red.conRed = false;
    const sinCola = textoDe((await abrirDetalle(limpio.b, { sinRed: true })).contenedor);

    const { b, avisos } = await conUnaFirmaEnCola();
    const v = await abrirDetalle(b, { sinRed: true });
    const calla = textoDe(v.contenedor) === sinCola;
    // Reemplazar se puede; lo que no se puede es reemplazar SIN HABERLO DICHO antes.
    let sobrescribeSinAvisar = false;
    if (ofreceFirmar(v.contenedor)) {
      const preguntasAntes = avisos.confirm;
      const r = await firmarEnPantalla(b, v.contenedor, 'OTRO FIRMANTE');
      cerrarPad(r.pad);
      sobrescribeSinAvisar = (await cola(b)).nombres.join() === 'OTRO FIRMANTE' && avisos.confirm === preguntasAntes;
    }
    if (calla || sobrescribeSinAvisar) vistos.push('reabrir-sin-red-calla-la-firma-guardada-y-refirmar-la-sobrescribe');
  }

  // ④ · el servidor rechaza la firma para siempre al drenar: sale de la cola, queda constancia…
  //     y el detalle del albarán se pinta igual que si nunca se hubiera firmado.
  {
    const limpio = montar();
    const nunca = textoDe((await abrirDetalle(limpio.b)).contenedor);

    const { b, red } = await conUnaFirmaEnCola();
    red.conRed = true;
    red.modoPost = 'firma_invalida';
    const d = await b.ctx.drenarAlAbrir();
    // `Array.from`: la lista nace en el contexto del banco y `deepEqual` estricto mira el prototipo.
    assert.deepEqual(Array.from(d.rechazadas, (x) => x.clave), [CLAVE], 'suelo: el drenado la da por rechazada');
    assert.equal((await cola(b)).n, 0, 'suelo: y sale de la cola');
    assert.equal((await b.ctx.leerRechazosDeFirma()).rechazos.length, 1, 'suelo: la constancia del rechazo se escribió');
    const v = await abrirDetalle(b);
    if (textoDe(v.contenedor) === nunca) vistos.push('rechazo-definitivo-del-drenado-no-se-ve-en-el-albaran');
  }

  // ⑤ · cerrar sesión con una firma sin subir: se borra (es diseño) y nadie lo dice.
  {
    const { b, avisos } = await conUnaFirmaEnCola();
    const antes = textoDe(b.ctx.document.body);
    await b.ctx.logout();
    const borrada = (await cola(b)).n === 0;
    const callado = avisos.confirm === 0 && avisos.alert === 0 && textoDe(b.ctx.document.body) === antes;
    if (borrada && callado) vistos.push('cerrar-sesion-borra-la-cola-sin-avisar');
  }

  return vistos;
}

test('SCRUM-1351 · los defectos del viaje son EXACTAMENTE los declarados (ni uno arreglado sin retirar, ni uno nuevo)', async () => {
  assert.equal(new Set(DEFECTOS_DECLARADOS).size, DEFECTOS_DECLARADOS.length, 'una entrada repetida esconde otra');
  // Una clave mal escrita en el JSON nunca coincidiría con nada: se leería como «arreglado» y,
  // a la vez, el defecto de verdad como «nuevo». Mejor decir que es una errata.
  assert.deepEqual(DEFECTOS_DECLARADOS.filter((d) => !DEFECTOS_QUE_SE_SABEN_MEDIR.includes(d)), [],
    '🔴 el JSON declara un defecto que este test no sabe medir: ¿errata en la clave?');
  const vistos = await defectosObservados();
  const arreglados = DEFECTOS_DECLARADOS.filter((d) => !vistos.includes(d));
  const nuevos = vistos.filter((d) => !DEFECTOS_DECLARADOS.includes(d));
  assert.deepEqual(arreglados, [],
    '✅ este defecto ya NO se observa: BORRA su entrada de scripts/_defectos-viaje-firma-declarados.json en el mismo commit que lo arregla.');
  assert.deepEqual(nuevos, [],
    '🔴 el viaje de la firma sin red del albarán tiene un defecto que no estaba declarado.');
});
