// src/core/validation/schemas.ts
import { z } from 'zod';
import { validarNifEspanol } from './nifEspanol'; // SCRUM-575 (CONT-02)
import { invalidTipoIva, invalidPrefijoSerie } from './fiscalInput'; // SCRUM-217
// SCRUM-602 (DOC-12) · los tres modos, DERIVADOS del dominio: una segunda lista aquí envejecería sola.
import { MODOS_DIRECCION_OBRA } from '../documentos/direccionObra';

// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-712 · CUÁNTOS DECIMALES ADMITE UN NÚMERO DE DINERO EN LA PUERTA
//
// Hasta hoy: `z.number().nonnegative()` — decimales ILIMITADOS. Medido ejecutando el esquema
// real: `1.23456789` entraba y se guardaba tal cual. No es teórico — es el camino por el que
// entró el `30,003` de la única divergencia real medida en este árbol (SCRUM-624).
//
// 🔴 Y NO LO ACOTABA NADIE AGUAS ABAJO. `Product.price` es `Decimal(12,2)` y la base trunca en
// silencio, pero el precio de una LÍNEA de presupuesto vive en `Quote.lines`, que es una columna
// **`Json`**: ahí no hay truncado. Se guarda con todos sus decimales.
//
// ── LA DECISIÓN DEL FUNDADOR (4-sep-2026), y por qué son dos números y no uno ─────────────
//
//   PRECIO UNITARIO  → 4 decimales   (`price`, `costeUnitario` de una línea)
//   IMPORTE          → 2 decimales   (`total` de un tramo, `amount` de un cobro)
//
// **Un importe en euros tiene dos decimales y punto.** Un PRECIO UNITARIO no: un electricista
// compra cable a 0,4567 €/m. Acotarlo a 2 destruiría EN SILENCIO precisión que el profesional
// escribió — 0,46 en vez de 0,4567 son 20 céntimos de su margen sobre 60 metros, y nadie se lo
// dice. Es la misma familia de defecto que este árbol lleva dos días cerrando: un dato que se
// pierde sin avisar.
//
// **POR QUÉ 4 Y NO 3 O 5:** porque 4 ya es la escala que esta casa usa cuando necesita más de
// dos — `Merchant.costEstimate` es `Decimal(8,4)` y `Product.vat` es `Decimal(5,4)`. No es un
// número que suene bien: es el que ya está en el esquema.
//
// 🔴 CUATRO DECIMALES EN LA PUERTA NO SON CUATRO AGUAS ABAJO, y esto es lo que impide que esto
// reabra el 30,003. El importe de línea, la base, la cuota y el total siguen a DOS, y el redondeo
// se hace UNA SOLA VEZ Y AL FINAL (SCRUM-293, ya escrito; SCRUM-436 lo vigila al pintar). El
// defecto viejo nunca fue que entraran decimales: fue que se redondeaba en DOS SITIOS con DOS
// CONVENCIONES.
//
// ── ⚠️ POR QUÉ `multipleOf` Y NO CONTAR DECIMALES A MANO ──────────────────────────────────
//
// Los `number` de coma flotante MIENTEN con los decimales: `1.005` se representa como
// `1.00499999999999989`. Una acotación que cuente decimales sobre el bit acepta o rechaza según
// el valor que toque. `multipleOf` de zod usa una comparación decimal segura, y **está medido en
// `tests/scrum712-decimales-de-precio.test.mjs` contra las tres trampas** —`1.005`, `8.165` y
// `0.1+0.2`— antes de darlo por bueno.
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Un PRECIO UNITARIO: lo que cuesta UNA unidad. Admite más precisión que un importe. */
export const DECIMALES_PRECIO_UNITARIO = 4;
/** Un IMPORTE en euros. Dos decimales y punto. */
export const DECIMALES_IMPORTE = 2;
/**
 * Un PORCENTAJE (SCRUM-594, aprobado por el fundador el 4-sep-2026).
 *
 * 🔴 CONSTANTE PROPIA Y NO `DECIMALES_IMPORTE`, aunque hoy valgan lo mismo. Un porcentaje **no
 * es un importe**: comparten número por ahora, y llamar «importe» a un descuento del 33,33 %
 * haría que el día que uno de los dos se mueva se muevan los dos sin que nadie lo decida. La
 * decisión del fundador enumera TRES tipos —precio unitario, importe y porcentaje—, y aquí se
 * escriben los tres.
 *
 * Acotarlo cierra la misma puerta que SCRUM-712: sin esto, un `33,3333 %` mete decimales
 * infinitos en `Quote.lines`, que es una columna `Json` y no trunca nada.
 */
