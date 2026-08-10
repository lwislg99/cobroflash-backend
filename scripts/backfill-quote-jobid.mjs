#!/usr/bin/env node
// scripts/backfill-quote-jobid.mjs — SCRUM-195 (rebanada 1), PASO 1 del ticket.
//
// Rellena `Quote.jobId` para los pares que ya existen: `Quote.jobId = Job.id` donde
// `Job.quoteId = Quote.id`. La columna y su índice YA están en el schema y en las bases; lo que
// falta es el dato.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTE SCRIPT EXISTE Y NO ES UN `UPDATE` A MANO
//
// Es una escritura sobre la tabla que sostiene el dinero. El ticket lo dice: «un backfill a
// ciegas sobre la tabla que sostiene el dinero no es razonable». Así que:
//
//   · **PREVIEW POR DEFECTO.** Sin `--aplicar` no escribe NADA: cuenta lo que cambiaría y sale.
//   · **DICE EL HOST ANTES DE TOCAR.** El procedimiento de SCRUM-169 es staging →
//     `yaqu_dev_javier` → producción, y cada uno con su GO. Quien lo corre tiene que poder leer
//     contra qué base va ANTES de decidir.
//   · **ADITIVO Y REPETIBLE.** Solo toca filas con `job_id IS NULL`; correrlo dos veces no
//     cambia nada la segunda. No borra, no reasigna, no toca `Job.quoteId`.
//
// ⚠️ LO QUE NO HACE: no retira `Job.quoteId` (eso es el PASO 2, y solo cuando el censo de
// consumidores esté a cero) y no inventa pertenencias — si un Quote no tiene Job apuntándole,
// se queda como está.
//
// ⚠️ Y NO ES IMPRESCINDIBLE PARA QUE EL CÓDIGO FUNCIONE, que es lo que lo hace seguro: los
// cuatro consumidores de la rebanada 1 leen los DOS sentidos mientras conviven. Sin backfill el
// producto se comporta igual que hoy; con backfill, `Quote.jobId` pasa a ser la respuesta
// directa. Por eso puede correrse cuando convenga y no en la misma ventana que el despliegue.
//
//   node scripts/backfill-quote-jobid.mjs                 # PREVIEW (no escribe)
//   node scripts/backfill-quote-jobid.mjs --aplicar       # escribe, tras leer el preview

import { PrismaClient } from '@prisma/client';
import { describirBD, parseBDSegura, PROD_HOST } from './_db-guard.mjs';

const aplicar = process.argv.includes('--aplicar');
const url = process.env.DATABASE_URL;

if (!url) {
  console.error('❌ falta DATABASE_URL.');
  process.exit(2);
}

// SCRUM-414 · antes esto era un `new URL(url)` a mano. El `catch` era ciego, así que NO filtraba
// —pero esa seguridad dependía de que ese catch siguiera siendo correcto para siempre, en un
// fichero que edita cualquiera. `parseBDSegura` ya estaba importado aquí: solo faltaba usarlo.
const partes = parseBDSegura(url);
if (!partes) {
  console.error('❌ DATABASE_URL no es una URL legible.'); // sin volcar la cadena
  process.exit(2);
}
const host = partes.host;

console.log(`\nSCRUM-195 · backfill de Quote.jobId`);
console.log(`   base    : ${describirBD(url)}`);
console.log(`   host    : ${host}${host === PROD_HOST ? '   ⚠️  ES PRODUCCIÓN' : ''}`);
console.log(`   modo    : ${aplicar ? '🔴 APLICAR (escribe)' : '👁  PREVIEW (no escribe)'}\n`);

const prisma = new PrismaClient();
const n = (r) => Number(Object.values(r[0])[0]);

try {
  // ── El censo, SIEMPRE, se aplique o no ─────────────────────────────────────
  const quotes = n(await prisma.$queryRawUnsafe('select count(*) from quotes'));
  const jobs = n(await prisma.$queryRawUnsafe('select count(*) from jobs'));
  const yaRellenos = n(await prisma.$queryRawUnsafe('select count(*) from quotes where job_id is not null'));
  const pendientes = n(await prisma.$queryRawUnsafe(
    'select count(*) from quotes q join jobs j on j.quote_id = q.id where q.job_id is null',
  ));
  // Integridad: un `Job.quoteId` que no existe en `quotes` sería un par roto. Si lo hubiera,
  // conviene saberlo ANTES de escribir, no después.
  const huerfanos = n(await prisma.$queryRawUnsafe(
    'select count(*) from jobs j where j.quote_id is not null and not exists (select 1 from quotes q where q.id = j.quote_id)',
  ));
  // Y el caso que rompería la premisa del 1:1 de hoy: dos Jobs apuntando al mismo Quote. El
  // `@unique` lo impide, pero se comprueba porque el backfill se apoya en que no ocurra.
  const quotesConVariosJobs = n(await prisma.$queryRawUnsafe(
    'select count(*) from (select quote_id from jobs where quote_id is not null group by quote_id having count(*) > 1) t',
  ));

  console.log(`   quotes totales .................. ${quotes}`);
  console.log(`   jobs totales ................... ${jobs}`);
  console.log(`   quotes con job_id YA relleno ... ${yaRellenos}`);
  console.log(`   quotes que se rellenarían ...... ${pendientes}`);
  console.log(`   quote_id huérfano en jobs ...... ${huerfanos}${huerfanos ? '   ⚠️  pares rotos' : ''}`);
  console.log(`   quotes con VARIOS jobs ......... ${quotesConVariosJobs}${quotesConVariosJobs ? '   ⚠️  rompe la premisa' : ''}`);

  if (quotesConVariosJobs > 0) {
    console.error('\n❌ ABORTADO: hay Quotes con más de un Job apuntándoles. El backfill asignaría uno');
    console.error('   arbitrariamente, y eso es exactamente lo que no se puede hacer con el dinero.');
    process.exit(3);
  }

  if (!aplicar) {
    console.log(`\n👁  PREVIEW. No se ha escrito nada.`);
    console.log(`   Para aplicar, tras leer esto:  node scripts/backfill-quote-jobid.mjs --aplicar\n`);
    process.exit(0);
  }

  const escritas = await prisma.$executeRawUnsafe(
    'UPDATE quotes q SET job_id = j.id FROM jobs j WHERE j.quote_id = q.id AND q.job_id IS NULL',
  );
  const despues = n(await prisma.$queryRawUnsafe('select count(*) from quotes where job_id is not null'));
  console.log(`\n✅ filas actualizadas: ${escritas}`);
  console.log(`   quotes con job_id ahora: ${despues} (antes ${yaRellenos})`);
  if (escritas !== pendientes) {
    console.warn(`\n⚠️  se esperaban ${pendientes} y se escribieron ${escritas}. No es necesariamente un fallo`);
    console.warn('   (algo pudo cambiar entre el censo y la escritura), pero conviene mirarlo.');
  }
  console.log('');
} finally {
  await prisma.$disconnect();
}
