// SCRUM-170 (FACT-2c) — facturar SOLO PARTE de lo servido en un albarán.
//
// ⚠️ NOTA SOBRE LOS DATOS REALES, y va en el PR: en producción hay 17 albaranes y los 17 son
// `SIN_VALORAR` (ninguno lleva precios), así que HOY NO HAY UN SOLO DATO que ejerza este
// camino. Las fixtures de aquí son VALORADAS a propósito: es la única forma de probar de
// verdad la ruta hasta que exista un albarán con precios. No se está probando sobre lo que
// hay, se está probando lo que va a haber — y eso queda dicho, no escondido.
//
// LO QUE DE VERDAD SE PROTEGE es una regla de la casa, no una función: el estado de cobro se
// DERIVA (SCRUM-17, citando la queja de DELSOL sobre albaranes que hay que arreglar a mano) y
// la Parte L no gana ningún estado almacenado (regla 27). Por eso no existe ninguna columna
// `PARCIALMENTE_FACTURADO`: si el test la encontrara, el diseño se habría roto.
import './_staging-db.mjs'; // SCRUM-60: fuerza staging (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113
import {
  estadoCobroAlbaran, facturadoPorLinea, pendientePorLinea, validarPeticionParcial,
} from '../dist/modules/jobs/domain/albaranFacturacion.js';

const ENABLED = process.env.QA_DB_TEST === '1';

const LINEAS = [
  { concepto: 'Horas de oficial', cantidad: 10, unidad: 'h', precioUnitario: 28, tipoIva: 21 },
  { concepto: 'Metros de tubo', cantidad: 4.5, unidad: 'm', precioUnitario: 12.4, tipoIva: 21 },
];

test('SCRUM-170: sin libro, nada está facturado', () => {
  const f = facturadoPorLinea([]);
  assert.equal(estadoCobroAlbaran(LINEAS, f), 'sin_facturar');
  assert.deepEqual(pendientePorLinea(LINEAS, f).map((p) => p.pendiente), [10, 4.5]);
});

test('SCRUM-170: con parte facturada, el estado es PARCIAL y el pendiente baja', () => {
  const f = facturadoPorLinea([{ lineaIndex: 0, cantidad: 4, invoiceId: 1 }]);
  assert.equal(estadoCobroAlbaran(LINEAS, f), 'parcial');
  assert.deepEqual(pendientePorLinea(LINEAS, f).map((p) => p.pendiente), [6, 4.5]);
});

test('SCRUM-170: cuando no queda nada pendiente, el estado es FACTURADO — sin flag que poner', () => {
  const f = facturadoPorLinea([
    { lineaIndex: 0, cantidad: 6, invoiceId: 1 },
    { lineaIndex: 0, cantidad: 4, invoiceId: 2 },
    { lineaIndex: 1, cantidad: 4.5, invoiceId: 2 },
  ]);
  assert.equal(estadoCobroAlbaran(LINEAS, f), 'facturado',
    'el estado sale de comparar servido con facturado; nadie lo escribe en ninguna columna');
});

test('SCRUM-170: ANULAR una factura devuelve su cantidad a pendiente sin tocar ningún contador', () => {
  const libro = [
    { lineaIndex: 0, cantidad: 6, invoiceId: 1 },
    { lineaIndex: 0, cantidad: 4, invoiceId: 2 },
  ];
  assert.equal(estadoCobroAlbaran(LINEAS, facturadoPorLinea(libro)), 'parcial');
  // La factura 2 se anula (regla 29: no se borra, se anula) → sus filas dejan de contar.
  const tras = facturadoPorLinea(libro, new Set([2]));
  assert.equal(tras.get(0), 6, 'vuelven a quedar 4 pendientes de la línea 0');
  assert.equal(estadoCobroAlbaran(LINEAS, tras), 'parcial');
  // Esto es lo que un `cantidadFacturada` mutable NO daría gratis: habría que acordarse de
  // restar, y ese "acordarse" es la enfermedad que documenta DELSOL.
});

test('SCRUM-170: no se puede facturar más de lo que queda (fail-closed, la petición ENTERA)', () => {
  const pend = pendientePorLinea(LINEAS, facturadoPorLinea([{ lineaIndex: 0, cantidad: 8, invoiceId: 1 }]));
  const r = validarPeticionParcial([{ index: 0, cantidad: 3 }], pend);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'cantidad_excede_pendiente');
  assert.match(r.message, /solo quedan 2/, `el mensaje debe decir cuánto queda, y fue: ${r.message}`);

  // Y una línea mala tumba la petición entera aunque la otra sea válida: media factura correcta
  // sigue siendo una factura que no se puede editar ni borrar.
  const mixta = validarPeticionParcial([{ index: 1, cantidad: 1 }, { index: 0, cantidad: 99 }], pend);
  assert.equal(mixta.ok, false, '🔴 FAIL-CLOSED ROTO: una petición con una línea inválida no puede emitir nada');
});

