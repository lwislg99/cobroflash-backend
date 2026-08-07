// tests/scrum295-modelo-303-postgres.test.mjs — SCRUM-295 (A5) · el 303 contra Postgres.
//
// Dos cosas que un doble no puede comprobar y aquí se juegan enteras:
//
//   1. **Que la factura de otro merchant no entre en el 303.** Meter la facturación de un tercero
//      en una declaración no es una fuga de datos: es declarar como propio lo que no lo es.
//   2. **Que el trimestre incluya sus bordes DE VERDAD**, con el filtro de fechas resolviéndose
//      en Postgres y no en JavaScript. El `gte`/`lte` del `where` es el que decide, y el error de
//      un milisegundo solo se ve en abril.
//
// Cómo se corre (banco local desechable, nunca una base del proyecto):
//   LIBRO_PG_URL="postgresql://postgres@127.0.0.1:55432/yaqu_libro_test" \
//     node --test tests/scrum295-modelo-303-postgres.test.mjs
//
// El procedimiento del banco está en `docs/master/SCRUM-296.md` (tramo 2). El gate NO es «si hay
// URL, adelante»: este test crea y borra filas, así que exige loopback y base terminada en
// `_test`, y si no, FALLA — no se salta.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs';

const URL_BANCO = process.env.LIBRO_PG_URL || '';
const ENABLED = URL_BANCO !== '';
const PROHIBIDAS = ['railway', 'yaqu_dev', 'yaqu_dev_javier', 'postgres', 'staging', 'prod'];
const SELLO = `q${process.pid}`;

function exigirBancoDesechable(url) {
  const p = parseBDSegura(url);
  assert.ok(p, '🔴 LIBRO_PG_URL no es una URL legible. No se toca nada.');
  assert.ok(['127.0.0.1', 'localhost', '::1'].includes(p.host),
    `🔴 LIBRO_PG_URL apunta a «${p.host}», que no es loopback. Este test CREA Y BORRA filas.`);
  assert.ok(p.base.endsWith('_test'),
    `🔴 la base «${p.base}» no termina en «_test»: es la única garantía POR LA FORMA del nombre ` +
    'de que no es una base del proyecto.');
  assert.ok(!PROHIBIDAS.includes(p.base), `🔴 «${p.base}» está en la lista de bases del proyecto.`);
  return `${p.host}:${p.puerto}/${p.base}`;
}

async function factura(prisma, { merchantId, customerId, number, createdAt, lines, status = 'pending' }) {
  const inv = await prisma.invoice.create({
    data: {
      merchantId, customerId, number, status,
      total: '121.00', currency: 'EUR',
      pdfUrl: `https://qa.invalid/${number}.pdf`, qrData: `QR-${number}`,
      lines,
    },
  });
  // `createdAt` tiene `@default(now())`: para colocar una factura EN EL BORDE del trimestre hay
  // que fijarlo después. Es dato de prueba, no del camino de emisión (regla 38).
  //
  // ⚠️ POR PRISMA, NUNCA POR SQL CRUDA, y lo aprendí fallando. `invoices."createdAt"` es un
  // `timestamp WITHOUT time zone` y Prisma guarda ahí **UTC**; un `$executeRawUnsafe` con un
  // `Date` lo escribe como la hora de PARED LOCAL, así que la fila queda 2 h corrida y una
  // factura del borde se cambia de trimestre. El primer rojo de este test fue eso: la del
  // 1 de abril a las 00:00 se declaraba en el 1T. Escribiendo por el mismo camino que usa la
  // aplicación, la conversión es la misma en la escritura y en la lectura.
  if (createdAt) {
    await prisma.invoice.update({ where: { id: inv.id }, data: { createdAt } });
  }
  return inv;
}

