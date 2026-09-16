// tests/_condiciones-vs-emisor.mjs — SCRUM-600e
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LA REGLA DE DOC-10, HECHA MECANISMO: **un control se pinta en el documento suelto si y sólo si
// su dato tiene dónde guardarse en la factura.**
//
// Hoy esa regla existe, se cumple y NADIE LA HACE CUMPLIR. Vive en 32 comentarios de
// `quotesView.js` y en 24 `if` sobre la bandera escritos a mano (20 negados, 4 no). SCRUM-600 la
// infringió dos veces él mismo —la tira de propuesta de descuento y la vista previa de
// condiciones de pago— y las dos las cazó una persona MONTANDO la pantalla, no un guard.
//
// ── POR QUÉ NO BASTA EL GUARD QUE YA HAY ────────────────────────────────────────────────────
//
// `scrum600b-la-factura-usa-el-front.test.mjs:307` comprueba lo mismo con una LISTA DE RÓTULOS
// escrita a mano (`NO_DEBEN_ESTAR`). Vigila el síntoma, y eso le cuesta las dos direcciones:
//
//   · un control NUEVO en «3. Condiciones» cuyo dato tampoco sobreviva **no está en la lista**,
//     así que entra sin que nada suene;
//   · y el día que el fundador apruebe el ALTER y `Invoice` gane `paymentTerms`, ese guard
//     seguiría exigiendo que «3. Condiciones» NO aparezca — **bloquearía la función correcta**
//     y habría que editarlo a mano para que dejase de mentir.
//
// Éste no lo sustituye: aquél fija los rótulos de HOY, éste deriva la REGLA. El día del ALTER,
// éste se pone verde solo.
//
// ── 🔴 LOS DOS LADOS SON DOS FICHEROS DISTINTOS, Y ESO ES EL PUNTO ──────────────────────────
//
// La lección de SCRUM-821c: dos lados que leen la MISMA fuente hacen imposible el control
// negativo, y entonces el verde no significa nada. Aquí:
//
//   LADO A · qué se PINTA   → `public/dashboard/js/quotesView.js`   (AST, no `grep`)
//   LADO B · qué se GUARDA  → `prisma/schema.prisma` + `facturaSuelta.ts`
//
// Ficheros distintos, lenguajes distintos, dueños distintos. **Ningún cambio en uno arrastra al
// otro**, así que se puede mutar A dejando B quieto y ver el rojo — y al revés. Los tests de
// este ticket hacen las dos mutaciones por separado, que es lo que prueba que el negativo apunta.
//
// ── 🔴 ESTO LEE EL CAMINO DE EMISIÓN, NO LO MODIFICA (regla 38 / CLAUDE.md AA1.4) ───────────
//
// `facturaSuelta.ts` y `schema.prisma` se abren en modo lectura y se parsean. Ni una firma
// cambia, ni se extrae un helper, ni se exporta nada nuevo para poder mirarlo. Por eso no hay
// STOP: el diff no toca `src/` ni `prisma/`.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { soloEjecutable } from './_guard-texto.mjs';
import { CAMPO_A_BLOQUE } from './_asignacion-bloques-presupuesto.mjs';
import { derivarOrdenDePintado } from './_orden-pintado-presupuesto.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

/** «No supe mirar» y «no hay nada ahí» son el mismo número con significados opuestos. */
export class CensoCiego extends Error {}

export const RUTA_PANTALLA = 'public/dashboard/js/quotesView.js';
export const RUTA_SCHEMA = 'prisma/schema.prisma';
export const RUTA_VALIDADOR = 'src/modules/invoicing/domain/facturaSuelta.ts';

/** El bloque que mide este censo. Un solo sitio lo nombra. */
export const BLOQUE = 'blockConditions';
/** La variable del front que decide el modo. Es el contrato con `renderQuotesView(c, null, true)`. */
export const BANDERA = 'esDocumentoSuelto';

export const leer = (rel, fuentes) =>
  (fuentes && fuentes[rel] !== undefined ? fuentes[rel] : fs.readFileSync(path.join(RAIZ, rel), 'utf8'));

// ─────────────────────────────────────────────────────────────────────────────────────────────
// LADO B · QUÉ PUEDE GUARDAR LA FACTURA
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Los campos de un `model` de Prisma, por TEXTO. `soloEjecutable` quita los comentarios primero:
 * `Invoice` documenta en prosa columnas que NO tiene (las que propone), y contarlas como
 * existentes daría por guardable justo lo que no lo está.
 */
