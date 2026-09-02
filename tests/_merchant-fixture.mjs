// tests/_merchant-fixture.mjs — SCRUM-113 (nace del recon de SCRUM-79)
//
// LA LIMPIEZA DEJA DE DEPENDER DE QUE CADA AUTOR SE ACUERDE.
//
// El recon de SCRUM-79 midió el patrón de la casa: de los 24 ficheros de test que crean
// merchants, los 24 lo hacen ANTES del `try`. Todo el montaje de fixtures vive en una
// ventana sin red, así que un fallo ahí deja el merchant huérfano y el `finally` ni se
// plantea. Además 19 de 24 encadenan la limpieza sin aislar: el primer `deleteMany` que
// falle cancela los demás. Un `finally` que solo corre si el cuerpo llegó hasta él no es
// limpieza, es limpieza OPTIMISTA.
//
// Arreglar 24 ficheros a mano no resuelve nada: el 25 nacería igual. Esto es la pieza que
// lo hace estructural.
//
// TRES GARANTÍAS
//   1. El merchant se registra en cuanto existe, así que el borrado no depende de que el
//      cuerpo del test llegue a ningún sitio.
//   2. Cada operación de borrado va AISLADA: un fallo no cancela las siguientes.
//   3. Un after() global barre lo que quede vivo al terminar el fichero, como red de
//      última instancia — incluso si alguien no usó el helper y registró el id a mano.
//      AUTOMÁTICA: withMerchant la activa sola en su primer uso por fichero, nadie tiene
//      que acordarse de tenderla aparte (si tuviera que hacerlo, sería la misma brecha que
//      este fichero existe para cerrar, solo que un nivel más abajo).
//
// NUNCA LANZA DESDE LA LIMPIEZA. Un `throw` dentro de un `finally` SUSTITUYE a la
// excepción original: el error de verdad del test desaparece y se lee un fallo de borrado
// en su lugar. Es lo que hace scrum74-recibo-token.test.mjs:132 (carril A, ver SCRUM-79),
// donde además se salta el server.close() y el $disconnect() que tiene debajo. Aquí los
// fallos de limpieza se AVISAN por consola y se siguen.
//
// `prisma` va por PARÁMETRO, no importado: así merchant-fixture.test.mjs puede inyectar un
// doble y probar en rojo las dos garantías SIN BD y SIN gate, en `npm test` normal
// (principio 3 de docs/QA/SUITE_REGRESION.md, sección «Escribir verificaciones»: la garantía
// estructural no vive detrás de QA_DB_TEST — «una red que solo funciona cuando alguien se
// acuerda de levantarla no es una red»).
import { after } from 'node:test';

/**
 * Ids de merchant vivos, creados y aún no borrados. El after() global lo usa como red.
 * Exportado para que un test que cree merchants a mano pueda registrarlos igual.
 */
export const merchantsVivos = new Set();

/**
 * SCRUM-174: teléfonos que `withMerchant` GENERA por merchant y con los que limpia `botSession`.
 * Map merchantId → [teléfonos]. `BotSession.merchantId` es NULLABLE y SIN FK, así que el barrido
 * por merchantId (abajo) NO alcanza las filas con `merchantId = null` (sesiones anónimas del
 * webhook, keyed por phone). Se barren por estos phones — los que el fixture generó, no los que
 * supone que alguien creó.
 */
const telefonosPorMerchant = new Map();

/**
 * Convención de teléfonos de test — FUENTE ÚNICA (SCRUM-180: cambiar el rango es cambiarlo AQUÍ,
 * no en cada suite). `34600…` = cliente entrante · `34601…` = PRO (whatsappPhone del merchant).
 * Derivados de `merchant.id` (no del reloj) → únicos por construcción, sin colisión entre suites.
 * `padStart(6)`: 11 dígitos hasta id 999999; por encima crece a 12 y sigue único.
 */
export function telefonosDe(merchantId) {
  const sufijo = String(merchantId).padStart(6, '0');
  return { cliente: `34600${sufijo}`, pro: `34601${sufijo}` };
}

