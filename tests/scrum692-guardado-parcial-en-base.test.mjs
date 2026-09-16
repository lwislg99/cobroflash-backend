// tests/scrum692-guardado-parcial-en-base.test.mjs — SCRUM-692
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL VIAJE COMPLETO: guardar desde la ficha 360 NO borra lo que sólo vive en el modal
//
// El fichero de al lado (`scrum692-un-formulario-no-borra-lo-que-no-muestra`) vigila el CONTRATO
// —que ningún formulario envíe lo que no muestra— y corre en cada tanda. Éste comprueba el otro
// eslabón, el que necesita base de datos: que el camino entero **escribe lo que dice escribir y
// no toca lo demás**.
//
// Son las dos mitades de la misma propiedad, y ninguna sustituye a la otra:
//   · el contrato puede estar bien y `updateCustomer` rellenar el objeto por su cuenta;
//   · el viaje puede estar bien hoy y romperse mañana con un `?? null` en el front.
//
// 🔴 HOY EL GUARDADO PARCIAL ES CIERTO POR ACCIDENTE: sale de que `customerUpdateSchema` sea un
// `.partial()` de Zod y de que Prisma no toque lo que no recibe. Nadie lo decidió y nada lo
// declaraba. Este fichero lo convierte en una propiedad exigida.
//
// GATE: necesita base de datos. Dos destinos (SCRUM-876):
//   `QA_DB_TEST=1 npm run test:staging:gated`            → staging, por `_staging-db.mjs` (igual que antes)
//   `LIBRO_PG_URL=<banco loopback, base *_test> npm test` → el banco desechable que CI levanta para la tanda
import test from 'node:test';
import assert from 'node:assert/strict';
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging con QA_DB_TEST=1 (fail-closed anti-prod)
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

// SCRUM-876 · el segundo destino NO afloja el primero: con `QA_DB_TEST=1` manda staging y esta
// variable ni se lee. Fail-closed: una URL que no sea loopback + `*_test` hace FALLAR el fichero,
// no saltarlo. Nunca se imprime la URL (SCRUM-226).
const URL_BANCO = process.env.QA_DB_TEST === '1' ? '' : (process.env.LIBRO_PG_URL || '');
if (URL_BANCO) {
  const p = parseBDSegura(URL_BANCO);
  if (!p || !['127.0.0.1', 'localhost', '::1'].includes(p.host) || !p.base.endsWith('_test')) {
    throw new Error('🔴 LIBRO_PG_URL no es un banco desechable (loopback y base «*_test»). No se toca nada.');
  }
  process.env.DATABASE_URL = URL_BANCO;
}
const ENABLED = process.env.QA_DB_TEST === '1' || URL_BANCO !== '';

