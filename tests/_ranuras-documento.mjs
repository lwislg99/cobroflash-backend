// tests/_ranuras-documento.mjs — SCRUM-600 (DOC-10) · LAS RANURAS DE TEXTO DEL DOCUMENTO.
//
// Deriva del codigo QUE RANURAS DE MICROCOPY tendria que rellenar el fundador para que la
// factura pueda usar el front del presupuesto. Puro: recibe la fuente, devuelve las ranuras.
//
// ── 🔴 LA POBLACION, DECLARADA. Y son DOS, porque una es derivable y la otra NO ──
//
//   GRUPO A · DERIVADO ENTERO. Literal de cadena que (1) esta en una posicion que LLEGA A LA
//             PANTALLA y (2) NOMBRA EL DOCUMENTO — o sea, su texto contiene la raiz
//             `presupuest`. Ese es el criterio, y es el unico que una maquina puede aplicar
//             sin adivinar: un texto que dice «presupuesto» no puede salir tal cual en una
//             factura.
//
//   GRUPO B · NO DERIVABLE. Ranuras que dependen del tipo de documento SIN nombrarlo. El caso
//             de calibracion es «Valido hasta»: no dice «presupuesto» en ninguna parte y aun
//             asi es el ejemplo canonico de concepto distinto (caduca la OFERTA vs cuando hay
//             que PAGAR). Ninguna maquina saca eso de la cadena.
//             🔴 NO se mezclan. Una lista de 25 con una inventada dentro vale menos que una de
//             24 con el hueco declarado — y el grupo B es el hueco, escrito a mano y marcado.
//
// ── QUE CUENTA COMO «LLEGA A LA PANTALLA» ────────────────────────────────────
// Se enumera aqui, con su via, para que el fundador pueda discutir la frontera en vez de
// tener que fiarse de ella. Los COMENTARIOS quedan fuera POR CONSTRUCCION: no son nodos de
// literal, asi que no hace falta ninguna lista de excepciones (la leccion de SCRUM-402/R5).
//
//   textContent · innerHTML · placeholder · title · setAttribute(aria-label|title|placeholder)
//   setAlert(tipo, TEXTO) · showToast(TEXTO) · new Error(TEXTO)  ← este llega por el `catch`
//   download                                                     ← nombre del fichero que baja
//
// `new Error` y `download` van MARCADOS con su via y no escondidos: los dos se ven, pero no se
// ven igual que un rotulo, y esa diferencia la decide quien escribe el texto, no este censo.
import ts from 'typescript';

function recorrer(nodo, fn) { fn(nodo); nodo.forEachChild((h) => recorrer(h, fn)); }

const RAIZ_DOCUMENTO = 'presupuest';

/** Nombre de la funcion llamada, sea `f(...)` o `x.f(...)`. */
function nombreLlamada(n) {
  if (!ts.isCallExpression(n)) return null;
  const c = n.expression;
  if (ts.isIdentifier(c)) return c.text;
  if (ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.name)) return c.name.text;
  return null;
}

const PROPIEDADES_VISIBLES = ['textContent', 'innerHTML', 'placeholder', 'title', 'download'];
const ATRIBUTOS_VISIBLES = ['aria-label', 'title', 'placeholder'];

/**
 * 🔴 UN ROTULO QUE PASA POR UNA FUNCION SIGUE SIENDO UN ROTULO.
 *
 * Se descubrio midiendo: la primera version de este censo daba 23 ranuras y se le escapaba
 * `cabeceraModal({ titulo: 'Presupuesto #N generado' })`, porque el texto no se asigna a
 * `textContent` sino que viaja como propiedad de un objeto hasta el constructor compartido.
 * Un censo que no sigue la envoltura no dice «hay una ranura envuelta»: dice un numero MAS
 * PEQUENO, que es la forma en que un censo miente sin fallar. Misma leccion que
 * `_orden-pintado-presupuesto.mjs` dejo escrita para los titulos de bloque.
 *
 * Se enumeran las envolturas CONOCIDAS con la posicion del texto dentro de cada una. No es una
 * heuristica generica —«cualquier funcion de un argumento»— porque eso metaria en el censo
 * `Number(x)` y medio fichero.
 */
