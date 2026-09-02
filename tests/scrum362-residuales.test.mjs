// tests/scrum362-residuales.test.mjs — SCRUM-362 (H7) · los dos escenarios que faltaban
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// QUÉ CIERRA ESTE FICHERO, Y POR QUÉ ERAN EXACTAMENTE DOS
//
// El censo de los cinco escenarios automatizables del bloque H, medido contra `main`:
//
//   ① portal cautivo ......................... ya cubierto ×4 (362 ① · 356:150 · 358 ×2)
//   ② fallo del servidor ..................... 🔸 A MEDIAS  → lo cierra este fichero
//   ③ red intermitente / corte a media subida  ya cubierto (362 ③ · 460)
//   ④ muerte del proceso a media subida ...... ❌ NO        → su mitad automatizable, aquí
//   ⑤ idempotencia de la cola ................ ya cubierto ×3 (358-encolar:105/208 · drenado:169)
//
// Los tres cubiertos NO se rehacen. `4d93f916` está en `main` y es bueno.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ② POR QUÉ «YA HABÍA UN TEST DE SERVIDOR EN ERROR» NO BASTABA
//
// `scrum356:140` inyecta `async () => { throw new Error('500') }` en el subidor. Eso NO es un 500:
// es una excepción. El producto los trata **por sitios distintos** (`api.js:_pedir`):
//
//   · una excepción entra por el `catch` del `fetch` y sale marcada **`sinRed`**;
//   · un 500 de verdad **resuelve**, entra por `!res.ok`, se le lee el cuerpo, y sale con `status`,
//     `code` y `data` — y **SIN** `sinRed`.
//
// Y la marca no es cosmética: `sinRed` significa «espera a tener cobertura» y un 500 significa
// «esto no se arregla esperando» (SCRUM-404). Hasta ahora **ningún escenario del banco podía
// producir un 500**: los seis respondían `ok:true, status:200`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ④ ESTO NO SE LLAMA «MUERTE DEL PROCESO», Y NO ES UN MATIZ
//
// No se puede matar un proceso desde la tanda. Lo que sí se prueba —y es lo que le importa al
// profesional— es **DURABILIDAD DEL ALMACÉN**: tras una carga nueva SIN apagado limpio, la cola
// sigue completa y nada quedó tratado como enviado. Se monta con UN SOLO `IDBFactory` y DOS
// montajes del dashboard: el segundo es «abrir la app otra vez», con contexto JS nuevo y el mismo
// almacén físico. Entre los dos NO se drena, no se cierra y no se limpia nada: eso es lo abrupto.
//
// 🔴 Lo que NO queda cubierto y va declarado: que el SISTEMA OPERATIVO mate la app a media
// escritura, y que WebKit desaloje el origen a los 7 días. Eso es plan humano, no tanda.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IDBFactory } from 'fake-indexeddb';
import { montarAlmacen, porQueEstariaCiego } from './_banco-almacen-local.mjs';
import { corteAMediaSubida, falloDelServidor, redNormal } from './_banco-red.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALBARAN_ID = 77;
const CUERPO = Object.freeze({
  signatureData: 'data:image/png;base64,BBBB',
  firmadoPorNombre: 'Ramiro Sáez',
  firmadoPorCalidad: 'cliente',
});

/**
 * 🔴 NINGÚN ROJO PUEDE TARDAR 60 SEGUNDOS. «Un rojo que tarda un minuto y no dice nada no es un
 * rojo: es un cuelgue.» Ninguno de los escenarios de aquí cuelga —el 500 resuelve y el corte
 * rechaza—, pero el plazo va igual: si algún día uno empieza a colgarse, que lo diga en 3 s y
 * NOMBRANDO cuál era, en vez de comerse la tanda.
 */
