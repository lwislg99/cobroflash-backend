// SCRUM-935 · proyección CORREGIDA por perfil.
// La proyección lineal (s/mutación medio) sobrestima: el coste por mutación NO es uniforme —
// en la pasada verde las últimas (scrum951d, utils, vigia-atascados) cuestan 0,3 s y las del
// medio 2-3 s. Aquí se usa el PERFIL ACUMULADO de una pasada que sí llegó al final:
//
//   fracción de trabajo hecha = (tiempo acumulado en la REFERENCIA hasta la última mutación
//                                que la pasada cortada alcanzó) / (tiempo total de la referencia)
//   proyección = fase de mutación de la cortada / esa fracción + lo que no es mutación
//
// Declara lo que NO puede decir: la referencia tiene 307 mutaciones y las pasadas del 17-18 sep
// tenían 274-301, así que su orden no es idéntico. Se cruza por NOMBRE, no por posición.
import fs from 'node:fs';
import path from 'node:path';

const entrada = process.argv[2];
const cache = process.argv[3];
const datos = JSON.parse(fs.readFileSync(entrada, 'utf8'));

const RES = /^(\S+Z) {2,}([✔✘])\s(.*)$/u;
const CENSO = /árbol VIGILADO durante las (\d+) mediciones/;
const ARRANQUE = /Run npm run meta:mutaciones/;

function leer(jobId) {
  const f = path.join(cache, `job-${jobId}.txt`);
  if (!fs.existsSync(f)) return null;
  const lineas = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  const muts = []; let total = null, tArranque = null;
  for (const l of lineas) {
    if (tArranque == null && ARRANQUE.test(l)) { const m = l.match(/^(\S+Z)/); if (m) tArranque = Date.parse(m[1]); }
    const r = l.match(RES);
    if (r) { muts.push({ t: Date.parse(r[1]), clave: r[3].trim() }); continue; }
    const c = l.match(CENSO); if (c) total = Number(c[1]);
  }
  return { muts, total, tArranque };
}

const conJob = datos.filas.filter((f) => f.seg != null && f.jobId);
const leidos = new Map();
for (const f of conJob) { const d = leer(f.jobId); if (d && d.muts.length) leidos.set(f.jobId, { f, ...d }); }

// REFERENCIA: la pasada completa (total != null) con más mutaciones y la MÁS LENTA de ellas,
// para no quedarnos cortos al proyectar.
const completas = [...leidos.values()].filter((x) => x.total != null);
const nMax = Math.max(...completas.map((x) => x.total));
const ref = completas.filter((x) => x.total === nMax).sort((a, b) => b.f.seg - a.f.seg)[0];
console.log(`POBLACIÓN · logs leídos ${leidos.size} · completas ${completas.length} · cortadas ${leidos.size - completas.length}`);
console.log(`REFERENCIA · run ${ref.f.run} (${ref.f.rama}) · ${ref.total} mutaciones · job ${Math.round(ref.f.seg)} s`);

// perfil acumulado de la referencia: para cada clave, qué fracción del tiempo de mutación
// se había consumido al TERMINARLA
const t0 = ref.muts[0].t, tN = ref.muts[ref.muts.length - 1].t;
const fase = (tN - t0) / 1000;
const frac = new Map();
for (const m of ref.muts) frac.set(m.clave, ((m.t - t0) / 1000) / fase);
console.log(`  fase de mutación de la referencia: ${fase.toFixed(0)} s de los ${ref.f.seg} s del job (el resto: checkout, npm ci, tsc)`);

const cortadas = [...leidos.values()].filter((x) => x.total == null);
console.log('\nPASADAS CORTADAS · proyección por PERFIL (no lineal)');
console.log('  dur.job  hechas  última mutación alcanzada → % del trabajo   proyección   run');
const proy = [];
let sinCruce = 0;
for (const c of cortadas.sort((a, b) => a.f.creado.localeCompare(b.f.creado))) {
  const ultima = c.muts[c.muts.length - 1].clave;
  const f = frac.get(ultima);
  if (f == null || f <= 0) { sinCruce++; console.log(`  ${String(c.f.seg).padStart(5)} s  ${String(c.muts.length).padStart(6)}  CIEGO · esa mutación no existe en la referencia (${ultima.slice(0, 40)})`); continue; }
  const faseC = (c.muts[c.muts.length - 1].t - c.muts[0].t) / 1000;
  const fueraDeFase = c.f.seg - faseC; // checkout + npm ci + tsc + lo previo a la 1ª mutación
  const proyectado = fueraDeFase + faseC / f;
  proy.push(proyectado);
  console.log(`  ${String(c.f.seg).padStart(5)} s  ${String(c.muts.length).padStart(6)}  ${(f * 100).toFixed(1).padStart(5)} %   ${Math.round(proyectado).toString().padStart(6)} s = ${Math.floor(proyectado / 60)}:${String(Math.round(proyectado % 60)).padStart(2, '0')}   ${c.f.run} ${c.f.creado.slice(0, 16)}`);
}
if (sinCruce) console.log(`  (${sinCruce} sin cruce: se declaran ciegas y NO entran en la distribución)`);

const todas = [...completas.map((x) => x.f.seg), ...proy].sort((a, b) => a - b);
const q = (p) => todas[Math.min(todas.length - 1, Math.floor(p * todas.length))];
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
console.log(`\nDISTRIBUCIÓN DEL JOB (reales + proyectadas por perfil) · n=${todas.length}`);
console.log(`  mín ${fmt(todas[0])} · p50 ${fmt(q(0.5))} · p75 ${fmt(q(0.75))} · p90 ${fmt(q(0.9))} · p95 ${fmt(q(0.95))} · máx ${fmt(todas[todas.length - 1])}`);
console.log(`  por encima de los 600 s del techo actual: ${todas.filter((s) => s > 600).length} de ${todas.length}`);

// crecimiento de la población de mutaciones
const porFecha = completas.map((x) => ({ d: x.f.creado.slice(0, 10), n: x.total })).sort((a, b) => a.d.localeCompare(b.d));
const porDia = new Map();
for (const p of porFecha) porDia.set(p.d, Math.max(porDia.get(p.d) || 0, p.n));
console.log('\nLA POBLACIÓN DE MUTACIONES CRECE (por eso un techo fijo se vuelve a cruzar):');
for (const [d, n] of [...porDia].sort()) console.log(`  ${d} · ${n} mutaciones declaradas`);
console.log('EXIT=0');
