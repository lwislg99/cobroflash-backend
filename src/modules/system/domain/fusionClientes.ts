// src/modules/system/domain/fusionClientes.ts — SCRUM-1057 (CRM-16)
//
// FUSIONAR DOS CLIENTES DUPLICADOS EN UNO, cuando NINGUNO tiene una factura EMITIDA. Operación
// DESTRUCTIVA (GO del fundador, 22-sep-2026: «doy el GO para el 1057», citado en el ticket) —
// borra de verdad el cliente fusionado. Depende de SCRUM-1031 (que `/duplicados` funcione),
// arreglado en este mismo PR (ver `scrum1057-duplicados-antes-de-id.test.mjs`).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ «NINGUNA FACTURA EMITIDA» NO ES SOLO UNA REGLA DE NEGOCIO: ES UNA FK
//
// `Invoice.customerId` tiene clave ajena REAL a `customers` (`schema.prisma`, a diferencia de
// `Job.customerId` o `Quote.jobId`, que son deliberadamente sueltas). Reasignarla sería tocar un
// documento YA EMITIDO — regla 29, prohibido siempre — y borrar el cliente con facturas delante
// haría que Postgres RECHAZARA el `DELETE` por esa misma FK. Las dos razones apuntan al mismo
// sitio: si cualquiera de los dos tiene una factura, no se intenta. Ese caso es del ticket de J1.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CENSO DE QUÉ SE MUEVE, Y POR QUÉ ESTOS DIEZ Y NO SOLO LOS TRES DEL TICKET
//
// El ticket nombra «presupuestos, trabajos, notas, etiquetas». Medido contra el schema completo,
// hay OTRAS seis tablas con `customerId` que quedarían apuntando a una fila borrada si no se
// tocan — un defecto MUDO, exactamente el que esta casa persigue en cada censo:
//
//   CON FK REAL (Postgres rechazaría el `DELETE` si no se mueven primero):
//     Quote · Charge · QuoteRequest · CustomerEvent (las notas)
//   SIN FK (Postgres NO protestaría — el defecto sería silencioso):
//     Job · ParteTrabajo · WhatsAppMessage · EmailMessage · MaintenancePlan
//
// Las nueve se reasignan. La décima, `Customer.companyId` de OTROS clientes que apuntaran al
// fusionado como su empresa, se desvincula con `desvincularYBorrar` — la MISMA función que ya usa
// `deleteCustomer`, no una segunda copia de esa decisión.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA DECISIÓN DE RECHAZAR ES PURA; MOVER DIEZ TABLAS NO PUEDE SERLO
//
// `decidirRechazoFusion` no toca la base: se prueba sin Postgres. `fusionarClientes` sí, porque
// una transacción sobre nueve tablas reales no se puede fingir sin fabricar el propio defecto que
// se quiere vigilar (un doble que no reproduce el FK real dejaría pasar exactamente el caso que
// esto existe para impedir). Su prueba vive en Postgres de verdad
// (`scrum1057b-fusion-clientes-postgres.test.mjs`).
import { prisma } from '../../../core/db/prisma';
import { desvincularYBorrar } from '../customerAdmin';
import { tagsDe, normalizarTags, tagsParaPrisma } from '../tagsDelCliente';
import { normalizarNif } from '../../../core/validation/nifEspanol';

export type MotivoRechazoFusion = 'mismo_cliente' | 'cliente_no_encontrado' | 'factura_emitida';

/**
 * ¿Se puede intentar la fusión? PURA: no consulta ni escribe. Recibe ya resueltos los tres hechos
 * que dependen de la base (existencia de los dos clientes y si alguno tiene facturas).
 *
 * 🔴 SCRUM-411 · NO SE EXPORTA. Su único consumidor real está DENTRO de este fichero
 * (`previsualizarFusion` y `fusionarClientes`); exportarla solo para que un test la llamara
 * directo era un `export` que no le servía a nadie más — el trinquete de huérfanos lo cazó y
 * tenía razón. Se mide por la SUPERFICIE PÚBLICA, en `scrum1057b-fusion-clientes-postgres.test.mjs`
 * (mismo-cliente, no-encontrado y factura-emitida, los tres contra base real).
 */
function decidirRechazoFusion(datos: {
  principalId: number;
  fusionadoId: number;
  principalExiste: boolean;
  fusionadoExiste: boolean;
  facturasEmitidas: number;
}): MotivoRechazoFusion | null {
  if (datos.principalId === datos.fusionadoId) return 'mismo_cliente';
  if (!datos.principalExiste || !datos.fusionadoExiste) return 'cliente_no_encontrado';
  if (datos.facturasEmitidas > 0) return 'factura_emitida';
  return null;
}

export interface DatosParaFusion {
  id: number;
  name: string;
  taxId: string | null;
  tags: unknown;
}

/**
 * Lo que verá la pantalla ANTES de confirmar (aceptación 2 del ticket): qué se conserva (el
 * principal, tal cual) y qué se movería, SIN escribir nada.
 */
export interface PrevisualizacionFusion {
  bloqueada: MotivoRechazoFusion | null;
  principal: DatosParaFusion | null;
  fusionado: DatosParaFusion | null;
  quotesAMover: number;
  jobsAMover: number;
  notasAMover: number;
  etiquetasResultantes: string[] | null;
  /** Aviso, NUNCA bloqueo (el ticket lo pide explícito: «NIF distintos → avisar»). */
  nifDistintos: boolean;
}

const SELECT_FUSION = { id: true, name: true, taxId: true, tags: true } as const;

