// SCRUM-935c · ¿de dónde sale el crecimiento? Lee los guards-<run>.tsv que dejó analizar.mjs y la
// serie, y escribe:
//   · la descomposición base → último: segundos de guards NUEVOS, de mutaciones nuevas en guards
//     que ya estaban, y de que la MISMA mutación tarde más (normalizado por el runner);
//   · por guard: primer día visto y su coste en cada log (para ver si una mutación «se volvió cara»).
// Uso: node comparar.mjs <dirOut> <runBase> <runUltimo>
import fs from 'node:fs';
import path from 'node:path';

const [dir, base, ultimo] = process.argv.slice(2);
const leer = (run) => {
  const m = new Map();
  for (const l of fs.readFileSync(path.join(dir, `guards-${run}.tsv`), 'utf8').split('\n')) {
    if (!l || l.startsWith('#') || l.startsWith('guard\t')) continue;
    const [g, n, seg, porMut] = l.split('\t');
    m.set(g, { n: +n, seg: +seg, porMut: porMut === '' ? null : +porMut });
  }
  return m;
};
const serie = fs.readFileSync(path.join(dir, 'serie.tsv'), 'utf8').trim().split('\n').slice(1)
  .map((l) => l.split('\t')).filter((c) => c[6] === 'COMPLETO')
  .map((c) => ({ dia: c[0], run: c[1], evento: c[2], fase: +c[13], n: +c[8] }))
  .sort((a, b) => a.run - b.run);

const B = leer(base); const U = leer(ultimo);
const sum = (m) => [...m.values()].reduce((s, x) => s + x.seg, 0);
const tB = sum(B); const tU = sum(U);
// factor de runner: la mediana del cociente U/B sobre los guards que no cambiaron de nº de mutaciones
const cocientes = [...U].filter(([g, u]) => B.has(g) && B.get(g).n === u.n && B.get(g).seg > 3)
  .map(([g, u]) => u.seg / B.get(g).seg).sort((a, b) => a - b);
const runner = cocientes[Math.floor(cocientes.length / 2)];
let nuevos = 0; let nNuevos = 0; let gNuevos = 0; let masMut = 0; let masLento = 0; let quitados = 0;
const filas = [];
for (const [g, u] of U) {
  const b = B.get(g);
  if (!b) { nuevos += u.seg; nNuevos += u.n; gNuevos++; filas.push({ g, tipo: 'NUEVO', d: u.seg, u, b }); continue; }
  const esperado = b.seg * runner * (u.n + 1) / (b.n + 1); // limpia + n mutaciones, mismo coste unitario
  masMut += b.seg * runner * ((u.n + 1) / (b.n + 1) - 1);
  masLento += u.seg - esperado;
  filas.push({ g, tipo: u.n > b.n ? 'MAS-MUT' : 'IGUAL', d: u.seg - b.seg * runner, u, b });
}
for (const [g, b] of B) if (!U.has(g)) quitados += b.seg * runner;
const out = [];
out.push(`# SCRUM-935c · descomposición ${base} → ${ultimo}`);
out.push(`base: ${B.size} guards · ${[...B.values()].reduce((s, x) => s + x.n, 0)} mutaciones · ${tB.toFixed(0)} s`);
out.push(`último: ${U.size} guards · ${[...U.values()].reduce((s, x) => s + x.n, 0)} mutaciones · ${tU.toFixed(0)} s`);
out.push(`factor de runner (mediana U/B sobre ${cocientes.length} guards con las MISMAS mutaciones y > 3 s): ${runner.toFixed(3)}`);
out.push(`base llevada al runner del último: ${(tB * runner).toFixed(0)} s`);
out.push(`  + guards NUEVOS (${gNuevos} guards, ${nNuevos} mutaciones): ${nuevos.toFixed(0)} s`);
out.push(`  + mutaciones nuevas en guards que ya estaban: ${masMut.toFixed(0)} s`);
out.push(`  + la MISMA mutación tarda más (resto, guards existentes): ${masLento.toFixed(0)} s`);
out.push(`  − guards que ya no están: ${quitados.toFixed(0)} s`);
out.push(`  = ${(tB * runner + nuevos + masMut + masLento - quitados).toFixed(0)} s (control: el último mide ${tU.toFixed(0)} s)`);
out.push('');
out.push('# los 25 que más suben (segundos sobre la base normalizada)');
out.push('tipo\tguard\tmut_base\tmut_ult\tseg_base_norm\tseg_ult\tdelta');
for (const f of filas.sort((a, b) => b.d - a.d).slice(0, 25)) {
  out.push([f.tipo, f.g, f.b?.n ?? 0, f.u.n, f.b ? (f.b.seg * runner).toFixed(1) : '0', f.u.seg.toFixed(1), f.d.toFixed(1)].join('\t'));
}
out.push('');
// por guard (los 15 más caros del último): coste en cada log completo, para fechar cuándo subió
const top = [...U].sort((a, b) => b[1].seg - a[1].seg).slice(0, 15).map(([g]) => g);
const tablas = serie.map((s) => ({ ...s, m: leer(s.run) }));
out.push('# coste por log (seg · mutaciones) de los 15 guards más caros del último; s/mut del log al final');
out.push(['dia', 'run', 'N', 's/mut', ...top.map((g) => g.replace(/\.test\.mjs$/, ''))].join('\t'));
for (const t of tablas) {
  out.push([t.dia, t.run, t.n, (t.fase / t.n).toFixed(2), ...top.map((g) => {
    const x = t.m.get(g); return x ? `${x.seg.toFixed(0)}·${x.n}` : '-';
  })].join('\t'));
}
console.log(out.join('\n'));
