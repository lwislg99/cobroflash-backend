// src/core/validation/schemas.ts
import { z } from 'zod';
import { validarNifEspanol } from './nifEspanol'; // SCRUM-575 (CONT-02)
import { invalidTipoIva, invalidPrefijoSerie } from './fiscalInput'; // SCRUM-217

// ------- QUOTES -------

const QuoteLineSchema = z.object({
  concept: z.string().min(1),
  // SCRUM-655 · OPCIONALES EN EL OBJETO, OBLIGATORIAS EN EL REFINE. Una CABECERA de apartado no
  // lleva cantidad ni precio —es un renglón de título—, así que exigirlas aquí la haría imposible.
  // Pero relajarlas sin más debilitaría la puerta para las líneas normales, que es donde vive el
  // dinero: el `superRefine` de abajo las vuelve a exigir a todas las que NO son cabecera, con la
  // misma dureza de siempre (positiva y no negativa).
  qty: z.number().positive().optional(),
  price: z.number().nonnegative().optional(),
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
  costeUnitario: z.number().nonnegative().optional(),
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
  total: z.number().optional(), // calculado en backend, puede venir del cliente
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
  // A16.2: caducidad del presupuesto (default 30 días en el server; editable al crear)
  validUntil: z.coerce.date().optional(),
  // SCRUM-27: plan de cobro personalizado (N tramos). Presente = ignora paymentTerms.
  // La suma-100% / etiqueta no vacía / % > 0 se valida en la ruta (validateCustomBillingPlan) con mensaje es-ES.
  customBillingPlan: z.array(z.object({ percentage: z.number(), label: z.string() })).optional(),
  // SCRUM-195 (rebanada 3): el Trabajo al que se engancha este presupuesto. Presente = es un
  // ADICIONAL sobre un Trabajo que ya existe, y NO se crea un Trabajo nuevo al aceptarlo.
  // Ausente = presupuesto normal, que es el comportamiento de siempre.
  job_id: z.number().int().positive().optional(),
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
  amount: z.number().positive(),
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
  amount: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  ts: z.string().optional(),
});

// ------- MERCHANT PROFILE -------

export const merchantProfileUpdateSchema = z.object({
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
  // SCRUM-171b (FACT-2d): periodicidad PACTADA. Sirve para AVISAR de que toca facturar, nunca
  // para facturar sola (regla 28: un envío automático nuevo exigiría su entrada en la tabla J6).
  // Lista cerrada aquí; el default de la BD es 'NINGUNA' = sin aviso, que es lo de hoy.
  billingPeriodicity: z.enum(['NINGUNA', 'QUINCENAL', 'MENSUAL']).optional(),
  // SCRUM-294-a (A3): recargo de equivalencia del CLIENTE. `nullable().optional()` da los tres
  // estados sin inventar ninguno: ausente = no se toca · null = no consta · true/false = declarado.
  // 🔴 Nunca se coacciona a false: false es un valor LEGITIMO («declara que no»), asi que degradar
  // a false una lectura fallida seria el peor sitio para hacerlo — nadie notaria el fallo (SCRUM-271).
  recargoEquivalencia: z.boolean().nullable().optional(),
});

export const customerUpdateSchema = customerCreateSchema.partial();

export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;


