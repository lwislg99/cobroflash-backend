// tests/scrum1296-procesador-cola.test.mjs — SCRUM-1296 · el procesador de la cola de remisión.
//
// `procesarObligado` (dist/modules/fiscal/verifactu/sif.procesador.js) sobre una cola EN MEMORIA
// y con el envío INYECTADO, que es como vive hoy (decisión D2 = X): nada importa `enviarSobre` y
// ningún cron lo llama. Lo que se fija:
//   · CONDICIÓN ② (SCRUM-1228): un 302 «sin certificado» va a una persona al PRIMER intento. Se
//     mide contando las llamadas al envío a lo largo de varias vueltas, no mirando un estado.
//   · la política de reintentos es la de `decidirTrasEnvio`, sin una segunda capa;
//   · CONDICIÓN ①: un envío que REVIENTA no toca ninguna factura;
//   · el `TiempoEsperaEnvio` de la AEAT se respeta por obligado; `SIF_ENABLED` en OFF pausa.
// ⛔ Ni una base, ni un byte de red, ni un certificado. Lo que NO prueba: que la AEAT acepte nada
// (sólo un CSV devuelto por ella lo demuestra) ni el enganche real con `enviarSobre` + TLS, que no
// existe todavía.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const { procesarObligado, idDelRegistro, SENT_INTERRUMPIDO_TRAS_MS } =
  requiere(path.join(RAIZ, 'dist/modules/fiscal/verifactu/sif.procesador.js'));
const { MAX_INTENTOS } = requiere(path.join(RAIZ, 'dist/modules/fiscal/verifactu/sif.cola.js'));

const NIF = 'B12345678';
const T0 = new Date('2026-09-30T10:00:00Z');
const mas = (d, s) => new Date(d.getTime() + s * 1000);

const registro = (numero) => `  <sum:RegistroFactura>
    <sum1:RegistroAlta>
      <sum1:IDVersion>1.0</sum1:IDVersion>
      <sum1:IDFactura>
        <sum1:IDEmisorFactura>${NIF}</sum1:IDEmisorFactura>
        <sum1:NumSerieFactura>${numero}</sum1:NumSerieFactura>
        <sum1:FechaExpedicionFactura>30-09-2026</sum1:FechaExpedicionFactura>
      </sum1:IDFactura>
    </sum1:RegistroAlta>
  </sum:RegistroFactura>`;

/** Una base en memoria con lo que el procesador pide, y un registro de TODO lo que toca. */
function base(numeros = ['F-1']) {
  const toques = [];
  const filas = numeros.map((n, i) => ({
    id: i + 1, merchantId: 77, invoiceId: 100 + i, obligadoNif: NIF, tipoOperacion: 'Alta',
    registroXml: registro(n), status: 'pending', attempts: 0, lastError: null, nextAttemptAt: null,
    lastSentAt: null, lastEnvioId: null, csv: null, estadoRegistro: null, subsanar: false,
  }));
  const flujos = new Map();
  const casa = (f, w = {}) => Object.entries(w).every(([k, v]) => {
    if (k === 'OR') return v.some((alt) => casa(f, alt));
    if (v === null) return f[k] === null;
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if ('lt' in v) return f[k] !== null && f[k] < v.lt;
      if ('lte' in v) return f[k] !== null && f[k] <= v.lte;
      if ('in' in v) return v.in.includes(f[k]);
    }
    return f[k] === v;
  });
  const prisma = {
    vfSubmission: {
      findMany: async ({ where, take }) => filas.filter((f) => casa(f, where)).sort((a, b) => a.id - b.id).slice(0, take ?? Infinity).map((f) => ({ ...f })),
      updateMany: async ({ where, data }) => { const fs = filas.filter((f) => casa(f, where)); fs.forEach((f) => Object.assign(f, data)); return { count: fs.length }; },
      update: async ({ where, data }) => Object.assign(filas.find((f) => f.id === where.id), data),
    },
    vfFlujoObligado: {
      findUnique: async ({ where }) => flujos.get(where.obligadoNif) ?? null,
      upsert: async ({ where, create, update }) => { const f = flujos.get(where.obligadoNif); flujos.set(where.obligadoNif, f ? { ...f, ...update } : create); },
    },
    merchant: { findUnique: async () => ({ id: 77, name: 'Fontanería', legalName: 'Fontanería S.L.' }) },
  };
  // Cualquier otro modelo (una factura, sobre todo) queda APUNTADO: el procesador no debe tocarlo.
  const espia = new Proxy(prisma, {
    get: (t, k) => t[k] ?? new Proxy({}, { get: (_, m) => async () => { toques.push(`${String(k)}.${String(m)}`); return null; } }),
  });
  return { prisma: espia, filas, flujos, toques };
}

/** Un envío que devuelve siempre `resultado` y cuenta cuántas veces se le llamó. */
function envio(resultado) {
  const e = async (p) => { e.llamadas.push(p); return typeof resultado === 'function' ? resultado(p) : resultado; };
  e.llamadas = [];
  return e;
}

