// tests/scrum890-parte-vacio.test.mjs — SCRUM-890 (del recorrido del electricista, SCRUM-882)
//
// FIRMAR UN PARTE VACÍO DABA 409 EN SILENCIO, Y LA COLA LO REINTENTABA EN CADA APERTURA.
//
// Dos fallos que se tapaban uno al otro:
//   ① `firmarParte` no relanzaba: `firmarConRedDeSeguridad` devuelve el error DENTRO del resultado,
//     el pad (`signaturePad.js`) sólo muestra aviso si `onConfirm` LANZA, así que se cerraba como si
//     hubiera firmado. El profesional no veía nada.
//   ② La cola trataba el 409 `parte_vacio` como un corte de red: se quedaba dentro, y el drenado de
//     `app.js` la volvía a subir en cada arranque para recibir el mismo 409. Para siempre.
//
// Se ejercita con los ficheros REALES (`colaDeFirmas.js` + `parteDetailView.js`) en un mismo
// contexto, un pad con el contrato de `signaturePad.js` (espera a `onConfirm`; si lanza, aviso y NO
// cierra) y el error con la forma exacta que construye `api.js` (`status`, `code`, `data`).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = path.join(RAIZ, 'public', 'dashboard', 'js');

// La respuesta del servidor, tal cual la escribe `partes.routes.ts` al firmar sin líneas.
const RESPUESTA_PARTE_VACIO = {
  status: 409,
  data: { error: 'parte_vacio', message: 'un parte sin ninguna línea no se puede firmar: no dice qué se hizo' },
};

/** El error que lanza `api.js` ante una respuesta no-ok: mismo constructor, mismos campos. */
function errorDeApi({ status, data }) {
  const err = new Error(data?.message || `API ${status}: ${data?.error}`);
  err.status = status;
  err.code = data?.error || null;
  err.data = data;
  return err;
}

/** El error que lanza `api.js` cuando `fetch` ni siquiera llega. */
function errorDeRed() {
  return Object.assign(new Error('Failed to fetch'), { sinRed: true });
}

function banco({ responder }) {
  const almacen = new Map();
  const peticiones = [];
  const ctx = {
    console, window: null, Date, JSON, Array, Object, String, Number, Promise, Error, Math,
    setTimeout, clearTimeout,
    document: { createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, innerHTML: '' }) },
  };
  ctx.window = ctx;
  vm.createContext(ctx);

  ctx.GUARDADO = 'guardado';
  ctx.FALLO = 'fallo';
  ctx.NO_DISPONIBLE = 'no_disponible';
  ctx.FIRMA_SOLO_EN_ESTE_MOVIL = 'FIRMA_SOLO_EN_ESTE_MOVIL';
  ctx.FIRMA_A_SALVO = 'FIRMA_A_SALVO';
  ctx.marcarQueHuboCola = () => {};
  ctx.olvidarQueHuboCola = () => {};
  ctx.guardarFirmaPendiente = async (f) => { almacen.set(f.claveIdempotencia, f); return { estado: 'guardado' }; };
  ctx.quitarFirmaPendiente = async (c) => { almacen.delete(c); return { estado: 'guardado' }; };
  ctx.leerFirmasPendientes = async () => ({ estado: 'guardado', firmas: [...almacen.values()] });
  ctx.confirmaElServidor = (r) => !!(r && r.id);
  ctx.esperarLoQueLaRed = async (p) => {
    try { return { valor: await p }; } catch (error) { return { error }; }
  };
  ctx.apiRequest = async (ruta, opts) => {
    peticiones.push({ ruta, metodo: opts && opts.method });
    return responder(ruta, opts);
  };

  for (const f of ['colaDeFirmas.js', 'parteDetailView.js']) {
    vm.runInContext(fs.readFileSync(path.join(JS, f), 'utf8'), ctx, { filename: f });
  }
  return { ctx, almacen, peticiones };
}

/**
 * Pulsa «Firmar aquí mismo» y, si se abre el pad, firma con el contrato de `signaturePad.js`:
 * espera a `onConfirm`; si lanza, se queda abierto con `e.message` a la vista; si no, se cierra.
 */
async function pulsarFirmar(b, parte) {
  const pad = { abierto: false, cerrado: false, aviso: null, avisoEnPantalla: null };
  let onConfirm = null;
  const abierto = b.ctx.firmarParte(parte, {
    abrirPad: (o) => { pad.abierto = true; onConfirm = o.onConfirm; },
    avisar: (texto) => { pad.avisoEnPantalla = texto; },
    alFirmar: async () => {},
  }, 'cliente');
  if (onConfirm) {
    try {
      await onConfirm('data:image/png;base64,' + 'A'.repeat(300), { firmadoPorNombre: 'Ana Ruiz' });
      pad.cerrado = true;
    } catch (e) {
      pad.aviso = (e && e.message) || 'La firma no se ha enviado. No cierres esta pantalla: vuelve a intentarlo.';
    }
  }
  return { abierto, pad };
}

