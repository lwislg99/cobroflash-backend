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
  // SCRUM-1571c: dos lecturas con el defecto (directa y a través de un servicio, ésta con `{}`) y una sin él.
  'async function leerAjeno(id: number, merchantId: number) {',
  '  return prisma.semilla.findFirst({ where: { id, merchantId } });',
  '}',
  "router.get('/semilla/:id', async (req: any, res: any) => {",
  '  const fila = await prisma.semilla.findFirst({ where: { id: Number(req.params.id), merchantId: req.merchantId } });',
  '  res.json(fila);',
  '});',
  "router.get('/semilla/:id/servicio', async (req: any, res: any) => {",
  '  const fila = await leerAjeno(Number(req.params.id), req.merchantId);',
  '  res.json({ ...fila });',
  '});',
  "router.get('/semilla/:id/con-404', async (req: any, res: any) => {",
  '  const fila = await leerAjeno(Number(req.params.id), req.merchantId);',
  "  if (!fila) return res.status(404).json({ error: 'not_found' });",
  '  res.json(fila);',
  '});',
  '',
].join('\n');
export const SEMILLAS_LECTURA = { conDefecto: ['GET /semilla/:id', 'GET /semilla/:id/servicio'], sinDefecto: ['GET /semilla/:id/con-404'] };

const VERBOS = new Set(['delete', 'put', 'patch', 'post']);
const VERBOS_LECTURA = new Set(['get', ...VERBOS]);

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

// SCRUM-1600 · Los `SourceFile` leídos de DISCO se comparten entre las llamadas a `censar` del mismo proceso.
// Los dos tests llaman dos veces (con y sin semilla) y cada `ts.createProgram` con un host nuevo volvía a parsear
// los mismos ficheros (src/, la lib, `@types`, prisma), y el pico del proceso casi se doblaba con basura del primer
// programa que V8 no recogía (medición, con su hora, en `docs/master/SCRUM-1600.md`). Es la palanca de SCRUM-1244
// (`scripts/_censo-fecha-sin-zona.mjs`). La SEMILLA no entra nunca en la caché: se fabrica antes de consultarla, y
// sin semilla no existe.
const DE_DISCO = new Map();

