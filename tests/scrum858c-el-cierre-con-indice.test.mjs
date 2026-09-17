// SCRUM-858c · EL CIERRE DE PORTADORES VA POR ÍNDICE, Y ELIGE LA MISMA VÍA QUE EL RECORRIDO.
//
// Sin gate: árboles FABRICADOS en un temporal. Ni BD, ni red, ni el árbol real.
//
// EL DEFECTO (SCRUM-858): `tests/scrum601-copy-del-documento-vs-flag.test.mjs` tardaba 78 s en
// cargar (medido el 17-sep-2026 sobre main 45eb9b8a), y el 97 % era el punto fijo de
// `portadoresDelFlag`: por cada definición (29.965) recorría TODAS las claves portadoras (hasta
// 1.503), 7 vueltas, dos veces. 858c lo cambia por un índice «nombre final → claves».
//
// POR QUÉ ESTE FICHERO Y NO BASTA CON scrum601: medido, scrum601 SIGUE VERDE con los dos mutantes
// de abajo aplicados. Sus anclas son cuentas y rótulos, y un índice que elige OTRA vía con las
// mismas cuentas (1.503 portadores, 7 vueltas) no mueve ninguna. La equivalencia se comprobó por
// huella sha256 de todo lo devuelto (idéntica antes y después); lo que queda en git para que no se
// pierda son estos tres casos, cada uno el que distingue una forma concreta de equivocarse:
//
//   ① la vía es la clave de MENOR posición de inserción, no la del primer identificador que casa;
//   ② el índice ve las claves insertadas EN LA MISMA VUELTA (el recorrido del Map las veía);
//   ③ una clave local de OTRO fichero no cuenta, aunque se insertase antes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { temporal } from './_temporal.mjs';
import { portadoresDelFlag, SEMILLA_FLAG } from './_censo-copy-vs-flag.mjs';

/** Lo que el meta-guard de la casa EJECUTA contra este fichero. */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El índice que se queda con la PRIMERA clave que casa, sin comparar posiciones.
    fichero: 'tests/_censo-copy-vs-flag.mjs',
    de: 'if (posicion.get(clave) < mejor) { mejor = posicion.get(clave); via = clave; }',
    a: 'if (via === null) { mejor = posicion.get(clave); via = clave; }',
    cae: 'la vía es la clave de MENOR posición, no la del primer identificador que casa',
  },
  {
    // El índice que no se actualiza al insertar: la cadena A → B → C no se cierra nunca.
    fichero: 'tests/_censo-copy-vs-flag.mjs',
    de: 'if (lista) lista.push(clave); else porNombre.set(nombre, [clave]);',
    a: 'void lista;',
    cae: 'una cadena dentro de un fichero se cierra en la MISMA vuelta',
  },
];

/** Un árbol fabricado: `{ 'src/a.ts': '…' }` → raíz temporal. */
function arbol(ficheros) {
  const raiz = temporal('yaqu-858c-');
  for (const [rel, texto] of Object.entries(ficheros)) {
    const p = path.join(raiz, ...rel.split('/'));
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, texto);
  }
  return raiz;
}

const vias = (cierre) => Object.fromEntries([...cierre.portadores].map(([clave, v]) => [clave, v.via]));

test('una cadena dentro de un fichero se cierra en la MISMA vuelta', () => {
  // Con el índice congelado al empezar cada vuelta (mutante ② de la huella, medido: 16 vueltas en
  // vez de 7 sobre el árbol real) esto da 4 vueltas: B entra en la 2ª y C en la 3ª.
  const raiz = arbol({
    'src/a.ts': [
      'export const A = INVOICING_ES_ENABLED;',
      'export const B = A;',
      'export const C = B;',
    ].join('\n'),
  });
  const c = portadoresDelFlag(raiz, SEMILLA_FLAG);
  // POBLACIÓN, antes que el resultado: un árbol que no se leyó también da «sin portadores».
  assert.equal(c.ficheros, 1);
  assert.equal(c.definiciones, 3);
  assert.equal(c.vueltas, 2, 'vuelta 1 cierra A, B y C; la 2 no cambia nada');
  assert.deepEqual(vias(c), {
    'EXPORT::A': 'INVOICING_ES_ENABLED', 'src/a.ts::A': 'INVOICING_ES_ENABLED',
    'EXPORT::B': 'EXPORT::A', 'src/a.ts::B': 'EXPORT::A',
    'EXPORT::C': 'EXPORT::B', 'src/a.ts::C': 'EXPORT::B',
  });
});

test('la vía es la clave de MENOR posición, no la del primer identificador que casa', () => {
  // `R = Q + P`: el primer identificador es Q, pero P se insertó antes. El recorrido del Map
  // encontraba P primero, así que la vía es EXPORT::P.
  const raiz = arbol({
    'src/a.ts': [
      'export const P = INVOICING_ES_ENABLED;',
      'export const Q = INVOICING_ES_ENABLED;',
      'export const R = Q + P;',
    ].join('\n'),
  });
  const c = portadoresDelFlag(raiz, SEMILLA_FLAG);
  assert.equal(c.definiciones, 3);
  assert.equal(c.portadores.get('EXPORT::R')?.via, 'EXPORT::P');
  assert.equal(c.portadores.get('src/a.ts::R')?.via, 'EXPORT::P');
});

test('una clave local de otro fichero no es vía, aunque se insertase antes', () => {
  // `src/a.ts::Z` se inserta la PRIMERA y casa por nombre con W, pero no es visible desde b.ts.
  // Y el cuerpo de W tiene MÁS identificadores que nombres el índice: es la otra rama de la
  // búsqueda (se recorre el índice en vez de los identificadores), y tiene que dar lo mismo.
  const raiz = arbol({
    'src/a.ts': 'const Z = INVOICING_ES_ENABLED;',
    'src/b.ts': [
      'export const Y = INVOICING_ES_ENABLED;',
      'export const Z = INVOICING_ES_ENABLED;',
      'export const W = x1 + x2 + x3 + Z + Y;',
    ].join('\n'),
  });
  const c = portadoresDelFlag(raiz, SEMILLA_FLAG);
  assert.equal(c.ficheros, 2);
  assert.equal(c.definiciones, 4);
  assert.deepEqual([...c.portadores.keys()].slice(0, 1), ['src/a.ts::Z'], 'la local de a.ts entra la primera');
  assert.equal(c.portadores.get('EXPORT::W')?.via, 'EXPORT::Y');
});
