// tests/scrum824-temporales-fuera-del-arbol.test.mjs — SCRUM-824
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL ROJO INTERMITENTE, Y POR QUÉ ES PEOR QUE UNO FIJO
//
// Un rojo fijo se arregla o se ignora a conciencia. Un rojo que sale una de cada dos veces enseña
// a RELANZAR LA TANDA hasta que salga verde — y ese reflejo no distingue este fallo de uno real.
// El día que un test caiga por un defecto de verdad, lo aprendido será relanzarlo.
//
// ── EL MECANISMO, MEDIDO (no supuesto) ───────────────────────────────────────────────────────
// La tanda corre 781 ficheros con concurrencia 12. Dos de ellos se pisaban:
//
//   · `scrum549-nada-publicable-sin-marcar` creaba `tests/.tmp-549-XXXX` DENTRO del repositorio;
//   · `scrum494-export-que-sobra` recorre `tests/` entero (`tests/_export-que-sobra.mjs:79`).
//
// El segundo lista el directorio, el primero lo borra, el segundo entra:
//
//     ENOENT: no such file or directory, scandir '…\tests\.tmp-549-CP9zfR'
//
// REPRODUCIDO en SCRUM-824 con los DOS caminos reales —`censar()` de 494 contra el ciclo exacto
// de 549— y contención de 12: **2 rojos / 112 recorridos**. Sin contención, 0 de 9: la ventana son
// dos llamadas al sistema y lo que la ensancha es que el proceso pierda la CPU justo ahí.
//
// 🔴 Y HABÍA UNA SEGUNDA VENTANA que el ticket no nombraba: 205, 206b, 240 y 538 dejaban ficheros
// `.ts`/`.md` en `tests/`. El recorrido de 494 no sólo LISTA: luego LEE lo que listó
// (`_export-que-sobra.mjs:97`). Un `.ts` que desaparece entre el listado y la lectura da el mismo
// rojo por `open` en vez de por `scandir`.
//
// ── LO QUE VIGILA ESTE FICHERO ───────────────────────────────────────────────────────────────
// Que ningún test vuelva a crear su fixture dentro del árbol. NO vigila una cifra del árbol: la
// única comparación contra número que hay aquí es contra 0, y el control ⑥ lo hace cumplir por
// AST sobre esta misma fuente (la lección de SCRUM-804: un umbral escrito a mano es una FOTO del
// árbol el día que se escribió).
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  censar, clasificaFuente, motivosParaNoFiarse, enElArbol, sinProbar, comoLinea, CREADORAS, SANAS,
} from '../scripts/_temporales-en-el-arbol.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const YO = path.join(RAIZ, 'tests', 'scrum824-temporales-fuera-del-arbol.test.mjs');
const CENSO = censar(RAIZ);

/**
 * Ficheros con creaciones que el clasificador NO consigue PROBAR de dónde cuelgan.
 *
 * 🔴 CONGELADO POR IDENTIDAD DE FICHERO, nunca por línea ni por cuenta. Es la lección literal de
 * SCRUM-710b: un ancla atada a la línea 133 cae cuando alguien la mueve a la 141, y entonces lo
 * que se toca para volver al verde es el guard. Aquí lo que no puede crecer es el CONJUNTO.
 *
 * Todos ellos están medidos como sanos hoy —cuelgan de `os.tmpdir()` a través de un ayudante
 * (`banco()`, `tempPropio()`) que el análisis estático no atraviesa—, y el vigía dinámico de
 * SCRUM-824 no vio aparecer NI UNO dentro del árbol durante una tanda completa. Se declaran para
 * que el que añada el número 14 tenga que mirarlo, no para bendecirlos.
 */
