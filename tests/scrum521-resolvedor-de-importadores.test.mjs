// tests/scrum521-resolvedor-de-importadores.test.mjs — SCRUM-521.
//
// ── LA VÍCTIMA ───────────────────────────────────────────────────────────────────────────────
// `quienLoImporta` (`tests/_alcance-desde-entradas.mjs`) comparaba `imp.modulo` contra
// `path.join(raiz, moduloRel)`. `path.join` produce el separador NATIVO (`\` en Windows) y
// `resolver()` devolvía `/` en su rama `dist/→src/`. Los dos lados no casaban, y las aristas que
// entran por ahí —las de los `scripts/*.mjs`— se perdían.
//
// 🔴 Y LO QUE LO HACE PEOR QUE UN BUG NORMAL: lo que devolvía no era un error, era una LISTA VACÍA.
//
//   >>> «Nadie lo importa» y «no supe mirar» son el mismo resultado con significados opuestos. <<<
//
// Es exactamente el defecto que un SUELO existe para impedir, y lo tenía la herramienta con la que
// se calcula el alcance de lo que se declara huérfano. Un `[]` de aquí se lee como «se puede
// borrar».
//
// ── EL ALCANCE REAL, MEDIDO ANTES DE TOCAR (19-ago-2026) ────────────────────────────────────
// El enunciado del ticket decía «devuelve [] SIEMPRE en Windows». **Medido, no es así**, y la
// diferencia importa para saber qué hay que vigilar: de 1399 aristas de import del árbol, 1396
// casaban y **3 se perdían** — las tres de `scripts/*.mjs` que importan vía `../dist/`. De ellas,
// **una dejaba un CERO FALSO**: `puertaClienteReal.ts::textoDelAviso` decía `[]` teniendo un
// importador real. Las otras dos sólo acortaban una lista que ya no estaba vacía.
//
// El defecto era real y del tipo descrito; lo que no era es universal. Se deja escrito porque un
// guard construido sobre «falla siempre» no vigilaría el caso que de verdad falla.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { quienLoImporta, importacionesDe } from './_alcance-desde-entradas.mjs';

// ── FUENTE SINTÉTICA PROPIA, y por qué no se reutiliza la de SCRUM-411 ──────────────────────
// La de 411 no tiene ningún `scripts/*.mjs` que importe vía `../dist/`, que es justo la arista que
// este ticket arregla. Añadírsela cambiaría el veredicto de `motorMuerto` y rompería SU autoprueba
// —un test ajeno— por un motivo que no es suyo. Se escribe una propia: cuesta veinte líneas y deja
// el de 411 midiendo lo que mide.
const FUENTE = {
  'package.json': '{ "name": "sintetico-521", "scripts": { "mide": "node scripts/mide.mjs" } }\n',
  'src/index.ts': "import { arrancar } from './app';\narrancar();\n",
  'src/app.ts': "import { usado } from './modules/lib';\nexport function arrancar() { return usado(); }\n",
  'src/modules/lib.ts':
    'export function usado() { return 1; }\n' +
    'export function soloScript() { return 2; }\n' +
    'export function huerfano() { return 3; }\n',
  // 🔴 LA ARISTA DEL DEFECTO: un script declarado en `package.json` que importa el BUILD.
  // `resolver()` traduce `dist/`→`src/`, y ahí es donde nacían las barras `/`.
  'scripts/mide.mjs': "import { soloScript } from '../dist/modules/lib.js';\nsoloScript();\n",
};

function arbolSintetico() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum521-'));
  for (const [r, c] of Object.entries(FUENTE)) {
    const destino = path.join(raiz, r);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, c);
  }
  return raiz;
}

function conArbol(fn) {
  const raiz = arbolSintetico();
  try { return fn(raiz); } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
}

const LIB = 'src/modules/lib.ts';

// ── 1 · CONTROL POSITIVO, ENUMERADO ─────────────────────────────────────────────────────────

