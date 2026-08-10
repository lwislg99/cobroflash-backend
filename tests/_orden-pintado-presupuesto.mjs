// tests/_orden-pintado-presupuesto.mjs — SCRUM-286 (B3): deriva el ORDEN EN QUE SE PINTAN los
// controles de «Nuevo presupuesto». Puro: recibe la fuente, devuelve el árbol ordenado.
//
// ── 🔴 POR QUÉ EXISTE ESTE SEGUNDO CENSO ─────────────────────────────────────
// El censo de `_censo-nuevo-presupuesto.mjs` mide OTRA POBLACIÓN: lo que se ENVÍA. Son dos
// preguntas distintas y confundirlas es el error que este bloque lleva tres tickets cazando:
//
//   · ENVÍO   → «¿qué campos viajan al servidor?»  (el fallo mudo del reordenado)
//   · PINTADO → «¿en qué ORDEN los ve el pro?»     (el defecto que B3 dice arreglar)
//
// El ticket afirma un orden («empieza por las condiciones de pago, el cliente viene después»)
// que venía de MIRAR UNA PANTALLA, no el código. Una afirmación de orden no medida no se puede
// usar para reordenar: no se reordena bien lo que no se ha medido en qué orden está.
//
//   FICHERO:  public/dashboard/js/quotesView.js
//   FRONTERA: el grafo de `appendChild` que cuelga de la tarjeta izquierda del formulario.
//   MIDE:     el orden de pintado (orden de inserción en el DOM).
//
// ── EL SUPUESTO QUE HACE VÁLIDA ESTA MEDICIÓN, Y SU SUELO ────────────────────
// Aquí el orden del código ES el orden del DOM porque la construcción es recta: sólo
// `appendChild`. En cuanto aparezca un `insertBefore` / `prepend` / `insertAdjacentElement`
// sobre uno de estos contenedores, ese supuesto deja de valer y el orden que yo derive sería
// FALSO. No lo doy por bueno: lo compruebo, y si aparece, FALLA. Un censo que sigue reportando
// cuando su propio modelo se ha roto es peor que no tener censo.
//
// (Este fichero tiene `insertBefore` de verdad — en la modal de compartir, ~L239/L284. Está
// fuera del grafo del formulario, y ese es justo el caso que distingue «mi modelo aguanta»
// de «no supe mirar».)
import ts from 'typescript';

function recorrer(nodo, fn) { fn(nodo); nodo.forEachChild((h) => recorrer(h, fn)); }

/** Identificador base de una expresión: `fieldCustomer.wrapper` → `fieldCustomer`. */
function baseDe(expr) {
  let n = expr;
  while (n && ts.isPropertyAccessExpression(n)) n = n.expression;
  return n && ts.isIdentifier(n) ? n.text : null;
}

const textoLiteral = (n) => (n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null);

/**
 * `f("texto")` → `{ llamada:'f', texto:'texto' }`.
 *
 * Un rótulo que pasa por una función SIGUE SIENDO un rótulo. Si no se siguiera, el censo diría
 * «bloque sin título» justo cuando el título existe pero va envuelto — y «no tiene título» y «no
 * supe mirar» volverían a ser el mismo número. Es genérico (cualquier envoltura de un argumento),
 * no reconoce una función concreta: quién envuelve lo comprueba el guard de microcopy, no esto.
 */
function envoltura(n) {
  if (!n || !ts.isCallExpression(n) || n.arguments.length !== 1) return null;
  const texto = textoLiteral(n.arguments[0]);
  if (texto === null) return null;
  const c = n.expression;
  const llamada = ts.isIdentifier(c) ? c.text
    : (ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.name) ? c.name.text : null);
  return llamada ? { llamada, texto } : null;
}

/** Texto visible de un `innerHTML`: lo de dentro de la primera etiqueta. */
function textoDeHtml(html) {
  if (typeof html !== 'string') return null;
  const m = html.match(/<[^>]*>([^<]+)</);
  return m ? m[1].trim() : null;
}

