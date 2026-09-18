// docs/master/evidencias/scrum949/serie-del-historial.mjs — SCRUM-949 · ② de dónde sale el cociente
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ¿CUÁNTO SE SEPARAN, EN UN CAMBIO HONESTO, LAS DOS SONDAS DEL SUELO POR COCIENTE?
//
// El suelo de `tests/public-js-parsea.test.mjs` pasa a comparar DOS sondas de la misma población:
// el recorrido del propio guard (el disco) y el índice de git. En CI coinciden siempre —el
// checkout es limpio—, así que allí cualquier diferencia es ceguera. En local, NO: entre el
// momento en que una sesión toca `public/` y el momento en que hace `git add`, el disco ya es el
// commit siguiente y el índice todavía es el anterior. Esa diferencia es HONESTA, y es la única
// que la tolerancia tiene que absorber.
//
// Su tamaño máximo es, como mucho, lo que cambia UN commit: justo antes de `git add`, el índice es
// el padre y el disco es el hijo. Así que se mide, commit a commit, la coincidencia entre el
// conjunto de `.js` de `public/` del padre y el del hijo:
//
//     J(padre, hijo) = |padre ∩ hijo| / |padre ∪ hijo|
//
// que es exactamente el cociente que calcula el suelo con índice = padre y disco = hijo.
//
// 🔴 Es una SERIE, no dos puntos (la objeción de S4 en SCRUM-940: «dos muestras no son una
// dispersión, son una diferencia»). Son todos los commits sin merge de la historia de
// `origin/main` que tocan `public/`, más la línea de primer padre como cota por PR.
//
// ⚠️ LO QUE ESTO NO MIDE: el futuro. El mínimo del historial es la mayor reorganización honesta
// que ha HABIDO, no la mayor que pueda haber. Si llega una mayor, el suelo salta nombrando los
// ficheros, y se resuelve con `git add` (la norma de S3 del 17-sep: `git add` va ANTES de la
// tanda). Eso es un rojo explicable, no un suelo muerto.
//
// Uso:  node docs/master/evidencias/scrum949/serie-del-historial.mjs [ref]   (por defecto origin/main)
// Sale 2 si no puede fiarse de su propia medida.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const git = (args) => execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 1 << 28 });
// 🔴 La ref se resuelve a un SHA UNA vez, al arrancar. Los refs se comparten entre los ~26
// worktrees: la primera pasada resolvía `origin/main` al principio y al final, otra sesión hizo
// `fetch` en medio (41bad7c8 → 4a7ff1ec) y la cabecera habría citado una punta distinta de la
// medida. Esta vez los 2 commits nuevos no tocaban `public/`; la próxima, sí podrían.
const REF_PEDIDA = process.argv[2] || 'origin/main';
const REF = git(['rev-parse', '--verify', `${REF_PEDIDA}^{commit}`]).trim();

/** Misma población que el recorrido del guard: todo fichero terminado en `.js` bajo `public/`. */
const esJsDePublic = (p) => p.startsWith('public/') && p.endsWith('.js');

function poblacionEn(commit) {
  return git(['ls-tree', '-r', '--name-only', commit, '--', 'public'])
    .split('\n').filter(esJsDePublic).length;
}

/** Altas y bajas de `.js` de `public/` entre dos commits, SIN detección de renombres. */
function altasYBajas(de, a) {
  let altas = 0; let bajas = 0;
  for (const l of git(['diff-tree', '-r', '--no-renames', '--name-status', de, a, '--', 'public']).split('\n')) {
    const [st, p] = l.split('\t');
    if (!p || !esJsDePublic(p)) continue;
    if (st === 'A') altas++;
    else if (st === 'D') bajas++;
  }
  return { altas, bajas };
}

function serie(commits, padreDe) {
  const filas = [];
  for (const c of commits) {
    const p = padreDe(c);
    if (!p) continue; // el commit raíz no tiene padre con el que compararse
    const P = poblacionEn(p);
    const { altas, bajas } = altasYBajas(p, c);
    const union = P + altas;
    const J = union === 0 ? 1 : (P - bajas) / union;
    filas.push({ c, P, altas, bajas, J });
  }
  return filas;
}

const padre1 = (c) => { try { return git(['rev-parse', '--verify', '--quiet', `${c}^1`]).trim(); } catch { return null; } };

