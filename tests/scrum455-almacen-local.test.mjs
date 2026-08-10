// tests/scrum455-almacen-local.test.mjs — SCRUM-455 (H1 · fase 1)
//
// EL ALMACÉN LOCAL Y SU PURGADO, EJERCITADOS.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA VÍCTIMA QUE ESTE FICHERO EXISTE PARA IMPEDIR
//
// Un fontanero firma un albarán en un sótano, el producto le dice que está guardado, y no lo está.
// Se va de la obra tranquilo y se entera tres semanas después, discutiendo con el cliente.
//
// De ahí sale la única regla que este fichero vigila de verdad: **una escritura se da por buena
// cuando la TRANSACCIÓN CONFIRMA, no cuando se lanza.**
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  montarAlmacen, porQueEstariaCiego, indexedDBQueAbortaTrasEscribir, cacheStorageFalsa,
} from './_banco-almacen-local.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FIRMA = Object.freeze({
  claveIdempotencia: '0f3d9c7a-1b2e-4a55-9c31-77e0a1b2c3d4',
  albaranId: 42,
  trazo: 'data:image/png;base64,AAAA',
  cliente: { nombre: 'Aurora Benítez', telefono: '+34600111222' },
});

const ALBARAN = Object.freeze({ id: 42, numero: 'ALB-2026-0042', cliente: { nombre: 'Aurora Benítez' } });

// ── 🔴 SUELO DEL BANCO ─────────────────────────────────────────────────────────────────────

test('SCRUM-455 · 🔴 SUELO: el banco MONTA el almacén, o se declara CIEGO', () => {
  const b = montarAlmacen(RAIZ);
  const ciego = porQueEstariaCiego(b, RAIZ);
  assert.equal(ciego, null,
    `🔴 BANCO CIEGO: ${ciego}\n\n  «Guardó bien» y «no supe montarlo» son el mismo verde. Todo lo ` +
    'que mide este fichero estaría midiendo el vacío.');
});

test('SCRUM-455 · 🔴 SUELO: la base abre y trae LOS DOS almacenes por su nombre', async () => {
  const b = montarAlmacen(RAIZ);
  const bd = await b.ctx.abrirAlmacen();
  const nombres = [...bd.objectStoreNames];
  bd.close();
  assert.deepEqual(nombres.sort(), ['albaranesPrecargados', 'firmasPendientes'],
    '🔴 los dos almacenes concretos no están. Sin ellos, «no queda ningún dato» sería cierto ' +
    'sobre algo que nunca existió.');
});

// ── ESCRIBIR, CERRAR, REABRIR, LEER ────────────────────────────────────────────────────────

test('SCRUM-455 · ✅ una firma escrita sobrevive a cerrar y reabrir la base', async () => {
  // El requisito entero del almacén: que el dato siga ahí cuando la aplicación se ha cerrado. Cada
  // llamada abre y cierra su propia conexión, así que esto es cerrar y reabrir de verdad.
  const b = montarAlmacen(RAIZ);

  const escrito = await b.ctx.guardarFirmaPendiente(FIRMA);
  assert.equal(escrito.estado, b.ctx.GUARDADO,
    `🔴 la escritura no confirmó: ${escrito.motivo || '(sin motivo)'}`);

  const leido = await b.ctx.leerFirmasPendientes();
  assert.equal(leido.estado, b.ctx.GUARDADO);
  assert.equal(leido.firmas.length, 1, '🔴 la firma no está tras reabrir.');
  assert.equal(leido.firmas[0].claveIdempotencia, FIRMA.claveIdempotencia);
  assert.equal(leido.firmas[0].cliente.nombre, 'Aurora Benítez',
    '🔴 el contenido no sobrevivió entero al viaje.');
});

test('SCRUM-455 · ✅ un albarán precargado sobrevive igual, y los dos almacenes no se pisan', async () => {
  const b = montarAlmacen(RAIZ);
  await b.ctx.guardarAlbaranPrecargado(ALBARAN);
  await b.ctx.guardarFirmaPendiente(FIRMA);

  const albaranes = await b.ctx.leerAlbaranesPrecargados();
  const firmas = await b.ctx.leerFirmasPendientes();
  assert.equal(albaranes.albaranes.length, 1);
  assert.equal(firmas.firmas.length, 1);
  assert.equal(albaranes.albaranes[0].numero, 'ALB-2026-0042');
});

