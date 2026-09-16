// tests/scrum815-el-correo-una-sola-vez.test.mjs — SCRUM-815 (el correo de factura duplicado)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA VÍCTIMA ES EL CLIENTE FINAL DEL PROFESIONAL, Y RECIBE LA MISMA FACTURA N VECES
//
// `psp.routes.ts:38`, rama `already_paid`: cuando llega un reintento de un cobro YA pagado, esa
// rama llama a `ensureInvoiceForCharge` y **reenvía** `sendInvoiceEmail`. Stripe reentrega hasta
// tres días, así que cada reintento era otro correo al cliente con la MISMA factura.
// (Medido en `docs/master/SCRUM-815.md`, paso ① §3 y apéndice 815b §4.)
//
// ── POR QUÉ LA MEMORIA DEL PROCESO NO LO TAPABA ──────────────────────────────────────────────
// `isDuplicateStripeEvent` es un `Set` del módulo con tope 500 — y esta ruta **no lo llama**. En
// tres días de reintentos el proceso se reinicia y cada entrega encuentra la memoria vacía. Por
// eso la marca de «ya se envió» vive en DISCO, en `events`, y NO en memoria.
//
// ── EL BANCO, Y QUÉ NO SE DOBLA ──────────────────────────────────────────────────────────────
// Se dobla la BASE (con `dobleDeLaBase`, el doble que ya existe), el ENVÍO de correo y la EMISIÓN
// de la factura. **La ruta entera es código de producción sin tocar**, conducida por su propio
// `handle` — que es justo lo que se mide. `event.findMany`/`event.create` van contra una lista que
// persiste entre entregas: se comporta como una base de verdad, que es lo que un `Set` no hace.
//
// ⛔ Ni una clave. Ni un byte de red. Ninguna base real: ni producción ni staging.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { dobleDeLaBase } from './_envio-doblado.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

/** Sustituye un módulo de `dist/` por un doble, antes de que nadie lo capture. */
function doblarModulo(ruta, exports) {
  const f = rutaDe(ruta);
  requiere.cache[f] = { id: f, filename: f, loaded: true, exports };
}

/**
 * Monta el banco y devuelve el registro de correos, las filas de `events` y una función que
 * entrega el webhook por el camino real.
 *
 * `estadoInicial` es el `status` del cobro: `pending` la primera vez, `paid` en los reintentos —
 * y el propio código lo cambia, igual que haría la base.
 */
function bancoDelCorreo({ chargeId = 900, customerId = 55, invoiceId = 7000 } = {}) {
  const correos = [];
  const filasEvento = [];
  const cobro = {
    id: chargeId, merchantId: 4242, customerId,
    status: 'pending', amount: '121.00', currency: 'EUR',
    method: 'card', intentId: 'pi_815_correo',
    customer: { id: customerId, name: 'Cliente de laboratorio', email: 'cliente@ejemplo.invalid' },
  };

  // ── la base ────────────────────────────────────────────────────────────────────────────────
  const doble = dobleDeLaBase({
    'charge.findUnique': () => ({ ...cobro }),
    'charge.update': (args) => { Object.assign(cobro, args?.data ?? {}); return { ...cobro }; },
    'customer.findUnique': () => ({ ...cobro.customer }),
    'invoice.update': () => ({ id: invoiceId }),
    'invoice.findUnique': () => ({ id: invoiceId, status: 'issued', number: 'F260001' }),
    'event.findMany': (args) => {
      const c = args?.where?.chargeId, t = args?.where?.type;
      return filasEvento.filter((f) => f.chargeId === c && (!t || f.type === t));
    },
    'event.create': (args) => { filasEvento.push(args.data); return args.data; },
  });
  const fPrisma = rutaDe('dist/core/db/prisma.js');
  requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble } };

  // ── el correo y la emisión ─────────────────────────────────────────────────────────────────
  doblarModulo('dist/lib/email.js', {
    sendInvoiceEmail: async (a) => { correos.push({ invoiceId: a.invoiceId, to: a.toEmail }); },
  });
  doblarModulo('dist/lib/invoicing.js', {
    ensureInvoiceForCharge: async () => ({ id: invoiceId, status: 'issued', pdfUrl: 'https://x.invalid/f.pdf' }),
    ensureChargeReceiptToken: async () => 'tok_815',
  });

  // los flags del defecto, ENCENDIDOS: es la única configuración en la que el defecto se ve
  process.env.AUTO_INVOICE_ON_PAID = 'true';
  process.env.AUTO_EMAIL_INVOICE_ON_PAID = 'true';

  // todo lo que capturó `prisma`, el correo, la emisión o la config, se relee
  for (const m of [
    'dist/core/config/env.js', 'dist/modules/billing/domain/correoDeFacturaEnviado.js',
    'dist/modules/system/customerEvents.service.js', 'dist/integrations/whatsappNotifications.js',
    'dist/integrations/whatsapp.js', 'dist/modules/jobs/domain/job.service.js',
    'dist/modules/messaging/domain/merchantNotifications.js',
    'dist/modules/billing/app/routes/psp.routes.js',
  ]) { try { delete requiere.cache[rutaDe(m)]; } catch { /* aún no existe: se creará */ } }

  const mod = requiere(path.join(RAIZ, 'dist/modules/billing/app/routes/psp.routes.js'));
  const router = mod.default || mod;
  const capa = router.stack?.find((c) => c.route?.methods?.post);
  assert.ok(capa, '🔴 CIEGO: no se encuentra el POST de `psp.routes`. Si se ha movido, hay que '
    + 'reapuntar este banco, no borrarlo.');
  const handle = capa.route.stack[0].handle;

  const entregar = async () => {
    const req = { body: { event: 'payment.confirmed', charge_id: chargeId } };
    let cuerpo = null;
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(x) { cuerpo = x; return this; },
    };
    await handle(req, res, (e) => { if (e) throw e; });
    return { cuerpo, statusCode: res.statusCode };
  };

  return { correos, filasEvento, entregar, cobro };
}

