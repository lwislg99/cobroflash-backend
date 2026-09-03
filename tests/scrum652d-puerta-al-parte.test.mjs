// tests/scrum652d-puerta-al-parte.test.mjs — SCRUM-652 (fase D) · QUE SE LLEGUE AL PARTE.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE ESTO CIERRA, Y POR QUÉ UN TEST DE EXISTENCIA NO LO HABRÍA VISTO
//
// `parteDetailView.js` llevaba desde la fase C **cargado en `index.html:312`** y sin una sola
// puerta: ni `case` en `renderView`, ni una llamada que lo abriera. El fichero existía, el
// service worker lo precargaba, sus 15 tests pasaban en verde — y el profesional no tenía por
// dónde entrar.
//
// > Un test que comprueba que el fichero existe no prueba nada: HOY existe y no se llega.
//
// Así que lo que se mide aquí es **alcanzabilidad**: qué vistas tienen a la vez un `case` que las
// pinta y algo que las abre (un botón del nav o una llamada a `renderAppView` desde otra vista).
// Una vista con `case` y sin entrada es exactamente el estado del parte antes de este ticket.
//
// ⚠️ ESTO NO ESTRENA LA IDEA, Y CONVIENE DECIRLO: `SCRUM-420 · ③` ya vigila que toda vista del
// router esté en la barra **o declarada** en `VISTAS_SIN_ENTRADA`. Lo que añade este fichero es
// la otra mitad: **una declaración es una promesa, y una llamada es un hecho**. Declarar
// «se llega desde el Trabajo» deja verde a SCRUM-420 aunque nadie llame nunca — aquí se
// comprueba que ALGO invoque `renderAppView('parte-detail')` de verdad, y que el botón de
// firmar tenga un escuchador detrás.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
// SCRUM-694: el filtro de comentarios NO se fabrica aquí. `soloCodigo` usa el escáner de
// TypeScript y distingue un `//` dentro de una cadena de uno que abre comentario; un regex a
// mano falla en los DOS sentidos — deja pasar una cadena escrita en un comentario y se come
// código real en cuanto un literal lleva dos barras. El trinquete de SCRUM-694 me cazó con
// esto mismo el 3-sep, y es la segunda vez.
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = path.join(RAIZ, 'public', 'dashboard', 'js');
const INDEX = path.join(RAIZ, 'public', 'dashboard', 'index.html');

/**
 * Sin comentarios, con el escáner de la casa. Se conserva el nombre local porque lo usan ocho
 * llamadas; lo que cambia es QUIÉN filtra: `_solo-codigo.mjs` en vez de un regex propio.
 */
function sinComentarios(txt) {
  return soloCodigo(txt, 'vista.js');
}

/** Las vistas que `renderView` sabe PINTAR. */
function vistasQueSePintan() {
  const app = sinComentarios(fs.readFileSync(path.join(JS, 'app.js'), 'utf8'));
  return new Set([...app.matchAll(/case\s+'([a-z0-9-]+)'\s*:/g)].map((m) => m[1]));
}

/**
 * Las vistas a las que ALGO lleva: un botón del nav (`data-view`) o una llamada desde cualquier
 * script del dashboard. `app.js` se excluye a propósito de las llamadas: su `renderView('team')`
 * interno es un alias, no una puerta para el profesional.
 */
function vistasALasQueSeLlega() {
  const destinos = new Set();

  const html = fs.readFileSync(INDEX, 'utf8');
  for (const m of html.matchAll(/data-view="([a-z0-9-]+)"/g)) destinos.add(m[1]);

  for (const f of fs.readdirSync(JS).filter((x) => x.endsWith('.js') && x !== 'app.js')) {
    const src = sinComentarios(fs.readFileSync(path.join(JS, f), 'utf8'));
    for (const m of src.matchAll(/render(?:App)?View\(\s*'([a-z0-9-]+)'/g)) destinos.add(m[1]);
  }
  return destinos;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL SUELO
// ─────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-652d · 🔴 SUELO: cero rutas alcanzables es CEGUERA, no un producto sin pantallas', () => {
  const pintan = vistasQueSePintan();
  const llegan = vistasALasQueSeLlega();

  assert.notEqual(pintan.size, 0,
    '🔴 el barrido no ve NI UN `case` en `renderView`. Eso no significa «no hay pantallas»: ' +
    'significa que este instrumento no está mirando donde cree —`app.js` se movió, o el router ' +
    'dejó de ser un `switch`—. Con cero, todo lo de abajo pasaría por no encontrar nada.');
  assert.notEqual(llegan.size, 0,
    '🔴 el barrido no ve NI UNA entrada (ni `data-view`, ni `renderAppView`). Mismo caso: es ' +
    'ceguera del instrumento, no un producto en el que no se puede navegar.');

  // Suelo con número, medido en este árbol: el router pasa de 25 casos y hay más de 15 destinos.
  assert.ok(pintan.size >= 20, `🔴 sólo ${pintan.size} casos en el router: el barrido se ha quedado corto`);
  assert.ok(llegan.size >= 15, `🔴 sólo ${llegan.size} destinos: el barrido se ha quedado corto`);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL ROJO QUE IMPORTA
// ─────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-652d · 🔴 AL PARTE SE LLEGA: hay puerta, no sólo pantalla', () => {
  const pintan = vistasQueSePintan();
  const llegan = vistasALasQueSeLlega();

  assert.ok(pintan.has('parte-detail'),
    '🔴 `renderView` no sabe pintar `parte-detail`. Falta el `case` en `app.js`.');

  assert.ok(llegan.has('parte-detail'),
    '🔴 LA PANTALLA DEL PARTE NO ES ALCANZABLE. Existe `parteDetailView.js`, está cargado en el ' +
    'índice y el service worker lo precarga, pero NADA lleva a `parte-detail`: ni un botón del ' +
    'nav, ni una llamada a `renderAppView` desde otra vista.\n' +
    '   Un fichero cargado al que no lleva nada no es una pantalla. Éste fue exactamente el ' +
    'estado del parte entre la fase C y la D, con sus 15 tests en verde.');
});

