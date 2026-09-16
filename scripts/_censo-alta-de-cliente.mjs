// scripts/_censo-alta-de-cliente.mjs — SCRUM-795
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ¿QUIÉN CREA FILAS, Y QUÉ SE DEJA SIN ESCRIBIR?
//
// Dos preguntas con el mismo motor:
//
//   ① EL ALTA DE CLIENTE — cuántos caminos crean `Customer`, y de cada uno: ¿escribe
//      `portalToken`? ¿escribe `merchantId`? ¿pasa por `createCustomer`, el camino real?
//
//   ② 🔴 LA DONACIÓN SILENCIOSA — cuántos `create` del árbol OMITEN `merchantId` sobre un modelo
//      que lo tiene con `@default(1)`. Cada uno de esos escribe la fila a nombre del merchant 1
//      (el demo) sin decir nada, y el dueño real no la ve en su lista.
//
// ── POR QUÉ AST Y NO `grep` ──────────────────────────────────────────────────────────────────
// Es la misma razón de `tests/_embudo-factura.mjs` (SCRUM-203) y no se repite por gusto: un guard
// de texto se caza a sí mismo en el comentario que explica la regla, y `customer.createdAt` casa
// con un `grep` de `customer.create`. El AST no ve comentarios ni prefijos.
//
// ── LA POBLACIÓN SE DERIVA DEL SCHEMA, NO SE ESCRIBE ─────────────────────────────────────────
// Qué modelos existen, cuáles tienen `merchantId` y cuál es su forma (`@default(1)`, nullable, u
// obligatorio) sale de leer `prisma/schema.prisma`. Una lista escrita a mano aquí sería un censo
// congelado el día que se escribió — que es literalmente el defecto de SCRUM-778.
//
// ⚠️ SÓLO LECTURA sobre el schema. Este fichero no lo modifica ni propone modificarlo.
//
// ── ⛔ LO QUE NO VE, dicho aquí en vez de descubrirse en un rojo raro ─────────────────────────
//   · `data` construido FUERA del literal (`const d = {...}; create({ data: d })`). NO se da por
//     bueno: sale como `ilegible`, que es un resultado distinto de «omite» y de «escribe».
//     Fallar declarándose ciego, nunca en silencio.
//   · Receptor con alias (`const t = tx.customer; t.create(...)`). Misma ceguera declarada que el
//     analizador de SCRUM-203, y por el mismo motivo: cerrarla pide el checker de tipos con el
//     proyecto entero en memoria.
//   · Escrituras desde SQL en crudo o desde una migración a mano. Eso no es código de aplicación.
//   · Un `create` anidado bajo una relación hereda el dueño de su padre: se marca `anidado` y NO
//     se cuenta como omisión, porque ahí el `merchantId` no se escribe a propósito.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** Métodos de Prisma que dejan una fila nueva. Los mismos que vigila SCRUM-203. */
export const METODOS_CREACION = new Set(['create', 'createMany', 'createManyAndReturn', 'upsert']);

const CARPETAS_IGNORADAS = new Set(['node_modules', 'dist', '.git', 'coverage']);
const EXTENSIONES = new Set(['.ts', '.mjs', '.js']);

/**
 * Los modelos del schema y la FORMA de su `merchantId`, leídos del propio schema.
 *
 * `forma` es lo que decide la gravedad de una omisión:
 *   · `default-1`    → la fila nace del merchant 1 (el demo) EN SILENCIO. Es la donación.
 *   · `nullable`     → la fila nace sin dueño, también en silencio.
 *   · `obligatorio`  → Prisma se niega. Ruidoso: se descubre al primer intento, no meses después.
 *   · `sin-campo`    → el modelo no es multi-merchant.
 */
export function modelosDelSchema(textoSchema) {
  const out = new Map();
  for (const m of textoSchema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const nombre = m[1];
    let forma = 'sin-campo';
    let declaracion = null;
    for (const raw of m[2].split('\n')) {
      const l = raw.trim();
      if (!l || l.startsWith('//') || l.startsWith('///')) continue;
      const campo = /^(\w+)\s+(\S+)/.exec(l);
      if (!campo || campo[1] !== 'merchantId') continue;
      declaracion = l;
      if (/@default\(1\)/.test(l)) forma = 'default-1';
      else if (/^merchantId\s+\w+\?/.test(l)) forma = 'nullable';
      else forma = 'obligatorio';
      break;
    }
    // El nombre por el que se accede desde el cliente de Prisma: primera letra en minúscula.
    out.set(nombre.charAt(0).toLowerCase() + nombre.slice(1), { modelo: nombre, forma, declaracion });
  }
  return out;
}

const nombreDe = (n) => (ts.isIdentifier(n) || ts.isStringLiteral(n) ? n.text : n.getText());

/** Quita `x as T`, `(x)`, `x satisfies T`: envolturas que no cambian el valor. */
function desenvolver(n) {
  let x = n;
  while (x && (ts.isAsExpression(x) || ts.isParenthesizedExpression(x)
    || (ts.isSatisfiesExpression && ts.isSatisfiesExpression(x)))) x = x.expression;
  return x;
}

/**
 * Las claves VISIBLES de un literal de objeto, y si lleva `...spread`.
 *
 * 🔴 EL SPREAD NO CIEGA LA RESPUESTA ENTERA, Y ÉSTA ES UNA VERSIÓN CORREGIDA. La primera devolvía
 * `null` en cuanto veía un spread, y con eso `createCustomer` —que escribe
 * `{ ...normalizar(data), merchantId, portalToken }`— salía como ILEGIBLE. Lo cazó leer la salida:
 * el camino real del alta, el único que hace las dos cosas bien, aparecía como «no se sabe».
 *
 * La regla correcta es asimétrica, y esa asimetría es la que hace honesto el censo:
 *   · clave VISIBLE  → la escribe. Seguro, haya spread o no.
 *   · clave AUSENTE y SIN spread → la omite. Seguro.
 *   · clave AUSENTE y CON spread → **no se sabe**: el spread podría traerla. Sale ILEGIBLE, que
 *     es un resultado distinto de «omite» — y no se cuenta como omisión ni como escritura.
 */
