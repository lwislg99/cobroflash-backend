// tests/_censo-arneses-de-router.mjs — SCRUM-1344
//
// QUÉ ARNESES DE `tests/` LLAMAN A UN ROUTER DE `/admin`, Y CON QUÉ `req`.
//
// En producción, todo lo que cuelga de `/admin` pasa antes por `requireAuth`, que pone
// `req.merchantId` y `req.userRole` EN LA MISMA LÍNEA DE VIDA: no existe un `req` con comercio y sin
// rol. Un arnés que construye uno describe a un llamante que no puede existir, y el día que alguien
// declara un rol en esa ruta se lleva un `403` que parece suyo (así cayó `scrum960` en SCRUM-1317).
//
// ── POR QUÉ AST Y NO `grep` ───────────────────────────────────────────────────────────────
// El censo por texto de SCRUM-1344 (`dist/modules/…routes` + `userRole` + `merchantId`) medía dos
// cosas a la vez y las dos mal, y está contado en `docs/master/SCRUM-1344.md`:
//   · contaba como «importa un router» al fichero que solo lo LEE como texto o lo nombra en prosa;
//   · no veía al que lo importa con `DIST + '/modules/…'`, `path.join(RAIZ, …)` o un `createRequire`
//     con otro nombre, que son la mayoría.
// Aquí el import se PLIEGA (se resuelve la expresión hasta la ruta) y «es un router» no se decide
// por el nombre del fichero: lo dice el DESTINO — `dist/app.js` ejecutado (`mapaDeRouters`).
//
// ── LO QUE NO SE PUDO MIRAR NO «NO LO TIENE» ──────────────────────────────────────────────
// Este censo concluye cosas por AUSENCIA («este arnés no declara rol»). Un fichero que no se pudo
// parsear, un import que no se pudo plegar o un `req` armado con `...resto` no «no lo declaran»:
// NO SE SABE. Salen aparte, como `sin-juzgar`, con su motivo. Nunca como limpios.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

/** Lo que el plegado no supo resolver. Visible a propósito: sale en los avisos. */
const HUECO = '‹?›';

/** El único constructor admitido de un `req` con forma de sesión (`tests/_arnes-de-router.mjs`). */
export const CONSTRUCTOR = 'reqDeSesion';

/** Claves que solo tiene un `req` (una sola basta) y claves que también tiene una fila (hacen falta dos). */
const CLAVES_DE_REQ = new Set(['query', 'params', 'cookies', 'originalUrl']);
const CLAVES_AMBIGUAS = new Set(['body', 'headers', 'url', 'method', 'file', 'files']); // `method` también lo tiene un cobro
const VERBOS = new Set(['get', 'post', 'put', 'patch', 'delete']);

export const CLASES = Object.freeze({
  K: 'sin-rol',                       // forma de sesión y ningún rol: el defecto
  ARNES: 'arnes-unico',               // todo `req` de sesión sale de `reqDeSesion`
  A_MANO: 'a-mano',                   // declara el rol escribiendo `userRole` a mano (heredados)
  SIN_SESION: 'sin-forma-de-sesion',  // importa el router y no le arma ningún `req` con comercio
  PUBLICO: 'solo-publicos',           // solo importa routers que no cuelgan de `/admin`
  APP: 'monta-la-app',                // importa `dist/app.js`: el rol lo pone el `requireAuth` real
  SIN_JUZGAR: 'sin-juzgar',           // no se pudo mirar Y hay motivo para mirar: NO es «limpio»
  SIN_RESOLVER: 'import-sin-resolver', // importa de dist/ con una ruta que no se lee, y no arma ningún req de sesión
});

// ── 1 · plegar una expresión hasta la ruta que nombra ─────────────────────────────────────

function declaraciones(sf) {
  const amb = new Map();
  const visita = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      const k = n.name.text;
      amb.set(k, amb.has(k) ? null : n.initializer); // dos declaraciones con el mismo nombre → no se sabe
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return amb;
}

