// tests/scrum477-avisos-con-constancia.test.mjs — SCRUM-477
//
// QUE UN AVISO QUE NO SALE DEJE RASTRO.
//
// ── LA VÍCTIMA ────────────────────────────────────────────────────────────────────────────
// Al profesional le pagan, o le aceptan un presupuesto, y le mandamos un correo. Si ese correo no
// sale, él cree que no le avisamos por dejadez y nosotros creemos que se lo dijimos. Nadie se
// entera hasta que llama a preguntar.
//
// ── 🔴 LO QUE ESTA SESIÓN MIDIÓ, Y CORRIGE A LA ANTERIOR ─────────────────────────────────
// SCRUM-475 marcó cuatro llamadores como MUDOS por su `.catch(() => {})`. Al leerlos para
// arreglarlos apareció que el emisor **sí escribía** una línea (`console.error`). Así que «mudo»
// era demasiado fuerte — pero el rastro **no decía para quién era** («Error enviando email pago:
// no se pudo enviar el email (fallo_envio)») y **no cubría el otro canal**: cuando `sendEmail`
// DEVOLVÍA el fallo sin lanzar, el `.catch` no se disparaba y no quedaba nada.
//
// ── 🔴 EL CRITERIO QUE FALTABA ───────────────────────────────────────────────────────────
// El censo de SCRUM-475 clasificaba por «¿qué pasa si esto LANZA?». Un fallo puede caerse por DOS
// canales, y por el segundo no miraba nadie:
//   · **lanza**    → viaja como EXCEPCIÓN. Se pierde si un `catch` se la come.
//   · **devuelve** → viaja como VALOR. Se pierde si nadie mira lo que devolvió.
// Con el criterio completo, los sitios que pierden el fallo pasaron de 4 a **12**. El trinquete
// SUBE: cuatro se arreglan aquí y los otros ocho quedan NOMBRADOS.
import test from 'node:test';
import assert from 'node:assert/strict';

import { censarLlamadores, nombresDeEmisor, canalDeFallo } from './_censo-correo.mjs';
import {
  AVISOS, registroDeAviso, conConstancia,
} from '../dist/modules/messaging/domain/avisoConstancia.js';

const EMISORES = nombresDeEmisor();
const LLAMADORES = censarLlamadores(EMISORES);

/** Los tres emisores del ticket: los avisos que le dicen AL PROFESIONAL que algo bueno pasó. */
const EMISORES_DE_AVISO = [
  'sendMerchantPaymentEmail',
  'sendMerchantQuoteAcceptedEmail',
  'sendTechQuoteApprovedEmail',
];

/** Captura lo que se escribe en `console.error` mientras corre `fn`. */
async function capturandoLog(fn) {
  const original = console.error;
  const lineas = [];
  console.error = (...args) => lineas.push(args.join(' '));
  try { await fn(); } finally { console.error = original; }
  return lineas;
}

// ── 0 · SUELO · el censo tiene que VER los avisos antes de opinar sobre ellos ─────────────

test('SCRUM-477 · 🔴 SUELO: el censo VE los cuatro avisos, o no puede afirmar nada de ellos', () => {
  const deAviso = LLAMADORES.filter((l) => EMISORES_DE_AVISO.includes(l.emisor));
  assert.equal(deAviso.length, 4,
    `🔴 EL CENSO ESTÁ CIEGO: encuentra ${deAviso.length} llamadas a los avisos del profesional y `
    + 'son CUATRO (psp, quotes, quotesAdmin, whatsappIncoming).\n\n'
    + '  Con menos, «ninguno se traga el fallo» significa «no supe mirar», que es el mismo verde\n'
    + '  con el significado contrario. Ya pasó una vez: al unificar el emisor, este censo pasó de\n'
    + '  4 mudos a 0 sin que nadie arreglara nada.');

  // Y que sepa clasificar el canal: si todo saliera del mismo cubo, el criterio nuevo no existiría.
  const canales = canalDeFallo();
  assert.ok(canales.size >= 17, `🔴 solo se ha clasificado el canal de ${canales.size} emisores`);
  assert.equal(canales.get('enviarCorreo'), 'devuelve',
    '🔴 `enviarCorreo` no sale como `devuelve` y es el caso que motivó el criterio: captura dentro '
    + 'y devuelve `{ enviado:false }`, así que preguntar «¿hay catch?» por él no significa nada.');
  assert.equal(canales.get('sendMerchantPaymentEmail'), 'lanza',
    '🔴 `sendMerchantPaymentEmail` no sale como `lanza`. Lo hace a través de su `sendEmail` local '
    + '—`throw` propio, propagado— y el guard de SCRUM-475 EXIGE que siga lanzando.');
});

