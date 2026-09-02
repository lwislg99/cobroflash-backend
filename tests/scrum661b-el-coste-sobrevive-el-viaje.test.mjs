// tests/scrum661b-el-coste-sobrevive-el-viaje.test.mjs — SCRUM-661 (①②③ · alcanzabilidad)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL COSTE UNITARIO SOBREVIVE EL VIAJE ENTERO — Y CADA ESLABÓN SE EJECUTA, NO SE LEE.
//
// LA VÍCTIMA es de largo plazo: `Product.cost` es MUTABLE y no tiene histórico. El día que un
// fontanero actualice el coste de un material, se reescribe el pasado de todas las ventas que lo
// usaron. El margen real de una venta no sería recuperable ni en teoría — no es que no
// guardemos el margen: es que no guardaríamos el hecho del que se derivaría.
//
// 🔴 POR QUÉ ESTE FICHERO EXISTE, y no basta con «el esquema ya lo acepta»: que una puerta deje
// de borrar un campo NO prueba que el campo llegue. En SCRUM-661 se midió la cadena entera y
// estaba rota en dos sitios ANTES del esquema (`searchProducts` no devolvía `cost`, y la línea
// no lo enviaba); ensanchar el esquema entonces habría creado un campo que nadie rellena.
//
// Y la lección está fresca de ayer: un `includes(undefined)` daba `true` sobre un comportamiento
// que la vista ya no tenía. Un eslabón que se AFIRMA y no se EJECUTA es una promesa.
//
// LOS CINCO ESLABONES, en el orden del viaje:
//   ① el catálogo lo DEVUELVE ......... `searchProducts` lo selecciona          (AST)
//   ② la vista lo CAPTURA ............. `costeDeCatalogo`                       (EJECUTADA)
//   ③ la línea lo ENVÍA ............... `costeParaPayload` + su sitio de uso    (EJECUTADA)
//   ④ el esquema lo DEJA PASAR ........ `CreateQuoteSchema`                     (EJECUTADO)
//   ⑤ sobrevive al GUARDADO ........... `Quote.lines` es Json                   (round-trip)
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos, reglasQueOcultan, ocultoPorCss } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
const ts = require_('typescript');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

const VISTA = 'public/dashboard/js/quotesView.js';
const SERVICIO = 'src/modules/products/domain/products.service.ts';
const RUTA = 'src/modules/quotes/app/routes/quotes.routes.ts';

const { CreateQuoteSchema } = await import('../dist/core/validation/schemas.js');

/**
 * Extrae una función del fuente de la vista y la DEVUELVE EJECUTABLE.
 *
 * `quotesView.js` es una vista y no se puede importar desde `node:test`; la alternativa honesta
 * es sacar la declaración por AST y ejecutarla de verdad. Mismo procedimiento que `drenarMargen`
 * en SCRUM-598 — y por eso estas dos reglas se extrajeron a funciones puras: una regla enterrada
 * dentro de `selectItem` sólo se puede auditar leyendo, y leer no ejecuta.
 */
function funcionDeLaVista(nombre) {
  const src = leer(VISTA);
  const i = src.indexOf(`function ${nombre}(`);
  assert.ok(i > 0, `🔴 no encuentro \`${nombre}\` en \`${VISTA}\`.`);
  const sf = ts.createSourceFile('x.js', src.slice(i), ts.ScriptTarget.Latest, true);
  const fn = sf.statements[0];
  assert.ok(ts.isFunctionDeclaration(fn), `🔴 lo que hay en \`${nombre}\` no es una función.`);
  // eslint-disable-next-line no-new-func
  return new Function(`${fn.getText(sf)}; return ${nombre};`)();
}