test('SCRUM-295 · CONTRA POSTGRES: el 303 de un merchant no declara NI UN euro del otro',
  { skip: !ENABLED && 'sin LIBRO_PG_URL (banco local); los guards sin base corren igual en npm test' },
  async (t) => {
    t.diagnostic(`banco: ${exigirBancoDesechable(URL_BANCO)}`);

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({ datasourceUrl: URL_BANCO });
    const { leerModelo303 } = await import('../dist/modules/fiscal/modelo303/modelo303.repo.js');
    const { leerLibroRegistro } = await import('../dist/modules/invoicing/domain/libroRegistro.repo.js');

    try {
      await withMerchant(prisma, { name: `QA 303 MIO ${SELLO}`, email: `m303.${SELLO}@qa.invalid` }, async (mio) => {
      await withMerchant(prisma, { name: `QA 303 OTRO ${SELLO}`, email: `o303.${SELLO}@qa.invalid` }, async (otro) => {
        const cliMio  = await prisma.customer.create({ data: { merchantId: mio.id,  name: 'Cliente MIO',  phone: `+34611${String(mio.id).padStart(6, '0')}` } });
        const cliOtro = await prisma.customer.create({ data: { merchantId: otro.id, name: 'Cliente OTRO', phone: `+34622${String(otro.id).padStart(6, '0')}` } });

        const L21 = [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 }]; // base 100 · cuota 21
        const L10 = [{ concept: 'Material',     qty: 1, price: 200, tax: 0.10 }]; // base 200 · cuota 20

        // ── Los BORDES del 2T de 2026, en hora LOCAL ────────────────────────────────────────
        const primerInstante = new Date(2026, 3, 1, 0, 0, 0, 0);
        const ultimoInstante = new Date(2026, 5, 30, 23, 59, 59, 999);
        const unMsAntes      = new Date(primerInstante.getTime() - 1);
        const unMsDespues    = new Date(ultimoInstante.getTime() + 1);

        await factura(prisma, { merchantId: mio.id, customerId: cliMio.id, number: `BORDE-INI-${SELLO}`, createdAt: primerInstante, lines: L21 });
        await factura(prisma, { merchantId: mio.id, customerId: cliMio.id, number: `BORDE-FIN-${SELLO}`, createdAt: ultimoInstante, lines: L10, status: 'paid' });
        await factura(prisma, { merchantId: mio.id, customerId: cliMio.id, number: `FUERA-ANTES-${SELLO}`, createdAt: unMsAntes,   lines: L21 });
        await factura(prisma, { merchantId: mio.id, customerId: cliMio.id, number: `FUERA-DESPUES-${SELLO}`, createdAt: unMsDespues, lines: L21 });

        // El otro merchant, con facturas DENTRO del mismo trimestre: si el filtro fallara, sus
        // euros se sumarían a la declaración ajena.
        for (const n of ['1', '2']) {
          await factura(prisma, { merchantId: otro.id, customerId: cliOtro.id, number: `XX-${SELLO}-${n}`, createdAt: new Date(2026, 4, 15, 10, 0, 0), lines: L21 });
        }

        const m303 = await leerModelo303(prisma, { merchantId: mio.id, año: 2026, trimestre: 2 });

        // ── SUELO ───────────────────────────────────────────────────────────────────────────
        assert.ok(m303.miradas >= 2,
          `🔴 el 303 solo miró ${m303.miradas} facturas habiendo dos dentro del trimestre. Un 303 ` +
          'a cero no se lee como «no encontré nada»: se lee como que no facturaste.');

        // ── BORDES: las dos de dentro SÍ, las dos de fuera NO ────────────────────────────────
        assert.equal(m303.asientos, 2,
          `🔴 el trimestre no trae exactamente las dos facturas de sus bordes (trajo ${m303.asientos}). ` +
          'Un milisegundo de más deja una factura sin declarar, o la declara dos veces.');

        const casillaDe = (n) => {
          for (const c of m303.casillas) {
            if (c.casillaBase === n) return c.base;
            if (c.casillaCuota === n) return c.cuota;
          }
          return undefined;
        };
        assert.equal(casillaDe(7), 100,
          '🔴 la factura del PRIMER instante del trimestre (00:00:00.000 del 1 de abril) no está ' +
          'declarada: se ha caído entre dos trimestres.');
        assert.equal(casillaDe(4), 200,
          '🔴 la factura del ÚLTIMO instante (23:59:59.999 del 30 de junio) no está declarada.');
        assert.equal(m303.casillaTotalCuota.valor, 41,
          '🔴 la casilla 27 no es 21 + 20: o falta un borde, o ha entrado algo de fuera.');

        // ── CONTROL NEGATIVO ────────────────────────────────────────────────────────────────
        assert.equal(m303.totalBase, 300,
          '🔴 la base declarada no es la de las dos facturas propias del trimestre: han entrado ' +
          'euros de OTRO merchant o de otro periodo.');

        const otroM303 = await leerModelo303(prisma, { merchantId: otro.id, año: 2026, trimestre: 2 });
        assert.equal(otroM303.totalBase, 200,
          '🔴 el 303 del OTRO merchant no cuadra con lo suyo: la fuga existe en las dos direcciones.');

        // ── EL CUADRE CON EL LIBRO, CONTRA LA BASE Y AL CÉNTIMO ─────────────────────────────
        const { desde, hasta } = { desde: primerInstante, hasta: ultimoInstante };
        const libro = await leerLibroRegistro(prisma, { merchantId: mio.id, desde, hasta });
        const r2 = (n) => Math.round(n * 100) / 100;
        const baseLibro  = r2(libro.asientos.reduce((a, s) => a + (s.base ?? 0), 0));
        const cuotaLibro = r2(libro.asientos.reduce((a, s) => a + (s.cuota ?? 0), 0));
        const baseDeclarada  = r2(m303.totalBase + m303.sinClasificar.reduce((a, o) => a + o.base, 0));
        const cuotaDeclarada = r2(m303.casillaTotalCuota.valor + m303.sinClasificar.reduce((a, o) => a + o.cuota, 0));

        assert.ok(baseLibro > 0, '🔴 el libro sale vacío: el cuadre de abajo compararía dos ceros.');
        assert.equal(baseDeclarada, baseLibro,
          `🔴 la base del 303 (${baseDeclarada}) y la del libro (${baseLibro}) no cuadran CONTRA LA ` +
          'BASE. Son dos documentos oficiales del mismo trimestre: si difieren, uno miente y nadie ' +
          'sabe cuál.');
        assert.equal(cuotaDeclarada, cuotaLibro,
          `🔴 la cuota del 303 (${cuotaDeclarada}) y la del libro (${cuotaLibro}) no cuadran.`);

        // ── El cruce con los cobros: una de las dos consta cobrada ───────────────────────────
        assert.equal(m303.cruceConCobros.asientosCobrados, 1);
        assert.equal(m303.cruceConCobros.cuotaDeCobradas, 20,
          '🔴 el cruce no separa la cuota ya cobrada de la que se declara sin haber cobrado.');
        assert.equal(m303.cruceConCobros.cuotaDeNoCobradas, 21);
      });
      });
    } finally {
      await prisma.$disconnect();
    }
  });
