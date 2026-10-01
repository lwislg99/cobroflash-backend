import fs from 'node:fs';
const [,, tsv, dir] = process.argv;
const filas = fs.readFileSync(tsv, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => l.split('\t'));
const out = [];
for (const [run, rama, sha, creado, job, concl] of filas) {
  if (concl === 'cancelled') continue;
  let log = '';
  try { log = fs.readFileSync(dir + '/' + job + '.log', 'utf8'); } catch {}
  if (!log) { out.push({ creado, rama, sha, concl, ciego: 'LOG VACIO' }); continue; }
  const nodo = (/hostedtoolcache\/node\/([\d.]+)/.exec(log) || [])[1] || '?';
  const pr = [...log.matchAll(/midiendo en (\S+)\s+…\s+(\d+) pruebas/g)].map((m) => Number(m[2]));
  const rep = [...log.matchAll(/Z\s+(\S+\.test\.mjs)\s+confirma (\d+) de (\d+)/g)]
    .filter((m) => !m[1].startsWith('canario') && !m[1].startsWith('scrum592')).map((m) => `${m[1].replace('.test.mjs','')}:${m[2]}/${m[3]}`);
  const noconf = (/NO CONFIRMADAS a solas · (\d+)/.exec(log) || [])[1] || '0';
  const img = (/Image Release: .*ubuntu24%2F([\d.]+)/.exec(log) || [])[1] || '?';
  out.push({ creado, rama: rama.slice(0, 28), sha, concl, nodo, img, k: pr[0], m: pr[1], dif: pr.length === 2 ? pr[0] - pr[1] : '?', noconf, rep: rep.join(' ') });
}
out.sort((a, b) => a.creado.localeCompare(b.creado));
console.log('POBLACION:', out.length, 'jobs de zona no cancelados');
for (const o of out) console.log([o.creado.slice(5, 16), o.concl.slice(0, 4), o.nodo, o.img, o.k, o.m, 'dif=' + o.dif, 'noconf=' + o.noconf, o.sha, o.rama, o.rep || o.ciego || ''].join(' | '));
const conHueco = out.filter((o) => o.rep);
console.log('con algun fichero en repesca (aparte de canarios y 592):', conHueco.length, '· de ellos rojos:', conHueco.filter((o) => o.concl === 'failure').length);
