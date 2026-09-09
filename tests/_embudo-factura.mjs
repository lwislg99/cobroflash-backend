// tests/_embudo-factura.mjs — SCRUM-203 · ¿de dónde sale el NÚMERO de cada factura que se crea?
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE
//
// El recon de SCRUM-200 afirma que 7 sitios crean facturas y que «los 7 pasan SIN EXCEPCIÓN»
// por `allocateInvoiceNumber()`. La frase es cierta el día que se escribe y falsa el día que
// alguien añada el camino 8 — en silencio. Todo el plan del semáforo fiscal se apoya en ella,
// así que aquí deja de ser una afirmación y pasa a ser un mecanismo.
//
// Este módulo NO construye el freno fiscal. Construye la garantía de que el freno, cuando
// exista, no tendrá puerta lateral: si el número de factura no sale del embudo, la validación
// que se cuelgue del embudo mañana no se ejecuta, y el freno es sensación de freno.
//
// POR QUÉ AST Y NO TEXTO (`_guard-texto.mjs`)
//
// Dos motivos, y el segundo es el que decide:
//
//  1. `invoice.createdAt` aparece 5 veces en `src/` y un `grep` de `invoice.create` las casa
//     todas. Con `\b` se esquiva, pero es esquivar por suerte.
//  2. **La trampa de auto-referencia.** Un guard de texto se caza a sí mismo porque el sitio
//     natural donde se escribe el literal prohibido es el comentario que explica la prohibición
//     (mordió cuatro veces: SCRUM-176, 168, 3, 193). El AST no ve comentarios: no hay nada que
//     filtrar, ni acordarse de filtrar. El problema no se mitiga, deja de existir.
//
// `typescript` es dependencia de desarrollo y `npm test` corre `npm run build` (= `tsc`) antes
// que nada: si no estuviera instalado, la tanda ya habría fallado en el build. Depender de él
// aquí no añade ni un modo de fallo nuevo.
//
// LO QUE ESTE ANALIZADOR **NO** VE (dicho aquí en vez de descubrirse en un rojo raro)
//
//  · Receptor con alias: `const t = tx.invoice; t.create({...})`. Se detecta el `.create` de
//    algo llamado `invoice`, no el de una variable que resulte serlo. Haría falta el checker
//    de tipos (proyecto entero en memoria) para cerrarlo; hoy nadie escribe así en este repo.
//  · Creación desde SQL en un fichero que no sea `.ts`/`.mjs`/`.js` de `src/` o `scripts/`
//    (una migración a mano, psql). Eso no es código de la aplicación: es el hueco del que
//    hablan las reglas 3 y 29, y se vigila en otro sitio.
//  · `data` construido fuera del literal (`const d = {...}; create({ data: d })`). NO es un
//    agujero: cuenta como fuga y sale ROJO, porque el guard no puede ver de dónde sale el
//    número. Fallar cerrado a propósito — la alternativa es un verde que no ha comprobado nada.
// ─────────────────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** El embudo. Único asignador de números de factura del backend (invoiceNumber.service.ts). */
export const EMBUDO = 'allocateInvoiceNumber';

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-729 · EL CENSO SIGUE AL CÓDIGO, Y AQUÍ EL CÓDIGO SE MOVIÓ A PROPÓSITO
//
// Los siete `tx.invoice.create` de `src/` pasaron a UN envoltorio, `crearFacturaEmitida`, para que
// el cliente congelado se escriba en un solo sitio. Eso dejó a este censo mirando un `create` que
// hace `{ ...datos }`: no ve el `number`, y lo llamó fuga. **Tenía razón** — lo que dejó de ser
// visible AHÍ es un hecho.
//
// La respuesta no es una excepción por nombre («si se llama así, pasa»), que es como se vacían los
// guards. Es MOVER LA PREGUNTA al sitio donde el hecho vive ahora: cada llamada a
// `crearFacturaEmitida(tx, cliente, datos)` se analiza EXACTAMENTE igual que se analizaba su
// `create` —¿de dónde sale `number`?—, y el `create` de dentro del envoltorio se admite SÓLO
// porque está en ese fichero y porque es el ÚNICO.
//
// El censo sale reforzado, no relajado: antes comprobaba 7 creaciones; ahora comprueba las 7
// llamadas MÁS que no exista ninguna otra puerta de creación en todo `src/`.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** El único creador de filas `Invoice` del backend (SCRUM-729). */
export const ENVOLTORIO = 'crearFacturaEmitida';