function plegar(n, amb, prof = 0) {
  if (!n || prof > 10) return null;
  const p = (x) => plegar(x, amb, prof + 1);
  const o = (x) => p(x) ?? HUECO;
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (ts.isTemplateExpression(n)) return n.head.text + n.templateSpans.map((s) => o(s.expression) + s.literal.text).join('');
  if (ts.isParenthesizedExpression(n)) return p(n.expression);
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) return o(n.left) + o(n.right);
  if (ts.isIdentifier(n)) {
    if (n.text === 'sep') return '/';
    const ini = amb.get(n.text);
    return ini ? p(ini) : null;
  }
  if (ts.isPropertyAccessExpression(n)) {
    if (n.name.text === 'sep') return '/';
    if (n.name.text === 'href' || n.name.text === 'pathname') return p(n.expression);
    return null;
  }
  if (ts.isCallExpression(n)) {
    const quien = n.expression.getText();
    if (/(^|\.)(join|resolve)$/.test(quien)) return n.arguments.map(o).join('/');
    if (/^(pathToFileURL|fileURLToPath|String)$/.test(quien)) return p(n.arguments[0]);
    return HUECO + '/' + n.arguments.map(o).join('/'); // una función propia (`urlDist('modules/…')`)
  }
  if (ts.isNewExpression(n) && n.expression.getText() === 'URL') {
    const a = n.arguments || [];
    if (a.length >= 2 && a[1].getText() !== 'import.meta.url') return o(a[1]) + '/' + o(a[0]);
    return p(a[0]);
  }
  return null;
}

