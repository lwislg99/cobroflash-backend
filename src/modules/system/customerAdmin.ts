import crypto from 'crypto';
import { prisma } from '../../core/db/prisma';
import { Prisma } from '@prisma/client';
import { CustomerCreateInput, CustomerUpdateInput } from '../../core/validation/schemas';
// SCRUM-580 (CONT-07): la decision de las etiquetas vive aparte y es pura — ver ese fichero.
import { normalizarTags } from './tagsDelCliente';
import { normalizePhone } from '../../core/utils/utils'; // SCRUM-578: la que YA existe, sin tocarla

function generatePortalToken() {
  return crypto.randomBytes(16).toString('hex');
}

// SCRUM-97: listado/detalle/alta genéricos de cliente NUNCA devuelven portalToken — es
// la llave del portal público de autoservicio (/cliente/:token, historial completo de
// documentos, sin más control) y no hace falta aquí: el flujo legítimo para obtenerlo ya
// existe aparte, GET /admin/customers/:id/portal-url (ensurePortalToken más abajo), que
// sí lo selecciona a propósito. Todo lo demás del modelo se mantiene (nada lo necesitaba
// recortado; solo el token).
const CUSTOMER_SELECT_NO_TOKEN = {
  id: true, merchantId: true, name: true, phone: true, email: true, notes: true,
  legalName: true, taxId: true, waOptOut: true, createdAt: true, updatedAt: true,
  contactKind: true, // SCRUM-574: forma jurídica (EMPRESA|PERSONA). NO es tipoDestinatario.
  tipoDestinatario: true, // SCRUM-69: para editar en la ficha y para la bandeja de facturación
  billingPeriodicity: true, // SCRUM-171b: periodicidad pactada (solo para AVISAR, ver bandeja)
  recargoEquivalencia: true, // SCRUM-294-a: el dato del cliente; NO cableado al total (regla 38)
  // 🔴 SCRUM-587 (CONT-14) · EL QUINTO ESLABÓN OTRA VEZ, y el aviso que dejó SCRUM-580 doce
  // líneas más abajo se leyó ANTES esta vez: este `select` es EXPLÍCITO y lo usan `listCustomers`
  // Y `getCustomer`. Sin esta línea, el descuento pactado se guardaría en la base y el documento
  // NUNCA lo vería —la propuesta no aparecería jamás—, y la tanda seguiría VERDE porque el dato
  // SÍ estaría guardado. Es el editor quien lee la lista de clientes para proponer.
  dtoPorDefecto: true,
  // 🔴 SCRUM-580 (CONT-07) · EL QUINTO ESLABON, Y ES EL QUE MAS FACIL SE PIERDE. Este `select` es
  // EXPLICITO y lo usan `listCustomers` Y `getCustomer`: sin esta linea el alta guardaria las
  // etiquetas y devolveria un cliente sin ellas, la pantalla se recargaria vacia, el profesional
  // volveria a escribirlas — y la tanda seguiria VERDE, porque el dato SI estaria en la base.
  // Es el mismo aviso que dejo SCRUM-579 doce lineas mas abajo, y esta vez se busco ANTES.
  tags: true,
  // ─────────────────────────────────────────────────────────────────────────────────────────
  // SCRUM-579 (CONT-06) · LA DIRECCIÓN DE FACTURACIÓN, Y ESTE `select` ES EL ESLABÓN QUE MÁS
  // FÁCIL SE PIERDE.
  //
  // 🔴 Es EXPLÍCITO: lo que no esté aquí NO SALE, aunque esté en la columna y aunque el alta lo
  // haya guardado. Sin estas cinco líneas, `createCustomer` guardaría la dirección y devolvería
  // un cliente sin ella; la pantalla se recargaría vacía y el profesional volvería a escribirla.
  // Y la tanda seguiría VERDE, porque el dato SÍ estaría en la base: el defecto sería mudo.
  //
  // Por eso los tests de este ticket no se conforman con «se guarda»: releen (`getCustomer`,
  // que usa este mismo select) y exigen que siga ahí. Un `select` explícito es una lista a mano,
  // y una lista a mano envejece en silencio cada vez que alguien añade una columna.
  billingAddress: true,
  billingCity: true,
  billingPostalCode: true,
  billingProvince: true,
  billingCountry: true,
  // SCRUM-588 (CONT-16) · la referencia interna. Va aquí por el motivo escrito arriba, que es EL
  // eslabón que más fácil se pierde: sin esta línea el alta la guardaría, `getCustomer` devolvería
  // un cliente sin ella, la pantalla se recargaría vacía y el profesional la reescribiría — con la
  // tanda en VERDE, porque el dato sí está en la base.
  internalRef: true,
} as const;

