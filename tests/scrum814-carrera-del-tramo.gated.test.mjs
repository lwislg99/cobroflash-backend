// tests/scrum814-carrera-del-tramo.gated.test.mjs — SCRUM-814
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// DOS PETICIONES SIMULTÁNEAS EMITÍAN DOS FACTURAS DEL MISMO TRAMO.
//
// `POST /admin/quotes/:id/invoice` leía el presupuesto con sus facturas, decidía el tramo con
// `plan[existingInvoices.length]`, y 32 líneas más abajo abría la transacción SIN volver a
// contar. Envolver la creación en una transacción no protege una decisión tomada ANTES de
// abrirla: la transacción garantiza que lo que se escribe se escribe entero; no garantiza que
// lo que se decidió siga siendo cierto.
//
// Y el cerrojo que YA existía (SCRUM-728, `pg_advisory_xact_lock(SERIE_LOCK_NS, merchantId)`)
// no lo impedía, porque no es lo que guarda: **serializa la SERIE, no la DECISIÓN**. Por eso
// las dos facturas salían con números DISTINTOS y las dos con 201 — un candado que funciona
// perfectamente guardando una puerta que no es.
//
// ── LO QUE CONVIERTE ESTO EN DINERO ──────────────────────────────────────────────────────────
// Con un plan 30/70 sobre 1210 €: dos «Anticipo» de 363 €, y la TERCERA petición —la del
// «Final»— contesta 409 «Ya se han emitido todas las facturas de este presupuesto». Facturado
// 726 € sobre 1210 €: **484 € que ya no se pueden facturar**, con dos facturas emitidas que por
// la regla 29 no se editan ni se borran (solo cabe una rectificativa R1).
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL SUELO DEL BANCO — sin esto, el verde no significa nada
//
//  ① DOS PROCESOS, no dos promesas. `Promise.all` en un solo node comparte bucle de eventos y
//     agente HTTP: la segunda petición sale cuando la primera ya escribió en el socket. La
//     primera medición de este ticket dijo «no se reproduce» exactamente por eso.
//  ② HORA DE SALIDA COMÚN, y COMPROBADA: si las dos salidas distan más de `DESFASE_MAXIMO_MS`,
//     el test FALLA declarando que no se concluye nada. La carrera se provoca, no se espera.
//     Un caso que cae fuera del mecanismo da verde sin haber ejercitado nada (ERRORES_ASESOR #12).
//  ③ EL POSITIVO SE EXIGE POR EL NÚMERO, nunca comparando longitudes. `new Set([]).size ===
//     [].length` es `0 === 0`: un control positivo que se cumple sobre el vacío no es un
//     control, es una tautología con forma de prueba.
//
// ── CÓMO SE VIO EN ROJO ──────────────────────────────────────────────────────────────────────
// Corrido contra el código ANTERIOR al arreglo (`git stash` del fuente, `npm run build`,
// misma tanda): las dos facturas salían con `stageLabel` «Anticipo» las dos. Con el arreglo,
// «Anticipo» y «Final». Los dos sentidos van pegados en el parte del PR.
//
// ⛔ Este fichero solo LEE el camino de emisión a través de su ruta HTTP: no importa nada de
// `dist/modules/**` para reimplementar la decisión. Un banco que se escribe su propia copia de
// la lógica mide su copia, no el camino.
import './_staging-db.mjs'; // PRIMERO: fija la BD de pruebas del carril. Código de seguridad (SCRUM-118).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

const ENABLED = process.env.QA_DB_TEST === '1';
// 🔴 EL MOTIVO DEL SALTO VA LITERAL EN CADA `skip`, y no en una constante: SCRUM-456 lo lee
// por AST, y de un identificador no puede sacar el texto — el salto sale MUDO y su tanda roja.
// Cazado por el guard al primer intento, que es exactamente para lo que está.

/** Suelo del banco: por encima de esto, las dos peticiones no compitieron y no se concluye nada. */
const DESFASE_MAXIMO_MS = 120;
/** Margen para que los dos hijos estén arrancados y esperando ANTES de la hora de salida. */
const MARGEN_ARRANQUE_MS = 3000;

const CLIENTE = path.join(import.meta.dirname, 'fixtures', 'scrum814-peticion-simultanea.mjs');