export function censar({ semilla = true } = {}) {
  const ficheros = listar(SRC);
  if (semilla) ficheros.push(SEMILLA);
  const opciones = {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.Node10,
    esModuleInterop: true, resolveJsonModule: true, skipLibCheck: true, noEmit: true, strict: true,
  };
  const host = ts.createCompilerHost(opciones);
  const getSF = host.getSourceFile.bind(host);
  host.getSourceFile = (f, v, onError, nuevo) => {
    if (f === SEMILLA) return semilla ? ts.createSourceFile(f, TEXTO_SEMILLA, v, true) : undefined;
    const clave = `${f}|${typeof v === 'object' && v ? `${v.languageVersion}|${v.impliedNodeFormat}` : v}`;
    if (!nuevo && DE_DISCO.has(clave)) return DE_DISCO.get(clave);
    const sf = getSF(f, v, onError, nuevo);
    if (sf) DE_DISCO.set(clave, sf);
    return sf;
  };
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

  // ── SCRUM-1571c · la lectura que no encuentra y contesta 200 con `null` (o `{}`) ──────────────────────────
  // Un valor es ANULABLE si sale de un `findFirst`/`findUnique` cuyo primer argumento nombra `merchantId`, de una
  // función de `src/` que lo devuelve sin mirarlo (hasta 4 niveles), o de un `c ? x : null`. Se da por MIRADO si su
  // nombre aparece tras `!`, en un `==`/`===`/`!=`/`!==`, como condición de un `if` o de un `? :`, o a la izquierda
  // de `&&`/`||`/`??` (salvo `v || {}` / `v ?? {}`, que es el `{}` vacío del defecto).
  const pelar = (e) => {
    while (e && (ts.isAwaitExpression(e) || ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e))) e = e.expression;
    return e;
  };
  const esFind = (e) => ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression)
    && (e.expression.name.text === 'findFirst' || e.expression.name.text === 'findUnique')
    && !!e.arguments[0] && /merchantId/.test(e.arguments[0].getText());
  const objetoVacio = (e) => { e = pelar(e); return !!e && ts.isObjectLiteralExpression(e) && e.properties.length === 0; };
  const propias = (fn, f) => { // recorre fn sin entrar en funciones anidadas
    const ver = (m) => { if (m !== fn && ts.isFunctionLike(m)) return; f(m); ts.forEachChild(m, ver); };
    ver(fn);
  };
  const mirado = (nombre, fn) => {
    let si = false;
    propias(fn, (m) => {
      if (!ts.isIdentifier(m) || m.text !== nombre) return;
      let hijo = m; let p = m.parent;
      while (p && ts.isParenthesizedExpression(p)) { hijo = p; p = p.parent; }
      if (!p) return;
      if (ts.isPrefixUnaryExpression(p) && p.operator === ts.SyntaxKind.ExclamationToken) si = true;
      else if (ts.isIfStatement(p) && p.expression === hijo) si = true;
      else if (ts.isConditionalExpression(p) && p.condition === hijo) si = true;
      else if (ts.isBinaryExpression(p)) {
        const op = p.operatorToken.kind; const K = ts.SyntaxKind;
        if ([K.EqualsEqualsToken, K.EqualsEqualsEqualsToken, K.ExclamationEqualsToken, K.ExclamationEqualsEqualsToken].includes(op)) si = true;
        else if (p.left === hijo && op === K.AmpersandAmpersandToken) si = true;
        else if (p.left === hijo && (op === K.BarBarToken || op === K.QuestionQuestionToken) && !objetoVacio(p.right)) si = true;
      }
    });
    return si;
  };
  const memo = new Map();
  const devuelveAnulable = (fn, prof) => {
    if (memo.has(fn)) return memo.get(fn);
    memo.set(fn, false);
    let r = false;
    if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) r = anulable(fn.body, fn, prof);
    else if (fn.body) propias(fn, (m) => { if (ts.isReturnStatement(m) && m.expression && anulable(m.expression, fn, prof)) r = true; });
    memo.set(fn, r);
    return r;
  };
  function anulable(expr, fn, prof) {
    const e = pelar(expr);
    if (!e) return false;
    if (esFind(e)) return true;
    if (ts.isConditionalExpression(e)) return [e.whenTrue, e.whenFalse].some((b) => pelar(b).kind === ts.SyntaxKind.NullKeyword);
    if (ts.isCallExpression(e) && prof < 4) return resolver(e.expression).some((f) => devuelveAnulable(f, prof + 1));
    if (ts.isIdentifier(e)) {
      let ini = null;
      propias(fn, (m) => { if (ts.isVariableDeclaration(m) && ts.isIdentifier(m.name) && m.name.text === e.text && m.initializer) ini = m.initializer; });
      return !!ini && anulable(ini, fn, prof) && !mirado(e.text, fn);
    }
    return false;
  }
  // Lo que decide el CUERPO de `res.json(…)`/`res.send(…)`: el argumento entero; un objeto literal de UNA sola
  // propiedad (`{ ...v }` da `{}`, `{ v }` da `{ v: null }`: el cuerpo no lleva nada más); y la izquierda de un
  // `v || {}` / `v ?? {}`. Un anulable que es UNA propiedad entre varias (`{ customer, quote: q ? … : null }`) no
  // cuenta: es un dato opcional dentro de una respuesta que sí lleva algo, no un 200 vacío.
  const valoresQueLlegan = (arg) => {
    const e = pelar(arg);
    if (!e) return [];
    if (ts.isObjectLiteralExpression(e)) {
      if (e.properties.length !== 1) return [];
      const p = e.properties[0];
      return ts.isShorthandPropertyAssignment(p) ? [p.name]
        : ts.isPropertyAssignment(p) ? valoresQueLlegan(p.initializer) : ts.isSpreadAssignment(p) ? valoresQueLlegan(p.expression) : [];
    }
    if (ts.isBinaryExpression(e) && objetoVacio(e.right)
      && (e.operatorToken.kind === ts.SyntaxKind.BarBarToken || e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) return [e.left];
    return [e];
  };
  const raiz = (e) => { while (ts.isPropertyAccessExpression(e) || ts.isCallExpression(e)) e = e.expression; return e; };
  const analizarLectura = (manejadores) => {
    const fns = [];
    for (const h of manejadores) {
      if (ts.isArrowFunction(h) || ts.isFunctionExpression(h)) fns.push(h);
      else if (ts.isIdentifier(h) || ts.isPropertyAccessExpression(h)) fns.push(...resolver(h));
    }
    const lecturas = []; const nulos = [];
    for (const fn of fns) {
      const p2 = fn.parameters?.[1];
      const resNombre = p2 && ts.isIdentifier(p2.name) ? p2.name.text : 'res';
      propias(fn, (m) => {
        if (ts.isCallExpression(m) && esFind(m)) lecturas.push(`${rel(m.getSourceFile())}:${linea(m)}`);
        if (!ts.isCallExpression(m) || !ts.isPropertyAccessExpression(m.expression)) return;
        if (m.expression.name.text !== 'json' && m.expression.name.text !== 'send') return;
        const r = raiz(m.expression.expression);
        if (!ts.isIdentifier(r) || r.text !== resNombre) return;
        for (const v of m.arguments.flatMap(valoresQueLlegan)) {
          if (anulable(v, fn, 0)) nulos.push({ envio: `${rel(m.getSourceFile())}:${linea(m)}`, valor: v.getText().slice(0, 60) });
        }
      });
    }
    return { analizable: fns.length > 0, lecturas, nulos };
  };

  const rutas = [];
  const rutasLectura = [];
  for (const sf of programa.getSourceFiles()) {
    if (!esDeSrc(sf)) continue;
    const visita = (n) => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && VERBOS_LECTURA.has(n.expression.name.text)
          && n.arguments.length >= 2 && ts.isStringLiteralLike(n.arguments[0]) && n.arguments[0].text.startsWith('/')) {
        const r = n.arguments[0].text;
        const verbo = n.expression.name.text;
        const fila = { verbo: verbo.toUpperCase(), ruta: r, sitio: `${rel(sf)}:${linea(n)}`, conId: r.includes(':') };
        if (fila.conId) rutasLectura.push({ verbo: fila.verbo, ruta: r, sitio: fila.sitio, ...analizarLectura(n.arguments.slice(1)) });
        if (VERBOS.has(verbo)) {
          if (fila.conId) Object.assign(fila, analizarRuta(n.arguments.slice(1)));
          rutas.push(fila);
        }
      }
      ts.forEachChild(n, visita);
    };
    visita(sf);
  }
  const conNulo = rutasLectura.filter((r) => r.nulos.length > 0);
  const nombre = (r) => `${r.verbo} ${r.ruta}`;
  const deSemilla = (r) => r.sitio.includes('__semilla_scrum1571b__');
  const lectura = {
    rutas: rutasLectura,
    conLectura: rutasLectura.filter((r) => r.lecturas.length > 0),
    sinManejador: rutasLectura.filter((r) => !r.analizable),
    sospechosas: conNulo,
    semillaVista: SEMILLAS_LECTURA.conDefecto.every((n) => conNulo.some((r) => deSemilla(r) && nombre(r) === n)),
    semillaLimpiaCallada: SEMILLAS_LECTURA.sinDefecto.every((n) => rutasLectura.some((r) => deSemilla(r) && nombre(r) === n)
      && !conNulo.some((r) => deSemilla(r) && nombre(r) === n)),
  };

  const conId = rutas.filter((r) => r.conId);
  const conEscritura = conId.filter((r) => r.escrituras.some((w) => w.merchantId));
  const sospechosas = conEscritura.filter((r) => !r.leeCount && !r.contesta404
    && r.escrituras.some((w) => w.merchantId && (w.destino === 'tirado' || w.destino === 'devuelto')));
  const semillaVista = sospechosas.some((r) => r.sitio.includes('__semilla_scrum1571b__'));
  return { ficheros: ficheros.length - (semilla ? 1 : 0), rutas, conId, conEscritura, sospechosas, semillaVista, lectura };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const semilla = !process.argv.includes('--sin-semilla');
  const c = censar({ semilla });
  if (process.argv.includes('--json')) console.log(JSON.stringify(c, null, 1));
  else {
    if (semilla) console.log('(las cuentas de RUTAS incluyen la sembrada: una más en cada una; la de ficheros, no)');
    console.log(`POBLACIÓN · ficheros .ts en src/: ${c.ficheros} · rutas delete/put/patch/post con ruta literal: ${c.rutas.length} · sobre un :id: ${c.conId.length}`);
    console.log(`  · que alcanzan un updateMany/deleteMany con merchantId: ${c.conEscritura.length} · SOSPECHOSAS: ${c.sospechosas.length}`);
    for (const r of c.conEscritura) {
      const marca = c.sospechosas.includes(r) ? 'SOSPECHOSA' : 'ok        ';
      console.log(`${marca} ${r.verbo} ${r.ruta} · ${r.sitio} · count=${r.leeCount ? 'sí' : 'no'} 404=${r.contesta404 ? 'sí' : 'no'}`);
      for (const w of r.escrituras.filter((x) => x.merchantId)) console.log(`             ${w.op} → ${w.destino} · ${w.sitio}`);
    }
    console.log(`CONTROL POSITIVO SEMBRADO (DELETE /semilla/:id): ${semilla ? (c.semillaVista ? 'visto' : 'NO VISTO') : 'no sembrado'}`);
    console.log(c.semillaVista ? 'VEREDICTO: el censo ve' : 'VEREDICTO: CIEGO — el positivo no aparece; ninguna fila de arriba vale');
    const l = c.lectura;
    console.log(`\nSCRUM-1571c · LECTURAS · rutas get/delete/put/patch/post sobre un :id: ${l.rutas.length} · con manejador que se pudo leer: ${l.rutas.length - l.sinManejador.length}`
      + ` · con findFirst/findUnique + merchantId en el propio manejador: ${l.conLectura.length} · SOSPECHOSAS (200 con null o {}): ${l.sospechosas.length}`);
    for (const r of l.sospechosas) {
      console.log(`SOSPECHOSA ${r.verbo} ${r.ruta} · ${r.sitio}`);
      for (const n of r.nulos) console.log(`             envía «${n.valor}» · ${n.envio}`);
    }
    console.log(`CONTROL POSITIVO SEMBRADO (${SEMILLAS_LECTURA.conDefecto.join(', ')}): ${semilla ? (l.semillaVista ? 'visto' : 'NO VISTO') : 'no sembrado'}`);
    console.log(`CONTROL NEGATIVO SEMBRADO (${SEMILLAS_LECTURA.sinDefecto.join(', ')}): ${semilla ? (l.semillaLimpiaCallada ? 'callado' : 'SEÑALADO o no visto') : 'no sembrado'}`);
    console.log(l.semillaVista && l.semillaLimpiaCallada ? 'VEREDICTO: el censo de lecturas ve' : 'VEREDICTO: CIEGO — las lecturas de arriba no valen');
  }
  process.exit(c.semillaVista && c.lectura.semillaVista && c.lectura.semillaLimpiaCallada ? 0 : 2);
}
