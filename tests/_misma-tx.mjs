// tests/_misma-tx.mjs — SCRUM-207 · ¿los 7 caminos crean la factura en la MISMA transacción
// que reservó su número?
//
// POR QUÉ ESTO ES UN GUARD Y NO UNA NOTA. La consulta de inspección Q1b localiza la fila
// `factura_emitida` por `created_at` EXACTO contra el `createdAt` de la factura, y eso solo
// funciona porque en PostgreSQL `now()` es `transaction_timestamp()`: constante dentro de
// una transacción. Si un camino reservara el número en una transacción y creara la factura
// en otra, los dos sellos serían distintos y **Q1b devolvería vacío para ese camino**, sin
// error, sin aviso y precisamente en la consulta que se usa en una inspección. Degradación
// silenciosa en el peor sitio posible.
//
// Y hay una segunda razón, más grave: si el receptor no es una transacción de verdad, el
// `factura_emitida` transaccional NO PROTEGE NADA — un fallo del registro ya no deshace la
// emisión. Comprobado con `tsc`: `Prisma.TransactionClient` es `Omit<PrismaClient, …>`, así
// que **el cliente global es estructuralmente asignable** y `allocateInvoiceNumber(prisma, …)`
// COMPILA. El tipo no lo impide; esto sí.
//
// AST, no grep (regla 38): se lee el árbol sin tocar ni una línea del camino de emisión, y
// los comentarios no existen para el analizador — la trampa de autorreferencia que mordió
// cuatro veces (SCRUM-176/168/3/193) no puede darse.
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

export const EMBUDO = 'allocateInvoiceNumber';

/** Nombre textual de una expresión, si es un identificador o un acceso a propiedad. */
function nombreDe(nodo) {
  if (!nodo) return null;
  if (ts.isIdentifier(nodo)) return nodo.text;
  if (ts.isPropertyAccessExpression(nodo)) {
    const izq = nombreDe(nodo.expression);
    return izq ? `${izq}.${nodo.name.text}` : null;
  }
  return null;
}

/** La función (o arrow) que envuelve a `nodo`. */
function funcionQueEnvuelve(nodo) {
  let p = nodo.parent;
  while (p) {
    if (ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isArrowFunction(p) ||
        ts.isMethodDeclaration(p)) return p;
    p = p.parent;
  }
  return null;
}

/**
 * ¿Esta función es el callback de un `$transaction(...)`?
 * Devuelve el nombre del parámetro (el cliente transaccional) o null.
 */
function paramDeTransaction(fn) {
  if (!fn) return null;
  const call = fn.parent;
  if (!call || !ts.isCallExpression(call)) return null;
  const callee = nombreDe(call.expression) ?? '';
  if (!callee.endsWith('$transaction')) return null;
  const p = fn.parameters?.[0];
  return p && ts.isIdentifier(p.name) ? p.name.text : null;
}

/** Todas las llamadas `<algo>.invoice.create(...)` dentro de `fn`, con su receptor. */
function creacionesEn(fn, sf) {
  const out = [];
  const visitar = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) &&
        n.expression.name.text === 'create' &&
        ts.isPropertyAccessExpression(n.expression.expression) &&
        n.expression.expression.name.text === 'invoice') {
      out.push({
        receptor: nombreDe(n.expression.expression.expression),
        linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
      });
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(fn, visitar);
  return out;
}

/**
 * Analiza un fichero: por cada llamada al embudo, decide si la factura se crea con el MISMO
 * receptor y si ese receptor es un cliente transaccional declarado.
 */
