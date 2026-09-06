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
import {
  mutacionesDeclaradas, censoDeDeclaraciones, lecturaDeDeclaraciones,
  cayo, paso, // SCRUM-748: los dos veredictos, que dejaron de ser el mismo
} from '../scripts/meta-guard-mutaciones.mjs';

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

test('SCRUM-745 · 🔴 una declaración INCOMPLETA se DENUNCIA, no se descarta en silencio', () => {
  // 🔴 PROVOCADO, NO IMAGINADO (5-sep-2026). Editando este mismo árbol perdí la línea `fichero:`
  // de una declaración ya escrita. El lector la descartó, el censo pasó de 17 a 16 y
  // `meta:mutaciones` siguió VERDE: la mutación había dejado de ejecutarse y nada lo dijo. Eso es
  // literalmente «media declaración parece cobertura», el defecto que este mecanismo vino a cerrar,
  // cometido dentro del mecanismo.
  const coja = "export const MUTACIONES_QUE_ME_TUMBAN = [{ de: 'a', a: 'b', cae: 'c' }];";
  const r = lecturaDeDeclaraciones(coja);
  assert.deepEqual(r.buenas, [], '🔴 una declaración sin `fichero` se está aceptando como buena.');
  assert.equal(r.incompletas.length, 1,
    '🔴 la declaración coja se DESCARTA sin dejar rastro. El recuento del job bajaría solo y el '
    + 'verde de al lado se leería como si esa mutación se siguiera ejecutando.');
  assert.deepEqual(r.incompletas[0].faltan, ['fichero'],
    '🔴 la denuncia no dice QUÉ falta: sin eso hay que buscarlo a mano, y la prisa lo salta.');

  // Y el complementario, que es lo que convierte esto en un dato: HOY el árbol no tiene ninguna.
  // El cero vale porque el instrumento acaba de enseñar que sabe encontrar una.
  const censo = censoDeDeclaraciones(DIR_TESTS);
  const cojas = censo.flatMap((g) => (g.incompletas || []).map((i) => `${g.guard}: faltan ${i.faltan.join(', ')}`));
  assert.deepEqual(cojas, [], '🔴 hay declaraciones incompletas en el árbol:\n   · ' + cojas.join('\n   · '));
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

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ SCRUM-748 · «NO CAYÓ» Y «NO SE EJECUTÓ» NO SON LO MISMO
//
// El meta-guard llamaba MUDO a todo lo que no caía, y con eso ACUSÓ EN CI a un guard sano:
// `scrum748` moría entero al cargar —el job no compilaba y su banco de vistas necesita `dist/`—
// así que su `✖ <nombre>` no se imprimía nunca. «No lo encuentro» se leyó como «no cayó».
//
// 🔴 Y NO SE ARREGLÓ RECONOCIENDO EL MENSAJE DE ERROR: eso es una lista negra, y sólo sabe decir
// que no a lo que le enseñaron. Se arregló por LÍNEA BASE — si el test no sale EN VERDE en la
// pasada limpia, no hay nada que juzgar y ni siquiera se muta.
//
// Lo de abajo vigila los DOS lectores por separado, porque el veredicto entero cuelga de que no
// se confundan.
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * Lo que devuelve `correr()`: los nombres de los tests que PASARON y los que CAYERON. No es texto
 * de ningún reporter — son los eventos `test:pass` / `test:fail` de `run()`, que es lo que dejó
 * de poder quedarse ciego (SCRUM-745, adopción).
 */
const RESULTADO_MIXTO = {
  pasados: ['SCRUM-x · el que pasa'],
  caidos: ['SCRUM-x · el que falla'],
};

/**
 * Lo que devuelve cuando el FICHERO no llega a cargar.
 *
 * 🔴 MEDIDO EL 5-SEP-2026, PROVOCÁNDOLO — no imaginado. Se hizo morir un fichero de test contra un
 * `import` inexistente y `run()` emitió **exactamente un** `test:fail` cuyo `name` es la RUTA DEL
 * FICHERO. Ni un nombre de test, en ningún lado. De ahí que los dos lectores digan NO, que es la
 * conjunción de la que nace el veredicto CIEGO.
 */
const RESULTADO_FICHERO_MUERTO = {
  pasados: [],
  caidos: ['C:/x/cobroflash/tests/scrum748-no-lo-se-no-es-al-dia.test.mjs'],
};

test('SCRUM-745/748 · SUELO: `paso` y `cayo` distinguen verde de rojo, y no se confunden', () => {
  assert.equal(paso(RESULTADO_MIXTO, 'el que pasa'), true, '🔴 `paso` no ve un verde.');
  assert.equal(cayo(RESULTADO_MIXTO, 'el que falla'), true, '🔴 `cayo` no ve un rojo.');
  // Y cruzados: el verde no es un rojo ni al revés. Si esto se confundiera, el veredicto se
  // invertiría entero y todo saldría al revés sin que nada avisara.
  assert.equal(cayo(RESULTADO_MIXTO, 'el que pasa'), false, '🔴 `cayo` cuenta un VERDE como caída.');
  assert.equal(paso(RESULTADO_MIXTO, 'el que falla'), false, '🔴 `paso` cuenta un ROJO como verde.');
});

test('SCRUM-745/748 · 🔴 con el FICHERO MUERTO, ni pasó ni cayó — y ahí nace el CIEGO', () => {
  // Éste es el caso que produjo la acusación falsa en CI. Los dos lectores tienen que decir NO:
  // es la conjunción «no pasó y no cayó» la que separa «no se ejecutó» de «no cayó».
  assert.equal(paso(RESULTADO_FICHERO_MUERTO, 'el que pasa'), false,
    '🔴 se lee como verde un test que no llegó a existir.');
  assert.equal(cayo(RESULTADO_FICHERO_MUERTO, 'el que pasa'), false,
    '🔴 se lee como caída un test que no llegó a existir: ESA es la acusación falsa.');
  // 🔴 Y el nombre que SÍ trae el fichero muerto es su RUTA. Preguntar por ella da rojo, y eso no
  // es un fallo: es la prueba de que el único `test:fail` de un fichero muerto NO es un test.
  assert.equal(cayo(RESULTADO_FICHERO_MUERTO, 'scrum748-no-lo-se-no-es-al-dia.test.mjs'), true,
    '🔴 SUELO: la sonda no ve ni el único evento que hay; entonces los dos NO de arriba no '
    + 'significan «no está», significan «no supe mirar».');
});

test('SCRUM-745/748 · 🔴 el meta-guard mira la LÍNEA BASE, y NO reconoce mensajes de error', () => {
  const src = fs.readFileSync(path.join(RAIZ, 'scripts', 'meta-guard-mutaciones.mjs'), 'utf8');
  const sf = ts.createSourceFile('m.mjs', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

  // ① Consulta la línea base ANTES de decidir: por llamada, no por mención (lección de SCRUM-740).
  let consultaLaBase = 0;
  const v = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'paso') {
      consultaLaBase += 1;
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  assert.ok(consultaLaBase >= 1,
    '🔴 el meta-guard ya no consulta la pasada limpia. Sin línea base vuelve a confundir «no se '
    + 'ejecutó» con «no cayó», y a acusar a guards sanos.');

  // ② 🔴 Y NO se cuela una lista negra de mensajes. Se mira el CÓDIGO desnudo, porque el
  // comentario que explica la prohibición CITA el mensaje que prohíbe reconocer (SCRUM-203).
  const desnudo = src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');
  assert.ok(desnudo.includes('function aplicarUna'), '🔴 el desnudado se llevó el código por delante.');
  for (const cadena of ['Cannot find module', 'MODULE_NOT_FOUND', 'SyntaxError']) {
    assert.equal(desnudo.includes(cadena), false,
      `🔴 el meta-guard reconoce el mensaje «${cadena}». Un detector de mensajes sólo sabe decir `
      + 'que no a lo que le enseñaron: el primer fallo que nadie previó vuelve a salir MUDO.');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ⑤ SCRUM-745 (adopción) · EL VIGILANTE Y SU CONTROL YA NO CUELGAN DEL MISMO CLAVO
//
// `paso()` y `cayo()` leían los dos el reporter `spec`. Cambiar `--test-reporter` en `correr()`
// los dejaba CIEGOS A LA VEZ: un detector y su control con un punto de fallo común, que es el
// defecto de SCRUM-742 dentro de la herramienta que lo persigue.
//
// 🔴 NO SE VIGILA LA CONSTANTE DEL REPORTER: SE QUITA EL REPORTER. El escalón manda —hacerlo
// imposible antes que derivar, y derivar antes que duplicar con guard—, y aquí el escalón 1
// estaba disponible: `run()` de `node:test` entrega eventos con el nombre del test dentro. Este
// test es el trinquete que impide volver atrás sin darse cuenta.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-745 · 🔴 los dos lectores NO cuelgan de ningún reporter', () => {
  const src = fs.readFileSync(path.join(RAIZ, 'scripts', 'meta-guard-mutaciones.mjs'), 'utf8');
  const desnudo = src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');

  // 🔴 SUELO, Y NO ES ADORNO: los tres asserts de abajo son NEGACIONES, y una negación sobre un
  // fuente vacío pasa sola (SCRUM-719). El desnudado se lleva por delante toda la prosa que
  // EXPLICA el reporter —que nombra `--test-reporter` para prohibirlo—, así que hay que
  // comprobar que no se ha llevado también el código.
  assert.ok(desnudo.includes('async function correr'),
    '🔴 el desnudado se comió el código: lo de abajo no estaría mirando nada.');

  assert.equal(/test-reporter/.test(desnudo), false,
    '🔴 el meta-guard vuelve a nombrar un reporter en su CÓDIGO. Con eso `paso` y `cayo` vuelven a '
    + 'colgar del mismo clavo: quien lo cambie los ciega a los dos a la vez y el veredicto entero '
    + 'se apaga en silencio.');
  assert.equal(/spawnSync/.test(desnudo), false,
    '🔴 ha vuelto el subproceso a mano. Su salida es TEXTO, y leer texto de un reporter es '
    + 'justamente el acoplamiento que este trinquete cierra.');

  // Y el positivo: que de verdad pide los eventos, que es de donde sale el dato.
  assert.ok(desnudo.includes('test:pass') && desnudo.includes('test:fail'),
    '🔴 ya no se leen los eventos del runner: entonces el veredicto sale de otro sitio y este '
    + 'trinquete no sabe de dónde.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-748 · LAS MUTACIONES DE ESTE GUARD — el que juzga a los demás, el primero
// ═════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El defecto original: dictar el veredicto sin mirar la línea base.
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  if (!paso(limpia, mut.cae)) {',
    a: '  if (false) {',
    cae: 'el meta-guard mira la LÍNEA BASE, y NO reconoce mensajes de error',
  },
  {
    // Y la otra mitad: que `paso` deje de distinguir un verde de una ausencia — con eso, un
    // fichero muerto volvería a parecer que se ejecutó, y el CIEGO se convertiría otra vez en
    // una acusación.
    //
    // ⚠️ EL ANCLA VA SIN BARRAS INVERTIDAS A PROPÓSITO. El primer intento ancló en la línea de
    // `cayo`, que lleva una regex, y el s perdió su barra por el camino hasta el fichero: el
    // ancla no casaba con nada. Lo cazó ESTE MISMO meta-guard diciendo CIEGO —«la declaración
    // caducó»— en vez de acusar al guard. Es exactamente la distinción que SCRUM-748 vino a
    // arreglar, probándose a sí misma con su propio defecto.
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: 'export function paso(resultado, nombre) {',
    a: 'export function paso(resultado, nombre) {\n  return true;',
    cae: 'con el FICHERO MUERTO, ni pasó ni cayó',  },
  {
    // SCRUM-745 (adopción) · Y LA TERCERA: que el reporter VUELVA. Es el acoplamiento entero
    // reconstruido — en cuanto el código nombra un reporter, `paso` y `cayo` vuelven a tener un
    // punto de fallo común, y quien lo cambie los apaga a los dos sin que nada avise.
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '    forceExit: true,',
    a: "    forceExit: true,\n    reporterQueVuelveAColgarDelMismoClavo: '--test-reporter=spec',",
    cae: 'los dos lectores NO cuelgan de ningún reporter',
  },
  {
    // SCRUM-745 (adopción) · Y LA CUARTA: que la declaración coja vuelva a caerse por el agujero
    // sin ruido. Es el defecto provocado el 5-sep-2026 —perder un campo de una declaración ya
    // escrita— devuelto a su sitio: el lector la descarta, el recuento baja solo y el job sigue
    // verde sobre una mutación que ha dejado de ejecutarse.
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '        else incompletas.push({ faltan: ',
    a: '        else if (false) incompletas.push({ faltan: ',
    cae: 'una declaración INCOMPLETA se DENUNCIA, no se descarta en silencio',
  },
];
