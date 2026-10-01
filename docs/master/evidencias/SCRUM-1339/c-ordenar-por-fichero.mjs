#!/usr/bin/env node
// SCRUM-1339c · el discriminador de c.17938: los casos `pass ↔ ausente` que denuncia el trinquete
// de zona, ¿son CONTIGUOS en orden de FICHERO o están SALPICADOS?
//
// Desde la raíz del repo (carga `acorn` de su node_modules):
//   node docs/master/evidencias/SCRUM-1339/c-ordenar-por-fichero.mjs <log> <ruta del test en el log> <fuente del test>
//   node docs/master/evidencias/SCRUM-1339/c-ordenar-por-fichero.mjs --autocontrol
//
// <log> es la salida de `gh run view <run> --job <id del job de zona> --log`, tal cual o ya pelada
// (los dos recortes de este ticket: `c-zona-2072.txt` y `c-zona-2071.txt`).
// SÓLO LEE: un log ya bajado y el fuente de un test. No ejecuta el test ni toca el árbol.
//
// ⚠️ EL FUENTE TIENE QUE SER EL DEL ÁRBOL QUE EL JOB PROBÓ, no el de `main` de hoy: si el fichero
// ha cambiado entre medias, las posiciones son de otro fichero. Se comprueba con el blob
// (`git rev-parse <sha>:<ruta>` en la cabeza y en la base de la línea «Merge X into Y» del log).
//
// QUÉ LEE DEL LOG, y son DOS listas distintas que el trinquete imprime por separado:
//   · «CAMBIAN DE VEREDICTO EN EL ÁRBOL» → las que la REPESCA (el fichero A SOLAS) confirmó.
//   · «NO CONFIRMADAS a solas»           → cambiaron en la pasada ENTERA y no a solas.
// La unión de las dos es lo que cambió en la pasada entera.
//
// ⚠️ LO QUE NO VE, declarado:
//   · el SENTIDO de la repesca (en qué zona faltó a solas): el trinquete no lo imprime. Las líneas
//     «Kiritimati → pass · Midway → ausente» son de la pasada ENTERA.
//   · el sentido de las NO confirmadas en la pasada entera: tampoco se imprime.
//   · nombres construidos en un bucle o por una variable: sólo censa `test('literal', …)`. Si el
//     fichero los tuviera, saldrían como nombres del log SIN posición, y eso ABORTA (no se calla).
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const acorn = require('acorn');

/** Los nombres que el fichero declara, en orden de FUENTE. Sólo llamadas `test(...)`/`it(...)` y sus `.skip/.todo/.only`. */
export function declaradosEnOrden(fuente) {
  const ast = acorn.parse(fuente, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const out = [];
  const noLiterales = [];
  const esTest = (callee) => {
    if (callee.type === 'Identifier') return ['test', 'it'].includes(callee.name);
    if (callee.type === 'MemberExpression' && callee.object.type === 'Identifier') {
      return ['test', 'it'].includes(callee.object.name)
        && ['skip', 'todo', 'only'].includes(callee.property.name);
    }
    return false;
  };
  const visitar = (nodo, hondura) => {
    if (!nodo || typeof nodo.type !== 'string') return;
    if (nodo.type === 'CallExpression' && esTest(nodo.callee)) {
      const a = nodo.arguments[0];
      let nombre = null;
      if (a && a.type === 'Literal' && typeof a.value === 'string') nombre = a.value;
      else if (a && a.type === 'TemplateLiteral' && a.expressions.length === 0) nombre = a.quasis[0].value.cooked;
      if (nombre === null) noLiterales.push(nodo.loc.start.line);
      else out.push({ nombre, linea: nodo.loc.start.line, hondura });
      hondura += 1;
    }
    for (const k of Object.keys(nodo)) {
      const v = nodo[k];
      if (Array.isArray(v)) for (const x of v) visitar(x, hondura);
      else if (v && typeof v.type === 'string') visitar(v, hondura);
    }
  };
  visitar(ast, 0);
  out.sort((a, b) => a.linea - b.linea);
  return { declarados: out, noLiterales };
}

/**
 * Las líneas de un log de `gh run view --job --log`, peladas: sin las dos columnas de job y paso,
 * sin la marca de hora y sin color. Un log ya pelado pasa igual.
 */
export function lineasDelLog(texto) {
  const ESC = String.fromCharCode(27);
  const color = new RegExp(`${ESC}\\[[0-9;]*m`, 'g');
  return texto.split(/\r?\n/).map((l) => l
    .replace(/^[^\t]*\t[^\t]*\t/, '')
    .replace(/^﻿/, '')
    .replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z /, '')
    .replace(color, ''));
}

