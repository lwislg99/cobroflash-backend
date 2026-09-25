// tests/scrum804b-el-barrido-de-la-42.test.mjs — SCRUM-804b
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// ⛔ ESTE FICHERO MIDE. NO CIERRA TICKETS, NO TOCA JIRA, NO RENOMBRA NI BORRA NINGUNA RAMA.
//
// El censo de la regla 42 contesta «¿qué tickets abiertos ya están DENTRO de `main`?», y su valor
// depende por completo de una cosa: **que `FUERA` signifique algo**.
//
//   >>> Absence of a marker no es absence of work. <<<
//
// La primera versión mandaba a `FUERA` los 32 tickets sin rama, sin entrada y sin ficheros
// propios — **los 32 con el mismo motivo**, que no es un veredicto sino un «no he encontrado
// marca». Habría mandado a reabrir trabajo ya hecho. Ahora `FUERA` exige **evidencia positiva**:
// una rama viva sin mergear. Lo demás es `NO DECIDIBLE`, del lado malo y con su motivo.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DENTRO, FUERA, NO_DECIDIBLE, censar, linea, ramasDelTicket, artefactosQueNombra,
} from '../scripts/censo-regla-42.mjs';

/** Cerrados y mergeados: el criterio TIENE que sacarlos DENTRO o no está midiendo, está opinando. */
const POSITIVOS = [866, 881];
// 🔴 MEDIDO EL 25-sep-2026, NO SUPUESTO: `git merge-base --is-ancestor` sobre las ramas remotas
// de hoy. SCRUM-1118 (el negativo anterior) se mergeó vía `scrum-1118-citas-rfact-contiguas`
// (PR #1761) y este mismo test pasó a fallar en el sentido contrario (DENTRO donde exigía FUERA)
// — el defecto que el comentario de esta misma línea ya avisaba que iba a pasar. Este número
// ENVEJECE por diseño (es la misma naturaleza del NEGATIVO de SCRUM-738 con `scrum-684`, de
// SCRUM-1099 con `scrum-1107`, y de SCRUM-1096 con `scrum-1118`). Esta vez se elige un negativo
// con PR YA CERRADO sin mergear (`scrum-895-sin-facturar-no-se-ofrece`, PR #1408 CLOSED
// 15-sep-2026): a diferencia de un negativo con PR abierto, nadie va a mergearlo por accidente
// mientras otras ramas pasan por este mismo test. Sigue envejeciendo si algún día se reabre y
// mergea, o si la rama se borra. Quien lo vuelva a medir, que lo re-feche.
/** Su rama está viva (sin mergear, PR #1408 cerrado sin mergear) hoy (25-sep-2026): TIENE que salir FUERA. */
const NEGATIVO = 895;

// ═══ 🔴 POR IDENTIDAD: el número no casa dentro de otro ═════════════════════════════════════

test('SCRUM-804b · 🔴 el emparejamiento va por IDENTIDAD, no por contener el número', () => {
  const banco = ['scrum-41-algo', 'scrum-410-otra-cosa', 'scrum-4100-x', 'scrum-904', 'scrum-41b-fase'];

  assert.deepEqual(ramasDelTicket(banco, 41).sort(), ['scrum-41-algo', 'scrum-41b-fase'].sort(),
    '🔴 el 41 ha casado dentro del 410 o del 4100. Es la lección que la propia SCRUM-804 dejó '
    + 'escrita: un número que casa dentro de otro convierte el censo en ruido.');
  assert.deepEqual(ramasDelTicket(banco, 410), ['scrum-410-otra-cosa'],
    '🔴 el 410 no se reconoce, o arrastra al 4100.');

  // 🔴 Y la rama SIN SLUG se reconoce igual: lo que el barrido necesita es el NÚMERO.
  assert.deepEqual(ramasDelTicket(banco, 904), ['scrum-904'],
    '🔴 una rama sin slug (`scrum-904`) no se empareja con su ticket. El slug es para las '
    + 'personas; lo que el barrido lee es el número, y exigir slug para reconocerla es perder una '
    + 'rama por una razón que no tiene que ver con lo que se mide.');
});

