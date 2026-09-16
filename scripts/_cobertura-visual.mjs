// scripts/_cobertura-visual.mjs — SCRUM-628
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LOS GUARDS VISUALES PASAN EN VERDE Y NADIE SABE SOBRE QUÉ PÁGINAS.
//
// El ticket lo dice así: *«los guards visuales miran la landing y dos páginas sintéticas: el
// dashboard entero no tiene ninguno, y el verde no lo dice»*. Lo segundo es lo que arregla este
// módulo — es la norma A3 de la casa aplicada a los guards de navegador:
//
//   >>> Un CERO no significa «está limpio»: significa «no he mirado». <<<
//
// Un `guard:*` que termina sin hallazgos no dice si eso es porque la pantalla está bien o porque
// esa pantalla no la mira nadie. Las dos salidas son idénticas, y una de las dos es ceguera.
//
// ── ⚠️ Y EL ENUNCIADO DEL TICKET HAY QUE MATIZARLO, MEDIDO (16-sep-2026) ───────────────────
//
// «El dashboard entero no tiene ninguno» **no es exacto**, y conviene saberlo antes de construir:
// el 16-sep-2026, 10 de los 20 ficheros de guard tocaban ALGUNA ruta del dashboard. Pero casi
// todos lo hacen cargando su `styles.css` dentro de una página SINTÉTICA — eso ejercita el CSS, no
// la vista. (La cifra va con fecha porque es una foto del árbol: el recuento vivo lo da
// `cobertura()`, y es el que manda.)
//
// Por eso aquí la unidad no es «¿toca una ruta del dashboard?» sino **¿hay algún guard que nombre
// esta VISTA?**, que es la pregunta que se corresponde con lo que un profesional abre.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';

/** Las vistas del dashboard: un `*View.js` es una pantalla que el profesional abre. */
export function vistasDelDashboard(raiz) {
  const dir = path.join(raiz, 'public', 'dashboard', 'js');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /View\.js$/.test(f)).sort();
}

/** Los ficheros de los `guard:*` declarados en `package.json`. Un guard sin comando no corre. */
export function ficherosDeGuards(raiz) {
  const pkg = JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8'));
  const fuera = new Set();
  for (const [k, v] of Object.entries(pkg.scripts || {})) {
    if (!/^guard:/.test(k)) continue;
    for (const f of String(v).match(/scripts\/[\w-]+\.mjs/g) || []) {
      if (fs.existsSync(path.join(raiz, f))) fuera.add(f);
    }
  }
  return [...fuera].sort();
}

/** Los `render*` que DECLARA una vista. Es lo que un test le pide a `pintarVista`. */
export function rendersDe(codigoDeLaVista) {
  return [...new Set((codigoDeLaVista.match(/function\s+(render[A-Za-z0-9_]+)/g) || [])
    .map((m) => m.replace(/function\s+/, '')))];
}

/**
 * Los `render*` que EJERCITA algún test de la tanda: la llamada `pintarVista(x, 'renderXView')`.
 *
 * 🔴 SE EXIGE LA LLAMADA LITERAL, y la alternativa se probó y se descartó MIDIENDO. El criterio
 * ancho —cualquier literal `renderX` dentro de un fichero que importe `pintarVista`— parecía más
 * justo con los tests que recorren una tabla, pero medido da **28 renders frente a 14**, y de los
 * 14 de diferencia **sólo 5 se montaban de verdad**: los otros 9 se nombraban y nada más.
 *
 *   >>> Con el criterio ancho las «sin cubrir» pasaban de 11 a 2, y ese 2 no era cobertura: era
 *   >>> el censo contando menciones. Es el defecto de SCRUM-511 en mi propio instrumento. <<<
 *
 * Así que el precio de la precisión lo paga el TEST, no el censo: un test que quiera que su vista
 * cuente, la monta con el nombre escrito en la llamada. Es más verboso y es comprobable.
 *
 * ⚠️ Y LA PROXIMIDAD SE MIDE EN CARACTERES, NO EN «EL ARGUMENTO DE AL LADO». La versión anterior
 * exigía `pintarVista(<sin comas>, 'renderX')`, y eso **sólo reconoce la llamada más simple**:
 * `pintarVista(cargarDashboard(RAIZ, { datos }), 'renderPlansView')` lleva comas y paréntesis
 * dentro del primer argumento, así que no casaba. Medido: las dos únicas vistas que necesitan
 * datos propios quedaban fuera del censo **estando cubiertas**.
 *
 *   >>> Es la tercera vez en este módulo que el detector sólo ve la forma que su autor tenía en
 *   >>> la cabeza. Por eso ahora el criterio es la CERCANÍA al nombre de la llamada, que no
 *   >>> depende de cómo se escriban los argumentos. <<<
 */
