// src/modules/invoicing/domain/facturaSuelta.ts — SCRUM-289 (A0.3)
//
// LA FACTURA SUELTA: sin presupuesto, sin trabajo y sin albarán. Aquí vive lo que se puede
// decidir SIN base de datos — el gate y la validación de la entrada— para que la ruta y la
// pantalla salgan del MISMO sitio y se pueda probar sin BD ni servidor.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EL GATE NO ES `isFlagEnabled('INVOICING_ES_ENABLED')`
//
// Decisión del fundador (5-ago-2026), y tiene dos motivos. El primero es de honestidad: el botón
// se llama «Nueva factura», así que solo debe existir CUANDO LO QUE SE VA A CREAR ES UNA FACTURA.
// Gatear por el flag y luego explicar en un aviso que a veces sale un justificante es resolver
// con copy una contradicción que se puede quitar.
//
// El segundo es el que decide, y es un bug que así no llega a existir: **`INVOICING_ES_ENABLED`
// es ES-only**. Un merchant no-ES emite factura fiscal SIEMPRE (`getEmissionMode` devuelve
// 'fiscal' antes de mirar ningún flag), pero `isFlagEnabled` le devolvería `false` — se quedaría
// sin botón teniendo derecho a él. Serían dos casos que el código ya trata igual, separados por
// un gate escrito a mano.
//
// Por eso el gate es el MODO DE EMISIÓN (V0-0), que es el mecanismo que YA decide qué documento
// sale, y cubre los tres casos sin excepciones:
//   · 'fiscal'  → factura real (no-ES siempre; ES con el flag ON tras SIF-1)  → SÍ
//   · 'demo'    → factura completa con marca de agua (merchant demo, regla 8) → SÍ
//   · 'receipt' → justificante de cobro (ES real con el flag OFF)             → NO
//
// CONSECUENCIA ASUMIDA Y DICHA: hoy ningún merchant ES real ve esto. Es lo que impone la regla 24
// y es lo esperado, no un fallo de alcance. No se compensa enseñándolo.
//
// SCRUM-346 (el justificante suelto del merchant ES real) está enlazado como bloqueado por éste y
// REUTILIZARÁ ESTA MISMA RUTA. Por eso el tipo y el rótulo salen del MODO y no del camino: cuando
// 346 entre, lo que cambia es el rótulo y el `type`, no el entrypoint.
import { getEmissionMode, type MerchantLike } from './emission.service';

/** Error nombrado del gate. Un 500 no prueba nada: quien lo reciba tiene que poder ramificar. */
export const ERROR_MODO_SIN_FACTURA = 'factura_suelta_no_disponible';
/** Errores nombrados de la entrada. */
export const ERROR_CLIENTE_INVALIDO = 'cliente_invalido';
export const ERROR_LINEAS_INVALIDAS = 'lineas_invalidas';

/**
 * EL GATE, y es UNO SOLO para los dos consumidores: esta misma función la llama la ruta
 * (`POST /admin/invoices`) y su resultado viaja al front en `GET /admin/me`. El navegador no
 * reimplementa la regla: recibe el veredicto ya calculado. Que el back acepte lo que el front
 * esconde es exactamente lo que pasa cuando cada lado tiene su propia copia del criterio.
 */
export function puedeCrearFacturaSuelta(merchant: MerchantLike | null | undefined): boolean {
  if (!merchant) return false; // sin merchant no se adivina: falla cerrado
  return getEmissionMode(merchant) !== 'receipt';
}

export interface LineaEntrada {
  concept: string;
  qty: number;
  price: number;
  /** Tipo de IVA en FRACCIÓN (0.21), como el resto de `Invoice.lines` del árbol. */
  tax: number;
}

export type ResultadoValidacion =
  | { ok: true; customerId: number; lineas: LineaEntrada[] }
  | { ok: false; error: string; message: string };

const esNumeroFinito = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Valida el cuerpo de una factura suelta. PURA: ni BD ni red, para poder probarla sin fixtures.
 *
 * NO comprueba que el cliente sea de este merchant — eso exige la base y vive en la ruta
 * (regla 2). Aquí solo se mira que la entrada tenga la forma correcta.
 */
export function validarFacturaSuelta(body: unknown): ResultadoValidacion {
  const b = (body ?? {}) as Record<string, unknown>;

  const customerId = Number(b.customerId);
  if (!Number.isInteger(customerId) || customerId <= 0) {
    return { ok: false, error: ERROR_CLIENTE_INVALIDO, message: 'Falta el cliente de la factura.' };
  }

  const crudas = Array.isArray(b.lines) ? b.lines : null;
  if (!crudas || crudas.length === 0) {
    return { ok: false, error: ERROR_LINEAS_INVALIDAS, message: 'La factura necesita al menos una línea.' };
  }

  const lineas: LineaEntrada[] = [];
  for (const c of crudas) {
    const l = (c ?? {}) as Record<string, unknown>;
    const concept = typeof l.concept === 'string' ? l.concept.trim() : '';
    const qty = Number(l.qty);
    const price = Number(l.price);
    const tax = Number(l.tax);
    if (!concept) {
      return { ok: false, error: ERROR_LINEAS_INVALIDAS, message: 'Cada línea necesita un concepto.' };
    }
    if (!esNumeroFinito(qty) || qty <= 0) {
      return { ok: false, error: ERROR_LINEAS_INVALIDAS, message: 'Cada línea necesita una cantidad mayor que cero.' };
    }
    if (!esNumeroFinito(price) || price < 0) {
      return { ok: false, error: ERROR_LINEAS_INVALIDAS, message: 'Cada línea necesita un precio válido.' };
    }
    // Fracción, no porcentaje: 0.21, nunca 21. Es la convención de `Invoice.lines` en todo el
    // árbol, y confundirlas multiplicaría el IVA por cien sin que nada fallara.
    if (!esNumeroFinito(tax) || tax < 0 || tax > 1) {
      return { ok: false, error: ERROR_LINEAS_INVALIDAS, message: 'El IVA de cada línea va en fracción (0.21 para el 21 %).' };
    }
    lineas.push({ concept, qty, price, tax });
  }

  return { ok: true, customerId, lineas };
}
