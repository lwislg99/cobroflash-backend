// SCRUM-1051g · Portón del DESTINATARIO de una factura con inversión del sujeto pasivo (S2).
//
// GO de regla 40 del fundador (SCRUM-1051 c.21750, punto 3): una factura con alguna línea
// `causa: 'S2'` se rechaza ANTES de emitir en dos casos:
//   ① el cliente no tiene NIF válido. El ROF (RD 1619/2012, art. 6.1.d) exige el NIF del
//      destinatario cuando él es el sujeto pasivo, y sin él el registro VERI*FACTU tampoco sale
//      (`DestinatarioSinDictamenError`): se emitiría y se quedaría fuera (SCRUM-1051f, c.21748).
//   ② el cliente no está declarado como empresario (`Customer.tipoDestinatario = 'EMPRESARIO'`).
//      NULL («no declarado») no es empresario.
//
// Textos: sólo ① tiene texto firmado (P4, c.21750). El de ② NO está firmado: se rechaza con su
// código y SIN `message`, hasta que el fundador firme uno (regla 39). No se inventa aquí.
//
// Se llama **antes** de `allocateInvoiceNumber`, como los otros portones (SCRUM-246/771/1051d):
// rechazar después obligaría a deshacer una factura ya numerada.
//
// Sin causa S2 en ninguna línea, este portón no mira nada: lo de siempre no cambia.

import { validarNifEspanol } from '../../../core/validation/nifEspanol';

export const ERROR_ISP_CLIENTE_SIN_NIF = 'isp_cliente_sin_nif';
export const ERROR_ISP_CLIENTE_NO_EMPRESARIO = 'isp_cliente_no_empresario';

/** P4 · firmado por el fundador (SCRUM-1051 c.21750, punto 3). Literal; no se parafrasea. */
export const COPY_ISP_SIN_NIF = 'Para facturar con inversión del sujeto pasivo, el cliente necesita NIF.';

/** Lo único que este portón mira de una línea. */
export interface LineaConCausaIsp {
  causa?: unknown;
}

/** Lo único que este portón mira del cliente: los dos campos de su ficha. */
export interface ClienteParaIsp {
  taxId?: string | null;
  tipoDestinatario?: string | null;
}

export interface RechazoIsp {
  code: typeof ERROR_ISP_CLIENTE_SIN_NIF | typeof ERROR_ISP_CLIENTE_NO_EMPRESARIO;
  /** Sólo cuando hay texto firmado. Sin firma, `undefined` (regla 39). */
  message?: string;
}

export class DestinatarioIspError extends Error {
  readonly code: RechazoIsp['code'];
  readonly mensaje: string | undefined;
  constructor(r: RechazoIsp) {
    super(r.code);
    this.name = 'DestinatarioIspError';
    this.code = r.code;
    this.mensaje = r.message;
  }
}

/** ¿Alguna línea lleva la causa S2? */
export function tieneLineasIsp(lines: readonly LineaConCausaIsp[] | null | undefined): boolean {
  return Array.isArray(lines) && lines.some((l) => l?.causa === 'S2');
}

/** El rechazo, o `null` si no hay líneas S2 o el cliente las admite. PURO. */
export function destinatarioIspNoValido(
  lines: readonly LineaConCausaIsp[] | null | undefined,
  cliente: ClienteParaIsp | null | undefined,
): RechazoIsp | null {
  if (!tieneLineasIsp(lines)) return null;
  const nif = validarNifEspanol(cliente?.taxId ?? null);
  // `validarNifEspanol` da `valido: true` también con el campo VACÍO (es opcional en la ficha):
  // aquí hace falta uno presente y bien formado, así que se exige `motivo === 'ok'`.
  if (!(nif.valido && nif.motivo === 'ok')) {
    return { code: ERROR_ISP_CLIENTE_SIN_NIF, message: COPY_ISP_SIN_NIF };
  }
  if (cliente?.tipoDestinatario !== 'EMPRESARIO') {
    return { code: ERROR_ISP_CLIENTE_NO_EMPRESARIO };
  }
  return null;
}

/** Portón. Se llama **antes** de `allocateInvoiceNumber`, nunca después. */
export function exigirDestinatarioParaIsp(
  lines: readonly LineaConCausaIsp[] | null | undefined,
  cliente: ClienteParaIsp | null | undefined,
): void {
  const r = destinatarioIspNoValido(lines, cliente);
  if (r) throw new DestinatarioIspError(r);
}

export function esErrorDestinatarioIsp(err: unknown): err is DestinatarioIspError {
  return err instanceof DestinatarioIspError;
}
