// tests/scrum1191-tope-cola-firmas.test.mjs — SCRUM-1191 · EL TOPE DE LA COLA DE FIRMAS, CABLEADO
//
// `hayEspacioParaOtraFirma` (SCRUM-360) medía el tope —50 firmas, o el disco sin sitio— y NADIE la
// consultaba antes de encolar. Y el aviso aprobado en SCRUM-469, «No cabe otra firma en este móvil.
// Conéctate para subir las que tienes pendientes.», estaba escrito y sin pintar.
//
// Se mide EL VIAJE con el dashboard entero (`_banco-almacen-local.mjs`: IndexedDB estándar, `api.js`
// real sobre un `fetch` controlado): cola llena de verdad → firmar sin red → ¿se encoló? → el mensaje
// que la vista relanzaría (`mensajeDeFalloAlFirmar` con lo que devuelve la cola). Y ③: con red, la
// misma firma SUBE aunque la cola esté llena.
//
// 🔴 CONDICIÓN DE VERDAD: el texto dice «las que tienes pendientes», así que sólo se pinta con cola > 0.
// Con el disco lleno y la cola VACÍA se encola como siempre y el texto NO sale.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { montarAlmacen, porQueEstariaCiego } from './_banco-almacen-local.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIRMA = { signatureData: 'data:image/png;base64,AAAA', firmadoPorNombre: 'Ana Ruiz' };

function red(storage) {
  const estado = { conRed: false, posts: [] };
  const responder = (status, data) => ({
    ok: status >= 200 && status < 300, status, statusText: String(status),
    headers: { get: () => 'application/json' },
    json: async () => data, blob: async () => ({}), text: async () => JSON.stringify(data),
  });
  estado.fetch = async (url, opts) => {
    const metodo = (opts && opts.method) || 'GET';
    if (metodo === 'GET') return responder(200, {});
    if (!estado.conRed) throw new TypeError('Failed to fetch');
    estado.posts.push(String(url));
    return responder(200, { id: 7, estado: 'firmado' });
  };
  estado.navigator = { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } };
  if (storage) estado.navigator.storage = storage;
  return estado;
}

function montar(storage) {
  const laRed = red(storage);
  const b = montarAlmacen(RAIZ, { dashboard: { red: laRed } });
  const ciego = porQueEstariaCiego(b, RAIZ);
  assert.equal(ciego, null, `🔴 BANCO CIEGO: ${ciego}`);
  assert.equal(typeof b.ctx.TEXTO_SIN_ESPACIO_PARA_FIRMA, 'string', '🔴 CIEGO: el texto aprobado no está cargado');
  return { b, laRed };
}

/** Llena la cola con `n` firmas de OTROS albaranes, por el mismo camino que la llena el producto. */
async function llenarCola(b, n) {
  for (let i = 0; i < n; i += 1) {
    const r = await b.ctx.encolarFirma(9000 + i, FIRMA, 'albaran');
    assert.equal(r.estado, b.ctx.GUARDADO, '🔴 SUELO: no se pudo preparar la cola');
  }
  assert.equal((await b.ctx.leerFirmasPendientes()).firmas.length, n);
}

const firmar = (b, id) => b.ctx.firmarConRedDeSeguridad(id, FIRMA,
  () => b.ctx.apiRequest(`/admin/albaranes/${id}/firmar`, { method: 'POST', body: '{}' }), 'albaran');

/** El mensaje que el albarán relanzaría con este resultado (misma llamada que `albaranDetailView`). */
const mensaje = (b, r) => b.ctx.mensajeDeFalloAlFirmar(r.error, { encolada: r.encolada });

test('SCRUM-1191 · 🔴 cola en el tope (50) y sin red: la firma NO se encola y sale el aviso aprobado', async () => {
  const { b } = montar();
  await llenarCola(b, b.ctx.TOPE_FIRMAS_EN_COLA);
  const r = await firmar(b, 1635);
  assert.equal(r.estado, b.ctx.FIRMA_SOLO_EN_ESTE_MOVIL);
  assert.equal(r.encolada, false, '🔴 la cola pasó del tope: el tope no está cableado');
  assert.equal((await b.ctx.leerFirmasPendientes()).firmas.length, 50, '🔴 se encoló la 51');
  assert.equal(mensaje(b, r), b.ctx.TEXTO_SIN_ESPACIO_PARA_FIRMA,
    '🔴 el profesional no se entera de que esta firma NO se ha guardado en el móvil');
});

test('SCRUM-1191 · ③ cola en el tope y CON red: la firma sube igual, y la cola no crece', async () => {
  const { b, laRed } = montar();
  await llenarCola(b, 50);
  laRed.conRed = true;
  const r = await firmar(b, 1635);
  assert.equal(r.estado, b.ctx.FIRMA_A_SALVO, '🔴 el tope impidió firmar con red');
  assert.deepEqual(laRed.posts, ['/admin/albaranes/1635/firmar']);
  assert.equal((await b.ctx.leerFirmasPendientes()).firmas.length, 50);
});

