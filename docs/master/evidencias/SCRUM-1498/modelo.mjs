// modelo.mjs <push.json> <push-jobs.json> <desde> <hasta>
// MODELO, no medicion. Un servidor, un solo hueco de espera (el ultimo que llega echa al que esperaba):
// lo que GitHub documenta para un grupo de concurrencia con cancel-in-progress falso.
// Llegadas = las horas REALES de cada push. Servicio = lo que duro de verdad cada run que corrio
// (asignado por orden; a los que no corrieron, la mediana). Se VALIDA contra lo observado antes de usarlo.
import fs from 'node:fs';
const { runs } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const jobs = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const [desde, hasta] = process.argv.slice(4);
const OBL = 'build + tests (con banco desechable)';
const t = (s) => Date.parse(s);
const l = runs.filter((r) => r.creado >= desde && r.creado < hasta && r.estado === 'completed').sort((a, b) => t(a.creado) - t(b.creado));
const med = (v) => { const s = [...v].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const durRun = [], durObl = [];
for (const r of l) {
  if (!(r.jobs > 0)) continue;
  const ns = jobs[r.suite].nodes.filter((n) => n.startedAt && n.completedAt);
  if (!ns.length) continue;
  const ini = Math.min(...ns.map((n) => t(n.startedAt)));
  durRun.push((Math.max(...ns.map((n) => t(n.completedAt))) - ini) / 1000);
  const o = ns.find((n) => n.name === OBL);
  if (o) durObl.push((t(o.completedAt) - ini) / 1000);
}
const simula = (servicio) => {
  let libreEn = -Infinity, espera = null, corridos = 0;
  const arranca = (h) => { corridos++; libreEn = h + servicio; };
  for (const r of l) {
    const h = t(r.creado) / 1000;
    while (espera !== null && libreEn <= h) { const e = espera; espera = null; arranca(Math.max(libreEn, e)); }
    if (libreEn <= h) arranca(h); else espera = h;
  }
  if (espera !== null) corridos++;
  return corridos;
};
const real = l.filter((r) => r.jobs > 0).length;
console.log(`POBLACION ${l.length} pushes a main · ${desde}..${hasta} · corrieron de verdad ${real} (${(100 * real / l.length).toFixed(1)} %)`);
console.log(`duracion real (primer job arranca -> ultimo acaba): mediana ${(med(durRun) / 60).toFixed(1)} min, n=${durRun.length} · hasta que acaba el OBLIGATORIO: mediana ${(med(durObl) / 60).toFixed(1)} min, n=${durObl.length}`);
const filas = [['VALIDACION: servicio = mediana real del run entero', med(durRun)], ['si el grupo se soltara al acabar el obligatorio', med(durObl)], ['servicio 5 min', 300], ['servicio 0 (control: deben correr todos)', 0], ['servicio infinito (control: 1 + el ultimo)', 1e12]];
for (const [n, s] of filas) { const c = simula(s); console.log(`  ${n.padEnd(52)} -> correrian ${c} de ${l.length} (${(100 * c / l.length).toFixed(1)} %)`); }
