// scripts/puerta-cliente-real.mjs — SCRUM-390 · la tercera pieza: leer el padrón REAL.
//
// El evaluador y el censo viven en la suite (no necesitan base). Esto es lo único que sí la
// necesita: contar merchants y suscripciones. Se ejecuta a mano o desde un cron.
//
//   DATABASE_URL="..." node scripts/puerta-cliente-real.mjs
//
// ⚠️ SOLO LEE. Dos `count`, nada más. Y usa `describirBD` para no imprimir jamás la URL (SCRUM-226).
import { describirBD } from './_db-guard.mjs';

const url = process.env.DATABASE_URL || '';
if (!url) { console.error('🔴 sin DATABASE_URL: no se puede mirar, y eso NO es «no ha entrado nadie».'); process.exit(2); }

// ⚠️ El evaluador se importa ESTÁTICAMENTE a propósito: un `const { … } = await import(…)` es
// invisible para el analizador de alcance de SCRUM-411 —lee declaraciones `import`, no
// destructuraciones de una importación dinámica— y este módulo saldría como código muerto. Es un
// hueco real de ese analizador y queda declarado en `docs/master/SCRUM-390.md`; aquí se evita en
// vez de arrastrarlo. Prisma sí va dinámico: no hace falta cargarlo para nada más.
import { evaluarPuerta, textoDelAviso } from '../dist/modules/system/domain/puertaClienteReal.js';

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

try {
  console.log(`  padrón: ${describirBD(url)}`);
  const [total, conSuscripcion] = await Promise.all([
    prisma.merchant.count(),
    prisma.merchant.count({ where: { stripeSubscriptionId: { not: null } } }),
  ]);
  // Las cláusulas se pasan tal cual: este script no las descubre, las nombra quien las censa.
  const v = evaluarPuerta({ total, conSuscripcion }, [
    'docs/YAQU_MASTER.md — la regla fechada de los datos de producción',
    'docs/MIGRATIONS_PENDING.md — el backfill que se dejó caer',
    'SCRUM-402 — el rótulo de Bizum necesita microcopy ANTES de encender la bandera',
  ]);
  console.log(`  ${v.detalle}`);
  if (!v.abierta) { console.log('  ✅ la puerta sigue cerrada: ningún cliente real todavía.'); process.exit(0); }
  console.log('\n🔴 ' + textoDelAviso(v));
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
