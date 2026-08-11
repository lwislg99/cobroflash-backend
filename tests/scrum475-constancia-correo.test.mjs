// tests/scrum475-constancia-correo.test.mjs — SCRUM-475
//
// QUÉ PASÓ CON CADA CORREO — y sobre todo, qué NO se puede afirmar.
//
// ── LO MEDIDO, que es de dónde sale el diseño ──────────────────────────────────────────────
// Sesión 1, contra `main` = fd2f0e4a:
//   · 6 de 6 llamadas al proveedor DESCARTABAN la respuesta (`await axios.post(…)` suelto).
//   · 4 de 7 llamadores se tragan el fallo, y uno es MUDO: `sendMerchantPaymentEmail(…)
//     .catch(() => {})` — el correo que avisa al PROFESIONAL de que le han pagado.
// Sesión 2, contra `main` = cffde532 (2026-08-11), rehecho entero:
//   · **7** emisores, no 6: SCRUM-406 añadió `src/integrations/enviarCorreo.ts`, que entró en
//     `main` tirando la respuesta. Lo cazó ESTE guard al traer `main`, sin revisión a mano.
//   · **4 de 8** llamadores se tragan el fallo: el octavo (`soporteAdmin.routes.ts`, SCRUM-406)
//     es de los que SÍ avisan, así que la proporción no cambia de signo.
//   · El MUDO sigue siendo exactamente uno, y sigue siendo el mismo.
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

import { censarEmisores, censarLlamadores, nombresDeEmisor, RAIZ } from './_censo-correo.mjs';
import {
  ESTADOS_CORREO, constanciaDeEnvio, constanciaDeFallo, idDeLaRespuesta, avanzar,
} from '../dist/modules/messaging/domain/constanciaCorreo.js';

// 🔴 SESIÓN 2 · ESTO ERA UNA LISTA ESCRITA A MANO, y por eso el censo B se quedó corto.
// Era: ['sendInvoiceEmail','sendQuoteEmail','sendMagicLink','sendMail','sendMerchantPaymentEmail'].
// Con ella, el censo veía 7 llamadores y UN mudo. Derivada del árbol ve 21 y CUATRO. Los otros
// tres no son nuevos ni los rompió nadie: llevaban ahí todo el tiempo, fuera del foco de la lista.
const EMISORES = nombresDeEmisor();

// ── 0 · SUELO ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-475 · SUELO: el censo ve los emisores y ve los llamadores', () => {
  // ⚠️ SESIÓN 2 · EL SUELO SUBE DE 6 A 7, Y NO ES UN AJUSTE COSMÉTICO.
  //
  // La sesión 1 midió SEIS emisores contra `main` = `fd2f0e4a`. Entre aquella medición y ésta,
  // SCRUM-406 («Escríbenos») entró en `main` con un SÉPTIMO: `src/integrations/enviarCorreo.ts`.
  // El absoluto de aquella medición caducó; su delta no.
  //
  // Un suelo que se queda en 6 cuando hay 7 deja de apretar: toleraría que uno DESAPARECIERA sin
  // que nadie se entere, y ése es justo el agujero por el que se cuela un emisor sin cablear.
  // Sube con lo medido, y por eso lleva la fecha: para que la próxima sesión sepa contra qué
  // comparar en vez de creerse un número sin origen.
  const emisores = censarEmisores();
  assert.ok(emisores.length >= 7,
    `🔴 el censo encuentra ${emisores.length} llamadas al proveedor: eran SIETE (medido el `
    + '2026-08-11 contra `main` = cffde532). Si ve menos, no está mirando donde cree, y '
    + '«ninguna tira la respuesta» significaría «no supe mirar».');

  // El suelo de la lista derivada: si `nombresDeEmisor()` devolviera poco, el censo B parecería
  // limpio por no mirar. Trece exportadas alcanzan al proveedor, medido el 2026-08-11.
  assert.ok(EMISORES.length >= 13,
    `🔴 la lista DERIVADA de emisores trae ${EMISORES.length} nombres: eran TRECE. Con menos, el `
    + 'censo de llamadores mira a menos sitios y su silencio no vale nada.');
  assert.ok(EMISORES.includes('enviarCorreo'),
    '🔴 `enviarCorreo` (SCRUM-406) no sale de la derivación: es justo el que la lista a mano no '
    + 'veía, y comprobarlo es lo que impide volver a la lista a mano sin enterarse.');

  const llamadores = censarLlamadores(EMISORES);
  assert.ok(llamadores.length >= 21,
    `🔴 el censo encuentra ${llamadores.length} llamadas a un emisor: eran VEINTIUNA. Con la lista `
    + 'escrita a mano de la sesión 1 salían SIETE — el mismo árbol, tres veces menos superficie.');
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

