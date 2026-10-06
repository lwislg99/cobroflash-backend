// scripts/_censo-gemelo-crudo.mjs — SCRUM-1452
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 «ARREGLADO EN UN SITIO, SU GEMELO ATRÁS» — las DOS formas del patrón que sí se cazan por AST.
//
// SCRUM-1444 (S1) censó por TEXTO los sitios donde existe un helper y no se usa, y lo dijo en su
// título: es un suelo, no un techo. Un `git grep` no ve un crudo partido en dos líneas, ni uno
// escrito por concatenación, ni distingue un texto que sale hacia fuera de un `console.log`. Este
// fichero mira las dos formas que el orquestador decidió convertir en guard, por SINTAXIS:
//
//   NUMERO  · un valor interpolado justo detrás de un `#` — `#${quote.quoteNumber ?? quote.id}`,
//             o `'#' + quote.id` — que no pasa por el helper del número (`HELPERS_NUMERO`). Es el
//             documento diciendo otro nombre de sí mismo, y cuando el valor es el `id` de la tabla,
//             un id enumerable a la vista (familia de SCRUM-95).
//   IMPORTE · un `x.toFixed(2)` PEGADO a una moneda dentro del mismo texto — `${t.toFixed(2)} €`,
//             `${t.toFixed(2)} ${currency}` — en vez de `formatMoneyEs` y familia.
//
// ── POR QUÉ NO NECESITA TIPOS ───────────────────────────────────────────────────────────────────
// Las dos formas son de SINTAXIS: qué pieza de texto hay a cada lado de una interpolación. Se parsea
// cada fichero suelto (`ts.createSourceFile`), sin `Program` ni `TypeChecker`: no levanta el
// compilador entero, y un fichero que no se puede parsear se NOMBRA en vez de callarse.
//
// ── A DÓNDE VA EL TEXTO: tres respuestas, y la tercera es «no lo sé» ────────────────────────────
// Desde el texto se sube por el árbol hasta lo primero que lo CONSUME:
//   DENTRO        argumento de `console.*` / `logger.*` / `log.*`. No se acusa.
//   FUERA         una propiedad o una llamada de `SUMIDEROS_FUERA` (un `text:`, un `subject:`, un
//                 `res.send(…)`, un `doc.text(…)`…). Se acusa.
//   NO_DECIDIBLE  todo lo demás: una variable intermedia, un `return`, un `throw new Error(…)` cuyo
//                 mensaje puede acabar en una respuesta. Se acusa IGUAL y se cuenta aparte: lo que
//                 no se pudo decidir no se da por bueno.
// Sólo DENTRO libra. Así la lista de sumideros puede quedarse corta sin que el guard se quede
// ciego: un sumidero que falta degrada FUERA a NO_DECIDIBLE, nunca a limpio.
//
// ── LO QUE NO VE, DECLARADO ─────────────────────────────────────────────────────────────────────
//   · Las familias donde el crudo es la AUSENCIA de una llamada: `esc()`, `normalizePhone`,
//     «aceptado» (`status === 'accepted'`). No hay forma que buscar; SCRUM-1444 las dejó fuera a
//     propósito y aquí siguen fuera.
//   · El importe que pasa por una variable: `const t = x.toFixed(2)` y, más abajo, `${t} €`. El
//     `toFixed` suelto se CUENTA (clase `SUELTO`) pero no se acusa.
//   · Un `toFixed` con otro número de decimales, y `Intl.NumberFormat` / `toLocaleString` a mano.
//   · Un `#` que no está pegado al valor: `Presupuesto nº ${id}`, `# ${id}`.
//   · `public/` entero (JavaScript de navegador): la población es `src/**/*.ts`.
//   · Lo que hace la función que recibe el texto: el sumidero se decide en el sitio, no siguiendo
//     el dato.
//
// ⛔ NO EJECUTA NADA DEL PRODUCTO. Sólo lee y parsea (`typescript`, ya en el árbol).
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { identidadDe } from './_censo-fecha-sin-zona.mjs';

const require_ = createRequire(import.meta.url);
const ts = require_('typescript');

