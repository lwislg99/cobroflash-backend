// tests/_salidas-de-guard.mjs — SCRUM-1320
//
// Lee, por AST, CON QUÉ sale un guard (`process.exit(…)`) y si el veredicto entre «hallazgo» y
// «ciego» lo decide él a mano o lo saca de `veredictoDe` (`scripts/_hallazgos-y-ciegos.mjs`).
//
// Por AST y no por texto: los comentarios de estos guards CITAN las colas viejas para explicar por
// qué se retiraron, y un `grep` las contaría como vivas (A23, casilla 2).
import ts from 'typescript';

/** Los nombres que en esta casa significan «no llegué a medir». */
const NOMBRES_DE_CIEGO = new Set(['SALIDA_NO_SUPE_MEDIR', 'SALIDA_CIEGO', 'SALIDA_NO_ENCONTRADO', 'SALIDA_NO_ARRANCA', 'SALIDA_SIN_SERVIDOR']);
const NUMEROS_DE_CIEGO = new Set(['2', '3', '4']);

function clasificar(arg) {
  if (!arg) return 'otro';
  if (ts.isNumericLiteral(arg)) return arg.text === '1' ? 'hallazgo' : (NUMEROS_DE_CIEGO.has(arg.text) ? 'ciego' : 'otro');
  if (ts.isIdentifier(arg)) return arg.text === 'SALIDA_HALLAZGO' ? 'hallazgo' : (NOMBRES_DE_CIEGO.has(arg.text) ? 'ciego' : 'otro');
  if (ts.isPropertyAccessExpression(arg) && arg.name.text === 'codigo') return 'veredicto';
  // `process.exit(fallos === 0 ? 0 : 1)`: un 1 elegido a mano, aunque venga dentro de un ternario.
  if (ts.isConditionalExpression(arg)) {
    const ramas = [clasificar(arg.whenTrue), clasificar(arg.whenFalse)];
    return ramas.includes('hallazgo') ? 'hallazgo' : (ramas.includes('ciego') ? 'ciego' : 'otro');
  }
  return 'otro';
}

function nombresDe(nodo, sf) {
  const nombres = new Set();
  const ver = (n) => { if (ts.isIdentifier(n)) nombres.add(n.text); ts.forEachChild(n, ver); };
  if (nodo) ver(nodo);
  return nombres;
}

/**
 * Las salidas de un guard y lo que le pasa a `veredictoDe`.
 * `error` no nulo = el fichero no se pudo leer como programa: eso es un CIEGO del censo, no «sin salidas».
 */
export function salidasDe(fuente, nombre = 'guard.mjs') {
  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  if (sf.parseDiagnostics && sf.parseDiagnostics.length) {
    return { error: String(ts.flattenDiagnosticMessageText(sf.parseDiagnostics[0].messageText, ' ')), salidas: [], cuentasDeCiego: new Set(), usaVeredicto: false };
  }
  const salidas = [];
  const cuentasDeCiego = new Set();
  let usaVeredicto = false;

  const visitar = (nodo, condiciones) => {
    let dentro = condiciones;
    if (ts.isIfStatement(nodo)) dentro = [...condiciones, nodo.expression];
    if (ts.isCallExpression(nodo)) {
      const f = nodo.expression;
      if (ts.isPropertyAccessExpression(f) && f.name.text === 'exit' && ts.isIdentifier(f.expression) && f.expression.text === 'process') {
        salidas.push({
          tipo: clasificar(nodo.arguments[0]),
          linea: sf.getLineAndCharacterOfPosition(nodo.getStart(sf)).line + 1,
          // Los nombres de las condiciones `if` que envuelven a esta salida.
          bajo: new Set(condiciones.flatMap((c) => [...nombresDe(c, sf)])),
        });
      }
      if (ts.isIdentifier(f) && f.text === 'veredictoDe') {
        usaVeredicto = true;
        const o = nodo.arguments[0];
        if (o && ts.isObjectLiteralExpression(o)) {
          for (const p of o.properties) {
            const clave = p.name && p.name.text;
            if (clave !== 'ciegos') continue;
            // `{ ciegos }` y `{ ciegos: ciego }` y `{ ciegos: ciegos.length + 1 }`: los nombres de dentro.
            const valor = ts.isShorthandPropertyAssignment(p) ? p.name : p.initializer;
            for (const n of nombresDe(valor, sf)) cuentasDeCiego.add(n);
          }
        }
      }
    }
    // El `if` cubre su rama y su `else`; la propia condición se visita sin ella.
    ts.forEachChild(nodo, (hijo) => visitar(hijo, ts.isIfStatement(nodo) && hijo === nodo.expression ? condiciones : dentro));
  };
  visitar(sf, []);
  return { error: null, salidas, cuentasDeCiego, usaVeredicto };
}

