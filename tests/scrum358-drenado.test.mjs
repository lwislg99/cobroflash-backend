// tests/scrum358-drenado.test.mjs — SCRUM-358 (H3 · fase 3)
//
// EL DRENADO: QUE LA COLA SE VACÍE SOLA.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LO QUE CIERRA
//
// La fase 2 dejó la cola guardando y sin vaciar: una firma encolada se quedaba dentro hasta que el
// profesional volviera a pulsar «Firmar aquí mismo» en ese albarán. Por eso hubo que degradar el
// aviso a «no suben solas todavía». Esta fase lo devuelve a la verdad, y aquí se ejercita el
// camino de punta a punta: firmar sin cobertura → queda en la cola → vuelve la red → se abre la
// aplicación → sube, se confirma, sale de la cola y el contador baja.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { montarAlmacen, porQueEstariaCiego } from './_banco-almacen-local.mjs';
import { portalCautivo, redNormal, aceptaYNoEntrega } from './_banco-red.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALBARAN_ID = 42;
const CUERPO = Object.freeze({
  signatureData: 'data:image/png;base64,AAAA',
  firmadoPorNombre: 'Aurora Benítez',
  firmadoPorCalidad: 'cliente',
});

/** Espera a que la cola tenga `n` entradas, o falla diciendo cuántas hay. */
async function esperarEnLaCola(b, n, ms = 2000) {
  const hasta = Date.now() + ms;
  let ultima = null;
  while (Date.now() < hasta) {
    const cola = await b.ctx.leerFirmasPendientes();
    ultima = cola.firmas ? cola.firmas.length : null;
    if (ultima === n) return cola;
    await new Promise((r) => { const t = setTimeout(r, 20); if (t.unref) t.unref(); });
  }
  assert.fail(`🔴 la cola tiene ${ultima} entrada(s) y se esperaban ${n}.`);
  return null;
}

/**
 * Siembra la cola SIN pasar por la red: la fase 2 ya tiene sus propios tests y aquí lo que se
 * mide es el vaciado. Encolar de verdad contra «acepta y no entrega» dejaría peticiones colgadas
 * que no aportan nada a este fichero.
 */
async function sembrar(b, albaranes) {
  for (const id of albaranes) await b.ctx.encolarFirma(id, CUERPO);
  return b.ctx.leerFirmasPendientes();
}

/** Un `subirFirma` de mentira que responde lo que se le diga, por albarán. */
function subidorQue(respuestas) {
  const llamadas = [];
  return {
    llamadas,
    fn: async (firma) => {
      llamadas.push(firma.albaranId);
      const r = respuestas[firma.albaranId] ?? respuestas.porDefecto;
      if (typeof r === 'function') return r(firma);
      if (r instanceof Error) throw r;
      return r;
    },
  };
}

/** El 409 que devuelve el servidor cuando el albarán YA está firmado. */
function error409() {
  const e = new Error('Este albarán ya está firmado.');
  e.status = 409;
  e.code = 'albaran_locked';
  e.data = { error: 'albaran_locked', message: 'Este albarán ya está firmado.' };
  return e;
}

// ── 🔴 SUELO ───────────────────────────────────────────────────────────────────────────────

test('SCRUM-358 · 🔴 SUELO: el banco monta el drenado, o se declara CIEGO', () => {
  const b = montarAlmacen(RAIZ);
  assert.equal(porQueEstariaCiego(b, RAIZ), null, '🔴 BANCO CIEGO (almacén).');
  for (const n of ['drenarFirmasPendientes', 'drenarAlAbrir', 'ordenDeDrenado',
    'elServidorYaLaTiene', 'subirFirmaDeLaCola']) {
    assert.equal(typeof b.ctx[n], 'function', `🔴 no está publicada \`${n}\`.`);
  }
  const rotos = b.fallos.filter((f) => ['js/colaDeFirmas.js', 'js/estadoFirma.js',
    'js/almacenLocal.js', 'js/app.js'].includes(f.fichero));
  assert.deepEqual(rotos, [], '🔴 un fichero del camino no carga: ' + JSON.stringify(rotos));
});

// ── ✅ EL TEST DEL BLOQUE: H DE PUNTA A PUNTA ──────────────────────────────────────────────

