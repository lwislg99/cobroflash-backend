// tests/restauracion-del-arbol-ejecutable.test.mjs
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EJERCITADA NO ES VIGILADA.
//
// SCRUM-763 dejó escrito este hueco, con estas palabras: «La restauración de `dist/` del
// meta-guard no tiene guard propio en la suite (la detección sí, provocada). Está ejercitada de
// continuo por las declaraciones sobre TypeScript.» **Y eso no es un guard.** Que un mecanismo se
// use todos los días no lo vigila: el día que alguien retire la pieza de `dist` de la
// restauración, las mutaciones seguirán corriendo y el árbol se quedará mutado en silencio — que
// es exactamente el defecto que SCRUM-763 vino a cerrar, devuelto por la puerta de atrás.
//
// ── LO QUE SE VIGILA AQUÍ, Y POR QUÉ ESTAS TRES PIEZAS ──────────────────────────────────────
// ① `piezasARestaurar` — que un fuente COMPILADO pida DOS piezas y uno que no se compila UNA.
//    Las dos direcciones, porque romperlo por el otro lado (pedir siempre dos) encarecería todas
//    las mutaciones de la casa por un caso que no aplica.
// ② `restaurarYVerificar` — que devuelva CADA pieza a sus bytes, y que sin la pieza de `dist` el
//    árbol ejecutable **se quede mutado**: el defecto, provocado y visible, no contado.
// ③ El censo de alcance — cuántas declaraciones tienen un test que EJECUTA `dist/`. Es el número
//    que dice el tamaño que tenía el agujero, y un censo sin controles no es un número.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  censoDeLectoresDeDist, leeDistEnTexto, piezasARestaurar, rastroDeDist, restaurarYVerificar,
} from '../scripts/meta-guard-mutaciones.mjs';

