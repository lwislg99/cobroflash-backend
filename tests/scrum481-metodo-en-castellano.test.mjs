// tests/scrum481-metodo-en-castellano.test.mjs — SCRUM-481
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA PANTALLA HABLABA DOS IDIOMAS, Y LO VIO EL FUNDADOR EN LA SUYA
//
// La columna MÉTODO pintaba `c.metodo` TAL CUAL: `card:stripe`, `card`, `transfer`. Tres
// centímetros más arriba las pestañas del filtro decían «Bizum · tarjeta · transferencia ·
// efectivo · Método no registrado», en castellano y aprobadas el 10-ago.
//
// Y el agravante nació con SCRUM-474: arreglado el filtro, el profesional pulsa «tarjeta» y las
// filas que le salen dicen `card`. Antes el filtro también fallaba, así que la incoherencia no se
// veía — arreglar una mitad destapó la otra.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL RÓTULO SE DERIVA, NO SE TRADUCE A MANO
//
// `rotuloDeMetodo` sale de `cuboDeMetodo` —**la misma función que decide el filtro**— y de
// `COBROS_METODOS`. Columna y pestaña no pueden discrepar porque es el mismo cálculo, no dos que
// se parecen. Por eso el corpus de estos tests se DERIVA de `COBROS_METODOS` en vez de escribirse:
// si mañana nace un método, estos tests lo cubren solos o se caen.
//
// Y **no hay tercera copia de la partición**: `pasarelaDeMetodo` no parte por «:», le pide la
// cabeza a `metodoSinPasarela` y se queda con lo que sobra. El trinquete de SCRUM-474 sigue en 2.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ✅ MICROCOPY APROBADA (asesor + fundador, 11-ago-2026)
//   FORMATO:  <método> · <pasarela>     EJEMPLOS: «tarjeta · Stripe» «tarjeta» «Bizum»
//   SIN PASARELA: solo el método. NUNCA «tarjeta · » con nada detrás.
//   NO RESUELTO: «Método no registrado», el rótulo que YA existe en las pestañas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { redNormal } from './_banco-red.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(import.meta.url);
const VISTA = 'public/dashboard/js/cobrosView.js';
const {
  COBROS_METODOS, COBROS_SIN_METODO, COBROS_PASARELAS,
  cuboDeMetodo, rotuloDeMetodo, pasarelaDeMetodo,
} = require_(path.join(RAIZ, VISTA));

const cobro = (id, metodo) => ({
  origen: 'charge', id, fecha: '2026-08-01T10:00:00.000Z', cliente: `Cliente ${id}`,
  concepto: 'Trabajo', importe: '100.00', moneda: 'EUR', metodo, estado: 'paid',
  referencia: null, numero: null, tipo: null, invoiceId: null, chargeId: id,
});

const filas = (n) => todos(n).filter((x) => x.className === 'cell-client').length;

/** Los textos de la columna MÉTODO, leídos de la tabla pintada. */
function celdasDeMetodo(nodo) {
  return todos(nodo).filter((x) => x.tagName === 'TD' && x.className === 'col-hide-mobile')
    .map((x) => x.textContent);
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-481 · SUELO: la vista publica lo que este fichero mide, o no mide nada', () => {
  for (const [n, v] of Object.entries({ rotuloDeMetodo, pasarelaDeMetodo, cuboDeMetodo })) {
    assert.equal(typeof v, 'function', `🔴 la vista no publica \`${n}\`.`);
  }
  assert.ok(Array.isArray(COBROS_METODOS) && COBROS_METODOS.length >= 4,
    `🔴 solo se leen ${COBROS_METODOS?.length} cubos: el corpus derivado de abajo sería un puñado.`);
  assert.equal(COBROS_SIN_METODO.rotulo, 'Método no registrado',
    '🔴 el rótulo de «no consta» no es el aprobado, y es el que usa la columna cuando no resuelve.');
});

// ── EL CONTROL POSITIVO ──────────────────────────────────────────────────────────────────────

