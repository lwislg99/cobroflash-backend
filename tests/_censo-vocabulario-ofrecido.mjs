// SCRUM-1194d · el censo A: «el servidor acepta un VALOR que la pantalla no ofrece», como pieza.
//
// Es el algoritmo de `docs/master/evidencias/SCRUM-1194/censo-vocabulario.mjs` (1194 y 1194b)
// traído aquí sin cambiarlo, para que lo usen el trinquete
// (`tests/scrum1194d-trinquete-vocabulario-ofrecido.test.mjs`) y aquella medición, que ahora sólo
// imprime. Un algoritmo en dos sitios acaba divergiendo: hay UNO, y es éste.
//
// Decisión del fundador, SCRUM-1194 c.21005: método A en J6. NO toca la sonda de 1185
// (`scripts/_censo-sin-consumir.mjs`, carril S0): la LEE y parchea una COPIA en memoria con dos
// anclas de texto. Si una no casa UNA vez, CIEGO — y eso es un rojo de J6 por un cambio de S0, el
// riesgo que la tabla de 1194c declara para A.
//
// LA FORMA (el caso vivo fue SCRUM-1136): un VOCABULARIO cerrado del servidor —`z.enum([...])` o
// un array constante de ≥2 literales— que una ruta acepta, y del que las pantallas que llaman a
// ESA ruta no nombran algunos valores. 1185 mira CLAVES del cuerpo; esto mira VALORES.
//
// Devuelve `{ ciego: '<motivo>' }` o el censo. Nunca sale del proceso: quien lo usa decide.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// La pareja del ejemplo del ticket (§ siembra): el servidor acepta los 12 valores de
// `CAMPOS_CLIENTE` y la pantalla ofrece los 4 de `csvImport.js:162` antes de #1939.
export const SIEMBRA = 'src/__siembra1194__/';
export const DOCE = ['name', 'phone', 'mobile', 'email', 'notes', 'taxId', 'tags', 'billingAddress', 'billingCity', 'billingPostalCode', 'billingProvince', 'billingCountry'];
export const CUATRO = ['name', 'phone', 'email', 'notes'];
export const FALTAN_SEMBRADOS = DOCE.filter((v) => !CUATRO.includes(v));

/** La identidad de un par: ruta, vocabulario, su fichero y sus valores (dos `z.enum` de un mismo
 * esquema se llaman igual, y sólo los valores los separan). Por identidad, no por posición. */
export const clavePar = (x) => `${x.r.method} ${x.r.path} · ${x.v.nombre} [${x.v.valores.join('|')}] · ${x.v.file}`;

