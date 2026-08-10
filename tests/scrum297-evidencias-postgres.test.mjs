// tests/scrum297-evidencias-postgres.test.mjs — SCRUM-297 (A7) · el paquete de evidencias.
//
// El paquete contesta «DEMUESTRA QUE LO QUE DECLARASTE PASÓ», y por eso sus fallos no son de
// formato: un ZIP vacío se entrega a un asesor o a una inspección y **nadie pregunta por qué está
// vacío**. De ahí que el suelo sea EL test de este fichero.
//
// Contra el banco Postgres local (mismo procedimiento que A6/A5, `docs/master/SCRUM-296.md`):
//   LIBRO_PG_URL="postgresql://postgres@127.0.0.1:55432/yaqu_libro_test" node --test <fichero>
//
// El gate no es «si hay URL, adelante»: este test crea y borra filas, así que exige loopback y
// base terminada en `_test`, y si no, FALLA en vez de saltarse.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs';

const URL_BANCO = process.env.LIBRO_PG_URL || '';
const ENABLED = URL_BANCO !== '';
const PROHIBIDAS = ['railway', 'yaqu_dev', 'yaqu_dev_javier', 'postgres', 'staging', 'prod'];
const SELLO = `e${process.pid}`;

function exigirBancoDesechable(url) {
  const p = parseBDSegura(url);
  assert.ok(p, '🔴 LIBRO_PG_URL no es una URL legible.');
  assert.ok(['127.0.0.1', 'localhost', '::1'].includes(p.host), `🔴 «${p.host}» no es loopback.`);
  assert.ok(p.base.endsWith('_test'), `🔴 la base «${p.base}» no termina en «_test».`);
  assert.ok(!PROHIBIDAS.includes(p.base), `🔴 «${p.base}» es una base del proyecto.`);
  return `${p.host}:${p.puerto}/${p.base}`;
}

/** Lee un CSV del paquete como matriz (sin BOM). Sirve para mirar el contenido, no el formato. */
function filasDe(paquete, nombre) {
  const f = paquete.ficheros.find((x) => x.nombre === nombre);
  assert.ok(f, `🔴 el paquete no lleva «${nombre}»`);
  return f.contenido.replace(/^﻿/, '').split('\r\n').map((l) => l.split(';'));
}

const EN_EL_2T = new Date(2026, 4, 12, 10, 0, 0);

