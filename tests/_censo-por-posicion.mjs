// tests/_censo-por-posicion.mjs — SCRUM-710
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// «Referenciar por POSICIÓN caduca. Referenciar por IDENTIDAD no.»
//
// Este censo busca las DOS formas de la misma avería que aparecieron el 3-sep-2026, las dos en
// el mismo día:
//
//   (a) ANCLAR POR NÚMERO DE LÍNEA. El censo de SCRUM-622 guardaba su excepción como
//       `invoicesView.js:520  <expresión>` y la comparaba entera. Doce líneas añadidas por
//       encima en SCRUM-599 la movieron a la 532 y el guard cayó SIN QUE CAMBIARA NADA DE LO
//       QUE VIGILA. Cuesta una vuelta de sesión cada vez.
//
//   (b) LÍNEAS BASE QUE COMPARTEN LÍNEA. Varias parejas `['loQueSea', 123]` escritas en la
//       misma línea física: dos tickets suben números DISTINTOS de la misma línea y git marca
//       conflicto sobre ella entera. Hubo SIETE conflictos semánticos en un día y los siete se
//       resolvieron sumando — la resolución correcta (los dos) sólo se descubre probando.
//
// 🔴 SE CENSA POR AST, NUNCA POR SUBCADENA, y no es preferencia de estilo: en una semana la
// comparación por nombre mordió cuatro veces —`data-view="parte` cazando `partes-oficina`,
// `MARCADOR_MICROCOPY` dentro de `PV_MARCADOR_MICROCOPY`, `defaultVat` que no contiene `vat`, y
// `round2(n)` que no contenía ningún nombre de dinero—. Con AST, un comentario que EXPLICA la
// prohibición no se cuenta a sí mismo: no es un literal.
// ═════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** Un `fichero.ext:123` dentro de un literal de cadena. La posición hecha dato. */
const POSICION_EN_TEXTO = /[\w.\-/]+\.(?:js|mjs|ts|tsx|html|md):\d+/;

/**
 * 🔴 SCRUM-1544 · QUÉ VE Y QUÉ NO VE ESTE CENSO. Declarado aquí y no en un comentario, porque el
 * 13-oct-2026 el hueco se USÓ: un test nuevo citaba tres veces un fichero y su línea, el
 * trinquete cayó con razón, y el «arreglo» fue trocear la cita con un `join` para que el censo
 * no la viera. La cita por posición seguía ahí y el guard habría salido verde.
 *
 * El censo lee el TEXTO QUE EL FUENTE DEJA ESCRITO. Ve la cita cuando el fichero, los dos puntos
 * y el número están escritos, aunque sea en trozos. No la ve en cuanto una de las piezas es un
 * nombre, una llamada o una expresión regular: para eso habría que EJECUTAR el fichero.
 *
 * Cada forma de las dos listas tiene su siembra en `prueba`, que la fabrica, comprueba que en
 * ejecución ES la cita, y mira qué dice el censo. Una forma declarada sin siembra, o una siembra
 * sin declarar, es rojo allí: «declarada» no es «existente».
 */
export const LIMITE_DE_LA_CITA_ARMADA = Object.freeze({
  ve: Object.freeze([
    'entera-en-comillas',
    'entera-en-plantilla-sin-huecos',
    'entera-en-plantilla-con-un-hueco-al-lado',
    'troceada-con-join',
    'troceada-con-suma',
    'troceada-con-el-numero-en-un-hueco',
  ]),
  noVe: Object.freeze([
    'linea-en-una-constante',
    'fichero-en-una-constante',
    'dos-puntos-por-codigo',
    'en-expresion-regular',
  ]),
  motivo: 'Medido el 13-oct-2026 sobre 1.795 ficheros y 25.167 expresiones que arman texto: en '
    + 'cuanto una pieza es un nombre, lo que casa con la forma de una cita NO lo es. Fichero '
    + 'escrito y línea calculada: 7, las 7 mensajes con la línea medida, que es lo que este censo '
    + 'recomienda. Nombre y número escrito: 26, ninguna una cita (puertos, razones de contraste). '
    + 'Todo nombres: 406. Contarlas sería apagar el censo con ruido; con todas las piezas '
    + 'escritas, en cambio, salieron 0 falsos positivos, y por eso esas sí se ven.',
  quienLaRetira: 'Quien enseñe al censo a resolver una constante del mismo fichero o a leer una '
    + 'expresión regular: pasa la forma de `noVe` a `ve`, su siembra cambia de lado en el mismo '
    + 'commit y los hallazgos que aparezcan se declaran en `CONOCIDOS_A`.',
  prueba: 'tests/scrum710b-anclaje-por-identidad.test.mjs',
  consta: 'SCRUM-1544',
});

