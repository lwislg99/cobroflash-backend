// tests/scrum666b-toda-clase-pintada-tiene-regla.test.mjs — SCRUM-666b
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL PUNTO CIEGO QUE DEJÓ LLEGAR UNA PANTALLA DESNUDA A PRODUCCIÓN
//
// El fundador abrió `#parte-detail` y no tenía una sola línea de CSS. La suite estaba en verde,
// los guards 21/21 y el recorrido decía 8/8. Ninguno podía cazarlo, y la razón no es que al banco
// le faltara la hoja: SCRUM-666 (PR #916) ya se la dio. Es que **le estaba haciendo otra
// pregunta**.
//
//     ocultoPorCss(<div class="clase-que-nadie-ha-escrito-jamas">) → { oculto: false }
//
// `false` se lee como «se ve». Y una clase sin ni una regla NO se ve: se pinta desnuda. El banco
// sabía contestar «¿la esconde una regla?» y nadie le había preguntado «¿tiene alguna?». Son dos
// preguntas distintas, y llevábamos semanas creyendo que respondíamos la segunda.
//
// ── LO MEDIDO EL 4-sep-2026, ANTES DE ESCRIBIR NADA ──────────────────────────────────────
// Las dos hojas locales definen **377 clases**. Contra ellas, los **77 scripts que declara el
// índice** escriben **29 clases que no tienen ni una regla**, repartidas en 15 ficheros. Tres
// están al 100 % —todas sus clases desnudas—, y una es la del fundador:
//
//     parteDetailView.js  4 de 4     globalSearch.js  1 de 1     tutorial.js  2 de 2
//
// 🔴 Y EL DATO QUE DECIDIÓ EL DISEÑO: de esas 29, un barrido por lo PINTADO sólo ve 13. Las 4 del
// parte, no — la vista se va por su rama de error en el banco y pinta 2 nodos sin una clase. Medir
// «lo que se pintó» habría dejado fuera justamente el caso que motivó el ticket. Por eso el
// barrido que manda aquí es el ESTÁTICO, sobre el fuente, y por eso la población son los 77
// scripts del índice y no los 27 `*View.js`: restringirla perdía 8 clases y dos ficheros enteros.
//
// ── LAS DOS VECES QUE EL INSTRUMENTO MINTIÓ, Y CÓMO SE VIERON ────────────────────────────
//  ① La primera versión sólo leía selectores a profundidad 0 y declaraba huérfanas
//     `col-hide-mobile`, `table--cards-mobile` y `quote-line__qty` — las tres definidas DENTRO de
//     un `@media`. Un lector que no entra en la media query no encuentra menos: encuentra otras.
//  ② Con la interpolación sustituida por un espacio, `class="status-pill status-pill-${v}"` daba
//     el token `status-pill-`, que es la MITAD de un nombre. Habría mandado a alguien a escribir
//     una regla inventada. Ahora la interpolación contamina el token que toca y éste se descarta.
//
// Las dos las cazó la medición, no una revisión, y las dos son la misma familia: un instrumento
// que contesta con seguridad sobre lo que no sabe leer.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clasesDeLasHojas, clasesEscritas, scriptsDelDashboard, hojasDelDashboard,
  reglasQueOcultan, ocultoPorCss, nodo } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * LAS 29 CLASES QUE HOY SE PINTAN DESNUDAS. Es un TRINQUETE, no un permiso: lo que hace este
 * fichero es impedir que aparezca la 30.ª, no bendecir las 29.
 *
 * ⚠️ ARREGLAR UNA NO PONE ESTO EN ROJO, y es deliberado: la sesión 2 está escribiendo AHORA el
 * CSS del parte y la 4 sus rótulos. Un guard que se pusiera rojo cuando alguien ARREGLA algo
 * castigaría justo la conducta que persigue. Cuando una clase gana su regla, su línea sobra y el
 * test de abajo la nombra para que se borre — en verde.
 *
 * 🔴 LO QUE SÍ ES ROJO: una clase huérfana que NO esté en esta lista. Ahí no hay ambigüedad —
 * alguien ha pintado algo que no se ve, y es exactamente lo que le pasó al parte.
 */
