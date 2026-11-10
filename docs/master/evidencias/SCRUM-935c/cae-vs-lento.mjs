// SCRUM-935c · para cada guard: sus mutaciones declaradas (con el censo del propio instrumento, sin
// tocarlo) y si el `cae` de cada una ES el test lento del fichero o es otro.
// Uso: node cae-vs-lento.mjs <dirTaps> <guard.test.mjs>...   (TAP del fichero entero en <dirTaps>/c-<guard>.tap)
import fs from 'node:fs';
import path from 'node:path';
import { censoDeDeclaraciones } from '../../../../scripts/meta-guard-mutaciones.mjs';

const [dirTaps, ...guards] = process.argv.slice(2);
const censo = censoDeDeclaraciones();
console.log(`censo del instrumento: ${censo.length} guards · ${censo.reduce((s, c) => s + c.mutaciones.length, 0)} mutaciones`);
for (const g of guards) {
  const tap = fs.readFileSync(path.join(dirTaps, `c-${g.replace(/\.test\.mjs$/, '')}.tap`), 'utf8').split(/\r?\n/);
  const tests = [];
  for (let i = 0; i < tap.length; i++) {
    const m = tap[i].match(/^(?:not ok|ok) \d+ - (.*)$/);
    if (!m) continue;
    const d = tap.slice(i + 1, i + 6).map((l) => l.match(/^ {2}duration_ms: ([\d.]+)/)).find(Boolean);
    if (d) tests.push({ nombre: m[1], ms: +d[1] });
  }
  const total = tests.reduce((s, t) => s + t.ms, 0);
  const c = censo.find((x) => x.guard === g);
  if (!c) { console.log(`${g}: NO está en el censo`); continue; }
  console.log(`${g} · fichero ${(total / 1000).toFixed(1)} s · ${c.mutaciones.length} mutaciones`);
  for (const m of c.mutaciones) {
    const t = tests.find((x) => x.nombre.includes(m.cae));
    console.log(`   ${t ? (t.ms / 1000).toFixed(1).padStart(5) + ' s' : '  ¿? s'} · ${m.cae.slice(0, 100)}`);
  }
}
