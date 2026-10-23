// SCRUM-1402h · compara FILA A FILA dos salidas de `sonda-1402g.mjs` (antes y después del arreglo).
// Uso: node docs/master/evidencias/scrum1402/compara-1402h.mjs <antes.txt> <despues.txt>
// La fila se identifica por (tipo, estado, metadata), no por posición. Las horas e ids de evento no salen
// en la tabla de la sonda, así que dos filas iguales dan el mismo texto.
// 🔴 CONTROL: las dos salidas tienen que tener la MISMA población (108 claves, el mismo conjunto) y las
//    líneas de control `MIDE` en las dos; si no, CIEGA y código 2.
import fs from 'node:fs';

const leer = (f) => {
  const txt = fs.readFileSync(f, 'utf8');
  const filas = new Map();
  for (const l of txt.split(/\r?\n/)) {
    const c = l.split(' | ');
    if (c.length !== 11 || c[0] === 'tipo') continue;
    filas.set(c.slice(0, 3).join(' | '), c.slice(3).join(' | '));
  }
  return { filas, mide: /VEREDICTO: MIDE/.test(txt) };
};
const [a, b] = [leer(process.argv[2]), leer(process.argv[3])];
const claves = [...a.filas.keys()];
const mismas = claves.length === b.filas.size && claves.every((k) => b.filas.has(k));
console.log(`población: antes ${a.filas.size} · después ${b.filas.size} · mismo conjunto: ${mismas} · MIDE: ${a.mide}/${b.mide}`);
if (!a.mide || !b.mide || !mismas || claves.length === 0) { console.log('VEREDICTO: CIEGA'); process.exit(2); }
let distintas = 0;
for (const k of claves) {
  if (a.filas.get(k) === b.filas.get(k)) continue;
  distintas += 1;
  console.log(`\n${k}\n  antes:   ${a.filas.get(k)}\n  después: ${b.filas.get(k)}`);
}
console.log(`\nfilas distintas: ${distintas} de ${claves.length} · idénticas: ${claves.length - distintas}`);
