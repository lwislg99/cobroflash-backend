// docs/master/evidencias/SCRUM-1448/sonda-total-del-pdf.mjs — SCRUM-1448c · jv-j1da
//
// SÓLO LEE. Para CADA factura de una base, compara `Invoice.total` (el guardado) con el total que
// imprime su PDF, generado con el `generateInvoicePdf` REAL de dist/ y leído del papel con
// `tests/_texto-del-pdf.mjs`. Es la sonda que pide el enunciado de SCRUM-1448 y que c.21038 reabrió.
//
// Uso:   node --env-file=.env docs/master/evidencias/SCRUM-1448/sonda-total-del-pdf.mjs <raiz> <CLAVE> [--quitar-sembrado]
//        (CLAVE = DATABASE_URL_STAGING | DATABASE_URL_DEV; <raiz> con dist/ compilado)
//
// Los parámetros que deciden el total son los que pasan los TRES llamadores de `generateInvoicePdf`
// (`lib/invoicing.ts` ×2 y `invoicesAdmin.routes.ts`): `total: inv.total.toString()`, `lines` tal
// cual vienen de la columna JSON, `type: inv.type` y `currency`. El emisor y el cliente no entran en
// el total, y van rellenos con un literal de QA: la sonda NO lee nombres ni datos de clientes.
//
// Controles antes de creerse el recuento (calcados de SCRUM-1314c/contar-huellas-sin-anular.mjs):
//   ① la base CONFIRMA el READ ONLY: `SHOW transaction_read_only` = on, y una escritura sobre
//      `invoices` (con `WHERE false`, dentro de un SAVEPOINT) la RECHAZA;
//   ② positivo SEMBRADO: la MISMA consulta, sobre un VALUES fabricado aquí (el banco desechable),
//      pasa por el MISMO camino fila → PDF → papel → comparación. Una JUST con 100,00 guardado y una
//      línea de 100 al 21 % TIENE que salir como discrepancia (imprime 121,00). Con
//      `--quitar-sembrado` se quita esa fila y el veredicto tiene que salir CIEGO, no verde;
//   ③ la población: cuántas filas tiene `invoices`, cuántas se leyeron y cuántos PDF salieron.
//
// 🔴 Se niega a correr contra PRODUCCIÓN por DESTINO. Nunca imprime la URL (regla 9). No escribe
// ninguna fila (regla 29). No toca `src/` (regla 40): carga dist/ y lo llama.
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(process.argv[2] ?? '.');
const CLAVE = process.argv[3];
const QUITAR_SEMBRADO = process.argv.includes('--quitar-sembrado');
const PERMITIDAS = ['DATABASE_URL_STAGING', 'DATABASE_URL_DEV'];
if (!PERMITIDAS.includes(CLAVE)) { console.error(`Clave no permitida: ${CLAVE}. Sólo ${PERMITIDAS.join(' | ')}.`); process.exit(2); }
const url = process.env[CLAVE];
if (!url) { console.error(`${CLAVE} no está en el entorno: NO MEDIDO.`); process.exit(2); }
if (!fs.existsSync(path.join(RAIZ, 'dist/lib/pdf.js'))) { console.error(`CIEGO: no hay dist/ en ${RAIZ}. Compila antes.`); process.exit(2); }

const { HOST_PRODUCCION } = await import(pathToFileURL(path.join(RAIZ, 'scripts', '_clave-vs-destino.mjs')).href);
const { describirBD, parseBDSegura } = await import(pathToFileURL(path.join(RAIZ, 'scripts', '_db-guard.mjs')).href);
const destino = parseBDSegura(url);
if (!destino) { console.error('URL ilegible: NO MEDIDO.'); process.exit(2); }
if (!HOST_PRODUCCION || destino.host === HOST_PRODUCCION) {
  console.error(`🔴 ${CLAVE} apunta a PRODUCCIÓN (${destino.host}) o no se sabe cuál es producción. No se corre.`);
  process.exit(3);
}
console.log(`clave ${CLAVE} → ${describirBD(url)}  (host de producción declarado: distinto: sí)`);

// `invoicesDir` se resuelve contra el directorio del proceso AL CARGAR dist/: se cambia antes, a una
// carpeta temporal del sistema, para que ningún PDF caiga en el árbol.
const { temporal } = await import(pathToFileURL(path.join(RAIZ, 'tests', '_temporal.mjs')).href);
process.on('exit', () => { try { process.chdir(os.tmpdir()); } catch { /* sin a dónde volver */ } });
process.chdir(temporal('scrum1448c-'));

