// SCRUM-1062 (CRM-19) · QUÉ WHATSAPP SE HAN ENVIADO AL CLIENTE, en su ficha.
//
// `historialWhatsAppDelCliente` contra Postgres de verdad, que es donde viven las garantías:
//   · TENENCIA: cliente de otro merchant → null (la ruta da 404), y sus mensajes no se cuelan;
//   · un cliente SIN mensajes no rompe (devuelve `mensajes: []`, no lanza);
//   · un mensaje de un documento BORRADO (`relatedId` sin fila detrás) sigue saliendo tal cual —
//     no hay FK que lo esconda, y no la debe haber (`WhatsAppMessage` es tabla suelta, ENT-3);
//   · `waOptOut` se enseña una vez, del CLIENTE, no por fila;
//   · páginas de 20 con cursor, como `historialDelCliente` (SCRUM-980).
//
// ⚠️ GATEADO, dos destinos (patrón SCRUM-876).
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

const URL_BANCO = process.env.QA_DB_TEST === '1' ? '' : (process.env.LIBRO_PG_URL || '');
if (URL_BANCO) {
  const p = parseBDSegura(URL_BANCO);
  if (!p || !['127.0.0.1', 'localhost', '::1'].includes(p.host) || !p.base.endsWith('_test')) {
    throw new Error('🔴 LIBRO_PG_URL no es un banco desechable (loopback y base «*_test»). No se toca nada.');
  }
  process.env.DATABASE_URL = URL_BANCO;
}
const ENABLED = process.env.QA_DB_TEST === '1' || URL_BANCO !== '';

test('SCRUM-1062 · historialWhatsAppDelCliente: tenencia, sin mensajes, documento borrado, waOptOut y páginas', { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { historialWhatsAppDelCliente } = await import('../dist/modules/system/domain/historialWhatsAppDelCliente.js');
  // 20 es el tamaño de página documentado en el fuente; se prueba por la SUPERFICIE PÚBLICA
  // (SCRUM-411: una constante interna sin consumidor fuera de su fichero queda huérfana).
  const MENSAJES_POR_PAGINA = 20;
  const stamp = Date.now();
  try {
    await withMerchant(prisma, { name: 'QA 1062 A', email: `qa-1062-a-${stamp}@test.local` }, (a) =>
      withMerchant(prisma, { name: 'QA 1062 B', email: `qa-1062-b-${stamp}@test.local` }, async (b) => {
        const ana = await prisma.customer.create({ data: { merchantId: a.id, name: 'Ana 1062', waOptOut: true } });
        const sinMensajes = await prisma.customer.create({ data: { merchantId: a.id, name: 'Sin mensajes 1062' } });

        const q = await prisma.quote.create({ data: { merchantId: a.id, customerId: ana.id, total: '10.00', currency: 'EUR', lines: [], status: 'sent', quoteNumber: 1062 } });
        const msgQuote = await prisma.whatsAppMessage.create({
          data: { merchantId: a.id, customerId: ana.id, type: 'template', templateName: 'presupuesto', status: 'delivered', relatedType: 'quote', relatedId: q.id },
        });
        // El "documento borrado": relatedId que ya NO existe. WhatsAppMessage es tabla suelta
        // (sin FK, ENT-3): borrar el documento no se lleva el mensaje por delante.
        const facturaFantasma = await prisma.invoice.create({
          data: {
            merchantId: a.id, customerId: ana.id, total: '5.00', currency: 'EUR', number: 'F-1062',
            status: 'pending', pdfUrl: '/x/f-1062.pdf', qrData: 'x',
          },
        });
        const msgFactura = await prisma.whatsAppMessage.create({
          data: { merchantId: a.id, customerId: ana.id, type: 'template', templateName: 'factura', status: 'failed', error: 'expired', relatedType: 'invoice', relatedId: facturaFantasma.id },
        });
        await prisma.invoice.delete({ where: { id: facturaFantasma.id } });

        // Otro merchant: un cliente suyo con un mensaje. No puede colarse en la ficha de Ana.
        const deB = await prisma.customer.create({ data: { merchantId: b.id, name: 'De B 1062' } });
        await prisma.whatsAppMessage.create({ data: { merchantId: b.id, customerId: deB.id, type: 'service', status: 'sent' } });

        // ── Tenencia ──
        assert.equal(await historialWhatsAppDelCliente(a.id, deB.id, {}), null, '🔴 un cliente de OTRO merchant devuelve historial (debía ser 404)');

        // ── Sin mensajes: no rompe ──
        const vacio = await historialWhatsAppDelCliente(a.id, sinMensajes.id, {});
        assert.deepEqual(vacio.mensajes, [], '🔴 un cliente sin mensajes debe dar lista vacía, no lanzar');
        assert.equal(vacio.waOptOut, false);
        assert.ok(!('siguiente' in vacio));

        // ── Ana: los dos mensajes, el del documento borrado incluido, waOptOut del cliente ──
        const h = await historialWhatsAppDelCliente(a.id, ana.id, {});
        assert.equal(h.waOptOut, true, '🔴 waOptOut es del CLIENTE, no debe faltar');
        const ids = h.mensajes.map((m) => m.id);
        assert.ok(ids.includes(msgQuote.id) && ids.includes(msgFactura.id), '🔴 se cuela o falta un mensaje de Ana');
        const deLaFactura = h.mensajes.find((m) => m.id === msgFactura.id);
        assert.equal(deLaFactura.relatedType, 'invoice');
        assert.equal(deLaFactura.relatedId, facturaFantasma.id, '🔴 un documento borrado no puede borrar el mensaje que lo cita');
        assert.equal(deLaFactura.status, 'failed');
        assert.equal(deLaFactura.error, 'expired');
        assert.ok(!('siguiente' in h));

        // ── Página de OTRO merchant no se cuela por número de mensaje ──
        const soloDeAna = h.mensajes.every((m) => [msgQuote.id, msgFactura.id].includes(m.id));
        assert.ok(soloDeAna, '🔴 aparece un mensaje que no es de Ana');

        // ── Páginas de 20 con cursor ──
        for (let i = 0; i < MENSAJES_POR_PAGINA; i++) {
          await prisma.whatsAppMessage.create({ data: { merchantId: a.id, customerId: ana.id, type: 'service', status: 'sent' } });
        }
        const p1 = await historialWhatsAppDelCliente(a.id, ana.id, {});
        assert.equal(p1.mensajes.length, MENSAJES_POR_PAGINA);
        assert.ok(p1.siguiente, '🔴 con 22 mensajes no se ofrece página siguiente');
        const p2 = await historialWhatsAppDelCliente(a.id, ana.id, { despuesDe: p1.siguiente });
        const todos = [...p1.mensajes, ...p2.mensajes].map((m) => m.id);
        assert.equal(todos.length, 22, `🔴 entre las dos páginas faltan o sobran mensajes: ${todos.length}`);
        assert.equal(new Set(todos).size, 22, '🔴 un mensaje sale en las dos páginas');
        assert.ok(!('siguiente' in p2), 'la segunda es la última');
      }));
  } finally {
    await prisma.$disconnect();
  }
});
