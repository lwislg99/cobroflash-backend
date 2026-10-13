// SCRUM-1527 · entorno de cada job (imagen del runner, node) y tasa por dia. uso: node entorno.mjs <medida.json> <dirLogs>
import { readFileSync } from 'node:fs';
import path from 'node:path';
const [medida, dir] = process.argv.slice(2);
const filas = JSON.parse(readFileSync(medida, 'utf8')).filter((f) => !f.ciego && f.bytes > 1000);
const ESC = String.fromCharCode(27);
const CSI = new RegExp(ESC + '\\[[0-9;?]*[ -/]*[@-~]', 'g');
const cuenta = (m, k) => m.set(k, (m.get(k) || 0) + 1);
const porDia = new Map(); const porImg = new Map(); const porNode = new Map(); const porEv = new Map(); const porCpu = new Map();
let llegan = 0;
for (const f of filas) {
  const txt = readFileSync(path.join(dir, `${f.job}.log`), 'utf8').replace(CSI, '');
  const cab = txt.slice(0, 60000);
  const img = (cab.match(/Image: (\S+)\s*\n[^\n]*Version: (\S+)/) || []).slice(1).join(' ') || '?';
  const node = (cab.match(/Found in cache @ \S*node\/([\d.]+)/) || cab.match(/node-version: (\S+)/) || [])[1] || '?';
  const llega = f.sinVeredicto || txt.includes('SCRUM-447 · SUELO');
  if (!llega) continue;
  llegan++;
  const sv = f.sinVeredicto ? 1 : 0;
  for (const [m, k] of [[porDia, f.started.slice(0, 10)], [porImg, img], [porNode, node], [porEv, f.event]]) {
    const v = m.get(k) || [0, 0]; v[0]++; v[1] += sv; m.set(k, v);
  }
}
console.log(`POBLACION logs=${filas.length} lleganAlPunto(447 visto o colgado)=${llegan}`);
for (const [n, m] of [['dia', porDia], ['imagen', porImg], ['node', porNode], ['evento', porEv]]) {
  console.log(`-- por ${n} (llegan / colgados)`);
  for (const [k, v] of [...m].sort()) console.log(`   ${k}: ${v[0]} / ${v[1]}`);
}