/** Un par de ficheros de mentira que hacen de «fuente» y «árbol ejecutable». */
function bancoDePiezas() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'restauracion-'));
  const fuente = path.join(dir, 'x.ts');
  const dist = path.join(dir, 'x.js');
  fs.writeFileSync(fuente, 'const a = 1;\n');
  fs.writeFileSync(dist, 'var a = 1;\n');
  return {
    dir,
    fuente,
    dist,
    ORIGINAL_FUENTE: fs.readFileSync(fuente),
    ORIGINAL_DIST: fs.readFileSync(dist),
    limpiar: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ① LAS PIEZAS · las dos direcciones
// ─────────────────────────────────────────────────────────────────────────────────────────────
test('la restauración pide DOS piezas cuando el fichero se compila, y UNA cuando no', () => {
  const conDist = piezasARestaurar({
    fichero: 'src/x.ts',
    abs: '/tmp/x.ts',
    ORIGINAL: Buffer.from('a'),
    destino: 'dist/x.js',
    absDist: '/tmp/x.js',
    ORIGINAL_DIST: Buffer.from('b'),
  });
  assert.equal(conDist.length, 2,
    '🔴 un fuente COMPILADO pide una sola pieza: se restauraría el `.ts` y `dist/` se quedaría '
    + 'mutado. Es el verde falso de SCRUM-763 — `Buffer.compare` sobre el fuente da 0 sobre un '
    + 'árbol que sigue ejecutando otra cosa.');
  assert.deepEqual(conDist.map((p) => p.ruta), ['src/x.ts', 'dist/x.js']);

  // 🔴 LA OTRA DIRECCIÓN, y no es simetría de adorno: si esto pidiera dos piezas siempre, cada
  // mutación sobre un `.mjs` pagaría un árbol ejecutable que no existe.
  const sinDist = piezasARestaurar({
    fichero: 'tests/x.test.mjs',
    abs: '/tmp/x.test.mjs',
    ORIGINAL: Buffer.from('a'),
    destino: null,
    absDist: null,
    ORIGINAL_DIST: null,
  });
  assert.equal(sinDist.length, 1,
    '🔴 un fichero SIN compilación pide dos piezas: se le está inventando un `dist/`.');
  assert.equal(sinDist[0].ruta, 'tests/x.test.mjs');
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ② LA RESTAURACIÓN · con el defecto PROVOCADO al lado
// ─────────────────────────────────────────────────────────────────────────────────────────────
test('🔴 devuelve LOS DOS ficheros a sus bytes — y sin la pieza de dist, dist se queda mutado', () => {
  const b = bancoDePiezas();
  try {
    const piezas = piezasARestaurar({
      fichero: 'x.ts',
      abs: b.fuente,
      ORIGINAL: b.ORIGINAL_FUENTE,
      destino: 'x.js',
      absDist: b.dist,
      ORIGINAL_DIST: b.ORIGINAL_DIST,
    });

    // Muto los dos, como hace una mutación de verdad.
    fs.writeFileSync(b.fuente, 'const a = 999;\n');
    fs.writeFileSync(b.dist, 'var a = 999;\n');
    assert.notEqual(Buffer.compare(fs.readFileSync(b.dist), b.ORIGINAL_DIST), 0,
      '🔴 el banco no ha mutado nada: este test no probaría nada.');

    assert.deepEqual(restaurarYVerificar(piezas), [],
      '🔴 la restauración dice que algo no volvió a su sitio.');
    assert.equal(Buffer.compare(fs.readFileSync(b.fuente), b.ORIGINAL_FUENTE), 0,
      '🔴 el FUENTE no ha vuelto a sus bytes.');
    assert.equal(Buffer.compare(fs.readFileSync(b.dist), b.ORIGINAL_DIST), 0,
      '🔴 el ÁRBOL EJECUTABLE no ha vuelto a sus bytes. Restaurar el fuente no es restaurar el '
      + 'árbol: los tests seguirían ejecutando el código mutado.');

    // 🔴 EL DEFECTO, PROVOCADO: la misma llamada SIN la pieza de `dist`. El fuente vuelve, el
    // árbol ejecutable NO — y la verificación por bytes del fuente daría verde igual.
    fs.writeFileSync(b.fuente, 'const a = 999;\n');
    fs.writeFileSync(b.dist, 'var a = 999;\n');
    assert.deepEqual(restaurarYVerificar([piezas[0]]), [],
      '🔴 restaurar sólo el fuente ya se queja: entonces este control no aísla lo que cree.');
    assert.equal(Buffer.compare(fs.readFileSync(b.fuente), b.ORIGINAL_FUENTE), 0,
      '🔴 el fuente no volvió ni en el caso de control.');
    assert.notEqual(Buffer.compare(fs.readFileSync(b.dist), b.ORIGINAL_DIST), 0,
      '🔴 `dist/` ha vuelto solo, sin que nadie se lo pidiera. Entonces este test no está midiendo '
      + 'la frontera de SCRUM-763 y su verde de arriba no significa lo que dice.');
  } finally {
    b.limpiar();
  }
});

test('la restauración NO se traga un fallo de escritura: revienta en vez de decir «todo bien»', () => {
  const b = bancoDePiezas();
  try {
    // Un destino imposible (dentro de un directorio que no existe). Un restaurador que devolviera
    // `[]` aquí estaría diciendo «restaurado» sobre algo que no llegó a intentar.
    const imposible = path.join(b.dir, 'no-existe', 'x.ts');
    assert.throws(
      () => restaurarYVerificar([{ ruta: 'x.ts', abs: imposible, ORIGINAL: b.ORIGINAL_FUENTE }]),
      /ENOENT/,
      '🔴 la restauración se ha tragado un fallo de escritura. «No pude ni intentarlo» y «todo '
      + 'volvió a su sitio» se estarían escribiendo igual.');
  } finally {
    b.limpiar();
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ③ EL CENSO DE ALCANCE · el número, con sus controles
// ─────────────────────────────────────────────────────────────────────────────────────────────
test('🔴 el censo distingue EJECUTAR dist/ de nombrarlo — y las dos veces por la vía correcta', () => {
  // CONTROL POSITIVO ①: el import, que no admite otra lectura.
  assert.equal(leeDistEnTexto("import * as U from '../dist/core/utils/utils.js';"), true);
  // CONTROL POSITIVO ②: la ruta montada a trozos.
  assert.equal(leeDistEnTexto("const D = path.join(RAIZ, 'dist', 'app.js');"), true);

  // 🔴 CONTROL NEGATIVO ①, y es el que costó un número equivocado: `'dist'` a secas suele ser una
  // EXCLUSIÓN de un barrido. Contarlo metió a `scrum751` entre los lectores de `dist/` cuando su
  // helper hace justo lo contrario.
  assert.equal(leeDistEnTexto("const SKIP = new Set(['node_modules', 'dist']);"), false,
    '🔴 un `dist` EXCLUIDO de un barrido se está contando como `dist` ejecutado.');
  assert.equal(leeDistEnTexto("if (e.name === 'dist') continue;"), false);

  // CONTROL NEGATIVO ②: los comentarios no cuentan. El árbol escribe `dist/` a puñados en prosa.
  assert.equal(leeDistEnTexto('// este guard no toca dist/ para nada\nconst x = 1;'), false,
    '🔴 el censo se caza a sí mismo en la prosa que lo explica.');

  // Y sobre el árbol REAL, los tres casos que se midieron a mano:
  assert.equal(rastroDeDist('utils.test.mjs').lee, true,
    '🔴 `utils.test.mjs` importa `../dist/core/utils/utils.js` en su línea 5.');
  assert.equal(rastroDeDist('scrum751-clave-duplicada-en-silencio.test.mjs').lee, false,
    '🔴 `scrum751` sale como lector de `dist/` y su helper lo EXCLUYE del barrido.');
  // La cadena de helpers: `scrum641` no nombra `dist/`; lo alcanza por `_banco-vistas.mjs`.
  const via = rastroDeDist('scrum641-nombre-cogido-sin-500.test.mjs');
  assert.equal(via.lee, true);
  assert.match(via.por, /_banco-vistas\.mjs/,
    '🔴 el censo ya no sigue la cadena de helpers: diría «no lee dist» de un fichero que muere sin él.');
});

test('🔴 SUELO: el censo de alcance tiene población, y ninguna declaración se le queda sin leer', () => {
  const c = censoDeLectoresDeDist();

  // Sin población, «0 expuestas» y «no supe mirar» se escriben igual.
  assert.ok(c.poblacion >= 50,
    `🔴 CIEGO: el censo sólo ha visto ${c.poblacion} declaraciones. Su reparto no significaría nada.`);
  assert.equal(c.noLegibles.length, 0,
    '🔴 CIEGO: hay declaraciones que el censo no ha sabido leer, y eso NO es «no leen dist»:\n  · '
    + c.noLegibles.map((n) => `${n.guard} :: ${n.porque}`).join('\n  · '));
  assert.equal(c.leen.length + c.noLeen.length, c.poblacion,
    '🔴 la clasificación no es excluyente: hay declaraciones contadas dos veces o ninguna.');

  // Y el reparto no puede colapsar a un lado: si TODAS leyeran dist, o ninguna, el detector
  // habría dejado de distinguir y el número dejaría de ser un número.
  assert.ok(c.leen.length > 0 && c.noLeen.length > 0,
    `🔴 el censo dice ${c.leen.length} / ${c.noLeen.length}: ha dejado de distinguir.`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA MUTACIÓN QUE ME TUMBA (SCRUM-745)
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // 🔴 EL DEFECTO QUE ESTE GUARD EXISTE PARA CAZAR: alguien retira la pieza de `dist` y las
    // mutaciones siguen corriendo, dejando el árbol ejecutable mutado en silencio.
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  if (absDist && ORIGINAL_DIST) piezas.push({ ruta: destino, abs: absDist, ORIGINAL: ORIGINAL_DIST });',
    a: '  // la pieza de dist, retirada',
    cae: 'la restauración pide DOS piezas cuando el fichero se compila',
  },
  {
    // La restauración deja de escribir: devolvería «todo bien» sin haber devuelto nada.
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '    fs.writeFileSync(p.abs, p.ORIGINAL);',
    a: '    /* no restaura */',
    cae: 'devuelve LOS DOS ficheros a sus bytes',
  },
  {
    // El censo deja de distinguir un `dist` EXCLUIDO de un `dist` ejecutado: el número del
    // alcance se infla y deja de ser un número.
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: "      else if (n.text === 'dist' && esTrozoDeRuta(n)) visto = true;",
    a: "      else if (n.text === 'dist') visto = true;",
    cae: 'el censo distingue EJECUTAR dist/ de nombrarlo',
  },
];
