// tests/_veredicto-mudez.mjs — SCRUM-1395b
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL VEREDICTO DE `censo:mudez`, GUARDADO EN EL REPO Y EXIGIDO EN LA TANDA (opción ② de
// SCRUM-1395, decidida por el fundador en c.18744: «Ok que pase»).
//
// El censo tarda minutos y muta `tests/_guard-texto.mjs` mientras corre: no puede ir en la tanda.
// Lo que sí cabe en la tanda es LEER lo que el censo dictó y comprobar que sigue valiendo:
//
//   · cada fichero de la población figura en `tests/_veredicto-mudez.json`;
//   · con la huella de su contenido de HOY (si alguien le quita la aserción que lo hacía vivo, la
//     huella cambia y el veredicto caduca: hay que volver a medirlo);
//   · con la huella del filtro con la que se midió (si cambia el filtro, caduca todo);
//   · y ninguno dice MUDO.
//
// Una pieza, dos consumidores: `scripts/censo-mudez.mjs` (escribe) y
// `tests/scrum719-el-suelo-de-los-doce.test.mjs` (exige). La población y la huella se calculan
// AQUÍ y en ningún otro sitio: dos definiciones de «quién entra» son la próxima discrepancia.
//
// ── 🔴 LA SALIDA «NO SE PUDO CORRER» (condición ③ de c.18744), DISEÑADA Y NO DESCUBIERTA ──
// Si el censo no consigue correr un fichero (se pasa del tiempo, no ejecuta ni un test, ya estaba
// rojo antes de mutar), lo apunta como CIEGO o YA ROJO. La tanda NO cae por eso —convertir un
// instrumento lento en un bloqueo es justo lo que se pidió evitar— pero tampoco lo cuenta como
// vivo: sale SIN JUZGAR, con su nombre, en la línea de siempre y en un salto con motivo. Lo que
// sí cae es un veredicto que FALTA o CADUCÓ: eso no es «no se pudo», es «no se corrió».
// ═════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const RUTA_VEREDICTO = 'tests/_veredicto-mudez.json';
export const RUTA_FILTRO = 'tests/_guard-texto.mjs';

/** Las clases que dicta el censo. VIVO y NO APLICA están medidos; MUDO cae; el resto, sin juzgar. */
export const CLASES = Object.freeze(['VIVO', 'MUDO', 'CIEGO', 'NO APLICA', 'YA ROJO']);
export const SIN_JUZGAR = Object.freeze(['CIEGO', 'YA ROJO']);

/** Por debajo de esto el censo no está mirando donde cree (el mismo suelo que tenía el script). */
export const SUELO_POBLACION = 20;

/**
 * Los nombres del filtro y sus envoltorios. Si nace otro envoltorio, SU NOMBRE VA AQUÍ en el mismo
 * commit (la lección de SCRUM-719: nueve guards migrados a `ejecutableDe` dejaron de verse).
 */
export const NOMBRES_DEL_FILTRO = /soloEjecutable|ejecutableDe|ejecutablesDe|leerFuente|literalesDeCadena/;

/** La población: todo `*.test.mjs` de `tests/` que MENCIONE el filtro. Quién lo llama, lo mide el censo. */
export function poblacionMudez(raiz) {
  const dir = path.join(raiz, 'tests');
  return fs.readdirSync(dir)
    .filter((f) => /\.test\.mjs$/.test(f))
    .filter((f) => NOMBRES_DEL_FILTRO.test(fs.readFileSync(path.join(dir, f), 'utf8')))
    .sort();
}

/**
 * La huella de un fichero: sha256 de su contenido con los finales de línea normalizados, en 16
 * hexadecimales. 🔴 Normalizados porque esta máquina hace checkout con CRLF y CI con LF: sin eso,
 * todo veredicto escrito en Windows saldría caducado en CI.
 */
export function huella(texto) {
  return crypto.createHash('sha256').update(String(texto).replace(/\r\n/g, '\n')).digest('hex').slice(0, 16);
}
export const huellaDe = (raiz, rel) => huella(fs.readFileSync(path.join(raiz, rel), 'utf8'));

/**
 * Lo que dictan las dos pasadas de UN fichero. `antes` es la pasada limpia, `despues` la mutada
 * (puede faltar si no llegó a correrse). Cada una: `{ verde, tests, llamoAlFiltro, cortado }`.
 *
 * 🔴 `cortado` (se pasó del tiempo o lo mató una señal) en la pasada MUTADA es CIEGO, no VIVO:
 * hasta SCRUM-1395b un fichero que no terminaba con el filtro roto salía «rojo», y rojo con el
 * filtro roto es VIVO. «No se pudo correr» se leía como el mejor veredicto posible.
 */
export function clasificar(antes, despues) {
  if (antes.cortado || antes.tests === 0) return 'CIEGO';
  if (!antes.llamoAlFiltro) return 'NO APLICA';
  if (!antes.verde) return 'YA ROJO';
  if (!despues || despues.cortado) return 'CIEGO';
  return despues.verde ? 'MUDO' : 'VIVO';
}

/** Lee el JSON guardado. Si no existe o no se puede leer, devuelve `null` (y quien lo pida, cae). */
export function leerVeredicto(raiz) {
  try {
    return JSON.parse(fs.readFileSync(path.join(raiz, RUTA_VEREDICTO), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Enfrenta el veredicto guardado con el árbol. Pura: recibe la población, las huellas de hoy y el
 * veredicto, para poder sembrarle casos sin tocar el árbol.
 *
 * @param {string[]} poblacion
 * @param {(f: string) => string} huellaHoy   huella de cada fichero de la población
 * @param {string} filtroHoy                  huella de `tests/_guard-texto.mjs`
 * @param {{ filtro: string, ficheros: Record<string, [string, string]> } | null} veredicto
 */
export function juzgarVeredicto(poblacion, huellaHoy, filtroHoy, veredicto) {
  const fichas = (veredicto && veredicto.ficheros) || {};
  const r = {
    poblacion: poblacion.length,
    ciego: !veredicto || poblacion.length < SUELO_POBLACION,
    filtroCaducado: !!veredicto && veredicto.filtro !== filtroHoy,
    faltan: [], caducados: [], sobran: [], raros: [],
    vivos: [], mudos: [], noAplica: [], sinJuzgar: [],
  };
  for (const f of poblacion) {
    const ficha = fichas[f];
    if (!ficha) { r.faltan.push(f); continue; }
    const [clase, h] = ficha;
    if (h !== huellaHoy(f)) { r.caducados.push(f); continue; }
    if (clase === 'VIVO') r.vivos.push(f);
    else if (clase === 'MUDO') r.mudos.push(f);
    else if (clase === 'NO APLICA') r.noAplica.push(f);
    else if (SIN_JUZGAR.includes(clase)) r.sinJuzgar.push(`${f} (${clase})`);
    else r.raros.push(`${f} (${clase})`);
  }
  const enPoblacion = new Set(poblacion);
  r.sobran = Object.keys(fichas).filter((f) => !enPoblacion.has(f));
  r.alDia = !r.ciego && !r.filtroCaducado && !r.faltan.length && !r.caducados.length
    && !r.sobran.length && !r.raros.length;
  r.linea = `SCRUM-1395b · censo de mudez, veredicto guardado: ${r.poblacion} guards mirados · `
    + `${r.mudos.length} mudos · ${r.vivos.length} vivos · ${r.noAplica.length} no aplica · `
    + `${r.sinJuzgar.length} sin juzgar (no se pudo correr) · `
    + `${r.faltan.length + r.caducados.length + r.sobran.length + r.raros.length} sin medir o caducados`
    + `${r.filtroCaducado ? ' · 🔴 el filtro cambió desde la medida' : ''}`
    + `${r.ciego ? ' · 🔴 CIEGO' : ''}`
    + ` · población: *.test.mjs de tests/ que nombran el filtro`;
  return r;
}

/** El JSON, una ficha por línea y en orden: dos PR que miden ficheros distintos no chocan. */
export function serializarVeredicto(filtro, ficheros) {
  const nombres = Object.keys(ficheros).sort();
  const lineas = nombres.map((f, i) => `    ${JSON.stringify(f)}: ${JSON.stringify(ficheros[f])}${i < nombres.length - 1 ? ',' : ''}`);
  return '{\n'
    + '  "//": "SCRUM-1395b · lo escribe `npm run censo:mudez -- --escribir`; NO se edita a mano. Lo exige tests/scrum719-el-suelo-de-los-doce.test.mjs. Cada ficha: [clase, huella del fichero]. «filtro» es la huella de tests/_guard-texto.mjs con la que se midió.",\n'
    + `  "filtro": ${JSON.stringify(filtro)},\n`
    + '  "ficheros": {\n'
    + `${lineas.join('\n')}\n`
    + '  }\n'
    + '}\n';
}
