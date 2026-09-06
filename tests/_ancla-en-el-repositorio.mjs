// tests/_ancla-en-el-repositorio.mjs — SCRUM-796
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL ANCLA SE COMPRUEBA CONTRA EL FUENTE DEL REPOSITORIO, NO CONTRA EL FICHERO QUE EL ARNÉS
// ESTÁ ESCRIBIENDO EN ESE MOMENTO.
//
// Seis guards del árbol llevan este aserto, para que una declaración caducada salga ROJA en vez
// de CIEGA:
//
//     assert.ok(fs.readFileSync(abs, 'utf8').includes(m.de), '🔴 el ancla … ya no está');
//
// 🔴 Y CAE POR DEFINICIÓN MIENTRAS EL ARNÉS TRABAJA. `meta:mutaciones` sustituye `m.de` por `m.a`
// en ese mismo fichero y LUEGO corre el guard: el ancla ya no está porque acaba de quitarla él.
// Medido el 6-sep-2026 aplicando a `scrum753` su propia declaración:
//
//     🔴 SCRUM-753 · el LECTOR OFICIAL de `meta:mutaciones` VE mis declaraciones
//        AssertionError · «el ancla de la mutación … ya no está en …: la declaración caducó»
//
// De los 36 colaterales por arrastre que midió SCRUM-788, **27 eran este único mecanismo**: el
// guard inspeccionando el árbol en plena operación.
//
// ── POR QUÉ `HEAD` Y NO «CONTIENE `de` O CONTIENE `a`» ──────────────────────────────────────
// La forma barata sería aceptar también la sustituta. **Se descartó midiendo**: en 5 de las 81
// declaraciones del árbol la sustituta YA ESTÁ en el fichero limpio —`'    return false;'`,
// `'  await assertUnicidadDeNombre();'`…— y entonces ese aserto **no podría fallar nunca**. Un
// aserto que no puede fallar es peor que el defecto que arregla.
//
// `HEAD` es el fuente del repositorio y el arnés no lo toca. Medido: de los ficheros que hoy
// declaran mutaciones, **0 tienen el ancla ausente en HEAD**, y sólo 2 no están en HEAD — los dos
// de `dist/`, que git ignora por diseño. Para ésos NO HAY fuente original en el repositorio y esto
// lo dice: `medible: false`. No se calla, y no se inventa un verde.
//
// ⚠️ HUECO DECLARADO: una edición que quite el ancla y NO se haya commiteado no se ve desde aquí
// —HEAD todavía la tiene—. CI corre sobre lo commiteado, así que allí sale igual; en local, la
// primera pasada tras commitear.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/** El texto de un fichero TAL Y COMO ESTÁ EN EL REPOSITORIO (HEAD). `null` si git no puede darlo. */
export function fuenteDelRepositorio(relativa, raiz) {
  const posix = String(relativa).split(path.sep).join('/');
  try {
    const texto = execFileSync('git', ['show', `HEAD:${posix}`],
      { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
    return { texto, origen: `HEAD:${posix}` };
  } catch (e) {
    return { texto: null, origen: null, motivo: `git no puede darme \`HEAD:${posix}\` (${e.code || e.status || 'sin código'})` };
  }
}

/**
 * ¿Sigue el ancla de esta mutación en el fuente del repositorio?
 *
 * Devuelve `{ medible: false, motivo }` cuando no hay fuente en el repositorio con el que
 * comparar — un fichero generado, por ejemplo. Eso NO es un verde: es que no se puede medir, y
 * quien llama tiene que decirlo por pantalla.
 */
export function anclaEnElRepositorio(mut, raiz) {
  const { texto, origen, motivo } = fuenteDelRepositorio(mut.fichero, raiz);
  if (texto === null) return { medible: false, motivo };
  return { medible: true, origen, viva: texto.includes(mut.de) };
}

/**
 * CUÁNTAS VECES aparece el ancla en el fuente del repositorio.
 *
 * La otra grafía del mismo auto-chequeo: varios guards no preguntan «¿está?» sino «¿está UNA
 * sola vez?» —`src.split(m.de).length - 1 === 1`— porque con cero no muta nada y con dos muta de
 * más. Leída del disco, esa cuenta da **0** mientras el arnés tiene la mutación puesta, y el
 * aserto cae por lo mismo. Medido: mi primer censo del patrón buscó sólo `.includes(m.de)` y no
 * vio esta forma, así que **7 de los arrastres siguieron ahí** tras el primer arreglo.
 */
export function ocurrenciasEnElRepositorio(mut, raiz) {
  const { texto, origen, motivo } = fuenteDelRepositorio(mut.fichero, raiz);
  if (texto === null) return { medible: false, motivo };
  return { medible: true, origen, veces: texto.split(mut.de).length - 1 };
}
