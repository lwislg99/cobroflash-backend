// tests/scrum809-paywall-tras-cancelar.test.mjs — SCRUM-809 · EL PAYWALL ESTABA DEL REVÉS
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA VÍCTIMA, MEDIDA POR EL CAMINO REAL
//
// `requireActivePlan` (en `authMiddleware.ts`, el ÚNICO 403 `trial_expired` del árbol) bloquea con:
//
//     plan === 'trial' && planExpiresAt && planExpiresAt < new Date()
//
// y las dos puertas de cancelación del webhook de Stripe escribían `planExpiresAt: null`. Con ese
// `null`, el segundo operando es falsy y LA CONDICIÓN SE VUELVE INSATISFACIBLE: quien paga y luego
// cancela no puede ser alcanzado por el paywall NUNCA. Quien no pagó jamás sí, porque conserva la
// fecha de fin de su trial. Estaba del revés — el que pagó alguna vez se quedaba el producto
// gratis para siempre, y el que no, fuera.
//
// Medido el 7-sep-2026 contra `yaqu_dev_javier` (dev; foto, la base es compartida y se mueve),
// recorriendo el webhook DE VERDAD —firma HMAC verificada por `stripe.webhooks.constructEvent`,
// mismo router, mismo handler—:
//     inicial        plan=trial expira=2026-09-12  estado=null
//     PAGA           plan=pro   expira=2026-10-07  estado=active
//     CANCELA        plan=trial expira=null        estado=canceled   ← aquí se pierde la fecha
//     /quote/create  400 validation_error ............................ ATRAVIESA EL PAYWALL
//
// El 400 es la prueba de que ATRAVESÓ: la petición llegó hasta el validador del handler, o sea
// pasó por `requireActivePlan` sin que le cortara. Un 403 `trial_expired` habría muerto antes.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🟢 LA FIRMA DEL FUNDADOR (7-sep-2026), LITERAL
//
//     «El que cancela CONSERVA EL ACCESO HASTA EL FIN DEL PERIODO QUE YA PAGÓ.»
//
// Es decir: cancelar deja de borrar la fecha. El arreglo es QUITAR `planExpiresAt: null` de las
// dos puertas — no se añade estado, ni flag, ni literal, ni se toca el schema ni `getEntitlements`.
// El campo conserva lo que ya tenía, que es justo el fin del periodo pagado.
//
// ⚠️ POR QUÉ ESTE GUARD MIDE ACCESO Y NO LA COLUMNA. Comprobar `planExpiresAt !== null` habría
// pasado igual de verde y no dice nada de lo que le ocurre a la persona: la columna es el medio,
// no el defecto. Lo que se afirma aquí es lo que el profesional PUEDE HACER — se le manda una
// petición real a una de las cuatro rutas gateadas y se lee lo que le contesta el producto.
//
// ⚠️ LAS DOS PUERTAS, Y POR QUÉ NO BASTA UNA. Censado sobre el árbol entero (`git grep` de
// `canceled` y de `planExpiresAt: null` bajo `src/`, sin lista cableada): son exactamente dos, y
// son dos CAMINOS DISTINTOS de Stripe, no dos copias del mismo.
//     A) `customer.subscription.updated|created` con status `canceled`/`incomplete_expired`
//     B) `customer.subscription.deleted`
// Cada escenario de abajo se corre por LAS DOS. Arreglar una y no la otra deja la mitad de las
// cancelaciones con el defecto vivo, y sería invisible para un guard que probara sólo su camino.
//
// Se nombran por su EVENTO y no por su línea a propósito (trinquete de SCRUM-710b, que saltó
// contra la primera versión de este fichero y tenía razón): este mismo commit escribe comentarios
// encima de las dos y las desplaza, así que un `:138`/`:151` escrito aquí nacería ya caducado.
//
// ⚠️ GATEADO (crea y BORRA merchants efímeros, levanta la app):
//   QA_DB_TEST=1 WHATSAPP_DRY_RUN=1 npm run test:staging:gated
import './_staging-db.mjs'; // SCRUM-60: fija DATABASE_URL a la BD de pruebas del carril (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import Stripe from 'stripe';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113: la limpieza no depende de que yo me acuerde