/** La raíz es la del árbol donde vive este fichero, no la de la casa de `typescript` (SCRUM-1377). */
export const RAIZ = path.resolve(import.meta.dirname, '..');
export const CARPETAS = ['src'];
const EXT = new Set(['.ts']);
const FUERA_DEL_CENSO = new Set(['node_modules', '.git', 'dist', 'coverage', 'storage']);

export const NUMERO = 'NUMERO';
export const IMPORTE = 'IMPORTE';

export const DENTRO = 'DENTRO';
export const FUERA = 'FUERA';
export const NO_DECIDIBLE = 'NO_DECIDIBLE';

/** Los helpers que SÍ dan el nombre visible de un documento. Un `#${helper(…)}` no es un crudo. */
export const HELPERS_NUMERO = new Set([
  'displayQuoteNumber',
  'numeroConRevision',
  'formatInvoiceNumber',
  'formatAlbaranNumber',
  'formatParteNumber',
]);

/** Qué convierte un texto en «lleva una moneda»: una pieza escrita que la nombra… */
const MONEDA_ESCRITA = /€|&euro;|\bEUR\b|\beuros?\b/i;
/** …o una pieza interpolada que es una referencia a ella: un identificador o propiedad con este nombre. */
const NOMBRE_DE_MONEDA = /^(?:currency|currencySymbol|moneda|divisa|simbolo|symbol|cur)$/i;

/**
 * Sumideros que se sabe que salen HACIA FUERA. No es la lista que decide si un sitio se acusa (eso
 * lo decide no ser DENTRO): sólo separa «sé que sale» de «no lo sé».
 */
export const SUMIDEROS_FUERA = {
  propiedades: new Set(['text', 'subject', 'html', 'body', 'caption', 'title', 'message', 'description', 'concept', 'footer', 'header']),
  llamadas: /(?:^|\.)(?:send|json|end|write|text|sendWhatsApp\w*|sendText\w*|sendEmail\w*|sendMail\w*|notify\w*)$/,
};
const LLAMADA_DENTRO = /^(?:console|logger|log)\.\w+$/;

