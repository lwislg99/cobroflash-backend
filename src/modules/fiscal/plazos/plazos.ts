// src/modules/fiscal/plazos/plazos.ts — SCRUM-1076d · EL CALENDARIO DE PLAZOS, sin base de datos.
//
// Entra: el ejercicio, el día de hoy EN LA ZONA DEL COMERCIO, qué filas ve (visibilidad, §2 de
// SCRUM-1076 c.21876) y lo que el profesional ha marcado. Sale: una fila por modelo y periodo, con
// su AÑO, su FECHA LÍMITE tal como la cita la orden y la CITA (aceptación 2 y 3).
//
// 🔴 El estado sale SOLO de lo marcado (aceptación 5): sin marca es «pendiente», y ningún cobro,
//    pago ni documento entra en esta función — no tiene parámetro por donde entrar.
// 🔴 Sin cita no hay fila: las filas salen de `CITAS_PLAZOS`, y nada más.
// 🔴 Un plazo vencido y sin marcar sigue «pendiente» (P4 de c.21877): no hay «vencido».
import { CITAS_PLAZOS, periodosDe, type CitaDelPlazo, type CodigoModelo, type Periodo } from './citas';
import { TEXTOS_PLAZOS, rotuloDelPeriodo, rotuloDeLaFuente } from './textos';

/** El único estado que se guarda. «Pendiente» es la AUSENCIA de fila. */
export const ESTADO_LLEVADO_ASESOR = 'llevado_asesor' as const;
export const ESTADOS_PLAZO = Object.freeze(['pendiente', ESTADO_LLEVADO_ASESOR] as const);
export type EstadoPlazo = (typeof ESTADOS_PLAZO)[number];

export interface MarcaDelPlazo {
  modelo: string;
  ejercicio: number;
  periodo: string;
  estado: string;
}

export interface FilaDelPlazo {
  modelo: CodigoModelo;
  nombre: string;
  ejercicio: number;
  periodo: Periodo;
  /** T7/T8: «1T 2026» · «Año 2026». Siempre con el año. */
  rotuloPeriodo: string;
  /** `YYYY-MM-DD`, el último día que cita la orden. Con su año. */
  fechaLimite: string;
  /** T15 si el último día cae en sábado o domingo; si no, null. No se mueve la fecha. */
  avisoFinDeSemana: string | null;
  /** T16 si el periodo aún no ha terminado; si no, null. */
  enCurso: string | null;
  estado: EstadoPlazo;
  /** T9 o T10. */
  rotuloEstado: string;
  fuente: { orden: string; articulo: string; url: string; comprobadaEl: string; cita: string; rotulo: string };
}