const CONOCIDAS = Object.freeze([
  // parteDetailView.js — LA PANTALLA DEL FUNDADOR. 4 de 4 desnudas: la sesión 2 la está vistiendo.
  ['parte-anadir', 'parteDetailView.js'],
  ['parte-bloque', 'parteDetailView.js'],
  ['parte-quitar-linea', 'parteDetailView.js'],
  ['parte-tipo', 'parteDetailView.js'],
  // Los otros dos ficheros al 100 %.
  ['gs-item', 'globalSearch.js'],
  ['tut-acc', 'tutorial.js'],
  ['tut-acc-body', 'tutorial.js'],
  // El resto, por fichero.
  ['ai-linea-supuesta', 'aiQuoteAssistant.js'],
  ['clausula-fila', 'settingsView.js'],
  ['csv-campo', 'csvImport.js'],
  ['detail-cobro-fecha', 'invoiceDetailView.js'],
  ['detail-cobro-importe', 'invoiceDetailView.js'],
  ['export-ds', 'exportView.js'],
  ['job-actions', 'jobsView.js'],
  ['jobdet-alb-actions', 'jobDetailView.js'],
  ['jobdet-alb-fotos', 'jobDetailView.js'],
  ['jobdet-alb-link', 'jobDetailView.js'],
  ['jobdet-inv-actions', 'jobDetailView.js'],
  ['muted', 'estadoFirma.js'],
  ['plan-btn', 'plansView.js'],
  ['qq-concept', 'homeView.js'],
  ['qq-price', 'homeView.js'],
  ['qq-product-dropdown', 'homeView.js'],
  ['qq-remove-line', 'homeView.js'],
  ['qq-tier-includes', 'homeView.js'],
  ['qq-tier-price', 'homeView.js'],
  ['skeleton-row', 'api.js'],
  ['voice-mic-label', 'voiceInput.js'],
  ['week-summary-item', 'homeView.js'],
]);
const PERDONADAS = new Set(CONOCIDAS.map(([c]) => c));

/** El barrido: toda clase escrita por un script del índice que no tenga regla en las hojas. */
function barrer() {
  const definidas = clasesDeLasHojas(RAIZ);
  const huerfanas = new Map();
  let ficheros = 0; let atributos = 0; let ilegibles = 0; let limpios = 0;
  for (const rel of scriptsDelDashboard(RAIZ)) {
    const ruta = path.join(RAIZ, 'public/dashboard', rel);
    if (!fs.existsSync(ruta)) continue;
    ficheros++;
    const nombre = path.basename(ruta);
    const r = clasesEscritas(fs.readFileSync(ruta, 'utf8'), nombre);
    atributos += r.atributos; ilegibles += r.ilegibles;
    const h = [...r.clases].filter((c) => !definidas.has(c));
    if (!h.length) limpios++;
    for (const c of h) {
      if (!huerfanas.has(c)) huerfanas.set(c, []);
      huerfanas.get(c).push(nombre);
    }
  }
  return { definidas, huerfanas, ficheros, atributos, ilegibles, limpios };
}

// ═══ 🔴 EL SUELO — un cero aquí es ceguera, no limpieza ═══════════════════════════════════

test('SCRUM-666b · 🔴 SUELO: el barrido VE los scripts, sus `class=` y las hojas', () => {
  const b = barrer();

  assert.ok(b.ficheros >= 50,
    `🔴 el barrido sólo ha leído ${b.ficheros} script(s) del índice. Con esa población, «ninguna `
    + 'clase huérfana» no significa que no las haya: significa que no ha mirado.');

  assert.ok(b.atributos >= 300,
    `🔴 sólo ha leído ${b.atributos} atributo(s) \`class=\`. El panel tiene cientos: si de pronto `
    + 'son decenas, el extractor ha dejado de entender el marcado y su cero es mudo.');

  assert.equal(b.ilegibles, 0,
    `🔴 ${b.ilegibles} atributo(s) \`class=\` sin comilla de cierre localizable. Cada uno es una `
    + 'porción del panel que este guard NO está mirando, y callarlo sería el verde falso de siempre.');

  assert.ok(b.definidas.size >= 100,
    `🔴 sólo ${b.definidas.size} clase(s) definidas en las hojas. Si las hojas no se leen bien, `
    + 'TODAS las clases parecen huérfanas y el guard se vuelve ruido.');

  // Y el suelo de `clasesDeLasHojas`, probado de verdad: una hoja que no define nada LANZA.
  assert.throws(() => clasesDeLasHojas(RAIZ, [path.join(RAIZ, 'public/tokens.css')]),
    /SUELO/, '🔴 leer sólo `tokens.css` da un puñado de clases y tiene que LANZAR, no devolver un cero');
});

// ═══ 🔴 EL ROJO QUE IMPORTA, Y QUE CAE CON EL MECANISMO VIEJO ═════════════════════════════

