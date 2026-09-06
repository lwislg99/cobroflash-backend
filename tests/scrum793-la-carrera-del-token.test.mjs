// tests/scrum793-la-carrera-del-token.test.mjs — SCRUM-793
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL GUARD DETERMINISTA QUE AYER NO SE PUDO ESCRIBIR
//
// SCRUM-767 midió la carrera de `ensurePortalToken` y dejó escrito por qué NO la asertaba:
//
//   «una aserción sobre eso sería INESTABLE —una de las cinco pasadas no llegó a entrelazarse—
//    y un test intermitente no es un guard: es ruido que un día alguien apaga porque falla solo.
//    El guard determinista nace el día que se arregle.»
//
// **Hoy es ese día.** Con la condición dentro del `WHERE`, la invariante deja de ser
// intermitente y pasa a cumplirse SIEMPRE:
//
//   🔴 diez curaciones simultáneas devuelven UN SOLO token, y ese token ESTÁ en la base.
//
// Antes eso era falso 3 de cada 3 veces; ahora es cierto 3 de cada 3. Lo que cambió no es la
// suerte: es que la comprobación «¿sigue vacío?» viaja DENTRO de la sentencia que escribe, así
// que el motor la serializa. Un `if` de JavaScript entre el SELECT y el UPDATE no serializa nada.
//
// ── EL EXPERIMENTO, ANTES Y DESPUÉS (mismo script, sin tocar una línea) ─────────────────
//
//   DOS a la vez, pasadas con un enlace MUERTO ..... antes 4/5  →  después 0/5
//   DIEZ a la vez, pasadas con carrera visible ..... antes 3/3  →  después 0/3
//   DIEZ a la vez, tokens distintos ................ antes hasta 10  →  después 1, siempre
//
// ⛔ SÓLO `yaqu_dev_javier`: se niega a arrancar si la clave apunta a otro sitio. ESCRIBE — crea
//    merchants y clientes de usar y tirar, y los borra.
//
// ⚠️ Vive APARTE del trinquete por AST (`scrum793-condicion-en-el-where.test.mjs`) por algo
//    MEDIDO en SCRUM-767: censos rápidos y gateados lentos en el mismo fichero hacen que
//    `--test-force-exit` cancele los gateados.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url'; // NUNCA `.pathname`: no decodifica

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const GATE = process.env.QA_DB_TEST === '1';

