// tests/scrum460-precarga-al-movil.test.mjs — SCRUM-460 (H1 · fase 3)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA VÍCTIMA: no se crean albaranes sin red, solo se firman. Si el albarán no bajó, **no hay nada
// que firmar**.
//
// 🔴 Y LOS NÚMEROS DE PRODUCCIÓN (10-ago-2026) CAMBIAN QUÉ ES EL CASO NORMAL: 42 trabajos, **0
// agendados hoy o mañana**, **1 tocado en los últimos 7 días**. La precarga bajaría como mucho UN
// albarán en toda la producción. **La unión vacía deja de ser el caso raro.** Por eso el suelo no
// es una formalidad de cierre: es el corazón de este fichero, y se distinguen TRES cosas —
// «no había nada», «no supe mirar» y «precargué N»— y no dos.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { redNormal, aceptaYNoEntrega, corteAMediaSubida } from './_banco-red.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (c) => todos(c).map((n) => n.textContent).filter(Boolean).join(' | ');

const ALBARAN_PRECARGADO = {
  id: 77, numero: 'ALB-2026-077', estado: 'emitido',
  fecha: '2026-08-10T09:00:00.000Z', fechaEntrega: null, lugarEntrega: 'C/ Mayor 14',
  modoValoracion: 'SIN_VALORAR',
  lineas: [{ concepto: 'Sustituir bajante de PVC', cantidad: 1, unidad: 'ud' }],
  notas: null, jobId: 500, jobTitulo: 'Baño Los Olivos',
  clienteNombre: 'Comunidad Los Olivos',
};

/**
 * Un IndexedDB de mentira, lo justo para que el almacén de SCRUM-455 confirme sus transacciones.
 *
 * ⚠️ **Confirma con `oncomplete`, no al lanzar**, que es la regla entera de aquel fichero: un banco
 * que resolviera al llamar a `put` daría por buena una escritura que no confirmó, y entonces este
 * test aprobaría justo el defecto que 455 existe para impedir.
 */
function indexedDBFalso({ contenido = [], rompeAlEscribir = false } = {}) {
  const almacenes = { albaranesPrecargados: [...contenido], firmasPendientes: [] };
  const tx = (nombres) => {
    const t = { oncomplete: null, onabort: null, onerror: null, _fallo: false };
    t.objectStore = (n) => ({
      put: (v) => {
        if (rompeAlEscribir) { t._fallo = true; return {}; }
        almacenes[n] = almacenes[n].filter((x) => x.id !== v.id).concat([v]);
        return {};
      },
      clear: () => { almacenes[n] = []; return {}; },
      getAll: () => {
        const req = { onsuccess: null, onerror: null, result: almacenes[n] };
        setTimeout(() => req.onsuccess && req.onsuccess(), 0);
        return req;
      },
    });
    setTimeout(() => {
      if (t._fallo) { if (t.onabort) t.onabort(); else if (t.onerror) t.onerror(); }
      else if (t.oncomplete) t.oncomplete();
    }, 0);
    return t;
  };
  return {
    _almacenes: almacenes,
    open: () => {
      const req = { onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null, result: null };
      setTimeout(() => {
        req.result = {
          objectStoreNames: { contains: (n) => n in almacenes },
          transaction: (nombres) => tx(nombres),
          close() {},
        };
        if (req.onsuccess) req.onsuccess();
      }, 0);
      return req;
    },
  };
}

function banco({ red = redNormal({}), contenido = [], rompeAlEscribir = false } = {}) {
  const b = cargarDashboard(RAIZ, { red });
  b.ctx.indexedDB = indexedDBFalso({ contenido, rompeAlEscribir });
  return b;
}

// ═══ ① EL CONTROL POSITIVO, Y ES EL TEST: modo avión + albarán precargado ════════════════

