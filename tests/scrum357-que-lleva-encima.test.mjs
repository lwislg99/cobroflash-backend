// tests/scrum357-que-lleva-encima.test.mjs — SCRUM-357 (H1 · cierre)
//
// QUE EL PROFESIONAL SEPA QUÉ LLEVA ENCIMA.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA VÍCTIMA
//
// SCRUM-460 construyó la precarga y la dejó devolviendo TRES resultados —precargué N, no había
// nada, no supe mirar— porque **colapsarlos manda al pro al sótano creyendo que va preparado**.
// Y los guardó en `window.precargaUltimoResultado` para que los pintara H2.
//
// Un sprint después esa variable tenía **CERO consumidores** (medido el 11-ago-2026 sobre `main`
// = f546e27b). O sea: el producto sabía qué llevaba el móvil y el profesional no. Separar tres
// estados en una variable que no lee nadie deja al pro exactamente igual de ciego que haberlos
// colapsado, con el coste de haberlos separado.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CONTROL QUE DECIDE SI ESTO SIRVE: EL TERCERO NUNCA CAE EN EL SEGUNDO
//
// «No había nada que llevarte» y «no hemos podido prepararlo» dejan al profesional IGUAL —en el
// sótano, sin albarán— y significan lo contrario. El segundo es tranquilo y CORRECTO (con los
// datos de producción del 10-ago, 0 trabajos agendados hoy o mañana, es el caso NORMAL). El
// tercero es una avería nuestra y tiene que sonar a eso.
//
// Un test que los confunda tiene que caer, y por eso aquí no se comprueba «sale un aviso»: se
// comprueba que las TRES entradas producen TRES salidas DISTINTAS, y que la que no se sabe cae
// del lado que no tranquiliza.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 HUECOS DECLARADOS ARRIBA DEL TODO
//
// · `fake-indexeddb` es un DOBLE: aquí se demuestra que NUESTRO código precarga, mide y DICE lo
//   que lleva. No que un iPhone en un sótano se comporte así. Eso es H7 y la matriz humana.
// · **La caja no se mide en este fichero.** El mini-DOM del banco no tiene motor de maquetado, así
//   que aquí sólo se comprueba la ESTRUCTURA. El ancho real, con el CSS real y la pantalla
//   EJECUTÁNDOSE a 390 y a 320 px, lo mide `npm run guard:caja-avisos` en Edge — el mismo guard de
//   SCRUM-469, al que este ticket le añade su aviso en vez de estrenar un segundo medidor.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { montarAlmacen, porQueEstariaCiego } from './_banco-almacen-local.mjs';
import { redNormal, aceptaYNoEntrega } from './_banco-red.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_JS = path.join(RAIZ, 'public/dashboard/js');

