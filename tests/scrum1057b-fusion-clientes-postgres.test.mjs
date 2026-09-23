// SCRUM-1057 (CRM-16) · FUSIONAR DOS CLIENTES DUPLICADOS — la mitad con BASE.
//
// `fusionarClientes`/`previsualizarFusion` contra Postgres de verdad, que es donde viven las
// garantías: las CUATRO tablas con FK real a `customers` (Quote, Charge, QuoteRequest,
// CustomerEvent) se mueven ANTES del `DELETE` —si no, Postgres lo rechazaría—, las CINCO sin FK
// (Job, ParteTrabajo, WhatsAppMessage, EmailMessage, MaintenancePlan) se mueven igual para no
// dejar un defecto MUDO, la fusión es transaccional, deja un apunte en el historial del que queda,
// y NINGUNA fusión se intenta si cualquiera de los dos tiene una factura EMITIDA.
//
// La mitad PURA (`decidirRechazoFusion`) vive en `scrum1057-decidir-rechazo-fusion.test.mjs` y
// corre en cada `npm test`, sin base.
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

test('SCRUM-1057 · fusión limpia: las nueve tablas se mueven, se fusionan etiquetas, queda el apunte y el fusionado desaparece', { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { fusionarClientes, previsualizarFusion } = await import('../dist/modules/system/domain/fusionClientes.js');
  const stamp = Date.now();
  try {
    await withMerchant(prisma, { name: 'QA 1057 A', email: `qa-1057-a-${stamp}@test.local` }, (a) =>
      withMerchant(prisma, { name: 'QA 1057 B', email: `qa-1057-b-${stamp}@test.local` }, async (b) => {
        const principal = await prisma.customer.create({ data: { merchantId: a.id, name: 'Ana Principal', taxId: '33576428Q', tags: ['moroso'] } });
        const fusionado = await prisma.customer.create({ data: { merchantId: a.id, name: 'Ana Duplicada', taxId: '12345678A', tags: ['urgente', 'MOROSO'] } });
        // Una empresa que apunta al FUSIONADO: tiene que desvincularse (companyId → null), no quedar colgada.
        const empleado = await prisma.customer.create({ data: { merchantId: a.id, name: 'Empleado de la duplicada', companyId: fusionado.id } });

        const quote = await prisma.quote.create({ data: { merchantId: a.id, customerId: fusionado.id, total: '10.00', currency: 'EUR', lines: [], quoteNumber: 1057 } });
        const job = await prisma.job.create({ data: { merchantId: a.id, customerId: fusionado.id } });
        const nota = await prisma.customerEvent.create({ data: { merchantId: a.id, customerId: fusionado.id, type: 'nota', title: 'Nota de la duplicada' } });
        const charge = await prisma.charge.create({ data: { merchantId: a.id, customerId: fusionado.id, concept: 'Señal', amount: '5.00', currency: 'EUR', method: 'card', status: 'paid' } });
        const solicitud = await prisma.quoteRequest.create({ data: { merchantId: a.id, customerId: fusionado.id, description: 'Necesito revisar la caldera' } });
        const parte = await prisma.parteTrabajo.create({ data: { merchantId: a.id, customerId: fusionado.id, numero: `PT-1057-${stamp}`, fecha: new Date(), tecnicos: [], lineas: [] } });
        const wa = await prisma.whatsAppMessage.create({ data: { merchantId: a.id, customerId: fusionado.id, type: 'service' } });
        const correo = await prisma.emailMessage.create({ data: { merchantId: a.id, customerId: fusionado.id, kind: 'quote', toEmail: 'duplicada@test.local' } });
        const mantenimiento = await prisma.maintenancePlan.create({ data: { merchantId: a.id, customerId: fusionado.id, title: 'Revisión anual', intervalMonths: 12, nextDueAt: new Date() } });

        // ── Previsualización: cuenta lo que se movería, SIN escribir nada ──
        const preview = await previsualizarFusion(a.id, principal.id, fusionado.id);
        assert.equal(preview.bloqueada, null);
        assert.equal(preview.quotesAMover, 1);
        assert.equal(preview.jobsAMover, 1);
        assert.equal(preview.notasAMover, 1);
        assert.equal(preview.nifDistintos, true, '🔴 NIF distintos tiene que avisar');
        assert.deepEqual([...preview.etiquetasResultantes].sort(), ['moroso', 'urgente'], '🔴 la vista previa fusiona etiquetas sin distinguir mayúsculas');
        // Nada se ha movido todavía: el job sigue en el fusionado.
        const jobSinTocar = await prisma.job.findUnique({ where: { id: job.id } });
        assert.equal(jobSinTocar.customerId, fusionado.id, '🔴 previsualizarFusion NO puede escribir nada');

        // ── La fusión de verdad ──
        const r = await fusionarClientes(a.id, principal.id, fusionado.id);
        assert.equal(r.quotesMovidos, 1);
        assert.equal(r.jobsMovidos, 1);
        assert.equal(r.notasMovidas, 1);
        assert.equal(r.nifDistintos, true);

        // Las nueve tablas apuntan ahora al PRINCIPAL.
        const [quoteR, jobR, notaR, chargeR, solicitudR, parteR, waR, correoR, mantenimientoR] = await Promise.all([
          prisma.quote.findUnique({ where: { id: quote.id } }),
          prisma.job.findUnique({ where: { id: job.id } }),
          prisma.customerEvent.findUnique({ where: { id: nota.id } }),
          prisma.charge.findUnique({ where: { id: charge.id } }),
          prisma.quoteRequest.findUnique({ where: { id: solicitud.id } }),
          prisma.parteTrabajo.findUnique({ where: { id: parte.id } }),
          prisma.whatsAppMessage.findUnique({ where: { id: wa.id } }),
          prisma.emailMessage.findUnique({ where: { id: correo.id } }),
          prisma.maintenancePlan.findUnique({ where: { id: mantenimiento.id } }),
        ]);
        for (const [nombre, fila] of [
          ['quote', quoteR], ['job', jobR], ['customerEvent (nota vieja)', notaR], ['charge', chargeR],
          ['quoteRequest', solicitudR], ['parteTrabajo', parteR], ['whatsAppMessage', waR],
          ['emailMessage', correoR], ['maintenancePlan', mantenimientoR],
        ]) {
          assert.equal(fila.customerId, principal.id, `🔴 ${nombre} se quedó apuntando al fusionado (borrado): quedaría huérfano`);
        }

        // El apunte en el historial del que queda.
        const eventos = await prisma.customerEvent.findMany({ where: { merchantId: a.id, customerId: principal.id }, orderBy: { id: 'asc' } });
        const apunte = eventos.find((e) => e.type === 'fusion');
        assert.ok(apunte, '🔴 no queda ningún apunte de la fusión en el historial del principal');
        assert.equal(apunte.meta?.fusionadoId, fusionado.id);

        // Las etiquetas del PRINCIPAL son la unión, sin distinguir mayúsculas.
        const principalR = await prisma.customer.findUnique({ where: { id: principal.id }, select: { tags: true } });
        assert.deepEqual([...principalR.tags].sort(), ['moroso', 'urgente']);

        // El fusionado DESAPARECE (aceptación 5).
        const fusionadoR = await prisma.customer.findUnique({ where: { id: fusionado.id } });
        assert.equal(fusionadoR, null, '🔴 el cliente fusionado sigue existiendo tras la fusión');

        // El que apuntaba al fusionado como su empresa queda DESVINCULADO, no huérfano.
        const empleadoR = await prisma.customer.findUnique({ where: { id: empleado.id }, select: { companyId: true } });
        assert.equal(empleadoR.companyId, null, '🔴 un cliente que apuntaba al fusionado como empresa queda con un companyId muerto');
      }));
  } finally {
    await prisma.$disconnect();
  }
});

