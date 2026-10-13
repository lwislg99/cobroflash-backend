// SCRUM-1522c · El tope y el «Hoy» del panel, DESPUES del arreglo de SCRUM-1522b (PR #2349).
//
// Tres preguntas, contestadas con las dos funciones reales de dist/ y una base en memoria:
//   A · ¿piden hoy el tope y el panel LO MISMO? Minuto a minuto de 2026, se compara el filtro entero
//       que cada funcion le pide a la base (no un calculo copiado).
//   B · el comercio SIN zona: que dia se le cuenta, y cuanto se separa del dia de su reloj de pared.
//       El borde sale de ZONA_POR_DEFECTO (src/core/zonaDelMerchant.ts), no esta escrito aqui.
//   C · que ve ese comercio: casos con filas, pasados por las dos funciones.
//
// No toca ninguna base ni la red. Hermano de ../SCRUM-1522/dos-hoy.cjs, que se queda como estaba:
// su barrido compara el tope con una COPIA del calculo viejo del panel, asi que hoy sigue diciendo
// 575 horas aunque el defecto ya no este. Este no copia: pregunta a las funciones.
//
// Uso:  node docs/master/evidencias/SCRUM-1522c/el-dia-del-tope.cjs --tz=UTC [--paso=1] [--sin-siembra]
// La zona del proceso va por ARGUMENTO: en Git Bash un TZ= delante de node no le llega.
// --sin-siembra quita el control positivo: tiene que decir CIEGO y salir 1, no verde.
// Pide dist/ (tsc --noCheck vale). Sale 0 si midio y sus controles cuadran; 1 si esta CIEGO; 2 si roto.
'use strict';
if (process.env.NODE_TEST_CONTEXT || process.execArgv.some((a) => a === '--test' || a.startsWith('--test-'))) {
  console.log('el-dia-del-tope.cjs no es un test de la tanda: se corre a mano.'); process.exit(0);
}
const arg = (n) => { const a = process.argv.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : null; };
if (arg('tz')) process.env.TZ = arg('tz');
const PASO_MIN = Number(arg('paso') || 1);
const SIN_SIEMBRA = process.argv.includes('--sin-siembra');
const path = require('node:path');
const crypto = require('node:crypto');

const RAIZ = path.resolve(__dirname, '../../../..');
const fP = require.resolve(path.join(RAIZ, 'dist/core/db/prisma.js'));
const fS = require.resolve(path.join(RAIZ, 'dist/modules/messaging/domain/whatsappLog.service.js'));
const zonas = require(path.join(RAIZ, 'dist/core/zonaDelMerchant.js'));

// ── El doble de la base ──────────────────────────────────────────────────────────────────────
let FILAS = [];
let ZONA_QUE_LEE_EL_PANEL = null; // lo que contesta prisma.merchant.findUnique (getWhatsAppMetrics)
let ZONA_QUE_LEE_EL_TOPE = null;  // lo que contesta tx.merchant.findUnique (reservarPlantilla)
let preguntasDelPanel = [];
let preguntasDelTope = [];

function casa(fila, where) {
  for (const [k, v] of Object.entries(where)) {
    if (k === 'OR') { if (!v.some((w) => casa(fila, w))) return false; continue; }
    if (k === 'createdAt') { if (!(fila.createdAt.getTime() >= v.gte.getTime())) return false; continue; }
    if (v && typeof v === 'object' && 'not' in v) { if (fila[k] === v.not) return false; continue; }
    if (v && typeof v === 'object') throw new Error('filtro que el doble no conoce: ' + k);
    if (fila[k] !== v) return false;
  }
  return true;
}
const tablaDe = (apunta) => ({
  count: async (a) => { apunta.push(a.where); return FILAS.filter((f) => casa(f, a.where)).length; },
  findMany: async (a) => FILAS.filter((f) => casa(f, a.where)),
  create: async () => ({ id: 1 }),
});
const db = {
  merchant: { findUnique: async () => ({ timezone: ZONA_QUE_LEE_EL_PANEL }) },
  whatsAppMessage: tablaDe(preguntasDelPanel),
  $transaction: async (cb) => cb({
    merchant: { findUnique: async () => ({ timezone: ZONA_QUE_LEE_EL_TOPE }) },
    $executeRaw: async () => 0,
    whatsAppMessage: tablaDe(preguntasDelTope),
  }),
};
require.cache[fP] = { id: fP, filename: fP, loaded: true, exports: { prisma: db } };
const { reservarPlantilla, getWhatsAppMetrics } = require(fS);

