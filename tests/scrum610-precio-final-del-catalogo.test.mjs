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
  // 🔴 TRES ANCLAS RETIRADAS POR SCRUM-598 (DOC-08). No se relaja nada: DESAPARECE SU CAUSA.
  // El doble margen que SCRUM-610 evitaba necesitaba un margen EN LA LÍNEA, y ese campo ya no
  // existe — no hay nada que se pueda aplicar dos veces. El margen vive en el catálogo
  // (CAT-01) desde donde el precio ya sale con él dentro.
  'tocar el precio a mano REESCRIBE la base': '  priceInput.dataset.pfBasePrice = String(n);',
  // 🔴 DOS ANCLAS MÁS RETIRADAS POR SCRUM-598 (DOC-08), y por la misma razón que las tres de
  // arriba: el documento recomponía el precio desde la base del catálogo y el margen de la línea.
  // Sin margen en la línea, esa recomposición sólo podía devolver el mismo número — así que el
  // precio escrito ES el que viaja, y no hay «base» y «final» que reconciliar.
  //
  // ⚠️ HALLAZGO DECLARADO, no arreglado aquí: `priceInput.dataset.pfBasePrice` se sigue ESCRIBIENDO
  // en cinco sitios y ya no lo lee nadie. Es estado muerto, y sacarlo es otro carril.
  'el DOCUMENTO usa el precio escrito': '        const finalPrice = safePrice;',
};

test('SCRUM-610 · SUELO: las piezas de la vista siguen donde el modelo las supone', () => {
  // 🔴 SUELO DEL SUELO: sin esto, vaciar `ANCLAS` dejaría el bucle sin iteraciones y el suelo
  // pasaría por no comprobar nada. Un cero de un instrumento vacío se lee como un verde.
  assert.equal(Object.keys(ANCLAS).length, 4,
    '🔴 el número de anclas ha cambiado. Eran 4 después de SCRUM-598 (DOC-08), que retiró las '
    + 'cinco del margen. Si se ha añadido o quitado alguna, hay que volver a mirar el modelo.');
  for (const [que, txt] of Object.entries(ANCLAS)) {
    assert.ok(VISTA.split(txt).length - 1 >= 1,
      `🔴 CIEGO: ya no existe «${que}» en \`quotesView.js\`. El modelo de abajo dejaría de medir la `
      + 'pantalla real, y un verde así no vale nada. Hay que volver a medir antes de tocar el test.');
  }
  // 🔴 Y QUE EL LECTOR DE ANCLAS SEPA DECIR «NO». Es el rojo que faltó el 2-sep-2026: preguntar
  // por una clave retirada devolvía `true` en silencio. Si esto dejara de reventar, el modelo
  // podría volver a simular una pantalla imaginaria sin que se entere nadie.
  assert.throws(() => reglaDeLaVista('ancla que nadie ha declarado'), /ANCLA INEXISTENTE/,
    '🔴 el lector de anclas contesta a una clave que no existe en vez de reventar.');
});

// ── El modelo, tal cual lo dicen las piezas ancladas ──────────────────────────────────────
const linea = (over = {}) => ({ precioVisible: '', base: '', seleccionando: false, ...over });

// 🔴 LAS REGLAS SE LEEN DE LA VISTA, NO SE COPIAN — y no es un adorno.
//
// La primera versión de este fichero llevaba el `markup = '0'` escrito a mano en el modelo. Al
// provocar el rojo se vio el problema: quitando el arreglo de `quotesView.js`, el test del doble
// margen SEGUÍA EN VERDE, porque el modelo lo ponía por su cuenta. Sólo caía el suelo. Un test que
// no puede fallar por el cambio que dice vigilar es decoración con forma de aserción.
//
// 🔴 Y EL ACCESO PASA POR AQUÍ POR UN ROJO MÍO, medido el 2-sep-2026 dentro de SCRUM-598:
// al retirar el ancla del margen quedó un `VISTA.includes(ANCLAS['<clave que ya no existe>'])`.
// La clave daba `undefined`, `includes(undefined)` busca la CADENA "undefined" — que aparece 14
// veces en `quotesView.js` — y la regla salía `true`. O sea que el modelo seguía poniendo el
// margen a cero simulando un comportamiento que la vista YA NO TIENE, y los dos casos que
// dependían de él pasaban sin tocar la pantalla. Una lectura silenciosa de un diccionario es
// una medición inventada: aquí revienta y dice cuál.
function reglaDeLaVista(clave) {
  if (!Object.prototype.hasOwnProperty.call(ANCLAS, clave)) {
    throw new Error(`🔴 ANCLA INEXISTENTE: «${clave}». El modelo está preguntando por una pieza `
      + 'que ya no se declara, y sin este aviso la respuesta sería un `includes(undefined)` que '
      + 'contesta que sí. Declárala en ANCLAS o quita la regla que la usa.');
  }
  return VISTA.includes(ANCLAS[clave]);
}

const PONE_EL_PRECIO = reglaDeLaVista('selectItem pinta el precio del catálogo');
const USA_EL_PRECIO_ESCRITO = reglaDeLaVista('el DOCUMENTO usa el precio escrito');

function elegirDelCatalogo(L, producto) {
  L.seleccionando = true;                       // `pfSelecting`: apaga el listener del precio
  if (producto.price != null && producto.price !== '') {
    const base = Number(producto.price);
    if (Number.isFinite(base)) {
      L.base = String(base);
      if (PONE_EL_PRECIO) L.precioVisible = String(base.toFixed(2));
    }
  }
  L.seleccionando = false;
  return L;
}

