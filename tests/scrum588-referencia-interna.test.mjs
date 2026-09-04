// tests/scrum588-referencia-interna.test.mjs — SCRUM-588 (CONT-16)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA REFERENCIA INTERNA DEL CLIENTE, Y SUS SEIS ESLABONES
//
// El número con el que el PROFESIONAL conoce a su cliente: el expediente de la aseguradora, la
// finca del administrador, el código del sistema viejo. Hasta hoy lo metía en «Notas» —texto
// libre— y luego no lo podía buscar de forma fiable.
//
// ── POR QUÉ SE VIGILAN LOS SEIS, Y NO «QUE EL CAMPO EXISTA» ──────────────────────────────
// Un campo de cliente atraviesa seis sitios y **basta con que falte UNO para que el dato se
// pierda en silencio**. Los dos que más caro salen:
//
//   ⑤ `CUSTOMER_SELECT_NO_TOKEN` es un `select` EXPLÍCITO: lo que no esté ahí NO SALE, aunque el
//      alta lo haya guardado. Sin esa clave la pantalla se recarga vacía, el profesional
//      reescribe el dato **y la tanda sigue VERDE**, porque en la base sí está.
//   ⑥ la BÚSQUEDA. Si el buscador no mira la columna, el campo guarda un número que el
//      profesional no puede encontrar — que es EXACTAMENTE lo que ya hacía «Notas». Sin este
//      eslabón, el ticket no resuelve nada aunque los otros cinco estén perfectos.
//
// ⚠️ LO QUE ESTE FICHERO NO PUEDE VER: si la columna existe en las bases. Eso es el paso ②, se
// aplicó antes que el esquema (dev y staging por S2, producción por el fundador) y se verificó
// leyendo el catálogo — las cuatro salidas están en `docs/master/SCRUM-588.md`.
//
// Sin gate: lee ficheros y el esquema. Ni BD, ni red, ni navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

/** El código sin comentarios: un eslabón NOMBRADO en una explicación no es un eslabón cableado. */
function soloCodigo(fuente) {
  return String(fuente)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
}