/**
 * Los defectos de UN guard. Vacío = o no distingue dos estados, o los decide con `veredictoDe`.
 *
 *   ① decide a mano: tiene una salida de ciego Y una de hallazgo escritas por él. Es la cola de la
 *      familia de antes de SCRUM-1320 (el orden lo eligió alguien, y uno de los dos estados se pierde).
 *   ② usa `veredictoDe` y aun así sale a mano con el hallazgo: el ciego volvería a desaparecer.
 *   ③ usa `veredictoDe` y sale a mano con el ciego BAJO una condición sobre la misma cuenta que le
 *      pasa: el defecto original, vuelto a poner delante del veredicto.
 */
export function defectosDe(fuente, nombre = 'guard.mjs') {
  const r = salidasDe(fuente, nombre);
  if (r.error) return { ciego: r.error, defectos: [], ...r };
  const deCiego = r.salidas.filter((s) => s.tipo === 'ciego');
  const deHallazgo = r.salidas.filter((s) => s.tipo === 'hallazgo');
  const defectos = [];
  if (!r.usaVeredicto && deCiego.length && deHallazgo.length) {
    defectos.push('decide a mano entre ciego (línea ' + deCiego.map((s) => s.linea).join(', ') + ') y hallazgo (línea ' + deHallazgo.map((s) => s.linea).join(', ') + ')');
  }
  if (r.usaVeredicto && deHallazgo.length) {
    defectos.push('usa `veredictoDe` y además sale a mano con el hallazgo (línea ' + deHallazgo.map((s) => s.linea).join(', ') + ')');
  }
  if (r.usaVeredicto) {
    const tapan = deCiego.filter((s) => [...r.cuentasDeCiego].some((n) => s.bajo.has(n)));
    if (tapan.length) {
      defectos.push('usa `veredictoDe` y además sale por ciego bajo su propia cuenta de ciegos (línea ' + tapan.map((s) => s.linea).join(', ') + ')');
    }
  }
  return { ciego: null, defectos, ...r };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1327 · ¿CON QUÉ SALE UN GUARD, Y LO ELIGE ÉL?
//
// `defectosDe` (arriba) encuentra al guard que tiene una salida de ciego Y otra de hallazgo y las
// ordena a mano. Por construcción NO ve al que pinta el ciego con el MISMO 1 que el hallazgo: no hay
// «salida de ciego» que encontrar. Tres de los seis de SCRUM-1327 eran así, y otros seis que nadie
// había nombrado (SCRUM-1336) salieron de leer los cuarenta ficheros uno a uno.
//
// Así que aquí la pregunta es más simple y no depende de qué número eligió: **¿este guard sale por
// `veredictoDe(...).codigo`, o por algo que escribió él?** Todo lo segundo se cuenta, una a una.
//
// ── LO QUE NO VE, y `LIMITES_DE_COMO_SALE` lo dice en cada pasada ────────────────────────────
// No sigue imports; no ve un `throw` sin capturar; y de `veredictoDe(x)` sólo mira las cuentas si
// `x` es un objeto literal.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Lo que este lector NO mira. Va a la SALIDA del censo, no sólo aquí: un límite que sólo vive en un comentario no existe. */
export const LIMITES_DE_COMO_SALE = [
  'no sigo imports: una salida escrita dentro de un módulo importado no la veo',
  'no veo un `throw` sin capturar: el proceso sale con 1 sin pasar por nadie',
  'de `veredictoDe(x)` sólo miro las cuentas si `x` es un objeto literal',
];

const esBucle = (n) => ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n) || ts.isWhileStatement(n) || ts.isDoStatement(n);
const esFuncion = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n);
const esDeProcess = (n, miembro) => ts.isPropertyAccessExpression(n) && n.name.text === miembro && ts.isIdentifier(n.expression) && n.expression.text === 'process';
const esLlamadaA = (n, nombre) => !!n && ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === nombre;
const esCuentaLiteral = (v) => ts.isNumericLiteral(v) || ts.isArrayLiteralExpression(v) || v.kind === ts.SyntaxKind.TrueKeyword || v.kind === ts.SyntaxKind.FalseKeyword;

