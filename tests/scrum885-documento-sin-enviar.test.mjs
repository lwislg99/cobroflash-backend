// tests/scrum885-documento-sin-enviar.test.mjs — SCRUM-885 (P-CONT-1)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL COBRO A UN CLIENTE SIN EMAIL: EL DOCUMENTO NO SALE, Y NADIE SE ENTERABA
//
// Medido corriendo el 16-sep-2026 (docs/master/SCRUM-885.md, PASO 0): con el envío automático
// encendido, `psp.routes.ts` manda la factura SOLO si el cliente tiene email. Sin email la
// condición no entra y no queda nada: ni intento, ni fila, ni log, ni aviso. El profesional veía
// «✓ Bizum confirmado: factura cobrada.» y el cliente se quedaba sin su documento.
//
// DECIDIDO (orquestador, 16-sep): se avisa SOLO si el documento no ha salido NI por email NI por
// WhatsApp. El WhatsApp vale como enviado si su fila dice enviado o más (`SENT_OR_MORE`). Si falla
// —ahora o después, por el webhook de estado— o no se intentó, NO cuenta. Con el envío automático
// APAGADO no se avisa: ese es otro problema, no éste.
//
// DOS SITIOS: la respuesta de «Confirmar Bizum» (el toast) y la fila de la factura del trabajo.
// En los dos, el aviso lo decide la MISMA regla del dashboard (`avisoDocumentoSinEnviar.js`),
// importada aquí tal cual: una sola copia de la regla.
//
// ── EL BANCO ─────────────────────────────────────────────────────────────────────────────────
// Se doblan la BASE, la EMISIÓN, el CORREO y el WHATSAPP. Las RUTAS son código de producción sin
// tocar: `confirm-bizum` llama por «red» a `psp`, y aquí esa red es el handler real de `psp`.
// ⛔ Ni una clave. Ni un byte de red. Ninguna base real.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { dobleDeLaBase } from './_envio-doblado.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

const TEXTO_FIRMADO =
  'El documento no se ha enviado: el cliente no tiene email. Añade su email en su ficha y envíaselo.';
const REGLA = path.join(RAIZ, 'public/dashboard/js/avisoDocumentoSinEnviar.js');

/**
 * El aviso VISIBLE, juzgado con la regla del dashboard. Si la regla no existe, lo que ve el
 * profesional es exactamente eso: ningún aviso. Es el estado de hoy, y por eso cae en ROJO por
 * aserción, no por un `require` roto.
 */
function avisoVisible(envioDocumento) {
  if (!fs.existsSync(REGLA)) return { mostrar: false, texto: null };
  delete requiere.cache[REGLA];
  return requiere(REGLA).avisoDocumentoSinEnviar(envioDocumento);
}

function doblarModulo(ruta, exports) {
  const f = rutaDe(ruta);
  requiere.cache[f] = { id: f, filename: f, loaded: true, exports };
}

/**
 * Un profesional, un trabajo, un presupuesto con su cobro Bizum pendiente y el cliente del caso.
 *   email      → el cliente tiene email
 *   telefono   → el cliente tiene número (psp intenta el WhatsApp)
 *   wa         → cómo queda la fila del WhatsApp si se intenta: 'sent' | 'failed' | 'queued'
 *   autoEmail  → AUTO_EMAIL_INVOICE_ON_PAID
 */
