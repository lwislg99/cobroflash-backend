// src/modules/invoicing/domain/retencionIrpf.ts — SCRUM-293 (A2)
//
// LA RETENCIÓN DE IRPF, CALCULADA APARTE Y SIN TOCAR NADA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ ESTE MÓDULO NO LO LLAMA NADIE TODAVÍA, Y ESO ES DELIBERADO
//
// A2 no se puede terminar hoy: los campos que hacen falta —el tipo de retención en el perfil y
// el tipo APLICADO congelado en la factura— necesitan migración, y las migraciones están paradas
// (SCRUM-383). Así que esto es un hueco estructurado **con su mecanismo dentro y probado**,
// esperando al campo. Cuando exista, se enchufa; no hay que volver a decidir nada de aquí.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE LA RETENCIÓN **NO** ES, Y ES LA MITAD DEL TICKET
//
// La retención de IRPF **NO se resta del total de la factura**. Es un **pago a cuenta que hace el
// PAGADOR** a Hacienda en nombre del profesional. El documento conserva su forma de siempre:
//
//     Base imponible       1.000,00
//     IVA 21 %               210,00
//     Total factura        1.210,00   ← ESTO es lo que se sella, y NO se mueve
//     Retención IRPF 15 %   −150,00
//     Líquido a percibir   1.060,00   ← DERIVADO al pintar, JAMÁS almacenado
//
// De ahí las tres reglas duras de este fichero:
//
//   ① NO se toca `calcVatBreakdown` ni `grossOfLines`. La retención no entra en la base, no entra
//      en la cuota y no cambia el total. Lo consumen 16 ficheros —uno de ellos el sellado
//      (`registro.builder.ts`, que manda la base literal al XML)— y no tienen nada que aprender.
//
//   ② La retención se calcula sobre la **BASE IMPONIBLE**, nunca sobre el total. Calcularla sobre
//      el total (1.210,00 × 15 % = 181,50 en vez de 150,00) es el error clásico, y son 31,50 € de
//      diferencia en una factura de mil euros.
//
//   ③ El **líquido a percibir** se DERIVA. Guardarlo sería tener dos totales almacenados, y dos
//      totales acaban divergiendo — que es el defecto que esta casa lleva toda la semana pagando.

/** Dos decimales, medio arriba. El MISMO redondeo que `round2` en `vat.service`/`invoiceLines`. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Los tipos de retención que un profesional de oficios puede tener HOY en España.
 *
 * Cerrado a propósito (regla 27): un tipo libre deja meter un 7,5 que no existe, y el error no se
 * ve hasta que Hacienda cruza los datos. Si aparece un tipo nuevo, se añade aquí con su motivo.
 *
 *   · 15 % — el general de actividades profesionales.
 *   ·  7 % — reducido: los tres primeros años de actividad (y el de inicio).
 *   ·  2 % — algunas actividades empresariales en estimación objetiva (módulos).
 *   ·  1 % — ídem, actividades concretas.
 */
export const TIPOS_RETENCION = [15, 7, 2, 1] as const;
export type TipoRetencion = (typeof TIPOS_RETENCION)[number];

/**
 * EL CUBO — cada tipo con su rótulo, y el rótulo NO es opcional.
 *
 * Mismo mecanismo que `CUBO_DE` en `metodoDeCobro.ts`: un `Record<Union, …>` exige una entrada por
 * cada miembro del tipo, así que **añadir un tipo a `TIPOS_RETENCION` sin declarar su rótulo no
 * compila**. No es un convenio ni un recordatorio en un comentario: lo impide el compilador.
 *
 * 🔴 POR QUÉ EL RÓTULO VIVE AQUÍ Y NO EN LA PANTALLA. Un `<option>` escrito a mano en el front es
 * un número suelto que nadie relaciona con esta lista: el día que se añada o se quite un tipo, la
 * pantalla se queda diciendo lo de antes y **nada avisa**. Con el cubo, el selector se pinta
 * RECORRIÉNDOLO — cero literales de porcentaje en el front — y una lista que cambia se ve sola.
 *
 * ⚠️ El `19 %` NO está y no vuelve: no es un tipo de retención de actividades profesionales.
 */
export interface CuboDeRetencion {
  /** El tipo, en porcentaje entero. Es la clave y el valor: se usa tal cual al calcular. */
  tipo: TipoRetencion;
  /** Lo que lee el profesional. Regla 30: lo aprueba el fundador, derivado de este cubo. */
  rotulo: string;
  /** En qué orden se pinta. Propiedad DEL CUBO, no del tipo. */
  orden: number;
}

