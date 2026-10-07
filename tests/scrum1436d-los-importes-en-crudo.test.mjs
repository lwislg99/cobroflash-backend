// tests/scrum1436d-los-importes-en-crudo.test.mjs — SCRUM-1436 (hallazgo 4)
//
// 🔴 EL IMPORTE EN CRUDO: «1419.87 EUR» donde la casa escribe «1.419,87 €».
//
// SCRUM-931 quitó ese formato de lo que lee el CLIENTE y dejó fuera, a propósito y por alcance, lo
// que lee el PROFESIONAL. Quedaban once sitios (los diez del ticket y el undécimo que midió S1 en
// el comentario 18194), y NINGUNO es un log. Aquí van los CUATRO del carril J1:
//
//   · la línea de historial de la factura enviada por WhatsApp (`invoiceWhatsApp.service.ts`);
//   · las dos frases de «importe distinto», que el panel pinta en el aviso de la factura y en el
//     historial de la ficha (`invoicesAdmin.routes.ts`, `payment-anomaly`);
//   · el «Paquete de evidencia de disputa», que se imprime y se entrega al banco.
//
// Los otros siete son del carril J2 (los avisos de WhatsApp al profesional y dos líneas de
// historial). Su test, que hoy cae, está en
// `docs/master/evidencias/SCRUM-1436/propuesto-j2-los-importes-de-los-avisos.test.mjs.txt`.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// Los handlers y el servicio REALES de `dist/`, con la base doblada y el WhatsApp en dry-run. Lo
// que se lee es lo que sale: la fila que se escribe en `customerEvent`, el cuerpo de la respuesta
// y el HTML.
//
// ⚠️ Ningún importe esperado está tecleado: sale de `formatMoneyEs` / `formatImporteEs`, porque
// `formatMoneyEs` separa la cifra del símbolo con un espacio DURO (código 160) y uno tecleado no
// casa. El primer caso comprueba que ese helper sigue dando lo que este fichero cree.
process.env.WHATSAPP_DRY_RUN = '1';
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { dobleDeLaBase } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

const M = 4436; // no es el 1: el demo tiene su propio freno de envío (V0-2)
const CLIENTE = 57;
const COBRO = 2436;
const FACTURA = 7;
const TEL_CLIENTE = '34000001437'; // rango imposible (SCRUM-262)
const TOTAL = '1419.87'; // cuatro cifras enteras: es donde `es-ES` no agrupa solo (SCRUM-743)
const NUMERO = 'F260007';
const DURO = String.fromCharCode(160);
const sinDuro = (s) => String(s).split(DURO).join(' ');
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
/** El formato que se retira: cifra con punto decimal seguida del código de moneda. */
const CRUDO = /\d\.\d{1,2} [A-Z]{3}\b/;
// La fila «Importe» del paquete, con hueco para los atributos de cada etiqueta (SCRUM-553): si
// mañana la tabla gana una clase, esto sigue mirando el importe y no se queda ciego.
const literal = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const filaDeImporte = (valor) => new RegExp(`<tr[^>]*><th[^>]*>Importe</th><td[^>]*>${literal(valor)}</td></tr>`);

const banco = { eventos: [], factura: null };

function reiniciar({ importe = TOTAL, moneda = 'EUR', numero = NUMERO } = {}) {
  banco.eventos = [];
  banco.factura = {
    id: FACTURA, merchantId: M, customerId: CLIENTE, number: numero, status: 'pending', total: importe, currency: moneda,
    chargeId: COBRO, quoteId: 9, stageLabel: null, createdAt: new Date('2026-10-01T10:00:00Z'), paidAt: null,
    merchant: { id: M, name: 'Taller de prueba', legalName: null, taxId: 'B00000000', address: null, country: 'ES' },
    customer: { id: CLIENTE, name: 'Cliente de prueba', phone: TEL_CLIENTE, mobile: null, email: null },
    quote: { id: 9, quoteNumber: 12, total: importe, currency: moneda, acceptedAt: null, decisionChannel: null, evidence: null, signatureUrl: null, decisionComment: null },
    charge: { id: COBRO, method: 'card', intentId: 'pi_1436', reference: null, status: 'paid' },
  };
}
reiniciar();

const doble = dobleDeLaBase({
  'customerEvent.create': (a) => { banco.eventos.push(a.data); return a.data; },
  'invoice.findUnique': () => ({ ...banco.factura }),
  'invoice.findFirst': () => ({ ...banco.factura }),
});

const fPrisma = rutaDe('dist/core/db/prisma.js');
requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble } };
// El token del cobro: lo único de `lib/invoicing` que el envío necesita, y no es lo que se mide.
const fInv = rutaDe('dist/lib/invoicing.js');
requiere.cache[fInv] = { id: fInv, filename: fInv, loaded: true, exports: { ensureChargeReceiptToken: async () => 'tok_1436' } };