/**
 * Orden de borrado: hijos antes que padres. No es crítico acertarlo del todo — cada
 * operación va aislada y `limpiarMerchant` REINTENTA la pasada entera —, pero un orden
 * razonable evita la mayoría de los reintentos.
 *
 * Son los 23 modelos con `merchantId` del schema (SCRUM-170 sumó `albaranLineaFacturada`;
 * SCRUM-495 sumó `emailMessage`, medido: 22 con `merchantId`, y él **sin relación declarada**, así
 * que entra en el grupo de columna suelta; SCRUM-674 sumó `parteTrabajo`, también suelto,
 * así que son 12 con FK + 11 sueltos). La
 * red de seguridad NO es uniforme (censo SCRUM-172), y saberlo importa:
 *   · 12 tienen FK a Merchant, todas RESTRICT: si uno se sale de la lista, el `merchant.delete`
 *     del fixture falla RUIDOSO y el error nombra la tabla. Red real. MEDIDO, no inferido del
 *     schema: `pg_constraint` en dev Y en staging (SCRUM-192) da 12 constraints, todas
 *     `confdeltype='r'` (RESTRICT). Los otros números que rondaron (0 y 2) eran mediciones
 *     erróneas — no lo vuelvas a medir, el dato ya está confirmado en dos BD con el mismo método.
 *   · 11 son COLUMNA SUELTA, sin FK (WhatsAppMessage, LegalAcceptance, Job, MaintenancePlan,
 *     AuditLog, Attachment, Albaran, AlbaranLineaFacturada, EmailMessage, ParteTrabajo + BotSession). NO hay red:
 *     `merchant.delete` «tiene éxito» dejando huérfanos. Fallo MUDO. Su única protección es estar
 *     en esta lista con el predicado correcto. OJO — NO son «logs»: `Job` es el Trabajo, la
 *     entidad CENTRAL del producto, y Albaran/AlbaranLineaFacturada/Attachment/MaintenancePlan
 *     son datos de negocio. Olvidar una deja huérfanos MUDOS de datos REALES, no de un log.
 * Principio FK-Restrict (docs/QA/SUITE_REGRESION.md). `botSession` agrava: merchantId nullable,
 * el predicado `{ merchantId }` ni toca sus filas null → se barre aparte, por phone (SCRUM-174).
 */
const MODELOS_POR_MERCHANT = [
  // SCRUM-170: el libro de líneas facturadas va PRIMERO — cuelga de albarán y de factura, y
  // ninguna FK lo cascadea (patrón multi-tenant de columna). Si no se barre antes que ellos,
  // quedan filas huérfanas que nadie ve fallar (justo lo que documenta SCRUM-172).
  'albaranLineaFacturada',
  // SCRUM-495 · `emailMessage` va con los de COLUMNA SUELTA y ANTES de `customer`: tiene
  // `merchant_id` y `customer_id` **sin FK ninguna** (el modelo no declara relaciones), así que
  // `merchant.delete` «tiene éxito» dejando sus filas huérfanas — fallo MUDO, el peor de los dos.
  //
  // ⚠️ ESTO NO ES EL CAMINO DE RGPD, y confundirlos sería grave: esta lista es la limpieza del
  // merchant EFÍMERO de los tests (`limpiarMerchant` hace `deleteMany`), y ahí borrar es lo
  // correcto — son datos de prueba que no deben sobrevivir a su test. La supresión de un merchant
  // REAL va por `suprimirMerchant`, que **anonimiza** (`CAMPOS_PERSONALES`) y conserva el asiento
  // (art. 17.3.b RGPD). Que `to_email` se anonimice en ese camino es otro registro y NO está hecho:
  // ver `docs/master/SCRUM-495.md`.
  'emailMessage',
  // SCRUM-674 · `parteTrabajo` (tabla de SCRUM-652) es COLUMNA SUELTA: merchant_id, job_id y
  // customer_id SIN FK ninguna. O sea, del grupo MUDO — `merchant.delete` «tiene exito» y deja
  // los partes huerfanos sin que nadie proteste. Esta lista es su unica red.
  'parteTrabajo',
  'auditLog', 'whatsAppMessage', 'legalAcceptance', 'customerEvent', 'attachment',
  'albaran', 'maintenancePlan', 'invoice', 'charge', 'job', 'quote', 'quoteRequest',
  'botSession', 'quoteTemplate', 'expense', 'product', 'provider', 'authSession',
  'teamMember', 'customer',
];

/** Espera sin bloquear; el reintento existe por las escrituras asíncronas (ver abajo). */
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Borra TODO lo del merchant y el merchant. No lanza jamás: devuelve `true` si el merchant
 * quedó borrado y `false` si no, avisando por consola.
 *
 * REINTENTA la pasada completa porque hay escrituras FIRE-AND-FORGET en producción
 * (recordCustomerEvent en receipt.routes.ts, SCRUM-105): la respuesta HTTP puede volver al
 * test ANTES de que el INSERT aterrice, y esa fila tardía revive la FK justo después de
 * haberla limpiado. Reintentar la pasada entera cubre eso sin tener que adivinar quién
 * escribe tarde.
 */