const SIN_PROBAR_CONOCIDOS = [
  'tests/restauracion-del-arbol-ejecutable.test.mjs',
  'tests/scrum253-adopcion.test.mjs',
  'tests/scrum258-nota-por-sesion.test.mjs',
  'tests/scrum351-diagnostico-dependencias.test.mjs',
  'tests/scrum351-topologia-node-modules.test.mjs',
  'tests/scrum476-reconciliar-censos.test.mjs',
  'tests/scrum709-microcopy-por-fichero.test.mjs',
  'tests/scrum716c-la-memoria-del-vigia.test.mjs',
  'tests/scrum72-pdfs-privados.test.mjs',
  'tests/scrum759-el-guard-ciego-fuera-de-su-fichero.test.mjs',
  'tests/scrum766-el-grep-que-cuenta-lineas.test.mjs',
  'tests/scrum778-la-lista-cableada.test.mjs',
  'tests/scrum808-el-arbol-que-queda-mutado.test.mjs',
];

// ═══ ① SUELO — sin esto, un «cero infracciones» podría ser «no he mirado» ═════════════════

test('SCRUM-824 · 🔴 SUELO: el censo ve ficheros, ve creaciones y sabe clasificarlas', () => {
  assert.deepEqual(motivosParaNoFiarse(CENSO), [],
    '🔴 el censo se declara NO FIABLE en esta pasada:\n   · ' + motivosParaNoFiarse(CENSO).join('\n   · '));

  assert.ok(CENSO.ficheros > 0,
    '🔴 CIEGO: cero ficheros `.mjs` en `tests/`. Sobre una lista vacía, el trinquete de abajo pasa solo.');
  assert.ok(CENSO.resumen.total > 0,
    '🔴 CIEGO: cero llamadas de creación en toda la tanda. El detector no reconoce ninguna, y '
    + 'entonces «cero dentro del árbol» no dice nada sobre el árbol: dice que no ha mirado.');
  assert.ok(CENSO.resumen.TMP > 0,
    '🔴 CIEGO: ninguna creación sale colgada de `os.tmpdir()`. Hay decenas: si no ve NINGUNA, el '
    + 'clasificador no está distinguiendo, está contestando lo mismo a todo.');
});

test('SCRUM-824 · 🔴 SUELO: `censar` no se deja ficheros por el camino', () => {
  // Sin esto, un `censar` que leyera media carpeta daría «cero infracciones» siendo falso.
  const enDisco = fs.readdirSync(path.join(RAIZ, 'tests')).filter((f) => f.endsWith('.mjs')).length;
  assert.equal(CENSO.ficheros, enDisco,
    `🔴 el censo dice ${CENSO.ficheros} ficheros y en disco hay ${enDisco}. Un fichero nuevo que `
    + 'el censo no abra es un fichero al que el trinquete no llega.');
});

// ═══ ② EL TRINQUETE ══════════════════════════════════════════════════════════════════════

test('SCRUM-824 · 🔴 EL TRINQUETE: ningún test crea su fixture DENTRO del árbol', () => {
  const dentro = enElArbol(CENSO);
  assert.deepEqual(dentro.map(comoLinea), [],
    '🔴 HAY TESTS CREANDO FICHEROS DENTRO DEL REPOSITORIO:\n   · ' + dentro.map(comoLinea).join('\n   · ')
    + '\n\n  Eso se lo crean a TODOS los demás: la tanda corre con concurrencia 12 y otro fichero '
    + 'puede estar recorriendo ese mismo directorio. El resultado es un ENOENT que sale una vez de '
    + 'cada dos y enseña a relanzar la tanda.\n'
    + '  ARRÉGLALO ASÍ: `fs.mkdtempSync(path.join(os.tmpdir(), `yaqu-<ticket>-${process.pid}-`))`.\n'
    + '  NO vale `\'.\'` de reserva (`process.env.TEMP || \'.\'`): en el runner de Linux ese punto '
    + 'es el repositorio, que es como entró el defecto en `scrum659`.');
});

// ═══ ③ NEGATIVO DEL TRINQUETE — si no puede ponerse rojo, no es un trinquete ══════════════