test('SCRUM-358 · ✅ sin cobertura queda en la cola; vuelve la red, se abre la app y SUBE', async () => {
  // 1) SIN COBERTURA — se firma contra una red que acepta y no entrega. No se espera a que la
  //    petición vuelva: contra esa red no vuelve nunca, y ésa es justo la escena.
  const b = montarAlmacen(RAIZ, { dashboard: { red: aceptaYNoEntrega() } });
  b.ctx.PLAZO_RED_MS = 60;
  b.ctx.firmarConRedDeSeguridad(ALBARAN_ID, CUERPO,
    () => b.ctx.apiRequest(`/admin/albaranes/${ALBARAN_ID}/firmar`, { method: 'POST' })).catch(() => {});
  await esperarEnLaCola(b, 1);

  const antes = await b.ctx.pendientesDeSubir();
  assert.equal(antes.n, 1);
  assert.equal(antes.texto, 'Te queda 1 firma por subir',
    '🔴 el contador no ve la firma encolada: el resto del test no probaría el descenso.');

  // 2) VUELVE LA RED Y SE ABRE LA APLICACIÓN.
  const subidor = subidorQue({ porDefecto: { id: ALBARAN_ID, estado: 'firmado' } });
  const r = await b.ctx.drenarFirmasPendientes(subidor.fn, { plazoMs: 1000 });

  assert.equal(r.estado, b.ctx.GUARDADO);
  assert.equal(r.subidas, 1, `🔴 no se subió la firma. Fallidas: ${JSON.stringify(r.fallidas)}`);
  assert.deepEqual([...subidor.llamadas], [ALBARAN_ID], '🔴 no se pidió la subida de esa firma.');

  // 3) SALE DE LA COLA...
  const cola = await b.ctx.leerFirmasPendientes();
  assert.equal(cola.firmas.length, 0,
    '🔴 LA FIRMA SIGUE EN LA COLA DESPUÉS DE CONFIRMARSE. El drenado no vacía nada: el ' +
    'profesional verá para siempre un pendiente que ya está a salvo.');
  assert.equal(r.quedan, 0);

  // 4) ...Y EL CONTADOR BAJA. Es el ÚNICO sitio donde el profesional ve que funcionó.
  const despues = await b.ctx.pendientesDeSubir();
  assert.equal(despues.n, 0,
    '🔴 EL CONTADOR NO BAJA. Para el profesional no ha pasado nada: sigue viendo que le queda una ' +
    'firma por subir aunque el servidor ya la tenga.');
  assert.equal(despues.texto, null);
});

// ── 🔴 CONTROL NEGATIVO: LA RED SIGUE CAÍDA ───────────────────────────────────────────────

test('SCRUM-358 · 🔴 con la red aún caída el drenado NO vacía la cola ni marca ③', async () => {
  const b = montarAlmacen(RAIZ);
  await sembrar(b, [ALBARAN_ID]);

  const subidor = subidorQue({ porDefecto: new Error('fallo de red') });
  const r = await b.ctx.drenarFirmasPendientes(subidor.fn, { plazoMs: 500 });

  assert.equal(r.subidas, 0,
    '🔴 se cuenta como subida una firma que no llegó al servidor.');
  assert.equal(r.quedan, 1,
    '🔴 LA FIRMA HA DESAPARECIDO DE LA COLA SIN CONFIRMACIÓN. Es una firma perdida, y esta vez sin ' +
    'nadie detrás que la reintente: el drenado era el último que la tenía.');
  assert.equal(r.fallidas.length, 1, '🔴 el fallo no se registra: se estaría saltando en silencio.');
  assert.equal(r.fallidas[0].clave, b.ctx.claveDeFirma(ALBARAN_ID),
    '🔴 el fallo no dice CUÁL firma falló.');

  // Y el estado del albarán sigue sin ser ③.
  const cola = await b.ctx.leerFirmasPendientes();
  assert.equal(b.ctx.estadoDeLaFirmaDelAlbaran(ALBARAN_ID, true, cola.firmas),
    b.ctx.FIRMA_SOLO_EN_ESTE_MOVIL,
    '🔴 el albarán se pinta como «A salvo» con su firma todavía en la cola.');
});

test('SCRUM-358 · 🔴 un PORTAL CAUTIVO no vacía la cola: 200 con HTML no es confirmación', async () => {
  const b = montarAlmacen(RAIZ);
  await sembrar(b, [ALBARAN_ID]);

  const subidor = subidorQue({ porDefecto: '<!doctype html><html><body>Acceso Wi-Fi' });
  const r = await b.ctx.drenarFirmasPendientes(subidor.fn, { plazoMs: 500 });

  assert.equal(r.subidas, 0);
  assert.equal(r.quedan, 1,
    '🔴 la pantalla de acceso de un router ha pasado por confirmación y la firma se ha borrado.');
});

