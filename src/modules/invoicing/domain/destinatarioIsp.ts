// SCRUM-1051g · Portón del DESTINATARIO de una factura con inversión del sujeto pasivo (S2).
//
// GO del fundador por la regla 40 del máster (SCRUM-1051 c.21750, punto 3): una factura con alguna línea
// `causa: 'S2'` se rechaza ANTES de emitir en dos casos:
//   ① el cliente no tiene NIF válido. El ROF (RD 1619/2012, art. 6.1.d) exige el NIF del
//      destinatario cuando él es el sujeto pasivo, y sin él el registro VERI*FACTU tampoco sale
//      (`DestinatarioSinDictamenError`): se emitiría y se quedaría fuera (SCRUM-1051f, c.21748).
//   ② el cliente no está declarado como empresario (`Customer.tipoDestinatario = 'EMPRESARIO'`).
//      NULL («no declarado») no es empresario.
//
// Textos, los dos firmados: ① P4 (c.21750) y ② P5 (c.21761, SCRUM-1051h; hasta entonces ② iba
// con su código y SIN `message`).
//
// Se llama **antes** de `allocateInvoiceNumber`, como los otros portones (SCRUM-246/771/1051d):
// rechazar después obligaría a deshacer una factura ya numerada.
//
// Sin causa S2 en ninguna línea, este portón no mira nada: lo de siempre no cambia.

import { validarNifEspanol } from '../../../core/validation/nifEspanol';

const ERROR_ISP_CLIENTE_SIN_NIF = 'isp_cliente_sin_nif';
const ERROR_ISP_CLIENTE_NO_EMPRESARIO = 'isp_cliente_no_empresario';

/** P1 · leyenda del PDF, firmada por el fundador (SCRUM-1051 c.21750, punto 1): literal del ROF art. 6.1.m. */
export const COPY_ISP_LEYENDA = 'Inversión del sujeto pasivo';

/** P3 · columna del libro registro y su valor, firmados (c.21750, punto 5). Los lee `librosAeat.ts` (SCRUM-1051h). */
export const COPY_ISP_COLUMNA = 'ISP';
export const COPY_ISP_VALOR_SI = 'Sí';

/** P4 · firmado por el fundador (SCRUM-1051 c.21750, punto 3). Literal; no se parafrasea. */
const COPY_ISP_SIN_NIF = 'Para facturar con inversión del sujeto pasivo, el cliente necesita NIF.';
/** P5 · firmado por Javier (SCRUM-1051 c.21761): el cliente tiene NIF pero no es EMPRESARIO. Literal. */
const COPY_ISP_NO_EMPRESARIO = 'Para facturar con inversión del sujeto pasivo, el cliente tiene que ser empresario o profesional.';

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
  /** El texto firmado (P4 o P5). Un caso nuevo sin firma iría sin él (regla 39). */
  message?: string;
}

class DestinatarioIspError extends Error {
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
function tieneLineasIsp(lines: readonly LineaConCausaIsp[] | null | undefined): boolean {
  return Array.isArray(lines) && lines.some((l) => l?.causa === 'S2');
}

/** El rechazo, o `null` si no hay líneas S2 o el cliente las admite. PURO. */
function destinatarioIspNoValido(
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
    return { code: ERROR_ISP_CLIENTE_NO_EMPRESARIO, message: COPY_ISP_NO_EMPRESARIO };
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