/**
 * Cómo sale un guard. PURA: recibe el fuente.
 *
 *   ciego ............ no nulo = no se pudo leer como programa, o no se le encuentra NINGUNA salida.
 *                      En los dos casos la respuesta es «no sé cómo decide», nunca «decide bien».
 *   porVeredicto ..... salidas con el `.codigo` de un `veredictoDe(...)`, fuera de todo recorrido.
 *   aMano ............ TODO lo demás, cada una con su línea y su porqué:
 *                        · `process.exit(<lo que sea>)` o `process.exitCode = …` que no es ese `.codigo`;
 *                        · una salida —también por `.codigo`— DENTRO de un bucle, del recorrido de
 *                          `recorrerCasos`, o de una función local llamada desde ahí: corta el recorrido
 *                          y lo de después no se mide (el grupo ① de SCRUM-1327);
 *                        · una cuenta escrita a mano en `veredictoDe({ hallazgos: 0, … })`: el número
 *                          lo ha puesto el guard, no lo que midió.
 */
export function comoSale(fuente, nombre = 'guard.mjs') {
  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  if (sf.parseDiagnostics && sf.parseDiagnostics.length) {
    return {
      ciego: 'no se puede leer como programa: ' + String(ts.flattenDiagnosticMessageText(sf.parseDiagnostics[0].messageText, ' ')),
      usaVeredicto: false, porVeredicto: [], aMano: [],
    };
  }
  const lineaDe = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  // ① Los nombres que guardan un veredicto (`const v = veredictoDe(…)`) y las funciones locales.
  const veredictos = new Set();
  const funciones = new Map();
  let usaVeredicto = false;
  const censar = (n) => {
    if (esLlamadaA(n, 'veredictoDe')) usaVeredicto = true;
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      if (esLlamadaA(n.initializer, 'veredictoDe')) veredictos.add(n.name.text);
      if (esFuncion(n.initializer)) funciones.set(n.name.text, n.initializer);
    }
    if (ts.isFunctionDeclaration(n) && n.name) funciones.set(n.name.text, n);
    ts.forEachChild(n, censar);
  };
  censar(sf);

  const esCodigoDeVeredicto = (arg) => !!arg && ts.isPropertyAccessExpression(arg) && arg.name.text === 'codigo'
    && ((ts.isIdentifier(arg.expression) && veredictos.has(arg.expression.text)) || esLlamadaA(arg.expression, 'veredictoDe'));

  // ② Las salidas, cada una con la función que la contiene y si está escrita dentro de un recorrido.
  const salidas = [];
  const llamadasEnRecorrido = new Set();
  const cuentasAMano = [];
  const visitar = (n, enRecorrido, funcion) => {
    if (ts.isCallExpression(n)) {
      const f = n.expression;
      if (esDeProcess(f, 'exit')) {
        const arg = n.arguments[0];
        salidas.push({ linea: lineaDe(n), texto: arg ? arg.getText(sf) : '(sin argumento)', veredicto: esCodigoDeVeredicto(arg), enRecorrido, funcion, via: 'process.exit' });
      }
      if (ts.isIdentifier(f) && enRecorrido && funciones.has(f.text)) llamadasEnRecorrido.add(f.text);
      if (esLlamadaA(n, 'veredictoDe') && n.arguments[0] && ts.isObjectLiteralExpression(n.arguments[0])) {
        for (const p of n.arguments[0].properties) {
          const clave = p.name && p.name.text;
          if ((clave !== 'hallazgos' && clave !== 'ciegos') || !ts.isPropertyAssignment(p)) continue;
          if (esCuentaLiteral(p.initializer)) {
            cuentasAMano.push({ linea: lineaDe(p), texto: p.getText(sf), porque: 'cuenta escrita a mano en `veredictoDe` (`' + p.getText(sf) + '`): el número lo pone el guard, no lo que midió' });
          }
        }
      }
      if (esLlamadaA(n, 'recorrerCasos')) {
        // El juez de cada caso SÍ está dentro del recorrido, aunque sea una función.
        n.arguments.forEach((a, i) => {
          if (i === 1 && esFuncion(a)) ts.forEachChild(a, (h) => visitar(h, true, a));
          else if (i === 1 && ts.isIdentifier(a) && funciones.has(a.text)) llamadasEnRecorrido.add(a.text);
          else visitar(a, enRecorrido, funcion);
        });
        return;
      }
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && esDeProcess(n.left, 'exitCode')) {
      salidas.push({ linea: lineaDe(n), texto: n.right.getText(sf), veredicto: esCodigoDeVeredicto(n.right), enRecorrido, funcion, via: 'process.exitCode' });
    }
    // El cuerpo de una función NO hereda el recorrido de donde está ESCRITA: lo hereda de donde se LLAMA (③).
    if (esFuncion(n)) { ts.forEachChild(n, (h) => visitar(h, false, n)); return; }
    ts.forEachChild(n, (h) => visitar(h, enRecorrido || esBucle(n), funcion));
  };
  visitar(sf, false, null);

  // ③ Una función local llamada desde un recorrido lo corta igual que si la salida estuviera escrita
  //    allí. Se propaga: `a()` en el bucle, `a` llama a `b`, y `b` sale.
  const cortan = new Set(llamadasEnRecorrido);
  for (let cambio = true; cambio;) {
    cambio = false;
    for (const nombreFn of [...cortan]) {
      const buscar = (n) => {
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && funciones.has(n.expression.text) && !cortan.has(n.expression.text)) {
          cortan.add(n.expression.text);
          cambio = true;
        }
        ts.forEachChild(n, buscar);
      };
      buscar(funciones.get(nombreFn));
    }
  }
  const nodosQueCortan = [...cortan].map((f) => funciones.get(f));
  const dentroDe = (nodo, contenedor) => { for (let p = nodo; p; p = p.parent) if (p === contenedor) return true; return false; };

  const porVeredicto = [];
  const aMano = [];
  for (const s of salidas) {
    const corta = s.enRecorrido || (!!s.funcion && nodosQueCortan.some((c) => dentroDe(s.funcion, c)));
    if (!s.veredicto) {
      aMano.push({ linea: s.linea, texto: s.texto, porque: '`' + s.via + '` con `' + s.texto + '`, que no es el `.codigo` de un `veredictoDe`' + (corta ? ' — y DENTRO del recorrido' : '') });
    } else if (corta) {
      aMano.push({ linea: s.linea, texto: s.texto, porque: 'sale DENTRO del recorrido: lo que hubiera después no se mide' });
    } else {
      porVeredicto.push({ linea: s.linea });
    }
  }
  aMano.push(...cuentasAMano);
  aMano.sort((a, b) => a.linea - b.linea);

  const ciego = salidas.length === 0 ? 'no le encuentro ninguna salida (ni `process.exit` ni `process.exitCode`)' : null;
  return { ciego, usaVeredicto, porVeredicto, aMano };
}

