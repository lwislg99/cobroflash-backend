import { readFileSync } from 'node:fs';
const L = readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean).map((x) => JSON.parse(x));
const arr = new Set(L.filter((x) => x.k === 'arranque').map((x) => x.f));
const ev = L.filter((x) => x.k !== 'arranque');
const porF = new Map();
for (const e of ev) { if (!porF.has(e.f)) porF.set(e.f, []); porF.get(e.f).push(e); }
console.log(`POBLACION observada (líneas de arranque, ficheros distintos): ${arr.size}`);
console.log(`ficheros que lanzan ALGÚN proceso/fetch/socket: ${porF.size} · eventos: ${ev.length}`);
const fases = {}; for (const e of ev) fases[e.fase] = (fases[e.fase] || 0) + 1; console.log('por fase:', JSON.stringify(fases));
const ordenes = {}; for (const e of ev) { const k = e.k === 'hijo' ? `${e.orden} ${e.orden === 'git' ? (e.args.find((a) => !a.startsWith('-')) || '') : ''}`.trim() : `${e.k} ${e.host}`; ordenes[k] = (ordenes[k] || 0) + 1; }
console.log('--- qué se lanza (todas las fases):'); for (const [k, v] of Object.entries(ordenes).sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(5), k);
console.log('--- 🔴 RED:'); for (const e of ev.filter((x) => x.red)) console.log(e.f, '|', e.fase, '|', e.red, '|', (e.args || []).join(' '));
