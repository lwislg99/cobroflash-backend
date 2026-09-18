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
 * ── 🔴 POR QUÉ RESUELVE UN SALTO, Y QUÉ COSTABA NO HACERLO ─────────────────────────────────
 * La primera versión leía **solo el literal**: `renderAppView('templates')`. No daba falsos
 * positivos, así que parecía correcta. Lo que hacía era peor de ver y peor de vivir:
 *
 *   **obligaba a escribir el código de otra manera.**
 *
 * Medido, y con dos víctimas independientes: al construir la pestaña de Presupuestos (SCRUM-432)
 * la forma natural era `renderAppView(p.vista)` desde el bucle de las pestañas, y **dos sesiones
 * que no se hablaban** —cada una por su lado— tuvieron que renunciar a ella y escribir los
 * destinos a mano para no chocar con este censo. Su propio comentario lo dice: *«más corto, y
 * parecía más limpio… el censo de SCRUM-433 lee justo eso»*.
 *
 * Un guard que cobra ese peaje no es neutral: moldea el código a su conveniencia, y el día que
 * alguien navegue desde un bucle sin saberlo se lleva un rojo sin motivo. Se resuelve **un salto**,
 * igual que en SCRUM-245.
 *
 * ── LO QUE NO SE PUEDE RESOLVER SE DICE ────────────────────────────────────────────────────
 * Un salto es un salto: hay expresiones que no se pueden seguir sin ejecutar el programa. Ésas
 * **no se acusan y no se callan**: se devuelven aparte, contadas, y quien llame tiene que
 * enseñarlas. Callarlas sería lo de siempre — el silencio leyéndose como «todo resuelto».
 *
 * ⚠️ Estar en `HASH_VIEWS` NO cuenta como camino. Es alcanzable escribiendo la URL, y eso no es
 * una forma en que un profesional encuentre una pantalla.
 *
 * @returns {{abiertas: Map<string,string[]>, noResueltas: {fichero:string,linea:number,texto:string}[], leidos:number}}
 */
export function vistasQueAlguienAbre(raiz) {
  const dir = path.join(raiz, DIR_JS);
  const abiertas = new Map();
  const noResueltas = [];
  const ficheros = fs.readdirSync(dir).filter((x) => x.endsWith('.js'));

  for (const f of ficheros) {
    const codigo = fs.readFileSync(path.join(dir, f), 'utf8');
    const sf = ts.createSourceFile(f, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

    // ── El salto: los literales que este fichero asigna, por nombre de variable y de propiedad ──
    // Se recoge TODO el fichero y no solo el ámbito exacto. Es a propósito, y es la misma decisión
    // que en SCRUM-245: seguir el ámbito de verdad exige un analizador que no tenemos, y errar
    // hacia «resuelvo de más» aquí solo puede producir un FALSO NEGATIVO en una vista que además
    // tendría que llamarse igual que otra. Errar al revés produce el peaje que este cambio quita.
    const porVariable = new Map();
    const porPropiedad = new Map();
    const recoger = (n) => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)
          && n.initializer && ts.isStringLiteral(n.initializer)) {
        if (!porVariable.has(n.name.text)) porVariable.set(n.name.text, new Set());
        porVariable.get(n.name.text).add(n.initializer.text);
      }
      if (ts.isPropertyAssignment(n) && n.initializer && ts.isStringLiteral(n.initializer)) {
        const clave = ts.isIdentifier(n.name) || ts.isStringLiteral(n.name) ? n.name.text : null;
        if (clave) {
          if (!porPropiedad.has(clave)) porPropiedad.set(clave, new Set());
          porPropiedad.get(clave).add(n.initializer.text);
        }
      }
      ts.forEachChild(n, recoger);
    };
    recoger(sf);

    const anotar = (vista) => {
      if (!abiertas.has(vista)) abiertas.set(vista, []);
      if (!abiertas.get(vista).includes(f)) abiertas.get(vista).push(f);
    };

    const visitar = (n) => {
      if (ts.isCallExpression(n)) {
        const callee = n.expression.getText(sf);
        if (callee === 'renderAppView' || callee.endsWith('.renderAppView')) {
          const a0 = n.arguments[0];
          const linea = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
          if (a0 && ts.isStringLiteral(a0)) {
            anotar(a0.text);                                   // el caso directo
          } else if (a0 && ts.isIdentifier(a0) && porVariable.has(a0.text)) {
            for (const v of porVariable.get(a0.text)) anotar(v);  // un salto: `const v = 'x'`
          } else if (a0 && ts.isPropertyAccessExpression(a0)
                     && porPropiedad.has(a0.name.text)) {
            for (const v of porPropiedad.get(a0.name.text)) anotar(v); // un salto: `{ vista: 'x' }`
          } else {
            noResueltas.push({ fichero: f, linea, texto: n.getText(sf).slice(0, 90) });
          }
        }
      }
      ts.forEachChild(n, visitar);
    };
    visitar(sf);
  }
  return { abiertas, noResueltas, leidos: ficheros.length };
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
  return diagnostico(raiz).huerfanas;
}

/**
 * El veredicto COMPLETO: las huérfanas **y** lo que no se supo resolver.
 *
 * Van juntas a propósito. Una lista de huérfanas sin decir cuántas llamadas quedaron sin resolver
 * se lee como «esto es todo», y no lo es: una vista podría estar viva por una llamada que el censo
 * no supo seguir. **El silencio es la ambigüedad que este censo existe para quitar**, así que se
 * devuelve al lado y quien llame está obligado a enseñarlo.
 */
export function diagnostico(raiz) {
  const { abiertas, noResueltas, leidos } = vistasQueAlguienAbre(raiz);
  return {
    huerfanas: sinCamino({
      vistas: vistasDelDispatch(raiz).vistas,
      barra: entradasDeLaBarra(raiz),
      abre: abiertas,
    }),
    noResueltas,
    leidos,
  };
}
