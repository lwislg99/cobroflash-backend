/**
 * A6.1 — Cuenta demo IMPECABLE (sprint DEMO-READY EXT).
 *
 * Resetea y siembra el merchant DEMO (id=1, demo@yaqu.app — regla 8) con datos
 * bonitos y creíbles: "Fontanería García", 7 clientes, catálogo, 12 presupuestos
 * repartidos por estados, 4 cobros hechos (métodos variados) y 1 pendiente
 * (alimenta el "dinero en juego" de la Home). Idempotente: cada ejecución borra
 * SOLO los datos transaccionales del demo y los recrea igual.
 *
 * EJECUCIÓN (quien ejecuta decide la BD; el script NO asume ninguna — SCRUM-208):
 *   1) npm run build                             (importa de `dist/`, como seed-video.mjs)
 *   2) export DATABASE_URL=<la BD destino>
 *   3) export SEED_DEMO_CONFIRM=<hostname EXACTO de esa BD>   (te lo dice el script si falta)
 *   4) node scripts/seed-demo.mjs
 *
 * Sin los pasos 2 y 3 ABORTA sin tocar nada. No es ceremonia: este script BORRA y
 * resiembra el merchant 1, y su destino por defecto era PRODUCCIÓN.
 *
 * SCRUM-204 · NUMERACIÓN: sale de `allocateInvoiceNumber()` dentro de la misma
 * transacción que crea el documento — PROHIBIDO fabricarla a mano (regla del embudo,
 * SCRUM-203). Antes se inventaba aquí el literal `AAAA-FG-NNN`.
 *
 * QUÉ SALE, MEDIDO (no deducido): el merchant demo es modo **'demo'**, no 'receipt'
 * — `getEmissionMode` lo desvía por `isDemoMerchant` ANTES de mirar el flag
 * (emission.service.ts:39, regla 8): factura completa con marca de agua
 * "DEMO — no válida fiscalmente", NO justificante. Así que el embudo devuelve
 * `2026-FG-001…` y el demo enseña EXACTAMENTE lo mismo que antes: el cambio es de
 * dónde sale el número, no lo que se ve.
 *
 * ⚠️ Esto DESMIENTE la premisa con la que se abrió SCRUM-204 («el demo pasará a
 * enseñar J-»). Se escribió sin ejecutar `getEmissionMode`; medirlo la tumbó.
 *
 * NO toca ningún otro merchant. Los teléfonos de los clientes son ficticios y
 * el guard V0-2 (DEMO_SAFE_NUMBERS) impide cualquier envío real desde el demo.
 */
import { PrismaClient } from '@prisma/client';
import {
  allocateInvoiceNumber,
  isReceiptNumber,
} from '../dist/modules/invoicing/domain/invoiceNumber.service.js';
// SCRUM-223: quien mira una URL de BD pasa por aquí. `parseBDSegura` quita el envoltorio de
// comillas del `.env` y NO tiene forma de devolver la cadena — solo host, base, usuario y puerto.
// SCRUM-381: y `destinoSembrable` es la allowlist que la nota de SCRUM-208 (abajo) dejaba escrita.
import { parseBDSegura, destinoSembrable } from './_db-guard.mjs';
// SCRUM-314: el barrido del demo, DERIVADO del orden que ya guarda el schema (no una lista aquí).
// SCRUM-381: vivía en `./_wipe-demo.mjs`, que SCRUM-314 (cbc2880) borró al mover el barrido al
// dominio SIN actualizar este import. El script llevaba tickets sin poder ni arrancar, y nadie se
// enteró porque ninguna suite lo cargaba — el hueco que cierra el guard de este mismo ticket.
import { barridoDemo } from '../dist/modules/system/domain/barridoDemo.js';
// SCRUM-761: el catálogo se siembra POR EL CAMINO REAL DEL ALTA, no con un `product.create` a
// mano. Ver el bloque largo junto al catálogo, más abajo.
import { createProduct } from '../dist/modules/products/domain/products.service.js';
// …y el cliente que usa ESE camino, para poder cerrarlo al final: `createProduct` escribe con el
// singleton de `core/db/prisma`, no con el `new PrismaClient()` de este script. Sin este
// `$disconnect` el proceso se queda con una conexión viva y no termina solo.
//
// ⚠️ Esto NO adelanta la construcción de un cliente por delante del guard de destino: MEDIDO
// hoy, el singleton ya lo construían los imports que este script tenía (`invoiceNumber.service`
// lo arrastra por `audit.service`). Y construir un `PrismaClient` no conecta: la conexión la
// abre la primera consulta, que sigue ocurriendo después de `confirmarDestino()`.
import { prisma as prismaApp } from '../dist/core/db/prisma.js';

