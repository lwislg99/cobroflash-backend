// tests/scrum358-encolar-firma.test.mjs — SCRUM-358 (H3 · fase 2)
//
// ENCOLAR UNA FIRMA QUE NO HA PODIDO SUBIR.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LO QUE FALTABA, Y POR QUÉ ESTE FICHERO ES EL PRIMERO QUE RECORRE EL CAMINO ENTERO
//
// El almacén existe (SCRUM-455) y los tres estados existen (SCRUM-356), pero **nadie escribía en
// `firmasPendientes`**. Aquí se cierra: se firma contra el banco de red de SCRUM-362, con el
// dashboard montado y por el `apiRequest` de verdad, y se mira dónde acaba la firma.
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

/**
 * 🔴 NINGÚN TEST PUEDE COLGARSE, y aquí no es una precaución genérica: el `POST` de firmar **no
 * tiene plazo** —el de SCRUM-451 cubre sólo GET a propósito, porque abortar una mutación puede
 * duplicar una factura—, así que contra «acepta y no entrega» esa petición no vuelve nunca. Es el
 * escenario que este ticket existe para cubrir, y el que colgó una tanda 240 s escribiendo H2.
 *
 * El plazo es DEL TEST, no del producto: que el POST no lo tenga es SCRUM-459, otro carril.
 */
function conPlazo(promesa, ms = 3000, queEsperaba = 'la operación') {
  return Promise.race([
    promesa,
    new Promise((_r, rechazar) => {
      const t = setTimeout(() => rechazar(new Error(
        `🔴 ${queEsperaba} no volvió en ${ms} ms. El POST de firmar no tiene plazo (SCRUM-459): ` +
        'contra una red que acepta y no entrega, esa petición no vuelve NUNCA.')), ms);
      if (t.unref) t.unref();
    }),
  ]);
}

/**
 * Espera a que la cola tenga `n` entradas, o se rinde con su motivo.
 *
 * 🔴 ESTA FUNCIÓN ES EL TICKET ENTERO. Contra «acepta y no entrega» la promesa de la firma **no
 * resuelve nunca** —el POST no tiene plazo—, así que un test que la esperase se colgaría. Y eso no
 * es un obstáculo: es la demostración. Lo que hay que medir no es qué devuelve la firma, sino que
 * **la firma ya está a salvo mientras la petición sigue colgada**. Ésa es la ventana en la que el
 * pro cierra la app y, con el orden contrario, la firma se perdía.
 */
async function esperarEnLaCola(b, n, ms = 2000) {
  const hasta = Date.now() + ms;
  let ultima = null;
  while (Date.now() < hasta) {
    const cola = await b.ctx.leerFirmasPendientes();
    ultima = cola.firmas ? cola.firmas.length : null;
    if (ultima === n) return cola;
    await new Promise((r) => { const t = setTimeout(r, 20); if (t.unref) t.unref(); });
  }
  assert.fail(
    `🔴 la cola tiene ${ultima} entrada(s) y se esperaban ${n} tras ${ms} ms. Si es 0, UNA FIRMA ` +
    'SE HA PERDIDO: el servidor no la recibió y la cola tampoco la tiene.');
  return null;
}

/** Monta el dashboard con la red que se pida y devuelve el contexto. */
function conRed(red) {
  const b = montarAlmacen(RAIZ, { dashboard: { red } });
  b.ctx.PLAZO_RED_MS = 60;   // los 10 s reales no interesan aquí; que corte, sí
  return b;
}

/** El intento de subida real: por `apiRequest`, como en el producto. */
const subirCon = (b) => () => b.ctx.apiRequest(`/admin/albaranes/${ALBARAN_ID}/firmar`, {
  method: 'POST',
  body: JSON.stringify(CUERPO),
});

// ── 🔴 SUELO ───────────────────────────────────────────────────────────────────────────────

test('SCRUM-358 · 🔴 SUELO: el banco monta el productor, o se declara CIEGO', () => {
  const b = montarAlmacen(RAIZ);
  const ciego = porQueEstariaCiego(b, RAIZ);
  assert.equal(ciego, null, `🔴 BANCO CIEGO (almacén): ${ciego}`);

  for (const n of ['claveDeFirma', 'encolarFirma', 'firmarConRedDeSeguridad',
    'quitarFirmaPendiente', 'leerFirmasPendientes', 'pendientesDeSubir']) {
    assert.equal(typeof b.ctx[n], 'function',
      `🔴 no está publicada \`${n}\`: todo lo de abajo mediría el vacío.`);
  }
  const rotos = b.fallos.filter((f) => ['js/colaDeFirmas.js', 'js/estadoFirma.js',
    'js/almacenLocal.js', 'js/albaranDetailView.js'].includes(f.fichero));
  assert.deepEqual(rotos, [],
    '🔴 UN FICHERO DEL CAMINO NO CARGA:\n    ' +
    rotos.map((f) => `${f.fichero} — ${f.error} ${f.sitio || ''}`).join('\n    '));
});

