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
import { nombreParaDocumento } from '../../../core/documentos/nombreParaDocumento'; // SCRUM-577

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

/** SCRUM-171b: periodicidad PACTADA con el cliente. `NINGUNA` = sin aviso (lo de hoy). */
export type BillingPeriodicity = 'NINGUNA' | 'QUINCENAL' | 'MENSUAL';

export type MotivoAviso = 'plazo_legal' | 'periodicidad';

/**
 * SCRUM-171b · ¿HAY QUE AVISAR de que toca facturar este grupo?
 *
 * ⚠️ EL PLAZO LEGAL MANDA POR ENCIMA DE LA PERIODICIDAD, y no es un detalle de implementación:
 * es LA regla. La periodicidad es un ACUERDO COMERCIAL entre el pro y su cliente («te facturo a
 * mes vencido», «cada quince días»); la fecha límite del art. 13.2 RD 1619/2012 es LEY. Si
 * alguien pacta «quincenal» con un particular, el fin de mes natural sigue mandando; y si el
 * acuerdo dice «todavía no toca» pero el plazo se acaba, YaQu avisa IGUAL. Callar porque el
 * pacto dice que no toca sería sugerirle al pro facturar fuera de plazo por respetar un acuerdo
 * privado — exactamente lo que no puede pasar.
 *
 * Por eso el semáforo (que la bandeja ya calcula desde `tipoDestinatario`) se mira PRIMERO.
 *
 * NO dispara ningún envío: pinta un aviso y el pro decide. Un envío automático nuevo tendría que
 * pasar por la tabla J6 del máster (regla 28), y aquí esa regla no se toca.
 */
export function avisoDeFacturacion(
  periodicidad: BillingPeriodicity | string | null | undefined,
  semaforo: Semaforo,
  mesKey: string,
  hoy: Date = new Date(),
): { avisar: boolean; motivo: MotivoAviso | null } {
  // 1) La LEY primero, y con independencia de lo pactado — incluso con `NINGUNA`: el plazo corre
  //    igual, y ese aviso ya lo daba el semáforo de SCRUM-69.
  if (semaforo === 'rojo' || semaforo === 'ambar') return { avisar: true, motivo: 'plazo_legal' };

  const p = String(periodicidad || 'NINGUNA');
  if (p !== 'QUINCENAL' && p !== 'MENSUAL') return { avisar: false, motivo: null };

  // 2) El ACUERDO después: su ciclo se ha cerrado y hay partes esperando.
  //    MENSUAL   → el mes natural del grupo ya terminó.
  //    QUINCENAL → además, desde el día 16 del propio mes (cerrada la primera quincena).
  const [y, m] = mesKey.split('-').map(Number);
  const finDeMes = new Date(y, m, 0);
  if (startOfDay(hoy).getTime() > startOfDay(finDeMes).getTime()) return { avisar: true, motivo: 'periodicidad' };
  if (p === 'QUINCENAL') {
    const dia16 = new Date(y, m - 1, 16);
    if (startOfDay(hoy).getTime() >= startOfDay(dia16).getTime()) return { avisar: true, motivo: 'periodicidad' };
  }
  return { avisar: false, motivo: null };
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
  // SCRUM-171b: aviso DERIVADO (el plazo legal por encima de la periodicidad pactada). Nadie lo
  // guarda: se calcula al leer, igual que el semáforo.
  avisar: boolean;
  motivoAviso: MotivoAviso | null;
}

