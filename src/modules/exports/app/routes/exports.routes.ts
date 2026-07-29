// src/modules/exports/app/routes/exports.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { config, isVerifiedPlatformOwner } from '../../../../core/config/env';
import { isFlagEnabled } from '../../../../core/flags';
import { requireRole } from '../../../../core/http/authMiddleware';
import {
  recordAudit,
  requestIp,
  // SCRUM-221 (A9): el export fiscal se registra por la puerta BLOQUEANTE y con el sobre de
  // SCRUM-207 — actor declarado (`pro_propietario` | `pro_equipo`), no un `?? null` que hay
  // que interpretar, y flags fiscales CONGELADOS en el momento del hecho.
  recordAuditOrThrow,
  sobreFiscal,
  actorDeRequest,
  flagsFiscalesDe,
} from '../../../system/audit.service';
import { estadoCobroFor } from '../../../jobs/domain/job.service';
// SCRUM-25 (B): paquete ZIP. `archiver` hace streaming real (.pipe + backpressure);
// jszip se descartó porque carga todo en memoria.
// ⚠️ archiver 8 cambió la API: ya NO exporta la función `archiver('zip', opts)` de v5/v6,
// sino clases (`ZipArchive extends stream.Transform`). Se instancia con `new`.
import { ZipArchive } from 'archiver';
import fs from 'fs';
import { ensureInvoicePdf } from '../../../../lib/invoicing';
import { buildVerifactuRegistrosXml } from '../../../invoicing/domain/verifactu.service'; // SCRUM-82
import { invalidAnioFiscal } from '../../../../core/validation/fiscalInput'; // SCRUM-217
import {
  construirCsvsDelPaquete, csvBody, csvRow, csvNum, MAX_FACTURAS_ZIP, resolverEntregaZip, construirLeeme,
  buildClientes, buildFacturas, buildCobros, buildTrabajos, buildPresupuestos,
  EXPORT_PDF_CONCURRENCIA, // SCRUM-83
} from '../../domain/exportData';
import { mapearConLimite } from '../../../../core/utils/concurrencia'; // SCRUM-83
import { resolverSeleccion } from '../../domain/seleccionExport'; // SCRUM-138 (export selectivo)

const router = Router();

// SCRUM-25 (S2/S4): deja traza de cada descarga de datos. Fire-safe (recordAudit
// nunca tumba la petición). `rango` documenta el filtro aplicado, para saber qué
// se llevó exactamente quien exportó.
function auditExport(
  req: any,
  fichero: string,
  rango: { from: Date | null; to: Date | null },
  extra: Record<string, unknown> = {},
) {
  recordAudit({
    merchantId: req.merchantId,
    teamMemberId: req.teamMemberId ?? null,
    action: 'datos_exportados',
    entityType: 'export',
    meta: {
      fichero,
      from: rango.from ? rango.from.toISOString().slice(0, 10) : null,
      to: rango.to ? rango.to.toISOString().slice(0, 10) : null,
      // El ZIP añade aquí si salió completo o parcial (SCRUM-25 B).
      ...extra,
    },
    ip: requestIp(req),
  });
}

// ── helpers ───────────────────────────────────────────────────────────────

// SCRUM-86: el formato del CSV (separador `;`, coma decimal, escapado) vive en
// domain/exportData — una sola definición para las rutas sueltas y para el ZIP.

function parseDateFilter(q: Record<string, unknown>) {
  const from = q.from ? new Date(String(q.from)) : null;
  const to   = q.to   ? new Date(String(q.to))   : null;
  if (to) to.setHours(23, 59, 59, 999);
  return { from, to };
}

function sendCsv(res: any, filename: string, header: string[], rows: string[]) {
  // El BOM va SOLO aquí para la descarga suelta; el del paquete lo pone `csvBody`.
  // Son dos caminos distintos, nunca encadenados: dos BOM harían que Excel enseñara
  // basura en la primera celda de la cabecera.
  const bom  = '﻿'; // UTF-8 BOM para que Excel no rompa los acentos
  const body = [csvRow(header), ...rows].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(bom + body);
}

