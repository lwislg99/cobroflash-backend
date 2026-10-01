// tests/_censo-emisores-con-fila.mjs — SCRUM-508
//
// QUÉ EMISORES DEL ÁRBOL DEJAN FILA EN `email_messages`, DERIVADO POR AST.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ POR AST Y NO POR `grep`
//
// La pregunta no es «¿aparece la palabra `registro` en este fichero?» sino «¿esta llamada al emisor
// lleva su contexto?». Un `grep` no distingue una llamada de un comentario que la explica —y este
// carril está lleno de comentarios que nombran lo que vigilan—, ni sabe si el `registro:` que
// encuentra pertenece a ESA llamada o a otra veinte líneas más abajo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 Y POR QUÉ EL CENSO EXIGE EL MISMO CAMINO, NO UN CAMINO PARECIDO
//
// Si un emisor escribiera su fila por su cuenta —un `prisma.emailMessage.create` propio— la tabla
// se llenaría igual y el ticket parecería hecho. Pero sería una SEGUNDA FORMA: el día que cambie
// qué se escribe (una columna nueva, el enmascarado del `error`, el plazo) habría que acordarse de
// todos, y el que se olvide no dará error. Es el defecto que SCRUM-475 cerró con el emisor único,
// un nivel más abajo.
//
// Así que el censo mira DOS cosas y las dos por separado:
//   · quién pasa `registro` a una llamada del emisor  → los que dejan fila;
//   · quién escribe en la tabla POR SU CUENTA         → tiene que ser UNO, el repositorio.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export const RAIZ = path.resolve(import.meta.dirname, '..');

/** Los dos nombres del emisor único. Quien manda un correo pasa por uno de estos dos. */
export const NOMBRES_DEL_EMISOR = ['enviarCorreo', 'enviarPorResend'];

/** El único sitio que puede escribir en la tabla. */
export const REPOSITORIO = 'src/modules/messaging/domain/registroDeEnvios.ts';

function ficherosTs(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosTs(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}
const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');

/**
 * CENSO A · las llamadas al emisor único, y si LLEVAN su contexto.
 *
 * Sobre un TEXTO y no sobre el disco: separado a propósito para poder AUTOPROBARLO. «Todos llevan
 * contexto» y «mi detector no reconoce el contexto» salen por la misma línea y significan lo
 * contrario.
 */
export function censarLlamadasDeTexto(texto, nombreFichero = 'sintetico.ts') {
  const sf = ts.createSourceFile(path.basename(nombreFichero), texto, ts.ScriptTarget.Latest, true);
  const salida = [];
  (function walk(n) {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)
        && NOMBRES_DEL_EMISOR.includes(n.expression.text)) {
      // El contexto viaja en el PRIMER argumento, que es el objeto del correo. Se busca la
      // propiedad `registro` EN ESE objeto —no en el fichero— y se admite tanto la forma literal
      // (`registro: {…}`) como la abreviada (`registro`) y el `...spread` de un objeto que la traiga.
      const arg = n.arguments[0];
      let conRegistro = false;
      let porSpread = false;
      if (arg && ts.isObjectLiteralExpression(arg)) {
        for (const p of arg.properties) {
          if ((ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p))
              && p.name && p.name.getText(sf) === 'registro') {
            // 🔴 EL VALOR, NO LA PRESENCIA. La primera versión de esto contaba que la propiedad
            // EXISTIERA, y se probó con la mutación `registro: null` — que es exactamente cómo un
            // emisor dejaría de dejar fila— y **el censo siguió diciendo 6**. Atado a la forma en vez
            // de al hecho, en el propio censo. Lo destapó el rojo, no una relectura.
            //
            // Un `null` o un `undefined` explícitos NO llevan contexto: `registrarEnvio` los trata
            // como `sin_contexto` y no escribe nada. Lo que sí lo lleva es un objeto literal o una
            // referencia (`params.registro`, `ctx`), y en ese caso lo garantiza el TIPO.
            const valor = ts.isShorthandPropertyAssignment(p) ? p.name : p.initializer;
            const nulo = valor.kind === ts.SyntaxKind.NullKeyword
              || (ts.isIdentifier(valor) && valor.text === 'undefined');
            if (!nulo) conRegistro = true;
          }
          if (ts.isSpreadAssignment(p)) porSpread = true;
        }
      } else if (arg) {
        // `enviarCorreo(correo)` — el objeto viene de una variable: no se puede afirmar por AST.
        porSpread = true;
      }
      salida.push({
        fichero: nombreFichero,
        linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
        emisor: n.expression.text,
        conRegistro,
        indirecto: porSpread && !conRegistro,
      });
    }
    ts.forEachChild(n, walk);
  })(sf);
  return salida;
}

/** CENSO A sobre `src/`, saltándose el propio emisor (su delegación interna no es un emisor más). */
export function censarLlamadas() {
  const salida = [];
  for (const fichero of ficherosTs(path.join(RAIZ, 'src'))) {
    const r = rel(fichero);
    if (r === 'src/integrations/enviarCorreo.ts') continue;
    salida.push(...censarLlamadasDeTexto(fs.readFileSync(fichero, 'utf8'), r));
  }
  return salida;
}