export async function limpiarMerchant(prisma, merchantId, { intentos = 3 } = {}) {
  let ultimoError = null;

  for (let intento = 1; intento <= intentos; intento++) {
    // Los eventos cuelgan de charge, no de merchant: no tienen merchantId propio.
    await prisma.event
      .deleteMany({ where: { charge: { merchantId } } })
      .catch((err) => { ultimoError = err; });

    for (const modelo of MODELOS_POR_MERCHANT) {
      // AISLADO: el fallo de uno no cancela los siguientes. Sin esto, un borrado que
      // falla a mitad deja intactos todos los de detrás — y con ellos el merchant.
      await prisma[modelo]
        ?.deleteMany({ where: { merchantId } })
        .catch((err) => { ultimoError = err; });
    }

    // SCRUM-174: barrido de `botSession` por PHONE. El de arriba, por merchantId, no alcanza las
    // filas con `merchantId = null` (nullable + SIN FK), y como no hay FK `merchant.delete` no
    // protesta si quedan: fallo MUDO (principio FK-Restrict, docs/QA/SUITE_REGRESION.md). Se
    // barren por los teléfonos que `withMerchant` generó para este merchant (+ los de `phones`).
    const telefonos = telefonosPorMerchant.get(merchantId);
    if (telefonos?.length) {
      await prisma.botSession
        ?.deleteMany({ where: { phone: { in: telefonos } } })
        .catch((err) => { ultimoError = err; });
    }

    try {
      await prisma.merchant.delete({ where: { id: merchantId } });
      merchantsVivos.delete(merchantId);
      telefonosPorMerchant.delete(merchantId);
      return true;
    } catch (err) {
      ultimoError = err;
      if (intento < intentos) await esperar(150);
    }
  }

  console.warn(
    `⚠️  SCRUM-113: no se pudo borrar el merchant ${merchantId} tras ${intentos} pasadas. ` +
      `Queda HUÉRFANO en staging (límpialo con scripts/clean-staging-tests.mjs). ` +
      `Último error: ${ultimoError?.message || ultimoError}`,
  );
  return false;
}

/**
 * Crea un merchant, lo registra y garantiza su borrado pase lo que pase.
 *
 * El resto de fixtures (customer, charge, invoice…) se montan DENTRO de `fn`, que es la
 * diferencia con el patrón actual: ahí ya están cubiertos por el `finally`. Si el montaje
 * revienta a media construcción, el merchant se borra igual.
 *
 *   await withMerchant(prisma, { name: 'QA S99', email: `qa-s99-${Date.now()}@test.local` },
 *     async (merchant) => {
 *       const cliente = await prisma.customer.create({ ... });  // cubierto
 *       ...asserts...
 *     });
 *
 * El error del test se propaga TAL CUAL: la limpieza no lo sustituye ni lo enmascara.
 *
 * Defaults: SOLO `country: 'ES'` y `onboardingCompleted: true`. `planExpiresAt` NO es
 * default a propósito (SCRUM-123) — decisión, no descuido. `planExpiresAt: null` (lo que
 * sale sin fijarlo) ya deja pasar cualquier request: `requireActivePlan` solo bloquea con
 * `plan === 'trial' && planExpiresAt && planExpiresAt < new Date()`, así que `null`
 * cortocircuita esa condición a falso. Solo hace falta fijarlo (a una fecha FUTURA) si tu
 * test llama a una de estas cuatro rutas, las ÚNICAS con `requireActivePlan`:
 *   POST /admin/albaranes/:id/enviar-whatsapp
 *   POST /admin/albaranes/:id/enviar-para-firmar
 *   POST /admin/quotes/:id/send-whatsapp
 *   POST /quote/create
 * Si tu test NO llama a ninguna, no lo pongas — un default lo haría invisible en vez de
 * evitarlo: SCRUM-123 encontró DOS ficheros (scrum66, scrum68) que lo arrastraban sin
 * necesitarlo, uno de ellos con un comentario que JUSTIFICABA (mal) por qué hacía falta.
 * Copiar el fixture de un test hermano sin mirar esta lista es exactamente el error que
 * un default habría hecho imposible de detectar.
 *
 * TELÉFONOS (SCRUM-174): `fn` recibe un 2º argumento `phones = { cliente, pro }` que ESTE
 * fixture genera desde `merchant.id` (`34600…`/`34601…`, fuente única — SCRUM-180). Úsalos en
 * vez de inventarlos: al limpiar, el fixture barre `botSession` por exactamente estos.
 *   await withMerchant(prisma, data, async (merchant, { cliente, pro }) => { ... });
 * CONDICIÓN: si tu test crea bot sessions con teléfonos que el fixture NO generó, pásalos en la
 * opción `{ phones: [...] }` — si no, quedarán HUÉRFANAS: el barrido solo alcanza los que
 * conoce, y `BotSession.merchantId` (nullable, sin FK) no deja rastro para encontrarlas.
 */
