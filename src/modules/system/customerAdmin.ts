import crypto from 'crypto';
import { prisma } from '../../core/db/prisma';
import { Prisma } from '@prisma/client';
import { CustomerCreateInput, CustomerUpdateInput } from '../../core/validation/schemas';
// SCRUM-580 (CONT-07): la decision de las etiquetas vive aparte y es pura — ver ese fichero.
import { tagsParaPrisma } from './tagsDelCliente';
import { normalizePhone } from '../../core/utils/utils'; // SCRUM-578: la que YA existe, sin tocarla
import { BASE_URL } from '../../core/config/env'; // SCRUM-967b
import { saldosPendientesPorCliente } from './domain/saldoPendiente'; // SCRUM-1043
import { garantiasRetenidasPorCliente, type GarantiaDelCliente } from '../billing/domain/garantiasRetenidas'; // SCRUM-1108
import { z } from 'zod'; // SCRUM-1833b
import { desligarClienteEnBorrado } from '../messaging/domain/registroDeEnvios'; // SCRUM-1868d: el ÚNICO escritor de email_messages (scrum508, scrum475 2B)
import { diaExiste } from '../../core/zonaDelMerchant'; // SCRUM-1833b: solo se importa

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
  // 🔴 SCRUM-590 (CONT-19) · EL QUINTO ESLABÓN OTRA VEZ — y aquí no es sólo que el dato no se
  // vea. Este `select` es EXPLÍCITO y lo usan `listCustomers` Y `getCustomer`. Sin esta línea
  // el móvil se guardaría en la base y volvería `undefined` a la ficha: el profesional lo
  // escribiría, la pantalla se recargaría vacía, y lo volvería a escribir. Es el aviso que ya
  // dejaron escrito SCRUM-579, SCRUM-580 y SCRUM-587 aquí mismo; esta vez se leyó ANTES.
  mobile: true,
  legalName: true, taxId: true, waOptOut: true, createdAt: true, updatedAt: true,
  contactKind: true, // SCRUM-574: forma jurídica (EMPRESA|PERSONA). NO es tipoDestinatario.
  // 🔴 SCRUM-576 (CONT-03) · EL QUINTO ESLABÓN, POR TERCERA VEZ, y esta vez se buscó ANTES de
  // escribir una línea. Sin esto el vínculo se guardaría y `getCustomer` devolvería un cliente
  // sin empresa: el formulario se recargaría vacío, el profesional lo volvería a elegir — y la
  // tanda seguiría VERDE, porque el dato SÍ está en la base.
  //
  // ⛔ Sale `companyId` (el entero) y NO la relación `company`. La ficha de EMPRESA no gana
  // nada: el lado inverso (`people`) existe sólo porque Prisma lo exige para declarar la
  // relación, y exponerlo crearía el segundo sitio que este ticket existe para evitar.
  companyId: true,
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

export async function listCustomers(
  merchantId: number,
  search?: string,
  // SCRUM-979: de qué trabajos sale «Última visita». Ver `ultimasVisitas`.
  // SCRUM-1043: `conSaldo` añade `saldoPendiente` (solo a quien lo pide: es dinero); `soloConDeuda` deja
  // los clientes que deben algo; `ordenPorSaldo` los pone de mayor a menor deuda. Ver `saldosPendientesPorCliente`.
  opciones: { soloTrabajosDe?: number | null; conSaldo?: boolean; soloConDeuda?: boolean; ordenPorSaldo?: boolean } = {},
) {
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

  const clientes = await prisma.customer.findMany({ where, orderBy: { createdAt: 'desc' }, select: CUSTOMER_SELECT_NO_TOKEN });
  const visitas = await ultimasVisitas(merchantId, opciones.soloTrabajosDe);
  // Sin visita → la clave NO se añade: ausente no es cero (ni `null` que la vista pinte como fecha).
  const conVisita = clientes.map((c) => (visitas.has(c.id) ? { ...c, ultimaVisita: visitas.get(c.id)! } : c));
  if (!opciones.conSaldo) return conVisita;
  // SCRUM-1043 · «quién me debe». Cliente sin deuda = sin `saldoPendiente` (ausente no es cero).
  const [saldos, garantias] = await Promise.all([
    saldosPendientesPorCliente(merchantId),
    garantiasRetenidasPorCliente(merchantId), // SCRUM-1108
  ]);
  // SCRUM-1108 · la garantía retenida TAMBIÉN es deuda del cliente, pero va en su propio campo: `saldoPendiente`
  // sigue siendo solo facturas `pending` (la cifra de SCRUM-1043). Quien solo debe garantía sale en «quién me
  // debe» igual, y el orden suma las dos. Sin ella, 500 € retenidos no aparecen en ninguna lista.
  let filas = conVisita.map((c) => {
    const fila: typeof c & { saldoPendiente?: number; garantiaRetenida?: GarantiaDelCliente } = saldos.has(c.id) ? { ...c, saldoPendiente: saldos.get(c.id)!.total } : { ...c };
    if (garantias.has(c.id)) fila.garantiaRetenida = garantias.get(c.id)!;
    return fila;
  });
  // SCRUM-1043a · un saldo ≤ 0 (un abono pendiente que compensa) NO es deuda (c.16244): la cifra se
  // manda igual —es la de la ficha—, pero el cliente no entra en «con deuda».
  if (opciones.soloConDeuda) filas = filas.filter((c) => (c.saldoPendiente ?? 0) > 0 || 'garantiaRetenida' in c);
  if (opciones.ordenPorSaldo) {
    const de = (c: { id: number; saldoPendiente?: number }) => (c.saldoPendiente ?? 0) + (garantias.get(c.id)?.total ?? 0);
    filas = [...filas].sort((a, b) => de(b) - de(a));
  }
  return filas;
}

