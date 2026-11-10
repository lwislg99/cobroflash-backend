// SCRUM-1402k · QUIEN YA TIENE UNA SUSCRIPCIÓN VIVA NO PUEDE ABRIR OTRA — medido por EFECTO, por el router
// de producción (`subscriptions.routes.ts`), con la base y `stripe` DOBLADOS: no se llama a Stripe.
//
// 🔵 LA DECISIÓN ES DEL FUNDADOR Y SE PUEDE CITAR: SCRUM-1402, c.20832 (P2: «Sí, antes del primero») —
//    antes del primer cliente en Equipo se le quita la oferta de Pro y del fundador, y el checkout rechaza
//    una segunda suscripción —, y c.20845 (Q1: «Solo nuestra base»: el predicado mira la base, que mantiene
//    el webhook; el checkout NO pregunta a Stripe). El diseño, en c.20838 (jv-j3bg).
//
// Lo que se mide:
//   · con una suscripción viva (pro / founding / equipo, `active` o `past_due`, con o sin
//     `stripeSubscriptionId`), `POST /checkout` contesta 409 `subscription_exists`, NO llama a Stripe y
//     NO escribe nada;
//   · 🔴 el positivo que manda: un `trial` que nunca se suscribió, y uno que canceló, llegan al checkout
//     EXACTAMENTE igual que antes (200 y una sesión creada);
//   · el fundador agotado sigue dando `founding_sold_out` a un `trial`; un merchant con suscripción no
//     bloquea a otro (regla 2); y `/plans` y `/checkout` deciden con la MISMA función (por AST).
//
// ⚠️ LÍMITE DECLARADO (c.20838, Q1 ❌ en c.20845): dos clics seguidos antes de que llegue el webhook nacen
// los dos con el merchant aún en `trial`, y los dos pasan. Esto no lo mide nadie: es lo decidido.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { dobleDeLaBase } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';
import { casosEscritos } from './_casos-escritos.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));
const ts = requiere('typescript');

// ── LA BASE DOBLADA: una fila por merchant, leída por id ────────────────────────────────────
const filas = new Map();
const visto = { escrituras: [], stripe: [] };
const limpiar = () => Object.assign(visto, { escrituras: [], stripe: [] });
let plazasOcupadas = 0;

const doble = dobleDeLaBase({
  'merchant.findUnique': (args) => {
    const f = filas.get(args?.where?.id);
    return f ? { email: 'duena@example.invalid', name: 'Duena', stripeCustomerId: 'cus_1402k', ...f } : null;
  },
  'merchant.count': () => plazasOcupadas,
  'merchant.update': (args) => { visto.escrituras.push(args); return {}; },
  'merchant.updateMany': (args) => { visto.escrituras.push(args); return { count: 0 }; },
});

// ── STRIPE DOBLADO: cuenta cada llamada; ninguna sale de la máquina ─────────────────────────
const stripeDoble = {
  prices: { list: async (a) => { visto.stripe.push(['prices.list', a]); return { data: [{ id: 'price_1402k' }] }; } },
  customers: { create: async (a) => { visto.stripe.push(['customers.create', a]); return { id: 'cus_nuevo' }; } },
  checkout: { sessions: { create: async (a) => { visto.stripe.push(['checkout.sessions.create', a]); return { url: 'https://checkout.example.invalid/s' }; } } },
  billingPortal: { sessions: { create: async () => ({ url: 'https://portal.example.invalid/' }) } },
};

function doblar(ruta, exportado) {
  const f = rutaDe(ruta);
  requiere.cache[f] = { id: f, filename: f, loaded: true, exports: exportado };
}
doblar('dist/core/db/prisma.js', { prisma: doble });
doblar('dist/integrations/stripe.js', { stripe: stripeDoble, stripeEnabled: true });

const mod = requiere(rutaDe('dist/modules/billing/app/routes/subscriptions.routes.js'));
const express = requiere('express');

let servidor;
let puerto;
test.before(async () => {
  const app = express();
  app.use(express.json());
  // el propietario: `/admin/billing` exige admin al montarse (SCRUM-1344)
  app.use((req, _res, next) => { Object.assign(req, reqDeSesion({ rol: 'admin', merchantId: Number(req.headers['x-merchant']) })); next(); });
  app.use('/admin/billing', mod.default); // el mismo prefijo que `src/app.ts`
  servidor = app.listen(0);
  await new Promise((r) => servidor.once('listening', r));
  puerto = servidor.address().port;
});
test.after(() => { servidor?.close(); });