function banco({ email = null, telefono = null, wa = 'sent', autoEmail = true } = {}) {
  const chargeId = 885, invoiceId = 8850, jobId = 88, quoteId = 880, merchantId = 4885, customerId = 55;
  const emisiones = [];
  const correos = [];
  const filasWa = [];
  const customer = { id: customerId, name: 'Cliente del banco', email, phone: telefono };
  const merchant = { id: merchantId, name: 'Banco 885', country: 'ES', flags: { BIZUM_MANUAL_ENABLED: true } };
  const cobro = {
    id: chargeId, merchantId, customerId, status: 'pending', amount: '121.00', currency: 'EUR',
    method: 'bizum_manual', concept: 'Cobro 885', customer, merchant,
  };
  const factura = {
    id: invoiceId, number: 'F260885', total: '121.00', currency: 'EUR', createdAt: new Date('2026-09-16T10:00:00Z'),
    pdfUrl: '/admin/invoices/8850/pdf', type: 'F1', status: 'paid', paidAt: new Date(), chargeId,
    stageLabel: null, rectifiesId: null,
  };
  const presupuesto = {
    id: quoteId, merchantId, customerId, jobId, chargeId, status: 'accepted', total: '121.00', currency: 'EUR',
    lines: [{ concept: 'Reparación', qty: 1, price: 100, tax: 0.21 }], createdAt: new Date('2026-09-15T10:00:00Z'),
    discountGlobalAmount: null, // SCRUM-887: la fila real lo trae siempre
  };
  const trabajo = { id: jobId, merchantId, customerId, quoteId, status: 'en_curso', titulo: 'Trabajo 885', createdAt: new Date() };

  const filtraWa = (args) => {
    const w = args?.where ?? {};
    const ids = w.relatedId?.in ?? (w.relatedId != null ? [w.relatedId] : null);
    return filasWa.filter((f) => (!w.relatedType || f.relatedType === w.relatedType) && (!ids || ids.includes(f.relatedId)));
  };

  const doble = dobleDeLaBase({
    'charge.findFirst': () => ({ ...cobro }),
    'charge.findUnique': () => ({ ...cobro }),
    'charge.findMany': (args) => (!args?.where?.status || args.where.status === cobro.status ? [{ id: chargeId, status: cobro.status }] : []),
    'charge.update': (args) => { Object.assign(cobro, args?.data ?? {}, { events: undefined, reconciliations: undefined }); return { ...cobro }; },
    'customer.findUnique': () => ({ ...customer }),
    'merchant.findUnique': () => ({ ...merchant }),
    'invoice.findFirst': () => ({ id: invoiceId, number: factura.number, status: factura.status }),
    'invoice.findUnique': () => ({ id: invoiceId, number: factura.number, status: factura.status }),
    'invoice.update': () => ({ id: invoiceId }),
    'job.findFirst': () => ({ ...trabajo }),
    'quote.findUnique': () => ({ ...presupuesto }),
    'quote.findFirst': () => ({ id: quoteId }),
    'quote.findMany': (args) => (args?.select?.Invoice
      ? [{ id: quoteId, charge: { id: chargeId, status: cobro.status, method: cobro.method, amount: cobro.amount, currency: 'EUR' }, Invoice: [{ ...factura }] }]
      : [{ ...presupuesto }]),
    'whatsAppMessage.findMany': (args) => filtraWa(args),
    'whatsAppMessage.findFirst': (args) => filtraWa(args)[0] ?? null,
  });
  const fPrisma = rutaDe('dist/core/db/prisma.js');
  requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble } };

  doblarModulo('dist/lib/email.js', {
    sendInvoiceEmail: async (a) => { correos.push({ invoiceId: a.invoiceId, to: a.toEmail }); },
  });
  doblarModulo('dist/lib/invoicing.js', {
    ensureInvoiceForCharge: async (id) => { emisiones.push(id); return { id: invoiceId, status: 'issued', pdfUrl: factura.pdfUrl }; },
    ensureChargeReceiptToken: async () => 'tok_885',
  });
  doblarModulo('dist/integrations/whatsappNotifications.js', {
    // La fila se escribe AL LLAMAR, como la escribiría el envío real al volver de Meta.
    sendPaymentConfirmationInvoice: async (p) => {
      filasWa.push({ relatedType: 'charge', relatedId: p.chargeId, status: wa, createdAt: new Date() });
      return { ok: wa === 'sent' };
    },
    notifyMerchantPaid: async () => ({ ok: true }),
  });

  // «La red» entre confirm-bizum y psp: el handler REAL de psp.
  // Se sustituye SOLO `post` del axios real (el resto de módulos usan `axios.create` y no se tocan);
  // cualquier `post` que no sea a `/webhooks/psp` revienta: sería un envío que este banco no espera.
  let psp = null;
  const axios = requiere(requiere.resolve('axios', { paths: [RAIZ] }));
  (axios.default ?? axios).post = async (url, cuerpo) => {
    if (!String(url).endsWith('/webhooks/psp')) throw new Error(`🔴 post inesperado a ${url}`);
    const r = await entregarA(psp, { body: cuerpo });
    return { status: r.statusCode, data: r.cuerpo };
  };

  process.env.AUTO_INVOICE_ON_PAID = 'true';
  process.env.AUTO_EMAIL_INVOICE_ON_PAID = autoEmail ? 'true' : 'false';

  for (const m of [
    'dist/core/config/env.js', 'dist/core/flags.js',
    'dist/modules/billing/domain/correoDeFacturaEnviado.js',
    'dist/modules/billing/domain/envioDelDocumento.js',
    'dist/modules/messaging/domain/whatsappLog.service.js',
    'dist/modules/system/customerEvents.service.js', 'dist/integrations/whatsapp.js',
    'dist/modules/jobs/domain/job.service.js', 'dist/modules/messaging/domain/merchantNotifications.js',
    'dist/modules/billing/app/routes/psp.routes.js',
    'dist/modules/billing/app/routes/chargesAdmin.routes.js',
    'dist/modules/jobs/app/routes/jobs.routes.js',
  ]) { try { delete requiere.cache[rutaDe(m)]; } catch { /* aún no existe */ } }

  psp = handleDe('dist/modules/billing/app/routes/psp.routes.js', 'post', '/');
  const confirmar = handleDe('dist/modules/billing/app/routes/chargesAdmin.routes.js', 'post', '/:id/confirm-bizum');
  const detalle = handleDe('dist/modules/jobs/app/routes/jobs.routes.js', 'get', '/:id');

  return {
    emisiones, correos, filasWa,
    confirmarBizum: () => entregarA(confirmar, { params: { id: String(chargeId) }, body: {}, merchantId }),
    detalleDelTrabajo: () => entregarA(detalle, { params: { id: String(jobId) }, merchantId, userRole: 'admin' }),
    chargeId,
  };
}