export function rendersEjercitados(raiz) {
  const dir = path.join(raiz, 'tests');
  if (!fs.existsSync(dir)) return new Set();
  const fuera = new Set();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.mjs')) continue;
    const cod = fs.readFileSync(path.join(dir, f), 'utf8');
    // El primer literal `render*` que aparece a menos de 160 caracteres de una llamada a
    // `pintarVista`. La ventana está acotada a propósito: sin ella volvería a ser «nombrarla».
    for (const m of cod.matchAll(/pintarVista[\s\S]{0,160}?['"`](render[A-Za-z0-9_]+)['"`]/g)) fuera.add(m[1]);
  }
  return fuera;
}

/**
 * La cobertura, con su población declarada.
 *
 * ⚠️ QUÉ CUENTA COMO CUBIERTA, dicho para que el número se pueda discutir. Dos vías:
 *
 *   ① un `guard:*` NOMBRA el fichero de la vista — generoso a propósito: nombrarla no es
 *     ejercitarla, pero un criterio generoso que aun así deja muchas fuera es más difícil de
 *     discutir que uno estricto;
 *   ② un test de la tanda la EJERCITA con `pintarVista(banco, 'renderXView')` — que es más
 *     exigente que ①: ahí la vista se monta de verdad.
 *
 * 🔴 LA VÍA ② FALTABA, y el defecto era visible en el propio resultado de SCRUM-628: aquella
 * entrega cubrió `jobDetailView.js` con un test de la tanda y **el censo la seguía contando como
 * sin cubrir**, porque sólo miraba `scripts/guard-*.mjs`. Un censo que no ve la cobertura que se
 * acaba de añadir mide otra cosa — y su trinquete se habría quedado clavado en 20 para siempre,
 * pareciendo estable.
 */
export function cobertura(raiz) {
  const vistas = vistasDelDashboard(raiz);
  const guards = ficherosDeGuards(raiz);
  const codigo = guards.map((f) => fs.readFileSync(path.join(raiz, f), 'utf8')).join('\n');
  const indice = path.join(raiz, 'public', 'dashboard', 'index.html');
  const html = fs.existsSync(indice) ? fs.readFileSync(indice, 'utf8') : '';
  const ejercitados = rendersEjercitados(raiz);

  const filas = vistas.map((v) => {
    const cod = fs.readFileSync(path.join(raiz, 'public', 'dashboard', 'js', v), 'utf8');
    const porGuard = codigo.includes(v);
    // El render se deriva de la PROPIA vista, no se adivina por el nombre del fichero.
    const porTest = rendersDe(cod).some((r) => ejercitados.has(r));
    return {
      vista: v,
      lineas: cod.split('\n').length,
      enIndice: html.includes(v),
      porGuard,
      porTest,
      cubierta: porGuard || porTest,
    };
  });

  return {
    guards: guards.length,
    vistas: vistas.length,
    cubiertas: filas.filter((f) => f.cubierta),
    sinCubrir: filas.filter((f) => !f.cubierta),
    filas,
  };
}

/**
 * La línea que el verde TIENE que imprimir. Es el entregable del ticket: que la salida declare
 * sobre cuántas pantallas se ha mirado, no sólo que no haya hallazgos.
 */
export function lineaDePoblacion(c) {
  return `población: ${c.guards} guards visuales · ${c.vistas} vistas del dashboard · `
    + `${c.cubiertas.length} nombradas por algún guard · ${c.sinCubrir.length} SIN CUBRIR`;
}

/**
 * La vista sin cubrir que más pesa, por LÍNEAS DE CÓDIGO.
 *
 * El criterio va escrito porque el ticket prohíbe elegir por intuición: se ordena por tamaño del
 * fichero y se exige que esté enlazada en el índice —una vista que el índice no carga no la abre
 * nadie—. No es «la más importante»: es la más grande de las que hoy no mira ningún guard, que es
 * una pregunta que se puede volver a hacer dentro de seis meses y da el mismo tipo de respuesta.
 */
export function laQueMasPesaSinCubrir(c) {
  return c.sinCubrir.filter((f) => f.enIndice).sort((a, b) => b.lineas - a.lineas)[0] || null;
}
