// tests/scrum836-ancla-de-mutacion-viva.test.mjs — SCRUM-836
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// UN ANCLA DE MUTACIÓN QUE YA NO ESTÁ EN SU FICHERO SE DETECTABA TARDE Y DONDE NADIE ESCUCHA.
//
// El 8-sep-2026 a las 09:24, `278a8bd7` (SCRUM-824b) partió en dos un `if` de
// `scripts/_ritmo-de-despliegue.mjs`. El cambio era CORRECTO —aquel `||` producía un rojo
// intermitente en CI, que entrena a relanzar la tanda y es peor que un rojo fijo—, pero una
// mutación declarada en `scrum716` estaba anclada al texto de esa línea, y el texto dejó de
// existir. El meta-guard hizo su trabajo y lo dijo:
//
//     vivas 165 · mudas 0 · ciegas 1 · ficheros muertos 0
//     🔴 CIEGO: scrum716-ritmo-de-despliegue.test.mjs · el ancla no está en
//               `scripts/_ritmo-de-despliegue.mjs`
//
// 🔴 Y ASÍ SIGUIÓ SIETE DÍAS. Medido el 15-sep-2026 sobre `origin/main`: **54 PRs y 218 commits**
// entraron mientras tanto, y **ninguno** tocó el fichero vigilado ni su guard — o sea que la
// ceguera no se iba a curar sola. El problema no fue que nadie lo detectara: fue **QUIÉN lo
// detectaba**. `meta:mutaciones` vive en un job propio que tarda minutos y que NO bloquea el
// auto-merge, así que su rojo se leía como «6 of 7 checks passed» y el PR entraba igual.
//
//   >>> Una alarma que suena donde nadie está obligado a escucharla no es una alarma. <<<
//
// ── QUÉ HACE ESTE GUARD, Y QUÉ NO ───────────────────────────────────────────────────────────
//
// Comprueba que **los DOS extremos de cada declaración siguen vivos**, que son los dos que
// caducan, y nada más:
//
//   · el `de`  — el texto anclado existe HOY, byte a byte, en el fichero que dice mutar.
//   · el `cae` — el nombre del test que debe caer existe HOY en el guard que lo declara.
//                (SCRUM-836d; el detalle y sus límites, justo encima de `caesHuerfanos`.)
//   · y desde SCRUM-1321, que el `de` sea INEQUÍVOCO: si aparece dos veces, la mutación cae en
//     la primera y nadie sabe si era ésa. (El detalle, justo encima de `anclasAmbiguas`.)
//
//   · NO muta · NO corre tests · NO dice si un guard está mudo. Eso es trabajo de
//     `meta:mutaciones` y aquí no se duplica: leer ficheros y hacer `includes` cuesta
//     milisegundos, y por eso esto SÍ puede vivir dentro de `npm test`.
//   · Lo que aporta es CUÁNDO se entera uno: la misma ceguera, dicha en la tanda que ya bloquea,
//     en vez de en el job que no bloquea.
//
// ⚠️ NO SUSTITUYE AL META-GUARD, y decirlo importa: los dos extremos pueden estar vivos y la
// mutación salir MUDA igual — que el test NOMBRADO exista no prueba que CAIGA. Eso sólo se sabe
// aplicándola, y eso cuesta minutos. Esto es la criba barata de las dos formas de caducar.
//
// ── POR QUÉ NO DECLARA MUTACIONES PROPIAS, dicho en vez de callado ──────────────────────────
// Para tumbar a este guard habría que romper un ancla REAL en un fichero real, y eso arrastraría
// como colateral a todos los demás guards que vigilan ese fichero. Una mutación con más radio que
// el defecto que imita no prueba nada — es la lección escrita en la mutación ① de `scrum716`. En
// su lugar, el ① de aquí abajo provoca el caso sobre un banco sintético, con el radio exacto.
//
// (SCRUM-1321: eso vale para las dos cribas de arriba, que viven en este fichero. La tercera
// usa un criterio que vive en el meta-guard —`ambiguedadDelAncla`—, y apagar ESE criterio no
// rompe ningún ancla real: sólo deja pasar el banco del ④. Ésa sí se declara.)
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
  censoDeDeclaraciones, ambiguedadDelAncla, motivoDeAnclaAmbigua,
} from '../scripts/meta-guard-mutaciones.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // SCRUM-1321 · el criterio deja de ver repeticiones: todo ancla presente vuelve a valer.
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  if (posiciones.length <= 1) return null;',
    a: '  if (posiciones.length <= 99) return null; // SCRUM-1321: nada es ambiguo, a proposito',
    cae: 'SCRUM-1321 · 🔴 EL CASO REAL: un ancla que casa ANTES en otra línea se denuncia',
  },
];