function conPlazo(promesa, escenario, ms = 3000) {
  return Promise.race([
    promesa,
    new Promise((_r, rechazar) => {
      const t = setTimeout(() => rechazar(new Error(
        `🔴 el escenario «${escenario}» no volvió en ${ms} ms. No se espera que cuelgue: si lo `
        + 'hace, el escenario ya no es el que dice ser.')), ms);
      if (t.unref) t.unref();
    }),
  ]);
}

/** El intento de subida real: por `apiRequest`, como en el producto. */
const subirCon = (b) => () => b.ctx.apiRequest(`/admin/albaranes/${ALBARAN_ID}/firmar`, {
  method: 'POST',
  body: JSON.stringify(CUERPO),
});

/** El suelo, en una línea: si el escenario no llegó a ejercerse, nada de lo demás mide nada. */
function exigirQueSeEjercio(red) {
  assert.ok(red.seEjercio(),
    `🔴 BANCO CIEGO: el escenario «${red.nombre}» NO se ha ejercido — nadie le pidió nada `
    + `(${red.describir()}). «El producto aguanta» y «no supe montar el escenario» dan el mismo `
    + 'verde y significan lo contrario.');
}

// ═══ SUELO ════════════════════════════════════════════════════════════════════════════════

test('SCRUM-362 · SUELO: el banco monta el camino de firma, o se declara CIEGO', () => {
  const b = montarAlmacen(RAIZ);
  const ciego = porQueEstariaCiego(b, RAIZ);
  assert.equal(ciego, null, `🔴 BANCO CIEGO (almacén): ${ciego}`);
  for (const n of ['firmarConRedDeSeguridad', 'leerFirmasPendientes', 'pendientesDeSubir',
    'claveDeFirma', 'apiRequest']) {
    assert.equal(typeof b.ctx[n], 'function',
      `🔴 no está publicada \`${n}\`: todo lo de abajo mediría el vacío.`);
  }
});

test('SCRUM-362 · SUELO: el escenario nuevo, sin usar, se declara CIEGO', () => {
  const red = falloDelServidor();
  assert.equal(red.seEjercio(), false,
    '🔴 un escenario recién fabricado, sin que nadie le pida nada, se declara ejercido. Entonces '
    + 'el suelo no distingue «lo probé» de «no lo probé».');
  assert.match(red.describir(), /^0 petición/);
  assert.equal(red.rechazadas(), 0);
});

// ═══ ② FALLO DEL SERVIDOR ═════════════════════════════════════════════════════════════════

test('SCRUM-362 · ② el banco SABE producir un 500 — y antes no podía', async () => {
  // El agujero literal: los seis escenarios de `_banco-red.mjs` respondían `ok:true, status:200`.
  const red = falloDelServidor(500);
  const res = await conPlazo(red.fetch('/admin/x', {}), red.nombre);
  assert.equal(res.ok, false, '🔴 el escenario de fallo del servidor devuelve `ok:true`.');
  assert.equal(res.status, 500);
  assert.equal(res.statusText, 'Internal Server Error', '🔴 el `statusText` está inventado.');
  exigirQueSeEjercio(red);
  assert.equal(red.rechazadas(), 1);
  assert.match(red.describir(), /1 rechazadas por el servidor/);
});

test('SCRUM-362 · 🔴 ② un 500 NO se marca `sinRed`: no es «espera a tener cobertura»', async () => {
  // ESTE es el test que la inyección de un `throw` no podía dar. Recorre `apiRequest` de verdad,
  // así que entra por la rama `!res.ok` de `_pedir` — la que lee el cuerpo y compone el error.
  const red = falloDelServidor(500, { error: 'internal_error', message: 'Algo ha fallado.' });
  const b = montarAlmacen(RAIZ, { dashboard: { red } });

  const error = await conPlazo(subirCon(b)().then(
    () => null,
    (e) => e,
  ), red.nombre);

  exigirQueSeEjercio(red);
  assert.ok(error, '🔴 un 500 NO ha producido error: el producto lo está tragando como si fuera un éxito.');
  assert.notEqual(error.sinRed, true,
    '🔴 UN 500 SALE MARCADO COMO FALLO DE RED. Al profesional se le diría «espera a tener '
    + 'cobertura» cuando lo que pasa es que el servidor lo rechazó, y eso no se arregla esperando '
    + '(SCRUM-404). Es justo la distinción que un `throw` inyectado no puede comprobar.');
  assert.equal(error.status, 500, '🔴 el error no lleva el `status`: quien decida por código no puede.');
  assert.equal(error.code, 'internal_error', '🔴 el error no lleva el `code` del cuerpo.');
  assert.equal(error.message, 'Algo ha fallado.',
    '🔴 no gana el mensaje humano del cuerpo (SCRUM-151): se le enseñaría un identificador interno.');
});

