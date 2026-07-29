// src/modules/reports/domain/desgloseEmpleado.ts — SCRUM-228
//
// EL DESGLOSE POR EMPLEADO DE INFORMES, CON UN INVARIANTE DURO:
//
//     suma de las filas por empleado + «sin asignar»  ===  el total de la pantalla, SIEMPRE
//
// Un informe cuyas partes no suman el total es peor que no tener informe: el fontanero lo abre,
// ve que no cuadra, y deja de fiarse de TODOS los números de la pantalla — incluidos los que sí
// son correctos. Por eso el reparto se hace aquí, sobre las MISMAS listas que producen el total,
// y como una PARTICIÓN: cada factura y cada gasto cae en exactamente un cubo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LAS DOS COSAS QUE PARECEN LA MISMA Y NO LO SON
//
// · `teamMemberId === null`  → **el PROPIETARIO**. Convención asentada del repo (SCRUM-52/109),
//   idéntica en `Quote.teamMemberId`, `Job.operarioId` y `Expense.teamMemberId`.
// · `Invoice.quoteId === null` → **no hay a quién atribuirlo**. `Invoice` no tiene ningún campo
//   de empleado (medido): la única vía es `quoteId → Quote.teamMemberId`. Sin presupuesto, no
//   hay vía.
//
// Meterlas en el mismo cubo etiquetaría los ingresos DEL PROPIETARIO como «sin asignar», que es
// un error de dinero en la cara del dueño del negocio. Son cubos distintos a propósito.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ CAE EN «SIN ASIGNAR», Y NO ES EL CASO RARO
//
// Toda factura nacida del flujo de Trabajos: `albaranes.routes.ts` y `recapitulativa.service.ts`
// fijan `quoteId: null` a pelo. Es justo el flujo donde el empleado SÍ se sabe (`Job.operarioId`),
// pero ese dato no viaja hasta la factura. Atarlo sería schema, y es otra decisión.
//
// El precedente de la casa hace lo contrario y es lo que este módulo NO copia: `getTeamMetrics`
// resuelve el hueco con `quoteId: { not: null }`, o sea DESCARTANDO en silencio lo que no sabe
// atribuir. Eso es exactamente lo que rompe la suma. → SCRUM-236.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ CÉNTIMOS ENTEROS Y NO EUROS EN COMA FLOTANTE
//
// El invariante tiene que ser EXACTO, no «cuadra salvo un céntimo». Sumar 0.1 + 0.2 en coma
// flotante ya no da 0.3, y la suma de partes redondeadas puede alejarse del total redondeado
// según cuántas filas haya. En céntimos enteros la partición cuadra por construcción y el test
// puede exigir igualdad estricta en vez de una tolerancia — que es donde se esconden los fallos.

/** Clave del propietario. `null` en BD; aquí 0, mismo convenio que `getTeamMetrics`. */
export const CLAVE_PROPIETARIO = 0;
/** Clave de lo que no se puede atribuir a nadie (factura sin presupuesto). */
export const CLAVE_SIN_ASIGNAR = -1;

// [PENDIENTE microcopy oficial] — el fundador aprueba el texto (regla 30). Hasta entonces este
// literal es provisional y NO debe copiarse a otras pantallas.
export const ETIQUETA_SIN_ASIGNAR = 'Sin asignar';

export interface FacturaDesglose {
  total: unknown;               // Decimal de Prisma, string o number
  quoteId: number | null;
  quote?: { teamMemberId: number | null } | null;
}
export interface GastoDesglose {
  amount: unknown;
  teamMemberId: number | null;
}
export interface MiembroDesglose {
  id: number;
  name: string;
}
export interface FilaDesglose {
  key: number;
  label: string;
  esPropietario: boolean;
  esSinAsignar: boolean;
  revenue: number;
  expenses: number;
  profit: number;
}

/** Euros (Decimal, string o number) → céntimos enteros. */
export function aCentimos(v: unknown): number {
  return Math.round(Number(v ?? 0) * 100);
}

const aEuros = (c: number): number => c / 100;

/**
 * Reparte ingresos y gastos por empleado. **Partición**: cada factura y cada gasto entra en
 * exactamente un cubo, así que la suma de las filas es el total por construcción.
 */
export function desglosarPorEmpleado(entrada: {
  invoices: FacturaDesglose[];
  expenses: GastoDesglose[];
  miembros: MiembroDesglose[];
  nombrePropietario: string;
}): { filas: FilaDesglose[]; totales: { revenue: number; expenses: number; profit: number } } {
  const { invoices, expenses, miembros, nombrePropietario } = entrada;

  const ingresos = new Map<number, number>();
  const gastos = new Map<number, number>();
  const suma = (m: Map<number, number>, k: number, c: number) => m.set(k, (m.get(k) ?? 0) + c);

  for (const inv of invoices) {
    // Sin presupuesto no hay vía a un empleado: NO se descarta, se hace visible.
    const key = inv.quoteId == null ? CLAVE_SIN_ASIGNAR : inv.quote?.teamMemberId ?? CLAVE_PROPIETARIO;
    suma(ingresos, key, aCentimos(inv.total));
  }
  for (const exp of expenses) {
    // Un gasto SIEMPRE tiene autor: `null` es el propietario, no «sin asignar» (SCRUM-109).
    suma(gastos, exp.teamMemberId ?? CLAVE_PROPIETARIO, aCentimos(exp.amount));
  }

  const fila = (key: number, label: string): FilaDesglose => {
    const r = ingresos.get(key) ?? 0;
    const g = gastos.get(key) ?? 0;
    return {
      key,
      label,
      esPropietario: key === CLAVE_PROPIETARIO,
      esSinAsignar: key === CLAVE_SIN_ASIGNAR,
      revenue: aEuros(r),
      expenses: aEuros(g),
      profit: aEuros(r - g),
    };
  };

  const filas = [fila(CLAVE_PROPIETARIO, nombrePropietario), ...miembros.map((m) => fila(m.id, m.name))];

  // La fila «sin asignar» solo aparece cuando tiene algo dentro. No es maquillaje: si no hay
  // nada sin atribuir, enseñarla vacía sugiere un problema que no existe. Cuando hay algo, va
  // SIEMPRE — aunque afee — porque es la única forma de que las partes sumen el total.
  const sinAsignar = fila(CLAVE_SIN_ASIGNAR, ETIQUETA_SIN_ASIGNAR);
  if (sinAsignar.revenue !== 0 || sinAsignar.expenses !== 0) filas.push(sinAsignar);

  // Los totales salen de las MISMAS listas, no de otra consulta. Si vinieran de otro sitio, el
  // invariante sería una coincidencia que se rompe el día que las dos consultas divergen.
  const totalR = invoices.reduce((a, i) => a + aCentimos(i.total), 0);
  const totalG = expenses.reduce((a, e) => a + aCentimos(e.amount), 0);

  return {
    filas,
    totales: { revenue: aEuros(totalR), expenses: aEuros(totalG), profit: aEuros(totalR - totalG) },
  };
}