test('SCRUM-666b · 🔴 EL ROJO: una clase que no existe en la hoja se DETECTA', () => {
  const definidas = clasesDeLasHojas(RAIZ);
  // Un fuente sintético con el mismo defecto que tenía el parte: marcado con clases inventadas.
  const fuente = 'export function renderX(c){ c.innerHTML = `<div class="pantalla-desnuda-666">'
    + '<span class="tampoco-existe-666">hola</span></div>`; }';
  const r = clasesEscritas(fuente, 'vistaFalsa.js');
  const huerfanas = [...r.clases].filter((c) => !definidas.has(c)).sort();

  assert.deepEqual(huerfanas, ['pantalla-desnuda-666', 'tampoco-existe-666'],
    '🔴 el barrido NO ve una vista pintada con clases que no existen. Eso es literalmente lo que '
    + 'le pasó a la pantalla del parte, y es lo único que este fichero tiene que saber hacer.');
});

test('SCRUM-666b · 🔴 CAE CON EL MECANISMO VIEJO: `ocultoPorCss` da ese caso por bueno', () => {
  // Éste es el control que justifica el ticket entero. El mecanismo que ya había —el de
  // SCRUM-666, que SÍ lee las hojas— contesta «se ve» sobre una clase que no existe.
  const reglas = reglasQueOcultan(RAIZ);
  const n = nodo('div');
  n.className = 'pantalla-desnuda-666';
  const v = ocultoPorCss(n, reglas);

  assert.equal(v.oculto, false,
    '📌 si esto deja de ser `false`, el mecanismo viejo ha cambiado y este control hay que releerlo');
  assert.equal(v.ciego.length, 0,
    '📌 tampoco se declara ciego: contesta con seguridad, y ésa es la trampa');

  // 🔴 Y AQUÍ ESTÁ LA DIFERENCIA, EN UNA LÍNEA: mismo nodo, misma hoja, dos respuestas.
  const definidas = clasesDeLasHojas(RAIZ);
  assert.equal(definidas.has('pantalla-desnuda-666'), false,
    '🔴 el barrido nuevo SÍ sabe que esa clase no está definida. `ocultoPorCss` decía «se ve» '
    + 'porque le estaban preguntando «¿la esconde una regla?», que no es «¿tiene alguna?».');
});

// ═══ 🔴 EL TRINQUETE ══════════════════════════════════════════════════════════════════════

test('SCRUM-666b · 🔴 ninguna clase desnuda NUEVA', () => {
  const b = barrer();
  const nuevas = [...b.huerfanas]
    .filter(([c]) => !PERDONADAS.has(c))
    .map(([c, fs2]) => `.${c} (en ${fs2.join(', ')})`)
    .sort();

  assert.deepEqual(nuevas, [],
    `🔴 ${nuevas.length} clase(s) se pintan y NO tienen ni una regla en las hojas del índice:\n`
    + `    ${nuevas.join('\n    ')}\n`
    + '  Se ven desnudas en el navegador. Es el defecto de `#parte-detail`.\n'
    + '  O se les escribe su regla en `public/dashboard/css/styles.css`, o —si de verdad sólo son\n'
    + '  ganchos de JavaScript sin estilo— se declaran en `CONOCIDAS`, arriba, con su motivo.');
});

// ═══ ✅ CONTROL POSITIVO — lo que hoy se ve bien sigue en verde ═══════════════════════════

test('SCRUM-666b · ✅ CONTROL POSITIVO: la mayoría de los scripts están limpios, y se cuentan', () => {
  const b = barrer();
  const conHuerfanas = new Set();
  for (const [, fs2] of b.huerfanas) for (const f of fs2) conHuerfanas.add(f);

  // 🔴 SI ESTO FUERA «casi todos sucios», el guard no estaría midiendo estilo: estaría midiendo
  // que no sabe leer las hojas. Que 15 de 77 tengan huérfanas y 62 no es lo que hace creíble el
  // hallazgo del parte — no es que todo esté mal, es que ESA pantalla lo está.
  assert.ok(b.limpios >= 50,
    `🔴 sólo ${b.limpios} de ${b.ficheros} scripts sin ninguna clase huérfana. Si casi todos `
    + 'salen sucios, lo roto es el lector de hojas, no el panel.');
  assert.ok(conHuerfanas.size <= 20,
    `🔴 ${conHuerfanas.size} ficheros con clases huérfanas: demasiados para ser un hallazgo`);
});

// ═══ ✅ CONTROL NEGATIVO — no se enrojece lo que mide otra cosa ═══════════════════════════

