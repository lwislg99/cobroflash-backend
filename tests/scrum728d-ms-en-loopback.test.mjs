// tests/scrum728d-ms-en-loopback.test.mjs — SCRUM-728d (medición en CI)
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LOS MILISEGUNDOS, EN LOOPBACK — donde el RTT es ~0 y sale el COSTE DE TRABAJO limpio.
//
// SCRUM-728 midió 880 ms contra una base remota y no pudo separar las dos cosas que ahí vienen
// sumadas: el trabajo del servidor y los viajes de red. En loopback el RTT es despreciable, así
// que **lo que quede es trabajo**. Con eso y un RTT, el umbral del ticket deja de ser una
// extrapolación y pasa a ser dos números medidos y una suma:
//
//     tiempo(N simultáneas) ≈ N × (trabajo + viajes × RTT)
//                                  ↑ AQUÍ        ↑ el conteo de `_viajes-de-la-reserva.mjs`
//
// ── POR QUÉ NO ASEVERA MILISEGUNDOS ────────────────────────────────────────────────────────
//
// Un umbral de tiempo en CI es un rojo falso esperando a pasar: el runner comparte máquina y su
// carga no la decide nadie. Aquí **se mide y se REPORTA** (`t.diagnostic`, visible en el log del
// job), y lo único que se asevera es lo que no depende del reloj: que la medición se hizo, que
// las reservas no se duplicaron y que la serialización ocurrió. El número lo lee una persona.
//
// ── EL VIAJE QUE ESCALA: SU PENDIENTE, QUE HOY NO SABE NADIE ───────────────────────────────
//
// `allocateInvoiceNumber` deriva la secuencia F leyendo **la serie F entera del año**. Se mide con
// 10, 100 y 1.000 filas para saber si crece lineal — es el único coste que empeora solo, sin que
// cambie la red, y por tanto el único que el RTT no puede disculpar.
//
// 🔴 ESTO MIDE. NO ARREGLA NADA. `invoiceNumber.service.ts` se LLAMA, no se modifica (regla 38 /
// AA1.4): el arreglo necesita el visto bueno del fundador con estos números delante.
//
// CÓMO SE CORRE (CI lo hace solo en cada PR, `ci.yml`, servicio `postgres:16-alpine`):
//   LIBRO_PG_URL="postgresql://postgres@127.0.0.1:55432/yaqu_libro_test" npm test
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs';

const URL_BANCO = process.env.LIBRO_PG_URL || '';
const ENABLED = URL_BANCO !== '';

/** Bases que este test NO puede tocar jamás, aunque alguien apunte la variable ahí. */
const PROHIBIDAS = ['railway', 'yaqu_dev', 'yaqu_dev_javier', 'postgres', 'staging', 'prod'];

/**
 * Fail-closed: devuelve la etiqueta segura del banco o LANZA. Nunca imprime la URL — un mensaje
 * de error con la URL dentro lleva la contraseña dentro (SCRUM-226).
 */
function exigirBancoDesechable(url) {
  const p = parseBDSegura(url);
  assert.ok(p, '🔴 LIBRO_PG_URL no es una URL legible. No se toca nada.');
  assert.ok(['127.0.0.1', 'localhost', '::1'].includes(p.host),
    `🔴 LIBRO_PG_URL apunta a «${p.host}», que no es loopback. Este test CREA Y BORRA filas: `
    + 'solo puede correr contra un banco local desechable.');
  assert.ok(p.base.endsWith('_test'),
    `🔴 la base «${p.base}» no termina en «_test». Es la única forma de garantizar por la FORMA `
    + 'del nombre —no por la buena intención de quien lanza el test— que no es una base del proyecto.');
  assert.ok(!PROHIBIDAS.includes(p.base),
    `🔴 la base «${p.base}» está en la lista de bases del proyecto. Aquí no se toca.`);
  return `${p.host}:${p.puerto}/${p.base}`;
}

const ms = (n) => `${n.toFixed(1)} ms`;
const mediana = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/**
 * El merchant de la medición, con `id > 1` GARANTIZADO.
 *
 * 🔴 En un banco recién creado el primer merchant sale con `id = 1`, que es el DEMO (regla 8), y
 * `getEmissionMode` lo pone en modo `demo` en vez de `receipt`. Mediría el camino equivocado
 * creyendo medir el del profesional español — el mismo tropiezo que costó una medición al contar
 * los viajes. Se descarta el id 1 creando otro, en vez de confiar en que el banco no esté vacío.
 */
