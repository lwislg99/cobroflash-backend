// ¿Lo que llegó en CI es un PREFIJO EXACTO de lo que la misma mutación produce aquí, entera?
import fs from 'node:fs'; import path from 'node:path';
const T = process.argv[2];
const local = [...JSON.parse(fs.readFileSync(path.join(T, 'local-859-757.json'), 'utf8')), ...JSON.parse(fs.readFileSync(path.join(T, 'local-4.json'), 'utf8'))];
const det = JSON.parse(fs.readFileSync(path.join(T, 'hist', 'detalle2.json'), 'utf8'));
const limpio = (l) => l.replace(/^[^\t]*\t[^\t]*\t/, '').replace(/^﻿?\d{4}-\d\d-\d\dT[\d:.]+Z ?/, '');
const busca = (g, cae) => {
  const f = local.find((x) => x.guard === `${g}.test.mjs`); if (!f) return null;
  const c = f.muts.filter((m) => m.estado === 'MEDIDA' && m.cae === cae);
  return c.length === 1 ? { f, m: c[0] } : (c.length ? { f, m: c[0], ambiguo: c.length } : null);
};
const res = { 'NO-APARECE': [], MUERTO: [], 'LIMPIA-SIN-VERDE': [] };
for (const d of det) {
  const L = fs.readFileSync(path.join(T, 'hist', 'logs', `${d.id}.txt`), 'utf8').split('\n').map(limpio);
  for (let k = 0; k < L.length; k += 1) {
    const v = L[k].match(/^ {2}· (\S+)\.test\.mjs · (.*)$/); if (!v) continue;
    const g = v[1]; const t = [v[2], L[k + 1] || '', L[k + 2] || ''].join('\n');
    if (/MURIÓ AL MUTAR/.test(t)) {
      const cae = (t.match(/declarado —«([^»]*)»/) || [])[1]; const x = busca(g, cae);
      if (!x) { res.MUERTO.push({ id: d.id, g, cae, v: 'SIN-PAREJA-LOCAL' }); continue; }
      const primerC = x.m.orden.indexOf('c') + 1;
      res.MUERTO.push({ id: d.id, g, cae, pos: x.m.posicion, n: x.m.nMutada, v: primerC === x.m.posicion ? 'COHERENTE (el declarado es el PRIMER caído: antes de él no hay ningún rojo que llegue)' : `NO-COHERENTE (hay un caído antes, en ${primerC})` });
    } else if (/en la pasada MUTADA ese test: NO APARECE/.test(t)) {
      const cae = (t.match(/ponerse rojo: «([^»]*)»/) || [])[1]; const x = busca(g, cae);
      const r = t.match(/Recuento: (\d+) pasados · (\d+) caídos · (\d+) saltados\. Y en la LIMPIA: (\d+) pasados/);
      if (!x || !r) { res['NO-APARECE'].push({ id: d.id, g, cae, v: 'SIN-PAREJA-LOCAL' }); continue; }
      const K = Number(r[1]) + Number(r[2]); const pre = x.m.orden.slice(0, K);
      const p = (pre.match(/p/g) || []).length; const c = (pre.match(/c/g) || []).length;
      const ok = p === Number(r[1]) && c === Number(r[2]) && x.m.posicion > K && Number(r[4]) === x.f.nLimpia;
      res['NO-APARECE'].push({ id: d.id, g, cae, pos: x.m.posicion, n: x.m.nMutada, llegaron: K, v: ok ? 'PREFIJO-EXACTO' : `NO-CASA (CI ${r[1]}p+${r[2]}c de limpia ${r[4]}; aquí los ${K} primeros dan ${p}p+${c}c, declarado en ${x.m.posicion}, limpia ${x.f.nLimpia})` });
    } else if (/pasada limpia, así que no se ha mutado/.test(t)) {
      const cae = (t.match(/el test «([^»]*)»/) || [])[1]; const x = busca(g, cae);
      res['LIMPIA-SIN-VERDE'].push({ id: d.id, g, cae, pos: x?.m.posicion ?? null, n: x?.m.nMutada ?? null, v: x ? 'CON-PAREJA' : 'SIN-PAREJA-LOCAL' });
    }
  }
}
const cuenta = (xs) => xs.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map());
const tabla = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `   ${String(v).padStart(4)}  ${k}`).join('\n');
for (const k of Object.keys(res)) console.log(`\n${k} · ${res[k].length} instancias\n` + tabla(cuenta(res[k].map((x) => x.v.replace(/\(CI.*$/, '…')))));
for (const x of [...res['NO-APARECE'], ...res.MUERTO].filter((y) => /NO-CASA|NO-COHERENTE|SIN-PAREJA/.test(y.v))) console.log(`   ⚠ ${x.id} ${x.g} «${(x.cae || '').slice(0, 50)}» ${x.v}`);
for (const x of res['LIMPIA-SIN-VERDE'].filter((y) => y.v === 'SIN-PAREJA-LOCAL')) console.log(`   (limpia sin pareja) ${x.id} ${x.g} «${(x.cae || '').slice(0, 50)}»`);
// La dosis: posición del test declarado dentro de su fichero, de TODAS las declaraciones medidas
console.log('\nPOSICIÓN del test declarado · todas las declaraciones de los 6 ficheros · veces que salió ciega/muerta en CI');
const veces = cuenta([...res['NO-APARECE'], ...res.MUERTO, ...res['LIMPIA-SIN-VERDE']].map((x) => `${x.g}|${x.cae}`));
for (const f of local) for (const m of f.muts.filter((y) => y.estado === 'MEDIDA')) {
  const n = veces.get(`${f.guard.replace(/\.test\.mjs$/, '')}|${m.cae}`) || 0;
  console.log(`   ${String(n).padStart(3)} veces · posición ${String(m.posicion).padStart(2)}/${m.nMutada} · mutada ${String(m.bytes).padStart(7)} B · limpia ${f.bytesLimpia} B · ${f.guard.slice(0, 22)} · «${m.cae.slice(0, 48)}»`);
}