/**
 * SCRUM-979 · LA ÚLTIMA VISITA DE CADA CLIENTE: el `scheduledAt` más reciente de sus trabajos
 * `terminado` o `cerrado` (Parte L). UNA consulta (`groupBy`), no una por cliente: la lista no pagina.
 *
 * 🔴 `soloTrabajosDe`: la lista de clientes NO se recorta por rol (el técnico ve la cartera
 * entera), pero sus TRABAJOS sí (`jobs.routes.ts`, los tres ejes de SCRUM-650). La fecha sale solo
 * de los trabajos que ese técnico puede ver: si no, la columna le enseñaría la fecha de un trabajo
 * que en su lista no existe. `undefined` = sin recorte (admin y propietario).
 */
async function ultimasVisitas(merchantId: number, soloTrabajosDe?: number | null): Promise<Map<number, Date>> {
  const where: Prisma.JobWhereInput = { merchantId, status: { in: ['terminado', 'cerrado'] }, scheduledAt: { not: null } };
  if (soloTrabajosDe !== undefined) {
    where.OR = [
      { operarioId: soloTrabajosDe },
      { assignedUserId: soloTrabajosDe },
      { assignees: { some: { teamMemberId: soloTrabajosDe as number } } },
    ];
  }
  const filas = await prisma.job.groupBy({ by: ['customerId'], where, _max: { scheduledAt: true } });
  const fuera = new Map<number, Date>();
  for (const f of filas) if (f._max.scheduledAt) fuera.set(f.customerId, f._max.scheduledAt);
  return fuera;
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
 *
 * 🔴 SCRUM-590 (CONT-19) · LOS DOS NÚMEROS, NO SÓLO EL FIJO. El motivo de arriba vale MÁS para
 * el móvil que para el fijo: el móvil es el número al que sale el documento, así que guardarlo
 * sin normalizar es exactamente el defecto de SCRUM-578 —`+34 662629419` y `662629419` como
 * dos cosas distintas— en el campo que además decide a dónde se manda el WhatsApp. Se recorre
 * una lista y no se copia la línea: dos copias son dos sitios donde divergir.
 */
type ConNumeros = { phone?: string | null; mobile?: string | null };
export function normalizarIdentificadores<T extends ConNumeros>(data: T): T {
  // 🔴 SE ACUMULA APARTE Y SE ESPARCE `...data` AL FINAL, en vez de reasignar en el bucle. El
  // guard ④ de SCRUM-579 lo exige literalmente, y tiene razón de fondo: un normalizador que
  // construye su salida campo a campo se come en silencio todo lo que no nombre —la dirección
  // de facturación, las etiquetas— entre lo que Zod validó y lo que se guarda. Con `...data`
  // delante, lo que este bucle no toca pasa intacto por construcción.
  const limpiados: ConNumeros = {};
  for (const campo of ['phone', 'mobile'] as const) {
    if (data[campo] === undefined) continue; // edición parcial: no se toca
    const limpio = normalizePhone(data[campo]);
    // Si no se puede normalizar, se guarda lo que escribió el profesional: este ticket avisa de
    // duplicados, no valida teléfonos. Rechazar aquí sería un bloqueo que nadie ha decidido.
    limpiados[campo] = limpio || data[campo];
  }
  return { ...data, ...limpiados };
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
  // SCRUM-595 · la traduccion vive en `tagsParaPrisma` (`tagsDelCliente.ts`), compartida con los
  // dos documentos. Antes estaba aqui y era la unica; con tres escritores, tres copias de la
  // eleccion entre `DbNull` y `JsonNull` es garantizar que una de las tres sea distinta.
  const v = tagsParaPrisma((data as { tags?: unknown }).tags);
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
  return { ...data, tags: v } as SinNullDeJs<T>;
}

/**
 * SCRUM-576 (CONT-03) · ¿PUEDE ESTE CLIENTE APUNTAR A ESE ID? La mitad que NO necesita base.
 *
 * Vive suelta y pura por el mismo motivo que `debeEsconder` en `switchFormaJuridica.js`: una
 * regla enterrada dentro de una función `async` que consulta Postgres sólo se puede auditar
 * LEYENDO el fuente, y leer no ejecuta nada. Aquí se ejecuta.
 *
 * Responde a las dos preguntas que no hacen falta consultar:
 *   · `undefined` → «no toques el campo» en una edición parcial. No es lo mismo que `null`.
 *   · un cliente apuntándose a SÍ MISMO → imposible. No es una regla de negocio inventada
 *     (regla 27): es un dato que no puede significar nada. «Esta persona pertenece a sí misma».
 *
 * Lo que NO decide, y por qué: si la empresa **existe** y es del **mismo merchant** (regla 2).
 * Eso exige la base y se resuelve abajo.
 */
export type VeredictoDeVinculo = 'no-tocar' | 'desvincular' | 'hay-que-consultar' | 'es-el-propio-cliente';

export function examinarVinculoDeEmpresa(
  clienteId: number | null,
  companyId: number | null | undefined,
): VeredictoDeVinculo {
  if (companyId === undefined) return 'no-tocar';
  if (companyId === null) return 'desvincular';
  // En un ALTA todavía no hay id, así que no puede apuntarse a sí mismo: no hay a qué.
  if (clienteId !== null && companyId === clienteId) return 'es-el-propio-cliente';
  return 'hay-que-consultar';
}

/**
 * La otra mitad: la que sí necesita la base. Lanza si el vínculo no se sostiene.
 *
 * 🔴 EL FILTRO POR `merchantId` ES LA REGLA 2 Y NO ES OPCIONAL. Sin él, un profesional podría
 * vincular a su cliente con una empresa de OTRO merchant escribiendo un id a mano — y a partir de
 * ahí ese id viajaría en el JSON de su propia ficha. Es fuga entre inquilinos, no un 404.
 *
 * ⚠️ LO QUE **NO** SE EXIGE, Y ES DELIBERADO: que la empresa apuntada tenga
 * `contactKind = 'EMPRESA'`. Medido en desarrollo el 7-sep-2026: de 14 clientes, **12 están en
 * `NULL`** — nadie ha declarado su forma jurídica. Rechazar todo lo que no esté declarado
 * convertiría un campo opcional en un muro, y deducir «es una empresa» de otra cosa está
 * PROHIBIDO por el fundador (24-ago-2026). El formulario sólo OFRECE las declaradas `EMPRESA`,
 * que es donde esa preferencia sí cabe sin cerrarle la puerta a nadie.
 */
export async function exigirEmpresaValida(
  merchantId: number,
  clienteId: number | null,
  companyId: number | null | undefined,
): Promise<void> {
  const veredicto = examinarVinculoDeEmpresa(clienteId, companyId);
  if (veredicto === 'no-tocar' || veredicto === 'desvincular') return;
  if (veredicto === 'es-el-propio-cliente') throw new Error('empresa_no_valida');

  const empresa = await prisma.customer.findFirst({
    where: { id: companyId as number, merchantId },
    select: { id: true },
  });
  if (!empresa) throw new Error('empresa_no_valida');
}

export async function createCustomer(merchantId: number, data: CustomerCreateInput) {
  // En el alta todavía no hay id propio, así que se pasa `null`: no hay a qué apuntarse.
  await exigirEmpresaValida(merchantId, null, data.companyId);
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

/**
 * SCRUM-967b · la URL del portal, construida en UN sitio para los envíos que la llevan (correo del
 * presupuesto y respuesta de la firma del parte). Misma forma que `GET /admin/customers/:id/portal-url`.
 * ⚠️ Abre TODOS los documentos del cliente: solo va a canales de un solo destinatario o de un solo
 * uso, nunca a una página que conteste a cualquiera que tenga su enlace (test scrum967b ④).
 */
export async function portalUrlDelCliente(merchantId: number, customerId: number): Promise<string> {
  return `${BASE_URL}/cliente/${await ensurePortalToken(merchantId, customerId)}`;
}

export async function updateCustomer(merchantId: number, id: number, data: CustomerUpdateInput) {
  // SCRUM-578: la edicion normaliza igual que el alta. Si solo lo hiciera el alta, editar un
  // cliente seria la puerta trasera por la que vuelve a entrar un telefono sin normalizar.
  // SCRUM-576: la edición comprueba igual que el alta. Si sólo lo hiciera el alta, editar sería
  // la puerta trasera por la que entra un `companyId` de otro merchant — la misma lección que
  // SCRUM-578 dejó escrita con el teléfono y SCRUM-580 con las etiquetas.
  await exigirEmpresaValida(merchantId, id, data.companyId);
  return prisma.customer.updateMany({ where: { id, merchantId }, data: normalizarEtiquetas(normalizarIdentificadores(data)) });
}

/**
 * SCRUM-576 (CONT-03) · BORRAR UN CLIENTE SIN DEJAR PERSONAS APUNTANDO AL VACÍO.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 ESTO ES LO QUE HARÍA LA CLAVE AJENA, Y POR ESO NO HAY CLAVE AJENA
 *
 * `customers.company_id` nace **sin FK**, por decisión del fundador (8-sep-2026), aplicando la
 * firma que ya existía para `Quote.jobId` en SCRUM-195: «la FK que importaría aquí es
 * `onDelete`, y eso ya se decidió en SCRUM-192 — **servicio de borrado, no cascadas**. La
 * integridad la sostiene el CÓDIGO.» Tener FK aquí y no allí serían dos criterios para la misma
 * clase de relación, y ésta es autorreferente sobre `customers`: deshacerla cuesta más.
 *
 * **Entonces la promesa hay que cumplirla aquí, y es ésta:** borrar una empresa NO puede dejar a
 * sus personas señalando una fila que ya no existe. Se desvinculan; **no se borran**. Un cliente
 * no desaparece porque desaparezca la empresa para la que trabajaba — tiene sus presupuestos, sus
 * facturas y su historial.
 *
 * ── EL ORDEN NO ES INDIFERENTE ──────────────────────────────────────────────────────────────
 * Se desvincula **ANTES** de borrar. Al revés —borrar y luego limpiar— deja una ventana en la que
 * las filas apuntan a un id que ya no existe, y si el segundo paso falla la ventana no se cierra
 * nunca. Sin FK **nada protestaría**: el defecto sería MUDO, que es el peor.
 *
 * ── Y POR ESO ES UNA TRANSACCIÓN ────────────────────────────────────────────────────────────
 * Los dos pasos caen juntos o no cae ninguno. Sin ella, un fallo al borrar dejaría a las personas
 * desvinculadas de una empresa que **sigue existiendo**: se habría perdido un dato del profesional
 * sin que nadie borrara nada.
 *
 * ⚠️ `updateMany` filtra por `merchantId` además de por `companyId`, y no es redundante: es la
 * regla 2. Un `companyId` es un entero, y sin el dueño en el `WHERE` esta escritura alcanzaría
 * filas de otro inquilino que casaran por número.
 *
 * Devuelve lo mismo que antes —el resultado del `deleteMany`— para no cambiarle nada a la ruta.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
/**
 * LOS DOS PASOS, EN ORDEN, SOBRE EL CLIENTE QUE SE LE DÉ. Vive suelta y recibe el cliente en vez
 * de cerrar sobre `prisma` por el mismo motivo que `examinarVinculoDeEmpresa` justo arriba: una
 * secuencia enterrada dentro de una llamada a `$transaction` sólo se puede auditar LEYENDO el
 * fuente, y leer no ejecuta nada. Así la suite la ejerce entera —el orden, los filtros y el valor
 * que escribe— sin levantar Postgres.
 *
 * @param tx el cliente Prisma (o el de la transacción: la firma es la misma)
 */
export async function desvincularYBorrar(
  tx: { customer: { updateMany: Function; deleteMany: Function } },
  merchantId: number,
  id: number,
) {
  // ① PRIMERO desvincular. Ver el porqué del orden en `deleteCustomer`.
  await tx.customer.updateMany({
    where: { merchantId, companyId: id },
    data: { companyId: null },
  });
  // ② y sólo entonces borrar.
  return tx.customer.deleteMany({ where: { id, merchantId } });
}

export async function deleteCustomer(merchantId: number, id: number) {
  // `$transaction` y no dos llamadas sueltas: los pasos caen juntos o no cae ninguno.
  // SCRUM-1005b: y sus documentos se van con él, en la misma transacción (c.22140).
  return prisma.$transaction((tx) => borrarClienteYSusDocumentos(tx as any, merchantId, id));
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1005b · DOCUMENTOS ADJUNTOS DEL CLIENTE (CRM-13). Decisión del fundador, SCRUM-1005
// c.22140: 10 MB por fichero, 100 MB por cliente, sólo PDF/JPEG/PNG, y al borrar un cliente se
// borran sus documentos. Viven en `attachments` (bytea, MEDIA-1) con `entityType: 'customer'` y
// `kind: 'document'`; `fileName`, `sizeBytes` y `sha256` son las tres columnas del ALTER de
// `docs/sql/scrum-1005-adjuntos-cliente.sql`. El servidor contesta CÓDIGOS, nunca frases: los
// textos de la pestaña los firma el fundador (regla 39, 1005c).
// ═══════════════════════════════════════════════════════════════════════════════════════════
export const DOC_MAX_BYTES = 10 * 1024 * 1024;
export const DOCS_MAX_BYTES_POR_CLIENTE = 100 * 1024 * 1024;
export const DOC_MIME_ADMITIDOS = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export type DocMime = (typeof DOC_MIME_ADMITIDOS)[number];
/** Espacio de cerrojos de transacción (los de la casa van de 1748 a 1752). */
const DOCUMENTOS_CLIENTE_LOCK_NS = 1753;
/**
 * La firma de los primeros bytes de cada formato. La cabecera `Content-Type` la escribe quien
 * sube, así que no basta: un HTML que dice ser PDF se rechaza aquí.
 */
const FIRMA_DE: Record<DocMime, number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
};

/** El `where` de los documentos de UN cliente. El comercio va SIEMPRE (regla 2). */
export function whereDocumentosDe(merchantId: number, customerId: number) {
  return { merchantId, entityType: 'customer', entityId: customerId, kind: 'document' };
}

export function esMimeAdmitido(m: string): m is DocMime {
  return (DOC_MIME_ADMITIDOS as readonly string[]).includes(m);
}

export function bytesCasanConMime(buf: Buffer, mime: DocMime): boolean {
  const firma = FIRMA_DE[mime];
  return buf.length >= firma.length && firma.every((b, i) => buf[i] === b);
}

/**
 * El nombre con el que se subió, saneado: sin ruta, sin caracteres de control, sin comillas ni
 * los reservados de Windows, y con 150 caracteres como mucho. `null` si no queda nada.
 */
export function sanearNombreDocumento(crudo: unknown): string | null {
  if (typeof crudo !== 'string' || crudo === '') return null;
  let s = crudo;
  try { s = decodeURIComponent(crudo); } catch { /* se queda como vino */ }
  s = s.split(/[\\/]/).pop() ?? '';
  s = s.normalize('NFC').replace(/[\x00-\x1f\x7f]/g, '').replace(/["<>:|?*]/g, '').replace(/\s+/g, ' ').trim();
  s = Array.from(s).slice(0, 150).join('');
  if (s === '' || s === '.' || s === '..') return null;
  return s;
}

/** `Content-Disposition: attachment` con el nombre en ASCII y en UTF-8 (RFC 6266 / 5987). */
export function contentDispositionAdjunto(nombre: string): string {
  const ascii = nombre.normalize('NFD').replace(/[^\x20-\x7e]/g, '_').replace(/["\\;]/g, '_');
  const utf8 = encodeURIComponent(nombre).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

async function clienteDelComercio(merchantId: number, customerId: number) {
  return prisma.customer.findFirst({ where: { id: customerId, merchantId }, select: { id: true } });
}

const SELECT_DOCUMENTO = { id: true, fileName: true, mime: true, sizeBytes: true, createdAt: true } as const;

/** La lista SIN bytes. `null` si el cliente no es de este comercio. */
export async function listarDocumentos(merchantId: number, customerId: number) {
  if (!(await clienteDelComercio(merchantId, customerId))) return null;
  return prisma.attachment.findMany({
    where: whereDocumentosDe(merchantId, customerId),
    select: SELECT_DOCUMENTO,
    orderBy: { createdAt: 'desc' },
  });
}

type DocumentoListado = { id: number; fileName: string | null; mime: string | null; sizeBytes: number | null; createdAt: Date };
export type ResultadoSubida =
  | { ok: true; creado: boolean; documento: DocumentoListado }
  | {
    ok: false;
    status: 400 | 404 | 409 | 413 | 415;
    error: 'NO_ENCONTRADO' | 'FICHERO_VACIO' | 'NOMBRE_NO_VALIDO' | 'FORMATO_NO_ADMITIDO' | 'FICHERO_DEMASIADO_GRANDE' | 'TOPE_DEL_CLIENTE';
  };

/**
 * Sube un documento. Idempotente por `sha256` dentro del MISMO cliente (como la foto del
 * albarán, SCRUM-382): la repetida devuelve la que ya estaba y no consume tope. El tope por
 * cliente se suma con `sizeBytes`, sin leer los bytea, bajo un cerrojo de transacción por cliente
 * para que dos subidas a la vez no lo pasen entre las dos.
 */
export async function subirDocumento(
  merchantId: number,
  customerId: number,
  entrada: { mime: string; nombre: unknown; bytes: Buffer },
): Promise<ResultadoSubida> {
  const { mime, bytes } = entrada;
  if (!esMimeAdmitido(mime)) return { ok: false, status: 415, error: 'FORMATO_NO_ADMITIDO' };
  if (bytes.length === 0) return { ok: false, status: 400, error: 'FICHERO_VACIO' };
  if (bytes.length > DOC_MAX_BYTES) return { ok: false, status: 413, error: 'FICHERO_DEMASIADO_GRANDE' };
  if (!bytesCasanConMime(bytes, mime)) return { ok: false, status: 415, error: 'FORMATO_NO_ADMITIDO' };
  const fileName = sanearNombreDocumento(entrada.nombre);
  if (!fileName) return { ok: false, status: 400, error: 'NOMBRE_NO_VALIDO' };
  if (!(await clienteDelComercio(merchantId, customerId))) return { ok: false, status: 404, error: 'NO_ENCONTRADO' };

  const huella = crypto.createHash('sha256').update(bytes).digest('hex');
  return prisma.$transaction(async (tx): Promise<ResultadoSubida> => {
    // Dentro del callback: el filtro de comercio se ve en la función que lee (SCRUM-243).
    const where = whereDocumentosDe(merchantId, customerId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${DOCUMENTOS_CLIENTE_LOCK_NS}::int, ${customerId}::int)`;
    const ya = await tx.attachment.findFirst({ where: { ...where, sha256: huella }, select: SELECT_DOCUMENTO });
    if (ya) return { ok: true, creado: false, documento: ya };
    const suma = await tx.attachment.aggregate({ where, _sum: { sizeBytes: true } });
    const usado = suma._sum.sizeBytes ?? 0;
    if (usado + bytes.length > DOCS_MAX_BYTES_POR_CLIENTE) return { ok: false, status: 409, error: 'TOPE_DEL_CLIENTE' };
    const creado = await tx.attachment.create({
      data: { ...where, url: '', data: new Uint8Array(bytes), mime, fileName, sizeBytes: bytes.length, sha256: huella },
      select: { id: true },
    });
    const documento = await tx.attachment.update({
      where: { id: creado.id },
      data: { url: `/admin/customers/${customerId}/documentos/${creado.id}` },
      select: SELECT_DOCUMENTO,
    });
    return { ok: true, creado: true, documento };
  });
}

/** El documento con sus bytes, o `null` si no es de este cliente de este comercio. */
export async function leerDocumento(merchantId: number, customerId: number, docId: number) {
  return prisma.attachment.findFirst({
    where: { id: docId, ...whereDocumentosDe(merchantId, customerId) },
    select: { id: true, data: true, mime: true, fileName: true },
  });
}

export async function borrarDocumento(merchantId: number, customerId: number, docId: number) {
  const { count } = await prisma.attachment.deleteMany({ where: { id: docId, ...whereDocumentosDe(merchantId, customerId) } });
  return count > 0;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1868a · BORRAR UN CLIENTE: qué lo impide y qué se va con él. Decisión del fundador en
// SCRUM-1868 (descripción y c.22850): BLOQUEAN sus presupuestos y sus facturas (una factura emitida no
// se borra, regla 29); SE BORRAN en la misma transacción sus equipos, sitios, historial, solicitudes
// y documentos. Sin tocar el esquema (reglas 3 y 40): `Quote`, `Invoice`, `QuoteRequest`,
// `CustomerEvent` y `CustomerSite` apuntan a `customers` sin `onDelete` (RESTRICT), así que la
// cascada la hace el código. `Charge.customerId` es opcional: la base lo pone a NULL y el cobro se
// queda; aquí no se toca. El servidor contesta CÓDIGOS, ninguna frase (regla 39).
// SCRUM-1868d · c.22916: bloquean también Job/ParteTrabajo/MaintenancePlan (sin FK: el huérfano lo evita el código); WhatsAppMessage/EmailMessage se desligan.
// ═══════════════════════════════════════════════════════════════════════════════════════════

export type MotivoDeBloqueo = 'tiene_facturas' | 'tiene_presupuestos' | 'tiene_trabajos' | 'tiene_partes' | 'tiene_mantenimientos';
export interface CuentaDelBorrado {
  documentos: number; sitios: number; equipos: number; historial: number;
  solicitudes: number; presupuestos: number; facturas: number;
  trabajos: number; partes: number; mantenimientos: number;
}

/** Lo lanza el borrado cuando el cliente tiene presupuestos o facturas; la ruta lo convierte en 409. */
export class BorradoBloqueado extends Error {
  constructor(readonly motivos: MotivoDeBloqueo[], readonly cuenta: CuentaDelBorrado) {
    super(motivos[0]);
    this.name = 'BorradoBloqueado';
  }
}

type ConCount = { count: Function };

/**
 * EL ÚNICO CRITERIO DE BLOQUEO: lo usan la lectura previa del modal y el borrado, así que no pueden
 * discrepar. Cada cuenta lleva el comercio (regla 2). Los documentos se cuentan con el MISMO `where`
 * con que se borran (todos los adjuntos del cliente, no sólo `kind: 'document'`). Las facturas van
 * delante en `motivos`: si hay de las dos, el `error` del 409 es `tiene_facturas`.
 */
export async function contarLoQueSeBorra(
  tx: {
    attachment: ConCount; customerSite: ConCount; equipment: ConCount; customerEvent: ConCount;
    quoteRequest: ConCount; quote: ConCount; invoice: ConCount;
    job: ConCount; parteTrabajo: ConCount; maintenancePlan: ConCount;
  },
  merchantId: number,
  id: number,
): Promise<{ motivos: MotivoDeBloqueo[]; cuenta: CuentaDelBorrado }> {
  const delCliente = { where: { merchantId, customerId: id } };
  const cuenta: CuentaDelBorrado = {
    documentos: await tx.attachment.count({ where: { merchantId, entityType: 'customer', entityId: id } }),
    sitios: await tx.customerSite.count(delCliente),
    equipos: await tx.equipment.count(delCliente),
    historial: await tx.customerEvent.count(delCliente),
    solicitudes: await tx.quoteRequest.count(delCliente),
    presupuestos: await tx.quote.count(delCliente),
    facturas: await tx.invoice.count(delCliente),
    trabajos: await tx.job.count(delCliente),
    partes: await tx.parteTrabajo.count(delCliente),
    mantenimientos: await tx.maintenancePlan.count(delCliente),
  };
  const motivos: MotivoDeBloqueo[] = [];
  if (cuenta.facturas > 0) motivos.push('tiene_facturas');
  if (cuenta.presupuestos > 0) motivos.push('tiene_presupuestos');
  if (cuenta.trabajos > 0) motivos.push('tiene_trabajos');
  if (cuenta.partes > 0) motivos.push('tiene_partes');
  if (cuenta.mantenimientos > 0) motivos.push('tiene_mantenimientos');
  return { motivos, cuenta };
}

/** La lectura previa del modal «Eliminar cliente»: `null` si el cliente no es de este comercio. No escribe. */
export async function previaDeBorrado(merchantId: number, id: number) {
  const cliente = await prisma.customer.findFirst({ where: { id, merchantId }, select: { id: true } });
  if (!cliente) return null;
  const { motivos, cuenta } = await contarLoQueSeBorra(prisma, merchantId, id);
  return { bloqueado: motivos.length > 0, motivos, cuenta };
}

/**
 * El borrado del cliente, con sus documentos (c.22140), EN LA MISMA transacción: o se va todo o
 * no se va nada. Sin FK a `customers` a propósito (la tabla es polimórfica; ver
 * `docs/sql/scrum-1005-adjuntos-cliente.sql`), así que lo hace el código. Se borran TODOS los
 * adjuntos del cliente, no sólo `kind: 'document'`: un dato personal no se queda por su `kind`.
 * Sólo si el cliente se ha borrado de verdad (count > 0): un id ajeno no toca nada.
 *
 * SCRUM-1833b · y sus equipos (decisión del fundador, SCRUM-1833 c.22828 ②), ANTES de la fila del
 * cliente: `equipments.customer_id` es FK RESTRICT (`docs/sql/scrum-914-equipos-del-cliente.sql:107`)
 * y sin esto el borrado da 500. Cada equipo pasa por `desligarYBorrarEquipo`, la MISMA función que el
 * botón de borrar un equipo: ninguna segunda copia del desligue. Con el comercio en el `where`, un id
 * ajeno no encuentra ningún equipo.
 */
export async function borrarClienteYSusDocumentos(
  tx: Parameters<typeof desligarYBorrarEquipo>[0] & Parameters<typeof contarLoQueSeBorra>[0] & {
    customer: { findFirst: Function; updateMany: Function; deleteMany: Function };
    attachment: { deleteMany: Function };
    equipment: { findMany: Function };
    customerSite: { deleteMany: Function };
    customerEvent: { deleteMany: Function };
    quoteRequest: { deleteMany: Function };
    whatsAppMessage: { updateMany: Function };
    emailMessage: Parameters<typeof desligarClienteEnBorrado>[0]['emailMessage'];
  },
  merchantId: number,
  id: number,
) {
  // SCRUM-1868a · ① de este comercio o no se toca nada (la ruta da 404); ② con presupuestos o
  // facturas no se borra (409): el MISMO contador que la lectura previa del modal.
  const cliente = await tx.customer.findFirst({ where: { id, merchantId }, select: { id: true } });
  if (!cliente) return { count: 0 };
  const { motivos, cuenta } = await contarLoQueSeBorra(tx, merchantId, id);
  if (motivos.length > 0) throw new BorradoBloqueado(motivos, cuenta);
  const equipos: Array<{ id: number }> = await tx.equipment.findMany({ where: { merchantId, customerId: id }, select: { id: true } });
  for (const e of equipos) await desligarYBorrarEquipo(tx, merchantId, id, e.id);
  // ③ SCRUM-1868a · lo que apunta a `customers` sin `onDelete` (RESTRICT), antes de su fila. Los sitios
  // DESPUÉS de los equipos: un equipo puede colgar de un sitio (`customer_site_id`, sin FK).
  await tx.customerSite.deleteMany({ where: { merchantId, customerId: id } });
  await tx.customerEvent.deleteMany({ where: { merchantId, customerId: id } });
  await tx.quoteRequest.deleteMany({ where: { merchantId, customerId: id } });
  // ④ SCRUM-1868d · b3 (c.22916): sus mensajes se quedan, sin cliente. `toPhone` y `toEmail` no se tocan.
  // Los correos los desliga `registroDeEnvios.ts`, el ÚNICO fichero que escribe `email_messages` (scrum508 y
  // scrum475 2B lo cazaron aquí en el CI del primer empujón, run 45985810879); `whatsapp_messages` no tiene ese
  // guard y `fusionClientes.ts:183` ya la escribe con `updateMany` desde fuera: mismo precedente.
  await tx.whatsAppMessage.updateMany({ where: { merchantId, customerId: id }, data: { customerId: null } });
  await desligarClienteEnBorrado(tx, merchantId, id);
  const r = await desvincularYBorrar(tx, merchantId, id);
  if (r.count > 0) await tx.attachment.deleteMany({ where: { merchantId, entityType: 'customer', entityId: id } });
  return r;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1833b · EQUIPOS DEL CLIENTE. Decisiones del fundador en SCRUM-1833 c.22811: el equipo
// cuelga SOLO del cliente (P3 ❌: `customerSiteId` no se acepta en el cuerpo), borrar es solo de
// admin (P4 ✅, en la ruta) y la garantía es una fecha, no un estado (P5 ❌). Criterio 4 de
// SCRUM-914: borrar un equipo pone a NULL su `equipmentId` en trabajo, plan de mantenimiento,
// albarán y parte, EN LA MISMA transacción. El servidor contesta CÓDIGOS, ninguna frase (1833c).
// ═══════════════════════════════════════════════════════════════════════════════════════════

const DIA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const vacioANull = (v: string | null | undefined) => (v === '' ? null : v);
const textoDelEquipo = z.string().trim().min(1).max(200);
const opcionalDelEquipo = z.string().trim().max(200).nullable().optional().transform(vacioANull);
const diaDelEquipo = z
  .string()
  .trim()
  .refine((s) => s === '' || (DIA_ISO.test(s) && diaExiste(s)))
  .nullable()
  .optional()
  .transform(vacioANull);

/** `z.strictObject`: un campo que no está aquí (`customerSiteId`, `merchantId`…) es un 400. */
export const equipoCreateSchema = z.strictObject({
  type: textoDelEquipo,
  name: textoDelEquipo,
  brand: opcionalDelEquipo,
  modelName: opcionalDelEquipo,
  serialNumber: opcionalDelEquipo,
  installedOn: diaDelEquipo,
  warrantyUntil: diaDelEquipo,
});
export const equipoUpdateSchema = equipoCreateSchema.partial();
export type EquipoCreateInput = z.infer<typeof equipoCreateSchema>;
export type EquipoUpdateInput = z.infer<typeof equipoUpdateSchema>;

const SELECT_EQUIPO = {
  id: true, customerId: true, type: true, name: true, brand: true, modelName: true, serialNumber: true,
  installedOn: true, warrantyUntil: true, createdAt: true, updatedAt: true,
} as const;

/** Las dos fechas son `@db.Date`: entran y salen como `YYYY-MM-DD`, sin hora ni zona. */
const aDia = (s: string | null | undefined) => (s === undefined ? undefined : s === null ? null : new Date(`${s}T00:00:00.000Z`));
const deDia = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

function columnasDelEquipo(datos: EquipoUpdateInput) {
  return {
    type: datos.type,
    name: datos.name,
    brand: datos.brand,
    modelName: datos.modelName,
    serialNumber: datos.serialNumber,
    installedOn: aDia(datos.installedOn),
    warrantyUntil: aDia(datos.warrantyUntil),
  };
}

function equipoParaFuera<T extends { installedOn: Date | null; warrantyUntil: Date | null }>(e: T) {
  return { ...e, installedOn: deDia(e.installedOn), warrantyUntil: deDia(e.warrantyUntil) };
}

/** Los equipos del cliente. `null` si el cliente no es de este comercio. */
export async function listarEquipos(merchantId: number, customerId: number) {
  if (!(await clienteDelComercio(merchantId, customerId))) return null;
  const filas = await prisma.equipment.findMany({
    where: { merchantId, customerId },
    select: SELECT_EQUIPO,
    orderBy: { id: 'asc' },
  });
  return filas.map(equipoParaFuera);
}

/** Alta de un equipo. `null` si el cliente no es de este comercio. */
export async function crearEquipo(merchantId: number, customerId: number, datos: EquipoCreateInput) {
  if (!(await clienteDelComercio(merchantId, customerId))) return null;
  const creado = await prisma.equipment.create({
    data: { merchantId, customerId, ...columnasDelEquipo(datos), type: datos.type, name: datos.name },
    select: SELECT_EQUIPO,
  });
  return equipoParaFuera(creado);
}

/** Edita un equipo de ESTE cliente de ESTE comercio. `null` si no lo es. */
export async function actualizarEquipo(merchantId: number, customerId: number, equipoId: number, datos: EquipoUpdateInput) {
  const { count } = await prisma.equipment.updateMany({
    where: { id: equipoId, merchantId, customerId },
    data: columnasDelEquipo(datos),
  });
  if (count === 0) return null;
  const fila = await prisma.equipment.findFirst({ where: { id: equipoId, merchantId, customerId }, select: SELECT_EQUIPO });
  return fila ? equipoParaFuera(fila) : null;
}

type ConUpdateMany = { updateMany: Function };
/**
 * LOS PASOS DEL BORRADO, EN ORDEN, SOBRE EL CLIENTE QUE SE LE DÉ (patrón `desvincularYBorrar`):
 * ① el equipo tiene que ser de este cliente de este comercio; ② se desliga de los cuatro
 * documentos del comercio que lo nombran; ③ se borra. Recibe `tx` para que la suite lo ejerza
 * entero sin Postgres; la transacción la pone `borrarEquipo`.
 */
export async function desligarYBorrarEquipo(
  tx: {
    equipment: { findFirst: Function; deleteMany: Function };
    job: ConUpdateMany; maintenancePlan: ConUpdateMany; albaran: ConUpdateMany; parteTrabajo: ConUpdateMany;
  },
  merchantId: number,
  customerId: number,
  equipoId: number,
): Promise<boolean> {
  const equipo = await tx.equipment.findFirst({ where: { id: equipoId, merchantId, customerId }, select: { id: true } });
  if (!equipo) return false;
  const desligar = { where: { merchantId, equipmentId: equipoId }, data: { equipmentId: null } };
  await tx.job.updateMany(desligar);
  await tx.maintenancePlan.updateMany(desligar);
  await tx.albaran.updateMany(desligar);
  // Literal, no `desligar`: scrum1488 tiene que poder leer que no escribe desplazamientos ni kilómetros.
  await tx.parteTrabajo.updateMany({ where: { merchantId, equipmentId: equipoId }, data: { equipmentId: null } });
  const { count } = await tx.equipment.deleteMany({ where: { id: equipoId, merchantId, customerId } });
  return count > 0;
}

/** Borra un equipo: o se desliga y se borra todo, o no cambia nada. */
export async function borrarEquipo(merchantId: number, customerId: number, equipoId: number) {
  return prisma.$transaction((tx) => desligarYBorrarEquipo(tx as any, merchantId, customerId, equipoId));
}