test('SCRUM-652d · la puerta está en el TRABAJO, que es donde el técnico ya está', () => {
  const job = sinComentarios(fs.readFileSync(path.join(JS, 'jobDetailView.js'), 'utf8'));
  assert.match(job, /render(?:App)?View\(\s*'parte-detail'/,
    '🔴 al parte no se entra desde el Trabajo. El técnico abre su trabajo del día: si la puerta ' +
    'no está ahí, está en un sitio al que no va.');
  assert.match(job, /data-abrir-parte/,
    '🔴 el botón que abre el parte no se puede señalar desde un test ni desde soporte.');
});

test('SCRUM-652d · 🔴 el botón de firmar está ENGANCHADO, no sólo pintado', () => {
  // La fila 4 de la certificación decía «pantalla 🔴». Medido: el botón `data-parte-firmar` SÍ se
  // pintaba desde la fase C — y no tenía ni un `addEventListener` detrás. Estaba pintado y MUERTO.
  const vista = fs.readFileSync(path.join(JS, 'parteDetailView.js'), 'utf8');
  const sinC = sinComentarios(vista);

  assert.match(sinC, /data-parte-firmar/,
    '🔴 la vista ya no pinta el botón de firmar');
  assert.match(sinC, /addEventListener\(\s*'click'/,
    '🔴 el botón de firmar sigue SIN escuchar nada. Se pinta y no hace nada al pulsarlo: el ' +
    'defecto no era que faltara el botón, era que no había cable entre el botón y `firmarParte`.');
  assert.match(sinC, /renderParteDetailView/,
    '🔴 no existe la función que `app.js` llama para traer y pintar el parte.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ✅ CONTROL POSITIVO · lo de hoy sigue igual, enumerado
// ─────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-652d · ✅ CONTROL POSITIVO: albarán y trabajo se siguen alcanzando igual', () => {
  const pintan = vistasQueSePintan();
  const llegan = vistasALasQueSeLlega();

  // Enumerado, no «alguna»: si una desaparece, el rojo dice cuál.
  for (const vista of ['jobs', 'jobs-detail', 'albaranes', 'albaran-detail', 'quotes-detail', 'invoice-detail']) {
    assert.ok(pintan.has(vista), `🔴 \`renderView\` ha dejado de pintar '${vista}'`);
    assert.ok(llegan.has(vista), `🔴 ya no se llega a '${vista}'`);
  }

  // Y el camino concreto del albarán desde el Trabajo, que es el patrón que copia el parte.
  const job = sinComentarios(fs.readFileSync(path.join(JS, 'jobDetailView.js'), 'utf8'));
  assert.match(job, /render(?:App)?View\(\s*'albaran-detail',\s*\{\s*albaranId/,
    '🔴 el Trabajo ha dejado de abrir su albarán');

  // El nav sigue llevando a Trabajos.
  const html = fs.readFileSync(INDEX, 'utf8');
  assert.match(html, /data-view="jobs"/, '🔴 el nav ya no lleva a Trabajos');
});

test('SCRUM-652d · ✅ CONTROL POSITIVO: NO se estrena una entrada de nav para `parte-detail`', () => {
  // Crear un parte sólo tiene sentido dentro de un trabajo: una entrada suelta en la barra
  // llevaría a una pantalla que no sabe de qué trabajo hablar.
  //
  // 🔴 3-sep-2026 · ESTE ASERTO ERA MÍO Y ESTABA MAL, y es el mismo defecto que llevo dos días
  // curando en los guards de otros: medía la FORMA —el prefijo `data-view="parte`— en vez del
  // HECHO —la vista `parte-detail`—.
  //
  // La sesión 4 añadió `data-view="partes-oficina"`, que es OTRA pantalla y **sí** va en la barra:
  // es la del jefe valorando, no la del técnico dentro de un trabajo. Mi prefijo la acusaba. Un
  // guard que prohibe de más se acaba desactivando, y entonces tampoco protege de lo suyo.
  const html = fs.readFileSync(INDEX, 'utf8');
  const enLaBarra = [...html.matchAll(/data-view="([a-z0-9-]+)"/g)].map((m) => m[1]);

  assert.ok(enLaBarra.length > 0,
    '🔴 SUELO: el barrido no ve NI UNA entrada de nav. Un cero aquí no es «la barra está ' +
    'limpia»: es que no está mirando el índice.');
  assert.ok(!enLaBarra.includes('parte-detail'),
    '🔴 se ha estrenado una entrada de nav para `parte-detail`. La puerta va en el Trabajo: ' +
    'esa pantalla necesita saber de qué parte habla, y desde la barra no lo sabe.');

  // CONTROL POSITIVO del propio detector: ve las entradas que SÍ existen. Sin esto, el aserto de
  // arriba pasaría igual con una regex rota.
  assert.ok(enLaBarra.includes('jobs'),
    '🔴 el detector no encuentra `jobs` en la barra, que está ahí: no está leyendo el índice.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CONTROL QUE NO PUEDE CAER NUNCA
// ─────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-652d · 🔴 el dinero SIGUE sin cruzar el cable al móvil', () => {
  // `serializeParteParaElTecnico` se escribe campo a campo A PROPÓSITO. Abrir la puerta no puede
  // haberlo tocado, y menos añadirle un «modo oficina».
  const rutas = fs.readFileSync(
    path.join(RAIZ, 'src', 'modules', 'jobs', 'app', 'routes', 'partes.routes.ts'), 'utf8');
  const cuerpo = rutas.match(/function serializeParteParaElTecnico[\s\S]*?\n\}/);
  assert.ok(cuerpo, '🔴 ha desaparecido `serializeParteParaElTecnico`');

  // 🔴 SIN COMENTARIOS, y esta línea la escribe la experiencia: la primera versión de este
  // test buscaba `precioUnitario` en el cuerpo CRUDO y caía sobre el comentario que explica que
  // esos dos campos NO cruzan el cable. El guard se cazaba a sí mismo. Se mira el CÓDIGO.
  const codigo = sinComentarios(cuerpo[0]);
  assert.ok(!/precioUnitario|tipoIva/.test(codigo),
    '🔴 el serializador del técnico ha ganado una clave de dinero: ' + codigo.slice(0, 200));

  // CONTROL POSITIVO del propio detector: con un serializador que SÍ manda dinero tiene que
  // cazarlo. Sin esto, «no encuentro dinero» no se distingue de «no sé buscar».
  const falso = sinComentarios('  return { lineas: l.map((x) => ({ precioUnitario: x.p })) };');
  assert.ok(/precioUnitario/.test(falso),
    '🔴 el detector no caza un `precioUnitario` puesto a mano: no está mirando.');
  assert.match(cuerpo[0], /lineasParaElTecnico/,
    '🔴 el serializador ya no pasa por `lineasParaElTecnico`, que es lo que deja los precios fuera.');
});

// ────────────────────────────────────────────────────────────────────────────────────
// EL CAMINO ENTERO, EJECUTADO · puerta → pantalla → botón → cola
// ────────────────────────────────────────────────────────────────────────────────────

/** Un contenedor de mentira con lo justo: `innerHTML`, `querySelector` y un botón que escucha. */
function contenedorFalso() {
  const boton = {
    escuchas: [],
    addEventListener(evento, fn) { if (evento === 'click') this.escuchas.push(fn); },
    async pulsar() { for (const fn of this.escuchas) await fn(); },
  };
  return {
    innerHTML: '',
    boton,
    querySelector(sel) { return sel === '[data-parte-firmar]' ? boton : null; },
  };
}

function montarVista() {
  const ctx = {
    console, window: null, Date, Array, Object, String, Number, JSON, Promise, Error,
    document: { createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, innerHTML: '' }) },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(JS, 'parteDetailView.js'), 'utf8'), ctx,
    { filename: 'parteDetailView.js' });
  return ctx;
}

const PARTE = {
  id: 7, numero: 'PT-2026-001', clienteNombre: 'Comunidad Los Olivos',
  fecha: '2026-09-02T08:00:00.000Z', obra: 'C/ Mayor 3', referencia: 'REF-778',
  entrada: '09:15', salida: '11:40', desplazamientos: 1, kilometros: 12.5,
  tecnicos: ['Israel'], tipo: 'reparacion_asistencia',
  lineas: [{ bloque: 'mano_obra', unds: 2.5, descripcion: 'Revisión de caldera' }],
  notas: null, estado: 'borrador',
  puedeEditarContenido: { ok: true, motivo: null },
  puedeEditarPrecios: { ok: true, motivo: null },
};

test('SCRUM-652d · 🔴 SIN RED: se entra al parte y se firma, con LA COLA QUE YA EXISTE', async () => {
  const ctx = montarVista();
  const cont = contenedorFalso();
  const pedidas = [];
  const firmas = [];
  let padAbierto = null;

  const pintada = await ctx.renderParteDetailView(cont, 7, {
    apiRequest: async (ruta) => { pedidas.push(ruta); return PARTE; },
    abrirPad: (o) => { padAbierto = o; },
    // La cola de verdad se ejercita en `scrum652c`; aquí lo que se mide es el CABLE: que pulsar
    // el botón llegue hasta ella, y con qué. Sin red, `firmarConRedDeSeguridad` devuelve ②.
    firmar: async (id, cuerpo, subir, tipo) => {
      firmas.push({ id, tipo });
      try { await subir(); } catch (_e) { /* la red está caída: para eso existe la cola */ }
      return { estado: 'solo_en_este_movil', encolada: true };
    },
  });

  assert.equal(pintada, true, '🔴 la vista no pintó el parte que trajo');
  assert.deepEqual(pedidas, ['/admin/partes/7'],
    '🔴 la pantalla no pide el parte a su ruta. Pidió: ' + JSON.stringify(pedidas));

  // 🔴 EL CABLE: pulsar el botón tiene que llegar al pad. Antes de la fase D esto NO ocurría:
  // el botón se pintaba y no escuchaba nada.
  assert.equal(cont.boton.escuchas.length, 1,
    '🔴 el botón de firmar no tiene ni un escuchador. Se pinta y no hace nada al pulsarlo.');
  await cont.boton.pulsar();
  assert.ok(padAbierto, '🔴 pulsar el botón no abre el pad de firma');

  // Y ahora la firma, con la red CAÍDA.
  const r = await padAbierto.onConfirm('data:image/png;base64,AAA', { firmadoPorNombre: 'Ana Ruiz' });

  assert.deepEqual(firmas, [{ id: 7, tipo: 'parte' }],
    '🔴 la firma no llegó a la cola diciendo que es un PARTE. Llegó: ' + JSON.stringify(firmas));
  assert.equal(r.estado, 'solo_en_este_movil',
    '🔴 sin red se ha declarado la firma a salvo: es el fallo mudo que el bloque H existe para impedir');
  assert.equal(r.encolada, true, '🔴 sin red la firma no entró en la cola');
});

test('SCRUM-652d · 🔴 tras firmar, la pantalla se repinta CON LO QUE DICE EL SERVIDOR', async () => {
  // Una pantalla que se cree firmada porque pulsaste el botón miente cuando la firma se quedó en
  // la cola. El estado, el sello y los candados los decide el servidor.
  const ctx = montarVista();
  const cont = contenedorFalso();
  let veces = 0;
  let padAbierto = null;

  await ctx.renderParteDetailView(cont, 7, {
    apiRequest: async () => { veces += 1; return PARTE; },
    abrirPad: (o) => { padAbierto = o; },
    firmar: async () => ({ estado: 'a_salvo', encolada: false }),
  });
  assert.equal(veces, 1);

  await cont.boton.pulsar();
  await padAbierto.onConfirm('data:image/png;base64,AAA', {});
  assert.equal(veces, 2,
    '🔴 tras firmar la pantalla NO vuelve a pedir el parte: se queda pintando el objeto que ' +
    'tenía en memoria, que no sabe si el servidor lo aceptó.');
});

test('SCRUM-652d · 🔴 SUELO: si el parte no se puede traer, NO se pinta un parte vacío', async () => {
  const ctx = montarVista();
  const cont = contenedorFalso();
  const ok = await ctx.renderParteDetailView(cont, 7, {
    apiRequest: async () => { throw new Error('sin red'); },
  });
  assert.equal(ok, false, '🔴 la vista dice que pintó un parte que no pudo traer');
  assert.match(cont.innerHTML, /data-parte-error/,
    '🔴 no avisa del fallo. Un técnico que ve un parte en blanco cree que no apuntó nada, y lo ' +
    'que pasa es que la respuesta no llegó.');
  assert.ok(!/data-parte-bloque/.test(cont.innerHTML),
    '🔴 ha pintado los bloques vacíos de un parte que no existe');
});

