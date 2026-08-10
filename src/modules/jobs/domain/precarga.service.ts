// src/modules/jobs/domain/precarga.service.ts — SCRUM-458 (H1 · fase 2)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL PAQUETE DE PRECARGA · qué se baja al móvil para poder firmar sin red
//
// LA VÍCTIMA, Y POR QUÉ ESTO YA NO ES COMODIDAD: el fundador decidió que **no se crean albaranes
// sin red, solo se firman**. Eso convierte la precarga en MECANISMO: si el albarán no bajó, **no
// hay nada que firmar**. Antes fallar costaba comodidad; ahora cuesta el trabajo del profesional.
//
// ⚠️ ESTA FASE PRODUCE EL PAQUETE, NO LO BAJA NI LO GUARDA. Meterlo en `albaranesPrecargados`
// (SCRUM-455) es la fase siguiente, que CONSUME esto.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CONJUNTO: UNIÓN, NO CASCADA. Decidido por el fundador.
//
//   ① los trabajos AGENDADOS para hoy y mañana, **Y**
//   ② los trabajos NO CERRADOS de la última semana.
//
// La ② existe porque **puede que el pro NO AGENDE**, y sin ella quien no usa la agenda se queda
// con precarga vacía sin enterarse. No es «si no hay agendados, entonces los otros»: son LAS DOS
// SIEMPRE, deduplicadas.
//
// ⚠️ Y NO SE COLAPSAN AUNQUE SE SOLAPEN, porque no miden lo mismo: la ① mira **fecha agendada
// hacia el FUTURO** y la ② mira **recencia hacia el PASADO**. Un trabajo agendado para mañana pero
// modificado por última vez hace tres semanas **solo lo coge la ①**.
//
// 🔴 EL QUÉ SE PRECARGA VIVE AQUÍ Y SOLO AQUÍ. El fundador dijo al decidirlo: «esto en un futuro,
// con el uso de profesionales, quizás pueda cambiar». Cambiar el criterio tiene que ser cambiar
// UN sitio, no repartirlo en condiciones por medio producto.
// ═════════════════════════════════════════════════════════════════════════════════════════
import { prisma } from '../../../core/db/prisma';

/** Hoy y mañana: 1 día de horizonte por delante del día natural en curso. */
export const PRECARGA_DIAS_AGENDA = 1;

/** «La última semana». */
export const PRECARGA_DIAS_ATRAS = 7;

/**
 * 🔴 SE PREGUNTA POR LO QUE **NO** ES, Y ESA ES LA MITAD DE LA DECISIÓN.
 *
 * La FSM del máster (Parte L) es `pendiente_agendar → agendado → en_curso → terminado → cerrado`.
 * **`abierto` NO ES UN ESTADO**: es prosa del máster («editable mientras el Job esté abierto»,
 * SCRUM-66), y por eso esa palabra no aparece aquí como si lo fuera.
 *
 * La población ② es **todo lo que no está `cerrado`** —los cuatro restantes— y se escribe
 * NEGADO, no enumerando los cuatro: si mañana alguien añade un estado, enumerar **lo deja fuera
 * en silencio** y un fontanero se queda en un sótano sin nada que firmar. Negado entra solo, y
 * eso solo cuesta datos de más. **Falla por el lado del que el profesional puede salir.**
 *
 * ⚠️ Y para que «entra solo» no sea «entra sin que nadie se entere», hay un guard
 * (`tests/scrum458-paquete-de-precarga.test.mjs`) que enumera los estados conocidos y **cae
 * nombrando el nuevo** cuando aparezca uno: la inclusión se decide, no se hereda.
 *
 * ⚠️ POR QUÉ NO «solo los que aún tienen trabajo de campo» (sin `terminado`): esa lectura solo es
 * correcta **si el pro marca `terminado` DESPUÉS de que le firmen, y eso NO ESTÁ MEDIDO**. Ésta es
 * correcta en los dos órdenes. No se elige la opción que depende de un comportamiento que no
 * hemos medido. (Decisión del asesor.)
 */
export const ESTADO_CERRADO = 'cerrado';