function pedir(metodo, ruta, merchant, cuerpo) {
  const payload = cuerpo ? JSON.stringify(cuerpo) : '';
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port: puerto, path: '/admin/billing' + ruta, method: metodo, agent: false,
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), 'x-merchant': String(merchant) },
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (t) => { data += t; });
      res.on('end', () => resolve({ status: res.statusCode, cuerpo: data ? JSON.parse(data) : null }));
    });
    req.on('error', reject);
    req.end(payload);
  });
}

async function checkout(merchant, plan = 'pro') {
  limpiar();
  const original = console.error;
  console.error = () => {};
  try {
    const res = await pedir('POST', '/checkout', merchant, { plan });
    return { res, escrituras: [...visto.escrituras], stripe: visto.stripe.map(([n]) => n) };
  } finally {
    console.error = original;
  }
}

// ── LAS FILAS ────────────────────────────────────────────────────────────────────────────────
const M = 14020; // el que se mueve en cada caso
const OTRO = 14021; // regla 2
const VIVAS = [];
for (const plan of ['pro', 'founding', 'equipo']) {
  for (const subscriptionStatus of ['active', 'past_due']) {
    VIVAS.push({ plan, subscriptionStatus, stripeSubscriptionId: 'sub_1402k' });
    // el hueco entre `checkout.session.completed` (escribe el plan, sin id) y `subscription.created`
    VIVAS.push({ plan, subscriptionStatus, stripeSubscriptionId: null });
  }
}
const NUNCA = { plan: 'trial', subscriptionStatus: null, stripeSubscriptionId: null };
const CANCELO = { plan: 'trial', subscriptionStatus: 'canceled', stripeSubscriptionId: null };
const nombre = (f) => `${f.plan}/${f.subscriptionStatus}/${f.stripeSubscriptionId ? 'con id' : 'sin id'}`;

// ── 1 · EL RECHAZO ───────────────────────────────────────────────────────────────────────────
// Nombres ESCRITOS (SCRUM-1415): cada caso comprueba que su literal es el que sale de su fila.
const RECHAZOS = VIVAS.flatMap((fila) => ['pro', 'founding'].map((pedido) => ({ fila, pedido })));
const rechaza = casosEscritos(RECHAZOS,
  ({ fila, pedido }) => `suscripción viva ${nombre(fila)} · checkout de ${pedido} → 409 subscription_exists, sin Stripe y sin escribir`,
  async ({ fila, pedido }) => {
    filas.set(M, fila);
    plazasOcupadas = 0;
    const { res, escrituras, stripe } = await checkout(M, pedido);
    assert.equal(res.status, 409, JSON.stringify(res.cuerpo));
    assert.equal(res.cuerpo.error, 'subscription_exists');
    assert.equal(typeof res.cuerpo.message, 'string');
    assert.ok(res.cuerpo.message.trim().length > 0, 'el 409 lleva un texto para la persona');
    assert.deepEqual(stripe, [], 'ninguna llamada a Stripe');
    assert.deepEqual(escrituras, [], 'ninguna escritura');
  });
