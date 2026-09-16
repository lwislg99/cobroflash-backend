// tests/_censo-peticiones-panel.mjs — SCRUM-451
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// CENSO DERIVADO DE LAS PETICIONES DEL PANEL, y de las que SE SALTAN el camino común.
//
// 🔴 POR QUÉ EXISTE: el plazo de red vive en `apiRequest`. Eso no vale de nada para una petición
// que no pasa por ahí. **Medido: hay `fetch(` a pelo en el panel**, y las pantallas que los usan
// se quedan esperando para siempre por mucho plazo que tenga el camino común. Un mecanismo central
// que se puede rodear no es un mecanismo: es una costumbre con buena intención.
//
// Es el mismo defecto que cerró SCRUM-405 con las descargas, y se vigila igual: no arreglando los
// sitios uno a uno —eso lo deshace el siguiente—, sino contando los que quedan y **no dejando que
// suban**.
//
// ⚠️ AST, no `grep`: este mismo fichero, y `api.js`, están llenos de la palabra «fetch» dentro de
// comentarios que explican por qué no se usa. Un guard de texto se caza a sí mismo (SCRUM-203).
//
// ⚠️ SUELO: si el censo lee cero ficheros o encuentra cero llamadas, FALLA. «No hay peticiones» y
// «no supe mirar» son el mismo número con significados opuestos.
// ═════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const DIR = 'public/dashboard/js';

/** El camino común vive aquí: sus `fetch` son LOS que tienen que existir, no una excepción. */
export const CAMINO_COMUN = 'api.js';

function ficheros(dir) {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
}

/**
 * Censa las peticiones del panel.
 *
 * @returns {{leidos:number, apiRequest:object[], fetchCrudo:object[], porFichero:object}}
 *   `fetchCrudo` son las llamadas a `fetch(` FUERA de `api.js`: las que se saltan el plazo.
 */
export function censarPeticiones(raiz) {
  const dirAbs = path.join(raiz, DIR);
  const apiRequest = [];
  const fetchCrudo = [];
  let leidos = 0;

  for (const nombre of ficheros(dirAbs)) {
    const rel = `${DIR}/${nombre}`;
    const codigo = fs.readFileSync(path.join(dirAbs, nombre), 'utf8');
    leidos++;
    const sf = ts.createSourceFile(rel, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

    const visita = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
        const fn = n.expression.text;
        if (fn === 'apiRequest') {
          apiRequest.push({ fichero: rel, linea: linea(n), metodo: metodoDe(n, sf) });
        } else if (fn === 'fetch' && nombre !== CAMINO_COMUN) {
          fetchCrudo.push({ fichero: rel, linea: linea(n) });
        }
      }
      ts.forEachChild(n, visita);
    };
    visita(sf);
  }

  const porFichero = {};
  for (const f of fetchCrudo) porFichero[f.fichero] = (porFichero[f.fichero] || 0) + 1;
  return { leidos, apiRequest, fetchCrudo, porFichero };
}

/** GET si no dice otra cosa, que es lo que hace `fetch`. */
function metodoDe(n, sf) {
  const a1 = n.arguments[1];
  if (!a1) return 'GET';
  if (!ts.isObjectLiteralExpression(a1)) return '(dinámico)';
  for (const p of a1.properties) {
    if (ts.isPropertyAssignment(p) && p.name && p.name.getText(sf).replace(/['"]/g, '') === 'method') {
      return p.initializer.getText(sf).replace(/['"]/g, '').toUpperCase();
    }
  }
  return 'GET';
}

/** Cuántas de las de `apiRequest` son GET —las que este ticket cubre— y cuántas mutaciones. */
export function repartoPorMetodo(llamadas) {
  const r = { GET: 0, mutaciones: 0, otras: 0 };
  for (const l of llamadas) {
    if (l.metodo === 'GET') r.GET++;
    else if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(l.metodo)) r.mutaciones++;
    else r.otras++;
  }
  return r;
}
