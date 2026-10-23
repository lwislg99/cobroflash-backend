// tests/scrum1522b-el-panel-cuenta-lo-mismo.test.mjs — SCRUM-1522b
//
// El panel («Hoy: N plantillas») y el tope de plantillas dicen «plantillas de hoy» los dos. Medido en
// SCRUM-1522 (Jira c.19150), con el proceso en UTC y el comercio en la península:
//
//     13 de madrugada + 87 de día   →  panel 87  · tope 100 · envío BLOQUEADO
//     90 enviadas + 15 rechazadas   →  panel 105 · tope 90
//
// Decidido por el fundador (Jira c.19157): ① las métricas van al día del COMERCIO, igual que el
// tope · ② el mes también · ③ «Hoy» no cuenta las rechazadas: cuenta lo mismo que el tope.
//
// Cómo mide: las MISMAS filas pasadas por las dos funciones reales de `dist/` (`getWhatsAppMetrics`
// y `reservarPlantilla`), con una base en memoria que evalúa el filtro que cada una le pide. No se
// copia ningún cálculo: se compara lo que devuelve cada una.
//
// La zona del PROCESO se cambia aquí dentro (`process.env.TZ`) y se comprueba que ha entrado antes
// de medir nada: en Git Bash un `TZ=` delante de `node` no llega y no da error, y entonces se mide
// el reloj de la máquina creyendo que se mide otra cosa.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { casosEscritos } from './_casos-escritos.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);

const COMERCIO = 7;
const TOPE = 100;
const PENINSULA = 'Europe/Madrid';
const CANARIAS = 'Atlantic/Canary';

// ── La zona del proceso, puesta y COMPROBADA ───────────────────────────────────────────────
// Desfase esperado (en minutos, como lo da `getTimezoneOffset`) de un instante de verano.
const VERANO = '2026-07-15T12:00:00Z';
const PROCESOS = [
  ['UTC', 0],
  ['Europe/Madrid', -120],
  ['America/New_York', 240],
];

function procesoEn(zona, esperado) {
  process.env.TZ = zona;
  const visto = new Date(VERANO).getTimezoneOffset();
  assert.equal(visto, esperado,
    `🔴 CIEGO: se pidió el proceso en ${zona} y su reloj marca un desfase de ${visto} min (esperado `
    + `${esperado}). La zona no ha entrado: lo que venga detrás mediría el reloj de la máquina.`);
}

// ── La base: una lista en memoria que contesta al filtro que le piden ──────────────────────
const rotos = [];

/** Evalúa el `where` que piden las dos funciones. Lo que no conoce lo APUNTA y lanza. */
function casa(fila, where) {
  for (const [k, v] of Object.entries(where)) {
    if (k === 'OR') { if (!v.some((w) => casa(fila, w))) return false; continue; }
    if (k === 'AND') { if (!v.every((w) => casa(fila, w))) return false; continue; } // SCRUM-1596b: la reserva aparta los avisos al profesional
    if (k === 'createdAt') { if (!(fila.createdAt.getTime() >= v.gte.getTime())) return false; continue; }
    if (v && typeof v === 'object' && 'not' in v) { if (fila[k] === v.not) return false; continue; }
    if (v && typeof v === 'object') { rotos.push(k); throw new Error(`filtro que el doble no conoce: ${k}`); }
    if (fila[k] !== v) return false;
  }
  return true;
}

let FILAS = [];
let ZONA_GUARDADA = null;
const cuentas = [];
const tabla = {
  count: async (a) => { const n = FILAS.filter((f) => casa(f, a.where)).length; cuentas.push(n); return n; },
  findMany: async (a) => FILAS.filter((f) => casa(f, a.where)),
  create: async () => ({ id: 1 }),
};
const comercio = { findUnique: async () => ({ timezone: ZONA_GUARDADA }) };
const db = {
  merchant: comercio,
  whatsAppMessage: tabla,
  $transaction: async (cb) => cb({ merchant: comercio, $executeRaw: async () => 0, whatsAppMessage: tabla }),
};