const { formatMoneyEs, formatImporteEs } = requiere(rutaDe('dist/core/utils/utils.js'));

const handlerDe = (modulo, metodo, ruta) => {
  const m = requiere(rutaDe(modulo));
  const router = m.default || m;
  const capa = router.stack.find((l) => l.route?.path === ruta && l.route.methods[metodo]);
  assert.ok(capa, `🔴 CIEGO: no encuentro ${metodo.toUpperCase()} ${ruta} en ${modulo}`);
  return capa.route.stack.at(-1).handle;
};
const ADMIN = 'dist/modules/system/app/routes/invoicesAdmin.routes.js';
const anomaliaH = handlerDe(ADMIN, 'post', '/:id/payment-anomaly');
const paqueteH = handlerDe(ADMIN, 'get', '/:id/dispute-package');
const { sendInvoicePaymentRequest } = requiere(rutaDe('dist/modules/billing/domain/invoiceWhatsApp.service.js'));

/** Llama a un handler y devuelve lo que contestó. */
async function llamar(handle, req) {
  const r = { statusCode: 200, cuerpo: null, html: null };
  const res = {
    status(c) { r.statusCode = c; return res; },
    json(x) { r.cuerpo = x; return res; },
    type() { return res; },
    send(x) { r.html = x; return res; },
  };
  await handle(req, res, (e) => { if (e) throw e; });
  await esperar(30); // la línea de historial es fire-and-forget
  return r;
}
const deSesion = (extra) => reqDeSesion({ rol: 'admin', merchantId: M, headers: {}, ...extra });

/** La única línea de historial con ese tipo; falla si no hay exactamente una. */
function elEvento(tipo) {
  const filas = banco.eventos.filter((e) => e.type === tipo);
  assert.equal(filas.length, 1, `🔴 CIEGO: se esperaba una línea «${tipo}» en el historial y hay ${filas.length}`);
  return filas[0];
}

// ═══ SUELOS ══════════════════════════════════════════════════════════════════════════════

test('SCRUM-1436d · SUELO: el helper da «1.419,87 €» con espacio duro, y el patrón del crudo distingue', () => {
  const bueno = formatMoneyEs(TOTAL, 'EUR');
  assert.equal(sinDuro(bueno), '1.419,87 €');
  assert.ok(bueno.includes(DURO), '🔴 `formatMoneyEs` ya no separa con espacio duro: revisa las comparaciones de este fichero');
  assert.equal(formatImporteEs(TOTAL), '1.419,87');
  assert.ok(CRUDO.test('1419.87 EUR'), '🔴 CIEGO: el patrón no reconoce el formato que viene a retirar');
  assert.ok(CRUDO.test('419.8 EUR'), '🔴 CIEGO: el patrón no reconoce el importe sin su segundo decimal');
  assert.ok(!CRUDO.test(bueno), '🔴 el patrón del crudo casa con el formato bueno: no distingue nada');
  assert.ok(!CRUDO.test(formatMoneyEs(TOTAL, 'MXN')), '🔴 el patrón del crudo casa con el formato bueno fuera del euro');
});

// ═══ CARRIL J1 ════════════════════════════════════════════════════════════════════════════

test('SCRUM-1436d · 🔴 J1 · la factura enviada por WhatsApp deja en el historial «1.419,87 €»', async () => {
  reiniciar();
  globalThis.__waDryRunOutbox = [];
  let r;
  try { r = await sendInvoicePaymentRequest(FACTURA); await esperar(30); } finally { delete globalThis.__waDryRunOutbox; }
  assert.equal(r.ok, true, `🔴 CIEGO: el envío no salió (${r.reason})`);
  const ev = elEvento('invoice_issued');
  assert.equal(ev.detail, formatMoneyEs(TOTAL, 'EUR'));
  assert.ok(!CRUDO.test(ev.detail), `🔴 importe en crudo en el historial: «${ev.detail}»`);
  assert.equal(ev.title, `Factura ${NUMERO} enviada por WhatsApp`, 'el título de la línea no es de este arreglo y no cambia');
});

