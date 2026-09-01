// tests/_censo-aritmetica-iva.mjs — SCRUM-627
//
// Censa quién hace ARITMÉTICA DE IVA, **por lo que hace** y no por a quién llama.
//
// ── 🔴 POR QUÉ NO SIRVE BUSCAR LLAMADORES ────────────────────────────────────
// El censo de SCRUM-389 busca ficheros que LLAMEN a `calcVatBreakdown`. Es correcto y hoy hace
// su trabajo, pero está incompleto de una forma que no se ve desde dentro: **una
// reimplementación a mano no llama a nadie**, así que no aparece. El bloque de totales de la
// factura (`pdf.service.ts`) tiene su propio `vatMap` escrito a mano y es invisible para él.
//
// Aquí se busca por FORMA: multiplicar por un tipo, acumular una cuota, convertir fracción a
// porcentaje. Puro: recibe la fuente, devuelve el análisis.
//
// ── 🔴 LA TRAMPA QUE CASI ME COME, Y QUE DEFINE EL DISEÑO ────────────────────
// La primera versión buscaba por NOMBRE: identificadores llamados `tax`, `vat`, `iva`… Y **no
// veía la reimplementación de la factura**, porque ahí la variable del tipo se llama `t`:
//
//     const t    = Number(l.tax) || 0;
//     vatMap[key].vat += base * t;      ← invisible para un detector por nombre
//
// O sea: mi detector tenía la MISMA ceguera que el censo, un nivel más abajo. Por eso hay un
// paso de ALIAS: una variable inicializada desde algo que ya es un impuesto pasa a serlo, y se
// itera hasta punto fijo (`t` → `taxFrac` → …). Un detector de reimplementaciones que se deja
// engañar por renombrar una variable no vigila nada: renombrar es lo más barato que hay.
//
// ── LAS CLASES, Y POR QUÉ HAY UN CAJÓN «OTRO» ────────────────────────────────
//   DESGLOSE    · acumula una CUOTA por tipo. Es lo que hace la primitiva.
//   BRUTO       · aplica el IVA para obtener un total (`qty * price * (1 + tax)`).
//   CONVERSION  · pasa de fracción a porcentaje o al revés.
//   OTRO        · toca un impuesto y no encaja en las anteriores.
//
// 🔴 `OTRO` existe porque al refinar las clases **perdí dos ficheros** que la versión anterior
// sí veía (`albaran.service.ts`, `justificante.ts`): al añadir clases más finas dejé casos sin
// cubrir y el número BAJÓ sin que nada avisara. Un censo que clasifica mejor y cuenta menos es
// el mismo fallo que este ticket persigue. Con el cajón, nada que mencione un impuesto puede
// escaparse por no encajar.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** Nombres que SON un tipo de impuesto. Punto de partida de los alias, no la lista final. */
const ES_IMPUESTO = /^(tax|taxfrac|taxr|taxrate|vat|vatrate|iva|tipoiva|ivapct|ivaperc)$/i;
const ES_CUOTA = /^(vat|cuota|iva|vatamount|cuotaiva)$/i;
const ES_BASE = /^(base|baseimponible|subtotal|baseamount)$/i;
const PRIMITIVA = 'calcVatBreakdown';

function nombreDe(n) {
  if (!n) return null;
  if (ts.isIdentifier(n)) return n.text;
  if (ts.isPropertyAccessExpression(n)) return n.name.text;
  if (ts.isParenthesizedExpression(n)) return nombreDe(n.expression);
  return null;
}

/**
 * Analiza UNA fuente. Puro: no toca disco.
 * @returns {{llama:number, desglose:Array, bruto:Array, conversion:Array, otro:Array,
 *            desgloseCompleto:boolean, alias:string[]}}
 */