const ENABLED = process.env.QA_DB_TEST === '1';

// Claves de JUGUETE, fijadas antes de cargar `dist/` (que lee `config` al importarse). No viaja
// nada a Stripe: `constructEvent` es HMAC local y `generateTestHeaderString` es su inversa. Se
// asignan con `=` y no con `||=` a propósito — si el entorno trajera un secreto real, la firma que
// yo genero no casaría con él y el guard moriría con un 400 de firma en vez de medir el paywall.
const CLAVE_JUGUETE = 'sk_test_scrum809';
const WHSEC_JUGUETE = 'whsec_scrum809';
process.env.STRIPE_SECRET_KEY = CLAVE_JUGUETE;
process.env.STRIPE_WEBHOOK_SECRET = WHSEC_JUGUETE;

const DIA = 24 * 3600 * 1000;

/**
 * La ventana del escenario que ATRAVIESA el vencimiento con el reloj de verdad. No se simula el
 * paso del tiempo ni se reescribe la fecha a mano después de cancelar: se paga un periodo que dura
 * esto, se cancela, y se pregunta dos veces —antes y después—. Es el único modo de que el "antes"
 * y el "después" sean el MISMO merchant cruzando su propia fecha.
 */
const VENTANA_MS = 4000;

/** Las dos puertas de cancelación. `enviar` recibe el emisor de eventos y la suscripción. */
const PUERTAS = [
  {
    nombre: 'A · customer.subscription.updated (status=canceled)',
    enviar: (emitir, sub) => emitir('customer.subscription.updated', { ...sub, status: 'canceled' }),
  },
  {
    nombre: 'B · customer.subscription.deleted',
    enviar: (emitir, sub) => emitir('customer.subscription.deleted', sub),
  },
];

/** Bloqueado = el paywall le cortó. Cualquier otra respuesta significa que lo ATRAVESÓ. */
const bloqueado = (r) => r.status === 403 && /"error"\s*:\s*"trial_expired"/.test(r.cuerpo);

/**
 * GUARDA DE PRESENCIA (criterio de la casa, SCRUM-127). Un "no está bloqueado" no vale por sí solo:
 * si la cookie no se hubiera montado o la ruta no existiera, también saldría "no 403" y el guard
 * daría verde sin haber probado nada. Con plan vigente la ruta tiene que contestar EXACTAMENTE su
 * error de validación — eso demuestra que la petición llegó al handler, o sea que cruzó el paywall.
 * Si algún día cambia el validador, esto cae RUIDOSO y se actualiza a conciencia; es deliberado.
 */
const llegoAlHandler = (r) => r.status === 400 && /"error"\s*:\s*"validation_error"/.test(r.cuerpo);

/**
 * Petición a la app por `node:http` y con `agent: false`.
 *
 * 🔴 NO SE USA `fetch` A PROPÓSITO, y no es estilo: es el remedio que dejó escrito SCRUM-100 y
 * volvió a medir SCRUM-560. Con 3+ peticiones de undici sobre el mismo `app.listen(0)`, sus
 * conexiones dejan el proceso en un estado que revienta una aserción nativa de libuv al cerrar
 * (`exitCode 3221226505`), y el fichero sale rojo SIN nombrar ningún subtest — un rojo con ruido
 * en la tanda de todo el mundo. `scrum334` pasó de abortar 2 de cada 10 tandas a 0 de 20 con este
 * cambio. Este fichero hace tres peticiones por escenario, así que caía de lleno en el patrón: el
 * trinquete de SCRUM-560 lo cazó en su primera versión, que sí usaba `fetch`.
 *
 * `agent: false` es la pieza: sin pool, cada petición abre y cierra su propia conexión.
 */
