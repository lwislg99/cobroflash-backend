// tests/scrum938-la-lista-como-fixture.test.mjs — SCRUM-938
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA RED DEL CENSO: que siga VIENDO lo que promete ver.
//
// El censo entero (`npm run censo:lista-fixture --decidir`) corre una copia por candidato y
// cuesta minutos, así que vive fuera de `npm test`. Esto comprueba en segundos que el aparato
// que lo mira sigue viendo, con el mismo camino y sin barrer el árbol.
//
// ⛔ Lo que este fichero NO hace: censar. Su verde no dice que no haya tests atados a una lista
// real — eso sólo lo dice la pasada completa. Dice que el detector distingue.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  clasificar, elementosDeLaLista, importaDe, usoDeLaLista, decidirVaciando,
} from '../scripts/censo-lista-como-fixture.mjs';

// 🔴 MUTACIONES_QUE_ME_TUMBAN · SCRUM-745.
//
// ⚠️ ESTAS DOS NACIERON CADUCADAS, Y ES EL MISMO ERROR QUE ARREGLÉ ESTA MAÑANA EN SCRUM-813.
//
// Las declaré citando el texto que el censo tenía **mientras lo estaba escribiendo**, y después
// cambié las dos líneas: el emparejamiento pasó de `txt.includes(...)` a `importaDe(...)` y el
// umbral de `>= 3` a `>= MINIMO_ELEMENTO`. Las mutaciones quedaron apuntando a texto inexistente,
// o sea MUDAS — `meta:mutaciones` no podía aplicarlas y nadie comprobaba estos dos ejes. Lo cazó
// `scrum836` en la tanda, no yo, **teniendo el verificador de anclas escrito desde esta mañana y
// sin haberlo pasado por mi propio fichero nuevo**.
//
//     🔒 Una mutación se declara CUANDO el código ya está quieto, no mientras se escribe.
//
// Reancladas al texto de hoy, y comprobadas con el mismo lector por AST antes de commitear.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/censo-lista-como-fixture.mjs',
    // 🔴 ANCLADA AL VEREDICTO DE `importaDe`, NO A SU LLAMADA — y el porqué es el aprendizaje.
    //
    // Primero la anclé a `if (importaDe(txt, modulo, l.nombre)) consumidores.add(t);`, dentro de
    // `censar()`. **Salió MUDA**: exit 0, cero casos caídos. El caso ④ prueba `importaDe` SUELTA,
    // y la mutación tocaba su llamada en un camino que ese caso no ejercita — probé la unidad
    // creyendo probar la integración, que es la familia de fallo de mi propia ficha.
    //
    // Se ancla a lo que el caso SÍ mide: el veredicto de la función. `return true` hace que
    // cualquier fichero cuente como consumidor, que es exactamente el defecto de acusar por
    // mención. ⚠️ Queda declarado que NADIE vigila hoy la llamada dentro de `censar()`: haría
    // falta un caso que ejercite el emparejamiento sobre un árbol de prueba, y eso es otra tanda.
    //
    //     🔒 Una mutación que no tumba nada no prueba que el guard sea débil: prueba que el caso
    //        y la mutación miran puertas distintas.
    de: '  return hay;',
    a: '  return true;',
    cae: 'el consumidor se resuelve por IMPORT, no por mencionar el nombre',
  },
  {
    fichero: 'scripts/censo-lista-como-fixture.mjs',
    de: '    if (t.length >= MINIMO_ELEMENTO && t.length < TOPE_ELEMENTO) out.add(n.text);',
    a: '    if (t.length >= MINIMO_ELEMENTO) out.add(n.text);',
    cae: 'un MOTIVO en prosa no es un elemento de la lista',
  },
];