// ── LA CLAVE ───────────────────────────────────────────────────────────────────────────────

test('SCRUM-358 · 🔴 la clave es DETERMINISTA: el mismo albarán da la misma clave', () => {
  const b = montarAlmacen(RAIZ);
  assert.equal(b.ctx.claveDeFirma(42), b.ctx.claveDeFirma(42),
    '🔴 dos llamadas dan claves distintas. Si la clave cambiara entre reintentos, cada intento ' +
    'dejaría una entrada nueva en la cola y el pro subiría su firma tantas veces como lo intentó.');
  assert.equal(b.ctx.claveDeFirma(42), b.ctx.claveDeFirma('42'),
    '🔴 el mismo id como número y como texto da claves distintas: la API devuelve número y la cola ' +
    'guarda lo que le den.');
  assert.notEqual(b.ctx.claveDeFirma(42), b.ctx.claveDeFirma(43),
    '🔴 dos albaranes distintos comparten clave: uno pisaría la firma del otro.');
});

test('SCRUM-358 · 🔴 SUELO: sin id utilizable NO hay clave — y sin clave NO SE FIRMA', async () => {
  const b = montarAlmacen(RAIZ);
  for (const malo of [null, undefined, '', '   ', NaN]) {
    assert.equal(b.ctx.claveDeFirma(malo), null,
      `🔴 «${String(malo)}» produce una clave. Una firma que no se puede identificar no se puede ` +
      'desencolar, y una cola de la que no se puede sacar nada sube la misma firma para siempre.');
  }
  // Y el suelo de verdad: el camino de firma LANZA en vez de seguir adelante.
  await assert.rejects(
    () => b.ctx.firmarConRedDeSeguridad(null, CUERPO, async () => ({ id: 1 })),
    '🔴 SE ESTÁ FIRMANDO SIN CLAVE. Es el duplicado esperando a ocurrir del que hablaba el ' +
    '`keyPath` de SCRUM-455.');

  // CONTROL POSITIVO en el mismo test: con id bueno sí acuña, o el rechazo de arriba no probaría
  // que distingue — probaría que rechaza siempre.
  assert.ok(b.ctx.claveDeFirma(ALBARAN_ID));
});

// ── ✅ CONTROL POSITIVO 1 · EL CAMINO ENTERO SIN ENTREGA ───────────────────────────────────

test('SCRUM-358 · ✅ con «acepta y no entrega» la firma ACABA EN LA COLA y el contador la ve', async () => {
  const red = aceptaYNoEntrega();
  const b = conRed(red);

  // 🔴 NO se espera a que la firma resuelva: no va a resolver. El POST no tiene plazo y esta red
  // acepta la petición y no entrega el cuerpo nunca. Se lanza y se mira la cola — que es justo lo
  // que hace el profesional cuando cierra la aplicación cansado de esperar.
  const enVuelo = b.ctx.firmarConRedDeSeguridad(ALBARAN_ID, CUERPO, subirCon(b));
  enVuelo.catch(() => {});   // nadie la va a esperar; que no cuente como rechazo sin manejar

  const cola = await esperarEnLaCola(b, 1);

  assert.ok(red.seEjercio(), `🔴 el escenario NO OCURRIÓ: ${red.describir()}`);
  assert.equal(red.reg.cuerposEntregados, 0,
    '🔴 el escenario ha entregado cuerpo: entonces no es «acepta y no entrega» y este test estaría ' +
    'midiendo otra cosa.');
  assert.equal(cola.firmas[0].albaranId, ALBARAN_ID);
  assert.equal(cola.firmas[0].signatureData, CUERPO.signatureData,
    '🔴 el trazo no está dentro: la entrada de la cola no sirve para subir nada.');
  assert.equal(cola.firmas[0].firmadoPorNombre, 'Aurora Benítez',
    '🔴 el nombre del firmante no viajó a la cola, y el servidor lo exige al firmar.');

  const contador = await b.ctx.pendientesDeSubir();
  assert.equal(contador.n, 1);
  assert.equal(contador.texto, 'Te queda 1 firma por subir',
    '🔴 el contador de SCRUM-356 no ve la firma encolada.');
});

