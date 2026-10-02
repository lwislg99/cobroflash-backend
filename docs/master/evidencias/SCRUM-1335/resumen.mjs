import fs from 'node:fs';
const fuentes = [[process.argv[2], process.argv[3]], [process.argv[4], process.argv[5]]];
const CENSADAS = new Set(['scrum592-numeracion-doc02', 'quoteNumber']);
const jobs = new Map();
for (const [tsv, dir] of fuentes) for (const l of fs.readFileSync(tsv, 'utf8').split(/\r?\n/).filter(Boolean)) {
  const [run, rama, sha, creado, job, concl] = l.split('\t');
  if (concl === 'cancelled' || jobs.has(job)) continue;
  let log = ''; try { log = fs.readFileSync(`${dir}/${job}.log`, 'utf8'); } catch {}
  const pr = [...log.matchAll(/midiendo en (\S+)\s+…\s+(\d+) pruebas/g)].map((m) => Number(m[2]));
  const rep = [...log.matchAll(/Z\s+(\S+)\.test\.mjs\s+confirma (\d+) de (\d+)/g)].filter((m) => !m[1].startsWith('canario') && !CENSADAS.has(m[1]));
  jobs.set(job, { creado, concl, medido: pr.length === 2, rep, nodo: (/hostedtoolcache\/node\/([\d.]+)/.exec(log) || [])[1] });
}
const todos = [...jobs.values()];
const medidos = todos.filter((j) => j.medido);
const conPerdida = medidos.filter((j) => j.rep.length);
console.log('POBLACION: jobs de zona no cancelados', todos.length, '· con las dos pasadas medidas', medidos.length, '· sin medir (log vacio u otra averia)', todos.length - medidos.length);
console.log('con algun fichero no censado en repesca:', conPerdida.length, `(${(100 * conPerdida.length / medidos.length).toFixed(0)} %)`, '· rojos entre ellos:', conPerdida.filter((j) => j.concl === 'failure').length, '· rojos en total:', todos.filter((j) => j.concl === 'failure').length);
const porDia = new Map();
for (const j of medidos) { const d = j.creado.slice(0, 10); const o = porDia.get(d) || { n: 0, p: 0, r: 0, nodo: new Set() }; o.n++; if (j.rep.length) o.p++; if (j.concl === 'failure') o.r++; o.nodo.add(j.nodo); porDia.set(d, o); }
for (const [d, o] of [...porDia].sort()) console.log('  ', d, 'jobs', o.n, 'con perdida', o.p, 'rojos', o.r, 'node', [...o.nodo].join(','));
const porFichero = new Map();
for (const j of conPerdida) for (const m of j.rep) { const o = porFichero.get(m[1]) || { jobs: 0, soloTambien: 0 }; o.jobs++; if (Number(m[2]) > 0) o.soloTambien++; porFichero.set(m[1], o); }
console.log('FICHEROS (jobs en que salio · de ellos, cambio tambien A SOLAS):');
for (const [f, o] of [...porFichero].sort((a, b) => b[1].jobs - a[1].jobs)) {
  let casos = '?'; try { casos = (fs.readFileSync(`tests/${f}.test.mjs`, 'utf8').match(/^\s*(?:test|it)\(/gm) || []).length; } catch {}
  console.log('  ', String(o.jobs).padStart(3), String(o.soloTambien).padStart(3), ' casos~' + String(casos).padStart(3), f);
}
