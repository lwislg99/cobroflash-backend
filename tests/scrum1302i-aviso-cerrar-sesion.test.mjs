// SCRUM-1302 · CERRAR SESIÓN CON FIRMAS SIN SUBIR: se dice antes, y «Cancelar» no borra nada.
//
// El logout vacía la cola de firmas a propósito (SCRUM-455). Hasta hoy lo hacía callado: una firma
// hecha sin cobertura y aún sin subir desaparecía al cerrar sesión. Textos firmados en SCRUM-1302,
// comentario 17889. Las tres mitades se miden JUNTAS, porque por separado el texto miente:
//   (a) la cola se cuenta ANTES del purgado;
//   (b) con red se intenta subir primero y, si queda en cero, se cierra sin preguntar;
//   (c) si quedan, se pregunta, y «Cancelar» ni cierra sesión ni borra nada.
// Y si la cola no se puede leer, NO se pregunta: no hay cifra cierta que dar.
//
// Ejecuta el `logout()` REAL de `app.js` con `colaDeFirmas.js`, `almacenLocal.js` y `api.js` reales
// sobre IndexedDB (`fake-indexeddb`) y un `fetch` que se enciende y se apaga.
//
// Lo que NO mide: un navegador de verdad (el `confirm` nativo, Safari), ni el caso de una firma
// RECHAZADA durante el intento de subida, que queda abierto en SCRUM-1383.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { montarAlmacen, porQueEstariaCiego } from './_banco-almacen-local.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const UNA = 'Te queda 1 firma por subir. Si cierras sesión ahora, se borra de este móvil y habrá que volver a firmar. ¿Cerrar sesión?';
const VARIAS = (n) => `Te quedan ${n} firmas por subir. Si cierras sesión ahora, se borran de este móvil y habrá que volver a firmarlas. ¿Cerrar sesión?`;

function montar() {
  const red = { conRed: true, firmas: [], cierres: 0, modoFirma: 'ok' };
  const responder = (status, data) => ({
    ok: status >= 200 && status < 300, status, statusText: String(status),
    headers: { get: () => 'application/json' },
    json: async () => data, blob: async () => ({}), text: async () => JSON.stringify(data),
  });
  red.fetch = async (url, opts) => {
    const u = String(url);
    const metodo = (opts && opts.method) || 'GET';
    if (u.includes('/auth/logout')) { red.cierres += 1; return responder(200, {}); }
    if (!red.conRed) throw new TypeError('Failed to fetch');
    if (metodo === 'POST' && /\/firmar$/.test(u)) {
      red.firmas.push(u);
      if (red.modoFirma === '500') return responder(500, { error: 'server_error' });
      return responder(200, { id: Number(u.match(/(\d+)\/firmar$/)[1]), estado: 'firmado' });
    }
    return responder(200, {});
  };
  red.navigator = { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } };
  const b = montarAlmacen(RAIZ, { dashboard: { red } });
  const avisos = { acepta: true, preguntas: [] };
  b.ctx.confirm = (texto) => { avisos.preguntas.push(String(texto)); return avisos.acepta; };
  return { b, red, avisos };
}

async function encolar(b, ids) {
  for (const id of ids) {
    await b.ctx.encolarFirma(id, { signatureData: 'data:image/png;base64,' + 'A'.repeat(400), firmadoPorNombre: 'Ana Ruiz' }, 'albaran');
  }
  assert.equal(await enCola(b), ids.length, '🔴 SUELO: las firmas no han entrado en la cola; este test no mediría nada');
}

async function enCola(b) {
  const r = await b.ctx.leerFirmasPendientes();
  assert.equal(r.estado, b.ctx.GUARDADO, '🔴 SUELO: la cola no se puede leer');
  return r.firmas.length;
}

const salio = (b) => String(b.ctx.location.href).includes('/login.html');

test('SCRUM-1302i · suelo: el banco ve el almacén, la cola y el `logout` real', () => {
  const { b } = montar();
  assert.equal(porQueEstariaCiego(b, RAIZ), null);
  for (const n of ['logout', 'encolarFirma', 'drenarSiNoSeEstaDrenando', 'leerFirmasPendientes']) {
    assert.equal(typeof b.ctx[n], 'function', `\`${n}\` no es alcanzable desde el banco`);
  }
  assert.equal(salio(b), false, 'antes de cerrar sesión el banco no está en el login');
});