/** ¿A qué fichero de `dist/` apunta una ruta plegada? `otro` = seguro que a ninguno. */
function destinoEnDist(plegado) {
  if (plegado == null) return { clase: 'no-resuelto', pista: HUECO };
  const s = plegado.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  const i = s.lastIndexOf('dist/');
  if (i >= 0) {
    const rel = s.slice(i);
    return rel.includes(HUECO) ? { clase: 'no-resuelto', pista: rel } : { clase: 'dist', rel };
  }
  if (/(^|\/)(scripts|public|node_modules|tests|docs|src)\//.test(s)) return { clase: 'otro' };
  // `'modules/…/x.routes.js'` a secas: la ruta que se le pasa a un ayudante que hace el import.
  if (/^\/?(modules|core|integrations)\/.+\.js$/.test(s) && !s.includes(HUECO)) return { clase: 'dist', rel: 'dist/' + s.replace(/^\//, ''), sinPrefijo: true };
  if (s.includes(HUECO)) {
    const resto = s.startsWith(HUECO) ? s.slice(HUECO.length).replace(/^\//, '') : null;
    if (resto && !resto.includes(HUECO) && (/^(modules|core|integrations)\/.+\.js$/.test(resto) || /^(app|index)\.js$/.test(resto))) {
      return { clase: 'dist', rel: 'dist/' + resto };
    }
    return { clase: 'no-resuelto', pista: s };
  }
  return { clase: 'otro' };
}

// ── 2 · un fichero de test, leído ─────────────────────────────────────────────────────────

const nombreDeClave = (p) => {
  if (ts.isShorthandPropertyAssignment(p)) return p.name.text;
  if ((ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p)) && p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) return p.name.text;
  return null;
};

function funcionQueLoContiene(n) {
  let x = n.parent;
  while (x && !ts.isFunctionLike(x) && !ts.isSourceFile(x)) x = x.parent;
  return x;
}

/** ¿Este objeto literal con `merchantId` es un `req`, o una fila, un `where`, un argumento de servicio? */
function posicionDeReq(lit, claves) {
  // `(x) => ({ … })`: el literal va entre paréntesis y cuelga de la flecha, no de quien la nombra.
  let yo = lit;
  while (ts.isParenthesizedExpression(yo.parent)) yo = yo.parent;
  let padre = yo.parent;
  if (ts.isCallExpression(padre) && ts.isIdentifier(padre.expression) && padre.expression.text === CONSTRUCTOR) return 'arnes';
  if (claves.some((c) => CLAVES_DE_REQ.has(c))) return 'claves';
  if (claves.filter((c) => CLAVES_AMBIGUAS.has(c)).length >= 2) return 'claves';
  if (ts.isCallExpression(padre) && padre.arguments[0] === yo) {
    const quien = padre.expression;
    if (ts.isPropertyAccessExpression(quien) && quien.name.text === 'handle') return 'llamada';
    if (/handler/i.test(quien.getText())) return 'llamada';
    const segundo = padre.arguments[1];
    if (segundo && ts.isIdentifier(segundo) && /^res($|[A-Z_]|p$|ponse$)/.test(segundo.text)) return 'llamada';
  }
  if (ts.isCallExpression(padre) && padre.expression.getText() === 'Object.assign' && padre.arguments[1] === yo
    && ts.isIdentifier(padre.arguments[0]) && /^req/i.test(padre.arguments[0].text)) return 'asignado';
  if (ts.isArrowFunction(padre) && padre.body === yo) padre = padre.parent;
  if (ts.isVariableDeclaration(padre) && ts.isIdentifier(padre.name) && /^req/i.test(padre.name.text)) return 'variable';
  return null;
}

/** ¿Este trozo de código le pone rol a un `req`? (`userRole:` en un literal, `x.userRole =`, o el constructor) */
function poneRol(nodo) {
  let como = null;
  const v = (n) => {
    if (como === 'arnes') return;
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === CONSTRUCTOR) { como = 'arnes'; return; }
    if (ts.isObjectLiteralExpression(n) && n.properties.some((p) => nombreDeClave(p) === 'userRole')) como = como || 'a-mano';
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(n.left)
      && n.left.name.text === 'userRole') como = como || 'a-mano';
    ts.forEachChild(n, v);
  };
  v(nodo);
  return como;
}

/**
 * Lee UN fichero. Puro: no toca disco ni ejecuta nada (las autopruebas le pasan fuentes de mentira).
 *
 * @returns {{ fichero:string, parsea:boolean, importa:string[], noResueltos:Array, nombra:string[],
 *             sitios:Array<{linea:number, forma:string, rol:string}>, nombraUserRole:boolean }}
 */
export function analizarFuente(fichero, fuente) {
  const sf = ts.createSourceFile(fichero, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const fila = { fichero, parsea: sf.parseDiagnostics.length === 0, importa: [], noResueltos: [], nombra: [], sitios: [], literalesDeRuta: [], verbos: [], nombraUserRole: false, usaArnes: false };
  if (!fila.parsea) return fila;

  const amb = declaraciones(sf);
  /** Funciones del propio fichero, por nombre: `function f(){}` y `const f = (…) => …`. */
  const funciones = new Map();
  for (const [k, ini] of amb) if (ini && (ts.isArrowFunction(ini) || ts.isFunctionExpression(ini))) funciones.set(k, ini);
  const apuntaFunciones = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name) funciones.set(n.name.text, n);
    ts.forEachChild(n, apuntaFunciones);
  };
  apuntaFunciones(sf);
  const alias = new Set(['require']);
  for (const [k, ini] of amb) {
    if (ini && ts.isCallExpression(ini) && /(^|\.)createRequire$/.test(ini.expression.getText())) alias.add(k);
  }
  const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
  const apunta = (nodo) => {
    const d = destinoEnDist(plegar(nodo, amb));
    if (d.clase === 'dist' && !d.sinPrefijo) fila.importa.push(d.rel);
    else if (d.clase === 'no-resuelto') fila.noResueltos.push({ linea: linea(nodo), texto: nodo.getText().slice(0, 80), pista: d.pista });
  };
  /** `X.userRole = …` dentro de la misma función, sobre el mismo objeto. */
  const asignaRolEn = (funcion, sobre) => {
    let visto = false;
    const v = (n) => {
      if (visto) return;
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(n.left)
        && n.left.name.text === 'userRole' && n.left.expression.getText() === sobre) { visto = true; return; }
      ts.forEachChild(n, v);
    };
    v(funcion);
    return visto;
  };

  const visita = (n) => {
    if (ts.isImportDeclaration(n)) apunta(n.moduleSpecifier);
    if (ts.isCallExpression(n) && n.arguments[0]) {
      const e = n.expression;
      const esImport = e.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(e) && alias.has(e.text))
        || (ts.isPropertyAccessExpression(e) && e.name.text === 'resolve' && ts.isIdentifier(e.expression) && alias.has(e.expression.text));
      if (esImport) apunta(n.arguments[0]);
    }
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      const d = destinoEnDist(n.text);
      if (d.clase === 'dist') fila.nombra.push(d.rel);
      else if (n.text.startsWith('/') && n.text.length < 120) fila.literalesDeRuta.push(n.text);
      if (n.text === 'userRole') fila.nombraUserRole = true;
      if (VERBOS.has(n.text.toLowerCase())) fila.verbos.push(n.text.toLowerCase());
    }
    // `${base}/admin/expenses/leer-ticket`: la URL va en el tramo fijo de una plantilla.
    if (ts.isTemplateExpression(n)) {
      for (const tramo of n.templateSpans) if (tramo.literal.text.startsWith('/') && tramo.literal.text.length < 120) fila.literalesDeRuta.push(tramo.literal.text);
    }
    // `l.route?.methods?.post`: el verbo con el que el arnés busca la capa.
    if (ts.isPropertyAccessExpression(n) && VERBOS.has(n.name.text) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'methods') {
      fila.verbos.push(n.name.text);
    }
    if ((ts.isIdentifier(n) || ts.isPrivateIdentifier(n)) && n.text === 'userRole') fila.nombraUserRole = true;

    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === CONSTRUCTOR) fila.usaArnes = true;

    if (ts.isObjectLiteralExpression(n)) {
      const claves = n.properties.map(nombreDeClave).filter(Boolean);
      if (claves.includes('merchantId')) {
        const forma = posicionDeReq(n, claves);
        if (forma) {
          const esparce = n.properties.some((p) => ts.isSpreadAssignment(p));
          let rol = forma === 'arnes' ? 'arnes' : claves.includes('userRole') ? 'a-mano' : null;
          let envoltorio = null;
          // El literal se le pasa a una función del propio fichero que es la que arma el `req`:
          // si ESA función le pone el rol, este sitio ya lo lleva (`lista({ merchantId, query })`).
          const llamada = ts.isCallExpression(n.parent) && ts.isIdentifier(n.parent.expression) ? n.parent.expression.text : null;
          const pasaA = llamada && funciones.has(llamada) ? llamada : null;
          if (!rol && pasaA) {
            const por = poneRol(funciones.get(pasaA));
            if (por) { rol = por; envoltorio = pasaA; }
          }
          if (!rol) rol = esparce ? 'indeterminado' : 'sin-rol';
          fila.sitios.push({ linea: linea(n), forma, rol, desde: n.getStart(), hasta: n.end, ...(pasaA ? { pasaA } : {}), ...(envoltorio ? { envoltorio } : {}) });
        }
      }
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(n.left)
      && n.left.name.text === 'merchantId' && /(^|\.)req\w*$/i.test(n.left.expression.getText())) {
      const sobre = n.left.expression.getText();
      fila.sitios.push({ linea: linea(n), forma: 'asignacion', rol: asignaRolEn(funcionQueLoContiene(n), sobre) ? 'a-mano' : 'sin-rol' });
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  fila.importa = [...new Set(fila.importa)];
  fila.nombra = [...new Set(fila.nombra)];
  return fila;
}