// ── 🔴 EL SUELO QUE IMPORTA: NO DECIR QUE GUARDASTE ────────────────────────────────────────

test('SCRUM-455 · 🔴 sin IndexedDB NO se reporta éxito — se dice NO_DISPONIBLE', async () => {
  // Safari en navegación privada, permiso denegado, almacenamiento bloqueado por política. El
  // producto NO puede decir que guardó.
  const b = montarAlmacen(RAIZ, { sinIndexedDB: true });
  const r = await b.ctx.guardarFirmaPendiente(FIRMA);

  assert.notEqual(r.estado, b.ctx.GUARDADO,
    '🔴 SE ESTÁ REPORTANDO «GUARDADO» SIN ALMACÉN. Es el fontanero del sótano al que le dicen que ' +
    'su firma está a salvo cuando no se ha escrito en ninguna parte.');
  assert.equal(r.estado, b.ctx.NO_DISPONIBLE,
    '🔴 se reporta un fallo genérico donde el navegador directamente no da almacén: son cosas ' +
    'distintas y reintentar sólo tiene sentido en una de las dos.');
});

test('SCRUM-455 · 🔴 EL CORAZÓN: operación con éxito + transacción abortada = NO está guardado', async () => {
  // El escenario que este ticket existe para impedir, provocado de verdad: la petición dispara su
  // `success` y la transacción NO confirma. Un código que resolviera en `peticion.onsuccess` diría
  // GUARDADO sobre un dato que no está en disco.
  const idb = indexedDBQueAbortaTrasEscribir();
  const b = montarAlmacen(RAIZ, { indexedDB: idb });

  const r = await b.ctx.guardarFirmaPendiente(FIRMA);

  // SUELO DEL ESCENARIO: si no ocurrió, este test no probaría nada y pasaría por no haberse dado.
  assert.ok(idb._testigo.escriturasConExito > 0,
    '🔴 el escenario NO OCURRIÓ: la operación de escritura nunca llegó a tener éxito, así que no ' +
    'se ha ejercitado la diferencia entre «la operación fue bien» y «la transacción confirmó».');
  assert.ok(idb._testigo.transaccionesAbortadas > 0,
    '🔴 el escenario NO OCURRIÓ: ninguna transacción llegó a abortar.');

  assert.notEqual(r.estado, b.ctx.GUARDADO,
    '🔴 SE ESTÁ DANDO POR GUARDADO ALGO SIN CONFIRMAR. La operación tuvo éxito pero la transacción ' +
    'abortó: el dato NO está en disco. Resolver en `peticion.onsuccess` en vez de en ' +
    '`tx.oncomplete` es exactamente cómo el producto acaba diciéndole a un fontanero que su firma ' +
    'está guardada cuando no lo está.');
  assert.equal(r.estado, b.ctx.FALLO);
});

test('SCRUM-455 · 🔴 una firma SIN clave de idempotencia no entra en la cola', async () => {
  // Va en el `keyPath` a propósito (SCRUM-358): una firma sin clave es un duplicado esperando a
  // ocurrir en cuanto la cola reintente.
  const b = montarAlmacen(RAIZ);
  const r = await b.ctx.guardarFirmaPendiente({ albaranId: 42, trazo: 'x' });

  assert.notEqual(r.estado, b.ctx.GUARDADO,
    '🔴 ha entrado en la cola una firma sin `claveIdempotencia`. Al reintentar, el servidor no ' +
    'podría reconocerla como la misma y crearía un segundo albarán con otro número de serie.');

  const leido = await b.ctx.leerFirmasPendientes();
  assert.equal(leido.firmas.length, 0, '🔴 y además se quedó dentro.');
});

// ── LA VERSIÓN DEL ESQUEMA ─────────────────────────────────────────────────────────────────

