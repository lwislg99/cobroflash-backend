// SCRUM-1232b · PASO 0 — la sonda de J1 (comentario 17411), repetida. SÓLO LEE: cliente Prisma
// falso en memoria, ninguna base. Ejecuta las funciones REALES de `dist/` (compilar antes con tsc).
// Uso, desde la raíz del repo: node docs/master/evidencias/SCRUM-1232b/sonda-libro-303.mjs
// La segunda pasada SIMULA el filtro `type: { not: 'JUST' }` en el cliente falso, no en `src/`.
import { createRequire } from 'node:module';
const require = createRequire(process.cwd() + '/');
const { leerLibroRegistro } = require('./dist/modules/invoicing/domain/libroRegistro.repo.js');
const { leerLibroRecibidas } = require('./dist/modules/invoicing/domain/libroRecibidas.repo.js');
const { construirModelo303 } = require('./dist/modules/fiscal/modelo303/modelo303.js');
const d = new Date('2026-08-10T10:00:00Z');
const fila = (id, m, number, type, price) => ({ id, merchantId: m, number, createdAt: d, paidAt: d, type,
  total: price * 1.21, currency: 'EUR', status: 'paid', customerId: null, quoteId: null, chargeId: null,
  albaranRefs: null, lines: [{ desc: 'x', qty: 1, price, tax: 0.21 }] });
const FILAS = [fila(1, 7, 'F260001', 'F1', 100), fila(2, 7, 'J-2026-0001', 'JUST', 200),
  fila(3, 7, 'R260001', 'R1', -100), fila(4, 8, 'F260009', 'F1', 999)];
const aplica = (w, r) => r.merchantId === w.merchantId && (!w.type || r.type !== w.type.not);
let wherePedido;
const db = (conFiltro) => ({
  invoice: { findMany: async (a) => { wherePedido = a.where; const w = conFiltro ? { ...a.where, type: { not: 'JUST' } } : a.where; return FILAS.filter((r) => aplica(w, r)); } },
  quote: { findMany: async () => [] }, albaran: { findMany: async () => [] }, expense: { findMany: async () => [] },
});
for (const conFiltro of [false, true]) {
  const x = db(conFiltro);
  const libro = await leerLibroRegistro(x, { merchantId: 7, desde: new Date('2026-07-01'), hasta: new Date('2026-09-30T23:59:59Z') });
  const rec = await leerLibroRecibidas(x, { merchantId: 7, desde: new Date('2026-07-01'), hasta: new Date('2026-09-30T23:59:59Z') });
  const m = construirModelo303({ libro, libroRecibidas: rec, año: 2026, trimestre: 3 });
  const c = m.casillas.map((k) => k.casillaBase + "=" + k.base + "/" + k.casillaCuota + "=" + k.cuota);
  console.log(conFiltro ? 'SIMULANDO filtro' : 'main TAL CUAL', '| where =', JSON.stringify(wherePedido),
    '| asientos =', libro.asientos.map((a) => a.tipo + ':' + a.numero).join(','),
    '| casillas =', c.join(" "), "| 27 =", m.casillaTotalCuota.valor, "| totalBase =", m.totalBase);
}