export async function previsualizarFusion(
  merchantId: number,
  principalId: number,
  fusionadoId: number,
): Promise<PrevisualizacionFusion> {
  const [principal, fusionado] = await Promise.all([
    prisma.customer.findFirst({ where: { id: principalId, merchantId }, select: SELECT_FUSION }),
    prisma.customer.findFirst({ where: { id: fusionadoId, merchantId }, select: SELECT_FUSION }),
  ]);
  const facturasEmitidas = (!principal || !fusionado) ? 0 : await prisma.invoice.count({
    where: { merchantId, customerId: { in: [principalId, fusionadoId] } },
  });
  const bloqueada = decidirRechazoFusion({
    principalId, fusionadoId,
    principalExiste: !!principal, fusionadoExiste: !!fusionado,
    facturasEmitidas,
  });

  if (bloqueada || !principal || !fusionado) {
    return {
      bloqueada, principal: principal ?? null, fusionado: fusionado ?? null,
      quotesAMover: 0, jobsAMover: 0, notasAMover: 0, etiquetasResultantes: null, nifDistintos: false,
    };
  }

  const [quotesAMover, jobsAMover, notasAMover] = await Promise.all([
    prisma.quote.count({ where: { merchantId, customerId: fusionadoId } }),
    prisma.job.count({ where: { merchantId, customerId: fusionadoId } }),
    prisma.customerEvent.count({ where: { merchantId, customerId: fusionadoId } }),
  ]);
  const etiquetasResultantes = normalizarTags([...tagsDe(principal), ...tagsDe(fusionado)]) ?? null;
  const nifDistintos = !!(principal.taxId && fusionado.taxId
    && normalizarNif(principal.taxId) !== normalizarNif(fusionado.taxId));

  return { bloqueada: null, principal, fusionado, quotesAMover, jobsAMover, notasAMover, etiquetasResultantes, nifDistintos };
}

export interface ResultadoFusion {
  principalId: number;
  fusionadoId: number;
  quotesMovidos: number;
  jobsMovidos: number;
  notasMovidas: number;
  nifDistintos: boolean;
}

/**
 * Ejecuta la fusión. Transaccional (todo o nada, aceptación 4): las diez tablas y el borrado caen
 * juntas o no cae ninguna. Lanza el motivo (`MotivoRechazoFusion`) si no se puede — la ruta lo
 * traduce a su código HTTP; aquí no hay copy (regla 30).
 */
export async function fusionarClientes(
  merchantId: number,
  principalId: number,
  fusionadoId: number,
): Promise<ResultadoFusion> {
  const [principal, fusionado] = await Promise.all([
    prisma.customer.findFirst({ where: { id: principalId, merchantId }, select: SELECT_FUSION }),
    prisma.customer.findFirst({ where: { id: fusionadoId, merchantId }, select: SELECT_FUSION }),
  ]);
  const facturasEmitidas = (!principal || !fusionado) ? 0 : await prisma.invoice.count({
    where: { merchantId, customerId: { in: [principalId, fusionadoId] } },
  });
  const motivo = decidirRechazoFusion({
    principalId, fusionadoId,
    principalExiste: !!principal, fusionadoExiste: !!fusionado,
    facturasEmitidas,
  });
  if (motivo) throw new Error(motivo);
  // `decidirRechazoFusion` ya garantiza que los dos existen si `motivo` es null.
  const p = principal!;
  const f = fusionado!;

  const nifDistintos = !!(p.taxId && f.taxId && normalizarNif(p.taxId) !== normalizarNif(f.taxId));
  const tagsUnidas = tagsParaPrisma(normalizarTags([...tagsDe(p), ...tagsDe(f)]));

  const [quotesMovidos, jobsMovidos, notasMovidas] = await prisma.$transaction(async (tx) => {
    const q = await tx.quote.updateMany({ where: { merchantId, customerId: fusionadoId }, data: { customerId: principalId } });
    const j = await tx.job.updateMany({ where: { merchantId, customerId: fusionadoId }, data: { customerId: principalId } });
    const cev = await tx.customerEvent.updateMany({ where: { merchantId, customerId: fusionadoId }, data: { customerId: principalId } });
    await tx.charge.updateMany({ where: { merchantId, customerId: fusionadoId }, data: { customerId: principalId } });
    await tx.quoteRequest.updateMany({ where: { merchantId, customerId: fusionadoId }, data: { customerId: principalId } });
    await tx.parteTrabajo.updateMany({ where: { merchantId, customerId: fusionadoId }, data: { customerId: principalId } });
    await tx.whatsAppMessage.updateMany({ where: { merchantId, customerId: fusionadoId }, data: { customerId: principalId } });
    await tx.emailMessage.updateMany({ where: { merchantId, customerId: fusionadoId }, data: { customerId: principalId } });
    await tx.maintenancePlan.updateMany({ where: { merchantId, customerId: fusionadoId }, data: { customerId: principalId } });

    await tx.customer.updateMany({ where: { id: principalId, merchantId }, data: { tags: tagsUnidas } });

    // El apunte en el historial del que queda (aceptación 4) — DESPUÉS de mover los eventos
    // viejos del fusionado, para que éste sea el ÚLTIMO de la lista y no se confunda con ellos.
    await tx.customerEvent.create({
      data: {
        merchantId, customerId: principalId, type: 'fusion',
        title: `Fusionado con ${f.name}`,
        meta: { fusionadoId, fusionadoNombre: f.name, fusionadoTaxId: f.taxId, nifDistintos },
      },
    });

    // Desvincula a quien apuntara al fusionado como su empresa y lo borra — la MISMA función que
    // usa `deleteCustomer`, no una segunda copia de esa decisión.
    await desvincularYBorrar(tx as any, merchantId, fusionadoId);

    return [q.count, j.count, cev.count];
  });

  return { principalId, fusionadoId, quotesMovidos, jobsMovidos, notasMovidas, nifDistintos };
}
