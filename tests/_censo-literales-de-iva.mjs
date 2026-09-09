// tests/_censo-literales-de-iva.mjs — SCRUM-827
//
// UN TIPO DE IVA ESCRITO A MANO, CAZADO POR **NOMBRE + VALOR**. Puro: recibe directorios,
// devuelve el censo. No conoce ninguna ruta de este repo.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL HUECO QUE CIERRA, Y ESTABA DECLARADO POR ESCRITO DESDE EL 3-SEP-2026
//
//   `tests/scrum646-cortafuegos-defaultvat.test.mjs:27`
//     «Esto vigila el NOMBRE. Si alguien copia el número `0.21` a mano en un `create`, este
//      guard no lo ve. No se puede vigilar «un tipo impositivo» sin vigilar cualquier número,
//      y eso no es un guard: es ruido.»
//
//   `tests/scrum664-el-compilador-como-censo.test.mjs:11`
//     «① vigila el NOMBRE, no el VALOR: un `0.21` escrito a mano pasa por delante.
//      🔴 NO SE CUBRE AQUÍ.»
//
// 🔒 Un límite declarado y no cerrado deja de ser una advertencia y pasa a ser un permiso.
//
// ⛔ Y NO SE RELAJA NINGUNO DE LOS DOS: aquel vigila que nadie NOMBRE `defaultVat` fuera de la
// tabla; éste vigila que nadie escriba su VALOR. Son complementarios, y el de al lado lo dice.
//
// ── LA OBJECIÓN DEL 646 TIENE RESPUESTA, Y ES LA FORMA DE ESTE CENSO ─────────────────────
//
// «No se puede vigilar un tipo impositivo sin vigilar cualquier número» es cierto **si sólo se
// mira el valor**. Está MEDIDO en `docs/master/SCRUM-664.md`: por VALOR solo, en `src/` y
// `public/` salen 12 aciertos y **5 son ruido** —anchuras de columna de PDF (`wRot = totalsW *
// 0.21`), la fórmula de contraste WCAG (`0.05`)—. Un guard así da rojo por el ancho de una
// columna y alguien lo apaga en una tarde.
//
// Por eso aquí se exige **NOMBRE Y VALOR a la vez**: el número tiene que ser un tipo conocido Y
// estar asignado a algo que se llame fiscalmente. Con ese criterio, la misma medición dio **7
// aciertos y CERO falsos positivos**.
//
// ── 🔴 EL NOMBRE SE COMPARA POR SEGMENTOS, NO POR SUBCADENA ──────────────────────────────
//
// Es la lección literal de SCRUM-664 (`:151-152`): **`defaultVat` NO contiene `vat`** —lleva
// `Vat`, con V mayúscula, y `includes` distingue—, así que una comparación ingenua se deja fuera
// justo el caso que originó todo. Y al revés: buscar `iva` como subcadena casaría dentro de
// `privado`, `derivado` o `activar`.
//
// El identificador se parte por camello y por guiones bajos, se pasa a minúsculas, y se pregunta
// si ALGÚN segmento es EXACTAMENTE un nombre fiscal. `defaultVat` → `[default, vat]` ✅.
// `derivado` → `[derivado]` ❌. Sin listas de excepciones.
//
// ── 🔴 POR AST Y SOLO SOBRE LITERALES ────────────────────────────────────────────────────
//
// Un guard de TEXTO se caza a sí mismo en la prosa que explica la prohibición: este fichero
// escribe «0.21» para decir qué prohíbe. Con AST los comentarios no son nodos de literal, así que
// quedan fuera POR CONSTRUCCIÓN y no por una excepción que alguien tenga que mantener.
// ═════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/**
 * Los nombres que hacen fiscal a un número. Se comparan como SEGMENTO COMPLETO del identificador.
 *
 * `igv` es Perú y `igic` Canarias: los dos están en el producto (ver `locales.ts` y
 * `public/dashboard/js/tiposDeIva.js`), así que no son hipótesis.
 */
export const NOMBRES_FISCALES = Object.freeze(['vat', 'tax', 'iva', 'igic', 'igv']);

/**
 * Los tipos que cuentan como «un tipo impositivo», en sus DOS formas.
 *
 * Derivados de los que el producto usa de verdad: los seis de la tabla de locales (21 · 16 · 19 ·
 * 18) más los reducidos españoles (10 · 7 · 5 · 4 · 3, que `tiposDeIva.js` maneja). Se escriben
 * como FRACCIÓN (0.21) y como PORCENTAJE ENTERO (21) porque el producto usa las dos: la tabla
 * guarda fracciones y las pantallas enseñan enteros.
 *
 * ⚠️ NO se incluye el 0: un `tax: 0` es una exención legítima y frecuentísima, y meterlo
 * convertiría este guard en ruido — que es exactamente lo que el 646 temía.
 */
