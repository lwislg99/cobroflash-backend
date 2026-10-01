// docs/master/evidencias/scrum1344/aserciones.mjs — SCRUM-1344
//
// EL POSITIVO QUE PUEDE TUMBAR EL TICKET: ¿ha cambiado ALGUNA aserción en ALGÚN test?
//
//     node docs/master/evidencias/scrum1344/aserciones.mjs [<ref de base>]      (por defecto origin/main)
//
// No se contesta leyendo el diff. Para cada fichero de `tests/` que este árbol cambia respecto a la
// base (los ficheros NUEVOS no cuentan: no tenían aserciones que cambiar):
//
//   1. se le DESHACE el envoltorio —cada `reqDeSesion({ rol: '…', … })` vuelve a ser `{ … }`—;
//   2. se sacan por AST todas las llamadas a `assert` / `assert.x(…)` del fichero de la base y del
//      de ahora, con su texto entero, y las dos listas tienen que ser IDÉNTICAS y en el mismo orden;
//   3. se imprime lo que queda distinto en el fichero una vez deshecho el envoltorio: tiene que ser
//      solo la línea del import (y lo que se migró a mano, que sale aquí nombrado).
//
// Control positivo propio: se le cambia UNA aserción a la copia en memoria de un fichero y tiene
// que salir distinto. Un comparador que no sabe decir «distinto» no ha comparado nada.
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..', '..', '..');
const BASE = process.argv[2] || 'origin/main';
const git = (...a) => execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const IMPORT = " import { reqDeSesion } from './_arnes-de-router.mjs';";

const parsea = (nombre, fuente) => ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

/** Deshace el envoltorio: `reqDeSesion({ rol: 'admin', a, b })` → `{ a, b }`. */
function sinEnvoltorio(nombre, fuente) {
  const sf = parsea(nombre, fuente);
  const cortes = [];
  const visita = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'reqDeSesion'
      && n.arguments.length === 1 && ts.isObjectLiteralExpression(n.arguments[0])) {
      const obj = n.arguments[0];
      const rol = obj.properties[0];
      if (!rol || !ts.isPropertyAssignment(rol) || rol.name.getText() !== 'rol' || obj.properties.length < 2) {
        throw new Error(`${nombre}: un reqDeSesion que no empieza por \`rol:\` — no sé deshacerlo`);
      }
      // de `reqDeSesion({ rol: 'admin',` se queda `{`, y del `})` final se queda `}`
      cortes.push([n.getStart(), obj.getStart()], [obj.getStart() + 1, fuente.indexOf(',', rol.end) + 1], [obj.end, n.end]);
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  let s = fuente;
  for (const [a, b] of cortes.sort((x, y) => y[0] - x[0])) s = s.slice(0, a) + s.slice(b);
  return s.split(IMPORT).join('');
}

function aserciones(nombre, fuente) {
  const sf = parsea(nombre, fuente);
  if (sf.parseDiagnostics.length) throw new Error(`${nombre}: no se puede parsear — no se compara, se para`);
  const lista = [];
  const visita = (n) => {
    if (ts.isCallExpression(n) && /^assert($|\.)/.test(n.expression.getText())) lista.push(n.getText());
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return lista;
}

const cambiados = git('diff', '--name-status', BASE, '--', 'tests').split('\n').filter(Boolean).map((l) => l.split('\t'));
const modificados = cambiados.filter(([estado]) => estado === 'M').map(([, f]) => f);
const nuevos = cambiados.filter(([estado]) => estado === 'A').map(([, f]) => f);
const otros = cambiados.filter(([estado]) => estado !== 'M' && estado !== 'A');

console.log(`BASE=${BASE} (${git('rev-parse', BASE).trim()})`);
console.log(`POBLACION=${modificados.length} ficheros de tests/ modificados · ${nuevos.length} nuevos (no se comparan) · ${otros.length} borrados o renombrados`);
let distintos = 0;
let total = 0;
let control = null;
for (const f of modificados) {
  const antes = git('show', `${BASE}:${f}`);
  const ahora = sinEnvoltorio(f, fs.readFileSync(path.join(RAIZ, f), 'utf8'));
  const a = aserciones(f, antes);
  const b = aserciones(f, ahora);
  total += a.length;
  const iguales = a.length === b.length && a.every((x, i) => x === b[i]);
  if (!iguales) distintos++;
  const la = antes.split('\n');
  const lb = ahora.split('\n');
  const resto = la.length === lb.length ? la.map((x, i) => (x === lb[i] ? null : i + 1)).filter(Boolean) : ['(distinto número de líneas)'];
  console.log(`${iguales ? 'IGUALES ' : '🔴 DISTINTAS'} · ${f} · ${a.length} aserciones antes, ${b.length} ahora · líneas que siguen distintas tras deshacer el envoltorio: ${resto.length ? resto.join(', ') : 'ninguna'}`);
  if (control === null && a.length) {
    // CONTROL POSITIVO: la misma comparación con UNA aserción cambiada tiene que decir «distinto».
    const trucada = [...b];
    trucada[0] = trucada[0] + ' ';
    control = !(a.length === trucada.length && a.every((x, i) => x === trucada[i]));
  }
}
for (const [estado, f] of otros) console.log(`🔴 ${estado} · ${f} · un test borrado o renombrado se lleva sus aserciones`);
console.log(`CONTROL POSITIVO (una aserción cambiada sale distinta): ${control === true ? 'sí' : '🔴 NO'}`);
console.log(`RESULTADO: ${total} aserciones comparadas en ${modificados.length} ficheros · ${distintos} ficheros con alguna distinta`);
const fallo = distintos > 0 || otros.length > 0 || control !== true || modificados.length === 0;
console.log(`EXIT=${fallo ? 1 : 0}`);
process.exit(fallo ? 1 : 0);
