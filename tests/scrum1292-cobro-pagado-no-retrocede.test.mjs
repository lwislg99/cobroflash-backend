// SCRUM-1292 · UN COBRO YA PAGADO SE MARCABA COMO FALLIDO O CADUCADO. SIN NINGUNA CARRERA.
//
// El caso es el orden NORMAL de dos avisos de Stripe:
//   ① el cliente paga por Bizum y el cobro queda `paid` — el dinero está;
//   ② la sesión de Stripe abierta para ese mismo cobro caduca después, porque nadie la usó;
//   ③ llega `payment.expired` → el cobro pagado pasaba a `expired`.
//
// Y con él, lo que el panel dice que le deben al profesional, los avisos y la facturación.
// Encontrado por S3 (equipo de Luis) censando 127 escrituras; reproducido por el equipo de Javier
// sobre la ruta compilada antes de tocar nada (comentario 17635).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ LA BASE DOBLADA HACE CUMPLIR EL `where`, Y NO SÓLO REGISTRA LA LLAMADA
//
// El arreglo son DOS barreras: un `if` de entrada y la condición DENTRO del `update`. Un doble que
// se limitara a apuntar la llamada daría verde con sólo la primera — y la primera sola no sujeta
// nada, porque entre «comprobar» y «escribir» cabe otra petición.
//
// Así que aquí el doble se comporta como Prisma: si el `where` trae `status: { in: [...] }` y el
// estado de la fila NO está en esa lista, LANZA P2025, igual que la base. Eso convierte «¿puso la
// condición donde toca?» en algo que el test puede ver. El caso ⑦ es el que lo ejercita.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { dobleDeLaBase } from './_envio-doblado.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

function doblarModulo(ruta, exports) {
  const f = rutaDe(ruta);
  requiere.cache[f] = { id: f, filename: f, loaded: true, exports };
}

/**
 * Monta el webhook REAL sobre un cobro con el estado que se le diga.
 *
 * `alEscribir` permite cambiar la fila JUSTO ANTES de que el `update` la evalúe: es como se simula
 * que alguien pagó entre la lectura y la escritura, sin depender de ninguna latencia real.
 */
function bancoDelWebhook(estadoInicial, { alEscribir = null } = {}) {
  const cobro = {
    id: 1292, merchantId: 4292, customerId: null, status: estadoInicial, amount: '50.00',
    currency: 'EUR', method: 'bizum_manual', intentId: null, customer: null,
  };
  const actualizaciones = [];
  const doble = dobleDeLaBase({
    'charge.findUnique': () => ({ ...cobro }),
    'charge.update': (args) => {
      if (alEscribir) alEscribir(cobro);
      // El doble hace cumplir el `where` ENTERO, no sólo el estado. Que ignorara el `id` lo destapó
      // una mutación que apuntaba la escritura a una fila inexistente: el doble escribía igual, así
      // que los controles positivos ④ y ⑤ no la veían. Un doble más laxo que la base convierte sus
      // verdes en ruido.
      const permitidos = args?.where?.status?.in;
      const noCasa =
        (args?.where?.id !== undefined && args.where.id !== cobro.id) ||
        (Array.isArray(permitidos) && !permitidos.includes(cobro.status));
      if (noCasa) {
        const e = new Error('Record to update not found.');
        e.code = 'P2025';
        throw e;
      }
      actualizaciones.push(args);
      Object.assign(cobro, args?.data ?? {});
      return { ...cobro };
    },
    'merchant.findUnique': () => ({ id: cobro.merchantId, timezone: 'Europe/Madrid' }),
    'event.create': () => ({ id: 1 }),
  });
  const fPrisma = rutaDe('dist/core/db/prisma.js');
  requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble } };
  doblarModulo('dist/lib/email.js', { sendInvoiceEmail: async () => {} });
  doblarModulo('dist/lib/invoicing.js', {
    ensureInvoiceForCharge: async () => null,
    ensureChargeReceiptToken: async () => 'tok_1292',
  });
  for (const m of [
    'dist/core/config/env.js', 'dist/modules/billing/domain/correoDeFacturaEnviado.js',
    'dist/modules/system/customerEvents.service.js', 'dist/integrations/whatsappNotifications.js',
    'dist/integrations/whatsapp.js', 'dist/modules/jobs/domain/job.service.js',
    'dist/modules/messaging/domain/merchantNotifications.js',
    'dist/modules/billing/app/routes/psp.routes.js',
  ]) { try { delete requiere.cache[rutaDe(m)]; } catch { /* aún no existe */ } }

  const mod = requiere(path.join(RAIZ, 'dist/modules/billing/app/routes/psp.routes.js'));
  const router = mod.default || mod;
  const capa = router.stack?.find((c) => c.route?.methods?.post);
  assert.ok(capa, '🔴 CIEGO: no se encuentra el POST de `psp.routes`');
  const handle = capa.route.stack[0].handle;

  const entregar = async (event) => {
    const req = { body: { event, charge_id: cobro.id, method: 'bizum_manual', bank_ref: 'b-1292', amount: 50, currency: 'EUR' } };
    let cuerpo = null;
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(x) { cuerpo = x; return this; } };
    await handle(req, res, (e) => { if (e) throw e; });
    return { statusCode: res.statusCode, cuerpo };
  };
  return { entregar, actualizaciones, cobro };
}

// ── EL DEFECTO ────────────────────────────────────────────────────────────────────────────