test('SCRUM-521 · 🔴 CONTROL POSITIVO: los importadores salen NOMBRADOS, uno a uno', () => {
  conArbol((raiz) => {
    // Sin enumerar, «ya no devuelve vacío» y «devuelve cualquier cosa» dan el mismo verde.
    assert.deepEqual(quienLoImporta(raiz, LIB, 'usado'), ['src/app.ts'],
      '🔴 el importador de `usado` es `src/app.ts` y sólo ése.');

    // 🔴 ÉSTE ES EL CASO DEL TICKET: el importador entra por `../dist/` desde un script declarado
    // en `package.json`. Antes del arreglo esta lista salía VACÍA, y un vacío aquí se lee como
    // «no lo importa nadie» — es decir, «se puede borrar».
    assert.deepEqual(quienLoImporta(raiz, LIB, 'soloScript'), ['scripts/mide.mjs'],
      '🔴 SE HA PERDIDO EL IMPORTADOR QUE ENTRA POR `../dist/`.\n\n'
      + '  `scripts/mide.mjs` importa `soloScript` del BUILD, y `resolver()` traduce esa ruta a\n'
      + '  `src/`. Si la comparación vuelve a depender del separador, esta arista desaparece EN\n'
      + '  SILENCIO y `soloScript` pasa a parecer huérfano.');
  });
});

// ── 2 · CONTROL NEGATIVO: el vacío legítimo sigue existiendo, y se distingue del ciego ──────

test('SCRUM-521 · 🔴 CONTROL NEGATIVO: un export que de verdad no importa nadie da [] — sin lanzar', () => {
  conArbol((raiz) => {
    // Si el arreglo hubiera convertido todo en «alguien lo importa», el guard de huérfanos dejaría
    // de encontrar ninguno y su cero sería tan falso como el de antes, en la otra dirección.
    assert.deepEqual(quienLoImporta(raiz, LIB, 'huerfano'), [],
      '🔴 `huerfano` no lo importa nadie: tiene que salir vacío. Un resolvedor que nunca devuelve '
      + 'vacío no distingue mejor que uno que siempre lo devuelve.');
  });
});

// ── 3 · 🔴 EL QUE DECIDE: LOS DOS SEPARADORES ───────────────────────────────────────────────

test('SCRUM-521 · 🔴 LAS DOS RAMAS DE `resolver` devuelven el MISMO separador', () => {
  // ⚠️ ÉSTE es el test que muerde, y llegar a él costó un intento fallido que conviene dejar
  // escrito: la primera versión comparaba `quienLoImporta(raiz,'src/modules/lib.ts',…)` contra
  // `quienLoImporta(raiz,'src\\modules\\lib.ts',…)` y **no podía fallar en Windows**, porque
  // `path.join` de Windows ya traduce `/` a `\` antes de comparar nada. Verde con el defecto
  // puesto: exactamente el aviso del encargo — «tu máquina te dará verde igual».
  //
  // El invariante que SÍ decide es el de la fuente del dato: `resolver()` tiene DOS ramas —la
  // normal y la de `dist/→src/`— y **las dos tienen que devolver el separador nativo**. Cuando no
  // lo hacían, cualquier comparación contra un `path.join` perdía las de la rama `dist/`.
  conArbol((raiz) => {
    const ajeno = path.sep === '\\' ? '/' : '\\';

    const porRamaNormal = importacionesDe(path.join(raiz, 'src/app.ts')).nombradas
      .find((i) => i.nombre === 'usado');
    const porRamaDist = importacionesDe(path.join(raiz, 'scripts/mide.mjs')).nombradas
      .find((i) => i.nombre === 'soloScript');

    assert.ok(porRamaNormal?.modulo, '🔴 no se resolvió el import normal (`./modules/lib`).');
    assert.ok(porRamaDist?.modulo, '🔴 no se resolvió el import por `../dist/`.');

    for (const [rama, imp] of [['normal', porRamaNormal], ['dist/→src/', porRamaDist]]) {
      assert.ok(!imp.modulo.includes(ajeno),
        `🔴 la rama «${rama}» de \`resolver()\` devuelve el separador AJENO «${ajeno}»:\n`
        + `     ${imp.modulo}\n\n`
        + '  Las dos ramas tienen que salir con el separador nativo. Cuando una devolvía `/` y la\n'
        + '  otra `\\`, quien comparase contra `path.join` perdía en silencio las aristas de esa\n'
        + '  rama — y son las de los `scripts/*.mjs`, que es como se declara huérfano algo vivo.');
    }
    assert.equal(porRamaNormal.modulo.includes(path.sep), porRamaDist.modulo.includes(path.sep),
      '🔴 las dos ramas no coinciden en el separador que usan.');
  });

  // Y la otra mitad, que es de API y no de mecanismo: preguntar con `/` o con `\` da lo mismo.
  conArbol((raiz) => {
    for (const nombre of ['usado', 'soloScript', 'huerfano']) {
      assert.deepEqual(
        quienLoImporta(raiz, 'src\\modules\\lib.ts', nombre),
        quienLoImporta(raiz, 'src/modules/lib.ts', nombre),
        `🔴 «${nombre}» da resultados distintos según cómo se escriba la ruta al preguntar.`);
    }
  });
});

