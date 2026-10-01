// SCRUM-1307 · `borrarMerchant` SE NIEGA ENTERO si el comercio tiene envíos a la AEAT.
//
// Firma del fundador (Jira SCRUM-1307, comentario 17664, 1-oct-2026, «2-Firmo»), opción (a):
// comprobar ANTES de tocar nada y negarse entero —cero `deleteMany`— en vez de borrar media cuenta
// y devolver el error por escrito. Es lo que ya decía la decisión 3 de SCRUM-1127b («un comercio
// con envíos no se borra»); hasta aquí el código lo cumplía para la fila del merchant, no para su
// contenido.
//
// EL DEFECTO, medido en un Postgres desechable con el DDL del schema: con una fila en
// `vf_submissions`, el borrado de `invoice` fallaba en el paso 14, pero el bucle seguía — `charge`
// y `quote` caían, y como sus FK desde `invoices` son SET NULL (medido también en dev, staging y
// producción), la factura PRESENTADA se quedaba sin enlace a su cobro ni a su presupuesto.
//
// Aquí se prueba con un doble que modela esa semántica: el RESTRICT de `invoice` y el SET NULL de
// `charge`/`quote`. Sin BD, sin red.
import test from 'node:test';
import assert from 'node:assert/strict';
import { borrarMerchant, ORDEN_BORRADO_MERCHANT, COLGADOS_DE_CHARGE } from '../dist/modules/system/domain/borradoMerchant.js';

const MERCHANT = 7;
const OTRO = 8;

/**
 * Un comercio con UNA factura enlazada a su cobro y a su presupuesto, y `envios` filas en la cola
 * de la AEAT (de `MERCHANT`) más `enviosDeOtro` de otro comercio.
 */
function comercio({ envios = 0, enviosDeOtro = 0, countRevienta = false } = {}) {
  const factura = { id: 1, merchantId: MERCHANT, chargeId: 10, quoteId: 20 };
  let facturaViva = true;
  const cola = [
    ...Array.from({ length: envios }, () => ({ merchantId: MERCHANT })),
    ...Array.from({ length: enviosDeOtro }, () => ({ merchantId: OTRO })),
  ];
  const deleteManys = [];
  const modelo = (nombre) => ({
    count: async ({ where } = {}) => {
      if (nombre !== 'vfSubmission') return 0;
      if (countRevienta) throw new Error('relation "vf_submissions" does not exist');
      return cola.filter((f) => where?.merchantId === undefined || f.merchantId === where.merchantId).length;
    },
    deleteMany: async ({ where } = {}) => {
      deleteManys.push({ modelo: nombre, where });
      // RESTRICT de vf_submissions → invoices y → merchants.
      if ((nombre === 'invoice' || nombre === 'merchant') && cola.some((f) => f.merchantId === MERCHANT)) {
        throw new Error('violates foreign key constraint "vf_submissions_invoice_id_fkey"');
      }
      if (nombre === 'invoice' && facturaViva) { facturaViva = false; return { count: 1 }; }
      // SET NULL de invoices.charge_id / invoices."quoteId": el padre cae y la factura se queda.
      if (nombre === 'charge') { factura.chargeId = null; return { count: 1 }; }
      if (nombre === 'quote') { factura.quoteId = null; return { count: 1 }; }
      return { count: 0 };
    },
  });
  const prisma = new Proxy({}, { get: (_t, k) => modelo(String(k)) });
  return { prisma, deleteManys, factura: () => (facturaViva ? { ...factura } : null) };
}

// ═══ ① EL ROJO: con envíos, NO se toca nada ══════════════════════════════════════════════

