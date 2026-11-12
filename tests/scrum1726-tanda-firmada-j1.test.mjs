// tests/scrum1726-tanda-firmada-j1.test.mjs — SCRUM-1726 (J1, 12-nov-2026)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LO FIRMADO EL 12-NOV EN `invoicesAdmin.routes.ts`: la hoja de disputa (texto y fechas) y el
// recordatorio manual que mira la ventana. Firma del fundador: SCRUM-1656 c.21724 («Ok firmo todo»)
// sobre la tanda c.21722. La pieza 1 (el sello del PDF) vive en `scrum1470-…`, con su sonda.
//
//   · 6  · el pie de la hoja dice «de la factura»; «del justificante» sólo para un `J-` antiguo.
//   · D1 · las fechas de la hoja, en la zona del negocio (no el reloj del proceso).
//   · D3 · el recordatorio MANUAL mira primero la ventana de 24 h: abierta → botón; cerrada → la
//          plantilla `payment_request_es` de siempre. Lo mismo que el automático
//          (`invoiceReminder.service.ts`), y con el MISMO texto: lo ata el último caso, por AST.
//
// ── EL BANCO ── la app REAL (`dist/app.js`) por HTTP, con su `requireAuth` y su `requireRole`
// (`_banco-camino-real.mjs`): no se saca el handler de su ruta (A10, SCRUM-1344). WhatsApp por el
// dry-run de la casa, que apunta cada envío en un buzón con su CLASE (`cta_url`, `template`…).
//
// 🔴 EL PROCESO VA EN UTC, como Railway. En la máquina donde se escribe esto el proceso va en la
// hora de Madrid, y una fecha sin zona saldría «bien» sin el arreglo: el caso D1 sería verde con
// el defecto puesto. Por eso se fija la zona ANTES de cargar nada, y el SUELO lo comprueba.
process.env.TZ = 'UTC';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { montarAppReal, bancoDePrisma, sesionesDe } from './_banco-camino-real.mjs';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

// Cada una imita el defecto que su caso promete cazar (las ejecuta `scripts/meta-guard-mutaciones.mjs`).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    de: "      : 'PDF del presupuesto firmado y de la factura: disponibles desde el panel (se adjuntan a la respuesta de la disputa).';",
    a: "      : 'PDF del presupuesto firmado y del justificante: disponibles desde el panel (se adjuntan a la respuesta de la disputa).';",
    cae: '6 · 🔴 el pie de la hoja de una factura dice «de la factura»',
  },
  {
    fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    de: "{ dateStyle: 'long', timeStyle: 'short', timeZone: zonaDelNegocio }",
    a: "{ dateStyle: 'long', timeStyle: 'short' }",
    cae: 'D1 · 🔴 las fechas de la hoja van en la zona del negocio',
  },
  {
    // El recordatorio deja de mirar la ventana: `customerId` 0 hace que `sendWhatsAppWindowFirst`
    // no pregunte por ella y vaya directo a la plantilla, que es el comportamiento de antes.
    fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    de: '        customerId: invoice.customerId,\n        windowText:',
    a: '        customerId: 0,\n        windowText:',
    cae: 'D3 · 🔴 con la ventana de 24 h ABIERTA, el recordatorio manual sale como BOTÓN',
  },
  {
    fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    de: "            `Te recordamos el pago pendiente ${pagoDe} ${appendStageLabel(invoice.number, invoice.stageLabel)} por *${importe}* de parte de *${merchantName}*.${urgency}\\n` +",
    a: "            `Te recordamos el pago pendiente ${pagoDe} ${appendStageLabel(invoice.number, invoice.stageLabel)} por ${importe} de parte de *${merchantName}*.${urgency}\\n` +",
    cae: 'D3 · el botón del manual dice LO MISMO que el del automático',
  },
];

const app = await montarAppReal();
after(() => app.cerrar());

const MIO = 17260;
const ses = sesionesDe(MIO, { id: 9, role: 'tecnico', merchantId: MIO });
const CLIENTE = { id: 801, merchantId: MIO, name: 'Cliente 1726', phone: telefonoDePrueba(17261), mobile: null, email: null };

// El instante del caso: las 00:30 del 3-oct en Madrid, que en UTC aún es el 2-oct a las 22:30.
const INSTANTE = new Date('2026-10-02T22:30:00Z');
// Escrito A MANO: si saliera de la misma función que lo pinta, el test se compararía consigo mismo.
const EN_MADRID = '3 de octubre de 2026 a las 0:30';
const EN_UTC = '2 de octubre de 2026 a las 22:30';

// Los dos literales del pie, byte a byte de SCRUM-1656 c.21722 (texto 6) y del que ya había.
const PIE_FACTURA = 'PDF del presupuesto firmado y de la factura: disponibles desde el panel (se adjuntan a la respuesta de la disputa).';
const PIE_JUSTIFICANTE = 'PDF del presupuesto firmado y del justificante: disponibles desde el panel (se adjuntan a la respuesta de la disputa).';

