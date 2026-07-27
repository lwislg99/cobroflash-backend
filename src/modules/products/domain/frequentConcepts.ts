// src/modules/products/domain/frequentConcepts.ts
//
// SCRUM-162 — «tus conceptos más usados», derivados de los presupuestos REALES del merchant.
//
// POR QUÉ ESTO NO EXISTÍA (y por qué ahora sí puede existir)
// ---------------------------------------------------------
// SCRUM-139 F6 dejó fuera la mitad de «conceptos frecuentes» a propósito: no había ninguna
// señal de frecuencia en el esquema, así que «los más usados» solo podía salir de inventarse
// un criterio (¿los últimos creados? ¿los primeros por id?) y presentárselo al pro como si
// fuera su historial. Eso es mentirle sobre sus propios datos.
//
// La señal SÍ existe, solo que no en una columna: está en `Quote.lines`. Medido en producción
// (27-jul-2026) antes de construir nada: 124 presupuestos, y tres merchants reales con entre
// 12 y 29 conceptos distintos de los que 3, 4 y 6 se repiten en tres presupuestos o más. Para
// ellos «tus más usados» es verdad. Los otros cinco no llegan, y a esos NO se les enseña nada
// — ver `MIN_CONCEPTOS`, que es la regla que salva el motivo original de no construirlo.
//
// La otra mitad del ticket (`QuoteTemplate.usageCount`, con schema) se cerró como GATE NO
// CUMPLIDO con los números delante: solo 3 merchants tienen plantillas (5, 3 y 3), y F6 ya
// pinta hasta 3 como fichas de un toque, así que ordenarlas por uso no cambiaría nada para
// dos de los tres. Una columna nueva no se paga con eso.
//
// PURO A PROPÓSITO: recibe los presupuestos ya leídos y no toca Prisma. La consulta (y su
// filtro por `merchantId`, regla 2) vive en la ruta.

/** Ventana por defecto. Ver nota de `conceptosFrecuentes` sobre por qué hoy da igual. */
export const VENTANA_DIAS = 90;
/** Un concepto es «usado» si aparece en al menos estos presupuestos DISTINTOS. */
export const MIN_USOS = 3;
/** Si no hay al menos estos conceptos que superen `MIN_USOS`, no se enseña NADA. */
export const MIN_CONCEPTOS = 3;
/** Cuántos se devuelven como máximo. */
export const TOP = 5;

export interface ConceptoFrecuente {
  /** Tal y como lo escribe el pro (la grafía que más usa él, no la primera que se vio). */
  concepto: string;
  /** En cuántos presupuestos DISTINTOS aparece. */
  usos: number;
}

interface PresupuestoParaContar {
  lines: unknown;
  createdAt: Date | string;
}

/** Clave de agrupación: mismo concepto escrito con otras mayúsculas o espacios es el mismo. */
function clave(texto: string): string {
  return texto.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Los conceptos que el merchant repite de verdad, más usados primero.
 *
 * SE CUENTA POR PRESUPUESTO, NO POR LÍNEA. Un presupuesto con cinco renglones de «mano de
 * obra» dice que ese día se desglosó mucho, no que sea un concepto habitual; contar líneas
 * dejaría que un solo presupuesto detallado inventara un «más usado». Medido en producción
 * con las dos definiciones antes de elegir: los tres merchants con señal la conservan igual.
 *
 * VENTANA: hoy los 124 presupuestos de producción son de los últimos 90 días, así que
 * `ventanaDias` no cambia el resultado se ponga lo que se ponga. Se deja explícita y
 * documentada para que el día que haya dato más viejo la decisión ya esté tomada y no se
 * descubra tarde que «frecuente» significaba «de siempre»: un fontanero que dejó de hacer
 * calderas no quiere calderas arriba para siempre.
 *
 * @returns lista vacía si no hay señal suficiente — y vacío significa «no enseñes nada»,
 *          nunca «enseña lo que haya».
 */
export function conceptosFrecuentes(
  presupuestos: PresupuestoParaContar[],
  opciones: { ahora?: Date; ventanaDias?: number; minUsos?: number; minConceptos?: number; top?: number } = {},
): ConceptoFrecuente[] {
  const {
    ahora = new Date(),
    ventanaDias = VENTANA_DIAS,
    minUsos = MIN_USOS,
    minConceptos = MIN_CONCEPTOS,
    top = TOP,
  } = opciones;

  const corte = ahora.getTime() - ventanaDias * 24 * 60 * 60 * 1000;
  const usosPorClave = new Map<string, number>();
  const grafias = new Map<string, Map<string, number>>();

  for (const p of presupuestos) {
    const fecha = new Date(p.createdAt as any).getTime();
    if (!Number.isFinite(fecha) || fecha < corte) continue;
    const lineas = Array.isArray(p.lines) ? (p.lines as any[]) : [];

    const enEste = new Set<string>();
    for (const linea of lineas) {
      const texto = typeof linea?.concept === 'string' ? linea.concept : '';
      const k = clave(texto);
      if (!k) continue;
      enEste.add(k);
      // La grafía se cuenta por línea a propósito: para elegir CÓMO se escribe (no cuánto
      // se usa) manda la forma que el pro teclea más veces.
      if (!grafias.has(k)) grafias.set(k, new Map());
      const g = grafias.get(k)!;
      const original = texto.trim();
      g.set(original, (g.get(original) || 0) + 1);
    }
    for (const k of enEste) usosPorClave.set(k, (usosPorClave.get(k) || 0) + 1);
  }

  const frecuentes: ConceptoFrecuente[] = [];
  for (const [k, usos] of usosPorClave) {
    if (usos < minUsos) continue;
    const g = grafias.get(k)!;
    // Grafía ganadora: la más tecleada; a igualdad, la primera por orden alfabético para que
    // el resultado sea determinista (dos ejecuciones con los mismos datos dan lo mismo).
    const concepto = [...g.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    frecuentes.push({ concepto, usos });
  }

  // UMBRAL DE HONESTIDAD: con uno o dos conceptos repetidos no hay «tus más usados» que
  // enseñar — hay una lista corta que parecería un historial sin serlo. Es exactamente el
  // motivo por el que esto no se construyó en F6, y por eso el umbral no es configurable
  // desde la ruta: quien lo baje tiene que venir aquí y leer esto.
  if (frecuentes.length < minConceptos) return [];

  return frecuentes
    .sort((a, b) => b.usos - a.usos || a.concepto.localeCompare(b.concepto))
    .slice(0, top);
}
