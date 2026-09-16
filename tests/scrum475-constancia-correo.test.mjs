// tests/scrum475-constancia-correo.test.mjs — SCRUM-475 (fase 2)
//
// QUÉ PASÓ CON CADA CORREO — y sobre todo, qué NO se puede afirmar.
//
// ── QUÉ VIGILA ESTE FICHERO Y QUÉ NO ──────────────────────────────────────────────────────
// La fase 1 (`scrum475-un-solo-emisor.test.mjs`, ya en `main`) vigila que haya UN emisor y que el
// acuse no se tire. Eso NO se repite aquí: son suyos y siguen verdes.
//
// Éste vigila las dos cosas que aquella no podía:
//   · el VOCABULARIO — «aceptado» no es «entregado», y un rebote no se tapa;
//   · el CENSO de quién se traga un fallo sin decírselo a nadie.
//
// ── 🔴 LO QUE ESTA SESIÓN MIDIÓ Y CASI SE CUELA COMO VERDE ────────────────────────────────
// Al traer `main` con el emisor único, el censo de mudos pasó de **4 a 0**. Nadie los arregló:
// `nombresDeEmisor()` propagaba SOLO dentro de un fichero, y al mover el POST a `enviarCorreo.ts`
// los emisores dejaron de parecerlo. Los cuatro `.catch(() => {})` siguen exactamente donde
// estaban. **Un refactor correcto cegó el guard sin tocarlo, y el guard lo contó como cero.**
//
// Por eso aquí el detector se prueba ANTES de creerse ningún número, y hay un test dedicado a que
// la propagación CRUCE FICHEROS. Sin él, esto vuelve a mentir la próxima vez que alguien mueva
// una llamada de sitio — que es una cosa que pasa constantemente y sin mala intención.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  censarEmisores, censarEmisoresDeTexto, censarLlamadores, nombresDeEmisor, RAIZ,
} from './_censo-correo.mjs';
import {
  ESTADOS_CORREO, constanciaDeEnvio, constanciaDeFallo, idDeLaRespuesta, avanzar,
} from '../dist/modules/messaging/domain/constanciaCorreo.js';

const EMISORES = nombresDeEmisor();

// ── 0 · EL SUELO DEL DETECTOR — va PRIMERO, y no es ceremonia ─────────────────────────────

test('SCRUM-475 f2 · 🔴 AUTOPRUEBA: el detector SÍ ve una respuesta tirada, y SÍ ve una guardada', () => {
  // «Cero descartadas» y «no supe mirar» son el mismo verde. Antes de creerse el cero de abajo, el
  // analizador tiene que demostrar que distingue las dos formas sobre un fuente de mentira.
  const tirada = censarEmisoresDeTexto(`
    async function malo() { await axios.post('https://api.resend.com/emails', {}); }
  `);
  assert.equal(tirada.length, 1, '🔴 el detector no ve ni la llamada: está ciego del todo');
  assert.equal(tirada[0].guardaRespuesta, false,
    '🔴 el detector NO reconoce una respuesta tirada (`await post(…)` como sentencia suelta). '
    + 'Con esto roto, el test del cero de más abajo daría verde sobre el defecto que persigue.');

  const guardada = censarEmisoresDeTexto(`
    async function bueno() { const r = await axios.post('https://api.resend.com/emails', {}); return r; }
  `);
  assert.equal(guardada[0].guardaRespuesta, true,
    '🔴 el detector marca como tirada una respuesta que SÍ se guarda: entonces clasifica al azar.');
});

test('SCRUM-475 f2 · SUELO: el censo ve el emisor y ve a los llamadores', () => {
  // Medido el 2026-08-11 contra `main` = 687d262b (con el emisor único de la fase 1 dentro).
  const emisores = censarEmisores();
  assert.ok(emisores.length >= 1,
    `🔴 el censo encuentra ${emisores.length} llamadas al proveedor y tiene que haber al menos la `
    + 'del emisor único. Si ve cero, no está mirando donde cree.');

  assert.ok(EMISORES.length >= 17,
    `🔴 la lista DERIVADA de emisores trae ${EMISORES.length} nombres: eran DIECISIETE (medido el `
    + '2026-08-11 contra `main` = 687d262b). Con menos, el censo de llamadores mira a menos sitios '
    + 'y su silencio no vale nada — que es EXACTAMENTE como se perdieron los cuatro mudos.');

  const llamadores = censarLlamadores(EMISORES);
  assert.ok(llamadores.length >= 31,
    `🔴 el censo encuentra ${llamadores.length} llamadas a un emisor: eran TREINTA Y UNA. Con la `
    + 'propagación encerrada en un fichero salían 14 — el mismo árbol, menos de la mitad.');
});

