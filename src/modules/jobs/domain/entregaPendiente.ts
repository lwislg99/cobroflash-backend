// src/modules/jobs/domain/entregaPendiente.ts — SCRUM-305 (C6)
//
// «QUEDAN 3»: QUÉ FALTA POR ENTREGAR contra el presupuesto firmado.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ ESTO NO ES `albaranFacturacion.ts`, Y NO SE REUTILIZA POR PARECERSE
//
// `pendientePorLinea` responde a otra pregunta: **cuánto de lo servido queda por FACTURAR**. Este
// módulo responde **cuánto de lo presupuestado queda por ENTREGAR**. Son dos ejes distintos del
// mismo trabajo —lo dice el propio comentario de SCRUM-367: el libro de facturación «está al lado
// equivocado del ciclo: da lo FACTURADO, no lo PRESUPUESTADO»— y mezclarlos sería volver a tener
// dos fuentes de verdad para dos preguntas que no se contestan igual.
//
// Por eso la aritmética está escrita aquí entera y este fichero NO importa nada de facturación.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LAS TRES DECISIONES DEL ASESOR (5-ago-2026), Y POR QUÉ CADA UNA
//
// ① CONTRA EL ORIGINAL. Y si el Trabajo tiene presupuestos ADICIONALES, aquí NO SALE NÚMERO.
//    `quoteLineIndex` significa hoy, de facto, «índice en el presupuesto original»: así lo valida
//    `contarLineasDePresupuesto` y así lo escribe el prellenado. Es coherente por el CAMINO, no
//    por el DATO — el índice no dice de qué presupuesto es.
//    Un «quedan 3» calculado solo contra el original en un Trabajo con adicionales es un número
//    FALSO **en la dirección peligrosa**: dice que queda MENOS de lo que queda, y el profesional
//    cierra la obra creyendo que lo ha entregado todo. Mejor no contestar que contestar mal.
//    Para levantarlo haría falta que el índice supiera de qué presupuesto es — eso es ESQUEMA,
//    territorio del fundador, y es el paso 2 de SCRUM-195. Aquí no se propone ni se construye.
//
// ② UNA LÍNEA SIN ÍNDICE NO SE CUENTA, Y SE DICE CUÁNTAS SON. Ese hueco significa hoy tres cosas
//    a la vez —añadida en obra, albarán VALORADO, o tecleada a mano— y este módulo no puede
//    distinguirlas, así que no finge que sí: no se atribuyen a ninguna línea del presupuesto.
//
//    🔴 LA REGLA, que vale para A5 y A6 igual que aquí: **un número que resume tiene que declarar
//    lo que no pudo contar.** Si no, el resumen no dice «quedan 3»: dice «quedan 3 y no ha pasado
//    nada más», que es una afirmación que nadie ha comprobado. Por eso el número NUNCA sale solo.
//
// ③ EL NÚMERO VA DESNUDO, SIN UNIDAD. Medido: la línea de presupuesto (`{concept, qty, price,
//    tax}`) no tiene campo de unidad; la del albarán la EXIGE, el prellenado mete `'ud'` por
//    defecto y es editable por línea. Así que la unidad del albarán no es la del sistema: es texto
//    libre que el profesional puede cambiar sin que nada se entere. «Quedan 3», nunca «quedan 3
//    metros». Ponerle unidad a esa frase es una decisión de modelo y no es de este ticket.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ CUENTA COMO ENTREGADO: SOLO LO FIRMADO
//
// Un albarán en borrador no es una entrega, y uno emitido es una entrega que el cliente todavía no
// ha confirmado. Contar de más encoge el «quedan», que es **la dirección peligrosa** que la
// decisión ① nombra. Contar de menos solo molesta.
//
// Y lo no contado no se calla: las líneas que viven en partes sin firmar viajan en el informe con
// su propio recuento, por la misma regla de ②.

/** Línea de presupuesto, tal y como vive en `Quote.lines` (Json). */
export interface LineaPresupuesto {
  concept?: unknown;
  qty?: unknown;
}

/** Albarán del Trabajo, con lo justo para decidir si cuenta y qué aporta. */
export interface AlbaranParaEntrega {
  estado: string;
  modoValoracion: string;
  lineas: unknown;
}

export interface LineaEntrega {
  /** Índice en el presupuesto ORIGINAL. Es la clave del enlace (SCRUM-367). */
  quoteLineIndex: number;
  concepto: string;
  presupuestada: number;
  entregada: number;
  /** Nunca negativo: entregar de más no es «quedan -2», es «no queda nada». */
  pendiente: number;
}

export type MotivoSinNumero = 'hay_adicionales' | 'sin_presupuesto' | 'nada_atribuible';

/**
 * Lo que NO se ha podido contar. Viaja SIEMPRE, con número y sin él: es la mitad que convierte un
 * resumen en una afirmación comprobable.
 */
export interface NoContado {
  /** Líneas de albaranes FIRMADOS que no llevan enlace con el presupuesto. */
  sinAtribuir: number;
  /** Líneas que viven en partes aún sin firmar: entregadas o no, hoy no cuentan. */
  enPartesSinFirmar: number;
  /** Cuántos de esos partes están en modo VALORADO, donde el enlace NUNCA se escribe. */
  albaranesValorados: number;
}

export type ResumenEntrega =
  | ({ calculable: false; motivo: MotivoSinNumero } & NoContado)
  | ({ calculable: true; lineas: LineaEntrega[]; pendienteTotal: number } & NoContado);

