// tests/scrum610-precio-final-del-catalogo.test.mjs — SCRUM-610 (CAT-02)
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// AL ELEGIR DEL CATÁLOGO, LA LÍNEA TRAE EL PRECIO FINAL — Y SIGUE SIENDO MODIFICABLE
//
// Es la contrapartida de DOC-08: el margen desaparece del documento porque ya viene resuelto
// desde el catálogo. Y viene resuelto de verdad, no por convenio: **CAT-01 (SCRUM-609) NO guarda
// el margen, lo DERIVA de coste y precio** (`margenCatalogo.margenDesde`). O sea que
// `Product.price` ES el precio final.
//
// 🔴 LO QUE SE MIDIÓ ANTES DE TOCAR NADA, y cambió el tamaño del ticket: cuatro de los cinco
// casos del control YA pasaban. Lo que fallaba era uno que no estaba en la lista —**el doble
// margen**— y sólo aparece cuando la línea llega con margen puesto de antes.
//
// ⚠️ EL MODELO DE LA PANTALLA VA ANCLADO A LA FUENTE POR BYTES. `quotesView.js` es una vista y no
// se puede importar desde `node:test`; la alternativa honesta es reproducir sus reglas y ATARLAS
// a las líneas exactas, para que un cambio en la vista deje el test CIEGO en vez de dejarlo
// midiendo una pantalla que ya no existe. Mismo procedimiento que SCRUM-632.
// ─────────────────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const VISTA = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/quotesView.js'), 'utf8');

/** Las piezas de la vista de las que depende este fichero, con su texto EXACTO. */
const ANCLAS = {
  'selectItem guarda la base del catálogo': '    priceInput.dataset.pfBasePrice = String(base);',
  'selectItem pinta el precio del catálogo': '    priceInput.value = String(base.toFixed(2));',
  '🔴 SCRUM-610: el margen se pone a CERO al elegir': '    if (markupInput) markupInput.value = "0";',
  'el margen de una línea nueva nace en 0': 'markupInput.value = initial && initial.markup != null ? initial.markup : "0";',
  'el margen VIAJA en el borrador': '        markup: l.markupInput ? l.markupInput.value : "0",',
  'tocar el precio a mano REESCRIBE la base': '  priceInput.dataset.pfBasePrice = String(n);',
  'el DOCUMENTO parte de la base, no de lo escrito': '  const baseRaw = String(line.priceInput.dataset.pfBasePrice || "").trim();',
  'el DOCUMENTO multiplica por el margen': '  finalPrice = safeBase * (1 + safeMarkup / 100);',
};

test('SCRUM-610 · SUELO: las ocho piezas de la vista siguen donde el modelo las supone', () => {
  for (const [que, txt] of Object.entries(ANCLAS)) {
    assert.ok(VISTA.split(txt).length - 1 >= 1,
      `🔴 CIEGO: ya no existe «${que}» en \`quotesView.js\`. El modelo de abajo dejaría de medir la `
      + 'pantalla real, y un verde así no vale nada. Hay que volver a medir antes de tocar el test.');
  }
});

// ── El modelo, tal cual lo dicen las piezas ancladas ──────────────────────────────────────
const linea = (over = {}) => ({ precioVisible: '', base: '', markup: '0', seleccionando: false, ...over });

// 🔴 ESTAS DOS REGLAS SE LEEN DE LA VISTA, NO SE COPIAN — y no es un adorno.
//
// La primera versión de este fichero llevaba el `markup = '0'` escrito a mano en el modelo. Al
// provocar el rojo se vio el problema: quitando el arreglo de `quotesView.js`, el test del doble
// margen SEGUÍA EN VERDE, porque el modelo lo ponía por su cuenta. Sólo caía el suelo. Un test que
// no puede fallar por el cambio que dice vigilar es decoración con forma de aserción.
//
// Derivándolas de la fuente, el modelo hace lo que hace la pantalla: si alguien quita la línea,
// el modelo deja de ponerlo y el caso del doble margen CAE, que es su trabajo.
const PONE_EL_PRECIO = VISTA.includes(ANCLAS['selectItem pinta el precio del catálogo']);
const PONE_MARGEN_A_CERO = VISTA.includes(ANCLAS['🔴 SCRUM-610: el margen se pone a CERO al elegir']);

