// tests/_decisor-turno.mjs — SCRUM-266 (resto) · ¿queda algún sitio que decida la vigencia del
// turno de staging POR SU CUENTA, en vez de preguntárselo a `decidirVigencia()`?
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE FICHERO Y NO LLEGÓ CON EL RESTO DE SCRUM-266
//
// SCRUM-266 arregló los dos sitios que MIRÓ —`turno-staging.mjs` y `adquirirLock`— y dejó un
// guard que los protegía **nombrando el fichero**:
//
//     assert.doesNotMatch(fuenteDeTurnoStaging, /estaRancio\s*\(/)
//
// Ese guard es correcto y es insuficiente por la misma razón: **enumera en vez de derivar**.
// Protege el sitio que ya se había arreglado y no puede saber nada de los que no se miraron.
// Y quedaba uno: `tests/_staging-db.mjs` juzgaba el turno ajeno con la primitiva y el TTL por
// defecto, o sea el defecto entero de SCRUM-266 vivo en la barrera gateada.
//
// La lección no es «se me olvidó un fichero». Es que **una lista de sitios protegidos se
// satisface dejando de enumerar**: el siguiente consumidor del turno nace fuera del guard y
// nadie se entera. La población tiene que salir de la ESTRUCTURA — quien importa del decisor
// es un consumidor, lo sepa el guard o no.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA REGLA, Y POR QUÉ NO ES «PROHIBIDO IMPORTAR `estaRancio`»
//
// `estaRancio` no está mal: es la primitiva sobre la que `decidirVigencia` se apoya cuando no
// hay compromiso publicado, y `scrum188` la prueba directamente como lo que es, una función
// con su aritmética. Prohibir el import tumbaría ese test unitario legítimo y obligaría a una
// excepción — y una excepción con buena razón es como empiezan todas las listas.
//
// Lo que está mal es **DECIDIR** con ella fuera del decisor, porque `estaRancio` necesita un
// TTL que el consumidor no puede conocer: es el TTL con el que OTRA máquina tomó el turno.
// Así que la regla se traza donde está la diferencia real:
//
//     · el resultado se OBSERVA (llega a un `assert`, a un log, a un objeto) → legítimo
//     · el resultado DECIDE (llega al control de flujo)                      → prohibido
//
// Esa diferencia es estructural y se ve en el AST, así que no hace falta preguntar de qué
// fichero se trata ni cómo se llama. `scrum188` pasa porque observa; `_staging-db.mjs:152`
// caía porque decidía. Ninguno de los dos está en una lista.
//
// AST y no `grep`: este fichero nombra `estaRancio` doce veces explicando por qué no se usa,
// y un guard de texto se caza a sí mismo en la prosa que justifica la prohibición (ha mordido
// cinco veces en este repo). El analizador solo ve llamadas, nunca comentarios.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** El único sitio donde `estaRancio` puede decidir: es el cuerpo de `decidirVigencia`. */
export const DECISOR = 'scripts/_staging-lock.mjs';

/** La primitiva que no puede decidir fuera del decisor. */
export const PRIMITIVA = 'estaRancio';

/** La función a la que hay que preguntar en su lugar. */
export const JUEZ = 'decidirVigencia';

const DIRECTORIOS = ['scripts', 'tests'];

function ficherosMjs(raiz) {
  const salida = [];
  for (const dir of DIRECTORIOS) {
    const abs = path.join(raiz, dir);
    if (!fs.existsSync(abs)) continue;
    for (const nombre of fs.readdirSync(abs)) {
      if (nombre.endsWith('.mjs')) salida.push(`${dir}/${nombre}`);
    }
  }
  return salida.sort();
}

