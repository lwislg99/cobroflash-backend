#!/usr/bin/env node
// scripts/medir-concurrencia-emision.mjs — SCRUM-781
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// ¿A PARTIR DE CUÁNTAS EMISIONES SIMULTÁNEAS SE PASA DEL TIMEOUT?
//
// El cerrojo de la serie (`pg_advisory_xact_lock`) SERIALIZA: la enésima emisión espera a las
// N-1 anteriores. SCRUM-592 midió que con presupuestos, diez en fila contra la base remota de
// desarrollo rozaban los ~5.200 ms, por encima del timeout por defecto de Prisma (5.000 ms). La
// protección hace su trabajo —ni duplica ni salta— y aun así el último se cae POR TIEMPO.
//
// Esto lo mide para la FACTURA, que es lo que emite documentos fiscales y hace MÁS cosas dentro
// de la transacción que el presupuesto (el `auditLog` de SCRUM-207 y el `invoice.create`).
//
// ── 🔴 DOS RELOJES DISTINTOS, Y CONFUNDIRLOS DA UN DIAGNÓSTICO FALSO ────────────────────
//
// Prisma tiene DOS topes y fallan por motivos distintos:
//   · `maxWait`  (2.000 ms por defecto) — esperar a que el POOL dé conexión. Con N mayor que el
//     pool, los de más allá ni siquiera han empezado.
//   · `timeout`  (5.000 ms por defecto) — duración de la transacción YA empezada. Es el de la
//     cola del cerrojo.
// Este script los distingue por el error, no los supone: `P2028` / «Timed out fetching a new
// connection» se reportan aparte.
//
// ── ⚠️ EL NÚMERO NO SE MIDE UNA VEZ ─────────────────────────────────────────────────────
// Se repite cada N varias veces y se da la DISPERSIÓN. Si la dispersión se come la diferencia,
// el resultado se retira en vez de publicarse.
//
// ⛔ SÓLO `yaqu_dev_javier`. Se niega a arrancar contra cualquier otra base — guard por DESTINO,
//    igual que los tests gateados. Ni staging ni producción, ni para contar filas.
//
// USO:  node scripts/medir-concurrencia-emision.mjs [--repeticiones 3] [--tope 40]
// ═════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = process.cwd();
const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : d;
};
const REPETICIONES = arg('--repeticiones', 3);
const TOPE_N = arg('--tope', 40);
const TIMEOUT_PRISMA_POR_DEFECTO = 5_000;

export const SALIDA_DESTINO_NO_DEV = 2;
export const SALIDA_NO_MEDIBLE = 3;

/** Mediana, mínimo y máximo de una lista. Sin dependencias (regla 36). */
export function dispersion(xs) {
  const o = [...xs].sort((a, b) => a - b);
  const n = o.length;
  const mediana = n % 2 ? o[(n - 1) / 2] : Math.round((o[n / 2 - 1] + o[n / 2]) / 2);
  return { n, min: o[0], mediana, max: o[n - 1], amplitud: o[n - 1] - o[0] };
}

/**
 * ¿La dispersión se come el resultado? Devuelve `true` si la amplitud entre pasadas es mayor
 * que la distancia al umbral que se quiere afirmar. Entonces el número NO se publica.
 */
