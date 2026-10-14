// SCRUM-1273 · ARCHIVAR UN PRESUPUESTO: una fecha, no un estado
//
// Por la ruta real (`dist`), base doblada. El contrato es el de c.19605:
//   · `POST /admin/quotes/:id/archivar` y `/desarchivar`, filtrando por `req.merchantId`, con
//     archivar sólo en borrador, rechazado o caducado, y fuera de ésos un 409 con el
//     texto firmado T10. SIN auditoría: decidido en c.19655 (`AuditAction` es cerrada). ⛔ No tocan `status`, ni el sello, ni el documento.
//   · `GET /admin/quotes` deja fuera los archivados por defecto; `?archivados=1` devuelve sólo ésos.
//   · el detalle devuelve `archivedAt`; una decisión sobre un archivado lo desarchiva.
//
// Los dobles son FIELES AL `where`: `updateMany` sólo cuenta las filas que casan con TODAS sus claves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { reqDeSesion } from './_arnes-de-router.mjs';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';

const RUTA = '../dist/modules/system/app/routes/quotesAdmin.routes.js';
const T10 = 'Solo se puede archivar un borrador, uno rechazado o uno caducado.';
const ID = 1273;
const copia = (x) => JSON.parse(JSON.stringify(x));

const fila0 = () => ({
  id: ID, merchantId: MERCHANT, customerId: CLIENTE, status: 'draft', archivedAt: null, charge: null,
  total: '121.00', currency: 'EUR', quoteNumber: 12, createdAt: new Date('2026-10-14T08:00:00Z'), tags: null,
  internalNotes: null, customer: { id: CLIENTE, name: 'Cliente 1273', phone: null },
});

/** ¿Casa la fila con esta clave del `where`? Lo justo de Prisma: igualdad, `null` y `{ not: null }`. */
function casa(valor, cond) {
  if (cond && typeof cond === 'object' && !(cond instanceof Date) && 'not' in cond) return cond.not === null ? valor != null : valor !== cond.not;
  if (cond === null) return valor == null;
  return valor === cond;
}

const banco = { fila: fila0(), alLeer: null, lecturas: 0, escrituras: [], auditorias: [], dondeDeLaLista: [] };
inyectarBase({
  'quote.findFirst': ({ where }) => {
    if (where.id !== banco.fila.id || where.merchantId !== banco.fila.merchantId) return null;
    banco.lecturas += 1;
    const foto = copia(banco.fila);
    if (banco.lecturas === 1 && banco.alLeer) banco.alLeer(banco.fila);
    return foto;
  },
  'quote.updateMany': ({ where, data }) => {
    const ok = Object.entries(where).every(([k, v]) => casa(banco.fila[k], v));
    if (!ok) return { count: 0 };
    banco.escrituras.push(copia(data));
    Object.assign(banco.fila, data);
    return { count: 1 };
  },
  'quote.findMany': ({ where }) => { banco.dondeDeLaLista.push(where); return []; },
  // `acceptQuoteAdmin` / `rejectQuoteAdmin`: el profesional apunta la decisión del cliente.
  'quote.update': ({ where, data }) => {
    if (where.id !== banco.fila.id) throw Object.assign(new Error('Record to update not found.'), { code: 'P2025' });
    banco.escrituras.push(copia(data));
    Object.assign(banco.fila, copia(data));
    return copia(banco.fila);
  },
  'whatsAppLog.findMany': () => [],
  'whatsappLog.findMany': () => [],
  'auditLog.create': ({ data }) => { banco.auditorias.push(data); return { id: 1 }; },
}, [RUTA]);

const router = moduloDeDist(RUTA).default;
const capaDe = (metodo, ruta) => {
  const c = router.stack.find((l) => l.route && l.route.path === ruta && l.route.methods[metodo]);
  assert.ok(c, `🔴 CIEGO: no encuentro ${metodo.toUpperCase()} ${ruta}`);
  return c.route.stack;
};
const ARCHIVAR = capaDe('post', '/:id/archivar');
const DESARCHIVAR = capaDe('post', '/:id/desarchivar');
const LISTA = capaDe('get', '/');
const ACEPTAR = capaDe('post', '/:id/accept');
const RECHAZAR = capaDe('post', '/:id/reject');

