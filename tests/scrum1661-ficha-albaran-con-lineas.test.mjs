// tests/scrum1661-ficha-albaran-con-lineas.test.mjs — SCRUM-1661 (P0 piloto)
//
// La ficha del albarán NO pintaba sus líneas ni su total. Medido en yaqu.app el 10-nov-2026 con el
// AB260006 (#51, VALORADO, 4 líneas, 242,36 €): 0 filas de línea, 0 textos con «€». Lo único que
// decía del contenido era «Pendiente de facturar · 4 líneas».
//
// DECISIÓN (SCRUM-1661, 11-nov-2026, opción A): la ficha enseña LO MISMO QUE EL PAPEL. Con
// `ocultarPreciosEnDocumento` encendido se ven las líneas sin precio, importe ni total, porque «si
// pantalla y papel no coinciden, el interruptor deja de hacer su trabajo». Cero texto nuevo: las
// cabeceras, «Base:», «Total:», la leyenda y «Sin líneas.» son las de `albaranPublicVista.ts`.
//
// Se pinta la pantalla de verdad (`renderAlbaranDetailView`, con los scripts de `index.html`) y se
// lee el DOM del banco.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// El AB260006 de la cuenta QA, tal como lo sirve `serializeAlbaran` (totales de `calcAlbaranTotales`).
const LINEAS = Object.freeze([
  { concepto: 'Tubo multicapa', cantidad: 12, unidad: 'm', precioUnitario: 3.85, tipoIva: 21 },
  { concepto: 'Codos', cantidad: 8, unidad: 'ud', precioUnitario: 2.4, tipoIva: 21 },
  { concepto: 'Grifo', cantidad: 1, unidad: 'ud', precioUnitario: 64.9, tipoIva: 21 },
  { concepto: 'Mano de obra', cantidad: 2, unidad: 'h', precioUnitario: 35, tipoIva: 21 },
]);
const ALBARAN = Object.freeze({
  id: 51, numero: 'AB260006', estado: 'emitido', modoValoracion: 'VALORADO',
  ocultarPreciosEnDocumento: false, estadoFacturacion: 'sin_facturar',
  quote: null, invoiceId: null, job: { id: 1, titulo: 'Baño' }, customer: { name: 'Ana Ruiz' },
  lineas: LINEAS,
  totales: { base: 200.3, cuota: 42.06, total: 242.36 },
});

function red(alb) {
  const resp = (status, data) => ({
    ok: status < 300, status, statusText: String(status), headers: { get: () => 'application/json' },
    json: async () => data, blob: async () => ({}), text: async () => JSON.stringify(data),
  });
  return {
    fetch: async (url) => (String(url).includes(`/admin/albaranes/${alb.id}`) ? resp(200, alb) : resp(200, {})),
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
  };
}

const texto = (n) => todos(n).filter((x) => x.tagName === '#text' || !x.hijos?.length)
  .map((x) => x.textContent || '').join(' ').replace(/\s+/g, ' ').trim();
const tiene = (n, clase) => typeof n.className === 'string' && n.className.split(/\s+/).includes(clase);

async function ficha(cambios = {}) {
  const alb = { ...ALBARAN, ...cambios };
  const banco = cargarDashboard(RAIZ, { red: red(alb) });
  banco.ctx.appModoEmision = 'fiscal';
  const v = await pintarVista(banco, 'renderAlbaranDetailView', alb.id);
  assert.ok(!v.error, `🔴 SUELO: la ficha no se pinta: ${v.error && v.error.message}`);
  const nodos = todos(v.contenedor);
  assert.ok(nodos.some((n) => tiene(n, 'detail-rail')), '🔴 SUELO: no veo el rail; la ficha no se ha pintado entera');
  const filas = nodos.filter((n) => n.tagName === 'TR' && n._padre && n._padre.tagName === 'TBODY');
  return { nodos, filas: filas.map(texto), todo: texto(v.contenedor) };
}

test('SCRUM-1661 · VALORADO con precios: las 4 líneas, su importe y el total 242,36 €', async () => {
  const f = await ficha();
  assert.equal(f.filas.length, 4, `🔴 LA FICHA NO PINTA LAS LÍNEAS DEL ALBARÁN: ${f.filas.length} filas (esperaba 4).`);
  assert.ok(f.filas[0].includes('Tubo multicapa') && f.filas[0].includes('12') && f.filas[0].includes('m'),
    `🔴 la primera fila no trae concepto, cantidad y unidad: «${f.filas[0]}»`);
  assert.ok(f.filas[0].includes('3,85') && f.filas[0].includes('46,20'), `🔴 la fila no lleva precio e importe: «${f.filas[0]}»`);
  assert.ok(f.filas[3].includes('70,00'), `🔴 la mano de obra no lleva su importe: «${f.filas[3]}»`);
  assert.ok(f.todo.includes('Base: 200,30'), '🔴 falta la Base, como en el papel');
  assert.ok(f.todo.includes('Total: 242,36'), '🔴 LA FICHA NO DICE EL TOTAL (242,36 €).');
  assert.ok(!f.todo.includes('42,06'), '🔴 la ficha enseña la cuota de IVA, que el papel no enseña');
  // La Regla del Importe (DESIGN.md:150): el total va en su clase, que lo pinta en Tinta, ≥700, tabular.
  const total = f.nodos.find((n) => tiene(n, 'albaran-lineas__total'));
  assert.ok(total && texto(total).includes('242,36'), '🔴 el total no va en `.albaran-lineas__total` (Regla del Importe)');
});

test('SCRUM-1661 · decisión A: con ocultarPreciosEnDocumento, las líneas SIN importes (lo mismo que el papel)', async () => {
  const f = await ficha({ ocultarPreciosEnDocumento: true });
  assert.equal(f.filas.length, 4, `🔴 con el interruptor encendido las líneas tienen que seguir: ${f.filas.length} filas`);
  assert.ok(f.filas[1].includes('Codos') && f.filas[1].includes('8'), `🔴 fila sin concepto/cantidad: «${f.filas[1]}»`);
  assert.ok(!/€|3,85|242,36|Total:/.test(f.todo), '🔴 el papel oculta los precios y la ficha los enseña');
});

test('SCRUM-1661 · SIN_VALORAR: líneas con concepto, cantidad y unidad, y ni un importe', async () => {
  const f = await ficha({ modoValoracion: 'SIN_VALORAR', totales: null,
    lineas: LINEAS.map(({ concepto, cantidad, unidad }) => ({ concepto, cantidad, unidad, precioUnitario: null })) });
  assert.equal(f.filas.length, 4);
  assert.ok(!/€|Total:/.test(f.todo), '🔴 un albarán sin valorar no lleva importes');
});

test('SCRUM-1661 · sin `totales` del servidor no se pintan importes, aunque diga VALORADO', async () => {
  // Es la puerta por la que el servidor recorta precios (1707): lo que no llega, no se calcula aquí.
  const f = await ficha({ totales: null });
  assert.equal(f.filas.length, 4);
  assert.ok(!/€|Total:/.test(f.todo), '🔴 la ficha calcula importes que el servidor no le ha mandado');
});

test('SCRUM-1661 · sin líneas: lo dice con el literal del papel', async () => {
  const f = await ficha({ lineas: [], totales: { base: 0, cuota: 0, total: 0 } });
  assert.equal(f.filas.length, 0);
  assert.ok(f.todo.includes('Sin líneas.'), '🔴 un albarán vacío no lo dice');
});
