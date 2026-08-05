// tests/scrum300-firmante-ids-y-microcopy.test.mjs — SCRUM-300 (C5)
//
// LO QUE FIJA ESTE FICHERO: la frontera entre lo que es DATO y lo que es PANTALLA en «en calidad
// de qué firma», que es la decisión que resolvió las dos implementaciones paralelas de C5.
//
//   · Los seis `id` son DATO. Se guardan en `Albaran.firmadoPorCalidad`, acaban en el paquete de
//     evidencias que lee un tercero, y por eso quedaron fijados ANTES de la migración: cambiarlos
//     después obliga a migrar filas de documentos ya firmados.
//   · Las seis etiquetas son PANTALLA, y **no las ha aprobado nadie** (regla 30). Van con el
//     marcador `[PENDIENTE microcopy oficial]`, como en portabilidad, SCRUM-289 y SCRUM-303.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ ESTE FICHERO EXISTE, Y NO ES UNA FORMALIDAD
//
// La rama `scrum-300-firmado-por` traía cinco textos marcados como aprobados palabra por palabra.
// **Nadie los aprobó.** Un texto etiquetado como aprobado es PEOR que uno con marcador: el
// marcador pide permiso y la etiqueta falsa lo da — el siguiente que lo lea no comprobará.
//
// El asesor anunció los seis rótulos validados «en el comentario siguiente» de SCRUM-300.
// **Medido el 5-ago-2026: ese comentario no llegó a escribirse** (el ticket tiene 5 comentarios y
// ninguno los contiene). Así que aquí se vigila que NADIE los rellene por su cuenta mientras
// tanto: inventar microcopy es exactamente lo que la regla 30 prohíbe, y estos textos acaban en
// un documento que se puede leer en un juzgado.
//
// Cuando el fundador los apruebe, ESTE TEST SE PONDRÁ ROJO. Es deliberado: obliga a que la
// aprobación quede en el mismo diff que el texto, con quién la dio y cuándo.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALBARAN_AYUDAS,
  ALBARAN_ROTULOS,
  FIRMANTE_CALIDAD_ETIQUETAS,
  FIRMANTE_CALIDAD_IDS,
  FIRMANTE_CALIDAD_LIBRE,
  FIRMANTE_NOMBRE_MAX,
  FIRMANTE_OTRO_MAX,
  LUGAR_ENTREGA_MAX,
  PENDIENTE,
  codificarCalidad,
  decodificarCalidad,
  etiquetaCalidad,
  firmanteCalidadOpciones,
  normalizarLugarEntrega,
  normalizarNombreFirmante,
  resolverCalidadFirmante,
} from '../dist/modules/jobs/domain/albaranFirmante.js';

// ── ① LOS SEIS ids, QUE SON DATO Y ESTÁN CERRADOS ────────────────────────────────────────

test('SCRUM-300 · los seis `id` de calidad son EXACTAMENTE los que fijó el asesor, y en su orden', () => {
  // Literales a propósito: si alguien los cambia, el rojo sale en el commit que lo hace. Y tiene
  // que salir, porque este valor ya está escrito en documentos firmados: cambiarlo NO es editar
  // una constante, es dejar huérfanas las filas que guardaron el valor viejo.
  assert.deepEqual([...FIRMANTE_CALIDAD_IDS], [
    'el_propio_cliente',
    'en_nombre_del_cliente',
    'familiar_o_conviviente',
    'encargado_o_personal_de_obra',
    'portero_o_conserje',
    'otro',
  ], '🔴 LOS ids DE CALIDAD HAN CAMBIADO.\n\n' +
     '  Son el valor que se guarda en `Albaran.firmadoPorCalidad` y que acaba en el paquete de\n' +
     '  evidencias que lee un tercero. Cambiarlos después de la migración obliga a migrar las\n' +
     '  filas de documentos YA FIRMADOS — y un albarán firmado no se edita (regla 29).\n\n' +
     '  Ninguna de las dos ramas paralelas de C5 usaba éstos: son decisión del asesor (5-ago-2026).');

  assert.equal(FIRMANTE_CALIDAD_LIBRE, 'otro', '🔴 la ranura de texto libre ya no es `otro`');
  assert.ok(FIRMANTE_CALIDAD_IDS.includes(FIRMANTE_CALIDAD_LIBRE),
    '🔴 la ranura libre no está entre los ids: el desplegable no podría ofrecerla');
});

// ── ② 🔴 LAS ETIQUETAS SIGUEN SIN APROBAR, Y SE VE ───────────────────────────────────────