const dos = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${dos(m)}-${dos(d)}`;
/** Último día del mes `m` (1-12) del año `y`. Aritmética de calendario, sin zona. */
const ultimoDia = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** El último día del plazo, tal como lo deriva la regla de la cita. */
export function fechaLimiteDe(cita: CitaDelPlazo, ejercicio: number, periodo: Periodo): string {
  const r = cita.regla;
  if (r.tipo === 'anual') {
    const y = ejercicio + 1;
    return iso(y, r.mes, r.dia === 'ultimo' ? ultimoDia(y, r.mes) : r.dia);
  }
  const t = Number(periodo.slice(0, 1));
  const mes = t * 3 + 1; // abril, julio, octubre… y el 13 es el enero siguiente
  return mes > 12 ? iso(ejercicio + 1, 1, r.dias[3]) : iso(ejercicio, mes, r.dias[t - 1]);
}

/** El último día del periodo (no del plazo). */
export function finDelPeriodo(ejercicio: number, periodo: Periodo): string {
  if (periodo === 'ANUAL') return iso(ejercicio, 12, 31);
  const mes = Number(periodo.slice(0, 1)) * 3;
  return iso(ejercicio, mes, ultimoDia(ejercicio, mes));
}

export function caeEnFinDeSemana(fecha: string): boolean {
  const dia = new Date(Date.UTC(Number(fecha.slice(0, 4)), Number(fecha.slice(5, 7)) - 1, Number(fecha.slice(8, 10)))).getUTCDay();
  return dia === 0 || dia === 6;
}

export const claveDelPlazo = (modelo: string, ejercicio: number, periodo: string) => `${modelo}|${ejercicio}|${periodo}`;

export function construirCalendario(params: {
  ejercicio: number;
  /** Hoy, `YYYY-MM-DD`, en la zona del comercio. */
  hoy: string;
  /** ¿Ve el comercio la fila de este modelo y periodo? (aceptación 7) */
  esVisible: (modelo: CodigoModelo, periodo: Periodo) => boolean;
  marcas: readonly MarcaDelPlazo[];
  /** La tabla de citas. Por parámetro sólo para que un test le pase una entrada SIN cita. */
  citas?: readonly CitaDelPlazo[];
}): FilaDelPlazo[] {
  const marcadas = new Set(
    params.marcas
      .filter((m) => m.estado === ESTADO_LLEVADO_ASESOR && m.ejercicio === params.ejercicio)
      .map((m) => claveDelPlazo(m.modelo, m.ejercicio, m.periodo)),
  );
  const filas: FilaDelPlazo[] = [];
  for (const cita of params.citas ?? CITAS_PLAZOS) {
    if (!cita.cita || !cita.orden || !cita.articulo) continue; // sin cita, no hay fila
    for (const periodo of periodosDe(cita)) {
      if (!params.esVisible(cita.modelo, periodo)) continue;
      const fechaLimite = fechaLimiteDe(cita, params.ejercicio, periodo);
      const estado: EstadoPlazo = marcadas.has(claveDelPlazo(cita.modelo, params.ejercicio, periodo)) ? ESTADO_LLEVADO_ASESOR : 'pendiente';
      filas.push({
        modelo: cita.modelo,
        nombre: cita.nombre,
        ejercicio: params.ejercicio,
        periodo,
        rotuloPeriodo: rotuloDelPeriodo(periodo, params.ejercicio),
        fechaLimite,
        avisoFinDeSemana: caeEnFinDeSemana(fechaLimite) ? TEXTOS_PLAZOS.finDeSemana : null,
        enCurso: finDelPeriodo(params.ejercicio, periodo) >= params.hoy ? TEXTOS_PLAZOS.enCurso : null,
        estado,
        rotuloEstado: estado === ESTADO_LLEVADO_ASESOR ? TEXTOS_PLAZOS.llevadoAsesor : TEXTOS_PLAZOS.pendiente,
        fuente: {
          orden: cita.orden,
          articulo: cita.articulo,
          url: cita.url,
          comprobadaEl: cita.comprobadaEl,
          cita: cita.cita,
          rotulo: rotuloDeLaFuente(cita),
        },
      });
    }
  }
  // De la más cercana a la más lejana; empate, por el orden de la tabla de citas (estable).
  return filas.sort((a, b) => (a.fechaLimite < b.fechaLimite ? -1 : a.fechaLimite > b.fechaLimite ? 1 : 0));
}

/** Valida la clave de un PUT contra la tabla de citas: un modelo o periodo sin cita no se marca. */
export function validarClave(modelo: string, ejercicio: number, periodo: string): { ok: true } | { ok: false; error: string } {
  const cita = CITAS_PLAZOS.find((c) => c.modelo === modelo);
  if (!cita) return { ok: false, error: 'modelo_sin_cita' };
  if (!Number.isInteger(ejercicio) || ejercicio < 2000 || ejercicio > 2100) return { ok: false, error: 'ejercicio_invalido' };
  if (!(periodosDe(cita) as string[]).includes(periodo)) return { ok: false, error: 'periodo_invalido' };
  return { ok: true };
}
