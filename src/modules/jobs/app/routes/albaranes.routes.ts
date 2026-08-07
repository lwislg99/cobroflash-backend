// src/modules/jobs/app/routes/albaranes.routes.ts — SCRUM-14 (ALBARAN-1)
// Acciones sobre un albarán existente (el create vive en POST /admin/jobs/:id/albaranes).
// El ALBARÁN sigue siendo documento NO FISCAL (regla 24): ni se sella ni sustituye a nada.
// ⚠️ SCRUM-170 CAMBIÓ EL LÍMITE DE ESTE FICHERO, a propósito: `facturar-parcial` (al final) SÍ
// emite factura y sella VeriFactu. Está aquí porque el recurso sobre el que se actúa es UN
// albarán —igual que firmar o enviar— y partirlo en otro router obligaría a duplicar tenancy y
// precondiciones. Todo lo demás de aquí sigue sin tocar facturación.
// Tenancy SIEMPRE findFirst { id, merchantId } → 404 (regla 2). Editable hasta 'firmado'
// (409 albaran_locked).
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { recordAudit, actorDeRequest, requestIp } from '../../../system/audit.service'; // SCRUM-207
import { requireActivePlan } from '../../../../core/http/authMiddleware'; // SCRUM-47 (S1: enviar WA ✅ técnico, sin requireRole)
import { sendAlbaranFirmadoWhatsApp, sendAlbaranParaFirmarWhatsApp, type AlbaranFirmadoSendResult } from '../../domain/albaranWhatsApp.service'; // SCRUM-47/49
import { sendSuccessBody, sendFailureBody, type SendFailureReason } from '../../../../lib/sendOutcome'; // SCRUM-126
import {
  ALBARAN_MODOS_VALORACION,
  buildFirmaEvidencia,
  canTransitionAlbaran,
  ensureAlbaranPdf,
  serializeAlbaran,
  validarLineas,

  contarLineasDePresupuesto, // SCRUM-367
  type AlbaranModoValoracion,
} from '../../domain/albaran.service';
import { allocateAlbaranNumber } from '../../domain/albaranNumber.service'; // SCRUM-302: dentro de la tx
import { datosDuplicado } from '../../domain/albaranDuplicado'; // SCRUM-302: qué viaja al duplicado
// SCRUM-300 (C5): microcopy y normalización del firmante, en su fuente única.
import { exigirNombreFirmante, normalizarLugarEntrega, resolverCalidadFirmante } from '../../domain/albaranFirmante';
import { getPendientesFacturar } from '../../domain/pendientesFacturar.service'; // SCRUM-69
// SCRUM-301 (C1): el listado global. Dominio puro + lector inyectable (la tenencia se ejercita).
import { listarAlbaranesDelMerchant, type LectorListado } from '../../domain/albaranesListado';
import {
  agruparPorMes,
  seleccionarConsolidablesDeCliente,
  type AlbaranCandidato,
} from '../../domain/consolidacionCliente.service'; // SCRUM-70
import { calcAlbaranTotales, mesNaturalLabel, type AlbaranLinea } from '../../domain/albaran.service'; // SCRUM-70
// SCRUM-170 (FACT-2c): facturación PARCIAL por cantidad servida. El estado de cobro se DERIVA
// del libro de líneas facturadas — nunca es un flag (regla 27 y la lección de DELSOL, SCRUM-17).
import { requireRole } from '../../../../core/http/authMiddleware';
import {
  estadoCobroAlbaran,
  facturadoPorLinea,
  pendientePorLinea,
  validarPeticionParcial,
} from '../../domain/albaranFacturacion';
import { emitInvoice } from '../../../invoicing/domain/invoicing.service';
import { applyVeriFactu } from '../../../invoicing/domain/verifactu.service';
import { isReceiptNumber } from '../../../invoicing/domain/invoiceNumber.service';
import { getEmissionMode } from '../../../invoicing/domain/emission.service';
import { calcVatBreakdown } from '../../../invoicing/domain/vat.service';
import { emitirRecapitulativas } from '../../domain/recapitulativa.service'; // SCRUM-171a: emisión compartida con la vía de Job
import { sellarTrasEmision, SELLADO_HECHO } from '../../../invoicing/domain/selladoEstado'; // SCRUM-205
import { exigirLineasFacturables, esErrorSinLineas, ERROR_SIN_LINEAS, COPY_ADMIN_SIN_LINEAS } from '../../../invoicing/domain/lineasFacturables'; // SCRUM-246
// SCRUM-290 (A0.4): el CRITERIO de qué se factura y a qué precio vive en funciones puras, no aquí.
import {
  casarLineas, motivosParaNoEmitir, lineasParaFactura, totalDeFacturables,
  yaFacturadoPorLineaDePresupuesto, lineasParaAdicional,
} from '../../domain/albaranAFactura';
// SCRUM-195: el número del adicional se reserva DENTRO de su transacción, igual que el del alta.
import { allocateQuoteNumber } from '../../../quotes/domain/quoteNumber.service';

const router = Router();

/**
 * SCRUM-301 · el lector de verdad del listado. Cada consulta recibe el `merchantId` y lo pone en
 * su `where`: si alguna lo perdiera, el listado enseñaría el nombre del cliente de otro merchant.
 * Vive aquí —y no en el dominio— para que `albaranesListado.ts` siga sin tocar Prisma y su tenencia
 * se pueda ejercitar con una tienda falsa en la suite, sin base de datos.
 */
const lectorPrismaListado: LectorListado = {
  albaranes: ({ merchantId }) => prisma.albaran.findMany({
    where: { merchantId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, merchantId: true, jobId: true, numero: true, fecha: true,
      createdAt: true, estado: true, lineas: true, invoiceId: true,
    },
  }),
  jobs: ({ merchantId, ids }) => prisma.job.findMany({
    where: { merchantId, id: { in: ids } },
    select: { id: true, titulo: true, customerId: true },
  }),
  customers: ({ merchantId, ids }) => prisma.customer.findMany({
    where: { merchantId, id: { in: ids } },
    select: { id: true, name: true, legalName: true },
  }),
  libro: ({ merchantId, albaranIds }) => prisma.albaranLineaFacturada.findMany({
    where: { merchantId, albaranId: { in: albaranIds } },
    select: { albaranId: true, lineaIndex: true, cantidad: true, invoiceId: true },
  }),
};

