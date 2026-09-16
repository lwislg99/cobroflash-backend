// tests/scrum784-el-cuarto-veredicto.test.mjs — SCRUM-784
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL META-GUARD NO DISTINGUÍA «ESTE TEST NO CAYÓ» DE «NO HUBO TEST».
//
// `cayo(resultado, nombre)` busca el nombre declarado entre los caídos. Cuando el RADIO de una
// mutación mata el fichero entero, `node:test` emite **un solo** `test:fail` cuyo `name` es **LA
// RUTA del fichero**, no el nombre de un test. `cayo()` no lo encontraba y el meta-guard dictaba
// **MUDO** —«pasa en verde sobre el defecto que dice vigilar»— sobre un guard que SÍ se puso rojo.
//
// Las TRES formas, medidas el 6-sep-2026 con el mismo guard y la misma línea mutada:
//
//     A · sin mutar .................... pasados 7 · caídos 0
//     B · un test cae, el fichero VIVE . pasados 4 · caídos 3   ← los tres son NOMBRES de test
//     C · el fichero MUERE ............. pasados 0 · caídos 1   ← el caído es LA RUTA del fichero
//
// ── POR QUÉ NO LO TAPABA SCRUM-748 ──────────────────────────────────────────────────────────
// Aquella cerró el fichero que muere en la PASADA LIMPIA (PUERTA 1: sin el test en verde, no se
// muta). Aquí la línea base está VERDE —7 pasados— y el fichero muere DESPUÉS de mutar.
//
// ⛔ Y LO QUE ESTE GUARD TAMBIÉN VIGILA: que el arreglo NO se haya hecho relajando `cayo()`. Un
// `cayo()` que aceptara cualquier fallo como caída convertiría el instrumento en un sello de goma,
// que es justo lo contrario del ticket.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { cayo, murioElFichero, paso } from '../scripts/meta-guard-mutaciones.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const YO = 'scrum784-el-cuarto-veredicto.test.mjs';
const RUTA_YO = path.join(RAIZ, 'tests', YO);

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ① EL DETECTOR · las tres formas, y la que decide provocada
// ─────────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-784 · 🔴 un caído que es LA RUTA del fichero es una MUERTE, no un silencio', () => {
  // C · el caso del ticket: `node:test` no reporta ni un nombre de test.
  assert.equal(murioElFichero({ pasados: [], caidos: [RUTA_YO] }, YO), true,
    '🔴 el fichero murió al mutar y el meta-guard no lo ve: dictaría MUDO sobre un guard que SÍ '
    + 'se puso rojo. Es la falsa acusación de SCRUM-784.');

  // B · CONTROL NEGATIVO, y es el que decide que esto sirva: con el fichero VIVO y tests caídos,
  // esto NO puede dispararse. Si se disparara, toda mutación que tumba un test se leería como
  // muerte de fichero y el veredicto perdería sentido.
  assert.equal(murioElFichero({
    pasados: ['SCRUM-784 · otro'],
    caidos: ['SCRUM-784 · 🔴 un caído que es LA RUTA del fichero es una MUERTE, no un silencio'],
  }, YO), false,
    '🔴 un NOMBRE de test se está leyendo como la ruta del fichero.');

  // A · sin caídos no hay nada que interpretar.
  assert.equal(murioElFichero({ pasados: ['x'], caidos: [] }, YO), false);

  // Y la ruta de OTRO fichero tampoco: la pregunta es si murió ESTE guard.
  assert.equal(murioElFichero({ caidos: [path.join(RAIZ, 'tests', 'utils.test.mjs')] }, YO), false,
    '🔴 la muerte de otro fichero se está atribuyendo a este guard.');
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 ESTE CASO SE PARTIÓ EN DOS PORQUE UNA MITAD NO EXISTE EN TODAS PARTES.
 *
 * La primera versión exigía que `C:\…` y `c:\…` fueran DISTINTAS antes de normalizar. En el
 * runner de Linux **no hay letra de unidad**, así que `toLowerCase()` sobre el primer carácter no
 * cambia nada, las dos rutas son idénticas y el `assert.notEqual` de partida REVENTABA:
 *
 *     actual:   '/home/runner/work/…/scrum784-el-cuarto-veredicto.test.mjs'
 *     expected: '/home/runner/work/…/scrum784-el-cuarto-veredicto.test.mjs'
 *     operator: 'notStrictEqual'
 *
 * Es la misma familia que la puerta de SCRUM-765: **el instrumento que se escribe para probar algo
 * también tiene plataforma.** Reproducido antes de tocar nada, con la ruta del runner:
 *
 *     WINDOWS  primer carácter "C"  → bajada distinta → el aserto se cumple
 *     LINUX    primer carácter "/"  → bajada IDÉNTICA → 🔴 revienta
 *
 * ── POR QUÉ DOS MITADES Y NO UNA PORTABLE ───────────────────────────────────────────────────
 * Medido: lo que `realpathSync.native` añade sobre `realpathSync` es exactamente la unidad
 * (`normaliza? false` vs `true`), y una letra de unidad **no existe** donde no la hay. No se puede
 * inventar un equivalente sin inventarse el caso.
 *
 * Lo que SÍ existe en las dos plataformas es un ENLACE de directorio, y discrimina lo que de
 * verdad sostiene el detector — comparar la ruta RESUELTA en vez del texto. Medido:
 *
 *     por el enlace vs la real →  path.resolve iguala? false   ← discrimina
 *                                 realpath     iguala? true
 *                                 .native      iguala? true
 *
 * Así que la mitad portable CORRE SIEMPRE y lleva la mutación declarada; la mitad de la unidad
 * corre donde existe y, donde no, **lo dice por pantalla**. ⛔ Sin `skip` silencioso: un test que
 * en Linux no corre y no lo dice es un hueco con cara de verde.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
