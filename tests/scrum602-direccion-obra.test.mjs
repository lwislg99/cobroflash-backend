// tests/scrum602-direccion-obra.test.mjs — SCRUM-602 (DOC-12)
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LA DIRECCIÓN DE LA OBRA: que llegue al papel, que NO se invente, y que no haya dos verdades.
//
// El profesional trabaja en un sitio y factura a otro. Este ticket le da al PRESUPUESTO lo que el
// albarán ya tenía desde SCRUM-300, y por eso lo que más se vigila aquí no es que funcione: es
// que NO se pase de listo. El suelo del albarán, adoptado literal por el asesor el 4-sep-2026:
//
//     «si no hay dirección de obra se deja VACÍO; la sugerencia entra sólo como PLACEHOLDER,
//      porque una dirección equivocada en un documento de entrega es peor que ninguna.»
//
// ── LAS CUATRO PREGUNTAS QUE ESTE FICHERO CONTESTA ──────────────────────────────────────────
//
//   ① ¿Resuelve los tres modos, y se calla cuando no sabe?
//   ② ¿Dicen lo MISMO la pantalla y el servidor? (la regla vive DOS veces: el front es vanilla)
//   ③ ¿Llega al PDF por LAS TRES puertas, y desaparece del papel si nadie la puso?
//   ④ ¿Puede un guard VER los dos campos nuevos? — la pregunta que casi se me escapa, abajo.
//
// ── 🔴 EL DEFECTO QUE ESTE FICHERO ENCONTRÓ EN SÍ MISMO ─────────────────────────────────────
//
// El payload del front se escribió primero con `...spread` de la pieza pura. **La tanda entera
// siguió VERDE**, incluido el censo de SCRUM-286 que existe justamente para cazar «un campo nuevo
// que nadie coloca»: ese censo deriva lo que viaja de las PROPIEDADES del object literal, y un
// spread no tiene propiedades que leer. Dos campos nuevos entrando en el envío sin que ningún
// guard los mirase. Con las claves escritas a mano el censo se puso ROJO en el acto, que es cómo
// se sabe que ahora las ve.
//
// ⚠️ Y HOY YA NO PASARÍA IGUAL, que es un matiz y no una excusa para quitar el test: como los dos
// campos están REGISTRADOS en `_asignacion-bloques-presupuesto.mjs`, volver al spread ahora cae
// también por el otro lado —«un campo asignado que ya no viaja»—. Comprobado por mutación: el
// spread pone en rojo a SCRUM-286 Y al test de abajo. Lo que aquel censo NO puede es cazar el
// campo que nadie registró, y ése es justo el estado en que nace todo campo nuevo.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { extraerTextoPdf } from './_texto-del-pdf.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(import.meta.url);

/** La pieza del NAVEGADOR (vanilla, CommonJS con doble vida). */
const F = require_(path.join(RAIZ, 'public/dashboard/js/quoteDireccionObra.js'));
/** La pieza del SERVIDOR, que es quien decide lo que se imprime. */
const S = await import('../dist/core/documentos/direccionObra.js');
const { generateQuotePdf } = await import('../dist/modules/invoicing/infra/pdf/pdf.service.js');
const { CreateQuoteSchema } = await import('../dist/core/validation/schemas.js');

