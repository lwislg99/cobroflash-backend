// SCRUM-1194 · «el servidor acepta un VALOR que la pantalla no ofrece» — medición de un solo uso.
//
// NO es un guard ni un segundo instrumento: reutiliza la sonda de SCRUM-1185
// (`scripts/_censo-sin-consumir.mjs`, de Luis) para rutas, montajes y llamadores, sobre una COPIA
// parcheada en memoria que sólo añade dos cosas: los identificadores de cada handler (`ids`) y que
// `censar` devuelva sus rutas. Si alguna ancla del parche no casa UNA vez, sale CIEGO (exit 2).
//
// LA FORMA (el caso vivo es SCRUM-1136): un VOCABULARIO cerrado del servidor —`z.enum([...])` o un
// array constante de ≥2 literales— que una ruta acepta, y del que las pantallas que llaman a ESA
// ruta no nombran algunos valores. 1185 mira CLAVES del cuerpo; esto mira VALORES.
//
// Uso: node censo-vocabulario.mjs <raíz del repo> [--todo] [--sin-siembra]
// Salidas: 0 medido (haya o no hallazgos) · 2 CIEGO (el parche no casa, o falla un control SEMBRADO).
// Desde el 23-oct-2026 los controles se siembran en memoria (§1bis): el positivo del 28-sep era el
// propio SCRUM-1136 del árbol, y se quedó CIEGO el día que #1939 lo arregló.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(process.argv[2] || '.');
const ts = createRequire(path.join(RAIZ, 'package.json'))('typescript');
const ciego = (m) => { console.log(`\n🔴 CIEGO — ${m}`); process.exit(2); };

// ── 1 · la sonda de 1185, parcheada en una copia ─────────────────────────────────────────────
let fuente = fs.readFileSync(path.join(RAIZ, 'scripts/_censo-sin-consumir.mjs'), 'utf8');
const parche = (a, b, q) => { if (fuente.split(a).length !== 2) ciego(`el ancla «${q}» no casa una vez en la sonda de 1185 (¿cambió?)`); fuente = fuente.replace(a, b); };
parche('cuerpoLeido: clavesLeidas(n) });', "cuerpoLeido: clavesLeidas(n), ids: (() => { const x = new Set(); const w = (m) => { if (ts.isIdentifier(m)) x.add(m.text); ts.forEachChild(m, w); }; w(n); return [...x]; })() });", 'routeDefs.push');
parche('    poblacion: {', '    rutasInternas: routes,\n    poblacion: {', 'return poblacion');
// La copia vive FUERA del árbol (un temporal dentro del repo fue el rojo intermitente de SCRUM-824)
// y se borra en cuanto se ha importado.
const dirCopia = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1194-'));
let sonda;
try {
  const copia = path.join(dirCopia, 'sonda-1185-parcheada.mjs');
  fs.writeFileSync(copia, fuente.replace("from 'typescript'", `from ${JSON.stringify(pathToFileURL(createRequire(path.join(RAIZ, 'package.json')).resolve('typescript')).href)}`));
  sonda = await import(pathToFileURL(copia).href);
} finally {
  fs.rmSync(dirCopia, { recursive: true, force: true });
}
const cwd = process.cwd(); process.chdir(RAIZ);
const arbol = sonda.cargarArbol('.');