export async function listCustomers(merchantId: number, search?: string) {
  const where: Prisma.CustomerWhereInput = { merchantId };

  if (search) {
    where.AND = [{
      OR: [
        { name:  { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        // 🔴 SCRUM-588 (CONT-16) · SIN ESTA LÍNEA EL CAMPO NO RESUELVE NADA.
        //
        // La referencia interna existe para poder ENCONTRAR al cliente por el número con el que el
        // profesional lo conoce — el expediente de la aseguradora, la finca, el código del sistema
        // viejo. Guardarla sin poder buscarla es exactamente lo que ya hacía `notes`: un sitio
        // donde el dato entra y no vuelve a salir.
        //
        // Va en el MISMO `OR` que nombre, teléfono y email, no en un buscador aparte: el
        // profesional escribe lo que recuerda y no tiene por qué decirnos de qué tipo es.
        { internalRef: { contains: search, mode: 'insensitive' } },
      ],
    }];
  }

  return prisma.customer.findMany({ where, orderBy: { createdAt: 'desc' }, select: CUSTOMER_SELECT_NO_TOKEN });
}

export async function getCustomer(merchantId: number, id: number) {
  return prisma.customer.findFirst({ where: { id, merchantId }, select: CUSTOMER_SELECT_NO_TOKEN });
}

/**
 * SCRUM-578 (CONT-05, punto b) · LA NORMALIZACIÓN SE APLICA EN SERVIDOR, NO EN LA ETIQUETA.
 *
 * El defecto del ticket lo demuestra: el formulario pedía «Teléfono (E.164 sin +)» y se guardaron
 * `+34 662629419` y `662629419` como dos clientes. Una regla que sólo vive en un rótulo no es una
 * regla — es una instrucción para el humano. Zod tampoco la sostenía (`z.string().min(5)`).
 *
 * Medido antes de tocar: de los tres caminos que escriben `Customer.phone`, sólo
 * `charges.routes.ts:27` normalizaba. Éste —el del panel— no lo hacía.
 *
 * ⚠️ Se usa `normalizePhone` A SECAS, la que ya existe. NO se canoniza el prefijo aquí: eso vive
 * en `identificadoresDuplicados` y es SÓLO PARA COMPARAR. Guardar el número con un prefijo que el
 * profesional no escribió sería inventarle un país a un dato suyo, y además cambiaría a dónde se
 * manda el WhatsApp.
 *
 * `undefined` se respeta: en una actualización parcial significa «no toques este campo», y
 * confundirlo con «bórralo» sería perder el teléfono de un cliente al editarle las notas.
 */
function normalizarIdentificadores<T extends { phone?: string | null }>(data: T): T {
  if (data.phone === undefined) return data;
  const limpio = normalizePhone(data.phone);
  // Si no se puede normalizar, se guarda lo que escribió el profesional: este ticket avisa de
  // duplicados, no valida teléfonos. Rechazar aquí sería un bloqueo que nadie ha decidido.
  return { ...data, phone: limpio || data.phone };
}

/**
 * SCRUM-580 (CONT-07) · las etiquetas, normalizadas EN SERVIDOR y en los DOS caminos.
 *
 * 🔴 Va en el alta Y en la edición. Si sólo lo hiciera el alta, editar un cliente sería la puerta
 * trasera por la que entra un `[]` — y un `[]` guardado dice «este cliente tiene etiquetas», que
 * es justo la mentira sobre la que se construiría el filtro. Es la misma lección que SCRUM-578
 * dejó escrita arriba con el teléfono.
 *
 * `undefined` se respeta: en una edición parcial significa «no toques este campo».
 */
type SinNullDeJs<T> = Omit<T, 'tags'> & { tags?: string[] | typeof Prisma.DbNull };

function normalizarEtiquetas<T extends { tags?: unknown }>(data: T): SinNullDeJs<T> {
  if (!('tags' in (data as object))) return data as SinNullDeJs<T>;
  const v = normalizarTags((data as { tags?: unknown }).tags);
  if (v === undefined) return data as SinNullDeJs<T>;
  // 🔴 `Prisma.DbNull`, NO `null` NI `Prisma.JsonNull`, y el compilador obliga a elegir — que es
  // una suerte, porque son tres cosas distintas y sólo una es la que quiere este ticket:
  //
  //   · `Prisma.DbNull`   → NULL de SQL: «no se declararon etiquetas». ESTE.
  //   · `Prisma.JsonNull` → el valor JSON `null` DENTRO de la columna. La columna NO sería NULL,
  //                          así que un `IS NOT NULL` diría que este cliente tiene etiquetas.
  //   · `undefined`       → «no toques el campo», que ya se ha resuelto arriba.
  //
  // Confundir las dos primeras es exactamente el defecto de «ausente ≠ vacío» con otro nombre.
  return { ...data, tags: v === null ? Prisma.DbNull : v } as SinNullDeJs<T>;
}

export async function createCustomer(merchantId: number, data: CustomerCreateInput) {
  return prisma.customer.create({
    data: { ...normalizarEtiquetas(normalizarIdentificadores(data)), merchantId, portalToken: generatePortalToken() },
    select: CUSTOMER_SELECT_NO_TOKEN,
  });
}

/**
 * El token del portal de un cliente, generándolo si todavía no tiene.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 SCRUM-793 · LA CONDICIÓN VIVE EN EL `WHERE`, NO EN UN `if` DE JAVASCRIPT
 *
 * Aquí había un read-then-write desnudo: `findFirst` → `if (!token)` → `update`. Entre el SELECT
 * y el UPDATE no había nada, así que dos peticiones simultáneas leían las dos «sin token»,
 * generaban dos tokens distintos y escribían las dos: **ganaba la última**, y la primera devolvía
 * a su llamador un token que ya no estaba en la base.
 *
 * MEDIDO contra Postgres de desarrollo (SCRUM-767, reproducido en SCRUM-793 antes de tocar nada):
 *
 *     DOS a la vez  → 4 de 5 pasadas con un enlace MUERTO
 *     DIEZ a la vez → hasta 10 tokens distintos, 9 de 10 muertos
 *
 * LA VÍCTIMA no ve ningún error: el profesional copia el enlace del portal, se lo manda al
 * cliente por WhatsApp, y **el enlace no abre** — `GET /cliente/:token` busca por `portalToken` y
 * no encuentra nada. Es el momento en que el cliente decide si firma.
 *
 * ── POR QUÉ ESTO LO CIERRA, Y NO ES UNA CARRERA MÁS PEQUEÑA ──────────────────────────────
 *
 * `portalToken: null` **dentro del `WHERE`** convierte la comprobación en parte de la MISMA
 * sentencia que escribe. En READ COMMITTED, la segunda `UPDATE` se bloquea sobre la fila que la
 * primera tiene tomada y, cuando aquélla confirma, **vuelve a evaluar su `WHERE`**: ya no hay
 * `null`, así que casa 0 filas y no pisa nada. El motor serializa lo que un `if` no puede.
 *
 * Y por eso se devuelve `count`: si casó 1, el token de la base es el nuestro. Si casó 0, la
 * carrera la ganó otro y **se devuelve el suyo**, releído — nunca el que este hilo generó.
 *
 * ⚠️ EL `if` DE ARRIBA SE QUEDA, y no contradice nada: es un atajo de LECTURA sobre un valor ya
 * confirmado. Es seguro porque **un token no nulo no lo sobrescribe nadie** — medido: `portalToken`
 * no existe en los esquemas zod, así que `updateCustomer` no puede tocarlo, y los únicos dos
 * escritores del árbol son `createCustomer` (al nacer) y esta función (sólo si está a `null`).
 *
 * ⛔ NO se ha añadido `@@unique` ni ningún índice: `Customer.portalToken` ya es `String? @unique`
 *    y `prisma/schema.prisma` no se toca.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export async function ensurePortalToken(merchantId: number, customerId: number): Promise<string> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, merchantId },
    select: { portalToken: true },
  });
  if (!customer) throw new Error('customer_not_found');
  if (customer.portalToken) return customer.portalToken;

  const token = generatePortalToken();
  // `updateMany` y no `update` PORQUE `update` exige clave única y no admite más condiciones: la
  // condición `portalToken: null` es justo lo que hay que meter en el `WHERE`. De paso, el
  // `merchantId` entra también en la escritura, que antes sólo filtraba en la lectura (regla 2).
  const escrito = await prisma.customer.updateMany({
    where: { id: customerId, merchantId, portalToken: null },
    data: { portalToken: token },
  });
  if (escrito.count === 1) return token;

  // Casó 0 filas: otro llegó antes. Se devuelve EL SUYO, que es el que está en la base y el que
  // va a funcionar cuando el cliente abra el enlace.
  const yaPuesto = await prisma.customer.findFirst({
    where: { id: customerId, merchantId },
    select: { portalToken: true },
  });
  // Fail-closed: si a estas alturas no hay token, el cliente se ha borrado por debajo. No se
  // inventa uno ni se devuelve el que este hilo generó y que NO está guardado.
  if (!yaPuesto?.portalToken) throw new Error('customer_not_found');
  return yaPuesto.portalToken;
}

export async function updateCustomer(merchantId: number, id: number, data: CustomerUpdateInput) {
  // SCRUM-578: la edicion normaliza igual que el alta. Si solo lo hiciera el alta, editar un
  // cliente seria la puerta trasera por la que vuelve a entrar un telefono sin normalizar.
  return prisma.customer.updateMany({ where: { id, merchantId }, data: normalizarEtiquetas(normalizarIdentificadores(data)) });
}

export async function deleteCustomer(merchantId: number, id: number) {
  return prisma.customer.deleteMany({ where: { id, merchantId } });
}
