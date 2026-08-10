// tests/scrum285-pantalla-cobros.test.mjs — SCRUM-285 (B4)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL TEST QUE DECIDE: **un cobro marcado A MANO aparece en la lista.**
//
// Un cobro por transferencia o efectivo NO crea `Charge` — medido: `invoiceAdmin.ts` marca
// `paidAt` en la Invoice y no toca `Charge`. Una pantalla de Cobros que listara solo `Charge`
// escondería justo el dinero que el profesional marca a mano, que es el que más necesita repasar.
// Eso no es una pantalla incompleta: **es una pantalla que miente por omisión.**
//
// Se comprueba dos veces y por sitios distintos, porque se puede romper por los dos:
//   · en el SERVIDOR, que la consulta de facturas sin charge siga existiendo;
//   · en la PANTALLA, que un cobro sin método sobreviva a los filtros.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { entradasDeLaBarra, vistasDelRouter, AUSENCIAS_CONOCIDAS } from './_barra-lateral.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVICIO = fs.readFileSync(
  path.join(RAIZ, 'src/modules/billing/domain/cobros.service.ts'), 'utf8');

/** Un cobro con Charge (tarjeta) y uno marcado A MANO (sin charge, sin método). */
const COBROS = [
  {
    origen: 'charge', id: 1, fecha: '2026-08-01T10:00:00.000Z', cliente: 'Con pasarela',
    concepto: 'Reforma', importe: '100.00', moneda: 'EUR', metodo: 'card', estado: 'paid',
    referencia: null, numero: null, tipo: null, invoiceId: null, chargeId: 1,
  },
  {
    origen: 'invoice', id: 2, fecha: '2026-08-02T10:00:00.000Z', cliente: 'A mano',
    concepto: null, importe: '250.00', moneda: 'EUR', metodo: null, estado: 'paid',
    referencia: null, numero: 'J-20260802-AB12', tipo: null, invoiceId: 2, chargeId: null,
  },
  {
    origen: 'invoice', id: 3, fecha: '2026-07-01T10:00:00.000Z', cliente: 'Me debe',
    concepto: null, importe: '80.00', moneda: 'EUR', metodo: null, estado: 'pending',
    referencia: null, numero: 'F-2026-0007', tipo: null, invoiceId: 3, chargeId: null,
  },
];

const textos = (n) => todos(n).map((x) => x.textContent).filter(Boolean);
const botonesFiltro = (n) => todos(n)
  .filter((x) => x.tagName === 'BUTTON' && x.dataset && x.dataset.filtroCobro);

// ═══ SUELOS ═══════════════════════════════════════════════════════════════════════════════

test('SCRUM-285 · SUELO: la pantalla pinta y el escáner la ve', async () => {
  const banco = cargarDashboard(RAIZ, { datos: COBROS });
  const r = await pintarVista(banco, 'renderCobrosView');
  assert.equal(r.error, null, `🔴 la pantalla de Cobros revienta: ${r.error && r.error.message}`);
  assert.ok(r.nodos > 5,
    `🔴 ESCÁNER CIEGO: la vista pintó ${r.nodos} nodos. Una pantalla vacía y un escáner roto dan ` +
    'el mismo verde, y aquí lo vacío significaría «no le deben nada a nadie».');
  assert.ok(botonesFiltro(r.contenedor).length >= 5,
    '🔴 no se ven los filtros: si el detector no los encuentra, lo de abajo no mide nada.');
});

// ═══ ① EL POSITIVO QUE SEPARA ESTA PANTALLA DE LA QUE ESCONDE DINERO ═════════════════════

