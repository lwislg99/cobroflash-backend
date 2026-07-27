// src/modules/team/domain/teamOverview.service.ts — SCRUM-136 (hub Equipo)
//
// EL PROBLEMA QUE RESUELVE: el equipo vivía repartido en TRES sitios que listaban el mismo
// roster con tres pintados distintos — "Equipo" (alta/roles), "Operarios" (dinero por
// operario) y el panel "Rendimiento del equipo" del Inicio (presupuestos del mes). El pro no
// sabía dónde iba cada cosa. Este servicio devuelve UNA fila por miembro con todo, para que
// el hub se pinte con UNA sola petición (`GET /admin/team`, que ya era admin-only: no hace
// falta ruta nueva ni tocar el ratchet de SCRUM-113).
//
// ⚠️ DOS ATRIBUCIONES Y DOS VENTANAS DISTINTAS, a propósito y etiquetadas:
//   · presupuestos → `Quote.teamMemberId` (quien lo CREÓ) y SOLO del mes en curso.
//   · trabajos     → `Job.operarioId`     (quien lo ORIGINÓ, congelado en SCRUM-52) y de
//                    TODO el histórico.
// No se homogeneizan porque cada una responde a una pregunta distinta y ya alimentan
// pantallas existentes con ese criterio (getTeamMetrics / getOperariosMetrics). Mezclarlas
// bajo una etiqueta común diría algo falso: por eso el DTO marca la ventana de cada bloque
// (`ventana: 'mes' | 'historico'`) y la UI la escribe al lado del número.
//
// EL PROPIETARIO NO ES UN TeamMember: no hay fila suya en la tabla (authMiddleware trata
// `teamMemberId null` como propietario/admin). Igual que hacían las tres vistas por su
// cuenta, aquí se sintetiza UNA sola vez, con `id: null` — y ese null es también su clave de
// agregación en Quote/Job, así que sus números salen del mismo sitio que los de los demás.
import { prisma } from '../../../core/db/prisma';

export interface TeamOverviewRow {
  id: number | null;          // null = propietario (no tiene fila en team_members)
  name: string;
  email: string;
  role: string;               // 'admin' | 'tecnico' (el propietario se marca con isOwner)
  status: string;             // 'active' | 'invited' | 'suspended'
  isOwner: boolean;
  createdAt: Date | null;
  resumen: {
    // Ventana: MES en curso (misma que el panel del Inicio, getTeamMetrics)
    presupuestosEnviados: number;
    presupuestosAceptados: number;
    // Ventana: HISTÓRICO (misma que la vista de Operarios, getOperariosMetrics)
    trabajosAbiertos: number;
    trabajosTotales: number;
    pendiente: number;
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
// Clave de agregación común: 0 representa al propietario (operarioId/teamMemberId null),
// mismo convenio que getTeamMetrics y getOperariosMetrics — no se inventa uno nuevo.
const key = (id: number | null | undefined) => id ?? 0;

export async function getTeamOverview(merchantId: number): Promise<{
  currency: string;
  miembros: TeamOverviewRow[];
}> {
  const inicioDeMes = new Date();
  inicioDeMes.setDate(1);
  inicioDeMes.setHours(0, 0, 0, 0);

  const [members, merchant, presupuestosMes, trabajos, trabajosAbiertos] = await Promise.all([
    prisma.teamMember.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    }),
    prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { name: true, email: true, defaultCurrency: true },
    }),
    // 'draft' fuera: un presupuesto sin enviar no es actividad (mismo criterio que getTeamMetrics).
    prisma.quote.groupBy({
      by: ['teamMemberId', 'status'],
      where: { merchantId, status: { not: 'draft' }, createdAt: { gte: inicioDeMes } },
      _count: { id: true },
    }),
    prisma.job.groupBy({
      by: ['operarioId'],
      where: { merchantId },
      _sum: { totalAceptado: true, totalCobrado: true },
      _count: { id: true },
    }),
    prisma.job.groupBy({
      by: ['operarioId'],
      where: { merchantId, status: { not: 'cerrado' } },
      _count: { id: true },
    }),
  ]);

  const presupuestosBy = new Map<number, { enviados: number; aceptados: number }>();
  for (const r of presupuestosMes) {
    const acc = presupuestosBy.get(key(r.teamMemberId)) ?? { enviados: 0, aceptados: 0 };
    acc.enviados += r._count.id;
    if (r.status === 'accepted') acc.aceptados += r._count.id;
    presupuestosBy.set(key(r.teamMemberId), acc);
  }

  const trabajosBy = new Map<number, { total: number; pendiente: number }>();
  for (const r of trabajos) {
    trabajosBy.set(key(r.operarioId), {
      total: r._count.id,
      pendiente: round2(Number(r._sum.totalAceptado ?? 0) - Number(r._sum.totalCobrado ?? 0)),
    });
  }

  const abiertosBy = new Map<number, number>();
  for (const r of trabajosAbiertos) abiertosBy.set(key(r.operarioId), r._count.id);

  const fila = (
    id: number | null,
    name: string,
    email: string,
    role: string,
    status: string,
    isOwner: boolean,
    createdAt: Date | null,
  ): TeamOverviewRow => {
    const p = presupuestosBy.get(key(id)) ?? { enviados: 0, aceptados: 0 };
    const t = trabajosBy.get(key(id)) ?? { total: 0, pendiente: 0 };
    return {
      id, name, email, role, status, isOwner, createdAt,
      resumen: {
        presupuestosEnviados: p.enviados,
        presupuestosAceptados: p.aceptados,
        trabajosAbiertos: abiertosBy.get(key(id)) ?? 0,
        trabajosTotales: t.total,
        // Puede salir negativo si se cobró de más (SCRUM V5, sobrepago): se deja tal cual —
        // taparlo con Math.max(0, …) escondería justo el caso que el pro necesita ver.
        pendiente: t.pendiente,
      },
    };
  };

  return {
    currency: merchant?.defaultCurrency ?? 'EUR',
    miembros: [
      // El propietario SIEMPRE el primero: es quien manda y quien lee esta pantalla.
      fila(null, merchant?.name ?? 'Propietario', merchant?.email ?? '', 'admin', 'active', true, null),
      ...members.map((m) => fila(m.id, m.name, m.email, m.role, m.status, false, m.createdAt)),
    ],
  };
}
