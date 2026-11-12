// R1 (SCRUM-1284) · ¿algún proceso de `npm run guards:visuales` toca algo que un PR de sólo docs cambia?
//   node clasificar-visuales.mjs <raiz> <dirTrazas>
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
let n = 0; const tocan = []; const procs = new Set();
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.json')) continue;
  n += 1;
  const t = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const quien = t.argv.map((a) => (rel(a) ?? path.basename(a))).join(' ').slice(0, 90);
  const x = [];
  for (const [abs, ops] of t.rutas) if (toca(rel(abs), ops)) x.push(`${ops.join(',')} ${rel(abs) || '(raíz)'}`);
  for (const abs of t.cargados) { const r = rel(abs); if (r !== null && toca(r, [])) x.push(`import ${r}`); }
  for (const p of t.procesos) procs.add(`${path.basename(p.cmd.split(' ')[0])} ${p.args.slice(0, 2).join(' ')}`.slice(0, 80));
  if (x.length) tocan.push({ quien, x });
}
console.log(`procesos trazados ${n} · los que tocan documentación ${tocan.length}`);
for (const t of tocan) console.log(`  ${t.quien}\n     ${t.x.slice(0, 5).join('\n     ')}${t.x.length > 5 ? `\n     (+${t.x.length - 5})` : ''}`);
console.log(`subprocesos distintos lanzados: ${procs.size}`);
for (const p of [...procs].slice(0, 15)) console.log(`  ${p}`);
