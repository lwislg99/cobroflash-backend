// scripts/conflicto-de-registro.mjs — SCRUM-839d · fase 2, pieza A
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UN PR QUE SOLO CHOCA EN EL REGISTRO SE ARREGLA SOLO. UNO QUE CHOCA EN CÓDIGO, NO.
//
// Medido el 16-sep-2026 sobre los 1.928 merges de `main`: 34 merges tuvieron conflicto SOLO en
// `docs/master/`, casi siempre por dos entradas que añadían líneas en el mismo sitio. Con
// `merge=union` salen todos limpios. El caso que lo motivó, el #1318: abierto 05:58Z, choque solo en
// `docs/master/SCRUM-609.md`, resuelto a mano 08:53Z. Tres horas por dos entradas de registro.
//
// 🔴 PERO GITHUB NO RESPETA `merge=union`. Medido con dos PR gemelos (#1353 con la regla, #1354
// sin ella): los dos CONFLICTING. Git por línea de comandos, con las MISMAS ramas, sí la respeta.
// Así que la línea de `.gitattributes` sola no arregla ningún PR: hace falta alguien que haga el
// merge con git y lo empuje. Ese alguien es `.github/workflows/conflicto-de-registro.yml`, y la
// DECISIÓN de si empujar vive aquí, fuera del YAML, donde la tanda la puede ejecutar.
//
// ── DOS CERRADURAS, INDEPENDIENTES, PARA NO EMPUJAR NUNCA SOBRE CÓDIGO ───────────────────────
//
//   1 · LA LISTA. Se mira el merge COMO LO VE GITHUB —sin ningún atributo— y se exige que TODOS
//       los ficheros en conflicto casen `docs/master/<algo>.md`. Uno fuera, y no se empuja.
//   2 · EL MERGE. Se rehace con los atributos de `main` y tiene que salir LIMPIO. Como el guard
//       de `.gitattributes` (SCRUM-839d) impide `merge=union` fuera de `docs/master/*.md`, un
//       conflicto de código SIGUE siendo conflicto aquí aunque la cerradura 1 fallara.
//
// ── 🔴 LA TRAMPA DE LOS ATRIBUTOS, MEDIDA ANTES DE ESCRIBIR ESTO ─────────────────────────────
// `git merge-tree` NO lee los atributos de los commits que mezcla: lee los del ÁRBOL DE TRABAJO,
// es decir, los de la rama que haya sacada. Medido en un repo de prueba con la regla solo en
// `main`: sacada `main` → limpio; sacada la rama del PR → conflicto. Mismo merge, dos veredictos.
// Por eso aquí la fuente de atributos se FIJA siempre con `--attr-source`: el árbol vacío para
// ver lo que ve GitHub, y `main` para resolver. Y `core.attributesFile` se anula, para que el
// fichero de atributos de la máquina de nadie decida un merge.
//
// ── 🔴 EL SUELO: «SALIDA 1» NO SIGNIFICA «HAY CONFLICTO» ─────────────────────────────────────
// Medido: `git merge-tree` con una ref que no existe sale con 1 —el MISMO código que un
// conflicto— y la salida vacía. Así que un conflicto solo se cree con un árbol válido Y una
// lista de ficheros no vacía. Sin lista, «no pude mirar», y no se empuja.
//
// ── 🔴 LA CERRADURA 0, Y VA PRIMERO: SOLO PR QUE YA ESTABAN ARMADOS (SCRUM-839e) ─────────────
// La primera pasada real (16-sep-2026, 14:37Z) empujó a #880 y #399, dos PR de semanas SIN
// auto-merge. Su push disparó `pr-automatico.yml`, que los armó, y entraron en `main` a las 14:44Z
// y 14:45Z. Un PR sin auto-merge es uno que nadie prometió mergear —el criterio del vigía—, y
// arreglarle el conflicto es empujarlo hacia `main`. Así que se mira ANTES que nada, con el dato
// de la lista que el workflow lee al empezar la pasada: armado → se sigue; sin armar → no se
// toca; y si el dato falta o tiene una forma que no se conoce → «no pude mirar».
// ═════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Lo único que se deja resolver solo. `*` de gitattributes no cruza `/`, y esto tampoco. */
export const RUTA_DE_REGISTRO = /^docs\/master\/[^/]+\.md$/;

const OID = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;

/**
 * ¿Tenía el PR el auto-merge armado? Lee `autoMergeRequest` tal como lo da `gh pr list --json`:
 * `null` si no lo tiene, un objeto con `enabledAt` si lo tiene. Que el campo NO ESTÉ no es «no
 * armado»: es que la lista no lo pidió o la API no lo dio.
 *
 * @returns {{estado:'ARMADO'|'SIN-ARMAR'} | {estado:'NO-PUDE-MIRAR', motivo:string}}
 */
