// ③ · Con las trazas de la tanda entera: ¿qué ficheros de test LEEN documentación Y llaman a algo
// que depende de la zona? Sólo ésos pueden cambiar el veredicto del trinquete con un PR de sólo docs.
//   node clasificar-tanda.mjs <raiz> <dirTrazas>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [raiz, dir] = process.argv.slice(2);
const { esDocumentacion } = await import(pathToFileURL(path.join(raiz, 'scripts/equipo/solo-docs.mjs')).href);
const R = path.resolve(raiz).toLowerCase();
const CODIGO = /^(public|src|scripts|tests|prisma|\.github|\.claude|node_modules|dist|\.git)(\/|$)/;
const LISTADO = /(^|\.)(readdir|readdirSync|opendir|opendirSync|glob|globSync|watch)$/;
const rel = (abs) => { const a = path.resolve(abs); return a.toLowerCase().startsWith(R) ? a.slice(R.length).replace(/\\/g, '/').replace(/^\//, '') : null; };
const toca = (r, ops) => r !== null && (r === 'docs' || r.startsWith('docs/') || esDocumentacion(r) || (ops.some((o) => LISTADO.test(o)) && !CODIGO.test(r)));

const trazas = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
const porPid = new Map(trazas.map((t) => [t.pid, t]));
// raíz de cada traza: subir por ppid hasta el proceso cuyo argv nombra un tests/*.test.mjs
const ficheroDe = (t) => t.argv.find((a) => /tests[\\/][^\\/]+\.test\.mjs$/.test(a));
const dueño = (t) => { let x = t; for (let i = 0; x && i < 20; i++) { const f = ficheroDe(x); if (f) return rel(f) || f; x = porPid.get(x.ppid); } return null; };
const fichas = new Map();
let huerfanas = 0;
for (const t of trazas) {
  const f = dueño(t);
  if (!f) { huerfanas += 1; continue; }
  if (!fichas.has(f)) fichas.set(f, { docs: new Set(), zona: {}, procs: 0, nietos: 0 });
  const x = fichas.get(f);
  if (!ficheroDe(t)) x.nietos += 1;
  for (const [abs, ops] of t.rutas) if (toca(rel(abs), ops)) x.docs.add(rel(abs) || '(raíz)');
  for (const abs of t.cargados) { const r = rel(abs); if (r !== null && toca(r, [])) x.docs.add(`import:${r}`); }
  for (const [k, n] of Object.entries(t.zona || {})) x.zona[k] = (x.zona[k] || 0) + n;
  x.procs += t.procesos.length;
}
const todos = [...fichas];
const leen = todos.filter(([, x]) => x.docs.size);
const zona = todos.filter(([, x]) => Object.keys(x.zona).length);
const ambos = todos.filter(([, x]) => x.docs.size && Object.keys(x.zona).length);
console.log(`trazas ${trazas.length} · ficheros de test con traza ${todos.length} · trazas sin dueño ${huerfanas}`);
console.log(`leen documentación ${leen.length} · llaman a APIs de zona ${zona.length} · LAS DOS COSAS ${ambos.length}`);
console.log(`con subproceso (su nieto puede no estar trazado si limpia NODE_OPTIONS): ${todos.filter(([, x]) => x.procs).length}`);
for (const [f, x] of ambos) console.log(`  ${f}\n     zona: ${JSON.stringify(x.zona)}\n     docs: ${[...x.docs].slice(0, 4).join(', ')}${x.docs.size > 4 ? ` (+${x.docs.size - 4})` : ''}`);
fs.writeFileSync(path.join(dir, '..', 'tanda-clasif.json'), JSON.stringify(todos.map(([f, x]) => ({ f, docs: [...x.docs], zona: x.zona, procs: x.procs, nietos: x.nietos })), null, 1));
