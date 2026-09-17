// tests/scrum890b-rechazo-visible.test.mjs — SCRUM-890 · PR 2
//
// DOS FALLOS MUDOS QUE QUEDABAN EN EL PARTE DESPUÉS DEL PR 1 (#1373):
//
//   ① FIRMAR UN PARTE SIN RED CERRABA EL PAD. `firmarConRedDeSeguridad` devuelve ② (sólo en este
//     móvil) DENTRO del resultado y `firmarParte` no lo relanzaba: el pad se cerraba como si el
//     cliente hubiera firmado. El albarán lo resuelve desde SCRUM-358 (`albaranDetailView.js:554`):
//     sin ③ se relanza `mensajeDeFalloAlFirmar`. Aquí se exige EL MISMO literal, no uno nuevo.
//
//   ② UN RECHAZO AL VACIAR LA COLA NO LO VEÍA NADIE. `drenarAlAbrir` descarta su resultado y la
//     firma rechazada ya ha salido de IndexedDB: la pantalla del parte no tenía qué leer. Decidido
//     (orquestador, 16-sep): constancia POR DOCUMENTO en el mismo IndexedDB de la cola, que se
//     borra cuando ese documento se vuelve a firmar con éxito.
//
// Se ejercita con el DASHBOARD ENTERO (`_banco-almacen-local.mjs`): los scripts reales en el orden
// de `index.html`, `api.js` de verdad sobre un `fetch` controlado y un IndexedDB que cumple el
// estándar. La pantalla se lee con el mini-DOM del banco, no con un contenedor de mentira.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { montarAlmacen, porQueEstariaCiego } from './_banco-almacen-local.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const PARTE = {
  id: 7, numero: 'PT-2026-001', clienteNombre: 'Comunidad Los Olivos',
  fecha: '2026-09-16T08:00:00.000Z', obra: 'C/ Mayor 3', referencia: null,
  entrada: null, salida: null, desplazamientos: null, kilometros: null, tecnicos: [],
  tipo: 'reparacion_asistencia', notas: null, estado: 'borrador',
  lineas: [{ bloque: 'mano_obra', unds: 2, descripcion: 'Revisión de caldera' }],
  firmoElCliente: false, firmoElTecnico: false,
  puedeEditarContenido: { ok: true, motivo: null },
  puedeEditarPrecios: { ok: true, motivo: null },
};

/**
 * La red, con un interruptor. `alFirmar` decide qué responde el POST de firma: `null` es la red
 * caída (`fetch` lanza, como un móvil sin cobertura), un `{status, data}` es la respuesta del servidor.
 * El GET del parte responde siempre: lo que se mide es la firma, no la carga.
 */
function red() {
  const estado = { alFirmar: null, posts: [] };
  const responder = (status, data) => ({
    ok: status >= 200 && status < 300, status, statusText: String(status),
    headers: { get: () => 'application/json' },
    json: async () => data, blob: async () => ({}), text: async () => JSON.stringify(data),
  });
  estado.fetch = async (url, opts) => {
    const metodo = (opts && opts.method) || 'GET';
    if (metodo === 'GET') return responder(200, PARTE);
    estado.posts.push(String(url));
    if (estado.alFirmar === null) throw new TypeError('Failed to fetch');
    return responder(estado.alFirmar.status, estado.alFirmar.data);
  };
  estado.navigator = { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } };
  return estado;
}

function montar() {
  const r = red();
  const b = montarAlmacen(RAIZ, { dashboard: { red: r } });
  const ciego = porQueEstariaCiego(b, RAIZ);
  assert.equal(ciego, null, `🔴 BANCO CIEGO: ${ciego}`);
  for (const n of ['firmarParte', 'renderParteDetailView', 'drenarAlAbrir', 'mensajeDeFalloAlFirmar', 'PARTE_TEXTOS']) {
    assert.ok(b.ctx[n], `🔴 BANCO CIEGO: el dashboard no publica \`${n}\``);
  }
  return { b, red: r };
}