test('SCRUM-1057 · 🔴 CUALQUIERA de los dos con una factura EMITIDA rechaza la fusión, y no toca nada', { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { fusionarClientes } = await import('../dist/modules/system/domain/fusionClientes.js');
  const stamp = Date.now();
  try {
    await withMerchant(prisma, { name: 'QA 1057c', email: `qa-1057c-${stamp}@test.local` }, async (a) => {
      const principal = await prisma.customer.create({ data: { merchantId: a.id, name: 'Con factura' } });
      const fusionado = await prisma.customer.create({ data: { merchantId: a.id, name: 'Sin factura' } });
      const job = await prisma.job.create({ data: { merchantId: a.id, customerId: fusionado.id } });
      await prisma.invoice.create({
        data: {
          merchantId: a.id, customerId: principal.id, total: '100.00', currency: 'EUR',
          number: `F-1057-${stamp}`, status: 'pending', pdfUrl: '/x/f.pdf', qrData: 'x',
        },
      });

      await assert.rejects(() => fusionarClientes(a.id, principal.id, fusionado.id), /factura_emitida/,
        '🔴 con una factura emitida en CUALQUIERA de los dos, la fusión tiene que rechazarse');

      // Nada se movió: los dos clientes siguen existiendo y el job sigue en el fusionado.
      assert.ok(await prisma.customer.findUnique({ where: { id: fusionado.id } }), '🔴 el fusionado se borró pese al rechazo');
      const jobTrasRechazo = await prisma.job.findUnique({ where: { id: job.id } });
      assert.equal(jobTrasRechazo.customerId, fusionado.id, '🔴 se movió algo pese a que la fusión debía rechazarse');
    });
  } finally {
    await prisma.$disconnect();
  }
});

