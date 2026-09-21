// SCRUM-963 · qué pasaría con los PR ABIERTOS si el ruleset `protect-main` exigiera más checks.
//
//   node efecto-ruleset.mjs <prs.json>
//
// No cambia nada: sólo lee. Declara la población y distingue «no hay check» de «el check falló»,
// que es la diferencia entre «no lo sé» y «está mal».
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const GH = 'C:\\Program Files\\GitHub CLI\\gh.exe';
const REPO = 'lwislg99/cobroflash-backend';

// Los candidatos a puerta, y el que YA lo es.
const PUERTA_HOY = 'build + tests (con banco desechable)';
const CANDIDATOS = [
  'meta-guard · los guards caen cuando deben',
  'trinquete · ningún test nuevo mide la zona de la máquina',
  'guards de navegador (fuera de la tanda)',
];

// PowerShell 5.1 escribe UTF-8 CON BOM: sin quitarlo, JSON.parse revienta.
const prs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^﻿/, ''));
const filas = [];
for (const pr of prs) {
  const r = spawnSync(GH, ['api', `repos/${REPO}/commits/${pr.headRefOid}/check-runs`,
    '--jq', '.check_runs[] | [.name, .status, .conclusion] | @tsv'], { encoding: 'utf8', maxBuffer: 16e6 });
  if (r.status !== 0) { filas.push({ pr: pr.number, ciego: true, motivo: (r.stderr || '').trim().slice(0, 120) }); continue; }
  const checks = new Map();
  for (const l of String(r.stdout).split('\n').map((s) => s.trim()).filter(Boolean)) {
    const [nombre, estado, conclusion] = l.split('\t');
    checks.set(nombre, estado === 'completed' ? (conclusion || '?') : `en-curso:${estado}`);
  }
  filas.push({ pr: pr.number, rama: pr.headRefName, draft: pr.isDraft, automerge: !!pr.autoMergeRequest, checks });
}

const ciegos = filas.filter((f) => f.ciego);
const vivos = filas.filter((f) => !f.ciego);
const estado = (f, n) => f.checks.has(n) ? f.checks.get(n) : '(sin check)';
const bloquea = (v) => v !== 'success' && v !== 'skipped' && v !== 'neutral';

console.log(`POBLACIÓN · ${prs.length} PR abiertos · ${vivos.length} medidos · ${ciegos.length} NO PUDE MIRAR`);
for (const c of ciegos) console.log(`   🔴 #${c.pr} · ${c.motivo}`);
console.log('');
const anchoN = 6;
const cab = ['PR', 'puerta HOY', ...CANDIDATOS.map((c) => c.split(' ')[0])];
console.log(cab[0].padEnd(anchoN) + cab.slice(1).map((c) => c.padEnd(24)).join(''));
for (const f of vivos) {
  const cols = [PUERTA_HOY, ...CANDIDATOS].map((n) => estado(f, n).padEnd(24));
  console.log(`#${f.pr}`.padEnd(anchoN) + cols.join('') + (f.draft ? ' [borrador]' : '') + (f.automerge ? ' [automerge]' : ''));
}
console.log('');
console.log(`HOY bloqueados por la única puerta: ${vivos.filter((f) => bloquea(estado(f, PUERTA_HOY))).length} de ${vivos.length}`);
for (const c of CANDIDATOS) {
  const malos = vivos.filter((f) => bloquea(estado(f, c)));
  const sinCheck = vivos.filter((f) => estado(f, c) === '(sin check)');
  console.log(`  + «${c}» → bloquearía ${malos.length} de ${vivos.length}` +
    ` (de ellos ${sinCheck.length} porque el check NI SIQUIERA EXISTE en ese commit): ` +
    malos.map((f) => `#${f.pr}`).join(' '));
}
const conjunto = vivos.filter((f) => [PUERTA_HOY, ...CANDIDATOS].some((n) => bloquea(estado(f, n))));
console.log(`\nLOS CUATRO JUNTOS bloquearían ${conjunto.length} de ${vivos.length}: ` + conjunto.map((f) => `#${f.pr}`).join(' '));