for (const [n, event] of [['①', 'payment.expired'], ['②', 'payment.failed']]) {
  test(`SCRUM-1292 · 🔴 ${n} un cobro PAGADO recibe ${event} y SIGUE pagado`, async () => {
    const b = bancoDelWebhook('paid');
    const r = await b.entregar(event);
    assert.equal(b.cobro.status, 'paid',
      `🔴 EL COBRO PAGADO HA RETROCEDIDO A «${b.cobro.status}». El dinero está en la cuenta del `
      + 'profesional y la aplicación dice que no se ha cobrado; de ese estado cuelgan lo que el panel '
      + 'dice que le deben, los avisos y la facturación.');
    assert.equal(b.actualizaciones.length, 0, '🔴 y ni siquiera debería escribir: no hay nada que cambiar');
    assert.equal(r.statusCode, 200,
      '🔴 al proveedor se le sigue contestando 200: un 4xx o 5xx le haría reintentar tres días');
    assert.equal(r.cuerpo.status, 'already_paid');
  });
}

test('SCRUM-1292 · ③ el caso completo del Bizum: se cobra y DESPUÉS caduca la sesión de Stripe', async () => {
  // El orden real, en un solo cobro: primero el pago, después la caducidad de la sesión que nadie usó.
  const b = bancoDelWebhook('pending');
  const pago = await b.entregar('payment.confirmed');
  assert.equal(b.cobro.status, 'paid', `precondición: el Bizum marca el cobro (${JSON.stringify(pago.cuerpo)})`);

  const caducidad = await b.entregar('payment.expired');
  assert.equal(b.cobro.status, 'paid',
    '🔴 la sesión de Stripe caducó DESPUÉS de cobrar por Bizum y se ha llevado por delante el cobro.');
  assert.equal(caducidad.cuerpo.status, 'already_paid');
});

// ── LOS CONTROLES ─────────────────────────────────────────────────────────────────────────
//
// Sin éstos, los de arriba pasarían igual si la ruta dejara de escribir del todo.

for (const [n, inicial, event, esperado] of [
  ['④', 'pending', 'payment.failed', 'failed'],
  ['⑤', 'pending', 'payment.expired', 'expired'],
]) {
  test(`SCRUM-1292 · ✅ ${n} CONTROL POSITIVO: ${inicial} + ${event} SÍ pasa a «${esperado}»`, async () => {
    const b = bancoDelWebhook(inicial);
    const r = await b.entregar(event);
    assert.equal(b.cobro.status, esperado,
      `🔴 el camino normal ha dejado de funcionar: un cobro ${inicial} tiene que poder quedar `
      + `«${esperado}». Sin este caso, los ① y ② pasarían aunque la ruta no escribiera nunca.`);
    assert.equal(b.actualizaciones.length, 1, 'y escribe exactamente una vez');
    assert.equal(r.cuerpo.status, esperado);
  });
}

test('SCRUM-1292 · ⑥ CONTROL: el mismo aviso sobre el mismo estado sigue sin escribir', async () => {
  const b = bancoDelWebhook('failed');
  const r = await b.entregar('payment.failed');
  assert.equal(b.actualizaciones.length, 0, 'ya estaba fallido: no se reescribe');
  assert.equal(r.cuerpo.status, 'already_failed');
});

// ── LA SEGUNDA BARRERA ────────────────────────────────────────────────────────────────────

test('SCRUM-1292 · 🔴 ⑦ EL QUE DECIDE: la condición va DENTRO del `update`, no sólo en el `if`', async () => {
  // La fila se lee `pending` —así que el `if` de entrada deja pasar— y alguien la paga JUSTO antes de
  // que la base evalúe la escritura. Con la condición sólo en el `if`, esto pisaría el cobro pagado.
  const b = bancoDelWebhook('pending', { alEscribir: (c) => { c.status = 'paid'; } });
  const r = await b.entregar('payment.expired');
  assert.equal(b.cobro.status, 'paid',
    '🔴 LA CONDICIÓN NO ESTÁ EN LA ESCRITURA. El `if` de entrada vio «pending» y la fila ya estaba '
    + 'pagada al escribir: entre comprobar y escribir cabe otra petición, y por ahí se cuela el '
    + 'mismo defecto que este ticket cierra. Tiene que ir en el `where` del `update`.');
  assert.equal(b.actualizaciones.length, 0, 'y no se escribió nada');
  assert.equal(r.statusCode, 200, 'al proveedor se le contesta 200 igual');
  assert.equal(r.cuerpo.status, 'already_paid');
});

// ── LOS TRES CAMINOS QUE LO ALCANZAN ──────────────────────────────────────────────────────

test('SCRUM-1292 · ⑧ los TRES caminos desembocan en este webhook, así que el arreglo los cubre', () => {
  // Medido, no supuesto: si mañana uno de ellos escribiera el estado por su cuenta, este arreglo no
  // lo protegería y aquí habría que enterarse.
  const caminos = [
    ['src/modules/billing/app/routes/stripe.routes.ts', 'payment.failed'],
    ['src/modules/billing/app/routes/stripe.routes.ts', 'payment.expired'],
    ['src/modules/payments/connect/connectWebhook.routes.ts', 'payment.failed'],
  ];
  for (const [fichero, evento] of caminos) {
    const src = fs.readFileSync(path.join(RAIZ, fichero), 'utf8');
    assert.ok(src.includes('/webhooks/psp'),
      `🔴 ${fichero} ya no manda por \`/webhooks/psp\`: si escribe el estado por su cuenta, el arreglo `
      + 'de este ticket no lo cubre.');
    assert.ok(src.includes(`event: '${evento}'`),
      `🔴 ${fichero} ya no manda \`${evento}\`: la población que este ticket protege ha cambiado.`);
    assert.ok(!/prisma\.charge\.update/.test(src),
      `🔴 ${fichero} ha empezado a escribir el estado del cobro directamente, saltándose el webhook `
      + 'y con él las dos barreras.');
  }
});
