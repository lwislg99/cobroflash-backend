import fs from 'node:fs';
const D = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
function claves(r) { const v = new Map(); return r.medidos.map((m) => { const b = [r.fn, m.tipo, m.cls, m.rotulo, m.id].join('|'); const n = (v.get(b) || 0) + 1; v.set(b, n); return { k: b + '|' + n, m }; }); }
const enC = new Set();
for (const r of D.res.filter((x) => x.pestana === null)) for (const { k, m } of claves(r)) if (m.enSelectorDelCenso) enC.add(r.ancho + '|' + k);
const d = new Map();
for (const r of D.res) for (const { k, m } of claves(r)) { if (m.sonda) continue; if (!d.has(k)) d.set(k, { fn: r.fn, m, t: {}, c: false }); const e = d.get(k); e.t[r.ancho] = Math.min(e.t[r.ancho] ?? 1e9, m.tocable); if (enC.has(r.ancho + '|' + k)) e.c = true; }
const rows = [...d.values()].filter((e) => !e.c && ((e.t[390] ?? 99) < 44 || (e.t[929] ?? 99) < 44)).sort((a, b) => a.fn.localeCompare(b.fn));
console.log('| pantalla | control | rótulo | toque @390 | toque @929 | por qué no estaba |');
console.log('|---|---|---|---|---|---|');
for (const e of rows) console.log(`| ${e.fn.replace(/^render|View$/g, '')} | ${e.m.tipo} | ${e.m.rotulo.replace(/\|/g, '/').slice(0, 40)} | ${e.t[390] ?? '—'} | ${e.t[929] ?? '—'} | ${e.m.enSelectorDelCenso ? 'pestaña oculta al montar' : 'el selector no lo incluye'} |`);
console.log(rows.length);
