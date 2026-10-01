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
// Los de `DEFECTOS_DECLARADOS` existen HOY y este fichero no los arregla: `colaDeFirmas.js`,
// `almacenLocal.js` y `app.js` son de otro carril. Nacieron seis; SCRUM-1353 arregló los dos de
// `albaranDetailView.js` y borró sus líneas. El test los MIDE y exige que lo medido sea
// exactamente lo declarado:
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

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const dom = require('../dist/modules/jobs/domain/albaranFirmante.js');

/** Los defectos que el viaje tiene HOY. Uno por línea; el que se arregla se BORRA. */
const DEFECTOS_DECLARADOS = [
  'firmar-lo-ya-subido-dice-que-no-se-registro-y-reencola',
  'el-detalle-abierto-no-se-entera-de-que-la-cola-subio',
  'cerrar-sesion-borra-la-cola-sin-avisar',
  'firmar-con-red-deja-la-marca-de-que-hubo-cola',
];

const ID = 7;
const CLAVE = 'firma:albaran:' + ID;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const albaranDelServidor = (estado) => ({
  id: ID, numero: 'ALB-2026-007', estado, fecha: '2026-09-29T08:00:00.000Z', lugarEntrega: 'C/ Mayor 3',
  lineas: [{ concepto: 'Sustituir bajante', cantidad: 1, unidad: 'ud' }], customer: { name: 'Comunidad Los Olivos' },
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
  const e = { conRed: true, modoPost: 'ok', servidorFirmado: false, posts: [] };
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
      if (/\/admin\/albaranes\/\d+\/fotos/.test(u)) return responder(200, []);
      if (/\/admin\/albaranes\/\d+$/.test(u)) return responder(200, albaranDelServidor(e.servidorFirmado ? 'firmado' : 'emitido'));
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

test('SCRUM-1353 · sin almacén que leer no se afirma nada: ni caja, ni aviso, ni pregunta', async () => {
  const { b, avisos } = montar({ sinIndexedDB: true });
  const v = await abrirDetalle(b);
  assert.equal(cajaDeFirmaGuardada(v.contenedor), undefined);
  assert.ok(acciones(v.contenedor).includes('btnEnviarFirmar'));
  const aviso = await pulsarFirmar(b, v.contenedor);
  assert.ok(aviso, 'el pad se abre igual');
  assert.equal(avisos.confirm, 0);
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
  const vistos = await defectosObservados();
  const arreglados = DEFECTOS_DECLARADOS.filter((d) => !vistos.includes(d));
  const nuevos = vistos.filter((d) => !DEFECTOS_DECLARADOS.includes(d));
  assert.deepEqual(arreglados, [],
    '✅ este defecto ya NO se observa: BORRA su línea de DEFECTOS_DECLARADOS en el mismo commit que lo arregla.');
  assert.deepEqual(nuevos, [],
    '🔴 el viaje de la firma sin red del albarán tiene un defecto que no estaba declarado.');
});
