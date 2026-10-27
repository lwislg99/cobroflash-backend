// SCRUM-1560 · antes/después del censo táctil al cambiar los DATOS de muestra (no el instrumento).
// `node diff-censo.mjs antes.json despues.json` (los `resultados` del censo, volcados por una copia).
// Empareja por (vista, ancho, selector, texto, ordinal): el serializador no cambia aquí, así que el
// texto es estable; lo que cambia es QUÉ se pinta.
import fs from 'node:fs';
const [A, D] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
const clave = (rs) => {
  const m = new Map();
  for (const r of rs) {
    const n = {};
    for (const x of r.medidos) {
      const k0 = `${r.fn}|${r.ancho}|${x.sel}|${x.texto}`;
      n[k0] = (n[k0] || 0) + 1;
      m.set(`${k0}|${n[k0]}`, { fn: r.fn, ancho: r.ancho, ...x });
    }
  }
  return m;
};
const VA = clave(A), VD = clave(D);
const f = (x) => `${x.fn} @${x.ancho} · ${x.sel} «${x.texto}» ${x.tocable.toFixed(1)} px ${x.cumple ? 'cumple' : 'CORTO'}`;

console.log('── POR PANTALLA Y ANCHO (medidos / cortos), sólo las que cambian');
const resumen = (rs) => new Map(rs.map((r) => [`${r.fn}|${r.ancho}`, { m: r.medidos.length, c: r.medidos.filter((x) => !x.cumple).length }]));
const RA = resumen(A), RD = resumen(D);
for (const k of [...new Set([...RA.keys(), ...RD.keys()])].sort()) {
  const a = RA.get(k), d = RD.get(k);
  const s = (v) => (v ? `${v.m} / ${v.c}` : 'no medida');
  if (!a || !d || a.m !== d.m || a.c !== d.c) console.log(`  ${k.replace('|', ' @')}: ${s(a)} → ${s(d)}`);
}
const nuevos = [...VD].filter(([k]) => !VA.has(k)).map(([, x]) => x);
const idos = [...VA].filter(([k]) => !VD.has(k)).map(([, x]) => x);
const volteados = [...VD].filter(([k, d]) => VA.has(k) && VA.get(k).cumple !== d.cumple).map(([k, d]) => [VA.get(k), d]);
const movidos = [...VD].filter(([k, d]) => VA.has(k) && VA.get(k).cumple === d.cumple && Math.abs(VA.get(k).tocable - d.tocable) >= 0.5);
console.log(`\nemparejados: ${[...VD.keys()].filter((k) => VA.has(k)).length} · NUEVOS: ${nuevos.length} (cortos ${nuevos.filter((x) => !x.cumple).length}) · DESAPARECIDOS: ${idos.length} (cortos ${idos.filter((x) => !x.cumple).length}) · cambian de veredicto: ${volteados.length} · cambian de área ≥ 0,5 px: ${movidos.length}`);
console.log('\n── NUEVOS cortos');
for (const x of nuevos.filter((x) => !x.cumple)) console.log('  ' + f(x));
console.log('\n── DESAPARECIDOS (lo que el dato imposible pintaba y el servidor no da)');
for (const x of idos) console.log('  ' + f(x));
console.log('\n── CAMBIAN DE VEREDICTO');
for (const [a, d] of volteados) console.log(`  ${f(a)} → ${d.tocable.toFixed(1)} px`);
console.log('\n── CAMBIAN DE ÁREA ≥ 0,5 px (mismo veredicto)');
for (const [k, d] of movidos) console.log(`  ${f(VA.get(k))} → ${d.tocable.toFixed(1)} px`);
