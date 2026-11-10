// Sólo lectura (SCRUM-962c). Lee la salida de editor-recorrido.mjs, junta cada control entre estados y clasifica
// los cortos: DEFECTO · EXENTO (btn-sm, DESIGN.md §5) · ARTEFACTO (casilla/radio con etiqueta ≥44 que la activa).
// Uso: node editor-analisis.mjs <editor.json> [--md]
import fs from 'node:fs';
const R = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const MD = process.argv.includes('--md');
const ctl = new Map(); // clave -> ficha
for (const r of R) {
  if (!r.alcanzado) continue;
  for (const m of r.medidos) {
    if (!ctl.has(m.clave)) ctl.set(m.clave, { ...m, t: {}, errores: {}, estados: new Set(), etiq: {} });
    const c = ctl.get(m.clave);
    c.estados.add(r.estado.replace(/ \(cerrado\)/, ''));
    if (m.tocable === null) { c.errores[r.ancho] = m.error; continue; }
    c.t[r.ancho] = Math.min(c.t[r.ancho] ?? Infinity, m.tocable);
    if (m.etiquetas && m.etiquetas.length && !c.etiq[r.ancho]) c.etiq[r.ancho] = m.etiquetas;
  }
}
const L = [...ctl.values()];
const sm = (c) => /(^|\s)btn-sm(\s|$)/.test(c.cls);
const primario = (c) => /btn-primary/.test(c.cls);
const casilla = (c) => c.tag === 'input' && ['checkbox', 'radio'].includes(c.tipo);
const etiquetaSalva = (c, a) => (c.etiq[a] || []).some((e) => e.activa === true && (e.tocable ?? 0) >= 44);
const corto = (c, a, min) => c.t[a] !== undefined && c.t[a] < min;
// Un control que su ETIQUETA (≥44, clic real que lo activa) cubre: el dedo tiene la etiqueta. Para un <select>
// «activar» = enfocarlo, y eso no prueba que el desplegable se abra: DUDOSO, no artefacto.
const cubierto = (c) => (!corto(c, 390, 44) || etiquetaSalva(c, 390)) && (!corto(c, 929, 44) || etiquetaSalva(c, 929));
function veredicto(c) {
  const c390 = corto(c, 390, 44), c929 = corto(c, 929, 44);
  if (!c390 && !c929) return null;
  if (['input', 'textarea'].includes(c.tag) && cubierto(c)) return 'ARTEFACTO';
  if (c.tag === 'select' && cubierto(c)) return 'DUDOSO';
  if (sm(c)) return primario(c) ? 'EXENTO·primario' : 'EXENTO';
  if (!c390 && (c.t[929] ?? 99) >= 36) return 'SOLO-ESCRITORIO';   // cumple DESIGN.md §5: 36 en escritorio
  return 'DEFECTO';
}
const filas = L.map((c) => ({ c, v: veredicto(c) })).filter((x) => x.v);
const orden = { DEFECTO: 0, DUDOSO: 1, 'EXENTO·primario': 2, 'SOLO-ESCRITORIO': 3, EXENTO: 4, ARTEFACTO: 5 };
// La población del censo: en el estado del MONTAJE y con su selector.
for (const c of L) c.enPoblacion = c.enCenso && c.estados.has('1 · Cliente (montaje)');
filas.sort((a, b) => (orden[a.v] - orden[b.v]) || ((a.c.t[390] ?? 99) - (b.c.t[390] ?? 99)));
const cuenta = {}; for (const f of filas) cuenta[f.v] = (cuenta[f.v] || 0) + 1;
console.log(`controles distintos medidos: ${L.length} · en la población del censo: ${L.filter((c) => c.enCenso).length} · cortos (<44 a alguna anchura): ${filas.length}`);
console.log('por veredicto:', JSON.stringify(cuenta));
console.log('cortos en la población del censo:', filas.filter((f) => f.c.enPoblacion).length, '· DEFECTO o DUDOSO a 390 en la población del censo:', filas.filter((f) => f.c.enPoblacion && ['DEFECTO', 'DUDOSO'].includes(f.v)).length);
const sinMedir = L.filter((c) => c.t[390] === undefined && c.t[929] === undefined);
console.log('medidos sólo con error del árbitro (tapados/no alcanzables):', sinMedir.length, sinMedir.map((c) => c.rotulo + ' → ' + JSON.stringify(c.errores)).join(' | '));
const et = (c) => { const e = (c.etiq[390] || c.etiq[929] || []); return e.length ? e.map((x) => `etiqueta ${x.contiene ? 'envolvente' : 'for='} ${x.tocable ?? '?'} px · clic ${x.activa === true ? 'ACTIVA' : x.activa === false ? 'no activa' : 'sin punto'}`).join('; ') : '—'; };
if (MD) {
  console.log('\n| # | veredicto | control | rótulo | clase | toque @390 | toque @929 | etiqueta | dónde aparece | ¿en el censo? |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  filas.forEach(({ c, v }, i) => console.log(`| ${i + 1} | ${v} | ${c.tag}${c.tipo ? '[' + c.tipo + ']' : ''} | ${c.rotulo.replace(/\|/g, '/')} | \`${c.cls || '—'}\` | ${c.t[390] ?? '—'} | ${c.t[929] ?? '—'} | ${et(c)} | ${[...c.estados][0]} | ${c.enPoblacion ? 'sí' : c.enCenso ? 'no · oculto al montar' : 'no · el selector no lo incluye'} |`));
} else {
  filas.forEach(({ c, v }) => console.log(`${v.padEnd(16)} ${String(c.t[390] ?? '—').padStart(5)} ${String(c.t[929] ?? '—').padStart(5)}  ${c.tag}${c.tipo ? '[' + c.tipo + ']' : ''} «${c.rotulo}» .${c.cls} · ${et(c)} · ${[...c.estados][0]} · bloque=${c.bloque.slice(0, 50)}`));
}
