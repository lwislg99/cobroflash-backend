// Simula la mudanza de S5 en un clon: saca ㉕ y ㉖ de scrum813 y los pone en un fichero nuevo.
//   node mudar.mjs <raiz-del-clon> [--con-linea] [--solo-linea]
import fs from 'node:fs';
import path from 'node:path';
const [raiz, ...flags] = process.argv.slice(2);
const f813 = path.join(raiz, 'tests', 'scrum813-trinquete-de-zona.test.mjs');
const suelo = path.join(raiz, 'scripts', '_suelo-contra-main.mjs');
if (!flags.includes('--solo-linea')) {
  const t = fs.readFileSync(f813, 'utf8');
  const ini = t.indexOf('  // ㉕ EL COMPARADOR LEE');
  const fin = t.indexOf('\n];', ini);
  if (ini < 0 || fin < 0) { console.error('no encuentro ㉕/㉖'); process.exit(2); }
  const bloque = t.slice(ini, fin + 1);
  fs.writeFileSync(f813, t.slice(0, ini) + t.slice(fin + 1));
  fs.writeFileSync(path.join(raiz, 'tests', 'scrum1494-cortados-de-zona.test.mjs'),
    `import test from 'node:test';\nexport const MUTACIONES_QUE_ME_TUMBAN = [\n${bloque}];\n`
    + "test('`cortada` no es un veredicto: frente a un `pass` NO acusa', () => {});\n"
    + "test('lo que a solas se vuelve a CORTAR sigue sin comparar', () => {});\n");
}
if (flags.includes('--con-linea') || flags.includes('--solo-linea')) {
  const s = fs.readFileSync(suelo, 'utf8');
  const ancla = '\n];\n\n// ══';
  if (s.split(ancla).length !== 2) { console.error('ancla del suelo ambigua'); process.exit(2); }
  fs.writeFileSync(suelo, s.replace(ancla, "\n  { guard: 'scrum813-trinquete-de-zona.test.mjs', motivo: 'SCRUM-935d: ㉕ ㉖ se MUDAN a scrum1494-cortados-de-zona, no se retiran (26 → 24)', fecha: '2026-10-22', antes: 26, ahora: 24 },\n];\n\n// ══"));
}
console.log('ok');
