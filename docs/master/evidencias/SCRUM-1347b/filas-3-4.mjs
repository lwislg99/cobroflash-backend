// SCRUM-1347b · Las filas 3 y 4 de la tabla S1 del máster, medidas EJECUTANDO la ruta montada.
//
//   docs/YAQU_MASTER.md, Parte S1 (líneas 672 y 673 a 6d5bf76c5):
//     | Marcar pagado / deshacer | ✅ | ❌ |
//     | Configuración, datos fiscales, Connect, flags · billing/plan · equipo · exports | ✅ | ❌ |
//
// MÉTODO: el banco de la casa (`tests/_banco-camino-real.mjs`): la app REAL de `dist/app.js`, con su
// `requireAuth` y su `requireRole`, por HTTP, y Prisma doblado (apunta toda escritura). Cada ruta se
// pide dos veces: con la sesión de un Técnico y con la del propietario (rol `admin`, el positivo).
// No se lee el código para decidir: se mira lo que CONTESTA y lo que ESCRIBE.
//
// POBLACIÓN: todas las rutas /admin montadas (la misma enumeración que scrum55), y de ellas, las que
// casan con los patrones de abajo. ⚠️ El reparto de rutas a cada fila es MÍO: la fila nombra
// capacidades, no rutas. Las «vecinas» se miden igual pero no deciden la fila.
//
// VEREDICTO por ruta, para el Técnico: CIERRA (403 del gate de rol y 0 escrituras) · LLEGA (otra
// respuesta, o escribió) · NO-MONTADA (contesta lo mismo que una ruta que no existe).
// CONTROL POSITIVO, SEMBRADO: dos rutas de mentira montadas en memoria, una con `requireRole('admin')`
// y otra SIN gate que escribe. La primera tiene que salir CIERRA y la segunda LLEGA. Con
// `--sin-sembrar` no se montan y el fichero tiene que decir CIEGO (sale 2).
//
// Uso: NODE_PATH=<node_modules> node docs/master/evidencias/SCRUM-1347b/filas-3-4.mjs <raíz con dist/> [--sin-sembrar]
// Sale 0 si las dos filas se cumplen, 1 si alguna ruta de fila LLEGA al Técnico, 2 si CIEGO, 3 si no arranca.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const raiz = process.argv[2];
const SIN_SEMBRAR = process.argv.includes('--sin-sembrar');
const ciego = (m) => { console.log('CIEGO: ' + m); console.log('EXIT=2'); process.exit(2); };
if (!raiz) ciego('falta la raíz del árbol');
for (const ev of ['uncaughtException', 'unhandledRejection']) process.on(ev, (e) => ciego('el instrumento reventó (' + ev + '): ' + String((e && e.stack) || e).split('\n').slice(0, 2).join(' · ')));

// ── No arranca con credenciales: ejecuta manejadores de admin que pueden enviar (cicatriz J4, SCRUM-1390)
const CREDENCIALES = Object.keys(process.env).filter((k) => /^(WHATSAPP_|META_|RESEND|SMTP|GEMINI|ANTHROPIC|OPENAI|STRIPE|MERCADOPAGO|MP_|DATABASE_URL)/i.test(k));
if (CREDENCIALES.length) { console.log('NO ARRANCA: el entorno lleva ' + CREDENCIALES.join(', ')); console.log('EXIT=3'); process.exit(3); }

// ── Nada sale de aquí: la red que no es 127.0.0.1 se corta y se apunta
const req0 = createRequire(import.meta.url);
const fugas = [];
const esLocal = (h) => /^(127\.0\.0\.1|localhost|::1)$/.test(String(h || ''));
for (const mod of ['node:http', 'node:https']) {
  const m = req0(mod); const orig = m.request;
  m.request = function (...a) {
    let h = ''; try { h = typeof a[0] === 'string' ? new URL(a[0]).hostname : (a[0].hostname || a[0].host || (a[0].href && new URL(a[0].href).hostname)); } catch { /* se apunta igual */ }
    if (esLocal(h)) return orig.apply(this, a);
    fugas.push(mod + ':' + h); throw new Error('INSTRUMENTO: red cortada: ' + h);
  };
  m.get = function (...a) { const r = m.request(...a); r.end(); return r; };
}
globalThis.fetch = async (u) => { fugas.push('fetch:' + String(u)); throw new Error('INSTRUMENTO: fetch cortado'); };
process.env.PUBLIC_BASE_URL = 'http://127.0.0.1:9';