test('SCRUM-481 · 🔴 `card:stripe` y `card` se leen en castellano Y caen bajo la misma pestaña', async () => {
  assert.equal(rotuloDeMetodo('card:stripe'), 'tarjeta · Stripe',
    '🔴 la columna sigue sin hablar castellano en el caso que vio el fundador.');
  assert.equal(rotuloDeMetodo('card'), 'tarjeta');
  assert.equal(cuboDeMetodo('card:stripe'), cuboDeMetodo('card'),
    '🔴 los dos se leen igual pero NO filtran igual: la pantalla volvería a decir dos cosas.');

  // Y en la pantalla de verdad, pintada: los datos entran por el `fetch` del banco de SCRUM-362.
  const b = cargarDashboard(RAIZ, { red: redNormal([cobro(1, 'card:stripe'), cobro(2, 'card')]) });
  const r = await pintarVista(b, 'renderCobrosView');
  assert.equal(r.error, null, `🔴 la vista revienta: ${r.error && r.error.message}`);
  const celdas = celdasDeMetodo(r.contenedor);
  assert.deepEqual(celdas, ['tarjeta · Stripe', 'tarjeta'],
    `🔴 la columna pinta ${JSON.stringify(celdas)}. El profesional pulsa «tarjeta» y las filas le ` +
    'contestan en el idioma de la base de datos.');
});

test('SCRUM-481 · el rótulo se DERIVA de la partición: todo el corpus, sin lista a mano', () => {
  // El corpus sale de `COBROS_METODOS`, no se escribe. Si mañana nace un método, entra solo.
  let comprobados = 0;
  for (const cubo of COBROS_METODOS) {
    for (const valor of cubo.casa) {
      assert.equal(rotuloDeMetodo(valor), cubo.rotulo,
        `🔴 «${valor}» debería leerse «${cubo.rotulo}» y se lee «${rotuloDeMetodo(valor)}».`);
      for (const [pas, marca] of Object.entries(COBROS_PASARELAS)) {
        assert.equal(rotuloDeMetodo(`${valor}:${pas}`), `${cubo.rotulo} · ${marca}`,
          `🔴 «${valor}:${pas}» no compone el rótulo aprobado.`);
        comprobados++;
      }
      comprobados++;
    }
  }
  assert.ok(comprobados >= 15,
    `🔴 solo se han comprobado ${comprobados} combinaciones: el corpus derivado se ha quedado corto ` +
    'y este test estaría dando un verde barato.');
});

test('SCRUM-481 · la pasarela se escribe como su marca, y sale de la partición declarada', () => {
  assert.equal(pasarelaDeMetodo('card:stripe'), 'stripe');
  assert.equal(pasarelaDeMetodo('CARD:Stripe'), 'stripe', '🔴 no normaliza como `metodoSinPasarela`.');
  assert.equal(pasarelaDeMetodo('card'), null, '🔴 se inventa una pasarela donde no la hay.');
  assert.equal(pasarelaDeMetodo('card:'), null, '🔴 `card:` no tiene pasarela: `partirMetodo` lo rechaza.');
  assert.equal(rotuloDeMetodo('card:mercadopago'), 'tarjeta · MercadoPago',
    '🔴 la marca no se escribe como la escribe ella. «Mercadopago» no es su nombre.');
});

// ── 🔴 EL CONTROL NEGATIVO, Y PROTEGE EL DINERO ──────────────────────────────────────────────

test('SCRUM-481 · 🔴 un método NO reconocido no desaparece y no se cuela en otro cubo', async () => {
  // Censo de huérfanos de SCRUM-473 §2 y §5. Un cobro que desaparece de una pantalla de dinero es
  // peor que uno mal etiquetado: el profesional cuenta lo que ve.
  const HUERFANOS = ['bank', 'mp', 'bizum', 'desconocido', 'SCTinst', 'card:', '', null, 42];
  for (const h of HUERFANOS) {
    assert.equal(rotuloDeMetodo(h), COBROS_SIN_METODO.rotulo,
      `🔴 «${String(h)}» se lee «${rotuloDeMetodo(h)}» en vez de «${COBROS_SIN_METODO.rotulo}».`);
    assert.equal(cuboDeMetodo(h), COBROS_SIN_METODO.clave,
      `🔴 «${String(h)}» se cuela en el cubo «${cuboDeMetodo(h)}»: el profesional lo contaría como ` +
      'un método que no es.');
  }

  // Y siguen EN LA LISTA: no se cae ninguna fila.
  const datos = ['bank', 'mp', null, 'card:'].map((m, i) => cobro(i + 1, m));
  const b = cargarDashboard(RAIZ, { red: redNormal(datos) });
  const r = await pintarVista(b, 'renderCobrosView');
  assert.equal(r.error, null, `🔴 la vista revienta: ${r.error && r.error.message}`);
  assert.equal(filas(r.contenedor), datos.length,
    `🔴 SE HAN PERDIDO COBROS: ${filas(r.contenedor)} filas de ${datos.length}. Un cobro que ` +
    'desaparece de una pantalla de dinero es la mentira por omisión que este bloque persigue.');
});

