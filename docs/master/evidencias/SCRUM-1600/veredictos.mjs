// Veredictos por nombre de un TAP: líneas ancladas al inicio («ok N - » / «not ok N - »), con su recuento
// contra el `# tests` declarado (cicatriz ③). Uso: node veredictos.mjs <tap>
import fs from 'node:fs';
const tap = fs.readFileSync(process.argv[2], 'utf8');
const casos = [];
for (const l of tap.split(/\r?\n/)) {
  const m = /^(not ok|ok) \d+ - (.*?)(?: # (SKIP|TODO).*)?$/.exec(l);
  if (m) casos.push(`${m[1] === 'ok' ? (m[3] ? m[3] : 'PASA') : 'CAE'} · ${m[2]}`);
}
const declarado = Number((/^# tests (\d+)$/m.exec(tap) || [])[1]);
for (const c of casos) console.log(c);
console.log(`# casos leídos ${casos.length} · declarados ${declarado} · ${casos.length === declarado ? 'SUMAN' : 'NO SUMAN'}`);