// ── 🔴 CONTROL NEGATIVO 2: DOS DRENADOS, UNA SOLA FIRMA ───────────────────────────────────

test('SCRUM-358 · 🔴 drenar dos veces la misma firma NO produce dos firmas: el 409 la para', async () => {
  const b = montarAlmacen(RAIZ);
  await sembrar(b, [ALBARAN_ID]);

  // Primer drenado: sube y confirma.
  const primero = subidorQue({ porDefecto: { id: ALBARAN_ID, estado: 'firmado' } });
  await b.ctx.drenarFirmasPendientes(primero.fn, { plazoMs: 500 });
  assert.equal(primero.llamadas.length, 1);

  // Segundo drenado: la cola ya está vacía, así que NO se vuelve a pedir nada.
  const segundo = subidorQue({ porDefecto: { id: ALBARAN_ID, estado: 'firmado' } });
  const r2 = await b.ctx.drenarFirmasPendientes(segundo.fn, { plazoMs: 500 });
  assert.equal(segundo.llamadas.length, 0,
    '🔴 SE HA VUELTO A ENVIAR UNA FIRMA QUE YA ESTABA SUBIDA. El cliente firmó una vez y el ' +
    'servidor recibiría dos peticiones.');
  assert.equal(r2.quedan, 0);

  // Y EL CASO QUE DE VERDAD IMPORTA: la firma se quedó en la cola porque la respuesta se perdió,
  // pero el servidor SÍ la tenía. Al reintentar responde 409 `albaran_locked`.
  await sembrar(b, [ALBARAN_ID]);
  const tercero = subidorQue({ porDefecto: error409() });
  const r3 = await b.ctx.drenarFirmasPendientes(tercero.fn, { plazoMs: 500 });

  assert.equal(r3.yaEstaban, 1,
    '🔴 un 409 `albaran_locked` se está tratando como fallo. Significa que el servidor YA TIENE la ' +
    'firma: si no sale de la cola, no saldrá nunca — cada apertura reintentará, cada reintento dará ' +
    '409, y el contador le dirá al profesional que tiene pendiente algo que lleva semanas a salvo.');
  assert.equal(r3.quedan, 0, '🔴 la firma que el servidor ya tiene sigue en la cola.');
  assert.equal(r3.subidas, 0, '🔴 se cuenta como subida por nosotros algo que ya estaba.');
});

test('SCRUM-358 · 🔴 un 409 que NO es `albaran_locked` sí es un fallo', () => {
  // El detector no puede aflojar por el código de estado: `invalid_transition` también es 409 y
  // significa que el albarán ni siquiera está emitido — la firma NO está a salvo.
  const b = montarAlmacen(RAIZ);
  assert.equal(b.ctx.elServidorYaLaTiene(error409()), true);

  const otro = new Error('Emite el albarán antes de firmarlo.');
  otro.status = 409; otro.code = 'invalid_transition';
  assert.equal(b.ctx.elServidorYaLaTiene(otro), false,
    '🔴 cualquier 409 se está tomando por «ya firmado». `invalid_transition` significa que el ' +
    'albarán no está emitido: sacar esa firma de la cola sería perderla.');

  const red = new Error('fallo de red');
  assert.equal(b.ctx.elServidorYaLaTiene(red), false);
  assert.equal(b.ctx.elServidorYaLaTiene(null), false);
});

// ── VARIAS FIRMAS: EL ORDEN, Y QUE UNA NO BLOQUEE A LAS DEMÁS ─────────────────────────────

test('SCRUM-358 · 🔴 una firma que falla NO bloquea a las demás, y NO se salta en silencio', async () => {
  const b = montarAlmacen(RAIZ);
  await sembrar(b, [10, 11, 12]);

  const subidor = subidorQue({
    10: { id: 10, estado: 'firmado' },
    11: new Error('fallo de red'),      // la del medio falla
    12: { id: 12, estado: 'firmado' },
  });
  const r = await b.ctx.drenarFirmasPendientes(subidor.fn, { plazoMs: 500 });

  assert.equal(subidor.llamadas.length, 3,
    `🔴 sólo se intentaron ${subidor.llamadas.length} de 3: una que falla está cortando el drenado ` +
    'y las siguientes no subirían nunca.');
  assert.equal(r.subidas, 2);
  assert.equal(r.quedan, 1, '🔴 debería quedar exactamente la que falló.');
  assert.equal(r.fallidas.length, 1,
    '🔴 la que falló NO se registra: se estaría saltando en silencio, que es lo que prohíbe el ticket.');
  assert.equal(r.fallidas[0].clave, b.ctx.claveDeFirma(11));

  const cola = await b.ctx.leerFirmasPendientes();
  assert.deepEqual([...cola.firmas].map((f) => f.albaranId), [11],
    '🔴 la que quedó en la cola no es la que falló.');
});

