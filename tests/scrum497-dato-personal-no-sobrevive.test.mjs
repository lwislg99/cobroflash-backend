// tests/scrum497-dato-personal-no-sobrevive.test.mjs — SCRUM-497
//
// QUE UN DATO PERSONAL NO SOBREVIVA A UNA SUPRESIÓN, Y QUE LA LISTA QUE LO DECIDE TENGA GUARD.
//
// Sin gate, sin base de datos y sin red: derivación sobre el TEXTO del esquema y `suprimirMerchant`
// ejercitado con un `db` de mentira que registra lo que se le pide.
//
// ── LA VÍCTIMA ────────────────────────────────────────────────────────────────────────────
// Un profesional ejerce su derecho de supresión. El sistema deja constancia de que lo hizo —
// `merchant_anonimizado` en `auditLog`, con actor y base legal — y las direcciones de correo de sus
// clientes **siguen en claro** en `email_messages`. La constancia de haber cumplido, sin haber
// cumplido.
//
// ── 🔴 LA REGLA QUE GOBIERNA ESTE FICHERO ─────────────────────────────────────────────────
// **El arreglo que pone la suite en verde no siempre es el arreglo que cierra el agujero.** Aquí son
// distintos y se puede medir: añadir `emailMessage` a `ORDEN_BORRADO_MERCHANT` cierra los 3 rojos
// que quedaban de SCRUM-495 y NO cierra este hueco; añadirlo a `CAMPOS_PERSONALES` cierra el hueco
// y NO cierra ningún rojo. Hacer solo el primero habría apagado la única señal que quedaba.
//
// Por eso el ENTREGABLE de verdad no es el campo: es el guard. `CAMPOS_PERSONALES` era la única de
// las tres listas del merchant SIN vigilancia, y por eso fue la única que no saltó cuando nació la
// tabla.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  camposPersonalesDelSchema, repartir, leerSchema, VOCABULARIO_PERSONAL, nucleoDe,
} from './_censo-datos-personales.mjs';
import { CAMPOS_PERSONALES, REDACTADO, redaccionesPara } from '../dist/modules/system/domain/anonimizarMerchant.js';
import { suprimirMerchant } from '../dist/modules/system/domain/supresionMerchant.service.js';

const SCHEMA = leerSchema();

/**
 * Columnas personales que NO son de una persona. Falsos positivos del vocabulario, con su motivo.
 * Son dos y se dicen: una excepción sin motivo es una excepción que alguien acaba ampliando.
 */
const FUERA_DE_ANONIMIZADO = Object.freeze({
  'product.name': 'el nombre de un SERVICIO del catálogo («Desatasco»), no el de una persona',
  'quoteTemplate.name': 'el nombre de una PLANTILLA de presupuesto, no el de una persona',
  // SCRUM-1569d · `customerSite.name` estuvo aquí desde SCRUM-1014 con el motivo «el nombre del SITIO
  // que el profesional elige («Piso 3ºB»), no el de una persona». El fundador decidió lo contrario
  // («ok decidimos que sí», SCRUM-1569 c.20142): «Piso 3ºB» es media dirección. Sale y se anonimiza.
  // SCRUM-1569: lo hace visible el censo por núcleo («…Name»). Es el nombre de la plantilla de Meta
  // con que se mandó el mensaje: el hecho, no la persona (lo dice ya `anonimizarMerchant.ts`).
  'whatsAppMessage.templateName': 'el nombre de la PLANTILLA de Meta con que se mandó el mensaje, no el de una persona',
  // SCRUM-914 · lo hace visible el mismo censo por núcleo. Clasificado FUERA por J3 en
  // docs/master/SCRUM-914.md §② («`type`, `brand`, `modelName` (catálogo)»).
  'equipment.modelName': 'el MODELO de catálogo del aparato («ecoTEC plus»), no el de una persona',
});

// SCRUM-1569 · la misma pregunta para las 17 copias de la factura y el albarán. Se escribe una vez:
// diecisiete frases iguales a mano son diecisiete sitios donde una diverge.
const EN_DOCUMENTO_SELLABLE = (que) => `${que}, copiada dentro de un documento que puede estar SELLADO: `
  + '¿la conserva el 17.3.b o se redacta? Roza la regla 29 y espera al asesor fiscal (SCRUM-1264)';

/**
 * 🔴 EL TRINQUETE · datos personales que HOY NO se anonimizan, y nadie ha decidido si deben.
 *
 * Medido el 12-ago-2026 sobre `prisma/schema.prisma`. **No se arreglan aquí**: cada uno es una
 * calificación jurídica distinta y es del fundador. Lo que este fichero garantiza es que están
 * NOMBRADOS y que no puede aparecer un dieciseisavo sin que salte.
 *
 * `to_email` era el número 16 de esta lista hasta hoy. Se ha cerrado uno; quedan quince — y
 * SCRUM-1014 suma `customerSite.address` (misma pregunta que `job.direccion`): dieciséis.
 */
