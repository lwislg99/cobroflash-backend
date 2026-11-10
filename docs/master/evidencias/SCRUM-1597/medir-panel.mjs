// SCRUM-1597 ② · ¿Qué número enseña el «Hoy: N plantillas» del panel cuando hay avisos al profesional?
// SÓLO MIDE: no toca `src/` ni `public/`.
//
// Las MISMAS filas pasan por las dos funciones reales de `dist/`: `getWhatsAppMetrics` (lo que pinta la
// tarjeta «WhatsApp · este mes» de `public/dashboard/js/reportsView.js`, vía GET /admin/metrics/whatsapp)
// y `reservarPlantilla` (el tope). La base es un doble en memoria que evalúa el filtro que le piden; el
// patrón es el de `tests/scrum1522b-el-panel-cuenta-lo-mismo.test.mjs`. No se copia ningún cálculo.
//
// Controles: SUELO (las dos funciones ven las filas), CERO (sin avisos, panel = tope), POSITIVO SEMBRADO
// (los avisos sembrados los ve la rama de los avisos de la reserva: si se quitan, CIEGO).
//
// Uso:  node docs/master/evidencias/SCRUM-1597/medir-panel.mjs [--sin-sembrado] [--esperado-roto]
// Sale 0 si todo cuadra, 1 si algo no cuadra, 2 si el instrumento sale ciego. Necesita `dist/` compilado.
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../../..');
const SIN_SEMBRADO = process.argv.includes('--sin-sembrado');
const ROTO = process.argv.includes('--esperado-roto');
const hablar = console.log;
const requiere = createRequire(import.meta.url);
process.env.TZ = 'UTC';
if (new Date('2026-07-15T12:00:00Z').getTimezoneOffset() !== 0) { hablar('CIEGO: la zona del proceso no ha entrado.'); process.exit(2); }

const COMERCIO = 7;
const AVISO = 'merchant_alert_es';
const rotos = [];
function casa(fila, where) {
  for (const [k, v] of Object.entries(where)) {
    if (k === 'OR') { if (!v.some((w) => casa(fila, w))) return false; continue; }
    if (k === 'AND') { if (!v.every((w) => casa(fila, w))) return false; continue; }
    if (k === 'createdAt') { if (!(fila.createdAt.getTime() >= v.gte.getTime())) return false; continue; }
    if (v && typeof v === 'object' && 'not' in v) {
      // SQL: NULL <> x no es verdad. El doble lo respeta para no contar de más una fila sin nombre.
      if (fila[k] === null || fila[k] === v.not) return false; continue;
    }
    if (v && typeof v === 'object') { rotos.push(k); throw new Error(`filtro que el doble no conoce: ${k}`); }
    if (fila[k] !== v) return false;
  }
  return true;
}
let FILAS = [];
const cuentas = [];
const tabla = {
  count: async (a) => { const n = FILAS.filter((f) => casa(f, a.where)).length; cuentas.push(n); return n; },
  findMany: async (a) => FILAS.filter((f) => casa(f, a.where)),
  create: async () => ({ id: 1 }),
};
const comercio = { findUnique: async () => ({ timezone: null }) };
const db = {
  merchant: comercio, whatsAppMessage: tabla,
  $transaction: async (cb) => cb({ merchant: comercio, $executeRaw: async () => 0, whatsAppMessage: tabla }),
};
const fP = requiere.resolve(path.join(RAIZ, 'dist/core/db/prisma.js'));
requiere.cache[fP] = { id: fP, filename: fP, loaded: true, exports: { prisma: db } };
const { getWhatsAppMetrics, reservarPlantilla } = requiere(path.join(RAIZ, 'dist/modules/messaging/domain/whatsappLog.service.js'));

