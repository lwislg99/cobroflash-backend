// tests/scrum451-plazo-de-red.test.mjs — SCRUM-451
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA VÍCTIMA: un profesional con mala cobertura abre una pantalla que no es Cobros, la petición se
// queda en el aire, y la pantalla espera PARA SIEMPRE. Ni datos, ni error, ni nada.
//
// LO QUE ENTRA: el plazo baja a `apiRequest` —un sitio, una constante— y **corta de verdad** con
// `AbortController`, que es lo que SCRUM-448 dejó fuera a propósito. Sin el corte, la petición
// vencida se sigue descargando entera: gasta los datos del profesional en el peor sitio posible.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { aceptaYNoEntrega, llegaTarde, cuerpoLento, porLlamada, redNormal } from './_banco-red.mjs';
import { censarPeticiones, repartoPorMetodo } from './_censo-peticiones-panel.mjs';
import { vistasDelDispatch } from './_censo-vistas-dispatch.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = path.join(RAIZ, 'public/dashboard/js/api.js');

/** Texto visible de un contenedor, para poder afirmar sobre lo que el profesional lee. */
const leer = (c) => todos(c).map((n) => n.textContent).filter(Boolean).join(' | ');

// ═══ ① EL PLAZO VIVE EN UN SITIO, Y SON 10 s ═════════════════════════════════════════════

