// tests/scrum356-tres-estados.test.mjs — SCRUM-356 (H2)
//
// LOS TRES SIGNIFICADOS DE «GUARDADO», EJERCITADOS.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA VÍCTIMA
//
// Una firma que el profesional CREE guardada y no lo está es PEOR que no poder firmar, porque se
// va de la obra tranquilo. Si no puede firmar lo sabe y busca salida —hace una foto, apunta el
// nombre, sube a la calle—. Si cree que firmó, no hace nada.
//
// De ahí sale lo único que este fichero vigila de verdad: **③ se afirma SÓLO con una señal
// positiva del servidor.** Todo lo demás cae a ①.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { montarAlmacen, porQueEstariaCiego } from './_banco-almacen-local.mjs';
import { portalCautivo, redNormal, aceptaYNoEntrega } from './_banco-red.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_JS = path.join(RAIZ, 'public/dashboard/js');

/** Una firma en la cola. `claveIdempotencia` es el keyPath del almacén (SCRUM-455). */
const firma = (albaranId, i = 0) => ({
  claveIdempotencia: `0f3d9c7a-1b2e-4a55-9c31-77e0a1b2c3d${i}`,
  albaranId,
  trazo: 'data:image/png;base64,AAAA',
});

// ── 🔴 SUELO ───────────────────────────────────────────────────────────────────────────────

test('SCRUM-356 · 🔴 SUELO: el banco monta el modelo, o se declara CIEGO', () => {
  const b = montarAlmacen(RAIZ);
  const ciego = porQueEstariaCiego(b, RAIZ);
  assert.equal(ciego, null, `🔴 BANCO CIEGO (almacén): ${ciego}`);

  for (const n of ['estadoDeLaFirma', 'estadoTrasIntentarSubir', 'confirmaElServidor',
    'textoDelContador', 'pendientesDeSubir', 'pintarEstadoDeFirma', 'pintarPendientesDeSubir',
    'hayFirmaEnColaDe', 'estadoDeLaFirmaDelAlbaran']) {
    assert.equal(typeof b.ctx[n], 'function',
      `🔴 el modelo de estados no publica \`${n}\`: todo lo de abajo mediría el vacío.`);
  }
  const tres = [b.ctx.FIRMA_SOLO_EN_ESTE_MOVIL, b.ctx.FIRMA_SUBIENDO, b.ctx.FIRMA_A_SALVO];
  assert.equal(new Set(tres).size, 3, '🔴 dos de los tres estados valen lo mismo: entonces no son tres.');
});

test('SCRUM-356 · 🔴 SUELO: ningún fichero del camino de estados FALLA AL CARGAR', () => {
  // Esto cazó un defecto real mientras se escribía el ticket: un comentario dentro del template
  // literal de `homeView.js` llevaba backticks, cerraba la cadena, y **el fichero entero dejaba de
  // cargar**. El navegador descarta el fichero completo ante un error de sintaxis, así que la home
  // se habría quedado EN BLANCO — el final exacto de `exportView.js`.
  //
  // Sin este suelo se ve como «la función no está publicada», que suena a olvido y es otra cosa.
  const b = montarAlmacen(RAIZ);
  const CAMINO = ['js/estadoFirma.js', 'js/homeView.js', 'js/albaranDetailView.js', 'js/almacenLocal.js'];
  const rotos = b.fallos.filter((f) => CAMINO.includes(f.fichero));
  assert.deepEqual(rotos, [],
    '🔴 UN FICHERO DEL CAMINO DE ESTADOS NO CARGA:\n    ' +
    rotos.map((f) => `${f.fichero} — ${f.error} ${f.sitio || ''}`).join('\n    ') +
    '\n\n  El navegador descarta el fichero ENTERO ante un error de carga: la pantalla que vive\n' +
    '  ahí se queda en blanco, y con red el resto del producto parece funcionar.');

  // SUELO DEL SUELO: si el banco dejara de cargar scripts, «ninguno roto» sería cierto y hueco.
  assert.ok(b.scripts.length >= 45,
    `🔴 ESCÁNER CIEGO: el banco sólo ve ${b.scripts.length} scripts del dashboard.`);
  for (const f of CAMINO) {
    assert.ok(b.scripts.includes(f), `🔴 «${f}» no está entre los <script src> del dashboard.`);
  }
});

