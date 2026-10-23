// SCRUM-1043a · «QUIÉN ME DEBE» EN LA PANTALLA DE CLIENTES (la mitad de front; el servidor es PR #1627).
//
// Lo que se construye, con los textos FIRMADOS por el fundador en SCRUM-1043 c.20536 (las A de c.20533):
// el botón de alternar «Con cobro pendiente», la opción de orden «Más pendiente de cobro», la columna
// «Pendiente de cobro» (también en el selector «Columnas»), «{importe} sin cobrar» en cada fila, la
// línea de garantía retenida (literal de SCRUM-1108) y el vacío «Ningún cliente tiene cobros pendientes.».
// Al técnico NO se le pinta nada de esto, sin texto (c.20532).
//
// Tres capas: A · la pieza (`filtroClientes.js`, sin DOM) · B · la lista MONTADA en el banco de vistas,
// con un «servidor» que filtra y ordena como `listCustomers` y que apunta lo que se le pide · C · el
// handler real de `GET /admin/customers` (dist) para el caso límite del abono (c.16244).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { constaAprobado } from './_microcopy-aprobada.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FC = createRequire(import.meta.url)(path.join(RAIZ, 'public/dashboard/js/filtroClientes.js'));
const FICHA = 'docs/microcopy/2026-10-23-SCRUM-1043-quien-me-debe.md';

// ── A · la pieza ─────────────────────────────────────────────────────────────────────────────────
test('SCRUM-1043a · A · los cuatro textos firmados, tal cual, y constan en su ficha', () => {
  assert.deepEqual(FC.TEXTOS_DEUDA, {
    filtro: 'Con cobro pendiente',
    orden: 'Más pendiente de cobro',
    columna: 'Pendiente de cobro',
    vacio: 'Ningún cliente tiene cobros pendientes.',
  });
  for (const t of Object.values(FC.TEXTOS_DEUDA)) {
    assert.ok(constaAprobado(t).includes(FICHA), `🔴 «${t}» no consta en ${FICHA}`);
  }
  assert.equal(FC.etiqueta(FC.ORDEN_SALDO), 'Más pendiente de cobro');
  assert.equal(FC.SIN_APROBAR, 7, 'los textos de SCRUM-1043 están firmados: no suben SIN_APROBAR');
});

test('SCRUM-1043a · A · la garantía usa el MISMO literal que la ficha 360 (SCRUM-1108)', () => {
  const lit = 'Garantía retenida: ${fmt(r.importe)} · liberación desde el ${d}/${m}/${y} · sin cobrar';
  for (const f of ['public/dashboard/js/customerDetailView.js', 'public/dashboard/js/filtroClientes.js']) {
    assert.ok(fs.readFileSync(path.join(RAIZ, f), 'utf8').includes('`' + lit + '`'), `🔴 ${f} no lleva el literal firmado`);
  }
});

const fmt = (n) => `${n} €`;
const DEUDA = { id: 1, name: 'Con deuda', saldoPendiente: 500 };
const SIN = { id: 2, name: 'Sin deuda' };
const PARCIAL = { id: 3, name: 'Deuda parcial', saldoPendiente: 700,
  garantiaRetenida: { total: 90, retenciones: [
    { importe: 50, liberacionDia: '2026-09-01', aviso: true },
    { importe: 40, liberacionDia: '2027-03-15', aviso: false },
  ] } };

test('SCRUM-1043a · A · las líneas de cada fila: deuda, sin deuda, parcial con garantía y abono', () => {
  assert.deepEqual(FC.lineasDeDeuda(DEUDA, fmt).map((l) => l.texto), ['500 € sin cobrar']);
  assert.deepEqual(FC.lineasDeDeuda(SIN, fmt), [], 'sin deuda: ni cifra ni marca');
  assert.deepEqual(FC.lineasDeDeuda(PARCIAL, fmt).map((l) => [l.tipo, l.aviso, l.texto]), [
    ['saldo', false, '700 € sin cobrar'],
    ['garantia', true, 'Garantía retenida: 50 € · liberación desde el 01/09/2026 · sin cobrar'],
    ['garantia', false, 'Garantía retenida: 40 € · liberación desde el 15/03/2027 · sin cobrar'],
  ]);
  assert.deepEqual(FC.lineasDeDeuda({ id: 4, saldoPendiente: -120 }, fmt), [], 'un abono no es deuda');
  assert.deepEqual(FC.lineasDeDeuda({ id: 5, saldoPendiente: 0 }, fmt), []);
  assert.deepEqual(FC.lineasDeDeuda(null, fmt), []);
});

