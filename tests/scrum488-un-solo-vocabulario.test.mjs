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
// FASE 1 (medición) + FASE 2 (el arreglo). Qué hace cada mitad de este fichero
//
// · **La fase 1 mide y NO pinta**: censa los dos vocabularios, nombra cada divergencia y deja un
//   guard que impide que se separen más. Cambiar un rótulo es microcopy y lo aprueba el asesor
//   (regla 30), así que ni un texto se toca — sigue siendo verdad después de la fase 2.
// · **La fase 2 arregla lo que la fase 1 encontró debajo**, que no era vocabulario sino
//   AGRUPACIÓN: el informe agrupaba por el valor CRUDO de `paid_via`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL DEFECTO QUE CIERRA LA FASE 2
//
// `reports.routes.ts:164` agrupaba por `inv.charge?.method` **CRUDO**. `card` y `card:stripe` eran
// filas SEPARADAS del informe, y las dos se etiquetan «💳 Tarjeta» —lo exige el propio guard de
// SCRUM-398—. El profesional veía **dos filas idénticas con importes distintos** y no tenía en
// pantalla el total de lo cobrado con tarjeta. Ahora la clave es el CUBO (`agruparCobrosPorCubo`).
//
// 🔴 Y LO QUE **NO** HACE LA FASE 2, porque son decisiones tomadas y no descuidos:
//
//   · **Informes NO compone** «💳 tarjeta · Stripe» como Cobros. La propuesta de la fase 1 se
//     descartó: Cobros cuenta COBROS INDIVIDUALES —ahí cabe el matiz— e Informes cuenta FAMILIAS.
//     Dos rótulos para el mismo dato no chocan cuando las pantallas cuentan unidades distintas.
//   · **Cero cambios de rótulo**: `paidViaEtiquetas.js` y el guard de SCRUM-398 no se tocan.
//   · **`manual` se queda EXACTAMENTE como estaba** (es SCRUM-491), y el valor crudo del «no
//     reconocido» también (lo cierran SCRUM-486/489 por el lado de quién escribe).
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
const { cubosDeMetodo, cuboDeCobro, ROTULO_SIN_METODO, CUBO_SIN_METODO } =
  await import('../dist/modules/billing/domain/metodoDeCobro.js');
const { PAID_VIA } = await import('../dist/modules/billing/domain/paidVia.js');
// FASE 2 · el reparto DE VERDAD, el que corre en la ruta. No una copia escrita aquí.
//
// 🔴 Se importa SOLO el contrato. `claveDeAgrupacion` y `representanteDelCubo` son ayudantes
// internos a propósito (SCRUM-411 / precedente de SCRUM-441), así que todo lo de abajo se mide por
// donde se mide de verdad: por las filas que acaban en la pantalla.
const { agruparCobrosPorCubo } = await import('../dist/modules/reports/domain/cobrosPorCubo.js');

/** Las filas que produce el reparto que CORRE, para unos métodos dados (un cobro de 1 € cada uno). */
const filasDe = (...metodos) => agruparCobrosPorCubo(metodos.map((m) => ({ metodo: m, total: '1.00' })));

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
// ③ FASE 2 · EL INFORME YA NO AGRUPA POR EL VALOR CRUDO — con DOS instrumentos separados
// ═════════════════════════════════════════════════════════════════════════════════════════

const RUTA_DOMINIO = 'src/modules/reports/domain/cobrosPorCubo.ts';

/**
 * INSTRUMENTO A · el AST de la RUTA: ¿QUIÉN construye las filas del informe?
 *
 * No basta con que exista un agrupador: **mencionar no es hacer**. Lo que se busca es que la ruta
 * lo LLAME y que su resultado sea lo que viaja como `byMethod`, y que el mapa a mano —el que
 * agrupaba por el crudo— ya no esté.
 */
