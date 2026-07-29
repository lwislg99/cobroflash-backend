#!/usr/bin/env node
// scripts/conciliar-auditoria-fiscal.mjs — SCRUM-207 · HUECO 3
//
// CUENTA cuántos DOCUMENTOS FISCALES existen sin huella VeriFactu (`vf_hash IS NULL`).
// Es el fallo mudo que midió SCRUM-200 §6.1: el sellado captura la excepción y sigue
// (`lib/invoicing.ts:58` y `:152`), así que la factura sale con número, con PDF y sin
// huella, y lo único que queda es un `console.error` en un servidor.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// SOLO LEE. No escribe, no migra, no repara. Regla 38: observar el camino fiscal no es
// STOP; MODIFICARLO para poder observarlo sí lo es. Este script **no toca ni una línea
// del camino de emisión** — importa `isReceiptNumber` de `dist/`, que ya estaba
// exportada ([invoiceNumber.service.ts:22](../src/modules/invoicing/domain/invoiceNumber.service.ts#L22)),
// y consulta la BD. Cero cambios de firma, cero helpers extraídos, cero instrumentación.
// ─────────────────────────────────────────────────────────────────────────────────────
//
// EL CRITERIO NO SE INVENTA AQUÍ. «Documento que debe llevar huella» es EXACTAMENTE la
// condición que el propio código usa antes de sellar, en sus dos call-sites:
//
//   lib/invoicing.ts:53   inv.merchant.country === 'ES' && inv.merchant.taxId
//                         && !vfHash && !isReceiptNumber(inv.number)
//   lib/invoicing.ts:146  (idéntica)
//
// Si esa condición cambiara en el código y no aquí, este script mediría otra cosa. Por eso
// va copiada con su fichero:línea al lado y `isReceiptNumber` se IMPORTA en vez de
// reimplementarse: el prefijo 'J-' vive en un solo sitio.
//
// LO QUE **NO** ES UN AGUJERO, y por eso sale en cubos aparte en vez de inflar el titular:
//   · Justificantes `J-…`  → jamás entran en la cadena, por diseño (verifactu.service.ts:156).
//   · Factura SIN LÍNEAS   → el sellado está fail-closed a propósito (verifactu.service.ts:179,
//                            SCRUM-149). Sin huella, pero EXPLICADO.
//   · Merchant demo        → emite facturas con marca de agua (regla 8). Se separa para que
//                            el ruido de la demo no se lea como incidencia.
//
// USO
//   node scripts/conciliar-auditoria-fiscal.mjs                 # usa DATABASE_URL
//   node scripts/conciliar-auditoria-fiscal.mjs --staging       # usa DATABASE_URL_STAGING
//   node scripts/conciliar-auditoria-fiscal.mjs --merchant 7
//   node scripts/conciliar-auditoria-fiscal.mjs --desde 2026-01-01 --hasta 2026-07-31
//   node scripts/conciliar-auditoria-fiscal.mjs --csv salida.csv
//   node scripts/conciliar-auditoria-fiscal.mjs --permitir-prod # SOLO el fundador (ver README abajo)
//
// DOS BARRERAS, el mismo modelo que `tests/_staging-db.mjs` (SCRUM-118/165):
//   1) PERTENENCIA del host  → antes de conectar. Prod exige `--permitir-prod` EXPLÍCITO;
//      un host desconocido no pasa nunca (fail-closed, no por descarte).
//   2) SOLO LECTURA de verdad → `SET TRANSACTION READ ONLY` + una SONDA que intenta un
//      UPDATE de 0 filas y **tiene que fallar**. Si no falla, la sesión no era de solo
//      lectura y el script aborta. Un guard que nunca se ha visto actuar es decoración.
//
// Requiere `dist/` (npm run build). Igual que la tanda de tests.
import 'dotenv/config';
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PROD_HOST, STAGING_HOST } from './_db-guard.mjs';
import { esMarcaDeStaging } from './_staging-lock.mjs';
import { clasificarDocumentos } from './_conciliacion-fiscal.mjs';

// ── argumentos ────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const valor = (n) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
};

const usarStaging = flag('--staging');
const permitirProd = flag('--permitir-prod');
const merchantFiltro = valor('--merchant') ? Number(valor('--merchant')) : null;
const desde = valor('--desde') ? new Date(`${valor('--desde')}T00:00:00.000Z`) : null;
const hasta = valor('--hasta') ? new Date(`${valor('--hasta')}T23:59:59.999Z`) : null;
const csvPath = valor('--csv');

for (const [nombre, d] of [['--desde', desde], ['--hasta', hasta]]) {
  if (d && Number.isNaN(d.getTime())) {
    console.error(`❌ ${nombre} no es una fecha válida (formato YYYY-MM-DD).`);
    process.exit(1);
  }
}
if (merchantFiltro !== null && !Number.isInteger(merchantFiltro)) {
  console.error('❌ --merchant necesita un id entero.');
  process.exit(1);
}