export const TIPOS_FRACCION = Object.freeze([0.21, 0.19, 0.18, 0.16, 0.10, 0.07, 0.05, 0.04, 0.03]);
export const TIPOS_ENTEROS = Object.freeze([21, 19, 18, 16, 10, 7, 5, 4, 3]);

/** Parte un identificador por camello y guiones bajos, en minúsculas. */
export function segmentos(nombre) {
  return String(nombre ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((s) => s.toLowerCase());
}

/** ¿Este identificador nombra algo fiscal? Por segmento completo, nunca por subcadena. */
export function esNombreFiscal(nombre) {
  return segmentos(nombre).some((s) => NOMBRES_FISCALES.includes(s));
}

/** ¿Este número es un tipo impositivo conocido, en cualquiera de sus dos formas? */
export function esTipoConocido(valor) {
  if (!Number.isFinite(valor)) return false;
  // Los céntimos de la fracción se comparan en enteros: 0.1 + 0.2 no es 0.3, y aquí no se puede
  // fallar por un flotante.
  const enCentesimas = Math.round(valor * 100);
  return TIPOS_FRACCION.some((t) => Math.round(t * 100) === enCentesimas && valor < 1)
    || TIPOS_ENTEROS.includes(valor);
}

const ES_CODIGO = (n) => /\.(ts|tsx|js|mjs)$/.test(n);
const SALTAR = new Set(['node_modules', 'dist', '.git', 'coverage']);

/** Todos los ficheros de código bajo un directorio. */
export function fuentesDe(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SALTAR.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fuentesDe(p, out);
    else if (ES_CODIGO(e.name)) out.push(p);
  }
  return out;
}

/**
 * El NOMBRE al que está atado un literal, o `null` si no está atado a ninguno.
 *
 * Tres formas, que son las que aparecen de verdad:
 *   · `{ defaultVat: 0.21 }`      → propiedad de un objeto
 *   · `const IVA_GENERAL = 0.21`  → declaración de variable
 *   · `obj.tax = 0.21`            → asignación a una propiedad
 *
 * Un literal suelto (`totalsW * 0.21`) no está atado a ningún nombre y por eso **no se cuenta**:
 * ahí está la diferencia entre este censo y el que daría ruido.
 */
export function nombreAtadoA(nodo) {
  const p = nodo.parent;
  if (!p) return null;
  if (ts.isPropertyAssignment(p) && p.initializer === nodo && p.name) return p.name.getText();
  if (ts.isVariableDeclaration(p) && p.initializer === nodo && p.name) return p.name.getText();
  if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && p.right === nodo) return p.left.getText();
  return null;
}

/**
 * EL CENSO. Un acierto = literal numérico cuyo VALOR es un tipo conocido **y** cuyo NOMBRE atado
 * es fiscal. Las dos condiciones, siempre.
 *
 * Devuelve `{ fichero, linea, nombre, valor, texto }` por acierto.
 */
export function censarLiteralesDeIva(dirs, { raiz = process.cwd() } = {}) {
  const hallazgos = [];
  for (const dir of dirs) {
    for (const abs of fuentesDe(path.join(raiz, dir))) {
      const codigo = fs.readFileSync(abs, 'utf8');
      const sf = ts.createSourceFile(abs, codigo, ts.ScriptTarget.Latest, true,
        /\.tsx?$/.test(abs) ? ts.ScriptKind.TS : ts.ScriptKind.JS);
      const rel = path.relative(raiz, abs).split(path.sep).join('/');
      (function anda(n) {
        if (ts.isNumericLiteral(n)) {
          const nombre = nombreAtadoA(n);
          if (nombre && esNombreFiscal(nombre) && esTipoConocido(Number(n.text))) {
            hallazgos.push({
              fichero: rel,
              linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
              nombre,
              valor: Number(n.text),
              texto: String(n.parent.getText(sf)).replace(/\s+/g, ' ').slice(0, 90),
            });
          }
        }
        ts.forEachChild(n, anda);
      })(sf);
    }
  }
  return hallazgos.sort((a, b) => a.fichero.localeCompare(b.fichero) || a.linea - b.linea);
}