function agrupadorDeLaRuta() {
  const ruta = path.join(RAIZ, RUTA_INFORMES);
  const sf = ts.createSourceFile(RUTA_INFORMES, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true);
  const llamadas = [];
  let alimentaByMethod = false;
  let mapaAMano = false;
  (function rec(n) {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) llamadas.push(n.expression.text);
    // `const byMethod = <algo>(…)` — de dónde salen de verdad las filas de la respuesta.
    if (ts.isVariableDeclaration(n) && n.name.getText(sf) === 'byMethod' && n.initializer
      && ts.isCallExpression(n.initializer) && ts.isIdentifier(n.initializer.expression)
      && n.initializer.expression.text === 'agruparCobrosPorCubo') alimentaByMethod = true;
    if (ts.isIdentifier(n) && n.text === 'byMethodMap') mapaAMano = true;
    ts.forEachChild(n, rec);
  })(sf);
  return { llamadas, alimentaByMethod, mapaAMano };
}

/** INSTRUMENTO B · el AST del DOMINIO: ¿la clave sale de `cuboDeCobro` o de otro sitio? */
function cuerpoDeClaveDeAgrupacion() {
  const ruta = path.join(RAIZ, RUTA_DOMINIO);
  const sf = ts.createSourceFile(RUTA_DOMINIO, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true);
  let llamadas = null;
  (function rec(n) {
    if (ts.isFunctionDeclaration(n) && n.name && n.name.text === 'claveDeAgrupacion' && n.body) {
      llamadas = [];
      (function dentro(x) {
        if (ts.isCallExpression(x) && ts.isIdentifier(x.expression)) llamadas.push(x.expression.text);
        ts.forEachChild(x, dentro);
      })(n.body);
    }
    ts.forEachChild(n, rec);
  })(sf);
  return llamadas;
}

test('SCRUM-488 · ③ SUELO: los DOS detectores encuentran su código, o este bloque no mide nada', () => {
  // Un cero aquí se leería como «ya no agrupa por el crudo», que es la conclusión contraria a la
  // verdadera si lo que pasa es que el escáner se quedó ciego.
  const { llamadas } = agrupadorDeLaRuta();
  assert.ok(llamadas.length >= 3,
    `🔴 ESCÁNER CIEGO: el AST de ${RUTA_INFORMES} ve ${llamadas.length} llamadas. Si el fichero ` +
    'cambió de forma, ARREGLA EL DETECTOR.');
  assert.ok(Array.isArray(cuerpoDeClaveDeAgrupacion()),
    `🔴 ESCÁNER CIEGO: no se encuentra \`claveDeAgrupacion\` en ${RUTA_DOMINIO}. Si se renombró, ` +
    'el detector tiene que seguirla — no borrarse.');
  // Autoprueba: el detector de la ruta sabe DECIR QUE NO cuando el agrupador no está.
  const sinAgrupador = ts.createSourceFile('x.ts', 'const byMethod = otraCosa(1);', ts.ScriptTarget.Latest, true);
  let visto = false;
  (function rec(n) {
    if (ts.isVariableDeclaration(n) && n.name.getText(sinAgrupador) === 'byMethod' && n.initializer
      && ts.isCallExpression(n.initializer) && ts.isIdentifier(n.initializer.expression)
      && n.initializer.expression.text === 'agruparCobrosPorCubo') visto = true;
    ts.forEachChild(n, rec);
  })(sinAgrupador);
  assert.equal(visto, false, '🔴 el detector daría por bueno cualquier constructor de `byMethod`.');
});

test('SCRUM-488 · ③ 🔴 INSTRUMENTO A: la ruta DELEGA en el agrupador por cubo, y el mapa a mano ya no está', () => {
  const { llamadas, alimentaByMethod, mapaAMano } = agrupadorDeLaRuta();
  assert.ok(llamadas.includes('agruparCobrosPorCubo'),
    `🔴 ${RUTA_INFORMES} no llama a \`agruparCobrosPorCubo\`. Que la función exista no prueba que ` +
    'nadie la use: el informe volvería a repartir por su cuenta.');
  assert.equal(alimentaByMethod, true,
    '🔴 `byMethod` —lo que viaja a la pantalla— NO sale de `agruparCobrosPorCubo`. Hay un segundo ' +
    'reparto en medio, y entonces lo que se pinta no es lo que este test comprueba.');
  assert.equal(mapaAMano, false,
    '🔴 `byMethodMap` ha vuelto a la ruta: era el mapa que agrupaba por el valor CRUDO y partía el ' +
    'total de la tarjeta en dos filas con el mismo nombre.');
});

