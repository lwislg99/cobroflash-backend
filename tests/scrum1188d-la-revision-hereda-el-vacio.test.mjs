// tests/scrum1188d-la-revision-hereda-el-vacio.test.mjs — SCRUM-1188d, de paso
//
// 🔴 «CREAR REVISIÓN» COPIABA UNA COLUMNA `Json?` VACÍA COMO EL VALOR JSON `null`.
//
// Es el mismo mecanismo que `tiers` en las plantillas (`scrum1188d-tiers-tambien-se-vacia`), en
// otro escritor: `nuevaRevisionDe` copia cada campo tal cual se leyó, una columna `Json?` a NULL de
// SQL se lee `null`, y ese `null` de JS escrito de vuelta guarda el JSON `null`. Medido con la
// función de verdad contra Postgres (docs/master/evidencias/SCRUM-1188d/sonda-revision.mjs): la
// revisión de un presupuesto sin niveles, sin plan, sin etiquetas y sin cláusulas quitadas salía
// con las seis columnas OCUPADAS.
//
// Tres mitades:
//   · el CENSO (sin base): la lista de columnas que se traducen es exactamente la de las `Json?`
//     de `Quote` que la revisión hereda. Una columna nueva que no entre sale roja;
//   · la función pura (sin base);
//   · la función de verdad contra el banco desechable (`LIBRO_PG_URL`), releída por SQL crudo.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

const require = createRequire(import.meta.url);
const RAIZ = path.resolve(import.meta.dirname, '..');

const URL_BANCO = process.env.LIBRO_PG_URL || '';
if (URL_BANCO) {
  const p = parseBDSegura(URL_BANCO);
  if (!p || !['127.0.0.1', 'localhost', '::1'].includes(p.host) || !p.base.endsWith('_test')) {
    throw new Error('🔴 LIBRO_PG_URL no es un banco desechable (loopback y base «*_test»). No se toca nada.');
  }
  process.env.DATABASE_URL = URL_BANCO;
}
const CON_BASE = URL_BANCO !== '';

after(async () => {
  if (!CON_BASE) return;
  const { prisma } = await import('../dist/core/db/prisma.js');
  await prisma.$disconnect();
});

const { Prisma } = require('@prisma/client');
const { JSON_ANULABLES_DE_LA_REVISION, revisionParaLaBase } = require('../dist/modules/system/quoteAdmin.js');
const { REVISION_HEREDA } = require('../dist/modules/quotes/domain/revision.js');

/** Los campos del modelo `Quote` de `schema.prisma` con su tipo, leídos SIN comentarios. */
function camposDeQuote() {
  const lineas = fs.readFileSync(path.join(RAIZ, 'prisma', 'schema.prisma'), 'utf8').split(/\r?\n/);
  const inicio = lineas.findIndex((l) => /^model Quote \{/.test(l));
  assert.ok(inicio >= 0, '🔴 CIEGO: no encuentro `model Quote {` en prisma/schema.prisma');
  const campos = new Map();
  for (let i = inicio + 1; i < lineas.length && !/^\}/.test(lineas[i]); i++) {
    const codigo = lineas[i].split('//')[0].trim();
    const m = /^(\w+)\s+([\w.]+(?:\[\])?\??)(\s|$)/.exec(codigo);
    if (m && !codigo.startsWith('@@')) campos.set(m[1], m[2]);
  }
  return campos;
}

test('SCRUM-1188d · CENSO: lo que se traduce al crear una revisión son las columnas `Json?` de `Quote` que se heredan, ni una más ni una menos', () => {
  const campos = camposDeQuote();
  const jsonAnulables = [...campos].filter(([, tipo]) => tipo === 'Json?').map(([nombre]) => nombre);

  // SUELO: el lector ve el modelo, y distingue `Json?` de `Json` y de lo demás.
  assert.ok(campos.size >= 40, `🔴 CIEGO: sólo leo ${campos.size} campos de Quote`);
  assert.equal(campos.get('lines'), 'Json', '🔴 CIEGO: `lines` debería leerse `Json` (NO anulable)');
  assert.equal(campos.get('tiers'), 'Json?');
  assert.equal(campos.get('paymentTerms'), 'String?', '🔴 CIEGO: el lector no distingue un texto anulable');
  assert.ok(jsonAnulables.length >= 5, `🔴 CIEGO: sólo encuentro ${jsonAnulables.length} columnas \`Json?\` en Quote`);

  const heredadas = jsonAnulables.filter((c) => REVISION_HEREDA.includes(c)).sort();
  assert.deepEqual([...JSON_ANULABLES_DE_LA_REVISION].sort(), heredadas,
    '🔴 una columna `Json?` de Quote se hereda en la revisión y no está en JSON_ANULABLES_DE_LA_REVISION '
    + '(o al revés): la revisión la copiaría vacía como el JSON `null`. Población: '
    + `${jsonAnulables.length} \`Json?\` en Quote (${jsonAnulables.join(', ')}), ${heredadas.length} heredadas.`);
});