test('SCRUM-475 f2 · 🔴 la derivación CRUZA FICHEROS, que es lo que se rompió al unificar el emisor', () => {
  // EL TEST DE LA LECCIÓN. `sendMerchantPaymentEmail` no llama al proveedor: llama a `enviarCorreo`,
  // que vive en otro módulo. Con propagación intra-fichero NO es emisor, su llamador no se censa, y
  // su `.catch(() => {})` desaparece del informe sin que nadie lo haya arreglado.
  assert.ok(EMISORES.includes('sendMerchantPaymentEmail'),
    '🔴 LA DERIVACIÓN HA VUELTO A ENCERRARSE EN UN FICHERO.\n\n'
    + '  `sendMerchantPaymentEmail` manda un correo a través de `enviarCorreo`, que está en otro\n'
    + '  módulo. Si no sale en la lista, el censo de llamadores deja de mirar sus rutas y los\n'
    + '  envíos que se tragan el fallo dejan de contarse. El número bajaría a cero y NADIE habría\n'
    + '  arreglado nada — pasó exactamente así al traer el emisor único.');

  // CONTROL POSITIVO del propio criterio: el fichero de ese emisor NO nombra al proveedor. Si lo
  // nombrara, el `includes` de arriba se cumpliría sin necesidad de cruzar nada y no probaría nada.
  const fuente = fs.readFileSync(path.join(RAIZ, 'src/modules/messaging/domain/merchantNotifications.ts'), 'utf8');
  assert.ok(!fuente.includes('api.resend.com'),
    '🔴 ese fichero ya nombra al proveedor por su cuenta, así que el test de arriba no demuestra '
    + 'que la propagación cruce ficheros: elige otro emisor que sí esté al otro lado de un import.');
});

// ── 1 · EL CENSO DE MUDOS ────────────────────────────────────────────────────────────────

test('SCRUM-475 f2 · 🔴 REGRESIÓN: ningún envío se traga el fallo sin una línea (los 4 se cerraron en SCRUM-477)', () => {
  // ⚠️ ESTE TEST EXIGÍA «exactamente 4 mudos» Y AHORA EXIGE CERO. No es relajarlo — es que los
  // cuatro se arreglaron (SCRUM-477): los avisos al profesional pasan por `conConstancia`, que
  // anota los DOS canales. Exigir cero es MÁS fuerte que exigir cuatro.
  //
  // Y el trinquete no ha desaparecido: se mudó y CRECIÓ. SCRUM-477 completó el criterio —un fallo
  // también viaja como VALOR devuelto, no solo como excepción— y con él los sitios que pierden el
  // fallo pasaron de 4 a 12. Los ocho que quedan van nombrados uno a uno en
  // `tests/scrum477-avisos-con-constancia.test.mjs`.
  const mudos = censarLlamadores(EMISORES).filter((l) => l.veredicto === 'traga-mudo');
  const detalle = mudos.map((m) => `${m.fichero}:${m.linea}  ${m.emisor}`).join('\n    ');

  assert.deepEqual(mudos, [],
    `🔴 HA VUELTO A APARECER UN ENVÍO MUDO:\n    ${detalle}\n\n`
    + '  Alguien ha escrito `.catch(() => {})` sobre un envío: el fallo no deja ni una línea.\n'
    + '  Pásalo por `conConstancia(<aviso>, <destinatario>, <envío>)` (SCRUM-477).');

  // 🔴 SUELO, y hace falta porque el cero de arriba lo cumpliría un censo ciego — que es
  // EXACTAMENTE lo que pasó al traer el emisor único: 4 mudos → 0 sin que nadie arreglara nada.
  const total = censarLlamadores(EMISORES).length;
  assert.ok(total >= 31,
    `🔴 el censo solo ve ${total} llamadas a un emisor y eran 31. El cero de arriba no significa `
    + '«ninguno se traga el fallo», significa «no supe mirar».');
});

