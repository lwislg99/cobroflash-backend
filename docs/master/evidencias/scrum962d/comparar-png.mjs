// Compara capturas PNG píxel a píxel: cuántos píxeles difieren y la mayor diferencia de canal.
// Uso: node comparar-png.mjs <raiz> <dirA> <dirB> [<dirC>]  → A vs B (y A vs C, el ruido)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const [raiz, A, B, C] = process.argv.slice(2);
const { PNG } = createRequire(path.join(path.resolve(raiz), 'package.json'))('pngjs');
const leer = (f) => PNG.sync.read(fs.readFileSync(f));
const diff = (fa, fb) => {
  const a = leer(fa), b = leer(fb);
  if (a.width !== b.width || a.height !== b.height) return `TAMAÑO DISTINTO ${a.width}×${a.height} vs ${b.width}×${b.height}`;
  let n = 0, max = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]), Math.abs(a.data[i + 3] - b.data[i + 3]));
    if (d) { n++; if (d > max) max = d; }
  }
  return `${a.width}×${a.height} · píxeles distintos ${n} · mayor diferencia de canal ${max}`;
};
for (const f of fs.readdirSync(A).sort()) {
  console.log(`${f.padEnd(18)} A↔B: ${diff(path.join(A, f), path.join(B, f))}${C ? `   ·   A↔C (ruido): ${diff(path.join(A, f), path.join(C, f))}` : ''}`);
}
