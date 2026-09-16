// tests/_acceso-lectura-escritura.mjs — SCRUM-849
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ¿HAY ALGÚN HANDLER DE ESCRITURA QUE COMPRUEBE MENOS QUE SU HERMANO DE LECTURA?
//
// SCRUM-467 cerró la lectura de los albaranes; nadie miró la otra mitad. El censo de SCRUM-849
// encontró **nueve** escrituras que no comprobaban la pertenencia que su GET sí comprobaba: se
// podía firmar un albarán que no se podía ni abrir.
//
// Una lista de rutas a mano no sirve para vigilar esto: caduca el día que alguien añade la
// décima, y no da error — da acceso. Esto se DERIVA del árbol, entero, cada vez.
//
// ── POR QUÉ AST Y NO TEXTO (SCRUM-203) ────────────────────────────────────────────────────────
//
// Un guard de texto se caza a sí mismo en el comentario que explica la prohibición, y aquí ese
// comentario existe en tres ficheros. El AST no ve comentarios: el problema no se mitiga, deja de
// existir. `typescript` es dependencia de desarrollo y `npm test` corre `tsc` antes que nada.
//
// ── LAS CUATRO COSAS QUE ESTE INSTRUMENTO TUVO MAL ANTES DE ESTAR BIEN ─────────────────────────
//
// Se dejan escritas porque dos de ellas **ocultaban casos reales**, que es el modo de fallo que
// importa en un guard de acceso:
//
//   ① Emparejar por path sin mirar `requireRole` ni las creaciones → 14 casos, inflado.
//   ② Eximir un handler porque el nombre `teamMemberId` APARECÍA en su cuerpo → ocultó DOS casos
//      reales, donde el identificador venía del AuditLog y del gate por campo. **Un nombre que
//      aparece no es una comprobación.**
//   ③ Contar el gate POR CAMPO (`if (!seesAllJobs(...)) ... 403`) como pertenencia. No lo es:
//      compara el ROL con campos del body, no el RECURSO con quien llama.
//   ④ Exigir la identidad en el test del `if` → perdió el `GET` de albaranes, donde la
//      comparación vive en una variable intermedia (`const suyo = ...`).
//
// ── LA DEFINICIÓN, dicha una vez ──────────────────────────────────────────────────────────────
//
// Un handler **comprueba pertenencia** si existe un `if` que CORTA con 401/403/404 y cuyo test
// depende —directa o transitivamente— de una comparación con `req.teamMemberId`, la identidad de
// quien llama. La dependencia se sigue por variables locales **y por funciones auxiliares del
// mismo fichero**: el arreglo correcto de SCRUM-849 fue poner la comprobación en UN punto
// (`findAlbaran`) por el que pasan once handlers, y un guard que no siguiera esa indirección
// exigiría copiarla once veces — justo lo contrario de lo que hay que hacer.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export const LECTURA = new Set(['get']);
export const ESCRITURA = new Set(['post', 'patch', 'put', 'delete']);

/** La identidad de QUIEN LLAMA. Es lo que separa «este recurso es tuyo» de cualquier otro `if`. */
export const IDENTIDAD = 'teamMemberId';

/** Los códigos con los que una comprobación de acceso CORTA. Un 409 o un 400 no es denegar. */
const DENEGACION = /^(401|403|404)$/;

