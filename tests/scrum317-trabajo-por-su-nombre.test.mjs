// SCRUM-317 (G2) · EL TRABAJO SE LLAMA POR SU NOMBRE, Y NUNCA «· undefined».
//
// Sin gate: lee tres ficheros y ejercita la composición del título con un doble. Ni BD, ni red,
// ni navegador.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ VIGILA, Y POR QUÉ ESE Y NO OTRO
//
// El defecto que se arregla no es de estilo: el objeto central del producto se presentaba como
// una fase del presupuesto («Presupuesto #2 · Francisco Jiménez»). Lo que puede volver es que
// alguien vuelva a autogenerar un título, o que al componerlo con datos que faltan salga un
// separador colgando — que es la forma barata de romper esto.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ejecutableDe } from './_guard-texto.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');
const VISTA = leer('public/dashboard/js/jobDetailView.js');

/**
 * ⚠️ LA VISTA SIN COMENTARIOS, para los tests que PROHÍBEN un literal.
 *
 * La primera versión de este guard dio rojo contra sus propios comentarios: los que explican
 * «las migas dicen Trabajos ›, no Presupuestos ›» y «el subtítulo "Detalle del trabajo, cobros
 * y documentos" desaparece» contienen, necesariamente, el texto que prohíben.
 *
 * Es la trampa de autorreferencia que este repo ya tiene documentada, y por eso existe
 * `_guard-texto.mjs`: **para vigilar código hay que leer código, no prosa.** Los tests que
 * EXIGEN algo pueden usar el fichero entero; los que PROHÍBEN, solo lo ejecutable.
 */
// SUELO (SCRUM-719): la vista tiene que seguir publicando su función. Sin esto, las dos
// prohibiciones de abajo (migas y subtítulo) pasaban sobre la cadena vacía.
const VISTA_CODIGO = ejecutableDe(VISTA, {
  ancla: 'renderJobDetailView', donde: 'jobDetailView.js', almohadillaEsComentario: false,
});
const SERVICIO = leer('src/modules/jobs/domain/job.service.ts');
const RUTAS = leer('src/modules/jobs/app/routes/jobs.routes.ts');

/**
 * TODO RECORTE COMPRUEBA SUS DOS EXTREMOS (criterio de SCRUM-244).
 * `indexOf` devuelve -1 y `slice(inicio, -1)` NO falla: se lleva el fichero entero menos un
 * carácter, y el rojo que sale no es el tuyo.
 */
function recorte(texto, desde, hasta, etiqueta) {
  const i = texto.indexOf(desde);
  assert.ok(i >= 0, `🔴 ESCÁNER CIEGO: no encuentro el INICIO de ${etiqueta} («${desde}»)`);
  const j = texto.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `🔴 ESCÁNER CIEGO: no encuentro el FIN de ${etiqueta} («${hasta}»)`);
  return texto.slice(i, j);
}

// ── La composición, replicada EXACTAMENTE como la vista la hace ──────────────────────────
// No se importa de la vista (es un script de navegador, sin módulos): se replica y se comprueba
// aparte que la vista use `unirCon` y no una concatenación a mano. Las dos mitades juntas son
// lo que impide que vuelva el `· undefined`.
const unirCon = (sep, ...partes) => partes
  .map((p) => (p == null ? '' : String(p).trim()))
  .filter(Boolean)
  .join(sep);

test('SCRUM-317 · el Trabajo YA NO nace llamándose «Presupuesto #N»', () => {
  assert.ok(
    !/const titulo = `Presupuesto #/.test(SERVICIO),
    '🔴 HA VUELTO LA AUTOGENERACIÓN DEL TÍTULO.\n\n' +
      '  `job.service.ts` vuelve a componer `Presupuesto #<num> · <cliente>` y guardarlo en\n' +
      '  `Job.titulo`. Eso es el defecto entero de este ticket: el objeto central del producto\n' +
      '  presentándose como una fase del presupuesto. El Trabajo nace SIN título y lo pone el pro.',
  );
  // SUELO: el fichero tiene que seguir creando Trabajos, o el test de arriba sería cierto por
  // vacío. Y ya ha servido: SCRUM-195 renombró `prisma` a `prismaClient` en esta función, y este
  // suelo lo cazó en el rebase en vez de dejar pasar la prohibición sin medir nada. Por eso el
  // ancla admite las dos formas — lo que importa es que AQUÍ se cree el Job, no cómo se llame el
  // cliente de Prisma.
  assert.ok(
    /prisma(Client)?\.job\.create/.test(SERVICIO),
    '🔴 ESCÁNER CIEGO: `job.service.ts` ya no crea Trabajos. Si la creación se movió, este test ' +
      'está midiendo un fichero que no hace lo que cree.',
  );
});