/**
 * El censo, PURO: recibe la población ya leída (`[{ f, fuente }]`) y la lista declarada, y dice qué
 * no cuadra. Está aquí, y no dentro del test, para poder verlo FALLAR con poblaciones fabricadas.
 *
 *   noSe ......... ficheros de los que no sabe decir cómo salen. NO los excusa ninguna lista.
 *   sinDeclarar .. salen a mano y no están en la lista (la séptima vez).
 *   desajustes ... están en la lista con OTRO número de salidas: una nueva, o una que ya se arregló.
 *   caducas ...... están en la lista y ya no salen a mano, o ya no existen.
 *   linea ........ las cuentas, que se dicen SIEMPRE, también cuando son cero.
 */
export function censoDeSalidas(poblacion, declarados) {
  const leidos = poblacion.map(({ f, fuente }) => ({ f, ...comoSale(fuente, f) }));
  const noSe = leidos.filter((r) => r.ciego).map((r) => r.f + ' → ' + r.ciego);
  const sabidos = leidos.filter((r) => !r.ciego);
  const aMano = sabidos.filter((r) => r.aMano.length > 0);
  const limpios = sabidos.filter((r) => r.aMano.length === 0);
  const detalle = (r) => r.aMano.map((s) => '\n        :' + s.linea + ' ' + s.porque).join('');
  const sinDeclarar = aMano.filter((r) => !declarados.has(r.f)).map((r) => r.f + ' → ' + r.aMano.length + ' salida(s) a mano' + detalle(r));
  const desajustes = aMano.filter((r) => declarados.has(r.f) && declarados.get(r.f).salidas !== r.aMano.length)
    .map((r) => r.f + ' → declara ' + declarados.get(r.f).salidas + ' y tiene ' + r.aMano.length + detalle(r));
  const caducas = [...declarados.keys()].filter((f) => !aMano.some((r) => r.f === f));
  const salidasAMano = aMano.reduce((n, r) => n + r.aMano.length, 0);
  const linea = 'POBLACIÓN: ' + poblacion.length + ' guards · ' + limpios.length + ' salen sólo por `veredictoDe` · '
    + aMano.length + ' salen a mano (' + salidasAMano + ' salidas) · ' + noSe.length + ' de los que NO SÉ cómo deciden';
  return { noSe, sinDeclarar, desajustes, caducas, linea, limpios: limpios.map((r) => r.f), aMano: aMano.map((r) => r.f), salidasAMano };
}