test('SCRUM-1302i · control: con la cola vacía se cierra sesión sin preguntar nada', async () => {
  const { b, red, avisos } = montar();
  await b.ctx.logout();
  assert.deepEqual(avisos.preguntas, []);
  assert.equal(red.cierres, 1);
  assert.equal(salio(b), true);
});

test('SCRUM-1302i · sin red y con UNA firma: pregunta con el literal firmado; «Cancelar» no cierra ni borra', async () => {
  const { b, red, avisos } = montar();
  await encolar(b, [7]);
  red.conRed = false;
  b.ctx.navigator.onLine = false;
  avisos.acepta = false;

  await b.ctx.logout();

  assert.deepEqual(avisos.preguntas, [UNA], 'se pregunta una vez y con el texto firmado, en singular');
  assert.equal(await enCola(b), 1, '🔴 dijo «Cancelar» y la firma se ha borrado igual');
  assert.equal(red.cierres, 0, '🔴 dijo «Cancelar» y se ha llamado a /auth/logout');
  assert.equal(salio(b), false, '🔴 dijo «Cancelar» y se le ha mandado al login');
});

test('SCRUM-1302i · sin red y con VARIAS: el plural lleva la cifra de la cola; si acepta, se purga y se cierra', async () => {
  const { b, red, avisos } = montar();
  await encolar(b, [7, 8, 9]);
  red.conRed = false;
  b.ctx.navigator.onLine = false;

  await b.ctx.logout();

  assert.deepEqual(avisos.preguntas, [VARIAS(3)]);
  assert.equal(await enCola(b), 0, 'aceptó: el purgado de SCRUM-455 sigue vaciando la cola');
  assert.equal(red.cierres, 1);
  assert.equal(salio(b), true);
});

test('SCRUM-1302i · con red: se suben antes de preguntar y, si no queda ninguna, se cierra SIN preguntar', async () => {
  const { b, red, avisos } = montar();
  await encolar(b, [7, 8]);
  avisos.acepta = false; // si preguntase, este test lo vería: no se cerraría

  await b.ctx.logout();

  assert.equal(red.firmas.length, 2, '🔴 SUELO: no se ha intentado subir las dos firmas');
  assert.deepEqual(avisos.preguntas, [], '🔴 se subieron todas y aun así se preguntó por firmas sin subir');
  assert.equal(red.cierres, 1);
  assert.equal(salio(b), true);
});

test('SCRUM-1302i · con red que no las acepta: se intenta, quedan, y se pregunta por las que QUEDAN', async () => {
  const { b, red, avisos } = montar();
  await encolar(b, [7, 8]);
  red.modoFirma = '500';
  avisos.acepta = false;

  await b.ctx.logout();

  assert.equal(red.firmas.length, 2, '🔴 SUELO: no se intentó subir antes de preguntar');
  assert.deepEqual(avisos.preguntas, [VARIAS(2)]);
  assert.equal(await enCola(b), 2, 'un 500 no saca nada de la cola, y «Cancelar» tampoco');
  assert.equal(salio(b), false);
});

test('SCRUM-1302i · `onLine` miente (dice que hay red y no la hay): se pregunta igual, no se cuelga', async () => {
  const { b, red, avisos } = montar();
  await encolar(b, [7]);
  red.conRed = false; // `navigator.onLine` sigue en true
  avisos.acepta = false;

  await b.ctx.logout();

  assert.deepEqual(avisos.preguntas, [UNA]);
  assert.equal(await enCola(b), 1);
  assert.equal(salio(b), false);
});

test('SCRUM-1302i · si la cola no se puede LEER no se pregunta: se cierra sesión como siempre', async () => {
  const { b, red, avisos } = montar();
  await encolar(b, [7]);
  const leerDeVerdad = b.ctx.leerFirmasPendientes;
  b.ctx.leerFirmasPendientes = async () => ({ estado: b.ctx.FALLO, motivo: 'banco: almacén ilegible', firmas: [] });
  avisos.acepta = false;

  await b.ctx.logout();
  b.ctx.leerFirmasPendientes = leerDeVerdad;

  assert.deepEqual(avisos.preguntas, [], '🔴 se preguntó con una cifra que no se pudo leer');
  assert.equal(red.cierres, 1, 'cerrar sesión tiene que funcionar siempre (SCRUM-455)');
  assert.equal(salio(b), true);
});
