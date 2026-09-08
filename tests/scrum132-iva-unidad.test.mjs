// SCRUM-132 — el "IVA por defecto" del presupuesto SIEMBRA, pero nunca PISA.
//
// EL BUG: el IVA de una línea llega en DOS unidades según su origen —
//   · `vat` = PORCENTAJE (21)  → borrador de localStorage, autocompletado de producto
//   · `tax` = FRACCIÓN (0.21)  → plantillas y líneas sugeridas por la IA (contrato del backend)
// …y `addLine` solo leía `vat`. Con las otras tres rutas, `initial.vat` era `undefined`, caía al
// `else` y el IVA por defecto PISABA el IVA real de la línea. Efecto visible: guardar una
// plantilla al 10 % y reabrirla la devolvía al 21 %.
//
// POR QUÉ IMPORTA MÁS DE LO QUE PARECE: el dato corrupto NO es latente. Se congela al crear el
// presupuesto y viaja `Quote.lines` → `Invoice.lines` al aceptar, alimentando el desglose del
// 303 y la cuota de la huella VeriFactu el día que se encienda `INVOICING_ES_ENABLED`. El flag
// protege el DOCUMENTO fiscal, no el DATO.
//
// ⚠️ LÍMITE HONESTO: esto es un guard ESTRUCTURAL sobre el fuente, no una prueba de
// comportamiento. `quotesView.js` es vanilla de navegador (sin bundler, usa `document`), así que
// no se puede importar en node y ejecutar `addLine`. Lo que se verifica es que la forma del
// código que arregla el bug SIGUE AHÍ — no que el navegador la ejecute bien. La verificación de
// comportamiento es manual (o vía el harness de puppeteer de scripts/e2e-critico.mjs).
//
// SIN GATE: solo lee un fichero. No toca BD ni levanta servidor.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const VISTA = path.join(REPO, 'public', 'dashboard', 'js', 'quotesView.js');
const src = fs.readFileSync(VISTA, 'utf8');

test('SCRUM-132: addLine acepta las DOS unidades (vat en % y tax en fracción)', () => {
  // Sin la rama de `tax`, las líneas de plantilla y de la IA vuelven a caer al IVA por defecto.
  assert.match(src, /initial\s*&&\s*initial\.vat\s*!=\s*null/,
    'addLine debe seguir leyendo `initial.vat` (porcentaje: borrador y producto)');
  assert.match(src, /initial\s*&&\s*initial\.tax\s*!=\s*null/,
    'addLine debe leer `initial.tax` (fracción: plantillas e IA) — si no, el general las PISA');
});

test('SCRUM-132: la conversión fracción→porcentaje pasa por el helper (nada de `* 100` suelto)', () => {
  assert.match(src, /function fractionToPercent/, 'debe existir el helper de conversión');

  // `0.21 * 100` da 21.000000000000004 en coma flotante: por eso la conversión se centraliza.
  // Se prohíbe la forma cruda `String(<algo> * 100)`, que es como estaba escrita antes.
  // `[\w.]+` y no `\w+`: la forma real que había era `String(v * 100)` pero la que reintroduce
  // el bug con más facilidad es `String(initial.tax * 100)` — con punto. Con `\w+` este guard
  // pasaba en verde sobre esa segunda forma; lo cazó probarlo en rojo, no la revisión.
  const crudas = src.match(/String\(\s*[\w.]+\s*\*\s*100\s*\)/g) || [];
  assert.deepEqual(crudas, [],
    `conversión cruda a porcentaje sin pasar por fractionToPercent: ${crudas.join(', ')}\n` +
    'Escribe `String(fractionToPercent(x))` — si no, el campo muestra 21.000000000000004.');
});

test('SCRUM-132: ningún call-site colapsa "sin IVA" en "0 %" con `|| 0`', () => {
  // `tax: (l.tax || 0)` convertía `undefined` (sin IVA guardado) en 0, y desde SCRUM-65 el 0 %
  // es un tipo LEGÍTIMO (21/10/4/0): los dos casos dejaban de ser distinguibles, así que una
  // línea sin IVA se emitía al 0 % en vez de heredar el defecto.
  const colapsos = src.match(/tax:\s*\(?\s*\w+\.tax\s*\|\|\s*0\s*\)?/g) || [];
  assert.deepEqual(colapsos, [],
    `patrón que colapsa "sin especificar" en "0 %": ${colapsos.join(', ')}\n` +
    'Pasa `l.tax` crudo: `undefined` debe llegar a addLine para que herede el IVA por defecto.');
});

test('SCRUM-132: el borrador repone el IVA por defecto ANTES de crear las líneas (SCRUM-134)', () => {
  // Precedencia de estado: `addLine` usa `fieldVatDefault` como fallback, así que si las líneas
  // se crean antes de reponerlo heredan el defecto de la pantalla recién montada, no el
  // guardado. Lo arregló SCRUM-134; se vigila aquí porque es la MISMA invariante de este ticket
  // (el general siembra con el valor correcto) y quien reordene loadDraft debe verlo caer.
  // SCRUM-660 · el ancla cambió de FORMA, no de invariante: reponer el defecto pasó de
  // `fieldVatDefault.input.value = …` a `tiposDeIva.ponerValor(…)`, porque el campo ya no es un
  // input libre sino un `<select>` y asignar `.value` a pelo perdería un tipo que no esté en la
  // lista. **El ORDEN que este test vigila se sigue comprobando igual**, que es lo suyo.
  const iDefecto = src.indexOf('if (d.vatDefault) window.tiposDeIva.ponerValor(fieldVatDefault.input, d.vatDefault);');
  // SCRUM-598 · el ancla cambió de FORMA otra vez, no de invariante: las líneas del borrador
  // pasan por `drenarMargen` para incorporar al precio el margen de un borrador viejo. **El
  // ORDEN que este test vigila se sigue comprobando igual**, que es lo suyo.
  const iLineas = src.indexOf('d.lines.forEach((l) => addLine(drenarMargen(l)));');
  assert.ok(iDefecto > 0 && iLineas > 0, 'no se localizan las dos líneas de loadDraft');
  assert.ok(iDefecto < iLineas,
    'el IVA por defecto debe reponerse ANTES del forEach que crea las líneas del borrador');
});
