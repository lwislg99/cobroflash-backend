// SCRUM-665 (⓪) · ¿están las siete columnas del emisor congelado en la base de DESARROLLO?
//
// DOS CONTROLES DE TIPOS DISTINTOS (A5), porque un solo censo que se equivoque da un número y
// nadie lo sabe:
//   ① `information_schema.columns` — la vista SQL estándar.
//   ② `pg_attribute` + `pg_class`  — el catálogo interno de Postgres, por otra vía.
// Si los dos no coinciden, se dice y no se promedia.
//
// 🔴 `current_database()` NO ACREDITA NADA AQUÍ: devuelve "railway" en TODAS las bases de Railway
// (medido el 17-sep-2026). Para dejar constancia de SOBRE CUÁL se corrió se usan dos huellas que
// sí distinguen: el arranque del postmaster y el recuento de `invoices`.
//
// ⛔ La URL nunca se imprime ni viaja en argv (SCRUM-195).
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const CLAVE = 'DATABASE_URL_DEV';
const url = process.env[CLAVE];
if (!url) { console.error('🔴 no hay ' + CLAVE + ' en el entorno'); process.exit(2); }

const COLUMNAS = ['merchant_name', 'merchant_legal_name', 'merchant_tax_id', 'merchant_address',
  'merchant_logo_url', 'merchant_phone', 'merchant_email'];

const prisma = new PrismaClient({ datasources: { db: { url } } });
try {
  // ── ACREDITACIÓN DE LA BASE, sin usar su nombre ───────────────────────────────────────────
  const [huella] = await prisma.$queryRaw`
    SELECT pg_postmaster_start_time()::text AS arranque,
           (SELECT count(*) FROM invoices)  AS invoices,
           current_database()               AS nombre_inutil`;
  console.log('── SOBRE QUÉ BASE SE HA CORRIDO ────────────────────────────────────────');
  console.log('   clave usada            : ' + CLAVE);
  console.log('   pg_postmaster_start_time: ' + huella.arranque);
  console.log('   filas en invoices       : ' + huella.invoices);
  console.log('   current_database()      : ' + huella.nombre_inutil + '   ← NO distingue: "railway" en todas');
  console.log('');

  // ── SUELO: ¿existe siquiera la tabla, y ve el censo columnas de verdad? ───────────────────
  const [total1] = await prisma.$queryRaw`
    SELECT count(*)::int AS n FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices'`;
  if (!total1.n) {
    console.error('🔴 CIEGO: `information_schema.columns` ve CERO columnas en `invoices`.');
    console.error('   Un cero aquí no es «faltan las siete»: es que no estoy mirando la tabla.');
    process.exit(3);
  }
  console.log('── SUELO ───────────────────────────────────────────────────────────────');
  console.log('   columnas totales de `invoices` que ve el censo ①: ' + total1.n + '  (si fuera 0, CIEGO)');
  console.log('');

  // ── CONTROL ① · information_schema.columns ───────────────────────────────────────────────
  const uno = await prisma.$queryRaw`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices'
      AND column_name = ANY(${COLUMNAS})
    ORDER BY column_name`;

  // ── CONTROL ② · pg_attribute + pg_class (otra vía, otro catálogo) ────────────────────────
  const dos = await prisma.$queryRaw`
    SELECT a.attname AS column_name, format_type(a.atttypid, a.atttypmod) AS data_type
    FROM pg_attribute a
    JOIN pg_class c     ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'invoices'
      AND a.attnum > 0 AND NOT a.attisdropped
      AND a.attname = ANY(${COLUMNAS})
    ORDER BY a.attname`;

  console.log('── CONTROL ① · information_schema.columns ──────────────────────────────');
  for (const c of uno) console.log('   ' + c.column_name.padEnd(22) + c.data_type);
  console.log('   TOTAL: ' + uno.length + ' de ' + COLUMNAS.length);
  console.log('');
  console.log('── CONTROL ② · pg_attribute + pg_class ────────────────────────────────');
  for (const c of dos) console.log('   ' + c.column_name.padEnd(22) + c.data_type);
  console.log('   TOTAL: ' + dos.length + ' de ' + COLUMNAS.length);
  console.log('');

  const faltan = COLUMNAS.filter((c) => !uno.some((x) => x.column_name === c));
  console.log('── VEREDICTO ───────────────────────────────────────────────────────────');
  console.log('   ① ' + uno.length + '  ·  ② ' + dos.length
    + '   → ' + (uno.length === dos.length ? 'COINCIDEN' : '🔴 DISCREPAN: no se promedia, se mira cuál tiene el suelo firme'));
  console.log('   las siete presentes: ' + (uno.length === 7 && dos.length === 7 ? 'SÍ ✅' : 'NO'));
  if (faltan.length) console.log('   faltan: ' + faltan.join(', '));
} finally {
  await prisma.$disconnect();
}
