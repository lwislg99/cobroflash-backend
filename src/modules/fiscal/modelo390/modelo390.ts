// src/modules/fiscal/modelo390/modelo390.ts — SCRUM-1077 · el borrador del 390 SOBRE el 303.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// NO HAY UN SEGUNDO CÁLCULO. ESTO SUMA LOS CUATRO 303.
//
// Decisión del fundador (SCRUM-1077 c.20726, «Sí, como D2»): el 390 sale como borrador para el
// asesor y es la suma de los cuatro trimestres del 303 de `main`. No lee facturas ni gastos: recibe
// los cuatro `Modelo303` y los suma. Si el anual contase por su cuenta, un día diría una cifra
// distinta de la suma de sus trimestres, y el profesional tendría dos borradores que no cuadran.
//
// El invariante, que un test comprueba AL CÉNTIMO: cada casilla del 390 = Σ de su casilla en los
// cuatro 303, la 65 = Σ de las 46 y la 125 = Σ de las 122 (SCRUM-1077c).
//
// Lo que el 303 deja vacío (30/31, 64-71) sale vacío aquí, con su motivo. Lo que el 303 no supo
// colocar sale aquí declarado, con el trimestre del que viene.
//
// ⚠️ REGLA 24 · se construye, no se enciende. Y REGLA 38 · esto es LECTURA: no toca el camino de
// emisión ni escribe nada. Sin ruta y sin pantalla: su texto pide firma (regla 39).
import {
  AVISO_ORIENTATIVO, type Modelo303, type OperacionSinClasificar, type GastoSinClasificar,
  type OperacionInversionSujetoPasivo,
} from '../modelo303/modelo303';
import {
  PRIMER_EJERCICIO_DEL_IMPRESO, FUENTE_390, TRIPLETAS_DEVENGADO_390,
  CASILLAS_TOTAL_DEVENGADO_390, CASILLA_TOTAL_CUOTAS_Y_RECARGO_390,
  CASILLAS_DEDUCIBLE_CORRIENTES_390, CASILLAS_DEDUCIBLE_BIENES_INVERSION_390,
  CASILLA_SUMA_DEDUCCIONES_390, CASILLA_RESULTADO_REGIMEN_GENERAL_390, CASILLAS_SIN_RELLENAR_390,
  CASILLA_INVERSION_SUJETO_PASIVO_390,
} from './casillas';

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface Casilla390 {
  casilla: string;
  valor: number;
}

export interface FilaDevengado390 {
  tipo: number;
  base: Casilla390;
  cuota: Casilla390;
}

/** Lo que cada trimestre aporta, para que el anual se pueda cotejar contra sus cuatro 303. */
export interface TrimestreDel390 {
  trimestre: number;
  /** La 27, la 45 y la 46 de ese 303. */
  cuotaDevengada: number;
  totalADeducir: number;
  resultado: number;
  miradas: number;
  asientos: number;
}

/**
 * Avisos fijos, como códigos (el texto que vea el profesional pide firma, regla 39):
 * · `rectificativas_sin_casilla_propia` — el libro no distingue una rectificativa de otra factura:
 *   si la hay, va a la fila de su tipo, no a la 29/30 de «Modificación de bases y cuotas». Cómo
 *   entra lo dice el asesor (aceptación 5 de SCRUM-1077).
 * · `bienes_de_inversion_no_incluidos` — 50/51 vacías: `Expense` no los distingue.
 */
export type Aviso390 = 'rectificativas_sin_casilla_propia' | 'bienes_de_inversion_no_incluidos';

