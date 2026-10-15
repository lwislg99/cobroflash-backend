// SCRUM-996d · LA A1 MIRA EL CLIENTE DE PRISMA; NO LO REGENERA A CIEGAS.
//
// Hasta el 15-oct-2026 la A1 de `docs/equipo/00-normas-comunes.md` abría con
// `./node_modules/.bin/prisma generate`, «cada tanda, antes de nada». El 14-oct se lanzó 9 veces
// (SCRUM-996c §5), una desde un árbol que cuelga del `node_modules` compartido y con la salida a
// `$null`. El 15-oct el orquestador regeneró el compartido con el equipo parado (trampas §10): un solo
// `generate` desde un árbol con otro `schema.prisma` lo deshace para todos, y obedeciendo la norma.
//
// Esto ata las dos mitades de la A1 nueva:
//   · su bloque de órdenes (las líneas sangradas antes del primer párrafo) NO lleva ningún `generate`;
//   · lleva el guard que MIRA (`_prisma-client-guard.mjs`), y la sección enlaza el procedimiento de §10.
//
// Población declarada: UNA sección (la A1) de un fichero, con su suelo: el bloque tiene ≥ 2 órdenes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NORMAS = 'docs/equipo/00-normas-comunes.md';
const { parsearSecciones, normalizar, ARRANQUE } = await import(
  pathToFileURL(path.join(RAIZ, 'scripts', 'equipo', 'norma.mjs')).href
);

// El rojo, declarado: lo ejecuta `npm run meta:mutaciones`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'docs/equipo/00-normas-comunes.md',
    de: '    git fetch origin && git rev-list --count HEAD..origin/main\n    node scripts/_prisma-client-guard.mjs',
    a: '    ./node_modules/.bin/prisma generate\n    git fetch origin && git rev-list --count HEAD..origin/main',
    cae: '🔴 SCRUM-996d · el bloque de órdenes de la A1 no regenera el cliente',
  },
  {
    fichero: 'docs/equipo/00-normas-comunes.md',
    de: '| escribir o tocar un guard, o un test que bloquea | A23 |\n',
    a: '',
    cae: '🔴 SCRUM-996d · cada sección que el arranque NO imprime tiene su «antes de…» en la tabla de la A1',
  },
];

/** Las órdenes de la sección: las líneas sangradas 4 espacios entre la cabecera y el primer párrafo. */
export function bloqueDeOrdenes(sec) {
  const ordenes = [];
  for (const linea of sec.lineas.slice(1)) {
    if (linea.trim() === '') { if (ordenes.length) break; continue; }
    if (!linea.startsWith('    ')) break;
    ordenes.push(linea.trim());
  }
  return ordenes;
}

function a1() {
  const texto = normalizar(fs.readFileSync(path.join(RAIZ, NORMAS)));
  const sec = parsearSecciones(texto).secciones.find((s) => s.id === 'A1');
  assert.ok(sec, `🔴 ${NORMAS} no tiene sección A1: NO PUDE MIRAR`);
  return sec;
}

test('🔴 SCRUM-996d · el bloque de órdenes de la A1 no regenera el cliente', () => {
  const ordenes = bloqueDeOrdenes(a1());
  assert.ok(ordenes.length >= 2, `🔴 suelo: la A1 debería abrir con ≥ 2 órdenes y veo ${ordenes.length}: NO PUDE MIRAR`);
  const regeneran = ordenes.filter((o) => /\bgenerate\b/.test(o));
  assert.deepEqual(regeneran, [],
    '🔴 la A1 vuelve a mandar regenerar el cliente de Prisma CADA TANDA. Desde un árbol que cuelga del '
    + 'compartido eso deshace la regeneración para todos (trampas-del-entorno.md §10). Se MIRA con el guard.');
  assert.ok(ordenes.some((o) => o.includes('scripts/_prisma-client-guard.mjs')),
    `🔴 la A1 ya no abre con el guard que mira el cliente. Órdenes: ${JSON.stringify(ordenes)}`);
});

test('SCRUM-996d · la A1 enlaza el procedimiento de §10 y conserva su porqué con la cifra', () => {
  const t = a1().texto.replace(/\s+/g, ' ');
  assert.match(t, /trampas-del-entorno\.md` §10/, 'la A1 tiene que enlazar el procedimiento de §10');
  assert.match(t, /\*\*9 veces\*\*/, 'sin la cifra del 14-oct, la norma se poda en la siguiente limpieza');
});

/** Los ids de la columna «traes» de la tabla de la A1 (filas `| … | A5 · A6 |`). */
export function idsDeLaTabla(sec) {
  const ids = new Set();
  for (const linea of sec.lineas) {
    const m = /^\|.*\|\s*((?:A\d+\s*·?\s*)+)\|\s*$/.exec(linea);
    if (m) for (const id of m[1].match(/A\d+/g)) ids.add(id);
  }
  return ids;
}

test('🔴 SCRUM-996d · cada sección que el arranque NO imprime tiene su «antes de…» en la tabla de la A1', () => {
  const texto = normalizar(fs.readFileSync(path.join(RAIZ, NORMAS)));
  const { secciones } = parsearSecciones(texto);
  const enArranque = new Set(ARRANQUE.map((a) => a.id));
  const fuera = secciones.map((s) => s.id).filter((id) => !enArranque.has(id));
  assert.ok(fuera.length >= 5, `🔴 suelo: veo ${fuera.length} secciones fuera del arranque y había 11: NO PUDE MIRAR`);
  const tabla = idsDeLaTabla(a1());
  const sinDisparador = fuera.filter((id) => !tabla.has(id));
  assert.deepEqual(sinDisparador, [],
    '🔴 estas secciones no se imprimen al arrancar y la tabla de la A1 no dice CUÁNDO traerlas: '
    + 'nadie las leerá. Añade su fila «antes de… | traes».');
  const sobran = [...tabla].filter((id) => !fuera.includes(id));
  assert.deepEqual(sobran, [], '🔴 la tabla de la A1 manda traer secciones que no existen o que ya imprime el arranque');
});

test('control positivo · bloqueDeOrdenes ve un generate cuando lo hay', () => {
  const sec = parsearSecciones('## A1 · x\n\n    ./node_modules/.bin/prisma generate\n    git fetch\n\ntexto\n').secciones[0];
  assert.deepEqual(bloqueDeOrdenes(sec), ['./node_modules/.bin/prisma generate', 'git fetch']);
});