/**
 * El copy del cobro NUNCA dice "factura" de un `J-` (regla 24/26, Parte M). No es un texto
 * nuevo: es la MISMA expresión que usa el camino real en `invoiceWhatsApp.service.ts:63` al
 * crear el Charge de una factura.
 *
 * Hoy en el demo siempre da "Factura", porque el modo 'demo' emite serie fiscal (ver cabecera).
 * Se deriva igualmente en vez de escribir "Factura" fijo: si el demo cambiara de modo, el copy
 * lo seguiría solo — que es exactamente lo que este script hacía mal con el número.
 */
const docLabel = (number) => (isReceiptNumber(number) ? 'Justificante' : 'Factura');

// ─────────────────────────────────────────────────────────────────────────────
// SCRUM-381 · EL SOBRE DE UNA SIEMBRA
//
// `allocateInvoiceNumber` exige `camino` y `actor` desde SCRUM-207, y este script se los pasaba
// VACÍOS (`{}`) — el mismo día que no podía ni arrancar. Con el sobre vacío, un número sembrado
// quedaba en el AuditLog indistinguible de uno emitido de verdad.
//
// `actor.tipo:'semilla'` es lo que lo distingue, y `ref` dice qué sembrador y qué TANDA, para
// poder separar dos ejecuciones del mismo script. Se define UNA vez: dos literales en dos sitios
// se desincronizan solos, y el que se quede atrás lo hace en silencio.
//
// El `camino`, en cambio, va en cada llamada porque CAMBIA: un número sembrado sí sale por una
// vía real —este script llama al mismo código—, así que declara la que imita, no una inventada.
// ─────────────────────────────────────────────────────────────────────────────
const TANDA = new Date().toISOString();
const sembrado = (punto) => ({ actor: { tipo: 'semilla', ref: `seed-demo:${punto}@${TANDA}` } });

// ─────────────────────────────────────────────────────────────────────────────
// SCRUM-208 · GUARD DE DESTINO — hay que NOMBRAR la base
//
// Este script es un RESET: lo primero que hace es doce `deleteMany` sobre el merchant 1.
// Hasta ahora su destino por DEFECTO era PRODUCCIÓN, y no por un flag mal puesto: al no
// cargar dotenv, Prisma resolvía `DATABASE_URL` leyendo `.env`, que apunta a Railway.
// `node scripts/seed-demo.mjs` a secas resembraba el demo de producción, sin avisar.
//
// Decisión del fundador (29-jul-2026): el patrón de `seed-video.mjs` — no se prohíbe, se
// obliga a NOMBRAR la base. Sigue siendo posible hacerlo a propósito; deja de ser posible
// por accidente. Si algún día se confirma que producción nunca debe ser destino de una
// semilla, se endurece con la allowlist de host de SCRUM-118.
//
// SCRUM-381 · ESE DÍA LLEGÓ (asesor, 6-ago-2026): producción NUNCA es destino de una semilla.
// La allowlist va PRIMERO y no se puede confirmar para saltarla: nombrar la base contesta
// «¿es la que querías?», no «¿se puede sembrar ahí?». Con solo la confirmación, escribir el
// hostname de prod era suficiente para resembrar producción — la ceremonia estaba, la
// prohibición no. Ahora son las dos, en este orden: IDENTIDAD del destino, luego INTENCIÓN.
//
// ⚠️ POR QUÉ EXIGE `DATABASE_URL` EN EL ENTORNO Y NO SE CONFORMA CON LA DE `.env`:
// porque el agujero es justo ese. Si aquí leyéramos el fichero para "ser amables", el
// caso que motivó el ticket volvería a pasar con un mensaje de confirmación bonito
// delante. Sin variable en el entorno no hay destino elegido, y sin destino elegido no
// se ejecuta. Fail-closed.
// ─────────────────────────────────────────────────────────────────────────────
const abortar = (msg) => { console.error('\n❌ ABORTADO: ' + msg + '\n'); process.exit(1); };

