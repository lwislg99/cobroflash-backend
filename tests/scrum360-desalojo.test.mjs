// tests/scrum360-desalojo.test.mjs — SCRUM-360 (H5 · fase 3)
//
// QUE iOS NO SE LLEVE UNA FIRMA EN SILENCIO.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA VÍCTIMA, Y POR QUÉ AHORA Y NO ANTES
//
// [MEDIDO en H0] WebKit borra **el origen entero** —service worker, Cache API e IndexedDB— tras
// **7 días** de usar Safari sin visitar el sitio. Los web apps añadidos a la pantalla de inicio
// están EXENTOS; una pestaña normal, no.
//
// Hasta ahora era teoría porque no había nada que perder. Ya lo hay: `firmasPendientes` guarda
// firmas de verdad (SCRUM-358 fase 2) y sólo se vacía al abrir la aplicación (fase 3). Un
// profesional que emite cada dos semanas, en una pestaña de Safari, **pierde una firma pendiente**
// — y no se entera él ni nos enteramos nosotros, porque esa firma nunca llegó a nuestro servidor.
//
// 🔴 HUECO QUE SE DECLARA ARRIBA DEL TODO: `fake-indexeddb` es un DOBLE. **No reproduce el desalojo
// real de WebKit ni una cuota agotada de verdad.** Lo que estos tests demuestran es que NUESTRO
// código detecta un almacén vaciado y distingue a quien perdió algo de quien nunca tuvo nada. Que
// iOS borre a los 7 días como dice la documentación es H7 y la matriz humana: lo prueba el fundador
// con un iPhone.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { montarAlmacen, porQueEstariaCiego } from './_banco-almacen-local.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CUERPO = Object.freeze({ signatureData: 'data:image/png;base64,AAAA', firmadoPorNombre: 'Aurora' });

