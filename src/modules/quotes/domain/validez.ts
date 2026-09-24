// src/modules/quotes/domain/validez.ts — SCRUM-987
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA VALIDEZ DE UN PRESUPUESTO, DICHA EN UN SOLO SITIO: LA FECHA Y EL RÓTULO.
//
// ── EL DEFECTO QUE ESTO CIERRA, MEDIDO ─────────────────────────────────────────────────────
//
// «Válido hasta el …» sólo se le enseñaba al cliente en la LANDING donde decide. El papel —el PDF
// que el profesional manda por correo o WhatsApp y que el cliente guarda— no decía hasta cuándo
// vale el precio. Medido el 21-sep-2026 generando el documento real con `validUntil` en los
// parámetros: 296 caracteres, el total, y ni rastro de la validez.
//
// ── POR QUÉ NO SE ESCRIBE OTRA VEZ EN EL PDF ───────────────────────────────────────────────
//
// La landing ya tenía la cuenta hecha —incluido el respaldo `creación + 30 d` de los presupuestos
// anteriores a A16.2, que no traen `validUntil`— y la fecha sale en la zona del NEGOCIO
// (SCRUM-633). Copiarla al PDF habría sido el segundo sitio que formula la misma frase, y dos
// sitios que formulan la misma frase acaban diciendo dos fechas: el cliente lee «15 de octubre» en
// el móvil y «14 de octubre» en el papel. Landing y PDF llaman aquí.
//
// ── EL TEXTO, FIRMADO ──────────────────────────────────────────────────────────────────────
//
// «Válido hasta el {fecha larga}», sin emoji, tal como lo lee el cliente en la landing (que le
// pone su ⏳ delante, en la página, no aquí). Ficha: `docs/microcopy/2026-09-21-SCRUM-987-valido-
// hasta-en-el-pdf.md`. Las fuentes estándar de PDFKit no dibujan el emoji: por eso el rótulo NO lo
// lleva y por eso es de la página, no del texto compartido.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import { zonaDelMerchant } from '../../../core/zonaDelMerchant';

// NO SE EXPORTA: lo dice `textoDeValidez` y nadie más. Exportarlo lo dejaría como huérfano (un
// export sin llamador fuera de los tests, que es justo lo que caza el censo de SCRUM-411), y un test
// que importara la constante para compararla consigo misma no pinaría nada: el literal firmado lo
// escribe el test A MANO.
/** El rótulo firmado. Lo que sigue es la fecha larga: «Válido hasta el 15 de octubre de 2026». */
const ROTULO_VALIDEZ = 'Válido hasta el';

/** Los presupuestos anteriores a A16.2 no traen `validUntil`: se les cuenta esta validez desde su
 *  creación. Es el respaldo que ya tenía la landing; aquí para que nadie lo formule dos veces. */
const DIAS_DE_RESPALDO = 30;

/** Lo mínimo que hace falta para decir la validez. Laxo a propósito: `quote` llega de Prisma. */
export type FuentesDeValidez = {
  validUntil?: Date | string | null;
  createdAt?: Date | string | null;
  merchant?: { timezone?: string | null } | null;
};

/** El INSTANTE hasta el que vale: `validUntil`, o `creación + 30 d` si la fila no lo trae, o `null`
 *  si no hay ni una cosa ni la otra (o el dato no es una fecha: mejor callar que imprimir «Invalid
 *  Date» en un documento del cliente). */
function instanteDeValidez(f: FuentesDeValidez): Date | null {
  const cruda = f.validUntil
    ? new Date(f.validUntil)
    : (f.createdAt ? new Date(new Date(f.createdAt).getTime() + DIAS_DE_RESPALDO * 86_400_000) : null);
  return cruda && !Number.isNaN(cruda.getTime()) ? cruda : null;
}

/**
 * La fecha larga, en la zona del NEGOCIO.
 *
 * 🔴 SCRUM-633 · `timeZone` EXPLÍCITO. Sin él, `toLocaleDateString` usa la zona del PROCESO, y
 * nadie la fija en el despliegue: la fecha que lee el cliente saldría de con qué zona arrancara el
 * contenedor. Es de quien es la validez —el negocio—, no del dispositivo que la mira ni de la
 * máquina que la sirve.
 */
function fechaLargaDeValidez(f: FuentesDeValidez): string | null {
  const instante = instanteDeValidez(f);
  if (!instante) return null;
  return instante.toLocaleDateString('es-ES', {
    timeZone: zonaDelMerchant(f.merchant),
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

/** La frase completa: «Válido hasta el 15 de octubre de 2026», o `null` si no hay fecha que decir. */
export function textoDeValidez(f: FuentesDeValidez): string | null {
  const fecha = fechaLargaDeValidez(f);
  return fecha === null ? null : `${ROTULO_VALIDEZ} ${fecha}`;
}