// ── 4 · EL SUELO: cero declarándose ciego, nunca cero a secas ───────────────────────────────

test('SCRUM-521 · 🔴 SUELO: cuando no puede mirar, LANZA — no devuelve []', () => {
  conArbol((raiz) => {
    // (a) El nombre no es un export del módulo. Antes: `[]`, indistinguible de un huérfano.
    assert.throws(() => quienLoImporta(raiz, LIB, 'noExisteEsteNombre'), /CIEGO/,
      '🔴 un nombre que el módulo NO exporta devuelve `[]` en vez de declararse ciego. Así es '
      + 'como un typo se convierte en un huérfano declarado y de ahí en un borrado.');

    // (b) El módulo preguntado no existe.
    assert.throws(() => quienLoImporta(raiz, 'src/modules/no-existe.ts', 'usado'), /CIEGO/,
      '🔴 preguntar por un módulo que no está devuelve `[]`. Un módulo ausente no tiene cero '
      + 'importadores: tiene una pregunta mal hecha.');
  });

  // (c) Sin árbol que mirar.
  const vacio = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum521-vacio-'));
  try {
    assert.throws(() => quienLoImporta(vacio, LIB, 'usado'), /CIEGO/,
      '🔴 sin `src/` devuelve `[]`. «No he encontrado dónde mirar» se estaría leyendo como «no lo '
      + 'importa nadie», que es el defecto entero de este ticket.');
  } finally {
    fs.rmSync(vacio, { recursive: true, force: true });
  }
});

// ── 5 · CUADRE ──────────────────────────────────────────────────────────────────────────────

test('SCRUM-521 · 🔴 los números CUADRAN: con importadores + sin importadores = total', () => {
  conArbol((raiz) => {
    const EXPORTS = ['usado', 'soloScript', 'huerfano'];
    const con = EXPORTS.filter((n) => quienLoImporta(raiz, LIB, n).length > 0);
    const sin = EXPORTS.filter((n) => quienLoImporta(raiz, LIB, n).length === 0);

    assert.equal(con.length + sin.length, EXPORTS.length,
      '🔴 las dos categorías no suman el total analizado: hay exports que no caen en ninguna.');
    // Y los números concretos, para que el cuadre no sea una tautología (0 + 0 = 0 también cuadra).
    assert.deepEqual(con, ['usado', 'soloScript'],
      `🔴 se esperaban 2 exports con importadores y salen ${con.length}: ${JSON.stringify(con)}.`);
    assert.deepEqual(sin, ['huerfano'],
      `🔴 se esperaba 1 export sin importadores y salen ${sin.length}: ${JSON.stringify(sin)}.`);
  });
});

// ── 6 · EL ÁRBOL REAL: el cero falso que había, medido ──────────────────────────────────────

test('SCRUM-521 · 🔴 el cero falso del árbol real ya no lo es', () => {
  const RAIZ = path.resolve(import.meta.dirname, '..');
  // Medido el 19-ago-2026: `textoDelAviso` decía `[]` teniendo un importador real. Era el único
  // CERO FALSO de las 3 aristas que se perdían; se fija aquí para que no vuelva sin que se note.
  const imp = quienLoImporta(RAIZ, 'src/modules/system/domain/puertaClienteReal.ts', 'textoDelAviso');
  assert.ok(imp.includes('scripts/puerta-cliente-real.mjs'),
    '🔴 `textoDelAviso` vuelve a perder a `scripts/puerta-cliente-real.mjs`, que lo importa por '
    + `\`../dist/\`. Ahora devuelve: ${JSON.stringify(imp)}.\n\n`
    + '  Ése era EL cero falso del árbol: un export vivo que el resolvedor daba por no importado.');
});
