// SCRUM-814 · ¿DOS PETICIONES SIMULTÁNEAS EMITEN EL MISMO TRAMO?
//
//   DATABASE_URL=<banco desechable en loopback, base *_test>  \
//     node docs/master/evidencias/scrum814/carrera-de-tramos.mjs
//
// Se corre el HANDLER REAL de `POST /admin/quotes/:id/invoice`, sacado del router de `dist/`
// (`router.stack`). No se re-implementa la lógica: se invoca la misma función que sirve la ruta
// en producción, con un `req`/`res` de juguete. El middleware `requireRole('admin')` se salta a
// propósito: el defecto está en el handler.
//
// ⛔ NO CONTIENE NINGUNA CADENA DE CONEXIÓN, ni real ni de ejemplo. La URL se lee del entorno y
// se valida con `parseBDSegura` (R7): sólo loopback y sólo una base terminada en `_test`. Si no
// lo es, ESTO NO ARRANCA — y no por prudencia decorativa: este banco EMITE FACTURAS.
//
// ⛔ No toca `schema.prisma` ni el camino de emisión. Sólo llama y lee.
//
// El banco se levanta como describe `docs/master/SCRUM-296.md` (tramo 2): Postgres portable,
// esquema derivado con `./node_modules/.bin/prisma migrate diff --from-empty` (NUNCA `npx`).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = process.argv[2] ?? path.resolve(AQUI, '..', '..', '..', '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';

// ── EL PORTÓN DE LA BASE ─────────────────────────────────────────────────────────────────────
const { parseBDSegura } = await import(pathToFileURL(path.join(RAIZ, 'scripts', '_db-guard.mjs')).href);
const destino = parseBDSegura(process.env.DATABASE_URL);
if (!destino) {
  console.error('🔴 Falta `DATABASE_URL` o no se puede leer. Este banco EMITE FACTURAS: sin '
    + 'destino comprobado no arranca.');
  process.exit(3);
}
if (!['127.0.0.1', 'localhost', '::1'].includes(destino.host) || !/_test$/.test(destino.base)) {
  console.error('🔴 DESTINO NO PERMITIDO · host=' + destino.host + ' base=' + destino.base
    + '. Sólo loopback y sólo una base terminada en `_test`.');
  process.exit(3);
}
console.log('banco → host=' + destino.host + ' puerto=' + destino.puerto + ' base=' + destino.base);
console.log('');

if (!fs.existsSync(path.join(RAIZ, 'dist'))) {
  console.error('🔴 no hay `dist/`: `npm run build` primero. Un banco que corre código viejo mide otro árbol.');
  process.exit(3);
}

const { prisma } = await import(DIST + 'core/db/prisma.js');
const mod = await import(DIST + 'modules/system/app/routes/quotesAdmin.routes.js');
// El `dist` es CJS: el `export default` del `.ts` queda en `mod.default.default`.
const router = mod.default?.default ?? mod.default ?? mod.router;

// ── SUELO · si no encuentro la ruta que la afirmación nombra, NO concluyo «no existe» ─────────
// El código puede haberse movido, y eso es un dato DISTINTO de «el defecto no está».
if (!router || !router.stack) {
  console.error('🔴 NO ENCUENTRO lo que se describe: el módulo no exporta un router de express.');
  process.exit(3);
}
const capa = router.stack.find((c) => c.route && c.route.path === '/:id/invoice' && c.route.methods.post);
if (!capa) {
  console.error('🔴 NO ENCUENTRO lo que se describe: no hay `POST /:id/invoice` en el router. '
    + 'Rutas presentes: ' + JSON.stringify(router.stack.filter((c) => c.route).map((c) => c.route.path)));
  process.exit(3);
}
const pila = capa.route.stack.map((s) => s.handle);
const handler = pila[pila.length - 1];   // el último de la cadena: el handler, no `requireRole`
console.log('handler localizado · POST /:id/invoice · ' + pila.length + ' capas (la última es el handler)');
console.log('');

