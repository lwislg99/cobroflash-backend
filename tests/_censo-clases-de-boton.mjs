// tests/_censo-clases-de-boton.mjs — SCRUM-352: censo DERIVADO de cada sitio del front que
// aplica una clase de botón, y de si ese sitio escribe además la clase base `btn`.
// Puro: recibe fuentes, devuelve el censo. Sin BD, sin red, sin navegador.
//
// ── QUÉ DECIDE ESTE CENSO ────────────────────────────────────────────────────
// El bump táctil de móvil vive en `@media (max-width:768px) { .btn { min-height: 44px } }`, y
// solo alcanza a `.btn`. Llevarlo a las variantes sueltas (`.btn-primary`, `.btn-secondary`…)
// hace crecer 8 px, en móvil, A TODO SITIO QUE HOY ESCRIBA LA VARIANTE SIN LA BASE. Ese es el
// alcance del cambio, y no se puede estimar leyendo tres ficheros: hay que contarlos.
//
// Un cero de «no hay ninguno» y un cero de «no supe mirar» son el mismo número y significan lo
// contrario, así que este censo trae DOS suelos: uno por FORMA de escritura (si un detector deja
// de reconocer la suya, rojo) y uno de COBERTURA (si un fichero nombra una clase de botón y el
// censo no sacó de él ni un conjunto, rojo).
//
// ── LAS CUATRO FORMAS DE APLICAR CLASES EN ESTE REPO, medidas sobre el árbol ──
//   1. `atributo`   — HTML literal: `class="btn-primary btn-sm"`, dentro de template literals
//                     o de los .html sueltos.
//   2. `className`  — `el.className = 'btn-secondary btn-sm'`.
//   3. `helper`     — el `createElement(tag, clase, texto)` propio de las vistas.
//   4. `classList`  — `el.classList.add('btn-primary')` SOBRE un elemento que ya tenía clases:
//                     el conjunto final es la unión, así que hay que resolver de dónde viene.
//
// Si mañana aparece una QUINTA forma, este analizador no la verá — para eso está el suelo de
// cobertura.
import ts from 'typescript';

/** Recorre un subárbol aplicando `fn`. */
function recorrer(nodo, fn) {
  fn(nodo);
  nodo.forEachChild((h) => recorrer(h, fn));
}

const esLiteralTexto = (n) =>
  !!n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n));

export const MARCA_DINAMICA = '⟪dinámico⟫';

/** Número de línea (1-based) de una posición absoluta del texto. */
function lineaDe(texto, pos) {
  let n = 1;
  for (let i = 0; i < pos && i < texto.length; i++) if (texto[i] === '\n') n++;
  return n;
}

/** Parte un valor de atributo `class` en clases. */
const partirClases = (s) => s.trim().split(/\s+/).filter(Boolean);

/**
 * Resuelve una expresión a TODOS los conjuntos de clases que puede producir.
 *
 * Un ternario no es un conjunto: son dos, y cada rama acaba en el DOM en algún caso real. La
 * primera versión de este analizador los marcaba «dinámico» y los descartaba enteros — el suelo
 * de cobertura lo cazó con `albaranDetailView.js:256`, donde las TRES ramas son botones. Cuando
 * el analizador y el fichero discrepan, el que está mal es el analizador.
 */
function conjuntosPosibles(n) {
  if (!n) return [[MARCA_DINAMICA]];
  if (esLiteralTexto(n)) return [partirClases(n.text)];
  if (ts.isParenthesizedExpression(n)) return conjuntosPosibles(n.expression);
  if (ts.isConditionalExpression(n)) {
    return [...conjuntosPosibles(n.whenTrue), ...conjuntosPosibles(n.whenFalse)];
  }
  // `'btn ' + variante` y plantillas con hueco: se conserva lo literal y se marca el resto.
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const izq = conjuntosPosibles(n.left);
    const der = conjuntosPosibles(n.right);
    const out = [];
    for (const a of izq) for (const b of der) out.push([...new Set([...a, ...b])]);
    return out;
  }
  if (ts.isTemplateExpression(n)) {
    const fijas = partirClases(
      n.head.text + n.templateSpans.map((s) => ' ' + s.literal.text).join(' '),
    );
    return [[...fijas, MARCA_DINAMICA]];
  }
  return [[MARCA_DINAMICA]];
}

/**
 * FORMA 1 — `class="…"` literal.
 *
 * Se escanea el TEXTO del fichero, no el AST: el HTML del dashboard vive dentro de template
 * literals, así que lo que acaba en el DOM es exactamente esta cadena. Un `class="${…}"` no se
 * puede resolver aquí y se marca dinámico en vez de inventárselo.
 */
