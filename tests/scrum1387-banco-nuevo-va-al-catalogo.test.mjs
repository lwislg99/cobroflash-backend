// tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs — SCRUM-1387 ② (rehecho: la población se deriva)
//
// Sin gate: ni BD, ni red, ni navegador, ni `dist/`. Lee `docs/evidencias/`, `docs/master/evidencias/`
// y la HISTORIA de git (primer padre de `HEAD`). En un clon superficial NO pasa: dice CIEGO.
// Y tampoco donde el primer padre de `HEAD` no es la línea de main (SCRUM-1548): una rama anterior al
// guard que trajo main con `git merge origin/main` resolvía el corte a su merge local y salía VERDE.
//
// Un banco de mutación NUEVO que traiga su lista propia y no nombre el catálogo del meta-guard CAE,
// y el rojo dice qué banco y qué fichero. «Nuevo» no sale de ninguna lista: es el que entró en la
// línea principal después que `tests/_catalogo-obligatorio.mjs`, o el que aún no está en ningún
// commit. Decisiones del fundador: comentarios 18016 (2-oct-2026) y 19366 (13-oct-2026) de SCRUM-1387.
//
// ⚠️ LÍMITE: «banco» y «fuera» son la heurística de TEXTO de SCRUM-1394 (ver
// `tests/_catalogo-obligatorio.mjs`). Aquí no se ejecuta ningún banco ni se comparan mutaciones.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  leerFicherosDeMutacion, clasificar, leerHistoria, juicio, corteDe, fichaDelHeredado, RUTAS_DEL_CORTE,
  cegueraDelCorte, CORTE_EN_MAIN,
} from './_catalogo-obligatorio.mjs';
import { temporalDeFixtureGit, gitDeFixture } from './_censo-fixture.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Nada está fuera nunca: dejan de verse los bancos con lista propia.
    fichero: 'tests/_catalogo-obligatorio.mjs',
    de: 'const fuera = guiones.length > 0 && !usaCatalogo;',
    a: 'const fuera = false;',
    cae: 'el clasificador separa el banco con lista propia del que toma las del test',
  },
  {
    // Lo que entra después del corte deja de ser nuevo: todo lo que esté en un commit pasa.
    fichero: 'tests/_catalogo-obligatorio.mjs',
    de: 'return corte !== null && alta.pos > corte;',
    a: 'return false;',
    cae: 'un banco que entra después del corte sale nombrado, con su carpeta y su guion',
  },
  {
    // Lo que aún no está en ningún commit deja de ser nuevo: el sembrado del árbol no sale.
    fichero: 'tests/_catalogo-obligatorio.mjs',
    de: 'if (!alta) return true;',
    a: 'if (!alta) return false;',
    cae: 'un guion que todavía no está en ningún commit es nuevo',
  },
  {
    // SCRUM-1548: cualquier corte vale, también el del merge local de una rama. Vuelve el falso verde.
    fichero: 'tests/_catalogo-obligatorio.mjs',
    de: 'if (nace.sha !== CORTE_EN_MAIN) {',
    a: 'if (false) {',
    cae: 'un corte que no es el de la línea principal es CIEGO, y dice cuál salió y cuál esperaba',
  },
  {
    // SCRUM-1548: la función sigue sabiendo, pero la historia ya no la consulta: el canal se queda mudo.
    fichero: 'tests/_catalogo-obligatorio.mjs',
    de: 'return { ...historia, ciego: cegueraDelCorte(corteDe(historia)) };',
    a: 'return historia;',
    cae: 'una historia de verdad con otro corte que el de la línea principal sale CIEGA por el canal de siempre',
  },
];