const SIN_DECIDIR = Object.freeze({
  'teamMember.name': '¿los datos de un EMPLEADO del profesional se van con la baja del profesional?',
  'teamMember.email': 'su correo es además su vía de acceso (AuthSession): ¿se anonimiza o se borra?',
  'provider.name': '¿el proveedor es un tercero con su propia relación, o dato del merchant?',
  'provider.email': '¿el correo de un proveedor se va con la baja de quien le compraba?',
  'provider.phone': '¿el teléfono de un proveedor se va con la baja de quien le compraba?',
  'provider.legalName': '¿la razón social del proveedor es dato personal si es autónomo?',
  'provider.taxId': '¿el NIF del proveedor va en las facturas recibidas que el 17.3.b conserva?',
  'provider.notes': 'texto libre del profesional sobre su proveedor: ¿se anonimiza o se conserva?',
  // SCRUM-1569d · `merchant.iban` y `merchant.bizumPhone` estuvieron aquí hasta el 21-oct-2026: el
  // fundador decidió que se anonimizan (SCRUM-1569 c.20142, «Ok tu recomendación»). Salen.
  'job.direccion': 'la dirección DONDE se trabajó — casi siempre el domicilio del cliente',
  'job.notes': 'texto libre del profesional sobre el trabajo y su cliente',
  'quote.internalNotes': 'texto libre, y va dentro de un documento que puede estar sellado (regla 29)',
  'expense.notes': 'texto libre; puede nombrar a un proveedor o a una persona',
  'botSession.phone': 'el teléfono del cliente que escribió por WhatsApp, antes de ser cliente',
  // SCRUM-1014: la dirección DEL SITIO — casi siempre una obra del propio cliente, misma
  // pregunta que `job.direccion` justo arriba.
  'customerSite.address': 'la dirección del sitio — casi siempre una obra del propio cliente, misma pregunta que job.direccion',
  // ── SCRUM-1569 · las diecinueve que el censo NO VEÍA. ────────────────────────────────────
  // No se han decidido HOY: estaban igual de en claro antes, y el censo por nombre exacto no sabía
  // leerlas. Entran aquí con su pregunta porque eso es lo único honesto que se puede hacer sin
  // decidir: que dejen de ser invisibles. ⛔ Ninguna pasa a `CAMPOS_PERSONALES` en este ticket.
  'customer.billingAddress': 'la dirección de facturación del cliente: ¿se redacta con su nombre, que ya se redacta?',
  'quote.shippingAddress': 'la dirección de envío del cliente, dentro de un presupuesto que puede estar sellado (regla 29)',
  'invoice.customerName': EN_DOCUMENTO_SELLABLE('el nombre del cliente'),
  'invoice.customerLegalName': EN_DOCUMENTO_SELLABLE('la razón social del cliente'),
  'invoice.customerTaxId': EN_DOCUMENTO_SELLABLE('el NIF del cliente'),
  'invoice.customerEmail': EN_DOCUMENTO_SELLABLE('el correo del cliente'),
  'invoice.customerPhone': EN_DOCUMENTO_SELLABLE('el teléfono del cliente'),
  'invoice.merchantName': EN_DOCUMENTO_SELLABLE('el nombre del profesional'),
  'invoice.merchantLegalName': EN_DOCUMENTO_SELLABLE('la razón social del profesional'),
  'invoice.merchantTaxId': EN_DOCUMENTO_SELLABLE('el NIF del profesional'),
  'invoice.merchantAddress': EN_DOCUMENTO_SELLABLE('la dirección del profesional'),
  'invoice.merchantPhone': EN_DOCUMENTO_SELLABLE('el teléfono del profesional'),
  'invoice.merchantEmail': EN_DOCUMENTO_SELLABLE('el correo del profesional'),
  'invoice.shippingAddress': EN_DOCUMENTO_SELLABLE('la dirección de envío del cliente'),
  'albaran.customerName': EN_DOCUMENTO_SELLABLE('el nombre del cliente'),
  'albaran.customerLegalName': EN_DOCUMENTO_SELLABLE('la razón social del cliente'),
  'albaran.customerTaxId': EN_DOCUMENTO_SELLABLE('el NIF del cliente'),
  'albaran.customerEmail': EN_DOCUMENTO_SELLABLE('el correo del cliente'),
  'albaran.customerPhone': EN_DOCUMENTO_SELLABLE('el teléfono del cliente'),
  // ── SCRUM-1569 · EL DOMICILIO EN TROZOS: los nueve que ninguna palabra del vocabulario leía. ──
  'customerSite.city': 'la ciudad del sitio: con `address`, el domicilio del cliente. Misma pregunta que customerSite.address',
  'customerSite.postalCode': 'el código postal del sitio: misma pregunta que customerSite.address',
  'customerSite.province': 'la provincia del sitio: misma pregunta que customerSite.address',
  'customerSite.country': 'el país del sitio: ¿identifica algo sin el resto de la dirección? Misma familia que customerSite.address',
  'customer.billingCity': 'la ciudad de facturación del cliente: misma pregunta que customer.billingAddress',
  'customer.billingPostalCode': 'el código postal de facturación del cliente: misma pregunta que customer.billingAddress',
  'customer.billingProvince': 'la provincia de facturación del cliente: misma pregunta que customer.billingAddress',
  'customer.billingCountry': 'el país de facturación del cliente: misma pregunta que customer.billingAddress',
  'merchant.country': 'el país del profesional: decide su régimen (ES o no); ¿se redacta con su dirección o es configuración?',
  // SCRUM-1569 · `customerSite.contactName` estuvo aquí como «DECIDIDO, falta la línea» hasta que J3
  // la metió en `anonimizarMerchant.ts` (20-oct-2026): ahora está cubierto y sale de esta lista.
});

// ── 0 · 🔴 SUELO Y AUTOPRUEBA · antes de creerse ningún reparto ─────────────────────────────

test('SCRUM-497 · 🔴 SUELO: la derivación ve las columnas personales del esquema real', () => {
  const personales = camposPersonalesDelSchema(SCHEMA);
  assert.ok(personales.length >= 25,
    `🔴 ESCÁNER CIEGO: la derivación ve ${personales.length} columnas personales y son 30 (medido el `
    + '12-ago-2026). Con menos, «ninguna sin clasificar» significa «no supe mirar», que es el mismo '
    + 'verde con el significado contrario.');

  // Y que el vocabulario no se haya quedado vacío: con él vacío, el cero de arriba sería trivial.
  assert.ok(VOCABULARIO_PERSONAL.length >= 10,
    `🔴 el vocabulario de dato personal trae ${VOCABULARIO_PERSONAL.length} nombres y son 15 (13 hasta SCRUM-529, que sumó \`toPhone\`; SCRUM-914 sumó \`serialNumber\`).`);
});