// ── 1bis · la SIEMBRA (23-oct-2026) ───────────────────────────────────────────────────────────
// Hasta aquí el control positivo era el propio SCRUM-1136 del árbol, y el día que #1939 lo
// arregló la medición se quedó CIEGA. Ahora el positivo lo fabrica el instrumento, en memoria
// (nada se escribe en el árbol), con la pareja del ejemplo del ticket: el servidor acepta los 12
// valores de `CAMPOS_CLIENTE` y la pantalla ofrece los 4 de `csvImport.js:162` antes de #1939.
// Su gemela ofrece los 12: es el control que NO tiene que casar. Entra por el camino real de la
// sonda de 1185 (montaje en app.ts, `fetch` con cuerpo), no por un atajo.
// `--sin-siembra` la quita: la medición TIENE que salir CIEGO (exit 2), no verde.
const SIEMBRA = 'src/__siembra1194__/';
const DOCE = ['name', 'phone', 'mobile', 'email', 'notes', 'taxId', 'tags', 'billingAddress', 'billingCity', 'billingPostalCode', 'billingProvince', 'billingCountry'];
const CUATRO = ['name', 'phone', 'email', 'notes'];
if (!process.argv.includes('--sin-siembra')) {
  const f = arbol.files;
  if (!f.has('src/app.ts')) ciego('no hay src/app.ts donde montar la siembra');
  f.set(SIEMBRA + 'campos.ts', `export const CAMPOS_SIEMBRA_1194 = ${JSON.stringify(DOCE)} as const;\nexport type CampoSiembra1194 = (typeof CAMPOS_SIEMBRA_1194)[number];\n`);
  const handler = `(req, res) => { const mapeo = req.body.mapeo as Record<string, CampoSiembra1194>; res.json({ mapeo }); }`;
  f.set(SIEMBRA + 'siembra.routes.ts', `import { Router } from 'express';\nimport type { CampoSiembra1194 } from './campos';\nexport const siembraRouter1194 = Router();\nsiembraRouter1194.post('/parcial', ${handler});\nsiembraRouter1194.post('/completo', ${handler});\n`);
  f.set('src/app.ts', f.get('src/app.ts') + `\nimport { siembraRouter1194 } from './__siembra1194__/siembra.routes';\napp.use('/__siembra1194', siembraRouter1194);\n`);
  // Nombre de envoltorio ÚNICO por pantalla: con `enviar` en las dos, el salto por envoltorio
  // (que casa por NOMBRE) metía la gemela como llamadora de la parcial y el positivo salía
  // «ofrece todo». Medido el 23-oct; el cubo `soloPorEnvoltorio` mide lo mismo en el árbol real.
  const pantalla = (ruta, ofrece) => `const CAMPOS = ${JSON.stringify(ofrece.map((v) => [v, v]))};\nfunction enviar_${ruta}_1194(fichero, codificacion, mapeo) { return fetch('/__siembra1194/${ruta}', { method: 'POST', body: JSON.stringify({ fichero, codificacion, mapeo }) }); }\n`;
  f.set('public/__siembra1194__/parcial.js', pantalla('parcial', CUATRO));
  f.set('public/__siembra1194__/completo.js', pantalla('completo', DOCE));
}
const sembrado = (x) => x.v.file.startsWith(SIEMBRA) || x.r.file.startsWith(SIEMBRA);

const censo = sonda.censar(arbol);
process.chdir(cwd);
const rutas = censo.rutasInternas;
if (!Array.isArray(rutas) || !rutas.length) ciego('la sonda no devolvió rutas');

// ── 2 · vocabularios del servidor ─────────────────────────────────────────────────────────────
const parse = (f, txt, kind) => ts.createSourceFile(f, txt, ts.ScriptTarget.Latest, true, kind);
const lits = (arr) => (ts.isArrayLiteralExpression(arr) && arr.elements.length >= 2 && arr.elements.every((e) => ts.isStringLiteral(e)))
  ? arr.elements.map((e) => e.text) : null;
