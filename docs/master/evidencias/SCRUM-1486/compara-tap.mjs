// Compara DOS TAP por CONJUNTOS de (veredicto, nombre), a cualquier profundidad. No por cuentas.
// uso: node compara-tap.mjs <base.tap> <candidato.tap>
import fs from 'node:fs';

const leer = (ruta) => {
  const m = new Map();
  for (const l of fs.readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const x = /^\s*(not ok|ok) [0-9]+ - (.*)$/.exec(l);
    if (!x) continue;
    const nombre = x[2].replace(/ # (SKIP|TODO).*$/, (s) => s.slice(0, 7));
    const clave = nombre;
    const lista = m.get(clave) ?? [];
    lista.push(x[1]);
    m.set(clave, lista);
  }
  return m;
};
const [a, b] = process.argv.slice(2);
const A = leer(a);
const B = leer(b);
const total = (m) => [...m.values()].reduce((s, v) => s + v.length, 0);
console.log(`POBLACIÓN: base ${total(A)} resultados (${A.size} nombres) · candidato ${total(B)} resultados (${B.size} nombres)`);
if (!A.size || !B.size) { console.log('CIEGO: algún TAP no trae resultados'); process.exit(2); }
const soloA = [...A.keys()].filter((k) => !B.has(k));
const soloB = [...B.keys()].filter((k) => !A.has(k));
const distintos = [...A.keys()].filter((k) => B.has(k) && A.get(k).slice().sort().join() !== B.get(k).slice().sort().join());
console.log(`sólo en base: ${soloA.length} · sólo en candidato: ${soloB.length} · con veredicto distinto: ${distintos.length}`);
for (const k of soloA) console.log(`  SÓLO BASE      ${k}`);
for (const k of soloB) console.log(`  SÓLO CANDIDATO ${k}`);
for (const k of distintos) console.log(`  CAMBIA         ${k}: ${A.get(k)} → ${B.get(k)}`);
const caidos = (m) => [...m.entries()].filter(([, v]) => v.includes('not ok')).length;
console.log(`caídos: base ${caidos(A)} · candidato ${caidos(B)}`);
console.log(`EXIT=${soloA.length + soloB.length + distintos.length ? 1 : 0}`);
process.exit(soloA.length + soloB.length + distintos.length ? 1 : 0);