// `reservarPlantilla` lee `new Date()`: se le fija el reloj. Una sola clase, con el instante mudable.
const RelojReal = Date;
let instanteFijado = null;
class RelojFijo extends RelojReal {
  constructor(...a) { if (a.length === 0 && instanteFijado !== null) super(instanteFijado); else super(...a); }
  static now() { return instanteFijado !== null ? instanteFijado : RelojReal.now(); }
}
global.Date = RelojFijo;

const COMERCIO = 7;
const TOPE = 100;

/** Las dos funciones reales, en el mismo instante. Devuelve lo que cada una le pidio a la base. */
async function preguntar(t, zonaPanel, zonaTope) {
  ZONA_QUE_LEE_EL_PANEL = zonaPanel; ZONA_QUE_LEE_EL_TOPE = zonaTope;
  preguntasDelPanel.length = 0; preguntasDelTope.length = 0;
  instanteFijado = t;
  let metricas; let reserva;
  try {
    metricas = await getWhatsAppMetrics(COMERCIO, new RelojReal(t));
    reserva = await reservarPlantilla(db, { merchantId: COMERCIO, topeComercio: TOPE, topeCliente: 1e9 });
  } finally { instanteFijado = null; }
  if (preguntasDelPanel.length !== 1) throw new Error('el panel hizo ' + preguntasDelPanel.length + ' cuentas; se esperaba 1');
  if (preguntasDelTope.length !== 1) throw new Error('el tope hizo ' + preguntasDelTope.length + ' cuentas; se esperaba 1');
  return { panel: preguntasDelPanel[0], tope: preguntasDelTope[0], metricas, reserva };
}

/** A · barrido del ano: ¿el filtro del panel y el del tope son el mismo, minuto a minuto? */
async function barrer(nombre, zonaPanel, zonaTope) {
  let minutos = 0; let filtroDistinto = 0; let inicioDistinto = 0; let otroDia = 0;
  for (let t = RelojReal.UTC(2026, 0, 1); t < RelojReal.UTC(2027, 0, 1); t += PASO_MIN * 60000) {
    FILAS = [];
    const r = await preguntar(t, zonaPanel, zonaTope);
    minutos++;
    if (JSON.stringify(r.panel) !== JSON.stringify(r.tope)) filtroDistinto++;
    const d = Math.abs(r.panel.createdAt.gte.getTime() - r.tope.createdAt.gte.getTime());
    if (d !== 0) inicioDistinto++;
    if (d > 12 * 3600000) otroDia++;
  }
  const fila = {
    A: nombre, instantes_mirados: minutos, paso_min: PASO_MIN,
    con_el_filtro_distinto: filtroDistinto, con_el_inicio_distinto: inicioDistinto,
    hablando_de_dias_distintos: otroDia, horas_al_ano_en_dias_distintos: +(otroDia * PASO_MIN / 60).toFixed(1),
  };
  console.log(JSON.stringify(fila));
  return fila;
}

