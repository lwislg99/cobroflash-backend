// docs/master/evidencias/SCRUM-1573/censo-cobro-publico.mjs — SCRUM-1573a (J2)
//
// ¿Qué rutas PÚBLICAS ofrecen un medio de cobro al cliente final, y cuál de ellas mira si el
// comercio está suprimido?
//
// POBLACIÓN: la de la casa. Se enumeran las rutas públicas EJECUTANDO `dist/app.js` con el mismo
// método que `tests/scrum98-public-access-fail-closed.test.mjs` (pila de Express + PUBLIC_PREFIXES),
// y se cruzan con `PUBLIC_ACCESS_DECLARED`. Si las dos listas no casan, sale CIEGO.
//
// CLASIFICACIÓN: por AST (TypeScript) sobre el `src/` del router de cada prefijo. Se toma el
// handler de cada `router.<método>(ruta, …)` y, de forma transitiva, el cuerpo de las funciones
// del mismo fichero a las que llama por nombre. Los comentarios no cuentan: no son nodos.
//
// CONTROL POSITIVO SEMBRADO: `--sembrar` añade un router fabricado que ofrece IBAN; tiene que
// salir como «ofrece cobro». Sin la semilla, el recuento de la semilla tiene que ser 0.
//
// Uso (con `dist/` compilado):   node docs/master/evidencias/SCRUM-1573/censo-cobro-publico.mjs [--sembrar]
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '../../../..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));
const ts = require_('typescript');
const SEMBRAR = process.argv.includes('--sembrar');

// ── ① La población de la casa, ejecutada ────────────────────────────────────────────────────
const { app } = require_('./dist/app.js');
const decl = require_('./dist/core/http/publicAccessDeclarations.js');
const enEjecucion = new Set();
for (const layer of app.router.stack) {
  if (!(layer.handle && layer.handle.stack) || layer.route) continue;
  const prefix = decl.PUBLIC_PREFIXES.find((p) => { try { return layer.match(p); } catch { return false; } });
  if (!prefix || decl.GUARD_A_EXCLUDED_PREFIXES.has(prefix) || decl.ROUTER_LEVEL_PREFIXES.has(prefix)) continue;
  for (const sub of layer.handle.stack) {
    if (!sub.route) continue;
    for (const rel of [].concat(sub.route.path)) {
      for (const m of Object.keys(sub.route.methods)) enEjecucion.add(`${m.toUpperCase()} ${prefix}${rel === '/' ? '' : rel}`);
    }
  }
}
const declaradas = new Set(decl.PUBLIC_ACCESS_DECLARED.map((d) => `${d.method.toUpperCase()} ${d.path}`));

// ── ② De prefijo a fichero, leído del AST de app.ts ─────────────────────────────────────────
const leer = (rel) => ts.createSourceFile(rel, fs.readFileSync(path.join(RAIZ, rel), 'utf8'), ts.ScriptTarget.Latest, true);
const appSf = leer('src/app.ts');
const importDe = new Map(); // nombre local → ruta src
const montajes = []; // { prefix, nombre }
appSf.forEachChild(function visita(n) {
  if (ts.isImportDeclaration(n) && n.importClause) {
    const mod = n.moduleSpecifier.text;
    const nombres = [];
    if (n.importClause.name) nombres.push(n.importClause.name.text);
    const nb = n.importClause.namedBindings;
    if (nb && ts.isNamedImports(nb)) for (const e of nb.elements) nombres.push(e.name.text);
    for (const x of nombres) importDe.set(x, path.join('src', mod + '.ts').replace(/\\/g, '/'));
  }
  if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'use'
      && n.arguments.length >= 2 && ts.isStringLiteral(n.arguments[0])) {
    const ult = n.arguments[n.arguments.length - 1];
    if (ts.isIdentifier(ult)) montajes.push({ prefix: n.arguments[0].text, nombre: ult.text });
  }
  ts.forEachChild(n, visita);
});