// ── LA MICROCOPY APROBADA, LITERAL ─────────────────────────────────────────────────────────

test('SCRUM-356 · la microcopy aprobada está LITERAL, sin retocar', () => {
  // La aprueba el asesor y no se toca (regla 30). Se comprueba carácter a carácter porque el modo
  // de fallo típico no es borrarla: es «mejorarla» un poco.
  const b = montarAlmacen(RAIZ);
  const t = b.ctx.TEXTO_FIRMA;
  assert.equal(t[b.ctx.FIRMA_SOLO_EN_ESTE_MOVIL].etiqueta, 'Solo en este móvil');
  assert.equal(t[b.ctx.FIRMA_SOLO_EN_ESTE_MOVIL].detalle,
    'La firma está guardada solo en este móvil. Si lo pierdes, se pierde.');
  assert.equal(t[b.ctx.FIRMA_SUBIENDO].etiqueta, 'Subiendo…');
  assert.equal(t[b.ctx.FIRMA_SUBIENDO].detalle, null,
    '🔴 ② ha ganado un detalle. Es transitorio: un texto que aparece y desaparece en un segundo se ' +
    'lee a medias o no se lee.');
  assert.equal(t[b.ctx.FIRMA_A_SALVO].etiqueta, 'A salvo');
  assert.equal(t[b.ctx.FIRMA_A_SALVO].detalle, 'Guardado en YaQu. Ya no depende de este móvil.');
  assert.equal(b.ctx.TEXTO_NO_SE_PUDO_COMPROBAR, 'No hemos podido comprobar si te queda algo por subir.');
  // ⚠️ PROVISIONAL (SCRUM-358 fase 2): el texto de SCRUM-356 decía «suben cuando abres YaQu» y hoy
  // es FALSO — no hay drenado, así que una firma encolada sólo sube si el pro vuelve a firmar ese
  // albarán. Se revierte al de 356 cuando exista el drenado (fase 3). La reversión está escrita en
  // `docs/master/SCRUM-356.md`.
  assert.equal(b.ctx.TEXTO_SUBEN_AL_ABRIR,
    'Las firmas pendientes no suben solas todavía: vuelve a firmar el albarán cuando tengas cobertura.');
});

test('SCRUM-358 · 🔴 el aviso NO promete que las firmas suban solas', () => {
  // El guard del contenido, no de la letra: el de arriba fija el texto exacto y caería con
  // cualquier cambio, incluido uno bueno. Éste dice POR QUÉ no puede volver el texto viejo hasta
  // que exista el drenado, y por eso nombra la promesa concreta en vez de comparar cadenas.
  const b = montarAlmacen(RAIZ);
  const t = b.ctx.TEXTO_SUBEN_AL_ABRIR;

  assert.ok(!/suben cuando abres/i.test(t),
    '🔴 EL AVISO PROMETE QUE ABRIR LA APLICACIÓN SUBE LAS FIRMAS, y hoy no es verdad: el drenado ' +
    'es de la fase 3 y no existe. Una firma encolada sólo sube si el profesional vuelve a firmar ' +
    'ese albarán. En un bloque cuya regla es «ante la duda, se dice que NO subió», no se puede ' +
    'enviar un texto que promete más de lo que hay.\n\n' +
    '  Si el drenado YA existe, este guard es lo que hay que retirar — y entonces vuelve el texto ' +
    'de SCRUM-356, que es el aprobado para ese día.');

  // Y dice qué hacer, que es lo que lo hace útil: un aviso que sólo niega deja al pro sin salida.
  assert.ok(/vuelve a firmar/i.test(t),
    '🔴 el aviso ya no dice qué hacer. «No suben solas» sin la salida deja al profesional mirando ' +
    'la pantalla sin saber cómo poner su albarán a salvo.');

  // CONTROL POSITIVO DENTRO DEL MISMO TEST: el detector reconoce la promesa cuando está.
  assert.ok(/suben cuando abres/i.test('Las firmas pendientes suben cuando abres YaQu.'),
    '🔴 el detector no ve la promesa que tiene delante: su «no está» no valdría nada.');
});

