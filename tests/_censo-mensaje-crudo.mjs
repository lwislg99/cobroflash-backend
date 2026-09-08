// tests/_censo-mensaje-crudo.mjs — SCRUM-644 · quién pinta el mensaje del servidor sin traducir.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA PUERTA QUE ESTABA ABIERTA
//
// SCRUM-641 arregló `productsView.js` y SCRUM-644 `providersView.js`. Pero **nada vigilaba que
// una vista NUEVA volviera a pintar `e.message`**, y ésa es la familia de defecto de la casa:
// se arregla una copia y no se cierra la puerta. Pasó con el dinero (seis copias), con el
// contador de scripts (cuatro conflictos) y con el vocabulario de códigos (dos capas).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// SE DERIVA DEL AST, NO DE UN `grep`
//
// Un censo por texto se caza a sí mismo en el comentario que explica la prohibición, y no
// distingue `e.message` pintado en un aviso de `d.message` leído para decidir. Aquí se recorre el
// árbol y se reconoce UNA forma: **una llamada a un PINTOR cuyo argumento lee un `.message`**.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LAS DOS LISTAS SE ESCRIBEN A MANO Y NO SE HEREDAN DE NADIE (criterio de SCRUM-645)
//
// Si este censo dedujera los pintores del código —«toda función que reciba un texto»— o los
// traductores —«todo lo que se llame mensajeDe…»—, un caso nuevo entraría solo: se daría por
// bueno sin que nadie lo hubiera decidido, o se quedaría fuera del censo sin que nadie se
// enterara. Escritas a mano, cualquiera de las dos cosas exige tocar ESTE fichero, que es
// exactamente el momento en que alguien decide. **La duplicación es el precio.**
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** Las funciones que ESCRIBEN EN LA PANTALLA. A mano. */
export const PINTORES = Object.freeze([
  'setAlert',   // productsView, providersView, customersView…
  'setStatus',  // invoiceDetailView, jobDetailView…
  'showToast',
  'alert',
]);

/** Lo que convierte un código del servidor en algo legible. A mano. */
export const TRADUCTORES = Object.freeze([
  'mensajeDeErrorCatalogo',   // SCRUM-641 · productsView
  'mensajeDeErrorProveedor',  // SCRUM-644 · providersView
]);

/** Las propiedades que traen texto del servidor y no se pueden pintar crudas. */
const CAMPOS_DEL_SERVIDOR = Object.freeze(['message']);

const DIR = 'public/dashboard/js';

/** ¿Este nodo es `algo.message`? */
function leeCampoDelServidor(n) {
  return ts.isPropertyAccessExpression(n)
    && ts.isIdentifier(n.name)
    && CAMPOS_DEL_SERVIDOR.includes(n.name.text);
}

/** El nombre de la función que se llama, o `null` si no es una llamada reconocible. */
function nombreDeLlamada(n, sf) {
  if (!ts.isCallExpression(n)) return null;
  const e = n.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.name)) return e.name.text;
  return e.getText(sf);
}

/**
 * Los sitios de UN fuente que pintan un `.message` sin traducirlo. Puro: recibe el texto.
 *
 * @returns {{linea:number, pintor:string, fragmento:string}[]}
 */
export function crudosDe(nombre, fuente) {
  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.ES2020, true, ts.ScriptKind.JS);
  const out = [];

  /** ¿Hay un `.message` suelto aquí dentro, fuera de cualquier traductor? */
  const hayCrudo = (nodo) => {
    let encontrado = false;
    const mirar = (n) => {
      if (encontrado) return;
      // Si entramos en un traductor, lo de dentro YA está tratado: no se sigue bajando.
      if (TRADUCTORES.includes(nombreDeLlamada(n, sf))) return;
      if (leeCampoDelServidor(n)) { encontrado = true; return; }
      ts.forEachChild(n, mirar);
    };
    // 🔴 Se empieza por el NODO, no por sus hijos. Empezando por los hijos, un argumento que ES la
    // llamada al traductor nunca pasaba por la poda —se bajaba directo a su interior— y el
    // `.message` de dentro contaba como crudo. Lo cazó el suelo: «cebo traducido → 1».
    mirar(nodo);
    return encontrado;
  };

  const visitar = (n) => {
    const pintor = nombreDeLlamada(n, sf);
    if (pintor && PINTORES.includes(pintor)) {
      for (const arg of n.arguments || []) {
        if (hayCrudo(arg)) {
          const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
          out.push({
            linea: line + 1,
            pintor,
            fragmento: n.getText(sf).slice(0, 110).replace(/\s+/g, ' '),
          });
          break;
        }
      }
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(sf, visitar);
  return out;
}

/** El censo del dashboard entero. `raiz` para poder correrlo sobre otro árbol. */
export function censo(raiz) {
  const dir = path.join(raiz, DIR);
  const ficheros = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.js')) : [];
  const hallazgos = [];
  for (const f of ficheros) {
    for (const h of crudosDe(f, fs.readFileSync(path.join(dir, f), 'utf8'))) {
      hallazgos.push({ fichero: `${DIR}/${f}`, ...h });
    }
  }
  return { ficherosMirados: ficheros.length, hallazgos };
}