const fP = requiere.resolve(path.join(RAIZ, 'dist/core/db/prisma.js'));
requiere.cache[fP] = { id: fP, filename: fP, loaded: true, exports: { prisma: db } };
const { getWhatsAppMetrics, reservarPlantilla } = requiere(path.join(RAIZ, 'dist/modules/messaging/domain/whatsappLog.service.js'));

let serie = 0;
const plantilla = (iso, mas = {}) => ({
  merchantId: COMERCIO, type: 'template', templateName: 'quote_decision_es', customerId: null,
  status: 'sent', waMessageId: `wamid.${++serie}`, costEstimate: 0.023, createdAt: new Date(iso), ...mas,
});
const enviada = (iso) => plantilla(iso);
const rechazada = (iso) => plantilla(iso, { status: 'failed', waMessageId: null });
const enCola = (iso) => plantilla(iso, { status: 'queued', waMessageId: null });
const porVentana = (iso) => plantilla(iso, { type: 'service', templateName: null, costEstimate: 0 });
const varias = (n, iso, f = enviada) => Array.from({ length: n }, () => f(iso));

/** Las mismas filas, por las dos funciones. `tope` es lo que CUENTA la reserva, no su veredicto. */
async function medir({ zona, ahora, filas }) {
  FILAS = filas; ZONA_GUARDADA = zona;
  const instante = new Date(ahora);
  const metricas = await getWhatsAppMetrics(COMERCIO, instante);

  cuentas.length = 0;
  mock.timers.enable({ apis: ['Date'], now: instante });
  let reserva;
  try {
    reserva = await reservarPlantilla(db, { merchantId: COMERCIO, topeComercio: TOPE, topeCliente: 3 });
  } finally {
    mock.timers.reset();
  }
  assert.equal(cuentas.length, 1, '🔴 CIEGO: la reserva sin cliente hace UNA pregunta; si no es una, no sé cuál es la del tope');
  assert.deepEqual(rotos, [], '🔴 CIEGO: el doble recibió un filtro que no sabe evaluar, y las métricas se tragan el error');
  return { metricas, panel: metricas.channel.templateToday, tope: cuentas[0], sale: reserva.ok };
}

// ═══ SUELO ═══════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1522b · SUELO: la zona del proceso entra, y el doble da filas a las dos funciones', async () => {
  for (const [zona, esperado] of PROCESOS) procesoEn(zona, esperado);
  procesoEn('UTC', 0);
  const r = await medir({ zona: null, ahora: '2026-07-15T16:00:00Z', filas: varias(87, '2026-07-15T08:00:00Z') });
  assert.equal(r.metricas.month.total, 87, 'las métricas ven las 87 filas');
  assert.equal(r.tope, 87, 'y la reserva también');
});

// ═══ 🔴 LOS DOS QUE DECIDEN (c.19157) ════════════════════════════════════════════════════════

// Los nombres van ESCRITOS (SCRUM-1415): un caso por zona de proceso, y `todos()` lanza si falta una.
const elDelFundador = casosEscritos(PROCESOS,
  ([proceso]) => `SCRUM-1522b · 🔴 13 de madrugada + 87 de día, comercio en Madrid, proceso en ${proceso}: el panel y el tope dicen 100`,
  async ([proceso, esperado]) => {
    procesoEn(proceso, esperado);
    // El día de Madrid 15-jul va de 14T22:00Z a 15T22:00Z. Se mira a las 18:00 de Madrid.
    const r = await medir({
      zona: PENINSULA, ahora: '2026-07-15T16:00:00Z',
      filas: [...varias(13, '2026-07-14T22:30:00Z'), ...varias(87, '2026-07-15T08:00:00Z')],
    });
    assert.equal(r.tope, 100, 'el tope cuenta las 100 del día del comercio');
    assert.equal(r.sale, false, 'y por eso el envío está bloqueado');
    assert.equal(r.panel, r.tope,
      `🔴 el panel dice «Hoy: ${r.panel}» y el tope cuenta ${r.tope}: el profesional ve que le quedan `
      + 'plantillas y el envío no sale.');
  });

