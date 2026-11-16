// ¿Qué eventos de nivel 0 da run() por fichero? Uso: node eventos.mjs <fichero>...
import { run } from 'node:test';
const files = process.argv.slice(2);
const cuenta = new Map();
for await (const ev of run({ files, forceExit: true, concurrency: 2 })) {
  if (!['test:plan', 'test:pass', 'test:fail', 'test:summary', 'test:complete'].includes(ev.type)) continue;
  const f = (ev.data.file || '(sin file)').replace(/^.*[\\/]/, '');
  const k = `${f} · ${ev.type} · nivel ${ev.data.nesting}`;
  const extra = ev.type === 'test:plan' ? ` count=${ev.data.count}` : ev.type === 'test:summary' ? ` tests=${ev.data.counts?.tests} passed=${ev.data.counts?.passed}` : '';
  cuenta.set(k + extra, (cuenta.get(k + extra) || 0) + 1);
}
for (const [k, n] of [...cuenta].sort()) console.log(`${String(n).padStart(3)}  ${k}`);