// ── 1 · 🔴 EL TEST QUE DECIDE ────────────────────────────────────────────────────────────

test('SCRUM-477 · 🔴 un «te han pagado» que FALLA deja rastro, y el rastro dice PARA QUIÉN', async () => {
  const lineas = await capturandoLog(() => new Promise((listo) => {
    conConstancia('pago_recibido', 'juan@fontaneria.example', Promise.resolve({
      enviado: false,
      motivo: 'fallo_envio',
      constancia: { estado: 'fallo_envio', idProveedor: null, motivo: 'ENOTFOUND: api.resend.com' },
    }));
    setTimeout(listo, 0);
  }));

  assert.equal(lineas.length, 1,
    '🔴 UN AVISO DE «TE HAN PAGADO» SE HA PERDIDO SIN DEJAR NADA.\n\n'
    + '  Al profesional le han pagado, no se lo hemos dicho, y no queda constancia de que no se lo\n'
    + '  dijimos. Él cree que pasamos de él; nosotros creemos que le avisamos.');

  const registro = JSON.parse(lineas[0].replace('[aviso] ', ''));
  assert.equal(registro.evento, 'aviso_no_entregado');
  assert.equal(registro.aviso, 'pago_recibido',
    '🔴 el rastro no dice QUÉ aviso se perdió: sin eso no se sabe si el profesional se quedó sin '
    + 'saber que le pagaron o sin saber que le aceptaron un presupuesto.');
  assert.equal(registro.motivo, 'ENOTFOUND: api.resend.com',
    '🔴 se ha perdido el motivo, que es todo lo que se sabe de este envío.');

  // 🔴 Y DICE PARA QUIÉN — que es lo que le faltaba al `console.error` de antes— sin poner el
  // correo en el log: un correo es dato personal y los logs los lee cualquiera con acceso al panel.
  //
  // `maskEmail` no tapa con asteriscos: sustituye la parte local por un HASH ESTABLE y conserva el
  // dominio (`01d4533f@fontaneria.example`). Esa estabilidad es justo lo que hace útil el rastro —
  // se puede cruzar con el correo de un merchant hasheándolo— sin exponer a nadie.
  assert.ok(!registro.destinatario.includes('juan'),
    `🔴 la parte local del correo está en el log sin enmascarar: «${registro.destinatario}»`);
  assert.match(registro.destinatario, /fontaneria\.example$/,
    '🔴 el enmascarado se ha comido también el dominio: entonces el rastro no permite ni acercarse '
    + 'a QUIÉN se quedó sin aviso, que es el defecto exacto del `console.error` anterior. '
    + 'Enmascarar no es borrar.');

  const otra = await capturandoLog(() => new Promise((listo) => {
    conConstancia('pago_recibido', 'juan@fontaneria.example', Promise.resolve({
      enviado: false, motivo: 'fallo_envio',
      constancia: { estado: 'fallo_envio', idProveedor: null, motivo: 'otro intento' },
    }));
    setTimeout(listo, 0);
  }));
  assert.equal(JSON.parse(otra[0].replace('[aviso] ', '')).destinatario, registro.destinatario,
    '🔴 el enmascarado NO es estable: el mismo profesional sale con dos identificadores distintos, '
    + 'así que dos avisos perdidos del mismo destinatario no se pueden juntar. Un rastro que no se '
    + 'puede cruzar no sirve para saber a quién hay que llamar.');
});

