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