test('SCRUM-497 · 🔴 AUTOPRUEBA: la derivación distingue un dato personal de una bandera', () => {
  // «Ninguna columna personal sin clasificar» y «mi detector no reconoce una columna personal» salen
  // por la misma línea. Se prueba sobre esquema SINTÉTICO antes de creerse el reparto de abajo.
  const ve = (fuente) => camposPersonalesDelSchema(fuente).map((p) => p.clave);

  assert.deepEqual(ve('model Cosa {\n  email String\n}'), ['cosa.email'],
    '🔴 la derivación NO VE una columna de correo: con esto roto, el guard entero pasa en verde.');
  assert.deepEqual(ve('model Cosa {\n  toEmail String\n}'), ['cosa.toEmail'],
    '🔴 no ve `toEmail`, que es el campo que abrió este ticket.');
  assert.deepEqual(ve('model Cosa {\n  email String?\n}'), ['cosa.email'],
    '🔴 una columna personal OPCIONAL sigue siendo personal.');

  // 🔴 EL FILTRO DE TIPO, que es lo que evita 4 falsos positivos medidos en el esquema real.
  assert.deepEqual(ve('model Cosa {\n  notifyEmailOnPaid Boolean @default(true)\n}'), [],
    '🔴 una BANDERA que se llama «email» se cuenta como dato personal. Entonces el trinquete se '
    + 'llena de ruido y deja de señalar lo que importa — el defecto que este carril persigue.');
  assert.deepEqual(ve('model Cosa {\n  lifecycleEmailsSent Json?\n}'), [],
    '🔴 un Json de QUÉ correos se mandaron es el hecho, no la persona.');
  assert.deepEqual(ve('model Cosa {\n  total Decimal\n  numero Int\n}'), [],
    '🔴 la derivación marca como personal algo que no tiene nada que ver: clasifica al azar.');

  // Y no se cuela nada de fuera de un modelo (un `enum`, un comentario suelto).
  assert.deepEqual(ve('enum Estado {\n  email\n}'), [],
    '🔴 se está leyendo dentro de un `enum` como si fuera un modelo.');
});

// ── 1 · 🔴 EL TEST QUE DECIDE SI EL GUARD VALE: atado al HECHO, no a la lista de hoy ───────

test('SCRUM-497 · 🔴 un MODELO SINTÉTICO con un campo personal sin cubrir pone el guard EN ROJO', () => {
  // Si el guard solo cayera con `to_email`, estaría atado a la lista de hoy y se rompería con el
  // próximo modelo correcto — y alguien acabaría apagándolo. Esto prueba que cae con CUALQUIERA.
  const sintetico = `
model Merchant {
  name String
}
model Encuesta {
  respondentEmail String
  phone           String?
}
`;
  const reparto = repartir(sintetico, { merchant: ['name'] }, {}, {});
  assert.ok(reparto.sinClasificar.includes('encuesta.phone'),
    '🔴 EL GUARD NO ESTÁ ATADO AL HECHO.\n\n'
    + '  Se le ha dado un modelo que NO existe en el repo, con un teléfono dentro, y no lo ha\n'
    + `  señalado: dice ${JSON.stringify(reparto.sinClasificar)}.\n\n`
    + '  Entonces vigila la lista de hoy y no el hecho, y el día que nazca un modelo con un dato\n'
    + '  personal dentro pasará en verde — que es exactamente cómo `email_messages` entró con la\n'
    + '  dirección de los clientes y la supresión siguió sin tocarla.');

  // SCRUM-1569 · `respondentEmail` SÍ sale, y es el cambio de criterio: casa por NÚCLEO («…Email»).
  // Hasta SCRUM-1569 este aserto decía lo contrario y avisaba de revisar los falsos positivos
  // (`templateName`, `nameSearch`) antes de dar el cambio por bueno. Están revisados en
  // «SCRUM-1569 · CONTROL NEGATIVO del núcleo», abajo: no es una subcadena.
  assert.deepEqual([...reparto.sinClasificar].sort(), ['encuesta.phone', 'encuesta.respondentEmail'],
    '🔴 el censo por núcleo no ve `respondentEmail`: un correo con cualquier prefijo vuelve a ser '
    + `invisible. Dice ${JSON.stringify(reparto.sinClasificar)}.`);

  // CONTROL NEGATIVO: un modelo sintético SIN datos personales no pone nada en rojo.
  const limpio = repartir('model Factura {\n  numero String\n  total Decimal\n}', {}, {}, {});
  assert.deepEqual(limpio.sinClasificar, [],
    '🔴 el guard señala un modelo que no tiene ningún dato personal: entonces salta siempre y se '
    + 'acaba apagando.');
});

test('SCRUM-497 · 🔴 SUELO: con la lista de campos VACÍA el guard FALLA, no pasa', () => {
  const reparto = repartir(SCHEMA, {}, FUERA_DE_ANONIMIZADO, SIN_DECIDIR);
  assert.ok(reparto.sinClasificar.length >= 10,
    `🔴 con \`CAMPOS_PERSONALES\` VACÍA el guard solo ve ${reparto.sinClasificar.length} columnas sin `
    + 'clasificar. Tendría que ver las 13 que hoy cubre la lista: si no las ve, el verde de abajo no '
    + 'lo produce la lista, lo produce que el guard no mira.');
  assert.ok(reparto.sinClasificar.includes('emailMessage.toEmail'),
    '🔴 sin la lista, `emailMessage.toEmail` no sale como pendiente: el guard no lo estaba vigilando.');
});