export function analizarFuente(texto, ruta = 'x.ts') {
  const sf = ts.createSourceFile(ruta, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  // ── PASO 1 · los ALIAS del impuesto, hasta punto fijo ──────────────────────
  const alias = new Set();
  const menciona = (n) => {
    let si = false;
    (function rec(x) {
      if (si || !x) return;
      const t = ts.isIdentifier(x) ? x.text : (ts.isPropertyAccessExpression(x) ? x.name.text : null);
      if (t && (ES_IMPUESTO.test(t) || alias.has(t))) { si = true; return; }
      x.forEachChild(rec);
    })(n);
    return si;
  };
  for (let vuelta = 0, cambio = true; cambio && vuelta < 10; vuelta++) {
    cambio = false;
    (function rec(n) {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer
          && !alias.has(n.name.text) && !ES_IMPUESTO.test(n.name.text) && menciona(n.initializer)) {
        alias.add(n.name.text); cambio = true;
      }
      n.forEachChild(rec);
    })(sf);
  }

  // ── PASO 2 · la aritmética ─────────────────────────────────────────────────
  const d = { llama: 0, desglose: [], bruto: [], conversion: [], otro: [] };
  let cuota = false; let base = false;
  const esCien = (x) => ts.isNumericLiteral(x) && x.text === '100';
  const unoMasImpuesto = (lado) => {
    let si = false;
    (function rec(x) {
      if (si || !x) return;
      if (ts.isBinaryExpression(x) && x.operatorToken.kind === ts.SyntaxKind.PlusToken
          && ((ts.isNumericLiteral(x.left) && x.left.text === '1' && menciona(x.right))
           || (ts.isNumericLiteral(x.right) && x.right.text === '1' && menciona(x.left)))) { si = true; return; }
      x.forEachChild(rec);
    })(lado);
    return si;
  };

  (function rec(n) {
    if (ts.isCallExpression(n) && nombreDe(n.expression) === PRIMITIVA) d.llama++;
    if (ts.isBinaryExpression(n)) {
      const op = n.operatorToken.kind;
      const txt = n.getText(sf).replace(/\s+/g, ' ').slice(0, 90);
      if (op === ts.SyntaxKind.PlusEqualsToken) {
        const dest = nombreDe(n.left);
        if (dest && ES_CUOTA.test(dest) && menciona(n.right)) { cuota = true; d.desglose.push({ linea: linea(n), txt }); }
        if (dest && ES_BASE.test(dest)) base = true;
      }
      if (op === ts.SyntaxKind.SlashToken && esCien(n.right) && menciona(n.left)) {
        d.conversion.push({ linea: linea(n), txt });
      }
      if (op === ts.SyntaxKind.AsteriskToken) {
        if (unoMasImpuesto(n.left) || unoMasImpuesto(n.right)) d.bruto.push({ linea: linea(n), txt });
        else if ((esCien(n.right) && menciona(n.left)) || (esCien(n.left) && menciona(n.right))) d.conversion.push({ linea: linea(n), txt });
        else if (menciona(n.left) || menciona(n.right)) d.otro.push({ linea: linea(n), txt });
      }
    }
    n.forEachChild(rec);
  })(sf);

  return { ...d, desgloseCompleto: cuota && base, alias: [...alias].sort() };
}

/** Todos los `.ts` de `src`. */
function fuentes(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fuentes(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** El censo del árbol. Devuelve sólo los ficheros con algún indicio. */
export function censarAritmeticaIva(raizAbsoluta) {
  const dirSrc = path.join(raizAbsoluta, 'src');
  const ficheros = fuentes(dirSrc);
  const salida = [];
  for (const ruta of ficheros) {
    const a = analizarFuente(fs.readFileSync(ruta, 'utf8'), ruta);
    const indicios = a.desglose.length + a.bruto.length + a.conversion.length + a.otro.length;
    if (indicios === 0 && a.llama === 0) continue;
    salida.push({ ruta: path.relative(raizAbsoluta, ruta).split(path.sep).join('/'), indicios, ...a });
  }
  return { ficherosMirados: ficheros.length, hallazgos: salida.sort((a, b) => a.ruta.localeCompare(b.ruta)) };
}

/**
 * EL CRITERIO DE SCRUM-389, copiado aquí a propósito: «ficheros que LLAMAN a la primitiva».
 * Se copia en vez de importarse porque aquel es un fichero de test y no exporta nada; el test
 * de SCRUM-627 CONTRASTA esta copia con la lista real que produce el censo, así que si la copia
 * dejara de ser fiel se sabría — no se pide fe.
 */
export function criterioDe389(analisis) {
  return analisis.llama > 0;
}
