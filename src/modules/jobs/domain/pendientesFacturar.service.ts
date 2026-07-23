// src/modules/jobs/domain/pendientesFacturar.service.ts — SCRUM-69 (FACT-1)
// Bandeja "Pendientes de facturar": albaranes firmados+VALORADOs sin factura, agrupados por
// cliente y mes natural (reusa el motor de rotura de SCRUM-17), con semáforo de plazo legal
// (art. 13 RD 1619/2012) e importe potencial. Diferenciador: nadie más avisa de este plazo.
import type { PrismaClient } from '@prisma/client';
import {
  groupByRotura,
  calcAlbaranTotales,
  type AlbaranConsolidable,
  type AlbaranLinea,
} from './albaran.service';

export type TipoDestinatario = 'PARTICULAR' | 'EMPRESARIO';
export type Semaforo = 'verde' | 'ambar' | 'rojo';

// SCRUM-69: null = "cliente nunca clasificado" — se trata como PARTICULAR (el plazo MÁS
// CORTO, criterio seguro) SOLO para el cálculo; nunca se escribe ese valor de vuelta a la BD.
export function resolveTipoDestinatario(customer: { tipoDestinatario?: string | null }): TipoDestinatario {
  return customer.tipoDestinatario === 'EMPRESARIO' ? 'EMPRESARIO' : 'PARTICULAR';
}

/**
 * Fecha límite legal de la recapitulativa para un mes natural dado (art. 13.2 RD 1619/2012):
 * último día del mes si PARTICULAR; día 16 del mes SIGUIENTE si EMPRESARIO. `mesKey` = "YYYY-MM"
 * (mismo formato que mesNaturalKey/groupByRotura). JS Date normaliza el desbordamiento de año
 * (diciembre → enero) solo.
 */
