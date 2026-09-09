// scripts/censo-decisiones-encerradas.mjs — SCRUM-837
//
// ¿CUÁNTAS DECISIONES DE PRODUCTO VIVEN ENCERRADAS DENTRO DE UNA VISTA?
//
//   node scripts/censo-decisiones-encerradas.mjs              # el árbol de trabajo
//   node scripts/censo-decisiones-encerradas.mjs --ref <sha>  # un árbol histórico (el SUELO)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA FORMA QUE SE BUSCA — y las TRES familias salen de los TRES casos, no al revés
//
// Ha mordido tres veces. Un detector inventado «a ojo» habría cazado cualquier función que mire
// un estado, que son decenas y casi todas legítimas. Estas tres formas están calcadas de los tres
// defectos REALES, y cada una tiene su caso de prueba en el suelo:
//
//   ① RESOLUTOR ENCERRADO   consulta el registro de acciones del documento (o la escalera) para
//                           saber qué toca, vive en una vista y no está expuesto.
//                           → SCRUM-831: `primariaDeAlbaran` en `jobDetailView.js`.
//
//   ② SEGUNDA FUENTE        decide POR SU CUENTA qué control ofrecer comparando contra estados
//                           declarados, existiendo un registro para ese documento al que no
//                           pregunta. Dos tablas para la misma pregunta.
//                           → SCRUM-366: la lista escribió su propia escalera y divergió.
//
//   ③ EJECUTOR ENCERRADO    construye el control que ESCRIBE el cambio de estado del documento,
//                           vive en una vista y no está expuesto.
//                           → SCRUM-823: `abrirAgendarTrabajo` en `jobsView.js`.
//
// 🔒 Una función correcta que la otra pantalla no puede nombrar acaba en una de dos: o se
// reescribe peor (366), o no se usa (823, 831).
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ LO QUE ESTE CENSO **NO** AFIRMA, y es la mitad honesta
//
// El panel son `<script>` clásicos SIN módulos (regla 4): todos comparten ámbito global, así que
// una `function` de nivel superior en `jobDetailView.js` **sí** es técnicamente alcanzable desde
// `albaranesView.js`. LA BARRERA NO ES DE SINTAXIS. Es de otras dos clases:
//
//   · de DESCUBRIMIENTO — nadie busca la regla del albarán dentro de la vista del Trabajo;
//   · de ORDEN DE CARGA — el global existe en tiempo de llamada pero no de definición, así que la
//     dependencia es real y no está declarada en ningún sitio.
//
// Por eso «vive en una vista» NO es el hallazgo. El hallazgo es la TERCERA COLUMNA: que exista
// otra pantalla que pinta ese mismo documento y no usa la respuesta. Sin ella esto sería una
// preferencia de arquitectura, y se dice así.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ AST Y NO `grep`
//
// Hace falta saber si un literal de estado está en POSICIÓN DE DECISIÓN (`x === 'firmado'`) o es
// el texto de un rótulo, y si esa comparación GOBIERNA la creación de un control o solo está
// cerca. Las dos cosas son propiedades del sitio del nodo en el árbol, no de la cadena. Y un
// guard de texto se caza a sí mismo en el comentario que explica lo que prohíbe: aquí los
// comentarios ni existen, porque el árbol no los tiene.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// LOS ESTADOS NO SE ESCRIBEN AQUÍ: SE LEEN DE SU FUENTE
//
// Copiarlos sería la segunda lista de siempre: el día que alguien añada un estado, este censo se
// quedaría ciego JUSTO en el caso nuevo y seguiría dando verde. Si una lista no se puede leer, el
// censo lo DICE y para con exit 2.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_JS = 'public/dashboard/js';

const REF = (() => {
  const i = process.argv.indexOf('--ref');
  return i >= 0 ? process.argv[i + 1] : null;
})();
const JSON_OUT = process.argv.includes('--json');

