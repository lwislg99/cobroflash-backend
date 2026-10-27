// Cuenta los casos del log de un job (reporter spec de node) anclando al INICIO del caso.
//   node contar.mjs <log> [--sin-positivo]
import fs from 'node:fs';
const f = process.argv[2];
const bytes = fs.statSync(f).size;
const crudo = fs.readFileSync(f, 'utf8');
const ESC = String.fromCharCode(27);
const BOM = new RegExp('^' + String.fromCharCode(0xFEFF));
const quitaColor = new RegExp(ESC + '\\[[0-9;]*m', 'g');
const lineas = crudo.split('\n').map((l) => l.replace(/\r$/, '').replace(BOM, '').replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z /, '').replace(quitaColor, ''));
console.log('POBLACION · ' + bytes + ' B · ' + lineas.length + ' lineas');

// el resumen declarado por node
const decl = {};
let finTramo = -1;
lineas.forEach((l, i) => {
  const m = /^ℹ (tests|suites|pass|fail|cancelled|skipped|todo) (\d+)$/.exec(l);
  if (m) { if (m[1] in decl) decl[m[1] + '_REPETIDO'] = 1; decl[m[1]] = Number(m[2]); if (m[1] === 'tests') finTramo = i; }
});
console.log('DECLARADO · ' + JSON.stringify(decl) + ' · resumen en la linea ' + (finTramo + 1));
if (finTramo < 0) { console.log('CIEGO · el log no lleva resumen: no hay total contra el que sumar'); console.log('EXIT=2'); process.exit(2); }

// el tramo de casos: todo lo anterior al resumen
const DUR = /\(\d+(?:\.\d+)?ms\)(?: # .*)?$/;
const cuenta = { pasa: 0, cae: 0, salta: 0, todo: 0 };
const caidos = [];
const primeros = new Map();
let cruzASecas = 0;
for (let i = 0; i < finTramo; i++) {
  const l = lineas[i];
  if (l.includes('✖')) cruzASecas++;
  const m = /^\s*(\S)\s/.exec(l);
  if (!m || !DUR.test(l)) continue;
  primeros.set(m[1], (primeros.get(m[1]) || 0) + 1);
  if (/ # SKIP\b/i.test(l.slice(l.search(DUR)))) cuenta.salta++;
  else if (/ # TODO\b/i.test(l.slice(l.search(DUR)))) cuenta.todo++;
  else if (m[1] === '✔') cuenta.pasa++;
  else if (m[1] === '✖') { cuenta.cae++; caidos.push((i + 1) + ': ' + l.trim()); }
  else if (m[1] === '﹣') cuenta.salta++;
}
console.log('SIMBOLOS al inicio de linea con duracion · ' + JSON.stringify([...primeros]));
const cruzTodoElLog = lineas.filter((l) => l.includes('✖')).length;
console.log('la cruz A SECAS (no vale) · ' + cruzASecas + ' lineas en el tramo, ' + cruzTodoElLog + ' en todo el log');

// POSITIVO obligatorio: el caso que el orquestador leyo directo tiene que salir caido en el tramo.
const POSITIVO = process.argv.includes('--sin-positivo') ? 'ESTE NOMBRE NO ESTA ' + Date.now() : 'NINGÚN temporal nuevo nace sin borrarse';
const positivos = caidos.filter((c) => c.includes(POSITIVO)).length;
// CERO derivado: el mismo nombre, del reves, anclado igual. No puede estar.
const delReves = [...POSITIVO].reverse().join('');
const ceros = lineas.filter((l) => /^\s*✖\s/.test(l) && l.includes(delReves)).length;
console.log('CONTROL · positivo ' + positivos + ' (hace falta >=1) · cero derivado ' + ceros + ' (hace falta 0)');
if (positivos < 1 || ceros !== 0) { console.log('CIEGO · los controles no salen: no se da ninguna cifra'); console.log('EXIT=2'); process.exit(2); }

const suma = cuenta.pasa + cuenta.cae + cuenta.salta + cuenta.todo;
console.log('CONTADO · pasan ' + cuenta.pasa + ' · caen ' + cuenta.cae + ' · saltan ' + cuenta.salta + ' · todo ' + cuenta.todo + ' · suma ' + suma);
const cuadra = suma === decl.tests && cuenta.pasa === decl.pass && cuenta.cae === decl.fail && cuenta.salta === decl.skipped && cuenta.todo === decl.todo;
console.log(cuadra ? 'CUADRA con lo declarado, partida a partida' : 'NO CUADRA con lo declarado: estoy contando texto, o falta cola');
console.log('LOS QUE CAEN:');
for (const c of caidos) console.log('  ' + c.slice(0, 200));
console.log('EXIT=' + (cuadra ? 0 : 3));
process.exit(cuadra ? 0 : 3);
