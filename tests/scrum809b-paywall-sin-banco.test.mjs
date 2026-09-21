// tests/scrum809b-paywall-sin-banco.test.mjs — SCRUM-809 · LA MITAD DEL PAYWALL QUE NO NECESITA BANCO
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// POR QUÉ EXISTE ESTE FICHERO (21-sep-2026)
//
// `scrum809-paywall-tras-cancelar.test.mjs` mide lo que importa —el ACCESO: se paga, se cancela y se
// le manda al profesional una petición real— y por eso necesita un Postgres. Declaraba además tres
// mutaciones para el meta-guard, y ahí salía MUDO: el job del meta-guard corre SIN BASE por diseño, sus
// siete tests se saltaban y una mutación que reintroduce el defecto no puede poner rojo a un test que no
// corre (SCRUM-754c: un test saltado es CEGUERA, no mudez).
//
// Las declaraciones se mudan aquí, con tests que SÍ corren sin base y que caen por la misma mutación:
//   · A y B (las dos puertas de cancelación del webhook de Stripe) → el CENSO por AST de sus escrituras;
//   · C (el paywall deja de mirar la fecha)                        → `requireActivePlan` recorrido con la
//     sesión doblada.
// Lo que el guard de acceso EXIGE no cambia ni una línea: aquel sigue midiendo a la persona, y corre en
// el job de la tanda del CI (que sí lleva banco desechable) y donde haya `LIBRO_PG_URL`.
//
// ⚠️ ESTOS TRES TESTS NO SUSTITUYEN AL DE ACCESO. Comprobar que la columna no se borra —y no la
// condición del paywall contra una base de verdad— habría pasado igual de verde con el defecto original
// arreglado a medias. Son la red que sigue en pie cuando no hay banco; no la respuesta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { inyectarBase, moduloDeDist } from './_envio-doblado.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STRIPE = 'src/modules/billing/app/routes/stripe.routes.ts';
const DIA = 24 * 3600 * 1000;

/**
 * Los objetos `data` que ponen `subscriptionStatus: 'canceled'`, con los nombres de sus claves. Por AST y
 * no por texto: la prosa que explica por qué se quitó `planExpiresAt` lo CONTIENE (A23 #2).
 */
function escriturasDeCancelacion(estadoBuscado = 'canceled') {
  const ruta = path.join(RAIZ, STRIPE);
  const sf = ts.createSourceFile(ruta, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true);
  const salida = [];
  (function anda(n) {
    if (ts.isObjectLiteralExpression(n)) {
      const claves = new Map(n.properties.filter(ts.isPropertyAssignment).map((p) => [p.name.getText(), p.initializer]));
      const estado = claves.get('subscriptionStatus');
      if (estado && ts.isStringLiteralLike(estado) && estado.text === estadoBuscado) salida.push([...claves.keys()]);
    }
    n.forEachChild(anda);
  })(sf);
  return salida;
}

test('SCRUM-809b · SUELO: el censo ve las DOS puertas de cancelación del webhook (y sabe leerlas)', () => {
  const escrituras = escriturasDeCancelacion();
  assert.equal(escrituras.length, 2,
    `el censo ve ${escrituras.length} escrituras de \`subscriptionStatus: 'canceled'\` y son exactamente dos `
    + '(customer.subscription.updated|created con status canceled, y customer.subscription.deleted): o no ha mirado, '
    + 'o hay una tercera puerta y hay que decidir aquí qué hace con la fecha');
  for (const claves of escrituras) {
    assert.ok(claves.includes('plan') && claves.includes('stripeSubscriptionId'),
      `control positivo: el extractor tiene que ver las claves de una cancelación (vio ${claves.join(', ')})`);
  }
});

test('SCRUM-809b · 🔴 ninguna puerta de cancelación borra `planExpiresAt`: el que cancela conserva el fin del periodo que pagó', () => {
  // CONTROL POSITIVO (el respaldo de la negación de abajo): el mismo extractor SÍ ve `planExpiresAt` en
  // la escritura del pago, que es la que lo fija. Sin esto, «ninguna cancelación lo escribe» sería
  // verdad también con un extractor incapaz de ver esa clave.
  const clavesAlPagar = escriturasDeCancelacion('active').flat();
  assert.ok(clavesAlPagar.includes('planExpiresAt'),
    'el extractor no ve `planExpiresAt` en la escritura del pago: está ciego para esa clave');
  for (const claves of escriturasDeCancelacion()) {
    assert.ok(!claves.includes('planExpiresAt'),
      '🔴 una cancelación escribe `planExpiresAt` (a null, que es lo que hacía): `plan === \'trial\' && planExpiresAt && …` '
      + 'se vuelve INSATISFACIBLE y quien pagó y canceló no puede ser alcanzado por el paywall NUNCA');
  }
});

