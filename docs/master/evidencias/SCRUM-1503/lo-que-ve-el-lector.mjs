// docs/master/evidencias/SCRUM-1503/lo-que-ve-el-lector.mjs — SCRUM-1503
//
// Qué VE la herramienta de cada test, sacado de su propio análisis (`analizarArbol`, sin copiarlo):
// los ficheros que le atribuye, los directorios que cree que lista y sus «no sé».
//
//     node docs/master/evidencias/SCRUM-1503/lo-que-ve-el-lector.mjs <tocado> <test> [<test> …]
//
// Sólo LEE. La primera línea es la POBLACIÓN y la última el EXIT.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analizarArbol, razonDe, motivosParaNoFiarse } from '../../../../scripts/_tests-que-cubren.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const [tocado, ...pedidos] = process.argv.slice(2);
if (!tocado || !pedidos.length) {
  console.error('uso: lo-que-ve-el-lector.mjs <fichero tocado> <tests/…test.mjs> …');
  process.exit(2);
}

const arbol = analizarArbol(RAIZ);
const motivos = motivosParaNoFiarse(arbol);
console.log(`POBLACION: ${arbol.porTest.size} tests analizados · ${arbol.enDisco} en disco · motivos para no fiarse: ${motivos.length}`);
console.log(`TOCADO: ${tocado}`);

let faltan = 0;
for (const t of pedidos) {
  const d = arbol.porTest.get(t);
  console.log(`\n== ${t}`);
  if (!d) { console.log('   NO ESTA en la poblacion analizada'); faltan += 1; continue; }
  const r = razonDe(d, tocado);
  console.log(`   ficheros atribuidos: ${d.ficheros.size} · nombres sueltos: ${d.nombres.size} · directorios listados: ${d.listados.size} · no-se: ${d.noSe.length}`);
  console.log(`   listados: ${[...d.listados].sort().join(' | ') || '(ninguno)'}`);
  for (const n of d.noSe.slice(0, 6)) console.log(`   no-se: ${n.fichero}:${n.linea} ${n.que}`);
  console.log(`   razon para «${tocado}»: ${r ? `${r.cubo} · ${r.por}` : 'NINGUNA (no entra)'}`);
}
console.log(`\nEXIT=${faltan ? 2 : 0}`);
process.exit(faltan ? 2 : 0);