function handleDe(ruta, metodo, camino) {
  const mod = requiere(path.join(RAIZ, ruta));
  const router = mod.default || mod;
  const capa = router.stack?.find((c) => c.route?.path === camino && c.route?.methods?.[metodo]);
  assert.ok(capa, `🔴 CIEGO: no encuentro ${metodo.toUpperCase()} ${camino} en ${ruta}. Si se ha movido, `
    + 'hay que reapuntar este banco, no borrarlo.');
  const pila = capa.route.stack;
  return pila[pila.length - 1].handle;
}

async function entregarA(handle, req) {
  let cuerpo = null;
  const res = {
    statusCode: 200,
    status(c) { this.statusCode = c; return this; },
    json(x) { cuerpo = x; return this; },
    setHeader() {}, set() { return this; },
  };
  await handle({ headers: {}, query: {}, ...req }, res, (e) => { if (e) throw e; });
  return { cuerpo, statusCode: res.statusCode };
}

/** Cobra por el camino del profesional y devuelve lo que ve en los DOS sitios. */
async function cobrarYMirar(opciones) {
  const b = banco(opciones);
  const r = await b.confirmarBizum();
  assert.equal(r.statusCode, 200, `confirm-bizum respondió ${r.statusCode}: ${JSON.stringify(r.cuerpo)}`);
  // 🔴 SUELO: sin documento emitido no hay nada que medir. «No hay aviso» sobre un cobro que no
  // llegó a emitir diría lo mismo que «no avisa», y significa lo contrario: no pude mirar.
  assert.ok(b.emisiones.includes(b.chargeId),
    '🔴 NO PUDE MIRAR: el cobro no llegó a emitir el documento, así que no hay envío que juzgar.');
  const d = await b.detalleDelTrabajo();
  assert.equal(d.statusCode, 200, `el detalle del trabajo respondió ${d.statusCode}: ${JSON.stringify(d.cuerpo)}`);
  const fila = (d.cuerpo?.invoices ?? []).find((i) => i.chargeId === b.chargeId);
  assert.ok(fila, '🔴 CIEGO: la factura del cobro no sale en el detalle del trabajo.');
  return {
    b,
    enToast: avisoVisible(r.cuerpo?.envioDocumento),
    enFila: avisoVisible(fila.envioDocumento),
  };
}

