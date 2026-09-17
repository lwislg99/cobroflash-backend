// tests/scrum530-la-alerta-que-no-puede-pronunciarse.test.mjs — SCRUM-530
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA VÍCTIMA ES UN FONTANERO DEL PIONEER, Y NO SE ENTERA DE NADA
//
// `whatsappLog.service.ts:266` —  `active: rate7d !== null && week.enviados >= 10 && rate7d < 90`
// La alerta de tasa de entrega exige **≥10 envíos en 7 días**. Con 3 envíos y 2 fallos —un 33 %
// de entrega, que es un desastre— la alerta NO se activa, y `reportsView.js` sólo pinta algo
// cuando `alert.active`. Resultado: **silencio**.
//
// ── EL MÍNIMO DE POBLACIÓN NO ES EL DEFECTO ─────────────────────────────────────────────────
// Exigir muestra es CORRECTO: con 2 envíos y 1 fallo, el 50 % no significa nada. El defecto es
// que al no poder pronunciarse **la pantalla calla**, y entonces:
//
//   🔒 Una alerta que nunca se activa y una alerta que no tiene datos SE LEEN IGUAL
//      y significan lo contrario.
//
// Es la misma familia que «un CERO no es "está limpio", es "no he mirado"» (A3), aplicada a lo
// que ve un cliente de pago.
//
// ⛔ MICROCOPY: el texto del caso nuevo es del fundador (regla 30). Aquí se exige que la pantalla
// DIGA algo y que lleve su marca `[PENDIENTE microcopy oficial]`; **no** se exige un literal.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { cargarDashboard, pintarVista } from './_banco-vistas.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const MARCA = '[PENDIENTE microcopy oficial]';

/**
 * El mínimo que el SERVICIO manda en el DTO. No se elige aquí: lo comprueba contra el servicio de
 * verdad el último test de este fichero, para que este fixture no pueda derivar de la realidad.
 */
const MINIMO = 10;

/** El DTO que hoy devuelve `/admin/metrics/whatsapp`, con la muestra y la tasa que se quieran. */
const metricas = ({ enviados, entregados }) => {
  const rate = enviados > 0 ? Math.round((entregados / enviados) * 100) : null;
  return {
    month: { sent: enviados, delivered: entregados, read: 0, failed: enviados - entregados, total: enviados, costEur: 0.3 },
    byTemplate: [{ templateName: 'quote_decision_es', enviados, entregados, deliveryRate: rate }],
    alert: {
      active: rate !== null && enviados >= MINIMO && rate < 90,
      deliveryRate7d: rate,
      sample: enviados,
      minimo: MINIMO,
    },
    channel: { templateToday: 0, windowToday: 0, windowMonth: 0, savedEurMonth: 0 },
  };
};

/**
 * Monta la tarjeta de WhatsApp del panel con esas métricas y devuelve lo que se pinta.
 *
 * ⚠️ El contenedor lo crea `pintarVista` y se lo pasa a la vista como PRIMER argumento: no se le
 * manda uno propio. Pasárselo aparte fue mi primer error — la vista pintaba en el contenedor del
 * banco y yo leía un `div` vacío, así que el rojo salía por el motivo equivocado. Lo cazó el
 * suelo de este mismo fichero, que es para lo que está.
 */
async function pintarTarjeta(datos) {
  const banco = cargarDashboard(RAIZ, {
    datos: (ruta) => (/\/admin\/metrics\/whatsapp/.test(String(ruta)) ? datos : []),
  });
  const r = await pintarVista(banco, 'loadWhatsAppMetrics');
  assert.equal(r.error ?? null, null, `🔴 CIEGO: la vista no montó: ${r.error?.message}`);
  assert.deepEqual(r.rechazos ?? [], [], `🔴 CIEGO: la vista dejó rechazos huérfanos: ${r.rechazos}`);
  return { card: r.contenedor, html: String(r.contenedor?.innerHTML || '') };
}

// ═══ SUELO ═══════════════════════════════════════════════════════════════════════════════════