/** Los `.mjs` de `tests/` (sin recorrer `fixtures/`: ahí viven las fuentes de mentira de las autopruebas). */
export function ficherosDeTests(raiz) {
  return fs.readdirSync(path.join(raiz, 'tests')).filter((f) => f.endsWith('.mjs')).sort();
}

export function censoEstatico(raiz) {
  return ficherosDeTests(raiz).map((f) => analizarFuente(f, fs.readFileSync(path.join(raiz, 'tests', f), 'utf8')));
}

// ── 3 · qué es un router y qué gate tiene delante: lo dice el DESTINO ─────────────────────

const esRouter = (h) => typeof h === 'function' && Array.isArray(h.stack) && typeof h.handle === 'function';
const rolDe = (h) => (h && h.__requiredRole) || null;

/**
 * Importa `dist/app.js` (sin base ni servidor, igual que `scrum55`) y devuelve, por fichero de
 * `dist/` que exporta un router: dónde está montado y qué gate de rol tiene delante HOY.
 *
 * El router se empareja con su fichero por IDENTIDAD de objeto en la caché de `require`, no por
 * el nombre del fichero: `albaranPublicVista.js` vive en `routes/` y no exporta ningún router.
 */
export async function mapaDeRouters(raiz) {
  const requiere = createRequire(path.join(raiz, 'package.json'));
  const { app } = await import(pathToFileURL(path.join(raiz, 'dist', 'app.js')).href);
  const { getAdminMounts } = await import(pathToFileURL(path.join(raiz, 'dist', 'core', 'http', 'adminMounts.js')).href);

  const montados = new Map();
  for (const capa of app.router.stack) if (esRouter(capa.handle)) montados.set(capa.handle, { admin: false, prefijos: [], rolMontaje: null });
  const montajes = getAdminMounts();
  for (const m of montajes) {
    const i = montados.get(m.router) || { admin: false, prefijos: [], rolMontaje: null };
    i.admin = true;
    i.prefijos.push(m.prefix);
    i.rolMontaje = m.gates.map(rolDe).find(Boolean) || i.rolMontaje;
    montados.set(m.router, i);
  }

  const dist = path.join(raiz, 'dist') + path.sep;
  const porFichero = new Map();
  let modulosDeDist = 0;
  for (const [id, mod] of Object.entries(requiere.cache)) {
    if (!id.startsWith(dist)) continue;
    modulosDeDist++;
    const ex = mod.exports;
    if (!ex || (typeof ex !== 'object' && typeof ex !== 'function')) continue;
    for (const valor of [ex, ...Object.values(ex)]) {
      if (!esRouter(valor) || !montados.has(valor)) continue;
      const i = montados.get(valor);
      const rutas = valor.stack.filter((c) => c.route);
      const rolUse = valor.stack.filter((c) => !c.route).map((c) => rolDe(c.handle)).find(Boolean) || null;
      const rutasConRol = rutas.filter((c) => c.route.stack.some((s) => rolDe(s.handle))).length;
      porFichero.set(path.relative(raiz, id).replace(/\\/g, '/'), {
        admin: i.admin, prefijos: i.prefijos, rolMontaje: i.rolMontaje, rolUse, rutas: rutas.length, rutasConRol,
        detalle: rutas.map((c) => ({ ruta: c.route.path, verbos: Object.keys(c.route.methods), rol: c.route.stack.map((s) => rolDe(s.handle)).find(Boolean) || null })),
      });
    }
  }
  return {
    porFichero, modulosDeDist, montajesAdmin: montajes.length, routersMontados: montados.size,
    // Cuántos routers DISTINTOS cuelgan de /admin: el suelo contra el que se comprueba que el
    // emparejamiento por identidad los ha encontrado a todos (si la caché cambia de forma, encoge).
    routersDeAdmin: new Set(montajes.map((m) => m.router)).size,
  };
}

