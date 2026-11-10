// src/modules/auth/domain/territorioDeAlta.ts — SCRUM-1536d
//
// QUIÉN NO ENTRA EN YAQU, POR AHORA. Decidido por el fundador en SCRUM-1536: los domicilios
// fiscales forales (País Vasco y Navarra) y Canarias quedan fuera de YaQu —no sólo sin
// facturación— (c.20218), y Canarias también para quien trabaja allí con el domicilio fuera
// (c.20225 ①, «Ok las 2»). El diseño es el tramo «SCRUM-1536c» de `docs/master/SCRUM-1536.md`.
//
// Por qué dos datos y no uno:
//   · Lo foral va por DOMICILIO FISCAL, no por dónde se trabaja (RD 1007/2023, art. 1.3; medido en
//     c.19355 §4). Quien trabaja en Bilbao con el domicilio en Burgos entra.
//   · Canarias está DENTRO del Reglamento: se la deja fuera porque YaQu no sabe hacer IGIC, y por
//     eso cuentan las dos vías, el domicilio declarado y la provincia de trabajo.
//
// La provincia de trabajo no se guarda: lo que queda de ella es la zona (`zonaDeLaProvincia.ts`), y
// la de Canarias es la única que la distingue. Por eso la regla lee la ZONA que ya ha resuelto el
// alta y no vuelve a leer el nombre de la provincia: una sola tabla decide qué provincia es canaria.
//
// ⛔ Esto NO toca la emisión (reglas 38 y 40): decide si se crea el comercio, nada más. Un comercio
// creado antes sigue teniendo como único freno el flag (registro 1536c, pieza E).

/**
 * Los textos FIRMADOS por el fundador en SCRUM-1536 c.20225 («Ok firmo todas»), copiados de
 * c.20223 §⑤. Ficha: `docs/microcopy/2026-10-22-SCRUM-1536-exclusion-territorial.md`.
 * No se reescriben aquí: cualquier cambio es texto nuevo y vuelve a pedir firma (regla 39).
 */
const TEXTO_FUERA_POR_DOMICILIO = 'De momento YaQu no está disponible si tienes el domicilio fiscal en el País Vasco, Navarra o Canarias.';
const TEXTO_FUERA_POR_TRABAJO = 'De momento YaQu no está disponible para trabajos en Canarias.';
export const TEXTO_FORAL_EN_AJUSTES = 'De momento YaQu no está disponible con el domicilio fiscal en el País Vasco o en Navarra. No hemos guardado este cambio.';

/** La única zona que distingue una provincia de trabajo canaria (`zonaDeLaProvincia.ts`). */
const ZONA_DE_CANARIAS = 'Atlantic/Canary';

/** Las dos respuestas de la pregunta Q1 del alta: cada una, sí o no. Sin contestar, `undefined`. */
export interface DomicilioDeclarado {
  foral?: boolean;
  canarias?: boolean;
}

type Rechazo = Error & { code: string; motivo?: 'domicilio' | 'trabajo'; texto?: string };

function rechazo(code: string, motivo?: 'domicilio' | 'trabajo'): Rechazo {
  const err = new Error(code) as Rechazo;
  err.code = code;
  if (motivo) {
    err.motivo = motivo;
    err.texto = motivo === 'domicilio' ? TEXTO_FUERA_POR_DOMICILIO : TEXTO_FUERA_POR_TRABAJO;
  }
  return err;
}

/**
 * Decide si un alta puede crear el comercio. **Único sitio donde se decide**, y se llama ANTES del
 * `create`: si lanza, no queda nada (ni fila, ni bienvenida, ni enlace).
 *
 *   · España → las dos respuestas son OBLIGATORIAS (`domicilio_fiscal_required`). Con cualquiera
 *     de las dos en «sí», o con la zona de Canarias, LANZA `territorio_excluido` con el texto
 *     firmado que toca. Si pasa, devuelve el valor de `domicilioFiscalForal` que se guarda: `false`.
 *   · Otro país → no se pregunta: devuelve `undefined` y el comercio nace como hasta hoy. Con una
 *     respuesta delante LANZA (`domicilio_fiscal_desconocido`), como `zonaDeAlta` con una provincia:
 *     un argumento que no hace nada se lee igual que uno que sí.
 */
export function territorioDeAlta(country: string, zona: string | null, domicilio: DomicilioDeclarado = {}): false | undefined {
  const contestadas = [domicilio.foral, domicilio.canarias].filter((r) => typeof r === 'boolean').length;
  if (String(country).trim().toUpperCase() !== 'ES') {
    if (contestadas) throw rechazo('domicilio_fiscal_desconocido');
    return undefined;
  }
  if (contestadas !== 2) throw rechazo('domicilio_fiscal_required');
  if (domicilio.foral || domicilio.canarias) throw rechazo('territorio_excluido', 'domicilio');
  if (zona === ZONA_DE_CANARIAS) throw rechazo('territorio_excluido', 'trabajo');
  return false;
}