test('SCRUM-356 · el contador dice singular y plural, y cuenta FIRMAS', () => {
  const b = montarAlmacen(RAIZ);
  assert.equal(b.ctx.textoDelContador(1), 'Te queda 1 firma por subir');
  assert.equal(b.ctx.textoDelContador(2), 'Te quedan 2 firmas por subir');
  assert.equal(b.ctx.textoDelContador(12), 'Te quedan 12 firmas por subir');
  // El número cuenta firmas en la cola, una por albarán firmado y no confirmado. En SCRUM-423 se
  // llegó a aprobar «N líneas» sobre un campo que sumaba CANTIDADES: habría pintado «2,5 líneas».
  assert.ok(!/[.,]/.test(b.ctx.textoDelContador(3)),
    '🔴 el contador pinta un decimal: no está contando firmas, está sumando otra cosa.');
});

// ── 🔴 EL CONTROL NEGATIVO DEL BLOQUE ──────────────────────────────────────────────────────

test('SCRUM-356 · 🔴 con el SERVIDOR EN ERROR la firma NO puede aparecer como «A salvo»', async () => {
  const b = montarAlmacen(RAIZ);
  const estado = await b.ctx.estadoTrasIntentarSubir(async () => { throw new Error('500'); });

  assert.notEqual(estado, b.ctx.FIRMA_A_SALVO,
    '🔴 SE ESTÁ DICIENDO «A SALVO» CON EL SERVIDOR EN ERROR. La firma sólo está en el móvil: el ' +
    'profesional se va de la obra creyendo que el albarán está subido.');
  assert.equal(estado, b.ctx.FIRMA_SOLO_EN_ESTE_MOVIL);
});

test('SCRUM-356 · 🔴 PORTAL CAUTIVO: 200 con HTML de login NO es una confirmación', async () => {
  // El caso real del bloque: wifi de obra que responde a todo con su pantalla de acceso. Se
  // ejercita el camino ENTERO —`apiRequest` de verdad contra el `fetch` del banco de SCRUM-362—,
  // no una simulación del resultado.
  const red = portalCautivo();
  const b = montarAlmacen(RAIZ, { dashboard: { red } });

  const estado = await b.ctx.estadoTrasIntentarSubir(
    () => b.ctx.apiRequest('/admin/albaranes/42/firmar', { method: 'POST' }),
  );

  // SUELO DEL ESCENARIO: si nadie pidió nada, no se ha cortado nada y el test pasaría por no
  // haberse ejercido.
  assert.ok(red.seEjercio(),
    `🔴 el escenario NO OCURRIÓ: ninguna petición llegó a la red. ${red.describir()}`);
  assert.notEqual(estado, b.ctx.FIRMA_A_SALVO,
    '🔴 UN PORTAL CAUTIVO ESTÁ PASANDO POR CONFIRMACIÓN DEL SERVIDOR. Devuelve 200 y su pantalla ' +
    'de acceso; el albarán no ha salido del móvil. Es el mismo defecto por el que `exportView.js` ' +
    'descarga un ZIP con la página de login del router dentro (SCRUM-356 §3).');
  assert.equal(estado, b.ctx.FIRMA_SOLO_EN_ESTE_MOVIL);
});

