// tests/scrum290-albaran-a-factura.test.mjs — SCRUM-290 (A0.4)
//
// CANTIDADES DEL ALBARÁN · PRECIOS DEL PRESUPUESTO FIRMADO. Y lo añadido en obra no se factura:
// dispara un presupuesto adicional.
//
// ── LAS DOS CARAS ───────────────────────────────────────────────────────────────────────────
// Probar solo que la conversión funciona no demuestra nada: hay que probar también que un albarán
// SIN presupuesto detrás **no se convierte**. Un casador que dijera «adelante» siempre pasaría la
// primera mitad de esta suite tan campante.
//
// ── EL SUELO ────────────────────────────────────────────────────────────────────────────────
// Si el casador deja de encontrar coincidencias, **falla** en vez de facturar cero líneas. Una
// factura con cero líneas es un documento fiscal emitido que no dice nada, y una factura emitida
// **no se edita ni se borra** (regla 29): el error queda para siempre. Por eso el cero de «no hay
// líneas» y el cero de «ninguna casó» son motivos DISTINTOS y con texto distinto.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  casarLineas, motivosParaNoEmitir, baseDeFacturables, totalDeFacturables,
  lineasParaFactura, TIPO_DESTINATARIO_POR_DEFECTO,
} from '../dist/modules/jobs/domain/albaranAFactura.js';

// Presupuesto FIRMADO: 10 m de tubo a 12,50 € (21 %) y 1 ud de grifo a 80 € (21 %).
// `tax` es FRACCIÓN, que es como vive en `Quote.lines` — el albarán usa porcentaje entero.
const PRESUPUESTO = [
  { concept: 'Tubo multicapa 16mm', qty: 10, price: 12.5, tax: 0.21 },
  { concept: 'Grifo monomando', qty: 1, price: 80, tax: 0.21 },
];

// ── CASO 1 · LA LÍNEA QUE CASA ENTERA ────────────────────────────────────────────────────────

test('SCRUM-290 · caso 1: la línea que casa se factura con la cantidad del ALBARÁN y el precio del PRESUPUESTO', () => {
  const albaran = [{ concepto: 'Grifo monomando', cantidad: 1, unidad: 'ud', quoteLineIndex: 1 }];
  const c = casarLineas(albaran, PRESUPUESTO);

  assert.equal(c.facturables.length, 1);
  assert.equal(c.facturables[0].cantidad, 1, 'la cantidad sale del albarán');
  assert.equal(c.facturables[0].precioUnitario, 80, 'el precio sale del presupuesto firmado, no del albarán');
  assert.equal(c.facturables[0].tax, 0.21, 'el impuesto también sale del presupuesto (y en FRACCIÓN, no en %)');
  assert.deepEqual(c.paraAdicional, []);
  assert.deepEqual(motivosParaNoEmitir(c, true), [], 'con una línea que casa, se puede emitir');
});

test('SCRUM-290 · con un albarán VALORADO, GANA el precio del presupuesto — no el del albarán', () => {
  // 🔴 ESTE TEST NACIÓ DE UN ROJO QUE NO SALIÓ ROJO.
  //
  // Al inyectar «coge el precio del albarán si lo trae» (`l.precioUnitario ?? origen.price`), la
  // suite entera siguió VERDE: ninguna de las líneas de prueba llevaba precio, así que el fallback
  // al presupuesto lo tapaba. O sea que la regla más importante del ticket —los precios salen de
  // lo que el cliente firmó— no estaba comprobada por nada.
  //
  // Y el caso existe de verdad: `modoValoracion: 'VALORADO'` (SCRUM-65) permite que el albarán
  // lleve `precioUnitario`. Ahí es donde la fuente equivocada ganaría sin que nadie lo viera, y
  // ahí es donde le costaría dinero al cliente: se le cobraría un precio que no aceptó.
  const albaranValorado = [{
    concepto: 'Grifo monomando', cantidad: 1, unidad: 'ud', quoteLineIndex: 1,
    precioUnitario: 140, tipoIva: 21,   // el profesional anotó OTRO precio en obra
  }];
  const c = casarLineas(albaranValorado, PRESUPUESTO);
  assert.equal(c.facturables[0].precioUnitario, 80,
    '🔴 se ha facturado el precio del ALBARÁN (140) en vez del que el cliente firmó (80): eso es cobrarle algo que no aceptó');
  assert.equal(totalDeFacturables(c.facturables), '96.80', '80 + 21 %, no 140 + 21 %');
});

// ── CASO 2 · LA ENTREGA PARCIAL: 3 DE 10 ─────────────────────────────────────────────────────

test('SCRUM-290 · caso 2: se entregan 3 de los 10 metros → se facturan 3, al precio firmado', () => {
  const albaran = [{ concepto: 'Tubo multicapa 16mm', cantidad: 3, unidad: 'm', quoteLineIndex: 0 }];
  const c = casarLineas(albaran, PRESUPUESTO);

  assert.equal(c.facturables.length, 1);
  assert.equal(c.facturables[0].cantidad, 3, 'lo entregado, no lo presupuestado');
  assert.equal(c.facturables[0].precioUnitario, 12.5);
  assert.equal(baseDeFacturables(c.facturables), 37.5, '3 × 12,50 — el cliente firmó ese precio unitario');
  assert.equal(totalDeFacturables(c.facturables), '45.38', '37,50 + 21 %');
  assert.deepEqual(c.paraAdicional, [], 'entregar de menos no genera adicional: es una entrega parcial, no trabajo nuevo');
});

