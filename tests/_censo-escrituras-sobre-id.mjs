// SCRUM-1571b · censo por AST de las rutas que escriben sobre un `:id`, y de lo que hacen con el `count`.
//
// Pregunta: ¿qué rutas contestan «hecho» cuando el id es de OTRO comercio o no existe? El patrón del
// defecto de SCRUM-1571 es `updateMany`/`deleteMany` con `{ id, merchantId }` → `count: 0` → la ruta
// contesta éxito igual, porque nadie lee el `count`.
//
// Cómo mide (AST + checker de TypeScript sobre `src/`, no grep y no `dist/`):
//   1. POBLACIÓN: toda llamada `<x>.delete|put|patch|post('/<ruta literal>', …)` en `src/**/*.ts`.
//      De ésas, las que llevan `:` en la ruta (actúan sobre un id o un token).
//   2. Desde los manejadores de cada ruta sigue las llamadas a funciones de `src/` (el checker resuelve el
//      import) hasta 4 niveles, y recoge cada `<modelo>.updateMany(` / `.deleteMany(`.
//   3. Para cada escritura dice qué pasa con su resultado: `count leído`, `devuelto` (al llamante),
//      `en $transaction`, o `tirado` (sentencia suelta). Y si su `where` nombra `merchantId`.
//   4. SOSPECHOSA = la ruta alcanza una escritura con `merchantId` cuyo resultado se tira o se devuelve,
//      en ninguna función de la cadena se lee un `.count`, y ni el manejador ni lo que llama directamente
//      (nivel ≤ 1) contienen un `404` o un `'not_found'`.
//
// Control POSITIVO SEMBRADO (cicatriz ②): `censar({ semilla: true })` añade a la compilación un fichero que
// NO existe en el árbol, con una ruta que tiene el defecto, y la tiene que ver SOSPECHOSA. Sin la semilla,
// `semillaVista` es `false` y el censo es CIEGO, no verde: así no se jubila el día que se arregle el último
// defecto real.
//
// Uso a mano:  node tests/_censo-escrituras-sobre-id.mjs [--sin-semilla] [--json]
// Sale 0 si el positivo se ve; 2 si sale CIEGO.
import ts from 'typescript';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(RAIZ, 'src').replace(/\\/g, '/');
export const SEMILLA = `${SRC}/__semilla_scrum1571b__.ts`;
const TEXTO_SEMILLA = [
  'declare const router: any;',
  'declare const prisma: any;',
  'async function borrarAjeno(id: number, merchantId: number) {',
  '  return prisma.semilla.deleteMany({ where: { id, merchantId } });',
  '}',
  "router.delete('/semilla/:id', async (req: any, res: any) => {",
  '  await borrarAjeno(Number(req.params.id), req.merchantId);',
  '  res.status(204).end();',
  '});',
  '',
].join('\n');

const VERBOS = new Set(['delete', 'put', 'patch', 'post']);

function listar(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listar(p, out);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p.replace(/\\/g, '/'));
  }
  return out;
}

function cuerpoDe(decl) {
  const esFn = (n) => n && (ts.isArrowFunction(n) || ts.isFunctionExpression(n));
  if (!decl) return null;
  if (ts.isFunctionDeclaration(decl) || ts.isMethodDeclaration(decl) || esFn(decl)) return decl;
  if ((ts.isVariableDeclaration(decl) || ts.isPropertyAssignment(decl)) && esFn(decl.initializer)) return decl.initializer;
  return null;
}

