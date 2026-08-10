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
    const { computeAlbaranContentHash, obraSegunVersion, ALBARAN_CONTENIDO_VERSION_ACTUAL } =
      await import('../dist/modules/jobs/domain/albaran.service.js');
    const { versionesSoportadas } = await import('../dist/modules/jobs/domain/albaranVerificacion.js');

    // ══ SELLAR: LA VERSIÓN QUE SE DECLARA Y LA QUE SE SELLA SON EL MISMO NÚMERO ═══════════════
    //
    // 🔴 ESTE HELPER EXISTE POR UN FALLO REAL, y por eso recibe `version` en vez de dejarla por
    // defecto. La fixture original escribía `{ v: 1, … contentHash: computeAlbaranContentHash(f) }`:
    // DECLARABA v:1 y SELLABA con el defecto del sellador. Mientras v:1 fue la única versión, las
    // dos cosas eran el mismo número y nadie lo notó. El día que SCRUM-300 (C5) subió el defecto a
    // v:2, el sobre pasó a declarar una versión y llevar el hash de otra, el verificador recalculó
    // —bien— con la regla de v:1, y este test se puso rojo en `main` acusando de MANIPULADO a un
    // albarán intacto. El verificador nunca estuvo mal; mentía la fixture.
    //
    // Aquí `version` es un parámetro OBLIGATORIO y de él salen a la vez el `v:` del sobre y el
    // segundo argumento del sellador, así que declarar una y sellar otra ya no se puede escribir
    // sin querer: habría que pasar dos números distintos a propósito.
    //
    // ⚠️ `obra` se resuelve con `obraSegunVersion` y NO se pasa a mano: es el único campo que
    // CAMBIA DE FUENTE entre versiones (v:1 → `Job.direccion`; v:2 → `Albaran.lugarEntrega`), y
    // elegirla a ojo es exactamente el error que ya narra el comentario de más abajo.
    const sellar = (version, fuentes, extra = {}) => ({
      v: version,
      hashAlg: 'sha256',
      ...extra,
      contentHash: computeAlbaranContentHash(
        { ...fuentes, obra: obraSegunVersion(version, fuentes) },
        version,
      ),
    });

    /**
     * ¿POR QUÉ no cuadra este sello? Contesta NOMBRANDO LA VERSIÓN.
     *
     * 🔴 El rojo que precedió a este arreglo decía solo «hash_no_coincide», que es verdad y no
     * sirve: manda a quien lo lee a sospechar del verificador, del contenido o de la fixture, sin
     * distinguir cuál. Localizar que la causa era la VERSIÓN costó reconstruir el razonamiento
     * entero. Un rojo mudo obliga al siguiente a repetir ese trabajo.
     *
     * Así que aquí se prueba el hash guardado contra TODAS las versiones que el verificador sabe
     * recalcular: si alguna lo reproduce y NO es la declarada, la discrepancia está demostrada —no
     * deducida— y se dice con las dos versiones por su número.
     */
    // ⚠️ Se prueba cada versión con las TRES resoluciones posibles de `obra`, no solo con la suya.
    // El fallo histórico sellaba en v:2 pero con la `obra` de v:1 (`Job.direccion` escrita a mano),
    // así que buscar únicamente «v:2 con su propia obra» NO lo habría reproducido y el diagnóstico
    // se habría rendido con un «el contenido no es el que se firmó» — verdad a medias que vuelve a
    // esconder la versión, que es justo lo que hay que dejar de esconder.
    const porQueNoCuadra = (sobre, fuentes) => {
      const encajes = [];
      for (const v of versionesSoportadas()) {
        for (const [deDonde, obra] of [
          ['la columna que manda en esa versión', obraSegunVersion(v, fuentes)],
          ['`Job.direccion` (la fuente de v:1)', fuentes.jobDireccion ?? null],
          ['`Albaran.lugarEntrega` (la fuente de v:2)', fuentes.lugarEntrega ?? null],
        ]) {
          if (computeAlbaranContentHash({ ...fuentes, obra }, v) === sobre.contentHash) {
            encajes.push({ v, deDonde });
          }
        }
      }
      const versiones = [...new Set(encajes.map((e) => e.v))];

      if (versiones.length && !versiones.includes(sobre.v)) {
        return `DISCREPANCIA DE VERSIÓN: el sobre DECLARA v:${sobre.v} pero su contentHash se SELLÓ `
          + `con v:${versiones.join(' o v:')} —tomando «obra» de ${encajes[0].deDonde}—, y el defecto `
          + `del sellador es hoy v:${ALBARAN_CONTENIDO_VERSION_ACTUAL}. El verificador está BIEN: `
          + `recalcula con la regla de la versión que el sobre declara (v:${sobre.v}). Lo que miente `
          + 'es la FIXTURE, que sella con una versión y declara otra. Se arregla en la fixture, '
          + 'JAMÁS relajando el verificador ni el despacho por versión.';
      }
      if (versiones.includes(sobre.v)) {
        return `la versión NO es el problema: el SELLADOR sí reproduce este hash en v:${sobre.v} `
          + `tomando «obra» de ${encajes.find((e) => e.v === sobre.v).deDonde}, y aun así el `
          + 'VERIFICADOR dice que no cuadra. Los dos testigos discrepan sobre el mismo sobre, así '
          + 'que o el contenido que llega al verificador no es el que se selló, o alguien ha tocado '
          + `la receta de v:${sobre.v} —CONGELADA justo para que esto no pase—. Mira el diff de `
          + '`albaranVerificacion.ts` antes que nada.';
      }
      return `el contentHash del sobre v:${sobre.v} no lo reproduce NINGUNA versión soportada `
        + `(v:${versionesSoportadas().join(', v:')}) con ninguna de las dos fuentes de «obra»: `
        + 'aquí no hay discrepancia de versión, el contenido no es el que se firmó.';
    };

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
        //
        // ── ES v:2, LA VERSIÓN QUE SELLA HOY ─────────────────────────────────────────────────
        // Este asiento representa lo que se firma HOY, así que estrena las cuatro columnas de C5
        // (`lugarEntrega`, `fechaEntrega`, `firmadoPorNombre`, `firmadoPorCalidad`). Antes iba en
        // v:1, pero no por decisión: v:1 era la ÚNICA versión que existía cuando se escribió esta
        // fixture. Dejarlo ahí habría dejado el paquete sin ejercitar nunca la versión con la que
        // se firma de verdad — y el propio SCRUM-297 lo declaró como hueco pendiente: «sin caso de
        // sobres v:2 (no existen aún)». El caso de v:1 no se pierde: está más abajo, entero.
        const lineasAlb = [{ concepto: 'Mano de obra', cantidad: 1, unidad: 'ud', quoteLineIndex: 0 }];
        const albaran = await prisma.albaran.create({
          data: {
            merchantId: mio.id, jobId: trabajo.id, numero: `ALB-${SELLO}-1`, fecha: EN_EL_2T,
            lineas: lineasAlb, estado: 'firmado', invoiceId: facturaCompleta.id,
            lugarEntrega: 'C/ de la Obra 7', fechaEntrega: EN_EL_2T,
            firmadoPorNombre: 'Ana Pérez', firmadoPorCalidad: 'encargado_o_personal_de_obra',
          },
        });
        // ⚠️ Los nombres son los del VERIFICADOR (`FuentesContenido`), y `obra` NO se pasa: la
        // resuelve `sellar` con `obraSegunVersion`, que es el único que sabe de qué columna sale
        // en cada versión. En la fixture original iba `obra: trabajo.direccion` escrita a mano y
        // eso ataba el caso a v:1 sin decirlo; con las dos fuentes juntas, el mismo objeto sirve
        // para sellar en cualquier versión y es la versión —no yo— quien elige.
        const fuentes = {
          numero: albaran.numero, fecha: albaran.fecha, modoValoracion: albaran.modoValoracion,
          lineas: lineasAlb, notas: null,
          jobDireccion: trabajo.direccion, lugarEntrega: albaran.lugarEntrega,
          referenciaTrabajo: trabajo.titulo,
          cliente: cliMio.legalName || cliMio.name, emisor: mio.legalName || mio.name, emisorNif: mio.taxId || null,
          fechaEntrega: albaran.fechaEntrega,
          firmadoPorNombre: albaran.firmadoPorNombre, firmadoPorCalidad: albaran.firmadoPorCalidad,
        };
        const sobreV2 = sellar(2, fuentes, { canal: 'in_situ' });
        await prisma.albaran.update({ where: { id: albaran.id }, data: { evidenciaFirma: sobreV2 } });
        await prisma.invoice.update({
          where: { id: facturaCompleta.id },
          data: { albaranRefs: [{ albaranId: albaran.id, numero: albaran.numero, fecha: '2026-05-12' }] },
        });

        // ── ASIENTO v:1 — EL VECTOR CONGELADO, Y POR QUÉ TIENE QUE SEGUIR AQUÍ ───────────────
        //
        // 🔴 Los albaranes firmados antes de C5 llevan sobres v:1 y NO se vuelven a sellar: son
        // la población histórica, y el despacho por versión del verificador existe exactamente
        // para que los dos —v:1 y v:2— sigan verificando a la vez. Un paquete probado solo con la
        // versión de hoy daría verde el día que alguien rompiera la receta de v:1, y el daño no
        // aparecería hasta que alguien fuese a verificar un albarán viejo delante de un tercero:
        // «no coincide» sobre un documento que nadie tocó.
        //
        // Va con su propia factura para no enredarlo con el asiento de arriba: cada versión se
        // afirma por separado y un fallo dice CUÁL de las dos se rompió.
        const facturaV1 = await prisma.invoice.create({
          data: {
            merchantId: mio.id, customerId: cliMio.id, number: `2026-CF-${SELLO}-003`,
            total: '242.00', currency: 'EUR', pdfUrl: 'x', qrData: 'x',
            lines: [{ concept: 'Obra vieja', qty: 1, price: 200, tax: 0.21 }],
          },
        });
        await prisma.invoice.update({ where: { id: facturaV1.id }, data: { createdAt: EN_EL_2T } });
        const lineasAlbV1 = [{ concepto: 'Obra vieja', cantidad: 2, unidad: 'ud' }];
        // ⚠️ SIN `lugarEntrega`: un albarán sellado en v:1 es ANTERIOR a que esa columna existiera.
        // Ponérsela lo volvería un v:1 imposible y el caso dejaría de representar a la población
        // que dice representar. `obra` sale de `Job.direccion`, que es lo que v:1 selló.
        const albaranV1 = await prisma.albaran.create({
          data: {
            merchantId: mio.id, jobId: trabajo.id, numero: `ALB-${SELLO}-V1`, fecha: EN_EL_2T,
            lineas: lineasAlbV1, estado: 'firmado', invoiceId: facturaV1.id,
          },
        });
        const fuentesV1 = {
          numero: albaranV1.numero, fecha: albaranV1.fecha, modoValoracion: albaranV1.modoValoracion,
          lineas: lineasAlbV1, notas: null,
          jobDireccion: trabajo.direccion, lugarEntrega: albaranV1.lugarEntrega,
          referenciaTrabajo: trabajo.titulo,
          cliente: cliMio.legalName || cliMio.name, emisor: mio.legalName || mio.name, emisorNif: mio.taxId || null,
        };
        const sobreV1 = sellar(1, fuentesV1, { canal: 'in_situ' });
        await prisma.albaran.update({ where: { id: albaranV1.id }, data: { evidenciaFirma: sobreV1 } });
        await prisma.invoice.update({
          where: { id: facturaV1.id },
          data: { albaranRefs: [{ albaranId: albaranV1.id, numero: albaranV1.numero, fecha: '2026-05-12' }] },
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
        assert.equal(paquete.indice.length, 3,
          `🔴 el índice tiene ${paquete.indice.length} asientos y hay 3 facturas en el trimestre.`);
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
        assert.equal(paquete.resumen.albaranesExaminados, 2,
          '🔴 el verificador ha examinado un número de albaranes distinto de los DOS de este ' +
          'merchant (el v:2 y el v:1): o se le ha colado uno ajeno, o ha dejado de mirar uno propio.');

        // ══ CONTROL POSITIVO ① — el asiento CON sus enlaces los lleva TODOS ═════════════════
        const completa = paquete.indice.find((f) => f.numero.endsWith('-001'));
        assert.ok(completa, '🔴 el asiento completo no está en el índice.');
        assert.equal(completa.presupuestoId, presu.id, '🔴 falta el presupuesto en el índice.');
        assert.equal(completa.presupuestoFirmado, 'true', '🔴 el índice no dice que el presupuesto está FIRMADO.');
        assert.equal(completa.albaranes, albaran.numero, '🔴 falta el albarán en el índice.');
        assert.equal(completa.cobroId, cobro.id, '🔴 falta el cobro en el índice.');
        assert.equal(completa.estadoSello, 'cuadra',
          `🔴 el sello del albarán v:${sobreV2.v} sale como «${completa.estadoSello}» y está bien ` +
          'calculado con la función del sellador. Un paquete que declara manipulado un documento ' +
          `intacto es peor que no tener verificador.\n   ↳ ${porQueNoCuadra(sobreV2, fuentes)}`);
        assert.equal(completa.huecos, '', '🔴 un asiento completo no puede tener huecos declarados.');

        // ══ CONTROL POSITIVO ①bis — LAS DOS VERSIONES DE SOBRE VERIFICAN A LA VEZ ═══════════
        //
        // Esto es lo que el despacho por versión promete, y hasta aquí no lo comprobaba nadie
        // contra la BD: el paquete convive con la población histórica (v:1) y con la que se firma
        // hoy (v:2), y las DOS cuadran. Si un día se rompe la receta de v:1, el rojo sale aquí y
        // en el commit que la toca, no años después delante de un tercero.
        const asientoV1 = paquete.indice.find((f) => f.numero.endsWith('-003'));
        assert.ok(asientoV1, '🔴 el asiento del albarán v:1 no está en el índice.');
        assert.equal(asientoV1.estadoSello, 'cuadra',
          `🔴 el sello v:${sobreV1.v} sale como «${asientoV1.estadoSello}». Los sobres v:1 son los ` +
          'albaranes YA FIRMADOS antes de C5: declararlos manipulados es acusar de falsificación a ' +
          `documentos que nadie tocó.\n   ↳ ${porQueNoCuadra(sobreV1, fuentesV1)}`);
        assert.equal(paquete.resumen.albaranesQueCuadran, 2,
          `🔴 cuadran ${paquete.resumen.albaranesQueCuadran} de 2 sobres (uno v:1 y uno v:2).`);
        assert.equal(paquete.resumen.albaranesConHallazgo, 0,
          '🔴 hay hallazgos sobre dos albaranes intactos.');

        // Y el CSV lo enseña POR VERSIÓN: que las dos poblaciones están de verdad en el paquete no
        // se deduce del resumen —dos que cuadran podrían ser dos v:2—, se lee en la columna.
        const verificacion = filasDe(paquete, FICHEROS.verificacion);
        assert.equal(verificacion[0][1], 'version_sobre');
        const versionDe = (numero) => (verificacion.slice(1).find((f) => f[0] === numero) || [])[1];
        assert.equal(versionDe(albaran.numero), '2', `🔴 el CSV no declara v:2 en ${albaran.numero}.`);
        assert.equal(versionDe(albaranV1.numero), '1',
          `🔴 el CSV no declara v:1 en ${albaranV1.numero}: sin esta columna, «dos sobres cuadran» ` +
          'no distingue dos versiones de la misma repetida, y la retrocompatibilidad quedaría sin probar.');

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
