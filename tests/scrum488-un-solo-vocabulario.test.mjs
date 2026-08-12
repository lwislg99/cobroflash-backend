// tests/scrum488-un-solo-vocabulario.test.mjs — SCRUM-488
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL MISMO COBRO SE LEE DISTINTO EN COBROS Y EN INFORMES, Y ESO ES LO PEQUEÑO DEL TICKET.
//
// `paid_via` **es** `charge.method` (`exportData.ts:229`: «es lo que el asesor cruza con el
// banco»), y hoy tiene DOS traducciones vivas en el navegador, aprobadas por separado y sin saber
// una de la otra:
//
//   · COBROS (SCRUM-474 fase 2 + SCRUM-481) — el rótulo del cubo lo manda el SERVIDOR
//     (`cubosDeMetodo`), y la fila añade el matiz: «Bizum · manual», «tarjeta · Stripe».
//   · INFORMES (SCRUM-398) — `paidViaEtiquetas.js`: «📲 Bizum (confirmado a mano)», «💳 Tarjeta».
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 ESTE FICHERO NO PINTA NADA, Y ESO ES EL ENCARGO (regla 30)
//
// La grafía única se PROPONE en `docs/master/SCRUM-488.md` y la aprueba el asesor. Lo que se hace
// aquí es MEDIR: censar los dos vocabularios, nombrar cada divergencia, y dejar un guard que
// impida que se separen más mientras alguien decide. El mecanismo propuesto se ejerce **dentro de
// este test** —para poder enseñar el control positivo— y NO existe en `public/`: si viviera allí,
// sería texto nuevo pintado sin aprobar.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 Y LO QUE APARECIÓ MIDIENDO, QUE ES MÁS GORDO QUE LA GRAFÍA
//
// `reports.routes.ts:164` agrupa por `inv.charge?.method` **CRUDO**. `card` y `card:stripe` son
// filas SEPARADAS del informe, y las dos se etiquetan «💳 Tarjeta» —lo exige el propio guard de
// SCRUM-398—. El profesional ve **dos filas idénticas con importes distintos** y no tiene en
// pantalla el total de lo cobrado con tarjeta. Está medido abajo, y va al documento.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(import.meta.url);
const RUTA_INFORMES = 'src/modules/reports/app/routes/reports.routes.ts';

// ── LAS TRES FUENTES, tal y como corren ──────────────────────────────────────────────────────
const { ETIQUETAS_PAID_VIA, ETIQUETAS_HEREDADAS, etiquetaMetodoCobro } =
  require_(path.join(RAIZ, 'public/dashboard/js/paidViaEtiquetas.js'));
const { rotuloDeMetodo, COBROS_MATICES } =
  require_(path.join(RAIZ, 'public/dashboard/js/cobrosView.js'));
const { cubosDeMetodo, cuboDeCobro, ROTULO_SIN_METODO } =
  await import('../dist/modules/billing/domain/metodoDeCobro.js');
const { PAID_VIA } = await import('../dist/modules/billing/domain/paidVia.js');

const CUBOS = cubosDeMetodo(ROTULO_SIN_METODO);

/** Lo que lee el profesional en COBROS, componiendo como compone la pantalla. */
const enCobros = (valor) => rotuloDeMetodo(valor, cuboDeCobro(valor), CUBOS);
/** Lo que lee el profesional en INFORMES. */
const enInformes = (valor) => etiquetaMetodoCobro(valor);

/**
 * EL CORPUS: lo que de verdad llega a las dos pantallas, derivado y no escrito a mano.
 *
 * `PAID_VIA` es la intención; los HEREDADOS son lo que la base YA tiene escrito y que
 * `paidViaEtiquetas.js` documenta con su procedencia (`card:stripe` lo escriben cuatro sitios
 * vivos; `manual` lo FABRICA `reports.routes.ts:164` al leer una factura sin `Charge`).
 */
