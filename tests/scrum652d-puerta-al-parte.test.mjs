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
import ts from 'typescript';   // SCRUM-652e: el HECHO se lee del router, no del nombre
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

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔒 3-sep-2026 · ESTE CONTROL SE ESTRECHÓ, Y LA LECCIÓN VALE MÁS QUE EL ARREGLO
//
// UN GUARD QUE VIGILA UN PREFIJO NO VIGILA UN HECHO: vigila una convención de nombres, y caza al
// primero que se llame parecido siendo otra cosa.
//
// Lo que había hasta hoy era `!/data-view="parte/.test(html)` — «ninguna vista cuyo nombre empiece
// por parte». Y main se puso ROJO sin que nadie escribiera una línea mala:
//
//   · `107846d3` · 2-sep 19:58 · SCRUM-652 fase D — añadió este control positivo.
//   · `c561c626` · 3-sep 12:06 · SCRUM-703 — añadió `data-view="partes-oficina"` a `index.html`.
//
// Ficheros distintos, CERO CONFLICTO, git contento, y el significado roto. Es el aviso de Javier
// ocurriendo: un merge sin conflictos no es un merge correcto — git resuelve por LÍNEAS, no por
// SIGNIFICADO. Los dos commits tenían razón; el que estaba mal era este test, POR ANCHO.
//
// LOS DOS COMMITS, Y POR QUÉ NO SE CONTRADICEN:
//   · `parte-detail` es el PARTE DEL TÉCNICO. Se entra desde el Trabajo, y una entrada suelta en
//     la barra llevaría a una pantalla que no sabe de qué trabajo habla. Eso es lo que se protege.
//   · `partes-oficina` es la LISTA DEL JEFE («Partes por valorar»). NO necesita contexto, y su
//     razón de existir es que el jefe encuentre lo que le falta por valorar: fuera de la barra, no
//     lo encuentra. Decisión del fundador (3-sep-2026): **se queda en el nav**.
//
// Así que el control ya no mira el NOMBRE: mira el HECHO. Qué vistas EXIGEN un id de contexto lo
// dice el propio router (`if (state.<algo>Id != null && …)`), y de ahí sale la lista — no de una
// lista escrita a mano que envejece.
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * Las vistas que el router SÓLO sabe pintar con un id de contexto, leídas de `app.js`.
 * Devuelve `[{ vista, exigeId }]`.
 */