const lasRechazadas = casosEscritos(PROCESOS,
  ([proceso]) => `SCRUM-1522b · 🔴 90 enviadas + 15 rechazadas, proceso en ${proceso}: el panel y el tope dicen 90`,
  async ([proceso, esperado]) => {
    procesoEn(proceso, esperado);
    for (const zona of [null, PENINSULA]) {
      const r = await medir({
        zona, ahora: '2026-07-15T16:00:00Z',
        filas: [...varias(90, '2026-07-15T08:00:00Z'), ...varias(15, '2026-07-15T09:00:00Z', rechazada)],
      });
      assert.equal(r.tope, 90, 'un rechazo devuelve el hueco: el tope cuenta 90');
      assert.equal(r.panel, r.tope, `🔴 zona ${zona}: el panel dice «Hoy: ${r.panel}» contando las rechazadas, y el tope ${r.tope}`);
      assert.equal(r.metricas.month.failed, 15, 'las rechazadas siguen en su cifra del mes: no se han perdido');
    }
  });

test('SCRUM-1522b · 🔴 13 de madrugada + 87 de día, comercio en Madrid, proceso en UTC: el panel y el tope dicen 100', elDelFundador(0));
test('SCRUM-1522b · 🔴 90 enviadas + 15 rechazadas, proceso en UTC: el panel y el tope dicen 90', lasRechazadas(0));
test('SCRUM-1522b · 🔴 13 de madrugada + 87 de día, comercio en Madrid, proceso en Europe/Madrid: el panel y el tope dicen 100', elDelFundador(1));
test('SCRUM-1522b · 🔴 90 enviadas + 15 rechazadas, proceso en Europe/Madrid: el panel y el tope dicen 90', lasRechazadas(1));
test('SCRUM-1522b · 🔴 13 de madrugada + 87 de día, comercio en Madrid, proceso en America/New_York: el panel y el tope dicen 100', elDelFundador(2));
test('SCRUM-1522b · 🔴 90 enviadas + 15 rechazadas, proceso en America/New_York: el panel y el tope dicen 90', lasRechazadas(2));
elDelFundador.todos();
lasRechazadas.todos();

test('SCRUM-1522b · 🔴 lo que está en cola cuenta en los dos, y lo que el proveedor aceptó y luego falló también', async () => {
  procesoEn('UTC', 0);
  const r = await medir({
    zona: PENINSULA, ahora: '2026-07-15T16:00:00Z',
    filas: [
      ...varias(4, '2026-07-15T08:00:00Z', enCola),
      ...varias(3, '2026-07-15T08:00:00Z', (iso) => plantilla(iso, { status: 'failed' })), // con identificador
      ...varias(2, '2026-07-15T08:00:00Z', rechazada),                                      // sin él
    ],
  });
  assert.equal(r.tope, 7);
  assert.equal(r.panel, 7);
});

// ═══ ② EL MES ════════════════════════════════════════════════════════════════════════════════

const elMes = casosEscritos(PROCESOS,
  ([proceso]) => `SCRUM-1522b · 🔴 el mes es el del comercio, con el proceso en ${proceso}`,
  async ([proceso, esperado]) => {
    procesoEn(proceso, esperado);
    // Son las 00:40 del 1 de agosto en Madrid (31-jul 22:40Z): 5 de agosto, 40 de julio.
    const filas = [...varias(5, '2026-07-31T22:10:00Z'), ...varias(40, '2026-07-20T10:00:00Z')];
    const madrid = await medir({ zona: PENINSULA, ahora: '2026-07-31T22:40:00Z', filas });
    assert.equal(madrid.metricas.month.total, 5, '🔴 a las 00:40 del día 1 el mes del panel sigue siendo el anterior');
    assert.equal(madrid.metricas.month.costEur, 0.115, 'y el coste estimado va con él');
    assert.equal(madrid.panel, 5);
    assert.equal(madrid.tope, 5);
    // Control: las mismas filas y el mismo instante, sin zona declarada → sigue siendo julio (UTC).
    const sinZona = await medir({ zona: null, ahora: '2026-07-31T22:40:00Z', filas });
    assert.equal(sinZona.metricas.month.total, 45, 'sin zona declarada vale UTC: lo que decide es la zona del comercio');

    // Y por el otro lado: 3 a las 00:30 del día 1 de Madrid (30-jun 22:30Z) son de julio.
    const primeras = varias(3, '2026-06-30T22:30:00Z');
    const julio = await medir({ zona: PENINSULA, ahora: '2026-07-01T10:00:00Z', filas: primeras });
    assert.equal(julio.metricas.month.total, 3, '🔴 las de la primera madrugada del mes se quedan fuera del mes');
    const julioSinZona = await medir({ zona: null, ahora: '2026-07-01T10:00:00Z', filas: primeras });
    assert.equal(julioSinZona.metricas.month.total, 0);
  });