test('SCRUM-475 · 🔴 CUATRO avisos al PROFESIONAL se tragan el fallo sin una línea', () => {
  // ⚠️ SESIÓN 2 · ESTE NÚMERO SUBE DE 1 A 4, Y NADIE HA EMPEORADO NADA.
  //
  // La sesión 1 midió UN mudo. Con la lista de emisores derivada del árbol salen CUATRO: los
  // otros tres llevaban ahí desde siempre, invisibles porque sus emisores no estaban en la lista
  // escrita a mano. **Subir un trinquete porque el instrumento ahora ve más no es relajarlo.**
  // Lo que sería relajarlo es dejarlo en 1 sabiendo que son 4.
  //
  // 🔴 Y LOS CUATRO SON LA MISMA COSA: el correo que le dice AL PROFESIONAL que algo bueno pasó
  // —le han pagado, le han aceptado el presupuesto, se lo han aprobado—. Se mandan
  // fire-and-forget y, si fallan, no queda ni una línea. El profesional cree que le avisamos.
  //
  // NO SE ARREGLAN AQUÍ (regla 37: no es mi zona, no me bloquea, y son cuatro rutas ajenas; y
  // regla 30: si hay que decirle algo al profesional, el texto lo aprueba el asesor). Van con la
  // tabla, que es donde el fallo tendrá dónde constar. Queda escrito en docs/master/SCRUM-475.md.
  const mudos = censarLlamadores(EMISORES).filter((l) => l.veredicto === 'traga-mudo');
  assert.equal(mudos.length, 4,
    `🔴 el censo da ${mudos.length} envíos MUDOS y eran exactamente 4:\n    `
    + `${mudos.map((m) => `${m.fichero}:${m.linea}  ${m.emisor}`).join('\n    ')}\n\n`
    + '  Si ha aparecido otro, alguien ha escrito `.catch(() => {})` sobre un envío. Si ha\n'
    + '  desaparecido, se ha arreglado: baja este número y dilo, no lo dejes mintiendo.');

  // Los cuatro, por nombre. Si cambia CUÁL es mudo sin cambiar cuántos, el número solo no lo vería.
  assert.deepEqual(mudos.map((m) => m.emisor).sort(), [
    'sendMerchantPaymentEmail',       // psp: le han pagado
    'sendMerchantQuoteAcceptedEmail', // quotes: le han aceptado el presupuesto
    'sendMerchantQuoteAcceptedEmail', // whatsappIncoming: idem, aceptado por WhatsApp
    'sendTechQuoteApprovedEmail',     // quotesAdmin: al técnico, su presupuesto aprobado
  ].sort(), '🔴 han cambiado CUÁLES son los mudos. El recuento solo no lo habría visto: vuelve a '
    + 'medir cuál entró, cuál salió y por qué.');
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

// ── 5 · EL SÉPTIMO EMISOR (sesión 2) · control positivo del contrato ajeno ────────────────

test('SCRUM-475 · CONTROL POSITIVO: el contrato de SCRUM-406 sigue intacto y ahora deja constancia', async () => {
  // ⚠️ Se ejerce SOLO el camino del destinatario vacío, que retorna ANTES de mirar `config` y
  // ANTES de tocar la red. Ejercer los otros exigiría una clave de proveedor, y un test que
  // pueda mandar un correo de verdad no se escribe.
  const { enviarCorreo } = await import('../dist/integrations/enviarCorreo.js');
  const r = await enviarCorreo({ to: '   ', subject: 'x', html: 'x' });

  // Lo que YA prometía SCRUM-406 y no se puede romper: la pantalla de soporte lee estos campos.
  assert.equal(r.enviado, false, '🔴 se ha roto el contrato de SCRUM-406: `enviado` es la única verdad sobre si salió');
  assert.equal(r.motivo, 'sin_destino', '🔴 el motivo de SCRUM-406 ha cambiado de forma: su pantalla lo lee');

  // Y lo que añade SCRUM-475: de este correo CONSTA que no salió, y por qué.
  assert.equal(r.constancia.estado, 'fallo_envio',
    '🔴 el séptimo emisor no deja constancia. Es el que cazó el censo al traer `main`: si vuelve '
    + 'a quedarse sin ella, el rebote de un correo de soporte no tendrá dónde apuntarse.');
  assert.equal(r.constancia.idProveedor, null);
  assert.match(r.constancia.motivo, /destinatario/,
    '🔴 el motivo se ha perdido por el camino: es todo lo que se sabe de este envío.');
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
