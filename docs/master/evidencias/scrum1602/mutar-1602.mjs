// docs/master/evidencias/scrum1602/mutar-1602.mjs — SCRUM-1602
//
// Rojo primero + las mutaciones que declara el test. Uso: node mutar-1602.mjs <raiz>
// Las mutaciones salen del catálogo del meta-guard (`MUTACIONES_QUE_ME_TUMBAN` del test, leídas por
// AST con `mutacionesDeclaradas`), no de una lista propia (SCRUM-1387).
// Exige exportView.js comitado: restaura desde lo que había, y se niega con cambios sin comitar.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { mutacionesDeclaradas } from '../../../../scripts/meta-guard-mutaciones.mjs';

const raiz = path.resolve(process.argv[2] || '.');
const rel = 'public/dashboard/js/exportView.js';
const f = path.join(raiz, rel);
const sucio = execFileSync('git', ['status', '--porcelain', '--', rel], { cwd: raiz, encoding: 'utf8' }).trim();
if (sucio) { console.error('CIEGO: exportView.js con cambios sin comitar; me niego a restaurar.'); process.exit(2); }
const original = fs.readFileSync(f, 'utf8');
const TEST = 'tests/scrum1602-paquete-del-trimestre.test.mjs';
const mutaciones = mutacionesDeclaradas(fs.readFileSync(path.join(raiz, TEST), 'utf8'), TEST);
if (mutaciones.length === 0) { console.error('CIEGO: el test no declara ninguna mutación legible.'); process.exit(2); }

function correr() {
  const env = { ...process.env }; delete env.FORCE_COLOR;
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', TEST], { cwd: raiz, encoding: 'utf8', env });
  const lineas = r.stdout.split('\n');
  const ok = lineas.filter((l) => /^ok \d+ - /.test(l)).length;
  const caen = lineas.filter((l) => /^not ok \d+ - /.test(l)).map((l) => l.replace(/^not ok \d+ - /, ''));
  return { ok, caen, total: ok + caen.length };
}

const filas = [];
try {
  filas.push({ caso: 'BASE (sin mutar)', ...correr() });
  // Rojo primero: la vista de origin/main, sin la tarjeta.
  fs.writeFileSync(f, execFileSync('git', ['show', `origin/main:${rel}`], { cwd: raiz }));
  filas.push({ caso: 'exportView.js de origin/main', ...correr() });
  fs.writeFileSync(f, original);
  for (const m of mutaciones) {
    if (m.fichero !== rel || !original.includes(m.de)) { filas.push({ caso: `CIEGA: «${m.de}» no está en ${m.fichero}`, ok: null, caen: [], total: 0 }); continue; }
    fs.writeFileSync(f, original.replace(m.de, m.a));
    const r = correr();
    filas.push({ caso: `mutación → espera «${m.cae}»`, ...r, cazada: r.caen.includes(m.cae) });
    fs.writeFileSync(f, original);
  }
} finally {
  fs.writeFileSync(f, original);
}
for (const x of filas) {
  console.log(`${x.caso}\n   total ${x.total} · ok ${x.ok} · caen ${x.caen.length}${x.cazada === undefined ? '' : ` · cazada=${x.cazada}`}`);
  for (const c of x.caen) console.log(`     ✖ ${c}`);
}