test('SCRUM-362 · 🔴 ② con el servidor en 500 la firma SE QUEDA EN LA COLA', async () => {
  // El camino del producto que este escenario recorre: `firmarConRedDeSeguridad` → encola primero,
  // sube después. Un 500 no es confirmación, así que la firma no puede salir de la cola.
  const red = falloDelServidor(500);
  const b = montarAlmacen(RAIZ, { dashboard: { red } });

  const r = await conPlazo(
    b.ctx.firmarConRedDeSeguridad(ALBARAN_ID, CUERPO, subirCon(b)), red.nombre);

  exigirQueSeEjercio(red);
  assert.equal(r.estado, b.ctx.FIRMA_SOLO_EN_ESTE_MOVIL,
    `🔴 con el servidor en 500 el estado es «${r.estado}». Sólo una confirmación del servidor `
    + 'puede decir «a salvo»: el profesional se iría de la obra creyendo que el albarán subió.');
  const cola = await b.ctx.leerFirmasPendientes();
  assert.equal(cola.firmas.length, 1,
    '🔴 LA FIRMA NO ESTÁ EN LA COLA tras un 500. El servidor la rechazó y el móvil tampoco la '
    + 'tiene: se ha perdido.');
  assert.equal(cola.firmas[0].albaranId, ALBARAN_ID);
});

test('SCRUM-362 · ② un 500 cuyo cuerpo NO es JSON tampoco revienta el producto', async () => {
  // El 500 que pinta un proxy en HTML y nunca llega a nuestro servidor: `res.json()` explota, y
  // `_pedir` tiene que sobrevivir a eso y componer el error igual.
  const red = falloDelServidor(502, '<html><body>502 Bad Gateway</body></html>');
  const b = montarAlmacen(RAIZ, { dashboard: { red } });

  const error = await conPlazo(subirCon(b)().then(() => null, (e) => e), red.nombre);

  exigirQueSeEjercio(red);
  // 🔴 ESTA LÍNEA SE AÑADIÓ PORQUE LA MUTACIÓN NO DABA ROJO. Sin ella, quitar el `throw` de
  // `json()` —o sea, dejar de modelar el cuerpo no-JSON— dejaba el test en verde: las otras
  // aserciones se cumplen igual con un cuerpo que sí parsea. El test decía «no JSON» en el título
  // y no comprobaba esa mitad. `cuerposEntregados` sólo sube cuando un `json()` ENTREGA.
  assert.equal(red.reg.cuerposEntregados, 0,
    '🔴 el cuerpo se ha entregado como JSON: entonces este escenario NO es el del 502 en HTML y '
    + 'el test está midiendo otra cosa distinta de la que dice su nombre.');
  assert.ok(error, '🔴 un 502 con cuerpo HTML no ha producido error.');
  assert.notEqual(error.sinRed, true, '🔴 un 502 sale marcado como fallo de red.');
  assert.equal(error.status, 502);
  assert.equal(error.code, null, '🔴 sin cuerpo JSON no puede haber `code`: se lo está inventando.');
  assert.match(error.message, /502/, '🔴 el mensaje no dice ni el código: no se puede diagnosticar nada.');
});

