// src/modules/exports/domain/exportData.ts — SCRUM-25 (EXPORT-1)
// Builders PUROS de los CSV del paquete S4. Extraídos aquí para que las rutas sueltas
// (/admin/exports/*.csv) y el paquete ZIP (/admin/exports/datos.zip) produzcan
// EXACTAMENTE lo mismo: si el asesor cruza el CSV suelto con el del ZIP, cuadran.
//
// Cada builder devuelve { header, rows } ya escapados; quien llama decide si lo envía
// como respuesta (sendCsv) o lo mete en el ZIP (csvBody).
import { prisma } from '../../../core/db/prisma';
import { calcVatBreakdown } from '../../invoicing/domain/vat.service';
import { estadoCobroFor } from '../../jobs/domain/job.service';

export interface Rango { from: Date | null; to: Date | null }
export interface CsvData {
  header: string[];
  rows: string[];
  /**
   * SCRUM-104 (fase 2): los `customerId` de las filas que este builder acaba de cargar.
   * Solo lo rellenan los builders de EVENTOS (facturas, cobros, trabajos, presupuestos);
   * sirve para que el paquete sepa a QUÉ clientes apuntan sus documentos SIN una consulta
   * extra — los ids ya venían en las filas, solo hacía falta no tirarlos.
   */
  customerIds?: number[];
}

// ── Formato CSV (SCRUM-86) — OPTIMIZADO PARA ESPAÑA, no universal ─────────
// Excel usa el "separador de lista" del sistema, no una coma fija: con configuración
// regional ES espera `;`, así que un CSV separado por comas se abría ENTERO en la
// columna A. Y con `100.00` tampoco reconocía los importes como número.
//
// ⚠️ NO es un formato universal. De los 6 países del máster (locales.ts) esto encaja en
// ES, CO, AR, PE y CL (coma decimal), pero NO en MÉXICO, que usa punto decimal como
// EE. UU. — allí el formato correcto sería justo el anterior. Hoy no hay merchants MX
// (LATAM es F3), así que se opta por lo que sirve al mercado real. Si algún día entra
// MX, esto pasa a depender del locale del merchant.
export const CSV_SEPARADOR = ';';

