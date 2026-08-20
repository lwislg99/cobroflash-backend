// tests/scrum563-registro-de-lo-aprobado.test.mjs — SCRUM-563
//
// Sin gate: lee ficheros. Ni BD, ni red, ni servidor.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 UNA APROBACIÓN QUE NO CADUCA SOLA ES UNA APROBACIÓN QUE MIENTE
//
// El registro guarda el TEXTO LITERAL de lo aprobado, no una descripción. Eso es lo que permite
// contestar «¿este texto de hoy es el que se aprobó?» con `Buffer.compare` — y lo que hace que
// reescribir una frase aprobada caduque su aprobación sin que nadie tenga que acordarse.
//
// Es el mecanismo de SCRUM-551 copiado, no reinventado: allí el registro guarda el texto de cada
// frase y el ancla caduca sola cuando alguien la reescribe.
// ─────────────────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unidades } from '../scripts/censo-anclas-bloque-f.mjs';
import {
  REGISTRO, APROBADO, PENDIENTE, NI_UNA_COSA_NI_OTRA, MARCADORES_DE_PENDIENTE,
  estadoDe, revisar, reconstruir, textosDeHoy, mismoTexto, leerLanding, SECCIONES,
} from '../scripts/_registro-de-lo-aprobado.mjs';
import { generar, DESTINO } from '../scripts/registro-de-lo-aprobado.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = leerLanding(RAIZ);

/** Lo medido el 20-ago-2026. */
const REGISTRADOS = 41;
const SIN_CUBRIR = 7;

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · un registro que no encuentra nada diría «no hay nada aprobado»
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SUELO · el registro tiene entradas y todas resuelven en la landing', () => {
  assert.ok(REGISTRO.length > 0,
    '🔴 CIEGO: el registro está vacío. Son 41. Un cero aquí se leería como «no hay nada aprobado».');
  assert.equal(REGISTRO.length, REGISTRADOS,
    `🔴 el registro tiene ${REGISTRO.length} entradas y se midieron ${REGISTRADOS}. Si se ha `
    + 'aprobado algo nuevo, se registra CON SU FECHA; si se ha quitado, se dice por qué.');
  const hoy = textosDeHoy(html);
  assert.ok(hoy.size > 0, '🔴 CIEGO: no se ha resuelto ni un identificador en la landing');
});

test('SUELO · el generador revienta en vez de escribir un documento vacío', () => {
  // No se puede vaciar `REGISTRO` (es una constante del módulo), así que se prueba el suelo del
  // otro extremo: sin landing que leer, `generar` no puede inventarse un estado.
  assert.throws(() => generar('<html><body></body></html>', '/no/existe'), /.+/,
    '🔴 el generador produce documento aunque no haya podido mirar');
});

