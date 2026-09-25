// tests/scrum1103-retencion-practicada-en-gastos.test.mjs — SCRUM-1103
//
// LA RETENCIÓN DE IRPF QUE EL PROFESIONAL PRACTICA (111/115), no la que sufre
// (`retencionIrpf.ts`, sentido inverso). PASO ③ de A5: las tres bases ya tienen las columnas
// (ALTER aplicado y verificado, `docs/master/SCRUM-1103.md` §5); este fichero prueba que el
// esquema y el dominio están al día CON ellas.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL ALCANCE DE ESTE TICKET, Y LO QUE DELIBERADAMENTE NO HACE
//
// `retencionPracticadaTipo`/`Cuota` entran en `CreateExpenseInput` y se ESCRIBEN, mismo
// patrón que `baseAmount`/`vatRate`/`vatAmount` (SCRUM-324): son el dato objetivo que trae la
// factura del proveedor. `retencionPracticadaDeclarada` NO entra en `CreateExpenseInput` a
// propósito — mismo criterio que `vatDeducible`, que tampoco es parámetro de alta hoy: es una
// DECISIÓN de clasificación, y su cubo de tipos válidos por 111/115 lo fija quien construya
// SCRUM-1066 (`docs/master/SCRUM-1103.md` §6). Escribirla aquí sin esa validación dejaría
// entrar cualquier valor. Las rutas HTTP (POST/PUT `/admin/expenses`) NO se tocan en este
// ticket, por el mismo motivo.
//
// ⚠️ NINGUNA BASE REAL en la parte gateada: banco desechable (loopback + base «…_test»),
// fail-closed, y todo lo que se lee lo ha creado este mismo test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

const URL_BANCO = process.env.LIBRO_PG_URL || '';
const ENABLED = URL_BANCO !== '';
const SELLO = `s1103${process.pid}`;

if (ENABLED) {
  const p = parseBDSegura(URL_BANCO);
  if (!p || !['127.0.0.1', 'localhost', '::1'].includes(p.host) || !p.base.endsWith('_test')) {
    throw new Error('🔴 LIBRO_PG_URL no es un banco desechable (loopback + base «…_test»). Se para aqui.');
  }
  process.env.DATABASE_URL = URL_BANCO;
}

const { createExpense, updateExpense, listExpenses } = await import('../dist/modules/expenses/domain/expenses.service.js');

// ── 1 · SUELO: el schema declara las tres columnas, con el patrón de sus vecinas ────────────

test('SCRUM-1103 · 🔴 SUELO: `prisma/schema.prisma` declara las tres columnas nullable, sin @default', () => {
  const schema = leer('prisma/schema.prisma');
  const ini = schema.indexOf('model Expense {');
  assert.notEqual(ini, -1, 'CIEGO: no se encuentra `model Expense` en el schema.');
  const fin = schema.indexOf('\n}', ini);
  const bloque = schema.slice(ini, fin);

  for (const campo of ['retencionPracticadaTipo', 'retencionPracticadaCuota', 'retencionPracticadaDeclarada']) {
    const linea = bloque.split('\n').find((l) => l.trim().startsWith(campo));
    assert.ok(linea, `🔴 falta \`${campo}\` en \`model Expense\`.`);
    assert.match(linea, /\?/, `🔴 \`${campo}\` no es nullable: un gasto sin clasificar necesita poder no llevarla.`);
    assert.doesNotMatch(linea, /@default/, `🔴 \`${campo}\` lleva @default: rellenaría el pasado con una suposición (mismo motivo que vatRate/vatAmount/vatDeducible).`);
  }
  assert.match(bloque, /retencionPracticadaCuota\s+Decimal\?.*@db\.Decimal\(12,\s*2\)/,
    '🔴 la cuota no es `Decimal? @db.Decimal(12, 2)`, la misma precisión que `vatAmount`.');
});

// ── 2 · SUELO: el censo de ESCRITURAS, con control positivo (patrón scrum324) ────────────────

test('SCRUM-1103 · SUELO: el servicio ESCRIBE tipo y cuota, y el censo sabe verlo', () => {
  const servicio = leer('src/modules/expenses/domain/expenses.service.ts');
  const CAMPOS = ['retencionPracticadaTipo', 'retencionPracticadaCuota'];
  const escritos = CAMPOS.filter((c) => new RegExp(`${c}:\\s*data\\.${c}`).test(servicio));
  assert.deepEqual(escritos, CAMPOS,
    `🔴 el servicio solo escribe ${escritos.length} de ${CAMPOS.length} campos de retención ` +
    `(faltan: ${CAMPOS.filter((c) => !escritos.includes(c)).join(', ')}).`);

  // Control positivo: la misma regexp encuentra un campo que ya se escribía.
  assert.match(servicio, /vatAmount:\s*data\.vatAmount/,
    '🔴 el censo no encuentra `vatAmount`, que se escribe desde SCRUM-324: el instrumento está ciego.');
});