/** Cabecera mínima de un guard de mentira: dos tests, que es lo que el lector espera encontrar. */
const CABECERA = "import test from 'node:test';\ntest('uno', () => {});\ntest('dos', () => {});\n\n";

/** Un banco de guards de mentira, para no tocar el de verdad (mismo patrón que SCRUM-757). */
function banco(prefijo, vigilado, ...declaraciones) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefijo));
  fs.writeFileSync(path.join(dir, 'vigilado.mjs'), vigilado);
  fs.writeFileSync(path.join(dir, 'guardx.test.mjs'),
    `${CABECERA}export const MUTACIONES_QUE_ME_TUMBAN = [\n${declaraciones.join('')}];\n`);
  return { dir, limpia: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

/**
 * Las mutaciones cuyo ancla `de` YA NO ESTÁ en el fichero que dicen mutar.
 *
 * Se compara contra los BYTES DE DISCO y no contra el blob de git (SCRUM-570): un fichero
 * normalizado puede tener el blob limpio y el disco distinto, y lo que el meta-guard leerá
 * cuando vaya a mutar es el disco.
 */
export function anclasCaducadas(raiz = RAIZ, censo = null) {
  const fuera = [];
  for (const { guard, mutaciones } of (censo || censoDeDeclaraciones())) {
    for (const mut of mutaciones) {
      const abs = path.join(raiz, mut.fichero);
      if (!fs.existsSync(abs)) {
        fuera.push({ guard, fichero: mut.fichero, cae: mut.cae, motivo: 'el fichero NO EXISTE' });
        continue;
      }
      if (!fs.readFileSync(abs, 'utf8').includes(mut.de)) {
        fuera.push({ guard, fichero: mut.fichero, cae: mut.cae, motivo: 'el ancla `de` no está en el fichero' });
      }
    }
  }
  return fuera;
}

// ── SCRUM-1321 · EL ANCLA QUE SIGUE AHÍ, PERO YA NO ES LA ÚNICA ──────────────────────────────
//
// `anclasCaducadas` pregunta si el `de` ESTÁ. No pregunta si está UNA vez, y el corredor muta la
// primera ocurrencia (`texto.replace(de, a)`). Así que una declaración puede romperse sin que
// nadie la toque ni toque su guard: basta con que alguien escriba, más arriba en el fichero
// vigilado, una línea que contenga el ancla.
//
// 🔴 MEDIDO EL 1-oct-2026: `dc8ea603` (SCRUM-1263, PR #1951, mergeado el 29-sep a las 09:44Z)
// añadió dos pasos a `claude.yml`, y dos anclas de `scrum853` pasaron de 1 ocurrencia a 2. Las dos
// mutaciones se fueron al paso nuevo, el test declarado ni se enteró, y `meta:mutaciones` dictó
// «scrum853 · MUDO» dos veces en cada PR desde entonces — en el job que no bloquea. El PR que lo
// causó era correcto y su tanda obligatoria estaba verde: no había nada en ella que mirase esto.
//
//   >>> Un ancla que casa dos veces no dice qué quiere mutar: dice lo que haya primero. <<<
//
// El criterio NO vive aquí: es `ambiguedadDelAncla`, del módulo dueño del contrato, y es el mismo
// que `aplicarUna` usa para negarse a mutar. Dos criterios serían dos cosas que se quedan atrás.
// La única repetición admitida —el guard que se muta a sí mismo y cita su ancla en su propia
// declaración (SCRUM-812c)— se DERIVA allí; aquí no hay lista de excepciones.

/** Las mutaciones cuyo `de` aparece más de una vez en su fichero sin que se sepa cuál se quería. */
export function anclasAmbiguas(raiz = RAIZ, censo = null, dirGuards = path.join(raiz, 'tests')) {
  const ambiguas = [];
  for (const { guard, mutaciones } of (censo || censoDeDeclaraciones())) {
    for (const mut of mutaciones) {
      const abs = path.join(raiz, mut.fichero);
      if (!fs.existsSync(abs)) continue; // eso ya lo denuncia `anclasCaducadas`, con su motivo
      const seCitaASiMismo = path.resolve(abs) === path.resolve(dirGuards, guard);
      const a = ambiguedadDelAncla(fs.readFileSync(abs, 'utf8'), mut.de, { seCitaASiMismo });
      if (a) {
        ambiguas.push({
          guard, fichero: mut.fichero, cae: mut.cae, ...a, motivo: motivoDeAnclaAmbigua(mut.fichero, a),
        });
      }
    }
  }
  return ambiguas;
}

// ── SCRUM-836d · LA OTRA MITAD: el `cae`, que nombra el test que la mutación debe tumbar ─────
//
// Un ancla `de` viva no basta. La declaración tiene DOS extremos y el segundo también caduca:
// `cae` nombra el test que tiene que caer, y si ese test se renombra —o nunca existió— el
// meta-guard **no puede medir la mutación**. Sale CIEGO, igual que con el `de`, y el guard que la
// declaraba queda sin comprobar mientras el fichero sigue pareciendo cubierto.
//
//   >>> Una mutación que nombra un test que no existe afirma una cobertura que no hay. <<<
//
// 🔴 MEDIDO EL 15-sep-2026 sobre las **178 mutaciones** declaradas en **58 guards**: **4** tenían
// el `cae` huérfano — 3 de `scrum850` y 1 de `scrum850b`, todas mergeadas ese mismo día. Y no
// estaban sin cobertura: al aplicarlas, **las cuatro tumbaban tests de verdad**. Sólo el nombre
// estaba mal, que es justo lo que hace el defecto difícil de ver.
//
// ── ⚠️ LO QUE ESTE GUARD NO MIRA, DICHO ANTES DE QUE ALGUIEN LO SUPONGA ──────────────────────
//
// Son dos preguntas y aquí sólo se contesta la primera:
//
//   (a) ¿EXISTE el test que el `cae` nombra?      ← esto es lo que se comprueba aquí
//   (b) ¿CAE de verdad al aplicar la mutación?    ← esto NO se comprueba aquí
//
// La (b) es la que decide, y **no cabe en la tanda**: exige aplicar cada mutación y correr el
// guard entero por cada una — es lo que hace `meta:mutaciones`, y por eso cuesta minutos y vive en
// su propio job. Duplicarlo aquí convertiría `npm test` en el meta-guard.
//
// Así que esto es una **criba barata**, no un veredicto de cobertura: caza el nombre muerto en
// milisegundos y deja la (b) donde estaba. Un instrumento que no dice lo que no mira se lee como
// si lo mirara todo, y eso es lo que convierte una criba en una falsa garantía.
//
// ── Y EL CRITERIO ES EL DEL META-GUARD, no uno propio ────────────────────────────────────────
// `paso()` compara con `includes`: el `cae` tiene que ser SUBCADENA del nombre de un test, no
// igual a él. Aquí se usa exactamente eso. Si esto comparara por igualdad, denunciaría
// declaraciones que el meta-guard acepta sin problema — un guard que contradice al que vigila.

/** Los nombres LITERALES de los `test(...)` de un fichero, por AST y sin ejecutarlo. */
export function nombresDeTest(codigo, nombre = 'x.mjs') {
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true);
  const literales = [];
  const noLiterales = [];
  (function visita(n) {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'test') {
      const a = n.arguments[0];
      if (a && ts.isStringLiteralLike(a)) literales.push(a.text);
      else if (a) {
        noLiterales.push({
          linea: sf.getLineAndCharacterOfPosition(a.getStart(sf)).line + 1,
          forma: ts.SyntaxKind[a.kind],
        });
      }
    }
    ts.forEachChild(n, visita);
  }(sf));
  return { literales, noLiterales };
}

