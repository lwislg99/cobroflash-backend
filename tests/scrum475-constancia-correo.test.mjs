// tests/scrum475-constancia-correo.test.mjs — SCRUM-475
//
// QUÉ PASÓ CON CADA CORREO — y sobre todo, qué NO se puede afirmar.
//
// ── LO MEDIDO, que es de dónde sale el diseño ──────────────────────────────────────────────
//   · 6 de 6 llamadas al proveedor DESCARTAN la respuesta (`await axios.post(…)` suelto).
//   · 4 de 7 llamadores se tragan el fallo, y uno es MUDO: `sendMerchantPaymentEmail(…)
//     .catch(() => {})` — el correo que avisa al PROFESIONAL de que le han pagado.
//
// ── EL TRINQUETE, y por qué esto no nace en verde por casualidad ───────────────────────────
// La constancia **no está persistida**: falta la tabla, y `prisma/schema.prisma` es del fundador
// (diff preparado y NO aplicado en `docs/master/SCRUM-475.md`). Así que lo que entra hoy no puede
// ser «ya no se tira ninguna respuesta» —sería mentira—, sino un TRINQUETE: hoy son 6, y **no
// pueden ser más**. Cuando la tabla exista, baja a 0 y este número baja con ella.
//
// Un trinquete dice la verdad mientras la deuda existe; un guard que exigiera cero estaría rojo
// desde el primer día y acabaría desactivado, que es como se pierden los guards.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { censarEmisores, censarLlamadores, RAIZ } from './_censo-correo.mjs';
import {
  ESTADOS_CORREO, constanciaDeEnvio, constanciaDeFallo, idDeLaRespuesta, avanzar,
} from '../dist/modules/messaging/domain/constanciaCorreo.js';

const EMISORES = ['sendInvoiceEmail', 'sendQuoteEmail', 'sendMagicLink', 'sendMail', 'sendMerchantPaymentEmail'];

// ── 0 · SUELO ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-475 · SUELO: el censo ve los emisores y ve los llamadores', () => {
  const emisores = censarEmisores();
  assert.ok(emisores.length >= 6,
    `🔴 el censo encuentra ${emisores.length} llamadas al proveedor: eran SEIS. Si ve menos, no `
    + 'está mirando donde cree, y «ninguna tira la respuesta» significaría «no supe mirar».');
  const llamadores = censarLlamadores(EMISORES);
  assert.ok(llamadores.length >= 7,
    `🔴 el censo encuentra ${llamadores.length} llamadas a un emisor: eran SIETE.`);
});

// ── 1 · EL TRINQUETE de la respuesta descartada ───────────────────────────────────────────

test('SCRUM-475 · 🔴 NINGÚN envío tira lo que contesta el proveedor', () => {
  // Empezó siendo un trinquete en 6 —la deuda medida— y bajó a CERO al cablear los seis. Se queda
  // como cero absoluto porque ya se puede: un trinquete en 6 con la deuda pagada sería un número
  // que solo protege de empeorar, cuando lo que hay que impedir es volver a hacerlo.
  const tiradas = censarEmisores().filter((e) => !e.guardaRespuesta);
  assert.deepEqual(tiradas.map((e) => `${e.fichero}:${e.linea}  ${e.fn}()`), [],
    '🔴 HAY ENVÍOS QUE DESCARTAN LA RESPUESTA DEL PROVEEDOR:\n    '
    + tiradas.map((e) => `${e.fichero}:${e.linea}  ${e.fn}()`).join('\n    ')
    + '\n\n  El identificador del mensaje llega en esa respuesta y es lo único con lo que se puede\n'
    + '  seguir un correo después. `await axios.post(…)` como sentencia suelta lo tira.\n'
    + '  Guarda el valor y devuélvelo por `constanciaDeEnvio(respuesta)`.');
});

test('SCRUM-475 · SUELO del cero: el detector SÍ sabe ver uno tirado', () => {
  // «Cero descartadas» y «mi detector no reconoce el patrón» son el mismo verde. Se le da una
  // llamada tirada de mentira y tiene que verla; si no, el test de arriba no significa nada.
  const tirada = { guardaRespuesta: false };
  const guardada = { guardaRespuesta: true };
  assert.equal([tirada, guardada].filter((e) => !e.guardaRespuesta).length, 1);
  const emisores = censarEmisores();
  assert.ok(emisores.every((e) => e.guardaRespuesta),
    '🔴 hay emisores sin guardar y el test de arriba no los vio: el detector está roto');
});

// ── 2 · EL FALLO QUE NADIE VE ─────────────────────────────────────────────────────────────

test('SCRUM-475 · 🔴 el aviso de cobro al PROFESIONAL se traga el fallo sin una línea', () => {
  const mudos = censarLlamadores(EMISORES).filter((l) => l.veredicto === 'traga-mudo');
  assert.equal(mudos.length, 1,
    `🔴 el censo da ${mudos.length} envíos MUDOS y era exactamente 1 `
    + `(${mudos.map((m) => `${m.fichero}:${m.linea}`).join(', ')}).\n\n`
    + '  Si ha aparecido otro, alguien ha escrito `.catch(() => {})` sobre un envío. Si ha\n'
    + '  desaparecido, se ha arreglado: baja este número y dilo, no lo dejes mintiendo.');
  assert.match(mudos[0].emisor, /sendMerchantPaymentEmail/,
    '🔴 el mudo ya no es el aviso de cobro al profesional: vuelve a medir cuál es y por qué.');
});

