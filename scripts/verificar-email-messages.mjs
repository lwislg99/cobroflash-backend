#!/usr/bin/env node
// scripts/verificar-email-messages.mjs — SCRUM-475 (fase 2)
//
// ¿Está `email_messages` en ESTA base, con sus tres índices? UNA consulta, UNA fila.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// POR QUÉ UNA SOLA FILA, Y NO CUATRO CONSULTAS
//
// Con varias consultas, un número se esconde detrás de otro: se lee «la tabla está» y no se
// mira que faltaba un índice. Una fila con todas las columnas obliga a verlas juntas.
//
// 🔴 EL DISCRIMINADOR VA DELANTE, Y NO ES EL NOMBRE DE LA BASE. `SELECT current_database()`
// devuelve `railway` en staging Y en producción, así que no las separa. Lo que sí: la CUENTA
// DE `invoices` — **dev 0 · staging 7 · producción 55**. Si el número no es el que esperas,
// ESTÁS EN OTRA BASE: para antes de aplicar nada.
//
// ⚠️ PROCEDENCIA DE ESOS NÚMEROS, porque no todos son míos: el **0 de dev lo he medido yo**
// (11-ago-2026, con esta misma consulta). Los de **staging y producción NO**: salen de
// `docs/MIGRATIONS_PENDING.md`, medidos el **7-ago-2026**, y son datos de estado que caducan.
// Un salto de 55 a 7 no se confunde, pero el número exacto puede haberse movido.
//
// ⚠️ LA URL NUNCA VA EN `argv`: se pasa el NOMBRE de la variable, no su valor. Un argumento
// queda en `ps`, en el historial y dentro del `e.message` de cualquier error (SCRUM-195). Aquí
// viaja en el entorno y no se imprime jamás — `parseBDSegura` no tiene forma de devolverla.
//
// USO:
//   node scripts/verificar-email-messages.mjs --clave DATABASE_URL_DEV
//   node scripts/verificar-email-messages.mjs --clave DATABASE_URL_STAGING
//
// Para producción, sin dejarla en el entorno más de lo necesario:
//   read -s -p "URL de produccion: " DATABASE_URL && export DATABASE_URL \
//     && node scripts/verificar-email-messages.mjs --clave DATABASE_URL; unset DATABASE_URL
//
// SOLO LEE. No hay ni un `INSERT`, ni un `UPDATE`, ni DDL: se puede correr contra producción
// sin riesgo, y por eso no se acota a dev como sí hace `aplicar-sql-dev.mjs`.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { describirBD, parseBDSegura } from './_db-guard.mjs';

const args = process.argv.slice(2);
const i = args.indexOf('--clave');
const CLAVE = i >= 0 ? args[i + 1] : null;

function morir(m) { console.error(`\n🔴 ${m}\n`); process.exit(1); }

if (!CLAVE) morir('falta `--clave <NOMBRE_DE_LA_VARIABLE>` (el NOMBRE, nunca la URL).');
const url = process.env[CLAVE];
if (!url) morir(`no hay ${CLAVE} en el entorno. (No se imprime ningún valor de .env.)`);
const bd = parseBDSegura(url);
if (!bd) morir('la URL de la base es ilegible (no se imprime: ilegible ya es toda la información).');

console.log('── DESTINO ─────────────────────────────────────────────────');
console.log(`   clave:   ${CLAVE}`);
console.log(`   destino: ${describirBD(url)}`);

/**
 * UNA consulta, UNA fila. El `control_positivo` es la mitad que impide un falso «no está»:
 * es la MISMA pregunta —¿existe esta tabla?— sobre `invoices`, que existe seguro. Si sale 0,
 * el verificador está roto o mira otro esquema, y entonces el `tabla: 0` de al lado no
 * significa «no está»: significa «no supe mirar».
 */
const CONSULTA = `
SELECT
  (SELECT COUNT(*) FROM invoices)::int AS invoices_discriminador,
  (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'email_messages')::int AS tabla,
  (SELECT COUNT(*) FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = 'email_messages'
       AND indexname = 'email_messages_merchant_id_created_at_idx')::int AS idx_merchant_created,
  (SELECT COUNT(*) FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = 'email_messages'
       AND indexname = 'email_messages_related_type_related_id_idx')::int AS idx_related,
  (SELECT COUNT(*) FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
     WHERE c.relname = 'email_messages_provider_id_key' AND i.indisunique)::int AS unique_provider_id,
  (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'invoices')::int AS control_positivo
`;

const prisma = new PrismaClient({ datasourceUrl: url });
let fila;
try {
  [fila] = await prisma.$queryRawUnsafe(CONSULTA);
} catch (e) {
  // 🔴 EL SUELO. Si la consulta no corre, el resultado es «NO SUPE MIRAR», nunca «no está».
  // Son cosas opuestas y la segunda invita a aplicar el SQL otra vez sobre una base que quizá
  // ya lo tiene. `e.message` de Prisma puede traer la URL: se corta a la primera línea y se
  // dice de dónde salió, sin volcarlo entero.
  const primera = String(e?.message || e).split('\n')[0].slice(0, 160);
  console.error('\n🔴 NO SUPE MIRAR — la consulta no se pudo ejecutar.');
  console.error('   Esto NO significa que la tabla no esté: significa que no se ha comprobado.');
  console.error(`   (${primera})\n`);
  await prisma.$disconnect().catch(() => {});
  process.exit(2);
}
await prisma.$disconnect().catch(() => {});

console.log('\n── LA FILA ─────────────────────────────────────────────────');
for (const [k, v] of Object.entries(fila)) console.log(`   ${k.padEnd(24)} ${v}`);

const esperado = { tabla: 1, idx_merchant_created: 1, idx_related: 1, unique_provider_id: 1 };
const faltan = Object.entries(esperado).filter(([k, v]) => fila[k] !== v).map(([k]) => k);

console.log('\n── VEREDICTO ───────────────────────────────────────────────');
if (fila.control_positivo !== 1) {
  console.log('   🔴 CONTROL POSITIVO EN ROJO: no encuentra ni `invoices`, que existe seguro.');
  console.log('      El verificador está mirando mal. Nada de lo de arriba se puede creer.');
  process.exit(2);
}
console.log('   control positivo: encuentra `invoices` ✅ (así que un 0 de arriba sí significa 0)');
console.log(`   discriminador: ${fila.invoices_discriminador} facturas → `
  + 'dev 0 · staging 7 · producción 55 (staging/prod: MIGRATIONS_PENDING.md, medidos 7-ago-2026)');
if (faltan.length) {
  console.log(`   ⚠️  FALTA: ${faltan.join(', ')} — aplica \`docs/sql/scrum-475-email-messages.sql\`.`);
  process.exit(1);
}
console.log('   ✅ `email_messages` está, con sus dos índices y el unique de `provider_id`.');
