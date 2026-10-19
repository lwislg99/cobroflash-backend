import fs from 'node:fs';
const t = fs.readFileSync(process.argv[2], 'utf8');
const s2 = t.split('\n## 2 · ')[1].split('\n## 3 · ')[0];
const filas = s2.split('\n').filter((l) => /^\| \d+\.\d+ \|/.test(l));
const quien = ['FUNDADOR', 'JAVIER', 'NOSOTROS', 'ASESOR'];
const aparece = Object.fromEntries(quien.map((q) => [q, 0]));
const solo = Object.fromEntries(quien.map((q) => [q, 0]));
for (const f of filas) {
  const dep = f.split('|')[4];
  const tiene = quien.filter((q) => dep.includes(q));
  if (tiene.length === 0) console.log('SIN DEPENDENCIA:', f.slice(0, 60));
  for (const q of tiene) aparece[q]++;
  if (tiene.length === 1) solo[tiene[0]]++;
}
console.log('filas', filas.length);
console.log('aparece', aparece);
console.log('solo', solo);
