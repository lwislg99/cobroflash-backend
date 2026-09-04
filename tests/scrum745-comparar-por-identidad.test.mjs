// tests/scrum745-comparar-por-identidad.test.mjs — SCRUM-745
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// TRES GUARDS ESCRITOS EL MISMO DÍA NACIERON MUDOS, Y NINGUNA REVISIÓN LOS HABRÍA VISTO.
//
// Los tres comparaban por TEXTO en vez de por identidad:
//
//     if (!src.includes('leerSiSigueAhi')) …      // ← el import mantiene la palabra viva
//     if (/throw new Error/.test(cuerpo)) …       // ← `if (false)` lo deja escrito e inalcanzable
//
// El `import` y el comentario que EXPLICA la regla dejan el nombre en el fichero aunque la
// llamada haya desaparecido. Así que los guards seguían VERDES sobre el defecto que venían a
// vigilar. Se leen perfectamente bien: el defecto no se ve leyendo.
//
// 🔴 A LOS TRES LOS ENCONTRÓ LO MISMO: inyectar el defecto y exigir ver el rojo. Eso hoy depende
// de que a alguien se le ocurra hacerlo — y ése es el verdadero hallazgo, no los tres guards.
//
// ── ESTE FICHERO ES LA RED QUE CORRE SIEMPRE ────────────────────────────────────────────────
// La ejecución de las mutaciones vive en `npm run meta:mutaciones`, fuera de `npm test` porque
// arranca un subproceso por mutación (misma decisión que `censo:mudez` y los guards de
// navegador). Aquí se vigila lo barato: que el mecanismo esté, que sepa leer, y el censo de la
// superficie de riesgo.
//
// ── 🔴 EL CENSO NO PUEDE HACERSE POR TEXTO ──────────────────────────────────────────────────
// Sería el defecto midiéndose a sí mismo: un `grep` de `includes(` casaría esta misma cabecera.
// Se hace por AST, y por lo que el código HACE — una llamada a `.includes()` con un literal que
// es un identificador, sobre una variable que trae el FUENTE de un fichero.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url'; // SCRUM-730
import ts from 'typescript';
import { mutacionesDeclaradas, censoDeDeclaraciones } from '../scripts/meta-guard-mutaciones.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_TESTS = path.join(RAIZ, 'tests');
const ES_IDENTIFICADOR = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① EL LECTOR DE DECLARACIONES · suelo y control negativo
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-745 · SUELO: el lector VE una declaración de verdad, sin ejecutar el fichero', () => {
  const ejemplo = `
    export const MUTACIONES_QUE_ME_TUMBAN = [
      { fichero: 'tests/x.test.mjs', de: 'a', a: 'b', cae: 'el test que cae' },
    ];`;
  const m = mutacionesDeclaradas(ejemplo);
  assert.equal(m.length, 1, '🔴 CIEGO: el lector no ve una declaración bien formada.');
  assert.deepEqual(m[0], { fichero: 'tests/x.test.mjs', de: 'a', a: 'b', cae: 'el test que cae' });
});

test('SCRUM-745 · 🔴 CONTROL NEGATIVO: una declaración INCOMPLETA no se cuenta como buena', () => {
  // Media declaración es peor que ninguna: pareceria cobertura y no ejecutaria nada.
  const sinCae = "export const MUTACIONES_QUE_ME_TUMBAN = [{ fichero: 'x', de: 'a', a: 'b' }];";
  assert.deepEqual(mutacionesDeclaradas(sinCae), [],
    '🔴 una declaración sin `cae` se está aceptando: no habría forma de saber qué debe ponerse rojo.');
  // Y un fichero que sólo MENCIONA el nombre en un comentario no declara nada.
  assert.deepEqual(mutacionesDeclaradas('// aquí iría MUTACIONES_QUE_ME_TUMBAN algún día'), [],
    '🔴 un comentario se está leyendo como una declaración.');
});

