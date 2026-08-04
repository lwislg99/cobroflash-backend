// tests/_censo-configuracion.mjs — SCRUM-284 (B1): censo DERIVADO de los campos que hoy
// tiene la pantalla de Configuración. Puro: recibe fuentes, devuelve el censo.
//
// ── POR QUÉ DERIVADO Y NO A MANO ──────────────────────────────────────────────
// B1 trocea Configuración en nueve submenús, y el propio ticket nombra su fallo mudo:
// «un ajuste que desaparece en una reorganización es el fallo mudo de este ticket. Nadie lo
// nota hasta que alguien va a cambiar su IBAN y no lo encuentra».
//
// Una lista escrita a mano no avisa de lo que le falta. El ticket trae una —doce asuntos— y
// **no se usa como censo**: se usa como CONTRASTE. Lo que enumera esta función sale del árbol.
//
// ── LAS CUATRO FORMAS DE DECLARAR UN CAMPO EN ESA PANTALLA, medidas ──────────
//   1. `createField(etiqueta, clave, tipo, obligatorio)` — el formulario principal. La `clave`
//      es literalmente `input.name`, o sea la columna de `Merchant` que se persiste.
//   2. `document.createElement("select")` + `.name = "…"` — el selector de país, que no pasa
//      por `createField` y por eso una lista basada solo en él lo perdería.
//   3. Campos escritos como HTML dentro de plantillas (`<input id="…">`, `<select id="…">`)
//      — página pública, color de marca, invita y gana, opciones del QR.
//
// Si mañana aparece una QUINTA forma, este censo no la verá: por eso el suelo (abajo) exige
// encontrar de las cuatro, y por eso el contraste con la lista del ticket se reporta en vez de
// silenciarse.
import ts from 'typescript';

/** Recorre un subárbol aplicando `fn`. */
function recorrer(nodo, fn) {
  fn(nodo);
  nodo.forEachChild((h) => recorrer(h, fn));
}

const textoDe = (n) =>
  n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null;

/** Todo el texto plano de una plantilla (para leer el HTML escrito dentro). */
function textoDePlantilla(n) {
  if (ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (!ts.isTemplateExpression(n)) return null;
  return n.head.text + n.templateSpans.map((s) => s.literal.text).join(' ');
}

/**
 * @param {string} fuente  contenido de settingsView.js
 * @returns {{campos:Array, porOrigen:Record<string,number>}}
 */
export function censarConfiguracion(fuente, ruta = 'settingsView.js') {
  const sf = ts.createSourceFile(ruta, fuente, ts.ScriptTarget.Latest, true);
  const campos = [];
  const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const vistos = new Set();
  const añadir = (c) => { const k = c.origen + ':' + c.clave; if (!vistos.has(k)) { vistos.add(k); campos.push(c); } };

  recorrer(sf, (n) => {
    // ── 1 · createField(etiqueta, clave, tipo, obligatorio) ──────────────────
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'createField') {
      const etiqueta = textoDe(n.arguments[0]);
      const clave = textoDe(n.arguments[1]);
      if (clave) {
        añadir({
          clave,
          etiqueta: etiqueta ?? '(etiqueta no literal)',
          tipo: textoDe(n.arguments[2]) ?? 'text',
          obligatorio: n.arguments[3]?.kind === ts.SyntaxKind.TrueKeyword,
          origen: 'createField',
          linea: linea(n),
        });
      }
    }

    // ── 1b · createToggle(clave, etiqueta, pista) — los avisos por email ─────
    // ⚠️ ESTA RAMA ES LA PRUEBA DE QUE EL CENSO A MANO NO VALE. La primera versión de este
    // fichero declaraba TRES formas, medidas, y daba 22 campos con los suelos en verde. Los
    // tres avisos por email no aparecían por ninguna parte — y la lista del ticket SÍ los
    // nombra. Los declara `createToggle`, una CUARTA forma. El contraste con la lista del
    // ticket es lo que lo destapó, no el censo: por eso el contraste se reporta y no se calla.
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'createToggle') {
      const clave = textoDe(n.arguments[0]);
      if (clave) {
        añadir({
          clave,
          etiqueta: textoDe(n.arguments[1]) ?? '(etiqueta no literal)',
          tipo: 'checkbox',
          obligatorio: false,
          origen: 'createToggle',
          linea: linea(n),
        });
      }
    }

    // ── 2 · createElement("select") … .name = "clave" ────────────────────────
    // El `.name` se asigna aparte, así que se busca la asignación por su forma.
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isPropertyAccessExpression(n.left) && n.left.name.text === 'name' && textoDe(n.right)) {
      añadir({
        clave: textoDe(n.right),
        etiqueta: '(select construido a mano)',
        tipo: 'select',
        obligatorio: false,
        origen: 'select',
        linea: linea(n),
      });
    }

    // ── 3 · HTML dentro de plantillas ───────────────────────────────────────
    if (ts.isTemplateExpression(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      const t = textoDePlantilla(n);
      if (!t) return;
      for (const m of t.matchAll(/<(input|select|textarea)\b[^>]*\bid="([a-zA-Z0-9_-]+)"/g)) {
        añadir({
          clave: m[2],
          etiqueta: '(en plantilla HTML)',
          tipo: m[1],
          obligatorio: false,
          origen: 'plantilla',
          linea: linea(n),
        });
      }
    }
  });

  campos.sort((a, b) => a.linea - b.linea);
  const porOrigen = campos.reduce((acc, c) => ({ ...acc, [c.origen]: (acc[c.origen] || 0) + 1 }), {});
  return { campos, porOrigen };
}

/** Columnas del modelo `Merchant`, derivadas del schema (no una lista a mano). */
export function columnasDeMerchant(schema) {
  const bloque = schema.match(/model\s+Merchant\s*\{([\s\S]*?)\n\}/);
  if (!bloque) return [];
  return bloque[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//') && !l.startsWith('@@'))
    .map((l) => l.split(/\s+/)[0])
    .filter((n) => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(n));
}