test('SCRUM-297 · el paquete de evidencias: suelo, tenencia y los dos controles positivos',
  { skip: !ENABLED && 'sin LIBRO_PG_URL (banco local)' },
  async (t) => {
    t.diagnostic(`banco: ${exigirBancoDesechable(URL_BANCO)}`);
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({ datasourceUrl: URL_BANCO });
    const { leerPaqueteEvidencias } = await import('../dist/modules/fiscal/evidencias/paquete.repo.js');
    const { FICHEROS } = await import('../dist/modules/fiscal/evidencias/paquete.js');
    const { computeAlbaranContentHash } = await import('../dist/modules/jobs/domain/albaran.service.js');

    try {
      await withMerchant(prisma, { name: `QA A7 MIO ${SELLO}`, email: `a7.${SELLO}@qa.invalid`, taxId: 'B00000000' }, async (mio) => {
      await withMerchant(prisma, { name: `QA A7 OTRO ${SELLO}`, email: `a7o.${SELLO}@qa.invalid` }, async (otro) => {

        const cliMio = await prisma.customer.create({ data: { merchantId: mio.id, name: 'Cliente MIO', legalName: 'Cliente MIO SL', phone: `+34677${String(mio.id).padStart(6, '0')}` } });
        const cliOtro = await prisma.customer.create({ data: { merchantId: otro.id, name: 'Cliente OTRO', phone: `+34688${String(otro.id).padStart(6, '0')}` } });

        // ── ASIENTO COMPLETO: presupuesto FIRMADO + albarán firmado + cobro ──────────────────
        const presu = await prisma.quote.create({
          data: {
            merchantId: mio.id, customerId: cliMio.id, total: 121, currency: 'EUR',
            lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 }],
            status: 'accepted', acceptedAt: EN_EL_2T,
            signatureUrl: 'data:image/png;base64,iVBORw0KGgo=',
          },
        });
        const cobro = await prisma.charge.create({
          data: { merchantId: mio.id, customerId: cliMio.id, concept: 'Total', amount: 121, currency: 'EUR', method: 'transfer', status: 'paid' },
        });
        const trabajo = await prisma.job.create({
          data: { merchantId: mio.id, customerId: cliMio.id, titulo: `Obra ${SELLO}`, direccion: 'C/ Mayor 1' },
        });
        const facturaCompleta = await prisma.invoice.create({
          data: {
            merchantId: mio.id, customerId: cliMio.id, number: `2026-CF-${SELLO}-001`,
            total: '121.00', currency: 'EUR', pdfUrl: 'x', qrData: 'x',
            lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 }],
            quoteId: presu.id, chargeId: cobro.id, status: 'paid',
          },
        });
        await prisma.invoice.update({ where: { id: facturaCompleta.id }, data: { createdAt: EN_EL_2T } });

        // El albarán, con su sello CALCULADO CON LA MISMA FUNCIÓN que usa el sellador: si lo
        // pusiera a mano, el verificador diría «no cuadra» y el test mediría mi error, no el suyo.
        const lineasAlb = [{ concepto: 'Mano de obra', cantidad: 1, unidad: 'ud', quoteLineIndex: 0 }];
        const albaran = await prisma.albaran.create({
          data: {
            merchantId: mio.id, jobId: trabajo.id, numero: `ALB-${SELLO}-1`, fecha: EN_EL_2T,
            lineas: lineasAlb, estado: 'firmado', invoiceId: facturaCompleta.id,
          },
        });
        // ⚠️ Los nombres son los del SELLADOR, no los del verificador: `computeAlbaranContentHash`
        // recibe `obra`, y `entradaDesdeFilas` es quien traduce `job.direccion` a esa `obra`. Le
        // pasé `jobDireccion` en el primer intento y el sobre salió `hash_no_coincide` — el test
        // acusaba de manipulado un albarán intacto, que es el peor fallo posible de esta
        // herramienta. Se construye con la firma real de la función, no con los campos que suenan.
        const fuentes = {
          numero: albaran.numero, fecha: albaran.fecha, modoValoracion: albaran.modoValoracion,
          lineas: lineasAlb, notas: null,
          obra: trabajo.direccion, referenciaTrabajo: trabajo.titulo,
          cliente: cliMio.legalName || cliMio.name, emisor: mio.legalName || mio.name, emisorNif: mio.taxId || null,
        };
        await prisma.albaran.update({
          where: { id: albaran.id },
          data: { evidenciaFirma: { v: 1, canal: 'in_situ', hashAlg: 'sha256', contentHash: computeAlbaranContentHash(fuentes) } },
        });
        await prisma.invoice.update({
          where: { id: facturaCompleta.id },
          data: { albaranRefs: [{ albaranId: albaran.id, numero: albaran.numero, fecha: '2026-05-12' }] },
        });

        // ── FACTURA SUELTA (A0.5): sin presupuesto, sin albarán, sin cobro ───────────────────
        const suelta = await prisma.invoice.create({
          data: {
            merchantId: mio.id, customerId: cliMio.id, number: `2026-CF-${SELLO}-002`,
            total: '60.50', currency: 'EUR', pdfUrl: 'x', qrData: 'x',
            lines: [{ concept: 'Reparación', qty: 1, price: 50, tax: 0.21 }],
          },
        });
        await prisma.invoice.update({ where: { id: suelta.id }, data: { createdAt: EN_EL_2T } });

        // ── El OTRO merchant, con documentos del mismo trimestre ────────────────────────────
        const trabajoOtro = await prisma.job.create({ data: { merchantId: otro.id, customerId: cliOtro.id, titulo: 'Obra ajena' } });
        const facturaOtro = await prisma.invoice.create({
          data: { merchantId: otro.id, customerId: cliOtro.id, number: `2026-XX-${SELLO}-001`,
                  total: '999.00', currency: 'EUR', pdfUrl: 'x', qrData: 'x',
                  lines: [{ concept: 'Ajeno', qty: 1, price: 900, tax: 0.21 }] },
        });
        await prisma.invoice.update({ where: { id: facturaOtro.id }, data: { createdAt: EN_EL_2T } });
        await prisma.albaran.create({
          data: { merchantId: otro.id, jobId: trabajoOtro.id, numero: `ALB-AJENO-${SELLO}`, fecha: EN_EL_2T,
                  lineas: [{ concepto: 'Ajeno', cantidad: 1, unidad: 'ud' }], estado: 'firmado',
                  evidenciaFirma: { v: 1, hashAlg: 'sha256', contentHash: 'da' + '0'.repeat(62) } },
        });

        const paquete = await leerPaqueteEvidencias(prisma, { merchantId: mio.id, año: 2026, trimestre: 2 });

        // ══ SUELO — EL test de este ticket ═══════════════════════════════════════════════════
        assert.ok(paquete.resumen.miradas >= 2,
          `🔴 el paquete solo miró ${paquete.resumen.miradas} facturas habiendo dos. Un ZIP vacío ` +
          'se entrega a un asesor o a una inspección y nadie pregunta por qué está vacío.');
        assert.equal(paquete.indice.length, 2,
          `🔴 el índice tiene ${paquete.indice.length} asientos y hay 2 facturas en el trimestre.`);
        assert.ok(paquete.resumen.albaranesExaminados >= 1,
          '🔴 no se examinó ningún albarán firmado: el sello no se habría comprobado y el paquete ' +
          'saldría igual de tranquilizador.');

        // ══ CONTROL NEGATIVO — ni un documento del otro merchant ═════════════════════════════
        const todo = paquete.ficheros.map((f) => f.contenido).join('\n');

        // ⚠️ EL HERMANO POSITIVO PRIMERO (SCRUM-237). Sin él, «no aparece 2026-XX-» daría verde
        // para siempre aunque yo hubiera escrito mal el prefijo al sembrar: una negación sobre un
        // token que no existe en ninguna parte no comprueba nada. Aquí se demuestra que el token
        // ES alcanzable —el paquete del OTRO sí lo lleva— y solo después se exige que no esté en
        // el mío. De paso, el control negativo queda medido en las dos direcciones.
        const paqueteOtro = await leerPaqueteEvidencias(prisma, { merchantId: otro.id, año: 2026, trimestre: 2 });
        const todoOtro = paqueteOtro.ficheros.map((f) => f.contenido).join('\n');
        assert.ok(todoOtro.includes('2026-XX-'),
          '🔴 el paquete del OTRO merchant no lleva ni su propia factura: el token no es alcanzable ' +
          'y la negación de abajo sería un verde permanente.');
        assert.ok(todoOtro.includes('ALB-AJENO-'), '🔴 el paquete del OTRO no lleva ni su propio albarán.');
        assert.ok(!todoOtro.includes(`2026-CF-${SELLO}-`),
          '🔴 el paquete del OTRO merchant lleva facturas MÍAS: la fuga existe en las dos direcciones.');

        assert.ok(!todo.includes('2026-XX-'),
          '🔴 se ha colado una FACTURA del otro merchant en el paquete. En un paquete de ' +
          'cumplimiento eso no es una fuga: es entregar como prueba propia la actividad de un tercero.');
        assert.ok(!todo.includes('ALB-AJENO-'),
          '🔴 se ha colado un ALBARÁN del otro merchant.');
        assert.equal(paquete.resumen.albaranesExaminados, 1,
          '🔴 el verificador ha examinado albaranes que no son de este merchant.');

        // ══ CONTROL POSITIVO ① — el asiento CON sus enlaces los lleva TODOS ═════════════════
        const completa = paquete.indice.find((f) => f.numero.endsWith('-001'));
        assert.ok(completa, '🔴 el asiento completo no está en el índice.');
        assert.equal(completa.presupuestoId, presu.id, '🔴 falta el presupuesto en el índice.');
        assert.equal(completa.presupuestoFirmado, 'true', '🔴 el índice no dice que el presupuesto está FIRMADO.');
        assert.equal(completa.albaranes, albaran.numero, '🔴 falta el albarán en el índice.');
        assert.equal(completa.cobroId, cobro.id, '🔴 falta el cobro en el índice.');
        assert.equal(completa.estadoSello, 'cuadra',
          `🔴 el sello del albarán sale como «${completa.estadoSello}» y está bien calculado con la ` +
          'función del sellador. Un paquete que declara manipulado un documento intacto es peor que ' +
          'no tener verificador.');
        assert.equal(completa.huecos, '', '🔴 un asiento completo no puede tener huecos declarados.');

        // Y la trazabilidad línea a línea (SCRUM-367) viaja dentro.
        const entregas = filasDe(paquete, FICHEROS.entregas);
        assert.equal(entregas[0][2], 'linea_del_presupuesto');
        assert.ok(entregas.slice(1).some((f) => f[0] === albaran.numero && f[2] === '0'),
          '🔴 el paquete no enseña a qué línea del PRESUPUESTO corresponde lo entregado ' +
          '(`quoteLineIndex`): sin eso no se puede demostrar que lo entregado es lo presupuestado.');

        // ══ CONTROL POSITIVO ② — la factura SUELTA sale igual, con sus huecos DECLARADOS ═════
        const sola = paquete.indice.find((f) => f.numero.endsWith('-002'));
        assert.ok(sola,
          '🔴 la factura suelta (A0.5) NO está en el paquete. Es el caso que se olvida, y dejarla ' +
          'fuera convierte el ZIP en una prueba incompleta que se entrega como completa.');
        assert.equal(sola.presupuestoId, null);
        assert.equal(sola.presupuestoFirmado, '',
          '🔴 «no viene de un presupuesto» se está diciendo igual que «viene de uno sin firmar».');
        assert.equal(sola.estadoSello, 'sin_albaranes',
          '🔴 una factura sin albaranes tiene que decirlo, no salir en blanco ni como «cuadra».');
        assert.deepEqual(sola.huecos.split(' ').sort(), ['sin_albaran', 'sin_cobro', 'sin_presupuesto'],
          '🔴 los huecos de la factura suelta no están declarados uno a uno.');
        assert.equal(sola.total, '60,50', '🔴 el importe de la suelta no viaja.');

        // ══ LAS CINCO PIEZAS, Y EL MANIFIESTO QUE LAS SELLA ═════════════════════════════════
        const nombres = paquete.ficheros.map((f) => f.nombre).sort();
        assert.deepEqual(nombres, Object.values(FICHEROS).slice().sort(),
          `🔴 al paquete le falta alguna pieza: tiene ${nombres.join(', ')}.`);

        const manifiesto = JSON.parse(paquete.ficheros.find((f) => f.nombre === FICHEROS.manifiesto).contenido);
        for (const f of paquete.ficheros) {
          if (f.nombre === FICHEROS.manifiesto) continue;
          const entrada = manifiesto.ficheros.find((x) => x.nombre === f.nombre);
          assert.ok(entrada, `🔴 «${f.nombre}» no está en el manifiesto: nadie podría comprobar que no se ha tocado.`);
          assert.equal(entrada.sha256, crypto.createHash('sha256').update(f.contenido, 'utf8').digest('hex'),
            `🔴 el sha256 de «${f.nombre}» no corresponde a su contenido: el manifiesto certificaría algo falso.`);
        }
      });
      });
    } finally {
      await prisma.$disconnect();
    }
  });