/**
 * Las propiedades del `select` de `searchProducts`, por AST. Un comentario no es un nodo.
 *
 * 🔴 SE ACOTA AL CUERPO DE LA FUNCIÓN, y no es un detalle de estilo: la primera versión buscaba
 * el primer `select:` DEL FICHERO y cazaba el de `listProducts` (línea 56 de 5 que hay). Daba
 * rojo sobre un `cost` que sí estaba puesto — o sea que estaba midiendo otra función y no lo
 * decía. La población no es «el fichero»: es la función que se afirma.
 */
function seleccionDeSearchProducts(fuente) {
  const sf = ts.createSourceFile('products.service.ts', fuente, ts.ScriptTarget.Latest, true);
  const recorrer = (n, fn) => { fn(n); n.forEachChild((h) => recorrer(h, fn)); };

  let cuerpo = null;
  recorrer(sf, (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.name.text === 'searchProducts') cuerpo = n;
  });
  assert.ok(cuerpo, '🔴 CIEGO: no encuentro la función `searchProducts` en el fuente.');

  let claves = null;
  recorrer(cuerpo, (n) => {
    if (claves || !ts.isPropertyAssignment(n)) return;
    if (!ts.isIdentifier(n.name) || n.name.text !== 'select') return;
    if (!ts.isObjectLiteralExpression(n.initializer)) return;
    claves = n.initializer.properties
      .map((p) => (p.name && ts.isIdentifier(p.name) ? p.name.text : null))
      .filter(Boolean);
  });
  return claves;
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// ESLABÓN ① · EL CATÁLOGO LO DEVUELVE
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-661 · ① el catálogo DEVUELVE el coste (y el escáner sabe declararse ciego)', () => {
  const fuente = leer(SERVICIO);
  const claves = seleccionDeSearchProducts(fuente);

  // SUELO: sin población no hay veredicto. Un `select` que no se ve daría «no está `cost`» por
  // el mismo motivo por el que no ve nada, y eso es lo contrario de lo que significa.
  assert.ok(Array.isArray(claves) && claves.length >= 5,
    `🔴 ESCÁNER CIEGO sobre \`searchProducts\`: veo ${claves ? claves.length : 0} claves en su `
    + '`select`. No es que falte `cost`: es que no estoy mirando.');

  assert.ok(claves.includes('cost'),
    `🔴 \`searchProducts\` NO devuelve \`cost\`. Selecciona: ${claves.join(', ')}.\n`
    + '  Sin esto el front no tiene el dato que tendría que congelar en la línea, y todo lo que\n'
    + '  viene detrás —el campo, el envío y el esquema— se queda sin rellenar.');

  // 🔴 EL ROJO, por el mecanismo: se le quita al fuente EN MEMORIA y el detector cambia de
  // respuesta. Un detector que no sabe decir «no» no vigila nada.
  const sinCoste = fuente.replace(/\n\s*cost: true,/, '');
  assert.notEqual(sinCoste, fuente, '🔴 la mutación no ha tocado el fuente: no prueba nada.');
  assert.equal(seleccionDeSearchProducts(sinCoste).includes('cost'), false,
    '🔴 DETECTOR TAUTOLÓGICO: sigue diciendo que sí con `cost` quitado del `select`.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ESLABÓN ② · LA VISTA LO CAPTURA — la regla se EJECUTA
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-661 · ② la vista CAPTURA el coste del catálogo', () => {
  const capturar = funcionDeLaVista('costeDeCatalogo');
  // Llega como STRING, que es como Prisma serializa un `Decimal`.
  assert.equal(capturar('1234.56'), '1234.56');
  assert.equal(capturar(60), '60.00', 'se normaliza a dos decimales, como el precio del catálogo');
  assert.equal(capturar('60,5'), '60.50', 'la coma decimal es como se teclea aquí');
});

