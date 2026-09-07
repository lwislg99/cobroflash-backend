// tests/scrum801-el-respaldo-de-la-n.test.mjs — SCRUM-801
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ESTO NO VIGILA EL RESPALDO: VIGILA EL INSTRUMENTO QUE LO MIDE.
//
// SCRUM-801 es un ticket de MEDIR. Su producto es `scripts/censo-respaldo-de-la-n.mjs`, que
// contesta en cuántas pantallas la «N» abre la cotización rápida en vez de la creación de esa
// pantalla. Un censo que nadie ejecuta en la tanda se pudre en silencio: el día que `app.js`
// cambie de forma, `censar()` devolverá una lista más corta y **nadie se enterará**.
//
// Así que aquí se sujeta lo único que puede sujetarse sin decidir nada de producto:
//
//   · que el censo NO se quede ciego (que encuentre el `switch`, la población y los destinos);
//   · que siga viendo las DOS que se midieron con TECLADO REAL cayendo al respaldo;
//   · que siga viendo las SEIS que sí tienen destino;
//   · que sepa declararse ciego cuando lo está, en vez de devolver una lista corta;
//   · y el punto ciego CONCRETO que se destapó midiendo: la forma `(window.renderX || renderX)()`.
//
// ⛔ LO QUE ESTE FICHERO **NO** HACE, a propósito: no fija en 21 el número de pantallas que caen.
//    Ese número es el hallazgo que el asesor tiene que decidir qué hacer con él; clavarlo aquí
//    convertiría una medición en una regla que nadie ha aprobado.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { censar, etiquetasDeVista, destinosRegistrados, MINIMO_ETIQUETAS, CONTROL_POSITIVO }
  from '../scripts/censo-respaldo-de-la-n.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(RAIZ, 'public/dashboard/js/app.js');

// ═══ ① EL SUELO — sin esto, cualquier lista de abajo podría ser el vacío ═════════════════════

test('SCRUM-801 · SUELO: el censo VE la población y los destinos, y no se queda ciego', () => {
  const c = censar();
  assert.equal(c.motivo, null, `🔴 CIEGO: ${c.motivo}. Ninguna cifra de este ticket vale nada si esto falla.`);
  assert.ok(c.etiquetas.length >= MINIMO_ETIQUETAS,
    `🔴 sólo ${c.etiquetas.length} etiquetas de vista. La población sale del \`switch (view)\` de `
    + '`renderView`: si ha encogido, o el árbol perdió media aplicación o el censo dejó de leerla.');
  assert.ok(c.claves.size >= 4,
    `🔴 sólo ${c.claves.size} destinos registrados y hay seis listas que registran el suyo.`);
  assert.equal(c.conDestino.length + c.alRespaldo.length,
    c.etiquetas.filter((e) => e.legible).length,
    '🔴 las dos mitades no suman la población: hay etiquetas que no están ni en una ni en otra.');
});

// ═══ ② CONTROL POSITIVO — lo que se midió con TECLADO REAL sigue viéndose ════════════════════

test('SCRUM-801 · ✅ CONTROL POSITIVO: las dos medidas con teclado real siguen cayendo', () => {
  const c = censar();
  for (const k of CONTROL_POSITIVO) {
    assert.ok(c.alRespaldo.some((e) => e.clave === k),
      `🔴 «${k}» ya no sale entre las que caen al respaldo. Con teclado real (SCRUM-769) se midió `
      + 'que ahí la «N» abre la cotización rápida. O alguien le ha dado destino —y entonces esto '
      + 'hay que reescribirlo diciendo quién lo decidió— o el censo ha dejado de ver.');
  }
});

test('SCRUM-801 · ✅ CONTROL POSITIVO: las SEIS con destino siguen teniéndolo, por nombre', () => {
  const c = censar();
  for (const k of ['quotes-list', 'customers', 'invoices', 'albaranes', 'jobs', 'expenses']) {
    assert.ok(c.conDestino.some((e) => e.clave === k),
      `🔴 «${k}» ha perdido su destino: la «N» ha dejado de abrir su creación y cae al respaldo. `
      + 'Un ticket de medir no puede quitarle el atajo a nadie.');
  }
});