/**
 * LA LISTA — y es UNA. Los `scripts/guard-*.mjs` que hoy salen por algo que no es el `.codigo` de un
 * `veredictoDe`, con CUÁNTAS salidas así tienen y por qué. No es una lista de permisos: es deuda con
 * nombre. La mantiene exacta `tests/scrum1327-el-veredicto-no-se-decide-a-mano.test.mjs`, con sus
 * dos mitades: ni entra una salida sin declarar, ni se queda una entrada (o un número) de más.
 *
 *   salidas ...................... cuántas encuentra `comoSale`. Si arreglas una, baja el número aquí.
 *   pintaElCiegoDeHallazgo ....... un «no supe mirar» acaba en el mismo 1 que el defecto. HOY NO LA LLEVA
 *                                  NINGUNA ENTRADA: las seis que la llevaban las vació SCRUM-1336, que
 *                                  además las EJERCITÓ en ciego (hasta entonces estaban leídas, no
 *                                  corridas) y retiró `guard-rastro-del-menu.mjs`, un séptimo que
 *                                  estaba en la lista SIN la marca: su suelo era un `throw` sin
 *                                  capturar. Antes y después, con navegador, en
 *                                  `docs/master/evidencias/scrum1336/`. La marca se queda descrita por
 *                                  si otro guard vuelve a hacerlo: se declara con ella, no sin ella.
 *   eligeEntreCiegoYHallazgo ..... tiene una salida de ciego Y otra de hallazgo escritas por él. Es lo
 *                                  que censa `tests/scrum1320-…`, que DERIVA su lista de aquí.
 *
 * Uno por entrada. Un guard nuevo no entra aquí: sale por `veredictoDe`.
 */