export function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  // OJO: ya NO se entrecomilla por coma. Con decimal español la coma aparece en TODOS
  // los importes, y entrecomillarlos ("1234,50") hace que Excel los lea como TEXTO.
  if (s.includes(CSV_SEPARADOR) || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function csvRow(fields: unknown[]): string {
  return fields.map(csvEscape).join(CSV_SEPARADOR);
}

/**
 * Importe para CSV: coma decimal y SIN punto de miles (`1234,50`).
 * No se usa `formatMoneyEs`: mete símbolo de moneda y separador de miles, y el punto de
 * miles es la causa nº 1 de que Excel vuelva a interpretar el importe como texto.
 */
export function csvNum(n: unknown): string {
  const v = Number(n ?? 0);
  return (Number.isFinite(v) ? v : 0).toFixed(2).replace('.', ',');
}

/** Cuerpo completo del CSV: BOM UTF-8 (para que Excel no rompa los acentos) + CRLF. */
export function csvBody({ header, rows }: CsvData): string {
  return '﻿' + [csvRow(header), ...rows].join('\r\n');
}

/** `where` común: siempre acotado al merchant (regla 2) + rango opcional sobre `campo`. */
function whereRango(merchantId: number, { from, to }: Rango, campo = 'createdAt', extra: any = {}) {
  const where: any = { merchantId, ...extra };
  if (from || to) {
    where[campo] = {};
    if (from) where[campo].gte = from;
    if (to) where[campo].lte = to;
  }
  return where;
}

const dia = (d: Date) => d.toISOString().slice(0, 10);

// ── Qué es "la fecha" de un trabajo (SCRUM-106) ───────────────────────────
// Decisión del fundador, opción C: la fecha de EJECUCIÓN prevista (`scheduledAt`), no la
// de alta. Un trabajo presupuestado en junio y ejecutado en julio pertenece al paquete de
// julio, que es donde está su factura — y es además lo que ya hacía TODO el resto del
// producto (lista, orden del backend, .ics). El export era el único que usaba `createdAt`,
// y no por decisión: heredaba el default de `whereRango`.
//
// LOS NULOS QUEDAN FUERA SOLOS, sin código extra: en SQL `scheduled_at >= X` es NULL para
// una fila sin fecha, y NULL no es true, así que no entra en el rango. No es un efecto
// colateral que convenga "arreglar" — es la opción C.
//
// Y no se pierde nada ejecutado: la máquina de estados (job.service.ts) IMPIDE llegar a
// `en_curso` sin pasar por `agendado`, y `agendado` EXIGE `scheduledAt` (jobs.routes.ts).
// Un trabajo sin fecha es, necesariamente, uno que nunca se empezó.
//
// ⚠️ ESTA CONSTANTE ES LA ÚNICA FUENTE: la usan `buildTrabajos` (el filtro) y
// `construirLeeme` (lo que el paquete DICE que hace). Cambiar el criterio cambia el texto
// automáticamente, así que el LEEME no puede mentir sobre esto. Antes dependía de que
// quien tocara el filtro se acordara de la línea, y el test solo miraba el texto: cambiar
// el filtro sin tocar la línea pasaba en verde (SCRUM-108).
export const CAMPO_FECHA_TRABAJOS = 'scheduledAt' as const;

/**
 * Cómo se describe ese criterio en el LEEME. Derivado, nunca escrito a mano en dos sitios.
 *
 * ⚠️ `acotado` importa: la coletilla de los no agendados SOLO es cierta cuando hay rango.
 * Sin rango no se filtra por fecha, así que los de `scheduledAt` null SÍ salen. Decirlo
 * igual en los dos casos sería otra vez un paquete mintiendo sobre sí mismo.
 */
const CRITERIO_TRABAJOS: Record<typeof CAMPO_FECHA_TRABAJOS | 'createdAt', (p: string, acotado: boolean) => string> = {
  scheduledAt: (p, acotado) => acotado
    ? `Trabajos con fecha de ejecución prevista en ${p} (los que aún no se han agendado no salen).`
    : `Todos tus trabajos, con o sin fecha de ejecución prevista.`,
  createdAt: (p) => `Trabajos dados de alta en ${p} (por fecha de alta, no de ejecución).`,
};

/**
 * `customerId` de unas filas ya cargadas, sin nulos ni repetidos (SCRUM-104).
 * ⚠️ `Charge.customerId` es `Int?` (en Quote/Invoice/Job es obligatorio): sin filtrar,
 * un cobro sin cliente metería `null` en el `in` de la consulta.
 */
const idsDe = (filas: Array<{ customerId?: number | null }>): number[] =>
  [...new Set(filas.map((f) => f.customerId).filter((id): id is number => typeof id === 'number'))];

// ── clientes.csv ──────────────────────────────────────────────────────────
// ⚠️ HAY DOS CRITERIOS A PROPÓSITO, y no es una inconsistencia pendiente de unificar
// (SCRUM-104, decisión del fundador). Los dos ficheros se llaman igual y responden a
// preguntas distintas:
//
//   · `buildClientes`  → GET /admin/exports/customers.csv (SUELTO). "Tus datos son
//     tuyos" (R11): es TU cartera, y filtrarla por fecha de alta tiene sentido.
//
//   · `buildClientesReferenciados` → el clientes.csv DEL PAQUETE ZIP. Responde a
//     "estos son mis documentos del periodo y a quién corresponden". Filtrar por alta
//     aquí deja facturas huérfanas: el asesor ve el importe y no sabe de quién es.
//
// Si vienes a "arreglar" esta divergencia: no lo hagas sin releer SCRUM-104. Unificarlas
// rompe uno de los dos usos, y cuál se rompe depende de por cuál unifiques.
const CLIENTES_HEADER = [
  'Nombre', 'Razón social', 'NIF/CIF', 'Teléfono', 'Email', 'Notas', 'Baja WhatsApp',
  // SCRUM-104 (D3): la fecha de alta es DATO, no interpretación. En un paquete de julio
  // de 2026, un `2020-03-14` se explica solo: el asesor entiende que ese cliente entró
  // por sus documentos, no por haberse dado de alta en el periodo. Un flag "por
  // referencia" habría que explicarlo, y mantener esa explicación al día.
  'Fecha de alta',
];

const clienteRow = (c: any) => csvRow([
  c.name,
  c.legalName ?? '',
  c.taxId ?? '',
  c.phone ?? '',
  c.email ?? '',
  c.notes ?? '',
  c.waOptOut ? 'Sí' : 'No',
  dia(c.createdAt),
]);

/** SUELTO (R11): la cartera del merchant, acotada por FECHA DE ALTA. Ver el bloque de arriba. */
export async function buildClientes(merchantId: number, rango: Rango): Promise<CsvData> {
  const customers = await prisma.customer.findMany({
    where: whereRango(merchantId, rango),
    orderBy: { createdAt: 'asc' },
  });
  return { header: CLIENTES_HEADER, rows: customers.map(clienteRow) };
}

/**
 * DEL PAQUETE (SCRUM-104 fase 2): exactamente los clientes a los que apuntan los
 * documentos del rango — ni uno más, ni uno menos.
 *
 * · Ni uno MENOS: sin esto, una factura de un cliente dado de alta antes del rango
 *   quedaba huérfana en el paquete.
 * · Ni uno MÁS: meter toda la cartera exportaría datos personales de clientes AJENOS
 *   al periodo solicitado, que es justo lo que S4/RGPD no quiere.
 *
 * `ids` sale de los `customerId` que los builders de eventos ya traían cargados, así que
 * esto NO añade consultas: sustituye la de `buildClientes`, no se suma a ella.
 */
export async function buildClientesReferenciados(merchantId: number, ids: number[]): Promise<CsvData> {
  // Sin documentos en el rango no hay a quién referenciar: se devuelve el CSV con su
  // cabecera y sin filas. NO se consulta con `in: []` (devolvería vacío igual, pero
  // gastando una ida y vuelta para preguntar por nada).
  if (ids.length === 0) return { header: CLIENTES_HEADER, rows: [] };

  const customers = await prisma.customer.findMany({
    // `merchantId` NO es redundante con el `in` (regla 2): los ids vienen de documentos
    // ya acotados al merchant, pero el filtro se repite aquí para que la tenencia no
    // dependa de que quien llame lo haya hecho bien.
    where: { merchantId, id: { in: ids } },
    orderBy: { createdAt: 'asc' },
  });
  return { header: CLIENTES_HEADER, rows: customers.map(clienteRow) };
}

// ── facturas.csv ──────────────────────────────────────────────────────────
// Base e IVA desglosados con calcVatBreakdown sobre las líneas CONGELADAS de la
// factura. Sin líneas → base = total e IVA = 0: no se inventa un tipo impositivo.
export async function buildFacturas(merchantId: number, rango: Rango, status = 'all'): Promise<CsvData> {
  const invoices = await prisma.invoice.findMany({
    where: whereRango(merchantId, rango, 'createdAt', status !== 'all' ? { status } : {}),
    orderBy: { createdAt: 'desc' },
    include: { customer: { select: { name: true, email: true } } },
  });
  return {
    customerIds: idsDe(invoices), // SCRUM-104: ya venían en las filas
    header: ['Número', 'Fecha', 'Cliente', 'Email cliente', 'Base', 'IVA', 'Total', 'Moneda', 'Estado', 'Pagada en', 'VeriFactu'],
    rows: invoices.map((inv) => {
      const lines = Array.isArray(inv.lines) ? (inv.lines as any[]) : [];
      const vat = lines.length ? calcVatBreakdown(lines) : null;
      const total = Number(inv.total);
      return csvRow([
        inv.number,
        dia(inv.createdAt),
        inv.customer?.name ?? '',
        inv.customer?.email ?? '',
        csvNum(vat ? vat.base : total),
        csvNum(vat ? vat.cuota : 0),
        csvNum(total),
        inv.currency,
        inv.status,
        inv.paidAt ? dia(inv.paidAt) : '',
        inv.vfHash ? 'Sí' : 'No',
      ]);
    }),
  };
}

// ── cobros.csv ────────────────────────────────────────────────────────────
// `paid_via` = charge.method (regla 22). Es lo que el asesor cruza con el banco.
export async function buildCobros(merchantId: number, rango: Rango, status = 'all'): Promise<CsvData> {
  const charges = await prisma.charge.findMany({
    where: whereRango(merchantId, rango, 'createdAt', status !== 'all' ? { status } : {}),
    orderBy: { createdAt: 'desc' },
    include: { customer: { select: { name: true } } },
  });
  return {
    customerIds: idsDe(charges), // SCRUM-104: OJO, Charge.customerId es nullable
    header: ['Cobro #', 'Fecha', 'Cliente', 'Concepto', 'Importe', 'Moneda', 'Método (paid_via)', 'Estado', 'Cobrado en', 'Referencia'],
    rows: charges.map((ch) => csvRow([
      ch.id,
      dia(ch.createdAt),
      ch.customer?.name ?? '',
      ch.concept,
      csvNum(ch.amount),
      ch.currency,
      ch.method,
      ch.status,
      // El cobro no guarda paidAt: cuando está pagado, updatedAt es el momento del cobro.
      ch.status === 'paid' ? dia(ch.updatedAt) : '',
      ch.reference ?? '',
    ])),
  };
}

// ── trabajos.csv ──────────────────────────────────────────────────────────
// Job no declara relaciones en Prisma: cliente y operario se resuelven a mano, en
// 2 consultas y no una por fila (mismo patrón que jobs.routes/serializeJob).
export async function buildTrabajos(merchantId: number, rango: Rango, status = 'all'): Promise<CsvData> {
  const [jobs, customers, members] = await Promise.all([
    prisma.job.findMany({
      // SCRUM-106: por FECHA DE EJECUCIÓN prevista, no por fecha de alta. El criterio y su
      // declaración en el LEEME salen de la MISMA constante — ver CAMPO_FECHA_TRABAJOS.
      where: whereRango(merchantId, rango, CAMPO_FECHA_TRABAJOS, status !== 'all' ? { status } : {}),
      orderBy: { [CAMPO_FECHA_TRABAJOS]: 'desc' },
    }),
    prisma.customer.findMany({ where: { merchantId }, select: { id: true, name: true } }),
    prisma.teamMember.findMany({ where: { merchantId }, select: { id: true, name: true } }),
  ]);
  const customerName = new Map(customers.map((c) => [c.id, c.name]));
  const operarioName = new Map(members.map((m) => [m.id, m.name]));

  return {
    customerIds: idsDe(jobs), // SCRUM-104
    header: ['Trabajo #', 'Título', 'Estado', 'Cliente', 'Operario', 'Fecha prevista', 'Total aceptado', 'Total cobrado', 'Pendiente', 'Estado de cobro', 'Alta'],
    rows: jobs.map((j) => {
      const aceptado = j.totalAceptado != null ? Number(j.totalAceptado) : 0;
      const cobrado = Number(j.totalCobrado ?? 0);
      return csvRow([
        j.id,
        j.titulo ?? '',
        j.status,
        customerName.get(j.customerId) ?? '',
        // operarioId null = propietario (SCRUM-22): se deja vacío, no se inventa nombre
        j.operarioId != null ? (operarioName.get(j.operarioId) ?? '') : '',
        j.scheduledAt ? dia(j.scheduledAt) : '',
        csvNum(aceptado),
        csvNum(cobrado),
        csvNum(Math.round((aceptado - cobrado) * 100) / 100),
        estadoCobroFor(cobrado, aceptado),   // mismo semáforo que la app
        dia(j.createdAt),
      ]);
    }),
  };
}

// ── presupuestos.csv ──────────────────────────────────────────────────────
export async function buildPresupuestos(merchantId: number, rango: Rango, status = 'all'): Promise<CsvData> {
  const quotes = await prisma.quote.findMany({
    where: whereRango(merchantId, rango, 'createdAt', status !== 'all' ? { status } : {}),
    orderBy: { createdAt: 'desc' },
    include: { customer: { select: { name: true, email: true, phone: true } } },
  });
  return {
    customerIds: idsDe(quotes), // SCRUM-104
    header: ['ID', 'Fecha', 'Cliente', 'Email', 'Teléfono', 'Total', 'Moneda', 'Estado', 'Aceptada en', 'Condiciones de pago'],
    rows: quotes.map((q) => csvRow([
      q.id,
      dia(q.createdAt),
      q.customer?.name ?? '',
      q.customer?.email ?? '',
      q.customer?.phone ?? '',
      csvNum(q.total),
      q.currency,
      q.status,
      q.acceptedAt ? dia(q.acceptedAt) : '',
      (q as any).paymentTerms ?? '',
    ])),
  };
}

// ── Empaquetado del ZIP: constantes y decisiones PURAS ────────────────────

/**
 * Tope de facturas por paquete. ⚠️ PROVISIONAL — ajustarlo aquí y solo aquí.
 *
 * ⚠️ ANTES DE SUBIRLO, LEE ESTO: acota TRES cosas a la vez, no solo el tiempo. Es fácil
 * razonar "Railway da 15 minutos, el proxy no es el límite" y subirlo… engordando la
 * memoria del navegador sin darse cuenta.
 *
 * 1) TIEMPO (time-to-first-byte). Medido en SCRUM-25 §7, caso malo (ningún PDF en disco,
 *    como tras cada deploy por el fs efímero), contra staging por WAN:
 *      · 774 ms por factura de media (p95 1,5 s) — el 99,8 % es `ensureInvoicePdf`;
 *        la compresión fueron 24 ms de 15.500.
 *      · 100 facturas ≈ 77 s · 300 ≈ 232 s **sin enviar un solo byte** (el paquete solo
 *        puede transmitirse cuando ya sabe si está completo, para poder nombrarse).
 *    Es un TECHO: medido con la BD remota y ~2 s de latencia por consulta; en producción
 *    app y BD comparten región y debería caer bastante.
 *
 * 2) MEMORIA DEL NAVEGADOR. La card descarga con `fetch` + blob (para poder avisar de que
 *    el paquete salió incompleto), así que el ZIP entero pasa por RAM antes de guardarse.
 *    El peso lo domina el LOGO del merchant: `loadLogoBuffer` lo incrusta tal cual en CADA
 *    PDF (`doc.image` no recomprime; el `fit` es geometría), y el logo pesa ~150 KB.
 *      · sin logo: PDF ~5 KB → 100 facturas ≈ 0,5 MB (medido: 20 facturas = 79 KB)
 *      · con logo: PDF ~155 KB → 100 facturas ≈ 15 MB, con pico ~30 MB (respuesta + blob)
 *    A 500 facturas serían ~77 MB: ahí un Android de gama media (matriz del máster) sí
 *    sufre. El ZIP no ayuda — PNG/JPEG ya vienen comprimidos.
 *
 * 3) UX. Con 15 min de plataforma el riesgo no es fallar, es PARECER roto. La card avisa
 *    del tope antes de pulsar (GET /datos.zip/info) y bloquea el botón mientras genera.
 *
 * 100 mantiene la espera en el entorno del minuto y la memoria en ~15 MB en el peor caso.
 * El arreglo de verdad (asíncrono) es SCRUM-83; su escalera: ajustar tope → paralelizar
 * render → asíncrono. Cuando se mida en producción, este número se sube o se retira —
 * pero recalculando también (2), no solo (1).
 */
export const MAX_FACTURAS_ZIP = 100;

export interface EntregaZip {
  completo: boolean;
  /** Nombre del fichero: dice la verdad SIN que haya que abrir nada. */
  nombreZip: string;
  /** Contenido de AVISO-PAQUETE-INCOMPLETO.txt, o null si el paquete está completo. */
  avisoTxt: string | null;
  /** Líneas que van ARRIBA del LEEME (vacío si está completo). */
  cabeceraLeeme: string[];
}

/**
 * Decide cómo se ENTREGA el paquete según los PDF que hayan fallado. Pura a propósito:
 * es la lógica que evita que una entrega para una inspección parezca completa sin serlo,
 * y se testea directa, sin BD ni gate (no se toca `ensureInvoicePdf`, que es fiscal).
 */
export function resolverEntregaZip(p: { total: number; fallidos: string[]; fecha: string }): EntregaZip {
  const { total, fallidos, fecha } = p;
  if (fallidos.length === 0) {
    return { completo: true, nombreZip: `yaqu-datos-${fecha}.zip`, avisoTxt: null, cabeceraLeeme: [] };
  }
  const lista = fallidos.join(', ');
  return {
    completo: false,
    nombreZip: `yaqu-datos-INCOMPLETO-${fecha}.zip`,
    avisoTxt: [
      'PAQUETE INCOMPLETO',
      '',
      `Faltan ${fallidos.length} de ${total} facturas: no se pudo generar su PDF.`,
      `Facturas afectadas: ${lista}`,
      '',
      'No uses este paquete como entrega completa sin volver a generarlo. Los datos de esas',
      'facturas SÍ están en csv/facturas.csv; lo que falta es el PDF.',
    ].join('\n'),
    cabeceraLeeme: [
      `*** PAQUETE INCOMPLETO — faltan ${fallidos.length} de ${total} PDF de factura ***`,
      `Facturas sin PDF: ${lista}`,
      'No lo entregues como paquete completo sin volver a generarlo. Ver AVISO-PAQUETE-INCOMPLETO.txt.',
      '',
    ],
  };
}

/**
 * Contenido de LEEME.txt. Puro a propósito (mismo motivo que `resolverEntregaZip`):
 * lo que este fichero DICE es parte del entregable — quien lo lee es un asesor o un
 * inspector, no un desarrollador — así que se testea directo, sin BD ni gate.
 *
 * SCRUM-104: antes solo describía el FORMATO (separador, decimales) y no el CRITERIO de
 * cada fichero. Sin eso, un asesor no puede interpretar lo que ve: si pide "julio" y una
 * factura apunta a un cliente que no está en clientes.csv, no sabe si falta un dato o si
 * el fichero sigue otra regla. Aquí se explica cada uno, en su idioma, no en el nuestro.
 */
export function construirLeeme(p: {
  nombre: string;
  generado: string;
  from: Date | null;
  to: Date | null;
  pdfsOk: number;
  pdfsTotal: number;
  conXml: boolean;
  cabecera: string[];
}): string {
  const { nombre, generado, from, to, pdfsOk, pdfsTotal, conXml, cabecera } = p;
  const acotado = !!(from || to);
  const periodo = acotado ? 'el periodo seleccionado' : 'todo tu histórico';

  // El criterio de CADA fichero, en una línea. Los de EVENTOS (factura, cobro, trabajo,
  // presupuesto) tienen fecha propia y filtrar por ella es correcto. `clientes` es una
  // ENTIDAD: su fecha es la de ALTA, que no dice nada de cuándo se le facturó.
  const criterios = [
    // OJO al "de + el": esta línea es la única que necesita la preposición delante del
    // periodo, así que se escribe entera en cada caso en vez de concatenar (y salir "de el").
    acotado
      ? '  clientes.csv       Los clientes a los que corresponden los documentos del periodo.'
      : '  clientes.csv       Todos los clientes con algún documento en tu histórico.',
    `  facturas.csv       Facturas emitidas en ${periodo}.`,
    `  cobros.csv         Cobros registrados en ${periodo}.`,
    // SCRUM-106: el texto SALE del criterio real (CAMPO_FECHA_TRABAJOS). No se puede
    // cambiar uno sin cambiar el otro, que es lo que antes había que recordar a mano.
    `  trabajos.csv       ${CRITERIO_TRABAJOS[CAMPO_FECHA_TRABAJOS](periodo, acotado)}`,
    `  presupuestos.csv   Presupuestos creados en ${periodo}.`,
    `  facturas/          El PDF de cada factura de csv/facturas.csv.`,
  ];

  // SCRUM-104 (D4): que nadie lea la divergencia como un bug. El aviso de la fase 1
  // («puede faltarte un cliente») ya no aplica: en la fase 2 no falta ninguno. Lo que sí
  // hay que explicar es por qué este fichero NO coincide con la descarga suelta.
  const avisoCartera = acotado
    ? [
        '',
        'SOBRE clientes.csv — por qué no es tu lista de clientes completa:',
        '  Aquí van los clientes a los que corresponden los documentos de este paquete,',
        '  aunque los dieras de alta hace años. Así ninguna factura queda sin saber de',
        '  quién es. Por eso NO coincide con el "clientes.csv" que descargas suelto desde',
        '  Configuración, que sí lista tu cartera por fecha de alta: son dos preguntas',
        '  distintas, no un error. La columna "Fecha de alta" te dice cuándo entró cada uno.',
      ]
    : [];

  return [
    // El aviso de paquete incompleto va PRIMERO: si falta algo, es lo primero que se lee.
    ...cabecera,
    `Paquete de datos de ${nombre}`,
    `Generado: ${generado}`,
    `Rango: ${from ? dia(from) : 'desde el principio'} → ${to ? dia(to) : 'hoy'}`,
    '',
    'QUÉ LLEVA CADA FICHERO',
    ...criterios,
    ...avisoCartera,
    '',
    'FORMATO DE LOS CSV',
    '  UTF-8 con BOM · separador ";" · decimales con coma (1234,50) · fechas AAAA-MM-DD.',
    '  Preparado para abrirse con doble clic en Excel con configuración regional española.',
    '',
    `facturas/  ${pdfsOk} de ${pdfsTotal} PDF de factura/justificante`,
    // La nota del XML solo aparece con el flag OFF; los '' de arriba son separación
    // deliberada, así que NO se filtran vacíos en bloque.
    ...(conXml ? [] : ['Nota: este paquete no incluye el XML de registros de facturación.']),
  ].join('\n');
}

/**
 * Las 5 tablas del paquete S4 (el ticket no incluye gastos ni fees).
 *
 * ⚠️ ESTO ERA UNA LISTA (`CSV_PAQUETE`) y ahora es una FUNCIÓN, a propósito (SCRUM-104
 * fase 2). Una lista de builders dice "cinco cosas independientes, en cualquier orden";
 * desde que `clientes.csv` lleva los clientes REFERENCIADOS, eso dejó de ser verdad:
 * depende del resultado de los otros cuatro.
 *
 * Se podía haber dejado la lista ordenando clientes al final y compartiendo un Set entre
 * iteraciones, pero esa dependencia sería INVISIBLE: se rompería en silencio el día que
 * alguien reordenase la lista o metiera un `Promise.all` — dos cambios que parecen
 * inocuos sobre una lista. Como función, el orden no se puede equivocar.
 *
 * Los cuatro de EVENTOS sí van en paralelo entre sí; solo `clientes` espera.
 */
export async function construirCsvsDelPaquete(
  merchantId: number,
  rango: Rango,
): Promise<Array<{ nombre: string; data: CsvData }>> {
  const [facturas, cobros, trabajos, presupuestos] = await Promise.all([
    buildFacturas(merchantId, rango),
    buildCobros(merchantId, rango),
    buildTrabajos(merchantId, rango),
    buildPresupuestos(merchantId, rango),
  ]);

  // A quién apuntan los documentos del rango. Sin consultas: los ids venían en las filas.
  const referenciados = [...new Set([
    ...(facturas.customerIds ?? []),
    ...(cobros.customerIds ?? []),
    ...(trabajos.customerIds ?? []),
    ...(presupuestos.customerIds ?? []),
  ])];

  const clientes = await buildClientesReferenciados(merchantId, referenciados);

  // El orden de las entradas es el del paquete de siempre: clientes primero.
  return [
    { nombre: 'clientes.csv', data: clientes },
    { nombre: 'facturas.csv', data: facturas },
    { nombre: 'cobros.csv', data: cobros },
    { nombre: 'trabajos.csv', data: trabajos },
    { nombre: 'presupuestos.csv', data: presupuestos },
  ];
}