function leer(rel) {
  if (!REF) {
    const abs = path.join(RAIZ, rel);
    return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  }
  try {
    // `stderr: 'ignore'`: un fichero que no existe en ese árbol es un dato, no un fallo — el
    // `fatal:` de git en la salida de error haría creer que el censo se ha roto.
    return execFileSync('git', ['show', `${REF}:${rel}`],
      { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

function listarJs() {
  if (!REF) {
    return fs.readdirSync(path.join(RAIZ, DIR_JS)).filter((n) => n.endsWith('.js')).sort();
  }
  const salida = execFileSync('git', ['ls-tree', '--name-only', `${REF}:${DIR_JS}`], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  return salida.split('\n').map((s) => s.trim()).filter((n) => n.endsWith('.js')).sort();
}

const arbol = (rel, fuente) =>
  ts.createSourceFile(rel, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

/**
 * Recorre TODO el subárbol. `forEachChild` CORTA en cuanto el visitante devuelve algo con valor
 * de verdad —trampa ya pagada en esta casa—, así que este envoltorio no devuelve nunca nada.
 */
function recorrer(nodo, visitar) {
  visitar(nodo);
  ts.forEachChild(nodo, (h) => { recorrer(h, visitar); return undefined; });
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① LOS ESTADOS Y LOS REGISTROS, LEÍDOS DE SU FUENTE
// ═════════════════════════════════════════════════════════════════════════════════════════════

function arrayDeLiterales(rel, nombre) {
  const fuente = leer(rel);
  if (fuente == null) return null;
  let hallado = null;
  recorrer(arbol(rel, fuente), (n) => {
    if (hallado || !ts.isVariableDeclaration(n)) return;
    if (!ts.isIdentifier(n.name) || n.name.text !== nombre) return;
    let init = n.initializer;
    if (init && ts.isAsExpression(init)) init = init.expression;   // `as const`
    if (!init || !ts.isArrayLiteralExpression(init)) return;
    const vals = init.elements.filter(ts.isStringLiteralLike).map((e) => e.text);
    if (vals.length) hallado = vals;
  });
  return hallado;
}

// `ruta`: por dónde se pide ese documento al servidor. Es lo que dice si una pantalla LO PINTA,
// y hace falta porque «decide por su estado» se quedaba corto: `jobDetailView.js` pinta un Trabajo
// entero sin comparar contra ningún literal de estado, así que quedaba fuera de la población y la
// tercera columna de SCRUM-823 salía VACÍA — justo la columna que sostiene el censo.
const DOCUMENTOS = [
  { doc: 'albarán',     fuente: `${DIR_JS}/albaranActionsRegistry.js`,   cte: 'ALBARAN_STATES', registro: 'ALBARAN_ACTION_REGISTRY', ruta: '/admin/albaranes' },
  { doc: 'factura',     fuente: `${DIR_JS}/invoiceActionsRegistry.js`,   cte: 'INVOICE_STATES', registro: 'INVOICE_ACTION_REGISTRY', ruta: '/admin/invoices' },
  { doc: 'presupuesto', fuente: `${DIR_JS}/quoteActionsRegistry.js`,     cte: 'QUOTE_STATES',   registro: 'QUOTE_ACTION_REGISTRY',   ruta: '/admin/quotes' },
  { doc: 'trabajo',     fuente: 'src/modules/jobs/domain/job.service.ts', cte: 'JOB_STATES',    registro: 'JOB_ACTION_REGISTRY',     ruta: '/admin/jobs' },
];

// ── LA CEGUERA SE DECLARA POR DOCUMENTO, NO SE TRAGA EL CENSO ENTERO ────────────────────────
//
// En un árbol de julio de 2026 los registros de albarán y presupuesto todavía no existían, y
// abortar allí dejaría sin poder comprobar el caso de SCRUM-366, que es de TRABAJOS y cuya FSM
// sí estaba. Así que cada documento que no se puede leer sale de la población y se DICE — pero
// un censo parcial no se presenta nunca como completo, y con cero documentos legibles no hay
// censo que valga.
const ESTADOS = new Map();      // literal → documento (o '(ambiguo)')
const SIN_FUENTE = [];
const MEDIBLES = [];
for (const d of DOCUMENTOS) {
  const vals = arrayDeLiterales(d.fuente, d.cte);
  if (!vals) { SIN_FUENTE.push(d); continue; }
  for (const v of vals) ESTADOS.set(v, ESTADOS.has(v) ? '(ambiguo)' : d.doc);
  d.valores = vals;
  MEDIBLES.push(d);
}
const REGISTRO_DE = new Map(MEDIBLES.map((d) => [d.doc, d.registro]));

// ── DOS COSAS QUE PARECEN LA MISMA Y SON OPUESTAS ───────────────────────────────────────────
//
// RESUELVE_A_MANO: la función abre el registro y lo resuelve ella. Ahí es donde vive la decisión,
// y si eso pasa dentro de una vista, la decisión está encerrada. Es la forma de SCRUM-831.
//
// YA_EXTRAIDO: la función LLAMA a un resolutor que ya vive fuera y es alcanzable. Eso es la CURA,
// no la enfermedad — y meterlo en el censo haría que `jobsView.js` saliera como defecto justo por
// haber hecho lo correcto en SCRUM-366. Un censo que penaliza centralizar empuja a duplicar.
const RESUELVE_A_MANO = new Set([
  'destinoEfectivo', 'incumplimientosDeLaLey', ...DOCUMENTOS.map((d) => d.registro),
]);
const YA_EXTRAIDO = new Set([
  'jobNextAction', 'primariaDeAlbaran', 'ctxAlbaranDeFila', 'destinoAccionTrabajo',
]);

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② HERRAMIENTAS DE ÁRBOL
// ═════════════════════════════════════════════════════════════════════════════════════════════

const ES_VISTA = (n) => /View\.js$/.test(n);

/** ¿Es este literal un ESTADO en posición de DECISIÓN, y no el texto de un rótulo? */
function comparacionDeEstado(nodo) {
  if (!ts.isStringLiteralLike(nodo) || !ESTADOS.has(nodo.text)) return null;
  const doc = ESTADOS.get(nodo.text);
  if (doc === '(ambiguo)') return null;
  const p = nodo.parent;
  if (!p) return null;
  if (ts.isBinaryExpression(p)) {
    const k = p.operatorToken.kind;
    if (k === ts.SyntaxKind.EqualsEqualsEqualsToken || k === ts.SyntaxKind.ExclamationEqualsEqualsToken
     || k === ts.SyntaxKind.EqualsEqualsToken      || k === ts.SyntaxKind.ExclamationEqualsToken) return doc;
  }
  if (ts.isCaseClause(p)) return doc;
  if (ts.isArrayLiteralExpression(p)) return doc;
  if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression)
      && /^(includes|indexOf|has)$/.test(p.expression.name.text)) return doc;
  return null;
}

/** ¿Crea este nodo un CONTROL con el que el usuario actúa? */
function esControl(n) {
  if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
    const m = n.expression.name.text;
    const a0 = n.arguments[0];
    if (m === 'createElement' && a0 && ts.isStringLiteralLike(a0) && /^(button|a)$/.test(a0.text)) return true;
    if (m === 'addEventListener' && a0 && ts.isStringLiteralLike(a0) && a0.text === 'click') return true;
  }
  if (ts.isPropertyAccessExpression(n) && n.name.text === 'onclick') return true;
  if (ts.isStringLiteralLike(n) && /<button|<a\s/i.test(n.text)) return true;
  return false;
}

/** ¿ESCRIBE este nodo un cambio de estado del documento? */
function esEscritura(n) {
  // `apiRequest('/admin/...', { method: 'PATCH' })` y familia
  if (ts.isCallExpression(n)) {
    const nom = ts.isIdentifier(n.expression) ? n.expression.text
              : ts.isPropertyAccessExpression(n.expression) ? n.expression.name.text : '';
    if (/^(apiRequest|pedir|fetch)$/.test(nom)) {
      for (const a of n.arguments) {
        if (!ts.isObjectLiteralExpression(a)) continue;
        for (const p of a.properties) {
          if (!ts.isPropertyAssignment(p) || !p.name) continue;
          const clave = ts.isIdentifier(p.name) || ts.isStringLiteralLike(p.name) ? p.name.text : '';
          if (clave === 'method' && ts.isStringLiteralLike(p.initializer)
              && /^(POST|PATCH|PUT|DELETE)$/i.test(p.initializer.text)) return true;
        }
      }
    }
  }
  // El patrón del panel: un objeto con `status`/`estado` puesto a un ESTADO, que se manda a
  // guardar. `patch({ status: 'agendado', ... })` es SCRUM-823 tal cual.
  if (ts.isObjectLiteralExpression(n)) {
    for (const p of n.properties) {
      if (!ts.isPropertyAssignment(p) || !p.name) continue;
      const clave = ts.isIdentifier(p.name) || ts.isStringLiteralLike(p.name) ? p.name.text : '';
      if (!/^(status|estado)$/.test(clave)) continue;
      if (ts.isStringLiteralLike(p.initializer) && ESTADOS.has(p.initializer.text)) return true;
    }
  }
  return false;
}

/** Sube desde un nodo hasta la rama que GOBIERNA: el `if`/ternario/`&&` cuya condición lo contiene. */
function ramaGobernada(nodo) {
  let hijo = nodo;
  let p = nodo.parent;
  while (p) {
    if (ts.isIfStatement(p) && p.expression.pos <= hijo.pos && hijo.end <= p.expression.end) {
      return [p.thenStatement, p.elseStatement].filter(Boolean);
    }
    if (ts.isConditionalExpression(p) && p.condition.pos <= hijo.pos && hijo.end <= p.condition.end) {
      return [p.whenTrue, p.whenFalse];
    }
    if (ts.isBinaryExpression(p)
        && (p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
         || p.operatorToken.kind === ts.SyntaxKind.BarBarToken)
        && p.left.pos <= hijo.pos && hijo.end <= p.left.end) {
      return [p.right];
    }
    if (ts.isCaseClause(p)) return [...p.statements];
    // Una función de por medio corta: ya no es «esta condición gobierna aquello».
    if (ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isArrowFunction(p)
        || ts.isMethodDeclaration(p) || ts.isSourceFile(p)) return [];
    hijo = p; p = p.parent;
  }
  return [];
}

function contiene(nodos, predicado) {
  let si = false;
  for (const n of nodos) recorrer(n, (x) => { if (!si && predicado(x)) si = true; });
  return si;
}

/**
 * TODAS las funciones CON NOMBRE del fichero, a cualquier profundidad, con su nodo.
 *
 * 🔴 A CUALQUIER PROFUNDIDAD, y esto es lo que hacía falta arreglar: mirando sólo las de nivel
 * superior, una señal que ocurre dentro de un ayudante anidado se le atribuía a la función que lo
 * contiene — y así `renderQuoteDetailView`, que ES la pantalla entera, salía como decisión
 * encerrada por algo que hacía un ayudante de dentro. Cada señal se atribuye a su función con
 * nombre MÁS INTERNA. Las anónimas (el manejador de un clic) no cortan: burbujean a la función
 * con nombre que las envuelve, que es donde `abrirAgendar` escribe el estado en SCRUM-823.
 */
function funcionesConNombre(sf) {
  const out = [];
  recorrer(sf, (n) => {
    if (ts.isFunctionDeclaration(n) && n.name) out.push({ nombre: n.name.text, nodo: n });
    else if (ts.isVariableDeclaration(n) && n.initializer && ts.isIdentifier(n.name)
             && (ts.isFunctionExpression(n.initializer) || ts.isArrowFunction(n.initializer)))
      out.push({ nombre: n.name.text, nodo: n.initializer });
  });
  // Y el ámbito: dentro de un IIFE no hay global que valga, así que eso es inalcanzable DE VERDAD
  // y no sólo mal colocado. Fuera de él, una `function` de nivel superior sí es global.
  for (const f of out) {
    let p = f.nodo.parent, dentroDeIife = false, profundidad = 0;
    while (p && !ts.isSourceFile(p)) {
      if (ts.isFunctionExpression(p) || ts.isArrowFunction(p) || ts.isFunctionDeclaration(p)) {
        profundidad += 1;
        if (ts.isCallExpression(p.parent) || (p.parent && ts.isParenthesizedExpression(p.parent)
            && p.parent.parent && ts.isCallExpression(p.parent.parent))) dentroDeIife = true;
      }
      p = p.parent;
    }
    f.profundidad = profundidad;
    f.ambito = profundidad === 0 ? 'global' : (dentroDeIife ? 'iife' : 'anidada');
  }
  return out;
}

/** La función con nombre MÁS INTERNA que contiene a este nodo, o `null`. */
function duenaDe(nodo, porNodo) {
  let p = nodo.parent;
  while (p) {
    const f = porNodo.get(p);
    if (f) return f;
    p = p.parent;
  }
  return null;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ③ EL CENSO
// ═════════════════════════════════════════════════════════════════════════════════════════════

const ficheros = listarJs();
const fuentes = new Map();
for (const f of ficheros) { const s = leer(`${DIR_JS}/${f}`); if (s != null) fuentes.set(f, s); }

/**
 * Qué documentos PINTA cada fichero. Dos señales, y hacen falta las dos:
 *   · decide por alguno de sus estados, o
 *   · lo PIDE al servidor por su ruta — que es lo que de verdad significa «esta pantalla enseña
 *     ese documento». Sin esto, `jobDetailView.js` no contaba como pantalla de Trabajos porque no
 *     compara contra literales de estado, y la tercera columna de SCRUM-823 salía vacía.
 */
const pinta = new Map();
for (const [f, src] of fuentes) {
  const set = new Set();
  recorrer(arbol(f, src), (n) => { const d = comparacionDeEstado(n); if (d) set.add(d); });
  for (const d of MEDIBLES) if (src.includes(d.ruta)) set.add(d.doc);
  pinta.set(f, set);
}

const candidatas = [];
for (const [f, src] of fuentes) {
  if (!ES_VISTA(f)) continue;
  const sf = arbol(f, src);

  // Lo que este fichero cuelga del global YA es alcanzable: no está encerrado.
  const expuestas = new Set();
  recorrer(sf, (n) => {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isPropertyAccessExpression(n.left) && ts.isIdentifier(n.left.expression)
        && n.left.expression.text === 'window') {
      expuestas.add(n.left.name.text);
      if (ts.isIdentifier(n.right)) expuestas.add(n.right.text);
    }
  });

  // ── LOS ALIAS DEL REGISTRO, QUE ES POR DONDE ESTE CENSO YA SE QUEDÓ CIEGO UNA VEZ ──────────
  //
  // `invoiceDetailView.js` no nombra `INVOICE_ACTION_REGISTRY` dentro del resolutor: guarda
  // `const REGISTRO_ACC = window.INVOICE_ACTION_REGISTRY` y usa el alias. Buscando sólo el nombre
  // del registro, la función que DE VERDAD resuelve las acciones de una factura salía con cero
  // documento y se descartaba — y el censo devolvía CERO resolutores de factura teniendo uno.
  //
  // Se cazó porque DOS NÚMEROS NO CUADRABAN: `INVOICE_ACTION_REGISTRY` tiene un consumidor y este
  // censo decía que ninguno. La sospecha no encuentra cegueras; las encuentra un número que no
  // cuadra con otro número.
  const ALIAS = new Map();   // nombre local → documento
  recorrer(sf, (n) => {
    if (!ts.isVariableDeclaration(n) || !ts.isIdentifier(n.name) || !n.initializer) return;
    recorrer(n.initializer, (x) => {
      const id = ts.isIdentifier(x) ? x.text : ts.isPropertyAccessExpression(x) ? x.name.text : null;
      if (!id) return;
      for (const d of MEDIBLES) if (d.registro === id) ALIAS.set(n.name.text, d.doc);
    });
  });

  const funciones = funcionesConNombre(sf);
  const porNodo = new Map(funciones.map((fn) => [fn.nodo, fn]));
  const señal = new Map(funciones.map((fn) => [fn, {
    docs: new Set(), docsRegistro: new Set(), pruebas: [],
    devuelveAccion: false, escribeEstado: false, gobiernaControl: false, llamaAlExtraido: false,
  }]));

  recorrer(sf, (n) => {
    const dueña = duenaDe(n, porNodo);
    if (!dueña) return;
    const s = señal.get(dueña);

    const ident = ts.isIdentifier(n) ? n.text
                : ts.isPropertyAccessExpression(n) ? n.name.text : null;
    // Su propio nombre no cuenta: con la auto-referencia, `jobNextAction` se clasificaba sola por
    // llamarse como se llama.
    if (ident && ident !== dueña.nombre) {
      // (A-1) RESUELVE A MANO: abre el registro y lo resuelve ella. El documento sale del NOMBRE
      // del registro, no de un literal — `primariaDeAlbaran` no compara con 'firmado', le pasa
      // `alb.estado` al registro, y exigirle la comparación perdía el caso de SCRUM-831.
      if (RESUELVE_A_MANO.has(ident)) {
        s.devuelveAccion = true;
        for (const d of MEDIBLES) if (d.registro === ident) s.docsRegistro.add(d.doc);
      }
      // El registro alcanzado por su alias local cuenta igual: el defecto es el mismo y el nombre
      // de la variable no lo cambia.
      if (ALIAS.has(ident)) { s.devuelveAccion = true; s.docsRegistro.add(ALIAS.get(ident)); }
      if (YA_EXTRAIDO.has(ident)) s.llamaAlExtraido = true;
    }
    // (A-2) devuelve un objeto que ES una acción: el `{ level, kind, label }` de la escalera.
    if (ts.isReturnStatement(n) && n.expression && ts.isObjectLiteralExpression(n.expression)) {
      const props = n.expression.properties.map((p) => (p.name && ts.isIdentifier(p.name) ? p.name.text : ''));
      if (props.includes('label') || props.includes('kind') || props.includes('rotulo')) s.devuelveAccion = true;
    }
    // (B) escribe un estado del documento — en cualquier sitio, también dentro del manejador de un
    // clic, que es donde lo hace `abrirAgendar` (SCRUM-823).
    if (esEscritura(n)) s.escribeEstado = true;

    const doc = comparacionDeEstado(n);
    if (!doc) return;
    s.docs.add(doc);
    const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
    if (s.pruebas.length < 3) s.pruebas.push({ estado: n.text, linea: line + 1 });
    // (C) la comparación GOBIERNA la creación de un control.
    const rama = ramaGobernada(n);
    if (rama.length && contiene(rama, esControl)) s.gobiernaControl = true;
  });

  for (const fn of funciones) {
    if (expuestas.has(fn.nombre)) continue;
    const s = señal.get(fn);

    // Llamar a un resolutor YA extraído es lo correcto: no es candidata por eso.
    let familia = null;
    if (s.devuelveAccion) familia = '① resolutor';
    else if (s.escribeEstado) familia = '③ ejecutor';
    else if (s.gobiernaControl && !s.llamaAlExtraido) familia = '② segunda fuente';
    if (!familia) continue;

    const docs = new Set([...s.docs, ...s.docsRegistro]);
    if (!docs.size) continue;   // sin documento identificado no hay tercera columna que dar
    if (familia === '② segunda fuente' && ![...docs].some((d) => REGISTRO_DE.has(d))) continue;

    candidatas.push({ fichero: f, ...fn, docs: [...docs], familia, pruebas: s.pruebas });
  }
}

/** Tercera columna: quién pinta ese documento, no es este fichero, y NO llama a la función. */
function huerfanas(c) {
  const out = [];
  const usa = new RegExp('\\b' + c.nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\(');
  for (const [otro, src] of fuentes) {
    if (otro === c.fichero || !ES_VISTA(otro)) continue;
    if (!c.docs.some((d) => pinta.get(otro).has(d))) continue;
    if (!usa.test(src)) out.push(otro);
  }
  return out;
}

const filas = candidatas.map((c) => ({ ...c, huerfanas: huerfanas(c) }));
const conHueco = filas.filter((c) => c.huerfanas.length);

if (JSON_OUT) {
  // Sin el nodo del AST: lleva `parent` y es circular. Se serializa lo que se puede afirmar,
  // no el árbol que lo produjo.
  const planas = filas.map(({ nodo, ...resto }) => resto);
  console.log(JSON.stringify({ ref: REF, ciego: SIN_FUENTE.map((d) => d.cte), filas: planas }, null, 2));
  // En un árbol HISTÓRICO la ceguera parcial es lo esperado (en julio de 2026 no existían dos de
  // los registros), y va dicha en el campo `ciego`: salir con error ahí convertiría un dato en un
  // fallo. En el árbol de trabajo sí es un fallo, y con el mismo criterio que el modo texto.
  process.exit(!REF && SIN_FUENTE.length ? 2 : 0);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ④ SALIDA
// ═════════════════════════════════════════════════════════════════════════════════════════════

const B = '═'.repeat(96);
console.log(`\n${B}\nCENSO DE DECISIONES ENCERRADAS EN UNA VISTA — SCRUM-837`);
console.log(`árbol: ${REF || '(el de trabajo)'}\n${B}\n`);

if (!MEDIBLES.length) {
  console.log('🔴 CIEGO DEL TODO: no he podido leer NINGÚN juego de estados en su fuente.');
  for (const d of SIN_FUENTE) console.log(`     ${d.cte} en ${d.fuente}`);
  console.log('\n   «No encuentro nada» significaría «no sé mirar». No hay censo.\n');
  process.exit(2);
}

console.log('ESTADOS LEÍDOS DE SU FUENTE (no escritos aquí):');
for (const d of MEDIBLES) console.log(`   ${d.doc.padEnd(12)} ${d.valores.join(', ')}`);
if (SIN_FUENTE.length) {
  console.log('\n   ⚠️ FUERA DE ESTE CENSO — su lista de estados no existe en este árbol:');
  for (const d of SIN_FUENTE) console.log(`      ${d.doc.padEnd(12)} (${d.cte} en ${d.fuente})`);
  console.log('      Lo que salga abajo NO cubre esos documentos. Un censo parcial que se');
  console.log('      presenta como completo es peor que no tenerlo.');
}
console.log(`   ${'-'.repeat(64)}`);
console.log(`   ${fuentes.size} ficheros en ${DIR_JS} · ${[...fuentes.keys()].filter(ES_VISTA).length} vistas\n`);

console.log(`${B}\nLAS TRES COLUMNAS\n${B}\n`);
for (const c of [...conHueco, ...filas.filter((x) => !x.huerfanas.length)]) {
  console.log(`▸ QUÉ DECIDE   ${c.nombre}()  ·  ${c.familia}  ·  documento: ${c.docs.join(' + ')}`);
  console.log(`               mira: ${c.pruebas.map((p) => `'${p.estado}' (l.${p.linea})`).join(', ')}`);
  console.log(`  DÓNDE VIVE   ${c.fichero}${c.ambito === 'iife' ? '   ⚠️ dentro de un IIFE: inalcanzable de verdad' : ''}`);
  if (c.huerfanas.length) {
    console.log('  🔴 QUIÉN LA NECESITA Y NO LA TIENE');
    for (const h of c.huerfanas) console.log(`               ${h}`);
  } else {
    console.log('  ✅ NADIE MÁS   ninguna otra vista pinta ese documento: colocación, no hueco');
  }
  console.log('');
}
if (!filas.length) console.log('   (ninguna candidata)\n');

console.log(B);
console.log(`RESULTADO: ${filas.length} decisiones encerradas · ${conHueco.length} con otra pantalla que las necesita`);
for (const fam of ['① resolutor', '② segunda fuente', '③ ejecutor']) {
  const n = filas.filter((c) => c.familia === fam).length;
  console.log(`   ${fam.padEnd(20)} ${n}`);
}
console.log(B);

if (!filas.length) {
  console.log('\n⚠️ CERO CANDIDATAS. Eso NO es «está limpio» mientras no se compruebe que este censo');
  console.log('   caza los tres casos conocidos. Lo hace `tests/scrum837-decisiones-encerradas.test.mjs`');
  console.log('   sembrando 16ba5cf4^ (366), 786bdc59^ (823) y 9cacafad^ (831).\n');
}

// En el árbol de trabajo TODAS las fuentes tienen que existir. Que falte una allí no es historia:
// es que alguien movió o renombró un registro y este censo se quedó tuerto sin decirlo.
if (!REF && SIN_FUENTE.length) process.exit(2);
