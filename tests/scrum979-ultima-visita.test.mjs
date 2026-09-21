// SCRUM-979 · «ÚLTIMA VISITA» EN LA LISTA DE CLIENTES, con filtro de 6 / 12 / 24 meses.
//
// Dos mitades:
//   · la PIEZA del navegador (`filtroClientes.js`), sin DOM y sin banco: corre en cada `npm test`;
//   · el SERVIDOR (`listCustomers`), contra Postgres de verdad: la fecha sale de UN `job.groupBy`
//     con la tenencia en la consulta y, para el técnico, solo de SUS trabajos visibles.
//
// Microcopy firmada por delegación: docs/microcopy/2026-09-21-SCRUM-979-ultima-visita.md.
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FC = createRequire(import.meta.url)(path.join(RAIZ, 'public/dashboard/js/filtroClientes.js'));

// ── LA PIEZA ──────────────────────────────────────────────────────────────────────────────
const AHORA = new Date('2026-09-21T10:00:00Z');
const hace = (meses, dias = 0) => { const d = new Date(AHORA.getTime()); d.setMonth(d.getMonth() - meses); d.setDate(d.getDate() - dias); return d.toISOString(); };
const LOTE = [
  { id: 1, name: 'Reciente', ultimaVisita: hace(2) },
  { id: 2, name: 'Siete meses', ultimaVisita: hace(7) },
  // Nombres elegidos para que A-Z INVIERTA el orden del servidor: así el orden se ve aplicado.
  { id: 3, name: 'Zeta, trece meses', ultimaVisita: hace(13) },
  { id: 4, name: 'Alfa, treinta meses', ultimaVisita: hace(30) },
  { id: 5, name: 'Nunca' }, // sin la clave: nunca tuvo un trabajo terminado
];
const ids = (l) => l.map((c) => c.id);

test('SCRUM-979 · los textos firmados, tal cual', () => {
  assert.equal(FC.TEXTOS_VISITA.columna, 'Última visita');
  assert.equal(FC.TEXTOS_VISITA.sinFiltro, 'Cualquier fecha de visita');
  assert.deepEqual(FC.FILTROS_VISITA.map((f) => [f.meses, FC.etiqueta(f)]), [
    [6, 'Sin visitar desde hace 6 meses'],
    [12, 'Sin visitar desde hace 12 meses'],
    [24, 'Sin visitar desde hace 24 meses'],
  ]);
});

test('SCRUM-979 · el filtro: 6 / 12 / 24 meses, y «nunca» no entra en ninguno', () => {
  assert.deepEqual(ids(FC.filtrarPorVisita(LOTE, 6, AHORA)), [2, 3, 4]);
  assert.deepEqual(ids(FC.filtrarPorVisita(LOTE, 12, AHORA)), [3, 4]);
  assert.deepEqual(ids(FC.filtrarPorVisita(LOTE, 24, AHORA)), [4]);
  for (const m of [6, 12, 24]) {
    assert.ok(!ids(FC.filtrarPorVisita(LOTE, m, AHORA)).includes(5),
      `🔴 un cliente SIN visita entra en «sin visitar desde hace ${m} meses» — «nunca» no es «hace más de ${m}»`);
  }
  // Borde: justo 12 meses entra; un día menos, no.
  assert.deepEqual(ids(FC.filtrarPorVisita([{ id: 9, ultimaVisita: hace(12) }], 12, AHORA)), [9]);
  assert.deepEqual(ids(FC.filtrarPorVisita([{ id: 9, ultimaVisita: hace(11, 29) }], 12, AHORA)), []);
});

test('SCRUM-979 · sin filtro (o con uno que no existe) la lista sale TAL CUAL — lo de hoy', () => {
  assert.deepEqual(ids(FC.filtrarPorVisita(LOTE, null, AHORA)), [1, 2, 3, 4, 5]);
  assert.deepEqual(ids(FC.filtrarPorVisita(LOTE, 7, AHORA)), [1, 2, 3, 4, 5]);
  assert.deepEqual(ids(FC.aplicar(LOTE, 'TODOS', 'RECIENTES', null)), [1, 2, 3, 4, 5],
    'quien llama a `aplicar` sin el filtro nuevo tiene exactamente lo de antes');
  assert.equal(FC.POR_DEFECTO.visita, null);
});

test('SCRUM-979 · el filtro se ENCADENA con los demás, no los sustituye', () => {
  const lote = LOTE.map((c) => ({ ...c, contactKind: c.id % 2 ? 'EMPRESA' : 'PERSONA' }));
  assert.deepEqual(ids(FC.aplicar(lote, 'EMPRESA', 'RECIENTES', null, 6, AHORA)), [3]);
  assert.deepEqual(ids(FC.aplicar(lote, 'TODOS', 'AZ', null, 12, AHORA)), [4, 3], 'y el orden se aplica encima');
});

test('SCRUM-979 · la fecha: ausente, vacía o basura → null; y el selector solo si alguien tiene visita', () => {
  assert.equal(FC.ultimaVisitaDe({}), null);
  assert.equal(FC.ultimaVisitaDe({ ultimaVisita: null }), null);
  assert.equal(FC.ultimaVisitaDe({ ultimaVisita: 'no-es-fecha' }), null);
  assert.ok(FC.ultimaVisitaDe({ ultimaVisita: hace(1) }) instanceof Date);
  assert.equal(FC.hayVisitas([{ id: 1 }, { id: 2, ultimaVisita: null }]), false);
  assert.equal(FC.hayVisitas(LOTE), true);
});