// ═══ ④ DURABILIDAD DEL ALMACÉN (la mitad automatizable) ═══════════════════════════════════

test('SCRUM-362 · 🔴 ④ tras una CARGA NUEVA sin apagado limpio, la cola sigue COMPLETA', async () => {
  // UN solo almacén físico, DOS montajes. El segundo es «abrir la app otra vez».
  const almacen = new IDBFactory();
  const red = corteAMediaSubida();

  // ── Vida 1: se firma y la subida se corta a media subida. Nadie limpia nada después.
  const b1 = montarAlmacen(RAIZ, { indexedDB: almacen, dashboard: { red } });
  const r1 = await conPlazo(
    b1.ctx.firmarConRedDeSeguridad(ALBARAN_ID, CUERPO, subirCon(b1)), red.nombre);

  exigirQueSeEjercio(red);
  assert.equal(r1.encolada, true,
    '🔴 la firma NO llegó a encolarse en la primera vida. Sin eso, «la cola sobrevive» sería '
    + 'cierto de una cola vacía: el test pasaría sin haber probado nada.');
  const antes = await b1.ctx.leerFirmasPendientes();
  assert.equal(antes.firmas.length, 1, '🔴 el suelo: en la primera vida la cola tiene que tener la firma.');
  const claveOriginal = antes.firmas[0].claveIdempotencia;

  // ⚠️ AQUÍ NO SE HACE NADA MÁS. Ni drenar, ni cerrar, ni purgar: eso ES el apagado abrupto.

  // ── Vida 2: contexto JS nuevo, mismo almacén. Como abrir la app después de que muriera.
  const b2 = montarAlmacen(RAIZ, { indexedDB: almacen });
  assert.notEqual(b2.ctx, b1.ctx, '🔴 no es un contexto nuevo: no se está simulando una carga nueva.');

  const despues = await b2.ctx.leerFirmasPendientes();
  assert.equal(despues.firmas.length, 1,
    `🔴 LA COLA NO SOBREVIVE A UNA CARGA NUEVA: tenía 1 firma y ahora tiene `
    + `${despues.firmas.length}. El profesional firmó, la app murió, y la firma no está en ningún `
    + 'sitio — ni en el servidor, que nunca la confirmó, ni en el móvil.');
  assert.equal(despues.firmas[0].claveIdempotencia, claveOriginal,
    '🔴 la firma que sobrevive NO es la misma: la clave ha cambiado.');
  assert.equal(despues.firmas[0].signatureData, CUERPO.signatureData,
    '🔴 sobrevive la entrada pero NO el trazo. Una firma sin trazo no es una firma.');
  assert.equal(despues.firmas[0].firmadoPorNombre, CUERPO.firmadoPorNombre);
});

