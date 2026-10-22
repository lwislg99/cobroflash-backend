import fs from 'node:fs';
const D = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
function claves(r) { const v = new Map(); return r.medidos.map((m) => { const b = [r.fn, m.tipo, m.cls, m.rotulo, m.id].join('|'); const n = (v.get(b) || 0) + 1; v.set(b, n); return { k: b + '|' + n, m }; }); }
const enC = new Set();
for (const r of D.res.filter((x) => x.pestana === null)) for (const { k, m } of claves(r)) if (m.enSelectorDelCenso) enC.add(r.ancho + '|' + k);
const d = new Map();
for (const r of D.res) for (const { k, m } of claves(r)) { if (m.sonda) continue; if (!d.has(k)) d.set(k, { fn: r.fn, m, t: {}, c: false }); const e = d.get(k); e.t[r.ancho] = Math.min(e.t[r.ancho] ?? 1e9, m.tocable); if (enC.has(r.ancho + '|' + k)) e.c = true; }
const L = [...d.values()];
const sm = (e) => /(^|\s)btn-sm(\s|$)/.test(e.m.cls);
const A = (e) => (e.t[390] ?? 99) < 44 || (e.t[929] ?? 99) < 44;
const B = (e) => !sm(e) && ((e.t[390] ?? 99) < 44 || (e.t[929] ?? 99) < 36);
const campo = (e) => /^(select|textarea|input\[(text|search|date|number|email|tel|color)\])/.test(e.m.tipo);
for (const [n, f] of [['A <44 en cualquier anchura', A], ['B DESIGN.md (44 movil, 36 escritorio, btn-sm exento)', B]]) {
  const t = L.filter(f), c = t.filter((e) => e.c);
  console.log(n, '· total', t.length, '· en censo', c.length, '· fuera', t.length - c.length, '· fuera y son campos', t.filter((e) => !e.c && campo(e)).length, '· fuera y no campos', t.filter((e) => !e.c && !campo(e)).length);
}
console.log('btn-sm entre los 72 del censo:', L.filter((e) => e.c && A(e) && sm(e)).length);
console.log('del censo, cortos SOLO a 929 (>=44 a 390):', L.filter((e) => e.c && A(e) && !((e.t[390] ?? 99) < 44)).length);
