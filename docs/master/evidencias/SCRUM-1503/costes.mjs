// docs/master/evidencias/SCRUM-1503/costes.mjs — SCRUM-1503
//
// Lo que cuesta cada salida de ④, en lo único que aquí se puede medir: cuántos tests y cuánto
// tardaron BAJO LA SONDA (un proceso por test, tres a la vez, en esta máquina). No es lo que
// tardan en la dirigida ni en el CI: es un orden de magnitud con su fuente.
//
// Y el tamaño de lo que la sonda NO pudo ver, partido por si la herramienta ya lo mete siempre.
//
//   node docs/master/evidencias/SCRUM-1503/costes.mjs
//
// Lee `por-test.tsv`, `sonda-consolidada.json` y `tiempos.tsv` (los tres de esta carpeta).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const leerTsv = (f) => {
  const [cab, ...l] = fs.readFileSync(path.join(AQUI, f), 'utf8').split('\n').filter(Boolean);
  const c = cab.split('\t');
  return l.map((x) => Object.fromEntries(x.split('\t').map((v, i) => [c[i], v])));
};
const filas = leerTsv('por-test.tsv');
const ms = new Map(leerTsv('tiempos.tsv').map((f) => [f.test, Number(f.ms)]));
const sonda = JSON.parse(fs.readFileSync(path.join(AQUI, 'sonda-consolidada.json'), 'utf8'));
console.log(`POBLACION: ${filas.length} tests en la tabla · ${ms.size} con tiempo medido · ${Object.keys(sonda).length} en el consolidado`);

const seg = (lista) => (lista.reduce((s, f) => s + (ms.get(f.test) || 0), 0) / 1000).toFixed(0);
const sinTiempo = (lista) => lista.filter((f) => !ms.has(f.test)).length;
const ciegos = filas.filter((f) => Number(f.ficheros_ciegos) > 0);
const noSe = filas.filter((f) => f.cubo === 'NO_SE');
const raiz = ciegos.filter((f) => f.lista_raiz === 'si');
console.log('\n── tiempos bajo la sonda (suma de procesos, no reloj)');
console.log(`   los ${filas.length} tests: ${seg(filas)} s (sin tiempo: ${sinTiempo(filas)})`);
console.log(`   los ${noSe.length} que la herramienta mete SIEMPRE hoy: ${seg(noSe)} s`);
console.log(`   los ${ciegos.length} de la poblacion ①: ${seg(ciegos)} s (sin tiempo: ${sinTiempo(ciegos)})`);
console.log(`   los ${raiz.length} que listan la raiz: ${seg(raiz)} s · ${raiz.map((f) => `${f.test.replace(/^tests\//, '').replace(/-.*/, '')} ${((ms.get(f.test) || 0) / 1000).toFixed(1)} s`).join(' · ')}`);

console.log('\n── lo que la sonda NO pudo ver, por si la herramienta ya lo mete siempre');
const partir = (etiqueta, lista) => {
  const dentro = lista.filter((f) => f.cubo === 'NO_SE').length;
  const enUno = lista.filter((f) => Number(f.ficheros_ciegos) > 0).length;
  console.log(`   ${etiqueta}: ${lista.length} · en NO_SE ${dentro} · ya en ① ${enUno} · ni lo uno ni lo otro ${lista.length - dentro - enUno}`);
};
partir('todo saltado (gateados: no corrieron)', filas.filter((f) => f.estado === 'TODO-SALTADO'));
partir('cortados por el techo', filas.filter((f) => f.estado === 'COLGADO'));
partir('con algun rojo bajo la sonda', filas.filter((f) => f.estado === 'CON-ROJO'));
partir('lanzan algun proceso node (el hijo puede no llevar sonda)', filas.filter((f) => sonda[f.test] && sonda[f.test].lanzaNode > 0));
partir('enumeran con git en ejecucion', filas.filter((f) => f.git_enumera));
console.log('\nEXIT=0');
