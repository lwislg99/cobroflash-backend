// tests/scrum501-una-fila-por-envio.test.mjs — SCRUM-501
//
// UNA FILA POR ENVÍO, ESCRITA AL ENVIAR. Sin gate, sin base de datos y sin red: el cliente de
// Prisma se INYECTA, y las salidas del emisor se leen por AST.
//
// ── LA VÍCTIMA ────────────────────────────────────────────────────────────────────────────
// La tabla existe en las tres bases, el modelo está en el esquema, la firma del webhook está
// construida y probada — y la tabla se quedaría **vacía para siempre**.
//
// 🔴 Un campo que existe en el esquema no es un campo que alguien escriba. Medido antes de tocar
// nada: **cero escritores** de `emailMessage` en todo `src/`, y ningún commit de ninguna rama los
// añade. El `provider_id` se calculaba y no se persistía, así que el `UPDATE … WHERE provider_id`
// del receptor no habría encontrado ninguna fila.
//
// ── 🔴 LA REGLA QUE DECIDE SI ESTO VALE ───────────────────────────────────────────────────
// **Una escritura de telemetría no puede tumbar la operación que observa.** Está impuesta POR
// CONSTRUCCIÓN —`registrarEnvio` no lanza y no se cuelga— y no por un `try` repetido en cada
// salida: una invariante repartida entre siete sitios es una invariante que alguien olvida en el
// octavo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// ⚠️ Se importa SOLO `registrarEnvio`. El plazo y el enmascarado del motivo NO están exportados
// —el guard de huérfanos de SCRUM-494 avisó de que exportarlos solo servía para que los leyera este
// test— y se miden por la SUPERFICIE PÚBLICA, que además prueba lo que importa: que la fila ESCRITA
// no lleva direcciones, no que exista un ayudante que sabría quitarlas.
import { registrarEnvio } from '../dist/modules/messaging/domain/registroDeEnvios.js';
import { constanciaDeEnvio, constanciaDeFallo } from '../dist/modules/messaging/domain/constanciaCorreo.js';
import { CAMPOS_PERSONALES } from '../dist/modules/system/domain/anonimizarMerchant.js';

const RAIZ = path.resolve(import.meta.dirname, '..');
const EMISOR = 'src/integrations/enviarCorreo.ts';

const CONTEXTO = Object.freeze({
  merchantId: 7, kind: 'invoice', customerId: 42, relatedType: 'invoice', relatedId: 314,
});

/** Un cliente de Prisma de mentira: registra los `create` y no toca ninguna base. */
function clienteEspia({ revienta = false, cuelga = false } = {}) {
  const escrituras = [];
  return {
    escrituras,
    emailMessage: {
      create: async (args) => {
        escrituras.push(args);
        if (revienta) throw new Error('la base dice que no');
        if (cuelga) return new Promise(() => {}); // nunca resuelve
        return { id: 1001 };
      },
    },
  };
}

// ── 0 · 🔴 SUELO · un cero se declara ciego, no se celebra ──────────────────────────────────

test('SCRUM-501 · 🔴 SUELO: el censo de escrituras ve las del emisor, o no puede afirmar nada', () => {
  // Las salidas del emisor se cuentan por AST. Si el censo no ve NINGUNA llamada, «una fila por
  // envío» y «no supe mirar» saldrían por la misma línea.
  const fuente = fs.readFileSync(path.join(RAIZ, EMISOR), 'utf8');
  const sf = ts.createSourceFile('x.ts', fuente, ts.ScriptTarget.Latest, true);
  const llamadas = [];
  (function walk(n) {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'registrarEnvio') {
      llamadas.push(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1);
    }
    ts.forEachChild(n, walk);
  })(sf);

  assert.ok(llamadas.length >= 5,
    `🔴 ESCÁNER CIEGO: solo se ven ${llamadas.length} escrituras en ${EMISOR} y hay CINCO — las dos `
    + 'salidas de Resend (éxito y fallo), las dos de SMTP y la de `sin_transporte`. Con menos, el '
    + 'control positivo de abajo no probaría que se escribe en cada camino.');
});