const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · sin esto, todo lo de abajo pasaría sin medir nada
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-602 · SUELO: las dos piezas exportan lo que estos tests ejercen, y DISTINGUEN', () => {
  for (const k of ['MODOS', 'TEXTOS', 'OPCIONES', 'SIN_APROBAR', 'componerDireccionFacturacion',
    'sugerenciaParaPlaceholder', 'resolver', 'direccionParaPayload']) {
    assert.ok(F[k] !== undefined, `🔴 la pieza del front no exporta \`${k}\``);
  }
  for (const k of ['MODO_NO_MOSTRAR', 'MODO_FACTURACION', 'MODO_PERSONALIZADA',
    'MODOS_DIRECCION_OBRA', 'DIRECCION_OBRA_MAX', 'esModoDireccionObra',
    'normalizarModoDireccionObra', 'normalizarDireccionObra',
    'componerDireccionFacturacion', 'resolverDireccionObra', 'ROTULO_DIRECCION_OBRA_PDF',
    'SIN_APROBAR_DIRECCION_OBRA']) {
    assert.ok(S[k] !== undefined, `🔴 el dominio no exporta \`${k}\``);
  }
  // Si el resolvedor diera lo mismo para los tres modos, todo lo de abajo mediría una función muda.
  const cliente = { billingAddress: 'Calle Real 1', billingCity: 'Utrera' };
  const r = (modo) => S.resolverDireccionObra({ modo, personalizada: 'Nave 4', cliente });
  const tres = [r('no_mostrar'), r('facturacion'), r('personalizada')];
  assert.equal(new Set(tres.map(String)).size, 3,
    `🔴 los tres modos devuelven ${new Set(tres.map(String)).size} valores distintos, no 3: ${JSON.stringify(tres)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① LOS TRES MODOS, Y EL SUELO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-602 · cada modo resuelve lo suyo', () => {
  const cliente = {
    billingAddress: 'Av. de la Paz 12', billingPostalCode: '41710',
    billingCity: 'Utrera', billingProvince: 'Sevilla', billingCountry: 'España',
  };
  assert.equal(S.resolverDireccionObra({ modo: 'no_mostrar', personalizada: 'Nave 4', cliente }), null,
    '🔴 «No mostrar» ha impreso algo');
  assert.equal(S.resolverDireccionObra({ modo: 'personalizada', personalizada: '  Nave 4  ', cliente }), 'Nave 4',
    '🔴 «Personalizada» no imprime el texto del profesional (o no lo recorta)');
  assert.equal(S.resolverDireccionObra({ modo: 'facturacion', personalizada: 'Nave 4', cliente }),
    'Av. de la Paz 12, 41710, Utrera, Sevilla, España',
    '🔴 «Utilizar dirección de facturación» no compone la del cliente, o hace caso al texto libre');
});

test('SCRUM-602 · 🔴 EL SUELO DEL ALBARÁN: sin dato NO se inventa una dirección', () => {
  const cliente = { billingAddress: 'Av. de la Paz 12', billingCity: 'Utrera' };
  // «Personalizada» vacía NO se cae a la de facturación. Es la regla entera del ticket.
  for (const vacio of ['', '   ', null, undefined]) {
    assert.equal(S.resolverDireccionObra({ modo: 'personalizada', personalizada: vacio, cliente }), null,
      `🔴 con «Personalizada» y ${JSON.stringify(vacio)} ha salido una dirección. Rellenar el hueco `
      + 'con la fiscal pondría en el papel una dirección que nadie tecleó ni revisó.');
  }
  // «Facturación» sin dirección fiscal tampoco produce nada: ni cadena vacía, ni comas sueltas.
  assert.equal(S.resolverDireccionObra({ modo: 'facturacion', cliente: {} }), null);
  assert.equal(S.resolverDireccionObra({ modo: 'facturacion', cliente: null }), null);
});

test('SCRUM-602 · un modo que no conocemos NO se adivina: se calla', () => {
  // «facturación» con tilde, «FACTURACION», un typo, un número… ninguno se parece «lo bastante».
  for (const raro of ['facturación', 'FACTURACION', 'factuacion', 'obra', '', null, undefined, 3, {}]) {
    assert.equal(S.normalizarModoDireccionObra(raro), null,
      `🔴 \`${JSON.stringify(raro)}\` se ha aceptado como modo`);
    assert.equal(S.resolverDireccionObra({ modo: raro, personalizada: 'Nave 4', cliente: { billingCity: 'Utrera' } }), null,
      `🔴 con el modo \`${JSON.stringify(raro)}\` el documento ha impreso una dirección que nadie eligió`);
  }
  for (const bueno of S.MODOS_DIRECCION_OBRA) {
    assert.equal(S.normalizarModoDireccionObra(bueno), bueno, `🔴 «${bueno}» debería aceptarse`);
  }
});

test('SCRUM-602 · la composición NO deja comas sueltas cuando faltan trozos', () => {
  // El defecto que esto impide es literal: «, , , Sevilla, » impreso en un papel que ve un cliente.
  assert.equal(S.componerDireccionFacturacion({ billingProvince: 'Sevilla' }), 'Sevilla');
  assert.equal(S.componerDireccionFacturacion({ billingAddress: 'Calle A', billingCity: '   ' }), 'Calle A');
  assert.equal(S.componerDireccionFacturacion({ billingAddress: '', billingCity: '', billingCountry: '' }), null);
});