// ── 4 · la clase de cada arnés ────────────────────────────────────────────────────────────

/** `/:id/rectify` casa con el literal `'/:id/rectify'` (quien busca la capa) y con `'/7/rectify'` (quien la llama). */
function casaConLaRuta(patron, literal) {
  if (patron === literal) return true;
  if (typeof patron !== 'string') return false;
  const re = new RegExp('^' + patron.split('/').map((t) => (t.startsWith(':') ? '[^/]+' : t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/') + '/?(\\?.*)?$');
  return re.test(literal);
}

/**
 * ¿Qué gate de rol tiene HOY delante lo que este arnés llama?
 *
 * El de montaje y el de `router.use` valen para el router entero. El de una ruta concreta solo
 * cuenta si el arnés NOMBRA esa ruta (el literal con el que busca la capa, o la URL que pide). Si
 * no nombra ninguna ruta del router, no se sabe cuál llama: se cuenta el router entero y se dice.
 */
function gateDeLoQueLlama(fila, deAdmin, R) {
  let gate = null;
  let porRouterEntero = false;
  for (const d of deAdmin) {
    const r = R.get(d);
    if (r.rolMontaje) { gate = gate || { rol: r.rolMontaje, donde: 'montaje', router: d }; continue; }
    if (r.rolUse) { gate = gate || { rol: r.rolUse, donde: 'router.use', router: d }; continue; }
    // El literal puede traer el prefijo del montaje (`'/admin/expenses/leer-ticket'`), y `/:id` existe
    // con varios verbos: `GET /:id` abierto y `DELETE /:id` de admin son dos rutas distintas.
    const sinPrefijo = (l) => { const p = r.prefijos.find((q) => l.startsWith(q + '/')); return p ? l.slice(p.length) : l; };
    const delVerbo = (x) => fila.verbos.length === 0 || x.verbos.some((v) => fila.verbos.includes(v));
    const nombradas = r.detalle.filter((x) => delVerbo(x) && fila.literalesDeRuta.some((l) => casaConLaRuta(x.ruta, sinPrefijo(l))));
    if (nombradas.length === 0) {
      porRouterEntero = true;
      const alguna = r.detalle.find((x) => x.rol);
      if (alguna) gate = gate || { rol: alguna.rol, donde: 'alguna ruta del router (no se sabe cuál llama)', router: d };
      continue;
    }
    const conRol = nombradas.find((x) => x.rol);
    if (conRol) gate = gate || { rol: conRol.rol, donde: `ruta ${conRol.ruta}`, router: d };
  }
  return { gate, porRouterEntero };
}

/** @param mapa lo que devuelve `mapaDeRouters`. */
export function clasificar(fila, mapa) {
  const R = mapa.porFichero;
  if (!fila.parsea) return { clase: CLASES.SIN_JUZGAR, motivo: 'no se pudo parsear', routers: [], deAdmin: [], gate: null };
  // Importar el router y NOMBRARLO en un literal cuentan igual: quien lo carga a través de un
  // ayudante (`invocar('modules/…routes.js', …)`) no lo importa en ninguna línea suya.
  const routers = [...new Set([...fila.importa, ...fila.nombra])].filter((d) => R.has(d));
  const deAdmin = routers.filter((d) => R.get(d).admin);
  const { gate, porRouterEntero } = gateDeLoQueLlama(fila, deAdmin, R);
  const base = { routers, deAdmin, gate, porRouterEntero };

  if (routers.length === 0) {
    if (fila.importa.includes('dist/app.js')) return { ...base, clase: CLASES.APP };
    // Un import que no se pudo plegar puede ser de un router, y entonces esto es un arnés que no veo.
    if (fila.noResueltos.length) {
      const donde = `${fila.noResueltos.length} import(s) de dist/ sin resolver (línea ${fila.noResueltos.map((x) => x.linea).join(', ')})`;
      const sueltos = fila.sitios.filter((s) => s.rol === 'sin-rol' || s.rol === 'indeterminado');
      // Si ADEMÁS arma algo con forma de `req` de sesión y sin rol, lo que no sé es contra qué
      // router lo usa: eso no se deja pasar. Si no arma ninguno, es casi siempre un cargador
      // genérico (`rutaDe(r)`): se cuenta y se nombra, pero no obliga a nadie a declarar nada.
      if (sueltos.length) {
        return { ...base, clase: CLASES.SIN_JUZGAR, sitios: sueltos, motivo: `arma un req con forma de sesión y sin rol (línea ${sueltos.map((s) => s.linea).join(', ')}) y tiene ${donde}: no se sabe contra qué router` };
      }
      return { ...base, clase: CLASES.SIN_RESOLVER, motivo: donde };
    }
    return { ...base, clase: null }; // no es un arnés de router
  }
  if (deAdmin.length === 0) return { ...base, clase: CLASES.PUBLICO };

  const sinRol = fila.sitios.filter((s) => s.rol === 'sin-rol');
  const dudosos = fila.sitios.filter((s) => s.rol === 'indeterminado');
  if (sinRol.length) return { ...base, clase: CLASES.K, sitios: sinRol };
  if (dudosos.length) {
    // `{ merchantId, ...resto }`: el rol puede venir en `resto`. Si el fichero no nombra `userRole`
    // en NINGÚN sitio, no puede venir de ahí y es sin rol; si lo nombra, no se sabe desde aquí.
    if (!fila.nombraUserRole && !fila.usaArnes) return { ...base, clase: CLASES.K, sitios: dudosos };
    return { ...base, clase: CLASES.SIN_JUZGAR, motivo: 'arma el `req` con `...resto` y el rol puede venir dentro', sitios: dudosos };
  }
  if (fila.sitios.length === 0) return { ...base, clase: CLASES.SIN_SESION };
  if (fila.sitios.every((s) => s.rol === 'arnes')) return { ...base, clase: CLASES.ARNES };
  return { ...base, clase: CLASES.A_MANO };
}

/** El censo entero: población, clases y la línea que sale SIEMPRE. */
export async function censoDeArneses(raiz) {
  const mapa = await mapaDeRouters(raiz);
  const filas = censoEstatico(raiz);
  const porClase = new Map(Object.values(CLASES).map((c) => [c, []]));
  for (const fila of filas) {
    const c = clasificar(fila, mapa);
    if (c.clase) porClase.get(c.clase).push({ ...fila, ...c });
  }
  const de = (c) => porClase.get(c);
  const deSesion = [...de(CLASES.K), ...de(CLASES.ARNES), ...de(CLASES.A_MANO)];
  const conGate = deSesion.filter((x) => x.gate);
  const sinGate = deSesion.filter((x) => !x.gate);
  const k = de(CLASES.K);
  const linea = `SCRUM-1344 · ${conGate.length} arneses montan rutas con rol · ${k.filter((x) => x.gate).length} sin declararlo`
    + ` · y ${sinGate.length} montan rutas sin gate hoy · ${k.filter((x) => !x.gate).length} sin declararlo`
    + ` · población: ${filas.length} ficheros de tests/ leídos, ${filas.filter((f) => !f.parsea).length} sin parsear;`
    + ` ${deSesion.length} arman un req de sesión contra un router de /admin`
    + ` (${de(CLASES.ARNES).length} con ${CONSTRUCTOR}, ${de(CLASES.A_MANO).length} a mano, ${k.length} sin rol)`
    + ` · SIN JUZGAR: ${de(CLASES.SIN_JUZGAR).length}, más ${de(CLASES.SIN_RESOLVER).length} con un import de dist/ que no se puede resolver leyendo (y ningún req de sesión a la vista)`
    + ` · aparte: ${de(CLASES.SIN_SESION).length} cargan un router de /admin sin armarle un req de sesión,`
    + ` ${de(CLASES.PUBLICO).length} solo routers públicos, ${de(CLASES.APP).length} montan dist/app.js entero`;
  return { mapa, filas, porClase, deSesion, conGate, sinGate, linea };
}
