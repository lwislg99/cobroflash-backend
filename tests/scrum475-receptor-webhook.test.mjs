// tests/scrum475-receptor-webhook.test.mjs — SCRUM-475 (fase 2B), guard estructural, sin gate.
//
// 🔴 UN REBOTE DEJA RASTRO. HASTA HOY NO DEJABA NINGUNO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ CIERRA ESTA TANDA, Y CÓMO SE SABE QUE ESTABA ABIERTO
//
// Medido antes de construir: `grep webhooks/resend` en `src/` no encontraba ninguna ruta —el único
// acierto era un COMENTARIO dentro de `firmaResend.ts`— y el mismo instrumento sí encuentra los
// otros webhooks del producto. El correo salía, escribía su fila con `aceptado_sin_confirmacion` y
// **ahí se quedaba para siempre**: `entregado`, `rebotado` y `reclamado` son los tres estados que un
// envío propio NO PUEDE producir. Solo los produce un aviso del proveedor, y no había quien lo
// recibiera.
//
// Por ese canal viaja la factura al cliente final del profesional.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 DÓNDE ESTÁ LA COSTURA DE ESTE FICHERO, DICHA EN VEZ DE ESCONDIDA
//
// El receptor toca base de datos, y la suite no tiene base. Así que se prueba en dos mitades y se
// declara la juntura:
//
//   · LA DECISIÓN Y LA ESCRITURA — de punta a punta, con un cliente FALSO inyectado. Aquí se
//     comprueba lo que decide el ticket: que la fila del envío que rebota CAMBIA.
//   · LA RUTA — su contrato HTTP de verdad (las dos clases de rechazo) driving el router real, que
//     no necesita base porque ni llega a mirarla; y el CABLE hasta el aplicador, por AST.
//
// El cable se vigila por AST a propósito: es exactamente donde un refactor dejaría el receptor
// contestando `200 ok` sin escribir nada — verde, mudo, y con la tabla llenándose de envíos que se
// quedan en `aceptado_sin_confirmacion` para siempre. Es la misma avería que este ticket persigue,
// una capa más arriba.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { censarLlamadas, censarEscritores, REPOSITORIO } from './_censo-emisores-con-fila.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTA_RECEPTOR = 'src/modules/messaging/app/routes/resendWebhook.routes.ts';

const { leerAviso } = await import('../dist/modules/messaging/domain/avisoDeCorreo.js');
const { aplicarAvisoDeProveedor } = await import('../dist/modules/messaging/domain/registroDeEnvios.js');
const receptor = await import('../dist/modules/messaging/app/routes/resendWebhook.routes.js');
// El receptor lee el secreto EN CADA PETICIÓN (`config.RESEND_WEBHOOK_SECRET` dentro del handler),
// así que se puede poner y quitar entre llamadas. Es lo que permite probar las DOS clases de
// rechazo de verdad en vez de afirmar la mitad.
const { config } = await import('../dist/core/config/env.js');

// ── Utillaje ─────────────────────────────────────────────────────────────────────────────

const secretoDePrueba = () => 'whsec_' + crypto.randomBytes(24).toString('base64');
const claveDe = (s) => Buffer.from(s.replace(/^whsec_/, ''), 'base64');

function firmar(secreto, id, ts_, cuerpo) {
  const bloque = Buffer.concat([Buffer.from(`${id}.${ts_}.`, 'utf8'), cuerpo]);
  return crypto.createHmac('sha256', claveDe(secreto)).update(bloque).digest('base64');
}

/** Cabeceras firmadas para un cuerpo dado. El reloj se pasa para que la ventana sea determinista. */
function cabecerasFirmadas(secreto, cuerpo, ahora = Date.now()) {
  const id = 'msg_' + crypto.randomBytes(6).toString('hex');
  const ts_ = String(Math.floor(ahora / 1000));
  return {
    'svix-id': id,
    'svix-timestamp': ts_,
    'svix-signature': `v1,${firmar(secreto, id, ts_, cuerpo)}`,
  };
}

/**
 * Una base FALSA con una fila. Cuenta lo que se le pide: sin eso, «no escribió» y «escribió lo
 * mismo» se ven igual, y el control de «no consta» no probaría nada.
 */
function baseFalsa(filas = []) {
  const estado = { filas: filas.map((f) => ({ ...f })), updates: 0, busquedas: 0 };
  return {
    estado,
    cliente: {
      emailMessage: {
        findUnique: async ({ where }) => {
          estado.busquedas++;
          return estado.filas.find((f) => f.providerId === where.providerId) ?? null;
        },
        update: async ({ where, data }) => {
          estado.updates++;
          const fila = estado.filas.find((f) => f.id === where.id);
          Object.assign(fila, data);
          return { id: fila.id };
        },
      },
    },
  };
}

