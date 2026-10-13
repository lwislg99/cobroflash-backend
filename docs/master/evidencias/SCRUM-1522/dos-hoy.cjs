// SCRUM-1522 · Las MISMAS filas, pasadas por las dos funciones reales que dicen «plantillas de hoy»:
//   · el tope      -> reservarPlantilla   (dist/modules/messaging/domain/whatsappLog.service.js)
//   · las metricas -> getWhatsAppMetrics  (el mismo fichero)
//
// No toca ninguna base ni la red: la base es una lista en memoria que contesta a los dos con el
// MISMO contenido, evaluando el filtro que cada funcion le pide. No se copia ningun calculo: lo que
// se compara es lo que cada funcion devuelve.
//
// Se lanza DOS veces, y la diferencia entre las dos pasadas es parte de la medicion:
//   node docs/master/evidencias/SCRUM-1522/dos-hoy.cjs --tz=UTC             (como el proceso de Railway)
//   node docs/master/evidencias/SCRUM-1522/dos-hoy.cjs --tz=Europe/Madrid   (un proceso con el reloj de la peninsula)
// La zona del proceso va por ARGUMENTO y no por la variable de entorno: en Git Bash sobre Windows,
// un TZ=Europe/Madrid delante de node NO le llega (medido: la pasada salio con el reloj de la maquina).
// Pide dist/ (tsc --noCheck vale).
const ARG_TZ = process.argv.find((x) => x.startsWith('--tz='));
if (ARG_TZ) process.env.TZ = ARG_TZ.slice(5);
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '../../../..');
const fP = require.resolve(path.join(RAIZ, 'dist/core/db/prisma.js'));
const fS = require.resolve(path.join(RAIZ, 'dist/modules/messaging/domain/whatsappLog.service.js'));
const zonas = require(path.join(RAIZ, 'dist/core/zonaDelMerchant.js'));

let FILAS = [];
let ZONA_GUARDADA = null;

/** Evalua el `where` de Prisma que piden las dos funciones. Lanza si le piden algo que no conoce. */
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

const cuentas = [];
const tabla = {
  count: async (a) => { const n = FILAS.filter((f) => casa(f, a.where)).length; cuentas.push({ n, desde: a.where.createdAt.gte }); return n; },
  findMany: async (a) => FILAS.filter((f) => casa(f, a.where)),
  create: async () => ({ id: 1 }), // la reserva NO se apunta: aqui solo se pregunta
};
const db = {
  merchant: { findUnique: async () => ({ timezone: ZONA_GUARDADA }) }, // SCRUM-1522b: las metricas tambien leen la zona
  whatsAppMessage: tabla,
  $transaction: async (cb) => cb({
    merchant: { findUnique: async () => ({ timezone: ZONA_GUARDADA }) },
    $executeRaw: async () => 0,
    whatsAppMessage: tabla,
  }),
};
require.cache[fP] = { id: fP, filename: fP, loaded: true, exports: { prisma: db } };
const { reservarPlantilla, getWhatsAppMetrics } = require(fS);

// `getWhatsAppMetrics` acepta `now`; `reservarPlantilla` lee `new Date()`. Se le fija el reloj.
const RelojReal = Date;
function fijarReloj(instante) {
  const t = instante.getTime();
  global.Date = class extends RelojReal {
    constructor(...a) { if (a.length === 0) super(t); else super(...a); }
    static now() { return t; }
  };
}
function soltarReloj() { global.Date = RelojReal; }

const COMERCIO = 7;
const TOPE = 100;
let serie = 0;
const enviada = (iso) => ({ merchantId: COMERCIO, type: 'template', status: 'sent', waMessageId: 'wamid.' + (++serie), customerId: null, createdAt: new RelojReal(iso) });
const rechazada = (iso) => ({ merchantId: COMERCIO, type: 'template', status: 'failed', waMessageId: null, customerId: null, createdAt: new RelojReal(iso) });
const varias = (n, iso, f = enviada) => Array.from({ length: n }, () => f(iso));