test('SCRUM-481 · 🔴 NUNCA se pinta «tarjeta · » colgando, ni la cadena vacía, ni el valor crudo', () => {
  const CORPUS = [...COBROS_METODOS.flatMap((c) => c.casa), 'card:', 'transfer:', ':stripe', ':',
    'card:stripe', 'card:revolut', 'bank', '', '   ', null, undefined, 42, {}];
  for (const v of CORPUS) {
    const r = rotuloDeMetodo(v);
    assert.equal(typeof r, 'string', `🔴 «${String(v)}» produce ${typeof r}, no un rótulo.`);
    assert.notEqual(r.trim(), '', `🔴 «${String(v)}» produce la cadena VACÍA: la celda queda muda.`);
    assert.doesNotMatch(r, /·\s*$/,
      `🔴 «${String(v)}» produce «${r}»: un separador colgando sin nada detrás. La microcopy ` +
      'aprobada lo prohíbe expresamente.');
    assert.doesNotMatch(r, /:/,
      `🔴 «${String(v)}» produce «${r}», que lleva el «:» del valor de la base dentro.`);
  }
});

test('SCRUM-481 · 🔴 SUELO: si la partición resuelve a un cubo SIN rótulo, no se cae al valor crudo', () => {
  // 🔴 ESTE TEST SE AÑADIÓ PORQUE LA MUTACIÓN NO DABA ROJO. Cambiando el suelo por
  // `return String(metodo)` —o sea, «si no sé el rótulo, enseña el valor de la base por si
  // acaso»— los 10 tests seguían VERDES: esa rama es defensiva y no la alcanza nadie en el flujo
  // normal, porque todo cubo de `COBROS_METODOS` tiene rótulo hoy.
  //
  // «Hoy» es la palabra. Se provoca la condición contra la que defiende —un cubo al que alguien
  // deja sin rótulo— en vez de declararla imposible. Un suelo que solo se declara no es un suelo.
  const cubo = COBROS_METODOS.find((c) => c.clave === 'card');
  const original = cubo.rotulo;
  try {
    delete cubo.rotulo;
    const r = rotuloDeMetodo('card:stripe');
    assert.equal(r, COBROS_SIN_METODO.rotulo,
      `🔴 con el cubo sin rótulo se pinta «${r}». Si eso es el valor de la base, el «por si acaso» ` +
      'le enseña `card:stripe` al profesional justo el día en que algo se rompió — que es el peor ' +
      'momento para hablarle en el idioma de la base. Y si es la cadena vacía, la celda queda muda.');
    assert.notEqual(r.trim(), '');
    assert.doesNotMatch(r, /card/i);
  } finally {
    cubo.rotulo = original;   // el array es compartido: dejarlo tocado envenenaría los de abajo
  }
  assert.equal(rotuloDeMetodo('card'), 'tarjeta', '🔴 el cubo no se ha restaurado: los demás tests medirían otra cosa.');
});

test('SCRUM-481 · una pasarela DESCONOCIDA no se inventa: se pinta solo el método', () => {
  // El conjunto de pasarelas es ABIERTO a propósito. Capitalizar por las bravas daría
  // «Mercadopago»; pintarla cruda sería el defecto de este ticket. Se pinta el método, que es
  // microcopy aprobada, y la grafía de la marca nueva se aprueba cuando llegue (va en la entrada).
  assert.equal(rotuloDeMetodo('transfer:revolut'), 'transferencia');
  assert.equal(rotuloDeMetodo('card:paypal'), 'tarjeta');
  assert.doesNotMatch(rotuloDeMetodo('card:paypal'), /paypal/i,
    '🔴 se pinta el nombre crudo de una pasarela cuya grafía no ha aprobado nadie.');
});

// ── 🔴 EL ROJO POR EL MECANISMO ──────────────────────────────────────────────────────────────

