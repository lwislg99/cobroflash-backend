import { execFileSync } from 'node:child_process';
const RAIZ = 'C:/Users/Javier Pereira/cobroflash-b2';
const git = (...a) => execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 256*1024*1024 });
const { veredictoDeDatos, CUMPLE, FALTA } = await import('file:///C:/Users/Javier%20Pereira/cobroflash-b2/tests/_entrada-de-la-rama.mjs');
const SEP = '\u0001';
const crudo = git('log','origin/main','--merges','-400',`--format=%H${SEP}%s${SEP}\u0002`).split('\u0002').map(x=>x.trim()).filter(Boolean);
const puros = [];
let n = 0;
for (const b of crudo) {
  const [sha, asunto] = b.split(SEP);
  const m = (asunto||'').match(/^Merge pull request #(\d+) from [^/]+\/(.+)$/);
  if (!m) continue;
  n++;
  let d;
  try {
    d = { pr:+m[1], rama:m[2].trim(),
      asuntos: git('log',`${sha}^1..${sha}`,'--no-merges','--format=%s').split('\n').map(x=>x.trim()).filter(Boolean),
      ficheros: git('diff','--name-only',`${sha}^1`,sha).split('\n').map(x=>x.trim()).filter(Boolean) };
  } catch { continue; }
  const antes = veredictoDeDatos(d,{usarAsuntos:false});
  const ahora = veredictoDeDatos(d);
  if (antes.veredicto === CUMPLE && ahora.veredicto === FALTA) {
    puros.push({ sha, ...d, faltan: ahora.faltan });
  }
}
console.log(`Examinados ${n} merges de PR.`);
console.log(`🔴 VERDE FALSO LITERAL (viejo=CUMPLE, nuevo=FALTA): ${puros.length}`);
for (const p of puros) {
  console.log(`  ${p.sha.slice(0,8)} PR#${p.pr} ${p.rama}`);
  console.log(`      asuntos: ${p.asuntos.slice(0,3).join(' | ')}`);
  console.log(`      el nuevo reclama: ${p.faltan.join(', ')}`);
}