function factura({ id, number, zona }) {
  return {
    id, merchantId: MIO, customerId: CLIENTE.id, number, status: 'pending', stageLabel: null,
    total: '419.87', currency: 'EUR', chargeId: 900 + id, quoteId: null,
    createdAt: INSTANTE, paidAt: INSTANTE, reminder7SentAt: null, reminder14SentAt: null,
    customerName: CLIENTE.name, customerPhone: CLIENTE.phone, customerEmail: null,
    merchant: { id: MIO, name: 'Taller 1726', legalName: null, taxId: null, address: null, country: 'ES', timezone: zona },
    customer: CLIENTE, quote: null,
    charge: { id: 900 + id, method: 'bizum', intentId: null, reference: 'ref-1726', status: 'pending' },
  };
}
const FACTURAS = {
  1: factura({ id: 1, number: 'F260001', zona: 'Europe/Madrid' }),
  2: factura({ id: 2, number: 'J-260002', zona: 'Europe/Madrid' }),
  3: factura({ id: 3, number: 'F260003', zona: null }),
};

/** Programa la base. `ventana` = hay un mensaje ENTRANTE del cliente en las últimas 24 h. */
function programar({ ventana = false, mensajes = [] } = {}) {
  const preguntasVentana = [];
  bancoDePrisma().programar({
    authSession: ses.tabla,
    merchant: { findUnique: async () => ({ ...ses.merchant, country: 'ES', timezone: 'Europe/Madrid', flags: null }) },
    invoice: {
      findFirst: async (a) => (a?.where?.merchantId === MIO ? FACTURAS[a?.where?.id] ?? null : null),
      update: async (a) => ({ id: a?.where?.id }),
    },
    charge: { findUnique: async (a) => ({ id: a?.where?.id ?? 0, receiptToken: `tok-1726-${a?.where?.id ?? 0}` }) },
    whatsAppMessage: {
      findMany: async () => mensajes,
      findFirst: async (a) => {
        const w = a?.where ?? {};
        if (w.type === 'inbound') { preguntasVentana.push(w.customerId); return ventana ? { id: 1 } : null; }
        return null;
      },
      count: async () => 0,
      create: async (a) => ({ id: 1, ...a.data }),
    },
  });
  return { preguntasVentana };
}

async function enDryRun(fn) {
  const buzon = [];
  globalThis.__waDryRunOutbox = buzon;
  const anterior = process.env.WHATSAPP_DRY_RUN;
  process.env.WHATSAPP_DRY_RUN = '1';
  const [error, aviso] = [console.error, console.warn];
  console.error = () => {};
  console.warn = () => {};
  try {
    const r = await fn();
    return { r, buzon };
  } finally {
    console.error = error;
    console.warn = aviso;
    delete globalThis.__waDryRunOutbox;
    if (anterior === undefined) delete process.env.WHATSAPP_DRY_RUN; else process.env.WHATSAPP_DRY_RUN = anterior;
  }
}

const paquete = (id) => app.pedir(`/admin/invoices/${id}/dispute-package`, { token: ses.PROPIETARIO });
const recordar = (id) => app.pedir(`/admin/invoices/${id}/send-reminder`, { token: ses.PROPIETARIO, metodo: 'POST', cuerpo: {} });

// ═════════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-1726 · SUELO: el proceso va en UTC y la hoja de disputa contesta 200 por la app real', async () => {
  assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, 'UTC',
    '🔴 CIEGO: el proceso no va en UTC; una fecha sin zona saldría «bien» en esta máquina');
  programar();
  const r = await paquete(1);
  assert.equal(r.status, 200, `suelo: ${r.status} ${String(r.texto).slice(0, 200)}`);
  assert.ok(r.texto.includes('Paquete de evidencia de disputa'), '🔴 CIEGO: no es la hoja de disputa');
});

test('SCRUM-1726 · 6 · 🔴 el pie de la hoja de una factura dice «de la factura», byte a byte lo firmado', async () => {
  programar();
  const r = await paquete(1);
  assert.ok(r.texto.includes(PIE_FACTURA), '🔴 el pie de una factura no es el literal firmado en SCRUM-1656 c.21722 (6)');
  assert.ok(!r.texto.includes(PIE_JUSTIFICANTE), '🔴 el pie de una FACTURA sigue llamándola «justificante»');
});

test('SCRUM-1726 · 6 · CONTROL: un `J-` antiguo sigue diciendo «del justificante»', async () => {
  programar();
  const r = await paquete(2);
  assert.equal(r.status, 200);
  assert.ok(r.texto.includes(PIE_JUSTIFICANTE), '🔴 el pie de un J- ya no dice «del justificante»');
  assert.ok(!r.texto.includes(PIE_FACTURA), '🔴 un J- se llama «factura» en la hoja que va al banco');
});