/** Del log: las confirmadas y las no confirmadas de UN fichero. */
export function leerLog(texto, rutaTest) {
  const lineas = lineasDelLog(texto);
  const confirmadas = [];
  const noConfirmadas = [];
  let sentidos = new Set();
  for (let i = 0; i < lineas.length; i++) {
    const m = /^ {3}(?:🔴 NUEVA|·) (.*)$/u.exec(lineas[i]);
    if (m && (lineas[i + 1] || '').trim() === rutaTest) {
      confirmadas.push(m[1]);
      sentidos.add((lineas[i + 2] || '').trim());
    }
    const prefijo = `   · ${rutaTest}::`;
    if (lineas[i].startsWith(prefijo)) noConfirmadas.push(lineas[i].slice(prefijo.length));
  }
  const repesca = lineas.find((l) => l.includes(path.basename(rutaTest)) && / confirma \d+ de \d+/.test(l));
  return { confirmadas, noConfirmadas, sentidos: [...sentidos], repesca: repesca ? repesca.trim() : null };
}

/** Tramos seguidos de posiciones (1-based). */
export function tramos(posiciones) {
  const p = [...posiciones].sort((a, b) => a - b);
  const out = [];
  for (const x of p) {
    const u = out[out.length - 1];
    if (u && x === u[1] + 1) u[1] = x; else out.push([x, x]);
  }
  return out;
}

/** El veredicto de forma de un conjunto de posiciones sobre un fichero de `total` casos. */
export function forma(posiciones, total) {
  const t = tramos(posiciones);
  if (!t.length) return 'VACÍO';
  if (t.length > 1) return `SALPICADOS (${t.length} tramos)`;
  return t[0][1] === total ? 'CONTIGUOS, y hasta el FINAL (cola)' : 'CONTIGUOS, pero NO llegan al final (bloque en medio)';
}

// 🔴 SÓLO SI ES EL PRINCIPAL. `presentes-en-el-obligatorio.mjs` importa el censo de aquí, y sin esta
// puerta el import ejecutaba la línea de órdenes de ESTE fichero: imprimía «uso:» y salía 2 antes
// de que el otro midiera nada (pasó en la primera pasada, 1-oct-2026).
const ES_PRINCIPAL = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (ES_PRINCIPAL && process.argv[2] === '--autocontrol') {
  // Controles del instrumento, con entradas FABRICADAS: tiene que saber decir las tres formas.
  const casos = [
    [[5, 6, 7, 8], 8, 'CONTIGUOS, y hasta el FINAL (cola)'],
    [[3, 4, 5], 8, 'CONTIGUOS, pero NO llegan al final (bloque en medio)'],
    [[2, 5, 6, 8], 8, 'SALPICADOS (3 tramos)'],
    [[], 8, 'VACÍO'],
  ];
  let mal = 0;
  for (const [p, n, esperado] of casos) {
    const dicho = forma(p, n);
    console.log(`${dicho === esperado ? '✔' : '🔴'} [${p.join(',')}] de ${n} → ${dicho}`);
    if (dicho !== esperado) mal += 1;
  }
  const d = declaradosEnOrden("import test from 'node:test';\ntest('a', () => {});\nfor (const x of [1]) test(`b ${x}`, () => {});\ntest.skip(`c`, () => {});\n");
  const okAst = d.declarados.map((x) => x.nombre).join('|') === 'a|c' && d.noLiterales.length === 1;
  console.log(`${okAst ? '✔' : '🔴'} censo AST: 2 literales en orden y 1 nombre construido DENUNCIADO (línea ${d.noLiterales.join(',')})`);
  console.log(`AUTOCONTROL · ${casos.length + 1} casos · ${mal + (okAst ? 0 : 1)} mal`);
  process.exit(mal || !okAst ? 1 : 0);
}