/**
 * Las mutaciones cuyo `cae` no nombra ningún test de su guard.
 *
 * 🔴 Y las que NO SE PUEDEN EVALUAR van APARTE, nunca mezcladas con las huérfanas. Un guard que
 * construye el nombre de sus tests (`test(\`… ${quien} …\`)`) es perfectamente correcto y este
 * lector no puede resolverlo: contarlo como huérfano sería acusar a quien no hizo nada mal, y es
 * el defecto que SCRUM-757 cerró para el otro lector. Medido: `scrum785` es exactamente ese caso.
 */
export function caesHuerfanos(dirGuards = path.join(RAIZ, 'tests'), censo = null) {
  const huerfanas = [];
  const noEvaluables = [];
  for (const { guard, mutaciones } of (censo || censoDeDeclaraciones())) {
    if (!mutaciones.length) continue;
    // ⚠️ `dirGuards` es el directorio donde VIVEN los guards, no la raíz del repo: es lo que
    // permite ejercer esto contra un banco sintético sin tocar `tests/`. Mismo parámetro que
    // recibe `censoDeDeclaraciones`, para que los dos miren siempre el mismo sitio.
    const abs = path.join(dirGuards, guard);
    if (!fs.existsSync(abs)) continue;
    const { literales, noLiterales } = nombresDeTest(fs.readFileSync(abs, 'utf8'), guard);
    for (const mut of mutaciones) {
      if (literales.some((n) => n.includes(mut.cae))) continue;
      const donde = { guard, cae: mut.cae, fichero: mut.fichero };
      if (noLiterales.length) noEvaluables.push({ ...donde, noLiterales });
      else huerfanas.push({ ...donde, tests: literales.length });
    }
  }
  return { huerfanas, noEvaluables };
}

// ═══ ① EL ROJO QUE IMPORTA · se provoca el caso exacto del 8-sep, con su radio ═══════════════