test('SCRUM-488 · ③ 🔴 INSTRUMENTO B: la clave de agrupación sale de `cuboDeCobro`, no de un mapa nuevo', () => {
  const llamadas = cuerpoDeClaveDeAgrupacion();
  assert.ok(llamadas.includes('cuboDeCobro'),
    `🔴 \`claveDeAgrupacion\` ya no consulta \`cuboDeCobro\`: ${JSON.stringify(llamadas)}. Si el ` +
    'informe decide por su cuenta qué va con qué, hay DOS reglas de agrupación y el filtro de ' +
    'Cobros y el informe pueden contar cosas distintas.');

  // Y el comportamiento, medido POR EL CONTRATO: las dos tarjetas salen en UNA fila.
  assert.deepEqual(filasDe('card', 'card:stripe').map((f) => [f.method, f.metodos, f.count]),
    [['card', ['card', 'card:stripe'], 2]],
    '🔴 `card:stripe` vuelve a tener fila propia: es el defecto entero de este ticket.');
  assert.equal(filasDe('bizum_auto', 'bizum_manual').length, 1,
    '🔴 los dos Bizum se han vuelto a separar en el informe.');
  // 🔴 Y lo que `cuboDeCobro` NO clasifica se queda con SU valor: ni se agrupa ni se inventa «otros».
  assert.deepEqual(filasDe('manual').map((f) => [f.method, f.cubo]), [['manual', CUBO_SIN_METODO]],
    '🔴 `manual` ha entrado en un cubo. Es SCRUM-491 y su fila se queda EXACTAMENTE como estaba.');
  assert.equal(cuboDeCobro('manual'), CUBO_SIN_METODO,
    '🔴 ha cambiado lo que `cuboDeCobro` devuelve para `manual`: re-mide antes de fiarte de esto.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ FASE 2 · LAS POST-CONDICIONES DEL ARREGLO
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * El importe con el formato que pinta el informe. Espejo de `fmtMoneyEs` (`api.js:475`) sin el
 * símbolo: `useGrouping: 'always'` es lo que fuerza el punto de los miles, que es justo lo que hay
 * que enseñar para que la tabla del documento y la de aquí sean el mismo número.
 */
const eur = (n) => new Intl.NumberFormat('es-ES',
  { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' }).format(n);

/**
 * `n` cobros de un método que suman EXACTAMENTE `totalEur`. En céntimos, para que la tabla del
 * documento y la del test sean el mismo número y no «casi».
 */
function cobrosDe(metodo, n, totalEur) {
  const total = Math.round(totalEur * 100);
  const base = Math.floor(total / n);
  const out = [];
  for (let i = 0; i < n; i += 1) {
    out.push({ metodo, total: ((i === n - 1 ? total - base * (n - 1) : base) / 100).toFixed(2) });
  }
  return out;
}

/**
 * LA LÍNEA DE AYER, escrita aquí para poder enseñar el ANTES: la clave era el método CRUDO.
 * Es una réplica declarada del código retirado, no una segunda implementación viva.
 */
function agruparComoAntes(cobros) {
  const m = new Map();
  for (const c of cobros) {
    const cur = m.get(c.metodo) ?? { centimos: 0, count: 0 };
    cur.centimos += Math.round(Number(c.total) * 100);
    cur.count += 1;
    m.set(c.metodo, cur);
  }
  return [...m.entries()]
    .map(([method, v]) => ({ method, eur: v.centimos / 100, count: v.count }))
    .sort((a, b) => b.eur - a.eur);
}

/** Lo que el profesional LEE en cada fila: la vista resuelve `etiquetaMetodoCobro(m.method)`. */
const pintada = (fila) => etiquetaMetodoCobro(fila.method);

/**
 * Etiquetas que se repiten entre filas distintas, con los VALORES que cada fila absorbió.
 *
 * 🔴 Los valores, y no el `method` de la fila: al provocar el rojo se vio que dos filas partidas
 * viajan las dos con el REPRESENTANTE de su cubo, así que el mensaje decía «card + card» y no
 * «card + card:stripe» — un guard que dice que algo se rompió sin decir el qué obliga a repetir la
 * medición entera. `agruparComoAntes` no trae `metodos`, y por eso el respaldo.
 */
function etiquetasDuplicadas(filas) {
  const por = new Map();
  for (const f of filas) {
    const e = pintada(f);
    por.set(e, [...(por.get(e) ?? []), (f.metodos ?? [f.method]).join(' & ')]);
  }
  return [...por.entries()].filter(([, m]) => m.length > 1);
}

/** El corpus de ④, con un desconocido sintético: lo que de verdad puede llegar a la pantalla. */
const DESCONOCIDO = 'sepa_transfer_instantanea_por_pasarela_desconocida';
const CORPUS_PINTABLE = [...CORPUS, DESCONOCIDO];

test('SCRUM-488 · ④ SUELO + AUTOPRUEBA: el detector de etiquetas repetidas SABE ver una', () => {
  // 🔴 Control positivo DENTRO del test: una lista vacía hace verdad cualquier «ya no hay
  // duplicados». Y el detector se prueba contra el ANTES, que es donde SÍ había uno.
  assert.deepEqual(etiquetasDuplicadas([]), [],
    '🔴 el detector inventa duplicados donde no hay filas.');
  const antes = agruparComoAntes(CORPUS_PINTABLE.map((v) => ({ metodo: v, total: '1.00' })));
  assert.ok(antes.length >= 7, `🔴 el ANTES trae ${antes.length} filas: no se está midiendo nada.`);
  const dup = etiquetasDuplicadas(antes);
  assert.deepEqual(dup, [['💳 Tarjeta', ['card', 'card:stripe']]],
    '🔴 el detector NO ve el duplicado que la fase 1 midió en pantalla («💳 Tarjeta» dos veces). ' +
    'Ciego así, el test de abajo daría verde diga lo que diga el código.');
});

test('SCRUM-488 · ④ 🔴 ESTRUCTURAL: ninguna fila del informe comparte etiqueta con otra', () => {
  // ESTRUCTURAL y no de comportamiento a propósito: se recorre TODO lo que puede llegar a la
  // pantalla —el conjunto cerrado, los heredados y un desconocido—, no una muestra de datos. Hoy
  // dos filas coinciden por accidente; un test de comportamiento no cazaría la bifurcación el día
  // que nazca (una pasarela nueva, un valor heredado más).
  const filas = agruparCobrosPorCubo(CORPUS_PINTABLE.map((v) => ({ metodo: v, total: '1.00' })));
  assert.ok(filas.length >= 5,
    `🔴 el reparto devuelve ${filas.length} filas sobre ${CORPUS_PINTABLE.length} valores: con la ` +
    'lista corta, «no hay duplicados» sería trivialmente cierto.');
  const dup = etiquetasDuplicadas(filas);
  assert.deepEqual(dup, [],
    '🔴 DOS FILAS DEL INFORME DICEN LO MISMO:\n' +
    dup.map(([e, m]) => `    «${e}» ← ${m.join(' + ')}`).join('\n') +
    '\n  Es el defecto de este ticket volviendo: el profesional ve dos filas idénticas con importes\n' +
    '  distintos y en ninguna parte el total de esa forma de cobro. Filas pintadas hoy:\n' +
    filas.map((f) => `    ${f.metodos.join(' & ').padEnd(52)} «${pintada(f)}»`).join('\n'));
});

test('SCRUM-488 · ④ 🔴 la tabla de la fase 1, ANTES y DESPUÉS: el total de la familia es la SUMA', () => {
  // Los números son los MEDIDOS en la fase 1 sobre la pantalla pintada (`docs/master/SCRUM-488.md`),
  // metidos por la puerta del reparto de verdad. Se añade el par de Bizum, que agrupa por el mismo
  // motivo y que la fase 1 no llegó a pintar.
  const cobros = [
    ...cobrosDe('card', 9, 3210.40),
    ...cobrosDe('card:stripe', 7, 2870.15),
    ...cobrosDe('bizum_auto', 4, 640.00),
    ...cobrosDe('bizum_manual', 2, 210.50),
    ...cobrosDe('manual', 3, 900.00),
  ];
  assert.equal(cobros.length, 25, '🔴 el banco de prueba no tiene los cobros que dice tener.');

  const antes = agruparComoAntes(cobros);
  const despues = agruparCobrosPorCubo(cobros);

  // ANTES: las dos tarjetas SEPARADAS, con los importes que la fase 1 midió en pantalla.
  const tarjetasAntes = antes.filter((f) => pintada(f) === '💳 Tarjeta');
  assert.deepEqual(tarjetasAntes.map((f) => [eur(f.eur), f.count]), [['3.210,40', 9], ['2.870,15', 7]],
    '🔴 el ANTES ya no reproduce la medición de la fase 1: la tabla del documento hay que rehacerla.');

  // DESPUÉS: UNA fila, y su total es la suma exacta de las dos que absorbió.
  const tarjetasDespues = despues.filter((f) => pintada(f) === '💳 Tarjeta');
  assert.equal(tarjetasDespues.length, 1,
    `🔴 la tarjeta sigue partida en ${tarjetasDespues.length} filas.`);
  const tarjeta = tarjetasDespues[0];
  assert.deepEqual(tarjeta.metodos, ['card', 'card:stripe'],
    '🔴 la fila de tarjeta no absorbió las dos etiquetas que la fase 1 encontró partidas.');
  assert.equal(Math.round(tarjeta.eur * 100),
    tarjetasAntes.reduce((a, f) => a + Math.round(f.eur * 100), 0),
    `🔴 la familia suma ${eur(tarjeta.eur)} € y sus partes ${tarjetasAntes.map((f) => eur(f.eur)).join(' + ')}. ` +
    'Un total que no cuadra con sus partes es peor que no tener informe.');
  assert.equal(eur(tarjeta.eur), '6.080,55');
  assert.equal(tarjeta.count, 16, '🔴 el nº de cobros de la familia no es la suma de los dos trozos.');

  // Bizum, por el mismo mecanismo, y con el rótulo DEL CUBO (no el de una de las dos mitades).
  const bizum = despues.filter((f) => cuboDeCobro(f.method) === 'bizum');
  assert.equal(bizum.length, 1, '🔴 los dos Bizum siguen en filas separadas.');
  assert.equal(pintada(bizum[0]), '📲 Bizum',
    `🔴 la fila de la familia Bizum dice «${pintada(bizum[0])}», que es el nombre de UNA de las dos ` +
    'y no el de la familia.');
  assert.equal(eur(bizum[0].eur), '850,50');
  assert.equal(bizum[0].count, 6);

  // Y NINGÚN euro se ha perdido por el camino: el total del informe es el mismo antes y después.
  assert.equal(
    despues.reduce((a, f) => a + Math.round(f.eur * 100), 0),
    antes.reduce((a, f) => a + Math.round(f.eur * 100), 0),
    '🔴 agrupar ha cambiado el total del informe. Reagrupar mueve filas, NUNCA dinero.');
  assert.equal(despues.reduce((a, f) => a + f.count, 0), cobros.length,
    '🔴 se han perdido o duplicado cobros al agrupar.');
});

test('SCRUM-488 · ④ 🔴 CONTROL NEGATIVO: lo que `cuboDeCobro` NO clasifica sale EXACTAMENTE como hoy', () => {
  // Lo que este test protege es que el arreglo NO se haya llevado por delante lo que no le tocaba:
  // `manual` es SCRUM-491 y el valor crudo del desconocido lo cierran SCRUM-486/489.
  const sinClasificar = ['manual', 'desconocido', DESCONOCIDO];
  for (const v of sinClasificar) {
    assert.equal(cuboDeCobro(v), CUBO_SIN_METODO,
      `🔴 «${v}» ha pasado a estar clasificado: re-mide, porque su fila deja de ser la de hoy.`);
    assert.deepEqual(filasDe(v).map((f) => f.method), [v],
      `🔴 «${v}» ya no viaja con su propio valor: se le ha buscado un nombre de familia a algo que ` +
      'no es una familia, sino la ausencia de una.');
  }
  const filas = filasDe(...sinClasificar);
  assert.deepEqual(filas.map((f) => f.method).sort(), [...sinClasificar].sort(),
    '🔴 los valores sin clasificar se han fundido entre ellos: el profesional vería un importe ' +
    'agregado sin saber de qué.');
  assert.equal(pintada(filas.find((f) => f.method === 'manual')), '✍️ Marcado a mano',
    '🔴 ha cambiado lo que lee el profesional en la fila de `manual`. Es SCRUM-491, no este ticket.');
  assert.equal(pintada(filas.find((f) => f.method === DESCONOCIDO)),
    `⚠️ Método no reconocido (${DESCONOCIDO})`,
    '🔴 ha cambiado la fila del desconocido: el valor crudo NO se toca en este ticket.');

  // Y el reverso del control negativo: agrupar no mueve ningún cobro de cubo. Un reparto puede
  // juntar filas; lo que NO puede es cambiar en qué familia cae un cobro.
  for (const v of CORPUS_PINTABLE) {
    const antes = cuboDeCobro(v);
    agruparCobrosPorCubo([{ metodo: v, total: '1.00' }]);
    assert.equal(cuboDeCobro(v), antes, `🔴 el cubo de «${v}» ha cambiado al agrupar.`);
  }
});

test('SCRUM-488 · ④ 🔴 ANCLA: la etiqueta del REPRESENTANTE es la del CUBO, y la vista sigue pintando `m.method`', () => {
  // El representante sale del ORDEN de `PAID_VIA`. Reordenar el conjunto no debería poder
  // rebautizar una familia en silencio: si `bizum_manual` pasara delante, la fila diría «📲 Bizum
  // (confirmado a mano)», que es el nombre de una de las dos mitades. Esto lo caza.
  const conFamilia = CUBOS.filter((c) => c.clave !== CUBO_SIN_METODO);
  assert.ok(conFamilia.length >= 4, `🔴 solo se ven ${conFamilia.length} cubos con familia.`);
  for (const cubo of conFamilia) {
    // Se entra por el contrato: TODOS los valores del conjunto que caen en ese cubo, agrupados.
    const dentro = PAID_VIA.filter((v) => cuboDeCobro(v) === cubo.clave);
    assert.ok(dentro.length >= 1, `🔴 el cubo «${cubo.clave}» se ha quedado sin ningún método dentro.`);
    const filas = filasDe(...dentro);
    assert.equal(filas.length, 1,
      `🔴 «${cubo.clave}» sale en ${filas.length} filas para ${dentro.length} métodos de la misma familia.`);
    assert.ok(!divergen(pintada(filas[0]), cubo.rotulo),
      `🔴 la familia «${cubo.clave}» se pinta «${pintada(filas[0])}» y su rótulo es «${cubo.rotulo}». ` +
      `El representante (${filas[0].method}) ya no es el que lleva el nombre de la familia.`);
  }

  // ANCLA con SCRUM-398, que NO se toca: lo que este fichero calcula con `etiquetaMetodoCobro` es
  // literalmente la expresión que resuelve la celda en la vista. Si la vista dejara de usarla,
  // todo lo de arriba mediría una pantalla que no existe.
  const vista = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/reportsView.js'), 'utf8');
  assert.match(vista, /etiquetaMetodoCobro\(m\.method\)/,
    '🔴 la vista ya no resuelve la etiqueta con `etiquetaMetodoCobro(m.method)`: este test estaría ' +
    'comprobando un texto que nadie pinta.');
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
