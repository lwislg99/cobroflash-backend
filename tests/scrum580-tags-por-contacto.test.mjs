// tests/scrum580-tags-por-contacto.test.mjs — SCRUM-580 (CONT-07)
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LAS ETIQUETAS DEL CONTACTO
//
// El profesional no podía agrupar a sus clientes por nada. En oficios eso es comunidad ·
// administrador · aseguradora · urgencias · moroso. Con 300 clientes, buscar por texto el nombre
// de una comunidad no sustituye a filtrar por «administrador».
//
// ── LOS CINCO ESLABONES, Y EL QUINTO ES EL QUE DECIDE ────────────────────────────────────────
// se escribe · se envía · se valida · se guarda · **SE RELEE**. El quinto se pierde en silencio:
// `CUSTOMER_SELECT_NO_TOKEN` es un `select` EXPLÍCITO, así que sin la línea de `tags` el alta las
// guardaría y devolvería un cliente sin ellas — la pantalla se recargaría vacía, el profesional
// las reescribiría, y la tanda seguiría VERDE porque el dato SÍ está en la base.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const { normalizarTags, tagsDe, tieneTag, tagsUsadas, LARGO_MAXIMO, MAXIMO_POR_CLIENTE } =
  await import('../dist/modules/system/tagsDelCliente.js');

/** La pieza del navegador, cargada como la carga el navegador. */
function filtro() {
  const w = {};
  const src = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/filtroClientes.js'), 'utf8');
  new Function('window', 'module', src)(w, {});
  return w.filtroClientes;
}
const FC = filtro();

const LOTE = [
  { id: 1, name: 'Comunidad Los Olivos', contactKind: 'EMPRESA', tags: ['administrador', 'urgencias'] },
  { id: 2, name: 'Ana Ruiz', contactKind: 'PERSONA', tags: ['moroso'] },
  { id: 3, name: 'Beta SL', contactKind: 'EMPRESA', tags: null },
  { id: 4, name: 'Zeta SL', contactKind: 'EMPRESA', tags: ['Administrador'] },
];

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 «AUSENTE ≠ VACÍO» — el requisito, no una preferencia
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-580 · 🔴 sin etiquetas se guarda `null`, NUNCA `[]` ni `""`', () => {
  for (const vacio of [null, [], ['', '   '], ['\t'], 'texto', 42]) {
    assert.equal(normalizarTags(vacio), null,
      `🔴 «${JSON.stringify(vacio)}» no se guarda como null. Si se guardara \`[]\`, un IS NOT NULL `
      + 'diría que ese cliente TIENE etiquetas, y el filtro se construiría sobre esa mentira.');
  }
  // CONTROL POSITIVO del propio suelo: algo con contenido NO se convierte en null.
  assert.deepEqual(normalizarTags(['moroso']), ['moroso'],
    '🔴 devuelve null también con contenido: entonces sus nulls no significarían nada.');
});

test('SCRUM-580 · 🔴 `undefined` NO es «bórralas»: es «no toques este campo»', () => {
  assert.equal(normalizarTags(undefined), undefined,
    '🔴 un `undefined` se convierte en null. En una edición parcial eso BORRARÍA las etiquetas de '
    + 'un cliente al que sólo se le estaba cambiando el teléfono.');
});

test('SCRUM-580 · se recortan espacios y se quitan duplicados SIN distinguir mayúsculas', () => {
  assert.deepEqual(normalizarTags(['  moroso ', 'Moroso', 'MOROSO']), ['moroso'],
    '🔴 «Moroso» y «moroso» se guardan como dos: partirían en dos grupos lo que el profesional ve '
    + 'como uno.');
  // Y se conserva LA PRIMERA GRAFÍA, no una versión en minúsculas: la etiqueta es suya.
  assert.deepEqual(normalizarTags(['Administrador', 'administrador']), ['Administrador'],
    '🔴 se ha cambiado la grafía que escribió el profesional.');
});