/** Tres decimales: las unidades de obra se sirven fraccionadas (horas, m², kg). */
function red3(n: number): number {
  return Math.round((Number(n) || 0) * 1000) / 1000;
}

function lineasDe(a: AlbaranParaEntrega): any[] {
  return Array.isArray(a.lineas) ? (a.lineas as any[]) : [];
}

/** El enlace, solo si es utilizable: entero ≥ 0. Cualquier otra cosa es «sin atribuir». */
function enlaceDe(linea: any): number | null {
  const v = linea?.quoteLineIndex;
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
}

/**
 * Qué falta por entregar del presupuesto ORIGINAL de un Trabajo.
 *
 * `hayAdicionales` lo decide quien llama, leyendo `Quote.jobId` (SCRUM-195): aquí no se consulta
 * nada. Puro: mismas entradas, mismo informe, sin base de datos.
 */
export function resumenEntrega(params: {
  lineasPresupuestoOriginal: LineaPresupuesto[] | null;
  hayAdicionales: boolean;
  albaranes: AlbaranParaEntrega[];
}): ResumenEntrega {
  const albaranes = Array.isArray(params.albaranes) ? params.albaranes : [];
  const firmados = albaranes.filter((a) => a.estado === 'firmado');
  const sinFirmar = albaranes.filter((a) => a.estado !== 'firmado');

  // Lo no contado se calcula SIEMPRE, incluso cuando no hay número: es lo que permite que la
  // pantalla diga «no puedo contestar, y además hay 4 líneas que no sabría atribuir».
  const noContado: NoContado = {
    sinAtribuir: firmados.reduce((n, a) => n + lineasDe(a).filter((l) => enlaceDe(l) === null).length, 0),
    enPartesSinFirmar: sinFirmar.reduce((n, a) => n + lineasDe(a).length, 0),
    albaranesValorados: albaranes.filter((a) => a.modoValoracion === 'VALORADO').length,
  };

  // ① Con adicionales no se contesta. Es la primera puerta a propósito: da igual lo bien que
  //    cuadre todo lo demás, el número saldría mal en la dirección peligrosa.
  if (params.hayAdicionales) return { calculable: false, motivo: 'hay_adicionales', ...noContado };

  const presupuesto = Array.isArray(params.lineasPresupuestoOriginal) ? params.lineasPresupuestoOriginal : null;
  if (!presupuesto || presupuesto.length === 0) {
    return { calculable: false, motivo: 'sin_presupuesto', ...noContado };
  }

  // ② Si hay entregas firmadas y NINGUNA lleva enlace, no hay nada que atribuir: el número diría
  //    «queda todo» sobre una obra en la que se ha entregado. Es el caso del albarán VALORADO,
  //    donde el enlace no se escribe nunca.
  const conEnlace = firmados.reduce((n, a) => n + lineasDe(a).filter((l) => enlaceDe(l) !== null).length, 0);
  if (noContado.sinAtribuir > 0 && conEnlace === 0) {
    return { calculable: false, motivo: 'nada_atribuible', ...noContado };
  }

  const entregadoPorLinea = new Map<number, number>();
  for (const a of firmados) {
    for (const l of lineasDe(a)) {
      const i = enlaceDe(l);
      if (i === null) continue;
      entregadoPorLinea.set(i, red3((entregadoPorLinea.get(i) || 0) + (Number(l?.cantidad) || 0)));
    }
  }

  const lineas: LineaEntrega[] = presupuesto.map((l, quoteLineIndex) => {
    const presupuestada = red3(Number(l?.qty) || 0);
    const entregada = red3(entregadoPorLinea.get(quoteLineIndex) || 0);
    return {
      quoteLineIndex,
      concepto: String(l?.concept || '').trim(),
      presupuestada,
      entregada,
      pendiente: red3(Math.max(0, presupuestada - entregada)),
    };
  });

  return {
    calculable: true,
    lineas,
    pendienteTotal: red3(lineas.reduce((t, l) => t + l.pendiente, 0)),
    ...noContado,
  };
}

/**
 * Los textos que vería el profesional. TODOS SIN APROBAR (regla 30): van con marcador hasta que el
 * asesor los firme, y ninguno se inventa aquí.
 *
 * Viven junto al mecanismo —y no en una vista— porque cada uno explica un MOTIVO de este módulo:
 * separarlos dejaría el código de los motivos sin su frase y la frase sin su condición. Mismo sitio
 * que `COPY_ADMIN_SIN_LINEAS` en `lineasFacturables.ts`.
 */
export const COPY_ENTREGA = {
  hay_adicionales: '[PENDIENTE microcopy oficial] Este trabajo tiene presupuestos adicionales, así que todavía no se puede decir qué queda por entregar.',
  sin_presupuesto: '[PENDIENTE microcopy oficial] Este trabajo no tiene presupuesto con el que comparar lo entregado.',
  nada_atribuible: '[PENDIENTE microcopy oficial] Las líneas entregadas no están enlazadas con el presupuesto, así que no se puede calcular qué queda.',
  sinAtribuir: '[PENDIENTE microcopy oficial] líneas entregadas que no se han podido atribuir al presupuesto',
  enPartesSinFirmar: '[PENDIENTE microcopy oficial] líneas en partes sin firmar, que todavía no cuentan como entregadas',
} as const;
