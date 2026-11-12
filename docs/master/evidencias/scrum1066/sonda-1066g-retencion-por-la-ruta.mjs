// docs/master/evidencias/scrum1066/sonda-1066g-retencion-por-la-ruta.mjs — SCRUM-1066g
//
// ¿Un gasto dado de alta por la RUTA REAL, con la retención practicada en el cuerpo, llega a
// `expenses.retencion_practicada_*` y sale en el borrador del 111/115?
//
// SONDA DE MEDICIÓN, NO TEST: no la descubre `node --test` (no acaba en `.test.mjs`) y no bloquea
// nada. Se corre a mano, con `dist/` compilado:
//
//     node node_modules/typescript/bin/tsc -p . --noCheck
//     node docs/master/evidencias/scrum1066/sonda-1066g-retencion-por-la-ruta.mjs
//
// Banco: las RUTAS y el SERVICIO de verdad de `dist/`, con la base doblada por
// `tests/_envio-doblado.mjs` (el mismo banco que `tests/scrum937`). El doble guarda en memoria lo
// que `expense.create` / `expense.update` escriben, y `expense.findMany` devuelve eso mismo: el
// borrador lee exactamente lo que la ruta dejó. Se llama al ÚLTIMO manejador de cada ruta.
//
// Casos:
//   R1  POST con retención 15 % (111)                → ¿se guarda? ¿sale en el 111?
//   R2  POST «Alquiler de local» con retención 19 %  → ¿se guarda? ¿sale en el 115?
//   R3  PUT que solo añade la retención              → ¿la ruta la escribe?
//   S   createExpense (servicio) con la retención    → el servicio SÍ la acepta (dónde se corta)
//   P   POSITIVO SEMBRADO: las mismas filas escritas directamente en el doble → tienen que salir.
//       Si P sale vacío, el instrumento es CIEGO y nada de lo de arriba vale.
// Salida: 0 = medido · 2 = CIEGO.
import { createRequire } from 'node:module';
import { inyectarBase, moduloDeDist, MERCHANT } from '../../../../tests/_envio-doblado.mjs';

const RUTAS = '../dist/modules/expenses/app/routes/expenses.routes.js';
const SERVICIO = '../dist/modules/expenses/domain/expenses.service.js';
const requiere = createRequire(import.meta.url);
const repo = requiere('../../../../dist/modules/fiscal/retenciones/retencionesPracticadas.repo.js');

const PROV_SUB = 801;   // una subcontrata (111)
const PROV_LOCAL = 802; // el arrendador del local (115)
const AÑO = 2026, TRIM = 4, FECHA = '2026-10-15';

function banco() {
  const filas = [];
  let siguiente = 1000;
  inyectarBase({
    'provider.findFirst': ({ where }) =>
      ([PROV_SUB, PROV_LOCAL].includes(where.id) && where.merchantId === MERCHANT
        ? { id: where.id, merchantId: MERCHANT, taxId: 'B00000000' } : null),
    'quote.findFirst': () => null,
    'expense.create': ({ data }) => { const f = { id: siguiente++, vatDeducible: null, retencionPracticadaDeclarada: null, ...data }; filas.push(f); return { ...f }; },
    'expense.findFirst': ({ where }) => { const f = filas.find((x) => x.id === where.id && x.merchantId === where.merchantId); return f ? { ...f } : null; },
    'expense.updateMany': ({ where, data }) => { const f = filas.find((x) => x.id === where.id && x.merchantId === where.merchantId); if (!f) return { count: 0 }; Object.assign(f, data); return { count: 1 }; },
    'expense.update': ({ where, data }) => { const f = filas.find((x) => x.id === where.id); Object.assign(f, data); return { ...f }; },
    'expense.findMany': ({ where }) => filas.filter((f) => f.merchantId === where.merchantId
      && new Date(f.date) >= where.date.gte && new Date(f.date) <= where.date.lte).map((f) => ({ ...f })),
  }, [SERVICIO, RUTAS]);
  const router = moduloDeDist(RUTAS).default;
  const llamar = async (metodo, ruta, { body, params = {} }) => {
    const capa = router.stack.find((l) => l.route && l.route.path === ruta && l.route.methods[metodo]);
    if (!capa) throw new Error(`CIEGO: no encuentro ${metodo} ${ruta}`);
    const pila = capa.route.stack;
    const r = { status: 200, data: undefined };
    const res = { status(s) { r.status = s; return res; }, json(j) { r.data = JSON.parse(JSON.stringify(j)); return res; } };
    await pila[pila.length - 1].handle({ body, params, merchantId: MERCHANT, userRole: 'admin', teamMemberId: null }, res);
    return r;
  };
  const db = { expense: { findMany: async (a) => filas.filter((f) => f.merchantId === a.where.merchantId
    && new Date(f.date) >= a.where.date.gte && new Date(f.date) <= a.where.date.lte).map((f) => ({ ...f })) } };
  return { filas, llamar, db, servicio: moduloDeDist(SERVICIO) };
}

