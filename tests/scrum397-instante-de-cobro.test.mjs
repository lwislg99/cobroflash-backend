// tests/scrum397-instante-de-cobro.test.mjs — SCRUM-397
//
// UN SOLO INSTANTE PARA UN SOLO HECHO.
//
// ── EL DEFECTO, QUE NO ERA «FALTA UNA COLUMNA» ─────────────────────────────────────────────
// `charges.paid_at` existía y no la escribía nadie. Pero el instante SÍ estaba guardado: en el
// `Event{type:'paid'}` que nace en la misma operación que el cambio de estado. Lo roto era que
// **tres consumidores daban tres respuestas** para el mismo hecho:
//
//   · el RECIBO DEL CLIENTE     → el evento `paid` más RECIENTE, y `psp.routes.ts` crea otro en
//     cada reintento del webhook: el documento que se lleva el cliente fechaba el pago el día del
//     reintento.
//   · el export de fees         → el PRIMER evento `paid` (lo correcto).
//   · `cobros.csv`              → `updatedAt`, la última vez que alguien tocó la fila.
//
// ⚠️ Y LA VÍCTIMA QUE DECIDE EL DISEÑO: un Bizum recibido el 31 de marzo y confirmado el 2 de
// abril quedaba fechado en abril. **Cruza de trimestre**, y con criterio de caja es el euro
// declarado en el periodo que no toca.
//
// ── LO QUE VIGILA ESTE FICHERO ────────────────────────────────────────────────────────────
// Que la columna no pueda convertirse en la CUARTA respuesta distinta. Y no lo hace comparando
// dos literales «que se parecen»: comprueba que **no hay dos sitios donde escribirlos** — la
// columna y el evento salen del mismo generador, con el mismo objeto `Date`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { censarMarcadores, censarLectores, GENERADOR, LECTOR, RAIZ } from './_censo-marcado-de-cobro.mjs';
import { datosDeCobroPagado, fechaDeCobroDeCharge, resolverInstanteDeCobro } from '../dist/modules/billing/domain/instanteDeCobro.js';
import { COPY_FECHA_FUTURA, COPY_FECHA_ILEGIBLE } from '../dist/modules/billing/domain/fechaDeCobro.js';

// ── 0 · SUELO ─────────────────────────────────────────────────────────────────────────────
// «Ningún marcador escribe la fecha a mano» y «no encontré ningún marcador» son el mismo verde
// con significados opuestos.

test('SCRUM-397 · SUELO: el censo ve los marcadores y ve los lectores', () => {
  const marcadores = censarMarcadores();
  assert.ok(marcadores.length >= 2,
    `🔴 el censo encuentra ${marcadores.length} sitios que marcan un cobro pagado: eran DOS `
    + '(los webhooks de PSP y de Mercado Pago). Si ahora ve menos, no está mirando donde cree — y '
    + 'todo lo que afirme debajo no significa nada.');
  const lectores = censarLectores();
  assert.ok(lectores.length >= 3,
    `🔴 el censo encuentra ${lectores.length} consumidores de la fecha de cobro: eran TRES `
    + '(recibo, cobros.csv y el export de fees).');
});

// ── 1 · LA COLUMNA NO PUEDE DISCREPAR DEL EVENTO ──────────────────────────────────────────

test('SCRUM-397 · 🔴 nadie marca un cobro pagado fuera del generador', () => {
  const fuera = censarMarcadores().filter((m) => !m.porGenerador);
  assert.deepEqual(fuera.map((m) => `${m.fichero}:${m.linea}`), [],
    '🔴 HAY UN SITIO QUE PONE UN COBRO EN PAGADO POR SU CUENTA:\n    '
    + fuera.map((m) => `${m.fichero}:${m.linea}${m.eventoAMano ? '  (y se fabrica su propio evento)' : ''}`).join('\n    ')
    + `\n\n  Va por \`${GENERADOR}(fecha, payload)\`, que devuelve el estado, la columna y el evento\n`
    + '  con el MISMO objeto Date. No es manía de estilo: dos asignaciones separadas son dos\n'
    + '  relojes, y la columna se convierte en la cuarta respuesta distinta a «cuándo se pagó»,\n'
    + '  que es justo lo que este ticket vino a cerrar.');
});