/** Firma con el contrato de `signaturePad.js`: si `onConfirm` lanza, el pad sigue abierto con el mensaje. */
async function firmarConElPad(b, quien) {
  const pad = { cerrado: false, aviso: null };
  let onConfirm = null;
  const abierto = b.ctx.firmarParte(PARTE, {
    abrirPad: (o) => { onConfirm = o.onConfirm; },
    alFirmar: async () => {},
    avisar: () => {},
  }, quien || 'cliente');
  assert.ok(abierto && onConfirm, '🔴 SUELO: el pad no se ha abierto; no se ha podido firmar nada');
  try {
    await onConfirm('data:image/png;base64,' + 'A'.repeat(300), { firmadoPorNombre: 'Ana Ruiz' });
    pad.cerrado = true;
  } catch (e) {
    pad.aviso = e && e.message;
  }
  return pad;
}

/** Pinta el parte como lo pinta `app.js` y devuelve el aviso de rechazo que haya (o `null`). */
async function pantallaDelParte(b) {
  const cont = b.mk('div');
  const pintada = await b.ctx.renderParteDetailView(cont, 7);
  assert.equal(pintada, true, '🔴 SUELO: la pantalla del parte no se ha pintado; no se ha podido mirar');
  assert.ok(cont.querySelector('[data-parte-firmas]'), '🔴 SUELO: la sección de firmas no está en la pantalla');
  const aviso = cont.querySelector('[data-parte-firma-rechazada]');
  return aviso ? { texto: aviso.textContent, clase: aviso.className, rol: aviso.getAttribute('role') } : null;
}

async function enLaCola(b) {
  const c = await b.ctx.leerFirmasPendientes();
  assert.equal(c.estado, b.ctx.GUARDADO, '🔴 SUELO: no se ha podido leer la cola');
  return c.firmas.map((f) => f.claveIdempotencia);
}

/**
 * Vacía la cola como al abrir la app. 🔴 SUELO: si el vaciado no llega a SUBIR la firma, la prueba
 * no ha mirado nada — «no se marcó rechazada» sería verde por no haber pasado por el servidor.
 */
async function vaciarLaCola(b, laRed) {
  const antes = laRed.posts.length;
  const r = await b.ctx.drenarAlAbrir();
  assert.ok(r && laRed.posts.length > antes,
    '🔴 NO PUDE MIRAR: el vaciado de la cola no ha llegado a subir la firma. Resultado: ' + JSON.stringify(r));
  return r;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// ① FIRMAR SIN RED
// ─────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-890b · 🔴 firmar un parte SIN RED no cierra el pad: dice lo MISMO que el albarán', async () => {
  const { b, red: laRed } = montar();
  laRed.alFirmar = null;

  const pad = await firmarConElPad(b);

  assert.equal(laRed.posts.length, 1, '🔴 SUELO: no se ha intentado subir la firma');
  assert.equal(pad.cerrado, false,
    '🔴 sin red el pad se ha CERRADO como si el cliente hubiera firmado. La firma sólo está en este ' +
    'móvil y el profesional se va creyendo que subió.');
  const literal = b.ctx.mensajeDeFalloAlFirmar({ sinRed: true });
  assert.equal(pad.aviso, literal,
    '🔴 el aviso no es el literal del albarán (`mensajeDeFalloAlFirmar`): ' + JSON.stringify(pad.aviso));
  assert.deepEqual(await enLaCola(b), ['firma:parte:7'],
    '🔴 sin red la firma ya no se queda en la cola (lo que el PR 1 fijó no puede cambiar)');
});

test('SCRUM-890b · ✅ con red, el pad se cierra igual que hoy', async () => {
  const { b, red: laRed } = montar();
  laRed.alFirmar = { status: 200, data: { id: 7, estado: 'borrador' } };
  const pad = await firmarConElPad(b);
  assert.equal(pad.cerrado, true, '🔴 una firma confirmada ya no cierra el pad. Aviso: ' + pad.aviso);
  assert.deepEqual(await enLaCola(b), []);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ② EL RECHAZO AL VACIAR LA COLA, VISIBLE EN EL PARTE
// ─────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-890b · 🔴 firma encolada sin red → al vaciar se rechaza (`parte_vacio`) → el PARTE lo dice', async () => {
  const { b, red: laRed } = montar();
  laRed.alFirmar = null;
  await firmarConElPad(b);
  assert.deepEqual(await enLaCola(b), ['firma:parte:7'], '🔴 SUELO: la firma no llegó a la cola');

  laRed.alFirmar = { status: 409, data: { error: 'parte_vacio', message: 'un parte sin ninguna línea no se puede firmar' } };
  const r = await vaciarLaCola(b, laRed);
  assert.equal(r.rechazadas.length, 1, '🔴 SUELO: el vaciado no ha rechazado nada: ' + JSON.stringify(r));

  const aviso = await pantallaDelParte(b);
  assert.ok(aviso,
    '🔴 la firma se rechazó al vaciar la cola, salió de IndexedDB, y la pantalla del parte NO DICE NADA. ' +
    'El profesional cree que el cliente firmó.');
  assert.equal(aviso.texto, b.ctx.PARTE_TEXTOS.parteVacioNoSeFirma, '🔴 `parte_vacio` no lleva el literal firmado del PR 1');
  assert.match(aviso.clase, /\balert\b/);
  assert.match(aviso.clase, /\bwarning\b/, '🔴 `.alert` sin tono está oculta por CSS');
  assert.equal(aviso.rol, 'alert');
});

