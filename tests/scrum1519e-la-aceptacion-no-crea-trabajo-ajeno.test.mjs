// tests/scrum1519e-la-aceptacion-no-crea-trabajo-ajeno.test.mjs — SCRUM-1519e
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LA ACEPTACIÓN YA NO CREA UN TRABAJO CON EL CLIENTE DE OTRO COMERCIO, Y LO DICE.
//
// J1 lo midió por efecto (SCRUM-1519 c.19192): con un presupuesto PROPIO que ya apunta al cliente
// de otro comercio, `ensureJobForQuote` creaba el Trabajo con ese cliente —CRUZA 2 de 2—, porque
// copia `customerId` sin preguntar de quién es. Es la otra mitad de 1519d (la revisión).
//
// Decisión del fundador (c.19205 ②) y su firma (comentario 19913): la aceptación NO falla, el Trabajo
// NO se crea y queda UNA fila de auditoría, `trabajo_omitido_cliente_ajeno`, con `{quoteId,
// customerId}`. Ni WhatsApp ni log a secas.
//
// 🔵 Y EL CONTROL QUE IMPORTA: una aceptación LEGÍTIMA sigue creando su Trabajo y NO escribe esa
// fila. Sin él, «no crea» no distingue «funciona» de «lo bloquea todo».
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist } from './_envio-doblado.mjs';

const A = 21;
const B = 22;
const ACCION = 'trabajo_omitido_cliente_ajeno';

/** Un presupuesto ACEPTADO de A, sin Trabajo, con el cliente que se le diga. */
const presupuesto = (customer) => ({
  id: 615, merchantId: A, customerId: customer ? customer.id : 702, status: 'accepted',
  total: '100.00', quoteNumber: 615021, teamMemberId: null, jobId: null, customer,
});

/**
 * Ejecuta `ensureJobForQuote` con la base doblada. El doble es el GLOBAL —`recordAudit` escribe
 * por él— y se le pasa también como `prismaClient`, que es como lo llaman las rutas (sin argumento).
 */
async function aceptar(quote) {
  const trabajos = [];
  const auditoria = [];
  const enlaces = [];
  inyectarBase({
    'quote.findUnique': () => quote,
    'job.findUnique': () => null, // sin Trabajo viejo que enlazar
    'job.create': (args) => { trabajos.push(args.data); return { id: 9009 }; },
    'quote.update': (args) => { enlaces.push(args); return {}; },
    'auditLog.create': (args) => { auditoria.push(args.data); return { id: 1 }; },
  }, ['../dist/modules/system/audit.service.js', '../dist/modules/jobs/domain/job.service.js']);
  const { ensureJobForQuote } = moduloDeDist('../dist/modules/jobs/domain/job.service.js');
  await ensureJobForQuote(quote.id);
  const omitidas = auditoria.filter((a) => a.action === ACCION);
  return { trabajos, enlaces, auditoria, omitidas };
}

test('SCRUM-1519e · CONTROL: una aceptación LEGÍTIMA crea su Trabajo y NO escribe la fila del cable trampa', async () => {
  const { trabajos, enlaces, auditoria, omitidas } = await aceptar(presupuesto({ id: 601, name: 'Propio', merchantId: A }));
  assert.equal(trabajos.length, 1,
    '🔴 la aceptación legítima ya no crea Trabajo: el arreglo lo bloquea TODO, no sólo lo cruzado');
  assert.equal(trabajos[0].customerId, 601);
  assert.equal(enlaces.length, 1, '🔴 el presupuesto no quedó apuntando a su Trabajo');
  assert.ok(auditoria.length >= 1,
    '🔴 CIEGO: el banco no ve ninguna escritura de auditoría, ni la de autoría del operario; un «0 filas» abajo no valdría nada');
  assert.equal(omitidas.length, 0, '🔴 una aceptación legítima dejó la fila del cable trampa: saltaría siempre');
});

test('SCRUM-1519e · 🔴 cliente de OTRO comercio: no se crea el Trabajo y queda UNA fila con {quoteId, customerId}', async () => {
  const { trabajos, enlaces, omitidas } = await aceptar(presupuesto({ id: 702, name: 'Ajeno', merchantId: B }));
  assert.equal(trabajos.length, 0,
    `🔴 CRUZA: se creó un Trabajo del comercio ${A} con el cliente ${trabajos[0] && trabajos[0].customerId}, que es de otro comercio`);
  assert.equal(enlaces.length, 0, '🔴 se tocó el presupuesto sin haber Trabajo');
  assert.equal(omitidas.length, 1,
    `🔴 se omitió en SILENCIO (${omitidas.length} filas): el fundador pidió que quede registrado (c.19205 ②)`);
  const [fila] = omitidas;
  assert.equal(fila.merchantId, A, '🔴 la fila va al negocio del presupuesto');
  assert.equal(fila.entityType, 'quote');
  assert.equal(fila.entityId, 615);
  assert.deepEqual(fila.meta, { quoteId: 615, customerId: 702 }, '🔴 el meta firmado es {quoteId, customerId}, y nada más');
});

test('SCRUM-1519e · 🔴 cliente que NO aparece: se falla cerrado, igual que con uno ajeno', async () => {
  const { trabajos, omitidas } = await aceptar(presupuesto(null));
  assert.equal(trabajos.length, 0, '🔴 sin cliente que comprobar se creó el Trabajo igualmente');
  assert.equal(omitidas.length, 1);
});
