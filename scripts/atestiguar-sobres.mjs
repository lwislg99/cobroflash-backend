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
// USO: `--help` lo cuenta entero, incluida la invocación de producción. Vive AHÍ y no en un
// documento aparte: quien va a ejecutar esto tiene el script delante, no el documento.
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

/**
 * 🔴 LA INVOCACIÓN DE PRODUCCIÓN VIVE EN EL `--help`, NO EN UN DOCUMENTO APARTE.
 *
 * Quien va a ejecutar esto tiene el script delante; el documento se queda en otra pestaña. Y hay
 * un guard que compara este texto con lo aprobado, para que no se separe del que se usa.
 */
export const AYUDA = `
atestiguar-sobres — ejecuta la verificación de los sobres firmados y emite su atestiguamiento.

  SOLO LEE. No toca el sobre (regla 29), ni el albarán, ni AuditLog. Por eso —y solo por eso—
  esta herramienta sí puede apuntar a producción.

USO
  node scripts/atestiguar-sobres.mjs --clave <NOMBRE_DE_LA_VARIABLE> [--salida <fichero.json>]

  --clave    NOMBRE de la variable de entorno con la URL. Nunca el valor: un valor en argv queda
             en \`ps\` y en el historial, y dentro del \`e.message\` de cualquier error.
  --salida   dónde escribir el documento. Sin ella, se imprime por pantalla.

  Salidas:  0 = todos atestiguados · 2 = hay sobres que no se pudieron mirar · 1 = ninguno.

DÓNDE SE GUARDA EL DOCUMENTO
  En \`docs/legal/atestiguamientos/\`, y entra al repo por PR (decisión del asesor, 11-ago-2026).
  No en AuditLog: además de ser una unión cerrada, **se escribe en 10 sitios y no se lee en
  ninguno** — meter ahí un documento legal es guardarlo donde nadie va a mirar. Un fichero en git
  tiene historia inmutable, revisión antes de entrar y alguien que lo lee para aprobarlo.

EN DESARROLLO
  node scripts/atestiguar-sobres.mjs --clave DATABASE_URL_DEV

EN PRODUCCIÓN — esta invocación exacta, que no deja la credencial en el historial ni en \`ps\`
  read -s -p "URL de produccion: " DATABASE_URL && export DATABASE_URL \\
    && node scripts/atestiguar-sobres.mjs --clave DATABASE_URL \\
         --salida docs/legal/atestiguamientos/produccion-2026-08-11.json ; \\
     unset DATABASE_URL

  \`read -s\` no hace eco y no entra en el historial. El \`unset\` va tras \`;\` y no tras \`&&\`
  a propósito: tiene que ejecutarse tanto si el script sale bien como si falla.
`;

if (args.includes('--help') || args.includes('-h')) { console.log(AYUDA); process.exit(0); }
if (!CLAVE) morir(`falta \`--clave <NOMBRE_DE_LA_VARIABLE>\`. Prueba \`--help\`.`);
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
