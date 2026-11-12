// tests/_censo-datos-personales.mjs — SCRUM-497
//
// QUÉ COLUMNAS DEL ESQUEMA GUARDAN UN DATO PERSONAL, DERIVADO DEL ESQUEMA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ ESTO NO PUEDE SER UNA LISTA A MANO, Y POR QUÉ TAMPOCO PUEDE SER SOLO DERIVADO
//
// `CAMPOS_PERSONALES` decide qué se anonimiza cuando alguien ejerce su derecho de supresión, y
// hasta SCRUM-497 **no la vigilaba nadie**. Los otros dos registros del merchant —el barrido del
// fixture y el orden de borrado— sí tienen guard, y por eso saltaron los 11 rojos cuando nació
// `email_messages`. Ésta no saltó: la tabla entró con la dirección de correo de los clientes dentro
// y la supresión siguió sin tocarla, en silencio.
//
// Un guard atado a LA LISTA DE HOY («que tenga estos 13 campos») se rompe con el próximo modelo
// correcto y alguien acaba apagándolo. Así que se ata al HECHO: **ninguna columna que guarde un
// dato personal queda sin clasificar.**
//
// Y el hecho tiene dos mitades, una derivada y una declarada — decirlo importa:
//
//   · DERIVADO del esquema: qué modelos y qué columnas existen, y de qué tipo son. Eso se mide, y
//     es lo que hace que un modelo nuevo con un `email` dentro ponga el guard en rojo el mismo día.
//   · DECLARADO aquí: QUÉ NOMBRES DE COLUMNA cuentan como dato personal. Eso no se puede derivar
//     —es una calificación jurídica, no una propiedad del texto— y por eso está escrito y no
//     adivinado. Es la misma elección que `INTOCABLES` en `anonimizarMerchant.ts`: explícita a
//     propósito, para que se vea y se discuta.
//
// ⚠️ EL FILTRO DE TIPO ES MECÁNICO Y HACE FALTA: sin él, `notifyEmailOnPaid` (un Boolean),
// `notifyEmailWeeklyDigest` y `lifecycleEmailsSent` (un Json de qué correos se mandaron) entran por
// llamarse «email» y no son datos de nadie: son banderas y hechos. Medido: son 4 falsos positivos
// que el filtro `String` quita solo.
import fs from 'node:fs';
import path from 'node:path';

export const RUTA_SCHEMA = path.join(path.resolve(import.meta.dirname, '..'), 'prisma', 'schema.prisma');

/**
 * LOS NOMBRES DE COLUMNA QUE CUENTAN COMO DATO PERSONAL. Declarado, no derivado (ver cabecera).
 *
 * Cada uno está aquí porque identifica o localiza a una persona: la que contrata, la que trabaja,
 * la que cobra o la que recibe un correo. `notes` y `internalNotes` entran porque son TEXTO LIBRE
 * escrito por una persona sobre otra — el sitio donde acaban los datos que nadie previó.
 */
export const VOCABULARIO_PERSONAL = Object.freeze([
  'email', 'toEmail',                       // direcciones de correo
  'phone', 'whatsappPhone', 'bizumPhone',   // teléfonos
  'toPhone',                                // el número al que se mandó un WhatsApp (SCRUM-529)
  'name', 'legalName',                      // nombres
  'taxId',                                  // NIF/CIF
  'address', 'direccion',                   // domicilios y direcciones de trabajo
  'notes', 'internalNotes',                 // texto libre sobre personas
  'iban',                                   // cuenta bancaria
  // SCRUM-1569d · el móvil del cliente y la cuenta mexicana: ninguna familia los leía (estaban en las
  // 157 de SCRUM-1569), así que quitarlos de `CAMPOS_PERSONALES` no lo habría visto nadie.
  'mobile', 'clabe',
]);

/**
 * 🔴 SCRUM-1569 · LOS NÚCLEOS: casar por FAMILIA, no sólo por el nombre que ya se conocía.
 *
 * Con la lista exacta sola, el censo veía `phone` y no `contactName`: el nombre de una persona se
 * quedaba en claro tras suprimir y el guard seguía verde, porque una columna que el vocabulario no
 * sabe leer no está «fuera», **no existe** para el instrumento. Nadie la decidió y nadie se entera.
 *
 * Un núcleo es la ÚLTIMA palabra del nombre en camelCase: lo que la columna ES. `contactName`,
 * `customerTaxId` o `billingAddress` son un nombre, un NIF y una dirección. Las palabras de delante
 * sólo dicen de quién.
 *
 * ⚠️ NO es una subcadena, y eso es lo que separa ensanchar de abrir. Con una subcadena entran
 * `nameSearch` (un índice de búsqueda) y `shippingAddressMode` (un modo), que no son de nadie. Por
 * núcleo, no entran. `templateName` sí entra, porque su núcleo es «name». Y queda a la vista: hay que
 * declararlo fuera con su motivo, que es justo lo que este censo existe para obligar.
 *
 * Aditivo: la lista exacta de arriba sigue mandando para lo que no es un núcleo (`serialNumber`).
 */
