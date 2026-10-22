import fs from 'node:fs';
const [, , fViva2, fViva1] = process.argv;
const V2 = JSON.parse(fs.readFileSync(fViva2, 'utf8'));
const V1 = JSON.parse(fs.readFileSync(fViva1, 'utf8'));
// Elementos que se pintan con los datos de muestra del censo ({id,name}): primera pasada.
const clave = (o) => [o.panel, o.tipo, o.rotulo].join('|');
const conDatosDelCenso = new Set(V1.flatMap((r) => r.out.map(clave)));
const filas = new Map();
for (const r of V2) {
  for (const o of r.out) {
    if (o.panel !== '(fuera de paneles)' && o.panel !== r.pestana) continue; // sólo el panel abierto
    const k = clave(o);
    // repetidos dentro del mismo panel (casillas con el mismo rótulo): se numeran
    let kk = k, n = 1; while (filas.has(kk) && filas.get(kk)['seen' + r.ancho + (r.pestana ?? '')]) kk = k + '#' + (++n);
    if (!filas.has(kk)) filas.set(kk, { o, t: {}, caja: {} });
    const f = filas.get(kk);
    f['seen' + r.ancho + (r.pestana ?? '')] = true;
    f.t[r.ancho] = Math.min(f.t[r.ancho] ?? Infinity, o.tocable ?? -1);
    f.caja[r.ancho] = o.caja;
  }
}
let cortos = 0, cortosCenso = 0, total = 0;
const out = [];
for (const [k, f] of filas) {
  const o = f.o;
  const montaje = o.panel === 'empresa' || o.panel === '(fuera de paneles)'; // visible al montar
  const enCenso = o.enSelectorDelCenso && montaje && conDatosDelCenso.has(clave(o));
  const motivo = enCenso ? 'sí' : !o.enSelectorDelCenso ? 'no · el selector no incluye ' + o.tipo.replace(/\[role=.*/, '')
    : !conDatosDelCenso.has(clave(o)) ? 'no · los datos de muestra no la pintan' : 'no · pestaña oculta al montar';
  const corto = (f.t[390] ?? 99) < 44 || (f.t[929] ?? 99) < 44;
  total++; if (corto) { cortos++; if (enCenso) cortosCenso++; }
  out.push(`| ${o.panel} | ${o.tipo} | ${o.rotulo.replace(/\|/g, '/')} | ${f.caja[390]} | ${f.t[390]} | ${f.t[929]} | ${(f.t[390] ?? 0) >= 44 ? 'sí' : '**NO**'} | ${motivo} |`);
}
console.log('| pestaña | control | rótulo | caja @390 | toque @390 | toque @929 | ¿llega a 44 a 390? | ¿en la población del censo? |');
console.log('|---|---|---|---|---|---|---|---|');
console.log(out.join('\n'));
console.log(`\ncontroles ${total} · cortos (<44 en alguna anchura) ${cortos} · de ésos, en la población del censo ${cortosCenso}`);
