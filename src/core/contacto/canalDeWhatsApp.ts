// src/core/contacto/canalDeWhatsApp.ts — SCRUM-590 (CONT-19)
//
// ¿A QUÉ NÚMERO DEL CLIENTE SE LE ESCRIBE POR WHATSAPP? — en UN solo sitio.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTE FICHERO EXISTE, Y POR QUÉ ES EL TICKET ENTERO
//
// CONT-19 parte el teléfono del cliente en dos: la centralita de la empresa (`phone`) y el
// móvil de la persona de contacto (`mobile`). Partirlo y no tocar nada más **convierte los dos
// campos en adorno**: los 11 sitios que resuelven el destino leían `customer.phone`, así que el
// documento seguiría saliendo al fijo, sin que nada fallara ni avisara. Medido en SCRUM-590
// (§2 de `docs/master/SCRUM-590.md`): 13 llamadas de envío, 11 puntos de resolución, todos
// `normalizePhone(customer.phone)`.
//
// Así que la separación de campos y el camino de envío son EL MISMO cambio, y este módulo es
// la bisagra. Es la forma de SCRUM-577 (`nombreParaDocumento`) y SCRUM-578
// (`identificadoresDuplicados`): la regla en un sitio, y quien la use que la importe. El día
// que aparezca un tercer número, se cambia AQUÍ y no se busca dónde se comparaba.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL CRITERIO: `mobile` MANDA, `phone` ES EL RESPALDO — y por qué NO hay un flag
//
// La firma del fundador dice «marcar explícitamente que los documentos se envían por WhatsApp
// AL MÓVIL». La marca es ESTRUCTURAL: el número que recibe es el que está en el campo «Móvil».
// **No hay columna de canal**, y no es un olvido — una columna `waCanal` con valores
// `MOBILE|PHONE` sería un ESTADO NUEVO, y los estados son cerrados (regla 27, Partes L/P): se
// propone como cambio de máster, no se construye de paso. La opción queda medida y escrita en
// `docs/master/SCRUM-590.md` §4 por si el fundador la quiere; hasta entonces, el orden es fijo.
//
// 🔴 Y ESTO ES LO QUE HACE QUE NO ROMPA NADA: con `mobile` a NULL —que es TODO cliente que
// existe hoy, porque la columna nace vacía— esto devuelve exactamente `normalizePhone(phone)`,
// que es la línea que había antes en los once sitios. El comportamiento de hoy no es un caso
// que se respete: es el caso por defecto.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ EL MÓVIL ILEGIBLE CAE AL FIJO, y se dice porque es una decisión y no un descuido
//
// `normalizePhone` devuelve `''` tanto para «no hay nada» como para «hay algo que no es un
// teléfono». Aquí los dos casos se tratan igual —se cae al fijo— porque a esta capa llegan
// indistinguibles y porque la alternativa (no enviar) rompería al cliente de un solo número.
// Quien impide que entre un móvil ilegible es Zod en el alta/edición, que es donde se puede
// decir POR QUÉ. Un resolvedor no es el sitio donde se valida.
import { normalizePhone } from '../utils/utils';

/**
 * Lo que este módulo necesita de un cliente: sus números. **NO es el `Customer` de Prisma**, y
 * eso es deliberado por dos motivos:
 *
 *  1. Los dos campos son opcionales, así que un `Customer` encaja aquí por estructura tanto si
 *     el cliente de Prisma ya conoce `mobile` como si todavía no. El código de envío no depende
 *     del orden en que se apliquen el esquema y este PR.
 *  2. Mantiene la pieza PURA: no importa Prisma, no toca la base y se puede probar con objetos
 *     de tres líneas.
 */
export interface ContactoConNumeros {
  phone?: string | null;
  mobile?: string | null;
}

/**
 * 🔴 EL NÚMERO AL QUE SE LE ESCRIBE. Normalizado y listo para `to`.
 *
 * Devuelve `''` cuando no hay ningún número utilizable — el mismo valor que devolvía
 * `normalizePhone` en los once sitios, así que los guards `if (!to)` que ya existen siguen
 * significando lo mismo.
 */
export function canalDeWhatsApp(contacto: ContactoConNumeros | null | undefined): string {
  return normalizePhone(contacto?.mobile) || normalizePhone(contacto?.phone);
}

/**
 * ¿Consta ALGÚN número para este contacto? — sin normalizar, a propósito.
 *
 * Existe para conservar una distinción que los servicios de envío ya hacían y que perder sería
 * un cambio de contrato: `customer_missing_phone` («no nos dio un número») e
 * `invalid_phone_format` («nos dio uno que no se puede marcar») son dos respuestas distintas,
 * las dos con su mensaje. Con sólo `canalDeWhatsApp` las dos darían `''` y se fundirían en una.
 */
export function tieneNumeroDeContacto(contacto: ContactoConNumeros | null | undefined): boolean {
  return Boolean(String(contacto?.mobile ?? '').trim() || String(contacto?.phone ?? '').trim());
}

/**
 * 🔴 TODOS los números por los que se PUEDE alcanzar a este contacto, normalizados y sin vacíos.
 *
 * No es lo mismo que `canalDeWhatsApp`, y la diferencia es exactamente la baja del canal. El
 * opt-out (J3) protege a un DESTINATARIO, y un destinatario es un número: si alguien pide la
 * baja, no se le puede seguir escribiendo por el otro campo de su misma ficha. Enviar mira UNO
 * —al que toca—; proteger mira LOS DOS.
 *
 * Sin esto, el agujero es concreto y silencioso: la baja se guarda sobre un cliente cuyo `phone`
 * es el fijo, el documento sale al móvil, y la comprobación —que compara el destino contra los
 * `phone` de los dados de baja— no encuentra nada y **deja pasar el envío**.
 */
export function numerosDelContacto(contacto: ContactoConNumeros | null | undefined): string[] {
  const numeros = [normalizePhone(contacto?.mobile), normalizePhone(contacto?.phone)];
  return [...new Set(numeros.filter(Boolean))];
}
