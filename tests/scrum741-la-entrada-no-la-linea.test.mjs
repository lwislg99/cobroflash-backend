// tests/scrum741-la-entrada-no-la-linea.test.mjs — SCRUM-741
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// GRITA, PERO APUNTA MAL. Y un diagnóstico falso cuesta más que un silencio.
//
// `paresDelSql` (en `scrum461`) leía el censo con `^ {4}\('a','b'\),?$` — anclada al final de
// línea. Un comentario SQL detrás y esa entrada dejaba de verse: **421 donde hay 422**.
//
// Como el veredicto se construye por diferencia contra el `.prisma`, la columna salía listada
// bajo «están en `schema.prisma` y NO en `docs/sql/deriva-prod.sql`» — **estando en el SQL, en su
// línea, perfectamente escrita**. El test caía, así que el VEREDICTO era correcto **por
// accidente**; el DIAGNÓSTICO era falso y mandaba a regenerar el fichero, que es la acción
// equivocada. Costó una vuelta a otra sesión.
//
// Es el hermano de SCRUM-733: aquél era el SILENCIO (el generador encogiéndose sin decir nada);
// éste es lo contrario, y por eso engaña más — un guard que grita se cree.
//
// ── LO QUE SE HIZO, Y LO QUE NO ─────────────────────────────────────────────────────────────
// NO se escribió un segundo lector. S6 ya construyó `leerCensoDelFichero` en SCRUM-733, sin
// anclas, y dejó ESTE defecto medido y escrito en su comentario. Dos lectores del mismo fichero
// divergen, y el día que divergen cada test dice una cosa distinta sobre el mismo SQL.
//
// ── 🔴 EL FILO, que es lo que este fichero existe para vigilar ───────────────────────────────
// **Tolerar un comentario y tolerar una AUSENCIA son dos cosas distintas.** Un lector más
// permisivo cierra el diagnóstico falso y abre la puerta a lo contrario: tragarse una columna que
// de verdad falta. Los tres casos tienen que distinguirse, y los tres se prueban abajo.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url'; // SCRUM-730
import ts from 'typescript';
import { leerCensoDelFichero, RUTA_SQL } from '../scripts/generar-sql-deriva.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VIGILANTE = path.join(RAIZ, 'tests', 'scrum461-censo-no-encoge.test.mjs');

/** Un censo sintético con `n` columnas y la cabecera que declara lo que se le diga. */
function censoSintetico(pares, declaradas = pares.length) {
  return [
    `-- Columnas esperadas: ${declaradas}.`,
    'WITH esperadas(tabla, columna) AS (',
    '  VALUES',
    ...pares.map(([t, c], i) => `    ('${t}','${c}')${i < pares.length - 1 ? ',' : ''}`),
    '),',
    'catalogo AS (',
    '  SELECT 1',
    ')',
    'SELECT 1;',
  ].join('\n');
}

const TRES = [['albaranes', 'numero'], ['albaranes', 'notas'], ['Customer', 'id']];

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① SUELO · si lee cero, falla. Misma medicina que SCRUM-733.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-741 · 🔴 SUELO: el lector VE entradas de verdad en el fichero REAL', () => {
  const r = leerCensoDelFichero(fs.readFileSync(RUTA_SQL, 'utf8'));
  assert.equal(r.ok, true, `🔴 no se puede leer el censo real: ${r.ok === false ? r.motivo : ''}`);
  assert.ok(r.pares.length >= 300,
    `🔴 ESCÁNER CIEGO: sólo ${r.pares.length} entradas. Un cero —o casi— haría verdad cualquier `
    + 'afirmación sobre el conjunto, y este fichero entero dejaría de significar algo.');
  // Y el suelo del suelo: sobre un texto sin bloque `VALUES` NO puede decir «cero entradas» tan
  // tranquilo. Tiene que decir que no supo leerlo.
  const vacio = leerCensoDelFichero('-- esto no es el censo\nSELECT 1;');
  assert.equal(vacio.ok, false, '🔴 un texto que no es el censo se está leyendo como «0 columnas».');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② EL DEFECTO · un comentario detrás ya NO esconde la entrada
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-741 · 🔴 CASO A: un comentario detrás NO hace desaparecer la entrada', () => {
  const conComentario = censoSintetico(TRES)
    .replace("('albaranes','numero'),", "('albaranes','numero'),   -- SCRUM-607");

  const r = leerCensoDelFichero(conComentario);
  assert.equal(r.ok, true, `🔴 el comentario ha roto la lectura: ${r.ok === false ? r.motivo : ''}`);
  assert.equal(r.pares.length, 3, '🔴 se pierde una entrada por el comentario: el defecto sigue vivo.');
  assert.ok(r.pares.some(([t, c]) => t === 'albaranes' && c === 'numero'),
    '🔴 la entrada comentada es justo la que se pierde — el diagnóstico volvería a ser falso.');
});