// ── 1 · 🔴 CONTROL POSITIVO · exactamente UNA fila, con sus datos ───────────────────────────

test('SCRUM-501 · 🔴 un envío escribe EXACTAMENTE UNA fila, con provider_id, kind y relación', async () => {
  const cliente = clienteEspia();
  const constancia = constanciaDeEnvio({ id: 'resend-abc-123' });
  const r = await registrarEnvio({ contexto: CONTEXTO, to: 'ana@obra.example', constancia, cliente });

  assert.equal(r.escrita, true, `🔴 no se ha escrito la fila: ${r.motivo}`);
  // 🔴 UNA. Dos es tan defecto como cero: el webhook actualizaría una y dejaría la otra mintiendo.
  assert.equal(cliente.escrituras.length, 1,
    `🔴 se han escrito ${cliente.escrituras.length} filas para UN envío.`);

  const fila = cliente.escrituras[0].data;
  assert.equal(fila.providerId, 'resend-abc-123',
    '🔴 la fila no lleva el `provider_id`. Es lo ÚNICO con lo que el receptor del webhook puede '
    + 'encontrarla: sin él, el `UPDATE … WHERE provider_id` no actualiza nada.');
  assert.equal(fila.status, 'aceptado_sin_confirmacion',
    '🔴 el estado no sale del vocabulario ya existente. Y no puede ser `entregado`: el proveedor '
    + 'solo ha ACEPTADO el correo (SCRUM-475 fase 2).');
  assert.equal(fila.kind, 'invoice');
  assert.equal(fila.toEmail, 'ana@obra.example');
  assert.equal(fila.merchantId, 7);
  assert.equal(fila.customerId, 42);
  assert.equal(fila.relatedType, 'invoice');
  assert.equal(fila.relatedId, 314);
  assert.equal(fila.error, null, '🔴 un envío que salió bien no tiene por qué llevar error.');

  // ⚠️ `updated_at` NO se escribe a mano: es `@updatedAt` y lo pone Prisma. La columna es NOT NULL
  // sin default, así que un `INSERT` que no venga de Prisma falla — y eso es a propósito.
  assert.ok(!('updatedAt' in fila),
    '🔴 se está escribiendo `updatedAt` a mano. Lo pone Prisma con `@updatedAt`; ponerlo aquí abre '
    + 'la puerta a que otro camino lo omita y el `INSERT` falle en producción.');
  assert.ok(!('createdAt' in fila), '🔴 `createdAt` también lo pone la base (`@default(now())`).');
});

test('SCRUM-501 · 🔴 SIN IDENTIFICADOR: la fila se escribe igual, con `provider_id` NULO', async () => {
  // Que el proveedor no dé id no puede significar que no haya constancia. Y NO se inventa uno: un
  // id fabricado haría que el webhook actualizara la fila equivocada, o ninguna.
  for (const respuesta of [null, {}, { id: '' }, { id: '   ' }, { id: 42 }]) {
    const cliente = clienteEspia();
    const r = await registrarEnvio({
      contexto: CONTEXTO, to: 'ana@obra.example', constancia: constanciaDeEnvio(respuesta), cliente,
    });
    assert.equal(r.escrita, true, `🔴 sin id no se escribe fila (respuesta ${JSON.stringify(respuesta)})`);
    assert.equal(cliente.escrituras[0].data.providerId, null,
      `🔴 se ha INVENTADO un provider_id a partir de ${JSON.stringify(respuesta)}`);
    assert.equal(cliente.escrituras[0].data.status, 'aceptado_sin_identificador',
      '🔴 el estado no dice que no hay identificador. `aceptado_sin_identificador` es exactamente '
      + 'este caso dicho con palabras, y el `@default` de la tabla es ése.');
  }
});

