// tests/scrum389-un-solo-iva.test.mjs — SCRUM-389 · UN SOLO agregador de IVA repercutido.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO QUE CIERRA
//
// `GET /admin/reports/vat` llevaba tiempo calculando el IVA repercutido POR SU PROPIO CAMINO, y
// el 303 (SCRUM-295) lo calcula desde el Libro (SCRUM-296). Dos derivaciones de la misma cifra.
// Un profesional podía ver **dos cifras oficiales distintas en dos pantallas**, las dos con
// aspecto de buenas — y a Hacienda se entrega una sola.
//
// Este fichero es el test de A5 extendido a la tercera pantalla: **las tres salidas, el mismo
// periodo, y falla si difieren en UN CÉNTIMO**.
//
// ⚠️ El handler de Informes se invoca DE VERDAD (se carga el router de `dist` y se le pasa un
// `req`/`res` de mentira). Una réplica del cálculo mediría mi réplica, no la pantalla.
//
// Corre contra el banco local desechable:
//   LIBRO_PG_URL="postgresql://postgres@127.0.0.1:55432/yaqu_libro_test" node --test <este fichero>
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs';

const URL_BANCO = process.env.LIBRO_PG_URL || '';
const ENABLED = URL_BANCO !== '';
const PROHIBIDAS = ['railway', 'yaqu_dev', 'yaqu_dev_javier', 'postgres', 'staging', 'prod'];
const SELLO = `u${process.pid}`;
const r2 = (n) => Math.round(n * 100) / 100;

function exigirBancoDesechable(url) {
  const p = parseBDSegura(url);
  assert.ok(p, '🔴 LIBRO_PG_URL no es una URL legible.');
  assert.ok(['127.0.0.1', 'localhost', '::1'].includes(p.host),
    `🔴 «${p.host}» no es loopback y este test crea y borra filas.`);
  assert.ok(p.base.endsWith('_test'), `🔴 la base «${p.base}» no termina en «_test».`);
  assert.ok(!PROHIBIDAS.includes(p.base), `🔴 «${p.base}» es una base del proyecto.`);
  return `${p.host}:${p.puerto}/${p.base}`;
}

/** El router REAL de Informes. `dist` es CJS: el default queda anidado al importarlo desde ESM. */
async function routerDeInformes() {
  const mod = await import('../dist/modules/reports/app/routes/reports.routes.js');
  const r = mod.default?.stack ? mod.default : mod.default?.default;
  assert.ok(r?.stack,
    '🔴 no he podido cargar el router de Informes: este test no estaría midiendo la pantalla, y ' +
    'un verde así solo diría que sé construir un objeto vacío.');
  return r;
}

function llamarVat(router, merchantId, year, quarter) {
  const capa = router.stack.find((l) => l.route?.path === '/vat');
  assert.ok(capa, '🔴 la ruta /vat ya no existe en el router de Informes.');
  return new Promise((resolve, reject) => {
    capa.route.stack[0].handle(
      { merchantId, query: { year, quarter } },
      { json: resolve, status: (c) => ({ json: (b) => reject(new Error(`HTTP ${c}: ${JSON.stringify(b)}`)) }) },
      reject,
    );
  });
}

/** Las tres cifras del mismo trimestre, cada una por su puerta. */
async function lasTres(prisma, merchantId, { año = 2026, trimestre = 2 } = {}) {
  const { leerLibroRegistro } = await import('../dist/modules/invoicing/domain/libroRegistro.repo.js');
  const { leerModelo303 } = await import('../dist/modules/fiscal/modelo303/modelo303.repo.js');
  const { rangoTrimestre } = await import('../dist/modules/fiscal/modelo303/modelo303.js');
  const { desde, hasta } = rangoTrimestre(año, trimestre);

  const informes = await llamarVat(await routerDeInformes(), merchantId, año, trimestre);
  const libro = await leerLibroRegistro(prisma, { merchantId, desde, hasta });
  const m303 = await leerModelo303(prisma, { merchantId, año, trimestre });

  return {
    informes,
    libro,
    m303,
    // La cifra comparable de cada uno. En el 303, lo declarado incluye lo apartado como no
    // clasificable: si no, se compararía el 303 con una parte del libro.
    cifras: {
      Informes: { base: informes.totals.base, cuota: informes.totals.cuota },
      Libro: {
        base: r2(libro.asientos.reduce((a, s) => a + (s.base ?? 0), 0)),
        cuota: r2(libro.asientos.reduce((a, s) => a + (s.cuota ?? 0), 0)),
      },
      Modelo303: {
        base: r2(m303.totalBase + m303.sinClasificar.reduce((a, o) => a + o.base, 0)),
        cuota: r2(m303.casillaTotalCuota.valor + m303.sinClasificar.reduce((a, o) => a + o.cuota, 0)),
      },
    },
  };
}