/**
 * GET /admin/albaranes — SCRUM-301 (C1): el LISTADO GLOBAL del merchant.
 *
 * No existía: los albaranes solo se veían dentro de cada Trabajo, así que «¿qué tengo sin firmar?»
 * —la pregunta del lunes— obligaba a entrar obra por obra.
 *
 * 🔴 NO CAPTURA los errores del lector para devolver una lista vacía. Si la lectura falla, esto
 * responde 500 y la pantalla pinta un error: un contador de «sin firmar» a 0 porque la consulta se
 * rompió manda al profesional a casa tranquilo con tres albaranes sin firmar. Cero de «no hay» y
 * cero de «no supe mirar» son idénticos en pantalla y opuestos en significado.
 *
 * La lógica (ejes, contadores, derivado de cobro) vive en `albaranesListado.ts` con su lector
 * inyectable: así la tenencia se prueba EJERCITANDO el camino con dos merchants, y no fiándose de
 * que el fichero mencione `merchantId` (SCRUM-348).
 *
 * 🔴 ADMIN-ONLY, y no es una precaución de más. SCRUM-147 midió y cerró que **un técnico solo ve
 * SUS Trabajos** (`seesOnlyOwnJobs`: allowlist de 'admin', rol desconocido restringido). Los
 * albaranes cuelgan de Trabajos, así que un listado global le enseñaría de qué obras AJENAS hay
 * partes, de qué clientes y con qué fechas — lo que la puerta principal le niega, servido por la
 * puerta de atrás.
 *
 * El criterio de «la misma información, agrupada» (el que abre `consolidables` al técnico) vale
 * cuando la información YA era visible; aquí no lo era. Abrir de más no se deshace: haría falta
 * saber quién lo usó mientras tanto.
 *
 * Si algún día el técnico debe ver los partes de SUS obras, el mecanismo ya existe y es barato
 * —`seesOnlyOwnJobs(req.userRole)` + prefiltrar los `jobId` con `operarioId = req.teamMemberId`,
 * como hace `GET /admin/jobs`—, pero **qué debe ver exactamente es una decisión de producto**, no
 * un detalle de implementación: se decide en su ticket, no aquí.
 */
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const listado = await listarAlbaranesDelMerchant(req.merchantId!, lectorPrismaListado);
    return res.json(listado);
  } catch (err: any) {
    console.error('[GET /admin/albaranes]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// GET /admin/albaranes/pendientes-facturar — SCRUM-69 (FACT-1): bandeja "pendientes de
// facturar" agrupada por cliente y mes natural, con semáforo de plazo legal (art. 13 RD
// 1619/2012). Solo lectura, mismo nivel de acceso que ver facturas (TECNICO_ALLOWED).
// Colección (no :id) — registrada antes de las rutas de un albarán suelto a propósito,
// aunque hoy no colisiona con ninguna (no hay GET '/:id' de un solo segmento en este router).
router.get('/pendientes-facturar', async (req, res) => {
  try {
    const clientes = await getPendientesFacturar(req.merchantId!, prisma);
    res.json({ clientes });
  } catch (err: any) {
    console.error('[GET /admin/albaranes/pendientes-facturar]', err?.message || err);
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * GET /admin/albaranes/consolidables — SCRUM-70 (FACT-2).
 *
 * VISTA PREVIA de lo que entraría en la recapitulativa de UN cliente, a ámbito CLIENTE + MES
 * NATURAL (cruzando Trabajos), con los filtros de rango de fechas y de números.
 *
 * SOLO LECTURA, y es deliberado: el propio ticket lo pide («el usuario debe SIEMPRE ver y
 * confirmar qué se va a agrupar antes de emitir», queja documentada de usuarios de Odoo con
 * agrupaciones automáticas no controladas). A ámbito de cliente eso pasa de recomendable a
 * imprescindible: la selección ya no la hace él parte a parte, la hace el sistema.
 *
 * ⚠️ NO EMITE. La emisión de la recapitulativa está en manos de SCRUM-173 (agujero de
 * VeriFactu: `consolidar-albaranes` crea facturas sin `applyVeriFactu`) y se cablea a este
 * ámbito cuando ese ticket cierre. Ver el comentario de SCRUM-70 para el porqué del orden.
 *
 * Filtros: ?customerId= (obligatorio) · ?desde= ?hasta= (ruta 1) · ?numeroDesde= ?numeroHasta=
 * (ruta 2) · ?mes=YYYY-MM.
 */
router.get('/consolidables', async (req, res) => {
  try {
    const customerId = Number(req.query.customerId);
    if (!Number.isInteger(customerId)) {
      return res.status(400).json({ error: 'customer_requerido', message: 'Indica el cliente.' });
    }
    // Tenancy (regla 2): el cliente tiene que ser de este merchant o no existe.
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, merchantId: req.merchantId! },
      select: { id: true, name: true },
    });
    if (!customer) return res.status(404).json({ error: 'not_found' });

    // `Albaran.jobId` es un Int plano (sin relación Prisma declarada), igual que en la bandeja
    // de SCRUM-69: los Trabajos del cliente primero, sus albaranes después.
    const jobs = await prisma.job.findMany({
      where: { merchantId: req.merchantId!, customerId },
      select: { id: true, tipoOperacion: true },
    });
    if (!jobs.length) return res.json({ customer, grupos: [], descartados: [] });

    const jobById = new Map(jobs.map((j) => [j.id, j]));
    const albaranes = await prisma.albaran.findMany({
      where: { merchantId: req.merchantId!, jobId: { in: [...jobById.keys()] } },
      select: {
        id: true, numero: true, fecha: true, estado: true, modoValoracion: true,
        invoiceId: true, lineas: true, jobId: true,
      },
      orderBy: { fecha: 'asc' },
    });

    const candidatos: AlbaranCandidato[] = albaranes.map((a) => ({
      id: a.id, numero: a.numero, fecha: a.fecha, estado: a.estado,
      modoValoracion: a.modoValoracion, invoiceId: a.invoiceId,
      customerId, jobId: a.jobId,
      tipoOperacion: jobById.get(a.jobId)?.tipoOperacion ?? null,
    }));

    const { elegibles, descartados } = seleccionarConsolidablesDeCliente(candidatos, customerId, {
      desde: typeof req.query.desde === 'string' ? req.query.desde : null,
      hasta: typeof req.query.hasta === 'string' ? req.query.hasta : null,
      numeroDesde: typeof req.query.numeroDesde === 'string' ? req.query.numeroDesde : null,
      numeroHasta: typeof req.query.numeroHasta === 'string' ? req.query.numeroHasta : null,
      mes: typeof req.query.mes === 'string' ? req.query.mes : null,
    });

    const lineasById = new Map(albaranes.map((a) => [a.id, a.lineas]));
    const grupos = agruparPorMes(elegibles).map((g) => {
      let base = 0;
      let cuota = 0;
      for (const a of g.albaranes) {
        const t = calcAlbaranTotales(lineasById.get(a.id) as AlbaranLinea[] | null);
        base += t.base;
        cuota += t.cuota;
      }
      return {
        mesKey: g.mesKey,
        mesLabel: mesNaturalLabel(g.mesKey),
        jobIds: g.jobIds,
        albaranes: g.albaranes.map((a) => ({ id: a.id, numero: a.numero, fecha: a.fecha, jobId: a.jobId })),
        base: base.toFixed(2),
        cuota: cuota.toFixed(2),
        total: (base + cuota).toFixed(2),
      };
    });

    return res.json({ customer, grupos, descartados });
  } catch (err: any) {
    console.error('[GET /admin/albaranes/consolidables]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /admin/albaranes/consolidar — SCRUM-171a · EMITIR LA RECAPITULATIVA A ÁMBITO CLIENTE.
 *
 * Es la mitad que SCRUM-70 dejó a medias: la vista previa por cliente existía (`/consolidables`)
 * pero NO había forma de emitir desde ahí — solo desde un Job (`/admin/jobs/:id/consolidar-albaranes`),
 * y un cliente factura por MES, no por Trabajo. Sin esto, SCRUM-171 (periodicidad) no puede existir:
 * no hay camino que facture «lo de este mes de este cliente» cuando sus albaranes vienen de varios
 * Trabajos.
 *
 * LA SELECCIÓN LA MANDA EL USUARIO, SIEMPRE. Se emite lo que venga en `albaranIds` y nada más —
 * el propio research de SCRUM-70 lo pide por la queja documentada de usuarios de Odoo con
 * agrupaciones automáticas que nadie confirma. A ámbito cliente eso no es recomendable: es
 * imprescindible, porque la selección deja de hacerla él parte a parte.
 *
 * FAIL-CLOSED: si UNO de los seleccionados no es elegible, no se emite NADA y se dice cuál y por
 * qué. Emitir «los que sí» dejaría facturas correctas mezcladas con una sorpresa, y una factura
 * emitida no se borra (regla 29).
 *
 * La emisión en sí (rotura del art. 13, transacción única, guard anti-doble y sellado VeriFactu
 * fuera del commit) es LA MISMA que la vía de Job: vive en `recapitulativa.service`.
 */
router.post('/consolidar', requireRole('admin'), async (req, res) => {
  try {
    const customerId = Number(req.body?.customerId);
    if (!Number.isInteger(customerId)) {
      return res.status(400).json({ error: 'customer_requerido', message: 'Indica el cliente.' });
    }
    // Tenancy (regla 2): el cliente tiene que ser de este merchant o no existe.
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, merchantId: req.merchantId! },
      select: { id: true, name: true },
    });
    if (!customer) return res.status(404).json({ error: 'not_found' });

    const rawIds: any[] = Array.isArray(req.body?.albaranIds) ? req.body.albaranIds : [];
    const ids: number[] = Array.from(new Set<number>(rawIds.map((x) => Number(x)).filter((n) => Number.isInteger(n))));
    if (ids.length === 0) {
      return res.status(400).json({ error: 'seleccion_vacia', message: 'Selecciona al menos un parte de trabajo firmado.' });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { id: req.merchantId },
      select: { id: true, email: true, country: true, flags: true, defaultCurrency: true, taxId: true },
    });
    if (!merchant) return res.status(404).json({ error: 'not_found' });
    if (getEmissionMode(merchant) === 'receipt') {
      return res.status(409).json({ error: 'consolidacion_no_disponible', message: 'La factura recapitulativa no está disponible en este modo.' });
    }

    // Los albaranes, SIEMPRE por merchant; el cliente se comprueba después vía su Trabajo
    // (`Albaran` no guarda customerId: cuelga del Job, y 1 Job = 1 cliente).
    const albaranes = await prisma.albaran.findMany({
      where: { id: { in: ids }, merchantId: req.merchantId! },
    });
    if (albaranes.length !== ids.length) {
      return res.status(404).json({ error: 'albaran_no_encontrado', message: 'Alguno de los partes seleccionados no existe.' });
    }
    const jobs = await prisma.job.findMany({
      where: { id: { in: [...new Set(albaranes.map((a) => a.jobId))] }, merchantId: req.merchantId! },
      select: { id: true, customerId: true, tipoOperacion: true },
    });
    const jobById = new Map(jobs.map((j) => [j.id, j]));

    // SCRUM-170: quién tiene ya líneas facturadas por la vía parcial (no lleva `invoiceId`).
    const conParcial = new Set(
      (await prisma.albaranLineaFacturada.findMany({
        where: { merchantId: req.merchantId!, albaranId: { in: ids } },
        select: { albaranId: true },
        distinct: ['albaranId'],
      })).map((r) => r.albaranId),
    );

    const candidatos: AlbaranCandidato[] = albaranes.map((a) => ({
      id: a.id, numero: a.numero, fecha: a.fecha, estado: a.estado,
      modoValoracion: a.modoValoracion, invoiceId: a.invoiceId,
      customerId: jobById.get(a.jobId)?.customerId ?? -1,
      jobId: a.jobId,
      tipoOperacion: jobById.get(a.jobId)?.tipoOperacion ?? null,
      facturadoParcial: conParcial.has(a.id),
    }));

    const { elegibles, descartados } = seleccionarConsolidablesDeCliente(candidatos, customerId, {});
    if (descartados.length > 0) {
      // Se devuelven TODOS los motivos, no solo el primero: quien seleccionó ocho partes
      // necesita saber cuáles quitar de una vez, no ir descubriéndolos de uno en uno.
      return res.status(409).json({
        error: descartados[0].motivo,
        message: descartados[0].mensaje,
        descartados,
      });
    }

    const lineasById = new Map(albaranes.map((a) => [a.id, a.lineas]));
    const grupos = agruparPorMes(elegibles).map((g) => ({
      mesLabel: mesNaturalLabel(g.mesKey),
      albaranes: g.albaranes.map((a) => ({
        id: a.id, numero: a.numero, fecha: a.fecha, lineas: lineasById.get(a.id),
      })),
    }));

    const { facturas, sinSellar } = await emitirRecapitulativas(prisma, {
      merchantId: req.merchantId!,
      customerId,
      currency: merchant.defaultCurrency || 'EUR',
      taxId: merchant.taxId,
      grupos,
      actor: actorDeRequest(req),
    });

      // SCRUM-206 · antes esto respondía `ok: true` con `sinSellar` DENTRO. Un llamador que
      // mira `ok` —o el status 201— veía éxito, y el fallo era un campo que podía ignorar sin
      // enterarse: eso también es fail-open, solo que en la respuesta en vez de en el PDF. El
      // front, medido, no leía `sinSellar` en ningún sitio.
      //
      // El portón es por DOCUMENTO, no por tanda: las que se sellaron bien siguen su curso y no
      // se deshace nada (regla 29). Lo que cambia es que el fallo llega como fallo — 409, que
      // `apiRequest` convierte en excepción con `message` humano y `err.code`.
    if (sinSellar.length) {
      return res.status(409).json({
        ok: false, error: 'sellado_incompleto', message: 'Se emitieron las facturas, pero falló el registro VeriFactu de alguna. Revísalo antes de entregarlas.',
        customer, facturas, sinSellar,
      });
    }

    return res.status(201).json({ ok: true, customer, facturas });
  } catch (err: any) {
    if (err?.message === 'consolidacion_concurrente') {
      return res.status(409).json({ error: 'consolidacion_concurrente', message: 'Alguno de los partes se facturó a la vez desde otra sesión. Vuelve a intentarlo.' });
    }
    if (err?.message === 'consolidacion_no_disponible') {
      return res.status(409).json({ error: 'consolidacion_no_disponible', message: 'La factura recapitulativa no está disponible en este modo.' });
    }
    console.error('[POST /admin/albaranes/consolidar]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// Condición 1 del OK (fotos): límites duros con 4xx claros.
const FOTO_MIME_ALLOWLIST = ['image/jpeg', 'image/png', 'image/webp'];
const FOTO_MAX_BYTES = 5 * 1024 * 1024; // ~5 MB por foto (decodificada)
const FOTOS_MAX_POR_ALBARAN = 10;
// Condición 2 del OK (firma): tope del data-URI base64 — el canvas del patrón del
// quote genera ~10-50 KB; 500 KB da margen de sobra sin permitir payloads absurdos.
const FIRMA_MAX_CHARS = 500_000;

type FindAlbaranResult =
  | { ok: false; status: 400 | 404 }
  | { ok: true; albaran: NonNullable<Awaited<ReturnType<typeof prisma.albaran.findFirst>>> };

async function findAlbaran(req: any): Promise<FindAlbaranResult> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return { ok: false, status: 400 };
  const albaran = await prisma.albaran.findFirst({ where: { id, merchantId: req.merchantId } });
  return albaran ? { ok: true, albaran } : { ok: false, status: 404 };
}

// PATCH /admin/albaranes/:id — editar lineas/notas/fecha SOLO si no está firmado.
// Cada edición: version++ + traza en AuditLog (decisión fundador: sin historial de filas).
router.patch('/:id', async (req, res) => {
  try {
    const found = await findAlbaran(req);
    if (!found.ok) return res.status(found.status).json({ error: found.status === 400 ? 'invalid_id' : 'not_found' });
    const { albaran } = found;
    if (albaran.estado === 'firmado') {
      return res.status(409).json({ error: 'albaran_locked', message: 'Un albarán firmado está congelado: no se puede editar.' });
    }

    const data: any = {};
    const cambios: string[] = [];

    // SCRUM-65: el modo de valoración se puede cambiar SOLO en 'borrador' (congelado
    // desde 'emitido', mismo espíritu que el resto del documento).
    let modoEfectivo: AlbaranModoValoracion =
      albaran.modoValoracion === 'VALORADO' ? 'VALORADO' : 'SIN_VALORAR';
    if (req.body?.modoValoracion !== undefined) {
      if (albaran.estado !== 'borrador') {
        return res.status(409).json({
          error: 'albaran_locked',
          message: 'El modo de valoración solo se puede cambiar mientras el albarán está en borrador.',
        });
      }
      const m = String(req.body.modoValoracion);
      if (!ALBARAN_MODOS_VALORACION.includes(m as AlbaranModoValoracion)) {
        return res.status(400).json({ error: 'modo_valoracion_invalido' });
      }
      modoEfectivo = m as AlbaranModoValoracion;
      data.modoValoracion = modoEfectivo;
      cambios.push('modoValoracion');
    }

    if (req.body?.lineas !== undefined) {
      // SCRUM-367: mismo rango real que al crear. ESTE es el punto donde el índice se perdía.
      const nLineasQuote = await contarLineasDePresupuesto(albaran.jobId, req.merchantId!);
      const v = validarLineas(req.body.lineas, modoEfectivo, nLineasQuote);
      if (!v.ok) return res.status(400).json({ error: 'lineas_invalidas', message: v.error });
      data.lineas = v.lineas;
      cambios.push('lineas');
    } else if (data.modoValoracion !== undefined) {
      // Cambia el modo sin mandar líneas nuevas: revalidar las EXISTENTES contra el
      // modo nuevo (evita dejar un VALORADO con líneas sin precio, o viceversa).
      const v = validarLineas(albaran.lineas, modoEfectivo);
      if (!v.ok) {
        return res.status(400).json({
          error: 'lineas_invalidas',
          message: `Las líneas actuales no encajan con el nuevo modo: ${v.error}`,
        });
      }
    }
    if (req.body?.notas !== undefined) {
      data.notas = String(req.body.notas || '').slice(0, 2000) || null;
      cambios.push('notas');
    }
    // SCRUM-300 (C5): DOS fechas —la del documento y la de ENTREGA— con la misma regla y UNA
    // sola salida de error. Se hizo así a propósito: duplicar el `return 400 invalid_date` habría
    // añadido una respuesta pública más sin texto humano, y el trinquete de SCRUM-275 lo cazó al
    // primer intento. Menos ramas, y el tope de respuestas mudas se queda donde estaba.
    //
    // `fechaEntrega` admite vaciarse (''→null); `fecha` no, porque el documento siempre tiene una.
    let fechaInvalida = false;
    const leerFecha = (valor: unknown, admiteVacio: boolean): Date | null => {
      const bruto = String(valor ?? '').trim();
      if (!bruto && admiteVacio) return null;
      const d = new Date(bruto);
      if (isNaN(d.getTime())) { fechaInvalida = true; return null; }
      return d;
    };

    if (req.body?.fecha !== undefined) {
      const d = leerFecha(req.body.fecha, false);
      if (!fechaInvalida) { data.fecha = d; cambios.push('fecha'); }
    }
    if (req.body?.fechaEntrega !== undefined) {
      const d = leerFecha(req.body.fechaEntrega, true);
      if (!fechaInvalida) { data.fechaEntrega = d; cambios.push('fechaEntrega'); }
    }
    if (fechaInvalida) return res.status(400).json({ error: 'invalid_date' });
    // SCRUM-300 (C5): LUGAR DE ENTREGA. Se edita aquí —preparando el documento— y NO en el
    // momento de firmar: teclear una dirección con el cliente delante y las manos sucias es
    // justo la fricción en obra que el ticket manda evitar. ⚠️ Vacío se guarda como NULL,
    // nunca se sustituye por el domicilio fiscal (suelo del ticket).
    if (req.body?.lugarEntrega !== undefined) {
      data.lugarEntrega = normalizarLugarEntrega(req.body.lugarEntrega);
      cambios.push('lugarEntrega');
    }
    if (cambios.length === 0) return res.status(400).json({ error: 'nothing_to_update' });

    const updated = await prisma.albaran.update({
      where: { id: albaran.id },
      data: { ...data, version: { increment: 1 } },
    });
    recordAudit({
      merchantId: req.merchantId,
      teamMemberId: (req as any).teamMemberId ?? null,
      action: 'albaran_editado',
      entityType: 'albaran',
      entityId: albaran.id,
      meta: { cambios, deVersion: albaran.version, aVersion: updated.version },
      ip: requestIp(req),
    });
    return res.json(serializeAlbaran(updated));
  } catch (err: any) {
    console.error('[PATCH /admin/albaranes/:id]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// POST /admin/albaranes/:id/emitir — borrador→emitido (idempotente si ya emitido).
/**
 * GET /admin/albaranes/:id — SCRUM-302 (C2): lo que necesita la PÁGINA de detalle.
 *
 * No existía: el albarán solo se leía dentro del detalle del Trabajo, como una fila de la pila de
 * DOCUMENTOS. Una página propia necesita poder cargarse sola (enlace directo, recarga, «atrás»).
 *
 * Devuelve el albarán serializado + lo que el RAIL de solo lectura enseña + el estado de
 * facturación DERIVADO. Ese derivado se calcula aquí, con las mismas piezas que usa
 * `facturar-parcial`, y viaja con sus TRES valores: aplanarlo a un booleano perdería el `parcial`,
 * que en una obra por fases es el caso normal.
 */
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });

    const albaran = await prisma.albaran.findFirst({ where: { id, merchantId: req.merchantId } });
    if (!albaran) return res.status(404).json({ error: 'not_found' });

    const job = await prisma.job.findFirst({
      where: { id: albaran.jobId, merchantId: req.merchantId },
      select: { id: true, titulo: true, direccion: true, customerId: true, quoteId: true },
    });
    const customer = job?.customerId
      ? await prisma.customer.findFirst({
          where: { id: job.customerId, merchantId: req.merchantId },
          select: { id: true, name: true },
        })
      : null;

    // SCRUM-302 · EL PRESUPUESTO DE ORIGEN, Y ES DEL DOCUMENTO — NO DE LAS LÍNEAS.
    //
    // Se resuelve por `Job.quoteId`: el albarán cuelga de un Trabajo y el Trabajo nació de un
    // presupuesto. Lo que NO se hace aquí, y no es olvido: emparejar las líneas del albarán con
    // las del presupuesto. `AlbaranLinea.quoteLineIndex` existe desde SCRUM-367, pero **no cubre
    // todos los casos** — no lo hay en modo `SIN_VALORAR`, solo lo escribe el prellenado, y el
    // índice no dice de QUÉ presupuesto es. Un vínculo que es cierto a veces no puede presentarse
    // como procedencia de cada línea.
    //
    // La forma es la de `jobs.routes.ts:275` (`number` con caída al `id`), no una nueva: dos
    // formas del mismo dato acaban divergiendo y el pro ve dos números para un presupuesto.
    const quote = job?.quoteId
      ? await prisma.quote.findFirst({
          where: { id: job.quoteId, merchantId: req.merchantId },
          select: { id: true, quoteNumber: true },
        })
      : null;

    const lineas = (Array.isArray(albaran.lineas) ? albaran.lineas : []) as any[];
    const libro = await prisma.albaranLineaFacturada.findMany({
      where: { merchantId: req.merchantId, albaranId: albaran.id },
      select: { lineaIndex: true, cantidad: true, invoiceId: true },
    });
    const facturado = facturadoPorLinea(libro);
    const estadoFacturacion = estadoCobroAlbaran(lineas, facturado, !!albaran.invoiceId);

    return res.json({
      ...serializeAlbaran(albaran),
      // El rail: contexto de solo lectura. Nada de aquí es accionable desde esta página.
      job: job ? { id: job.id, titulo: job.titulo, direccion: job.direccion } : null,
      customer,
      // Del DOCUMENTO. `null` cuando el Trabajo no vino de un presupuesto (`Job.quoteId` es
      // nullable): el rail lo omite en vez de pintar un enlace que no lleva a ningún sitio.
      quote: quote ? { id: quote.id, number: quote.quoteNumber ?? quote.id } : null,
      // Los TRES valores, no un booleano (SCRUM-170/302).
      estadoFacturacion,
      // Lo que queda por facturar, por línea: es lo que hace verdadero el «parcial».
      pendientes: pendientePorLinea(lineas, facturado),
      // Derivado, NO un estado (Parte L intacta): el modelo solo tiene borrador|emitido|firmado.
      enviadoParaFirma: !!albaran.enviadoParaFirmaAt && albaran.estado === 'emitido',
    });
  } catch (err: any) {
    console.error('[GET /admin/albaranes/:id]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/:id/emitir', async (req, res) => {
  try {
    const found = await findAlbaran(req);
    if (!found.ok) return res.status(found.status).json({ error: found.status === 400 ? 'invalid_id' : 'not_found' });
    const { albaran } = found;
    if (albaran.estado === 'emitido') return res.json(serializeAlbaran(albaran)); // idempotente
    if (!canTransitionAlbaran(albaran.estado, 'emitido')) {
      return res.status(409).json({ error: 'invalid_transition', from: albaran.estado, to: 'emitido' });
    }
    const updated = await prisma.albaran.update({ where: { id: albaran.id }, data: { estado: 'emitido' } });
    return res.json(serializeAlbaran(updated));
  } catch (err: any) {
    console.error('[POST /admin/albaranes/:id/emitir]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /admin/albaranes/:id/duplicar — SCRUM-302 (C2).
 *
 * En una reforma de tres semanas cada día es un parte. Duplicar el de ayer y ajustar cantidades
 * ahorra casi todo el trabajo de rellenarlo.
 *
 * 🔴 QUÉ VIAJA Y QUÉ NO **NO SE DECIDE AQUÍ**: lo decide `albaranDuplicado.ts`, que clasifica los
 * campos del modelo en «describe el trabajo» y «es un hecho que ocurrió», y cuyo guard falla si
 * aparece un campo SIN CLASIFICAR. Escribir aquí la lista de campos a copiar sería la lista que
 * envejece en silencio — y si el campo nuevo es evidencial, el duplicado afirmaría algo que no pasó.
 *
 * ⚠️ EL NÚMERO SE RESERVA DENTRO DE LA TRANSACCIÓN. Con `allocateAlbaranNumber` fuera, dos
 * duplicados simultáneos se llevan el MISMO `ALB-YYYY-NNN`, y un número de albarán repetido no es
 * un problema de interfaz: es un problema de documento. Mismo patrón que el alta
 * (`jobs.routes.ts:674`), no uno nuevo.
 */
router.post('/:id/duplicar', async (req, res) => {
  try {
    const found = await findAlbaran(req);
    if (!found.ok) return res.status(found.status).json({ error: found.status === 400 ? 'invalid_id' : 'not_found' });
    const { albaran } = found;

    const copia = await prisma.$transaction(async (tx) => {
      const numero = await allocateAlbaranNumber(tx, req.merchantId!);
      return tx.albaran.create({ data: { ...datosDuplicado(albaran as any), numero } as any });
    });
    return res.status(201).json(serializeAlbaran(copia));
  } catch (err: any) {
    console.error('[POST /admin/albaranes/:id/duplicar]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// POST /admin/albaranes/:id/firmar — firma del cliente EN EL MÓVIL DEL PRO (canvas).
// Solo desde 'emitido'. Firmado = terminal y congelado; el PDF se regenera con la firma.
router.post('/:id/firmar', async (req, res) => {
  try {
    const found = await findAlbaran(req);
    if (!found.ok) return res.status(found.status).json({ error: found.status === 400 ? 'invalid_id' : 'not_found' });
    const { albaran } = found;
    if (albaran.estado === 'firmado') {
      return res.status(409).json({ error: 'albaran_locked', message: 'Este albarán ya está firmado.' });
    }
    if (!canTransitionAlbaran(albaran.estado, 'firmado')) {
      return res.status(409).json({ error: 'invalid_transition', from: albaran.estado, to: 'firmado', message: 'Emite el albarán antes de firmarlo.' });
    }

    const signatureData = String(req.body?.signatureData || '');
    if (!/^data:image\/(png|jpeg);base64,/.test(signatureData)) {
      return res.status(400).json({ error: 'firma_invalida', message: 'La firma debe ser una imagen PNG o JPEG (data-URI base64).' });
    }
    if (signatureData.length > FIRMA_MAX_CHARS) {
      return res.status(413).json({ error: 'firma_demasiado_grande', message: 'La firma supera el tamaño máximo permitido.' });
    }

    // SCRUM-300 (C5): quién firma y en calidad de qué llegan CON la firma. Se resuelven ANTES de
    // sellar —por eso no rompen el hash— y un valor inválido corta la firma en vez de guardarse
    // a medias: el documento no puede quedar diciendo algo que nadie eligió.
    const calidad = resolverCalidadFirmante({
      ranura: req.body?.firmadoPorCalidad,
      textoLibre: req.body?.firmadoPorCalidadOtro,
    });
    if (!calidad.ok) return res.status(400).json({ error: calidad.error, message: calidad.message });
    // SCRUM-300: el nombre es OBLIGATORIO al firmar (columna nullable por las filas viejas; el
    // acto de firmar lo exige). Ver `exigirNombreFirmante` para el porqué de las dos reglas.
    const nombre = exigirNombreFirmante(req.body?.firmadoPorNombre);
    if (!nombre.ok) return res.status(400).json({ error: nombre.error, message: nombre.message });
    const firmadoPorNombre = nombre.nombre;

    const firmadoAt = new Date();
    // SCRUM-68: sella evidencias (canal in situ, sin token). ip/ua se guardan pero NUNCA
    // se exponen (serializeAlbaran no los saca; el PDF solo pinta hash/firmante/canal).
    const evidencia = await buildFirmaEvidencia({
      albaran,
      canal: 'in_situ',
      ip: requestIp(req),
      ua: (req.headers['user-agent'] as string) || null,
      tokenId: null,
      firmadoAt,
      firmadoPorNombre,
      firmadoPorCalidad: calidad.valor,
    });
    const updated = await prisma.albaran.update({
      where: { id: albaran.id },
      data: {
        estado: 'firmado', signatureUrl: signatureData, firmadoAt, evidenciaFirma: evidencia as any,
        firmadoPorNombre, firmadoPorCalidad: calidad.valor,
      },
    });
    // Regenerar el PDF YA con el bloque de firma (force). Si el PDF falla, la firma
    // queda registrada igualmente (el GET /pdf lo regenerará bajo demanda).
    await ensureAlbaranPdf(albaran.id, true).catch((e) =>
      console.error('[albaranes] PDF tras firmar:', e?.message || e),
    );
    return res.json(serializeAlbaran({ ...updated, pdfUrl: `/admin/albaranes/${updated.id}/pdf` }));
  } catch (err: any) {
    console.error('[POST /admin/albaranes/:id/firmar]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// GET /admin/albaranes/:id/pdf — regenera si falta (disco Railway efímero) y sirve.
router.get('/:id/pdf', async (req, res) => {
  try {
    const found = await findAlbaran(req);
    if (!found.ok) return res.status(found.status).json({ error: found.status === 400 ? 'invalid_id' : 'not_found' });
    const { albaran } = found;
    const { diskPath, numero } = await ensureAlbaranPdf(albaran.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${numero}.pdf"`);
    return res.sendFile(diskPath);
  } catch (err: any) {
    console.error('[GET /admin/albaranes/:id/pdf]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// POST /admin/albaranes/:id/fotos — adjunta foto vía Attachment (entityType:'albaran').
// Límites (condición 1 del OK): mime allowlist, ~5 MB/foto, máx. 10 fotos, 4xx claros.
// Un albarán firmado está congelado: tampoco admite fotos nuevas.
router.post('/:id/fotos', async (req, res) => {
  try {
    const found = await findAlbaran(req);
    if (!found.ok) return res.status(found.status).json({ error: found.status === 400 ? 'invalid_id' : 'not_found' });
    const { albaran } = found;
    if (albaran.estado === 'firmado') {
      return res.status(409).json({ error: 'albaran_locked', message: 'Un albarán firmado está congelado: no admite fotos nuevas.' });
    }

    const mime = String(req.body?.mime || '');
    if (!FOTO_MIME_ALLOWLIST.includes(mime)) {
      return res.status(415).json({ error: 'mime_no_permitido', message: 'Formatos permitidos: JPEG, PNG o WebP.' });
    }
    // data: base64 puro o data-URI (se tolera el prefijo y se recorta)
    const rawB64 = String(req.body?.data || '').replace(/^data:[^;]+;base64,/, '');
    if (!rawB64) return res.status(400).json({ error: 'foto_vacia', message: 'Falta el contenido de la foto (base64).' });
    let buffer: Buffer;
    try {
      buffer = Buffer.from(rawB64, 'base64');
    } catch {
      return res.status(400).json({ error: 'base64_invalido' });
    }
    if (buffer.length === 0) return res.status(400).json({ error: 'foto_vacia' });
    if (buffer.length > FOTO_MAX_BYTES) {
      return res.status(413).json({ error: 'foto_demasiado_grande', message: 'Cada foto puede ocupar como máximo 5 MB.' });
    }

    const count = await prisma.attachment.count({
      where: { merchantId: req.merchantId, entityType: 'albaran', entityId: albaran.id },
    });
    if (count >= FOTOS_MAX_POR_ALBARAN) {
      return res.status(409).json({ error: 'max_fotos', message: `Máximo ${FOTOS_MAX_POR_ALBARAN} fotos por albarán.` });
    }

    // Patrón MEDIA-1 (attachment.service): create + url al endpoint tenancy-safe
    const att = await prisma.attachment.create({
      data: {
        merchantId: req.merchantId,
        entityType: 'albaran',
        entityId: albaran.id,
        kind: 'photo',
        url: '',
        data: new Uint8Array(buffer),
        mime,
      },
      select: { id: true },
    });
    await prisma.attachment.update({ where: { id: att.id }, data: { url: `/admin/attachments/${att.id}` } });
    return res.status(201).json({ ok: true, attachmentId: att.id, url: `/admin/attachments/${att.id}` });
  } catch (err: any) {
    console.error('[POST /admin/albaranes/:id/fotos]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// GET /admin/albaranes/:id/fotos — lista para la galería de la sección Albaranes.
router.get('/:id/fotos', async (req, res) => {
  try {
    const found = await findAlbaran(req);
    if (!found.ok) return res.status(found.status).json({ error: found.status === 400 ? 'invalid_id' : 'not_found' });
    const fotos = await prisma.attachment.findMany({
      where: { merchantId: req.merchantId, entityType: 'albaran', entityId: found.albaran.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, url: true, mime: true, createdAt: true },
    });
    return res.json(fotos);
  } catch (err: any) {
    console.error('[GET /admin/albaranes/:id/fotos]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// SCRUM-126: traduce el resultado interno del servicio (ok/status) al contrato de cable
// (ok/sent) — ver src/lib/sendOutcome.ts para los 4 niveles. `status` distingue
// PRECONDICIÓN (404/409, nunca se intentó, sin `sent`) de ENVÍO INTENTADO (siempre 200).
function sendResultJson(res: import('express').Response, r: AlbaranFirmadoSendResult) {
  if (r.ok) return res.json(sendSuccessBody());
  if (r.status === 200) {
    return res.status(200).json(sendFailureBody(r.reason as SendFailureReason, { message: r.message }));
  }
  return res.status(r.status).json({ ok: false, error: r.reason, message: r.message });
}

// POST /admin/albaranes/:id/enviar-whatsapp — SCRUM-47: envía la copia FIRMADA al WhatsApp
// del cliente (plantilla `albaran_firmado_es` con el PDF en la cabecera de documento).
// MANUAL (decisión del fundador). S1: "enviar WA" es capacidad de técnico → requireActivePlan,
// SIN requireRole (coherente con /admin/quotes/:id/send-whatsapp). Solo desde 'firmado'.
// Guards completos (V0-2/J3/A3.2/J6/J7/dry-run/WA-0b): los aplica sendWhatsAppTemplate al
// recibir merchantId + log{customerId, relatedType:'albaran', relatedId}. Sin ventana 24h (SCRUM-50).
router.post('/:id/enviar-whatsapp', requireActivePlan, async (req, res) => {
  try {
    // Tenancy (regla 2): findAlbaran garantiza que el albarán es del merchant de la sesión.
    const found = await findAlbaran(req);
    if (!found.ok) return res.status(found.status).json({ error: found.status === 400 ? 'invalid_id' : 'not_found' });
    // La lógica de envío vive en el servicio (reutilizada por el auto-envío de la firma remota, SCRUM-49).
    const r = await sendAlbaranFirmadoWhatsApp(found.albaran.id);
    return sendResultJson(res, r);
  } catch (err: any) {
    console.error('[POST /admin/albaranes/:id/enviar-whatsapp]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// POST /admin/albaranes/:id/enviar-para-firmar — SCRUM-49: manda al cliente el link para FIRMAR
// a distancia (plantilla albaran_para_firmar_es, botón URL → /albaran/:token). Solo desde 'emitido'.
// MANUAL. S1: "enviar WA" ✅ técnico → requireActivePlan, sin requireRole (como el de la 47).
router.post('/:id/enviar-para-firmar', requireActivePlan, async (req, res) => {
  try {
    const found = await findAlbaran(req); // tenancy (regla 2)
    if (!found.ok) return res.status(found.status).json({ error: found.status === 400 ? 'invalid_id' : 'not_found' });
    const r = await sendAlbaranParaFirmarWhatsApp(found.albaran.id);
    return sendResultJson(res, r);
  } catch (err: any) {
    console.error('[POST /admin/albaranes/:id/enviar-para-firmar]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /admin/albaranes/:id/facturar-parcial — SCRUM-170 (FACT-2c) · FACTURAR SOLO PARTE.
 *
 * Se factura la CANTIDAD SERVIDA que se elija de cada línea y el resto queda pendiente. El
 * estado de cobro del albarán no se guarda en ninguna columna: se DERIVA del libro
 * `AlbaranLineaFacturada` (ver `albaranFacturacion.ts`).
 *
 * MISMO CAMINO FISCAL que la recapitulativa de SCRUM-17: `emitInvoice` dentro de la transacción,
 * sellado VeriFactu FUERA y después del commit (SCRUM-173), y ningún documento fiscal en modo
 * justificante — la parcial es una factura, no un J-.
 *
 * ZONA DE DINERO: admin-only, como toda emisión (S1).
 */
router.post('/:id/facturar-parcial', requireRole('admin'), async (req, res) => {
  try {
    const found = await findAlbaran(req); // tenancy (regla 2)
    if (!found.ok) return res.status(found.status).json({ error: found.status === 400 ? 'invalid_id' : 'not_found' });
    const albaran = found.albaran;

    // Las mismas precondiciones que la consolidación, y por los mismos motivos: un parte sin
    // firmar no prueba lo servido, y uno sin precios no puede convertirse en importe.
    if (albaran.estado !== 'firmado') {
      return res.status(409).json({ error: 'albaran_no_firmado', message: `El parte ${albaran.numero} no está firmado. Solo se facturan partes firmados.` });
    }
    if (albaran.modoValoracion !== 'VALORADO') {
      return res.status(409).json({ error: 'albaran_sin_precios', message: `El parte ${albaran.numero} no lleva precios. Edítalo para añadirlos.` });
    }
    if (albaran.invoiceId != null) {
      return res.status(409).json({ error: 'albaran_ya_facturado', message: `El parte ${albaran.numero} ya está facturado entero.` });
    }

    const job = await prisma.job.findFirst({ where: { id: albaran.jobId, merchantId: req.merchantId } });
    if (!job) return res.status(404).json({ error: 'not_found' });

    const merchant = await prisma.merchant.findUnique({
      where: { id: req.merchantId },
      select: { id: true, email: true, country: true, flags: true, defaultCurrency: true, taxId: true },
    });
    if (!merchant) return res.status(404).json({ error: 'not_found' });
    // La parcial es documento FISCAL puro, igual que la recapitulativa: en modo justificante no
    // existe. Mejor no ofrecerla que emitir un J- que después no vale como factura.
    if (getEmissionMode(merchant) === 'receipt') {
      return res.status(409).json({ error: 'facturacion_no_disponible', message: 'La facturación por partes no está disponible en este modo.' });
    }

    const lineas = (Array.isArray(albaran.lineas) ? albaran.lineas : []) as any[];
    const libro = await prisma.albaranLineaFacturada.findMany({
      where: { merchantId: req.merchantId, albaranId: albaran.id },
      select: { lineaIndex: true, cantidad: true, invoiceId: true },
    });
    const pendientes = pendientePorLinea(lineas, facturadoPorLinea(libro));

    const val = validarPeticionParcial(req.body?.lineas, pendientes);
    if (!val.ok) {
      const status = (val.error === 'cantidad_excede_pendiente' || val.error === 'linea_repetida') ? 409 : 400;
      return res.status(status).json({ error: val.error, message: val.message });
    }

    const fechaTxt = new Date(albaran.fecha).toLocaleDateString('es-ES');
    // Mismo formato de concepto que la recapitulativa, más la cantidad facturada: el cliente
    // tiene que poder cuadrar la factura con su parte sin preguntar cuánto se le cobró de qué.
    const invoiceLines = val.lineas.map((l) => ({
      concept: `Albarán ${albaran.numero} (${fechaTxt}): ${l.concepto}${l.unidad ? ` — ${l.pendiente} ${l.unidad}` : ''}`,
      qty: l.pendiente, // en `validarPeticionParcial`, `pendiente` = lo que se factura AHORA
      price: l.precioUnitario,
      tax: l.tipoIva / 100,
    }));
    const bd = calcVatBreakdown(invoiceLines);
    const total = (bd.base + bd.cuota).toFixed(2);

    // SCRUM-246 · ANTES de pedir número. Si no hay nada que cobrar, no se emite y la serie
    // ni se entera: comprobarlo DESPUÉS obligaría a modificar una factura ya numerada o a
    // deshacerla, y deshacer es lo que crea el hueco que hay que justificar ante Hacienda.
    exigirLineasFacturables(invoiceLines);

    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await emitInvoice(tx, {
        merchantId: req.merchantId!, customerId: job.customerId, total,
        currency: merchant.defaultCurrency || 'EUR', type: 'F1',
        lines: invoiceLines,
        albaranRefs: [{ albaranId: albaran.id, numero: albaran.numero, fecha: albaran.fecha }],
        quoteId: null,
        actor: actorDeRequest(req),
      });
      if (isReceiptNumber(inv.number)) throw new Error('facturacion_no_disponible');

      // El libro se escribe DENTRO de la misma transacción que la factura: si algo falla, no
      // queda ni factura sin apunte ni apunte sin factura. Es lo que sostiene la derivación.
      await tx.albaranLineaFacturada.createMany({
        data: val.lineas.map((l) => ({
          merchantId: req.merchantId!, albaranId: albaran.id,
          lineaIndex: l.index, invoiceId: inv.id, cantidad: l.pendiente,
        })),
      });
      return inv;
    });

    // Sellado FUERA de la transacción (SCRUM-173): dentro, las facturas de un lote no se ven
    // entre sí y todas encadenarían al mismo registro anterior. Un fallo aquí NO revierte la
    // emisión —deshacer una factura va contra la regla 29—: se dice en la respuesta.
    // SCRUM-205: el sellado pasa por el punto ÚNICO, después del commit. No lanza: si falla,
    // la factura se queda `pendiente_de_sellado` —donde nació— y en ese estado no produce PDF
    // ni QR (SCRUM-206). Antes esto era un catch que solo escribía en el log.
    const sellada = (await sellarTrasEmision(invoice, merchant, prisma)).estado === SELLADO_HECHO;

    const libroTras = await prisma.albaranLineaFacturada.findMany({
      where: { merchantId: req.merchantId, albaranId: albaran.id },
      select: { lineaIndex: true, cantidad: true, invoiceId: true },
    });
    const facturadoTras = facturadoPorLinea(libroTras);

    return res.status(201).json({
      ok: true,
      factura: { id: invoice.id, number: invoice.number, total: invoice.total.toString(), currency: invoice.currency },
      estadoCobro: estadoCobroAlbaran(lineas, facturadoTras),
      pendientes: pendientePorLinea(lineas, facturadoTras),
      veriFactu: sellada,
      ...(sellada ? {} : { message: 'Se emitió la factura, pero falló su registro VeriFactu. Revísalo antes de entregarla.' }),
    });
  } catch (err: any) {
    // SCRUM-246: no hay nada que cobrar. No se ha emitido NI consumido número, así que el
    // profesional arregla el presupuesto y vuelve — la serie sigue intacta.
    if (esErrorSinLineas(err)) {
      return res.status(409).json({ error: ERROR_SIN_LINEAS, message: COPY_ADMIN_SIN_LINEAS });
    }
    if (err?.message === 'facturacion_no_disponible') {
      return res.status(409).json({ error: 'facturacion_no_disponible', message: 'La facturación por partes no está disponible en este modo.' });
    }
    console.error('[POST /admin/albaranes/:id/facturar-parcial]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * SCRUM-290 · TODO texto de esta ruta está SIN APROBAR y se pinta con el marcador.
 *
 * Regla 30, y aquí con una capa más: estos mensajes le dicen a un profesional **qué puede y qué no
 * puede cobrarle a su cliente**. Un texto legal mal escrito no es feo, es peligroso. La procedencia
 * de la aprobación que falta está en `docs/legal/PREGUNTAS_ASESOR.md` §G (preguntas 25-28); la 25
 * es la bloqueante. El marcador es feo A PROPÓSITO: un texto provisional que se lee bien se queda
 * para siempre, y un relleno que se pinta es peor que un hueco porque parece intencionado.
 */
const MICROCOPY_PENDIENTE_290 = '[PENDIENTE microcopy oficial]';

/**
 * POST /admin/albaranes/:id/convertir-en-factura — SCRUM-290 (A0.4)
 *
 * CANTIDADES DEL ALBARÁN · PRECIOS DEL PRESUPUESTO FIRMADO. El criterio no vive aquí: vive en
 * `albaranAFactura.ts`, en funciones puras, para poder probarlo sin levantar la app. Esta ruta
 * consulta, decide con lo que aquél dice, y emite.
 *
 * ⚠️ ES UN LLAMADOR DE `emitInvoice`, NO UNA VÍA DE EMISIÓN NUEVA (regla 38). Nada de
 * `invoicing/` se ha tocado: `EmitInvoiceInput` ya aceptaba `lines`, `albaranRefs`, `quoteId`,
 * `total` y `actor`.
 *
 * ── EN QUÉ SE DIFERENCIA DE `facturar-parcial` ─────────────────────────────────────────────
 * Aquélla exige `VALORADO` y saca los precios del PROPIO ALBARÁN. **Ésta es para el albarán
 * NORMAL** —`SIN_VALORAR`, el valor por defecto y la decisión viva del 2-ago: el parte no lleva
 * precios para no obligar a teclear en obra—. Hasta hoy ese albarán no se podía facturar de
 * ninguna manera. No se solapan.
 *
 * ── LO QUE NO SE FACTURA SALE EN LA RESPUESTA, NOMBRADO ────────────────────────────────────
 * Lo añadido en obra no entra en la factura: dispara un PRESUPUESTO ADICIONAL que se firma. Se
 * devuelve en `paraAdicional` con su motivo para que la pantalla lo ofrezca. Descartarlo en
 * silencio en un documento que alguien firma es SCRUM-271.
 */
router.post('/:id/convertir-en-factura', requireRole('admin'), async (req, res) => {
  try {
    const found = await findAlbaran(req); // tenancy (regla 2)
    if (!found.ok) return res.status(found.status).json({ error: found.status === 400 ? 'invalid_id' : 'not_found' });
    const albaran = found.albaran;

    // Solo FIRMADO: un parte sin firmar no prueba lo servido, y facturar lo no probado es
    // exactamente lo que esta pantalla existe para evitar.
    if (albaran.estado !== 'firmado') {
      return res.status(409).json({ error: 'albaran_no_firmado', message: MICROCOPY_PENDIENTE_290 });
    }
    if (albaran.invoiceId != null) {
      return res.status(409).json({ error: 'albaran_ya_facturado', message: MICROCOPY_PENDIENTE_290 });
    }

    const job = await prisma.job.findFirst({
      where: { id: albaran.jobId, merchantId: req.merchantId },
      select: { id: true, customerId: true, quoteId: true },
    });
    if (!job) return res.status(404).json({ error: 'not_found' });

    const merchant = await prisma.merchant.findUnique({
      where: { id: req.merchantId },
      select: { id: true, email: true, country: true, flags: true, defaultCurrency: true, taxId: true },
    });
    if (!merchant) return res.status(404).json({ error: 'not_found' });
    // Documento FISCAL puro, igual que la parcial y la recapitulativa: en modo justificante no
    // existe. Mejor no ofrecerla que emitir un J- que después no vale como factura (reglas 24/26).
    if (getEmissionMode(merchant) === 'receipt') {
      return res.status(409).json({ error: 'facturacion_no_disponible', message: MICROCOPY_PENDIENTE_290 });
    }

    // EL PRESUPUESTO FIRMADO, que es de donde salen los precios. Filtra por merchant (regla 2):
    // sin eso se cobrarían los precios del presupuesto de OTRO profesional.
    const quote = job.quoteId
      ? await prisma.quote.findFirst({
          where: { id: job.quoteId, merchantId: req.merchantId },
          select: { id: true, quoteNumber: true, lines: true },
        })
      : null;

    // Lo ya facturado se acumula sobre TODOS los albaranes del Trabajo, no solo sobre éste: dos
    // partes distintos pueden entregar la misma línea del presupuesto por fases.
    const albaranesDelJob = await prisma.albaran.findMany({
      where: { merchantId: req.merchantId, jobId: job.id },
      select: { id: true, lineas: true },
    });
    const libro = await prisma.albaranLineaFacturada.findMany({
      where: { merchantId: req.merchantId, albaranId: { in: albaranesDelJob.map((a) => a.id) } },
      select: { albaranId: true, lineaIndex: true, cantidad: true },
    });

    const lineasAlbaran = (Array.isArray(albaran.lineas) ? albaran.lineas : []) as any[];
    const casacion = casarLineas(
      lineasAlbaran,
      (Array.isArray(quote?.lines) ? quote!.lines : []) as any[],
      yaFacturadoPorLineaDePresupuesto(albaranesDelJob as any, libro as any),
    );

    // EL SUELO. Si el casador no encontró nada, NO se emite. Una factura con cero líneas es un
    // documento fiscal que no dice nada, y una factura emitida no se edita ni se borra (regla 29).
    const motivos = motivosParaNoEmitir(casacion, !!quote);
    if (motivos.length) {
      return res.status(409).json({
        error: 'albaran_no_convertible',
        motivos,                       // en claro: son DIAGNÓSTICO, no microcopy de pantalla
        message: MICROCOPY_PENDIENTE_290,
        paraAdicional: casacion.paraAdicional,
      });
    }

    const fechaTxt = new Date(albaran.fecha).toLocaleDateString('es-ES');
    // Mismo formato de concepto que la parcial y la recapitulativa: el cliente tiene que poder
    // cuadrar la factura con su parte sin preguntar cuánto se le cobró de qué.
    const facturables = casacion.facturables;
    const invoiceLines = lineasParaFactura(facturables).map((l, i) => ({
      ...l,
      concept: `Albarán ${albaran.numero} (${fechaTxt}): ${l.concept} — ${facturables[i].cantidad}`,
    }));
    const total = totalDeFacturables(facturables);

    // SCRUM-246 · ANTES de pedir número: si no hay nada que cobrar, la serie ni se entera.
    // Comprobarlo después obligaría a deshacer una factura ya numerada, y deshacer es lo que crea
    // el hueco que hay que justificar ante Hacienda.
    exigirLineasFacturables(invoiceLines);

    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await emitInvoice(tx, {
        merchantId: req.merchantId!, customerId: job.customerId, total,
        currency: merchant.defaultCurrency || 'EUR', type: 'F1',
        lines: invoiceLines,
        albaranRefs: [{ albaranId: albaran.id, numero: albaran.numero, fecha: albaran.fecha }],
        // A DIFERENCIA de la parcial, aquí SÍ va el presupuesto: es de donde salen los precios, y
        // es lo que permite auditar después que se cobró lo que el cliente firmó.
        quoteId: quote!.id,
        actor: actorDeRequest(req),
      });
      if (isReceiptNumber(inv.number)) throw new Error('facturacion_no_disponible');

      // El libro, DENTRO de la misma transacción que la factura: si algo falla no queda ni
      // factura sin apunte ni apunte sin factura. Es lo que sostiene el acumulado por fases.
      await tx.albaranLineaFacturada.createMany({
        data: facturables.map((l) => ({
          merchantId: req.merchantId!, albaranId: albaran.id,
          lineaIndex: l.lineaIndex, invoiceId: inv.id, cantidad: l.cantidad,
        })),
      });
      return inv;
    });

    // Sellado FUERA de la transacción (SCRUM-173/205): dentro, las facturas de un lote no se ven
    // entre sí. Un fallo aquí NO revierte la emisión —deshacer va contra la regla 29—: se dice.
    const sellada = (await sellarTrasEmision(invoice, merchant, prisma)).estado === SELLADO_HECHO;

    // ── EL PRESUPUESTO ADICIONAL ───────────────────────────────────────────────────────────
    //
    // Lo añadido en obra no se factura: se convierte en un adicional que el cliente firma. Se crea
    // **enganchado al Trabajo** (`Quote.jobId`), que es el camino de SCRUM-195 — aceptarlo NO crea
    // un segundo Trabajo porque `ensureJobForQuote` pregunta primero por `Quote.jobId`.
    //
    // ⚠️ FUERA de la transacción de la factura, y por el mismo motivo que el sellado: si esto
    // falla, la factura ya emitida **no se revierte** (regla 29). Se dice en la respuesta.
    //
    // ⚠️ NACE EN `draft` Y NO SE MANDA SOLO. Sus líneas van sin precio —es trabajo nuevo, no hay
    // referencia firmada de la que sacarlo— así que el profesional tiene que ponerles importe
    // antes de enviarlo. Mandar al cliente un documento a 0 € para que lo firme sería pedirle que
    // firme la nada.
    const lineasAdicional = lineasParaAdicional(casacion.paraAdicional);
    let adicional: { id: number; quoteNumber: number | null } | null = null;
    let falloAdicional = false;
    if (lineasAdicional.length > 0) {
      try {
        adicional = await prisma.$transaction(async (tx) => {
          const quoteNumber = await allocateQuoteNumber(tx, req.merchantId!);
          const creado = await tx.quote.create({
            data: {
              merchantId: req.merchantId!, customerId: job.customerId, quoteNumber,
              status: 'draft',
              total: '0.00',
              currency: merchant.defaultCurrency || 'EUR',
              lines: lineasAdicional as any,
              jobId: job.id, // SCRUM-195: con valor = ADICIONAL sobre este Trabajo
            },
            select: { id: true, quoteNumber: true },
          });
          return creado;
        });
      } catch (e: any) {
        // No se relanza: la factura ya está emitida y deshacerla va contra la regla 29. Se avisa.
        falloAdicional = true;
        console.error('[POST /admin/albaranes/:id/convertir-en-factura] adicional', e?.message || e);
      }
    }

    return res.status(201).json({
      ok: true,
      factura: { id: invoice.id, number: invoice.number, total: invoice.total.toString(), currency: invoice.currency },
      // LO QUE NO SE FACTURÓ, nombrado y con su motivo. Nada desaparece sin decirlo (SCRUM-271).
      paraAdicional: casacion.paraAdicional,
      // El adicional creado, o `null` si no había nada fuera de presupuesto. `null` NO es un fallo:
      // es que no hacía falta. El fallo se dice aparte, para que no se confundan.
      adicional,
      adicionalFallido: falloAdicional,
      veriFactu: sellada,
      ...(sellada && !falloAdicional ? {} : { message: MICROCOPY_PENDIENTE_290 }),
    });
  } catch (err: any) {
    if (esErrorSinLineas(err)) {
      return res.status(409).json({ error: ERROR_SIN_LINEAS, message: COPY_ADMIN_SIN_LINEAS });
    }
    if (err?.message === 'facturacion_no_disponible') {
      return res.status(409).json({ error: 'facturacion_no_disponible', message: MICROCOPY_PENDIENTE_290 });
    }
    console.error('[POST /admin/albaranes/:id/convertir-en-factura]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
