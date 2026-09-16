// tests/scrum351-diagnostico-dependencias.test.mjs — SCRUM-351
//
// ¿ESTE ÁRBOL TIENE LAS DEPENDENCIAS AL DÍA? — con control positivo Y negativo.
//
// ── POR QUÉ ESTE FICHERO EXISTE Y NO BASTA CON MIRAR EL INFORME ────────────────────────────
// La pasada de hoy dio **0 desfasados**. Un cero es exactamente el número que no se puede creer
// sin control: «ninguno está desfasado» y «mi comparador no distingue» salen por la misma línea.
// Así que aquí se le dan al script árboles SINTÉTICOS donde la respuesta se conoce de antemano:
// uno completo, uno al que le falta un paquete, uno con la versión cambiada y uno ilegible.
//
// 🔴 Y EL CASO QUE ME MORDIÓ A MÍ, que es el que más vale: un árbol con `node_modules` PROPIO Y
// VACÍO dentro de un padre completo. Mi primera versión lo daba por DESFASADO con «faltan 25 de
// 25» —un número absurdo que delataba al instrumento, no al árbol— porque se paraba en el
// `node_modules` más cercano. **Node no se para**: resuelve POR PAQUETE y sigue subiendo. Aquella
// versión habría mandado a alguien a reinstalar cinco árboles que funcionan.
//
// ⚠️ TODO lo de aquí ocurre en directorios TEMPORALES creados por el propio test. No se toca
// ningún worktree, ni el propio: el script es de lectura y el test también.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { diagnosticarArbol, versionResuelta, arbolesAMirar } from '../scripts/diagnostico-dependencias.mjs';

/** Un árbol de mentira: `package.json` + `package-lock.json` + lo que se le quiera instalar. */
function arbolFalso({ pide, instala, sinLock = false, nodeModules = true }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-351-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    name: 'falso', dependencies: Object.fromEntries(Object.keys(pide).map((k) => [k, '^1.0.0'])),
  }));
  if (!sinLock) {
    fs.writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify({
      packages: Object.fromEntries(Object.entries(pide).map(([k, v]) => [`node_modules/${k}`, { version: v }])),
    }));
  }
  if (nodeModules) fs.mkdirSync(path.join(dir, 'node_modules'), { recursive: true });
  for (const [nombre, version] of Object.entries(instala || {})) {
    const d = path.join(dir, 'node_modules', nombre);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify({ name: nombre, version }));
  }
  return dir;
}

const creados = [];
const nuevo = (spec) => { const d = arbolFalso(spec); creados.push(d); return d; };
const veredicto = (raiz) => diagnosticarArbol({ raiz, origen: 'test' });
test.after(() => { for (const d of creados) fs.rmSync(d, { recursive: true, force: true }); });

// ── EL CONTROL POSITIVO Y EL NEGATIVO, que van juntos a propósito ─────────────────────────

test('SCRUM-351 · ✅ AL DÍA: todo lo que el lock pide, instalado y en su versión', () => {
  const raiz = nuevo({ pide: { alfa: '1.2.3', beta: '4.5.6' }, instala: { alfa: '1.2.3', beta: '4.5.6' } });
  const v = veredicto(raiz);
  assert.equal(v.veredicto, 'al dia', `🔴 dijo «${v.veredicto}» de un árbol completo: ${JSON.stringify(v)}`);
  assert.equal(v.miradas, 2, '🔴 no ha mirado las dos dependencias del lock');
});

test('SCRUM-351 · 🔴 DESFASADO por AUSENCIA — el caso `fake-indexeddb` que costó cinco rojos', () => {
  // Éste es el defecto de verdad: el árbol está al día de CÓDIGO y le falta un paquete. No aparece
  // en ningún diff, así que nadie sospecha — y los rojos parecen del producto.
  const raiz = nuevo({ pide: { alfa: '1.2.3', beta: '4.5.6' }, instala: { alfa: '1.2.3' } });
  const v = veredicto(raiz);
  assert.equal(v.veredicto, 'desfasado', '🔴 un árbol al que le falta un paquete NO está al día');
  assert.deepEqual(v.faltan, ['beta'], '🔴 el informe tiene que NOMBRAR lo que falta, no decir «hay desfase»');
});

