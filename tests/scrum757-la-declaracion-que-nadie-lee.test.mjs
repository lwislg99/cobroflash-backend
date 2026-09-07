// tests/scrum757-la-declaracion-que-nadie-lee.test.mjs — SCRUM-757
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL LECTOR DE DECLARACIONES SE CALLABA CUANDO NO ENTENDÍA, Y ESO ES UN FALSO VERDE.
//
// `lecturaDeDeclaraciones` sólo acepta `ts.isStringLiteralLike`. Cualquier otra forma —una
// concatenación `'…' + '…'`, por ejemplo— **no se leía**, la declaración se caía del recuento y
// **el guard que vigilaba se quedaba sin vigilar**. No es un falso rojo: es un falso verde.
//
// 🔴 HA MORDIDO A TRES SESIONES EN UN DÍA (SCRUM-778, SCRUM-801 y una tercera), y las tres se
// enteraron **sólo porque reescribieron la declaración por otro motivo**. Si no la tocan, se
// queda invisible indefinidamente.
//
// ── LO QUE SE MIDIÓ ANTES DE ARREGLARLO, corriendo ──────────────────────────────────────────
//   · `--solo-censo` con una `a` concatenada → **127 → 126 declaraciones, salida 0, cero
//     palabras**. Silencio absoluto en el camino rápido, que es el que se usa para comprobar.
//   · la pasada COMPLETA sí decía algo —`CIEGO (declaración incompleta)`, salida 2— pero con un
//     diagnóstico **falso**: «le faltan: a», cuando el campo está delante; y **sin la línea**.
//
// ── 🔴 EL SUELO NO ES «ACEPTAR CONCATENACIONES» ─────────────────────────────────────────────
// Aceptar una forma más deja el MISMO agujero para la siguiente. El suelo es: **toda declaración
// que el lector no pueda evaluar se denuncia, con su fichero y su línea, en vez de descartarse.**
// Que el lector entienda o no una concatenación es secundario; que se calle cuando no entiende
// es el defecto.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  lecturaDeDeclaraciones, mutacionesDeclaradas, declaracionesIlegibles, motivoDeIlegible,
  censoDeDeclaraciones, CAMPOS_DE_LA_DECLARACION,
} from '../scripts/meta-guard-mutaciones.mjs';

const CABECERA = "import test from 'node:test';\ntest('uno', () => {});\ntest('dos', () => {});\n\n";
const BUENA = "  { fichero: 'src/a.ts', de: 'X', a: 'Y', cae: 'uno' },\n";

