// tests/scrum843-el-ancla-que-no-caduca.test.mjs — SCRUM-843
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA VÍCTIMA: todas las sesiones a la vez. `guard:lista-trabajos` se declaraba CIEGO y ponía en
// rojo el job «guards de navegador» de CUALQUIER rama que no tocara la lista de Trabajos —
// medido el 9-sep-2026 en una que sólo cambiaba un fichero de `docs/`. Un tapón común.
//
// 🔴 LA CAUSA NO ERA UN FALLO DEL GUARD: era DE QUÉ DEPENDÍA SU CONTROL POSITIVO. Decía «la
// lista que este ticket cambia tiene que salir DISTINTA del punto de partida», y eso sólo es
// cierto en la rama de ese ticket y sólo mientras no se ha mergeado. Al entrar en `main`:
//   · sobre `main`, `merge-base(HEAD, origin/main)` ES HEAD → se comparaba main consigo mismo;
//   · sobre cualquier otra rama, la base ya trae el cambio dentro.
// O sea: un control positivo que CADUCA CON EL ÉXITO del trabajo que lo justificaba.
//
// ── LO QUE VIGILA ESTE FICHERO ────────────────────────────────────────────────────────────────
// Que no vuelva a entrar un ancla así. La regla, dicha en una línea:
//
//   🔒 Ningún «NO SUPE MIRAR» puede dispararse porque el árbol de HOY coincida con el de la BASE.
//
// «Coincidir con la base» es el estado NORMAL de casi todas las ramas y de `main` entero. Un
// instrumento que se declara ciego ante lo normal no está midiendo: está bloqueando.
//
// Esto NO sustituye al guard —el veredicto se mide en navegador, aquí no hay ninguno—: sustituye
// a la confianza en que nadie vuelva a atar la calibración a un diff contra git.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const GUARD = path.join(RAIZ, 'scripts', 'guard-lista-trabajos.mjs');

/**
 * El detector, aparte del árbol REAL para poder ejercerlo contra casos fabricados.
 *
 * Devuelve las condiciones que desembocan en un `nosupe(` y que mezclan una huella del árbol de
 * la BASE con una del árbol de HOY. Cada una de ésas es un ancla que caduca al mergear.
 */
