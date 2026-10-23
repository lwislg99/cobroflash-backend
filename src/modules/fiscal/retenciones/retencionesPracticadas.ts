// src/modules/fiscal/retenciones/retencionesPracticadas.ts — SCRUM-1066c · el BORRADOR del 111 y del 115.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ ES Y QUÉ NO
//
// Las retenciones que el profesional PRACTICA al pagar (SCRUM-1103: `Expense.retencionPractic…`),
// sumadas por trimestre y colocadas en la casilla del impreso oficial (procedencia: `casillas.ts`).
// Es un borrador para el asesor (D2, SCRUM-1066 c.16699): no presenta nada, no dice que se pueda
// presentar y no lleva texto de pantalla. Lo que no se puede colocar con el dato que hay NO se
// coloca en la casilla más probable: se declara en `sinClasificar`, con su dinero.
//
// El invariante, que un test comprueba al céntimo:
//
//     Σ cuota de los gastos con retención anotada = retenciones del 111 + del 115 + sin clasificar
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL 111 Y EL 115 SE SEPARAN POR EL DATO, Y HOY EL DATO SÓLO ALCANZA AL 111
//
// Nada en `Expense` dice que un gasto sea el ALQUILER de un inmueble (su `category` es
// materiales|desplazamiento|herramientas|subcontrata|otros). Lo único que hay es el tipo de
// retención guardado:
//   · 15 % y 7 % — los tipos de la actividad PROFESIONAL (RIRPF art. 95.1, citado en
//     `docs/producto/CONTABILIDAD.md` §3) → actividades económicas del 111.
//   · 19 % — el del alquiler (RIRPF art. 100, verificado en SCRUM-1066b), pero NO sólo el del
//     alquiler: meterlo en el 115 sería clasificar por el tipo, no por el dato.
// Decisión A del orquestador (22-oct-2026): el 19 % y cualquier otro tipo quedan SIN CLASIFICAR,
// y el 115 sale a cero con `vacioPorque`. El dato que lo arreglaría (una categoría «alquiler») es
// esquema: propuesta para el fundador, no construida.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// REGLA 38 · esto es LECTURA. No toca el camino de emisión: no compone, no sella, no escribe.
import { AVISO_ORIENTATIVO, rangoTrimestre } from '../modelo303/modelo303';
import {
  CASILLAS_111_ACTIVIDADES_DINERARIAS, CASILLA_111_SUMA_RETENCIONES,
  CASILLA_111_A_DEDUCIR, CASILLA_111_RESULTADO,
  CASILLAS_115, FUENTE_111, FUENTE_115,
} from './casillas';

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Tipos (en %) que se colocan en «actividades económicas» del 111. Procedencia: arriba. */
export const TIPOS_111_ACTIVIDADES: ReadonlySet<number> = new Set([15, 7]);
/** Tipos que se colocan en el 115. VACÍO por la decisión A: ningún dato dice «alquiler». */
export const TIPOS_115: ReadonlySet<number> = new Set<number>();

/** Las columnas de `Expense` que este borrador lee. */
export interface GastoConRetencion {
  id: number;
  merchantId: number;
  date: Date | string;
  providerId: number | null;
  currency?: string | null;
  baseAmount: unknown;
  retencionPracticadaTipo: number | null;
  retencionPracticadaCuota: unknown;
  retencionPracticadaDeclarada: boolean | null;
}

export type MotivoSinClasificar =
  | 'tipo_sin_modelo'   // un tipo que no separa el 111 del 115 con el dato que hay (el 19 % incluido)
  | 'sin_tipo'          // hay cuota y no hay tipo: no se sabe a qué modelo va
  | 'sin_cuota'         // hay tipo y no hay cuota: la cuota se guarda, no se recalcula
  | 'sin_base'          // sin base no hay «importe de las percepciones»
  | 'sin_perceptor'     // sin proveedor no se puede contar el «nº de perceptores»
  | 'importe_ilegible'; // base o cuota que no es un número

export interface GastoSinClasificar {
  id: number;
  tipo: number | null;
  base: number | null;
  cuota: number | null;
  motivo: MotivoSinClasificar;
}

export interface Casilla { casilla: string; valor: number }

export interface Borrador111 {
  fuente: string;
  actividadesEconomicasDinerarias: { perceptores: Casilla; importe: Casilla; retenciones: Casilla };
  sumaRetenciones: Casilla;
  /** 29: sólo en complementaria, que no está construida → 0. */
  aDeducir: Casilla;
  /** 30 = 28 − 29. */
  resultado: Casilla;
}

export interface Borrador115 {
  fuente: string;
  perceptores: Casilla;
  base: Casilla;
  retenciones: Casilla;
  /** 4: sólo en complementaria → 0. */
  aDeducir: Casilla;
  /** 5 = 3 − 4. */
  resultado: Casilla;
  /** Por qué sale a cero cuando no hay nada colocado. Un cero sin motivo se leería «no pagó alquiler». */
  vacioPorque: 'sin_dato_de_arrendamiento' | null;
}

/**
 * Motivos, como CÓDIGOS y no como frases: el texto que ve el usuario necesita firma (regla 39) y
 * esto no lo pinta nadie todavía.
 */
export type MotivoParaNoFiarse =
  | 'gastos_sin_clasificar'       // algo con retención no entra en ninguna casilla
  | 'ninguna_retencion_anotada';  // hay gastos y ninguno dice si llevó retención: el cero no informa