test('SCRUM-356 · 🔴 `navigator.onLine` a true SIN internet no cambia el estado', async () => {
  // Una LAN sin salida cuenta como estar conectado. Los dos escenarios del banco que mienten
  // exactamente así, con `onLine: true` los dos.
  //
  // ⚠️ EL MÉTODO NO ES INDIFERENTE, y lo aprendí colgando este test: el plazo de red de SCRUM-451
  // cubre **sólo GET**, a propósito y medido —abortar una mutación puede duplicar una factura—.
  // «Acepta y no entrega» con un POST no vuelve NUNCA, así que se ejercita con el método que ese
  // escenario puede cortar. El portal cautivo responde en el acto y da igual el método.
  const casos = [
    { hacerRed: portalCautivo, opciones: { method: 'POST' } },
    { hacerRed: aceptaYNoEntrega, opciones: undefined },   // GET: es el que tiene plazo
  ];

  for (const { hacerRed, opciones } of casos) {
    const red = hacerRed();
    const b = montarAlmacen(RAIZ, { dashboard: { red } });
    b.ctx.PLAZO_RED_MS = 50;   // el plazo real son 10 s; aquí sólo interesa que corte

    assert.equal(b.ctx.navigator.onLine, true,
      `🔴 el escenario «${red.nombre}» ya no miente: con onLine a false este test no probaría ` +
      'nada — el producto acertaría por el motivo equivocado.');

    const estado = await b.ctx.estadoTrasIntentarSubir(
      () => b.ctx.apiRequest('/admin/albaranes/42/firmar', opciones),
    );

    assert.ok(red.seEjercio(),
      `🔴 el escenario «${red.nombre}» NO OCURRIÓ: ${red.describir()}`);
    assert.equal(estado, b.ctx.FIRMA_SOLO_EN_ESTE_MOVIL,
      `🔴 con «${red.nombre}» y \`navigator.onLine === true\` el estado NO es ①. Estar conectado a ` +
      'una red no es haber entregado nada: ② lo declara una RESPUESTA DEL SERVIDOR.');
  }
});

test('SCRUM-356 · ✅ CONTROL POSITIVO: con red normal SÍ se llega a «A salvo»', async () => {
  // Sin esto, todo lo de arriba lo cumpliría un producto que dijera ① siempre — que es lo fácil de
  // escribir y no sirve para nada.
  const red = redNormal({ id: 42, estado: 'firmado' });
  const b = montarAlmacen(RAIZ, { dashboard: { red } });

  const estado = await b.ctx.estadoTrasIntentarSubir(
    () => b.ctx.apiRequest('/admin/albaranes/42/firmar', { method: 'POST' }),
  );
  assert.equal(estado, b.ctx.FIRMA_A_SALVO,
    '🔴 ni con el servidor respondiendo bien se llega a ③: entonces los negativos de arriba no ' +
    'prueban nada, sólo que el modelo dice ① pase lo que pase.');
});

test('SCRUM-356 · 🔴 la ASIMETRÍA: sólo `true` afirma ③, ni «casi» ni «probablemente»', () => {
  const b = montarAlmacen(RAIZ);
  for (const casi of [1, 'sí', 'ok', {}, [], 'true']) {
    assert.equal(b.ctx.estadoDeLaFirma({ confirmadaPorElServidor: casi }),
      b.ctx.FIRMA_SOLO_EN_ESTE_MOVIL,
      `🔴 un valor «casi verdadero» (${JSON.stringify(casi)}) está afirmando que el albarán está a ` +
      'salvo. Un falso «pendiente» cuesta una comprobación; un falso «a salvo» cuesta el albarán.');
  }
  assert.equal(b.ctx.estadoDeLaFirma({}), b.ctx.FIRMA_SOLO_EN_ESTE_MOVIL,
    '🔴 sin saber nada, el estado por defecto no es ①. Ante la duda se dice que NO subió.');
  assert.equal(b.ctx.estadoDeLaFirma({ confirmadaPorElServidor: true }), b.ctx.FIRMA_A_SALVO);
  assert.equal(b.ctx.estadoDeLaFirma({ subiendo: true }), b.ctx.FIRMA_SUBIENDO);
  assert.equal(b.ctx.estadoDeLaFirma({ subiendo: true, confirmadaPorElServidor: true }),
    b.ctx.FIRMA_A_SALVO, '🔴 «subiendo» está tapando una confirmación que ya llegó.');
});

