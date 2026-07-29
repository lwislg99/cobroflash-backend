// SCRUM-224b · LA LÍNEA BASE DEL AVISO DE VERSIÓN ES UN DATO, NO UNA INFERENCIA.
//
// El aviso de «hay versión nueva» deducía con qué build se sirvió la página de la PRIMERA
// lectura buena de `/version`. Si esa lectura fallaba —lo más probable durante un deploy EN
// VUELO, o sea justo cuando sale un hotfix— la línea base acababa siendo la versión NUEVA y el
// aviso no salía NUNCA: el usuario se quedaba con el JS viejo y nada se lo decía.
//
// Ahora el build viaja SELLADO en el HTML (`app.ts` lo inyecta al servir `/dashboard/`). Este
// test fija las tres ramas de esa lectura, que es donde volvería a colarse el bug.
//
// El front es vanilla y no se importa: se evalúa la expresión real del fichero contra un
// `document` de mentira, igual que scrum153b y scrum37.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const APP = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'js', 'app.js'), 'utf8');
const INDEX = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'index.html'), 'utf8');

// El marcador se compone por partes: escrito entero, este fichero se contaría a sí mismo en el
// recuento de abajo. Es la misma trampa que se comió la sustitución en `app.ts`.
const MARCADOR = '__' + 'BUILD_ID' + '__';

/** Evalúa la expresión REAL de la línea base con un `<meta>` simulado. */
function lineaBase(contenidoMeta) {
  const ini = APP.indexOf('const selloBuild');
  const fin = APP.indexOf('let versionToastShown');
  assert.ok(ini > 0 && fin > ini, '🔴 no se encuentra la expresión de la línea base en app.js');
  const documentoFalso = {
    querySelector: () => (contenidoMeta === undefined ? null : { content: contenidoMeta }),
  };
  // eslint-disable-next-line no-new-func
  return new Function('document', `${APP.slice(ini, fin)}; return appBuildId;`)(documentoFalso);
}

test('SCRUM-224b · con el sello puesto, la línea base es ESE build (no se infiere)', () => {
  assert.equal(lineaBase('abc123'), 'abc123');
});

test('SCRUM-224b · un marcador SIN sustituir cuenta como AUSENTE, no como build', () => {
  // Si esto devolviera el literal, el aviso saltaría en CADA poll: una cadena que nunca va a
  // coincidir con un BUILD_ID real. Falso positivo permanente, peor que el bug original.
  assert.equal(lineaBase(MARCADOR), null,
    '🔴 el marcador sin sustituir se tomó por un build: el aviso saltaría siempre');
});

test('SCRUM-224b · sin meta, se cae al comportamiento anterior (inferir), no se rompe', () => {
  assert.equal(lineaBase(undefined), null);
  assert.equal(lineaBase(''), null);
});

test('SCRUM-224b · el HTML lleva el marcador UNA sola vez', () => {
  // Dos apariciones fueron el bug real: `replace` (no `replaceAll`) sustituyó la del comentario
  // que explicaba el marcador y dejó el `<meta>` de verdad sin sellar. El servidor ya usa
  // `replaceAll`, pero una segunda aparición sigue siendo señal de que alguien lo nombró en prosa.
  const veces = INDEX.split(MARCADOR).length - 1;
  assert.equal(veces, 1, `🔴 el marcador aparece ${veces} veces en index.html; debe aparecer 1`);
  assert.match(INDEX, /<meta name="yaqu-build" content="__BUILD_ID__">/,
    'el <meta> del sello debe seguir existiendo y con ese nombre exacto');
});

test('SCRUM-224b · el servidor sustituye con replaceAll y sirve no-store', () => {
  const APPTS = fs.readFileSync(path.join(RAIZ, 'src', 'app.ts'), 'utf8');
  assert.match(APPTS, /\.replaceAll\(MARCADOR_BUILD, config\.BUILD_ID\)/,
    '🔴 con `replace` en vez de `replaceAll` solo cae la primera aparición');
  assert.match(APPTS, /res\.set\('Cache-Control', 'no-store'\)/,
    '🔴 sin no-store, un HTML cacheado con un sello viejo haría mentir al aviso por otro camino');
  // El 301 de `/dashboard` sin barra lo hacía `express.static`; al adelantarse la ruta hay que
  // reproducirlo a mano o la forma de la URL cambia para todo el mundo.
  assert.match(APPTS, /res\.redirect\(301, '\/dashboard\/'\)/,
    '🔴 se perdió el 301 de /dashboard → /dashboard/');
});