/** Una línea que da EXACTAMENTE 1210,00 € brutos: 1000 € + 21 % de IVA. Sin deriva de céntimos. */
const LINEAS = [{ concept: 'Obra SCRUM-814', qty: 1, price: 1000, tax: 0.21 }];
const TOTAL = '1210.00';

const PLAN_50_50 = [{ percentage: 0.5, label: 'Anticipo' }, { percentage: 0.5, label: 'Final' }];
const PLAN_30_70 = [{ percentage: 0.3, label: 'Anticipo' }, { percentage: 0.7, label: 'Final' }];

/** Lanza el cliente en su PROPIO proceso y devuelve lo que imprimió. */
function lanzarCliente(base, cookie, quoteId, t0) {
  return new Promise((resolve, reject) => {
    const hijo = spawn(process.execPath, [CLIENTE, base, cookie, String(quoteId), String(t0)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let salida = '';
    let err = '';
    hijo.stdout.on('data', (d) => { salida += d; });
    hijo.stderr.on('data', (d) => { err += d; });
    hijo.on('error', reject);
    hijo.on('close', (codigo) => {
      if (codigo !== 0) return reject(new Error(`el cliente salió con ${codigo}: ${err}`));
      try {
        resolve(JSON.parse(salida.trim()));
      } catch (e) {
        reject(new Error(`el cliente no imprimió JSON (${e.message}). stdout: «${salida}» stderr: «${err}»`));
      }
    });
  });
}

/**
 * Las DOS peticiones, cada una en su proceso, con hora de salida común. Comprueba el suelo
 * ANTES de devolver nada: si no hubo cita, no hay medición que interpretar.
 */
async function dosALaVez(t, base, cookie, quoteId) {
  const t0 = Date.now() + MARGEN_ARRANQUE_MS;
  const [a, b] = await Promise.all([
    lanzarCliente(base, cookie, quoteId, t0),
    lanzarCliente(base, cookie, quoteId, t0),
  ]);

  for (const [nombre, r] of [['A', a], ['B', b]]) {
    assert.ok(r.error === null,
      `🔴 EL CLIENTE ${nombre} NI LLEGÓ A CONTESTAR (${r.error}). No hay carrera que medir.`);
    assert.ok(r.listo < t0,
      `🔴 NO SE CONCLUYE NADA: el proceso ${nombre} estuvo listo ${r.listo - t0} ms DESPUÉS de la ` +
      'hora de salida, así que no llegó a la cita. Sube `MARGEN_ARRANQUE_MS` y vuelve a medir.');
  }

  const desfase = Math.abs(a.salida - b.salida);
  assert.ok(desfase <= DESFASE_MAXIMO_MS,
    `🔴 NO SE CONCLUYE NADA: las dos peticiones salieron con ${desfase} ms de diferencia y el suelo ` +
    `del banco son ${DESFASE_MAXIMO_MS} ms. Con ese desfase la primera ya ha commiteado cuando ` +
    'sale la segunda, así que un verde aquí no dice que la carrera esté cerrada: dice que no la ' +
    'hubo. La carrera se provoca, no se espera.');

  t.diagnostic(`desfase de salida: ${desfase} ms · A → ${a.status} · B → ${b.status}`);
  return { a, b, desfase };
}

/** Las facturas del presupuesto, en el orden en que nacieron. */
async function facturasDe(prisma, quoteId) {
  return prisma.invoice.findMany({
    where: { quoteId },
    orderBy: { id: 'asc' },
    select: { id: true, number: true, total: true, stageLabel: true },
  });
}

/** Cookie de sesión de admin para ese merchant (mismo patrón que SCRUM-178). */
async function sesionAdmin(prisma, base, merchantId) {
  const token = 'qa814-' + crypto.randomBytes(12).toString('hex');
  await prisma.authSession.create({
    data: { merchantId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
  });
  const verify = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
  const cookie = (verify.headers.get('set-cookie') || '').split(';')[0];
  assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');
  return cookie;
}

const emitir = (base, cookie, quoteId) => fetch(`${base}/admin/quotes/${quoteId}/invoice`, {
  method: 'POST', headers: { cookie, 'Content-Type': 'application/json' },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① LA CARRERA — el rojo que este ticket existe para apagar
// ═════════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-814 · dos peticiones simultáneas NO pueden emitir el MISMO tramo', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    await withMerchant(
      prisma,
      { name: 'QA S814 carrera', email: `qa-s814-${Date.now()}@test.local`, country: 'ES', taxId: 'B12345678' },
      async (merchant) => {
        const customer = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Cliente S814' } });
        const quote = await prisma.quote.create({
          data: {
            merchantId: merchant.id, customerId: customer.id, status: 'accepted', currency: 'EUR',
            total: TOTAL, lines: LINEAS, paymentTerms: 'FIFTY_FIFTY', customBillingPlan: PLAN_50_50,
          },
        });
        const cookie = await sesionAdmin(prisma, base, merchant.id);

        const { a, b } = await dosALaVez(t, base, cookie, quote.id);
        const facturas = await facturasDe(prisma, quote.id);
        const etiquetas = facturas.map((f) => f.stageLabel);

        // EL NÚMERO, no una longitud comparada consigo misma. Un plan de dos tramos con dos
        // peticiones tiene que dar DOS facturas: ni una (una petición perdida) ni tres.
        assert.equal(facturas.length, 2,
          `🔴 se esperaban 2 facturas y hay ${facturas.length}: ${JSON.stringify(facturas)}. ` +
          `Respuestas: A ${a.status} ${JSON.stringify(a.cuerpo)} · B ${b.status} ${JSON.stringify(b.cuerpo)}`);

        assert.deepEqual(
          [...etiquetas].sort(), ['Anticipo', 'Final'],
          '🔴 DOS FACTURAS DEL MISMO TRAMO. Las dos peticiones decidieron su tramo con el recuento ' +
          `que leyeron ANTES de abrir la transacción, y las dos leyeron lo mismo. Etiquetas: ` +
          `${JSON.stringify(etiquetas)}. El cerrojo de serie no lo impide: serializa la SERIE, no la ` +
          'DECISIÓN — por eso los NÚMEROS sí salen distintos y eso no prueba nada.\n' +
          `     números: ${facturas.map((f) => f.number).join(', ')}`,
        );

        // Y los números siguen siendo distintos: el arreglo no puede haber roto SCRUM-728.
        const numeros = facturas.map((f) => f.number);
        assert.equal(new Set(numeros).size, numeros.length,
          `🔴 dos facturas con el MISMO número (${numeros.join(', ')}): el cerrojo de serie dejó de proteger.`);

        assert.deepEqual([a.status, b.status].sort(), [201, 201],
          '🔴 una de las dos peticiones no emitió. Cerrar la carrera no puede convertir una emisión ' +
          `legítima en un error: A ${a.status} ${JSON.stringify(a.cuerpo)} · B ${b.status} ${JSON.stringify(b.cuerpo)}`);

        t.diagnostic(`tramos emitidos: ${etiquetas.join(' + ')} · números ${numeros.join(', ')}`);
      },
    );
  } finally {
    await new Promise((r) => server.close(r));
    await prisma.$disconnect();
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② EL DINERO — 30/70, que es donde el defecto se cobra
// ═════════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-814 · plan 30/70: lo facturable NO puede quedar por debajo del presupuesto', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const { motivoSinTramo } = await import('../dist/modules/quotes/domain/billingPlan.js');

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    await withMerchant(
      prisma,
      { name: 'QA S814 dinero', email: `qa-s814d-${Date.now()}@test.local`, country: 'ES', taxId: 'B12345678' },
      async (merchant) => {
        const customer = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Cliente S814 dinero' } });
        const quote = await prisma.quote.create({
          data: {
            merchantId: merchant.id, customerId: customer.id, status: 'accepted', currency: 'EUR',
            total: TOTAL, lines: LINEAS, paymentTerms: 'FIFTY_FIFTY', customBillingPlan: PLAN_30_70,
          },
        });
        const cookie = await sesionAdmin(prisma, base, merchant.id);

        await dosALaVez(t, base, cookie, quote.id);
        const facturas = await facturasDe(prisma, quote.id);

        assert.equal(facturas.length, 2, `se esperaban 2 facturas y hay ${facturas.length}`);
        assert.deepEqual(
          facturas.map((f) => `${f.stageLabel} ${Number(f.total).toFixed(2)}`),
          ['Anticipo 363.00', 'Final 847.00'],
          '🔴 EL DINERO. Con dos «Anticipo» de 363 € el presupuesto de 1210 € se queda facturado en ' +
          '726 €, y los 484 € que faltan YA NO SE PUEDEN FACTURAR: el tramo «Final» contesta 409 y ' +
          'las dos facturas emitidas no se editan ni se borran (regla 29, solo una R1).',
        );

        const facturado = facturas.reduce((s, f) => s + Number(f.total), 0);
        assert.equal(facturado.toFixed(2), Number(TOTAL).toFixed(2),
          `🔴 se han facturado ${facturado.toFixed(2)} € de un presupuesto de ${TOTAL} €. El total ` +
          'facturable no puede quedar por debajo del presupuesto.');

        // ── NEGATIVO · el 409 SIGUE saliendo cuando de verdad se han emitido todas ──────────
        // Apretar la carrera no puede comerse esta defensa: es la misma respuesta de siempre,
        // con el texto oficial de SCRUM-151 (se IMPORTA, no se copia — regla 30).
        const tercera = await emitir(base, cookie, quote.id);
        const cuerpo = await tercera.json();
        assert.equal(tercera.status, 409, `la tercera petición debía dar 409 y dio ${tercera.status}`);
        assert.deepEqual(cuerpo, motivoSinTramo([{}, {}]),
          '🔴 el 409 de «ya se han emitido todas» dejó de salir con su código y su texto de siempre.');
        assert.equal(await prisma.invoice.count({ where: { quoteId: quote.id } }), 2,
          '🔴 la tercera petición creó algo pese a contestar 409');

        t.diagnostic(`facturado ${facturado.toFixed(2)} € de ${TOTAL} € · tercera → 409 ${cuerpo.error}`);
      },
    );
  } finally {
    await new Promise((r) => server.close(r));
    await prisma.$disconnect();
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ③ POSITIVO ENUMERADO — que cerrar la carrera no haya roto el camino normal
// ═════════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-814 · dos peticiones SECUENCIALES siguen emitiendo «Anticipo» y luego «Final»', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    await withMerchant(
      prisma,
      { name: 'QA S814 secuencial', email: `qa-s814s-${Date.now()}@test.local`, country: 'ES', taxId: 'B12345678' },
      async (merchant) => {
        const customer = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Cliente S814 sec' } });
        const quote = await prisma.quote.create({
          data: {
            merchantId: merchant.id, customerId: customer.id, status: 'accepted', currency: 'EUR',
            total: TOTAL, lines: LINEAS, paymentTerms: 'FIFTY_FIFTY', customBillingPlan: PLAN_50_50,
          },
        });
        const cookie = await sesionAdmin(prisma, base, merchant.id);

        const primera = await emitir(base, cookie, quote.id);
        const cuerpo1 = await primera.json();
        assert.equal(primera.status, 201, `la 1ª debía emitir y dio ${primera.status} ${JSON.stringify(cuerpo1)}`);

        const segunda = await emitir(base, cookie, quote.id);
        const cuerpo2 = await segunda.json();
        assert.equal(segunda.status, 201, `la 2ª debía emitir y dio ${segunda.status} ${JSON.stringify(cuerpo2)}`);

        const facturas = await facturasDe(prisma, quote.id);
        // POR EL NÚMERO Y EN ORDEN. Comparar `new Set(x).size` con `x.length` daría verde sobre
        // el vacío: `0 === 0`. Aquí se nombra lo que tiene que haber, uno por uno.
        assert.equal(facturas.length, 2, `se esperaban 2 facturas y hay ${facturas.length}`);
        assert.deepEqual(
          facturas.map((f) => `${f.stageLabel} ${Number(f.total).toFixed(2)}`),
          ['Anticipo 605.00', 'Final 605.00'],
          '🔴 el camino secuencial dejó de emitir los dos tramos en orden con sus importes.',
        );
        assert.deepEqual(
          [cuerpo1.percentage, cuerpo2.percentage], [0.5, 0.5],
          '🔴 la respuesta ya no declara el porcentaje del tramo que EMITIÓ (se lee en el panel).',
        );

        t.diagnostic(`secuencial: ${facturas.map((f) => `${f.stageLabel} ${f.total}`).join(' → ')}`);
      },
    );
  } finally {
    await new Promise((r) => server.close(r));
    await prisma.$disconnect();
  }
});
