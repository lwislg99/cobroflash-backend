#!/usr/bin/env node
// docs/master/evidencias/scrum1389/resumir-veces.mjs — SCRUM-1389
// Resume el .jsonl que deja `cuantas-veces.mjs`. Declara la población de cada cifra.
// USO: node docs/master/evidencias/scrum1389/resumir-veces.mjs <salida.jsonl>
import fs from 'node:fs';

const filas = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const SUELO_NATIVO = 0xC0000000; // el mismo suelo que SCRUM-1343 puso en guards-visuales.mjs
const sinLog = filas.filter((f) => f.sinLog !== undefined);
const conLog = filas.filter((f) => f.sinLog === undefined);
const delObligatorio = conLog.filter((f) => f.lineasDelObligatorio > 0);
const conSeccion = delObligatorio.filter((f) => f.vistaLaSeccion);
const conFichero = conSeccion.filter((f) => f.ficheros.length > 0);
const soloFichero = conFichero.filter((f) => f.casosRojos === 0);
const conSpawn = delObligatorio.filter((f) => f.spawns.length > 0);
const conExit = delObligatorio.filter((f) => f.exitCodes.length > 0);
const conNativo = delObligatorio.filter((f) => f.exitCodes.some((c) => c >= SUELO_NATIVO));
const conSenal = delObligatorio.filter((f) => f.senales.length > 0);
const conHuella = delObligatorio.filter((f) => f.huellas.length > 0);

console.log('POBLACIÓN: ' + filas.length + ' corridas rojas de ci.yml leídas'
  + (filas.length ? ' · de ' + filas.map((f) => f.creado).sort()[0] + ' a ' + filas.map((f) => f.creado).sort().at(-1) : ''));
console.log('  sin log (gh no lo dio) ............................. ' + sinLog.length);
console.log('  con log ............................................ ' + conLog.length);
console.log('  con algún paso rojo del job obligatorio ............ ' + delObligatorio.length + '   (el resto cayó en OTRO job)');
console.log('  …y con la sección «failing tests» a la vista ....... ' + conSeccion.length);
console.log('');
console.log('SOBRE ESAS ' + conSeccion.length + ' (el rojo del obligatorio se puede leer):');
console.log('  con al menos un FICHERO caído a nivel de proceso ... ' + conFichero.length);
console.log('  …y SIN ningún caso rojo (todo el rojo es de fichero)  ' + soloFichero.length);
console.log('');
console.log('SOBRE LAS ' + delObligatorio.length + ' con paso rojo del obligatorio:');
console.log('  con un `spawn … E…` (el proceso NO SE CREÓ) ........ ' + conSpawn.length);
console.log('  con algún `exitCode:` a la vista (SUELO, ver límites) ' + conExit.length);
console.log('  …de ellas con exitCode ≥ 0xC0000000 (nativo) ....... ' + conNativo.length);
console.log('  con alguna `signal: SIG…` .......................... ' + conSenal.length);
console.log('  con alguna frase del lector de huellas ............. ' + conHuella.length);

const cuenta = (lista) => { const m = new Map(); for (const x of lista) m.set(x, (m.get(x) || 0) + 1); return [...m].sort((a, b) => b[1] - a[1]); };
console.log('\nexitCode vistos: ' + (cuenta(delObligatorio.flatMap((f) => f.exitCodes)).map(([k, v]) => k + '×' + v).join(' · ') || '(ninguno)'));
console.log('señales vistas: ' + (cuenta(delObligatorio.flatMap((f) => f.senales)).map(([k, v]) => k + '×' + v).join(' · ') || '(ninguna)'));
console.log('huellas dichas: ' + (cuenta(delObligatorio.flatMap((f) => f.huellas.map((h) => h.split(' · ')[0]))).map(([k, v]) => k + '×' + v).join(' · ') || '(ninguna)'));
console.log('\nFICHEROS caídos a nivel de proceso, por nº de corridas (los 25 primeros):');
for (const [k, v] of cuenta(conFichero.flatMap((f) => f.ficheros)).slice(0, 25)) console.log('  ' + String(v).padStart(3) + ' · ' + k);
if (conSpawn.length) { console.log('\nLÍNEAS con spawn:'); for (const f of conSpawn) for (const s of f.spawns.slice(0, 3)) console.log('  ' + f.id + ' · ' + f.creado + ' · ' + s); }
if (conNativo.length || conSenal.length) {
  console.log('\nCORRIDAS con nativo o señal:');
  for (const f of delObligatorio.filter((x) => x.senales.length || x.exitCodes.some((c) => c >= SUELO_NATIVO))) console.log('  ' + f.id + ' · ' + f.creado + ' · ' + f.rama + ' · exit ' + f.exitCodes.join(',') + ' · ' + f.senales.join(',') + ' · ' + f.ficheros.join(','));
}