const req = createRequire(path.join(RAIZ, 'package.json'));
const { generateInvoicePdf } = req(path.join(RAIZ, 'dist/lib/pdf.js'));
const { lineasDePdf } = await import(pathToFileURL(path.join(RAIZ, 'tests', '_texto-del-pdf.mjs')).href);
const { PrismaClient } = req('@prisma/client');

const IMPORTE = '-?[\\d.]+,\\d{2}';
const aCent = (s) => Math.round(Number(String(s).replace(/\./g, '').replace(',', '.')) * 100);
const eur = (c) => (c / 100).toFixed(2).replace('.', ',');

/** El total que IMPRIME el papel de esta fila, en céntimos, y de qué rótulo salió. */
let nPdf = 0;
async function totalImpreso(f) {
  const lines = (() => { try { const v = f.lines == null ? null : JSON.parse(f.lines); return Array.isArray(v) ? v : []; } catch { return []; } })();
  const { outPath } = await generateInvoicePdf({
    number: `S1448C-${f.id}`, invoiceId: Number(f.id), merchantId: 0,
    merchant: { name: 'QA' }, customer: { name: 'QA' },
    currency: f.currency, total: f.total, qrData: 'x', vfHash: null,
    lines, type: f.type, zona: null,
  });
  const r = lineasDePdf(fs.readFileSync(outPath));
  fs.rmSync(outPath, { force: true });
  if (!r.ok) throw new Error(`no supe leer el PDF: ${r.motivo}`);
  nPdf += 1;
  const hallados = [];
  for (const { texto: t } of r.lineas) {
    let m = t.match(new RegExp(`^(TOTAL COBRADO|TOTAL):(${IMPORTE}) \\S+$`));
    if (m) hallados.push({ rotulo: m[1], cent: aCent(m[2]) });
    m = t.match(new RegExp(`^(Total): (${IMPORTE}) \\S+$`));
    if (m) hallados.push({ rotulo: m[1], cent: aCent(m[2]) });
  }
  if (hallados.length !== 1) throw new Error(`${hallados.length} totales en el papel (se espera 1)`);
  return { ...hallados[0], conLineas: lines.length > 0 };
}

/** Recorre unas filas y clasifica. Lo usan la base y el sembrado: un solo camino. */
async function medir(filas) {
  const r = { n: 0, coincide: 0, discrepa: 0, ciegas: 0, porTipo: {}, discrepancias: [], errores: [] };
  for (const f of filas) {
    r.n += 1;
    const t = (r.porTipo[`${f.type}${f.lines && f.lines !== '[]' && f.lines !== 'null' ? '' : ' sin líneas'}`] ??= { n: 0, discrepa: 0 });
    t.n += 1;
    let p;
    try { p = await totalImpreso(f); } catch (e) { r.ciegas += 1; r.errores.push(`${f.id}: ${String(e.message).slice(0, 120)}`); continue; }
    const guardado = Math.round(Number(f.total) * 100);
    if (p.cent === guardado) { r.coincide += 1; continue; }
    r.discrepa += 1; t.discrepa += 1;
    r.discrepancias.push({ id: Number(f.id), number: f.number, type: f.type, merchantId: f.merchant_id, vf_estado: f.vf_estado,
      guardado: eur(guardado), impreso: eur(p.cent), rotulo: p.rotulo, dif_cent: p.cent - guardado });
  }
  return r;
}

// La MISMA proyección para la base y para el sembrado.
const COLUMNAS = `id, number, type, total::text AS total, lines::text AS lines, currency, vf_estado, "merchantId" AS merchant_id`;
const L = (price, tax) => ({ concept: 'L', qty: 1, price, tax });
const SEMBRADO = [
  // ⓐ EL POSITIVO: una JUST recalcula de las líneas → imprime 121,00 sobre 100,00 guardado.
  { id: -1, number: 'SIEMBRA-JUST-DISCREPA', type: 'JUST', total: '100.00', lines: [L(100, 0.21)], espera: 'discrepa' },
  // ⓑ la misma fila como F1: desde 624e (#2863) la F1 imprime el GUARDADO → coincide.
  { id: -2, number: 'SIEMBRA-F1-MISMAS', type: 'F1', total: '100.00', lines: [L(100, 0.21)], espera: 'coincide' },
  // ⓒ una JUST cuyas líneas SÍ suman el guardado → coincide.
  { id: -3, number: 'SIEMBRA-JUST-LIMPIA', type: 'JUST', total: '121.00', lines: [L(100, 0.21)], espera: 'coincide' },
].filter((s) => !(QUITAR_SEMBRADO && s.id === -1));
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
const VALUES = SEMBRADO.map((s) => `(${s.id}, ${lit(s.number)}, ${lit(s.type)}, ${s.total}::numeric(12,2), ${lit(JSON.stringify(s.lines))}::jsonb, 'EUR', 'sellada', 0)`).join(', ');
const FUENTE_SEMBRADA = `(VALUES ${VALUES}) AS invoices(id, number, type, total, lines, currency, vf_estado, "merchantId")`;

