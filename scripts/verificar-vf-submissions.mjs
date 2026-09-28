#!/usr/bin/env node
// scripts/verificar-vf-submissions.mjs — SCRUM-1127 §④ / SCRUM-1197
//
// ¿Está la cola de VeriFactu en ESTA base, entera? UNA consulta, UNA fila. Mismo patrón que
// `verificar-email-messages.mjs` (SCRUM-475): varias consultas dejan que un número se esconda
// detrás de otro («la tabla está» y nadie mira que faltaba un índice).
//
// Lo que tiene que haber, según §④ de `docs/master/SCRUM-1127.md`:
//   · el tipo `VfSubmissionStatus` con EXACTAMENTE sus cinco valores, y en su orden;
//   · `vf_submissions` (17 columnas) y `vf_flujo_obligado` (5 columnas);
//   · los CUATRO índices de `vf_submissions`;
//   · las DOS claves ajenas, hacia `merchants` e `invoices`, con ON DELETE RESTRICT y
//     ON UPDATE CASCADE — leídas en `pg_constraint` (`confdeltype = 'r'`, `confupdtype = 'c'`).
//     En dev entraron DENTRO del `CREATE TABLE` y en staging/producción con `ADD CONSTRAINT`:
//     esta lectura es la que demuestra que el efecto es el mismo.
//
// 🔴 TRES SALIDAS, NO DOS: 0 = está entero · 1 = falta algo (y dice qué) · 2 = NO SUPE MIRAR.
// «No supe mirar» nunca sale como «no está»: la segunda invita a aplicar otra vez el SQL sobre
// una base que quizá ya lo tiene.
//
// ⚠️ LA URL NUNCA VA EN `argv`: se pasa el NOMBRE de la variable (SCRUM-195).
//
// USO:
//   node scripts/verificar-vf-submissions.mjs --clave DATABASE_URL_DEV
//
// SOLO LEE. Ni `INSERT`, ni `UPDATE`, ni DDL.
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
const bd = parseBDSegura(url);
if (!bd) morir('la URL de la base es ilegible (no se imprime: ilegible ya es toda la información).');

console.log('── DESTINO ─────────────────────────────────────────────────');
console.log(`   clave:   ${CLAVE}`);
console.log(`   destino: ${describirBD(url)}`);

export const ENUM_ESPERADO = 'pending,sent,accepted,rejected,manual_review';
export const INDICES = [
  'vf_submissions_status_next_attempt_at_idx',
  'vf_submissions_obligado_nif_status_idx',
  'vf_submissions_merchant_id_idx',
  'vf_submissions_invoice_id_idx',
];

const fk = (nombre, destino) => `
  (SELECT COUNT(*) FROM pg_constraint k
     JOIN pg_class t ON t.oid = k.conrelid JOIN pg_class d ON d.oid = k.confrelid
    WHERE k.contype = 'f' AND k.conname = '${nombre}'
      AND t.relname = 'vf_submissions' AND d.relname = '${destino}'
      AND k.confdeltype = 'r' AND k.confupdtype = 'c')::int`;

const CONSULTA = `
SELECT
  (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'invoices')::int AS control_positivo,
  (SELECT current_database()) AS base,
  (SELECT string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) FROM pg_enum e
     JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'VfSubmissionStatus') AS enum_valores,
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'vf_submissions')::int AS cols_vf_submissions,
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'vf_flujo_obligado')::int AS cols_vf_flujo_obligado,
  (SELECT udt_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'vf_submissions' AND column_name = 'status') AS tipo_de_status,
  (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'vf_submissions'
     AND indexname IN (${INDICES.map((x) => `'${x}'`).join(', ')}))::int AS indices,
  ${fk('vf_submissions_merchant_id_fkey', 'merchants')} AS fk_merchant_restrict,
  ${fk('vf_submissions_invoice_id_fkey', 'invoices')} AS fk_invoice_restrict,
  (SELECT COUNT(*) FROM pg_constraint k JOIN pg_class t ON t.oid = k.conrelid
     WHERE k.contype = 'f' AND t.relname = 'vf_submissions')::int AS fk_total
`;

const prisma = new PrismaClient({ datasourceUrl: url });
let fila;
try {
  [fila] = await prisma.$queryRawUnsafe(CONSULTA);
} catch (e) {
  const primera = String(e?.message || e).split('\n')[0].slice(0, 160);
  console.error('\n🔴 NO SUPE MIRAR — la consulta no se pudo ejecutar.');
  console.error('   Esto NO significa que falte nada: significa que no se ha comprobado.');
  console.error(`   (${primera})\n`);
  await prisma.$disconnect().catch(() => {});
  process.exit(2);
}
await prisma.$disconnect().catch(() => {});

console.log('\n── LA FILA ─────────────────────────────────────────────────');
for (const [k, v] of Object.entries(fila)) console.log(`   ${k.padEnd(24)} ${v}`);

console.log('\n── VEREDICTO ───────────────────────────────────────────────');
if (fila.control_positivo !== 1) {
  console.log('   🔴 CONTROL POSITIVO EN ROJO: no encuentra ni `invoices`, que existe seguro.');
  console.log('      El verificador está mirando mal. Nada de lo de arriba se puede creer.');
  process.exit(2);
}
console.log('   control positivo: encuentra `invoices` ✅ (así que un 0 de arriba sí significa 0)');

const esperado = {
  enum_valores: ENUM_ESPERADO, cols_vf_submissions: 17, cols_vf_flujo_obligado: 5,
  tipo_de_status: 'VfSubmissionStatus', indices: INDICES.length,
  fk_merchant_restrict: 1, fk_invoice_restrict: 1, fk_total: 2,
};
const faltan = Object.entries(esperado).filter(([k, v]) => fila[k] !== v).map(([k, v]) => `${k} (esperado ${v}, hay ${fila[k]})`);
if (faltan.length) {
  console.log(`   ⚠️  NO CUADRA:\n      ${faltan.join('\n      ')}`);
  process.exit(1);
}
console.log('   ✅ la cola de VeriFactu está entera: enum con sus 5 valores en orden, las 2 tablas,');
console.log('      los 4 índices y las 2 claves ajenas con ON DELETE RESTRICT / ON UPDATE CASCADE.');