test('SCRUM-356 · 🔴 un cuerpo que es HTML no confirma, aunque llegue como respuesta', () => {
  const b = montarAlmacen(RAIZ);
  for (const html of ['<!doctype html><html>…', '<html><body>Acceso Wi-Fi', '  <form>']) {
    assert.equal(b.ctx.confirmaElServidor(html), false,
      `🔴 «${html.slice(0, 20)}…» pasa por confirmación del servidor.`);
  }
  // CONTROL POSITIVO DENTRO DEL MISMO TEST: una respuesta de verdad sí confirma, o el detector
  // estaría diciendo «no» a todo.
  assert.equal(b.ctx.confirmaElServidor({ id: 42 }), true);
  assert.equal(b.ctx.confirmaElServidor(''), true, '🔴 un 204 sin cuerpo debería seguir confirmando.');
  assert.equal(b.ctx.confirmaElServidor(null), false);
  assert.equal(b.ctx.confirmaElServidor(undefined), false);
});

// ── 🔴 EL SUELO DE LA COLA ─────────────────────────────────────────────────────────────────

test('SCRUM-356 · 🔴 si no se puede leer la cola NO se dice «0 pendientes»', async () => {
  // «Nada pendiente» y «no supe mirar» son la misma pantalla y significan lo contrario, y aquí el
  // segundo le está diciendo al profesional que está todo a salvo.
  const b = montarAlmacen(RAIZ, { sinIndexedDB: true });
  const r = await b.ctx.pendientesDeSubir();

  assert.equal(r.sabemos, false);
  assert.equal(r.texto, b.ctx.TEXTO_NO_SE_PUDO_COMPROBAR,
    '🔴 sin poder leer la cola se está diciendo otra cosa. El texto del suelo es DISTINTO, no el ' +
    'mismo con un cero.');
  assert.notEqual(r.n, 0,
    '🔴 SE ESTÁ REPORTANDO 0 PENDIENTES SIN HABER PODIDO MIRAR. Es la pantalla que tranquiliza a ' +
    'un profesional que tiene una firma sin subir.');

  const pintado = b.ctx.pintarPendientesDeSubir(r);
  assert.ok(pintado.includes(b.ctx.TEXTO_NO_SE_PUDO_COMPROBAR),
    '🔴 el aviso no llega a pintarse: el suelo existiría en el modelo y no en la pantalla.');
  assert.ok(!/\b0\b/.test(pintado), '🔴 aparece un 0 en la pantalla de «no lo sé».');
});

test('SCRUM-356 · ✅ CONTROL POSITIVO: el contador VE las firmas sembradas en la cola', async () => {
  // Una cola vacía hace verdad cualquier «no queda nada»: hay que sembrarla dentro del mismo test.
  const b = montarAlmacen(RAIZ);

  const vacia = await b.ctx.pendientesDeSubir();
  assert.equal(vacia.sabemos, true);
  assert.equal(vacia.n, 0);
  assert.equal(vacia.texto, null, '🔴 se pinta algo sin haber nada pendiente y sin microcopy para ello.');

  await b.ctx.guardarFirmaPendiente(firma(42, 1));
  const una = await b.ctx.pendientesDeSubir();
  assert.equal(una.n, 1, '🔴 el contador NO ve una firma que está en la cola.');
  assert.equal(una.texto, 'Te queda 1 firma por subir');

  await b.ctx.guardarFirmaPendiente(firma(43, 2));
  await b.ctx.guardarFirmaPendiente(firma(44, 3));
  const tres = await b.ctx.pendientesDeSubir();
  assert.equal(tres.n, 3);
  assert.equal(tres.texto, 'Te quedan 3 firmas por subir');

  // Y el hueco se declara EN LA PANTALLA: si el producto no avisa solo y el pro cree que sí,
  // hemos construido el fallo mudo un piso más arriba.
  const pintado = b.ctx.pintarPendientesDeSubir(tres);
  assert.ok(pintado.includes('Te quedan 3 firmas por subir'));
  assert.ok(pintado.includes(b.ctx.TEXTO_SUBEN_AL_ABRIR),
    '🔴 NO SE DICE QUE NADIE LAS SUBE SOLO. En iOS no hay aviso automático (Background Sync es 0 % ' +
    'en Safari) y hoy tampoco lo hay en ningún otro navegador, porque el drenado es de H3. Callarlo ' +
    'es vender vigilancia que no existe.');
});