// ═══ ① SUELO — sin esto, «un solo correo» podría ser «ninguno» ════════════════════════════════

test('SCRUM-815 · 🔴 SUELO: UNA entrega manda UN correo, o el detector se declara CIEGO', async () => {
  const b = bancoDelCorreo();
  await b.entregar();
  assert.notEqual(b.correos.length, 0,
    '🔴 CIEGO: el banco no ha visto NI UN envío de correo. Un «no hay duplicados» medido sobre '
    + 'cero envíos no dice nada: vacío y no-medido se leen igual y significan lo contrario.');
  assert.equal(b.correos.length, 1, `la primera entrega debería mandar UNO, mandó ${b.correos.length}`);
});

// ═══ ② EL DEFECTO — tres entregas del MISMO cobro ════════════════════════════════════════════

test('SCRUM-815 · 🔴 tres entregas del MISMO cobro → UN correo, no tres', async () => {
  const b = bancoDelCorreo();
  await b.entregar();   // la primera: el cobro pasa a `paid` y sale el correo
  await b.entregar();   // reintento de Stripe → rama `already_paid`
  await b.entregar();   // otro reintento

  assert.equal(b.correos.length, 1,
    `🔴 EL CLIENTE HA RECIBIDO ${b.correos.length} CORREOS CON LA MISMA FACTURA.\n`
    + '  Stripe reentrega hasta tres días: la rama `already_paid` reenvía en cada entrega.\n'
    + `  Facturas enviadas: ${JSON.stringify(b.correos.map((c) => c.invoiceId))}`);
});

test('SCRUM-815 · la fila `duplicate:true` SE QUEDA: es ruido acotado y útil', async () => {
  const b = bancoDelCorreo();
  await b.entregar();
  await b.entregar();
  const dup = b.filasEvento.filter((f) => f.type === 'paid' && f.payload?.duplicate === true);
  assert.equal(dup.length, 1,
    'la rama `already_paid` tiene que seguir dejando su fila `duplicate:true` — quitarla sería '
    + 'perder la constancia de que hubo un reintento, que es otra cosa y no se pide aquí.');
});

// ═══ ③ CONTROL POSITIVO — comerse un correo legítimo es romper el producto por el lado bueno ══

test('SCRUM-815 · ✅ POSITIVO: dos facturas DISTINTAS siguen mandando DOS correos', async () => {
  const a = bancoDelCorreo({ chargeId: 901, invoiceId: 7001 });
  await a.entregar();
  const c = bancoDelCorreo({ chargeId: 902, invoiceId: 7002 });
  await c.entregar();

  const enviadas = [...a.correos, ...c.correos].map((x) => x.invoiceId);
  assert.deepEqual(enviadas.sort(), [7001, 7002],
    `dos cobros distintos con facturas distintas tienen que mandar DOS correos: ${JSON.stringify(enviadas)}`);
});

// ═══ ④ QUE LA MARCA ESTÁ EN DISCO, no en memoria ═════════════════════════════════════════════

test('SCRUM-815 · 🔴 EN DISCO: si se borra la marca de la base, el correo VUELVE a salir', async () => {
  const b = bancoDelCorreo();
  await b.entregar();
  await b.entregar();
  assert.equal(b.correos.length, 1, 'precondición: el segundo no sale');

  // se borra de la BASE la constancia del envío — nada más
  const antes = b.filasEvento.length;
  for (let i = b.filasEvento.length - 1; i >= 0; i--) {
    if (b.filasEvento[i].type === 'emailed') b.filasEvento.splice(i, 1);
  }
  assert.notEqual(b.filasEvento.length, antes,
    '🔴 CIEGO: no había ninguna fila `emailed` que borrar, así que este caso no prueba que la '
    + 'marca esté en disco. Si el arreglo dejara de escribirla, esto tiene que caer.');

  await b.entregar();
  assert.equal(b.correos.length, 2,
    'con la marca borrada de la base el correo tiene que volver a salir: eso es lo que separa una '
    + 'marca EN DISCO de una memoria del proceso, que sobreviviría al borrado.');
});