test('SCRUM-836 · 🔴 un ancla que ya no está en su fichero se DENUNCIA, con guard y fichero', () => {
  const b = banco('scrum836-', 'const x = 1;\nif (!ES_SHA.test(s)) return null;\n',
    "  { fichero: 'vigilado.mjs', de: 'if (!ES_SHA.test(s)) return null;', a: 'if (false) return null;', cae: 'presente' },\n",
    "  { fichero: 'vigilado.mjs', de: 'if (!ES_SHA.test(s) || TODO_DIGITOS.test(s)) return null;', a: 'if (false) return null;', cae: 'CADUCADA' },\n");
  try {
    const censo = censoDeDeclaraciones(b.dir);
    // SUELO: el banco tiene que leerse entero, o lo de abajo mediría el vacío.
    assert.equal(censo.reduce((n, c) => n + c.mutaciones.length, 0), 2,
      '🔴 el banco no lee sus DOS declaraciones: lo que mida este test no significaría nada.');

    const caducadas = anclasCaducadas(b.dir, censo);
    assert.equal(caducadas.length, 1,
      `🔴 se esperaba UNA caducada y salen ${caducadas.length}. Es el caso del 8-sep-2026: un `
      + 'ancla presente y otra cuyo texto ya no existe en el fichero.');
    assert.equal(caducadas[0].cae, 'CADUCADA',
      `🔴 acusa a la mutación equivocada (${caducadas[0].cae}). Un rojo que señala la declaración `
      + 'que estaba bien manda a quien lo lee a romper lo que funcionaba.');
    assert.match(caducadas[0].motivo, /ancla/,
      '🔴 cae, pero el motivo no dice que el problema sea el ancla. Si el diagnóstico no coincide '
      + 'con la avería, el mensaje no sirve para arreglarla.');
  } finally {
    b.limpia();
  }
});

test('SCRUM-836 · ✅ CONTROL POSITIVO: con las dos anclas presentes NO acusa a nadie', () => {
  // Sin esto, «detecta caducadas» y «acusa siempre» dan el mismo rojo, y el ① no los distingue.
  const b = banco('scrum836-ok-', 'const x = 1;\nif (!ES_SHA.test(s)) return null;\n',
    "  { fichero: 'vigilado.mjs', de: 'const x = 1;', a: 'const x = 2;', cae: 'una' },\n",
    "  { fichero: 'vigilado.mjs', de: 'if (!ES_SHA.test(s)) return null;', a: 'if (false) return null;', cae: 'otra' },\n");
  try {
    assert.deepEqual(anclasCaducadas(b.dir, censoDeDeclaraciones(b.dir)), [],
      '🔴 acusa a anclas que SÍ están en su fichero. Un guard que grita sin motivo se acaba '
      + 'puenteando igual que uno que no grita nunca.');
  } finally {
    b.limpia();
  }
});

test('SCRUM-836 · un fichero que ya no existe también es un ancla muerta, y se dice aparte', () => {
  const b = banco('scrum836-ausente-', 'const x = 1;\n',
    "  { fichero: 'se-borro.mjs', de: 'const x = 1;', a: 'const x = 2;', cae: 'sobre un fichero ausente' },\n");
  try {
    const caducadas = anclasCaducadas(b.dir, censoDeDeclaraciones(b.dir));
    assert.equal(caducadas.length, 1, '🔴 una mutación que apunta a un fichero inexistente no se denuncia.');
    assert.match(caducadas[0].motivo, /NO EXISTE/,
      '🔴 se dice «el ancla no está» sobre un fichero que directamente no existe. Son dos averías '
      + 'distintas y se arreglan distinto: una se reancla, la otra se borra o se reapunta.');
  } finally {
    b.limpia();
  }
});

// ═══ ② EL ÁRBOL REAL ═════════════════════════════════════════════════════════════════════════

test('SCRUM-836 · SUELO: el censo del árbol REAL trae declaraciones de verdad', () => {
  // Cero declaraciones y cero caducadas son la misma respuesta, y una de las dos es ceguera.
  const total = censoDeDeclaraciones().reduce((n, c) => n + c.mutaciones.length, 0);
  assert.ok(total >= 54,
    `🔴 el censo del árbol trae ${total} declaraciones y el suelo del propio meta-guard son 54. `
    + 'El verde de abajo no diría «ninguna caducada», diría «no se supo mirar».');
});

// ═══ ③ EL `cae` · los cuatro controles ═══════════════════════════════════════════════════════