test('SCRUM-297 · un sello que NO cuadra se DECLARA: ni se corrige, ni se oculta, ni se deja fuera',
  { skip: !ENABLED && 'sin LIBRO_PG_URL (banco local)' },
  async () => {
    // Es la regla que más importa del ticket: un paquete de cumplimiento que esconde lo que no
    // cuadra es peor que no tenerlo, porque quien lo entrega cree que entrega todo.
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({ datasourceUrl: URL_BANCO });
    const { leerPaqueteEvidencias } = await import('../dist/modules/fiscal/evidencias/paquete.repo.js');
    const { FICHEROS } = await import('../dist/modules/fiscal/evidencias/paquete.js');

    try {
      await withMerchant(prisma, { name: `QA A7 ROTO ${SELLO}`, email: `a7r.${SELLO}@qa.invalid` }, async (m) => {
        const cli = await prisma.customer.create({ data: { merchantId: m.id, name: 'c', phone: `+34699${String(m.id).padStart(6, '0')}` } });
        const job = await prisma.job.create({ data: { merchantId: m.id, customerId: cli.id, titulo: 'Obra' } });
        const inv = await prisma.invoice.create({
          data: { merchantId: m.id, customerId: cli.id, number: `2026-CF-${SELLO}-900`,
                  total: '121.00', currency: 'EUR', pdfUrl: 'x', qrData: 'x',
                  lines: [{ concept: 'x', qty: 1, price: 100, tax: 0.21 }] },
        });
        await prisma.invoice.update({ where: { id: inv.id }, data: { createdAt: EN_EL_2T } });
        // Sello con un hash que NO corresponde al contenido: exactamente lo que el verificador
        // existe para cazar.
        const alb = await prisma.albaran.create({
          data: { merchantId: m.id, jobId: job.id, numero: `ALB-ROTO-${SELLO}`, fecha: EN_EL_2T,
                  lineas: [{ concepto: 'x', cantidad: 1, unidad: 'ud' }], estado: 'firmado',
                  invoiceId: inv.id,
                  evidenciaFirma: { v: 1, hashAlg: 'sha256', contentHash: 'ff' + '0'.repeat(62) } },
        });
        await prisma.invoice.update({
          where: { id: inv.id },
          data: { albaranRefs: [{ albaranId: alb.id, numero: alb.numero, fecha: '2026-05-12' }] },
        });

        const paquete = await leerPaqueteEvidencias(prisma, { merchantId: m.id, año: 2026, trimestre: 2 });
        const fila = paquete.indice.find((f) => f.numero.endsWith('-900'));

        assert.ok(fila, '🔴 la factura del albarán que no cuadra ha DESAPARECIDO del paquete.');
        assert.equal(fila.estadoSello, 'hash_no_coincide',
          `🔴 el índice dice «${fila.estadoSello}» de un sobre que no cuadra. El estado es el valor ` +
          'que ya devuelve el verificador, sin traducir y sin suavizar.');
        assert.ok(paquete.avisos.some((a) => /sin cuadrar/.test(a)),
          '🔴 el paquete no avisa de que hay sellos sin cuadrar: quien lo entrega creería que ' +
          'entrega todo en orden.');

        const verif = filasDe(paquete, FICHEROS.verificacion);
        assert.ok(verif.slice(1).some((f) => f[0] === alb.numero && f[2] === 'no' && f[3] === 'hash_no_coincide'),
          '🔴 el CSV de verificación no lleva el albarán que no cuadra con su motivo.');
        assert.equal(paquete.resumen.albaranesConHallazgo, 1);
      });
    } finally {
      await prisma.$disconnect();
    }
  });
