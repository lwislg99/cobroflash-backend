// tests/scrum814-carrera-de-tramos-postgres.test.mjs — SCRUM-814
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LOS DOS CAMINOS QUE `scrum814-carrera-del-tramo.gated.test.mjs` NO CUBRE.
//
// Aquél —el que entró en `main`— mide `POST /admin/quotes/:id/invoice` por HTTP real contra
// staging, y para esa ruta lo hace mejor que esto: pasa por el servidor entero. **No se duplica.**
// Aquí van los otros dos sitios donde vivía el mismo defecto, contra un Postgres desechable:
//
//   · `POST /quote/:token/decision`       — lo dispara el CLIENTE FINAL desde WhatsApp
//   · `POST /admin/jobs/:id/collect-rest` — «cobrar el resto» de un trabajo
//
// El primero es el que más pesa de los tres: pulsar dos veces con mala cobertura es ahí el caso
// NORMAL, no el raro.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, PARA QUIEN LLEGUE DE NUEVAS
//
// El tramo se elegía con `plan[<facturas ya emitidas>]` a partir de una lectura hecha ANTES de
// abrir la transacción. Envolver la creación no protege una decisión tomada antes de abrirla.
// Medido con plan 30/70: dos facturas selladas del tramo «Anticipo» (363 € cada una), y el
// presupuesto se quedaba en **726 € de 1210 — 484 € que ya no se podían facturar**, en documentos
// que la regla 29 no deja borrar.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ HACE FALTA POSTGRES DE VERDAD, y no vale un doble
//
// Se prueba una CARRERA entre dos transacciones y la visibilidad de una fila bajo
// `pg_advisory_xact_lock` en READ COMMITTED. Un doble responde lo que se le diga; la semántica de
// aislamiento sólo la tiene el motor.
//
// Y por eso hay además `scrum814-recuento-dentro.test.mjs`, por AST y **sin gate**: un ticket cuyo
// único guard está detrás de un gate es un ticket cuyo guard el CI no ejecuta nunca (SCRUM-296).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// CÓMO SE CORRE (banco local desechable, NUNCA una base del proyecto)
//
//   TRAMOS_PG_URL=<la URL del banco desechable>  node --test tests/scrum814-carrera-de-tramos-postgres.test.mjs
//
// La URL se pasa por entorno y NO se escribe aquí — ni real ni de ejemplo. Tiene que apuntar a
// loopback y a una base terminada en `_test`; lo comprueba `exigirBancoDesechable`, y si no lo
// cumple este test NO se salta: falla. Este banco EMITE FACTURAS.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LA CARRERA SE PROVOCA, NO SE ESPERA
//
// Dos PROCESOS con una hora de salida común. `Promise.all` dentro de un solo node NO sirve:
// comparten bucle de eventos y pool de conexiones. Mi primera medición lo hizo así, dijo «no se
// reproduce» y era FALSA — un falso negativo en el camino del dinero, que es el peor resultado
// posible porque cierra la pregunta.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UNA_PETICION = path.join(RAIZ, 'docs', 'master', 'evidencias', 'scrum814', 'una-peticion.mjs');

const CAMINO_CLIENTE = { fichero: 'src/modules/quotes/app/routes/quotes.routes.ts', ruta: '/:token/decision' };
const CAMINO_RESTO = { fichero: 'src/modules/jobs/app/routes/jobs.routes.ts', ruta: '/:id/collect-rest' };

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
}

// Plan DESIGUAL a propósito: con 50/50 las dos facturas de la carrera valen lo mismo, la suma
// cuadra con el total y el defecto parece una etiqueta mal puesta. Con 30/70 se ve el dinero.
const PLAN = [{ label: 'Anticipo', percentage: 0.3 }, { label: 'Final', percentage: 0.7 }];
const LINEAS = [{ concept: 'Cuadro general', qty: 1, price: 1000, tax: 0.21 }];
const TOTAL = '1210.00';
const DEL_ANTICIPO = 363;
const DEL_FINAL = 847;
const SALTO = String.fromCharCode(10);

let prisma;

async function cargar() {
  process.env.DATABASE_URL = URL_BANCO;
  ({ prisma } = await import('../dist/core/db/prisma.js'));
}

const nuevoPresupuesto = (merchantId, customerId, extra = {}) => prisma.quote.create({
  data: {
    merchantId, customerId, status: 'accepted', total: TOTAL, currency: 'EUR',
    lines: LINEAS, customBillingPlan: PLAN, ...extra,
  },
});
const facturasDe = (quoteId) => prisma.invoice.findMany({
  where: { quoteId }, orderBy: { id: 'asc' },
  select: { number: true, stageLabel: true, total: true },
});