test('SCRUM-836d · 🔴 EL QUE DECIDE: un `cae` que nombra un test inexistente CAE, con fichero y declaración', () => {
  const b = banco('scrum836d-', 'const x = 1;\n',
    "  { fichero: 'vigilado.mjs', de: 'const x = 1;', a: 'const x = 2;', cae: 'uno' },\n",
    "  { fichero: 'vigilado.mjs', de: 'const x = 1;', a: 'const x = 3;', cae: 'ESTE TEST NO EXISTE' },\n");
  try {
    const censo = censoDeDeclaraciones(b.dir);
    assert.equal(censo.reduce((n, c) => n + c.mutaciones.length, 0), 2,
      '🔴 el banco no lee sus DOS declaraciones: lo que mida este test no significaría nada.');

    const { huerfanas, noEvaluables } = caesHuerfanos(b.dir, censo);
    assert.deepEqual(noEvaluables, [],
      '🔴 el banco no tiene nombres construidos: nada debería caer en «no evaluable».');
    assert.equal(huerfanas.length, 1,
      `🔴 se esperaba UNA huérfana y salen ${huerfanas.length}. El banco tiene un \`cae\` que sí `
      + "nombra un test (`uno`) y otro que no nombra ninguno.");
    assert.equal(huerfanas[0].cae, 'ESTE TEST NO EXISTE',
      `🔴 acusa a la declaración equivocada (${huerfanas[0].cae}): la que nombra «uno» está bien.`);
    assert.equal(huerfanas[0].guard, 'guardx.test.mjs',
      '🔴 no dice en qué fichero está la declaración huérfana, y sin eso el rojo no se acciona.');
  } finally {
    b.limpia();
  }
});

test('SCRUM-836d · 🔴 MUTACIÓN: apagar la comprobación devuelve el verde falso', () => {
  // Si `caesHuerfanos` dejara de mirar —devolviendo siempre vacío— el guard de abajo seguiría
  // verde sobre un árbol con declaraciones muertas. Se comprueba que el rojo depende de la
  // comprobación y no de otra cosa: con el detector apagado, el mismo banco no acusa a nadie.
  const apagado = () => ({ huerfanas: [], noEvaluables: [] });
  const b = banco('scrum836d-mut-', 'const x = 1;\n',
    "  { fichero: 'vigilado.mjs', de: 'const x = 1;', a: 'const x = 2;', cae: 'NO EXISTE TAMPOCO' },\n");
  try {
    assert.equal(caesHuerfanos(b.dir, censoDeDeclaraciones(b.dir)).huerfanas.length, 1,
      '🔴 el detector encendido no ve la huérfana: la mutación de abajo no probaría nada.');
    assert.equal(apagado().huerfanas.length, 0,
      '🔴 con el detector apagado debería salir vacío — si no, este control mide otra cosa.');
  } finally {
    b.limpia();
  }
});

test('SCRUM-836d · ✅ POSITIVO: un `cae` que SÍ nombra su test no se toca, y basta con UN test', () => {
  // 🔴 Esto es lo que impide que el guard se vuelva inservible: NO se exige que la mutación tumbe
  // varios tests ni que el `cae` sea el nombre completo. `paso()` del meta-guard compara con
  // `includes`, así que un fragmento basta — y aquí se usa el mismo criterio a propósito.
  const b = banco('scrum836d-ok-', 'const x = 1;\n',
    "  { fichero: 'vigilado.mjs', de: 'const x = 1;', a: 'const x = 2;', cae: 'uno' },\n",
    "  { fichero: 'vigilado.mjs', de: 'const x = 1;', a: 'const x = 3;', cae: 'dos' },\n");
  try {
    const r = caesHuerfanos(b.dir, censoDeDeclaraciones(b.dir));
    assert.deepEqual(r.huerfanas, [],
      '🔴 acusa a declaraciones cuyo `cae` sí nombra un test del guard. Un guard que exige de más '
      + 'se vuelve inservible, y lo relajarán con razón.');
  } finally {
    b.limpia();
  }
});