/**
 * Conduce el router REAL con un req/res de mentira. Devuelve `{ status, cuerpo }`.
 *
 * No hace falta base de datos en ninguno de los casos que se prueban aquí: los dos se resuelven en
 * la verificación de firma, antes de que el receptor mire nada.
 */
function pedir({ cabeceras, cuerpo }) {
  const req = { method: 'POST', url: '/', headers: cabeceras, body: cuerpo };
  return new Promise((resolver, rechazar) => {
    let status = 200;
    const res = {
      status(c) { status = c; return res; },
      json(o) { resolver({ status, cuerpo: o }); return res; },
    };
    receptor.router(req, res, (e) => rechazar(e ?? new Error('la ruta no contestó')));
  });
}

const leerFuente = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO — antes de creerse ningún verde
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-475 2B · 🔴 SUELO: el censo de emisores ve los 7 del embudo, o se declara CIEGO', () => {
  const llamadas = censarLlamadas();
  assert.ok(llamadas.length > 0,
    '🔴 CIEGO: el censo de emisores devuelve CERO llamadas al emisor único. Si de verdad no hubiera ' +
    'ninguna, nadie escribiría filas y este receptor no tendría nada que actualizar; y si las hay y ' +
    'no las ve, todo lo de abajo pasaría en verde sobre una lista vacía. Arregla el censo antes de ' +
    'creerte nada.');
  assert.ok(llamadas.length >= 7,
    `🔴 CIEGO: el censo ve ${llamadas.length} llamadas y el embudo tiene 7 emisores (SCRUM-508). ` +
    'Una caída no es limpieza: es que el censo ha dejado de encontrar lo que vigila.');
});

test('SCRUM-475 2B · 🔴 SUELO: sigue habiendo UN SOLO escritor de la tabla, y ahora escribe dos veces', () => {
  // El aplicador de avisos hace `update` sobre `email_messages`. Si lo hubiera puesto en la ruta
  // —que es donde parecía tocar— habría un SEGUNDO camino de escritura, y `scrum508` caería con
  // razón: seis sitios escribiendo la misma tabla son seis que recordar cuando cambie qué se
  // escribe. Esto fija que la ampliación de 2B no rompió esa propiedad.
  const escritores = censarEscritores();
  assert.ok(escritores.length >= 2,
    `🔴 CIEGO: solo ${escritores.length} escritura(s) en \`email_messages\`. Desde 2B tiene que haber ` +
    'al menos DOS —el `create` del envío y el `update` del aviso—: si el censo solo ve una, o el ' +
    'receptor no escribe, o el detector se quedó corto.');
  assert.deepEqual([...new Set(escritores.map((e) => e.fichero))], [REPOSITORIO],
    '🔴 HAY MÁS DE UN FICHERO ESCRIBIENDO `email_messages`:\n    ' +
    escritores.map((e) => `${e.fichero}:${e.linea} (${e.operacion})`).join('\n    '));
});

test('SCRUM-475 2B · 🔴 SUELO: el receptor está MONTADO — si no, es un motor sin superficie', () => {
  // La avería que este proyecto lleva semanas pagando: construir el motor, no cablearlo, y que
  // todo pase en verde porque nadie puede alcanzarlo. Aquí se comprueba lo único que hace que el
  // receptor exista para el mundo: que `app.ts` lo monta, y ANTES del parser global.
  const app = leerFuente('src/app.ts');
  const mont = app.indexOf("app.use('/webhooks/resend'");
  assert.ok(mont > 0,
    '🔴 `/webhooks/resend` NO está montado en `app.ts`. El receptor existe y NADIE PUEDE LLEGAR a ' +
    'él: el proveedor recibiría 404 en cada aviso y el embudo del correo seguiría mudo — en verde.');
  const parserGlobal = app.indexOf('app.use(express.json({');
  assert.ok(parserGlobal > 0, '🔴 no encuentro el parser global: este suelo no puede comprobar el orden.');
  assert.ok(mont < parserGlobal,
    '🔴 `/webhooks/resend` se monta DESPUÉS del parser global. La firma cubre los BYTES: si un ' +
    '`express.json()` los parsea y re-serializa antes, NINGÚN aviso legítimo verificará jamás. Y no ' +
    'dirá «firma inválida» — dirá `cuerpo_no_crudo`, que es lo que hace depurable ese día.');
  assert.match(app, /resendRawBody/,
    '🔴 la ruta se monta sin su parser crudo propio.');
});

