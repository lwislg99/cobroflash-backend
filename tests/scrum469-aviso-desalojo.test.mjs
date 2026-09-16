// tests/scrum469-aviso-desalojo.test.mjs — SCRUM-469
//
// EL AVISO QUE NADIE VE.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA VÍCTIMA
//
// SCRUM-360 (H5 · fase 3) dejó construida y en verde la detección de desalojo: si **hubo cola** y
// **el almacén está vacío**, el navegador se ha llevado firmas que nunca llegaron a nuestro
// servidor. `app.js` llamaba a `resistenciaAlArrancar()` **y tiraba lo que devolvía**.
//
// O sea: el producto SABÍA que se habían perdido firmas y el profesional no. Eso no es una
// funcionalidad a medias, es el fallo mudo contra el que existe el bloque H entero — el mismo
// desenlace que si la detección no estuviera, con el coste de haberla construido.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LOS TRES CONTROLES, Y EL QUE MANDA ES EL SEGUNDO
//
//   ① POSITIVO — hubo cola y el almacén está vacío → sale el aviso, con el texto aprobado LITERAL.
//   ② NEGATIVO — profesional recién instalado, sin cola previa → **NO VE NADA**. Su almacén
//     también está vacío. Un aviso de pérdida a quien no ha perdido nada enseña a ignorar el
//     aviso, y entonces no avisa el día que sí. Éste es el control que protege al usuario normal.
//   ③ SUELO — si no se puede saber si el almacén está vacío (`NO_SE_SABE`), **no se pinta**. Un
//     fallo de lectura convertido en «el móvil ha borrado firmas» es una acusación falsa.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 HUECOS DECLARADOS ARRIBA DEL TODO
//
// · `fake-indexeddb` es un DOBLE: aquí se demuestra que NUESTRO código detecta y DICE un almacén
//   vaciado, no que un iPhone lo vacíe a los 7 días. Eso es H7 y la matriz humana.
// · **La caja no se mide en este fichero.** El mini-DOM del banco no tiene motor de maquetado
//   (`getBoundingClientRect` devuelve ceros), así que aquí sólo se comprueba la ESTRUCTURA que
//   hace que quepa —dos campos, no una cadena—. El ancho real, con el CSS real y la pantalla
//   EJECUTÁNDOSE a 390 y a 320 px, lo mide `npm run guard:caja-avisos` en Edge. Está fuera de
//   `npm test` por la misma decisión de SCRUM-368 que dejó fuera a `guard:contraste`: la suite no
//   arranca un navegador.
// · **Y lo que esa medida desmintió, dicho aquí y no escondido en la entrada:** partir el texto en
//   dos campos **NO** es lo que hace que quepa. A 390 y a 320 px ocupa 3 líneas / 82,8 px partido
//   Y sin partir, y el aviso vecino ocupa 3 líneas a 320, no las 4 que decía el encargo. Los dos
//   campos se pintan porque son la microcopy aprobada, no por la caja.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { montarAlmacen, porQueEstariaCiego } from './_banco-almacen-local.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_JS = path.join(RAIZ, 'public/dashboard/js');