test('SCRUM-1043a · A · al técnico no se le pide ni se le ofrece nada de dinero', () => {
  assert.equal(FC.veDinero('admin'), true);
  for (const r of ['tecnico', 'operario', undefined, null, '']) assert.equal(FC.veDinero(r), false, String(r));
  assert.deepEqual(FC.consultaDeDeuda(false, true, 'SALDO'), [], 'aunque lo pidiera');
  assert.deepEqual(FC.consultaDeDeuda(true, true, 'SALDO'), [['conDeuda', '1'], ['orden', 'saldo']]);
  assert.deepEqual(FC.consultaDeDeuda(true, false, 'AZ'), []);
  assert.deepEqual(FC.ordenesPara(false).map((o) => o.id), ['RECIENTES', 'AZ']);
  assert.deepEqual(FC.ordenesPara(true).map((o) => o.id), ['RECIENTES', 'AZ', 'SALDO']);
  const ids = (cs) => cs.map((c) => c.id);
  try {
    FC.fijarDinero(true);
    assert.ok(ids(FC.columnasDeLaTabla()).includes('pendiente'));
    assert.ok(ids(FC.columnasElegibles()).includes('pendiente'), 'en el selector «Columnas»');
    const conCol = FC.colSpanDeLaTabla();
    FC.fijarDinero(false);
    assert.ok(!ids(FC.columnasDeLaTabla()).includes('pendiente'));
    assert.ok(!ids(FC.columnasElegibles()).includes('pendiente'));
    assert.equal(FC.colSpanDeLaTabla(), conCol - 1, 'el colSpan sale de la MISMA lista que la cabecera');
    FC.fijarDinero('admin');
    assert.ok(!ids(FC.columnasDeLaTabla()).includes('pendiente'), 'sólo `true` enciende: una cadena no');
  } finally { FC.fijarDinero(true); }
  assert.equal(FC.claseDeColumna('pendiente', []), '', 'se ve en el móvil sin encenderla');
  assert.deepEqual(ids(FC.aplicar([DEUDA, SIN, PARCIAL], 'TODOS', 'SALDO')), [1, 2, 3], 'el orden de saldo lo da el servidor');
});

// ── B · la lista montada ─────────────────────────────────────────────────────────────────────────
// El «servidor»: lo que hace `listCustomers` con `conDeuda` y `orden=saldo`, y para el técnico nada.
function servidor(rol, lote) {
  const pedidas = [];
  const datos = (ruta) => {
    if (!ruta.startsWith('/admin/customers')) return {};
    pedidas.push(ruta);
    const q = new URLSearchParams(ruta.split('?')[1] || '');
    let filas = rol === 'admin' ? lote.map((c) => ({ ...c })) : lote.map(({ saldoPendiente, garantiaRetenida, ...c }) => c);
    if (rol === 'admin' && q.get('conDeuda') === '1') filas = filas.filter((c) => (c.saldoPendiente ?? 0) > 0 || c.garantiaRetenida);
    if (rol === 'admin' && q.get('orden') === 'saldo') {
      const de = (c) => (c.saldoPendiente ?? 0) + (c.garantiaRetenida?.total ?? 0);
      filas.sort((a, b) => de(b) - de(a));
    }
    return filas;
  };
  return { pedidas, datos };
}
const ticks = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); };
// `Intl` separa el importe del «€» con un espacio duro (U+00A0), como en la ficha: aquí se lee como espacio.
const texto = (n) => todos(n).filter((h) => h.tagName === '#text' || h.hijos.length === 0)
  .map((h) => h.textContent || '').join(' ').replace(/ /g, ' ');
const filasDe = (c) => todos(c).filter((n) => n.tagName === 'TR' && todos(n).some((h) => h.tagName === 'TD'));

async function montar(rol, lote = [DEUDA, SIN, PARCIAL]) {
  const s = servidor(rol, lote);
  const banco = cargarDashboard(RAIZ, { rol, datos: s.datos });
  const r = await pintarVista(banco, 'renderCustomersView');
  assert.equal(r.error, null, `la lista no se monta: ${r.error}`);
  await ticks();
  const boton = todos(r.contenedor).find((n) => n.tagName === 'BUTTON' && n.dataset?.filtro === 'conDeuda') || null;
  const orden = todos(r.contenedor).find((n) => n.tagName === 'SELECT' && todos(n).some((o) => o.value === 'AZ'));
  return { ...s, banco, c: r.contenedor, boton, orden };
}