const PARTE = (lineas) => ({
  id: 7, numero: 'PT-2026-001', clienteNombre: 'Comunidad Los Olivos', fecha: '2026-09-16T08:00:00.000Z',
  obra: 'C/ Mayor 3', lineas, estado: 'borrador', firmoElCliente: false, firmoElTecnico: false,
});
const CON_LINEAS = [{ bloque: 'mano_obra', unds: 2, descripcion: 'Revisión de caldera' }];

// ─────────────────────────────────────────────────────────────────────────────────────────
// ROJO · lo que pasaba
// ─────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-890 · 🔴 pulsar firmar en un parte VACÍO: no se le pide al cliente que firme para nada', async () => {
  const b = banco({ responder: () => { throw errorDeApi(RESPUESTA_PARTE_VACIO); } });
  const { pad } = await pulsarFirmar(b, PARTE([]));
  const literal = b.ctx.PARTE_TEXTOS && b.ctx.PARTE_TEXTOS.parteVacioNoSeFirma;

  assert.ok(literal, '🔴 no hay literal que diga por qué no se firma y qué hacer');
  assert.equal(pad.abierto, false,
    '🔴 se ha abierto el pad con un parte sin líneas: el cliente firma delante del profesional y el ' +
    'servidor lo rechaza después con un 409.');
  assert.equal(pad.avisoEnPantalla, literal,
    '🔴 el profesional no ve por qué no se firma: ' + JSON.stringify(pad.avisoEnPantalla));
  assert.equal(b.peticiones.length, 0, '🔴 se ha mandado una firma que el servidor rechaza seguro');
  assert.equal(b.almacen.size, 0, '🔴 se ha encolado una firma de un parte vacío');
});

test('SCRUM-890 · 🔴 si el SERVIDOR responde 409 `parte_vacio` al firmar: aviso visible y fuera de la cola', async () => {
  // La pantalla traía líneas y el servidor ya no (la oficina las quitó entre medias): el 409 llega
  // con el pad abierto. Es el camino que el recorrido de SCRUM-882 vio en silencio.
  const b = banco({ responder: () => { throw errorDeApi(RESPUESTA_PARTE_VACIO); } });
  const { pad } = await pulsarFirmar(b, PARTE(CON_LINEAS));

  assert.equal(pad.cerrado, false,
    '🔴 el pad se ha CERRADO como si la firma hubiera ido bien. El servidor respondió 409 `parte_vacio` ' +
    'y el profesional se va creyendo que el cliente firmó.');
  assert.equal(pad.aviso, b.ctx.PARTE_TEXTOS && b.ctx.PARTE_TEXTOS.parteVacioNoSeFirma,
    '🔴 lo que ve el profesional no es el literal que dice por qué y qué hacer: ' + JSON.stringify(pad.aviso));
  assert.equal(b.almacen.size, 0,
    '🔴 la firma rechazada se ha quedado EN LA COLA: ' + JSON.stringify([...b.almacen.keys()]) +
    '. Cada apertura de la app la reintentará y recibirá el mismo 409.');
});

test('SCRUM-890 · 🔴 una firma de parte vacío YA ENCOLADA sale al drenar y no se vuelve a subir', async () => {
  // El caso de los móviles que ya la tienen dentro: la encoló la versión de antes de este arreglo.
  const b = banco({ responder: () => { throw errorDeApi(RESPUESTA_PARTE_VACIO); } });
  b.almacen.set('firma:parte:7', {
    claveIdempotencia: 'firma:parte:7', albaranId: 7, tipo: 'parte', signatureData: 'x', encoladaEn: 1,
  });

  const primera = await b.ctx.drenarFirmasPendientes(b.ctx.subirFirmaDeLaCola);
  assert.equal(b.almacen.size, 0,
    '🔴 tras un 409 `parte_vacio` la firma SIGUE en la cola. Fallidas: ' + JSON.stringify(primera.fallidas));
  assert.equal(primera.quedan, 0, '🔴 el contador sigue diciendo que queda algo pendiente');
  assert.equal(primera.rechazadas && primera.rechazadas.length, 1,
    '🔴 el drenado no dice QUÉ ha sacado por rechazo: salir de la cola en silencio es otro fallo mudo');
  assert.equal(primera.rechazadas[0].codigo, 'parte_vacio');

  await b.ctx.drenarFirmasPendientes(b.ctx.subirFirmaDeLaCola);
  assert.equal(b.peticiones.length, 1,
    '🔴 la segunda apertura ha vuelto a subir la firma rechazada: ' + JSON.stringify(b.peticiones));
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// POSITIVO · lo que NO puede cambiar
// ─────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-890 · ✅ un error de RED sigue en la cola y se reintenta al abrir', async () => {
  let hayRed = false;
  const b = banco({ responder: () => { if (!hayRed) throw errorDeRed(); return { id: 7 }; } });

  const r = await b.ctx.firmarConRedDeSeguridad(7, { signatureData: 'x' },
    () => b.ctx.apiRequest('/admin/partes/7/firmar', { method: 'POST' }), 'parte');
  assert.equal(r.estado, b.ctx.FIRMA_SOLO_EN_ESTE_MOVIL);
  assert.ok(!r.rechazada, '🔴 un corte de red se ha tratado como rechazo definitivo');
  assert.deepEqual([...b.almacen.keys()], ['firma:parte:7'], '🔴 sin red la firma ya no se queda en la cola');

  const sinRed = await b.ctx.drenarFirmasPendientes(b.ctx.subirFirmaDeLaCola);
  assert.equal(b.almacen.size, 1, '🔴 el drenado SIN RED ha sacado la firma de la cola: firma perdida');
  assert.equal(sinRed.rechazadas.length, 0);

  hayRed = true;
  const conRed = await b.ctx.drenarFirmasPendientes(b.ctx.subirFirmaDeLaCola);
  assert.equal(conRed.subidas, 1, '🔴 al volver la red la firma no ha subido');
  assert.equal(b.almacen.size, 0);
});