test('SCRUM-397 · el generador da UN instante, no dos que se parecen', () => {
  const fecha = new Date('2026-03-31T10:00:00.000Z');
  const datos = datosDeCobroPagado(fecha, { origen: 'test' });
  assert.equal(datos.status, 'paid');
  assert.equal(datos.paidAt, fecha, '🔴 la columna no lleva el instante que se le dio');
  assert.equal(datos.events.create.ts, fecha,
    '🔴 el evento se fecha aparte. Con `@default(now())` o con otro `new Date()` serían DOS '
    + 'relojes, y la diferencia aparecería justo en el reintento, que es cuando importa.');
  assert.equal(datos.events.create.ts, datos.paidAt, '🔴 columna y evento tienen que ser el MISMO valor');
});

// ── 2 · LOS TRES CONSUMIDORES, UNA SOLA RESPUESTA ─────────────────────────────────────────

test('SCRUM-397 · 🔴 nadie vuelve a leer la fecha de cobro de `updatedAt`', () => {
  const sospechosos = censarLectores().flatMap((l) => l.sospechas.map((s) => `${l.fichero}:${s.linea}  ${s.que}`));
  assert.deepEqual(sospechosos, [],
    '🔴 ALGUIEN LEE LA FECHA DE COBRO DE `updatedAt`:\n    ' + sospechosos.join('\n    ')
    + '\n\n  `updatedAt` es «la última vez que alguien tocó la fila», no «cuándo entró el dinero».\n'
    + `  La respuesta sale de \`${LECTOR}(cobro)\`, que es la misma para los tres consumidores.\n`
    + '  Un cobro del 31 de marzo editado el 2 de abril se exportaba como de abril: eso cruza de\n'
    + '  trimestre, y con criterio de caja es el euro declarado en el periodo que no toca.');
});

test('SCRUM-397 · los tres consumidores pasan por el lector común', () => {
  const lectores = censarLectores().filter((l) => l.usaLector).map((l) => l.fichero);
  for (const esperado of [
    'src/modules/billing/app/routes/receipt.routes.ts',
    'src/modules/exports/domain/exportData.ts',
    'src/modules/exports/app/routes/exports.routes.ts',
  ]) {
    assert.ok(lectores.includes(esperado),
      `🔴 ${esperado} ha dejado de usar el lector común. Volver a tener criterio propio es lo que `
      + 'permitió que tres sitios contestaran tres cosas distintas sin que nadie lo notara.');
  }
});

// ── 3 · EL LECTOR, EN AISLADO — y el caso del reintento, que era la víctima del CLIENTE ────

test('SCRUM-397 · manda la columna cuando existe', () => {
  const cobro = { paidAt: new Date('2026-03-31T09:00:00Z'), events: [{ type: 'paid', ts: new Date('2026-04-02T09:00:00Z') }] };
  assert.equal(fechaDeCobroDeCharge(cobro).toISOString(), '2026-03-31T09:00:00.000Z');
});

test('SCRUM-397 · 🔴 sin columna, el evento MÁS ANTIGUO — no el del reintento', () => {
  // Éste es el defecto que veía el CLIENTE en su recibo. `psp.routes.ts` crea otro evento `paid`
  // (marcado `duplicate: true`) cada vez que el webhook se repite, y el recibo cogía el último.
  const cobro = {
    paidAt: null,
    events: [
      { type: 'paid', ts: new Date('2026-03-31T09:00:00Z') },
      { type: 'card_session_created', ts: new Date('2026-03-30T09:00:00Z') },
      { type: 'paid', ts: new Date('2026-04-02T09:00:00Z') }, // el reintento
    ],
  };
  assert.equal(fechaDeCobroDeCharge(cobro).toISOString(), '2026-03-31T09:00:00.000Z',
    '🔴 se ha vuelto a coger el evento más reciente: el recibo del cliente enseñaría la fecha del '
    + 'reintento del webhook, no la del pago.');
});