function elegirDelCatalogo(L, producto) {
  L.seleccionando = true;                       // `pfSelecting`: apaga el listener del precio
  if (producto.price != null && producto.price !== '') {
    const base = Number(producto.price);
    if (Number.isFinite(base)) {
      L.base = String(base);
      if (PONE_EL_PRECIO) L.precioVisible = String(base.toFixed(2));
      if (PONE_MARGEN_A_CERO) L.markup = '0';   // SCRUM-610
    }
  }
  L.seleccionando = false;
  return L;
}

function escribirPrecioAMano(L, valor) {
  L.precioVisible = valor;
  if (!L.seleccionando) {
    const n = Number(String(valor).replace(',', '.').trim());
    L.base = (Number.isFinite(n) && n >= 0) ? String(n) : '';
  }
  return L;
}

/** El precio unitario que acaba EN EL DOCUMENTO. */
function precioEnElDocumento(L) {
  const p = parseFloat(String(L.precioVisible).replace(',', '.'));
  const safePrice = Number.isFinite(p) ? p : 0;
  const mk = parseFloat(String(L.markup || '0').replace(',', '.'));
  const safeMarkup = Number.isFinite(mk) ? mk : 0;
  const baseRaw = String(L.base || '').trim();
  const base = baseRaw ? Number(baseRaw) : safePrice;
  const safeBase = Number.isFinite(base) ? base : 0;
  return safeBase * (1 + safeMarkup / 100);
}

// Un PRODUCTO tiene coste y precio (margen derivado: 21 %). Un SERVICIO sólo precio.
const PRODUCTO = { id: 1, name: 'Llave de paso', cost: 100, price: 121, itemKind: 'PRODUCTO' };
const SERVICIO = { id: 2, name: 'Hora de taller', cost: null, price: 45, itemKind: 'SERVICIO' };

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL CONTROL DEL ENCARGO
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-610 · 🔴 un PRODUCTO del catálogo trae el PRECIO FINAL', () => {
  const L = elegirDelCatalogo(linea(), PRODUCTO);
  assert.equal(L.precioVisible, '121.00', '🔴 la línea no muestra el precio del catálogo');
  assert.equal(precioEnElDocumento(L), 121,
    '🔴 el documento no lleva el precio final del catálogo. El margen ya está DENTRO de ese '
    + 'precio (CAT-01 lo deriva de coste y precio), así que 121 es el número, no una base.');
});

test('SCRUM-610 · 🔴 un SERVICIO también, y sin pedir coste', () => {
  const L = elegirDelCatalogo(linea(), SERVICIO);
  assert.equal(SERVICIO.cost, null, 'el fixture debe ser un servicio SIN coste, o no prueba lo que dice');
  assert.equal(precioEnElDocumento(L), 45,
    '🔴 un servicio sin coste no llega al documento con su precio. Un servicio sólo tiene precio: '
    + 'si el relleno dependiera del coste, se rompería justo aquí.');
});