export const NUCLEOS_PERSONALES = Object.freeze([
  'email', 'phone', 'name', 'taxId', 'address', 'direccion', 'notes', 'iban',
  // EL DOMICILIO EN TROZOS. `address` sólo ve la calle; la ciudad, el código postal y la provincia
  // de una persona física son el resto de su casa. Ninguno contenía una palabra del vocabulario, así
  // que eran el caso que c.20092 declaró sin medir: salieron cuatro en `customerSite` (SCRUM-1569).
  'city', 'postalCode', 'province', 'country',
]);

/** ¿El nombre de columna ACABA en un núcleo, en frontera de camelCase? `contactName` sí, `nameSearch` no. */
export function nucleoDe(campo) {
  for (const n of NUCLEOS_PERSONALES) {
    if (campo === n) return n;
    const cola = n[0].toUpperCase() + n.slice(1);
    if (campo.length > cola.length && campo.endsWith(cola) && /[a-z0-9]/.test(campo[campo.length - cola.length - 1])) return n;
  }
  return null;
}

/** `Merchant` → `merchant`, `EmailMessage` → `emailMessage`: la clave que usa `CAMPOS_PERSONALES`. */
export const enCamel = (modelo) => modelo[0].toLowerCase() + modelo.slice(1);

/**
 * Los pares `{ modelo, campo }` del esquema cuya columna es de TEXTO y cuyo nombre está en el
 * vocabulario. **Puro y sobre el TEXTO**, para poder provocar el rojo con un esquema sintético sin
 * tocar `prisma/schema.prisma`, que es el único freno duro del repo (ASESOR.md §3).
 */
export function camposPersonalesDelSchema(schemaText) {
  const vocab = new Set(VOCABULARIO_PERSONAL);
  return columnasDeTexto(schemaText).filter((c) => vocab.has(c.campo) || nucleoDe(c.campo));
}

/**
 * 🔴 SCRUM-1547 · TODAS las columnas de TEXTO del esquema (`String` o `String?`), de TODOS los modelos.
 *
 * Es la población del trinquete de clasificación total: el vocabulario y los núcleos de arriba sólo
 * ven los nombres que alguien escribió antes, y una columna personal con otro nombre (`notas`,
 * `firmadoPorNombre`, `ip`) era invisible y el guard salía VERDE. Aquí no se filtra por nombre:
 * cada columna de texto tiene que estar declarada, personal o no.
 *
 * Es el único lector del esquema de este fichero: `camposPersonalesDelSchema` filtra sobre él, para
 * que las dos poblaciones no puedan leer el esquema de dos formas distintas.
 * ⚠️ Fuera, dicho: las columnas `Json` (30 el 12-nov-2026) y las `String[]` (0 ese día). Son un
 * segundo paso que decidió el fundador (SCRUM-1547 c.21607), no un olvido.
 */
export function columnasDeTexto(schemaText) {
  const out = [];
  let modelo = null;
  for (const linea of String(schemaText || '').replace(/\r/g, '').split('\n')) {
    const abre = /^\s*model\s+(\w+)\s*\{/.exec(linea);
    if (abre) { modelo = abre[1]; continue; }
    if (!modelo) continue;
    if (/^\s*\}/.test(linea)) { modelo = null; continue; }
    // Solo columnas de TEXTO: `String` o `String?`. Un Boolean que se llame `notifyEmailOnPaid` no
    // es el correo de nadie, y un `Json` de qué se envió es el hecho, no la persona.
    const campo = /^\s*(\w+)\s+String(\?)?(\s|$)/.exec(linea);
    if (!campo) continue;
    out.push({ modelo: enCamel(modelo), campo: campo[1], clave: `${enCamel(modelo)}.${campo[1]}` });
  }
  return out;
}