test('SCRUM-745 · SUELO: hay al menos un guard declarando de verdad en el árbol', () => {
  const censo = censoDeDeclaraciones(DIR_TESTS);
  assert.ok(censo.length >= 1,
    '🔴 CIEGO: ningún guard declara mutaciones. `npm run meta:mutaciones` no mediría nada y '
    + 'saldría con su código 2 — pero este fichero pasaría en verde y nadie se enteraría.');
  const total = censo.reduce((t, g) => t + g.mutaciones.length, 0);
  assert.ok(total >= 2, `🔴 sólo ${total} mutaciones declaradas en todo el árbol.`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② EL MECANISMO ESTÁ, Y SE PUEDE EJECUTAR
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-745 · el meta-guard existe y está declarado en package.json', () => {
  assert.ok(fs.existsSync(path.join(RAIZ, 'scripts', 'meta-guard-mutaciones.mjs')),
    '🔴 el script no está: la declaración de mutaciones sería documentación, no mecanismo.');
  const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts['meta:mutaciones'],
    '🔴 no se puede ejecutar desde `npm run`. `package.json` es la AUTORIDAD de lo que existe '
    + '(SCRUM-548): un guard que no figura ahí no lo corre nadie.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ EL CENSO · la superficie donde este defecto puede vivir
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * Sitios donde se pregunta por un IDENTIFICADOR con `.includes()` sobre el FUENTE de un fichero.
 *
 * 🔴 POR LO QUE HACE: se rastrea qué variables reciben el texto de un fichero y sólo se cuentan
 * las llamadas cuyo receptor es una de ellas. Contar todos los `.includes('algo')` daría 214 y
 * la mayoría son legítimos —comprobar que un rótulo aparece en una pantalla no es este defecto—.
 *
 * ⚠️ ES UNA SUPERFICIE DE RIESGO, NO UNA LISTA DE DEFECTOS. Preguntar por un identificador sobre
 * un fuente es correcto cuando lo que se afirma es «este nombre aparece»; es defectuoso cuando lo
 * que se quiere afirmar es «este nombre SE USA», porque el import y los comentarios lo mantienen
 * vivo. Esa diferencia está en la INTENCIÓN del guard y no se puede leer del código, así que este
 * censo no la juzga: la acota y deja el número a la vista.
 */
function preguntasPorTextoSobreFuente(codigo, nombre = 'x.mjs') {
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const fuentes = new Set();
  const rec = (n) => {
    if (ts.isVariableDeclaration(n) && n.name && ts.isIdentifier(n.name) && n.initializer) {
      if (/readFileSync\(|leerFuente\(|soloEjecutable\(/.test(n.initializer.getText(sf))) {
        fuentes.add(n.name.text);
      }
    }
    ts.forEachChild(n, rec);
  };
  rec(sf);

  const out = [];
  const v = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && n.expression.name.text === 'includes') {
      const recep = n.expression.expression;
      const a = n.arguments[0];
      const sobreFuente = (ts.isIdentifier(recep) && fuentes.has(recep.text))
        || /readFileSync\(/.test(recep.getText(sf));
      if (sobreFuente && a && ts.isStringLiteralLike(a)
          && ES_IDENTIFICADOR.test(a.text) && a.text.length >= 4) {
        out.push({ linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, literal: a.text });
      }
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  return out;
}

test('SCRUM-745 · SUELO: el detector del censo sabe encontrar y sabe decir que NO', () => {
  const malo = "const src = fs.readFileSync(f, 'utf8');\nif (src.includes('miFuncion')) ok();";
  assert.equal(preguntasPorTextoSobreFuente(malo).length, 1,
    '🔴 CIEGO: no ve la forma exacta que viene a contar. Su número no significaría nada.');

  // CONTROL NEGATIVO, tres formas que NO son este defecto:
  const buenos = [
    // (a) `.includes` sobre una LISTA, no sobre un fuente
    "const nombres = ['a','b'];\nif (nombres.includes('miFuncion')) ok();",
    // (b) sobre un fuente, pero preguntando por una FRASE (no un identificador)
    "const src = fs.readFileSync(f, 'utf8');\nif (src.includes('Nuevo cliente')) ok();",
    // (c) por identidad, que es el arreglo
    "const src = fs.readFileSync(f, 'utf8');\nif (llamadasA(src, 'miFuncion') > 0) ok();",
  ];
  for (const b of buenos) {
    assert.deepEqual(preguntasPorTextoSobreFuente(b), [],
      `🔴 FALSO POSITIVO: el censo acusa a una forma legítima:\n${b}`);
  }
});

/**
 * CENSO MEDIDO el 4-sep-2026 sobre `origin/main` = a84680db458feb0db41fdd63e227bb22ea012daf.
 *
 * **29 sitios en 24 ficheros**, sobre una población de 649 ficheros de test. La cota bruta —todo
 * `.includes('<identificador>')`, sin exigir que el receptor sea un fuente— era **214 en 125**.
 *
 * No se congela la lista: se vigila que el detector siga VIENDO. Un trinquete sobre el número
 * obligaría a tocar este fichero en cada PR que añada un guard legítimo, y un guard que estorba
 * en cada PR acaba desactivado (la lección de SCRUM-402).
 */
const SUPERFICIE_MEDIDA = 29;

test('SCRUM-745 · 🔴 el censo de la superficie de riesgo, con su población', () => {
  const ficheros = fs.readdirSync(DIR_TESTS).filter((f) => f.endsWith('.test.mjs'));
  assert.ok(ficheros.length >= 500,
    `🔴 CIEGO: sólo ${ficheros.length} ficheros de test. El censo daría un número pequeño por no mirar.`);

  let sitios = 0;
  const conRiesgo = [];
  for (const f of ficheros) {
    const n = preguntasPorTextoSobreFuente(fs.readFileSync(path.join(DIR_TESTS, f), 'utf8'), f).length;
    if (n) { sitios += n; conRiesgo.push(f); }
  }
  // El detector tiene que seguir viendo la superficie que se midió. Si cae a cero, es que dejó de
  // reconocer la forma — no que la casa se haya limpiado sola.
  assert.ok(sitios >= 10,
    `🔴 el censo ve ${sitios} sitios y se midieron ${SUPERFICIE_MEDIDA}. Una caída así no es una `
    + 'limpieza: es el detector que dejó de reconocer la forma que cuenta.');
  assert.ok(conRiesgo.length >= 5, `🔴 sólo ${conRiesgo.length} ficheros con la forma: detector ciego.`);
});
