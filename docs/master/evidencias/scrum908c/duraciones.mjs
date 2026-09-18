// Duración del job meta-guard por conclusión, desde el censo ya bajado.
import { readFileSync } from 'node:fs';
const T = process.env.J6_908C_DIR || '.'; // directorio de trabajo del banco (fuera del árbol)
const filas = JSON.parse(readFileSync(`${T}/censo-meta-ci.json`, 'utf8'));
console.log(`POBLACION runs=${filas.length}`);
const por = {};
for (const f of filas) {
  if (!f.mg_ini || !f.mg_fin) { (por[`${f.mg_concl}-sin-tiempos`] ??= []).push(null); continue; }
  const s = (Date.parse(f.mg_fin) - Date.parse(f.mg_ini)) / 1000;
  (por[f.mg_concl] ??= []).push(s);
}
for (const [k, v] of Object.entries(por)) {
  const n = v.filter((x) => x !== null).sort((a, b) => a - b);
  const ge590 = n.filter((x) => x >= 590).length;
  const lt60 = n.filter((x) => x < 60).length;
  console.log(k, 'n=' + v.length, n.length ? `min=${n[0]} med=${n[Math.floor(n.length / 2)]} max=${n[n.length - 1]} >=590s:${ge590} <60s:${lt60}` : '');
}
// Primer y último de cada conclusión, y los success con su hora
for (const f of filas.filter((x) => x.mg_concl === 'success')) console.log('success', f.run, f.creado, f.rama, (Date.parse(f.mg_fin) - Date.parse(f.mg_ini)) / 1000);
console.log('EXIT=0');