function escribirPrecioAMano(L, valor) {
  L.precioVisible = valor;
  if (!L.seleccionando) {
    const n = Number(String(valor).replace(',', '.').trim());
    // `pfBasePrice`. La vista lo SIGUE escribiendo y ya no lo lee nadie — es el estado muerto
    // que este fichero declara arriba. Se modela porque la pantalla lo hace, no porque sirva.
    L.base = (Number.isFinite(n) && n >= 0) ? String(n) : '';
  }
  return L;
}

/**
 * El precio unitario que acaba EN EL DOCUMENTO.
 *
 * Desde SCRUM-598 la vista NO recompone nada: `const finalPrice = safePrice;`. El modelo lo
 * DERIVA de esa ancla en vez de copiarla, así que si la vista volviera a recomponer, esto se
 * declara ciego en lugar de seguir midiendo una pantalla que ya no existe.
 */
function precioEnElDocumento(L) {
  if (!USA_EL_PRECIO_ESCRITO) {
    throw new Error('🔴 CIEGO: la vista ha dejado de usar el precio escrito (`finalPrice = '
      + 'safePrice`). Este modelo describía otra pantalla: hay que volver a medirla.');
  }
  const p = parseFloat(String(L.precioVisible).replace(',', '.'));
  return Number.isFinite(p) ? p : 0;
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
test('SCRUM-610 · 🔴 EL DOBLE MARGEN YA NO ES POSIBLE: un `markup` viejo no toca el precio', () => {
  // SCRUM-598 (DOC-08) retiró el margen del documento, así que la protección de SCRUM-610 —poner
  // el margen a CERO al elegir— NO se relaja: desaparece su causa. Este caso la fija por el otro
  // lado, que es el que queda medible aquí: aunque una línea llegue con la clave puesta, el
  // precio que va al documento es el escrito, y no se multiplica por nada.
  //
  // Lo que hace con esa clave un borrador VIEJO —incorporarla al precio y borrarla, para que la
  // línea no BAJE de precio sola— se prueba EJECUTANDO el drenaje en
  // `scrum598-el-margen-sale-del-documento.test.mjs`. Aquí sólo se fija que no MULTIPLIQUE.
  const L = elegirDelCatalogo(linea({ markup: '20' }), PRODUCTO);
  assert.equal(precioEnElDocumento(L), 121,
    '🔴 DOBLE MARGEN: 121 € del catálogo (que ya llevan su 21 % dentro) multiplicados otra vez por '
    + '1,20 = 145,20 €. El profesional cobraría un margen que no ha decidido, sobre un precio que '
    + 'creía cerrado.');
});

test('SCRUM-610 · ✅ RETIRADO POR SCRUM-598: ya no existe «margen puesto DESPUÉS de elegir»', () => {
  // Este caso era la otra mitad del de arriba: sin él, quitar el doble margen se habría leído como
  // «el margen ya no funciona». Después de DOC-08 no hay margen que poner en la línea —el campo no
  // existe—, así que su SUJETO ha desaparecido; no se ha bajado ningún umbral.
  //
  // Que el margen no pueda volver al documento por ninguna de las tres puertas lo vigila
  // `scrum598-el-margen-sale-del-documento.test.mjs`. Que el margen SIGA EXISTIENDO en su casa
  // —el catálogo— lo vigila F9 en `scrum600-un-solo-front-documento.test.mjs`.
  //
  // Y esto no es una aserción de adorno: si la vista volviera a recomponer el precio, el sujeto
  // de este caso habría vuelto y hay que devolverlo a la vida en vez de dejarlo retirado.
  assert.equal(reglaDeLaVista('el DOCUMENTO usa el precio escrito'), true,
    '🔴 la vista ha vuelto a recomponer el precio en vez de usar el escrito. Este caso está '
    + 'retirado porque su sujeto no existe: si vuelve, hay que volver a mirarlo.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ✅ EL CONTROL NEGATIVO, QUE ES EL QUE DECIDE
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-610 · ✅ una línea escrita A MANO, sin tocar el catálogo, se comporta como hoy', () => {
  assert.equal(precioEnElDocumento(escribirPrecioAMano(linea(), '80')), 80,
    '🔴 una línea a mano ha cambiado de precio: el catálogo no puede afectar a quien no lo usa');
  // SCRUM-598 · aquí iba «y con margen a mano se aplica, como antes» (80 + 10 % = 88). Se retira
  // con el resto: en el documento ya no hay margen que escribir a mano, así que ese 88 no lo
  // puede producir ninguna pantalla y afirmarlo sería describir una que no existe.
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
  // SCRUM-598 · la marca del medio era el cero del margen, que ya no existe. La FRONTERA que
  // este caso vigila —que lo del precio no se meta en el bloque del IVA (S1, DOC-16)— se sigue
  // comprobando con las dos marcas que quedan.
  const k = VISTA.indexOf('  if (typeof it.vat !== "undefined"');
  assert.ok(i !== -1 && k !== -1, '🔴 CIEGO: falta alguna de las dos marcas');
  assert.ok(i < k,
    '🔴 el cambio de SCRUM-610 ha salido del bloque del precio y se ha metido en el del IVA, que '
    + 'es de S1 (DOC-16). Eso convierte dos diffs separables en un conflicto.');
});
