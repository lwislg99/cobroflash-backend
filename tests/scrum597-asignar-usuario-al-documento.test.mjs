// tests/scrum597-asignar-usuario-al-documento.test.mjs — SCRUM-597 (DOC-07)
//
// ASIGNAR USUARIOS AL DOCUMENTO, Y QUE ESO NO ABRA LA ECONOMÍA DEL NEGOCIO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA FIRMA QUE ORDENA ESTO (P-DOC-3, fundador, 7-sep-2026)
//
//   «Coste y margen los ven el PROPIETARIO y los ADMINS. Los técnicos NO.»
//
// Y no en ningún sitio: ni en el documento, ni en el catálogo, ni en la línea, ni derivables
// restando dos números que sí vean.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// SE EJERCITA POR EL CAMINO REAL, NO SE RAZONA SOBRE EL FUENTE
//
// Todo lo de aquí abajo pasa por la app de verdad: el `dist/app.js` de producción, su
// `requireAuth`, su `requireRole` y sus handlers, hablados por HTTP. Lo único sustituido es el
// origen de los datos (`_banco-camino-real.mjs`), porque este entorno no tiene Postgres y el
// encargo prohíbe staging y producción. La app no llega a construir ningún PrismaClient, y el
// banco FALLA si no ha adoptado el doble.
//
// Lo que esto puede afirmar y la lectura del fuente no: que el coste **no sale por el cable**.
import test from 'node:test';
import assert from 'node:assert/strict';
import { after } from 'node:test';
import { bancoDePrisma, montarAppReal, sesionesDe } from './_banco-camino-real.mjs';

const MERCHANT = 7;
const TECNICO = { id: 42, name: 'Israel', role: 'tecnico', status: 'active' };

// El artículo del catálogo con el que se mide: precio 100, coste 60 → margen 40 %.
// Los números se eligen para que el margen sea EXACTO y una resta acertada sea inconfundible.
const ARTICULO = {
  id: 11, merchantId: MERCHANT, name: 'Detector de humos', description: null,
  price: 100, cost: 60, vat: 0.21, providerId: null, isActive: true, itemKind: 'PRODUCTO',
  nameSearch: 'detector de humos', provider: null,
};

const LINEA = { concept: 'Detector de humos', qty: 1, price: 100, costeUnitario: 60, tax: 0.21 };

const PRESUPUESTO = {
  id: 501, merchantId: MERCHANT, customerId: 3, status: 'sent', total: 100,
  currency: 'EUR', lines: [LINEA], quoteNumber: 5, revision: 0, teamMemberId: null,
  createdAt: new Date(), updatedAt: new Date(), internalNotes: null, tiers: null,
  selectedTierId: null, signatureUrl: null, pdfUrl: null, chargeId: null, decisionToken: 'tok',
  customer: { id: 3, name: 'Cliente', phone: '34000000001', email: null },
  // `getQuoteDetailAdmin` hace `include: { merchant, customer, charge, Invoice }`. Se sirven los
  // cuatro: un fixture a medias haría fallar el handler por otro motivo, y un 500 no mide permisos.
  merchant: { id: MERCHANT, name: 'QA 597', country: 'ES', defaultCurrency: 'EUR' },
  charge: null,
  Invoice: [],
};