export function derivarOrdenDePintado(fuente, ruta = 'quotesView.js') {
  const sf = ts.createSourceFile(ruta, fuente, ts.ScriptTarget.Latest, true);
  const nLinea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  // ── PASO 1 · qué es cada variable ──────────────────────────────────────────
  const nodos = new Map();      // nombre → { nombre, linea, etiqueta, nombreCampo, clase, tipo }
  const duplicados = new Set(); // mismo nombre declarado dos veces: el grafo por nombre mentiría

  recorrer(sf, (n) => {
    if (!ts.isVariableDeclaration(n) || !ts.isIdentifier(n.name) || !n.initializer) return;
    const nombre = n.name.text;
    const ini = n.initializer;

    let info = null;
    if (ts.isCallExpression(ini)) {
      const c = ini.expression;
      const llamada = ts.isIdentifier(c) ? c.text
        : (ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.name) ? c.name.text : null);

      if (llamada === 'createElement') {
        info = { tipo: 'elemento', etiquetaHtml: textoLiteral(ini.arguments[0]) };
      } else if (llamada === 'createField' || llamada === 'createFieldSelect') {
        // El helper de campos: primer argumento = la etiqueta que LEE el pro, segundo = el
        // atributo `name`. Es la vía por la que un control se ata a lo que luego viaja.
        info = {
          tipo: 'campo',
          etiqueta: textoLiteral(ini.arguments[0]),
          nombreCampo: textoLiteral(ini.arguments[1]),
          etiquetaHtml: llamada === 'createFieldSelect' ? 'select' : 'input',
        };
      }
    }
    if (!info) return;
    if (nodos.has(nombre)) duplicados.add(nombre);
    nodos.set(nombre, {
      nombre, linea: nLinea(n), clase: null, etiqueta: null, etiquetaViaLlamada: null,
      nombreCampo: null, ...info,
    });
  });

  // ── PASO 2 · className / textContent / innerHTML de cada variable ──────────
  recorrer(sf, (n) => {
    if (!ts.isBinaryExpression(n) || n.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return;
    if (!ts.isPropertyAccessExpression(n.left) || !ts.isIdentifier(n.left.expression)) return;
    const destino = nodos.get(n.left.expression.text);
    if (!destino) return;
    const prop = n.left.name.text;
    const valor = textoLiteral(n.right);
    if (prop === 'className' && valor) destino.clase = valor;
    if (prop === 'textContent' && !destino.etiqueta) {
      if (valor) destino.etiqueta = valor;
      else {
        const env = envoltura(n.right);
        if (env) { destino.etiqueta = env.texto; destino.etiquetaViaLlamada = env.llamada; }
      }
    }
    if (prop === 'innerHTML' && valor && !destino.etiqueta) destino.etiqueta = textoDeHtml(valor);
  });

  // ── PASO 3 · el grafo de inserción, en orden de código ─────────────────────
  // 🔴 ESTÁTICO vs EN EJECUCIÓN. No todo `appendChild` pinta al abrir la pantalla: los que
  // viven dentro de una función anidada (`addLine`, `addStage`, `moverLinea`) corren cuando el
  // pro actúa. Sólo el ESQUELETO estático tiene «orden de pintado» — mezclarlos daría un orden
  // que nadie ve nunca. La profundidad de función lo separa sin enumerar nombres a mano.
  const profundidadDeFuncion = (n) => {
    let d = 0;
    for (let p = n.parent; p; p = p.parent) {
      if (ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isArrowFunction(p) ||
          ts.isMethodDeclaration(p)) d++;
    }
    return d;
  };

  const hijos = new Map();      // padre → [{ nombre, linea }] — sólo esqueleto estático
  const enEjecucion = [];       // los appendChild de funciones anidadas, declarados aparte
  const reordenadores = [];     // insertBefore / prepend / … : rompen el supuesto de orden
  let inserciones = 0;

  recorrer(sf, (n) => {
    if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) return;
    const metodo = n.expression.name.text;
    const padre = baseDe(n.expression.expression);
    if (!padre) return;
    const estatico = profundidadDeFuncion(n) <= 1;

    if (metodo === 'appendChild') {
      inserciones++;
      const hijo = baseDe(n.arguments[0]);
      if (!hijo) return;
      if (!estatico) { enEjecucion.push({ padre, hijo, linea: nLinea(n) }); return; }
      if (!hijos.has(padre)) hijos.set(padre, []);
      hijos.get(padre).push({ nombre: hijo, linea: nLinea(n) });
    } else if (metodo === 'insertBefore' || metodo === 'prepend' || metodo === 'insertAdjacentElement') {
      reordenadores.push({ padre, metodo, linea: nLinea(n), estatico });
    }
  });

  // ── PASO 4 · la RAÍZ, derivada — no escrita a mano ─────────────────────────
  // Los bloques son las variables cuya clase ES `quote-block` (token exacto: `quote-block-title`
  // es el H3 del título, no un bloque — si colara, el «padre común» saldría doble y la raíz nula).
  const esBloqueDeClase = (c) => !!c && c.split(/\s+/).includes('quote-block');
  const bloques = [...nodos.values()].filter((v) => esBloqueDeClase(v.clase)).map((v) => v.nombre);
  const padresDeBloque = new Set();
  for (const [padre, lista] of hijos) {
    if (lista.some((h) => bloques.includes(h.nombre))) padresDeBloque.add(padre);
  }
  const raiz = padresDeBloque.size === 1 ? [...padresDeBloque][0] : null;

  // ── PASO 5 · el árbol, en orden ────────────────────────────────────────────
  const visitados = new Set();
  function arbol(nombre, profundidad = 0) {
    if (visitados.has(nombre) || profundidad > 6) return [];
    visitados.add(nombre);
    return (hijos.get(nombre) || []).map((h) => {
      const info = nodos.get(h.nombre) || { nombre: h.nombre, tipo: 'desconocido' };
      return {
        nombre: h.nombre,
        linea: h.linea,
        lineaDeclaracion: info.linea ?? null,
        etiqueta: info.etiqueta ?? null,
        etiquetaViaLlamada: info.etiquetaViaLlamada ?? null,
        nombreCampo: info.nombreCampo ?? null,
        clase: info.clase ?? null,
        tipo: info.tipo,
        esBloque: bloques.includes(h.nombre),
        hijos: arbol(h.nombre, profundidad + 1),
      };
    });
  }
  const orden = raiz ? arbol(raiz) : [];

  // El título de cada bloque es su H3 `quote-block-title`, no una cadena escrita aquí.
  (function titular(ns) {
    for (const x of ns) {
      if (x.esBloque) {
        const t = x.hijos.find((h) => h.clase && h.clase.split(/\s+/).includes('quote-block-title'));
        x.titulo = t ? t.etiqueta : null;
        x.tituloViaLlamada = t ? t.etiquetaViaLlamada : null;
      }
      titular(x.hijos);
    }
  })(orden);

  // ── Los contenedores SOBRE LOS QUE AFIRMO UN ORDEN ─────────────────────────
  // Sólo estos invalidan la medición si alguien los reordena: la raíz, los bloques y cualquier
  // nodo del que yo emita orden estático. `linesBody` NO está: sus filas las crea el pro en
  // ejecución y `moverLinea` las reordena a propósito — eso no contradice nada de lo que digo.
  const conOrdenDeclarado = new Set([raiz, ...bloques]);
  (function marcar(ns) {
    for (const x of ns) { if (x.hijos.length) conOrdenDeclarado.add(x.nombre); marcar(x.hijos); }
  })(orden);

  return {
    raiz,
    bloques,
    orden,
    duplicados: [...duplicados].filter((d) => conOrdenDeclarado.has(d)),
    reordenadoresEnElFormulario: reordenadores.filter((r) => r.estatico && conOrdenDeclarado.has(r.padre)),
    reordenadoresFuera: reordenadores.filter((r) => !(r.estatico && conOrdenDeclarado.has(r.padre))),
    enEjecucion,
    inserciones,
    poblacion: {
      fichero: ruta,
      frontera: `grafo de appendChild que cuelga de \`${raiz}\``,
      mide: 'el ORDEN en que se pintan los controles (no lo que se envía)',
      excluido: 'la modal de compartir y la tarjeta de vista previa: no son el formulario',
    },
  };
}