test('SCRUM-290 · caso 2b: la SEGUNDA entrega no vuelve a facturar lo ya facturado', () => {
  // Obra por fases, que es el caso normal. Sin esto, dos albaranes del mismo presupuesto
  // facturarían dos veces lo mismo — y la segunda factura ya no se puede borrar (regla 29).
  const albaran = [{ concepto: 'Tubo multicapa 16mm', cantidad: 8, unidad: 'm', quoteLineIndex: 0 }];
  const c = casarLineas(albaran, PRESUPUESTO, { 0: 3 }); // ya se facturaron 3 de los 10

  assert.equal(c.facturables[0].cantidad, 7, 'quedaban 7 de los 10 firmados');
  const exceso = c.paraAdicional.find((l) => l.motivo === 'exceso_sobre_lo_presupuestado');
  assert.ok(exceso, 'el metro que sobra no se factura en silencio: sale nombrado');
  assert.equal(exceso.exceso, 1);
});

// ── CASO 3 · LA LÍNEA NUEVA DE OBRA ──────────────────────────────────────────────────────────

test('SCRUM-290 · caso 3: lo añadido en obra NO se factura — va al presupuesto adicional', () => {
  const albaran = [
    { concepto: 'Grifo monomando', cantidad: 1, unidad: 'ud', quoteLineIndex: 1 },
    { concepto: 'Picar tabique (no presupuestado)', cantidad: 2, unidad: 'h' }, // sin quoteLineIndex
  ];
  const c = casarLineas(albaran, PRESUPUESTO);

  assert.equal(c.facturables.length, 1, 'solo se factura lo que el cliente firmó');
  assert.equal(c.paraAdicional.length, 1);
  assert.equal(c.paraAdicional[0].motivo, 'no_estaba_en_el_presupuesto');
  // NOMBRADA, no contada: lo que no se factura tiene que poder ponerse en el adicional que se
  // manda a firmar. Descartar en silencio en un documento que alguien firma es SCRUM-271.
  assert.equal(c.paraAdicional[0].concepto, 'Picar tabique (no presupuestado)');
  assert.equal(c.paraAdicional[0].cantidad, 2);
  assert.equal(c.paraAdicional[0].unidad, 'h');
});

test('SCRUM-290 · la línea nueva NO entra en la factura ni a 0 €', () => {
  // La solución que se descartó por incorrecta. Si algún día alguien la reintroduce, esto cae:
  // meterla a 0 convierte a YaQu en la herramienta que produce la factura mayor que el
  // presupuesto en cuanto alguien le ponga precio después.
  const albaran = [
    { concepto: 'Tubo multicapa 16mm', cantidad: 10, unidad: 'm', quoteLineIndex: 0 },
    { concepto: 'Trabajo nuevo', cantidad: 5, unidad: 'h' },
  ];
  const lineas = lineasParaFactura(casarLineas(albaran, PRESUPUESTO).facturables);
  assert.equal(lineas.length, 1, 'la línea nueva no está en la factura, ni siquiera a 0');
  assert.deepEqual(lineas[0], { concept: 'Tubo multicapa 16mm', qty: 10, price: 12.5, tax: 0.21 });
});

// ── LA OTRA CARA: LO QUE **NO** SE CONVIERTE ─────────────────────────────────────────────────

test('SCRUM-290 · un albarán SIN presupuesto detrás no se convierte', () => {
  const c = casarLineas([{ concepto: 'Mano de obra', cantidad: 4, unidad: 'h' }], []);
  const motivos = motivosParaNoEmitir(c, /* hayPresupuesto */ false);
  assert.ok(motivos.length > 0);
  assert.match(motivos.join(' '), /presupuesto firmado detrás/,
    'el motivo tiene que decir POR QUÉ, no solo negarse: sin presupuesto no hay precios aceptados');
});

test('SCRUM-290 · un `quoteLineIndex` que apunta fuera del presupuesto NO se factura', () => {
  // Sin línea de origen no hay precio firmado. Facturar «por si acaso» sería inventarse el importe.
  const c = casarLineas([{ concepto: 'X', cantidad: 1, unidad: 'ud', quoteLineIndex: 99 }], PRESUPUESTO);
  assert.deepEqual(c.facturables, []);
  assert.equal(c.paraAdicional[0].motivo, 'linea_del_presupuesto_no_existe');
});

// ── EL SUELO ─────────────────────────────────────────────────────────────────────────────────