export const DECIMALES_PORCENTAJE = 2;

/** El paso mínimo para N decimales: 4 → 0.0001. Se deriva; no se escribe el número dos veces. */
const pasoDe = (decimales: number) => Number('0.' + '0'.repeat(decimales - 1) + '1');

/**
 * Acota los decimales de un número de dinero, y el rojo NOMBRA el valor y sus decimales.
 *
 * «Validación fallida» obliga a quien lo lea a ir a buscar qué número fue. Aquí lo dice.
 */
function conDecimales(base: z.ZodNumber, decimales: number, queEs: string) {
  return base.multipleOf(pasoDe(decimales), {
    error: (iss) => {
      const v = String(iss.input);
      const tiene = v.includes('.') ? v.split('.')[1].length : 0;
      return `${queEs} ${v} tiene ${tiene} decimales y el máximo son ${decimales}.`;
    },
  });
}

// ------- QUOTES -------

const QuoteLineSchema = z.object({
  concept: z.string().min(1),
  // SCRUM-655 · OPCIONALES EN EL OBJETO, OBLIGATORIAS EN EL REFINE. Una CABECERA de apartado no
  // lleva cantidad ni precio —es un renglón de título—, así que exigirlas aquí la haría imposible.
  // Pero relajarlas sin más debilitaría la puerta para las líneas normales, que es donde vive el
  // dinero: el `superRefine` de abajo las vuelve a exigir a todas las que NO son cabecera, con la
  // misma dureza de siempre (positiva y no negativa).
  qty: z.number().positive().optional(),
  price: conDecimales(z.number().nonnegative(), DECIMALES_PRECIO_UNITARIO, 'el precio').optional(),
  /**
   * SCRUM-661 (③) · EL COSTE UNITARIO CONGELADO EN EL MOMENTO DE LA VENTA.
   *
   * Sin declararlo aquí, `z.object` lo BORRA en silencio —igual que le pasaba a `suplido` antes
   * de SCRUM-500— y no llegaría nunca a `Quote.lines`.
   *
   * Se guarda el COSTE y no el margen a propósito: el margen es una conclusión y quedaría
   * incoherente si alguien edita el precio; el coste es un HECHO de ese día. Y hace falta
   * congelarlo porque `Product.cost` es MUTABLE y NO tiene histórico: sin esto, el margen real
   * de una venta no se puede reconstruir ni en teoría. No es que no guardemos el margen — es que
   * no guardamos el hecho del que se derivaría.
   *
   * 🔴 QUE FALTE SIGNIFICA «NO SE SABE», Y ESO NO ES CERO. Una línea escrita a mano, una anterior
   * a este campo o un producto sin coste llegan SIN la clave. Un `0` significaría «costó cero»,
   * que es una afirmación que nadie ha hecho. Por eso es `.optional()` y NO `.default(0)`: un
   * default convertiría el silencio en un dato, y ese dato sería falso.
   */
  costeUnitario: conDecimales(z.number().nonnegative(), DECIMALES_PRECIO_UNITARIO, 'el coste unitario').optional(),
  /**
   * SCRUM-594 (DOC-04) · el descuento de ESTA línea, en PORCENTAJE (0-100).
   *
   * 🔴 `.optional()` Y NUNCA `.default(0)`, por el mismo motivo que `costeUnitario` justo
   * arriba: si no se declara aquí, `z.object` lo BORRA en silencio y no llegaría a
   * `Quote.lines`; y un default convertiría el silencio en un dato. Una línea SIN `dto` —y lo
   * son todas las anteriores a este ticket— tiene que seguir dando exactamente el mismo total.
   *
   * El tope de 100 no es cosmético: un 150 % dejaría el precio NEGATIVO, y un presupuesto no
   * puede pedirle dinero al cliente por una línea.
   *
   * 🔴 Y DOS DECIMALES, aprobado por el fundador el 4-sep-2026 como TERCER tipo junto al precio
   * unitario (4) y al importe (2) de SCRUM-712. Sin esto, un `33,3333 %` vuelve a meter decimales
   * infinitos por la puerta que aquel ticket acaba de cerrar — y aquí duele igual, porque el
   * descuento acaba multiplicando un precio que sí está acotado. Usa el MISMO mecanismo que main
   * (`conDecimales`), con su mensaje que nombra el valor y sus decimales.
   */
  dto: conDecimales(z.number().min(0).max(100), DECIMALES_PORCENTAJE, 'el descuento').optional(),
  // SCRUM-217 (1124): `min(0).max(1)` aceptaba CUALQUIER fracción — un 15 % pasaba sin queja, y
  // el 15 % no es un tipo de IVA español. El validador decía que sí a un impuesto inventado, y
  // ese tipo acaba en la cuota que entra en la huella. Ahora solo pasan los que existen.
  tax: z.number()
    .superRefine((v: number, ctx: z.RefinementCtx) => {
      const motivo = invalidTipoIva(v);
      if (motivo) ctx.addIssue({ code: 'custom', message: `El IVA ${motivo}` });
    })
    .optional().default(0),
  /**
   * SCRUM-500 · LA MARCA DE SUPLIDO. Sin declararla aquí, `z.object` la BORRA en silencio —zod
   * quita las claves que no conoce— y la casilla del editor no llegaría nunca a `Quote.lines`.
   * Que falte significa «no es un suplido», que es lo que tienen todas las líneas de siempre.
   */
  suplido: z.boolean().optional(),
  /**
   * SCRUM-655 · LA MARCA DE CABECERA DE APARTADO. Sin declararla aquí `z.object` LA BORRA en
   * silencio —zod quita las claves que no conoce— y el apartado no llegaría nunca a
   * `Quote.lines`: la pantalla mostraría un apartado y la base guardaría una línea normal.
   */
  apartado: z.boolean().optional(),
}).superRefine((linea, ctx) => {
  // 🔴 UN SUPLIDO NO LLEVA IVA, Y SE EXIGE EN LA PUERTA. La pantalla ya fuerza `tax: 0`
  // (`quoteSuplido.js`), pero la pantalla no es la única que llama a esta ruta: quedarse solo con
  // el front deja el impuesto sobre el impuesto a un `curl` de distancia.
  //
  // Y NO se corrige a 0 por las buenas: un payload que marca suplido y a la vez pide cobrar IVA
  // está diciendo dos cosas contradictorias, y elegir cuál de las dos era la buena es inventar.
  // Se rechaza nombrando la línea, que es lo que permite arreglarla.
  if (linea.suplido === true && Number(linea.tax) !== 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['tax'],
      message:
        `Un suplido no lleva IVA: «${linea.concept}» viene marcada como suplido y con un IVA del ` +
        `${Math.round(Number(linea.tax) * 100)} %. Un suplido es lo que se paga POR CUENTA del ` +
        'cliente y se le repercute tal cual: repercutirle IVA es cobrar impuesto sobre impuesto.',
    });
  }

  // ── SCRUM-655 · CABECERA DE APARTADO ───────────────────────────────────────────────────
  const esCabecera = linea.apartado === true;

  // 🔴 Una CABECERA no lleva importes. No se le limpian por las buenas: un payload que dice
  // «esto es un título» y a la vez trae precio está diciendo dos cosas contradictorias, y elegir
  // cuál era la buena es inventar. Se rechaza NOMBRANDO la línea, que es lo que permite
  // arreglarla. El total ya la ignora igualmente (`apartados.ts`), así que esto no es lo que
  // protege el dinero: es lo que impide que alguien crea que un título cobra.
  if (esCabecera && (linea.qty !== undefined || linea.price !== undefined)) {
    ctx.addIssue({
      code: 'custom',
      path: ['qty'],
      message: `Un apartado es un título, no una línea que cobre: «${linea.concept}» viene marcada `
        + 'como apartado y con cantidad o precio. Quítale los importes o desmárcala.',
    });
  }

  // SCRUM-661 · y tampoco COSTE, por la misma razón y con el mismo trato: un título no se
  // compra. Va aparte del `if` de arriba para que el mensaje nombre el campo que sobra — decir
  // «cantidad o precio» cuando lo que trae es un coste manda a mirar donde no es.
  if (esCabecera && linea.costeUnitario !== undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['costeUnitario'],
      message: `Un apartado es un título, no algo que se compre: «${linea.concept}» viene marcada `
        + 'como apartado y con coste unitario. Quítaselo o desmárcala.',
    });
  }

  // Y AL REVÉS: una línea normal SIGUE necesitando las dos. Es la dureza de siempre, movida aquí
  // porque el objeto ya no puede exigirlas —si las exigiera, no cabría ninguna cabecera—.
  if (!esCabecera) {
    if (linea.qty === undefined) {
      ctx.addIssue({ code: 'custom', path: ['qty'], message: `Falta la cantidad de «${linea.concept}».` });
    }
    if (linea.price === undefined) {
      ctx.addIssue({ code: 'custom', path: ['price'], message: `Falta el precio de «${linea.concept}».` });
    }
  }
});