test('SCRUM-285 · ① un cobro por transferencia (SIN Charge) APARECE en la lista', async () => {
  const banco = cargarDashboard(RAIZ, { datos: COBROS });
  const r = await pintarVista(banco, 'renderCobrosView');
  const pintado = textos(r.contenedor).join(' | ');
  assert.match(pintado, /A mano/,
    '🔴 el cobro marcado A MANO no se pinta. Es el que no pasa por pasarela —transferencia y ' +
    'efectivo no crean `Charge`— y es justo el que el profesional necesita repasar. Una pantalla ' +
    'que lo esconde miente por omisión.');
  assert.match(pintado, /Con pasarela/, 'suelo: el de pasarela sí sale, así que el filtro no está vacío.');
});

test('SCRUM-285 · ① y NO desaparece al filtrar: tiene su propio cubo', async () => {
  // Sin cubo para «no consta», el cobro a mano se esconde en cuanto tocas cualquier filtro: la
  // misma mentira, colándose por otro sitio.
  const banco = cargarDashboard(RAIZ, { datos: COBROS });
  const r = await pintarVista(banco, 'renderCobrosView');
  const claves = botonesFiltro(r.contenedor).map((b) => b.dataset.filtroCobro);
  assert.ok(claves.includes('sin-metodo'),
    '🔴 no hay cubo para los cobros SIN método registrado. `Invoice` no guarda método —medido en ' +
    'el esquema— así que sin este cubo el dinero marcado a mano desaparece al filtrar.');
  assert.equal(banco.ctx.cuboDeMetodo(null), 'sin-metodo',
    '🔴 un cobro sin método no cae en su cubo: caería en «otro», que es inventarse el dato.');
});

test('SCRUM-285 · ① el SERVIDOR sigue leyendo LAS DOS poblaciones', () => {
  // El otro sitio por donde se rompe: que alguien «simplifique» el servicio a solo charges.
  assert.match(SERVICIO, /prisma\.charge\.findMany/,
    '🔴 el servicio ya no lee `Charge`: falta la mitad que sí pasa por pasarela.');
  assert.match(SERVICIO, /prisma\.invoice\.findMany/,
    '🔴 el servicio ya no lee `Invoice`: se ha quedado en la mitad que ESCONDE el dinero marcado ' +
    'a mano. Es exactamente el defecto que este ticket existe para no cometer.');
  assert.match(SERVICIO, /chargeId:\s*null/,
    '🔴 la consulta de facturas ya no filtra por `chargeId: null`: sin eso, las que sí tienen ' +
    'charge se cuentan DOS veces.');
});

// ═══ ② LA ENTRADA Y SU PANTALLA, EN EL MISMO SITIO ═══════════════════════════════════════

test('SCRUM-285 · ② la entrada `Cobros` lleva a una pantalla que existe y que ABRE', async () => {
  const barra = entradasDeLaBarra(path.join(RAIZ, 'public/dashboard/index.html'));
  const entrada = barra.entradas.find((e) => e.vista === 'cobros');
  assert.ok(entrada, '🔴 no hay entrada `Cobros` en la barra.');
  assert.equal(entrada.rotulo, 'Cobros',
    '🔴 el rótulo aprobado es «Cobros», literal del diseño §B1.');
  assert.equal(entrada.grupo, 'Venta',
    '🔴 `Cobros` va en VENTA: cierra el ciclo Presupuestos → Albaranes → Facturas → Cobros.');
  assert.ok(vistasDelRouter(path.join(RAIZ, 'public/dashboard/js/app.js')).has('cobros'),
    '🔴 la entrada existe y el router no conoce la vista: promesa rota.');

  // Y que ABRE, que es lo que el `case` no dice.
  const banco = cargarDashboard(RAIZ, { datos: COBROS });
  const r = await pintarVista(banco, 'renderCobrosView');
  assert.equal(r.error, null, '🔴 la entrada lleva a una pantalla que revienta al abrirse.');
});

test('SCRUM-285 · ② la declaración de AUSENCIA ha desaparecido', () => {
  assert.ok(!('cobros' in AUSENCIAS_CONOCIDAS),
    '🔴 `Cobros` sigue declarada como ausente y ya está construida. Un hueco declarado sobre algo ' +
    'que existe manda a la siguiente sesión a hacer trabajo hecho.');
});

