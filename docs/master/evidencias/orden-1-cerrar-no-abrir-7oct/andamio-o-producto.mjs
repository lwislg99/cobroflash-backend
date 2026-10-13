// Cuantos tickets de una poblacion son ANDAMIO para el equipo, DEFECTO de producto o FUNCION de producto.
//
// Son DOS medidas y no se mezclan:
//  1. La categoria A MANO, leida de `clasificacion.tsv` (ticket -> categoria). El criterio, en orden, la
//     primera que se cumple:
//       DEFECTO · describe algo que el profesional o su cliente ve, pierde o no puede hacer HOY en yaqu.app
//       FUNCION · describe algo que el profesional todavia no tiene (funcion, rediseno, decision de
//                 producto, consultoria, contenido legal)
//       ANDAMIO · la victima es el equipo (sesiones, normas, CI, tests, guards, vigias, fixtures, Jira)
//  2. El contraste MECANICO, que no depende del juicio de nadie: los commits de origin/main que nombran
//     el ticket, tocan lo que se sirve (src/, public/, prisma/) o no?
// El contraste NO decide la categoria: dice si la tabla a mano se sostiene. Un ANDAMIO que toca lo servido,
// o un DEFECTO con commits que no lo tocan, sale en DISCREPAN y se lee.
//
// Solo lectura: no escribe ningun fichero.
// Uso: node andamio-o-producto.mjs <repo> [poblacion.txt] [clasificacion.tsv]
//   poblacion.txt     · una clave por linea (SCRUM-123). Por defecto, `poblacion-49.txt` de esta carpeta.
//   clasificacion.tsv · clave<TAB>categoria. Por defecto, la de esta carpeta.
// Sale 0 si todo ticket de la poblacion tiene categoria · 1 si alguno no la tiene · 2 si no ha podido mirar.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const [repo, poblacionF = path.join(aqui, 'poblacion-49.txt'), clasifF = path.join(aqui, 'clasificacion.tsv')] = process.argv.slice(2);
if (!repo) { console.error('Uso: node andamio-o-producto.mjs <repo> [poblacion.txt] [clasificacion.tsv]'); process.exit(2); }

const lineas = (f) => fs.readFileSync(f, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const poblacion = lineas(poblacionF);
const clasif = new Map(lineas(clasifF).map((l) => l.split('\t')));
if (poblacion.length === 0 || clasif.size === 0) { console.error('CIEGO: poblacion o clasificacion vacias'); process.exit(2); }
const malas = poblacion.filter((k) => !/^SCRUM-\d+$/.test(k));
if (malas.length) { console.error(`CIEGO: ${malas.length} linea(s) de la poblacion no son una clave: ${malas.slice(0, 3).join(' | ')}`); process.exit(2); }
if (new Set(poblacion).size !== poblacion.length) { console.error('CIEGO: la poblacion trae claves repetidas'); process.exit(2); }

const git = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 });
const punta = git('rev-parse', 'origin/main').trim();
// Control positivo: la misma busqueda tiene que VER un ticket que se sabe en main. Si no lo ve, esta ciega.
const commitsDe = (n) => git('log', 'origin/main', '-i', '-E', `--grep=SCRUM-${n}([^0-9]|$)`, '--name-only', '--format=@@%H');
if (!/^@@/m.test(commitsDe('1294'))) { console.error('CIEGO: la busqueda no encuentra SCRUM-1294, que esta en main'); process.exit(2); }

const SERVIDO = /^(src|public|prisma)\//;
const filas = poblacion.map((clave) => {
  const sal = commitsDe(clave.replace('SCRUM-', ''));
  const commits = (sal.match(/^@@/gm) || []).length;
  const ficheros = [...new Set(sal.split('\n').filter((l) => l && !l.startsWith('@@')))];
  const servidos = ficheros.filter((p) => SERVIDO.test(p)).length;
  return { clave, cat: clasif.get(clave) || 'SIN-CLASIFICAR', commits, servidos, donde: commits === 0 ? 'SIN-COMMITS' : servidos ? 'TOCA-LO-SERVIDO' : 'SOLO-EQUIPO' };
});

console.log(`POBLACION | ${filas.length} tickets (${path.basename(poblacionF)}) | clasificacion: ${clasif.size} filas | origin/main ${punta}`);
const cats = ['ANDAMIO', 'DEFECTO', 'FUNCION', 'SIN-CLASIFICAR'];
const dondes = ['TOCA-LO-SERVIDO', 'SOLO-EQUIPO', 'SIN-COMMITS'];
const pct = (n) => `${Math.round((100 * n) / filas.length)} %`;
console.log('\n1 · CATEGORIA A MANO');
for (const c of cats) {
  const s = filas.filter((r) => r.cat === c);
  if (s.length || c !== 'SIN-CLASIFICAR') console.log(`  ${c}: ${s.length} (${pct(s.length)}) | ${s.map((r) => r.clave.replace('SCRUM-', '')).join(' ')}`);
}
console.log('\n2 · CONTRASTE MECANICO (commits de origin/main que nombran el ticket)');
console.log('| categoria a mano | ' + dondes.join(' | ') + ' | total |');
console.log('|---|---|---|---|---|');
for (const c of cats) {
  const s = filas.filter((r) => r.cat === c);
  if (s.length) console.log(`| ${c} | ${dondes.map((d) => s.filter((r) => r.donde === d).length).join(' | ')} | ${s.length} |`);
}
const discrepan = filas.filter((r) => (r.cat === 'ANDAMIO' && r.donde === 'TOCA-LO-SERVIDO') || (r.cat !== 'ANDAMIO' && r.donde === 'SOLO-EQUIPO'));
console.log(`\nDISCREPAN: ${discrepan.length}`);
for (const r of discrepan) console.log(`  ${r.clave}\t${r.cat}\t${r.donde}\tcommits ${r.commits}\tficheros servidos ${r.servidos}`);
const sin = filas.filter((r) => r.cat === 'SIN-CLASIFICAR');
if (sin.length) { console.log(`\nSIN CLASIFICAR: ${sin.length} · ponles fila en la tabla antes de dar la cifra`); process.exit(1); }
