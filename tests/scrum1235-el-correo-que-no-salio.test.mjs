// tests/scrum1235-el-correo-que-no-salio.test.mjs — SCRUM-1235
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CLIENTE PAGA, EL COBRO QUEDA `paid`, Y SI EL CORREO DE LA FACTURA FALLA NADIE SE ENTERA
//
// El envío automático tras el cobro (`psp.routes.ts`, `mpWebhook.routes.ts`) se traga el fallo
// del correo con un `console.error`, y el webhook contesta 200. `enviarPorResend` SÍ deja una fila
// `fallo_envio` en `email_messages`… y hasta este ticket no la leía nadie.
//
// Criterio (SCRUM-1235, comentario 17381, GO de Javier): el fallo tiene que VERSE donde el
// profesional mira sus cobros, y llevarle al botón que ya existe. ⛔ La respuesta al proveedor NO
// cambia: el webhook pregunta «¿has registrado el cobro?», no «¿has mandado el correo?».
//
// ── EL BANCO, Y QUÉ NO SE DOBLA ──────────────────────────────────────────────────────────────
// Se dobla la BASE (con estado: lo que se escribe en `emailMessage` se lee de vuelta), la
// EMISIÓN (`dist/lib/invoicing.js`: la factura y su PDF, que aquí no se mide) y la RED
// (`axios.post`: nada sale de la máquina). **No se dobla**: el webhook, `sendInvoiceEmail`,
// `enviarPorResend`, `registrarEnvio` ni `listarCobrosConCorreo`. Son el camino real, y es lo que se mide.
//
// ⛔ Ni una clave real. Ni un byte de red. Ninguna base: ni producción ni staging.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { dobleDeLaBase } from './_envio-doblado.mjs';

// ANTES de cargar `dist/`: `config` se congela al importarse. Una clave inventada para que el
// correo vaya por `axios.post`, que es donde se le hace fallar (mismo patrón que scrum1116).
process.env.RESEND_API_KEY = 're_test_1235_no_sale';
process.env.AUTO_INVOICE_ON_PAID = 'true';
process.env.AUTO_EMAIL_INVOICE_ON_PAID = 'true';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));
const axios = requiere('axios'); // la instancia CJS: la MISMA que carga dist

const MERCHANT = 4242;

// Un PDF de verdad en disco: `sendInvoiceEmail` lo lee para adjuntarlo y, si no está, lanza ANTES
// de llegar a Resend (`invoice_pdf_unavailable`) — que es otro fallo, sin fila, y no el que se mide.
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1235-'));
const PDF = path.join(DIR, 'f.pdf');
fs.writeFileSync(PDF, '%PDF-1.4\n%laboratorio 1235\n');

/**
 * Monta el banco y devuelve: las filas de `email_messages` que escribió el camino real, una
 * función que entrega el webhook y otra que lee la pantalla de cobros por `listarCobrosConCorreo` (lo que sirve `GET /admin/cobros`).
 *
 * `resend` decide qué contesta el proveedor: `'falla'` o `'acepta'`.
 */