/**
 * Los veredictos DECLARADOS. Lista cerrada y escrita a mano a propósito — ver abajo.
 * Derivados hoy de `_censo-correo.mjs`: `sube` · `avisa` · `traga-log` · `traga-mudo`
 * (clasificación por el HECHO, SCRUM-475) y `mira-resultado` · `ignora-resultado` (el fallo que
 * viaja como VALOR devuelto, SCRUM-477).
 */
const VEREDICTOS_DECLARADOS = ['sube', 'avisa', 'traga-log', 'traga-mudo', 'mira-resultado', 'ignora-resultado'];

test('SCRUM-478 · toda llamada cae en un cubo DECLARADO, y los cubos suman el total', () => {
  // Regla de la casa (12-ago-2026): **un censo cuyas categorías no suman su total no es un censo**.
  //
  // 🔴 Y CUIDADO CON CÓMO SE ESCRIBE. La primera versión de este test construía los cubos DESDE la
  // propia lista y sumaba: eso cuadra siempre, por tautología, y no puede ponerse rojo jamás. Un
  // guard que no puede fallar es peor que ninguno, porque ocupa su sitio.
  //
  // Lo que sí vigila: que todo veredicto esté en una lista CERRADA escrita aquí. El día que alguien
  // añada un séptimo a `censarLlamadores` y no lo declare, esto cae — y ese día es cuando el
  // informe empezaría a cuadrar a ojo mientras las llamadas del veredicto nuevo no las mira nadie.
  const llamadas = censarLlamadores(EMISORES);
  assert.ok(llamadas.length > 0, '🔴 censo vacío: no hay nada que cuadrar.');

  const sinDeclarar = [...new Set(llamadas.map((l) => l.veredicto))]
    .filter((v) => !VEREDICTOS_DECLARADOS.includes(v));
  assert.deepEqual(sinDeclarar, [],
    `🔴 VEREDICTO SIN DECLARAR: ${sinDeclarar.join(', ')}.\n`
    + '  Añádelo a VEREDICTOS_DECLARADOS con su significado. Un cubo que nadie ha declarado es un\n'
    + '  cubo que nadie mira, y esto es un censo sobre llamadas que PIERDEN FALLOS.');

  const suma = VEREDICTOS_DECLARADOS
    .map((v) => llamadas.filter((l) => l.veredicto === v).length)
    .reduce((a, b) => a + b, 0);
  assert.equal(suma, llamadas.length,
    `🔴 LOS CUBOS DECLARADOS NO SUMAN EL TOTAL: ${suma} ≠ ${llamadas.length}. Hay llamadas que no `
    + 'caen en ninguno.');
});

// ── 2 · EL CRITERIO: no se inventa un estado que no consta ───────────────────────────────

test('SCRUM-475 f2 · 🔴 «aceptado» NO es «entregado»', () => {
  const c = constanciaDeEnvio({ data: { id: 'abc-123' } });
  assert.equal(c.estado, 'aceptado_sin_confirmacion',
    '🔴 un envío aceptado por el proveedor NO está entregado. Decir «entregado» sin que nadie lo '
    + 'haya confirmado es exactamente el dato inventado que este ticket existe para no crear.');
  assert.equal(c.idProveedor, 'abc-123');
  assert.notEqual(c.estado, 'entregado');
});