/**
 * Y su fichero. La excepción va anclada a la RUTA y no al nombre de la función: copiar el cuerpo
 * del envoltorio a otro sitio vuelve a salir en rojo, que es justo lo que tiene que pasar.
 */
export const RUTA_ENVOLTORIO = 'src/modules/invoicing/domain/crearFacturaEmitida.ts';

/** Métodos de Prisma que pueden dejar una fila `Invoice` nueva en la tabla. */
const METODOS_CREACION = new Set(['create', 'createMany', 'createManyAndReturn', 'upsert']);

/**
 * Campos de relación que apuntan a `Invoice` en `prisma/schema.prisma`. Un `create` anidado
 * bajo cualquiera de ellos crea una factura sin que aparezca nunca `invoice.create` en el
 * fuente: es la puerta lateral que un guard ingenuo no ve.
 *   Merchant.Invoice · Customer.Invoice · Quote.Invoice · Charge.invoices · Invoice.rectifiedBy
 */
const RELACIONES_INVOICE = new Set(['Invoice', 'invoices', 'rectifiedBy', 'rectifies']);
const CREACION_ANIDADA = new Set(['create', 'createMany', 'connectOrCreate']);

const EXTENSIONES = new Set(['.ts', '.mjs', '.js']);
const CARPETAS_IGNORADAS = new Set(['node_modules', 'dist', '.git']);

// ── utilidades de AST ─────────────────────────────────────────────────────────────────────

function nombreDe(nodo) {
  if (!nodo) return null;
  if (ts.isIdentifier(nodo) || ts.isPrivateIdentifier(nodo)) return nodo.text;
  if (ts.isStringLiteralLike(nodo)) return nodo.text;
  return null;
}

/** `{ foo: X }` y `{ foo }` (abreviada) devuelven lo mismo: el nodo del VALOR. */
function propiedad(obj, nombre) {
  if (!obj || !ts.isObjectLiteralExpression(obj)) return null;
  for (const p of obj.properties) {
    if (ts.isPropertyAssignment(p) && nombreDe(p.name) === nombre) return p.initializer;
    if (ts.isShorthandPropertyAssignment(p) && nombreDe(p.name) === nombre) return p.name;
  }
  return null;
}

/** ¿La expresión es una llamada al embudo? Con o sin `await`, suelta o como método. */
function esLlamadaAlEmbudo(expr) {
  let e = expr;
  if (!e) return false;
  if (ts.isAwaitExpression(e)) e = e.expression;
  if (!ts.isCallExpression(e)) return false;
  const c = e.expression;
  const nombre = ts.isPropertyAccessExpression(c) ? nombreDe(c.name) : nombreDe(c);
  return nombre === EMBUDO;
}

/** Funciones que contienen al nodo, de la más interna a la más externa, y el módulo al final. */
function ambitos(nodo, sf) {
  const out = [];
  for (let p = nodo.parent; p; p = p.parent) {
    if (
      ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) ||
      ts.isArrowFunction(p) || ts.isMethodDeclaration(p)
    ) out.push(p);
  }
  out.push(sf);
  return out;
}

/** Declaración `const X = …` visible desde el nodo, buscando de dentro hacia fuera. */
function declaracionDe(nombre, alcances) {
  for (const amb of alcances) {
    let hallada = null;
    const visitar = (n) => {
      if (hallada) return;
      if (ts.isVariableDeclaration(n) && nombreDe(n.name) === nombre) { hallada = n; return; }
      ts.forEachChild(n, visitar);
    };
    ts.forEachChild(amb, visitar);
    if (hallada) return hallada;
  }
  return null;
}