const QuoteTierSchema = z.object({
  id: z.enum(['good', 'better', 'best']),
  label: z.string().min(1),
  description: z.string().optional(),
  lines: z.array(QuoteLineSchema).min(1),
  recommended: z.boolean().optional().default(false),
  // SCRUM-712 · es un IMPORTE, no un precio unitario: dos decimales.
  total: conDecimales(z.number(), DECIMALES_IMPORTE, 'el total del tramo').optional(), // calculado en backend, puede venir del cliente
});

export const CreateQuoteSchema = z.object({
  merchant_id: z.number().int().positive(),
  customer_id: z.number().int().positive(),
  currency: z.string().length(3),
  // Modo clásico: array de líneas
  lines: z.array(QuoteLineSchema).min(1).optional(),
  // Modo Good/Better/Best: exactamente 3 tiers
  tiers: z.array(QuoteTierSchema).length(3).optional(),
  paymentTerms: z.enum(['FULL_UPFRONT', 'FIFTY_FIFTY', 'MANUAL']).optional().nullable(),
  // V0-3: telemetría quote_created_via (VOZ-1 enviará 'voice')
  created_via: z.enum(['text', 'voice']).optional(),
  // A2.1: métodos de pago habilitados para este presupuesto (selector al crear).
  // Omitido = todos los que el merchant tenga disponibles.
  payMethods: z.array(z.enum(['card', 'bizum', 'transfer'])).min(1).optional(),
  // A20.4: qué datos del cliente muestra el DOCUMENTO (null = todos los presentes)
  docFields: z.object({ name: z.boolean(), phone: z.boolean(), taxId: z.boolean(), email: z.boolean() }).partial().nullable().optional(),
  /**
   * SCRUM-594 (DOC-04) · el descuento GLOBAL del presupuesto, en EUROS.
   *
   * `nullable` Y `optional`, y no son lo mismo: omitido = «este cliente no manda el campo»
   * (todo lo anterior a este ticket), `null` = «lo quitó a propósito». Sin `nullable`, borrar un
   * descuento ya puesto sería un 400 — el mismo criterio que `docHeaderText` justo debajo.
   */
  discountGlobalAmount: z.number().nonnegative().nullable().optional(),
  // SCRUM-593 (DOC-03) · los dos textos libres del documento.
  //
  // `nullable` Y `optional` son cosas DISTINTAS y las dos hacen falta: omitido = «este cliente
  // no manda el campo» (todo lo anterior a esta tarea), `null` = «lo mandó vacío a propósito».
  // Sin `nullable`, vaciar un texto ya escrito sería un 400.
  //
  // 🔴 TOPE DE 2000, el MISMO que `Albaran.notas` —el campo hermano, en el mismo documento— para
  // que el profesional no tenga dos límites distintos para lo mismo. Aquí RECHAZA en vez de
  // recortar, y la diferencia queda declarada en la entrada de máster: la ruta del albarán no
  // valida con zod y añadirle un 400 nuevo tropezaría con el trinquete de SCRUM-275.
  //
  // NO se recorta ni se normaliza el contenido: los saltos de línea son DATO (SCRUM-655 · T6).
  docHeaderText: z.string().max(2000).nullable().optional(),
  docFooterText: z.string().max(2000).nullable().optional(),
  /**
   * SCRUM-602 (DOC-12) · LA DIRECCIÓN DE LA OBRA de este presupuesto.
   *
   * 🔴 EL MODO ES UN `enum` DERIVADO, no una lista escrita aquí: `MODOS_DIRECCION_OBRA` vive en
   * `src/core/documentos/direccionObra.ts` y es la misma que usa el resolvedor. Copiar los tres
   * valores en este fichero crearía una segunda lista que puede envejecer sola — y el día que se
   * añada un cuarto modo, la validación lo rechazaría mientras el resolvedor lo entiende.
   *
   * `nullable` Y `optional`, igual que los dos textos de arriba y por el mismo motivo: omitido =
   * «este cliente no manda el campo» (todo lo anterior a este ticket), `null` = «lo quitó a
   * propósito».
   *
   * ⚠️ EL TOPE ES 300 Y AQUÍ NO SE VALIDA CONTRA ÉL: se RECORTA en `normalizarDireccionObra`,
   * que es lo que ya hacen `normalizarLugarEntrega` y `normalizarJobDireccion` con el mismo
   * dato. Un 400 por una dirección larga sería un tercer comportamiento para el mismo campo en
   * el mismo producto. El `max(2000)` de aquí es sólo el suelo contra un cuerpo abusivo.
   */
  shippingAddressMode: z.enum(MODOS_DIRECCION_OBRA).nullable().optional(),
  shippingAddress: z.string().max(2000).nullable().optional(),
  // A16.2: caducidad del presupuesto (default 30 días en el server; editable al crear)
  validUntil: z.coerce.date().optional(),
  // SCRUM-27: plan de cobro personalizado (N tramos). Presente = ignora paymentTerms.
  // La suma-100% / etiqueta no vacía / % > 0 se valida en la ruta (validateCustomBillingPlan) con mensaje es-ES.
  customBillingPlan: z.array(z.object({ percentage: z.number(), label: z.string() })).optional(),
  // SCRUM-195 (rebanada 3): el Trabajo al que se engancha este presupuesto. Presente = es un
  // ADICIONAL sobre un Trabajo que ya existe, y NO se crea un Trabajo nuevo al aceptarlo.
  // Ausente = presupuesto normal, que es el comportamiento de siempre.
  job_id: z.number().int().positive().optional(),
  // SCRUM-656 (T7) · CÓMO presenta el IVA ESTE presupuesto. Lo elige el profesional al crearlo,
  // según el cliente que tenga delante — por eso viaja en el payload y no en Configuración.
  //
  // ⛔ Y NO EXISTE EN LA FACTURA: una factura lleva base, cuota y total SIEMPRE (reglamento de
  // facturación). Esta clave vive en el presupuesto y muere ahí.
  //
  // Cerrado a los dos valores: un modo libre dejaría meter un 'sin_iva' que nadie pinta y el
  // documento saldría mudo sin que fallara nada.
  ivaModo: z.enum(['sumar', 'no_incluido']).optional(),
  // Las cláusulas del merchant que ESTE presupuesto no lleva. Excluir no es borrar: la
  // configuración no se toca y el siguiente presupuesto vuelve a llevarlas.
  clausulasExcluidas: z.array(z.string()).optional(),
});