test('SCRUM-530 · 🔴 SUELO: la tarjeta PINTA de verdad, o el banco se declara CIEGO', async () => {
  const { html } = await pintarTarjeta(metricas({ enviados: 20, entregados: 19 }));
  assert.notEqual(html.length, 0,
    '🔴 CIEGO: la tarjeta no ha pintado NADA, así que «no dice nada» no distingue el defecto de '
    + 'un banco que no monta la vista. Vacío y no-medido se leen igual.');
  assert.ok(/WhatsApp/.test(html), `🔴 CIEGO: lo pintado no parece la tarjeta de WhatsApp: ${html.slice(0, 120)}`);
});

// ═══ 🔴 EL QUE DECIDE ════════════════════════════════════════════════════════════════════════

test('SCRUM-530 · 🔴 EL QUE DECIDE: 3 envíos y 2 fallos — la pantalla NO puede callarse', async () => {
  const d = metricas({ enviados: 3, entregados: 1 });
  // la premisa del ticket, comprobada y no supuesta
  assert.equal(d.alert.active, false, 'precondición: con 3 envíos la alerta de hoy NO se activa');
  assert.equal(d.alert.deliveryRate7d, 33, 'precondición: la tasa es 33 %, un desastre');

  const { html } = await pintarTarjeta(d);
  assert.ok(html.includes(MARCA),
    '🔴 EL FONTANERO NO SE ENTERA DE NADA. Con 3 envíos y 2 fallos (33 % de entrega) la tarjeta '
    + 'no dice ni que hay un problema ni que no puede pronunciarse: pinta lo mismo que si todo '
    + `fuera bien. La pantalla tiene que DECIR que la muestra es corta, con su ${MARCA}.\n`
    + `  pintado: ${html.replace(/\s+/g, ' ').slice(0, 300)}`);
});

test('SCRUM-530 · la muestra corta se dice CON SU NÚMERO, no en abstracto', async () => {
  const { html } = await pintarTarjeta(metricas({ enviados: 3, entregados: 1 }));
  // los dos números van PEGADOS a la marca, no sueltos por la tarjeta: los KPI ya imprimen un 3
  // por su cuenta, así que buscarlo suelto aprobaría el silencio.
  assert.match(html.replace(/<[^>]+>/g, ''), /\[PENDIENTE microcopy oficial\][^\n]*\b3\s*\/\s*10\b/,
    'si la pantalla va a decir que no puede pronunciarse, tiene que decir SOBRE CUÁNTOS: la '
    + 'muestra que hay y la que haría falta, juntas y junto a la marca. Un aviso sin población '
    + `es la misma frase que el silencio.\n  pintado: ${html.replace(/\s+/g, ' ').slice(0, 300)}`);
});

// ═══ ✅ POSITIVO — si esto empieza a alertar a todo el mundo, lo apagarán ═════════════════════

test('SCRUM-530 · ✅ POSITIVO: 20 envíos y buena tasa NO recibe ninguna alerta', async () => {
  const { html } = await pintarTarjeta(metricas({ enviados: 20, entregados: 19 }));
  assert.ok(!/por debajo del 90/.test(html),
    '🔴 se está alertando a un merchant con 95 % de entrega: eso es lo que hace que la gente '
    + 'apague los avisos.');
  assert.ok(!html.includes(MARCA),
    '🔴 con muestra de sobra la pantalla no tiene por qué decir que no puede pronunciarse.');
});

// ═══ ✅ NEGATIVO — lo que hoy alerta, sigue alertando ═════════════════════════════════════════

test('SCRUM-530 · ✅ NEGATIVO: 20 envíos con tasa mala SIGUE alertando igual que hoy', async () => {
  const d = metricas({ enviados: 20, entregados: 10 });
  assert.equal(d.alert.active, true, 'precondición: con 20 envíos y 50 % la alerta de hoy SÍ salta');

  const { html } = await pintarTarjeta(d);
  assert.ok(/por debajo del 90/.test(html),
    '🔴 se ha perdido la alerta que YA funcionaba. El caso que hoy avisa tiene que seguir avisando.');
  assert.ok(/50%/.test(html), 'y con su tasa dentro, como hoy');
});

// ═══ El umbral no se duplica: la pantalla lo recibe, no lo inventa ════════════════════════════