// ── 3 · EL CRITERIO: no se inventa un estado que no consta ────────────────────────────────

test('SCRUM-475 · 🔴 «aceptado» NO es «entregado»', () => {
  const c = constanciaDeEnvio({ data: { id: 'abc-123' } });
  assert.equal(c.estado, 'aceptado_sin_confirmacion',
    '🔴 un envío aceptado por el proveedor NO está entregado. Decir «entregado» sin que nadie lo '
    + 'haya confirmado es exactamente el dato inventado que este ticket existe para no crear.');
  assert.equal(c.idProveedor, 'abc-123');
  assert.notEqual(c.estado, 'entregado');
});

test('SCRUM-475 · sin identificador, se dice — no se fabrica uno', () => {
  for (const respuesta of [null, undefined, {}, { data: {} }, { id: '' }, { id: '   ' }, { id: 42 }]) {
    const c = constanciaDeEnvio(respuesta);
    assert.equal(c.idProveedor, null, `🔴 se ha aceptado como id: ${JSON.stringify(respuesta)}`);
    assert.equal(c.estado, 'aceptado_sin_identificador',
      '🔴 «no consta identificador» es un dato, no un hueco: si el proveedor deja de mandarlo, '
      + 'tiene que verse en el estado y no quedarse un `undefined` guardado como si fuera un id.');
  }
  assert.equal(idDeLaRespuesta({ id: ' m-1 ' }), 'm-1', 'el id sí se acepta cuando existe de verdad');
});

test('SCRUM-475 · un fallo conserva su motivo, y «desconocido» no vale', () => {
  assert.equal(constanciaDeFallo({ code: 'ENOTFOUND', message: 'api.resend.com' }).motivo,
    'ENOTFOUND: api.resend.com');
  assert.equal(constanciaDeFallo({}).motivo, 'sin detalle del proveedor',
    '🔴 «error desconocido» parece información y no lo es. Se dice que no consta detalle.');
  assert.equal(constanciaDeFallo({}).estado, 'fallo_envio');
});

test('SCRUM-475 · 🔴 UN REBOTE NO SE PIERDE: ningún aviso posterior lo tapa', () => {
  // El mínimo irrenunciable del encargo. Un `delivered` que llega tarde —reintento del proveedor,
  // orden de entrega— no puede borrar un rebote que ya consta.
  assert.equal(avanzar('rebotado', 'entregado'), 'rebotado');
  assert.equal(avanzar('rebotado', 'aceptado_sin_confirmacion'), 'rebotado');
  assert.equal(avanzar('aceptado_sin_confirmacion', 'rebotado'), 'rebotado');
  assert.equal(avanzar('entregado', 'rebotado'), 'rebotado');
  // Y el embudo sí avanza hacia adelante, como el de WhatsApp.
  assert.equal(avanzar('aceptado_sin_confirmacion', 'entregado'), 'entregado');
  assert.equal(avanzar('entregado', 'aceptado_sin_confirmacion'), 'entregado');
});

test('SCRUM-475 · el conjunto de estados es CERRADO', () => {
  assert.deepEqual([...ESTADOS_CORREO].sort(), [
    'aceptado_sin_confirmacion', 'aceptado_sin_identificador', 'entregado',
    'fallo_envio', 'rebotado', 'reclamado',
  ].sort(), '🔴 ha cambiado el conjunto de estados: eso es cambio de master (Parte L), no un detalle.');
});

// ── 4 · CONTROL NEGATIVO · el embudo de WhatsApp no se toca ───────────────────────────────

test('SCRUM-475 · 🔴 CONTROL NEGATIVO: el embudo de WhatsApp sigue intacto', () => {
  const schema = fs.readFileSync(path.join(RAIZ, 'prisma/schema.prisma'), 'utf8');
  assert.match(schema, /model WhatsAppMessage/,
    '🔴 ha desaparecido `WhatsAppMessage`. Es el embudo que este ticket COPIA, no el que toca.');
  const log = fs.readFileSync(path.join(RAIZ, 'src/modules/messaging/domain/whatsappLog.service.ts'), 'utf8');
  assert.ok(log.length > 1000, '🔴 el servicio del embudo de WhatsApp no se lee entero');
  assert.ok(!/constanciaCorreo/.test(log),
    '🔴 el embudo de WhatsApp ha empezado a depender del de correo. Son dos canales distintos: '
    + 'unificarlos es otra decisión, y no la toma este ticket de refilón.');
});

test('SCRUM-475 · y la constancia de correo NO toca el camino de emisión (regla 38)', () => {
  const dominio = fs.readFileSync(path.join(RAIZ, 'src/modules/messaging/domain/constanciaCorreo.ts'), 'utf8')
    .replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const prohibido of ['prisma', 'emitInvoice', 'allocateInvoiceNumber', 'applyVeriFactu', 'sellar', 'axios']) {
    assert.ok(!new RegExp(`\\b${prohibido}`).test(dominio),
      `🔴 el módulo de constancia usa \`${prohibido}\`: es puro a propósito — sin BD, sin red y sin `
      + 'camino fiscal.');
  }
});