test('SCRUM-809b · 🔴 el paywall: el trial agotado recibe 403 trial_expired, y quien tiene periodo por delante o paga, no', async () => {
  const sesion = (plan, planExpiresAt) => ({
    type: 'session',
    expiresAt: new Date(Date.now() + DIA),
    merchant: { id: 809, name: 'Sonda 809', email: 'sonda-809@test.local', plan, planExpiresAt, onboardingCompleted: true, isPlatformOwner: false },
    teamMember: null,
  });
  const pasa = async (plan, planExpiresAt) => {
    inyectarBase({ 'authSession.findUnique': () => sesion(plan, planExpiresAt) }, [
      '../dist/core/http/authMiddleware.js',
      '../dist/modules/auth/domain/auth.service.js',
    ]);
    const { requireActivePlan } = moduloDeDist('../dist/core/http/authMiddleware.js');
    const r = { status: null, cuerpo: null, siguio: false };
    const res = { status(s) { r.status = s; return res; }, json(j) { r.cuerpo = j; return res; } };
    await requireActivePlan({ headers: { cookie: 'pf_session=sonda809' } }, res, () => { r.siguio = true; });
    return r;
  };

  const agotado = await pasa('trial', new Date(Date.now() - DIA));
  assert.equal(agotado.status, 403, '🔴 el trial agotado atraviesa el paywall: nadie queda bloqueado nunca');
  assert.equal(agotado.cuerpo?.error, 'trial_expired');
  assert.equal(agotado.siguio, false);

  const conPeriodo = await pasa('trial', new Date(Date.now() + 5 * DIA));
  assert.equal(conPeriodo.siguio, true, 'control: quien tiene el periodo por delante pasa');
  const pagando = await pasa('pro', new Date(Date.now() - DIA));
  assert.equal(pagando.siguio, true, 'control: el plan de pago no se bloquea por su fecha');
});

// Las tres mutaciones que ANTES declaraba el test de acceso. Van con su `cae` nuevo: un test que corre sin base.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // 🔴 EL DEFECTO ORIGINAL, PUERTA A: se vuelve a borrar la fecha al cancelar.
    fichero: 'src/modules/billing/app/routes/stripe.routes.ts',
    de: "            data: { plan: 'trial', subscriptionStatus: 'canceled', stripeSubscriptionId: null },",
    a: "            data: { plan: 'trial', subscriptionStatus: 'canceled', stripeSubscriptionId: null, planExpiresAt: null },",
    cae: 'ninguna puerta de cancelación borra `planExpiresAt`',
  },
  {
    // 🔴 EL DEFECTO ORIGINAL, PUERTA B. Es OTRO camino de Stripe, no una copia: arreglar sólo una
    // dejaba vivas todas las cancelaciones que llegan como `subscription.deleted`.
    fichero: 'src/modules/billing/app/routes/stripe.routes.ts',
    de: "          data: { plan: 'trial', subscriptionStatus: 'canceled', stripeSubscriptionId: null }, // A10.2 (L)",
    a: "          data: { plan: 'trial', subscriptionStatus: 'canceled', stripeSubscriptionId: null, planExpiresAt: null }, // A10.2 (L)",
    cae: 'ninguna puerta de cancelación borra `planExpiresAt`',
  },
  {
    // El paywall deja de mirar la fecha: nadie queda bloqueado nunca. Si esto sobreviviera, mis
    // asserts de «bloqueado» no estarían leyendo el paywall.
    fichero: 'src/core/http/authMiddleware.ts',
    de: "  if (plan === 'trial' && planExpiresAt && planExpiresAt < new Date()) {",
    a: "  if (false) {",
    cae: 'el paywall: el trial agotado recibe 403 trial_expired',
  },
];
