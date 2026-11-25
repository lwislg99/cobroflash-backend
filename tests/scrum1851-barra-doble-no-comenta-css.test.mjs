// tests/scrum1851-barra-doble-no-comenta-css.test.mjs — SCRUM-1851
//
// LA VÍCTIMA (medida por jv-j1kt en SCRUM-1843b): `soloEjecutable` trataba la barra doble como
// comentario de línea también en CSS, donde ese comentario NO EXISTE. Un `url(https://x.y/z.png)`
// sin comillas se comía el resto de la línea, llave de cierre incluida, y el selector de la regla
// siguiente acababa dentro de un cuerpo: tres reglas sembradas se leían como dos. El test que trocea
// `styles.css` veía menos reglas de las que hay y podía quedar verde mirando de menos.
//
// EL ARREGLO vive en el helper, que es el sitio único (SCRUM-700): la barra doble depende del tipo de
// fichero igual que ya dependía la almohadilla (`almohadillaComenta`, SCRUM-193b). `leerFuente` lo
// decide por la ruta; quien pasa el texto a mano lo dice con `barraDobleEsComentario: false`.
//
// Las sondas se construyen desde el HECHO (lo que el CSS significa), no desde lo que hacía el helper.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import * as guardTexto from './_guard-texto.mjs';

const { soloEjecutable, ejecutableDe, ejecutablesDe, leerFuente } = guardTexto;

// Tres reglas; la del medio lleva una URL SIN comillas, que es CSS válido.
const URL_SIN_COMILLAS = 'url(https://x.y/z.png)';
const CSS_SEMBRADO = [
  '.uno { color: red; }',
  `.dos { background: ${URL_SIN_COMILLAS}; }`,
  '.tres { color: blue; }',
  '',
].join('\n');

const reglas = (css) => css.split('}').filter((b) => b.includes('{')).map((b) => b.split('{')[0].trim());

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La barra doble vuelve a comentar SIEMPRE, también en CSS: la regla del medio pierde su llave.
    fichero: 'tests/_guard-texto.mjs',
    de: "if (c === '/' && d === '/' && barraDobleEsComentario && fuente[i - 1] !== '\\\\') {",
    a: "if (c === '/' && d === '/' && fuente[i - 1] !== '\\\\') {",
    cae: 'con la opción, tres reglas sembradas siguen siendo tres',
  },
  {
    // `leerFuente` deja de distinguir el CSS por su ruta.
    fichero: 'tests/_guard-texto.mjs',
    de: 'return !/\\.css$/i.test(ruta);',
    a: 'return true;',
    cae: '`leerFuente` decide por la ruta',
  },
];

test('SCRUM-1851 · 🔴 CSS: con la opción, tres reglas sembradas siguen siendo tres y la URL entera', () => {
  assert.deepEqual(reglas(CSS_SEMBRADO), ['.uno', '.dos', '.tres'], 'la siembra no tiene las tres reglas');
  const css = soloEjecutable(CSS_SEMBRADO, { almohadillaEsComentario: false, barraDobleEsComentario: false });
  assert.deepEqual(reglas(css), ['.uno', '.dos', '.tres'],
    `🔴 el filtro se ha comido una llave: la URL sin comillas abrió un comentario que en CSS no existe.\n${css}`);
  assert.ok(css.includes(URL_SIN_COMILLAS), `🔴 la URL salió cortada:\n${css}`);
});

test('SCRUM-1851 · 🔴 `leerFuente` decide por la ruta: un .css no pierde la regla y un .mjs sigue comentando', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1851-'));
  try {
    const hoja = path.join(dir, 'hoja.css');
    fs.writeFileSync(hoja, CSS_SEMBRADO);
    const css = leerFuente(hoja, { ancla: URL_SIN_COMILLAS });
    assert.deepEqual(reglas(css), ['.uno', '.dos', '.tres'], `🔴 leído como CSS perdió una regla:\n${css}`);

    // El mismo texto con extensión de JavaScript: ahí la barra doble SÍ comenta, como siempre.
    const modulo = path.join(dir, 'modulo.mjs');
    fs.writeFileSync(modulo, 'const VIVO_1851 = 1; // COMENTADO_1851\n');
    const js = leerFuente(modulo, { ancla: 'VIVO_1851' });
    assert.ok(fs.readFileSync(modulo, 'utf8').includes('COMENTADO_1851'), 'la siembra JS no lleva su comentario');
    assert.ok(!js.includes('COMENTADO_1851'), `🔴 en un .mjs la barra doble dejó de comentar:\n${js}`);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('SCRUM-1851 · `barraDobleComenta` dice false sólo en CSS', () => {
  const { barraDobleComenta } = guardTexto;
  assert.equal(typeof barraDobleComenta, 'function', '🔴 el helper no exporta `barraDobleComenta`');
  for (const ruta of ['a.js', 'b.mjs', 'c.cjs', 'd.ts', 'public/dashboard/js/x.js', 'e.yml']) {
    assert.equal(barraDobleComenta(ruta), true, `🔴 ${ruta}: la barra doble tiene que seguir comentando`);
  }
  for (const ruta of ['public/dashboard/css/styles.css', 'HOJA.CSS']) {
    assert.equal(barraDobleComenta(ruta), false, `🔴 ${ruta}: en CSS la barra doble no comenta`);
  }
});

test('SCRUM-1851 · sin la opción el comportamiento de JS no cambia, y el bloque /* */ se va también en CSS', () => {
  const JS = 'const x = 1; // PALABRA_1851';
  assert.ok(JS.includes('PALABRA_1851'), 'la siembra no lleva la palabra');
  assert.ok(!soloEjecutable(JS).includes('PALABRA_1851'), '🔴 por defecto la barra doble tiene que comentar');
  assert.ok(soloEjecutable(JS, { barraDobleEsComentario: false }).includes('PALABRA_1851'),
    '🔴 la opción no llega al filtro: con `barraDobleEsComentario: false` la palabra tiene que sobrevivir');

  const CSS_CON_BLOQUE = `/* OCULTO_1851 */\n${CSS_SEMBRADO}`;
  assert.ok(CSS_CON_BLOQUE.includes('OCULTO_1851'), 'la siembra no lleva el bloque');
  const css = soloEjecutable(CSS_CON_BLOQUE, { almohadillaEsComentario: false, barraDobleEsComentario: false });
  assert.ok(!css.includes('OCULTO_1851'), `🔴 el comentario de bloque sobrevivió en CSS:\n${css}`);
  assert.deepEqual(reglas(css), ['.uno', '.dos', '.tres']);
});

test('SCRUM-1851 · 🔴 `ejecutableDe` y `ejecutablesDe` pasan la opción al filtro', () => {
  const css = ejecutableDe(CSS_SEMBRADO, {
    ancla: URL_SIN_COMILLAS, donde: 'la siembra de SCRUM-1851', almohadillaEsComentario: false, barraDobleEsComentario: false,
  });
  assert.deepEqual(reglas(css), ['.uno', '.dos', '.tres']);
  const [item] = ejecutablesDe([{ nombre: 'hoja.css', texto: CSS_SEMBRADO, almohadillaEsComentario: false, barraDobleEsComentario: false }],
    { donde: 'la siembra de SCRUM-1851' });
  assert.ok(item.codigo.includes(URL_SIN_COMILLAS), `🔴 ejecutablesDe no pasó la opción:\n${item.codigo}`);
  assert.deepEqual(reglas(item.codigo), ['.uno', '.dos', '.tres']);
});