test('SCRUM-358 · ✅ con PORTAL CAUTIVO tampoco sube, y también acaba en la cola', async () => {
  // 200 con el HTML de la pantalla de acceso: `res.ok` es true y aun así no ha llegado nada.
  const red = portalCautivo();
  const b = conRed(red);

  const r = await conPlazo(
    b.ctx.firmarConRedDeSeguridad(ALBARAN_ID, CUERPO, subirCon(b)),
    3000, 'la firma contra el portal cautivo');

  assert.ok(red.seEjercio(), `🔴 el escenario NO OCURRIÓ: ${red.describir()}`);
  assert.equal(r.estado, b.ctx.FIRMA_SOLO_EN_ESTE_MOVIL);
  const cola = await b.ctx.leerFirmasPendientes();
  assert.equal(cola.firmas.length, 1, '🔴 UNA FIRMA SE HA PERDIDO con un portal cautivo.');
});

// ── ✅ CONTROL POSITIVO 2 · CON RED NORMAL NO QUEDA NADA ───────────────────────────────────

test('SCRUM-358 · ✅ con red normal la firma sube, se confirma Y NO QUEDA NADA EN LA COLA', async () => {
  // El que hace que el resto signifique algo: una cola que siempre acumula es tan defectuosa como
  // una que no guarda. Sin esto, todo lo de arriba lo cumpliría un productor que encolara y no
  // desencolara nunca.
  const red = redNormal({ id: ALBARAN_ID, estado: 'firmado' });
  const b = conRed(red);

  const r = await conPlazo(
    b.ctx.firmarConRedDeSeguridad(ALBARAN_ID, CUERPO, subirCon(b)),
    3000, 'la firma contra red normal');

  assert.equal(r.estado, b.ctx.FIRMA_A_SALVO,
    '🔴 ni con el servidor confirmando se llega a ③.');
  const cola = await b.ctx.leerFirmasPendientes();
  assert.deepEqual([...cola.firmas], [],
    '🔴 LA FIRMA SIGUE EN LA COLA DESPUÉS DE CONFIRMARSE. Queda un fantasma que se volverá a ' +
    'subir; lo para el 409 `albaran_locked` del servidor, pero el contador le dirá al profesional ' +
    'que tiene algo pendiente que ya está a salvo.');

  const contador = await b.ctx.pendientesDeSubir();
  assert.equal(contador.n, 0);
  assert.equal(contador.texto, null, '🔴 se pinta un aviso sin nada pendiente.');
});

// ── 🔴 CONTROL NEGATIVO · DOS INTENTOS, UNA ENTRADA ────────────────────────────────────────

test('SCRUM-358 · 🔴 dos intentos de la MISMA firma NO producen dos entradas', async () => {
  const red = aceptaYNoEntrega();
  const b = conRed(red);

  // Dos intentos del MISMO albarán, ninguno de los dos resolverá.
  b.ctx.firmarConRedDeSeguridad(ALBARAN_ID, CUERPO, subirCon(b)).catch(() => {});
  await esperarEnLaCola(b, 1);
  b.ctx.firmarConRedDeSeguridad(ALBARAN_ID, CUERPO, subirCon(b)).catch(() => {});

  // Se espera un poco a que el segundo encolado ocurra, y luego se exige que SIGA habiendo una.
  await new Promise((r) => { const t = setTimeout(r, 150); if (t.unref) t.unref(); });
  const cola = await b.ctx.leerFirmasPendientes();
  assert.equal(cola.firmas.length, 1,
    `🔴 DOS ENTRADAS PARA LA MISMA FIRMA (hay ${cola.firmas.length}). El pro reintentó y el ` +
    'producto subirá su firma dos veces. Lo impide que la clave sea DETERMINISTA: al ir en el ' +
    '`keyPath`, el segundo intento sobrescribe al primero en vez de añadirse.');

  // CONTROL POSITIVO DENTRO DEL MISMO TEST: otro albarán SÍ añade entrada, o «una sola» podría
  // estar diciendo que la cola no guarda más de una cosa.
  b.ctx.firmarConRedDeSeguridad(43, CUERPO, subirCon(b)).catch(() => {});
  await esperarEnLaCola(b, 2);
});

// ── 🔴 SUELO DEL ALMACÉN ───────────────────────────────────────────────────────────────────