test('SCRUM-362 · 🔴 ④ y NADA quedó tratado como enviado', async () => {
  // «Marcado como enviado» aquí es literal: en este diseño la cola NO tiene campo de estado — la
  // marca de enviado es SALIR de la cola (`quitarFirmaPendiente`, y sólo con confirmación del
  // servidor). Así que «nada se dio por enviado» se comprueba mirando que sigue dentro Y que el
  // contador que ve el profesional la sigue contando.
  const almacen = new IDBFactory();
  const red = corteAMediaSubida();

  const b1 = montarAlmacen(RAIZ, { indexedDB: almacen, dashboard: { red } });
  const r1 = await conPlazo(
    b1.ctx.firmarConRedDeSeguridad(ALBARAN_ID, CUERPO, subirCon(b1)), red.nombre);
  exigirQueSeEjercio(red);
  assert.equal(r1.estado, b1.ctx.FIRMA_SOLO_EN_ESTE_MOVIL,
    '🔴 un corte a media subida ha devuelto «a salvo». El servidor pudo recibirla o no, y eso no '
    + 'es una confirmación.');

  const b2 = montarAlmacen(RAIZ, { indexedDB: almacen });
  const pendientes = await b2.ctx.pendientesDeSubir();
  // `pendientesDeSubir` devuelve `{n, sabemos, texto}`, y `sabemos` es el suelo de SCRUM-356: un
  // 0 porque la cola no se pudo leer y un 0 de verdad NO pueden dar la misma respuesta. Aquí se
  // exigen los dos: que sepa, y que cuente.
  assert.equal(pendientes.sabemos, true,
    '🔴 tras la carga nueva el contador NO SABE cuántas hay. Eso no es «ninguna»: es que no pudo '
    + 'leer la cola, y con la firma dentro es el peor momento posible para no saberlo.');
  assert.equal(pendientes.n, 1,
    `🔴 tras la carga nueva el contador dice ${pendientes.n} pendientes. Si dice 0, al profesional `
    + 'se le está diciendo que no tiene nada que subir mientras su firma sigue sin llegar: es la '
    + 'mentira que el bloque H entero existe para impedir.');
  assert.match(String(pendientes.texto), /1 firma/,
    '🔴 el texto que ve el profesional no nombra la firma que sigue pendiente.');

  // Y la entrada no lleva ninguna marca de enviada que alguien pudiera haber dejado a medias.
  const cola = await b2.ctx.leerFirmasPendientes();
  const claves = Object.keys(cola.firmas[0]).sort();
  assert.deepEqual(claves, ['albaranId', 'claveIdempotencia', 'encoladaEn', 'firmadoPorCalidad',
    'firmadoPorNombre', 'signatureData'],
    `🔴 la entrada de la cola tiene campos que no puso \`encolarFirma\`: ${claves.join(', ')}. Si `
    + 'alguien ha añadido una marca de estado, este test tiene que enterarse: una firma «medio '
    + 'enviada» que sobrevive a la muerte del proceso es exactamente el estado que no puede existir.');
});

// ═══ CONTROL NEGATIVO ═════════════════════════════════════════════════════════════════════

test('SCRUM-362 · CONTROL NEGATIVO: con red normal la firma sube y la cola queda VACÍA', async () => {
  // Sin esto, los de arriba podrían estar pasando porque el camino de firma no funciona NUNCA.
  const almacen = new IDBFactory();
  const red = redNormal({ ok: true });
  const b1 = montarAlmacen(RAIZ, { indexedDB: almacen, dashboard: { red } });

  const r = await conPlazo(
    b1.ctx.firmarConRedDeSeguridad(ALBARAN_ID, CUERPO, subirCon(b1)), red.nombre);

  exigirQueSeEjercio(red);
  assert.equal(r.estado, b1.ctx.FIRMA_A_SALVO,
    '🔴 con red normal la firma NO llega a «a salvo»: el camino feliz está roto y los escenarios '
    + 'de fallo de arriba no significan nada.');

  // Y sobrevive vacía: la durabilidad no puede resucitar una firma ya confirmada.
  const b2 = montarAlmacen(RAIZ, { indexedDB: almacen });
  const despues = await b2.ctx.leerFirmasPendientes();
  assert.equal(despues.firmas.length, 0,
    '🔴 una firma CONFIRMADA reaparece en la cola tras recargar: se subiría dos veces.');
});

/** Las operaciones de DISCO de una pasada. Sin reloj: el mismo número con la máquina llena. */
async function midiendoElDisco(fn) {
  let n = 0;
  const claves = ['readFileSync', 'existsSync', 'readdirSync', 'lstatSync', 'statSync'];
  const guardadas = {};
  for (const k of claves) {
    guardadas[k] = fs[k];
    fs[k] = (p, ...resto) => { n++; return guardadas[k](p, ...resto); };
  }
  try { await fn(); } finally { for (const k of claves) fs[k] = guardadas[k]; }
  return n;
}

