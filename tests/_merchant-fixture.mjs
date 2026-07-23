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
//
// NUNCA LANZA DESDE LA LIMPIEZA. Un `throw` dentro de un `finally` SUSTITUYE a la
// excepción original: el error de verdad del test desaparece y se lee un fallo de borrado
// en su lugar. Es lo que hace scrum74-recibo-token.test.mjs:132 (carril A, ver SCRUM-79),
// donde además se salta el server.close() y el $disconnect() que tiene debajo. Aquí los
// fallos de limpieza se AVISAN por consola y se siguen.
//
// `prisma` va por PARÁMETRO, no importado: así merchant-fixture.test.mjs puede inyectar un
// doble y probar en rojo las dos garantías SIN BD y SIN gate, en `npm test` normal
// (regla 3 del runbook: la garantía estructural no vive detrás de QA_DB_TEST).
import { after } from 'node:test';

/**
 * Ids de merchant vivos, creados y aún no borrados. El after() global lo usa como red.
 * Exportado para que un test que cree merchants a mano pueda registrarlos igual.
 */
export const merchantsVivos = new Set();

/**
 * Orden de borrado: hijos antes que padres. No es crítico acertarlo del todo — cada
 * operación va aislada y `limpiarMerchant` REINTENTA la pasada entera —, pero un orden
 * razonable evita la mayoría de los reintentos.
 *
 * Son los 20 modelos con `merchantId` del schema. Si mañana aparece otro y no está aquí,
 * el borrado del merchant fallará por FK y el aviso de consola lo nombrará: es ruidoso a
 * propósito, porque una lista de limpieza incompleta que calla es basura acumulándose.
 */
const MODELOS_POR_MERCHANT = [
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

    try {
      await prisma.merchant.delete({ where: { id: merchantId } });
      merchantsVivos.delete(merchantId);
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
 */
export async function withMerchant(prisma, data, fn) {
  const merchant = await prisma.merchant.create({
    data: { country: 'ES', onboardingCompleted: true, ...data },
  });
  // Registrar ANTES de cualquier otra cosa: a partir de aquí el borrado está garantizado
  // aunque `fn` reviente en su primera línea.
  merchantsVivos.add(merchant.id);

  try {
    return await fn(merchant);
  } finally {
    await limpiarMerchant(prisma, merchant.id);
  }
}

/**
 * Red de última instancia. Corre al terminar el fichero de test (node --test lanza un
 * proceso por fichero, así que el alcance es el correcto).
 *
 * No debería tener nada que barrer si todo usó withMerchant. Que encuentre algo es señal
 * de un camino sin cubrir, y por eso AVISA en vez de limpiar en silencio: una red que
 * limpia calladamente esconde justo el fallo que hay que arreglar.
 */
export function registrarBarridoFinal(prisma) {
  after(async () => {
    if (merchantsVivos.size === 0) return;
    const pendientes = [...merchantsVivos];
    console.warn(
      `⚠️  SCRUM-113: ${pendientes.length} merchant(s) seguían vivos al acabar el fichero ` +
        `(${pendientes.join(', ')}). Algún camino no pasó por withMerchant — bárrelo, pero mira por qué.`,
    );
    for (const id of pendientes) await limpiarMerchant(prisma, id);
  });
}