test('SCRUM-358 · 🔴 sin almacén se sigue firmando, pero NO se dice que se guardó', async () => {
  // Decisión declarada: sin `firmasPendientes` el intento sigue —sin red de seguridad, como hoy—.
  // Lo que no puede pasar es que se reporte ③ sin confirmación, ni que se afirme que hay cola.
  //
  // Se usa el PORTAL CAUTIVO y no «acepta y no entrega»: aquí hay que mirar lo que DEVUELVE la
  // firma, y contra la segunda no devolvería nunca.
  const red = portalCautivo();
  const b = montarAlmacen(RAIZ, { sinIndexedDB: true, dashboard: { red } });
  b.ctx.PLAZO_RED_MS = 60;

  const r = await conPlazo(
    b.ctx.firmarConRedDeSeguridad(ALBARAN_ID, CUERPO, subirCon(b)),
    3000, 'la firma sin almacén');

  assert.equal(r.encolada, false,
    '🔴 se afirma que la firma quedó encolada sin almacén donde encolarla.');
  assert.notEqual(r.estado, b.ctx.FIRMA_A_SALVO,
    '🔴 SE ESTÁ REPORTANDO «A SALVO» sin almacén y sin confirmación del servidor.');
});

test('SCRUM-358 · ✅ y sin almacén, con red normal, la firma sube igual', async () => {
  // El otro lado de la misma decisión: no encolar no puede impedir firmar a quien hoy puede.
  const b = montarAlmacen(RAIZ, { sinIndexedDB: true, dashboard: { red: redNormal({ id: ALBARAN_ID }) } });
  const r = await conPlazo(
    b.ctx.firmarConRedDeSeguridad(ALBARAN_ID, CUERPO, subirCon(b)), 3000, 'la firma sin almacén');
  assert.equal(r.estado, b.ctx.FIRMA_A_SALVO,
    '🔴 sin almacén ya no se puede firmar: se ha impedido firmar a quien hoy puede, para ' +
    'protegerlo de un caso que sólo ocurre si además falla la red.');
});

// ── EL DESENCOLADO, POR SU CUENTA ──────────────────────────────────────────────────────────

test('SCRUM-358 · quitar una firma que no está NO es un fallo', async () => {
  // Desencolar dos veces es corriente en cuanto haya reintentos, y `delete` sobre una clave
  // ausente es válido en IndexedDB.
  const b = montarAlmacen(RAIZ);
  const r = await b.ctx.quitarFirmaPendiente('firma:albaran:9999');
  assert.equal(r.estado, b.ctx.GUARDADO);
});

test('SCRUM-358 · 🔴 el desencolado quita SOLO la suya', async () => {
  const b = montarAlmacen(RAIZ);
  await b.ctx.encolarFirma(42, CUERPO);
  await b.ctx.encolarFirma(43, CUERPO);
  await b.ctx.quitarFirmaPendiente(b.ctx.claveDeFirma(42));

  const cola = await b.ctx.leerFirmasPendientes();
  assert.equal(cola.firmas.length, 1, '🔴 el desencolado se ha llevado más de lo suyo.');
  assert.equal(cola.firmas[0].albaranId, 43,
    '🔴 se ha quitado la firma equivocada: la del 43 ha desaparecido y la del 42 sigue.');
});

// ── EL CABLEADO REAL ───────────────────────────────────────────────────────────────────────

test('SCRUM-358 · 🔴 el camino de firma de la VISTA pasa por la cola', () => {
  // Mencionar no es hacer: que `firmarConRedDeSeguridad` exista no prueba que el botón la use.
  const src = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/albaranDetailView.js'), 'utf8');
  assert.match(src, /firmarConRedDeSeguridad\(\s*alb\.id/,
    '🔴 EL BOTÓN DE FIRMAR NO PASA POR LA COLA. El productor existiría y nadie lo dispararía: ' +
    '`firmasPendientes` seguiría vacío pase lo que pase.');

  // Y SCRUM-404 no se ha roto por el camino: el error tiene que SEGUIR subiendo, o el pad cerraría
  // en silencio y el pro se iría creyendo que subió.
  assert.match(src, /throw new Error\(mensajeDeFalloAlFirmar\(resultado\.error\)\)/,
    '🔴 sin confirmación del servidor ya no se relanza el error. El pad cerraría, el trazo ' +
    'desaparecería de la pantalla y el profesional no sabría que su firma no ha subido — que es el ' +
    'fallo mudo que este bloque existe para evitar.');
});
