// tests/scrum561-citar-fuera-del-esquema.test.mjs — SCRUM-561
//
// Sin gate: lee ficheros. Ni BD, ni red, ni servidor.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 UNA CITA QUE NO SE VERIFICA ES UNA COPIA, Y UNA COPIA CADUCA SIN AVISAR
//
// `docs/MICROCOPY_FUERA_DEL_ESQUEMA.md` pone delante del fundador los veinte nodos de texto que
// el esquema `h1|h2|h3|p|li` del censo de anclas no alcanza. Si esos textos cambian en la landing
// y el documento se queda igual, el fundador estaría leyendo lo de ayer creyendo que es lo de hoy
// — que es peor que no tener documento.
//
// Aquí se fija: el documento se GENERA del marcado, y este fichero comprueba que el que está en
// disco es exactamente el que sale del marcado de hoy.
// ─────────────────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  citar, citarSeccion, textosDelDocumento, enElDocumento, SECCIONES, NATURALEZAS,
} from '../scripts/_citar-fuera-del-censo.mjs';
import { unidades } from '../scripts/censo-anclas-bloque-f.mjs';
import { generar, DESTINO } from '../scripts/citar-fuera-del-censo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(RAIZ, 'public/index.html'), 'utf8');
const delDoc = textosDelDocumento(RAIZ);

/** Lo medido el 20-ago-2026. El trinquete: no se mueve en silencio en ninguna dirección. */
const HOY = {
  'heroe-f4': { total: 8, cubiertos: 5, fuera: 3 },
  'gremios': { total: 27, cubiertos: 14, fuera: 13 },
  'comparativa': { total: 36, cubiertos: 32, fuera: 4 },
};
const AFIRMAN_HOY = { IDENTIDAD: 1, CONDICION: 7, CAPACIDAD: 0 };
const GLIFOS_HOY = 6;

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · un cero aquí se leería como «no falta nada por aprobar»
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SUELO · hay nodos fuera del esquema, y las tres secciones existen', () => {
  for (const id of SECCIONES) {
    assert.notEqual(citarSeccion(html, id), null,
      `🔴 CIEGO: no se localiza #${id} en la landing. Sin la sección, su cero de nodos fuera del `
      + 'esquema no significa «no falta nada»: significa que no se ha podido mirar.');
  }
  const r = citar(html);
  assert.ok(r.fuera.length > 0,
    '🔴 CIEGO: cero nodos fuera del esquema. Están medidos: son 20. Un cero es el instrumento '
    + 'roto, no una landing limpia.');
});

