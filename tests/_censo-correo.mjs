// tests/_censo-correo.mjs — SCRUM-475
//
// DOS CENSOS DERIVADOS SOBRE `src/`, las dos mitades de «¿qué pasó con este correo?»:
//
//   A · LOS EMISORES — quién manda un correo, y si mira lo que el proveedor le contesta.
//   B · LOS LLAMADORES — qué pasa cuando el envío falla DE FORMA VISIBLE: ¿sube o se traga?
//
// La B es la que puede destapar lo peor. «No sabemos si llegó» es una laguna del proveedor;
// «falló y no se lo dijimos a nadie» es una decisión nuestra, y ocurre en el único caso en el que
// SÍ lo sabíamos.
//
// ⚠️ AST, NUNCA `grep`: este fichero está lleno de las palabras que vigila.
// ⚠️ Y el receptor de la llamada no se filtra por nombre (`axios`, `http`, el que sea): lo que
// define un emisor es a DÓNDE llama, no cómo se llame la variable.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export const RAIZ = path.resolve(import.meta.dirname, '..');
export const HOST_PROVEEDOR = 'api.resend.com';

function ficherosTs(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosTs(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}
const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');

function nombreEnvolvente(n, sf) {
  let p = n.parent;
  while (p) {
    if (ts.isFunctionDeclaration(p) && p.name) return p.name.text;
    if (ts.isMethodDeclaration(p) && p.name) return p.name.getText(sf);
    if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && p.parent
        && ts.isVariableDeclaration(p.parent) && p.parent.name) return p.parent.name.getText(sf);
    p = p.parent;
  }
  return '<módulo>';
}

/**
 * ¿Se APROVECHA lo que devuelve esta llamada? Sí si su valor se asigna, se devuelve o se lee.
 * `await x(...)` a secas —sentencia suelta— es tirar la respuesta.
 */
function seAprovechaElValor(llamada) {
  let n = llamada;
  // El `await` envuelve a la llamada: se mira lo que hay por encima del await.
  if (n.parent && ts.isAwaitExpression(n.parent)) n = n.parent;
  const p = n.parent;
  if (!p) return false;
  if (ts.isExpressionStatement(p)) return false;           // ← la respuesta se descarta
  return ts.isVariableDeclaration(p) || ts.isReturnStatement(p) || ts.isBinaryExpression(p)
    || ts.isPropertyAccessExpression(p) || ts.isCallExpression(p) || ts.isArrowFunction(p)
    || ts.isPropertyAssignment(p) || ts.isTemplateSpan(p);
}

/** CENSO A · toda llamada cuyo primer argumento es una URL del proveedor. */
export function censarEmisores() {
  const salida = [];
  for (const fichero of ficherosTs(path.join(RAIZ, 'src'))) {
    const sf = ts.createSourceFile(path.basename(fichero), fs.readFileSync(fichero, 'utf8'), ts.ScriptTarget.Latest, true);
    (function walk(n) {
      if (ts.isCallExpression(n) && n.arguments.length
          && ts.isStringLiteralLike(n.arguments[0]) && n.arguments[0].text.includes(HOST_PROVEEDOR)) {
        salida.push({
          fichero: rel(fichero),
          linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
          fn: nombreEnvolvente(n, sf),
          guardaRespuesta: seAprovechaElValor(n),
        });
      }
      ts.forEachChild(n, walk);
    })(sf);
  }
  return salida;
}

/**
 * CENSO A-bis (SCRUM-475, sesión 2) · LOS NOMBRES DE LOS EMISORES, DERIVADOS DEL ÁRBOL.
 *
 * 🔴 POR QUÉ EXISTE ESTA FUNCIÓN: la sesión 1 pasaba al censo B una lista escrita A MANO
 * (`['sendInvoiceEmail', 'sendQuoteEmail', 'sendMagicLink', 'sendMail', 'sendMerchantPaymentEmail']`).
 * Funcionaba el día que se escribió. Cuando SCRUM-406 entró en `main` con `enviarCorreo()` y su
 * llamador en `soporteAdmin.routes.ts`, el censo B **no los vio** — no porque el análisis fallara,
 * sino porque el nombre no estaba en la lista. El censo A, que SÍ deriva del árbol, cazó el mismo
 * fichero sin ayuda.
 *
 * Es la misma lección de la casa una vez más: **lo enumerado a mano se queda viejo en silencio**,
 * y su silencio se lee igual que un verde. Así que la lista se deriva.
 *
 * Una función es EMISORA si alcanza una llamada al proveedor: o la hace ella, o llama a otra del
 * mismo fichero que la hace (se propaga hasta punto fijo). Se devuelven las EXPORTADAS, que son
 * las que un router puede llamar.
 */
