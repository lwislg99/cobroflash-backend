// src/modules/fiscal/verifactu/sif.cola.ts — SCRUM-1127 · SIF-1 · S1-D fase 1.
//
// LAS DECISIONES DE LA COLA DE REMISIÓN, COMO FUNCIONES PURAS.
//
// 🔴 NO HAY TABLA. `VfSubmission` no está en `prisma/schema.prisma`, y NO entra hasta que el
// fundador decida qué significa «envío construido» para `scripts/_guard-afirmacion-fiscal.mjs`
// (una fila `model VfSubmission` basta para que ese guard deje de bloquear afirmaciones
// fiscales en la landing: ver `docs/master/SCRUM-1127.md`). Aquí vive lo que la cola DECIDE,
// sin base y sin red: qué pasa con cada registro después de un envío, cuánto se espera y
// cómo se trocea. El DDL propuesto está en el expediente.
//
// Estados: los de la FSM de `docs/SIF_SPEC_NOTES.md` §6 — `pending → sent → accepted`,
// `sent → rejected`, `sent → pending` (reintento) y `manual_review` al 5º intento. No se
// inventa ninguno. Lo que la FSM no tenía escrito y aquí se decide (y el expediente declara):
//   · Un registro RECHAZADO NO se reintenta solo. Reenviar el mismo contenido da el mismo
//     rechazo; corregirlo es una subsanación, que es un registro nuevo — camino de emisión,
//     fase 2 — o una persona. Solo se reintenta lo que NO SABEMOS si llegó.
//   · `AceptadoConErrores` es `accepted` (la AEAT lo registró) con el código en `lastError` y
//     `subsanar: true`.

import { MAX_REGISTROS_POR_ENVIO } from './registro.builder';
import type { LineaRespuesta, ResultadoEnvio } from './sif.client';

export type EstadoVfSubmission = 'pending' | 'sent' | 'accepted' | 'rejected' | 'manual_review';

export const ESTADOS_VF_SUBMISSION: readonly EstadoVfSubmission[] = [
  'pending', 'sent', 'accepted', 'rejected', 'manual_review',
];

/** Al llegar a este número de intentos sin saber si llegó, pasa a una persona (SIF_SPEC_NOTES §6). */
export const MAX_INTENTOS = 5;

/** Suelo del flujo de control de la AEAT: `TiempoEsperaEnvio` nunca baja de 60 s (§4). */
export const ESPERA_MINIMA_S = 60;

/** Techo del backoff entre reintentos. */
export const BACKOFF_TOPE_S = 30 * 60;

/** Identifica un registro dentro de una respuesta: la factura y la operación (alta/anulación). */
export interface IdRegistro {
  idEmisorFactura: string;
  numSerieFactura: string;
  fechaExpedicionFactura: string;
  /** `Alta` o `Anulacion`, como lo escribe la AEAT en `TipoOperacion`. */
  tipoOperacion: string;
}

export interface DecisionRegistro {
  registro: IdRegistro;
  estado: Exclude<EstadoVfSubmission, 'sent'>;
  intentos: number;
  lastError: string | null;
  /** Segundos hasta el siguiente intento. Solo en `pending`. */
  reintentarEnS: number | null;
  /** La AEAT lo registró con errores: hay que subsanarlo (registro nuevo, fase 2). */
  subsanar: boolean;
  /** Lo que queda para una persona, y ninguna máquina va a mover solo. */
  requierePersona: boolean;
}

export interface DecisionEnvio {
  registros: DecisionRegistro[];
  /** Segundos que hay que esperar antes del SIGUIENTE envío a la AEAT, sea del que sea. */
  esperaSiguienteEnvioS: number;
  /** Líneas de la respuesta que no casan con nada de lo enviado: se registran, no se aplican. */
  lineasHuerfanas: LineaRespuesta[];
}

export function clave(r: Pick<IdRegistro, 'idEmisorFactura' | 'numSerieFactura' | 'fechaExpedicionFactura'> & { tipoOperacion: string | null }): string {
  return [r.idEmisorFactura, r.numSerieFactura, r.fechaExpedicionFactura, r.tipoOperacion ?? ''].join('|');
}

/** Trocea en envíos de como mucho 1.000 registros (el `maxOccurs` del XSD). */
export function trocear<T>(items: readonly T[], max: number = MAX_REGISTROS_POR_ENVIO): T[][] {
  if (!Number.isInteger(max) || max < 1 || max > MAX_REGISTROS_POR_ENVIO) {
    throw new Error(`verifactu_tamano_de_lote_invalido:${max}`);
  }
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += max) out.push(items.slice(i, i + max));
  return out;
}

/** Backoff exponencial desde el suelo de 60 s: 60, 120, 240, 480… con techo. */
export function backoffS(intentos: number): number {
  const n = Math.max(1, Math.floor(intentos));
  return Math.min(BACKOFF_TOPE_S, ESPERA_MINIMA_S * 2 ** (n - 1));
}

/** Lo que manda la AEAT, pero nunca por debajo de 60 s. Sin respuesta, el suelo. */
export function esperaSiguienteEnvio(tiempoEsperaEnvioS: number | null | undefined): number {
  const t = typeof tiempoEsperaEnvioS === 'number' && Number.isFinite(tiempoEsperaEnvioS) ? tiempoEsperaEnvioS : 0;
  return Math.max(ESPERA_MINIMA_S, t);
}