export interface BorradorRetenciones {
  año: number;
  trimestre: number;
  desde: string;
  hasta: string;
  moneda: string;
  modelo111: Borrador111;
  modelo115: Borrador115;
  sinClasificar: GastoSinClasificar[];
  /** Gastos del periodo examinados. Cero con `miradas: 0` es un trimestre sin gastos. */
  miradas: number;
  /** Gastos con tipo 0 o `declarada === false`: se decidió que NO llevan retención. */
  sinRetencion: number;
  /** Gastos sin tipo, sin cuota y sin decidir: nadie dijo si llevaron retención. */
  sinDatoDeRetencion: number;
  motivosParaNoFiarse: MotivoParaNoFiarse[];
  avisoObligatorio: string;
}

/** Un importe de Prisma (Decimal, string o number) a número, o `null` si no lo es. */
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(typeof v === 'object' ? String(v) : v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Construye el borrador del 111 y del 115 de UN merchant para UN trimestre.
 *
 * Los `gastos` tienen que venir ya acotados al periodo (lo hace `leerBorradorRetenciones`):
 * filtrar aquí sería un segundo criterio de fechas. Un gasto de otro merchant NO se descarta en
 * silencio: rompe (regla 2).
 */
export function construirBorradorRetenciones(params: {
  gastos: GastoConRetencion[];
  merchantId: number;
  año: number;
  trimestre: number;
}): BorradorRetenciones {
  const { desde, hasta } = rangoTrimestre(params.año, params.trimestre);
  const sinClasificar: GastoSinClasificar[] = [];
  const perceptores111 = new Set<number>();
  const perceptores115 = new Set<number>();
  let importe111 = 0, cuota111 = 0, base115 = 0, cuota115 = 0;
  let sinRetencion = 0, sinDatoDeRetencion = 0;
  let moneda = 'EUR';

  for (const g of params.gastos) {
    if (g.merchantId !== params.merchantId) {
      throw new Error(`🔴 SCRUM-1066c · un gasto del merchant ${g.merchantId} ha llegado al borrador del ${params.merchantId} (regla 2).`);
    }
    if (g.currency) moneda = g.currency;
    const tipo = g.retencionPracticadaTipo;
    const cuotaCruda = g.retencionPracticadaCuota;
    const cuota = num(cuotaCruda);
    const base = num(g.baseAmount);
    const aparte = (motivo: MotivoSinClasificar) =>
      sinClasificar.push({ id: g.id, tipo, base, cuota, motivo });

    if (tipo === 0 || g.retencionPracticadaDeclarada === false) { sinRetencion += 1; continue; }
    const hayCuota = cuotaCruda !== null && cuotaCruda !== undefined;
    if (tipo === null && !hayCuota) { sinDatoDeRetencion += 1; continue; }
    if (hayCuota && cuota === null) { aparte('importe_ilegible'); continue; }
    if (tipo === null) { aparte('sin_tipo'); continue; }
    if (cuota === null) { aparte('sin_cuota'); continue; }

    const a111 = TIPOS_111_ACTIVIDADES.has(tipo);
    const a115 = TIPOS_115.has(tipo);
    if (!a111 && !a115) { aparte('tipo_sin_modelo'); continue; }
    if (g.baseAmount !== null && g.baseAmount !== undefined && base === null) { aparte('importe_ilegible'); continue; }
    if (base === null) { aparte('sin_base'); continue; }
    if (g.providerId === null || g.providerId === undefined) { aparte('sin_perceptor'); continue; }

    if (a111) {
      perceptores111.add(g.providerId);
      importe111 += base;
      cuota111 += cuota;
    } else {
      perceptores115.add(g.providerId);
      base115 += base;
      cuota115 += cuota;
    }
  }

  const c111 = CASILLAS_111_ACTIVIDADES_DINERARIAS;
  const retenciones111 = r2(cuota111);
  const motivos: MotivoParaNoFiarse[] = [];
  if (sinClasificar.length > 0) motivos.push('gastos_sin_clasificar');
  if (params.gastos.length > 0 && sinDatoDeRetencion === params.gastos.length) motivos.push('ninguna_retencion_anotada');

  return {
    año: params.año,
    trimestre: Math.min(4, Math.max(1, Math.trunc(params.trimestre) || 1)),
    desde: desde.toISOString(),
    hasta: hasta.toISOString(),
    moneda,
    modelo111: {
      fuente: FUENTE_111,
      actividadesEconomicasDinerarias: {
        perceptores: { casilla: c111.perceptores, valor: perceptores111.size },
        importe: { casilla: c111.importe, valor: r2(importe111) },
        retenciones: { casilla: c111.retenciones, valor: retenciones111 },
      },
      // Hoy sólo se rellena un bloque, así que la suma es ese bloque. Los demás sumandos del
      // impreso (trabajo, premios…) no tienen dato en YaQu: van a cero, y `casillas.ts` lo dice.
      sumaRetenciones: { casilla: CASILLA_111_SUMA_RETENCIONES, valor: retenciones111 },
      aDeducir: { casilla: CASILLA_111_A_DEDUCIR, valor: 0 },
      resultado: { casilla: CASILLA_111_RESULTADO, valor: retenciones111 },
    },
    modelo115: {
      fuente: FUENTE_115,
      perceptores: { casilla: CASILLAS_115.perceptores, valor: perceptores115.size },
      base: { casilla: CASILLAS_115.base, valor: r2(base115) },
      retenciones: { casilla: CASILLAS_115.retenciones, valor: r2(cuota115) },
      aDeducir: { casilla: CASILLAS_115.aDeducir, valor: 0 },
      resultado: { casilla: CASILLAS_115.resultado, valor: r2(cuota115) },
      vacioPorque: perceptores115.size === 0 && TIPOS_115.size === 0 ? 'sin_dato_de_arrendamiento' : null,
    },
    sinClasificar,
    miradas: params.gastos.length,
    sinRetencion,
    sinDatoDeRetencion,
    motivosParaNoFiarse: motivos,
    avisoObligatorio: AVISO_ORIENTATIVO,
  };
}