const resumen = (b) => ({
  '111.casilla07_perceptores': b.modelo111.actividadesEconomicasDinerarias.perceptores.valor,
  '111.casilla08_importe': b.modelo111.actividadesEconomicasDinerarias.importe.valor,
  '111.casilla09_retenciones': b.modelo111.actividadesEconomicasDinerarias.retenciones.valor,
  '115': JSON.stringify(b.modelo115).slice(0, 400),
  motivos: b.motivos ?? b.motivosParaNoFiarse ?? null,
});

const GASTO_111 = { concept: 'Subcontrata fontanería', amount: 1210, baseAmount: 1000, vatRate: 21, vatAmount: 210,
  providerId: PROV_SUB, providerInvoiceNumber: 'S-1', providerInvoiceDate: FECHA, date: FECHA, category: 'otros',
  retencionPracticadaTipo: 15, retencionPracticadaCuota: 150 };
const GASTO_115 = { concept: 'Alquiler nave octubre', amount: 726, baseAmount: 600, vatRate: 21, vatAmount: 126,
  providerId: PROV_LOCAL, providerInvoiceNumber: 'A-10', providerInvoiceDate: FECHA, date: FECHA, category: 'alquiler',
  retencionPracticadaTipo: 19, retencionPracticadaCuota: 114 };

const salida = {};

// ── R1 + R2: la ruta POST ────────────────────────────────────────────────────────────────────
{
  const b = banco();
  const r1 = await b.llamar('post', '/', { body: GASTO_111 });
  const r2 = await b.llamar('post', '/', { body: GASTO_115 });
  salida.R_post = {
    status: [r1.status, r2.status],
    guardado: b.filas.map((f) => ({ id: f.id, category: f.category, tipo: f.retencionPracticadaTipo ?? null, cuota: f.retencionPracticadaCuota ?? null })),
    borrador: resumen(await repo.leerBorradorRetenciones(b.db, { merchantId: MERCHANT, año: AÑO, trimestre: TRIM })),
  };
  // ── R3: el PUT, sobre el gasto 111 ya guardado ────────────────────────────────────────────
  const id = b.filas[0]?.id;
  const r3 = await b.llamar('put', '/:id', { body: { retencionPracticadaTipo: 15, retencionPracticadaCuota: 150 }, params: { id: String(id) } });
  salida.R_put = { status: r3.status, respuesta: r3.data, tipoTrasPut: b.filas[0]?.retencionPracticadaTipo ?? null };
}

// ── S: el servicio directo ───────────────────────────────────────────────────────────────────
{
  const b = banco();
  const { retencionPracticadaTipo, retencionPracticadaCuota, providerInvoiceDate, date, ...resto } = GASTO_111;
  await b.servicio.createExpense(MERCHANT, { ...resto, date: new Date(date), providerInvoiceDate: new Date(providerInvoiceDate),
    retencionPracticadaTipo, retencionPracticadaCuota });
  salida.S_servicio = {
    guardado: b.filas.map((f) => ({ tipo: f.retencionPracticadaTipo ?? null, cuota: f.retencionPracticadaCuota ?? null })),
    borrador: resumen(await repo.leerBorradorRetenciones(b.db, { merchantId: MERCHANT, año: AÑO, trimestre: TRIM })),
  };
}

// ── P: positivo sembrado — las filas escritas directamente en el doble ───────────────────────
{
  const b = banco();
  // `SONDA_SIN_POSITIVO=1` quita la siembra: la sonda TIENE que salir CIEGO (2), no «medido».
  const siembra = process.env.SONDA_SIN_POSITIVO === '1' ? [] : [GASTO_111, GASTO_115];
  for (const [i, g] of siembra.entries()) {
    b.filas.push({ id: 5000 + i, merchantId: MERCHANT, currency: 'EUR', retencionPracticadaDeclarada: null, ...g, date: new Date(g.date) });
  }
  salida.P_positivo = resumen(await repo.leerBorradorRetenciones(b.db, { merchantId: MERCHANT, año: AÑO, trimestre: TRIM }));
}

console.log(JSON.stringify(salida, null, 2));
const ciego = salida.P_positivo['111.casilla09_retenciones'] !== 150;
console.log(ciego ? 'VEREDICTO: CIEGO — el positivo sembrado no sale en el borrador' : 'VEREDICTO: medido (el positivo sale)');
process.exit(ciego ? 2 : 0);