const TIENE_UNIDAD = /^[a-zA-Z]:/.test(RUTA_YO);

test('SCRUM-784 · 🔴 la ruta se compara RESUELTA, no por texto', (t) => {
  // ── MITAD PORTABLE: a través de un enlace, la misma ruta escrita de otra forma ──────────────
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum784-'));
  try {
    const enlace = path.join(tmp, 'repo');
    try {
      fs.symlinkSync(RAIZ, enlace, TIENE_UNIDAD ? 'junction' : 'dir');
    } catch (e) {
      assert.fail('🔴 CIEGO: no he podido crear el enlace, así que NO he probado nada. No es un '
        + `verde: es que no he medido. (${e.code}: ${e.message})`);
    }
    const porElEnlace = path.join(enlace, 'tests', YO);

    // SUELO: si las dos rutas ya fueran iguales como TEXTO, este caso no distinguiría nada.
    assert.notEqual(path.resolve(porElEnlace), path.resolve(RUTA_YO),
      '🔴 el enlace no cambia el texto de la ruta: este caso no discrimina comparar por texto de '
      + 'comparar resuelto, y su verde no significaría nada.');

    assert.equal(murioElFichero({ caidos: [porElEnlace] }, YO), true,
      '🔴 la misma ruta alcanzada por un enlace se lee como otro fichero. El detector está '
      + 'comparando TEXTO, y con eso una muerte real vuelve a salir MUDA.');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  // ── MITAD QUE SÓLO EXISTE DONDE HAY LETRA DE UNIDAD ────────────────────────────────────────
  if (!TIENE_UNIDAD) {
    t.diagnostic('NO APLICA en esta plataforma: la ruta empieza por '
      + JSON.stringify(RUTA_YO.charAt(0)) + ' y no tiene letra de unidad, así que el caso de la '
      + 'unidad en minúscula NO EXISTE aquí. La mitad portable (el enlace) SÍ ha corrido.');
    return;
  }
  const enMinuscula = RUTA_YO.charAt(0).toLowerCase() + RUTA_YO.slice(1);
  assert.notEqual(enMinuscula, RUTA_YO,
    '🔴 hay letra de unidad y aun así las dos rutas salen iguales: el caso no prueba nada.');
  assert.equal(murioElFichero({ caidos: [enMinuscula] }, YO), true,
    '🔴 la misma ruta con la unidad en minúscula se lee como otro fichero. `realpathSync` CONSERVA '
    + 'la unidad y `realpathSync.native` la NORMALIZA: se ha vuelto a la primera.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ② ⛔ EL ARREGLO NO PUEDE SER RELAJAR `cayo()`
// ─────────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-784 · ⛔ `cayo()` sigue exigiendo EL NOMBRE declarado, ni uno más', () => {
  // Un fallo que NO es el nombre declarado no es una caída, aunque el fichero esté en rojo. Si
  // esto pasara a `true`, el meta-guard firmaría cualquier rojo como «el guard vigila».
  assert.equal(cayo({ caidos: [RUTA_YO] }, 'un test que no ha caído'), false,
    '🔴 `cayo()` acepta la muerte del fichero como si fuera la caída del test declarado: eso es '
    + 'un sello de goma, y es justo lo que SCRUM-784 NO se podía permitir.');
  assert.equal(cayo({ caidos: ['SCRUM-784 · otro test cualquiera'] }, 'el mío'), false,
    '🔴 `cayo()` acepta la caída de OTRO test como si fuera la del declarado.');

  // CONTROL POSITIVO: con el nombre declarado entre los caídos, sí. Sin esto, un `cayo()` que
  // devolviera `false` siempre pasaría los dos asertos de arriba.
  assert.equal(cayo({ caidos: ['SCRUM-784 · el mío, entero'] }, 'el mío'), true,
    '🔴 `cayo()` ya no reconoce el nombre declarado: no estaría reconociendo NINGUNA caída.');

  // Y `paso()` mira los PASADOS, que es de donde sale la línea base de SCRUM-748.
  assert.equal(paso({ pasados: ['SCRUM-784 · el mío, entero'] }, 'el mío'), true);
  assert.equal(paso({ pasados: [] }, 'el mío'), false);
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ③ EL CENSO · ¿hay más tests que EXIJAN que dos grafías de la misma ruta difieran?
//
// 🔴 ESTE CENSO ES ESTRECHO A PROPÓSITO, Y ESO SE DECIDIÓ MIDIENDO. La primera versión buscaba
// «constructos de Windows» en `tests/` y daba **19 ficheros, 16 sin declarar**. Al mirarlos uno a
// uno, casi todos eran falsos positivos —la misma clase de error que contar una exclusión como
// una ejecución—:
//
//   · `'junction'` como tipo de enlace **no** ata a Windows: fuera de Windows Node ignora el
//     argumento de tipo (documentado; aquí sólo se ha medido que en Windows funciona).
//   · las rutas `'C:/…'` escritas a mano son DATOS de prueba de un parser de rutas, no una
//     dependencia de plataforma. Sin leer cada caso no se puede decidir: INDETERMINADO.
//   · `charAt(0).toLowerCase()` cazaba `const camel = (m) => …`, capitalizar un rótulo y ordenar
//     apellidos. Nada que ver con la letra de unidad.
//
// Un censo que no distingue no es un censo, así que se retiró y queda SÓLO lo que sí es sano y
// suficiente para el defecto que ha mordido dos veces: **una PRECONDICIÓN que exige que la misma
// ruta escrita de dos formas sea DISTINTA**. Eso no puede cumplirse donde no hay letra de unidad,
// y es literalmente el aserto que reventó en el runner.
//
// ⚠️ LO QUE ESTE CENSO **NO** VE, dicho para que nadie lo lea como «no hay dependencias de
// Windows en tests/»: cualquier otra forma de depender de la plataforma. Sólo ve ésta.
// ─────────────────────────────────────────────────────────────────────────────────────────────
function precondicionesDeGrafiaDeRuta(codigo, nombre) {
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const CAJA_DEL_PRIMERO = /(charAt\(0\)|\[0\])\.to(Lower|Upper)Case\(\)/;
  const out = [];
  let declara = false;

  // 🔴 HAY QUE SEGUIR LA VARIABLE. En el caso real la transformación no está DENTRO del aserto:
  // vive una línea antes, en un `const`, y el aserto sólo ve el identificador. Un detector que
  // mirase sólo los argumentos no habría cazado el aserto que tumbó el CI — lo comprobé, y su
  // control positivo salió rojo.
  const bautizadas = new Set();
  const b = (n) => {
    if (ts.isVariableDeclaration(n) && n.name && ts.isIdentifier(n.name) && n.initializer
        && CAJA_DEL_PRIMERO.test(n.initializer.getText(sf))) bautizadas.add(n.name.text);
    ts.forEachChild(n, b);
  };
  b(sf);
  const esLaTransformada = (a) => CAJA_DEL_PRIMERO.test(a.getText(sf))
    || (ts.isIdentifier(a) && bautizadas.has(a.text));

  const v = (n) => {
    // ¿El fichero DECLARA que esto depende de la plataforma? Vale un discriminador de letra de
    // unidad o `process.platform`. Con puerta puesta, el aserto no llega a correr donde no aplica.
    if (ts.isRegularExpressionLiteral(n) && /\[[^\]]*\]\s*:/.test(n.getText(sf))) declara = true;
    if (ts.isPropertyAccessExpression(n) && n.name.text === 'platform') declara = true;

    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && /^notEqual$|^notStrictEqual$/.test(n.expression.name.text)
        && n.arguments.length >= 2
        && n.arguments.slice(0, 2).some(esLaTransformada)) {
      out.push({ fichero: nombre, linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 });
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  return declara ? [] : out;
}

test('SCRUM-784 · 🔴 ningún test EXIGE que dos grafías de la misma ruta difieran', () => {
  // 🔴 CONTROL POSITIVO CON EL CASO CONOCIDO: el aserto tal y como estaba escrito cuando reventó
  // en CI. Si el censo no lo ve, no está censando: está mirando para otro lado.
  const COMO_ESTABA = "const enMinuscula = RUTA_YO.charAt(0).toLowerCase() + RUTA_YO.slice(1);\n"
    + "assert.notEqual(enMinuscula, RUTA_YO, 'este caso no está probando nada');";
  assert.equal(precondicionesDeGrafiaDeRuta(COMO_ESTABA, 'viejo.mjs').length, 1,
    '🔴 el censo no reconoce el aserto que tumbó el CI. Su cero no significaría nada.');

  // 🔴 CONTROL NEGATIVO CON LA MISMA FORMA, PERO DECLARADA. Es el que decide que el censo mida
  // «sin declararlo» y no «lo menciona»: el aserto es idéntico al de arriba y aquí NO se denuncia,
  // porque el fichero lleva el discriminador que impide que llegue a correr donde no aplica.
  const DECLARADO = 'const TIENE_UNIDAD = /^[a-zA-Z]:/.test(R);\n' + COMO_ESTABA;
  assert.equal(precondicionesDeGrafiaDeRuta(DECLARADO, 'nuevo.mjs').length, 0,
    '🔴 el censo denuncia una dependencia DECLARADA: entonces no distingue declarar de no '
    + 'declarar, y su lista sería una lista de menciones.');

  // Y sobre el árbol de verdad.
  const dir = path.join(RAIZ, 'tests');
  const ficheros = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs'));
  assert.ok(ficheros.length > 200,
    `🔴 CIEGO: el censo sólo ha visto ${ficheros.length} ficheros; su cero no sería medible.`);
  const hallazgos = ficheros.flatMap(
    (f) => precondicionesDeGrafiaDeRuta(fs.readFileSync(path.join(dir, f), 'utf8'), f));
  assert.deepEqual(hallazgos, [],
    '🔴 hay tests que EXIGEN que dos grafías de la misma ruta sean distintas. Donde no hay letra '
    + 'de unidad eso no se puede cumplir y el test revienta sin decir por qué:\n  · '
    + hallazgos.map((h) => `${h.fichero}:${h.linea}`).join('\n  · '));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA MUTACIÓN QUE ME TUMBA (SCRUM-745)
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El detector deja de ver la muerte: se vuelve al MUDO falso de SCRUM-784.
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  return (resultado?.caidos || []).some((n) => rutaRealDe(n) === objetivo);',
    a: '  return false;',
    cae: 'un caído que es LA RUTA del fichero es una MUERTE, no un silencio',
  },
  {
    // El detector se dispara con cualquier caída: toda mutación que tumba un test se leería como
    // muerte de fichero, y el cuarto veredicto se comería a los otros tres.
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  return (resultado?.caidos || []).some((n) => rutaRealDe(n) === objetivo);',
    a: '  return (resultado?.caidos || []).length > 0;',
    cae: 'un caído que es LA RUTA del fichero es una MUERTE, no un silencio',
  },
  {
    // Se vuelve a comparar POR TEXTO en vez de por ruta resuelta — el defecto original del
    // detector, el que dio `false` sobre el caso real.
    //
    // 📌 AQUÍ IBA `.native` → `realpathSync`, Y LA RETIRÉ CON LA MEDICIÓN DELANTE. Esa degradación
    // sólo se puede cazar donde HAY letra de unidad: es exactamente lo único que `.native` añade.
    // En el runner de Linux ningún test caería con ella puesta, así que saldría **MUDA** y pondría
    // el job en rojo por un defecto que no existe allí. Va como hueco declarado, no como
    // declaración que sé que miente en la mitad de las plataformas.
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: 'const rutaRealDe = (p) => { try { return fs.realpathSync.native(p); } catch { return null; } };',
    a: 'const rutaRealDe = (p) => path.resolve(p);',
    cae: 'la ruta se compara RESUELTA, no por texto',
  },
  {
    // 🔴 `cayo()` relajado a «cualquier rojo vale»: el sello de goma que el ticket prohíbe.
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  return (resultado?.caidos || []).some((n) => n.includes(nombre));',
    a: '  return (resultado?.caidos || []).length > 0;',
    cae: '`cayo()` sigue exigiendo EL NOMBRE declarado, ni uno más',
  },
];
