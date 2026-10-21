// SCRUM-935c · de un TAP de node --test, la duración de cada test de primer nivel, ordenada.
// Uso: node tests-lentos.mjs <fichero.tap> [cuántos]
import fs from 'node:fs';

const lineas = fs.readFileSync(process.argv[2], 'utf8').split(/\r?\n/);
const cuantos = Number(process.argv[3] || 4);
const tests = [];
for (let i = 0; i < lineas.length; i++) {
  const m = lineas[i].match(/^(not ok|ok) \d+ - (.*)$/); // primer nivel: sin sangría
  if (!m) continue;
  for (let j = i + 1; j < Math.min(i + 6, lineas.length); j++) {
    const d = lineas[j].match(/^ {2}duration_ms: ([\d.]+)/);
    if (d) { tests.push({ ok: m[1] === 'ok', nombre: m[2], ms: +d[1] }); break; }
  }
}
const total = tests.reduce((s, t) => s + t.ms, 0);
const caen = tests.filter((t) => !t.ok).length;
console.log(`tests ${tests.length} (caen ${caen}) · suma ${(total / 1000).toFixed(1)} s`);
for (const t of [...tests].sort((a, b) => b.ms - a.ms).slice(0, cuantos)) {
  console.log(`  ${(t.ms / 1000).toFixed(1)} s · ${(100 * t.ms / total).toFixed(0)} % · ${t.nombre.slice(0, 110)}`);
}
