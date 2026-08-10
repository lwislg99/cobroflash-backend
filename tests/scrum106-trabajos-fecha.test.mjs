// SCRUM-106 — trabajos.csv filtra por FECHA DE EJECUCIÓN prevista (scheduledAt), no por
// fecha de alta. Decisión del fundador, opción C.
//
// ⚠️ EL TEST QUE DA VALOR es el SIMÉTRICO (el segundo): un trabajo en `pendiente_agendar`
// (scheduledAt null) NO sale en ningún rango. Sin él, "incluir todos los trabajos" pasaría
// igual el caso principal, y no sabríamos si el filtro hace algo (SCRUM-108).
//
// Datos EFÍMEROS propios, limpieza en el finally — nunca el seed demo (SCRUM-63).
//
// ⚠️ GATEADO (crea y BORRA merchants efímeros):
//   QA_DB_TEST=1 npm run test:staging
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-106: trabajos.csv por fecha de EJECUCIÓN — el de junio ejecutado en julio sale en julio', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { buildTrabajos, CAMPO_FECHA_TRABAJOS } =
    await import('../dist/modules/exports/domain/exportData.js');

  assert.equal(CAMPO_FECHA_TRABAJOS, 'scheduledAt',
    'el criterio debe ser la fecha de ejecución prevista (SCRUM-106, opción C)');

  const stamp = Date.now();

  const JUNIO = new Date('2026-06-28T09:00:00Z');
  const JULIO = new Date('2026-07-10T08:00:00Z');
  const RANGO_JULIO = { from: new Date('2026-07-01T00:00:00Z'), to: new Date('2026-07-31T23:59:59Z') };
  const RANGO_JUNIO = { from: new Date('2026-06-01T00:00:00Z'), to: new Date('2026-06-30T23:59:59Z') };

  // SCRUM-113 (migrado por el carril B; ver aviso en SCRUM-113): el merchant y su montaje
  // dentro de withMerchant. El finally de este fichero ya estaba AISLADO con .catch() por
  // operación — eso estaba bien —, pero el merchant nacía fuera del try, así que un fallo
  // montando el cliente o los jobs lo dejaba huérfano sin que el finally llegara a correr.
  try {
    await withMerchant(prisma, {
      name: `QA S106 ${stamp}`, email: `qa-s106-${stamp}@test.local`,
    }, async (merchant) => {
      const cliente = await prisma.customer.create({
        data: { merchantId: merchant.id, name: `Cliente S106 ${stamp}`, phone: '34000000032' },
      });

      // (A) EL CASO DEL TICKET: presupuestado/creado en JUNIO, ejecutado en JULIO.
      const ejecutadoEnJulio = await prisma.job.create({
        data: {
          merchantId: merchant.id, customerId: cliente.id, status: 'terminado',
          titulo: `EJECUTADO-EN-JULIO-${stamp}`,
          createdAt: JUNIO,      // alta en junio
          scheduledAt: JULIO,    // ejecución en julio
          totalAceptado: '1000.00', totalCobrado: '1000.00',
        },
      });

      // (B) EL SIMÉTRICO: nunca agendado. En la app real esto es `pendiente_agendar`, el
      // ÚNICO estado que puede tener scheduledAt null (la FSM impide llegar a en_curso sin
      // pasar por agendado, y agendado exige fecha).
      const sinAgendar = await prisma.job.create({
        data: {
          merchantId: merchant.id, customerId: cliente.id, status: 'pendiente_agendar',
          titulo: `SIN-AGENDAR-${stamp}`,
          createdAt: JULIO,      // dado de alta DENTRO del rango de julio, a propósito
          scheduledAt: null,
          totalAceptado: '500.00',
        },
      });

      // ── (A) sale en JULIO, que es donde está su factura ─────────────────────
      const julio = await buildTrabajos(merchant.id, RANGO_JULIO);
      const textoJulio = julio.rows.join('\n');
      assert.ok(textoJulio.includes(ejecutadoEnJulio.titulo),
        `el trabajo EJECUTADO en julio debe salir en el paquete de julio:\n${textoJulio}`);

      // ── (A) y NO en junio, aunque se diera de alta entonces ─────────────────
      const junio = await buildTrabajos(merchant.id, RANGO_JUNIO);
      assert.ok(!junio.rows.join('\n').includes(ejecutadoEnJulio.titulo),
        'ya NO debe salir en junio: en junio todavía no se había hecho');

      // ── (B) EL SIMÉTRICO — el que evita que "incluir todos" pase por bueno ──
      // Ojo al detalle: su fecha de ALTA cae DENTRO de julio. Con el criterio viejo habría
      // salido; con el nuevo no sale, porque no tiene fecha de ejecución.
      assert.ok(!textoJulio.includes(sinAgendar.titulo),
        `un trabajo sin agendar NO debe salir, ni siquiera si su ALTA cae en el rango:\n${textoJulio}`);
      assert.ok(!junio.rows.join('\n').includes(sinAgendar.titulo),
        'ni en junio ni en ningún otro rango acotado');

      // ── SIN rango: no hay filtro de fechas, así que salen los dos ───────────
      // Es coherente con el resto de builders (sin rango = todo) y con lo que dice el LEEME
      // en ese caso. Se comprueba para que el "no sale" de arriba sea del FILTRO y no de que
      // el trabajo no exista o el builder lo esté perdiendo por otra razón.
      const todo = await buildTrabajos(merchant.id, { from: null, to: null });
      const textoTodo = todo.rows.join('\n');
      assert.ok(textoTodo.includes(ejecutadoEnJulio.titulo), 'sin rango debe salir el ejecutado');
      assert.ok(textoTodo.includes(sinAgendar.titulo),
        'sin rango también sale el no agendado — si no, el problema no era el filtro de fechas');

      t.diagnostic('ejecución en julio ✓ · ya no en junio ✓ · sin agendar fuera de todo rango ✓ · sin rango salen ambos ✓');
    });
  } finally {
    // Solo lo que NO es del merchant: el borrado de datos lo garantiza withMerchant.
    await prisma.$disconnect();
  }
});