function parsear(rutaRel, codigo) {
  return ts.createSourceFile(rutaRel, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function recorrer(nodo, visita) {
  visita(nodo);
  nodo.forEachChild((h) => recorrer(h, visita));
}

function importaDelDecisor(sf) {
  let sí = false;
  recorrer(sf, (n) => {
    if (!ts.isImportDeclaration(n)) return;
    const spec = n.moduleSpecifier;
    if (ts.isStringLiteral(spec) && /(^|\/)_staging-lock\.mjs$/.test(spec.text)) sí = true;
  });
  return sí;
}

/**
 * POBLACIÓN DERIVADA, no enumerada: todo `.mjs` de `scripts/` o `tests/` que importa del
 * decisor es un consumidor del turno, menos el decisor mismo. Un consumidor nuevo entra en
 * el guard por existir, sin que nadie tenga que acordarse de añadirlo.
 */
export function consumidoresDelTurno(raiz) {
  return ficherosMjs(raiz).filter((rel) => {
    if (rel === DECISOR) return false;
    const codigo = fs.readFileSync(path.join(raiz, rel), 'utf8');
    if (!codigo.includes('_staging-lock.mjs')) return false; // atajo barato; el AST manda debajo
    return importaDelDecisor(parsear(rel, codigo));
  });
}

// ── ¿el valor llega al control de flujo? ─────────────────────────────────────────────────
// Se sube por los padres mientras el nodo siga siendo "el mismo valor": paréntesis, `!`, `&&`
// y `||` no cambian de quién se está decidiendo. En cuanto aparece cualquier otra cosa
// (un argumento de llamada, una propiedad de objeto, una plantilla) el valor se está usando
// para OTRA cosa y deja de ser una decisión.

function esCondicionDe(padre, hijo) {
  if (ts.isIfStatement(padre) || ts.isWhileStatement(padre) || ts.isDoStatement(padre)) {
    return padre.expression === hijo;
  }
  if (ts.isConditionalExpression(padre)) return padre.condition === hijo;
  return false;
}

function esTransparente(n) {
  if (ts.isParenthesizedExpression(n)) return true;
  if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.ExclamationToken) return true;
  if (ts.isBinaryExpression(n)) {
    return n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
        || n.operatorToken.kind === ts.SyntaxKind.BarBarToken;
  }
  return false;
}

function llegaAControlDeFlujo(nodo) {
  let actual = nodo;
  let padre = actual.parent;
  while (padre) {
    if (esCondicionDe(padre, actual)) return true;
    if (!esTransparente(padre)) return false;
    actual = padre;
    padre = actual.parent;
  }
  return false;
}

function nombreLlamado(expr) {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  return null;
}

/**
 * Devuelve las DECISIONES tomadas con la primitiva en un fichero. Dos formas:
 *
 *   · `directa`  — la llamada está en la condición: `if (… && !estaRancio(x, t))`
 *   · `variable` — la llamada se guarda y la variable decide después:
 *                  `const rancio = estaRancio(x, t); if (rancio) …`
 *
 * La segunda existe porque sin ella la regla se esquiva con una línea de más, que es la peor
 * clase de regla: la que castiga escribirlo claro.
 */
export function decisionesConLaPrimitiva(rutaRel, codigo) {
  const sf = parsear(rutaRel, codigo);
  const hallazgos = [];
  const variablesConLaPrimitiva = new Map(); // nombre -> línea de la declaración

  recorrer(sf, (n) => {
    if (!ts.isCallExpression(n) || nombreLlamado(n.expression) !== PRIMITIVA) return;
    const linea = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

    if (llegaAControlDeFlujo(n)) {
      hallazgos.push({ fichero: rutaRel, linea, forma: 'directa' });
      return;
    }
    const padre = n.parent;
    if (padre && ts.isVariableDeclaration(padre) && padre.initializer === n && ts.isIdentifier(padre.name)) {
      variablesConLaPrimitiva.set(padre.name.text, linea);
    }
  });

  if (variablesConLaPrimitiva.size > 0) {
    recorrer(sf, (n) => {
      if (!ts.isIdentifier(n) || !variablesConLaPrimitiva.has(n.text)) return;
      if (n.parent && ts.isVariableDeclaration(n.parent) && n.parent.name === n) return; // la declaración
      if (!llegaAControlDeFlujo(n)) return;
      hallazgos.push({
        fichero: rutaRel,
        linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
        forma: 'variable',
      });
    });
  }

  return hallazgos;
}

/** ¿este fichero le pregunta al juez? Se usa para que "arreglarlo" no pueda ser "borrarlo". */
export function preguntaAlJuez(rutaRel, codigo) {
  const sf = parsear(rutaRel, codigo);
  let sí = false;
  recorrer(sf, (n) => {
    if (ts.isCallExpression(n) && nombreLlamado(n.expression) === JUEZ) sí = true;
  });
  return sí;
}

/** Barrido completo: población derivada + decisiones de cada uno. */
export function barrer(raiz) {
  const consumidores = consumidoresDelTurno(raiz);
  const decisiones = consumidores.flatMap((rel) =>
    decisionesConLaPrimitiva(rel, fs.readFileSync(path.join(raiz, rel), 'utf8')));
  return { consumidores, decisiones };
}
