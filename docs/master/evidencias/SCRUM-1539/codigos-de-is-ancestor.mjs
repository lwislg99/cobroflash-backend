// docs/master/evidencias/SCRUM-1539/codigos-de-is-ancestor.mjs — SCRUM-1539
//
// `merge-base --is-ancestor` tiene TRES salidas y los dos lectores de la regla 42 (el test, en
// `scrum804b:129`, y el censo, en `censo-regla-42.mjs:135`) sólo distinguen dos: 0 = «ya está en
// main» y CUALQUIER OTRA COSA = «rama viva». Este guion cuenta, sobre las ramas de HOY, cuántas de
// esas «vivas» lo son por un 1 (no es ancestro: medido) y cuántas por un 128 (git no pudo mirar).
// Sólo pregunta: una lectura del remoto y un `merge-base` por rama.
import { spawnSync } from 'node:child_process';

const git = (args) => spawnSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const ls = git(['ls-remote', '--heads', 'origin']);
if (ls.status !== 0) { console.log(`🔴 CIEGO: ls-remote salió ${ls.status}`); process.exit(3); }

const filas = ls.stdout.split('\n').filter(Boolean).map((l) => l.split(/\s+/));
const cuenta = new Map();
const porCodigo = { scrum: new Map(), otras: new Map() };
const ejemplos = new Map();
for (const [sha, ref] of filas) {
  const r = git(['merge-base', '--is-ancestor', sha, 'origin/main']);
  const esScrum = /^refs\/heads\/scrum-\d+/.test(ref);
  const m = esScrum ? porCodigo.scrum : porCodigo.otras;
  m.set(r.status, (m.get(r.status) ?? 0) + 1);
  cuenta.set(r.status, (cuenta.get(r.status) ?? 0) + 1);
  if (!ejemplos.has(r.status)) ejemplos.set(r.status, `${ref} · ${(r.stderr || '').trim().split('\n')[0].slice(0, 90)}`);
}
const pinta = (m) => [...m.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `código ${k}: ${v}`).join(' · ');
console.log(`POBLACION: ${filas.length} ramas remotas · origin/main = ${git(['rev-parse', 'origin/main']).stdout.trim()}`);
console.log(`  todas     → ${pinta(cuenta)}`);
console.log(`  scrum-N   → ${pinta(porCodigo.scrum)}`);
console.log(`  las demás → ${pinta(porCodigo.otras)}`);
for (const [k, v] of ejemplos) console.log(`  ejemplo de código ${k}: ${v}`);

// CONTROLES: los tres códigos existen y se pueden provocar a mano.
const c0 = git(['merge-base', '--is-ancestor', 'origin/main~1', 'origin/main']).status;
const c128a = git(['merge-base', '--is-ancestor', 'f'.repeat(40), 'origin/main']).status;
const c128b = git(['merge-base', '--is-ancestor', 'origin/main~1', 'refs/remotes/origin/rama-que-no-existe']).status;
console.log(`CONTROLES: ancestro de verdad → ${c0} · sha que no está en el almacén → ${c128a} · sin la ref de main → ${c128b}`);