test('SCRUM-351 · 🔴 DESFASADO por VERSIÓN — lo que la presencia sola no ve', () => {
  const raiz = nuevo({ pide: { alfa: '1.2.3' }, instala: { alfa: '0.9.0' } });
  const v = veredicto(raiz);
  assert.equal(v.veredicto, 'desfasado',
    '🔴 el paquete está pero es otro. Con un solo instrumento —«¿existe la carpeta?»— esto pasa por '
    + 'al día, y por eso hacen falta DOS.');
  assert.deepEqual(v.distintas, [{ nombre: 'alfa', tengo: '0.9.0', pide: '1.2.3' }]);
});

// ── «NO SUPE MIRAR» ES UNA FILA DEL INFORME, NO UN VERDE ──────────────────────────────────

test('SCRUM-351 · ⚠️ sin lock, el veredicto es NO LEGIBLE — nunca «al día»', () => {
  const raiz = nuevo({ pide: { alfa: '1.0.0' }, instala: { alfa: '1.0.0' }, sinLock: true });
  const v = veredicto(raiz);
  assert.equal(v.veredicto, 'no legible',
    '🔴 sin `package-lock.json` no hay contra qué comparar. «No se puede mirar» y «está al día» son '
    + 'el mismo verde con significados opuestos, y el informe tiene que distinguirlos.');
  assert.match(v.motivo, /package-lock/);
});

test('SCRUM-351 · · sin `node_modules` en ningún ancestro: SIN DEPENDENCIAS, y se dice', () => {
  const raiz = nuevo({ pide: { alfa: '1.0.0' }, instala: {}, nodeModules: false });
  const v = veredicto(raiz);
  assert.equal(v.veredicto, 'sin dependencias',
    '🔴 un árbol sin dependencias no está «desfasado»: no tiene nada que comparar, y confundir los '
    + 'dos casos manda a alguien a buscar un desfase que no existe.');
});

// ── 🔴 LA REGRESIÓN QUE YO MISMA INTRODUJE ────────────────────────────────────────────────

test('SCRUM-351 · 🔴 un `node_modules` propio VACÍO no convierte al árbol en desfasado', () => {
  // Node resuelve POR PAQUETE y sigue subiendo: una carpeta vacía no impide encontrarlo arriba.
  // Mi primera versión se paraba en la más cercana y daba «faltan 25 de 25» en cinco árboles sanos.
  const padre = nuevo({ pide: { alfa: '1.2.3' }, instala: { alfa: '1.2.3' } });
  const hijo = path.join(padre, 'hijo');
  fs.mkdirSync(path.join(hijo, 'node_modules'), { recursive: true }); // propio Y VACÍO
  fs.copyFileSync(path.join(padre, 'package.json'), path.join(hijo, 'package.json'));
  fs.copyFileSync(path.join(padre, 'package-lock.json'), path.join(hijo, 'package-lock.json'));

  assert.equal(versionResuelta(hijo, 'alfa').version, '1.2.3',
    '🔴 la resolución ha dejado de subir por los ancestros: vuelve el falso positivo que mandaba a '
    + 'reinstalar árboles que funcionan.');
  assert.equal(veredicto(hijo).veredicto, 'al dia');
});

// ── EL SUELO DEL CENSO DE ÁRBOLES ─────────────────────────────────────────────────────────

test('SCRUM-351 · SUELO: el censo ve árboles, y se ve a sí mismo', () => {
  const arboles = arbolesAMirar();
  assert.ok(arboles.length >= 1,
    '🔴 cero árboles es imposible: el árbol donde corre este test ya es uno. Sería un fallo de '
    + 'lectura contado como «no hay nada que mirar».');
  const aqui = path.resolve(import.meta.dirname, '..');
  assert.ok(arboles.some((a) => path.resolve(a.raiz) === aqui),
    `🔴 el censo no se ve a sí mismo (${aqui}): si no encuentra el árbol donde corre, su lista no es de fiar`);
});