test('SCRUM-501 · del FALLO también queda fila, y es la que permite reintentar', async () => {
  const cliente = clienteEspia();
  const constancia = constanciaDeFallo({ code: 'ENOTFOUND', message: 'api.resend.com' });
  const r = await registrarEnvio({ contexto: CONTEXTO, to: 'ana@obra.example', constancia, cliente });
  assert.equal(r.escrita, true);
  assert.equal(cliente.escrituras[0].data.status, 'fallo_envio');
  assert.equal(cliente.escrituras[0].data.providerId, null, '🔴 un fallo no puede traer id.');
  assert.match(cliente.escrituras[0].data.error, /ENOTFOUND/,
    '🔴 la fila del fallo no dice POR QUÉ: es todo lo que se sabe de ese envío.');
});

// ── 2 · 🔴 EL CONTROL NEGATIVO, Y ES EL QUE DECIDE ─────────────────────────────────────────

test('SCRUM-501 · 🔴 si la escritura REVIENTA, no lanza y el envío sigue su curso', async () => {
  const cliente = clienteEspia({ revienta: true });
  let devuelto;
  await assert.doesNotReject(async () => {
    devuelto = await registrarEnvio({
      contexto: CONTEXTO, to: 'ana@obra.example', constancia: constanciaDeEnvio({ id: 'x' }), cliente,
    });
  }, '🔴 `registrarEnvio` LANZA cuando la base falla. Entonces un fallo de telemetría tumba el '
   + 'envío que observa: el correo sale y el llamador recibe una excepción como si no hubiera salido.');

  assert.deepEqual(devuelto, { escrita: false, motivo: 'fallo_escritura' },
    '🔴 no dice que no se escribió. «No consta» tiene que poder distinguirse de «consta».');
  assert.equal(cliente.escrituras.length, 1, '🔴 ni lo ha intentado.');
});

/** ¿Se ha resuelto ya? Sin reloj: una vuelta de macrotarea basta para saberlo. */
const yaSeResolvio = (p) => Promise.race([
  p.then(() => true, () => true),
  new Promise((r) => setImmediate(() => r(false))),
]);

test('SCRUM-501 · 🔴 si la base NO CONTESTA, al llamador lo suelta EL PLAZO', async () => {
  // Un `try/catch` no protege de esto: una escritura que nunca resuelve no lanza, **retrasa**.
  //
  // 🔴 ESTO MEDÍA RELOJ DE PARED: `Date.now()` antes y después, y `tardado < 2_000`. Y era el
  // más traicionero de su familia PRECISAMENTE POR HOLGADO: 40 ms reales contra un tope de
  // 2.000 no caen casi nunca, así que el fallo no se elimina — se APLAZA, y cuando por fin sale
  // es en la rama de otra sesión, sin relación con lo que esa sesión tocó. Un intermitente con
  // mucho margen es un intermitente al que además le hemos quitado el contexto.
  //
  // El hecho no era «tardó poco», que es una propiedad de la máquina: es que **al llamador lo
  // suelta el PLAZO y no la escritura**. Con el temporizador inyectado eso se comprueba entero,
  // y de paso se prueba algo que el reloj no probaba: que ANTES de vencer no suelta a nadie.
  const cliente = clienteEspia({ cuelga: true });
  let vencerPlazo;
  let msPedidos;
  let cancelado = false;
  const temporizar = (fn, ms) => { msPedidos = ms; vencerPlazo = fn; return () => { cancelado = true; }; };

  const enCurso = registrarEnvio({
    contexto: CONTEXTO, to: 'ana@obra.example', constancia: constanciaDeEnvio({ id: 'x' }),
    cliente, plazoMs: 40, temporizar,
  });

  assert.equal(msPedidos, 40,
    `🔴 el plazo programado es ${msPedidos} y se pidieron 40. Si no es el que le pasan, el `
    + 'llamador no puede acotar cuánto le van a retener.');

  assert.equal(await yaSeResolvio(enCurso), false,
    '🔴 SUELTA AL LLAMADOR ANTES DE QUE VENZA EL PLAZO, con la escritura aún sin contestar. '
    + 'Entonces no está esperando a nada y el resultado que devuelva no puede distinguir «no '
    + 'contestó a tiempo» de «no lo intenté». Esto el reloj no lo comprobaba.');

  vencerPlazo();
  const r = await enCurso;

  assert.deepEqual(r, { escrita: false, motivo: 'plazo' },
    '🔴 una escritura que no contesta no se declara: el llamador no puede saber que no consta. '
    + 'Y al vencer el plazo NO se quedó esperando a la escritura, que sigue colgada.');
  assert.equal(cliente.escrituras.length, 1,
    '🔴 o no lo ha intentado, o lo ha intentado más de una vez: el plazo no es un reintento.');
  assert.ok(cancelado,
    '🔴 el plazo no se cancela al salir. Un temporizador vivo por envío es una fuga, y el `unref` '
    + 'sólo evita que retenga el proceso: no evita acumularlos.');

  // Y el plazo POR DEFECTO existe y es finito: se lee del fuente, porque no está exportado y lo que
  // importa es que ninguna salida quede sin límite. Medido: 3 s.
  const fuente = fs.readFileSync(path.join(RAIZ, 'src/modules/messaging/domain/registroDeEnvios.ts'), 'utf8');
  assert.match(fuente, /const PLAZO_ESCRITURA_MS = 3_000;/,
    '🔴 ha cambiado el plazo por defecto, o ha desaparecido. Sin plazo, una base que no contesta '
    + 'retiene el correo indefinidamente — tumbar la operación por otro camino. Mídelo y dilo.');
});