test('SCRUM-455 · 🔴 subir de versión sin escribir el tramo NO pasa en silencio', () => {
  const b = montarAlmacen(RAIZ);

  // CONTROL POSITIVO, DENTRO DEL MISMO TEST: la instalación desde cero SÍ tiene tramo. Sin esto,
  // «faltan tramos» sería cierto también con un mecanismo que dijera que falta siempre.
  assert.deepEqual([...b.ctx.tramosQueFaltan(0, 1)], [],
    '🔴 la instalación desde cero se declara sin tramo: el almacén no se crearía nunca.');

  // Y EL NEGATIVO, con corpus sintético: hoy `VERSION_BD` es 1 y no existe ningún salto posible,
  // así que mirar sólo el salto real sería cierto sobre un conjunto vacío y verde para siempre.
  assert.deepEqual([...b.ctx.tramosQueFaltan(1, 2)], [1],
    '🔴 subir a la versión 2 sin escribir su tramo NO se está detectando. Un almacén cuyo número ' +
    'de versión sube sin camino de migración pierde datos en silencio, y lo que se perdería aquí ' +
    'son FIRMAS de un cliente que ya no está delante para volver a firmar.');
  assert.deepEqual([...b.ctx.tramosQueFaltan(1, 4)], [1, 2, 3],
    '🔴 no se enumeran todos los saltos sin tramo.');
});

test('SCRUM-455 · la versión declarada y los tramos escritos son coherentes', () => {
  const b = montarAlmacen(RAIZ);
  assert.equal(b.ctx.VERSION_BD, 1);
  assert.deepEqual([...b.ctx.tramosQueFaltan(0, b.ctx.VERSION_BD)], [],
    '🔴 se ha subido `VERSION_BD` y falta el tramo. Escríbelo antes de subirla: con el almacén ' +
    'vacío es gratis, después son firmas.');
});

// ── EL PURGADO DEL LOGOUT ──────────────────────────────────────────────────────────────────

test('SCRUM-455 · 🔴 CERRAR SESIÓN no deja ni un dato de cliente en el móvil', async () => {
  // Se ejercita `logout()` DE VERDAD, la de `app.js`, no el purgado por separado: lo que importa
  // no es que la función exista, es que el camino real de cerrar sesión pase por ella.
  const b = montarAlmacen(RAIZ, { caches: ['yaqu-v4'] });

  assert.equal(typeof b.ctx.logout, 'function',
    '🔴 `logout` no es alcanzable desde el banco: no se estaría ejercitando el camino real.');

  await b.ctx.guardarFirmaPendiente(FIRMA);
  await b.ctx.guardarAlbaranPrecargado(ALBARAN);

  // SUELO: si no hubiera nada guardado, «no queda nada» sería cierto y hueco.
  const antesFirmas = await b.ctx.leerFirmasPendientes();
  const antesAlbaranes = await b.ctx.leerAlbaranesPrecargados();
  assert.equal(antesFirmas.firmas.length, 1, '🔴 no había nada que purgar: el test no probaría nada.');
  assert.equal(antesAlbaranes.albaranes.length, 1, '🔴 no había nada que purgar.');
  assert.ok((await b.ctx.caches.keys()).includes('yaqu-v4'), '🔴 no había caché que purgar.');

  await b.ctx.logout();

  const firmas = await b.ctx.leerFirmasPendientes();
  const albaranes = await b.ctx.leerAlbaranesPrecargados();
  assert.equal(firmas.firmas.length, 0,
    '🔴 DESPUÉS DE CERRAR SESIÓN QUEDAN FIRMAS DE CLIENTES EN EL MÓVIL. Nombres, teléfonos y ' +
    'trazos en un aparato que se pierde, se vende o se comparte en la furgoneta. Art. 32 RGPD: es ' +
    'medida exigible, y el desalojo automático del navegador no es un mecanismo de borrado alegable.');
  assert.equal(albaranes.albaranes.length, 0,
    '🔴 quedan albaranes precargados —con nombre, dirección e importes— tras cerrar sesión.');
  assert.deepEqual(await b.ctx.caches.keys(), [],
    '🔴 la Cache API conserva las páginas y respuestas de la sesión anterior.');
});

test('SCRUM-455 · CONTROL NEGATIVO: se borra LO NUESTRO POR SU NOMBRE, no «todo»', async () => {
  // Un purgado que arrase con `caches.keys()` entero pasaría el test de arriba y sería incorrecto:
  // el origen puede alojar cachés que no son nuestras y borrarlas es efecto colateral, no higiene.
  const b = montarAlmacen(RAIZ);
  b.ctx.caches = cacheStorageFalsa(['yaqu-v4', 'yaqu-v5', 'workbox-precache-ajena', 'otra-cosa']);

  const r = await b.ctx.purgarDatosLocales();

  assert.deepEqual((await b.ctx.caches.keys()).sort(), ['otra-cosa', 'workbox-precache-ajena'],
    '🔴 el purgado está borrando cachés que NO son nuestras. Se borra por prefijo `yaqu-`, una a ' +
    'una y por su nombre; arrasar con todo lo que haya en el origen es efecto colateral.');
  assert.deepEqual([...r.caches].sort(), ['yaqu-v4', 'yaqu-v5'],
    '🔴 el purgado no informa de cuáles borró.');
  assert.deepEqual([...r.almacenes].sort(), ['albaranesPrecargados', 'firmasPendientes'],
    '🔴 el purgado no vació los dos almacenes por su nombre.');
});