/** Un `localStorage` de mentira que de verdad guarda, para que la marca signifique algo. */
function localStorageFalso(inicial = {}) {
  const m = new Map(Object.entries(inicial));
  return {
    _m: m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

/** Monta el dashboard con un `localStorage` que guarda y el `navigator.storage` que se pida. */
function montar(opciones = {}) {
  const b = montarAlmacen(RAIZ, opciones.almacen || {});
  b.ctx.localStorage = opciones.localStorage || localStorageFalso();
  if (opciones.storage === null) delete b.ctx.navigator.storage;
  else b.ctx.navigator = { ...b.ctx.navigator, storage: opciones.storage };
  return b;
}

// ── 🔴 SUELO ───────────────────────────────────────────────────────────────────────────────

test('SCRUM-360 · 🔴 SUELO: el banco monta la pieza, o se declara CIEGO', () => {
  const b = montar();
  assert.equal(porQueEstariaCiego(b, RAIZ), null, '🔴 BANCO CIEGO (almacén).');
  for (const n of ['pedirPersistencia', 'estadoDePersistencia', 'detectarDesalojo',
    'hayEspacioParaOtraFirma', 'marcarQueHuboCola', 'huboColaAlgunaVez', 'olvidarQueHuboCola',
    'resistenciaAlArrancar']) {
    assert.equal(typeof b.ctx[n], 'function', `🔴 no está publicada \`${n}\`.`);
  }
  const rotos = b.fallos.filter((f) => f.fichero === 'js/resistenciaAlmacen.js');
  assert.deepEqual(rotos, [], '🔴 el fichero no carga: ' + JSON.stringify(rotos));
});

// ── ① PERSISTENCIA: SE PIDE Y SE MIRA LA RESPUESTA ────────────────────────────────────────

test('SCRUM-360 · 🔴 `persist()` se pide y SU RESPUESTA se registra, no se supone', async () => {
  // Pedirla y no mirar si nos la han dado no sirve de nada: un `false` significa que el navegador
  // PUEDE borrar la cola cuando quiera, y eso es un dato del producto.
  let pedido = 0;
  const concede = { persist: async () => { pedido += 1; return true; }, persisted: async () => true };
  const deniega = { persist: async () => { pedido += 1; return false; }, persisted: async () => false };

  const a = montar({ storage: concede });
  assert.equal(await a.ctx.pedirPersistencia(), a.ctx.PERSISTENTE);
  assert.ok(pedido > 0, '🔴 NO SE HA PEDIDO NADA: `persist()` no llegó a llamarse.');

  const c = montar({ storage: deniega });
  assert.equal(await c.ctx.pedirPersistencia(), c.ctx.NO_PERSISTENTE,
    '🔴 el navegador ha DENEGADO la persistencia y se está registrando como concedida. Ese «no» ' +
    'significa que puede borrar la cola cuando quiera.');
  assert.equal(await c.ctx.estadoDePersistencia(), c.ctx.NO_PERSISTENTE);
});

test('SCRUM-360 · 🔴 sin la API, «no se sabe» NO es «no persistente»', async () => {
  // Son cosas distintas: uno dice que el navegador puede borrar, el otro que no hemos podido
  // preguntar. Colapsarlos es la lección de la fase 1, que existe justo por esto.
  const b = montar({ storage: null });
  assert.equal(await b.ctx.pedirPersistencia(), b.ctx.ALMACEN_NO_SE_SABE);
  assert.equal(await b.ctx.estadoDePersistencia(), b.ctx.ALMACEN_NO_SE_SABE);
  assert.notEqual(b.ctx.ALMACEN_NO_SE_SABE, b.ctx.NO_PERSISTENTE);
  assert.notEqual(b.ctx.ALMACEN_NO_SE_SABE, b.ctx.PERSISTENTE);
});

// ── ② 🔴 EL CONTROL QUE DECIDE SI ESTO SIRVE ──────────────────────────────────────────────

test('SCRUM-360 · 🔴 un profesional NUEVO no recibe aviso de pérdida — y el que perdió, SÍ', async () => {
  // ESTE es el test que decide si el mecanismo sirve. Un usuario nuevo también arranca con el
  // almacén vacío; si no se distinguen, le diríamos que ha perdido trabajo el día que se registra.
  // Un aviso que grita en falso se ignora, y entonces no avisa del bueno.
  const nuevo = montar();
  const sinNada = await nuevo.ctx.detectarDesalojo();
  assert.equal(sinNada.estado, nuevo.ctx.SIN_PERDIDA,
    '🔴 SE LE ESTÁ DICIENDO A UN PROFESIONAL NUEVO QUE HA PERDIDO ALGO. Nunca guardó nada: su ' +
    'almacén está vacío porque acaba de llegar, no porque se lo hayan borrado.');

  // CONTROL POSITIVO DENTRO DEL MISMO TEST: se siembra la cola, se simula el desalojo vaciando el
  // almacén, y AHORA sí tiene que avisar. Un almacén vacío hace verdad cualquier «no hay nada que
  // avisar», así que sin esta mitad el test de arriba no probaría nada.
  const b = montar();
  await b.ctx.encolarFirma(42, CUERPO);
  assert.equal((await b.ctx.leerFirmasPendientes()).firmas.length, 1, '🔴 la siembra no llegó.');
  assert.equal(b.ctx.huboColaAlgunaVez(), true,
    '🔴 encolar NO deja la marca: sin ella, un desalojo se lleva la cola Y la prueba de que existió.');

  // 🔴 EL DESALOJO, SIMULADO COMO OCURRE DE VERDAD — y la primera versión de este test lo hacía
  // mal. Quitaba `indexedDB` del contexto, y entonces el código respondía «no se sabe»… con razón:
  // no poder abrir el almacén NO es que esté vacío. Pero WebKit **no le quita IndexedDB al
  // navegador**: borra los datos del origen. La API sigue ahí y la base se recrea VACÍA.
  //
  // Se simula montando un banco nuevo —IndexedDB limpio— y conservando el MISMO `localStorage`,
  // que es donde vive la marca. Ése es exactamente el estado en el que queda el móvil.
  const trasElBorrado = montar({ localStorage: b.ctx.localStorage });
  assert.equal((await trasElBorrado.ctx.leerFirmasPendientes()).firmas.length, 0,
    '🔴 la simulación del desalojo no deja el almacén vacío: no estaría probando nada.');
  assert.equal(trasElBorrado.ctx.huboColaAlgunaVez(), true,
    '🔴 la marca no ha sobrevivido al banco nuevo: sin ella no hay nada que detectar.');

  const tras = await trasElBorrado.ctx.detectarDesalojo();
  assert.equal(tras.estado, b.ctx.POSIBLE_PERDIDA,
    '🔴 SE HA PERDIDO UNA FIRMA SIN AVISAR. Había cola, el almacén ya no está, y el producto se ' +
    'queda callado: es el fallo mudo que todo el bloque H existe para evitar.');
});

test('SCRUM-360 · 🔴 con la cola LLENA no se avisa de pérdida: no se ha perdido nada', async () => {
  const b = montar();
  await b.ctx.encolarFirma(42, CUERPO);
  const r = await b.ctx.detectarDesalojo();
  assert.equal(r.estado, b.ctx.SIN_PERDIDA,
    '🔴 se avisa de pérdida con las firmas delante: el aviso saltaría en cada arranque.');
});

test('SCRUM-360 · 🔴 SUELO: si no se puede LEER la cola, no se afirma que se perdió', async () => {
  // «Vacía» y «no supe mirarla» son el mismo cero con significados opuestos. Y aquí equivocarse
  // asusta: diríamos que se ha perdido algo cuando lo único que pasa es que no hay almacén.
  const b = montar({ almacen: { sinIndexedDB: true } });
  b.ctx.marcarQueHuboCola();
  const r = await b.ctx.detectarDesalojo();
  assert.equal(r.estado, b.ctx.ALMACEN_NO_SE_SABE,
    '🔴 se afirma una pérdida sin haber podido leer la cola.');
  assert.notEqual(r.estado, b.ctx.POSIBLE_PERDIDA);
});

test('SCRUM-360 · el drenado OLVIDA la marca cuando la cola queda vacía de verdad', async () => {
  // Si no, el siguiente arranque avisaría de una pérdida que no hubo: la cola se vació porque las
  // firmas SUBIERON.
  const b = montar();
  await b.ctx.encolarFirma(42, CUERPO);
  assert.equal(b.ctx.huboColaAlgunaVez(), true);

  await b.ctx.drenarFirmasPendientes(async () => ({ id: 42, estado: 'firmado' }), { plazoMs: 500 });

  assert.equal(b.ctx.huboColaAlgunaVez(), false,
    '🔴 la marca sigue puesta con la cola vaciada por el drenado: el próximo arranque avisaría de ' +
    'una pérdida que no ha ocurrido.');
  assert.equal((await b.ctx.detectarDesalojo()).estado, b.ctx.SIN_PERDIDA);
});

// ── ③ EL ESPACIO ──────────────────────────────────────────────────────────────────────────

test('SCRUM-360 · 🔴 SUELO: si `estimate()` no contesta, NO se afirma que hay sitio', async () => {
  const b = montar({ storage: null });
  const r = await b.ctx.hayEspacioParaOtraFirma(0, 100000);
  assert.notEqual(r.estado, b.ctx.HAY_ESPACIO,
    '🔴 SE ESTÁ AFIRMANDO QUE HAY SITIO SIN HABERLO MIRADO.');
  assert.equal(r.estado, b.ctx.ALMACEN_NO_SE_SABE);

  // Y con un `estimate()` que devuelve basura, tampoco.
  const raro = montar({ storage: { estimate: async () => ({}) } });
  assert.equal((await raro.ctx.hayEspacioParaOtraFirma(0, 100000)).estado, raro.ctx.ALMACEN_NO_SE_SABE);
});

test('SCRUM-360 · ✅ CONTROL POSITIVO: con sitio dice que sí, y sin sitio dice que no', async () => {
  // Sin esta mitad, un detector que dijera «no se sabe» siempre pasaría el test de arriba.
  const holgado = montar({ storage: { estimate: async () => ({ quota: 500e6, usage: 1e6 }) } });
  assert.equal((await holgado.ctx.hayEspacioParaOtraFirma(3, 100000)).estado, holgado.ctx.HAY_ESPACIO);

  const apretado = montar({ storage: { estimate: async () => ({ quota: 1e6, usage: 999000 }) } });
  assert.equal((await apretado.ctx.hayEspacioParaOtraFirma(3, 100000)).estado, apretado.ctx.SIN_ESPACIO,
    '🔴 con 1 KB libre se dice que cabe otra firma de 100 KB.');
});

test('SCRUM-360 · 🔴 el TOPE de la cola manda aunque el disco esté vacío', async () => {
  // El tope no es sólo por espacio: 50 albaranes firmados sin subir son meses de trabajo sin
  // cobertura, y si se llega ahí el problema no es el disco, es que el drenado lleva sin funcionar
  // muchísimo tiempo.
  const b = montar({ storage: { estimate: async () => ({ quota: 500e6, usage: 0 }) } });
  assert.equal(b.ctx.TOPE_FIRMAS_EN_COLA, 50);

  const r = await b.ctx.hayEspacioParaOtraFirma(50, 100000);
  assert.equal(r.estado, b.ctx.SIN_ESPACIO,
    '🔴 se acepta la firma 51 con el tope en 50, y con el disco vacío nadie lo pararía.');
  assert.match(r.motivo, /tope/, '🔴 el motivo no dice que ha sido el tope y no el espacio.');

  // Justo por debajo del tope, sí cabe — o el tope estaría cortando de más.
  assert.equal((await b.ctx.hayEspacioParaOtraFirma(49, 100000)).estado, b.ctx.HAY_ESPACIO);
});

// ── EL CABLEADO Y LA MICROCOPY ────────────────────────────────────────────────────────────

test('SCRUM-360 · 🔴 la aplicación pide persistencia y mira el desalojo AL ARRANCAR', () => {
  // Mencionar no es hacer: que las funciones existan no prueba que nadie las dispare.
  const src = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/app.js'), 'utf8');
  assert.match(src, /window\.resistenciaAlArrancar\(\)/,
    '🔴 NADIE PIDE PERSISTENCIA NI MIRA SI SE HA PERDIDO ALGO al abrir la aplicación. Las piezas ' +
    'existirían y no las dispararía nadie.');
});

test('SCRUM-360 · ✅ `resistenciaAlArrancar` devuelve las dos medidas y NO lanza', async () => {
  const b = montar({ storage: { persist: async () => false, persisted: async () => false } });
  const r = await b.ctx.resistenciaAlArrancar();
  assert.equal(r.persistencia, b.ctx.NO_PERSISTENTE);
  assert.equal(r.desalojo.estado, b.ctx.SIN_PERDIDA);

  // Y sin nada de nada, tampoco lanza: esto informa, no puede tumbar el arranque.
  const pelado = montar({ storage: null, almacen: { sinIndexedDB: true } });
  const r2 = await pelado.ctx.resistenciaAlArrancar();
  assert.equal(r2.persistencia, pelado.ctx.ALMACEN_NO_SE_SABE);
});

test('SCRUM-360 · 🔴 esta fase NO trae microcopy: ni redactada ni con marcador', () => {
  // La primera versión dejó los dos textos como constantes con marcador `[PENDIENTE …]`, y el
  // trinquete de SCRUM-402 lo puso en rojo con el argumento correcto: «si el texto no está
  // aprobado, esa superficie no se pinta todavía». Aquí no hay pantalla que necesite decir nada,
  // así que era microcopy sin aprobar puesta para nada.
  //
  // Este guard impide que vuelva a entrar por la puerta de atrás mientras la fase siga sin pintar.
  const src = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/resistenciaAlmacen.js'), 'utf8');
  const soloCodigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  // ⚠️ El detector busca DOS cosas concretas y medibles, no «textos largos»: la primera versión
  // usaba `/'([^']{25,})'/` y `[^']` cruza saltos de línea, así que capturaba el CÓDIGO ENTERO
  // entre dos literales cortos y acusaba de microcopy a media función. Un detector que acusa en
  // falso no se corrige: se desactiva.
  assert.ok(!/PENDIENTE microcopy/.test(soloCodigo),
    '🔴 ha vuelto un marcador de microcopy al código. Un marcador entra cuando hay una pantalla ' +
    'que necesita decir algo YA; esta fase mide y devuelve, no pinta.');

  const publicadas = [...soloCodigo.matchAll(/^window\.(MSG_\w+|TEXTO_\w+|COPY_\w+)\s*=/gm)]
    .map((m) => m[1]);
  assert.deepEqual(publicadas, [],
    `🔴 esta fase publica textos para pintar: ${publicadas.join(', ')}. Si ha ganado una pantalla, ` +
    'la microcopy la aprueba el asesor (regla 30) y hay que decirlo aquí, no colarla.');

  // CONTROL POSITIVO DEL DETECTOR, dentro del mismo test: reconoce las dos cosas cuando están.
  assert.ok(/PENDIENTE microcopy/.test("const x = '[PENDIENTE microcopy oficial · algo]';"),
    '🔴 el detector no ve un marcador que tiene delante.');
  assert.equal([...'window.MSG_ALGO = MSG_ALGO;'.matchAll(/^window\.(MSG_\w+)\s*=/gm)].length, 1,
    '🔴 el detector no ve un texto publicado que tiene delante.');
});

test('SCRUM-360 · 🔴 la clave de la marca coincide con su constante, y está en el registro', () => {
  // La clave va como LITERAL en las tres llamadas porque el censo AST de SCRUM-457 resuelve
  // literales y con la constante se declaraba CIEGO. Este test es lo que impide que el literal y
  // la constante se separen sin que nadie lo note.
  const b = montar();
  const src = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/resistenciaAlmacen.js'), 'utf8');
  const literales = [...src.matchAll(/localStorage\.\w+\('([^']+)'/g)].map((m) => m[1]);

  assert.ok(literales.length >= 3,
    `🔴 ESCÁNER CIEGO: sólo veo ${literales.length} accesos a localStorage y hay tres.`);
  for (const l of literales) {
    assert.equal(l, b.ctx.MARCA_HUBO_COLA,
      `🔴 se usa la clave «${l}» y la constante dice «${b.ctx.MARCA_HUBO_COLA}». El registro de ` +
      'purgado de SCRUM-457 vigila la que está escrita: si divergen, la marca sobrevive al logout ' +
      'y el siguiente arranque avisa de una pérdida que no hubo.');
  }

  // Y está declarada en el registro que purga el logout.
  const almacen = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/almacenLocal.js'), 'utf8');
  assert.match(almacen, /yaqu_hubo_cola/,
    '🔴 la marca no está en `CLAVES_LOCALES`: no se purgaría al cerrar sesión, y como el logout SÍ ' +
    'vacía la cola, el siguiente arranque diría que se ha perdido algo que borramos nosotros.');
});