test('SCRUM-501 · CONTROL NEGATIVO: sin contexto NO se escribe, y se dice cuál falta', async () => {
  // `merchant_id` y `kind` son NOT NULL. Inventar un merchant contaminaría el registro de otro, así
  // que sin contexto no hay fila — y se distingue de «falló al escribir».
  for (const [caso, contexto] of [
    ['sin nada', null],
    ['sin merchant', { kind: 'invoice' }],
    // 7.5 y no 1.5: el guard de SCRUM-409 lee el `1` de `1.5` como el merchant DEMO (id 1) y salta.
    ['merchant no entero', { merchantId: 7.5, kind: 'invoice' }],
    ['sin kind', { merchantId: 7 }],
  ]) {
    const cliente = clienteEspia();
    const r = await registrarEnvio({
      contexto, to: 'ana@obra.example', constancia: constanciaDeEnvio({ id: 'x' }), cliente,
    });
    assert.deepEqual(r, { escrita: false, motivo: 'sin_contexto' }, `🔴 caso «${caso}»`);
    assert.equal(cliente.escrituras.length, 0, `🔴 caso «${caso}»: ha tocado la base sin poder.`);
  }

  // Y sin destinatario tampoco: `to_email` es NOT NULL, y no hubo envío al que ponerle destino.
  const cliente = clienteEspia();
  const r = await registrarEnvio({
    contexto: CONTEXTO, to: '   ', constancia: constanciaDeEnvio({ id: 'x' }), cliente,
  });
  assert.deepEqual(r, { escrita: false, motivo: 'sin_destino' });
  assert.equal(cliente.escrituras.length, 0);
});

// ── 3 · 🔴 EL EMISOR ESCRIBE EN TODAS SUS SALIDAS, Y NO DOS VECES ──────────────────────────

