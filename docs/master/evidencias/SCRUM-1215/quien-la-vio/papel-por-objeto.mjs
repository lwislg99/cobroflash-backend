// Lee quien-la-vio.json y agrupa por OBJETO las hojas vistas-por-git que no constan en ningún acta:
// cuántas, desde cuándo las gobierna la letra de hoy, y QUÉ CITA esa letra (para ir a mirarlo).
// Además busca los trozos que faltan en el máster y en docs/master/ (que NO son firma: los escribe la sesión).
// Uso: node papel-por-objeto.mjs <árbol>
import fs from 'node:fs';
import path from 'node:path';
const arbol = path.resolve(process.argv[2]);
const aqui = path.dirname(process.argv[1]);
const j = JSON.parse(fs.readFileSync(path.join(aqui, 'quien-la-vio.json'), 'utf8'));
const llano = (s) => s.replace(/[`*_\\]/g, '').replace(/\s+/g, ' ');
const master = llano(fs.readFileSync(path.join(arbol, 'docs/YAQU_MASTER.md'), 'utf8'));
const dm = fs.readdirSync(path.join(arbol, 'docs/master')).filter((n) => n.endsWith('.md'));
const registros = dm.map((n) => llano(fs.readFileSync(path.join(arbol, 'docs/master', n), 'utf8')));
console.log(`POBLACION: ${j.filas.length} hojas de grupo · máster ${master.length} caracteres · ${dm.length} registros en docs/master/ · main ${j.main}`);
// Lo que NO es texto que vea nadie: clases CSS y argumentos de formato.
const noEsTexto = (r) => /TONO_DE_ACEPTACION/.test(r.id);
const sinActa = j.filas.filter((r) => r.papel !== 'ENTERO');
const obj = (r) => r.id.replace('public/dashboard/js/', '').split(' · ').map((p, i) => i ? p.split('.')[0] : p).join(' · ');
const grupos = new Map();
for (const r of j.filas) { const o = obj(r); if (!grupos.has(o)) grupos.set(o, []); grupos.get(o).push(r); }
let enMaster = 0; let enRegistro = 0; let enNada = 0; let noTexto = 0; let sinTrozos = 0; let soloFormato = 0;
for (const r of sinActa) {
  if (noEsTexto(r)) { r.donde = 'NO_ES_TEXTO'; noTexto++; continue; }
  if (r.papel === 'SIN_TROZOS') { r.donde = 'SIN_TROZOS'; sinTrozos++; continue; }
  const falta = r.papelFalta.filter((t) => !/^(es-ES|short|long|numeric|2-digit)$/.test(t));
  if (!falta.length) { r.donde = 'SOLO_FALTA_FORMATO'; soloFormato++; continue; }
  const m = falta.every((t) => master.includes(t));
  const g = falta.every((t) => registros.some((x) => x.includes(t)));
  r.donde = m ? 'MASTER' : g ? 'REGISTRO_DE_TICKET' : 'EN_NINGUN_DOCUMENTO';
  if (m) enMaster++; else if (g) enRegistro++; else enNada++;
}
console.log(`SIN ACTA en docs/microcopy/: ${sinActa.length} de ${j.filas.length}`);
console.log(`  ${noTexto} no son texto (clases CSS) · ${sinTrozos} sin ningún literal (función o referencia) · ${soloFormato} sólo les faltan argumentos de formato`);
console.log(`  ${enMaster} constan en el máster · ${enRegistro} sólo en el registro de un ticket (docs/master/) · ${enNada} en ningún documento`);
console.log('\nPOR OBJETO (sin acta / total) · desde cuándo gobierna la letra de hoy · qué cita:');
for (const [o, l] of [...grupos].sort()) {
  const s = l.filter((r) => r.papel !== 'ENTERO');
  if (!s.length) continue;
  const fechas = [...new Set(l.map((r) => r.fechaG.slice(0, 10) + ' ' + r.shaG.slice(0, 9)))].sort();
  const dd = {}; for (const r of s) dd[r.donde] = (dd[r.donde] || 0) + 1;
  console.log(`\n  ${s.length} / ${l.length}  ${o}   [${Object.entries(dd).map(([k, v]) => k + ' ' + v).join(' · ')}]`);
  console.log(`      letra desde: ${fechas.join(' | ')}`);
  const firmas = [...new Set(l.map((r) => r.firma))];
  for (const f of firmas) {
    const citas = [...f.matchAll(/(APROBAD[OA]S?|FIRMAD[OA]S?)[^.]{0,220}/g)].map((m) => m[0].replace(/[─═]+/g, '').trim());
    console.log(`      la letra dice: ${citas.length ? citas.map((c) => '«' + c + '»').join(' … ') : '(sin frase de firma legible: ' + f.slice(0, 200) + ')'}`);
    const refs = [...new Set([...f.matchAll(/SCRUM-\d+[a-z]?|comentario \d+|c\.\s?\d+|docs\/microcopy\/[\w.\-]+/g)].map((m) => m[0]))];
    console.log(`      cita: ${refs.join(', ') || '—'}`);
  }
}
console.log('\nEXIT=0');
