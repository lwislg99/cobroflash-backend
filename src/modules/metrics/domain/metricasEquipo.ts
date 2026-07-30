// src/modules/metrics/domain/metricasEquipo.ts — SCRUM-236
//
// EL ENSAMBLADO DEL PANEL «Rendimiento del equipo», extraído a función PURA.
//
// Por qué se extrae: el invariante que este ticket viene a garantizar —las filas más «Sin
// asignar» suman el total, exacto— no se puede probar sin BD mientras viva dentro de
// `getTeamMetrics`, que abre cuatro consultas. Extraído, se prueba con céntimos enteros y sin
// tolerancia, igual que hizo SCRUM-228 con `desgloseEmpleado.ts`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE ESTE MÓDULO NO HACE: repartir. Eso ya está resuelto.
//
// El reparto por empleado —y en particular el cubo «Sin asignar»— lo hace
// `reports/domain/desgloseEmpleado.ts` (SCRUM-228). Aquí se IMPORTA. No se copia su cuerpo, no
// se escribe una segunda versión y no se duplica el literal «Sin asignar»: dos pantallas que
// responden a la misma pregunta tienen que tratar lo no atribuible IGUAL, y una copia diverge
// en el primer cambio. Ese es el ticket entero, no un detalle de estilo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS DOS `null` QUE PARECEN EL MISMO (y aquí estaba el fallo)
//
// El código anterior hacía, con el filtro de la consulta quitado:
//
//     const tm = inv.quoteId != null ? (ownerMap.get(inv.quoteId) ?? null) : null;
//     ensure(tm ?? 0).collected += Number(inv.total);
//
// o sea que una factura SIN presupuesto (`quoteId == null`) caía en la clave 0 — **el
// PROPIETARIO**. No es un redondeo: es cargarle al dueño del negocio, en su propia pantalla,
// dinero que nadie sabe de quién es. `desglosarPorEmpleado` los separa a propósito:
// `teamMemberId == null` es el propietario; `quoteId == null` es «Sin asignar».
import {
  desglosarPorEmpleado,
  aCentimos,
  CLAVE_PROPIETARIO,
  ETIQUETA_SIN_ASIGNAR,
  type FacturaDesglose,
} from '../../reports/domain/desgloseEmpleado';
import { isFieldMember } from '../../../core/http/roleCapabilities';

export interface MiembroEquipo {
  id: number;
  name: string;
  role: string;
  status: string;
}
export interface QuoteEquipo {
  teamMemberId: number | null;
  status: string;
  createdAt: Date | string;
}

export interface FilaEquipo {
  id: number | null;
  name: string;
  role: string;
  status: string;
  sent: number;
  accepted: number;
  collected: number;
  acceptanceRate: number;
  thisWeek: number;
  isBest: boolean;
}

/**
 * Ensambla la respuesta del panel. `paidInvoices` tiene que traer **TODAS** las facturas
 * cobradas del mes, incluidas las sin presupuesto: filtrarlas en la consulta es el defecto que
 * este ticket cierra.
 */