test('SCRUM-530 · el mínimo de muestra viaja en el DTO — la vista no lo hardcodea', async () => {
  const fuente = (await import('node:fs')).readFileSync(
    path.join(RAIZ, 'public/dashboard/js/reportsView.js'), 'utf8');
  const trozo = fuente.slice(fuente.indexOf('loadWhatsAppMetrics'), fuente.indexOf('byTemplate &&'));
  assert.ok(!/\bsample\s*<\s*10\b/.test(trozo) && !/\b>=\s*10\b/.test(trozo),
    '🔴 el 10 escrito a mano en la vista es la MISMA regla en dos sitios, y así es como una de '
    + 'las dos se queda atrás. El mínimo lo decide el servicio y viaja en el DTO.');
});

// ═══ EL CONTRATO: el fixture de arriba tiene que ser lo que el SERVICIO manda de verdad ═══════
//
// Sin esto, el banco podría estar pintando sobre un DTO que ya no existe — y los cuatro casos de
// arriba seguirían en verde midiendo una forma inventada. Aquí se llama al servicio REAL con la
// base doblada y filas fabricadas: ni una base, ni una clave, ni un byte de red.
//
// 🔴 Y AQUÍ SE DESTAPÓ ALGO MÁS GRANDE QUE EL UMBRAL, medido y reportado en `docs/BUGS.md` como
// `P1-WA-TASA`: un mensaje `failed` no está en `SENT_OR_MORE` ni en `DELIVERED_OR_MORE`, así que
// **no entra en el denominador**. Medido sobre el servicio real: con 1 entregado y 9 fallidos
// devuelve `sample = 1` y `deliveryRate7d = 100`. No se arregla aquí —cambiar el denominador
// cambia a quién se avisa, y eso es decisión de producto (regla 9)— y **no se fija en un assert**,
// porque un límite declarado y pinchado deja de ser advertencia y pasa a ser permiso (SCRUM-827).

test('SCRUM-530 · 🔴 CONTRATO: el servicio real manda `minimo` y NO se activa con 3 envíos', async () => {
  const { createRequire } = await import('node:module');
  const requiere = createRequire(import.meta.url);
  const fPrisma = requiere.resolve(path.join(RAIZ, 'dist/core/db/prisma.js'));
  const fSrv = requiere.resolve(path.join(RAIZ, 'dist/modules/messaging/domain/whatsappLog.service.js'));

  // 3 envíos en los últimos 7 días, 2 de ellos fallidos: el fontanero del Pioneer
  const ahora = new Date('2026-09-15T12:00:00Z');
  const ayer = new Date(ahora.getTime() - 24 * 3600 * 1000);
  const filas = [
    { status: 'delivered', templateName: 'quote_decision_es', createdAt: ayer, costEstimate: 0.023 },
    { status: 'failed', templateName: 'quote_decision_es', createdAt: ayer, costEstimate: 0.023 },
    { status: 'failed', templateName: 'quote_decision_es', createdAt: ayer, costEstimate: 0.023 },
  ];
  requiere.cache[fPrisma] = {
    id: fPrisma, filename: fPrisma, loaded: true,
    exports: { prisma: { whatsAppMessage: { findMany: async () => filas } } },
  };
  delete requiere.cache[fSrv];
  const { getWhatsAppMetrics } = requiere(fSrv);

  const m = await getWhatsAppMetrics(4242, ahora);

  // SUELO: si el servicio no ha visto NI UN mensaje, esto no mide el defecto — mide un doble roto.
  assert.notEqual(m.month.total, 0,
    '🔴 CIEGO: el servicio no ha visto ningún mensaje que examinar, así que «no se activa» no '
    + 'distingue el defecto de un banco que no le da datos.');
  assert.equal(m.month.failed, 2, 'el mes SÍ ve los dos fallos: el doble está dando datos');

  assert.equal(m.alert.active, false, 'con el caso del fontanero la alerta NO se activa: el ticket');
  assert.ok(m.alert.sample < m.alert.minimo,
    `y no se activa por MUESTRA: ${m.alert.sample} < ${m.alert.minimo}`);
  assert.equal(m.alert.minimo, MINIMO,
    `el DTO tiene que llevar el mínimo para que la vista no lo invente; y el fixture de este `
    + `fichero usa ${MINIMO}: si el servicio cambia el umbral, este test cae y el fixture se entera.`);
});