/** Por qué entró un trabajo en el paquete. Son dos poblaciones y un trabajo puede estar en las dos. */
export type MotivoPrecarga = 'agendado' | 'reciente';

export interface VentanaPrecarga {
  /** Principio del día natural de hoy. */
  desdeAgenda: Date;
  /** Fin del día natural de mañana. */
  hastaAgenda: Date;
  /** Hace una semana. */
  desdeReciente: Date;
}

/**
 * Los tres bordes de tiempo, derivados de UN `ahora` que se inyecta.
 *
 * ⚠️ El horizonte de agenda va por DÍA NATURAL, no por «24 h»: «mañana» para un profesional es un
 * día del calendario, y un trabajo a las 8:00 de mañana tiene que entrar aunque ahora sean las
 * 18:00 (faltarían 14 h, pero también entra el de las 20:00, que son 26 h).
 */
export function ventanaDePrecarga(ahora: Date): VentanaPrecarga {
  const desdeAgenda = new Date(ahora);
  desdeAgenda.setHours(0, 0, 0, 0);
  const hastaAgenda = new Date(desdeAgenda);
  hastaAgenda.setDate(hastaAgenda.getDate() + PRECARGA_DIAS_AGENDA + 1); // exclusivo
  const desdeReciente = new Date(ahora);
  desdeReciente.setDate(desdeReciente.getDate() - PRECARGA_DIAS_ATRAS);
  return { desdeAgenda, hastaAgenda, desdeReciente };
}

/**
 * POR QUÉ entra este trabajo. Devuelve **todos** los motivos: un trabajo en las dos poblaciones
 * devuelve los dos, y aun así se precarga UNA vez.
 *
 * 🔴 EL ANCLA DE «LA ÚLTIMA SEMANA» ES `updatedAt`, Y AQUÍ ESTÁ LO QUE SIGNIFICA DE VERDAD.
 * Se descartaron las otras dos:
 *   · `createdAt` mide cuándo NACIÓ el trabajo, no si sigue vivo. Uno creado hace tres semanas y
 *     tocado ayer se quedaría fuera — y es justo el que hoy hay que firmar.
 *   · `scheduledAt` ya es el ancla de la población ①: usarla otra vez dejaría a la ② sin aportar
 *     nada a quien no agenda, que es su motivo entero de existir.
 *
 * ⚠️ Y SU COSTE, MEDIDO: `updatedAt` (`@updatedAt`) se mueve con CUALQUIER escritura sobre la
 * fila, y en el árbol hay **dos** fuentes (medido: `prisma.job.update` tiene 2 sitios) — el
 * `PATCH /admin/jobs/:id` del profesional, y `recalcJobCobradoForJob`, que dispara un **webhook de
 * cobro**, no el pro. O sea que no significa «el profesional lo tocó»: significa «algo pasó en
 * este trabajo». Eso **ENSANCHA la población, nunca la estrecha**, y los dos fallos no cuestan
 * igual: precargar de más cuesta datos; precargar de menos deja al pro sin nada que firmar.
 *
 * ⚠️ NO SE PUDO MEDIR CON DATOS: en `yaqu_dev_javier` hay 5 trabajos y **0 con
 * `updated_at > created_at`**, así que no hay distribución real que mirar. Lo de arriba es una
 * medición del CÓDIGO que escribe, no del uso.
 */
export function motivosDePrecarga(
  job: { status: string; scheduledAt: Date | null; updatedAt: Date },
  ahora: Date,
): MotivoPrecarga[] {
  const v = ventanaDePrecarga(ahora);
  const motivos: MotivoPrecarga[] = [];
  if (job.scheduledAt && job.scheduledAt >= v.desdeAgenda && job.scheduledAt < v.hastaAgenda) {
    motivos.push('agendado');
  }
  if (job.status !== ESTADO_CERRADO && job.updatedAt >= v.desdeReciente) {
    motivos.push('reciente');
  }
  return motivos;
}

