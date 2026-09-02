// tests/_censo-dos-fronts.mjs — SCRUM-600 (DOC-10) · EL CENSO DEL PASO 0.
//
// Contesta la pregunta del ticket —«qué tiene HOY cada uno de los dos fronts del documento»—
// DERIVÁNDOLO DEL CÓDIGO, no de las capturas del encargo. Puro: recibe las fuentes, devuelve
// el censo. Sin `grep`: análisis estático del árbol (AST), que es lo que manda `cerebro-yaqu`.
//
// ── 🔴 LA POBLACIÓN, DECLARADA. Un número sin población no vale nada ──────────
//
//   FRONT A · public/dashboard/js/quotesView.js        → `renderQuotesView`, PÁGINA completa
//   FRONT B · public/dashboard/js/nuevaFacturaModal.js → `openNuevaFacturaModal`, MODAL
//
// Y son DOS censos, porque son dos preguntas y mezclarlas daría un número más grande y menos
// cierto (misma disciplina que `_censo-nuevo-presupuesto.mjs` con envío vs pintado):
//
//   CENSO A · CONTROLES   — derivado ENTERO. Cada `document.createElement` de un control de
//             formulario, con el rótulo que se le pega. Nadie escribe la lista: sale del árbol,
//             así que lo que alguien añada mañana también se cuenta.
//   CENSO B · CAPACIDADES — el INVENTARIO está escrito a mano (sale del encargo: F7–F14, más las
//             estructurales); el VEREDICTO por front lo deriva un detector sobre el AST. Se dice
//             así de claro a propósito: una lista escrita a mano presentada como derivada es
//             justo el engaño que SCRUM-311 cazó en el guard de SCRUM-271.
//
// ── EL SUELO ─────────────────────────────────────────────────────────────────
// Si el escáner no encuentra NADA en un front, no dice «no tiene nada»: se declara CIEGO. Un
// cero de un instrumento roto se lee igual que una pantalla vacía.
import ts from 'typescript';

function recorrer(nodo, fn) { fn(nodo); nodo.forEachChild((h) => recorrer(h, fn)); }

const literal = (n) =>
  n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null;

/** Identificador base: `fieldCustomer.wrapper` va a `fieldCustomer`. */
function baseDe(expr) {
  let n = expr;
  while (n && ts.isPropertyAccessExpression(n)) n = n.expression;
  return n && ts.isIdentifier(n) ? n.text : null;
}

/** Nombre de la funcion llamada, sea `f(...)` o `x.f(...)`. */
function nombreLlamada(n) {
  if (!ts.isCallExpression(n)) return null;
  const c = n.expression;
  if (ts.isIdentifier(c)) return c.text;
  if (ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.name)) return c.name.text;
  return null;
}

const CONTROLES = new Set(['input', 'select', 'textarea', 'button']);

/**
 * CENSO A — los controles de formulario que PINTA un front, con su rotulo.
 *
 * Un control se identifica por la variable a la que se asigna su `createElement`. El rotulo se
 * busca en las escrituras posteriores sobre ESA variable (`placeholder`, `textContent`,
 * `aria-label`, `value`) — que es como esta escrito este codigo, sin JSX ni plantillas.
 */
export function censarControles(fuente, ruta) {
  const sf = ts.createSourceFile(ruta, fuente, ts.ScriptTarget.Latest, true);
  const nLinea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  const porVariable = new Map(); // nombre -> { variable, etiqueta, linea, rotulos, duplicado }

  // Paso 1 · variable <- document.createElement('<tag>')
  recorrer(sf, (n) => {
    if (!ts.isVariableDeclaration(n) || !ts.isIdentifier(n.name) || !n.initializer) return;
    const ini = n.initializer;
    if (nombreLlamada(ini) !== 'createElement') return;
    const tag = literal(ini.arguments[0]);
    if (!tag || !CONTROLES.has(tag)) return;
    // Un mismo nombre declarado dos veces haria mentir al grafo por nombre: se marca.
    if (porVariable.has(n.name.text)) porVariable.get(n.name.text).duplicado = true;
    else porVariable.set(n.name.text, {
      variable: n.name.text, etiqueta: tag, linea: nLinea(n), rotulos: [], duplicado: false,
    });
  });

  // Paso 2 · los rotulos que se le pegan a esa variable
  recorrer(sf, (n) => {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isPropertyAccessExpression(n.left)) {
      const v = baseDe(n.left);
      const prop = ts.isIdentifier(n.left.name) ? n.left.name.text : null;
      const txt = literal(n.right);
      if (v && txt && porVariable.has(v)
          && ['placeholder', 'textContent', 'innerHTML', 'value'].includes(prop)) {
        porVariable.get(v).rotulos.push({ via: prop, texto: txt });
      }
      return;
    }
    if (ts.isCallExpression(n) && nombreLlamada(n) === 'setAttribute' && n.arguments.length === 2) {
      const v = baseDe(n.expression);
      const attr = literal(n.arguments[0]);
      const txt = literal(n.arguments[1]);
      if (v && attr && txt && porVariable.has(v)) porVariable.get(v).rotulos.push({ via: attr, texto: txt });
    }
  });

  return {
    poblacion: {
      fichero: ruta,
      frontera: 'document.createElement de input/select/textarea/button',
      mide: 'los CONTROLES que se pintan',
    },
    controles: [...porVariable.values()].sort((a, b) => a.linea - b.linea),
  };
}