/**
 * CENSO B · quién escribe en la tabla. **Tiene que ser UNO.**
 *
 * Se mira la LLAMADA (`algo.emailMessage.create(...)`), no el texto: el nombre de la tabla aparece
 * en los comentarios de medio carril.
 */
export function censarEscritores() {
  const ESCRITURAS = ['create', 'createMany', 'upsert', 'update', 'updateMany', 'delete', 'deleteMany'];
  const salida = [];
  for (const fichero of ficherosTs(path.join(RAIZ, 'src'))) {
    const texto = fs.readFileSync(fichero, 'utf8');
    const sf = ts.createSourceFile(path.basename(fichero), texto, ts.ScriptTarget.Latest, true);
    (function walk(n) {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
          && ESCRITURAS.includes(n.expression.name.text)) {
        const receptor = n.expression.expression;
        if (ts.isPropertyAccessExpression(receptor) && receptor.name.text === 'emailMessage') {
          salida.push({
            fichero: rel(fichero),
            linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
            operacion: n.expression.name.text,
          });
        }
      }
      ts.forEachChild(n, walk);
    })(sf);
  }
  return salida;
}

/** Los ficheros con al menos una llamada que lleva contexto: los emisores que DEJAN fila. */
export function emisoresConFila(llamadas = censarLlamadas()) {
  return [...new Set(llamadas.filter((l) => l.conRegistro).map((l) => l.fichero))].sort();
}

/** Los ficheros donde alguna llamada NO lleva contexto: los que NO dejan fila. */
export function emisoresSinFila(llamadas = censarLlamadas()) {
  const conFila = new Set(emisoresConFila(llamadas));
  return [...new Set(llamadas.filter((l) => !l.conRegistro && !conFila.has(l.fichero)).map((l) => l.fichero))].sort();
}

/**
 * CENSO C · SCRUM-1299 · los `sendMail` DIRECTOS, y si su envío deja fila en los DOS desenlaces.
 *
 * El censo A mira las llamadas a `enviarCorreo`/`enviarPorResend`. Los respaldos SMTP de
 * `email.service` mandan con `transporter.sendMail` a pelo y le eran INVISIBLES: el guard de 508
 * estuvo verde con el hueco dentro, porque no los contaba ni a favor ni en contra.
 *
 * Por cada `<algo>.sendMail(...)` se mira, en la función que lo contiene:
 *   · `fallo`: está dentro de un `try` cuyo `catch` llama a `registrarEnvio`;
 *   · `exito`: hay una llamada a `registrarEnvio` DESPUÉS del `sendMail` y fuera de todo `catch`.
 * ⚠️ LÍMITE declarado: no sigue ramas. Un `return` entre el `sendMail` y el `registrarEnvio` (el
 * outbox `.eml`, fuera de alcance en 1299) no lo ve: mide que el camino del éxito ESCRIBE, no que
 * TODAS sus ramas lo hagan. Eso lo mide el comportamiento, en `scrum1299-respaldo-smtp-deja-fila`.
 */
export function censarSendMailDeTexto(texto, nombreFichero = 'sintetico.ts') {
  const sf = ts.createSourceFile(path.basename(nombreFichero), texto, ts.ScriptTarget.Latest, true);
  const esFuncion = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n)
    || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);
  const esRegistro = (n) => ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'registrarEnvio';
  const dentroDeCatch = (n, tope) => { for (let p = n.parent; p && p !== tope; p = p.parent) if (ts.isCatchClause(p)) return true; return false; };
  const salida = [];
  (function walk(n) {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'sendMail') {
      let fn = n.parent;
      while (fn && !esFuncion(fn)) fn = fn.parent;
      const registros = [];
      if (fn) (function r(m) { if (esRegistro(m)) registros.push(m); ts.forEachChild(m, r); })(fn);
      let fallo = false;
      for (let p = n.parent; p && p !== fn; p = p.parent) {
        if (ts.isTryStatement(p) && p.catchClause && n.pos >= p.tryBlock.pos && n.end <= p.tryBlock.end) {
          if (registros.some((x) => x.pos >= p.catchClause.pos && x.end <= p.catchClause.end)) fallo = true;
        }
      }
      const exito = registros.some((x) => x.pos >= n.end && !dentroDeCatch(x, fn));
      salida.push({
        fichero: nombreFichero,
        linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
        fallo, exito,
      });
    }
    ts.forEachChild(n, walk);
  })(sf);
  return salida;
}

/** CENSO C sobre `src/`: TODOS los `sendMail`, también el del propio emisor único. */
export function censarSendMailDirectos() {
  const salida = [];
  for (const fichero of ficherosTs(path.join(RAIZ, 'src'))) {
    salida.push(...censarSendMailDeTexto(fs.readFileSync(fichero, 'utf8'), rel(fichero)));
  }
  return salida;
}
