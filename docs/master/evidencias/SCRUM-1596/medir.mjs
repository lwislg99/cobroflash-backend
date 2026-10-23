// SCRUM-1596 · Los dos llamadores de J2 que mandan plantilla sin cliente: `sendPaymentConfirmation`
// y `notifyMerchantAlert`. SÓLO MIDE: no toca `src/`, no manda nada fuera.
//
// Tres partes:
//   A · CENSO por AST (compilador de TypeScript): quién nombra cada función en src/, tests/, scripts/
//       y public/. Lleva un fichero SEMBRADO en memoria que llama a las dos: si no se ve, CIEGO.
//   B · `sendPaymentConfirmation` EJECUTADA (no tiene camino real: lo dice el censo), con el tope del
//       cliente lleno y libre. POSITIVO: su hermana `sendPaymentConfirmationInvoice`, que sí pasa el
//       cliente, con el mismo cliente lleno, TIENE que quedar bloqueada.
//   C · `notifyMerchantAlert` por un CAMINO REAL: la app entera de `dist/app.js` (banco de la casa,
//       `tests/_banco-camino-real.mjs`) y `POST /pay/bizum/:token/claimed` por HTTP.
//
// El transporte hacia el proveedor se dobla en el adaptador de axios (no sale un byte); se cuenta cada
// petición por tipo, destinatario y plantilla. Con la ventana del profesional «cerrada», el doble
// rechaza el texto al profesional con el código de fuera de ventana, como haría el proveedor.
//
// Uso:  node docs/master/evidencias/SCRUM-1596/medir.mjs [--sin-sembrado] [--esperado-roto]
//   --sin-sembrado   quita el fichero sembrado del censo: tiene que salir CIEGO (2).
//   --esperado-roto  cambia un esperado a propósito: tiene que salir ROJO (1).
// Sale 0 si todo cuadra, 1 si algo no cuadra, 2 si el instrumento sale mudo o ciego.
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../../..');
const DIST = path.join(RAIZ, 'dist');
const SIN_SEMBRADO = process.argv.includes('--sin-sembrado');
const ROTO = process.argv.includes('--esperado-roto');
const hablar = console.log;

if (process.env.NODE_TEST_CONTEXT || process.execArgv.some((a) => a === '--test' || a.startsWith('--test-'))) {
  hablar('CIEGO: proceso de test (la salida al proveedor estaría bloqueada por SCRUM-180).'); process.exit(2);
}
for (const k of ['WHATSAPP_DRY_RUN', 'WA_CUSTOMER_DAILY_CAP', 'WA_DAILY_TEMPLATE_CAP']) delete process.env[k];

const noCuadran = [];
function anotar(nombre, real, esperado) {
  const fallos = Object.entries(esperado).filter(([k, v]) => {
    if (!(k in real)) return true; // un esperado sobre una clave que no existe es ROJO, no un verde
    return JSON.stringify(real[k]) !== JSON.stringify(v);
  }).map(([k, v]) => `${k}: esperado ${JSON.stringify(v)}, salió ${JSON.stringify(real[k])}`);
  if (fallos.length) noCuadran.push(nombre);
  hablar(`${fallos.length ? 'ROJO  ' : 'cuadra'} ${nombre}  ${JSON.stringify(real)}${fallos.length ? '  <<< ' + fallos.join(' | ') : ''}`);
}

// ─── A · CENSO POR AST ─────────────────────────────────────────────────────────────────────────
const requireRaiz = createRequire(path.join(RAIZ, 'package.json'));
const ts = requireRaiz('typescript');
// `notifyMerchantPaid` es el atajo de `notifyMerchantAlert` (whatsappNotifications.ts): sus llamadores también avisan.
const NOMBRES = ['sendPaymentConfirmation', 'notifyMerchantAlert', 'notifyMerchantPaid'];
const INEXISTENTE = 'sondaNoExiste1596';
const EXT = /\.(ts|js|mjs|cjs)$/;