// ═══ ① EL ROJO — flag encendido, sin email y sin WhatsApp ═════════════════════════════════════

test('SCRUM-885 · 🔴 sin email y sin WhatsApp → AVISO en el toast y en la fila de la factura, con el texto firmado', async () => {
  const { b, enToast, enFila } = await cobrarYMirar({ email: null, telefono: null });
  assert.equal(b.correos.length, 0, 'sin email no puede salir ningún correo');
  assert.equal(b.filasWa.length, 0, 'sin teléfono no se intenta el WhatsApp');
  assert.deepEqual(enToast, { mostrar: true, texto: TEXTO_FIRMADO },
    '🔴 EL PROFESIONAL NO SE ENTERA: la respuesta de «Confirmar Bizum» no deja aviso visible.');
  assert.deepEqual(enFila, { mostrar: true, texto: TEXTO_FIRMADO },
    '🔴 EL PROFESIONAL NO SE ENTERA: la fila de la factura en el trabajo no deja aviso visible.');
});

// ═══ ② POSITIVOS ══════════════════════════════════════════════════════════════════════════════

test('SCRUM-885 · con email → SIN aviso, y el correo sale igual que hoy (uno, al email del cliente)', async () => {
  const { b, enToast, enFila } = await cobrarYMirar({ email: 'cliente@ejemplo.invalid', telefono: null });
  assert.deepEqual(b.correos, [{ invoiceId: 8850, to: 'cliente@ejemplo.invalid' }]);
  assert.equal(enToast.mostrar, false);
  assert.equal(enFila.mostrar, false);
});

test('SCRUM-885 · sin email pero WhatsApp ENVIADO → SIN aviso', async () => {
  const { b, enToast, enFila } = await cobrarYMirar({ email: null, telefono: '+34600000885', wa: 'sent' });
  assert.equal(b.filasWa.length, 1, 'control: el WhatsApp tiene que haberse intentado');
  assert.equal(enToast.mostrar, false);
  assert.equal(enFila.mostrar, false);
});

// ═══ ③ NEGATIVOS ══════════════════════════════════════════════════════════════════════════════

test('SCRUM-885 · sin email y WhatsApp FALLIDO → CON aviso', async () => {
  const { b, enToast, enFila } = await cobrarYMirar({ email: null, telefono: '+34600000885', wa: 'failed' });
  assert.equal(b.filasWa.length, 1, 'control: el WhatsApp tiene que haberse intentado');
  assert.equal(enToast.mostrar, true);
  assert.equal(enFila.mostrar, true);
});

test('SCRUM-885 · un WhatsApp que falla DESPUÉS (webhook de estado) hace aparecer el aviso en la fila', async () => {
  const b = banco({ email: null, telefono: '+34600000885', wa: 'sent' });
  await b.confirmarBizum();
  assert.ok(b.emisiones.includes(b.chargeId), '🔴 NO PUDE MIRAR: no se emitió el documento.');
  const antes = (await b.detalleDelTrabajo()).cuerpo.invoices.find((i) => i.chargeId === b.chargeId);
  assert.equal(avisoVisible(antes.envioDocumento).mostrar, false, 'con el WhatsApp enviado no hay aviso');
  b.filasWa[0].status = 'failed'; // lo que escribe el webhook de estado de Meta
  const despues = (await b.detalleDelTrabajo()).cuerpo.invoices.find((i) => i.chargeId === b.chargeId);
  assert.equal(avisoVisible(despues.envioDocumento).mostrar, true, 'el fallo posterior tiene que verse');
});