// ── EL ESTADO DE UN ALBARÁN CONCRETO ───────────────────────────────────────────────────────

test('SCRUM-356 · 🔴 la cola sólo DEGRADA: una firma pendiente baja el albarán a ①', () => {
  const b = montarAlmacen(RAIZ);
  const cola = [firma(42, 1), firma(43, 2)];

  assert.equal(b.ctx.estadoDeLaFirmaDelAlbaran(42, true, cola), b.ctx.FIRMA_SOLO_EN_ESTE_MOVIL,
    '🔴 el albarán 42 tiene una firma SIN SUBIR y se está pintando como «A salvo». Entre «el ' +
    'servidor lo tiene» y «este móvil cree que aún debe subirlo», gana la lectura que no promete nada.');

  // CONTROL POSITIVO en el mismo test: uno que NO está en la cola sí llega a ③, o el mecanismo
  // estaría degradando todo y el guard de arriba pasaría por el motivo equivocado.
  assert.equal(b.ctx.estadoDeLaFirmaDelAlbaran(99, true, cola), b.ctx.FIRMA_A_SALVO,
    '🔴 un albarán que NO está en la cola tampoco llega a ③: se está degradando todo.');

  // Y sin señal del servidor, ①, aunque la cola esté vacía.
  assert.equal(b.ctx.estadoDeLaFirmaDelAlbaran(99, false, []), b.ctx.FIRMA_SOLO_EN_ESTE_MOVIL);
  // El id se compara como texto: la API puede devolver número y la cola guardar cadena.
  assert.equal(b.ctx.estadoDeLaFirmaDelAlbaran('42', true, cola), b.ctx.FIRMA_SOLO_EN_ESTE_MOVIL);
});

// ── PROHIBICIONES, CON MECANISMO ───────────────────────────────────────────────────────────

test('SCRUM-356 · 🔴 ninguna etiqueta dice «guardado» a secas: todas dicen DÓNDE', () => {
  const b = montarAlmacen(RAIZ);
  // «Guardado» a secas afirma ③ teniendo sólo ①. Cada etiqueta tiene que situar la firma —«este
  // móvil», «a salvo»— o declarar movimiento («Subiendo…»).
  const SITUA = /móvil|salvo|subiendo|yaqu/i;
  for (const [estado, t] of Object.entries(b.ctx.TEXTO_FIRMA)) {
    assert.ok(SITUA.test(t.etiqueta),
      `🔴 la etiqueta de ${estado} es «${t.etiqueta}» y no dice DÓNDE está la firma. Un «Guardado» ` +
      'a secas afirma que está en el servidor teniendo sólo el móvil.');
    assert.ok(!/^\s*(guardad[oa]|hecho|listo|ok)\s*$/i.test(t.etiqueta),
      `🔴 la etiqueta de ${estado} es una palabra que no significa nada por sí sola.`);
  }
});

test('SCRUM-356 · 🔴 el pintado NUNCA es un tic sin palabras', () => {
  // Un tic verde ES «guardado a secas» dibujado: afirma que está a salvo sin decir dónde, y el
  // color no puede ser el único canal (DESIGN.md, y AA).
  const b = montarAlmacen(RAIZ);
  for (const estado of [b.ctx.FIRMA_SOLO_EN_ESTE_MOVIL, b.ctx.FIRMA_SUBIENDO, b.ctx.FIRMA_A_SALVO]) {
    const html = b.ctx.pintarEstadoDeFirma(estado);
    const soloTexto = html.replace(/<[^>]*>/g, '').trim();
    assert.ok(soloTexto.length >= 7,
      `🔴 ${estado} se pinta con ${soloTexto.length} caracteres de texto («${soloTexto}»): eso es ` +
      'un icono, no una explicación.');
    assert.ok(!/^[✓✔√●•]+$/.test(soloTexto),
      `🔴 ${estado} se pinta como un tic sin palabras. Un tic verde es «guardado a secas» dibujado.`);
    assert.ok(html.includes(b.ctx.TEXTO_FIRMA[estado].etiqueta),
      `🔴 ${estado} no pinta su etiqueta aprobada.`);
  }
  // Y ③ lleva su detalle, que es donde dice que ya no depende del móvil.
  assert.ok(b.ctx.pintarEstadoDeFirma(b.ctx.FIRMA_A_SALVO).includes('Ya no depende de este móvil'));
});

