// src/core/validation/causaLineaEmitible.ts — SCRUM-1051 (GO de Javier, 23-sep-2026)
//
// Mismo patrón que `tiposIvaEmitibles.ts` (SCRUM-771): el PORTÓN vive en `core/validation/`,
// nunca dentro de `invoicing/` ni `fiscal/` (regla 38 — meterlo ahí sería MODIFICAR el camino de
// emisión). Se llama **antes** de `allocateInvoiceNumber`, igual que su vecino.
//
// LISTA CERRADA, Y SÓLO 'S2' ACTIVA. El GO autoriza el mecanismo de `causa` por línea porque lo
// admite estructuralmente para `E1`/`N1` (SCRUM-1050), pero **hoy ninguna boca las activa**:
// activar cualquier valor que no sea `'S2'` es reabrir la decisión que Javier tomó en SCRUM-1050
// (no construir, por falta de caso de uso citado). Este portón es lo que lo hace cumplir.
import { type Causa } from '../../modules/invoicing/domain/vat.service';

/** Código del rechazo. Estable, para que un llamador pueda ramificar por él. */
export const ERROR_CAUSA_LINEA_NO_EMITIBLE = 'causa_linea_no_emitible';

/** Lo único que este portón mira de una línea. Deliberadamente mínimo. */
export interface LineaConCausa {
  causa?: unknown;
}

export class CausaLineaNoEmitibleError extends Error {
  readonly code = ERROR_CAUSA_LINEA_NO_EMITIBLE;
  readonly detalle: string;
  constructor(detalle: string) {
    super(`${ERROR_CAUSA_LINEA_NO_EMITIBLE}: ${detalle}`);
    this.name = 'CausaLineaNoEmitibleError';
    this.detalle = detalle;
  }
}

/** Los ÚNICOS valores de `causa` que una línea puede llevar hoy. No se amplía sin GO nuevo. */
const CAUSAS_ACTIVAS: readonly Causa[] = ['S2'];

/** El motivo del rechazo, o `null` si todas las líneas llevan una causa válida (o ninguna). PURO. */
export function causaLineaNoEmitible(lines: readonly LineaConCausa[] | null | undefined): string | null {
  if (!Array.isArray(lines)) return null;
  for (let i = 0; i < lines.length; i++) {
    const causa = lines[i]?.causa;
    if (causa === undefined || causa === null) continue; // sin causa: no es asunto de este portón
    if (!CAUSAS_ACTIVAS.includes(causa as Causa)) {
      return `línea ${i + 1}: la causa "${String(causa)}" no está activa (sólo 'S2' — inversión ` +
        'del sujeto pasivo — lo está hoy; el resto de la lista cerrada existe en el tipo pero ' +
        'ningún GO la ha habilitado, SCRUM-1050/1051)';
    }
  }
  return null;
}

/** Portón. Se llama **antes** de `allocateInvoiceNumber`, nunca después. */
export function exigirCausaLineaEmitible(lines: readonly LineaConCausa[] | null | undefined): void {
  const motivo = causaLineaNoEmitible(lines);
  if (motivo) throw new CausaLineaNoEmitibleError(motivo);
}

/** ¿Este error es el del portón de causa? Para que un llamador ramifique por CÓDIGO, no por texto. */
export function esErrorCausaLineaNoEmitible(e: unknown): boolean {
  return (e as any)?.code === ERROR_CAUSA_LINEA_NO_EMITIBLE;
}