// ── 2 · 🔴 EL GUARD SOBRE EL ÁRBOL REAL ────────────────────────────────────────────────────

test('SCRUM-497 · 🔴 ninguna columna personal del esquema queda SIN CLASIFICAR', () => {
  const reparto = repartir(SCHEMA, CAMPOS_PERSONALES, FUERA_DE_ANONIMIZADO, SIN_DECIDIR);

  assert.deepEqual(reparto.sinClasificar, [],
    '🔴 HAY COLUMNAS CON DATO PERSONAL QUE NADIE HA CLASIFICADO:\n    '
    + reparto.sinClasificar.join('\n    ') + '\n\n'
    + '  Una columna personal sin clasificar SOBREVIVE a una supresión del art. 17 sin que nada\n'
    + '  avise. Pasó con `email_messages.to_email`: la tabla nació, dos guards saltaron y éste no\n'
    + '  existía, así que la dirección de los clientes se quedó en claro.\n\n'
    + '  Elige UNA de las tres, y ninguna es «no hacer nada»:\n'
    + '    · va a `CAMPOS_PERSONALES` (se anonimiza en la supresión), o\n'
    + '    · va a `FUERA_DE_ANONIMIZADO` CON MOTIVO (no es el dato de una persona), o\n'
    + '    · va a `SIN_DECIDIR` con la PREGUNTA que hay que contestar (decide el fundador).');

  // Y las categorías SUMAN su total: un censo cuyas partes no suman no es un censo.
  const suma = reparto.cubiertos.length + reparto.fueraDeclarados.length
    + reparto.sinDecidir.length + reparto.sinClasificar.length;
  assert.equal(suma, reparto.total,
    `🔴 las categorías suman ${suma} y el total es ${reparto.total}: el reparto pierde columnas por `
    + 'el camino, así que ninguno de sus números significa nada.');
});

test('SCRUM-497 · 🔴 TRINQUETE: cuarenta y dos datos personales siguen sin anonimizar, y van NOMBRADOS', () => {
  const reparto = repartir(SCHEMA, CAMPOS_PERSONALES, FUERA_DE_ANONIMIZADO, SIN_DECIDIR);

  // 🔴 EL SUELO VA PRIMERO: cero no es mejor que dieciséis. Si baja, lo primero que hay que
  // descartar es que el detector haya dejado de ver — pasó dos veces esta semana en este repo.
  assert.ok(reparto.sinDecidir.length >= 1,
    '🔴 EL TRINQUETE DA CERO Y ERAN DIECISÉIS.\n\n'
    + '  Si de verdad se han decidido los dieciséis, enhorabuena: mueve cada uno a `CAMPOS_PERSONALES`\n'
    + '  o a `FUERA_DE_ANONIMIZADO` y baja este número a mano, en el mismo commit.\n'
    + '  Si no, el censo ha dejado de verlos y «cero pendientes» significa «no supe mirar».');

  assert.equal(reparto.sinDecidir.length, 42,
    `🔴 el trinquete da ${reparto.sinDecidir.length} pendientes y eran 42 (SCRUM-1569d restó \`merchant.iban\` ` +
    'y `merchant.bizumPhone` el 21-oct-2026, decididos por el fundador en c.20142; SCRUM-1569 sumó, el 20-oct-2026 ' +
    'y sobre 16, las 19 que el censo por nombre exacto no veía, los 9 trozos de domicilio y ' +
    '`customerSite.contactName`, que bajó a 44 el mismo día al entrar su línea en J3; SCRUM-1014 sumó ' +
    `\`customerSite.address\` el 25-sep-2026, sobre 15 medidos el 12-ago-2026).\n`
    + `    ${reparto.sinDecidir.join('\n    ')}\n\n`
    + '  Si SUBE, ha nacido un dato personal que nadie anonimiza: nómbralo o cúbrelo.\n'
    + '  Si BAJA, comprueba PRIMERO que no sea el censo el que dejó de ver.');

  // Cada pendiente lleva su PREGUNTA, no solo su nombre. Un trinquete de nombres sin pregunta no
  // se puede resolver: el siguiente no sabe qué hay que decidir.
  for (const clave of reparto.sinDecidir) {
    assert.ok((SIN_DECIDIR[clave] || '').length >= 20,
      `🔴 «${clave}» está en el trinquete sin decir QUÉ hay que decidir sobre él.`);
  }

  // Y las dos excepciones llevan motivo, por lo mismo.
  for (const [clave, motivo] of Object.entries(FUERA_DE_ANONIMIZADO)) {
    assert.ok(motivo.length >= 20, `🔴 «${clave}» está declarada fuera sin motivo escrito.`);
  }
});

// ── 3 · 🔴 CONTROL POSITIVO · la dirección desaparece Y LA FILA SIGUE AHÍ ───────────────────