export const SALEN_A_MANO = new Map([
  ['guard-acreditacion-invoicing-es.mjs', {
    salidas: 1,
    motivo: 'Sale con lo que devuelve `principal()` (0, 1 o 2, y el 2 es su ciego): el número viaja en una variable y este lector no sabe cuál es. No es de navegador ni tiene clave en package.json. Lo retira quien lo pase a `veredictoDe`.',
  }],
  ['guard-caja-semaforo.mjs', {
    salidas: 1,
    motivo: 'No da veredicto: MIDE y publica un número. Su única salida es «no supe mirar» (2), desde dentro del bucle de anchos: no hay hallazgos que tapar, pero un ancho ciego deja sin medir los siguientes. Lo retira quien lo pase a `recorrerCasos`.',
  }],
  ['guard-cls-barra-anuncio.mjs', {
    salidas: 1,
    motivo: 'Usa `veredictoDe`; lo declarado es el `process.exit(0)` final, DESPUÉS del veredicto verde, para cerrar el proceso.',
  }],
  ['guard-completar-lleva-al-campo.mjs', {
    salidas: 2,
    eligeEntreCiegoYHallazgo: true,
    motivo: 'ORDEN BUENO, escrito a mano desde SCRUM-904 (hallazgo primero, y el ciego se imprime siempre); lo ancla `tests/scrum904`. Lo retira quien lo pase a `veredictoDe`.',
  }],
  ['guard-conformidad-landing.mjs', {
    salidas: 2,
    motivo: 'No es de navegador y no tiene ciego: la lógica es pura (`_guard-conformidad-landing.mjs`). Un 1 es «la web afirma una conformidad sin documento» y el otro «se ejecutó y no se reconoció como CLI» (SCRUM-235).',
  }],
  ['guard-detalle-trabajo-917.mjs', {
    salidas: 1,
    motivo: 'Usa `veredictoDe`; lo declarado es el `process.exit(3)` de «no arrancó el navegador», ANTES de medir nada.',
  }],
  ['guard-lista-gastos.mjs', {
    salidas: 2,
    motivo: 'Usa `veredictoDe`; lo declarado es el vigía de 4 minutos (`process.exit(2)` si se cuelga: tira lo acumulado hasta ahí) y el `process.exit(0)` final, que cierra el servidor del banco tras el veredicto verde.',
  }],
  ['guard-nif-del-gasto.mjs', {
    salidas: 1,
    motivo: 'Usa `veredictoDe`; lo declarado es la salida de «falta dist/», ANTES de medir nada.',
  }],
  ['guard-nombres-no-declarados.mjs', {
    salidas: 2,
    eligeEntreCiegoYHallazgo: true,
    motivo: 'NO ES EL DEFECTO: su salida de ciego es `noMedido` del instrumento ENTERO, antes de juzgar nada; no hay hallazgos que tapar. No es de navegador.',
  }],
  ['guard-primera-pantalla.mjs', {
    salidas: 1,
    motivo: 'Sólo cuenta `fallos` y sale con `fallos === 0 ? 0 : 1`. No se le ha encontrado palabra para el ciego (buscado por texto, no ejercitado). Lo retira quien lo pase a `veredictoDe`.',
  }],
]);