test('SCRUM-1057 · 🔴 fusionar un cliente CONSIGO MISMO se rechaza sin tocar nada', { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { fusionarClientes } = await import('../dist/modules/system/domain/fusionClientes.js');
  const stamp = Date.now();
  try {
    await withMerchant(prisma, { name: 'QA 1057e', email: `qa-1057e-${stamp}@test.local` }, async (a) => {
      const cliente = await prisma.customer.create({ data: { merchantId: a.id, name: 'Yo mismo', tags: ['x'] } });
      await assert.rejects(() => fusionarClientes(a.id, cliente.id, cliente.id), /mismo_cliente/,
        '🔴 fusionar un cliente consigo mismo tiene que rechazarse, aunque exista y no tenga facturas');
      const releido = await prisma.customer.findUnique({ where: { id: cliente.id } });
      assert.ok(releido, '🔴 el cliente desapareció al "fusionarlo" consigo mismo');
      assert.deepEqual(releido.tags, ['x'], '🔴 sus propias etiquetas no deben tocarse');
    });
  } finally {
    await prisma.$disconnect();
  }
});

test('SCRUM-1057 · tenencia: un cliente de OTRO merchant no se puede usar en la fusión', { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { fusionarClientes } = await import('../dist/modules/system/domain/fusionClientes.js');
  const stamp = Date.now();
  try {
    await withMerchant(prisma, { name: 'QA 1057d A', email: `qa-1057d-a-${stamp}@test.local` }, (a) =>
      withMerchant(prisma, { name: 'QA 1057d B', email: `qa-1057d-b-${stamp}@test.local` }, async (b) => {
        const principal = await prisma.customer.create({ data: { merchantId: a.id, name: 'De A' } });
        const deOtroMerchant = await prisma.customer.create({ data: { merchantId: b.id, name: 'De B' } });
        await assert.rejects(() => fusionarClientes(a.id, principal.id, deOtroMerchant.id), /cliente_no_encontrado/,
          '🔴 un id de otro merchant no puede fusionarse — y el mensaje no debe decir que existe en otro sitio');
        assert.ok(await prisma.customer.findUnique({ where: { id: deOtroMerchant.id } }), '🔴 se borró un cliente de OTRO merchant');
      }));
  } finally {
    await prisma.$disconnect();
  }
});
