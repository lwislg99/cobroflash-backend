import { appendFileSync } from 'node:fs';
import { basename } from 'node:path';
const yo = basename(process.argv[1] || '');
if (/\.test\.mjs$/.test(yo) && process.env.YAQU_SALIDA_LOG) {
  process.on('exit', (c) => {
    const r = process.getActiveResourcesInfo();
    const cuenta = {};
    for (const x of r) cuenta[x] = (cuenta[x] || 0) + 1;
    try { appendFileSync(process.env.YAQU_SALIDA_LOG, JSON.stringify({ f: yo, codigo: c, recursos: cuenta }) + '\n'); } catch {}
  });
}
