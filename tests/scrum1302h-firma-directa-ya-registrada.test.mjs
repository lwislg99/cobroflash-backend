// tests/scrum1302h-firma-directa-ya-registrada.test.mjs — SCRUM-1302 (hallazgo 1 del c.17880)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA FIRMA DIRECTA DECÍA «NO HEMOS PODIDO REGISTRAR LA FIRMA» DE UNA FIRMA QUE ESTABA REGISTRADA
//
// Medido por S4 (1-oct-2026) con la vista real: la cola sube la firma al volver la red, el detalle
// abierto se queda viejo, y firmar o «Reintentar» desde ahí recibe 409 `albaran_locked`. El
// DRENADO ya sabía leerlo (`elServidorYaLaTiene`: el servidor LA TIENE, fuera de la cola). La firma
// DIRECTA no: lo trataba como un fallo cualquiera, devolvía ② y dejaba la firma en la cola, donde
// el aviso dice «si lo pierdes, se pierde» de algo que el servidor ya guarda.
//
// Aquí se ejecuta `firmarConRedDeSeguridad` real, con el `apiRequest` real y una red que responde
// el 409 — no se le pasa un error fabricado a mano: el `code` lo tiene que poner `api.js`.
//
// LÍMITE: no monta `albaranDetailView.js` (carril S4). Lo que la vista hace con ③ —`refrescar()`,
// sin leer `respuesta`— está leído en su fuente (`:581-588`), no ejecutado aquí.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { montarAlmacen, porQueEstariaCiego } from './_banco-almacen-local.mjs';
import { redNormal, falloDelServidor } from './_banco-red.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALBARAN_ID = 42;
const PARTE_ID = 7;
const CUERPO = Object.freeze({ signatureData: 'data:image/png;base64,AAAA', firmadoPorNombre: 'Aurora Benítez' });

function conRed(red) {
  const b = montarAlmacen(RAIZ, { dashboard: { red } });
  b.ctx.PLAZO_RED_MS = 60;
  return b;
}
const subirAlbaran = (b) => () => b.ctx.apiRequest(`/admin/albaranes/${ALBARAN_ID}/firmar`, {
  method: 'POST', body: JSON.stringify(CUERPO),
});
const subirParte = (b) => () => b.ctx.apiRequest(`/admin/partes/${PARTE_ID}/firmar`, {
  method: 'POST', body: JSON.stringify(CUERPO),
});
const enLaCola = async (b) => [...((await b.ctx.leerFirmasPendientes()).firmas || [])];

test('SCRUM-1302h · 🔴 SUELO: el banco monta la cola y el `apiRequest` real, o se declara CIEGO', async () => {
  const b = conRed(falloDelServidor(409, { error: 'albaran_locked', message: 'Este albarán ya está firmado.' }));
  assert.equal(porQueEstariaCiego(b, RAIZ), null, '🔴 BANCO CIEGO (almacén)');
  for (const n of ['firmarConRedDeSeguridad', 'leerFirmasPendientes', 'apiRequest', 'encolarFirma']) {
    assert.equal(typeof b.ctx[n], 'function', `🔴 no está publicada \`${n}\`: lo de abajo mediría el vacío.`);
  }
  // El `code` del error lo pone `api.js`, no este test: si no llegara, todo lo de abajo saldría
  // «sigue en ②» por ceguera y no por el defecto.
  await assert.rejects(subirAlbaran(b), (e) => {
    assert.equal(e.status, 409);
    assert.equal(e.code, 'albaran_locked', '🔴 `api.js` no expone el código del 409: la sonda no puede distinguir nada.');
    return true;
  });
});

test('SCRUM-1302h · 🔴 firma directa + 409 `albaran_locked` = el servidor YA LA TIENE: ③ y fuera de la cola', async () => {
  const b = conRed(falloDelServidor(409, { error: 'albaran_locked', message: 'Este albarán ya está firmado.' }));
  const r = await b.ctx.firmarConRedDeSeguridad(ALBARAN_ID, CUERPO, subirAlbaran(b));

  assert.equal(r.estado, b.ctx.FIRMA_A_SALVO,
    '🔴 un 409 `albaran_locked` en la firma directa se devuelve como ②. La vista pinta «No hemos ' +
    'podido registrar la firma (Este albarán ya está firmado.)» de una firma que SÍ está registrada.');
  assert.deepEqual(await enLaCola(b), [],
    '🔴 LA FIRMA VUELVE A LA COLA con el servidor ya en firmado: el aviso dirá «solo en este móvil… ' +
    'si lo pierdes, se pierde» de algo que está a salvo.');
  assert.notEqual(r.rechazada, true, '🔴 se marca como rechazo: la vista del parte lanzaría su texto.');
});

