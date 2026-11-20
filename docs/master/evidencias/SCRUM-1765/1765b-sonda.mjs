// Sonda J6 · SCRUM-1765b: los bancos que `scrum1387` tiene FUERA, uno a uno: ¿qué anclas declaran sus
// guiones, siguen vivas en el árbol, y alguna ya está en el catálogo (`MUTACIONES_QUE_ME_TUMBAN`)?
//
//   node docs/master/evidencias/SCRUM-1765/1765b-sonda.mjs [--sin-control]
//
// NO aplica ninguna mutación: solo LEE (no es un banco). Generaliza la de SCRUM-1387y
// (`evidencias/SCRUM-1387/1387y/sonda-bancos.mjs`, que sabía leer tres guiones a mano).
// · Población: la MISMA del guard, con sus funciones (`leerFicherosDeMutacion` + `clasificar` de
//   `tests/_catalogo-obligatorio.mjs`); aquí no se decide qué es banco ni qué está fuera.
// · Anclas: se leen por AST (TypeScript del árbol), no por regex: propiedades `de`/`buscar`/`desde`/`antes`
//   con valor de texto, primer argumento de `cambiar(…)`/`.replace(…)`. Lo que no es texto fijo (plantilla
//   con `${}`, regex, función) cuenta como ILEGIBLE, no como muerta.
// · Estado de un ancla: VIVA (1 vez en su fichero), AMBIGUA (más de 1), MOVIDA (0 en su fichero pero está
//   en otro), MUERTA (0 en todo el corpus), SIN-FICHERO (no se pudo resolver su fichero: se busca en todo
//   el corpus y se dice cuántos). El corpus excluye las carpetas de evidencias: si no, el propio guion
//   haría viva toda ancla. `dist/` entra si existe: la sonda dice si lo vio.
// · Control positivo SEMBRADO (no tomado del árbol): un guion fabricado en memoria con un ancla copiada del
//   catálogo de `scrum1387` (tiene que salir VIVA y «en catálogo») y otra inventada (tiene que salir
//   MUERTA). Con `--sin-control` no se siembra, y la sonda tiene que decir CIEGO y salir 2.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const SIN_CONTROL = process.argv.includes('--sin-control');
const ts = createRequire(path.join(RAIZ, 'package.json'))('typescript');
const { leerFicherosDeMutacion, clasificar } = await import(pathToFileURL(path.join(RAIZ, 'tests/_catalogo-obligatorio.mjs')).href);

// ── Población (la del guard) ────────────────────────────────────────────────────────────────────────
const fichs = leerFicherosDeMutacion(RAIZ);
const { ficheros, bancos, fuera } = clasificar(fichs);

// ── Corpus donde se buscan las anclas ───────────────────────────────────────────────────────────────
const EXT = /\.(ts|mjs|js|cjs|json|md|html|css|yml|yaml|txt|sql|prisma)$/;
const corpus = new Map();
const andar = (rel) => {
  const abs = path.join(RAIZ, rel);
  if (!fs.existsSync(abs)) return;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const r = rel + '/' + e.name;
    if (e.isDirectory()) {
      if (['node_modules', '.git', 'evidencias'].includes(e.name)) continue;
      andar(r);
    } else if (EXT.test(e.name)) corpus.set(r, fs.readFileSync(path.join(RAIZ, r), 'utf8'));
  }
};
for (const d of ['src', 'scripts', 'tests', 'public', 'dist', 'prisma', 'docs', '.claude', '.github']) andar(d);
const hayDist = [...corpus.keys()].some((k) => k.startsWith('dist/'));
const veces = (texto, de) => {
  const a = texto.split(de).length - 1;
  const b = de.includes('\n') ? texto.split(de.split('\n').join('\r\n')).length - 1 : 0;
  return Math.max(a, b);
};