test('SCRUM-1103 · DECISIÓN: `retencionPracticadaDeclarada` NO es parámetro de alta, igual que `vatDeducible`', () => {
  const servicio = leer('src/modules/expenses/domain/expenses.service.ts');
  // Se busca la FORMA de escritura de alta (`campo: data.campo`), no el nombre a secas: el campo
  // SÍ aparece en `CAMPOS_DE_LA_LISTA` (lectura) y eso es lo correcto, no lo que aquí se prohíbe.
  assert.doesNotMatch(servicio, /retencionPracticadaDeclarada:\s*data\.retencionPracticadaDeclarada/,
    '🔴 `retencionPracticadaDeclarada` se escribe en el alta sin que exista el cubo de tipos ' +
    'válidos por 111/115 (SCRUM-1103.md §6): eso deja entrar cualquier valor sin validar.');
  // Y el mismo instrumento, control positivo: `vatDeducible` tampoco se escribe hoy, así que el
  // patrón detecta correctamente una AUSENCIA real y no un fallo del regex.
  assert.doesNotMatch(servicio, /vatDeducible:\s*data\.vatDeducible/,
    '🔴 SUELO roto: si `vatDeducible` apareciera escrito, la comparación de arriba no significaría nada.');
});

// ── 3 · el `select` de la lista lee las tres — control explícito, además del guard general de SCRUM-964 ──

test('SCRUM-1103 · `CAMPOS_DE_LA_LISTA` incluye las tres columnas (la lista las devuelve)', () => {
  const servicio = leer('src/modules/expenses/domain/expenses.service.ts');
  const ini = servicio.indexOf('const CAMPOS_DE_LA_LISTA');
  const fin = servicio.indexOf('} as const', ini);
  const bloque = servicio.slice(ini, fin);
  for (const campo of ['retencionPracticadaTipo', 'retencionPracticadaCuota', 'retencionPracticadaDeclarada']) {
    assert.match(bloque, new RegExp(`${campo}:\\s*true`), `🔴 \`${campo}\` no está en CAMPOS_DE_LA_LISTA: desaparece de la API en silencio.`);
  }
});

// ── 4 · unidad, sin base: `createExpense` manda tipo/cuota al `create()`, no los inventa ────

test('SCRUM-1103 · `createExpense` manda tipo y cuota al `create()` de Prisma, y `null` si no llegan', async () => {
  let dataDeCreate = null;
  inyectarBase({
    'expense.create': (args) => { dataDeCreate = args.data; return { id: 1, ...args.data }; },
    'provider.updateMany': () => ({ count: 0 }),
  }, ['../dist/modules/expenses/domain/expenses.service.js']);
  const { createExpense: crear } = moduloDeDist('../dist/modules/expenses/domain/expenses.service.js');

  await crear(MERCHANT, {
    concept: 'Factura del gestor', amount: 121, category: 'otros',
    retencionPracticadaTipo: 15, retencionPracticadaCuota: 18.15,
  });
  assert.equal(dataDeCreate.retencionPracticadaTipo, 15);
  assert.equal(dataDeCreate.retencionPracticadaCuota, 18.15);

  await crear(MERCHANT, { concept: 'Ferretería', amount: 12.5, category: 'materiales' });
  assert.equal(dataDeCreate.retencionPracticadaTipo, null,
    '🔴 sin retención tecleada, la columna tiene que quedar en `null` (nunca clasificado), no en `undefined` ni en 0.');
  assert.equal(dataDeCreate.retencionPracticadaCuota, null);
});

test('SCRUM-1103 · CONTROL: un tipo 0 legítimo no se confunde con "no se sabe" (mismo defecto que vatRate)', async () => {
  let dataDeCreate = null;
  inyectarBase({
    'expense.create': (args) => { dataDeCreate = args.data; return { id: 1, ...args.data }; },
    'provider.updateMany': () => ({ count: 0 }),
  }, ['../dist/modules/expenses/domain/expenses.service.js']);
  const { createExpense: crear } = moduloDeDist('../dist/modules/expenses/domain/expenses.service.js');

  await crear(MERCHANT, { concept: 'Compra sin retención', amount: 50, category: 'materiales', retencionPracticadaTipo: 0, retencionPracticadaCuota: 0 });
  assert.equal(dataDeCreate.retencionPracticadaTipo, 0,
    '🔴 un tipo 0 % (legítimo) se ha convertido en `null`: el atajo `x ? … : null` confundiría cero con "no se sabe".');
  assert.equal(dataDeCreate.retencionPracticadaCuota, 0);
});

