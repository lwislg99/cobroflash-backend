// SCRUM-935 · saca de un log de Actions el PERFIL de la pasada: una fila por mutación con el
// segundo en que terminó. Es lo que usa la des-censura, y se guarda aparte porque los logs de
// Actions CADUCAN (90 días) y además llevan secuencias de escape (A22: no entran en el árbol).
// Uso: node perfil-referencia.mjs <log.txt> <salida.tsv>
import fs from 'node:fs';

const RES = /^(\S+Z) {2,}([✔✘])\s(.*)$/u;
const texto = fs.readFileSync(process.argv[2], 'utf8');
const muts = [];
let censo = null;
for (const l of texto.split(/\r?\n/)) {
  const m = l.match(RES);
  if (m) { muts.push({ t: Date.parse(m[1]), ok: m[2] === '✔', clave: m[3].trim() }); continue; }
  const c = l.match(/árbol VIGILADO durante las (\d+) mediciones/);
  if (c) censo = Number(c[1]);
}
if (!muts.length) { console.log('CIEGO · ese log no trae ni una línea de mutación'); console.log('EXIT=2'); process.exit(2); }
const t0 = muts[0].t;
const fase = (muts[muts.length - 1].t - t0) / 1000;
const filas = ['# SCRUM-935 · perfil de una pasada completa del meta-guard',
  `# mutaciones en el log: ${muts.length} · censo que declara el propio instrumento: ${censo}`,
  `# fase de mutación: ${fase.toFixed(1)} s`,
  '#',
  '# n\tseg_desde_la_1a\tfraccion_del_trabajo\tveredicto\tmutacion'];
muts.forEach((m, i) => {
  const seg = (m.t - t0) / 1000;
  // sin bytes de control y sin tabuladores dentro del texto
  const clave = m.clave.replace(/[\u0000-\u001f\u007f]/g, ' ');
  filas.push(`${i + 1}\t${seg.toFixed(1)}\t${(seg / fase).toFixed(4)}\t${m.ok ? 'cae' : 'NO-CAE'}\t${clave}`);
});
fs.writeFileSync(process.argv[3], filas.join('\n') + '\n', { encoding: 'utf8' });
console.log(`POBLACIÓN · ${muts.length} mutaciones · censo ${censo} · fase ${fase.toFixed(1)} s → ${process.argv[3]}`);
console.log('EXIT=0');