function banco({ chargeId = 900, invoiceId = 7000, numero = 'F260001', resend = 'falla' } = {}) {
  const filasCorreo = [];
  const filasEvento = [];
  const cobro = {
    id: chargeId, merchantId: MERCHANT, customerId: 55,
    status: 'pending', amount: '121.00', currency: 'EUR', method: 'card',
    concept: 'Reparación', reference: null, createdAt: new Date('2026-09-28T10:00:00Z'),
    intentId: 'pi_1235',
    customer: { id: 55, name: 'Cliente de laboratorio', email: 'cliente@ejemplo.invalid' },
  };
  const factura = { id: invoiceId, merchantId: MERCHANT, customerId: 55, chargeId, number: numero, status: 'issued', pdfUrl: '/x.pdf' };

  const doble = dobleDeLaBase({
    'charge.findUnique': () => ({ ...cobro }),
    'charge.update': (a) => { Object.assign(cobro, a?.data ?? {}); return { ...cobro }; },
    'charge.findMany': () => [{ ...cobro }],
    'customer.findUnique': () => ({ ...cobro.customer }),
    'invoice.findUnique': () => ({ ...factura }),
    'invoice.update': () => ({ ...factura }),
    // Las facturas SUELTAS (`chargeId: null`): ninguna. La del cobro se liga por el evento `invoiced`.
    'invoice.findMany': () => [],
    'event.findMany': (a) => filasEvento.filter((f) =>
      (a?.where?.chargeId == null || f.chargeId === a.where.chargeId)
      && (!a?.where?.type || f.type === a.where.type)),
    'event.create': (a) => { filasEvento.push(a.data); return a.data; },
    // 🔴 CON ESTADO: lo que escribe `registrarEnvio` es lo que luego lee la pantalla.
    'emailMessage.create': (a) => {
      const fila = { id: filasCorreo.length + 1, createdAt: new Date(Date.now() + filasCorreo.length), ...a.data };
      filasCorreo.push(fila);
      return fila;
    },
    'emailMessage.findMany': (a) => {
      const w = a?.where ?? {};
      return filasCorreo.filter((f) =>
        (w.merchantId == null || f.merchantId === w.merchantId)
        && (w.relatedType == null || f.relatedType === w.relatedType)
        && (!w.relatedId?.in || w.relatedId.in.includes(f.relatedId))
        && (!w.kind?.in || w.kind.in.includes(f.kind)));
    },
  });
  const fPrisma = rutaDe('dist/core/db/prisma.js');
  requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble } };

  // La emisión: la factura ya existe y su PDF está en disco. El vínculo cobro→factura se escribe
  // igual que lo escribe `ensureInvoiceForCharge` (`lib/invoicing.ts:301`).
  const fInv = rutaDe('dist/lib/invoicing.js');
  requiere.cache[fInv] = {
    id: fInv, filename: fInv, loaded: true,
    exports: {
      ensureInvoiceForCharge: async (id) => {
        filasEvento.push({ chargeId: id, type: 'invoiced', payload: { invoice_id: factura.id } });
        return { ...factura };
      },
      ensureInvoicePdf: async () => ({ diskPath: PDF, pdfUrl: '/x.pdf' }),
      ensureChargeReceiptToken: async () => 'tok_1235',
    },
  };

  const estado = { resend };
  axios.post = async (url) => {
    if (!String(url).includes('api.resend.com')) throw new Error(`🔴 el banco no esperaba un POST a ${url}`);
    if (estado.resend === 'falla') {
      const e = new Error('Request failed with status code 503'); e.code = 'ERR_BAD_RESPONSE';
      throw e;
    }
    return { data: { id: `re_${filasCorreo.length + 1}` } };
  };

  for (const m of [
    'dist/core/config/env.js',
    'dist/modules/messaging/domain/registroDeEnvios.js',
    'dist/integrations/enviarCorreo.js',
    'dist/modules/messaging/domain/email.service.js',
    'dist/lib/email.js',
    'dist/modules/billing/domain/correoDeFacturaEnviado.js',
    'dist/modules/billing/domain/cobros.service.js',
    'dist/modules/system/customerEvents.service.js', 'dist/integrations/whatsappNotifications.js',
    'dist/integrations/whatsapp.js', 'dist/modules/jobs/domain/job.service.js',
    'dist/modules/messaging/domain/merchantNotifications.js',
    'dist/modules/billing/app/routes/psp.routes.js',
  ]) { try { delete requiere.cache[rutaDe(m)]; } catch { /* aún no existe */ } }

  const mod = requiere(rutaDe('dist/modules/billing/app/routes/psp.routes.js'));
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

  const pantalla = async () => {
    const { listarCobrosConCorreo } = requiere(rutaDe('dist/modules/billing/domain/cobros.service.js'));
    const filas = await listarCobrosConCorreo(MERCHANT);
    return filas.find((f) => f.chargeId === chargeId);
  };

  // «Enviar de nuevo» llama a `sendInvoiceEmail` (vía `POST /admin/invoices/:id/send-email`): se
  // llama al REAL, con la misma base doblada.
  const reenviar = async () => {
    const { sendInvoiceEmail } = requiere(rutaDe('dist/lib/email.js'));
    await sendInvoiceEmail({ invoiceId, toEmail: cobro.customer.email, toName: cobro.customer.name, prisma: doble }).catch(() => {});
  };
  return { filasCorreo, entregar, pantalla, reenviar, cobro, estado };
}

// ═══ ① SUELO — el fallo tiene que haber ocurrido de verdad, o esto no mide nada ═════════════════