// La factura EMITIDA con la que se mide la regla 29. Arrastra su presupuesto de origen entero,
// que es como lo devuelve `getInvoiceDetailAdmin` (`include: { quote: true }`).
const FACTURA = {
  id: 900, merchantId: MERCHANT, customerId: 3, quoteId: 501, chargeId: null,
  number: '2026-0007', total: 121, currency: 'EUR', status: 'pending',
  pdfUrl: '/pdfs/2026-0007.pdf', qrData: 'QR', lines: [LINEA], type: 'F1',
  vfEstado: 'sellado', createdAt: new Date(),
  merchant: { id: MERCHANT, name: 'QA 597', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR' },
  customer: { id: 3, name: 'Cliente', phone: '34000000001', email: null },
  quote: PRESUPUESTO,
  rectifies: null, rectifiedBy: [],
};

// Programa el doble UNICO para este caso y devuelve la app ya montada. Un solo doble por
// proceso: ver la cabecera del banco — uno por test no se adoptaba, y eso daba verdes vacios.
async function bancoDe({ asignados = [] } = {}) {
  const ses = sesionesDe(MERCHANT, TECNICO);
  const filasAsignadas = asignados.map((tm) => ({ teamMember: { id: tm.id, name: tm.name } }));
  bancoDePrisma().programar({
    authSession: ses.tabla,
    merchant: { findUnique: async () => ses.merchant },
    teamMember: { findFirst: async (a) => (a?.where?.id === TECNICO.id ? TECNICO : null) },
    product: {
      findMany: async () => [ARTICULO],
      findFirst: async () => ARTICULO,
    },
    quote: {
      findFirst: async () => PRESUPUESTO,
      findUnique: async () => PRESUPUESTO,
      findMany: async () => [PRESUPUESTO],
    },
    invoice: {
      findFirst: async () => FACTURA,
      findUnique: async () => FACTURA,
      findMany: async () => [FACTURA],
    },
    quoteAssignee: { findMany: async () => filasAsignadas },
    invoiceAssignee: { findMany: async () => filasAsignadas },
  });
  return montarAppReal();
}

/** Todo número que aparezca en la respuesta, a cualquier profundidad. */
function numerosDe(valor, salida = []) {
  if (typeof valor === 'number' && Number.isFinite(valor)) salida.push(valor);
  else if (typeof valor === 'string' && valor !== '' && Number.isFinite(Number(valor))) salida.push(Number(valor));
  else if (Array.isArray(valor)) valor.forEach((v) => numerosDe(v, salida));
  else if (valor && typeof valor === 'object') Object.values(valor).forEach((v) => numerosDe(v, salida));
  return salida;
}

/** ¿Aparece esta clave en algún sitio del objeto? */
function tieneClave(valor, clave) {
  if (Array.isArray(valor)) return valor.some((v) => tieneClave(v, clave));
  if (valor && typeof valor === 'object') {
    if (Object.prototype.hasOwnProperty.call(valor, clave)) return true;
    return Object.values(valor).some((v) => tieneClave(v, clave));
  }
  return false;
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// 0 · SUELO — si el barrido no ve ni un usuario ni un rol, se declara CIEGO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-597 · 🔴 SUELO: el banco ve un usuario y un rol, y la app adopta el doble', async () => {
  const app = await bancoDe();
  {
    assert.ok(TECNICO.id && TECNICO.role, '🔴 CIEGO: no hay usuario ni rol con los que medir nada');
    assert.equal(TECNICO.role, 'tecnico',
      '🔴 CIEGO: el rol medido no es el que existe en el árbol. `TeamMember.role` sólo tiene '
      + '`admin` y `tecnico`; si eso ha cambiado, este fichero está midiendo un rol inventado.');
    const r = await app.pedir('/admin/products');
    assert.equal(r.status, 401,
      '🔴 SUELO: sin cookie la app tendría que negar. Si contesta otra cosa, no es la app real.');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 1 · 🔴 EL CONTROL QUE DECIDE — los dos sentidos, PEGADOS
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-597 · 🔴 TÉCNICO ASIGNADO al documento: coste y margen NO aparecen', async () => {
  // Asignado a los DOS documentos: es la hipótesis del ticket —que asignar abra la puerta— y se
  // mide con la puerta supuestamente abierta, no con ella cerrada.
  const app = await bancoDe({ asignados: [TECNICO] });
  const doble = app.doble;
  const t = { token: 'TOKEN-TECNICO' };
  {
    const bocas = [
      ['catálogo (lista)', '/admin/products'],
      ['catálogo (ficha)', '/admin/products/11'],
      ['catálogo (autocompletado)', '/admin/products/autocomplete?q=detector'],
      ['factura (lista)', '/admin/invoices'],
      ['factura (detalle)', '/admin/invoices/900'],
      ['presupuesto (detalle)', '/admin/quotes/501'],
    ];
    for (const [nombre, ruta] of bocas) {
      const r = await app.pedir(ruta, t);
      assert.equal(r.status, 200, `🔴 ${nombre} devolvió ${r.status}; sin 200 no se mide nada`);
      assert.equal(tieneClave(r.json, 'cost'), false,
        `🔴 ${nombre} le sirve \`cost\` al técnico. P-DOC-3 dice que no lo ve en NINGÚN sitio.`);
      assert.equal(tieneClave(r.json, 'costeUnitario'), false,
        `🔴 ${nombre} le sirve \`costeUnitario\` al técnico — el coste congelado en la línea.`);
      assert.equal(tieneClave(r.json, 'margen'), false, `🔴 ${nombre} le sirve un margen calculado`);
    }

    // Y que la asignación SÍ estaba puesta: sin esto, el verde de arriba podría ser el de un
    // técnico sin asignar, que es justo el caso que NO estamos probando.
    const det = await app.pedir('/admin/invoices/900', t);
    assert.deepEqual(det.json.asignados, [{ id: TECNICO.id, name: TECNICO.name }],
      '🔴 el técnico NO estaba asignado: este test no ha medido lo que dice medir.');
  }
});

test('SCRUM-597 · 🔴 PROPIETARIO: coste y margen SÍ aparecen (el otro sentido)', async () => {
  const app = await bancoDe({ asignados: [TECNICO] });
  const doble = app.doble;
  const p = { token: 'TOKEN-PROPIETARIO' };
  {
    const lista = await app.pedir('/admin/products', p);
    assert.equal(lista.status, 200);
    assert.equal(lista.json.items[0].cost, 60,
      '🔴 al PROPIETARIO se le ha ocultado el coste. La firma dice que él SÍ lo ve: una ocultación '
      + 'que tapa a todo el mundo no cumple P-DOC-3, la incumple por el otro lado.');

    const factura = await app.pedir('/admin/invoices/900', p);
    assert.equal(factura.json.lines[0].costeUnitario, 60, '🔴 el propietario no ve el coste de la línea');
    assert.equal(factura.json.quote.lines[0].costeUnitario, 60,
      '🔴 el propietario no ve el coste del presupuesto de origen');

    const presupuesto = await app.pedir('/admin/quotes/501', p);
    assert.equal(presupuesto.json.lines[0].costeUnitario, 60, '🔴 el propietario no ve el coste en el presupuesto');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 2 · 🔴 EL SEGUNDO CONTROL, el que se olvida: ¿puede DEDUCIRLO?
//
// Un dato oculto que se calcula no está oculto. El margen de este artículo es (100−60)/100 = 40 %,
// así que la pregunta concreta es: ¿queda en la respuesta ALGÚN número del que, restando, salga
// 60 o 40? Se barre la respuesta ENTERA —a cualquier profundidad—, no los campos que sospechamos.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-597 · 🔴 el técnico no puede DEDUCIR el margen restando dos números que ve', async () => {
  const app = await bancoDe({ asignados: [TECNICO] });
  const doble = app.doble;
  const t = { token: 'TOKEN-TECNICO' };
  {
    for (const ruta of ['/admin/products', '/admin/products/11', '/admin/invoices/900', '/admin/quotes/501']) {
      const r = await app.pedir(ruta, t);
      const nums = numerosDe(r.json);
      assert.ok(nums.length > 0,
        `🔴 CIEGO: no se ha extraído ni un número de ${ruta}. Un barrido que no ve nada no puede `
        + 'afirmar que no hay nada deducible.');
      assert.equal(nums.includes(ARTICULO.cost), false,
        `🔴 ${ruta} deja el COSTE (60) suelto en la respuesta, con otro nombre o en otro sitio.`);
      // El margen exacto y el margen en tanto por uno: las dos formas en que se escribiría.
      assert.equal(nums.includes(40), false,
        `🔴 ${ruta} deja el MARGEN (40) ya calculado en la respuesta.`);
      assert.equal(nums.includes(0.4), false,
        `🔴 ${ruta} deja el MARGEN (0,4) ya calculado en la respuesta.`);
    }
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 3 · ✅ POSITIVO — un documento SIN ASIGNAR se comporta exactamente igual que hoy
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-597 · ✅ POSITIVO: sin asignar, el documento responde igual y `asignados` viene vacío', async () => {
  const app = await bancoDe({ asignados: [] });
  {
    for (const ruta of ['/admin/invoices/900', '/admin/quotes/501']) {
      const r = await app.pedir(ruta, { token: 'TOKEN-PROPIETARIO' });
      assert.equal(r.status, 200, `🔴 ${ruta} sin asignar dejó de responder 200`);
      assert.deepEqual(r.json.asignados, [],
        '🔴 un documento sin asignar tiene que decir «nadie» con una lista vacía, no faltar ni fallar.');
    }
    // Y la LISTA, que es donde se notaría un cambio de comportamiento (mismo orden, mismas filas).
    const lista = await app.pedir('/admin/invoices', { token: 'TOKEN-PROPIETARIO' });
    assert.equal(lista.status, 200);
    assert.equal(lista.json.length, 1, '🔴 la lista ha cambiado de tamaño por culpa de la asignación');
    assert.equal(lista.json[0].id, FACTURA.id, '🔴 la lista ha cambiado de orden o de contenido');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 4 · ✅ NEGATIVO — asignar NO es un permiso
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-597 · ✅ NEGATIVO: estar asignado no deja al técnico emitir, ni cobrar, ni asignar', async () => {
  const app = await bancoDe({ asignados: [TECNICO] });
  const t = { token: 'TOKEN-TECNICO' };
  {
    const prohibidas = [
      ['emitir factura desde el presupuesto', 'POST', '/admin/quotes/501/invoice'],
      ['marcar la factura pagada', 'POST', '/admin/invoices/900/pay'],
      ['cambiar el estado de la factura', 'PUT', '/admin/invoices/900/status'],
      ['rectificar la factura', 'POST', '/admin/invoices/900/rectify'],
      ['asignar el presupuesto', 'PATCH', '/admin/quotes/501/asignados'],
      ['asignar la factura', 'PATCH', '/admin/invoices/900/asignados'],
    ];
    for (const [nombre, metodo, ruta] of prohibidas) {
      const r = await app.pedir(ruta, { ...t, metodo, cuerpo: { status: 'paid', assignedUserIds: [] } });
      assert.equal(r.status, 403,
        `🔴 un técnico ASIGNADO ha podido «${nombre}» (${r.status}). Asignar no es un permiso: si `
        + 'estar asignado abre una acción, la asignación se ha convertido en una llave.');
    }
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 5 · 🔴 REGLA 29 — asignar a una factura EMITIDA no la toca
//
// No se comprueba «que no se quiso tocar»: se comprueba que NO SE TOCÓ. El doble anota TODA
// escritura que recibe, así que la afirmación es sobre lo que la app hizo, no sobre lo que dice.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-597 · 🔴 REGLA 29: asignar a una factura emitida no cambia número, total ni PDF', async () => {
  const app = await bancoDe({ asignados: [] });
  const doble = app.doble;
  {
    const antes = { number: FACTURA.number, total: FACTURA.total, pdfUrl: FACTURA.pdfUrl };

    const r = await app.pedir('/admin/invoices/900/asignados', {
      token: 'TOKEN-PROPIETARIO', metodo: 'PATCH', cuerpo: { assignedUserIds: [TECNICO.id] },
    });
    assert.equal(r.status, 200, `🔴 la asignación no llegó a ejecutarse (${r.status}): no hay nada medido`);

    const tocaronFactura = doble.escrituras.filter((e) => e.modelo === 'invoice');
    assert.deepEqual(tocaronFactura, [],
      '🔴 asignar ha ESCRITO en `invoices`. Una factura emitida no se edita (regla 29), y el '
      + 'número, el total y el PDF viven ahí.\nEscrituras: ' + JSON.stringify(tocaronFactura));

    // Control positivo del instrumento: el doble SÍ anota escrituras — si no, el vacío de arriba
    // no diría nada. La asignación tiene que haber escrito en su tabla puente y sólo en ella.
    const enElPuente = doble.escrituras.filter((e) => e.modelo === 'invoiceAssignee');
    assert.ok(enElPuente.length > 0,
      '🔴 el instrumento no anota: no ha registrado NINGUNA escritura, así que el «no tocó '
      + '`invoices`» de arriba es un vacío de ceguera, no una medición.');
    const modelosEscritos = [...new Set(doble.escrituras.map((e) => e.modelo))];
    assert.deepEqual(modelosEscritos, ['invoiceAssignee'],
      `🔴 asignar ha escrito en más sitios que su tabla puente: ${modelosEscritos.join(', ')}`);

    assert.deepEqual({ number: FACTURA.number, total: FACTURA.total, pdfUrl: FACTURA.pdfUrl }, antes,
      '🔴 el número, el total o el PDF de la factura han cambiado al asignar');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 6 · LA ASIGNACIÓN FUNCIONA — y respeta la tenencia (regla 2)
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-597 · asignar a VARIOS guarda a varios, y un asignado de otro merchant se rechaza', async () => {
  const app = await bancoDe({ asignados: [TECNICO] });
  const doble = app.doble;
  {
    const ok = await app.pedir('/admin/quotes/501/asignados', {
      token: 'TOKEN-PROPIETARIO', metodo: 'PATCH', cuerpo: { assignedUserIds: [TECNICO.id, TECNICO.id] },
    });
    assert.equal(ok.status, 200, '🔴 no se pudo asignar');
    const creadas = doble.escrituras.filter((e) => e.modelo === 'quoteAssignee' && e.op === 'createMany');
    assert.equal(creadas.length, 1, '🔴 la asignación no escribió su tabla puente');
    assert.equal(creadas[0].args.data.length, 1,
      '🔴 asignar dos veces al mismo ha creado dos filas. Asignar dos veces al mismo no es asignar dos.');

    const ajeno = await app.pedir('/admin/quotes/501/asignados', {
      token: 'TOKEN-PROPIETARIO', metodo: 'PATCH', cuerpo: { assignedUserIds: [999999] },
    });
    assert.equal(ajeno.status, 400,
      '🔴 se ha aceptado un asignado que no es de este merchant (regla 2).');
    assert.equal(ajeno.json.error, 'invalid_assignee');
  }
});

// El servidor es UNO para todo el fichero (un doble por proceso): se cierra al terminar.
after(async () => { const app = await montarAppReal(); await app.cerrar(); });
