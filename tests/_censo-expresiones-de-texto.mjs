// tests/_censo-expresiones-de-texto.mjs — SCRUM-1325
//
// EL MOTOR del censo de expresiones regulares de `src/`. Lo consume
// `tests/scrum1325b-expresiones-sobre-texto-de-persona.test.mjs`, y el árbol real y los casos
// fabricados pasan por la MISMA función (`juzgar`): un guard cuyos controles miden otro camino
// cobra el verde sin ganárselo.
//
// QUÉ DECIDE, y en este orden:
//   1. ¿Puede tener el agujero? Sólo si lleva LETRAS, `\b`/`\B`, `\w`/`\W`, o si su patrón no se
//      puede leer (un `RegExp(` armado en ejecución). `/\D/g` o `/\s+/` quedan fuera por construcción.
//   2. Toda la que puede tenerlo tiene que estar DECLARADA en el catálogo, por identidad
//      (fichero + su texto, nunca la línea), con una clase y un motivo.
//   3. Declarada `persona`: va en ASCII y cada sitio donde se aplica recibe texto NORMALIZADO
//      —`sinTildes(…)`, o la misma cadena `.normalize('NFD').replace(…)` escrita en el sitio o en
//      una función del fichero—. Los normalizadores se reconocen por ESTRUCTURA, no por nombre.
//
// 🔴 Lo que no sabe decidir lo dice: `sin-declarar` y `no-se-decidir` son hallazgos, no silencios.
import ts from 'typescript';

export const CLASES = ['persona', 'maquina', 'persona-sin-normalizar'];

const ESCAPE = /\\(?:[pP]\{[^}]*\}|u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|c[A-Za-z]|k<[^>]*>|[\s\S])/g;
const GRUPO_CON_NOMBRE = /\(\?<[A-Za-z_$][A-Za-z0-9_$]*>/g;

/** Qué lleva un patrón que lo hace sensible a las tildes. `null` = no se puede leer. */
export function rasgosDelPatron(patron) {
  if (patron === null) return { legible: false, sensible: true, porque: ['patrón armado en ejecución: no se puede leer'], letraNoAscii: false };
  const porque = [];
  let frontera = false;
  let clasePalabra = false;
  const sinEscapes = patron.replace(GRUPO_CON_NOMBRE, '(').replace(ESCAPE, (m) => {
    if (m === '\\b' || m === '\\B') frontera = true;
    if (m === '\\w' || m === '\\W') clasePalabra = true;
    return '';
  });
  if (frontera) porque.push('\\b');
  if (clasePalabra) porque.push('\\w');
  if (/\p{L}/u.test(sinEscapes)) porque.push('letras');
  const letraNoAscii = /[^\x00-\x7F]/.test(sinEscapes) && [...sinEscapes].some((c) => c > '\x7F' && /\p{L}/u.test(c));
  return { legible: true, sensible: porque.length > 0, porque, letraNoAscii };
}

const unaLinea = (s) => s.replace(/\s+/g, ' ').trim();
const pelar = (n) => {
  let x = n;
  while (x && (ts.isParenthesizedExpression(x) || ts.isAsExpression(x) || ts.isNonNullExpression(x))) x = x.expression;
  return x;
};
const padreUtil = (n) => {
  let p = n.parent;
  while (p && (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isNonNullExpression(p))) p = p.parent;
  return p;
};

/** Todas las expresiones de un fuente: literales y `RegExp(` / `new RegExp(`. */
export function expresionesDe(fichero, fuente) {
  const sf = ts.createSourceFile(fichero, fuente, ts.ScriptTarget.Latest, true);
  const out = [];
  (function v(n) {
    if (n.kind === ts.SyntaxKind.RegularExpressionLiteral) {
      const t = n.getText(sf);
      out.push({ fichero, fuente: t, nodo: n, sf, patron: t.slice(1, t.lastIndexOf('/')) });
    } else if ((ts.isNewExpression(n) || ts.isCallExpression(n)) && ts.isIdentifier(n.expression) && n.expression.text === 'RegExp') {
      const a0 = n.arguments?.[0];
      const legible = a0 && (ts.isStringLiteral(a0) || ts.isNoSubstitutionTemplateLiteral(a0));
      out.push({ fichero, fuente: unaLinea(n.getText(sf)), nodo: n, sf, patron: legible ? a0.text : null });
    }
    ts.forEachChild(n, v);
  })(sf);
  for (const e of out) {
    e.linea = sf.getLineAndCharacterOfPosition(e.nodo.getStart(sf)).line + 1;
    e.rasgos = rasgosDelPatron(e.patron);
  }
  return out;
}

// ── ¿está normalizado lo que se le pasa? ───────────────────────────────────────────────────────

const esLlamadaA = (n, metodo) => ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === metodo;
const esNormalizeNFD = (n) => {
  const x = pelar(n);
  return esLlamadaA(x, 'normalize') && x.arguments.length === 1 && ts.isStringLiteralLike(x.arguments[0]) && x.arguments[0].text === 'NFD';
};
/** Métodos de cadena que no devuelven las tildes a un texto que ya no las tiene. */
const CONSERVAN = new Set(['trim', 'trimStart', 'trimEnd', 'toLowerCase', 'toUpperCase', 'replace', 'slice']);

/** Las funciones del fichero que normalizan, reconocidas por lo que HACEN. */
function normalizadoresDe(sf) {
  const nombres = new Set();
  for (const st of sf.statements) {
    // El helper de la casa, importado de su sitio.
    if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier) && /(^|\/)core\/texto\/sinTildes$/.test(st.moduleSpecifier.text)) {
      const nb = st.importClause?.namedBindings;
      if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) if ((el.propertyName ?? el.name).text === 'sinTildes') nombres.add(el.name.text);
    }
    // Una función de este fichero cuyo ÚNICO cuerpo es devolver la cadena normalizada.
    if (ts.isFunctionDeclaration(st) && st.name && st.body && st.body.statements.length >= 1) {
      const ultimo = st.body.statements[st.body.statements.length - 1];
      const soloComentarioYReturn = st.body.statements.length === 1 && ts.isReturnStatement(ultimo) && ultimo.expression;
      if (soloComentarioYReturn && cadenaNormalizada(ultimo.expression, new Set())) nombres.add(st.name.text);
    }
  }
  return nombres;
}

