// scripts/_senal-de-nombres-linea.mjs — SCRUM-1324c
//
// LA LÍNEA DE REGISTRO de la señal de nombres (SCRUM-1339d), sola y SIN NINGÚN PAQUETE: sólo JS.
//
// Vivía en `_senal-de-nombres.mjs`, que importa `typescript` y el censo de `tests/`. El vigía de main
// (`scripts/vigia-silencio-de-main.mjs`) la lee desde SCRUM-1339u, y su workflow (`vigia-de-main.yml`)
// no instala dependencias: desde el 22-oct-2026 a las 11:50Z el juez moría al cargar con
// `Cannot find package 'typescript'` y el Issue del vigía recibió 123 «SIN veredicto» en 36 h. El
// escritor y el lector van juntos aquí; `_senal-de-nombres.mjs` los re-exporta, así que quien los
// importaba de allí no cambia. Lo ata `tests/scrum1324c-el-vigia-carga-sin-paquetes.test.mjs`.

/** Versión del formato de la línea de registro. Si cambia el formato, cambia esto. */
export const VERSION = 1;
export const TITULO = 'señal de nombres';

/**
 * LA LÍNEA DE REGISTRO: sale SIEMPRE, también con 0 y también cuando no se pudo medir, con su
 * población al lado. Es lo que lee `registroDesdeLinea` desde fuera, para la tasa.
 */
export function lineaDeRegistro(r) {
  const p = r.poblacion;
  const t = r.tap;
  const n = (v) => (v === null || v === undefined ? '?' : String(v));
  return `[${TITULO} v${VERSION}] medible=${r.medible ? 'si' : 'no'}`
    + ` ausentes=${n(r.ausentes)} ficheros_con_ausentes=${r.medible ? r.bloques.length : '?'} dudosos=${n(r.dudosos)}`
    + ` declarados=${p.llamadas} literales=${p.literales} no_comparables=${p.noComparables}`
    + ` ficheros=${p.ficheros} tap_tests=${n(t.tests)} tap_fail=${n(t.fail)}`;
}

/** La vuelta: de una línea de registro a un registro. `null` si la línea no es una de éstas. */
export function registroDesdeLinea(texto) {
  const m = new RegExp(`\\[${TITULO} v(\\d+)\\] (.*)$`, 'm').exec(String(texto ?? ''));
  if (!m) return null;
  const campos = Object.fromEntries(m[2].trim().split(/\s+/).map((par) => par.split('=')).filter((par) => par.length === 2));
  const num = (v) => (v === undefined || v === '?' ? null : Number(v));
  return {
    version: Number(m[1]), medible: campos.medible === 'si',
    ausentes: num(campos.ausentes), ficherosConAusentes: num(campos.ficheros_con_ausentes), dudosos: num(campos.dudosos),
    declarados: num(campos.declarados), literales: num(campos.literales), noComparables: num(campos.no_comparables),
    ficheros: num(campos.ficheros), tapTests: num(campos.tap_tests), tapFail: num(campos.tap_fail),
  };
}