/** ¿La celda de MÉTODO recibe el valor crudo del cobro? Detector sobre el AST, no sobre el texto. */
function celdasQuePintanElValorCrudo(ruta, texto) {
  const sf = ts.createSourceFile(ruta, texto, ts.ScriptTarget.Latest, true);
  const out = [];
  (function rec(n) {
    // `<algo>.textContent = <expresión que lee `.metodo` de un objeto>`
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isPropertyAccessExpression(n.left) && n.left.name.text === 'textContent') {
      // 🔴 NO SE DESCIENDE DENTRO DE UNA LLAMADA, y ésa es toda la precisión del detector:
      // `rotuloDeMetodo(c.metodo)` también contiene `.metodo`, pero ahí el valor va DE PASO hacia
      // el rotulador. Lo que se persigue es que el crudo llegue a la celda: directo, con `||`
      // detrás o por un ternario. Sin esta línea el detector marca el arreglo y se silencia.
      let crudo = false;
      (function busca(x) {
        if (ts.isCallExpression(x)) return;
        if (ts.isPropertyAccessExpression(x) && x.name.text === 'metodo') crudo = true;
        ts.forEachChild(x, busca);
      })(n.right);
      if (crudo) out.push(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1);
    }
    ts.forEachChild(n, rec);
  })(sf);
  return out;
}

test('SCRUM-481 · 🔴 SUELO DEL DETECTOR: se autoprueba sobre fuente sintética antes de creerse su número', () => {
  // 🔴 REQUISITO NUEVO (12-ago-2026): una sesión vio su censo pasar de 4 a 0 al traer `main` —un
  // refactor CORRECTO de otro dejó ciego al guard sin tocarlo, y el guard contó cero. Así que
  // primero se demuestra que VE, y que DISCRIMINA.
  assert.deepEqual(
    celdasQuePintanElValorCrudo('s.js', 'function f(c){ var td={}; td.textContent = c.metodo; }'),
    [1], '🔴 el detector NO ve una celda pintando el valor crudo delante de sus narices.');
  assert.deepEqual(
    celdasQuePintanElValorCrudo('s.js', 'function f(c){ var td={}; td.textContent = c.metodo || "x"; }'),
    [1], '🔴 el detector se le escapa el valor crudo con un `||` detrás — que es como estaba escrito.');
  assert.deepEqual(
    celdasQuePintanElValorCrudo('s.js', 'function f(c){ var td={}; td.textContent = rotuloDeMetodo(c.metodo); }'),
    [], '🔴 el detector marca la llamada al rotulador. Un guard que salta con todo se silencia.');
  assert.deepEqual(
    celdasQuePintanElValorCrudo('s.js', 'function f(c){ var td={}; td.textContent = c.cliente; }'),
    [], '🔴 el detector marca celdas que no tienen nada que ver con el método.');
});

test('SCRUM-481 · 🔴 la pantalla NO le enseña el valor de la base al profesional', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, VISTA), 'utf8');
  const crudas = celdasQuePintanElValorCrudo(VISTA, fuente);
  assert.deepEqual(crudas, [],
    `🔴 LA PANTALLA LE ESTÁ ENSEÑANDO EL VALOR DE LA BASE DE DATOS AL PROFESIONAL.\n` +
    `  ${VISTA}, línea(s) ${crudas.join(', ')}: la celda pinta \`c.metodo\` en crudo — «card:stripe», ` +
    '«card»— mientras la pestaña de al lado dice «tarjeta». No es que «falte un rótulo»: es que la ' +
    'pantalla habla dos idiomas y uno de ellos no es para el profesional.\n' +
    '  El rótulo sale de `rotuloDeMetodo`, que deriva de la MISMA partición que el filtro.');
});

// ── QUE EL RÓTULO NO SE DUPLIQUE POR COMODIDAD ───────────────────────────────────────────────

test('SCRUM-481 · «no consta» tiene UN solo nombre en esta pantalla', () => {
  // Aquí vivía `metodoSinRegistrar: 'No registrado'` para la columna mientras la pestaña decía
  // «Método no registrado». Dos rótulos para el mismo hecho en la misma pantalla es este ticket en
  // miniatura, y por eso se retiró.
  const fuente = fs.readFileSync(path.join(RAIZ, VISTA), 'utf8');
  const literales = [...fuente.matchAll(/'((?:No|Método no) registrado)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(literales)], ['Método no registrado'],
    `🔴 hay más de un rótulo para «no consta» en la vista: ${JSON.stringify(literales)}. El de la ` +
    'columna y el de la pestaña tienen que ser el mismo, o vuelven a divergir.');
});