// SCRUM-113 (verificación post-cierre): `registrarBarridoFinal` estaba escrita, documentada
// como la garantía nº3, y CERO ficheros la llamaban — la propia red de última instancia
// dependía de que cada autor se acordara de tender OTRA red aparte. Es la misma brecha que
// el ticket entero existe para cerrar, reabierta en su propia pieza de repuesto. Ahora
// `withMerchant` la activa sola en su primer uso por fichero: nadie tiene que acordarse.
let barridoRegistradoEnEsteFichero = false;

/**
 * SOLO PARA TESTS de este propio fichero (merchant-fixture.test.mjs): el flag de "ya
 * registrado" es de módulo, así que un test que quiera comprobar el PRIMER uso de
 * withMerchant en aislamiento necesita poder rebobinarlo — si no, hereda el registro que
 * ya hizo el test anterior del mismo fichero y el suyo pasaría en falso (o fallaría en
 * falso). No se usa nunca en un fichero de test real: ahí el "primer uso" es de verdad.
 */
export function _resetBarridoParaTests() {
  barridoRegistradoEnEsteFichero = false;
}

export async function withMerchant(prisma, data, fn, { after: afterFn = after, phones: phonesExtra = [] } = {}) {
  if (!barridoRegistradoEnEsteFichero) {
    barridoRegistradoEnEsteFichero = true;
    registrarBarridoFinal(prisma, { after: afterFn });
  }

  const merchant = await prisma.merchant.create({
    data: { country: 'ES', onboardingCompleted: true, ...data },
  });
  // Registrar ANTES de cualquier otra cosa: a partir de aquí el borrado está garantizado
  // aunque `fn` reviente en su primera línea.
  merchantsVivos.add(merchant.id);

  // SCRUM-174: el fixture GENERA los teléfonos y se los ENTREGA a `fn`; al limpiar barre
  // `botSession` por EXACTAMENTE estos (+ los pasados en `phones`, ver CONDICIÓN en el doc).
  const phones = telefonosDe(merchant.id);
  telefonosPorMerchant.set(merchant.id, [...Object.values(phones), ...phonesExtra]);

  try {
    return await fn(merchant, phones);
  } finally {
    await limpiarMerchant(prisma, merchant.id);
  }
}

/**
 * La barrida en sí, separada de CUÁNDO se dispara (`registrarBarridoFinal`) para poder
 * probarla directamente — sin esperar a que un proceso de verdad termine.
 *
 * No debería tener nada que barrer si todo usó withMerchant. Que encuentre algo es señal
 * de un camino sin cubrir, y por eso AVISA en vez de limpiar en silencio: una red que
 * limpia calladamente esconde justo el fallo que hay que arreglar.
 */
/**
 * SCRUM-194 · LAS QUE LLEGAN TARDE — cerrar el ORIGEN, no limpiar el resultado.
 *
 * Medido el 28-jul-2026: 68 filas huérfanas en staging (`AuditLog` 47, `WhatsAppMessage` 21) y
 * CERO en producción. El reparto lo dice todo: son exactamente los dos modelos que se escriben
 * FIRE-AND-FORGET (`recordAudit`, `recordWaMessage`, ninguno esperado con `await`).
 *
 * O sea que NO es un problema de cobertura —los dos están en `MODELOS_POR_MERCHANT` y el barrido
 * los visita— sino de CUÁNDO: la escritura asíncrona aterriza DESPUÉS de que se borrara el
 * merchant efímero, así que la fila nace ya huérfana. `limpiarMerchant` reintenta por esto
 * mismo, pero el reintento tiene un final y la que llega más tarde se queda.
 *
 * Aquí se cierra por el otro lado: al terminar el fichero se barren las filas cuyo `merchantId`
 * NO EXISTE. Es seguro por definición —no hay merchant al que pertenezcan ni consulta legítima
 * que las quiera— y ataja la carrera sin tener que adivinar cuánto tarda una escritura suelta.
 */