test('SCRUM-979 · la columna es ELEGIBLE y nace oculta en el móvil, como Email/Notas/Alta', () => {
  const col = FC.COLUMNAS.find((c) => c.id === 'visita');
  assert.ok(col, 'no hay columna «visita»');
  assert.equal(col.texto, 'Última visita');
  assert.ok(FC.columnasElegibles().some((c) => c.id === 'visita'), 'el profesional tiene que poder encenderla');
  assert.equal(FC.claseDeColumna('visita', []), 'col-hide-mobile', 'por defecto, lo de hoy en el móvil');
  assert.equal(FC.claseDeColumna('visita', ['visita']), '', 'encendida, se ve también en la tarjeta');
});

// ── EL SERVIDOR ───────────────────────────────────────────────────────────────────────────
const URL_BANCO = process.env.QA_DB_TEST === '1' ? '' : (process.env.LIBRO_PG_URL || '');
if (URL_BANCO) {
  const p = parseBDSegura(URL_BANCO);
  if (!p || !['127.0.0.1', 'localhost', '::1'].includes(p.host) || !p.base.endsWith('_test')) {
    throw new Error('🔴 LIBRO_PG_URL no es un banco desechable (loopback y base «*_test»). No se toca nada.');
  }
  process.env.DATABASE_URL = URL_BANCO;
}
const ENABLED = process.env.QA_DB_TEST === '1' || URL_BANCO !== '';

test('SCRUM-979 · listCustomers: la última visita, con tenencia y con el técnico viendo solo lo suyo', { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { listCustomers } = await import('../dist/modules/system/customerAdmin.js');
  const stamp = Date.now();
  const F = (s) => new Date(s);
  try {
    await withMerchant(prisma, { name: 'QA 979 A', email: `qa-979-a-${stamp}@test.local` }, (a) =>
      withMerchant(prisma, { name: 'QA 979 B', email: `qa-979-b-${stamp}@test.local` }, async (b) => {
        const tec = await prisma.teamMember.create({ data: { merchantId: a.id, name: 'Técnico 979', email: `tec-979-${stamp}@test.local`, role: 'tecnico', status: 'active' } });
        const cli = (merchantId, name) => prisma.customer.create({ data: { merchantId, name } });
        const job = (merchantId, customerId, status, scheduledAt, extra = {}) =>
          prisma.job.create({ data: { merchantId, customerId, status, titulo: 'Obra 979', scheduledAt, ...extra } });

        const ana = await cli(a.id, 'Ana 979');
        await job(a.id, ana.id, 'terminado', F('2025-01-10T09:00:00Z'));
        await job(a.id, ana.id, 'cerrado', F('2025-06-10T09:00:00Z'));       // ← la última
        await job(a.id, ana.id, 'en_curso', F('2026-09-01T09:00:00Z'));      // no cuenta: no terminado
        await job(a.id, ana.id, 'agendado', F('2026-10-01T09:00:00Z'));      // no cuenta
        const nunca = await cli(a.id, 'Nunca 979');
        await job(a.id, nunca.id, 'en_curso', F('2026-01-01T09:00:00Z'));    // solo trabajos sin terminar
        const suyo = await cli(a.id, 'Del técnico 979');
        await job(a.id, suyo.id, 'terminado', F('2024-03-01T09:00:00Z'), { assignedUserId: tec.id });
        await job(a.id, suyo.id, 'terminado', F('2026-02-01T09:00:00Z'));    // de OTRO: el técnico no lo ve
        // Tenencia: un trabajo de OTRO merchant sobre un cliente suyo no puede colarse.
        const deB = await cli(b.id, 'De B 979');
        await job(b.id, deB.id, 'terminado', F('2026-05-01T09:00:00Z'));

        const porNombre = (lista) => Object.fromEntries(lista.map((c) => [c.name, c]));
        const admin = porNombre(await listCustomers(a.id, undefined, {}));
        // SUELO: la lista trae a los tres, así que un «no tiene visita» es del dato, no del lector.
        assert.ok(admin['Ana 979'] && admin['Nunca 979'] && admin['Del técnico 979'], 'SUELO: faltan clientes en la lista');
        assert.equal(new Date(admin['Ana 979'].ultimaVisita).toISOString(), '2025-06-10T09:00:00.000Z',
          '🔴 la última visita no es el máximo de los trabajos terminados o cerrados');
        assert.ok(!('ultimaVisita' in admin['Nunca 979']), '🔴 un cliente sin trabajos terminados trae la clave (ausente no es cero)');
        assert.equal(new Date(admin['Del técnico 979'].ultimaVisita).toISOString(), '2026-02-01T09:00:00.000Z',
          'el admin ve TODOS los trabajos');
        assert.ok(!admin['De B 979'], '🔴 un cliente de OTRO merchant sale en la lista');

        const delTecnico = porNombre(await listCustomers(a.id, undefined, { soloTrabajosDe: tec.id }));
        assert.ok(delTecnico['Ana 979'], 'el técnico sigue viendo la cartera entera (hoy no se le recorta)');
        assert.equal(new Date(delTecnico['Del técnico 979'].ultimaVisita).toISOString(), '2024-03-01T09:00:00.000Z',
          '🔴 al técnico le sale la fecha de un trabajo que en su lista NO existe');
        assert.ok(!('ultimaVisita' in delTecnico['Ana 979']), '🔴 al técnico le sale la visita de trabajos que no son suyos');
      }));
  } finally {
    await prisma.$disconnect();
  }
});
