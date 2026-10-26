// src/modules/fiscal/modelo130/modelo130.ts — SCRUM-1065b · el borrador del 130 SOBRE los dos libros.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ ES. El pago fraccionado del IRPF en estimación directa, sección I del impreso (casillas
// 01-07), como BORRADOR para el asesor (D2, SCRUM-1066 c.16699). No se presenta nada y no se dice
// que se pueda presentar (regla 7). No hay ruta ni pantalla: un texto que ve el usuario pide firma
// (regla 39). El aviso de «orientativo» es el MISMO del 303, importado: ningún texto nuevo.
//
// NO HAY UN TERCER AGREGADOR. Como el 303, esto SUMA los libros: el de emitidas (SCRUM-296) para la
// 01 y el de recibidas (SCRUM-426) para los gastos. Si el 130 contase facturas por su cuenta, un día
// el 303 y el 130 del mismo trimestre dirían bases distintas.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE NO SE SABE NO SE RELLENA CON CERO. Cada casilla es `{ casilla, valor, cita }` y, si no hay
// dato, `valor: null` con `vacioPorque`. Un 130 con la 06 a cero se lee «no me retuvieron», y eso
// YaQu no lo sabe: `Invoice` no guarda la retención aplicada (SCRUM-1048, SCRUM-1053).
//
//   · 02 · `gastos_deducibles_sin_confirmar`: la aceptación (punto 5) cuenta SÓLO los gastos que el
//     asesor confirme, y esa lista no existe (fundador, SCRUM-1065 c.20721). Los anotados, aparte, en
//     `hipotesisTodosLosGastosAnotados`, que NO es una casilla.
//   · 06 · `retenciones_soportadas_sin_dato`: además, el art. 110.3.a RIRPF sólo deja restarlas a
//     actividades PROFESIONALES (y arrendamiento e imagen); un oficio es empresarial (Q-C8).
//   · 05 · en T1 es 0 POR DEFINICIÓN (no hay trimestres anteriores en el año). En T2-T4 es
//     `pagos_anteriores_sin_dato`: sale de las 07 anteriores, que dependen de la 02 y la 06.
//   · 03, 04 y 07 · `depende_de_una_casilla_sin_dato`.
//
// FUERA DE LA POBLACIÓN, y se declara: la sección II (agrícolas, 08-11), la III (12-19: minoración
// del 110.3.c, vivienda, resultados negativos, complementaria), la reducción del 60 % del 110.2
// (Ceuta y Melilla) y el porcentaje voluntario mayor del 110.4.
//
// ⚠️ DEVENGO, no caja. Se lee el libro como lo lee el 303 hoy, por fecha de emisión, y SIN el
// criterio de caja del merchant: ese criterio es del IVA (LIVA 163 decies), no del IRPF. Si el
// asesor dice que un oficio imputa por cobros, se cambia aquí y el test lo dirá.
import type { LibroRegistro } from '../../invoicing/domain/libroRegistro';
import type { LibroRecibidas } from '../../invoicing/domain/libroRecibidas';
import { AVISO_ORIENTATIVO } from '../modelo303/modelo303';

const r2 = (n: number) => Math.round(n * 100) / 100;

// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS NÚMEROS DE CASILLA NO SE INVENTAN AQUÍ. PROCEDENCIA: el impreso oficial, LEÍDO.
//
// Orden EHA/672/2007, Anexo I, SUSTITUIDO por el art. único.3 de la Orden HAP/258/2015 (BOE-A-2015-1656,
// «primera autoliquidación trimestral del ejercicio 2015 y siguientes»). El consolidado de la orden
// (BOE-A-2007-6032) enlaza esa imagen como el anexo vigente. Leído el 24-oct-2026; transcripción en
// `docs/master/evidencias/scrum1065/casillas-130.md`. Si el impreso cambia, cambia PRIMERO esa
// evidencia y luego aquí.
//
// La fórmula: RIRPF (RD 439/2007, BOE-A-2007-6820), art. 110, redacción vigente desde el 23-dic-2018.
const FUENTE_130 = 'Orden EHA/672/2007, Anexo I (sustituido por Orden HAP/258/2015, art. único.3), pág. 1 · https://www.boe.es/datos/imagenes/disp/2015/43/01656_4793.png';

const CITA_ACUMULADO = 'RIRPF art. 110.1.a: «correspondiente al período de tiempo transcurrido desde el primer día del año hasta el último día del trimestre a que se refiere el pago fraccionado»';

