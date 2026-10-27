// PROPUESTA de como partir los ficheros de scripts/ que solo cubre la fila general de dos-equipos.md §3.3.
// NO clasifica: mide cuantos caen en cada criterio (carpeta, clase por nombre, quien lo usa, quien lo toco).
// Solo lectura. Uso: node partir-scripts.mjs <raiz del arbol> <salida.tsv>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const [raiz, salida] = process.argv.slice(2);
const git = (...a) => execFileSync('git', ['-C', raiz, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 });
const sha = git('rev-parse', 'HEAD').trim();
const lsz = (...d) => git('ls-files', '-z', '--', ...d).split('\0').filter(Boolean);
const todos = lsz('scripts');

// --- las filas de §3.3, leidas igual que docs/master/evidencias/SCRUM-1480/recuento-de-la-fila-general.mjs
const doc = fs.readFileSync(path.join(raiz, 'docs/equipo/dos-equipos.md'), 'utf8').split(/\r?\n/);
const desde = doc.findIndex((l) => l.startsWith('### 3.3'));
const hasta = doc.findIndex((l, i) => i > desde && l.startsWith('## '));
if (desde < 0 || hasta < 0) { console.log('CIEGO: no encuentro §3.3'); process.exit(2); }
const filas = doc.slice(desde, hasta).filter((l) => l.startsWith('| `') || l.startsWith('| **'));
const general = filas.find((l) => l.split('|')[1].includes('`scripts/`'));
if (!general) { console.log('CIEGO: no encuentro la fila general'); process.exit(2); }
const rutasDe = (t) => [...t.matchAll(/`(scripts\/[^`]+)`/g)].map((m) => m[1]).filter((r) => r !== 'scripts/');
const patrones = [];
for (const l of filas) { if (l === general) continue; const c = l.split('|'); for (const r of rutasDe(c[1])) patrones.push({ patron: r, dueno: c[2].trim().replace(/\*/g, '') }); }
const nota = general.split('|')[3];
for (const r of rutasDe(nota.slice(0, nota.indexOf('.')))) if (!patrones.some((p) => p.patron === r || p.patron === `${r}**`)) patrones.push({ patron: r, dueno: 'excepcion' });
const casa = (p, f) => p.endsWith('/**') ? f.startsWith(p.slice(0, -2)) : p.endsWith('/') ? f.startsWith(p) : p.endsWith('*') ? f.startsWith(p.slice(0, -1)) : f === p;
const duenoDe = (f) => patrones.find((p) => casa(p.patron, f))?.dueno || null;
const sueltos = todos.filter((f) => !duenoDe(f));
console.log(`POBLACION | commit ${sha} | ${todos.length} ficheros en scripts/ | con fila ${todos.length - sueltos.length} | SOLO fila general ${sueltos.length}`);
if (todos.length - sueltos.length === 0) { console.log('CIEGO: ninguna fila casa'); process.exit(2); }

// --- consumidores: se carga UNA vez el texto de todo lo que puede nombrar un script
const leer = (f) => { try { return fs.readFileSync(path.join(raiz, f), 'utf8'); } catch { return ''; } };
const grupos = {
  ci: lsz('.github'),
  claude: lsz('.claude'),
  src: lsz('src', 'public'),
  tests: lsz('tests'),
  scripts: todos,
};
const texto = {}; let leidos = 0;
for (const [g, l] of Object.entries(grupos)) { texto[g] = l.map((f) => ({ f, t: leer(f) })); leidos += l.length; }
const pkg = JSON.parse(leer('package.json'));
const npm = Object.entries(pkg.scripts || {});
const ciTodo = texto.ci.map((x) => x.t).join('\n');
// control positivo de la sonda: un script que se sabe usado por el CI tiene que salir como usado por el CI
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nombra = (t, base) => new RegExp(`(^|[^A-Za-z0-9_-])${esc(base)}(?![A-Za-z0-9_-])`, 'm').test(t);
const usos = (f) => {
  const base = path.basename(f);
  const u = { ci: false, npm: [], npmEnCi: false, claude: 0, src: 0, tests: 0, scripts: [] };
  u.ci = nombra(ciTodo, base);
  for (const [n, cmd] of npm) if (nombra(cmd, base)) { u.npm.push(n); if (new RegExp(`npm (run )?${esc(n)}(?![A-Za-z0-9:_-])`).test(ciTodo)) u.npmEnCi = true; }
  u.claude = texto.claude.filter((x) => nombra(x.t, base)).length;
  u.src = texto.src.filter((x) => nombra(x.t, base)).length;
  u.tests = texto.tests.filter((x) => nombra(x.t, base)).length;
  u.scripts = texto.scripts.filter((x) => x.f !== f && nombra(x.t, base)).map((x) => x.f);
  return u;
};
const ctrl = usos('scripts/vigia-atascados.mjs');
console.log(`CONTROL POSITIVO | vigia-atascados.mjs lo nombra el CI: ${ctrl.ci ? 'SI' : 'NO -> CIEGO'} | ficheros consumidores leidos ${leidos}`);
if (!ctrl.ci) process.exit(2);
const fantasma = usos('scripts/__no-existe-este-script__.mjs');
if (fantasma.ci || fantasma.tests || fantasma.scripts.length) { console.log('CIEGO: la sonda ve usos de un fichero que no existe'); process.exit(2); }

const autores = (a) => /javier/i.test(a) ? 'javier' : /bot/i.test(a) ? 'bot' : 'luis';
const res = [];
for (const f of sueltos) {
  const u = usos(f);
  const log = git('log', '--format=%an\t%ad\t%s', '--date=short', '--', f).split('\n').filter(Boolean).map((l) => l.split('\t'));
  const quien = new Set(log.map((l) => autores(l[0])).filter((a) => a !== 'bot'));
  const tickets = [...new Set(log.flatMap((l) => [...(l[2] || '').matchAll(/SCRUM-(\d+)/gi)].map((m) => m[1])))];
  const nace = log.length ? ((log[log.length - 1][2] || '').match(/SCRUM-(\d+)/i) || [])[1] || '' : '';
  const base = path.basename(f);
  const carpeta = f.split('/').length > 2 ? f.split('/')[1] + '/' : '(raiz)';
  const clase = base.startsWith('_') ? '_ayudante' : (base.match(/^([a-z0-9]+)[-.]/i) || [, 'otro'])[1].toLowerCase();
  // quien lo usa, por prioridad (la primera que se cumple)
  const usa = u.ci || u.npmEnCi ? '1-CI' : u.claude ? '2-hook-o-skill' : u.src ? '3-producto' : u.tests ? '4-test' : u.scripts.length ? '5-otro-script' : u.npm.length ? '6-npm-a-mano' : '7-nadie-en-codigo';
  // un ayudante hereda dueno si TODOS los scripts que lo importan tienen fila y es la misma
  const duenosImp = [...new Set(u.scripts.map((s) => duenoDe(s) || 'SIN-FILA'))];
  const hereda = u.scripts.length === 0 ? '' : duenosImp.length === 1 ? duenosImp[0] : 'MEZCLA';
  res.push({ f, carpeta, clase, usa, ci: u.ci || u.npmEnCi, tests: u.tests, imp: u.scripts.length, hereda, npm: u.npm.join(','), quien: [...quien].sort().join('+') || 'solo-bot', commits: log.length, ultimo: log[0]?.[1] || '', primero: log[log.length - 1]?.[1] || '', nace, tickets: tickets.length });
}
const cuenta = (k, orden) => { const m = {}; for (const r of res) m[r[k]] = (m[r[k]] || 0) + 1; return Object.entries(m).sort((a, b) => orden ? a[0].localeCompare(b[0]) : b[1] - a[1]); };
const pinta = (rot, k, orden) => console.log(`\n${rot}\n` + cuenta(k, orden).map(([c, n]) => `  ${String(n).padStart(3)}  ${c}`).join('\n'));
pinta('A · POR CARPETA', 'carpeta');
pinta('B · POR CLASE (prefijo del nombre)', 'clase');
pinta('C · POR QUIEN LO USA (primera que se cumple)', 'usa', true);
pinta('C2 · ayudantes y demas importados por otros scripts: de quien son sus importadores', 'hereda');
pinta('D · POR QUIEN LO TOCO (autor de git, sin bots)', 'quien');
const hoy = Date.now();
const edad = (r) => { const d = (hoy - new Date(r.ultimo).getTime()) / 864e5; return d < 7 ? 'a) < 7 d' : d < 30 ? 'b) 7-30 d' : d < 60 ? 'c) 30-60 d' : 'd) > 60 d'; };
for (const r of res) r.edad = edad(r);
pinta('E · POR ULTIMO TOQUE', 'edad', true);
console.log(`\nF · TICKET QUE LO CREO: con numero ${res.filter((r) => r.nace).length} | sin numero ${res.filter((r) => !r.nace).length} | tickets distintos ${new Set(res.map((r) => r.nace).filter(Boolean)).size}`);
// cruce clase x uso, para las clases grandes
const clases = cuenta('clase').filter(([, n]) => n >= 5).map(([c]) => c);
const usosL = cuenta('usa', true).map(([c]) => c);
console.log('\nCRUCE clase x quien lo usa\n| clase | ' + usosL.join(' | ') + ' | total |');
for (const c of [...clases, '(resto)']) { const s = res.filter((r) => c === '(resto)' ? !clases.includes(r.clase) : r.clase === c); console.log(`| ${c} | ${usosL.map((u) => s.filter((r) => r.usa === u).length).join(' | ')} | ${s.length} |`); }
console.log('\nCRUCE quien lo toco x quien lo usa\n| autor | ' + usosL.join(' | ') + ' | total |');
for (const [q] of cuenta('quien')) { const s = res.filter((r) => r.quien === q); console.log(`| ${q} | ${usosL.map((u) => s.filter((r) => r.usa === u).length).join(' | ')} | ${s.length} |`); }
fs.writeFileSync(salida, ['fichero\tcarpeta\tclase\tusa\tci\ttests\timportadores\thereda\tnpm\tquien\tcommits\tprimero\tultimo\tnace\ttickets\tedad', ...res.map((r) => [r.f, r.carpeta, r.clase, r.usa, r.ci, r.tests, r.imp, r.hereda, r.npm, r.quien, r.commits, r.primero, r.ultimo, r.nace, r.tickets, r.edad].join('\t'))].join('\n') + '\n');
console.log(`\nescrito ${salida} | ${res.length} filas`);
