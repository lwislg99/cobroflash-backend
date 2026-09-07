// tests/scrum814-carrera-de-tramos-postgres.test.mjs — SCRUM-814
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// DOS PETICIONES SIMULTÁNEAS EMITÍAN EL MISMO TRAMO, Y EL RESTO SE QUEDABA SIN FACTURAR.
//
// El tramo se elegía con `plan[existingInvoices.length]` a partir de una lectura hecha ANTES de
// abrir la transacción. Envolver la creación en una transacción no protege una decisión tomada
// antes de abrirla. Medido corriendo, plan 30/70: dos facturas selladas del tramo «Anticipo»
// (363 € cada una), la tercera petición contestaba 409 «ya se han emitido todas», y el
// presupuesto se quedaba con **726 € facturados de 1210 — 484 € que ya no se podían facturar**,
// en documentos que la regla 29 no deja borrar.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ ESTE TEST NECESITA POSTGRES DE VERDAD, y no vale un doble
//
// Lo que se prueba es una CARRERA entre dos transacciones y la visibilidad de una fila bajo
// `pg_advisory_xact_lock` en READ COMMITTED. Un doble responde lo que se le diga; la semántica
// de aislamiento sólo la tiene el motor. Medir esto con un doble no es medirlo.
//
// Y por eso hay DOS ficheros: éste, con banco, y `scrum814-recuento-dentro.test.mjs`, por AST y
// **sin gate**, que vigila que el recuento siga DENTRO de la transacción. Un ticket cuyo único
// guard está detrás de un gate es un ticket cuyo guard el CI no ejecuta nunca (SCRUM-296).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// CÓMO SE CORRE (banco local desechable, NUNCA una base del proyecto)
//
//   TRAMOS_PG_URL=<la URL del banco desechable>  node --test tests/scrum814-carrera-de-tramos-postgres.test.mjs
//
// La URL se pasa por entorno y NO se escribe aquí — ni real ni de ejemplo. Tiene que apuntar a
// loopback y a una base terminada en `_test`; lo comprueba `exigirBancoDesechable` más abajo, y
// si no lo cumple este test NO se salta: falla.
//
// El banco se levanta como en `docs/master/SCRUM-296.md`: binarios portables, esquema derivado
// con `./node_modules/.bin/prisma migrate diff --from-empty` (nunca `npx`, SCRUM-385).
//
// ⚠️ EL GATE NO ES «SI HAY URL, ADELANTE». Este test EMITE FACTURAS: si la URL no es un banco
// desechable, no se salta — FALLA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LA CARRERA SE PROVOCA, NO SE ESPERA — y este fichero REUTILIZA el banco del ticket
//
// Las dos peticiones salen en DOS PROCESOS, con una hora de salida común, disparadas por
// `docs/master/evidencias/scrum814/una-peticion.mjs` — el mismo que produjo la evidencia del
// defecto. Está atado a propósito: si alguien vuelve a sacar el recuento fuera de la
// transacción, este fichero se pone rojo con el banco que demostró el defecto, no con una
// reconstrucción.
//
// `Promise.all` dentro de un solo node NO sirve: comparten bucle de eventos y pool de
// conexiones. Mi primera medición lo hizo así, dijo «no se reproduce» y era FALSA — un falso
// negativo en el camino del dinero, que es el peor resultado posible porque cierra la pregunta.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UNA_PETICION = path.join(RAIZ, 'docs', 'master', 'evidencias', 'scrum814', 'una-peticion.mjs');

const URL_BANCO = process.env.TRAMOS_PG_URL || '';
const ENABLED = URL_BANCO !== '';

/** Bases que este test NO puede tocar jamás, aunque alguien apunte la variable ahí. */
const PROHIBIDAS = ['railway', 'yaqu_dev', 'yaqu_dev_javier', 'postgres', 'staging', 'prod'];