function resDeJuguete() {
  const r = { code: 200, cuerpo: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.cuerpo = b; return r; };
  r.send = (b) => { r.cuerpo = b; return r; };
  return r;
}
async function pedirFactura(quoteId, merchantId) {
  const req = { params: { id: String(quoteId) }, merchantId, teamMemberId: null, body: {}, query: {} };
  const res = resDeJuguete();
  try { await handler(req, res, (e) => { throw e; }); }
  catch (e) { return { code: 500, cuerpo: { error: 'excepcion', mensaje: e.message } }; }
  return { code: res.code, cuerpo: res.cuerpo };
}

// ── SIEMBRA ──────────────────────────────────────────────────────────────────────────────────
// `percentage` va en FRACCIÓN (0,3 = 30 %): `validateCustomBillingPlan` exige
// `Σ round(percentage*100) === 100`. Con 30 y 70 los importes salían ×100.
// `tax` también va en fracción (0..1): `exigirTiposDeIvaEmitibles` (SCRUM-771) rechaza el 21.
//
// 🔴 Y EL PLAN ES DESIGUAL A PROPÓSITO — 30/70, no 50/50. Con dos tramos iguales las dos facturas
// de la carrera valen lo mismo y la suma cuadra con el total: el defecto parece una etiqueta mal
// puesta. Con 30/70 se ve lo que de verdad pasa, que es dinero que se queda sin facturar.
const PLAN = [{ label: 'Anticipo', percentage: 0.3 }, { label: 'Final', percentage: 0.7 }];
const LINEAS = [{ concept: 'Cuadro general', qty: 1, price: 1000, tax: 0.21 }];
const TOTAL = '1210.00';

const SUF = String(Date.now()).slice(-6);
const merchant = await prisma.merchant.create({
  data: { name: 'Tecnosel', legalName: 'Tecnosel SL', taxId: 'B12345678', country: 'ES',
    email: 'admin+' + SUF + '@tecnosel.test' },
});
const cliente = await prisma.customer.create({
  data: { merchantId: merchant.id, name: 'Ferreteria Pepe', email: 'pepe@ferre.test' },
});
const nuevoPresupuesto = () => prisma.quote.create({
  data: {
    merchantId: merchant.id, customerId: cliente.id, status: 'accepted',
    total: TOTAL, currency: 'EUR', lines: LINEAS, customBillingPlan: PLAN,
  },
});
const facturasDe = async (quoteId) => prisma.invoice.findMany({
  where: { quoteId }, orderBy: { id: 'asc' },
  select: { number: true, stageLabel: true, total: true },
});
const pinta = (fs_) => fs_.forEach((i) => console.log('     ' + i.number + ' · tramo «' + i.stageLabel + '» · ' + i.total + ' €'));

// ── CONTROL POSITIVO · una petición cada vez emite el tramo CORRECTO ──────────────────────────
console.log('CONTROL POSITIVO · dos peticiones SECUENCIALES sobre el mismo presupuesto:');
const qOK = await nuevoPresupuesto();
const s1 = await pedirFactura(qOK.id, merchant.id);
const s2 = await pedirFactura(qOK.id, merchant.id);
console.log('   1ª → HTTP ' + s1.code + '   2ª → HTTP ' + s2.code);
const secuencial = await facturasDe(qOK.id);
pinta(secuencial);

// 🔴 SUELO. La primera versión comparaba `new Set(t).size === t.length`, y con CERO facturas eso
// es `0 === 0` → «avanza de tramo ✔». Un verde por no mirar, y justo en el control que decide si
// el banco vale. Ahora se exige el NÚMERO: dos facturas y dos tramos distintos, o no se sigue.
const tramosOK = secuencial.map((i) => i.stageLabel);
const okSecuencial = secuencial.length === 2 && new Set(tramosOK).size === 2;
console.log('   ¿avanza de tramo?  ' + (okSecuencial
  ? 'SÍ — 2 facturas, 2 tramos distintos ✔'
  : '🔴 NO — ' + secuencial.length + ' factura(s), ' + new Set(tramosOK).size
    + ' tramo(s) distintos. El banco está mal montado y nada de abajo vale.'));
if (!okSecuencial) {
  console.error('   respuestas: 1ª=' + JSON.stringify(s1) + '  2ª=' + JSON.stringify(s2));
  process.exit(3);
}
console.log('');

