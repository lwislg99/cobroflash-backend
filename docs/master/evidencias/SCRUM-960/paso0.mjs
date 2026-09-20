// docs/master/evidencias/SCRUM-960/paso0.mjs — SCRUM-960 · PASO 0: ¿existe HOY el defecto?
//
// Pregunta: ¿puede hoy el alta o la edición de un PROVEEDOR escribir su NIF (`taxId`)?
// El ticket lo midió en staging; esto lo mide CORRIENDO contra el código compilado de este árbol.
//
// Cómo: se monta el router REAL de proveedores (`dist/modules/providers/app/routes/providers.routes.js`)
// en un express de verdad y se le hacen peticiones HTTP reales. La base se sustituye por un doble
// vía `global.prisma`, que es la costura que `dist/core/db/prisma.js` ya tiene (lee `global.prisma`
// si existe). NO se toca una sola línea de `src/`.
//
// 🔒 CONTROL POSITIVO, y es la mitad que decide: cada caso comprueba primero que un campo que SÍ se
//    acepta (`phone`) LLEGA a la base. Sin eso, un «taxId no llegó» sería indistinguible de una
//    sonda que no ve nada — y una sonda ciega da exactamente el resultado que uno quiere leer.
//
// Salida: población, cada caso con su veredicto, y EXIT= al final.
//   exit 0 = el defecto EXISTE hoy (que es lo que el ticket afirma)
//   exit 1 = el defecto NO existe (habría que parar y decirlo: A2)
//   exit 2 = sonda CIEGA (el control positivo no disparó): no se puede concluir nada.

import express from 'express';

// ── El doble de la base, puesto ANTES de cargar nada que lo use ──────────────────────────────
const llamadas = [];
const FILA = { id: 7, merchantId: 1, name: 'Almacén Pérez', phone: null, email: null, notes: null,
  legalName: null, taxId: null, isActive: true };

function anotar(op, args) { llamadas.push({ op, args }); }

global.prisma = {
  provider: {
    // Dos preguntas distintas llegan por aquí y NO pueden contestarse igual:
    //   · por `name` → es la comprobación de nombre duplicado del alta: tiene que decir «no hay».
    //   · por `id`   → es la ficha que la edición va a modificar: tiene que EXISTIR, o el PUT da
    //     404 y el control positivo no llega a ejercitar nada. (Me pasó: la sonda se declaró
    //     CIEGA en la primera pasada, que es exactamente para lo que estaba puesto el control.)
    findFirst: async (args) => {
      anotar('findFirst', args);
      const w = args?.where ?? {};
      if (w.id !== undefined) return { ...FILA, id: w.id };
      return null;
    },
    findUnique: async (args) => { anotar('findUnique', args); return { ...FILA }; },
    findMany: async (args) => { anotar('findMany', args); return [{ ...FILA, taxId: 'A58818501' }]; },
    create: async (args) => { anotar('create', args); return { ...FILA, ...args.data, id: 7 }; },
    update: async (args) => { anotar('update', args); return { ...FILA, ...args.data, id: 7 }; },
    updateMany: async (args) => { anotar('updateMany', args); return { count: 1 }; },
    count: async (args) => { anotar('count', args); return 0; },
  },
  expense: { count: async () => 0 },
  product: { count: async () => 0 },
};

const mod = await import('../../../../dist/modules/providers/app/routes/providers.routes.js');
const router = mod.default?.default ?? mod.default;
if (typeof router !== 'function') {
  console.error('SONDA CIEGA: el router de proveedores no se cargó. EXIT=2');
  process.exit(2);
}

// ── El servidor, con el merchant inyectado como hace el `requireAuth` de verdad ───────────────
const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.merchantId = 1; next(); });
app.use('/admin/providers', router);
const server = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)); });
const BASE = `http://127.0.0.1:${server.address().port}/admin/providers`;

const NIF = 'A58818501'; // CIF con dígito de control válido (el mismo que usa el banco de 912)

