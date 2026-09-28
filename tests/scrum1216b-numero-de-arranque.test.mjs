// tests/scrum1216b-numero-de-arranque.test.mjs — SCRUM-1216b
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// SI EL PROFESIONAL DECLARA 41, SU PRIMERA FACTURA CON YaQu ES LA 42
//
// GO del fundador para el camino de emisión: SCRUM-1216, comentario 17347 (28-sep-2026). De las
// tres firmas de SCRUM-780 (7-sep-2026) se reabre UNA: «serie nueva que empieza en 0001» pasa a
// «empieza donde él diga». Siguen en pie el formato `F260001` y que `invoiceSeriesPrefix` no
// vuelve al número.
//
// El defecto, medido contra el `allocateInvoiceNumber` real: desde el corte de la serie F, la
// secuencia sale SÓLO de lo ya emitido (`siguienteSeqDeLaSerieF`), así que con «41» declarado sale
// `F<AA>0001`, igual que sin declarar nada.
//
// ── CÓMO SE MIDE, y por qué así ─────────────────────────────────────────────────────────────
// De punta a punta y sin suponer DÓNDE se guarda el arranque: la declaración entra por la ruta
// REAL (`POST /admin/onboarding/serie`, app real con Prisma sustituido), lo que la ruta escribe se
// aplica al merchant, y ese merchant se le da al `allocateInvoiceNumber` REAL con un `tx` falso
// (regla 38). Si mañana el arranque vive en otra columna, este test no cambia: mide lo que ve el
// profesional —lo que declaró y el número que sale—, no el campo.
//
// ── EL CONTROL QUE FIJA SCRUM-780 ───────────────────────────────────────────────────────────
// El merchant 1 de dev tiene `nextInvoiceNumber = 6` porque gastó `2026-FG-001..005` ANTES del
// corte, sin declarar nada. Su primera F tiene que seguir siendo la 0001: el contador de la serie
// vieja no es un arranque declarado (scrum780-formato-f-en-la-factura.test.mjs).
// ═════════════════════════════════════════════════════════════════════════════════════════
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { montarAppReal, bancoDePrisma, sesionesDe } from './_banco-camino-real.mjs';

const ZONA = 'Europe/Madrid';
// La ruta toma el año del reloj (en la zona del merchant, SCRUM-1168) y el emisor también: los dos
// sobre `new Date()`, para que declaren y numeren en el MISMO año pase cuando pase la tanda.
const AHORA = new Date();
const ANIO = Number(new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric' }).format(AHORA));
const AA = String(ANIO % 100).padStart(2, '0');
const F = (n) => `F${AA}${String(n).padStart(4, '0')}`;

const app = await montarAppReal();
after(() => app.cerrar());
// El emisor se importa DESPUÉS de montar la app: importarlo antes carga el cliente de Prisma real
// antes de que el banco instale su doble, y el banco se niega a medir (su SUELO lo caza).
const { allocateInvoiceNumber } = await import('../dist/modules/invoicing/domain/invoiceNumber.service.js');
const ses = sesionesDe(77, { id: 9, role: 'technician', merchantId: 77 });

/** El merchant de partida: sin declarar nada, sin serie del año. */
const BASE = {
  invoiceSeriesPrefix: 'CF', invoiceSeriesYear: null, nextInvoiceNumber: 1, nextRectInvoiceNumber: 1,
  timezone: ZONA, country: 'ES', email: 'pro@x.es', flags: { INVOICING_ES_ENABLED: true },
};

/**
 * Pasa `cuerpo` por la ruta REAL con el merchant `m` y las facturas `emitidas`, y devuelve el
 * merchant tal como queda (lo que la ruta escribió, aplicado encima) y la respuesta.
 */
async function declarar(m, emitidas, cuerpo, ruta = '/admin/onboarding/serie') {
  const escrito = {};
  bancoDePrisma().programar({
    authSession: ses.tabla,
    merchant: {
      findUnique: async () => ({ ...ses.merchant, ...m }),
      update: async (a) => { Object.assign(escrito, a.data); return { ...m, ...a.data }; },
    },
    invoice: {
      findMany: async (a) => emitidas.filter((n) => n.startsWith(a?.where?.number?.startsWith ?? '')).map((number) => ({ number })),
      findFirst: async () => null,
    },
  });
  const r = await app.pedir(ruta, { token: ses.PROPIETARIO, metodo: 'POST', cuerpo });
  return { r, merchant: { ...m, ...escrito } };
}

/** El número que emite el `allocateInvoiceNumber` REAL para ese merchant y esas emitidas. */
async function emitir(m, emitidas, instante = AHORA) {
  const tx = {
    $executeRaw: async () => 0,
    merchant: {
      findUnique: async () => ({ id: 77, ...m }),
      update: async () => ({}),
    },
    invoice: {
      findUnique: async () => null,
      findMany: async (a) => emitidas.filter((n) => n.startsWith(a?.where?.number?.startsWith ?? '')).map((number) => ({ number })),
    },
    auditLog: { create: async (a) => a.data },
  };
  return allocateInvoiceNumber(tx, 77, { camino: 'C3', actor: { tipo: 'pro_propietario', teamMemberId: null } }, instante);
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① EL ARRANQUE DECLARADO LLEGA A LA FACTURA
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1216b · 🔴 declara «mi última fue la 41» → su primera factura es la 42', async () => {
  const { r, merchant } = await declarar(BASE, [], { vieneDeOtroSitio: true, ultimoNumero: 41 });
  assert.equal(r.status, 200, `la ruta no aceptó la declaración: ${r.status} ${JSON.stringify(r.json)}`);
  assert.equal(await emitir(merchant, []), F(42),
    '🔴 el número declarado NO llega a la factura: repetiría un número que el profesional ya usó');
});

