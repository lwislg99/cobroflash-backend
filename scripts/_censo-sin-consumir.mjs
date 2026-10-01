// scripts/_censo-sin-consumir.mjs — SCRUM-1185 · LO CONSTRUIDO Y SIN CONSUMIR
//
//   node scripts/_censo-sin-consumir.mjs              # censa el árbol de trabajo
//   node scripts/_censo-sin-consumir.mjs --ref <sha>  # censa un commit (lee con git cat-file)
//   node scripts/_censo-sin-consumir.mjs --declarar   # imprime las piezas en forma de declaración
//
// Qué busca: piezas que alguien construyó y a las que NADA llega. Rutas del servidor sin llamada,
// llamadas que viven en una función a la que no llega nadie, exportaciones del servidor que no
// importa nadie de `src/`, funciones del panel sin llamador, `window.X` que nadie nombra, vistas
// del router sin puerta, enlaces `#…` que el router no atiende y claves que el servidor acepta en
// el cuerpo y ningún llamador manda.
//
// La red que lo vigila es `tests/scrum1185-trinquete-sin-consumir.test.mjs`, y la lista de lo que
// ya estaba así el 27-sep-2026 vive en `scripts/_sin-consumir-declarados.json`.
//
// ── TRES FALLOS DE ESTA MISMA SONDA, CAZADOS AL MEDIR (27-sep-2026) ──────────────────────────────
// Sin estos tres arreglos el censo era ruido con forma de hallazgo. Por eso cada uno tiene su
// control fabricado en el test:
//   1. Los COMENTARIOS nombran funciones («ver `pintarRevisiones`…»). Buscar el nombre como texto
//      daba por usada una función muerta. → Se cuentan tokens del AST (identificadores y cadenas),
//      nunca texto crudo.
//   2. `'/admin/albaranes/' + id` casaba con `/admin/albaranes/consolidar`: el comodín de un id
//      ocupaba un segmento literal. → Emparejamiento SEGMENTO A SEGMENTO: un segmento que es todo
//      comodín sólo casa con un `:param`.
//   3. Los textos de log (`console.error('PUT /admin/…/:id error')`) y las LISTAS de rutas de
//      `src/core/http/*Declarations.ts` / `adminOnlyRoutes.ts` nombran una ruta sin consumirla.
//      → Se excluyen los argumentos de `console.*`/`*Error`/`log*` y esas listas.
//
// ── LO QUE ESTA SONDA NO VE (y por eso no puede prometer) ────────────────────────────────────────
// Ver `LIMITES` abajo. El test los imprime en cada tanda: un instrumento que dice lo que no ve es
// el único en el que se puede confiar.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const LIMITES = [
  'ALCANCE CONDICIONAL: una llamada que existe pero sólo se pinta bajo un flag o un modo (el caso de `collect-rest` en modo recibo, SCRUM-1160) cuenta como consumida. La sonda lee código, no ejecuta.',
  'URLs montadas con arrays o `.join(...)`: no se reconstruyen; la llamada sale CIEGA si no deja ningún literal de ruta.',
  'Llamadas de red con URL totalmente opaca (una variable que no es `const`/`let` de cadenas del mismo fichero): salen CIEGAS, una por función envolvente; el 27-sep-2026 eran 9 llamadas en 8 funciones.',
  'Funciones muertas encadenadas de MÁS de un nivel DENTRO del código vivo: si A (muerta) es la única que llama a B, B no sale; sólo A. Entre MÓDULOS del servidor sí se cierra desde SCRUM-1192: un import sólo cuenta si el fichero que importa es alcanzable desde `src/index.ts` (el caso que lo destapó: `huecosSerie.ts::huecosDeLaSerie`, importada sólo por `albaranSerie.ts`, que no importa nadie). En el front (`public/`) NO: una función del panel llamada sólo desde otra función muerta sigue saliendo viva.',
  'Claves del cuerpo: cuando el llamador manda un objeto que no se puede leer (spread, parámetro, función), el respaldo es buscar la clave como token en el fichero llamador y en los que llaman a su envoltorio. Es DÉBIL: una clave que aparece por otro motivo en ese fichero la da por mandada.',
  'Consumidores fuera de `public/` y `src/` (WhatsApp de Meta, correos ya enviados, scripts de operación, cron externo) no cuentan: por eso las rutas de operación están declaradas a mano con su carril.',
  'Campos servidos que ninguna pantalla lee: NO entran en este censo (99 candidatos el 27-sep-2026, sin método verificado; solo `firmasCompletas` confirmado, SCRUM-1181).',
];

