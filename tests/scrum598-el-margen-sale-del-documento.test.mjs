// tests/scrum598-el-margen-sale-del-documento.test.mjs — SCRUM-598 (DOC-08)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL MARGEN SALE DEL DOCUMENTO, Y NO PUEDE VOLVER POR NINGUNA DE LAS TRES PUERTAS.
//
// LA VÍCTIMA: el chip gris de la línea decía «IVA 21 %» y escondía dentro DOS cosas —el IVA y el
// margen—, así que la etiqueta que el profesional leía no describía lo que contenía. Y el margen
// es información SUYA, no de su cliente, viviendo en el documento que le enseña al cliente.
//
// Decisión del fundador (24-ago-2026). El margen pasa a vivir sólo en el catálogo (CAT-01).
//
// 🔴 EL ROJO TIENE QUE DECIR CUÁL DE LAS TRES, no «algo del margen ha vuelto». Dentro de tres
// meses, quien lo vea saltar necesita el sitio, no el susto.
//
// ⚠️ CONTROL NEGATIVO EXPLÍCITO: quitar SUPLIDO del modal NO puede hacer caer esto. Un guard que
// se queja de cambios legítimos se acaba desactivando, y entonces no protege de nada.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
// SCRUM-598 · F9 no se retira, se MUDA: su detector nuevo vive en el censo, y aquí se prueba en
// rojo. Ver el bloque «F9 · LA MUDANZA» al final de este fichero.
import { F9_EN_EL_CATALOGO, faltaEnF9 } from './_censo-dos-fronts.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = path.join(RAIZ, 'public/dashboard/js/quotesView.js');
const require_ = createRequire(import.meta.url);
const ts = require_('typescript');

/** El fuente SIN comentarios: este fichero nombra «margen» muchas veces y no puede cazarse a sí mismo. */
function desnudar(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');
}

/**
 * LAS TRES PUERTAS, cada una con su detector y su nombre.
 *
 * Se declaran por SEPARADO a propósito: un único «¿aparece la palabra margen?» diría que algo ha
 * vuelto sin decir dónde, y ese rojo no sirve.
 */