/**
 * Los DETECTORES del censo B. Cada uno es puro sobre el arbol.
 *
 * NO se buscan textos con `includes` sobre la fuente: eso da verde con el texto dentro de un
 * comentario, que es el falso verde que cazo SCRUM-515. Se busca la LLAMADA que mete la cosa
 * en el DOM.
 */
function hayLlamada(sf, { nombre, receptor = null, argumento = null }) {
  let visto = false;
  recorrer(sf, (n) => {
    if (visto || !ts.isCallExpression(n)) return;
    if (nombreLlamada(n) !== nombre) return;
    if (receptor && baseDe(n.expression) !== receptor) return;
    if (argumento && !(n.arguments[0] && ts.isIdentifier(n.arguments[0]) && n.arguments[0].text === argumento)) return;
    visto = true;
  });
  return visto;
}

/** Existe una propiedad `clave` en algun objeto literal del arbol. */
function hayPropiedad(sf, clave) {
  let visto = false;
  recorrer(sf, (n) => {
    if (visto || !ts.isObjectLiteralExpression(n)) return;
    for (const p of n.properties) {
      const nom = p.name && (ts.isIdentifier(p.name) ? p.name.text
        : (ts.isStringLiteral(p.name) ? p.name.text : null));
      if (nom === clave) visto = true;
    }
  });
  return visto;
}

export const CAPACIDADES = [
  // ── Los del encargo que viven EN EL FORMULARIO del documento ───────────────
  { id: 'F7', que: 'vista previa en vivo, al lado del formulario',
    detecta: (sf) => hayLlamada(sf, { nombre: 'appendChild', receptor: 'rightCard', argumento: 'previewBox' }) },
  { id: 'F8', que: 'suplido como concepto de primera clase (viaja en la linea)',
    detecta: (sf) => hayPropiedad(sf, 'suplido') },
  // 🔴 F9 RETIRADO POR SCRUM-598 (DOC-08), y esto ES el cambio de máster que este censo exige.
  //
  // F9 decía «coste y margen existen EN EL PRODUCTO (markup por línea)». La capacidad NO ha
  // desaparecido: **se ha mudado**. Desde CAT-01 (SCRUM-609) el coste y el margen viven en el
  // CATÁLOGO, con su propio campo y su propia aritmética (`margenCatalogo.js`). Lo que se retira
  // es el margen del DOCUMENTO, que es otra cosa: información del profesional viviendo en el
  // papel que le enseña a su cliente.
  //
  // Decisión del fundador, 24-ago-2026. Registrada en `docs/master/SCRUM-598.md`.
  //
  // Y el detector de F9 anclaba en `markupTd.appendChild(markupInput)` DENTRO de `quotesView.js`
  // — o sea, medía la capacidad por su dirección vieja. Este censo compara los dos fronts del
  // DOCUMENTO; en el documento el margen ya no vive, así que aquí no hay nada que vigilar.
  // Quien quiera vigilarlo en su casa nueva, lo hace sobre el catálogo y no aquí.
  { id: 'F10', que: 'la comision se declara en el propio formulario',
    detecta: (sf) => hayLlamada(sf, { nombre: 'appendChild', receptor: 'payMethodsWrapper', argumento: 'pmFee' }) },
  { id: 'F11', que: 'Sugerir con IA + Usar plantilla, en primer plano',
    detecta: (sf) => hayLlamada(sf, { nombre: 'appendChild', receptor: 'linesHeader', argumento: 'aiBtn' })
                  && hayLlamada(sf, { nombre: 'appendChild', receptor: 'linesHeader', argumento: 'useTemplateBtn' }) },
  { id: 'F12', que: 'el selector de formas de pago dice QUE FALTA',
    detecta: (sf) => hayLlamada(sf, { nombre: 'appendChild', receptor: 'payMethodsWrapper', argumento: 'pmNote' }) },
  // ── Las ESTRUCTURALES: son las que separan una PAGINA de un MODAL ──────────
  { id: 'E1', que: 'los cuatro bloques en orden de decision (Cliente/Lineas/Condiciones/Envio)',
    detecta: (sf) => ['blockClient', 'blockLines', 'blockConditions', 'blockDelivery']
      .every((b) => hayLlamada(sf, { nombre: 'appendChild', receptor: 'leftCard', argumento: b })) },
  { id: 'E2', que: 'condiciones de pago (select de plazos)',
    detecta: (sf) => hayLlamada(sf, { nombre: 'appendChild', receptor: 'blockConditions', argumento: null }) },
  { id: 'E3', que: 'caducidad / fecha propia del documento',
    detecta: (sf) => hayLlamada(sf, { nombre: 'appendChild', receptor: 'blockConditions', argumento: 'validWrapper' }) },
  { id: 'E4', que: 'que datos del cliente salen en el documento',
    detecta: (sf) => hayLlamada(sf, { nombre: 'appendChild', receptor: 'blockDelivery', argumento: 'docFieldsWrapper' }) },
  { id: 'E5', que: 'estado del documento en el panel derecho',
    detecta: (sf) => hayLlamada(sf, { nombre: 'appendChild', receptor: 'rightCard', argumento: 'resultBox' }) },
  { id: 'E6', que: 'autoguardado de borrador',
    detecta: (sf) => hayLlamada(sf, { nombre: 'scheduleDraftSave' }) },
  { id: 'E7', que: 'guardar las lineas como plantilla',
    detecta: (sf) => hayLlamada(sf, { nombre: 'appendChild', receptor: 'actionsRow', argumento: 'saveTemplateBtn' }) },
  { id: 'E8', que: 'reordenar lineas (arrastre + mover)',
    detecta: (sf) => hayLlamada(sf, { nombre: 'moverLinea' }) },
];