test('SCRUM-890 · ✅ un parte CON líneas se firma igual que hoy', async () => {
  const b = banco({ responder: () => ({ id: 7 }) });
  const { abierto, pad } = await pulsarFirmar(b, PARTE(CON_LINEAS));
  assert.equal(abierto, true, '🔴 el pad no se abre con un parte con líneas');
  assert.equal(pad.cerrado, true, '🔴 el pad no se cierra tras una firma confirmada. Aviso: ' + pad.aviso);
  assert.deepEqual(b.peticiones, [{ ruta: '/admin/partes/7/firmar', metodo: 'POST' }]);
  assert.equal(b.almacen.size, 0, '🔴 la firma confirmada se ha quedado en la cola');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// NEGATIVO · ninguna firma válida se descarta
// ─────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-890 · ⛔ lo que NO es un rechazo del documento no saca la firma de la cola', async () => {
  // Cada uno de estos puede llegarle a una firma BUENA, y por eso se quedan:
  //   401 sesión caducada · 403 prueba caducada o permiso · 404 otra cuenta en el mismo móvil
  //   (el parte es de otro merchant) · 408/429 transitorios · 5xx el servidor · 503 cerrojo.
  const casos = [
    { status: 401, data: { error: 'unauthorized' } },
    { status: 403, data: { error: 'trial_expired' } },
    { status: 404, data: { error: 'not_found' } },
    { status: 408, data: { error: 'timeout' } },
    { status: 429, data: { error: 'rate_limited' } },
    { status: 500, data: { error: 'internal_error' } },
    { status: 503, data: { error: 'cerrojo_saturado' } },
  ];
  for (const caso of casos) {
    const b = banco({ responder: () => { throw errorDeApi(caso); } });
    b.almacen.set('firma:parte:7', { claveIdempotencia: 'firma:parte:7', albaranId: 7, tipo: 'parte', signatureData: 'x' });
    const res = await b.ctx.drenarFirmasPendientes(b.ctx.subirFirmaDeLaCola);
    assert.equal(b.almacen.size, 1,
      `🔴 un ${caso.status} \`${caso.data.error}\` ha SACADO la firma de la cola. Esa firma puede ser buena: se ha perdido.`);
    assert.equal(res.rechazadas.length, 0, `🔴 un ${caso.status} se ha contado como rechazo`);

    const al = banco({ responder: () => { throw errorDeApi(caso); } });
    const r = await al.ctx.firmarConRedDeSeguridad(7, { signatureData: 'x' },
      () => al.ctx.apiRequest('/admin/partes/7/firmar', { method: 'POST' }), 'parte');
    assert.equal(al.almacen.size, 1, `🔴 al firmar, un ${caso.status} ha sacado la firma de la cola`);
    assert.ok(!r.rechazada, `🔴 al firmar, un ${caso.status} se ha declarado rechazo definitivo`);
  }
});

test('SCRUM-890 · ⛔ `parte_locked` y `albaran_locked` siguen siendo ÉXITO, no rechazo', async () => {
  for (const codigo of ['parte_locked', 'albaran_locked']) {
    const b = banco({ responder: () => { throw errorDeApi({ status: 409, data: { error: codigo } }); } });
    b.almacen.set('firma:parte:7', { claveIdempotencia: 'firma:parte:7', albaranId: 7, tipo: 'parte', signatureData: 'x' });
    const res = await b.ctx.drenarFirmasPendientes(b.ctx.subirFirmaDeLaCola);
    assert.equal(res.yaEstaban, 1, `🔴 \`${codigo}\` ha dejado de contar como «el servidor ya la tiene»`);
    assert.equal(res.rechazadas.length, 0, `🔴 \`${codigo}\` se ha contado como rechazo: la firma ESTÁ en el servidor`);
  }
});