export function censar({ semilla = true } = {}) {
  const ficheros = listar(SRC);
  if (semilla) ficheros.push(SEMILLA);
  const opciones = {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.Node10,
    esModuleInterop: true, resolveJsonModule: true, skipLibCheck: true, noEmit: true, strict: true,
  };
  const host = ts.createCompilerHost(opciones);
  const getSF = host.getSourceFile.bind(host);
  host.getSourceFile = (f, v, ...r) => (semilla && f === SEMILLA ? ts.createSourceFile(f, TEXTO_SEMILLA, v, true) : getSF(f, v, ...r));
  const existe = host.fileExists.bind(host);
  host.fileExists = (f) => (f === SEMILLA ? semilla : existe(f));
  const programa = ts.createProgram(ficheros, opciones, host);
  const checker = programa.getTypeChecker();

  const normal = (f) => f.replace(/\\/g, '/');
  const esDeSrc = (sf) => normal(sf.fileName).startsWith(SRC + '/');
  const rel = (sf) => path.relative(RAIZ, sf.fileName).replace(/\\/g, '/');
  const linea = (n) => n.getSourceFile().getLineAndCharacterOfPosition(n.getStart()).line + 1;

  const resolver = (expr) => {
    let s = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(expr) ? expr.name : expr);
    if (!s) return [];
    if (s.flags & ts.SymbolFlags.Alias) { try { s = checker.getAliasedSymbol(s); } catch { return []; } }
    return (s.declarations || []).filter((d) => esDeSrc(d.getSourceFile())).map(cuerpoDe).filter(Boolean);
  };

  // Qué pasa con el resultado de una escritura.
  const destino = (call) => {
    let n = call.parent;
    while (n && (ts.isAwaitExpression(n) || ts.isParenthesizedExpression(n) || ts.isAsExpression(n))) n = n.parent;
    if (!n || ts.isExpressionStatement(n)) return 'tirado';
    if (ts.isReturnStatement(n) || ts.isArrowFunction(n)) return 'devuelto';
    if (ts.isArrayLiteralExpression(n)) return 'en $transaction';
    if (ts.isPropertyAccessExpression(n) && n.name.text === 'count') return 'count leído';
    if (ts.isVariableDeclaration(n)) {
      if (ts.isObjectBindingPattern(n.name)) {
        return n.name.elements.some((e) => (e.propertyName || e.name).getText() === 'count') ? 'count leído' : 'tirado';
      }
      const nombre = n.name.getText();
      const fn = ts.findAncestor(n, (a) => ts.isFunctionLike(a));
      let leido = false; let devuelto = false;
      const ver = (m) => {
        if (ts.isPropertyAccessExpression(m) && m.expression.getText() === nombre && m.name.text === 'count') leido = true;
        if (ts.isReturnStatement(m) && m.expression && m.expression.getText() === nombre) devuelto = true;
        ts.forEachChild(m, ver);
      };
      if (fn) ver(fn);
      return leido ? 'count leído' : devuelto ? 'devuelto' : 'tirado';
    }
    return 'otro: ' + ts.SyntaxKind[n.kind];
  };

  const analizarRuta = (manejadores) => {
    const vistos = new Set();
    const escrituras = [];
    let leeCount = false; let contesta404 = false;
    const cola = manejadores.map((h) => ({ nodo: h, nivel: 0 }));
    while (cola.length) {
      const { nodo, nivel } = cola.shift();
      if (vistos.has(nodo)) continue;
      vistos.add(nodo);
      if (ts.isIdentifier(nodo) || ts.isPropertyAccessExpression(nodo)) {
        for (const c of resolver(nodo)) cola.push({ nodo: c, nivel });
        continue;
      }
      const visita = (m) => {
        if (ts.isPropertyAccessExpression(m) && m.name.text === 'count') leeCount = true;
        if (nivel <= 1 && ((ts.isNumericLiteral(m) && m.text === '404') || (ts.isStringLiteralLike(m) && m.text === 'not_found'))) contesta404 = true;
        if (ts.isCallExpression(m)) {
          const e = m.expression;
          if (ts.isPropertyAccessExpression(e) && (e.name.text === 'updateMany' || e.name.text === 'deleteMany')) {
            const arg = m.arguments[0];
            escrituras.push({
              sitio: `${rel(m.getSourceFile())}:${linea(m)}`,
              op: `${ts.isPropertyAccessExpression(e.expression) ? e.expression.name.text : e.expression.getText()}.${e.name.text}`,
              merchantId: !!arg && /\bmerchantId\b/.test(arg.getText()),
              destino: destino(m),
            });
          } else if (nivel < 4) {
            for (const c of resolver(e)) cola.push({ nodo: c, nivel: nivel + 1 });
          }
        }
        ts.forEachChild(m, visita);
      };
      visita(nodo);
    }
    return { escrituras, leeCount, contesta404 };
  };

  const rutas = [];
  for (const sf of programa.getSourceFiles()) {
    if (!esDeSrc(sf)) continue;
    const visita = (n) => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && VERBOS.has(n.expression.name.text)
          && n.arguments.length >= 2 && ts.isStringLiteralLike(n.arguments[0]) && n.arguments[0].text.startsWith('/')) {
        const r = n.arguments[0].text;
        const fila = { verbo: n.expression.name.text.toUpperCase(), ruta: r, sitio: `${rel(sf)}:${linea(n)}`, conId: r.includes(':') };
        if (fila.conId) Object.assign(fila, analizarRuta(n.arguments.slice(1)));
        rutas.push(fila);
      }
      ts.forEachChild(n, visita);
    };
    visita(sf);
  }

  const conId = rutas.filter((r) => r.conId);
  const conEscritura = conId.filter((r) => r.escrituras.some((w) => w.merchantId));
  const sospechosas = conEscritura.filter((r) => !r.leeCount && !r.contesta404
    && r.escrituras.some((w) => w.merchantId && (w.destino === 'tirado' || w.destino === 'devuelto')));
  const semillaVista = sospechosas.some((r) => r.sitio.includes('__semilla_scrum1571b__'));
  return { ficheros: ficheros.length - (semilla ? 1 : 0), rutas, conId, conEscritura, sospechosas, semillaVista };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const semilla = !process.argv.includes('--sin-semilla');
  const c = censar({ semilla });
  if (process.argv.includes('--json')) console.log(JSON.stringify(c, null, 1));
  else {
    console.log(`POBLACIÓN · ficheros .ts en src/: ${c.ficheros} · rutas delete/put/patch/post con ruta literal: ${c.rutas.length} · sobre un :id: ${c.conId.length}`);
    console.log(`  · que alcanzan un updateMany/deleteMany con merchantId: ${c.conEscritura.length} · SOSPECHOSAS: ${c.sospechosas.length}`);
    for (const r of c.conEscritura) {
      const marca = c.sospechosas.includes(r) ? 'SOSPECHOSA' : 'ok        ';
      console.log(`${marca} ${r.verbo} ${r.ruta} · ${r.sitio} · count=${r.leeCount ? 'sí' : 'no'} 404=${r.contesta404 ? 'sí' : 'no'}`);
      for (const w of r.escrituras.filter((x) => x.merchantId)) console.log(`             ${w.op} → ${w.destino} · ${w.sitio}`);
    }
    console.log(`CONTROL POSITIVO SEMBRADO (DELETE /semilla/:id): ${semilla ? (c.semillaVista ? 'visto' : 'NO VISTO') : 'no sembrado'}`);
    console.log(c.semillaVista ? 'VEREDICTO: el censo ve' : 'VEREDICTO: CIEGO — el positivo no aparece; ninguna fila de arriba vale');
  }
  process.exit(c.semillaVista ? 0 : 2);
}
