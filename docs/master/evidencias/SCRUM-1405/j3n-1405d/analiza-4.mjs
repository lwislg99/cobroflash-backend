// SCRUM-1405d · lee censo.tsv (de censo-4.mjs) y da la distribución de la pérdida CON y SIN el módulo.
import fs from 'node:fs';
const [, , tsv] = process.argv;
const [cab, ...lineas] = fs.readFileSync(tsv, 'utf8').trim().split('\n');
const k = cab.split('\t');
const filas = lineas.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [k[i], v])));
console.log(`POBLACIÓN · ${filas.length} jobs obligatorios con veredicto · bytes min ${Math.min(...filas.map((f) => +f.bytes))} max ${Math.max(...filas.map((f) => +f.bytes))}`);
const est = {};
for (const f of filas) est[f.estado] = (est[f.estado] || 0) + 1;
console.log('estados', JSON.stringify(est));
const med = filas.filter((f) => f.con);
const num = (s) => s.split(',').map(Number);
const hist = (xs) => { const h = {}; for (const x of xs) h[x] = (h[x] || 0) + 1; return h; };

function resumen(nombre, fs_) {
  const con = fs_.flatMap((f) => num(f.con)), sin = fs_.flatMap((f) => num(f.sin));
  const pasCon = con.filter((x) => x > 0), pasSin = sin.filter((x) => x > 0);
  const porJob = hist(fs_.map((f) => num(f.con).filter((x) => x > 0).length));
  const sinPorJob = hist(fs_.map((f) => num(f.sin).filter((x) => x > 0).length));
  const totCon = con.reduce((a, b) => a + b, 0), totSin = sin.reduce((a, b) => a + b, 0);
  const conMenor = fs_.filter((f) => num(f.con).reduce((a, b) => a + b, 0) < num(f.sin).reduce((a, b) => a + b, 0)).length;
  console.log(`\n== ${nombre} · jobs ${fs_.length} · pasadas por brazo ${con.length}`);
  console.log(`  CON: pasadas que pierden ${pasCon.length}/${con.length} (${(100 * pasCon.length / con.length).toFixed(1)} %) · casos perdidos ${totCon} de ${con.length * 320} · máx por pasada ${Math.max(...con)}`);
  console.log(`       pasadas que pierden por job: ${JSON.stringify(porJob)}`);
  console.log(`       histograma de lo que pierde una pasada que pierde: ${JSON.stringify(hist(pasCon))}`);
  console.log(`  SIN: pasadas que pierden ${pasSin.length}/${sin.length} (${(100 * pasSin.length / sin.length).toFixed(1)} %) · casos perdidos ${totSin} · mín por pasada ${Math.min(...sin)} · máx ${Math.max(...sin)}`);
  console.log(`       pasadas que pierden por job: ${JSON.stringify(sinPorJob)}`);
  console.log(`  jobs con total CON < total SIN: ${conMenor}/${fs_.length}`);
}
resumen('TODO', med);
const orden = [...med].sort((a, b) => a.cuando.localeCompare(b.cuando));
const mitad = Math.floor(orden.length / 2);
resumen(`1.ª mitad ${orden[0].cuando} → ${orden[mitad - 1].cuando}`, orden.slice(0, mitad));
resumen(`2.ª mitad ${orden[mitad].cuando} → ${orden.at(-1).cuando}`, orden.slice(mitad));
const dias = {};
for (const f of orden) (dias[f.cuando.slice(0, 10)] ||= []).push(f);
console.log('\n== por día: jobs · jobs con alguna pasada CON pérdida · pasadas CON que pierden');
for (const [d, fs_] of Object.entries(dias)) {
  const con = fs_.flatMap((f) => num(f.con));
  console.log(`  ${d} · ${fs_.length} · ${fs_.filter((f) => num(f.con).some((x) => x > 0)).length} · ${con.filter((x) => x > 0).length}/${con.length}`);
}
for (const ev of ['push', 'pull_request']) {
  const fs_ = med.filter((f) => f.evento === ev);
  const con = fs_.flatMap((f) => num(f.con));
  console.log(`  evento ${ev}: jobs ${fs_.length} · con alguna pérdida ${fs_.filter((f) => num(f.con).some((x) => x > 0)).length} · pasadas ${con.filter((x) => x > 0).length}/${con.length}`);
}
console.log('\n== saltados'); for (const f of filas.filter((f) => f.estado === 'saltado')) console.log(`  ${f.cuando} ${f.run} ${f.evento} ${f.rama} ${f.obligatorio} ${f.bytes}`);
console.log('EXIT=0');
