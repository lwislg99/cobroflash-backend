// tests/scrum1519d-la-revision-ata-el-cliente.test.mjs — SCRUM-1519d
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LA REVISIÓN YA NO COPIA EL CLIENTE DE OTRO COMERCIO.
//
// J1 lo midió por efecto (SCRUM-1519 c.19192): por la puerta nadie abre la cadena, pero con un
// presupuesto PROPIO que ya apunta al cliente de otro comercio, `crearRevisionDeQuote` fabricaba
// otra fila cruzada —CRUZA 2 de 2—, porque copia `customerId` de la versión de origen sin preguntar
// de quién es. Decisión del fundador (c.19205 ①): se contesta `quote_not_found`, lo mismo que a un id
// ajeno. Un 404 no confirma que el cliente exista.
//
// HAY DOS LECTURAS y las dos llevan la pieza: la versión ABIERTA y la VIGENTE, que es la que se
// copia cuando no coinciden. Cada caso de abajo cae si se quita SU pieza (medido, ver el registro).
//
// ⚠️ LO QUE ESTO NO CUBRE: la otra mitad del ticket, la ACEPTACIÓN (`ensureJobForQuote`), que copia
// el cliente al Trabajo igual. Espera a que el fundador firme el vehículo de su cable trampa.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist } from './_envio-doblado.mjs';

const { REVISION_HEREDA } = await import('../dist/modules/quotes/domain/revision.js');

const A = 21;
const B = 22;
const NUMERO = 615021;

const CLIENTES = [
  { id: 601, merchantId: A },
  { id: 702, merchantId: B },
];

/** Una versión del presupuesto, de A, con el cliente que se le diga. */
function version(id, revision, customerId) {
  const q = {
    id, merchantId: A, quoteNumber: NUMERO, revision,
    createdAt: new Date('2026-10-01T10:00:00Z'),
    signatureUrl: null,
  };
  for (const c of REVISION_HEREDA) q[c] = 'H:' + c;
  q.total = '100.00';
  q.currency = 'EUR';
  q.lines = [{ concept: 'Reforma', qty: 1, price: 100, tax: 0.21 }];
  q.customerId = customerId;
  return q;
}

/**
 * El doble RESPETA el `where` —id, negocio y, si viene, el negocio del cliente—: sin eso un
 * `findFirst` que devuelve siempre la fila diría «filtra» sin haber filtrado nada.
 */
async function revisar(versiones, abrir) {
  const creadas = [];
  const lecturas = [];
  inyectarBase({
    'quote.findFirst': ({ where }) => {
      lecturas.push(where);
      const q = versiones.find((v) => v.id === where.id && v.merchantId === where.merchantId);
      if (!q) return null;
      if (where.customer) {
        const c = CLIENTES.find((x) => x.id === q.customerId);
        if (!c || c.merchantId !== where.customer.merchantId) return null;
      }
      return q;
    },
    'quote.findMany': () => versiones.map((v) => ({ id: v.id, revision: v.revision, signatureUrl: v.signatureUrl })),
    'quote.create': (args) => {
      creadas.push(args.data);
      return { id: 9000, quoteNumber: args.data.quoteNumber, revision: args.data.revision, status: args.data.status };
    },
  }, ['../dist/modules/system/quoteAdmin.js']);
  const { crearRevisionDeQuote } = moduloDeDist('../dist/modules/system/quoteAdmin.js');
  let error = null;
  try { await crearRevisionDeQuote(A, abrir); } catch (e) { error = e; }
  return { creadas, error, lecturas };
}

test('SCRUM-1519d · CONTROL: con el cliente propio la revisión SE CREA (el banco llega a escribir)', async () => {
  const { creadas, error, lecturas } = await revisar([version(613, 0, 601)], 613);
  assert.equal(error, null, `🔴 el control no crea: ${error && error.message}`);
  assert.equal(creadas.length, 1, '🔴 CIEGO: sin una escritura en el caso sano, los «no escribe» de abajo no distinguen nada');
  assert.equal(creadas[0].customerId, 601);
  assert.ok(lecturas.length >= 1);
});

test('SCRUM-1519d · 🔴 la versión ABIERTA con el cliente de otro comercio: 404 y no escribe', async () => {
  const { creadas, error } = await revisar([version(616, 0, 702)], 616);
  assert.equal(creadas.length, 0,
    `🔴 CRUZA: se creó una revisión con el cliente ${creadas[0] && creadas[0].customerId}, que es de otro comercio`);
  assert.ok(error, '🔴 no lanzó nada y no escribió: el rechazo tiene que decirse, no callarse');
  assert.equal(error.motivo, 'quote_not_found', `🔴 el rechazo es «${error.motivo}»: el fundador decidió el 404 de siempre (c.19205)`);
});

test('SCRUM-1519d · 🔴 la abierta es sana pero la VIGENTE (la que se copia) lleva el cliente ajeno: 404 y no escribe', async () => {
  const { creadas, error, lecturas } = await revisar([version(617, 0, 601), version(618, 1, 702)], 617);
  assert.ok(lecturas.some((w) => w.id === 618),
    '🔴 CIEGO: no se llegó a leer la vigente, así que este caso no mide la segunda pieza');
  assert.equal(creadas.length, 0,
    `🔴 CRUZA: la revisión copió la vigente con el cliente ${creadas[0] && creadas[0].customerId}, que es de otro comercio`);
  assert.ok(error, '🔴 no lanzó nada y no escribió');
  assert.equal(error.motivo, 'quote_not_found');
});