test('suscripción viva pro/active/con id · checkout de pro → 409 subscription_exists, sin Stripe y sin escribir', rechaza(0));
test('suscripción viva pro/active/con id · checkout de founding → 409 subscription_exists, sin Stripe y sin escribir', rechaza(1));
test('suscripción viva pro/active/sin id · checkout de pro → 409 subscription_exists, sin Stripe y sin escribir', rechaza(2));
test('suscripción viva pro/active/sin id · checkout de founding → 409 subscription_exists, sin Stripe y sin escribir', rechaza(3));
test('suscripción viva pro/past_due/con id · checkout de pro → 409 subscription_exists, sin Stripe y sin escribir', rechaza(4));
test('suscripción viva pro/past_due/con id · checkout de founding → 409 subscription_exists, sin Stripe y sin escribir', rechaza(5));
test('suscripción viva pro/past_due/sin id · checkout de pro → 409 subscription_exists, sin Stripe y sin escribir', rechaza(6));
test('suscripción viva pro/past_due/sin id · checkout de founding → 409 subscription_exists, sin Stripe y sin escribir', rechaza(7));
test('suscripción viva founding/active/con id · checkout de pro → 409 subscription_exists, sin Stripe y sin escribir', rechaza(8));
test('suscripción viva founding/active/con id · checkout de founding → 409 subscription_exists, sin Stripe y sin escribir', rechaza(9));
test('suscripción viva founding/active/sin id · checkout de pro → 409 subscription_exists, sin Stripe y sin escribir', rechaza(10));
test('suscripción viva founding/active/sin id · checkout de founding → 409 subscription_exists, sin Stripe y sin escribir', rechaza(11));
test('suscripción viva founding/past_due/con id · checkout de pro → 409 subscription_exists, sin Stripe y sin escribir', rechaza(12));
test('suscripción viva founding/past_due/con id · checkout de founding → 409 subscription_exists, sin Stripe y sin escribir', rechaza(13));
test('suscripción viva founding/past_due/sin id · checkout de pro → 409 subscription_exists, sin Stripe y sin escribir', rechaza(14));
test('suscripción viva founding/past_due/sin id · checkout de founding → 409 subscription_exists, sin Stripe y sin escribir', rechaza(15));
test('suscripción viva equipo/active/con id · checkout de pro → 409 subscription_exists, sin Stripe y sin escribir', rechaza(16));
test('suscripción viva equipo/active/con id · checkout de founding → 409 subscription_exists, sin Stripe y sin escribir', rechaza(17));
test('suscripción viva equipo/active/sin id · checkout de pro → 409 subscription_exists, sin Stripe y sin escribir', rechaza(18));
test('suscripción viva equipo/active/sin id · checkout de founding → 409 subscription_exists, sin Stripe y sin escribir', rechaza(19));
test('suscripción viva equipo/past_due/con id · checkout de pro → 409 subscription_exists, sin Stripe y sin escribir', rechaza(20));
test('suscripción viva equipo/past_due/con id · checkout de founding → 409 subscription_exists, sin Stripe y sin escribir', rechaza(21));
test('suscripción viva equipo/past_due/sin id · checkout de pro → 409 subscription_exists, sin Stripe y sin escribir', rechaza(22));
test('suscripción viva equipo/past_due/sin id · checkout de founding → 409 subscription_exists, sin Stripe y sin escribir', rechaza(23));
rechaza.todos();

// ── 2 · 🔴 EL POSITIVO QUE MANDA: quien no tiene suscripción llega al checkout igual que antes ────
const SIN_SUSCRIPCION = [['trial que nunca se suscribió', NUNCA], ['trial que canceló', CANCELO]];
const llega = casosEscritos(SIN_SUSCRIPCION,
  ([etiqueta]) => `${etiqueta} · checkout de pro → 200 y una sesión de Stripe, como hoy`,
  async ([, fila]) => {
    filas.set(M, fila);
    const { res, stripe } = await checkout(M, 'pro');
    assert.equal(res.status, 200, JSON.stringify(res.cuerpo));
    assert.equal(res.cuerpo.ok, true);
    assert.equal(stripe.filter((n) => n === 'checkout.sessions.create').length, 1);
  });
test('trial que nunca se suscribió · checkout de pro → 200 y una sesión de Stripe, como hoy', llega(0));
test('trial que canceló · checkout de pro → 200 y una sesión de Stripe, como hoy', llega(1));
llega.todos();

test('el fundador agotado sigue diciendo founding_sold_out a un trial', async () => {
  filas.set(M, NUNCA);
  plazasOcupadas = 20;
  try {
    const { res, stripe } = await checkout(M, 'founding');
    assert.equal(res.status, 409);
    assert.equal(res.cuerpo.error, 'founding_sold_out');
    assert.deepEqual(stripe, []);
  } finally {
    plazasOcupadas = 0;
  }
});

test('regla 2: la suscripción de un merchant no bloquea el checkout de otro', async () => {
  filas.set(OTRO, { plan: 'equipo', subscriptionStatus: 'active', stripeSubscriptionId: 'sub_otro' });
  filas.set(M, NUNCA);
  const { res } = await checkout(M, 'pro');
  assert.equal(res.status, 200);
  const delOtro = await checkout(OTRO, 'pro');
  assert.equal(delOtro.res.status, 409);
});