test('SCRUM-475 f2 · 🔴 `entregado` SOLO puede venir de un aviso del proveedor', () => {
  // Ninguna entrada de la ruta de ENVÍO lo produce. Se recorren todas las formas que puede tener
  // una respuesta aceptada; ninguna puede dar «entregado».
  for (const respuesta of [{ id: 'm-1' }, { data: { id: 'm-2' } }, {}, null, undefined, { id: 42 }]) {
    assert.notEqual(constanciaDeEnvio(respuesta).estado, 'entregado',
      `🔴 un envío ACEPTADO se está marcando como entregado: ${JSON.stringify(respuesta) ?? 'undefined'}. `
      + 'Nadie ha confirmado que llegara, y el correo que rebote parecerá que se recibió.');
  }
  assert.notEqual(constanciaDeFallo({}).estado, 'entregado');
  // Y por el camino del aviso SÍ se alcanza: si no, lo de arriba lo cumpliría un estado inalcanzable.
  assert.equal(avanzar('aceptado_sin_confirmacion', 'entregado'), 'entregado',
    '🔴 `entregado` no se alcanza ni con un aviso del proveedor: entonces no es un estado, es un '
    + 'adorno, y los asertos de arriba no prueban nada.');
});

test('SCRUM-475 f2 · sin identificador, se dice — no se fabrica uno', () => {
  for (const respuesta of [null, undefined, {}, { data: {} }, { id: '' }, { id: '   ' }, { id: 42 }]) {
    const c = constanciaDeEnvio(respuesta);
    assert.equal(c.idProveedor, null, `🔴 se ha aceptado como id: ${JSON.stringify(respuesta)}`);
    assert.equal(c.estado, 'aceptado_sin_identificador',
      '🔴 «no consta identificador» es un dato, no un hueco: si el proveedor deja de mandarlo, '
      + 'tiene que verse en el estado y no quedarse un `undefined` guardado como si fuera un id.');
  }
  assert.equal(idDeLaRespuesta({ id: ' m-1 ' }), 'm-1', 'el id sí se acepta cuando existe de verdad');
});

test('SCRUM-475 f2 · un fallo conserva su motivo, y «desconocido» no vale', () => {
  assert.equal(constanciaDeFallo({ code: 'ENOTFOUND', message: 'api.resend.com' }).motivo,
    'ENOTFOUND: api.resend.com');
  assert.equal(constanciaDeFallo({}).motivo, 'sin detalle del proveedor',
    '🔴 «error desconocido» parece información y no lo es. Se dice que no consta detalle.');
  assert.equal(constanciaDeFallo({}).estado, 'fallo_envio');
});

test('SCRUM-475 f2 · 🔴 UN REBOTE NO SE PIERDE: ningún aviso posterior lo tapa', () => {
  // El mínimo irrenunciable. Un `delivered` que llega tarde —reintento del proveedor, orden de
  // entrega— no puede borrar un rebote que ya consta.
  assert.equal(avanzar('rebotado', 'entregado'), 'rebotado',
    '🔴 UN `delivered` TARDÍO ESTÁ BORRANDO UN REBOTE. El correo no llegó, consta que no llegó, y '
    + 'el sistema pasa a decir que sí: es la mentira exacta que este ticket viene a impedir.');
  assert.equal(avanzar('rebotado', 'aceptado_sin_confirmacion'), 'rebotado');
  assert.equal(avanzar('aceptado_sin_confirmacion', 'rebotado'), 'rebotado');
  assert.equal(avanzar('entregado', 'rebotado'), 'rebotado');
  // Y el embudo sí avanza hacia adelante, como el de WhatsApp.
  assert.equal(avanzar('entregado', 'aceptado_sin_confirmacion'), 'entregado');
});

test('SCRUM-475 f2 · el conjunto de estados es CERRADO', () => {
  assert.deepEqual([...ESTADOS_CORREO].sort(), [
    'aceptado_sin_confirmacion', 'aceptado_sin_identificador', 'entregado',
    'fallo_envio', 'rebotado', 'reclamado',
  ].sort(), '🔴 ha cambiado el conjunto de estados: eso es cambio de master (Parte L), no un detalle.');
});

// ── 3 · EL VOCABULARIO VIVE DENTRO DEL EMISOR ÚNICO ─────────────────────────────────────