export function nombresDeEmisor() {
  const nombres = new Set();
  for (const fichero of ficherosTs(path.join(RAIZ, 'src'))) {
    const texto = fs.readFileSync(fichero, 'utf8');
    // Atajo barato: si el fichero no nombra al proveedor ni manda por SMTP, no hay nada que sacar.
    if (!texto.includes(HOST_PROVEEDOR) && !texto.includes('sendMail')) continue;
    const sf = ts.createSourceFile(path.basename(fichero), texto, ts.ScriptTarget.Latest, true);

    const fns = new Map(); // nombre → { exportada, emisora, llama:Set<string> }
    const declaraciones = [];
    (function walk(n) {
      let nombre = null;
      let exportada = false;
      if (ts.isFunctionDeclaration(n) && n.name) {
        nombre = n.name.text;
        exportada = !!(ts.getCombinedModifierFlags(n) & ts.ModifierFlags.Export);
      } else if ((ts.isArrowFunction(n) || ts.isFunctionExpression(n))
                 && n.parent && ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name)) {
        nombre = n.parent.name.text;
        exportada = !!(ts.getCombinedModifierFlags(n.parent) & ts.ModifierFlags.Export);
      }
      if (nombre && n.body) declaraciones.push({ nombre, exportada, nodo: n });
      ts.forEachChild(n, walk);
    })(sf);

    for (const { nombre, exportada, nodo } of declaraciones) {
      let emisora = false;
      const llama = new Set();
      (function walk(n) {
        if (ts.isCallExpression(n)) {
          // ¿Llama al proveedor por HTTP? (por el DESTINO, no por el nombre del cliente)
          if (n.arguments.length && ts.isStringLiteralLike(n.arguments[0])
              && n.arguments[0].text.includes(HOST_PROVEEDOR)) emisora = true;
          // ¿O manda por SMTP?
          if (ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'sendMail') emisora = true;
          if (ts.isIdentifier(n.expression)) llama.add(n.expression.text);
        }
        ts.forEachChild(n, walk);
      })(nodo.body);
      fns.set(nombre, { exportada, emisora, llama });
    }

    // Propagación hasta punto fijo: quien llama a una emisora del mismo fichero, emite.
    for (let cambio = true; cambio; ) {
      cambio = false;
      for (const f of fns.values()) {
        if (f.emisora) continue;
        for (const destino of f.llama) {
          if (fns.get(destino)?.emisora) { f.emisora = true; cambio = true; break; }
        }
      }
    }
    for (const [nombre, f] of fns) if (f.emisora && f.exportada) nombres.add(nombre);
  }
  return [...nombres].sort();
}

/**
 * CENSO B · quién llama a un emisor, y qué hace si revienta.
 *
 * Cuatro veredictos, y la diferencia entre los dos primeros me la enseñó equivocarme:
 *   · `sube`        — el error propaga: alguien arriba se entera.
 *   · `avisa`       — hay `catch` y **contesta al usuario que NO salió** (`sendFailureBody`,
 *                     `ok:false`, un status de error). Es trabajo hecho (SCRUM-126) y no es un
 *                     tragón: el profesional ve que falló y puede reintentar.
 *   · `traga-log`   — hay `catch` y SOLO escribe en consola: nadie se entera.
 *   · `traga-mudo`  — hay `catch` y ni siquiera loguea.
 *
 * 🔴 LA PRIMERA VERSIÓN DE ESTE CENSO CLASIFICABA POR LA FORMA DEL `catch` —¿relanza?, ¿loguea?—
 * y metía en el mismo cubo a quien avisa al usuario y a quien no. Es el defecto que este repo
 * lleva nueve variantes cazando: el guard atado a la FORMA en vez de al HECHO. El hecho es
 * «¿se entera alguien?», y eso se mide mirando si el `catch` produce una RESPUESTA.
 */
export function censarLlamadores(nombresDeEmisor) {
  const salida = [];
  for (const fichero of ficherosTs(path.join(RAIZ, 'src'))) {
    const sf = ts.createSourceFile(path.basename(fichero), fs.readFileSync(fichero, 'utf8'), ts.ScriptTarget.Latest, true);
    (function walk(n) {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && nombresDeEmisor.includes(n.expression.text)) {
        // 🔴 PRIMERO el `.catch(...)` PEGADO A LA LLAMADA, y va primero porque manda: si lo hay,
        // el `try` de la ruta NUNCA ve este error. Buscar solo `try` me hizo clasificar
        // `sendMerchantPaymentEmail(...).catch(() => {})` —mudo del todo— como «avisa», porque
        // subí hasta el `catch` de la ruta, que contesta al PSP y no al profesional.
        let cuerpoManejador = null;
        if (n.parent && ts.isPropertyAccessExpression(n.parent) && n.parent.name.text === 'catch'
            && n.parent.parent && ts.isCallExpression(n.parent.parent)) {
          const arg = n.parent.parent.arguments[0];
          cuerpoManejador = arg ? arg.getText(sf) : '';
        }
        // Si no, ¿hay un try/catch por encima que capture ESTA llamada?
        if (cuerpoManejador === null) {
          let p = n.parent;
          while (p) {
            if (ts.isTryStatement(p) && p.catchClause && p.tryBlock.getStart(sf) <= n.getStart(sf)
                && n.getEnd() <= p.tryBlock.getEnd()) { cuerpoManejador = p.catchClause.block.getText(sf); break; }
            p = p.parent;
          }
        }
        let veredicto = 'sube';
        if (cuerpoManejador !== null) {
          const cuerpo = cuerpoManejador.replace(/\/\/.*$/gm, '');
          const relanza = /\bthrow\b/.test(cuerpo);
          // ¿El `catch` CONTESTA que no salió? Ése es el hecho, no si loguea.
          const avisa = /sendFailureBody|res\.status\(|res\.json\(/.test(cuerpo);
          veredicto = relanza ? 'sube'
            : avisa ? 'avisa'
            : /console\.(error|warn|log)/.test(cuerpo) ? 'traga-log' : 'traga-mudo';
        }
        salida.push({
          fichero: rel(fichero),
          linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
          emisor: n.expression.text,
          veredicto,
        });
      }
      ts.forEachChild(n, walk);
    })(sf);
  }
  return salida;
}