async function conMerchantDeMedicion(prisma, data, fn) {
  return withMerchant(prisma, data, async (m, ctx) => {
    if (m.id !== 1) return fn(m, ctx);
    return withMerchant(prisma, data, (m2, ctx2) => fn(m2, ctx2));
  });
}

/**
 * Una reserva dentro de su `$transaction`, cronometrada.
 *
 * 🔴 `crearFila` NO es un adorno, y descubrirlo evitó un CI rojo: en formato F la secuencia se
 * DERIVA de las facturas ya emitidas, no de un contador. Diez reservas concurrentes que no crean
 * la fila devuelven **todas el mismo número** — y eso no es el cerrojo fallando, es que la
 * medición no estaba emitiendo. Los tres caminos de factura crean la fila de verdad, que además
 * es el viaje que de verdad se paga dentro del cerrojo.
 *
 * El albarán se queda con el `SELECT 1` equivalente —crear uno arrastra job y cliente—, y se
 * declara: su número sale de un contador, así que avanza igual.
 */
async function reservar(prisma, fn, crearFila = null) {
  const t0 = performance.now();
  const numero = await prisma.$transaction(async (tx) => {
    const n = await fn(tx);
    if (crearFila) await crearFila(tx, n);
    else await tx.$queryRaw`SELECT 1`; // equivalente declarado, como hizo la fase C
    return n;
  });
  return { numero, ms: performance.now() - t0 };
}

/** La factura mínima que la base acepta, con el número que se acaba de reservar. */
const filaDeFactura = (merchantId, customerId) => async (tx, number) => {
  await tx.invoice.create({
    data: {
      merchantId, customerId, number, total: '100.00', currency: 'EUR',
      pdfUrl: `https://qa.invalid/${number}.pdf`, qrData: `QR-${number}`,
      lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 }],
    },
  });
};

test('SCRUM-728d · SUELO: el banco es desechable, y el RTT en loopback es ~0',
  { skip: !ENABLED && 'necesita banco desechable: LIBRO_PG_URL=… npm test (CI lo levanta solo)' }, async (t) => {
    const { PrismaClient } = await import('@prisma/client');
    t.diagnostic(`banco: ${exigirBancoDesechable(URL_BANCO)}`);
    const prisma = new PrismaClient({ datasourceUrl: URL_BANCO });
    try {
      const rtts = [];
      for (let i = 0; i < 30; i += 1) {
        const t0 = performance.now();
        await prisma.$queryRaw`SELECT 1`;
        rtts.push(performance.now() - t0);
      }
      const rtt = mediana(rtts);
      t.diagnostic(`RTT desnudo (SELECT 1, n=30): mediana ${ms(rtt)} · min ${ms(Math.min(...rtts))} · max ${ms(Math.max(...rtts))}`);
      // 🔴 EL SUELO QUE HACE VÁLIDA TODA LA TANDA: si el RTT no fuera despreciable, esto no
      // estaría midiendo trabajo — estaría midiendo red otra vez, y con otro nombre.
      assert.ok(rtt < 5,
        `🔴 el RTT mediano es ${ms(rtt)}, que NO es loopback. Toda la medición de este fichero `
        + 'separa trabajo de red suponiendo RTT≈0: con este RTT no separa nada.');
    } finally { await prisma.$disconnect(); }
  });