if (ES_PRINCIPAL) principal();

function principal() {
const [, , rutaLog, rutaTest, rutaFuente] = process.argv;
if (!rutaLog || !rutaTest || !rutaFuente) {
  console.error('uso: node c-ordenar-por-fichero.mjs <log> <ruta del test en el log> <fuente del test>');
  process.exit(2);
}
const { declarados, noLiterales } = declaradosEnOrden(fs.readFileSync(rutaFuente, 'utf8'));
const log = leerLog(fs.readFileSync(rutaLog, 'utf8'), rutaTest);
const total = declarados.length;

console.log(`POBLACIÓN · ${rutaTest}: ${total} casos con nombre literal · ${noLiterales.length} con nombre construido`
  + ` · anidados: ${declarados.filter((d) => d.hondura > 0).length}`);
console.log(`LOG · ${log.repesca || '(sin línea de repesca para este fichero)'}`);
console.log(`LOG · confirmadas a solas: ${log.confirmadas.length} · no confirmadas: ${log.noConfirmadas.length}`
  + ` · sentido impreso (pasada entera): ${log.sentidos.join(' || ') || '(ninguno)'}`);

const posDe = new Map();
const repetidos = [];
declarados.forEach((d, i) => { if (posDe.has(d.nombre)) repetidos.push(d.nombre); posDe.set(d.nombre, i + 1); });
const sinPosicion = [...log.confirmadas, ...log.noConfirmadas].filter((n) => !posDe.has(n));
if (repetidos.length || sinPosicion.length || !total || !(log.confirmadas.length + log.noConfirmadas.length)) {
  console.error(`🔴 CIEGO · nombres repetidos en el fichero: ${repetidos.length} · nombres del log sin posición: ${sinPosicion.length}`
    + ` · declarados: ${total} · leídos del log: ${log.confirmadas.length + log.noConfirmadas.length}`);
  for (const n of sinPosicion) console.error(`     sin posición: ${n}`);
  process.exit(2);
}

const conf = new Set(log.confirmadas.map((n) => posDe.get(n)));
const noConf = new Set(log.noConfirmadas.map((n) => posDe.get(n)));
console.log('\npos  línea  estado            nombre');
declarados.forEach((d, i) => {
  const p = i + 1;
  const estado = conf.has(p) ? 'AUSENTE·confirma ' : noConf.has(p) ? 'AUSENTE·no-conf. ' : 'presente         ';
  console.log(`${String(p).padStart(3)}  ${String(d.linea).padStart(5)}  ${estado} ${d.nombre}`);
});

const fmt = (s) => tramos(s).map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(', ') || '(ninguna)';
const entera = new Set([...conf, ...noConf]);
// 🔴 LO QUE EL TRINQUETE IMPRIME COMO «CONFIRMADAS» ES UNA INTERSECCIÓN: las que cambiaron en la
// pasada entera Y TAMBIÉN a solas. Las que cambiaron SÓLO a solas no se imprimen en ningún sitio;
// lo único que las delata es la cifra «confirma N de M» cuando N no cabe en la intersección.
const m = /confirma (\d+) de (\d+)/.exec(log.repesca || '');
const aSolas = m ? Number(m[1]) : null;
console.log(`\nPASADA ENTERA   · cambiaron ${entera.size} de ${total} · posiciones ${fmt(entera)} → ${forma(entera, total)}`);
console.log(`ENTERA Y A SOLAS · ${conf.size} · posiciones ${fmt(conf)} → ${forma(conf, total)}`);
console.log(`SÓLO EN LA ENTERA · ${noConf.size} · posiciones ${fmt(noConf)} → ${forma(noConf, total)}`);
if (aSolas === null) console.log('A SOLAS         · (el log no trae la línea de repesca de este fichero)');
else if (aSolas === conf.size) console.log(`A SOLAS         · cambiaron ${aSolas}, y son exactamente las ${conf.size} de arriba`);
else console.log(`A SOLAS         · cambiaron ${aSolas}, y el log sólo nombra ${conf.size}: ${aSolas - conf.size} NO SE PUEDEN SITUAR (el trinquete no las imprime)`);
console.log('EXIT=0');
}