// ── 3 · EL PREDICADO, fila a fila ─────────────────────────────────────────────────────────────
test('tieneSuscripcionViva: viva = con id, o plan de pago en active/past_due', () => {
  const f = mod.tieneSuscripcionViva;
  assert.equal(typeof f, 'function', 'subscriptions.routes exporta tieneSuscripcionViva');
  for (const fila of VIVAS) assert.equal(f(fila), true, nombre(fila));
  assert.equal(f(NUNCA), false);
  assert.equal(f(CANCELO), false);
  assert.equal(f({ plan: 'trial', subscriptionStatus: 'active', stripeSubscriptionId: null }), false, 'un trial no es de pago');
  assert.equal(f({ plan: 'pro', subscriptionStatus: 'canceled', stripeSubscriptionId: null }), false);
  assert.equal(f({ plan: 'trial', subscriptionStatus: null, stripeSubscriptionId: 'sub_x' }), true, 'con id manda el id');
  assert.equal(f(null), false);
});

// ── 4 · /plans dice lo mismo que /checkout ────────────────────────────────────────────────────
test('GET /plans trae suscripcionViva con el mismo predicado', async () => {
  for (const fila of [...VIVAS, NUNCA, CANCELO]) {
    filas.set(M, fila);
    const { status, cuerpo } = await pedir('GET', '/plans', M);
    assert.equal(status, 200);
    assert.equal(cuerpo.suscripcionViva, mod.tieneSuscripcionViva(fila), nombre(fila));
  }
});

test('por AST: el handler de /plans y el de /checkout llaman los dos a tieneSuscripcionViva', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, 'src/modules/billing/app/routes/subscriptions.routes.ts'), 'utf8');
  const sf = ts.createSourceFile('s.ts', fuente, ts.ScriptTarget.Latest, true);
  const llamaA = new Map();
  const visita = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && n.expression.expression.getText(sf) === 'router' && ts.isStringLiteral(n.arguments[0] ?? {})) {
      const ruta = n.arguments[0].text;
      let usa = false;
      const busca = (k) => {
        if (ts.isCallExpression(k) && ts.isIdentifier(k.expression) && k.expression.text === 'tieneSuscripcionViva') usa = true;
        ts.forEachChild(k, busca);
      };
      busca(n);
      llamaA.set(ruta, usa);
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  // control positivo del instrumento: ve las cuatro rutas que hay
  assert.deepEqual([...llamaA.keys()].sort(), ['/accept-alcance', '/checkout', '/plans', '/portal']);
  assert.equal(llamaA.get('/plans'), true);
  assert.equal(llamaA.get('/checkout'), true);
  assert.equal(llamaA.get('/portal'), false, 'control a cero: el portal no decide nada');
});

// ── 5 · LA PANTALLA (plansView.js, en una caja de arena: sólo se pinta, no se pulsa) ───────────
function cargarVista() {
  const ctx = { window: {}, fmtMoneyEs: (n) => `${n} €`, console };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/plansView.js'), 'utf8'), ctx);
  return ctx.buildPlansHtml;
}
const PLANES = [{ id: 'pro', label: 'Pro', price: 19.9, priceAnnual: 199, currency: 'EUR' }];
const FUNDADOR = { price: 9.9, seatsTotal: 20, seatsLeft: 5 };
const pintar = (currentPlan, suscripcionViva) =>
  cargarVista()({ currentPlan, planExpiresAt: null, plans: PLANES, founding: FUNDADOR, suscripcionViva }, false);

test('quien tiene Equipo ve «Plan activo: Equipo», sin el fundador y sin «Suscribirme»', () => {
  const html = pintar('equipo', true);
  assert.match(html, /Plan activo: <strong[^>]*>Equipo<\/strong>/);
  assert.doesNotMatch(html, /data-plan="founding"/, 'sin banner del fundador');
  assert.doesNotMatch(html, /Suscribirme/, 'sin botón de Pro');
  assert.equal((html.match(/id="portal-btn"/g) || []).length, 1, 'un solo botón de gestionar');
});