test('SCRUM-1522b · 🔴 el mes es el del comercio, con el proceso en UTC', elMes(0));
test('SCRUM-1522b · 🔴 el mes es el del comercio, con el proceso en Europe/Madrid', elMes(1));
test('SCRUM-1522b · 🔴 el mes es el del comercio, con el proceso en America/New_York', elMes(2));
elMes.todos();

test('SCRUM-1522b · 🔴 «por ventana» de hoy también es del día del comercio', async () => {
  procesoEn('UTC', 0);
  FILAS = [...varias(4, '2026-07-14T22:30:00Z', porVentana), ...varias(6, '2026-07-15T08:00:00Z', porVentana), ...varias(2, '2026-07-13T08:00:00Z', porVentana)];
  ZONA_GUARDADA = PENINSULA;
  const m = await getWhatsAppMetrics(COMERCIO, new Date('2026-07-15T16:00:00Z'));
  assert.equal(m.channel.windowMonth, 12, 'suelo: ve los doce del mes');
  assert.equal(m.channel.windowToday, 10);
});

// ═══ EL BARRIDO ══════════════════════════════════════════════════════════════════════════════
// Cada media hora de cuatro ventanas (los dos cambios de hora, un fin de mes y el fin de año), con
// tres zonas de comercio y tres de proceso, sobre una bolsa de filas de todos los estados.

test('SCRUM-1522b · 🔴 BARRIDO: en ningún instante el panel y el tope cuentan distinto', async () => {
  const ventanas = ['2026-03-28T00:00:00Z', '2026-10-24T00:00:00Z', '2026-07-31T00:00:00Z', '2026-12-31T00:00:00Z'];
  const HORA = 3600000;
  const moldes = [enviada, enviada, rechazada, enCola, enviada];
  let mirados = 0; let conAlgo = 0; const distintos = [];
  const porZona = new Map();

  for (const [proceso, esperado] of PROCESOS) {
    procesoEn(proceso, esperado);
    for (const inicio of ventanas) {
      const t0 = Date.parse(inicio);
      const bolsa = [];
      for (let i = 0; i < 72 * 3; i++) bolsa.push(moldes[i % moldes.length](new Date(t0 - 12 * HORA + i * (HORA / 3)).toISOString()));
      for (const zona of [PENINSULA, CANARIAS, null]) {
        for (let t = t0; t < t0 + 48 * HORA; t += HORA / 2) {
          const r = await medir({ zona, ahora: new Date(t).toISOString(), filas: bolsa });
          mirados++;
          if (r.tope > 0) conAlgo++;
          if (r.panel !== r.tope) distintos.push(`${proceso} · ${zona} · ${new Date(t).toISOString()} · panel ${r.panel} · tope ${r.tope}`);
          const clave = `${inicio}·${new Date(t).toISOString()}`;
          porZona.set(clave, (porZona.get(clave) || new Set()).add(r.tope));
        }
      }
    }
  }

  assert.equal(mirados, 3 * 4 * 3 * 96, 'población: 3 procesos · 4 ventanas · 3 zonas · 96 instantes');
  assert.ok(conAlgo > mirados / 2, `🔴 CIEGO: sólo ${conAlgo} de ${mirados} instantes tenían algo que contar`);
  // Positivo: la bolsa DISTINGUE zonas. Si en ningún instante dos zonas dan cuentas distintas, la
  // igualdad de abajo se cumpliría también con un «hoy» que ignorase la zona.
  const queDistinguen = [...porZona.values()].filter((s) => s.size > 1).length;
  assert.ok(queDistinguen > 0, '🔴 CIEGO: ninguna zona cambia la cuenta en ningún instante; el barrido no mide el reloj');
  assert.deepEqual(distintos.slice(0, 5), [], `🔴 ${distintos.length} de ${mirados} instantes con el panel y el tope contando distinto`);
});
