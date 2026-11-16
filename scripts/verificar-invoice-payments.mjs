#!/usr/bin/env node
// scripts/verificar-invoice-payments.mjs — SCRUM-1732 (opción A, PR-1)
//
// ¿ESTÁ APLICADO EL ALTER DE `invoice_payments` EN ESTA BASE? Solo LEE el catálogo. Mismo patrón
// que `verificar-vf-submissions.mjs` (SCRUM-1296): la URL viaja en el ENTORNO, se nombra la CLAVE.
//
// A5 pide DOS controles de tipos DISTINTOS más `current_database()`:
//   · control 1 · `information_schema.columns`: las 11 columnas, cada una con su tipo y su nulabilidad;
//   · control 2 · `pg_constraint` + `pg_indexes`: las 4 FK (RESTRICT / CASCADE, cada una a su tabla),
//     la PK y los 3 índices por nombre (dos de ellos únicos).
// Y un control POSITIVO que tiene que salir 1 siempre (`invoices`): si sale 0, el verificador mira mal.
//
// USO:   node scripts/verificar-invoice-payments.mjs --clave DATABASE_URL_DEV
// SALIDA: 0 = aplicado y completo · 1 = falta algo (lo nombra) · 2 = no supe mirar.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { describirBD, parseBDSegura } from './_db-guard.mjs';

const args = process.argv.slice(2);
const i = args.indexOf('--clave');
const CLAVE = i >= 0 ? args[i + 1] : null;

function morir(m, code = 2) { console.error(`\n🔴 ${m}\n`); process.exit(code); }

if (!CLAVE) morir('falta `--clave <NOMBRE_DE_LA_VARIABLE>` (el NOMBRE, nunca la URL).');
const url = process.env[CLAVE];
if (!url) morir(`no hay ${CLAVE} en el entorno. (No se imprime ningún valor de .env.)`);
if (!parseBDSegura(url)) morir('la URL de la base es ilegible (no se imprime).');

console.log('── DESTINO ─────────────────────────────────────────────────');
console.log(`   clave:   ${CLAVE}`);
console.log(`   destino: ${describirBD(url)}`);

/** Columna → `udt_name:is_nullable`, tal y como lo da `information_schema.columns`. */
export const COLUMNAS = {
  id: 'int4:NO',
  merchant_id: 'int4:NO',
  invoice_id: 'int4:NO',
  charge_id: 'int4:YES',
  importe: 'numeric:NO',
  fecha_cobro: 'timestamp:NO',
  fecha_origen: 'text:NO',
  metodo: 'text:YES',
  tipo: 'text:NO',
  anula_id: 'int4:YES',
  created_at: 'timestamp:NO',
};
/** FK → tabla de destino. Todas ON DELETE RESTRICT ('r') y ON UPDATE CASCADE ('c'). */
export const FKS = {
  invoice_payments_merchant_id_fkey: 'merchants',
  invoice_payments_invoice_id_fkey: 'invoices',
  invoice_payments_charge_id_fkey: 'charges',
  invoice_payments_anula_id_fkey: 'invoice_payments',
};
/** Índice → ¿único? */
export const INDICES = {
  invoice_payments_pkey: true,
  invoice_payments_anula_id_key: true,
  invoice_payments_invoice_id_charge_id_key: true,
  invoice_payments_merchant_id_fecha_cobro_idx: false,
};

const CONSULTA_FILA = `
SELECT
  (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'invoices')::int AS control_positivo,
  (SELECT current_database()) AS base,
  (SELECT numeric_precision || ',' || numeric_scale FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'invoice_payments' AND column_name = 'importe') AS precision_importe`;
const CONSULTA_COLUMNAS = `
SELECT column_name AS c, udt_name || ':' || is_nullable AS t FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'invoice_payments'`;
const CONSULTA_FKS = `
SELECT k.conname AS n, d.relname AS destino, k.confdeltype::text AS del, k.confupdtype::text AS upd
  FROM pg_constraint k JOIN pg_class t ON t.oid = k.conrelid JOIN pg_class d ON d.oid = k.confrelid
 WHERE k.contype = 'f' AND t.relname = 'invoice_payments'`;