const ENVOLTURAS = {
  cabeceraModal: { tipo: 'propiedades', claves: ['titulo', 'etiquetaCierre'] },
  createField: { tipo: 'argumento', indice: 0 },
  createFieldSelect: { tipo: 'argumento', indice: 0 },
};

/**
 * El TEXTO de un nodo que puede ser cadena o plantilla.
 *
 * Una plantilla se devuelve con sus huecos EN CRUDO (`Presupuesto #${displayNum}`), no
 * resueltos: el hueco es un dato y el resto es microcopy, y quien redacta necesita ver los dos.
 * Devuelve `null` si no es texto — asi el censo no confunde «no es una cadena» con «cadena vacia».
 */
function textoDe(n, sf) {
  if (!n) return null;
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (ts.isTemplateExpression(n)) return n.getText(sf).slice(1, -1);
  return null;
}

/**
 * Todas las ranuras VISIBLES de una fuente, con su via y su linea.
 * No filtra por documento: eso lo hace `ranurasDelDocumento`, para que el suelo pueda
 * comprobar que el escaner ve MUCHAS y no solo las que interesan.
 */
export function extraerRanurasVisibles(fuente, ruta) {
  const sf = ts.createSourceFile(ruta, fuente, ts.ScriptTarget.Latest, true);
  const nLinea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const fuera = [];

  /**
   * 🔴 LOS TEXTOS QUE PASAN POR UNA CONSTANTE TAMBIEN SON RANURAS.
   *
   * Segunda fuga medida de este censo: `resultBox.innerHTML = STATUS_EMPTY_HTML` no asigna un
   * literal sino un IDENTIFICADOR, asi que el vacio del panel de estado —que dice «presupuesto»
   * y se ve en pantalla— quedaba fuera de la lista. El fichero de la factura hace lo mismo con
   * `NF_ACCION_PRIMARIA` y `NF_TITULO_BLOQUE`, que es el idioma de la casa para el microcopy
   * aprobado. Un censo de microcopy que no siga las constantes mide justo al reves de como esta
   * escrito el codigo que quiere medir.
   *
   * Solo se resuelve la forma SEGURA: `const X = '<literal>'` declarada UNA vez. Si el nombre
   * se declara dos veces se descarta —el valor dependeria del ambito y esto no hace analisis de
   * alcance—, y descartar es lo correcto: mejor no ver una ranura que atribuirle un texto que no
   * es el suyo.
   */
  const constantes = new Map();
  const repetidas = new Set();
  recorrer(sf, (n) => {
    if (!ts.isVariableDeclaration(n) || !ts.isIdentifier(n.name) || !n.initializer) return;
    const t = textoDe(n.initializer, sf);
    if (t === null) return;
    if (constantes.has(n.name.text)) repetidas.add(n.name.text);
    else constantes.set(n.name.text, t);
  });
  for (const r of repetidas) constantes.delete(r);

  const anotar = (nodo, via) => {
    let texto = textoDe(nodo, sf);
    let sufijo = '';
    if (texto === null && nodo && ts.isIdentifier(nodo) && constantes.has(nodo.text)) {
      texto = constantes.get(nodo.text);
      sufijo = ` [const ${nodo.text}]`;
    }
    if (texto === null && nodo && ts.isPropertyAccessExpression(nodo)) return; // NF_TITULO_BLOQUE.cliente: fuera, declarado
    if (texto === null || texto.trim() === '') return;
    fuera.push({ linea: nLinea(nodo), via: via + sufijo, texto });
  };

  recorrer(sf, (n) => {
    // x.textContent = '…' · x.innerHTML = `…`
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isPropertyAccessExpression(n.left) && ts.isIdentifier(n.left.name)
        && PROPIEDADES_VISIBLES.includes(n.left.name.text)) {
      anotar(n.right, n.left.name.text);
      return;
    }
    // Object.assign(…, { textContent: '…' }) y cualquier literal con esas claves
    if (ts.isPropertyAssignment(n) && n.name && ts.isIdentifier(n.name)
        && PROPIEDADES_VISIBLES.includes(n.name.text)) {
      anotar(n.initializer, n.name.text);
      return;
    }
    if (!ts.isCallExpression(n)) return;
    const llamada = nombreLlamada(n);
    // x.setAttribute('aria-label', '…')
    if (llamada === 'setAttribute' && n.arguments.length === 2) {
      const attr = textoDe(n.arguments[0], sf);
      if (attr && ATRIBUTOS_VISIBLES.includes(attr)) anotar(n.arguments[1], attr);
      return;
    }
    // setAlert(tipo, TEXTO) — el segundo argumento es el que se pinta
    if (llamada === 'setAlert' && n.arguments.length >= 2) { anotar(n.arguments[1], 'setAlert'); return; }
    if (llamada === 'showToast' && n.arguments.length >= 1) { anotar(n.arguments[0], 'showToast'); return; }
    // Los rotulos que viajan ENVUELTOS hasta un constructor compartido.
    const env = ENVOLTURAS[llamada];
    if (!env) return;
    if (env.tipo === 'argumento') { anotar(n.arguments[env.indice], `${llamada}()`); return; }
    const obj = n.arguments[0];
    if (!obj || !ts.isObjectLiteralExpression(obj)) return;
    for (const p of obj.properties) {
      if (!ts.isPropertyAssignment(p) || !p.name || !ts.isIdentifier(p.name)) continue;
      if (env.claves.includes(p.name.text)) anotar(p.initializer, `${llamada}(${p.name.text})`);
    }
  });

  // `new Error(...)` es NewExpression, no CallExpression: se recorre aparte para no enredar
  // la rama de arriba con un caso que tiene otra forma.
  recorrer(sf, (n) => {
    if (!ts.isNewExpression(n) || !n.expression || !ts.isIdentifier(n.expression)) return;
    if (n.expression.text !== 'Error' || !n.arguments || !n.arguments.length) return;
    const texto = textoDe(n.arguments[0], sf);
    if (texto === null || texto.trim() === '') return;
    fuera.push({ linea: nLinea(n.arguments[0]), via: 'new Error', texto });
  });

  return fuera.sort((a, b) => a.linea - b.linea || a.via.localeCompare(b.via));
}