async function medir(nombre, { zona, ahora, filas }) {
  FILAS = filas; ZONA_GUARDADA = zona;
  const instante = new RelojReal(ahora);
  const metricas = await getWhatsAppMetrics(COMERCIO, instante);
  // SCRUM-1522b: desde el arreglo las metricas TAMBIEN preguntan con `count`. La lista se vacia
  // aqui, justo antes de la reserva: si no, `cuentas[0]` seria la cuenta del panel y el guion
  // compararia el panel consigo mismo.
  cuentas.length = 0;
  fijarReloj(instante);
  let reserva;
  try { reserva = await reservarPlantilla(db, { merchantId: COMERCIO, topeComercio: TOPE, topeCliente: 3 }); } finally { soltarReloj(); }
  const delTope = cuentas[0];
  const fila = {
    caso: nombre,
    zona: zona === null ? 'NULL' : zona,
    ahora,
    filas: filas.length,
    panel_mes: metricas.month.total,
    panel_hoy: metricas.channel.templateToday,
    tope_cuenta: delTope.n,
    tope_desde: delTope.desde.toISOString(),
    envio: reserva.ok ? 'SALE' : 'BLOQUEADO (' + reserva.reason + ')',
    coinciden: metricas.channel.templateToday === delTope.n ? 'si' : 'NO',
  };
  console.log(JSON.stringify(fila));
  return fila;
}