test('SCRUM-1302h · 🔴 y si la firma YA estaba en la cola (se encoló sin red), el 409 la saca', async () => {
  const b = conRed(falloDelServidor(409, { error: 'albaran_locked', message: 'Este albarán ya está firmado.' }));
  await b.ctx.encolarFirma(ALBARAN_ID, CUERPO);
  assert.equal((await enLaCola(b)).length, 1, '🔴 CIEGO: la firma previa no entró en la cola; el caso no se ha montado.');

  const r = await b.ctx.firmarConRedDeSeguridad(ALBARAN_ID, CUERPO, subirAlbaran(b));
  assert.equal(r.estado, b.ctx.FIRMA_A_SALVO);
  assert.deepEqual(await enLaCola(b), [], '🔴 queda el fantasma en la cola tras decir el servidor que ya la tiene.');
});

test('SCRUM-1302h · 🔴 el gemelo del parte: `parte_locked` en la firma directa también es «ya la tiene»', async () => {
  const b = conRed(falloDelServidor(409, { error: 'parte_locked', message: 'el cliente ya ha firmado este parte' }));
  const r = await b.ctx.firmarConRedDeSeguridad(PARTE_ID, CUERPO, subirParte(b), 'parte');
  assert.equal(r.estado, b.ctx.FIRMA_A_SALVO,
    '🔴 `parte_locked` se trata distinto que `albaran_locked` en la firma directa: el drenado los ' +
    'lee igual (`elServidorYaLaTiene`) y aquí tiene que ser la MISMA función, no una segunda regla.');
  assert.deepEqual(await enLaCola(b), []);
});

// ── CONTROLES: sin ellos, lo de arriba lo cumpliría un productor que dijera ③ a todo ──────────

test('SCRUM-1302h · ✅ CONTROL NEGATIVO: un 409 que NO es `…_locked` sigue en ② y SIGUE EN LA COLA', async () => {
  // `invalid_transition`: el albarán aún no está emitido. Es una firma válida que hay que conservar.
  const b = conRed(falloDelServidor(409, { error: 'invalid_transition', message: 'x' }));
  const r = await b.ctx.firmarConRedDeSeguridad(ALBARAN_ID, CUERPO, subirAlbaran(b));
  assert.equal(r.estado, b.ctx.FIRMA_SOLO_EN_ESTE_MOVIL,
    '🔴 cualquier 409 se está leyendo como «ya la tiene»: una firma que el servidor NO tiene saldría de la cola.');
  assert.equal((await enLaCola(b)).length, 1, '🔴 UNA FIRMA SE HA PERDIDO: el servidor no la tiene y la cola tampoco.');
});

test('SCRUM-1302h · ✅ CONTROL NEGATIVO: un 500 sigue en ② y en la cola', async () => {
  const b = conRed(falloDelServidor(500, { error: 'internal_error' }));
  const r = await b.ctx.firmarConRedDeSeguridad(ALBARAN_ID, CUERPO, subirAlbaran(b));
  assert.equal(r.estado, b.ctx.FIRMA_SOLO_EN_ESTE_MOVIL);
  assert.equal((await enLaCola(b)).length, 1);
});