export type QuoteTier = z.infer<typeof QuoteTierSchema>;


// imports arriba ya tendrán algo como: import { z } from "zod";

export const AcceptQuoteSchema = z.object({
  // Desde dónde ha venido la decisión del cliente
  channel: z.enum(['whatsapp', 'web', 'other']).optional(),

  // Comentario libre del cliente (o que le pasemos desde el flujo)
  comment: z.string().max(500).optional(),

  // Texto tipo "50% al aceptar, 50% al finalizar"
  // Guardamos el código interno
  paymentTerms: z
    .enum(['FULL_UPFRONT', 'FIFTY_FIFTY', 'MANUAL'])
    .optional()
    .nullable(),

  // Cualquier extra (ip, userAgent, etc.)
  evidence: z.any().optional(),
});


export const RejectQuoteSchema = z.object({
  channel: z.enum(['whatsapp', 'web', 'other']).optional(),

  // Motivo del rechazo (en WhatsApp será lo que nos escriba)
  reason: z.string().min(1).max(500),

  // Comentario adicional (podemos duplicar reason aquí si queremos)
  comment: z.string().max(500).optional(),

  evidence: z.any().optional(),
});


// ------- CHARGES -------

export const CreateChargeSchema = z.object({
  merchant_id: z.number().int().positive(),
  concept: z.string().min(1),
  amount: conDecimales(z.number().positive(), DECIMALES_IMPORTE, 'el importe del cobro'),
  currency: z.string().length(3),
  // Cliente existente (preferido): evita duplicar clientes al crear el cobro.
  customer_id: z.number().int().positive().optional(),
  customer: z
    .object({
      name: z.string().min(1),
      phone: z.string().min(5).optional(),
      email: z.string().email().optional(),
    })
    .optional(),
  expires_at: z.string().optional(),
  method_preference: z.enum(['bank', 'card', 'mp']).optional().default('bank'),
  meta: z.record(z.string(), z.unknown()).optional(),
  // A2.1: métodos habilitados para este cobro (heredados del quote al facturar;
  // omitido = todos los que el merchant tenga disponibles)
  pay_methods: z.array(z.enum(['card', 'bizum', 'transfer'])).min(1).optional(),
});

