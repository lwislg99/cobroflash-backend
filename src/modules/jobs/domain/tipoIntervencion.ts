// src/modules/jobs/domain/tipoIntervencion.ts — SCRUM-651 (T2)
//
// EL TIPO DE INTERVENCIÓN. UNA SOLA FUENTE, Y ÉSTA.
//
// Vocabulario CERRADO, aprobado por el fundador el 2-sep-2026 (regla 27). Lo que no está en esta
// lista no existe: ampliarlo es un cambio de máster, no una línea de código.
//
// ── 🔴 POR QUÉ VIVE EN SU PROPIO FICHERO Y NO DENTRO DEL TRABAJO ──────────────────────────
// **El parte de trabajo (SCRUM-652) usa EXACTAMENTE este vocabulario.** Si cada uno declara su
// lista, las dos se separan el día que alguien añada un valor en un sitio — y entonces un parte
// puede decir «MANTENIMIENTO» sobre un Trabajo que no admite esa palabra, o al revés. Ya nos pasó
// con un rótulo que vivía en dos ranuras.
//
// Así que esto se IMPORTA, no se copia. Un `as const` + el tipo derivado hace que TypeScript
// rechace en compilación cualquier valor de fuera, y `esTipoIntervencion` hace lo mismo en
// ejecución para lo que llega de la red, que es donde el compilador no alcanza.
//
// ⚠️ EL ORDEN ES EL DEL PAPEL DEL FUNDADOR y no se reordena por gusto: es el que verá el
// profesional en el desplegable, y el primero es el caso más frecuente del primer cliente real
// —una avería—, que es la razón de ser de este ticket.

/** Los tres, y sólo los tres. Cambiar esta lista es cambio de máster (regla 27). */
export const TIPOS_INTERVENCION = [
  'REPARACION_ASISTENCIA',
  'MANTENIMIENTO',
  'INSTALACION',
] as const;

export type TipoIntervencion = (typeof TIPOS_INTERVENCION)[number];

/**
 * ¿Es uno de los tres? Para lo que llega de fuera (formulario, API), donde el tipo no protege.
 *
 * 🔴 NO HAY CAÍDA A UN VALOR POR DEFECTO, y es deliberado: si llega algo que no está en la lista,
 * la respuesta es «no» y quien llama decide. Elegir por él —caer a REPARACION_ASISTENCIA porque
 * es el caso frecuente— sería inventarse qué clase de trabajo hizo alguien, y eso acaba impreso
 * en un parte que firma el cliente.
 */
/**
 * Lo que se le enseña al profesional, DERIVADO de la lista de arriba y en su mismo orden.
 *
 * 🔴 VIVE AQUÍ Y NO EN EL NAVEGADOR, y lo destapó un guard: al escribir el desplegable con los
 * tres valores dentro de `jobNuevoModal.js`, el guard de fuente única cayó — con razón, porque
 * eso era una SEGUNDA lista del vocabulario. El navegador no decide qué tipos existen; los
 * recibe. Mismo criterio que `cobrosCubos` y `albaranRotulos` (SCRUM-474, SCRUM-441).
 *
 * ⚠️ Los rótulos son MICROCOPY SIN APROBAR (regla 30): salen con marcador y se sustituyen el
 * día que el fundador los firme. Los VALORES no son microcopy: son el vocabulario cerrado.
 */
const MARCADOR_ROTULO = '[PENDIENTE microcopy oficial]';

export function tiposIntervencionParaUI(): Array<{ valor: TipoIntervencion; rotulo: string }> {
  const rotulos: Record<TipoIntervencion, string> = {
    REPARACION_ASISTENCIA: 'Reparación / asistencia',
    MANTENIMIENTO: 'Mantenimiento',
    INSTALACION: 'Instalación',
  };
  return TIPOS_INTERVENCION.map((valor) => ({ valor, rotulo: `${MARCADOR_ROTULO} ${rotulos[valor]}` }));
}

export function esTipoIntervencion(bruto: unknown): bruto is TipoIntervencion {
  return typeof bruto === 'string' && (TIPOS_INTERVENCION as readonly string[]).includes(bruto);
}