/** Mapa `nombre de nodo → nombre del bloque que lo contiene`, a cualquier profundidad. */
export function mapaDeBloques(arbolDeOrden) {
  const mapa = new Map();
  (function bajar(ns, bloque) {
    for (const n of ns) {
      const actual = n.esBloque ? n.nombre : bloque;
      if (actual && !n.esBloque) mapa.set(n.nombre, actual);
      bajar(n.hijos, actual);
    }
  })(arbolDeOrden, null);
  return mapa;
}

/** Aplana el árbol a una lista ordenada de controles con su bloque contenedor. */
export function controlesEnOrden(arbolDeOrden) {
  const salida = [];
  function bajar(ns, bloque) {
    for (const n of ns) {
      const bloqueActual = n.esBloque ? n : bloque;
      const esControl = n.tipo === 'campo'
        || (n.clase && /\bfield\b/.test(n.clase))
        || (n.clase && /\bpay-methods-row\b/.test(n.clase));
      if (esControl && bloqueActual) {
        salida.push({
          bloque: bloqueActual.nombre,
          tituloDelBloque: bloqueActual.titulo ?? null,
          nombre: n.nombre,
          linea: n.linea,
          etiqueta: n.etiqueta,
          nombreCampo: n.nombreCampo,
        });
      }
      bajar(n.hijos, bloqueActual);
    }
  }
  bajar(arbolDeOrden, null);
  return salida;
}
