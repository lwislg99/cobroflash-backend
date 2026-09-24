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
//   · 'receipt' → NINGÚN documento (ES real con el flag OFF)                  → NO
//
// CONSECUENCIA ASUMIDA Y DICHA: hoy ningún merchant ES real ve esto. Es lo que impone la regla 24
// y es lo esperado, no un fallo de alcance. No se compensa enseñándolo.
//
// SCRUM-346 (A0.5) fue el paso intermedio: se reutilizó esta misma ruta y lo único que cambiaba
// era el RÓTULO y el `type`, nunca el entrypoint. El gate pasó de booleano a un veredicto de TRES
// valores (`modoDocumentoSuelto`), porque `receipt` no era «no puedes»: era «tú emites
// justificantes».
//
// 🔴 SCRUM-1027 (21-sep-2026) RETIRA ESE PASO INTERMEDIO, no lo que lo hizo posible. La enmienda
// SCRUM-612c a la regla 24 manda que con el interruptor en OFF, en España, no se emite NINGÚN
// documento — el justificante que A0.5 abrió deja de existir. El veredicto de TRES valores se
// queda (el 'no' de «sin merchant» y el 'no' de «receipt» comparten desenlace pero no comparten
// motivo, y separarlos costaría un cuarto valor que nadie necesita hoy): lo que cambia es que
// 'receipt' ya no es un tercer caso — vuelve a caer en 'no', igual que antes de A0.5. No se
// retira el tipo `JUST` ni sus usos (eso es SCRUM-825, que va firmado antes — regla 27): esto
// solo cierra la PUERTA por la que se llegaba a pedir uno.
//
// Y el `type` no hubo ni que tocarlo: `emitInvoice` seguiría forzando `JUST` si la serie saliera
// `J-`, pero ahora nunca sale — `allocateInvoiceNumber` rechaza el modo `receipt` para los siete
// caminos (SCRUM-1027, `invoiceNumber.service.ts`). El camino de emisión no se modifica para
// esto: se endurece el ÚNICO punto que ya decidía (regla 38).
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
/**
 * QUÉ DOCUMENTO SUELTO PUEDE CREAR ESTE MERCHANT. Tres valores, no dos — aunque hoy dos de ellos
 * (sin merchant, y `receipt`) desemboquen en el mismo `'no'`.
 *
 * ── HISTORIA (SCRUM-346 / A0.5, retirado por SCRUM-1027) ────────────────────────────────────
 * A0.3 devolvía `false` para el modo `receipt`. A0.5 lo cambió a `'justificante'`, porque un
 * merchant ES real sin el flag SÍ podía emitir un documento (el justificante `J-`) y `false` lo
 * leía como «no puedes» cuando el caso real era «tú emites justificantes».
 *
 * 🔴 SCRUM-1027 (regla 24, enmienda SCRUM-612c, 21-sep-2026): con el interruptor en OFF, en
 * España, YA NO se emite NINGÚN documento — ni factura, ni justificante. El caso que A0.5 abrió
 * ya no existe, así que `receipt` vuelve a `'no'`. **No es deshacer A0.5 por descuido**: es la
 * misma decisión de fundador, tomada otra vez, en sentido contrario, con fecha y ticket propios.
 *
 * ⚠️ ESTO NO ENCIENDE NADA (regla 24). `INVOICING_ES_ENABLED` sigue OFF y ese merchant sigue sin
 * emitir facturas — ahora tampoco emite el documento intermedio que existía entre A0.5 y hoy.
 *
 * El gate sigue siendo el MODO DE EMISIÓN (V0-0) y no un flag escrito a mano, por lo que ya
 * explicaba A0.3: `INVOICING_ES_ENABLED` es ES-only y un merchant no-ES se quedaría sin botón
 * teniendo derecho a él.
 */
export type ModoDocumentoSuelto = 'factura' | 'justificante' | 'no';

export function modoDocumentoSuelto(merchant: MerchantLike | null | undefined): ModoDocumentoSuelto {
  if (!merchant) return 'no'; // sin merchant no se adivina: falla cerrado
  // SCRUM-1027: 'receipt' ya no es 'justificante' — regla 24 no deja NINGÚN documento suelto.
  return getEmissionMode(merchant) === 'receipt' ? 'no' : 'factura';
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
