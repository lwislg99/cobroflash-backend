#!/usr/bin/env node
// scripts/atestiguar-sobres.mjs — SCRUM-438 (fase 1)
//
// EJECUTA LA VERIFICACIÓN DE LOS SOBRES FIRMADOS Y EMITE SU ATESTIGUAMIENTO FECHADO.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// ⚠️ POR QUÉ ESTA SÍ PUEDE APUNTAR A PRODUCCIÓN Y `aplicar-sql-dev.mjs` NO
//
// Porque **no escribe**. Ni el sobre (regla 29), ni el albarán, ni `AuditLog`. Solo lee y emite
// un documento. Un aplicador de SQL acotado a dev y un lector que puede mirar producción no son
// una incoherencia: la diferencia es exactamente si toca algo.
//
// Y no es una promesa: el guard de `tests/scrum438-atestiguar.test.mjs` deriva las llamadas a
// prisma de este fichero y **falla si aparece una que no sea de lectura** — la forma de SCRUM-371.
//
// USO:
//   node scripts/atestiguar-sobres.mjs --clave DATABASE_URL_DEV
//   node scripts/atestiguar-sobres.mjs --clave DATABASE_URL --salida docs/legal/atestiguamientos/prod-2026-08-11.json
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { describirBD, parseBDSegura } from './_db-guard.mjs';
import { exigirDestinoCorrecto } from './_clave-vs-destino.mjs';
import { construirAtestiguamiento, SobreIlegibleError } from '../dist/modules/fiscal/evidencias/atestiguamiento.js';

const args = process.argv.slice(2);
const valor = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const CLAVE = valor('--clave');
const SALIDA = valor('--salida');
const WORKTREE = path.basename(process.cwd());

function morir(m) { console.error(`\n🔴 ${m}\n`); process.exit(1); }
if (!CLAVE) morir('falta `--clave <NOMBRE_DE_LA_VARIABLE>` (p. ej. DATABASE_URL_DEV)');
const url = process.env[CLAVE];
if (!url) morir(`no hay ${CLAVE} en el entorno. (No se imprime ningún valor de .env.)`);

console.log('── DESTINO (solo lectura) ──────────────────────────────────');
console.log(`   clave: ${CLAVE}   (worktree: ${WORKTREE})`);
try { exigirDestinoCorrecto(CLAVE, url, WORKTREE); } catch (e) { morir(`el destino NO cuadra:\n   ${e.message}`); }
if (!parseBDSegura(url)) morir('la URL de la base es ilegible');
console.log(`   destino: ${describirBD(url)}`);

const prisma = new PrismaClient({ datasourceUrl: url });
const ahora = new Date();

try {
  const albaranes = await prisma.albaran.findMany({
    where: { estado: 'firmado' },
    select: {
      id: true, numero: true, fecha: true, modoValoracion: true, lineas: true, notas: true,
      lugarEntrega: true, fechaEntrega: true, firmadoPorNombre: true, firmadoPorCalidad: true,
      evidenciaFirma: true, merchantId: true, jobId: true,
    },
    orderBy: { id: 'asc' },
  });

  // 🔴 SUELO DE POBLACIÓN. Cero firmados NO es «todo verificado»: es que no había nada que mirar,
  // y este documento no puede decir lo mismo en los dos casos.
  console.log(`\n── POBLACIÓN ───────────────────────────────────────────────`);
  console.log(`   albaranes firmados: ${albaranes.length}`);
  if (albaranes.length === 0) {
    morir('SUELO: CERO albaranes firmados en esta base. No se emite atestiguamiento: «nada que atestiguar» y «todo verificado» no son lo mismo.');
  }

  const documentos = [];
  const ciegos = [];
  for (const a of albaranes) {
    const [job, merchant] = await Promise.all([
      prisma.job.findFirst({ where: { id: a.jobId, merchantId: a.merchantId }, select: { direccion: true, titulo: true, customerId: true } }),
      prisma.merchant.findUnique({ where: { id: a.merchantId }, select: { name: true, legalName: true, taxId: true } }),
    ]);
    const customer = job
      ? await prisma.customer.findFirst({ where: { id: job.customerId, merchantId: a.merchantId }, select: { name: true, legalName: true } })
      : null;
    try {
      documentos.push(construirAtestiguamiento({ albaran: a, job, customer, merchant, ahora }));
    } catch (e) {
      if (e instanceof SobreIlegibleError) { ciegos.push({ numero: a.numero, motivo: e.message }); continue; }
      throw e;
    }
  }

  console.log('\n── ATESTIGUAMIENTO ─────────────────────────────────────────');
  for (const d of documentos) {
    const marca = d.resultado.cuadra ? '✅ CUADRA' : '🔴 NO CUADRA';
    console.log(`   ${marca}  ${d.albaran.numero}  (sobre v:${d.sobre.version})`);
    if (!d.resultado.cuadra) console.log(`      ${d.resultado.mensaje}`);
  }
  for (const c of ciegos) console.log(`   ⚠️  ${c.numero}: NO SE PUDO MIRAR — ${c.motivo}`);

  // 🔴 Y el suelo otra vez, del lado del resultado: si NINGUNO se pudo atestiguar, esto no es un
  // informe de integridad, es un informe de ceguera. No sale por la puerta del éxito.
  if (documentos.length === 0) {
    morir(`SUELO: había ${albaranes.length} albarán(es) firmado(s) y NO SE PUDO ATESTIGUAR NINGUNO.`);
  }

  const salida = JSON.stringify({ base: describirBD(url), atestiguadoAt: ahora.toISOString(), documentos, ciegos }, null, 2);
  if (SALIDA) {
    fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
    fs.writeFileSync(SALIDA, salida + '\n', 'utf8');
    console.log(`\n   escrito: ${SALIDA}`);
  } else {
    console.log('\n── DOCUMENTO (pásale `--salida <fichero>` para guardarlo) ───');
    console.log(salida);
  }
  console.log(`\n   ${documentos.length} atestiguado(s) · ${ciegos.length} sin poder mirar\n`);
  if (ciegos.length) process.exit(2); // ni éxito ni fallo: hay huecos, y se distinguen
} finally {
  await prisma.$disconnect();
}