export function analizarFuente(codigo, ruta = 'anonimo.ts') {
  const sf = ts.createSourceFile(ruta, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const hallazgos = [];

  const visitar = (n) => {
    if (ts.isCallExpression(n) && nombreDe(n.expression) === EMBUDO) {
      const receptor = nombreDe(n.arguments[0]);
      const linea = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
      const fn = funcionQueEnvuelve(n);
      const paramTx = paramDeTransaction(fn);

      // El receptor puede venir de un `$transaction(async (tx) => …)` (lo normal) o ser un
      // PARÁMETRO de la función que envuelve — el caso de `emitInvoice(tx, …)`, que delega la
      // transacción en quien la llama. Ambos valen; lo que no vale es el cliente global.
      //
      // ⚠️ EL PARÁMETRO NO BASTA CON QUE EXISTA: TIENE QUE ESTAR TIPADO COMO TRANSACCIÓN.
      // La primera versión de esto aceptaba cualquier parámetro, y por tanto daba por buena
      // `function emitir(prisma) { allocateInvoiceNumber(prisma, …) }` — el cliente global
      // pasado a mano, que es justo la fuga que este guard existe para cazar. Lo destapó su
      // propia autoprueba al salir en rojo, no una revisión.
      const esParamDeLaFuncion = !!fn?.parameters?.some(
        (p) =>
          ts.isIdentifier(p.name) && p.name.text === receptor &&
          /TransactionClient/.test(p.type?.getText?.() ?? ''),
      );

      const creaciones = creacionesEn(fn ?? sf, sf);
      const mismaTx = creaciones.some((c) => c.receptor === receptor);

      hallazgos.push({
        ruta, linea, receptor,
        origenDelReceptor: paramTx === receptor ? '$transaction' : esParamDeLaFuncion ? 'parametro' : 'DESCONOCIDO',
        creacionesEnLaMismaFuncion: creaciones,
        mismaTx,
        // Un receptor cuyo origen no se puede declarar es fail-closed: no se puede afirmar
        // que sea una transacción, así que se trata como fuga.
        ok: mismaTx && (paramTx === receptor || esParamDeLaFuncion),
      });
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(sf, visitar);
  return hallazgos;
}

/**
 * DELEGACIÓN · el eslabón que faltaba.
 *
 * Cuando el receptor del embudo es un PARÁMETRO (el caso de `emitInvoice(tx, …)`), la función
 * no abre transacción: la recibe. Su ✅ es prestado — vale lo que valgan sus llamadores. Esto
 * los busca y comprueba que le pasan el parámetro de un `$transaction`, no el cliente global.
 * Sin esto, C7 estaría dando por buena una garantía que no ha comprobado nadie.
 *
 * @param delegadas [{ fnNombre, indiceParam }] funciones que delegan la transacción
 */
export function analizarDelegacion(raiz, delegadas) {
  const porNombre = new Map(delegadas.map((d) => [d.fnNombre, d]));
  const out = [];
  const andar = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { andar(p); continue; }
      if (!e.name.endsWith('.ts') || e.name.endsWith('.d.ts')) continue;
      const codigo = fs.readFileSync(p, 'utf8');
      if (![...porNombre.keys()].some((n) => codigo.includes(n))) continue;
      const ruta = p.replace(/\\/g, '/');
      const sf = ts.createSourceFile(ruta, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const visitar = (n) => {
        if (ts.isCallExpression(n)) {
          const nombre = nombreDe(n.expression);
          const d = nombre && porNombre.get(nombre);
          if (d) {
            const arg = n.arguments[d.indiceParam];
            const receptor = nombreDe(arg);
            const fn = funcionQueEnvuelve(n);
            const paramTx = paramDeTransaction(fn);
            const esParam = !!fn?.parameters?.some(
              (pp) => ts.isIdentifier(pp.name) && pp.name.text === receptor &&
                /TransactionClient/.test(pp.type?.getText?.() ?? ''),
            );
            // La DECLARACIÓN de la función delegada no cuenta como llamada.
            const esLaPropiaDeclaracion = ruta.endsWith('invoicing.service.ts') && nombre === d.fnNombre &&
              ts.isFunctionDeclaration(fn ?? {});
            if (!esLaPropiaDeclaracion) {
              out.push({
                ruta, fnNombre: nombre, receptor,
                linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
                origenDelReceptor: paramTx === receptor ? '$transaction' : esParam ? 'parametro' : 'DESCONOCIDO',
                ok: paramTx === receptor || esParam,
              });
            }
          }
        }
        ts.forEachChild(n, visitar);
      };
      ts.forEachChild(sf, visitar);
    }
  };
  andar(raiz);
  return out;
}

/** Recorre `raiz` (normalmente `src/`) y analiza todos los .ts. */
export function analizarArbol(raiz) {
  const out = [];
  const andar = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { andar(p); continue; }
      if (!e.name.endsWith('.ts') || e.name.endsWith('.d.ts')) continue;
      const codigo = fs.readFileSync(p, 'utf8');
      if (!codigo.includes(EMBUDO)) continue;
      out.push(...analizarFuente(codigo, p.replace(/\\/g, '/')));
    }
  };
  andar(raiz);
  return out;
}