test('SCRUM-290 · SUELO: con líneas pero NINGUNA casada, NO se emite — y lo dice', () => {
  const albaran = [
    { concepto: 'A', cantidad: 1, unidad: 'ud' },
    { concepto: 'B', cantidad: 2, unidad: 'ud' },
  ];
  const c = casarLineas(albaran, PRESUPUESTO);
  assert.deepEqual(c.facturables, []);

  const motivos = motivosParaNoEmitir(c, true);
  assert.ok(motivos.length > 0, '🔴 el casador no casó nada y aun así dejaría emitir: eso es una factura VACÍA');
  assert.match(motivos.join(' '), /2 línea\(s\) y NINGUNA casa/,
    'tiene que decir cuántas traía: 0 casadas de 2 no es lo mismo que 0 casadas de 0');
  assert.match(motivos.join(' '), /regla 29/, 'y por qué importa: una factura emitida no se borra');
});

test('SCRUM-290 · SUELO: los DOS ceros son motivos distintos', () => {
  // «El albarán está vacío» y «el casador no casó nada» son el mismo número con significados
  // opuestos: el primero es un albarán mal hecho, el segundo es un fallo del casador o un
  // `quoteLineIndex` que nadie escribió. Aplanarlos esconde el segundo.
  const vacio = motivosParaNoEmitir(casarLineas([], PRESUPUESTO), true);
  const sinCasar = motivosParaNoEmitir(casarLineas([{ concepto: 'A', cantidad: 1 }], PRESUPUESTO), true);
  assert.match(vacio.join(' '), /ni una línea/);
  assert.match(sinCasar.join(' '), /NINGUNA casa/);
  assert.notDeepEqual(vacio, sinCasar);
});

test('SCRUM-290 · SUELO POSITIVO: cuando SÍ casa, no hay motivos para no emitir', () => {
  // El hermano positivo. Sin él, todo lo de arriba pasaría aunque `motivosParaNoEmitir`
  // devolviera siempre algo — y entonces no se podría facturar nunca.
  const c = casarLineas([{ concepto: 'Grifo monomando', cantidad: 1, unidad: 'ud', quoteLineIndex: 1 }], PRESUPUESTO);
  assert.deepEqual(motivosParaNoEmitir(c, true), []);
});

// ── CONTROL NEGATIVO: un cambio que NO debe hacer caer nada ──────────────────────────────────

test('SCRUM-290 · CONTROL NEGATIVO: renombrar el concepto en el albarán no rompe la casación', () => {
  // El casado va por `quoteLineIndex`, NO por el texto del concepto. Que el profesional retoque la
  // descripción en obra —cosa normalísima— no puede cambiar a qué línea del presupuesto pertenece
  // ni, por tanto, el precio que se le cobra al cliente.
  const albaran = [{ concepto: 'Grifo monomando MARCA X (anotado en obra)', cantidad: 1, unidad: 'ud', quoteLineIndex: 1 }];
  const c = casarLineas(albaran, PRESUPUESTO);
  assert.equal(c.facturables.length, 1);
  assert.equal(c.facturables[0].precioUnitario, 80, 'el precio sigue siendo el firmado');
  assert.deepEqual(c.paraAdicional, [], 'un concepto retocado NO es trabajo nuevo');
});

// ── LA CONVENCIÓN DE UNIDADES, QUE ES UNA TRAMPA REAL ────────────────────────────────────────

test('SCRUM-290 · el impuesto NO se convierte: sale del presupuesto, que ya viene en fracción', () => {
  // El albarán usa `tipoIva` en PORCENTAJE entero (21) y el presupuesto `tax` en FRACCIÓN (0.21).
  // La conversión `/100` existe en tres sitios del árbol; copiarla aquí por inercia metería un
  // IVA cien veces mayor. Como los precios salen del presupuesto, aquí no se convierte nada.
  const albaran = [{ concepto: 'Tubo', cantidad: 2, unidad: 'm', quoteLineIndex: 0, tipoIva: 21 }];
  const c = casarLineas(albaran, PRESUPUESTO);
  assert.equal(c.facturables[0].tax, 0.21, 'fracción, no 21 ni 0.0021');
  assert.equal(totalDeFacturables(c.facturables), '30.25', '2 × 12,50 = 25,00 + 21 % = 30,25');
});

// ── LO QUE NO SE FACTURA, PERO TAMPOCO SE PIERDE ─────────────────────────────────────────────

test('SCRUM-290 · una línea sin cantidad no se factura y sale nombrada', () => {
  const c = casarLineas([{ concepto: 'Revisión', cantidad: 0, unidad: 'h', quoteLineIndex: 0 }], PRESUPUESTO);
  assert.deepEqual(c.facturables, []);
  assert.equal(c.paraAdicional[0].motivo, 'sin_cantidad');
  assert.equal(c.paraAdicional[0].concepto, 'Revisión', 'nombrada: nada se descarta en silencio');
});

test('SCRUM-290 · el cliente sin clasificar cae al criterio ESTRICTO', () => {
  // `null` = nunca se le preguntó. Se trata como PARTICULAR, igual que
  // `pendientesFacturar.service.ts:16`: equivocarse hacia el lado estricto no le cuesta un
  // procedimiento a nadie.
  assert.equal(TIPO_DESTINATARIO_POR_DEFECTO, 'PARTICULAR');
});
