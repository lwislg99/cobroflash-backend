// SCRUM-1625 · J3 · lee cov.tsv (de covariables.mjs) y cruza la pérdida del brazo CON con cada covariable.
// Uso: node analiza.mjs <cov.tsv>
//
// Unidad: la PASADA del brazo CON (4 por job). «Pierde» = faltan > 0. Toda tasa va con su población.
// Para separar una covariable del paso del tiempo (todo crece con el tiempo: tests, bytes, duración), la
// pata que decide es la de los días en que conviven dos valores de la covariable: misma fecha, distinto valor.
import fs from 'node:fs';

const [cab, ...ls] = fs.readFileSync(process.argv[2], 'utf8').trimEnd().split('\n');
const col = cab.split('\t');
const todas = ls.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [col[i], v])));
const filas = todas.filter((f) => f.estado === 'ok');
const pas = (f) => f.con.split(',').map(Number);
const tasa = (xs) => {
  const p = xs.flatMap(pas);
  const pierden = p.filter((x) => x > 0).length;
  return { jobs: xs.length, pasadas: p.length, pierden, pct: p.length ? (100 * pierden / p.length).toFixed(1) : '—', max: p.length ? Math.max(...p) : '—', casos: p.reduce((a, b) => a + b, 0) };
};
const linea = (et, xs) => { const t = tasa(xs); return `  ${et.padEnd(28)} jobs ${String(t.jobs).padStart(4)} · pasadas ${String(t.pasadas).padStart(5)} · pierden ${String(t.pierden).padStart(4)} (${String(t.pct).padStart(4)} %) · máx ${t.max} · casos ${t.casos}`; };
const grupo = (titulo, clave, xs = filas, orden) => {
  console.log(`\n== ${titulo}`);
  const g = {};
  for (const f of xs) (g[clave(f)] ||= []).push(f);
  const ks = Object.keys(g).sort(orden);
  for (const k of ks) console.log(linea(k, g[k]));
  return g;
};
const dia = (f) => f.cuando.slice(0, 10);
const num = (a, b) => Number(a.split(/[^\d.]/)[0]) - Number(b.split(/[^\d.]/)[0]);

console.log(`POBLACIÓN · ${todas.length} filas · ok ${filas.length} · ${JSON.stringify(todas.reduce((a, f) => ((a[f.estado] = (a[f.estado] || 0) + 1), a), {}))}`);
for (const f of todas.filter((x) => x.estado !== 'ok')) console.log(`  ${f.estado} ${f.cuando} job ${f.job} · ${f.motivo}`);
console.log(linea('TODO', filas));
grupo('por censo', (f) => f.censo);
grupo('por día', dia);
grupo('por versión de node', (f) => f.node);
grupo('por imagen del runner', (f) => f.imagen);
grupo('por versión del runner', (f) => f.runner);
grupo('por región', (f) => f.region);
grupo('por evento', (f) => f.evento);
grupo('por sonda (vacía = antes de 1574)', (f) => f.sonda || '(sin)');
const tramo = (x, cortes) => { for (const c of cortes) if (x < c) return `< ${c}`; return `≥ ${cortes.at(-1)}`; };
grupo('por nº de tests de la tanda', (f) => tramo(Number(f.tests), [11500, 11900, 12200, 12500, 12800]), filas, num);
grupo('por duración de la tanda (s)', (f) => tramo(Number(f.tandaMs) / 1000, [560, 600, 640, 680, 720, 760]), filas, num);
grupo('por duración de ④ (ms)', (f) => tramo(Number(f.cuartoMs), [3000, 3500, 4000, 4500, 5000, 6000]), filas, num);
grupo('por segundo de la tanda en que acaba ④', (f) => tramo(Number(f.cuartoA), [100, 140, 180, 220, 260]), filas, num);

// La pata que separa una covariable del tiempo: días con DOS valores a la vez.
for (const [nombre, clave] of [['node', (f) => f.node], ['imagen', (f) => f.imagen], ['región', (f) => f.region]]) {
  console.log(`\n== MISMO DÍA, distinto ${nombre} (sólo días con dos o más valores)`);
  const porDia = {};
  for (const f of filas) ((porDia[dia(f)] ||= {})[clave(f)] ||= []).push(f);
  let n = 0;
  for (const d of Object.keys(porDia).sort()) {
    const vs = Object.keys(porDia[d]);
    if (vs.length < 2) continue;
    n++;
    for (const v of vs.sort()) console.log(linea(`${d} ${v}`, porDia[d][v]));
  }
  if (!n) console.log('  (ningún día con dos valores: esta covariable NO se puede separar del tiempo con estos datos)');
}

// ¿Escalón o rampa? El mejor corte único en el tiempo (máxima verosimilitud binomial a dos tasas) y su ganancia.
const orden = [...filas].sort((a, b) => a.cuando.localeCompare(b.cuando));
const ll = (k, n) => (k && k < n ? k * Math.log(k / n) + (n - k) * Math.log(1 - k / n) : 0);
const P = orden.map((f) => [pas(f).filter((x) => x > 0).length, 4]);
const K = P.reduce((a, [k]) => a + k, 0), N = P.reduce((a, [, n]) => a + n, 0);
let mejor = { g: -1 };
let k1 = 0, n1 = 0;
for (let i = 0; i < orden.length - 1; i++) {
  k1 += P[i][0]; n1 += P[i][1];
  if (n1 < 200 || N - n1 < 200) continue;
  const g = ll(k1, n1) + ll(K - k1, N - n1) - ll(K, N);
  if (g > mejor.g) mejor = { g, i, k1, n1 };
}
console.log(`\n== MEJOR CORTE ÚNICO EN EL TIEMPO (cada lado con ≥ 200 pasadas)`);
const a = orden[mejor.i], b = orden[mejor.i + 1];
console.log(`  entre ${a.cuando} (job ${a.job}, ${a.sha.slice(0, 9)}) y ${b.cuando} (job ${b.job}, ${b.sha.slice(0, 9)})`);
console.log(`  antes: ${mejor.k1}/${mejor.n1} (${(100 * mejor.k1 / mejor.n1).toFixed(1)} %) · después: ${K - mejor.k1}/${N - mejor.n1} (${(100 * (K - mejor.k1) / (N - mejor.n1)).toFixed(1)} %) · ganancia de log-verosimilitud ${mejor.g.toFixed(1)} (2·g = ${(2 * mejor.g).toFixed(1)}; χ²₁ al 0,1 % = 10,8)`);
// Control de la rampa: dentro de cada lado del corte, ¿sigue subiendo? (primera mitad contra segunda)
for (const [et, xs] of [['antes del corte', orden.slice(0, mejor.i + 1)], ['después del corte', orden.slice(mejor.i + 1)]]) {
  const m = xs.length >> 1;
  console.log(linea(`${et} · 1.ª mitad`, xs.slice(0, m)));
  console.log(linea(`${et} · 2.ª mitad`, xs.slice(m)));
}