test('SCRUM-358 · 🔴 una que NO RESPONDE tampoco bloquea: el drenado se rinde y sigue', { timeout: 8000 }, async () => {
  // Sin límite esto se colgaría para siempre: el POST de firmar no tiene plazo (SCRUM-459) y
  // contra «acepta y no entrega» la petición no vuelve NUNCA. Es el caso real del bloque, y sin
  // rendirse «una que falle no bloquea a las otras» sería mentira.
  const b = montarAlmacen(RAIZ);
  await sembrar(b, [10, 11]);

  const subidor = subidorQue({
    10: () => new Promise(() => {}),    // no vuelve jamás
    11: { id: 11, estado: 'firmado' },
  });

  // 🔴 EL TEST LLEVA SU PROPIO TOPE, y no es ceremonia: si el drenado deja de rendirse, sin esto
  // el fichero entero se queda colgado hasta que alguien lo mate desde fuera —medido: 60 s— y el
  // rojo llega como «test failed» sin decir qué. Aquí cae en 2 s diciendo exactamente qué se rompió.
  const r = await Promise.race([
    b.ctx.drenarFirmasPendientes(subidor.fn, { plazoMs: 120 }),
    new Promise((_r, rechazar) => {
      const t = setTimeout(() => rechazar(new Error(
        '🔴 EL DRENADO SE HA COLGADO EN UNA FIRMA QUE NO RESPONDE. El POST de firmar no tiene ' +
        'plazo, así que contra una red que acepta y no entrega esa petición no vuelve nunca: sin ' +
        'rendirse, las demás firmas del profesional NO SUBEN JAMÁS y nadie lo sabe.')), 2000);
      if (t.unref) t.unref();
    }),
  ]);

  assert.equal(subidor.llamadas.length, 2,
    '🔴 EL DRENADO SE HA COLGADO EN LA PRIMERA. Las demás firmas del profesional no subirían ' +
    'jamás, y nadie lo sabría.');
  assert.equal(r.subidas, 1);
  assert.equal(r.quedan, 1);
  assert.equal(r.fallidas[0].motivo, 'no respondió a tiempo');

  // Y la que no respondió NO se ha desencolado: rendirse no puede costar una firma.
  const cola = await b.ctx.leerFirmasPendientes();
  assert.deepEqual([...cola.firmas].map((f) => f.albaranId), [10]);
});

test('SCRUM-358 · el orden es la MÁS ANTIGUA primero, y sin marca va delante', () => {
  const b = montarAlmacen(RAIZ);
  const orden = (fs_) => [...b.ctx.ordenDeDrenado(fs_)].map((f) => f.claveIdempotencia);

  assert.deepEqual(orden([
    { claveIdempotencia: 'c', encoladaEn: 300 },
    { claveIdempotencia: 'a', encoladaEn: 100 },
    { claveIdempotencia: 'b', encoladaEn: 200 },
  ]), ['a', 'b', 'c'], '🔴 no se ordena por antigüedad.');

  // Sin marca va PRIMERO: sólo puede venir de una versión anterior a esta fase, así que lleva más
  // tiempo en riesgo que cualquiera con marca. Tratarla como la más nueva la dejaría siempre la
  // última — justo la que peor lo tiene.
  assert.deepEqual(orden([
    { claveIdempotencia: 'nueva', encoladaEn: 100 },
    { claveIdempotencia: 'vieja' },
  ]), ['vieja', 'nueva'], '🔴 una firma sin `encoladaEn` se está tratando como la más reciente.');

  // Y el orden es estable con empate, o el test de arriba no podría afirmar nada.
  assert.deepEqual(orden([
    { claveIdempotencia: 'b', encoladaEn: 100 },
    { claveIdempotencia: 'a', encoladaEn: 100 },
  ]), ['a', 'b'], '🔴 el orden no es estable con empate.');
});

// ── 🔴 EL SUELO DE LA COLA ────────────────────────────────────────────────────────────────