test('SCRUM-460 · en modo avión, un albarán PRECARGADO se abre ENTERO', async () => {
  const red = corteAMediaSubida(); // la petición sale y el cliente muere: modo avión de verdad
  const b = banco({ red, contenido: [ALBARAN_PRECARGADO] });
  const c = b.mk('div');
  await b.ctx.renderAlbaranDetailView(c, 77);
  await new Promise((r) => setTimeout(r, 30));

  // SUELO: si la petición no hubiera salido, esto no estaría midiendo el camino sin red.
  assert.ok(red.seEjercio(), `🔴 BANCO CIEGO: no se pidió nada (${red.describir()}).`);

  const texto = leer(c);
  assert.match(texto, /ALB-2026-077/,
    `🔴 sin red, el albarán precargado NO se abre: ${texto}. Es el punto entero del bloque H — el ` +
    'profesional está en el sótano y lo único que necesita es que se lo firmen.');
  assert.match(texto, /Comunidad Los Olivos/,
    '🔴 se abre pero SIN EL CLIENTE. Firmar el albarán equivocado en una obra es un error caro, y ' +
    'un rail que dice «Cliente —» no identifica nada. (El paquete lo trae PLANO por minimización ' +
    '—`clienteNombre`— y el rail lee `alb.customer.name`: hay que traducirlo.)');
  assert.match(texto, /Baño Los Olivos/,
    '🔴 se abre sin decir de qué TRABAJO es.');
  assert.match(texto, /Firmar aquí mismo/,
    '🔴 se abre pero sin el botón de firmar, que es lo único a lo que ha venido.');

  // ⚠️ LAS LÍNEAS NO SE AFIRMAN EN PANTALLA, Y NO ES UNA OMISIÓN: **esta pantalla no las pinta**
  // —las delega al Trabajo (`btnEditarLineas`)—, medido al escribir este test. Mi primera versión
  // afirmaba que salían y el rojo era MÍO. Lo que sí tiene que ser cierto es que VIAJEN, porque son
  // el contenido que la firma sella.
  const guardado = b.ctx.indexedDB._almacenes.albaranesPrecargados[0];
  assert.equal(guardado.lineas[0].concepto, 'Sustituir bajante de PVC',
    '🔴 el albarán viaja sin sus líneas: es el contenido que la firma sella.');
});

// ═══ ② EL CONTROL NEGATIVO: sin red y SIN precarga, se dice ══════════════════════════════

test('SCRUM-460 · sin red y SIN precargar, se avisa — ni pantalla en blanco ni formulario vacío', async () => {
  const red = corteAMediaSubida();
  const b = banco({ red, contenido: [] }); // no hay nada precargado
  const c = b.mk('div');
  await b.ctx.renderAlbaranDetailView(c, 77);
  await new Promise((r) => setTimeout(r, 30));

  const texto = leer(c);
  assert.ok(texto.trim().length > 0,
    '🔴 la pantalla se ha quedado EN BLANCO. Callar no informa, y aquí encima invita a reintentar.');
  assert.match(texto, /PENDIENTE microcopy oficial · albarán no precargado/,
    `🔴 sin red y sin precarga no se dice nada útil: ${texto}.`);
  // Y lo que NO puede pasar: que se pinte el documento como si estuviera cargado.
  assert.ok(!/ALB-2026-077|Sustituir bajante/.test(texto),
    '🔴 se pinta el albarán sin tenerlo: un formulario vacío que invita a firmar algo que no está.');
});

// ═══ ③ LOS TRES RESULTADOS, QUE ES EL CORAZÓN DEL TICKET ═════════════════════════════════

test('SCRUM-460 · «precargué N» — y N se puede ver', async () => {
  const b = banco({ red: redNormal({ estado: 'LISTA', albaranes: [ALBARAN_PRECARGADO], trabajos: {} }) });
  const r = await b.ctx.precargarAlbaranes();
  assert.equal(r.estado, b.ctx.PRECARGADO, `🔴 no se precargó: ${JSON.stringify(r)}`);
  assert.equal(r.n, 1, `🔴 el recuento no se puede ver: ${JSON.stringify(r)}`);
  assert.equal(b.ctx.indexedDB._almacenes.albaranesPrecargados.length, 1,
    '🔴 dice haber precargado y el almacén está vacío: es el defecto que SCRUM-455 existe para impedir.');
});

test('SCRUM-460 · «no había nada que precargar» se dice, y NO es un fallo', async () => {
  // 🔴 CON LOS DATOS DE PRODUCCIÓN DE HOY ÉSTE ES EL CASO NORMAL, no el raro: 0 agendados hoy o
  // mañana y 1 trabajo tocado en la última semana.
  const b = banco({ red: redNormal({ estado: 'LISTA', albaranes: [], trabajos: {} }) });
  const r = await b.ctx.precargarAlbaranes();
  assert.equal(r.estado, b.ctx.NADA_QUE_PRECARGAR,
    `🔴 «no había nada» sale como otra cosa: ${JSON.stringify(r)}. Es cierto y hay que decirlo, y ` +
    'decirlo DISTINTO de «no supe mirar»: al profesional las dos lo dejan igual, en el sótano.');
  assert.equal(r.n, 0);
  assert.notEqual(r.estado, b.ctx.NO_SE_PUDO, '🔴 se ha colapsado con el fallo.');
});