/** Las salidas del emisor: cada `return` que produce un `ResultadoCorreo`, y si registra antes. */
function salidasDelEmisor(fuente) {
  const sf = ts.createSourceFile('x.ts', fuente, ts.ScriptTarget.Latest, true);
  const fn = (nombre) => {
    let encontrada = null;
    (function buscar(n) {
      if (!encontrada && ts.isFunctionDeclaration(n) && n.name?.text === nombre) { encontrada = n; return; }
      if (!encontrada) ts.forEachChild(n, buscar);
    })(sf);
    return encontrada;
  };
  const medir = (nombre) => {
    const nodo = fn(nombre);
    if (!nodo) return null;
    const texto = nodo.getText(sf);
    const registros = (texto.match(/registrarEnvio\(/g) || []).length;
    const retornos = [];
    (function walk(n) {
      if (ts.isReturnStatement(n) && n.expression) retornos.push(n.expression.getText(sf).replace(/\s+/g, ' '));
      ts.forEachChild(n, walk);
    })(nodo.body);
    return { registros, retornos };
  };
  return { enviarPorResend: medir('enviarPorResend'), enviarCorreo: medir('enviarCorreo') };
}

test('SCRUM-501 · 🔴 cada salida del emisor deja fila, y una delegación NO la duplica', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, EMISOR), 'utf8');
  const s = salidasDelEmisor(fuente);

  assert.ok(s.enviarPorResend && s.enviarCorreo,
    '🔴 NO SUPE MIRAR: no encuentro `enviarPorResend` o `enviarCorreo` en el emisor.');

  // `enviarPorResend`: éxito y fallo. Dos salidas, dos registros.
  assert.equal(s.enviarPorResend.registros, 2,
    `🔴 \`enviarPorResend\` registra ${s.enviarPorResend.registros} veces y tiene DOS salidas `
    + '(el envío que sale y el que revienta). Un correo que sale sin fila no deja constancia de él.');

  // `enviarCorreo`: SMTP éxito, SMTP fallo y `sin_transporte`. Tres. **Y NO en la rama de Resend**,
  // porque ahí delega y `enviarPorResend` ya la escribió: dos filas por un envío es tan defecto
  // como cero.
  assert.equal(s.enviarCorreo.registros, 3,
    `🔴 \`enviarCorreo\` registra ${s.enviarCorreo.registros} veces y tiene TRES salidas propias `
    + '(SMTP bien, SMTP mal, sin transporte). Si son 4, está registrando también la delegación a '
    + '`enviarPorResend` y cada envío por Resend dejaría DOS filas.');

  // 🔴 Y la delegación sigue siendo un `return` directo: es lo que hace imposible el duplicado.
  assert.ok(s.enviarCorreo.retornos.some((r) => /^enviarPorResend\(c\)$/.test(r)),
    '🔴 la delegación a `enviarPorResend` ya no es un `return` directo. Si ahora se guarda el '
    + 'resultado y se registra después, cada envío por Resend deja DOS filas.');

  // El suelo del propio aserto: que se hayan leído retornos de verdad.
  assert.ok(s.enviarCorreo.retornos.length >= 4,
    `🔴 solo se leen ${s.enviarCorreo.retornos.length} retornos de \`enviarCorreo\`: el analizador `
    + 'no está mirando donde cree.');
});

test('SCRUM-501 · el `sin_destino` del emisor NO escribe fila, y es correcto', () => {
  // `to_email` es NOT NULL: sin destinatario no hay fila que describa nada, porque no hubo envío.
  // Va declarado en un test para que la ausencia sea una decisión y no un olvido.
  const fuente = fs.readFileSync(path.join(RAIZ, EMISOR), 'utf8');
  const i = fuente.indexOf('if (!c.to || !c.to.trim()) return resultadoSinDestino();');
  assert.ok(i > 0,
    '🔴 ha cambiado la salida `sin_destino` del emisor. Si ahora escribe fila, `to_email` es NOT '
    + 'NULL y el `INSERT` fallará en producción: mídelo antes de darlo por bueno.');
});

// ── 4 · 🔴 EL DATO PERSONAL · una sola copia en claro, y está cubierta ─────────────────────

test('SCRUM-501 · 🔴 la dirección solo se escribe en `to_email`, que SÍ está cubierta', async () => {
  // Mi propio guard de SCRUM-497 cubre `emailMessage.toEmail`. Si esta escritura metiera la
  // dirección en OTRO campo, ese campo NO estaría cubierto y sobreviviría a una supresión.
  assert.deepEqual([...CAMPOS_PERSONALES.emailMessage], ['toEmail'],
    '🔴 ha cambiado lo que se anonimiza de `emailMessage` (SCRUM-497).');

  const cliente = clienteEspia();
  const CORREO = 'ana@obra.example';
  await registrarEnvio({
    contexto: CONTEXTO, to: CORREO, constancia: constanciaDeFallo({ message: `fallo mandando a ${CORREO}` }), cliente,
  });
  const fila = cliente.escrituras[0].data;

  const enClaro = Object.entries(fila)
    .filter(([, v]) => typeof v === 'string' && v.includes(CORREO))
    .map(([k]) => k);
  assert.deepEqual(enClaro, ['toEmail'],
    `🔴 LA DIRECCIÓN SE ESCRIBE EN ${enClaro.join(', ')} y solo \`toEmail\` está cubierta por `
    + '`CAMPOS_PERSONALES`. Cualquier otra copia sobreviviría a una supresión del art. 17 — y el '
    + 'guard de SCRUM-497 no la vería, porque vigila columnas del esquema, no contenidos.\n\n'
    + '  ⚠️ Ojo con `error`: el mensaje del proveedor puede traer la dirección dentro.');
});

