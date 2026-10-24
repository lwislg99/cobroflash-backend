// scripts/_hojas-del-panel.mjs — SCRUM-1603
//
// LAS HOJAS DEL PANEL, Y SU FUENTE, EN EL BANCO.
//
// ── QUÉ PASABA, MEDIDO ───────────────────────────────────────────────────────────────────────
// Los tres bancos que montan el panel a mano (`_banco-lista.mjs`, `guard-objetivo-tactil.mjs` y
// `censo-objetivo-tactil-panel.mjs`) enlazaban `tokens.css` y `styles.css` escritos a mano, y
// `public/dashboard/index.html` enlaza además `/fonts/inter.css` desde SCRUM-1234. El banco medía
// con la fuente de RESERVA (Segoe UI en Windows) y producción con Inter:
//   · J3 (SCRUM-1603 c.20680): el campo `.input` da 36 px en el banco y 34 en la app.
//   · S2 (SCRUM-962 §962g): «Descuento global» 44,6 en el banco → 43,6 en yaqu.app. Artefacto en
//     el banco, DEFECTO en producción. Y cortando `/fonts/*` en producción, prod daba exactamente
//     los veredictos del banco: la causa, probada.
// Una lista de hojas escrita a mano caduca el día que el índice gana una, y nadie se entera.
//
// ── QUÉ HACE ESTO ────────────────────────────────────────────────────────────────────────────
// ① Las hojas salen DEL ÍNDICE, en su orden, con el único lector de `<link>` de la casa
//   (`hojasDeLaPagina`, SCRUM-676). Si el lector no sabe leerlas, se dice: no se monta a ciegas.
// ② Las caras de la fuente se ESPERAN antes de medir. `font-display: swap` pinta primero con la de
//   reserva y cambia cuando llega la web: sin esperar, el banco mide a veces una y a veces otra.
//   Y `document.fonts.check()` NO sirve de sonda: J3 midió que da `true` sin ninguna cara Inter.
//   Lo que se cuenta es el estado de cada `FontFace`: `loaded` o `error`.
import fs from 'node:fs';
import path from 'node:path';
import { hojasDeLaPagina, cegueraDeLasHojas } from '../tests/_scripts-de-la-pagina.mjs';

/** Las hojas LOCALES de `public/dashboard/index.html`, en su orden, como rutas absolutas del sitio. */
export function hojasDelPanel(publico) {
  const indice = path.join(publico, 'dashboard', 'index.html');
  const r = hojasDeLaPagina(fs.readFileSync(indice, 'utf8'));
  const ceguera = cegueraDeLasHojas(r, 1, 'public/dashboard/index.html');
  if (ceguera) throw new Error(ceguera);
  // `./css/styles.css` es relativa al índice: se resuelve contra `/dashboard/`, como el navegador.
  // Sin `new URL` (SCRUM-195/414): se resuelve como ruta, quitando la query y el fragmento.
  return r.locales.map((h) => path.posix.resolve('/dashboard', h.split(/[?#]/)[0]));
}

/** Los `<link>` listos para pegar en el `<head>` de una página del banco. */
export function enlacesDelPanel(publico) {
  return hojasDelPanel(publico).map((h) => `<link rel="stylesheet" href="${h}">`).join('');
}

/** El tipo con el que se sirve una letra. J3 midió que Chromium la carga también como octet-stream; se pone igual. */
export const TIPOS_DE_FUENTE = { '.woff2': 'font/woff2' };

/**
 * Se evalúa EN LA PÁGINA (sin acentos graves ni `${`: va también dentro de plantillas). Pide cada
 * cara declarada por su familia, grosor y estilo —`document.fonts.load` sólo baja las que cubren el
 * texto por defecto, el espacio: el subconjunto latino—, espera a que no quede ninguna en vuelo y
 * devuelve el RECUENTO, que es lo que hace comprobable «esta página mide con Inter».
 */
export const ESPERAR_FUENTES = `(async function () {
  var caras = Array.from(document.fonts);
  var vistas = {};
  caras.forEach(function (f) { vistas[f.style + ' ' + f.weight + ' 16px "' + f.family.replace(/["']/g, '') + '"'] = 1; });
  await Promise.all(Object.keys(vistas).map(function (k) { return document.fonts.load(k).catch(function () { return []; }); }));
  await document.fonts.ready;
  var cargadas = caras.filter(function (f) { return f.status === 'loaded'; });
  // Una hoja que no llegó no declara caras: sin esto, «/fonts/inter.css» en 404 daría 0 declaradas
  // y el veredicto sería «nada que esperar», que es justo medir con la de reserva sin decirlo.
  // MEDIDO (sonda de 1603b, caso B): con la hoja cortada en la red, Chromium deja «sheet» puesto, y
  // mirar «!l.sheet» daba cero hojas sin cargar. Lo que la delata: abortada, leer sus reglas LANZA
  // (SecurityError, aun siendo del mismo origen); con 404, tiene 0 reglas. Las hojas del banco son
  // todas LOCALES, así que «lanza» aquí no es «es de otro origen»: es «no llegó».
  var hojasSinCargar = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .filter(function (l) {
      if (!l.sheet) return true;
      try { return l.sheet.cssRules.length === 0; } catch (e) { return true; }
    })
    .map(function (l) { return l.getAttribute('href'); });
  return {
    hojasSinCargar: hojasSinCargar,
    declaradas: caras.length,
    cargadas: cargadas.length,
    fallidas: caras.filter(function (f) { return f.status === 'error'; }).length,
    familias: Array.from(new Set(cargadas.map(function (f) { return f.family.replace(/["']/g, ''); })))
  };
})()`;

/**
 * El veredicto sobre ese recuento: `null` si la página mide con lo que declara, o el motivo por el
 * que NO se sabe con qué mide. Una página sin caras declaradas no tiene nada que esperar (`null`).
 */
export function cegueraDeLaFuente(f, donde = 'esta página') {
  if (!f || typeof f.declaradas !== 'number' || !Array.isArray(f.hojasSinCargar)) return `🔴 NO SUPE MIRAR la fuente de ${donde}: el recuento no llegó.`;
  if (f.hojasSinCargar.length) return `🔴 HOJA SIN CARGAR en ${donde}: ${f.hojasSinCargar.join(', ')}; lo que declara no está en la página.`;
  if (f.fallidas > 0) return `🔴 FUENTE ROTA en ${donde}: ${f.fallidas} de ${f.declaradas} caras declaradas no se pudieron bajar.`;
  if (f.declaradas > 0 && f.cargadas === 0) return `🔴 FUENTE SIN CARGAR en ${donde}: ${f.declaradas} caras declaradas y 0 cargadas; mediría con la de reserva.`;
  return null;
}

/** Espera las caras en una página de puppeteer ya navegada y devuelve el recuento. */
export async function esperarFuentes(page) {
  return page.evaluate(ESPERAR_FUENTES);
}

/** Una línea para la salida de un instrumento: la población de la fuente, no sólo su resultado. */
export function decirFuente(f) {
  if (!f || typeof f.declaradas !== 'number') return 'fuente: ¿?';
  return `fuente: ${f.familias.join(', ') || '(ninguna web)'} · caras cargadas ${f.cargadas} de ${f.declaradas} declaradas · fallidas ${f.fallidas}`;
}