test('SUELO · el generador se declara ciego en vez de escribir un documento vacío', () => {
  // Control del propio suelo: con un HTML sin ninguna de las secciones, `generar` tiene que
  // reventar, no devolver un documento con cero entradas que se leería como «no hay nada».
  assert.throws(() => generar('<html><body><p>nada</p></body></html>', delDoc), /CIEGO/,
    '🔴 el generador produce documento aunque no haya podido mirar');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONTROL POSITIVO · si los que SÍ ve el esquema aparecen en la lista, la lista es ruido
// ═════════════════════════════════════════════════════════════════════════════════════════
test('CONTROL POSITIVO · ninguna UNIDAD del censo entra en la cita', () => {
  // Se compara contra las UNIDADES del censo —lo que se extrajo para aprobar—, no contra los
  // nodos cubiertos sueltos. El motivo es medido: «Tu método actual» y «Con YaQu» existen DOS
  // veces en la comparativa, como cabecera de columna (fuera) y como etiqueta dentro del `<p>`
  // de cada celda (dentro). Comparar por texto suelto daba rojo por dos nodos DISTINTOS que
  // comparten cadena, que es justo lo que el identificador derivado sirve para distinguir.
  const unidadesDelCenso = new Set(unidades(html).map((u) => u.texto));
  assert.ok(unidadesDelCenso.size > 0, '🔴 CIEGO: el censo no devuelve ninguna unidad');
  for (const id of SECCIONES) {
    const s = citarSeccion(html, id);
    assert.ok(s.cubiertos.length > 0, `🔴 CIEGO: cero nodos cubiertos en #${id}`);
    const colados = s.fuera.filter((n) => unidadesDelCenso.has(n.texto));
    assert.deepEqual(colados.map((n) => n.id), [],
      `🔴 #${id}: la cita repite unidades que el censo YA extrae. Entonces no separa nada y la `
      + 'lista es ruido: ' + JSON.stringify(colados.map((n) => n.texto)));
  }
});

test('los textos que existen DOS veces quedan señalados, no confundidos', () => {
  const dobles = citar(html).fuera.filter((n) => n.tambienDentro);
  assert.deepEqual(dobles.map((n) => n.id), ['comparativa/span#3', 'comparativa/span#4'],
    '🔴 ha cambiado qué textos aparecen a la vez dentro y fuera del esquema. Si hay uno nuevo, '
    + 'el documento tiene que decirlo: si no, se lee como un texto inédito y no lo es.');
  for (const n of dobles) {
    assert.equal(n.naturaleza, 'ROTULO', `🔴 ${n.id}: el duplicado no es una cabecera de columna`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL RECUENTO Y LOS TEXTOS
// ═════════════════════════════════════════════════════════════════════════════════════════
test('el reparto de cada sección es el medido — exacto, no umbral', () => {
  for (const [id, esperado] of Object.entries(HOY)) {
    const s = citarSeccion(html, id);
    assert.deepEqual({ total: s.total, cubiertos: s.cubiertos.length, fuera: s.fuera.length }, esperado,
      `🔴 #${id}: el reparto cambió. Si hay texto nuevo fuera del esquema, hay que CITARLO — `
      + 'regenera el documento y actualiza este trinquete.');
  }
});

test('cada texto citado sale del marcado, byte a byte', () => {
  const bruto = fs.readFileSync(path.join(RAIZ, 'public/index.html'), 'utf8');
  for (const n of citar(html).fuera) {
    // Se recompone DESDE el fichero, no desde la estructura ya construida: si el extractor
    // inventara un texto, compararlo consigo mismo no lo detectaría.
    const re = new RegExp('>\\s*' + n.texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*<');
    assert.ok(re.test(bruto), `🔴 ${n.id}: «${n.texto}» no aparece así en el HTML`);
    const desdeFichero = re.exec(bruto)[0].slice(1, -1).trim();
    assert.equal(desdeFichero, n.texto, `🔴 ${n.id}: el texto citado no es el del fichero`);
    assert.equal(Buffer.compare(Buffer.from(desdeFichero, 'utf8'), Buffer.from(n.texto, 'utf8')), 0,
      `🔴 ${n.id}: coincide como cadena pero no byte a byte`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA NATURALEZA Y LA AFIRMACIÓN · con su criterio, y con trinquete
// ═════════════════════════════════════════════════════════════════════════════════════════
test('cada nodo citado tiene una naturaleza declarada, y los glifos son los que no tienen letra', () => {
  const fuera = citar(html).fuera;
  for (const n of fuera) {
    assert.ok(NATURALEZAS.includes(n.naturaleza), `🔴 ${n.id}: naturaleza «${n.naturaleza}» sin declarar`);
    assert.equal(n.naturaleza === 'GLIFO', !/\p{L}/u.test(n.texto),
      `🔴 ${n.id}: «${n.texto}» clasificado como ${n.naturaleza} y el criterio de letra dice otra cosa`);
  }
  assert.equal(fuera.filter((n) => n.naturaleza === 'GLIFO').length, GLIFOS_HOY,
    '🔴 ha cambiado el número de glifos; si es texto nuevo, hay que citarlo');
});

test('las afirmaciones sobre el producto son las medidas — y la más fuerte sigue nombrada', () => {
  const fuera = citar(html).fuera;
  for (const [clase, cuantas] of Object.entries(AFIRMAN_HOY)) {
    assert.equal(fuera.filter((n) => n.afirma.includes(clase)).length, cuantas,
      `🔴 ${clase}: la cuenta cambió. Si son MÁS, hay una afirmación nueva sin ancla y sin `
      + 'aprobar. Si son MENOS, alguien tocó un texto de propuesta o el criterio.');
  }
  const identidad = fuera.filter((n) => n.afirma.includes('IDENTIDAD'));
  assert.equal(identidad[0].texto, 'El ERP por WhatsApp para los oficios',
    '🔴 la afirmación de identidad ya no es la que se citó al fundador');
  assert.equal(Buffer.compare(Buffer.from(identidad[0].texto, 'utf8'),
    Buffer.from('El ERP por WhatsApp para los oficios', 'utf8')), 0,
    '🔴 coincide como cadena pero no byte a byte');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CRUCE CON EL DOCUMENTO QUE SÍ EXISTE
// ═════════════════════════════════════════════════════════════════════════════════════════
test('los veinte siguen estando en el documento de aprobación del bloque F', () => {
  const fuera = citar(html).fuera;
  const ineditos = fuera.filter((n) => !enElDocumento(n, delDoc));
  assert.ok(delDoc.length > 0, '🔴 CIEGO: cero textos leídos del documento de aprobación');
  assert.deepEqual(ineditos.map((n) => n.id), [],
    '🔴 hay textos de propuesta que NO están en ningún documento. Ésos sí que no se le han '
    + 'puesto delante a nadie: ' + JSON.stringify(ineditos.map((n) => n.texto)));
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL DOCUMENTO NO SE QUEDA VIEJO
// ═════════════════════════════════════════════════════════════════════════════════════════
test('el documento en disco es exactamente el que sale del marcado de hoy', () => {
  const enDisco = fs.readFileSync(path.join(RAIZ, DESTINO), 'utf8');
  // Los finales de línea los decide `.gitattributes` (`*.md text eol=lf`) y los vigila
  // SCRUM-480. Aquí se compara el contenido, no el fin de línea: si se comparara crudo, este
  // test daría rojo por algo que ya tiene dueño y no es lo que viene a proteger.
  const norm = (s) => s.replace(/\r\n/g, '\n');
  assert.equal(norm(enDisco), norm(generar(html, delDoc)),
    '🔴 el documento está desfasado respecto al marcado. Regenéralo:\n'
    + '      node scripts/citar-fuera-del-censo.mjs');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// AUTOPRUEBA · el mecanismo tiene que ver texto nuevo, o su verde no vale
// ═════════════════════════════════════════════════════════════════════════════════════════
test('AUTOPRUEBA · un <span> de texto nuevo en una sección de propuesta queda NOMBRADO', () => {
  const ANCLA = '<span class="eyebrow">Tu oficio</span>';
  const INTRUSO = '<span>PROMESA NUEVA SIN APROBAR</span>';
  assert.ok(html.includes(ANCLA), '🔴 CIEGO: no se encuentra el rótulo donde inyectar la prueba');
  const r = citar(html.replace(ANCLA, ANCLA + INTRUSO));
  const colado = r.fuera.find((n) => n.texto === 'PROMESA NUEVA SIN APROBAR');
  assert.ok(colado, '🔴 el censo NO ve un texto nuevo fuera del esquema: su verde no significa nada');
  assert.equal(colado.seccion, 'gremios', '🔴 lo ve pero no dice en qué sección está');
  assert.ok(/^gremios\/span#\d+$/.test(colado.id),
    `🔴 el identificador «${colado.id}» no permite localizarlo en el marcado`);
  assert.equal(enElDocumento(colado, delDoc), null,
    '🔴 un texto que no existe aparece como presente en el documento de aprobación');
});