test('SCRUM-890b · 🔴 cualquier otro rechazo de la lista sale con el literal GENÉRICO', async () => {
  const generico = montar().b.ctx.PARTE_TEXTOS.firmaRechazada;
  assert.ok(generico, '🔴 no hay literal genérico para un rechazo que no sea `parte_vacio`');
  assert.notEqual(generico, montar().b.ctx.PARTE_TEXTOS.parteVacioNoSeFirma);

  for (const [status, codigo] of [[400, 'firma_invalida'], [400, 'firma_sin_nombre'], [413, 'firma_demasiado_grande']]) {
    const { b, red: laRed } = montar();
    laRed.alFirmar = null;
    await firmarConElPad(b, 'tecnico');   // el recuadro del técnico: su clave es otra y también se mira
    laRed.alFirmar = { status, data: { error: codigo } };
    const r = await vaciarLaCola(b, laRed);
    assert.equal(r.rechazadas.length, 1, `🔴 SUELO: ${codigo} no se ha rechazado al vaciar`);
    const aviso = await pantallaDelParte(b);
    assert.equal(aviso && aviso.texto, generico, `🔴 un rechazo \`${codigo}\` no se ve en el parte`);
  }
});

test('SCRUM-890b · ⛔ lo que SIGUE en la cola no se marca como rechazado', async () => {
  const casos = [
    null,   // sin red
    { status: 409, data: { error: 'invalid_transition' } },
    { status: 401, data: { error: 'unauthorized' } },
    { status: 403, data: { error: 'forbidden' } },
    { status: 404, data: { error: 'not_found' } },
    { status: 429, data: { error: 'rate_limited' } },
    { status: 500, data: { error: 'internal_error' } },
  ];
  for (const caso of casos) {
    const nombre = caso ? `${caso.status} ${caso.data.error}` : 'sin red';
    const { b, red: laRed } = montar();
    laRed.alFirmar = null;
    await firmarConElPad(b);
    laRed.alFirmar = caso;
    const r = await vaciarLaCola(b, laRed);
    assert.deepEqual(await enLaCola(b), ['firma:parte:7'], `🔴 SUELO: ${nombre} ha sacado la firma de la cola`);
    assert.equal(r.rechazadas.length, 0, `🔴 ${nombre} se ha contado como rechazo`);
    assert.equal(await pantallaDelParte(b), null,
      `🔴 ${nombre}: la firma SIGUE en la cola y el parte dice que se rechazó. Le pide al cliente otra firma sin motivo.`);
  }
});

test('SCRUM-890b · ✅ la constancia se BORRA al volver a firmar ese parte con éxito (y sólo entonces)', async () => {
  const { b, red: laRed } = montar();
  laRed.alFirmar = null;
  await firmarConElPad(b);
  laRed.alFirmar = { status: 400, data: { error: 'firma_invalida' } };
  await vaciarLaCola(b, laRed);
  assert.ok(await pantallaDelParte(b), '🔴 SUELO: no había aviso que borrar');

  // Un segundo intento SIN red no es «firmar con éxito»: el aviso se queda.
  laRed.alFirmar = null;
  await firmarConElPad(b);
  assert.ok(await pantallaDelParte(b), '🔴 un intento fallido ha borrado la constancia del rechazo');

  laRed.alFirmar = { status: 200, data: { id: 7, estado: 'borrador' } };
  const pad = await firmarConElPad(b);
  assert.equal(pad.cerrado, true, '🔴 SUELO: la firma buena no se ha confirmado');
  assert.equal(await pantallaDelParte(b), null, '🔴 el parte se ha firmado bien y sigue diciendo que se rechazó');
});

