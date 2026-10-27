// ¿QUIÉN dice la letra que firmó cada hoja de grupo? Cruza con el papel. Uso: node quien-firma.mjs
import fs from 'node:fs';
import path from 'node:path';
const j = JSON.parse(fs.readFileSync(path.join(path.dirname(process.argv[1]), 'quien-la-vio.json'), 'utf8'));
const frases = (f) => [...f.matchAll(/(APROBAD[OA]S?|FIRMAD[OA]S?)[^.]{0,200}/g)].map((m) => m[0]).join(' ‖ ');
function quien(r) {
  const f = frases(r.firma);
  const espera = /a la espera (de la firma )?del fundador|provisionales/i.test(r.firma) && !/ya no\b/.test(r.firma);
  if (/NINGUNO ESTÁ APROBADO/.test(r.firma)) return 'LETRA_NEGADA(resuelta en «ambiguos»)';
  if (/asesor/i.test(f) && /espera|provisional/i.test(f)) return 'ASESOR_A_LA_ESPERA_DEL_FUNDADOR';
  if (/delegaci/i.test(f)) return 'DELEGACION';
  if (/fundador/i.test(f)) return 'FUNDADOR';
  if (/asesor/i.test(f)) return espera ? 'ASESOR_A_LA_ESPERA_DEL_FUNDADOR' : 'ASESOR';
  return 'NO_DICE_QUIEN';
}
const t = {};
for (const r of j.filas) {
  r.quien = quien(r);
  const papel = r.papel === 'ENTERO' ? 'con acta' : 'SIN acta';
  t[r.quien] = t[r.quien] || { 'con acta': 0, 'SIN acta': 0, objetos: new Set() };
  t[r.quien][papel]++;
  t[r.quien].objetos.add(r.id.replace('public/dashboard/js/', '').split(' · ').map((p, i) => i ? p.split('.')[0] : p).join('·'));
}
console.log(`POBLACION: ${j.filas.length} hojas de grupo · main ${j.main}`);
for (const [k, v] of Object.entries(t).sort()) console.log(`${String(v['con acta'] + v['SIN acta']).padStart(4)}  ${k.padEnd(40)} con acta ${String(v['con acta']).padStart(3)} · SIN acta ${String(v['SIN acta']).padStart(3)}\n        ${[...v.objetos].join(' | ')}`);
console.log('\nNO_DICE_QUIEN, la letra:');
for (const f of new Set(j.filas.filter((r) => r.quien === 'NO_DICE_QUIEN').map((r) => r.firma))) console.log('  · ' + frases(f).slice(0, 300));
console.log('\nASESOR_A_LA_ESPERA_DEL_FUNDADOR, la letra ENTERA:');
for (const f of new Set(j.filas.filter((r) => r.quien === 'ASESOR_A_LA_ESPERA_DEL_FUNDADOR').map((r) => r.firma))) console.log('  · ' + f.replace(/[─═]{3,}/g, '').slice(0, 1400) + '\n');
console.log('EXIT=0');
