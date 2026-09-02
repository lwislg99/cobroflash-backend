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
  // 🔴 F9 SE MUDA (SCRUM-598, DOC-08). NO se retira: cambia de domicilio, y la dirección nueva
  // está al final de este mismo fichero — `F9_EN_EL_CATALOGO` / `faltaEnF9`. Esto ES el cambio
  // de máster que este censo exige, y la mudanza es la mitad que lo hace legítimo: una retirada
  // sin sustituto convierte una regla innegociable en una costumbre.
  //
  // F9 decía «coste y margen existen EN EL PRODUCTO (markup por línea)». La capacidad NO ha
  // desaparecido: desde CAT-01 (SCRUM-609) el coste y el margen viven en el CATÁLOGO, con su
  // propio campo y su propia aritmética (`margenCatalogo.js`). Lo que se retira es el margen del
  // DOCUMENTO, que es otra cosa: información del profesional viviendo en el papel que le enseña
  // a su cliente.
  //
  // Decisión del fundador, 24-ago-2026. Registrada en `docs/master/SCRUM-598.md`.
  //
  // Y el detector de F9 anclaba en `markupTd.appendChild(markupInput)` DENTRO de `quotesView.js`
  // — o sea, medía la capacidad por su dirección vieja. Este censo compara los dos fronts del
  // DOCUMENTO; en el documento el margen ya no vive, así que AQUÍ no hay nada que vigilar. Se
  // vigila en su casa nueva, y se vigila: `scrum600` sigue exigiendo los OCHO, siete desde
  // `LOS_OCHO` y F9 desde `F9_EN_EL_CATALOGO`.
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
  // (F9 no está aquí porque SE MUDÓ, no porque se retirara: vive en `F9_EN_EL_CATALOGO`, al
  //  final de este fichero. `LOS_OCHO` ancla por LÍNEA dentro de UN fichero, y la capacidad de
  //  F9 ya no cabe en esa forma — está repartida entre los dos formularios del catálogo, lo que
  //  se envía al servidor y la aritmética. Por eso su detector es propio y devuelve QUÉ falta.)
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

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 F9 · LA MUDANZA. Una regla innegociable no se retira: se le pone la DIRECCIÓN NUEVA.
//
// F9 dice «coste y margen existen EN EL PRODUCTO». Su detector vivía en `LOS_OCHO`, anclado a
// `markupTd.appendChild(markupInput)` DENTRO de `quotesView.js`: medía la CAPACIDAD por la
// DIRECCIÓN que tenía el día que se escribió. Y la dirección caducó — con CAT-01 (SCRUM-609,
// decisión del fundador del 24-ago-2026) el coste y el margen se mudaron al CATÁLOGO, y con
// DOC-08 (SCRUM-598) el margen salió del documento.
//
// 🔴 RETIRAR EL DETECTOR SIN SUSTITUTO CONVIERTE UNA REGLA EN UNA COSTUMBRE. Ese detector ERA lo
// que hacía innegociable a F9. Sin él, mañana alguien quita el margen DEL CATÁLOGO y no salta
// nada, y no lo sabríamos hasta que se quejara un profesional. Así que F9 no sale de la red:
// cambia de domicilio, y éstas son las señas nuevas.
//
// POR IDENTIDAD, NO POR POSICIÓN — que es justo lo que caducó la vez anterior. Un campo se
// reconoce por su `name`, que es como lo busca el propio código y como viaja al servidor.
// Reordenar el formulario, renombrar la variable que lo sostiene o mover el bloque NO hacen caer
// esto. Quitar el campo, SÍ.
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * El HTML que PINTA un fichero: los literales que se asignan a `.innerHTML`.
 *
 * Los dos formularios del catálogo se escriben así —no con `createElement`—, así que el censo A
 * de arriba no los ve: por eso este detector trae su propia población y no reusa aquél.
 * Un comentario de JS no es un literal, o sea que queda fuera POR CONSTRUCCIÓN — la misma razón
 * por la que el resto de este fichero mira el árbol y no la fuente.
 *
 * 🔴 Y LOS COMENTARIOS DE **HTML** SE QUITAN A MANO, porque el árbol NO protege de ésos: van
 * DENTRO del literal, así que para el AST siguen siendo texto pintado. MEDIDO: con el campo
 * «Coste» envuelto en `<!-- ... -->` el detector contestaba «no falta nada» mientras el
 * profesional no veía el campo por ninguna parte. Es el falso verde de SCRUM-515 con otra ropa.
 */