/** ¿El `.create` cuelga de algo llamado `invoice`? Cubre `tx.invoice` y `tx['invoice']`. */
function receptorEsInvoice(acceso) {
  const r = acceso.expression;
  if (ts.isPropertyAccessExpression(r)) return nombreDe(r.name) === 'invoice';
  if (ts.isElementAccessExpression(r)) return nombreDe(r.argumentExpression) === 'invoice';
  return false;
}

// ── el análisis ───────────────────────────────────────────────────────────────────────────

/**
 * Decide si un `invoice.create(...)` concreto toma su número del embudo.
 * Devuelve `null` si pasa por el embudo, o el MOTIVO de la fuga si no.
 */
function motivoDeFuga(llamada, sf) {
  const arg = llamada.arguments[0];
  if (!arg || !ts.isObjectLiteralExpression(arg)) {
    return 'el create no lleva un objeto literal: no hay forma de ver de dónde sale el número';
  }
  const data = propiedad(arg, 'data');
  if (!data) return 'el create no lleva `data` literal';
  if (!ts.isObjectLiteralExpression(data)) {
    return '`data` no es un objeto literal: el número puede venir de cualquier sitio';
  }
  return motivoPorElData(data, llamada, sf);
}

/**
 * La pregunta de siempre —¿de dónde sale `number`?— sobre el literal de datos, venga de un
 * `create({ data: … })` o del tercer argumento de `crearFacturaEmitida`. Se extrajo para que las
 * dos formas se juzguen con EL MISMO criterio y no puedan divergir (SCRUM-729).
 */
function motivoPorElData(data, llamada, sf) {
  const numero = propiedad(data, 'number');
  if (!numero) {
    return 'la factura se crea SIN campo `number` — el número quedaría al criterio de la BD';
  }
  if (esLlamadaAlEmbudo(numero)) return null;
  if (ts.isIdentifier(numero)) {
    const decl = declaracionDe(numero.text, ambitos(llamada, sf));
    if (decl && esLlamadaAlEmbudo(decl.initializer)) return null;
    return `\`number\` sale de \`${numero.text}\`, y \`${numero.text}\` no viene de ${EMBUDO}()`;
  }
  return '`number` se construye a mano, sin pasar por el embudo';
}

/** SCRUM-729 · `crearFacturaEmitida(tx, cliente, datos)`: el literal de datos es el TERCERO. */
function motivoDelEnvoltorio(llamada, sf) {
  const datos = llamada.arguments[2];
  if (!datos || !ts.isObjectLiteralExpression(datos)) {
    return `\`${ENVOLTORIO}\` sin literal de datos: no hay forma de ver de dónde sale el número`;
  }
  return motivoPorElData(datos, llamada, sf);
}

/** ¿La ruta analizada ES el fichero del envoltorio? Comparación por sufijo normalizado. */
function esElEnvoltorio(ruta) {
  return String(ruta).split(path.sep).join('/').endsWith(RUTA_ENVOLTORIO);
}

/**
 * Analiza UN fuente. Devuelve todas las creaciones de `Invoice` que encuentra; las que no
 * pasan por el embudo llevan `motivo` (las demás, `motivo: null`).
 */