/**
 * Existe una propiedad `clave` DENTRO del objeto que se le pasa a `llamada(...)`.
 *
 * 🔴 NACE DE UN ROJO, y merece quedar escrito: el detector de F8 empezo siendo «existe la clave
 * `suplido` en ALGUN literal del fichero», y su control negativo lo tumbo — la clave tambien
 * esta en el snapshot del borrador, asi que quitar la del ENVIO no cambiaba la respuesta. Un
 * detector asi habria dado verde el dia que la marca dejara de viajar al servidor, que es
 * exactamente el fallo que F8 viene a impedir. La poblacion no es «el fichero»: es el objeto
 * que se envia.
 */
function hayPropiedadEnArgumentoDe(sf, { llamada, clave }) {
  let visto = false;
  recorrer(sf, (n) => {
    if (visto || !ts.isCallExpression(n)) return;
    if (nombreLlamada(n) !== llamada) return;
    const obj = n.arguments[0];
    if (!obj || !ts.isObjectLiteralExpression(obj)) return;
    for (const p of obj.properties) {
      const nom = p.name && (ts.isIdentifier(p.name) ? p.name.text
        : (ts.isStringLiteral(p.name) ? p.name.text : null));
      if (nom === clave) visto = true;
    }
  });
  return visto;
}

/**
 * Existe `llamada('<texto>', ...)` DENTRO de un `if` cuya condicion menciona `identificador`.
 *
 * 🔴 NACE DE UN ROJO, el segundo de este fichero. El detector de F13 empezo siendo «existe la
 * llamada `renderAppView('jobs-detail', ...)`», y al romper F13 A PROPOSITO —cambiando
 * `if (f.jobId != null)` por `if (false)`— la red NO LO CAZO: la llamada seguia en el arbol,
 * solo que ya no la alcanzaba nadie.
 *
 * La leccion, que vale para toda esta clase de guard: un detector estatico caza que algo se
 * BORRE, no que se DESACTIVE. Y desactivar es la forma barata de perder una funcion. Por eso
 * aqui no basta con que la llamada exista: tiene que colgar de la condicion que la hace
 * alcanzable. `if (false)` deja de contar.
 */
function hayLlamadaBajoCondicion(sf, { llamada, texto, identificador }) {
  let visto = false;
  recorrer(sf, (n) => {
    if (visto || !ts.isIfStatement(n)) return;
    let mencionado = false;
    recorrer(n.expression, (c) => { if (ts.isIdentifier(c) && c.text === identificador) mencionado = true; });
    if (!mencionado) return;
    recorrer(n.thenStatement, (c) => {
      if (!ts.isCallExpression(c)) return;
      if (nombreLlamada(c) !== llamada) return;
      if (literal(c.arguments[0]) !== texto) return;
      visto = true;
    });
  });
  return visto;
}