// ── SCRUM-1547 · LO QUE NO ES DATO PERSONAL, declarado COLUMNA A COLUMNA ──────────────────────
//
// El motivo va por FAMILIA (una frase para todos los estados, otra para las monedas…); la CLAVE va
// columna a columna. ⛔ Nunca un patrón por nombre en este lado: «todo lo que acabe en Status es no
// personal» abre el mismo agujero que este ticket cierra, pero por el otro lado.
// Las 114 son la medición del 12-nov-2026 (SCRUM-1547 c.21601: 224 columnas − 66 que ya veía el censo −
// 44 personales o dudosas). El fundador decidió en c.21607 que esas 44 van a `SIN_DECIDIR`; éstas son el resto, menos
// los 4 textos de error que sacó de aquí en c.21617 (un error de envío puede llevar el teléfono o el
// correo del destinatario): quedan 110.
// ⚠️ La clasificación es de UNA sesión y no la ha repetido nadie: si una de éstas te parece personal,
// sácala de aquí y llévala a `SIN_DECIDIR` con su pregunta. Eso no afloja nada: sube el trinquete.
const ESTADO = 'un estado, tipo, clase o modo: dice en qué punto está la fila o de qué clase es, no de quién es';
const MONEDA = 'código de moneda ISO (EUR): configuración del documento, no de una persona';
const SECRETO = 'token o identificador de acceso generado por el sistema: abre una puerta, no nombra a nadie';
const ID_EXTERNO = 'identificador técnico que asigna un tercero (Stripe, Meta, Resend, la AEAT…) o el sistema: un número de referencia, no una persona';
const HUELLA = 'huella SHA-256 de un contenido: no se puede leer de vuelta';
const NUMERO_DOC = 'número o serie de un documento, asignado por el sistema o el profesional: no nombra a nadie';
const CONFIG = 'configuración del negocio (marca, oficio, plan, zona horaria…): describe la cuenta, no a una persona';
const CATALOGO = 'dato del catálogo de servicios del profesional (lo que vende), no de un cliente';
const CONDICIONES = 'condiciones del documento (forma de pago, tramo, modalidad): reglas del cobro, no de quién paga';
const REGISTRO_LEGAL = 'qué texto legal se aceptó y en qué versión (clave y hash): el hecho, no quién';
const AUDITORIA = 'qué acción y sobre qué tipo de entidad: el verbo del registro, no el actor';

