// tests/_autorreferencias.mjs — SCRUM-877
//
// ¿DÓNDE VIVE UN `https://yaqu.app` ESCRITO A PELO, Y ESO ES UNA URL O UN TEXTO?
//
// 🔒 EL DISCRIMINADOR ES LA POSICIÓN SINTÁCTICA, NO EL TEXTO. Y ésa es la razón por la que este
// guard se puede escribir y el de SCRUM-124 no: aquél compara `content.includes` sobre el fichero
// entero, así que no puede distinguir una llamada de una mención — y con razón cazó un censo que
// sólo NOMBRABA el host. Aquí se mira el NODO: un literal dentro de `href="…"` es una URL; el
// mismo texto como contenido de un `<a>` es una palabra que alguien lee.
//
// ⚠️ HUECO DECLARADO, y no se finge cubierto: una base compuesta en dos pasos
// (`const d = 'yaqu' + '.app'`) no la ve ninguna criba de esta familia. Es ofuscación, y el
// precedente de la casa es declararla en vez de aparentar: SCRUM-176 dejó escritos sus tres
// huecos (variables, `eval`, base64) en su propio fichero por la misma razón.
//
// No registra tests: es un ayudante. Importarlo no mueve el total de la tanda. Y vive aparte para
// que la mutación de SCRUM-745 pueda apuntar a OTRO fichero — el literal `de` no puede estar dos
// veces en el mismo sitio (lo aprendí en SCRUM-547).
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** El dominio propio, con esquema. Sin esquema no es una URL: es una palabra. */
export const RE_DOMINIO = /https?:\/\/(?:www\.)?yaqu\.app/g;

export const POSICION = {
  URL: 'url',                 // 🔴 lo que hay que cazar
  CONTENIDO: 'contenido',     // ✅ texto que una persona lee — se absuelve
  EXENTA: 'exenta',           // ✅ `config.PUBLIC_BASE_URL || 'https://…'` — la convención, con respaldo
  INDETERMINADA: 'indeterminada', // ⚠️ no se sabe: se DICE, no se cuenta como hallazgo ni como limpio
};

/**
 * ¿El literal es el respaldo de la convención? `config.PUBLIC_BASE_URL || 'https://yaqu.app'`.
 * Se mira el PADRE, porque el `||` no está dentro del literal.
 */
function esRespaldoDeLaConvencion(nodo) {
  const p = nodo.parent;
  if (!p || !ts.isBinaryExpression(p)) return false;
  if (p.operatorToken.kind !== ts.SyntaxKind.BarBarToken) return false;
  return /PUBLIC_BASE_URL/.test(p.left.getText());
}

/**
 * Clasifica una aparición por lo que la precede DENTRO del mismo trozo de literal.
 *
 * `izq` es el texto del literal hasta justo antes de la aparición.
 */
export function clasificarPorContexto(izq, inicioDelLiteral) {
  // 1. atributo o propiedad de URL: `href="`, `src='`, `url: "`, `action="`
  if (/(?:href|src|action|url|link)\s*[:=]\s*["'`]?\s*$/i.test(izq)) return POSICION.URL;
  // 2. el literal EMPIEZA por el dominio: es una URL que se compone con su ruta
  if (inicioDelLiteral && izq === '') return POSICION.URL;
  // 3. contenido visible: venimos de cerrar una etiqueta y no se ha abierto otra
  if (/>[^<]*$/.test(izq)) return POSICION.CONTENIDO;
  // 4. prosa suelta dentro de un literal de texto (sin marcas de HTML alrededor)
  if (!/[<>]/.test(izq) && /[a-záéíóúñ]\s+$/i.test(izq)) return POSICION.CONTENIDO;
  return POSICION.INDETERMINADA;
}

/** Los trozos de texto de un literal, con el desplazamiento de cada uno. */
function trozosDe(nodo, sf) {
  if (ts.isStringLiteral(nodo) || ts.isNoSubstitutionTemplateLiteral(nodo)) {
    return [{ texto: nodo.text, primero: true }];
  }
  if (ts.isTemplateExpression(nodo)) {
    const out = [{ texto: nodo.head.text, primero: true }];
    for (const s of nodo.templateSpans) out.push({ texto: s.literal.text, primero: false });
    return out;
  }
  return [];
}

/**
 * Las apariciones del dominio en un fuente, clasificadas. Por AST: los comentarios NO entran,
 * que es justo lo que a SCRUM-124 no le es posible.
 */
export function analizarFuente(codigo, nombre = 'x.ts') {
  const sf = ts.createSourceFile(nombre, String(codigo || ''), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out = [];
  (function recorrer(n) {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)) {
      const exenta = (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && esRespaldoDeLaConvencion(n);
      for (const t of trozosDe(n, sf)) {
        RE_DOMINIO.lastIndex = 0;
        let m;
        while ((m = RE_DOMINIO.exec(t.texto)) !== null) {
          const izq = t.texto.slice(0, m.index);
          const posicion = exenta
            ? POSICION.EXENTA
            : clasificarPorContexto(izq, t.primero && m.index === 0);
          out.push({
            linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
            posicion,
            muestra: (izq.slice(-28) + m[0]).trim(),
          });
        }
      }
    }
    ts.forEachChild(n, recorrer);
  })(sf);
  return out;
}

/** Todos los `.ts` de una carpeta. */
export function fuentesTs(raiz, carpeta) {
  const out = [];
  const andar = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { andar(p); continue; }
      if (/\.ts$/.test(e.name)) out.push(path.relative(raiz, p).split(path.sep).join('/'));
    }
  };
  const d = path.join(raiz, carpeta);
  if (fs.existsSync(d)) andar(d);
  return out.sort();
};

/** El censo sobre el árbol, con su población declarada. */
export function censar(raiz, carpeta = 'src') {
  const ficheros = fuentesTs(raiz, carpeta);
  const hallazgos = [];
  let derivaciones = 0;
  for (const rel of ficheros) {
    const codigo = fs.readFileSync(path.join(raiz, rel), 'utf8');
    derivaciones += (codigo.match(/config\.PUBLIC_BASE_URL|\bBASE_URL\b/g) || []).length;
    for (const h of analizarFuente(codigo, rel)) hallazgos.push({ fichero: rel, ...h });
  }
  return { escaneados: ficheros.length, derivaciones, hallazgos };
}

/**
 * 🔴 LOS DOS QUE NO SE TOCAN, CERRADOS Y CLAVADOS POR IDENTIDAD (no por posición: una línea se
 * mueve en cuanto alguien añade un import encima).
 *
 * Son el respaldo de la convención, y se quedan: `config.PUBLIC_BASE_URL || 'https://yaqu.app'`.
 * Un tercero NO se añade: se decide.
 */
export const TOPE_EXENTAS = 2;
export const EXENTAS = {
  'src/modules/auth/domain/referral.service.ts': "const base = config.PUBLIC_BASE_URL || 'https://yaqu.app';",
  'src/modules/messaging/domain/lifecycle.service.ts': "const DASHBOARD_URL = `${config.PUBLIC_BASE_URL || 'https://yaqu.app'}/dashboard/`;",
};