test('SCRUM-610 · 🔴 el precio SIGUE SIENDO MODIFICABLE: lo escrito a mano manda', () => {
  const L = escribirPrecioAMano(elegirDelCatalogo(linea(), PRODUCTO), '150');
  assert.equal(precioEnElDocumento(L), 150,
    '🔴 el precio escrito a mano se ha perdido. El documento parte de `pfBasePrice`, así que si el '
    + 'listener del precio no la reescribiera, el catálogo pisaría al profesional.');
  // Y con decimales en coma, que es como se escribe aquí.
  assert.equal(precioEnElDocumento(escribirPrecioAMano(elegirDelCatalogo(linea(), PRODUCTO), '99,50')), 99.5);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL CASO QUE NO ESTABA EN LA LISTA Y ERA EL ÚNICO ROTO: EL DOBLE MARGEN
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-610 · 🔴 una línea que YA traía margen no lo aplica sobre el precio del catálogo', () => {
  // No es un caso raro: el margen se GUARDA en el autoguardado del borrador y viaja en las
  // PLANTILLAS, así que una línea puede llegar con margen puesto antes de que nadie elija nada.
  const L = elegirDelCatalogo(linea({ markup: '20' }), PRODUCTO);
  assert.equal(L.markup, '0', '🔴 el margen de la línea no se ha puesto a cero al elegir');
  assert.equal(precioEnElDocumento(L), 121,
    '🔴 DOBLE MARGEN: 121 € del catálogo (que ya llevan su 21 % dentro) multiplicados otra vez por '
    + '1,20 = 145,20 €. El profesional cobraría un margen que no ha decidido, sobre un precio que '
    + 'creía cerrado.');
});

test('SCRUM-610 · ✅ pero el margen puesto DESPUÉS de elegir SÍ se respeta', () => {
  // La otra mitad, sin la cual lo de arriba sería «el margen ya no funciona». Elegir del catálogo
  // pone el contador a cero; lo que el profesional decida a partir de ahí es suyo.
  const L = elegirDelCatalogo(linea(), PRODUCTO);
  L.markup = '20';
  assert.equal(precioEnElDocumento(L), 145.2,
    '🔴 el margen añadido a conciencia después de elegir se ha perdido: eso no es quitar el doble '
    + 'margen, es quitar el margen.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ✅ EL CONTROL NEGATIVO, QUE ES EL QUE DECIDE
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-610 · ✅ una línea escrita A MANO, sin tocar el catálogo, se comporta como hoy', () => {
  assert.equal(precioEnElDocumento(escribirPrecioAMano(linea(), '80')), 80,
    '🔴 una línea a mano ha cambiado de precio: el catálogo no puede afectar a quien no lo usa');
  // Y con margen a mano, que es el uso de siempre: se aplica, como antes.
  const conMargen = escribirPrecioAMano(linea({ markup: '10' }), '80');
  assert.equal(precioEnElDocumento(conMargen), 88,
    '🔴 el margen de una línea a mano ha dejado de aplicarse. Este ticket toca el relleno DESDE EL '
    + 'CATÁLOGO; lo demás tiene que quedar exactamente igual.');
  // Un precio ilegible no inventa un número.
  assert.equal(precioEnElDocumento(escribirPrecioAMano(linea(), 'abc')), 0);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// FRONTERA · este ticket toca el PRECIO, no el IVA ni el pie
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-610 · el cambio se limita al bloque del PRECIO dentro de `selectItem`', () => {
  // S1 lleva el tipo de IVA de la línea (DOC-16) y S3 la cabecera y las observaciones (DOC-03),
  // los tres en la misma pantalla. Que el `if (markupInput)` viva dentro del bloque del precio
  // —y no cerca del IVA— es lo que mantiene los diffs separables.
  const i = VISTA.indexOf('    priceInput.dataset.pfBasePrice = String(base);');
  const j = VISTA.indexOf('    if (markupInput) markupInput.value = "0";');
  const k = VISTA.indexOf('  if (typeof it.vat !== "undefined"');
  assert.ok(i !== -1 && j !== -1 && k !== -1, '🔴 CIEGO: falta alguna de las tres marcas');
  assert.ok(i < j && j < k,
    '🔴 el cambio de SCRUM-610 ha salido del bloque del precio y se ha metido en el del IVA, que '
    + 'es de S1 (DOC-16). Eso convierte dos diffs separables en un conflicto.');
});
