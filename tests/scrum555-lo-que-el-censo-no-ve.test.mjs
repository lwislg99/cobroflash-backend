// tests/scrum555-lo-que-el-censo-no-ve.test.mjs — SCRUM-555
//
// Sin gate: lee ficheros. Ni BD, ni red, ni servidor.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 UN CENSO EN VERDE NO DICE «NO HAY NADA»: DICE «NO HAY NADA DONDE MIRÉ»
//
// El censo de anclas del bloque F mira `h1|h2|h3|p|li`. En sus dos secciones eso son 19 de los
// 35 nodos de texto que un visitante lee: se quedan fuera DIECISÉIS. Y en `#contacto-publico`
// hay tres textos más que no son elementos, sino ATRIBUTOS que pinta un script — ningún censo
// de etiquetas puede verlos, por bien escrito que esté.
//
// Este fichero no amplía el extractor de nadie. Fija lo que queda fuera con RECUENTO EXACTO:
// no «al menos dieciséis», sino ESTOS dieciséis. Un umbral con holgura se queda verde el día
// que se pierde uno; un recuento exacto, no. (La misma enfermedad que SCRUM-559 cura en los
// guards del dashboard; aquí es otra superficie y otros ficheros, así que no se duplica nada.)
//
// Y de paso deja escritas tres cosas que hasta hoy sólo se sabían mirando:
//   · qué censo cubre qué sección, y que NO se solapan (`CENSOS_DEL_BLOQUE_F`);
//   · cuánto se le escapa al detector léxico, medido contra verdad conocida;
//   · las CINCO cifras de la copia acopladas a un recuento del marcado — no una.
// ─────────────────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECCIONES_BLOQUE_F } from '../scripts/censo-anclas-bloque-f.mjs';
import {
  CENSOS_DEL_BLOQUE_F, FUERA_DEL_ESQUEMA, TEXTOS_EN_ATRIBUTOS, CIFRAS_ACOPLADAS,
  COBERTURA_DEL_DETECTOR, ETIQUETAS_DEL_CENSO,
  nodosDeTexto, cuerpoDeSeccion, podar, repartoDeSeccion, seccionesCensadas,
  declarado, medido, medirDetector, leerLanding,
} from '../scripts/_texto-fuera-del-censo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = leerLanding(RAIZ);

/** El reparto medido el 20-ago-2026. Es el trinquete: no se mueve en silencio. */
const REPARTO_HOY = {
  'heroe-f4': { total: 8, cubiertos: 5, fuera: 3 },
  'gremios': { total: 27, cubiertos: 14, fuera: 13 },
};

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · si el parser no sabe leer, todo lo de abajo da cero y el cero parece limpieza
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SUELO · el parser encuentra texto, y la pila de etiquetas funciona', () => {
  const cuerpo = cuerpoDeSeccion(podar(html), 'heroe-f4');
  assert.ok(cuerpo, '🔴 CIEGO: no se localiza #heroe-f4 en la landing');
  const nodos = nodosDeTexto(cuerpo);
  assert.ok(nodos.length > 0, '🔴 CIEGO: cero nodos de texto en #heroe-f4');
  // control positivo: el h1 del héroe existe Y su pila lo dice. Sin pila no se puede
  // distinguir «cubierto» de «fuera», y todo el fichero mediría otra cosa.
  const conH1 = nodos.filter((n) => n.pila.includes('h1'));
  assert.ok(conH1.length > 0, '🔴 CIEGO: ningún nodo con `h1` en su pila — la pila no funciona');
  // control negativo: el rótulo `.eyebrow` NO puede aparecer como cubierto.
  const rotulo = nodos.find((n) => n.texto.startsWith('El ERP por WhatsApp'));
  assert.ok(rotulo, '🔴 CIEGO: no se encuentra el rótulo del héroe');
  assert.equal(rotulo.pila.some((t) => ETIQUETAS_DEL_CENSO.includes(t)), false,
    '🔴 el rótulo sale como cubierto: el criterio de cobertura está del revés');
});