test('SCRUM-475 2B · 🔴 SUELO: la superficie pública está DECLARADA como webhook firmado', () => {
  const dec = leerFuente('src/core/http/publicAccessDeclarations.ts');
  assert.match(dec, /'\/webhooks\/resend'/,
    '🔴 `/webhooks/resend` no está en `PUBLIC_PREFIXES`. Es una ruta PÚBLICA nueva: sin declararla, ' +
    'el guard A no la vigila y nadie ha afirmado por qué es segura.');
  assert.match(dec, /path: '\/webhooks\/resend',\s*\n\s*kind: 'signed-webhook'/,
    '🔴 la ruta no está declarada como `signed-webhook`. Si alguien la reclasifica, que se vea en el diff.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL TEST QUE DECIDE
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-475 2B · 🔴 EL TEST QUE DECIDE: un envío que REBOTA deja rastro', async () => {
  // 🔴 El envío se NOMBRA en todos los mensajes, y su identificador sale del propio caso: un rojo
  // que dice «algo no se guardó» manda a buscar; uno que dice CUÁL se atiende.
  const ENVIO = 'resend_abc123';
  const base = baseFalsa([
    { id: 41, providerId: ENVIO, status: 'aceptado_sin_confirmacion', error: null },
  ]);
  const aviso = leerAviso({ type: 'email.bounced', data: { email_id: ENVIO, reason: 'mailbox full' } });
  assert.equal(aviso.ok, true, `🔴 el aviso de rebote del envío \`${ENVIO}\` no se lee: ${aviso.motivo ?? ''}`);

  const r = await aplicarAvisoDeProveedor({
    idProveedor: aviso.idProveedor, estado: aviso.estado, motivo: 'mailbox full', cliente: base.cliente,
  });

  assert.equal(r.aplicado, true,
    `🔴 EL REBOTE DEL ENVÍO \`${ENVIO}\` NO DEJA RASTRO (motivo: ${r.motivo ?? '(ninguno)'}).\n\n` +
    '  Es el defecto entero del ticket: el fontanero cree que ha facturado, el cliente nunca recibió\n' +
    '  la factura, y cuando reclame el cobro la conversación empieza por «yo no he recibido nada».');
  assert.equal(base.estado.filas[0].status, 'rebotado',
    `🔴 LA FILA DEL ENVÍO \`${ENVIO}\` SE HA QUEDADO SIN RASTRO: sigue en ` +
    `«${base.estado.filas[0].status}» después de un rebote.\n\n` +
    '  La fila EXISTE y el aviso LLEGÓ y se entendió — lo que no se ha hecho es escribir. Mira quién\n' +
    '  quitó el `update` de `aplicarAvisoDeProveedor`.');
  assert.equal(base.estado.updates, 1,
    `🔴 se esperaba UNA escritura para \`${ENVIO}\` y hubo ${base.estado.updates}.`);
});

test('SCRUM-475 2B · CONTROL POSITIVO: una entrega confirmada también consta', async () => {
  // Sin esto, un aplicador que escribiera «rebotado» a todo pasaría el test de arriba.
  const base = baseFalsa([{ id: 7, providerId: 'resend_ok', status: 'aceptado_sin_confirmacion' }]);
  const aviso = leerAviso({ type: 'email.delivered', data: { email_id: 'resend_ok' } });
  const r = await aplicarAvisoDeProveedor({ ...aviso, cliente: base.cliente });
  assert.equal(r.aplicado, true);
  assert.equal(base.estado.filas[0].status, 'entregado',
    '🔴 una entrega confirmada por el proveedor no queda como `entregado`.');
});

test('SCRUM-475 2B · 🔴 el motivo del rebote se guarda SIN la dirección en claro', async () => {
  // `error` NO está cubierta por `CAMPOS_PERSONALES` (SCRUM-497), y los mensajes de rebote traen
  // el destinatario dentro. Una dirección escondida ahí sobreviviría a una supresión del art. 17.
  const base = baseFalsa([{ id: 9, providerId: 'resend_pii', status: 'aceptado_sin_confirmacion' }]);
  await aplicarAvisoDeProveedor({
    idProveedor: 'resend_pii', estado: 'rebotado',
    motivo: '550 5.1.1 no such user ana@obra.example', cliente: base.cliente,
  });
  assert.doesNotMatch(base.estado.filas[0].error, /ana@obra\.example/,
    `🔴 la dirección viaja EN CLARO a la columna \`error\`: «${base.estado.filas[0].error}». Esa ` +
    'columna no la anonimiza nadie.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// NO SE INVENTA LO QUE NO CONSTA
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-475 2B · 🔴 sin fila que actualizar NO se fabrica una: se dice «no consta»', async () => {
  // El correo salió antes de que existiera la tabla, y no hay backfill A PROPÓSITO. Una fila creada
  // aquí afirmaría que sabemos de un envío del que no sabemos ni el merchant — y `merchant_id` es
  // NOT NULL, así que habría que inventarse también eso.
  const base = baseFalsa([]);
  const r = await aplicarAvisoDeProveedor({
    idProveedor: 'resend_de_antes', estado: 'rebotado', cliente: base.cliente,
  });
  assert.equal(r.aplicado, false);
  assert.equal(r.motivo, 'no_consta_ese_envio',
    `🔴 se está tratando como error lo que es un dato: «${r.motivo}».`);
  assert.equal(base.estado.updates, 0, '🔴 se ha escrito algo pese a no haber fila que actualizar.');
  assert.equal(base.estado.filas.length, 0,
    '🔴 SE HA FABRICADO UNA FILA para un envío del que no consta nada. Es exactamente lo contrario ' +
    'del criterio del ticket: decir «no consta» no es un hueco, es el dato.');
});

test('SCRUM-475 2B · 🔴 un evento DESCONOCIDO no se traduce a un estado parecido', () => {
  const r = leerAviso({ type: 'email.opened', data: { email_id: 'x' } });
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'evento_desconocido',
    '🔴 un evento que no conocemos está produciendo un estado. Si el proveedor estrena uno mañana, ' +
    'esto tiene que decir «no sé qué es esto» en vez de decidir.');
});

test('SCRUM-475 2B · 🔴 un aviso SIN identificador se dice, no se adivina la fila', () => {
  const r = leerAviso({ type: 'email.bounced', data: { to: 'ana@obra.example' } });
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'sin_identificador',
    '🔴 sin identificador se está resolviendo la fila por otro camino. Buscarla por destinatario y ' +
    'hora es adivinar cuál de sus correos es.');
});