test('SCRUM-300 · las SEIS etiquetas son las APROBADAS por el fundador (6-ago-2026), literales', () => {
  // Este test nació exigiendo el marcador `[PENDIENTE microcopy oficial]` en las seis, porque el
  // comentario del asesor que prometía los textos NUNCA SE ESCRIBIÓ (SCRUM-300 tenía 5 comentarios
  // y ninguno los contenía; medido el 5-ago-2026). El rojo estaba DISEÑADO para saltar el día que
  // llegara la aprobación de verdad, y saltó: eso es lo que obligó a que el texto y su aprobación
  // entraran en el mismo commit, con quién la dio y cuándo.
  //
  // ⚠️ Literales a propósito. Estos seis acaban impresos en un documento que se puede leer en un
  // juzgado: cambiarlos exige una aprobación nueva, anotada, en el commit que los cambie.
  assert.deepEqual({ ...FIRMANTE_CALIDAD_ETIQUETAS }, {
    el_propio_cliente: 'El propio cliente',
    en_nombre_del_cliente: 'En nombre del cliente',
    familiar_o_conviviente: 'Un familiar o conviviente',
    encargado_o_personal_de_obra: 'Encargado o personal de la obra',
    portero_o_conserje: 'Portero o conserje',
    otro: 'Otro',
  }, '🔴 LA MICROCOPY APROBADA HA CAMBIADO. La aprobó el fundador el 6-ago-2026, literal. ' +
     'Si hay aprobación nueva, actualiza este test en el MISMO commit y anota quién y cuándo.');

  // Y NINGUNA lleva ya el marcador: si vuelve uno, es que alguien añadió una ranura sin aprobar.
  for (const id of FIRMANTE_CALIDAD_IDS) {
    assert.notEqual(FIRMANTE_CALIDAD_ETIQUETAS[id], PENDIENTE,
      `🔴 la ranura «${id}» ha vuelto al marcador, o es nueva y nadie ha aprobado su texto`);
  }

  // El marcador sigue existiendo —lo usan el nombre obligatorio y las calidades desconocidas— y es
  // el del repo, no uno parecido: si cada sitio inventa el suyo, dejan de ser encontrables.
  assert.equal(PENDIENTE, '[PENDIENTE microcopy oficial]');
});

test('SCRUM-300 · 🔴 «representante» NO está en el vocabulario, y el motivo es jurídico', () => {
  // Decisión del fundador (6-ago-2026), revirtiendo la primera resolución del asesor:
  // «representante» significa quien puede OBLIGAR al cliente, y el profesional no puede verificar
  // eso — le haríamos afirmar más de lo que sostiene, con nuestro sello encima. La categoría hace
  // falta (el administrador de una comunidad no es ninguna de las otras cinco), y por eso existe
  // `en_nombre_del_cliente`: describe el HECHO OBSERVADO sin afirmar la figura jurídica.
  //
  // Esto NO es estilo: es lo que separa un albarán que sostiene lo que dice de uno que no.
  const prohibidas = /represent|apoderad|autorizad/i;
  for (const [id, etiqueta] of Object.entries(FIRMANTE_CALIDAD_ETIQUETAS)) {
    assert.equal(prohibidas.test(id), false,
      `🔴 el id «${id}» usa una figura jurídica que el profesional no puede verificar`);
    assert.equal(prohibidas.test(etiqueta), false,
      `🔴 la etiqueta «${etiqueta}» afirma una figura jurídica («representante», «apoderado», ` +
      '«autorizado») que el profesional no está en condiciones de sostener — y va dentro del ' +
      'contenido que sella la firma.');
  }
  assert.ok(FIRMANTE_CALIDAD_IDS.includes('en_nombre_del_cliente'),
    '🔴 falta la ranura que cubre a quien firma por el cliente sin ser ninguna de las otras ' +
    'cinco (el administrador de una comunidad). Sin ella, esa persona no tiene dónde caer.');
});

test('SCRUM-300 · al navegador viaja la microcopy SERVIDA, no una copia que el front reescriba', () => {
  const opciones = firmanteCalidadOpciones();
  assert.equal(opciones.length, 6, '🔴 el desplegable no ofrece las seis ranuras');
  assert.deepEqual(opciones.map((o) => o.id), [...FIRMANTE_CALIDAD_IDS],
    '🔴 el orden servido no es el orden fijado');
  for (const o of opciones) {
    assert.equal(o.etiqueta, FIRMANTE_CALIDAD_ETIQUETAS[o.id],
      `🔴 la ranura «${o.id}» viaja al navegador con un texto distinto del de la fuente única. ` +
      'Dos copias de una microcopy que acaba en un juzgado es cómo divergen sin que nadie se entere.');
  }
  assert.deepEqual(opciones.filter((o) => o.libre).map((o) => o.id), [FIRMANTE_CALIDAD_LIBRE],
    '🔴 hay más de una ranura marcada como libre, o ninguna');
});