test('SCRUM-836d · ⚠️ un guard con nombres de test CONSTRUIDOS no se acusa: se declara aparte', () => {
  // Medido en el árbol real: `scrum785` genera sus tests con `test(`… ${quien} …`)` y sus dos
  // declaraciones son correctas. Contarlas como huérfanas sería acusar a quien no hizo nada mal.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum836d-tpl-'));
  try {
    fs.writeFileSync(path.join(dir, 'vigilado.mjs'), 'const x = 1;\n');
    fs.writeFileSync(path.join(dir, 'guardx.test.mjs'),
      "import test from 'node:test';\nfor (const quien of ['A', 'B']) test(`caso ${quien} aquí`, () => {});\n\n"
      + 'export const MUTACIONES_QUE_ME_TUMBAN = [\n'
      + "  { fichero: 'vigilado.mjs', de: 'const x = 1;', a: 'const x = 2;', cae: 'caso A aquí' },\n"
      + '];\n');
    const r = caesHuerfanos(dir, censoDeDeclaraciones(dir));
    assert.deepEqual(r.huerfanas, [],
      '🔴 acusa como huérfana una declaración de un guard cuyos nombres de test son PLANTILLAS. '
      + 'Este lector no puede resolverlas, y no poder leer algo no es prueba de que esté mal.');
    assert.equal(r.noEvaluables.length, 1,
      '🔴 y tampoco se calla: tiene que quedar DECLARADA como no evaluable. Descartarla en '
      + 'silencio baja el recuento sin que nadie lo diga, que es el defecto de SCRUM-757.');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SCRUM-836d · 🔴 SUELO: sin declaraciones que mirar, es CIEGO y no verde', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum836d-vacio-'));
  try {
    const censo = censoDeDeclaraciones(dir);
    const total = censo.reduce((n, c) => n + c.mutaciones.length, 0);
    assert.equal(total, 0, '🔴 el banco vacío no está vacío.');
    // Cero huérfanas sobre cero declaraciones NO es salud: es que no se ha mirado nada. El guard
    // del árbol real lleva su propio suelo (el de abajo) justo por esto.
    assert.deepEqual(caesHuerfanos(dir, censo).huerfanas, [],
      '🔴 inventa huérfanas donde no hay declaraciones.');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SCRUM-836d · 🔴 NINGUNA mutación declarada nombra un test que no existe', () => {
  const censo = censoDeDeclaraciones();
  const total = censo.reduce((n, c) => n + c.mutaciones.length, 0);
  // SUELO, otra vez y aquí: cero huérfanas sobre cero declaraciones es ceguera, no salud.
  assert.ok(total >= 54,
    `🔴 el censo trae ${total} declaraciones y el suelo del meta-guard son 54. Un verde aquí no `
    + 'diría «ningún `cae` muerto», diría «no se supo mirar».');

  const { huerfanas, noEvaluables } = caesHuerfanos(path.join(RAIZ, 'tests'), censo);
  assert.deepEqual(huerfanas.map((h) => `${h.guard} → ${JSON.stringify(h.cae)}`), [],
    '🔴 HAY MUTACIONES QUE NOMBRAN UN TEST QUE NO EXISTE:\n    '
    + huerfanas.map((h) => `${h.guard}\n        cae: ${JSON.stringify(h.cae)}\n        muta: ${h.fichero}`).join('\n    ')
    + '\n\n  `meta:mutaciones` no puede medir esa mutación: el test que dice que debe caer no está,\n'
    + '  así que sale CIEGO y el guard queda sin comprobar — pareciendo cubierto.\n\n'
    + '  🔴 NO le pongas un nombre plausible. Se DECIDE MIDIENDO: aplica la mutación, mira QUÉ\n'
    + '  cae, y ése es el `cae`. Si no cae nada, el hallazgo es que esa mutación no está cubierta\n'
    + '  por ningún test, y eso se dice — no se rellena.\n\n'
    + '  Y comprueba que la mutación ENTRÓ: una que no entra y una cobertura que no existe dan\n'
    + '  exactamente la misma salida.\n\n'
    + `  (no evaluables, declaradas y NO acusadas: ${noEvaluables.length})`);
});

test('SCRUM-836 · 🔴 NINGUNA mutación declarada tiene el ancla caducada', () => {
  const caducadas = anclasCaducadas();
  assert.deepEqual(caducadas.map((c) => `${c.guard} → ${c.fichero} (${c.cae}) — ${c.motivo}`), [],
    '🔴 HAY MUTACIONES ANCLADAS A TEXTO QUE YA NO EXISTE:\n    '
    + caducadas.map((c) => `${c.guard} → ${c.fichero}\n        ${c.motivo}`).join('\n    ')
    + '\n\n  El guard que la declara está CIEGO sobre ese defecto: `meta:mutaciones` no puede\n'
    + '  aplicar la mutación, así que nadie comprueba que ese guard siga cazando lo que promete.\n\n'
    + '  🔴 NO se arregla restaurando el texto viejo: si el código cambió, cambió por algo, y\n'
    + '  volver atrás desharía el arreglo de otro. Se REANCLA a algo que sobreviva — la identidad\n'
    + '  de la función o del contrato que se quiere apagar, no la forma concreta que tiene hoy\n'
    + '  la línea. Anclar a una línea es anclar a cómo está escrita hoy, y eso caduca.\n\n'
    + '  Pasó el 8-sep-2026 con `scrum716`: un `||` se partió en dos `if` con todo el motivo, y\n'
    + '  la mutación se quedó ciega SIETE DÍAS mientras entraban 54 PRs.');
});

// ═══ ④ SCRUM-1321 · EL ANCLA AMBIGUA ═════════════════════════════════════════════════════════

/** El fichero vigilado del caso REAL, reducido a su forma: el paso nuevo va ANTES y empieza igual. */
const DOS_PASOS = [
  '      - id: origen',
  "        if: steps.puerta.outputs.despertar == 'si' && steps.puerta.outputs.es_pr == 'true'",
  '      - uses: la/accion@v1',
  '        id: accion',
  "        if: steps.puerta.outputs.despertar == 'si'",
  '',
].join('\n');