/** Siembra facturas en el 2T de 2026 y devuelve el merchant. */
async function sembrar(prisma, merchantId, customerId, juego) {
  let i = 0;
  for (const { lines, createdAt } of juego) {
    i += 1;
    const inv = await prisma.invoice.create({
      data: {
        merchantId, customerId,
        number: `2026-CF-${SELLO}-${String(i).padStart(3, '0')}`,
        total: '0', currency: 'EUR', pdfUrl: 'x', qrData: 'x', lines,
      },
    });
    // Por Prisma, nunca por SQL cruda: `createdAt` es `timestamp WITHOUT time zone` y Prisma
    // guarda UTC ahí; una cruda escribiría la hora local y correría la factura de trimestre
    // (medido en SCRUM-295).
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { createdAt: createdAt ?? new Date(2026, 4, 12, 10, 0, 0) },
    });
  }
}

const JUEGO = [
  { lines: [{ concept: 'Mano de obra', qty: 3, price: 33.33, tax: 0.21 }] },
  { lines: [{ concept: 'Material',     qty: 7, price: 12.35, tax: 0.21 }] },
  { lines: [{ concept: 'Desplaz.',     qty: 1, price: 19.99, tax: 0.10 }] },
  { lines: [{ concept: 'Vivienda',     qty: 1, price: 999.99, tax: 0.04 }] },
  { lines: [{ concept: 'Horas',        qty: 11, price: 7.77, tax: 0.21 }] },
  { lines: [{ concept: 'Exento?',      qty: 1, price: 150, tax: 0 }] },   // sin calificación
  { lines: [] },                                                          // sin desglose
  // Los bordes: primero y último instante del 2T.
  { lines: [{ concept: 'Borde ini', qty: 1, price: 50, tax: 0.21 }], createdAt: new Date(2026, 3, 1, 0, 0, 0, 0) },
  { lines: [{ concept: 'Borde fin', qty: 1, price: 60, tax: 0.10 }], createdAt: new Date(2026, 5, 30, 23, 59, 59, 999) },
];

test('SCRUM-389 · LAS TRES PANTALLAS dan la MISMA cifra del mismo trimestre, al céntimo',
  { skip: !ENABLED && 'sin LIBRO_PG_URL (banco local)' },
  async (t) => {
    t.diagnostic(`banco: ${exigirBancoDesechable(URL_BANCO)}`);
    const { PrismaClient } = await import('@prisma/client');
    // El router de Informes usa el `prisma` singleton, que lee DATABASE_URL: se apunta al banco
    // YA validado. Sin esto iría a donde dijera el entorno.
    process.env.DATABASE_URL = URL_BANCO;
    const prisma = new PrismaClient({ datasourceUrl: URL_BANCO });

    try {
      await withMerchant(prisma, { name: `QA 389 ${SELLO}`, email: `u389.${SELLO}@qa.invalid` }, async (m) => {
        const cli = await prisma.customer.create({ data: { merchantId: m.id, name: 'c', phone: `+34655${String(m.id).padStart(6, '0')}` } });
        await sembrar(prisma, m.id, cli.id, JUEGO);

        const { cifras, libro } = await lasTres(prisma, m.id);

        // ── SUELO: dos ceros cuadran siempre ────────────────────────────────────────────────
        assert.ok(libro.miradas >= JUEGO.length,
          `🔴 solo se miraron ${libro.miradas} facturas de ${JUEGO.length}: el cuadre de abajo no ` +
          'estaría comparando nada.');
        assert.ok(cifras.Libro.base > 0 && cifras.Libro.cuota > 0,
          '🔴 el caso no genera importes. DOS CEROS CUADRAN SIEMPRE, y este test daría verde ' +
          'sobre tres pantallas rotas.');

        // ── EL CUADRE ───────────────────────────────────────────────────────────────────────
        const nombres = Object.keys(cifras);
        for (const campo of ['base', 'cuota']) {
          const valores = nombres.map((n) => cifras[n][campo]);
          const distintos = [...new Set(valores)];
          assert.equal(distintos.length, 1,
            `🔴 las tres pantallas NO dicen lo mismo en «${campo}»:\n` +
            nombres.map((n) => `     ${n.padEnd(10)} ${cifras[n][campo].toFixed(2)} €`).join('\n') +
            '\n\n  Son tres vistas de la MISMA cifra del mismo trimestre. Si difieren, el ' +
            'profesional\n  tiene dos documentos oficiales contradictorios y a Hacienda se ' +
            'entrega uno solo.');
        }
      });
    } finally {
      await prisma.$disconnect();
    }
  });