const sinMerge = git(['log', REF, '--no-merges', '--format=%H', '--', 'public']).split('\n').filter(Boolean);
const primerPadre = git(['log', REF, '--first-parent', '--format=%H', '--', 'public']).split('\n').filter(Boolean);

const A = serie(sinMerge, padre1);
const B = serie(primerPadre, padre1);

// ── EL SUELO DE ESTA MEDIDA ───────────────────────────────────────────────────────────────────
// Caso conocido: SCRUM-867 retiró `nuevaFacturaModal.js` (95 → 94). Si la serie no ve ni UNA baja,
// no está mirando: un cero de bajas sobre cientos de commits se lee igual que un lector ciego.
const noMeFio = [];
if (A.length < 100) noMeFio.push(`solo ${A.length} commits en la serie: esto no es la historia de ${REF}`);
if (!A.some((f) => f.bajas > 0)) noMeFio.push('CERO bajas en toda la serie: el lector de bajas no ve (hay al menos una: SCRUM-867)');
const modal = git(['log', REF, '--no-merges', '--format=%H', '--diff-filter=D', '--', 'public/dashboard/js/nuevaFacturaModal.js']).trim().split('\n').filter(Boolean);
if (!modal.length || !A.some((f) => modal.includes(f.c) && f.bajas >= 1)) {
  noMeFio.push('el caso conocido (SCRUM-867, `nuevaFacturaModal.js` retirado) NO sale con su baja');
}
const tip = REF;
const enTip = poblacionEn(tip);
if (enTip === 0) noMeFio.push(`población CERO en ${REF}: no hay nada que medir`);
if (noMeFio.length) {
  console.error('🔴 NO ME FÍO DE ESTA MEDIDA:\n  · ' + noMeFio.join('\n  · '));
  process.exit(2);
}

// ── EL RESUMEN ────────────────────────────────────────────────────────────────────────────────
const pct = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const asunto = (c) => git(['log', '-1', '--format=%h %cs %s', c]).trim().slice(0, 110);
function resumen(nombre, filas) {
  const js = filas.map((f) => f.J);
  const peores = [...filas].sort((a, b) => a.J - b.J).slice(0, 8);
  const conBajas = filas.filter((f) => f.bajas > 0);
  return {
    nombre,
    commits: filas.length,
    conBajas: conBajas.length,
    J: { min: Math.min(...js), p01: pct(js, 0.01), p05: pct(js, 0.05), mediana: pct(js, 0.5) },
    maxBajas: Math.max(...filas.map((f) => f.bajas)),
    maxAltas: Math.max(...filas.map((f) => f.altas)),
    // Rutas que cambian en UN commit (altas + bajas), con población previa: el tamaño ABSOLUTO de
    // la mayor discrepancia honesta. No sale de la lista de peores J: un commit con población
    // grande y 3 cambios tiene un J alto y no aparecería entre los peores.
    maxCambiosConPoblacion: (() => {
      const f = filas.filter((x) => x.P > 0);
      const max = Math.max(...f.map((x) => x.altas + x.bajas));
      const cuantos = f.filter((x) => x.altas + x.bajas === max).length;
      return { max, commits: cuantos, deCuantos: f.length };
    })(),
    peores: peores.map((f) => ({ J: +f.J.toFixed(4), P: f.P, altas: f.altas, bajas: f.bajas, commit: asunto(f.c) })),
    // ¿cómo es la cola si sólo se miran los commits con la población de ya-no-arranque?
    // (Se DICE aparte y no se usa para decidir: elegir la ventana sería una tolerancia disfrazada.)
    conPoblacionDe50oMas: (() => {
      const f50 = filas.filter((f) => f.P >= 50);
      const j50 = f50.map((f) => f.J);
      return f50.length ? { commits: f50.length, min: Math.min(...j50), peores: [...f50].sort((a, b) => a.J - b.J).slice(0, 5).map((f) => ({ J: +f.J.toFixed(4), P: f.P, altas: f.altas, bajas: f.bajas, commit: asunto(f.c) })) } : null;
    })(),
  };
}

const salida = {
  medidoContra: { ref: REF_PEDIDA, sha: tip, fecha: new Date().toISOString() },
  poblacionHoyEnLaRef: enTip,
  casoConocido: { commits: modal.map((c) => asunto(c)) },
  porCommit: resumen('commits sin merge que tocan public/ (cota por commit)', A),
  porPR: resumen('línea de primer padre (cota por PR)', B),
};
console.log(JSON.stringify(salida, null, 2));