/** Cada casilla con el rótulo del impreso (literal) y el artículo que la sostiene. */
const CASILLAS_130 = Object.freeze({
  ingresos: { casilla: '01', cita: `${FUENTE_130} · «Ingresos computables correspondientes al conjunto de las actividades ejercidas» · ${CITA_ACUMULADO}` },
  gastos: { casilla: '02', cita: `${FUENTE_130} · «Gastos fiscalmente deducibles correspondientes al conjunto de las actividades ejercidas» · ${CITA_ACUMULADO}` },
  rendimientoNeto: { casilla: '03', cita: `${FUENTE_130} · «Rendimiento neto ( 01 – 02 ). Si se obtiene una cantidad negativa, consígnela con signo menos (–)»` },
  veintePorCiento: { casilla: '04', cita: `${FUENTE_130} · «20 por 100 del importe de la casilla 03, si dicho importe es positivo. (Si la casilla 03 fuese negativa, consigne el número cero)» · RIRPF art. 110.1.a: «el 20 por ciento del rendimiento neto»` },
  trimestresAnteriores: { casilla: '05', cita: `${FUENTE_130} · «De los trimestres anteriores: suma de los importes positivos de la casilla 07 menos la suma de los importes de la casilla 16» · RIRPF art. 110.1.a: «se deducirán los pagos fraccionados que, en relación con estas actividades, habría correspondido ingresar en los trimestres anteriores del mismo año»` },
  retenciones: { casilla: '06', cita: `${FUENTE_130} · «Retenciones e ingresos a cuenta soportados por las actividades incluidas en este apartado y correspondientes al período comprendido entre el primer día del año y el último día del trimestre» · RIRPF art. 110.3.a.1.º: «Actividades profesionales que determinen su rendimiento neto por el método de estimación directa»` },
  pagoFraccionadoPrevio: { casilla: '07', cita: `${FUENTE_130} · «Pago fraccionado previo del trimestre ( 04 – 05 – 06 ). Si se obtiene una cantidad negativa, consígnela con signo menos (–)»` },
});

/** RIRPF art. 110.1.a: «el 20 por ciento». En centésimas para no arrastrar coma flotante. */
const PORCENTAJE_PAGO_FRACCIONADO = 20;

export type MotivoSinDato =
  | 'gastos_deducibles_sin_confirmar'
  | 'retenciones_soportadas_sin_dato'
  | 'pagos_anteriores_sin_dato'
  | 'depende_de_una_casilla_sin_dato';

export interface CasillaDel130 {
  casilla: string;
  /** `null` = no se sabe. NUNCA un cero de relleno: el porqué va en `vacioPorque`. */
  valor: number | null;
  vacioPorque?: MotivoSinDato;
  cita: string;
}

/** Una factura emitida que no entra en la 01 porque su base no se pudo leer. */
export interface IngresoSinComputar {
  numero: string;
  motivo: 'importe_ilegible';
}

export interface Borrador130 {
  año: number;
  trimestre: number;
  /** El ACUMULADO: del 1 de enero al último día del trimestre (art. 110.1.a). */
  desde: string;
  hasta: string;
  moneda: string;
  seccionI: {
    ingresos: CasillaDel130;
    gastos: CasillaDel130;
    rendimientoNeto: CasillaDel130;
    veintePorCiento: CasillaDel130;
    trimestresAnteriores: CasillaDel130;
    retenciones: CasillaDel130;
    pagoFraccionadoPrevio: CasillaDel130;
  };
  /**
   * NO ES UNA CASILLA. Lo que darían la 02, la 03 y la 04 si TODOS los gastos anotados fuesen
   * deducibles en el IRPF, para que el asesor tenga la cifra delante. Ni la 05 ni la 06 entran:
   * siguen sin dato. Se retira el día que haya lista de deducibles confirmada.
   */
  hipotesisTodosLosGastosAnotados: { gastosAnotados: number; rendimientoNeto: number; veintePorCiento: number };
  ingresosSinComputar: IngresoSinComputar[];
  /** Filas del libro sin número: no son asiento (SCRUM-296), pero su dinero se dice. */
  facturasSinNumero: { cuantas: number; importe: number };
  /** Gastos sin `baseAmount` (SCRUM-426): fuera de los anotados, y con su dinero. */
  gastosSinBase: { cuantos: number; importe: number };
  miradas: { facturas: number; gastos: number };
  asientos: { facturas: number; gastos: number };
  fueraDePoblacion: string[];
  motivosParaNoFiarse: string[];
  avisoObligatorio: string;
}

const FUERA_DE_POBLACION = Object.freeze([
  'seccion_II_actividades_agricolas_08_a_11',
  'seccion_III_total_liquidacion_12_a_19',
  'reduccion_60_por_ciento_art_110_2',
  'porcentaje_voluntario_mayor_art_110_4',
]);

/**
 * El periodo ACUMULADO del 130: del 1 de enero del año al último día del trimestre, con sus bordes.
 *
 * ⚠️ Fechas LOCALES, como `rangoTrimestre` del 303 y por lo mismo: el año fiscal es del calendario
 * español. El 31 de diciembre a las 23:30 de Madrid es del año que acaba, no del siguiente.
 */
export function rangoAcumulado(año: number, trimestre: number): { desde: Date; hasta: Date } {
  const t = Math.min(4, Math.max(1, Math.trunc(trimestre) || 1));
  return {
    desde: new Date(año, 0, 1, 0, 0, 0, 0),
    hasta: new Date(año, t * 3, 0, 23, 59, 59, 999),
  };
}

const casilla = (c: { casilla: string; cita: string }, valor: number | null, vacioPorque?: MotivoSinDato): CasillaDel130 =>
  (vacioPorque ? { casilla: c.casilla, valor: null, vacioPorque, cita: c.cita } : { casilla: c.casilla, valor, cita: c.cita });