test('SCRUM-1235 · SUELO: el correo falla por el camino real y DEJA su fila `fallo_envio`', async () => {
  const b = banco();
  await b.entregar();
  assert.equal(b.cobro.status, 'paid', '🔴 CIEGO: el cobro no llegó a `paid`; el banco no ejercita el caso');
  assert.equal(b.filasCorreo.length, 1,
    `🔴 CIEGO: el camino real tenía que dejar UNA fila en email_messages y dejó ${b.filasCorreo.length}. `
    + 'Sin fila, «la pantalla no lo ve» no distingue «no lo lee» de «no había nada que leer».');
  assert.equal(b.filasCorreo[0].status, 'fallo_envio');
  assert.equal(b.filasCorreo[0].relatedType, 'invoice');
  assert.equal(b.filasCorreo[0].relatedId, 7000);
});

// ═══ ② LA RESPUESTA AL PROVEEDOR NO CAMBIA (criterio ② del comentario 17381) ═════════════════

test('SCRUM-1235 · ⛔ el webhook sigue contestando 200 `paid` aunque el correo falle', async () => {
  const b = banco();
  const r = await b.entregar();
  assert.equal(r.statusCode, 200,
    '⛔ contestar otra cosa haría que el proveedor reintentara EL COBRO ENTERO, no el correo');
  assert.equal(r.cuerpo?.status, 'paid');
});

// ═══ ③ EL DEFECTO — el profesional lo ve donde mira sus cobros ═════════════════════════════════

test('SCRUM-1235 · 🔴 el cobro cobrado cuyo correo no salió LO DICE en la pantalla de cobros', async () => {
  const b = banco();
  await b.entregar();
  const fila = await b.pantalla();
  assert.ok(fila, '🔴 CIEGO: `listarCobrosConCorreo` no devuelve el cobro del banco');
  assert.deepEqual(fila.correoNoSalio, { invoiceId: 7000, clase: 'invoice' },
    '🔴 EL CLIENTE HA PAGADO, SU FACTURA NO HA SALIDO Y EL PROFESIONAL NO SE ENTERA.\n'
    + '  La fila `fallo_envio` está en email_messages y la pantalla de cobros no la lee.\n'
    + `  Recibido: ${JSON.stringify(fila.correoNoSalio)}`);
});

test('SCRUM-1235 · un justificante (J-…) se dice como justificante, nunca como factura (reglas 24/26)', async () => {
  const b = banco({ chargeId: 910, invoiceId: 7010, numero: 'J-2026-0001' });
  await b.entregar();
  const fila = await b.pantalla();
  assert.deepEqual(fila.correoNoSalio, { invoiceId: 7010, clase: 'justificante' });
});

// ═══ ④ CONTROLES POSITIVOS — callarse cuando no hay nada que decir ════════════════════════════

test('SCRUM-1235 · ✅ si el correo SALIÓ, la pantalla no dice nada', async () => {
  const b = banco({ resend: 'acepta' });
  await b.entregar();
  assert.equal(b.filasCorreo.length, 1, '🔴 CIEGO: el envío aceptado tenía que dejar su fila');
  assert.notEqual(b.filasCorreo[0].status, 'fallo_envio');
  const fila = await b.pantalla();
  assert.equal(fila.correoNoSalio, null);
});

test('SCRUM-1235 · ✅ manda el ÚLTIMO intento: falló, se reenvió y salió → ya no se avisa', async () => {
  const b = banco();
  await b.entregar();                       // el automático falla
  assert.ok((await b.pantalla()).correoNoSalio, 'precondición: tras el fallo, avisa');

  b.estado.resend = 'acepta';
  await b.reenviar();                       // el profesional pulsa «Enviar de nuevo» y sale
  assert.equal(b.filasCorreo.length, 2, '🔴 CIEGO: el reenvío tenía que dejar su propia fila');
  assert.equal((await b.pantalla()).correoNoSalio, null, 'el reenvío que salió tiene que apagar el aviso');

  b.estado.resend = 'falla';
  await b.reenviar();                       // y si el siguiente vuelve a fallar, vuelve a avisar
  assert.deepEqual((await b.pantalla()).correoNoSalio, { invoiceId: 7000, clase: 'invoice' });
});

test('SCRUM-1235 · ✅ sin ninguna fila de correo, no consta ningún fallo: se calla', async () => {
  const b = banco();
  const fila = await b.pantalla();          // sin entregar el webhook: no hubo ningún envío
  assert.ok(fila, '🔴 CIEGO: el cobro no sale en la lista');
  assert.equal(b.filasCorreo.length, 0);
  assert.equal(fila.correoNoSalio, null);
});