test('SCRUM-317 · el PATCH acepta `titulo` — sin eso, el campo sigue sin escribirse', () => {
  const patch = recorte(RUTAS, "req.body?.notes !== undefined", 'assignedUserId !== undefined', 'el PATCH');
  assert.ok(
    /req\.body\?\.titulo !== undefined/.test(patch),
    '🔴 el PATCH de Trabajos NO acepta `titulo`.\n\n' +
      '  `Job.titulo` existe desde SCRUM-10 y NINGUNA ruta lo escribía (medido en SCRUM-309 §4):\n' +
      '  se rellenaba al crear y se quedaba así para siempre. Abrir esta escritura es TODO lo que\n' +
      '  hacía falta para G2 — cero cambios de schema.',
  );
  assert.ok(
    /data\.titulo = String\(req\.body\.titulo \|\| ''\)\.trim\(\)[\s\S]{0,40}\|\| null/.test(RUTAS),
    '🔴 `titulo` no se normaliza a `null` cuando llega vacío. Con `\'\'` habría DOS formas de ' +
      '«sin nombre» y la pantalla tendría que distinguirlas para decidir si pinta el separador.',
  );
});

test('SCRUM-317 · CASO SIN NOMBRE: el título es el cliente y no cuelga ningún separador', () => {
  const cliente = 'Francisco Jiménez';
  assert.equal(unirCon(' · ', '', '24 jun'), '24 jun', '🔴 separador colgando con nombre vacío');
  assert.equal(unirCon(' · ', null, '24 jun'), '24 jun', '🔴 separador colgando con nombre null');
  assert.equal(unirCon(' · ', undefined, '24 jun'), '24 jun', '🔴 separador colgando con undefined');
  assert.equal(unirCon(' · ', '   ', '24 jun'), '24 jun', '🔴 un nombre de solo espacios pinta separador');
  assert.equal(unirCon(' · ', cliente, ''), cliente, '🔴 separador colgando por la derecha');

  for (const compuesto of [
    unirCon(' · ', null, '24 jun'),
    unirCon(' · ', cliente, undefined),
    unirCon(' · ', cliente, null),
  ]) {
    assert.ok(!/undefined|null/.test(compuesto), `🔴 «${compuesto}» lleva undefined/null dentro`);
    assert.ok(!/^·|·$|· *·/.test(compuesto.trim()), `🔴 «${compuesto}» tiene un separador colgando`);
  }
});

test('SCRUM-317 · CASO SIN PRESUPUESTO: el título sigue siendo válido', () => {
  // G0 confirmó que `Job.quoteId` es `Int?`: un Trabajo sin presupuesto de origen es posible.
  // El título no depende del presupuesto para nada.
  //
  // ── RE-ANCLAJE (SCRUM-917f) ────────────────────────────────────────────────────────────
  // Este test exigía por fuente `h2.textContent = nombreCliente || 'Trabajo'`. 917f cambia la
  // cabecera: el TÍTULO pasa a ser el nombre del TRABAJO, porque el cliente salía tres veces en
  // los 139 px de la cabecera (migas, título y subtítulo) y ya vive entero en el rail, con su
  // teléfono. La SUPERFICIE cambia; el PRINCIPIO que este test defiende no:
  //
  //   «el título NO depende del presupuesto — si dependiera, un Trabajo sin presupuesto se
  //    quedaría sin título, y ese caso existe.»
  //
  // Por eso el ancla nuevo sigue siendo por fuente y sigue siendo la MISMA línea: lo que se
  // comprueba es que las dos ramas del título salen de `job` (nombre del trabajo → cliente →
  // literal) y NINGUNA de `job.quote`. Se re-ancla, no se borra: borrarlo dejaría abierto
  // exactamente el camino por el que volvió «Presupuesto #2 · Francisco Jiménez».
  const sinQuote = { customer: { name: 'Ana Ruiz' }, titulo: null, quote: null };
  assert.equal(unirCon(' · ', sinQuote.customer.name, sinQuote.titulo || ''), 'Ana Ruiz');
  assert.ok(
    /h2\.textContent = nombreTrabajo \|\| nombreCliente \|\| 'Trabajo'/.test(VISTA),
    '🔴 el título ha dejado de ser «el trabajo, y si no tiene nombre, el cliente».\n\n' +
      '  Las dos ramas salen de datos que NO pueden faltar por culpa del presupuesto: el nombre\n' +
      '  que le puso el pro, y el cliente (`customerId` es NOT NULL). Si el título vuelve a\n' +
      '  depender de `job.quote`, un Trabajo sin presupuesto se queda sin título — y ese caso\n' +
      '  existe, `Job.quoteId` es `Int?`.',
  );
  // La mitad que hace verdad a la de arriba: la CADENA DE RESERVA, ejercitada con los tres casos
  // que llegan de verdad. Sin esto, el ancla de fuente pasaría con un `||` escrito al revés.
  const tituloDe = (j) => (j.titulo || '').trim() || (j.customer?.name || '').trim() || 'Trabajo';
  assert.equal(tituloDe({ titulo: 'Reforma baño', customer: { name: 'Ana Ruiz' }, quote: null }), 'Reforma baño');
  assert.equal(tituloDe({ titulo: null, customer: { name: 'Ana Ruiz' }, quote: null }), 'Ana Ruiz');
  assert.equal(tituloDe({ titulo: '   ', customer: { name: 'Ana Ruiz' }, quote: null }), 'Ana Ruiz',
    '🔴 un nombre de solo espacios deja el título en blanco en vez de caer al cliente');
  assert.equal(tituloDe({ titulo: null, customer: null, quote: null }), 'Trabajo');
});

