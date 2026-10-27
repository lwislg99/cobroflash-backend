// ¿Cuántos ficheros de scripts/ tienen fila PROPIA en `dos-equipos.md` §3.3 y cuántos sólo los cubre la general?
// Lee las filas del documento: no lleva la lista escrita dentro, así que vale para cualquier commit.
// Uso: node recuento-de-la-fila-general.mjs <raíz del árbol> [commit]     (sin commit: el que está sacado)
import { execFileSync } from 'node:child_process';
const [raiz, pedido] = process.argv.slice(2);
if (!raiz) { console.log('CIEGO · falta la raíz del árbol'); process.exit(2); }
const git = (...a) => execFileSync('git', ['-C', raiz, ...a], { encoding: 'utf8', maxBuffer: 1 << 27 });
const sha = git('rev-parse', '--verify', `${pedido ?? 'HEAD'}^{commit}`).trim();
const rastreados = git('ls-tree', '-r', '-z', '--name-only', sha, 'scripts').split('\0').filter(Boolean);
const doc = git('show', `${sha}:docs/equipo/dos-equipos.md`).split(/\r?\n/);
const desde = doc.findIndex((l) => l.startsWith('### 3.3'));
const hasta = doc.findIndex((l, i) => i > desde && l.startsWith('## '));
if (desde < 0 || hasta < 0) { console.log('CIEGO · no encuentro §3.3 en dos-equipos.md'); process.exit(2); }
const filas = doc.slice(desde, hasta).filter((l) => l.startsWith('| `') || l.startsWith('| **'));
// La fila GENERAL es la que nombra `scripts/` a secas. Las excepciones que no tienen fila propia van en la
// primera frase de su nota (`scripts/_suelo-*`) y se leen de ahí; las demás, de la primera celda de cada fila.
const general = filas.find((l) => l.split('|')[1].includes('`scripts/`'));
if (!general) { console.log('CIEGO · no encuentro la fila general de scripts/'); process.exit(2); }
const rutasDe = (texto) => [...texto.matchAll(/`(scripts\/[^`]+)`/g)].map((m) => m[1]).filter((r) => r !== 'scripts/');
const patrones = [];
for (const l of filas) {
  if (l === general) continue;
  const celdas = l.split('|');
  for (const r of rutasDe(celdas[1])) patrones.push({ patron: r, dueño: celdas[2].trim() });
}
const nota = general.split('|')[3];
for (const r of rutasDe(nota.slice(0, nota.indexOf('.')))) {
  // `scripts/equipo/` de la nota es la misma carpeta que la fila `scripts/equipo/**`: no se cuenta dos veces.
  if (patrones.some((p) => p.patron === r || p.patron === `${r}**`)) continue;
  patrones.push({ patron: r, dueño: 'excepción nombrada en la nota de la fila general' });
}
const casa = (patron, f) => {
  if (patron.endsWith('/**')) return f.startsWith(patron.slice(0, -2));
  if (patron.endsWith('/')) return f.startsWith(patron);
  if (patron.endsWith('*')) return f.startsWith(patron.slice(0, -1));
  return f === patron;
};
const porPatron = new Map(patrones.map((p) => [p.patron, 0]));
let conFila = 0;
const dobles = [];
for (const f of rastreados) {
  const suyos = patrones.filter((p) => casa(p.patron, f));
  if (suyos.length) conFila++;
  for (const p of suyos) porPatron.set(p.patron, porPatron.get(p.patron) + 1);
  if (suyos.length > 1) dobles.push(`${f} ← ${suyos.map((p) => p.patron).join(' + ')}`);
}
console.log(`POBLACIÓN · commit ${sha} · ${rastreados.length} ficheros en scripts/ · ${filas.length} filas leídas de §3.3 · ${patrones.length} rutas de scripts/ nombradas`);
const veLaCarpeta = [...porPatron].some(([p, n]) => p.startsWith('scripts/equipo/') && n > 0);
console.log(`CONTROL POSITIVO · ¿casa la fila de scripts/equipo/ con algún fichero? ${veLaCarpeta ? 'SÍ' : 'NO → CIEGO'}`);
const vacios = [...porPatron].filter(([, n]) => n === 0).map(([p]) => p);
console.log(`CONTROL · rutas nombradas que no casan con ningún fichero: ${vacios.length}${vacios.length ? ' → ' + vacios.join(', ') : ''}`);
console.log(`CONTROL · ficheros que casan con dos rutas: ${dobles.length}${dobles.length ? '\n  ' + dobles.join('\n  ') : ''}`);
const porDueño = new Map();
for (const p of patrones) porDueño.set(p.dueño, (porDueño.get(p.dueño) ?? 0) + porPatron.get(p.patron));
for (const [d, n] of porDueño) console.log(`  ${String(n).padStart(3)} · ${d}`);
console.log(`CON fila propia o excepción nombrada: ${conFila} · SÓLO la fila general: ${rastreados.length - conFila} de ${rastreados.length}`);
if (!veLaCarpeta) process.exit(2);
console.log('EXIT=0');
