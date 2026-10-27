// Cuanto DECIDE cada criterio, aplicados en escalera, sobre los scripts que solo cubre la fila general.
// Lee scripts-sueltos.tsv (lo escribe partir-scripts.mjs) y areas-de-tickets.tsv (ticket<TAB>areas, de Jira).
// Uso: node escalera-scripts.mjs <scripts-sueltos.tsv> <areas-de-tickets.tsv> [--listas]
import fs from 'node:fs';
const [tsv, areasF, listas] = process.argv.slice(2);
const lin = (f) => fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean);
const cab = lin(tsv)[0].split('\t');
const filas = lin(tsv).slice(1).map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cab[i], v])));
const areas = new Map(lin(areasF).map((l) => l.split('\t')));
console.log(`POBLACION | ${filas.length} ficheros | ${areas.size} tickets con area | ${new Set(filas.map((f) => f.nace).filter(Boolean)).size} tickets creadores distintos`);
const n = (pred) => filas.filter(pred).length;
// criterio 1 · area del ticket que lo creo
for (const f of filas) { const a = areas.get(f.nace); f.area = !f.nace ? 'SIN-TICKET' : !a ? 'TICKET-SIN-AREA' : a.includes('+') ? 'DOS-AREAS' : a; }
const porArea = {}; for (const f of filas) porArea[f.area] = (porArea[f.area] || 0) + 1;
console.log('\n1 · AREA DEL TICKET QUE LO CREO\n' + Object.entries(porArea).sort((a, b) => b[1] - a[1]).map(([a, c]) => `  ${String(c).padStart(3)}  ${a}`).join('\n'));
const decide1 = (f) => /^[sj]\d$/.test(f.area);
console.log(`  decide puesto: ${n(decide1)} de ${filas.length}`);
// criterio 2 · autor, sobre lo que el 1 no decide
const resto1 = filas.filter((f) => !decide1(f));
const porQuien = {}; for (const f of resto1) porQuien[f.quien] = (porQuien[f.quien] || 0) + 1;
console.log(`\n2 · AUTOR, sobre los ${resto1.length} que el 1 no decide\n` + Object.entries(porQuien).map(([a, c]) => `  ${String(c).padStart(3)}  ${a}`).join('\n'));
const decide2 = (f) => !decide1(f) && (f.quien === 'javier' || f.quien === 'luis');
console.log(`  decide EQUIPO (no puesto): ${n(decide2)} | queda mezclado: ${resto1.length - n(decide2)}`);
// coherencia: donde el 1 decide, ¿el autor dice lo mismo?
const choca = filas.filter((f) => decide1(f) && ((f.area[0] === 's' && f.quien === 'javier') || (f.area[0] === 'j' && f.quien === 'luis')));
console.log(`  control: ficheros donde area y autor se CONTRADICEN: ${choca.length}${choca.length ? ' -> ' + choca.map((f) => f.fichero.replace('scripts/', '') + '(' + f.area + '/' + f.quien + ')').join(', ') : ''}`);
// criterio 3 · quien lo usa, sobre el resto
const resto2 = resto1.filter((f) => !decide2(f));
const porUso = {}; for (const f of resto2) porUso[f.usa] = (porUso[f.usa] || 0) + 1;
console.log(`\n3 · QUIEN LO USA, sobre los ${resto2.length} mezclados\n` + Object.entries(porUso).sort().map(([a, c]) => `  ${String(c).padStart(3)}  ${a}`).join('\n'));
// equipo final por escalera
const equipo = (f) => decide1(f) ? (f.area[0] === 's' ? 'luis' : 'javier') : decide2(f) ? f.quien : 'MEZCLA';
const eq = {}; for (const f of filas) eq[equipo(f)] = (eq[equipo(f)] || 0) + 1;
console.log('\nEQUIPO tras 1 y 2: ' + Object.entries(eq).map(([a, c]) => `${a} ${c}`).join(' | '));
// ayudantes
const ay = filas.filter((f) => f.clase === '_ayudante');
console.log(`\nAYUDANTES (_*): ${ay.length} | los importa algun otro script: ${ay.filter((f) => +f.importadores > 0).length} | solo tests: ${ay.filter((f) => +f.importadores === 0 && +f.tests > 0).length} | importadores de varias filas: ${ay.filter((f) => f.hereda === 'MEZCLA').length}`);
console.log(`NO ayudantes: ${filas.length - ay.length} | por equipo: ` + ['luis', 'javier', 'MEZCLA'].map((e) => `${e} ${filas.filter((f) => f.clase !== '_ayudante' && equipo(f) === e).length}`).join(' | '));
console.log(`SIN USO en codigo (7): ${n((f) => f.usa.startsWith('7'))} | solo npm a mano (6): ${n((f) => f.usa.startsWith('6'))} | sin tocar > 60 d: ${n((f) => f.edad.startsWith('d'))} | las dos cosas (7 y > 30 d): ${n((f) => f.usa.startsWith('7') && /^[cd]/.test(f.edad))}`);
if (listas) {
  const corto = (l) => l.map((f) => f.fichero.replace('scripts/', '')).join(' ');
  console.log('\nLISTA 1-CI: ' + corto(filas.filter((f) => f.usa.startsWith('1'))));
  console.log('LISTA 2-hook: ' + corto(filas.filter((f) => f.usa.startsWith('2'))));
  console.log('LISTA 3-producto: ' + corto(filas.filter((f) => f.usa.startsWith('3'))));
  console.log('LISTA 7-nadie: ' + filas.filter((f) => f.usa.startsWith('7')).map((f) => `${f.fichero.replace('scripts/', '')}[${f.quien},${f.ultimo}]`).join(' '));
  console.log('LISTA 6-npm: ' + corto(filas.filter((f) => f.usa.startsWith('6'))));
  for (const a of ['s0', 's1', 's2', 's3', 's4', 's5', 'j1', 'j2', 'j3', 'j4', 'j5', 'j6']) { const l = filas.filter((f) => f.area === a); if (l.length) console.log(`AREA ${a} (${l.length}): ` + corto(l)); }
}
