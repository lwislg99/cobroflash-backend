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
// Los seis de `DEFECTOS_DECLARADOS` existen HOY y este fichero no los arregla: `colaDeFirmas.js`,
// `almacenLocal.js` y `app.js` son de otro carril, y tres piden un texto que nadie ha firmado
// (regla 39). El test los MIDE y exige que lo medido sea exactamente lo declarado:
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
  'reabrir-sin-red-calla-la-firma-guardada-y-refirmar-la-sobrescribe',
  'el-detalle-abierto-no-se-entera-de-que-la-cola-subio',
  'rechazo-definitivo-del-drenado-no-se-ve-en-el-albaran',
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
  const avisos = { confirm: 0, alert: 0 };
  b.ctx.confirm = () => { avisos.confirm += 1; return true; };
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
async function firmarEnPantalla(b, cont, nombre = 'Ana Ruiz') {
  const btn = todos(cont).find((n) => n && n.dataset && n.dataset.accion === 'btnFirmarAqui');
  assert.ok(btn, 'la pantalla tiene que ofrecer «Firmar aquí mismo»: sin botón no hay viaje que medir');
  btn.click();
  const cuerpo = b.ctx.document.body;
  const aviso = todos(cuerpo).filter((n) => n && n.hasAttribute && n.hasAttribute('data-sp-aviso')).pop();
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

    const { b } = await conUnaFirmaEnCola();
    const v = await abrirDetalle(b, { sinRed: true });
    const calla = textoDe(v.contenedor) === sinCola;
    let sobrescribe = false;
    if (ofreceFirmar(v.contenedor)) {
      const r = await firmarEnPantalla(b, v.contenedor, 'OTRO FIRMANTE');
      cerrarPad(r.pad);
      sobrescribe = (await cola(b)).nombres.join() === 'OTRO FIRMANTE';
    }
    if (calla || sobrescribe) vistos.push('reabrir-sin-red-calla-la-firma-guardada-y-refirmar-la-sobrescribe');
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