/**
 * Un registro que se quedó en `sent` (el proceso murió con el sobre en vuelo) NO SABE si llegó.
 * Se trata igual que `sin_respuesta`: vuelve a `pending` para reenviarse tal cual, y cuenta el
 * intento. Nunca se da por aceptado.
 */
export function recuperarEnviadoSinCierre(registro: IdRegistro, intentosPrevios: number): DecisionRegistro {
  return reintento(registro, intentosPrevios, 'sin_respuesta:proceso_interrumpido_en_sent');
}

function reintento(registro: IdRegistro, intentosPrevios: number, error: string): DecisionRegistro {
  const intentos = intentosPrevios + 1;
  if (intentos >= MAX_INTENTOS) {
    return { registro, estado: 'manual_review', intentos, lastError: error, reintentarEnS: null, subsanar: false, requierePersona: true };
  }
  return { registro, estado: 'pending', intentos, lastError: error, reintentarEnS: backoffS(intentos), subsanar: false, requierePersona: false };
}

function desdeLinea(registro: IdRegistro, intentos: number, l: LineaRespuesta): DecisionRegistro {
  const codigo = l.codigoError ? `${l.codigoError}:${l.descripcionError ?? ''}` : null;
  const base = { registro, intentos, reintentarEnS: null };

  if (l.duplicado) {
    // La AEAT ya lo tenía. Lo que manda es el estado DEL QUE YA TIENE, no el de este envío.
    if (l.duplicado.estado === 'Correcta') {
      return { ...base, estado: 'accepted', lastError: `duplicado:${codigo ?? ''}`, subsanar: false, requierePersona: false };
    }
    if (l.duplicado.estado === 'AceptadaConErrores') {
      return { ...base, estado: 'accepted', lastError: `duplicado_aceptada_con_errores:${codigo ?? ''}`, subsanar: true, requierePersona: true };
    }
    return { ...base, estado: 'manual_review', lastError: `duplicado_anulada:${codigo ?? ''}`, subsanar: false, requierePersona: true };
  }
  if (l.estadoRegistro === 'Correcto') {
    return { ...base, estado: 'accepted', lastError: null, subsanar: false, requierePersona: false };
  }
  if (l.estadoRegistro === 'AceptadoConErrores') {
    return { ...base, estado: 'accepted', lastError: codigo ?? 'aceptado_con_errores', subsanar: true, requierePersona: true };
  }
  return { ...base, estado: 'rejected', lastError: codigo ?? 'incorrecto_sin_codigo', subsanar: false, requierePersona: true };
}

/**
 * Qué pasa con cada registro enviado, dado el resultado del envío. Pura.
 *
 * 🔴 La aceptación es POR LÍNEA y POR COINCIDENCIA. Un registro enviado que no aparece en la
 * respuesta NO está aceptado aunque el estado global diga `Correcto`: vuelve a la cola.
 */
export function decidirTrasEnvio(
  enviados: ReadonlyArray<{ registro: IdRegistro; intentosPrevios: number }>,
  resultado: ResultadoEnvio,
): DecisionEnvio {
  if (resultado.tipo === 'no_enviado' || resultado.tipo === 'sin_respuesta') {
    const error = `${resultado.tipo}:${resultado.etapa}:${resultado.motivo}`;
    return {
      registros: enviados.map((e) => reintento(e.registro, e.intentosPrevios, error)),
      esperaSiguienteEnvioS: esperaSiguienteEnvio(null),
      lineasHuerfanas: [],
    };
  }

  if (resultado.tipo === 'rechazado' && resultado.porque === 'soap_fault') {
    // El envío entero no se procesó (estructura, autorización, certificado…). Reenviar lo
    // mismo daría lo mismo: una persona.
    const error = `soap_fault:${resultado.faultcode ?? ''}:${resultado.faultstring ?? ''}`;
    return {
      registros: enviados.map((e) => ({
        registro: e.registro, estado: 'rejected' as const, intentos: e.intentosPrevios + 1,
        lastError: error, reintentarEnS: null, subsanar: false, requierePersona: true,
      })),
      esperaSiguienteEnvioS: esperaSiguienteEnvio(null),
      lineasHuerfanas: [],
    };
  }

  const respuesta = resultado.respuesta;
  const porClave = new Map<string, LineaRespuesta>();
  for (const l of respuesta.lineas) porClave.set(clave(l), l);
  const usadas = new Set<string>();

  const registros = enviados.map((e) => {
    const k = clave(e.registro);
    const l = porClave.get(k);
    if (!l) {
      if (resultado.tipo === 'rechazado') {
        // `Incorrecto` global sin línea para este registro: la AEAT no lo registró.
        return {
          registro: e.registro, estado: 'rejected' as const, intentos: e.intentosPrevios + 1,
          lastError: 'estado_envio_incorrecto_sin_linea', reintentarEnS: null, subsanar: false, requierePersona: true,
        };
      }
      return reintento(e.registro, e.intentosPrevios, `sin_linea_en_respuesta:${respuesta.estadoEnvio}`);
    }
    usadas.add(k);
    return desdeLinea(e.registro, e.intentosPrevios + 1, l);
  });

  return {
    registros,
    esperaSiguienteEnvioS: esperaSiguienteEnvio(respuesta.tiempoEsperaEnvioS),
    lineasHuerfanas: respuesta.lineas.filter((l) => !usadas.has(clave(l))),
  };
}
