#!/usr/bin/env node
// Baja (SÓLO LECTURA) los artefactos `tanda-tap` de hoy y el log de su job «build + tests».
//   node bajar.mjs <carpeta>
// Entrada: <carpeta>/arts-hoy.tsv (id, created, expired, bytes, run, head_sha, rama)
// Salida:  <carpeta>/taps/<id>.tap · <carpeta>/logs/<id>.log · <carpeta>/bajados.tsv
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

const carpeta = process.argv[2];
const REPO = 'lwislg99/cobroflash-backend';
const env = { ...process.env, NO_COLOR: '1' };
delete env.FORCE_COLOR; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;
const corre = (cmd, args, opts = {}) => new Promise((res) => {
  execFile(cmd, args, { env, maxBuffer: 1024 * 1024 * 256, encoding: 'buffer', ...opts }, (err, stdout, stderr) => res({ err, stdout, stderr }));
});

const filas = fs.readFileSync(path.join(carpeta, 'arts-hoy.tsv'), 'utf8').split('\n').filter(Boolean).map((l) => {
  const [id, creado, expirado, bytes, run, sha, rama] = l.split('\t');
  return { id, creado, expirado, bytes: Number(bytes), run, sha, rama };
});
// intento = orden del artefacto dentro de su run
const porRun = new Map();
for (const f of filas) { if (!porRun.has(f.run)) porRun.set(f.run, []); porRun.get(f.run).push(f); }
for (const g of porRun.values()) { g.sort((a, b) => a.creado.localeCompare(b.creado)); g.forEach((f, i) => { f.intento = i + 1; f.intentos = g.length; }); }

fs.mkdirSync(path.join(carpeta, 'taps'), { recursive: true });
fs.mkdirSync(path.join(carpeta, 'logs'), { recursive: true });

async function uno(f) {
  const zip = path.join(carpeta, 'taps', `${f.id}.zip`);
  const tap = path.join(carpeta, 'taps', `${f.id}.tap`);
  const log = path.join(carpeta, 'logs', `${f.id}.log`);
  if (!fs.existsSync(tap)) {
    const z = await corre('gh', ['api', `repos/${REPO}/actions/artifacts/${f.id}/zip`]);
    if (z.err || !z.stdout.length) { f.error = 'zip: ' + String(z.stderr).slice(0, 120); return f; }
    fs.writeFileSync(zip, z.stdout);
    const u = await corre('unzip', ['-p', zip]);
    if (u.err || !u.stdout.length) { f.error = 'unzip: ' + String(u.stderr).slice(0, 120); return f; }
    fs.writeFileSync(tap, u.stdout); fs.unlinkSync(zip);
  }
  const j = await corre('gh', ['api', `repos/${REPO}/actions/runs/${f.run}/attempts/${f.intento}/jobs`, '--jq', '.jobs[] | select(.name | startswith("build + tests")) | [.id, .conclusion, .started_at, .completed_at] | @tsv']);
  if (j.err) { f.error = 'jobs: ' + String(j.stderr).slice(0, 120); return f; }
  [f.job, f.conclusion, f.empezo, f.acabo] = j.stdout.toString('utf8').trim().split('\t');
  const r = await corre('gh', ['api', `repos/${REPO}/actions/runs/${f.run}`, '--jq', '[.event, .run_attempt] | @tsv']);
  if (!r.err) [f.evento, f.intentosDelRun] = r.stdout.toString('utf8').trim().split('\t');
  // `gh run view --job --log` da el log del ÚLTIMO intento: sólo vale para el artefacto del último
  if (f.intento === f.intentos && f.job && !fs.existsSync(log)) {
    const l = await corre('gh', ['run', 'view', '--repo', REPO, '--job', f.job, '--log']);
    if (l.err || !l.stdout.length) f.errorLog = 'log: ' + String(l.stderr).slice(0, 120);
    else fs.writeFileSync(log, l.stdout);
  }
  return f;
}

console.log(`POBLACIÓN: ${filas.length} artefactos · ${porRun.size} runs`);
// canario: UNO, y si no queda en disco no se lanza el resto
const c = await uno(filas[0]);
if (c.error || !fs.existsSync(path.join(carpeta, 'taps', `${c.id}.tap`))) { console.log('CANARIO EN ROJO:', c.error); process.exit(3); }
console.log('canario ok:', c.id, c.job, c.conclusion);
const cola = filas.slice(1); const N = 4;
await Promise.all(Array.from({ length: N }, async () => { while (cola.length) { const f = cola.shift(); await uno(f); process.stdout.write('.'); } }));
const cab = ['id', 'creado', 'bytes', 'run', 'intento', 'intentos', 'evento', 'sha', 'rama', 'job', 'conclusion', 'empezo', 'acabo', 'error', 'errorLog'];
fs.writeFileSync(path.join(carpeta, 'bajados.tsv'), cab.join('\t') + '\n' + filas.map((f) => cab.map((k) => f[k] ?? '').join('\t')).join('\n') + '\n');
const taps = fs.readdirSync(path.join(carpeta, 'taps')).filter((x) => x.endsWith('.tap')).length;
const logs = fs.readdirSync(path.join(carpeta, 'logs')).length;
console.log(`\ntaps en disco ${taps} de ${filas.length} · logs en disco ${logs} · con error ${filas.filter((f) => f.error).length} · con error de log ${filas.filter((f) => f.errorLog).length}`);
console.log('EXIT=0');