const vocab = []; // { file, nombre, valores }
const exportsDe = new Map(); // file → Map(nombreExportado → Set(identificadores de su cuerpo))
for (const [f, txt] of arbol.files) {
  if (!f.startsWith('src/') || !f.endsWith('.ts')) continue;
  const s = parse(f, txt, ts.ScriptKind.TS);
  const ex = new Map(); exportsDe.set(f, ex);
  const idsDe = (n) => { const x = new Set(); const w = (m) => { if (ts.isIdentifier(m)) x.add(m.text); ts.forEachChild(m, w); }; w(n); return x; };
  for (const st of s.statements) {
    const exportado = st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (ts.isFunctionDeclaration(st) && st.name && exportado) ex.set(st.name.text, idsDe(st));
    // Un TIPO derivado del vocabulario (`type CampoCliente = typeof CAMPOS_CLIENTE[number]`) ES el
    // vocabulario: el handler de 1136 no nombra el array, nombra su tipo.
    if ((ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st)) && exportado) ex.set(st.name.text, idsDe(st));
    if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || !d.initializer) continue;
      if (exportado) ex.set(d.name.text, idsDe(d));
      let ini = d.initializer; if (ts.isAsExpression(ini)) ini = ini.expression;
      const v = lits(ini); if (v) vocab.push({ file: f, nombre: d.name.text, valores: v });
    }
  }
  // z.enum([...]) en cualquier sitio: se nombra por la variable o propiedad que lo contiene.
  const w = (n, dueño) => {
    let d = dueño;
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) d = n.name.text;
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'enum' && n.arguments[0]) {
      const v = lits(n.arguments[0]); if (v && d) vocab.push({ file: f, nombre: d, valores: v, zod: true });
    }
    ts.forEachChild(n, (m) => w(m, d));
  };
  w(s, null);
}

// ── 3 · vocabulario → rutas que lo usan (directo, o por UN salto de import) ──────────────────
const rutasDe = (v) => rutas.filter((r) => {
  const ids = new Set(r.ids || []);
  if (ids.has(v.nombre)) return true;
  for (const [n, cuerpo] of exportsDe.get(v.file) || []) if (ids.has(n) && cuerpo.has(v.nombre)) return true;
  return false;
});

// ── 4 · qué VALORES nombra cada pantalla llamadora ────────────────────────────────────────────
const tokensCache = new Map();
function tokens(file) {
  if (tokensCache.has(file)) return tokensCache.get(file);
  const txt = arbol.files.get(file); const out = new Set();
  if (txt == null) { tokensCache.set(file, null); return null; }
  const conValue = (t) => { for (const m of t.matchAll(/value\s*=\s*["']([^"']+)["']/g)) out.add(m[1]); };
  if (file.endsWith('.html')) { conValue(txt); tokensCache.set(file, out); return out; }
  const s = parse(file, txt, ts.ScriptKind.JS);
  const w = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) { out.add(n.text); conValue(n.text); }
    if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) conValue(n.text);
    if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name)) out.add(n.name.text); // { taxId: … } manda la clave
    if (ts.isShorthandPropertyAssignment(n)) out.add(n.name.text);
    ts.forEachChild(n, w);
  };
  w(s); tokensCache.set(file, out); return out;
}

// Identificadores de cada fichero del front, para seguir UN salto por envoltorio: si la llamada a
// la ruta vive dentro de `createCustomer` (en `api.js`), las pantallas que llaman a `createCustomer`
// también son llamadoras.
const idsFront = new Map();
for (const [f, txt] of arbol.files) {
  if (!f.startsWith('public/') || !f.endsWith('.js')) continue;
  const x = new Set(); const w = (m) => { if (ts.isIdentifier(m)) x.add(m.text); ts.forEachChild(m, w); };
  w(parse(f, txt, ts.ScriptKind.JS)); idsFront.set(f, x);
}
function llamadoresDe(r) {
  const directos = (r.exacto || []).filter((x) => x.origen !== 'servidor');
  const files = new Set(directos.map((x) => x.file)); let porEnvoltorio = 0;
  for (const x of directos) {
    const e = (x.envolventes || [])[0]; if (!e) continue;
    for (const [f, ids] of idsFront) if (f !== x.file && ids.has(e) && !files.has(f)) { files.add(f); porEnvoltorio++; }
  }
  return { files: [...files], porEnvoltorio, directos: [...new Set(directos.map((x) => x.file))] };
}