// ── Catálogo: la región de MUTACIONES_QUE_ME_TUMBAN de cada test ──────────────────────────────────────
const regiones = [];
for (const [k, t] of corpus) {
  if (!/^tests\/[^/]+\.test\.mjs$/.test(k)) continue;
  const i = t.indexOf('export const MUTACIONES_QUE_ME_TUMBAN');
  if (i < 0) continue;
  const j = t.indexOf('\n];', i);
  regiones.push([k, t.slice(i, j < 0 ? undefined : j)]);
}
const enCatalogo = (de) => {
  const formas = [JSON.stringify(de).slice(1, -1), de.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n'), de];
  return regiones.filter(([, r]) => formas.some((f) => f.length && r.includes(f))).map(([k]) => k);
};

// ── Lectura de un guion por AST ───────────────────────────────────────────────────────────────────────
const CLAVE_DE = new Set(['de', 'buscar', 'desde', 'antes']);
const CLAVE_F = new Set(['f', 'fichero', 'file', 'ruta', 'sujeto', 'archivo', 'path']);
const CLAVE_ID = new Set(['id', 'nombre', 'name']);
function leerGuion(rel, texto) {
  const sf = ts.createSourceFile(rel, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const consts = new Map();
  const valor = (n) => {
    if (!n) return undefined;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
    if (ts.isParenthesizedExpression(n)) return valor(n.expression);
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const a = valor(n.left); const b = valor(n.right);
      return typeof a === 'string' && typeof b === 'string' ? a + b : undefined;
    }
    if (ts.isIdentifier(n) && consts.has(n.text)) return consts.get(n.text);
    return undefined;
  };
  const visitarConsts = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      const v = valor(n.initializer);
      if (typeof v === 'string') consts.set(n.name.text, v);
    }
    ts.forEachChild(n, visitarConsts);
  };
  visitarConsts(sf);
  const anclas = []; let ilegibles = 0;
  const visitar = (n) => {
    if (ts.isObjectLiteralExpression(n)) {
      const props = new Map();
      for (const p of n.properties) if (ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) props.set(p.name.text, p.initializer);
      const kDe = [...props.keys()].find((k) => CLAVE_DE.has(k));
      if (kDe) {
        const de = valor(props.get(kDe));
        const kF = [...props.keys()].find((k) => CLAVE_F.has(k));
        const kId = [...props.keys()].find((k) => CLAVE_ID.has(k));
        if (typeof de === 'string' && de.length) anclas.push({ id: kId ? String(valor(props.get(kId)) ?? '?') : '?', fichero: kF ? valor(props.get(kF)) : undefined, de, via: 'prop ' + kDe });
        else ilegibles += 1;
      }
    }
    if (ts.isCallExpression(n) && n.arguments.length >= 1) {
      const nombre = ts.isIdentifier(n.expression) ? n.expression.text : ts.isPropertyAccessExpression(n.expression) ? n.expression.name.text : '';
      if (nombre === 'cambiar' || nombre === 'replace' || nombre === 'replaceAll') {
        const de = valor(n.arguments[0]);
        if (typeof de === 'string' && de.length) anclas.push({ id: nombre + '()', fichero: undefined, de, via: nombre + '()' });
        else if (nombre === 'cambiar') ilegibles += 1;
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  // Rutas que el guion nombra: sirven de ficheros candidatos cuando el ancla no declara el suyo.
  const rutas = [...new Set([...consts.values(), ...(texto.match(/['"`]((?:src|scripts|tests|public|dist|docs|prisma)\/[^'"`\s]+)['"`]/g) || []).map((s) => s.slice(1, -1))])]
    .filter((r) => corpus.has(r));
  return { anclas, ilegibles, rutas };
}

function estado(a, rutas) {
  const sitios = [...corpus].filter(([, t]) => t.includes(a.de) || (a.de.includes('\n') && t.includes(a.de.split('\n').join('\r\n')))).map(([k]) => k);
  const cat = enCatalogo(a.de);
  const corta = a.de.trim().length < 8;
  if (typeof a.fichero === 'string' && corpus.has(a.fichero)) {
    const n = veces(corpus.get(a.fichero), a.de);
    const e = n === 1 ? 'VIVA' : n > 1 ? 'AMBIGUA' : sitios.length ? 'MOVIDA' : 'MUERTA';
    return { e, donde: a.fichero + (n ? ` ×${n}` : ''), sitios, cat, corta };
  }
  const enRutas = rutas.filter((r) => veces(corpus.get(r), a.de) > 0);
  if (enRutas.length === 1) {
    const n = veces(corpus.get(enRutas[0]), a.de);
    return { e: n === 1 ? 'VIVA' : 'AMBIGUA', donde: enRutas[0] + ` ×${n} (por las rutas del guion)`, sitios, cat, corta };
  }
  if (enRutas.length > 1) return { e: 'AMBIGUA', donde: `${enRutas.length} rutas del guion`, sitios, cat, corta };
  return { e: sitios.length ? 'SIN-FICHERO' : 'MUERTA', donde: sitios.length ? `en ${sitios.length} fichero(s) del corpus` : '—', sitios, cat, corta };
}

// ── Recorrido ─────────────────────────────────────────────────────────────────────────────────────────
const salida = [];
const di = (s) => salida.push(s);
di(`POBLACIÓN · ${ficheros} ficheros con «mut» · ${bancos.length} bancos · ${fuera.length} fuera (las funciones de tests/_catalogo-obligatorio.mjs)`);
di(`CORPUS · ${corpus.size} ficheros (src, scripts, tests, public, dist, prisma, docs sin evidencias, .claude, .github) · dist/ ${hayDist ? 'VISTO' : 'NO EXISTE: las anclas sobre dist/ saldrán MUERTAS o SIN-FICHERO sin serlo'} · catálogos: ${regiones.length} tests`);
const lista = fuera.map((b) => ({ carpeta: b.carpeta, guiones: b.guiones.map((g) => ({ rel: g, texto: fs.readFileSync(path.join(RAIZ, g), 'utf8') })) }));

// Control sembrado: un ancla del catálogo de scrum1387 (derivada aquí, no escrita a mano) y una inventada.
let control = null;
if (!SIN_CONTROL) {
  const r1387 = regiones.find(([k]) => k === 'tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs');
  const m = r1387 && r1387[1].match(/fichero: '([^']+)',\s*de: '((?:[^'\\]|\\.)+)'/);
  const de = m ? eval(`'${m[2]}'`) : null;
  const inventada = ['__1765b', 'ancla', 'sembrada', 'que', 'no', 'existe__'].join('_');
  control = { de, fichero: m && m[1], inventada };
  lista.push({ carpeta: '(CONTROL SEMBRADO)', guiones: [{ rel: '(en memoria)', texto: `const M = [{ id: 'C+', fichero: ${JSON.stringify(m && m[1])}, de: ${JSON.stringify(de)} }, { id: 'C-', fichero: 'tests/_catalogo-obligatorio.mjs', de: ${JSON.stringify(inventada)} }];` }] });
}

const tot = { VIVA: 0, AMBIGUA: 0, MOVIDA: 0, MUERTA: 0, 'SIN-FICHERO': 0 };
let ilegTot = 0; let catTot = 0; let anclasTot = 0; let controlOk = false;
for (const b of lista) {
  const esControl = b.carpeta === '(CONTROL SEMBRADO)';
  const filas = []; const cuenta = { VIVA: 0, AMBIGUA: 0, MOVIDA: 0, MUERTA: 0, 'SIN-FICHERO': 0 }; let ileg = 0; let cat = 0;
  for (const g of b.guiones) {
    const { anclas, ilegibles, rutas } = leerGuion(g.rel, g.texto);
    ileg += ilegibles;
    for (const a of anclas) {
      const s = estado(a, rutas);
      cuenta[s.e] += 1; if (s.cat.length) cat += 1;
      filas.push(`    · ${path.basename(g.rel)} · ${a.id.slice(0, 50)} · ${s.e}${s.corta ? ' (ancla corta)' : ''} · ${s.donde}${s.cat.length ? ' · EN CATÁLOGO: ' + s.cat.join(', ') : ''}`);
      if (esControl) {
        if (a.id === 'C+') controlOk = s.e === 'VIVA' && s.cat.includes('tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs');
        if (a.id === 'C-') controlOk = controlOk && s.e === 'MUERTA';
      }
    }
  }
  const n = filas.length;
  if (!esControl) { for (const k in tot) tot[k] += cuenta[k]; ilegTot += ileg; catTot += cat; anclasTot += n; }
  di(`\n${b.carpeta} · guiones: ${b.guiones.map((g) => path.basename(g.rel)).join(', ')} · anclas ${n} · VIVA ${cuenta.VIVA} · AMBIGUA ${cuenta.AMBIGUA} · MOVIDA ${cuenta.MOVIDA} · MUERTA ${cuenta.MUERTA} · SIN-FICHERO ${cuenta['SIN-FICHERO']} · ilegibles ${ileg} · en catálogo ${cat}`);
  if (n === 0) di('    (la sonda no leyó ninguna ancla de texto fijo: el guion muta por función, regex o sobre dist/ por plantilla; NO es «sin mutaciones»)');
  for (const f of filas) di(f);
}
di(`\nTOTAL (sin el control) · ${fuera.length} bancos · ${anclasTot} anclas · VIVA ${tot.VIVA} · AMBIGUA ${tot.AMBIGUA} · MOVIDA ${tot.MOVIDA} · MUERTA ${tot.MUERTA} · SIN-FICHERO ${tot['SIN-FICHERO']} · ilegibles ${ilegTot} · en catálogo ${catTot}`);
let codigo;
if (SIN_CONTROL) { di('CIEGO · sin control sembrado (--sin-control): esta salida no distingue «no hay» de «no sé mirar»'); codigo = 2; }
else if (!controlOk) { di(`CIEGO · el control sembrado NO salió como debía (C+ VIVA y en catálogo de scrum1387; C- MUERTA): ${JSON.stringify(control).slice(0, 200)}`); codigo = 2; }
else if (anclasTot === 0) { di('CIEGO · cero anclas leídas en toda la población'); codigo = 2; }
else { di('CONTROL SEMBRADO · C+ VIVA y en catálogo · C- MUERTA → la sonda ve'); codigo = 0; }
di('EXIT=' + codigo);
console.log(salida.join('\n'));
process.exitCode = codigo;