function confirmarDestino() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl) {
    abortar(
      'DATABASE_URL no está definida EN EL ENTORNO.\n\n' +
      '  Ojo: eso no significa "sin destino". Prisma cargaría `.env`, que apunta a\n' +
      '  PRODUCCIÓN, y este script BORRA y resiembra el merchant demo (id=1).\n\n' +
      '  Elige la base a mano y nómbrala:\n\n' +
      '    DATABASE_URL=<url-de-la-bd> SEED_DEMO_CONFIRM=<hostname-de-esa-bd> node scripts/seed-demo.mjs',
    );
  }

  // SCRUM-223: esto era `new URL(dbUrl).hostname` en un try/catch. NO filtraba —el catch no
  // imprimía el error— pero es la forma prohibida, y la trajo SCRUM-208, que venía justamente
  // a cerrar un agujero de bases de datos. `new URL()` no redacta: si la cadena llega con las
  // comillas del `.env`, lanza y la lleva ENTERA dentro del objeto de error; basta que alguien
  // añada un `console.error(e)` para publicar la contraseña (incidente #14).
  const destino = parseBDSegura(dbUrl);
  if (!destino) abortar('DATABASE_URL no es una URL válida. (No se dice cuál era: R7.)');
  const host = destino.host;

  // SCRUM-381 · ANTES que la confirmación: ninguna confirmación abre producción.
  const sembrable = destinoSembrable(dbUrl);
  if (!sembrable.ok) {
    abortar(
      `Destino NO sembrable → ${sembrable.etiqueta}\n\n  ${sembrable.motivo}\n\n` +
      '  (Solo se nombra host/base: ni usuario, ni contraseña, ni la URL — R7.)',
    );
  }

  if (process.env.SEED_DEMO_CONFIRM !== host) {
    abortar(
      `Confirma la base de forma EXPLÍCITA. DATABASE_URL apunta al host:\n\n    ${host}\n\n` +
      `  Si es la correcta, re-ejecuta nombrándola:\n\n` +
      `    SEED_DEMO_CONFIRM=${host} node scripts/seed-demo.mjs\n\n` +
      '  Si NO es la que querías, no toques la variable: cambia DATABASE_URL.',
    );
  }
  return host;
}

// Se ejecuta ANTES de construir el cliente: así no existe un orden de llamadas en el que
// algo consulte la BD sin haber pasado por aquí.
const HOST_DESTINO = confirmarDestino();

const prisma = new PrismaClient();
const DEMO_ID = 1;

const now = new Date();
const daysAgo = (d, h = 10, m = 30) => {
  const t = new Date(now);
  t.setDate(t.getDate() - d);
  t.setHours(h, m, 0, 0);
  return t;
};