const { bancoDePrisma, montarAppReal, sesionesDe } = await import(pathToFileURL(path.join(raiz, 'tests', '_banco-camino-real.mjs')).href);
const reqDist = createRequire(path.join(raiz, 'tests', 'x.mjs'));

const MERCHANT = 1347;
const TECNICO = { id: 13472, name: 'Técnico 1347b', role: 'tecnico', active: true, merchantId: MERCHANT };
const ses = sesionesDe(MERCHANT, TECNICO);
// El comercio lleva MARCAS en lo fiscal y bancario: sirven para ver qué le llega al Técnico en GET /admin/merchant.
const MARCAS = { nif: 'NIF-MARCA-1347B', iban: 'ES00MARCA1347B', bizumPhone: '600MARCA1347', invoiceSeries: 'SERIE-MARCA-1347B' };
const comercio = { ...ses.merchant, country: 'ES', defaultCurrency: 'EUR', timezone: 'Europe/Madrid', flags: { MARCA_FLAG_1347B: true }, ...MARCAS };
const doble = bancoDePrisma();
// Toda consulta del doble se APUNTA, lecturas incluidas (el banco sólo apunta escrituras). Hace falta:
// un manejador que contesta su propio 404 puede dar el MISMO cuerpo que una ruta no montada, y en la
// primera pasada cinco rutas del admin salieron «NO-MONTADA» con su manejador corriendo (lo decía stderr).
const consultas = [];
const VACIO = { findUnique: null, findFirst: null, findMany: [], count: 0, aggregate: {}, groupBy: [], createMany: { count: 0 }, updateMany: { count: 0 }, deleteMany: { count: 0 }, delete: null };
const PROGRAMADAS = {
  authSession: ses.tabla,
  merchant: { findUnique: async () => comercio, findFirst: async () => comercio },
};
doble.programar(new Proxy(PROGRAMADAS, {
  get(t, modelo) {
    if (typeof modelo !== 'string') return undefined;
    const prog = t[modelo] || {};
    return new Proxy({}, { get(_x, op) {
      return async (args) => {
        consultas.push(modelo + '.' + String(op));
        if (prog[op]) return prog[op](args);
        if (['create', 'update'].includes(op)) return args?.data ?? null;
        if (op === 'upsert') return args?.create ?? null;
        return op in VACIO ? VACIO[op] : null;
      };
    } });
  },
}));
const banco = await montarAppReal();
const { app } = reqDist('../dist/app.js');
const { mountAdmin, getAdminMounts } = reqDist('../dist/core/http/adminMounts.js');
const { requireRole } = reqDist('../dist/core/http/authMiddleware.js');

// ── La siembra: un router de mentira, colocado DETRÁS de requireAuth y del último montaje real
const PREFIJO_SEMBRADO = '/admin/sembrada-1347b';
if (!SIN_SEMBRAR) {
  const express = reqDist('express');
  const r = express.Router();
  const { prisma } = reqDist('../dist/core/db/prisma.js');
  r.post('/cerrada', requireRole('admin'), async (_q, s) => { await prisma.sembrada1347b.create({ data: { x: 1 } }); s.json({ ok: 'sembrada-cerrada' }); });
  r.post('/abierta', async (_q, s) => { await prisma.sembrada1347b.create({ data: { x: 1 } }); s.json({ ok: 'sembrada-abierta' }); });
  const ultimo = getAdminMounts().at(-1).router;
  mountAdmin(app, PREFIJO_SEMBRADO, r);
  const pila = app.router.stack; const capa = pila.pop();
  const i = pila.findIndex((l) => l.handle === ultimo);
  if (i < 0) ciego('no encuentro el último montaje real para colocar la siembra');
  pila.splice(i + 1, 0, capa);
}

// ── La población: todas las rutas /admin montadas (como scrum55)
const montadas = new Map();
const anota = (metodo, ruta) => montadas.set(metodo.toUpperCase() + ' ' + ruta, { metodo: metodo.toUpperCase(), ruta });
for (const l of app.router.stack) if (l.route && typeof l.route.path === 'string' && l.route.path.startsWith('/admin')) for (const k of Object.keys(l.route.methods)) anota(k, l.route.path);
for (const mt of getAdminMounts()) for (const l of mt.router.stack) if (l.route) for (const k of Object.keys(l.route.methods)) anota(k, mt.prefix + (l.route.path === '/' ? '' : l.route.path));