test('SCRUM-728d · 🔴 LOS CUATRO CAMINOS, con 1 · 5 · 10 simultáneas',
  { skip: !ENABLED && 'necesita banco desechable: LIBRO_PG_URL=… npm test (CI lo levanta solo)' }, async (t) => {
    const { PrismaClient } = await import('@prisma/client');
    exigirBancoDesechable(URL_BANCO);
    const prisma = new PrismaClient({ datasourceUrl: URL_BANCO });
    const { allocateInvoiceNumber } = await import('../dist/modules/invoicing/domain/invoiceNumber.service.js');
    const { allocateAlbaranNumber } = await import('../dist/modules/jobs/domain/albaranNumber.service.js');
    const { getEmissionMode } = await import('../dist/modules/invoicing/domain/emission.service.js');

    try {
      // 🔴 HACEN FALTA DOS MERCHANTS, y no es comodidad: el modo de emisión es del merchant, así
      // que uno solo no puede dar los cuatro caminos. Y una RECTIFICATIVA sobre un merchant en
      // modo `receipt` no es lenta: **lanza `invoicing_es_disabled`** (las rectificativas no
      // existen para justificantes, regla 29), así que medirla ahí no habría medido nada.
      const es = { name: 'QA SCRUM-728d ES', email: `medicion-es-${process.pid}@yaqu.test`, country: 'ES' };
      const fr = { name: 'QA SCRUM-728d FR', email: `medicion-fr-${process.pid}@yaqu.test`, country: 'FR' };

      await conMerchantDeMedicion(prisma, es, async (mEs) => {
        await conMerchantDeMedicion(prisma, fr, async (mFr) => {
          const modoEs = getEmissionMode(mEs);
          const modoFr = getEmissionMode(mFr);
          t.diagnostic(`merchant ES id=${mEs.id} modo=${modoEs} · merchant FR id=${mFr.id} modo=${modoFr}`);
          assert.equal(modoEs, 'receipt',
            `🔴 el merchant ES sale en modo «${modoEs}», no «receipt». El camino del justificante `
            + 'NO se estaría midiendo, y es el que emite el ES real de hoy.');
          assert.equal(modoFr, 'fiscal',
            `🔴 el merchant no-ES sale en modo «${modoFr}», no «fiscal»: los caminos F1 y R1 no se `
            + 'estarían midiendo.');

          const cliEs = await prisma.customer.create({
            data: { merchantId: mEs.id, name: 'Cliente ES', phone: `+34600${String(mEs.id).padStart(6, '0')}` },
          });
          const cliFr = await prisma.customer.create({
            data: { merchantId: mFr.id, name: 'Cliente FR', phone: `+34601${String(mFr.id).padStart(6, '0')}` },
          });

          const act = (m) => ({ tipo: 'merchant', merchantId: m.id, teamMemberId: null });
          const op = (m) => ({ camino: 'C7-suelta', actor: act(m) });
          const CAMINOS = [
            ['albarán      ', (tx) => allocateAlbaranNumber(tx, mEs.id), null],
            ['justificante ', (tx) => allocateInvoiceNumber(tx, mEs.id, op(mEs)), filaDeFactura(mEs.id, cliEs.id)],
            ['factura F1   ', (tx) => allocateInvoiceNumber(tx, mFr.id, op(mFr)), filaDeFactura(mFr.id, cliFr.id)],
            ['rectificativa', (tx) => allocateInvoiceNumber(tx, mFr.id, { ...op(mFr), rectifying: true }), filaDeFactura(mFr.id, cliFr.id)],
          ];

          for (const [nombre, fn, crear] of CAMINOS) {
            // ① UNA SOLA, n=15 en serie: la mediana, sin competencia.
            const solas = [];
            for (let i = 0; i < 15; i += 1) solas.push((await reservar(prisma, fn, crear)).ms);
            t.diagnostic(`${nombre} · 1 sola  (n=15): mediana ${ms(mediana(solas))} · min ${ms(Math.min(...solas))} · max ${ms(Math.max(...solas))}`);

            // ② y ③ · 5 y 10 A LA VEZ, del MISMO merchant: el cerrojo las serializa.
            for (const n of [5, 10]) {
              const t0 = performance.now();
              const r = await Promise.allSettled(Array.from({ length: n }, () => reservar(prisma, fn, crear)));
              const total = performance.now() - t0;
              const ok = r.filter((x) => x.status === 'fulfilled');
              const ko = r.length - ok.length;
              const motivos = [...new Set(r.filter((x) => x.status === 'rejected')
                .map((x) => String(x.reason?.code || x.reason?.message || x.reason).slice(0, 60)))];
              t.diagnostic(`${nombre} · ${String(n).padStart(2)} a la vez: ${ms(total)} en total · ${ok.length} ok · ${ko} fallos${motivos.length ? ` · ${motivos.join(' | ')}` : ''}`);
              // Determinista y sin reloj: ningún número se repite. Es lo que el cerrojo existe
              // para garantizar, y lo único que NO puede fallar por ruido del runner.
              const nums = ok.map((x) => x.value.numero);
              assert.equal(new Set(nums).size, nums.length,
                `🔴 DOS RESERVAS CON EL MISMO NÚMERO en ${nombre.trim()} con ${n} simultáneas. Es `
                + 'la regla 29 rota por la peor vía, y significa que el cerrojo dejó de serializar.');
            }
          }
        });
      });
    } finally { await prisma.$disconnect(); }
  });