test('SCRUM-804b · los artefactos se sacan del TEXTO de la entrada, no del número del ticket', () => {
  const entrada = 'Ver `tests/scrum999-x.test.mjs` y `src/modules/a/b.ts`, y también docs/master/SCRUM-1.md.';
  const rutas = artefactosQueNombra(entrada);
  for (const r of ['tests/scrum999-x.test.mjs', 'src/modules/a/b.ts', 'docs/master/SCRUM-1.md']) {
    assert.ok(rutas.includes(r), `🔴 no ve la ruta \`${r}\` que la entrada nombra.`);
  }
  assert.deepEqual(artefactosQueNombra('Sin ninguna ruta aquí.'), [],
    '🔴 inventa rutas donde no las hay.');
});

// ═══ 🔴 EL SUELO Y LOS DOS CONTROLES, sobre el árbol de verdad ══════════════════════════════

test('SCRUM-804b · 🔴 SUELO y CONTROLES: el criterio reconoce lo que SÍ está y lo que NO', (t) => {
  const c = censar([...POSITIVOS, NEGATIVO]);
  assert.ok(c !== null,
    '🔴 CIEGO: no se han podido leer las refs remotas o el árbol de `main`. Sin eso no se mide, y '
    + '«no he podido» no es «no hay».');
  t.diagnostic(linea(c));

  // 🔴 SUELO: cero DENTRO es ceguera, no un tablero limpio.
  assert.ok(c.dentro.length > 0,
    '🔴 CIEGO: el censo no clasifica NINGÚN ticket como DENTRO, y entre los mirados hay dos que '
    + 'están cerrados y mergeados. «0 dentro» y «no sé mirar» se leen igual.');

  // ✅ POSITIVO: los que sé cerrados salen DENTRO.
  for (const n of POSITIVOS) {
    const f = c.filas.find((x) => x.n === n);
    assert.equal(f.cubo, DENTRO,
      `🔴 SCRUM-${n} está cerrado y mergeado y el criterio lo saca ${f.cubo} (${f.motivo}). Si no `
      + 'reconoce un ticket que SÍ está, no está midiendo: está opinando.');
  }

  // 🔴 NEGATIVO: el que tiene rama viva sin mergear sale FUERA.
  const neg = c.filas.find((x) => x.n === NEGATIVO);
  assert.equal(neg.cubo, FUERA,
    `🔴 SCRUM-${NEGATIVO} tiene rama viva SIN mergear y el criterio lo saca ${neg.cubo} `
    + `(${neg.motivo}). Un censo que da por DENTRO lo que no está cierra tickets vivos.`);
  assert.match(neg.motivo, /rama viva SIN mergear/,
    '🔴 sale FUERA pero por otro motivo: el veredicto acierta por casualidad.');
});

// ═══ 🔴 `FUERA` EXIGE EVIDENCIA POSITIVA ════════════════════════════════════════════════════

test('SCRUM-804b · 🔴 «no encuentro marca» NO es FUERA: va a NO DECIDIBLE, del lado malo', () => {
  // Un número que con toda seguridad no tiene rama, ni entrada, ni ficheros, ni commits.
  const inventado = 999999;
  const c = censar([inventado]);
  assert.ok(c !== null, '🔴 CIEGO: no se pudo medir.');
  const f = c.filas.find((x) => x.n === inventado);

  assert.equal(f.cubo, NO_DECIDIBLE,
    `🔴 un ticket del que NO se encuentra NADA sale como ${f.cubo}. Eso es exactamente el defecto `
    + 'que tuvo la primera versión de este censo: confundir «no he encontrado marca» con «el '
    + 'trabajo no está». Un trabajo sin número puede estar entero, y mandarlo a FUERA hace '
    + 'reabrir trabajo ya hecho.');
  assert.notEqual(f.cubo, FUERA,
    '🔴 (imposible: el mismo valor no puede ser los dos)');
});

// ═══ EL REPARTO, que es el entregable ═══════════════════════════════════════════════════════

test('SCRUM-804b · 🔴 el censo DECLARA su reparto, y las clases SUMAN', (t) => {
  const c = censar([...POSITIVOS, NEGATIVO, 41, 534, 691]);
  assert.ok(c !== null, '🔴 CIEGO: no se pudo medir.');
  t.diagnostic(linea(c));
  for (const f of c.filas) t.diagnostic(`  SCRUM-${String(f.n).padEnd(6)} ${f.cubo.padEnd(13)} ${f.motivo.slice(0, 95)}`);

  assert.equal(c.dentro.length + c.fuera.length + c.noDecidibles.length, c.filas.length,
    '🔴 las clases no suman: el reparto pierde tickets.');
  assert.equal(c.filas.length, c.poblacion,
    '🔴 se miran más tickets de los que se clasifican, o al revés.');
});