function clavesDelLiteral(nodo, sf) {
  const e = desenvolver(nodo);
  if (!e || !ts.isObjectLiteralExpression(e)) return null;
  const claves = new Set();
  let spread = false;
  for (const p of e.properties) {
    if (ts.isSpreadAssignment(p)) { spread = true; continue; }
    if (p.name) claves.add(nombreDe(p.name).replace(/['"]/g, ''));
  }
  return { claves, spread };
}

/** Ficheros de aplicación bajo una raíz. */
export function fuentesDe(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (CARPETAS_IGNORADAS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fuentesDe(p, out);
    else if (EXTENSIONES.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

/**
 * TODAS las creaciones de fila del árbol, con lo que su `data` escribe y lo que omite.
 *
 * @param {object} o
 * @param {string} o.raiz      raíz del repo
 * @param {string[]} o.dirs    directorios de aplicación a barrer (derivados por quien llama)
 * @param {Map} o.modelos      salida de `modelosDelSchema`
 */
export function censar({ raiz, dirs, modelos }) {
  const rel = (p) => path.relative(raiz, p).split(path.sep).join('/');
  const creaciones = [];

  for (const dir of dirs) {
    const abs = path.join(raiz, dir);
    if (!fs.existsSync(abs)) throw new Error(`[censo-alta] no existe ${dir}/ bajo ${raiz}`);
    for (const p of fuentesDe(abs)) {
      const esTS = p.endsWith('.ts');
      const sf = ts.createSourceFile(p, fs.readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true,
        esTS ? ts.ScriptKind.TS : ts.ScriptKind.JS);
      const r = rel(p);

      const visitar = (n) => {
        // ── ① `<algo>.<modelo>.<metodo>({ data: … })` ──────────────────────────────────────
        if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
          const metodo = n.expression.name.text;
          const receptor = n.expression.expression;
          if (METODOS_CREACION.has(metodo) && ts.isPropertyAccessExpression(receptor)) {
            const modeloClave = receptor.name.text;
            const info = modelos.get(modeloClave);
            if (info) {
              const arg = n.arguments[0];
              const externo = clavesDelLiteral(arg, sf);
              let datos = null;
              if (externo) {
                const d = desenvolver(arg).properties
                  .find((p2) => p2.name && nombreDe(p2.name) === 'data');
                datos = d && ts.isPropertyAssignment(d) ? clavesDelLiteral(d.initializer, sf) : null;
              }
              creaciones.push({
                fichero: r,
                linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
                modelo: info.modelo,
                forma: info.forma,
                metodo,
                via: 'prisma-directo',
                claves: datos ? [...datos.claves] : null,
                spread: datos ? datos.spread : true,
                sinData: datos === null,
              });
            }
          }
        }
        ts.forEachChild(n, visitar);
      };
      ts.forEachChild(sf, visitar);
    }
  }
  return creaciones;
}

/**
 * ¿Escribe la clave `k`? `true` / `false` / **`null` cuando no se sabe**.
 *
 * El `null` es la mitad que importa: contarlo como `false` inventaría una omisión, y contarlo
 * como `true` absolvería un camino sin haberlo mirado. Las dos mentiras son caras y una es la
 * cómoda.
 */
export function escribe(c, k) {
  if (c.sinData) return null;                 // no hay literal `data` que leer
  if (c.claves.includes(k)) return true;      // visible: la escribe, haya spread o no
  return c.spread ? null : false;             // ausente: sin spread es omisión; con spread, no se sabe
}

/** Añade a cada camino de creación de `Customer` el veredicto de sus dos campos. */
export function altaDeCliente(creaciones) {
  return creaciones
    .filter((c) => c.modelo === 'Customer')
    .map((c) => ({ ...c, merchantId: escribe(c, 'merchantId'), portalToken: escribe(c, 'portalToken') }));
}

/**
 * 🔴 LAS OMISIONES QUE DONAN AL DEMO: creaciones sobre un modelo con `merchantId @default(1)` que
 * NO lo escriben. Se excluyen las que no se han podido leer — ésas van aparte.
 */
export function donacionesSilenciosas(creaciones) {
  return creaciones.filter((c) => c.forma === 'default-1' && escribe(c, 'merchantId') === false);
}

/**
 * 🔴 EL SUELO. Un cero aquí se leería como «nadie omite el merchantId», que es la lectura más
 * cómoda y la más cara. Si el barrido no ve creaciones, no ha medido.
 */
export function motivosParaNoFiarse({ creaciones, modelos, minimoCreaciones = 20 }) {
  const motivos = [];
  if (!modelos || modelos.size === 0) {
    motivos.push('CERO modelos leídos del schema: sin población no se puede clasificar nada');
  }
  if (creaciones.length < minimoCreaciones) {
    motivos.push(`sólo ${creaciones.length} creaciones vistas en todo el árbol y se esperaban al `
      + `menos ${minimoCreaciones}: el barrido no está llegando al código de aplicación`);
  }
  if (![...modelos.values()].some((m) => m.forma === 'default-1')) {
    motivos.push('NINGÚN modelo del schema tiene `merchantId` con `@default(1)`. Si eso cambió, '
      + 'la pregunta de este censo ya no existe — y su cero no significa lo que parece');
  }
  return motivos;
}