export interface Modelo390 {
  año: number;
  /** El año en curso (hora de Madrid) aún no ha terminado: el borrador es provisional. */
  provisional: boolean;
  fuente: string;
  moneda: string;
  devengado: {
    porTipo: FilaDevengado390[];
    /** 33/34. */
    totalBase: Casilla390;
    totalCuota: Casilla390;
    /** 47. Hoy = 34: el recargo no se rellena. */
    totalCuotasYRecargo: Casilla390;
  };
  deducible: {
    /** 48/49 = Σ 28/29 del 303. Sin el desglose por tipo, y `sinDesglosePorque` lo dice. */
    corrientes: { base: Casilla390; cuota: Casilla390; sinDesglosePorque: 'el_303_no_desglosa_el_soportado_por_tipo' };
    /** 50/51, siempre a cero, como la 30/31 del 303. */
    bienesDeInversion: { base: Casilla390; cuota: Casilla390; vaciaPorque: 'sin_dato_de_bien_de_inversion' };
    /** 64 = Σ 45 del 303. */
    sumaDeducciones: Casilla390;
  };
  /** 65 = 47 − 64. */
  resultadoRegimenGeneral: Casilla390;
  sinRellenar: { casillas: readonly string[]; porque: 'el_303_deja_vacias_de_la_64_a_la_71' };
  /**
   * SCRUM-1077c · «10. Volumen de operaciones»: sólo la 125 = Σ de las cuatro 122 del 303
   * (c.20833). Sin cuota: no suma en la liquidación. La 99 y la 108 no se rellenan.
   */
  volumenDeOperaciones: {
    inversionSujetoPasivo: { casilla: string; base: number; operaciones: (OperacionInversionSujetoPasivo & { trimestre: number })[] };
  };
  trimestres: TrimestreDel390[];
  sinClasificar: (OperacionSinClasificar & { trimestre: number })[];
  sinDesglose: { trimestre: number; numero: string }[];
  gastosSinClasificar: (GastoSinClasificar & { trimestre: number })[];
  miradas: number;
  asientos: number;
  avisos: Aviso390[];
  /** Los de cada 303 con su trimestre delante («T2: …»), más `año_en_curso` si toca. */
  motivosParaNoFiarse: string[];
  avisoObligatorio: string;
}

/** El año natural en Madrid. A las 00:30 del 1 de enero en Madrid ya es el año nuevo, aunque en UTC no. */
export function añoEnMadrid(ahora: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', year: 'numeric' }).format(ahora));
}

/**
 * Construye el 390 de un año a partir de sus cuatro 303.
 *
 * Exige los cuatro, uno por trimestre y del mismo año: un anual con tres trimestres no es un 390
 * con un cero, es otro documento. Un trimestre sin actividad llega igual, como un 303 a cero.
 */
