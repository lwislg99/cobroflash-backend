// SCRUM-1518b · LA PESTAÑA «WhatsApp» DE LA FICHA SÓLO ENSEÑA LO QUE SE LE HA ENVIADO AL CLIENTE.
//
// Lo que escribe el cliente se guarda en la misma tabla como `type: 'inbound'` (estado `received`), y
// `historialWhatsAppDelCliente` lo devolvía: la ficha lo pintaba como un envío nuestro, «✓ WhatsApp:
// Enviado» (reproducido de punta a punta por S4: `docs/master/evidencias/SCRUM-1518/`). La pestaña se
// firmó como «los WhatsApp que se le han ENVIADO» (SCRUM-1133): un entrante está fuera de lo firmado.
//
// Contra Postgres de verdad, porque el filtro es un operador de Prisma (`not`) y un doble en memoria
// puede ignorarlo y pasar igual — es exactamente lo que le pasó a la sonda (SCRUM-1518.md, tramo 1518b).
//   · un entrante no sale, y los envíos (plantilla y de servicio) sí;
//   · CONTROL POSITIVO: el entrante ESTÁ en la tabla (si no, «no sale» no probaría nada);
//   · páginas: con entrantes intercalados, 21 envíos dan 20 + 1 y ningún entrante, y el cursor de la
//     página siguiente es siempre un envío.
//
// ⚠️ GATEADO, dos destinos (patrón SCRUM-876), igual que `scrum1062-historial-whatsapp-cliente`.
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

test('SCRUM-1518b · historialWhatsAppDelCliente: los entrantes del cliente no salen, ni en la primera página ni en las siguientes', { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { historialWhatsAppDelCliente } = await import('../dist/modules/system/domain/historialWhatsAppDelCliente.js');
  const POR_PAGINA = 20; // el tamaño de página de la superficie pública (lo fija también scrum1062)
  const stamp = Date.now();
  try {
    await withMerchant(prisma, { name: 'QA 1518b', email: `qa-1518b-${stamp}@test.local` }, async (m) => {
      const ana = await prisma.customer.create({ data: { merchantId: m.id, name: 'Ana 1518b' } });

      const plantilla = await prisma.whatsAppMessage.create({
        data: { merchantId: m.id, customerId: ana.id, type: 'template', templateName: 'presupuesto', status: 'delivered', relatedType: 'quote', relatedId: 1 },
      });
      const servicio = await prisma.whatsAppMessage.create({ data: { merchantId: m.id, customerId: ana.id, type: 'service', status: 'sent' } });
      // Lo que escribe el cliente: así lo guarda `recordInboundWaMessage` (whatsappLog.service.ts).
      const entrante = await prisma.whatsAppMessage.create({ data: { merchantId: m.id, customerId: ana.id, type: 'inbound', status: 'received' } });

      // CONTROL POSITIVO: el entrante está en la tabla, del mismo cliente y merchant.
      const enLaTabla = await prisma.whatsAppMessage.count({ where: { merchantId: m.id, customerId: ana.id } });
      assert.equal(enLaTabla, 3, '🔴 CIEGO: la tabla no tiene los tres mensajes sembrados; «no sale» no probaría nada');

      const h = await historialWhatsAppDelCliente(m.id, ana.id, {});
      const ids = h.mensajes.map((x) => x.id);
      assert.ok(!ids.includes(entrante.id), '🔴 el mensaje que ESCRIBIÓ el cliente sale en su ficha como si se lo hubiéramos enviado');
      assert.deepEqual([...ids].sort((a, b) => a - b), [plantilla.id, servicio.id].sort((a, b) => a - b),
        '🔴 falta un envío: el filtro se ha llevado algo que no era un entrante');
      assert.ok(h.mensajes.every((x) => x.type !== 'inbound'));

      // ── Páginas, con entrantes intercalados: 19 envíos más (21 en total) y 5 entrantes más ──
      for (let i = 0; i < 19; i++) {
        await prisma.whatsAppMessage.create({ data: { merchantId: m.id, customerId: ana.id, type: 'service', status: 'sent' } });
        if (i % 4 === 0) await prisma.whatsAppMessage.create({ data: { merchantId: m.id, customerId: ana.id, type: 'inbound', status: 'received' } });
      }
      const p1 = await historialWhatsAppDelCliente(m.id, ana.id, {});
      assert.equal(p1.mensajes.length, POR_PAGINA, '🔴 la primera página no trae 20 envíos');
      assert.ok(p1.siguiente, '🔴 con 21 envíos no se ofrece página siguiente');
      const delCursor = await prisma.whatsAppMessage.findUnique({ where: { id: p1.siguiente }, select: { type: true } });
      assert.notEqual(delCursor.type, 'inbound', '🔴 el cursor de la página siguiente apunta a un entrante');
      const p2 = await historialWhatsAppDelCliente(m.id, ana.id, { despuesDe: p1.siguiente });
      const todos = [...p1.mensajes, ...p2.mensajes];
      assert.equal(todos.length, 21, `🔴 entre las dos páginas faltan o sobran envíos: ${todos.length}`);
      assert.equal(new Set(todos.map((x) => x.id)).size, 21, '🔴 un envío sale en las dos páginas');
      assert.ok(todos.every((x) => x.type !== 'inbound'), '🔴 un entrante se cuela en alguna página');
      assert.ok(!('siguiente' in p2), 'la segunda es la última');
    });
  } finally {
    await prisma.$disconnect();
  }
});
