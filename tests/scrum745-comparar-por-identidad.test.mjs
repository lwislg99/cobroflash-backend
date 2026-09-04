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

  const esFuente = (nodo) => (ts.isIdentifier(nodo) && fuentes.has(nodo.text))
    || /readFileSync\(/.test(nodo.getText(sf));

  const out = [];
  const v = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const metodo = n.expression.name.text;
      const recep = n.expression.expression;
      const a = n.arguments[0];

      // ── forma ① · <fuente>.includes('<identificador>')
      if (metodo === 'includes' && esFuente(recep) && a && ts.isStringLiteralLike(a)
          && ES_IDENTIFICADOR.test(a.text) && a.text.length >= 4) {
        out.push({ linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, forma: 'includes', literal: a.text });
      }

      // ── forma ② · /<literal>/.test(<fuente>)   ← SCRUM-745 FASE B
      //
      // La otra mitad de la misma superficie, y la que me mordió a mí: mi segundo trinquete mudo
      // era `/throw new Error/.test(cuerpo)`, que sobrevive a que el `throw` quede INALCANZABLE
      // dentro de un `if (false)`.
      //
      // 🔴 EL CRITERIO NO PUEDE SER «EL PATRÓN ES UN IDENTIFICADOR»: `throw new Error` lleva
      // espacios y se habría escapado — el defecto que motivó la fase B no lo habría cazado su
      // propio censo. Lo que define la forma es que el patrón sea **literal puro**, sin ningún
      // metacarácter: eso es preguntar por texto. Una regex con estructura (`^\d+$`, `\bfoo\b`)
      // está midiendo otra cosa y no entra.
      if (metodo === 'test' && ts.isRegularExpressionLiteral(recep) && a && esFuente(a)) {
        const cuerpo = recep.text.replace(/^\/|\/[gimsuy]*$/g, '');
        if (!/[\\^$.*+?()[\]{}|]/.test(cuerpo) && cuerpo.trim().length >= 4) {
          out.push({ linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, forma: 'regex', literal: cuerpo });
        }
      }
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  return out;
}

test('SCRUM-745 · SUELO: el detector del censo sabe encontrar LAS DOS FORMAS', () => {
  const conIncludes = "const src = fs.readFileSync(f, 'utf8');\nif (src.includes('miFuncion')) ok();";
  const h1 = preguntasPorTextoSobreFuente(conIncludes);
  assert.equal(h1.length, 1, '🔴 CIEGO: no ve la forma `includes`. Su número no significaría nada.');
  assert.equal(h1[0].forma, 'includes');

  // FASE B · y las dos variantes de la forma con regex, incluida la que me mordió a mí.
  const conRegex = "const src = fs.readFileSync(f, 'utf8');\nif (/miFuncion/.test(src)) ok();";
  const h2 = preguntasPorTextoSobreFuente(conRegex);
  assert.equal(h2.length, 1, '🔴 CIEGO: no ve la forma `/literal/.test(fuente)`.');
  assert.equal(h2[0].forma, 'regex');

  // 🔴 EL CASO QUE MOTIVÓ LA FASE B: patrón con ESPACIOS. Si el criterio fuera «es un
  // identificador», este defecto real se escaparía de su propio censo.
  const elMio = "const cuerpo = fs.readFileSync(f, 'utf8');\nif (/throw new Error/.test(cuerpo)) ok();";
  assert.equal(preguntasPorTextoSobreFuente(elMio).length, 1,
    '🔴 el censo no caza `/throw new Error/` — que fue exactamente uno de los tres trinquetes '
    + 'mudos. Un censo que no ve el defecto que lo originó no vale.');

  // CONTROL NEGATIVO, cinco formas que NO son este defecto:
  const buenos = [
    // (a) `.includes` sobre una LISTA, no sobre un fuente
    "const nombres = ['a','b'];\nif (nombres.includes('miFuncion')) ok();",
    // (b) sobre un fuente, pero preguntando por una FRASE (no un identificador)
    "const src = fs.readFileSync(f, 'utf8');\nif (src.includes('Nuevo cliente')) ok();",
    // (c) por identidad, que es el arreglo
    "const src = fs.readFileSync(f, 'utf8');\nif (llamadasA(src, 'miFuncion') > 0) ok();",
    // (d) una regex CON ESTRUCTURA: mide una forma, no pregunta por un nombre
    "const src = fs.readFileSync(f, 'utf8');\nif (/^\\s*#!\\/bin/.test(src)) ok();",
    // (e) una regex literal, pero NO sobre un fuente de fichero
    "if (/miFuncion/.test(nombreDelBoton)) ok();",
  ];
  for (const b of buenos) {
    assert.deepEqual(preguntasPorTextoSobreFuente(b), [],
      `🔴 FALSO POSITIVO: el censo acusa a una forma legítima:\n${b}`);
  }
});