function vistasQueExigenContexto(fuenteApp) {
  const sf = ts.createSourceFile('app.js', fuenteApp, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const out = [];
  const visita = (n) => {
    if (ts.isCaseClause(n) && ts.isStringLiteral(n.expression)) {
      const cuerpo = n.statements.map((s) => s.getText()).join('\n');
      const m = /state\.([A-Za-z0-9_]*[Ii]d[A-Za-z0-9_]*)\s*!=\s*null/.exec(cuerpo);
      if (m) out.push({ vista: n.expression.text, exigeId: m[1] });
    }
    ts.forEachChild(n, visita);
  };
  ts.forEachChild(sf, visita);
  return out;
}

/** Los `data-view` de la barra de navegación. */
const vistasDelNav = (html) => [...html.matchAll(/data-view="([^"]+)"/g)].map((m) => m[1]);

/**
 * 🔴 EL SUELO DEL EXTRACTOR — LO PREGUNTÓ JAVIER EL 3-sep-2026, Y TENÍA RAZÓN.
 *
 * Su pregunta, literal: «el censo dice 18 entradas de nav y 5 vistas que exigen contexto. ¿Tiene
 * suelo sobre esos 18? Si mañana el extractor por AST deja de encontrar entradas y devuelve 0, el
 * guard sigue verde y no nos enteramos.»
 *
 * El guard tenía suelo sobre las 5 —si la derivación deja de ver `parte-detail`, cae— y NO sobre
 * las 18. Y ahí está el agujero: **una lista vacía hace verdad cualquier afirmación sobre sus
 * elementos**. Con cero entradas de nav, «ninguna entrada lleva a una vista sin contexto» es
 * VERDADERA Y VACÍA, y el guard pasaría para siempre sobre una barra que ya no sabe leer.
 *
 * Es el mismo caso que este árbol ya cazó en otros sitios (el censo de huérfanos, el de apartados,
 * el de asignables): cero no es «está limpio», es «no he mirado».
 *
 * ⚠️ EL MÍNIMO VA CON HOLGURA, Y ESO NO ES PEREZA. Hoy hay 18 (medido). El suelo se pone en 10:
 * un guard que estorba en cada PR acaba desactivado, y lo que aquí importa no es cuántas entradas
 * haya —eso lo vigila SCRUM-420— sino que el extractor SIGA VIENDO la barra. Perder ocho entradas
 * de golpe es un rediseño, y entonces este número se sube a propósito con su motivo.
 */
const MINIMO_ENTRADAS_DE_NAV = 10;

/**
 * 🔴 SON DOS HECHOS DISTINTOS Y NO PUEDEN DAR EL MISMO ROJO (corregido el 3-sep-2026):
 *
 *   · CERO entradas → **aquí no hay barra que leer**. El extractor no ve nada: el `index.html`
 *     cambió de forma, o el fichero no es el que se cree. Es ceguera del instrumento.
 *   · POCAS entradas → **la barra encogió**. El instrumento ve, y lo que ve es poco. Es un hecho
 *     del producto, y quien lo lea tiene que ir a mirar el nav, no el extractor.
 *
 * Dar el mismo mensaje a las dos manda a quien lo lea al sitio equivocado la mitad de las veces.
 */
function entradasDeNavConSuelo(html) {
  const nav = vistasDelNav(html);
  if (nav.length === 0) {
    throw new Error(
      'NAV CIEGO · el extractor no ha encontrado NI UNA entrada de nav. Eso no es «la barra está '
      + 'limpia»: es que aquí no hay barra que leer — el `index.html` cambió de forma (otro '
      + 'atributo, otra plantilla) o el fichero no es el que se cree.\n'
      + '  Una lista vacía hace VERDADERA Y VACÍA la afirmación de abajo —«ninguna entrada lleva a '
      + 'una vista sin contexto»— y el guard pasaría para siempre sobre una barra que ya no sabe '
      + 'leer. MIRA EL EXTRACTOR, no el nav.'
    );
  }
  if (nav.length < MINIMO_ENTRADAS_DE_NAV) {
    throw new Error(
      `LA BARRA HA ENCOGIDO · el extractor ve ${nav.length} entradas y el suelo son `
      + `${MINIMO_ENTRADAS_DE_NAV}. El instrumento FUNCIONA —ve entradas—, así que esto es un hecho `
      + `del producto: ${JSON.stringify(nav)}.\n`
      + '  MIRA EL NAV, no el extractor. Si la barra ha encogido a propósito, baja el mínimo con su '
      + 'motivo; si no, alguien se ha llevado media barra por delante.'
    );
  }
  return nav;
}

/** El HECHO, en una función: ¿alguna entrada de nav lleva a una vista que exige contexto? */
function navSinContexto(html, fuenteApp) {
  const exigen = vistasQueExigenContexto(fuenteApp);
  const nav = entradasDeNavConSuelo(html);   // 🔴 el suelo va DENTRO: no se puede rodear
  return nav
    .filter((v) => exigen.some((e) => e.vista === v))
    .map((v) => ({ vista: v, exigeId: exigen.find((e) => e.vista === v).exigeId }));
}

test('SCRUM-652d · ✅ CONTROL POSITIVO: ninguna entrada de nav lleva a una vista SIN CONTEXTO', () => {
  const html = fs.readFileSync(INDEX, 'utf8');
  const app = fs.readFileSync(path.join(JS, 'app.js'), 'utf8');

  // SUELO: si la derivación no encontrara `parte-detail`, el control habría dejado de vigilar
  // justo lo que nació vigilando, y lo haría en verde.
  const exigen = vistasQueExigenContexto(app);
  assert.ok(exigen.some((e) => e.vista === 'parte-detail'),
    '🔴 la derivación ya no ve `parte-detail` entre las vistas que exigen contexto. O el router '
    + 'cambió de forma, o la vista se retiró: en los dos casos este control estaría pasando en '
    + `vacío. Lo que ve hoy: ${JSON.stringify(exigen.map((e) => e.vista))}`);
  assert.ok(exigen.length >= 3,
    `🔴 solo se han derivado ${exigen.length} vistas con contexto: la lectura de \`app.js\` se ha roto.`);

  const malas = navSinContexto(html, app);
  assert.deepEqual(malas, [],
    '🔴 HAY UNA ENTRADA DE NAV QUE LLEVA A UNA PANTALLA SIN CONTEXTO:\n'
    + malas.map((m) => `    data-view="${m.vista}" — el router la pinta sólo con state.${m.exigeId}`).join('\n')
    + '\n  Pulsarla desde la barra deja al profesional en una pantalla que no sabe de qué documento\n'
    + '  habla: el `if` del router no entra y no se pinta nada. A `parte-detail` se llega desde el\n'
    + '  Trabajo, que es quien tiene el id.');
});

test('SCRUM-652d · 🔴 SUELO DEL NAV: cero entradas es CIEGO, no «la barra está limpia»', () => {
  // 🔴 LO PREGUNTÓ JAVIER EL 3-sep-2026, y el guard no lo tenía. Su pregunta destapó que el suelo
  // estaba a medias: había uno sobre las vistas que exigen contexto (si la derivación deja de ver
  // `parte-detail`, cae) y NINGUNO sobre las entradas de la barra.
  const app = fs.readFileSync(path.join(JS, 'app.js'), 'utf8');
  const SIN_BARRA = '<!doctype html><html><body><main id="view"></main></body></html>';

  // ① CON EL SUELO: se declara ciego y dice qué mirar.
  assert.throws(
    () => navSinContexto(SIN_BARRA, app),
    (e) => {
      assert.match(e.message, /NAV CIEGO/,
        '🔴 con CERO entradas de nav el guard no se declara ciego.');
      assert.match(e.message, /MIRA EL EXTRACTOR/,
        '🔴 el rojo de CERO no manda a mirar el extractor. Con cero, el problema NO está en el nav: '
        + 'está en quien lo lee, y decirlo mal manda a la persona al sitio equivocado.');
      assert.match(e.message, /VERDADERA Y VACÍA/,
        '🔴 el rojo no explica POR QUÉ un cero es peligroso aquí, y sin eso el siguiente que lo lea '
        + 'sube el número para quitárselo de encima.');
      return true;
    },
  );

  // ② 🔴 Y CAE CON EL MECANISMO VIEJO: sin suelo, ese mismo HTML pasa en VERDE. Se ejecuta aquí la
  //    versión anterior —el extractor pelado— para que quede DEMOSTRADO y no dicho.
  const comoEraAntes = vistasDelNav(SIN_BARRA)
    .filter((v) => vistasQueExigenContexto(app).some((e) => e.vista === v));
  assert.deepEqual(comoEraAntes, [],
    '🔴 el mecanismo viejo ya fallaba con cero entradas. Si eso ha cambiado, este control deja de '
    + 'probar que el suelo añadiera algo: comprueba qué se movió antes de creerte el verde.');
  // Y ésa es exactamente la trampa: `[]` no significa «no hay ninguna mala», significa «no he
  // mirado». Una lista vacía hace verdad cualquier afirmación sobre sus elementos.

  // ③ CONTROL POSITIVO del suelo: con la barra de verdad, no estorba.
  const html = fs.readFileSync(INDEX, 'utf8');
  assert.ok(entradasDeNavConSuelo(html).length >= MINIMO_ENTRADAS_DE_NAV,
    '🔴 el suelo salta sobre la barra REAL: entonces no es un suelo, es un obstáculo, y acabará '
    + 'desactivado en el primer PR que moleste.');
  // 🔴 AQUÍ HABÍA UN `assert.equal(…, 18)` Y ME PUSO LA PR EN ROJO EL MISMO DÍA. Lo quito, y queda
  // escrito por qué: **era un trinquete de igualdad exacta sobre un número que no es mío.** Quién
  // va en la barra lo decide el producto y lo vigila SCRUM-420; este fichero sólo necesita que el
  // extractor SIGA VIENDO. SCRUM-599 (DOC-09) retiró `quotes-new` del nav —una decisión legítima:
  // «una sola forma de llegar a crear»— la barra pasó de 18 a 17, y mi guard se puso rojo sin que
  // nadie hubiera roto nada. El suelo de 10 NO saltó: funcionó. Lo que sobraba era el 18.
  //
  // Es el defecto que este árbol ya tiene nombrado en SCRUM-402: «un guard que exigiera eso nacería
  // ROJO y lo apagaría alguien en una hora». Un guard que da rojo en falso se desactiva, y entonces
  // se pierde también lo que sí vigilaba.
  //
  // Lo que sí es mío, y se comprueba sin fijar el número: que el suelo conserve HOLGURA.
  const cuantas = vistasDelNav(html).length;
  assert.ok(cuantas >= MINIMO_ENTRADAS_DE_NAV + 3,
    `🔴 la barra tiene ${cuantas} entradas y el suelo son ${MINIMO_ENTRADAS_DE_NAV}: quedan menos de `
    + 'tres de margen. No es un fallo de nadie —el número lo decide el producto— pero con el suelo '
    + 'tan pegado, el siguiente PR que toque el nav lo hace saltar en falso. Bájalo con su motivo '
    + 'antes de que alguien lo desactive.');
});

test('SCRUM-652d · 🔴 el control SIGUE CAYENDO si alguien mete el parte del técnico en la barra', () => {
  // 🔴 ESTE ES EL CONTROL QUE NO PUEDE PERDERSE AL ESTRECHAR. Si al acotar el guard dejara de
  // cazar esto, se habría matado sin querer y el estrechamiento estaría mal hecho.
  const app = fs.readFileSync(path.join(JS, 'app.js'), 'utf8');
  const htmlMalo = fs.readFileSync(INDEX, 'utf8')
    .replace('data-view="jobs"', 'data-view="parte-detail"');

  const malas = navSinContexto(htmlMalo, app);
  assert.equal(malas.length >= 1, true,
    '🔴 SE HA METIDO `parte-detail` EN LA BARRA Y EL CONTROL NO LO CAZA. El estrechamiento se ha '
    + 'llevado por delante lo que este test nació protegiendo: una entrada suelta al parte del '
    + 'técnico lleva a una pantalla que no sabe de qué trabajo habla.');
  assert.equal(malas[0].vista, 'parte-detail');
  assert.equal(malas[0].exigeId, 'parteId', '🔴 el rojo no dice QUÉ contexto le falta.');
});

test('SCRUM-652d · 🔴 CONTROL NEGATIVO: la LISTA DEL JEFE sí va en la barra — y el guard viejo no lo distinguía', () => {
  const app = fs.readFileSync(path.join(JS, 'app.js'), 'utf8');
  const html = fs.readFileSync(INDEX, 'utf8');

  // El caso de hoy: `partes-oficina` está en el nav y NO exige contexto. Verde.
  assert.ok(vistasDelNav(html).includes('partes-oficina'),
    '🔴 la lista de «Partes por valorar» ha salido de la barra. Decisión del fundador (3-sep-2026): '
    + 'se queda — fuera de la barra el jefe no encuentra lo que le falta por valorar, y ése era el '
    + 'agujero entero de la fila 5.');
  assert.deepEqual(navSinContexto(html, app), [],
    '🔴 `partes-oficina` se está contando como pantalla sin contexto, y no lo es: el router la '
    + 'pinta sin ningún id.');

  // 🔴 Y CAE CON EL MECANISMO VIEJO: el test de hoy NO pasaría este control negativo. Se ejecuta
  // aquí la regla vieja para que quede demostrado y no dicho — si alguien vuelve a ensanchar el
  // guard a un prefijo, este assert lo enseña con el nombre del inocente.
  const cazadosPorElPrefijoViejo = vistasDelNav(html).filter((v) => /^parte/.test(v));
  assert.deepEqual(cazadosPorElPrefijoViejo, ['partes-oficina'],
    '🔴 la regla vieja (`data-view="parte…"` por prefijo) ya no caza `partes-oficina`. Si eso ha '
    + 'cambiado, comprueba qué se movió: la razón de estrechar este control fue que el prefijo '
    + 'atrapaba a la lista del jefe, que es otra pantalla.');
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

