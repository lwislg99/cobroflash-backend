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
  camposPersonalesDelSchema, repartir, leerSchema, VOCABULARIO_PERSONAL,
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
});

/**
 * 🔴 EL TRINQUETE · datos personales que HOY NO se anonimizan, y nadie ha decidido si deben.
 *
 * Medido el 12-ago-2026 sobre `prisma/schema.prisma`. **No se arreglan aquí**: cada uno es una
 * calificación jurídica distinta y es del fundador. Lo que este fichero garantiza es que están
 * NOMBRADOS y que no puede aparecer un dieciseisavo sin que salte.
 *
 * `to_email` era el número 16 de esta lista hasta hoy. Se ha cerrado uno; quedan quince.
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
  'merchant.iban': '¿es dato personal o parte del registro de cobros que el 17.3.b conserva?',
  'merchant.bizumPhone': 'teléfono del profesional usado como medio de cobro: misma pregunta que el IBAN',
  'job.direccion': 'la dirección DONDE se trabajó — casi siempre el domicilio del cliente',
  'job.notes': 'texto libre del profesional sobre el trabajo y su cliente',
  'quote.internalNotes': 'texto libre, y va dentro de un documento que puede estar sellado (regla 29)',
  'expense.notes': 'texto libre; puede nombrar a un proveedor o a una persona',
  'botSession.phone': 'el teléfono del cliente que escribió por WhatsApp, antes de ser cliente',
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
    `🔴 el vocabulario de dato personal trae ${VOCABULARIO_PERSONAL.length} nombres y son 13.`);
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
  assert.deepEqual(reparto.sinClasificar, ['encuesta.phone'],
    '🔴 EL GUARD NO ESTÁ ATADO AL HECHO.\n\n'
    + '  Se le ha dado un modelo que NO existe en el repo, con un teléfono dentro, y no lo ha\n'
    + `  señalado: dice ${JSON.stringify(reparto.sinClasificar)}.\n\n`
    + '  Entonces vigila la lista de hoy y no el hecho, y el día que nazca un modelo con un dato\n'
    + '  personal dentro pasará en verde — que es exactamente cómo `email_messages` entró con la\n'
    + '  dirección de los clientes y la supresión siguió sin tocarla.');

  // ⚠️ `respondentEmail` NO sale, y es correcto: el vocabulario es DECLARADO y ese nombre no está.
  // Se dice aquí para que el límite del guard se vea en vez de descubrirse el día que falle.
  assert.ok(!reparto.sinClasificar.includes('encuesta.respondentEmail'),
    '🔴 ha cambiado el criterio del vocabulario: si ahora casa por subcadena, revisa los falsos '
    + 'positivos (`templateName`, `nameSearch`) antes de darlo por bueno.');

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

test('SCRUM-497 · 🔴 TRINQUETE: quince datos personales siguen sin decidir, y van NOMBRADOS', () => {
  const reparto = repartir(SCHEMA, CAMPOS_PERSONALES, FUERA_DE_ANONIMIZADO, SIN_DECIDIR);

  // 🔴 EL SUELO VA PRIMERO: cero no es mejor que quince. Si baja, lo primero que hay que descartar
  // es que el detector haya dejado de ver — pasó dos veces esta semana en este mismo repo.
  assert.ok(reparto.sinDecidir.length >= 1,
    '🔴 EL TRINQUETE DA CERO Y ERAN QUINCE.\n\n'
    + '  Si de verdad se han decidido los quince, enhorabuena: mueve cada uno a `CAMPOS_PERSONALES`\n'
    + '  o a `FUERA_DE_ANONIMIZADO` y baja este número a mano, en el mismo commit.\n'
    + '  Si no, el censo ha dejado de verlos y «cero pendientes» significa «no supe mirar».');

  assert.equal(reparto.sinDecidir.length, 15,
    `🔴 el trinquete da ${reparto.sinDecidir.length} pendientes y eran 15 (medido el 12-ago-2026).\n`
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

test('SCRUM-497 · CONTROL: la supresión sigue cubriendo merchant y customer, no solo el correo', () => {
  // Un cambio en esta lista podría haberse llevado por delante lo que ya cubría. Se comprueba que
  // los doce campos de antes siguen, no solo el nuevo.
  assert.deepEqual([...CAMPOS_PERSONALES.merchant],
    ['name', 'email', 'legalName', 'taxId', 'address', 'whatsappPhone'],
    '🔴 han cambiado los campos personales de `merchant`.');
  assert.deepEqual([...CAMPOS_PERSONALES.customer],
    ['name', 'phone', 'email', 'legalName', 'taxId', 'notes'],
    '🔴 han cambiado los campos personales de `customer`.');
  assert.deepEqual([...CAMPOS_PERSONALES.emailMessage], ['toEmail'],
    '🔴 han cambiado los campos personales de `emailMessage`.');
});