// ── 5 · LA CADENA ENTERA, contra un banco de verdad (gateada, igual que scrum324) ────────────

test('SCRUM-1103 · 🔴 LA CADENA ENTERA: se guarda con retención y se LEE de vuelta, con su precisión',
  { skip: !ENABLED && 'sin LIBRO_PG_URL (banco desechable)' },
  async (t) => {
    const p = parseBDSegura(URL_BANCO);
    t.diagnostic(`banco: ${p.host}:${p.puerto}/${p.base}`);
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({ datasourceUrl: URL_BANCO });

    try {
      await withMerchant(prisma, { name: `QA 1103 ${SELLO}`, email: `s1103.${SELLO}@qa.invalid` }, async (m) => {
        const gasto = await createExpense(m.id, {
          concept: 'Factura del gestor', amount: 121, category: 'otros',
          date: new Date(2026, 8, 20),
          retencionPracticadaTipo: 15, retencionPracticadaCuota: 18.15,
        });

        // ① se guardó de verdad, no «se aceptó y se perdió» — leído por FUERA de la función que escribió.
        const enBase = await prisma.expense.findUnique({ where: { id: gasto.id } });
        assert.equal(enBase.retencionPracticadaTipo, 15,
          '🔴 el tipo NO se ha guardado. La columna existe (ALTER aplicado) y el dominio la acepta ' +
          '— y aun así no llega a la fila: es exactamente la cadena rota que SCRUM-324 documentó ' +
          'para el desglose de IVA, un ticket más tarde con otra columna.');
        assert.equal(Number(enBase.retencionPracticadaCuota), 18.15, '🔴 la cuota no se ha guardado con la precisión Decimal(12,2) esperada.');
        assert.equal(enBase.retencionPracticadaDeclarada, null,
          '🔴 `declarada` se ha rellenado sola: nadie la escribe todavía (SCRUM-1066 la clasifica), tiene que nacer `null`.');

        // ② la LISTA (el consumidor real del dashboard) también las trae.
        const lista = await listExpenses(m.id, {});
        const mio = lista.find((e) => e.id === gasto.id);
        assert.ok(mio, '🔴 el gasto recién creado no aparece en `listExpenses`.');
        assert.equal(mio.retencionPracticadaTipo, 15, '🔴 la lista no devuelve el tipo: `CAMPOS_DE_LA_LISTA` no está sincronizado con lo que se guardó.');
        assert.equal(Number(mio.retencionPracticadaCuota), 18.15);

        // ③ `updateExpense` puede corregirla (undefined = no tocar, valor = escribir) — se prueba
        // por la función de dominio, no por la ruta HTTP: las rutas no se tocan en este ticket.
        const corregido = await updateExpense(m.id, gasto.id, { retencionPracticadaTipo: 7 });
        assert.equal(corregido.retencionPracticadaTipo, 7, '🔴 `updateExpense` no corrige el tipo.');
        assert.equal(Number(corregido.retencionPracticadaCuota), 18.15, '🔴 al corregir el tipo se ha borrado la cuota que no se tocó.');
      });
    } finally { await prisma.$disconnect(); }
  });

test('SCRUM-1103 · CONTROL NEGATIVO: un gasto SIN retención se sigue guardando, con las tres a `null`',
  { skip: !ENABLED && 'sin LIBRO_PG_URL (banco desechable)' },
  async () => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({ datasourceUrl: URL_BANCO });
    try {
      await withMerchant(prisma, { name: `QA 1103b ${SELLO}`, email: `s1103b.${SELLO}@qa.invalid` }, async (m) => {
        const gasto = await createExpense(m.id, { concept: 'Ferretería', amount: 12.5, category: 'materiales', date: new Date(2026, 8, 20) });
        assert.ok(gasto.id, '🔴 un gasto sin retención ha dejado de poder darse de alta.');
        const enBase = await prisma.expense.findUnique({ where: { id: gasto.id } });
        assert.equal(enBase.retencionPracticadaTipo, null);
        assert.equal(enBase.retencionPracticadaCuota, null);
        assert.equal(enBase.retencionPracticadaDeclarada, null);
      });
    } finally { await prisma.$disconnect(); }
  });