/** Fail-closed. Nunca imprime la URL: su mensaje llevaría la contraseña dentro (SCRUM-226). */
function exigirBancoDesechable(url) {
  const p = parseBDSegura(url);
  assert.ok(p, '🔴 TRAMOS_PG_URL no es una URL legible. No se toca nada.');
  assert.ok(['127.0.0.1', 'localhost', '::1'].includes(p.host),
    `🔴 TRAMOS_PG_URL apunta a «${p.host}», que no es loopback. Este test EMITE FACTURAS.`);
  assert.ok(p.base.endsWith('_test'),
    `🔴 la base «${p.base}» no termina en «_test». Es la única forma de garantizar por la FORMA `
    + 'del nombre —no por la buena intención de quien lanza el test— que no es una base del proyecto.');
  assert.ok(!PROHIBIDAS.includes(p.base), `🔴 la base «${p.base}» está en la lista de prohibidas.`);
  return p.base;
}

// El plan es DESIGUAL a propósito. Con 50/50 las dos facturas de la carrera valen lo mismo, la
// suma cuadra con el total y el defecto parece una etiqueta mal puesta. Con 30/70 se ve el dinero.
const PLAN = [{ label: 'Anticipo', percentage: 0.3 }, { label: 'Final', percentage: 0.7 }];
const LINEAS = [{ concept: 'Cuadro general', qty: 1, price: 1000, tax: 0.21 }];
const TOTAL = '1210.00';
const DEL_ANTICIPO = 363;
const DEL_FINAL = 847;
const SALTO = String.fromCharCode(10);

let prisma;
let handler;

async function cargar() {
  process.env.DATABASE_URL = URL_BANCO;
  ({ prisma } = await import('../dist/core/db/prisma.js'));
  const mod = await import('../dist/modules/system/app/routes/quotesAdmin.routes.js');
  const router = mod.default?.default ?? mod.default;   // el `dist` es CJS
  const capa = router?.stack?.find((c) => c.route && c.route.path === '/:id/invoice' && c.route.methods.post);
  assert.ok(capa, '🔴 NO ENCUENTRO `POST /:id/invoice` en el router. El código se ha movido, que '
    + 'es un dato DISTINTO de «el defecto no existe».');
  handler = capa.route.stack.map((s) => s.handle).pop();   // el handler, no `requireRole`
}

function resDeJuguete() {
  const r = { code: 200, cuerpo: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.cuerpo = b; return r; };
  r.send = (b) => { r.cuerpo = b; return r; };
  return r;
}
async function pedirFactura(quoteId, merchantId) {
  const res = resDeJuguete();
  try {
    await handler({ params: { id: String(quoteId) }, merchantId, teamMemberId: null, body: {}, query: {} },
      res, (e) => { throw e; });
  } catch (e) { return { code: 500, cuerpo: { error: 'excepcion', mensaje: e.message } }; }
  return { code: res.code, cuerpo: res.cuerpo };
}

const nuevoPresupuesto = (merchantId, customerId) => prisma.quote.create({
  data: { merchantId, customerId, status: 'accepted', total: TOTAL, currency: 'EUR',
    lines: LINEAS, customBillingPlan: PLAN },
});
const facturasDe = (quoteId) => prisma.invoice.findMany({
  where: { quoteId }, orderBy: { id: 'asc' },
  select: { number: true, stageLabel: true, total: true },
});

/** Las dos peticiones, en dos procesos, con la misma hora de salida. */
function correrCarrera(quoteId, merchantId) {
  const salida = Date.now() + 9000;   // margen para que los dos estén ESPERANDO antes de la señal
  const lanzar = (etiqueta) => new Promise((resolve) => {
    const p = spawn(process.execPath,
      [UNA_PETICION, RAIZ, String(quoteId), String(merchantId), String(salida), etiqueta],
      { env: { ...process.env, DATABASE_URL: URL_BANCO } });
    let out = ''; let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', () => {
      const linea = out.split(SALTO).filter(Boolean).pop();
      try { resolve(JSON.parse(linea)); }
      catch { resolve({ etiqueta, code: -1, cuerpo: { error: 'sin salida', err: err.split(SALTO)[0] } }); }
    });
  });
  return Promise.all([lanzar('A'), lanzar('B')]);
}

