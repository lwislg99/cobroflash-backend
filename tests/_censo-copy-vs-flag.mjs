// tests/_censo-copy-vs-flag.mjs — SCRUM-601 (DOC-11)
//
// ¿EL COPY DEL DOCUMENTO ES FUNCIÓN DEL FLAG, O ESTÁ ESCRITO A PELO?
//
// Dos instrumentos, los dos derivados del AST:
//
//   1. `portadoresDelFlag`  — el CIERRE TRANSITIVO de nombres que acarrean el valor de
//      `INVOICING_ES_ENABLED`. No es una lista escrita a mano: se siembra con el nombre del flag
//      y se itera a punto fijo. Una lista a mano de «cosas que dependen del flag» es justo el
//      instrumento que no puede descubrir que algo NO depende.
//
//   2. `censoCopy` — los literales con «factura»/«justificante» que llegan a un SUMIDERO VISIBLE
//      (DOM, toast, `message` de respuesta, texto de PDF), y si su valor lo elige o no una
//      condición que menciona a un portador.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ AST Y NO `grep`, medido en este mismo árbol
//
// De las apariciones de «factura» en `src/` y `public/`, la inmensa mayoría son COMENTARIOS que
// explican la regla, nombres de ruta, claves de objeto y operandos de `===`. Un censo por texto
// las cuenta todas como copy. Aquí solo entra lo que llega a un sumidero visible.
//
// 🔴 Y EL CIERRE MIRA IDENTIFICADORES, NO EL TEXTO DEL NODO. `node.getText()` incluye los
// COMENTARIOS, y este árbol está lleno de comentarios que citan `getEmissionMode` para explicar
// por qué algo NO lo usa. Con el texto crudo, esos comentarios convertían en «portador» a quien
// justamente declaraba no serlo. Se recogen los identificadores del AST, que no tienen ese
// problema.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ HACE CUANDO NO SABE LEER ALGO
//
// No lo ignora. Un sumidero visible cuyo valor mezcla literales con partes DINÁMICAS (una
// variable, una llamada, un dato del servidor) entra en `noLegibles`, y el test que lo consume
// FALLA declarándose ciego. Un instrumento que se calla lo que no entiende es un falso verde.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const aPosix = (p) => p.split(path.sep).join('/');

/** Sin acentos y en minúsculas, para que «Facturación» y «FACTURA» caigan igual. */
export const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** La diana del ticket: factura / justificante, con y sin acento, en cualquier caja. */
export const DIANA = /factur|justificant/;

/** Ficheros de la población: back en `src/*.ts`, front en `public/*.js`. */
export function poblacion(raiz) {
  const out = [];
  const anda = (dir, ext) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') anda(p, ext); continue; }
      if (e.name.endsWith(ext)) out.push(p);
    }
  };
  anda(path.join(raiz, 'src'), '.ts');
  anda(path.join(raiz, 'public'), '.js');
  return out;
}

const parsear = (p) => ts.createSourceFile('x.tsx', fs.readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true);

/**
 * Los IDENTIFICADORES dentro de un nodo. Sin comentarios (no son nodos) y —🔴 esto costó un
 * censo entero— SIN LOS VALORES DE CADENA: mezclarlos hacía que el literal `'factura'` contase
 * como una referencia al identificador `factura`, y por ahí `appDocumentoSuelto` salía «portador
 * vía factura», que es una vía inventada. Los textos son el SUJETO de este censo, no sus aristas.
 */
function identificadoresDe(nodo, sf) {
  const ids = new Set();
  const visitar = (n) => {
    if (ts.isIdentifier(n)) ids.add(n.text);
    else if (ts.isPropertyAccessExpression(n)) ids.add(n.name.text);
    ts.forEachChild(n, visitar);
  };
  visitar(nodo);
  return ids;
}

export const NOMBRE_FLAG = 'INVOICING_ES_ENABLED';