test('SCRUM-1191 · CONTROL: por debajo del tope (49) se encola como siempre y sale el texto de SCRUM-919', async () => {
  const { b } = montar();
  await llenarCola(b, 49);
  const r = await firmar(b, 1635);
  assert.equal(r.encolada, true);
  assert.equal((await b.ctx.leerFirmasPendientes()).firmas.length, 50);
  assert.notEqual(mensaje(b, r), b.ctx.TEXTO_SIN_ESPACIO_PARA_FIRMA);
  assert.match(mensaje(b, r), /La firma está guardada en este móvil/);
});

test('SCRUM-1191 · reintentar un documento que YA está en la cola llena no le quita la red', async () => {
  const { b } = montar();
  await llenarCola(b, 50);
  const r = await firmar(b, 9003); // uno de los 50: encolar lo sobrescribe, la cola no crece
  assert.equal(r.encolada, true);
  assert.equal((await b.ctx.leerFirmasPendientes()).firmas.length, 50);
  assert.notEqual(mensaje(b, r), b.ctx.TEXTO_SIN_ESPACIO_PARA_FIRMA);
});

test('SCRUM-1191 · 🔴 CONDICIÓN DE VERDAD: disco sin sitio y cola VACÍA → se encola y el texto NO sale', async () => {
  const lleno = { estimate: async () => ({ quota: 1000, usage: 999 }) };
  const { b } = montar(lleno);
  assert.equal((await b.ctx.hayEspacioParaOtraFirma(0, 100)).estado, b.ctx.SIN_ESPACIO, 'SUELO: el disco no sale lleno');
  const r = await firmar(b, 1635);
  assert.equal(r.encolada, true, '🔴 se le quitó la red a la única firma');
  assert.notEqual(mensaje(b, r), b.ctx.TEXTO_SIN_ESPACIO_PARA_FIRMA,
    '🔴 «Conéctate para subir las que tienes pendientes» con CERO pendientes: el texto mentiría');
});

test('SCRUM-1191 · disco sin sitio y cola con pendientes → no se encola y sale el aviso', async () => {
  const lleno = { estimate: async () => ({ quota: 1000, usage: 999 }) };
  const { b } = montar(lleno);
  await llenarCola(b, 3);
  const r = await firmar(b, 1635);
  assert.equal(r.encolada, false);
  assert.equal(mensaje(b, r), b.ctx.TEXTO_SIN_ESPACIO_PARA_FIRMA);
});

test('SCRUM-1191 · NO_SE_SABE (sin `estimate`) no bloquea: se encola igual (decisión de SCRUM-360)', async () => {
  const { b } = montar(); // el navegador del banco no trae `storage`
  await llenarCola(b, 3);
  assert.equal((await b.ctx.hayEspacioParaOtraFirma(3, 100)).estado, b.ctx.ALMACEN_NO_SE_SABE);
  const r = await firmar(b, 1635);
  assert.equal(r.encolada, true);
});

test('SCRUM-1191 · 🔴 EL PARTE también: cola en el tope y sin red → el pad no cierra y dice el aviso aprobado', async () => {
  const { b } = montar();
  await llenarCola(b, 50);
  const PARTE = {
    id: 7, numero: 'PT-2026-001', clienteNombre: 'Comunidad Los Olivos', fecha: '2026-09-16T08:00:00.000Z',
    obra: 'C/ Mayor 3', tecnicos: [], tipo: 'reparacion_asistencia', estado: 'borrador',
    lineas: [{ bloque: 'mano_obra', unds: 2, descripcion: 'Revisión de caldera' }],
  };
  let onConfirm = null;
  const abierto = b.ctx.firmarParte(PARTE, { abrirPad: (o) => { onConfirm = o.onConfirm; }, alFirmar: async () => {}, avisar: () => {} }, 'cliente');
  assert.ok(abierto && onConfirm, '🔴 SUELO: el pad del parte no se ha abierto');
  let aviso = null;
  try { await onConfirm('data:image/png;base64,' + 'A'.repeat(300), { firmadoPorNombre: 'Ana Ruiz' }); } catch (e) { aviso = e && e.message; }
  assert.equal(aviso, b.ctx.TEXTO_SIN_ESPACIO_PARA_FIRMA, '🔴 el parte no pasa `sinEspacio` al mensaje');
  assert.equal((await b.ctx.leerFirmasPendientes()).firmas.length, 50);
});

test('SCRUM-1191 · si el servidor da su propio motivo, manda ese y no el de espacio', () => {
  const { b } = montar();
  const e = { sinEspacio: true, data: { message: 'albaran_locked' } };
  assert.equal(b.ctx.mensajeDeFalloAlFirmar(e, { encolada: false }), 'No hemos podido registrar la firma (albaran_locked)');
});
