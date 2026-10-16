// SCRUM-1559 · diff elemento a elemento del censo táctil: serializador viejo frente a nuevo.
// Empareja por (vista, ancho, selector, ordinal dentro del selector): el TEXTO no sirve de clave
// porque el arreglo (3) lo cambia («N» → «Nuevo clienteN»).
import fs from 'node:fs';
const [viejo, nuevo] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
const clave = (rs) => {
  const m = new Map();
  for (const r of rs) {
    const cuenta = {};
    for (const x of r.medidos) {
      const i = (cuenta[x.sel] = (cuenta[x.sel] || 0) + 1);
      m.set(`${r.fn}|${r.ancho}|${x.sel}|${i}`, { fn: r.fn, ancho: r.ancho, ...x });
    }
  }
  return m;
};
const V = clave(viejo), N = clave(nuevo);
const px = (x) => x.tocable.toFixed(1);
const nuevos = [], perdidos = [], volteados = [], textos = [], movidos = [];
for (const [k, n] of N) {
  const v = V.get(k);
  if (!v) { nuevos.push(n); continue; }
  if (v.cumple !== n.cumple) volteados.push([v, n]);
  if (v.texto !== n.texto) textos.push([v, n]);
  if (Math.abs(v.tocable - n.tocable) >= 0.5) movidos.push([v, n]);
}
for (const [k, v] of V) if (!N.has(k)) perdidos.push(v);
const f = (x) => `${x.fn} @${x.ancho} · ${x.sel} «${x.texto}» · ${px(x)} px · ${x.cumple ? 'cumple' : 'CORTO'}`;
console.log(`emparejados: ${[...N.keys()].filter((k) => V.has(k)).length} · NUEVOS medidos: ${nuevos.length} · DESAPARECIDOS: ${perdidos.length}`);
console.log(`\n── NUEVOS medidos (el instrumento ve más) · cortos ${nuevos.filter((x) => !x.cumple).length} de ${nuevos.length}`);
for (const x of nuevos.sort((a, b) => a.cumple - b.cumple)) console.log('  ' + f(x));
console.log(`\n── DESAPARECIDOS (tiene que ser 0)`);
for (const x of perdidos) console.log('  ' + f(x));
console.log(`\n── CAMBIAN DE VEREDICTO (cumple↔corto) · ${volteados.length}`);
for (const [v, n] of volteados) console.log(`  ${f(v)}  →  ${px(n)} px ${n.cumple ? 'cumple' : 'CORTO'}`);
console.log(`\n── CAMBIAN DE ÁREA ≥ 0,5 px sin cambiar de veredicto · ${movidos.filter(([v, n]) => v.cumple === n.cumple).length}`);
for (const [v, n] of movidos.filter(([a, b]) => a.cumple === b.cumple)) console.log(`  ${f(v)}  →  ${px(n)} px`);
console.log(`\n── CAMBIAN DE TEXTO (arreglo 3) · ${textos.length}`);
for (const [v, n] of textos) console.log(`  ${v.fn} @${v.ancho} · ${v.sel} «${v.texto}» → «${n.texto}» · ${px(v)} → ${px(n)} px`);