test('SCRUM-692 · guardar desde la ficha 360 no borra lo que sólo vive en el modal',
  { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async (t) => {
    const { createCustomer, getCustomer, updateCustomer } =
      await import('../dist/modules/system/customerAdmin.js');
    const { customerUpdateSchema } = await import('../dist/core/validation/schemas.js');
    const { prisma } = await import('../dist/core/db/prisma.js');

    const DIRECCION = 'Calle Mayor 3, 2 izq';
    const REFERENCIA = 'EXP-QA692-' + Date.now();

    try {
      // Merchant inventado, NO el demo (SCRUM-409): ahí WhatsApp, el PDF y la pasarela se comportan
      // distinto y un fixture en el demo desactiva comprobaciones sin tocar ningún guard.
      // SCRUM-876 · y ahora lo es de verdad: aquí ponía `MERCHANT = 1` —el demo que SCRUM-42 quemó—
      // y sobre una base recién creada `createCustomer` moría en `customers_merchant_id_fkey`.
      // El cliente lo borra `withMerchant` al salir, también si un assert revienta a mitad.
      await withMerchant(prisma, { name: 'QA SCRUM-692', email: `qa-scrum692-${Date.now()}@test.local` }, async (merchant) => {
      const MERCHANT = merchant.id;
      const cliente = await createCustomer(MERCHANT, {
        name: 'QA SCRUM-692 ' + Date.now(),
        billingAddress: DIRECCION, billingCity: 'Bilbao', billingPostalCode: '48001',
        billingProvince: 'Bizkaia', billingCountry: 'ES',
        internalRef: REFERENCIA,
        billingPeriodicity: 'MENSUAL',
      });

      // ── SUELO ────────────────────────────────────────────────────────────────────────
      // Si la lectura no ve los valores AQUÍ, tampoco los vería después y «no se han borrado»
      // sería cierto por ceguera. Va delante a propósito.
      const antes = await getCustomer(MERCHANT, cliente.id);
      assert.equal(antes.billingAddress, DIRECCION,
        '🔴 SUELO: la lectura no ve la dirección ANTES de guardar. El instrumento no mide nada, y ' +
        'todo lo de abajo sería un verde vacío.');
      assert.equal(antes.internalRef, REFERENCIA, '🔴 SUELO: la lectura no ve la referencia.');
      assert.equal(antes.billingPeriodicity, 'MENSUAL', '🔴 SUELO: no ve la periodicidad.');

      // ── EL PAYLOAD EXACTO DE LA FICHA 360 ────────────────────────────────────────────
      // Copiado de `customerDetailView.js`: no incluye billing*, internalRef ni recargo.
      const payload360 = customerUpdateSchema.parse({
        name: antes.name,
        notes: undefined,
        legalName: 'Razón Social QA',
        taxId: null,
        tipoDestinatario: null,
        contactKind: null,
        billingPeriodicity: 'NINGUNA',
        waOptOut: true,
      });
      assert.ok(!('billingAddress' in payload360),
        '🔴 el payload de la ficha 360 ya lleva `billingAddress`: el contrato se ha roto y este ' +
        'test estaría midiendo otra cosa. Lo vigila el fichero sin gate de al lado.');

      await updateCustomer(MERCHANT, cliente.id, payload360);
      const despues = await getCustomer(MERCHANT, cliente.id);

      // ── LO QUE NO SE TOCA ────────────────────────────────────────────────────────────
      assert.equal(despues.billingAddress, DIRECCION,
        '🔴 GUARDAR DESDE LA FICHA 360 HA BORRADO LA DIRECCIÓN DE FACTURACIÓN.\n' +
        '   El profesional la escribió en el modal y la ficha 360 no la muestra siquiera. No hay ' +
        'error ni aviso: lo descubre semanas después al abrir el cliente. Post-SIF ese dato es el ' +
        'domicilio del destinatario de una factura.');
      assert.equal(despues.billingCity, 'Bilbao', '🔴 se ha borrado `billingCity`.');
      assert.equal(despues.billingPostalCode, '48001', '🔴 se ha borrado `billingPostalCode`.');
      assert.equal(despues.internalRef, REFERENCIA,
        '🔴 GUARDAR DESDE LA FICHA 360 HA BORRADO LA REFERENCIA INTERNA — el nº con el que el ' +
        'profesional conoce a ese cliente, y por el que lo busca.');

      // ── CONTROL POSITIVO: lo que la ficha SÍ muestra, SÍ cambia ──────────────────────
      // Es el que descarta «no borra porque no guarda nada». Sin él, un `updateCustomer` que no
      // hiciera absolutamente nada pasaría todo lo de arriba.
      assert.equal(despues.legalName, 'Razón Social QA',
        '🔴 CONTROL POSITIVO ROTO: la ficha 360 no ha guardado un campo que SÍ muestra. Entonces ' +
        '«no ha borrado la dirección» no significa nada: no ha guardado nada.');
      assert.equal(despues.waOptOut, true, '🔴 CONTROL POSITIVO: `waOptOut` no ha cambiado.');
      assert.equal(despues.billingPeriodicity, 'NINGUNA',
        '🔴 CONTROL POSITIVO: `billingPeriodicity` no ha cambiado, y la ficha 360 es el ÚNICO ' +
        'sitio donde se edita.');

      // ── Y VACIAR A PROPÓSITO SIGUE FUNCIONANDO ───────────────────────────────────────
      // «Parcial» no puede significar «ya no se puede borrar nada»: el profesional tiene que poder
      // quitar un dato que puso mal, desde el formulario que sí lo muestra.
      await updateCustomer(MERCHANT, cliente.id,
        customerUpdateSchema.parse({ internalRef: null, billingAddress: null }));
      const vaciado = await getCustomer(MERCHANT, cliente.id);
      assert.equal(vaciado.internalRef, null,
        '🔴 NO SE PUEDE VACIAR la referencia a propósito. «Guardado parcial» se ha convertido en ' +
        '«ya no se puede borrar nada», y el profesional se queda con un dato mal puesto para siempre.');
      assert.equal(vaciado.billingAddress, null, '🔴 no se puede vaciar la dirección a propósito.');
      // Y vaciar ESOS no ha tocado lo de al lado.
      assert.equal(vaciado.billingCity, 'Bilbao',
        '🔴 vaciar dos campos ha borrado un tercero que no se mandó.');
      });
    } finally {
      await prisma.$disconnect();
    }
  });
