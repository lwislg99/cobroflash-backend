// src/modules/invoicing/domain/emisorCongelado.ts — SCRUM-665 (A)
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LOS SIETE CAMPOS DEL EMISOR, CONGELADOS AL EMITIR
//
// `src/lib/invoicing.ts:108-114` lee SIETE campos del perfil del merchant **en vivo** cada vez que
// se pinta el PDF de una factura. Medido el 15-sep-2026 (SCRUM-665): si el profesional corrige su
// dirección fiscal, su denominación legal, su NIF, su logo, su teléfono o su email, **todas sus
// facturas anteriores se reimprimen con los datos nuevos**. Nadie ha hecho nada mal y el papel ya
// no dice lo que decía el día que se emitió.
//
// Y el instante en que eso pasa **lo elige el cliente final**: `GET /recibo/:token/pdf` es público
// por token opaco, sin login. Choca de frente con la regla 29 —lo emitido no cambia—, que es de
// las que no se relajan.
//
// 🔴 ESTE MÓDULO NO ES NUEVO EN SU FORMA: es el MISMO patrón que `clienteCongelado.ts` (SCRUM-729)
// para la otra mitad del documento, y que `datosDeAlbaranEmitido` para el albarán. Tres piezas:
// columnas + escritor al emitir + lector que prefiere la columna. Se imita a propósito: un cuarto
// patrón para el mismo hecho es cómo nacen dos criterios que un día discrepan.
//
// ── ⚠️ LO QUE ESTE MÓDULO **NO** ARREGLA, dicho para que no se lea de más ────────────────────
//
//   · **El eje del CÓDIGO.** Esto hace que el papel se regenere con los MISMOS DATOS; no con la
//     misma plantilla. `generateInvoicePdf` no recibe ninguna versión de formato, así que cambiar
//     el generador seguirá cambiando papeles ya emitidos. Declarado en SCRUM-665 §2, sin medir.
//   · **El pasado.** Las facturas ya emitidas no tienen estas columnas y **no se pueden rellenar**:
//     no existe ninguna acción de `AuditLog` que registre una edición del perfil del merchant, así
//     que no hay de dónde sacar qué decía la dirección aquel día. Esto promete de su fecha de
//     entrada en adelante, y nada más.
//   · **La marca de agua.** `watermark` se deriva de `isDemoMerchant(...)` en vivo. Con el email
//     congelado *se puede* derivar del dato congelado, pero eso es una decisión aparte y aquí no
//     se toma. Se nombra para que no se dé por resuelta.
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * Los SIETE del emisor. Lista cerrada y ÚNICA: el escritor, el lector y el test cuentan sobre
 * ella, así que un campo nuevo entra aquí y los tres se enteran a la vez.
 */
export const CAMPOS_CONGELADOS_EMISOR = Object.freeze([
  'merchantName',
  'merchantLegalName',
  'merchantTaxId',
  'merchantAddress',
  'merchantLogoUrl',
  'merchantPhone',
  'merchantEmail',
] as const);

/** La ficha VIVA: el perfil del merchant tal y como está hoy en su tabla. */
export interface FichaDeEmisor {
  name: string | null;
  legalName?: string | null;
  taxId?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  /** En `Merchant` se llama `whatsappPhone`; aquí se nombra por lo que ES en el documento. */
  phone?: string | null;
  email?: string | null;
}

/** Lo que el ESCRITOR mete en la fila al emitir. Las siete claves, siempre las siete. */
export interface EmisorCongelado {
  merchantName: string | null;
  merchantLegalName: string | null;
  merchantTaxId: string | null;
  merchantAddress: string | null;
  merchantLogoUrl: string | null;
  merchantPhone: string | null;
  merchantEmail: string | null;
}

/** La fila del documento, con sus siete columnas. Tipo PROPIO, no el de Prisma. */
export interface DocumentoConEmisorCongelado {
  merchantName?: string | null;
  merchantLegalName?: string | null;
  merchantTaxId?: string | null;
  merchantAddress?: string | null;
  merchantLogoUrl?: string | null;
  merchantPhone?: string | null;
  merchantEmail?: string | null;
}

/** Lo que el lector devuelve: la forma que ya espera `generateInvoicePdf`, más de dónde salió. */
export interface EmisorDelDocumento {
  name: string | null;
  legalName: string | null;
  taxId: string | null;
  address: string | null;
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
  /** `true` = salió de la fila. `false` = de la ficha viva, porque el documento es anterior. */
  congelado: boolean;
}

/**
 * EL ESCRITOR · la copia que se guarda **en el momento de emitir**, no después.
 *
 * 🔴 `merchantName` se copia TAL CUAL y sin respaldo. En `Merchant` es `NOT NULL`, así que si
 * llegara vacío el documento diría la verdad —no había nombre— en vez de inventarse uno. Poner
 * aquí un `?? 'Sin nombre'` convertiría el centinela del lector en basura: una factura vieja y una
 * con el nombre perdido dejarían de distinguirse.
 */
export function congelarEmisor(ficha: FichaDeEmisor): EmisorCongelado {
  return {
    merchantName: ficha.name ?? null,
    merchantLegalName: ficha.legalName ?? null,
    merchantTaxId: ficha.taxId ?? null,
    merchantAddress: ficha.address ?? null,
    merchantLogoUrl: ficha.logoUrl ?? null,
    merchantPhone: ficha.phone ?? null,
    merchantEmail: ficha.email ?? null,
  };
}

/**
 * EL LECTOR · el único sitio que decide si el papel usa la copia o la ficha de hoy.
 *
 * 🔴 SE MIRA `merchantName`, NO «los siete a la vez», y es la lección literal de
 * `clienteCongelado.ts:215-227`: es el único de los siete cuyo origen es `NOT NULL`, así que el
 * escritor no puede dejarlo vacío. Preguntar por `merchantTaxId` daría un falso «no congelado» en
 * toda factura de un merchant que aún no ha puesto su NIF — y ése es un caso normal, no un error.
 *
 * `null` ahí significa **una sola cosa**: este documento se emitió antes de que existiera el
 * escritor. Ése es el CENTINELA, y por eso la columna nace NULLABLE aunque su origen no lo sea.
 *
 * @param doc   la fila del documento, con sus siete columnas.
 * @param viva  el perfil de hoy. Se usa SÓLO si el documento es anterior al escritor.
 */
export function emisorDelDocumento(
  doc: DocumentoConEmisorCongelado,
  viva: FichaDeEmisor | null | undefined,
): EmisorDelDocumento {
  if (doc.merchantName != null) {
    return {
      name: doc.merchantName,
      legalName: doc.merchantLegalName ?? null,
      taxId: doc.merchantTaxId ?? null,
      address: doc.merchantAddress ?? null,
      logoUrl: doc.merchantLogoUrl ?? null,
      phone: doc.merchantPhone ?? null,
      email: doc.merchantEmail ?? null,
      congelado: true,
    };
  }
  // Sin copia y sin ficha no se puede pintar un emisor. Se falla en vez de pintar un documento
  // fiscal con el emisor en blanco, que es lo que nadie quiere descubrir en el papel del cliente.
  if (!viva) throw new Error('documento_sin_emisor_congelado_ni_ficha_viva');
  return {
    name: viva.name,
    legalName: viva.legalName ?? null,
    taxId: viva.taxId ?? null,
    address: viva.address ?? null,
    logoUrl: viva.logoUrl ?? null,
    phone: viva.phone ?? null,
    email: viva.email ?? null,
    congelado: false,
  };
}