test('SCRUM-455 · purgar dos veces seguidas no revienta', async () => {
  const b = montarAlmacen(RAIZ, { caches: ['yaqu-v4'] });
  await b.ctx.guardarFirmaPendiente(FIRMA);

  const primera = await b.ctx.purgarDatosLocales();
  const segunda = await b.ctx.purgarDatosLocales();

  assert.equal(primera.estado, b.ctx.GUARDADO);
  assert.equal(segunda.estado, b.ctx.GUARDADO,
    '🔴 el segundo purgado falla. Cerrar sesión dos veces, o hacerlo con la cola ya vacía, es un ' +
    'caso corriente y no puede dar error.');
  assert.deepEqual([...segunda.caches], [], '🔴 dice haber borrado cachés que ya no estaban.');
});

test('SCRUM-455 · 🔴 sin IndexedDB, cerrar sesión PURGA LA CACHÉ igual', async () => {
  // La Cache API puede estar disponible aunque IndexedDB no lo esté. Si el purgado colgara del
  // almacén, en navegación privada se cerraría sesión dejando las páginas cacheadas.
  const b = montarAlmacen(RAIZ, { sinIndexedDB: true, caches: ['yaqu-v4'] });
  const r = await b.ctx.purgarDatosLocales();

  assert.deepEqual(await b.ctx.caches.keys(), [],
    '🔴 sin IndexedDB no se está purgando la caché: el purgado cuelga del almacén y no debería.');
  assert.notEqual(r.estado, b.ctx.GUARDADO,
    '🔴 se reporta purgado completo cuando el almacén ni siquiera se pudo abrir.');
});

// ── QUE NADIE SE LO LLEVE AL NAVEGADOR ─────────────────────────────────────────────────────

test('SCRUM-455 · 🔴 `fake-indexeddb` NUNCA sale de tests/', () => {
  // El frontend es vanilla y sin bundler: un `import` de una dependencia de Node en `public/`
  // revienta el dashboard en el navegador. Es el final exacto de `exportView.js`. Y en `src/`
  // viajaría a producción como dependencia que sólo está en `devDependencies`.
  const sospechosos = [];
  (function recorrer(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { recorrer(p); continue; }
      if (!/\.(js|mjs|cjs|ts|html)$/.test(e.name)) continue;
      if (/fake-indexeddb/i.test(fs.readFileSync(p, 'utf8'))) {
        sospechosos.push(path.relative(RAIZ, p).replace(/\\/g, '/'));
      }
    }
  })(path.join(RAIZ, 'public'));
  (function recorrer(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { recorrer(p); continue; }
      if (!/\.(js|mjs|cjs|ts)$/.test(e.name)) continue;
      if (/fake-indexeddb/i.test(fs.readFileSync(p, 'utf8'))) {
        sospechosos.push(path.relative(RAIZ, p).replace(/\\/g, '/'));
      }
    }
  })(path.join(RAIZ, 'src'));

  assert.deepEqual(sospechosos, [],
    `🔴 «fake-indexeddb» aparece en ${sospechosos.join(', ')}. Es una dependencia de DESARROLLO: ` +
    'si llega a `public/` el dashboard deja de arrancar en el navegador, y si llega a `src/` viaja ' +
    'a producción declarada sólo en `devDependencies`.');

  // SUELO: el recorrido tiene que estar mirando ficheros de verdad. Con `public/` y `src/` vacíos,
  // «no aparece en ninguno» sería cierto y hueco.
  let vistos = 0;
  (function contar(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) contar(p); else if (/\.(js|mjs|cjs|ts|html)$/.test(e.name)) vistos += 1;
    }
  })(path.join(RAIZ, 'public'));
  assert.ok(vistos >= 50,
    `🔴 ESCÁNER CIEGO: el recorrido sólo ve ${vistos} ficheros en public/ y hay muchos más.`);
});
