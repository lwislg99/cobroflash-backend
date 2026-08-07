// src/modules/invoicing/domain/modoVisible.ts — SCRUM-298 (A8)
//
// QUÉ MODO DE EMISIÓN SE LE ENSEÑA AL PROFESIONAL. Solo eso: este fichero **no decide nada**, lee.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO QUE CIERRA
//
// `getEmissionMode` gobierna qué documento sale —factura, factura con marca de agua o
// justificante— y hasta hoy **no aparecía ni una vez en `public/`**. Medido el 7-ago-2026: cero
// consumidores en el navegador. Lo único que llegaba era `documentoSuelto` (A0.5), que sirve para
// elegir el rótulo de un botón, no para saber en qué modo se emite.
//
// Consecuencia: dos estados que producen documentos DISTINTOS se ven exactamente igual en
// pantalla. Es el mismo defecto que llevamos toda la semana cazando —dos cosas contadas como
// una— pero aquí el que se equivoca responde ante Hacienda.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ ESTO NO ES UN INTERRUPTOR, Y NO LO SERÁ HOY
//
// El ticket pedía además un modal de dos caminos («se guarda» / «se envía»). **No se construye**,
// y el motivo está medido, no supuesto: **«se envía» NO EXISTE**. Cero clientes SOAP/mTLS contra
// la AEAT, `VfSubmission` no está en el schema, no hay cola de remisión; `applyVeriFactu` calcula
// la cadena de huellas y la URL del QR —o sea SELLA EN LOCAL— y los XSD están vendorizados pero
// nadie los manda a ningún sitio. Hoy todo es «se guarda».
//
// Una salida visible pero inerte le diría al profesional que elegir remitir es algo que él podría
// hacer. **No enseñarlo no cuesta nada; enseñarlo inerte cuesta que crea que está remitiendo a la
// AEAT cuando no lo está** — justo la clase de creencia que la regla 26 existe para no fabricar.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// REGLA 24 · ESTO NO ENCIENDE NADA
//
// Solo LEE. `INVOICING_ES_ENABLED` sigue OFF para merchants reales y este módulo no lo toca ni
// puede tocarlo: no importa nada que escriba.
import { getEmissionMode, type MerchantLike } from './emission.service';

/**
 * `null` = NO SE SABE. Y es un valor de primera clase, no un hueco.
 *
 * El suelo de este ticket: **si el lector del modo falla, no se cae a un modo por defecto**.
 * Enseñar el modo equivocado es peor que no enseñar ninguno — un profesional que lee «factura»
 * cuando emite justificantes toma decisiones fiscales sobre una pantalla que le miente, y no
 * tiene forma de sospecharlo. Sin dato, la pantalla no pinta nada.
 */
export type ModoVisible = 'fiscal' | 'demo' | 'receipt' | null;

/** Los tres que existen. Derivados del contrato de `getEmissionMode`, no escritos aparte. */
export const MODOS_VISIBLES: readonly Exclude<ModoVisible, null>[] = ['fiscal', 'demo', 'receipt'];

/**
 * El modo que se le enseña al profesional, DERIVADO de `getEmissionMode`.
 *
 * ⚠️ FUENTE ÚNICA, y es el punto entero de este fichero: quien decide qué documento sale y quien
 * dice qué modo se enseña **tienen que ser la misma función**. Con dos, la pantalla dice una cosa
 * y el documento sale de otra, y nadie se entera hasta que llega una inspección.
 *
 * Por eso aquí no hay ni un `if` sobre el país, ni sobre `INVOICING_ES_ENABLED`, ni sobre el id
 * del demo: todo eso ya lo resuelve `getEmissionMode`. Copiarlo sería reconstruir el criterio.
 */
export function modoEmisionVisible(merchant: MerchantLike | null | undefined): ModoVisible {
  if (!merchant) return null; // sin merchant no se adivina: null, nunca un modo por defecto
  const modo = getEmissionMode(merchant);
  // Cinturón: si algún día `getEmissionMode` devolviera algo fuera del contrato, esto responde
  // «no lo sé» en vez de dejar pasar un valor que la pantalla no sabe pintar. No se normaliza a
  // un modo: normalizar aquí sería inventarse el estado fiscal de alguien.
  return (MODOS_VISIBLES as readonly string[]).includes(modo) ? (modo as ModoVisible) : null;
}