test('SCRUM-1188d · `revisionParaLaBase` traduce el `null` SÓLO en las columnas `Json?`, y no muta lo que recibe', () => {
  const datos = {
    merchantId: 7, quoteNumber: 12, revision: 1,
    lines: [{ concept: 'x' }],
    docFields: null, payMethods: null, customBillingPlan: null, tiers: null, clausulasExcluidas: null, tags: null,
    internalNotes: null, paymentTerms: null, validUntil: null,
  };
  const copia = structuredClone(datos);
  const salida = revisionParaLaBase(datos);

  for (const campo of JSON_ANULABLES_DE_LA_REVISION) {
    assert.equal(salida[campo], Prisma.DbNull, `🔴 \`${campo}: null\` no sale como Prisma.DbNull`);
  }
  // Un texto o una fecha a `null` SÍ es un NULL de SQL con el `null` de JS: no se tocan.
  assert.equal(salida.internalNotes, null);
  assert.equal(salida.paymentTerms, null);
  assert.equal(salida.validUntil, null);
  assert.deepEqual(salida.lines, datos.lines);
  assert.deepEqual(datos, copia, '🔴 la función ha mutado su entrada');

  // Con valor, pasan tal cual; y una clave que no viaja sigue sin viajar.
  const llena = revisionParaLaBase({ tiers: [{ id: 'good' }], clausulasExcluidas: [] });
  assert.deepEqual(llena, { tiers: [{ id: 'good' }], clausulasExcluidas: [] });
  assert.equal(Object.hasOwn(llena, 'docFields'), false);
});

test('SCRUM-1188d · 🔴 la revisión de un presupuesto con las columnas `Json?` vacías las hereda VACÍAS (NULL de SQL)', { skip: !CON_BASE && 'sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { crearRevisionDeQuote } = await import('../dist/modules/system/quoteAdmin.js');

  const enLaBase = async (id) => (await prisma.$queryRaw`
    SELECT doc_fields IS NULL AS doc_fields, pay_methods IS NULL AS pay_methods,
           custom_billing_plan IS NULL AS plan, tiers IS NULL AS tiers,
           clausulas_excluidas IS NULL AS clausulas, tags IS NULL AS tags,
           jsonb_typeof(tiers) AS tipo_tiers, jsonb_typeof(clausulas_excluidas) AS tipo_clausulas
    FROM quotes WHERE id = ${id}`)[0];
  const TODAS_VACIAS = { doc_fields: true, pay_methods: true, plan: true, tiers: true, clausulas: true, tags: true, tipo_tiers: null, tipo_clausulas: null };

  await withMerchant(prisma, { name: 'QA SCRUM-1188d revisión', email: `qa-1188d-rev-${Date.now()}@test.local` }, async (m) => {
    const cliente = await prisma.customer.create({ data: { merchantId: m.id, name: 'Cliente QA 1188d' } });
    const base = { merchantId: m.id, customerId: cliente.id, total: '100', currency: 'EUR', status: 'sent', lines: [{ concept: 'x', qty: 1, price: 100 }] };
    try {
      // ── vacío se hereda vacío ──
      const vacio = await prisma.quote.create({ data: { ...base, quoteNumber: 1 } });
      assert.deepEqual(await enLaBase(vacio.id), TODAS_VACIAS, '🔴 CIEGO: el original no nace con las columnas vacías');
      const rev = await crearRevisionDeQuote(m.id, vacio.id);
      assert.equal(rev.revision, 1);
      assert.deepEqual(await enLaBase(rev.id), TODAS_VACIAS,
        '🔴 la revisión tiene algo guardado en una columna `Json?` que el original tenía vacía (el JSON `null`).');

      // ── y lo que SÍ hay se sigue heredando ──
      const niveles = [{ id: 'good', total: 1 }, { id: 'better', total: 2 }, { id: 'best', total: 3 }];
      const lleno = await prisma.quote.create({ data: { ...base, quoteNumber: 2, tiers: niveles, clausulasExcluidas: [] } });
      const rev2 = await crearRevisionDeQuote(m.id, lleno.id);
      assert.deepEqual(await enLaBase(rev2.id),
        { ...TODAS_VACIAS, tiers: false, clausulas: false, tipo_tiers: 'array', tipo_clausulas: 'array' });
      const leida = await prisma.quote.findUnique({ where: { id: rev2.id }, select: { tiers: true, clausulasExcluidas: true } });
      assert.deepEqual(leida, { tiers: niveles, clausulasExcluidas: [] });
    } finally {
      await prisma.quote.deleteMany({ where: { merchantId: m.id } });
      await prisma.customer.deleteMany({ where: { merchantId: m.id } });
    }
  });
});
