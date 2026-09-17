// tests/scrum728d-viajes-de-la-reserva.test.mjs — SCRUM-728d
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LA FACTURA NO HACE CINCO VIAJES. EL TICKET MIDIÓ OTRA COSA.
//
// SCRUM-728 dice «880 ms = 5 viajes × 175 ms». Ese desglose es de `allocateAlbaranNumber`, y el
// propio ticket lo declara como hueco en §C5: *«Sólo albaranes. No he medido
// `allocateInvoiceNumber` ni `allocateQuoteNumber»*. Medido aquí, en ejecución:
//
//   albarán (lo que midió el ticket) ....... 5 viajes
//   justificante — el ES real de HOY ....... 7  (6 dentro del cerrojo)
//   factura F1 ............................. 8  (7 dentro del cerrojo)
//   rectificativa R1 ....................... 7  (6 dentro del cerrojo)
//
// **La emisión de una factura cuesta un 60 % más de viajes que lo que el ticket dimensionó.**
//
// ── LO QUE ESTE FICHERO CONGELA, Y POR QUÉ NO SON MILISEGUNDOS ──────────────────────────────
//
// Los ms dependen del RTT, y el RTT de una medición depende de DÓNDE se midió (SCRUM-826: los
// 175 ms eran la distancia de la máquina que midió, no la de la aplicación a su base). **El
// número de VIAJES no depende de eso**: es estructural, es el que decide el arreglo, y es el que
// se puede vigilar en CI sin base y sin falsos rojos por ruido.
//
// 🔴 NO ARREGLA NADA Y NO TOCA EL CAMINO DE EMISIÓN (regla 38 / AA1.4). El arreglo cae DENTRO de
// `invoiceNumber.service.ts`, que es STOP del fundador: se mide, se declara y se para.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  espiarReserva, conElCreateDelLlamador, cargarServicio, exigirSueloDeViajes, MERCHANTS, CensoCiego,
} from './_viajes-de-la-reserva.mjs';

/** Lo que midió la fase A para el ALBARÁN. Aquí es la referencia, no el objetivo. */
const VIAJES_DEL_ALBARAN = 5;

test('SCRUM-728d · SUELO: el servicio carga y el doble intercepta de verdad', async () => {
  const s = cargarServicio();
  assert.equal(typeof s.allocateInvoiceNumber, 'function',
    '🔴 `allocateInvoiceNumber` ya no se exporta: este censo no está midiendo lo que dice');
  const r = await espiarReserva({ merchant: MERCHANTS.justificante });
  assert.ok(r.sentencias.length >= 3,
    `🔴 sólo ${r.sentencias.length} sentencias interceptadas: el doble no está viendo el camino`);
  assert.match(r.numero, /^J-\d{8}-/, `🔴 el camino del justificante devolvió \`${r.numero}\``);
});

test('SCRUM-728d · SUELO: el cerrojo sigue siendo la PRIMERA sentencia (si no, se declara ciego)', async () => {
  const r = await espiarReserva({ merchant: MERCHANTS.fiscal });
  assert.equal(r.sentencias[0], 'pg_advisory_xact_lock',
    '🔴 el cerrojo ha dejado de ser lo primero. Lo que se lea antes queda fuera de la sección '
    + 'crítica y el read-then-write vuelve a tener carrera.');
});

test('SCRUM-728d · 🔴 EL NÚMERO QUE EL TICKET NO TENÍA: la factura hace 8 viajes, no 5', async () => {
  const f1 = conElCreateDelLlamador(await espiarReserva({
    merchant: MERCHANTS.fiscal, emitidas: [{ number: 'F260001' }, { number: 'F260002' }],
  }));
  assert.equal(f1.viajes, 8,
    `🔴 la emisión de una factura F1 hace ${f1.viajes} viajes (el ticket dimensionó con `
    + `${VIAJES_DEL_ALBARAN}, que son los del ALBARÁN). Si este número cambia, el tamaño del `
    + 'ticket cambia con él y hay que rehacer la proyección del parte.');
  assert.equal(f1.dentroDelCerrojo, 7,
    '🔴 el cerrojo es `xact`: se suelta en el COMMIT, así que TODO lo que va detrás se serializa. '
    + 'Este es el número que multiplica por N cuando hay N emisiones a la vez.');
});

test('SCRUM-728d · 🔴 el camino del ESPAÑOL REAL (justificante) hace 7, y es el 80 % de hoy', async () => {
  const j = conElCreateDelLlamador(await espiarReserva({ merchant: MERCHANTS.justificante }));
  assert.equal(j.viajes, 7,
    `🔴 el justificante hace ${j.viajes} viajes. Es el camino que emite el merchant ES real `
    + 'mientras `INVOICING_ES_ENABLED` siga OFF, así que es el que se paga hoy en producción.');
  assert.equal(j.dentroDelCerrojo, 6);
});

