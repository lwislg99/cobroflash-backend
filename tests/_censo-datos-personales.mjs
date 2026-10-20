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
    if (!vocab.has(campo[1]) && !nucleoDe(campo[1])) continue;
    out.push({ modelo: enCamel(modelo), campo: campo[1], clave: `${enCamel(modelo)}.${campo[1]}` });
  }
  return out;
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
  const personales = camposPersonalesDelSchema(schemaText);
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