export function armadoAntesDeLaPasada(pr) {
  if (!pr || typeof pr !== 'object' || !Object.hasOwn(pr, 'autoMergeRequest')) {
    return { estado: 'NO-PUDE-MIRAR', motivo: 'no pude mirar si el PR tenía el auto-merge armado: la lista no trae autoMergeRequest' };
  }
  const a = pr.autoMergeRequest;
  if (a === null) return { estado: 'SIN-ARMAR' };
  if (typeof a === 'object' && typeof a.enabledAt === 'string' && a.enabledAt) return { estado: 'ARMADO' };
  return { estado: 'NO-PUDE-MIRAR', motivo: `no pude mirar si el PR tenía el auto-merge armado: autoMergeRequest con forma desconocida (${JSON.stringify(a)})` };
}

/**
 * El `git` de verdad. Se inyecta para poder darle al suelo salidas que git no da a voluntad.
 *
 * `core.attributesFile=` VACÍO anula el fichero de atributos de la máquina sin tocar ninguna
 * configuración ni dejar nada en disco. Medido el 16-sep-2026 con un global de `* merge=union`:
 * sin la opción, `merge: union`; con ella, `merge: unspecified`.
 */
export function gitReal(cwd) {
  return (args, input) => {
    const r = spawnSync('git', ['-c', 'core.attributesFile=', ...args], {
      cwd, encoding: 'utf8', input, maxBuffer: 64 * 1024 * 1024,
    });
    return { status: r.error ? null : r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
  };
}

/**
 * Qué ficheros chocan al mezclar `cabeza` con `main`, leyendo los atributos de `fuente`.
 *
 * @returns {{estado:'LIMPIO', arbol:string}
 *          |{estado:'CONFLICTO', arbol:string, ficheros:string[]}
 *          |{estado:'NO-PUDE-MIRAR', motivo:string}}
 */
export function mezclar(git, { cabeza, main, fuente }) {
  const r = git(['--attr-source=' + fuente, 'merge-tree', '--write-tree', '-z', '--name-only',
    '--no-messages', cabeza, main]);
  const trozos = r.stdout.split('\0');
  if (trozos.at(-1) === '') trozos.pop();
  const [arbol, ...ficheros] = trozos;

  if (r.status !== 0 && r.status !== 1) {
    return { estado: 'NO-PUDE-MIRAR', motivo: `merge-tree salió con ${r.status}: ${r.stderr.trim()}` };
  }
  if (!OID.test(arbol || '')) {
    return { estado: 'NO-PUDE-MIRAR', motivo: `merge-tree no devolvió un árbol (salida ${r.status}): ${r.stderr.trim()}` };
  }
  if (r.status === 0) {
    return ficheros.length
      ? { estado: 'NO-PUDE-MIRAR', motivo: 'merge-tree dice limpio y aun así lista ficheros en conflicto' }
      : { estado: 'LIMPIO', arbol };
  }
  if (!ficheros.length || ficheros.some((f) => !f)) {
    return { estado: 'NO-PUDE-MIRAR', motivo: 'merge-tree dice conflicto pero no dio la lista de ficheros' };
  }
  return { estado: 'CONFLICTO', arbol, ficheros };
}

/**
 * LA DECISIÓN. No escribe nada en ninguna rama: como mucho crea un commit suelto, que el
 * workflow empuja solo si `accion === 'EMPUJAR'`.
 *
 * Acciones: NADA (no hay conflicto) · EMPUJAR · NO-EMPUJA (con `causa`) · NO-PUDE-MIRAR.
 *
 * `pr` es la entrada del PR en la lista leída al empezar la pasada (con `autoMergeRequest`).
 */
export function decidir(git, { pr, cabeza, main, mensaje }) {
  // ── CERRADURA 0 · ¿alguien prometió mergearlo? Antes de mirar ningún fichero ──
  const armado = armadoAntesDeLaPasada(pr);
  if (armado.estado === 'NO-PUDE-MIRAR') return { accion: 'NO-PUDE-MIRAR', motivo: armado.motivo };
  if (armado.estado === 'SIN-ARMAR') return { accion: 'NO-EMPUJA', causa: 'SIN-AUTO-MERGE' };

  // El árbol vacío, escrito de verdad: `--attr-source` necesita un objeto que resuelva.
  const vacio = git(['hash-object', '-t', 'tree', '-w', '--stdin'], '');
  const arbolVacio = vacio.stdout.trim();
  if (vacio.status !== 0 || !OID.test(arbolVacio)) {
    return { accion: 'NO-PUDE-MIRAR', motivo: 'no pude escribir el árbol vacío para leer sin atributos' };
  }

  // Unos atributos locales del repositorio (`info/attributes`) mandan sobre todo lo demás, también
  // sobre `--attr-source`. Si alguno toca `merge`, lo que se mida aquí no es lo que ve GitHub.
  const info = git(['rev-parse', '--path-format=absolute', '--git-path', 'info/attributes']);
  const rutaInfo = info.stdout.trim();
  if (info.status !== 0 || !rutaInfo) {
    return { accion: 'NO-PUDE-MIRAR', motivo: 'no pude localizar info/attributes del repositorio' };
  }
  if (fs.existsSync(rutaInfo) && /\bmerge\b/.test(fs.readFileSync(rutaInfo, 'utf8'))) {
    return { accion: 'NO-PUDE-MIRAR', motivo: `${rutaInfo} declara un driver de merge: pisaría a los del repositorio` };
  }

  // ── CERRADURA 1 · la lista, tal como la ve GitHub ──
  const visto = mezclar(git, { cabeza, main, fuente: arbolVacio });
  if (visto.estado === 'NO-PUDE-MIRAR') return { accion: 'NO-PUDE-MIRAR', motivo: visto.motivo };
  if (visto.estado === 'LIMPIO') return { accion: 'NADA', motivo: 'sin conflicto' };

  const fuera = visto.ficheros.filter((f) => !RUTA_DE_REGISTRO.test(f));
  if (fuera.length) {
    return { accion: 'NO-EMPUJA', causa: 'FUERA-DE-REGISTRO', ficheros: visto.ficheros, fuera };
  }

  // ── CERRADURA 2 · el merge, con los atributos de `main` ──
  const resuelto = mezclar(git, { cabeza, main, fuente: main });
  if (resuelto.estado === 'NO-PUDE-MIRAR') return { accion: 'NO-PUDE-MIRAR', motivo: resuelto.motivo };
  if (resuelto.estado === 'CONFLICTO') {
    return { accion: 'NO-EMPUJA', causa: 'UNION-NO-RESUELVE', ficheros: visto.ficheros, quedan: resuelto.ficheros };
  }

  const commit = git(['commit-tree', resuelto.arbol, '-p', cabeza, '-p', main, '-m', mensaje]);
  const sha = commit.stdout.trim();
  if (commit.status !== 0 || !OID.test(sha)) {
    return { accion: 'NO-PUDE-MIRAR', motivo: `commit-tree falló: ${commit.stderr.trim()}` };
  }
  return { accion: 'EMPUJAR', ficheros: visto.ficheros, commit: sha };
}

// ── CLI, para el workflow ────────────────────────────────────────────────────────────────
//   node scripts/conflicto-de-registro.mjs <pr> <sha-cabeza> <ref-main> <prs.json>
// `prs.json` es la lista de PR que el workflow leyó al empezar la pasada, con `autoMergeRequest`.
// Escribe el veredicto en JSON por stdout. Sale en 0 siempre que haya veredicto: qué hacer con
// él lo decide el workflow, y NO-PUDE-MIRAR es un veredicto, no un fallo del proceso.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [pr, cabeza, main, lista] = process.argv.slice(2);
  if (!/^\d+$/.test(pr || '') || !cabeza || !main || !lista) {
    console.error('uso: node scripts/conflicto-de-registro.mjs <pr> <sha-cabeza> <ref-main> <prs.json>');
    process.exit(2);
  }
  // Una lista ilegible, o sin este PR, deja `entrada` sin definir: la cerradura 0 lo convierte en
  // «no pude mirar». Nunca en «no está armado» ni, peor, en «da igual».
  let entrada;
  try {
    const prs = JSON.parse(fs.readFileSync(lista, 'utf8'));
    entrada = Array.isArray(prs) ? prs.find((p) => p && p.number === Number(pr)) : undefined;
  } catch { entrada = undefined; }
  const mainSha = execFileSync('git', ['rev-parse', '--verify', main + '^{commit}'], { encoding: 'utf8' }).trim();
  // El mensaje no lleva el nombre de la rama: es texto que escribe otra persona.
  const mensaje = `Merge main (${mainSha.slice(0, 8)}) en el PR #${pr}\n\n`
    + 'SCRUM-839d: el conflicto era solo de registro (docs/master/*.md) y se resolvió con\n'
    + 'merge=union. Ningún fichero fuera de docs/master estaba en conflicto.';
  const v = decidir(gitReal(process.cwd()), { pr: entrada, cabeza, main: mainSha, mensaje });
  process.stdout.write(JSON.stringify({ pr: Number(pr), ...v }) + '\n');
}