test('SCRUM-1307 · con envíos a la AEAT, cero deleteMany: la factura presentada conserva sus enlaces', async () => {
  const c = comercio({ envios: 1 });
  const r = await borrarMerchant(c.prisma, MERCHANT, { telefonosBot: ['34600000001'] });

  assert.deepEqual(
    c.deleteManys.map((d) => d.modelo), [],
    '🔴 con envíos a la AEAT se ha borrado algo. La decisión 3 de SCRUM-1127b dice que un comercio ' +
      'con envíos NO se borra, y el RESTRICT solo protege la fila de invoice y la del merchant: ' +
      'todo lo de alrededor caía igual.',
  );
  assert.deepEqual(c.factura(), { id: 1, merchantId: MERCHANT, chargeId: 10, quoteId: 20 },
    '🔴 la factura presentada perdió el enlace a su cobro o a su presupuesto (SET NULL): regla 29');
  assert.equal(r.ok, false, '🔴 una negativa no puede devolver ok');
  assert.ok(r.errores.some((e) => e.modelo === 'vfSubmission'),
    '🔴 la negativa no se DICE: sin un error que nombre la cola, nadie sabe por qué no se borró');
});

// ═══ ② CONTROL POSITIVO: sin envíos, se borra entero, como antes ═════════════════════════

test('SCRUM-1307 · CONTROL POSITIVO: sin envíos, el comercio se borra entero y en el mismo orden', async () => {
  const c = comercio({ envios: 0 });
  const r = await borrarMerchant(c.prisma, MERCHANT, { telefonosBot: ['34600000001'] });
  const esperado = [...Object.keys(COLGADOS_DE_CHARGE), ...ORDEN_BORRADO_MERCHANT, 'botSession', 'merchant'];
  assert.deepEqual(c.deleteManys.map((d) => d.modelo), esperado,
    '🔴 la comprobación previa bloquea o altera el borrado de un comercio que SÍ se puede borrar');
  assert.equal(c.factura(), null, '🔴 sin envíos la factura tenía que caer');
  assert.ok(!r.errores.some((e) => e.modelo === 'vfSubmission'), '🔴 negativa sin envíos');
});

test('SCRUM-1307 · CONTROL: los envíos de OTRO comercio no bloquean este', async () => {
  // La comprobación tiene que ir acotada al merchant: si contara la cola entera, un solo comercio
  // con envíos impediría borrar a todos los demás.
  const c = comercio({ envios: 0, enviosDeOtro: 3 });
  await borrarMerchant(c.prisma, MERCHANT, { telefonosBot: ['34600000001'] });
  assert.ok(c.deleteManys.length > 0, '🔴 la comprobación no está acotada al merchant: la cola de otro lo bloquea');
});

// ═══ ③ CONTROL NEGATIVO: «no había nada» y «me negué» son dos ceros distintos ════════════

test('SCRUM-1307 · «no había nada que borrar» ≠ «me negué a borrar», con la MISMA forma de resultado', async () => {
  // Sin estado nuevo (regla 5): la forma sigue siendo { ok, borradas, errores }. La diferencia se
  // lee en ella: quien recorrió deja cada modelo con su cifra (aunque sea 0); quien se negó no
  // recorrió nada y lo dice en `errores`.
  const vacio = await borrarMerchant(comercio({ envios: 0 }).prisma, MERCHANT, { telefonosBot: ['34600000001'] });
  const negado = await borrarMerchant(comercio({ envios: 1 }).prisma, MERCHANT, { telefonosBot: ['34600000001'] });

  assert.deepEqual(Object.keys(negado).sort(), Object.keys(vacio).sort(), '🔴 la negativa cambió la forma del resultado');
  assert.ok('customer' in vacio.borradas && 'albaran' in vacio.borradas,
    '🔴 CIEGO: el recorrido sin envíos no apunta sus ceros; entonces las dos cifras no se distinguen');
  assert.deepEqual(negado.borradas, {}, '🔴 la negativa apunta cifras de un recorrido que no debió ocurrir');
  assert.ok(negado.errores.some((e) => e.modelo === 'vfSubmission'));
  assert.ok(!vacio.errores.some((e) => e.modelo === 'vfSubmission'));
});

test('SCRUM-1307 · si NO se puede comprobar la cola, se niega igual (una comprobación que falla no es un permiso)', async () => {
  const c = comercio({ envios: 0, countRevienta: true });
  const r = await borrarMerchant(c.prisma, MERCHANT, { telefonosBot: ['34600000001'] });
  assert.deepEqual(c.deleteManys, [], '🔴 la comprobación reventó y el borrado siguió como si no hubiera envíos');
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.modelo === 'vfSubmission'));
});