test('SCRUM-661 · 🔴 ② SIN COSTE SE VACÍA, y `Number(null)` es la trampa de este campo', () => {
  const capturar = funcionDeLaVista('costeDeCatalogo');
  // `Number(null)` es 0. Si el `null` no se atajara ANTES de convertir, un producto sin coste
  // —8 de 8 en desarrollo, medido en SCRUM-609— entraría en la línea como «costó cero».
  assert.equal(capturar(null), '', '🔴 un producto SIN coste ha escrito algo en la línea.');
  assert.equal(capturar(undefined), '');
  assert.equal(capturar(''), '');
  assert.equal(capturar('no soy un número'), '', '🔴 un coste ilegible ha inventado un número.');
  assert.equal(capturar(-5), '', '🔴 un coste negativo se ha colado.');
  // Y el caso que separa las dos ideas: coste CERO declarado sí se escribe.
  assert.equal(capturar(0), '0.00',
    '🔴 un producto con coste 0 DECLARADO tiene que escribir 0,00: eso sí es un hecho.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ESLABÓN ③ · LA LÍNEA LO ENVÍA
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-661 · ③ la línea ENVÍA el coste, y su ausencia NO viaja como cero', () => {
  const paraPayload = funcionDeLaVista('costeParaPayload');
  assert.deepEqual(paraPayload('1234.56'), { costeUnitario: 1234.56 });
  assert.deepEqual(paraPayload('60,5'), { costeUnitario: 60.5 });
  assert.deepEqual(paraPayload('0'), { costeUnitario: 0 }, 'cero DECLARADO sí viaja');

  // 🔴 LA MITAD QUE DECIDE: sin dato, la CLAVE no viaja. No `{ costeUnitario: 0 }`.
  for (const vacio of ['', '   ', null, undefined, 'abc', '-3']) {
    assert.deepEqual(paraPayload(vacio), {},
      `🔴 con «${vacio}» ha viajado una clave. «No se sabe» y «costó cero» tienen que llegar `
      + 'distintos, o el dato no sirve para calcular ningún margen.');
  }
});

test('SCRUM-661 · ③ MENCIONAR NO ES HACER: el payload USA la regla', () => {
  // Que `costeParaPayload` exista no prueba que nadie la llame. Sin esto, los casos de arriba
  // seguirían verdes con el campo desconectado del envío.
  const src = leer(VISTA);
  assert.match(src, /const costeDeLaLinea = costeParaPayload\(line\.costeInput && line\.costeInput\.value\);/,
    '🔴 el payload no calcula el coste de la línea con la regla que este fichero prueba.');
  assert.match(src, /\.\.\.costeDeLaLinea,/,
    '🔴 el resultado se calcula y NO se mete en el objeto que viaja: un cálculo sin destino.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ESLABÓN ④ · EL ESQUEMA LO DEJA PASAR — ejecutado de verdad
// ═════════════════════════════════════════════════════════════════════════════════════════
const PRESUPUESTO = (lines) => ({
  merchant_id: 1, customer_id: 1, currency: 'EUR', lines,
});
const LINEA = (extra = {}) => ({ concept: 'Mano de obra', qty: 2, price: 100, tax: 0.21, ...extra });

test('SCRUM-661 · ④ el esquema DEJA PASAR el coste — y sigue borrando lo que no declara', () => {
  const r = CreateQuoteSchema.parse(PRESUPUESTO([LINEA({ costeUnitario: 1234.56 })]));
  assert.equal(r.lines[0].costeUnitario, 1234.56,
    '🔴 `QuoteLineSchema` BORRA el coste: `z.object` quita las claves que no declara, así que el '
    + 'campo llegaría hasta la puerta y moriría ahí, en silencio.');

  // 🔴 EL CONTROL QUE DA VALOR AL DE ARRIBA: el coste pasa porque está DECLARADO, no porque zod
  // deje pasar cualquier cosa. Sin esto, el verde anterior no distinguiría las dos causas.
  const r2 = CreateQuoteSchema.parse(PRESUPUESTO([LINEA({ campoQueNadieHaDeclarado: 7 })]));
  assert.equal('campoQueNadieHaDeclarado' in r2.lines[0], false,
    '🔴 el esquema NO está borrando lo desconocido: entonces el caso de arriba no prueba que '
    + '`costeUnitario` esté declarado, sólo que zod es permisivo.');
});

test('SCRUM-661 · 🔴 ④ AUSENTE ≠ CERO al cruzar la puerta', () => {
  // Es la condición 2 del ticket, en el sitio donde se podría perder sin que se note: un
  // `.default(0)` en el esquema convertiría el silencio en un dato, y el dato sería falso.
  const r = CreateQuoteSchema.parse(PRESUPUESTO([LINEA()]));
  assert.equal('costeUnitario' in r.lines[0], false,
    '🔴 una línea SIN coste ha salido del esquema CON la clave. «No se guardaba entonces» tiene '
    + 'que leerse distinto de «costó cero», o el dato no vale para nada.');

  const cero = CreateQuoteSchema.parse(PRESUPUESTO([LINEA({ costeUnitario: 0 })]));
  assert.equal(cero.lines[0].costeUnitario, 0, '🔴 un cero DECLARADO se ha perdido.');
  // Y las dos cosas son distinguibles, que es todo el objetivo.
  assert.notDeepEqual(
    'costeUnitario' in r.lines[0], 'costeUnitario' in cero.lines[0],
    '🔴 ausente y cero son indistinguibles después del esquema.');
});

test('SCRUM-661 · ④ un coste NEGATIVO no entra, y un apartado no lleva coste', () => {
  assert.throws(() => CreateQuoteSchema.parse(PRESUPUESTO([LINEA({ costeUnitario: -1 })])),
    '🔴 un coste negativo ha entrado: no existe comprar algo por menos de nada.');
  // SCRUM-655: una cabecera es un título, no algo que se compre. Mismo trato que qty/price.
  assert.throws(
    () => CreateQuoteSchema.parse(PRESUPUESTO([{ concept: 'FONTANERÍA', apartado: true, costeUnitario: 10 }])),
    /apartado y con coste unitario/,
    '🔴 un apartado con coste ha pasado, o el mensaje no nombra el campo que sobra.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ESLABÓN ⑤ · SOBREVIVE AL GUARDADO
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-661 · ⑤ lo que valida el esquema es LO QUE SE GUARDA (y `lines` es Json)', () => {
  const ruta = leer(RUTA);
  // La cadena se une aquí: `canonicalLines` sale de `body.lines` —o sea, de lo que devolvió
  // zod— y es exactamente lo que se escribe en la columna. Si alguien metiera una copia por el
  // medio, el coste podría perderse entre la puerta y la base sin que nadie lo viera.
  assert.match(ruta, /canonicalLines = body\.lines!;/,
    '🔴 lo que se guarda ya no sale de las líneas validadas: hay que volver a medir la cadena.');
  assert.match(ruta, /lines: canonicalLines,/,
    '🔴 la columna `lines` ya no se escribe con las líneas validadas.');
});

test('SCRUM-661 · 🔴 EL VIAJE ENTERO, de punta a punta y sin cortar', () => {
  // Un producto del catálogo, tal y como lo devuelve `searchProducts` (Decimal → string).
  const productoDelCatalogo = { id: 7, name: 'Detector de humos', price: '1000.00', cost: '300.00' };

  // ② la vista lo captura en el campo visible de la línea…
  const enElCampo = funcionDeLaVista('costeDeCatalogo')(productoDelCatalogo.cost);
  assert.equal(enElCampo, '300.00');

  // ③ …la línea lo envía…
  const enElPayload = funcionDeLaVista('costeParaPayload')(enElCampo);
  assert.deepEqual(enElPayload, { costeUnitario: 300 });

  // ④ …el esquema lo deja pasar…
  const validado = CreateQuoteSchema.parse(PRESUPUESTO([LINEA(enElPayload)]));

  // ⑤ …y sobrevive al guardado. `Quote.lines` es `Json`: lo que va y vuelve de la columna pasa
  // por serialización, así que se hace el mismo viaje de ida y vuelta.
  const releido = JSON.parse(JSON.stringify(validado.lines));

  assert.equal(releido[0].costeUnitario, 300,
    '🔴 EL COSTE SE PIERDE EN EL VIAJE. Que el esquema deje de borrarlo no prueba que llegue: '
    + 'este caso es el único que recorre los cinco eslabones seguidos.');
  // Y el precio de venta sigue ahí: el margen real de esa venta es reconstruible.
  assert.equal(releido[0].price, 100);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONDICIÓN 2 · SE ESCRIBE HACIA DELANTE, NUNCA HACIA ATRÁS
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-661 · 🔴 HACIA DELANTE: el coste se captura AL ELEGIR, y en ningún otro sitio', () => {
  // Rellenar líneas ya escritas con el `Product.cost` de HOY fabricaría un hecho histórico
  // falso: diría que aquella venta costó lo que cuesta ahora. La única forma de que eso no pase
  // es que la captura viva en UN solo sitio — el momento en que el profesional elige.
  const src = leer(VISTA);
  const usos = src.split('costeDeCatalogo(').length - 1;
  assert.equal(usos, 2,
    `🔴 \`costeDeCatalogo\` se usa ${usos} veces (se esperan 2: su declaración y la llamada de `
    + '`selectItem`). Un tercer sitio es un camino nuevo por el que el coste se escribe sin que '
    + 'nadie elija nada, y ahí es donde se fabrica un pasado falso.');

  // Y el borrador NO reconstruye: restaura lo que se guardó, y si no se guardó nada, nada.
  assert.match(src, /costeUnitario: \(l\.costeInput && l\.costeInput\.value\) \|\| "",/,
    '🔴 el borrador ya no guarda el coste tal cual: si lo derivara de algo, un borrador viejo '
    + 'volvería con un coste que nadie escribió.');
  assert.match(src, /initial && initial\.costeUnitario != null && initial\.costeUnitario !== ""/,
    '🔴 al crear la línea el coste ya no sale de lo que traía: restaurar un borrador ANTERIOR a '
    + 'este campo podría inventar un número.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONDICIÓN 3 · SI NO ESTÁ DECIDIDO SI SE VE, NO SE ESCONDE (CONT-01 ②)
//
// 🔴 SE PINTA LA PANTALLA DE VERDAD. Que el campo esté en el fuente no prueba que se monte: la
// lección es de ayer mismo, cuando un `appendChild(markupTd)` sin su variable pasó `node --check`
// y reventaba la pantalla entera. `node --check` mira sintaxis; esto EJECUTA.
//
// Y se le pregunta al CSS, no sólo al DOM: un campo montado y escondido por una regla de hoja
// cumpliría «existe» y violaría la condición igual. El banco lee las hojas del índice desde
// SCRUM-666 y sabe contestar visible / oculto / CIEGO.
// ═════════════════════════════════════════════════════════════════════════════════════════

const REGLAS_CSS = reglasQueOcultan(RAIZ);

async function pantallaDePresupuestos() {
  const banco = cargarDashboard(RAIZ, { datos: {} });
  const r = await pintarVista(banco, 'renderQuotesView');
  return { ...r, body: banco.ctx.document.body };
}

/**
 * 🔴 HAY QUE PULSAR, Y ESTE TEST ME LO ENSEÑÓ EN ROJO.
 *
 * La primera versión buscaba el campo nada más pintar y no lo encontraba — y la conclusión fácil
 * habría sido «no se monta». Es falso: desde SCRUM-139 F4 el coste, el IVA y SUPLIDO viven en la
 * HOJA DE AJUSTES, que sólo entra en el DOM cuando el profesional pulsa el chip de la fila.
 * Un control que no pulsa dice «no existe» sobre algo que sí está: es un falso hallazgo, y
 * `scrum660` ya lo había dejado escrito para el selector de IVA.
 */
function abrirAjustesDeLaPrimeraLinea(r) {
  const chip = todos(r.contenedor).find((n) => String(n.className || '').includes('quote-line__ajustes'));
  assert.ok(chip, '🔴 SUELO: no encuentro el chip que abre la hoja de ajustes de la línea.');
  chip.disparar('click');
  return chip;
}

/** El campo «Coste» de la primera línea, buscado por su clase — con la hoja ya abierta. */
function campoCoste(r) {
  return todos(r.contenedor).concat(todos(r.body))
    .find((n) => String(n.className || '').includes('quote-line__coste'));
}

test('SCRUM-661 · SUELO: la pantalla de presupuestos PINTA (si no, lo de abajo no mide nada)', async () => {
  const r = await pantallaDePresupuestos();
  assert.equal(r.error, null,
    `🔴 la pantalla de presupuestos revienta: ${r.error && r.error.message}. Con la vista rota, `
    + '«no encuentro el campo» y «el campo no existe» son el mismo resultado.');
  assert.ok(r.nodos > 20,
    `🔴 ESCÁNER CIEGO: la vista pintó ${r.nodos} nodos. Una pantalla vacía y un escáner roto dan `
    + 'el mismo verde.');
});

test('SCRUM-661 · 🔴 ② EL CAMPO «Coste» SE MONTA DE VERDAD, con su input dentro', async () => {
  const r = await pantallaDePresupuestos();
  abrirAjustesDeLaPrimeraLinea(r);
  const campo = campoCoste(r);
  assert.ok(campo,
    '🔴 el campo «Coste» NO se monta en la pantalla. Que esté escrito en el fuente no prueba que '
    + 'llegue al DOM — y sin él, el coste que viaja al servidor sería un dato que el profesional '
    + 'no puede ni ver ni corregir, que es justo lo que CONT-01 ② prohíbe.');

  // El banco nombra la etiqueta `tagName` y en MAYÚSCULAS, como el DOM real.
  const input = todos(campo).find((n) => n.tagName === 'INPUT');
  assert.ok(input, '🔴 el campo «Coste» existe pero no tiene input: no se puede escribir nada, y '
    + 'un campo que no se puede escribir no cumple la mitad EDITABLE de CONT-01 ②.');
  assert.equal(input.type, 'number', '🔴 el coste no es un campo numérico.');
  assert.equal(input.disabled, false,
    '🔴 el campo del coste nace DESHABILITADO: se ve y no se puede corregir, que es justo la '
    + 'mitad que hace que la regla sirva de algo.');
});

test('SCRUM-661 · 🔴 ③ NO SE ESCONDE: ni por `hidden`, ni por estilo, ni por CSS', async () => {
  const r = await pantallaDePresupuestos();
  abrirAjustesDeLaPrimeraLinea(r);
  const campo = campoCoste(r);
  assert.ok(campo, '🔴 SUELO: sin el campo, este caso no puede decir si está escondido.');

  assert.notEqual(campo.hidden, true, '🔴 el campo del coste nace `hidden`.');
  const estilo = String((campo.style && campo.style.display) || '');
  assert.notEqual(estilo, 'none', '🔴 el campo del coste nace con `display:none`.');

  // 🔴 Y LO QUE NO SE VE DESDE EL DOM: una regla de las hojas del índice. `ocultoPorCss` contesta
  // visible / oculto / CIEGO — y un CIEGO NO se toma por un «visible».
  const v = ocultoPorCss(campo, REGLAS_CSS);
  assert.notEqual(v, 'ciego',
    '🔴 el lector de CSS se declara CIEGO sobre el campo del coste: no se puede afirmar que se ve.');
  assert.notEqual(v, true,
    '🔴 una regla de CSS esconde el campo del coste. Un dato invisible es un dato que nadie va a '
    + 'corregir y que sigue viajando (CONT-01 ②): si se decide que no se vea, se quita, no se tapa.');
});
