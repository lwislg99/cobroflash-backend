// tests/scrum611-tipo-iva-elegible.test.mjs — SCRUM-611 (DOC-16)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL TIPO DE IVA DE LA LÍNEA SE ELIGE, NO SE TECLEA.
//
// CAT-01 sacó el IVA del producto, así que el tipo se fija en la LÍNEA. El 10 % es habitual en
// obras de renovación en vivienda y teclearlo cada vez es fricción.
//
// 🔴 LO QUE ESTE FICHERO PROTEGE NO ES EL SELECTOR: ES QUE NO SE PIERDA NADA AL PONERLO.
//
// Hoy el campo es texto libre y le llegan valores que NO son españoles:
//   · `products.routes.ts:47` estampa `locale.defaultVat` en el catálogo por gremio → 16, 18, 19
//     (MX, PE/CL, CO). Medido en SCRUM-647.
//   · el «IVA por defecto» del documento es otro campo LIBRE.
//   · las plantillas y la IA traen `tax` en fracción, sin acotar.
//
// Un selector CERRADO tendría que hacer algo con un 16 %, y cualquier cosa que no sea enseñarlo
// cambia el IVA de una línea sin que nadie lo pida. Eso es dinero, no maquetación.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
const tipos = require_(path.join(RAIZ, 'public/dashboard/js/tiposDeIva.js'));

const VISTA = path.join(RAIZ, 'public/dashboard/js/quotesView.js');
const desnudar = (src) => src.split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');

test('SCRUM-611 · SUELO: el módulo carga y la lista se puede EJECUTAR', () => {
  assert.deepEqual(tipos.TIPOS_ES, [21, 10, 4, 0]);
  assert.equal(typeof tipos.opciones, 'function');
});

test('SCRUM-611 · el selector ofrece los cuatro tipos, el 21 primero', () => {
  assert.deepEqual(tipos.opciones(21), [21, 10, 4, 0]);
  assert.deepEqual(tipos.opciones(10), [21, 10, 4, 0], 'un tipo YA de la lista no se duplica');
  assert.deepEqual(tipos.opciones(0), [21, 10, 4, 0]);
});

test('SCRUM-611 · 🔴 CONTROL NEGATIVO: un tipo QUE NO ES ESPAÑOL se conserva, no se ajusta', () => {
  // Éste es el caso que hace que poner el selector no cambie nada. 16 · 18 · 19 son los que
  // `locale.defaultVat` estampa hoy en el catálogo por gremio de MX, PE/CL y CO.
  for (const raro of [16, 18, 19, 7, 5.5]) {
    const op = tipos.opciones(raro);
    assert.ok(op.includes(raro),
      `🔴 el selector NO puede enseñar el ${raro} %: la línea perdería su tipo o se ajustaría a `
      + 'otro sin que nadie lo pida. Eso cambia el IVA de un documento.');
    for (const esp of tipos.TIPOS_ES) {
      assert.ok(op.includes(esp), `🔴 al añadir el ${raro} % se ha perdido el ${esp} %.`);
    }
  }
  // Y el orden sigue siendo descendente, con el raro en su sitio.
  assert.deepEqual(tipos.opciones(16), [21, 16, 10, 4, 0]);
});

test('SCRUM-611 · `normalizar` acepta lo que aceptaba el campo que sustituye', () => {
  assert.equal(tipos.normalizar('21'), 21);
  assert.equal(tipos.normalizar('10,5'), 10.5, 'el input admitía coma decimal; el selector también');
  assert.equal(tipos.normalizar(0), 0, '🔴 el 0 % es un tipo LEGÍTIMO, no «sin especificar»');
  assert.equal(tipos.normalizar(''), null);
  assert.equal(tipos.normalizar(null), null);
  assert.equal(tipos.normalizar('abc'), null);
  assert.equal(tipos.esEspanol(21), true);
  assert.equal(tipos.esEspanol(16), false);
});

test('SCRUM-611 · 🔴 la lista está en UN SOLO SITIO: la vista no la repite', () => {
  const limpio = desnudar(fs.readFileSync(VISTA, 'utf8'));
  // Suelo: que el desnudado no se haya comido la vista.
  assert.ok(limpio.includes('quote-line__vat'), '🔴 el desnudado se llevó la vista por delante.');

  // Una lista repetida en la vista es la que se olvidará de actualizar el día del IGIC.
  assert.equal(/\[\s*21\s*,\s*10\s*,\s*4\s*,\s*0\s*\]/.test(limpio), false,
    '🔴 los tipos vuelven a estar escritos en la vista. Viven en `tiposDeIva.js` para que el día '
    + 'que entre el IGIC (SCRUM-646) no haya que buscarlos en cinco sitios.');
});

test('SCRUM-611 · ⛔ NO se cablea `locale.defaultVat` como fuente de la lista', () => {
  // Está indexado por PAÍS y Canarias es `ES`: le daría 21 a un canario. Y además toma 0,16 ·
  // 0,18 · 0,19, que no son tipos españoles — o sea que ni como fuente sirve.
  const fuente = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/tiposDeIva.js'), 'utf8');
  const limpioFuente = desnudar(fuente);
  assert.equal(/defaultVat/.test(limpioFuente), false,
    '🔴 el selector se está alimentando de `locale.defaultVat`. Eso es SCRUM-646 y aquí metería '
    + 'el defecto por la puerta de atrás.');
  assert.ok(fuente.includes('defaultVat'), 'suelo: el comentario que lo prohíbe SÍ existe.');
});

test('SCRUM-611 · 🔴 el valor por defecto es EL DE HOY: la cascada no se ha tocado', () => {
  const limpio = desnudar(fs.readFileSync(VISTA, 'utf8'));
  // Las tres ramas, en su orden. Si alguna se cae, una línea que nadie toca dejaría de
  // comportarse como ahora — que es el control negativo del encargo.
  assert.match(limpio, /if \(initial && initial\.vat != null\)/, '🔴 se perdió la rama del `vat`.');
  assert.match(limpio, /else if \(initial && initial\.tax != null\)/, '🔴 se perdió la rama del `tax`.');
  assert.match(limpio, /fieldVatDefault\.input\.value \|\| "21"/, '🔴 se perdió el defecto del documento.');

  // Y los SEIS sitios que escriben el campo pasan por `ponerValor`, que es lo que garantiza que
  // un valor fuera de la lista se AÑADA en vez de dejar el selector en blanco.
  assert.equal(/vatInput\.value\s*=/.test(limpio), false,
    '🔴 alguien vuelve a escribir `vatInput.value` a pelo. Con un `<select>`, un valor que no sea '
    + 'una opción deja el control EN BLANCO — y la línea pierde su tipo en silencio.');
});

test('SCRUM-611 · el selector avisa por `change`, y sigue oyendo `input`', () => {
  const limpio = desnudar(fs.readFileSync(VISTA, 'utf8'));
  assert.match(limpio, /vatInput\.addEventListener\("change", onChange\)/,
    '🔴 un `<select>` avisa por `change`: sin ese oyente, elegir un tipo no recalcularía el total.');
  assert.match(limpio, /vatInput\.addEventListener\("input", onChange\)/,
    '🔴 hay código que dispara `input` a mano (el autocompletado de producto); quitarle ese oyente '
    + 'lo dejaría sin recalcular sin que nada fallara.');
});

// ⚠️ LO QUE ESTE FICHERO NO CUBRE, DECLARADO: que el desplegable se PINTE y que elegir con el
// ratón recalcule el total necesita navegador. Aquí se ejecuta la regla de las opciones y se
// comprueba que la vista la invoca en los sitios que hacen falta.