test('SCRUM-475 2B · 🔴 UN REBOTE NO SE TAPA: un `delivered` que llega tarde no lo borra', async () => {
  const base = baseFalsa([{ id: 3, providerId: 'resend_r', status: 'rebotado' }]);
  await aplicarAvisoDeProveedor({ idProveedor: 'resend_r', estado: 'entregado', cliente: base.cliente });
  assert.equal(base.estado.filas[0].status, 'rebotado',
    '🔴 un `delivered` tardío ha borrado un rebote ya constatado. El embudo no retrocede: el rebote ' +
    'es justo el que alguien tiene que mirar.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CONTRATO HTTP — y la separación que no se puede perder
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-475 2B · 🔴 «no pude comprobarlo» y «lo rechacé» NO contestan lo mismo', async () => {
  const cuerpo = Buffer.from(JSON.stringify({ type: 'email.bounced', data: { email_id: 'x' } }), 'utf8');

  const secretoOriginal = config.RESEND_WEBHOOK_SECRET;
  try {
    // ① NO_SE_PUDO_COMPROBAR — la firma va BIEN construida a propósito: lo único que falta es el
    // secreto de NUESTRO lado. Si el receptor contestara 401 aquí, estaría acusando al proveedor de
    // un fallo nuestro, y se buscaría el problema en Resend durante horas.
    config.RESEND_WEBHOOK_SECRET = '';
    const nuestro = await pedir({ cabeceras: cabecerasFirmadas(secretoDePrueba(), cuerpo), cuerpo });
    assert.equal(nuestro.status, 503,
      `🔴 sin secreto configurado el receptor contesta ${nuestro.status}, y tiene que ser 503: es ` +
      'configuración NUESTRA y un reintento SÍ funcionará en cuanto se arregle.');

    // ② RECHAZADO — el secreto ESTÁ, y la firma viene de otro. Aquí sí manda basura un tercero.
    config.RESEND_WEBHOOK_SECRET = secretoDePrueba();
    const suyo = await pedir({ cabeceras: cabecerasFirmadas(secretoDePrueba(), cuerpo), cuerpo });
    assert.equal(suyo.status, 401,
      `🔴 con el secreto puesto y una firma que no casa, el receptor contesta ${suyo.status} y tiene ` +
      'que ser 401. Un 503 haría que el proveedor REINTENTARA en bucle un aviso que jamás va a valer.');

    // 🔴 Y LA COMPROBACIÓN QUE DE VERDAD DECIDE: que NO son el mismo número. Los dos casos por
    // separado podrían pasar con un guard que devolviera siempre lo mismo si alguien igualara los
    // dos códigos; esto es lo que impide que la distinción se pierda en el último metro.
    assert.notEqual(nuestro.status, suyo.status,
      `🔴 «no pude comprobarlo» y «lo rechacé» contestan lo MISMO (${nuestro.status}). ` +
      '`firmaResend.ts` las separa en el TIPO precisamente para que no se junten aquí, y juntarlas ' +
      'pierde la que importa: la que dice que el fallo es nuestro.');
    assert.equal(nuestro.cuerpo.ok, false);
    assert.equal(suyo.cuerpo.ok, false);
  } finally {
    config.RESEND_WEBHOOK_SECRET = secretoOriginal;
  }
});

test('SCRUM-475 2B · el receptor NO devuelve el detalle de por qué rechazó', async () => {
  const cuerpo = Buffer.from('{}', 'utf8');
  const r = await pedir({ cabeceras: {}, cuerpo });
  assert.equal(JSON.stringify(r.cuerpo), '{"ok":false}',
    `🔴 la respuesta explica qué le faltó a la firma: «${JSON.stringify(r.cuerpo)}». Eso es un manual ` +
    'para quien manda basura. El detalle va al log.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CABLE — por AST, que es donde se rompería en silencio
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-475 2B · 🔴 la ruta VERIFICA la firma y APLICA el aviso — las tres llamadas, por AST', () => {
  const fuente = leerFuente(RUTA_RECEPTOR);
  const sf = ts.createSourceFile('r.ts', fuente, ts.ScriptTarget.Latest, true);
  const llamadas = new Set();
  (function rec(n) {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) llamadas.add(n.expression.text);
    ts.forEachChild(n, rec);
  })(sf);

  for (const [nombre, porque] of [
    ['verificarFirmaResend', 'sin verificar la firma, CUALQUIERA con la URL puede decirnos que un correo se entregó'],
    ['leerAviso', 'sin leerlo no se sabe ni qué evento es ni de qué envío habla'],
    ['aplicarAvisoDeProveedor', 'ÉSTA es la que deja el rastro: sin ella el receptor contesta 200 y no escribe NADA'],
  ]) {
    assert.ok(llamadas.has(nombre),
      `🔴 la ruta ya NO llama a \`${nombre}\`. ${porque}.\n\n` +
      '  Se comprueba por AST y no por texto porque este fichero NOMBRA en sus comentarios lo que\n' +
      '  vigila: un `grep` daría verde leyendo la explicación de la llamada que se ha borrado.');
  }
});

test('SCRUM-475 2B · el receptor no toca el camino de emisión ni escribe facturas (reglas 38 y 29)', () => {
  const fuente = leerFuente(RUTA_RECEPTOR);
  for (const prohibido of ['invoice.', 'prisma.invoice', 'registro.builder', 'sellar', 'verifactu']) {
    assert.ok(!fuente.includes(prohibido),
      `🔴 el receptor menciona «${prohibido}». Un webhook de correo no toca el camino de emisión.`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONTROL NEGATIVO — el embudo de WhatsApp no se toca
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-475 2B · 🔴 CONTROL NEGATIVO: el embudo de WhatsApp sigue dando exactamente lo mismo', () => {
  const schema = leerFuente('prisma/schema.prisma');
  assert.match(schema, /model WhatsAppMessage/,
    '🔴 ha desaparecido `WhatsAppMessage`. Es el embudo que este ticket COPIA, no el que toca.');
  const log = leerFuente('src/modules/messaging/domain/whatsappLog.service.ts');
  for (const nuestro of ['avisoDeCorreo', 'aplicarAvisoDeProveedor', 'constanciaCorreo', 'resendWebhook']) {
    assert.ok(!log.includes(nuestro),
      `🔴 el embudo de WhatsApp ha empezado a depender de «${nuestro}». Son dos canales distintos: ` +
      'unificarlos es otra decisión, y no la toma este ticket de refilón.');
  }
  for (const estado of ['queued', 'sent', 'delivered', 'read']) {
    assert.ok(log.includes(estado), `🔴 el estado «${estado}» ha salido del embudo de WhatsApp.`);
  }
});
