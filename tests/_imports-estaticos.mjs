// tests/_imports-estaticos.mjs — SCRUM-381
//
// RESOLVER UN IMPORT SIN EJECUTARLO.
//
// Importar de verdad un sembrador **lo ejecuta**: abre una conexión y siembra. Y sin embargo hay
// que poder contestar «¿este script podría siquiera arrancar?», porque `seed-demo.mjs` estuvo
// tickets enteros sin poder, importando un fichero que ya no existía, y ninguna suite lo notó.
//
// ⚠️ POR QUÉ ESTO VIVE EN UN MÓDULO COMPARTIDO Y NO DENTRO DE UN TEST:
//
// El defecto que lo motiva no fue el import roto — fue el TEST que lo fijaba. `scrum314` afirmaba
// `assert.match(src, /from '\.\/_wipe-demo\.mjs'/)`: comprobaba el TEXTO del import y nunca que el
// destino existiera, así que sostuvo en verde un script que no arrancaba.
//
//   **Un guard que fija una ruta sin resolverla vigila la ortografía, no el cableado.**
//
// Arreglarlo apuntando el `match` a la ruta NUEVA habría mudado el defecto de sitio: volvería a
// fijar el siguiente import roto. La única corrección real es RESOLVER, y para que resolver sea
// tan fácil como deletrear tiene que estar a mano. De ahí este fichero.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** `import … from 'x'` y `require('x')` de un fichero, con los nombres que trae de cada uno. */
export function dependenciasDe(fuente) {
  const sf = ts.createSourceFile('x.mjs', fuente, ts.ScriptTarget.Latest, true);
  const out = [];
  const visita = (n) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      const nombres = [];
      const c = n.importClause;
      if (c?.namedBindings && ts.isNamedImports(c.namedBindings)) {
        for (const e of c.namedBindings.elements) nombres.push((e.propertyName ?? e.name).text);
      }
      out.push({
        especificador: n.moduleSpecifier.text,
        nombres,
        linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
      });
    }
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'require' &&
        n.arguments[0] && ts.isStringLiteral(n.arguments[0])) {
      out.push({
        especificador: n.arguments[0].text,
        nombres: [],
        linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
      });
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return out;
}

/** Lo que un módulo JS EXPORTA con nombre. `export *` marca el fichero como «no se puede afirmar». */
export function exportaciones(fuente) {
  const sf = ts.createSourceFile('x.mjs', fuente, ts.ScriptTarget.Latest, true);
  const out = new Set();
  let reexportaTodo = false;
  for (const s of sf.statements) {
    if (ts.isExportDeclaration(s)) {
      if (!s.exportClause) { reexportaTodo = true; continue; }
      if (ts.isNamedExports(s.exportClause)) for (const e of s.exportClause.elements) out.add(e.name.text);
    }
    const exportado = ts.getCombinedModifierFlags(s) & ts.ModifierFlags.Export;
    if (exportado) {
      if ((ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s)) && s.name) out.add(s.name.text);
      if (ts.isVariableStatement(s)) for (const d of s.declarationList.declarations) if (ts.isIdentifier(d.name)) out.add(d.name.text);
    }
  }
  // CommonJS compilado por tsc: `exports.foo = …`
  const visita = (n) => {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isPropertyAccessExpression(n.left) && ts.isIdentifier(n.left.expression) &&
        n.left.expression.text === 'exports') out.add(n.left.name.text);
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return { nombres: out, reexportaTodo };
}

/** Resuelve un especificador RELATIVO a un fichero que existe, o `null`. Paquetes → `null`: los resuelve npm. */
export function resolver(desde, especificador) {
  if (!especificador.startsWith('.')) return null;
  const base = path.resolve(path.dirname(desde), especificador);
  for (const cand of [base, base + '.mjs', base + '.js', base + '.cjs', path.join(base, 'index.js')]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
  }
  return null;
}

/**
 * ¿De qué fichero REAL saca `fuenteFichero` el símbolo `simbolo`?
 *
 * Es la pregunta que un `assert.match` contra una ruta no puede contestar. Devuelve el fichero
 * resuelto, o un objeto con el motivo exacto por el que no se pudo — cada motivo es un fallo
 * distinto y merece un mensaje distinto:
 *
 *   'no_importado'  → el script ni siquiera pide ese símbolo (¿se renombró? ¿se dejó de usar?)
 *   'no_resuelve'   → lo pide a una ruta que NO EXISTE. Es el defecto de `seed-demo.mjs`.
 *   'no_exportado'  → la ruta existe y ya no exporta eso. Revienta igual, al usarlo.
 *
 * @returns {{ok: true, destino: string, especificador: string, linea: number}
 *         | {ok: false, motivo: 'no_importado'}
 *         | {ok: false, motivo: 'no_resuelve'|'no_exportado', especificador: string, linea: number, destino?: string}}
 */
export function origenDe(fuenteFichero, simbolo) {
  const deps = dependenciasDe(fs.readFileSync(fuenteFichero, 'utf8'));
  const dep = deps.find((d) => d.nombres.includes(simbolo));
  if (!dep) return { ok: false, motivo: 'no_importado' };

  const destino = resolver(fuenteFichero, dep.especificador);
  if (!destino) return { ok: false, motivo: 'no_resuelve', especificador: dep.especificador, linea: dep.linea };

  const { nombres, reexportaTodo } = exportaciones(fs.readFileSync(destino, 'utf8'));
  if (!nombres.has(simbolo) && !reexportaTodo) {
    return { ok: false, motivo: 'no_exportado', especificador: dep.especificador, linea: dep.linea, destino };
  }
  return { ok: true, destino, especificador: dep.especificador, linea: dep.linea };
}