export const NO_PERSONALES = Object.freeze({
  // merchant
  'merchant.trade': CONFIG,
  'merchant.defaultCurrency': MONEDA,
  'merchant.invoiceSeriesPrefix': NUMERO_DOC,
  'merchant.logoUrl': 'la URL del logo del negocio, que el propio profesional sube para sus documentos',
  'merchant.asesorPrograma': CONFIG,
  'merchant.stripeAccountId': ID_EXTERNO,
  'merchant.connectStatus': ESTADO,
  'merchant.subscriptionStatus': ESTADO,
  'merchant.plan': CONFIG,
  'merchant.stripeSubscriptionId': ID_EXTERNO,
  'merchant.timezone': CONFIG,
  'merchant.pspId': ID_EXTERNO,
  'merchant.status': ESTADO,
  'merchant.acquisitionSource': 'por qué canal llegó la cuenta (campaña, referido…): marketing de la cuenta, no una persona',
  'merchant.referralCode': SECRETO,
  'merchant.brandColor': CONFIG,
  'merchant.brandAccentColor': CONFIG,
  'merchant.activityKind': CONFIG,
  // authSession
  'authSession.token': SECRETO,
  'authSession.type': ESTADO,
  // customer
  'customer.contactKind': ESTADO,
  'customer.portalToken': SECRETO,
  'customer.tipoDestinatario': ESTADO,
  'customer.billingPeriodicity': CONDICIONES,
  // charge
  'charge.currency': MONEDA,
  'charge.method': ESTADO,
  'charge.status': ESTADO,
  'charge.intentId': ID_EXTERNO,
  'charge.receiptToken': SECRETO,
  // event
  'event.type': ESTADO,
  // quote
  'quote.origin': ESTADO,
  'quote.shippingAddressMode': ESTADO,
  'quote.status': ESTADO,
  'quote.currency': MONEDA,
  'quote.paymentTerms': CONDICIONES,
  'quote.createdVia': ESTADO,
  'quote.decisionChannel': ESTADO,
  'quote.selectedTierId': ID_EXTERNO,
  'quote.decisionToken': SECRETO,
  'quote.ivaModo': CONDICIONES,
  // invoice
  'invoice.merchantLogoUrl': 'la URL del logo del negocio, congelada en la factura: la sube el propio profesional',
  'invoice.number': NUMERO_DOC,
  'invoice.shippingAddressMode': ESTADO,
  'invoice.currency': MONEDA,
  'invoice.registerId': ID_EXTERNO,
  'invoice.status': ESTADO,
  'invoice.paidVia': ESTADO,
  'invoice.stageLabel': CONDICIONES,
  'invoice.type': ESTADO,
  'invoice.vfEstado': ESTADO,
  'invoice.vfHash': HUELLA,
  'invoice.vfPrevHash': HUELLA,
  'invoice.vfAnulHash': HUELLA,
  'invoice.vfAnulPrevHash': HUELLA,
  // expense
  'expense.currency': MONEDA,
  'expense.category': ESTADO,
  'expense.providerInvoiceNumber': NUMERO_DOC,
  // product
  'product.nameSearch': CATALOGO,
  'product.description': CATALOGO,
  'product.itemKind': CATALOGO,
  'product.sku': CATALOGO,
  'product.supplierRef': CATALOGO,
  'product.unit': CATALOGO,
  // quoteRequest
  'quoteRequest.status': ESTADO,
  'quoteRequest.source': ESTADO,
  // botSession
  'botSession.state': ESTADO,
  // quoteTemplate
  'quoteTemplate.currency': MONEDA,
  'quoteTemplate.paymentTerms': CONDICIONES,
  // teamMember
  'teamMember.role': ESTADO,
  'teamMember.status': ESTADO,
  // customerEvent
  'customerEvent.type': ESTADO,
  // whatsAppMessage
  'whatsAppMessage.type': ESTADO,
  'whatsAppMessage.waMessageId': ID_EXTERNO,
  'whatsAppMessage.status': ESTADO,
  'whatsAppMessage.relatedType': ESTADO,
  // legalAcceptance
  'legalAcceptance.docKey': REGISTRO_LEGAL,
  'legalAcceptance.version': REGISTRO_LEGAL,
  // job
  'job.status': ESTADO,
  'job.tipoOperacion': ESTADO,
  'job.tipoIntervencion': ESTADO,
  // auditLog
  'auditLog.action': AUDITORIA,
  'auditLog.entityType': AUDITORIA,
  // attachment
  'attachment.entityType': ESTADO,
  'attachment.kind': ESTADO,
  'attachment.mime': 'el tipo de fichero (image/jpeg…): formato, no contenido',
  // albaran
  'albaran.numero': NUMERO_DOC,
  'albaran.modoValoracion': ESTADO,
  'albaran.estado': ESTADO,
  'albaran.firmadoPorCalidad': 'la CALIDAD en que se firma (titular, encargado…): el papel, no el nombre de quien firma',
  'albaran.firmaToken': SECRETO,
  'albaran.claveIdempotencia': ID_EXTERNO,
  // emailMessage
  'emailMessage.kind': ESTADO,
  'emailMessage.providerId': ID_EXTERNO,
  'emailMessage.status': ESTADO,
  'emailMessage.relatedType': ESTADO,
  // parteTrabajo
  'parteTrabajo.numero': NUMERO_DOC,
  'parteTrabajo.entrada': 'la hora de entrada del parte: cuándo se trabajó, no quién',
  'parteTrabajo.salida': 'la hora de salida del parte: cuándo se trabajó, no quién',
  'parteTrabajo.tipo': ESTADO,
  'parteTrabajo.estado': ESTADO,
  'parteTrabajo.firmadoPorCalidad': 'la CALIDAD en que se firma (titular, encargado…): el papel, no el nombre de quien firma',
  'parteTrabajo.contenidoHash': HUELLA,
  // gatewayEvent
  'gatewayEvent.provider': ESTADO,
  'gatewayEvent.eventId': ID_EXTERNO,
  'gatewayEvent.type': ESTADO,
  // vfSubmission
  'vfSubmission.tipoOperacion': ESTADO,
  'vfSubmission.lastEnvioId': ID_EXTERNO,
  'vfSubmission.csv': 'el código seguro de verificación que devuelve la AEAT: identifica el envío, no a una persona',
  'vfSubmission.estadoRegistro': ESTADO,
  // vfFlujoObligado
  'vfFlujoObligado.ultimoEnvioId': ID_EXTERNO,
});

/**
 * 🔴 SCRUM-1547 · LA CLASIFICACIÓN TOTAL. Toda columna de texto es UNA de dos:
 *
 *   · PERSONAL — la ve el censo (vocabulario o núcleo) **o** está DECLARADA en uno de los cubos del
 *     reparto (`CAMPOS_PERSONALES`, `FUERA_DE_ANONIMIZADO`, `SIN_DECIDIR`). Estar en un cubo ya es
 *     declararla: no hay una segunda lista de «personales declaradas» que pueda divergir de la primera.
 *   · NO PERSONAL — está en `noPersonales` con su motivo.
 *
 * Y tres listas que tienen que salir vacías:
 *   · `sinDeclarar`   — ni una cosa ni otra. Es la columna nueva que nadie ha mirado.
 *   · `enLasDos`      — declarada no personal y a la vez personal: una de las dos declaraciones miente.
 *   · `fantasmas`     — claves de `noPersonales` que el esquema ya no tiene: una declaración que no
 *                       declara nada, y el sitio donde una columna RENOMBRADA se queda sin mirar.
 */