test('SCRUM-497 · 🔴 tras suprimir, ninguna dirección es recuperable y las filas SIGUEN', async () => {
  // Las dos cosas en el MISMO test a propósito: si solo se comprobara la primera, **un borrado la
  // pasaría** — y borrar la fila destruiría la constancia del envío, que el art. 17.3.b conserva.
  const pedidos = [];
  const db = new Proxy({}, {
    get(_d, modelo) {
      if (modelo === 'auditLog') {
        return { create: async (args) => { pedidos.push({ modelo, op: 'create', args }); return { id: 1 }; } };
      }
      return {
        updateMany: async (args) => { pedidos.push({ modelo, op: 'updateMany', args }); return { count: 3 }; },
        deleteMany: async (args) => { pedidos.push({ modelo, op: 'deleteMany', args }); return { count: 3 }; },
      };
    },
  });

  const r = await suprimirMerchant({
    merchantId: 77,
    actor: { tipo: 'merchant', teamMemberId: null },
    db,
    auditar: async () => ({ id: 1 }),
  });
  assert.ok(r.ok, `🔴 la supresión ha fallado: ${r.motivo}`);

  const delCorreo = pedidos.filter((p) => p.modelo === 'emailMessage');
  assert.equal(delCorreo.length, 1,
    '🔴 LA SUPRESIÓN NO TOCA `emailMessage`.\n\n'
    + '  El profesional ejerce su derecho, queda constancia de que lo ejerció, y las direcciones de\n'
    + '  correo de sus clientes siguen en claro. Añade `emailMessage` a `CAMPOS_PERSONALES`.');

  // ① NINGÚN BORRADO. La fila es la constancia del envío y se conserva (art. 17.3.b).
  assert.equal(delCorreo[0].op, 'updateMany',
    `🔴 a \`emailMessage\` se le ha pedido un \`${delCorreo[0].op}\` y tiene que ser un \`updateMany\`.\n\n`
    + '  Borrar la fila destruye la constancia de que el correo se envió — el HECHO, que sobrevive.\n'
    + '  Lo que desaparece es la DIRECCIÓN. Un registro de envíos sin destinatario sigue\n'
    + '  acreditando el envío, que es para lo que existe.');
  assert.ok(!pedidos.some((p) => p.op === 'deleteMany'),
    `🔴 la supresión está BORRANDO filas: ${pedidos.filter((p) => p.op === 'deleteMany').map((p) => p.modelo).join(', ')}`);

  // ② LA DIRECCIÓN, REDACTADA. Y filtrada por el merchant: sin `where` se llevaría las de todos.
  assert.deepEqual(delCorreo[0].args.data, { toEmail: REDACTADO },
    `🔴 no se redacta la dirección: ${JSON.stringify(delCorreo[0].args.data)}`);
  assert.deepEqual(delCorreo[0].args.where, { merchantId: 77 },
    `🔴 la redacción de \`emailMessage\` no va filtrada por merchant: ${JSON.stringify(delCorreo[0].args.where)}`);

  // ③ Y el texto no se parece a un correo: un marcador que parezca un dato se lee como un dato.
  assert.ok(!/@/.test(REDACTADO),
    `🔴 el texto de redacción contiene una arroba y se leerá como una dirección: «${REDACTADO}»`);
  assert.equal(redaccionesPara('emailMessage').toEmail, REDACTADO);
});

// ── 4 · 🔴 SCRUM-529 · EL NÚMERO AL QUE SE MANDÓ UN WHATSAPP ───────────────────────────────
//
// `whatsapp_messages.to_phone` es el teléfono del cliente guardado fuera de `customers`. Lo midió
// jv-j2a antes de empujar la columna: el censo casa por NOMBRE EXACTO, `toPhone` no estaba en el
// vocabulario, y el esquema con la columna puesta daba las mismas 33 columnas personales que sin
// ella. El guard habría salido verde con el teléfono en claro.
//
// 🔴 LOS DOS CASOS VAN SEMBRADOS, no prestados del árbol: el esquema es sintético y la lista
// «anonimizado que se deja `toPhone`» se fabrica aquí. Si se apoyaran en `prisma/schema.prisma`,
// el día que la columna cambie de nombre se quedarían mudos y seguirían en verde.

test('SCRUM-529 · 🔴 SIEMBRA: un anonimizado que deja `toPhone` en claro pone el guard EN ROJO', () => {
  const conLaColumna = `
model Customer {
  phone String?
}
model WhatsAppMessage {
  merchantId Int     @map("merchant_id")
  status     String  @default("queued")
  toPhone    String? @map("to_phone")
}
`;
  // ① El censo VE la columna. Antes de SCRUM-529 no la veía, y todo lo de abajo era verde por eso.
  assert.deepEqual(camposPersonalesDelSchema(conLaColumna).map((p) => p.clave),
    ['customer.phone', 'whatsAppMessage.toPhone'],
    '🔴 el censo NO VE `whatsAppMessage.toPhone`: `toPhone` ha salido del vocabulario, y un teléfono '
    + 'de cliente guardado fuera de `customers` vuelve a ser invisible para este guard.');

  // ② LA SIEMBRA: la lista de anonimizado de verdad, SIN la entrada de `whatsAppMessage`. Es el
  //    anonimizado que redacta `customer.phone` y deja el mismo número en `whatsapp_messages`.
  const seLoDeja = Object.fromEntries(Object.entries(CAMPOS_PERSONALES).filter(([m]) => m !== 'whatsAppMessage'));
  assert.ok(!('whatsAppMessage' in seLoDeja) && 'customer' in seLoDeja,
    '🔴 la siembra no se ha aplicado: la lista fabricada tendría que perder `whatsAppMessage` y conservar `customer`.');
  assert.deepEqual(repartir(conLaColumna, seLoDeja, {}, {}).sinClasificar, ['whatsAppMessage.toPhone'],
    '🔴 un anonimizado que NO toca `whatsAppMessage.toPhone` pasa el guard: se redactaría el teléfono '
    + 'de la ficha del cliente y el mismo número quedaría en claro en el registro de envíos.');

  // ③ Y con la lista REAL, cubierto. Sin esto, ② podría caer porque el guard cae siempre.
  const real = repartir(conLaColumna, CAMPOS_PERSONALES, {}, {});
  assert.deepEqual(real.sinClasificar, [],
    `🔴 la lista real no cubre \`whatsAppMessage.toPhone\`: ${JSON.stringify(real.sinClasificar)}`);
  assert.deepEqual(real.cubiertos, ['customer.phone', 'whatsAppMessage.toPhone']);
});

