// fecha-por-dia.mjs — SCRUM-1340: ¿cuándo dejó de escribirse el campo «**Fecha:**»?
// Por cada entrada de hoy: el día de su ancla «Medido contra» y si lleva el campo.
// Uso: node fecha-por-dia.mjs <raiz>
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const RAIZ = process.argv[2];
const imp = (rel) => import(pathToFileURL(path.join(RAIZ, rel)).href);
const m267 = await imp('tests/scrum267-ancla-de-medicion.test.mjs');
const m811 = await imp('tests/scrum811c-skill-ui-declarada.test.mjs');

const entradas = m267.entradasTroceadas();
const dias = new Map();
let sinAncla = 0; let sinAnclaConCampo = 0;
for (const e of entradas) {
  const a = m267.RE_ANCLA.exec(e.cuerpo);
  const campo = /\*\*Fecha:\*\*/.test(e.cuerpo);
  const legible = m811.fechaDeEntrada(e.cuerpo) !== null;
  if (!a) { sinAncla++; if (campo) sinAnclaConCampo++; continue; }
  const d = a[2].slice(0, 10);
  if (!dias.has(d)) dias.set(d, { total: 0, campo: 0, legible: 0 });
  const x = dias.get(d); x.total++; if (campo) x.campo++; if (legible) x.legible++;
}
console.log('FECHA poblacion: entradas=' + entradas.length + ' · con ancla=' + (entradas.length - sinAncla)
  + ' · sin ancla=' + sinAncla + ' (de ellas con el campo: ' + sinAnclaConCampo + ')');
console.log('FECHA dia · entradas · con el campo · con el campo LEGIBLE por el guard');
for (const d of [...dias.keys()].sort()) {
  const x = dias.get(d);
  console.log('FECHA ' + d + ' · ' + String(x.total).padStart(3) + ' · ' + String(x.campo).padStart(3) + ' · ' + String(x.legible).padStart(3)
    + ' · ' + Math.round(100 * x.campo / x.total) + ' %');
}
console.log('FECHA EXIT=0');