function conjuntosPorAtributo(fichero, texto) {
  const out = [];
  const re = /class\s*=\s*(["'])([\s\S]*?)\1/g;
  let m;
  while ((m = re.exec(texto)) !== null) {
    const valor = m[2];
    const dinamico = valor.includes('${');
    out.push({
      fichero,
      linea: lineaDe(texto, m.index),
      forma: 'atributo',
      clases: dinamico ? [...partirClases(valor.replace(/\$\{[^}]*\}/g, ' ')), MARCA_DINAMICA]
                       : partirClases(valor),
    });
  }
  return out;
}

/** FORMAS 2, 3 y 4 — sobre el AST, que es donde se distinguen sin adivinar. */
function conjuntosPorJs(fichero, texto) {
  const sf = ts.createSourceFile(fichero, texto, ts.ScriptTarget.Latest, true);
  const out = [];
  // `variable -> clases` de las asignaciones `.className = '…'`, para poder resolver
  // los `classList.add` que se apoyan en ellas.
  const claseDeVariable = new Map();

  recorrer(sf, (n) => {
    // 2 · el.className = '…'
    if (
      ts.isBinaryExpression(n) &&
      n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(n.left) &&
      n.left.name.text === 'className'
    ) {
      const sujeto = n.left.expression.getText(sf);
      const posibles = conjuntosPosibles(n.right);
      claseDeVariable.set(sujeto, posibles[0]);
      for (const clases of posibles) {
        out.push({
          fichero, linea: lineaDe(texto, n.getStart(sf)), forma: 'className', clases, sujeto,
          ramas: posibles.length > 1 ? posibles.length : undefined,
        });
      }
    }

    // 3 · createElement(tag, 'clases', texto) — el helper propio de las vistas
    if (
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      n.expression.text === 'createElement' &&
      n.arguments.length >= 2 &&
      esLiteralTexto(n.arguments[0])
    ) {
      for (const clases of conjuntosPosibles(n.arguments[1])) {
        out.push({ fichero, linea: lineaDe(texto, n.getStart(sf)), forma: 'helper', clases });
      }
    }

    // 4 · el.classList.add('…') — el conjunto final es la UNIÓN con lo que ya tuviera
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === 'add' &&
      ts.isPropertyAccessExpression(n.expression.expression) &&
      n.expression.expression.name.text === 'classList'
    ) {
      const sujeto = n.expression.expression.expression.getText(sf);
      const anadidas = n.arguments.map((a) => (esLiteralTexto(a) ? a.text : MARCA_DINAMICA));
      out.push({
        fichero, linea: lineaDe(texto, n.getStart(sf)), forma: 'classList',
        clases: anadidas, sujeto, esAdicion: true,
      });
    }
  });

  // Resolver las adiciones: unir con lo que la variable ya tenía, si se sabe.
  for (const c of out) {
    if (!c.esAdicion) continue;
    const previas = claseDeVariable.get(c.sujeto);
    c.clasesPrevias = previas ?? null;
    c.clases = previas ? [...new Set([...previas, ...c.clases])] : [...c.clases, MARCA_DINAMICA];
  }
  return out;
}

/** Lee los ficheros de front (js + html) bajo `public/`. */
export function fuentesDeFront(fs, path, raiz) {
  const dir = path.join(raiz, 'public');
  const fuentes = [];
  const bajar = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) bajar(p);
      else if (/\.(js|html)$/.test(e.name)) {
        fuentes.push({ ruta: path.relative(raiz, p).replace(/\\/g, '/'), texto: fs.readFileSync(p, 'utf8') });
      }
    }
  };
  bajar(dir);
  return fuentes;
}

/**
 * Censo: todos los conjuntos de clases que incluyen ALGUNA clase de botón, clasificados por si
 * escriben también la base `btn`.
 *
 * @param fuentes   [{ ruta, texto }]
 * @param clasesBoton  derivadas del CSS (no una lista escrita a mano)
 */
export function censarUsosDeBoton(fuentes, clasesBoton) {
  const esBoton = (c) => clasesBoton.includes(c);
  const conjuntos = [];

  for (const { ruta, texto } of fuentes) {
    const todos = [
      ...conjuntosPorAtributo(ruta, texto),
      ...(/\.js$/.test(ruta) ? conjuntosPorJs(ruta, texto) : []),
    ];
    for (const c of todos) {
      const variantes = c.clases.filter(esBoton);
      if (!variantes.length) continue;
      conjuntos.push({
        ...c,
        variantes,
        llevaBase: c.clases.includes('btn'),
        dinamico: c.clases.includes(MARCA_DINAMICA),
      });
    }
  }

  const sinBase = conjuntos.filter((c) => !c.llevaBase);
  return {
    conjuntos,
    sinBase,
    conBase: conjuntos.filter((c) => c.llevaBase),
    formas: [...new Set(conjuntos.map((c) => c.forma))].sort(),
    ficherosAfectados: [...new Set(sinBase.map((c) => c.fichero))].sort(),
  };
}

/**
 * SUELO DE COBERTURA — ficheros que NOMBRAN una clase de botón pero de los que el censo no sacó
 * ni un conjunto. Es el hueco por el que se cuela una quinta forma de escritura.
 */
export function ficherosNoCubiertos(fuentes, clasesBoton, censo) {
  const conConjuntos = new Set(censo.conjuntos.map((c) => c.fichero));
  const fuera = [];
  for (const { ruta, texto } of fuentes) {
    const nombra = clasesBoton.some((c) => new RegExp(`\\b${c}\\b`).test(texto));
    if (nombra && !conConjuntos.has(ruta)) fuera.push(ruta);
  }
  return fuera;
}