export function clasificarTodas(schemaText, camposPersonales, fueraDeclarados, sinDecidir, noPersonales) {
  const columnas = columnasDeTexto(schemaText);
  const existe = new Set(columnas.map((c) => c.clave));
  const personales = new Set(personalesDe(schemaText, camposPersonales, fueraDeclarados, sinDecidir).map((p) => p.clave));
  const no = new Set(Object.keys(noPersonales || {}));
  const out = { total: columnas.length, personales: [], noPersonales: [], sinDeclarar: [], enLasDos: [], fantasmas: [] };
  for (const { clave } of columnas) {
    if (personales.has(clave) && no.has(clave)) out.enLasDos.push(clave);
    if (personales.has(clave)) out.personales.push(clave);
    else if (no.has(clave)) out.noPersonales.push(clave);
    else out.sinDeclarar.push(clave);
  }
  for (const clave of no) if (!existe.has(clave)) out.fantasmas.push(clave);
  return out;
}

/** Las personales: las que ve el censo por nombre, más las DECLARADAS en un cubo (SCRUM-1547). En orden del esquema. */
function personalesDe(schemaText, camposPersonales, fueraDeclarados, sinDecidir) {
  const vistas = new Set(camposPersonalesDelSchema(schemaText).map((p) => p.clave));
  const declaradas = new Set([
    ...Object.entries(camposPersonales || {}).flatMap(([m, cs]) => (cs || []).map((c) => `${m}.${c}`)),
    ...Object.keys(fueraDeclarados || {}),
    ...Object.keys(sinDecidir || {}),
  ]);
  return columnasDeTexto(schemaText).filter((c) => vistas.has(c.clave) || declaradas.has(c.clave));
}

/**
 * EL REPARTO. Cada columna personal cae en UNO de tres cubos, y los tres suman el total — un censo
 * cuyas categorías no suman su total no es un censo.
 *
 *   · `cubiertos`      — están en `CAMPOS_PERSONALES`: la supresión los anonimiza.
 *   · `fueraDeclarados`— declarados fuera CON MOTIVO. No son de una persona (el nombre de un
 *                        producto no es el nombre de nadie).
 *   · `sinDecidir`     — **el trinquete**: son datos personales, hoy NO se anonimizan, y nadie ha
 *                        decidido si deben. Van nombrados uno a uno, no escondidos.
 *   · `sinClasificar`  — lo que no está en ninguno de los tres. **Tiene que estar vacío**: es lo
 *                        que hace que un modelo nuevo con un dato personal ponga esto en rojo.
 *
 * Se pasa todo por parámetro para poder ejercitarlo con esquemas y listas SINTÉTICAS: es lo que
 * demuestra que el guard está atado al hecho y no a la lista de hoy.
 */
export function repartir(schemaText, camposPersonales, fueraDeclarados, sinDecidir) {
  // SCRUM-1547: la población es la que ve el censo MÁS las declaradas en un cubo. Sin eso, una
  // columna que el vocabulario no sabe leer (`albaran.notas`) no contaría en el trinquete aunque
  // esté en `SIN_DECIDIR` con su pregunta.
  const personales = personalesDe(schemaText, camposPersonales, fueraDeclarados, sinDecidir);
  const cubiertos = new Set(
    Object.entries(camposPersonales || {}).flatMap(([m, cs]) => (cs || []).map((c) => `${m}.${c}`)),
  );
  const fuera = new Set(Object.keys(fueraDeclarados || {}));
  const pendientes = new Set(Object.keys(sinDecidir || {}));

  const reparto = { total: personales.length, cubiertos: [], fueraDeclarados: [], sinDecidir: [], sinClasificar: [] };
  for (const p of personales) {
    if (cubiertos.has(p.clave)) reparto.cubiertos.push(p.clave);
    else if (fuera.has(p.clave)) reparto.fueraDeclarados.push(p.clave);
    else if (pendientes.has(p.clave)) reparto.sinDecidir.push(p.clave);
    else reparto.sinClasificar.push(p.clave);
  }
  return reparto;
}

export const leerSchema = () => fs.readFileSync(RUTA_SCHEMA, 'utf8');