// ═══ ④ EN COLA (corrección del orquestador, 16-sep) ═════════════════════════════════════════
// Un WhatsApp en cola TODAVÍA NO HA FALLADO: avisar ahí sería casi siempre una falsa alarma. Pero
// uno atascado no puede quedarse callado para siempre: pasados 10 minutos en cola, cuenta como no
// enviado.

test('SCRUM-885 · sin email y WhatsApp EN COLA recién puesto → SIN aviso (todavía no se sabe)', async () => {
  const { b, enToast, enFila } = await cobrarYMirar({ email: null, telefono: '+34600000885', wa: 'queued' });
  assert.equal(b.filasWa.length, 1, 'control: el WhatsApp tiene que haberse intentado');
  assert.equal(b.filasWa[0].status, 'queued', 'control: la fila tiene que seguir en cola');
  assert.equal(enToast.mostrar, false, '🔴 FALSA ALARMA: un WhatsApp en cola aún no ha fallado y el toast ya avisa.');
  assert.equal(enFila.mostrar, false, '🔴 FALSA ALARMA: un WhatsApp en cola aún no ha fallado y la fila ya avisa.');
});

test('SCRUM-885 · sin email y WhatsApp EN COLA más de 10 minutos → CON aviso en la fila (atascado)', async () => {
  const b = banco({ email: null, telefono: '+34600000885', wa: 'queued' });
  await b.confirmarBizum();
  assert.ok(b.emisiones.includes(b.chargeId), '🔴 NO PUDE MIRAR: no se emitió el documento.');
  const fila = async () => (await b.detalleDelTrabajo()).cuerpo.invoices.find((i) => i.chargeId === b.chargeId);
  // Control: a los 9 minutos todavía no se sabe. Sin él, un «siempre avisa» pasaría este test.
  b.filasWa[0].createdAt = new Date(Date.now() - 9 * 60_000);
  assert.equal(avisoVisible((await fila()).envioDocumento).mostrar, false, 'a los 9 minutos en cola no hay aviso');
  b.filasWa[0].createdAt = new Date(Date.now() - 11 * 60_000);
  assert.deepEqual(avisoVisible((await fila()).envioDocumento), { mostrar: true, texto: TEXTO_FIRMADO },
    '🔴 CALLADO PARA SIEMPRE: un WhatsApp atascado en cola más de 10 minutos no deja aviso en la fila.');
});

test('SCRUM-885 · factura AÚN SIN COBRAR → SIN aviso en la fila: todavía no había nada que enviar', async () => {
  const b = banco({ email: null, telefono: null });
  const fila = (await b.detalleDelTrabajo()).cuerpo?.invoices?.find((i) => i.chargeId === b.chargeId);
  assert.ok(fila, '🔴 CIEGO: la factura del cobro no sale en el detalle del trabajo.');
  assert.equal(b.emisiones.length, 0, 'control: no se ha cobrado nada');
  assert.equal(avisoVisible(fila.envioDocumento).mostrar, false,
    '🔴 FALSA ALARMA: una factura pendiente de cobro ya dice que el documento no se ha enviado.');
  // Control positivo del mismo banco: tras cobrar, la misma fila SÍ avisa.
  await b.confirmarBizum();
  const cobrada = (await b.detalleDelTrabajo()).cuerpo.invoices.find((i) => i.chargeId === b.chargeId);
  assert.equal(avisoVisible(cobrada.envioDocumento).mostrar, true, 'control: cobrada y sin email, la fila avisa');
});