const leer = (rel) => fs.readFileSync(path.join(DIR_JS, rel), 'utf8');
const arbol = (rel) => ts.createSourceFile(rel, leer(rel), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
function recorrer(n, fn) { fn(n); ts.forEachChild(n, (h) => recorrer(h, fn)); }

/** Un albarán del paquete de SCRUM-458, con la forma PLANA que trae la ruta. */
const albaran = (id) => ({
  id, numero: `ALB-2026-${String(id).padStart(3, '0')}`, estado: 'emitido',
  fecha: '2026-08-10T09:00:00.000Z', fechaEntrega: null, lugarEntrega: 'C/ Mayor 14',
  modoValoracion: 'SIN_VALORAR',
  lineas: [{ concepto: 'Sustituir bajante de PVC', cantidad: 1, unidad: 'ud' }],
  notas: null, jobId: 500 + id, jobTitulo: 'Baño Los Olivos', clienteNombre: 'Comunidad Los Olivos',
});

/** El banco: dashboard entero + IndexedDB de verdad + el escenario de red que se pida. */
function montar(red) {
  return montarAlmacen(RAIZ, { dashboard: red ? { red } : {} });
}

/** Pinta el aviso en la home tal y como lo hace el producto y devuelve lo que salió. */
function pintarEnHome(b, resultado) {
  const caja = b.mk('div');
  caja.id = 'home-precarga';
  b.ctx.pintarPrecargaEnHome(resultado);
  return String(caja.innerHTML);
}

// ── 🔴 SUELO DEL BANCO ─────────────────────────────────────────────────────────────────────

test('SCRUM-357 · 🔴 SUELO: el banco monta las piezas, o se declara CIEGO', () => {
  const b = montar();
  assert.equal(porQueEstariaCiego(b, RAIZ), null, '🔴 BANCO CIEGO (almacén).');

  for (const n of ['precargarAlbaranes', 'pintarPrecarga', 'pintarPrecargaEnHome',
    'textoDeLoQueLlevas', 'TEXTO_PRECARGA', 'PRECARGADO', 'NADA_QUE_PRECARGAR', 'NO_SE_PUDO']) {
    assert.notEqual(b.ctx[n], undefined,
      `🔴 no está publicada \`${n}\`: todo lo de abajo mediría el vacío.`);
  }
  const rotos = b.fallos.filter((f) => ['js/estadoFirma.js', 'js/homeView.js',
    'js/almacenLocal.js', 'js/app.js'].includes(f.fichero));
  assert.deepEqual(rotos, [], '🔴 algún fichero del camino no carga: ' + JSON.stringify(rotos));
});

// ── ① CONTROL POSITIVO — con el productor DE VERDAD, plural y singular ────────────────────

test('SCRUM-357 · ✅ POSITIVO: precarga de 3 albaranes → el profesional ve el 3', async () => {
  const b = montar(redNormal({ estado: 'LISTA', albaranes: [albaran(1), albaran(2), albaran(3)], trabajos: {} }));

  // El resultado NO se fabrica: lo produce `precargarAlbaranes` bajando el paquete y guardándolo.
  // Si esa cadena dejara de dar PRECARGADO/3, este test tiene que caer antes de mirar el texto.
  const r = await b.ctx.precargarAlbaranes();
  assert.equal(r.estado, b.ctx.PRECARGADO, `🔴 el escenario NO OCURRIÓ (${JSON.stringify(r)}).`);
  assert.equal(r.n, 3, `🔴 no se precargaron 3: ${JSON.stringify(r)}. Lo de abajo no probaría nada.`);

  const html = pintarEnHome(b, r);
  assert.ok(html.includes('Llevas 3 albaranes listos para firmar sin cobertura.'),
    '🔴 EL PROFESIONAL NO SABE QUÉ LLEVA ENCIMA: hay 3 albaranes guardados en este móvil y la home '
    + `no lo dice (${html}). Bajará al sótano sin saber si puede firmar.`);
  assert.match(html, /class="alert ok"/,
    '🔴 el aviso no usa `.alert ok` del inventario. Un componente nuevo para esto es rediseño '
    + '(Parte AB) y encima se saldría del sistema que mide `guard:caja-avisos`.');
});

test('SCRUM-357 · ✅ POSITIVO: con UN albarán el texto va en SINGULAR', async () => {
  const b = montar(redNormal({ estado: 'LISTA', albaranes: [albaran(7)], trabajos: {} }));

  const r = await b.ctx.precargarAlbaranes();
  assert.equal(r.estado, b.ctx.PRECARGADO, `🔴 el escenario NO OCURRIÓ (${JSON.stringify(r)}).`);
  assert.equal(r.n, 1, `🔴 no se precargó exactamente 1: ${JSON.stringify(r)}.`);

  const html = pintarEnHome(b, r);
  assert.ok(html.includes('Llevas 1 albarán listo para firmar sin cobertura.'),
    `🔴 el singular no se pinta (${html}). «Llevas 1 albaranes listos» es el detalle por el que un `
    + 'profesional deja de fiarse de lo que le dice la pantalla.');
  // Y no se cuela el plural por detrás.
  assert.ok(!/albaranes listos/.test(html), `🔴 sale el plural con un solo albarán: ${html}`);
});

// ── 🔴 ② EL CONTROL QUE DECIDE: TRES ENTRADAS, TRES SALIDAS DISTINTAS ─────────────────────

test('SCRUM-357 · 🔴 los TRES estados producen TRES salidas DISTINTAS', () => {
  const b = montar();
  const salida = {
    precargado: b.ctx.pintarPrecarga({ estado: b.ctx.PRECARGADO, n: 2 }),
    nada: b.ctx.pintarPrecarga({ estado: b.ctx.NADA_QUE_PRECARGAR, n: 0 }),
    noSePudo: b.ctx.pintarPrecarga({ estado: b.ctx.NO_SE_PUDO, n: 0, motivo: 'sin red' }),
  };

  // Ninguna es vacía: los tres estados TIENEN algo que decirle al profesional. Éste es el aviso
  // que sí habla cuando todo va bien, porque «no hay nada que llevarte» es lo que necesita saber
  // ANTES de bajar, no después.
  for (const [k, v] of Object.entries(salida)) {
    assert.ok(v && v.length > 0,
      `🔴 el estado «${k}» no pinta NADA. El profesional se queda sin saber qué lleva encima, que `
      + 'es exactamente el defecto que este ticket cierra.');
  }

  const distintas = new Set(Object.values(salida));
  assert.equal(distintas.size, 3,
    '🔴 DOS DE LOS TRES ESTADOS DAN LA MISMA PANTALLA. Los tres significan cosas distintas y el '
    + `pro actúa distinto ante cada uno: ${JSON.stringify(salida, null, 1)}`);

  // 🔴 Y EL PAR QUE MANDA, comprobado aparte y con su propio mensaje: el segundo y el tercero.
  assert.notEqual(salida.nada, salida.noSePudo,
    '🔴 «NO HABÍA NADA» Y «NO SUPIMOS MIRAR» SE HAN COLAPSADO. Al profesional las dos lo dejan '
    + 'igual —en el sótano, sin albarán— y significan lo contrario: la primera es correcta y '
    + 'tranquila, la segunda es una avería nuestra. Éste es el ticket entero.');
});

test('SCRUM-357 · 🔴 el segundo es TRANQUILO y el tercero SUENA A AVERÍA', () => {
  const b = montar();
  const nada = b.ctx.pintarPrecarga({ estado: b.ctx.NADA_QUE_PRECARGAR, n: 0 });
  const noSePudo = b.ctx.pintarPrecarga({ estado: b.ctx.NO_SE_PUDO, n: 0 });

  // Los textos, APROBADOS y literales (regla 30): ni se truncan ni se componen.
  assert.ok(nada.includes('No hay nada que llevarte: no tienes trabajos abiertos ni agendados.'),
    `🔴 el vacío legítimo no dice POR QUÉ está vacío (${nada}). «No hay nada» a secas se lee como `
    + 'una avería, y no lo es.');
  assert.ok(noSePudo.includes('No hemos podido preparar tus albaranes. Vuelve a entrar con cobertura.'),
    `🔴 la avería no dice QUÉ HACER (${noSePudo}). Un aviso que solo niega deja al profesional `
    + 'mirando la pantalla sin salida.');

  // Y el canal también los separa, no sólo la letra: si alguien cambia un texto por descuido, el
  // color y el rol siguen diciendo cosas distintas.
  assert.match(nada, /class="alert info"[^>]*role="status"/,
    '🔴 el vacío legítimo se pinta como alarma. Es correcto y normal —con los datos de producción, '
    + 'el caso más frecuente— y gritarlo enseña a ignorar este aviso.');
  assert.match(noSePudo, /class="alert warning"[^>]*role="alert"/,
    '🔴 la avería se pinta tranquila. Es un fallo NUESTRO y el profesional tiene que leerlo antes '
    + 'de bajar: con `role="status"` un lector de pantalla ni siquiera lo interrumpe.');
});

// ── 🔴 ③ EL SUELO: LO QUE NO SE SABE ES EL TERCERO, NUNCA EL SEGUNDO ──────────────────────

test('SCRUM-357 · 🔴 SUELO: sin red, «no supe mirar» — y NO «no había nada»', async () => {
  const b = montar(aceptaYNoEntrega());
  b.ctx.PLAZO_RED_MS = 5; // el plazo de SCRUM-451 corta y `apiRequest` rechaza

  const r = await b.ctx.precargarAlbaranes();
  assert.equal(r.estado, b.ctx.NO_SE_PUDO, `🔴 el escenario NO OCURRIÓ (${JSON.stringify(r)}).`);

  const html = pintarEnHome(b, r);
  const esperadoNada = b.ctx.TEXTO_PRECARGA.nada;
  assert.ok(!html.includes(esperadoNada),
    '🔴 NO SE PUDO MIRAR Y SE LE DICE QUE NO TIENE TRABAJO. Es la mentira tranquilizadora exacta '
    + 'que separó los tres estados en SCRUM-460, colándose por la pantalla.');
  assert.ok(html.includes(b.ctx.TEXTO_PRECARGA.noSePudo),
    `🔴 la avería no se dice (${html}).`);
});

test('SCRUM-357 · 🔴 SUELO: un estado que NO se reconoce cae al TERCERO', () => {
  const b = montar();
  const noSePudo = b.ctx.pintarPrecarga({ estado: b.ctx.NO_SE_PUDO, n: 0 });

  // Un estado nuevo que nadie ha cableado aquí, un `null`, y basura. Ninguno es «no había nada».
  for (const raro of [{ estado: 'ALGO_QUE_NO_EXISTE', n: 0 }, { estado: null }, {}, null, 0, 'x']) {
    const html = b.ctx.pintarPrecarga(raro);
    assert.equal(html, noSePudo,
      `🔴 «${JSON.stringify(raro)}» NO cae en el tercero. Si no se puede saber en qué estado `
      + 'estamos, es una avería nuestra: nunca el vacío legítimo, que tranquiliza a quien va a '
      + 'bajar con las manos vacías.');
  }
});

test('SCRUM-357 · 🔴 SUELO: un PRECARGADO sin número creíble NO afirma que lleva algo', () => {
  const b = montar();
  const noSePudo = b.ctx.pintarPrecarga({ estado: b.ctx.NO_SE_PUDO, n: 0 });

  for (const roto of [{ estado: b.ctx.PRECARGADO, n: 0 }, { estado: b.ctx.PRECARGADO },
    { estado: b.ctx.PRECARGADO, n: -1 }, { estado: b.ctx.PRECARGADO, n: 'tres' }]) {
    assert.equal(b.ctx.pintarPrecarga(roto), noSePudo,
      `🔴 «${JSON.stringify(roto)}» pinta una buena noticia. «Llevas 0 albaranes listos» es el `
      + 'aviso más peligroso de los tres: afirma que va preparado.');
  }
});

test('SCRUM-357 · 🔴 SUELO: sin medida todavía, la home no inventa un aviso', () => {
  const b = montar();
  // La precarga sale sin `await` desde `app.js`; la home puede montarse antes.
  assert.equal(b.ctx.precargaUltimoResultado, undefined,
    '🔴 alguien ya dejó una medida puesta: este test no mediría el hueco.');
  assert.equal(pintarEnHome(b, undefined), '',
    '🔴 la home pinta un veredicto ANTES de que nadie haya medido nada. Un fallo parpadeante en '
    + 'cada carga es cómo se enseña a ignorar este aviso.');
});

// ── 🔴 EL ROJO POR EL MECANISMO ────────────────────────────────────────────────────────────

test('SCRUM-357 · 🔴 la HOME pinta el aviso, y no sólo sabe pintarlo', () => {
  // Mencionar no es hacer: que `pintarPrecargaEnHome` exista no prueba que la home la llame.
  const sf = arbol('homeView.js');
  let dentroDeRender = 0;
  recorrer(sf, (n) => {
    if (!ts.isFunctionDeclaration(n) || !n.name || n.name.text !== 'renderHomeView') return;
    recorrer(n, (m) => {
      if (ts.isCallExpression(m) && ts.isIdentifier(m.expression)
        && m.expression.text === 'pintarPrecargaEnHome') dentroDeRender += 1;
    });
  });
  assert.ok(dentroDeRender >= 1,
    '🔴 EL PROFESIONAL NO SABE QUÉ LLEVA ENCIMA: `renderHomeView` no llama a `pintarPrecargaEnHome`, '
    + 'así que quien abre la home no ve ni lo que lleva, ni que no lleva nada, ni que no hemos '
    + 'podido prepararlo. La función existiría y no la dispararía nadie.');
});

test('SCRUM-357 · 🔴 el arranque CONSUME lo que precarga, no lo tira', () => {
  // Éste es el defecto exacto que cierra el ticket: `precargarSiTocaAhora` guardaba los tres
  // resultados en `window` y NADIE los leía. Se vigila por AST y no por texto porque una llamada
  // suelta parece cableado y no lo es.
  const sf = arbol('app.js');
  let asignaciones = 0;
  let pintados = 0;
  recorrer(sf, (n) => {
    if (ts.isBinaryExpression(n) && ts.isPropertyAccessExpression(n.left)
      && n.left.name.text === 'precargaUltimoResultado'
      && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) asignaciones += 1;
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && n.expression.name.text === 'pintarPrecargaEnHome') pintados += 1;
  });

  assert.ok(asignaciones >= 1,
    '🔴 ESCÁNER CIEGO: no se ve ninguna asignación de `precargaUltimoResultado` en `app.js`. Si la '
    + 'precarga ha cambiado de sitio, este detector mide el vacío y hay que reapuntarlo.');
  assert.ok(pintados >= 1,
    '🔴 EL PROFESIONAL NO SABE QUÉ LLEVA ENCIMA. `app.js` precarga, guarda los tres resultados y no '
    + 'se los enseña a nadie: es el mismo desenlace que si la precarga no existiera, con el coste '
    + 'de haberla construido. Es el fallo mudo contra el que existe el bloque H entero.');

  // CONTROL POSITIVO DEL DETECTOR, dentro del mismo test: reconoce las formas que persigue.
  const muestra = ts.createSourceFile('x.js',
    'window.precargaUltimoResultado = r; window.pintarPrecargaEnHome(r);',
    ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let vistasAsig = 0; let vistasPint = 0;
  recorrer(muestra, (n) => {
    if (ts.isBinaryExpression(n) && ts.isPropertyAccessExpression(n.left)
      && n.left.name.text === 'precargaUltimoResultado'
      && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) vistasAsig += 1;
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && n.expression.name.text === 'pintarPrecargaEnHome') vistasPint += 1;
  });
  assert.equal(vistasAsig, 1, '🔴 el detector no ve una asignación que tiene delante.');
  assert.equal(vistasPint, 1, '🔴 el detector no ve un pintado que tiene delante.');
});