export async function censarVocabulario(raiz, { sembrar = true } = {}) {
  const RAIZ = path.resolve(raiz);
  const req = createRequire(path.join(RAIZ, 'package.json'));
  const ts = req('typescript');
  const ciego = (m) => ({ ciego: m });

  // ── 1 · la sonda de 1185, parcheada en una copia ───────────────────────────────────────────
  let fuente = fs.readFileSync(path.join(RAIZ, 'scripts/_censo-sin-consumir.mjs'), 'utf8');
  const anclas = [
    ['cuerpoLeido: clavesLeidas(n) });', "cuerpoLeido: clavesLeidas(n), ids: (() => { const x = new Set(); const w = (m) => { if (ts.isIdentifier(m)) x.add(m.text); ts.forEachChild(m, w); }; w(n); return [...x]; })() });", 'routeDefs.push'],
    ['    poblacion: {', '    rutasInternas: routes,\n    poblacion: {', 'return poblacion'],
  ];
  for (const [a, b, q] of anclas) {
    if (fuente.split(a).length !== 2) return ciego(`el ancla «${q}» no casa una vez en la sonda de 1185 (¿cambió?)`);
    fuente = fuente.replace(a, b);
  }
  // La copia vive FUERA del árbol (un temporal dentro del repo fue el rojo intermitente de
  // SCRUM-824) y se borra en cuanto se ha importado.
  const dirCopia = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1194-'));
  let sonda;
  try {
    const copia = path.join(dirCopia, 'sonda-1185-parcheada.mjs');
    fs.writeFileSync(copia, fuente.replace("from 'typescript'", `from ${JSON.stringify(pathToFileURL(req.resolve('typescript')).href)}`));
    sonda = await import(pathToFileURL(copia).href);
  } finally {
    fs.rmSync(dirCopia, { recursive: true, force: true });
  }
  const cwd = process.cwd();
  let arbol; let censo;
  process.chdir(RAIZ);
  try {
    arbol = sonda.cargarArbol('.');
    // ── 1bis · la SIEMBRA (23-oct-2026) ──────────────────────────────────────────────────────
    // El positivo lo fabrica el instrumento, en memoria (nada se escribe en el árbol). Entra por
    // el camino real de la sonda de 1185 (montaje en app.ts, `fetch` con cuerpo), no por un
    // atajo. Su gemela ofrece los 12: es el control que NO tiene que casar. Sin siembra, CIEGO.
    if (sembrar) {
      const f = arbol.files;
      if (!f.has('src/app.ts')) return ciego('no hay src/app.ts donde montar la siembra');
      f.set(SIEMBRA + 'campos.ts', `export const CAMPOS_SIEMBRA_1194 = ${JSON.stringify(DOCE)} as const;\nexport type CampoSiembra1194 = (typeof CAMPOS_SIEMBRA_1194)[number];\n`);
      const handler = `(req, res) => { const mapeo = req.body.mapeo as Record<string, CampoSiembra1194>; res.json({ mapeo }); }`;
      f.set(SIEMBRA + 'siembra.routes.ts', `import { Router } from 'express';\nimport type { CampoSiembra1194 } from './campos';\nexport const siembraRouter1194 = Router();\nsiembraRouter1194.post('/parcial', ${handler});\nsiembraRouter1194.post('/completo', ${handler});\n`);
      f.set('src/app.ts', f.get('src/app.ts') + `\nimport { siembraRouter1194 } from './__siembra1194__/siembra.routes';\napp.use('/__siembra1194', siembraRouter1194);\n`);
      // Nombre de envoltorio ÚNICO por pantalla: con `enviar` en las dos, el salto por envoltorio
      // (que casa por NOMBRE) metía la gemela como llamadora de la parcial (medido el 23-oct).
      const pantalla = (ruta, ofrece) => `const CAMPOS = ${JSON.stringify(ofrece.map((v) => [v, v]))};\nfunction enviar_${ruta}_1194(fichero, codificacion, mapeo) { return fetch('/__siembra1194/${ruta}', { method: 'POST', body: JSON.stringify({ fichero, codificacion, mapeo }) }); }\n`;
      f.set('public/__siembra1194__/parcial.js', pantalla('parcial', CUATRO));
      f.set('public/__siembra1194__/completo.js', pantalla('completo', DOCE));
    }
    censo = sonda.censar(arbol);
  } finally {
    process.chdir(cwd);
  }
  const sembrado = (x) => x.v.file.startsWith(SIEMBRA) || x.r.file.startsWith(SIEMBRA);
  const rutas = censo.rutasInternas;
  if (!Array.isArray(rutas) || !rutas.length) return ciego('la sonda no devolvió rutas');

  // ── 2 · vocabularios del servidor ───────────────────────────────────────────────────────────
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
      // Un TIPO derivado del vocabulario (`type CampoCliente = typeof CAMPOS_CLIENTE[number]`) ES
      // el vocabulario: el handler de 1136 no nombra el array, nombra su tipo.
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

  // ── 3 · vocabulario → rutas que lo usan (directo, o por UN salto de import) ────────────────
  const rutasDe = (v) => rutas.filter((r) => {
    const ids = new Set(r.ids || []);
    if (ids.has(v.nombre)) return true;
    for (const [n, cuerpo] of exportsDe.get(v.file) || []) if (ids.has(n) && cuerpo.has(v.nombre)) return true;
    return false;
  });

  // ── 4 · qué VALORES nombra cada pantalla llamadora ──────────────────────────────────────────
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

  // Identificadores de cada fichero del front, para seguir UN salto por envoltorio: si la llamada
  // a la ruta vive dentro de `createCustomer` (en `api.js`), las pantallas que llaman a
  // `createCustomer` también son llamadoras.
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

  // ── 5 · el censo ────────────────────────────────────────────────────────────────────────────
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
      filas.push({ v, r, llamadores, directos, veredicto, faltan, porEnvoltorio, faltanDirectos });
    }
  }

  // ── controles SEMBRADOS: la pareja parcial TIENE que salir PARCIAL con los 8 que faltan; la
  // completa, «ofrece todo». Si la siembra no está o no casa, CIEGO — nunca un verde. ─────────
  const sp = filas.find((x) => sembrado(x) && x.r.path === '/__siembra1194/parcial');
  const sc = filas.find((x) => sembrado(x) && x.r.path === '/__siembra1194/completo');
  const nSembrados = filas.filter(sembrado).length + sinPantalla.filter(sembrado).length + salida.filter(sembrado).length;
  const fallo = (!sp || sp.veredicto !== 'PARCIAL' || sp.faltan.join() !== FALTAN_SEMBRADOS.join())
    ? `control positivo SEMBRADO: la pareja de 1136 no sale PARCIAL con [${FALTAN_SEMBRADOS}] (sale: ${sp ? sp.veredicto + ' faltan=' + sp.faltan : 'ni aparece'})`
    : (!sc || sc.veredicto !== 'ofrece todo')
      ? `control negativo SEMBRADO: la gemela que ofrece los 12 no sale «ofrece todo» (sale: ${sc ? sc.veredicto + ' faltan=' + sc.faltan : 'ni aparece'})`
      : nSembrados !== 2 ? `la siembra deja ${nSembrados} pares, no 2: se ha mezclado con el árbol` : null;
  if (fallo) return ciego(fallo);
  // Fuera de aquí, la siembra no cuenta en nada.
  for (const a of [filas, sinPantalla, salida]) for (let i = a.length - 1; i >= 0; i--) if (sembrado(a[i])) a.splice(i, 1);
  const vocabReal = vocab.filter((v) => !v.file.startsWith(SIEMBRA));
  const rutasReales = rutas.filter((r) => !r.file.startsWith(SIEMBRA));

  const cuenta = (x) => filas.filter((f) => f.veredicto === x).length;
  return {
    poblacion: {
      vocabularios: vocabReal.length,
      zod: vocabReal.filter((v) => v.zod).length,
      arrays: vocabReal.filter((v) => !v.zod).length,
      rutas: rutasReales.length,
      sinRuta: sinRuta.length,
      pares: filas.length + sinPantalla.length + salida.length,
      get: salida.length,
      sinPantalla: sinPantalla.length,
      ofreceTodo: cuenta('ofrece todo'),
      parcial: cuenta('PARCIAL'),
      ninguno: cuenta('no nombra NINGUNO'),
      noPudeMedir: cuenta('NO PUDE MEDIR'),
    },
    controles: { positivo: sp, negativo: sc },
    filas, sinRuta, sinPantalla, salida,
    // Una discrepancia es lo que el trinquete vigila: PARCIAL, NINGUNO o NO PUDE MEDIR.
    discrepancias: filas.filter((f) => f.veredicto !== 'ofrece todo'),
    soloPorEnvoltorio: filas.filter((f) => f.veredicto === 'ofrece todo' && f.faltanDirectos.length),
  };
}