test('SCRUM-1043a · B · admin: columna, cifra en la fila y nada en el cliente sin deuda', async () => {
  const m = await montar('admin');
  const ths = todos(m.c).filter((n) => n.tagName === 'TH').map((n) => n.textContent);
  assert.ok(ths.includes('Pendiente de cobro'), `cabecera: ${ths.join(' | ')}`);
  const filas = filasDe(m.c);
  assert.equal(filas.length, 3, 'SUELO: tres filas');
  const celdas = (i) => todos(filas[i]).filter((n) => n.tagName === 'TD');
  assert.equal(celdas(0).length, ths.length, 'la fila tiene tantas celdas como la cabecera');
  const iCol = todos(m.c).filter((n) => n.tagName === 'TH').findIndex((n) => n.textContent === 'Pendiente de cobro');
  assert.equal(texto(celdas(0)[iCol]).trim(), '500,00 € sin cobrar');
  assert.equal(texto(celdas(1)[iCol]).trim(), '', 'sin deuda: celda vacía');
  assert.ok(!texto(filas[1]).includes('sin cobrar'));
  const parcial = texto(celdas(2)[iCol]);
  assert.match(parcial, /700,00 € sin cobrar/);
  assert.match(parcial, /Garantía retenida: 50,00 € · liberación desde el 01\/09\/2026 · sin cobrar/);
  assert.match(parcial, /Garantía retenida: 40,00 € · liberación desde el 15\/03\/2027 · sin cobrar/);
  const marcas = todos(celdas(2)[iCol]).filter((n) => /\b(badge|alert)\b/.test(n.className || '')).map((n) => n.className);
  assert.deepEqual(marcas, ['badge badge-red', 'alert warning', 'alert info'], 'la garantía, con el componente de la ficha');
  const sel = todos(m.c).filter((n) => n.tagName === 'INPUT' && n.dataset?.columna).map((n) => n.dataset.columna);
  assert.ok(sel.includes('pendiente'), 'está en el selector «Columnas»');
  assert.ok(m.pedidas.every((p) => !p.includes('conDeuda') && !p.includes('orden=')), 'sin tocar nada, la lista de siempre');
});

test('SCRUM-1043a · B · admin: el filtro y el orden se piden AL SERVIDOR, y el vacío firmado', async () => {
  const m = await montar('admin');
  assert.ok(m.boton, 'falta el botón «Con cobro pendiente»');
  assert.equal(m.boton.textContent, 'Con cobro pendiente');
  assert.equal(m.boton.getAttribute('aria-pressed'), 'false');
  m.boton.disparar('click'); await ticks();
  assert.equal(m.boton.getAttribute('aria-pressed'), 'true');
  assert.match(m.pedidas.at(-1), /[?&]conDeuda=1\b/);
  assert.deepEqual(filasDe(m.c).map((f) => texto(f)).map((t) => t.includes('Sin deuda')), [false, false], 'filtro: solo los deudores');

  const opciones = todos(m.orden).filter((n) => n.tagName === 'OPTION').map((o) => [o.value, o.textContent]);
  assert.deepEqual(opciones.at(-1), ['SALDO', 'Más pendiente de cobro']);
  m.orden.value = 'SALDO'; m.orden.disparar('change'); await ticks();
  assert.match(m.pedidas.at(-1), /orden=saldo/);
  assert.match(m.pedidas.at(-1), /conDeuda=1/, 'el filtro se suma al orden');
  const nombres = filasDe(m.c).map((f) => (texto(f).includes('Deuda parcial') ? 3 : texto(f).includes('Con deuda') ? 1 : 0));
  assert.deepEqual(nombres, [3, 1], 'de mayor a menor deuda');
  m.orden.value = 'AZ'; m.orden.disparar('change'); await ticks();
  assert.ok(!m.pedidas.at(-1).includes('orden=saldo'), 'al salir del orden por saldo se vuelve a pedir sin él');

  const v = await montar('admin', [SIN]);
  v.boton.disparar('click'); await ticks();
  const t = texto(v.c);
  assert.ok(t.includes('Ningún cliente tiene cobros pendientes.'), `vacío: ${t.slice(0, 200)}`);
  assert.ok(!t.includes('Añade a tu primer cliente'), 'el vacío de «sin clientes» sería falso aquí');
  assert.ok(!t.includes('Marca cada cliente como empresa o persona'), 'sin segunda línea');
});

