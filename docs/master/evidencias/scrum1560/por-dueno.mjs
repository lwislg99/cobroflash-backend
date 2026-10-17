// SCRUM-1560 · los elementos cortos que el censo ve AHORA y antes no, repartidos por DUEÑO.
// `node por-dueno.mjs <raíz> antes.json despues.json`
// Dueño = la regla de `.claude/carriles.json` (generada de dos-equipos.md) del fichero de la vista y,
// si la clase o el texto del elemento sólo aparece en OTRO fichero, también la de ése (un componente).
// Montones: A · no llega a 44 a 390 px (defecto de verdad en móvil) · B · sólo falla contra el 44 del
// censo a 929 y cumple los 36 del guard en escritorio (no se toca) · C · por debajo de 36 a 929 y
// cumple a 390.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [raiz, fa, fd] = process.argv.slice(2);
const { reglaDe } = await import(pathToFileURL(path.join(raiz, 'scripts/_carriles.mjs')).href);
const mapa = JSON.parse(fs.readFileSync(path.join(raiz, '.claude/carriles.json'), 'utf8'));
const JS = path.join(raiz, 'public/dashboard/js');
const ficheros = fs.readdirSync(JS).filter((f) => f.endsWith('.js')).map((f) => ({ rel: `public/dashboard/js/${f}`, txt: fs.readFileSync(path.join(JS, f), 'utf8') }));
const dueno = (rel) => { const r = reglaDe(rel, mapa); return r ? r.puesto : 'sin fila'; };
// La DEFINICIÓN, no una comparación: `typeof window.renderX === 'function'` (app.js) casaba con un
// `window.renderX\s*=` a secas y daba la ficha de factura a S2.
const ficheroDeVista = (fn) => (ficheros.find((f) => new RegExp(`function ${fn}\\s*\\(`).test(f.txt))
  || ficheros.find((f) => new RegExp(`window\\.${fn}\\s*=(?!=)`).test(f.txt)) || {}).rel || '?';

const distintos = (rs) => {
  const m = new Map();
  for (const r of rs) {
    const n = {};
    for (const x of r.medidos) {
      const k0 = `${r.fn}|${x.sel}|${x.texto}`;
      n[`${k0}|${r.ancho}`] = (n[`${k0}|${r.ancho}`] || 0) + 1;
      const k = `${k0}|${n[`${k0}|${r.ancho}`]}`;
      if (!m.has(k)) m.set(k, { fn: r.fn, sel: x.sel, texto: x.texto });
      m.get(k)['a' + r.ancho] = x.tocable;
    }
  }
  return m;
};
const corto = (v) => (v.a929 != null && v.a929 < 44) || (v.a390 != null && v.a390 < 44);
const A = distintos(JSON.parse(fs.readFileSync(fa, 'utf8')));
const D = distintos(JSON.parse(fs.readFileSync(fd, 'utf8')));
const cortosAntes = new Set([...A].filter(([, v]) => corto(v)).map(([k]) => k));
const nuevos = [...D].filter(([k, v]) => corto(v) && !cortosAntes.has(k)).map(([, v]) => v);

const montón = (v) => (v.a390 != null && v.a390 < 44 ? 'A' : v.a929 != null && v.a929 >= 36 ? 'B' : 'C');
const pintor = (v, vista) => {
  const clases = v.sel.split('.').slice(1).filter((c) => !/^btn(-|$)/.test(c));
  // Sin clase propia, el TEXTO entero (sin símbolos): una palabra suelta casaba en diecisiete ficheros.
  const aguja = clases.length ? clases[clases.length - 1] : v.texto.replace(/[^\p{L}\p{N} ]/gu, '').trim();
  if (!aguja || aguja.length < 4) return null;
  const en = ficheros.filter((f) => f.txt.includes(aguja)).map((f) => f.rel);
  // Sólo se nombra un componente si el elemento sale de UN fichero que no es la vista.
  return en.length === 1 && en[0] !== vista ? en[0] : null;
};
const px = (n) => (n == null ? '—' : n.toFixed(1));
const filas = nuevos.map((v) => {
  const vista = ficheroDeVista(v.fn);
  const comp = pintor(v, vista);
  return { ...v, vista, comp, dueño: comp ? `${dueno(vista)} (vista) / ${comp.split(', ').map(dueno).join('+')} (componente)` : dueno(vista), m: montón(v) };
});
console.log(`elementos DISTINTOS cortos antes: ${cortosAntes.size} · después: ${[...D].filter(([, v]) => corto(v)).length} · NUEVOS: ${nuevos.length}`);
for (const m of ['A', 'B', 'C']) {
  const t = { A: 'A · NO llega a 44 a 390 px — defecto de verdad', B: 'B · sólo < 44 a 929 y ≥ 36 (cumple el guard en escritorio) — no se toca', C: 'C · < 36 a 929, cumple a 390' }[m];
  const g = filas.filter((f) => f.m === m);
  console.log(`\n══ ${t} · ${g.length}`);
  const porDueno = new Map();
  for (const f of g) { if (!porDueno.has(f.dueño)) porDueno.set(f.dueño, []); porDueno.get(f.dueño).push(f); }
  for (const [d, fs2] of [...porDueno].sort()) {
    console.log(`  ── ${d}`);
    for (const f of fs2) console.log(`     ${f.comp || f.vista} · ${f.sel} «${f.texto}» · 929: ${px(f.a929)} · 390: ${px(f.a390)}`);
  }
}