const M = 'scripts/_trinquete-de-zona.mjs';
const T = 'tests/scrum813-trinquete-de-zona.test.mjs';
const deGit = (sha, ruta) =>
  execFileSync('git', ['show', `${sha}:${ruta}`], { encoding: 'utf8', maxBuffer: 1 << 24 });

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① SUELO
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-938 · SUELO: el lector encuentra la lista y extrae sus elementos', () => {
  const { encontrada, elementos } = elementosDeLaLista(
    "export const L = Object.freeze([Object.freeze({ ruta: 'scrum659/', porque: 'x' })]);", 'L');
  assert.equal(encontrada, true, '🔴 CIEGO: no encuentra una lista que está delante.');
  assert.ok(elementos.includes('scrum659/'), '🔴 CIEGO: no extrae los elementos, así que la forma ③ no puede verse.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② 🔴 EL CONTROL POSITIVO — mis seis casos de SCRUM-813, Y POR EL EJE CORRECTO
//
// Se leen de git (`2b317011`, antes del arreglo) porque hoy ya están arreglados en `main`: un
// control positivo sobre el código de hoy saldría limpio y no probaría nada.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-938 · 🔴 ② el defecto de SCRUM-813 se caza, y POR EL FLUJO no por la mención', () => {
  const modulo = deGit('2b317011', M);
  const testViejo = deGit('2b317011', T);

  const { encontrada, elementos } = elementosDeLaLista(modulo, 'ESCRITURAS_DE_LA_TANDA');
  assert.equal(encontrada, true, '🔴 CIEGO: no se lee la lista de la versión vieja.');
  assert.ok(elementos.includes('scrum659/'),
    '🔴 CIEGO: `scrum659/` era el único elemento; sin él no hay nada que cazar.');

  const uso = usoDeLaLista(testViejo, 'ESCRITURAS_DE_LA_TANDA', elementos);
  assert.notEqual(clasificar(uso), 'LIMPIO',
    '🔴 EL CENSO NO VE EL DEFECTO QUE LO ORIGINÓ. Seis casos de SCRUM-813 usaban `scrum659/` '
    + 'como fixture y cayeron de golpe al retirar la excepción.');

  // 🔴 Y POR EL EJE CORRECTO: la prueba nombra el LITERAL que sale de la lista, no el fichero.
  assert.ok(uso.formas.some((f) => f.startsWith('③')),
    '🔴 lo caza, pero no por el flujo. El eje tiene que ser «este literal es un elemento de la '
    + 'lista», no «este fichero menciona una lista».');
  assert.ok(uso.pruebas.some((p) => p.includes('"scrum659/"')),
    `🔴 la prueba no nombra el literal copiado. Sin el «cuál», nadie puede accionarlo: ${JSON.stringify(uso.pruebas)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ③ ✅ EL CONTROL NEGATIVO — un trinquete de clase (c) sale LIMPIO
//
// Es el que tenía que salir verde. Si el censo acusa a los trinquetes de contenido, marcará
// media casa y se desactivará en una semana — que es la otra forma de no tener censo.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-938 · ✅ ③ un trinquete que mide el contenido A PROPÓSITO sale LIMPIO', () => {
  const trinquete = `
    import { LISTA } from '../scripts/x.mjs';
    test('la lista es EXACTAMENTE ésta', () => {
      assert.deepEqual(LISTA.map((e) => e.ruta), ['a/', 'b/']);
      for (const e of LISTA) assert.ok(e.porque);
    });`;
  const uso = usoDeLaLista(trinquete, 'LISTA', ['a/', 'b/']);

  // ⚠️ Se exige LIMPIO, no una etiqueta concreta — y la primera versión de este caso pedía
  // literalmente `'LIMPIO (c · trinquete de contenido)'`, o sea que fallaba mientras el censo
  // acertaba: un trinquete puro no produce ninguna «forma», así que sale LIMPIO a secas y nunca
  // llega a la rama que pone la etiqueta (c). Lo que decide es **que no se acuse**; la etiqueta
  // sólo sirve para explicar por qué, cuando además hay algún uso.
  assert.ok(clasificar(uso).startsWith('LIMPIO'),
    '🔴 ACUSA A UN TRINQUETE DE CONTENIDO. Un test que declara que mide la lista NO es este '
    + `defecto, y acusarlo marca todos los trinquetes de la casa: ${clasificar(uso)}`);
  assert.ok(uso.assertsSobreLaLista > 0,
    '🔴 y no lo ve como lo que es: si no cuenta los asserts SOBRE la lista, no puede distinguir '
    + 'un trinquete de un fixture — los dos se le parecerían.');
});

test('SCRUM-938 · ✅ ③bis un fixture FABRICADO no se denuncia, aunque el fichero cite la lista', () => {
  // El caso arreglado: la lista real está a cero y el fixture es sintético. No puede salir.
  const arreglado = `
    import { LISTA } from '../scripts/x.mjs';
    const PROPIA = [{ ruta: 'fixture-de-prueba/' }];
    test('el amparo funciona', () => { assert.equal(f(m(['fixture-de-prueba/']), PROPIA).length, 0); });`;
  const uso = usoDeLaLista(arreglado, 'LISTA', ['a/', 'b/']);
  assert.equal(clasificar(uso), 'LIMPIO',
    '🔴 denuncia un fixture fabricado: entonces castiga precisamente el arreglo que este ticket propone.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ④ EL EJE, AISLADO — mencionar no es consumir
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-938 · 🔴 ④ el consumidor se resuelve por IMPORT, no por mencionar el nombre', () => {
  // Medido el 17-sep-2026: la primera versión emparejaba por mención y acusaba a 118 de 833,
  // cruzando listas de un guard con tests de otro porque `EXCEPCIONES` es un nombre genérico.
  const menciona = `
    // este comentario habla de EXCEPCIONES del guard de otro fichero
    const s = 'EXCEPCIONES';`;
  assert.equal(importaDe(menciona, 'otro-modulo', 'EXCEPCIONES'), false,
    '🔴 cuenta como consumidor un fichero que sólo MENCIONA el nombre. Un nombre repetido no es '
    + 'una referencia, y así se acusa al 14 % de la casa.');

  const importa = "import { EXCEPCIONES } from '../scripts/otro-modulo.mjs';";
  assert.equal(importaDe(importa, 'otro-modulo', 'EXCEPCIONES'), true,
    '🔴 NO ve un import de verdad: el censo se quedaría ciego sobre los consumidores reales.');

  // Y el import dinámico con desestructuración, que es como esta casa carga `dist/`.
  const dinamico = "const { EXCEPCIONES } = await import(DIST + 'otro-modulo.js');";
  assert.equal(importaDe(dinamico, 'otro-modulo', 'EXCEPCIONES'), true,
    '🔴 no ve el import dinámico: se perdería la mitad de los consumidores de esta casa.');
});

test('SCRUM-938 · 🔴 ④bis un MOTIVO en prosa no es un elemento de la lista', () => {
  // Sin este corte, la prosa de `porque:` entra como «elemento» y cualquier test que cite la
  // misma frase sale acusado por la forma ③ — acusar por el texto, que es el error perseguido.
  const conMotivo = `export const L = [{ ruta: 'a/', porque: `
    + `'fixture de PDF. El finally borra el FICHERO de dentro, no el DIRECTORIO, asi que este persiste.' }];`;
  const { elementos } = elementosDeLaLista(conMotivo, 'L');
  assert.ok(elementos.includes('a/'), '🔴 CIEGO: no extrae el elemento legítimo.');
  assert.ok(!elementos.some((e) => e.length >= 60),
    `🔴 la prosa del motivo entró como elemento: ${JSON.stringify(elementos.filter((e) => e.length >= 60))}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⑤ SCRUM-938b §3.1 · LA PROPIA DECLARACIÓN NO ES UN USO
//
// `Object.freeze({...})` pone una llamada ENCIMA de la declaración misma: sin excluirla, la forma
// ③ contaba los literales de la lista consigo misma. Medido: de 42 candidatos con forma ③, en 22
// la ③ era SÓLO esto — 8 pasaron de (a) a (b) y 14 de (b) a LIMPIO al arreglarlo. Carril S3
// (comentario 15925 de SCRUM-938: «arreglar el instrumento, antes de trabajar la fase b»).
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-938 · 🔴 ⑤ CASO CONOCIDO: sólo DECLARAR la lista (`Object.freeze`) no es usarla como fixture', () => {
  const soloDeclaracion = "export const EXCEPCIONES = Object.freeze({ 'settingsView.js': 1 });";
  const { elementos } = elementosDeLaLista(soloDeclaracion, 'EXCEPCIONES');
  const uso = usoDeLaLista(soloDeclaracion, 'EXCEPCIONES', elementos);
  assert.equal(clasificar(uso), 'LIMPIO',
    '🔴 acusa a un fichero que sólo DECLARA la lista, sin usarla en ningún caso: `Object.freeze` '
    + 'envuelve la declaración, no un uso, y contarlo como forma ③ es autoacusarse.');
});