test('SCRUM-1216b · 🔴 lo que PROMETE la vista previa es lo que SALE (declarado 41)', async () => {
  const { r } = await declarar(BASE, [], { vieneDeOtroSitio: true, ultimoNumero: 41 }, '/admin/onboarding/serie/previa');
  assert.equal(r.status, 200);
  const { merchant } = await declarar(BASE, [], { vieneDeOtroSitio: true, ultimoNumero: 41 });
  const sale = await emitir(merchant, []);
  assert.equal(r.json.proximoNumero, sale,
    `🔴 la pantalla promete ${r.json.proximoNumero} y la factura sale ${sale}`);
  assert.equal(sale, F(42));
});

test('SCRUM-1216b · 🔴 declarado 41 y ya emitidas F…0042 y F…0043 → la siguiente es la 44 (nunca repite)', async () => {
  const { merchant } = await declarar(BASE, [], { vieneDeOtroSitio: true, ultimoNumero: 41 });
  assert.equal(await emitir(merchant, [F(42), F(43)]), F(44));
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② LOS CONTROLES — lo que NO puede cambiar
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1216b · CONTROL · «No, empiezo ahora» → la 0001', async () => {
  const { r, merchant } = await declarar(BASE, [], { vieneDeOtroSitio: false });
  assert.equal(r.status, 200);
  assert.equal(await emitir(merchant, []), F(1));
});

test('SCRUM-1216b · CONTROL SCRUM-780 · el contador VIEJO (6, por FG-001..005) no es un arranque → la 0001', async () => {
  // El merchant 1 de dev: nadie declaró nada; el 6 es de la serie vieja.
  const dev = { ...BASE, invoiceSeriesPrefix: 'FG', invoiceSeriesYear: ANIO, nextInvoiceNumber: 6 };
  const viejas = [1, 2, 3, 4, 5].map((n) => `${ANIO}-FG-00${n}`);
  assert.equal(await emitir(dev, viejas), F(1),
    '🔴 el contador de la serie vieja se ha colado como arranque: la serie F nacería con huecos');
});

test('SCRUM-1216b · CONTROL · el arranque es DEL AÑO: declarado este año, el 1-ene siguiente vuelve a la 0001', async () => {
  const { merchant } = await declarar(BASE, [], { vieneDeOtroSitio: true, ultimoNumero: 41 });
  const añoQueViene = new Date(Date.UTC(ANIO + 1, 0, 15, 12));
  assert.equal(await emitir(merchant, [], añoQueViene), `F${String((ANIO + 1) % 100).padStart(2, '0')}0001`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ EL CHOQUE — no se declara por debajo (ni por encima) de lo ya emitido en la serie F
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1216b · 🔴 con facturas F ya emitidas este año, declarar un arranque se RECHAZA (choca_con_emitidas)', async () => {
  // Sin esto, quien lleva F…0001..0010 puede declarar 41 y su serie salta de la 10 a la 42: no
  // duplica, pero deja 31 huecos en su propia serie que nadie puede cerrar (regla 29).
  const emitidas = Array.from({ length: 10 }, (_, i) => F(i + 1));
  const { r, merchant } = await declarar(BASE, emitidas, { vieneDeOtroSitio: true, ultimoNumero: 41 });
  assert.equal(r.status, 409, `🔴 la ruta aceptó un arranque con la serie F ya empezada: ${r.status}`);
  assert.equal(r.json?.error, 'choca_con_emitidas');
  assert.equal(await emitir(merchant, emitidas), F(11), 'la serie sigue donde iba');
});