test('SCRUM-529 · 🔴 tras suprimir, el número de cada WhatsApp se redacta y la fila SIGUE', async () => {
  // Mismo criterio que `emailMessage.toEmail` y mismos tres asertos: redactado, sin borrar, y
  // filtrado por el merchant. La fila acredita el envío; lo que desaparece es el destinatario.
  const pedidos = [];
  const db = new Proxy({}, {
    get(_d, modelo) {
      if (modelo === 'auditLog') {
        return { create: async (args) => { pedidos.push({ modelo, op: 'create', args }); return { id: 1 }; } };
      }
      return {
        updateMany: async (args) => { pedidos.push({ modelo, op: 'updateMany', args }); return { count: 3 }; },
        deleteMany: async (args) => { pedidos.push({ modelo, op: 'deleteMany', args }); return { count: 3 }; },
      };
    },
  });

  const r = await suprimirMerchant({
    merchantId: 77,
    actor: { tipo: 'merchant', teamMemberId: null },
    db,
    auditar: async () => ({ id: 1 }),
  });
  assert.ok(r.ok, `🔴 la supresión ha fallado: ${r.motivo}`);

  const delWhatsApp = pedidos.filter((p) => p.modelo === 'whatsAppMessage');
  assert.equal(delWhatsApp.length, 1,
    '🔴 LA SUPRESIÓN NO TOCA `whatsAppMessage`: el número al que se mandó cada mensaje sobrevive en '
    + 'claro. Añade `whatsAppMessage: [\'toPhone\']` a `CAMPOS_PERSONALES`.');
  assert.equal(delWhatsApp[0].op, 'updateMany',
    `🔴 a \`whatsAppMessage\` se le ha pedido un \`${delWhatsApp[0].op}\`: la fila es la constancia del envío y se conserva.`);
  assert.deepEqual(delWhatsApp[0].args.data, { toPhone: REDACTADO },
    `🔴 no se redacta el número, o se redacta algo más que el número: ${JSON.stringify(delWhatsApp[0].args.data)}`);
  assert.deepEqual(delWhatsApp[0].args.where, { merchantId: 77 },
    `🔴 la redacción de \`whatsAppMessage\` no va filtrada por merchant: ${JSON.stringify(delWhatsApp[0].args.where)}`);

  // Y el marcador no se parece a un teléfono: uno que parezca un dato se lee como un dato.
  assert.ok(!/\d/.test(REDACTADO),
    `🔴 el texto de redacción lleva cifras y se leerá como un número: «${REDACTADO}»`);
});

test('SCRUM-497 · CONTROL: la supresión sigue cubriendo merchant y customer, no solo el correo', () => {
  // Un cambio en esta lista podría haberse llevado por delante lo que ya cubría. Se comprueba que
  // los doce campos de antes siguen, no solo el nuevo.
  // SCRUM-1569d suma `bizumPhone`, `iban` y `clabe` a `merchant` y `mobile` a `customer` (c.20142).
  assert.deepEqual([...CAMPOS_PERSONALES.merchant],
    ['name', 'email', 'legalName', 'taxId', 'address', 'whatsappPhone', 'bizumPhone', 'iban', 'clabe'],
    '🔴 han cambiado los campos personales de `merchant`.');
  assert.deepEqual([...CAMPOS_PERSONALES.customer],
    ['name', 'phone', 'email', 'legalName', 'taxId', 'notes', 'mobile'],
    '🔴 han cambiado los campos personales de `customer`.');
  assert.deepEqual([...CAMPOS_PERSONALES.emailMessage], ['toEmail'],
    '🔴 han cambiado los campos personales de `emailMessage`.');
  assert.deepEqual([...CAMPOS_PERSONALES.whatsAppMessage], ['toPhone'],
    '🔴 han cambiado los campos personales de `whatsAppMessage`.');
});

// ── 5 · 🔴 SCRUM-1569 · EL NOMBRE DE UNA PERSONA QUE EL CENSO NO SABÍA LEER ─────────────────
//
// `customerSite.contactName` es el contacto en obra (el portero, el inquilino). Se quedaba en claro
// después de suprimir, y el guard estaba en verde porque casaba por NOMBRE EXACTO: `name` sí,
// `contactName` no. Ahora casa también por NÚCLEO (`NUCLEOS_PERSONALES`, en el censo).
//
// Los casos van SEMBRADOS, con un esquema sintético, por lo mismo que los de SCRUM-529.

