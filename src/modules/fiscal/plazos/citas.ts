// src/modules/fiscal/plazos/citas.ts — SCRUM-1076d · LA TABLA DE CITAS del calendario de plazos.
//
// Cada modelo, con el plazo TAL COMO LO CITA SU ORDEN. La cita es COPIA LITERAL de
// `docs/producto/CONTABILIDAD.md` (§3 para el 303, §10 para el resto), y allí la comprueba contra el
// BOE `docs/verificacion/comprobar-citas-contabilidad.mjs` (fuente `ORDEN<modelo>`, con su ancla en
// `anclas-citas-contabilidad.json`). Que la copia de aquí sea la de allí lo exige
// `tests/scrum1076d-calendario-de-plazos.test.mjs`: una cita cambiada aquí, o allí, lo tumba.
//
// 🔴 Un modelo SIN cita no tiene fila (aceptación 3 de SCRUM-1076). No hay fecha por defecto.
// 🔴 La fecha límite es la que CITA la orden. Sábados, domingos, festivos y prórrogas NO se calculan
//    (D0 de c.21877): los cubren las notas T14 y T15, que mandan al asesor.
//
// `nombre` y los periodos son los textos FIRMADOS (SCRUM-1076 c.21877: T6a–T6f, T7, T8).

export type CodigoModelo = '303' | '130' | '111' | '115' | '347' | '390';
export type Periodo = '1T' | '2T' | '3T' | '4T' | 'ANUAL';

/** El último día del plazo, derivado de la cita: trimestral (día de cada trimestre) o anual. */
export type ReglaDelPlazo =
  // Trimestre t del ejercicio → el `dias[t-1]` del mes siguiente al cierre (el 4T, enero del año siguiente).
  | { tipo: 'trimestral'; dias: readonly [number, number, number, number] }
  // Año → `mes` del año siguiente; `dia: 'ultimo'` es el último día de ese mes.
  | { tipo: 'anual'; mes: number; dia: number | 'ultimo' };

export interface CitaDelPlazo {
  modelo: CodigoModelo;
  /** T6a–T6f, firmados. */
  nombre: string;
  /** Clave de la fuente en el comprobador (`BOE` de `comprobar-citas-contabilidad.mjs`). */
  fuente: string;
  orden: string;
  articulo: string;
  url: string;
  /** Fecha (ISO) en que el comprobador la vio literal en el BOE: SCRUM-1076b, 13-nov-2026. */
  comprobadaEl: string;
  /** LITERAL de CONTABILIDAD.md. */
  cita: string;
  regla: ReglaDelPlazo;
}

const COMPROBADA = '2026-11-13';

export const CITAS_PLAZOS: readonly CitaDelPlazo[] = Object.freeze([
  {
    modelo: '303',
    nombre: 'Modelo 303 · IVA',
    fuente: 'ORDEN303',
    orden: 'Orden EHA/3786/2008',
    articulo: 'art. 7.2',
    url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2008-20953',
    comprobadaEl: COMPROBADA,
    cita: 'la presentación de las autoliquidaciones del modelo 303, así como, en su caso, el ingreso o la solicitud de devolución, si corresponde, de la cantidad resultante, se efectuará en los veinte primeros días naturales del mes siguiente a la finalización del correspondiente período de liquidación trimestral, excepto la correspondiente al último período de liquidación del año, que deberá presentarse durante los treinta primeros días naturales del mes de enero siguiente',
    regla: { tipo: 'trimestral', dias: [20, 20, 20, 30] },
  },
  {
    modelo: '130',
    nombre: 'Modelo 130 · IRPF, pago fraccionado',
    fuente: 'ORDEN130',
    orden: 'Orden EHA/672/2007',
    articulo: 'art. 7',
    url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2007-6032',
    comprobadaEl: COMPROBADA,
    cita: 'la presentación de las declaraciones formuladas en los modelos 130 y 131 y, en su caso, el ingreso de la deuda tributaria resultante de las mismas en el Tesoro Público se realizará en los plazos siguientes: a) Los tres primeros trimestres, entre el día 1 y el 20 de los meses de abril, julio y octubre. b) El cuarto trimestre, entre el día 1 y el 30 del mes de enero.',
    regla: { tipo: 'trimestral', dias: [20, 20, 20, 30] },
  },
  {
    modelo: '111',
    nombre: 'Modelo 111 · Retenciones',
    fuente: 'ORDEN111',
    orden: 'Orden EHA/586/2011',
    articulo: 'art. 3.1.c',
    url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2011-4948',
    comprobadaEl: COMPROBADA,
    cita: 'c) Las restantes personas físicas, jurídicas y demás entidades obligadas a retener o a ingresar a cuenta, en los veinte primeros días naturales de los meses de abril, julio, octubre y enero en relación con las cantidades y los ingresos a cuenta que correspondan por el trimestre natural inmediato anterior.',
    regla: { tipo: 'trimestral', dias: [20, 20, 20, 20] },
  },
  {
    modelo: '115',
    nombre: 'Modelo 115 · Retenciones de alquileres',
    fuente: 'ORDEN115',
    orden: 'Orden de 20 de noviembre de 2000',
    articulo: 'apartado séptimo',
    url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2000-21430',
    comprobadaEl: COMPROBADA,
    cita: 'La presentación e ingreso de este modelo, en papel o por vía telemática, se efectuará en los veinte primeros días naturales de los meses de abril, julio, octubre y enero en relación con las cantidades retenidas y los ingresos a cuenta efectuados por el primero, segundo, tercero y cuarto trimestre del año natural, respectivamente.',
    regla: { tipo: 'trimestral', dias: [20, 20, 20, 20] },
  },
  {
    modelo: '347',
    nombre: 'Modelo 347 · Operaciones con terceros',
    fuente: 'ORDEN347',
    orden: 'Orden EHA/3012/2008',
    articulo: 'art. 10',
    url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2008-16973',
    comprobadaEl: COMPROBADA,
    cita: 'La presentación de la declaración anual de operaciones con terceras personas, modelo 347, se realizará durante el mes de febrero de cada año en relación con las operaciones realizadas durante el año natural anterior, sin perjuicio de lo dispuesto en el artículo 17.2 de la Orden HAP/2194/2013',
    regla: { tipo: 'anual', mes: 2, dia: 'ultimo' },
  },
  {
    modelo: '390',
    nombre: 'Modelo 390 · Resumen anual de IVA',
    fuente: 'ORDEN390',
    orden: 'Orden EHA/3111/2009',
    articulo: 'art. 8',
    url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2009-18472',
    comprobadaEl: COMPROBADA,
    cita: 'La declaración-resumen anual del Impuesto sobre el Valor Añadido deberá presentarse en los treinta primeros días naturales del mes de enero siguiente al año al que se refiere la declaración, sin perjuicio, de lo establecido en el apartado 4 del artículo 4 de esta Orden.',
    regla: { tipo: 'anual', mes: 1, dia: 30 },
  },
] satisfies CitaDelPlazo[]);

/** Los periodos de un modelo en un ejercicio: 1T–4T, o el año entero. */
export function periodosDe(cita: CitaDelPlazo): Periodo[] {
  return cita.regla.tipo === 'trimestral' ? ['1T', '2T', '3T', '4T'] : ['ANUAL'];
}