test('SCRUM-824 · 🔴 NEGATIVO: un test que escriba en `tests/` CAE, y sale NOMBRADO', () => {
  const intruso = [
    "import fs from 'node:fs';",
    "import path from 'node:path';",
    "const RAIZ = path.resolve(import.meta.dirname, '..');",
    "const d = fs.mkdtempSync(path.join(RAIZ, 'tests', '.tmp-intruso-'));",
    "fs.writeFileSync(path.join(d, 'x.ts'), 'export const x = 1;');",
  ].join('\n');
  const s = clasificaFuente('tests/intruso.test.mjs', intruso, RAIZ);
  const dentro = s.filter((x) => x.clase === 'ARBOL');
  assert.equal(dentro.length, s.length,
    '🔴 el detector no ve las DOS creaciones del intruso dentro del árbol: ' + JSON.stringify(s));
  assert.ok(dentro.some((x) => x.metodo === 'mkdtempSync'),
    '🔴 no caza el `mkdtempSync` — que es exactamente la forma con la que entró el defecto de 549.');
});

test('SCRUM-824 · 🔴 NEGATIVO: las OTRAS formas de aterrizar en el árbol también caen', () => {
  const casos = [
    ["const d = fs.mkdtempSync(path.join(process.env.TEMP || '.', 'x-'));",
     'el `\'.\'` de reserva — el defecto literal de scrum659 en el runner de Linux'],
    ["fs.writeFileSync('./tests/suelto.ts', 'x');",
     'una ruta relativa: durante la tanda el cwd ES el repositorio'],
    ["fs.mkdirSync(path.join(process.cwd(), 'tmp-x'));",
     '`process.cwd()` durante la tanda es el repositorio'],
    ["fs.writeFileSync(path.join(import.meta.dirname, 'x.ts'), 'y');",
     '`import.meta.dirname` de un test ES `tests/`'],
  ];
  for (const [linea, porQue] of casos) {
    const fuente = "import fs from 'node:fs';\nimport path from 'node:path';\n" + linea;
    const s = clasificaFuente('tests/x.test.mjs', fuente, RAIZ);
    assert.ok(s.length > 0, `🔴 el detector no ve NINGUNA creación en: ${linea}`);
    assert.ok(s.every((x) => x.clase === 'ARBOL'),
      `🔴 NO cae, y tenía que caer (${porQue}):\n   ${linea}\n   → ${JSON.stringify(s)}`);
  }
});

// ═══ ④ POSITIVO — un trinquete que cae con todo es un trinquete que se desactiva ══════════

test('SCRUM-824 · ✅ POSITIVO: lo que cuelga de `os.tmpdir()` NO cae', () => {
  const bueno = [
    "import fs from 'node:fs';",
    "import os from 'node:os';",
    "import path from 'node:path';",
    "const d = fs.mkdtempSync(path.join(os.tmpdir(), `yaqu-999-${process.pid}-`));",
    "fs.mkdirSync(path.join(d, 'public'), { recursive: true });",
    "fs.writeFileSync(path.join(d, 'public', 'index.html'), '<p>x</p>');",
  ].join('\n');
  const s = clasificaFuente('tests/bueno.test.mjs', bueno, RAIZ);
  assert.ok(s.length > 0, '🔴 el detector no ve las creaciones: este positivo no prueba nada.');
  assert.deepEqual(s.filter((x) => !SANAS.has(x.clase)), [],
    '🔴 el arreglo CORRECTO cae. Un trinquete que da rojo sobre `os.tmpdir()` no se puede cumplir, '
    + 'y lo que se acaba tocando es el trinquete.');
});

test('SCRUM-824 · 🔴 el argumento que se mira NO es siempre el primero', () => {
  // `copyFileSync(origen, destino)` LEE el primero. Mirar el arg 0 daba tres falsos positivos
  // medidos en SCRUM-824 sobre `scrum471` —copiar `package.json` DEL repo es legítimo— y a la vez
  // dejaba sin mirar el destino, que es lo único que se crea.
  const fuente = [
    "import fs from 'node:fs';",
    "import os from 'node:os';",
    "import path from 'node:path';",
    "const RAIZ = path.resolve(import.meta.dirname, '..');",
    "const d = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-x-'));",
    "fs.copyFileSync(path.join(RAIZ, 'package.json'), path.join(d, 'package.json'));",
  ].join('\n');
  const s = clasificaFuente('tests/copia.test.mjs', fuente, RAIZ);
  const copia = s.find((x) => x.metodo === 'copyFileSync');
  assert.ok(copia, '🔴 no se ha visto el `copyFileSync`.');
  assert.ok(SANAS.has(copia.clase),
    '🔴 LEER `package.json` del repo se está contando como crear dentro del árbol. Con ese falso '
    + 'positivo el trinquete es incumplible, y además el destino de verdad se queda sin mirar.');
  assert.equal(CREADORAS.get('copyFileSync'), 1,
    '🔴 `copyFileSync` ha dejado de declarar que lo que CREA es su segundo argumento.');
});