test('SCRUM-475 f2 · CONTROL POSITIVO: el contrato de la fase 1 sigue intacto y ahora deja constancia', async () => {
  // ⚠️ Se ejerce SOLO el camino del destinatario vacío, que retorna ANTES de mirar `config` y ANTES
  // de tocar la red. Ejercer los otros exigiría una clave de proveedor, y un test que pueda mandar
  // un correo de verdad no se escribe.
  const { enviarCorreo } = await import('../dist/integrations/enviarCorreo.js');
  const r = await enviarCorreo({ to: '   ', subject: 'x', html: 'x' });

  // Lo que YA prometían SCRUM-406 y la fase 1, y no se puede romper.
  assert.equal(r.enviado, false, '🔴 se ha roto el contrato: `enviado` es la única verdad sobre si salió');
  assert.equal(r.motivo, 'sin_destino', '🔴 el motivo ha cambiado de forma: la pantalla de soporte lo lee');

  // Y lo que añade la fase 2: de este correo CONSTA que no salió, y por qué.
  assert.equal(r.constancia.estado, 'fallo_envio',
    '🔴 el emisor único no deja constancia. Sin ella, `acuse.id` es lo único que sale de aquí — y '
    + 'un id de mensaje se lee como «llegó».');
  assert.equal(r.constancia.idProveedor, null);
  assert.match(r.constancia.motivo, /destinatario/,
    '🔴 el motivo se ha perdido por el camino: es todo lo que se sabe de este envío.');
});

test('SCRUM-475 f2 · 🔴 la constancia es OBLIGATORIA en el tipo: no hay salida sin ella', () => {
  // Se comprueba en la FUENTE porque es una propiedad del tipo, y el tipo desaparece al compilar.
  // `constancia?:` volvería a permitir un camino de salida mudo, que es como se pierden estas cosas.
  const fuente = fs.readFileSync(path.join(RAIZ, 'src/integrations/enviarCorreo.ts'), 'utf8');
  assert.match(fuente, /^\s*constancia: Constancia;/m,
    '🔴 `constancia` ha dejado de ser obligatoria en `ResultadoCorreo`. Opcional se olvida: el día '
    + 'que alguien añada un camino de salida sin ella, compilará y devolverá un envío del que no '
    + 'consta nada, con la misma forma que uno del que consta todo.');
  assert.doesNotMatch(fuente, /constancia\?:/,
    '🔴 se ha marcado `constancia` como opcional.');
});

// ── 4 · CONTROL NEGATIVO · el embudo de WhatsApp no se toca ─────────────────────────────

test('SCRUM-475 f2 · 🔴 CONTROL NEGATIVO: el embudo de WhatsApp sigue intacto', () => {
  const schema = fs.readFileSync(path.join(RAIZ, 'prisma/schema.prisma'), 'utf8');
  assert.match(schema, /model WhatsAppMessage/,
    '🔴 ha desaparecido `WhatsAppMessage`. Es el embudo que este ticket COPIA, no el que toca.');
  const log = fs.readFileSync(path.join(RAIZ, 'src/modules/messaging/domain/whatsappLog.service.ts'), 'utf8');
  assert.ok(log.length > 1000, '🔴 el servicio del embudo de WhatsApp no se lee entero');
  assert.ok(!/constanciaCorreo/.test(log),
    '🔴 el embudo de WhatsApp ha empezado a depender del de correo. Son dos canales distintos: '
    + 'unificarlos es otra decisión, y no la toma este ticket de refilón.');
});

test('SCRUM-475 f2 · la constancia es PURA: ni BD, ni red, ni camino de emisión (regla 38)', () => {
  const ruta = path.join(RAIZ, 'src/modules/messaging/domain/constanciaCorreo.ts');
  const dominio = fs.readFileSync(ruta, 'utf8')
    .replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  // Suelo del filtro: si se comiera el fichero entero, las prohibiciones de abajo pasarían solas.
  assert.ok(dominio.includes('ESTADOS_CORREO'),
    '🔴 el filtro de comentarios se ha comido también el código: no queda ni la constante.');
  for (const prohibido of ['prisma', 'emitInvoice', 'allocateInvoiceNumber', 'applyVeriFactu', 'axios']) {
    assert.ok(!new RegExp(`\\b${prohibido}`).test(dominio),
      `🔴 el módulo de constancia usa \`${prohibido}\`: es puro a propósito — sin BD, sin red y sin `
      + 'camino fiscal.');
  }
});