// ── 5 · el censo ──────────────────────────────────────────────────────────────────────────────
const filas = []; const sinRuta = []; const sinPantalla = []; const salida = [];
for (const v of vocab) {
  const rs = rutasDe(v);
  if (!rs.length) { sinRuta.push(v); continue; }
  for (const r of rs) {
    // Un GET no ACEPTA un valor del vocabulario: lo DEVUELVE. No es la forma de 1194.
    if (r.method === 'GET') { salida.push({ v, r }); continue; }
    const { files: llamadores, porEnvoltorio, directos } = llamadoresDe(r);
    if (!llamadores.length) { sinPantalla.push({ v, r }); continue; }
    const ts_ = llamadores.map(tokens);
    if (ts_.some((t) => t === null)) { filas.push({ v, r, llamadores, veredicto: 'NO PUDE MEDIR', faltan: [] }); continue; }
    const faltan = v.valores.filter((x) => !ts_.some((t) => t.has(x)));
    const veredicto = faltan.length === 0 ? 'ofrece todo' : faltan.length === v.valores.length ? 'no nombra NINGUNO' : 'PARCIAL';
    // Lo que faltaría contando SÓLO los llamadores directos: si «ofrece todo» se apoya en una
    // pantalla traída por el nombre de un envoltorio, el verde puede ser de otra pantalla.
    const tsDir = directos.map(tokens);
    const faltanDirectos = tsDir.some((t) => t === null) ? [] : v.valores.filter((x) => !tsDir.some((t) => t.has(x)));
    filas.push({ v, r, llamadores, veredicto, faltan, porEnvoltorio, faltanDirectos });
  }
}

// ── controles SEMBRADOS: la pareja parcial TIENE que salir PARCIAL con los 8 que faltan; la
// completa, «ofrece todo». Si la siembra no está (`--sin-siembra`) o no casa, CIEGO. ────────────
const sp = filas.find((x) => sembrado(x) && x.r.path === '/__siembra1194/parcial');
const faltanEsperados = DOCE.filter((v) => !CUATRO.includes(v));
if (!sp || sp.veredicto !== 'PARCIAL' || sp.faltan.join() !== faltanEsperados.join())
  ciego(`control positivo SEMBRADO: la pareja de 1136 no sale PARCIAL con [${faltanEsperados}] (sale: ${sp ? sp.veredicto + ' faltan=' + sp.faltan : 'ni aparece'})`);
const sc = filas.find((x) => sembrado(x) && x.r.path === '/__siembra1194/completo');
if (!sc || sc.veredicto !== 'ofrece todo')
  ciego(`control negativo SEMBRADO: la gemela que ofrece los 12 no sale «ofrece todo» (sale: ${sc ? sc.veredicto + ' faltan=' + sc.faltan : 'ni aparece'})`);
const nSembrados = filas.filter(sembrado).length + sinPantalla.filter(sembrado).length + salida.filter(sembrado).length;
if (nSembrados !== 2) ciego(`la siembra deja ${nSembrados} pares, no 2: se ha mezclado con el árbol`);
// Fuera de aquí, la siembra no cuenta en nada.
for (const a of [filas, sinPantalla, salida]) for (let i = a.length - 1; i >= 0; i--) if (sembrado(a[i])) a.splice(i, 1);
const vocabReal = vocab.filter((v) => !v.file.startsWith(SIEMBRA));
const rutasReales = rutas.filter((r) => !r.file.startsWith(SIEMBRA));
const c1136 = filas.find((x) => x.v.nombre === 'CAMPOS_CLIENTE' && x.r.method === 'POST' && x.r.path === '/admin/customers/import');

