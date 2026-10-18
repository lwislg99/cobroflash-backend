// src/modules/jobs/domain/entregaParaFirmar.ts — SCRUM-49b
//
// ¿LLEGÓ EL WHATSAPP «PARA FIRMAR» DEL ALBARÁN? El estado REAL de la última entrega.
//
// La ficha del albarán decía «enviado para firmar» con `enviadoParaFirmaAt`, y ese campo se escribe
// ANTES de llamar a Meta (`albaranWhatsApp.service.ts`): el token tiene que existir antes del envío,
// así que escribirlo ahí es correcto. Lo que NO es correcto es leerlo como prueba de ENTREGA. Salía
// igual si el envío reventaba en el acto (sin credenciales, cliente de baja, topes de J6) o si Meta
// lo aceptaba y luego avisaba de que no llegó (131026, por el webhook de estados). El 18-oct-2026
// el fundador pulsó dos veces, las dos filas quedaron `failed` y la pantalla le decía «enviado».
//
// El dato ya existía: cada intento deja su fila en `whatsapp_messages` (WA-0b, SCRUM-115/126), con
// el documento (`relatedType: 'albaran'`, `relatedId`) y la PLANTILLA. Aquí sólo se LEE.
//
// ── POR QUÉ SE FILTRA POR LA PLANTILLA ─────────────────────────────────────────────────────────
// `relatedType: 'albaran'` lo comparten DOS envíos: éste y la copia FIRMADA (SCRUM-47,
// `albaran_firmado_es`). El de firmar etiqueta TODAS sus filas con `albaran_para_firmar_es`, salga
// por ventana o por plantilla, y también las de fallo: es el `template.templateName` que se le pasa
// a `sendWhatsAppWindowFirst`. Filtrar por tiempo (`createdAt >= enviadoParaFirmaAt`) mezclaría el
// reloj de la aplicación con el de la base.
//
// ── 🔴 «NO PUDE LEER» NO ES «NO HAY NADA» ─────────────────────────────────────────────────────
// `getDeliveryStatus` (WA-0b) devuelve `null` tanto si no hay fila como si la lectura falla. Para
// un chip que sólo AÑADE información vale; para decidir si se puede AFIRMAR «enviado», no. Aquí la
// lectura fallida tiene su propio estado, y quien pinta decide qué hacer con él.
import { prisma } from '../../../core/db/prisma';
import { WA_TEMPLATES } from '../../../integrations/whatsappTemplates';

/** Los estados posibles. Lo que la pantalla puede afirmar sale de aquí, no de `enviadoParaFirmaAt`. */
export type EstadoEntregaParaFirmar =
  | 'nunca_enviado'    // `enviadoParaFirmaAt` vacío: nadie lo ha intentado
  | 'entregado'        // Meta confirmó la entrega (delivered/read)
  | 'aceptado'         // Meta lo aceptó (`sent`) y aún no ha confirmado la entrega
  | 'fallido'          // la última fila es `failed` (ver `fallo`)
  | 'sin_rastro'       // se marcó como enviado y no hay fila que diga qué pasó
  | 'no_se_pudo_leer'; // la lectura falló: no se sabe

export type EntregaParaFirmar = {
  estado: EstadoEntregaParaFirmar;
  /**
   * Sólo con `fallido`. `en_el_acto`: no llegó a salir (sin identificador de Meta: credenciales,
   * baja, topes, plantilla inválida). `despues`: Meta lo aceptó y avisó del fallo por el webhook.
   */
  fallo: 'en_el_acto' | 'despues' | null;
  /** Cuándo cambió por última vez esa fila (el último aviso de Meta), o null. */
  at: Date | null;
};

type UltimaFila = { status: string; waMessageId: string | null; updatedAt: Date } | null;

/** La decisión, pura: con o sin marca de envío, y la última fila de ESTE envío. Sin `export` a
 *  propósito (SCRUM-411): el test la ejercita por la ruta, que es lo que ve la pantalla. */
function estadoDeEntregaParaFirmar(enviadoParaFirmaAt: Date | null, ultima: UltimaFila): EntregaParaFirmar {
  if (!enviadoParaFirmaAt) return { estado: 'nunca_enviado', fallo: null, at: null };
  if (!ultima) return { estado: 'sin_rastro', fallo: null, at: null };
  const at = ultima.updatedAt;
  if (ultima.status === 'delivered' || ultima.status === 'read') return { estado: 'entregado', fallo: null, at };
  if (ultima.status === 'sent') return { estado: 'aceptado', fallo: null, at };
  if (ultima.status === 'failed') {
    return { estado: 'fallido', fallo: ultima.waMessageId ? 'despues' : 'en_el_acto', at };
  }
  // `queued` (no se sabe si salió) u otro valor que no está en el ciclo: no se afirma nada.
  return { estado: 'sin_rastro', fallo: null, at };
}

/** Lee la última fila del envío «para firmar» de un albarán y decide su estado. Nunca lanza. */
export async function leerEntregaParaFirmar(
  merchantId: number,
  albaranId: number,
  enviadoParaFirmaAt: Date | null,
): Promise<EntregaParaFirmar> {
  // Sin marca no hay nada que leer: no se gasta una consulta.
  if (!enviadoParaFirmaAt) return estadoDeEntregaParaFirmar(null, null);
  try {
    const ultima = await prisma.whatsAppMessage.findFirst({
      where: { merchantId, relatedType: 'albaran', relatedId: albaranId, templateName: WA_TEMPLATES.albaranParaFirmar },
      // El mismo orden que `getDeliveryStatus` (SCRUM-986): `id` desempata dos del mismo milisegundo.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { status: true, waMessageId: true, updatedAt: true },
    });
    return estadoDeEntregaParaFirmar(enviadoParaFirmaAt, ultima);
  } catch (err: any) {
    console.error('[SCRUM-49b] leerEntregaParaFirmar:', err?.message || err);
    return { estado: 'no_se_pudo_leer', fallo: null, at: null };
  }
}
