#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1339/d-meta-scrum859.mjs — SCRUM-1339d · SÓLO LECTURA.
//
// ¿Desde cuándo sale `scrum859` CIEGO en el meta-guard, y cambió algo al entrar el PR #2114
// (que añadió dos secciones a `docs/master/SCRUM-1339.md`, mergeado 2026-10-01T15:45:38Z)?
//
// Recorre los últimos N runs del workflow CI, mira la conclusión del job «meta-guard» y, de los
// que cayeron, baja el log y busca la línea del CIEGO de scrum859.
//
// ⚠️ «Después de #2114» se decide por la HORA en que se creó el run: un PR prueba su fusión con
// el `main` de ese momento. Es una aproximación y va dicha.
//
//   node d-meta-scrum859.mjs <carpeta de trabajo> [N=150]
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

const [carpeta, nTexto = '150'] = process.argv.slice(2);
if (!carpeta) { console.error('uso: node d-meta-scrum859.mjs <carpeta de trabajo> [N]'); process.exit(2); }
const REPO = 'lwislg99/cobroflash-backend';
const CORTE = '2026-10-01T15:45:38Z';
const env = { ...process.env, NO_COLOR: '1' };
delete env.FORCE_COLOR; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;
const corre = (args) => new Promise((res) => execFile('gh', args, { env, maxBuffer: 1024 * 1024 * 256 }, (err, stdout, stderr) => res({ err, stdout: String(stdout), stderr: String(stderr) })));
fs.mkdirSync(path.join(carpeta, 'meta-logs'), { recursive: true });

const lista = await corre(['run', 'list', '--repo', REPO, '--workflow', 'ci.yml', '--limit', nTexto, '--json', 'databaseId,event,headSha,headBranch,createdAt,status,conclusion']);
if (lista.err) { console.log('CIEGO: gh run list falló: ' + lista.stderr.slice(0, 200)); console.log('EXIT=3'); process.exit(3); }
const runs = JSON.parse(lista.stdout);
console.log(`POBLACIÓN: ${runs.length} runs del workflow CI · del ${runs.at(-1)?.createdAt} al ${runs[0]?.createdAt}`);

async function uno(r) {
  const j = await corre(['api', `repos/${REPO}/actions/runs/${r.databaseId}/jobs`, '--jq', '.jobs[] | select(.name | startswith("meta-guard")) | [.id, .status, .conclusion] | @tsv']);
  if (j.err) { r.meta = 'ERROR'; return; }
  const [id, estado, conclusion] = j.stdout.trim().split('\n').at(-1).split('\t');
  r.metaJob = id; r.meta = estado === 'completed' ? conclusion : (estado || 'sin job');
  if (r.meta !== 'failure') return;
  const log = path.join(carpeta, 'meta-logs', `${id}.log`);
  if (!fs.existsSync(log)) {
    const l = await corre(['run', 'view', '--repo', REPO, '--job', id, '--log']);
    if (l.err || !l.stdout.length) { r.log = 'SIN LOG'; return; }
    fs.writeFileSync(log, l.stdout);
  }
  const txt = fs.readFileSync(log, 'utf8');
  r.log = 'leído';
  r.veredicto = (txt.match(/vivas \d+ · mudas \d+ · ciegas \d+[^\n]*/) || ['(sin línea de veredicto)'])[0];
  r.scrum859 = /scrum859-identidad-y-motivo-cerrado\.test\.mjs · no se pudo juzgar/.test(txt);
  r.faltan = (txt.match(/FALTAN (\d+) de los (\d+) tests[^\n]{0,40}/) || [''])[0];
}
// canario: UNO, y si no contesta no se lanza el resto
await uno(runs[0]);
if (runs[0].meta === 'ERROR') { console.log('CANARIO EN ROJO: no pude leer los jobs del primer run'); console.log('EXIT=3'); process.exit(3); }
const cola = runs.slice(1);
await Promise.all(Array.from({ length: 4 }, async () => { while (cola.length) await uno(cola.shift()); }));

const cab = ['databaseId', 'createdAt', 'event', 'headBranch', 'headSha', 'conclusion', 'metaJob', 'meta', 'log', 'veredicto', 'scrum859', 'faltan'];
fs.writeFileSync(path.join(carpeta, 'd-meta-scrum859.tsv'), cab.join('\t') + '\n' + runs.map((r) => cab.map((k) => r[k] ?? '').join('\t')).join('\n') + '\n');

const porEstado = {}; for (const r of runs) porEstado[r.meta] = (porEstado[r.meta] || 0) + 1;
console.log('  meta-guard por conclusión: ' + Object.entries(porEstado).map(([k, v]) => `${k} ${v}`).join(' · '));
const juzgables = runs.filter((r) => r.meta === 'success' || (r.meta === 'failure' && r.log === 'leído'));
console.log(`  juzgables (success, o failure con el log leído): ${juzgables.length} de ${runs.length}`);
for (const [nombre, f] of [['ANTES de #2114', (r) => r.createdAt < CORTE], ['DESPUÉS de #2114', (r) => r.createdAt >= CORTE]]) {
  const g = juzgables.filter(f);
  const ciego = g.filter((r) => r.scrum859);
  console.log(`  ${nombre} (${CORTE}): ${g.length} juzgables · scrum859 CIEGO en ${ciego.length}${g.length ? ` (${(100 * ciego.length / g.length).toFixed(0)} %)` : ''} · otros rojos del meta-guard ${g.filter((r) => r.meta === 'failure' && !r.scrum859).length}`);
  for (const r of ciego) console.log(`      ${r.createdAt} run ${r.databaseId} ${r.event} ${r.headBranch} · ${r.veredicto} · ${r.faltan}`);
}
console.log('EXIT=0');