function pedir(puerto, { metodo = 'GET', ruta, headers = {}, cuerpo = null } = {}) {
  return new Promise((resolve) => {
    const req = http.request(
      { host: '127.0.0.1', port: puerto, path: ruta, method: metodo, headers, agent: false },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (t) => { data += t; });
        res.on('end', () => resolve({
          status: res.statusCode,
          cuerpo: data,
          cookies: res.headers['set-cookie'] || [],
        }));
      },
    );
    // Un fallo de red es «sin respuesta», no una excepción que tumbe el test: los asserts de
    // abajo distinguen 0 de 403 y dicen cuál vieron.
    req.on('error', (e) => resolve({ status: 0, cuerpo: '', cookies: [], _err: e?.message }));
    if (cuerpo !== null) req.write(cuerpo);
    req.end();
  });
}

async function conApp(fn) {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const puerto = server.address().port;
  const firmador = new Stripe(CLAVE_JUGUETE, { apiVersion: '2024-06-20' });

  let nEvt = 0;
  /** Un id nuevo por evento: el router lleva un LRU de idempotencia (A10.4). */
  const idNuevo = () => `evt_scrum809_${Date.now()}_${nEvt++}_${crypto.randomBytes(4).toString('hex')}`;

  /** Emite por el camino real: cuerpo crudo + cabecera `stripe-signature` válida. */
  const emitirCon = async (id, tipo, objeto) => {
    const payload = JSON.stringify({ id, type: tipo, data: { object: objeto } });
    const firma = firmador.webhooks.generateTestHeaderString({ payload, secret: WHSEC_JUGUETE });
    const res = await pedir(puerto, {
      metodo: 'POST',
      ruta: '/webhooks/stripe',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': firma,
        'content-length': Buffer.byteLength(payload),
      },
      cuerpo: payload,
    });
    assert.equal(res.status, 200, `el webhook no aceptó ${tipo}: ${res.status} ${res.cuerpo}`);
    return res.cuerpo;
  };

  const emitir = async (tipo, objeto) => {
    const cuerpo = await emitirCon(idNuevo(), tipo, objeto);
    // NEGACIÓN, y su hermano positivo vive en el test de idempotencia de más abajo, que hace
    // salir este MISMO token con un id repetido (SCRUM-237: una negación cuyo token no se ve
    // aparecer nunca es una negación que no comprueba nada).
    assert.ok(!/"duplicate":true/.test(cuerpo),
      `evento tratado como DUPLICADO: el LRU de idempotencia lo descartó sin aplicar nada, así que `
      + `el escenario no llegó a montarse y lo que midiera después sería mentira. Cuerpo: ${cuerpo}`);
    return cuerpo;
  };

  /** Sesión real por el mismo camino que una persona: magic link → cookie. */
  const cookieDe = async (merchantId) => {
    const token = 'qa809-' + crypto.randomBytes(12).toString('hex');
    await prisma.authSession.create({
      data: { merchantId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
    });
    const res = await pedir(puerto, { ruta: `/auth/verify?token=${token}` });
    const cookie = (res.cookies[0] || '').split(';')[0];
    assert.ok(cookie.startsWith('pf_session='), `no se obtuvo cookie de sesión (status ${res.status})`);
    return cookie;
  };

  /** Lo que el profesional PUEDE HACER: una de las cuatro rutas con `requireActivePlan`. */
  const intentarTrabajar = async (cookie) => {
    const cuerpo = JSON.stringify({});
    return pedir(puerto, {
      metodo: 'POST',
      ruta: '/quote/create',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(cuerpo), cookie },
      cuerpo,
    });
  };

  const subDe = (merchantId, finMs) => ({
    id: `sub_scrum809_${merchantId}`,
    status: 'active',
    metadata: { merchant_id: String(merchantId), plan: 'pro' },
    current_period_end: Math.floor(finMs / 1000),
  });

  try {
    return await fn({ prisma, emitir, emitirCon, idNuevo, cookieDe, intentarTrabajar, subDe });
  } finally {
    server.close();
  }
}