const CORPUS = [...PAID_VIA, ...Object.keys(ETIQUETAS_HEREDADAS)];

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO — si un censo devuelve cero, este fichero se declara CIEGO en vez de dar verde
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-488 · SUELO: los DOS vocabularios se leen, y ninguno está vacío', () => {
  // «Cero» y «no supe mirar» dan el mismo verde si nadie los separa. Un censo vacío haría
  // trivialmente cierto «no hay divergencias».
  assert.ok(Object.keys(ETIQUETAS_PAID_VIA).length >= 5,
    `🔴 ESCÁNER CIEGO: el vocabulario de INFORMES trae ${Object.keys(ETIQUETAS_PAID_VIA).length} ` +
    'entradas. Con el mapa vacío, la comparación de abajo no compararía nada.');
  assert.ok(Object.keys(ETIQUETAS_HEREDADAS).length >= 2,
    '🔴 ESCÁNER CIEGO: no se leen los HEREDADOS, que son justo los valores que la base ya tiene ' +
    'escritos y donde vive media divergencia.');
  assert.ok(CUBOS.length >= 5,
    `🔴 ESCÁNER CIEGO: el servidor sirve ${CUBOS.length} cubos para COBROS.`);
  assert.ok(Object.keys(COBROS_MATICES).length >= 2,
    '🔴 ESCÁNER CIEGO: no se leen los matices de COBROS (`Bizum · automático` / `· manual`).');
  assert.ok(CORPUS.length >= 7,
    `🔴 el corpus son ${CORPUS.length} valores: se estaría midiendo de menos.`);
  // Control positivo del instrumento: las dos funciones traducen de verdad antes de compararlas.
  assert.equal(enCobros('card'), 'tarjeta');
  assert.equal(enInformes('card'), '💳 Tarjeta');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① EL CENSO — cuántas divergencias hay, y CUÁLES
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Para cada valor, qué lee el profesional en cada pantalla. Es el censo del ticket. */
function censo() {
  return CORPUS.map((v) => ({ valor: v, cobros: enCobros(v), informes: enInformes(v) }));
}

/**
 * ¿Dicen lo mismo? Se compara el TEXTO VISIBLE, normalizando lo que NO es vocabulario: el emoji
 * decorativo de Informes y las mayúsculas iniciales. Dos pantallas que dicen «tarjeta» y
 * «💳 Tarjeta» **no divergen en vocabulario**: la segunda decora la primera.
 *
 * 🔴 La normalización es DELIBERADAMENTE generosa, y por eso lo que quede marcado es una
 * divergencia de verdad y no una diferencia de estilo. Si se comparase carácter a carácter,
 * saldrían las siete y el número no diría nada.
 */
const desnudo = (s) => String(s)
  .replace(/[\p{Extended_Pictographic}️]/gu, '')   // el emoji no es vocabulario
  .replace(/\s+/g, ' ').trim().toLowerCase();

const divergen = (a, b) => desnudo(a) !== desnudo(b);

test('SCRUM-488 · ① CENSO: el mismo valor, las dos pantallas, y las divergencias NOMBRADAS', () => {
  const filas = censo();
  const distintas = filas.filter((f) => divergen(f.cobros, f.informes));

  // 🔴 Esto NO es un guard de «cero divergencias»: hoy hay, y arreglarlas es cambio de microcopy
  // que aprueba el asesor (regla 30). Lo que se fija es el CENSO MEDIDO: si mañana aparece una
  // divergencia nueva, o desaparece una sin que nadie apruebe el texto, este test lo dice.
  const esperadas = [
    // `bizum_auto`: «Bizum · automático» (Cobros) vs «Bizum» (Informes).
    'bizum_auto',
    // `bizum_manual`: «Bizum · manual» vs «Bizum (confirmado a mano)».
    'bizum_manual',
    // `card:stripe`: «tarjeta · Stripe» vs «Tarjeta» — Informes borra la pasarela.
    'card:stripe',
    // `manual`: «Método no registrado» vs «Marcado a mano». Dos AFIRMACIONES distintas sobre el
    // mismo hecho, y ésta es la peor de las cuatro: una dice que no consta y la otra que consta
    // que lo marcó una persona.
    'manual',
  ];
  assert.deepEqual(distintas.map((f) => f.valor), esperadas,
    '🔴 EL CENSO DE DIVERGENCIAS HA CAMBIADO. Las dos pantallas se han separado más, o se han\n' +
    '  juntado sin que nadie apruebe el texto (regla 30). Medido hoy:\n' +
    filas.map((f) => `    ${f.valor.padEnd(14)} COBROS «${f.cobros}»  ·  INFORMES «${f.informes}»`)
      .join('\n'));

  // Y el reverso: los que YA coinciden tienen que seguir coincidiendo.
  const iguales = filas.filter((f) => !divergen(f.cobros, f.informes)).map((f) => f.valor);
  assert.deepEqual(iguales, ['card', 'transfer', 'cash'],
    `🔴 ha cambiado el conjunto de valores que las dos pantallas ya dicen igual: ${iguales.join(', ')}.`);
});