const CONSULTA_INDICES = `
SELECT indexname AS n, (indexdef ILIKE 'CREATE UNIQUE%') AS unico FROM pg_indexes
 WHERE schemaname = 'public' AND tablename = 'invoice_payments'`;

const prisma = new PrismaClient({ datasourceUrl: url });
let fila, columnas, fks, indices;
try {
  [fila] = await prisma.$queryRawUnsafe(CONSULTA_FILA);
  columnas = await prisma.$queryRawUnsafe(CONSULTA_COLUMNAS);
  fks = await prisma.$queryRawUnsafe(CONSULTA_FKS);
  indices = await prisma.$queryRawUnsafe(CONSULTA_INDICES);
} catch (e) {
  const primera = String(e?.message || e).split('\n')[0].slice(0, 160);
  console.error('\n🔴 NO SUPE MIRAR — la consulta no se pudo ejecutar. NO significa que falte nada.');
  console.error(`   (${primera})\n`);
  await prisma.$disconnect().catch(() => {});
  process.exit(2);
}
await prisma.$disconnect().catch(() => {});

console.log(`\n   base (current_database()): ${fila.base}`);
console.log(`   control positivo (invoices existe): ${fila.control_positivo}`);
if (fila.control_positivo !== 1) {
  console.log('   🔴 CONTROL POSITIVO EN ROJO: no encuentra ni `invoices`. Nada de abajo se puede creer.');
  process.exit(2);
}

const faltas = [];
// Control 1 · columnas, tipo y nulabilidad.
const vistas = Object.fromEntries(columnas.map((r) => [r.c, r.t]));
console.log(`\n── CONTROL 1 · information_schema.columns · ${columnas.length} columnas vistas, ${Object.keys(COLUMNAS).length} esperadas`);
for (const [c, t] of Object.entries(COLUMNAS)) {
  const ok = vistas[c] === t;
  console.log(`   ${ok ? '✔' : '✗'} ${c.padEnd(14)} esperado ${t.padEnd(14)} visto ${vistas[c] ?? '—'}`);
  if (!ok) faltas.push(`columna ${c}`);
}
for (const c of Object.keys(vistas)) if (!(c in COLUMNAS)) faltas.push(`columna INESPERADA ${c}`);
if (fila.precision_importe !== '12,2') faltas.push(`importe con precisión ${fila.precision_importe} (se esperaba 12,2)`);

// Control 2 · restricciones e índices, por nombre.
console.log(`\n── CONTROL 2 · pg_constraint (${fks.length} FK vistas) + pg_indexes (${indices.length} índices vistos)`);
const fkPorNombre = Object.fromEntries(fks.map((r) => [r.n, r]));
for (const [n, destino] of Object.entries(FKS)) {
  const r = fkPorNombre[n];
  const ok = r && r.destino === destino && r.del === 'r' && r.upd === 'c';
  console.log(`   ${ok ? '✔' : '✗'} ${n} → ${destino}${r ? ` (visto ${r.destino}, del=${r.del}, upd=${r.upd})` : ' (no está)'}`);
  if (!ok) faltas.push(`FK ${n}`);
}
const idxPorNombre = Object.fromEntries(indices.map((r) => [r.n, r.unico]));
for (const [n, unico] of Object.entries(INDICES)) {
  const ok = n in idxPorNombre && idxPorNombre[n] === unico;
  console.log(`   ${ok ? '✔' : '✗'} ${n} (${unico ? 'único' : 'no único'})`);
  if (!ok) faltas.push(`índice ${n}`);
}

console.log('\n── VEREDICTO ───────────────────────────────────────────────');
if (faltas.length) {
  console.log(`   🔴 FALTA o NO CASA (${faltas.length}): ${faltas.join(' · ')}`);
  process.exit(1);
}
console.log(`   ✔ invoice_payments aplicada y completa en ${fila.base}: 11/11 columnas, 4/4 FK, 4/4 índices.`);
process.exit(0);