/** ¿Es una cadena `….normalize('NFD').replace(…)` o una llamada a un normalizador, con métodos que conservan detrás? */
function cadenaNormalizada(expr, normalizadores) {
  const x = pelar(expr);
  if (!x || !ts.isCallExpression(x)) return false;
  if (ts.isIdentifier(x.expression)) return normalizadores.has(x.expression.text);
  if (!ts.isPropertyAccessExpression(x.expression)) return false;
  const metodo = x.expression.name.text;
  const receptor = x.expression.expression;
  if (metodo === 'replace' && esNormalizeNFD(receptor)) return true;
  if (!CONSERVAN.has(metodo)) return false;
  return cadenaNormalizada(receptor, normalizadores);
}

/** La declaración `const nombre = …` visible desde `uso`, o el motivo por el que no se puede saber. */
function declaracionDe(nombre, uso) {
  for (let ambito = uso.parent; ambito; ambito = ambito.parent) {
    if (ts.isFunctionLike(ambito) && ambito.parameters.some((p) => ts.isIdentifier(p.name) && p.name.text === nombre)) {
      return { motivo: `«${nombre}» es un parámetro: desde aquí no se ve qué texto llega` };
    }
    const sentencias = ts.isBlock(ambito) || ts.isSourceFile(ambito) || ts.isModuleBlock(ambito) ? ambito.statements : null;
    if (!sentencias) continue;
    for (const st of sentencias) {
      if (st.getStart() > uso.getStart() || !ts.isVariableStatement(st)) continue;
      for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || d.name.text !== nombre) continue;
        if (!(st.declarationList.flags & ts.NodeFlags.Const)) return { motivo: `«${nombre}» no es \`const\`: puede cambiar después de normalizarse` };
        return { inicial: d.initializer };
      }
    }
  }
  return { motivo: `no encuentro dónde se declara «${nombre}»` };
}