/**
 * GRUPO A · las ranuras visibles que NOMBRAN el documento.
 *
 * ⚠️ Aqui SI se mira dentro de la cadena, y hay que decir por que no contradice la restriccion
 * de «verificar textos con === y nunca con includes()»: eso prohibe COMPROBAR que un texto es el
 * que debe ser mirando si lo contiene. Esto no comprueba nada — CLASIFICA. Que el texto sea
 * exactamente el que aqui se lista se comprueba aparte, con `===`, en el test.
 */
export function ranurasDelDocumento(fuente, ruta) {
  return extraerRanurasVisibles(fuente, ruta)
    .filter((r) => r.texto.toLowerCase().includes(RAIZ_DOCUMENTO));
}

/**
 * GRUPO B · ESCRITO A MANO Y MARCADO COMO TAL. Ranuras que dependen del tipo de documento SIN
 * nombrarlo, asi que ningun criterio de cadena las encuentra.
 *
 * `ancla` es la LINEA EXACTA del fichero donde vive la ranura: sirve para que el test compruebe
 * con `===` que sigue estando donde esto dice. Una lista a mano que ademas se desincroniza del
 * codigo seria lo peor de los dos mundos.
 */
export const RANURAS_NO_DERIVABLES = [
  {
    id: 'B1',
    fichero: 'public/dashboard/js/quotesView.js',
    ancla: '    validLabel.textContent = "Válido hasta";',
    texto: 'Válido hasta',
    porQueNoSeDeriva: 'no nombra el documento: ninguna busqueda por la raiz «presupuest» la encuentra',
  },
];

// ⚠️ SU NOTA NO SE ANOTA AQUI, Y ES A PROPOSITO. La explicacion que va debajo de «Valido hasta»
// —«Pasada esta fecha el presupuesto caduca solo…»— SI dice «presupuesto», asi que el criterio
// derivado YA la encuentra y esta en el grupo A. Repetirla aqui la contaria DOS VECES y el
// numero total dejaria de ser cierto. El grupo B es para lo que el criterio NO ve, no para lo
// que conviene tener a mano.