/** Lo que ocupa el sitio de una pieza que no está escrita. No casa con nada de una cita. */
const HUECO = ' ';

/** ¿Esta expresión ARMA un texto con piezas? Plantilla con huecos, suma, o `[…].join('…')`. */
function armaTexto(n) {
  if (ts.isTemplateExpression(n)) return true;
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) return true;
  return ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
    && n.expression.name.text === 'join' && n.arguments.length === 1
    && ts.isStringLiteralLike(n.arguments[0])
    && ts.isArrayLiteralExpression(n.expression.expression);
}

/**
 * El texto que una expresión deja ESCRITO: cada pieza escrita con su texto, cada pieza que no lo
 * está (un nombre, una llamada) con un HUECO. `resto` recoge lo que hay que seguir recorriendo.
 *
 * Un literal que YA lleva la cita entera se cambia por un hueco: lo cuenta el recorrido de
 * siempre al llegar a él, y contarlo aquí también sería sumar dos veces el mismo anclaje.
 */
function textoEscrito(n, resto) {
  if (ts.isParenthesizedExpression(n)) return textoEscrito(n.expression, resto);
  if (ts.isStringLiteralLike(n)) {
    if (!POSICION_EN_TEXTO.test(n.text)) return n.text;
    resto.push(n);
    return HUECO;
  }
  if (ts.isNumericLiteral(n)) return n.text;
  if (ts.isTemplateExpression(n)) {
    return n.head.text
      + n.templateSpans.map((s) => textoEscrito(s.expression, resto) + s.literal.text).join('');
  }
  if (armaTexto(n) && ts.isBinaryExpression(n)) {
    return textoEscrito(n.left, resto) + textoEscrito(n.right, resto);
  }
  if (armaTexto(n)) {
    return n.expression.expression.elements.map((el) => textoEscrito(el, resto))
      .join(n.arguments[0].text);
  }
  resto.push(n);
  return HUECO;
}

