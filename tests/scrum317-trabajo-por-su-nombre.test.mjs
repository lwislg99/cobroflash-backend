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

import { soloEjecutable } from './_guard-texto.mjs';

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
const VISTA_CODIGO = soloEjecutable(VISTA, { almohadillaEsComentario: false });
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
  // El título no depende del presupuesto para nada — depende del cliente, que es NOT NULL.
  const sinQuote = { customer: { name: 'Ana Ruiz' }, titulo: null, quote: null };
  assert.equal(unirCon(' · ', sinQuote.customer.name, sinQuote.titulo || ''), 'Ana Ruiz');
  assert.ok(
    /h2\.textContent = nombreCliente \|\| 'Trabajo'/.test(VISTA),
    '🔴 el título ya no sale del CLIENTE. Si vuelve a depender del presupuesto, un Trabajo sin ' +
      'presupuesto se queda sin título — y ese caso existe.',
  );
});

test('SCRUM-317 · la vista COMPONE con `unirCon`, no a mano', () => {
  // Es la mitad que hace verdad al test de arriba: replicar la función no prueba nada si la
  // vista concatena por su cuenta en otro sitio.
  assert.ok(/const unirCon =/.test(VISTA), '🔴 `unirCon` ha desaparecido de la vista');
  const cabecera = recorte(VISTA, 'const unirCon =', 'const nombreWrap', 'la cabecera');
  assert.ok(
    /migaActual\.textContent = unirCon\(/.test(cabecera) && /sub\.textContent = unirCon\(/.test(cabecera),
    '🔴 la miga o el subtítulo se componen sin `unirCon`. Ese es el camino por el que vuelve el ' +
      '`· undefined`: una plantilla con un `${}` que puede venir vacío.',
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

test('SCRUM-317 · el subtítulo que describía LA PANTALLA ha desaparecido', () => {
  assert.ok(
    !/Detalle del trabajo, cobros y documentos/.test(VISTA_CODIGO),
    '🔴 ha vuelto «Detalle del trabajo, cobros y documentos». Describe la pantalla, no el ' +
      'trabajo — y dónde estás ya lo dicen las migas.',
  );
});

test('SCRUM-317 · la fecha del subtítulo es NEUTRA: nada de «desde el»', () => {
  const cabecera = recorte(VISTA, 'const fechaCorta =', 'const nombreWrap', 'la fecha del subtítulo');
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

test('SCRUM-317 · NOMBRES LARGOS: la miga trunca en vez de empujar la cabecera', () => {
  const CSS = leer('public/dashboard/css/styles.css');
  const bloque = recorte(CSS, '.detail-miga-actual', '}', 'el estilo de la miga actual');
  for (const prop of ['text-overflow: ellipsis', 'white-space: nowrap', 'overflow: hidden', 'min-width: 0']) {
    assert.ok(
      bloque.includes(prop),
      `🔴 la miga actual no lleva «${prop}». Un cliente con nombre largo MÁS un trabajo con ` +
        'nombre largo empujarían el título y el chip de estado — el caso que más falla en el ' +
        'pase de dispositivos.',
    );
  }
  assert.ok(
    recorte(CSS, '.detail-migas', '}', 'el contenedor de migas').includes('flex-wrap: wrap'),
    '🔴 el contenedor de migas no envuelve en pantalla estrecha',
  );
});