const prisma = new PrismaClient({ datasourceUrl: url });
let exit = 0;
try {
  let filas; let totalTabla; let sembrado;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    // ① la base confirma el READ ONLY (lo dice, y además lo hace cumplir)
    const [{ transaction_read_only: ro }] = await tx.$queryRawUnsafe('SHOW transaction_read_only');
    await tx.$executeRawUnsafe('SAVEPOINT sonda_ro');
    let rechazo = null;
    try { await tx.$executeRawUnsafe('UPDATE invoices SET status = status WHERE false'); }
    catch (e) { rechazo = String(e?.message ?? '').match(/read-only transaction/)?.[0] ?? null; }
    await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT sonda_ro');
    const roOk = ro === 'on' && rechazo === 'read-only transaction';
    console.log(`① READ ONLY · SHOW=${ro} · escritura con WHERE false → ${rechazo ? 'RECHAZADA' : 'ACEPTADA 🔴'} · ${roOk ? 'OK' : 'FALLA'}`);
    if (!roOk) throw new Error('la base no confirma el READ ONLY: no se mide nada');

    sembrado = await tx.$queryRawUnsafe(`SELECT ${COLUMNAS} FROM ${FUENTE_SEMBRADA} ORDER BY id DESC`);
    filas = await tx.$queryRawUnsafe(`SELECT ${COLUMNAS} FROM invoices ORDER BY id`);
    [{ n: totalTabla }] = await tx.$queryRawUnsafe('SELECT count(*)::int AS n FROM invoices');
  }, { timeout: 60_000 });
  await prisma.$disconnect();

  // ② el positivo sembrado, por el MISMO camino
  const s = await medir(sembrado);
  const esperado = SEMBRADO.map((x) => `${x.number}=${x.espera}`).join(' · ');
  const visto = SEMBRADO.map((x) => `${x.number}=${s.discrepancias.some((d) => d.number === x.number) ? 'discrepa' : (s.errores.some((e) => e.startsWith(`${x.id}:`)) ? 'ciega' : 'coincide')}`).join(' · ');
  const posOk = !QUITAR_SEMBRADO && visto === esperado && s.discrepa === 1;
  console.log(`② sembrado (${SEMBRADO.length} filas, mismo SELECT sobre VALUES) → ${visto}`);
  for (const d of s.discrepancias) console.log(`     ${d.number}: guardado ${d.guardado} · impreso ${d.impreso} («${d.rotulo}»)`);
  console.log(`   esperado ${esperado} · positivo ${posOk ? 'OK' : 'CIEGO'}`);

  // ③ la base, con su población
  const r = await medir(filas);
  console.log(`③ invoices: ${totalTabla} filas en la tabla · ${filas.length} leídas · ${r.n - r.ciegas} PDF leídos · ${r.ciegas} ciegas`);
  console.log(`   coincide ${r.coincide} · DISCREPA ${r.discrepa}`);
  for (const [k, v] of Object.entries(r.porTipo)) console.log(`   ${k.padEnd(16)} ${String(v.n).padStart(5)} filas · discrepa ${v.discrepa}`);
  for (const d of r.discrepancias) console.log('   ' + JSON.stringify(d));
  for (const e of r.errores) console.log(`   ciega ${e}`);
  console.log(`PDF generados y leídos en total: ${nPdf}`);

  const poblacionOk = filas.length === Number(totalTabla) && filas.length > 0 && r.ciegas === 0;
  if (!posOk) { exit = 2; console.log('VEREDICTO: CIEGO — el positivo sembrado no se ve; el recuento real no vale'); }
  else if (!poblacionOk) { exit = 2; console.log(`VEREDICTO: CIEGO — población incompleta (${filas.length} leídas de ${totalTabla}, ${r.ciegas} ciegas)`); }
  else console.log(`VEREDICTO: ${r.discrepa === 0 ? 'VERDE' : 'ROJO'} — ${r.discrepa} de ${r.n} facturas imprimen un total distinto del guardado`);
} catch (e) {
  exit = 1;
  console.error('ERROR (sin URL):', String(e?.message ?? e).replace(/postgres(ql)?:\/\/\S+/g, '<url>').slice(0, 400));
  await prisma.$disconnect().catch(() => {});
}
console.log(`EXIT=${exit}`);
process.exitCode = exit;