test('SCRUM-357 · 🔴 sin precargador NO se calla: eso también es «no supe mirar»', async () => {
  const b = montar();
  // La página donde el precargador no llegó a cargar. Antes esto devolvía `null` en silencio y
  // `precargaUltimoResultado` se quedaba sin valor PARA SIEMPRE — el único caso en que «la medida
  // aún no ha llegado» dejaba de ser un hueco y pasaba a ser mudez permanente.
  delete b.ctx.window.precargarAlbaranes;
  const caja = b.mk('div');
  caja.id = 'home-precarga';

  await b.ctx.precargarSiTocaAhora();

  assert.equal(b.ctx.precargaUltimoResultado.estado, b.ctx.NO_SE_PUDO,
    '🔴 sin precargador no se anota nada, así que la home no pintará nunca. No tener el mecanismo '
    + 'es el fallo MÁS grave de los tres, y era el único que se quedaba mudo.');
  assert.ok(String(caja.innerHTML).includes(b.ctx.TEXTO_PRECARGA.noSePudo),
    `🔴 se anota y no se pinta (${caja.innerHTML}).`);
});

// ── LA MICROCOPY, LITERAL Y EN UN SOLO SITIO ──────────────────────────────────────────────

test('SCRUM-357 · la microcopy APROBADA vive en la fuente única y no se copia', () => {
  const b = montar();
  assert.equal(typeof b.ctx.TEXTO_PRECARGA.nada, 'string');
  assert.equal(typeof b.ctx.TEXTO_PRECARGA.noSePudo, 'string');
  assert.notEqual(b.ctx.TEXTO_PRECARGA.nada, b.ctx.TEXTO_PRECARGA.noSePudo);

  // 🔴 QUIEN MIDE NO PINTA. `almacenLocal.js` precarga; el texto es de `estadoFirma.js`. Es la
  // misma frontera que `tests/scrum360-desalojo.test.mjs` impone a `resistenciaAlmacen.js`, y se
  // CUMPLE en vez de relajarla: si el texto se cuela en el medidor, la microcopy deja de estar
  // donde el asesor la aprueba.
  const publicadasEnElMedidor = [...leer('almacenLocal.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    .matchAll(/^window\.(MSG_\w+|TEXTO_\w+|COPY_\w+)\s*=/gm)].map((m) => m[1]);
  assert.deepEqual(publicadasEnElMedidor, [],
    `🔴 \`almacenLocal.js\` publica textos para pintar: ${publicadasEnElMedidor.join(', ')}. Quien `
    + 'mide no pinta — es la frontera que ya sostiene SCRUM-360 para H5.');

  // Y una sola copia de cada frase en todo el dashboard: dos textos que dicen lo mismo se separan,
  // y el que se separa siempre es el que nadie lee.
  for (const frase of [b.ctx.TEXTO_PRECARGA.nada, b.ctx.TEXTO_PRECARGA.noSePudo,
    'Llevas 1 albarán listo para firmar sin cobertura.']) {
    const donde = fs.readdirSync(DIR_JS).filter((f) => f.endsWith('.js'))
      .filter((f) => leer(f).includes(frase));
    assert.deepEqual(donde, ['estadoFirma.js'],
      `🔴 «${frase}» aparece en ${donde.join(', ')}. La microcopy aprobada vive en UN sitio; una `
      + 'segunda copia es como una de las dos deja de ser la aprobada.');
  }
});