test('SCRUM-741 · CONTROL POSITIVO: la regex VIEJA sí perdía esa entrada', () => {
  // Sin esto, el caso A de arriba pasaría igual aunque el defecto nunca hubiera existido, y no
  // sabríamos si lo hemos arreglado o si nunca hubo nada que arreglar.
  const linea = "    ('albaranes','numero'),   -- SCRUM-607";
  const VIEJA = /^ {4}\('([^']+)','([^']+)'\),?$/gm;
  assert.equal([...linea.matchAll(VIEJA)].length, 0,
    '🔴 la regex vieja NO perdía la entrada: entonces el defecto que este ticket arregla no era ése.');
  // Y sin el comentario sí la veía: era una regex correcta para el caso limpio.
  assert.equal([..."    ('albaranes','numero'),".matchAll(/^ {4}\('([^']+)','([^']+)'\),?$/gm)].length, 1);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③🔴 EL FILO · tolerar el comentario NO es tolerar la ausencia
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-741 · 🔴 CASO B: una columna que FALTA de verdad se lee como que falta', () => {
  // El fichero es coherente consigo mismo (cabecera 2, dos entradas): se lee bien, y la columna
  // que falta tiene que salir a la luz en la comparación contra el schema — no aquí, pero el
  // lector NO puede inventársela ni tragársela.
  const dos = censoSintetico([TRES[0], TRES[2]]);
  const r = leerCensoDelFichero(dos);
  assert.equal(r.ok, true, 'un fichero coherente tiene que poder leerse');
  assert.equal(r.pares.length, 2, '🔴 el lector se ha inventado una entrada.');
  assert.ok(!r.pares.some(([t, c]) => t === 'albaranes' && c === 'notas'),
    '🔴 🔴 EL LECTOR SE TRAGA UNA AUSENCIA: da por presente una columna que NO está en el fichero. '
    + 'Eso es peor que el defecto que este ticket arregla — el censo dejaría de vigilarla en verde.');
});

test('SCRUM-741 · 🔴 CASO C: «no supe leer» NO se confunde con «faltan columnas»', () => {
  // El fichero dice en su cabecera que trae 3 y sólo hay 2: alguien borró una línea sin tocar la
  // cabecera. Eso NO es «faltan columnas» —podría ser un lector roto— y tiene que salir por otra
  // puerta, con `ok:false` y un motivo que lo diga.
  const incoherente = censoSintetico([TRES[0], TRES[2]], 3);
  const r = leerCensoDelFichero(incoherente);
  assert.equal(r.ok, false,
    '🔴 un fichero cuya cabecera no cuadra con su contenido se está leyendo como bueno. Su '
    + 'recuento decidiría si el censo se ha encogido, diciendo quizá lo contrario de lo que pasa.');
  assert.match(r.motivo, /No supe leer/,
    '🔴 el motivo no distingue «no supe leer» de «le faltan columnas»: son la misma frase para '
    + 'quien lo lea, y mandan a arreglar cosas distintas.');
  assert.match(r.motivo, /declara 3 .* leo 2/,
    '🔴 el motivo no dice los DOS números, que es lo único que permite ver de qué lado está el fallo.');
});

test('SCRUM-741 · 🔴 y el VIGILANTE convierte ese «no supe leer» en un FALLO, no en una lista corta', () => {
  // Si `paresDelSql` devolviera los 2 pares del caso C como si fueran buenos, la comparación
  // diría «falta una columna» sobre un fichero que quizá la tiene. Tiene que reventar antes.
  const src = fs.readFileSync(VIGILANTE, 'utf8');
  const sf = ts.createSourceFile('x.mjs', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let lanza = false;
  const v = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.name.text === 'paresDelSql') {
      if (/throw new Error/.test(n.getText(sf))) lanza = true;
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  assert.ok(lanza,
    '🔴 `paresDelSql` no falla cuando el lector dice `ok:false`. Devolver una lista en la que el '
    + 'propio lector no confía es exactamente cómo nace un diagnóstico falso.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ EL TRINQUETE · por IDENTIDAD, no por una palabra que sobreviva en un import
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * 🔴 Cuenta LLAMADAS, no menciones. Es la lección de SCRUM-740, aprendida el mismo día: un
 * trinquete anclado a `src.includes('leerCensoDelFichero')` seguiría verde con la llamada
 * borrada, porque el `import` y este comentario mantienen la palabra viva en el fichero.
 */
function llamadasA(src, nombre) {
  const sf = ts.createSourceFile('x.mjs', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let n = 0;
  const v = (nodo) => {
    if (ts.isCallExpression(nodo) && ts.isIdentifier(nodo.expression) && nodo.expression.text === nombre) n += 1;
    ts.forEachChild(nodo, v);
  };
  v(sf);
  return n;
}

test('SCRUM-741 · SUELO: el contador distingue una LLAMADA de una MENCIÓN', () => {
  assert.equal(llamadasA("import { leerCensoDelFichero } from './x.mjs';", 'leerCensoDelFichero'), 0);
  assert.equal(llamadasA('// llama a leerCensoDelFichero', 'leerCensoDelFichero'), 0);
  assert.equal(llamadasA('const r = leerCensoDelFichero(t);', 'leerCensoDelFichero'), 1,
    '🔴 no ve una llamada real: el trinquete pasaría de mudo a ciego.');
});

test('SCRUM-741 · 🔴 TRINQUETE: el vigilante LEE con el lector compartido, y no con una regex propia', () => {
  const src = fs.readFileSync(VIGILANTE, 'utf8');

  assert.ok(llamadasA(src, 'leerCensoDelFichero') >= 1,
    '🔴 `scrum461` ha dejado de usar el lector compartido. Si vuelve a leer por su cuenta, vuelve '
    + 'el diagnóstico falso: una entrada con un comentario detrás se contará como ausente y el '
    + 'guard señalará al `schema.prisma`, que no tiene la culpa.');

  // Y que no haya vuelto a nacer una regex anclada al final de línea sobre el censo. Se mira el
  // CÓDIGO desnudo, no el comentario que explica cuál era el defecto (que la contiene a propósito).
  const desnudo = src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');
  assert.ok(desnudo.includes('paresDelSql'), '🔴 el desnudado se llevó el código por delante.');
  assert.equal(/\\\(\'\(\[\^\'\]\+\)\',\'\(\[\^\'\]\+\)\'\\\),\?\$/.test(desnudo), false,
    '🔴 ha vuelto una regex anclada en `$` para leer el censo: es exactamente el defecto de este '
    + 'ticket. Un comentario detrás de una entrada la haría invisible otra vez.');
});
