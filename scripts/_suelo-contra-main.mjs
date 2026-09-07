// scripts/_suelo-contra-main.mjs — SCRUM-810
//
// ╔══════════════════════════════════════════════════════════════════════════════════════════╗
// ║ Un suelo que sólo se dispara cuando ya se ha perdido la mitad no es un suelo: es una lápida ║
// ╚══════════════════════════════════════════════════════════════════════════════════════════╝
//
// ── LO MEDIDO (7-sep-2026) ────────────────────────────────────────────────────────────────
// `SUELO_GUARDS = 20` y `SUELO_DECLARACIONES = 54` se escribieron cuando el árbol tenía por ahí.
// El 7-sep-2026 tenía **41 guards y 117 declaraciones**. Provocado quitando declaraciones una a una
// sobre una copia del árbol: **el suelo habla en la 64ª**. Sesenta y tres declaraciones —el
// **54%** de la vigilancia— pueden desaparecer sin que nada lo diga.
//
// ── DE QUÉ SE DERIVA EL SUELO, Y POR QUÉ ─────────────────────────────────────────────────
// Tres candidatos, y los dos primeros están descartados por construcción:
//
//   ① Un número CABLEADO es un censo congelado el día que se escribió. Es lo que hay hoy, y
//      medido arriba: se queda 63 declaraciones por detrás sin que nadie se entere.
//
//   ② Derivarlo de LA POBLACIÓN DE HOY es circular: lo que el suelo vigila ES la población, así
//      que un suelo calculado desde ella nunca puede hablar. Cero sobre población vacía no es
//      un cero, y un suelo que se recalcula solo no es un suelo: es un espejo.
//
//   ③ ✅ Derivarlo de **`origin/main`**, y POR GUARD. Rompe el círculo porque main es un árbol
//      DISTINTO del que se está juzgando. Y resuelve el filo que el encargo pone encima de la
//      mesa —«¿qué pasa cuando alguien retira una declaración legítimamente?»— así:
//
//        · CRECER es gratis. Añadir guards o declaraciones no dispara NADA. Un suelo que salta
//          en cada PR se desactiva antes que uno que no salta nunca.
//        · PERDER habla a la PRIMERA. No hace falta perder 63: con que un guard que declaraba
//          tres pase a declarar dos, el suelo lo dice y nombra cuál.
//        · RETIRAR A PROPÓSITO se puede, y cuesta UNA LÍNEA: se apunta el guard en
//          `RETIRADAS_A_PROPOSITO` con su motivo, en el mismo commit. El diff lo dice en voz
//          alta, que es exactamente lo que el mensaje del suelo viejo ya pedía y nadie hacía.
//        · Y NO CADUCA: main se mueve solo, así que la referencia se pone al día sin que nadie
//          se acuerde de subir un número.
//
// ── POR QUÉ ESTO NO PISA A SCRUM-757 ──────────────────────────────────────────────────────
// El lector de declaraciones NO se toca (prohibición explícita). Aquí sólo se LEE lo que él
// devuelve, en dos árboles, y se restan. La pérdida por declaración INCOMPLETA ya la denuncia
// SCRUM-745; ésta es la otra mitad: la declaración que desaparece ENTERA.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { lecturaDeDeclaraciones } from './meta-guard-mutaciones.mjs';

export const RAMA_DE_REFERENCIA = 'origin/main';

/**
 * La referencia NO es la punta de main: es la BASE DE FUSIÓN entre esta rama y main.
 *
 * 🔴 Lo cazó el control positivo la primera vez que se corrió: esta rama salió de un main
 * anterior, main avanzó (se mezcló SCRUM-804 con sus 3 declaraciones), y el suelo cantó
 * «has perdido 3» cuando esta rama no había perdido nada — sólo iba por detrás. Contra la
 * punta, TODA rama que no acabe de nacer sale roja, y un suelo que salta siempre se desactiva.
 * Contra la base de fusión se mide sólo lo que ESTA rama hizo, que es de lo que responde.
 *
 * Devuelve `null` si no se puede saber: no haber mirado no se devuelve como «no falta nada».
 */