export interface ClientePendienteFacturar {
  customerId: number;
  customerName: string;
  /** El tipo YA RESUELTO — con el que se ha calculado el plazo. Nunca es null (ver `resolveTipoDestinatario`). */
  tipoDestinatario: TipoDestinatario;
  /**
   * SCRUM-615 · LO QUE EL PROFESIONAL DECLARÓ DE VERDAD. `null` = no consta.
   *
   * 🔴 NO ES REDUNDANTE CON EL DE ARRIBA, y ésa es la razón de existir de este campo: aquél sale
   * de `resolveTipoDestinatario`, que convierte `null` en `PARTICULAR` sin dejar rastro. Con solo
   * aquél, **el cliente no puede distinguir «es un particular» de «nadie lo ha dicho»** — y esa
   * distinción es justo la que hace falta para poder preguntar.
   *
   * NO ES INFORMACIÓN NUEVA: el valor crudo de la columna YA se expone en
   * `GET /admin/customers` (`customerAdmin.ts`, `CUSTOMER_SELECT_NO_TOKEN`). Esto solo deja de
   * ocultarlo en esta respuesta, que era la única que lo pisaba con el resuelto.
   *
   * Un valor que no sea uno de los dos declarables viaja como `null`: la columna es `text` sin
   * `CHECK`, así que puede contener cualquier cosa, y una cadena que nadie reconoce **no es una
   * declaración**. Es el mismo lado prudente que ya toma `resolveTipoDestinatario`.
   */
  tipoDestinatarioDeclarado: TipoDestinatario | null;
  /** SCRUM-171b: lo PACTADO con este cliente. Solo alimenta el aviso; no factura nada solo. */
  billingPeriodicity: BillingPeriodicity;
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
    select: { id: true, name: true, legalName: true, tipoDestinatario: true, billingPeriodicity: true }, // SCRUM-171b
  });
  const customerById = new Map(customers.map((c) => [c.id, c]));

  const hoy = new Date();
  const resultado: ClientePendienteFacturar[] = [];

  for (const [customerId, lista] of porCliente) {
    const customer = customerById.get(customerId);
    const tipo = resolveTipoDestinatario(customer ?? {});
    const periodicidad = ((customer as any)?.billingPeriodicity || 'NINGUNA') as BillingPeriodicity;
    const consolidables: AlbaranConsolidable[] = lista.map((a) => ({
      id: a.id, numero: a.numero, fecha: a.fecha, estado: a.estado,
      modoValoracion: a.modoValoracion, invoiceId: a.invoiceId, customerId,
    }));

    const grupos = groupByRotura(consolidables).map((g) => {
      const albaranesOriginales = lista.filter((a) => g.albaranes.some((ga) => ga.id === a.id));
      const lineasGrupo = albaranesOriginales
        .flatMap((a) => (Array.isArray(a.lineas) ? (a.lineas as unknown as AlbaranLinea[]) : []));
      const fechaLimite = fechaLimiteRecapitulativa(g.mesKey, tipo);
      const semaforo = calcularSemaforo(fechaLimite, hoy);
      // SCRUM-171b: el aviso se DERIVA aquí, con el plazo legal por delante de lo pactado.
      const aviso = avisoDeFacturacion(periodicidad, semaforo, g.mesKey, hoy);
      return {
        mesKey: g.mesKey,
        mesLabel: g.mesLabel,
        albaranes: g.albaranes,
        jobId: albaranesOriginales[0].jobId,
        importePotencial: calcAlbaranTotales(lineasGrupo),
        fechaLimite: toIsoDateLocal(fechaLimite),
        semaforo,
        avisar: aviso.avisar,
        motivoAviso: aviso.motivo,
      };
    });

    // SCRUM-615: lo DECLARADO, sin resolver. Se calcula aquí y no en `resolveTipoDestinatario`
    // a propósito: esa función se queda EXACTAMENTE como está — es la red que sigue dando el
    // plazo más corto mientras nadie conteste, y vaciarla de casos es el trabajo de este ticket,
    // no borrarla.
    const declarado: TipoDestinatario | null =
      customer?.tipoDestinatario === 'EMPRESARIO' || customer?.tipoDestinatario === 'PARTICULAR'
        ? customer.tipoDestinatario
        : null;

    resultado.push({
      customerId,
      // SCRUM-577: el criterio sale del SITIO UNICO. Respaldo `'Cliente'` como antes.
      customerName: nombreParaDocumento(customer, 'Cliente'),
      tipoDestinatario: tipo,
      tipoDestinatarioDeclarado: declarado,
      billingPeriodicity: periodicidad,
      grupos,
    });
  }

  return resultado;
}