/**
 * SEMILLAS. Dos familias, y la diferencia entre ellas es un HALLAZGO, no un detalle de montaje.
 *
 *  · `FLAG`  — la cadena que se puede seguir EN CÓDIGO: `isFlagEnabled('INVOICING_ES_ENABLED')`
 *    → `getEmissionMode` → `modoDocumentoSuelto` → `/admin/me` → `window.appDocumentoSuelto`.
 *
 *  · `TIPO`  — la que pasa por la BASE DE DATOS. El pie del PDF dice «Justificante de cobro» o
 *    «Factura» según `params.type === 'JUST'`, y ese `type` lo escribió `emitInvoice` cuando la
 *    serie salió `J-`… que es lo que decidió el modo, que es lo que decidió el flag. La
 *    dependencia es REAL, pero está MEDIADA POR UN DATO PERSISTIDO y ningún cierre estático
 *    puede encadenarla: entre el flag y el literal hay una fila de `invoices`.
 *
 * 🔴 Por qué importa contarlas aparte: meter la familia TIPO en «NO depende» EXAGERA el defecto
 * (esos textos sí siguen al documento), y meterla en «SÍ depende del flag» lo TAPA (no se puede
 * demostrar desde el código, y para un documento ya emitido el flag de hoy ya no manda).
 * Son tres respuestas, no dos.
 */
export const SEMILLA_FLAG = { nombre: NOMBRE_FLAG, ids: new Set([NOMBRE_FLAG]), textos: new Set([NOMBRE_FLAG]) };
export const SEMILLA_TIPO = { nombre: 'TIPO_DEL_DOCUMENTO', ids: new Set(['isReceiptNumber', 'tipoDeFactura']), textos: new Set(['JUST', 'justificante']) };

/** ¿El nodo NOMBRA a la semilla? Identificador, o literal de cadena (`isFlagEnabled('…')`). */
function mencionaSemilla(nodo, semilla) {
  let visto = false;
  const visitar = (n) => {
    if (visto) return;
    if (ts.isIdentifier(n) && semilla.ids.has(n.text)) { visto = true; return; }
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && semilla.textos.has(n.text)) { visto = true; return; }
    ts.forEachChild(n, visitar);
  };
  visitar(nodo);
  return visto;
}

/**
 * EL CIERRE TRANSITIVO de portadores del flag.
 *
 * Semilla: el propio nombre del flag (que aparece como literal en `isFlagEnabled('…')` y como
 * clave en la tabla de defaults). Un nombre declarado es PORTADOR si entre los identificadores de
 * su cuerpo hay un portador ya conocido. Se itera hasta punto fijo.
 *
 * Cruza la frontera back→front sin saberlo: el back escribe `documentoSuelto:
 * modoDocumentoSuelto(…)` y el front lee `me.documentoSuelto`, así que el NOMBRE del campo JSON
 * es el puente, y el cierre lo recorre igual que cualquier otro.
 */
