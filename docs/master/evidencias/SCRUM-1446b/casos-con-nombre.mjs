// SCRUM-1446b · Los casos CON NOMBRE, antes y después, leídos de dos volcados de `volcar.mjs`.
//
//   node docs/master/evidencias/SCRUM-1446b/casos-con-nombre.mjs antes.jsonl despues.jsonl
//
// No calcula nada: enseña lo que cada árbol imprimió y construyó para una línea al 7,5 %, y cuenta
// qué campos del dominio cambian en TODOS los casos con 7,5 % (lo guardado y la cuota no deben).
import fs from 'node:fs';

const [, , fa, fd] = process.argv;
const leer = (f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const A = leer(fa); const D = leer(fd);
if (A.length === 0 || A.length !== D.length) { console.log('CIEGO: los volcados no casan.'); process.exit(2); }

const soloDecimal = (x) => x.tipos.length === 1 && x.tipos[0] === 0.075;
const papel = (t) => t.filter((l) => /%|Total|TOTAL|Base|Descuento|Suma/.test(l)).join(' | ');
for (const clase of ['papel-factura-100', 'papel-presupuesto-100', 'papel-presupuesto-100-global-10']) {
  const i = A.findIndex((x) => x.clase === clase && soloDecimal(x));
  console.log(`${clase} · 100,00 € al 7,5 %`);
  console.log('  ANTES   ' + papel(A[i].salida));
  console.log('  DESPUÉS ' + papel(D[i].salida));
}

const i = A.findIndex((x) => x.clase === 'dominio-1-linea' && soloDecimal(x) && x.salida.desglose.base === 20);
console.log('dominio · una línea de 20,00 € al 7,5 %, con 10,00 € de descuento global');
for (const [nombre, X] of [['ANTES  ', A[i]], ['DESPUÉS', D[i]]]) {
  const s = X.salida;
  console.log(`  ${nombre} desglose ${JSON.stringify(s.desglose.entries)} · guardado ${s.guardado} · firmado ${s.firmado} · firmado con global ${s.firmadoConGlobal}`);
  console.log(`  ${nombre} línea del descuento: tax ${s.paraFacturar[0].tax} · portón: ${s.porton ?? 'pasa'}`);
  console.log(`  ${nombre} pie con global: ${s.pieConGlobal.map((f) => `${f.etiqueta} ${f.importe}`).join(' · ')}`);
  console.log(`  ${nombre} registro: ${String(s.registro).replace(/\s+/g, ' ').trim()}`);
}

const campos = ['guardado', 'firmado', 'firmadoConGlobal'];
const cambia = { guardado: 0, firmado: 0, firmadoConGlobal: 0, cuotaTotal: 0, baseTotal: 0, registro: 0 };
let n = 0;
for (let k = 0; k < A.length; k++) {
  const a = A[k]; const d = D[k];
  if (!a.clase.startsWith('dominio') || !a.tipos.includes(0.075)) continue;
  n += 1;
  for (const c of campos) if (a.salida[c] !== d.salida[c]) cambia[c] += 1;
  if (a.salida.desglose.cuota !== d.salida.desglose.cuota) cambia.cuotaTotal += 1;
  if (a.salida.desglose.base !== d.salida.desglose.base) cambia.baseTotal += 1;
  if (a.salida.registro !== d.salida.registro) cambia.registro += 1;
}
console.log(`casos de dominio con 7,5 %: ${n} · cambia lo GUARDADO ${cambia.guardado} · la CUOTA total ${cambia.cuotaTotal} · la BASE total ${cambia.baseTotal} · lo firmado sin global ${cambia.firmado} · lo firmado CON global ${cambia.firmadoConGlobal} · el registro ${cambia.registro}`);