/** B · el comercio sin zona: su «hoy» contado contra el dia de un reloj de pared. Sin funciones dobladas. */
function sinZonaContra(pared) {
  const contada = zonas.zonaDelMerchant({ timezone: null }); // sale de ZONA_POR_DEFECTO
  const hhmm = new Intl.DateTimeFormat('en-GB', { timeZone: pared, hour12: false, hour: '2-digit', minute: '2-digit' });
  let minutos = 0; let fuera = 0; let primera = null; let ultima = null; const porDia = new Map();
  for (let t = RelojReal.UTC(2026, 0, 1); t < RelojReal.UTC(2027, 0, 1); t += 60000) {
    const ahora = new RelojReal(t);
    minutos++;
    const suDia = zonas.diaNaturalEn(ahora, pared);
    if (suDia === zonas.diaNaturalEn(ahora, contada)) continue;
    fuera++;
    const h = hhmm.format(ahora);
    if (primera === null || h < primera) primera = h;
    if (ultima === null || h > ultima) ultima = h;
    porDia.set(suDia, (porDia.get(suDia) || 0) + 1);
  }
  const reparto = {};
  for (const n of porDia.values()) reparto[n + ' min/dia'] = (reparto[n + ' min/dia'] || 0) + 1;
  const fila = {
    B: 'comercio sin zona, reloj de pared en ' + pared, zona_que_se_le_cuenta: contada,
    minutos_mirados: minutos, minutos_en_que_su_hoy_es_el_de_ayer: fuera, horas_al_ano: +(fuera / 60).toFixed(1),
    franja_de_su_reloj: fuera ? primera + ' a ' + ultima : '(ninguna)', dias_afectados: porDia.size, reparto,
  };
  console.log(JSON.stringify(fila));
  return fila;
}

/** C · casos con filas. */
let serie = 0;
const enviada = (iso) => ({ merchantId: COMERCIO, type: 'template', status: 'sent', waMessageId: 'wamid.' + (++serie), customerId: null, createdAt: new RelojReal(iso) });
const varias = (n, iso) => Array.from({ length: n }, () => enviada(iso));
async function caso(nombre, zona, ahoraIso, filas) {
  const t = new RelojReal(ahoraIso).getTime();
  FILAS = filas;
  // Primero el panel solo (FILAS no cambia: la reserva del doble no apunta nada).
  const r = await preguntar(t, zona, zona);
  const cuentaTope = FILAS.filter((f) => casa(f, r.tope)).length;
  const fila = {
    C: nombre, zona_guardada: zona === null ? 'NULL' : zona, ahora: ahoraIso,
    hora_en_Madrid: new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour12: false, dateStyle: 'short', timeStyle: 'short' }).format(new RelojReal(t)),
    filas: filas.length, panel_mes: r.metricas.month.total, panel_hoy: r.metricas.channel.templateToday,
    tope_cuenta: cuentaTope, hoy_empieza: r.tope.createdAt.gte.toISOString(),
    envio: r.reserva.ok ? 'SALE' : 'BLOQUEADO (' + r.reserva.reason + ')',
    panel_y_tope: r.metricas.channel.templateToday === cuentaTope ? 'iguales' : 'DISTINTOS',
  };
  console.log(JSON.stringify(fila));
  return fila;
}