test('SCRUM-602 · el texto se RECORTA al tope, no se rechaza (como `lugarEntrega`)', () => {
  const largo = 'x'.repeat(400);
  assert.equal(S.normalizarDireccionObra(largo).length, S.DIRECCION_OBRA_MAX);
  assert.equal(S.DIRECCION_OBRA_MAX, 300, '🔴 el tope ya no es el mismo que el del albarán');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② LAS DOS COPIAS TIENEN QUE DECIR LO MISMO
//
// El front es vanilla y no puede importar TypeScript, así que la regla existe dos veces. No se
// puede hacer IMPOSIBLE sin un bundler; se hace VIGILADO, y por COMPORTAMIENTO: dos redacciones
// distintas de la misma regla son correctas, y dos idénticas pueden estar las dos mal.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-602 · GEMELAS: pantalla y servidor resuelven IGUAL, caso por caso', () => {
  const CLIENTES = [
    null,
    {},
    { billingAddress: 'Calle Real 1' },
    { billingProvince: 'Sevilla' },
    { billingAddress: 'Av. de la Paz 12', billingPostalCode: '41710', billingCity: 'Utrera' },
    { billingAddress: 'C/ Larga 3', billingPostalCode: '41001', billingCity: 'Sevilla', billingProvince: 'Sevilla', billingCountry: 'España' },
    { billingAddress: '  ', billingCity: '  ', billingCountry: 'España' },
    { billingAddress: null, billingCity: undefined, billingProvince: 'Cádiz' },
  ];
  const TEXTOS = [null, '', '   ', 'Nave 4', '  Polígono Sur, parcela 12  ', 'x'.repeat(50)];
  const MODOS = [...S.MODOS_DIRECCION_OBRA, 'inventado', null, undefined];

  let comparados = 0;
  for (const cliente of CLIENTES) {
    for (const texto of TEXTOS) {
      for (const modo of MODOS) {
        const servidor = S.resolverDireccionObra({ modo, personalizada: texto, cliente });
        const pantalla = F.resolver(modo, texto, cliente);
        assert.equal(pantalla, servidor,
          `🔴 DIVERGEN con modo=${JSON.stringify(modo)} texto=${JSON.stringify(texto)} `
          + `cliente=${JSON.stringify(cliente)}: pantalla «${pantalla}» vs papel «${servidor}». `
          + 'El profesional vería una dirección y el cliente recibiría otra.');
        comparados++;
      }
    }
  }
  assert.ok(comparados >= 100,
    `🔴 SUELO: sólo ${comparados} comparaciones. Con tan pocas, un verde aquí no dice nada.`);
});

test('SCRUM-602 · GEMELAS: el ROJO existe — si una de las dos cambiara, se vería', () => {
  // CONTROL POSITIVO del guard de arriba: se simula la divergencia y se comprueba que un
  // comparador honrado la detecta. Sin esto, «las dos coinciden» podría ser «no comparé nada».
  const cliente = { billingAddress: 'Calle Real 1', billingCity: 'Utrera' };
  const bueno = S.resolverDireccionObra({ modo: 'facturacion', cliente });
  const torcido = [cliente.billingAddress, cliente.billingCity].join(' - '); // otro separador
  assert.notEqual(torcido, bueno,
    '🔴 el comparador no distingue dos composiciones distintas: no estaría midiendo nada');
});