function htmlPintado(sf) {
  const bloques = [];
  recorrer(sf, (n) => {
    if (!ts.isBinaryExpression(n) || n.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return;
    if (!ts.isPropertyAccessExpression(n.left) || !ts.isIdentifier(n.left.name)) return;
    if (n.left.name.text !== 'innerHTML') return;
    const r = n.right;
    let texto = null;
    if (ts.isStringLiteral(r) || ts.isNoSubstitutionTemplateLiteral(r)) texto = r.text;
    else if (ts.isTemplateExpression(r)) {
      texto = r.head.text + r.templateSpans.map((s) => s.literal.text).join(' ');
    }
    if (texto !== null) bloques.push(texto.replace(/<!--[\s\S]*?-->/g, ' '));
  });
  return bloques;
}

/** Ese HTML pinta un control cuyo `name` es `clave`. La identidad del campo es su `name`. */
function pintaCampo(html, clave) {
  return new RegExp('<(?:input|select|textarea)\\b[^>]*\\bname="' + clave + '"').test(html);
}

/** Las claves de un objeto literal, como Set. */
function clavesDe(n) {
  return new Set(n.properties
    .map((p) => (p.name && (ts.isIdentifier(p.name) ? p.name.text
      : (ts.isStringLiteral(p.name) ? p.name.text : null))))
    .filter(Boolean));
}

/**
 * Los objetos de PRODUCTO del fichero: los que llevan `name` y `price` juntos.
 *
 * La población se define por la FORMA y no por la variable que los recibe (`payload`), porque
 * renombrar una variable no es perder una capacidad — y atarse al nombre sería repetir el error
 * que mudó a F9 de casa. Hoy son dos: el del alta y el de la edición.
 */
function objetosDeProducto(sf) {
  const vistos = [];
  recorrer(sf, (n) => {
    if (!ts.isObjectLiteralExpression(n)) return;
    const claves = clavesDe(n);
    if (claves.has('name') && claves.has('price')) vistos.push(claves);
  });
  return vistos;
}

/** Los dos formularios del catálogo, cada uno reconocido por SU ACCIÓN: uno crea, el otro guarda. */
const FORMULARIOS_DEL_CATALOGO = Object.freeze({
  ALTA: 'id="pf-create-product"',
  'EDICIÓN': 'id="pf-edit-save"',
});

/** Los dos campos que F9 declara innegociables, con el rótulo que lee el profesional. */
const CAMPOS_DE_F9 = Object.freeze({ cost: 'Coste', margen: 'Margen %' });

export const F9_EN_EL_CATALOGO = Object.freeze({
  id: 'F9',
  que: 'COSTE Y MARGEN EXISTEN EN EL PRODUCTO — en el CATÁLOGO, que es su casa desde CAT-01',
  ficheros: Object.freeze({
    vista: 'public/dashboard/js/productsView.js',
    aritmetica: 'public/dashboard/js/margenCatalogo.js',
  }),
  desde: 'SCRUM-598 (DOC-08) · el domicilio anterior era quotesView.js',
});

/**
 * QUÉ LE FALTA HOY A F9. Devuelve la lista de lo que NO está, CON NOMBRE: un rojo que dijera
 * «se ha perdido F9» sin decir qué mitad no serviría dentro de tres meses.
 *
 * 🔴 SUELO: si el escáner no ve NADA —ni un bloque de HTML, ni un objeto de producto— no
 * contesta «falta todo»: se declara CIEGO y revienta. Un cero de un instrumento roto se lee
 * igual que un catálogo sin campos, y son la noticia contraria.
 */
export function faltaEnF9({ vista, aritmetica }) {
  const sfVista = ts.createSourceFile('productsView.js', vista, ts.ScriptTarget.Latest, true);
  const sfArit = ts.createSourceFile('margenCatalogo.js', aritmetica, ts.ScriptTarget.Latest, true);

  const bloques = htmlPintado(sfVista);
  if (bloques.length === 0) {
    throw new Error('🔴 ESCANER CIEGO sobre el catálogo: no veo NI UN bloque de HTML en '
      + '`productsView.js`. No es que falten los campos: es que no estoy mirando.');
  }
  const productos = objetosDeProducto(sfVista);
  if (productos.length === 0) {
    throw new Error('🔴 ESCANER CIEGO sobre el catálogo: no veo NI UN objeto de producto '
      + '(`name` + `price`) en `productsView.js`. Sin población no hay veredicto.');
  }

  const falta = [];

  // ① y ② · los dos campos, en los DOS formularios. Se miran por separado a propósito: el alta y
  // la edición ya divergieron una vez en este mismo fichero (el IVA salió de uno antes que del
  // otro), así que «está en el catálogo» sin decir en cuál de los dos no es una respuesta.
  for (const [forma, sena] of Object.entries(FORMULARIOS_DEL_CATALOGO)) {
    const html = bloques.find((b) => b.includes(sena));
    if (html === undefined) {
      falta.push('el formulario de ' + forma + ' del catálogo (no encuentro su acción `' + sena + '`)');
      continue; // sin formulario, acusar de sus dos campos sería un rojo que no dice dónde mirar
    }
    for (const [clave, rotulo] of Object.entries(CAMPOS_DE_F9)) {
      if (!pintaCampo(html, clave)) {
        falta.push('el campo «' + rotulo + '» (name="' + clave + '") en el formulario de '
          + forma + ' del catálogo');
      }
    }
  }

  // ③ · que el campo se PINTE no basta: el coste tiene que VIAJAR. Es la lección de F8, que
  // empezó dando verde el día que la marca dejaba de llegar al servidor.
  const conCoste = productos.filter((c) => c.has('cost')).length;
  if (conCoste < productos.length) {
    falta.push('el COSTE en lo que se ENVÍA al servidor: de ' + productos.length + ' objetos de '
      + 'producto sólo ' + conCoste + ' llevan `cost`, así que hay un formulario que enseña el '
      + 'campo y no lo manda');
  }

  // ④ · el margen NO se guarda: se DERIVA (CAT-01). Si el cableado desaparece, el campo sigue
  // pintado y vacío para siempre — que es la peor forma de no funcionar.
  if (!hayLlamada(sfVista, { nombre: 'autocompletar' })) {
    falta.push('el cableado coste ↔ margen ↔ precio (`margenCatalogo.autocompletar`): sin él el '
      + 'campo del margen se queda pintado y muerto mientras se teclea');
  }
  if (!hayLlamada(sfVista, { nombre: 'margenDesde' })) {
    falta.push('el margen DERIVADO al abrir un producto (`margenCatalogo.margenDesde`): sin él '
      + 'la edición enseñaría el campo vacío aunque el producto tenga coste y precio');
  }

  // ⑤ · y la aritmética, que es lo que hace que el margen exista sin guardarse.
  for (const fn of ['margenDesde', 'precioDesde', 'autocompletar']) {
    if (!hayPropiedad(sfArit, fn)) falta.push('`margenCatalogo.' + fn + '`, la aritmética del margen');
  }

  return falta;
}

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