export function construirModelo390(params: { año: number; trimestres: Modelo303[]; ahora: Date }): Modelo390 {
  if (params.año < PRIMER_EJERCICIO_DEL_IMPRESO) {
    throw new Error(`modelo390_sin_impreso_citado: el impreso leído se aplica desde el ejercicio ${PRIMER_EJERCICIO_DEL_IMPRESO}`);
  }
  const vistos = new Set(params.trimestres.map((t) => t.trimestre));
  if (params.trimestres.length !== 4 || vistos.size !== 4
      || params.trimestres.some((t) => t.año !== params.año || t.trimestre < 1 || t.trimestre > 4)) {
    throw new Error('modelo390_trimestres_incompletos: hacen falta los cuatro 303 del mismo año, uno por trimestre');
  }
  const ordenados = [...params.trimestres].sort((a, b) => a.trimestre - b.trimestre);

  const devengadoPorTipo = new Map<number, { base: number; cuota: number }>();
  let base28 = 0;
  let cuota29 = 0;
  let suma45 = 0;
  let base125 = 0;
  const operaciones125: Modelo390['volumenDeOperaciones']['inversionSujetoPasivo']['operaciones'] = [];
  let miradas = 0;
  let asientos = 0;
  const sinClasificar: Modelo390['sinClasificar'] = [];
  const sinDesglose: Modelo390['sinDesglose'] = [];
  const gastosSinClasificar: Modelo390['gastosSinClasificar'] = [];
  const motivosParaNoFiarse: string[] = [];

  for (const t of ordenados) {
    for (const c of t.casillas) {
      const acc = devengadoPorTipo.get(c.tipo) ?? { base: 0, cuota: 0 };
      acc.base += c.base;
      acc.cuota += c.cuota;
      devengadoPorTipo.set(c.tipo, acc);
    }
    base28 += t.ivaDeducible.corrientes.base;
    cuota29 += t.ivaDeducible.corrientes.cuota;
    suma45 += t.ivaDeducible.casillaTotalADeducir.valor;
    miradas += t.miradas;
    asientos += t.asientos;
    for (const s of t.sinClasificar) sinClasificar.push({ ...s, trimestre: t.trimestre });
    // SCRUM-1077c · la S2 que el 303 pone en su 122 va a la 125 del 390 (c.20833), y deja de ir sin
    // clasificar. La S2 que el 303 deja FUERA de la 122 (la que trae cuota) sigue en su «sin
    // clasificar», y llega aquí por la línea de arriba.
    base125 += t.informacionAdicional.inversionSujetoPasivo.base;
    for (const o of t.informacionAdicional.inversionSujetoPasivo.operaciones) operaciones125.push({ ...o, trimestre: t.trimestre });
    for (const numero of t.sinDesglose) sinDesglose.push({ trimestre: t.trimestre, numero });
    for (const g of t.ivaDeducible.sinClasificar) gastosSinClasificar.push({ ...g, trimestre: t.trimestre });
    for (const m of t.motivosParaNoFiarse) motivosParaNoFiarse.push(`T${t.trimestre}: ${m}`);
  }

  const porTipo: FilaDevengado390[] = TRIPLETAS_DEVENGADO_390.map((f) => {
    const v = devengadoPorTipo.get(f.tipo) ?? { base: 0, cuota: 0 };
    return { tipo: f.tipo, base: { casilla: f.base, valor: r2(v.base) }, cuota: { casilla: f.cuota, valor: r2(v.cuota) } };
  });
  const totalBase = r2(porTipo.reduce((a, f) => a + f.base.valor, 0));
  const totalCuota = r2(porTipo.reduce((a, f) => a + f.cuota.valor, 0));
  const total47 = totalCuota;
  const total64 = r2(suma45);

  const provisional = params.año >= añoEnMadrid(params.ahora);
  if (provisional) motivosParaNoFiarse.push('año_en_curso');

  return {
    año: params.año,
    provisional,
    fuente: FUENTE_390,
    moneda: ordenados[0].moneda,
    devengado: {
      porTipo,
      totalBase: { casilla: CASILLAS_TOTAL_DEVENGADO_390.base, valor: totalBase },
      totalCuota: { casilla: CASILLAS_TOTAL_DEVENGADO_390.cuota, valor: totalCuota },
      totalCuotasYRecargo: { casilla: CASILLA_TOTAL_CUOTAS_Y_RECARGO_390, valor: total47 },
    },
    deducible: {
      corrientes: {
        base: { casilla: CASILLAS_DEDUCIBLE_CORRIENTES_390.base, valor: r2(base28) },
        cuota: { casilla: CASILLAS_DEDUCIBLE_CORRIENTES_390.cuota, valor: r2(cuota29) },
        sinDesglosePorque: 'el_303_no_desglosa_el_soportado_por_tipo',
      },
      bienesDeInversion: {
        base: { casilla: CASILLAS_DEDUCIBLE_BIENES_INVERSION_390.base, valor: 0 },
        cuota: { casilla: CASILLAS_DEDUCIBLE_BIENES_INVERSION_390.cuota, valor: 0 },
        vaciaPorque: 'sin_dato_de_bien_de_inversion',
      },
      sumaDeducciones: { casilla: CASILLA_SUMA_DEDUCCIONES_390, valor: total64 },
    },
    resultadoRegimenGeneral: { casilla: CASILLA_RESULTADO_REGIMEN_GENERAL_390, valor: r2(total47 - total64) },
    sinRellenar: { casillas: CASILLAS_SIN_RELLENAR_390, porque: 'el_303_deja_vacias_de_la_64_a_la_71' },
    volumenDeOperaciones: {
      inversionSujetoPasivo: { casilla: CASILLA_INVERSION_SUJETO_PASIVO_390, base: r2(base125), operaciones: operaciones125 },
    },
    trimestres: ordenados.map((t) => ({
      trimestre: t.trimestre,
      cuotaDevengada: t.casillaTotalCuota.valor,
      totalADeducir: t.ivaDeducible.casillaTotalADeducir.valor,
      resultado: t.resultadoRegimenGeneral.valor,
      miradas: t.miradas,
      asientos: t.asientos,
    })),
    sinClasificar,
    sinDesglose,
    gastosSinClasificar,
    miradas,
    asientos,
    avisos: ['rectificativas_sin_casilla_propia', 'bienes_de_inversion_no_incluidos'],
    motivosParaNoFiarse,
    avisoObligatorio: AVISO_ORIENTATIVO,
  };
}
