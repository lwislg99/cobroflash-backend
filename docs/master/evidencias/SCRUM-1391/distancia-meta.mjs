// SCRUM-1391 · distancia del meta-guard a su plazo de 300 s por pasada, leida de los logs de CI.
// Cada veredicto se imprime al terminar su pasada: la diferencia entre dos lineas consecutivas es
// COTA SUPERIOR de lo que tardo esa pasada (incluye la pasada limpia cuando cambia de guard).
//   uso: node distancia-meta.mjs <log>...
import fs from 'node:fs';
import path from 'node:path';

const PLAZO_S = 300;
let peorGlobal = 0;
for (const f of process.argv.slice(2)) {
  const lineas = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  const ini = lineas.findIndex((l) => l.includes('Run npm run meta:mutaciones'));
  const fin = lineas.findIndex((l) => /vivas \d+ · mudas \d+ · ciegas \d+/.test(l));
  if (ini < 0 || fin < 0) { console.log(path.basename(f) + ' · CIEGO: no encuentro el tramo del meta-guard (ini ' + ini + ', fin ' + fin + ')'); continue; }
  const marcas = [];
  for (let i = ini; i <= fin; i++) {
    const m = /^(\d{4}-\d\d-\d\dT[\d:.]+Z)\s+(.*)$/.exec(lineas[i]);
    if (!m) continue;
    const esVeredicto = /^\S+ \S+\.test\.mjs · /.test(m[2]);
    if (i === ini || esVeredicto || i === fin) marcas.push({ t: Date.parse(m[1]), texto: m[2].trim().slice(0, 110), esVeredicto });
  }
  const deltas = [];
  for (let i = 1; i < marcas.length; i++) deltas.push({ s: (marcas[i].t - marcas[i - 1].t) / 1000, texto: marcas[i].texto });
  const veredictos = marcas.filter((x) => x.esVeredicto).length;
  deltas.sort((a, b) => b.s - a.s);
  const total = (marcas[marcas.length - 1].t - marcas[0].t) / 1000;
  peorGlobal = Math.max(peorGlobal, deltas[0].s);
  console.log(path.basename(f) + ' · POBLACION: ' + veredictos + ' veredictos · tramo ' + total.toFixed(0) + ' s · ' + lineas[fin].replace(/^\S+\s+/, ''));
  for (const d of deltas.slice(0, 3)) console.log('     ' + d.s.toFixed(1) + ' s (' + (100 * d.s / PLAZO_S).toFixed(0) + ' % del plazo) · ' + d.texto);
  const mediana = deltas[Math.floor(deltas.length / 2)].s;
  console.log('     mediana ' + mediana.toFixed(1) + ' s · mas de 30 s: ' + deltas.filter((d) => d.s > 30).length + ' · mas de 60 s: ' + deltas.filter((d) => d.s > 60).length);
}
console.log('PEOR INTERVALO en ' + (process.argv.length - 2) + ' logs: ' + peorGlobal.toFixed(1) + ' s = ' + (100 * peorGlobal / PLAZO_S).toFixed(0) + ' % del plazo de ' + PLAZO_S + ' s · margen ×' + (PLAZO_S / peorGlobal).toFixed(1));