function preparar(extra = {}, alLeer = null) {
  Object.assign(banco, { fila: { ...fila0(), ...extra }, alLeer, lecturas: 0, escrituras: [], auditorias: [], dondeDeLaLista: [] });
}

async function llamar(pila, { id = ID, merchantId = MERCHANT, rol = 'admin', query = {} } = {}) {
  const r = { status: 200, body: undefined };
  const res = { status(s) { r.status = s; return res; }, json(j) { r.body = copia(j); return res; }, setHeader() { return res; } };
  const req = reqDeSesion({ rol, params: { id: String(id) }, merchantId, teamMemberId: rol === 'admin' ? null : 9, query, body: {}, headers: {}, ip: '127.0.0.1', socket: {} });
  const deVerdad = console.error; console.error = () => {};
  try {
    // La pila entera, en orden: el `requireRole` de la ruta va delante del manejador.
    for (const capa of pila) {
      let siguio = false;
      await capa.handle(req, res, () => { siguio = true; });
      if (!siguio) break;
    }
  } finally { console.error = deVerdad; }
  await new Promise((r2) => setImmediate(r2)); // por si algo escribiera sin esperar: se vería en `auditorias`
  return r;
}

test('SCRUM-1273 · SUELO: archivar un borrador escribe SÓLO archivedAt, y SIN auditoría (c.19655)', async () => {
  preparar();
  const r = await llamar(ARCHIVAR);
  assert.equal(r.status, 200, `🔴 CIEGO: el caso sano responde ${r.status} ${JSON.stringify(r.body)}`);
  assert.ok(r.body.archivedAt);
  assert.equal(banco.escrituras.length, 1);
  assert.deepEqual(Object.keys(banco.escrituras[0]), ['archivedAt'], '⛔ archivar ha escrito algo más que la fecha');
  assert.equal(banco.fila.status, 'draft', '⛔ archivar ha cambiado el estado');
  assert.equal(banco.auditorias.length, 0, '⛔ archivar escribe auditoría: c.19655 decidió que NO (`AuditAction` es cerrada)');
});

test('SCRUM-1273 · rechazado y caducado también se archivan', async () => {
  for (const status of ['rejected', 'expired']) {
    preparar({ status });
    const r = await llamar(ARCHIVAR);
    assert.equal(r.status, 200, `${status}: ${JSON.stringify(r.body)}`);
    assert.ok(banco.fila.archivedAt);
  }
});

test('SCRUM-1273 · 🔴 fuera de borrador, rechazado o caducado: 409 con T10 y CERO escrituras', async () => {
  for (const status of ['sent', 'accepted', 'pending_approval', 'paid', 'invoiced']) {
    preparar({ status });
    const r = await llamar(ARCHIVAR);
    assert.deepEqual([r.status, r.body], [409, { error: 'no_archivable', message: T10 }], status);
    assert.deepEqual([banco.escrituras.length, banco.auditorias.length], [0, 0], status);
  }
});

test('SCRUM-1273 · 🔴 un borrador con el cobro pagado o pendiente la lista lo pinta así: no se archiva', async () => {
  for (const cobro of ['paid', 'succeeded', 'pending']) {
    preparar({ charge: { status: cobro } });
    const r = await llamar(ARCHIVAR);
    assert.equal(r.status, 409, cobro);
    assert.equal(banco.escrituras.length, 0, cobro);
  }
  preparar({ charge: { status: 'expired' } }); // la lista dice «caducado»: se archiva
  assert.equal((await llamar(ARCHIVAR)).status, 200);
});