function ficherosTs(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosTs(p, acc);
    else if (e.name.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

function menciona(nodo, nombres) {
  let si = false;
  (function r(x) {
    if (si) return;
    if (ts.isIdentifier(x) && nombres.has(x.getText())) { si = true; return; }
    ts.forEachChild(x, r);
  })(nodo);
  return si;
}

/**
 * ¿El bloque CORTA con una denegación?
 *
 * Tres formas, y la tercera hizo falta al medir: `res.status(404)` literal, un `{ status: 404 }`
 * devuelto por un auxiliar, y `res.status(found.status)` — el código REENVIADO por quien ya
 * decidió. Sin la tercera, el guard no veía ninguno de los once handlers que delegan en
 * `findAlbaran` y habría exigido copiar la comprobación once veces.
 *
 * La tercera NO afloja el control negativo: sólo se consulta sobre un `if` cuyo test ya depende
 * de la identidad o de un auxiliar de acceso, así que un `res.status(x)` de validación no entra.
 */
function corta(nodo) {
  let si = false;
  (function r(x) {
    if (si) return;
    if (ts.isCallExpression(x) && ts.isPropertyAccessExpression(x.expression)
      && x.expression.name.getText() === 'status'
      && x.arguments[0] && DENEGACION.test(x.arguments[0].getText())) { si = true; return; }
    if (ts.isPropertyAssignment(x) && x.name.getText() === 'status'
      && DENEGACION.test(x.initializer.getText())) { si = true; return; }
    // El codigo REENVIADO: `res.status(found.status)`. No es un literal, y es la forma que usan
    // los once handlers que delegan la comprobacion en un auxiliar.
    if (ts.isCallExpression(x) && ts.isPropertyAccessExpression(x.expression)
      && x.expression.name.getText() === 'status'
      && x.arguments[0] && !ts.isNumericLiteral(x.arguments[0])) { si = true; return; }
    ts.forEachChild(x, r);
  })(nodo);
  return si;
}

/**
 * ¿Este cuerpo deniega por pertenencia?
 *
 * `extras` son nombres ya conocidos por llevar la identidad dentro (funciones auxiliares que ya
 * se demostró que comprueban). Así la indirección se sigue sin volver a analizarlas.
 */
export function deniegaPorPertenencia(cuerpo, extras = new Set()) {
  const contaminados = new Set([IDENTIDAD, ...extras]);
  for (let i = 0; i < 5; i++) {
    const antes = contaminados.size;
    (function r(x) {
      if (ts.isVariableDeclaration(x) && x.initializer && x.name && ts.isIdentifier(x.name)
        && menciona(x.initializer, contaminados)) contaminados.add(x.name.getText());
      ts.forEachChild(x, r);
    })(cuerpo);
    if (contaminados.size === antes) break;
  }
  let si = false;
  (function r(x) {
    if (si) return;
    if (ts.isIfStatement(x)) {
      // El corte puede estar en el test del `if` o dentro de un bloque que ya depende de la
      // identidad (`if (rol) { const suyo = …; if (!suyo) 404 }`).
      if ((menciona(x.expression, contaminados) || menciona(x.thenStatement, contaminados))
        && corta(x.thenStatement)) { si = true; return; }
    }
    ts.forEachChild(x, r);
  })(cuerpo);
  return si;
}

/** Recurso = prefijo del path hasta el primer parámetro inclusive. `/:id/emitir` → `/:id`. */
export function recursoDe(p) {
  const segs = p.split('/').filter(Boolean);
  const out = [];
  for (const s of segs) { out.push(s); if (s.startsWith(':')) break; }
  return '/' + out.join('/');
}

/** Censa todos los handlers de `src/`, resolviendo la indirección a auxiliares del fichero. */
export function censarHandlers(raiz) {
  const handlers = [];
  for (const f of ficherosTs(path.join(raiz, 'src'))) {
    const rel = path.relative(raiz, f).replace(/\\/g, '/');
    const sf = ts.createSourceFile(rel, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);

    // ── PASO 1 · los AUXILIARES del fichero que ya comprueban pertenencia ────────────────────
    // Punto fijo: un auxiliar puede llamar a otro.
    const auxiliares = new Set();
    for (let pasada = 0; pasada < 3; pasada++) {
      const antes = auxiliares.size;
      (function r(n) {
        let nombre = null; let cuerpo = null;
        if (ts.isFunctionDeclaration(n) && n.name && n.body) { nombre = n.name.getText(); cuerpo = n.body; }
        else if (ts.isVariableDeclaration(n) && n.name && ts.isIdentifier(n.name) && n.initializer
          && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) {
          nombre = n.name.getText(); cuerpo = n.initializer.body;
        }
        if (nombre && cuerpo && deniegaPorPertenencia(cuerpo, auxiliares)) auxiliares.add(nombre);
        ts.forEachChild(n, r);
      })(sf);
      if (auxiliares.size === antes) break;
    }

    // ── PASO 2 · los handlers ────────────────────────────────────────────────────────────────
    (function r(n) {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
        const met = n.expression.name.getText().toLowerCase();
        if ((LECTURA.has(met) || ESCRITURA.has(met)) && /router|app/i.test(n.expression.expression.getText())) {
          const a0 = n.arguments[0];
          if (a0 && ts.isStringLiteral(a0)) {
            const cuerpo = n.arguments[n.arguments.length - 1];
            let requireRole = false;
            for (let i = 1; i < n.arguments.length - 1; i++) {
              if (n.arguments[i].getText().includes('requireRole')) requireRole = true;
            }
            const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
            handlers.push({
              fichero: rel,
              metodo: met.toUpperCase(),
              path: a0.text,
              linea: line + 1,
              recurso: recursoDe(a0.text),
              comprueba: cuerpo ? deniegaPorPertenencia(cuerpo, auxiliares) : false,
              requireRole,
              tieneParam: a0.text.includes(':'),
            });
          }
        }
      }
      ts.forEachChild(n, r);
    })(sf);
  }
  return handlers;
}

/**
 * Las escrituras que comprueban MENOS que la lectura de su mismo recurso.
 *
 * Dos exenciones, cada una por un falso positivo medido:
 *   · `requireRole('admin')` — el rol ya está cerrado; el filtro row-level no añade nada.
 *   · `POST` a la COLECCIÓN (sin `:param`) — crea algo que aún no existe: no hay propiedad que
 *     comprobar, y emparejarlo con el `GET` del listado es un emparejamiento falso.
 */
export function escriturasQueAflojan(handlers) {
  const porRecurso = new Map();
  for (const h of handlers) {
    const k = h.fichero + ' ' + h.recurso;
    if (!porRecurso.has(k)) porRecurso.set(k, []);
    porRecurso.get(k).push(h);
  }
  const fallos = [];
  const exentos = [];
  for (const [, hs] of porRecurso) {
    const lecturas = hs.filter((h) => LECTURA.has(h.metodo.toLowerCase()));
    const escrituras = hs.filter((h) => ESCRITURA.has(h.metodo.toLowerCase()));
    if (!lecturas.some((l) => l.comprueba) || !escrituras.length) continue;
    const testigo = lecturas.find((l) => l.comprueba);
    for (const e of escrituras) {
      if (e.comprueba) continue;
      if (e.requireRole) exentos.push({ ...e, motivo: "requireRole('admin')" });
      else if (!e.tieneParam) exentos.push({ ...e, motivo: 'crea en la COLECCIÓN' });
      else fallos.push({ ...e, testigo: `${testigo.metodo} ${testigo.path} (${testigo.fichero}:${testigo.linea})` });
    }
  }
  return { fallos, exentos };
}