test('SCRUM-890b · ⛔ la constancia es POR DOCUMENTO: un rechazo del parte 8 no sale en el 7', async () => {
  const { b, red: laRed } = montar();
  const otro = Object.assign({}, PARTE, { id: 8 });
  laRed.alFirmar = null;
  let onConfirm = null;
  b.ctx.firmarParte(otro, { abrirPad: (o) => { onConfirm = o.onConfirm; }, alFirmar: async () => {} }, 'cliente');
  await onConfirm('data:image/png;base64,' + 'A'.repeat(300), { firmadoPorNombre: 'Ana Ruiz' }).catch(() => {});
  laRed.alFirmar = { status: 400, data: { error: 'firma_invalida' } };
  const r = await vaciarLaCola(b, laRed);
  assert.equal(r.rechazadas.length, 1, '🔴 SUELO: el parte 8 no se ha rechazado');
  assert.equal(await pantallaDelParte(b), null, '🔴 el parte 7 enseña el rechazo del parte 8');
});

test('SCRUM-890b · 🔴 cerrar sesión borra también las constancias (art. 32 RGPD)', async () => {
  const { b, red: laRed } = montar();
  laRed.alFirmar = null;
  await firmarConElPad(b);
  laRed.alFirmar = { status: 400, data: { error: 'firma_invalida' } };
  await vaciarLaCola(b, laRed);
  const antes = await b.ctx.leerRechazosDeFirma();
  assert.equal(antes.rechazos.length, 1, '🔴 SUELO: no había constancia que purgar');

  assert.equal(typeof b.ctx.logout, 'function', '🔴 SUELO: `logout` no está publicado');
  await b.ctx.logout();
  const despues = await b.ctx.leerRechazosDeFirma();
  assert.equal(despues.estado, b.ctx.GUARDADO, '🔴 SUELO: no se ha podido releer tras purgar');
  assert.equal(despues.rechazos.length, 0, '🔴 tras cerrar sesión queda en el móvil qué documentos de qué clientes se rechazaron');
});

// ── 🔴 LA CONSTANCIA NO SUBE LA VERSIÓN DE LA BASE ────────────────────────────────────────────
//
// Medido el 17-sep con el dashboard de main entero: si la base sube a v2, una pestaña que siga abierta
// con el JS de antes se queda sin almacén (`VersionError`) y un parte firmado sin red cierra el pad y
// NO queda en ninguna cola — la firma de un cliente, perdida en silencio. Por eso la constancia vive en
// `localStorage`, por clave de documento, y la base se queda en la versión 1 (orquestador, 17-sep).

test('SCRUM-890b · 🔴 dejar constancia de un rechazo NO sube la base: el JS de antes (v1) la sigue abriendo', async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  const idb = new IDBFactory();
  const r = red();
  const b = montarAlmacen(RAIZ, { indexedDB: idb, dashboard: { red: r } });
  r.alFirmar = null;
  await firmarConElPad(b);
  r.alFirmar = { status: 400, data: { error: 'firma_invalida' } };
  const vaciado = await vaciarLaCola(b, r);
  assert.equal(vaciado.rechazadas.length, 1, '🔴 SUELO: el vaciado no ha rechazado nada');
  assert.ok(await pantallaDelParte(b), '🔴 SUELO: no ha quedado constancia que enseñar');

  const abre = await new Promise((resolve) => {
    const p = idb.open('yaqu', 1);
    p.onsuccess = () => { const v = p.result.version; p.result.close(); resolve({ ok: true, v }); };
    p.onerror = () => resolve({ ok: false, error: p.error && p.error.name });
  });
  assert.deepEqual(abre, { ok: true, v: 1 },
    '🔴 la base ha subido de versión: una pestaña con el JS de antes se queda sin cola y un parte firmado ' +
    'sin red se pierde en silencio. ' + JSON.stringify(abre));
});

test('SCRUM-890b · 🔴 si la constancia NO se puede escribir, la firma SE QUEDA en la cola', async () => {
  const { b, red: laRed } = montar();
  laRed.alFirmar = null;
  await firmarConElPad(b);
  assert.deepEqual(await enLaCola(b), ['firma:parte:7'], '🔴 SUELO: la firma no llegó a la cola');

  // Cuota llena o Safari en privado: `setItem` lanza.
  let intentos = 0;
  b.ctx.localStorage.setItem = () => { intentos += 1; throw new Error('QuotaExceededError'); };
  laRed.alFirmar = { status: 400, data: { error: 'firma_invalida' } };
  await vaciarLaCola(b, laRed);
  assert.ok(intentos > 0, '🔴 SUELO: la constancia no se ha intentado escribir en localStorage');
  assert.deepEqual(await enLaCola(b), ['firma:parte:7'],
    '🔴 la constancia no se escribió y la firma ha salido igual de la cola: un rechazo que no ve nadie.');
});