function ficheros(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...ficheros(p));
    else if (EXT.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/** Cada identificador cuyo texto es EXACTAMENTE uno de los nombres (un prefijo no casa). */
function censar(nombreFichero, texto, nombres) {
  const sf = ts.createSourceFile(nombreFichero, texto, ts.ScriptTarget.Latest, true);
  const hallazgos = [];
  const ver = (n) => {
    if (ts.isIdentifier(n) && nombres.includes(n.text)) {
      const p = n.parent;
      let papel = 'referencia';
      if (ts.isFunctionDeclaration(p) && p.name === n) papel = 'declaracion';
      else if (ts.isImportSpecifier(p) || ts.isImportClause(p)) papel = 'import';
      else if (ts.isCallExpression(p) && p.expression === n) papel = 'llamada';
      else if (ts.isPropertyAccessExpression(p) && p.name === n && ts.isCallExpression(p.parent) && p.parent.expression === p) papel = 'llamada';
      const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
      hallazgos.push({ nombre: n.text, papel, sitio: `${path.relative(RAIZ, nombreFichero).replace(/\\/g, '/')}:${line + 1}` });
    }
    ts.forEachChild(n, ver);
  };
  ver(sf);
  return hallazgos;
}

const poblacion = ['src', 'tests', 'scripts', 'public'].flatMap((d) => ficheros(path.join(RAIZ, d)));
const todos = [];
for (const f of poblacion) {
  const texto = fs.readFileSync(f, 'utf8');
  if (!NOMBRES.some((n) => texto.includes(n)) && !texto.includes(INEXISTENTE)) continue;
  todos.push(...censar(f, texto, [...NOMBRES, INEXISTENTE]));
}
const SEMBRADO = path.join(RAIZ, 'sembrado-1596.ts');
const sembrados = SIN_SEMBRADO ? [] : censar(SEMBRADO,
  'import { sendPaymentConfirmation, notifyMerchantAlert } from "x";\n'
  + 'sendPaymentConfirmation({});\nnotifyMerchantAlert({});\nconst o = { sendPaymentConfirmationInvoice() {} };\n'
  + 'o.sendPaymentConfirmationInvoice();\n// sendPaymentConfirmation en un comentario no cuenta\n',
  NOMBRES);
hablar(`== A · CENSO POR AST · población: ${poblacion.length} ficheros (src, tests, scripts, public) ==`);
const llamadasSembradas = sembrados.filter((h) => h.papel === 'llamada').length;
anotar('A0 SEMBRADO: 2 llamadas (una por nombre), 0 por el prefijo y 0 por el comentario', { llamadas: llamadasSembradas, total: sembrados.length }, { llamadas: 2, total: 4 });
if (llamadasSembradas === 0) { hablar('CIEGO: el censo no ve el fichero sembrado.'); process.exit(2); }
anotar('A1 CERO: un nombre que no existe', { apariciones: todos.filter((h) => h.nombre === INEXISTENTE).length }, { apariciones: 0 });
const resumen = {};
for (const n of NOMBRES) {
  const h = todos.filter((x) => x.nombre === n && !x.sitio.startsWith('docs/'));
  resumen[n] = {
    declaracion: h.filter((x) => x.papel === 'declaracion').map((x) => x.sitio),
    llamadas: h.filter((x) => x.papel === 'llamada').map((x) => x.sitio),
    otras: h.filter((x) => !['declaracion', 'llamada'].includes(x.papel)).map((x) => `${x.papel} ${x.sitio}`),
  };
  hablar(`   ${n}: declaración ${resumen[n].declaracion.join(', ')} · ${resumen[n].llamadas.length} llamadas`);
  for (const s of resumen[n].llamadas) hablar(`      llamada  ${s}`);
  for (const s of resumen[n].otras) hablar(`      ${s}`);
}
anotar('A2 sendPaymentConfirmation: llamadas en el árbol', { llamadas: resumen.sendPaymentConfirmation.llamadas.length }, { llamadas: 0 });
// 8 sitios + la del atajo (`whatsappNotifications.ts:195`); el atajo, 2 (los dos webhooks de pago).
anotar('A3 notifyMerchantAlert: llamadas en el árbol', { llamadas: resumen.notifyMerchantAlert.llamadas.length }, { llamadas: ROTO ? 1 : 9 });
anotar('A4 notifyMerchantPaid (atajo): llamadas en el árbol', { llamadas: resumen.notifyMerchantPaid.llamadas.length }, { llamadas: 2 });

// ─── EL BANCO ──────────────────────────────────────────────────────────────────────────────────
const requireDist = createRequire(path.join(DIST, 'integrations/whatsapp.js'));
const axios = requireDist('axios');
let peticiones = []; let ventanaProAbierta = false; let PROF = '';
let serie = 0;
axios.defaults.adapter = async (cfg) => {
  let cuerpo = {};
  try { cuerpo = JSON.parse(cfg.data); } catch { /* vacío */ }
  const tipo = String(cuerpo.type || 'otro');
  peticiones.push({ tipo, to: String(cuerpo.to || ''), plantilla: cuerpo.template?.name ?? null });
  const resp = (status, data) => ({ data, status, statusText: String(status), headers: {}, config: cfg, request: {} });
  if (tipo !== 'template' && cuerpo.to === PROF && !ventanaProAbierta) {
    throw new axios.AxiosError('Request failed with status code 400', 'ERR_BAD_REQUEST', cfg, {},
      resp(400, { error: { message: 'laboratorio 1596: fuera de ventana', code: 131047 } }));
  }
  return resp(200, { messages: [{ id: `wamid.lab1596.${++serie}` }] });
};

const trazas = [];
console.error = (...a) => trazas.push(a.map(String).join(' '));
console.warn = (...a) => trazas.push(a.map(String).join(' '));
console.log = () => {};

const { montarAppReal, bancoDePrisma } = await import(pathToFileURL(path.join(RAIZ, 'tests/_banco-camino-real.mjs')).href);
const app = await montarAppReal();
const { config } = requireDist(path.join(DIST, 'core/config/env.js'));
config.WHATSAPP_PHONE_NUMBER_ID = 'laboratorio-1596';
config.WHATSAPP_ACCESS_TOKEN = 'laboratorio-1596';
const { normalizePhone } = requireDist(path.join(DIST, 'core/utils/utils.js'));
const notif = requireDist(path.join(DIST, 'integrations/whatsappNotifications.js'));
const { telefonoDePrueba } = await import(pathToFileURL(path.join(RAIZ, 'scripts/_telefonos-prueba.mjs')).href);

const C = Number(config.WA_CUSTOMER_DAILY_CAP);
const D = Number(config.WA_DAILY_TEMPLATE_CAP);
hablar(`\ntopes leídos en dist: por cliente y día = ${C} · por comercio y día = ${D}`);
if (!(C >= 1 && D >= 1)) { hablar('CIEGO: topes no leídos.'); process.exit(2); }

const MIO = 15960;
PROF = normalizePhone(telefonoDePrueba(15960));
const LLENO = { id: 701, name: 'Cliente lleno', phone: normalizePhone(telefonoDePrueba(15961)) };
const LIBRE = { id: 702, name: 'Cliente libre', phone: normalizePhone(telefonoDePrueba(15962)) };
if (!PROF || !LLENO.phone || !LIBRE.phone || new Set([PROF, LLENO.phone, LIBRE.phone]).size !== 3) {
  hablar('CIEGO: teléfonos de prueba no válidos.'); process.exit(2);
}
const merchant = { id: MIO, name: 'Taller 1596', legalName: null, country: 'ES', timezone: 'Europe/Madrid', whatsappPhone: PROF, bizumPhone: PROF, flags: null };

/**
 * Programa la base. `previas`: plantillas que cada cliente ya recibió hoy ({customerId: n}); `comercio`:
 * plantillas de hoy del comercio sin cliente. El registro cuenta como `reservarPlantilla`: plantillas
 * enviadas o en `queued`, por comercio, y por cliente SÓLO si la pregunta lleva `customerId`.
 */
function programar({ previas = {}, comercio = 0, cliente = LLENO } = {}) {
  const filas = [];
  const sembrar = (customerId) => filas.push({ id: filas.length + 1, merchantId: MIO, customerId, type: 'template', status: 'sent', waMessageId: 'previa' });
  for (const [cid, n] of Object.entries(previas)) for (let i = 0; i < n; i += 1) sembrar(Number(cid));
  for (let i = 0; i < comercio; i += 1) sembrar(null);
  const eventos = [];
  const preguntas = { comercio: 0, cliente: [] };
  const cobro = {
    id: 96, merchantId: MIO, customerId: cliente.id, status: 'pending', amount: '50.00', currency: 'EUR',
    receiptToken: 'tok-1596', concept: 'Reparación', customer: { name: cliente.name }, merchant,
  };
  bancoDePrisma().programar({
    merchant: { findUnique: async () => merchant },
    charge: { findUnique: async (a) => (a?.where?.receiptToken === 'tok-1596' ? cobro : null) },
    event: {
      findFirst: async (a) => eventos.find((e) => e.chargeId === a?.where?.chargeId && e.type === a?.where?.type) ?? null,
      create: async (a) => { eventos.push({ id: eventos.length + 1, ...a.data }); return eventos[eventos.length - 1]; },
    },
    whatsAppMessage: {
      count: async (a) => {
        const w = a?.where ?? {};
        if ('customerId' in w) preguntas.cliente.push(w.customerId); else preguntas.comercio += 1;
        return filas.filter((f) => f.merchantId === w.merchantId && f.type === 'template'
          && (f.waMessageId || f.status === 'queued')
          && (!('customerId' in w) || f.customerId === w.customerId)).length;
      },
      create: async (a) => { const f = { id: filas.length + 1, ...a.data }; filas.push(f); return f; },
      update: async (a) => { const f = filas.find((x) => x.id === a?.where?.id); if (f) Object.assign(f, a.data); return f ?? null; },
      findFirst: async () => null, // ninguna ventana de servicio abierta con ningún cliente
    },
  });
  peticiones = []; trazas.length = 0;
  return { filas, preguntas, eventos };
}
const plantillas = (to) => peticiones.filter((p) => p.tipo === 'template' && (!to || p.to === to));
const errorDeHandler = () => trazas.filter((t) => /TypeError|ReferenceError|Cannot read/.test(t)).length;
const asentar = async () => { // el aviso de Bizum va sin esperar al responder: se espera a que deje de moverse
  let antes = -1;
  for (let i = 0; i < 40 && antes !== peticiones.length + trazas.length; i += 1) {
    antes = peticiones.length + trazas.length;
    await new Promise((r) => setTimeout(r, 25));
  }
};

// ─── B · sendPaymentConfirmation ───────────────────────────────────────────────────────────────
hablar('\n== B · sendPaymentConfirmation (EJECUTADA: no la llama nadie, A2) ==');
const confirmar = (c) => notif.sendPaymentConfirmation({ toPhone: c.phone, customerName: c.name, amount: 50, currency: 'EUR', invoiceNumber: 'J-1596', businessName: 'Taller 1596', merchantId: MIO });
{
  const b = programar();
  const r = await confirmar(LLENO);
  anotar('B0 SUELO: tope libre → sale 1 plantilla al cliente', { ok: r.ok, plantillas: plantillas(LLENO.phone).length, nombre: plantillas()[0]?.plantilla ?? null, preguntasCliente: b.preguntas.cliente.length },
    { ok: true, plantillas: 1, nombre: 'payment_confirmation_es', preguntasCliente: 0 });
}
{
  const b = programar({ previas: { [LLENO.id]: C } });
  const r = await confirmar(LLENO);
  anotar(`B1 cliente con ${C} plantillas hoy → ¿sale?`, { ok: r.ok, plantillas: plantillas(LLENO.phone).length, preguntasCliente: b.preguntas.cliente.length, filaSinCliente: b.filas.filter((f) => f.status === 'sent' && f.waMessageId !== 'previa' && f.customerId == null).length },
    { ok: true, plantillas: 1, preguntasCliente: 0, filaSinCliente: 1 });
}
{
  const b = programar({ previas: { [LLENO.id]: C } });
  const r = await notif.sendPaymentConfirmationInvoice({ toPhone: LLENO.phone, customerName: LLENO.name, amount: 50, currency: 'EUR', documentNumber: 'J-1596', businessName: 'Taller 1596', chargeId: 96, receiptToken: 'tok-1596', merchantId: MIO, customerId: LLENO.id });
  anotar(`B2 POSITIVO: la hermana con cliente, mismo cliente con ${C} hoy → bloqueada`, { ok: r.ok, plantillas: plantillas().length, preguntasCliente: b.preguntas.cliente },
    { ok: false, plantillas: 0, preguntasCliente: [LLENO.id] });
  if (b.preguntas.cliente.length === 0) { hablar('CIEGO: el banco no ve la pregunta del tope por cliente.'); process.exit(2); }
}
{
  programar();
  let ok = 0;
  for (let i = 0; i < C + 2; i += 1) if ((await confirmar(LLENO)).ok) ok += 1;
  anotar(`B3 ${C + 2} veces al mismo cliente el mismo día`, { ok, plantillas: plantillas(LLENO.phone).length }, { ok: C + 2, plantillas: C + 2 });
}
{
  const b = programar({ comercio: D });
  const r = await confirmar(LIBRE);
  anotar(`B4 OTRO TOPE: comercio con ${D} plantillas hoy → bloqueada por el de comercio`, { ok: r.ok, plantillas: plantillas().length, preguntasComercio: b.preguntas.comercio, motivo: trazas.some((t) => t.includes('A3.2')) ? 'daily_cap' : null },
    { ok: false, plantillas: 0, preguntasComercio: 1, motivo: 'daily_cap' });
}

// ─── C · notifyMerchantAlert por la app real ───────────────────────────────────────────────────
hablar('\n== C · notifyMerchantAlert por POST /pay/bizum/:token/claimed (app entera de dist) ==');
const reclamar = async () => { const r = await app.pedir('/pay/bizum/tok-1596/claimed', { metodo: 'POST' }); await asentar(); return r; };
{
  const b = programar({ cliente: LIBRE });
  const r = await reclamar();
  anotar('C0 SUELO: cliente libre, ventana del profesional cerrada → 1 plantilla al PROFESIONAL', {
    http: r.status, alProfesional: plantillas(PROF).length, nombre: plantillas(PROF)[0]?.plantilla ?? null, alCliente: peticiones.filter((p) => p.to !== PROF).length,
    preguntasComercio: b.preguntas.comercio, preguntasCliente: b.preguntas.cliente.length, errores: errorDeHandler(),
  }, { http: 303, alProfesional: 1, nombre: 'merchant_alert_es', alCliente: 0, preguntasComercio: 1, preguntasCliente: 0, errores: 0 });
  if (plantillas(PROF).length === 0) { hablar('CIEGO: el camino real no produjo el aviso; nada de lo de abajo diría algo.'); process.exit(2); }
}
{
  const b = programar({ cliente: LLENO, previas: { [LLENO.id]: C } });
  const r = await reclamar();
  anotar(`C1 el cliente que paga tiene ${C} plantillas hoy → ¿sale el aviso?`, {
    http: r.status, alProfesional: plantillas(PROF).length, preguntasCliente: b.preguntas.cliente.length,
    filaDelAviso: b.filas.filter((f) => f.waMessageId && f.waMessageId !== 'previa').map((f) => ({ customerId: f.customerId, status: f.status })),
  }, { http: 303, alProfesional: 1, preguntasCliente: 0, filaDelAviso: [{ customerId: null, status: 'sent' }] });
}
{
  programar({ cliente: LLENO, previas: { [LLENO.id]: C } });
  ventanaProAbierta = true;
  const r = await reclamar();
  ventanaProAbierta = false;
  anotar('C2 CERO: ventana del profesional ABIERTA → va por texto, 0 plantillas', { http: r.status, plantillas: plantillas().length, textosAlProfesional: peticiones.filter((p) => p.to === PROF && p.tipo !== 'template').length },
    { http: 303, plantillas: 0, textosAlProfesional: 1 });
}
{
  const b = programar({ cliente: LIBRE });
  for (let i = 0; i < 5; i += 1) await reclamar();
  anotar('C3 OTRO FRENO: «ya he pagado» 5 veces sobre el mismo cobro', { avisos: plantillas(PROF).length, eventos: b.eventos.length }, { avisos: 1, eventos: 1 });
}
{
  const b = programar({ cliente: LIBRE, comercio: D });
  const r = await reclamar();
  anotar(`C4 OTRO TOPE: comercio con ${D} plantillas hoy → el aviso no sale por plantilla`, {
    http: r.status, plantillas: plantillas().length, intentosDeTexto: peticiones.filter((p) => p.to === PROF && p.tipo !== 'template').length,
    motivo: trazas.some((t) => t.includes('A3.2')) ? 'daily_cap' : null, preguntasComercio: b.preguntas.comercio,
  }, { http: 303, plantillas: 0, intentosDeTexto: 1, motivo: 'daily_cap', preguntasComercio: 1 });
}
{
  // ¿Gasta el aviso el cupo de COMERCIO? D−1 plantillas a clientes, un aviso, y después 1 plantilla a un cliente.
  const b = programar({ cliente: LIBRE, comercio: D - 1 });
  await reclamar();
  const r = await confirmar(LLENO);
  anotar(`C5 con ${D - 1} de ${D} gastadas: el aviso se lleva la última y la del cliente ya no sale`, {
    avisoComoPlantilla: plantillas(PROF).length, alClienteOk: r.ok, alCliente: plantillas(LLENO.phone).length, preguntasComercio: b.preguntas.comercio,
  }, { avisoComoPlantilla: 1, alClienteOk: false, alCliente: 0, preguntasComercio: 2 });
}

await app.cerrar();
const errores = trazas.filter((t) => /TypeError|ReferenceError|Cannot read/.test(t));
hablar(`\nCASOS: ${noCuadran.length ? 'NO cuadran ' + noCuadran.length + ': ' + noCuadran.join(' · ') : 'todos cuadran'}`);
hablar(`peticiones al proveedor doblado en total: ${serie} · trazas de handler roto en el último caso: ${errores.length}`);
process.exit(noCuadran.length ? 1 : 0);