test('SCRUM-397 · si no consta, es `null` — nunca una fecha cualquiera', () => {
  assert.equal(fechaDeCobroDeCharge({ paidAt: null, events: [] }), null);
  assert.equal(fechaDeCobroDeCharge({ paidAt: null, events: [{ type: 'created', ts: new Date() }] }), null);
  assert.equal(fechaDeCobroDeCharge(null), null);
  // Los cobros anteriores a la columna se quedan en `null` si no tienen evento: NO HAY BACKFILL, y
  // rellenarlos con `updatedAt` sería fabricar el dato que este ticket denuncia como inventado.
});

// ── 4 · EL CAMINO MANUAL, que es donde el trimestre se cruzaba ────────────────────────────

test('SCRUM-397 · la fecha declarada hacia atrás se admite sin límite', () => {
  const r = resolverInstanteDeCobro('2026-03-31', new Date('2026-04-02T12:00:00Z'));
  assert.equal(r.ok, true, '🔴 conciliar una transferencia vieja es EL caso de uso del camino manual');
  assert.equal(r.fecha.toISOString().slice(0, 10), '2026-03-31');
  assert.equal(r.origen, 'declarada');
});

test('SCRUM-397 · una fecha futura no se admite, y sin fecha vale «ahora»', () => {
  const ahora = new Date('2026-04-02T12:00:00Z');
  const futura = resolverInstanteDeCobro('2026-05-01', ahora);
  assert.equal(futura.ok, false, '🔴 una fecha futura no puede ser un hecho: el dinero no ha entrado');
  assert.equal(futura.message, COPY_FECHA_FUTURA, 'el texto es el APROBADO, no uno nuevo (regla 30)');
  assert.equal(resolverInstanteDeCobro('el martes', ahora).message, COPY_FECHA_ILEGIBLE);

  const vacia = resolverInstanteDeCobro(undefined, ahora);
  assert.equal(vacia.ok, true);
  assert.equal(vacia.origen, 'ahora',
    '🔴 sin fecha, «ahora» — que NO es el defecto: el defecto era no poder cambiarla.');
});

test('SCRUM-397 · el camino manual manda la fecha, y el webhook la lee', () => {
  // Las dos mitades del arreglo, cada una en su fichero. `ts` ya existía en el esquema del webhook
  // y no lo leía nadie: era el campo que estaba puesto y desconectado.
  const manual = fs.readFileSync(path.join(RAIZ, 'src/modules/billing/app/routes/chargesAdmin.routes.ts'), 'utf8');
  assert.match(manual, /resolverFechaDeCobro\(/,
    '🔴 `confirm-bizum` ha dejado de validar la fecha declarada: es el ÚNICO camino donde una '
    + 'persona marca un cobro, y por tanto el único donde el reloj podía no ser el del dinero.');
  assert.match(manual, /ts: fecha\.fecha\.toISOString\(\)/,
    '🔴 el camino manual ha vuelto a mandar la hora de proceso en vez de la fecha declarada.');

  const psp = fs.readFileSync(path.join(RAIZ, 'src/modules/billing/app/routes/psp.routes.ts'), 'utf8');
  assert.match(psp, /resolverInstanteDeCobro\(body\.ts\)/,
    '🔴 el webhook ha vuelto a ignorar `body.ts`. Ese campo lleva en el esquema desde siempre; el '
    + 'defecto era que nadie lo leía.');
});

// ── 5 · REGLA 38 · esto marca un cobro, NO emite ──────────────────────────────────────────

test('SCRUM-397 · el generador no toca el camino de emisión', () => {
  // Medido, no supuesto: el módulo del instante es puro. Si algún día importara emisión, este
  // ticket pasaría a ser STOP y hay que verlo aquí, no en el diff.
  const dominio = fs.readFileSync(path.join(RAIZ, 'src/modules/billing/domain/instanteDeCobro.ts'), 'utf8');
  for (const prohibido of ['emitInvoice', 'allocateInvoiceNumber', 'applyVeriFactu', 'sellar', 'prisma']) {
    assert.ok(!new RegExp(`\\b${prohibido}`).test(dominio.replace(/^\s*\/\/.*$/gm, '')),
      `🔴 el módulo del instante de cobro ha empezado a usar \`${prohibido}\`. Marcar un cobro no `
      + 'es emitir (regla 38), y este módulo es puro a propósito: sin BD y sin camino fiscal.');
  }
});