const nuevo = (extra) => ({
  name: 'QA S809',
  email: `qa-s809-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`,
  ...extra,
});

for (const puerta of PUERTAS) {
  test(
    `SCRUM-809 · 🔴 EL QUE DECIDE · ${puerta.nombre}: paga → cancela → conserva el periodo Y el paywall le alcanza al vencer`,
    { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' },
    async () => {
      await conApp(async ({ prisma, emitir, cookieDe, intentarTrabajar, subDe }) => {
        await withMerchant(prisma, nuevo({ plan: 'trial', planExpiresAt: new Date(Date.now() + 5 * DIA) }), async (m) => {
          const cookie = await cookieDe(m.id);

          // ── PAGA. Periodo corto A PROPÓSITO: se va a cruzar con el reloj de verdad.
          const finPeriodo = Date.now() + VENTANA_MS;
          await emitir('customer.subscription.updated', subDe(m.id, finPeriodo));
          const pagado = await prisma.merchant.findUnique({
            where: { id: m.id },
            select: { plan: true, planExpiresAt: true, subscriptionStatus: true },
          });
          assert.equal(pagado.plan, 'pro', 'el pago no activó el plan: el escenario no llegó a montarse');
          assert.ok(pagado.planExpiresAt, 'el pago no fijó `planExpiresAt`: no hay periodo que conservar');

          // PRESENCIA: pagando y con el periodo vivo, trabaja. Sin esto, un 403 posterior podría
          // deberse a que esta ruta nunca funcionó para esta fixture.
          const trabajando = await intentarTrabajar(cookie);
          assert.ok(llegoAlHandler(trabajando),
            `con plan pagado y vigente la ruta debía llegar al handler (400 validation_error) y contestó ${trabajando.status} ${trabajando.cuerpo}`);

          // ── CANCELA por ESTA puerta.
          await puerta.enviar(emitir, subDe(m.id, finPeriodo));
          const cancelado = await prisma.merchant.findUnique({
            where: { id: m.id },
            select: { plan: true, planExpiresAt: true, subscriptionStatus: true },
          });
          assert.equal(cancelado.subscriptionStatus, 'canceled', `la puerta ${puerta.nombre} no marcó la cancelación`);

          // ── 🔴 LO QUE LE IMPORTA AL FUNDADOR, Y VA PRIMERO: cancelar NO puede cerrarle la
          // puerta mientras el periodo que pagó siga vivo. Cobrarle y no dejarle pasar sería
          // peor que el defecto de hoy.
          const antes = await intentarTrabajar(cookie);
          const instanteAntes = Date.now();

          // SUELO: si la máquina tardó tanto que el "antes" cayó ya pasada la fecha, esta medida
          // NO dice nada. Se declara CIEGA en vez de dar un verde que no se ha ganado.
          assert.ok(instanteAntes < finPeriodo,
            `CIEGO: la comprobación «antes de vencer» ocurrió ${instanteAntes - finPeriodo} ms DESPUÉS del vencimiento. `
            + 'No mide lo que dice medir; sube VENTANA_MS y repite.');
          assert.ok(!bloqueado(antes),
            'CANCELÓ Y SE LE CERRÓ LA PUERTA CON EL PERIODO PAGADO TODAVÍA VIVO. La firma del fundador dice '
            + `«conserva el acceso hasta el fin del periodo que ya pagó»: ${antes.status} ${antes.cuerpo}`);
          assert.ok(llegoAlHandler(antes),
            `tras cancelar y con el periodo vivo debía seguir trabajando igual: ${antes.status} ${antes.cuerpo}`);

          // ── Y AHORA SE CRUZA LA FECHA. Reloj real, mismo merchant, misma cookie.
          await new Promise((r) => setTimeout(r, Math.max(0, finPeriodo - Date.now()) + 750));

          const despues = await intentarTrabajar(cookie);
          assert.ok(Date.now() > finPeriodo, 'CIEGO: no se llegó a cruzar el vencimiento');
          assert.ok(bloqueado(despues),
            '🔴 EL DEFECTO DE SCRUM-809: venció el periodo que pagó y el paywall NO le alcanza. Si '
            + '`planExpiresAt` vuelve a null al cancelar, `plan === \'trial\' && planExpiresAt && …` es '
            + `INSATISFACIBLE y este merchant se queda el producto gratis para siempre. Recibió: ${despues.status} ${despues.cuerpo}`);
        });
      });
    },
  );

  test(
    `SCRUM-809 · la pregunta que dejó abierta el fundador · ${puerta.nombre}: si la fecha YA estaba vencida al cancelar, le alcanza YA`,
    { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' },
    async () => {
      await conApp(async ({ prisma, emitir, cookieDe, intentarTrabajar, subDe }) => {
        await withMerchant(prisma, nuevo({ plan: 'trial', planExpiresAt: new Date(Date.now() + 5 * DIA) }), async (m) => {
          const cookie = await cookieDe(m.id);

          // Paga un periodo que YA venció (el caso de la pregunta: cancela tarde, sin periodo vivo).
          const finVencido = Date.now() - DIA;
          await emitir('customer.subscription.updated', subDe(m.id, finVencido));
          await puerta.enviar(emitir, subDe(m.id, finVencido));

          const r = await intentarTrabajar(cookie);
          assert.ok(bloqueado(r),
            'cancelando SIN periodo pagado vivo, el paywall debe alcanzarle inmediatamente '
            + `(no hay nada que conservar). Recibió: ${r.status} ${r.cuerpo}`);
        });
      });
    },
  );
}

test(
  'SCRUM-809 · ✅ POSITIVO · el que NUNCA pagó y agota su trial acaba donde acababa: bloqueado',
  { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' },
  async () => {
    await conApp(async ({ prisma, cookieDe, intentarTrabajar }) => {
      // Ni un solo evento de Stripe: este merchant no pasa por ninguna de las dos puertas.
      await withMerchant(prisma, nuevo({ plan: 'trial', planExpiresAt: new Date(Date.now() - DIA) }), async (m) => {
        const r = await intentarTrabajar(await cookieDe(m.id));
        assert.ok(bloqueado(r),
          'ÉSTE es el usuario al que hoy se trata BIEN. Si al arreglar la cancelación se mueve, se ha '
          + `roto por el otro lado: ${r.status} ${r.cuerpo}`);
      });
    });
  },
);

test(
  'SCRUM-809 · ✅ NEGATIVO · el que paga y NO cancela no se mueve un milímetro',
  { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' },
  async () => {
    await conApp(async ({ prisma, emitir, cookieDe, intentarTrabajar, subDe }) => {
      await withMerchant(prisma, nuevo({ plan: 'trial', planExpiresAt: new Date(Date.now() + 5 * DIA) }), async (m) => {
        const cookie = await cookieDe(m.id);
        await emitir('customer.subscription.updated', subDe(m.id, Date.now() + 30 * DIA));

        const estado = await prisma.merchant.findUnique({
          where: { id: m.id },
          select: { plan: true, planExpiresAt: true, subscriptionStatus: true },
        });
        assert.equal(estado.plan, 'pro');
        assert.equal(estado.subscriptionStatus, 'active');

        const r = await intentarTrabajar(cookie);
        assert.ok(llegoAlHandler(r), `el que paga y sigue pagando debe trabajar: ${r.status} ${r.cuerpo}`);
      });
    });
  },
);

// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL HERMANO POSITIVO DE LA NEGACIÓN (SCRUM-237).
//
// Arriba, cada emisión afirma que el webhook NO trató el evento como duplicado. Esa negación sólo
// vale si el token `"duplicate":true` PUEDE aparecer de verdad: si no pudiera, sería el defecto de
// scrum73 —un `doesNotMatch` sobre algo imposible, verde durante meses sin comprobar nada—.
//
// Aquí se le hace aparecer: el MISMO `event.id` dos veces. La segunda tiene que salir descartada.
// De paso queda medido que el LRU de idempotencia (A10.2/A10.4) sigue vivo, que es la razón por la
// que los ids de este fichero se generan únicos.
test(
  'SCRUM-809 · ✅ el LRU de idempotencia SÍ marca duplicado cuando el id se repite (respalda la negación)',
  { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' },
  async () => {
    await conApp(async ({ prisma, emitirCon, idNuevo, subDe }) => {
      await withMerchant(prisma, nuevo({ plan: 'trial', planExpiresAt: new Date(Date.now() + 5 * DIA) }), async (m) => {
        const id = idNuevo();
        const sub = subDe(m.id, Date.now() + 30 * DIA);

        const primera = await emitirCon(id, 'customer.subscription.updated', sub);
        assert.doesNotMatch(primera, /"duplicate":true/,
          'la PRIMERA emisión de un id nuevo no puede salir marcada como duplicada');

        const segunda = await emitirCon(id, 'customer.subscription.updated', sub);
        assert.match(segunda, /"duplicate":true/,
          '🔴 el LRU de idempotencia no marcó el id repetido. Entonces la negación de `emitir()` no '
          + 'está comprobando nada: no hay forma de que ese token aparezca, y un guard que vigila '
          + 'algo imposible es un guard en verde permanente.');
      });
    });
  },
);

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LAS MUTACIONES QUE ME TUMBAN. Las dos primeras son LA REGRESIÓN EXACTA que este ticket cierra
// —una por puerta—, así que si alguna sobreviviera, este guard no estaría cubriendo la mitad que
// dice cubrir. La tercera ataca el paywall mismo: sin ella, el guard podría estar leyendo un 403
// que viene de otro sitio.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // 🔴 EL DEFECTO ORIGINAL, PUERTA A: se vuelve a borrar la fecha al cancelar.
    fichero: 'src/modules/billing/app/routes/stripe.routes.ts',
    de: "            data: { plan: 'trial', subscriptionStatus: 'canceled', stripeSubscriptionId: null },",
    a: "            data: { plan: 'trial', subscriptionStatus: 'canceled', stripeSubscriptionId: null, planExpiresAt: null },",
    cae: 'EL QUE DECIDE · A · customer.subscription.updated (status=canceled): paga → cancela → conserva el periodo Y el paywall le alcanza al vencer',
  },
  {
    // 🔴 EL DEFECTO ORIGINAL, PUERTA B. Es OTRO camino de Stripe, no una copia: arreglar sólo una
    // dejaba vivas todas las cancelaciones que llegan como `subscription.deleted`.
    fichero: 'src/modules/billing/app/routes/stripe.routes.ts',
    de: "          data: { plan: 'trial', subscriptionStatus: 'canceled', stripeSubscriptionId: null }, // A10.2 (L)",
    a: "          data: { plan: 'trial', subscriptionStatus: 'canceled', stripeSubscriptionId: null, planExpiresAt: null }, // A10.2 (L)",
    cae: 'EL QUE DECIDE · B · customer.subscription.deleted: paga → cancela → conserva el periodo Y el paywall le alcanza al vencer',
  },
  {
    // El paywall deja de mirar la fecha: nadie queda bloqueado nunca. Si esto sobreviviera, mis
    // asserts de «bloqueado» no estarían leyendo el paywall.
    fichero: 'src/core/http/authMiddleware.ts',
    de: "  if (plan === 'trial' && planExpiresAt && planExpiresAt < new Date()) {",
    a: "  if (false) {",
    cae: 'el que NUNCA pagó y agota su trial acaba donde acababa',
  },
];