(async () => {
  const tzProceso = process.env.TZ || '(sin TZ: la de la maquina)';
  console.log('POBLACION: 8 casos · proceso TZ=' + tzProceso + ' · desfase del proceso ahora=' + (-new RelojReal().getTimezoneOffset()) + ' min · tope=' + TOPE);

  const r = [];
  // -- VERANO, peninsula (UTC+2). El dia de Madrid 15-jul va de 14T22:00Z a 15T22:00Z.
  // 1 · el ejemplo del ticket: 13 de madrugada (00:10-01:50 de Madrid) y 87 por la manana; se mira a las 18:00 de Madrid.
  r.push(await medir('1 · 13 de madrugada + 87 de dia, a las 18:00 de Madrid', {
    zona: 'Europe/Madrid', ahora: '2026-07-15T16:00:00Z',
    filas: [...varias(13, '2026-07-14T22:30:00Z'), ...varias(87, '2026-07-15T08:00:00Z')],
  }));
  // 2 · la franja en que hablan de DIAS distintos: 100 ayer (de dia), y se mira a las 00:30 de Madrid.
  r.push(await medir('2 · 100 enviadas ayer de dia, a las 00:30 de Madrid', {
    zona: 'Europe/Madrid', ahora: '2026-07-15T22:30:00Z',
    filas: varias(100, '2026-07-15T08:00:00Z'),
  }));
  // 3 · CONTROL DE CERO: nada de madrugada, se mira de dia. Las dos tienen que coincidir.
  r.push(await medir('3 · CONTROL: 87 de dia y nada de madrugada, a las 18:00 de Madrid', {
    zona: 'Europe/Madrid', ahora: '2026-07-15T16:00:00Z',
    filas: varias(87, '2026-07-15T08:00:00Z'),
  }));
  // 4 · las filas del caso 1 con la zona SIN declarar.
  r.push(await medir('4 · las filas del caso 1, zona sin declarar', {
    zona: null, ahora: '2026-07-15T16:00:00Z',
    filas: [...varias(13, '2026-07-14T22:30:00Z'), ...varias(87, '2026-07-15T08:00:00Z')],
  }));
  // 5 · INVIERNO (UTC+1): la madrugada que se pierde es de una hora. 13 a las 00:30 de Madrid (23:30Z).
  r.push(await medir('5 · invierno: 13 a las 00:30 de Madrid + 87 de dia, a las 18:00', {
    zona: 'Europe/Madrid', ahora: '2026-01-15T17:00:00Z',
    filas: [...varias(13, '2026-01-14T23:30:00Z'), ...varias(87, '2026-01-15T08:00:00Z')],
  }));
  // 6 · Canarias en verano (UTC+1).
  r.push(await medir('6 · Canarias, verano: 13 a las 00:30 de Canarias + 87 de dia', {
    zona: 'Atlantic/Canary', ahora: '2026-07-15T16:00:00Z',
    filas: [...varias(13, '2026-07-14T23:30:00Z'), ...varias(87, '2026-07-15T08:00:00Z')],
  }));
  // 7 · OTRA diferencia, que no es de reloj: lo que el proveedor rechazo. Todo de dia, zona sin declarar.
  r.push(await medir('7 · sin reloj de por medio: 90 enviadas + 15 rechazadas, de dia, zona sin declarar', {
    zona: null, ahora: '2026-07-15T16:00:00Z',
    filas: [...varias(90, '2026-07-15T08:00:00Z'), ...varias(15, '2026-07-15T09:00:00Z', rechazada)],
  }));
  // 8 · CONTROL del doble: una fila de AYER (para las dos) no la cuenta ninguna.
  r.push(await medir('8 · CONTROL: 5 de hoy + 40 de anteayer', {
    zona: 'Europe/Madrid', ahora: '2026-07-15T16:00:00Z',
    filas: [...varias(5, '2026-07-15T08:00:00Z'), ...varias(40, '2026-07-13T08:00:00Z')],
  }));

  // AVISO (SCRUM-1522c, 13-oct-2026): este barrido NO pregunta a `getWhatsAppMetrics`. Compara el tope
  // con una COPIA del calculo que el panel tenia ANTES de SCRUM-1522b, asi que sigue diciendo 575 horas
  // con el defecto ya arreglado. Mide «cuanto se separaria el reloj del proceso», no «cuanto se separan
  // hoy». El que pregunta a las dos funciones es ../SCRUM-1522c/el-dia-del-tope.cjs.
  // -- El barrido: cuantos minutos del ano el inicio de «hoy» de cada lado cae en dias distintos.
  // El lado del tope se calcula con las MISMAS llamadas que su linea (inicioDelDiaEn(diaNaturalEn(ahora, zona), zona));
  // el de las metricas con la suya (setHours(0,0,0,0) sobre el reloj del proceso).
  for (const zona of ['Europe/Madrid', 'Atlantic/Canary', 'UTC']) {
    let minutos = 0; let otroDia = 0; let mismoInicio = 0; const dias = new Set(); const porDia = new Map();
    for (let t = RelojReal.UTC(2026, 0, 1); t < RelojReal.UTC(2027, 0, 1); t += 60000) {
      const ahora = new RelojReal(t);
      const tope = zonas.inicioDelDiaEn(zonas.diaNaturalEn(ahora, zona), zona).getTime();
      const m = new RelojReal(t); m.setHours(0, 0, 0, 0);
      minutos++;
      if (tope === m.getTime()) mismoInicio++;
      // «otro dia»: el tope ya ha empezado un dia que las metricas aun no (o al reves).
      if (Math.abs(tope - m.getTime()) > 12 * 3600000) {
        otroDia++;
        const d = zonas.diaNaturalEn(ahora, zona); dias.add(d); porDia.set(d, (porDia.get(d) || 0) + 1);
      }
    }
    const reparto = {};
    for (const n of porDia.values()) reparto[n] = (reparto[n] || 0) + 1;
    console.log(JSON.stringify({
      barrido: zona, minutos_mirados: minutos, minutos_con_el_mismo_inicio: mismoInicio,
      minutos_en_dias_distintos: otroDia, horas_al_ano: +(otroDia / 60).toFixed(1),
      dias_afectados: dias.size, 'dias por minutos_al_dia': reparto,
    }));
  }

  // SCRUM-1522b: `getWhatsAppMetrics` se traga cualquier error y devuelve ceros. Si el panel no ha
  // visto ni una fila del mes, no ha medido: es CIEGO, no un «0».
  const suelo = r.length === 8 && r.every((x) => x.filas > 0 && x.panel_mes > 0);
  console.log('SUELO: ' + (suelo ? 'los 8 casos tenian filas y el panel las vio' : 'CIEGO'));
  console.log('EXIT=' + (suelo ? 0 : 1));
  process.exit(suelo ? 0 : 1);
})().catch((e) => { console.error('ROTO:', e); console.log('EXIT=2'); process.exit(2); });