/**
 * El `where` de Prisma para los trabajos del paquete. **Sale de las MISMAS constantes y la MISMA
 * ventana que `motivosDePrecarga`**, para que la consulta y la clasificación no puedan divergir;
 * y hay un test que las contrasta caso a caso, porque «derivan de lo mismo» no es «hacen lo mismo».
 *
 * ⚠️ `merchantId` SIEMPRE (regla 2). No es un adorno: sin él, el paquete de un profesional traería
 * albaranes de otro a un móvil que se comparte en la furgoneta.
 */
export function whereDePrecarga(merchantId: number, ahora: Date) {
  const v = ventanaDePrecarga(ahora);
  return {
    merchantId,
    OR: [
      { scheduledAt: { gte: v.desdeAgenda, lt: v.hastaAgenda } },
      { status: { not: ESTADO_CERRADO }, updatedAt: { gte: v.desdeReciente } },
    ],
  };
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// QUÉ LLEVA CADA ALBARÁN — minimización por delante (art. 32 RGPD)
//
// Lo que baja son nombres e importes de los clientes de un profesional, a un aparato que se
// pierde, se vende o se comparte en la furgoneta. **Cada campo tiene que poder justificarse con
// «sin esto no se puede firmar».** Se precarga lo necesario, no todo.
//
// 🔴 Y SOLO BAJAN LOS `emitido`. Medido en la FSM del albarán (`canTransitionAlbaran`): la ÚNICA
// transición a `firmado` es desde `emitido`. Un `borrador` **no se puede firmar** sin pasar antes
// por el servidor, y un `firmado` no tiene nada que firmar. Bajar cualquiera de los dos sería
// bajar datos personales que no sirven para nada — que es exactamente lo que el art. 32 prohíbe.
//
// LO QUE **NO** BAJA, y por qué:
//   · teléfono, email y datos fiscales del cliente → no hace falta ninguno para firmar;
//   · `evidenciaFirma` → lleva IP y user-agent, y no sale del servidor NUNCA (SCRUM-68);
//   · `signatureUrl` → solo existe si ya está firmado, y ésos no bajan;
//   · `firmaToken` → es la credencial de la página pública: en el móvil no pinta nada;
//   · `pdfUrl` → una URL necesita red, que es justo lo que no hay;
//   · presupuesto, estado de facturación y pendientes → contexto de cobro, no de firma.
// ═════════════════════════════════════════════════════════════════════════════════════════

export const ALBARAN_FIRMABLE = 'emitido';

export interface AlbaranPrecargado {
  id: number;
  numero: string;
  estado: string;
  fecha: Date;
  fechaEntrega: Date | null;
  lugarEntrega: string | null;
  modoValoracion: string;
  lineas: unknown;
  notas: string | null;
  jobId: number;
  jobTitulo: string | null;
  clienteNombre: string;
}

/**
 * Un albarán, con lo justo para firmarlo. PURA: recibe lo leído, no lee nada.
 *
 * `clienteNombre` está y se justifica: identifica de quién es el documento —firmar el albarán
 * equivocado en una obra es un error caro— y es la sugerencia de un toque del firmante (SCRUM-300).
 * `lineas` está porque **un albarán que baja sin sus líneas es una pantalla vacía que invita a
 * firmar algo que no se ha cargado**. `fecha`, `fechaEntrega` y `lugarEntrega` están porque son
 * CONTENIDO SELLADO por la firma (`evidenciaFirma.v` = 2).
 */
export function albaranParaFirmar(
  a: { id: number; numero: string; estado: string; fecha: Date; fechaEntrega: Date | null;
       lugarEntrega: string | null; modoValoracion: string; lineas: unknown; notas: string | null;
       jobId: number },
  jobTitulo: string | null,
  clienteNombre: string,
): AlbaranPrecargado {
  return {
    id: a.id,
    numero: a.numero,
    estado: a.estado,
    fecha: a.fecha,
    fechaEntrega: a.fechaEntrega,
    lugarEntrega: a.lugarEntrega,
    modoValoracion: a.modoValoracion,
    lineas: a.lineas,
    notas: a.notas,
    jobId: a.jobId,
    jobTitulo,
    clienteNombre,
  };
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL SUELO, que aquí decide si el mecanismo sirve
//
// 🔴 Si el paquete sale vacío, eso **NO** es «no había nada que precargar». «No había nada» y «no
// supe mirar» dejan al profesional EXACTAMENTE IGUAL: en el sótano, sin albarán, creyendo que iba
// preparado. Por eso el resultado lleva ESTADO, y un fallo **no devuelve lista vacía**.
//
// Quién lo mira y qué le dice al profesional es de H2 (SCRUM-356); aquí no se pinta nada.
// ═════════════════════════════════════════════════════════════════════════════════════════

export const PRECARGA_LISTA = 'LISTA';
export const PRECARGA_NO_SE_PUDO = 'NO_SE_PUDO';

export interface PaquetePrecarga {
  estado: typeof PRECARGA_LISTA | typeof PRECARGA_NO_SE_PUDO;
  albaranes: AlbaranPrecargado[];
  /** Cuántos trabajos entraron, y por qué. Un trabajo en las DOS poblaciones se cuenta UNA vez. */
  trabajos: { total: number; agendados: number; recientes: number; enAmbas: number };
  motivo?: string;
}

/**
 * Construye el paquete de un merchant. El cliente de Prisma se INYECTA para poder ejercitar esto
 * sin base de datos: es el patrón de `_staging-lock.mjs`.
 */
export async function construirPaquetePrecarga(
  merchantId: number,
  ahora: Date,
  prismaClient: any = prisma,
): Promise<PaquetePrecarga> {
  const vacio = { total: 0, agendados: 0, recientes: 0, enAmbas: 0 };
  try {
    const jobs = await prismaClient.job.findMany({
      where: whereDePrecarga(merchantId, ahora),
      select: { id: true, titulo: true, status: true, scheduledAt: true, updatedAt: true, customerId: true },
    });

    const trabajos = { total: jobs.length, agendados: 0, recientes: 0, enAmbas: 0 };
    for (const j of jobs) {
      const m = motivosDePrecarga(j, ahora);
      if (m.includes('agendado')) trabajos.agendados++;
      if (m.includes('reciente')) trabajos.recientes++;
      if (m.length === 2) trabajos.enAmbas++;
    }
    if (!jobs.length) return { estado: PRECARGA_LISTA, albaranes: [], trabajos };

    // ⚠️ `merchantId` TAMBIÉN aquí, y no por simetría: filtrar solo por `jobId` confiaría en que
    // la lista de trabajos ya venía filtrada. Dos filtros que dependen uno del otro son un filtro.
    const albaranes = await prismaClient.albaran.findMany({
      where: { merchantId, jobId: { in: jobs.map((j: any) => j.id) }, estado: ALBARAN_FIRMABLE },
      select: {
        id: true, numero: true, estado: true, fecha: true, fechaEntrega: true, lugarEntrega: true,
        modoValoracion: true, lineas: true, notas: true, jobId: true,
      },
    });
    if (!albaranes.length) return { estado: PRECARGA_LISTA, albaranes: [], trabajos };

    const clientes = await prismaClient.customer.findMany({
      where: { merchantId, id: { in: [...new Set(jobs.map((j: any) => j.customerId))] } },
      select: { id: true, name: true },
    });
    const nombrePorCliente = new Map<number, string>(clientes.map((c: any) => [c.id, c.name]));
    const jobPorId = new Map<number, any>(jobs.map((j: any) => [j.id, j]));

    return {
      estado: PRECARGA_LISTA,
      trabajos,
      albaranes: albaranes.map((a: any) => {
        const j = jobPorId.get(a.jobId);
        return albaranParaFirmar(a, j?.titulo ?? null, nombrePorCliente.get(j?.customerId) ?? '');
      }),
    };
  } catch (e: any) {
    // 🔴 NO se devuelve lista vacía. Una lista vacía se lee como «no tenías nada», y aquí lo cierto
    // es que no se supo mirar. El profesional que lo confunda se va al sótano igual de desprotegido.
    return {
      estado: PRECARGA_NO_SE_PUDO,
      albaranes: [],
      trabajos: vacio,
      motivo: String((e && e.message) || e),
    };
  }
}