test('SCRUM-1726 · D1 · 🔴 las fechas de la hoja van en la zona del negocio (las 00:30 de Madrid son el 3-oct, no el 2)', async () => {
  programar({ mensajes: [{ createdAt: INSTANTE, type: 'template', templateName: 'payment_request_es', relatedType: 'invoice', relatedId: 1, status: 'read' }] });
  const r = await paquete(1);
  const emitido = r.texto.match(/<th>Emitido<\/th><td>([^<]*)<\/td>/)?.[1];
  const pagado = r.texto.match(/<th>Pagado el<\/th><td>([^<]*)<\/td>/)?.[1];
  const delMensaje = r.texto.match(/<tr>\s*<td>([^<]*)<\/td><td>template<\/td>/)?.[1];
  assert.equal(emitido, EN_MADRID, `🔴 «Emitido» dice ${emitido}: es el reloj del proceso, no el del negocio`);
  assert.equal(pagado, EN_MADRID, `🔴 «Pagado el» dice ${pagado}`);
  assert.equal(delMensaje, EN_MADRID, `🔴 la fecha del mensaje dice ${delMensaje}`);
});

test('SCRUM-1726 · D1 · CONTROL: un negocio sin zona guardada sale en UTC (la decisión A de `zonaDelMerchant`)', async () => {
  programar();
  const r = await paquete(3);
  assert.equal(r.texto.match(/<th>Emitido<\/th><td>([^<]*)<\/td>/)?.[1], EN_UTC);
});

test('SCRUM-1726 · D3 · 🔴 con la ventana de 24 h ABIERTA, el recordatorio manual sale como BOTÓN, no como plantilla', async () => {
  const { preguntasVentana } = programar({ ventana: true });
  const { r, buzon } = await enDryRun(() => recordar(1));
  assert.equal(r.status, 200, `${r.status} ${String(r.texto).slice(0, 200)}`);
  assert.deepEqual(preguntasVentana, [CLIENTE.id], '🔴 no se ha mirado la ventana del cliente de la factura');
  assert.deepEqual(buzon.map((m) => m.kind), ['cta_url'], `🔴 con la ventana abierta ha salido ${JSON.stringify(buzon.map((m) => m.kind))}`);
  assert.equal(buzon[0].to, CLIENTE.phone, 'a quién: el mismo cliente (regla 28)');
  assert.equal(buzon[0].buttonText, 'Pagar ahora');
  assert.ok(buzon[0].url.endsWith('/pay/invoice/tok-1726-901'), `el botón lleva al cobro de la factura: ${buzon[0].url}`);
  assert.equal(r.json.sent, true);
});

test('SCRUM-1726 · D3 · CONTROL: con la ventana CERRADA, sale la plantilla `payment_request_es` de siempre', async () => {
  const { preguntasVentana } = programar({ ventana: false });
  const { r, buzon } = await enDryRun(() => recordar(1));
  assert.equal(r.status, 200);
  assert.deepEqual(preguntasVentana, [CLIENTE.id]);
  assert.deepEqual(buzon.map((m) => `${m.kind}:${m.templateName}`), ['template:payment_request_es']);
  assert.equal(buzon[0].to, CLIENTE.phone);
  assert.equal(r.json.via, 'template');
});

/** Los trozos de texto fijos del `windowCta` de una llamada a `sendWhatsAppWindowFirst`, por AST. */
function textoDeLaVentana(rel) {
  const src = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true);
  const hallados = [];
  const plano = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
    if (ts.isTemplateExpression(n)) return n.head.text + n.templateSpans.map((s) => '${}' + s.literal.text).join('');
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) return plano(n.left) + plano(n.right);
    if (ts.isParenthesizedExpression(n)) return plano(n.expression);
    return '${}';
  };
  (function v(n) {
    if (ts.isCallExpression(n) && n.expression.getText(sf).endsWith('sendWhatsAppWindowFirst')) {
      const arg = n.arguments[0];
      const cta = arg && ts.isObjectLiteralExpression(arg)
        && arg.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText(sf) === 'windowCta');
      if (cta && ts.isObjectLiteralExpression(cta.initializer)) {
        const campo = (k) => cta.initializer.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText(sf) === k);
        hallados.push({ bodyText: plano(campo('bodyText').initializer), buttonText: plano(campo('buttonText').initializer) });
      }
    }
    ts.forEachChild(n, v);
  })(sf);
  return hallados;
}

test('SCRUM-1726 · D3 · el botón del manual dice LO MISMO que el del automático (texto firmado de SCRUM-1436), por AST', () => {
  const auto = textoDeLaVentana('src/modules/billing/domain/invoiceReminder.service.ts');
  const manual = textoDeLaVentana('src/modules/system/app/routes/invoicesAdmin.routes.ts');
  assert.equal(auto.length, 1, `🔴 CIEGO: en el automático hay ${auto.length} llamadas con botón de ventana; este caso compara con una`);
  assert.equal(manual.length, 1, `🔴 el recordatorio manual tiene ${manual.length} llamadas con botón de ventana`);
  assert.ok(auto[0].bodyText.includes('Te recordamos el pago pendiente'), '🔴 CIEGO: el lector no ha sacado el texto del automático');
  assert.deepEqual(manual[0], auto[0],
    '🔴 el botón del recordatorio manual no dice lo mismo que el del automático: un texto distinto es un texto nuevo (regla 39)');
});