test('SCRUM-477 · 🔴 el otro canal: un fallo DEVUELTO sin excepción también deja rastro', async () => {
  // ÉSTE ES EL QUE SE PERDÍA ENTERO. `sendEmail` devuelve —sin lanzar— cuando no hay destinatario
  // válido: no había excepción, el `.catch` no se disparaba, y el valor se tiraba.
  const lineas = await capturandoLog(() => new Promise((listo) => {
    conConstancia('presupuesto_aceptado', 'sin-arroba', Promise.resolve({
      enviado: false,
      motivo: 'sin_destino',
      constancia: { estado: 'fallo_envio', idProveedor: null, motivo: 'sin_destino: destinatario vacío' },
    }));
    setTimeout(listo, 0);
  }));
  assert.equal(lineas.length, 1,
    '🔴 un aviso que NO SALE porque el profesional no tiene correo válido no deja rastro. No hubo '
    + 'excepción —se devolvió el fallo—, así que el `catch` no lo vio: es el canal entero que el '
    + 'censo de SCRUM-475 no miraba.');
  assert.match(lineas[0], /sin_destino/);
});

test('SCRUM-477 · y cuando la promesa RECHAZA, también', async () => {
  const lineas = await capturandoLog(() => new Promise((listo) => {
    conConstancia('presupuesto_aprobado_tecnico', 'tec@empresa.example',
      Promise.reject(new Error('no se pudo enviar el email (fallo_envio)')));
    setTimeout(listo, 0);
  }));
  assert.equal(lineas.length, 1, '🔴 una excepción del emisor no deja rastro');
  assert.match(lineas[0], /aviso_no_entregado/);
});

// ── 2 · CONTROL POSITIVO · el caso feliz no paga peaje ───────────────────────────────────

test('SCRUM-477 · CONTROL POSITIVO: un aviso que SÍ sale no escribe nada', async () => {
  // Un mecanismo que registra también los aciertos llena el log de ruido y acaba desactivado —y
  // con él se va el registro de los fallos, que es lo que importa.
  const lineas = await capturandoLog(() => new Promise((listo) => {
    conConstancia('pago_recibido', 'juan@fontaneria.example', Promise.resolve({
      enviado: true, via: 'resend',
      acuse: { id: 'm-1', crudo: {} },
      constancia: { estado: 'aceptado_sin_confirmacion', idProveedor: 'm-1', motivo: null },
    }));
    setTimeout(listo, 0);
  }));
  assert.deepEqual(lineas, [],
    `🔴 un aviso que salió bien está escribiendo en el log: ${lineas.join(' | ')}`);

  // Y el núcleo puro lo dice igual, sin depender de capturar la consola.
  assert.equal(registroDeAviso('pago_recibido', 'x@y.example', {
    enviado: true, constancia: { estado: 'aceptado_sin_confirmacion', idProveedor: 'm-1', motivo: null },
  }), null, '🔴 `registroDeAviso` fabrica registro de un envío que salió bien.');
});

// ── 3 · 🔴 CONTROL NEGATIVO · un aviso roto NO puede tumbar la operación ─────────────────

test('SCRUM-477 · 🔴 CONTROL NEGATIVO: un aviso que revienta NO tumba el cobro ni la aceptación', async () => {
  // El `catch` de las rutas NUNCA sobró: sobraba que estuviera VACÍO. El cobro ya está registrado
  // y el presupuesto ya está aceptado cuando esto corre; que el correo falle no puede deshacerlo
  // ni devolver un error al PSP —que reintentaría el webhook—.
  let siguio = false;
  await capturandoLog(async () => {
    // `conConstancia` devuelve `void`: no hay promesa que se pueda quedar sin manejar ni que
    // pueda rechazar hacia el llamador.
    const devuelto = conConstancia('pago_recibido', 'a@b.example',
      Promise.reject(new Error('el proveedor está caído')));
    assert.equal(devuelto, undefined,
      '🔴 `conConstancia` devuelve algo esperable. Si devolviera una promesa, alguien acabaría '
      + 'poniéndole `await` y un correo caído tumbaría la confirmación del pago.');
    siguio = true;                      // ← la ruta sigue su curso
    await new Promise((r) => setTimeout(r, 0));
  });
  assert.ok(siguio, '🔴 la operación se ha interrumpido por un aviso que no salió');
});