export function dispersionSeLoCome(d, umbral) {
  return d.amplitud > Math.abs(d.mediana - umbral);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { PrismaClient } = await import(pathToFileURL(path.join(RAIZ, 'node_modules/@prisma/client/default.js')).href);
  const { parseBDSegura } = await import(pathToFileURL(path.join(RAIZ, 'scripts/_db-guard.mjs')).href);
  const { emitInvoice } = await import(pathToFileURL(path.join(RAIZ, 'dist/modules/invoicing/domain/invoicing.service.js')).href);
  const { allocateQuoteNumber } = await import(pathToFileURL(path.join(RAIZ, 'dist/modules/quotes/domain/quoteNumber.service.js')).href);

  const linea = fs.readFileSync(path.join(RAIZ, '.env'), 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL_DEV='));
  const url = linea?.slice('DATABASE_URL_DEV='.length).trim().replace(/^["']|["']$/g, '');
  const info = url ? parseBDSegura(url) : null;
  if (!info || info.base !== 'yaqu_dev_javier') {
    console.error('🔴 PARO: la clave de desarrollo no apunta a `yaqu_dev_javier`. No mido nada.');
    process.exit(SALIDA_DESTINO_NO_DEV);
  }
  console.log(`destino: ${info.host}/${info.base}\n`);

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  /** Merchant QA + cliente, con limpieza explícita. Hijos antes que padres (FK RESTRICT). */
  async function conMerchant(fn) {
    const m = await prisma.merchant.create({
      data: {
        name: `QA-781-${process.pid}-${Date.now()}`,
        email: `qa-781-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`,
        country: 'ES', taxId: 'B12345678',
        flags: { INVOICING_ES_ENABLED: true },
        invoiceSeriesPrefix: 'QA', nextInvoiceNumber: 1, invoiceSeriesYear: null,
        nextQuoteNumber: 1, quoteSeriesYear: null,
      },
      select: { id: true },
    });
    const c = await prisma.customer.create({ data: { merchantId: m.id, name: 'QA-781' }, select: { id: true } });
    try {
      return await fn(m, c);
    } finally {
      // Aislada cada una: un fallo no cancela las siguientes (criterio de SCRUM-113).
      await prisma.invoice.deleteMany({ where: { merchantId: m.id } }).catch((e) => console.error('  limpieza invoice:', e.message));
      await prisma.auditLog.deleteMany({ where: { merchantId: m.id } }).catch(() => {});
      await prisma.quote.deleteMany({ where: { merchantId: m.id } }).catch(() => {});
      await prisma.customer.deleteMany({ where: { merchantId: m.id } }).catch((e) => console.error('  limpieza customer:', e.message));
      await prisma.merchant.delete({ where: { id: m.id } }).catch((e) => console.error('  limpieza merchant:', e.message));
    }
  }

  const emitir = (m, c, timeout, maxWait) => prisma.$transaction((tx) => emitInvoice(tx, {
    merchantId: m.id, customerId: c.id, total: '100.00', currency: 'EUR', type: 'F1',
    lines: [{ concept: 'QA-781', qty: 1, price: 100, tax: 0.21 }], quoteId: null,
    actor: { tipo: 'sistema', ref: 'qa_scrum781' }, origen: 'C7-suelta',
  }), { timeout, maxWait });

  /** Lanza N emisiones a la vez y devuelve el reloj de cada una y qué falló. */
  async function tanda(m, c, n, timeout, maxWait) {
    const t0 = Date.now();
    const rs = await Promise.allSettled(Array.from({ length: n }, async () => {
      const a = Date.now();
      try { await emitir(m, c, timeout, maxWait); return Date.now() - a; }
      catch (e) { const err = new Error(e.message); err.ms = Date.now() - a; err.codigo = e.code; throw err; }
    }));
    const ok = rs.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    const fallos = rs.filter((r) => r.status === 'rejected').map((r) => ({
      ms: r.reason.ms, codigo: r.reason.codigo,
      clase: /fetching a new connection/i.test(r.reason.message) ? 'POOL (maxWait)'
        : /P2028|Transaction .*(closed|not found)|timed out/i.test(r.reason.message) ? 'TIMEOUT de transacción'
          : 'OTRO',
      message: r.reason.message.split('\n')[0].slice(0, 110),
    }));
    return { pared: Date.now() - t0, ok, fallos };
  }

  try {
    // ── 0 · LATENCIA DE IDA Y VUELTA · para poder ATRIBUIR el coste ────────────────────────
    const rtts = [];
    for (let i = 0; i < 10; i++) { const a = Date.now(); await prisma.$queryRaw`SELECT 1`; rtts.push(Date.now() - a); }
    const rtt = dispersion(rtts);
    console.log(`RTT de una consulta trivial: mediana ${rtt.mediana} ms (min ${rtt.min}, max ${rtt.max})\n`);

    // ── 1 · COSTE DE **UNA** EMISIÓN, aislada ─────────────────────────────────────────────
    const solas = [];
    for (let i = 0; i < REPETICIONES; i++) {
      await conMerchant(async (m, c) => { const r = await tanda(m, c, 1, 60_000, 60_000); solas.push(r.ok[0]); });
    }
    const d1 = dispersion(solas);
    console.log(`UNA emisión de FACTURA, sola: mediana ${d1.mediana} ms  (min ${d1.min}, max ${d1.max}, amplitud ${d1.amplitud})`);

    // Comparativa con el PRESUPUESTO, para atribuir el sobrecoste del emisor.
    const solasQ = [];
    for (let i = 0; i < REPETICIONES; i++) {
      await conMerchant(async (m) => {
        const a = Date.now();
        await prisma.$transaction((tx) => allocateQuoteNumber(tx, m.id, new Date()), { timeout: 60_000, maxWait: 60_000 });
        solasQ.push(Date.now() - a);
      });
    }
    const dq = dispersion(solasQ);
    console.log(`UNA reserva de PRESUPUESTO, sola: mediana ${dq.mediana} ms  (min ${dq.min}, max ${dq.max}, amplitud ${dq.amplitud})`);
    console.log(`→ sobrecoste del emisor de factura: ${d1.mediana - dq.mediana} ms de mediana\n`);

    // ── 2 · LA COLA · N simultáneas, con TOPES GENEROSOS para medir el reloj, no el corte ──
    console.log('N simultáneas (topes de 120 s: se mide el RELOJ, no el corte)');
    console.log('  N │ peor emisión (mediana de las pasadas) │ min–max │ amplitud │ pared');
    const peorPorN = new Map();
    let primerN = null;
    for (const n of [1, 2, 3, 5, 8, 10, 15, 20, 30, 40].filter((x) => x <= TOPE_N)) {
      const peores = []; const paredes = [];
      for (let i = 0; i < REPETICIONES; i++) {
        const r = await conMerchant((m, c) => tanda(m, c, n, 120_000, 120_000));
        if (r.fallos.length) { console.log(`  ${String(n).padStart(3)} │ 🔴 ${r.fallos.length} fallos con topes de 120 s: ${r.fallos[0].clase} — ${r.fallos[0].message}`); }
        if (!r.ok.length) continue;
        peores.push(Math.max(...r.ok)); paredes.push(r.pared);
      }
      if (!peores.length) { console.log(`  ${String(n).padStart(3)} │ NO MEDIBLE (ninguna emisión completó)`); continue; }
      const d = dispersion(peores); const dp = dispersion(paredes);
      peorPorN.set(n, d);
      const marca = d.mediana > TIMEOUT_PRISMA_POR_DEFECTO ? '  ⬅ POR ENCIMA DE 5.000 ms' : '';
      console.log(`  ${String(n).padStart(3)} │ ${String(d.mediana).padStart(8)} ms │ ${String(d.min).padStart(5)}–${String(d.max).padEnd(6)} │ ${String(d.amplitud).padStart(6)} │ ${dp.mediana} ms${marca}`);
      if (primerN === null && d.mediana > TIMEOUT_PRISMA_POR_DEFECTO) primerN = n;
    }

    console.log('');
    if (primerN === null) {
      console.log(`✅ NO SE REPRODUCE hasta N=${TOPE_N}: ninguna tanda pasó de ${TIMEOUT_PRISMA_POR_DEFECTO} ms.`);
    } else {
      const d = peorPorN.get(primerN);
      console.log(`🔴 PRIMER N QUE PASA DE ${TIMEOUT_PRISMA_POR_DEFECTO} ms: N=${primerN} (mediana ${d.mediana} ms)`);
      if (dispersionSeLoCome(d, TIMEOUT_PRISMA_POR_DEFECTO)) {
        console.log(`⚠️  Y SE RETIRA: la amplitud entre pasadas (${d.amplitud} ms) es mayor que la `
          + `distancia al umbral (${Math.abs(d.mediana - TIMEOUT_PRISMA_POR_DEFECTO)} ms). `
          + 'La máquina dispersa más de lo que mide este número.');
      }
    }

    // ── 3 · EL CORTE DE VERDAD · con los topes POR DEFECTO de Prisma ──────────────────────
    console.log('\nCon los topes POR DEFECTO de Prisma (timeout 5.000 · maxWait 2.000):');
    for (const n of [2, 4, 5, 6, 7, 8, 10].filter((x) => x <= TOPE_N)) {
      const resultados = [];
      for (let i = 0; i < REPETICIONES; i++) {
        const r = await conMerchant((m, c) => tanda(m, c, n, 5_000, 2_000));
        resultados.push(r);
      }
      const fallos = resultados.map((r) => r.fallos.length);
      const clases = [...new Set(resultados.flatMap((r) => r.fallos.map((f) => f.clase)))];
      console.log(`  N=${String(n).padStart(2)} → fallos por pasada: [${fallos.join(', ')}] de ${n}`
        + (clases.length ? ` · clase: ${clases.join(' / ')}` : ' · ninguna falló'));
      const ejemplo = resultados.flatMap((r) => r.fallos)[0];
      if (ejemplo) console.log(`         ejemplo: ${ejemplo.codigo ?? '(sin código)'} · ${ejemplo.message}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}
