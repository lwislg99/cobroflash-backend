// SCRUM-920 · L12 · SONDA de solo lectura: el peso de GET /admin/expenses con fotos (20-sep-2026).
// Ruta y servicio REALES (dist/), base doblada por tests/_envio-doblado.mjs; sin red, sin base.
// Se corre desde la raiz del repo con dist/ compilado (npm run build):
//   node docs/prototipos/SCRUM-920/sonda-peso-lista-gastos.mjs
// Mide el MECANISMO (bytes de la respuesta = filas x tamano de la foto). El tamano REAL de una foto
// guardada NO esta medido: el tope es FOTO_TECHO_DATAURI = 1.5 MiB (expensesView.js).
import { inyectarBase, moduloDeDist, MERCHANT } from '../../../tests/_envio-doblado.mjs';
const RUTAS = '../dist/modules/expenses/app/routes/expenses.routes.js';
const SERVICIO = '../dist/modules/expenses/domain/expenses.service.js';
let argsDelFindMany = null;
let filas = [];
inyectarBase({ 'expense.findMany': (a) => { argsDelFindMany = a; return filas; } }, [SERVICIO, RUTAS]);
const router = moduloDeDist(RUTAS).default;
const capa = router.stack.find((l) => l.route && l.route.path === '/' && l.route.methods.get);
const manejador = capa.route.stack[capa.route.stack.length - 1].handle;
const pedir = async () => {
  let cuerpo = '';
  const res = { status() { return res; }, json(j) { cuerpo = JSON.stringify(j); return res; } };
  await manejador({ query: { month: '2026-09' }, merchantId: MERCHANT, userRole: 'admin' }, res);
  return cuerpo;
};
const uri = (bytes) => 'data:image/jpeg;base64,' + 'A'.repeat(bytes - 23);
const KB = 1024;
const MB = 1024 * 1024;
for (const [n, foto] of [[20, 0], [20, 500 * KB], [20, 1.5 * MB], [60, 500 * KB], [60, 1.5 * MB], [200, 1.5 * MB]]) {
  filas = Array.from({ length: n }, (_, i) => ({
    id: i + 1, merchantId: MERCHANT, concept: 'Tubo', amount: 10, category: 'otros', date: new Date(),
    quoteId: null, receiptData: foto ? uri(foto) : null, quote: null, provider: null,
  }));
  const cuerpo = await pedir();
  console.log(`${String(n).padStart(3)} gastos x foto ${(foto / MB).toFixed(2)} MiB -> respuesta ${(Buffer.byteLength(cuerpo) / MB).toFixed(2)} MiB`);
}
console.log('findMany con select?:', argsDelFindMany && 'select' in argsDelFindMany ? 'SI' : 'NO (include sin select: trae TODAS las columnas, receipt_data incluida)');
console.log('take:', argsDelFindMany?.take);