test('SCRUM-300 · ⚠️ NINGUNA ranura viene marcada por defecto', () => {
  // Una casilla premarcada es una declaración que el firmante NO ha hecho. Lo dice también el
  // comentario de `firmadoPorCalidad` en `prisma/schema.prisma`: si esto cambiara, el schema
  // se quedaría mintiendo. La rama `scrum-300-firmado-por` premarcaba la primera; se retiró.
  const opciones = firmanteCalidadOpciones();
  const premarcadas = opciones.filter((o) => o.porDefecto === true || o.selected === true);
  assert.deepEqual(premarcadas, [],
    '🔴 una ranura viene premarcada. Eso pone en boca del firmante una declaración que no ha hecho.');

  // Y el suelo: ausente NO es un error, porque el campo es opcional.
  assert.deepEqual(resolverCalidadFirmante({}), { ok: true, valor: null });
  assert.deepEqual(resolverCalidadFirmante({ ranura: '' }), { ok: true, valor: null });
  assert.deepEqual(resolverCalidadFirmante({ ranura: null }), { ok: true, valor: null });
});

// ── ③ 🔴 SE GUARDA EL id, NO LA ETIQUETA ─────────────────────────────────────────────────

test('SCRUM-300 · 🔴 lo que se GUARDA es el `id`, nunca la etiqueta', () => {
  // Ésta es la decisión que hace que aprobar la microcopy más tarde NO obligue a reescribir
  // ningún documento firmado. La rama `scrum-300-firmado-por` guardaba el TEXTO resuelto; el
  // asesor lo revirtió por esto exactamente.
  for (const id of FIRMANTE_CALIDAD_IDS) {
    if (id === FIRMANTE_CALIDAD_LIBRE) continue;
    const r = resolverCalidadFirmante({ ranura: id });
    assert.deepEqual(r, { ok: true, valor: id },
      `🔴 la ranura «${id}» no se guarda como su id.\n\n` +
      '  Si se guardara la ETIQUETA, aprobar la microcopy obligaría a reescribir el campo de\n' +
      '  todos los albaranes ya firmados — y lo firmado no se toca, ni siquiera para arreglarlo.');
    assert.notEqual(r.valor, PENDIENTE, '🔴 se está guardando el MARCADOR en la base de datos');
  }
});

test('SCRUM-300 · la ranura libre codifica su texto junto al id, y da la vuelta entera', () => {
  const r = resolverCalidadFirmante({ ranura: 'otro', textoLibre: '  Vecina   del 3.º  ' });
  assert.equal(r.ok, true);
  assert.equal(r.valor, 'otro:Vecina del 3.º', '🔴 el texto libre no se codifica junto al id');
  assert.deepEqual(decodificarCalidad(r.valor), { id: 'otro', textoLibre: 'Vecina del 3.º' });

  // Un texto libre con `:` dentro NO rompe el formato: se parte por el PRIMERO, y ningún id
  // contiene `:`. Sin esto, «Portería: la del turno de tarde» perdería media frase.
  const conDosPuntos = codificarCalidad('otro', 'Portería: la del turno de tarde');
  assert.deepEqual(decodificarCalidad(conDosPuntos),
    { id: 'otro', textoLibre: 'Portería: la del turno de tarde' },
    '🔴 un texto libre con «:» se parte mal al releerlo');

  // Y sin texto, la ranura libre no dice nada: se rechaza en vez de guardar un id mudo.
  const vacio = resolverCalidadFirmante({ ranura: 'otro', textoLibre: '   ' });
  assert.equal(vacio.ok, false);
  assert.equal(vacio.error, 'calidad_firmante_otro_vacio');
});

test('SCRUM-300 · un id que no está en la lista se RECHAZA, no se guarda «por si acaso»', () => {
  // Guardar basura en un campo probatorio es peor que no tenerlo.
  for (const malo of ['cliente', 'convive', 'obra', 'porteria', 'otra_persona', 'encargado_o_personal_obra']) {
    const r = resolverCalidadFirmante({ ranura: malo });
    assert.equal(r.ok, false,
      `🔴 «${malo}» se ha aceptado. Son los ids de las DOS ramas paralelas, que el asesor ` +
      'sustituyó: si vuelven a colarse, tendríamos dos vocabularios en la misma columna.');
    assert.equal(r.error, 'calidad_firmante_invalida');
  }
});

