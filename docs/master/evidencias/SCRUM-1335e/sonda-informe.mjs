// Sonda: ¿llega el test:summary con `file` de un fichero, por el mismo camino que el hijo del trinquete?
import { run } from 'node:test';
import path from 'node:path';
const [raiz, rel] = process.argv.slice(2);
const fichero = path.join(raiz, rel);
const cuenta = {};
const resumenes = [];
const fallos = [];
const flujo = run({ files: [fichero], cwd: raiz, forceExit: true, concurrency: 1, timeout: 5 * 60_000 });
for await (const ev of flujo) {
  cuenta[ev.type] = (cuenta[ev.type] || 0) + 1;
  if (ev.type === 'test:summary') resumenes.push({ file: ev.data.file ?? null, counts: ev.data.counts, success: ev.data.success });
  if (ev.type === 'test:fail') fallos.push(`${ev.data.name} :: ${String(ev.data.details?.error?.message ?? ev.data.details?.error).slice(0, 300)}`);
  if (ev.type === 'test:stderr' || ev.type === 'test:stdout') { const m = String(ev.data.message).trim(); if (m) fallos.push(`[${ev.type}] ${m.slice(0, 300)}`); }
}
console.log(JSON.stringify({ raiz, cuenta, resumenes, fallos: fallos.slice(0, 12) }, null, 1));