// ── ③ Marcadores ────────────────────────────────────────────────────────────────────────────
// De OFERTA de cobro: dato de cobro del comercio, o el dominio que decide si se ofrece, o un
// enlace a una puerta de cobro.
const PROP_COBRO = new Set(['iban', 'clabe', 'bizumPhone', 'stripeAccountId', 'mpAccessToken']);
const LLAMADA_COBRO = new Set(['transferenciaDisponible', 'viasDeCobro', 'cardChargeMode', 'cardChargeDecision',
  'bizumAutoDisponible', 'createMpPreference']);
const ENLACE_COBRO = /\/pay\/(card|bank|bizum|mp|invoice)\b/;
// De «SUPRIMIDO»: cualquier lectura que pudiera distinguirlo hoy.
const SENAL_SUPRIMIDO = new Set(['REDACTADO', 'merchant_anonimizado']);

function analiza(relFichero, extra = null) {
  const sf = extra ?? leer(relFichero);
  const funciones = new Map();
  sf.forEachChild((n) => {
    if (ts.isFunctionDeclaration(n) && n.name) funciones.set(n.name.text, n);
    if (ts.isVariableStatement(n)) for (const d of n.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) funciones.set(d.name.text, d.initializer);
    }
  });
  const rutas = [];
  sf.forEachChild(function visita(n) {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ts.isIdentifier(n.expression.expression)
        && /^router$|Router$/.test(n.expression.expression.text) && ['get', 'post', 'put', 'patch', 'delete'].includes(n.expression.name.text)
        && n.arguments.length >= 2 && (ts.isStringLiteralLike(n.arguments[0]) || ts.isArrayLiteralExpression(n.arguments[0]))) {
      const hallado = { oferta: new Set(), suprimido: new Set(), merchantStatus: false };
      const vistos = new Set();
      const recorre = (nodo) => {
        if (ts.isIdentifier(nodo) && funciones.has(nodo.text) && !vistos.has(nodo.text)) {
          vistos.add(nodo.text); recorre(funciones.get(nodo.text));
        }
        if (ts.isPropertyAccessExpression(nodo) && PROP_COBRO.has(nodo.name.text)) hallado.oferta.add('.' + nodo.name.text);
        if (ts.isCallExpression(nodo) && ts.isIdentifier(nodo.expression) && LLAMADA_COBRO.has(nodo.expression.text)) hallado.oferta.add(nodo.expression.text + '()');
        if (ts.isCallExpression(nodo) && ts.isPropertyAccessExpression(nodo.expression) && nodo.expression.name.text === 'create'
            && ts.isPropertyAccessExpression(nodo.expression.expression) && nodo.expression.expression.name.text === 'sessions') hallado.oferta.add('checkout.sessions.create');
        if ((ts.isStringLiteralLike(nodo) || ts.isTemplateHead(nodo) || ts.isTemplateMiddle(nodo) || ts.isTemplateTail(nodo)) && ENLACE_COBRO.test(nodo.text)) hallado.oferta.add('enlace ' + nodo.text.match(ENLACE_COBRO)[0]);
        if (ts.isIdentifier(nodo) && SENAL_SUPRIMIDO.has(nodo.text)) hallado.suprimido.add(nodo.text);
        if (ts.isStringLiteralLike(nodo) && SENAL_SUPRIMIDO.has(nodo.text)) hallado.suprimido.add(`'${nodo.text}'`);
        if (ts.isPropertyAccessExpression(nodo) && nodo.name.text === 'status' && /merchant|^m$/i.test(nodo.expression.getText(sf))) hallado.merchantStatus = true;
        ts.forEachChild(nodo, recorre);
      };
      for (const a of n.arguments.slice(1)) recorre(a);
      const lista = ts.isArrayLiteralExpression(n.arguments[0]) ? n.arguments[0].elements.map((e) => e.text) : [n.arguments[0].text];
      for (const ruta of lista) rutas.push({ metodo: n.expression.name.text.toUpperCase(), ruta, ...hallado });
    }
    ts.forEachChild(n, visita);
  });
  return rutas;
}