test('SCRUM-362 · CONTROL NEGATIVO: el escenario nuevo no añade COSTE al banco', async () => {
  // 🔴 ESTO MEDÍA RELOJ DE PARED —`ms < 8000` sobre cinco pasadas reales— y era uno de los dos
  // últimos de su familia (los censó SCRUM-671; SCRUM-351 y scrum642 fueron los anteriores).
  // Su propio comentario ya citaba a SCRUM-351, que es de donde salió el número.
  //
  // El hecho que quería sostener NO es «tarda menos de 8 s»: es que **el banco sea barato**,
  // porque uno que se nota en la tanda se desactiva y entonces no comprueba nada. Y «barato» se
  // puede CONTAR: lo caro sería que el escenario nuevo hiciera MÁS TRABAJO que el de siempre.
  //
  // Medido: 143 operaciones de disco por pasada, idénticas en los dos escenarios. Se afirma la
  // COMPARACIÓN y no un absoluto — un absoluto caducaría en cuanto otra rama añadiera un
  // `<script>` al dashboard, que es trabajo legítimo y no un encarecimiento de este banco.
  //
  // ⚠️ CALENTAMIENTO A PROPÓSITO: la primerísima carga paga la resolución de módulos (+2 ops,
  // medidas) y ese coste no es del escenario. Sin descartarla, la primera pasada saldría 145.
  montarAlmacen(RAIZ, {});

  const pasada = (hacerRed) => midiendoElDisco(async () => {
    const red = hacerRed();
    const b = montarAlmacen(RAIZ, { dashboard: { red } });
    await conPlazo(subirCon(b)().then(() => null, (e) => e), red.nombre);
  });

  const nuevas = [];
  for (let i = 0; i < 5; i++) nuevas.push(await pasada(() => falloDelServidor(500)));
  const normales = [];
  for (let i = 0; i < 3; i++) normales.push(await pasada(() => redNormal({ ok: true })));

  // SUELO: si el contador no ve NADA, lo de abajo compara dos ceros y no mide nada.
  assert.ok(nuevas[0] > 0,
    '🔴 el contador de disco no ha visto ni una operación, y el banco acaba de montar el '
    + 'dashboard entero. Está ciego: «cero» y «no supe mirar» no son el mismo número.');

  assert.ok(nuevas.every((x) => x === nuevas[0]),
    `🔴 el coste CRECE entre pasadas: ${JSON.stringify(nuevas)}. Algo se acumula de una a `
    + 'otra, y un banco que engorda acaba notándose en la tanda y lo desactiva alguien.');

  assert.equal(nuevas[0], normales[0],
    `🔴 el escenario NUEVO cuesta ${nuevas[0]} operaciones de disco y el de siempre `
    + `${normales[0]}. Añade trabajo, y un banco que se nota en la tanda se desactiva — `
    + 'que es exactamente lo que este control negativo existe para impedir.');
});

// ═══ QUE EL ESCENARIO NUEVO SEA DISTINGUIBLE ══════════════════════════════════════════════

test('SCRUM-362 · 🔴 el fallo del servidor NO se confunde con el corte a media subida', async () => {
  // Los dos acaban en «solo en este móvil» y en la cola. Si su huella de red fuera igual, el
  // escenario nuevo sería decoración: no distinguiría nada que no distinguiera ya el ③.
  const quinientos = falloDelServidor(500);
  const corte = corteAMediaSubida();
  await conPlazo(quinientos.fetch('/x', {}), quinientos.nombre);
  await conPlazo(corte.fetch('/x', {}).then(() => null, () => null), corte.nombre);

  assert.equal(quinientos.reg.resueltas, 1, '🔴 el 500 no cuenta como resuelta: un 500 SÍ vuelve.');
  assert.equal(quinientos.reg.fallidas, 0, '🔴 el 500 se cuenta como fallo de red.');
  assert.equal(corte.reg.fallidas, 1, '🔴 el corte no cuenta como fallida.');
  assert.equal(corte.reg.resueltas, 0, '🔴 el corte se cuenta como resuelta: entonces son el mismo escenario.');
  assert.notEqual(quinientos.nombre, corte.nombre);
});
