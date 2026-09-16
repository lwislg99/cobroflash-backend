// tests/scrum728-serie-ocupada-postgres.test.mjs — SCRUM-728
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LO QUE VE EL SEXTO PROFESIONAL CUANDO EL CERROJO DE SERIE SE SATURA.
//
// El cerrojo serializa la reserva de número —correcto, y no se toca—, pero serializar cuesta:
// **~880 ms por reserva contra base remota** (5 viajes × 175 ms de RTT) y el `timeout` por defecto
// de Prisma es **5000 ms**. 5000 ÷ 880 = **5,7**: a partir de la sexta creación simultánea del
// mismo merchant, la que espera revienta con `P2028`.
//
// Antes de este ticket eso salía como `500 {"error":"internal_error"}`, y el panel lo pintaba
// literalmente **«No se pudo crear el albarán: API 500: internal_error»**. Un identificador
// interno en la cara de un fontanero.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ LA CARRERA DE 6 NO BASTA EN LOOPBACK, Y VA ESCRITO ANTES DE MEDIR
//
// El defecto es de LATENCIA. En loopback una reserva cuesta ~100 ms, no 880, así que seis caben
// de sobra en los 5 s y **no fallan**. Publicar ese verde como «no se reproduce» sería el falso
// negativo de siempre. Así que se hacen las dos cosas: la carrera de 6 —que MIDE el coste local y
// demuestra por qué no basta— y la espera real del cerrojo, retenido por otra sesión más de 5 s,
// que es EXACTAMENTE donde SCRUM-728 capturó el P2028 («el fallo ocurre dentro de `$executeRaw`»).
//
// ⚠️ Y un detalle que costó una vuelta: el `timeout` de Prisma marca la transacción como expirada,
// pero `pg_advisory_xact_lock` sigue esperando EN POSTGRES hasta que alguien suelte. El P2028 no
// salta al vencer: salta cuando la consulta VUELVE. Por eso el cerrojo se suelta por RELOJ y no
// cuando termine la petición — la primera versión hizo lo segundo y se abrazaron.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// CÓMO SE CORRE (banco local desechable, NUNCA una base del proyecto)
//
//   SERIE_PG_URL=<la URL del banco desechable>  node --test tests/scrum728-serie-ocupada-postgres.test.mjs
//
// La URL va por entorno y NO se escribe aquí — ni real ni de ejemplo. Loopback y base terminada
// en `_test`; si no lo cumple, este test NO se salta: falla. Este banco CREA DOCUMENTOS.
//
// ⛔ No se sube el timeout, no se toca el cerrojo, no se renumera nada (regla 29).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';

const URL_BANCO = process.env.SERIE_PG_URL || '';
const ENABLED = URL_BANCO !== '';
const PROHIBIDAS = ['railway', 'yaqu_dev', 'yaqu_dev_javier', 'postgres', 'staging', 'prod'];

/** Fail-closed. Nunca imprime la URL: su mensaje llevaría la contraseña dentro (SCRUM-226). */
function exigirBancoDesechable(url) {
  const p = parseBDSegura(url);
  assert.ok(p, '🔴 SERIE_PG_URL no es una URL legible. No se toca nada.');
  assert.ok(['127.0.0.1', 'localhost', '::1'].includes(p.host),
    `🔴 SERIE_PG_URL apunta a «${p.host}», que no es loopback. Este test CREA DOCUMENTOS.`);
  assert.ok(p.base.endsWith('_test'),
    `🔴 la base «${p.base}» no termina en «_test». Es la única forma de garantizar por la FORMA `
    + 'del nombre —no por la buena intención de quien lanza el test— que no es una base del proyecto.');
  assert.ok(!PROHIBIDAS.includes(p.base), `🔴 la base «${p.base}» está en la lista de prohibidas.`);
}

let prisma;
let SERIE_LOCK_NS;
let handler;
let ERROR_CERROJO_SATURADO;
let COPY_CERROJO_SATURADO;