/** Veredicto sobre el texto al que se aplica una expresión: `{ ok }` o `{ ok:false, sabe, porque }`. */
function sujetoNormalizado(expr, normalizadores, profundidad = 0) {
  const x = pelar(expr);
  if (!x) return { ok: false, sabe: false, porque: 'la expresión se aplica sin texto a la vista' };
  if (cadenaNormalizada(x, normalizadores)) return { ok: true };
  if (ts.isIdentifier(x) && profundidad < 3) {
    const d = declaracionDe(x.text, x);
    if (d.motivo) return { ok: false, sabe: false, porque: d.motivo };
    return sujetoNormalizado(d.inicial, normalizadores, profundidad + 1);
  }
  // Una cadena de métodos que conservan, colgada de un identificador: se mira el identificador.
  if (ts.isCallExpression(x) && ts.isPropertyAccessExpression(x.expression) && CONSERVAN.has(x.expression.name.text)) {
    return sujetoNormalizado(x.expression.expression, normalizadores, profundidad);
  }
  return { ok: false, sabe: true, porque: `se aplica a \`${unaLinea(x.getText())}\`, que no pasa por \`sinTildes(…)\`` };
}

// ── ¿dónde se aplica? ──────────────────────────────────────────────────────────────────────────

const APLICA_AL_ARGUMENTO = new Set(['test', 'exec']);
const APLICA_AL_RECEPTOR = new Set(['match', 'matchAll', 'replace', 'replaceAll', 'split', 'search']);

/** El texto al que se aplica la expresión cuando `n` (ella, o un nombre que la guarda) está en este sitio. */
function sujetoEn(n) {
  const p = padreUtil(n);
  if (!p) return null;
  // n.test(TEXTO) · n.exec(TEXTO)
  if (ts.isPropertyAccessExpression(p) && pelar(p.expression) === pelar(n) && APLICA_AL_ARGUMENTO.has(p.name.text)) {
    const llamada = padreUtil(p);
    if (llamada && ts.isCallExpression(llamada) && pelar(llamada.expression) === p) return { texto: llamada.arguments[0] ?? null };
  }
  // TEXTO.match(n) · TEXTO.replace(n, …) · TEXTO.split(n)
  if (ts.isCallExpression(p) && p.arguments.some((a) => pelar(a) === pelar(n)) && ts.isPropertyAccessExpression(p.expression)
    && APLICA_AL_RECEPTOR.has(p.expression.name.text)) return { texto: p.expression.expression };
  return null;
}

/** Todos los sitios donde se aplica una expresión, o por qué no se pueden encontrar. */
function aplicacionesDe(e) {
  const { nodo, sf } = e;
  const directo = sujetoEn(nodo);
  if (directo) return { sitios: [directo] };
  const p = padreUtil(nodo);

  // const NOMBRE = /…/  →  cada uso de NOMBRE en el fichero
  if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) && pelar(p.initializer) === nodo) {
    const nombre = p.name.text;
    const usos = [];
    let declaraciones = 0;
    (function v(n) {
      if (ts.isIdentifier(n) && n.text === nombre) {
        if (ts.isVariableDeclaration(n.parent) && n.parent.name === n) declaraciones++;
        else usos.push(n);
      }
      ts.forEachChild(n, v);
    })(sf);
    if (declaraciones !== 1) return { noSe: `hay ${declaraciones} declaraciones de «${nombre}» en el fichero: no sé cuál se usa en cada sitio` };
    if (!usos.length) return { noSe: `«${nombre}» no se usa en su fichero: no veo a qué texto se aplica` };
    const sitios = [];
    for (const u of usos) {
      const s = sujetoEn(u);
      if (!s) return { noSe: `«${nombre}» se usa en la línea ${sf.getLineAndCharacterOfPosition(u.getStart(sf)).line + 1} de una forma que no sé leer (ni \`.test(\`, ni \`.match(\`…)` };
      sitios.push(s);
    }
    return { sitios };
  }

  // { clave: /…/ }  →  cada `.clave.test(…)` del fichero
  if (p && ts.isPropertyAssignment(p) && pelar(p.initializer) === nodo && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) {
    const clave = p.name.text;
    const sitios = [];
    (function v(n) {
      if (ts.isPropertyAccessExpression(n) && n.name.text === clave && !ts.isCallExpression(padreUtil(n) ?? n)) {
        const s = sujetoEn(n);
        if (s) sitios.push(s);
      }
      ts.forEachChild(n, v);
    })(sf);
    if (!sitios.length) return { noSe: `está guardada en la propiedad «${clave}» y no encuentro ningún \`.${clave}.test(…)\` en su fichero` };
    return { sitios };
  }

  return { noSe: 'no sé leer dónde se aplica (no es `.test(`, ni `.match(`, ni un `const`, ni una propiedad)' };
}

