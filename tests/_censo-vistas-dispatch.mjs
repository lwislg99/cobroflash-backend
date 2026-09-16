// tests/_censo-vistas-dispatch.mjs — SCRUM-433 · las vistas del dispatch y cómo se llega a cada una.
//
// ── POR QUÉ NO SE MIDE CONTRA `HASH_VIEWS` ──────────────────────────────────────────────────
// `HASH_VIEWS` **no es el router**: es la lista de vistas navegables por hash. El registro real es
// el `switch` de `renderView`, y contiene casos que no están en esa lista. Un guard contra
// `HASH_VIEWS` mediría la lista equivocada y **nacería verde con el hueco dentro** — que es la
// forma más cara de fallar, porque parece que vigila.
//
// ── POR QUÉ AST Y NO `_bloque-estructural.mjs`, QUE ES MÍO Y ACABO DE ESCRIBIR ──────────────
// Aquel módulo extrae **un** bloque a partir de un ancla. Aquí hace falta otra cosa: **enumerar
// todas las cláusulas de un `switch` y mirar dentro de cada cuerpo** para decidir si es un alias.
// Eso es recorrer un árbol, no recortar un trozo. Forzarlo habría sido volver a la misma familia
// de defecto por la puerta de atrás: el `case` 24 se sale de cualquier ventana que elija.
//
// Las dos formas de equivocarse ya están medidas en esta casa y las dos salen del mismo sitio:
// mirar de MENOS (SCRUM-435: la ventana cortaba 217 caracteres antes de lo que vigilaba) y mirar
// de MÁS (SCRUM-437: `153d:79` daba verde con un `detail-section` del vecino). El AST no tiene
// ninguna de las dos porque no tiene ventana.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const DIR_JS = 'public/dashboard/js';
const APP = 'public/dashboard/js/app.js';
const HTML = 'public/dashboard/index.html';

/**
 * Las cláusulas del `switch` de `renderView`, cada una con su veredicto de forma.
 *
 * `alias` = el `case` cuyo ÚNICO cuerpo es `return renderView('otra', …)`. Se deriva de la FORMA,
 * no de una lista: `operarios` cae solo (SCRUM-136 lo mantiene como redirección viva porque hay
 * enlaces y marcadores apuntando ahí). Declararlo a mano habría sido poner una excepción con otro
 * nombre — y además acusaría a una decisión tomada.
 *
 * @returns {{vistas: {nombre:string, alias:string|null}[], leidas:number}}
 */
export function vistasDelDispatch(raiz) {
  const src = fs.readFileSync(path.join(raiz, APP), 'utf8');
  const sf = ts.createSourceFile('app.js', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

  let sw = null;
  const buscarSwitch = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.name.text === 'renderView') {
      const dentro = (x) => { if (ts.isSwitchStatement(x) && !sw) sw = x; ts.forEachChild(x, dentro); };
      dentro(n);
    }
    ts.forEachChild(n, buscarSwitch);
  };
  buscarSwitch(sf);
  if (!sw) return { vistas: [], leidas: 0 }; // quien llame se declara ciego; aquí no se finge

  const vistas = [];
  for (const c of sw.caseBlock.clauses) {
    if (!ts.isCaseClause(c)) continue; // el `default` no es una vista
    const nombre = c.expression.getText(sf).replace(/^['"]|['"]$/g, '');
    let alias = null;
    if (c.statements.length === 1 && ts.isReturnStatement(c.statements[0])) {
      const e = c.statements[0].expression;
      if (e && ts.isCallExpression(e) && e.expression.getText(sf) === 'renderView' && e.arguments.length) {
        alias = e.arguments[0].getText(sf).replace(/^['"]|['"]$/g, '');
      }
    }
    vistas.push({ nombre, alias });
  }
  return { vistas, leidas: sw.caseBlock.clauses.length };
}

/** Las entradas de la barra lateral, escritas a mano en el HTML. */
export function entradasDeLaBarra(raiz) {
  const html = fs.readFileSync(path.join(raiz, HTML), 'utf8');
  return new Set([...html.matchAll(/data-view="([^"]+)"/g)].map((m) => m[1]));
}

/**
 * Las vistas que ALGUIEN abre desde el producto, con `renderAppView('x', …)` — la API pública de
 * navegación. Es como se llega a las pantallas de detalle, que no están ni pueden estar en la barra.
 *
 * ⚠️ Estar en `HASH_VIEWS` NO cuenta como camino. Es alcanzable escribiendo la URL, y eso no es
 * una forma en que un profesional encuentre una pantalla. Hoy no cambia nada (medido: la única que
 * dependería de ello, `export`, la abre `settingsView.js`), pero se dice para que la decisión esté
 * escrita y no se herede por accidente.
 */
export function vistasQueAlguienAbre(raiz) {
  const dir = path.join(raiz, DIR_JS);
  const abiertas = new Map();
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    const codigo = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of codigo.matchAll(/renderAppView\(\s*['"]([^'"]+)['"]/g)) {
      if (!abiertas.has(m[1])) abiertas.set(m[1], []);
      if (!abiertas.get(m[1]).includes(f)) abiertas.get(m[1]).push(f);
    }
  }
  return abiertas;
}

/**
 * EL NÚCLEO, PURO: dadas las tres fuentes, cuáles se quedan sin camino.
 *
 * Se separa de la lectura de ficheros para poder **simular** un cambio sin tocar el disco. Hace
 * falta de verdad: SCRUM-432 va a sacar `Plantillas` de la barra, y la única forma de comprobar
 * que este guard no le estorba es probar ese movimiento — con y sin la pestaña — en vez de
 * afirmarlo en un comentario.
 */
export function sinCamino({ vistas, barra, abre }) {
  return vistas
    .filter((v) => v.alias === null)
    .filter((v) => !barra.has(v.nombre) && !abre.has(v.nombre))
    .map((v) => v.nombre);
}

/** Lo mismo, sobre el árbol de verdad. */
export function vistasSinCamino(raiz) {
  return sinCamino({
    vistas: vistasDelDispatch(raiz).vistas,
    barra: entradasDeLaBarra(raiz),
    abre: vistasQueAlguienAbre(raiz),
  });
}