test('SCRUM-885 · flag APAGADO → SIN aviso (que no le llegue a nadie es otro ticket)', async () => {
  const { b, enToast, enFila } = await cobrarYMirar({ email: null, telefono: null, autoEmail: false });
  assert.equal(b.correos.length, 0);
  assert.equal(enToast.mostrar, false);
  assert.equal(enFila.mostrar, false);
});

test('SCRUM-885 · NINGÚN envío nuevo: los envíos son los de hoy en todos los casos', async () => {
  for (const caso of [
    { email: null, telefono: null },
    { email: null, telefono: '+34600000885', wa: 'failed' },
    { email: 'c@ejemplo.invalid', telefono: '+34600000885', wa: 'sent' },
  ]) {
    const b = banco(caso);
    await b.confirmarBizum();
    await b.detalleDelTrabajo();
    await b.detalleDelTrabajo(); // mirar la pantalla dos veces no puede enviar nada
    assert.equal(b.correos.length, caso.email ? 1 : 0, `correos en ${JSON.stringify(caso)}`);
    assert.equal(b.filasWa.length, caso.telefono ? 1 : 0, `WhatsApps en ${JSON.stringify(caso)}`);
  }
});

// ═══ ⑤ LA VISTA PINTA DESDE LA REGLA — por AST, no por texto ═════════════════════════════════
// Los casos de arriba juzgan con `avisoDocumentoSinEnviar`, así que pasarían aunque ninguna
// pantalla la llamara. Esto ata las TRES superficies a esa misma regla: la llamada existe, recibe
// el `envioDocumento` de la respuesta que toca, y lo que pinta es su `.texto`. Por AST: un comentario
// que nombre la función no cuenta como llamada (SCRUM-203), y una copia del literal en la vista sí
// se ve aunque vaya partida en un template.
import ts from 'typescript';

function arbolDe(rel) {
  const fuente = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  return ts.createSourceFile(rel, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
}

function nodos(raiz, filtro) {
  const out = [];
  (function visita(n) { if (filtro(n)) out.push(n); ts.forEachChild(n, (h) => { visita(h); }); })(raiz);
  return out;
}

/** Las funciones que envuelven a `n`, de dentro afuera. */
function funcionesQueEnvuelven(n) {
  const out = [];
  for (let p = n.parent; p; p = p.parent) if (ts.isFunctionLike(p)) out.push(p);
  return out;
}

const textoPlano = (n) => (ts.isStringLiteralLike(n) ? n.text : ts.isTemplateExpression(n)
  ? n.head.text + n.templateSpans.map((s) => s.literal.text).join('') : null);

/**
 * Cada llamada a la regla con: de qué objeto lee `envioDocumento`, qué variable recibe el resultado,
 * dónde acaba su `.texto` y si la función que la envuelve es la del `confirm-bizum`.
 */
function llamadasALaRegla(rel) {
  const sf = arbolDe(rel);
  return nodos(sf, (n) => ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'avisoDocumentoSinEnviar')
    .map((llamada) => {
      const lectura = nodos(llamada.arguments[0] ?? llamada, (n) => ts.isPropertyAccessExpression(n) && n.name.text === 'envioDocumento')[0];
      const decl = ts.isVariableDeclaration(llamada.parent) ? llamada.parent : null;
      const variable = decl && ts.isIdentifier(decl.name) ? decl.name.text : null;
      const ambito = funcionesQueEnvuelven(llamada)[0];
      // Dónde se usa `<variable>.texto`: argumento de showToast, o asignado a textContent.
      const destinos = variable ? nodos(ambito, (n) => ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression)
        && n.expression.text === variable && n.name.text === 'texto'
        // En SU función: el manejador del botón, anidado en la fila, declara otra variable con el
        // mismo nombre, y por nombre a secas sus usos se contarían como de la fila.
        && funcionesQueEnvuelven(n)[0] === ambito).map((t) => {
        const p = t.parent;
        if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && p.expression.text === 'showToast') return 'showToast';
        if (ts.isBinaryExpression(p) && p.right === t && ts.isPropertyAccessExpression(p.left) && p.left.name.text === 'textContent') return 'textContent';
        return 'otro';
      }) : [];
      // La MISMA función que hace la petición: la fila vive en el forEach que TAMBIÉN envuelve al
      // manejador del botón, así que «alguna función de fuera la contiene» confundiría las dos.
      const confirmaBizum = nodos(sf, (n) => (textoPlano(n) ?? '').includes('/confirm-bizum'))
        .some((t) => funcionesQueEnvuelven(t)[0] === ambito);
      // ¿El objeto del que lee es la respuesta de ESE confirm-bizum?
      const objeto = lectura && ts.isIdentifier(lectura.expression) ? lectura.expression.text : null;
      const origen = objeto ? nodos(ambito, (n) => ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === objeto)[0] : null;
      return { sf, llamada, objeto, origen, destinos, confirmaBizum, dentroDeInvoicesForEach: funcionesQueEnvuelven(llamada).some((f) =>
        ts.isCallExpression(f.parent) && ts.isPropertyAccessExpression(f.parent.expression)
          && f.parent.expression.name.text === 'forEach' && f.parent.expression.expression.getText() === 'invoices') };
    });
}