async function cargar() {
  process.env.DATABASE_URL = URL_BANCO;
  ({ prisma } = await import(DIST + 'core/db/prisma.js'));
  ({ SERIE_LOCK_NS } = await import(DIST + 'modules/invoicing/domain/invoiceNumber.service.js'));
  ({ ERROR_CERROJO_SATURADO, COPY_CERROJO_SATURADO } = await import(DIST + 'modules/invoicing/domain/cerrojoSaturado.js'));
  const mod = await import(DIST + 'modules/jobs/app/routes/jobs.routes.js');
  const router = mod.default?.default ?? mod.default;
  const capa = router?.stack?.find((c) => c.route && c.route.path === '/:id/albaranes' && c.route.methods.post);
  assert.ok(capa, '🔴 NO ENCUENTRO `POST /:id/albaranes`. El código se ha movido, que es un dato '
    + 'DISTINTO de «el defecto no existe».');
  handler = capa.route.stack.map((s) => s.handle).pop();
}

/** Una petición al handler real, con `req`/`res` de juguete. */
function pedir(jobId, merchantId) {
  const res = { code: 200, cuerpo: null };
  res.status = (c) => { res.code = c; return res; };
  res.json = (b) => { res.cuerpo = b; return res; };
  res.send = (b) => { res.cuerpo = b; return res; };
  const req = {
    params: { id: String(jobId) }, merchantId, teamMemberId: null, query: {},
    body: { modoValoracion: 'SIN_VALORAR', notas: 'sonda 728' },
  };
  return handler(req, res, (e) => { throw e; })
    .then(() => ({ code: res.code, cuerpo: res.cuerpo }))
    .catch((e) => ({ code: 'EXCEPCION SIN CAPTURAR', cuerpo: { name: e.name, code: e.code } }));
}

const escenario = async (merchant) => {
  const cliente = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Pepe' } });
  const job = await prisma.job.create({
    data: { merchantId: merchant.id, customerId: cliente.id, status: 'en_curso' },
  });
  return job;
};
const albaranesDe = (merchantId) => prisma.albaran.findMany({
  where: { merchantId }, orderBy: { id: 'asc' }, select: { id: true, numero: true },
});
const contadorDe = async (merchantId) => (await prisma.merchant.findUnique({
  where: { id: merchantId }, select: { nextAlbaranNumber: true },
})).nextAlbaranNumber;

/**
 * Retiene el MISMO cerrojo que toma la reserva, durante `ms`, desde otra transacción.
 * No se toca el cerrojo del producto: se usa igual que lo usa él.
 */
function retenerCerrojo(merchantId, ms) {
  let soltar;
  const hasta = new Promise((r) => { soltar = r; });
  const tx = prisma.$transaction(async (t) => {
    await t.$executeRaw`SELECT pg_advisory_xact_lock(${SERIE_LOCK_NS}::int, ${merchantId}::int)`;
    await hasta;
  }, { timeout: ms + 15_000, maxWait: ms + 15_000 });
  // 🔴 POR RELOJ, no cuando termine la petición: el P2028 no salta al vencer el timeout, salta
  // cuando `pg_advisory_xact_lock` VUELVE — y no vuelve hasta que esto suelte.
  setTimeout(soltar, ms);
  return tx.catch(() => {});
}