const cuenta = (x) => filas.filter((f) => f.veredicto === x).length;
console.log(`población: ${vocabReal.length} vocabularios del servidor (${vocabReal.filter((v) => v.zod).length} z.enum + ${vocabReal.filter((v) => !v.zod).length} arrays de literales) · ${rutasReales.length} rutas (sonda 1185) · siembra aparte: 1 vocabulario, 2 rutas`);
console.log(`  · sin ninguna ruta que los use (ni directo ni a un salto): ${sinRuta.length}  ← NO PUDE LIGAR`);
console.log(`  · pares vocabulario×ruta: ${filas.length + sinPantalla.length + salida.length}`);
console.log(`      GET (el vocabulario se DEVUELVE, no se acepta: no es esta forma): ${salida.length}`);
console.log(`      sin pantalla llamadora (ruta sin consumidor: dominio de 1185): ${sinPantalla.length}`);
console.log(`      ofrece todo: ${cuenta('ofrece todo')} · PARCIAL: ${cuenta('PARCIAL')} · no nombra NINGUNO: ${cuenta('no nombra NINGUNO')} · NO PUDE MEDIR: ${cuenta('NO PUDE MEDIR')}`);
console.log(`control positivo SEMBRADO (pareja de 1136, 4 de 12): ${sp.veredicto} · faltan ${sp.faltan.join(', ')} ✅`);
console.log(`control negativo SEMBRADO (gemela, 12 de 12): ${sc.veredicto} ✅`);
console.log(`SCRUM-1136 real (POST /admin/customers/import): ${c1136 ? c1136.veredicto + (c1136.faltan.length ? ' · faltan ' + c1136.faltan.join(', ') : '') : 'NO APARECE'}`);
for (const x of ['PARCIAL', 'no nombra NINGUNO', 'NO PUDE MEDIR']) {
  const fs_ = filas.filter((f) => f.veredicto === x); if (!fs_.length) continue;
  console.log(`\n── ${x} ──`);
  // Una ruta que no lee `req.body` (según 1185) no puede aceptar el valor de fuera por el cuerpo:
  // el vocabulario lo compara con algo guardado. Se marca, no se reclasifica (puede ir por query).
  const sinCuerpo = (r) => r.cuerpoLeido && !r.cuerpoLeido.ciego && !r.cuerpoLeido.ks.length ? '  ⚠️ la ruta no lee req.body' : '';
  for (const f of fs_) console.log(`  ${f.r.method} ${f.r.path}  ·  ${f.v.nombre} (${f.v.file} · ruta ${f.r.file}:${f.r.line})${sinCuerpo(f.r)}\n      faltan [${f.faltan.join(', ')}] de [${f.v.valores.join(', ')}]\n      pantallas: ${f.llamadores.join(', ')}${f.porEnvoltorio ? `  (${f.porEnvoltorio} por envoltorio)` : ''}`);
}
const soloEnv = filas.filter((f) => f.veredicto === 'ofrece todo' && f.faltanDirectos.length);
console.log(`\n── «ofrece todo» SÓLO gracias a pantallas traídas por envoltorio: ${soloEnv.length} ──`);
for (const f of soloEnv) console.log(`  ${f.r.method} ${f.r.path}  ·  ${f.v.nombre} (${f.r.file}:${f.r.line})\n      con los directos faltarían [${f.faltanDirectos.join(', ')}]\n      directos: ${llamadoresDe(f.r).directos.join(', ')} · por envoltorio: ${f.llamadores.filter((x) => !llamadoresDe(f.r).directos.includes(x)).join(', ')}`);
if (process.argv.includes('--todo')) {
  console.log('\n── ofrece todo ──'); for (const f of filas.filter((x) => x.veredicto === 'ofrece todo')) console.log(`  ${f.r.method} ${f.r.path} · ${f.v.nombre}`);
  console.log('\n── sin ruta ──'); for (const v of sinRuta) console.log(`  ${v.nombre} (${v.file}) [${v.valores.slice(0, 6).join(', ')}${v.valores.length > 6 ? '…' : ''}]`);
}