// ═══ ⑤ LO QUE NO SE PUEDE PROBAR SE DECLARA, Y NO CRECE EN SILENCIO ═══════════════════════

test('SCRUM-824 · 🔴 el conjunto de ficheros SIN PROBAR no crece', () => {
  const ficheros = [...new Set(sinProbar(CENSO).map((s) => s.fichero))].sort();
  assert.deepEqual(ficheros, SIN_PROBAR_CONOCIDOS,
    '🔴 ha cambiado el conjunto de ficheros con creaciones que NO se pueden probar.\n'
    + '  Si hay uno NUEVO: enséñale al censo de dónde cuelga su temporal —lo más fácil es escribir '
    + '`os.tmpdir()` donde se vea— o decláralo aquí a sabiendas. Un «no lo sé» que se cuenta como '
    + '«está bien» es exactamente por donde un censo deja de ver.\n'
    + '  Si falta uno: se ha vuelto demostrable. Bórralo de `SIN_PROBAR_CONOCIDOS` en el mismo commit.');
});

// ═══ ⑥ NINGÚN UMBRAL ESCRITO A MANO EN ESTE FICHERO (SCRUM-804) ═══════════════════════════
//
// 🔴 AST, NO `grep`. Un guard de texto se caza a sí mismo en el párrafo que explica la
// prohibición: ahí arriba están escritos «781 ficheros», «concurrencia 12» y «2 rojos / 112».
// El 0 se permite y es la única excepción: `x.length > 0` no afirma una magnitud del árbol, dice
// «hay población o estoy ciego».
test('SCRUM-824 · 🔴 NINGÚN UMBRAL DE ESTE FICHERO ESTÁ ESCRITO A MANO', () => {
  const ts = createRequire(import.meta.url)('typescript');
  const fuente = fs.readFileSync(YO, 'utf8');
  const arbol = ts.createSourceFile(YO, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const RELACIONALES = new Set([
    ts.SyntaxKind.GreaterThanToken,
    ts.SyntaxKind.GreaterThanEqualsToken,
    ts.SyntaxKind.LessThanToken,
    ts.SyntaxKind.LessThanEqualsToken,
  ]);

  const escritos = [];
  let comparaciones = 0;
  const recorrer = (nodo) => {
    if (ts.isBinaryExpression(nodo) && RELACIONALES.has(nodo.operatorToken.kind)) {
      comparaciones += 1;
      for (const lado of [nodo.left, nodo.right]) {
        if (!ts.isNumericLiteral(lado) || Number(lado.text) === 0) continue;
        const { line } = arbol.getLineAndCharacterOfPosition(nodo.getStart(arbol));
        escritos.push(`:${line + 1} · ${nodo.getText(arbol).replace(/\s+/g, ' ').slice(0, 90)}`);
      }
    }
    ts.forEachChild(nodo, recorrer);
  };
  recorrer(arbol);

  assert.ok(comparaciones > 0,
    '🔴 CIEGO: el recorrido AST no ha encontrado ni una comparación relacional en este fichero. '
    + 'Un cero sobre una población vacía no es «está limpio»: es «no he mirado».');

  assert.deepEqual(escritos, [],
    '🔴 UMBRAL ESCRITO A MANO en este fichero:\n   · scrum824-temporales-fuera-del-arbol.test.mjs'
    + escritos.join('\n   · scrum824-temporales-fuera-del-arbol.test.mjs')
    + '\n\n  Un número comparado contra el árbol es una FOTO del árbol el día que se escribió '
    + '(SCRUM-804). Derívalo del propio censo en la misma pasada.');
});
