// node comparar.mjs <volcado-main.json> <volcado-rama.json>
import fs from 'node:fs';
const [fm, fr] = process.argv.slice(2);
const cargar = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
// Un elemento es el MISMO a dos anchuras: pantalla + selector + texto + atributos (el censo usa los
// tres primeros; los atributos sólo afinan, y se comprueba abajo que no cambian el recuento).
const distintos = (v, conAttrs) => {
  const m = new Map();
  for (const r of v) for (const c of r.cortos) {
    const k = [r.fn, c.sel, c.texto, conAttrs ? c.attrs : ''].join('|');
    const p = m.get(k);
    const anchos = p ? p.anchos : {};
    anchos[r.ancho] = Math.round(c.tocable * 10) / 10;
    m.set(k, { fn: r.fn, sel: c.sel, texto: c.texto, attrs: c.attrs, anchos, min: Math.min(p ? p.min : Infinity, c.tocable) });
  }
  return m;
};
const M = cargar(fm), R = cargar(fr);
for (const [n, v] of [['main', M], ['rama', R]]) {
  console.log(`${n}: superficies×anchos ${v.length} · distintos (criterio del censo) ${distintos(v, false).size} · con atributos ${distintos(v, true).size}`);
}
const dm = distintos(M, false), dr = distintos(R, false);
const soloRama = [...dr.keys()].filter((k) => !dm.has(k));
const soloMain = [...dm.keys()].filter((k) => !dr.has(k));
const linea = (e) => `${e.fn.replace(/^render|View$/g, '')} · ${e.sel} · «${e.texto}»${e.attrs ? ' · ' + e.attrs : ''} · ${Object.entries(e.anchos).map(([a, px]) => a + 'px→' + px).join(' ')}`;
console.log(`\n=== NUEVOS (cortos en la rama, no en main): ${soloRama.length}`);
for (const k of soloRama.sort()) console.log('  + ' + linea(dr.get(k)));
console.log(`\n=== QUITADOS (cortos en main, ya no en la rama): ${soloMain.length}`);
for (const k of soloMain.sort()) console.log('  - ' + linea(dm.get(k)));
// Por pantalla a cada anchura, en los dos árboles: lo que el orquestador citó (Inicio, Informes, Exportar).
console.log('\n=== por pantalla (cortos main → rama)');
const porP = (v) => { const o = {}; for (const r of v) o[r.fn + '@' + r.ancho] = r.cortos.length; return o; };
const pm = porP(M), pr = porP(R);
for (const k of Object.keys(pr).sort()) if (pm[k] !== pr[k]) console.log(`  ${k}: ${pm[k] ?? 'sin medir'} → ${pr[k]}`);
