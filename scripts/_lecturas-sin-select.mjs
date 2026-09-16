// docs/master/evidencias/scrum860/clasificar-lecturas-sin-select.mjs — SCRUM-860 ①②
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 146 ES EL TAMAÑO DEL CENSO, NO EL DEL PROBLEMA.
//
// El número que decide la prioridad es cuántas de esas lecturas acaban **serializadas en una
// respuesta al cliente**. Una lectura interna que alimenta un cálculo y nunca sale por la API no
// es lo mismo, y meterlas en el mismo saco es lo que produce el guard demasiado amplio que acaban
// relajando (lo dice el propio ticket, §3).
//
// ⛔ ESTO CLASIFICA. No arregla ninguna, no toca `src/`, no escribe guard.
//
// ── EL MÉTODO, DECLARADO — y sus límites con él ──────────────────────────────────────────────
// Por cada lectura sin `select` de primer nivel:
//
//   ① se localiza la función que la contiene;
//   ② se ENSUCIA lo que la lectura liga y se propaga dentro de esa función (asignaciones,
//      destructuring, `for…of`, y las derivadas de todas ellas);
//   ③ si algo sucio entra en `res.json(x)` / `res.send(x)` / `res.status(n).json(x)` de esa misma
//      función  → **HACIA FUERA (directo)**;
//   ④ si no, y la función DEVUELVE algo sucio y está exportada → se buscan sus llamadores en todo
//      `src/`; si alguno serializa el resultado de la llamada → **HACIA FUERA (por su llamador)**;
//   ⑤ si devuelve algo sucio y no se le encuentran llamadores, o los llamadores no se pueden
//      seguir → **NO CLASIFICADO**;
//   ⑥ si lo sucio no se devuelve ni se serializa —sólo alimenta cálculos o escrituras→ **INTERNA**.
//
// 🔴 LOS LÍMITES, DICHOS ANTES QUE EL NÚMERO:
//   · el seguimiento de llamadores es de **UN salto**. Una cadena servicio→servicio→handler sale
//     NO CLASIFICADO, no INTERNA.
//   · no se resuelven llamadas dinámicas, re-exportaciones ni `Promise.all([...])` con desestructura
//     cruzada; todo eso cae en NO CLASIFICADO.
//   · 🔒 **NO CLASIFICADO NO ES SANO.** Es «no lo sé», y se cuenta aparte a propósito: esta mañana,
//     de 29 candidatos clasificados estáticamente, 26 cambiaron de veredicto al ejecutarlos. Una
//     clasificación estática es una hipótesis hasta que alguien sigue el camino.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const ts = createRequire(path.join(RAIZ, 'package.json'))('typescript');

const LECTORAS = new Set(['findMany', 'findFirst', 'findUnique', 'findFirstOrThrow', 'findUniqueOrThrow']);
const SERIALIZA = new Set(['json', 'send', 'jsonp']);

function ficheros(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficheros(p, out);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const texto = (n, sf) => n.getText(sf).replace(/\s+/g, ' ');
const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');

function esLectura(n, sf) {
  if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) return null;
  const metodo = n.expression.name.text;
  if (!LECTORAS.has(metodo)) return null;
  const sujeto = n.expression.expression;
  if (!ts.isPropertyAccessExpression(sujeto)) return null;
  if (!/\b(prisma|tx|db|client)\b/i.test(texto(sujeto.expression, sf))) return null;
  const arg = n.arguments[0];
  if (!arg || !ts.isObjectLiteralExpression(arg)) return null;
  const tieneSelect = arg.properties.some((p) => p.name && ts.isIdentifier(p.name) && p.name.text === 'select');
  const tieneInclude = arg.properties.some((p) => p.name && ts.isIdentifier(p.name) && p.name.text === 'include');
  return { modelo: sujeto.name.text, metodo, tieneSelect, tieneInclude };
}

/**
 * 🔴 UN HANDLER TERMINAL NO TIENE LLAMADORES, Y ESO NO ES «NO LO SÉ».
 *
 * A un `router.get('/x', async (req, res) => ...)` lo llama Express, no `src/`. La primera versión
 * de este clasificador buscaba llamadores POR NOMBRE, y una función anónima no tiene ninguno, así
 * que caía en «no se le encuentran llamadores» — que suena a incógnita y era una CERTEZA: no los
 * tiene por diseño.
 *
 * 🔒 Ésa era la vía que se me escapaba, y vale más que los nueve casos: el instrumento confundía
 * «no hay a quién preguntar» con «no sé». En un handler terminal se decide EN EL SITIO — o
 * serializa lo sucio, o no sale por ahí.
 */