test('SCRUM-602 · el RÓTULO del papel y el de la pantalla son EL MISMO texto', () => {
  assert.equal(F.TEXTOS.rotulo, S.ROTULO_DIRECCION_OBRA_PDF,
    `🔴 la pantalla dice «${F.TEXTOS.rotulo}» y el PDF «${S.ROTULO_DIRECCION_OBRA_PDF}». El `
    + 'profesional elige una cosa y el cliente lee otra.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ EL PAPEL
// ═════════════════════════════════════════════════════════════════════════════════════════

const CASO = {
  merchantId: 602, merchant: { name: 'Taller' }, customer: { name: 'Cliente' },
  currency: 'EUR', qrData: 'x',
  lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 }],
  total: '121.00',
};

test('SCRUM-602 · 🔴 EL QUE DECIDE: un presupuesto SIN modo sale sin el bloque', async () => {
  const { outPath } = await generateQuotePdf({ ...CASO, quoteId: 6021 });
  const r = extraerTextoPdf(fs.readFileSync(outPath));
  assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}. Un texto vacío pasaría por «no dice nada».`);
  assert.ok(r.texto.includes('121,00'), '🔴 SUELO: el documento ni siquiera trae su total');
  assert.equal(r.texto.includes(S.ROTULO_DIRECCION_OBRA_PDF), false,
    `🔴 aparece «${S.ROTULO_DIRECCION_OBRA_PDF}» en un presupuesto que no la lleva. Todos los `
    + 'anteriores a este ticket son así: tienen que salir exactamente como salían.');
});

test('SCRUM-602 · con «Personalizada», el papel imprime lo que tecleó el profesional', async () => {
  const { outPath } = await generateQuotePdf({
    ...CASO, quoteId: 6022,
    direccionObra: { modo: 'personalizada', personalizada: 'Nave 4, Polígono Sur', cliente: null },
  });
  const r = extraerTextoPdf(fs.readFileSync(outPath));
  assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}`);
  assert.ok(r.texto.includes(S.ROTULO_DIRECCION_OBRA_PDF), '🔴 no sale el rótulo');
  assert.ok(r.texto.includes('Nave 4'), '🔴 no sale la dirección tecleada');
});