// ── el veredicto ───────────────────────────────────────────────────────────────────────────────

const clave = (fichero, fuente) => `${fichero} · ${fuente}`;

/**
 * @param fuentes  Map<ruta relativa con `/`, texto del fuente>
 * @param catalogo [{ fichero, fuente, veces?, clase, motivo }]
 * @returns { poblacion, hallazgos: [{ tipo, fichero, linea?, fuente, detalle }] }
 *   tipos: `sin-declarar` · `sobra` · `catalogo-mal` · `letra-con-tilde` · `sin-normalizar` · `no-se-decidir`
 */
export function juzgar(fuentes, catalogo) {
  const hallazgos = [];
  const todas = [];
  for (const [fichero, fuente] of fuentes) todas.push(...expresionesDe(fichero, fuente));
  const sensibles = todas.filter((e) => e.rasgos.sensible);

  const declaradas = new Map();
  for (const c of catalogo) {
    const k = clave(c.fichero, c.fuente);
    const mal = [];
    if (!CLASES.includes(c.clase)) mal.push(`clase «${c.clase}» desconocida (valen: ${CLASES.join(', ')})`);
    if (typeof c.motivo !== 'string' || c.motivo.trim().length < 15) mal.push('sin motivo (o con uno de menos de 15 caracteres)');
    if (declaradas.has(k)) mal.push('está dos veces en el catálogo');
    if (mal.length) hallazgos.push({ tipo: 'catalogo-mal', fichero: c.fichero, fuente: c.fuente, detalle: mal.join('; ') });
    declaradas.set(k, { ...c, veces: c.veces ?? 1, vistas: 0 });
  }

  const porClase = Object.fromEntries(CLASES.map((c) => [c, 0]));
  for (const e of sensibles) {
    const d = declaradas.get(clave(e.fichero, e.fuente));
    if (!d) {
      hallazgos.push({ tipo: 'sin-declarar', fichero: e.fichero, linea: e.linea, fuente: e.fuente,
        detalle: `lleva ${e.rasgos.porque.join(' + ')} y no está en el catálogo: NO SÉ si mira texto escrito por una persona. Decláralo.` });
      continue;
    }
    d.vistas++;
    if (!(d.clase in porClase)) continue;
    porClase[d.clase]++;
    if (d.clase !== 'persona') continue;

    if (e.rasgos.letraNoAscii) {
      hallazgos.push({ tipo: 'letra-con-tilde', fichero: e.fichero, linea: e.linea, fuente: e.fuente,
        detalle: 'lleva una letra con tilde o una eñe: sobre texto sin tildes no casará nunca. Se escribe en ASCII.' });
    }
    const a = aplicacionesDe(e);
    if (a.noSe) {
      hallazgos.push({ tipo: 'no-se-decidir', fichero: e.fichero, linea: e.linea, fuente: e.fuente, detalle: `NO SÉ a qué texto se aplica: ${a.noSe}` });
      continue;
    }
    const normalizadores = normalizadoresDe(e.sf);
    for (const s of a.sitios) {
      const v = sujetoNormalizado(s.texto, normalizadores);
      if (v.ok) continue;
      hallazgos.push({ tipo: v.sabe ? 'sin-normalizar' : 'no-se-decidir', fichero: e.fichero, linea: e.linea, fuente: e.fuente,
        detalle: v.sabe ? v.porque : `NO SÉ si el texto llega sin tildes: ${v.porque}` });
    }
  }

  for (const [, d] of declaradas) {
    if (d.vistas === d.veces) continue;
    hallazgos.push({ tipo: 'sobra', fichero: d.fichero, fuente: d.fuente,
      detalle: d.vistas === 0
        ? 'está en el catálogo y ya no está en el código (¿se editó la expresión? entonces es OTRA: se declara de nuevo)'
        : `el catálogo dice que aparece ${d.veces} ${d.veces === 1 ? 'vez' : 'veces'} y aparece ${d.vistas}` });
  }

  return {
    poblacion: { ficheros: fuentes.size, expresiones: todas.length, sensibles: sensibles.length,
      fueraPorConstruccion: todas.length - sensibles.length, porClase },
    hallazgos,
  };
}