function esHandlerTerminal(fn) {
  if (fn.parameters.some((p) => ts.isIdentifier(p.name) && /^(res|response)$/.test(p.name.text))) return true;
  const p = fn.parent;
  return !!(p && ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression)
    && /^(get|post|put|patch|delete|all|use)$/.test(p.expression.name.text));
}

/** La función que envuelve a un nodo, y su nombre si lo tiene. */
function envolvente(n) {
  for (let s = n.parent; s; s = s.parent) {
    if (ts.isFunctionDeclaration(s) || ts.isFunctionExpression(s) || ts.isArrowFunction(s) || ts.isMethodDeclaration(s)) {
      let nombre = s.name && ts.isIdentifier(s.name) ? s.name.text : null;
      if (!nombre && s.parent && ts.isVariableDeclaration(s.parent) && ts.isIdentifier(s.parent.name)) {
        nombre = s.parent.name.text;
      }
      return { nodo: s, nombre };
    }
  }
  return null;
}

const nombresDe = (name, out = []) => {
  if (ts.isIdentifier(name)) out.push(name.text);
  else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    for (const el of name.elements) if (ts.isBindingElement(el)) nombresDe(el.name, out);
  }
  return out;
};

/** Ensucia lo que sale de `semilla` y propaga dentro de `fn`. Devuelve {sucios, devuelveSucio}. */
function propagar(fn, semillaNodo, sf) {
  const sucios = new Set();
  const decls = [];

  // la declaración/asignación que liga la lectura
  for (let s = semillaNodo.parent; s && s !== fn; s = s.parent) {
    if (ts.isVariableDeclaration(s)) { for (const x of nombresDe(s.name)) sucios.add(x); break; }
    if (ts.isBinaryExpression(s) && s.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      for (const x of nombresDe(s.left)) sucios.add(x); break;
    }
    if (ts.isReturnStatement(s)) { sucios.add('@@return'); break; }
  }

  const rec = (n) => {
    if (ts.isVariableDeclaration(n) && n.initializer) decls.push({ name: n.name, init: n.initializer });
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      decls.push({ name: n.left, init: n.right });
    }
    if (ts.isForOfStatement(n) && ts.isVariableDeclarationList(n.initializer)) {
      for (const d of n.initializer.declarations) decls.push({ name: d.name, init: n.expression });
    }
    ts.forEachChild(n, rec);
  };
  ts.forEachChild(fn, rec);

  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const d of decls) {
      const ligados = nombresDe(d.name);
      if (!ligados.length || ligados.every((x) => sucios.has(x))) continue;
      const t = texto(d.init, sf);
      if ([...sucios].some((s) => s !== '@@return' && new RegExp(`\\b${s}\\b`).test(t))) {
        for (const x of ligados) sucios.add(x);
        cambio = true;
      }
    }
  }

  // ¿devuelve algo sucio?
  let devuelveSucio = sucios.has('@@return');
  const mira = (n) => {
    if (ts.isReturnStatement(n) && n.expression) {
      const t = texto(n.expression, sf);
      if ([...sucios].some((s) => s !== '@@return' && new RegExp(`\\b${s}\\b`).test(t))) devuelveSucio = true;
    }
    if (ts.isFunctionLike(n) && n !== fn) return;
    ts.forEachChild(n, mira);
  };
  ts.forEachChild(fn, mira);

  return { sucios, devuelveSucio };
}

/** ¿Hay `res.json(x)` / `res.send(x)` en `fn` con algo de `sucios` dentro? */
function serializaAlgo(fn, sucios, sf) {
  let si = false;
  const mira = (n) => {
    if (si) return;
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && SERIALIZA.has(n.expression.name.text)) {
      const t = n.arguments.map((a) => texto(a, sf)).join(' , ');
      if ([...sucios].some((s) => s !== '@@return' && new RegExp(`\\b${s}\\b`).test(t))) si = true;
    }
    ts.forEachChild(n, mira);
  };
  ts.forEachChild(fn, mira);
  return si;
}