const ESLABONES = [
  ['① esquema', 'prisma/schema.prisma', /internalRef\s+String\?\s+@map\("internal_ref"\)/],
  ['② validación', 'src/core/validation/schemas.ts', /internalRef:\s*z\.string\(\)/],
  ['⑤ select', 'src/modules/system/customerAdmin.ts', /internalRef:\s*true/],
  ['⑥ búsqueda', 'src/modules/system/customerAdmin.ts', /\{\s*internalRef:\s*\{\s*contains:\s*search/],
  ['④ formulario · pinta', 'public/dashboard/js/customersView.js', /fieldInternalRef\s*=\s*createField\(/],
  ['④ formulario · carga', 'public/dashboard/js/customersView.js', /fieldInternalRef\.input\.value\s*=\s*editingCustomer\.internalRef/],
  ['④ formulario · envía', 'public/dashboard/js/customersView.js', /internalRef:\s*fieldInternalRef\.input\.value\.trim\(\)\s*\|\|\s*null/],
  ['④ formulario · al DOM', 'public/dashboard/js/customersView.js', /body\.appendChild\(fieldInternalRef\.wrapper\)/],
];

// ═══ ① SUELO ═════════════════════════════════════════════════════════════════════════════

test('SCRUM-588 · 🔴 SUELO: los ficheros de los eslabones existen y tienen contenido', () => {
  for (const [, rel] of ESLABONES) {
    const src = leer(rel);
    assert.ok(src.length > 500,
      `🔴 CENSO CIEGO: ${rel} tiene ${src.length} bytes. Si un fichero se moviera, las ` +
      'comprobaciones de abajo pasarían por no encontrar nada que contradecirlas.');
  }
});

// ═══ ② LOS SEIS ESLABONES ════════════════════════════════════════════════════════════════

test('SCRUM-588 · los eslabones están CABLEADOS, no sólo nombrados', () => {
  for (const [etq, rel, patron] of ESLABONES) {
    assert.match(soloCodigo(leer(rel)), patron,
      `🔴 FALTA EL ESLABÓN ${etq} en ${rel}.\n\n  Basta con que falte UNO para que el dato se ` +
      'pierda: el alta guardaría y la pantalla volvería vacía, o el número quedaría guardado ' +
      'donde nadie puede buscarlo. Se mira el CÓDIGO, no los comentarios — nombrar no es cablear.');
  }
});

test('SCRUM-588 · 🔴 el eslabón que MÁS caro sale: la búsqueda mira la columna', () => {
  // Se comprueba aparte y con su propio mensaje porque es el que distingue este ticket de no
  // haberlo hecho: sin él, la referencia vive donde ya vivía —en un campo que no se puede
  // buscar— y el profesional no gana nada.
  const src = soloCodigo(leer('src/modules/system/customerAdmin.ts'));
  const bloque = /OR:\s*\[([\s\S]*?)\]/.exec(src);
  assert.ok(bloque, '🔴 no encuentro el `OR` del buscador de clientes: el censo no sabe mirar.');

  for (const campo of ['name', 'phone', 'email', 'internalRef']) {
    assert.match(bloque[1], new RegExp(`${campo}:\\s*\\{\\s*contains:`),
      `🔴 el buscador ya no mira «${campo}». Si es la referencia interna, el campo guarda un ` +
      'número que el profesional NO PUEDE ENCONTRAR — exactamente lo que ya hacía «Notas».');
  }
  // Y en el MISMO `OR`, no en un buscador aparte: el profesional escribe lo que recuerda y no
  // tiene por qué decirnos de qué tipo es.
  assert.match(bloque[1], /internalRef[\s\S]*?insensitive|insensitive[\s\S]*?internalRef/,
    '🔴 la referencia se busca sin `mode: insensitive`: «AB-2024» y «ab-2024» dejarían de ser lo ' +
    'mismo, y el profesional escribe como le sale.');
});

// ═══ ③ LAS DECISIONES DEL TICKET, FIJADAS ════════════════════════════════════════════════

test('SCRUM-588 · 🔴 «ausente ≠ vacío»: lo vacío viaja como null, nunca como cadena vacía', () => {
  const vista = soloCodigo(leer('public/dashboard/js/customersView.js'));
  assert.match(vista, /internalRef:\s*fieldInternalRef\.input\.value\.trim\(\)\s*\|\|\s*null/,
    '🔴 el payload no manda `null` cuando el campo está vacío. Una cadena vacía diría «tiene ' +
    'referencia, y es nada», que no es lo mismo que no tenerla — y ensucia la búsqueda.');

  // Y el esquema tiene que aceptar ese null.
  assert.match(soloCodigo(leer('src/core/validation/schemas.ts')), /internalRef:[^\n]*\.nullable\(\)/,
    '🔴 el validador no acepta `null` en `internalRef`: el front lo manda y el servidor lo rechazaría.');
});

test('SCRUM-588 · 🔴 es un campo LIBRE: sin formato, sin unicidad, sin autogenerar', () => {
  // Es el número de OTRO sistema y no mandamos sobre su forma. Un `@unique` rompería el alta de
  // un profesional por un dato que no controlamos; un `regex` le rechazaría algo que él tiene
  // delante en un papel.
  const schema = leer('prisma/schema.prisma');
  const linea = /internalRef[^\n]*/.exec(schema);
  assert.ok(linea, '🔴 no encuentro la línea de `internalRef` en el esquema.');
  assert.ok(!/@unique/.test(linea[0]),
    '🔴 `internalRef` se ha declarado `@unique`. Dos clientes PUEDEN compartir referencia: es un ' +
    'código ajeno, y un choque dejaría al profesional sin poder dar de alta a su cliente.');
  assert.ok(!/@default/.test(linea[0]),
    '🔴 `internalRef` tiene `@default`: eso declararía «tiene referencia» a todos los clientes ' +
    'que ya existen sin que nadie lo haya dicho.');
  assert.match(linea[0], /String\?/, '🔴 `internalRef` ya no es nullable.');

  const zod = soloCodigo(leer('src/core/validation/schemas.ts'));
  const zodLinea = /internalRef:[^\n]*/.exec(zod)[0];
  assert.ok(!/regex|email|uuid|startsWith/.test(zodLinea),
    `🔴 se ha metido una validación de FORMATO en la referencia: «${zodLinea.trim()}». Es el ` +
    'número de otro sistema; rechazarle una forma es rechazarle un dato que él tiene delante.');
});

// ═══ ④ MICROCOPY APROBADA, LITERAL ═══════════════════════════════════════════════════════

test('SCRUM-588 · los dos textos son los APROBADOS, literales', () => {
  // Aprobados por el asesor el 2-sep-2026 y medidos en navegador a 360 px: el rótulo ocupa 103 px
  // de 336 y el placeholder 219 de los 308 útiles. Si alguien los abrevia o les cambia la
  // puntuación, esto cae: son copy del asesor, no texto de trabajo (regla 30).
  const vista = soloCodigo(leer('public/dashboard/js/customersView.js'));
  assert.match(vista, /createField\("Referencia interna", "internalRef", "text"\)/,
    '🔴 el rótulo ya no es el aprobado, LITERAL: «Referencia interna».');
  assert.match(vista, /fieldInternalRef\.input\.placeholder = "Nº de expediente, finca, código…";/,
    '🔴 el placeholder ya no es el aprobado, LITERAL: «Nº de expediente, finca, código…» — con ' +
    'puntos suspensivos de UN SOLO carácter (…), no tres puntos.');
  assert.ok(!/\.\.\./.test(/placeholder = "[^"]*"/.exec(vista)?.[0] || ''),
    '🔴 el placeholder lleva tres puntos en vez del carácter «…».');
});

/** El valor literal de una asignación `X.placeholder = "…";` en un fuente. */
function placeholderDe(fuente, variable) {
  const m = new RegExp(`${variable}\\.placeholder\\s*=\\s*"([^"]*)"`).exec(soloCodigo(fuente));
  assert.ok(m, `🔴 no encuentro el placeholder de \`${variable}\`: el extractor está ciego.`);
  return m[1];
}

test('SCRUM-588 · 🔴 el placeholder del BUSCADOR dice lo que el buscador HACE', () => {
  // Decía «nombre, teléfono o email» y esta rama le añadió la referencia al `OR`. Dejarlo habría
  // sido una frase FALSA en pantalla, que es peor que una incompleta: el profesional no probaría
  // a buscar por su nº de expediente porque el campo le dice que no se puede.
  const APROBADO = 'Buscar por nombre, teléfono, email o referencia…';

  // 🔴 CON `===`, NO CON `includes`. Y aquí está el porqué, comprobado en este mismo test: la
  // versión con TRES PUNTOS pasa un `includes` del texto aprobado sin los suspensivos, así que un
  // guard laxo daría por bueno un texto que NO es el que firmó el asesor.
  const conTresPuntos = 'Buscar por nombre, teléfono, email o referencia...';
  assert.notEqual(conTresPuntos, APROBADO,
    '🔴 el corpus del control no distingue las dos grafías: no prueba nada.');
  assert.ok(conTresPuntos.includes('Buscar por nombre, teléfono, email o referencia'),
    '🔴 SUELO: el impostor tiene que parecerse lo bastante como para colarse por un `includes`.');

  assert.equal(placeholderDe(leer('public/dashboard/js/customersView.js'), 'searchInput'), APROBADO,
    '🔴 el placeholder del buscador no es el APROBADO, literal. Ojo a los puntos suspensivos: son ' +
    'UN carácter «…», no tres puntos.');
});

test('SCRUM-588 · 🔴 y los suspensivos son UN carácter en los DOS textos de este ticket', () => {
  const vista = leer('public/dashboard/js/customersView.js');
  for (const [variable, donde] of [['searchInput', 'el buscador'], ['fieldInternalRef.input', 'el campo']]) {
    const ph = placeholderDe(vista, variable.replace('.', '\\.'));
    assert.ok(ph.includes('…'), `🔴 ${donde} ha perdido el carácter «…».`);
    assert.ok(!ph.includes('...'), `🔴 ${donde} lleva TRES PUNTOS en vez de «…».`);
  }
});

test('SCRUM-588 · 🔴 NEGATIVO: no se pinta ningún marcador de microcopy en este campo', () => {
  // Los dos textos están aprobados, así que un `[PENDIENTE …]` aquí sería texto sin firmar en la
  // pantalla de un profesional — y desde que producción despliega con cada merge, a los cinco
  // minutos. Se mira el CÓDIGO: la cabecera del bloque menciona la marca para explicar la
  // decisión, y cazarla sería un rojo por nada.
  // 🔴 SCRUM-587 (4-sep-2026) · EL ALCANCE SE ESTRECHA A SU SUJETO, Y NO ES UNA RELAJACIÓN.
  //
  // Miraba una VENTANA DE 400 CARACTERES a partir de `fieldInternalRef = createField`, que es un
  // proxy del bloque y no el bloque. El primer campo que naciera al lado —SCRUM-587 pone el
  // descuento pactado justo ahí, con su rótulo sin firmar y su marcador— caía dentro de la ventana
  // y ponía este guard rojo acusando a la referencia interna de algo que no había pasado. Un rojo
  // que nombra el sitio equivocado se acaba apagando, y ahí sí se pierde la propiedad entera.
  //
  // Ahora se miran LAS LÍNEAS QUE HABLAN DE `fieldInternalRef`, que es de lo que este test trata.
  // La cobertura del resto del fichero no se pierde: la da el censo de SCRUM-402, que cuenta
  // marcadores POR FICHERO con trinquete.
  const vista = soloCodigo(leer('public/dashboard/js/customersView.js'));
  const suyas = vista.split(/\r?\n/).filter((l) => l.includes('fieldInternalRef'));
  assert.ok(suyas.length >= 3,
    `🔴 GUARD CIEGO: sólo ${suyas.length} líneas hablan de \`fieldInternalRef\`. Eran cinco `
    + '(declaración, creación, placeholder, montaje, edición y payload): si ahora hay menos, o el '
    + 'campo se ha renombrado o este control lleva rato mirando casi nada.');
  const conMarca = suyas.filter((l) => l.includes('[PENDIENTE'));
  assert.deepEqual(conMarca, [],
    '🔴 hay un marcador de microcopy en el campo de referencia interna, y su copy está aprobada.');
});
