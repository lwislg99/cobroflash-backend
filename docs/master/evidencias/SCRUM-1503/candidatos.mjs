// docs/master/evidencias/SCRUM-1503/candidatos.mjs — SCRUM-1503
//
// Parte los tests en tres montones ANTES de ejecutarlos con la sonda, para no correr la suite
// entera en una máquina corta de memoria:
//
//   · SIEMPRE    — la herramienta ya los mete en toda dirigida (cubo NO_SE): no pueden «quedarse fuera».
//   · CANDIDATO  — no están en NO_SE y en su cierre (el test y los módulos de tests/ y scripts/ que
//                  la herramienta le atribuye) aparece ALGUNA primitiva que enumera: se EJECUTAN.
//   · SIN-PRIMITIVA — ni una cosa ni otra. De éstos se ejecuta una MUESTRA como control a cero:
//                  si alguno lista un directorio del repositorio, este filtro no vale.
//
// El filtro es de TEXTO y a propósito ancho: decide qué se ejecuta, no qué se cuenta. Lo que se
// cuenta sale de la ejecución (`sonda-lanzar.mjs`).
//
//     node docs/master/evidencias/SCRUM-1503/candidatos.mjs <fichero de salida .json>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analizarArbol, motivosParaNoFiarse } from '../../../../scripts/_tests-que-cubren.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const destino = process.argv[2];
if (!destino) { console.error('uso: candidatos.mjs <salida.json>'); process.exit(2); }

export const PRIMITIVA = /readdir|opendir|\bglob|ls-files|ls-tree|git grep|'grep'|child_process|\bwalk/;

const arbol = analizarArbol(RAIZ);
const motivos = motivosParaNoFiarse(arbol);
const textoDe = new Map();
const leer = (rel) => {
  if (!textoDe.has(rel)) {
    let t = '';
    try { t = fs.readFileSync(path.join(RAIZ, rel), 'utf8'); } catch { t = ''; }
    textoDe.set(rel, t);
  }
  return textoDe.get(rel);
};

const montones = { SIEMPRE: [], CANDIDATO: [], 'SIN-PRIMITIVA': [] };
for (const t of arbol.tests) {
  const d = arbol.porTest.get(t);
  if (d.noSe.length) { montones.SIEMPRE.push(t); continue; }
  const cierre = [...d.ficheros].filter((f) => /^(tests|scripts)\/.*\.(mjs|js|cjs)$/.test(f));
  const toca = cierre.some((f) => PRIMITIVA.test(leer(f)));
  montones[toca ? 'CANDIDATO' : 'SIN-PRIMITIVA'].push(t);
}
const suma = montones.SIEMPRE.length + montones.CANDIDATO.length + montones['SIN-PRIMITIVA'].length;
fs.writeFileSync(destino, JSON.stringify(montones, null, 1));
console.log(`POBLACION: ${arbol.tests.length} tests · motivos para no fiarse del analisis: ${motivos.length}`);
console.log(`  SIEMPRE (NO_SE): ${montones.SIEMPRE.length}`);
console.log(`  CANDIDATO: ${montones.CANDIDATO.length}`);
console.log(`  SIN-PRIMITIVA: ${montones['SIN-PRIMITIVA'].length}`);
console.log(`  suma: ${suma} (tiene que ser ${arbol.tests.length})`);
const esta = (t) => Object.entries(montones).find(([, l]) => l.includes(t))?.[0] || 'EN NINGUNO';
console.log(`  control: scrum622 cae en ${esta('tests/scrum622-desconocido-no-es-verde.test.mjs')} · un nombre inventado cae en ${esta('tests/scrum99999-inventado.test.mjs')}`);
const salida = suma === arbol.tests.length && !motivos.length ? 0 : 2;
console.log(`EXIT=${salida}`);
process.exit(salida);