// ── PASADA 1: recoger las lecturas sin select ────────────────────────────────────────────────
const FUENTES = ficheros(path.join(RAIZ, 'src'));
const arboles = new Map();
for (const f of FUENTES) {
  arboles.set(f, ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS));
}

const sinSelect = [];
let totalLecturas = 0; let conSelect = 0;
for (const [f, sf] of arboles) {
  const rec = (n) => {
    const L = esLectura(n, sf);
    if (L) {
      totalLecturas += 1;
      if (L.tieneSelect) conSelect += 1;
      else {
        const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
        sinSelect.push({ fichero: rel(f), f, sf, nodo: n, linea: line + 1, ...L });
      }
    }
    ts.forEachChild(n, rec);
  };
  rec(sf);
}

// ── PASADA 2: clasificar ─────────────────────────────────────────────────────────────────────
/** ¿Algún llamador de `nombre` serializa el resultado? (UN salto) */
function llamadorSerializa(nombre) {
  if (!nombre) return { hay: false, seguido: false };
  let hay = false; let seguido = false;
  for (const [f, sf] of arboles) {
    const rec = (n) => {
      if (hay) return;
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === nombre) {
        const env = envolvente(n);
        if (env) {
          seguido = true;
          const { sucios } = propagar(env.nodo, n, sf);
          if (serializaAlgo(env.nodo, sucios, sf)) { hay = true; return; }
        }
      }
      ts.forEachChild(n, rec);
    };
    rec(sf);
    if (hay) break;
  }
  return { hay, seguido };
}

const R = { HACIA_FUERA: [], INTERNA: [], NO_CLASIFICADO: [] };
for (const L of sinSelect) {
  const env = envolvente(L.nodo);
  if (!env) { R.NO_CLASIFICADO.push({ ...L, motivo: 'la lectura no está dentro de una función' }); continue; }
  const { sucios, devuelveSucio } = propagar(env.nodo, L.nodo, L.sf);

  if (serializaAlgo(env.nodo, sucios, L.sf)) {
    R.HACIA_FUERA.push({ ...L, via: 'directo', fn: env.nombre });
    continue;
  }
  if (esHandlerTerminal(env.nodo)) {
    // No serializa lo sucio y nadie lo llama: la fila no sale por aquí. Decidido, no ignorado.
    R.INTERNA.push({ ...L, fn: env.nombre || '(handler anónimo)', via: 'handler terminal' });
    continue;
  }
  if (devuelveSucio) {
    const { hay, seguido } = llamadorSerializa(env.nombre);
    if (hay) { R.HACIA_FUERA.push({ ...L, via: 'por su llamador', fn: env.nombre }); continue; }
    // 🔴 EL CALLBACK DE `$transaction` ES OTRA FRONTERA QUE EL SEGUIMIENTO POR NOMBRE NO CRUZA.
    // `const x = await prisma.$transaction(async (tx) => { … return fila; })` devuelve la fila a la
    // función de FUERA, pero el callback es anónimo y no es un handler terminal: no hay nombre al
    // que buscarle llamadores y sin embargo su valor sí viaja. Se le da motivo propio en vez de
    // dejarlo en «sin llamadores», que sonaba a código muerto y no lo es.
    const enTransaccion = !!(env.nodo.parent && ts.isCallExpression(env.nodo.parent)
      && /\$transaction/.test(texto(env.nodo.parent.expression, L.sf)));
    R.NO_CLASIFICADO.push({
      ...L, fn: env.nombre,
      motivo: enTransaccion
        ? 'devuelve el dato desde un callback de `$transaction`: el valor vuelve a la función de fuera y el seguimiento por nombre no cruza esa frontera'
        : seguido ? 'devuelve el dato y su llamador (1 salto) no serializa: la cadena sigue'
                  : 'devuelve el dato y no se le encuentran llamadores en src/',
    });
    continue;
  }
  R.INTERNA.push({ ...L, fn: env.nombre });
}

/**
 * El SUELO del propio instrumento: si no reconoce lecturas, o ninguna CON select, no esta
 * clasificando -- esta contestando lo mismo a todo, y su lista no significaria nada.
 */