function ficheros(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { ficheros(p, out); continue; }
    if (/\.(mjs|js|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

const rel = (raiz, p) => path.relative(raiz, p).split(path.sep).join('/');

/**
 * FORMA (a) · literales de cadena que llevan dentro un `fichero:línea`.
 *
 * Sólo LITERALES: un comentario que cite `foo.js:12` es documentación y no caduca en silencio
 * —nadie compara contra él—, así que no entra. Por eso hace falta AST y no `grep`.
 */
export function anclajesPorLinea(raiz, subdirs = ['tests', 'scripts']) {
  const hallados = [];
  let leidos = 0;
  for (const sub of subdirs) {
    for (const p of ficheros(path.join(raiz, sub))) {
      leidos++;
      const src = fs.readFileSync(p, 'utf8');
      const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true,
        p.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
      // 🔴 NO TODOS PESAN IGUAL, y meterlos en el mismo saco haria el censo inutil:
      //   · un `fichero:linea` en el MENSAJE de un assert envejece —dice «mira la 68» y ya no
      //     esta ahi— pero NO tumba nada: nadie compara contra el.
      //   · el mismo texto como DATO —lo que se compara— es el defecto de SCRUM-622: se cae sin
      //     que cambie lo vigilado.
      // Se distinguen por AST: el ULTIMO argumento de un `assert.*` es el mensaje.
      const mensajes = new Set();
      (function marca(n) {
        if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
            && /^assert$/.test(n.expression.expression.getText(sf)) && n.arguments.length >= 2) {
          const ultimo = n.arguments[n.arguments.length - 1];
          (function todos(x) { if (ts.isStringLiteralLike(x) || armaTexto(x)) mensajes.add(x); ts.forEachChild(x, todos); })(ultimo);
        }
        ts.forEachChild(n, marca);
      })(sf);

      (function walk(n) {
        // SCRUM-1544 · una expresión que ARMA texto se lee entera, con sus piezas juntas: así la
        // cita troceada (`['f.ts', 12].join(':')`, `'f.ts' + ':' + 12`) y la que va entera en un
        // trozo de plantilla con huecos salen igual que la escrita de una vez.
        const armada = armaTexto(n);
        const resto = [];
        const citas = armada
          ? (textoEscrito(n, resto).match(new RegExp(POSICION_EN_TEXTO.source, 'g')) || [])
          : (ts.isStringLiteralLike(n) ? (POSICION_EN_TEXTO.exec(n.text) || []).slice(0, 1) : []);
        for (const cita of citas) {
          const m = [cita];
          {
            // 🔴 SCRUM-710 · EL DESTINO SE SEPARA DE SU LÍNEA, y es la misma leccion que este
            // fichero aplicó a SCRUM-622 una capa más arriba: alli el censo separo `id` de `linea`
            // y aqui la `id` seguía llevando dentro la línea del DESTINO. Consecuencia medida el
            // 4-sep-2026: **corregir** un anclaje de `:133` a `:141` producía a la vez un id nuevo
            // y un id desaparecido, o sea DOS rojos por un cambio que no añade nada. El trinquete
            // que existe para que no proliferen los anclajes por línea bloqueaba **arreglar uno**.
            //
            // `destino` (sin línea) es lo que no se mueve cuando alguien edita por encima. La
            // línea sigue viajando en `cita` y en `lineaDestino`, para el MENSAJE — que es donde
            // una posición sí sirve.
            const corte = m[0].lastIndexOf(':');
            hallados.push({
              fichero: rel(raiz, p),
              linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
              cita: m[0],
              destino: m[0].slice(0, corte),
              lineaDestino: Number(m[0].slice(corte + 1)),
              enMensaje: mensajes.has(n),
              // La IDENTIDAD de este hallazgo: dónde vive y qué posición fija. No lleva su
              // propia línea dentro, que sería repetir el defecto que censa.
              id: `${rel(raiz, p)}  ${m[0]}`,
              // Y la identidad ESTABLE, la del trinquete: qué guard ancla a qué fichero. Dos
              // anclajes al mismo fichero desde el mismo guard comparten identidad a proposito:
              // lo que los distingue es CUÁNTOS hay, y eso se cuenta aparte.
              identidad: `${rel(raiz, p)}  ${m[0].slice(0, corte)}`,
              // SCRUM-1544 · la cita no estaba en UN literal: salió de juntar piezas.
              armada,
            });
          }
        }
        // Dentro de una expresión armada sólo se sigue por lo que no se ha leído ya como pieza.
        if (armada) { for (const r of resto) walk(r); return; }
        ts.forEachChild(n, walk);
      })(sf);
    }
  }
  return { leidos, hallados };
}

/**
 * FORMA (b) · arrays donde DOS O MÁS elementos empiezan en la MISMA línea física y hay números.
 *
 * Ése es el que genera el conflicto: cada ticket sube un número distinto de la misma línea, git
 * no sabe que son cambios independientes y marca la línea entera. Un array con un elemento por
 * línea no tiene el problema, aunque tenga cien números.
 */
export function lineasBaseCompartidas(raiz, subdirs = ['tests', 'scripts']) {
  const hallados = [];
  let leidos = 0;
  for (const sub of subdirs) {
    for (const p of ficheros(path.join(raiz, sub))) {
      leidos++;
      const src = fs.readFileSync(p, 'utf8');
      const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true,
        p.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
      (function walk(n) {
        if (ts.isArrayLiteralExpression(n) && n.elements.length >= 2) {
          // Se buscan PARES [texto, numero] —una linea base con su nombre—, no cualquier
          // array con numeros. Sin esta condicion el censo devuelve 323 e incluye datos de
          // prueba como [1, 2]: un numero grande y ruidoso no es una medida, es un cajon.
          const pares = n.elements.filter((el) => ts.isArrayLiteralExpression(el)
            && el.elements.length === 2
            && ts.isStringLiteralLike(el.elements[0])
            && ts.isNumericLiteral(el.elements[1]));
          if (pares.length < 2) { ts.forEachChild(n, walk); return; }
          const numeros = [];
          (function cuenta(x) {
            if (ts.isNumericLiteral(x)) numeros.push(Number(x.text));
            ts.forEachChild(x, cuenta);
          })(n);
          if (numeros.length >= 2) {
            const porLinea = new Map();
            for (const el of pares) {
              const l = sf.getLineAndCharacterOfPosition(el.getStart(sf)).line;
              porLinea.set(l, (porLinea.get(l) || 0) + 1);
            }
            const compartidas = [...porLinea.values()].filter((c) => c >= 2).length;
            if (compartidas > 0) {
              const inicio = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
              hallados.push({
                fichero: rel(raiz, p),
                linea: inicio,
                elementos: n.elements.length,
                numeros: numeros.length,
                lineasCompartidas: compartidas,
                muestra: n.getText(sf).replace(/\s+/g, ' ').slice(0, 90),
                id: `${rel(raiz, p)}  ${n.getText(sf).replace(/\s+/g, ' ').slice(0, 90)}`,
              });
            }
          }
        }
        ts.forEachChild(n, walk);
      })(sf);
    }
  }
  return { leidos, hallados };
}