export function portadoresDelFlag(raiz, semilla = SEMILLA_FLAG) {
  const ficheros = poblacion(raiz);

  // ── PRIMERA PASADA: qué nombres LEE el front ────────────────────────────────────────────
  //
  // 🔴 NO se declara «cruza el cable» a toda clave escrita en `src/` que el front lea con ese
  // nombre. Se probó y fue el segundo falso positivo del día: `message`, `length`, `status`,
  // `number` y `plan` son claves de todo el mundo, y con ellas el cierre se comía media base de
  // código (`WIRE::length` «portando» el flag). El cable se deriva AL REVÉS y desde el final: una
  // clave sólo entra si su valor en `src/` YA es portador, y además el front la lee. Así el
  // puente sale de los portadores, no de la coincidencia de nombres.
  const accesosEnPublic = new Set();
  for (const p of ficheros) {
    const rel = aPosix(path.relative(raiz, p));
    if (!rel.startsWith('public/')) continue;
    const sf = parsear(p);
    const visitar = (n) => {
      if (ts.isPropertyAccessExpression(n)) accesosEnPublic.add(n.name.text);
      ts.forEachChild(n, visitar);
    };
    visitar(sf);
  }

  // ¿QUÉ FICHERO SIRVE EL ARRANQUE? El del `'/admin/me'`, que es por donde el back manda el modo
  // al navegador. Se LOCALIZA (literal de ruta en el AST), no se escribe a mano: si la ruta se
  // mueve de fichero, el cierre la sigue. Sin candidato, `ficheroArranque` queda `null` y la
  // promoción por cable no ocurre — y el test lo exige, en vez de dar por hecho que la encontró.
  let ficheroArranque = null;
  for (const p of ficheros) {
    const rel = aPosix(path.relative(raiz, p));
    if (!rel.startsWith('src/')) continue;
    const sf = parsear(p);
    let visto = false;
    const visitar = (n) => {
      if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && n.text === '/admin/me') visto = true;
      if (!visto) ts.forEachChild(n, visitar);
    };
    visitar(sf);
    if (visto) { ficheroArranque = rel; break; }
  }

  // ── SEGUNDA PASADA: las definiciones, CON ÁMBITO ────────────────────────────────────────
  //
  // 🔴 EL ÁMBITO ES EL TICKET ENTERO DE ESTE INSTRUMENTO. La primera versión usaba el nombre
  // pelado y daba 5261 portadores sobre 28176 definiciones: un `const merchant` de un fichero
  // convertía en «portador» a CUALQUIER `merchant` del árbol, y con él a media base de código.
  // El control positivo pasaba —`modoDocumentoSuelto` salía portador «vía merchant»—, o sea que
  // el instrumento acertaba la respuesta conocida POR EL MOTIVO EQUIVOCADO. Un control positivo
  // que pasa por casualidad no prueba nada, y por eso aquí se comprueba también LA VÍA.
  //
  // Claves: `EXPORT::x` (importable en cualquier sitio) · `WINDOW::x` (global del navegador) ·
  // `WIRE::x` (clave que cruza back→front) · `<fichero>::x` (local, no sale de su fichero).
  const defs = [];
  for (const p of ficheros) {
    const rel = aPosix(path.relative(raiz, p));
    const sf = parsear(p);
    const anota = (claves, nodo, clavePropiedad = null) => {
      defs.push({
        claves, rel, clavePropiedad,
        ids: identificadoresDe(nodo, sf),
        flag: mencionaSemilla(nodo, semilla),
        linea: sf.getLineAndCharacterOfPosition(nodo.getStart(sf)).line + 1,
      });
    };
    const exportado = (n) => !!(n.modifiers || []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    const visitar = (n) => {
      if (ts.isFunctionDeclaration(n) && n.name) {
        anota(exportado(n) ? [`EXPORT::${n.name.text}`, `${rel}::${n.name.text}`] : [`${rel}::${n.name.text}`], n);
      } else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
        const exp = ts.isVariableDeclarationList(n.parent) && n.parent.parent && exportado(n.parent.parent);
        anota(exp ? [`EXPORT::${n.name.text}`, `${rel}::${n.name.text}`] : [`${rel}::${n.name.text}`], n.initializer);
      } else if (ts.isPropertyAssignment(n) && n.initializer) {
        const k = n.name.getText(sf).replace(/['"]/g, '');
        anota([`${rel}::${k}`], n.initializer, k);
      } else if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(n.left)) {
        const obj = n.left.expression.getText(sf);
        const k = n.left.name.text;
        anota(obj === 'window' ? [`WINDOW::${k}`, `${rel}::${k}`] : [`${rel}::${k}`], n.right);
      }
      ts.forEachChild(n, visitar);
    };
    visitar(sf);
  }

  const portadores = new Map();
  const visibleDesde = (clave, rel) =>
    clave.startsWith('EXPORT::') || clave.startsWith('WINDOW::') || clave.startsWith('WIRE::') || clave.startsWith(rel + '::');
  let vueltas = 0, cambia = true;
  while (cambia && vueltas < 20) {
    cambia = false; vueltas += 1;
    for (const d of defs) {
      if (d.claves.every((c) => portadores.has(c))) continue;
      let via = d.flag ? semilla.nombre : null;
      if (!via) {
        for (const clave of portadores.keys()) {
          if (!visibleDesde(clave, d.rel)) continue;
          if (d.ids.has(clave.split('::').pop())) { via = clave; break; }
        }
      }
      if (!via) continue;
      const claves = [...d.claves];
      // ── EL PUENTE back→front, y por qué es TAN estrecho ──────────────────────────────────
      // Sólo asciende a `WIRE::` una clave portadora del OBJETO DE ARRANQUE (`/admin/me`) que el
      // front lea. Se intentó más ancho —cualquier clave de `src/` leída en `public/`— y fue el
      // segundo falso positivo del día: `message`, `length`, `status` y `plan` son claves de todo
      // el mundo, así que un `message:` portador en UN fichero convertía en portador a TODOS los
      // `message` del árbol y el cierre pasaba de decenas a 10.034 nombres. El cable de verdad es
      // uno y está documentado en el propio código: `/admin/me`.
      //
      // Los `message:` de otras rutas NO se pierden por esto: son literales del BACK y el censo
      // ya los mira ahí, en su sumidero. El cable sólo hace falta para poder clasificar los
      // literales del FRONT.
      if (d.clavePropiedad && d.rel === ficheroArranque && accesosEnPublic.has(d.clavePropiedad)) {
        claves.push(`WIRE::${d.clavePropiedad}`);
      }
      for (const c of claves) if (!portadores.has(c)) { portadores.set(c, { rel: d.rel, linea: d.linea, via }); cambia = true; }
    }
  }
  const cables = [...portadores.keys()].filter((k) => k.startsWith('WIRE::'));
  return { portadores, definiciones: defs.length, ficheros: ficheros.length, vueltas, cables, ficheroArranque };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// SUMIDEROS VISIBLES — medidos sobre el árbol, no supuestos
//
// Salieron de censar a QUÉ se asigna cada literal con la diana (`ConditionalExpression`, `+`,
// `message`, `textContent`, `innerHTML`, `title`, `setAttribute`, `showToast`, `doc.text`…).
// Lo que NO está aquí queda FUERA de la población, y es una decisión declarada: una clave de
// objeto, un operando de `===`, una ruta o un valor de enumerado no es copy.
// ─────────────────────────────────────────────────────────────────────────────────────────
const PROPS_DOM = new Set(['textContent', 'innerHTML', 'innerText', 'title', 'placeholder', 'alt', 'label']);
const PROPS_OBJETO = new Set(['message', 'titulo', 'rotulo', 'subtitulo', 'texto', 'label', 'etiqueta', 'title']);
const LLAMADAS = new Set(['alert', 'confirm', 'showToast', 'setStatus', 'text', 'setAttribute']);

/** El sumidero visible al que llega este nodo, o `null`. Sube por el valor, no por la sentencia. */
function sumideroDe(nodo, sf) {
  let n = nodo, hijo = nodo;
  // Se sube mientras el padre siga siendo el MISMO VALOR (ternario, concatenación, paréntesis…).
  while (n.parent) {
    const p = n.parent;
    const sigueSiendoValor =
      ts.isParenthesizedExpression(p) ||
      ts.isTemplateSpan(p) || ts.isTemplateExpression(p) ||
      (ts.isConditionalExpression(p) && (p.whenTrue === n || p.whenFalse === n)) ||
      (ts.isBinaryExpression(p) && [ts.SyntaxKind.PlusToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(p.operatorToken.kind));

    if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken && p.right === n) {
      if (ts.isPropertyAccessExpression(p.left) && PROPS_DOM.has(p.left.name.text)) {
        return { clase: 'DOM', detalle: p.left.name.text, nodoValor: n };
      }
      return null;
    }
    if (ts.isPropertyAssignment(p) && p.initializer === n) {
      const k = p.name.getText(sf).replace(/['"]/g, '');
      return PROPS_OBJETO.has(k) ? { clase: 'PROP', detalle: k, nodoValor: n } : null;
    }
    if (ts.isCallExpression(p) && p.arguments.includes(n)) {
      const e = p.expression;
      const nom = ts.isPropertyAccessExpression(e) ? e.name.text : e.getText(sf);
      return LLAMADAS.has(nom) ? { clase: 'LLAMADA', detalle: nom, nodoValor: n } : null;
    }
    if (!sigueSiendoValor) return null;
    hijo = n; n = p;
  }
  return null;
}

/**
 * ¿Qué condición ELIGE el texto de este literal, y menciona a un portador del flag?
 *
 * 🔴 `tope` NO ES UN DETALLE: es la diferencia entre «el flag decide QUÉ DICE este rótulo» y «el
 * flag decide SI EXISTE el bloque donde vive». Se subía por TODOS los ancestros, y el rótulo del
 * botón de Facturas vive dentro de un `if (window.appDocumentoSuelto !== 'no')` que decide si el
 * botón se pinta. Con eso, CUALQUIER literal metido en ese bloque salía «depende del flag» aunque
 * su texto estuviera clavado.
 *
 * Se cazó con una mutación: se cambió la condición del ternario por una que NO es portadora y el
 * guard siguió VERDE — el `if` de fuera lo tapaba. Y esa over-aproximación va en la dirección
 * peligrosa: la que ESCONDE el defecto que este ticket busca.
 *
 * Así que sólo cuentan las condiciones DENTRO del valor que llega al sumidero (`tope`). Las de
 * fuera se devuelven aparte, como `puerta`: informan, pero no deciden el texto.
 */
/** ¿Hay dentro de este nodo una escritura al MISMO sumidero (misma firma «clase:detalle»)? */
function contieneSumidero(nodo, sf, firma) {
  let visto = false;
  const visitar = (n) => {
    if (visto) return;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isIdentifier(n)) {
      const s = sumideroDe(n, sf);
      if (s && `${s.clase}:${s.detalle}` === firma) { visto = true; return; }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(nodo);
  return visto;
}

function condicionesQueLoEligen(nodo, sf, portadores, rel, tope, firmaSumidero) {
  const eligen = [], puertas = [];
  const visibleDesde = (clave) =>
    clave.startsWith('EXPORT::') || clave.startsWith('WINDOW::') || clave.startsWith('WIRE::') || clave.startsWith(rel + '::');
  const portadorEn = (cond) => {
    const ids = identificadoresDe(cond, sf);
    if (ids.has(NOMBRE_FLAG)) return NOMBRE_FLAG;
    for (const clave of portadores.keys()) {
      if (!visibleDesde(clave)) continue;
      if (ids.has(clave.split('::').pop())) return clave;
    }
    return null;
  };
  let n = nodo, dentroDelValor = true;
  while (n.parent) {
    const p = n.parent;
    if (tope && n === tope) dentroDelValor = false;
    let cond = null, elige = false;

    if (ts.isConditionalExpression(p) && (p.whenTrue === n || p.whenFalse === n)) {
      // Un ternario DENTRO del valor que llega al sumidero: elige el texto por definición.
      cond = p.condition; elige = dentroDelValor;
    } else if (ts.isIfStatement(p) && (p.thenStatement === n || p.elseStatement === n)) {
      // ── `if` QUE ELIGE vs `if` QUE ABRE LA PUERTA ────────────────────────────────────────
      //
      // 🔴 LOS DOS SE PARECEN Y NO SON LO MISMO, y confundirlos falla en las DOS direcciones.
      // Contarlos todos como «elige» daba falsos positivos (un rótulo clavado dentro de un
      // bloque gateado por el flag salía «depende»). No contar ninguno daba falsos NEGATIVOS, y
      // se cazó con un caso real: el pie del PDF es `if (isReceipt) doc.text('Justificante…')
      // else doc.text('Factura…')` — ahí el `if` SÍ elige el texto, y quedaba fuera.
      //
      // La señal que los separa, medida en el árbol: si la OTRA rama escribe en el MISMO
      // sumidero, el `if` está eligiendo entre dos textos. Si no, decide si el elemento existe.
      cond = p.expression;
      const otra = p.thenStatement === n ? p.elseStatement : p.thenStatement;
      elige = !!(otra && firmaSumidero && contieneSumidero(otra, sf, firmaSumidero));
    } else if (ts.isCaseClause(p)) {
      cond = p.parent.parent.expression; elige = true;
    }

    if (cond) {
      const via = portadorEn(cond);
      if (via) (elige ? eligen : puertas).push({ via, condicion: cond.getText(sf).replace(/\s+/g, ' ').slice(0, 120) });
    }
    n = p;
  }
  return { eligen, puertas };
}

/** Las hojas de un valor: literales estáticos y partes DINÁMICAS. */
function hojasDe(nodo, sf) {
  const estaticas = [], dinamicas = [];
  const visitar = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) { estaticas.push(n.text); return; }
    if (ts.isTemplateExpression(n)) {
      estaticas.push(n.head.text);
      for (const sp of n.templateSpans) { dinamicas.push(sp.expression.getText(sf).replace(/\s+/g, ' ')); estaticas.push(sp.literal.text); }
      return;
    }
    if (ts.isParenthesizedExpression(n)) return visitar(n.expression);
    if (ts.isConditionalExpression(n)) { visitar(n.whenTrue); visitar(n.whenFalse); return; }
    if (ts.isBinaryExpression(n) && [ts.SyntaxKind.PlusToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(n.operatorToken.kind)) {
      visitar(n.left); visitar(n.right); return;
    }
    dinamicas.push(n.getText(sf).replace(/\s+/g, ' ').slice(0, 80));
  };
  visitar(nodo);
  return { estaticas, dinamicas };
}

/**
 * EL CENSO. Un registro por literal-con-diana que llega a un sumidero visible.
 *
 * `noLegibles` son los que llegan a un sumidero visible pero cuyo valor mezcla partes dinámicas:
 * el texto final no se puede afirmar desde el fuente. NO se descartan ni se aprueban — se listan,
 * y quien los consuma tiene que fallar declarándose ciego.
 */
export function censoCopy(raiz, portadores, portadoresTipo = new Map()) {
  const ficheros = poblacion(raiz);
  const visibles = [], noLegibles = [];
  let literales = 0;

  // ── PASADA 0 · NOMBRES QUE SE LLAMAN EN UN SUMIDERO, EN TODO EL ÁRBOL ──────────────────
  //
  // 🔴 SIN ESTO, CENTRALIZAR COPY LA VUELVE INVISIBLE AL CENSO. Medido en SCRUM-776: al mover los
  // siete rótulos del documento suelto a `rotulosDelDocumento.js`, los literales dejaron de estar
  // pegados a un `textContent` —ahora los devuelve una función que el consumidor llama— y el
  // censo pasó de 162 literales visibles a 155. No es que hubiera menos copy: es que el
  // instrumento había dejado de verla, que es la peor forma de bajar un número.
  //
  // Así que se recoge el nombre de toda función CUYA LLAMADA ocupa un sumidero visible
  // (`x.textContent = R.tituloListado()`), y un literal devuelto por una función con ese nombre
  // hereda ese sumidero. Es UN nivel, igual que la indirección por `const` de más abajo: los
  // encadenamientos más largos siguen sin verse, y por eso el número no se publica solo.
  //
  // ⚠️ Es un puente POR NOMBRE, así que sobre-aproxima si alguien llama `label()` o `text()` en un
  // sumidero: cualquier propiedad homónima heredaría. Se acepta porque sobre-aproximar aquí mete
  // literales de más EN EL CENSO —que se leen y se clasifican— mientras que quedarse corto los
  // saca en silencio, que es lo que acaba de pasar.
  const nombresEnSumidero = new Set();
  for (const p of ficheros) {
    const sf = parsear(p);
    const visitar = (n) => {
      if (ts.isCallExpression(n)) {
        const s = sumideroDe(n, sf);
        if (s) {
          const e = n.expression;
          nombresEnSumidero.add(ts.isPropertyAccessExpression(e) ? e.name.text : e.getText(sf));
        }
      }
      ts.forEachChild(n, visitar);
    };
    visitar(sf);
  }

  for (const p of ficheros) {
    const rel = aPosix(path.relative(raiz, p));
    const sf = parsear(p);

    // ── PASADA A: dónde se USA cada nombre, y con qué sumidero ────────────────────────────
    //
    // 🔴 SIN ESTO EL CENSO SE DEJA COPY DE VERDAD, y no en teoría: el botón principal del modal
    // «Nueva factura» es `const NF_ACCION_PRIMARIA = 'Emitir factura'` (:29) puesto en
    // `emitir.textContent` (:182). El literal no toca ningún sumidero — lo toca el NOMBRE— así
    // que la primera versión de este censo NO LO VEÍA. Un censo que se deja fuera justo el rótulo
    // que el ticket vino a mirar no es un censo corto: es uno que miente por omisión.
    //
    // Se sigue UN nivel de indirección (literal → const → sumidero). Los encadenamientos más
    // largos se detectan y se declaran en `indireccionProfunda`: no se ignoran en silencio.
    const usosEnSumidero = new Map(); // nombre → sumidero
    const visitarUsos = (n) => {
      if (ts.isIdentifier(n)) {
        const sink = sumideroDe(n, sf);
        if (sink) usosEnSumidero.set(n.text, { sink, nodo: n });
      }
      ts.forEachChild(n, visitarUsos);
    };
    visitarUsos(sf);

    // ── PASADA B: los literales ───────────────────────────────────────────────────────────
    const visitar = (n) => {
      const esLit = ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);
      if (esLit) {
        literales += 1;
        if (DIANA.test(normalizar(n.text))) {
          const linea = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
          let sink = sumideroDe(n, sf);
          let sinkTmp = sumideroDe(n, sf);
          let razones = condicionesQueLoEligen(n, sf, portadores, rel, sinkTmp ? sinkTmp.nodoValor : null, sinkTmp ? sinkTmp.clase + ":" + sinkTmp.detalle : null);
          let via = 'directo';

          if (!sink) {
            // ¿Es el valor de un nombre que SÍ acaba en un sumidero?
            let d = n.parent;
            while (d && !ts.isVariableDeclaration(d) && !ts.isSourceFile(d)) d = d.parent;
            if (d && ts.isVariableDeclaration(d) && ts.isIdentifier(d.name)) {
              const uso = usosEnSumidero.get(d.name.text);
              if (uso) {
                sink = uso.sink;
                via = `const ${d.name.text}`;
                // Las condiciones del SITIO DE USO cuentan igual que las de la definición: el
                // rótulo puede elegirse arriba o abajo, y las dos formas son la misma pregunta.
                const rUso = condicionesQueLoEligen(uso.nodo, sf, portadores, rel, uso.sink.nodoValor, uso.sink.clase + ":" + uso.sink.detalle);
                razones = { eligen: razones.eligen.concat(rUso.eligen), puertas: razones.puertas.concat(rUso.puertas) };
              }
            }
          }

          if (!sink) {
            // ¿Lo DEVUELVE una función cuya llamada ocupa un sumidero? (ver PASADA 0)
            let d = n.parent, nombre = null;
            while (d && !ts.isSourceFile(d)) {
              if (ts.isPropertyAssignment(d)) { nombre = d.name.getText(sf).replace(/['"]/g, ''); break; }
              if (ts.isFunctionDeclaration(d) && d.name) { nombre = d.name.text; break; }
              if (ts.isVariableDeclaration(d) && ts.isIdentifier(d.name)) { nombre = d.name.text; break; }
              d = d.parent;
            }
            if (nombre && nombresEnSumidero.has(nombre)) {
              // El sumidero concreto no se conoce sin resolver el llamador; lo que importa aquí es
              // que el literal ES copy visible. Se declara la vía para que se pueda auditar.
              sink = { clase: 'DEVUELTO', detalle: nombre, nodoValor: n };
              via = `return ${nombre}()`;
            }
          }

          if (sink) {
            const { dinamicas } = hojasDe(sink.nodoValor, sf);
            const firma = sink.clase + ":" + sink.detalle;
            const porTipo = portadoresTipo.size
              ? condicionesQueLoEligen(n, sf, portadoresTipo, rel, sink.nodoValor, firma).eligen
              : [];
            const reg = {
              fichero: rel, linea, texto: n.text,
              sumidero: `${sink.clase}:${sink.detalle}`,
              alcance: via,
              dependeDelFlag: razones.eligen.length > 0,
              derivaDelTipo: razones.eligen.length === 0 && porTipo.length > 0,
              viaTipo: porTipo.length ? porTipo[0].via : null,
              via: razones.eligen.length ? razones.eligen[0].via : null,
              condicion: razones.eligen.length ? razones.eligen[0].condicion : null,
              puerta: razones.puertas.length ? razones.puertas[0].via : null,
              dinamicas,
            };
            visibles.push(reg);
            if (dinamicas.length) noLegibles.push(reg);
          }
        }
      }
      ts.forEachChild(n, visitar);
    };
    visitar(sf);
  }
  return { visibles, noLegibles, literales, ficheros: ficheros.length };
}