// Un árbol fabricado en memoria: uno fuera, uno que toma las del test, uno sólo con salidas.
const FABRICADO = [
  { ruta: 'docs/master/evidencias/scrumA/mutar.mjs', texto: 'const LISTA = [{ de: "x", a: "y" }];' },
  { ruta: 'docs/master/evidencias/scrumA/salida-mut.txt', texto: '' },
  { ruta: 'docs/master/evidencias/scrumB/mutar.mjs', texto: 'import { MUTACIONES_QUE_ME_TUMBAN } from "../../../../tests/x.test.mjs";' },
  { ruta: 'docs/evidencias/scrumC/salida-mutada.txt', texto: '' },
];
const GUION_A = 'docs/master/evidencias/scrumA/mutar.mjs';
const alta = (pos) => ({ pos, sha: 'f'.repeat(40), fecha: '2026-10-13T00:00:00Z' });

test('SCRUM-1387 · el clasificador separa el banco con lista propia del que toma las del test', () => {
  const r = clasificar(FABRICADO);
  assert.equal(r.ficheros, 4);
  assert.deepEqual(r.bancos.map((b) => b.carpeta), [
    'docs/evidencias/scrumC', 'docs/master/evidencias/scrumA', 'docs/master/evidencias/scrumB',
  ]);
  assert.deepEqual(r.fuera.map((b) => b.carpeta), ['docs/master/evidencias/scrumA']);
});

test('SCRUM-1387 · un banco que entra después del corte sale nombrado, con su carpeta y su guion', () => {
  const { fuera } = clasificar(FABRICADO);
  const despues = juicio({ fuera, altaDe: () => alta(11), corte: 10 });
  assert.deepEqual(despues.nuevos, [{ carpeta: 'docs/master/evidencias/scrumA', guiones: [GUION_A] }]);
  assert.deepEqual(despues.heredados, []);
  // El que entró en el mismo commit que el corte, o antes, es heredado: no sale.
  for (const pos of [10, 9, 1]) {
    const antes = juicio({ fuera, altaDe: () => alta(pos), corte: 10 });
    assert.deepEqual(antes.nuevos, [], `pos ${pos}`);
    assert.deepEqual(antes.heredados.map((b) => b.carpeta), ['docs/master/evidencias/scrumA'], `pos ${pos}`);
  }
});

test('SCRUM-1387 · un guion que todavía no está en ningún commit es nuevo', () => {
  const { fuera } = clasificar(FABRICADO);
  for (const corte of [10, null]) {
    const j = juicio({ fuera, altaDe: () => undefined, corte });
    assert.deepEqual(j.nuevos.map((b) => b.carpeta), ['docs/master/evidencias/scrumA'], `corte ${corte}`);
  }
  // Y mientras el corte no exista (el fichero del corte sin comitear), lo que ya está en la historia no lo es.
  assert.deepEqual(juicio({ fuera, altaDe: () => alta(999), corte: null }).nuevos, []);
});

test('SCRUM-1387 · a un banco heredado le entra un guion nuevo: sale, y nombra sólo ese guion', () => {
  const otro = 'docs/master/evidencias/scrumA/mutar-otra-vez.mjs';
  const { fuera } = clasificar([...FABRICADO, { ruta: otro, texto: 'const MIAS = [];' }]);
  const j = juicio({ fuera, altaDe: (r) => (r === otro ? alta(11) : alta(3)), corte: 10 });
  assert.deepEqual(j.nuevos, [{ carpeta: 'docs/master/evidencias/scrumA', guiones: [otro] }]);
});

test('SCRUM-1387 · el corte es la entrada MÁS VIEJA de las rutas que este fichero ha tenido', () => {
  const nacimientos = new Map([['tests/_catalogo-obligatorio.mjs', alta(10)]]);
  assert.equal(corteDe({ nacimientos }).pos, 10);
  assert.equal(corteDe({ nacimientos: new Map() }), null);
  // La ruta de hoy está entre las declaradas: si se mueve el fichero sin añadirla, el corte se perdería.
  const hoy = path.relative(RAIZ, fileURLToPath(new URL('./_catalogo-obligatorio.mjs', import.meta.url))).replace(/\\/g, '/');
  assert.ok(RUTAS_DEL_CORTE.includes(hoy),
    `${hoy} no está en RUTAS_DEL_CORTE. AÑÁDELA y no quites la vieja: quitarla mueve el corte y convierte `
    + 'en heredado todo banco que entró entre medias (SCRUM-1387, comentario 19366).');
  assert.equal(RUTAS_DEL_CORTE[0], 'tests/_catalogo-obligatorio.mjs', 'la ruta con la que nació no se quita');
});