test('SCRUM-580 · hay topes, y se aplican', () => {
  const larga = 'x'.repeat(LARGO_MAXIMO + 20);
  assert.equal(normalizarTags([larga])[0].length, LARGO_MAXIMO, '🔴 no se recorta una etiqueta larga.');
  const muchas = Array.from({ length: MAXIMO_POR_CLIENTE + 10 }, (_, i) => 'e' + i);
  assert.equal(normalizarTags(muchas).length, MAXIMO_POR_CLIENTE, '🔴 no hay tope por cliente.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL QUINTO ESLABÓN · sin él, el defecto es MUDO
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-580 · 🔴 el `select` del servidor TRAE `tags`, o el alta se pierde en silencio', () => {
  const src = fs.readFileSync(path.join(RAIZ, 'src/modules/system/customerAdmin.ts'), 'utf8');
  const i = src.indexOf('CUSTOMER_SELECT_NO_TOKEN = {');
  assert.notEqual(i, -1, '🔴 CIEGO: no encuentro el select; lo de abajo no probaría nada.');
  const bloque = src.slice(i, src.indexOf('};', i));

  // SUELO: el trozo es el select de verdad (trae campos que sabemos que están).
  assert.match(bloque, /name: true/, '🔴 CIEGO: el trozo acotado no parece el select.');

  assert.match(bloque, /tags: true/,
    '🔴 el select NO trae `tags`. El alta las guardaría y devolvería un cliente sin ellas: la '
    + 'pantalla se recargaría vacía, el profesional las reescribiría, y la tanda seguiría VERDE '
    + 'porque el dato SÍ está en la base. El defecto sería MUDO.');
});

test('SCRUM-580 · 🔴 se normaliza en el alta Y en la edición, no sólo en el alta', () => {
  const src = fs.readFileSync(path.join(RAIZ, 'src/modules/system/customerAdmin.ts'), 'utf8');
  const crear = src.slice(src.indexOf('export async function createCustomer'), src.indexOf('export async function ensurePortalToken'));
  const editar = src.slice(src.indexOf('export async function updateCustomer'), src.indexOf('export async function deleteCustomer'));
  assert.match(crear, /normalizarEtiquetas\(/, '🔴 el alta no normaliza las etiquetas.');
  assert.match(editar, /normalizarEtiquetas\(/,
    '🔴 la edición no normaliza: sería la puerta trasera por la que entra un `[]`, que es justo la '
    + 'mentira sobre la que se construiría el filtro. Misma lección que SCRUM-578 con el teléfono.');
});

test('SCRUM-580 · 🔴 se escribe `Prisma.DbNull`, no el `null` de JS ni `JsonNull`', () => {
  const src = fs.readFileSync(path.join(RAIZ, 'src/modules/system/customerAdmin.ts'), 'utf8');
  assert.match(src, /Prisma\.DbNull/,
    '🔴 no se usa `Prisma.DbNull`. Con el `null` de JS Prisma ni compila, y con `Prisma.JsonNull` '
    + 'la columna NO quedaría NULL: guardaría el valor JSON `null` dentro, y un IS NOT NULL diría '
    + 'que ese cliente tiene etiquetas. Es «ausente ≠ vacío» con otro nombre.');
  // 🔴 SE MIRA EL CÓDIGO, NO LOS COMENTARIOS, y esto se pagó en el primer intento: la versión
  // anterior de esta línea se cazó A SÍ MISMA en el comentario que EXPLICA la prohibición —el
  // fichero que prohíbe usar `JsonNull` tiene que poder nombrarlo para decir por qué—. Es la
  // lección de SCRUM-349, y hoy ha aparecido tres veces.
  const soloCodigo = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  // SUELO: el desnudador no se ha llevado el fichero entero por delante.
  assert.match(soloCodigo, /Prisma\.DbNull/,
    '🔴 CIEGO: al quitar los comentarios ha desaparecido también el código. La comprobación de '
    + 'abajo pasaría sobre un texto vacío.');
  assert.equal(/Prisma\.JsonNull/.test(soloCodigo), false,
    '🔴 se está usando `Prisma.JsonNull` EN EL CÓDIGO: ése NO deja la columna en NULL — guarda el '
    + 'valor JSON `null` dentro, y un IS NOT NULL diría que ese cliente tiene etiquetas.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL FILTRO · con su SUELO de control positivo
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-580 · 🔴 SUELO: filtrar por una etiqueta que existe devuelve ALGUNA fila', () => {
  const r = FC.filtrarPorEtiqueta(LOTE, 'administrador');
  assert.ok(r.length > 0,
    '🔴 SUELO: el filtro devuelve CERO sobre un lote que SÍ tiene esa etiqueta. Un filtro que '
    + 'devuelve cero pasa cualquier comprobación de «no salen los que no la tienen».');
  assert.deepEqual(r.map((c) => c.id), [1, 4],
    '🔴 no devuelve exactamente los que la llevan. «Administrador» y «administrador» son la misma.');
});

test('SCRUM-580 · CONTROL NEGATIVO: sin etiqueta seleccionada, la lista sale ENTERA', () => {
  for (const nada of [null, undefined, '', '   ']) {
    assert.deepEqual(FC.filtrarPorEtiqueta(LOTE, nada).map((c) => c.id), [1, 2, 3, 4],
      `🔴 con «${JSON.stringify(nada)}» filtra algo. No filtrar no es filtrar por nada.`);
  }
});

test('SCRUM-580 · 🔴 un cliente SIN etiquetas no cae en ninguna, y es correcto', () => {
  // El apaño de «si no tiene, que salga en todas» convierte el filtro en un adorno.
  for (const t of ['administrador', 'moroso', 'urgencias']) {
    assert.equal(FC.filtrarPorEtiqueta(LOTE, t).some((c) => c.id === 3), false,
      `🔴 el cliente sin etiquetas sale al filtrar por «${t}».`);
  }
});

test('SCRUM-580 · las etiquetas del selector salen de las que ESE merchant ya usa', () => {
  assert.deepEqual(FC.etiquetasUsadas(LOTE), ['administrador', 'moroso', 'urgencias'],
    '🔴 no devuelve las usadas, ordenadas y sin duplicar mayúsculas.');
  assert.deepEqual(FC.etiquetasUsadas([]), [], '🔴 con lote vacío inventa etiquetas.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LOS CUATRO A LA VEZ · buscador + pestaña + etiqueta + orden
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-580 · 🔴 los CUATRO se combinan, y ninguno sustituye a otro', () => {
  // `LOTE_BUSCADO` es lo que el SERVIDOR devolvió al buscar: el buscador ya está aplicado.
  const LOTE_BUSCADO = [
    { id: 7, name: 'Zapata Comunidad', contactKind: 'EMPRESA', tags: ['administrador'] },
    { id: 3, name: 'Álvarez Comunidad', contactKind: 'EMPRESA', tags: ['administrador'] },
    { id: 9, name: 'Comunidad Marmol', contactKind: 'PERSONA', tags: ['administrador'] },
    { id: 5, name: 'Comunidad Sur', contactKind: 'EMPRESA', tags: ['moroso'] },
  ];
  // pestaña EMPRESA + etiqueta «administrador» + orden A-Z, sobre el resultado del buscador.
  const r = FC.aplicar(LOTE_BUSCADO, 'EMPRESA', 'AZ', 'administrador');

  assert.ok(r.length > 0, '🔴 SUELO: los cuatro juntos devuelven CERO; nada de lo de abajo probaría nada.');
  assert.deepEqual(r.map((c) => c.name), ['Álvarez Comunidad', 'Zapata Comunidad'],
    '🔴 los cuatro no se combinan: falta la persona con esa etiqueta (pestaña), sobra el moroso '
    + '(etiqueta), o el orden no se aplicó.');
  // Y el conjunto NO estaba ordenado por id: si lo estuviera, esto no distinguiría A-Z de
  // orden de inserción.
  assert.notDeepEqual(LOTE_BUSCADO.map((c) => c.id), [...LOTE_BUSCADO].map((c) => c.id).sort((a, b) => a - b),
    '🔴 el conjunto de prueba SÍ está ordenado por id: el test no distingue A-Z de inserción.');
});

test('SCRUM-580 · CONTROL NEGATIVO: quitar sólo la etiqueta deja lo de siempre', () => {
  const lote = [
    { id: 1, name: 'B', contactKind: 'EMPRESA', tags: ['x'] },
    { id: 2, name: 'A', contactKind: 'EMPRESA', tags: null },
  ];
  assert.deepEqual(FC.aplicar(lote, 'EMPRESA', 'AZ', null).map((c) => c.name), ['A', 'B'],
    '🔴 sin etiqueta seleccionada el comportamiento de antes ha cambiado.');
  // Y llamar con TRES argumentos —como hacía CONT-08— sigue funcionando.
  assert.deepEqual(FC.aplicar(lote, 'EMPRESA', 'AZ').map((c) => c.name), ['A', 'B'],
    '🔴 llamar sin el cuarto argumento ha dejado de funcionar: eso rompería a quien ya llamaba.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LAS DOS COPIAS NO DIVERGEN
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-580 · 🔴 servidor y navegador deciden lo MISMO sobre los mismos casos', () => {
  // `tagsDe` vive dos veces —una por lado— porque la lista filtra sin ir al servidor en cada
  // pulsación. La copia es el precio; que no diverja lo sostiene esto.
  const casos = [
    { tags: ['a', 'b'] }, { tags: [] }, { tags: null }, { tags: 'no es lista' },
    { tags: ['', '  ', 'c'] }, { tags: [1, 'd'] }, {}, null,
  ];
  for (const c of casos) {
    assert.deepEqual(FC.tagsDe(c), tagsDe(c),
      `🔴 las dos copias discrepan en ${JSON.stringify(c)}: la lista enseñaría una cosa y el `
      + 'servidor guardaría otra.');
  }
  // SUELO: y no coinciden porque las dos devuelvan siempre lo mismo.
  assert.deepEqual(tagsDe({ tags: ['a', 'b'] }), ['a', 'b'],
    '🔴 el lector del servidor no lee nada: la coincidencia de arriba sería trivial.');
});

test('SCRUM-580 · `tieneTag` y `tagsUsadas` del servidor, con su suelo', () => {
  assert.equal(tieneTag(LOTE[0], 'ADMINISTRADOR'), true, '🔴 distingue mayúsculas.');
  assert.equal(tieneTag(LOTE[2], 'administrador'), false, '🔴 un cliente sin etiquetas «tiene» una.');
  assert.equal(tieneTag(LOTE[0], '  '), false, '🔴 una etiqueta vacía «coincide» con algo.');
  assert.deepEqual(tagsUsadas(LOTE), ['administrador', 'moroso', 'urgencias']);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LA PANTALLA · mencionar no es hacer
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-580 · 🔴 la vista MONTA el campo, la columna y el filtro', () => {
  const v = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/customersView.js'), 'utf8');
  assert.match(v, /fieldTags = createField\(FC\.TEXTOS_ETIQUETAS\.rotulo/,
    '🔴 no hay campo de etiquetas en el formulario, o su rótulo no sale de la pieza.');
  assert.match(v, /tags: tagsParaPayload\(/, '🔴 el payload no manda las etiquetas.');
  assert.match(v, /fieldTags\.input\.value = \(Array\.isArray\(editingCustomer\.tags\)/,
    '🔴 al editar no se rellenan: el profesional las reescribiría cada vez.');
  // SCRUM-584 · REANCLADO: la cabecera ya no es una lista literal en la vista — sale de
  // `FC.COLUMNAS`. La INVARIANTE no cambia (existe la columna y su rótulo sale de la pieza),
  // cambia dónde se comprueba. Y se comprueba EJECUTANDO la pieza, que es más fuerte que
  // buscar su forma en el fuente con un regex.
  const colEtiquetas = FC.COLUMNAS.filter((c) => c.id === 'etiquetas')[0];
  assert.ok(colEtiquetas, '🔴 no hay columna de etiquetas en la lista de columnas.');
  assert.equal(colEtiquetas.texto, FC.TEXTOS_ETIQUETAS.columna,
    '🔴 la columna existe pero su rótulo no sale de la pieza.');
  assert.equal(colEtiquetas.ocultaEnMovil, true,
    '🔴 la columna de etiquetas ha dejado de nacer oculta en móvil: eso cambia la pantalla de '
    + 'todo el mundo sin que nadie lo pida.');
  assert.match(v, /FC\.aplicar\(lote, pestanaActiva, ordenActivo, etiquetaActiva\)/,
    '🔴 la lista no pasa la etiqueta al filtro: el selector no filtraría nada.');
});

test('SCRUM-580 · 🔴 F1 y F3 NO se han perdido', () => {
  const v = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/customersView.js'), 'utf8');
  // SCRUM-584 · REANCLADO: las cabeceras salen de `FC.COLUMNAS`, no de una lista en el fuente.
  // F1 es una afirmación sobre la POSICIÓN, así que se lee la lista EJECUTADA: no hay regex que
  // pueda equivocarse, y si mañana la lista cambia de forma esto sigue midiendo lo mismo.
  const cabeceras = FC.COLUMNAS.map((c) => c.texto);
  assert.ok(cabeceras.length >= 7,
    `🔴 CIEGO: sólo veo ${cabeceras.length} cabeceras; el orden de abajo no probaría nada.`);
  assert.deepEqual(cabeceras.slice(0, 3), ['ID', 'Nombre', 'Teléfono'],
    '🔴 F1 ROTO: el teléfono ya no es la tercera columna.');
  // 🔴 Y F1 dice algo más que la posición: el teléfono NACE VISIBLE. Con columnas ocultables,
  // «estar en la lista» ya no basta — podría estar y nacer apagado.
  const tel = FC.COLUMNAS.filter((c) => c.id === 'telefono')[0];
  assert.equal(tel.ocultaEnMovil, false,
    '🔴 F1 ROTO: el teléfono nace OCULTO en móvil. Es donde YaQu gana a Holded, que ni lo tiene '
    + 'como columna: puede apagarlo el profesional, nunca el producto.');
  assert.ok(cabeceras.includes(FC.TEXTOS_ETIQUETAS.columna),
    '🔴 no está la columna nueva, o ha dejado de leer su rótulo de la pieza.');
  for (const accion of ['Editar', 'Portal', 'Historial']) {
    assert.ok(v.includes(accion), `🔴 F3 ROTO: ha desaparecido la acción «${accion}» de la fila.`);
  }
});

test('SCRUM-580 · 🔴 los vacíos abarcan TODAS las columnas', () => {
  const v = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/customersView.js'), 'utf8');
  // SCRUM-584 · REANCLADO, y el reanclaje ES el arreglo: antes había DOS `colSpan = 8` escritos
  // a mano y este guard comparaba dos números copiados. Ahora el `colSpan` SALE de la misma
  // lista que la cabecera, así que no pueden descuadrarse — pero eso hay que comprobarlo, no
  // suponerlo: un `colSpan` a mano que vuelva sería el defecto otra vez.
  const aMano = [...v.matchAll(/td\.colSpan = (\d+)/g)];
  assert.deepEqual(aMano.map((m) => m[1]), [],
    '🔴 ha vuelto un `colSpan` con un número escrito a mano: en cuanto entre una columna nueva quedará descuadrado, y un vacío descuadrado no lo ve ninguna tanda.');
  const derivados = [...v.matchAll(/td\.colSpan = FC\.colSpanDeLaTabla\(\)/g)];
  assert.ok(derivados.length >= 2,
    `🔴 CIEGO: sólo ${derivados.length} vacíos derivan su colSpan de la lista; había dos.`);
  // Y el número que devuelve la pieza es el de la cabecera. Si divergieran, el vacío saldría
  // corto o largo y nadie lo vería.
  assert.equal(FC.colSpanDeLaTabla(), FC.COLUMNAS.length,
    '🔴 el `colSpan` y la cabecera ya no salen del mismo sitio.');
});

test('SCRUM-580 · la etiqueta se pinta con el componente del inventario, no con estilo inventado', () => {
  const v = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/customersView.js'), 'utf8');
  assert.match(v, /chip\.className = "badge badge-slate"/,
    '🔴 no reutiliza `.badge` del inventario (AB3). Un estilo nuevo por pantalla es lo que la '
    + 'skill de UI prohíbe.');
  assert.match(v, /chip\.textContent = t/,
    '🔴 la etiqueta se concatena en markup. La escribe el profesional: eso es una inyección.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ✅ MICROCOPY · APROBADA POR EL ASESOR (2-sep-2026), PROVISIONAL A LA ESPERA DEL FUNDADOR
//
// Los cuatro textos se fijan LITERALES —no con `match`, no con `includes`— para que nadie los
// cambie sin pasar por quien los aprobó: un `match` dejaría colar una coma, un acento o un
// «Etiquetas del cliente» sin que nada chillara, y microcopy aprobada que deriva sola es microcopy
// que deja de estar aprobada sin que nadie lo decida (regla 30).
//
// ⚠️ Y «aprobada por el asesor» NO es «firmada por el fundador». Que no se pinte marcador en
// pantalla no cambia eso: quien lleva la cuenta es `SIN_APROBAR`, y por estas cuatro vale 4.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-580 · ✅ los CUATRO textos son EXACTAMENTE los aprobados', () => {
  const T = FC.TEXTOS_ETIQUETAS;
  assert.equal(T.rotulo, 'Etiquetas', '🔴 el rótulo del campo no es el aprobado.');
  assert.equal(T.columna, 'Etiquetas', '🔴 la cabecera de columna no es la aprobada.');
  assert.equal(T.placeholder, 'comunidad, administrador, urgencias…',
    '🔴 el placeholder no es el aprobado. Ojo al carácter final: son puntos suspensivos «…», no '
    + 'tres puntos seguidos.');
  assert.equal(T.sinFiltro, 'Todas las etiquetas', '🔴 la opción «sin filtro» no es la aprobada.');

  // SUELO: son EXACTAMENTE cuatro ranuras. Si alguien añade una quinta, el bucle de arriba pasaría
  // sin mirarla — «todas las que hay están bien» y «no hay ninguna» darían el mismo verde.
  assert.deepEqual(Object.keys(T).sort(), ['columna', 'placeholder', 'rotulo', 'sinFiltro'],
    '🔴 han cambiado las ranuras de microcopy de las etiquetas.');
});

test('SCRUM-580 · 🔴 las cuatro cuentan como SIN LA FIRMA DEL FUNDADOR', () => {
  // Las seis de SCRUM-581 las firmó el fundador; estas cuatro las aprobó el asesor y están a la
  // espera. El contador existía valiendo 0 exactamente para este momento: que una ranura nueva no
  // entre en pantalla sin que nadie declare su estado.
  // SCRUM-584 · SUBE A 5: entra el rótulo del selector de columnas, aprobado por el ASESOR y a
  // la espera del fundador. Los NOMBRES de las columnas no cuentan — ya estaban en pantalla.
  assert.equal(FC.SIN_APROBAR, 5,
    '🔴 el recuento de ranuras sin la firma del fundador no cuadra. Si '
    + 'el fundador firma alguna, se baja AQUÍ — aprobar una no aprueba las otras tres.');
});

test('SCRUM-580 · 🔴 la vista NO repite los textos: los lee de la pieza', () => {
  const v = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/customersView.js'), 'utf8');
  // Sin comentarios: el porqué puede nombrar los textos, el código no debe repetirlos.
  const codigo = v.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  assert.match(codigo, /FC\.TEXTOS_ETIQUETAS\.rotulo/, '🔴 el rótulo no sale de la pieza.');
  assert.match(codigo, /FC\.TEXTOS_ETIQUETAS\.placeholder/, '🔴 el placeholder no sale de la pieza.');
  // SCRUM-584 · REANCLADO: la vista ya NO menciona el rótulo de la columna, porque la cabecera
  // sale entera de `FC.COLUMNAS`. Que el texto se lee de la pieza lo fija el caso «la vista MONTA
  // el campo, la columna y el filtro», comparándolo con `===` sobre la lista ejecutada. Aquí la
  // invariante se cumple MÁS que antes: no es que la vista lo lea de la pieza, es que ya no lo toca.
  assert.equal(/TEXTOS_ETIQUETAS\.columna/.test(codigo), false,
    '🔴 la vista ha vuelto a montar la cabecera por su cuenta. La lista de columnas vive en la '
    + 'pieza, y dos sitios que declaran las mismas columnas divergen — que es justo el defecto '
    + 'que dejó dos `colSpan` copiados a mano.');
  assert.match(codigo, /FC\.TEXTOS_ETIQUETAS\.sinFiltro/, '🔴 la opción sin filtro no sale de la pieza.');
  assert.equal(/"Todas las etiquetas"|"comunidad, administrador/.test(codigo), false,
    '🔴 la vista repite un texto aprobado a mano. Dos copias de una microcopy divergen, y la '
    + 'segunda deja de estar aprobada sin que nadie lo decida.');
  // CONTROL del desnudador: no se ha llevado el fichero por delante.
  assert.match(codigo, /createField\(/, '🔴 CIEGO: al quitar comentarios ha desaparecido el código.');
});

test('SCRUM-580 · 🔴 ningún texto de etiquetas lleva marcador en pantalla', () => {
  for (const [k, v] of Object.entries(FC.TEXTOS_ETIQUETAS)) {
    assert.equal(v.includes('['), false,
      `🔴 «${k}» pinta un corchete. La pantalla es de un profesional que paga.`);
    assert.ok(v.trim().length > 0, `🔴 SUELO: «${k}» está vacío. Sin marcador y sin texto es peor.`);
  }
});