export function camposDelModelo(texto, modelo) {
  const lineas = texto.split(/\r?\n/);
  let dentro = false;
  const campos = [];
  for (const cruda of lineas) {
    const linea = soloEjecutable(cruda, { almohadillaEsComentario: true });
    if (!dentro) {
      if (new RegExp(`^\\s*model\\s+${modelo}\\s*\\{`).test(linea)) dentro = true;
      continue;
    }
    if (/^\s*\}\s*$/.test(linea)) break;
    const m = /^\s*([A-Za-z0-9_]+)\s+\S/.exec(linea);
    if (m) campos.push(m[1]);
  }
  if (!dentro || campos.length === 0) {
    throw new CensoCiego(
      `🔴 no he sabido leer los campos de \`model ${modelo}\` en ${RUTA_SCHEMA}. Sin ellos, TODA `
      + 'columna parecería inexistente y el guard cantaría un defecto enorme que no existe.');
  }
  return campos;
}

/**
 * Las claves que SOBREVIVEN al validador del documento suelto, derivadas de su tipo de resultado.
 *
 * Se lee `ResultadoValidacion` y no el cuerpo de la función: el contrato es lo que la ruta
 * recibe, y ahí es donde está escrito. Si no se puede leer, se lanza.
 */
export function clavesQueSobreviven(texto) {
  const sf = ts.createSourceFile(RUTA_VALIDADOR, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let claves = null;
  const visitar = (n) => {
    if (ts.isTypeAliasDeclaration(n) && n.name.text === 'ResultadoValidacion' && ts.isUnionTypeNode(n.type)) {
      for (const miembro of n.type.types) {
        if (!ts.isTypeLiteralNode(miembro)) continue;
        const nombres = miembro.members
          .map((m) => (m.name && ts.isIdentifier(m.name) ? m.name.text : null))
          .filter(Boolean);
        if (nombres.includes('ok') && !nombres.includes('error')) {
          claves = nombres.filter((k) => k !== 'ok');
        }
      }
    }
    n.forEachChild(visitar);
  };
  visitar(sf);
  if (!claves || claves.length === 0) {
    throw new CensoCiego(
      `🔴 no he sabido leer la rama de ÉXITO de \`ResultadoValidacion\` en ${RUTA_VALIDADOR}. `
      + 'Cero claves supervivientes se leería como «el emisor lo tira todo», que no es lo medido.');
  }
  return claves;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// LADO A · QUÉ SE PINTA EN MODO DOCUMENTO SUELTO
// ─────────────────────────────────────────────────────────────────────────────────────────────

const baseDe = (expr) => {
  let n = expr;
  while (n && ts.isPropertyAccessExpression(n)) n = n.expression;
  return n && ts.isIdentifier(n) ? n.text : null;
};

const mencionaBandera = (nodo) => {
  let visto = false;
  const ver = (n) => { if (ts.isIdentifier(n) && n.text === BANDERA) visto = true; n.forEachChild(ver); };
  ver(nodo);
  return visto;
};

/**
 * Cómo trata una guarda al modo documento suelto. **Sólo se reconocen las DOS formas exactas** que
 * el fichero usa hoy; cualquier otra que mencione la bandera se declara OPACA y no se adivina.
 * Adivinar una condición compuesta es cómo un censo empieza a decir que algo se pinta cuando no.
 */
function formaDeLaGuarda(cond) {
  if (ts.isIdentifier(cond) && cond.text === BANDERA) return 'solo-suelto';
  if (ts.isPrefixUnaryExpression(cond)
      && cond.operator === ts.SyntaxKind.ExclamationToken
      && ts.isIdentifier(cond.operand) && cond.operand.text === BANDERA) return 'solo-presupuesto';
  return mencionaBandera(cond) ? 'opaca' : 'ajena';
}

/**
 * Cada `padre.appendChild(hijo)` DEL ESQUELETO ESTÁTICO, con si llega o no al documento suelto.
 *
 * «Esqueleto estático» es el criterio que ya usa `_orden-pintado-presupuesto.mjs`: profundidad de
 * función ≤ 1. Un `if` no es una función, así que las guardas de la bandera siguen dentro — que es
 * justo lo que aquí hay que ver, y lo que aquel censo ignora a propósito porque mide otra cosa.
 */
export function censarInsercionesDelSuelto(fuente, ruta = RUTA_PANTALLA) {
  const sf = ts.createSourceFile(ruta, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const nLinea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  const profundidadDeFuncion = (n) => {
    let d = 0;
    for (let p = n.parent; p; p = p.parent) {
      if (ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isArrowFunction(p)
          || ts.isMethodDeclaration(p)) d++;
    }
    return d;
  };

  /** Las guardas de la bandera que envuelven a este nodo, de dentro afuera. */
  const guardasDe = (nodo) => {
    const fuera = [];
    let hijo = nodo;
    for (let p = nodo.parent; p; hijo = p, p = p.parent) {
      if (!ts.isIfStatement(p)) continue;
      const forma = formaDeLaGuarda(p.expression);
      if (forma === 'ajena') continue;
      // Rama en la que cae el nodo: `then` o `else`. La contiene el ancestro directo del camino.
      const enElse = !!p.elseStatement && (hijo === p.elseStatement);
      fuera.push({ forma, enElse, linea: nLinea(p) });
    }
    return fuera;
  };

  const inserciones = [];
  const opacas = [];
  const recorrer = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && n.expression.name.text === 'appendChild' && profundidadDeFuncion(n) <= 1) {
      const padre = baseDe(n.expression.expression);
      const hijo = n.arguments[0] ? baseDe(n.arguments[0]) : null;
      if (padre && hijo) {
        const guardas = guardasDe(n);
        const linea = nLinea(n);
        const opaca = guardas.some((g) => g.forma === 'opaca');
        if (opaca) opacas.push({ padre, hijo, linea });
        // 🔴 LA OPACA ENTRA EN EL GRAFO IGUAL, y con `excluido`. No es un descarte: es que de esa
        // arista no se puede AFIRMAR que llegue al documento suelto, así que se trata como la más
        // conservadora —no llega— y se reporta aparte para que alguien la mire.
        //
        // Sacarla del grafo del todo fue el primer intento y estaba mal: dejaba a `blockConditions`
        // sin padre, y el control positivo del instrumento cantaba «no sé recorrer el grafo» sobre
        // un grafo que se recorría perfectamente. Dos diagnósticos opuestos por la misma puerta es
        // justo lo que este fichero no puede permitirse.
        const excluido = opaca || guardas.some((g) =>
          (g.forma === 'solo-presupuesto' && !g.enElse) || (g.forma === 'solo-suelto' && g.enElse));
        inserciones.push({ padre, hijo, linea, excluido, opaca, guardas });
      }
    }
    n.forEachChild(recorrer);
  };
  recorrer(sf);

  if (inserciones.length === 0) {
    throw new CensoCiego(
      `🔴 el censo no ha encontrado NI UN \`appendChild\` de esqueleto en ${ruta}. Cero inserciones `
      + 'es un analizador roto, no un formulario vacío.');
  }
  if (!inserciones.some((i) => i.guardas.length > 0)) {
    throw new CensoCiego(
      `🔴 no he visto NI UNA guarda de \`${BANDERA}\` sobre un \`appendChild\`. Si la pantalla dejó `
      + 'de distinguir los dos modos hay que saberlo; y si es que no sé leer la guarda, el guard '
      + 'daría verde sobre una medición vacía.');
  }

  // ── 🔴 ALCANZABILIDAD, Y NO LA GUARDA LOCAL. Este censo salió ROJO la primera vez y el modelo
  // roto era el MÍO: los tres controles de «3. Condiciones» se cuelgan de `blockConditions` SIN
  // guarda, y la guarda está una arista más arriba —`leftCard.appendChild(blockConditions)`—, así
  // que el bloque se queda HUÉRFANO con sus hijos dentro. Mirar sólo el `if` que envuelve a cada
  // `appendChild` decía «se pinta» de tres controles que no llegan a la pantalla.
  //
  // Un control se pinta si hay CAMINO desde la raíz hasta él sin una sola arista excluida. La
  // raíz no se escribe a mano: la deriva `_orden-pintado-presupuesto.mjs`, que ya la calcula como
  // el padre común de los bloques. Punto fijo y no un recorrido en orden de código, porque el
  // orden de las inserciones no garantiza que un padre se cuelgue antes que su hijo.
  const { raiz } = derivarOrdenDePintado(fuente, ruta);
  if (!raiz) {
    throw new CensoCiego(
      '🔴 no he podido derivar la RAÍZ del formulario. Sin raíz no hay alcanzabilidad, y todo '
      + 'control saldría «no se pinta» — un verde por vacío en el guard que vigila justo eso.');
  }
  const alcanzables = (contarExcluidas) => {
    const vistos = new Set([raiz]);
    for (let cambio = true; cambio;) {
      cambio = false;
      for (const i of inserciones) {
        if (!contarExcluidas && i.excluido) continue;
        if (vistos.has(i.padre) && !vistos.has(i.hijo)) { vistos.add(i.hijo); cambio = true; }
      }
    }
    return vistos;
  };
  const enSuelto = alcanzables(false);
  const enPresupuesto = alcanzables(true);

  // CONTROL POSITIVO DEL PROPIO INSTRUMENTO: en el PRESUPUESTO el bloque sí llega. Si saliera que
  // no llega a ninguno de los dos modos, lo que está roto es el lector del grafo — y eso no puede
  // salir por la misma puerta que «el documento suelto no lo pinta».
  if (!enPresupuesto.has(BLOQUE)) {
    throw new CensoCiego(
      `🔴 según este censo, \`${BLOQUE}\` no llega a la pantalla NI SIQUIERA en el presupuesto. `
      + 'Eso no es un hallazgo: es que no sé recorrer el grafo de inserción.');
  }

  return { inserciones, opacas, raiz, enSuelto, enPresupuesto };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// LA REGLA
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Campo → control, SOLO los del bloque que se mide. No es una lista nueva: es la de SCRUM-286. */
export function camposDelBloque(bloque = BLOQUE) {
  const pares = Object.entries(CAMPO_A_BLOQUE).filter(([, v]) => v.bloque === bloque);
  if (pares.length === 0) {
    throw new CensoCiego(
      `🔴 \`CAMPO_A_BLOQUE\` ya no asigna NI UN campo a \`${bloque}\`. Sin campos que vigilar este `
      + 'guard daría verde por vacío, que es el verde que no significa nada.');
  }
  return pares.map(([campo, v]) => ({ campo, control: v.control }));
}

/**
 * EL VEREDICTO. Devuelve qué está mal, NOMBRADO, y con qué se ha medido.
 *
 * Puro respecto de las fuentes: `fuentes` permite inyectar un texto MUTILADO para ver el rojo.
 * Un guard que sólo se ha visto en verde no se ha probado.
 */
export function revisarCondicionesContraEmisor(fuentes) {
  const pantalla = leer(RUTA_PANTALLA, fuentes);
  const schema = leer(RUTA_SCHEMA, fuentes);
  const validador = leer(RUTA_VALIDADOR, fuentes);

  const { inserciones, opacas, raiz, enSuelto, enPresupuesto } = censarInsercionesDelSuelto(pantalla);
  const guardables = new Set(camposDelModelo(schema, 'Invoice'));
  const supervivientes = new Set(clavesQueSobreviven(validador));
  const delBloque = camposDelBloque();

  /** Se pinta en el documento suelto = hay camino desde la raíz sin arista excluida. */
  const llega = (control) => enSuelto.has(control);

  // ① EL DEFECTO: un control de este bloque se pinta y su dato NO tiene dónde ir.
  const pidenLoQueSeTira = delBloque
    .filter(({ control }) => llega(control))
    .filter(({ campo }) => !guardables.has(campo) && !supervivientes.has(campo))
    .map(({ campo, control }) =>
      `\`${control}\` se pinta en el documento suelto y \`${campo}\` no existe en \`model Invoice\``);

  // ② Un control colgado del bloque que NADIE ha asignado: la lección de SCRUM-284. Sin esto, un
  //    control nuevo entra sin que suene nada, que es exactamente el hueco del guard por lista.
  const asignados = new Set(delBloque.map((x) => x.control));
  const sinAsignar = inserciones
    .filter((i) => i.padre === BLOQUE && !asignados.has(i.hijo))
    .filter((i) => !/Title$/.test(i.hijo)) // el H3 del título no lleva dato
    .map((i) => `\`${i.hijo}\` cuelga de \`${BLOQUE}\` (línea ${i.linea}) y no está en CAMPO_A_BLOQUE`);

  // ③ El SUELO del propio mapa: un control asignado que ya no llega ni al PRESUPUESTO. Se mide
  //    contra el presupuesto y no contra el suelto a propósito — en el suelto no llegar es lo
  //    esperado hoy, y confundir las dos cosas volvería a mezclar «apagado» con «desaparecido».
  const asignadosFantasma = delBloque
    .filter(({ control }) => !enPresupuesto.has(control))
    .map(({ campo, control }) => `\`${control}\` (campo \`${campo}\`) ya no llega ni al presupuesto`);

  return {
    pidenLoQueSeTira, sinAsignar, asignadosFantasma,
    opacas: opacas.map((o) => `${o.padre}.appendChild(${o.hijo}) línea ${o.linea}`),
    medicion: {
      raiz,
      controlesDelBloque: delBloque,
      lleganAlSuelto: delBloque.filter(({ control }) => llega(control)).map((x) => x.control),
      lleganAlPresupuesto: delBloque.filter(({ control }) => enPresupuesto.has(control)).map((x) => x.control),
      camposDeInvoice: guardables.size,
      supervivientes: [...supervivientes],
      inserciones: inserciones.length,
    },
  };
}