/**
 * Construye el borrador a partir de los libros del periodo ACUMULADO.
 *
 * Los libros tienen que venir YA acotados por `rangoAcumulado` (lo hace `leerBorrador130`): filtrar
 * aquí sería un segundo criterio de fechas, y dos criterios acaban discrepando.
 */
export function construirBorrador130(params: {
  libro: LibroRegistro;
  libroRecibidas: LibroRecibidas;
  año: number;
  trimestre: number;
  /**
   * `Merchant.createdAt` (SCRUM-1065e). Sin él no se avisa de nada: no se deduce un alta que no se ha leído.
   */
  altaDelMerchant?: Date | null;
}): Borrador130 {
  const trimestre = Math.min(4, Math.max(1, Math.trunc(params.trimestre) || 1));
  const { desde, hasta } = rangoAcumulado(params.año, trimestre);
  let moneda = 'EUR';

  let ingresos = 0;
  const ingresosSinComputar: IngresoSinComputar[] = [];
  for (const a of params.libro.asientos) {
    if (a.moneda) moneda = a.moneda;
    // Base imponible, sin IVA. Una rectificativa trae su base en negativo y resta sola.
    if (a.importeIlegible || a.base === null) {
      ingresosSinComputar.push({ numero: a.numero, motivo: 'importe_ilegible' });
      continue;
    }
    ingresos += a.base;
  }

  let gastosAnotados = 0;
  for (const g of params.libroRecibidas.asientos) {
    if (g.base !== null) gastosAnotados += g.base;
  }

  const c = CASILLAS_130;
  const c01 = r2(ingresos);
  // T1: la suma de los trimestres anteriores del MISMO año es una suma vacía. No es un relleno.
  const c05 = trimestre === 1 ? casilla(c.trimestresAnteriores, 0) : casilla(c.trimestresAnteriores, null, 'pagos_anteriores_sin_dato');

  const rendimientoHipotesis = r2(c01 - gastosAnotados);
  const veinte = (rn: number) => (rn > 0 ? r2((rn * PORCENTAJE_PAGO_FRACCIONADO) / 100) : 0);

  const motivosParaNoFiarse: string[] = [];
  if (params.libro.miradas > 0 && params.libro.asientos.length === 0) motivosParaNoFiarse.push('facturas_miradas_sin_asiento');
  if (ingresosSinComputar.length > 0) motivosParaNoFiarse.push('ingresos_sin_computar');
  if (params.libro.sinNumero > 0) motivosParaNoFiarse.push('facturas_sin_numero');
  if (params.libroRecibidas.sinClasificar > 0) motivosParaNoFiarse.push('gastos_sin_base');
  // SCRUM-1065e (decisión del fundador, SCRUM-1065 c.20869): un alta posterior al 1 de enero deja una
  // 01 que sólo ve lo facturado por YaQu desde el alta; lo de antes, por otra vía, no está. Es un CÓDIGO:
  // si algún día se pinta, su texto se firma aparte (regla 39). El 1 de enero, a cualquier hora, no avisa.
  // Fecha LOCAL, como `rangoAcumulado`.
  if (params.altaDelMerchant && params.altaDelMerchant >= new Date(params.año, 0, 2, 0, 0, 0, 0)) {
    motivosParaNoFiarse.push('alta_a_mitad_de_ejercicio');
  }

  return {
    año: params.año,
    trimestre,
    desde: desde.toISOString(),
    hasta: hasta.toISOString(),
    moneda,
    seccionI: {
      ingresos: casilla(c.ingresos, c01),
      gastos: casilla(c.gastos, null, 'gastos_deducibles_sin_confirmar'),
      rendimientoNeto: casilla(c.rendimientoNeto, null, 'depende_de_una_casilla_sin_dato'),
      veintePorCiento: casilla(c.veintePorCiento, null, 'depende_de_una_casilla_sin_dato'),
      trimestresAnteriores: c05,
      retenciones: casilla(c.retenciones, null, 'retenciones_soportadas_sin_dato'),
      pagoFraccionadoPrevio: casilla(c.pagoFraccionadoPrevio, null, 'depende_de_una_casilla_sin_dato'),
    },
    hipotesisTodosLosGastosAnotados: {
      gastosAnotados: r2(gastosAnotados),
      rendimientoNeto: rendimientoHipotesis,
      veintePorCiento: veinte(rendimientoHipotesis),
    },
    ingresosSinComputar,
    facturasSinNumero: { cuantas: params.libro.sinNumero, importe: r2(params.libro.sinNumeroImporte) },
    gastosSinBase: { cuantos: params.libroRecibidas.sinClasificar, importe: r2(params.libroRecibidas.sinClasificarImporte) },
    miradas: { facturas: params.libro.miradas, gastos: params.libroRecibidas.miradas },
    asientos: { facturas: params.libro.asientos.length, gastos: params.libroRecibidas.asientos.length },
    fueraDePoblacion: [...FUERA_DE_POBLACION],
    motivosParaNoFiarse,
    avisoObligatorio: AVISO_ORIENTATIVO,
  };
}
