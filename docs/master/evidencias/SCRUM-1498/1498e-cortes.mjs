// 1498e-cortes.mjs <clas.json> <carpeta de logs> — Solo LECTURA, sobre los logs ya bajados.
// (1) Cuánto deja SIN JUZGAR el corte por presupuesto (la línea «Juzgadas X de Y mutaciones. SIN JUZGAR Z»).
// (2) La pata que decide si un CIEGO de scrum1516c es del entorno (④bis del encargo): el MISMO guard en los
//     demás jobs del meta-guard, antes y después de que entrara SCRUM-1610b en main.
import fs from 'node:fs';
import path from 'node:path';

const [clasJson, dir] = process.argv.slice(2);
const MERGE_1610B = Date.parse('2026-10-26T23:50:22Z'); // b353c2ad4, commit de merge de #2905 en origin/main
const o = JSON.parse(fs.readFileSync(clasJson, 'utf8'));
const leer = (job) => fs.readFileSync(path.join(dir, `${job}.log`), 'utf8').split(/\r?\n/).map((l) => l.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z /, ''));
const q = (a, p) => a[Math.min(a.length - 1, Math.floor(p * a.length))];

const cortados = [];
const g = {};
for (const x of o) {
  const L = leer(x.job);
  const j = L.map((l) => /Juzgadas (\d+) de (\d+) mutaciones\. SIN JUZGAR (\d+)/.exec(l)).find(Boolean);
  if (x.corte) cortados.push({ job: x.job, juzgadas: j ? +j[1] : null, total: j ? +j[2] : null, sin: j ? +j[3] : null });
  const vivo = L.filter((l) => /^ {2}✔ scrum1516c-/.test(l)).length;
  const ciego = L.filter((l) => /^ {2}\? scrum1516c-.* · CIEGO/.test(l)).length;
  const k = `${Date.parse(x.creado) < MERGE_1610B ? 'antes de 1610b' : 'después de 1610b'} · ${x.fin} · scrum1516c ${ciego ? 'CIEGO' : vivo ? 'vivo (✔)' : 'sin línea (no juzgado antes del corte, o no declarado en esa rama)'}`;
  g[k] = (g[k] || 0) + 1;
}
const con = cortados.filter((c) => c.sin !== null);
const sin = con.map((c) => c.sin).sort((a, b) => a - b);
const tot = con.map((c) => c.total).sort((a, b) => a - b);
const fr = con.map((c) => c.sin / c.total).sort((a, b) => a - b);
console.log(`POBLACION jobs leídos=${o.length} · con «CORTO YO»=${cortados.length} · de ellos con línea «Juzgadas»=${con.length} (tiene que ser igual)`);
console.log(`(1) SIN JUZGAR por el corte: min ${sin[0]} · p50 ${q(sin, 0.5)} · máx ${sin[sin.length - 1]} de un total de ${tot[0]}-${tot[tot.length - 1]} mutaciones · fracción p50 ${q(fr, 0.5).toFixed(3)} · máx ${fr[fr.length - 1].toFixed(3)}`);
console.log('(2) scrum1516c en cada job del meta-guard (failure y success):');
for (const [k, v] of Object.entries(g).sort()) console.log(`  ${String(v).padStart(3)} · ${k}`);
const dur = o.filter((x) => x.fin === 'success').map((x) => x.durS).sort((a, b) => a - b);
console.log(`(3) duración de los ${dur.length} success: min ${dur[0]} s · p50 ${q(dur, 0.5)} s · máx ${dur[dur.length - 1]} s (presupuesto del paso 1695 s, techo del job 1800 s)`);