export const IssueInvoiceSchema = z.object({
  charge_id: z.number().int().positive(),
});

// ------- PSP WEBHOOK -------

export const PSPWebhookSchema = z.object({
  event: z.enum(['payment.confirmed', 'payment.failed', 'payment.expired']),
  charge_id: z.union([z.string(), z.number()]),
  method: z.string().optional(),
  bank_ref: z.string().optional(),
  amount: conDecimales(z.number().positive(), DECIMALES_IMPORTE, 'el importe notificado').optional(),
  currency: z.string().length(3).optional(),
  ts: z.string().optional(),
});

// ------- MERCHANT PROFILE -------

export const merchantProfileUpdateSchema = z.object({
  // SCRUM-656 (T7 fase B) · LAS CLÁUSULAS DE CIERRE DEL PRESUPUESTO, escritas UNA vez.
  //
  // 🔴 El `id` viaja y NO se recalcula: la exclusión de un presupuesto es una lista de `id`
  // (`quotes.clausulas_excluidas`), y reasignarlos al reeditar haría que un presupuesto que
  // quitó la garantía pasara a quitar otra cláusula. No fallaría nada: saldría un PDF con una
  // condición que el profesional había retirado a propósito.
  //
  // `nullable` Y `optional`, y no es lo mismo: AUSENTE = la pantalla no las manda y no se tocan;
  // `null` = el profesional las ha borrado todas, que es un valor guardable.
  //
  // El texto NO se valida más allá de que exista: lo escribe el merchant (regla 30), y una
  // garantía es una obligación jurídica, no un adorno del pie del documento.
  clausulasPresupuesto: z.array(z.object({
    id: z.string().optional(),
    titulo: z.string(),
    texto: z.string(),
  })).nullable().optional(),
  name: z.string().min(1).optional(),
  legalName: z.string().min(1).optional(),
  taxId: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  // SCRUM-294 (fase C) · criterio de caja (RECC). `nullable` Y `optional` a proposito, y no son lo
  // mismo: AUSENTE = la pantalla no lo manda y no se toca; `null` = el negocio elige «no consta»,
  // que es un valor guardable y distinto de `false`. Un `z.boolean()` a secas colapsaria los tres
  // estados en dos y «no se pregunto» se guardaria como «declara que no».
  criterioCaja: z.boolean().nullable().optional(),
  trade: z
    .enum([
      'electricista', 'fontanero', 'reformista', 'pintor',
      'cerrajero', 'climatizacion', 'otro',
    ])
    .nullable()
    .optional(),
  defaultCurrency: z
    .string()
    .length(3)
    .optional(), // "EUR", "MXN", "BRL", etc.
  // SCRUM-217 (1130/1287): el prefijo acaba DENTRO de `NumSerieFactura`, y ahí la AEAT prohíbe
  // " ' < > = y todo lo que no sea ASCII imprimible. No se validaba nada: un merchant podía
  // fijar una serie que hace rechazar TODAS sus facturas, y enterarse al remitir.
  invoiceSeriesPrefix: z.string()
    .superRefine((v: string, ctx: z.RefinementCtx) => {
      const motivo = invalidPrefijoSerie(v);
      if (motivo) ctx.addIssue({ code: 'custom', message: `El prefijo de serie ${motivo}` });
    })
    .optional(),
  // Logo: URL http(s) o data-URI de imagen (subida desde Configuración,
  // redimensionada a ≤512px en cliente; cap 1,5M chars ≈ 1 MB decodificado)
  logoUrl: z.union([
    z.string().url(),
    z.string().regex(/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/).max(1_500_000),
  ]).nullable().optional(),
  whatsappPhone: z.string().min(6).max(20).optional(),
  // C1-4: móvil para Bizum manual (default en UI: whatsappPhone)
  bizumPhone: z.string().min(6).max(20).nullable().optional(),
  // A2.5 (fix PV): el PRO pega "g.page/r/..." sin protocolo y el .url() tiraba
  // TODO el guardado con 400 ("googleReviewUrl no se guarda"). Se tolera sin
  // https:// anteponiéndolo antes de validar.
  googleReviewUrl: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() && !/^https?:\/\//i.test(v.trim()) ? `https://${v.trim()}` : v),
    z.string().url().nullable().optional(),
  ),
  country: z.string().length(2).optional(),
  iban: z.string().min(10).max(34).nullable().optional(),
  clabe: z.string().length(18).nullable().optional(),
  // A6.7: bloques visibles de la Home — {hero,quick,kpis,week,activity,tops}: bool
  homePrefs: z.record(z.string(), z.boolean()).nullable().optional(),
  notifyEmailOnPaid:          z.boolean().optional(),
  notifyEmailOnQuoteAccepted: z.boolean().optional(),
  notifyEmailWeeklyDigest:    z.boolean().optional(),
  // Enterprise
  brandColor:        z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  brandAccentColor:  z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  approvalThreshold: z.number().min(0).nullable().optional(),
  // A14.1 (PERFIL-1): página pública /p/:slug — minúsculas-guiones 3-40, sin guion
  // en los extremos; reservados y cooldown 30d se validan en merchantAdmin.
  slug: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.string().regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/).nullable().optional(),
  ),
  profileZones: z.array(z.string().trim().min(1).max(40)).max(12).nullable().optional(),
  profileYears: z.number().int().min(0).max(80).nullable().optional(),
});