test('SCRUM-460 · SUELO: si no se pudo mirar, se dice DISTINTO de «no había nada»', async () => {
  const red = aceptaYNoEntrega();
  const b = banco({ red });
  b.ctx.PLAZO_RED_MS = 5; // el plazo de SCRUM-451 corta y `apiRequest` rechaza
  const r = await b.ctx.precargarAlbaranes();

  assert.equal(r.estado, b.ctx.NO_SE_PUDO,
    `🔴 no se pudo pedir el paquete y el resultado dice ${r.estado}. «No había nada» y «no supe ` +
    'mirar» dejan al profesional EXACTAMENTE IGUAL: en el sótano, sin albarán, creyendo que iba ' +
    'preparado. Tienen que distinguirse.');
  assert.ok(r.motivo, '🔴 se declara NO_SE_PUDO sin decir por qué.');
  assert.notEqual(r.estado, b.ctx.NADA_QUE_PRECARGAR, '🔴 se ha colapsado con el vacío legítimo.');
});

test('SCRUM-460 · guardar A MEDIAS es «no se pudo», no «precargué algunos»', async () => {
  // El profesional que lea «precargado» y le falte justo el albarán que iba a firmar está PEOR que
  // si no le hubiéramos dicho nada.
  const b = banco({
    red: redNormal({ estado: 'LISTA', albaranes: [ALBARAN_PRECARGADO], trabajos: {} }),
    rompeAlEscribir: true,
  });
  const r = await b.ctx.precargarAlbaranes();
  assert.equal(r.estado, b.ctx.NO_SE_PUDO,
    `🔴 la escritura no confirmó y el resultado dice ${r.estado}. Una escritura se da por buena ` +
    'cuando la TRANSACCIÓN CONFIRMA, no cuando se lanza (SCRUM-455).');
});

// ═══ ④ QUE ESTA FASE NO ABRA UN AGUJERO EN LA DE AL LADO ═════════════════════════════════

test('SCRUM-460 · lo precargado DESAPARECE al cerrar sesión', async () => {
  // SCRUM-455 y 457 construyeron el purgado. Esta fase mete datos de clientes en el móvil: si el
  // logout dejara de llevárselos, habríamos abierto un agujero en el ticket de al lado.
  const b = banco({ red: redNormal({}), contenido: [ALBARAN_PRECARGADO] });
  assert.equal(b.ctx.indexedDB._almacenes.albaranesPrecargados.length, 1,
    '🔴 SUELO: no hay nada precargado que purgar, así que este test no mide nada.');

  await b.ctx.logout();
  assert.equal(b.ctx.indexedDB._almacenes.albaranesPrecargados.length, 0,
    '🔴 tras cerrar sesión sigue en el móvil el albarán precargado, con su cliente y sus líneas. ' +
    'Esta fase ha abierto un agujero en el purgado de SCRUM-455/457.');
});

// ═══ ⑤ CUÁNDO SE DISPARA — la decisión, no el detalle ════════════════════════════════════

test('SCRUM-460 · se precarga al arrancar Y al volver a la pestaña, no solo al arrancar', async () => {
  // Solo al arrancar sería pedirle al profesional que se acuerde de recargar antes de bajar al
  // sótano, que es justo lo que la política venía a evitar.
  const b = banco({ red: redNormal({ estado: 'LISTA', albaranes: [], trabajos: {} }) });
  assert.equal(typeof b.ctx.precargarSiTocaAhora, 'function',
    '🔴 no hay disparador de precarga publicado.');

  const primero = await b.ctx.precargarSiTocaAhora();
  assert.ok(primero, '🔴 el primer intento no ha corrido.');
  // Control negativo del acelerador: volver a la pestaña doce veces no son doce paquetes.
  const segundo = await b.ctx.precargarSiTocaAhora();
  assert.equal(segundo, null,
    '🔴 dos intentos seguidos han pedido el paquete dos veces. Volver a la pestaña es un gesto que ' +
    'un profesional hace decenas de veces al día.');
});