test('CALIBRACIÓN · mi extractor coincide con el censo de S1 donde se solapan', () => {
  // El registro cubre las CUATRO secciones y el censo de S1 sólo las que él declara censadas.
  // Donde coinciden, los identificadores y los textos tienen que ser los mismos: si no, uno de
  // los dos está midiendo otra cosa y las comparaciones de abajo no valdrían nada.
  const deS1 = unidades(html);
  assert.ok(deS1.length > 0, '🔴 CIEGO: el censo de S1 no devuelve unidades');
  const mios = textosDeHoy(html);
  for (const u of deS1) {
    assert.ok(mios.has(u.id), `🔴 el registro no resuelve «${u.id}», que S1 sí extrae`);
    assert.equal(mios.get(u.id), u.texto, `🔴 «${u.id}»: los dos extractores no leen lo mismo`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONTROL POSITIVO · si salta con todo, es ruido y acabará desactivado
// ═════════════════════════════════════════════════════════════════════════════════════════
test('CONTROL POSITIVO · sin tocar nada, ninguna aprobación caduca', () => {
  const r = revisar(html);
  assert.deepEqual(r.caducadas.map((c) => c.id), [],
    '🔴 hay aprobaciones caducadas sin que nadie haya tocado la landing: el mecanismo es ruido');
  assert.deepEqual(r.sinAnclaje.map((c) => c.id), [],
    '🔴 hay identificadores registrados que ya no existen en el marcado');
  assert.equal(r.vigentes.length, REGISTRADOS, '🔴 no están vigentes las 41');
});

test('CONTROL POSITIVO · el texto guardado es el literal, no una descripción', () => {
  // Si el registro guardara descripciones, esto pasaría igual comparando cadenas cortas. Se
  // exige que cada texto guardado sea IDÉNTICO al del marcado, byte a byte.
  const hoy = textosDeHoy(html);
  for (const e of REGISTRO) {
    const ahora = hoy.get(e.id);
    assert.equal(ahora, e.texto, `🔴 ${e.id}: el registro no guarda el texto del marcado`);
    assert.equal(Buffer.compare(Buffer.from(ahora, 'utf8'), Buffer.from(e.texto, 'utf8')), 0,
      `🔴 ${e.id}: coincide como cadena y no byte a byte`);
    assert.ok(e.fecha && /^\d{4}-\d{2}-\d{2}$/.test(e.fecha), `🔴 ${e.id}: sin fecha con forma de fecha`);
    assert.ok(e.quien && e.quien.length > 2, `🔴 ${e.id}: sin autor`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CONTROL QUE DECIDE · los tres estados, y el tercero es el que no existía
// ═════════════════════════════════════════════════════════════════════════════════════════
test('dado un texto cualquiera, el registro contesta aprobado / pendiente / ni una cosa ni otra', () => {
  const casos = [
    { texto: 'Del presupuesto al cobro, sin salir de WhatsApp.', espera: APROBADO,
      porque: 'es una unidad registrada' },
    { texto: 'Escríbenos por WhatsApp', espera: APROBADO,
      porque: 'vive en un atributo y también está registrada' },
    { texto: 'El ERP por WhatsApp para los oficios', espera: PENDIENTE,
      porque: 'está en #heroe-f4, que lleva marcador, y NO está registrada' },
    { texto: 'Tu oficio', espera: PENDIENTE,
      porque: 'es un <span> de una sección marcada: el marcador es de la sección' },
    { texto: 'Seis herramientas. Una sola app.', espera: NI_UNA_COSA_NI_OTRA,
      porque: 'copy PUBLICADO que nadie aprobó ni marcó — el estado que no existía' },
    { texto: 'Tres pasos. Cero fricción.', espera: NI_UNA_COSA_NI_OTRA, porque: 'igual que el anterior' },
    { texto: 'esto no está en ninguna parte de la landing', espera: NI_UNA_COSA_NI_OTRA,
      porque: 'ni siquiera existe' },
  ];
  for (const c of casos) {
    assert.equal(estadoDe(c.texto, html).estado, c.espera,
      `🔴 «${c.texto}» debería ser ${c.espera}: ${c.porque}`);
  }
  // y que los tres estados se alcancen de verdad: si dos nunca salieran, esto sería un test
  // que aprueba una función que siempre contesta lo mismo.
  const alcanzados = new Set(casos.map((c) => estadoDe(c.texto, html).estado));
  assert.equal(alcanzados.size, 3, '🔴 no se alcanzan los tres estados: ' + [...alcanzados].join(', '));
});

test('un texto APROBADO lo es aunque viva en una sección marcada como pendiente', () => {
  // El orden importa: todas las secciones registradas llevan marcador. Si `PENDIENTE` ganara,
  // el registro no serviría para nada — todo saldría pendiente.
  const e = REGISTRO[0];
  const r = estadoDe(e.texto, html);
  assert.equal(r.estado, APROBADO, '🔴 lo aprobado sale como pendiente: gana el marcador al registro');
  assert.equal(r.id, e.id);
  assert.ok(MARCADORES_DE_PENDIENTE.length > 0, '🔴 CIEGO: no hay marcadores declarados');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA CADUCIDAD · el mecanismo de SCRUM-551
// ═════════════════════════════════════════════════════════════════════════════════════════
test('AUTOPRUEBA · cambiar UNA LETRA de un texto aprobado caduca su aprobación y la nombra', () => {
  // ⚠️ La inyección se hace sobre `>texto<`, no sobre el texto suelto, y por dos motivos medidos:
  //   · el texto del registro va LIMPIO (etiquetas fuera, espacios colapsados), así que muchos no
  //     aparecen literales en el HTML — «14 días gratis Sin tarjeta» sale de un `<p>` con un
  //     `<span>` dentro;
  //   · y los que sí aparecen, aparecen VARIAS veces: el h1 del héroe está también en `<title>` y
  //     en los `og:`, y `String.replace` se lleva la primera, que no es la de la sección.
  const e = REGISTRO.find((x) => x.id === 'comparativa[firma]/p#1');
  assert.ok(e, '🔴 CIEGO: no está la entrada de control en el registro');
  const diana = '>' + e.texto + '<';
  assert.equal(html.split(diana).length - 1, 1,
    `🔴 CIEGO: «${diana}» no aparece exactamente una vez; la inyección no sería determinista`);
  const roto = html.split(diana).join('>' + e.texto.slice(0, -1) + 'X<');
  const r = revisar(roto);
  const caida = r.caducadas.find((c) => c.id === e.id);
  assert.ok(caida, `🔴 se cambió «${e.texto}» y su aprobación NO caducó`);
  assert.equal(caida.fecha, e.fecha, '🔴 la caducidad no dice la fecha en que se aprobó');
  assert.equal(caida.texto, e.texto, '🔴 la caducidad no dice qué texto se había aprobado');
  assert.ok(caida.ahora.endsWith('X'), '🔴 la caducidad no dice qué dice el texto hoy');
  assert.equal(r.caducadas.length, 1,
    '🔴 cambiar UNA frase ha caducado ' + r.caducadas.length + ' aprobaciones: es ruido');
});

test('AUTOPRUEBA · si el identificador desaparece, se dice SIN ANCLAJE y no «caducada»', () => {
  // Son cosas distintas: el texto puede seguir aprobado y ser el marcado el que se movió.
  // Mezclarlas haría que un cambio de estructura pareciera un cambio de copy.
  // ⚠️ Se quita el ÚLTIMO `<p>` de su grupo, y no uno de en medio, porque el identificador lleva
  // ORDINAL: quitar el primero renumera los siguientes y entonces el mecanismo informa —con
  // razón— de textos CADUCADOS, no de un identificador perdido. Esa fragilidad del ordinal está
  // escrita en el módulo; aquí se ejercita el caso limpio.
  const e = REGISTRO.find((x) => x.id === 'comparativa[firma]/p#3');
  assert.ok(e, '🔴 CIEGO: no está la entrada de control');
  const diana = '<p><span class="cmp-lbl">Con YaQu</span> Lo aceptó con su firma y su fecha, y la firma queda dentro del PDF.</p>';
  assert.equal(html.split(diana).length - 1, 1, `🔴 CIEGO: no se encuentra la diana de la inyección`);
  // Los literales van en constantes y no dentro del `.replace()`: el censo de SCRUM-553 cuenta
  // como extractor cualquier etiqueta escrita en una línea que lleve un `.replace(`, y esto es
  // dato de prueba, sin patrón ninguno. Ya está reportado en su ticket; aquí sólo no se le añade.
  const ABRE = '<p>';
  const CIERRA = '</p>';
  const ABRE_OTRA = '<div>';
  const CIERRA_OTRA = '</div>';
  const roto = html.split(diana).join(diana.replace(ABRE, ABRE_OTRA).replace(CIERRA, CIERRA_OTRA));
  const r = revisar(roto);
  assert.deepEqual(r.sinAnclaje.map((s) => s.id), [e.id],
    '🔴 no se detecta —o no sólo— que ese identificador ya no existe');
  assert.deepEqual(r.caducadas.map((c) => c.id), [],
    '🔴 un cambio de estructura se está reportando como texto reescrito');
});

test('AUTOPRUEBA · quitar una unidad de EN MEDIO renumera, y el mecanismo lo canta igual', () => {
  // El identificador derivado lleva ordinal, así que no es estable frente a inserciones ni
  // borrados en medio. No es un defecto tapado: es una propiedad, y lo que importa es que el
  // cambio NO PASE EN SILENCIO. Aquí se comprueba que no pasa.
  const diana = '<p class="cmp-sit" id="cmp-sit-firma">El cliente dice que él nunca autorizó ese trabajo.</p>';
  assert.equal(html.split(diana).length - 1, 1, '🔴 CIEGO: no se encuentra la diana');
  const roto = html.split(diana).join(diana.replace('<p ', '<div ').replace('</p>', '</div>'));
  const r = revisar(roto);
  assert.ok(r.caducadas.length + r.sinAnclaje.length > 0,
    '🔴 se ha quitado una unidad de en medio y el registro no ha dicho nada');
  assert.ok(r.caducadas.every((c) => c.id.startsWith('comparativa[firma]/p#')),
    '🔴 el corrimiento salpica a filas que nadie ha tocado: ' + JSON.stringify(r.caducadas.map((c) => c.id)));
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LO QUE NINGUNA APROBACIÓN CUBRE
// ═════════════════════════════════════════════════════════════════════════════════════════
test('la reconstrucción separa lo no cubierto de lo partido de otra manera', () => {
  const r = reconstruir(RAIZ);
  assert.ok(r.doc.length > 0, '🔴 CIEGO: cero entradas leídas del documento de propuesta');
  assert.equal(r.cubierto.length + r.partidoDistinto.length + r.sinCubrir.length, r.doc.length,
    '🔴 la reconstrucción pierde entradas por el camino');
  assert.equal(r.sinCubrir.length, SIN_CUBRIR,
    `🔴 las entradas sin cubrir son ${r.sinCubrir.length} y se midieron ${SIN_CUBRIR}: `
    + JSON.stringify(r.sinCubrir.map((d) => d.num)));
  // y que ninguna de las «sin cubrir» esté en realidad registrada
  for (const d of r.sinCubrir) {
    assert.equal(REGISTRO.some((e) => mismoTexto(e.texto, d.texto)), false,
      `🔴 ${d.num} se declara sin cubrir y SÍ está en el registro`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL DOCUMENTO NO SE QUEDA VIEJO
// ═════════════════════════════════════════════════════════════════════════════════════════
test('el documento legible es exactamente el que sale del registro de hoy', () => {
  const enDisco = fs.readFileSync(path.join(RAIZ, DESTINO), 'utf8');
  // Los finales de línea los decide `.gitattributes` y los vigila SCRUM-480.
  const norm = (s) => s.replace(/\r\n/g, '\n');
  assert.equal(norm(enDisco), norm(generar(html, RAIZ)),
    '🔴 el documento está desfasado. Regenéralo:\n'
    + '      node scripts/registro-de-lo-aprobado.mjs');
});

test('no se ha inventado ningún marcador nuevo en el marcado', () => {
  // Los estados salen del máster. Si alguien mete `data-microcopy="APROBADO"` para señalar lo
  // aprobado, este registro sobra y el máster se ha cambiado por la puerta de atrás.
  const valores = [...html.matchAll(/data-microcopy="([^"]*)"/g)].map((m) => m[1]);
  const propuesta = [...html.matchAll(/data-propuesta="([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(valores)], ['PENDIENTE_FUNDADOR'],
    '🔴 ha aparecido un valor nuevo de `data-microcopy`: ' + JSON.stringify([...new Set(valores)]));
  assert.deepEqual([...new Set(propuesta)], ['microcopy-sin-aprobar'],
    '🔴 ha aparecido un valor nuevo de `data-propuesta`: ' + JSON.stringify([...new Set(propuesta)]));
  assert.ok(SECCIONES.length === 4, '🔴 CIEGO: el registro ya no cubre las cuatro secciones');
});