function sinCopiaDelLiteral(rel) {
  const sf = arbolDe(rel);
  const copias = nodos(sf, (n) => (textoPlano(n) ?? '').includes('el cliente no tiene email'));
  assert.equal(copias.length, 0, `🔴 SEGUNDA COPIA: ${rel} escribe el literal del aviso en vez de pedírselo a la regla `
    + `(línea ${copias[0] && sf.getLineAndCharacterOfPosition(copias[0].getStart()).line + 1}).`);
}

test('SCRUM-885 · la fila de la factura del trabajo pinta el aviso DESDE la regla, con el envioDocumento de la factura', () => {
  const rel = 'public/dashboard/js/jobDetailView.js';
  const fila = llamadasALaRegla(rel).filter((c) => c.dentroDeInvoicesForEach && !c.confirmaBizum);
  assert.equal(fila.length, 1, '🔴 la fila de cada factura (invoices.forEach) no llama a avisoDocumentoSinEnviar');
  assert.equal(fila[0].objeto, 'inv', '🔴 la fila tiene que juzgar el envioDocumento de SU factura (inv.envioDocumento)');
  assert.deepEqual(fila[0].destinos, ['textContent'], '🔴 lo que se pinta en la fila tiene que ser el .texto de la regla');
  sinCopiaDelLiteral(rel);
});

for (const rel of ['public/dashboard/js/jobDetailView.js', 'public/dashboard/js/invoiceDetailView.js']) {
  test(`SCRUM-885 · «Confirmar Bizum» en ${path.basename(rel)} avisa DESDE la regla, con la respuesta del confirm-bizum`, () => {
    const toast = llamadasALaRegla(rel).filter((c) => c.confirmaBizum);
    assert.equal(toast.length, 1, `🔴 ${rel}: el manejador de confirm-bizum no llama a avisoDocumentoSinEnviar`);
    const [c] = toast;
    assert.ok(c.origen, `🔴 ${rel}: no encuentro de dónde sale «${c.objeto}», el objeto del que se lee envioDocumento`);
    // La respuesta: o el `await apiRequest(`…/confirm-bizum`)` o el `await r.json()` de ese fetch.
    const init = c.origen.initializer?.getText() ?? '';
    assert.ok(/confirm-bizum/.test(init) || /\.json\(\)/.test(init),
      `🔴 ${rel}: «${c.objeto}» no es la respuesta de confirm-bizum (${init.slice(0, 80)})`);
    assert.deepEqual(c.destinos, ['showToast'], `🔴 ${rel}: el .texto de la regla tiene que ir al toast`);
    sinCopiaDelLiteral(rel);
  });
}