const SIN_PERMISO = { tipo: 'sin_permiso', etapa: 'interpretar', motivo: 'http_302', ms: 5, httpStatus: 302 };
const SIN_RESPUESTA = { tipo: 'sin_respuesta', etapa: 'esperar_respuesta', motivo: 'timeout', ms: 60000, httpStatus: null };
const correcto = (numeros, espera = 60) => ({
  tipo: 'respondido', httpStatus: 200, ms: 10,
  respuesta: {
    estadoEnvio: 'Correcto', csv: 'A-CSVDEPRUEBA', tiempoEsperaEnvioS: espera,
    lineas: numeros.map((n) => ({
      idEmisorFactura: NIF, numSerieFactura: n, fechaExpedicionFactura: '30-09-2026', tipoOperacion: 'Alta',
      estadoRegistro: 'Correcto', codigoError: null, descripcionError: null, duplicado: null,
    })),
  },
});

// ═══ SUELO ═════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1296 · SUELO: el procesador lee el IDFactura del registro guardado', () => {
  assert.deepEqual(idDelRegistro(registro('F-1'), 'Alta'),
    { idEmisorFactura: NIF, numSerieFactura: 'F-1', fechaExpedicionFactura: '30-09-2026', tipoOperacion: 'Alta' });
  assert.equal(idDelRegistro('<nada/>', 'Alta'), null);
});

test('SCRUM-1296 · SUELO: con respuesta Correcto, la fila queda ACEPTADA con su CSV y el sobre lleva el registro guardado', async () => {
  const b = base(['F-1']);
  const e = envio(correcto(['F-1']));
  const r = await procesarObligado(NIF, e, { prisma: b.prisma, ahora: T0, sifEnabled: true });
  assert.equal(r.hecho, 'enviado');
  assert.equal(e.llamadas.length, 1);
  assert.ok(e.llamadas[0].cuerpoSoap.includes(registro('F-1')), 'el sobre no lleva el registro TAL COMO SE GUARDÓ');
  assert.match(e.llamadas[0].cuerpoSoap, /<sum1:NIF>B12345678<\/sum1:NIF>/);
  assert.equal(b.filas[0].status, 'accepted');
  assert.equal(b.filas[0].csv, 'A-CSVDEPRUEBA');
  assert.equal(b.filas[0].estadoRegistro, 'Correcto');
});

// ═══ CONDICIÓN ② · SCRUM-1228: un 302 NO se reintenta como si fuera la red ═══════════════════════

test('SCRUM-1296 · 🔴 ② un 302 «sin certificado» va a una persona al PRIMER intento: el envío se llama UNA vez en todas las vueltas', async () => {
  const b = base(['F-1']);
  const e = envio(SIN_PERMISO);
  let ahora = T0;
  for (let vuelta = 0; vuelta < 6; vuelta += 1) {
    await procesarObligado(NIF, e, { prisma: b.prisma, ahora, sifEnabled: true });
    ahora = mas(ahora, 3600); // una hora entre vueltas: cualquier backoff habría vencido
  }
  assert.equal(e.llamadas.length, 1,
    `🔴 el 302 se ha reenviado ${e.llamadas.length} veces: es el defecto medido en SCRUM-1228 (4 reintentos como si fuera la red)`);
  assert.equal(b.filas[0].status, 'manual_review');
  assert.equal(b.filas[0].attempts, 1);
  assert.match(b.filas[0].lastError, /^sin_permiso:/);
});

test('SCRUM-1296 · ✅ control de ②: sin respuesta SÍ se reintenta, con backoff, hasta MAX_INTENTOS y a una persona', async () => {
  const b = base(['F-1']);
  const e = envio(SIN_RESPUESTA);
  let ahora = T0;
  for (let vuelta = 0; vuelta < MAX_INTENTOS + 3; vuelta += 1) {
    await procesarObligado(NIF, e, { prisma: b.prisma, ahora, sifEnabled: true });
    ahora = mas(ahora, 3600);
  }
  assert.equal(e.llamadas.length, MAX_INTENTOS, 'la política de la cola es la que manda: ni uno más, ni uno menos');
  assert.equal(b.filas[0].status, 'manual_review');
  assert.equal(b.filas[0].attempts, MAX_INTENTOS);
});