test('SCRUM-1548 · un corte que no es el de la línea principal es CIEGO, y dice cuál salió y cuál esperaba', () => {
  // El caso medido en el ticket: el corte resuelto al merge local de la rama.
  const local = 'b043b2a3a' + '0'.repeat(31);
  const dicho = cegueraDelCorte({ pos: 2741, sha: local, fecha: '2026-10-14T03:02:38Z' });
  assert.equal(typeof dicho, 'string');
  assert.ok(dicho.includes('b043b2a3a') && dicho.includes(CORTE_EN_MAIN.slice(0, 9)), dicho);
  // Sin corte en la línea (el guard copiado a un árbol que no lo tiene en su historia) tampoco se juzga.
  assert.equal(typeof cegueraDelCorte(null), 'string');
  // EL NEGATIVO: con el corte de main, la MISMA función no dice nada, esté donde esté en la línea.
  for (const pos of [1, 2741, 99999]) {
    assert.equal(cegueraDelCorte({ pos, sha: CORTE_EN_MAIN, fecha: '2026-10-14T02:04:37Z' }), null, `pos ${pos}`);
  }
  assert.match(CORTE_EN_MAIN, /^[0-9a-f]{40}$/, 'el corte va entero: un prefijo no es un nombre');
});

test('SCRUM-1548 · una historia de verdad con otro corte que el de la línea principal sale CIEGA por el canal de siempre', () => {
  // SEMBRADO, con git de verdad: un repositorio fabricado aquí, en el que este guard entra en un commit
  // que no puede ser el de main. No se presta de ninguna rama real. ⚠️ LÍMITE: no reproduce la forma del
  // merge (eso está medido en `docs/master/evidencias/SCRUM-1548/`); prueba que `leerHistoria` PREGUNTA.
  const repo = temporalDeFixtureGit('scrum1548-');
  const g = (...args) => gitDeFixture(['-c', 'user.name=banco', '-c', 'user.email=banco@yaqu.test',
    '-c', 'commit.gpgsign=false', ...args], { cwd: repo });
  g('init', '-q');
  fs.writeFileSync(path.join(repo, 'LEEME.md'), 'sembrado\n');
  g('add', '-A');
  g('commit', '-q', '-m', 'antes del guard');
  // Todavía sin guard en la historia: no hay corte, y lo dice.
  const sinCorte = leerHistoria(repo);
  assert.equal(sinCorte.commits, 1);
  assert.match(String(sinCorte.ciego), /no entró en ningún commit/);
  fs.mkdirSync(path.join(repo, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(repo, RUTAS_DEL_CORTE[0]), '// sembrado\n');
  g('add', '-A');
  g('commit', '-q', '-m', 'entra el guard en otra historia');
  const suCorte = g('rev-parse', 'HEAD').trim();
  const h = leerHistoria(repo);
  // Leyó (no es el ciego de «git no contesta»): ve los dos commits y el corte, y AUN ASÍ no juzga.
  assert.equal(h.commits, 2);
  assert.equal(corteDe(h).sha, suCorte);
  assert.match(String(h.ciego), /no es la línea principal/);
  assert.ok(h.ciego.includes(suCorte.slice(0, 9)), h.ciego);
});

test('SCRUM-1387 · 🔴 en el árbol: ningún banco de mutación nuevo queda fuera del catálogo', (t) => {
  const historia = leerHistoria(RAIZ);
  // EL NEGATIVO de SCRUM-1548 vive aquí: en main y en el merge que prueba CI esto es `null` y se decide.
  assert.equal(historia.ciego, null,
    `CIEGO: con la historia de git de este árbol no sé qué banco es nuevo (${historia.ciego}). No he mirado nada.`);
  const ficheros = leerFicherosDeMutacion(RAIZ);
  const { bancos, fuera } = clasificar(ficheros);
  // SUELO: no haber visto nada no es estar limpio.
  assert.ok(ficheros.length > 0 && bancos.length > 0 && historia.commits > 1 && historia.altas.size > 0,
    `CIEGO: he leído ${ficheros.length} ficheros con «mut» en el nombre en ${bancos.length} carpetas, y `
    + `${historia.altas.size} altas en ${historia.commits} commits. No he mirado nada.`);
  const altaDe = (ruta) => historia.altas.get(ruta);
  const nace = corteDe(historia);
  const corte = nace.pos;

  // EL POSITIVO, SEMBRADO AQUÍ Y EN CADA PASADA: un banco fabricado que no existe en el árbol ni en
  // la historia pasa por el mismo camino que los de verdad y TIENE que salir. No se toma prestado de
  // ningún banco real: el día que alguien registre el último, esto seguiría midiendo.
  const SEMBRADO = 'docs/master/evidencias/__sembrado-por-scrum1387__';
  const conSiembra = clasificar([...ficheros, { ruta: `${SEMBRADO}/mutar.mjs`, texto: 'const LISTA_PROPIA = [];' }]);
  const vistos = juicio({ fuera: conSiembra.fuera, altaDe, corte });
  assert.deepEqual(vistos.nuevos.filter((b) => b.carpeta === SEMBRADO),
    [{ carpeta: SEMBRADO, guiones: [`${SEMBRADO}/mutar.mjs`] }],
    'CIEGO: el banco sembrado por este test no ha salido como nuevo. El camino no ve lo que tiene que ver.');
  // Y el otro camino, el que ve el CI de un PR: uno que SÍ está en la historia, un commit después del
  // corte. (Desde SCRUM-1548 hay corte siempre que se llega aquí, y es el de main: si no, ya dijo CIEGO.)
  {
    const TARDIO = `${SEMBRADO}/tardio`;
    const conTardio = clasificar([...ficheros, { ruta: `${TARDIO}/mutar.mjs`, texto: 'const LISTA_PROPIA = [];' }]);
    const altaConTardio = (ruta) => (ruta === `${TARDIO}/mutar.mjs` ? { pos: corte + 1, sha: '', fecha: nace.fecha } : altaDe(ruta));
    assert.deepEqual(juicio({ fuera: conTardio.fuera, altaDe: altaConTardio, corte }).nuevos.filter((b) => b.carpeta === TARDIO),
      [{ carpeta: TARDIO, guiones: [`${TARDIO}/mutar.mjs`] }],
      'CIEGO: un banco sembrado un commit DESPUÉS del corte no ha salido como nuevo.');
  }

  const { nuevos, heredados } = juicio({ fuera, altaDe, corte });
  assert.equal(nuevos.length + heredados.length, fuera.length, 'nuevos y heredados no suman los que están fuera');
  const fichas = heredados.map((b) => fichaDelHeredado(b, altaDe));
  const poblacion = `población: ${ficheros.length} ficheros con «mut» en el nombre · ${bancos.length} bancos · `
    + `${fuera.length} fuera · ${heredados.length} heredados · ${nuevos.length} nuevos · historia de `
    + `${historia.commits} commits · corte ${nace.sha.slice(0, 9)} (${nace.fecha})`;
  t.diagnostic(poblacion);
  for (const f of fichas) t.diagnostic(`heredado · ${f.carpeta} · ${f.motivo} · desde ${f.desde} · retira: ${f.retira}`);
  assert.deepEqual(nuevos.map((b) => `${b.carpeta} → ${b.guiones.join(', ')}`), [],
    'ESTE banco de mutación trae su lista propia, su guion no nombra el catálogo del meta-guard y ha '
    + `entrado después que la regla (${poblacion}). Regístralo: que el test del ticket exporte `
    + 'MUTACIONES_QUE_ME_TUMBAN y el guion las tome de ahí. ⛔ No hay lista de excepciones a la que '
    + 'añadirlo: los heredados salen de la historia y sólo menguan (SCRUM-1387, comentarios 18016 y 19366).');
});