const ahora = new Date();
const hace = new Date(ahora.getTime() - 1000);
if (hace.toISOString().slice(0, 10) !== ahora.toISOString().slice(0, 10)) { hablar('CIEGO: la medición cae en el cambio de día UTC; repítela.'); process.exit(2); }
let serie = 0;
const plantilla = (templateName) => ({
  merchantId: COMERCIO, type: 'template', templateName, customerId: null,
  status: 'sent', waMessageId: `wamid.${++serie}`, costEstimate: 0.023, createdAt: hace,
});
const aClientes = (n) => Array.from({ length: n }, () => plantilla('quote_decision_es'));
const avisos = (n) => Array.from({ length: n }, () => plantilla(AVISO));

async function medir(filas) {
  FILAS = filas;
  const m = await getWhatsAppMetrics(COMERCIO, ahora);
  cuentas.length = 0;
  const aCliente = await reservarPlantilla(db, { merchantId: COMERCIO, toPhone: null, templateName: 'quote_decision_es', topeComercio: 100, topeCliente: 3 });
  const cuentaClientes = cuentas[0];
  cuentas.length = 0;
  const aviso = await reservarPlantilla(db, { merchantId: COMERCIO, toPhone: null, templateName: AVISO, topeComercio: 100, topeCliente: 3 });
  const cuentaAvisos = cuentas[0];
  if (rotos.length) { hablar(`CIEGO: el doble recibió filtros que no sabe evaluar: ${rotos.join(', ')}`); process.exit(2); }
  return { panel: m.channel.templateToday, mesTotal: m.month.total, topeClientesCuenta: cuentaClientes, saleACliente: aCliente.ok, topeAvisosCuenta: cuentaAvisos, saleAviso: aviso.ok };
}

const noCuadran = [];
function anotar(nombre, real, esperado) {
  const fallos = Object.entries(esperado).filter(([k, v]) => !(k in real) || JSON.stringify(real[k]) !== JSON.stringify(v))
    .map(([k, v]) => `${k}: esperado ${JSON.stringify(v)}, salió ${JSON.stringify(real[k])}`);
  if (fallos.length) noCuadran.push(nombre);
  hablar(`${fallos.length ? 'ROJO  ' : 'cuadra'} ${nombre}\n        ${JSON.stringify(real)}${fallos.length ? '\n        <<< ' + fallos.join(' | ') : ''}`);
}

hablar(`== medido ${ahora.toISOString()} · proceso en UTC · comercio sin zona (UTC) ==`);
anotar('S0 SUELO: 87 a clientes, las dos funciones las ven', await medir(aClientes(87)),
  { panel: 87, topeClientesCuenta: 87, saleACliente: true });
anotar('C0 CERO: 99 a clientes y ningún aviso: panel = tope', await medir(aClientes(99)),
  { panel: 99, topeClientesCuenta: 99, topeAvisosCuenta: 0 });

const nAvisos = SIN_SEMBRADO ? 0 : 5;
const r = await medir([...aClientes(99), ...avisos(nAvisos)]);
anotar('C1 POSITIVO SEMBRADO: la reserva de avisos ve los 5 avisos', r, { topeAvisosCuenta: 5 });
if (r.topeAvisosCuenta === 0) { hablar('CIEGO: los avisos sembrados no llegan a la rama de los avisos.'); process.exit(2); }
anotar('P1 🔴 99 a clientes + 5 avisos: ¿qué pinta «Hoy»?', r,
  { panel: ROTO ? 99 : 104, topeClientesCuenta: 99, saleACliente: true, saleAviso: true });
anotar('P2 100 a clientes + 5 avisos: el cupo está lleno', await medir([...aClientes(100), ...avisos(5)]),
  { panel: 105, topeClientesCuenta: 100, saleACliente: false, saleAviso: true });
anotar('P3 70 a clientes + 30 avisos: el aviso 31.º no cabe, el cliente sí', await medir([...aClientes(70), ...avisos(30)]),
  { panel: 100, topeClientesCuenta: 70, saleACliente: true, saleAviso: false });

hablar(`\n${noCuadran.length ? `ROJO: no cuadran ${noCuadran.length}: ${noCuadran.join(' · ')}` : 'TODO CUADRA'}`);
process.exit(noCuadran.length ? 1 : 0);