/**
 * CENSO MEDIDO el 4-sep-2026 sobre `origin/main` = a84680db458feb0db41fdd63e227bb22ea012daf.
 *
 * | forma | sitios |
 * |---|---:|
 * | ① `<fuente>.includes('<identificador>')` | **24** |
 * | ② `/<literal>/.test(<fuente>)` — FASE B | **51** |
 * | **total** | **75**, en **52** ficheros |
 *
 * Población: **650** ficheros de test. La cota bruta —todo `.includes('<identificador>')`, sin
 * exigir que el receptor sea un fuente— era **214 en 125**.
 *
 * 🔴 **LA MITAD QUE FALTABA ERA LA MAYOR:** 51 contra 24. La fase A cerró el ticket midiendo sólo
 * `includes` y declarándolo; de haberlo dado por completo, dos tercios de la superficie habrían
 * quedado fuera con el número puesto — que es peor que no tener número.
 *
 * ⚠️ Y LA CIFRA DE LA FASE A SE CORRIGE: se publicó **29** para la forma ①. Eran 24. La primera
 * medición usó un detector que además contaba `leer(` como origen de fuente; éste mira sólo
 * `readFileSync`, `leerFuente` y `soloEjecutable`. Mismo criterio en las dos formas, y el número
 * que vale es el de aquí.
 *
 * No se congela la lista: se vigila que el detector siga VIENDO. Un trinquete sobre el número
 * obligaría a tocar este fichero en cada PR que añada un guard legítimo, y un guard que estorba
 * en cada PR acaba desactivado (la lección de SCRUM-402).
 */
const SUPERFICIE_MEDIDA = 75;

test('SCRUM-745 · 🔴 el censo de la superficie de riesgo, con su población', () => {
  const ficheros = fs.readdirSync(DIR_TESTS).filter((f) => f.endsWith('.test.mjs'));
  assert.ok(ficheros.length >= 500,
    `🔴 CIEGO: sólo ${ficheros.length} ficheros de test. El censo daría un número pequeño por no mirar.`);

  let sitios = 0;
  const conRiesgo = [];
  const porForma = { includes: 0, regex: 0 };
  for (const f of ficheros) {
    const hs = preguntasPorTextoSobreFuente(fs.readFileSync(path.join(DIR_TESTS, f), 'utf8'), f);
    if (hs.length) { sitios += hs.length; conRiesgo.push(f); }
    for (const h of hs) porForma[h.forma] += 1;
  }
  // El detector tiene que seguir viendo la superficie que se midió. Si cae a cero, es que dejó de
  // reconocer la forma — no que la casa se haya limpiado sola.
  assert.ok(sitios >= 30,
    `🔴 el censo ve ${sitios} sitios y se midieron ${SUPERFICIE_MEDIDA}. Una caída así no es una `
    + 'limpieza: es el detector que dejó de reconocer la forma que cuenta.');
  assert.ok(conRiesgo.length >= 20, `🔴 sólo ${conRiesgo.length} ficheros con la forma: detector ciego.`);

  // 🔴 Y LAS DOS FORMAS POR SEPARADO. Un total sano puede esconder que una de las dos ramas del
  // detector se quedó muda: con 51 sitios de regex, la de `includes` podría caer a cero y el
  // número seguiría pareciendo grande. Es la lección del censo por fichero de SCRUM-402.
  assert.ok(porForma.includes >= 10,
    `🔴 la rama \`includes\` del detector ve ${porForma.includes}: se ha quedado muda.`);
  assert.ok(porForma.regex >= 20,
    `🔴 la rama \`regex\` del detector ve ${porForma.regex}: se ha quedado muda — y es la MAYOR `
    + 'de las dos, así que su silencio se notaría menos en el total.');
});
