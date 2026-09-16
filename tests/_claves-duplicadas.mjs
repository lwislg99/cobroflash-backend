/**
 * tests/_claves-duplicadas.mjs — SCRUM-751
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * DOS CLAVES IGUALES EN UN OBJETO LITERAL, DETECTADAS SOBRE EL FUENTE.
 *
 * 🔴 TIENE QUE SER SOBRE EL FUENTE, Y NO ES UNA PREFERENCIA: en `{ a: 1, a: 2 }` el objeto YA
 * CONSTRUIDO tiene UNA sola clave. La información de que hubo dos se pierde al evaluar, así que
 * ningún guard que importe el módulo y mire el objeto puede verlo — miraría justo después del
 * accidente. `Object.freeze` tampoco protege: el pisado ocurre al construir el literal, antes de
 * congelarlo.
 *
 * ── POR QUÉ VIVE EN UN HELPER Y NO DENTRO DE SU TEST ────────────────────────────────────────
 * Porque la casa tiene DIECISÉIS censos declarados como objeto literal y el defecto es de todos
 * ellos, no del que lo sufrió. Un detector metido dentro de `scrum751` obligaría al siguiente a
 * copiarlo, que es el escalón 3 del escalonado; aquí se puede DERIVAR (escalón 2).
 *
 * ── CÓMO SE CUENTA UNA CLAVE ───────────────────────────────────────────────────────────────
 *   · `a`, `'a'` y `"a"` son LA MISMA clave: se compara el texto ya resuelto, no cómo se
 *     escribió. Comparar la grafía dejaría pasar `{ a: 1, 'a': 2 }`, que es el mismo defecto.
 *   · `get a()` junto a `set a()` NO es duplicado: es la forma legítima de un accessor.
 *   · `[expr]: 1` (clave computada) y `...spread` se IGNORAN: su nombre no se puede saber
 *     leyendo, y adivinarlo daría falsos rojos.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** Marca interna para que un `get`/`set` no colisione con la propiedad normal del mismo nombre. */
const SUFIJO_ACCESSOR = '::accessor';

/** El nombre CANÓNICO de una propiedad, o `null` si no se puede saber leyendo el fuente. */
function nombreDeClave(p) {
  if (ts.isSpreadAssignment(p)) return null;
  const n = p.name;
  if (!n || ts.isComputedPropertyName(n)) return null;
  if (ts.isIdentifier(n) || ts.isPrivateIdentifier(n)) return n.text;
  if (ts.isStringLiteral(n) || ts.isNumericLiteral(n)) return n.text;
  return null;
}

/**
 * Las claves repetidas de CADA objeto literal del fuente.
 * @returns {Array<{clave: string, lineas: number[]}>}
 */
export function clavesDuplicadas(codigo, nombre = 'x.js') {
  const kind = /\.tsx?$/.test(nombre) ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true, kind);
  const salida = [];
  const visita = (n) => {
    if (ts.isObjectLiteralExpression(n)) {
      const vistas = new Map();
      for (const p of n.properties) {
        const k = nombreDeClave(p);
        if (k === null) continue;
        const esAccessor = ts.isGetAccessorDeclaration(p) || ts.isSetAccessorDeclaration(p);
        const clave = esAccessor ? k + SUFIJO_ACCESSOR : k;
        if (!vistas.has(clave)) vistas.set(clave, []);
        vistas.get(clave).push(sf.getLineAndCharacterOfPosition(p.getStart(sf)).line + 1);
      }
      for (const [clave, lineas] of vistas) {
        if (clave.endsWith(SUFIJO_ACCESSOR)) continue;
        if (lineas.length > 1) salida.push({ clave, lineas });
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return salida;
}

/** Los ficheros de código de un directorio, recursivo. Unidad: fichero `.ts/.js/.mjs/.cjs`. */
export function ficherosDeCodigo(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosDeCodigo(p, acc);
    else if (/\.(ts|js|mjs|cjs)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

/**
 * El censo del árbol, POR FAMILIA. Devuelve `{ porFamilia: {dir: nLeidos}, hallazgos: [...] }`.
 *
 * 🔴 El recuento va POR FAMILIA a propósito: un total agregado esconde el desplome de una rama
 * —si `public/` dejara de leerse, «1.145 ficheros» seguiría sonando a mucho—.
 */
export function censoDeClavesDuplicadas(raiz, familias) {
  const porFamilia = {};
  const hallazgos = [];
  const ilegibles = [];
  for (const fam of familias) {
    const ficheros = ficherosDeCodigo(path.join(raiz, fam));
    porFamilia[fam] = ficheros.length;
    for (const f of ficheros) {
      let dup;
      try {
        dup = clavesDuplicadas(fs.readFileSync(f, 'utf8'), path.basename(f));
      } catch (e) {
        // Un fichero que no se puede leer NO es un fichero sin duplicados: se declara.
        ilegibles.push(path.relative(raiz, f).split(path.sep).join('/'));
        continue;
      }
      for (const d of dup) {
        hallazgos.push({ fichero: path.relative(raiz, f).split(path.sep).join('/'), ...d });
      }
    }
  }
  return { porFamilia, hallazgos, ilegibles };
}