// ── BARRERA 1 · pertenencia del host, ANTES de abrir ninguna conexión ─────────────────
const url = usarStaging ? process.env.DATABASE_URL_STAGING : process.env.DATABASE_URL;
if (!url) {
  console.error(`❌ Falta ${usarStaging ? 'DATABASE_URL_STAGING' : 'DATABASE_URL'} en el entorno.`);
  process.exit(1);
}

const LOCALES = new Set(['localhost', '127.0.0.1', '::1', 'host.docker.internal']);
function clasificarHost(u) {
  let h;
  try {
    h = new URL(u).hostname;
  } catch {
    return { clase: 'ilegible', host: '(no parseable)' };
  }
  if (h === PROD_HOST) return { clase: 'prod', host: h };
  if (h === STAGING_HOST) return { clase: 'staging', host: h };
  if (LOCALES.has(h)) return { clase: 'local', host: h };
  return { clase: 'desconocido', host: h };
}

const { clase, host } = clasificarHost(url);

if (clase === 'ilegible') {
  console.error('❌ La URL de la base no se pudo parsear. Abortado: si no se puede identificar, no se corre.');
  process.exit(1);
}
if (clase === 'desconocido') {
  console.error(`❌ Host "${host}" no está en ninguna allowlist conocida (local / ${STAGING_HOST} / ${PROD_HOST}).`);
  console.error('   Fail-closed a propósito: se acepta lo conocido, no se descarta lo malo de ayer (SCRUM-118).');
  process.exit(1);
}
if (clase === 'prod' && !permitirProd) {
  console.error(`\n❌ Esto es PRODUCCIÓN (${host}) y no se ha pasado --permitir-prod.`);
  console.error('   El script solo LEE, pero la decisión de apuntar a prod es de quien la toma a mano,');
  console.error('   no un efecto secundario de tener .env cargado. Repite con --permitir-prod.\n');
  process.exit(1);
}