test('SCRUM-170: cantidades absurdas y líneas repetidas se rechazan, no se interpretan', () => {
  const pend = pendientePorLinea(LINEAS, facturadoPorLinea([]));
  assert.equal(validarPeticionParcial([{ index: 0, cantidad: 0 }], pend).error, 'cantidad_invalida');
  assert.equal(validarPeticionParcial([{ index: 0, cantidad: -2 }], pend).error, 'cantidad_invalida');
  assert.equal(validarPeticionParcial([{ index: 9, cantidad: 1 }], pend).error, 'linea_no_encontrada');
  assert.equal(
    validarPeticionParcial([{ index: 0, cantidad: 1 }, { index: 0, cantidad: 1 }], pend).error,
    'linea_repetida',
    'sumar las dos adivinaría la intención de quien manda los datos',
  );
  assert.equal(validarPeticionParcial([], pend).error, 'seleccion_vacia');
});

test('SCRUM-170: emitir parte, ver el pendiente, y que la consolidación NO se lo trague', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const stamp = Date.now();

  try {
    await withMerchant(
      prisma,
      // FLAG POR MERCHANT (Parte P), y es la única forma honesta de probar esto: la parcial es
      // documento FISCAL puro y con `INVOICING_ES_ENABLED` off el merchant emite JUSTIFICANTES,
      // así que la ruta rechaza —correctamente— antes de llegar a nada. El override vive en el
      // merchant EFÍMERO del test y muere con él; ningún merchant real se toca (regla 24 intacta).
      {
        name: 'QA S170', email: `qa-s170-${stamp}@test.local`, country: 'ES', taxId: 'B12345678',
        flags: { INVOICING_ES_ENABLED: true },
      },
      async (merchant) => {
        const customer = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Cliente S170' } });
        const job = await prisma.job.create({
          data: {
            merchantId: merchant.id, customerId: customer.id, status: 'en_curso',
            titulo: 'Trabajo S170', tipoOperacion: 'OPERACIONES_SUELTAS',
          },
        });
        const albaran = await prisma.albaran.create({
          data: {
            merchantId: merchant.id, jobId: job.id, numero: `ALB-QA170-${stamp % 100000}`,
            estado: 'firmado', modoValoracion: 'VALORADO', lineas: LINEAS,
          },
        });

        const token = 'qa170-' + crypto.randomBytes(12).toString('hex');
        await prisma.authSession.create({
          data: { merchantId: merchant.id, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
        });
        const verify = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
        const cookie = (verify.headers.get('set-cookie') || '').split(';')[0];
        assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');

        const facturarParcial = (body) => fetch(`${base}/admin/albaranes/${albaran.id}/facturar-parcial`, {
          method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });

        // ── Facturar 4 de las 10 horas ────────────────────────────────────
        const r1 = await facturarParcial({ lineas: [{ index: 0, cantidad: 4 }] });
        const b1 = await r1.json();
        assert.equal(r1.status, 201, `debía emitir; devolvió ${r1.status} ${JSON.stringify(b1)}`);
        assert.equal(b1.estadoFacturacion, 'parcial', 'con 6 h y 4,5 m pendientes, el albarán está a medias');
        assert.equal(b1.pendientes[0].pendiente, 6);
        assert.equal(b1.pendientes[1].pendiente, 4.5);

        // El importe emitido es el de lo facturado, no el del albarán entero.
        const f1 = await prisma.invoice.findUnique({ where: { id: b1.factura.id } });
        assert.equal(Number(f1.total), Number((4 * 28 * 1.21).toFixed(2)),
          '🔴 se ha facturado algo distinto de las 4 horas pedidas');
        assert.equal(f1.lines.length, 1, 'solo entra la línea facturada, no el albarán entero');

        // Y el libro tiene su apunte, que es de donde sale todo lo demás.
        const libro = await prisma.albaranLineaFacturada.findMany({ where: { albaranId: albaran.id } });
        assert.equal(libro.length, 1);
        assert.equal(Number(libro[0].cantidad), 4);
        assert.equal(libro[0].invoiceId, b1.factura.id, 'el apunte tiene que decir QUÉ factura se lo llevó');

        // ── NINGUNA columna de estado ha cambiado (la Parte L sigue intacta) ──
        const tras = await prisma.albaran.findUnique({ where: { id: albaran.id } });
        assert.equal(tras.estado, 'firmado',
            '🔴 el ciclo del DOCUMENTO no se toca al facturar: firmado sigue siendo firmado');
        assert.equal(tras.invoiceId, null,
          '🔴 `invoiceId` marca el albarán facturado ENTERO; una parcial no puede ponerlo, o la ' +
          'consolidación creería que ya está todo cobrado');

        // ── No se puede facturar más de lo que queda ──────────────────────
        const r2 = await facturarParcial({ lineas: [{ index: 0, cantidad: 7 }] });
        assert.equal(r2.status, 409, 'quedan 6 h: pedir 7 tiene que rechazarse');
        assert.equal((await r2.json()).error, 'cantidad_excede_pendiente');
        assert.equal(await prisma.invoice.count({ where: { merchantId: merchant.id } }), 1, 'y no emite nada');

        // ── LA CONSOLIDACIÓN NO PUEDE TRAGARSE UN ALBARÁN A MEDIAS ────────
        const rCons = await fetch(`${base}/admin/jobs/${job.id}/consolidar-albaranes`, {
          method: 'POST', headers: { cookie, 'Content-Type': 'application/json' },
          body: JSON.stringify({ albaranIds: [albaran.id] }),
        });
        assert.equal(rCons.status, 409,
          '🔴 DOBLE FACTURACIÓN: la recapitulativa ha aceptado un albarán con líneas ya facturadas. ' +
          'Un albarán a medias NO lleva `invoiceId`, así que sin el guard entra entero y se cobra dos veces.');
        assert.equal((await rCons.json()).error, 'albaran_facturado_parcial');
        assert.equal(await prisma.invoice.count({ where: { merchantId: merchant.id } }), 1, 'y sigue sin emitir de más');

        // ── Facturar lo que queda → FACTURADO, derivado ───────────────────
        const r3 = await facturarParcial({ lineas: [{ index: 0, cantidad: 6 }, { index: 1, cantidad: 4.5 }] });
        const b3 = await r3.json();
        assert.equal(r3.status, 201, `debía emitir el resto; devolvió ${r3.status} ${JSON.stringify(b3)}`);
        assert.equal(b3.estadoFacturacion, 'facturado', 'sin nada pendiente, el estado derivado es facturado');
        assert.ok(b3.pendientes.every((p) => p.pendiente === 0));

        const finalAlb = await prisma.albaran.findUnique({ where: { id: albaran.id } });
        assert.equal(finalAlb.estado, 'firmado', 'y el documento sigue sin cambiar de estado');

        t.diagnostic(`parcial ${b1.factura.number} + resto ${b3.factura.number} · estado del albarán: ${finalAlb.estado} · cobro derivado: ${b3.estadoFacturacion}`);
      },
    );

    // ── TENANCY (regla 2) ────────────────────────────────────────────────
    await withMerchant(prisma, { name: 'QA S170 A', email: `qa-s170a-${stamp}@test.local` }, async (mA) => {
      await withMerchant(prisma, { name: 'QA S170 B', email: `qa-s170b-${stamp}@test.local` }, async (mB) => {
        const cB = await prisma.customer.create({ data: { merchantId: mB.id, name: 'Cliente B' } });
        const jB = await prisma.job.create({ data: { merchantId: mB.id, customerId: cB.id, status: 'en_curso', titulo: 'B', tipoOperacion: 'OPERACIONES_SUELTAS' } });
        const aB = await prisma.albaran.create({
          data: { merchantId: mB.id, jobId: jB.id, numero: `ALB-QA170B-${stamp % 100000}`, estado: 'firmado', modoValoracion: 'VALORADO', lineas: LINEAS },
        });
        const token = 'qa170a-' + crypto.randomBytes(12).toString('hex');
        await prisma.authSession.create({ data: { merchantId: mA.id, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) } });
        const verify = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
        const cookieA = (verify.headers.get('set-cookie') || '').split(';')[0];

        const res = await fetch(`${base}/admin/albaranes/${aB.id}/facturar-parcial`, {
          method: 'POST', headers: { cookie: cookieA, 'Content-Type': 'application/json' },
          body: JSON.stringify({ lineas: [{ index: 0, cantidad: 1 }] }),
        });
        assert.equal(res.status, 404, '🔴 FUGA MULTI-TENANT: A ha podido facturar un albarán de B');
        assert.equal(await prisma.albaranLineaFacturada.count({ where: { albaranId: aB.id } }), 0, 'y no dejó apunte');
      });
    });
  } finally {
    await new Promise((r) => server.close(r));
    await prisma.$disconnect();
  }
});