let prismaDev = null;
let cliente = null;
if (GATE) {
  const { PrismaClient } = await import(pathToFileURL(RAIZ + '/node_modules/@prisma/client/default.js').href);
  const { parseBDSegura } = await import(pathToFileURL(RAIZ + '/scripts/_db-guard.mjs').href);
  const linea = fs.readFileSync(path.join(RAIZ, '.env'), 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL_DEV='));
  const url = linea?.slice('DATABASE_URL_DEV='.length).trim().replace(/^["']|["']$/g, '');
  const info = url ? parseBDSegura(url) : null;
  assert.ok(info && info.base === 'yaqu_dev_javier',
    '🔴 PARO: este test ESCRIBE y la clave de desarrollo no apunta a `yaqu_dev_javier`.');
  prismaDev = new PrismaClient({ datasources: { db: { url } } });
  // El doble ANTES del import: `customerAdmin` usa el singleton de `core/db/prisma`, que resuelve
  // `DATABASE_URL` — variable que en este árbol NO existe (sólo `_DEV`/`_STAGING`/`_TESTS`).
  globalThis.prisma = prismaDev;
  cliente = await import(pathToFileURL(RAIZ + '/dist/modules/system/customerAdmin.js').href);
}

async function conMerchant(fn) {
  const m = await prismaDev.merchant.create({
    data: {
      name: `QA-793-${process.pid}-${Date.now()}`,
      email: `qa-793-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`,
      country: 'ES',
    },
    select: { id: true },
  });
  try { return await fn(m); } finally {
    await prismaDev.customer.deleteMany({ where: { merchantId: m.id } }).catch(() => {});
    await prismaDev.merchant.delete({ where: { id: m.id } }).catch(() => {});
  }
}
/** Un cliente SIN token — como lo dejan el sembrador y los dos caminos de producción. */
const sinToken = (mid) => prismaDev.customer
  .create({ data: { merchantId: mid, name: 'QA-793' }, select: { id: true, portalToken: true } });
const enBase = (id) => prismaDev.customer
  .findUnique({ where: { id }, select: { portalToken: true } }).then((x) => x?.portalToken ?? null);

test('SCRUM-793 · SUELO: el cliente del experimento NACE sin token', { skip: !GATE && 'sin QA_DB_TEST=1 · necesita Postgres real: la condición que se prueba vive en el WHERE de un UPDATE' }, async () => {
  await conMerchant(async (m) => {
    const c = await sinToken(m.id);
    assert.equal(c.portalToken, null,
      '🔴 el cliente ya nace con token: entonces no hay carrera que provocar y todo lo de abajo '
      + 'estaría verde midiendo el caso equivocado.');
  });
});

test('SCRUM-793 · 🔴 EL QUE DECIDE: DIEZ curaciones a la vez → UN token, y está en la base', { skip: !GATE && 'sin QA_DB_TEST=1 · necesita Postgres real: la condición que se prueba vive en el WHERE de un UPDATE' }, async () => {
  // Tres rondas: con el defecto puesto, las tres fallaban. No es para «darle oportunidades», es
  // para que un verde no dependa de que una ronda no llegara a entrelazarse.
  for (let ronda = 1; ronda <= 3; ronda += 1) {
    await conMerchant(async (m) => {
      const c = await sinToken(m.id);
      const ts = await Promise.all(Array.from({ length: 10 }, () => cliente.ensurePortalToken(m.id, c.id)));
      const base = await enBase(c.id);
      const distintos = [...new Set(ts)];

      assert.equal(
        distintos.length, 1,
        `🔴 RONDA ${ronda}: diez curaciones simultáneas han devuelto ${distintos.length} tokens `
          + 'DISTINTOS. Sólo uno puede estar en la base: los demás son enlaces de portal MUERTOS '
          + 'que el profesional copia y manda a su cliente por WhatsApp sin que nada avise.',
      );
      assert.equal(
        distintos[0], base,
        `🔴 RONDA ${ronda}: las diez devolvieron ${distintos[0]} y en la base hay ${base}. Un `
          + 'token entregado que no está guardado es un enlace que no abre.',
      );
      assert.match(base, /^[0-9a-f]{32}$/, `🔴 el token guardado tiene forma inesperada: ${base}`);
    });
  }
});

test('SCRUM-793 · 🔴 y DOS a la vez tampoco: el caso del encargo', { skip: !GATE && 'sin QA_DB_TEST=1 · necesita Postgres real: la condición que se prueba vive en el WHERE de un UPDATE' }, async () => {
  // Con el defecto puesto esto fallaba 4 de cada 5 veces — o sea que UNA ronda sola habría pasado
  // en verde una de cada cinco. Cinco rondas, y ninguna puede entregar un token muerto.
  for (let ronda = 1; ronda <= 5; ronda += 1) {
    await conMerchant(async (m) => {
      const c = await sinToken(m.id);
      const [a, b] = await Promise.all([
        cliente.ensurePortalToken(m.id, c.id),
        cliente.ensurePortalToken(m.id, c.id),
      ]);
      const base = await enBase(c.id);
      assert.equal(a, b, `🔴 RONDA ${ronda}: las dos curaciones han devuelto tokens distintos`);
      assert.equal(a, base, `🔴 RONDA ${ronda}: se entregó un token que NO está en la base`);
    });
  }
});

test('SCRUM-793 · ✅ CONTROL POSITIVO: a quien YA tiene token no se le mueve', { skip: !GATE && 'sin QA_DB_TEST=1 · necesita Postgres real: la condición que se prueba vive en el WHERE de un UPDATE' }, async () => {
  // El arreglo escribe condicionado a `portalToken: null`. Si esa condición se rompiera al revés
  // —escribiendo siempre— este control cae: le cambiaría el enlace a un cliente que ya lo tiene,
  // y el que ya circula por WhatsApp dejaría de abrir.
  await conMerchant(async (m) => {
    const c = await cliente.createCustomer(m.id, { name: 'QA-793 con token de nacimiento' });
    const t0 = await enBase(c.id);
    assert.ok(t0, '🔴 el alta real ha dejado de poner token: este control no mide nada');

    const ts = await Promise.all(Array.from({ length: 10 }, () => cliente.ensurePortalToken(m.id, c.id)));
    assert.equal(await enBase(c.id), t0, '🔴 diez curaciones le han CAMBIADO el token');
    assert.deepEqual([...new Set(ts)], [t0], '🔴 alguna curación devolvió algo distinto del suyo');
  });
});

test('SCRUM-793 · ✅ CONTROL NEGATIVO: editar el nombre sigue sin mover el token', { skip: !GATE && 'sin QA_DB_TEST=1 · necesita Postgres real: la condición que se prueba vive en el WHERE de un UPDATE' }, async () => {
  await conMerchant(async (m) => {
    const c = await sinToken(m.id);
    const t0 = await cliente.ensurePortalToken(m.id, c.id);
    await cliente.updateCustomer(m.id, c.id, { name: 'QA-793 renombrado' });
    assert.equal(await enBase(c.id), t0,
      '🔴 una edición del cliente ha movido su `portalToken`. El enlace que el profesional ya '
      + 'compartió dejaría de funcionar sin que nadie lo tocara.');
  });
});

test('SCRUM-793 · un cliente que no es de este merchant no se cura (regla 2)', { skip: !GATE && 'sin QA_DB_TEST=1 · necesita Postgres real: la condición que se prueba vive en el WHERE de un UPDATE' }, async () => {
  // La escritura pasó a filtrar por `merchantId`, que antes sólo filtraba la lectura. Se comprueba
  // por el efecto: con el merchant equivocado no se cura NI se escribe nada.
  await conMerchant(async (propietario) => {
    const c = await sinToken(propietario.id);
    await conMerchant(async (ajeno) => {
      await assert.rejects(
        () => cliente.ensurePortalToken(ajeno.id, c.id),
        /customer_not_found/,
        '🔴 se ha curado el cliente de OTRO merchant',
      );
    });
    assert.equal(await enBase(c.id), null, '🔴 el intento ajeno ha escrito un token igualmente');
  });
});

test.after(async () => { if (prismaDev) await prismaDev.$disconnect(); });
