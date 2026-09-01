import { Router } from 'express';
import { listCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer, ensurePortalToken } from '../../customerAdmin';
import { config } from '../../../../core/config/env';
import { customerCreateSchema, customerUpdateSchema } from '../../../../core/validation/schemas';
import { prisma } from '../../../../core/db/prisma';
import { listCustomerEvents } from '../../customerEvents.service';
import { requireRole } from '../../../../core/http/authMiddleware'; // SCRUM-55 (D2: borrado = admin)
// SCRUM-578 (CONT-05): el aviso de duplicado. La lista de campos identificadores vive en UN sitio.
import {
  buscarCoincidencias, formasBuscables, canonEmail, canonNif,
} from '../../domain/identificadoresDuplicados';

// SCRUM-312 (D1): el CSV se parsea en el SERVIDOR, con las primitivas compartidas. Antes lo
// hacia el navegador, y eso dejaba dos parseos vivos del mismo formato que ni siquiera eran
// equivalentes (el del navegador no honraba `""` ni el BOM).
import { trocearCsv } from '../../../../core/csv/csv';
import {
  decodificarCsv, proponerMapeo, importarClientes, csvDeRechazos,
  type Codificacion, type CampoCliente,
} from '../../domain/importarClientes.service';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const search = req.query.search ? String(req.query.search) : undefined;
    const customers = await listCustomers(req.merchantId, search);
    res.json(customers);
  } catch (err) {
    console.error('[GET /admin/customers]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });
    const customer = await getCustomer(req.merchantId, id);
    if (!customer) return res.status(404).json({ error: 'not_found' });
    res.json(customer);
  } catch (err) {
    console.error('[GET /admin/customers/:id]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * GET /admin/customers/duplicados — SCRUM-578 (CONT-05, punto c).
 *
 * ¿Alguno de estos identificadores YA lo usa otro cliente de este merchant?
 *
 * 🔴 ES SOLO LECTURA Y ES UN AVISO, NO UN BLOQUEO. No impide guardar nada, y por eso vive en un
 * GET aparte en vez de dentro del POST: hay casos legítimos —marido y mujer con el mismo móvil,
 * dos comunidades del mismo administrador con el mismo email— y el que decide es el profesional.
 *
 * Va ANTES de `/:id` a propósito: `duplicados` no es un id, pero si esta ruta se registrara
 * después, `/:id` la capturaría y devolvería `invalid_id`. Es la misma precaución que ya toma
 * `albaranes.routes.ts` con `/pendientes-facturar`.
 *
 * NO se lee la tabla entera: se pregunta por las FORMAS BUSCABLES del valor —con prefijo y sin
 * él— para que el filtro lo pueda resolver el índice. Un `findMany` sin `where` funcionaría con
 * 15 clientes y sería una bomba con 15.000.
 */
router.get('/duplicados', async (req, res) => {
  try {
    const phone = typeof req.query.phone === 'string' ? req.query.phone : null;
    const email = typeof req.query.email === 'string' ? req.query.email : null;
    const taxId = typeof req.query.taxId === 'string' ? req.query.taxId : null;
    const excluirId = Number(req.query.excluirId);

    const or: any[] = [];
    for (const forma of formasBuscables(phone)) or.push({ phone: forma });
    if (canonEmail(email)) or.push({ email: { equals: email!.trim(), mode: 'insensitive' } });
    if (canonNif(taxId)) or.push({ taxId: { equals: taxId!.trim(), mode: 'insensitive' } });
    // Sin ningún identificador que buscar no se consulta: devolver «todos» sería el peor default.
    if (or.length === 0) return res.json({ coincidencias: [] });

    const candidatos = await prisma.customer.findMany({
      where: { merchantId: req.merchantId, OR: or },
      select: { id: true, name: true, phone: true, email: true, taxId: true },
    });

    // El filtro de arriba es AMPLIO a propósito (lo que el índice sabe resolver); quien decide de
    // verdad es la comparación canónica, que es la que entiende que `+34 …` y `…` son lo mismo.
    const coincidencias = buscarCoincidencias(
      { id: Number.isNaN(excluirId) ? 0 : excluirId, phone, email, taxId },
      candidatos,
    );

    // Se devuelve el nombre para que el aviso pueda decir CON QUIÉN choca. El texto es del
    // fundador (regla 30): aquí sólo viajan los datos.
    const porId = new Map(candidatos.map((c) => [c.id, c.name]));
    res.json({
      coincidencias: coincidencias.map((c) => ({ ...c, customerName: porId.get(c.customerId) ?? null })),
    });
  } catch (err) {
    console.error('[GET /admin/customers/duplicados]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const parsed = customerCreateSchema.parse(req.body);
    const customer = await createCustomer(req.merchantId, parsed);
    res.status(201).json(customer);
  } catch (err: any) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: 'validation_error', details: err.errors });
    console.error('[POST /admin/customers]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });
    const parsed = customerUpdateSchema.parse(req.body);
    await updateCustomer(req.merchantId, id, parsed);
    const updated = await getCustomer(req.merchantId, id);
    res.json(updated);
  } catch (err: any) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: 'validation_error', details: err.errors });
    console.error('[PUT /admin/customers/:id]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /admin/customers/:id/portal-url — genera token si no existe, devuelve URL del portal
router.get('/:id/portal-url', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });
    const token = await ensurePortalToken(req.merchantId, id);
    const portalUrl = `${config.PUBLIC_BASE_URL}/cliente/${token}`;
    return res.json({ portalUrl, token });
  } catch (err: any) {
    if (err.message === 'customer_not_found') return res.status(404).json({ error: 'not_found' });
    console.error('[GET /admin/customers/:id/portal-url]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /admin/customers/import/preparar — PASO 1: leer el fichero y PROPONER.
 *
 * Devuelve la primera fila ya decodificada (para la pantalla «¿Se ven bien los acentos?») y el
 * mapeo propuesto con su confianza (para «Esto es lo que hemos entendido»). NO escribe nada.
 *
 * `codificacion` opcional: cuando el usuario pulsa «No, prueba de otra forma», el navegador la
 * manda y aqui se reintenta con la otra — no se adivina dos veces lo mismo.
 */
router.post('/import/preparar', requireRole('admin'), async (req, res) => {
  try {
    const base64 = String(req.body?.fichero ?? '');
    if (!base64) return res.status(400).json({ error: 'no_data', message: 'No hemos recibido ningún archivo. Vuelve a elegirlo.' });

    const forzar = req.body?.codificacion as Codificacion | undefined;
    const d = decodificarCsv(Buffer.from(base64, 'base64'), forzar);
    const { cabecera } = trocearCsv(d.texto);
    if (cabecera.length === 0) {
      return res.status(400).json({ error: 'csv_vacio', message: 'El archivo no tiene ninguna fila.' });
    }

    return res.json({
      ok: true,
      codificacion: d.codificacion,
      alternativa: d.alternativa,
      primeraFila: d.primeraFila,
      columnas: proponerMapeo(cabecera),
    });
  } catch (err) {
    console.error('[POST /admin/customers/import/preparar]', err);
    return res.status(500).json({ error: 'internal_error', message: 'No hemos podido leer el archivo.' });
  }
});

// POST /admin/customers/import — importación masiva desde CSV (parseo en cliente, batch en servidor)
router.post('/import', requireRole('admin'), async (req, res) => {
  try {
    // PASO 2: el fichero otra vez + la codificacion y el mapeo YA CONFIRMADOS por el usuario.
    // Aqui no se adivina nada: si falta el mapeo, se dice.
    const base64 = String(req.body?.fichero ?? '');
    if (!base64) return res.status(400).json({ error: 'no_data', message: 'No hemos recibido ningún archivo. Vuelve a elegirlo.' });

    const mapeo = (req.body?.mapeo ?? {}) as Partial<Record<CampoCliente, number>>;
    if (mapeo.name == null) {
      return res.status(400).json({
        error: 'sin_columna_nombre',
        message: 'Dinos cuál es la columna del nombre: sin ella no podemos crear los clientes.',
      });
    }

    const { texto } = decodificarCsv(Buffer.from(base64, 'base64'), req.body?.codificacion as Codificacion | undefined);

    // Tope de filas, como antes. El limite es del lote, no del formato.
    const { filas } = trocearCsv(texto);
    if (filas.length === 0) return res.status(400).json({ error: 'no_data', message: 'El archivo no tiene ninguna fila de datos.' });
    if (filas.length > 500) return res.status(400).json({ error: 'too_many_rows', max: 500, message: 'Este archivo tiene más de 500 filas. Divídelo en varios y súbelos de uno en uno.' });

    // TENENCIA: el merchant sale de la sesion, JAMAS del cuerpo (regla 2). Un import no puede
    // meter clientes en el merchant de otro.
    const r = await importarClientes(req.merchantId as number, texto, mapeo, prisma.customer);

    return res.json({
      ok: true,
      creados: r.creados,
      omitidos: r.omitidos,
      // TODAS las rechazadas, sin capar a 10: el ticket lo pide explicito y capar era el
      // defecto que tenia el importador viejo.
      rechazos: r.rechazos.map((x) => ({ fila: x.fila, motivo: x.motivo })),
      // El CSV para «Descargar las filas con errores», ya listo.
      csvRechazos: r.rechazos.length ? csvDeRechazos(r) : null,
    });
  } catch (err: any) {
    if (err?.message === 'sin_columna_nombre') {
      return res.status(400).json({
        error: 'sin_columna_nombre',
        message: 'Dinos cuál es la columna del nombre: sin ella no podemos crear los clientes.',
      });
    }
    console.error('[POST /admin/customers/import]', err);
    return res.status(500).json({ error: 'internal_error', message: 'No hemos podido importar el archivo.' });
  }
});

// GET /admin/customers/:id/detail — vista 360: historial completo del cliente
router.get('/:id/detail', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });

    const customer = await prisma.customer.findFirst({
      where: { id, merchantId: req.merchantId },
      select: { id: true, name: true, phone: true, email: true, notes: true, portalToken: true, createdAt: true, waOptOut: true },
    });
    if (!customer) return res.status(404).json({ error: 'not_found' });

    const [quotes, invoices, expenses, events] = await Promise.all([
      prisma.quote.findMany({
        where: { customerId: id, merchantId: req.merchantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, quoteNumber: true, status: true, total: true, currency: true, createdAt: true, acceptedAt: true },
      }),
      prisma.invoice.findMany({
        where: { customerId: id, merchantId: req.merchantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, number: true, status: true, total: true, currency: true, createdAt: true, paidAt: true, pdfUrl: true },
      }),
      prisma.expense.aggregate({
        where: { merchantId: req.merchantId, quote: { customerId: id } },
        _sum: { amount: true },
      }),
      listCustomerEvents(req.merchantId, id, 50),
    ]);

    const totalBilled = invoices.reduce((a, i) => a + Number(i.total), 0);
    const totalPaid   = invoices.filter(i => i.status === 'paid').reduce((a, i) => a + Number(i.total), 0);
    const portalUrl   = customer.portalToken
      ? `${config.PUBLIC_BASE_URL}/cliente/${customer.portalToken}`
      : null;

    return res.json({
      customer: { ...customer, portalUrl },
      quotes,
      invoices,
      events,
      stats: {
        totalQuotes:   quotes.length,
        acceptedQuotes: quotes.filter(q => q.status === 'accepted').length,
        totalBilled,
        totalPaid,
        totalExpenses: Number(expenses._sum.amount ?? 0),
        profit: totalPaid - Number(expenses._sum.amount ?? 0),
      },
    });
  } catch (err) {
    console.error('[GET /admin/customers/:id/detail]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// SCRUM-55 (D2 del fundador): borrado DURO (`customer.deleteMany`) e irreversible,
// que además arrastra el historial del cliente → admin. AA1.4 lo lista como stop
// condition ("datos de clientes: export/borrado").
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });
    await deleteCustomer(req.merchantId, id);
    res.status(204).send();
  } catch (err) {
    console.error('[DELETE /admin/customers/:id]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