test('SCRUM-890b · ✅ la constancia sobrevive a RECARGAR la aplicación', async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  const idb = new IDBFactory();
  const r = red();
  const antes = montarAlmacen(RAIZ, { indexedDB: idb, dashboard: { red: r } });
  r.alFirmar = null;
  await firmarConElPad(antes);
  r.alFirmar = { status: 400, data: { error: 'firma_invalida' } };
  await vaciarLaCola(antes, r);

  // Recargar: el mismo IndexedDB y el mismo localStorage, scripts evaluados de nuevo.
  const despues = montarAlmacen(RAIZ, {
    indexedDB: idb, dashboard: { red: r, localStorage: antes.ctx.localStorage._contenido() },
  });
  const aviso = await pantallaDelParte(despues);
  assert.ok(aviso, '🔴 tras recargar, el parte ya no dice que la firma se rechazó');
  assert.equal(aviso.texto, despues.ctx.PARTE_TEXTOS.firmaRechazada);
});

// ── 🔴 LA PRÓXIMA SUBIDA DE VERSIÓN NO SE PUEDE QUEDAR BLOQUEADA ─────────────────────────────
//
// Medido en Chromium real con dos pestañas del mismo origen (JS de main y una rama con v2, 17-sep):
// la pestaña vieja sólo bloquea la subida DURANTE cada operación (cada llamada abre y cierra). Pero
// cuando esa apertura queda bloqueada, `abrirAlmacen` rechaza y la petición SIGUE: la conexión llega
// tarde, nadie la cierra, y la subida siguiente quedaba bloqueada mientras la pestaña siguiera
// abierta — 8 de 10 intentos. Por eso toda conexión se cierra al recibir `versionchange`, también la
// que llega tarde (el manejador se pone en `onsuccess`, que es el camino de las dos).
//
// Con la base en v1 este código no sube versión, así que la huérfana no se puede construir aquí: el
// test de abajo vigila el mecanismo, y la próxima subida de VERSION_BD tiene que volver a medirla.

/** Intenta subir la base a `version` desde otra «pestaña». `bloqueada` = llegó a dispararse `blocked`. */
function subirA(idb, version, ms = 1000) {
  return new Promise((resolve) => {
    const p = idb.open('yaqu', version);
    let bloqueada = false;
    p.onblocked = () => { bloqueada = true; };
    p.onupgradeneeded = () => {};
    p.onsuccess = () => { p.result.close(); resolve({ subio: true, bloqueada }); };
    p.onerror = () => resolve({ subio: false, bloqueada, error: p.error && p.error.name });
    setTimeout(() => resolve({ subio: false, bloqueada }), ms);
  });
}

test('SCRUM-890b · 🔴 SUELO: una conexión que NO atiende `versionchange` bloquea la subida (el banco lo ve)', async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  const idb = new IDBFactory();
  const retenida = await new Promise((resolve) => { const p = idb.open('yaqu', 1); p.onsuccess = () => resolve(p.result); });
  const r = await subirA(idb, 2, 300);
  assert.equal(r.bloqueada && !r.subio, true,
    '🔴 BANCO CIEGO: una conexión abierta sin `onversionchange` no bloquea aquí; «no se bloquea» no probaría nada.');
  retenida.close();
});

test('SCRUM-890b · 🔴 una conexión del almacén se CIERRA al pedirse otra versión: no bloquea la próxima subida', async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  const idb = new IDBFactory();
  const b = montarAlmacen(RAIZ, { indexedDB: idb });
  const bd = await b.ctx.abrirAlmacen(); // una operación en curso, en la pestaña que ya no se recarga
  const r = await subirA(idb, 2);
  try { bd.close(); } catch (_e) { /* ya cerrada */ }
  assert.equal(r.subio, true,
    '🔴 la conexión del almacén no se cierra con `versionchange`: la próxima subida de versión se queda ' +
    'esperando a que el profesional cierre la pestaña.');
});