test('SCRUM-666b · ✅ CONTROL NEGATIVO: lo definido dentro de `@media` NO cuenta como huérfano', () => {
  // Las tres que la PRIMERA versión de este barrido marcó por error, por no entrar en la media
  // query. Van nombradas una a una: es el rojo que ya se pagó, y no se vuelve a pagar en silencio.
  const definidas = clasesDeLasHojas(RAIZ);
  for (const c of ['col-hide-mobile', 'table--cards-mobile', 'table--stack-mobile', 'quote-line__qty']) {
    assert.ok(definidas.has(c),
      `🔴 \`.${c}\` está definida DENTRO de un \`@media\` y el lector no la ve. Un lector que no `
      + 'entra en la media query no encuentra menos: encuentra las de otro sitio, y manda a '
      + 'alguien a escribir una regla que ya existe.');
  }
});

test('SCRUM-666b · ✅ CONTROL NEGATIVO: un comentario que CITA una clase no la define ni la pinta', () => {
  // Los dos sentidos de la autorreferencia, que en este fichero se cruzan:
  //  · en la HOJA: `styles.css:1276` explica en un comentario una regla `.quote-lines-table` que
  //    ya no existe. Contarla daría por vestida una clase desnuda.
  //  · en el FUENTE: `quotesView.js:786` cita `class="quote-lines-table"` para contar que se
  //    retiró. Contarla inventaría una huérfana que nadie pinta.
  // Las dos se resuelven quitando comentarios ANTES de mirar — en el CSS a mano, en el JS con
  // `soloCodigo` (SCRUM-693/694), que es lo que exige el trinquete.
  const definidas = clasesDeLasHojas(RAIZ);
  assert.equal(definidas.has('quote-lines-table'), false,
    '🔴 se está contando como definida una clase que sólo aparece en un COMENTARIO de la hoja');

  const r = clasesEscritas('// antes ponía <div class="clase-de-comentario-666">\nconst a = 1;', 'x.js');
  assert.equal(r.clases.has('clase-de-comentario-666'), false,
    '🔴 se está contando como pintada una clase que sólo vive en un comentario. Documentar por qué '
    + 'se retiró algo no puede contar como escribirlo (SCRUM-693).');

  // Y el otro sentido del mismo filtro: el cuerpo de una regla tampoco define.
  const soloCuerpo = clasesDeLasHojas(RAIZ, [path.join(RAIZ, 'public/dashboard/css/styles.css')]);
  assert.ok(soloCuerpo.size >= 100, '🔴 SUELO del control: la hoja grande tiene que dar cientos de clases');
});

test('SCRUM-666b · ✅ CONTROL NEGATIVO: la interpolación no inventa medio nombre', () => {
  // `class="status-pill status-pill-${v}"` daba el token `status-pill-` cuando la interpolación
  // se sustituía por un espacio. No es una clase: es media. Lo cazó la medición.
  const r = clasesEscritas('const h = `<span class="status-pill status-pill-${v}">x</span>`;', 'x.js');
  assert.equal(r.clases.has('status-pill'), true, '🔴 se ha perdido la clase entera que SÍ está escrita');
  assert.equal(r.clases.has('status-pill-'), false,
    '🔴 `status-pill-` no es una clase, es la mitad de un nombre. Darla por huérfana manda a '
    + 'escribir una regla inventada.');

  // Lo que va suelto entre espacios sí se lee entero, por los dos lados.
  const s = clasesEscritas('const h = `<div class="antes ${x} despues">`;', 'x.js');
  assert.equal(s.clases.has('antes') && s.clases.has('despues'), true,
    '🔴 la interpolación se está comiendo las clases que la rodean');
});

// ═══ 📌 INFORMATIVO — la lista no se pudre, pero arreglar nunca pone en rojo ══════════════

test('SCRUM-666b · 📌 las entradas de `CONOCIDAS` que ya estén arregladas se nombran (en verde)', () => {
  const b = barrer();
  const sobran = CONOCIDAS.filter(([c]) => !b.huerfanas.has(c)).map(([c, f]) => `.${c} (${f})`);
  if (sobran.length) {
    console.log(`\n  ✅ ${sobran.length} clase(s) de \`CONOCIDAS\` ya tienen su regla. Sus líneas `
      + `sobran:\n    ${sobran.join('\n    ')}\n`);
  }
  // A propósito NO se falla: la sesión 2 está vistiendo el parte mientras esto corre, y un guard
  // que se pusiera rojo al arreglar algo castigaría la conducta que persigue.
  assert.ok(sobran.length <= CONOCIDAS.length, '📌 imposible por construcción; el valor está en el listado');
});