export const CUBO_DE_RETENCION: Readonly<Record<TipoRetencion, CuboDeRetencion>> = Object.freeze({
  15: { tipo: 15, rotulo: '15 %', orden: 1 },
  7: { tipo: 7, rotulo: '7 %', orden: 2 },
  2: { tipo: 2, rotulo: '2 %', orden: 3 },
  1: { tipo: 1, rotulo: '1 %', orden: 4 },
});

/**
 * Los tipos en el ORDEN en que se pintan. La pantalla usa esto y no `TIPOS_RETENCION`: el orden es
 * del cubo, y leer la lista cruda deja el orden al azar de cómo se escribió.
 */
export function tiposDeRetencionOrdenados(): CuboDeRetencion[] {
  return Object.values(CUBO_DE_RETENCION).sort((a, b) => a.orden - b.orden);
}

export function esTipoRetencionValido(tipo: unknown): tipo is TipoRetencion {
  // Se pregunta AL CUBO, no a la lista: si algún día divergen, la que manda es la que tiene rótulo
  // —porque es la única que se puede pintar—. Y con el `Record` no pueden divergir.
  return typeof tipo === 'number' && Object.prototype.hasOwnProperty.call(CUBO_DE_RETENCION, tipo);
}

/**
 * El importe retenido: **base imponible × tipo**, redondeado a dos decimales UNA sola vez.
 *
 * 🔴 DÓNDE SE REDONDEA, QUE ES DONDE ESTOS CÁLCULOS SE ROMPEN. Se redondea **al final y solo
 * aquí**. La `base` que entra ya viene redondeada por `calcVatBreakdown` (es su contrato), así
 * que no se vuelve a tocar: redondear dos veces mueve céntimos, y un céntimo en una retención es
 * una discrepancia con el 111 que hay que explicar.
 *
 * Devuelve un número POSITIVO. El signo lo pone quien lo pinta, porque en el documento se lee
 * como resta y en el modelo 111 se declara como importe.
 */
export function calcularRetencion(baseImponible: number, tipo: TipoRetencion): number {
  if (!Number.isFinite(baseImponible)) return 0;
  return round2(baseImponible * (tipo / 100));
}

/**
 * El LÍQUIDO A PERCIBIR: total de la factura − retención. Derivado, nunca almacenado.
 *
 * Se calcula sobre el `total` (base + cuota), no sobre la base: la retención se practica sobre la
 * base, pero se descuenta de lo que el cliente paga.
 */
export function liquidoAPercibir(total: number, retencion: number): number {
  return round2(total - retencion);
}

/**
 * El bloque completo, tal y como se pinta. Una sola función para que el PDF, la pantalla y el
 * futuro modelo 111 no calculen cada uno lo suyo.
 *
 * `tipo === null` (el merchant no retiene) devuelve `null`: **no hay bloque**, y la factura sale
 * exactamente como sale hoy. Es el caso de la inmensa mayoría, y el que no puede cambiar.
 */
export function bloqueRetencion(params: {
  baseImponible: number;
  total: number;
  tipo: TipoRetencion | null;
}): { tipo: TipoRetencion; base: number; retencion: number; liquido: number } | null {
  if (params.tipo === null || !esTipoRetencionValido(params.tipo)) return null;
  const retencion = calcularRetencion(params.baseImponible, params.tipo);
  return {
    tipo: params.tipo,
    base: params.baseImponible,
    retencion,
    liquido: liquidoAPercibir(params.total, retencion),
  };
}

/**
 * ⚠️ SUELO FISCAL — lee la configuración del merchant SIN caer a «sin retención» en silencio.
 *
 * Emitir sin la retención de alguien que retiene es un defecto fiscal MUDO: la factura sale, el
 * cliente la paga, y el descuadre aparece meses después en el 111. Por eso «no lo sé» y «no
 * retiene» no pueden colapsar en el mismo valor.
 *
 * Devuelve `{ ok: true, tipo }` (con `tipo: null` = declarado que NO retiene) o
 * `{ ok: false, motivo }`. Quien lo llame **debe** tratar el `false` como impedimento para
 * emitir, no como un cero.
 */
export function leerTipoRetencion(config: unknown):
  | { ok: true; tipo: TipoRetencion | null }
  | { ok: false; motivo: string } {
  if (config === null || config === undefined) {
    return { ok: false, motivo: 'no se ha podido leer la configuración de retención del profesional' };
  }
  if (config === false) return { ok: true, tipo: null }; // declarado explícitamente: no retiene
  if (esTipoRetencionValido(config)) return { ok: true, tipo: config };
  return { ok: false, motivo: `tipo de retención desconocido: ${JSON.stringify(config)}` };
}