test('SCRUM-356 · 🔴 `navigator.onLine` NO aparece en el camino de estados', () => {
  // Hoy tiene CERO usos en todo el árbol (medido en SCRUM-356 §2): la regla se cumple por
  // construcción, no por disciplina. Lo que hace falta es IMPEDIR QUE APAREZCA.
  //
  // ⚠️ AST y no `grep`: este repo está lleno de comentarios que EXPLICAN por qué no se usa
  // `onLine` —`api.js:201` es uno— y un guard de texto se cazaría a sí mismo en ellos.
  const CAMINO = ['estadoFirma.js', 'albaranDetailView.js', 'homeView.js', 'almacenLocal.js', 'api.js'];
  const culpables = [];
  for (const f of CAMINO) {
    const codigo = fs.readFileSync(path.join(DIR_JS, f), 'utf8');
    const sf = ts.createSourceFile('x.js', codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    (function walk(n) {
      if (ts.isPropertyAccessExpression(n) && n.name.text === 'onLine') {
        culpables.push(`${f}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`);
      }
      ts.forEachChild(n, walk);
    })(sf);
  }
  assert.deepEqual(culpables, [],
    `🔴 \`navigator.onLine\` HA ENTRADO EN EL CAMINO DE ESTADOS: ${culpables.join(', ')}.\n\n` +
    '  Una LAN sin salida cuenta como estar conectado, y el caso real de este bloque es ése: wifi\n' +
    '  de obra, portal cautivo, 4G que abre el socket y muere. Un ② decidido por `onLine` es un\n' +
    '  falso «enviado». ② lo declara una RESPUESTA DEL SERVIDOR.');

  // CONTROL POSITIVO DEL ESCÁNER, dentro del mismo test: una lista de ficheros que no se leyera,
  // o un detector roto, daría este mismo `[]`.
  const sintetico = ts.createSourceFile('x.js', 'if (navigator.onLine) subir();',
    ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let visto = 0;
  (function walk(n) {
    if (ts.isPropertyAccessExpression(n) && n.name.text === 'onLine') visto += 1;
    ts.forEachChild(n, walk);
  })(sintetico);
  assert.equal(visto, 1, '🔴 el detector no ve un `navigator.onLine` que tiene delante.');
  assert.ok(CAMINO.every((f) => fs.existsSync(path.join(DIR_JS, f))),
    '🔴 alguno de los ficheros del camino no existe: el censo estaría mirando al vacío.');
});

// ── QUE LA SUPERFICIE ESTÉ CABLEADA DE VERDAD ──────────────────────────────────────────────

test('SCRUM-356 · 🔴 la home PINTA el aviso, y no sólo lo sabe calcular', async () => {
  // Mencionar no es hacer: que `pendientesDeSubir` exista no prueba que nadie la llame.
  const b = montarAlmacen(RAIZ);
  assert.equal(typeof b.ctx.pintarFirmasPendientesEnHome, 'function',
    '🔴 la home no publica el pintado del aviso.');

  await b.ctx.guardarFirmaPendiente(firma(42, 1));

  const caja = b.mk('div');
  caja.id = 'home-firmas-pendientes';
  await b.ctx.pintarFirmasPendientesEnHome();

  assert.ok(String(caja.innerHTML).includes('Te queda 1 firma por subir'),
    '🔴 EL AVISO NO LLEGA A LA PANTALLA. El modelo lo calcula y nadie lo pinta: el profesional no ' +
    'se entera de que tiene una firma sin subir.');
  assert.ok(String(caja.innerHTML).includes(b.ctx.TEXTO_SUBEN_AL_ABRIR));
});