/** Las dos peticiones, en DOS PROCESOS, con la misma hora de salida. */
function correrCarrera(camino, req) {
  const salida = Date.now() + 9000;   // margen para que los dos estén ESPERANDO antes de la señal
  const lanzar = (etiqueta) => new Promise((resolve) => {
    const p = spawn(process.execPath,
      [UNA_PETICION, RAIZ, camino.fichero, camino.ruta, JSON.stringify(req), String(salida), etiqueta],
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
}

test('SCRUM-814 · los dos caminos que el test de staging no cubre',
  { skip: ENABLED ? false : 'sin TRAMOS_PG_URL' }, async (t) => {
    exigirBancoDesechable(URL_BANCO);
    await cargar();

    // ═══════════════════════════════════════════════════════════════════════════════════════
    // 🔴 EL CLIENTE FINAL — el que más pesa de los tres
    // ═══════════════════════════════════════════════════════════════════════════════════════
    await t.test('🔴 CLIENTE FINAL · tres carreras en `/:token/decision`: nunca dos del mismo tramo', async () => {
      await withMerchant(prisma, { name: 'Tecnosel', taxId: 'B12345678', email: 'e814@t.test' }, async (merchant) => {
        const cliente = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Pepe' } });

        for (let ronda = 1; ronda <= 3; ronda += 1) {
          // Aquí el presupuesto nace SIN aceptar: lo que se acepta —y lo que emite— es la propia
          // petición del cliente. Ése es el hecho que dispara la factura en este camino.
          //
          // 🔴 El token es HEX de 32 como el de verdad (`crypto.randomBytes(16).toString('hex')`):
          // `parseToken` se queda SÓLO con hex, así que un `tok-1-…` se convierte en otra cosa y la
          // ruta contesta 404 sin emitir nada. Me pasó, y el suelo lo cazó: 0 facturas donde tenía
          // que haber 1.
          const q = await nuevoPresupuesto(merchant.id, cliente.id, {
            status: 'pending', decisionToken: randomBytes(16).toString('hex'),
          });
          const [a, b] = await correrCarrera(CAMINO_CLIENTE, {
            params: { token: q.decisionToken }, body: { decision: 'accept' },
          });
          exigirCarreraReal(a, b, 'cliente/' + ronda);

          const emitidas = await facturasDe(q.id);
          const tramos = emitidas.map((i) => i.stageLabel);
          assert.equal(new Set(tramos).size, tramos.length,
            `🔴 RONDA ${ronda}: DOS FACTURAS DEL MISMO TRAMO ${JSON.stringify(tramos)} en el camino `
            + 'del CLIENTE FINAL. Aquí el defecto muerde en el caso normal: el cliente pulsa dos '
            + 'veces porque la cobertura va mal.');
          assert.equal(emitidas.length, 1,
            `🔴 RONDA ${ronda}: la carrera ha dejado ${emitidas.length} factura(s), y su aceptación `
            + '—aunque el dedo tocara dos veces— es UNA. Emitir el «Final» de golpe junto al '
            + '«Anticipo» sería cobrarle antes de tiempo.');
          assert.equal(emitidas[0].stageLabel, 'Anticipo',
            `🔴 RONDA ${ronda}: la única factura no es el primer tramo, sino «${emitidas[0].stageLabel}».`);

          // 🔴 Y AL CLIENTE NO SE LE DICE NADA: su aceptación salió bien y su factura EXISTE (la
          // emitió la gemela). Las dos respuestas son de éxito y ninguna marca «factura
          // pendiente», que le mandaría a llamar al profesional por algo que no ha pasado.
          for (const r of [a, b]) {
            assert.ok(r.code < 400,
              `🔴 RONDA ${ronda}: el cliente recibe ${r.code} ${JSON.stringify(r.cuerpo)}. Su `
              + 'aceptación salió bien: no puede llevarse un error por una carrera nuestra.');
            assert.notEqual(r.cuerpo?.facturaPendiente, true,
              `🔴 RONDA ${ronda}: se le dice «factura pendiente» y la factura EXISTE. Eso es una `
              + 'llamada de soporte por algo que no ha pasado.');
          }
        }
      });
    });

    // ═══════════════════════════════════════════════════════════════════════════════════════
    // 🔴 COBRAR EL RESTO
    // ═══════════════════════════════════════════════════════════════════════════════════════
    await t.test('🔴 COBRAR EL RESTO · tres carreras en `/:id/collect-rest`: nunca dos del mismo tramo', async () => {
      await withMerchant(prisma, { name: 'Tecnosel', taxId: 'B12345678', email: 'f814@t.test' }, async (merchant) => {
        const cliente = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Pepe' } });

        for (let ronda = 1; ronda <= 3; ronda += 1) {
          const q = await nuevoPresupuesto(merchant.id, cliente.id);
          const job = await prisma.job.create({
            data: { merchantId: merchant.id, customerId: cliente.id, quoteId: q.id, status: 'terminado' },
          });
          const [a, b] = await correrCarrera(CAMINO_RESTO, {
            params: { id: String(job.id) }, merchantId: merchant.id,
          });
          exigirCarreraReal(a, b, 'resto/' + ronda);

          const emitidas = await facturasDe(q.id);
          const tramos = emitidas.map((i) => i.stageLabel);
          assert.equal(new Set(tramos).size, tramos.length,
            `🔴 RONDA ${ronda}: DOS FACTURAS DEL MISMO TRAMO ${JSON.stringify(tramos)} al «cobrar el `
            + 'resto». El comentario de esa ruta ya decía que pulsar dos veces tenía que emitir '
            + 'siempre el mismo tramo; ahora además es verdad.');

          // Aquí SÍ se recalcula el tramo dentro del cerrojo —igual que en `quotesAdmin`—: quien
          // pulsa pide «emite lo que toque», así que el segundo emite el SIGUIENTE. Por eso el
          // importe se comprueba contra los tramos del plan, y no contra un número fijo.
          const facturado = emitidas.reduce((acc, i) => acc + Number(i.total), 0);
          const esperado = emitidas.length === 2 ? DEL_ANTICIPO + DEL_FINAL : DEL_ANTICIPO;
          assert.equal(facturado, esperado,
            `🔴 RONDA ${ronda}: ${emitidas.length} factura(s) suman ${facturado} € y no cuadran con `
            + `los tramos del plan (${DEL_ANTICIPO} + ${DEL_FINAL} = ${Number(TOTAL)}).`);
        }
      });
    });

    // ═══════════════════════════════════════════════════════════════════════════════════════
    // ✅ POSITIVO y ✅ DINERO — lo que tiene que seguir funcionando
    // ═══════════════════════════════════════════════════════════════════════════════════════
    await t.test('✅ POSITIVO · dos «cobrar el resto» dan «Anticipo» 363 € y «Final» 847 € = 1210 €', async () => {
      await withMerchant(prisma, { name: 'Tecnosel', taxId: 'B12345678', email: 'g814@t.test' }, async (merchant) => {
        const cliente = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Pepe' } });
        const q = await nuevoPresupuesto(merchant.id, cliente.id);
        const job = await prisma.job.create({
          data: { merchantId: merchant.id, customerId: cliente.id, quoteId: q.id, status: 'terminado' },
        });
        const req = { params: { id: String(job.id) }, merchantId: merchant.id };
        await correrCarrera(CAMINO_RESTO, req);

        const emitidas = await facturasDe(q.id);
        // 🔴 SE EXIGE EL NÚMERO. La primera versión comparaba `new Set(t).size === t.length`, y con
        // CERO facturas eso es `0 === 0` → verde. Un verde por no mirar, justo en el control que
        // decide si el banco vale.
        assert.equal(emitidas.length, 2,
          `🔴 han salido ${emitidas.length} facturas y esperaba 2: dos peticiones a «cobrar el `
          + 'resto» tienen que facturar el presupuesto ENTERO, no la mitad.');
        assert.deepEqual(emitidas.map((i) => i.stageLabel), ['Anticipo', 'Final'],
          '🔴 los dos tramos no salen en orden, o no son los dos del plan');
        assert.equal(Number(emitidas[0].total), DEL_ANTICIPO, '🔴 el importe del anticipo (30 %) ha cambiado');
        assert.equal(Number(emitidas[1].total), DEL_FINAL, '🔴 el importe del final (70 %) ha cambiado');

        // ✅ DINERO · el total facturable NO puede quedar por debajo del presupuesto. Antes del
        // arreglo se quedaban 484 € sin poder facturarse, en facturas que no se pueden borrar.
        const facturado = emitidas.reduce((acc, i) => acc + Number(i.total), 0);
        assert.equal(facturado, Number(TOTAL),
          `🔴 facturado ${facturado} € sobre un presupuesto de ${TOTAL} €.`);
      });
    });
  });