/** Un directorio de guards de mentira, para no tocar el de verdad. */
function banco(...cuerpos) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum757-'));
  fs.writeFileSync(path.join(dir, 'guardx.test.mjs'),
    `${CABECERA}export const MUTACIONES_QUE_ME_TUMBAN = [\n${cuerpos.join('')}];\n`);
  return { dir, limpia: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

// ═══ ① EL ROJO QUE IMPORTA · la declaración que el lector no sabe leer ═══════════════════════

test('SCRUM-757 · 🔴 una declaración NO EVALUABLE se DENUNCIA con fichero y línea', () => {
  const b = banco(BUENA, "  { fichero: 'src/b.ts', de: 'P', a: 'Q' + 'R', cae: 'dos' },\n");
  try {
    // SUELO: la buena se sigue leyendo. Si no, lo de abajo mediría el vacío.
    const censo = censoDeDeclaraciones(b.dir);
    assert.equal(censo.reduce((n, c) => n + c.mutaciones.length, 0), 1,
      '🔴 el banco no lee ni la declaración buena.');

    const malas = declaracionesIlegibles(b.dir);
    assert.equal(malas.length, 1,
      '🔴 la declaración con `a` concatenado se ha descartado EN SILENCIO. El recuento baja de N a '
      + 'N−1, el guard que vigilaba se queda sin vigilar, y nada lo dice. Es un falso VERDE.');

    const x = malas[0];
    assert.equal(x.guard, 'guardx.test.mjs', '🔴 la denuncia no dice EN QUÉ FICHERO.');
    assert.ok(x.linea > 0, '🔴 la denuncia no dice EN QUÉ LÍNEA. Sin la línea, quien la lea tiene '
      + 'que ir a buscarla, que es justo lo que no hizo nadie durante tres sesiones.');
    assert.deepEqual(x.noEvaluables.map((n) => n.clave), ['a'],
      '🔴 no dice QUÉ CAMPO es el que no ha podido leer.');
    assert.equal(x.noEvaluables[0].forma, 'BinaryExpression',
      '🔴 no dice QUÉ FORMA tiene lo que no supo leer.');

    // 🔴 Y NO SE CONFUNDE CON UN CAMPO QUE FALTA. Antes se decía «le faltan: a», y eso es una
    // MENTIRA: el campo está delante. Manda a buscar lo que no es.
    assert.deepEqual(x.faltan, [],
      '🔴 dice que FALTA el campo `a` cuando el campo ESTÁ escrito. El diagnóstico manda a quien '
      + 'lo lea a buscar un campo ausente que está delante de sus ojos.');
    assert.match(motivoDeIlegible(x), /ESTÁ, pero no es un literal/,
      '🔴 el motivo escrito no distingue «no está» de «está y no lo sé leer».');
  } finally { b.limpia(); }
});

test('SCRUM-757 · 🔴 Y CAE CON EL MECANISMO VIEJO: hoy esa misma declaración se perdía', () => {
  const b = banco(BUENA, "  { fichero: 'src/b.ts', de: 'P', a: 'Q' + 'R', cae: 'dos' },\n");
  try {
    // El mecanismo VIEJO es `mutacionesDeclaradas`: sólo devuelve las buenas, sin decir nada de
    // las otras. Es lo que ven todos sus llamantes, y por donde entró el defecto tres veces.
    const codigo = fs.readFileSync(path.join(b.dir, 'guardx.test.mjs'), 'utf8');
    assert.equal(mutacionesDeclaradas(codigo, 'guardx.test.mjs').length, 1,
      '🔴 el caso NO discrimina: con el mecanismo viejo TENÍAN que salir 1 de 2. Si salen las dos, '
      + 'este test pasaría con los dos mecanismos y no probaría ninguno.');
    assert.equal(declaracionesIlegibles(b.dir).length, 1,
      '🔴 y con el suelo tiene que aparecer la que se perdía. Ahí está la diferencia entera.');
  } finally { b.limpia(); }
});

// ═══ ② CONTROL POSITIVO · lo bien escrito se sigue contando igual ════════════════════════════

test('SCRUM-757 · ✅ POSITIVO: las declaraciones bien escritas no cambian de cuenta', () => {
  const b = banco(BUENA, "  { fichero: 'src/b.ts', de: 'P', a: 'Q', cae: 'dos' },\n");
  try {
    assert.deepEqual(declaracionesIlegibles(b.dir), [],
      '🔴 denuncia declaraciones que están perfectamente escritas. Un suelo que grita sin motivo '
      + 'se aprende a ignorar, y entonces deja de proteger.');
    const censo = censoDeDeclaraciones(b.dir);
    assert.equal(censo.reduce((n, c) => n + c.mutaciones.length, 0), 2);
  } finally { b.limpia(); }
});

test('SCRUM-757 · ✅ POSITIVO: el ÁRBOL REAL sigue dando el mismo número, y CERO ilegibles', () => {
  // 🔴 Si al cerrar el hueco cambiara esta cifra, se habría roto algo más. Medido antes de
  // conectar el suelo: 127 declaraciones y CERO campos que no fueran literal único, así que
  // conectar esto NO podía poner rojo al árbol — y se comprobó antes, no después.
  assert.deepEqual(declaracionesIlegibles().map(motivoDeIlegible), [],
    '🔴 hay declaraciones del árbol que el lector no puede evaluar. Cada una es un guard sin '
    + 'vigilar. Escríbelas con los cuatro campos como UN literal de cadena.');
  const total = censoDeDeclaraciones().reduce((n, c) => n + c.mutaciones.length, 0);
  assert.ok(total >= 127,
    `🔴 el censo del árbol ha bajado a ${total}. Cuando se midió eran 127, y este ticket no puede `
    + 'quitar ninguna: sólo denunciar las que no se leen.');
});

// ═══ ③ CONTROL NEGATIVO · no se marca lo que NO pretende ser una declaración ═════════════════

test('SCRUM-757 · ✅ NEGATIVO: un objeto cualquiera del fichero NO se denuncia', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum757n-'));
  try {
    // Objetos raros por todas partes, y NINGUNO dentro de `MUTACIONES_QUE_ME_TUMBAN`.
    fs.writeFileSync(path.join(dir, 'otro.test.mjs'),
      `${CABECERA}const config = { fichero: 'x' + 'y', de: alguna, a: \`plantilla\`, cae: 1 };\n`
      + "const lista = [{ fichero: 'a' + 'b' }];\nexport const OTRA_COSA = [{ a: 'x' + 'y' }];\n"
      + `export const MUTACIONES_QUE_ME_TUMBAN = [\n${BUENA}];\n`);
    assert.deepEqual(declaracionesIlegibles(dir), [],
      '🔴 está marcando objetos que NO pretenden ser declaraciones. Marcar todo lo que no se '
      + 'entiende convierte el suelo en ruido, y el ruido se aprende a ignorar.');
    assert.equal(censoDeDeclaraciones(dir).reduce((n, c) => n + c.mutaciones.length, 0), 1,
      '🔴 y la declaración de verdad tiene que seguir contándose.');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('SCRUM-757 · un campo que FALTA de verdad se sigue diciendo, y aparte', () => {
  const b = banco("  { fichero: 'src/b.ts', de: 'P', cae: 'dos' },\n");
  try {
    const x = declaracionesIlegibles(b.dir)[0];
    assert.ok(x, '🔴 una declaración a la que le falta un campo ha dejado de denunciarse.');
    assert.deepEqual(x.faltan, ['a'], '🔴 no dice QUÉ campo falta.');
    assert.deepEqual(x.noEvaluables, [],
      '🔴 confunde «no está escrito» con «está y no lo sé leer»: son dos averías distintas y '
      + 'mandan a mirar a sitios distintos.');
  } finally { b.limpia(); }
});

// ═══ ④ LA FORMA SE FIJA · los cuatro campos, uno a uno ══════════════════════════════════════

test('SCRUM-757 · CUALQUIERA de los cuatro campos no evaluable se denuncia, no sólo `a`', () => {
  // El defecto se descubrió por `a`, pero el lector trata igual a los cuatro. Si mañana alguien
  // escribe `de:` concatenado, tiene que salir por la misma puerta.
  for (const campo of CAMPOS_DE_LA_DECLARACION) {
    const campos = { fichero: "'src/b.ts'", de: "'P'", a: "'Q'", cae: "'dos'" };
    campos[campo] = "'un' + 'o'";
    const cuerpo = `  { ${CAMPOS_DE_LA_DECLARACION.map((k) => `${k}: ${campos[k]}`).join(', ')} },\n`;
    const b = banco(cuerpo);
    try {
      const malas = declaracionesIlegibles(b.dir);
      assert.equal(malas.length, 1, `🔴 con \`${campo}\` concatenado no se denuncia nada.`);
      assert.deepEqual(malas[0].noEvaluables.map((n) => n.clave), [campo],
        `🔴 no señala el campo \`${campo}\` como el ilegible.`);
    } finally { b.limpia(); }
  }
});

test('SCRUM-757 · una PLANTILLA SIN SUSTITUCIONES sí se lee, y con sustitución NO', () => {
  // ═════════════════════════════════════════════════════════════════════════════════════════
  // 🔴 ESTO SE MIDIÓ AL ESCRIBIR EL TEST DE ARRIBA, y corrige lo que yo daba por hecho: el
  // primer caso usaba `` `plantilla` `` como ejemplo de «forma rara»… y salió VERDE, porque
  // `ts.isStringLiteralLike` **incluye** `NoSubstitutionTemplateLiteral`. O sea que las comillas
  // invertidas SIN `${}` ya eran legibles y siempre lo fueron.
  //
  // Se fija aquí porque es parte del contrato y nadie lo había escrito: lo que el lector acepta
  // no es «comillas simples», es «un literal de cadena, sin nada que evaluar dentro».
  // ═════════════════════════════════════════════════════════════════════════════════════════
  const sinSustitucion = banco('  { fichero: `src/b.ts`, de: `P`, a: `Q`, cae: `dos` },\n');
  try {
    assert.deepEqual(declaracionesIlegibles(sinSustitucion.dir), [],
      '🔴 una plantilla SIN sustituciones se denuncia, y es perfectamente evaluable: son los '
      + 'mismos bytes escritos con otras comillas.');
    assert.equal(censoDeDeclaraciones(sinSustitucion.dir)
      .reduce((n, c) => n + c.mutaciones.length, 0), 1);
  } finally { sinSustitucion.limpia(); }

  const conSustitucion = banco('  { fichero: `src/b.ts`, de: `P`, a: `Q${uno}`, cae: `dos` },\n');
  try {
    const malas = declaracionesIlegibles(conSustitucion.dir);
    assert.equal(malas.length, 1,
      '🔴 una plantilla CON sustitución no se puede evaluar sin ejecutar nada, y se está tirando '
      + 'en silencio.');
    assert.deepEqual(malas[0].noEvaluables.map((n) => n.clave), ['a']);
  } finally { conSustitucion.limpia(); }
});

test('SCRUM-757 · SUELO: el lector SIGUE leyendo un fichero sin declaraciones sin inventarse nada', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum757v-'));
  try {
    fs.writeFileSync(path.join(dir, 'vacio.test.mjs'), CABECERA);
    assert.deepEqual(censoDeDeclaraciones(dir), [],
      '🔴 un fichero sin declaraciones aparece en el censo.');
    assert.deepEqual(declaracionesIlegibles(dir), []);
    const l = lecturaDeDeclaraciones(CABECERA, 'vacio.test.mjs');
    assert.deepEqual(l, { buenas: [], incompletas: [] });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LAS MUTACIONES QUE ME TUMBAN (contrato de SCRUM-745)
// ⛔ `a` como LITERAL ÚNICO — sí, tiene gracia, y por eso mismo.
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El lector vuelve a tirar lo que no sabe leer: el agujero de SCRUM-757, tal cual.
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '          if (CAMPOS_DE_LA_DECLARACION.includes(clave)) {',
    a: '          if (false) {',
    cae: 'una declaración NO EVALUABLE se DENUNCIA con fichero y línea',
  },
  {
    // La denuncia pierde la línea: vuelve a mandar a buscar sin decir dónde.
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '        linea: lineaDe(el),',
    a: '        linea: 0,',
    cae: 'una declaración NO EVALUABLE se DENUNCIA con fichero y línea',
  },
  {
    // Se vuelven a confundir las dos averías: «no está» y «está y no lo sé leer».
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '            (k) => typeof m[k] !== \'string\' && !noEvaluables.some((x) => x.clave === k)),',
    a: '            (k) => typeof m[k] !== \'string\'),',
    cae: 'una declaración NO EVALUABLE se DENUNCIA con fichero y línea',
  },
  {
    // El suelo empieza a marcar objetos que no son declaraciones: ruido, y el ruido se ignora.
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: "        && n.name.text === 'MUTACIONES_QUE_ME_TUMBAN' && n.initializer",
    a: '        && n.initializer',
    cae: 'NEGATIVO: un objeto cualquiera del fichero NO se denuncia',
  },
];