export function referenciaDe(raiz = process.cwd()) {
  const prueba = (args) => {
    try {
      return execFileSync('git', args, { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() || null;
    } catch { return null; }
  };
  return prueba(['merge-base', 'HEAD', RAMA_DE_REFERENCIA])
    ?? prueba(['rev-parse', '--verify', RAMA_DE_REFERENCIA]);
}

/**
 * Retiradas DELIBERADAS de cobertura. Una línea por guard, con su motivo y su fecha.
 * Mientras esté aquí, el suelo no se queja de ese guard. Vaciar la lista es gratis; llenarla
 * cuesta un renglón que el revisor del PR ve.
 */
export const RETIRADAS_A_PROPOSITO = [
  // { guard: 'scrumNNN-lo-que-sea.test.mjs', motivo: 'por qué se retiró', fecha: '2026-09-07' },
];

/** Los ficheros CANDIDATOS de una ref. El grep sólo preselecciona: quien cuenta es el AST. */
function candidatosEn(ref, raiz) {
  try {
    const t = execFileSync('git', ['grep', '-l', 'MUTACIONES_QUE_ME_TUMBAN', ref, '--', 'tests/'],
      { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    // `git grep` con una ref antepone `<ref>:` a cada ruta. Se le quita por PREFIJO CONOCIDO, no
    // partiendo por el primer `:` — eso último es la forma de la partición `<metodo>:<pasarela>`
    // que vigila SCRUM-474, y no hay por qué escribir aquí una tercera implementación de aquello.
    const prefijo = `${ref}:`;
    return t.split('\n').map((l) => l.trim()).filter(Boolean)
      .map((l) => (l.startsWith(prefijo) ? l.slice(prefijo.length) : l))
      .filter((p) => p.endsWith('.test.mjs'));
  } catch (e) {
    if (e.status === 1) return []; // git grep sin coincidencias
    return null; // no se pudo mirar: eso NO es «no hay ninguna»
  }
}

/**
 * Declaraciones COMPLETAS por guard en una ref de git. `null` si no se pudo mirar la ref —
 * un fallo al mirar no se devuelve como cero (regla de la casa: cero sobre población vacía
 * no es un cero).
 */
export function declaracionesEn(ref, raiz = process.cwd()) {
  const rutas = candidatosEn(ref, raiz);
  if (rutas === null) return null;
  const porGuard = new Map();
  for (const rel of rutas) {
    let texto;
    try {
      texto = execFileSync('git', ['show', `${ref}:${rel}`],
        { cwd: raiz, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch { continue; }
    const n = lecturaDeDeclaraciones(texto, path.basename(rel)).buenas.length;
    if (n > 0) porGuard.set(path.basename(rel), n);
  }
  return porGuard;
}

/** Declaraciones COMPLETAS por guard en el árbol de trabajo. */
export function declaracionesEnElArbol(raiz = process.cwd()) {
  const dir = path.join(raiz, 'tests');
  const porGuard = new Map();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.test.mjs')) continue;
    const n = lecturaDeDeclaraciones(fs.readFileSync(path.join(dir, f), 'utf8'), f).buenas.length;
    if (n > 0) porGuard.set(f, n);
  }
  return porGuard;
}

/**
 * Qué cobertura se ha PERDIDO respecto a la referencia. Crecer nunca aparece aquí.
 * Devuelve `{ medible, perdidas, motivo }`. Si la referencia no se pudo mirar, `medible: false`
 * y NO se inventa un veredicto.
 */
export function perdidasContraLaReferencia(actual, referencia, retiradas = RETIRADAS_A_PROPOSITO) {
  if (!referencia) {
    return {
      medible: false,
      perdidas: [],
      motivo: `no pude leer la referencia (base de fusión con ${RAMA_DE_REFERENCIA}): `
        + 'esto NO dice que no falte nada, dice que no he mirado.',
    };
  }
  const eximido = new Set(retiradas.map((r) => r.guard));
  const perdidas = [];
  for (const [guard, antes] of referencia) {
    if (eximido.has(guard)) continue;
    const ahora = actual.get(guard) || 0;
    if (ahora < antes) perdidas.push({ guard, antes, ahora });
  }
  perdidas.sort((a, b) => (b.antes - b.ahora) - (a.antes - a.ahora) || a.guard.localeCompare(b.guard));
  return { medible: true, perdidas, motivo: null };
}

/** El texto del suelo, o `null` si no hay nada que decir. */
export function sueloContraMain({ medible, perdidas, motivo }) {
  if (!medible) return null; // no medible NO es rojo: lo canta quien llama, con su propio hueco
  if (perdidas.length === 0) return null;
  const total = perdidas.reduce((s, p) => s + (p.antes - p.ahora), 0);
  return `SE HA PERDIDO VIGILANCIA CONTRA LA BASE DE FUSIÓN con ${RAMA_DE_REFERENCIA}: `
    + `${total} declaración(es) en ${perdidas.length} guard(s).\n`
    + perdidas.map((p) => `  · ${p.guard}: ${p.antes} → ${p.ahora}`).join('\n')
    + '\n  Si la retirada es A PROPÓSITO, apunta el guard en RETIRADAS_A_PROPOSITO con su motivo,\n'
    + '  EN EL MISMO COMMIT, y que el diff lo diga en voz alta. Si no lo es, la has perdido sin verla.';
}