// ═══ ③ QUE SEPA DECLARARSE CIEGO — un cero por no mirar es la peor cifra ═════════════════════

test('SCRUM-801 · 🔴 sin el `switch (view)` se declara CIEGO, no devuelve una lista corta', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum801-'));
  try {
    const falso = path.join(dir, 'app.js');
    fs.writeFileSync(falso, 'function otraCosa(view) { switch (view) { case "home": break; } }\n');
    assert.equal(etiquetasDeVista(falso), null,
      '🔴 dice haber encontrado el `switch` de `renderView` en un fichero que no lo tiene.');
    const c = censar({ ficheroApp: falso });
    assert.match(String(c.motivo), /switch/,
      '🔴 no se declara ciego: devolvería un censo construido sobre una población que no existe.');
    assert.equal(c.alRespaldo, undefined,
      '🔴 un censo ciego NO puede traer lista: alguien la imprimiría como si fuera un dato.');

    // ✅ Y EL CONTRASTE, para que este test no pase por «todo le parece ciego»: con el app.js
    // de verdad, el mismo camino SÍ encuentra la población.
    assert.ok(etiquetasDeVista(APP).etiquetas.length >= MINIMO_ETIQUETAS,
      '🔴 el detector dice ciego también sobre el árbol real: entonces no discrimina nada.');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ═══ ④ EL PUNTO CIEGO QUE SE DESTAPÓ MIDIENDO ═══════════════════════════════════════════════

test('SCRUM-801 · 🔴 lee `(window.renderX || renderX)(…)`, que es como se pintan dos vistas', () => {
  // ═════════════════════════════════════════════════════════════════════════════════════════
  // Este test existe porque el instrumento YA SE EQUIVOCÓ aquí, en esta misma sesión.
  //
  // `pintaDe` miraba la EXPRESIÓN LLAMADA. Y dos `case` invocan así:
  //
  //     (window.renderProductsView || renderProductsView)(viewContainer);
  //
  // El texto del callee es el paréntesis entero, no casa con `render*View`, y Productos y
  // Proveedores salían como **«no pinta ninguna vista»** — falso, y con forma de dato. Se
  // arregló recogiendo IDENTIFICADORES dentro del `case`, que ve las dos formas.
  //
  // Las dos son justo las pantallas del control positivo, así que el fallo era invisible: la
  // lista principal las nombraba igual.
  // ═════════════════════════════════════════════════════════════════════════════════════════
  const c = censar();
  for (const [clave, vista] of [['products', 'renderProductsView'], ['providers', 'renderProvidersView']]) {
    const e = c.alRespaldo.find((x) => x.clave === clave);
    assert.ok(e, `🔴 «${clave}» no está en el censo.`);
    assert.deepEqual(e.pinta, [vista],
      `🔴 el censo ha vuelto a perder de vista qué pinta «${clave}». Su \`case\` la invoca como `
      + '`(window.X || X)(…)`: mirando la expresión llamada, no casa.');
  }
});

test('SCRUM-801 · el ALIAS se enseña en vez de contarse como una pantalla más', () => {
  // `case 'operarios': return renderView('team', options);` — `renderView` vuelve a entrar y
  // `appState.view` acaba valiendo `team`, así que el despacho NUNCA lo ve valiendo `operarios`.
  const c = censar();
  const op = c.etiquetas.find((e) => e.clave === 'operarios');
  assert.ok(op, '🔴 la etiqueta `operarios` ha desaparecido del `switch`.');
  assert.equal(op.alias, 'team',
    '🔴 el censo ya no ve que `operarios` reentra como `team`: la contaría como una pantalla más.');
});

// ═══ ⑤ LOS DESTINOS SE LEEN POR AST, NO POR TEXTO ═══════════════════════════════════════════

test('SCRUM-801 · una MENCIÓN de `registrar` en un comentario no cuenta como destino', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum801b-'));
  try {
    fs.writeFileSync(path.join(dir, 'falsa.js'),
      '// aquí NO se llama a window.atajoNuevo.registrar("inventada", () => {});\n'
      + 'const s = \'window.atajoNuevo.registrar("tampoco", fn)\';\n'
      + 'window.atajoNuevo.registrar("siQueVale", function () {});\n');
    const { claves, noLegibles } = destinosRegistrados(dir);
    assert.deepEqual([...claves.keys()], ['siQueVale'],
      `🔴 el lector de destinos cuenta menciones: ${JSON.stringify([...claves.keys()])}. Un \`grep\` `
      + 'habría dado tres, y dos de ellas no se ejecutan jamás.');
    assert.deepEqual(noLegibles, []);

    // ✅ Y una clave CALCULADA se declara, no se pierde.
    fs.writeFileSync(path.join(dir, 'calculada.js'),
      'window.atajoNuevo.registrar(cual, function () {});\n');
    const seg = destinosRegistrados(dir);
    assert.equal(seg.noLegibles.length, 1,
      '🔴 un `registrar` con clave calculada ha desaparecido en vez de declararse: sería un '
      + 'destino que existe y que este instrumento cuenta como ausente.');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LAS MUTACIONES QUE ME TUMBAN (contrato de SCRUM-745)
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El punto ciego, restaurado tal cual estaba cuando falló.
    fichero: 'scripts/censo-respaldo-de-la-n.mjs',
    de: '    if (!ts.isIdentifier(n)) return;\n    const t = n.text;',
    a: '    if (!ts.isCallExpression(n)) return;\n    const t = n.expression.getText(sf).replace(/^window\\./, \'\');',
    cae: 'lee `(window.renderX || renderX)(…)`, que es como se pintan dos vistas',
  },
  {
    // Se le da destino a Productos: el control positivo del instrumento tiene que caer.
    fichero: 'public/dashboard/js/productsView.js',
    de: '    const createBtn = form.querySelector("#pf-create-product");',
    a: '    const createBtn = form.querySelector("#pf-create-product");\n    if (window.atajoNuevo) window.atajoNuevo.registrar("products", () => createBtn.click());',
    cae: 'CONTROL POSITIVO: las dos medidas con teclado real siguen cayendo',
  },
  {
    // ═══════════════════════════════════════════════════════════════════════════════════════
    // 🔴 LA SEGUNDA VERSIÓN DE ESTA MUTACIÓN. La primera decía:
    //
    //     de: "…|| e.name.text !== 'registrar') return;"   a: '…isPropertyAccessExpression(e)) return;'
    //
    // y el meta-guard me sacó **MUDO**: quitar esa comprobación no cambia nada sobre un fichero
    // donde la única llamada que cuelga de `atajoNuevo` YA es `registrar`. La mutación no imitaba
    // el defecto que este test vigila —contar MENCIONES—, así que el test seguía verde con razón.
    //
    // La que sí lo imita es ésta: se le añade al lector un barrido POR TEXTO, que es exactamente
    // la implementación alternativa contra la que el test existe.
    //
    // 🔴 Y UNA SEGUNDA LECCIÓN, del mismo sitio: `a` tiene que ser UN literal. La escribí como
    // concatenación (`'…' + "…"`), y el lector por AST del meta-guard sólo lee literales: la
    // declaración entera se caía a `incompletas` y desaparecía del censo sin ruido.
    // ═══════════════════════════════════════════════════════════════════════════════════════
    fichero: 'scripts/censo-respaldo-de-la-n.mjs',
    de: '    const sf = fuente(f);\n    recorrer(sf, (n) => {',
    a: '    const sf = fuente(f);\n    for (const m of sf.text.matchAll(/atajoNuevo\\.registrar\\(\\s*.(\\w+)./g)) {\n      if (!claves.has(m[1])) claves.set(m[1], []);\n      claves.get(m[1]).push(nombre);\n    }\n    recorrer(sf, (n) => {',
    cae: 'una MENCIÓN de `registrar` en un comentario no cuenta como destino',
  },
];
