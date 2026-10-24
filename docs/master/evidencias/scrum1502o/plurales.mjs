// Las parejas «=== 1 ? 'sing' : 'plural'» que añadió 79479b9af, y si siguen LITERALES en main.
import { execFileSync } from 'node:child_process';
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 26 });
const MAIN = process.argv[2];
const diff = git('show', '79479b9af', '--format=', '-U0', '--', 'public', 'src');
let fichero = null; const pares = [];
for (const l of diff.split('\n')) {
  const m = /^\+\+\+ b\/(.+)$/.exec(l); if (m) { fichero = m[1]; continue; }
  if (!l.startsWith('+') || l.startsWith('+++')) continue;
  for (const p of l.matchAll(/===\s*1\s*\?\s*(['"`])((?:(?!\1).)*)\1\s*:\s*(['"`])((?:(?!\3).)*)\3/g)) {
    pares.push({ fichero, sing: p[2], plur: p[4], frag: p[0].slice(p[0].indexOf('?')) });
  }
}
const cache = {};
let enMain = 0;
for (const p of pares) {
  cache[p.fichero] ??= (() => { try { return git('show', `${MAIN}:${p.fichero}`); } catch { return null; } })();
  const src = cache[p.fichero];
  const ok = src != null && src.includes(p.frag);
  if (ok) enMain++;
  const linea = ok ? src.slice(0, src.indexOf(p.frag)).split('\n').length : '-';
  console.log(`${ok ? 'IGUAL ' : 'CAMBIÓ'} ${p.fichero}:${linea} · «${p.sing}» / «${p.plur}»`);
}
console.log(`pares=${pares.length} igual_en_main=${enMain} main=${MAIN}`);