// ── 4 · 🔴 EL GUARD · ninguno de los cuatro se traga el fallo ────────────────────────────

test('SCRUM-477 · 🔴 ningún aviso al profesional pierde su fallo, y el rojo NOMBRA la ruta', () => {
  const perdidos = LLAMADORES
    .filter((l) => EMISORES_DE_AVISO.includes(l.emisor))
    .filter((l) => l.veredicto === 'ignora-resultado' || l.veredicto === 'traga-mudo');

  const detalle = perdidos.map((p) => `${p.fichero}:${p.linea}  ${p.emisor}  [${p.veredicto}]`).join('\n    ');
  assert.deepEqual(perdidos, [],
    '🔴 HAY AVISOS AL PROFESIONAL QUE PIERDEN SU FALLO:\n    ' + detalle + '\n\n'
    + '  Alguien ha vuelto a poner un `.catch(() => {})` —o ha dejado de mirar lo que devuelve el\n'
    + '  envío— sobre un correo que le dice al profesional que le han pagado o que le han aceptado\n'
    + '  un presupuesto. Si falla, él no se entera y nosotros tampoco.\n\n'
    + '  Pásalo por `conConstancia(<aviso>, <destinatario>, <envío>)`: anota los DOS canales y no\n'
    + '  puede tumbar la operación (no se espera y no devuelve promesa).');
});

test('SCRUM-477 · el conjunto de avisos es CERRADO', () => {
  assert.deepEqual([...AVISOS].sort(),
    ['pago_recibido', 'presupuesto_aceptado', 'presupuesto_aprobado_tecnico'].sort(),
    '🔴 ha cambiado el conjunto de avisos. Uno nuevo se nombra aquí para que pase por el mismo '
    + 'registro; si no, nace con el defecto que este ticket cierra.');
});

// ── 5 · EL TRINQUETE de lo que SIGUE perdiendo el fallo — nombrado, no escondido ─────────

test('SCRUM-477 · 🔴 TRINQUETE: ocho sitios más pierden el fallo, y van NOMBRADOS', () => {
  // ⚠️ ESTE NÚMERO SUBIÓ DE 4 A 12 AL COMPLETAR EL CRITERIO, Y NADIE EMPEORÓ NADA: el censo
  // anterior solo miraba el canal de la excepción. Cuatro se arreglan en este ticket; estos ocho
  // quedan escritos con su nombre.
  //
  // NO SE ARREGLAN AQUÍ (regla 37): son de otros carriles —el arranque de los crons y el enlace
  // mágico de acceso—, no bloquean este ticket, y el del enlace mágico además toca la respuesta
  // que ve un usuario sin sesión, que es decisión de producto (regla 30).
  const perdidos = LLAMADORES.filter((l) => l.veredicto === 'ignora-resultado' || l.veredicto === 'traga-mudo');
  const detalle = perdidos.map((p) => `${p.fichero}:${p.linea}  ${p.emisor}`).join('\n    ');

  assert.equal(perdidos.length, 8,
    `🔴 el censo da ${perdidos.length} sitios que pierden el fallo y eran 8:\n    ${detalle}\n\n`
    + '  Si SUBE, alguien ha escrito un envío nuevo cuyo fallo no mira nadie: nómbralo y pásalo\n'
    + '  por `conConstancia`. Si BAJA, comprueba PRIMERO que no sea el censo el que dejó de ver —\n'
    + '  pasó exactamente eso al unificar el emisor (SCRUM-475), y el número cayó a cero solo.');

  assert.deepEqual(perdidos.map((p) => p.emisor).sort(), [
    'requestMagicLink',      // auth.routes: el enlace de acceso
    'requestMagicLink',      // auth.service ×2
    'requestMagicLink',
    'runLifecycleEmails',    // cron: arranque
    'sendFirstPaymentEmail', // stripe.routes
    'sendWeeklyDigests',     // cron: arranque
    'sendWelcomeEmail',      // auth.service
    'startCronJobs',         // index: arranque
  ].sort(), `🔴 han cambiado CUÁLES pierden el fallo:\n    ${detalle}\n\n`
    + '  El recuento solo no lo vería. Vuelve a medir cuál entró, cuál salió y por qué.');
});