test('SCRUM-728d · la rectificativa hace 7 — un viaje menos que la F1, y se ve por qué', async () => {
  const r = await espiarReserva({ merchant: MERCHANTS.fiscal, rectifying: true });
  assert.equal(conElCreateDelLlamador(r).viajes, 7);
  assert.ok(!r.sentencias.some((s) => s.includes('findMany')),
    '🔴 la rectificativa ha empezado a leer la serie F entera. Ese viaje es el que escala con los '
    + 'datos, y hasta hoy sólo lo pagaba la F1.');
});

test('SCRUM-728d · 🔴 EL VIAJE QUE ESCALA CON LOS DATOS: la F1 lee la serie F ENTERA', async () => {
  // No es un viaje más: es un viaje cuyo COSTE crece con las facturas del año, dentro de una
  // sección crítica cuyo timeout (5 s) NO crece con nada. Es el mismo defecto de forma que la §4
  // del ticket encontró en la recapitulativa, aquí por volumen en vez de por bucle.
  const r = await espiarReserva({
    merchant: MERCHANTS.fiscal,
    emitidas: Array.from({ length: 500 }, (_, i) => ({ number: `F26${String(i + 1).padStart(4, '0')}` })),
  });
  const escala = r.sentencias.filter((s) => s.includes('escala con los datos'));
  assert.equal(escala.length, 1,
    '🔴 o la F1 ha dejado de leer la serie entera (bien: dilo en el parte y actualiza el número), '
    + 'o hay MÁS de una consulta que escala dentro del cerrojo.');
  assert.equal(r.numero, 'F260501',
    '🔴 con 500 emitidas la siguiente es la 501: si no, la derivación de la secuencia cambió');
});

test('SCRUM-728d · 🔴 ROJO: añadir UN viaje a la sección crítica hace caer el conteo', async () => {
  // El guard tiene que doler cuando alguien mete una consulta más entre el cerrojo y el COMMIT —
  // que es exactamente cómo este defecto creció hasta aquí. Se simula con el doble porque
  // MODIFICAR `invoiceNumber.service.ts` es STOP: el rojo no puede costar tocar el emisor.
  const conExtra = conElCreateDelLlamador(await espiarReserva({
    merchant: MERCHANTS.fiscal, emitidas: [], viajeExtra: true,
  }));
  assert.equal(conExtra.viajes, 9,
    '🔴 el censo NO ha visto el viaje añadido. Un contador que no sube cuando se añade trabajo a '
    + 'la sección crítica no está contando nada.');
  assert.notEqual(conExtra.viajes, 8, '🔴 el conteo no distingue con y sin el viaje extra');
});

test('SCRUM-728d · 🔴 SUELO EN ROJO: las dos cegueras lanzan, no devuelven cero', () => {
  // «no toca la base» y «no supe mirar» no pueden salir por la misma puerta, así que las dos
  // tienen que LANZAR. Se prueban sobre la comprobación suelta: con el doble puesto, el servicio
  // real siempre usa su `tx`, de modo que estos dos casos no se alcanzan desde `espiarReserva`.
  assert.throws(() => exigirSueloDeViajes([]), CensoCiego,
    '🔴 cero viajes tiene que declararse ciego: si el servicio dejara de usar el `tx` que recibe, '
    + 'el cerrojo se tomaría y soltaría en el acto y no protegería nada.');
  assert.throws(() => exigirSueloDeViajes(['merchant.findUnique', 'pg_advisory_xact_lock']), CensoCiego,
    '🔴 con el cerrojo en segundo lugar hay que caer: lo leído antes queda fuera de la sección '
    + 'crítica.');
  assert.deepEqual(exigirSueloDeViajes(['pg_advisory_xact_lock', 'merchant.update']).length, 2,
    '🔴 CONTROL POSITIVO: una secuencia correcta NO puede saltar, o el suelo estaría cazando todo');
});

test('SCRUM-728d · ⚠️ LO QUE ESTE FICHERO NO MIDE, dicho aquí y no en el parte', () => {
  // Un test que documenta su propio límite, para que nadie lea «8 viajes» como «8 × RTT = todo».
  // Los ms NO se miden aquí: dependen del RTT, y el RTT depende de dónde se mida (SCRUM-826).
  // Esta suite corre sin base a propósito — así vigila en CADA push, sin gate y sin falsos rojos.
  assert.ok(true);
});