console.log(`\n🔎 CONCILIACIÓN FISCAL — HUECO 3 (documentos fiscales sin huella VeriFactu)`);
console.log(`   Base: ${clase.toUpperCase()} · host ${host}`);
if (merchantFiltro !== null) console.log(`   Merchant: ${merchantFiltro}`);
if (desde || hasta) {
  console.log(`   Rango: ${desde ? desde.toISOString().slice(0, 10) : '—'} → ${hasta ? hasta.toISOString().slice(0, 10) : '—'}`);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

let salida = 0;
try {
  // ── BARRERA 2 · identidad de la base (informativa) ───────────────────────────────────
  const [meta] = await prisma.$queryRaw`
    SELECT current_database() AS db, shobj_description(oid, 'pg_database') AS marca
    FROM pg_database WHERE datname = current_database()`;
  const marcada = esMarcaDeStaging(meta?.marca);
  console.log(`   Nombre de la base: ${meta?.db ?? '(desconocida)'}${marcada ? ' · marcador YAQU_STAGING ✓' : ''}`);
  if (clase === 'staging' && !marcada) {
    console.error('\n❌ El host dice staging pero la base NO lleva el marcador YAQU_STAGING.');
    console.error('   Abortado: si no se puede verificar de qué base se trata, no se lee.\n');
    process.exit(1);
  }
  if (clase === 'prod' && marcada) {
    console.error('\n❌ El host dice PRODUCCIÓN y la base lleva el marcador de STAGING. Contradicción.');
    console.error('   Abortado: una de las dos señales miente y no se sabe cuál.\n');
    process.exit(1);
  }
  console.log('');

  // ── TODO lo que sigue va dentro de UNA transacción de SOLO LECTURA ───────────────────
  const informe = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');

      // SONDA: un UPDATE que no afecta a ninguna fila TIENE que fallar aquí. Si pasa, la
      // sesión no es de solo lectura y no seguimos. Se prueba el guard en vez de confiar.
      //
      // ⚠️ VA DENTRO DE UN SAVEPOINT, y no es cosmético. En PostgreSQL un error deja la
      // transacción ABORTADA y todo lo siguiente muere con 25P02 («current transaction is
      // aborted»). O sea: la propia sonda tumbaba el informe. `ROLLBACK TO SAVEPOINT`
      // rebobina hasta justo antes del fallo y la transacción vuelve a ser usable.
      // Lo descubrió la primera ejecución real contra staging, no un razonamiento.
      let soloLectura = false;
      await tx.$executeRawUnsafe('SAVEPOINT sonda_solo_lectura');
      try {
        await tx.$executeRawUnsafe('UPDATE audit_log SET id = id WHERE false');
      } catch (e) {
        if (/read-only|solo lectura|25006/i.test(String(e?.message))) soloLectura = true;
        else throw e;
      } finally {
        await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT sonda_solo_lectura');
      }
      if (!soloLectura) {
        throw new Error(
          'la sonda de SOLO LECTURA no falló: la sesión admite escrituras. Abortado antes de leer nada.',
        );
      }

      const rango = desde || hasta
        ? { createdAt: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } }
        : {};
      const where = { ...(merchantFiltro !== null ? { merchantId: merchantFiltro } : {}), ...rango };

      const docs = await tx.invoice.findMany({
        where,
        select: {
          id: true, merchantId: true, number: true, type: true, status: true,
          createdAt: true, vfHash: true, vfAnulHash: true, lines: true,
        },
        orderBy: { id: 'asc' },
      });

      const merchants = await tx.merchant.findMany({
        select: { id: true, country: true, taxId: true, email: true },
      });
      return { docs, merchants };
    },
    { timeout: 120_000, maxWait: 20_000 },
  );

  const cubos = clasificarDocumentos(informe.docs, informe.merchants);

  const n = (a) => String(a.length).padStart(6);
  console.log('┌─ INVENTARIO ────────────────────────────────────────────────────────────────');
  console.log(`│ Documentos leídos                                            ${n(informe.docs)}`);
  console.log(`│   · justificantes J-… (fuera de la cadena por diseño)         ${n(cubos.justificante)}`);
  console.log(`│   · no-ES o merchant sin NIF (el código no sella)             ${n(cubos.noEspanaOSinNif)}`);
  console.log(`│   · facturas fiscales CON huella                             ${n(cubos.selladas)}`);
  console.log('├─ SIN HUELLA, CON EXPLICACIÓN ───────────────────────────────────────────────');
  console.log(`│ H3-B · sin líneas → fail-closed a propósito (SCRUM-149)      ${n(cubos.huecoSinLineas)}`);
  console.log(`│ H3-D · merchant demo (regla 8, marca de agua)                ${n(cubos.huecoDemo)}`);
  console.log('├─ EL AGUJERO ────────────────────────────────────────────────────────────────');
  console.log(`│ H3-A · factura fiscal, CON líneas, SIN huella                ${n(cubos.huecoReal)}`);
  console.log('└─────────────────────────────────────────────────────────────────────────────');

  if (cubos.huecoReal.length > 0) {
    console.log('\n⚠️  H3-A · detalle (máx. 40 filas; usa --csv para el listado completo):');
    console.log('    id      merchant  número                 tipo   estado      creada');
    for (const d of cubos.huecoReal.slice(0, 40)) {
      console.log(
        `    ${String(d.id).padEnd(7)} ${String(d.merchantId).padEnd(9)} ${String(d.number).padEnd(22)} ` +
        `${String(d.type ?? '').padEnd(6)} ${String(d.status ?? '').padEnd(11)} ${d.createdAt.toISOString().slice(0, 10)}`,
      );
    }
    if (cubos.huecoReal.length > 40) console.log(`    … y ${cubos.huecoReal.length - 40} más`);
    salida = 2; // hay agujero → salida distinta de 0, utilizable desde CI o un runbook
  } else {
    console.log('\n✅ H3-A = 0 · ninguna factura fiscal con líneas se quedó sin huella en este rango.');
  }

  if (csvPath) {
    // Solo identificadores, importes NO, datos del cliente NO: esto puede acabar adjunto a
    // un correo. El CSV no es el sitio para minimizar de menos.
    const filas = [
      'id,merchant_id,numero,tipo,estado,creada,tiene_lineas,vf_anul_hash',
      ...cubos.huecoReal.map((d) =>
        [d.id, d.merchantId, JSON.stringify(d.number), d.type ?? '', d.status ?? '',
         d.createdAt.toISOString(), Array.isArray(d.lines) ? d.lines.length : 0,
         d.vfAnulHash ? 'sí' : 'no'].join(','),
      ),
    ];
    fs.writeFileSync(csvPath, `${filas.join('\n')}\n`, 'utf8');
    console.log(`\n📄 CSV escrito: ${csvPath} (${cubos.huecoReal.length} filas)`);
  }

  // ── LO QUE ESTE SCRIPT **NO** PUEDE MEDIR TODAVÍA ────────────────────────────────────
  // Decirlo importa: sin esta nota, un informe con solo H3 se lee como «lo demás está bien».
  console.log('\nℹ️  Los otros huecos del contrato (§7.3 de AUDITLOG_FISCAL_CONTRATO.md) NO se');
  console.log('   pueden medir hoy, y no porque fallen: porque las acciones que necesitan');
  console.log('   todavía no existen en AuditLog (SCRUM-207 sin implementar).');
  console.log('     · HUECO 1 · factura sin `factura_emitida`   → la acción no existe');
  console.log('     · HUECO 2 · sellado sin `factura_sellada`   → la acción no existe');
  console.log('     · HUECO 5 · ámbar aceptado sin emisión      → la acción no existe');
  console.log('   Contarlos ahora daría 100 % en los tres y eso sería una alarma falsa, no un dato.\n');
} catch (err) {
  console.error(`\n❌ Abortado: ${err?.message || err}\n`);
  salida = 1;
} finally {
  await prisma.$disconnect().catch(() => {});
}

process.exit(salida);