const FILAS = [
  { fila: 'fila 3 · Marcar pagado / deshacer', decide: true, casa: [/^PUT \/admin\/invoices\/:id\/status$/, /^POST \/admin\/invoices\/bulk-paid$/, /^POST \/admin\/charges\/:id\/confirm-bizum$/] },
  { fila: 'fila 3 · vecinas (cobro, no «marcar pagado»)', decide: false, casa: [/^POST \/admin\/invoices\/:id\/payment-anomaly$/, /^POST \/admin\/charges\/:id\/garantia/] },
  { fila: 'fila 4 · Configuración, datos fiscales', decide: true, casa: [/^PUT \/admin\/merchant$/, /^POST \/admin\/onboarding\//, /^GET \/admin\/merchant\/public-profile-qr$/] },
  { fila: 'fila 4 · Connect', decide: true, casa: [/^\w+ \/admin\/connect\//] },
  { fila: 'fila 4 · flags', decide: true, casa: [/^\w+ \/admin\/[^ ]*flag/i] },
  { fila: 'fila 4 · billing/plan', decide: true, casa: [/^\w+ \/admin\/billing\//] },
  { fila: 'fila 4 · equipo', decide: true, casa: [/^\w+ \/admin\/team(\/|$)/] },
  { fila: 'fila 4 · exports', decide: true, casa: [/^\w+ \/admin\/exports\//] },
  { fila: 'fila 4 · vecinas (libros e informes que también exportan)', decide: false, casa: [/^GET \/admin\/libros\//, /^GET \/admin\/libro-registro$/, /^GET \/admin\/evidencias\.zip$/, /^GET \/admin\/modelo-303$/, /^GET \/admin\/reports\//] },
  { fila: 'SEMBRADA', decide: false, casa: [/^\w+ \/admin\/sembrada-1347b\//] },
];

const concreta = (ruta) => ruta.replace(/:merchantId/g, String(MERCHANT)).replace(/:[A-Za-z]+/g, '7');
const REFERENCIA = '/admin/no-existe-1347b';
const refPor = {};
async function pide(metodo, ruta, token) {
  doble.reiniciar(); consultas.length = 0;
  const r = await banco.pedir(ruta, { token, metodo, cuerpo: metodo === 'GET' ? undefined : {} });
  // Lo que consulta la sesión (requireAuth, requireActivePlan) no cuenta: sólo lo que consulta el manejador.
  const delManejador = consultas.filter((c) => !c.startsWith('authSession.'));
  return { status: r.status, texto: r.texto.slice(0, 400), escrituras: doble.escrituras.map((e) => e.modelo + '.' + e.op), delManejador };
}
const GATE = JSON.stringify({ error: 'forbidden', required_role: 'admin' });
function veredicto(x, ref) {
  if (x.status === ref.status && x.texto === ref.texto && x.delManejador.length <= ref.delManejador.length) return 'NO-MONTADA';
  if (x.status === 403 && x.texto === GATE && x.escrituras.length === 0) return 'CIERRA';
  return 'LLEGA';
}

const filas = [];
for (const f of FILAS) {
  const rutas = [...montadas.values()].filter((m) => f.casa.some((re) => re.test(m.metodo + ' ' + m.ruta)));
  const medidas = [];
  for (const m of rutas) {
    refPor[m.metodo] ??= await pide(m.metodo, REFERENCIA, ses.PROPIETARIO);
    const tec = await pide(m.metodo, concreta(m.ruta), ses.TECNICO);
    const adm = await pide(m.metodo, concreta(m.ruta), ses.PROPIETARIO);
    medidas.push({ ...m, tec, adm, vTec: veredicto(tec, refPor[m.metodo]), vAdm: veredicto(adm, refPor[m.metodo]) });
  }
  filas.push({ ...f, medidas });
}

// ── GET /admin/merchant: lo que VE el Técnico de la configuración (perfil reducido)
const verTec = await pide('GET', '/admin/merchant', ses.TECNICO);
const verAdm = await pide('GET', '/admin/merchant', ses.PROPIETARIO);
const marcasEn = (t) => Object.values(MARCAS).filter((v) => t.includes(v));

// ── «flags» no tiene ruta propia: ¿los escribe PUT /admin/merchant si el admin los manda en el cuerpo?
// Control del mismo envío: un campo que esa ruta SÍ guarda (`name`) tiene que aparecer en la escritura.
doble.reiniciar();
const putFlags = await banco.pedir('/admin/merchant', { token: ses.PROPIETARIO, metodo: 'PUT', cuerpo: { name: 'NOMBRE-MARCA-1347B', flags: { MARCA_FLAG_PUT_1347B: true } } });
const escrMerchant = JSON.stringify(doble.escrituras.filter((e) => e.modelo === 'merchant').map((e) => e.args));

// ── Informe
console.log('POBLACIÓN: ' + montadas.size + ' rutas /admin montadas' + (SIN_SEMBRAR ? ' (sin sembrar)' : ' (2 sembradas incluidas)') + ' · referencia «no montada»: ' + REFERENCIA);
let llegaEnFila = 0; let ciegoAdm = 0;
for (const f of filas) {
  console.log('\n== ' + f.fila + ' · ' + f.medidas.length + ' ruta(s)' + (f.decide ? '' : ' · no decide la fila'));
  for (const m of f.medidas) {
    console.log(`${m.metodo.padEnd(6)} ${m.ruta.padEnd(44)} técnico ${m.tec.status} ${m.vTec} (escr. ${m.tec.escrituras.length}) · admin ${m.adm.status} ${m.vAdm} (escr. ${m.adm.escrituras.length})`);
    if (m.vTec === 'LLEGA') console.log('         técnico: ' + m.tec.texto.slice(0, 160) + (m.tec.escrituras.length ? ' · escribe ' + m.tec.escrituras.join(',') : ''));
    if (m.vAdm !== 'LLEGA' || m.adm.status === 403) console.log('         admin: ' + m.adm.texto.slice(0, 160) + ' · consultas del manejador: ' + m.adm.delManejador.length);
    if (f.decide && m.vTec === 'LLEGA') llegaEnFila++;
    if (f.decide && m.vAdm !== 'LLEGA') ciegoAdm++;
  }
}
console.log('\n== GET /admin/merchant (ver la configuración)');
console.log(`técnico ${verTec.status} · marcas fiscales/bancarias que le llegan: ${marcasEn(verTec.texto).length} de ${Object.keys(MARCAS).length}` + ` · flag sembrado: ${verTec.texto.includes('MARCA_FLAG_1347B') ? 'sí' : 'no'}`);
console.log(`admin   ${verAdm.status} · marcas que le llegan: ${marcasEn(verAdm.texto).length} de ${Object.keys(MARCAS).length}`);
console.log('\n== flags: PUT /admin/merchant del ADMIN con {name, flags} en el cuerpo');
console.log(`admin ${putFlags.status} · escribe el nombre (control): ${escrMerchant.includes('NOMBRE-MARCA-1347B') ? 'sí' : 'NO'} · escribe flags: ${escrMerchant.includes('MARCA_FLAG_PUT_1347B') ? 'sí' : 'no'}`);
if (!escrMerchant.includes('NOMBRE-MARCA-1347B')) ciego('PUT /admin/merchant no escribe ni el nombre: el «no escribe flags» no significaría nada');
console.log('\nred cortada: ' + fugas.length + ' intento(s) de salir' + (fugas.length ? ' → ' + fugas.join(', ') : ''));

// ── Controles
const semb = filas.find((f) => f.fila === 'SEMBRADA').medidas;
const sc = semb.find((m) => m.ruta.endsWith('/cerrada')); const sa = semb.find((m) => m.ruta.endsWith('/abierta'));
if (!sc || !sa) ciego('las rutas sembradas no aparecen en la población: el instrumento no ve lo que se le monta');
if (sc.vTec !== 'CIERRA' || sc.vAdm !== 'LLEGA') ciego('la sembrada con gate no sale CIERRA/LLEGA: ' + sc.vTec + '/' + sc.vAdm);
if (sa.vTec !== 'LLEGA' || !sa.tec.escrituras.length) ciego('la sembrada SIN gate no sale LLEGA con escritura para el técnico');
if (marcasEn(verAdm.texto).length === 0) ciego('el admin no recibe ninguna marca del comercio: el doble no llega a GET /admin/merchant');
const vacias = filas.filter((f) => f.decide && f.medidas.length === 0).map((f) => f.fila);
console.log('controles: sembrada con gate → técnico ' + sc.vTec + ' / admin ' + sc.vAdm + ' · sembrada sin gate → técnico ' + sa.vTec + ' (escribe ' + sa.tec.escrituras.join(',') + ')');
console.log('grupos de fila sin ninguna ruta montada: ' + (vacias.length ? vacias.join(' | ') : 'ninguno'));
console.log('rutas de fila que el admin NO alcanza (positivo flojo): ' + ciegoAdm);
console.log('rutas de fila que LLEGAN al técnico: ' + llegaEnFila);
const codigo = llegaEnFila ? 1 : 0;
console.log('EXIT=' + codigo);
await banco.cerrar();
process.exit(codigo);