const PUERTAS = Object.freeze({
  'el campo «Margen %» del modal de ajustes de línea':
    (limpio) => /campoLinea\(\s*["']Margen/.test(limpio) || /\bmarkupInput\b/.test(limpio),
  'el control de margen de la fila (el chip gris)':
    // El chip lo compone `resumenAjustes(marcada, iva, margen)`. Si el tercer argumento deja de
    // ser 0, el chip vuelve a contener dos cosas y a mentir.
    (limpio) => {
      // ⚠️ La clase `[^)]` NO sirve aquí y me costó un rojo: el primer argumento lleva paréntesis
      // (`...checked)`), así que no puede atravesarlo y la llamada nunca casaba — el detector daba
      // «ha vuelto» sobre un fichero limpio. Se busca acotado desde la llamada hasta `safeVat`.
      const m = /resumenAjustes\([\s\S]{0,240}?safeVat,\s*([^,)\s]+)/.exec(limpio);
      return !m || m[1].trim() !== '0';
    },
  'la línea «Margen» del bloque de totales':
    (limpio) => /quote-totals__apoyo[^`]*>Margen</.test(limpio) || /\btextoMargen\(/.test(limpio),
});

test('SCRUM-598 · SUELO: el desnudado quita prosa y NO se come el código', () => {
  const crudo = fs.readFileSync(VISTA, 'utf8');
  const limpio = desnudar(crudo);
  assert.ok(crudo.includes('SCRUM-598'), 'suelo: los comentarios de este ticket existen.');
  assert.ok(!limpio.includes('SCRUM-598'), '🔴 el desnudado NO está quitando comentarios: este '
    + 'guard se cazaría a sí mismo en la prosa que explica la prohibición.');
  assert.ok(limpio.includes('resumenAjustes('), '🔴 el desnudado se ha comido el código.');
  assert.ok(limpio.includes('quote-totals__apoyo'), '🔴 el desnudado se ha comido los totales.');
});

test('SCRUM-598 · 🔴 EL MARGEN NO ESTÁ EN NINGUNA DE LAS TRES PUERTAS', () => {
  const limpio = desnudar(fs.readFileSync(VISTA, 'utf8'));
  const vueltas = Object.entries(PUERTAS).filter(([, detecta]) => detecta(limpio)).map(([n]) => n);

  assert.deepEqual(vueltas, [],
    '🔴 EL MARGEN HA VUELTO AL DOCUMENTO, y por aquí:\n'
    + vueltas.map((v) => '   · ' + v).join('\n')
    + '\n\n  El margen es información del PROFESIONAL, no de su cliente, y el documento es lo que\n'
    + '  le enseña al cliente. Vive en el catálogo desde CAT-01. Decisión del fundador (24-ago-2026).');
});

test('SCRUM-598 · 🔴 EL ROJO NOMBRA LA PUERTA — probado con las tres', () => {
  // «Un rojo que dice “algo del margen ha vuelto” sin decir dónde no sirve dentro de tres meses.»
  // Se le da a cada detector un fuente de mentira con SU defecto y se comprueba que sólo salta él.
  const base = fs.readFileSync(VISTA, 'utf8');
  const casos = [
    ['el campo «Margen %» del modal de ajustes de línea',
      desnudar(base) + '\nconst markupTd = campoLinea("Margen %", "quote-line__markup");\n'],
    ['el control de margen de la fila (el chip gris)',
      desnudar(base).replace(/(resumenAjustes\([\s\S]{0,240}?safeVat,\s*)0/, '$1safeMarkup')],
    ['la línea «Margen» del bloque de totales',
      desnudar(base) + '\nconst t = textoMargen({ importe: 1 }, (n) => n);\n'],
  ];

  for (const [nombre, fuente] of casos) {
    const saltan = Object.entries(PUERTAS).filter(([, d]) => d(fuente)).map(([n]) => n);
    assert.ok(saltan.includes(nombre),
      `🔴 el detector de «${nombre}» NO ve su propio defecto: es decorativo.`);
    assert.deepEqual(saltan, [nombre],
      `🔴 al reintroducir «${nombre}» han saltado también: ${saltan.filter((x) => x !== nombre).join(', ')}. `
      + 'Un rojo que acusa de más no dice dónde mirar.');
  }
});

test('SCRUM-598 · 🔴 CONTROL NEGATIVO: quitar SUPLIDO no hace caer esto', () => {
  // No es este ticket (F8 se queda intacto). Si el guard se quejara de un cambio legítimo, alguien
  // lo desactivaría — y entonces no protegería del margen tampoco.
  const sinSuplido = desnudar(fs.readFileSync(VISTA, 'utf8'))
    .split('\n').filter((l) => !/suplido/i.test(l)).join('\n');
  const saltan = Object.entries(PUERTAS).filter(([, d]) => d(sinSuplido)).map(([n]) => n);
  assert.deepEqual(saltan, [],
    '🔴 el guard se queja de que se toque SUPLIDO, que no es lo suyo: ' + saltan.join(', '));
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL DRENAJE · lo que exige CONT-01
// ═════════════════════════════════════════════════════════════════════════════════════════

/** `drenarMargen` vive dentro del render; se extrae del fuente y se EJECUTA. */
function drenarMargen() {
  const src = fs.readFileSync(VISTA, 'utf8');
  const i = src.indexOf('function drenarMargen(l) {');
  assert.ok(i > 0, '🔴 no encuentro `drenarMargen` en el fuente.');
  const sf = ts.createSourceFile('x.js', src.slice(i), ts.ScriptTarget.Latest, true);
  const fn = sf.statements[0];
  assert.ok(ts.isFunctionDeclaration(fn), '🔴 lo que hay ahí no es la función.');
  // eslint-disable-next-line no-new-func
  return new Function(fn.getText(sf) + '; return drenarMargen;')();
}

test('SCRUM-598 · 🔴 el borrador VIEJO no pierde precio: el margen se INCORPORA', () => {
  const drenar = drenarMargen();
  // MEDIDO: el borrador guarda el precio BASE y el margen aparte, y el final se recomponía al
  // enviar. Ignorar el margen haría que la línea pasara de 120 a 100 sin que nadie lo pida.
  const r = drenar({ concept: 'Mano de obra', qty: '2', price: '100', markup: '20', tax: '21' });
  assert.equal(r.price, '120.00', '🔴 el precio final del borrador ha cambiado al restaurarlo.');
  assert.equal('markup' in r, false, '🔴 la clave del margen sobrevive: un dato invisible que sigue viajando.');
  assert.equal(r.concept, 'Mano de obra', 'lo demás de la línea no se toca');
  assert.equal(r.tax, '21');
});

test('SCRUM-598 · 🔴 sin margen que incorporar, la línea NO se toca', () => {
  const drenar = drenarMargen();
  // Control negativo del drenaje: un borrador sin margen sale idéntico. Si el drenaje «arreglara»
  // líneas que no lo necesitan, estaría cambiando precios por su cuenta.
  const sinClave = { concept: 'x', price: '50', tax: '21' };
  assert.deepEqual(drenar(sinClave), sinClave);
  assert.equal(drenar({ concept: 'x', price: '50', markup: '0' }).price, '50');
  // Y un margen ILEGIBLE no inventa un precio: se quita la clave y el precio queda como estaba.
  const raro = drenar({ concept: 'x', price: '50', markup: 'abc' });
  assert.equal(raro.price, '50', '🔴 un margen ilegible ha movido el precio.');
  assert.equal('markup' in raro, false);
  // Ni un precio ilegible.
  assert.equal(drenar({ concept: 'x', price: 'abc', markup: '20' }).price, 'abc');
});

test('SCRUM-598 · el restaurador LLAMA al drenaje — mencionar no es hacer', () => {
  const limpio = desnudar(fs.readFileSync(VISTA, 'utf8'));
  assert.match(limpio, /d\.lines\.forEach\(\(l\) => addLine\(drenarMargen\(l\)\)\)/,
    '🔴 `drenarMargen` existe pero el restaurador no la llama: que una función exista no prueba '
    + 'que alguien la invoque, y el borrador viejo seguiría perdiendo su precio.');
  assert.equal(/markup:\s*l\.markupInput/.test(limpio), false,
    '🔴 el borrador vuelve a GUARDAR el margen.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 F9 · LA MUDANZA, PROBADA EN ROJO
//
// Retirar el margen del documento dejó sin ancla a F9 —«coste y margen existen en el
// producto»—, que el encargo de SCRUM-600 declara INNEGOCIABLE. El detector viejo medía esa
// capacidad por su DIRECCIÓN dentro de `quotesView.js`, y la dirección caducó: con CAT-01
// (SCRUM-609) coste y margen se mudaron al CATÁLOGO.
//
// 🔴 PERO ESE DETECTOR ERA LO QUE HACÍA INNEGOCIABLE A F9. Retirarlo sin sustituto convierte una
// regla en una costumbre: mañana alguien quita el margen del catálogo, no salta nada, y nos
// enteramos cuando se queje un profesional. Así que F9 no se retira: se RE-ANCLA en su casa
// nueva (`F9_EN_EL_CATALOGO` / `faltaEnF9`, en `_censo-dos-fronts.mjs`).
//
// Aquí va la mitad que decide si eso vale: **el rojo**. Un detector que nunca se ha visto caer
// es una promesa. Se le rompe el catálogo A PROPÓSITO, pieza por pieza, y se exige que CAIGA y
// que DIGA CUÁL. Y sus dos controles negativos, porque un guard que se queja de cambios
// legítimos acaba desactivado — y entonces tampoco protege del que importa.
// ═════════════════════════════════════════════════════════════════════════════════════════

const FUENTES_DEL_CATALOGO = () => ({
  vista: fs.readFileSync(path.join(RAIZ, F9_EN_EL_CATALOGO.ficheros.vista), 'utf8'),
  aritmetica: fs.readFileSync(path.join(RAIZ, F9_EN_EL_CATALOGO.ficheros.aritmetica), 'utf8'),
});

/**
 * Rompe una pieza del catálogo EN MEMORIA (nunca en disco) y comprueba que de verdad ha roto
 * algo: si el trozo no aparece exactamente donde se dice, la mutación no está probando nada y
 * el verde que venga detrás no vale. Es la post-condición que le falta a casi toda mutación.
 */
function mutar(fuentes, cual, de, a = '', { veces = 1 } = {}) {
  const antes = fuentes[cual];
  const cuantas = antes.split(de).length - 1;
  assert.equal(cuantas, veces,
    `🔴 MUTACIÓN NO FIABLE: «${de}» aparece ${cuantas} veces en ${cual} y se esperaban ${veces}. `
    + 'Estaría quitando otra cosa, o ninguna.');
  const despues = antes.split(de).join(a);
  assert.notEqual(despues, antes, `🔴 la mutación no ha cambiado ${cual}: no se prueba nada.`);
  return { ...fuentes, [cual]: despues };
}

/**
 * LAS NUEVE PIEZAS DE F9, cada una con su defecto y con el trozo del rojo que tiene que nombrarla.
 *
 * No se compara la frase entera a propósito: lo que este caso vigila es que el rojo DIGA CUÁL, y
 * copiar aquí el texto completo sólo ataría el test a la redacción del mensaje.
 */
const PIEZAS_DE_F9 = [
  ['el campo Coste del ALTA', /«Coste».*ALTA/,
    (f) => mutar(f, 'vista', '<input name="cost" type="number" step="0.01" min="0" placeholder="60.00" />')],
  ['el campo Margen % del ALTA', /«Margen %».*ALTA/,
    (f) => mutar(f, 'vista', '<input name="margen" type="number" step="0.01" placeholder="70" />')],
  ['el campo Coste de la EDICIÓN', /«Coste».*EDICIÓN/,
    (f) => mutar(f, 'vista', '<input name="cost" type="number" step="0.01" min="0"/>')],
  ['el campo Margen % de la EDICIÓN', /«Margen %».*EDICIÓN/,
    (f) => mutar(f, 'vista', '<input name="margen" type="number" step="0.01"/>')],
  ['el coste deja de VIAJAR al servidor', /COSTE en lo que se ENV[IÍ]A al servidor/,
    (f) => mutar(f, 'vista', "cost: costRaw === '' ? null : Number(costRaw),")],
  ['el cableado del margen mientras se teclea', /margenCatalogo\.autocompletar/,
    (f) => mutar(f, 'vista', 'window.margenCatalogo.autocompletar(', 'yaNoSeCablea(')],
  ['el margen derivado al abrir un producto', /margenCatalogo\.margenDesde/,
    (f) => mutar(f, 'vista', 'window.margenCatalogo.margenDesde(it.cost, it.price)', 'null')],
  ['la aritmética del margen', /margenCatalogo\.precioDesde/,
    (f) => mutar(f, 'aritmetica', '    precioDesde: precioDesde,\n')],
  // 🔴 LA NOVENA NACE DE UN ROJO QUE ME ENCONTRÉ INTERROGANDO AL DETECTOR, no viéndolo verde:
  // envolví el campo «Coste» en un comentario de HTML y contestó «no falta nada». El árbol
  // protege de los comentarios de JS —no son nodos— pero un `<!-- -->` va DENTRO del literal y
  // para el AST sigue siendo texto pintado. Desactivar es la forma barata de perder una función.
  ['el campo Coste COMENTADO en HTML (que no es lo mismo que borrado, y se ve igual)', /«Coste».*ALTA/,
    (f) => mutar(f, 'vista', '<input name="cost" type="number" step="0.01" min="0" placeholder="60.00" />',
      '<!-- <input name="cost" type="number" step="0.01" min="0" placeholder="60.00" /> -->')],
];

test('SCRUM-598 · 🔴 F9 RE-ANCLADO: el detector CAE y NOMBRA qué falta — probado con las nueve piezas', () => {
  const base = FUENTES_DEL_CATALOGO();

  // SUELO del rojo: si el catálogo ya estuviera roto, cada mutación de abajo daría más de un
  // hallazgo y el «y sólo él» dejaría de significar nada.
  assert.deepEqual(faltaEnF9(base), [],
    '🔴 F9 ya está roto ANTES de mutar nada: este caso no puede medir lo que dice que mide.');

  for (const [defecto, nombraA, romper] of PIEZAS_DE_F9) {
    const falta = faltaEnF9(romper(base));

    assert.equal(falta.length, 1,
      `🔴 al quitar «${defecto}» del catálogo el detector ha dado ${falta.length} hallazgos:\n`
      + falta.map((f) => '   · ' + f).join('\n')
      + '\n  Con 0 es DECORATIVO: no ve su propio defecto y F9 se ha quedado sin guard.'
      + '\n  Con más de 1 acusa de más, y un rojo que acusa de más no dice dónde mirar.');

    assert.match(falta[0], nombraA,
      `🔴 al quitar «${defecto}» el rojo NO lo nombra. Dice: «${falta[0]}».\n`
      + '  Dentro de tres meses, quien lo vea saltar necesita el sitio, no el susto.');
  }
});

test('SCRUM-598 · 🔴 CONTROL NEGATIVO de F9: que el margen SALGA DEL DOCUMENTO no lo hace caer', () => {
  // Es EL control de este ticket: DOC-08 quita el margen del documento a propósito, y el guard
  // que vigila F9 no puede quejarse justo del cambio que se ha decidido hacer.
  const limpio = desnudar(fs.readFileSync(VISTA, 'utf8'));
  const abiertas = Object.entries(PUERTAS).filter(([, d]) => d(limpio)).map(([n]) => n);
  assert.deepEqual(abiertas, [],
    'suelo: este caso sólo dice algo si el margen YA está fuera del documento');

  assert.deepEqual(faltaEnF9(FUENTES_DEL_CATALOGO()), [],
    '🔴 F9 cae con el margen fuera del documento. Son dos sitios distintos: el margen sale del '
    + 'DOCUMENTO (DOC-08) y sigue en el CATÁLOGO (CAT-01). Un detector que no los distingue '
    + 'obligaría a elegir entre hacer este ticket y conservar F9.');

  // Y la razón por la que no puede caer, dicha por el propio detector: el documento NO está en
  // su población. Si algún día lo estuviera, este caso dejaría de ser un control.
  assert.equal(Object.values(F9_EN_EL_CATALOGO.ficheros).includes('public/dashboard/js/quotesView.js'),
    false, '🔴 F9 ha vuelto a mirar al documento: es la dirección vieja, la que ya caducó una vez.');
});

test('SCRUM-598 · 🔴 CONTROL NEGATIVO de F9: un cambio LEGÍTIMO del catálogo tampoco lo hace caer', () => {
  // El proveedor no es F9. Si el guard se quejara de tocarlo, alguien lo desactivaría — y
  // entonces tampoco protegería del coste ni del margen, que es lo suyo.
  const sinProveedor = mutar(FUENTES_DEL_CATALOGO(), 'vista',
    '<select name="providerId">', '<select name="otraCosa">', { veces: 2 });
  assert.deepEqual(faltaEnF9(sinProveedor), [],
    '🔴 F9 se queja de que se toque el PROVEEDOR, que no es lo suyo.');
});

test('SCRUM-598 · SUELO: el detector de F9 se declara CIEGO en vez de contestar «falta todo»', () => {
  // Un cero de un instrumento roto se lee igual que un catálogo sin campos, y son la noticia
  // contraria. Así que sin población no hay veredicto: revienta y lo dice.
  const base = FUENTES_DEL_CATALOGO();

  assert.throws(() => faltaEnF9({ vista: 'const nada = 1;', aritmetica: base.aritmetica }),
    /ESCANER CIEGO[\s\S]*bloque de HTML/,
    '🔴 sin ver un solo bloque de HTML, el detector contesta en vez de declararse ciego.');

  // Y con HTML pero sin un solo objeto de producto: el instrumento ve la pantalla y no la forma.
  assert.throws(() => faltaEnF9({
    vista: 'x.innerHTML = `<input name="cost"/><input name="margen"/>`;',
    aritmetica: base.aritmetica,
  }), /ESCANER CIEGO[\s\S]*objeto de producto/,
    '🔴 sin un solo objeto de producto, el detector contesta en vez de declararse ciego.');
});
