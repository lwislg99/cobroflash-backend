#!/usr/bin/env node
// SCRUM-1505 · UN CONTROL DE CERO QUE SÍ DA CERO, derivado contra el repositorio y no elegido.
//
//   node docs/master/evidencias/scrum1505/control-de-cero.mjs [<sha o ref>]
//
// POR QUÉ. El control que se repartía en las fichas era un número fijo, «el que suena improbable».
// Medido el 8-oct-2026: lo nombra el cuerpo de un commit de `main`. Un número FIJO escrito en una
// ficha acaba en un commit, en un registro o en un test, y desde ese momento ya no da cero.
//
// QUÉ HACE. Lee TODOS los números de ticket que el repositorio contiene hoy, en tres sitios:
//   · los mensajes ENTEROS (asunto y cuerpo) de los commits de todas las refs,
//   · los nombres de todas las refs,
//   · el contenido del árbol del ref pedido.
// Y da el mayor más uno. Ese número no puede estar: es mayor que todos. Y tampoco puede casar como
// SUBCADENA de otro (`--grep` y `grep -F` casan subcadenas): un número que lo contuviera como prefijo
// tendría más cifras, o sea, sería mayor que el máximo. Después lo COMPRUEBA con las mismas tres
// búsquedas (tiene que dar 0 en las tres) y comprueba que esas búsquedas VEN algo, con el máximo, que
// existe por construcción (tiene que dar más de 0 en alguna).
//
// CÓMO SE USA. Se corre y se usa el número que imprime, EN EL MOMENTO. No se copia a una ficha, a un
// registro ni a un mensaje de commit: en cuanto se escribe en el repositorio, deja de ser un cero. En
// una ficha se escribe el COMANDO, no el número. Sale 0 si el control vale, 1 si no, 2 si no pudo mirar.
//
// LO QUE NO MIRA: Jira (un ticket puede existir con ese número sin que el repositorio lo nombre: para
// buscar en Jira no vale), ni los logs de CI de otras ramas. `git grep -I` se salta los binarios.
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const ciego = (m) => { console.log(`CIEGO\t${m}\nEXIT=2`); process.exit(2); };
/** stdout si git respondió; con `vale1`, salida 1 es «nada» (grep sin coincidencias). */
function git(args, { vale1 = false } = {}) {
  const r = spawnSync('git', ['-C', RAIZ, ...args], { encoding: 'utf8', maxBuffer: 1 << 30 });
  if (r.status === 0) return r.stdout;
  if (vale1 && r.status === 1) return '';
  return ciego(`git ${args.slice(0, 3).join(' ')} … salió ${r.status}: ${String(r.stderr).split('\n')[0]}`);
}
const sha = git(['rev-parse', '--verify', `${process.argv[2] || 'origin/main'}^{commit}`]).trim();
const numeros = (t) => [...String(t).matchAll(/SCRUM-0*(\d+)/gi)].map((m) => Number(m[1])).filter(Number.isSafeInteger);

const fuentes = {
  mensajes: git(['log', '--all', '--format=%B']),
  refs: git(['for-each-ref', '--format=%(refname)']),
  arbol: git(['grep', '-I', '-h', '-o', '-i', '-E', 'SCRUM-[0-9]+', sha], { vale1: true }),
};
const vistos = Object.fromEntries(Object.entries(fuentes).map(([k, t]) => [k, numeros(t)]));
const total = Object.values(vistos).reduce((a, v) => a + v.length, 0);
console.log(`POBLACION\tref=${sha}\tmenciones: mensajes=${vistos.mensajes.length} refs=${vistos.refs.length} arbol=${vistos.arbol.length}`);
for (const [k, v] of Object.entries(vistos)) if (v.length === 0) ciego(`la fuente «${k}» no dio ningún número de ticket: no es creíble`);
const maximo = Math.max(...Object.values(vistos).flat());
const cero = maximo + 1;

/** Las mismas tres búsquedas, para un número: cuántas veces lo ven. */
function buscar(n) {
  const aguja = `SCRUM-${n}`;
  return {
    mensajes: git(['log', '--all', '-i', '-F', `--grep=${aguja}`, '--format=%h']).split('\n').filter(Boolean).length,
    refs: fuentes.refs.split('\n').filter((r) => r.toUpperCase().includes(aguja)).length,
    arbol: git(['grep', '-I', '-l', '-i', '-F', aguja, sha], { vale1: true }).split('\n').filter(Boolean).length,
  };
}
const suma = (o) => o.mensajes + o.refs + o.arbol;
const delMaximo = buscar(maximo);
const delCero = buscar(cero);
console.log(`POSITIVO\tel máximo que el repositorio nombra (SCRUM-${maximo})\tmensajes=${delMaximo.mensajes}\trefs=${delMaximo.refs}\tficheros=${delMaximo.arbol}\t${suma(delMaximo) > 0 ? 'OK: las búsquedas ven' : 'FALLA: las búsquedas no ven lo que existe'}`);
console.log(`CERO\tel máximo más uno\tmensajes=${delCero.mensajes}\trefs=${delCero.refs}\tficheros=${delCero.arbol}\t${suma(delCero) === 0 ? 'OK: da cero' : 'FALLA: no da cero'}`);
const vale = suma(delMaximo) > 0 && suma(delCero) === 0;
if (vale) {
  console.log(`\nCONTROL DE CERO DE AHORA: SCRUM-${cero}`);
  console.log('Úsalo en esta orden y no lo escribas en ningún fichero ni mensaje: escrito, deja de dar cero.');
} else console.log('\nNO HAY CONTROL: no uses ningún número hasta saber por qué.');
console.log(`EXIT=${vale ? 0 : 1}`);
process.exit(vale ? 0 : 1);