test('SCRUM-1273 · archivar dos veces no mueve la fecha ni deja otra traza', async () => {
  const antes = '2026-10-01T10:00:00.000Z';
  preparar({ archivedAt: antes });
  const r = await llamar(ARCHIVAR);
  assert.deepEqual([r.status, r.body.archivedAt], [200, antes]);
  assert.deepEqual([banco.escrituras.length, banco.auditorias.length], [0, 0]);
});

test('SCRUM-1273 · 🔴 TENENCIA: el presupuesto de otro negocio es 404 y no se escribe', async () => {
  preparar();
  for (const pila of [ARCHIVAR, DESARCHIVAR]) {
    const r = await llamar(pila, { merchantId: MERCHANT + 1 });
    assert.equal(r.status, 404);
  }
  assert.equal(banco.escrituras.length, 0);
});

test('SCRUM-1273 · 🔴 el cliente acepta entre la lectura y la escritura: no se archiva un aceptado', async () => {
  preparar({}, (fila) => { fila.status = 'accepted'; });
  const r = await llamar(ARCHIVAR);
  assert.equal(banco.lecturas >= 1 && banco.fila.status, 'accepted', '🔴 CIEGO: la decisión de en medio no ha ocurrido');
  assert.equal(banco.escrituras.length, 0, '🔴 se ha archivado un presupuesto ya aceptado');
  assert.deepEqual([r.status, r.body], [409, { error: 'no_archivable', message: T10 }]);
});

test('SCRUM-1273 · desarchivar vuelve a NULL, sin auditoría; sobre uno no archivado no escribe', async () => {
  preparar({ archivedAt: '2026-10-01T10:00:00.000Z', status: 'rejected' });
  const r = await llamar(DESARCHIVAR);
  assert.deepEqual([r.status, r.body], [200, { id: ID, archivedAt: null }]);
  assert.equal(banco.fila.archivedAt, null);
  assert.equal(banco.fila.status, 'rejected', '⛔ desarchivar ha cambiado el estado');
  assert.equal(banco.auditorias.length, 0, '⛔ desarchivar escribe auditoría: c.19655 decidió que NO');

  preparar();
  const r2 = await llamar(DESARCHIVAR);
  assert.deepEqual([r2.status, banco.escrituras.length, banco.auditorias.length], [200, 0, 0]);
});

test('SCRUM-1273 · las dos rutas son de admin: un técnico recibe 403 y no se escribe', async () => {
  preparar({ archivedAt: '2026-10-01T10:00:00.000Z' });
  for (const pila of [ARCHIVAR, DESARCHIVAR]) {
    const r = await llamar(pila, { rol: 'tecnico' });
    assert.equal(r.status, 403);
  }
  assert.equal(banco.escrituras.length, 0);
});

test('SCRUM-1273 · la lista deja fuera los archivados; con ?archivados=1 devuelve sólo ésos', async () => {
  preparar();
  await llamar(LISTA, { query: {} });
  await llamar(LISTA, { query: { archivados: '1' } });
  const [porDefecto, archivados] = banco.dondeDeLaLista;
  assert.ok(porDefecto && archivados, '🔴 CIEGO: la lista no ha llegado a consultar');
  assert.equal(porDefecto.archivedAt, null);
  assert.deepEqual(archivados.archivedAt, { not: null });
  assert.equal(porDefecto.merchantId, MERCHANT);
});

test('SCRUM-1273 · el profesional apunta que el cliente aceptó o rechazó un archivado: vuelve a la lista', async () => {
  for (const [pila, estado] of [[ACEPTAR, 'accepted'], [RECHAZAR, 'rejected']]) {
    preparar({ archivedAt: '2026-10-01T10:00:00.000Z' });
    const r = await llamar(pila);
    assert.equal(r.status, 200, `🔴 CIEGO: ${estado} no ha entrado: ${JSON.stringify(r.body)}`);
    assert.equal(banco.fila.status, estado);
    assert.equal(banco.fila.archivedAt, null, `🔴 ${estado} y archivado`);
  }
});