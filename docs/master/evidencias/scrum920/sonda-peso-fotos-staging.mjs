// SCRUM-920d · L12 · SONDA de SOLO LECTURA: cuanto pesa de verdad la foto de un gasto en staging.
// Uso: node docs/master/evidencias/scrum920/sonda-peso-fotos-staging.mjs
// Staging, merchant QA. Hace login de QA (POST /auth/test-login) y despues SOLO `GET`: la lista de
// gastos de los ultimos meses y la foto de cada gasto que dice `tieneFoto`. No crea, no edita, no
// borra. El secreto se lee en tiempo de ejecucion y no se imprime (regla 9).
// Sustituye a la afirmacion de sonda-peso-lista-gastos.mjs (que midio el MECANISMO con una foto
// inventada de 0,49 / 1,5 MiB): aqui el tamano es el de las fotos que HAY guardadas.
import fs from 'node:fs';

const BASE = 'https://yaqu-staging-production.up.railway.app';
if (!/yaqu-staging/.test(BASE)) { console.error('no es staging'); process.exit(2); }
const m = fs.readFileSync('D:/MILLONARIO/cobroFlash/e2e-staging-secret.txt', 'utf8').match(/^E2E_TEST_LOGIN_SECRET=(.+)$/m);
if (!m) { console.error('sin clave de login'); process.exit(2); }
console.log('TESTIGO · sonda peso de fotos contra ' + BASE);

const KIB = 1024;
const kib = (n) => (n / KIB).toFixed(1) + ' KiB';

const login = await fetch(BASE + '/auth/test-login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'qa@staging.yaqu', secret: m[1].trim() }),
});
if (login.status !== 200) { console.log('login ' + login.status); console.log('EXIT=1'); process.exit(1); }
const galleta = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
if (!/pf_session=/.test(galleta)) { console.log('login 200 pero sin pf_session'); console.log('EXIT=1'); process.exit(1); }
const pedir = (ruta) => fetch(BASE + ruta, { headers: { cookie: galleta } });

const version = await (await fetch(BASE + '/version')).json().catch(() => null);
console.log('version desplegada:', version && version.version);

// Ultimos 12 meses (la pantalla ofrece 6; con 12 se ve si hay historia con fotos).
const hoy = new Date();
const meses = [];
for (let i = 0; i < 12; i++) {
  const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - i, 1));
  meses.push(d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'));
}

const vistos = new Map(); // id -> { mes, tieneFoto }
const filasPorMes = [];
for (const mes of meses) {
  const t0 = Date.now();
  const r = await pedir('/admin/expenses?month=' + mes);
  const buf = Buffer.from(await r.arrayBuffer());
  const ms = Date.now() - t0;
  let items = [];
  try { items = JSON.parse(buf.toString('utf8')).items || []; } catch { /* queda vacio */ }
  for (const it of items) vistos.set(it.id, { mes, tieneFoto: it.tieneFoto === true, receiptDataEnLista: 'receiptData' in it });
  filasPorMes.push({ mes, status: r.status, gastos: items.length, conFoto: items.filter((i) => i.tieneFoto).length, bytesLista: buf.length, ms, encoding: r.headers.get('content-encoding') || '(ninguno)' });
}
console.log('\n── LISTA por mes (JSON de GET /admin/expenses) ──');
for (const f of filasPorMes) console.log(`${f.mes} · status ${f.status} · ${f.gastos} gastos · ${f.conFoto} con foto · ${kib(f.bytesLista)} · ${f.ms} ms · content-encoding ${f.encoding}`);
const algunaListaTraeLaFoto = [...vistos.values()].some((v) => v.receiptDataEnLista);
console.log('¿alguna fila de la lista trae receiptData? ' + (algunaListaTraeLaFoto ? 'SI (regresion de 964)' : 'no'));

const conFoto = [...vistos.entries()].filter(([, v]) => v.tieneFoto);
const fotos = [];
for (const [id, v] of conFoto) {
  const t0 = Date.now();
  const r = await pedir('/admin/expenses/' + id + '/foto');
  const buf = Buffer.from(await r.arrayBuffer());
  fotos.push({ id, mes: v.mes, status: r.status, tipo: r.headers.get('content-type'), contentLength: Number(r.headers.get('content-length')), bytes: buf.length, ms: Date.now() - t0, cache: r.headers.get('cache-control'), encoding: r.headers.get('content-encoding') || '(ninguno)' });
}
console.log('\n── FOTOS (GET /admin/expenses/:id/foto, una por gasto con tieneFoto) ──');
for (const f of fotos) console.log(`gasto ${f.id} (${f.mes}) · ${f.status} · ${f.tipo} · Content-Length ${kib(f.contentLength)} · recibidos ${kib(f.bytes)} · ${f.ms} ms · ${f.cache} · content-encoding ${f.encoding}`);

const ok = fotos.filter((f) => f.status === 200);
const pesos = ok.map((f) => f.bytes).sort((a, b) => a - b);
const suma = pesos.reduce((a, b) => a + b, 0);
const q = (p) => (pesos.length ? pesos[Math.min(pesos.length - 1, Math.floor(p * pesos.length))] : 0);
console.log('\n── RESUMEN ──');
console.log(`POBLACION meses=${meses.length} · gastos vistos=${vistos.size} · con tieneFoto=${conFoto.length} · fotos servidas 200=${ok.length} · no legibles/otros=${fotos.length - ok.length}`);
if (pesos.length) {
  console.log(`bytes por foto: min ${kib(pesos[0])} · mediana ${kib(q(0.5))} · p90 ${kib(q(0.9))} · max ${kib(pesos[pesos.length - 1])} · suma ${kib(suma)}`);
  console.log(`una lista de 20 filas con miniatura = descargar ~${(20 * q(0.5) / KIB / KIB).toFixed(1)} MiB (mediana) a ~${(20 * pesos[pesos.length - 1] / KIB / KIB).toFixed(1)} MiB (la mas pesada)`);
}
const coherente = ok.every((f) => f.contentLength === f.bytes);
console.log('control: Content-Length == bytes recibidos en todas las fotos 200: ' + coherente);
// EXIT 0 solo si el instrumento miro algo: hubo lista 200 en algun mes, y las cabeceras son coherentes.
const listaOk = filasPorMes.some((f) => f.status === 200);
console.log('EXIT=' + (listaOk && coherente ? 0 : 1) + (conFoto.length === 0 ? ' · ATENCION: staging no tiene NINGUN gasto con foto; no hay peso real que medir' : ''));