test('SCRUM-501 · 🔴 AUTOPRUEBA de la fuga que este test destapó, por la superficie pública', async () => {
  // Este test existe porque el de arriba SALIÓ ROJO sobre mi propio código: `error` guardaba el
  // mensaje del proveedor tal cual, y ese mensaje trae el destinatario dentro. `CAMPOS_PERSONALES`
  // no cubre `error`, así que la dirección habría sobrevivido a una supresión escondida en un texto.
  //
  // Se mide sobre la FILA ESCRITA —no sobre el ayudante— en los dos sentidos.
  const conCorreos = [
    ['550 no such user ana@obra.example', ['ana@obra.example']],
    ['ENOTFOUND: <ana@obra.example>', ['ana@obra.example']],
    ['rechazado para ana@obra.example, cc bob@otra.example', ['ana@obra.example', 'bob@otra.example']],
  ];
  for (const [mensaje, correos] of conCorreos) {
    const cliente = clienteEspia();
    await registrarEnvio({
      contexto: CONTEXTO, to: 'ana@obra.example', constancia: constanciaDeFallo({ message: mensaje }), cliente,
    });
    const escrito = cliente.escrituras[0].data.error;
    for (const c of correos) {
      assert.ok(!escrito.includes(c),
        `🔴 «${c}» sigue en claro en la columna \`error\`: «${escrito}». Es la fuga que este test fija.`);
    }
    assert.match(escrito, /@/,
      `🔴 se ha borrado el dominio entero de «${mensaje}»: enmascarar no es borrar, y sin dominio el `
      + 'mensaje de diagnóstico deja de servir.');
  }

  // CONTROL NEGATIVO: un motivo SIN direcciones llega INTACTO. Si se tocara, estaría destrozando los
  // mensajes de diagnóstico, que son justo lo que hay que poder leer después.
  for (const limpio of ['ENOTFOUND: api.resend.com', 'timeout de 10000 ms']) {
    const cliente = clienteEspia();
    await registrarEnvio({
      contexto: CONTEXTO, to: 'ana@obra.example', constancia: constanciaDeFallo({ message: limpio }), cliente,
    });
    assert.equal(cliente.escrituras[0].data.error, limpio,
      `🔴 ha modificado un motivo que no tenía ninguna dirección: «${limpio}»`);
  }

  // Y un envío que salió bien no lleva motivo: nada que enmascarar, y `null` no revienta.
  const ok = clienteEspia();
  await registrarEnvio({
    contexto: CONTEXTO, to: 'ana@obra.example', constancia: constanciaDeEnvio({ id: 'x' }), cliente: ok,
  });
  assert.equal(ok.escrituras[0].data.error, null);
});

test('SCRUM-501 · el log del registro enmascara el destinatario', async () => {
  const original = console.error;
  const lineas = [];
  console.error = (...a) => lineas.push(a.join(' '));
  try {
    await registrarEnvio({
      contexto: CONTEXTO, to: 'ana@obra.example',
      constancia: constanciaDeEnvio({ id: 'x' }), cliente: clienteEspia({ revienta: true }),
    });
  } finally { console.error = original; }

  assert.equal(lineas.length, 1, `🔴 el fallo de escritura no deja rastro: ${lineas.length} líneas.`);
  assert.ok(!lineas[0].includes('ana@'),
    `🔴 el log escribe el correo en claro: ${lineas[0]}. Los logs de Railway los lee cualquiera con `
    + 'acceso al panel.');
  assert.match(lineas[0], /obra\.example/,
    '🔴 el enmascarado se ha comido el dominio: entonces el rastro no permite ni acercarse a quién.');
});