/** 🔴 EL SUELO DE LA CARRERA. Si no salieron a la vez, esto no ha medido concurrencia. */
function exigirCarreraReal(a, b, ronda) {
  const desfase = Math.abs(a.arranque - b.arranque);
  assert.ok(a.arranque < 120 && b.arranque < 120,
    `🔴 RONDA ${ronda}: NO HA HABIDO CARRERA — A arrancó ${a.arranque} ms y B ${b.arranque} ms tras `
    + `la señal (desfase ${desfase} ms). Un «no se reproduce» aquí sería un falso negativo del `
    + 'banco, no un hecho del código. La carrera se PROVOCA, no se espera.');
  return desfase;
}

test('SCRUM-814 · banco de tramos', { skip: ENABLED ? false : 'sin TRAMOS_PG_URL' }, async (t) => {
  exigirBancoDesechable(URL_BANCO);
  await cargar();

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // ✅ CONTROL POSITIVO — lo que tiene que seguir funcionando
  // ═══════════════════════════════════════════════════════════════════════════════════════
  await t.test('✅ POSITIVO · dos secuenciales dan «Anticipo» y luego «Final», con sus importes', async () => {
    await withMerchant(prisma, { name: 'Tecnosel', taxId: 'B12345678', email: 'a814@t.test' }, async (merchant) => {
      const cliente = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Pepe' } });
      const q = await nuevoPresupuesto(merchant.id, cliente.id);

      const r1 = await pedirFactura(q.id, merchant.id);
      const r2 = await pedirFactura(q.id, merchant.id);
      assert.equal(r1.code, 201, `🔴 la 1ª emisión falla: ${JSON.stringify(r1.cuerpo)}`);
      assert.equal(r2.code, 201, `🔴 la 2ª emisión falla: ${JSON.stringify(r2.cuerpo)}`);

      const emitidas = await facturasDe(q.id);
      // 🔴 SE EXIGE EL NÚMERO. La primera versión de este control comparaba
      // `new Set(tramos).size === tramos.length`, y con CERO facturas eso es `0 === 0` → verde.
      // Un verde por no mirar, justo en el control que decide si el banco vale.
      assert.equal(emitidas.length, 2, `🔴 han salido ${emitidas.length} facturas y esperaba 2`);
      assert.deepEqual(emitidas.map((i) => i.stageLabel), ['Anticipo', 'Final'],
        '🔴 los dos tramos no salen en orden, o no son los dos del plan');
      assert.equal(Number(emitidas[0].total), DEL_ANTICIPO, '🔴 el importe del anticipo (30 %) ha cambiado');
      assert.equal(Number(emitidas[1].total), DEL_FINAL, '🔴 el importe del final (70 %) ha cambiado');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // ✅ CONTROL NEGATIVO — apretar la carrera no puede comerse la defensa que ya existía
  // ═══════════════════════════════════════════════════════════════════════════════════════
  await t.test('✅ NEGATIVO · el 409 «ya se han emitido todas» SIGUE saliendo cuando de verdad lo están', async () => {
    await withMerchant(prisma, { name: 'Tecnosel', taxId: 'B12345678', email: 'b814@t.test' }, async (merchant) => {
      const cliente = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Pepe' } });
      const q = await nuevoPresupuesto(merchant.id, cliente.id);
      await pedirFactura(q.id, merchant.id);
      await pedirFactura(q.id, merchant.id);

      const tercera = await pedirFactura(q.id, merchant.id);
      assert.equal(tercera.code, 409);
      // 🔴 POR IDENTIDAD DEL CÓDIGO, no por subcadena del mensaje — y el código IMPORTA: éste
      // significa «no queda nada que facturar» y `stage_taken_concurrently` significa «vuelve a
      // pedirlo». Un solo código para las dos cosas obligaría a leer el texto para saber si hay
      // que reintentar.
      assert.equal(tercera.cuerpo.error, 'no_more_invoices_for_payment_terms',
        `🔴 el plan agotado ya no dice lo suyo: ${JSON.stringify(tercera.cuerpo)}. Apretar la `
        + 'carrera no puede comerse la defensa que ya estaba.');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // 🔴 EL ROJO CON EL MECANISMO VIEJO — 3 de 3, no una vez
  // ═══════════════════════════════════════════════════════════════════════════════════════
  await t.test('🔴 tres carreras seguidas: NUNCA salen dos facturas del mismo tramo', async () => {
    await withMerchant(prisma, { name: 'Tecnosel', taxId: 'B12345678', email: 'c814@t.test' }, async (merchant) => {
      const cliente = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Pepe' } });

      for (let ronda = 1; ronda <= 3; ronda += 1) {
        const q = await nuevoPresupuesto(merchant.id, cliente.id);
        const [a, b] = await correrCarrera(q.id, merchant.id);
        exigirCarreraReal(a, b, ronda);

        const emitidas = await facturasDe(q.id);
        const tramos = emitidas.map((i) => i.stageLabel);
        assert.equal(new Set(tramos).size, tramos.length,
          `🔴 RONDA ${ronda}: DOS FACTURAS DEL MISMO TRAMO ${JSON.stringify(tramos)}. Con el `
          + 'mecanismo viejo esto pasaba 3 de 3: el tramo se decidía con un recuento hecho ANTES '
          + 'de abrir la transacción.');
        assert.equal(emitidas.length, 1,
          `🔴 RONDA ${ronda}: la carrera ha dejado ${emitidas.length} facturas y sólo una petición `
          + 'podía ganar el tramo.');

        // Una gana con 201 y la otra pierde con el código de reintento. Enumerado, no contado.
        const codigos = [a, b].map((r) => (r.code === 201 ? 201 : r.cuerpo?.error)).sort();
        assert.deepEqual(codigos, [201, 'stage_taken_concurrently'].sort(),
          `🔴 RONDA ${ronda}: las dos respuestas fueron ${JSON.stringify([a.code, b.code])} / `
          + `${JSON.stringify([a.cuerpo, b.cuerpo])}. Se esperaba una 201 y una 409 de reintento.`);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // ✅ EL CASO DEL DINERO — el total facturable no puede quedar por debajo del presupuesto
  // ═══════════════════════════════════════════════════════════════════════════════════════
  await t.test('✅ DINERO · tras una carrera, el presupuesto se factura ENTERO: 363 + 847 = 1210', async () => {
    await withMerchant(prisma, { name: 'Tecnosel', taxId: 'B12345678', email: 'd814@t.test' }, async (merchant) => {
      const cliente = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Pepe' } });
      const q = await nuevoPresupuesto(merchant.id, cliente.id);

      const [a, b] = await correrCarrera(q.id, merchant.id);
      exigirCarreraReal(a, b, 'dinero');

      // Quien perdió, reintenta — que es exactamente lo que su 409 le dice que haga. Y se sigue
      // pidiendo hasta que el plan diga que no queda nada, sin suponer cuántas hacen falta.
      let ultima;
      for (let i = 0; i < 5; i += 1) {
        ultima = await pedirFactura(q.id, merchant.id);
        if (ultima.code === 409 && ultima.cuerpo.error === 'no_more_invoices_for_payment_terms') break;
      }
      assert.equal(ultima.cuerpo?.error, 'no_more_invoices_for_payment_terms',
        `🔴 el presupuesto no llega a estar facturado del todo: ${JSON.stringify(ultima)}`);

      const emitidas = await facturasDe(q.id);
      assert.deepEqual(emitidas.map((i) => i.stageLabel).sort(), ['Anticipo', 'Final'],
        `🔴 los tramos emitidos son ${JSON.stringify(emitidas.map((i) => i.stageLabel))}`);
      const facturado = emitidas.reduce((acc, i) => acc + Number(i.total), 0);
      assert.equal(facturado, Number(TOTAL),
        `🔴 facturado ${facturado} € sobre un presupuesto de ${TOTAL} €. Con el mecanismo viejo `
        + 'aquí salían 726 € y 484 € se quedaban SIN PODER FACTURARSE: las dos facturas del mismo '
        + 'tramo agotaban el plan, y por la regla 29 no se borran.');
    });
  });
});
