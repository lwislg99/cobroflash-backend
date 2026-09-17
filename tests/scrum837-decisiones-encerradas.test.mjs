// tests/scrum837-decisiones-encerradas.test.mjs — SCRUM-837
//
// EL SUELO DEL CENSO DE DECISIONES ENCERRADAS.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// QUÉ PRUEBA ESTO Y POR QUÉ NO ES UN TEST DEL PRODUCTO
//
// `scripts/censo-decisiones-encerradas.mjs` contesta «cuántas decisiones de producto viven
// encerradas dentro de una vista». Un censo así vale exactamente lo que valga su suelo: el día
// que se le rompa el detector, devolverá CERO y el cero se leerá como «está limpio».
//
// 🔒 Cero no es «está limpio»: es «no he mirado» — mientras no se demuestre lo contrario.
//
// Aquí se demuestra con los TRES casos REALES que ya costaron un ticket cada uno. No con casos
// inventados: con los árboles de git de justo ANTES de cada arreglo. Si el censo deja de cazar
// uno de los tres, esto se pone rojo y el número de hoy deja de significar nada.
//
// ── Y LA CALIBRACIÓN VA EN LAS DOS DIRECCIONES ──────────────────────────────────────────────
//
// Cazar la enfermedad no basta: un detector que dijera «sí» a todo también los cazaría. Así que
// también se comprueba que los tres, YA ARREGLADOS, no salen en el árbol de hoy. Un censo que
// siguiera nombrándolos después del arreglo estaría midiendo otra cosa.
//
// ⚠️ Los tres SHA son de commits de `main` y no cambian. Si alguno dejara de existir —un
// historial reescrito—, el test lo dice en vez de dar por bueno un árbol que no pudo leer: un
// suelo que se salta a sí mismo cuando no encuentra su semilla es un suelo decorativo.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CENSO = path.join('scripts', 'censo-decisiones-encerradas.mjs');

// Los tres casos, con el nombre que la función tenía EN SU ÁRBOL. Ojo con esto: SCRUM-823 la
// renombró al mudarla (`abrirAgendar` → `abrirAgendarTrabajo`), y buscar el nombre de después en
// el árbol de antes daba «se escapa» sobre un censo que la estaba cazando bien.
const CASOS = [
  { ticket: 'SCRUM-366', commit: '16ba5cf4', fn: 'jobNextAction',
    donde: 'jobDetailView.js', dolor: 'la lista de Trabajos escribió su propia escalera y divergió' },
  { ticket: 'SCRUM-823', commit: '786bdc59', fn: 'abrirAgendar',
    donde: 'jobsView.js', dolor: 'el detalle del Trabajo no sabía agendar' },
  { ticket: 'SCRUM-831', commit: '9cacafad', fn: 'primariaDeAlbaran',
    donde: 'jobDetailView.js', dolor: 'la lista de Albaranes, la única de las cinco con CERO acciones' },
];

// Los nombres que NO deben aparecer hoy: los tres, antes y después del renombre de 823.
const YA_ARREGLADAS = ['jobNextAction', 'abrirAgendar', 'abrirAgendarTrabajo', 'primariaDeAlbaran'];

function existeCommit(sha) {
  try {
    execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`],
      { cwd: RAIZ, stdio: ['ignore', 'ignore', 'ignore'] });
    return true;
  } catch { return false; }
}

function censar(ref) {
  const args = [CENSO, '--json'];
  if (ref) args.push('--ref', ref);
  const salida = execFileSync(process.execPath, args,
    { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  return JSON.parse(salida);
}

test('SCRUM-837 · SUELO: el censo caza los TRES casos que ya costaron un ticket', () => {
  for (const c of CASOS) {
    assert.ok(existeCommit(`${c.commit}^`),
      `🔴 SEMILLA PERDIDA: no existe el árbol ${c.commit}^ (${c.ticket}). Sin él este suelo no\n`
      + '  prueba nada, y el número del censo pasa a ser una afirmación sin respaldo. NO se salta\n'
      + '  el caso: se arregla la referencia.');

    const { filas } = censar(`${c.commit}^`);
    const cazada = filas.find((f) => f.nombre === c.fn);
    assert.ok(cazada,
      `🔴 EL CENSO SE HA QUEDADO CIEGO PARA ${c.ticket}: en el árbol ${c.commit}^ no encuentra\n`
      + `  \`${c.fn}\` dentro de \`${c.donde}\`, que es donde estaba y por lo que ${c.dolor}.\n\n`
      + '  Mientras esto no pase, el censo de HOY no significa nada: un detector que no ve el\n'
      + '  defecto conocido devuelve cero por no saber mirar, no por estar limpio.\n\n'
      + `  Lo que sí encontró allí: ${filas.map((f) => f.nombre).join(', ') || '(nada)'}`);

    assert.equal(cazada.fichero, c.donde,
      `🔴 ${c.ticket}: el censo la sitúa en \`${cazada.fichero}\` y estaba en \`${c.donde}\`.`);
    assert.ok(cazada.huerfanas.length > 0,
      `🔴 ${c.ticket}: el censo la caza pero deja VACÍA la tercera columna. Esa columna es la que\n`
      + '  separa un hueco real de una preferencia de arquitectura: sin ella el censo es una\n'
      + '  opinión sobre cómo ordenar ficheros.');
  }
});

test('SCRUM-837 · la otra dirección: los tres ARREGLADOS ya no salen', () => {
  // Sin esto, un detector que dijera «sí» a todo pasaría el suelo de arriba y el censo de hoy
  // sería ruido. La cura tiene que registrarse igual que la enfermedad.
  const { filas } = censar(null);
  const nombres = new Set(filas.map((f) => f.nombre));
  for (const fn of YA_ARREGLADAS) {
    assert.ok(!nombres.has(fn),
      `🔴 \`${fn}\` sigue saliendo en el censo de hoy y su ticket la sacó a un fichero compartido.\n`
      + '  O ha vuelto a una vista —y entonces es una regresión de producto—, o el censo está\n'
      + '  contando como encerrado algo que ya es alcanzable. Las dos cosas hay que mirarlas.');
  }
});

test('SCRUM-837 · el censo de HOY no está ciego, y sabe decirlo cuando lo está', () => {
  const hoy = censar(null);
  assert.deepEqual(hoy.ciego, [],
    `🔴 el censo no ha podido leer estos juegos de estados en su fuente: ${hoy.ciego.join(', ')}.\n`
    + '  En el árbol de trabajo TODOS tienen que existir. Que falte uno no es historia: es que\n'
    + '  alguien movió o renombró un registro y el censo se quedó tuerto sin decirlo.');

  // El suelo del suelo: el censo TIENE que declararse ciego cuando le falta una fuente. Se
  // comprueba contra un árbol donde de verdad faltaban (julio de 2026, sin registro de albarán),
  // así que esto sigue probando algo el día que el árbol de hoy esté perfecto.
  if (existeCommit('16ba5cf4^')) {
    const viejo = censar('16ba5cf4^');
    assert.ok(viejo.ciego.length > 0,
      '🔴 en `16ba5cf4^` no existían `ALBARAN_STATES` ni `QUOTE_STATES` y el censo NO se declara\n'
      + '  ciego de ellos. Entonces su silencio no distingue «no hay» de «no supe mirar», que es\n'
      + '  justo la distinción por la que existe este fichero.');
  }
});