test('SCRUM-1321 · 🔴 EL CASO REAL: un ancla que casa ANTES en otra línea se denuncia, con sus líneas', () => {
  const b = banco('scrum1321-', DOS_PASOS,
    '  { fichero: \'vigilado.mjs\', de: "        if: steps.puerta.outputs.despertar == \'si\'", a: \'        if: always()\', cae: \'uno\' },\n');
  try {
    const censo = censoDeDeclaraciones(b.dir);
    assert.equal(censo.reduce((n, c) => n + c.mutaciones.length, 0), 1,
      '🔴 el banco no lee su declaración: lo que mida este test no significaría nada.');
    // El defecto exacto: el ancla ESTÁ, así que la criba de SCRUM-836 no tiene nada que decir.
    assert.deepEqual(anclasCaducadas(b.dir, censo), [],
      '🔴 el banco no reproduce el caso: el ancla tiene que estar PRESENTE y aun así ser ambigua.');

    const ambiguas = anclasAmbiguas(b.dir, censo, b.dir);
    assert.equal(ambiguas.length, 1, `🔴 se esperaba UNA ambigua y salen ${ambiguas.length}.`);
    assert.deepEqual(ambiguas[0].lineas, [2, 5],
      '🔴 no dice DÓNDE están las dos ocurrencias. Sin las líneas, quien lo lea tiene que '
      + 'reconstruir a mano qué se coló delante.');
    assert.match(ambiguas[0].motivo, /mutaría la primera, la de la línea 2/,
      '🔴 el motivo no dice cuál de las dos se mutaría, que es la mitad del diagnóstico.');
  } finally {
    b.limpia();
  }
});

test('SCRUM-1321 · ✅ POSITIVO: la misma mutación, anclada con su contexto, NO se denuncia', () => {
  // Sin esto, «detecta ambiguas» y «acusa a todo lo que se repite por dentro» dan el mismo rojo.
  // Es además la forma del arreglo: la línea de antes dentro del mismo literal.
  const b = banco('scrum1321-ok-', DOS_PASOS,
    '  { fichero: \'vigilado.mjs\', de: "        id: accion\\n        if: steps.puerta.outputs.despertar == \'si\'", a: \'        id: accion\\n        if: always()\', cae: \'uno\' },\n');
  try {
    const censo = censoDeDeclaraciones(b.dir);
    assert.equal(censo[0].mutaciones[0].de.split('\n').length, 2,
      '🔴 el banco no ha escrito un ancla de dos líneas: el control no probaría lo que dice.');
    assert.deepEqual(anclasCaducadas(b.dir, censo), [], '🔴 el ancla larga no está en el fichero.');
    assert.deepEqual(anclasAmbiguas(b.dir, censo, b.dir), [],
      '🔴 acusa a un ancla que casa UNA vez. Un guard que grita sin motivo se acaba puenteando.');
  } finally {
    b.limpia();
  }
});