// ── 🔴 EL CONTROL QUE DECIDE · dos peticiones SIMULTÁNEAS ─────────────────────────────────────
//
// DOS PROCESOS, no `Promise.all`. La primera versión lanzaba las dos llamadas en este mismo node:
// comparten bucle de eventos y pool de conexiones, y salió «no se reproduce». Era un FALSO
// NEGATIVO del banco, no un hecho del código — y un falso negativo en el camino del dinero es el
// peor resultado posible, porque cierra la pregunta. Dos procesos con la misma hora de salida sí
// compiten.
console.log('🔴 EL CONTROL QUE DECIDE · dos peticiones SIMULTÁNEAS al mismo presupuesto:');
const qRace = await nuevoPresupuesto();
// 9 s de margen: arrancar node + importar `dist` + abrir conexión tarda 2-3 s. Con 1,5 s la señal
// ya había pasado cuando el hijo llegaba a esperarla, y salieron con 934 ms de diferencia.
const salida = Date.now() + 9000;
const SALTO = String.fromCharCode(10);
const lanzar = (etiqueta) => new Promise((resolve) => {
  const p = spawn(process.execPath,
    [path.join(AQUI, 'una-peticion.mjs'), RAIZ, String(qRace.id), String(merchant.id), String(salida), etiqueta],
    { env: process.env });
  let out = ''; let err = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { err += d; });
  p.on('close', () => {
    const linea = out.split(SALTO).filter(Boolean).pop();
    try { resolve(JSON.parse(linea)); }
    catch { resolve({ etiqueta, code: -1, cuerpo: { error: 'sin salida', err: err.split(SALTO)[0] } }); }
  });
});
const [a, b] = await Promise.all([lanzar('A'), lanzar('B')]);
console.log('   A → HTTP ' + a.code + ' (arrancó ' + a.arranque + ' ms tras la señal, tardó ' + a.ms + ' ms)');
console.log('   B → HTTP ' + b.code + ' (arrancó ' + b.arranque + ' ms tras la señal, tardó ' + b.ms + ' ms)');
if (a.code >= 400 || a.code === -1) console.log('     A dice: ' + JSON.stringify(a.cuerpo));
if (b.code >= 400 || b.code === -1) console.log('     B dice: ' + JSON.stringify(b.cuerpo));
const carrera = await facturasDe(qRace.id);
pinta(carrera);

// 🔴 SUELO DE LA CARRERA. Si los dos no salieron a la vez, esto no ha medido concurrencia y un
// «no se reproduce» sería otra vez el falso negativo. Se dice, y no se concluye nada del código.
const desfase = Math.abs(a.arranque - b.arranque);
if (!(a.arranque < 120 && b.arranque < 120)) {
  console.log('');
  console.log('   🔴 NO HA HABIDO CARRERA: A arrancó ' + a.arranque + ' ms y B ' + b.arranque
    + ' ms tras la señal (desfase ' + desfase + ' ms). NO se concluye nada sobre el defecto.');
  process.exit(3);
}
console.log('   (salieron con ' + desfase + ' ms de desfase: la carrera es real)');

const tramos = carrera.map((i) => i.stageLabel);
const repetido = tramos.length > 1 && new Set(tramos).size < tramos.length;
console.log('');
console.log('   VEREDICTO: ' + (repetido
  ? '🔴 DOS FACTURAS DEL MISMO TRAMO («' + tramos[0] + '»). El defecto EXISTE.'
  : carrera.length < 2
    ? 'sólo ha salido ' + carrera.length + ' factura: mirar el código de la que falló'
    : 'los dos tramos son distintos: algo lo impide, el defecto NO se reproduce así'));

// ── LA CONSECUENCIA · ¿se puede emitir todavía el tramo que falta? ────────────────────────────
if (repetido) {
  console.log('');
  console.log('LA CONSECUENCIA · 3ª petición, la que emitiría el tramo que falta:');
  const tercera = await pedirFactura(qRace.id, merchant.id);
  console.log('   → HTTP ' + tercera.code + ' · ' + JSON.stringify(tercera.cuerpo));
  const facturado = (await facturasDe(qRace.id)).reduce((acc, i) => acc + Number(i.total), 0);
  console.log('   facturado en total: ' + facturado + ' € sobre un presupuesto de ' + TOTAL + ' €');
  console.log('   → ' + (Number(TOTAL) - facturado).toFixed(2) + ' € que ya NO se pueden facturar.');
}

await prisma.$disconnect();