test('SCRUM-728d · 🔴 LA PENDIENTE DEL VIAJE QUE ESCALA: 10 · 100 · 1.000 filas en la serie F',
  { skip: !ENABLED && 'necesita banco desechable: LIBRO_PG_URL=… npm test (CI lo levanta solo)' }, async (t) => {
    const { PrismaClient } = await import('@prisma/client');
    exigirBancoDesechable(URL_BANCO);
    const prisma = new PrismaClient({ datasourceUrl: URL_BANCO });
    const { allocateInvoiceNumber, usaFormatoF } = await import('../dist/modules/invoicing/domain/invoiceNumber.service.js');

    try {
      assert.ok(usaFormatoF(new Date(), false),
        '🔴 hoy no se emite en formato F, así que la lectura de la serie F entera NO ocurre y este '
        + 'test no está midiendo lo que dice. Si el corte se movió, hay que rehacer la medición.');

      // País no-ES para caer en el camino FISCAL, que es el que lee la serie F entera.
      await conMerchantDeMedicion(prisma, { name: 'QA SCRUM-728d escala', email: `escala-${process.pid}@yaqu.test`, country: 'FR' }, async (m) => {
        const cliente = await prisma.customer.create({
          data: { merchantId: m.id, name: 'Cliente de medición', phone: `+34600${String(m.id).padStart(6, '0')}` },
        });
        const anio = String(new Date().getFullYear() % 100).padStart(2, '0');
        const actor = { tipo: 'merchant', merchantId: m.id, teamMemberId: null };
        const fn = (tx) => allocateInvoiceNumber(tx, m.id, { camino: 'C7-suelta', actor });

        let creadas = 0;
        const medidas = [];
        for (const objetivo of [10, 100, 1000]) {
          // Se rellena la serie F hasta `objetivo` filas. `createMany` para no pagar N viajes.
          const faltan = objetivo - creadas;
          await prisma.invoice.createMany({
            data: Array.from({ length: faltan }, (_, i) => {
              const seq = String(creadas + i + 1).padStart(4, '0');
              return {
                merchantId: m.id, customerId: cliente.id, number: `F${anio}${seq}`,
                total: '100.00', currency: 'EUR',
                pdfUrl: `https://qa.invalid/F${anio}${seq}.pdf`, qrData: `QR-F${anio}${seq}`,
                lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 }],
              };
            }),
          });
          creadas = objetivo;

          // ⚠️ AQUÍ NO SE CREA LA FILA, al revés que en el test de arriba, y es deliberado: la
          // variable de esta medición es CUÁNTAS filas hay. Si cada reserva añadiera una, las
          // nueve medirían nueve tamaños distintos y la pendiente saldría de un eje movido.
          const t9 = [];
          for (let i = 0; i < 9; i += 1) t9.push((await reservar(prisma, fn)).ms);
          const med = mediana(t9);
          medidas.push({ filas: objetivo, med });
          t.diagnostic(`serie F con ${String(objetivo).padStart(4)} filas → reserva: mediana ${ms(med)} · min ${ms(Math.min(...t9))} · max ${ms(Math.max(...t9))}`);
        }

        const [a, b, c] = medidas;
        const factor = (x, y) => (x.med > 0 ? (y.med / x.med).toFixed(2) : 'n/d');
        t.diagnostic(`PENDIENTE: ×${factor(a, b)} al pasar de 10 a 100 filas · ×${factor(b, c)} de 100 a 1.000 · ×${factor(a, c)} de 10 a 1.000`);
        t.diagnostic('(×1 = plano; ×10 por década = lineal en el número de facturas del año)');

        // Sin reloj: con 1.000 emitidas, la siguiente TIENE que ser la 1001. Si la derivación se
        // rompiera al crecer la serie, saldría aquí y no en un número de milisegundos.
        const ultima = await reservar(prisma, fn);
        assert.equal(ultima.numero, `F${anio}1001`,
          `🔴 con 1.000 facturas en la serie F la siguiente debería ser F${anio}1001 y salió `
          + `${ultima.numero}. La derivación de la secuencia se rompe al crecer la serie.`);
      });
    } finally { await prisma.$disconnect(); }
  });