test('SCRUM-1296 · sin respuesta: la fila vuelve a pending y NO se reenvía antes de su backoff', async () => {
  const b = base(['F-1']);
  const e = envio(SIN_RESPUESTA);
  await procesarObligado(NIF, e, { prisma: b.prisma, ahora: T0, sifEnabled: true });
  assert.equal(b.filas[0].status, 'pending');
  assert.equal(b.filas[0].attempts, 1);
  // El backoff del 1er intento es el suelo de 60 s (`backoffS(1)`), el mismo que el flujo de control.
  assert.equal(b.filas[0].nextAttemptAt.getTime(), mas(T0, 60).getTime());
  const r = await procesarObligado(NIF, e, { prisma: b.prisma, ahora: mas(T0, 59), sifEnabled: true });
  assert.equal(r.hecho, 'esperando');
  assert.equal(e.llamadas.length, 1);
  // 2º intento fallido: el backoff sube a 120 s y ya NO coincide con el flujo (60 s).
  await procesarObligado(NIF, e, { prisma: b.prisma, ahora: mas(T0, 60), sifEnabled: true });
  assert.equal(e.llamadas.length, 2);
  assert.equal(b.filas[0].nextAttemptAt.getTime(), mas(T0, 180).getTime());
  const r2 = await procesarObligado(NIF, e, { prisma: b.prisma, ahora: mas(T0, 121), sifEnabled: true });
  assert.equal(r2.hecho, 'nada_pendiente', '🔴 se ha reenviado antes de su backoff');
  assert.equal(e.llamadas.length, 2);
});

// ═══ CONDICIÓN ① · un envío que revienta no toca ninguna factura ═════════════════════════════════

test('SCRUM-1296 · 🔴 ① un envío que REVIENTA no toca ninguna factura; la fila la recoge la cola como «sin respuesta»', async () => {
  const b = base(['F-1']);
  const revienta = envio(() => { throw new Error('socket hang up'); });
  await assert.rejects(procesarObligado(NIF, revienta, { prisma: b.prisma, ahora: T0, sifEnabled: true }));
  assert.deepEqual(b.toques, [], `🔴 el procesador ha tocado otros modelos: ${b.toques.join(', ')}`);
  assert.equal(b.filas[0].status, 'sent', 'no se sabe si llegó: se queda en vuelo, no se da por nada');

  // Antes del umbral no se toca (el sobre podría seguir en vuelo en otro proceso)…
  const nada = envio(correcto(['F-1']));
  await procesarObligado(NIF, nada, { prisma: b.prisma, ahora: mas(T0, 61), sifEnabled: true });
  assert.equal(b.filas[0].status, 'sent');
  // …y pasado el umbral, `recuperarEnviadoSinCierre`: pending, un intento contado.
  const tarde = new Date(T0.getTime() + SENT_INTERRUMPIDO_TRAS_MS + 1000);
  const e = envio(SIN_RESPUESTA);
  await procesarObligado(NIF, e, { prisma: b.prisma, ahora: tarde, sifEnabled: true });
  assert.equal(b.filas[0].attempts, 1, 'el intento interrumpido cuenta');
  assert.equal(b.filas[0].status, 'pending');
  assert.match(b.filas[0].lastError, /proceso_interrumpido_en_sent/);
  assert.equal(e.llamadas.length, 0, 'recuperada, espera su backoff: no se reenvía en la misma vuelta');
});

// ═══ FLUJO DE CONTROL Y PAUSA ══════════════════════════════════════════════════════════════════

test('SCRUM-1296 · el TiempoEsperaEnvio de la AEAT se respeta para ese obligado', async () => {
  const b = base(['F-1', 'F-2']);
  const e = envio((p) => correcto(p.cuerpoSoap.includes('F-2') && !p.cuerpoSoap.includes('F-1') ? ['F-2'] : ['F-1'], 120));
  // Sólo F-1 vence ahora.
  b.filas[1].nextAttemptAt = mas(T0, 30);
  await procesarObligado(NIF, e, { prisma: b.prisma, ahora: T0, sifEnabled: true });
  assert.equal(b.flujos.get(NIF).tiempoEsperaEnvioS, 120);
  const r = await procesarObligado(NIF, e, { prisma: b.prisma, ahora: mas(T0, 60), sifEnabled: true });
  assert.equal(r.hecho, 'esperando', '🔴 se ha enviado antes del TiempoEsperaEnvio que impuso la AEAT');
  assert.equal(e.llamadas.length, 1);
  await procesarObligado(NIF, e, { prisma: b.prisma, ahora: mas(T0, 121), sifEnabled: true });
  assert.equal(e.llamadas.length, 2);
  assert.equal(b.filas[1].status, 'accepted');
});

test('SCRUM-1296 · con SIF_ENABLED en OFF la cola está en PAUSA: no envía ni toca nada', async () => {
  const b = base(['F-1']);
  const e = envio(correcto(['F-1']));
  const r = await procesarObligado(NIF, e, { prisma: b.prisma, ahora: T0, sifEnabled: false });
  assert.equal(r.hecho, 'pausada');
  assert.equal(e.llamadas.length, 0);
  assert.equal(b.filas[0].status, 'pending');
  // Control: sin pasar el parámetro manda el flag real, que hoy está en OFF.
  const r2 = await procesarObligado(NIF, e, { prisma: b.prisma, ahora: T0 });
  assert.equal(r2.hecho, 'pausada');
});
