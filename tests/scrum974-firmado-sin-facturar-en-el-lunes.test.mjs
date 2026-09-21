// SCRUM-974 · EL DINERO FIRMADO Y SIN FACTURAR, EN EL CORREO DEL LUNES.
//
// El resumen semanal contaba facturas, presupuestos, clientes y «pendiente de cobro» (dinero YA
// facturado), pero no el trabajo firmado y todavía sin facturar. Ahora lleva un bloque más, con la
// microcopy firmada (docs/microcopy/2026-09-21-SCRUM-974-firmado-sin-facturar.md) y la MISMA
// definición que la bandeja del panel: `getPendientesFacturar`, sin tocarla.
//
// Los cuatro casos, sobre el resumen DE VERDAD (`sendWeeklyDigests`) y leyendo el HTML que sale
// hacia el proveedor —`axios.post` se sustituye y NADA sale de la máquina—:
//   A · facturación encendida, 3 partes de 2 clientes → sale, con el importe con IVA de la bandeja
//   B · MISMO importe, facturación apagada (justificantes, regla 7) → NO sale
//   C · facturación encendida y nada pendiente → NO sale (ausente no es cero)
//   D · 1 parte de 1 cliente → el singular de verdad
//
// ⚠️ GATEADO SOLO AL BANCO DESECHABLE (`LIBRO_PG_URL`), no a staging: `sendWeeklyDigests` recorre
// TODOS los merchants activos de la base, y en staging dejaría filas de envío a nombre de
// profesionales que no son de este test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

const URL_BANCO = process.env.LIBRO_PG_URL || '';
if (URL_BANCO) {
  const p = parseBDSegura(URL_BANCO);
  if (!p || !['127.0.0.1', 'localhost', '::1'].includes(p.host) || !p.base.endsWith('_test')) {
    throw new Error('🔴 LIBRO_PG_URL no es un banco desechable (loopback y base «*_test»). No se toca nada.');
  }
  process.env.DATABASE_URL = URL_BANCO;
}
// ANTES de importar dist: una clave cualquiera para que el correo vaya por `axios.post`, que es
// donde se lee. Es una clave inventada y el POST está sustituido: no hay envío.
process.env.RESEND_API_KEY = 're_test_974_no_sale';
delete process.env.INVOICING_ES_ENABLED; // el interruptor lo decide cada merchant, no el entorno

const SKIP = !URL_BANCO && 'sin LIBRO_PG_URL (banco desechable de CI)';

/** Una línea VALORADA: 100 € de base al 21 % → 121,00 € por parte. */
const LINEA = [{ concepto: 'Mano de obra', cantidad: 1, unidad: 'h', precioUnitario: 100, tipoIva: 21 }];

test('SCRUM-974 · el lunes nombra lo firmado y sin facturar, solo con la facturación encendida', { skip: SKIP }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { sendWeeklyDigests } = await import('../dist/modules/messaging/domain/weeklyDigest.service.js');
  // La instancia CJS de axios: la MISMA que carga dist. La ESM sería otro objeto y el cambio no
  // llegaría al emisor.
  const axios = createRequire(import.meta.url)('axios');
  const postOriginal = axios.post;
  const correos = new Map(); // destinatario → html
  axios.post = async (url, body) => {
    assert.equal(url, 'https://api.resend.com/emails', `SUELO: el correo salía por otro sitio: ${url}`);
    // Resend recibe `to` como LISTA: con la cadena a pelo como clave no se encontraba ninguno.
    for (const to of [].concat(body.to)) correos.set(to, body.html);
    return { data: { id: `re_${crypto.randomBytes(4).toString('hex')}` } };
  };

  const stamp = Date.now();
  const datos = (tag, flags) => ({
    name: `QA 974 ${tag}`, email: `qa-974-${tag}-${stamp}@test.local`, country: 'ES',
    status: 'active', notifyEmailWeeklyDigest: true, ...(flags ? { flags } : {}),
  });
  /** `n` partes firmados, valorados y sin facturar, repartidos entre `clientes` clientes. */
  async function partes(merchantId, n, clientes) {
    const ids = [];
    for (let c = 0; c < clientes; c++) {
      const cli = await prisma.customer.create({ data: { merchantId, name: `Cliente 974 ${c}` } });
      // `OPERACIONES_SUELTAS` a propósito: el defecto de la columna es TRABAJO_UNICO, que la
      // bandeja excluye (se factura al concluir). Con el defecto, el test salía rojo TAMBIÉN con el
      // arreglo puesto: un rojo que no distinguía el defecto del montaje.
      ids.push((await prisma.job.create({ data: { merchantId, customerId: cli.id, status: 'terminado', titulo: `Obra ${c}`, tipoOperacion: 'OPERACIONES_SUELTAS' } })).id);
    }
    for (let i = 0; i < n; i++) {
      await prisma.albaran.create({
        data: {
          merchantId, jobId: ids[i % clientes], numero: `ALB-974-${merchantId}-${i}`, estado: 'firmado',
          modoValoracion: 'VALORADO', lineas: LINEA, firmadoAt: new Date(),
        },
      });
    }
  }
  const ENCENDIDA = { INVOICING_ES_ENABLED: true };

  try {
    await withMerchant(prisma, datos('A', ENCENDIDA), (a) =>
      withMerchant(prisma, datos('B'), (b) =>
        withMerchant(prisma, datos('C', ENCENDIDA), (c) =>
          withMerchant(prisma, datos('D', ENCENDIDA), async (d) => {
            await partes(a.id, 3, 2);
            await partes(b.id, 3, 2);
            await partes(d.id, 1, 1);

            await sendWeeklyDigests();

            // SUELO: el instrumento ve el resumen de los CUATRO — sin esto, «no sale» sería
            // indistinguible de «no he leído el correo».
            for (const m of [a, b, c, d]) {
              assert.ok(correos.get(m.email)?.includes('Resumen semanal'), `SUELO: no se capturó el resumen de ${m.name}`);
            }
            const html = (m) => correos.get(m.email);

            // A · encendida → sale, con el importe con IVA (3 × 121,00)
            assert.ok(html(a).includes('Firmado y sin facturar'), 'A · 🔴 con la facturación encendida, el resumen NO nombra lo firmado y sin facturar');
            assert.ok(html(a).includes('📝 Firmado y sin facturar'), 'A · el título firmado lleva su emoji, como los demás bloques');
            assert.ok(html(a).includes('363,00 EUR'), 'A · 🔴 el importe no es el de la bandeja (3 partes × 121,00 con IVA)');
            assert.ok(html(a).includes('3 partes firmados de 2 clientes'), 'A · el detalle en plural de verdad');

            // B · mismo importe, apagada → no sale
            assert.ok(!html(b).includes('sin facturar'), 'B · 🔴 con la facturación APAGADA el resumen empuja a facturar (regla 7)');
            assert.ok(!html(b).includes('363,00'), 'B · 🔴 el importe de lo firmado sale igual con la facturación apagada');

            // C · nada pendiente → ausente, no cero
            assert.ok(!html(c).includes('sin facturar'), 'C · 🔴 sin nada pendiente sale el bloque (ausente no es cero)');

            // D · singular
            assert.ok(html(d).includes('121,00 EUR'), 'D · el importe de un solo parte');
            assert.ok(html(d).includes('1 parte firmado de 1 cliente'), 'D · el singular de verdad');
          }))));
  } finally {
    axios.post = postOriginal;
    await prisma.$disconnect();
  }
});
