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
// 10 de los 20 ficheros de guard tocan ALGUNA ruta del dashboard. Pero casi todos lo hacen
// cargando su `styles.css` dentro de una página SINTÉTICA — eso ejercita el CSS, no la vista.
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

/**
 * La cobertura, con su población declarada.
 *
 * ⚠️ QUÉ CUENTA COMO CUBIERTA, dicho para que el número se pueda discutir: que **algún guard
 * nombre el fichero de la vista**. Es deliberadamente generoso — nombrarla no es ejercitarla—, y
 * se elige así a propósito: un criterio generoso que aun así deja 20 fuera es un resultado más
 * difícil de discutir que uno estricto. Si mañana se afina, el número sólo puede EMPEORAR.
 */
export function cobertura(raiz) {
  const vistas = vistasDelDashboard(raiz);
  const guards = ficherosDeGuards(raiz);
  const codigo = guards.map((f) => fs.readFileSync(path.join(raiz, f), 'utf8')).join('\n');
  const indice = path.join(raiz, 'public', 'dashboard', 'index.html');
  const html = fs.existsSync(indice) ? fs.readFileSync(indice, 'utf8') : '';

  const filas = vistas.map((v) => ({
    vista: v,
    lineas: fs.readFileSync(path.join(raiz, 'public', 'dashboard', 'js', v), 'utf8').split('\n').length,
    enIndice: html.includes(v),
    cubierta: codigo.includes(v),
  }));

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