test('SCRUM-317 · el CLIENTE no desaparece de la cabecera: baja al subtítulo', () => {
  // 🔴 RE-ANCLAJE CON DEUDA: al quitar el cliente del título y de la miga, el riesgo nuevo es
  // perderlo de vista. NO se pierde — baja al subtítulo, que es donde el prototipo aprobado lo
  // pone (`docs/prototipos/SCRUM-917/trabajos.html`, fila D del inventario: «Título = el NOMBRE
  // DEL TRABAJO (o el cliente si no tiene); subtítulo = cliente · fecha · presupuesto»).
  // Se mide sobre la ventana de la cabecera, no sobre el fichero entero, para que un `nombreCliente`
  // cualquiera de otras 1.500 líneas no haga verdad esto por casualidad.
  const cabecera = recorte(VISTA, 'const unirCon =', 'const nombreWrap', 'la cabecera');
  assert.ok(
    /sub\.textContent = unirCon\([^)]*nombreCliente/.test(cabecera),
    '🔴 el cliente ha desaparecido de la cabecera del todo. Sale del título y de la miga porque\n' +
      '  se decía tres veces, no porque sobre: tiene que quedar UNA, y es el subtítulo.',
  );
});

test('SCRUM-317 · la vista COMPONE con `unirCon`, no a mano', () => {
  // Es la mitad que hace verdad al test de arriba: replicar la función no prueba nada si la
  // vista concatena por su cuenta en otro sitio.
  assert.ok(/const unirCon =/.test(VISTA), '🔴 `unirCon` ha desaparecido de la vista');
  const cabecera = recorte(VISTA, 'const unirCon =', 'const nombreWrap', 'la cabecera');
  // ── RE-ANCLAJE (SCRUM-917f) ──────────────────────────────────────────────────────────────
  // Esta línea exigía `migaActual.textContent = unirCon(`. 917f retira la miga actual entera: el
  // prototipo aprobado deja las migas en «Trabajos ›» y punto, porque decían el cliente DOS veces
  // ellas solas. Exigir hoy esa línea sería exigir que vuelva el defecto.
  //
  // El principio no se mueve ni un milímetro —«esta vista no concatena a mano, porque ése es el
  // camino por el que vuelve el `· undefined`»— pero ahora está ENTERO en el subtítulo, que pasó
  // de componer DOS partes a componer TRES (cliente · fecha · presupuesto). O sea: más superficie
  // expuesta al defecto que antes, no menos. Por eso la exigencia se queda, sobre esa línea.
  assert.ok(
    /sub\.textContent = unirCon\(/.test(cabecera),
    '🔴 el subtítulo se compone sin `unirCon`. Ese es el camino por el que vuelve el ' +
      '`· undefined`: una plantilla con un `${}` que puede venir vacío. Y ahora compone TRES ' +
      'partes —cliente, fecha y presupuesto—, cualquiera de las cuales puede faltar.',
  );
  assert.ok(
    !/`\$\{[^}]*titulo[^}]*\} · \$\{/.test(cabecera),
    '🔴 hay una plantilla que concatena el título con un separador fijo',
  );
});

test('SCRUM-317 · las migas dicen «Trabajos ›», no «Presupuestos ›»', () => {
  assert.ok(
    /migaTrabajos\.textContent = 'Trabajos'/.test(VISTA),
    '🔴 la miga no dice «Trabajos». Suena obvio, y es exactamente el defecto que se arregla.',
  );
  assert.ok(
    /migaSep\.textContent = '›'/.test(VISTA),
    '🔴 falta el separador de migas',
  );
  assert.ok(
    !/Presupuestos ›|migaTrabajos\.textContent = 'Presupuesto/.test(VISTA_CODIGO),
    '🔴 las migas hablan de Presupuestos',
  );
});

test('SCRUM-317 · las migas dicen «Trabajos ›» Y SE ACABAN AHÍ', () => {
  // RE-ANCLAJE (SCRUM-917f), la otra mitad del de arriba. La miga actual repetía «cliente ·
  // trabajo» tres píxeles debajo del título y del subtítulo, que dicen lo mismo. Se retira.
  //
  // 🔒 No basta con vaciar el texto: se comprueba que `migaActual` NO EXISTE en la vista. Un span
  // vacío en el DOM se lee igual que ninguno en una captura, pero sigue siendo el sitio por el que
  // esto vuelve — basta una línea que le asigne `textContent` en otro corte y nadie lo nota.
  assert.ok(
    !/migaActual/.test(VISTA_CODIGO),
    '🔴 ha vuelto la miga actual. Las migas dicen DÓNDE ESTÁS —«Trabajos ›»—, no QUÉ ESTÁS\n' +
      '  MIRANDO: eso ya lo dicen el título y el subtítulo, justo debajo y con más tamaño.\n' +
      '  Con ella, «María López» salía CINCO veces en la pantalla, tres de ellas en los 139 px\n' +
      '  de la cabecera.',
  );
  // ✅ SUELO: si `VISTA_CODIGO` viniera vacía o el extractor se descarrilara, la negación de
  // arriba sería un verde permanente. Las dos migas que SÍ se quedan tienen que verse desde aquí.
  assert.match(VISTA_CODIGO, /migaTrabajos\.textContent = 'Trabajos'/,
    '🔴 ESCÁNER CIEGO: no veo ni la miga que se queda; la prohibición de arriba no mide nada.');
  assert.match(VISTA_CODIGO, /migaSep\.textContent = '›'/,
    '🔴 ESCÁNER CIEGO: no veo el separador de migas en el ejecutable.');
});

test('SCRUM-317 · el subtítulo que describía LA PANTALLA ha desaparecido', () => {
  assert.ok(
    !/Detalle del trabajo, cobros y documentos/.test(VISTA_CODIGO),
    '🔴 ha vuelto «Detalle del trabajo, cobros y documentos». Describe la pantalla, no el ' +
      'trabajo — y dónde estás ya lo dicen las migas.',
  );
});

test('SCRUM-317 · la fecha del subtítulo es NEUTRA: nada de «desde el»', () => {
  // 🔒 LA VENTANA SE CIERRA DONDE ACABA EL SUBTÍTULO, no 250 líneas después. El corte iba de
  // `const fechaCorta =` a `const nombreWrap`, que son **252 líneas**: dentro caben el CTA del
  // héroe y todos sus comentarios, así que cualquier PROSA que dijera «desde el» tumbaba un test
  // sobre el subtítulo. Pasó con SCRUM-823, que escribió «puede asomar desde el CTA» a 120 líneas
  // de aquí. Una ventana de más no es más vigilancia: es un fallo que apunta al sitio equivocado.
  // El nuevo cierre —`migaActual.textContent`— va DOS líneas después de `sub.textContent`, así que
  // sigue cubriendo entera la composición que este test juzga.
  // ⚠️ RE-ANCLAJE (SCRUM-917f): ese cierre era `migaActual.textContent`, y 917f retira esa línea.
  // El cierre nuevo —`sub.style.display`— va UNA línea después de `sub.textContent`, así que la
  // ventana se estrecha todavía más y sigue cubriendo entera la composición que este test juzga.
  // No se ensancha buscando otra referencia lejana: eso es justo lo que mordió a SCRUM-823.
  const cabecera = recorte(VISTA, 'const fechaCorta =', 'sub.style.display', 'la fecha del subtítulo');
  assert.ok(
    !/desde el/i.test(cabecera),
    '🔴 el subtítulo dice «desde el». El Trabajo tiene CINCO estados y eso suena a abierto en uno ' +
      '`terminado` o `cerrado`. La fecha sola es verdad en los cinco.',
  );
  assert.ok(
    /day: 'numeric', month: 'short'/.test(cabecera),
    '🔴 la fecha del subtítulo ha dejado de ser corta y neutra (día + mes)',
  );
});

test('SCRUM-317 · el campo de nombre existe, con su microcopy aprobada', () => {
  assert.ok(/id="job-nombre"|nombreInput\.id = 'job-nombre'/.test(VISTA), '🔴 no hay campo de nombre');
  assert.ok(
    /nombreLabel\.textContent = 'Nombre del trabajo'/.test(VISTA),
    '🔴 la etiqueta del campo no es la aprobada: «Nombre del trabajo»',
  );
  assert.ok(
    /nombreInput\.placeholder = 'Ej\. Reforma baño'/.test(VISTA),
    '🔴 el marcador del campo no es el aprobado: «Ej. Reforma baño»',
  );
  assert.ok(
    /method: 'PATCH', body: \{ titulo/.test(VISTA),
    '🔴 el campo no guarda con PATCH: sería una caja de texto que no escribe nada, que es el ' +
      'estado del que venimos.',
  );
});

test('SCRUM-317 · NOMBRES LARGOS: el título trunca en vez de empujar la cabecera', () => {
  // ── RE-ANCLAJE (SCRUM-917f) ──────────────────────────────────────────────────────────────
  // Este test vigilaba `.detail-miga-actual`, y 917f retira esa miga. El principio es el que
  // importa y NO se mueve: **un nombre largo trunca, no empuja.** Lo que cambia es DÓNDE vive el
  // nombre largo. Antes estaba en la miga; ahora está en el H2 (el nombre del trabajo, que lo
  // escribe el pro a mano y puede ser cualquier cosa) y en el subtítulo (cliente · fecha ·
  // presupuesto, tres partes). O sea: el riesgo no baja al mudarse, SUBE — el H2 va a 18 px y
  // comparte fila con el chip de estado y con la barra de acciones.
  //
  // 🔒 Dejar el test sobre `.detail-miga-actual` habría sido un verde permanente sobre una regla
  // CSS que ya no pinta nada. Se re-ancla a las dos cajas que hoy sí llevan el nombre.
  const CSS = leer('public/dashboard/css/styles.css');
  for (const [sel, etiqueta] of [
    ['.detail-head h2', 'el título del detalle'],
    ['.detail-head .detail-sub', 'el subtítulo del detalle'],
  ]) {
    const bloque = recorte(CSS, sel, '}', `el estilo de ${etiqueta}`);
    for (const prop of ['text-overflow: ellipsis', 'white-space: nowrap', 'overflow: hidden', 'min-width: 0']) {
      assert.ok(
        bloque.includes(prop),
        `🔴 ${etiqueta} no lleva «${prop}». Un trabajo con nombre largo MÁS un cliente con ` +
          'nombre largo empujarían el chip de estado y la barra de acciones — el caso que más ' +
          'falla en el pase de dispositivos.',
      );
    }
  }
  assert.ok(
    recorte(CSS, '.detail-migas', '}', 'el contenedor de migas').includes('flex-wrap: wrap'),
    '🔴 el contenedor de migas no envuelve en pantalla estrecha',
  );
  // Truncar dentro de un contenedor flex NO funciona si el contenedor no deja encoger a su hijo.
  // `.detail-head` es flex: sin `min-width: 0` en la columna, el `ellipsis` de arriba no actúa
  // nunca y las cuatro comprobaciones de este test serían ciertas y a la vez inútiles.
  assert.ok(
    recorte(CSS, '.detail-head-izq', '}', 'la columna izquierda de la cabecera').includes('min-width: 0'),
    '🔴 la columna del título no lleva `min-width: 0`. Dentro de un flex, un hijo no encoge por ' +
      'debajo de su contenido: el `text-overflow: ellipsis` de arriba no llegaría a actuar.',
  );
});