export function ensamblarMetricasEquipo(entrada: {
  members: MiembroEquipo[];
  monthQuotes: QuoteEquipo[];
  paidInvoices: FacturaDesglose[];
  nombrePropietario: string;
  weekAgo: Date;
}): {
  hasTeam: boolean;
  members: FilaEquipo[];
  inactive: string[];
  /** El cubo no atribuible. `null` cuando no hay nada sin asignar (no se pinta vacío). */
  sinAsignar: { label: string; collected: number } | null;
  totalCollected: number;
} {
  const { members, monthQuotes, paidInvoices, nombrePropietario, weekAgo } = entrada;

  // ── Actividad de presupuestos: se cuenta por autor, y aquí `null` SÍ es el propietario.
  type Actividad = { sent: number; accepted: number; thisWeek: number };
  const actividad = new Map<number, Actividad>();
  const ensure = (k: number): Actividad => {
    if (!actividad.has(k)) actividad.set(k, { sent: 0, accepted: 0, thisWeek: 0 });
    return actividad.get(k)!;
  };
  for (const q of monthQuotes) {
    const a = ensure(q.teamMemberId ?? CLAVE_PROPIETARIO);
    a.sent++;
    if (q.status === 'accepted') a.accepted++;
    if (new Date(q.createdAt) >= weekAgo) a.thisWeek++;
  }

  // ── El dinero: reparto DELEGADO. `expenses: []` porque este panel no muestra gastos; el
  // contrato de `desglosarPorEmpleado` lo admite y así no se duplica la partición.
  const { filas, totales } = desglosarPorEmpleado({
    invoices: paidInvoices,
    expenses: [],
    miembros: members.map((m) => ({ id: m.id, name: m.name })),
    nombrePropietario,
  });

  const rate = (a: Actividad) => (a.sent > 0 ? Math.round((a.accepted / a.sent) * 100) : 0);
  const vacia: Actividad = { sent: 0, accepted: 0, thisWeek: 0 };
  const metaPorId = new Map(members.map((m) => [m.id, m]));

  // ── «Sin asignar» va FUERA de `members`, y es una decisión, no una comodidad.
  //
  // No es una persona: no tiene rol, ni tasa de aceptación, ni puede ser «mejor del mes». El
  // renderizador del panel (`homeView.js` → `renderTeamPerformance`) recorre `members` y de cada
  // fila deriva una etiqueta de rol, un porcentaje coloreado y el badge de mejor del mes: meterla
  // ahí la pintaría con el rol literal `sin_asignar` y un 0 % en rojo. **Un cubo disfrazado de
  // operario es peor que el descarte que veníamos a arreglar.**
  //
  // Como campo hermano el dato está completo y verificable —el invariante lo exige— y el panel
  // actual sigue siendo correcto sin tocarlo. PINTARLA es la otra mitad del ticket y lleva su
  // checklist AB6 (capturas, matriz de dispositivos), porque es superficie de usuario.
  const filaSinAsignar = filas.find((f) => f.esSinAsignar) ?? null;

  const lista: FilaEquipo[] = filas.filter((f) => !f.esSinAsignar).map((f) => {
    const a = actividad.get(f.key) ?? vacia;
    const meta = f.esPropietario ? null : metaPorId.get(f.key);
    return {
      id: f.esPropietario ? null : f.key,
      name: f.esPropietario ? nombrePropietario : (meta?.name ?? f.label),
      role: f.esPropietario ? 'owner' : (meta?.role ?? 'tecnico'),
      status: f.esPropietario ? 'active' : (meta?.status ?? 'active'),
      sent: a.sent, accepted: a.accepted, collected: f.revenue,
      acceptanceRate: rate(a), thisWeek: a.thisWeek, isBest: false,
    };
  });

  // Mejor del mes: entre PERSONAS con actividad. El cubo no atribuible nunca compite.
  let bestId: number | null | undefined;
  let bestVal = 0;
  for (const e of lista) {
    if (e.sent > 0 && aCentimos(e.collected) > aCentimos(bestVal)) {
      bestVal = e.collected;
      bestId = e.id;
    }
  }
  if (aCentimos(bestVal) > 0) {
    lista.forEach((e) => { e.isBest = e.id === bestId; });
  }

  const inactive = lista
    // SCRUM-147: por capacidad, no por igualdad de rol.
    .filter((e) => isFieldMember(e.role) && e.status === 'active' && e.thisWeek === 0)
    .map((e) => e.name);

  const equipoDeCampo = members.filter((m) => isFieldMember(m.role)).length;

  return {
    hasTeam: equipoDeCampo > 0,
    members: lista,
    inactive,
    sinAsignar: filaSinAsignar
      ? { label: ETIQUETA_SIN_ASIGNAR, collected: filaSinAsignar.revenue }
      : null,
    // Sale de la MISMA lista que el reparto, no de otra consulta: si viniera de otro sitio, el
    // invariante sería una coincidencia que se rompe el día que las dos consultas divergen.
    totalCollected: totales.revenue,
  };
}