/**
 * ── LOS OCHO ─────────────────────────────────────────────────────────────────
 * F7–F14: lo que el encargo de SCRUM-600 declara INNEGOCIABLE. No es lo mismo que el censo:
 * el censo COMPARA dos fronts, esto SUJETA ocho funciones — dos de las cuales (F13, F14) ni
 * siquiera viven en el formulario del documento.
 *
 * 🔴 MEDIDO EL 24-ago-2026, ANTES de escribir esto: los OCHO estaban SUELTOS. Se rompio cada
 * uno a proposito sobre `main` (9b49190a) y la tanda completa —3.934 tests— siguio en VERDE en
 * los seis del formulario; en F13 y F14 lo unico que cayo fue el guard de fines de linea de
 * SCRUM-533, que salta porque esos dos ficheros llevan CRLF en disco y no dice nada de la
 * funcion. El banco SABE dar rojo: el control positivo (cambiar el texto aprobado de la accion
 * primaria del modal) si cayo, y nombrando su guard.
 *
 * Cada entrada trae su `ancla`: la LINEA EXACTA cuya desaparicion mata la funcion. Sirve para
 * dos cosas y las dos hacen falta —
 *   · el detector la busca en el arbol (control POSITIVO: hoy esta);
 *   · el test la quita de una copia en memoria y exige que el detector CAMBIE DE RESPUESTA
 *     (control NEGATIVO). Un detector que no sabe decir «no» no vigila nada.
 */
export const LOS_OCHO = [
  { id: 'F7', que: 'VISTA PREVIA EN VIVO mientras escribes, al lado del formulario',
    fichero: 'public/dashboard/js/quotesView.js',
    ancla: '  rightCard.appendChild(previewBox);',
    detecta: (sf) => hayLlamada(sf, { nombre: 'appendChild', receptor: 'rightCard', argumento: 'previewBox' }) },
  { id: 'F8', que: 'SUPLIDO como concepto de primera clase: la marca VIAJA en la linea',
    fichero: 'public/dashboard/js/quotesView.js',
    ancla: '  suplido: !!(line.suplidoCheck && line.suplidoCheck.checked),',
    detecta: (sf) => hayPropiedadEnArgumentoDe(sf, { llamada: 'lineaParaPayload', clave: 'suplido' }) },
  // (F9 retirado por SCRUM-598 — ver el motivo en la lista de arriba.)
  { id: 'F10', que: 'LA COMISION SE DECLARA EN EL PROPIO FORMULARIO',
    fichero: 'public/dashboard/js/quotesView.js',
    ancla: '    payMethodsWrapper.appendChild(pmFee);',
    detecta: (sf) => hayLlamada(sf, { nombre: 'appendChild', receptor: 'payMethodsWrapper', argumento: 'pmFee' }) },
  { id: 'F11', que: 'plantillas + Sugerir con IA + Usar plantilla, GRATIS Y EN PRIMER PLANO',
    fichero: 'public/dashboard/js/quotesView.js',
    ancla: '  linesHeader.appendChild(useTemplateBtn);',
    detecta: (sf) => hayLlamada(sf, { nombre: 'appendChild', receptor: 'linesHeader', argumento: 'aiBtn' })
                  && hayLlamada(sf, { nombre: 'appendChild', receptor: 'linesHeader', argumento: 'useTemplateBtn' }) },
  { id: 'F12', que: 'EL SELECTOR DE FORMAS DE PAGO DICE QUE FALTA',
    fichero: 'public/dashboard/js/quotesView.js',
    ancla: '    payMethodsWrapper.appendChild(pmNote);',
    detecta: (sf) => hayLlamada(sf, { nombre: 'appendChild', receptor: 'payMethodsWrapper', argumento: 'pmNote' }) },
  { id: 'F13', que: 'albaranes con enlace al TRABAJO DE ORIGEN',
    fichero: 'public/dashboard/js/albaranesView.js',
    ancla: "        if (f.jobId != null) {",
    detecta: (sf) => hayLlamadaBajoCondicion(sf, { llamada: 'renderAppView', texto: 'jobs-detail', identificador: 'jobId' }) },
  { id: 'F14', que: 'LA FIRMA DEL CLIENTE SALE EN EL PDF con trazo manuscrito',
    fichero: 'src/modules/jobs/infra/albaranPdf.service.ts',
    ancla: '      doc.image(imgBuffer, M, doc.y, { width: 180, height: 70, fit: [180, 70] });',
    detecta: (sf) => hayLlamada(sf, { nombre: 'image', receptor: 'doc', argumento: 'imgBuffer' }) },
];

/** El censo B: por capacidad, veredicto en cada front. */
export function censarCapacidades(fuentes) {
  const arboles = fuentes.map((f) => ({
    nombre: f.nombre,
    sf: ts.createSourceFile(f.nombre, f.fuente, ts.ScriptTarget.Latest, true),
  }));
  return CAPACIDADES.map((c) => ({
    id: c.id,
    que: c.que,
    porFront: Object.fromEntries(arboles.map((a) => [a.nombre, c.detecta(a.sf)])),
  }));
}