export function analizarFuente(codigo, ruta = 'anonimo.ts') {
  const esTS = ruta.endsWith('.ts') || ruta.endsWith('.tsx');
  const sf = ts.createSourceFile(
    ruta, codigo, ts.ScriptTarget.Latest, /* setParentNodes */ true,
    esTS ? ts.ScriptKind.TS : ts.ScriptKind.JS,
  );

  const creaciones = [];
  const anota = (nodo, forma, motivo) => creaciones.push({
    ruta,
    linea: sf.getLineAndCharacterOfPosition(nodo.getStart(sf)).line + 1,
    forma,
    motivo,
    // SCRUM-729 · `true` sólo para el `create` de dentro del envoltorio. Es la IMPLEMENTACIÓN
    // del creador, no una boca de emisión: no pide número, se lo dan hecho. Los guards que
    // cruzan «llamadas al embudo == bocas de emisión» tienen que poder descontarla, y por eso
    // se marca aquí y no se les pide que reconozcan una ruta cada uno.
    implementacion: esElEnvoltorio(ruta) && forma.startsWith('invoice.create'),
  });

  const visitar = (n) => {
    // 1 · prisma/tx.invoice.create | createMany | createManyAndReturn | upsert
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const metodo = nombreDe(n.expression.name);
      if (METODOS_CREACION.has(metodo) && receptorEsInvoice(n.expression)) {
        anota(
          n,
          // SCRUM-729 · el `create` que vive DENTRO del envoltorio es su implementación: hace
          // `{ ...datos }` y el `number` viene ya resuelto de la llamada, que se juzga aparte
          // (caso 1-bis). La excepción va por RUTA, y el test exige además que sea el único.
          esElEnvoltorio(ruta) && metodo === 'create'
            ? `invoice.${metodo} (implementación de ${ENVOLTORIO})`
            : `invoice.${metodo}`,
          esElEnvoltorio(ruta) && metodo === 'create'
            ? null
            : metodo === 'create'
              ? motivoDeFuga(n, sf)
              : `\`${metodo}\` no puede acreditar que cada fila lleve un número del embudo`,
        );
      }
    }

    // 1-bis · SCRUM-729 · `crearFacturaEmitida(tx, cliente, datos)`. Es la creación REAL desde el
    //         punto de vista del llamador, y se le hace la MISMA pregunta que antes al `create`.
    if (ts.isCallExpression(n) && nombreDe(n.expression) === ENVOLTORIO && !esElEnvoltorio(ruta)) {
      anota(n, ENVOLTORIO, motivoDelEnvoltorio(n, sf));
    }

    // 2 · escritura ANIDADA: `{ Invoice: { create: … } }` desde Merchant/Customer/Quote/Charge.
    //     Crea la factura sin que `invoice.create` aparezca en el fuente.
    if (ts.isPropertyAssignment(n) && RELACIONES_INVOICE.has(nombreDe(n.name))) {
      if (ts.isObjectLiteralExpression(n.initializer)) {
        for (const clave of CREACION_ANIDADA) {
          if (propiedad(n.initializer, clave)) {
            anota(n, `${nombreDe(n.name)}.${clave} (anidado)`,
              'escritura anidada: crea una factura sin pasar por el embudo');
            break;
          }
        }
      }
    }

    // 3 · SQL en crudo contra la tabla.
    if (ts.isTaggedTemplateExpression(n) || ts.isCallExpression(n)) {
      const txt = n.getText(sf);
      if (/\$(execute|query)Raw/.test(txt) && /insert\s+into\s+"?invoice"?/i.test(txt)) {
        anota(n, 'SQL en crudo', 'INSERT directo sobre Invoice: se salta el embudo entero');
      }
    }

    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(sf, visitar);
  return creaciones;
}

/** Recorre un árbol y analiza todo fuente de aplicación que haya dentro. */
export function analizarArbol(raiz) {
  const out = [];
  const recorrer = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (CARPETAS_IGNORADAS.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { recorrer(p); continue; }
      if (!EXTENSIONES.has(path.extname(e.name))) continue;
      out.push(...analizarFuente(fs.readFileSync(p, 'utf8'), p));
    }
  };
  recorrer(raiz);
  return out;
}

/** `ruta:línea` relativo a la raíz del repo, para que el mensaje del rojo sea accionable. */
export function ubicacion(c, raizRepo) {
  return `${path.relative(raizRepo, c.ruta).split(path.sep).join('/')}:${c.linea}`;
}