test('SCRUM-1436d · 🔴 J1 · importe distinto (parcial): el aviso de la factura y el historial, en formato de la casa', async () => {
  reiniciar();
  const r = await llamar(anomaliaH, deSesion({ params: { id: String(FACTURA) }, body: { amount: 300 } }));
  assert.equal(r.statusCode, 200);
  assert.equal(r.cuerpo.kind, 'parcial');
  const esperado = `Recibidos ${formatImporteEs(300)} de ${formatMoneyEs(TOTAL, 'EUR')} (faltan ${formatImporteEs(1119.87)}). `
    + 'La factura SIGUE pendiente — decide: esperar el resto o ajustar con el cliente (runbook V4).';
  assert.equal(r.cuerpo.message, esperado);
  assert.equal(elEvento('payment_anomaly').detail, esperado, 'la pantalla y el historial leen la MISMA frase');
  assert.ok(!CRUDO.test(r.cuerpo.message), `🔴 importe en crudo: «${r.cuerpo.message}»`);
  assert.ok(!/\d\.\d{2}\b/.test(r.cuerpo.message), `🔴 queda una cifra con punto decimal: «${r.cuerpo.message}»`);
});

test('SCRUM-1436d · 🔴 J1 · importe distinto (sobrepago): lo mismo en la otra rama', async () => {
  reiniciar();
  const r = await llamar(anomaliaH, deSesion({ params: { id: String(FACTURA) }, body: { amount: 1500 } }));
  assert.equal(r.cuerpo.kind, 'sobrepago');
  const esperado = `Recibidos ${formatMoneyEs(1500, 'EUR')} (sobran ${formatImporteEs(80.13)}). `
    + 'Anota la devolución manual de la diferencia antes de marcarla pagada (runbook V5).';
  assert.equal(r.cuerpo.message, esperado);
  assert.equal(elEvento('payment_anomaly').detail, esperado);
  assert.ok(!/\d\.\d{2}\b/.test(r.cuerpo.message), `🔴 queda una cifra con punto decimal: «${r.cuerpo.message}»`);
});

test('SCRUM-1436d · ✅ J1 · importe distinto: la FRASE no cambia, sólo la forma de las cifras', async () => {
  // El positivo: quitando las cifras, lo que queda es letra por letra la frase que ya había.
  const sinCifras = (s) => sinDuro(s).replace(/\d[\d.,]*( (€|[A-Z]{3}\b))?/g, '#');
  reiniciar();
  const parcial = await llamar(anomaliaH, deSesion({ params: { id: String(FACTURA) }, body: { amount: 300 } }));
  assert.equal(sinCifras(parcial.cuerpo.message),
    'Recibidos # de # (faltan #). La factura SIGUE pendiente — decide: esperar el resto o ajustar con el cliente (runbook V#).');
  reiniciar();
  const sobra = await llamar(anomaliaH, deSesion({ params: { id: String(FACTURA) }, body: { amount: 1500 } }));
  assert.equal(sinCifras(sobra.cuerpo.message),
    'Recibidos # (sobran #). Anota la devolución manual de la diferencia antes de marcarla pagada (runbook V#).');
  // Y el instrumento distingue: con el formato viejo da el MISMO esqueleto (la frase era ésa).
  assert.equal(sinCifras('Recibidos 300.00 de 1419.87 EUR (faltan 1119.87). La factura SIGUE pendiente — decide: esperar el resto o ajustar con el cliente (runbook V4).'),
    sinCifras(parcial.cuerpo.message));
});

test('SCRUM-1436d · 🔴 J1 · el paquete de disputa que se entrega al banco lleva «1.419,87 €»', async () => {
  reiniciar();
  const r = await llamar(paqueteH, deSesion({ params: { id: String(FACTURA) } }));
  assert.equal(r.statusCode, 200);
  assert.ok(typeof r.html === 'string' && r.html.includes('Paquete de evidencia de disputa'), '🔴 CIEGO: no ha salido el HTML del paquete');
  const bueno = formatMoneyEs(TOTAL, 'EUR');
  assert.ok(filaDeImporte(bueno).test(r.html), '🔴 el importe del documento de cobro no sale en el formato de la casa');
  assert.ok(r.html.includes(`#12 · ${bueno}</td>`), '🔴 el importe del presupuesto no sale en el formato de la casa');
  const sinEstilo = r.html.replace(/<style[^>]*>[\s\S]*?<\/style>/, '');
  assert.notEqual(sinEstilo.length, r.html.length, '🔴 CIEGO: no se ha quitado la hoja de estilo del paquete');
  assert.ok(!CRUDO.test(sinEstilo), `🔴 queda un importe en crudo en el paquete: «${(sinEstilo.match(CRUDO) || [])[0]}»`);
});

test('SCRUM-1436d · J1 · fuera del euro sale el código de la moneda, no un € impostado', async () => {
  reiniciar({ moneda: 'MXN' });
  const r = await llamar(paqueteH, deSesion({ params: { id: String(FACTURA) } }));
  assert.ok(filaDeImporte(formatMoneyEs(TOTAL, 'MXN')).test(r.html));
  assert.ok(sinDuro(formatMoneyEs(TOTAL, 'MXN')).endsWith(' MXN'), '🔴 CIEGO: el helper ya no escribe el código fuera del euro');
});
