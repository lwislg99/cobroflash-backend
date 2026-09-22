// SCRUM-935 · comprueba el job meta-mutaciones de ci.yml y vuelca sus `run:` para `bash -n`.
//
// ⚠️ LO QUE ESTE INSTRUMENTO NO PUEDE DECIR, declarado: en esta máquina NO hay parser de YAML
// (ni js-yaml ni yaml en node_modules, ni pyyaml en Python 3.13), así que esto NO valida el YAML:
// lee por líneas e indentación. La validación de verdad del YAML la da GitHub POR EFECTO — si el
// fichero no parsea, el workflow no arranca y el PR se queda sin checks, que es justo lo que se
// mira al empujar. Este instrumento sólo comprueba que lo que quise escribir está escrito.
import fs from 'node:fs';
import path from 'node:path';

const ruta = process.argv[2];
const salidaSh = process.argv[3];
const texto = fs.readFileSync(ruta, 'utf8');
const lineas = texto.split(/\r?\n/);

// bloque del job: desde "  meta-mutaciones:" hasta la siguiente línea con indentación 2 y ':'
const iniJob = lineas.findIndex((l) => /^ {2}meta-mutaciones:\s*$/.test(l));
let finJob = lineas.length;
for (let i = iniJob + 1; i < lineas.length; i++) {
  if (/^ {2}[A-Za-z0-9_-]+:\s*$/.test(lineas[i])) { finJob = i; break; }
}
const bloque = lineas.slice(iniJob, finJob);
console.log(`POBLACIÓN · ${ruta} · ${lineas.length} líneas · bloque meta-mutaciones = líneas ${iniJob + 1}-${finJob} (${bloque.length})`);

const sinComentarios = bloque.filter((l) => !/^\s*#/.test(l));
console.log(`  del bloque, ${sinComentarios.length} líneas NO son comentario (se juzga sobre ÉSTAS: A23 #2)`);

let fallos = 0;
function exige(cond, frase) { console.log(`  ${cond ? '✔' : '✘'} ${frase}`); if (!cond) fallos++; }

const timeouts = sinComentarios.filter((l) => /^\s*timeout-minutes:/.test(l));
console.log('\nCOMPROBACIONES:');
exige(iniJob >= 0, 'el job meta-mutaciones existe');
exige(timeouts.length === 1, `el job declara UN timeout-minutes (encontrados ${timeouts.length}: ${timeouts.map((t) => t.trim()).join(' | ')})`);
exige(timeouts.length === 1 && /timeout-minutes:\s*30\s*$/.test(timeouts[0]), 'y vale 30');
exige(!sinComentarios.some((l) => /timeout-minutes:\s*10\s*$/.test(l)), 'ya no queda ningún timeout-minutes: 10 en el bloque (fuera de comentarios)');

const nombres = sinComentarios.filter((l) => /^ {6}- name:/.test(l)).map((l) => l.replace(/^ {6}- name:\s*/, ''));
console.log(`\n  pasos con nombre (${nombres.length}):`);
for (const n of nombres) console.log(`      · ${n}`);
const iMarca = nombres.findIndex((n) => n.includes('Marca de arranque'));
const iMuta = nombres.findIndex((n) => n.includes('Cada guard cae'));
const iMide = nombres.findIndex((n) => n.includes('Cuánto ha tardado'));
console.log('');
exige(iMarca >= 0, 'existe el paso de la marca de arranque');
exige(iMuta >= 0, 'sigue existiendo el paso que corre meta:mutaciones');
exige(iMide >= 0, 'existe el paso que mide y avisa');
exige(iMarca >= 0 && iMuta > iMarca && iMide > iMuta, 'el orden es marca → mutaciones → medición');

// el paso que mide: desde su - name: hasta el siguiente - name: o el fin del bloque
const posMide = sinComentarios.findIndex((l) => /^ {6}- name:.*Cuánto ha tardado/.test(l));
let finMide = sinComentarios.length;
for (let i = posMide + 1; i < sinComentarios.length; i++) if (/^ {6}- /.test(sinComentarios[i])) { finMide = i; break; }
const pasoMide = sinComentarios.slice(posMide, finMide);
exige(pasoMide.some((l) => /^\s*if:\s*always\(\)\s*$/.test(l)), 'el paso que mide lleva `if: always()`');
exige(pasoMide.some((l) => /PRESUPUESTO_S:\s*'1800'/.test(l)), 'declara PRESUPUESTO_S: 1800 (los 30 min, en segundos)');
exige(pasoMide.some((l) => /AVISO_S:\s*'1200'/.test(l)), 'declara AVISO_S: 1200 (avisa a los 20 min)');
exige(pasoMide.some((l) => /::warning title=El meta-guard se acerca a su techo/.test(l)), 'el aviso sale como ::warning de Actions');
exige(pasoMide.some((l) => /NO PUDE MIRAR/.test(l)), 'y si no hay marca de arranque, dice «NO PUDE MIRAR» en vez de callar (suelo)');

// volcar los run: del bloque para bash -n
fs.mkdirSync(salidaSh, { recursive: true });
let n = 0;
for (let i = 0; i < sinComentarios.length; i++) {
  const m = sinComentarios[i].match(/^ {8}run:\s*(\|)?\s*(.*)$/);
  if (!m) continue;
  n++;
  let cuerpo;
  if (m[1] === '|') {
    const cuerpoL = [];
    for (let j = i + 1; j < sinComentarios.length; j++) {
      if (sinComentarios[j].trim() === '') { cuerpoL.push(''); continue; }
      if (!/^ {10}/.test(sinComentarios[j])) break;
      cuerpoL.push(sinComentarios[j].slice(10));
    }
    cuerpo = cuerpoL.join('\n');
  } else cuerpo = m[2];
  fs.writeFileSync(path.join(salidaSh, `paso-${n}.sh`), '#!/usr/bin/env bash\nset -eo pipefail\n' + cuerpo + '\n', { encoding: 'utf8' });
}
console.log(`\nVolcados ${n} pasos con \`run:\` a ${salidaSh} (para \`bash -n\`). Si n=0, el instrumento NO ha mirado nada.`);
if (n === 0) fallos++;
console.log(fallos ? 'EXIT=1' : 'EXIT=0');
process.exit(fallos ? 1 : 0);