function ficherosDe(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (FUERA_DEL_CENSO.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosDe(p, out);
    else if (EXT.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

const sinParentesis = (n) => {
  let x = n;
  while (x && (ts.isParenthesizedExpression(x) || ts.isAsExpression(x) || ts.isNonNullExpression(x))) x = x.expression;
  return x;
};

const esSuma = (n) => ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken;
const esLiteralDeTexto = (n) => ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);

/**
 * Un texto, aplanado en sus PIEZAS en orden: `{ lit }` para lo escrito y `{ expr }` para lo
 * interpolado. Aplana una plantilla y una cadena de `+`, y una dentro de otra; cualquier otra cosa
 * (una llamada, un ternario) es UNA pieza `expr` opaca.
 */
function piezasDe(n, out = []) {
  const x = sinParentesis(n);
  if (esLiteralDeTexto(x)) out.push({ lit: x.text });
  else if (ts.isTemplateExpression(x)) {
    out.push({ lit: x.head.text });
    for (const s of x.templateSpans) {
      out.push({ expr: s.expression });
      out.push({ lit: s.literal.text });
    }
  } else if (esSuma(x)) {
    piezasDe(x.left, out);
    piezasDe(x.right, out);
  } else out.push({ expr: x });
  return out;
}

/** El texto ENTERO que contiene a `n`: sube mientras siga dentro de una plantilla o de un `+`. */
function textoQueContiene(n) {
  let top = null;
  for (let x = n; x.parent; x = x.parent) {
    const p = x.parent;
    if (ts.isTemplateSpan(p)) { top = p.parent; x = p; continue; }
    if (esSuma(p)) { top = p; continue; }
    if (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isNonNullExpression(p)) continue;
    // Un ternario o un `??`/`||` DENTRO de una interpolación no rompe el texto: lo atraviesa.
    if (top === null) break;
    if (ts.isConditionalExpression(p)
      || (ts.isBinaryExpression(p) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(p.operatorToken.kind))) {
      // sólo si ese ternario sigue siendo pieza de un texto de más arriba
      let q = p;
      while (q.parent && (ts.isParenthesizedExpression(q.parent))) q = q.parent;
      if (q.parent && (ts.isTemplateSpan(q.parent) || esSuma(q.parent))) continue;
    }
    break;
  }
  return top;
}

/** ¿Hay, en cualquier parte de `expr`, una llamada a alguno de `nombres`? */
function llamaA(expr, nombres) {
  let si = false;
  const rec = (n) => {
    if (si) return;
    if (ts.isCallExpression(n)) {
      const c = n.expression;
      const nombre = ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : null;
      if (nombre && nombres.has(nombre)) { si = true; return; }
    }
    ts.forEachChild(n, rec);
  };
  rec(expr);
  return si;
}

/**
 * ¿`expr` ES una referencia a la moneda? `currency`, `invoice.currency`, `cur || invoice.currency`,
 * `params.currency ?? 'EUR'`. Una llamada o un texto anidado que la mencione por dentro NO cuenta:
 * es otra pieza, con su propio texto, y se mira cuando le toque.
 */
function esReferenciaAMoneda(expr) {
  const x = sinParentesis(expr);
  if (ts.isIdentifier(x)) return NOMBRE_DE_MONEDA.test(x.text);
  if (ts.isPropertyAccessExpression(x)) return NOMBRE_DE_MONEDA.test(x.name.text);
  if (ts.isStringLiteral(x)) return MONEDA_ESCRITA.test(x.text);
  if (ts.isBinaryExpression(x) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(x.operatorToken.kind)) {
    return esReferenciaAMoneda(x.left) || esReferenciaAMoneda(x.right);
  }
  return false;
}

/** ¿El valor es SÓLO el `id` de algo (`x.id`, `id`, `quoteId`), sin número de serie por delante? */
function esSoloId(expr, sf) {
  const t = sinParentesis(expr).getText(sf);
  return /^(?:[\w.?!]+\.)?id$/.test(t) || /^[A-Za-z_]\w*Id$/.test(t);
}

/**
 * A dónde va el texto `top`: sube hasta lo primero que lo consume y lo nombra. Devuelve
 * `{ destino, sumidero }`, con `sumidero` legible (`prop text`, `llamada res.send`, `var cuerpo`…).
 */
function destinoDe(top, sf) {
  for (let x = top; x.parent; x = x.parent) {
    const p = x.parent;
    if (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isNonNullExpression(p)
      || ts.isConditionalExpression(p) || ts.isBinaryExpression(p) || ts.isTemplateSpan(p)
      || ts.isTemplateExpression(p) || ts.isArrayLiteralExpression(p) || ts.isSpreadElement(p)
      || ts.isAwaitExpression(p) || ts.isTaggedTemplateExpression(p)) continue;
    // `[…].join('\n')`, `texto.trim()`: el texto sigue siendo texto.
    if (ts.isPropertyAccessExpression(p) && p.expression === x && p.parent && ts.isCallExpression(p.parent)
      && p.parent.expression === p) { x = p; continue; }
    if (ts.isCallExpression(p) || ts.isNewExpression(p)) {
      if (p.expression === x) continue;
      const nombre = p.expression.getText(sf).replace(/\s+/g, '');
      if (ts.isNewExpression(p)) return { destino: NO_DECIDIBLE, sumidero: `new ${nombre}` };
      if (LLAMADA_DENTRO.test(nombre)) return { destino: DENTRO, sumidero: `llamada ${nombre}` };
      if (SUMIDEROS_FUERA.llamadas.test(nombre)) return { destino: FUERA, sumidero: `llamada ${nombre}` };
      return { destino: NO_DECIDIBLE, sumidero: `llamada ${nombre}` };
    }
    if (ts.isPropertyAssignment(p)) {
      const nombre = p.name.getText(sf).replace(/^['"]|['"]$/g, '');
      return { destino: SUMIDEROS_FUERA.propiedades.has(nombre) ? FUERA : NO_DECIDIBLE, sumidero: `prop ${nombre}` };
    }
    if (ts.isVariableDeclaration(p)) return { destino: NO_DECIDIBLE, sumidero: `var ${p.name.getText(sf)}` };
    if (ts.isReturnStatement(p) || ts.isArrowFunction(p)) return { destino: NO_DECIDIBLE, sumidero: 'return' };
    return { destino: NO_DECIDIBLE, sumidero: ts.SyntaxKind[p.kind] };
  }
  return { destino: NO_DECIDIBLE, sumidero: '(raíz)' };
}

/** `x.toFixed(2)`: acceso a propiedad `toFixed`, un argumento, el literal numérico dos. */
function esToFixedDos(n) {
  return ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
    && n.expression.name.text === 'toFixed' && n.arguments.length === 1
    && ts.isNumericLiteral(n.arguments[0]) && Number(n.arguments[0].text) === 2;
}

/**
 * Censa UN fuente. `rel` es su ruta relativa con `/` (la que irá en la identidad). Devuelve
 * `{ filas, sueltos, error }`: `error` no nulo = no se pudo analizar, y entonces `filas` NO vale.
 *
 * Una fila: `{ forma, fichero, linea, identidad, destino, sumidero, valor, soloId }`.
 * `sueltos` cuenta los `toFixed(2)` que NO están pegados a una moneda (población de IMPORTE).
 */
export function censarFuente(rel, texto) {
  const sf = ts.createSourceFile(rel, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (sf.parseDiagnostics?.length) {
    const d = sf.parseDiagnostics[0];
    const { line } = sf.getLineAndCharacterOfPosition(d.start ?? 0);
    return { filas: [], sueltos: 0, enTextoSinMoneda: 0, error: `no parsea (${rel}:${line + 1}): ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}` };
  }
  const filas = [];
  let sueltos = 0;
  let enTextoSinMoneda = 0;
  const fila = (forma, nodo, top, valor, extra = {}) => {
    const { line } = sf.getLineAndCharacterOfPosition(nodo.getStart(sf));
    filas.push({
      forma, fichero: rel, linea: line + 1,
      identidad: `${forma}|${rel}::${identidadDe(nodo, sf)}`,
      ...destinoDe(top, sf),
      valor: valor.getText(sf).replace(/\s+/g, ' ').slice(0, 80),
      ...extra,
    });
  };

  /** NUMERO: en un texto, una pieza `expr` cuya pieza anterior es un literal que acaba en `#`. */
  const mirarTexto = (top) => {
    const piezas = piezasDe(top);
    for (let i = 1; i < piezas.length; i++) {
      const p = piezas[i];
      const antes = piezas[i - 1];
      if (!p.expr || antes.lit === undefined) continue;
      // `&#${codigo};` es una entidad HTML, no un número de documento.
      if (!/#$/.test(antes.lit) || /&#$/.test(antes.lit)) continue;
      if (llamaA(p.expr, HELPERS_NUMERO)) continue;
      fila(NUMERO, p.expr, top, p.expr, { soloId: esSoloId(p.expr, sf) });
    }
  };

  const rec = (n) => {
    // Un texto se mira UNA vez, desde su nodo más alto: una plantilla, o la cima de una cadena de `+`.
    if (ts.isTemplateExpression(n) || esSuma(n)) {
      let padre = n.parent;
      while (padre && ts.isParenthesizedExpression(padre)) padre = padre.parent;
      const esCima = !(padre && (esSuma(padre)));
      if (esCima) mirarTexto(n);
    }
    if (esToFixedDos(n)) {
      const top = textoQueContiene(n);
      // «Pegado a una moneda» = en el MISMO texto hay una moneda: escrita (`€`, `EUR`) o interpolada
      // (`${invoice.currency}`). No se exige que sea la pieza de al lado: en «Recibidos ${a} de ${b}
      // ${moneda}» los dos importes son de esa moneda y sólo el segundo la toca.
      const piezas = top ? piezasDe(top) : [];
      const conMoneda = piezas.some((p) => (p.lit !== undefined ? MONEDA_ESCRITA.test(p.lit) : esReferenciaAMoneda(p.expr)));
      if (conMoneda) fila(IMPORTE, n, top, n);
      else if (top) enTextoSinMoneda++;
      else sueltos++;
    }
    ts.forEachChild(n, rec);
  };
  rec(sf);
  return { filas, sueltos, enTextoSinMoneda, error: null };
}

/**
 * Censa el árbol. Declara su POBLACIÓN: cuántos ficheros leyó y cuáles NO pudo analizar, por su
 * nombre. Un árbol sin `src/` o sin ficheros LANZA: cero ficheros es «no he mirado».
 */
export function censar(raiz = RAIZ) {
  const abs = path.resolve(raiz);
  const todos = CARPETAS.flatMap((c) => ficherosDe(path.join(abs, c)));
  if (todos.length === 0) {
    throw new Error(`🔴 CIEGO · censo del gemelo crudo: «${abs}» no tiene ni un fichero ${[...EXT].join('/')} `
      + `en [${CARPETAS.join(', ')}]. Sin población no hay censo.`);
  }
  const filas = [];
  const noAnalizables = [];
  let sueltos = 0;
  let enTextoSinMoneda = 0;
  for (const f of todos) {
    const rel = path.relative(abs, f).split(path.sep).join('/');
    let texto;
    try { texto = fs.readFileSync(f, 'utf8'); } catch (e) { noAnalizables.push({ fichero: rel, motivo: `no se pudo leer: ${e.code ?? e.message}` }); continue; }
    const r = censarFuente(rel, texto);
    if (r.error) { noAnalizables.push({ fichero: rel, motivo: r.error }); continue; }
    filas.push(...r.filas);
    sueltos += r.sueltos;
    enTextoSinMoneda += r.enTextoSinMoneda;
  }
  return { raiz: abs, ficheros: todos.length, noAnalizables, filas, sueltos, enTextoSinMoneda };
}

/** ¿Esta fila se acusa? Todo lo que no se ha podido demostrar que se queda DENTRO. */
export const acusada = (f) => f.destino !== DENTRO;

/** Las acusadas, contadas por identidad: `Map<identidad, n>`. Es lo que se compara con `DECLARADOS`. */
export function porIdentidad(filas) {
  const m = new Map();
  for (const f of filas.filter(acusada)) m.set(f.identidad, (m.get(f.identidad) ?? 0) + 1);
  return m;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL SUELO DECLARADO · lo que el árbol tiene el día que nace el guard.
//
// Sale del censo de SCRUM-1444 (S1, por texto) vuelto a medir por AST: están todos los sitios que
// S1 nombró y que lee una persona, más los que el texto no veía (un valor que no se llama `id` ni
// `quoteNumber`, un `id` a secas, las llamadas que comparten línea). El detalle de qué es de cada
// uno, con su fecha, en `docs/master/SCRUM-1452.md`.
//
// La CLAVE es la identidad (forma + fichero + función o ruta), nunca la línea: una línea es una
// posición y caduca. `n` es cuántos sitios de esa forma hay dentro de esa función.
//
//   DEUDA     un crudo que lee una persona. Lo retira su dueño (`retira`, según `dos-equipos.md`
//             §3.1) usando el helper; cambiar lo que se lee es texto firmado (regla 39), así que
//             este guard NO arregla ninguno: impide que nazcan más y obliga a declarar cada baja.
//   LEGITIMO  tiene la forma y no es el patrón. No lo retira nadie; el motivo dice por qué.
//
// ⛔ Esta lista NO es la salida para un rojo propio. Un sitio NUEVO se arregla usando el helper.
// Aquí sólo entra lo que se demuestre LEGITIMO, con su motivo, a la vista en el diff del PR.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
export const DEUDA = 'DEUDA';
export const LEGITIMO = 'LEGITIMO';

const M = 'src/modules/';
export const DECLARADOS = new Map([
  // ── IMPORTE · LEGITIMO ────────────────────────────────────────────────────────────────────────
  [`IMPORTE|src/core/utils/utils.ts::formatMoneyEs`, { n: 1, clase: LEGITIMO, retira: null, motivo: 'es el respaldo del propio helper, para cuando Intl no sabe formatear la moneda' }],
  [`IMPORTE|${M}ai/domain/ai.service.ts::suggestQuoteLines`, { n: 1, clase: LEGITIMO, retira: null, motivo: 'catálogo que se le pasa al modelo de IA: no lo lee una persona (SCRUM-1444, familia 2)' }],
  [`IMPORTE|${M}ai/domain/ai.service.ts::suggestAlbaranLines`, { n: 1, clase: LEGITIMO, retira: null, motivo: 'catálogo que se le pasa al modelo de IA: no lo lee una persona (SCRUM-1444, familia 2)' }],
  // ── IMPORTE · DEUDA ───────────────────────────────────────────────────────────────────────────
  [`IMPORTE|${M}billing/app/routes/mpWebhook.routes.ts::POST /`, { n: 1, clase: DEUDA, retira: 'J2', motivo: 'importe del aviso de cobro recibido, sin formatMoneyEs (SCRUM-1444 y SCRUM-1436)' }],
  [`IMPORTE|${M}billing/app/routes/payBizum.routes.ts::POST /bizum/:token/claimed`, { n: 1, clase: DEUDA, retira: 'J2', motivo: 'importe del aviso «el cliente dice que ha pagado por Bizum», sin formatMoneyEs (SCRUM-1444 y SCRUM-1436)' }],
  [`IMPORTE|${M}billing/domain/invoiceWhatsApp.service.ts::sendInvoicePaymentRequest`, { n: 1, clase: DEUDA, retira: 'J1', motivo: 'importe de la factura en el aviso al profesional, sin formatMoneyEs (SCRUM-1444)' }],
  [`IMPORTE|${M}system/app/routes/invoicesAdmin.routes.ts::POST /:id/payment-anomaly`, { n: 5, clase: DEUDA, retira: 'J1', motivo: 'los importes de «Recibidos … de …»: SCRUM-1444 contó sus dos líneas; son cinco llamadas' }],
  [`IMPORTE|${M}system/app/routes/invoicesAdmin.routes.ts::money`, { n: 1, clase: DEUDA, retira: 'J1', motivo: 'un formateador propio del paquete de disputa, gemelo de formatMoneyEs (SCRUM-1444)' }],
  // ── NUMERO · LEGITIMO ─────────────────────────────────────────────────────────────────────────
  [`NUMERO|${M}invoicing/infra/pdf/pdf.service.ts::generateQuotePdf`, { n: 1, clase: LEGITIMO, retira: null, motivo: 'el valor ya sale de numeroConRevision; llega por una variable y el censo no sigue variables' }],
  [`NUMERO|${M}system/domain/qrPagina.service.ts::normalizarHex`, { n: 2, clase: LEGITIMO, retira: null, motivo: 'es un color hexadecimal, no el número de un documento' }],
  // ── NUMERO · DEUDA · cobros (J2) ──────────────────────────────────────────────────────────────
  [`NUMERO|${M}billing/app/routes/payBizum.routes.ts::POST /bizum/:token/claimed`, { n: 1, clase: DEUDA, retira: 'J2', motivo: '«cobro #id»: el id de la tabla a la vista (familia de SCRUM-95)' }],
  [`NUMERO|${M}billing/app/routes/payCard.routes.ts::GET /card/:token`, { n: 1, clase: DEUDA, retira: 'J2', motivo: '«Cobro #id» como nombre del producto en el pago con tarjeta; el censo por texto no lo veía' }],
  [`NUMERO|${M}billing/app/routes/receipt.routes.ts::GET /:token`, { n: 2, clase: DEUDA, retira: 'J2', motivo: '«cobro #id» en el recibo público: el id de la tabla a la vista (familia de SCRUM-95)' }],
  [`NUMERO|${M}billing/app/routes/receipt.routes.ts::POST /:token/feedback`, { n: 1, clase: DEUDA, retira: 'J2', motivo: '«cobro #id» en el aviso de valoración (familia de SCRUM-95)' }],
  [`NUMERO|${M}system/app/routes/customerPortal.routes.ts::GET /:token`, { n: 1, clase: DEUDA, retira: 'J2', motivo: 'número del presupuesto en el portal del cliente, sin displayQuoteNumber (SCRUM-1444)' }],
  [`NUMERO|${M}whatsappBot/app/routes/whatsappIncoming.routes.ts::handleIncomingText`, { n: 6, clase: DEUDA, retira: 'J2', motivo: 'número del presupuesto en las respuestas del bot, sin displayQuoteNumber (SCRUM-1444)' }],
  [`NUMERO|${M}whatsappBot/domain/botFlow.service.ts::handleBotMessage`, { n: 2, clase: DEUDA, retira: 'J2', motivo: 'número del presupuesto en el bot, y el id de la solicitud en su aviso (SCRUM-1444)' }],
  // ── NUMERO · DEUDA · facturas (J1) ────────────────────────────────────────────────────────────
  [`NUMERO|${M}system/app/routes/invoicesAdmin.routes.ts::GET /:id/dispute-package`, { n: 1, clase: DEUDA, retira: 'J1', motivo: 'número del presupuesto en el paquete de disputa, sin displayQuoteNumber (SCRUM-1444)' }],
  // ── NUMERO · DEUDA · presupuestos y trabajos (S1) ─────────────────────────────────────────────
  [`NUMERO|${M}jobs/app/routes/jobs.routes.ts::GET /:id/ics`, { n: 1, clase: DEUDA, retira: 'S1', motivo: 'número del presupuesto en la cita de calendario; el censo por texto no lo veía' }],
  [`NUMERO|${M}jobs/domain/trabajoDirecto.ts::tituloDeTrabajo`, { n: 2, clase: DEUDA, retira: 'S1', motivo: 'título del trabajo: número del presupuesto por una variable (no visto por texto) y el id del trabajo (SCRUM-1444)' }],
  [`NUMERO|${M}maintenance/domain/maintenance.service.ts::runMaintenanceProposals`, { n: 1, clase: DEUDA, retira: 'S1', motivo: 'número del presupuesto en el aviso de mantenimiento (SCRUM-1444)' }],
  [`NUMERO|${M}maintenance/domain/maintenance.service.ts::handleMaintenanceButton`, { n: 1, clase: DEUDA, retira: 'S1', motivo: 'número del presupuesto en la respuesta al profesional (SCRUM-1444)' }],
  [`NUMERO|${M}messaging/domain/email.service.ts::sendQuoteEmail`, { n: 1, clase: DEUDA, retira: 'S1', motivo: 'número del presupuesto en el correo al cliente, sin displayQuoteNumber (SCRUM-1444)' }],
  [`NUMERO|${M}messaging/domain/merchantNotifications.ts::sendMerchantQuoteAcceptedEmail`, { n: 3, clase: DEUDA, retira: 'S1', motivo: 'el bot le pasa el id GLOBAL de la tabla y sale en el asunto y el cuerpo del correo (SCRUM-1444, comentario 18228)' }],
  [`NUMERO|${M}messaging/domain/merchantNotifications.ts::sendTechQuoteApprovedEmail`, { n: 3, clase: DEUDA, retira: 'S1', motivo: 'número del presupuesto en el correo al técnico, sin displayQuoteNumber (SCRUM-1444)' }],
  [`NUMERO|${M}quotes/domain/expire.service.ts::expireQuotes`, { n: 1, clase: DEUDA, retira: 'S1', motivo: 'número del presupuesto en el aviso de caducidad (SCRUM-1444)' }],
  [`NUMERO|${M}quotes/domain/reminder.service.ts::sendPendingReminders`, { n: 1, clase: DEUDA, retira: 'S1', motivo: 'número del presupuesto en el aviso de recordatorio (SCRUM-1444)' }],
  [`NUMERO|${M}quotes/domain/sendQuote.service.ts::sendQuoteWhatsAppToCustomer`, { n: 3, clase: DEUDA, retira: 'S1', motivo: 'número del presupuesto en el WhatsApp al cliente, por una variable: el censo por texto no lo veía' }],
  [`NUMERO|${M}system/app/routes/quoteDecisionLanding.routes.ts::renderQuoteDetail`, { n: 2, clase: DEUDA, retira: 'S1', motivo: 'número del presupuesto en la página pública (SCRUM-1444), y el token como si fuera el número cuando no hay presupuesto (no visto por texto)' }],
  [`NUMERO|${M}system/app/routes/quoteDecisionLanding.routes.ts::(módulo)`, { n: 3, clase: DEUDA, retira: 'S1', motivo: 'número del presupuesto en los enlaces de WhatsApp de la página pública (SCRUM-1444)' }],
  [`NUMERO|${M}system/app/routes/quoteDecisionLanding.routes.ts::POST /quote/:token/reject`, { n: 1, clase: DEUDA, retira: 'S1', motivo: 'número del presupuesto en la página de rechazo, por una variable: el censo por texto no lo veía' }],
  [`NUMERO|${M}system/app/routes/quotesAdmin.routes.ts::POST /:id/send-email`, { n: 1, clase: DEUDA, retira: 'S1', motivo: 'número del presupuesto en el aviso de envío por correo (SCRUM-1444)' }],
]);

/**
 * ✂ RETIRADAS · identidades que YA NO aparecen porque se arreglaron, con su ticket. Quien arregla,
 * mueve aquí la entrada: una bajada que nadie ha declarado es un censo roto hasta que se demuestre
 * lo contrario. Nace vacía.
 */
export const RETIRADAS = new Map([
]);

/** Los puestos que pueden figurar en `retira` (los de `dos-equipos.md` §2). */
export const PUESTOS = /^(?:S[0-5]|J[1-6])$/;

/**
 * Compara un censo con `DECLARADOS` y `RETIRADAS`. Devuelve las CUATRO listas de lo que no cuadra;
 * todas vacías es «nada ha cambiado». No decide nada más: quien llama convierte cada lista en rojo.
 */
export function comparar(filas, declarados = DECLARADOS, retiradas = RETIRADAS) {
  const vivas = porIdentidad(filas);
  const nuevas = [];
  const suben = [];
  const bajan = [];
  const resucitadas = [];
  for (const [id, n] of vivas) {
    if (retiradas.has(id)) resucitadas.push(id);
    const d = declarados.get(id);
    if (!d) { if (!retiradas.has(id)) nuevas.push(`${id} (${n})`); continue; }
    if (n > d.n) suben.push(`${id}: declarados ${d.n}, hay ${n}`);
    if (n < d.n) bajan.push(`${id}: declarados ${d.n}, hay ${n}`);
  }
  for (const [id, d] of declarados) if (!vivas.has(id)) bajan.push(`${id}: declarados ${d.n}, hay 0`);
  return { nuevas, suben, bajan, resucitadas };
}

// ── uso a mano: `node scripts/_censo-gemelo-crudo.mjs [--lineas]` ───────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const r = censar();
  console.log(`POBLACIÓN: ${r.ficheros} ficheros .ts en [${CARPETAS.join(', ')}] de ${r.raiz} · no analizables: ${r.noAnalizables.length}`);
  for (const x of r.noAnalizables) console.log(`  🔴 NO PUDE MIRAR ${x.fichero}: ${x.motivo}`);
  for (const forma of [NUMERO, IMPORTE]) {
    const de = r.filas.filter((f) => f.forma === forma);
    const cuenta = (d) => de.filter((f) => f.destino === d).length;
    console.log(`${forma}: ${de.length} sitios · FUERA ${cuenta(FUERA)} · NO_DECIDIBLE ${cuenta(NO_DECIDIBLE)} · DENTRO ${cuenta(DENTRO)}`
      + (forma === IMPORTE ? ` · toFixed(2) que NO se acusan: en un texto sin moneda ${r.enTextoSinMoneda}, fuera de todo texto ${r.sueltos}` : ''));
    if (process.argv.includes('--lineas')) {
      for (const f of de) console.log(`  ${f.destino.padEnd(12)} ${f.fichero}:${f.linea} [${f.sumidero}] ${f.valor}${f.soloId ? '  ← SÓLO ID' : ''}  «${f.identidad}»`);
    }
  }
  const c = comparar(r.filas);
  const deuda = [...DECLARADOS.values()].filter((d) => d.clase === DEUDA).reduce((s, d) => s + d.n, 0);
  console.log(`DECLARADOS: ${DECLARADOS.size} identidades · sitios de DEUDA ${deuda} · RETIRADAS ${RETIRADAS.size}`);
  for (const [k, v] of Object.entries(c)) for (const x of v) console.log(`  🔴 ${k}: ${x}`);
  const mal = r.noAnalizables.length + Object.values(c).reduce((s, v) => s + v.length, 0);
  console.log(mal ? '🔴 NO CUADRA' : '🟢 el árbol es el declarado');
  process.exitCode = mal ? 1 : 0;
}
