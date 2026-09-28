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
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CENSO = path.join('scripts', 'censo-decisiones-encerradas.mjs');
const DECLARADOS_JSON = path.join('scripts', '_decisiones-encerradas-declaradas.json');

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

// Un árbol de git no cambia, y el de trabajo tampoco durante la tanda: cada árbol se censa UNA vez
// por proceso. Lo añadió SCRUM-1179-B para que la mitad que cierra no pagase censos repetidos.
// Si el censo sale con código ≠ 0 (ciego en el árbol de trabajo), execFileSync lanza y el test
// cae: eso ES el fail-closed, no un accidente.
const CACHE = new Map();
function censar(ref) {
  if (CACHE.has(ref)) return CACHE.get(ref);
  const args = [CENSO, '--json'];
  if (ref) args.push('--ref', ref);
  const salida = execFileSync(process.execPath, args,
    { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  const r = JSON.parse(salida);
  CACHE.set(ref, r);
  return r;
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

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1179 (parte B, 1 de 4) — LA MITAD QUE CIERRA
//
// Lo de arriba solo fija CUATRO nombres: impide que VUELVA lo ya arreglado. Una decisión de
// producto NUEVA metida en una vista —el defecto que llevamos días encontrando en los botones de
// factura, albarán y trabajo— salía en el censo y nadie la leía, porque el censo no corre en
// ningún sitio. Aquí el censo del árbol de trabajo se compara con
// scripts/_decisiones-encerradas-declaradas.json en las DOS direcciones (como SCRUM-1157):
//   · NUEVA = sale y no está declarada → rojo: se saca a un fichero compartido, o se declara en
//             «acusadas» con su motivo (declarada no es aceptada).
//   · SOBRA = declarada y ya no sale (se arregló) → rojo: se mueve a «retiradas» con su motivo.
// La clave es FICHERO · FUNCIÓN, nunca la línea: se mueve con el primer commit (SCRUM-1093h).
// Fail-closed: censo ciego, población vacía o clave repetida salen CIEGO y no se compara nada.
// ═════════════════════════════════════════════════════════════════════════════════════════════

const idDe = (f) => `${f.fichero} · ${f.nombre}`;

/** Ids del censo, o lanza CIEGO. Nunca devuelve un vacío que pueda leerse como «limpio». */
function idsDelCenso(r, donde) {
  if (!Array.isArray(r.filas) || !Array.isArray(r.ciego)) {
    throw new Error(`🔴 CIEGO (${donde}): el censo no devolvió {filas, ciego}; no se compara nada.`);
  }
  if (r.ciego.length) {
    throw new Error(`🔴 CIEGO (${donde}): no pudo leer los estados de ${r.ciego.join(', ')}.`);
  }
  if (!r.filas.length) {
    throw new Error(`🔴 CIEGO (${donde}): población vacía. Cero decisiones no es «limpio» mientras\n`
      + '  los controles de SCRUM-837 no digan que el detector ve; aquí se trata como no haber mirado.');
  }
  const ids = r.filas.map(idDe);
  const repetidos = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (repetidos.length) {
    throw new Error(`🔴 CIEGO (${donde}): dos funciones con la misma clave (${[...new Set(repetidos)].join(', ')}).\n`
      + '  La clave fichero · función ya no las distingue; hay que afinarla, no comparar a medias.');
  }
  return new Set(ids);
}

function leerDeclarados() {
  const j = JSON.parse(fs.readFileSync(path.join(RAIZ, DECLARADOS_JSON), 'utf8'));
  assert.ok(j && typeof j.acusadas === 'object' && Array.isArray(j.retiradas),
    `🔴 ${DECLARADOS_JSON} no tiene la forma {acusadas: {}, retiradas: []}.`);
  return j;
}

function comparar(ids, declarados) {
  const decl = new Set(Object.keys(declarados.acusadas));
  return {
    nuevas: [...ids].filter((id) => !decl.has(id)).sort(),
    sobran: [...decl].filter((id) => !ids.has(id)).sort(),
  };
}

test('SCRUM-1179-B · trinquete: lo que censa el árbol == lo declarado, en las dos direcciones', () => {
  const { nuevas, sobran } = comparar(idsDelCenso(censar(null), 'árbol de trabajo'), leerDeclarados());
  assert.deepEqual(nuevas, [],
    `🔴 NUEVA decisión de producto encerrada en una vista: ${nuevas.join(', ')}.\n`
    + '  Otra pantalla que pinte ese documento no la verá (es el defecto de SCRUM-366, 823 y 831).\n'
    + '  Sácala a un fichero compartido; si de verdad tiene que vivir ahí, decláralo en «acusadas»\n'
    + `  de ${DECLARADOS_JSON} con su motivo. Detalle: \`npm run censo:decisiones-encerradas\`.`);
  assert.deepEqual(sobran, [],
    `🔴 SOBRA (ya no sale en el censo): ${sobran.join(', ')}.\n`
    + `  Si se arregló, muévela a «retiradas» de ${DECLARADOS_JSON} con su motivo y su ticket.\n`
    + '  No se borra sin dejar escrito por qué: una bajada sin anotar no se distingue de una avería.');
});

test('SCRUM-1179-B · cada acusada y cada retirada lleva motivo', () => {
  const d = leerDeclarados();
  for (const [id, v] of Object.entries(d.acusadas)) assert.ok(v && v.motivo, `acusada sin motivo: ${id}`);
  for (const r of d.retiradas) assert.ok(r && r.id && r.motivo, `retirada sin id o sin motivo: ${JSON.stringify(r)}`);
  const acusadas = new Set(Object.keys(d.acusadas));
  for (const r of d.retiradas) assert.ok(!acusadas.has(r.id), `«${r.id}» está a la vez acusada y retirada`);
});

// Los dos controles usan el caso REAL de SCRUM-831 (`primariaDeAlbaran`, la lista de Albaranes
// con CERO acciones), con los árboles de justo antes y justo después de su arreglo. La diferencia
// entre los dos es exactamente esa función: si el trinquete no la acusa antes, no sirve; si la
// acusa también después, está acusando lo que no debe.
test('SCRUM-1179-B · control POSITIVO: el árbol de antes de SCRUM-831 sale con primariaDeAlbaran como NUEVA', () => {
  const { nuevas } = comparar(idsDelCenso(censar('9cacafad^'), '9cacafad^'), leerDeclarados());
  assert.ok(nuevas.includes('jobDetailView.js · primariaDeAlbaran'),
    `🔴 el trinquete NO acusa el caso real de SCRUM-831. Acusó: ${nuevas.join(', ') || '(nada)'}`);
});

test('SCRUM-1179-B · control NEGATIVO: en el árbol del arreglo de SCRUM-831, primariaDeAlbaran ya NO sale', () => {
  const antes = comparar(idsDelCenso(censar('9cacafad^'), '9cacafad^'), leerDeclarados()).nuevas;
  const despues = comparar(idsDelCenso(censar('9cacafad'), '9cacafad'), leerDeclarados()).nuevas;
  assert.ok(!despues.includes('jobDetailView.js · primariaDeAlbaran'),
    '🔴 el trinquete sigue acusando primariaDeAlbaran en el árbol que la sacó a un fichero compartido.');
  assert.deepEqual(antes.filter((id) => !despues.includes(id)), ['jobDetailView.js · primariaDeAlbaran'],
    '🔴 entre el árbol de antes y el del arreglo de SCRUM-831 tiene que cambiar UNA acusación, esa.');
});

test('SCRUM-1179-B · fail-closed: población vacía, ciego o clave repetida salen CIEGO, nunca «limpio»', () => {
  assert.throws(() => idsDelCenso({ filas: [], ciego: [] }, 'sintético'), /CIEGO.*población vacía/s);
  assert.throws(() => idsDelCenso({ filas: [{ fichero: 'a.js', nombre: 'f' }], ciego: ['ALBARAN_STATES'] }, 'sintético'), /CIEGO/);
  assert.throws(() => idsDelCenso({ filas: [{ fichero: 'a.js', nombre: 'f' }, { fichero: 'a.js', nombre: 'f' }], ciego: [] }, 'sintético'), /CIEGO.*misma clave/s);
  assert.throws(() => idsDelCenso({}, 'sintético'), /CIEGO/);
});