export type MerchantProfileUpdateInput = z.infer<
  typeof merchantProfileUpdateSchema
>;

// ------- CUSTOMERS (NUEVO) -------

// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-609 (CAT-01) · EL LADO DEL CATÁLOGO: producto o servicio.
//
// Mismo patrón y misma forma que `contactKind` (CONT-01), que es lo que ya está mergeado:
// mayúsculas, sin acentos, y `nullable().optional()` para dar los tres casos sin inventar
// ninguno — ausente = no se toca · null = no declarado · declarado por el profesional.
//
// 🔴 NO es una etiqueta que se guarda: DECIDE QUÉ CAMPOS ENSEÑA la ficha. Un servicio no
// tiene coste, ni margen, ni proveedor.
export const ITEM_KIND = ['PRODUCTO', 'SERVICIO'] as const;
export const itemKindSchema = z.enum(ITEM_KIND).nullable().optional();
export type ItemKind = (typeof ITEM_KIND)[number];

export const customerCreateSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(5).optional(),
  email: z.string().email().optional(),
  notes: z.string().max(1000).optional(),
  // J3: baja de WhatsApp (manual desde la ficha hasta WA-0b/BOT-1)
  waOptOut: z.boolean().optional(),
  // SCRUM-574 (CONT-01): FORMA JURÍDICA del contacto — la pregunta del switch Empresa/Persona.
  // 🔴 NO es `tipoDestinatario`, que está tres líneas más abajo y responde otra cosa (capacidad
  // fiscal, plazo del art. 13.2). Un autónomo es PERSONA aquí y EMPRESARIO allí. Están prohibidos
  // de mezclar: ni derivar uno del otro, ni un default que lo deduzca (fundador, 24-ago-2026).
  // `nullable().optional()` da los tres casos sin inventar ninguno, igual que sus vecinos:
  // ausente = no se toca · null = no declarado · 'EMPRESA'/'PERSONA' = declarado por el profesional.
  contactKind: z.enum(['EMPRESA', 'PERSONA']).nullable().optional(),
  // A20.4 (EXT3): cliente empresa — el NIF además es requisito del VeriFactu
  // futuro (hallazgo S1-C: F1 exige NIF del destinatario)
  legalName: z.string().max(200).nullable().optional(),
  // SCRUM-575 (CONT-02): forma y digito de control. VACIO SIGUE SIENDO VALIDO — validar no es
  // obligar, y `nullable().optional()` lo garantiza antes de llegar al refine. El mensaje es un
  // CODIGO ESTABLE y no prosa: lo que lee el profesional es del fundador (regla 30) y lo pone el
  // formulario con su marcador. Aqui solo viaja el motivo, que ademas acaba en logs.
  taxId: z.string().max(20).nullable().optional()
    .refine((v) => validarNifEspanol(v).valido, { message: 'taxId_invalido' }),
  // SCRUM-69 (FACT-1): determina el plazo legal de la recapitulativa (art. 13 RD 1619/2012).
  // null = sin clasificar (se trata como PARTICULAR en el cálculo, ver resolveTipoDestinatario).
  tipoDestinatario: z.enum(['PARTICULAR', 'EMPRESARIO']).nullable().optional(),
  /**
   * SCRUM-579 (CONT-06) · LA DIRECCIÓN DE FACTURACIÓN. Una, no dos.
   *
   * Sin declararlas aquí, `z.object` las BORRA en silencio —igual que le pasaba a `suplido`
   * antes de SCRUM-500— y no llegarían nunca a `customers`.
   *
   * 🔴 `nullable().optional()` LAS CINCO, y da los tres casos sin inventar ninguno:
   *   ausente = no se toca · null = no consta · texto = lo declaró el profesional.
   * Ninguna lleva `.default()`: «este cliente no tiene dirección» y «tiene la dirección en
   * blanco» tienen que poder leerse DISTINTO, o el dato no vale para calcular nada. Es el mismo
   * argumento por el que la columna no lleva `DEFAULT 'ES'`.
   *
   * ⚠️ EL PAÍS VIAJA COMO ISO-3166-1 alfa-2 (`ES`), no como nombre. Es lo que ya guarda
   * `Merchant.country` —medido: `ES`— y lo que usa `prefijosPais.js`. El nombre lo pone el
   * navegador con `Intl.DisplayNames`, así que guardarlo sería guardar una TRADUCCIÓN: el mismo
   * cliente se llamaría «España» o «Spain» según quién lo diera de alta.
   *
   * ⛔ Esto NO es la dirección de la OBRA. El fundador cerró la P2 el 24-ago-2026: la de obra
   * pertenece al DOCUMENTO, porque un cliente puede tener tres obras. Eso es DOC-12.
   */
  billingAddress: z.string().max(200).nullable().optional(),
  billingCity: z.string().max(100).nullable().optional(),
  // SCRUM-580 (CONT-07) · las etiquetas del contacto.
  //
  // `nullable` Y `optional`, que son cosas distintas y las dos hacen falta: omitido = «no toques
  // este campo» en una edicion parcial, `null` = «quitale todas». Sin `nullable`, vaciar las
  // etiquetas de un cliente seria un 400.
  //
  // Aqui solo se comprueba la FORMA. El recorte, el tope y el «vacio → null» viven en
  // `normalizarTags` (`src/modules/system/tagsDelCliente.ts`), en un solo sitio y probados sin base.
  tags: z.array(z.string()).nullable().optional(),
  billingPostalCode: z.string().max(20).nullable().optional(),
  billingProvince: z.string().max(100).nullable().optional(),
  billingCountry: z.string().max(2).nullable().optional(),
  /**
   * SCRUM-588 (CONT-16) · La referencia interna del cliente. **Campo LIBRE a propósito**: el
   * `.max(120)` es un tope de almacenamiento, no un formato. No hay `regex`, no hay unicidad y
   * no se autogenera — es el número de OTRO sistema (expediente, finca, código heredado) y
   * validar su forma sería rechazarle al profesional un dato que él sí tiene delante.
   *
   * `.nullable()` porque «ausente ≠ vacío»: el front manda `null`, nunca `''`.
   */
  internalRef: z.string().max(120).nullable().optional(),
  // SCRUM-171b (FACT-2d): periodicidad PACTADA. Sirve para AVISAR de que toca facturar, nunca
  // para facturar sola (regla 28: un envío automático nuevo exigiría su entrada en la tabla J6).
  // Lista cerrada aquí; el default de la BD es 'NINGUNA' = sin aviso, que es lo de hoy.
  billingPeriodicity: z.enum(['NINGUNA', 'QUINCENAL', 'MENSUAL']).optional(),
  // SCRUM-294-a (A3): recargo de equivalencia del CLIENTE. `nullable().optional()` da los tres
  // estados sin inventar ninguno: ausente = no se toca · null = no consta · true/false = declarado.
  // 🔴 Nunca se coacciona a false: false es un valor LEGITIMO («declara que no»), asi que degradar
  // a false una lectura fallida seria el peor sitio para hacerlo — nadie notaria el fallo (SCRUM-271).
  recargoEquivalencia: z.boolean().nullable().optional(),
  /**
   * SCRUM-587 (CONT-14) · El descuento PACTADO con este cliente, en PORCENTAJE (0-100).
   *
   * `nullable().optional()` como sus vecinos `recargoEquivalencia`, `internalRef` y `tags`, y
   * **nunca `.default(0)`**: los tres estados sin inventar ninguno — ausente = no se toca ·
   * `null` = no hay descuento pactado · `0` = se pactó expresamente un 0 %. Con un default, todos
   * los clientes que ya existen pasarían a estar «declarados con 0 %» y nadie sabría a cuáles se
   * les llegó a preguntar.
   *
   * 🔴 EL MISMO `conDecimales` QUE EL `dto` DE LA LÍNEA, y no es simetría cosmética: este valor
   * ATERRIZA en ese campo. Si aquí cupieran más decimales, un `33,333 %` guardado en el cliente
   * daría un presupuesto que no se puede guardar, y el profesional no tendría forma de saber por
   * qué. El tope de 100 tampoco es cosmético: un 150 % dejaría el precio NEGATIVO.
   */
  dtoPorDefecto: conDecimales(z.number().min(0).max(100), DECIMALES_PORCENTAJE, 'el descuento por defecto')
    .nullable().optional(),
});

export const customerUpdateSchema = customerCreateSchema.partial();

export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;