test('SCRUM-1569 · 🔴 SIEMBRA: un anonimizado que deja `contactName` en claro pone el guard EN ROJO', () => {
  const conElSitio = `
model CustomerSite {
  merchantId  Int     @map("merchant_id")
  name        String
  contactName String? @map("contact_name")
  phone       String? @map("phone")
}
`;
  // ① El censo VE la columna. Antes de SCRUM-1569 no la veía: lo de abajo salía verde por eso.
  assert.ok(camposPersonalesDelSchema(conElSitio).some((p) => p.clave === 'customerSite.contactName'),
    '🔴 el censo NO VE `customerSite.contactName`: el nombre de una persona vuelve a ser invisible '
    + 'porque no se llama exactamente `name`. Mira `nucleoDe` en `tests/_censo-datos-personales.mjs`.');

  // ② LA SIEMBRA: la lista de verdad, con `customerSite` sin `contactName`. (`name` se queda dentro
  //    desde SCRUM-1569d para que la siembra aísle a `contactName`; `name` tiene su siembra abajo.)
  const seLoDeja = { ...CAMPOS_PERSONALES, customerSite: ['phone', 'name'] };
  const fuera = {};
  assert.deepEqual(repartir(conElSitio, seLoDeja, fuera, {}).sinClasificar, ['customerSite.contactName'],
    '🔴 un anonimizado que NO toca `contactName` pasa el guard: se redactaría el teléfono del contacto '
    + 'en obra y su nombre quedaría en claro al lado.');

  // ③ Y con `contactName` en la lista, cubierto. Sin esto, ② podría caer porque el guard cae siempre.
  //    La lista es FABRICADA a propósito: la real no lo lleva hasta que J3 meta su línea (ver
  //    `SIN_DECIDIR`), y este caso tiene que valer antes y después de ese commit.
  const conLaLinea = { ...CAMPOS_PERSONALES, customerSite: ['phone', 'contactName', 'name'] };
  const cubierto = repartir(conElSitio, conLaLinea, fuera, {});
  assert.deepEqual(cubierto.sinClasificar, [],
    `🔴 con \`contactName\` en la lista, el guard sigue sin darlo por cubierto: ${JSON.stringify(cubierto.sinClasificar)}`);
  assert.deepEqual(cubierto.cubiertos, ['customerSite.name', 'customerSite.contactName', 'customerSite.phone']);
});

test('SCRUM-1569 · 🔴 CONTROL POSITIVO del domicilio: los trozos sin palabra del vocabulario SALEN', () => {
  // Ninguno de estos cuatro contiene una de las 14 palabras: eran el cero que c.20092 declaró sin
  // medir. Si dejan de salir, el censo ha vuelto a no ver el domicilio de una persona.
  const reales = new Set(camposPersonalesDelSchema(SCHEMA).map((p) => p.clave));
  for (const clave of ['customerSite.city', 'customerSite.postalCode', 'customerSite.province', 'customerSite.country']) {
    assert.ok(reales.has(clave), `🔴 «${clave}» no sale en el censo: el domicilio del cliente vuelve a ser invisible.`);
  }
  assert.ok(reales.has('customerSite.contactName'), '🔴 «customerSite.contactName» no sale en el censo.');
});

test('SCRUM-1569 · 🔴 CONTROL NEGATIVO del núcleo: ensanchar no es abrir', () => {
  // Si el núcleo se convirtiera en una subcadena, estos entrarían como «datos personales» y el
  // trinquete se llenaría de ruido. Son los tres falsos positivos medidos el 20-oct-2026 en c.20092.
  for (const campo of ['nameSearch', 'shippingAddressMode', 'emailVerified', 'countryCode', 'notesCount', 'filename']) {
    assert.equal(nucleoDe(campo), null, `🔴 «${campo}» casa como dato personal: el núcleo se ha vuelto una subcadena.`);
  }
  // ⚠️ LÍMITE DECLARADO, no un caso correcto: `surname`, `nif`, `dni`, `city` o `postalCode` tampoco
  // casan, y algunos SÍ son personales. El núcleo sólo ve las familias que ya conoce; las columnas que
  // ninguna familia lee están contadas y listadas en `docs/master/SCRUM-1569.md`, sin clasificar.
  assert.equal(nucleoDe('surname'), null,
    '🟢 ha cambiado el límite: `surname` ya casa. Quita este aserto y comprueba qué más entró.');
  // Y los que SÍ tienen que casar, para que el cero de arriba no sea un detector apagado.
  for (const [campo, n] of [['contactName', 'name'], ['customerTaxId', 'taxId'], ['billingAddress', 'address'],
    ['respondentEmail', 'email'], ['toPhone', 'phone'], ['internalNotes', 'notes'], ['name', 'name']]) {
    assert.equal(nucleoDe(campo), n, `🔴 «${campo}» no casa con el núcleo «${n}».`);
  }
  // Sobre el ESQUEMA REAL: los tres falsos positivos siguen fuera de la población.
  const reales = new Set(camposPersonalesDelSchema(SCHEMA).map((p) => p.clave));
  for (const clave of ['product.nameSearch', 'quote.shippingAddressMode', 'invoice.shippingAddressMode']) {
    assert.ok(!reales.has(clave), `🔴 «${clave}» entra en el censo como dato personal y no lo es.`);
  }
  // Y lo que el núcleo abrió y NO es personal está declarado fuera, CON motivo. No se cuela callado.
  assert.ok(reales.has('whatsAppMessage.templateName') && FUERA_DE_ANONIMIZADO['whatsAppMessage.templateName'],
    '🔴 `templateName` tiene que estar en la población Y declarado fuera con su motivo.');
});