test('SCRUM-300 · pintar una calidad guardada: id conocido → su etiqueta · libre → su texto · desconocido → marcador', () => {
  assert.equal(etiquetaCalidad('el_propio_cliente'), 'El propio cliente');
  assert.equal(etiquetaCalidad('en_nombre_del_cliente'), 'En nombre del cliente');
  assert.equal(etiquetaCalidad('otro:Vecina del 3.º'), 'Vecina del 3.º',
    '🔴 en la ranura libre lo que se enseña es lo que escribió el profesional, no una etiqueta');
  assert.equal(etiquetaCalidad('un_id_que_ya_no_existe'), PENDIENTE,
    '🔴 un id desconocido NO se inventa: se declara con el marcador');
  assert.equal(etiquetaCalidad(null), null);
  assert.equal(etiquetaCalidad(''), null);
});

// ── ④ LOS TOPES, QUE SON VALIDACIÓN Y NO ESTILO ──────────────────────────────────────────

test('SCRUM-300 · los topes son los del asesor: nombre 160 · otro 120 · lugar 300', () => {
  // El nombre a 160 y no a 120 (la rama `scrum-300-campos-albaran` traía 120): «el coste de un
  // límite corto es truncar el nombre legal de una persona en un documento firmado; el de uno
  // generoso es ninguno».
  assert.equal(FIRMANTE_NOMBRE_MAX, 160);
  assert.equal(FIRMANTE_OTRO_MAX, 120);
  assert.equal(LUGAR_ENTREGA_MAX, 300);

  assert.equal(normalizarNombreFirmante('x'.repeat(200)).length, 160, '🔴 el nombre no se acota');
  assert.equal(normalizarLugarEntrega('y'.repeat(400)).length, 300, '🔴 el lugar no se acota');
  assert.equal(codificarCalidad('otro', 'z'.repeat(200)), `otro:${'z'.repeat(120)}`,
    '🔴 el texto libre no se acota al codificar');
});

test('SCRUM-300 · 🔴 SUELO: vacío se queda VACÍO, nunca se cae a otra dirección', () => {
  // Lo pide el ticket y el asesor lo reafirma: poner la dirección equivocada en un documento de
  // entrega es peor que dejarla en blanco, porque el cliente la firma sin mirarla.
  for (const v of ['', '   ', null, undefined]) {
    assert.equal(normalizarLugarEntrega(v), null, `🔴 «${JSON.stringify(v)}» no se guardó como null`);
    assert.equal(normalizarNombreFirmante(v), null);
  }
  // Y nunca la cadena vacía en la base: `''` y `null` no significan lo mismo al releer un
  // documento firmado, y el verificador normaliza contando con que se guardó `null`.
  assert.notEqual(normalizarLugarEntrega(''), '');
});

// ── ⑤ LOS RÓTULOS Y AYUDAS QUE SÍ EXISTEN ────────────────────────────────────────────────

test('SCRUM-300 · los rótulos del PDF conservan su espacio final, que es parte del literal', () => {
  // El PDF los pinta con `continued: true`: el rótulo va en negrita y el dato se concatena
  // detrás. Sin el espacio sale «Firmado por:Marta» — el defecto que nadie ve hasta que el PDF
  // está delante de alguien que importa.
  assert.equal(ALBARAN_ROTULOS.pdfFirmadoPor, 'Firmado por: ');
  assert.equal(ALBARAN_ROTULOS.pdfEnCalidadDe, 'En calidad de: ');
  assert.ok(ALBARAN_ROTULOS.pdfFirmadoPor.endsWith(' '), '🔴 se ha perdido el espacio final');
  assert.ok(ALBARAN_ROTULOS.pdfEnCalidadDe.endsWith(' '), '🔴 se ha perdido el espacio final');

  // ⚠️ Y NO llevan marcador: un `[PENDIENTE …]` impreso en un documento que se lee en un juzgado
  // sería peor que el rótulo. Éstos sí tienen aprobación anotada campo a campo en el módulo.
  for (const [campo, texto] of Object.entries(ALBARAN_ROTULOS)) {
    assert.ok(!texto.includes(PENDIENTE), `🔴 el rótulo «${campo}» va al PDF con el marcador dentro`);
  }
});

test('SCRUM-300 · las ayudas explican POR QUÉ se pide el dato, y el chip tiene su hueco', () => {
  for (const campo of ['lugarEntrega', 'fechaEntrega', 'firmadoPorNombre']) {
    assert.ok(ALBARAN_AYUDAS[campo] && ALBARAN_AYUDAS[campo].length > 20,
      `🔴 falta la ayuda de «${campo}» (viene de la rama scrum-300-campos-albaran)`);
  }
  assert.ok(ALBARAN_AYUDAS.chipNombreCliente.includes('%s'),
    '🔴 el chip de sugerencia no tiene el hueco `%s` del nombre del cliente: se pintaría literal');
  assert.ok(ALBARAN_AYUDAS.noSePidio.length > 0,
    '🔴 falta el texto de «no se pidió al firmar» para los albaranes anteriores a C5');
});