test('quien tiene Equipo no ve la tarjeta «Plan Pro» (c.20866); Pro, fundador y trial sí', () => {
  assert.doesNotMatch(pintar('equipo', true), /Plan Pro/);
  assert.match(pintar('equipo', false), /Plan Pro/, 'sin suscripción viva, la tarjeta sigue');
  assert.match(pintar('pro', true), /Plan Pro/);
  assert.match(pintar('founding', true), /Plan Pro/);
  assert.match(pintar('trial', false), /Plan Pro/);
});

test('el 409 lleva el T3 firmado (SCRUM-1402, c.20866), y la pantalla le antepone su frase', async () => {
  filas.set(M, VIVAS[0]);
  const { res } = await checkout(M, 'pro');
  assert.equal(res.cuerpo.message, 'Ya tienes una suscripción. Para cambiarla, usa «Gestionar suscripción / facturación».');
  assert.match(fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/plansView.js'), 'utf8'), /'No se pudo iniciar el pago: ' \+ err\.message/);
});

test('controles de la pantalla: Pro y fundador siguen como hoy, y el trial sigue viendo la oferta', () => {
  assert.match(pintar('pro', true), /Plan activo: <strong[^>]*>Pro<\/strong>/);
  assert.match(pintar('founding', true), /Plan activo: <strong[^>]*>Founding/);
  const trial = pintar('trial', false);
  assert.match(trial, /data-plan="founding"/, 'el trial ve el fundador');
  assert.match(trial, /Suscribirme/, 'el trial ve Suscribirme');
  assert.doesNotMatch(trial, /id="portal-btn"/);
  // sin el campo (un servidor viejo), la pantalla de Pro se pinta como hoy
  const proViejo = pintar('pro', undefined);
  assert.doesNotMatch(proViejo, /Suscribirme/);
  assert.equal((proViejo.match(/id="portal-btn"/g) || []).length, 1);
});

// ── LAS MUTACIONES QUE ME TUMBAN (SCRUM-745): cada una imita un defecto que este fichero promete cazar ──
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El checkout deja de preguntar: la segunda suscripción vuelve a abrirse (el defecto de hoy).
    fichero: 'src/modules/billing/app/routes/subscriptions.routes.ts',
    de: '  if (tieneSuscripcionViva(actual)) {',
    a: '  if (false && tieneSuscripcionViva(actual)) {',
    cae: 'checkout de pro → 409 subscription_exists',
  },
  {
    // Sin la mitad del impago: quien está en past_due sin id podría abrir otra.
    fichero: 'src/modules/billing/app/routes/subscriptions.routes.ts',
    de: "(m.subscriptionStatus === 'active' || m.subscriptionStatus === 'past_due')",
    a: "m.subscriptionStatus === 'active'",
    cae: 'past_due/sin id · checkout de pro',
  },
  {
    // Sin la mitad del id: una suscripción apuntada deja de contar por sí sola.
    fichero: 'src/modules/billing/app/routes/subscriptions.routes.ts',
    de: '  if (m.stripeSubscriptionId != null) return true;\n',
    a: '',
    cae: 'tieneSuscripcionViva: viva',
  },
  {
    // /plans con su propia regla: la pantalla y el checkout dejan de decir lo mismo.
    fichero: 'src/modules/billing/app/routes/subscriptions.routes.ts',
    de: '    suscripcionViva: tieneSuscripcionViva(merchant),',
    a: '    suscripcionViva: merchant?.stripeSubscriptionId != null,',
    cae: 'GET /plans trae suscripcionViva',
  },
  {
    // La pantalla vuelve a ofrecer el fundador a quien ya paga.
    fichero: 'public/dashboard/js/plansView.js',
    de: " && !suscripcionViva;",
    a: ";",
    cae: 'quien tiene Equipo ve',
  },
  {
    // T1 fuera: Equipo se pinta como «Pro».
    fichero: 'public/dashboard/js/plansView.js',
    de: " : currentPlan === 'equipo' ? 'Equipo'",
    a: '',
    cae: 'quien tiene Equipo ve',
  },
  {
    // La tarjeta de Pro vuelve a enseñarse a quien paga Equipo.
    fichero: 'public/dashboard/js/plansView.js',
    de: "  const ocultaPro = currentPlan === 'equipo' && suscripcionViva === true;",
    a: '  const ocultaPro = false;',
    cae: 'no ve la tarjeta «Plan Pro»',
  },
];
