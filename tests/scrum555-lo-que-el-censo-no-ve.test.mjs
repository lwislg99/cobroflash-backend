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
import { SECCIONES_BLOQUE_F, seccionesMarcadasSinDeclarar } from '../scripts/censo-anclas-bloque-f.mjs';
import {
  CENSOS_DEL_BLOQUE_F, FUERA_DEL_ESQUEMA, TEXTOS_EN_ATRIBUTOS, CIFRAS_ACOPLADAS,
  COBERTURA_DEL_DETECTOR, ETIQUETAS_DEL_CENSO,
  nodosDeTexto, cuerpoDeSeccion, podar, repartoDeSeccion, seccionesCensadas,
  declarado, medido, medirDetector, leerLanding,
  repartoDeMarcadores, decirElReparto, elementosConMarcador,
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
  // ⚠️ El intruso va en su propia constante a propósito. Escrito dentro del `.replace()`, el
  // censo de SCRUM-553 lo contaba como un extractor con el `>` pegado — y no lo es: es HTML
  // literal, dato de prueba, sin patrón ninguno. Reportado a S1; aquí sólo se deja escrito que
  // esta línea no extrae nada.
  const INTRUSO = '<span>TEXTO SINTETICO DE PRUEBA</span>';
  assert.ok(html.includes(ANCLA), '🔴 CIEGO: no se encuentra el rótulo donde inyectar la prueba');
  const conIntruso = html.replace(ANCLA, ANCLA + INTRUSO);
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
  // Exacto, no `<=`. Un `<=` aquí sería un umbral con holgura de los que censa SCRUM-559: se
  // quedaría verde si alguien «arregla» el detector por el camino equivocado —ampliando el
  // vocabulario a las frases de hoy— y nadie se enteraría de que el número se movió. Que baje
  // es una buena noticia, y aun así tiene que hacerse mirar y actualizar este trinquete.
  assert.equal(r.escapes, COBERTURA_DEL_DETECTOR.escapes,
    `🔴 al detector se le escapan ahora ${r.escapes} promesas (declaradas ${COBERTURA_DEL_DETECTOR.escapes}). `
    + 'Si son MÁS, hay promesas nuevas que el contraste no ve. Si son MENOS, alguien tocó el '
    + 'detector: actualiza `COBERTURA_DEL_DETECTOR` y di con qué criterio. Escapes: '
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

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL SUELO N ≠ M · punto 4 de SCRUM-555
// ═════════════════════════════════════════════════════════════════════════════════════════
//
// «Hay N elementos con marcador de propuesta y he mirado M.» Que el censo sepa DECIR el número
// es lo que faltaba: un rojo cuando algo falta no es lo mismo que poder contestar «son cuatro y
// he decidido sobre cuatro». Sin el número, el día que sean cinco y se mire cuatro, el verde de
// todo lo demás sigue igual de verde — que es justo lo que pasó cuando el censo extraía 17
// unidades y los textos eran 37.
//
// «Mirado» aquí es **decidido por escrito**: una sección declarada `censada:false` CON SU MOTIVO
// está mirada, porque alguien decidió. Lo que no puede existir es un elemento marcado sobre el
// que nadie haya decidido nada.

/** El reparto medido el 21-ago-2026. */
const MARCADORES_HOY = { N: 4, M: 4, censados: 2, fueraConMotivo: 2, fueraDeSection: 0 };

test('🔴 N ≠ M · todo elemento con marcador tiene una decisión escrita', () => {
  const r = repartoDeMarcadores(html);
  assert.ok(r.N > 0,
    '🔴 CIEGO: cero elementos con marcador de propuesta. Hay cuatro. Un cero aquí haría que '
    + 'N === M por vacío, y este suelo diría que todo está mirado sin haber mirado nada.');
  assert.deepEqual(r.sinDecidir.map((e) => `<${e.etiqueta}> id=${e.id || '(sin id)'}`), [],
    '🔴 HAY ELEMENTOS MARCADOS SOBRE LOS QUE NADIE HA DECIDIDO NADA.\n'
    + '      → decláralos en `SECCIONES_BLOQUE_F`: dentro del censo, o fuera CON SU MOTIVO. '
    + 'No decidir es dejarlos sin vigilar, y un texto sin vigilar se publica solo.');
  assert.equal(r.N, r.M,
    `🔴 hay ${r.N} elementos con marcador y sólo ${r.M} con decisión escrita.`);
});

test('🔴 N ≠ M · ninguna entrada del alcance se ha quedado mirando al vacío', () => {
  const r = repartoDeMarcadores(html);
  assert.deepEqual(r.declaradosQueNoExisten, [],
    '🔴 el alcance declara secciones que ya no llevan marcador en el HTML: '
    + JSON.stringify(r.declaradosQueNoExisten) + '\n'
    + '      → o les cambiaron el id, o se retiró el marcador. En los dos casos el censo está '
    + 'contando algo que no existe, y eso infla el «he mirado M» sin mirar nada.');
});

test('el reparto de marcadores es el medido — y el censo sabe DECIRLO', () => {
  const r = repartoDeMarcadores(html);
  assert.deepEqual({
    N: r.N, M: r.M, censados: r.censados.length,
    fueraConMotivo: r.fueraConMotivo.length, fueraDeSection: r.fueraDeSection.length,
  }, MARCADORES_HOY,
    '🔴 el reparto cambió. Si hay un marcador nuevo, decláralo; si ha desaparecido uno, di por qué.');
  // Y que sepa decirlo con palabras, no sólo con un booleano: un número que nadie imprime no
  // vigila nada — es la diferencia entre «no hay ninguno» y «no lo estoy buscando».
  const dicho = decirElReparto(html);
  assert.match(dicho, /elementos con marcador de propuesta: 4/);
  assert.match(dicho, /con decisión escrita: 4/);
});

test('AUTOPRUEBA · un marcador FUERA de <section> se ve — y es justo lo que el censo de S1 no mira', () => {
  // 🔴 EL HUECO QUE ESTE SUELO CIERRA. `seccionesMarcadasSinDeclarar()` recorre `/<section…>/g`:
  // un `data-microcopy` en un `<div>` no lo ve. Hoy los cuatro marcadores están en `<section>` y
  // por eso no hay nada escondido, pero eso es suerte, no diseño.
  const ANCLA = '<div class="wrap">';
  assert.ok(html.includes(ANCLA), '🔴 CIEGO: no se encuentra el punto de inyección');
  const INTRUSO = '<div class="wrap" data-microcopy="PENDIENTE_FUNDADOR" id="colado">';
  const roto = html.replace(ANCLA, INTRUSO);
  const r = repartoDeMarcadores(roto);
  assert.equal(r.N, MARCADORES_HOY.N + 1, '🔴 el contador no ve un marcador fuera de <section>');
  assert.notEqual(r.N, r.M, '🔴 lo ve pero no lo cuenta como pendiente de decidir');
  assert.ok(r.sinDecidir.some((e) => e.id === 'colado'), '🔴 lo ve pero no lo nombra');
  assert.equal(r.fueraDeSection.length, 1, '🔴 no dice que está fuera de <section>');

  // Y el contraste que justifica que esto exista: el contador de secciones NO lo ve.
  // ⚠️ Si este `deepEqual` cae, es BUENA noticia: alguien habrá extendido el censo de S1 a
  // cualquier etiqueta. Entonces relaja este trinquete y dilo — no lo tapes.
  assert.deepEqual(seccionesMarcadasSinDeclarar(roto), [],
    '🔴 el censo de secciones AHORA sí ve un marcador fuera de <section>. Si se ha extendido, '
    + 'actualiza este trinquete; si no, algo raro pasa con el patrón.');
});

test('AUTOPRUEBA · si un declarado pierde su marcador, el suelo lo canta', () => {
  const ANCLA = '<section id="gremios" class="sec-tint" data-microcopy="PENDIENTE_FUNDADOR" hidden>';
  assert.ok(html.includes(ANCLA), '🔴 CIEGO: no se encuentra la etiqueta de #gremios');
  // El literal va en su propia constante: el censo de SCRUM-553 cuenta como extractor cualquier
  // etiqueta escrita en una línea con `.replace(`, y esto es dato de prueba sin patrón ninguno.
  // Es la TERCERA vez que aparece el mismo falso positivo; reportado en su ticket, no se toca su tope.
  const SIN_MARCADOR = '<section id="gremios" class="sec-tint" hidden>';
  const roto = html.replace(ANCLA, SIN_MARCADOR);
  const r = repartoDeMarcadores(roto);
  assert.deepEqual(r.declaradosQueNoExisten, ['gremios'],
    '🔴 se le ha quitado el marcador a una sección declarada y el suelo no lo dice');
  assert.equal(r.N, MARCADORES_HOY.N - 1);
});

test('CONTROL · el buscador de marcadores tolera un `>` dentro de un atributo (SCRUM-553)', () => {
  // Con `[^>]*` la etiqueta se cortaría en el `>` del atributo y el marcador que viene después se
  // perdería en silencio. Es el defecto que censó SCRUM-553, aquí en su versión cara: perder un
  // marcador es perder una sección entera de vigilancia.
  const sintetico = '<div title="a > b" data-propuesta="microcopy-sin-aprobar" id="raro">x</div>';
  const r = elementosConMarcador(sintetico);
  assert.equal(r.length, 1, '🔴 no ve el marcador cuando hay un `>` dentro de un atributo');
  assert.equal(r[0].id, 'raro');
  // control negativo: sin marcador, no inventa ninguno
  assert.equal(elementosConMarcador('<div title="a > b" id="raro">x</div>').length, 0,
    '🔴 inventa marcadores donde no los hay');
});