(async () => {
  console.log('POBLACION: A = ' + (SIN_SIEMBRA ? 3 : 4) + ' barridos de 2026 a paso de ' + PASO_MIN + ' min · B = 3 relojes de pared x 525.600 min · C = 6 casos'
    + ' · proceso TZ=' + (process.env.TZ || '(la de la maquina)') + ' · desfase del proceso=' + (-new RelojReal().getTimezoneOffset()) + ' min'
    + ' · ZONA_POR_DEFECTO=' + zonas.ZONA_POR_DEFECTO + ' · tope=' + TOPE);

  // ── A ──
  const a = [];
  a.push(await barrer('comercio en Europe/Madrid', 'Europe/Madrid', 'Europe/Madrid'));
  a.push(await barrer('comercio en Atlantic/Canary', 'Atlantic/Canary', 'Atlantic/Canary'));
  a.push(await barrer('comercio sin zona (NULL)', null, null));
  // CONTROL POSITIVO, SEMBRADO: al panel se le contesta OTRA zona que al tope. Es el defecto de antes
  // de #2349 fabricado en el doble (alli el panel no miraba la zona). El comparador TIENE que verlo.
  let siembra = null;
  if (!SIN_SIEMBRA) siembra = await barrer('SIEMBRA: el panel lee NULL y el tope Europe/Madrid', null, 'Europe/Madrid');

  // ── B ──
  const b = [];
  b.push(sinZonaContra('Europe/Madrid'));
  b.push(sinZonaContra('Atlantic/Canary'));
  // CERO DERIVADO: contra el reloj de la propia zona por defecto no puede separarse ni un minuto.
  const bCero = sinZonaContra(zonas.ZONA_POR_DEFECTO);

  // ── C ── (verano: la peninsula va 2 h por delante de UTC; el dia de Madrid 15-jul es 14T22:00Z-15T22:00Z)
  const c = [];
  c.push(await caso('1 · sin zona · 100 ayer por la tarde; son las 00:30 de su reloj (Madrid)', null, '2026-07-15T22:30:00Z', varias(100, '2026-07-15T15:00:00Z')));
  c.push(await caso('2 · las MISMAS filas y hora, con Europe/Madrid guardada', 'Europe/Madrid', '2026-07-15T22:30:00Z', varias(100, '2026-07-15T15:00:00Z')));
  c.push(await caso('3 · sin zona · las mismas filas, a las 02:00 de su reloj', null, '2026-07-16T00:00:00Z', varias(100, '2026-07-15T15:00:00Z')));
  c.push(await caso('4 · sin zona · 100 entre las 00:00 y las 02:00 de su reloj + 99 de dia; a las 18:00', null, '2026-07-15T16:00:00Z', [...varias(100, '2026-07-14T23:00:00Z'), ...varias(99, '2026-07-15T08:00:00Z')]));
  c.push(await caso('5 · las MISMAS filas y hora que el 4, con Europe/Madrid guardada', 'Europe/Madrid', '2026-07-15T16:00:00Z', [...varias(100, '2026-07-14T23:00:00Z'), ...varias(99, '2026-07-15T08:00:00Z')]));
  c.push(await caso('6 · CONTROL · sin zona · 87 de dia, a las 18:00: aqui la zona no pinta nada', null, '2026-07-15T16:00:00Z', varias(87, '2026-07-15T08:00:00Z')));

  // ── Veredicto del instrumento ──
  const esperados = Math.ceil(525600 / PASO_MIN);
  const ciego = [];
  if (!a.every((x) => x.instantes_mirados === esperados)) ciego.push('un barrido no miro los ' + esperados + ' instantes');
  if (!siembra) ciego.push('sin control positivo (no hay siembra)');
  else if (siembra.con_el_filtro_distinto === 0) ciego.push('la siembra no se ve: el comparador no distingue dos zonas');
  if (bCero.minutos_en_que_su_hoy_es_el_de_ayer !== 0) ciego.push('el cero derivado de B no da cero');
  if (b[0].minutos_en_que_su_hoy_es_el_de_ayer === 0) ciego.push('B no ve separarse a Madrid de la zona por defecto');
  if (!c.every((x) => x.filas > 0 && x.panel_mes > 0)) ciego.push('un caso de C no llego al panel (getWhatsAppMetrics se traga los errores)');

  // Huella de lo medido SIN la linea de POBLACION (que lleva la zona del proceso): si el resultado no
  // depende del reloj del proceso, las pasadas con --tz distinto dan la misma.
  const huella = crypto.createHash('sha256').update(JSON.stringify([a, siembra, b, bCero, c])).digest('hex').slice(0, 16);
  console.log('HUELLA de A+B+C (no incluye la zona del proceso): ' + huella);
  console.log('RESULTADO A: filtros distintos entre panel y tope = ' + a.reduce((s, x) => s + x.con_el_filtro_distinto, 0) + ' de ' + a.reduce((s, x) => s + x.instantes_mirados, 0)
    + ' · siembra = ' + (siembra ? siembra.con_el_filtro_distinto + ' de ' + siembra.instantes_mirados : 'QUITADA'));
  console.log(ciego.length ? 'CIEGO: ' + ciego.join(' · ') : 'SUELO: barridos completos, la siembra se ve, el cero derivado da cero, los casos llegaron al panel');
  console.log('EXIT=' + (ciego.length ? 1 : 0));
  process.exit(ciego.length ? 1 : 0);
})().catch((e) => { console.error('ROTO:', e); console.log('EXIT=2'); process.exit(2); });