/**
 * SCRUM-272 · EL CRITERIO ES REFERENCIAL, NO UNA FOTO.
 *
 * Antes tomaba `merchant.findMany()` UNA vez y luego borraba con `merchantId: { notIn: ids }`
 * durante los 21 `deleteMany` siguientes: decidía con una foto y borraba después. La dirección
 * peligrosa es la que no se ve — **un merchant creado DESPUÉS de la foto no está en `ids`, así
 * que sus filas CASAN el criterio y se borran**, aunque exista y esté en uso.
 *
 * Hoy eso no puede morder por sí solo, y conviene decirlo para que nadie lo lea como un
 * incidente: dentro de una tanda nada crea merchants a la vez (los cuatro hijos se lanzan con
 * `spawnSync`, secuenciales, y cada uno corre con `--test-concurrency=1`), y el turno de
 * SCRUM-188 serializa las tandas entre sesiones. Lo mantenía inofensivo **un mecanismo externo
 * que esta función no conoce** — correcto por la razón equivocada.
 *
 * Ahora el criterio se evalúa EN LA BASE y en el instante del borrado: `NOT EXISTS (SELECT 1 FROM
 * merchants …)`. No hay foto que envejecer, así que la ventana desaparece por construcción en vez
 * de depender de que nadie corra nada a la vez.
 *
 * ⚠️ SIGUEN SIENDO 21 SENTENCIAS Y NO UNA, y el motivo está medido: hay **13 relaciones entre
 * tablas del propio barrido** (`Invoice → Charge`, `Quote → Customer`, `Expense → Provider`…).
 * Meterlas en una sola sentencia con CTEs de escritura NO garantiza el orden de ejecución, y con
 * FK inmediatas eso puede reventar por violación de clave. El orden de `MODELOS_POR_MERCHANT` es
 * deliberado (SCRUM-170) y se conserva. Lo que se ahorra es la consulta de la foto: **22 → 21**.
 *
 * Los nombres físicos de tabla y columna salen del DMMF y NO se derivan a mano: convertir
 * `merchantId → merchant_id` a ojo es lo que tumbó el backfill de SCRUM-205, y aquí hay 21
 * oportunidades de equivocarse.
 */
export async function barridoDeHuerfanas(prisma, dmmf) {
  const ns = dmmf ?? (await import('@prisma/client')).Prisma?.dmmf;
  const modelos = new Map((ns?.datamodel?.models ?? []).map((m) => [m.name, m]));

  let total = 0;
  for (const modelo of MODELOS_POR_MERCHANT) {
    // El nombre del delegado del cliente va en camelCase; en el DMMF, con inicial en mayúscula.
    const meta = modelos.get(modelo[0].toUpperCase() + modelo.slice(1));
    const tabla = meta?.dbName || meta?.name;
    const col = meta?.fields?.find((f) => f.name === 'merchantId');
    if (!tabla || !col) continue; // sin tabla o sin columna de merchant no hay nada que barrer
    const columna = col.dbName || col.name;
    const r = await prisma
      .$executeRawUnsafe(
        `DELETE FROM "${tabla}" t WHERE NOT EXISTS (SELECT 1 FROM "merchants" m WHERE m.id = t."${columna}")`,
      )
      .catch(() => null);
    total += r || 0;
  }
  if (total > 0) console.warn(`🧹 SCRUM-194: ${total} fila(s) huérfana(s) barridas al cerrar el fichero.`);
  return total;
}

export async function barridoFinal(prisma) {
  // Las huérfanas se barren SIEMPRE, haya o no merchants vivos: aparecen justamente cuando el
  // merchant ya se borró y su escritura tardía llegó después.
  await barridoDeHuerfanas(prisma).catch((e) => console.warn('barrido de huérfanas:', e?.message));
  if (merchantsVivos.size === 0) return;
  const pendientes = [...merchantsVivos];
  console.warn(
    `⚠️  SCRUM-113: ${pendientes.length} merchant(s) seguían vivos al acabar el fichero ` +
      `(${pendientes.join(', ')}). Algún camino no pasó por withMerchant — bárrelo, pero mira por qué.`,
  );
  for (const id of pendientes) await limpiarMerchant(prisma, id);
}

/**
 * Red de última instancia. Corre al terminar el fichero de test (node --test lanza un
 * proceso por fichero, así que el alcance es el correcto). `withMerchant` la activa sola;
 * llamarla aparte solo hace falta si se crean merchants a mano sin pasar por el helper.
 *
 * `after` va por parámetro con default al real de `node:test` (mismo patrón que `prisma`
 * arriba): así un test puede inyectar un doble y comprobar que el REGISTRO ocurre, sin
 * depender del cierre real del proceso.
 */
export function registrarBarridoFinal(prisma, { after: afterFn = after } = {}) {
  afterFn(() => barridoFinal(prisma));
}