export function motivosParaNoFiarse() {
  const m = [];
  if (!totalLecturas) m.push(`CERO lecturas de Prisma reconocidas en src/`);
  if (!conSelect) m.push(`NINGUNA lectura con select: el clasificador no distingue`);
  if (!sinSelect.length) m.push(`CERO lecturas sin select: se midieron 146`);
  return m;
}

export const RESUMEN = () => ({
  totalLecturas, conSelect, sinSelect: sinSelect.length,
  haciaFuera: R.HACIA_FUERA.length, interna: R.INTERNA.length, noClasificado: R.NO_CLASIFICADO.length,
});

/** Las que caen del lado MALO: se serializan, o no se ha podido probar que no. */
export const expuestas = () => [...R.HACIA_FUERA, ...R.NO_CLASIFICADO]
  .map((x) => ({ fichero: x.fichero, linea: x.linea, modelo: x.modelo, metodo: x.metodo,
                 lado: R.HACIA_FUERA.includes(x) ? 'HACIA FUERA' : 'NO CLASIFICADO' }))
  .sort((a, b) => a.fichero.localeCompare(b.fichero) || a.linea - b.linea);

/**
 * 🔴 LA MISMA CLASIFICACIÓN, PERO CON FUENTES VIRTUALES AÑADIDAS.
 *
 * Es lo que permite probar el trinquete SIN escribir ficheros en el árbol: se le pasa
 * `[{ ruta, texto }]` y se clasifica como si esos ficheros existieran en `src/`. Sin esto, el
 * control «añade una lectura nueva y mira si el guard cae» exigiría crear un `.ts` de verdad —
 * justo lo que SCRUM-824 vino a quitar de la tanda.
 *
 * Usa EL MISMO criterio que la pasada real: si alguien lo cambia, cambia para los dos a la vez.
 */
export function analizarCon(extra = []) {
  const mapa = new Map(arboles);
  for (const { ruta, texto: src } of extra) {
    const p = path.join(RAIZ, ruta);
    mapa.set(p, ts.createSourceFile(p, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS));
  }

  const buscaLlamador = (nombre) => {
    if (!nombre) return { hay: false, seguido: false };
    let hay = false; let seguido = false;
    for (const [, sf] of mapa) {
      const rec = (n) => {
        if (hay) return;
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === nombre) {
          const env = envolvente(n);
          if (env) { seguido = true; if (serializaAlgo(env.nodo, propagar(env.nodo, n, sf).sucios, sf)) { hay = true; return; } }
        }
        ts.forEachChild(n, rec);
      };
      rec(sf);
      if (hay) break;
    }
    return { hay, seguido };
  };

  const out = { HACIA_FUERA: [], INTERNA: [], NO_CLASIFICADO: [] };
  for (const [f, sf] of mapa) {
    const rec = (n) => {
      const L = esLectura(n, sf);
      if (L && !L.tieneSelect) {
        const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
        const base = { fichero: rel(f), linea: line + 1, modelo: L.modelo, metodo: L.metodo };
        const env = envolvente(n);
        if (!env) out.NO_CLASIFICADO.push({ ...base, motivo: 'fuera de toda función' });
        else {
          const { sucios, devuelveSucio } = propagar(env.nodo, n, sf);
          if (serializaAlgo(env.nodo, sucios, sf)) out.HACIA_FUERA.push({ ...base, via: 'directo' });
          else if (esHandlerTerminal(env.nodo)) out.INTERNA.push({ ...base, via: 'handler terminal' });
          else if (devuelveSucio) {
            const { hay } = buscaLlamador(env.nombre);
            if (hay) out.HACIA_FUERA.push({ ...base, via: 'por su llamador' });
            else out.NO_CLASIFICADO.push({ ...base, motivo: 'devuelve el dato y no se pudo seguir' });
          } else out.INTERNA.push({ ...base });
        }
      }
      ts.forEachChild(n, rec);
    };
    rec(sf);
  }
  return out;
}

/** Las del lado malo de un resultado de `analizarCon`. */
export const expuestasDe = (res) => [...res.HACIA_FUERA, ...res.NO_CLASIFICADO]
  .sort((a, b) => a.fichero.localeCompare(b.fichero) || a.linea - b.linea);

export { R, sinSelect };