test('SUELO · las secciones censadas existen y no están vacías', () => {
  const ids = seccionesCensadas();
  assert.ok(ids.length > 0, '🔴 CIEGO: `SECCIONES_BLOQUE_F` no declara ninguna sección censada');
  for (const id of ids) {
    const r = repartoDeSeccion(html, id);
    assert.equal(r.ausente, false, `🔴 CIEGO: #${id} está declarada censada y no aparece en el HTML`);
    assert.ok(r.total > 0, `🔴 CIEGO: cero nodos de texto en #${id}`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL RECUENTO EXACTO · N ≠ M deja de ser invisible
// ═════════════════════════════════════════════════════════════════════════════════════════
test('cada sección censada reparte sus nodos sin perder ninguno', () => {
  for (const id of seccionesCensadas()) {
    const r = repartoDeSeccion(html, id);
    assert.equal(r.cubiertos + r.fuera.length, r.total,
      `🔴 #${id}: ${r.cubiertos} + ${r.fuera.length} no suma ${r.total}. El reparto pierde nodos, `
      + 'y lo que se pierde en el reparto no sale en ninguna de las dos listas.');
  }
});

test('el reparto medido es el declarado — recuento EXACTO, no umbral', () => {
  for (const [id, esperado] of Object.entries(REPARTO_HOY)) {
    const r = repartoDeSeccion(html, id);
    assert.deepEqual(
      { total: r.total, cubiertos: r.cubiertos, fuera: r.fuera.length },
      esperado,
      `🔴 #${id}: el reparto cambió. Si el censo ahora ve más, actualiza este trinquete Y mira `
      + 'si esas frases necesitan ancla. Si ve menos, alguien acaba de dejar texto sin vigilar.',
    );
  }
});

test('lo que se escapa del esquema está declarado uno a uno, con su cuenta', () => {
  const m = medido(html);
  const d = declarado();
  assert.ok(m.length > 0, '🔴 CIEGO: cero textos fuera del esquema — el detector no está mirando');
  assert.deepEqual(m, d,
    '🔴 la lista de textos fuera del esquema ya no es la declarada.\n'
    + '      medido  : ' + JSON.stringify(m, null, 0).slice(0, 400) + '\n'
    + '      declarado: ' + JSON.stringify(d, null, 0).slice(0, 400) + '\n'
    + '      → si es texto nuevo, decláralo en `FUERA_DEL_ESQUEMA` CON SU MOTIVO. No decidir '
    + 'es dejarlo sin vigilar, que es exactamente lo que este fichero viene a impedir.');
});

test('AUTOPRUEBA · un texto nuevo fuera del esquema tumba la comprobación', () => {
  // El mecanismo se prueba metiendo un texto que NO existe y viendo que se nota. Sin esto,
  // un `deepEqual` entre dos listas vacías estaría igual de verde y no probaría nada.
  const ANCLA = '<span class="eyebrow">Tu oficio</span>';
  assert.ok(html.includes(ANCLA), '🔴 CIEGO: no se encuentra el rótulo donde inyectar la prueba');
  const conIntruso = html.replace(ANCLA, ANCLA + '<span>TEXTO SINTETICO DE PRUEBA</span>');
  const m = medido(conIntruso);
  assert.equal(m.length, declarado().length + 1,
    '🔴 el mecanismo NO ve un texto nuevo fuera del esquema. Entonces su verde no significa nada.');
  assert.ok(m.some((x) => x.endsWith('TEXTO SINTETICO DE PRUEBA')),
    '🔴 el texto inyectado no aparece nombrado: el fallo no diría qué se coló');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LOS TEXTOS QUE VIVEN EN ATRIBUTOS · ningún censo de etiquetas puede verlos
// ═════════════════════════════════════════════════════════════════════════════════════════
test('los tres textos de F7 que viven en atributos siguen ahí, byte a byte', () => {
  for (const t of TEXTOS_EN_ATRIBUTOS) {
    const cuerpo = cuerpoDeSeccion(html, t.seccion);
    assert.ok(cuerpo, `🔴 CIEGO: no se localiza #${t.seccion}`);
    const m = new RegExp(t.atributo + '\\s*=\\s*"([^"]*)"').exec(cuerpo);
    assert.ok(m, `🔴 ${t.atributo} ya no está en #${t.seccion} (${t.doc})`);
    // Con === y Buffer.compare, nunca con includes(): un texto que CONTIENE al declarado
    // pasaría un includes() y sería otro texto.
    assert.equal(m[1], t.texto, `🔴 ${t.atributo} cambió de texto`);
    assert.equal(Buffer.compare(Buffer.from(m[1], 'utf8'), Buffer.from(t.texto, 'utf8')), 0,
      `🔴 ${t.atributo} coincide como cadena pero no byte a byte`);
    // y que ninguno sea alcanzable por el esquema, que es el motivo de que existan aquí
    assert.equal(ETIQUETAS_DEL_CENSO.some((e) => new RegExp('<' + e + '\\b[^>]*>[^<]*'
      + t.texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(cuerpo)), false,
      `🔴 ${t.doc} SÍ es alcanzable como elemento: entonces no pertenece a esta lista`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS CIFRAS ACOPLADAS · cinco, no una
// ═════════════════════════════════════════════════════════════════════════════════════════
test('cada cifra de la copia sigue cuadrando con lo que hay en el marcado', () => {
  assert.ok(CIFRAS_ACOPLADAS.length >= 5,
    '🔴 el censo de cifras acopladas se ha encogido: una lista de una entrada no es un censo');
  for (const c of CIFRAS_ACOPLADAS) {
    const cuerpo = cuerpoDeSeccion(podar(html), c.seccion);
    assert.ok(cuerpo, `🔴 CIEGO: no se localiza #${c.seccion}`);
    const hay = (cuerpo.match(new RegExp('class="[^"]*\\b' + c.clase + '\\b[^"]*"', 'g')) || []).length;
    assert.notEqual(hay, 0,
      `🔴 CIEGO: cero \`.${c.clase}\` en #${c.seccion}. Un cero aquí es el selector equivocado, `
      + 'no un desajuste: adivinar `.step` daba cero donde hay tres.');
    assert.equal(hay, c.dice,
      `🔴 «${c.frase}» dice ${c.dice} y en #${c.seccion} hay ${hay} \`.${c.clase}\`. `
      + 'O se corrige la frase, o se corrige el marcado — pero la copia no puede seguir contando '
      + 'una cosa que ya no está.');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL DETECTOR LÉXICO · sus agujeros, medidos, para que no crezcan
// ═════════════════════════════════════════════════════════════════════════════════════════
test('el detector de capacidad no pierde cobertura ni empieza a dar falsas alarmas', () => {
  const r = medirDetector(html);
  assert.equal(r.ciego, false, `🔴 CIEGO: ${r.motivo || 'el medidor no pudo mirar'}`);
  assert.equal(r.promesas, COBERTURA_DEL_DETECTOR.promesas,
    '🔴 ha cambiado el número de frases con verdad conocida: vuelve a medir antes de fiarte '
    + 'de los otros dos números');
  assert.ok(r.escapes <= COBERTURA_DEL_DETECTOR.escapes,
    `🔴 al detector se le escapan ahora ${r.escapes} promesas (antes ${COBERTURA_DEL_DETECTOR.escapes}): `
    + JSON.stringify(r.listaEscapes));
  assert.equal(r.falsosPositivos, COBERTURA_DEL_DETECTOR.falsosPositivos,
    '🔴 el detector ha empezado a saltar con frases que no prometen nada: '
    + JSON.stringify(r.listaFalsosPositivos));
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA DECLARACIÓN · que no se quede vieja sin que nadie se entere
// ═════════════════════════════════════════════════════════════════════════════════════════
test('toda sección del bloque F tiene escrito qué censo la cubre', () => {
  for (const id of Object.keys(SECCIONES_BLOQUE_F)) {
    assert.ok(id in CENSOS_DEL_BLOQUE_F,
      `🔴 #${id} está en \`SECCIONES_BLOQUE_F\` y nadie ha escrito qué censo la cubre. `
      + 'Decláralo en `CENSOS_DEL_BLOQUE_F`: sin eso, «no la mira este censo» y «no la mira '
      + 'nadie» se leen igual.');
  }
  for (const [id, c] of Object.entries(CENSOS_DEL_BLOQUE_F)) {
    assert.ok(c.censo !== undefined, `🔴 #${id}: la declaración no dice ni siquiera que sea nula`);
    if (c.censo === null) assert.ok(c.nota, `🔴 #${id}: fuera de todo censo y sin motivo escrito`);
  }
});

test('cada texto declarado fuera del esquema lleva su motivo', () => {
  for (const d of FUERA_DEL_ESQUEMA) {
    assert.ok(d.motivo && d.motivo.length > 20,
      `🔴 «${d.texto}» está en la lista de exclusión sin motivo. Una lista sin motivos es un `
      + 'barrido con permiso, no una declaración.');
    assert.ok(Number.isInteger(d.veces) && d.veces > 0, `🔴 «${d.texto}» sin cuenta exacta`);
  }
});