const leer = (rel) => fs.readFileSync(path.join(DIR_JS, rel), 'utf8');
const arbol = (rel) => ts.createSourceFile(rel, leer(rel), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

/** Recorre el árbol entero. */
function recorrer(n, fn) { fn(n); ts.forEachChild(n, (h) => recorrer(h, fn)); }

/**
 * Monta el dashboard con la marca de «hubo cola» puesta o no, y con el almacén que se pida.
 *
 * La marca vive en `localStorage` y el banco de SCRUM-457 la guarda de verdad, así que el
 * escenario se construye con el mismo mecanismo que usa el producto: no se fuerza el veredicto.
 */
function montar({ huboCola = false, sinIndexedDB = false } = {}) {
  const b = montarAlmacen(RAIZ, {
    sinIndexedDB,
    dashboard: { localStorage: huboCola ? { yaqu_hubo_cola: '1754900000000' } : {} },
  });
  return b;
}

/** Pinta el aviso en la home tal y como lo hace el producto y devuelve lo que salió. */
async function pintarEnHome(b, medida) {
  const caja = b.mk('div');
  caja.id = 'home-desalojo';
  await b.ctx.pintarDesalojoEnHome(medida);
  return String(caja.innerHTML);
}

// ── 🔴 SUELO DEL BANCO ─────────────────────────────────────────────────────────────────────

test('SCRUM-469 · 🔴 SUELO: el banco monta las dos piezas, o se declara CIEGO', () => {
  const b = montar();
  assert.equal(porQueEstariaCiego(b, RAIZ), null, '🔴 BANCO CIEGO (almacén).');

  for (const n of ['detectarDesalojo', 'resistenciaAlArrancar', 'pintarDesalojo',
    'pintarDesalojoEnHome']) {
    assert.equal(typeof b.ctx[n], 'function',
      `🔴 no está publicada \`${n}\`: todo lo de abajo mediría el vacío.`);
  }
  const rotos = b.fallos.filter((f) => ['js/estadoFirma.js', 'js/homeView.js',
    'js/resistenciaAlmacen.js', 'js/app.js'].includes(f.fichero));
  assert.deepEqual(rotos, [], '🔴 algún fichero del camino no carga: ' + JSON.stringify(rotos));
});

// ── ① CONTROL POSITIVO ─────────────────────────────────────────────────────────────────────

test('SCRUM-469 · ✅ POSITIVO: hubo cola y el almacén está vacío → SALE el aviso, literal', async () => {
  const b = montar({ huboCola: true });

  // El veredicto NO se fabrica: lo produce el mecanismo de SCRUM-360 con la marca puesta y la
  // cola vacía. Si esa conjunción dejara de dar `POSIBLE_PERDIDA`, este test tiene que caer.
  const veredicto = await b.ctx.detectarDesalojo();
  assert.equal(veredicto.estado, b.ctx.POSIBLE_PERDIDA,
    `🔴 el escenario NO OCURRIÓ (${veredicto.estado}: ${veredicto.motivo}): lo de abajo no probaría nada.`);

  const html = await pintarEnHome(b, veredicto);

  // El texto aprobado por el asesor, LITERAL y por sus dos campos. No se compone ni se trunca.
  assert.ok(html.includes('El móvil ha borrado firmas sin subir'),
    '🔴 SE PIERDEN FIRMAS EN SILENCIO: el mecanismo dice POSIBLE_PERDIDA y la home no lo cuenta. '
    + 'El profesional se irá de la obra creyendo que sus albaranes están firmados.');
  assert.ok(html.includes('Revisa tus albaranes: los que no salgan firmados hay que volver a firmarlos.'),
    '🔴 el aviso sale sin decir QUÉ HACER. Saber que has perdido algo sin saber qué revisar no es '
    + 'un aviso, es un susto.');

  // Y el aviso es el aviso: se pinta con el componente de la casa, no con un nodo inventado.
  assert.match(html, /class="alert error"/,
    '🔴 el aviso no usa `.alert error` del inventario. Un componente nuevo para esto es rediseño '
    + '(Parte AB) y además se saldría del sistema que ya mide el guard de caja.');
  assert.match(html, /role="alert"/,
    '🔴 sin `role="alert"` un lector de pantalla no lo anuncia: para quien no ve la pantalla, el '
    + 'fallo sigue siendo mudo.');
});

test('SCRUM-469 · ✅ POSITIVO: el aviso son DOS CAMPOS, no una cadena', () => {
  const b = montar();
  const t = b.ctx.TEXTO_DESALOJO;

  assert.equal(typeof t.titulo, 'string');
  assert.equal(typeof t.cuerpo, 'string');
  assert.notEqual(t.titulo, t.cuerpo);

  // ⚠️ POR QUÉ ESTO NO DICE «Y ASÍ CABE». El encargo justificaba la partición por la caja; medido
  // en Edge (`npm run guard:caja-avisos`), a 390 y a 320 px el aviso ocupa **3 líneas / 82,8 px
  // partido Y sin partir**: la partición no cambia la altura a ninguno de los dos anchos. Se
  // sostiene porque es la microcopy que aprobó el asesor —dos campos, regla 30— y porque un
  // título se lee antes que un párrafo. El tope de caracteres de abajo vigila lo que sí es cierto:
  // que ninguno de los dos crezca hasta desbordar lo medido.
  assert.ok(t.titulo.length <= 40,
    `🔴 el título son ${t.titulo.length} caracteres: pasa de una línea a 320 px (~39 caberían) y `
    + 'deja de ser un título.');
  assert.ok(t.cuerpo.length <= 90,
    `🔴 el cuerpo son ${t.cuerpo.length} caracteres: a ~39 caracteres/línea a 320 px pasa de 2 `
    + 'líneas y el aviso crece por encima de lo medido en navegador. Vuelve a pasar el guard.');

  // Y el pintado los separa de verdad: un `<strong>` y un salto, no una cadena pegada.
  const html = b.ctx.pintarDesalojo({ estado: b.ctx.POSIBLE_PERDIDA });
  assert.match(html, /<strong>[^<]*<\/strong><br>/,
    '🔴 los dos campos se han vuelto a pegar en una sola frase. El asesor aprobó DOS —título y '
    + 'cuerpo—, y unirlos es reescribir microcopy aprobada (regla 30), no un detalle de formato.');
});

// ── ② CONTROL NEGATIVO — el que protege al usuario normal ─────────────────────────────────

test('SCRUM-469 · 🔴 NEGATIVO: un profesional recién instalado NO VE NADA', async () => {
  // Su almacén también está vacío. Lo único que lo separa de quien perdió algo es la marca.
  const b = montar({ huboCola: false });

  const veredicto = await b.ctx.detectarDesalojo();
  assert.equal(veredicto.estado, b.ctx.SIN_PERDIDA,
    `🔴 el mecanismo acusa a quien acaba de instalar (${veredicto.motivo}).`);

  const html = await pintarEnHome(b, veredicto);
  assert.equal(html, '',
    '🔴 SE LE DICE A UN PROFESIONAL RECIÉN INSTALADO QUE HA PERDIDO TRABAJO. Un aviso de pérdida a '
    + 'quien no ha perdido nada enseña a ignorar el aviso — y entonces no avisa el día que sí.');
});

test('SCRUM-469 · 🔴 NEGATIVO: con firmas EN la cola tampoco se avisa de pérdida', async () => {
  const b = montar({ huboCola: true });
  await b.ctx.guardarFirmaPendiente({
    claveIdempotencia: '0f3d9c7a-1b2e-4a55-9c31-77e0a1b2c3d0',
    albaranId: 42,
    trazo: 'data:image/png;base64,AAAA',
  });

  const veredicto = await b.ctx.detectarDesalojo();
  assert.equal(veredicto.estado, b.ctx.SIN_PERDIDA,
    '🔴 hay firmas en la cola y aun así se declara pérdida: la conjunción de SCRUM-360 se ha roto.');
  assert.equal(await pintarEnHome(b, veredicto), '',
    '🔴 se avisa de una pérdida teniendo las firmas delante.');
});

// ── ③ SUELO — «no supe mirar» no es «se ha perdido algo» ──────────────────────────────────

test('SCRUM-469 · 🔴 SUELO: `NO_SE_SABE` NO pinta el aviso de pérdida', async () => {
  // Safari en navegación privada: hay marca de que hubo cola, y la cola NO SE PUEDE LEER.
  const b = montar({ huboCola: true, sinIndexedDB: true });

  const veredicto = await b.ctx.detectarDesalojo();
  assert.equal(veredicto.estado, b.ctx.ALMACEN_NO_SE_SABE,
    `🔴 el escenario NO OCURRIÓ (${veredicto.estado}): sin él, este test no prueba el suelo.`);

  assert.equal(await pintarEnHome(b, veredicto), '',
    '🔴 UN FALLO DE LECTURA SE HA CONVERTIDO EN UNA ACUSACIÓN. No haber podido abrir el almacén no '
    + 'es haber perdido firmas: «vacío» y «no supe mirarlo» son el mismo cero con significados '
    + 'opuestos, y este aviso sólo puede salir del lado que se ha medido.');
});

test('SCRUM-469 · 🔴 SUELO: sin medida todavía, la home no inventa un aviso', async () => {
  const b = montar({ huboCola: true });
  // La medida llega sin `await` desde `app.js`; la home puede montarse antes.
  assert.equal(b.ctx.resistenciaUltimoResultado, undefined);
  assert.equal(await pintarEnHome(b, undefined), '',
    '🔴 la home pinta un aviso de pérdida ANTES de que nadie haya medido nada.');
});

// ── 🔴 EL ROJO POR EL MECANISMO ────────────────────────────────────────────────────────────

test('SCRUM-469 · 🔴 el arranque CONSUME lo que mide, no lo tira', () => {
  // Éste es el defecto exacto que cerró el ticket, y por eso se vigila por AST y no por texto:
  // `window.resistenciaAlArrancar()` como sentencia suelta PARECE cableado —el guard de SCRUM-360
  // se conforma con que la llamada exista, y hace bien: lo suyo es que se DISPARE— pero tira el
  // veredicto. Aquí se exige lo otro: que el valor se use.
  const sf = arbol('app.js');
  let llamadas = 0;
  let sueltas = 0;
  recorrer(sf, (n) => {
    if (!ts.isCallExpression(n)) return;
    const f = n.expression;
    if (!ts.isPropertyAccessExpression(f) || f.name.text !== 'resistenciaAlArrancar') return;
    llamadas += 1;
    // El valor se tira cuando la llamada ES la sentencia entera.
    if (ts.isExpressionStatement(n.parent)) sueltas += 1;
  });

  assert.ok(llamadas >= 1,
    '🔴 ESCÁNER CIEGO: no se ve ninguna llamada a `resistenciaAlArrancar` en `app.js`. El guard de '
    + 'SCRUM-360 debería haber caído antes que éste; si no lo ha hecho, el detector está roto.');
  assert.equal(sueltas, 0,
    '🔴 SE PIERDEN FIRMAS EN SILENCIO. `app.js` mide el desalojo y TIRA el resultado: el producto '
    + 'sabe que el navegador se ha llevado firmas sin subir y el profesional no se entera. Es el '
    + 'fallo mudo contra el que existe el bloque H, con la detección ya construida y pagada.');

  // CONTROL POSITIVO DEL DETECTOR, dentro del mismo test: reconoce la forma que persigue.
  const malo = ts.createSourceFile('x.js', 'window.resistenciaAlArrancar();',
    ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let vistas = 0;
  recorrer(malo, (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && n.expression.name.text === 'resistenciaAlArrancar' && ts.isExpressionStatement(n.parent)) vistas += 1;
  });
  assert.equal(vistas, 1, '🔴 el detector no ve una llamada tirada que tiene delante.');
});

test('SCRUM-469 · 🔴 la HOME pinta el aviso, y no sólo sabe pintarlo', () => {
  // Mencionar no es hacer: que `pintarDesalojoEnHome` exista no prueba que la home la llame.
  const sf = arbol('homeView.js');
  let dentroDeRender = 0;
  recorrer(sf, (n) => {
    if (!ts.isFunctionDeclaration(n) || !n.name || n.name.text !== 'renderHomeView') return;
    recorrer(n, (m) => {
      if (ts.isCallExpression(m) && ts.isIdentifier(m.expression)
        && m.expression.text === 'pintarDesalojoEnHome') dentroDeRender += 1;
    });
  });
  assert.ok(dentroDeRender >= 1,
    '🔴 SE PIERDEN FIRMAS EN SILENCIO: `renderHomeView` no llama a `pintarDesalojoEnHome`, así que '
    + 'el profesional que abre la home con el almacén desalojado no ve nada. La función existiría '
    + 'y no la dispararía nadie.');
});

// ── LA APROBADA QUE **NO** SE PINTA, Y SU TRINQUETE ───────────────────────────────────────

test('SCRUM-469 · ⚠️ el aviso de «no cabe otra firma» está APROBADO y SIGUE SIN CONSUMIDOR', () => {
  const b = montar();
  assert.equal(typeof b.ctx.TEXTO_SIN_ESPACIO_PARA_FIRMA, 'string',
    '🔴 el texto aprobado ha desaparecido de la fuente única. Si se ha cableado el tope, este test '
    + 'se cambia; si se ha borrado, hay que volver a pasar por el asesor.');

  // 🔴 POR QUÉ SE VIGILA QUE **NO** SE USE. `hayEspacioParaOtraFirma` (SCRUM-360) no está cableada
  // al encolado: nadie consulta el tope antes de guardar una firma. Pintar hoy este texto sería
  // anunciar un rechazo que no ocurre. Y una declaración que nadie tiene que venir a retirar no es
  // un hueco declarado: es una promesa. El día que se cablee el tope, ESTA ASERCIÓN CAE y hay que
  // quitarla — que es exactamente el aviso que queremos que reciba esa sesión.
  const consumidores = [];
  for (const rel of fs.readdirSync(DIR_JS).filter((f) => f.endsWith('.js'))) {
    const sf = arbol(rel);
    recorrer(sf, (n) => {
      if (!ts.isIdentifier(n) || n.text !== 'TEXTO_SIN_ESPACIO_PARA_FIRMA') return;
      // La declaración y su publicación en `window` no son consumidores.
      const p = n.parent;
      if (ts.isVariableDeclaration(p) && p.name === n) return;
      if (ts.isPropertyAccessExpression(p) && p.name === n) return;
      if (ts.isBinaryExpression(p) && ts.isPropertyAccessExpression(p.left)
        && p.left.name.text === 'TEXTO_SIN_ESPACIO_PARA_FIRMA') return;
      consumidores.push(`${rel}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`);
    });
  }
  assert.deepEqual(consumidores, [],
    `⚠️ ALGUIEN YA PINTA «no cabe otra firma» (${consumidores.join(', ')}) — y si el tope sigue sin `
    + 'estar cableado a `guardarFirmaPendiente`, se está anunciando un rechazo que no ocurre. Si '
    + 'SÍ se ha cableado: enhorabuena, borra este test y déjalo dicho en `docs/master/`.');
});