test('SCRUM-1043a · B · técnico: ni botón, ni orden, ni columna, ni cifra — y no lo pide', async () => {
  const m = await montar('tecnico');
  assert.equal(m.boton, null, '🔴 el técnico ve el filtro de deuda');
  const t = texto(m.c);
  for (const s of ['Con cobro pendiente', 'Más pendiente de cobro', 'Pendiente de cobro', 'sin cobrar', 'Garantía retenida']) {
    assert.ok(!t.includes(s), `🔴 el técnico ve «${s}»`);
  }
  assert.ok(!todos(m.orden).some((o) => o.value === 'SALDO'));
  assert.equal(filasDe(m.c).length, 3, 'SUELO: el técnico sí ve la cartera');
  assert.ok(m.pedidas.length > 0 && m.pedidas.every((p) => !p.includes('conDeuda') && !p.includes('orden=')));
  // Control positivo del mismo instrumento: con el rol admin, las mismas cadenas SÍ salen.
  const a = texto((await montar('admin')).c);
  assert.ok(a.includes('Con cobro pendiente') && a.includes('sin cobrar'), 'CIEGO: el lector no ve los textos ni con admin');
});

// ── C · el servidor: un abono no es deuda (c.16244), y otro merchant no ve saldos ajenos ────────────
test('SCRUM-1043a · C · `conDeuda=1` deja fuera el saldo ≤ 0 y aísla merchants', async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const mod = await import('../dist/modules/system/app/routes/customersAdmin.routes.js');
  const router = mod.default?.default ?? mod.default ?? mod; // CommonJS de dist: el router va en `default.default`
  assert.ok(Array.isArray(router.stack), 'CIEGO: no tengo el router');
  const clientes = [
    { id: 1, merchantId: 71, name: 'Debe', createdAt: new Date(2026, 0, 1) },
    { id: 2, merchantId: 71, name: 'Abono', createdAt: new Date(2026, 0, 2) },
    { id: 3, merchantId: 72, name: 'Ajeno', createdAt: new Date(2026, 0, 3) },
  ];
  const facturas = [
    { merchantId: 71, customerId: 1, status: 'pending', total: 300 },
    { merchantId: 71, customerId: 2, status: 'pending', total: 100 }, { merchantId: 71, customerId: 2, status: 'pending', total: -250 },
    { merchantId: 72, customerId: 3, status: 'pending', total: 999 }, { merchantId: 72, customerId: 1, status: 'pending', total: 888 },
  ];
  const dobles = {
    customer: { findMany: async ({ where }) => clientes.filter((c) => c.merchantId === where.merchantId) },
    job: { groupBy: async () => [] }, charge: { findMany: async () => [] }, merchant: { findUnique: async () => null },
    invoice: { groupBy: async ({ where }) => {
      const por = new Map();
      for (const x of facturas.filter((x) => x.merchantId === where.merchantId && x.status === where.status)) {
        por.set(x.customerId, [...(por.get(x.customerId) ?? []), x]);
      }
      return [...por].map(([customerId, xs]) => ({ customerId, _sum: { total: xs.reduce((a, x) => a + x.total, 0) }, _count: { _all: xs.length } }));
    } },
  };
  const pedir = async (merchantId, query) => {
    const orig = {};
    for (const k of Object.keys(dobles)) { orig[k] = prisma[k]; prisma[k] = dobles[k]; }
    let cuerpo = null;
    const res = { status() { return res; }, json(b) { cuerpo = b; return res; } };
    try {
      const capa = router.stack.find((l) => l.route?.path === '/' && l.route.methods.get);
      await capa.route.stack.at(-1).handle(reqDeSesion({ rol: 'admin', merchantId, teamMemberId: 9, query }), res);
    } finally { for (const k of Object.keys(orig)) prisma[k] = orig[k]; }
    return cuerpo;
  };
  const todosM1 = await pedir(71, {});
  assert.equal(todosM1.find((c) => c.id === 2).saldoPendiente, -150, 'la cifra es la de la ficha, sin tocar');
  assert.deepEqual((await pedir(71, { conDeuda: '1' })).map((c) => [c.id, c.saldoPendiente]), [[1, 300]], '🔴 un abono entra como deuda');
  assert.deepEqual((await pedir(72, { conDeuda: '1' })).map((c) => [c.id, c.saldoPendiente]), [[3, 999]], 'otro merchant, sólo lo suyo');
});
