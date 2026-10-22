/**
 * A1.2 — Backfill EFÍMERO de numeración de presupuestos por merchant.
 *
 * Asigna `quoteNumber` (1..N, por orden de id ascendente = orden de creación)
 * a los quotes existentes de cada merchant y deja `nextQuoteNumber` apuntando
 * al siguiente. Idempotente: re-ejecutarlo produce el mismo resultado.
 *
 * Uso:  node scripts/backfill-quote-numbers.mjs           (dry-run, no escribe)
 *       node scripts/backfill-quote-numbers.mjs --apply   (escribe)
 */
import 'dotenv/config';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { comprobarCredencialDeProduccion, OK } from './_clave-vs-destino.mjs';

const APPLY = process.argv.includes('--apply');

// SCRUM-1575b · antes de conectar, el guard de destino sobre la MISMA url que recibe el cliente:
// producción, un destino sin declarar o una URL ilegible → no se conecta.
const url = process.env.DATABASE_URL;
const destino = comprobarCredencialDeProduccion('DATABASE_URL', url, path.basename(process.cwd()));
if (destino.veredicto !== OK) {
  console.error(destino.mensaje);
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url } } });

const merchants = await prisma.merchant.findMany({
  select: { id: true, name: true, nextQuoteNumber: true },
  orderBy: { id: 'asc' },
});

let totalQuotes = 0;
for (const m of merchants) {
  const quotes = await prisma.quote.findMany({
    where: { merchantId: m.id },
    orderBy: { id: 'asc' },
    select: { id: true, quoteNumber: true },
  });

  let n = 1;
  for (const q of quotes) {
    if (APPLY && q.quoteNumber !== n) {
      await prisma.quote.update({ where: { id: q.id }, data: { quoteNumber: n } });
    }
    n++;
  }
  if (APPLY && m.nextQuoteNumber !== n) {
    await prisma.merchant.update({ where: { id: m.id }, data: { nextQuoteNumber: n } });
  }
  totalQuotes += quotes.length;
  console.log(
    `merchant ${m.id} (${m.name}): ${quotes.length} quotes → 1..${n - 1}, nextQuoteNumber=${n}` +
    (APPLY ? '' : '  [dry-run]'),
  );
}

console.log(`\n${APPLY ? 'APLICADO' : 'DRY-RUN'}: ${merchants.length} merchants, ${totalQuotes} quotes.`);
await prisma.$disconnect();