test('SCRUM-938 · 🔴 ⑤bis CASO CONOCIDO: con un uso real ADEMÁS de la declaración, baja de (a) a (b), no desaparece', () => {
  const declaracionYUso = [
    "export const EXCEPCIONES = Object.freeze({ 'settingsView.js': 1 });",
    "test('caso', () => { revisar(EXCEPCIONES); });",
  ].join('\n');
  const { elementos } = elementosDeLaLista(declaracionYUso, 'EXCEPCIONES');
  const uso = usoDeLaLista(declaracionYUso, 'EXCEPCIONES', elementos);
  assert.equal(clasificar(uso), '(b) DEGRADA',
    '🔴 con la declaración contando como forma extra salía (a) MIENTE por "dos formas" que en '
    + `realidad eran una sola (el uso real, ①): ${clasificar(uso)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⑥ SCRUM-938b §3.3 · LA SONDA TIENE QUE SER HERMANA DE VERDAD, NO SIEMPRE EN `tests/`
//
// Medido: 3 de 46 copias IDÉNTICAS (sin vaciar nada) caían solas porque `decidirVaciando` escribía
// la copia siempre en `tests/`, y un fichero que vive fuera de ahí (`scripts/…`,
// `docs/master/evidencias/…`) pierde sus imports relativos al mudarse de directorio. El síntoma es
// «caen 1 de 1» — que se lee igual que la lista vaciada tumbando el caso, y es el propio fichero
// reventando al cargar.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-938 · 🔴 ⑥ CASO CONOCIDO: una lista fuera de `tests/`, con un import relativo, decide bien', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum938-hermano-'));
  try {
    const dirGuard = path.join(tmp, 'scripts', 'subdir');
    fs.mkdirSync(dirGuard, { recursive: true });
    fs.writeFileSync(path.join(dirGuard, 'ayudante.mjs'), "export const AYUDA = 'ok';\n");
    fs.writeFileSync(path.join(dirGuard, 'guard-fixture-real.mjs'), [
      "import test from 'node:test';",
      "import assert from 'node:assert/strict';",
      "import { AYUDA } from './ayudante.mjs';",
      "export const LISTA_REAL = ['x/'];",
      "test('usa la ayuda del vecino', () => {",
      "  assert.equal(AYUDA, 'ok');",
      "  assert.ok(LISTA_REAL.length, 'CIEGO: la lista real esta vacia');",
      "});",
      '',
    ].join('\n'));

    const candidato = {
      lista: 'LISTA_REAL',
      declaradaEn: 'scripts/subdir/guard-fixture-real.mjs',
      test: 'scripts/subdir/guard-fixture-real.mjs',
    };
    const d = decidirVaciando(candidato, tmp);
    assert.equal(d.decidido, true,
      `🔴 la copia en 'tests/' rompe el import relativo './ayudante.mjs': ${JSON.stringify(d)}`);
    assert.equal(d.cae, true,
      '🔴 con la lista vacía, `LISTA_REAL.length` es 0 y el assert tiene que caer: si no cae, la '
      + 'sonda no está midiendo lo que dice medir.');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('SCRUM-938 · 🔴 ⑥bis CASO CONOCIDO: si la copia IDÉNTICA (sin vaciar) ya cae, el par sale NO DECIDIBLE', () => {
  // La sonda rota: un import que ni siquiera el hermano de verdad resuelve (apunta a un módulo
  // que no existe). Antes de este arreglo, ese reventón se leía como «la lista vaciada lo tumbó».
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum938-control-'));
  try {
    const dirGuard = path.join(tmp, 'scripts');
    fs.mkdirSync(dirGuard, { recursive: true });
    fs.writeFileSync(path.join(dirGuard, 'guard-roto.mjs'), [
      "import test from 'node:test';",
      "import assert from 'node:assert/strict';",
      "import { NO_EXISTE } from './modulo-que-no-esta.mjs';",
      "export const LISTA_REAL = ['x/'];",
      "test('nunca llega a correr', () => { assert.ok(NO_EXISTE); });",
      '',
    ].join('\n'));

    const candidato = {
      lista: 'LISTA_REAL',
      declaradaEn: 'scripts/guard-roto.mjs',
      test: 'scripts/guard-roto.mjs',
    };
    const d = decidirVaciando(candidato, tmp);
    assert.equal(d.decidido, false,
      `🔴 CONFIRMA una lista que en realidad es una sonda rota: ${JSON.stringify(d)}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⑦ DEFECTO NUEVO, MEDIDO HOY (no estaba en SCRUM-938b) · el laboratorio le prestaba su entorno
//   al sujeto — SCRUM-928 con otro nombre de función
//
// `decidirVaciando` lee `node --test` con `spawnSync(...)` SIN construir el entorno del hijo a
// mano: heredaba `process.env` entero. Medido corriendo el propio caso ⑥ bajo `SCRUM938_DEBUG=1`:
// el hijo moría con «run() is being called recursively within a test file. skipping running
// files» — porque `decidirVaciando` se ejercita, aquí mismo, DESDE DENTRO de un `node --test`
// (SCRUM-846 exige el caso conocido corriendo), y `NODE_TEST_CONTEXT` se hereda igual que un
// `FORCE_COLOR` puesto (esta casa arranca sus sesiones con él, SCRUM-928): con color, el ANSI
// delante de «ℹ tests N» rompe el ancla `^` del regex. Los dos escapes acaban en el mismo síntoma:
// `total=0`, que se lee como «import roto» sin serlo. Precedente exacto: SCRUM-928c en
// `correrPaso`. Aquí se borran `NODE_TEST_CONTEXT`, `FORCE_COLOR` y `NODE_OPTIONS`.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-938 · 🔴 ⑦ CASO CONOCIDO: `decidirVaciando` construye el entorno del hijo a mano (NODE_TEST_CONTEXT/FORCE_COLOR/NODE_OPTIONS) — SCRUM-928 con otro nombre', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum938-color-'));
  const antes = process.env.FORCE_COLOR;
  try {
    process.env.FORCE_COLOR = '3';
    const dirGuard = path.join(tmp, 'scripts');
    fs.mkdirSync(dirGuard, { recursive: true });
    fs.writeFileSync(path.join(dirGuard, 'guard-color.mjs'), [
      "import test from 'node:test';",
      "import assert from 'node:assert/strict';",
      "export const LISTA_REAL = ['x/'];",
      "test('caso', () => { assert.ok(LISTA_REAL.length, 'CIEGO: la lista real esta vacia'); });",
      '',
    ].join('\n'));
    const candidato = { lista: 'LISTA_REAL', declaradaEn: 'scripts/guard-color.mjs', test: 'scripts/guard-color.mjs' };
    const d = decidirVaciando(candidato, tmp);
    assert.equal(d.decidido, true,
      '🔴 con `FORCE_COLOR` heredado, el ANSI delante de "ℹ tests N" rompe el ancla `^ℹ` y la '
      + `sonda cree que el fichero no ejecutó nada, aunque corrió limpio: ${JSON.stringify(d)}`);
    assert.equal(d.cae, true, '🔴 con la lista vacía el assert tiene que caer.');
  } finally {
    if (antes === undefined) delete process.env.FORCE_COLOR; else process.env.FORCE_COLOR = antes;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
