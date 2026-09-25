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
import { execFileSync } from 'node:child_process';
import {
  DENTRO, FUERA, NO_DECIDIBLE, censar, linea, ramasDelTicket, artefactosQueNombra,
} from '../scripts/censo-regla-42.mjs';

/** Cerrados y mergeados: el criterio TIENE que sacarlos DENTRO o no está midiendo, está opinando. */
const POSITIVOS = [866, 881];
// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL NEGATIVO SE DERIVA DEL ESTADO VIVO. NO SE ESCRIBE A MANO.
//
// Este número ha CADUCADO DOS VECES EN DOS DÍAS:
//   · SCRUM-1099 el 24-sep-2026 (PR #1734)
//   · SCRUM-1107 el 25-sep-2026 (PR #1758)
//
// Las dos veces el comentario de esta misma línea ya avisaba de que iba a pasar. Y las dos veces
// el aviso llegó TARDE: el test cayó primero, y alguien fue a leer el comentario después.
//
// 🔴 Y la segunda vez bloqueó los TRES PR abiertos del repositorio a la vez, porque
// «build + tests» es un check obligatorio. Un fixture que envejece por diseño y para la línea
// entera no es un suelo: es una bomba de relojería con un comentario al lado.
//
// Ahora se busca, entre las ramas vivas de HOY, un ticket que de verdad tenga obra sin mergear.
//
// ⚠️ POR UNA VÍA INDEPENDIENTE DE LA DEL CENSO, que es lo que hace que esto sea un control:
// aquí se usa `ls-remote` + el número de la rama + `merge-base --is-ancestor`, y nada más. El
// censo además lee entradas de registro, artefactos y commits. Si el censo se equivocara leyendo
// las ramas, esta derivación NO se equivocaría igual — que es justo lo que un control tiene que
// garantizar y lo que un fixture sacado del propio censo no garantizaría.
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** Cero red, cero escritura: sólo pregunta. */
function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/**
 * Un ticket con rama viva SIN mergear hoy, o `null` si no hay ninguno.
 *
 * `null` NO es «todo bien»: es que este control no se puede ejercitar, y entonces el caso se
 * SALTA declarando el motivo. Un negativo que no se puede montar y pasa en silencio cuenta como
 * verde sin haberse ganado nada.
 */
function negativoVivo() {
  const heads = git(['ls-remote', '--heads', 'origin']).split('\n').filter(Boolean);
  const candidatos = [];
  for (const fila of heads) {
    const [sha, ref] = fila.split(/\s+/);
    const m = /refs\/heads\/scrum-(\d+)(?:[a-z]\d*)?(?:-|$)/.exec(ref || '');
    if (!m) continue;
    try {
      // `--is-ancestor` sale 0 si YA está en main; si sale != 0, la rama sigue viva.
      execFileSync('git', ['merge-base', '--is-ancestor', sha, 'origin/main'], { stdio: 'ignore' });
    } catch {
      candidatos.push(Number(m[1]));
    }
  }
  // El más alto: el más reciente, y por tanto el que menos probable es que esté a punto de
  // mergearse mientras corre esta misma tanda.
  return candidatos.length ? Math.max(...candidatos) : null;
}

const NEGATIVO = negativoVivo();

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
  if (NEGATIVO === null) {
    // 🔴 No hay ni una rama viva en el remoto, así que este control NO SE PUEDE MONTAR. Se dice
    // con esas palabras: un negativo que no se ejercita y pasa callando es verde sin ganar.
    t.skip('⚠️ SIN NEGATIVO: hoy no hay ninguna rama sin mergear en origin, así que el control '
      + 'de «rama viva → FUERA» no se ha ejercitado. No es un verde: es que no había caso.');
    return;
  }
  const neg = c.filas.find((x) => x.n === NEGATIVO);
  assert.ok(neg, `🔴 el censo no trae fila para SCRUM-${NEGATIVO}, que SÍ tiene rama viva sin `
    + 'mergear. Un ticket con obra abierta que no aparece en el censo es el peor de los casos: '
    + 'no sale mal clasificado, sale invisible.');
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
