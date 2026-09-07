// SCRUM-815 · ¿EL WEBHOOK DE STRIPE MARCA EL EVENTO COMO VISTO ANTES DE TERMINAR?
//
//   node docs/master/evidencias/scrum815/idempotencia-webhook.mjs [RAIZ]
//   PASO0_SEGUNDA_VIDA=1 node ... (el mismo, en un proceso NUEVO)
//
// No necesita base de datos ni red.
//
// ⛔ NO CONTIENE NINGUNA CLAVE DE STRIPE, ni real ni de ejemplo, ni en el código ni en los
// comentarios. Y no es una limitación: es el motivo de que se ejercite la FUNCIÓN y no la ruta.
//
// Se ejercita `isDuplicateStripeEvent` de `dist/`, que es LA MISMA función que la ruta llama y
// que el propio código exporta «para la suite» (A12.2, `stripe.routes.ts:22`).
//
// ⚠️ Por qué la función y no la ruta entera: `integrations/stripe.ts` deja `stripe = null` si no
// hay `STRIPE_SECRET_KEY`, y entonces la ruta contesta 501 antes de llegar a nada. Montarla
// exigiría escribir una clave de Stripe, aunque fuese de mentira. Lo que sí se reproduce
// EXACTAMENTE es el ORDEN de la ruta, que se lee en el fichero:
//
//     :39  const event = stripe.webhooks.constructEvent(...)
//     :42  if (isDuplicateStripeEvent(event.id)) → ACK 200 y NO se procesa
//     :47+ ...aquí empieza el trabajo (axios a /webhooks/psp, prisma.merchant.update, ...)
//     :170 catch → res.status(400)   ← 400 = Stripe REINTENTA
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = process.argv[2] ?? path.resolve(AQUI, '..', '..', '..', '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';
const { isDuplicateStripeEvent } = await import(DIST + 'modules/billing/app/routes/stripe.routes.js');

// ── SUELO · si no encuentro lo que la afirmación nombra, NO concluyo «no existe el defecto» ───
if (typeof isDuplicateStripeEvent !== 'function') {
  console.error('🔴 NO ENCUENTRO lo que se describe: `isDuplicateStripeEvent` no se exporta desde '
    + '`stripe.routes.js`. Puede que el código se haya movido, y eso es un dato DISTINTO.');
  process.exit(3);
}

/**
 * La entrega de un evento, con el MISMO orden que la ruta: primero se pregunta —y ahí dentro es
 * donde se marca— y sólo después se trabaja. `fallar` simula que revienta algo del trabajo: la
 * llamada a `/webhooks/psp`, el `prisma.merchant.update`, lo que sea.
 */
function entregar(id, { fallar = false } = {}) {
  try {
    if (isDuplicateStripeEvent(id)) return { http: 200, resultado: 'DESCARTADO como duplicado' };
    if (fallar) throw new Error('la base de datos no responde');
    return { http: 200, resultado: 'PROCESADO' };
  } catch (e) {
    // El `catch` de la ruta responde 400, y un 400 hace que Stripe REINTENTE.
    return { http: 400, resultado: 'FALLO a medio procesar (' + e.message + ') → Stripe reintentará' };
  }
}
const pinta = (t, r) => console.log('   ' + t.padEnd(46) + ' → HTTP ' + r.http + ' · ' + r.resultado);

// ── ¿MEMORIA O BASE DE DATOS? ─────────────────────────────────────────────────────────────────
// Este modo corre en un proceso APARTE y recién arrancado, y entrega UNA sola vez un id que ya se
// procesó en la vida anterior. Va lo PRIMERO del fichero a propósito: al final, las entregas de
// abajo ya habrían metido el id en el `Set` de ESTE proceso y el resultado no diría nada del
// reinicio — diría que acabo de meterlo yo.
if (process.env.PASO0_SEGUNDA_VIDA === '1') {
  console.log('🔁 PROCESO NUEVO (el reinicio de Railway, o una segunda instancia):');
  const r = entregar('evt_C');
  console.log('   evt_C, ya PROCESADO en el proceso anterior     → HTTP ' + r.http + ' · ' + r.resultado);
  console.log('   (si sale PROCESADO, el estado no sobrevive al proceso: es memoria, no base de datos)');
  process.exit(0);
}

console.log('SCRUM-815 · idempotencia del webhook de Stripe');
console.log('');

// ── 🔴 EL CONTROL QUE DECIDE ──────────────────────────────────────────────────────────────────
console.log('🔴 EL CONTROL QUE DECIDE · el MISMO evento dos veces, con fallo en medio del 1º:');
const conFallo = 'evt_pago_que_falla';
pinta('1ª entrega (falla a mitad)', entregar(conFallo, { fallar: true }));
pinta('2ª entrega (reintento de Stripe)', entregar(conFallo));
console.log('');

// ── CONTROL POSITIVO ──────────────────────────────────────────────────────────────────────────
// Si la prueba no distingue estos dos casos, no ha medido idempotencia: ha medido que hay un Set.
console.log('CONTROL POSITIVO · lo que la idempotencia SÍ debe hacer:');
console.log('  a) dos eventos DISTINTOS se procesan los dos:');
pinta('evt_A', entregar('evt_A'));
pinta('evt_B', entregar('evt_B'));
console.log('  b) el MISMO evento repetido SIN fallo se descarta una vez:');
pinta('evt_C (1ª)', entregar('evt_C'));
pinta('evt_C (2ª)', entregar('evt_C'));
console.log('');
console.log('Para la otra mitad —¿memoria o base de datos?— este mismo fichero, en un proceso');
console.log('nuevo:  PASO0_SEGUNDA_VIDA=1 node docs/master/evidencias/scrum815/idempotencia-webhook.mjs');