test('SCRUM-389 · CONTROL POSITIVO: Informes sigue enseñando lo mismo, campo por campo',
  { skip: !ENABLED && 'sin LIBRO_PG_URL (banco local)' },
  async () => {
    // Una unificación que cambia lo que ve el usuario sin avisar es peor que la duplicación.
    // Los valores de abajo están calculados A MANO sobre `JUEGO`, no copiados de la salida:
    //
    //   21 %: 3×33,33 = 99,99 → 21,00 | 7×12,35 = 86,45 → 18,15 | 11×7,77 = 85,47 → 17,95
    //         + borde ini 50,00 → 10,50        base 321,91 · cuota 67,60
    //   10 %: 19,99 → 2,00 | borde fin 60,00 → 6,00   base  79,99 · cuota  8,00
    //    4 %: 999,99 → 40,00                          base 999,99 · cuota 40,00
    //    0 %: 150,00 → 0,00                           base 150,00 · cuota  0,00
    //   TOTAL base 1.551,89 · cuota 115,60 · 1 factura sin desglose
    const { PrismaClient } = await import('@prisma/client');
    process.env.DATABASE_URL = URL_BANCO;
    const prisma = new PrismaClient({ datasourceUrl: URL_BANCO });
    try {
      await withMerchant(prisma, { name: `QA 389b ${SELLO}`, email: `u389b.${SELLO}@qa.invalid` }, async (m) => {
        const cli = await prisma.customer.create({ data: { merchantId: m.id, name: 'c', phone: `+34666${String(m.id).padStart(6, '0')}` } });
        await sembrar(prisma, m.id, cli.id, JUEGO);
        const vat = await llamarVat(await routerDeInformes(), m.id, 2026, 2);

        assert.deepEqual(vat.rates, [
          { rate: 21, base: 321.91, cuota: 67.60 },
          { rate: 10, base: 79.99,  cuota: 8.00 },
          { rate: 4,  base: 999.99, cuota: 40.00 },
          { rate: 0,  base: 150.00, cuota: 0.00 },
        ], '🔴 la tabla de Informes ya no enseña lo mismo: el desglose por tipo ha cambiado. ' +
           'Los valores de este test están calculados a mano, no copiados de la salida.');
        assert.deepEqual(vat.totals, { base: 1551.89, cuota: 115.60 },
          '🔴 el TOTAL del cuadro de Informes ha cambiado.');
        assert.equal(vat.invoiceCount, JUEGO.length,
          '🔴 el recuento de facturas del periodo ha cambiado.');
        assert.deepEqual(vat.excluded, { count: 1, total: 0 },
          '🔴 el aviso de «facturas no incluidas en el cuadro» ha cambiado.');
        assert.equal(vat.currency, 'EUR');
        assert.equal(vat.from, new Date(2026, 3, 1, 0, 0, 0, 0).toISOString().slice(0, 10));
        assert.equal(vat.year, 2026);
        assert.equal(vat.quarter, 2);
      });
    } finally {
      await prisma.$disconnect();
    }
  });