test('SCRUM-602 · con «facturación», el papel imprime la DEL CLIENTE, no el texto libre', async () => {
  const { outPath } = await generateQuotePdf({
    ...CASO, quoteId: 6023,
    direccionObra: {
      modo: 'facturacion',
      // Hay texto libre guardado de antes, y NO puede ganar: el modo manda.
      personalizada: 'Nave 4',
      cliente: { billingAddress: 'Av. de la Paz 12', billingCity: 'Utrera' },
    },
  });
  const r = extraerTextoPdf(fs.readFileSync(outPath));
  assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}`);
  assert.ok(r.texto.includes('Av. de la Paz 12'), '🔴 no sale la dirección de facturación');
  assert.equal(r.texto.includes('Nave 4'), false,
    '🔴 ha salido el texto libre con el modo «facturación»: el documento no dice lo que se eligió');
});

test('SCRUM-602 · «facturación» con un cliente SIN dirección deja el papel como estaba', async () => {
  const { outPath } = await generateQuotePdf({
    ...CASO, quoteId: 6024,
    direccionObra: { modo: 'facturacion', personalizada: null, cliente: { billingAddress: '  ' } },
  });
  const r = extraerTextoPdf(fs.readFileSync(outPath));
  assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}`);
  assert.equal(r.texto.includes(S.ROTULO_DIRECCION_OBRA_PDF), false,
    '🔴 se ha pintado un rótulo con la dirección vacía detrás. Sin dato no hay bloque.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS TRES PUERTAS · el mismo presupuesto se genera desde tres sitios
//
// Mismo mecanismo (y mismo motivo) que SCRUM-593c: un test que llama a `generateQuotePdf`
// directamente pasa lo que quiere. Lo que hay que mirar es QUIÉN la llama y CON QUÉ.
// ═════════════════════════════════════════════════════════════════════════════════════════

const FUENTES = [
  'src/modules/quotes/app/routes/quotes.routes.ts',
  'src/modules/system/app/routes/quotesAdmin.routes.ts',
];

/** Cada llamada a `nombre(...)` de un fichero, con las claves de primer nivel de su objeto. */
function llamadasCon(rel, nombre) {
  const ruta = path.join(RAIZ, rel);
  const sf = ts.createSourceFile(ruta, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const fuera = [];
  const visitar = (n) => {
    if (ts.isCallExpression(n)) {
      const e = n.expression;
      const llamado = ts.isIdentifier(e) ? e.text : (ts.isPropertyAccessExpression(e) ? e.name.text : null);
      if (llamado === nombre) {
        const arg = n.arguments[0];
        const props = new Set();
        if (arg && ts.isObjectLiteralExpression(arg)) {
          for (const p of arg.properties) {
            if (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) props.add(p.name.text);
          }
        }
        fuera.push({ fichero: rel, linea: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1, props });
      }
    }
    n.forEachChild(visitar);
  };
  visitar(sf);
  return fuera;
}

test('SCRUM-602 · LAS TRES PUERTAS del PDF reciben la dirección de la obra', () => {
  const puertas = FUENTES.flatMap((f) => llamadasCon(f, 'generateQuotePdf'));
  assert.equal(puertas.length, 3,
    `🔴 SUELO: el censo ha encontrado ${puertas.length} llamadas a \`generateQuotePdf\` y sabe que `
    + 'hay 3 (crear · regenerar con firma · GET /admin/quotes/:id/pdf). Un número más bajo es un '
    + 'analizador ciego, y su verde se lee igual que «todas las puertas están bien».');
  const sin = puertas.filter((p) => !p.props.has('direccionObra'))
    .map((p) => `${p.fichero}:${p.linea}`);
  assert.deepEqual(sin, [],
    `🔴 estas puertas NO pasan \`direccionObra\`: ${sin.join(', ')}. El mismo presupuesto saldría `
    + 'con el bloque o sin él según por dónde se pida — y aceptar un presupuesto le borraría la '
    + 'dirección del papel sin tocar la base ni fallar nada.');
});

test('SCRUM-602 · la ruta de creación GUARDA los dos campos, normalizados', () => {
  const src = leer('src/modules/quotes/app/routes/quotes.routes.ts');
  assert.match(src, /shippingAddressMode: normalizarModoDireccionObra\(body\.shippingAddressMode\)/,
    '🔴 el modo no se guarda por el normalizador. Sin él, un modo inventado entraría tal cual.');
  assert.match(src, /shippingAddress: normalizarDireccionObra\(body\.shippingAddress\)/,
    '🔴 el texto no se guarda por el normalizador: no se recortaría ni se colapsaría el vacío.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ ¿PUEDE UN GUARD VER LOS DOS CAMPOS NUEVOS?
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-602 · 🔴 las dos claves del envío se escriben A MANO, no con un `...spread`', () => {
  const ruta = path.join(RAIZ, 'public/dashboard/js/quotesView.js');
  const sf = ts.createSourceFile(ruta, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let payload = null;
  const visitar = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'quotePayload'
        && n.initializer && ts.isObjectLiteralExpression(n.initializer)) {
      payload = n.initializer;
    }
    n.forEachChild(visitar);
  };
  visitar(sf);
  assert.ok(payload, '🔴 SUELO: no encuentro `quotePayload` en el árbol. Sin él no mido nada.');

  const claves = new Set();
  for (const p of payload.properties) {
    if (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) claves.add(p.name.text);
  }
  for (const k of ['shippingAddressMode', 'shippingAddress']) {
    assert.ok(claves.has(k),
      `🔴 \`${k}\` no es una PROPIEDAD del literal del payload. Se probó con \`...spread\` y la `
      + 'tanda siguió verde MIENTRAS el campo no estaba registrado: el censo de SCRUM-286 deriva lo '
      + 'que viaja de las propiedades, así que un spread lo esconde del guard que existe para '
      + 'cazarlo. Un campo nuevo nace SIN registrar, y ése es el momento en que el fallo es mudo.');
  }
});

test('SCRUM-602 · el esquema deriva el enum del DOMINIO, y rechaza lo que no es un modo', () => {
  const base = { merchant_id: 1, customer_id: 1, currency: 'EUR', lines: [{ concept: 'x', qty: 1, price: 10, tax: 0.21 }] };
  for (const bueno of S.MODOS_DIRECCION_OBRA) {
    assert.equal(CreateQuoteSchema.safeParse({ ...base, shippingAddressMode: bueno }).success, true,
      `🔴 el esquema rechaza «${bueno}», que SÍ es un modo del dominio`);
  }
  assert.equal(CreateQuoteSchema.safeParse({ ...base, shippingAddressMode: 'facturación' }).success, false,
    '🔴 el esquema acepta un modo que el resolvedor no entiende: la columna guardaría algo que el '
    + 'documento nunca imprimirá');
  // Omitido y `null` son cosas distintas y las DOS tienen que valer.
  assert.equal(CreateQuoteSchema.safeParse(base).success, true);
  assert.equal(CreateQuoteSchema.safeParse({ ...base, shippingAddressMode: null }).success, true);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// MICROCOPY Y PANTALLA
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-602 · los CUATRO textos son los que firmó el asesor, y se declaran sin firma', () => {
  assert.deepEqual(
    { r: F.TEXTOS.rotulo, a: F.TEXTOS.noMostrar, b: F.TEXTOS.facturacion, c: F.TEXTOS.personalizada },
    { r: 'Dirección de la obra', a: 'No mostrar', b: 'Utilizar dirección de facturación', c: 'Personalizada' },
    '🔴 un texto ha cambiado sin pasar por el asesor (regla 30)');
  assert.equal(F.TEXTOS.rotulo.includes('envío'), false,
    '🔴 el rótulo vuelve a hablar de «envío», y esta pantalla YA tiene un bloque «4. Envío» que '
    + 'significa el envío del DOCUMENTO. Dos cosas distintas con el mismo nombre.');
  assert.equal(F.SIN_APROBAR, 4,
    '🔴 `SIN_APROBAR` ya no vale 4. Son las cuatro ranuras que esperan la firma del FUNDADOR: el '
    + 'rótulo (que se pinta también en el PDF, o sea que lo lee el cliente final) y las tres '
    + 'opciones. Si el fundador firma, baja; si alguien añade un modo, sube.');
  assert.equal(F.SIN_APROBAR, S.SIN_APROBAR_DIRECCION_OBRA,
    '🔴 las dos piezas declaran un número distinto de ranuras sin firmar');
});

test('SCRUM-602 · las tres opciones salen en el ORDEN firmado, y sin marcador en pantalla', () => {
  assert.deepEqual(F.OPCIONES.map((o) => o.valor), ['no_mostrar', 'facturacion', 'personalizada']);
  assert.deepEqual(F.OPCIONES.map((o) => o.palabra),
    ['No mostrar', 'Utilizar dirección de facturación', 'Personalizada']);
  for (const o of F.OPCIONES) {
    assert.equal(o.palabra.includes('[PENDIENTE'), false,
      `🔴 «${o.palabra}» lleva el marcador en PANTALLA. Que no se pinte el corchete es la decisión `
      + 'del 2-sep-2026; quien lleva la cuenta de lo que falta firmar es `SIN_APROBAR`.');
  }
});

test('SCRUM-602 · la sugerencia es PLACEHOLDER, nunca valor', () => {
  const cliente = { billingAddress: 'Av. de la Paz 12', billingCity: 'Utrera' };
  assert.equal(F.sugerenciaParaPlaceholder(cliente), 'Av. de la Paz 12, Utrera');
  assert.equal(F.sugerenciaParaPlaceholder(null), '', '🔴 sin cliente debería no haber pista');
  assert.equal(F.sugerenciaParaPlaceholder({}), '');

  const vista = leer('public/dashboard/js/quotesView.js');
  assert.match(vista, /direccionObraInput\.placeholder = window\.quoteDireccionObra\.sugerenciaParaPlaceholder/,
    '🔴 la sugerencia no va al `placeholder`');
  assert.doesNotMatch(vista, /direccionObraInput\.value = window\.quoteDireccionObra\.sugerencia/,
    '🔴 la sugerencia se está escribiendo como VALOR. Una dirección prerrellenada se firma sin '
    + 'leerla, y en un documento eso es peor que dejarla en blanco (SCRUM-300).');
});

test('SCRUM-602 · el campo libre se APAGA de verdad con `hidden`', () => {
  // Medido en navegador real el 4-sep-2026: `.field` declara `display:flex`, y una regla de AUTOR
  // gana a la del navegador para `[hidden]`. Un `<div>` pelado con `hidden` daba `none` (control
  // positivo) y este campo daba `flex`. Sin la regla de abajo, `hidden = true` no oculta nada.
  const css = leer('public/dashboard/css/styles.css');
  assert.match(css, /\.quote-direccion-obra\[hidden\]\s*\{\s*display:\s*none/,
    '🔴 falta `.quote-direccion-obra[hidden] { display: none }`. Sin ella el campo libre se ve '
    + 'SIEMPRE, también con «No mostrar» elegido.');
  const vista = leer('public/dashboard/js/quotesView.js');
  assert.match(vista, /direccionObraWrap\.className = "field quote-direccion-obra"/,
    '🔴 el campo ya no lleva la clase que lo apaga: la regla del CSS dejaría de alcanzarlo');
});

test('SCRUM-602 · la pieza se carga ANTES que la vista, y el service worker la cachea', () => {
  const html = leer('public/dashboard/index.html');
  const iPieza = html.indexOf('js/quoteDireccionObra.js');
  const iVista = html.indexOf('js/quotesView.js');
  assert.ok(iPieza !== -1, '🔴 `quoteDireccionObra.js` no está en index.html: la vista daría error');
  assert.ok(iPieza < iVista,
    '🔴 la pieza se carga DESPUÉS de la vista. `window.quoteDireccionObra` sería `undefined` al '
    + 'construir el formulario.');
  assert.match(leer('public/sw.js'), /\/dashboard\/js\/quoteDireccionObra\.js/,
    '🔴 el service worker no la cachea: en offline la pantalla del presupuesto se rompería');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL INSTRUMENTO ARREGLADO · un `...spread` ya no deja ciego al censo del envío
//
// El asesor pidió medirlo antes de creérselo, y el diagnóstico se confirmó CON CONTROL: se
// inyectó `campoQueNadieHaRegistrado` en el payload de tres formas y se corrió el censo de
// SCRUM-286.
//
//   · escrito a mano          → 3 rojos          (el censo lo ve)
//   · dentro de `...({ … })`  → CERO rojos       🔴 ciego
//   · dentro de `...variable` → CERO rojos       🔴 ciego
//
// Ahora el censo lee las claves del spread cuando son estáticas y DECLARA `opacos` cuando no
// puede. Un spread de una variable o de una llamada ya no devuelve un número más bajo en
// silencio: dice que no supo mirar, que es otra cosa.
// ═════════════════════════════════════════════════════════════════════════════════════════
import { revisarAsignacionDeBloques } from './_asignacion-bloques-presupuesto.mjs';

test('SCRUM-602 · el censo del envío no tiene NADA opaco en el árbol de hoy', () => {
  const R = revisarAsignacionDeBloques(leer('public/dashboard/js/quotesView.js'));
  assert.ok(R.clavesDeEnvio.length >= 10,
    `🔴 SUELO: el censo sólo ve ${R.clavesDeEnvio.length} campos. Con tan pocos, un «nada opaco» `
    + 'sería la respuesta de un analizador que no encontró el payload.');
  assert.deepEqual(R.envioOpaco, [],
    `🔴 el censo NO puede resolver esto del payload: ${R.envioOpaco.join(' · ')}. Lo que viaje ahí `
    + 'dentro es invisible para el guard que caza «un campo nuevo que nadie ha colocado».');
});

test('SCRUM-602 · ROJO: un campo dentro de un spread YA NO pasa desapercibido', () => {
  const fuente = leer('public/dashboard/js/quotesView.js');
  const ancla = '        shippingAddressMode: direccionDeLaObra.shippingAddressMode,\n';
  assert.equal(fuente.split(ancla).length - 1, 1,
    '🔴 SUELO: no encuentro el ancla del payload; las mutaciones de abajo no medirían nada.');

  // ① spread de un OBJETO LITERAL: las claves SÍ son estáticas → se cuentan, y salen «sin sitio».
  const conLiteral = revisarAsignacionDeBloques(
    fuente.replace(ancla, '        ...({ campoQueNadieHaRegistrado: 1 }),\n' + ancla));
  assert.ok(conLiteral.sinSitio.includes('campoQueNadieHaRegistrado'),
    '🔴 un campo dentro de `...({ … })` sigue sin verse. Antes de SCRUM-602 esto daba CERO rojos.');

  // ② spread de una VARIABLE: no se puede resolver → el censo lo DECLARA en vez de callarse.
  const conVariable = revisarAsignacionDeBloques(
    fuente.replace(ancla, '        ...extraSinRegistrar,\n' + ancla));
  assert.equal(conVariable.envioOpaco.length, 1,
    `🔴 un \`...variable\` no se ha declarado opaco (opacos: ${conVariable.envioOpaco.length}). `
    + 'Devolver el censo sin él es contestar «no hay campos ahí» a una pregunta que no se ha hecho.');
  assert.match(conVariable.envioOpaco[0], /extraSinRegistrar/,
    '🔴 el censo declara algo opaco pero no dice QUÉ: un aviso sin nombre no se puede seguir.');

  // ③ CONTROL NEGATIVO: sin mutar, ni «sin sitio» ni «opaco».
  const limpio = revisarAsignacionDeBloques(fuente);
  assert.deepEqual([limpio.sinSitio, limpio.envioOpaco], [[], []],
    '🔴 el árbol de hoy ya tiene hallazgos: los dos casos de arriba no probarían nada.');
});