export function anclasQueCaducan(codigo) {
  // De dónde sale cada variable: `const X = await huella(puertoMain, …)` o `(puerto, …)`.
  const deLaBase = new Set(
    [...codigo.matchAll(/(?:const|let)\s+(\w+)\s*=\s*await\s+huella\(\s*puertoMain\b/g)].map((m) => m[1]));
  const deHoy = new Set(
    [...codigo.matchAll(/(?:const|let)\s+(\w+)\s*=\s*await\s+huella\(\s*puerto\b(?!Main)/g)].map((m) => m[1]));
  if (!deLaBase.size || !deHoy.size) return { ciego: true, anclas: [] };

  // Las condiciones cuyo cuerpo empieza llamando a `nosupe(`.
  //
  // 🔴 La condición se acota con `[^{}]`, y costó un rojo aprenderlo: con `[\s\S]*?` el `if` de
  // una comparación LEGÍTIMA enganchaba con el `nosupe(` de otro bloque cien líneas más abajo, y
  // eso se leía como un ancla que no existía. Una condición no lleva llaves; el `{` de su bloque
  // es el punto fijo que impide saltar de un `if` al `nosupe` de otro.
  const condiciones = [...codigo.matchAll(/\bif\s*\(([^{}]*?)\)\s*\{\s*nosupe\(/g)].map((m) => m[1]);

  const mezcla = (cond, conjunto) =>
    [...conjunto].some((v) => new RegExp('\\b' + v + '\\b').test(cond));

  return {
    ciego: false,
    anclas: condiciones.filter((c) => mezcla(c, deLaBase) && mezcla(c, deHoy)),
  };
}

// ── EL CONTROL FABRICADO ─────────────────────────────────────────────────────────────────────
// 🔴 NO se prueba el detector contra el defecto real: el defecto está ARREGLADO, así que un
// detector roto y uno bueno darían el mismo verde. Se le da el código EXACTO que había el
// 9-sep-2026 —escrito aquí, no leído del árbol— y se le exige que lo cace. Si algún día alguien
// afloja el detector, esto cae aunque el guard esté impecable.
const COMO_ESTABA = `
    const tA = await huella(puertoMain, '/trabajos20');
    const tB = await huella(puerto, '/trabajos20');
    if (tA.sha === tB.sha) {
      nosupe('NO SUPE MIRAR: Trabajos sale IDENTICA a origin/main.');
    } else {
      di('control positivo');
    }
`;

test('SCRUM-843 · 🔴 CONTROL FABRICADO: el detector CAZA el ancla que teníamos', () => {
  const r = anclasQueCaducan(COMO_ESTABA);
  assert.equal(r.ciego, false,
    '🔴 CIEGO: el detector no ha sabido ni de dónde sale cada huella en un caso que SÍ las tiene. '
    + 'Si no sabe leer esto, su silencio sobre el guard real no significa nada.');
  assert.equal(r.anclas.length, 1,
    `🔴 el detector NO caza el ancla que de verdad tuvimos (encontró ${r.anclas.length}). Un `
    + 'detector que no reconoce el defecto original no puede prometer que no ha vuelto.');
});

test('SCRUM-843 · 🔴 CONTROL NEGATIVO: comparar dos árboles NO es, por sí solo, un ancla', () => {
  // Comparar la base con hoy es LO QUE HACE ESTE GUARD y tiene que seguir pudiendo hacerlo. Lo
  // prohibido es una sola cosa: declararse CIEGO porque coincidan. Si el detector no supiera
  // separar las dos, obligaría a quitar la comparación entera — que es justo lo que no se hace.
  const legitimo = `
    const a = await huella(puertoMain, '/clientes');
    const b = await huella(puerto, '/clientes');
    if (a.sha !== b.sha) {
      mal('Clientes HA CAMBIADO');
    }
    if (b.filas < 2) {
      nosupe('sin filas no hay nada que comparar');
    }
`;
  assert.deepEqual(anclasQueCaducan(legitimo).anclas, [],
    '🔴 el detector llama ancla a una comparación legítima. Con eso obligaría a retirar el '
    + 'control en vez de arreglarlo, que es lo contrario de lo que pide la regla 41.');
});

test('SCRUM-843 · 🔒 el guard NO se declara ciego porque hoy coincida con su base', () => {
  const codigo = soloCodigo(fs.readFileSync(GUARD, 'utf8'));

  // SUELO: si el guard dejara de comparar dos árboles, este fichero se quedaría vigilando el
  // vacío — y su verde diría «no hay anclas» cuando lo que pasa es que no hay comparación.
  const r = anclasQueCaducan(codigo);
  assert.equal(r.ciego, false,
    '🔴 CIEGO: no encuentro en `guard-lista-trabajos.mjs` huellas del árbol de la BASE y del de '
    + 'HOY. O cambió de forma, o ya no compara nada; en los dos casos este test dejó de mirar lo '
    + 'que cree y hay que releerlo antes de fiarse de su verde.');

  assert.deepEqual(r.anclas, [],
    '🔴 ha vuelto un ancla que CADUCA: el guard se declara «NO SUPE MIRAR» porque el árbol de hoy '
    + 'coincide con el de su punto de partida.\n     Condición: ' + r.anclas.join(' | ')
    + '\n     Eso es cierto en `main` y en toda rama que no toque esos ficheros, así que pone en '
    + 'rojo a todo el mundo. Pasó el 9-sep-2026 y fue un tapón común.\n     La calibración se '
    + 'FABRICA (ver Ⓐ y Ⓑ en el guard), no se toma prestada de un ticket sin mergear.');
});

test('SCRUM-843 · la calibración fabricada sigue en su sitio, y son las DOS', () => {
  // Quitar el ancla que caducaba sin poner nada en su lugar sería relajar el guard, que es lo
  // que la regla 41 prohíbe. Estas dos son lo que la sustituye.
  const codigo = soloCodigo(fs.readFileSync(GUARD, 'utf8'));

  assert.match(codigo, /huella\(puertoMain, '\/trabajos20'\)[\s\S]{0,200}huella\(puertoMain, '\/clientes'\)/,
    '🔴 falta la calibración Ⓐ: dos rutas DISTINTAS del MISMO servidor, que es lo que demuestra '
    + 'que el comparador distingue contenidos. Sin ella, los «idéntico» podrían ser un verde por '
    + 'no haber mirado.');

  assert.match(codigo, /_centinela-843/,
    '🔴 falta la calibración Ⓑ: el centinela que sólo existe en la copia de la base. Es lo único '
    + 'que demuestra que los dos servidores no están mirando el MISMO árbol — el fallo que hace '
    + 'que todo salga «idéntico» sin haber comparado nada.');

  // Y el centinela vive SÓLO en la copia temporal. Si alguien lo escribiera en `public/`, la
  // calibración Ⓑ pasaría a ser mentira: el de hoy también lo serviría.
  assert.equal(fs.existsSync(path.join(RAIZ, 'public', '_centinela-843.txt')), false,
    '🔴 el centinela está en `public/`. Ahí lo sirven LOS DOS servidores, así que la calibración '
    + 'Ⓑ ya no distingue nada y se volvería un verde vacío. Va en la copia temporal de la base.');
});
