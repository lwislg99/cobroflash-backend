#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1339/techo-en-ci.mjs
//
// ¿Cuánto tarda `guards:entrada` DENTRO de la tanda de CI? `tests/scrum976-guards-entrada-con-techo`
// lo lanza de verdad en su caso ④ y la duración de ese caso es, casi entera, la del comando.
// Lee esa línea en los logs de «build + tests» ya bajados (bajar-logs.mjs). SOLO LECTURA.
//
//   node techo-en-ci.mjs <carpeta>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const carpeta = process.argv[2];
if (!carpeta) { console.error('uso: node techo-en-ci.mjs <carpeta>'); process.exit(2); }
const CSI = /\x1B\[[0-9;?]*[ -/]*[@-~]/g;
const logs = fs.readdirSync(path.join(carpeta, 'logs')).filter((f) => f.endsWith('.log.gz'));
const ms = []; let caidos = 0; let sinLinea = 0; const filas = [];
for (const f of logs) {
  const t = zlib.gunzipSync(fs.readFileSync(path.join(carpeta, 'logs', f))).toString('utf8').replace(CSI, '');
  const m = t.match(/Z\s+(✔|✖) SCRUM-976 ④ [^\n]*\((\d+(?:\.\d+)?)ms\)/);
  if (!m) { sinLinea++; continue; }
  if (m[1] === '✖') caidos++;
  ms.push(Number(m[2])); filas.push(`${f.replace('.log.gz', '')}\t${m[1] === '✔' ? 'pass' : 'fail'}\t${Math.round(Number(m[2]))}`);
}
ms.sort((a, b) => a - b);
const q = (p) => (ms[Math.min(ms.length - 1, Math.floor(p * ms.length))] / 1000).toFixed(1);
fs.writeFileSync(path.join(carpeta, 'techo-en-ci.tsv'), ['job\tveredicto\tms', ...filas].join('\n') + '\n');
console.log(`POBLACIÓN: ${logs.length} logs de «build + tests» · con la línea del caso ④ de scrum976: ${ms.length} · sin ella (tanda cortada antes): ${sinLinea}`);
console.log(`  el caso ④ CAYÓ en ${caidos} de ${ms.length}`);
console.log(`  duración (s): mín ${q(0)} · p25 ${q(0.25)} · mediana ${q(0.5)} · p75 ${q(0.75)} · p95 ${q(0.95)} · p99 ${q(0.99)} · máx ${(ms.at(-1) / 1000).toFixed(1)}`);
for (const umbral of [45, 60, 75, 90]) console.log(`  por encima de ${umbral} s: ${ms.filter((x) => x > umbral * 1000).length}`);
console.log('EXIT=0');
