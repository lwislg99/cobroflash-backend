// tests/scrum1509g-el-tope-bloquea.test.mjs — SCRUM-1509g (J2, 20-oct)
//
// 🔴 EL TOPE DE PLANTILLAS DEJABA SALIR TODO CUANDO NO PODÍA COMPROBARSE. Decisión del fundador,
// SCRUM-1509 c.19620 (14-oct-2026), literal: «Ok que el tope bloquee». Desde SCRUM-1513 la pregunta
// y la fila van juntas (`reservarPlantilla`, bajo el cerrojo del comercio), y si esa reserva LANZA
// —porque la base no contesta al leer o al apuntar— el `catch` de `sendWhatsAppTemplate` decía
// «Best-effort: si la BD falla, NO se bloquea» y el mensaje salía. Diez recordatorios con la base
// rota eran diez plantillas: un contador que no para no es un tope.
//
// 🔵 LO QUE CONTESTA AL BLOQUEAR NO ES TEXTO NUEVO (regla 39). Es el mismo trato que ya tiene la
// baja cuando no se puede comprobar (SCRUM-1262, `MOTIVO_BAJA_NO_COMPROBABLE`): un motivo propio
// que no está en `SEND_FAILURE_MESSAGES`, así que la ruta lo lleva a la frase que ya da hoy para
// ese otro motivo. El último caso de este fichero lo compara, letra a letra, con lo que la ruta
// contesta para la baja sin comprobar.
//
// ⛔ LO QUE NO HACE: la salida A–E del recordatorio de facturas (no elegida; reglas 27 y 30), ni el
// límite delante del webhook de entrantes (sin número decidido), ni los llamadores que no pasan
// cliente (SCRUM-1509d). Todo eso queda nombrado en `docs/master/SCRUM-1509.md`, tramo 1509g.
//
// ── EL BANCO ── el de scrum1478: el handler REAL de `POST /admin/invoices/:id/send-reminder`
// (`dist/`), la base doblada (`_envio-doblado.mjs`) y el WhatsApp por el dry-run de la casa, que
// pasa todos los guards (baja, topes) y sólo se salta la llamada a Meta. Lo que sale se cuenta en
// su buzón. ⚠️ Se prueba el handler y no la app montada (A10, SCRUM-1344): el montaje de esa ruta
// no cambia aquí.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const RUTA = '../dist/modules/system/app/routes/invoicesAdmin.routes.js';
const WA = '../dist/integrations/whatsapp.js';

const factura = {
  id: 7, merchantId: MERCHANT, customerId: CLIENTE, number: 'F260007', status: 'pending', total: '419.87', currency: 'EUR',
  chargeId: 90, reminder7SentAt: null, reminder14SentAt: null,
  merchant: { id: MERCHANT, name: 'Taller de prueba', legalName: null, country: 'ES' },
  customer: { id: CLIENTE, name: 'Cliente de prueba', phone: '34000000001', mobile: null, email: 'cliente@example.invalid' },
};
const COBRO = { 'charge.findUnique': () => ({ id: 90, receiptToken: 'tok-1509g-de-laboratorio' }) };
const VECES = 10;
const rota = (que) => () => { throw new Error(`la base no contesta (${que})`); };

/** Las tres formas de no poder comprobar el tope, cada una por su sitio de la base. */
const SIN_COMPROBAR = {
  'falla la LECTURA del tope': { 'whatsAppMessage.count': rota('count') },
  'falla la ESCRITURA de la reserva': { 'whatsAppMessage.create': rota('create') },
  // ⚠️ No se rompe `$transaction`: el doble la ejecuta siempre y no lee `respuestas` para ella
  // (`_envio-doblado.mjs`), así que «romperla» ahí no rompía nada. Se rompe el CERROJO, que es la
  // primera sentencia DENTRO de la transacción (SCRUM-1513), y el control de abajo comprueba que
  // de verdad se le pidió.
  'falla el CERROJO del comercio': { $executeRaw: (trozos) => { cerrojosPedidos += 1; throw new Error(`la base no contesta (${String(trozos?.join?.('?') ?? trozos).slice(0, 40)})`); } },
};
let cerrojosPedidos = 0;

async function llamar() {
  const router = moduloDeDist(RUTA).default;
  assert.ok(router && Array.isArray(router.stack), '🔴 CIEGO: no encuentro el router de facturas');
  const capa = router.stack.find((l) => l.route && l.route.path === '/:id/send-reminder' && l.route.methods.post);
  assert.ok(capa, '🔴 CIEGO: no encuentro POST /:id/send-reminder');
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  const r = { status: 200, cuerpo: null };
  const res = { status(s) { r.status = s; return res; }, json(b) { r.cuerpo = b; return res; } };
  const [error, aviso] = [console.error, console.warn];
  console.error = () => {};
  console.warn = () => {};
  try {
    await h(reqDeSesion({ rol: 'admin', merchantId: MERCHANT, params: { id: '7' }, body: {}, headers: {} }), res);
  } finally {
    console.error = error;
    console.warn = aviso;
  }
  return r;
}