// ── ④ Recorrido ─────────────────────────────────────────────────────────────────────────────
const filas = [];
const enAst = new Set();
for (const { prefix, nombre } of montajes) {
  if (!decl.PUBLIC_PREFIXES.includes(prefix) || decl.GUARD_A_EXCLUDED_PREFIXES.has(prefix) || decl.ROUTER_LEVEL_PREFIXES.has(prefix)) continue;
  const fichero = importDe.get(nombre);
  if (!fichero || !fs.existsSync(path.join(RAIZ, fichero))) { console.log(`CIEGO · ${prefix} → ${nombre}: fichero no resuelto`); process.exitCode = 2; continue; }
  for (const r of analiza(fichero)) {
    const k = `${r.metodo} ${prefix}${r.ruta === '/' ? '' : r.ruta}`;
    enAst.add(k);
    filas.push({ k, fichero, ...r });
  }
}
let semilla = 0;
if (SEMBRAR) {
  const fab = ts.createSourceFile('semilla.ts',
    "router.get('/semilla/:t', async (req, res) => { const m = await carga(); res.send(pinta(m)); });\n" +
    "function pinta(m) { return `IBAN ${m.iban}`; }", ts.ScriptTarget.Latest, true);
  for (const r of analiza(null, fab)) { filas.push({ k: 'GET /pay/semilla/:t', fichero: '(sembrada)', ...r }); if (r.oferta.size) semilla++; }
}

// ── ⑤ Veredicto ─────────────────────────────────────────────────────────────────────────────
const soloEjec = [...enEjecucion].filter((k) => !enAst.has(k));
const soloAst = [...enAst].filter((k) => !enEjecucion.has(k));
const soloDecl = [...declaradas].filter((k) => enEjecucion.size && !enEjecucion.has(k) && !k.startsWith('GET /privacidad'));
console.log(`POBLACIÓN · en ejecución (método scrum98): ${enEjecucion.size} · en AST: ${enAst.size} · declaradas: ${declaradas.size}`);
console.log(`  en ejecución y no en AST: ${soloEjec.length ? soloEjec.join(' | ') : '0'}`);
console.log(`  en AST y no en ejecución: ${soloAst.length ? soloAst.join(' | ') : '0'}`);
console.log(`  declaradas y no colgadas de un router de prefijo (top-level o webhooks sueltos): ${soloDecl.length}`);
const ofrecen = filas.filter((f) => f.oferta.size);
console.log(`\nOFRECEN COBRO: ${ofrecen.length} de ${filas.length}`);
for (const f of ofrecen) {
  console.log(`  ${f.k.padEnd(34)} ${f.fichero.replace('src/modules/', '')}`);
  console.log(`      oferta: ${[...f.oferta].join(', ')}`);
  console.log(`      mira «suprimido»: ${f.suprimido.size ? [...f.suprimido].join(', ') : 'NO'} · lee merchant.status: ${f.merchantStatus ? 'SÍ' : 'NO'}`);
}
console.log(`\nNO OFRECEN: ${filas.filter((f) => !f.oferta.size).map((f) => f.k).join(' | ')}`);
console.log(`\nCONTROLES · semilla: ${SEMBRAR ? (semilla === 1 ? 'CAZADA (1)' : `NO CAZADA (${semilla}) → CIEGO`) : 'no sembrada (corre con --sembrar)'}`
  + ` · cruce AST/ejecución: ${soloEjec.length || soloAst.length ? 'NO CASA → CIEGO' : 'casa'}`);
if (SEMBRAR && semilla !== 1) process.exitCode = 2;
if (soloEjec.length || soloAst.length) process.exitCode = 2;
