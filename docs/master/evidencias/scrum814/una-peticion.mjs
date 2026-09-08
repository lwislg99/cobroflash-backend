// SCRUM-814 · UNA petición, disparada en un INSTANTE ACORDADO.
//
//   node una-peticion.mjs <RAIZ> <quoteId> <merchantId> <epochMsDeSalida> <etiqueta>
//
// Va en su propio proceso a propósito. `Promise.all` dentro de un solo node NO es «dos peticiones
// simultáneas»: comparten bucle de eventos y pool de conexiones, y la primera medición así dio un
// falso «no se reproduce». Dos procesos con la misma hora de salida sí es una carrera.
//
// Lo lanza `carrera-de-tramos.mjs`, que es quien valida el destino de la base. La URL llega por
// entorno heredado; aquí no se escribe ninguna.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [RAIZ, quoteId, merchantId, salida, etiqueta] = process.argv.slice(2);
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';

const { prisma } = await import(DIST + 'core/db/prisma.js');
const mod = await import(DIST + 'modules/system/app/routes/quotesAdmin.routes.js');
const router = mod.default?.default ?? mod.default ?? mod.router;
const capa = router?.stack?.find((c) => c.route && c.route.path === '/:id/invoice' && c.route.methods.post);
if (!capa) {
  console.log(JSON.stringify({ etiqueta, code: -1, cuerpo: { error: 'NO ENCUENTRO POST /:id/invoice' } }));
  process.exit(3);
}
const handler = capa.route.stack.map((s) => s.handle).pop();

// Conexión ya abierta ANTES de la hora. Si el primer viaje a la base se pagara dentro de la
// carrera, uno de los dos saldría con ventaja y la carrera no sería tal.
await prisma.$queryRaw`SELECT 1`;

// Espera hasta el instante acordado; los últimos milisegundos a pelo, para no depender de un timer.
const objetivo = Number(salida);
while (Date.now() < objetivo - 20) await new Promise((r) => setTimeout(r, 5));
while (Date.now() < objetivo) { /* los últimos ms */ }

const res = { code: 200, cuerpo: null };
res.status = (c) => { res.code = c; return res; };
res.json = (b) => { res.cuerpo = b; return res; };
res.send = (b) => { res.cuerpo = b; return res; };

const t0 = Date.now();
try {
  await handler(
    { params: { id: String(quoteId) }, merchantId: Number(merchantId), teamMemberId: null, body: {}, query: {} },
    res,
    (e) => { throw e; },
  );
} catch (e) {
  res.code = 500;
  res.cuerpo = { error: 'excepcion', mensaje: e.message };
}
console.log(JSON.stringify({ etiqueta, arranque: t0 - objetivo, ms: Date.now() - t0, code: res.code, cuerpo: res.cuerpo }));
await prisma.$disconnect();