test('SCRUM-1302h · ✅ CONTROL POSITIVO: con red normal sigue siendo ③ con la respuesta del servidor', async () => {
  const b = conRed(redNormal({ id: ALBARAN_ID, estado: 'firmado' }));
  const r = await b.ctx.firmarConRedDeSeguridad(ALBARAN_ID, CUERPO, subirAlbaran(b));
  assert.equal(r.estado, b.ctx.FIRMA_A_SALVO);
  assert.ok(r.respuesta, '🔴 el camino normal ha dejado de devolver la respuesta del servidor.');
  assert.deepEqual(await enLaCola(b), []);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// HALLAZGO 6 (c.17880) · FIRMAR CON RED DEJABA LA MARCA `yaqu_hubo_cola`, Y EL ARRANQUE SIGUIENTE
// AVISABA DE UNA PÉRDIDA QUE NO HUBO
//
// La marca se pone al encolar (antes de subir) y sólo la retiraba el drenado. Una firma que sube
// a la primera sale de la cola, pero la marca se quedaba: «hubo cola y el almacén está vacío» =
// POSIBLE_PERDIDA. Medido en Chromium real contra yaqu.app (1-oct-2026, 10 arranques con ese
// estado): 10/10 pintan «El móvil ha borrado firmas sin subir»; control sin marca, 0/10.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1302h · 🔴 SUELO (marca): el banco tiene la marca y el detector, y el detector CAZA', async () => {
  const b = conRed(redNormal({ id: ALBARAN_ID, estado: 'firmado' }));
  for (const n of ['marcarQueHuboCola', 'huboColaAlgunaVez', 'resistenciaAlArrancar']) {
    assert.equal(typeof b.ctx[n], 'function', `🔴 CIEGO: no está \`${n}\` en el banco.`);
  }
  // Control positivo del detector: marca puesta y cola vacía TIENE que dar POSIBLE_PERDIDA. Si no,
  // los «no avisa» de abajo no probarían nada.
  b.ctx.marcarQueHuboCola();
  const r = await b.ctx.resistenciaAlArrancar();
  assert.equal(r.desalojo.estado, b.ctx.POSIBLE_PERDIDA, '🔴 CIEGO: el detector no ve una marca con la cola vacía.');
});

test('SCRUM-1302h · 🔴 firmar CON red no deja la marca: el arranque siguiente no avisa de una pérdida', async () => {
  const b = conRed(redNormal({ id: ALBARAN_ID, estado: 'firmado' }));
  const r = await b.ctx.firmarConRedDeSeguridad(ALBARAN_ID, CUERPO, subirAlbaran(b));
  assert.equal(r.estado, b.ctx.FIRMA_A_SALVO);
  assert.equal(b.ctx.huboColaAlgunaVez(), false,
    '🔴 la firma subió, la cola está vacía y la marca `yaqu_hubo_cola` sigue puesta: el siguiente ' +
    'arranque dirá «El móvil ha borrado firmas sin subir» de una firma que está en el servidor.');
  const arranque = await b.ctx.resistenciaAlArrancar();
  assert.equal(arranque.desalojo.estado, b.ctx.SIN_PERDIDA);
});

test('SCRUM-1302h · 🔴 lo mismo cuando el servidor contesta que ya la tenía (409 `albaran_locked`)', async () => {
  const b = conRed(falloDelServidor(409, { error: 'albaran_locked', message: 'Este albarán ya está firmado.' }));
  await b.ctx.firmarConRedDeSeguridad(ALBARAN_ID, CUERPO, subirAlbaran(b));
  assert.equal(b.ctx.huboColaAlgunaVez(), false, '🔴 «ya la tiene» saca la firma de la cola y deja la marca.');
});

test('SCRUM-1302h · ✅ CONTROL NEGATIVO: si la firma NO sube, la marca SE QUEDA (hay algo que perder)', async () => {
  const b = conRed(falloDelServidor(500, { error: 'internal_error' }));
  await b.ctx.firmarConRedDeSeguridad(ALBARAN_ID, CUERPO, subirAlbaran(b));
  assert.equal((await enLaCola(b)).length, 1);
  assert.equal(b.ctx.huboColaAlgunaVez(), true,
    '🔴 se retira la marca con una firma en la cola: si el móvil la desaloja, nadie lo sabrá.');
});

test('SCRUM-1302h · ✅ CONTROL NEGATIVO: sube ésta pero queda OTRA en la cola → la marca se queda', async () => {
  const b = conRed(redNormal({ id: ALBARAN_ID, estado: 'firmado' }));
  await b.ctx.encolarFirma(43, CUERPO);   // otra, de antes, sin subir
  await b.ctx.firmarConRedDeSeguridad(ALBARAN_ID, CUERPO, subirAlbaran(b));
  assert.equal((await enLaCola(b)).length, 1, '🔴 CIEGO: la otra firma no está en la cola; el caso no se montó.');
  assert.equal(b.ctx.huboColaAlgunaVez(), true,
    '🔴 confirmar UNA firma retira la marca con OTRA todavía en la cola.');
});