/** `VECES` recordatorios seguidos con la base que se le diga; devuelve cuántos salieron y la última respuesta. */
async function recordar(respuestas = {}, veces = VECES) {
  inyectarBase({ 'invoice.findFirst': () => factura, ...COBRO, ...respuestas }, [RUTA, WA]);
  const buzon = [];
  globalThis.__waDryRunOutbox = buzon;
  const anterior = process.env.WHATSAPP_DRY_RUN;
  process.env.WHATSAPP_DRY_RUN = '1';
  try {
    let ultima = null;
    for (let i = 0; i < veces; i += 1) ultima = await llamar();
    return { salieron: buzon.length, ultima };
  } finally {
    delete globalThis.__waDryRunOutbox;
    if (anterior === undefined) delete process.env.WHATSAPP_DRY_RUN; else process.env.WHATSAPP_DRY_RUN = anterior;
  }
}

test('SCRUM-1509g · SUELO: con la base sana el recordatorio sale, y la ruta dice que salió', async () => {
  const r = await recordar({}, 1);
  assert.equal(r.salieron, 1, '🔴 CIEGO: con todo sano no ha salido nada; ningún bloqueo de abajo diría algo');
  assert.equal(r.ultima.status, 200);
  assert.equal(r.ultima.cuerpo.sent, true);
});

test('SCRUM-1509g · SUELO: con el tope del negocio alcanzado (base sana) se bloquea como antes, con su motivo', async () => {
  const r = await recordar({ 'whatsAppMessage.count': () => 99999 });
  assert.equal(r.salieron, 0);
  assert.equal(r.ultima.cuerpo.sent, false);
  assert.equal(r.ultima.cuerpo.error, 'daily_cap');
});

test('SCRUM-1509g · 🔴 falla la LECTURA del tope: de 10 recordatorios no sale NINGUNO, y la ruta dice que no salió', async () => {
  const r = await recordar(SIN_COMPROBAR['falla la LECTURA del tope']);
  assert.equal(r.salieron, 0, `🔴 con la lectura del tope rota han salido ${r.salieron} de ${VECES}: el tope no bloquea`);
  assert.equal(r.ultima.cuerpo.sent, false);
});

test('SCRUM-1509g · 🔴 falla la ESCRITURA de la reserva: de 10 recordatorios no sale NINGUNO, y la ruta dice que no salió', async () => {
  const r = await recordar(SIN_COMPROBAR['falla la ESCRITURA de la reserva']);
  assert.equal(r.salieron, 0, `🔴 con la reserva sin poder apuntarse han salido ${r.salieron} de ${VECES}: el tope no bloquea`);
  assert.equal(r.ultima.cuerpo.sent, false);
});

test('SCRUM-1509g · 🔴 falla el CERROJO del comercio: de 10 recordatorios no sale NINGUNO, y la ruta dice que no salió', async () => {
  cerrojosPedidos = 0;
  const r = await recordar(SIN_COMPROBAR['falla el CERROJO del comercio']);
  assert.equal(cerrojosPedidos, VECES, `🔴 CIEGO: el cerrojo se pidió ${cerrojosPedidos} veces de ${VECES}; este caso no estaría rompiendo nada`);
  assert.equal(r.salieron, 0, `🔴 con el cerrojo sin poder tomarse han salido ${r.salieron} de ${VECES}: el tope no bloquea`);
  assert.equal(r.ultima.cuerpo.sent, false);
});

test('SCRUM-1509g · 🔵 lo que lee el profesional NO es texto nuevo: es, letra a letra, lo que la ruta ya contesta con la baja sin comprobar', async () => {
  const baja = await recordar({ 'customer.findMany': rota('baja') }, 1);
  assert.equal(baja.salieron, 0, '🔴 CIEGO: con la baja sin comprobar tenía que bloquear (SCRUM-1262)');
  const tope = await recordar(SIN_COMPROBAR['falla la LECTURA del tope'], 1);
  const { MOTIVO_BAJA_NO_COMPROBABLE, MOTIVO_TOPE_NO_COMPROBABLE } = moduloDeDist(WA);
  assert.equal(typeof MOTIVO_TOPE_NO_COMPROBABLE, 'string', 'el motivo del tope sin comprobar tiene nombre propio, como el de la baja');
  assert.notEqual(MOTIVO_TOPE_NO_COMPROBABLE, MOTIVO_BAJA_NO_COMPROBABLE, 'no es la baja: decirlo sería mentirle al profesional');
  assert.notEqual(MOTIVO_TOPE_NO_COMPROBABLE, 'daily_cap', 'tampoco es el tope alcanzado: no se sabe si lo está');
  // Fuera el motivo para la máquina, el cuerpo que ve la pantalla es el mismo.
  const sinMotivo = ({ error, motivoDelEnvio, ...resto }) => resto;
  assert.deepEqual(sinMotivo(tope.ultima.cuerpo), sinMotivo(baja.ultima.cuerpo),
    `🔴 el tope sin comprobar contesta otra cosa que la baja sin comprobar: ${JSON.stringify(tope.ultima.cuerpo)} frente a ${JSON.stringify(baja.ultima.cuerpo)}`);
  assert.equal(tope.ultima.status, baja.ultima.status);
});
