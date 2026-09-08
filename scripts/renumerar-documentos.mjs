#!/usr/bin/env node
// scripts/renumerar-documentos.mjs — SCRUM-592 (DOC-02)
//
// Renumera presupuestos y albaranes al formato `[LETRA][AA][NNNN]`.
//
//   node scripts/renumerar-documentos.mjs                # PREVIEW: dice qué haría y no toca nada
//   node scripts/renumerar-documentos.mjs --aplicar      # escribe
//
// 🔴 SÓLO CONTRA DESARROLLO, y no por confianza: el script COMPRUEBA la base y se niega. Staging
// y producción los aplica el fundador cuando producción vuelva a desplegar.
//
// El veredicto vive en `_renumerar-documentos.mjs`, que es PURO — aquí sólo se lee y se escribe.
// Es el mismo reparto que `suelo-de-la-tanda.mjs`, y es lo que permite probar el reinicio de año
// y la idempotencia sin tocar ninguna base.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { planDeRenumeracion, contadoresFinales } from './_renumerar-documentos.mjs';

const RAIZ = process.cwd();
const APLICAR = process.argv.includes('--aplicar');
const { PrismaClient } = await import(pathToFileURL(RAIZ + '/node_modules/@prisma/client/default.js').href);
const { parseBDSegura } = await import(pathToFileURL(RAIZ + '/scripts/_db-guard.mjs').href);
const F = await import(pathToFileURL(RAIZ + '/dist/core/documentos/formatoNumero.js').href);
const A = await import(pathToFileURL(RAIZ + '/dist/modules/jobs/domain/albaranNumber.service.js').href);

const linea = fs.readFileSync('.env', 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL_DEV='));
if (!linea) { console.error('🔴 NO SUPE MIRAR: no hay clave de desarrollo.'); process.exit(2); }
const url = linea.slice('DATABASE_URL_DEV='.length).trim().replace(/^["']|["']$/g, '');
const info = parseBDSegura(url);
if (!info) { console.error('🔴 NO SUPE MIRAR: la clave no es una URL válida.'); process.exit(2); }
console.log(`base «${info.base}»  ·  modo: ${APLICAR ? '🔴 APLICAR' : 'preview (no escribe)'}`);
if (info.base !== 'yaqu_dev_javier') {
  console.error('🔴 PARO: esto sólo corre contra la base de desarrollo. Staging y producción los '
    + 'aplica el fundador.');
  process.exit(2);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });
try {
  // ── PRESUPUESTOS ────────────────────────────────────────────────────────────────────────
  const quotes = await prisma.quote.findMany({
    select: { id: true, merchantId: true, createdAt: true, quoteNumber: true },
    orderBy: { createdAt: 'asc' },
  });
  // El presupuesto NO guarda el texto del número: guarda la secuencia y el año se deriva de
  // `createdAt`. Así que «ya renumerado» aquí significa «su secuencia ya es la que le toca».
  const planQ = planDeRenumeracion(
    quotes.map((q) => ({ ...q, numeroActual: null })),
    { formatear: F.formatoNumeroDocumento, serie: F.SERIES.presupuesto, yaRenumerado: () => false },
  );
  const cambian = planQ.plan.filter((p) => {
    const q = quotes.find((x) => x.id === p.id);
    return q.quoteNumber !== p.seq;
  });

  // 🔴 SUELO: cero EXAMINADOS no es cero a renumerar. Son cosas distintas.
  console.log(`\npresupuestos EXAMINADOS: ${quotes.length}  ·  cambian de número: ${cambian.length}`);
  if (quotes.length === 0) {
    console.log('⚠️ NO SUPE MIRAR: cero documentos examinados. Esto no es «nada que renumerar».');
  }
  for (const p of cambian.slice(0, 12)) {
    const q = quotes.find((x) => x.id === p.id);
    console.log(`   id ${String(p.id).padStart(4)}  merchant ${p.merchantId}  #${q.quoteNumber} → ${p.a}  (seq ${p.seq})`);
  }

  // ── ALBARANES ───────────────────────────────────────────────────────────────────────────
  const albaranes = await prisma.albaran.findMany({
    select: { id: true, merchantId: true, createdAt: true, numero: true },
    orderBy: { createdAt: 'asc' },
  });
  const planA = planDeRenumeracion(
    albaranes.map((a) => ({ ...a, numeroActual: a.numero })),
    { formatear: F.formatoNumeroDocumento, serie: F.SERIES.albaran, yaRenumerado: A.esAlbaranRenumerado },
  );
  console.log(`albaranes EXAMINADOS: ${albaranes.length}  ·  a renumerar: ${planA.plan.length}`
    + `  ·  ya en formato nuevo: ${planA.saltados}`);
  for (const p of planA.plan.slice(0, 12)) console.log(`   id ${p.id}  ${p.de} → ${p.a}`);

  if (!APLICAR) {
    console.log('\n(preview: no se ha escrito nada. Añade `--aplicar` para hacerlo.)');
    process.exit(0);
  }

  // ── APLICAR, en UNA transacción: o se renumera todo o no se renumera nada ────────────────
  await prisma.$transaction(async (tx) => {
    for (const p of cambian) {
      await tx.quote.update({ where: { id: p.id }, data: { quoteNumber: p.seq } });
    }
    for (const p of planA.plan) {
      await tx.albaran.update({ where: { id: p.id }, data: { numero: p.a } });
    }
    // 🔴 Y LOS CONTADORES, o el siguiente documento nuevo repetiría un número ya asignado: se
    // habría arreglado el pasado y roto el futuro.
    for (const c of contadoresFinales(planQ.contadores)) {
      await tx.merchant.update({
        where: { id: c.merchantId },
        data: { nextQuoteNumber: c.siguiente, quoteSeriesYear: c.year },
      });
    }
    for (const c of contadoresFinales(planA.contadores)) {
      await tx.merchant.update({
        where: { id: c.merchantId },
        data: { nextAlbaranNumber: c.siguiente, albaranSeriesYear: c.year },
      });
    }
  }, { timeout: 60_000 });
  console.log('\n✅ aplicado.');
} finally {
  await prisma.$disconnect();
}