test('SCRUM-488 · ① CONTROL NEGATIVO del comparador: no marca lo que solo se diferencia en el emoji', () => {
  // Si `divergen` marcara cualquier diferencia de forma, las 7 saldrían y el censo no mediría
  // vocabulario: mediría decoración.
  assert.ok(!divergen('tarjeta', '💳 Tarjeta'), '🔴 el comparador marca el emoji como divergencia.');
  assert.ok(!divergen('transferencia', '🏦 Transferencia'));
  assert.ok(divergen('Bizum · manual', '📲 Bizum (confirmado a mano)'),
    '🔴 el comparador NO ve una divergencia de verdad: sería ciego y el censo daría cero.');
  assert.ok(divergen('Método no registrado', '✍️ Marcado a mano'));
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② ¿ES ESTE VOCABULARIO UNA TERCERA COPIA DE LA PARTICIÓN? — NO, y por qué
// ═════════════════════════════════════════════════════════════════════════════════════════

const ES_FUNCION = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n)
  || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);

/** El MISMO detector del trinquete de SCRUM-474: ¿parte por el primer `:` y toma la cabeza? */
function particionesDe(ruta, texto) {
  const sf = ts.createSourceFile(ruta, texto, ts.ScriptTarget.Latest, true);
  const out = [];
  const parte = (fn) => {
    let si = false;
    (function rec(n) {
      if (si) return;
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && ['indexOf', 'split', 'lastIndexOf'].includes(n.expression.name.text)) {
        const a = n.arguments[0];
        if (a && ts.isStringLiteral(a) && a.text === ':') si = true;
      }
      ts.forEachChild(n, rec);
    })(fn);
    return si;
  };
  const cabeza = (fn) => {
    let si = false;
    (function rec(n) {
      if (si) return;
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && ['slice', 'substring', 'substr'].includes(n.expression.name.text)) si = true;
      ts.forEachChild(n, rec);
    })(fn);
    return si;
  };
  (function rec(n) {
    if (ES_FUNCION(n) && n.body && parte(n) && cabeza(n)) {
      const nom = (n.name && ts.isIdentifier(n.name)) ? n.name.text
        : (n.parent && ts.isVariableDeclaration(n.parent) ? n.parent.name.getText(sf) : '(anónima)');
      out.push(nom);
    }
    ts.forEachChild(n, rec);
  })(sf);
  return out;
}

test('SCRUM-488 · ② SUELO DEL DETECTOR: ve una partición y DISCRIMINA la que no lo es', () => {
  // 🔴 Sin esto, «`paidViaEtiquetas` no es una tercera copia» y «el detector está ciego» dan el
  // mismo verde. Y si el recuento BAJA, es sospecha: aquí se demuestra primero que sabe contar.
  assert.deepEqual(
    particionesDe('s.js', 'function copia(v){ var i=v.indexOf(":"); return v.slice(0,i); }'),
    ['copia'], '🔴 el detector no ve una partición escrita delante de sus narices.');
  assert.deepEqual(
    particionesDe('s2.js', 'function nada(v){ return v.trim().slice(0,3)+v.indexOf("-"); }'), [],
    '🔴 el detector marca funciones que NO parten por «:».');
});