// ── GET /admin/exports/datos.zip/info ─────────────────────────────────────
// SCRUM-25 (E): cuántas facturas caen en el rango y cuál es el tope. La card de
// Configuración lo consulta ANTES de que el usuario pulse, para avisar de entrada en
// vez de soltarle un 409 después. El tope viaja desde aquí para que MAX_FACTURAS_ZIP
// siga siendo la ÚNICA fuente del número (no se duplica en el front).
router.get('/datos.zip/info', async (req, res) => {
  try {
    const { from, to } = parseDateFilter(req.query as any);
    // SCRUM-138: el tope es de FACTURAS (lo caro es renderizar sus PDF, medición de
    // SCRUM-83). Si la selección no las incluye, no hay nada que contar ni tope que avisar —
    // avisarlo igual mandaría al usuario a acotar fechas por un fichero que no ha pedido.
    // `xmlPermitido: false` a propósito: aquí no se genera XML, solo se cuenta.
    const seleccion = resolverSeleccion(req.query.incluir, false);
    if (!seleccion.pdfs) {
      return res.json({ facturas: 0, maximo: MAX_FACTURAS_ZIP, excede: false });
    }
    const facturas = await prisma.invoice.count({
      where: {
        merchantId: req.merchantId,
        ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
    });
    return res.json({ facturas, maximo: MAX_FACTURAS_ZIP, excede: facturas > MAX_FACTURAS_ZIP });
  } catch (err) {
    console.error('[exports/datos.zip/info]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /admin/exports/datos.zip ──────────────────────────────────────────
// SCRUM-25 (S4): "la base de datos descargable" — el paquete que el merchant entrega
// a su asesor o a una inspección. Contiene /csv (5 tablas) y /facturas (los PDF).
// ?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// STREAMING OBLIGATORIO: `archive.pipe(res)` y cada PDF con `createReadStream` sobre el
// diskPath que devuelve ensureInvoicePdf, UNO A UNO. Jamás readFileSync ni acumular en
// un buffer: un merchant con cientos de facturas tumbaría el proceso.
//
// ⚠️ El XML VeriFactu solo entra si INVOICING_ES_ENABLED (regla 24/26), reutilizando el
// gate de SCRUM-73. Con el flag OFF se omite EN SILENCIO: el ZIP se genera igual y sin
// error — un XML construido sobre justificantes (J-) no serían registros válidos.
router.get('/datos.zip', async (req, res) => {
  const { from, to } = parseDateFilter(req.query as any);
  try {
    const merchant = await prisma.merchant.findUnique({ where: { id: req.merchantId } });
    if (!merchant) return res.status(404).json({ error: 'not_found' });

    // ── SCRUM-138: qué se lleva el paquete ──────────────────────────────────
    // El gate del XML se calcula ANTES y con el criterio de SIEMPRE (SCRUM-73: flag +
    // país + NIF). `resolverSeleccion` solo puede APAGARLO (si no pides facturas), nunca
    // encenderlo: pedir "facturas" no salta la regla 24.
    const xmlPermitido = isFlagEnabled('INVOICING_ES_ENABLED', { merchant })
      && merchant.country === 'ES' && !!merchant.taxId;
    const seleccion = resolverSeleccion(req.query.incluir, xmlPermitido);

    // Facturas del rango: solo ids + número (el PDF se genera después, de una en una).
    // createdAt: SCRUM-82 la necesita para saber qué AÑOS naturales toca el rango (el XML
    // VeriFactu se genera por ejercicio, no por el rango pedido — ver más abajo).
    // SCRUM-138: si no se piden facturas no se consultan siquiera — un export de "solo
    // gastos" no debe pagar el render de cien PDF que nadie va a recibir (coste de SCRUM-83).
    const invoices = seleccion.pdfs ? await prisma.invoice.findMany({
      where: {
        merchantId: req.merchantId,
        ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      select: { id: true, number: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }) : [];

    // Tope provisional (MAX_FACTURAS_ZIP, medición §7): por encima, la espera sin recibir
    // un solo byte se dispara. Se corta ANTES de renderizar nada y se explica qué hacer.
    if (invoices.length > MAX_FACTURAS_ZIP) {
      return res.status(409).json({
        error: 'demasiadas_facturas',
        facturas: invoices.length,
        maximo: MAX_FACTURAS_ZIP,
        message: `Tu rango incluye ${invoices.length} facturas y el máximo por descarga es ${MAX_FACTURAS_ZIP}. Acota el rango de fechas y descarga por partes.`,
      });
    }

    // ── FASE 1: resolver los PDF ANTES de escribir una sola cabecera ────────
    // Esto es un entregable para una INSPECCIÓN: un paquete al que le faltan facturas
    // pero parece correcto es PEOR que uno que falla. El nombre del fichero tiene que
    // poder decir la verdad, y `Content-Disposition` se envía antes que el cuerpo →
    // hay que saber si el paquete está completo ANTES de empezar a transmitir.
    // No añade trabajo: `ensureInvoicePdf` solo renderiza si el fichero falta; lo único
    // que cambia es el ORDEN (todo el render ocurre antes del primer byte).
    //
    // SCRUM-83 (paso 2): esto era un `for` secuencial y ahora van EXPORT_PDF_CONCURRENCIA en
    // vuelo. Lo que NO cambia, y es lo que había que no romper:
    //   · el ORDEN. `mapearConLimite` devuelve en orden de entrada, así que los PDF entran al
    //     paquete por orden de factura y `fallidos` se lista igual que antes. Que el orden
    //     dependiera de quién terminase primero haría el ZIP no reproducible.
    //   · que un PDF roto NO tumbe el paquete pero SÍ lo marque incompleto: por eso el
    //     try/catch va DENTRO de la función y devuelve un resultado etiquetado, en vez de
    //     dejar que el rechazo se propague y se lleve por delante las 99 facturas buenas.
    //   · que todo esto siga ocurriendo ANTES de la primera cabecera (ver el comentario de
    //     arriba): el paquete tiene que saber si está completo para poder nombrarse.
    type Resuelto =
      | { ok: true; numero: string; diskPath: string }
      | { ok: false; numero: string };

    const resueltos = await mapearConLimite<typeof invoices[number], Resuelto>(
      invoices,
      EXPORT_PDF_CONCURRENCIA,
      async (inv) => {
        try {
          const { diskPath } = await ensureInvoicePdf(inv.id, prisma);
          if (!fs.existsSync(diskPath)) return { ok: false, numero: inv.number };
          return { ok: true, numero: inv.number, diskPath };
        } catch (e: any) {
          console.error(`[exports/datos.zip] PDF ${inv.number}:`, e?.message || e);
          return { ok: false, numero: inv.number };
        }
      },
    );

    const listos: Array<{ numero: string; diskPath: string }> = resueltos
      .filter((r): r is Extract<Resuelto, { ok: true }> => r.ok)
      .map(({ numero, diskPath }) => ({ numero, diskPath }));
    const fallidos: string[] = resueltos.filter((r) => !r.ok).map((r) => r.numero);
    const pdfsOk = listos.length;

    // ── FASE 1b: VeriFactu — gate de SCRUM-73 (INVOICING_ES_ENABLED), reutilizado tal
    // cual. Un XML por AÑO NATURAL que toque el rango pedido, no por el rango en sí: el
    // registro RRSIF se organiza por ejercicio y la cadena de huellas es anual — recortar
    // por meses rompería el encadenamiento, y mezclar años no representaría un registro
    // válido (decisión del fundador, SCRUM-82).
    //
    // ⚠️ ASIMETRÍA DELIBERADA con los PDFs de arriba: un PDF que falla se anota en
    // `fallidos` y el paquete sigue (aviso, no error). Un XML VeriFactu que falla ABORTA
    // el ZIP entero, ANTES de la primera cabecera — nunca "el LEEME dice que incluye
    // VeriFactu" sobre un paquete al que realmente le falta. Mejor un error explícito que
    // un entregable de inspección que miente sobre su propio contenido.
    // SCRUM-138: el gate de SCRUM-73 sigue mandando; la selección solo puede quitar el XML
    // (si no pides facturas), jamás ponerlo. Ver resolverSeleccion: es un AND, no un OR.
    const conXml = seleccion.xml;

    const xmlPorAnio: Array<{ year: number; xml: string }> = [];
    // 209 ↔ 221: las dos cuentan cosas DISTINTAS del mismo paquete y las dos hacen falta.
    // No era una elección entre ramas: era una combinación.
    //
    // SCRUM-221: cuántos registros RRSIF salen de verdad en el paquete. Lo cuenta el
    // constructor, no se deduce de `invoices.length` — no es lo mismo una factura que un
    // registro declarado, y el número que va al AuditLog tiene que ser el real.
    let registrosVerifactu = 0;
    // SCRUM-209: facturas que NO se han podido declarar. No abortan el paquete —el resto del
    // ejercicio sale— pero se nombran ARRIBA del LEEME, donde ya se avisa de un paquete
    // incompleto. Una factura omitida en silencio de un registro fiscal es peor que el fallo.
    const exclusionesVerifactu: Array<{ year: number; number: string; motivo: string }> = [];
    if (conXml) {
      const anios = [...new Set(invoices.map((inv) => inv.createdAt.getFullYear()))].sort();
      try {
        for (const year of anios) {
          // Los TRES del constructor: el XML, cuántos registros declaró (221) y cuáles no
          // pudo declarar (209). `count` viene de `registros.length`, no de las facturas
          // miradas — verificado en `verifactu.service.ts:765` al resolver este conflicto,
          // porque si el constructor hubiera dejado de devolverlo, `registrosVerifactu +=
          // undefined` habría puesto un NaN en el AuditLog y eso no lo canta nadie.
          const { xml, count, excluidos } = await buildVerifactuRegistrosXml({ merchantId: req.merchantId, year });
          xmlPorAnio.push({ year, xml });
          registrosVerifactu += count;
          for (const x of excluidos) exclusionesVerifactu.push({ year, ...x });
        }
      } catch (e: any) {
        console.error('[exports/datos.zip] VeriFactu XML error:', e?.message || e);
        return res.status(500).json({
          error: 'verifactu_xml_failed',
          message: 'No se pudo generar el registro VeriFactu del paquete. No se ha entregado ningún archivo — mejor un error que un paquete incompleto sin avisar.',
        });
      }
    }

    // Decisión de entrega (pura, testeada aparte): nombre del fichero + avisos.
    const entrega = resolverEntregaZip({
      total: invoices.length,
      fallidos,
      fecha: new Date().toISOString().slice(0, 10),
    });
    const completo = entrega.completo;

    // AUDIT (S2/S4): la descarga más sensible de todas — se lleva TODO el negocio.
    // Se registra tras la fase 1 para poder dejar constancia de si salió completo.
    auditExport(req, 'datos.zip', { from, to }, {
      facturas: invoices.length,
      pdfs_incluidos: pdfsOk,
      pdfs_fallidos: fallidos.length,
      completo,
      verifactu_anios: xmlPorAnio.map((x) => x.year), // SCRUM-82
    });

    // SCRUM-221 (A9) · SI EL PAQUETE LLEVA REGISTRO FISCAL DENTRO, ESO ES UN EXPORT FISCAL.
    //
    // Condicionado a `xmlPermitido` A PROPÓSITO: sin él, este ZIP no contiene ni un registro
    // RRSIF (`xmlPorAnio` queda vacío), y registrar «exportacion_fiscal» de un paquete sin nada
    // fiscal dentro sería un registro que miente en la dirección contraria — infla la prueba.
    // El `datos_exportados` de arriba sigue cubriendo la descarga como hecho de negocio.
    //
    // Y va AQUÍ, antes de `archive.pipe(res)`: en cuanto se abre el pipe empiezan a salir
    // bytes, y a partir de ese punto «bloquear» ya no significa nada. Es la misma razón por la
    // que en la ruta del XML va antes de los headers, solo que aquí el margen es más corto.
    if (xmlPermitido && xmlPorAnio.length > 0) {
      await recordAuditOrThrow({
        merchantId: req.merchantId,
        teamMemberId: req.teamMemberId ?? null,
        action: 'exportacion_fiscal',
        entityType: 'export',
        entityId: null,
        ip: requestIp(req),
        meta: sobreFiscal({
          actor: actorDeRequest(req),
          flagsFiscales: flagsFiscalesDe(merchant),
          payload: {
            fichero: entrega.nombreZip,
            // Aquí el rango SÍ es un from/to (el filtro de fechas del paquete), a diferencia
            // del XML suelto que va por ejercicio. Las dos formas conviven declaradas.
            rango: {
              tipo: 'fechas' as const,
              from: from ? from.toISOString().slice(0, 10) : null,
              to: to ? to.toISOString().slice(0, 10) : null,
              // Los ejercicios que acabaron dentro del ZIP: es lo que un inspector querría
              // cruzar contra los XML del paquete.
              ejercicios: xmlPorAnio.map((x) => x.year),
            },
            nRegistros: registrosVerifactu,
            // Si alguno de los años hubiera roto la cadena, `buildVerifactuRegistrosXml` habría
            // lanzado y esta ruta habría respondido 500 sin entregar nada (ver el catch de la
            // fase 1). Llegar aquí significa que ninguno saltó.
            cadenaVerificada: true,
            // ⛔ Sin `destinatarioDeclarado`, por decisión del fundador — ver el porqué completo
            // en la ruta `verifactu.xml`: un dato autodeclarado es cobertura aparente.
          },
        }),
      });
    }

    // ── FASE 2: cabeceras (ya con el nombre honesto) y streaming ────────────
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${entrega.nombreZip}"`);
    res.setHeader('Cache-Control', 'no-store');

    const archive = new ZipArchive({ zlib: { level: 9 } });
    // Si el cliente corta la descarga, no dejamos la petición colgada.
    archive.on('warning', (err: any) => console.error('[exports/datos.zip] warning:', err?.message || err));
    archive.on('error', (err: any) => {
      console.error('[exports/datos.zip] error:', err?.message || err);
      res.destroy(err);
    });
    res.on('close', () => archive.destroy());

    archive.pipe(res);

    // Segunda señal, dentro del paquete: un fichero que salta a la vista al abrirlo.
    if (entrega.avisoTxt) {
      archive.append(entrega.avisoTxt, { name: 'AVISO-PAQUETE-INCOMPLETO.txt' });
    }

    // 1) CSVs. Mismos builders que las rutas sueltas para facturas/cobros/trabajos/
    //    presupuestos: esos datos cuadran entre sí.
    //    ⚠️ `clientes.csv` es la EXCEPCIÓN DELIBERADA (SCRUM-104): aquí lleva los clientes
    //    REFERENCIADOS por los documentos del rango, no los dados de alta en él. El CSV
    //    suelto (/customers.csv, más abajo) sigue con el criterio de alta a propósito —
    //    responden a preguntas distintas. Ver el bloque de `buildClientes` en el dominio.
    for (const t of await construirCsvsDelPaquete(req.merchantId, { from, to }, seleccion.datasets)) {
      archive.append(csvBody(t.data), { name: `csv/${t.nombre}` });
    }

    // 2) PDFs ya resueltos, UNO A UNO desde disco (streaming, nunca readFileSync).
    for (const p of listos) {
      archive.append(fs.createReadStream(p.diskPath), { name: `facturas/${p.numero}.pdf` });
    }

    // 3) XML VeriFactu — ya generado y verificado en la FASE 1b (arriba). Si conXml es
    //    true, xmlPorAnio SIEMPRE tiene contenido (si hubiera fallado, ya habríamos
    //    devuelto el error antes de llegar aquí) — un archivo por año natural.
    for (const { year, xml } of xmlPorAnio) {
      archive.append(xml, { name: `facturas/verifactu_${year}.xml` });
    }

    // 4) LEEME.txt — qué lleva el paquete y qué NO (que nadie lo lea como algo fiscal
    //    que no es). Sin claims: describe el contenido REAL, nunca "conXml" como booleano
    //    (SCRUM-82: un LEEME que dice más de lo que hay es peor que uno que dice menos).
    archive.append(
      construirLeeme({
        nombre: merchant.legalName || merchant.name,
        generado: new Date().toISOString(),
        from, to,
        pdfsOk,
        pdfsTotal: invoices.length,
        xmlAnios: xmlPorAnio.map((x) => x.year),
        // SCRUM-209: las exclusiones van con el aviso de paquete incompleto, arriba del todo.
        cabecera: [
          ...entrega.cabeceraLeeme,
          ...(exclusionesVerifactu.length === 0 ? [] : [
            `ATENCION: ${exclusionesVerifactu.length} factura(s) NO se han podido declarar y NO estan`,
            'en el registro VeriFactu de este paquete. Corrigelas y vuelve a exportar:',
            ...exclusionesVerifactu.map((x) => `  · ${x.number} (${x.year}): ${x.motivo}`),
          ]),
        ],
        datasets: seleccion.datasets, // SCRUM-138: el LEEME describe SOLO lo que hay dentro
      }),
      { name: 'LEEME.txt' },
    );

    await archive.finalize();
  } catch (err) {
    console.error('[exports/datos.zip]', err);
    // Si aún no se ha escrito nada en la respuesta, se puede devolver un JSON de error.
    if (!res.headersSent) return res.status(500).json({ error: 'internal_error' });
    res.destroy();
  }
});

// ── GET /admin/exports/customers.csv ──────────────────────────────────────
// A11.4 (RGPD/R11): "tus datos son tuyos" — clientes completos del merchant.
router.get('/customers.csv', async (req, res) => {
  try {
    // SCRUM-25: acepta el mismo rango que el resto de exports (antes no filtraba).
    // El contenido lo construye el builder compartido con el ZIP (domain/exportData).
    const { from, to } = parseDateFilter(req.query as any);
    auditExport(req, 'clientes.csv', { from, to });
    const { header, rows } = await buildClientes(req.merchantId, { from, to });
    sendCsv(res, `clientes_${new Date().toISOString().slice(0, 10)}.csv`, header, rows);
  } catch (err) {
    console.error('[exports/customers.csv]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /admin/exports/invoices.csv ───────────────────────────────────────
// ?from=YYYY-MM-DD&to=YYYY-MM-DD&status=all|pending|paid|expired
router.get('/invoices.csv', async (req, res) => {
  try {
    const { from, to } = parseDateFilter(req.query as any);
    const status = String(req.query.status || 'all');
    auditExport(req, 'facturas.csv', { from, to });
    // Base e IVA desglosados (DONE de SCRUM-25) los resuelve el builder compartido.
    const { header, rows } = await buildFacturas(req.merchantId, { from, to }, status);
    sendCsv(res, `facturas_${new Date().toISOString().slice(0,10)}.csv`, header, rows);
  } catch (err) {
    console.error('[exports/invoices.csv]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /admin/exports/fees.csv ────────────────────────────────────────────
// C1-3 (CONNECT-1): contabilidad PROPIA de la plataforma — application fees
// (0,9 %, APPLICATION_FEE_BPS) de los cobros con tarjeta procesados vía
// Stripe Connect. SOLO cuentas owner; el resto recibe 403.
// SCRUM-102: dos factores (email en OWNER_EMAILS + Merchant.isPlatformOwner en BD) — un
// dato multi-tenant de TODA la plataforma no depende solo de una env var bien escrita.
// ?from=YYYY-MM-DD&to=YYYY-MM-DD (default: mes en curso)
router.get('/fees.csv', async (req, res) => {
  try {
    const me = await prisma.merchant.findUnique({
      where: { id: req.merchantId },
      select: { email: true, isPlatformOwner: true },
    });
    if (!isVerifiedPlatformOwner(me)) return res.status(403).json({ error: 'forbidden' });

    let { from, to } = parseDateFilter(req.query as any);
    if (!from && !to) {
      const now = new Date();
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = now;
    }

    // Cobros de TODA la plataforma pagados con tarjeta en la ventana; el marcador
    // de Connect es el evento card_session_created con payload.connect=true (C1-2).
    const charges = await prisma.charge.findMany({
      where: {
        status: 'paid',
        method: { contains: 'card' },
        updatedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) },
      },
      orderBy: { updatedAt: 'asc' },
      include: {
        merchant: { select: { name: true, legalName: true } },
        events: { where: { type: { in: ['card_session_created', 'paid'] } } },
      },
    });

    const feeOf = (amount: number) =>
      Math.round(Math.round(amount * 100) * config.APPLICATION_FEE_BPS / 10_000) / 100;

    const header = ['Fecha pago', 'Cobro #', 'Merchant', 'Concepto', 'Importe', 'Moneda', `Fee (${(config.APPLICATION_FEE_BPS / 100).toFixed(2).replace('.', ',')} %)`];
    let totalFees = 0;
    const rows: string[] = [];
    for (const ch of charges) {
      const viaConnect = (ch.events || []).some(
        (e) => e.type === 'card_session_created' && (e as any).payload?.connect === true,
      );
      if (!viaConnect) continue; // pagos en la cuenta de plataforma (demo/test): sin fee
      const paidEv = (ch.events || []).find((e) => e.type === 'paid');
      const amount = Number(ch.amount);
      const fee = feeOf(amount);
      totalFees += fee;
      rows.push(csvRow([
        (paidEv ? new Date((paidEv as any).ts ?? ch.updatedAt) : ch.updatedAt).toISOString().slice(0, 10),
        ch.id,
        ch.merchant?.legalName || ch.merchant?.name || ch.merchantId,
        ch.concept,
        csvNum(amount),
        ch.currency,
        csvNum(fee),
      ]));
    }
    rows.push(csvRow(['TOTAL', '', '', '', '', '', csvNum(totalFees)]));

    sendCsv(res, `fees_${new Date().toISOString().slice(0, 10)}.csv`, header, rows);
  } catch (err) {
    console.error('[exports/fees.csv]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /admin/exports/verifactu.xml ──────────────────────────────────────
// Registro de facturación RRSIF (VeriFactu, RD 1007/2023) del año pedido.
// Estructura inspirada en el XSD SuministroInformacion de la AEAT
// (RegistroFacturacionAlta: IDFactura, Desglose por tipo, CuotaTotal,
// Encadenamiento de huellas, Huella SHA-256). El ENVÍO telemático real al SIF
// requiere certificado digital del emisor — pendiente (tarea usuario).
// SCRUM-73: gateado a INVOICING_ES_ENABLED (regla 24/26) — con el flag OFF (hoy,
// pre-SIF-1) los merchants ES reales emiten justificantes (J-), no facturas
// fiscales; un XML VeriFactu construido sobre ese estado no representa registros
// válidos. 404 NEUTRO (no revela el motivo) y CERO registros generados — el
// gate va ANTES de tocar la BD de facturas. requireRole('admin'): exportar el
// registro fiscal no es acción de Técnico (S1, patrón SCRUM-54).
router.get('/verifactu.xml', requireRole('admin'), async (req, res) => {
  try {
    // SCRUM-217 (1152): el año no tenía cota inferior, así que `?year=2023` pedía el export de un
    // ejercicio ANTERIOR al 28-10-2024 — antes de que este sistema exista fiscalmente. No hacía
    // falta ningún bug: bastaba escribir un número en la URL. Fail-closed en la puerta.
    const year = req.query.year === undefined ? new Date().getFullYear() : Number(req.query.year);
    const motivoAnio = invalidAnioFiscal(year);
    if (motivoAnio) {
      return res.status(400).json({ error: 'anio_invalido', message: `El año pedido ${motivoAnio}.` });
    }

    const merchant = await prisma.merchant.findUnique({ where: { id: req.merchantId } });
    if (!merchant) return res.status(404).json({ error: 'not_found' });
    if (!isFlagEnabled('INVOICING_ES_ENABLED', { merchant })) {
      return res.status(404).json({ error: 'not_found' });
    }
    if (merchant.country !== 'ES' || !merchant.taxId) {
      return res.status(409).json({
        error: 'verifactu_not_applicable',
        message: 'VeriFactu solo aplica a negocios de España con NIF configurado (Ajustes → Datos fiscales).',
      });
    }

    // SCRUM-82: constructor RRSIF compartido con GET /datos.zip — misma fuente, sin
    // divergencia posible entre el endpoint suelto y el que va dentro del paquete.
    const { xml, count } = await buildVerifactuRegistrosXml({ merchantId: req.merchantId, year });

    // SCRUM-221 (A9) · EL REGISTRO VA ANTES QUE LOS BYTES, Y BLOQUEA.
    //
    // `recordAuditOrThrow` se ESPERA y PROPAGA: si la fila no se puede escribir, el error sube
    // al `catch` de abajo → 500 y **cero bytes fuera**. No se usa la puerta fire-safe a
    // propósito (mismo criterio que `factura_emitida`): un pack de inspección descargado sin
    // rastro es justo lo que este ticket impide. Y no depende de que nadie se acuerde —
    // `exportacion_fiscal` está en ACCIONES_BLOQUEANTES, así que `recordAudit` ni compila.
    //
    // El orden importa y es el único posible aquí: primero la fila, después los headers. Si se
    // escribiera después del `res.send`, la respuesta ya habría salido cuando fallara el log.
    //
    // `cadenaVerificada`: el constructor lanza `verifactu_cadena_rota` si el encadenamiento no
    // se puede acreditar (verifactu.service.ts). Si hemos llegado hasta aquí, no saltó.
    await recordAuditOrThrow({
      merchantId: req.merchantId,
      teamMemberId: req.teamMemberId ?? null,
      action: 'exportacion_fiscal',
      // Contrato §4.1: `entityType` obligatorio; `entityId` es la excepción declarada para A9
      // (un export no es una entidad, es un acto sobre un conjunto).
      entityType: 'export',
      entityId: null,
      ip: requestIp(req),
      meta: sobreFiscal({
        actor: actorDeRequest(req),
        flagsFiscales: flagsFiscalesDe(merchant),
        payload: {
          fichero: `verifactu_${year}.xml`,
          // El rango de ESTA ruta es un EJERCICIO, no un from/to: el registro fiscal se genera
          // por año natural. Se declara con su forma real en vez de forzarlo a un {from,to}
          // inventado — ver `RangoExportado` en el contrato y en el guard de SCRUM-221.
          rango: { tipo: 'ejercicio' as const, year },
          nRegistros: count,
          cadenaVerificada: true,
          // ⛔ NO HAY `destinatarioDeclarado`, Y ES UNA DECISIÓN, NO UN OLVIDO (fundador,
          // 29-jul-2026). El contrato lo proponía como texto libre («para quién se pide el
          // export») y se descarta: **un campo que el usuario rellena a botonazo no prueba nada
          // y PARECE que sí**. Dentro de dos años alguien lee «Mi gestoría» en un registro de
          // auditoría y lo toma por evidencia de entrega, cuando solo acredita qué botón pulsó
          // alguien con prisa. Un dato autodeclarado metido donde todo lo demás es verificable
          // es COBERTURA APARENTE. Lo que la norma pide —quién, cuándo y qué periodo— ya está
          // aquí arriba, y eso sí es verificable. No se le pregunta nada al profesional.
        },
      }),
    });

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="verifactu_${year}.xml"`);
    return res.send(xml);
  } catch (err) {
    console.error('[exports/verifactu.xml]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /admin/exports/charges.csv ────────────────────────────────────────
// SCRUM-25: "cobros.csv" del paquete — con `paid_via` (= charge.method, regla 22),
// fecha y método. Es lo que el asesor cruza con el banco.
// ?from=YYYY-MM-DD&to=YYYY-MM-DD&status=all|pending|paid|expired
router.get('/charges.csv', async (req, res) => {
  try {
    const { from, to } = parseDateFilter(req.query as any);
    const status = String(req.query.status || 'all');

    const where: any = { merchantId: req.merchantId };
    if (status !== 'all') where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to)   where.createdAt.lte = to;
    }

    auditExport(req, 'cobros.csv', { from, to });
    const { header, rows } = await buildCobros(req.merchantId, { from, to }, status);
    sendCsv(res, `cobros_${new Date().toISOString().slice(0,10)}.csv`, header, rows);
  } catch (err) {
    console.error('[exports/charges.csv]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /admin/exports/jobs.csv ───────────────────────────────────────────
// SCRUM-25: "trabajos.csv" del paquete. Job no declara relaciones en Prisma, así que
// cliente y operario se resuelven a mano (mismo patrón que jobs.routes/serializeJob).
// ?from=YYYY-MM-DD&to=YYYY-MM-DD&status=all|<estado FSM>
router.get('/jobs.csv', async (req, res) => {
  try {
    const { from, to } = parseDateFilter(req.query as any);
    const status = String(req.query.status || 'all');

    const where: any = { merchantId: req.merchantId };
    if (status !== 'all') where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to)   where.createdAt.lte = to;
    }

    auditExport(req, 'trabajos.csv', { from, to });
    const { header, rows } = await buildTrabajos(req.merchantId, { from, to }, status);
    sendCsv(res, `trabajos_${new Date().toISOString().slice(0,10)}.csv`, header, rows);
  } catch (err) {
    console.error('[exports/jobs.csv]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /admin/exports/expenses.csv ──────────────────────────────────────
// ?from=YYYY-MM-DD&to=YYYY-MM-DD&category=all|materiales|...
router.get('/expenses.csv', async (req, res) => {
  try {
    const { from, to } = parseDateFilter(req.query as any);
    const category = String(req.query.category || 'all');

    const where: any = { merchantId: req.merchantId };
    if (category !== 'all') where.category = category;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to)   where.date.lte = to;
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        quote:    { select: { id: true } },
        provider: { select: { name: true } },
      },
    });

    auditExport(req, 'gastos.csv', { from, to });

    const header = ['Fecha', 'Concepto', 'Categoría', 'Importe', 'Moneda', 'Proveedor', 'Presupuesto ID', 'Notas'];
    const rows = expenses.map((e) => csvRow([
      new Date(e.date).toISOString().slice(0, 10),
      e.concept,
      e.category,
      csvNum(e.amount),
      e.currency,
      e.provider?.name ?? '',
      e.quote?.id ?? '',
      e.notes ?? '',
    ]));

    sendCsv(res, `gastos_${new Date().toISOString().slice(0,10)}.csv`, header, rows);
  } catch (err) {
    console.error('[exports/expenses.csv]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /admin/exports/quotes.csv ─────────────────────────────────────────
// ?from=YYYY-MM-DD&to=YYYY-MM-DD&status=all|draft|sent|accepted|rejected
router.get('/quotes.csv', async (req, res) => {
  try {
    const { from, to } = parseDateFilter(req.query as any);
    const status = String(req.query.status || 'all');

    const where: any = { merchantId: req.merchantId };
    if (status !== 'all') where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to)   where.createdAt.lte = to;
    }

    auditExport(req, 'presupuestos.csv', { from, to });
    const { header, rows } = await buildPresupuestos(req.merchantId, { from, to }, status);
    sendCsv(res, `presupuestos_${new Date().toISOString().slice(0,10)}.csv`, header, rows);
  } catch (err) {
    console.error('[exports/quotes.csv]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