// ═══ ⑤ LA PANTALLA — el aviso firmado, y el botón que ya existía ════════════════════════════
//
// Se pinta la vista REAL con el banco de vistas. La red devuelve la fila tal como la serializa
// `listarCobrosConCorreo` (con `correoNoSalio`), y el botón llama al endpoint que ya existía.
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { redNormal } from './_banco-red.mjs';

const COBRO_SIN_CORREO = {
  origen: 'charge', id: 900, fecha: '2026-09-28T10:00:00.000Z', cliente: 'Cliente de laboratorio',
  concepto: 'Reparación', importe: '121.00', moneda: 'EUR', metodo: 'card', metodoCubo: 'card',
  estado: 'paid', referencia: null, numero: null, tipo: null, invoiceId: null, chargeId: 900,
  correoNoSalio: { invoiceId: 7000, clase: 'invoice' },
};

async function abrirCobros(cobros, alEnviar) {
  const envios = [];
  const red = redNormal((url, opts) => {
    if (url.includes('/send-email')) { envios.push(url); return alEnviar(); }
    return cobros;
  });
  const banco = cargarDashboard(RAIZ, { red });
  const r = await pintarVista(banco, 'renderCobrosView');
  assert.equal(r.error, null, `🔴 la pantalla revienta: ${r.error && r.error.message}`);
  const texto = () => todos(r.contenedor).map((n) => n.textContent).filter(Boolean).join(' | ');
  const boton = () => todos(r.contenedor).find((n) => n.tagName === 'BUTTON' && n.textContent === 'Enviar de nuevo');
  return { r, texto, boton, envios };
}
const esperar = () => new Promise((ok) => setTimeout(ok, 20));

test('SCRUM-1235 · 🔴 la fila del cobro DICE que la factura no salió, con el texto firmado', async () => {
  const p = await abrirCobros([COBRO_SIN_CORREO], () => ({ ok: true, sent: true }));
  assert.match(p.texto(), /Cliente de laboratorio/, '🔴 CIEGO: el cobro ni siquiera se ha pintado');
  assert.match(p.texto(), /No se pudo enviar la factura al cliente por email\./);
  assert.ok(p.boton(), '🔴 falta la acción: el aviso sin botón deja al profesional sin salida');
});

test('SCRUM-1235 · «Enviar de nuevo» llama al endpoint que ya existía y, si sale, lo dice', async () => {
  const p = await abrirCobros([COBRO_SIN_CORREO], () => ({ ok: true, sent: true }));
  p.boton().dispararClick();
  await esperar();
  assert.deepEqual(p.envios.map((u) => u.replace(/^.*(\/admin\/)/, '$1')), ['/admin/invoices/7000/send-email']);
  assert.match(p.texto(), /✓ Enviado por email/);
  assert.doesNotMatch(p.texto(), /No se pudo enviar la factura/, 'si ya salió, el aviso no puede seguir diciendo que no');
});

test('SCRUM-1235 · 🔴 si el reintento TAMPOCO sale (200 + sent:false), no se dice «enviado»', async () => {
  const p = await abrirCobros([COBRO_SIN_CORREO],
    () => ({ ok: true, sent: false, error: 'email_send_failed', message: 'No se pudo enviar el email. Puedes reintentarlo.' }));
  p.boton().dispararClick();
  await esperar();
  assert.doesNotMatch(p.texto(), /Enviado por email/,
    '🔴 el endpoint contesta 200 cuando el correo falla: leer sólo el código daría «enviado» en falso');
  assert.match(p.texto(), /No se pudo enviar el email\. Puedes reintentarlo\./, 'se pinta el mensaje del servidor');
  assert.ok(p.boton() && !p.boton().disabled, 'el botón vuelve a estar a mano');
});

test('SCRUM-1235 · un justificante se avisa como justificante', async () => {
  const p = await abrirCobros([{ ...COBRO_SIN_CORREO, correoNoSalio: { invoiceId: 7010, clase: 'justificante' } }], () => ({}));
  assert.match(p.texto(), /No se pudo enviar el justificante al cliente por email\./);
  assert.doesNotMatch(p.texto(), /la factura/, '🔴 reglas 24/26: un justificante no se llama factura');
});

test('SCRUM-1235 · ✅ sin fallo, la fila no dice nada', async () => {
  const p = await abrirCobros([{ ...COBRO_SIN_CORREO, correoNoSalio: null }], () => ({}));
  assert.match(p.texto(), /Cliente de laboratorio/, '🔴 CIEGO: el cobro ni siquiera se ha pintado');
  assert.doesNotMatch(p.texto(), /No se pudo enviar/);
  assert.equal(p.boton(), undefined);
});