// Logo sencillo (SVG data-URI): gota + FG. En web se ve; en PDF cae al fallback.
const LOGO =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="44" viewBox="0 0 120 44"><rect width="120" height="44" rx="10" fill="#0e7490"/><text x="14" y="29" font-family="Arial,Helvetica,sans-serif" font-size="19" font-weight="bold" fill="#fff">💧 F. García</text></svg>`,
  ).toString('base64');

async function wipeDemo() {
  // SCRUM-314 · el barrido ya NO se escribe aquí. Esta función borraba una lista a mano de **10**
  // modelos cuando los que tienen `merchantId` son **21**: se quedaban sucios `job`, `albaran`,
  // `albaranLineaFacturada`, `teamMember`, `auditLog`, `attachment`, `authSession`, `provider`,
  // `quoteTemplate`, `maintenancePlan` y `legalAcceptance` — once.
  //
  // Ahora cuelga de `ORDEN_BORRADO_MERCHANT`, que es la MISMA lista que ya guarda un test
  // derivado del schema (SCRUM-172/192): un modelo nuevo con `merchantId` entra en el barrido del
  // demo el día que entra en el del merchant, sin que nadie tenga que acordarse. Dos listas del
  // mismo hecho se desincronizan solas, y es justo lo que dejó ésta en 10 de 21.
  const { porModelo } = await barridoDemo(prisma, DEMO_ID);
  const noDisponibles = Object.entries(porModelo).filter(([, n]) => n === null).map(([m]) => m);
  if (noDisponibles.length) {
    // `null` ≠ 0: uno dice «no se pudo mirar» y el otro «no había nada». Se dice, no se calla.
    console.log(`   ⚠️  sin barrer (modelo no disponible en este entorno): ${noDisponibles.join(', ')}`);
  }
}

async function seed() {
  // ── Perfil del negocio demo ────────────────────────────────────────────
  await prisma.merchant.update({
    where: { id: DEMO_ID },
    data: {
      name: 'Fontanería García',
      legalName: 'Fontanería García S.L.',
      trade: 'fontanero',
      taxId: 'B87654321',
      address: 'Calle del Agua 12, 28005 Madrid',
      country: 'ES',
      defaultCurrency: 'EUR',
      invoiceSeriesPrefix: 'FG',
      invoiceSeriesYear: now.getFullYear(),
      // SCRUM-204: la serie arranca SIN consumir y la avanza el embudo, un documento a la
      // vez, hasta dejarla en 6. Antes se escribía el 6 a mano ("5 facturas sembradas")
      // mientras los 5 documentos no tocaban la serie: el número correcto por el motivo
      // equivocado, que deja de ser correcto en cuanto alguien siembra un sexto.
      nextInvoiceNumber: 1,
      nextRectInvoiceNumber: 1,
      nextQuoteNumber: 13, // 12 presupuestos sembrados
      logoUrl: LOGO,
      iban: 'ES9121000418450200051332',
      googleReviewUrl: 'https://g.page/r/fontaneria-garcia/review',
    },
  });

  // ── Catálogo de fontanería ─────────────────────────────────────────────
  const productsData = [
    { name: 'Sustitución de grifo monomando', price: 65 },
    { name: 'Desatasco de tubería', price: 90 },
    { name: 'Instalación de termo eléctrico', price: 240 },
    { name: 'Cambio de cisterna completa', price: 85 },
    { name: 'Reparación de fuga de agua', price: 75 },
    { name: 'Instalación de lavabo con grifería', price: 160 },
    { name: 'Revisión general de fontanería', price: 45 },
    { name: 'Mano de obra (hora)', price: 35 },
  ];
  // ───────────────────────────────────────────────────────────────────────
  // SCRUM-761 · EL CATÁLOGO SE DA DE ALTA POR EL CAMINO REAL
  //
  // Esto era `prisma.product.create({ data: { merchantId, name, price } })`, y omitía
  // `nameSearch` — la sombra normalizada de `name` que `createProduct` escribe y por la que
  // `searchProducts` FILTRA. Consecuencia medida sobre la BD de desarrollo (8/8 filas con
  // `name_search` NULL): «desatasco de» → 0, «sustitución de» → 0, «instalación de» → 0.
  // TODO el catálogo sembrado era invisible al autocompletado de la pantalla que el máster
  // quiere resuelta en 30 segundos, mientras un producto dado de alta a mano SÍ aparecía.
  //
  // Y un segundo daño, menos visible: en Postgres los NULL NO CHOCAN ENTRE SÍ, así que sobre
  // esas 8 filas `@@unique([merchantId, nameSearch])` no vigilaba NADA. Una base de desarrollo
  // cuyo estado deja inoperante la restricción que se está midiendo no es una base de pruebas.
  //
  // 🔴 NO se arregla escribiendo aquí `nameSearch: normalizeSearch(p.name)`. Eso sería una
  // SEGUNDA copia del alta, y el día que el alta real derive una columna más, este sembrador
  // volvería a quedarse corto exactamente igual — que es el defecto, no el síntoma. Se llama al
  // alta de verdad, que es el escalón 1: derivar el camino entero.
  //
  // `createProduct` escribe con el cliente global (`core/db/prisma`), no con el `prisma` de este
  // fichero. Los dos resuelven la MISMA `DATABASE_URL`, que el guard de destino ya confirmó
  // arriba; el cierre del global se hace al final del script.
  // ───────────────────────────────────────────────────────────────────────
  for (const p of productsData) {
    await createProduct(DEMO_ID, { name: p.name, price: p.price });
  }

  // ── Clientes (teléfonos FICTICIOS 34611000xx — el guard V0-2 bloquea envíos) ──
  const customersData = [
    { name: 'María García',                     phone: '34000000003', email: 'maria.garcia@example.com' },
    { name: 'José Luis Martín',                 phone: '34000000004', email: 'jl.martin@example.com' },
    { name: 'Carmen Ruiz',                      phone: '34000000005', email: null },
    { name: 'Antonio López',                    phone: '34000000006', email: 'antoniolopez@example.com' },
    { name: 'Lucía Fernández',                  phone: '34000000007', email: 'lucia.f@example.com' },
    { name: 'Comunidad de Vecinos C/ Mayor 5',  phone: '34000000008', email: 'admin.mayor5@example.com' },
    { name: 'Bar El Rincón',                    phone: '34000000009', email: 'barelrincon@example.com' },
  ];
  const customers = [];
  for (const c of customersData) {
    customers.push(await prisma.customer.create({ data: { merchantId: DEMO_ID, ...c } }));
  }
  const [maria, joseluis, carmen, antonio, lucia, comunidad, bar] = customers;

  // ── Helper de líneas (IVA 21) ──────────────────────────────────────────
  const L = (concept, qty, price) => ({ concept, qty, price, tax: 0.21 });
  const total = (lines) =>
    Math.round(lines.reduce((s, l) => s + l.qty * l.price * 1.21, 0) * 100) / 100;

  let qn = 0; // quoteNumber correlativo del demo
  async function quote({ customer, lines, status, createdDaysAgo, terms = 'FULL_UPFRONT', extra = {} }) {
    qn += 1;
    const t = total(lines);
    return prisma.quote.create({
      data: {
        merchantId: DEMO_ID,
        customerId: customer.id,
        quoteNumber: qn,
        status,
        total: t.toFixed(2),
        currency: 'EUR',
        lines,
        paymentTerms: terms,
        createdVia: 'text',
        createdAt: daysAgo(createdDaysAgo),
        updatedAt: daysAgo(createdDaysAgo),
        ...extra,
      },
    });
  }

  // Cobro pagado + factura pagada ligados a un quote aceptado
  async function paidJob(q, customer, method, paidDaysAgo) {
    const emitAt = daysAgo(paidDaysAgo, 12);
    // Cobro + documento en UNA transacción: `allocateInvoiceNumber` reserva el número
    // y avanza la serie ahí dentro, para que un fallo no deje un hueco (invoiceNumber.service).
    const { charge, number } = await prisma.$transaction(async (tx) => {
      // C1: el cliente aceptó el presupuesto desde WhatsApp — que es la historia que cuenta el
      // demo (`decisionChannel: 'whatsapp'`) — y el cobro ya está pagado.
      const number = await allocateInvoiceNumber(tx, DEMO_ID, { camino: 'C1', ...sembrado('paidJob') }, emitAt);
      const charge = await tx.charge.create({
        data: {
          merchantId: DEMO_ID,
          customerId: customer.id,
          concept: `${docLabel(number)} ${number}`,
          amount: q.total,
          currency: 'EUR',
          method,
          status: 'paid',
          createdAt: emitAt,
          events: {
            create: [
              { type: 'created', ts: emitAt, payload: {} },
              { type: 'paid', ts: daysAgo(paidDaysAgo, 18), payload: { method } },
            ],
          },
        },
      });
      await tx.invoice.create({
        data: {
          merchantId: DEMO_ID,
          customerId: customer.id,
          quoteId: q.id,
          chargeId: charge.id,
          number,
          type: isReceiptNumber(number) ? 'JUST' : 'F1', // V0-0 (regla 26)
          status: 'paid',
          paidAt: daysAgo(paidDaysAgo, 18),
          total: q.total,
          currency: 'EUR',
          lines: q.lines,
          pdfUrl: 'PENDING_PDF', // se regenera bajo demanda (con watermark DEMO)
          qrData: 'PENDING_QR',
          createdAt: emitAt,
        },
      });
      return { charge, number };
    });
    await prisma.quote.update({ where: { id: q.id }, data: { chargeId: charge.id } });
    await prisma.customerEvent.create({
      data: {
        merchantId: DEMO_ID, customerId: customer.id, type: 'payment_received',
        title: 'Pago recibido', detail: `${q.total} EUR · ${docLabel(number)} ${number}`,
        createdAt: daysAgo(paidDaysAgo, 18),
      },
    }).catch(() => {});
    return charge;
  }

  // ── 12 presupuestos, estados repartidos, importes 180–2.400 € ──────────
  // 4 ACEPTADOS + COBRADOS (métodos variados)
  // Fechas de cobro: 2 del mes pasado (historial) + 2 de ESTE mes, para que
  // "Cobrado este mes" de la Home nunca salga a 0 en demo.
  const q1 = await quote({ customer: maria,     createdDaysAgo: 20, status: 'accepted', extra: { acceptedAt: daysAgo(19), decisionChannel: 'whatsapp', decisionComment: 'Aceptado con firma digital' }, lines: [L('Sustitución de grifo monomando (cocina)', 1, 65), L('Reparación de fuga bajo fregadero', 1, 75), L('Mano de obra adicional', 1, 35)] });
  await paidJob(q1, maria, 'card', 18);
  const q2 = await quote({ customer: bar,       createdDaysAgo: 16, status: 'accepted', extra: { acceptedAt: daysAgo(15), decisionChannel: 'whatsapp' }, lines: [L('Desatasco de tubería principal', 1, 90), L('Revisión general de fontanería', 1, 45), L('Mano de obra (hora)', 2, 35)] });
  await paidJob(q2, bar, 'bizum_manual', 14);
  const q3 = await quote({ customer: comunidad, createdDaysAgo: 6, status: 'accepted', extra: { acceptedAt: daysAgo(5), decisionChannel: 'whatsapp', decisionComment: 'Aprobado en junta' }, lines: [L('Instalación de termo eléctrico 100L', 2, 240), L('Sustitución de llaves de corte', 4, 28), L('Mano de obra (hora)', 6, 35)] });
  await paidJob(q3, comunidad, 'transfer', Math.min(4, now.getDate() - 1));
  const q4 = await quote({ customer: antonio,   createdDaysAgo: 5,  status: 'accepted', extra: { acceptedAt: daysAgo(4), decisionChannel: 'whatsapp' }, lines: [L('Instalación de lavabo con grifería', 1, 160), L('Cambio de cisterna completa', 1, 85)] });
  await paidJob(q4, antonio, 'card', Math.min(2, Math.max(0, now.getDate() - 2)));

  // 1 ACEPTADO con COBRO PENDIENTE (el "dinero en juego" nº1)
  const q5 = await quote({ customer: lucia, createdDaysAgo: 4, status: 'accepted', extra: { acceptedAt: daysAgo(3), decisionChannel: 'whatsapp', decisionComment: 'Firmado desde el móvil' }, lines: [L('Reforma de baño: fontanería completa', 1, 1650), L('Instalación de plato de ducha', 1, 320)] });
  {
    const emitAt = daysAgo(3, 12);
    const charge = await prisma.$transaction(async (tx) => {
      // C1 también: mismo camino, cobro todavía sin pagar (el "dinero en juego" de la Home).
      const number = await allocateInvoiceNumber(tx, DEMO_ID, { camino: 'C1', ...sembrado('pendiente') }, emitAt);
      const charge = await tx.charge.create({
        data: {
          merchantId: DEMO_ID, customerId: lucia.id,
          concept: `${docLabel(number)} ${number}`, amount: q5.total, currency: 'EUR',
          method: 'card', status: 'pending', createdAt: emitAt,
          payMethods: ['card', 'bizum', 'transfer'],
          events: { create: [{ type: 'created', ts: emitAt, payload: {} }] },
        },
      });
      await tx.invoice.create({
        data: {
          merchantId: DEMO_ID, customerId: lucia.id, quoteId: q5.id, chargeId: charge.id,
          number,
          type: isReceiptNumber(number) ? 'JUST' : 'F1', // V0-0 (regla 26)
          status: 'pending', total: q5.total, currency: 'EUR',
          lines: q5.lines, pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR', createdAt: emitAt,
        },
      });
      return charge;
    });
    await prisma.quote.update({ where: { id: q5.id }, data: { chargeId: charge.id } });
  }

  // 1 ACEPTADO sin facturar aún (CTA "Cobrar ahora" en demo)
  await quote({ customer: carmen, createdDaysAgo: 2, status: 'accepted', extra: { acceptedAt: daysAgo(1), decisionChannel: 'whatsapp' }, lines: [L('Cambio de bajante de cocina', 1, 380), L('Mano de obra (hora)', 3, 35)] });

  // 3 ENVIADOS (esperando el sí — alimentan el héroe)
  await quote({ customer: joseluis,  createdDaysAgo: 3, status: 'sent', lines: [L('Instalación de descalcificador', 1, 690), L('Mano de obra (hora)', 3, 35)] });
  await quote({ customer: maria,     createdDaysAgo: 1, status: 'sent', lines: [L('Cambio de radiador toallero', 1, 210), L('Purga de radiadores (vivienda)', 1, 60)] });
  await quote({ customer: bar,       createdDaysAgo: 0, status: 'sent', lines: [L('Renovación de fontanería de barra', 1, 1980), L('Instalación de lavavajillas industrial', 1, 420)] });

  // 1 RECHAZADO (con motivo real — se enseña el manejo digno)
  await quote({ customer: antonio, createdDaysAgo: 10, status: 'rejected', extra: { rejectedAt: daysAgo(9), decisionChannel: 'whatsapp', rejectionReason: 'Me lo hace un conocido', decisionComment: 'Gracias de todas formas' }, lines: [L('Instalación de osmosis inversa', 1, 340)] });

  // 2 BORRADORES (para enseñar "Enviar por WhatsApp" desde el detalle)
  await quote({ customer: lucia,  createdDaysAgo: 0, status: 'draft', lines: [L('Revisión general de fontanería', 1, 45), L('Cambio de latiguillos', 4, 12)] });
  await quote({ customer: carmen, createdDaysAgo: 0, status: 'draft', terms: 'FIFTY_FIFTY', lines: [L('Instalación de bomba de presión', 1, 480), L('Mano de obra (hora)', 2, 35)] });

  // Un par de eventos extra para que las fichas respiren
  await prisma.customerEvent.create({
    data: { merchantId: DEMO_ID, customerId: maria.id, type: 'feedback', title: '⭐ 5/5 — valoración del cliente tras el cobro', detail: 'Rápido y muy limpio. Repetiré.', createdAt: daysAgo(17) },
  }).catch(() => {});
  await prisma.customerEvent.create({
    data: { merchantId: DEMO_ID, customerId: bar.id, type: 'quote_requested', title: 'Solicitud de presupuesto por WhatsApp (bot)', detail: 'Gotera en el almacén · Zona: Centro', createdAt: daysAgo(5) },
  }).catch(() => {});
}

// El host va en la primera línea a propósito: si alguien se equivoca de base, que lo vea
// en la salida y no lo deduzca del silencio.
console.log(`A6.1 · Reseteando y sembrando el merchant DEMO (id=1) en → ${HOST_DESTINO}`);
await wipeDemo();
await seed();

const counts = {
  clientes: await prisma.customer.count({ where: { merchantId: DEMO_ID } }),
  productos: await prisma.product.count({ where: { merchantId: DEMO_ID } }),
  presupuestos: await prisma.quote.count({ where: { merchantId: DEMO_ID } }),
  facturas: await prisma.invoice.count({ where: { merchantId: DEMO_ID } }),
  cobros: await prisma.charge.count({ where: { merchantId: DEMO_ID } }),
};
console.log('Sembrado ✅', counts);
await prisma.$disconnect();
// SCRUM-761: el alta real del catálogo escribe con el singleton de la app, que es OTRO cliente.
// Cerrar sólo el de arriba dejaba una conexión abierta y el proceso sin terminar.
await prismaApp.$disconnect();