async function pedir(metodo, ruta, cuerpo) {
  llamadas.length = 0;
  const r = await fetch(BASE + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const json = await r.json().catch(() => null);
  return { status: r.status, json, llamadas: llamadas.slice() };
}

/** Los datos que de verdad se le mandaron a la base en la última petición. */
function datosEscritos(res) {
  const esc = res.llamadas.find((l) => l.op === 'create' || l.op === 'update' || l.op === 'updateMany');
  return esc ? { op: esc.op, data: esc.args?.data ?? null } : null;
}

const casos = [];
const anota = (nombre, veredicto, detalle) => { casos.push({ nombre, veredicto, detalle }); };

// ── CASO 1 · ALTA con NIF ────────────────────────────────────────────────────────────────────
{
  const res = await pedir('POST', '/', { name: 'Almacén Pérez', phone: '600111222', taxId: NIF });
  const esc = datosEscritos(res);
  const vioPhone = esc?.data?.phone === '600111222';           // control positivo
  const vioTaxId = Object.prototype.hasOwnProperty.call(esc?.data ?? {}, 'taxId');
  anota('POST /admin/providers con taxId',
    !vioPhone ? 'CIEGO' : vioTaxId ? 'ACEPTA EL NIF' : 'IGNORA EL NIF',
    `HTTP ${res.status} · op ${esc?.op} · campos escritos: ${Object.keys(esc?.data ?? {}).join(', ') || '(ninguno)'}` +
    ` · control positivo phone=${vioPhone ? 'LLEGÓ' : 'NO LLEGÓ'}`);
}

// ── CASO 2 · EDICIÓN con SOLO el NIF ─────────────────────────────────────────────────────────
{
  const res = await pedir('PUT', '/7', { taxId: NIF });
  const esc = datosEscritos(res);
  anota('PUT /admin/providers/7 con solo taxId',
    esc ? 'ACEPTA EL NIF' : 'IGNORA EL NIF',
    `HTTP ${res.status} · error ${res.json?.error ?? '-'} · escritura a la base: ${esc ? esc.op : 'NINGUNA'}`);
}

// ── CASO 2bis · CONTROL POSITIVO de la edición: un campo que SÍ se acepta ─────────────────────
{
  const res = await pedir('PUT', '/7', { phone: '600999888' });
  const esc = datosEscritos(res);
  const ok = res.status === 200 && esc?.data?.phone === '600999888';
  anota('PUT /admin/providers/7 con phone (control positivo)',
    ok ? 'LA EDICIÓN FUNCIONA' : 'CIEGO',
    `HTTP ${res.status} · op ${esc?.op ?? '-'} · campos: ${Object.keys(esc?.data ?? {}).join(', ') || '(ninguno)'}`);
}

// ── CASO 3 · ¿la ficha al menos DEVUELVE el NIF que ya tenga? ────────────────────────────────
{
  llamadas.length = 0;
  const r = await fetch(BASE + '/', { headers: { 'Content-Type': 'application/json' } });
  const json = await r.json().catch(() => null);
  const item = json?.items?.[0] ?? null;
  const devuelve = item ? Object.prototype.hasOwnProperty.call(item, 'taxId') : null;
  anota('GET /admin/providers · ¿el listado trae el taxId?',
    devuelve === null ? 'CIEGO' : devuelve ? 'SÍ LO DEVUELVE' : 'NO LO DEVUELVE',
    `HTTP ${r.status} · campos del item: ${item ? Object.keys(item).join(', ') : '(sin item)'}`);
}

server.close();

// ── Veredicto ────────────────────────────────────────────────────────────────────────────────
console.log(`POBLACIÓN: ${casos.length} casos sobre el router REAL de proveedores (dist/), base doblada, sin red.\n`);
for (const c of casos) {
  console.log(`  [${c.veredicto}] ${c.nombre}`);
  console.log(`      ${c.detalle}`);
}

const ciego = casos.some((c) => c.veredicto === 'CIEGO');
const alta = casos[0].veredicto;
const edicion = casos[1].veredicto;

console.log('');
// ⚠️ `process.exit()` con el servidor recién cerrado aborta el proceso en Windows
// («Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)») y devuelve 0xC0000409 en vez del
// código que uno quería: el veredicto se pierde y queda un número que no significa nada.
// Se fija `process.exitCode` y se deja salir a node solo.
if (ciego) {
  console.error('SONDA CIEGA: un control positivo no disparó. No se concluye nada.');
  console.log('EXIT=2');
  process.exitCode = 2;
} else if (alta === 'IGNORA EL NIF' && edicion === 'IGNORA EL NIF') {
  console.log('DEFECTO CONFIRMADO HOY: ni el alta ni la edición de un proveedor pueden escribir su NIF.');
  console.log('EXIT=0');
  process.exitCode = 0;
} else {
  console.error(`EL DEFECTO NO SE REPRODUCE: alta=${alta}, edición=${edicion}. Parar y decirlo (A2).`);
  console.log('EXIT=1');
  process.exitCode = 1;
}