test('SCRUM-451 · el plazo son 10 s, en UNA constante con nombre, en el camino común', () => {
  // Reapuntado de SCRUM-448 (su R7): lo vigilado —«el plazo vive en UN sitio»— no ha cambiado;
  // cambió cuál es ese sitio. El número lo decidió el fundador y no se toca aquí.
  const fuente = fs.readFileSync(API, 'utf8');
  assert.ok(/var PLAZO_RED_MS = \(typeof window !== 'undefined' && window\.PLAZO_RED_MS\) \|\| 10000;/.test(fuente),
    '🔴 el plazo no son 10000 ms en su constante de `api.js`. Va en UN sitio porque este número ' +
    'cambia en cuanto midamos: cambiarlo tiene que ser cambiar una línea.');

  // ⚠️ EL CRITERIO, Y POR QUÉ NO ES «BUSCAR 10000». El de SCRUM-448 valía en `cobrosView`, donde no
  // había más números; aquí `api.js` tiene un `10000` de `revokeObjectURL` y un `15000` de duración
  // de toast que **no son plazos de red**. Un escáner que los cuente da ruido, y un escáner que da
  // ruido acaba relajado hasta quedarse ciego. Así que no se busca el número: se busca **el que
  // arma el corte**. Todo `setTimeout` que aborte tiene que llevar la constante, y no otra cosa.
  const codigo = fuente.replace(/\/\/[^\n]*|\/\*[^]*?\*\//g, '');
  const cortes = [...codigo.matchAll(/setTimeout\(([^;]*?abort[^;]*?),\s*([^)]+)\)/g)];
  assert.ok(cortes.length >= 1,
    '🔴 no hay ningún `setTimeout` que aborte: el plazo no corta nada.');
  for (const c of cortes) {
    assert.equal(c[2].trim(), 'PLAZO_RED_MS',
      `🔴 hay un corte armado con \`${c[2].trim()}\` en vez de con la constante. El plazo vive en ` +
      'UN sitio porque va a cambiar en cuanto midamos.');
  }

  // Y en NINGUNA otra parte del panel: si vuelve a nacer un plazo dentro de una vista, esto cae.
  const dir = path.join(RAIZ, 'public/dashboard/js');
  const conPlazoPropio = fs.readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'api.js')
    .filter((f) => /_PLAZO_MS\b|\bPLAZO_[A-Z_]*_MS\b/.test(
      fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\/[^\n]*|\/\*[^]*?\*\//g, '')));
  assert.deepEqual(conPlazoPropio, [],
    `🔴 estas vistas se han hecho su propio plazo: ${conPlazoPropio.join(', ')}. El segundo sitio ` +
    'donde se copia una decisión es donde deja de ser una decisión y pasa a ser una costumbre.');
});

// ═══ ② CORTA DE VERDAD — lo que 448 no pudo tener ════════════════════════════════════════

test('SCRUM-451 · al vencer, la petición SE ABORTA: deja de descargarse', async () => {
  const red = aceptaYNoEntrega();
  const banco = cargarDashboard(RAIZ, { red });
  banco.ctx.PLAZO_RED_MS = 5;
  const c = banco.mk('div');
  banco.ctx.renderCobrosView(c);
  await new Promise((r) => setTimeout(r, 40));

  // SUELO: si el banco no consigue dejar la petición en el aire, no ha medido nada.
  assert.ok(red.seEjercio(), `🔴 BANCO CIEGO: no se pidió nada (${red.describir()}).`);
  assert.equal(red.reg.colgadas, 1,
    `🔴 la petición no se quedó en el aire (${red.describir()}): el escenario no se ha montado.`);
  assert.equal(red.reg.abortadas, 1,
    `🔴 el plazo venció y la petición NO se abortó (${red.describir()}). Sigue viva, sigue bajando ` +
    'datos que ya no se van a pintar, y los paga el profesional en el peor sitio posible. Eso es ' +
    'exactamente el hueco que SCRUM-448 declaró y que este ticket existe para cerrar.');
});

test('SCRUM-451 · el plazo cubre TAMBIÉN el cuerpo, no solo las cabeceras', async () => {
  // 🔴 El caso que distingue un plazo que corta de uno que lo parece: `fetch` vuelve con las
  // CABECERAS y el cuerpo se sigue bajando después. Un plazo que se limpiara al resolver el
  // `fetch` dejaría vivo justo lo que gasta los datos.
  const red = cuerpoLento(2, 500, [{ id: 1 }]);
  const banco = cargarDashboard(RAIZ, { red });
  banco.ctx.PLAZO_RED_MS = 20; // las cabeceras llegan (2 ms); el cuerpo NO (500 ms)
  const c = banco.mk('div');
  banco.ctx.renderCobrosView(c);
  await new Promise((r) => setTimeout(r, 80));

  assert.equal(red.reg.resueltas, 1,
    `suelo: las cabeceras tenían que haber llegado, o esto no prueba lo del cuerpo (${red.describir()}).`);
  assert.equal(red.reg.cuerposEntregados, 0,
    `🔴 el cuerpo se entregó pese al plazo (${red.describir()}): el corte solo llegaba a las ` +
    'cabeceras y lo que de verdad gasta los datos del profesional seguía bajando.');
  assert.equal(red.reg.abortadas, 1, `🔴 no se abortó durante el cuerpo (${red.describir()}).`);
});

// ═══ ③ CONTROL NEGATIVO — sin esto el plazo es un generador de falsas alarmas ════════════

test('SCRUM-451 · una petición LENTA PERO NORMAL, por debajo del plazo, NO vence', async () => {
  // Sin este control el plazo acaba subido a 60 s por alguien harto de falsas alarmas, que es como
  // muere un mecanismo. Se pide con holgura: la respuesta tarda 30 ms y el plazo son 300.
  const red = llegaTarde(30, [{
    origen: 'invoice', id: 1, fecha: '2026-07-01T10:00:00.000Z', cliente: 'Paga tarde',
    concepto: null, importe: '80.00', moneda: 'EUR', metodo: null, estado: 'pending',
    referencia: null, numero: 'F-2026-0042', tipo: 'F1', invoiceId: 1, chargeId: null,
  }]);
  const banco = cargarDashboard(RAIZ, { red });
  banco.ctx.PLAZO_RED_MS = 300;
  const c = banco.mk('div');
  banco.ctx.renderCobrosView(c);
  await new Promise((r) => setTimeout(r, 120));

  const texto = leer(c);
  assert.equal(red.reg.abortadas, 0,
    `🔴 se ha abortado una petición que iba bien, solo lenta (${red.describir()}). Un plazo que ` +
    'corta lo que sí iba a llegar no protege: estorba, y acaba subido a 60 s por alguien harto.');
  assert.match(texto, /F-2026-0042/,
    '🔴 la respuesta llegó dentro del plazo y no se ha pintado.');
  assert.ok(!/No hemos podido cargar/.test(texto),
    '🔴 se ha avisado de un fallo que no ha ocurrido. Falsa alarma.');
});

// ═══ ④ LA CARRERA — el defecto que nadie ve hasta que muerde ═════════════════════════════

test('SCRUM-451 · una respuesta VIEJA no pinta encima de una más nueva', async () => {
  // Abortar no basta y por eso el número de secuencia sigue haciendo falta: el aborto no es
  // instantáneo, y una petición que NO venció puede seguir llegando tarde detrás de otra.
  const base = {
    origen: 'invoice', id: 1, fecha: '2026-07-01T10:00:00.000Z', cliente: 'X', concepto: null,
    importe: '80.00', moneda: 'EUR', metodo: null, estado: 'pending', referencia: null,
    tipo: 'F1', invoiceId: 1, chargeId: null,
  };
  const red = porLlamada([
    { ms: 60, datos: [{ ...base, numero: 'F-VIEJA' }] },
    { ms: 5, datos: [{ ...base, numero: 'F-NUEVA' }] },
  ]);
  const banco = cargarDashboard(RAIZ, { red });
  banco.ctx.PLAZO_RED_MS = 5000; // ninguna vence: lo que se mide es el ORDEN, no el plazo
  const c1 = banco.mk('div');
  const c2 = banco.mk('div');
  banco.ctx.renderCobrosView(c1);
  banco.ctx.renderCobrosView(c2);
  await new Promise((r) => setTimeout(r, 150));

  assert.equal(red.reg.peticiones.length, 2,
    `suelo: sin DOS peticiones no hay carrera que medir (${red.describir()}).`);
  assert.equal(red.reg.abortadas, 0,
    `suelo: ninguna debía vencer aquí; si alguna venció, esto mide el plazo y no la carrera ` +
    `(${red.describir()}).`);
  const texto = leer(c1) + ' | ' + leer(c2);
  assert.ok(/F-NUEVA/.test(texto),
    '🔴 la respuesta BUENA no se ha pintado en ninguna de las dos pantallas.');
  assert.ok(!/F-VIEJA/.test(texto),
    '🔴 la respuesta de una petición VIEJA ha pintado. Con una más nueva en marcha, eso sustituye ' +
    'datos buenos por datos peores y el profesional se queda mirando una lista vieja sin saberlo.');
});

test('SCRUM-451 · al que se quedó atrás se le da lo ÚLTIMO, no se le deja sin respuesta', async () => {
  // 🔴 EL CONTROL QUE IMPIDE PASARSE DE FRENADA. Descartar la vieja en silencio era lo primero que
  // pensé, y está MEDIDO que habría sido una avería nueva: 22 rutas se piden desde más de un sitio
  // —`/admin/jobs/{}` desde 7, `/admin/metrics/home` desde 2 en la MISMA vista—. Descartar dejaría
  // a un llamador legítimo esperando para siempre. Se comparte: los dos reciben lo más nuevo.
  const red = porLlamada([{ ms: 60, datos: { v: 'vieja' } }, { ms: 5, datos: { v: 'nueva' } }]);
  const banco = cargarDashboard(RAIZ, { red });
  banco.ctx.PLAZO_RED_MS = 5000;
  const p1 = banco.ctx.apiRequest('/admin/misma-ruta');
  const p2 = banco.ctx.apiRequest('/admin/misma-ruta');
  const [r1, r2] = await Promise.all([p1, p2]);

  assert.equal(red.reg.peticiones.length, 2, `suelo: hacen falta dos (${red.describir()}).`);
  assert.deepEqual(r2, { v: 'nueva' }, 'suelo: la segunda tiene que traer lo suyo.');
  assert.deepEqual(r1, { v: 'nueva' },
    '🔴 al llamador que se quedó atrás se le ha entregado la respuesta VIEJA, o ninguna. Ni una ' +
    'cosa ni la otra: 22 rutas se piden desde más de un sitio, y descartar en silencio deja a ' +
    'alguien esperando para siempre. Se le da lo último.');
});

// ═══ ⑤ NO PASARSE: LAS MUTACIONES NO SE TOCAN ════════════════════════════════════════════

test('SCRUM-451 · una MUTACIÓN no lleva plazo y NO se aborta', async () => {
  // Abortar un POST convierte «no sé si se guardó» en un error visible: el profesional lo repite y
  // sale una segunda factura. Eso es dinero y es el camino de emisión, así que está PARADO y
  // propuesto al fundador. Este test es lo que impide que se cuele sin decidirlo.
  const red = aceptaYNoEntrega();
  const banco = cargarDashboard(RAIZ, { red });
  banco.ctx.PLAZO_RED_MS = 5;
  let acabó = false;
  banco.ctx.apiRequest('/admin/invoices', { method: 'POST', body: '{}' })
    .then(() => { acabó = true; }, () => { acabó = true; });
  await new Promise((r) => setTimeout(r, 60));

  assert.equal(red.reg.peticiones.length, 1, `suelo: el POST tiene que haber salido (${red.describir()}).`);
  assert.equal(red.reg.abortadas, 0,
    `🔴 se ha abortado una MUTACIÓN (${red.describir()}). El servidor ha podido procesarla ya; ` +
    'cortarla le enseña un error al profesional por algo que quizá sí se guardó, lo repite, y sale ' +
    'una segunda factura. No se decide aquí.');
  assert.equal(acabó, false,
    '🔴 la mutación ha terminado sola: alguien le ha puesto un plazo por la puerta de atrás.');
});

// ═══ ⑥ EL CENSO: CUÁNTAS PETICIONES SE SALTAN EL CAMINO COMÚN ════════════════════════════

test('SCRUM-451 · censo de peticiones del panel, con su suelo', () => {
  const c = censarPeticiones(RAIZ);
  // SUELO, por separado: un cero agregado puede estar tapando otro.
  assert.ok(c.leidos >= 40, `🔴 SUELO: solo ${c.leidos} ficheros leídos. El censo no ha mirado.`);
  assert.ok(c.apiRequest.length >= 100,
    `🔴 SUELO: solo ${c.apiRequest.length} llamadas a \`apiRequest\`. Sabemos que hay más de cien.`);
  const r = repartoPorMetodo(c.apiRequest);
  assert.ok(r.GET > 0 && r.mutaciones > 0,
    `🔴 SUELO: el reparto por método sale degenerado (${JSON.stringify(r)}).`);
  assert.equal(r.otras, 0,
    `🔴 hay ${r.otras} llamadas cuyo método no se sabe leer: el censo no puede decir si van con ` +
    'plazo o sin él, y un censo que no sabe no debe contar.');
});

test('SCRUM-451 · TRINQUETE: los `fetch` que se saltan el camino común solo pueden BAJAR', () => {
  // 🔴 EL LÍMITE DE ESTE TICKET, MEDIDO Y NO SUPUESTO. El plazo vive en `apiRequest` y no vale de
  // nada para una petición que no pasa por ahí. `productsView`, `providersView` e `invoicesView`
  // cargan con `fetch` a pelo: por muy bueno que sea el camino común, esas pantallas siguen
  // esperando para siempre.
  //
  // No se arreglan aquí —son nueve ficheros y otro carril—, pero **no pueden crecer**. Es el mismo
  // instrumento que usó SCRUM-405 con las descargas: no arreglar los sitios uno a uno, que eso lo
  // deshace el siguiente, sino contar los que quedan y no dejar que suban.
  const TECHO = 37; // medido el 10-ago-2026 sobre `main` = 2e12c2f7. Solo baja.
  const c = censarPeticiones(RAIZ);
  assert.ok(c.fetchCrudo.length > 0,
    '🔴 SUELO: cero `fetch` a pelo. O se han arreglado los 37 de golpe —enhorabuena, baja el ' +
    'techo— o el censo ha dejado de ver. Compruébalo antes de celebrarlo.');
  assert.ok(c.fetchCrudo.length <= TECHO,
    `🔴 han aparecido ${c.fetchCrudo.length - TECHO} \`fetch\` nuevos a pelo (${c.fetchCrudo.length} ` +
    `sobre un techo de ${TECHO}). Cada uno es una pantalla que se salta el plazo y se queda ` +
    `esperando para siempre. Reparto: ${JSON.stringify(c.porFichero)}`);
});

// ═══ ⑦ EL HUECO DE SCRUM-417: LAS DOS VISTAS QUE NADIE PODÍA MEDIR ═══════════════════════

test('SCRUM-451 · el banco ya monta `invoicesView` y `productsView`', async () => {
  // SCRUM-448 tuvo que declararlas SIN MEDIR: el `querySelector` del banco era `() => null` fijo y
  // las dos reventaban. Y una es la de facturas.
  for (const vista of ['renderInvoicesView', 'renderProductsView']) {
    const banco = cargarDashboard(RAIZ, { red: redNormal([]) });
    const r = await pintarVista(banco, vista);
    assert.equal(r.error, null,
      `🔴 \`${vista}\` sigue sin montar en el banco: ${r.error && r.error.message}. Mientras no ` +
      'monte, nadie puede medir qué hace sin cobertura y no se puede declarar sana.');
    assert.ok(r.nodos > 5, `🔴 \`${vista}\` monta pero no pinta nada (${r.nodos} nodos).`);
    assert.deepEqual(banco.reg.selectoresNoSoportados, [],
      `🔴 el banco no supo resolver selectores al montar \`${vista}\`: ` +
      `${JSON.stringify(banco.reg.selectoresNoSoportados)}. Un \`null\` por no saber se lee igual ` +
      'que un `null` por no existir, y eso es lo que dejó estas dos vistas sin medir.');
  }
});

// ═══ ⑧ CONTROL POSITIVO: ¿QUÉ VISTAS ACABAN DICIENDO ALGO? ═══════════════════════════════

test('SCRUM-451 · TRINQUETE: las vistas que se quedan MUDAS tras vencer el plazo solo bajan', async () => {
  // 🔴 EL PLAZO NO BASTA, Y ASÍ SE MIDE. `apiRequest` rechaza al vencer, pero una vista que no trata
  // ese rechazo se queda con su «Cargando…» para siempre igual. Que el camino común corte es la
  // CONDICIÓN para arreglarlas; no es el arreglo.
  //
  // No se arreglan aquí: cada una necesita SU texto y la microcopy la aprueba el asesor (regla 30).
  // Un mensaje genérico donde había uno concreto es un empeoramiento, no una unificación.
  //
  // ⚠️ Las vistas se sacan del dispatch (censo derivado de SCRUM-433), no de una lista a mano.
  const MUDAS_TECHO = 7; // medido el 10-ago-2026. Solo baja.
  const { vistas } = vistasDelDispatch(RAIZ);
  const nombreFn = (v) => 'render' + v.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('') + 'View';

  // Una vista puede explotar en una continuación asíncrona y matar el proceso entero. Eso no es un
  // resultado: es perder la medición. Se recogen y se cuentan como «no medidas».
  const explosiones = [];
  const recoger = (e) => explosiones.push(String(e && e.message).slice(0, 80));
  process.on('uncaughtException', recoger);
  process.on('unhandledRejection', recoger);

  const hablan = []; const mudas = []; const noMontan = [];
  try {
    for (const v of vistas.filter((x) => !x.alias)) {
      const red = aceptaYNoEntrega();
      const banco = cargarDashboard(RAIZ, { red });
      banco.ctx.PLAZO_RED_MS = 5;
      const fn = banco.ctx[nombreFn(v.nombre)];
      if (typeof fn !== 'function') { noMontan.push(`${v.nombre} (no publica ${nombreFn(v.nombre)})`); continue; }
      const c = banco.mk('div');
      // ⚠️ Muchas vistas son `async`: lo que devuelven es una PROMESA, y si revienta y nadie la
      // recoge, el corredor tumba el fichero entero. Se recoge aquí. Un `try/catch` a secas solo
      // caza las que revientan de forma síncrona, que son las menos.
      let revento = null;
      try {
        const p = fn(c);
        if (p && typeof p.catch === 'function') p.catch((e) => { revento = e; });
      } catch (e) { revento = e; }
      await new Promise((r) => setTimeout(r, 60));
      if (revento) { noMontan.push(`${v.nombre} (revienta: ${String(revento.message).slice(0, 50)})`); continue; }
      if (!red.seEjercio()) { noMontan.push(`${v.nombre} (no pidió nada)`); continue; }
      (/no (hemos|se ha[n]?) pud|no pudimos|error|reintent|vuelve a intentarlo/i.test(leer(c))
        ? hablan : mudas).push(v.nombre);
    }
    // DESAGÜE. Una vista puede tener temporizadores en marcha cuando el bucle acaba, y si explotan
    // DESPUÉS del test el corredor lo cuenta como actividad huérfana en vez de como medición. Se
    // les da tiempo aquí, con el recogedor todavía puesto.
    await new Promise((r) => setTimeout(r, 250));
  } finally {
    process.off('uncaughtException', recoger);
    process.off('unhandledRejection', recoger);
  }

  // SUELO, por separado. Sabemos que hay más de veinte vistas y que varias hablan ya.
  assert.ok(vistas.length >= 20, `🔴 SUELO: el dispatch solo dio ${vistas.length} vistas.`);
  assert.ok(hablan.length + mudas.length >= 10,
    `🔴 SUELO: solo se han podido medir ${hablan.length + mudas.length} vistas. ` +
    `No medidas: ${noMontan.join(', ')} · explosiones: ${explosiones.join(' / ')}`);
  // Control positivo DENTRO: si NINGUNA hablara, «las mudas no suben» sería verdad y no diría nada.
  assert.ok(hablan.length > 0,
    '🔴 ninguna vista dice nada al vencer el plazo. O el plazo no llega, o esto no está midiendo.');

  assert.ok(mudas.length <= MUDAS_TECHO,
    `🔴 hay ${mudas.length} vistas que se quedan MUDAS tras vencer el plazo (techo ${MUDAS_TECHO}): ` +
    `${mudas.join(', ')}. Cada una es un profesional mirando un «Cargando…» que no se va a ir. ` +
    `Las que sí hablan: ${hablan.join(', ')}.`);
});