export function fechaLimiteRecapitulativa(mesKey: string, tipo: TipoDestinatario): Date {
  const [y, m] = mesKey.split('-').map(Number); // m = mes 1-indexado (marzo = 3)
  if (tipo === 'EMPRESARIO') return new Date(y, m, 16); // día 16 del mes siguiente
  return new Date(y, m, 0); // día 0 del mes siguiente = último día del mes actual
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// `fechaLimiteRecapitulativa` construye fechas en hora LOCAL (medianoche local, para comparar
// con "hoy" también local). `Date.toISOString()` convierte a UTC antes de formatear: en
// timezones con offset positivo (Madrid, UTC+1/+2) eso desplaza la fecha límite un día hacia
// atrás — inaceptable en un PLAZO LEGAL. Formateamos a mano desde los componentes locales.
export function toIsoDateLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Semáforo por días hasta la fecha límite (ambas fechas normalizadas a medianoche local, para
 * que la hora del día no desplace el resultado cerca de la frontera).
 * rojo: plazo YA vencido (< 0 días) · ámbar: 0-5 días · verde: > 5 días.
 */
export function calcularSemaforo(fechaLimite: Date, hoy: Date = new Date()): Semaforo {
  const diasHastaLimite = Math.round(
    (startOfDay(fechaLimite).getTime() - startOfDay(hoy).getTime()) / 86_400_000,
  );
  if (diasHastaLimite < 0) return 'rojo';
  if (diasHastaLimite <= 5) return 'ambar';
  return 'verde';
}

export interface GrupoPendienteFacturar {
  mesKey: string;
  mesLabel: string;
  albaranes: AlbaranConsolidable[];
  // jobId del primer albarán del grupo — enlaza el botón "Consolidar" al Job donde ya existe
  // ese flujo (jobDetailView.js). Un cliente con >1 Job simultáneo puede mezclar partes de
  // varios Jobs en el mismo mes; V1 enlaza al primero (edge case fuera de alcance, ver brief).
  jobId: number;
  importePotencial: { base: number; cuota: number; total: number };
  fechaLimite: string; // ISO date, solo fecha
  semaforo: Semaforo;
}

export interface ClientePendienteFacturar {
  customerId: number;
  customerName: string;
  tipoDestinatario: TipoDestinatario;
  grupos: GrupoPendienteFacturar[];
}

/**
 * Consulta merchant-wide: NO existía ningún listado agregado de albaranes (todo lo previo era
 * por Job individual — consolidar-albaranes, jobs.routes.ts — o por albarán suelto). Mismos
 * filtros que validarConsolidacion (SCRUM-17): firmado + VALORADO + sin facturar + Job no
 * TRABAJO_UNICO (una obra única se factura al concluir, no se agrupa por mes).
 */
export async function getPendientesFacturar(
  merchantId: number,
  prisma: PrismaClient,
): Promise<ClientePendienteFacturar[]> {
  // Albaran.jobId es un Int plano (sin relación Prisma declarada hacia Job) — a diferencia de
  // consolidar-albaranes (jobs.routes.ts), que arranca DESDE el Job y no necesita este paso,
  // aquí se arranca desde Albaran y hay que resolver los Jobs elegibles primero.
  const jobs = await prisma.job.findMany({
    where: { merchantId, tipoOperacion: { not: 'TRABAJO_UNICO' } },
    select: { id: true, customerId: true },
  });
  if (!jobs.length) return [];
  const customerIdByJobId = new Map(jobs.map((j) => [j.id, j.customerId]));

  const albaranes = await prisma.albaran.findMany({
    where: {
      merchantId,
      estado: 'firmado',
      modoValoracion: 'VALORADO',
      invoiceId: null,
      jobId: { in: [...customerIdByJobId.keys()] },
    },
    select: {
      id: true, numero: true, fecha: true, estado: true, modoValoracion: true,
      invoiceId: true, lineas: true, jobId: true,
    },
    orderBy: { fecha: 'asc' },
  });

  if (!albaranes.length) return [];

  const porCliente = new Map<number, typeof albaranes>();
  for (const a of albaranes) {
    const customerId = customerIdByJobId.get(a.jobId)!;
    if (!porCliente.has(customerId)) porCliente.set(customerId, []);
    porCliente.get(customerId)!.push(a);
  }

  const customers = await prisma.customer.findMany({
    where: { id: { in: [...porCliente.keys()] } },
    select: { id: true, name: true, legalName: true, tipoDestinatario: true },
  });
  const customerById = new Map(customers.map((c) => [c.id, c]));

  const hoy = new Date();
  const resultado: ClientePendienteFacturar[] = [];

  for (const [customerId, lista] of porCliente) {
    const customer = customerById.get(customerId);
    const tipo = resolveTipoDestinatario(customer ?? {});
    const consolidables: AlbaranConsolidable[] = lista.map((a) => ({
      id: a.id, numero: a.numero, fecha: a.fecha, estado: a.estado,
      modoValoracion: a.modoValoracion, invoiceId: a.invoiceId, customerId,
    }));

    const grupos = groupByRotura(consolidables).map((g) => {
      const albaranesOriginales = lista.filter((a) => g.albaranes.some((ga) => ga.id === a.id));
      const lineasGrupo = albaranesOriginales
        .flatMap((a) => (Array.isArray(a.lineas) ? (a.lineas as unknown as AlbaranLinea[]) : []));
      const fechaLimite = fechaLimiteRecapitulativa(g.mesKey, tipo);
      return {
        mesKey: g.mesKey,
        mesLabel: g.mesLabel,
        albaranes: g.albaranes,
        jobId: albaranesOriginales[0].jobId,
        importePotencial: calcAlbaranTotales(lineasGrupo),
        fechaLimite: toIsoDateLocal(fechaLimite),
        semaforo: calcularSemaforo(fechaLimite, hoy),
      };
    });

    resultado.push({
      customerId,
      customerName: customer?.legalName || customer?.name || 'Cliente',
      tipoDestinatario: tipo,
      grupos,
    });
  }

  return resultado;
}