// ═══ ③ LA DEUDA, y su fecha ══════════════════════════════════════════════════════════════

test('SCRUM-285 · ③ la antigüedad es de lo NO cobrado, y se mide desde que se pidió', () => {
  const banco = cargarDashboard(RAIZ, { datos: COBROS });
  const pendiente = COBROS[2];
  const cobrado = COBROS[1];
  const ahora = new Date('2026-07-31T10:00:00.000Z');
  assert.equal(banco.ctx.diasDeDeudaCobro(pendiente, ahora), 30,
    '🔴 la antigüedad de la deuda no sale de la fecha en que se pidió el cobro. Es la única ' +
    'fiable: `paidAt` y `updatedAt` son la fecha de REGISTRO, nunca la del ingreso (hallazgo E0).');
  assert.equal(banco.ctx.diasDeDeudaCobro(cobrado, ahora), null,
    '🔴 un cobro YA COBRADO no tiene antigüedad de deuda: no se debe nada.');
});

// ═══ ④ CONTROL NEGATIVO ══════════════════════════════════════════════════════════════════

test('SCRUM-285 · ④ NEGATIVO: un método conocido NO cae en el cubo de «no consta»', async () => {
  // Sin esto, el cubo podría tragárselo todo y el test ① pasaría por avería.
  const banco = cargarDashboard(RAIZ, { datos: COBROS });
  await pintarVista(banco, 'renderCobrosView');
  assert.equal(banco.ctx.cuboDeMetodo('card'), 'card');
  assert.equal(banco.ctx.cuboDeMetodo('transfer'), 'transfer');
  assert.equal(banco.ctx.cuboDeMetodo('cash'), 'cash');
});

test('SCRUM-285 · ④ los dos Bizum caen en UN filtro, y la fila conserva cuál es', async () => {
  // El diseño nombra cuatro métodos porque el profesional piensa en cuatro. `bizum_auto` y
  // `bizum_manual` es una distinción nuestra: filtrar por cuatro, leer los cinco.
  const banco = cargarDashboard(RAIZ, { datos: COBROS });
  const r = await pintarVista(banco, 'renderCobrosView');
  assert.equal(banco.ctx.cuboDeMetodo('bizum_auto'), 'bizum');
  assert.equal(banco.ctx.cuboDeMetodo('bizum_manual'), 'bizum');
  const claves = botonesFiltro(r.contenedor).map((b) => b.dataset.filtroCobro);
  assert.ok(!claves.includes('bizum_auto') && !claves.includes('bizum_manual'),
    '🔴 la barra de filtros expone la distinción interna: le añade al profesional un concepto ' +
    'que no tiene. Se lee en la fila, no se filtra por ella.');
});

// ═══ ⑤ MICROCOPY (regla 30) ══════════════════════════════════════════════════════════════

test('SCRUM-285 · ⑤ solo se publica el texto APROBADO; el resto lleva marcador', async () => {
  const banco = cargarDashboard(RAIZ, { datos: COBROS });
  const r = await pintarVista(banco, 'renderCobrosView');
  const rotulos = botonesFiltro(r.contenedor).map((b) => b.textContent);
  // Los cuatro del diseño, literales.
  for (const m of ['Bizum', 'tarjeta', 'transferencia', 'efectivo']) {
    assert.ok(rotulos.includes(m),
      `🔴 falta el filtro «${m}», que el diseño §B4 nombra literalmente.`);
  }
  // Todo lo demás que se ve, con marcador: título, cabeceras, estado vacío, «sin método».
  const sinAprobar = rotulos.filter((t) => !['Bizum', 'tarjeta', 'transferencia', 'efectivo'].includes(t));
  for (const t of sinAprobar) {
    assert.match(t, /^\[PENDIENTE microcopy oficial\]/,
      `🔴 «${t}» es redacción nueva sin aprobar y se publica sin marcador (regla 30).`);
  }
});
