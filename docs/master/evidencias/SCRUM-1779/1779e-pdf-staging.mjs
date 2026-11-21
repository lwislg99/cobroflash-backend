// SCRUM-1779e · lee los dos PDF bajados de STAGING (cuenta QA) con el lector de la casa.
//   F260003 (id 1978) · emitida el 21-nov-2026 con INVOICING_ES_ENABLED ON y SIF_ENABLED OFF (override del comercio QA).
//   F260002 (id 1977) · CONTROL POSITIVO: factura de staging del mismo comercio, sellada el 20-nov-2026 (antes de 1779d).
// Uso: node docs/master/evidencias/SCRUM-1779/1779e-pdf-staging.mjs <F260003.pdf> <F260002.pdf> [--sin-control]
// Sale 0 solo si: la nueva no tiene ninguna mención ni imagen, Y el control SÍ las tiene (si el control
// no está o no las tiene, el instrumento es CIEGO y sale 2, no verde).
import fs from 'node:fs';
import zlib from 'node:zlib';
import { lineasDePdf, extraerTextoPdf, vecesEnPdf } from '../../../../tests/_texto-del-pdf.mjs';

const [nuevaPath, controlPath] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const sinControl = process.argv.includes('--sin-control');
const AGUJAS = ['VERI*FACTU', 'VeriFactu', 'verificable', 'AEAT', 'agenciatributaria', 'Huella', 'QR', 'RD 1007/2023'];

function leer(buf) {
  const r = lineasDePdf(buf);
  if (r.ok) return { lineas: r.lineas.map((l) => l.texto), texto: r.texto, modo: 'lineasDePdf' };
  const t = extraerTextoPdf(buf);
  return { lineas: [t.texto], texto: t.texto, modo: 'extraerTextoPdf' };
}
function imagenes(buf) {
  const s = buf.toString('latin1');
  return (s.match(/\/Subtype\s*\/Image/g) || []).length;
}
function operadoresDo(buf) {
  const s = buf.toString('latin1');
  let n = 0; let i = 0;
  while ((i = s.indexOf('stream', i)) !== -1) {
    const desde = i + 6 + (s[i + 6] === '\r' ? 2 : 1);
    const hasta = s.indexOf('endstream', desde);
    if (hasta === -1) break;
    try { const t = zlib.inflateSync(Buffer.from(s.slice(desde, hasta), 'latin1')).toString('latin1'); n += (t.match(/\/I\w*\s+Do\b/g) || []).length; } catch { /* no comprimido */ }
    i = hasta + 9;
  }
  return n;
}
function informe(etq, p) {
  const buf = fs.readFileSync(p);
  const r = leer(buf);
  // ⚠️ El concepto que tecleé al emitir dice «Prueba SCRUM-1779e · factura sin VeriFactu»: la palabra
  // «VeriFactu» la sembré YO (error propio, A9). Se excluye SOLO esa línea, por su prefijo exacto, y el
  // recuento bruto se imprime al lado para que se vea qué se quitó.
  const SEMBRADA = 'Prueba SCRUM-1779e';
  const sinSembrada = r.lineas.filter((l) => !l.startsWith(SEMBRADA)).join('\n');
  const cuentas = Object.fromEntries(AGUJAS.map((a) => [a, vecesEnPdf(sinSembrada, a)]));
  const brutas = Object.fromEntries(AGUJAS.map((a) => [a, vecesEnPdf(r.texto, a)]));
  console.log(`   líneas excluidas por ser el concepto tecleado: ${r.lineas.length - sinSembrada.split('\n').length} · recuento BRUTO: ${JSON.stringify(brutas)}`);
  const out = { etq, bytes: buf.length, modo: r.modo, lineas: r.lineas.length, cuentas, imagenes: imagenes(buf), Do: operadoresDo(buf) };
  console.log(`── ${etq} · ${buf.length} B · ${r.modo} · ${r.lineas.length} líneas`);
  for (const l of r.lineas) console.log('   | ' + l);
  console.log(`   menciones: ${JSON.stringify(cuentas)} · imágenes: ${out.imagenes} · operadores Do: ${out.Do}`);
  return { ...out, texto: r.texto };
}

let fallos = 0;
const ok = (c, t) => { if (!c) fallos++; console.log(`${c ? 'OK   ' : 'FALLO'} ${t}`); };
const N = informe('F260003 · SIF OFF (la nueva)', nuevaPath);
ok(N.lineas > 3 && vecesEnPdf(N.texto, 'F260003') >= 1, `población: la nueva se lee (${N.lineas} líneas) y lleva su número F260003`);
ok(vecesEnPdf(N.texto, '12,10') >= 1, 'positivo sembrado en la propia nueva: el total «12,10» aparece');
for (const a of AGUJAS) ok(N.cuentas[a] === 0, `la nueva NO lleva «${a}» (${N.cuentas[a]})`);
ok(N.imagenes === 0 && N.Do === 0, `la nueva no lleva imagen (QR): ${N.imagenes} objetos imagen, ${N.Do} Do`);

if (sinControl) { console.log('CIEGO: sin control positivo'); process.exit(2); }
if (!controlPath || !fs.existsSync(controlPath)) { console.log('CIEGO: falta el PDF de control'); process.exit(2); }
const C = informe('F260002 · sellada (CONTROL POSITIVO)', controlPath);
const vioLeyenda = C.cuentas['VERI*FACTU'] >= 1 && C.cuentas.AEAT >= 1;
const vioQr = C.imagenes >= 1;
console.log(`${vioLeyenda && vioQr ? 'OK   ' : 'CIEGO'} control: el mismo lector SÍ ve en la sellada «VERI*FACTU»=${C.cuentas['VERI*FACTU']}, «AEAT»=${C.cuentas.AEAT}, imágenes=${C.imagenes}`);
if (!(vioLeyenda && vioQr)) process.exit(2);
console.log(fallos ? `ROJO · ${fallos} fallo(s)` : 'VERDE · la nueva sale sin VeriFactu y el control lo ve');
process.exit(fallos ? 1 : 0);