test('SCRUM-1569 · 🔴 tras suprimir, el sitio pierde lo declarado y NADA MÁS', async () => {
  const pedidos = [];
  const db = new Proxy({}, {
    get(_d, modelo) {
      if (modelo === 'auditLog') return { create: async () => ({ id: 1 }) };
      return {
        updateMany: async (args) => { pedidos.push({ modelo, op: 'updateMany', args }); return { count: 1 }; },
        deleteMany: async (args) => { pedidos.push({ modelo, op: 'deleteMany', args }); return { count: 1 }; },
      };
    },
  });
  const r = await suprimirMerchant({ merchantId: 77, actor: { tipo: 'merchant', teamMemberId: null }, db, auditar: async () => ({ id: 1 }) });
  assert.ok(r.ok, `🔴 la supresión ha fallado: ${r.motivo}`);

  const delSitio = pedidos.filter((p) => p.modelo === 'customerSite');
  assert.equal(delSitio.length, 1, '🔴 la supresión no toca `customerSite`.');
  assert.equal(delSitio[0].op, 'updateMany', '🔴 a `customerSite` se le pide un borrado: la fila se conserva.');
  assert.deepEqual(delSitio[0].args.where, { merchantId: 77 }, '🔴 la redacción del sitio no va filtrada por merchant.');

  // 🔴 CONTROL NEGATIVO: lo que no se ha declarado personal NO se toca — los trozos del domicilio
  // esperan decisión. Anonimizar de más también es un fallo: es el que nadie mira. (`name` estuvo en
  // esta lista hasta SCRUM-1569d: el fundador decidió en c.20142 que se anonimiza.)
  const tocados = Object.keys(delSitio[0].args.data);
  for (const intacto of ['address', 'city', 'postalCode', 'province', 'country', 'merchantId', 'customerId']) {
    assert.ok(!tocados.includes(intacto), `🔴 la supresión redacta \`customerSite.${intacto}\` y nadie lo ha decidido: ${JSON.stringify(delSitio[0].args.data)}`);
  }
  assert.deepEqual([...tocados].sort(), [...CAMPOS_PERSONALES.customerSite].sort(),
    `🔴 se redacta del sitio algo distinto de lo que dice \`CAMPOS_PERSONALES\`: ${JSON.stringify(delSitio[0].args.data)}`);
  assert.equal(delSitio[0].args.data.phone, REDACTADO, '🔴 el teléfono del contacto en obra no se redacta.');
  assert.equal(delSitio[0].args.data.name, REDACTADO,
    '🔴 el nombre del sitio («Piso 3ºB») no se redacta, y el fundador decidió que sí (SCRUM-1569 c.20142).');
});

// ── 6 · 🔴 SCRUM-1569d · LOS CINCO QUE DECIDIÓ EL FUNDADOR (SCRUM-1569 c.20142) ─────────────────
//
// ① «Ok tu recomendación»: `customer.mobile`, `merchant.iban`, `merchant.clabe` y `merchant.bizumPhone`.
// ② «ok decidimos que sí»: `customerSite.name`.
// Producción tenía víctimas el 21-oct-2026: 1 cliente con móvil, 4 comercios con IBAN, 2 con Bizum.
// Ejecutado en PGlite, antes y después: `docs/master/evidencias/SCRUM-1569d/`.

const LOS_CINCO = Object.freeze([
  ['merchant', 'iban'], ['merchant', 'clabe'], ['merchant', 'bizumPhone'],
  ['customer', 'mobile'], ['customerSite', 'name'],
]);

test('SCRUM-1569d · 🔴 tras suprimir, los cinco de c.20142 se redactan y las filas SIGUEN', async () => {
  const pedidos = [];
  const db = new Proxy({}, {
    get(_d, modelo) {
      if (modelo === 'auditLog') return { create: async () => ({ id: 1 }) };
      return {
        updateMany: async (args) => { pedidos.push({ modelo, op: 'updateMany', args }); return { count: 1 }; },
        deleteMany: async (args) => { pedidos.push({ modelo, op: 'deleteMany', args }); return { count: 1 }; },
      };
    },
  });
  const r = await suprimirMerchant({ merchantId: 77, actor: { tipo: 'merchant', teamMemberId: null }, db, auditar: async () => ({ id: 1 }) });
  assert.ok(r.ok, `🔴 la supresión ha fallado: ${r.motivo}`);
  assert.ok(!pedidos.some((p) => p.op === 'deleteMany'), '🔴 la supresión está BORRANDO filas.');

  const sinRedactar = LOS_CINCO.filter(([modelo, campo]) => {
    const p = pedidos.find((x) => x.modelo === modelo);
    return !p || p.args.data[campo] !== REDACTADO;
  }).map(([m, c]) => `${m}.${c}`);
  assert.deepEqual(sinRedactar, [],
    `🔴 la supresión deja EN CLARO ${sinRedactar.join(', ')}, y el fundador decidió que se anonimizan `
    + '(SCRUM-1569 c.20142). Añádelos a `CAMPOS_PERSONALES` en `anonimizarMerchant.ts`.');

  // CONTROL NEGATIVO: el país del profesional sigue SIN DECIDIR, y no se toca de paso.
  const delComercio = pedidos.find((x) => x.modelo === 'merchant');
  assert.ok(!('country' in delComercio.args.data), '🔴 la supresión redacta `merchant.country` y nadie lo ha decidido.');
});

test('SCRUM-1569d · 🔴 SIEMBRA: el censo VE `mobile` y `clabe`, y una lista que los suelta cae', () => {
  // Sin esto, quitar `mobile` o `clabe` de la lista no lo vería nadie: ninguna familia del censo los leía
  // (estaban en las 157 de SCRUM-1569). Esquema sintético, por lo mismo que las siembras de arriba.
  const sintetico = `
model Merchant {
  name  String
  iban  String?
  clabe String?
}
model Customer {
  phone  String?
  mobile String? @map("mobile")
}
`;
  const ve = camposPersonalesDelSchema(sintetico).map((p) => p.clave);
  for (const clave of ['merchant.clabe', 'customer.mobile']) {
    assert.ok(ve.includes(clave), `🔴 el censo NO VE «${clave}»: vuelve a ser invisible y nadie se enterará si sale de la lista.`);
  }
  const seLosDeja = { merchant: ['name', 'iban'], customer: ['phone'] };
  assert.deepEqual(repartir(sintetico, seLosDeja, {}, {}).sinClasificar, ['merchant.clabe', 'customer.mobile'],
    '🔴 una lista sin `clabe` ni `mobile` pasa el guard.');
  assert.deepEqual(repartir(sintetico, CAMPOS_PERSONALES, {}, {}).sinClasificar, [],
    '🔴 la lista REAL no cubre los cuatro del esquema sintético.');
});