const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'all']);
const EXTERNOS = [/^\/webhooks\//, /^\/health/, /^\/dev(\/|$)/, /^\/charges/, /^\/invoice(\/|$)/, /^\/outbox/];
const RAIZ = 'src/index.ts';
const DECLARACIONES = /^src\/core\/http\/(\w*Declarations|adminOnlyRoutes)\.ts$/;

// ── Carga ──────────────────────────────────────────────────────────────────────────────────────
const RELEVANTE = (f) => (/^(src|public)\//.test(f) && /\.(ts|js|mjs|html)$/.test(f) && !f.endsWith('.d.ts')) || f === 'prisma/schema.prisma';

export function cargarArbol(root = '.') {
  const files = new Map();
  const rec = (rel) => {
    const abs = path.join(root, rel);
    if (!existsSync(abs)) return;
    for (const e of readdirSync(abs)) {
      const r = rel + '/' + e;
      if (e === 'node_modules') continue;
      if (statSync(path.join(root, r)).isDirectory()) rec(r);
      else if (RELEVANTE(r)) files.set(r, readFileSync(path.join(root, r), 'utf8'));
    }
  };
  rec('src'); rec('public');
  if (existsSync(path.join(root, 'prisma/schema.prisma'))) files.set('prisma/schema.prisma', readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8'));
  const tests = existsSync(path.join(root, 'tests'))
    ? readdirSync(path.join(root, 'tests')).filter((f) => f.endsWith('.mjs')).map((f) => readFileSync(path.join(root, 'tests', f), 'utf8')).join('\n') : '';
  return { files, testsText: tests };
}

export function cargarCommit(ref, root = '.') {
  const git = (args, input) => execFileSync('git', ['-C', root, ...args], { input, maxBuffer: 1 << 30 });
  const names = git(['ls-tree', '-r', '--name-only', ref, '--', 'src', 'public', 'prisma/schema.prisma', 'tests'])
    .toString().split('\n').filter((f) => RELEVANTE(f) || (/^tests\/[^/]+\.mjs$/.test(f)));
  const buf = git(['cat-file', '--batch'], names.map((n) => `${ref}:${n}`).join('\n') + '\n');
  const files = new Map(); let tests = '';
  let off = 0, i = 0;
  while (off < buf.length && i < names.length) {
    const nl = buf.indexOf(10, off); const size = Number(buf.slice(off, nl).toString().split(' ')[2]);
    const body = buf.slice(nl + 1, nl + 1 + size).toString('utf8'); const n = names[i++];
    if (n.startsWith('tests/')) tests += body + '\n'; else files.set(n, body);
    off = nl + 1 + size + 1;
  }
  return { files, testsText: tests };
}

// ── El censo ───────────────────────────────────────────────────────────────────────────────────
export function censar({ files, testsText = '' }) {
  const testTokens = new Set(testsText.match(/[A-Za-z_$][\w$]*/g) || []);
  const srcFiles = [...files.keys()].filter((f) => f.startsWith('src/') && /\.(ts|js|mjs)$/.test(f));
  const pubJs = [...files.keys()].filter((f) => f.startsWith('public/') && /\.(js|mjs)$/.test(f));
  const pubHtml = [...files.keys()].filter((f) => f.startsWith('public/') && f.endsWith('.html'));
  const srcHtml = [...files.keys()].filter((f) => f.startsWith('src/') && f.endsWith('.html'));

  const parsed = new Map();
  const sf = (file, text = files.get(file), kind) => {
    const key = file + (kind ? '#' + kind : '');
    if (!parsed.has(key)) parsed.set(key, ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
      file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS));
    return parsed.get(key);
  };
  const lineOf = (s, n) => s.getLineAndCharacterOfPosition(n.getStart(s)).line + 1;
  const walk = (n, f) => { f(n); n.forEachChild((c) => walk(c, f)); };
  const esc = (s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

  // Tokens de CÓDIGO del front (fallo nº 1: nunca texto crudo con comentarios)
  const tokensFront = new Map(); const tokensDe = new Map(); let tokActual = null;
  const bump = (t) => { tokensFront.set(t, (tokensFront.get(t) || 0) + 1); tokActual.add(t); };
  for (const f of pubJs) {
    tokActual = new Set(); tokensDe.set(f, tokActual);
    walk(sf(f), (n) => {
      if (ts.isIdentifier(n) || ts.isPrivateIdentifier(n)) bump(n.text);
      else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n))
        for (const w of n.text.match(/[A-Za-z_$][\w$]*/g) || []) bump(w);
    });
  }
  for (const f of pubHtml) {
    tokActual = new Set(); tokensDe.set(f, tokActual);
    for (const w of files.get(f).replace(/<!--[\s\S]*?-->/g, '').match(/[A-Za-z_$][\w$]*/g) || []) bump(w);
  }

  // Constantes y `let` de cadena por fichero
  function constMap(s) {
    const m = new Map(); const lets = new Map();
    walk(s, (n) => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.parent) {
        if (n.parent.flags & ts.NodeFlags.Const) { if (n.initializer) m.set(n.name.text, n.initializer); }
        else lets.set(n.name.text, [...(lets.get(n.name.text) || []), n.initializer || null]);
      }
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(n.left))
        lets.set(n.left.text, [...(lets.get(n.left.text) || []), n.right]);
    });
    for (const [k, vs] of lets) {
      if (m.has(k)) continue;
      const lits = vs.filter(Boolean);
      if (lits.length && lits.every((v) => ts.isStringLiteral(v) || ts.isNoSubstitutionTemplateLiteral(v)))
        m.set(k, { __alternativas: lits.map((v) => v.text) });
    }
    return m;
  }
  const isStrNode = (n) => ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n) ||
    (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken);
  function pat(n, cm, depth = 0) {
    if (depth > 6) return ['*'];
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return [n.text];
    if (ts.isParenthesizedExpression(n)) return pat(n.expression, cm, depth + 1);
    if (ts.isTemplateExpression(n)) {
      let acc = [n.head.text];
      for (const sp of n.templateSpans) {
        const e = pat(sp.expression, cm, depth + 1); const nx = [];
        for (const a of acc) for (const b of e) nx.push(a + b + sp.literal.text);
        acc = nx.slice(0, 16);
      }
      return acc;
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const l = pat(n.left, cm, depth + 1), r = pat(n.right, cm, depth + 1), o = [];
      for (const a of l) for (const b of r) o.push(a + b);
      return o.slice(0, 16);
    }
    if (ts.isConditionalExpression(n)) return [...pat(n.whenTrue, cm, depth + 1), ...pat(n.whenFalse, cm, depth + 1)].slice(0, 16);
    if (ts.isIdentifier(n) && cm && cm.has(n.text)) {
      const init = cm.get(n.text);
      if (init.__alternativas) return init.__alternativas.slice(0, 8);
      if (isStrNode(init) || ts.isIdentifier(init) || ts.isConditionalExpression(init)) return pat(init, cm, depth + 1);
    }
    return ['*'];
  }
  function nombresEnvolventes(n) {
    const out = [];
    for (let q = n.parent; q; q = q.parent) {
      if (ts.isFunctionDeclaration(q) && q.name) out.push(q.name.text);
      else if ((ts.isArrowFunction(q) || ts.isFunctionExpression(q)) && q.parent && ts.isVariableDeclaration(q.parent) && ts.isIdentifier(q.parent.name)) out.push(q.parent.name.text);
      else if (ts.isMethodDeclaration(q) && q.name) out.push(q.name.getText());
    }
    return out;
  }

  // ── Rutas del servidor ──
  function resolveImport(from, spec) {
    if (!spec.startsWith('.')) return null;
    const p = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec)).replace(/\.js$/, '');
    for (const c of [p + '.ts', p + '/index.ts', p + '.js', p]) if (files.has(c)) return c;
    return null;
  }
  function importsOf(file) {
    const s = sf(file); const m = new Map();
    for (const st of s.statements) {
      if (!ts.isImportDeclaration(st) || !st.importClause) continue;
      const tgt = resolveImport(file, st.moduleSpecifier.text); if (!tgt) continue;
      const ic = st.importClause;
      if (ic.name) m.set(ic.name.text, { file: tgt, name: 'default' });
      if (ic.namedBindings && ts.isNamedImports(ic.namedBindings))
        for (const el of ic.namedBindings.elements) m.set(el.name.text, { file: tgt, name: (el.propertyName || el.name).text });
      if (ic.namedBindings && ts.isNamespaceImport(ic.namedBindings)) m.set(ic.namedBindings.name.text, { file: tgt, name: '*' });
    }
    return m;
  }
  // Todo lo que carga un fichero en ejecución: import (menos los de solo tipo), export-from,
  // import() y require con literal.
  function cargaDe(file) {
    const out = new Set();
    const add = (spec) => { const t = resolveImport(file, spec); if (t) out.add(t); };
    walk(sf(file), (n) => {
      if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && !n.importClause?.isTypeOnly) add(n.moduleSpecifier.text);
      else if (ts.isExportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier) && !n.isTypeOnly) add(n.moduleSpecifier.text);
      else if (ts.isCallExpression(n) && n.arguments[0] && ts.isStringLiteralLike(n.arguments[0])
        && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === 'require'))) add(n.arguments[0].text);
    });
    return out;
  }
  function alcanceDesde(raiz) {
    const vistos = new Set(); const pila = [raiz];
    while (pila.length) {
      const f = pila.pop(); if (vistos.has(f)) continue; vistos.add(f);
      if (/\.(ts|js|mjs)$/.test(f)) for (const t of cargaDe(f)) pila.push(t);
    }
    return vistos;
  }
  function exportNamesOfLocal(file) {
    const s = sf(file); const m = new Map();
    for (const st of s.statements) {
      const mods = ts.canHaveModifiers(st) ? ts.getModifiers(st) || [] : [];
      const exp = mods.some((x) => x.kind === ts.SyntaxKind.ExportKeyword);
      if (ts.isVariableStatement(st) && exp) for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) m.set(d.name.text, [d.name.text]);
      if (ts.isExportDeclaration(st) && !st.moduleSpecifier && st.exportClause && ts.isNamedExports(st.exportClause))
        for (const el of st.exportClause.elements) { const loc = (el.propertyName || el.name).text; m.set(loc, [...(m.get(loc) || []), el.name.text]); }
      if (ts.isExportAssignment(st) && ts.isIdentifier(st.expression)) m.set(st.expression.text, [...(m.get(st.expression.text) || []), 'default']);
    }
    return m;
  }
  function clavesLeidas(call) {
    const ks = new Set(); let ciego = false; const alias = new Set(['req.body']);
    const h = call.arguments[call.arguments.length - 1];
    walk(h, (n) => {
      if (!ts.isVariableDeclaration(n) || !n.initializer) return;
      const t = n.initializer.getText().replace(/\s/g, '');
      if (/^\w+\.parse\(req\.body\)$/.test(t) && ts.isIdentifier(n.name)) { alias.add(n.name.text); return; }
      if (/^\(?req\.body(\?\?\{\}|\|\|\{\})?\)?(as.*)?$/.test(t)) {
        if (ts.isIdentifier(n.name)) alias.add(n.name.text);
        else if (ts.isObjectBindingPattern(n.name)) for (const el of n.name.elements) {
          if (el.dotDotDotToken) ciego = true; else ks.add((el.propertyName || el.name).getText());
        }
      }
    });
    walk(h, (n) => {
      if (ts.isPropertyAccessExpression(n) && alias.has(n.expression.getText())) ks.add(n.name.text);
      if (ts.isElementAccessExpression(n) && alias.has(n.expression.getText()) && ts.isStringLiteral(n.argumentExpression)) ks.add(n.argumentExpression.text);
      if (ts.isCallExpression(n) && n.arguments.some((a) => alias.has(a.getText())) && !/\.parse$/.test(n.expression.getText())) ciego = true;
    });
    return { ks: [...ks], ciego };
  }
  const routeDefs = []; const routeLiteralNodes = new Map();
  for (const f of srcFiles) {
    const s = sf(f); const set = new Set();
    walk(s, (n) => {
      if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) return;
      const meth = n.expression.name.text; if (!METHODS.has(meth)) return;
      const a0 = n.arguments[0]; if (!a0 || !(ts.isStringLiteral(a0) || ts.isNoSubstitutionTemplateLiteral(a0)) || !a0.text.startsWith('/')) return;
      const obj = n.expression.expression; if (!ts.isIdentifier(obj) || n.arguments.length < 2) return;
      set.add(a0);
      routeDefs.push({ file: f, line: lineOf(s, n), method: meth.toUpperCase(), local: a0.text, routerVar: obj.text, cuerpoLeido: clavesLeidas(n) });
    });
    routeLiteralNodes.set(f, set);
  }
  const APP = 'src/app.ts';
  const mounts = [];
  if (files.has(APP)) {
    const appImports = importsOf(APP);
    walk(sf(APP), (n) => {
      if (!ts.isCallExpression(n)) return;
      const callee = n.expression.getText(); const last = n.arguments[n.arguments.length - 1];
      let prefix = null;
      if (callee === 'app.use' && n.arguments.length >= 2 && ts.isStringLiteral(n.arguments[0])) prefix = n.arguments[0].text;
      if (callee === 'mountAdmin' && n.arguments.length >= 3 && ts.isStringLiteral(n.arguments[1])) prefix = n.arguments[1].text;
      if (prefix == null || !ts.isIdentifier(last)) return;
      const imp = appImports.get(last.text); if (!imp) return;
      mounts.push({ file: imp.file, exportName: imp.name, prefix });
      routeLiteralNodes.get(APP).add(n.arguments[callee === 'mountAdmin' ? 1 : 0]);
    });
  }
  const routes = []; const routerSinMontar = new Set();
  for (const r of routeDefs) {
    if (r.file === APP && r.routerVar === 'app') { routes.push({ ...r, path: r.local }); continue; }
    const exNames = exportNamesOfLocal(r.file).get(r.routerVar) || [];
    const ms = mounts.filter((m) => m.file === r.file && exNames.includes(m.exportName));
    if (!ms.length) { routerSinMontar.add(`${r.file}::${r.routerVar}`); continue; }
    for (const m of ms) routes.push({ ...r, path: (m.prefix + (r.local === '/' ? '' : r.local)).replace(/\/+/g, '/') });
  }
  const PREFIJOS = [...new Set(routes.map((r) => r.path.split('/')[1]).filter(Boolean))].map(esc);
  const reRuta = new RegExp('/(?:' + (PREFIJOS.join('|') || 'admin') + ')(?=[/*?#"\'\\s]|$)[^\\s"\'<>`?#)]*', 'g');
  const rutasEn = (p) => { const out = []; let m; reRuta.lastIndex = 0; while ((m = reRuta.exec(p))) out.push(m[0]); return out; };

  // ── Consumidores ──
  function clavesDeObjeto(o) {
    const ks = new Set(); let ciego = false;
    for (const pr of o.properties) { if (ts.isSpreadAssignment(pr)) { ciego = true; continue; } if (pr.name) ks.add(pr.name.getText().replace(/['"]/g, '')); }
    return { ks, ciego };
  }
  function clavesDelCuerpo(call) {
    const opt = call.arguments[1];
    if (!opt || !ts.isObjectLiteralExpression(opt)) return null;
    const bp = opt.properties.find((p) => p.name && p.name.getText() === 'body');
    if (!bp) return { ks: new Set(), ciego: false };
    let v = ts.isShorthandPropertyAssignment(bp) ? bp.name : bp.initializer;
    if (ts.isCallExpression(v) && /JSON\.stringify$/.test(v.expression.getText())) v = v.arguments[0];
    if (v && ts.isObjectLiteralExpression(v)) return clavesDeObjeto(v);
    if (v && ts.isIdentifier(v)) {
      let fn = call; while (fn && !ts.isFunctionLike(fn)) fn = fn.parent;
      let res = null;
      if (fn) walk(fn, (n) => { if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === v.text && n.initializer && ts.isObjectLiteralExpression(n.initializer)) res = clavesDeObjeto(n.initializer); });
      if (res && fn) walk(fn, (n) => { if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(n.left) && n.left.expression.getText() === v.text) res.ks.add(n.left.name.text); });
      return res || { ks: new Set(), ciego: true };
    }
    return { ks: new Set(), ciego: true };
  }
  function metodoDe(n) {
    let top = n;
    while (top.parent && (ts.isParenthesizedExpression(top.parent) || (ts.isBinaryExpression(top.parent) && top.parent.operatorToken.kind === ts.SyntaxKind.PlusToken))) top = top.parent;
    const p = top.parent;
    if (!(p && ts.isCallExpression(p) && p.arguments[0] === top)) return 'ANY';
    const callee = p.expression.getText(); const opt = p.arguments[1];
    if (opt && ts.isObjectLiteralExpression(opt)) {
      for (const pr of opt.properties) if (pr.name && pr.name.getText() === 'method' && ts.isPropertyAssignment(pr)) {
        const v = pat(pr.initializer); return v.length === 1 && v[0] !== '*' ? v[0].toUpperCase() : 'ANY';
      }
      return /apiRequest|fetch/.test(callee) ? 'GET' : 'ANY';
    }
    const mm = /\b(get|post|put|patch|delete)\w*$/i.exec(callee.split('.').pop());
    if (mm) return mm[1].toUpperCase();
    if (/apiRequest|^fetch$|\.fetch$|apiFetch/.test(callee) && !opt) return 'GET';
    return 'ANY';
  }
  const consumidores = []; const ciegas = [];
  function recogeUrls(file, s, origen, excluir = new Set()) {
    const cm = constMap(s);
    walk(s, (n) => {
      if (!isStrNode(n)) return;
      const par = n.parent;
      if (par && ((ts.isBinaryExpression(par) && par.operatorToken.kind === ts.SyntaxKind.PlusToken) || ts.isTemplateSpan(par))) return;
      if (excluir.has(n)) return;
      // fallo nº 3: un texto de log o de error que NOMBRA una ruta no la consume
      for (let q = n.parent; q && !ts.isStatement(q); q = q.parent)
        if ((ts.isCallExpression(q) || ts.isNewExpression(q)) && /^(console\.\w+|\w*Error|log\w*|logger\.\w+)$/.test(q.expression.getText())) return;
      const pats = pat(n, cm).filter((p) => !/\/:[A-Za-z_]/.test(p));
      const metodo = metodoDe(n);
      const cuerpo = par && ts.isCallExpression(par) && par.arguments[0] === n ? clavesDelCuerpo(par) : undefined;
      const envolventes = nombresEnvolventes(n);
      for (const p of pats) for (const r of rutasEn(p)) consumidores.push({ file, line: lineOf(s, n), pattern: r, method: metodo, origen, cuerpo, envolventes });
    });
    walk(s, (n) => {
      if (!(ts.isCallExpression(n) && /^(apiRequest|fetch|window\.fetch)$/.test(n.expression.getText()) && n.arguments[0])) return;
      const a0 = n.arguments[0];
      const pats = pat(a0, cm); const rs = pats.flatMap(rutasEn);
      if (isStrNode(a0) && rs.length) return; // ya recogido arriba
      if (rs.length) { for (const r of rs) consumidores.push({ file, line: lineOf(s, n), pattern: r, method: metodoDe(a0), origen, cuerpo: clavesDelCuerpo(n), envolventes: nombresEnvolventes(n) }); }
      else ciegas.push({ file, line: lineOf(s, n), envolvente: nombresEnvolventes(n)[0] || '(nivel superior)' });
    });
  }
  for (const f of [...pubHtml, ...srcHtml]) {
    const html = files.get(f);
    const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi; let m, k = 0;
    while ((m = re.exec(html))) recogeUrls(f, sf(f, m[1], 'inline' + k++), f.startsWith('public/dashboard') ? 'front' : 'pagina');
    const re2 = /(?:href|action|src|data-[a-z-]+)\s*=\s*["']([^"']+)["']/gi;
    while ((m = re2.exec(html))) for (const r of rutasEn(m[1])) consumidores.push({ file: f, line: html.slice(0, m.index).split('\n').length, pattern: r, method: 'ANY', origen: 'html', envolventes: [] });
  }
  for (const f of pubJs) recogeUrls(f, sf(f), f.startsWith('public/dashboard') ? 'front' : 'pagina');
  for (const f of srcFiles) if (!DECLARACIONES.test(f)) recogeUrls(f, sf(f), 'servidor', routeLiteralNodes.get(f) || new Set());

  const cargados = new Set();
  for (const f of pubHtml) {
    const re = /<script[^>]*\bsrc=["']([^"']+)["']/gi; let m;
    while ((m = re.exec(files.get(f)))) {
      const src = m[1].split('?')[0];
      cargados.add(src.startsWith('/') ? 'public' + src : path.posix.normalize(path.posix.join(path.posix.dirname(f), src)));
    }
  }

  // fallo nº 2: emparejamiento SEGMENTO A SEGMENTO
  function segCasa(cp, rp) {
    const c = cp.replace(/\/+$/, '').split('/'), r = rp.replace(/\/+$/, '').split('/');
    for (let i = 0; i < c.length; i++) {
      const cs = c[i], rs = r[i];
      if (cs.includes('**')) return rs === undefined && i > 0 ? null : 'generico';
      if (rs === undefined) return null;
      const rParam = /^:/.test(rs);
      if (cs === '*') { if (!rParam) return null; continue; }
      if (rParam) continue;
      if (cs.includes('*')) { if (!new RegExp('^' + cs.split('*').map(esc).join('[^/]*') + '$').test(rs)) return null; continue; }
      if (cs !== rs) return null;
    }
    return c.length === r.length ? 'exacto' : null;
  }
  for (const r of routes) {
    const okM = (m) => m === 'ANY' || r.method === 'ALL' || m === r.method;
    r.externo = EXTERNOS.some((e) => e.test(r.path));
    r.exacto = consumidores.filter((x) => segCasa(x.pattern, r.path) === 'exacto' && okM(x.method));
    r.generico = consumidores.filter((x) => segCasa(x.pattern, r.path) === 'generico' && okM(x.method));
  }

  // ── Vistas del panel ──
  const appJs = 'public/dashboard/js/app.js';
  const casos = new Set(); const puertas = [];
  if (files.has(appJs)) walk(sf(appJs), (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.name.text === 'renderView')
      walk(n, (k) => { if (ts.isCaseClause(k) && ts.isStringLiteral(k.expression)) casos.add(k.expression.text); });
  });
  for (const f of pubJs.filter((x) => x.startsWith('public/dashboard'))) {
    const s = sf(f); const cm = constMap(s);
    walk(s, (n) => {
      if (ts.isCallExpression(n) && /(^|\.)(renderView|renderAppView)$/.test(n.expression.getText()) && n.arguments[0])
        for (const v of pat(n.arguments[0], cm)) puertas.push({ view: v, file: f, line: lineOf(s, n), via: 'llamada' });
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)) for (const p of pat(n, cm)) {
        let m; const re1 = /data-view=["']([a-z0-9-]+)["']/g; while ((m = re1.exec(p))) puertas.push({ view: m[1], file: f, line: lineOf(s, n), via: 'data-view' });
        const re2 = /href=["']#([^"'\s]+)/g; while ((m = re2.exec(p))) puertas.push({ view: m[1].split('/')[0], hash: m[1], file: f, line: lineOf(s, n), via: 'hash' });
      }
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && /location\.hash$/.test(n.left.getText()))
        for (const p of pat(n.right, cm)) puertas.push({ view: p.replace(/^#/, '').split('/')[0], hash: p.replace(/^#/, ''), file: f, line: lineOf(s, n), via: 'hash' });
    });
  }
  for (const f of pubHtml.filter((x) => x.startsWith('public/dashboard'))) {
    const html = files.get(f); let m; const re = /data-view=["']([a-z0-9-]+)["']/g;
    while ((m = re.exec(html))) puertas.push({ view: m[1], file: f, line: html.slice(0, m.index).split('\n').length, via: 'data-view' });
  }
  const htmlIds = new Set(); for (const f of pubHtml) { let m; const re = /\bid=["']([^"']+)["']/g; while ((m = re.exec(files.get(f)))) htmlIds.add(m[1]); }

  // ── Funciones del panel sin llamador y window.X sin uso ──
  const funcionesMuertas = new Set(); const piezasFront = [];
  for (const f of pubJs.filter((x) => x.startsWith('public/dashboard/js'))) {
    const s = sf(f);
    for (const st of s.statements) {
      if (!(ts.isFunctionDeclaration(st) && st.name)) continue;
      const name = st.name.text;
      let propias = 0; walk(s, (n) => { if (ts.isIdentifier(n) && n.text === name) propias++; });
      const fuera = (tokensFront.get(name) || 0) - propias;
      let usos = 0;
      walk(s, (n) => {
        if (!ts.isIdentifier(n) || n.text !== name || n.parent === st) return;
        const p = n.parent;
        if (ts.isPropertyAccessExpression(p) && p.name === n && /^window$/.test(p.expression.getText()) && ts.isBinaryExpression(p.parent) && p.parent.left === p) return;
        if (ts.isBinaryExpression(p) && p.right === n && /^window\.|exports/.test(p.left.getText())) return;
        if (ts.isShorthandPropertyAssignment(p) || (ts.isPropertyAssignment(p) && p.initializer === n)) {
          let q = p.parent; while (q && !ts.isBinaryExpression(q)) q = q.parent;
          if (q && /module\.exports/.test(q.left.getText())) return;
        }
        if (ts.isPropertyAccessExpression(p) && p.name === n && /exports/.test(p.expression.getText())) return;
        usos++;
      });
      if (fuera === 0 && usos === 0) {
        funcionesMuertas.add(f + '::' + name);
        piezasFront.push({ tipo: 'front-funcion', clave: `front-funcion · ${f}::${name}`, donde: `${f}:${lineOf(s, st)}`, soloTests: testTokens.has(name) });
      }
    }
    walk(s, (n) => {
      if (!ts.isBinaryExpression(n) || n.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return;
      const m = /^window\.([A-Za-z_$][\w$]*)$/.exec(n.left.getText()); if (!m) return;
      const name = m[1]; if (/^[A-Z_]+$/.test(name)) return;
      if ([...pubJs, ...pubHtml].some((g) => g !== f && tokensDe.get(g).has(name))) return;
      const local = ts.isIdentifier(n.right) ? n.right.text : null;
      let usos = 0;
      walk(s, (k) => {
        if (ts.isCallExpression(k)) { const t = k.expression.getText().replace(/^window\./, ''); if (t === name || (local && t === local)) usos++; }
        if (local && ts.isIdentifier(k) && k.text === local && k.parent !== n && !(ts.isFunctionDeclaration(k.parent) && k.parent.name === k)
          && !ts.isCallExpression(k.parent) && !(ts.isPropertyAccessExpression(k.parent) && k.parent.name === k)
          && !(ts.isBinaryExpression(k.parent) && k.parent.right === k && /exports|window\./.test(k.parent.left.getText()))
          && !ts.isShorthandPropertyAssignment(k.parent) && !ts.isPropertyAssignment(k.parent)) usos++;
      });
      if (usos) return;
      funcionesMuertas.add(f + '::' + name); if (local) funcionesMuertas.add(f + '::' + local);
      if (!piezasFront.some((p) => p.clave === `front-funcion · ${f}::${name}`))
        piezasFront.push({ tipo: 'front-window', clave: `front-window · ${f}::${name}`, donde: `${f}:${lineOf(s, n)}`, soloTests: testTokens.has(name) });
    });
  }

  // ── Exportaciones del servidor sin importador ──
  const exportsOf = new Map();
  for (const f of srcFiles) {
    const s = sf(f); const out = [];
    for (const st of s.statements) {
      const mods = ts.canHaveModifiers(st) ? ts.getModifiers(st) || [] : [];
      if (!mods.some((x) => x.kind === ts.SyntaxKind.ExportKeyword)) continue;
      if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name) out.push({ name: st.name.text, line: lineOf(s, st) });
      else if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) out.push({ name: d.name.text, line: lineOf(s, st) });
    }
    exportsOf.set(f, out);
  }
  // SCRUM-1192 · «tiene consumidor» no es «tiene consumidor VIVO». Sólo cuenta el import de un
  // fichero ALCANZABLE desde la raíz de producción (`start: node dist/index.js`). Antes,
  // `huecosSerie.ts::huecosDeLaSerie` salía viva porque la importa `albaranSerie.ts`, y a ése no lo
  // importa nadie. Sin raíz en el árbol (los árboles fabricados de los tests) no hay alcance que
  // medir y cuenta todo: el SUELO del test exige `alcanzables` en el árbol real.
  const alcanzables = files.has(RAIZ) ? alcanceDesde(RAIZ) : null;
  const vivo = (f) => !alcanzables || alcanzables.has(f);
  const usados = new Set(); const dinamicos = new Set(); const reexportStar = new Map();
  for (const f of srcFiles) {
    if (!vivo(f)) continue;
    const s = sf(f);
    for (const [loc, v] of importsOf(f)) {
      if (v.name === '*') walk(s, (n) => { if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === loc) usados.add(v.file + '::' + n.name.text); });
      else usados.add(v.file + '::' + v.name);
    }
    for (const st of s.statements) if (ts.isExportDeclaration(st) && st.moduleSpecifier) {
      const tgt = resolveImport(f, st.moduleSpecifier.text); if (!tgt) continue;
      if (!st.exportClause) reexportStar.set(f, [...(reexportStar.get(f) || []), tgt]);
      else if (ts.isNamedExports(st.exportClause)) for (const el of st.exportClause.elements) usados.add(tgt + '::' + (el.propertyName || el.name).text);
    }
    walk(s, (n) => { if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) { const t = resolveImport(f, n.arguments[0].text); if (t) dinamicos.add(t); } });
  }
  for (const [barrel, tgts] of reexportStar) for (const t of tgts) for (const e of exportsOf.get(t) || []) if (usados.has(barrel + '::' + e.name)) usados.add(t + '::' + e.name);
  const piezasExport = [];
  for (const [f, exs] of exportsOf) {
    if (dinamicos.has(f) || f === 'src/index.ts' || DECLARACIONES.test(f)) continue;
    const s = sf(f);
    for (const e of exs) {
      if (usados.has(f + '::' + e.name)) continue;
      let propias = 0; walk(s, (n) => { if (ts.isIdentifier(n) && n.text === e.name) propias++; });
      if (propias > 1) continue;
      piezasExport.push({ tipo: 'export', clave: `export · ${f}::${e.name}`, donde: `${f}:${e.line}`, soloTests: testTokens.has(e.name) });
    }
  }

  // ── Piezas ──
  const piezas = [];
  for (const r of routes) {
    if (r.externo) continue;
    const id = `${r.method} ${r.path}`;
    if (!r.exacto.length) {
      if (r.generico.length) piezas.push({ tipo: 'ciega', clave: `ciega-ruta-generica · ${id}`, donde: `${r.file}:${r.line}`, detalle: `solo la casa un llamador genérico: ${r.generico.map((x) => `${x.file}:${x.line} ${x.pattern}`).join(' ; ')}` });
      else piezas.push({ tipo: 'ruta', clave: `ruta · ${id}`, donde: `${r.file}:${r.line}` });
      continue;
    }
    const vivos = r.exacto.filter((x) => !(x.origen === 'front' && (!cargados.has(x.file) || (x.envolventes || []).some((e) => funcionesMuertas.has(x.file + '::' + e)))));
    if (!vivos.length) piezas.push({ tipo: 'ruta-inalcanzable', clave: `ruta-inalcanzable · ${id}`, donde: `${r.file}:${r.line}`, detalle: r.exacto.map((x) => `${x.file}:${x.line}`).join(' ') });
    if (r.cuerpoLeido.ciego) piezas.push({ tipo: 'ciega', clave: `ciega-lector-cuerpo · ${id}`, donde: `${r.file}:${r.line}`, detalle: 'el handler pasa el cuerpo entero a otra función' });
    const llam = r.exacto.filter((x) => x.origen !== 'servidor' && x.cuerpo !== undefined);
    if (llam.length && r.cuerpoLeido.ks.length) {
      const mandadas = new Set(llam.flatMap((x) => x.cuerpo ? [...x.cuerpo.ks] : []));
      let sin = r.cuerpoLeido.ks.filter((k) => !mandadas.has(k));
      if (llam.some((x) => !x.cuerpo || x.cuerpo.ciego)) {
        const fs = new Set();
        for (const x of r.exacto.filter((y) => y.origen !== 'servidor')) {
          fs.add(x.file);
          const env = (x.envolventes || [])[0];
          if (env) for (const g of pubJs) if (tokensDe.get(g).has(env)) fs.add(g);
        }
        sin = sin.filter((k) => ![...fs].some((g) => (tokensDe.get(g) || new Set()).has(k)));
      }
      for (const k of sin) piezas.push({ tipo: 'cuerpo', clave: `cuerpo · ${id}::${k}`, donde: `${r.file}:${r.line}` });
    }
  }
  for (const v of casos) {
    const n = puertas.filter((p) => p.view === v && !(p.file === appJs && p.via === 'hash')).length;
    if (!n) piezas.push({ tipo: 'vista', clave: `vista-sin-puerta · ${v}`, donde: `${appJs}` });
  }
  for (const p of puertas) {
    if (p.via === 'hash' && !casos.has(p.view) && !htmlIds.has(p.view) && p.hash !== '' && p.hash !== undefined)
      piezas.push({ tipo: 'enlace', clave: `enlace-sin-caso · ${p.file}::#${p.hash}`, donde: `${p.file}:${p.line}` });
    if (p.via === 'llamada' && p.view !== '*' && !casos.has(p.view))
      piezas.push({ tipo: 'enlace', clave: `destino-sin-caso · ${p.file}::${p.view}`, donde: `${p.file}:${p.line}` });
  }
  const vistasCiegas = new Map();
  for (const c of ciegas) { const k = `ciega-llamada-opaca · ${c.file}::${c.envolvente}`; if (!vistasCiegas.has(k)) vistasCiegas.set(k, `${c.file}:${c.line}`); }
  for (const [k, d] of vistasCiegas) piezas.push({ tipo: 'ciega', clave: k, donde: d, detalle: 'llamada de red sin ningún literal de ruta' });
  for (const r of routerSinMontar) piezas.push({ tipo: 'ciega', clave: `ciega-router-sin-montar · ${r}`, donde: r.split('::')[0] });
  piezas.push(...piezasFront, ...piezasExport);

  // quitar duplicados de clave (una pieza puede salir por dos caminos)
  const vistas = new Map(); for (const p of piezas) if (!vistas.has(p.clave)) vistas.set(p.clave, p);
  return {
    poblacion: {
      ficherosSrc: srcFiles.length, ficherosPublicJs: pubJs.length, html: pubHtml.length + srcHtml.length,
      rutas: routes.length, rutasExternas: routes.filter((r) => r.externo).length, consumidores: consumidores.length,
      alcanzables: alcanzables ? srcFiles.filter((f) => alcanzables.has(f)).length : null,
      vistas: casos.size, puertas: puertas.length, exportaciones: [...exportsOf.values()].reduce((a, b) => a + b.length, 0),
    },
    piezas: [...vistas.values()].sort((a, b) => a.clave.localeCompare(b.clave)),
  };
}

// ── CLI ────────────────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const i = process.argv.indexOf('--ref');
  const arbol = i > 0 ? cargarCommit(process.argv[i + 1]) : cargarArbol('.');
  const c = censar(arbol);
  console.log('población:', JSON.stringify(c.poblacion));
  if (process.argv.includes('--declarar')) {
    for (const p of c.piezas) console.log('    ' + JSON.stringify({ clave: p.clave, donde: p.donde, carril: '?', ticket: '?' }) + ',');
  } else {
    for (const p of c.piezas) console.log(`${p.clave}  (${p.donde})${p.detalle ? '  ' + p.detalle : ''}${p.soloTests ? '  [solo tests]' : ''}`);
  }
  console.log(`\n${c.piezas.length} piezas sin consumir o ciegas.\nLO QUE NO VE:\n- ${LIMITES.join('\n- ')}`);
}