test('SCRUM-358 · 🔴 si no se puede LEER la cola, el drenado NO dice «nada pendiente»', async () => {
  // «Cola vacía» y «no supe mirarla» son la misma pantalla y significan lo contrario, y aquí el
  // segundo le está diciendo al profesional que está todo a salvo.
  const b = montarAlmacen(RAIZ, { sinIndexedDB: true });
  const subidor = subidorQue({ porDefecto: { id: 1 } });
  const r = await b.ctx.drenarFirmasPendientes(subidor.fn, { plazoMs: 200 });

  assert.notEqual(r.quedan, 0,
    '🔴 SE REPORTA LA COLA VACÍA SIN HABER PODIDO MIRARLA. Es la pantalla que tranquiliza a un ' +
    'profesional que tiene una firma sin subir.');
  assert.equal(r.quedan, null);
  assert.equal(r.estado, b.ctx.NO_DISPONIBLE,
    '🔴 no se distingue «no hay almacén» de «el drenado fue bien».');
  assert.equal(subidor.llamadas.length, 0,
    '🔴 se ha intentado subir algo sin haber podido leer la cola.');

  // Y el contador sigue diciendo que no lo sabe, no que no hay nada.
  const contador = await b.ctx.pendientesDeSubir();
  assert.equal(contador.sabemos, false);
  assert.equal(contador.texto, b.ctx.TEXTO_NO_SE_PUDO_COMPROBAR);
});

// ── EL CABLEADO REAL ──────────────────────────────────────────────────────────────────────

test('SCRUM-358 · 🔴 la aplicación DRENA al abrirse, y repinta el contador', async () => {
  // Mencionar no es hacer: que `drenarFirmasPendientes` exista no prueba que nadie la dispare.
  const src = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/app.js'), 'utf8');
  assert.match(src, /window\.drenarAlAbrir\(\)/,
    '🔴 NADIE DRENA AL ABRIR LA APLICACIÓN. La cola no se vaciaría nunca, y el aviso de SCRUM-356 ' +
    'volvería a prometer algo que no ocurre.');

  // Y que el repintado del contador está DENTRO del drenado, no confiado a quien llame.
  const b = montarAlmacen(RAIZ, { dashboard: { red: redNormal({ id: ALBARAN_ID, estado: 'firmado' }) } });
  await sembrar(b, [ALBARAN_ID]);

  const caja = b.mk('div');
  caja.id = 'home-firmas-pendientes';
  await b.ctx.pintarFirmasPendientesEnHome();
  assert.ok(String(caja.innerHTML).includes('Te queda 1 firma por subir'),
    '🔴 el aviso no se pintó antes de drenar: el descenso no probaría nada.');

  await b.ctx.drenarAlAbrir();

  assert.equal(String(caja.innerHTML), '',
    '🔴 EL AVISO SIGUE EN PANTALLA DESPUÉS DE VACIAR LA COLA. El contador es el único sitio donde ' +
    'el profesional ve que el drenado funcionó: si no se mueve, para él no ha pasado nada.');
});

test('SCRUM-358 · el drenado al abrir NO lanza aunque no haya almacén', async () => {
  // Cerrar la cola no puede tumbar el arranque del dashboard.
  const b = montarAlmacen(RAIZ, { sinIndexedDB: true });
  await b.ctx.drenarAlAbrir();   // si lanza, el test cae solo
});

test('SCRUM-358 · 🔴 la firma que se sube lleva SOLO lo que el servidor acepta', () => {
  // `claveIdempotencia`, `albaranId` y `encoladaEn` son NUESTROS: el endpoint de firmar no los
  // acepta —medido en `albaranes.routes.ts:639-703`— y `claveIdempotencia` es del ALTA, no de la
  // firma. Metérsela sería tocar el sellado.
  const b = montarAlmacen(RAIZ);
  let enviado = null;
  b.ctx.apiRequest = async (_ruta, opciones) => { enviado = JSON.parse(opciones.body); return {}; };

  b.ctx.subirFirmaDeLaCola({
    claveIdempotencia: 'firma:albaran:42', albaranId: 42, encoladaEn: 1234,
    signatureData: 'data:image/png;base64,AAAA', firmadoPorNombre: 'Aurora', firmadoPorCalidad: 'cliente',
  });

  assert.deepEqual(Object.keys(enviado).sort(),
    ['firmadoPorCalidad', 'firmadoPorNombre', 'signatureData'],
    `🔴 se está enviando al camino de firma algo que no es suyo: ${JSON.stringify(Object.keys(enviado))}`);
});
