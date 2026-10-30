// SCRUM-1405f · J3 · lee el censo.tsv de censo-f.mjs y saca la tabla del registro.
// Uso: node analiza-f.mjs <censo.tsv>
import fs from 'node:fs';

const [cab, ...lineas] = fs.readFileSync(process.argv[2], 'utf8').trimEnd().split('\n');
const col = cab.split('\t');
const filas = lineas.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [col[i], v])));
const cuenta = (xs, k) => xs.reduce((a, f) => ((a[f[k]] = (a[f[k]] || 0) + 1), a), {});

console.log(`FILAS ${filas.length} (runs con el job obligatorio)`);
console.log('ESTADO × EVENTO');
for (const [e, n] of Object.entries(cuenta(filas, 'estado'))) {
  console.log(`  ${e.padEnd(14)} ${String(n).padStart(4)}  ${JSON.stringify(cuenta(filas.filter((f) => f.estado === e), 'evento'))}`);
}
const leidos = filas.filter((f) => f.ob === 'success' || f.ob === 'failure');
console.log(`\nCON VEREDICTO DEL JOB: ${leidos.length} · success ${leidos.filter((f) => f.ob === 'success').length} · failure ${leidos.filter((f) => f.ob === 'failure').length}`);
const b = leidos.map((f) => Number(f.bytes)).sort((x, y) => x - y);
console.log(`bytes del log: mín ${b[0]} · mediana ${b[b.length >> 1]} · máx ${b.at(-1)} · < 1.000.000 B: ${b.filter((x) => x < 1e6).length}`);
console.log(`resumen de la tanda: ${JSON.stringify(cuenta(leidos, 'suma'))} · «TANDA SIN VEREDICTO»: ${leidos.filter((f) => f.sinVeredicto === 'true').length} · ③ ALARMA presente: ${leidos.filter((f) => f.tercero === 'true').length}/${leidos.length}`);

const corr = leidos.filter((f) => f.estado.startsWith('corrió'));
const sinPierde = corr.filter((f) => f.sin && f.sin.split(',').some((x) => Number(x) > 0));
console.log(`\nCORRIÓ ④: ${corr.length} · con las listas: ${corr.filter((f) => f.sin).length} · brazo SIN pierde (decidirCuarto → «medir»): ${sinPierde.length}`);
console.log(`  sonda: ${JSON.stringify(cuenta(corr, 'sonda'))}`);
const cero = corr.filter((f) => f.sonda === '0');
console.log(`  sonda a 0 (antes de 1574 se habrían SALTADO): ${cero.length} · de ellos, brazo SIN pierde: ${cero.filter((f) => f.sin.split(',').some((x) => Number(x) > 0)).length} · por evento ${JSON.stringify(cuenta(cero, 'evento'))}`);
const con = corr.flatMap((f) => (f.con ? f.con.split(',').map(Number) : []));
const pierdenJob = cuenta(corr.map((f) => ({ n: f.con.split(',').filter((x) => Number(x) > 0).length })), 'n');
console.log(`  brazo CON: ${con.length} pasadas · pierden ${con.filter((x) => x > 0).length} · máx por pasada ${Math.max(...con)} (tope 15) · pasadas que pierden por job ${JSON.stringify(pierdenJob)} (tope 2)`);
for (const f of corr.filter((x) => x.estado === 'corrió-cae')) console.log(`  CAE  ${f.cuando} job ${f.job} ${f.evento} ${f.rama} · ${f.motivo} · sin ${f.sin} · con ${f.con}`);

const salt = leidos.filter((f) => f.estado === 'saltado');
console.log(`\nSALTADO ④: ${salt.length} · motivo de decidirCuarto: ${salt.filter((f) => f.motivoEsDeDC === 'true').length} · otro motivo: ${salt.filter((f) => f.motivoEsDeDC !== 'true').length}`);
for (const f of salt) console.log(`  ${f.cuando} job ${f.job} ${f.evento} ${f.rama} · DC=${f.motivoEsDeDC} · «${f.motivo}»`);

const otros = leidos.filter((f) => !f.estado.startsWith('corrió') && f.estado !== 'saltado');
console.log(`\nSIN VEREDICTO DE ④: ${otros.length}`);
for (const f of otros) console.log(`  ${f.estado} ${f.cuando} job ${f.job} ${f.ob} ${f.evento} ${f.rama} · ${f.bytes} B · ${f.motivo} · tests ${f.tests} (${f.suma}) · SIN-VEREDICTO=${f.sinVeredicto}`);
const suma = corr.length + salt.length + otros.length;
console.log(`\nCUADRE: corrió ${corr.length} + saltado ${salt.length} + sin veredicto ${otros.length} = ${suma} de ${leidos.length} ${suma === leidos.length ? '✅' : '🔴 NO CUADRA'}`);