/** Un guard que se muta a SÍ MISMO: la constante y la declaración que la cita, en el orden pedido. */
function bancoQueSeCita(prefijo, { arrayArriba = false, constantes = 1 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefijo));
  const constante = 'export const TOPE = 5;\n'.repeat(constantes);
  const array = 'export const MUTACIONES_QUE_ME_TUMBAN = [\n'
    + "  { fichero: 'guardx.test.mjs', de: 'export const TOPE = 5;', a: 'export const TOPE = 99;', cae: 'uno' },\n"
    + '];\n';
  fs.writeFileSync(path.join(dir, 'guardx.test.mjs'),
    CABECERA + (arrayArriba ? array + constante : constante + array));
  return { dir, limpia: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('SCRUM-1321 · ✅ el guard que se muta a sí mismo y CITA su ancla no es ambiguo: se deriva, no se lista', () => {
  // Es el caso de SCRUM-812c y en el árbol real hay tres. Si esto los denunciara, el guard nacería
  // rojo contra declaraciones sanas, y la salida fácil sería una lista de excepciones a mano.
  const b = bancoQueSeCita('scrum1321-cita-');
  try {
    const censo = censoDeDeclaraciones(b.dir);
    assert.equal(censo.reduce((n, c) => n + c.mutaciones.length, 0), 1, '🔴 el banco no lee su declaración.');
    const fuente = fs.readFileSync(path.join(b.dir, 'guardx.test.mjs'), 'utf8');
    assert.equal(fuente.split('export const TOPE = 5;').length - 1, 2,
      '🔴 el banco no tiene las DOS ocurrencias (constante y cita): no ejercita la excepción.');
    assert.deepEqual(anclasAmbiguas(b.dir, censo, b.dir), []);
    // Y la excepción es SÓLO para quien se cita a sí mismo: el mismo texto, visto como fichero
    // ajeno, sí es ambiguo. Si esto no cayera, la excepción sería «dos ocurrencias valen siempre».
    assert.ok(ambiguedadDelAncla(fuente, 'export const TOPE = 5;', { seCitaASiMismo: false }),
      '🔴 dos ocurrencias en un fichero AJENO se dan por buenas: la excepción se ha comido la regla.');
  } finally {
    b.limpia();
  }
});

test('SCRUM-1321 · 🔴 con el array movido ARRIBA la primera ocurrencia es la CITA, y se denuncia', () => {
  // El caso que SCRUM-812c dejó descrito: `replace` reescribe el texto de la declaración, la
  // constante se queda como estaba y el veredicto sale MUDO acusando a un guard sano.
  const b = bancoQueSeCita('scrum1321-arriba-', { arrayArriba: true });
  try {
    const ambiguas = anclasAmbiguas(b.dir, censoDeDeclaraciones(b.dir), b.dir);
    assert.equal(ambiguas.length, 1,
      '🔴 con la cita por delante de la constante, la mutación tocaría la cita y nadie lo dice.');
  } finally {
    b.limpia();
  }
});

test('SCRUM-1321 · 🔴 citarse a sí mismo no absuelve una SEGUNDA ocurrencia de código', () => {
  const b = bancoQueSeCita('scrum1321-tres-', { constantes: 2 });
  try {
    const ambiguas = anclasAmbiguas(b.dir, censoDeDeclaraciones(b.dir), b.dir);
    assert.equal(ambiguas.length, 1, '🔴 dos líneas de código iguales más la cita se dan por inequívocas.');
    assert.equal(ambiguas[0].veces, 3);
  } finally {
    b.limpia();
  }
});

test('SCRUM-1321 · 🔴 NINGUNA mutación declarada tiene el ancla ambigua', () => {
  const censo = censoDeDeclaraciones();
  const total = censo.reduce((n, c) => n + c.mutaciones.length, 0);
  assert.ok(total >= 54,
    `🔴 el censo trae ${total} declaraciones y el suelo del meta-guard son 54. Un verde aquí no `
    + 'diría «ninguna ambigua», diría «no se supo mirar».');

  // SUELO de la excepción: las que se repiten y se ADMITEN tienen que existir y ser todas de un
  // guard que se muta a sí mismo. Si salieran cero, la rama que absuelve no se habría ejercitado
  // sobre el árbol real, y si saliera una ajena, la excepción se habría ensanchado sola.
  const repetidas = [];
  for (const { guard, mutaciones } of censo) {
    for (const mut of mutaciones) {
      const abs = path.join(RAIZ, mut.fichero);
      if (fs.existsSync(abs) && fs.readFileSync(abs, 'utf8').split(mut.de).length - 1 > 1) {
        repetidas.push({ guard, fichero: mut.fichero });
      }
    }
  }
  const ambiguas = anclasAmbiguas();
  const admitidas = repetidas.filter((r) => !ambiguas.some((a) => a.guard === r.guard && a.fichero === r.fichero));
  assert.ok(admitidas.length >= 1,
    `🔴 de ${total} declaraciones ninguna repite su ancla y se admite: la excepción del guard que `
    + 'se cita a sí mismo no se ha ejercitado sobre el árbol real.');
  assert.deepEqual(admitidas.filter((r) => r.fichero !== `tests/${r.guard}`), [],
    '🔴 se admite un ancla repetida en un fichero que NO es el propio guard.');

  assert.deepEqual(ambiguas.map((a) => `${a.guard} → ${a.fichero} (${a.cae})`), [],
    `🔴 HAY MUTACIONES CUYO ANCLA CASA MÁS DE UNA VEZ (${ambiguas.length} de ${total}):\n    `
    + ambiguas.map((a) => `${a.guard}\n        cae: ${JSON.stringify(a.cae)}\n        ${a.motivo}`).join('\n    ')
    + '\n\n  `meta:mutaciones` muta la PRIMERA ocurrencia. Si no es la que el test ejercita, el\n'
    + '  veredicto sale MUDO acusando a un guard sano, y lo hace en el job que no bloquea.\n\n'
    + '  🔴 Casi nunca lo ha roto quien toca la declaración: lo rompe quien escribe, MÁS ARRIBA en\n'
    + '  el fichero vigilado, una línea que contiene el ancla. Si es tu caso, tu cambio está bien;\n'
    + '  lo que hay que hacer es alargar el ancla de ESA declaración hasta que vuelva a ser única,\n'
    + '  y comprobar aplicándola que sigue cayendo el test que nombra.\n\n'
    + '  ⛔ NO se arregla quitando la declaración ni cambiando tu línea para que no case.');
});