test('SCRUM-488 · ② `paidViaEtiquetas.js` NO es una tercera copia de la partición, y consta por qué', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/paidViaEtiquetas.js'), 'utf8');
  assert.deepEqual(particionesDe('paidViaEtiquetas.js', fuente), [],
    '🔴 `paidViaEtiquetas.js` HA EMPEZADO A PARTIR `<metodo>:<pasarela>` por su cuenta. Eso sería ' +
    'la TERCERA copia de la partición, y el trinquete de `tests/scrum474-dos-copias-atadas.test.mjs` ' +
    'tiene que enterarse: o delega en una de las dos declaradas, o se declara allí con su motivo.');

  // 🔴 Y POR QUÉ NO LO ES, dicho con el mecanismo delante: no parte nada — trata `card:stripe`
  // como UNA CLAVE ENTERA en `ETIQUETAS_HEREDADAS`. Es un diccionario, no una regla.
  assert.ok(Object.prototype.hasOwnProperty.call(ETIQUETAS_HEREDADAS, 'card:stripe'),
    '🔴 `card:stripe` ya no está como clave entera: si ahora se resuelve partiéndolo, esto SÍ pasa ' +
    'a ser una copia de la partición.');
  assert.equal(etiquetaMetodoCobro('card:paypal'), '⚠️ Método no reconocido (card:paypal)',
    '🔴 `card:paypal` se ha traducido como tarjeta: eso solo se puede saber PARTIENDO por «:», y ' +
    'entonces hay una tercera copia de la partición que nadie ha contado.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ 🔴 EL HALLAZGO QUE MANDA — INFORMES AGRUPA POR EL VALOR CRUDO
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * ¿Con qué clave agrupa el informe «Cómo te pagan»? Se lee del AST de la ruta, no del texto: lo
 * que se busca es la expresión que alimenta `byMethodMap`.
 */
function claveDeAgrupacionDeInformes() {
  const ruta = path.join(RAIZ, RUTA_INFORMES);
  const sf = ts.createSourceFile(RUTA_INFORMES, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true);
  const claves = [];
  (function rec(n) {
    // `byMethodMap.set(<clave>, …)` / `.get(<clave>)`
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && ['set', 'get'].includes(n.expression.name.text)
      && n.expression.expression.getText(sf) === 'byMethodMap' && n.arguments[0]) {
      claves.push(n.arguments[0].getText(sf));
    }
    ts.forEachChild(n, rec);
  })(sf);
  return claves;
}

test('SCRUM-488 · ③ SUELO: se localiza la agrupación del informe, o este bloque no mide nada', () => {
  const claves = claveDeAgrupacionDeInformes();
  assert.ok(claves.length >= 2,
    `🔴 ESCÁNER CIEGO: no se encuentra cómo agrupa \`byMethodMap\` en ${RUTA_INFORMES} (se vieron ` +
    `${claves.length} usos). Si la ruta cambió de forma, ARREGLA EL DETECTOR: un cero aquí se ` +
    'leería como «no agrupa por el crudo», que es la conclusión contraria a la verdadera.');
});

test('SCRUM-488 · ③ 🔴 el informe agrupa por el método CRUDO, y por eso el total de tarjeta va PARTIDO', () => {
  const claves = claveDeAgrupacionDeInformes();
  const fuente = fs.readFileSync(path.join(RAIZ, RUTA_INFORMES), 'utf8');

  // ① La clave de agrupación sale del método crudo, sin pasar por el normalizador del servidor.
  assert.ok(claves.every((c) => c === 'method'),
    `🔴 la clave de agrupación ha cambiado: ${JSON.stringify(claves)}. Si ahora normaliza, este ` +
    'hallazgo está ARREGLADO y hay que rehacer la medición del documento — no borrar el test.');
  assert.match(fuente, /const method = inv\.charge\?\.method \|\| 'manual'/,
    '🔴 ha cambiado la línea que fabrica la clave. Vuelve a medir antes de fiarte del documento.');
  assert.doesNotMatch(fuente, /metodoParaAgrupar|cuboDeCobro/,
    '🔴 el informe YA normaliza el método. Es el arreglo de este hallazgo: quítalo del documento ' +
    'como pendiente y re-mide los totales.');

  // ② LA CONSECUENCIA, con las funciones de verdad: dos claves que el informe cuenta por separado
  // y que la pantalla etiqueta IGUAL. Dos filas idénticas, importes distintos.
  assert.notEqual('card', 'card:stripe');
  assert.equal(enInformes('card'), enInformes('card:stripe'),
    '🔴 si estas dos dejaran de compartir etiqueta, el defecto sería otro (dos nombres) y no éste ' +
    '(dos filas iguales). Re-mide.');
  assert.equal(cuboDeCobro('card'), cuboDeCobro('card:stripe'),
    '🔴 y el servidor SÍ sabe que son el mismo método: `cuboDeCobro` los une para el filtro de ' +
    'Cobros. El informe tiene la función al lado y no la usa.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ EL MECANISMO PROPUESTO — se ejerce AQUÍ, no se pinta (STOP 4)
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * LA PROPUESTA, en una función, para poder enseñar el control positivo sin pintar nada.
 *
 * **Una sola grafía, servida desde donde ya se sirve el rótulo del cubo** (`cubosDeMetodo`, en el
 * servidor, derivada de `PAID_VIA`), más el matiz que ya existe en Cobros. Informes deja de tener
 * mapa propio y consume lo mismo. El emoji **se queda como decoración de Informes**, delante del
 * texto: es lo único de su vocabulario que no es vocabulario.
 *
 * 🔴 Vive en el test A PROPÓSITO. Ponerla en `public/` sería pintar texto nuevo sin aprobar
 * (regla 30), que es el STOP 4 de este encargo. El texto lo decide el asesor; esto solo demuestra
 * que **con un mecanismo único las dos pantallas no pueden discrepar**.
 */
const EMOJI_PROPUESTO = { bizum: '📲', card: '💳', transfer: '🏦', cash: '💶', 'sin-metodo': '⚠️' };
function grafiaUnicaPropuesta(valor, { conEmoji = false } = {}) {
  const texto = enCobros(valor);              // ← la MISMA composición que ya usa Cobros
  if (!conEmoji) return texto;
  const emoji = EMOJI_PROPUESTO[cuboDeCobro(valor)];
  return emoji ? `${emoji} ${texto}` : texto;
}

test('SCRUM-488 · ④ CONTROL POSITIVO: con el mecanismo propuesto, las dos pantallas dicen lo mismo', () => {
  const distintas = CORPUS.filter((v) =>
    divergen(grafiaUnicaPropuesta(v), grafiaUnicaPropuesta(v, { conEmoji: true })));
  assert.deepEqual(distintas, [],
    `🔴 el mecanismo propuesto NO unifica: ${JSON.stringify(distintas)}. Si la versión con emoji y ` +
    'la de sin dicen cosas distintas, no es una grafía única con decoración: son dos otra vez.');

  // Y uno por uno, con el texto delante, para que el asesor lea lo que aprobaría.
  assert.equal(grafiaUnicaPropuesta('bizum_manual'), 'Bizum · manual');
  assert.equal(grafiaUnicaPropuesta('bizum_manual', { conEmoji: true }), '📲 Bizum · manual');
  assert.equal(grafiaUnicaPropuesta('card:stripe', { conEmoji: true }), '💳 tarjeta · Stripe');
  assert.equal(grafiaUnicaPropuesta('manual', { conEmoji: true }), '⚠️ Método no registrado');
});

test('SCRUM-488 · ④ 🔴 CONTROL NEGATIVO: la unificación NO cambia ningún agrupamiento', () => {
  // Lo que protege el dinero: cambiar CÓMO SE LLAMA una cosa no puede cambiar EN QUÉ CUBO cae ni
  // cuánto suma. El mecanismo propuesto solo compone texto; el cubo lo sigue decidiendo
  // `cuboDeCobro`, que no se toca.
  for (const v of CORPUS) {
    const antes = cuboDeCobro(v);
    grafiaUnicaPropuesta(v, { conEmoji: true });
    assert.equal(cuboDeCobro(v), antes,
      `🔴 el cubo de «${v}» ha cambiado al componer su rótulo. Un rótulo NO puede mover dinero de ` +
      'cubo: eso sería cambiar un total, no un texto.');
  }
  // Y el reparto de Informes tampoco se toca: sigue agrupando por el crudo (③). La propuesta de
  // grafía **no arregla** el total partido — se dice para que nadie lo dé por arreglado.
  assert.notEqual(cuboDeCobro('card'), 'card:stripe');
  assert.equal(claveDeAgrupacionDeInformes().every((c) => c === 'method'), true,
    '🔴 el agrupamiento del informe ha cambiado en este ticket. Aquí NO se toca: se mide (STOP).');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ⑤ ROJO POR EL MECANISMO — que los dos vocabularios se separen tiene que DOLER
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-488 · ⑤ 🔴 si los dos vocabularios divergen MÁS, el guard cae NOMBRANDO valor y grafías', () => {
  // Se provoca la divergencia sobre una copia del mapa de Informes —sin tocar el fichero— y se
  // comprueba que el censo la ve Y que el mensaje trae el valor y los DOS textos. Un guard que
  // dice «algo ha cambiado» sin decir qué obliga a repetir la medición entera.
  const original = ETIQUETAS_PAID_VIA.cash;
  try {
    ETIQUETAS_PAID_VIA.cash = '💶 Metálico';   // divergencia nueva: Cobros dice «efectivo»
    const filas = censo();
    const nuevas = filas.filter((f) => divergen(f.cobros, f.informes)).map((f) => f.valor);
    assert.ok(nuevas.includes('cash'),
      '🔴 EL CENSO NO VE UNA DIVERGENCIA NUEVA. Con esto ciego, las dos pantallas pueden separarse ' +
      'todo lo que quieran sin que salte nadie.');

    const fila = filas.find((f) => f.valor === 'cash');
    const mensaje = `${fila.valor}: COBROS «${fila.cobros}» · INFORMES «${fila.informes}»`;
    assert.match(mensaje, /cash/);
    assert.match(mensaje, /efectivo/, '🔴 el mensaje no trae la grafía de Cobros.');
    assert.match(mensaje, /Metálico/, '🔴 el mensaje no trae la grafía de Informes.');
  } finally {
    ETIQUETAS_PAID_VIA.cash = original;   // el módulo está cacheado: dejarlo tocado envenena al resto
  }
  assert.equal(enInformes('cash'), '💶 Efectivo', '🔴 no se ha restaurado el mapa de Informes.');
});

test('SCRUM-488 · ⑤ 🔴 y si una divergencia DESAPARECE sin aprobación, también cae', () => {
  // Un recuento que BAJA es sospecha, no mejora: puede ser que alguien haya unificado el texto sin
  // que el asesor lo apruebe (regla 30) — o que el censo se haya quedado ciego.
  const original = ETIQUETAS_PAID_VIA.bizum_manual;
  try {
    ETIQUETAS_PAID_VIA.bizum_manual = 'Bizum · manual';   // «arreglado» por su cuenta
    const nuevas = censo().filter((f) => divergen(f.cobros, f.informes)).map((f) => f.valor);
    assert.ok(!nuevas.includes('bizum_manual'),
      '🔴 el censo no ve que la divergencia se ha cerrado: no distingue arreglar de romper.');
    assert.notDeepEqual(nuevas, ['bizum_auto', 'bizum_manual', 'card:stripe', 'manual'],
      '🔴 el censo da el mismo resultado con y sin el cambio: está midiendo otra cosa.');
  } finally {
    ETIQUETAS_PAID_VIA.bizum_manual = original;
  }
  assert.equal(enInformes('bizum_manual'), '📲 Bizum (confirmado a mano)',
    '🔴 no se ha restaurado el mapa de Informes.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ⑥ LA CAJA DE INFORMES — el techo COMPONIBLE, no el del ejemplo que se tenga delante
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-488 · ⑥ 🔴 la etiqueta de Informes NO tiene techo: mete el valor crudo dentro', () => {
  // 🔴 LA LECCIÓN DE SCRUM-481: allí se dio por techo un ancho de 21 que era el de la TARJETA,
  // cuando el componible real era 27. Aquí el techo no es que sea más grande: es que NO EXISTE.
  // `etiquetaMetodoCobro` compone «⚠️ Método no reconocido (<valor>)» con el valor CRUDO dentro,
  // y `charge.method` es una columna de texto libre para el lector.
  const largo = 'sepa_transfer_instantanea_por_pasarela_desconocida';
  const etiqueta = etiquetaMetodoCobro(largo);
  assert.ok(etiqueta.includes(largo),
    '🔴 el valor ya no va dentro de la etiqueta: entonces SÍ hay techo y hay que re-medir la caja.');
  assert.ok(etiqueta.length > 60,
    `🔴 la etiqueta mide ${etiqueta.length}: el techo componible ha cambiado, re-mide la caja de ` +
    'Informes en navegador antes de tocar el documento.');

  // El techo de las etiquetas APROBADAS, que es lo que sí se puede medir en navegador.
  const aprobadas = [...Object.values(ETIQUETAS_PAID_VIA), ...Object.values(ETIQUETAS_HEREDADAS)];
  //
  // 🔸 **28 son unidades UTF-16, no letras**: «📲 Bizum (confirmado a mano)» tiene 27 caracteres
  // visibles y el emoji cuenta 2 en `.length`. Se deja la unidad dicha porque en SCRUM-481 el
  // número que se dio por techo era de otra magnitud que la medida, y así no vuelve a pasar. Lo
  // que decide la caja no es ninguno de los dos: es la anchura en píxeles, medida en navegador.
  const maxAprobada = Math.max(...aprobadas.map((e) => e.length));
  assert.equal(maxAprobada, 28,
    `🔴 la etiqueta aprobada más larga mide ${maxAprobada} y se midieron 28 («📲 Bizum (confirmado ` +
    'a mano)»). La caja de Informes está medida en navegador para ESE valor: re-mídela.');
});