test('SCRUM-728 · el aviso del cerrojo saturado', { skip: ENABLED ? false : 'sin SERIE_PG_URL' }, async (t) => {
  exigirBancoDesechable(URL_BANCO);
  await cargar();

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // § 0 · SUELO — si una petición normal ya falla, todo lo de abajo mide el vacío
  // ═══════════════════════════════════════════════════════════════════════════════════════
  await t.test('🔴 SUELO: una petición sola crea su albarán', async () => {
    await withMerchant(prisma, { name: 'Tecnosel', taxId: 'B1', email: 's0728@t.test' }, async (m) => {
      const job = await escenario(m);
      const r = await pedir(job.id, m.id);
      assert.equal(r.code, 201, `🔴 la petición normal ya falla: ${JSON.stringify(r.cuerpo)}`);
      assert.equal((await albaranesDe(m.id)).length, 1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // § 1 · LA CARRERA DE 6 — y por qué en loopback no basta
  // ═══════════════════════════════════════════════════════════════════════════════════════
  await t.test('📌 seis simultáneas SÍ caben en loopback — el defecto es de LATENCIA', async () => {
    await withMerchant(prisma, { name: 'Tecnosel', taxId: 'B1', email: 's1728@t.test' }, async (m) => {
      const job = await escenario(m);
      const t0 = Date.now();
      const seis = await Promise.all(Array.from({ length: 6 }, () => pedir(job.id, m.id)));
      const porReserva = (Date.now() - t0) / 6;

      assert.equal(seis.filter((r) => r.code === 201).length, 6,
        `🔴 alguna de las seis ha fallado en loopback: ${JSON.stringify(seis.filter((r) => r.code !== 201))}`);
      assert.ok(porReserva < 500,
        `🔴 una reserva cuesta ${porReserva.toFixed(0)} ms en LOOPBACK. Si aquí ya se acerca a los `
        + '880 ms de la base remota, este banco no está midiendo lo que dice medir.');

      // 🔴 Y LOS SEIS NÚMEROS SON DISTINTOS: el cerrojo hace su trabajo. Si esto cayera, el
      // arreglo del aviso estaría tapando un defecto MUCHO peor que un mensaje feo.
      const numeros = (await albaranesDe(m.id)).map((a) => a.numero);
      assert.equal(numeros.length, 6, `🔴 han salido ${numeros.length} albaranes de 6 peticiones`);
      assert.equal(new Set(numeros).size, 6,
        `🔴 NÚMERO DE SERIE DUPLICADO: ${JSON.stringify(numeros)}. El cerrojo ha dejado de serializar.`);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // § 2 · 🔴 EL QUE DECIDE — el cerrojo retenido, y lo que sale por la respuesta
  // ═══════════════════════════════════════════════════════════════════════════════════════
  await t.test('🔴 con el cerrojo retenido >5 s, la respuesta es LEGIBLE y no un `internal_error`', async () => {
    await withMerchant(prisma, { name: 'Tecnosel', taxId: 'B1', email: 's2728@t.test' }, async (m) => {
      const job = await escenario(m);
      const contadorAntes = await contadorDe(m.id);
      const retenedor = retenerCerrojo(m.id, 7000);
      await new Promise((r) => setTimeout(r, 400));   // que lo tome antes de pedir

      const r = await pedir(job.id, m.id);
      await retenedor;

      assert.notEqual(r.code, 'EXCEPCION SIN CAPTURAR',
        '🔴 la excepción sale del handler sin capturar: reventaría la pantalla.');
      assert.equal(r.code, 503,
        `🔴 sale ${r.code} ${JSON.stringify(r.cuerpo)}. Antes de este ticket salía `
        + '`500 {"error":"internal_error"}` y el panel pintaba «No se pudo crear el albarán: API '
        + '500: internal_error» — un identificador interno en la cara de un fontanero.');
      assert.equal(r.cuerpo.error, ERROR_CERROJO_SATURADO);
      assert.equal(r.cuerpo.message, COPY_CERROJO_SATURADO,
        '🔴 el texto no es el APROBADO. Es microcopy oficial (firmada el 8-sep-2026, registro en '
        + '`docs/microcopy/2026-09-08-SCRUM-728-serie-ocupada.md`): si hace falta otro, se firma otro.');
      // 🔴 NO ES UNA NEGACION SUELTA (SCRUM-237): «no aparece jerga» seria verde para siempre si el
      // detector estuviera roto. El hermano positivo demuestra que ESE MISMO detector reconoce la
      // jerga cuando la hay — y la hay: el texto crudo de Prisma que este arreglo deja de enseñar.
      const JERGA = /P2028|Transaction|timeout|prisma/i;
      const CRUDO_DE_PRISMA = 'Transaction already closed: … The timeout for this transaction was 5000 ms';
      assert.ok(JERGA.test(CRUDO_DE_PRISMA),
        '🔴 el detector de jerga no reconoce ni el texto crudo de Prisma: no detecta nada.');
      assert.ok(!JERGA.test(JSON.stringify(r.cuerpo)),
        `🔴 el cuerpo lleva jerga del ORM: ${JSON.stringify(r.cuerpo)}`);

      // ✅ NEGATIVO · el documento NO se crea a medias, y el número NO se consume.
      assert.equal((await albaranesDe(m.id)).length, 0,
        '🔴 se ha creado un albarán a medias pese al fallo.');
      assert.equal(await contadorDe(m.id), contadorAntes,
        '🔴 el contador de serie se ha movido sin emitir nada: el siguiente documento saltaría un '
        + 'número y ese hueco hay que justificarlo ante Hacienda.');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // § 3 · ✅ NEGATIVO — el reintento sale, y sale UNO
  // ═══════════════════════════════════════════════════════════════════════════════════════
  await t.test('✅ el reintento crea UNO, no dos, y con el número que tocaba', async () => {
    await withMerchant(prisma, { name: 'Tecnosel', taxId: 'B1', email: 's3728@t.test' }, async (m) => {
      const job = await escenario(m);
      const contadorAntes = await contadorDe(m.id);

      const retenedor = retenerCerrojo(m.id, 7000);
      await new Promise((r) => setTimeout(r, 400));
      const fallida = await pedir(job.id, m.id);
      await retenedor;
      assert.equal(fallida.code, 503, '🔴 la primera no ha fallado como se esperaba');

      // El profesional hace lo que el mensaje le dice: reintentar.
      const reintento = await pedir(job.id, m.id);
      assert.equal(reintento.code, 201,
        `🔴 el reintento tampoco sale: ${JSON.stringify(reintento.cuerpo)}. El mensaje le estaría `
        + 'pidiendo que repita algo que nunca va a funcionar.');

      const alb = await albaranesDe(m.id);
      assert.equal(alb.length, 1,
        `🔴 han quedado ${alb.length} albaranes tras un fallo y un reintento. Tiene que salir UNO: `
        + 'si la primera hubiera dejado algo a medias, el profesional acabaría con dos documentos.');
      assert.equal(await contadorDe(m.id), contadorAntes + 1,
        '🔴 el contador ha avanzado más de un número: el fallo consumió serie.');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // § 4 · ✅ CONTROL POSITIVO — un fallo DISTINTO no se disfraza de éste
  // ═══════════════════════════════════════════════════════════════════════════════════════
  await t.test('✅ POSITIVO: un fallo que NO es el del cerrojo sigue saliendo como suyo', async () => {
    await withMerchant(prisma, { name: 'Tecnosel', taxId: 'B1', email: 's4728@t.test' }, async (m) => {
      // Un trabajo que no es de este merchant: 404 propio, nada que ver con la cola.
      const r = await pedir(999_999_999, m.id);
      assert.equal(r.code, 404,
        `🔴 sale ${r.code} ${JSON.stringify(r.cuerpo)} en vez de 404. Si el arreglo tapara por `
        + 'estado o por «cualquier error», habríamos cambiado un error técnico por una mentira '
        + 'amable: el profesional reintentaría diez veces algo que nunca va a salir.');
      assert.notEqual(r.cuerpo?.error, ERROR_CERROJO_SATURADO);
      assert.notEqual(r.cuerpo?.message, COPY_CERROJO_SATURADO);
    });
  });
});
