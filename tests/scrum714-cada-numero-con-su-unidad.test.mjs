// tests/scrum714-cada-numero-con-su-unidad.test.mjs — SCRUM-714
//
// Sin gate: lee el árbol. Ni BD, ni red, ni navegador.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// TRES INSTRUMENTOS CUENTAN MARCADORES Y DAN CIFRAS DISTINTAS. NINGUNO ESTÁ MAL.
//
// Medido sobre el árbol del 4-sep-2026, todo a la vez: 357 ficheros leídos · 22 marcas escritas ·
// 162 usos de constante · 168 superficies pintadas · 12 ficheros del panel · 56 marcas de
// «aprobado» · 13 citas a `docs/microcopy/`. Siete números, siete poblaciones, cero errores.
//
// El defecto es que se dicen DESNUDOS. «22» y «168» uno al lado del otro parecen una
// contradicción; «22 marcas escritas» y «168 superficies pintadas» no se confunden.
//
// ⛔ Y NO SE ARMONIZAN. Cambiar lo que cuenta un instrumento para que cuadre con otro destruye la
// medición que ese instrumento daba. La respuesta a dos cifras distintas es leer sus unidades.
//
// ── LA VÍCTIMA, QUE NO ES EL PROFESIONAL ────────────────────────────────────────────────────
// `exportView.js:328` decía «Microcopy PROPUESTA, sin aprobar» encima de un texto que el fundador
// firmó el 17-ago-2026 — y CITABA OTRO texto, que no existe en el árbol. Quien lo paga es la
// siguiente sesión que lo lea y «corrija» un texto ya firmado.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { UNIDADES, frase, fraseConPregunta, numeroSinUnidad } from './_unidades-de-microcopy.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const MARCA = '[PENDIENTE';

// ═══ ① EL SUELO: ¿CUÁNTOS INSTRUMENTOS CUENTAN MICROCOPY? ════════════════════════════════

/**
 * Los instrumentos, DERIVADOS y no enumerados a mano: ficheros de `tests/` y `scripts/` que
 * nombran la marca en su CÓDIGO (no en un comentario) — que es lo que hace falta para poder
 * contarla. Una lista a mano envejece el día que nace el cuarto y nadie se entera.
 *
 * FRONTERA declarada: `tests/*.mjs` + `scripts/*.mjs`. Queda fuera el producto, que es a quien
 * se mide, no quien mide.
 */
function instrumentos() {
  const salida = [];
  for (const dir of ['tests', 'scripts']) {
    const d = path.join(RAIZ, dir);
    for (const f of fs.readdirSync(d)) {
      if (!f.endsWith('.mjs')) continue;
      const src = fs.readFileSync(path.join(d, f), 'utf8');
      // El literal escrito en código: `'[PENDIENTE'` o `"[PENDIENTE`. En un comentario no cuenta,
      // y por eso se pide la comilla pegada — es la diferencia entre usar la marca y nombrarla.
      if (/['"`]\[PENDIENTE/.test(src)) salida.push(`${dir}/${f}`);
    }
  }
  return salida.sort();
}

/**
 * 🔴 LOS QUE PUBLICAN UNA CIFRA — que NO son los mismos que los que tocan la marca.
 *
 * Esta separación se hizo A MITAD DEL TICKET y es su mejor prueba: el derivado de arriba dio
 * **53** y el encargo hablaba de **tres**. Ninguno estaba mal. Son dos poblaciones y las estaba
 * llamando igual — el defecto que vengo a cerrar, mordiéndome mientras lo cerraba.
 *
 * Ésta es una lista DECLARADA y no derivada, y se dice por qué: «publicar una cifra» no tiene
 * forma sintáctica —es un `resumen`, un objeto `CENSO`, un número en una cabecera—, así que
 * derivarla sería inventar un criterio. Lo que sí se hace es COMPROBAR cada entrada: que el
 * fichero exista y que de verdad publique un número sobre marcadores. Una lista a mano cuyos
 * miembros no se verifican es justo lo que SCRUM-311 dejó escrito que no vale.
 */
const PUBLICAN_CIFRA = [
  { rel: 'scripts/censo-marcadores.mjs', cifra: /marcasEscritas|superficiesPintadas/,
    unidad: 'MARCAS_ESCRITAS' },
  { rel: 'tests/scrum402-marcador-no-se-pinta.test.mjs', cifra: /const CENSO = /,
    unidad: 'FICHEROS_CON_MARCA' },
  { rel: 'tests/scrum667-marcador-visible.test.mjs', cifra: /\b\d+\s+marcas?\b/,
    unidad: 'MARCAS_ESCRITAS' },
  { rel: 'tests/scrum709-microcopy-por-fichero.test.mjs', cifra: /\b\d+\s+citas?\b|de las \d+ citas/,
    unidad: 'CITAS_A_APROBACION' },
];

test('SCRUM-714 · 🔴 SUELO: si el censo de instrumentos devuelve CERO, esto falla', () => {
  const lista = instrumentos();
  assert.ok(lista.length > 0,
    '🔴 CENSO VACÍO: no se ha encontrado NINGÚN instrumento que toque la marca de microcopy. '
    + 'Hay decenas, así que un cero aquí no significa «no hay»: significa que el derivador está '
    + 'roto y todo lo que este fichero afirme después sería cierto sobre la nada.');
  // 🔴 EL NÚMERO SALE CON SU UNIDAD, y no es cosmética: el encargo hablaba de TRES instrumentos y
  // este censo da decenas. Las dos cifras son ciertas y miden poblaciones distintas — «tocan la
  // marca» y «publican una cifra». Dicho desnudo, «53» habría parecido contradecir al encargo.
  assert.ok(lista.length >= 3,
    `🔴 sólo ${frase(lista.length, 'INSTRUMENTOS_QUE_TOCAN')}, y el ticket nombra tres como `
    + `mínimo:\n    ${lista.join('\n    ')}`);
});

test('SCRUM-714 · 🔴 los que PUBLICAN una cifra son OTRA población, y cada entrada se comprueba', () => {
  // Una lista a mano cuyos miembros no se verifican es lo que SCRUM-311 dejó escrito que no vale:
  // el número «4 instrumentos» sería cierto y engañaría si uno de los cuatro ya no publicara nada.
  const rotos = [];
  for (const { rel, cifra } of PUBLICAN_CIFRA) {
    const ruta = path.join(RAIZ, rel);
    if (!fs.existsSync(ruta)) { rotos.push(`${rel} — no existe`); continue; }
    if (!cifra.test(fs.readFileSync(ruta, 'utf8'))) rotos.push(`${rel} — ya no publica su cifra`);
  }
  assert.deepEqual(rotos, [],
    '🔴 entradas de la lista que no se sostienen:\n    ' + rotos.join('\n    ')
    + '\n\n  Si un instrumento dejó de publicar su número, sale de la lista con su motivo; si se\n'
    + '  renombró, la lista viene con él. Lo que no vale es que el recuento siga diciendo cuatro.');

  // 🔴 LAS DOS CIFRAS, JUNTAS Y CADA UNA CON SU UNIDAD. Ésta es la frase que el ticket pide: dicha
  // así, nadie las lee como una contradicción.
  const tocan = instrumentos().length;
  assert.ok(tocan > PUBLICAN_CIFRA.length,
    `🔴 ${frase(tocan, 'INSTRUMENTOS_QUE_TOCAN')} y `
    + `${frase(PUBLICAN_CIFRA.length, 'INSTRUMENTOS_QUE_CUENTAN')}: se esperaba que los primeros `
    + 'fueran MÁS. Si se han igualado, o el derivador se ha estrechado o la lista ha crecido sin '
    + 'medir, y en los dos casos una de las dos poblaciones ha dejado de ser la que dice ser.');

  // Y cada uno declara EN QUÉ unidad cuenta: sin eso, volver a compararlos sería adivinar.
  for (const { rel, unidad } of PUBLICAN_CIFRA) {
    assert.ok(UNIDADES[unidad], `🔴 «${rel}» dice contar en «${unidad}», que no es una unidad declarada.`);
  }
});

// ═══ ② EL VOCABULARIO: UN NÚMERO NUNCA SALE DESNUDO ══════════════════════════════════════

test('SCRUM-714 · 🔴 `frase` pega la unidad al número, y acierta el SINGULAR', () => {
  assert.equal(frase(22, 'MARCAS_ESCRITAS'), '22 marcas escritas');
  assert.equal(frase(168, 'SUPERFICIES_PINTADAS'), '168 superficies pintadas');
  // 🔴 EL UNO ES EL CASO QUE IMPORTA: «1 marcas escritas» se lee como una errata y quien lo lee
  // deja de fiarse del resto del mensaje. Y es justo la cifra donde dos unidades se parecen más.
  assert.equal(frase(1, 'MARCAS_ESCRITAS'), '1 marca escrita');
  assert.equal(frase(1, 'CITAS_A_APROBACION'), '1 cita a una aprobación');
  assert.equal(frase(0, 'FICHEROS_CON_MARCA'), '0 ficheros con marca');
});

test('SCRUM-714 · 🔴 una unidad inventada NO pasa en silencio', () => {
  // Si `frase(n, 'LO_QUE_SEA')` devolviera algo, el vocabulario dejaría de ser cerrado y cada
  // instrumento se inventaría el suyo — que es el punto de partida, con más pasos.
  assert.throws(() => frase(3, 'MARCADORES'), /UNIDAD DESCONOCIDA/,
    '🔴 una unidad que no está declarada devuelve texto en vez de fallar.');
  assert.throws(() => frase('muchos', 'MARCAS_ESCRITAS'), /no es un número/);
});

test('SCRUM-714 · 🔴 cada unidad dice QUÉ PREGUNTA contesta, que es lo que la distingue', () => {
  // Dos unidades con el mismo nombre y distinta pregunta serían el defecto otra vez, un nivel más
  // arriba. Se exige que las preguntas sean todas DISTINTAS.
  const preguntas = Object.values(UNIDADES).map((u) => u.pregunta);
  assert.equal(new Set(preguntas).size, preguntas.length,
    '🔴 dos unidades contestan la MISMA pregunta: entonces no son dos unidades, es una con dos '
    + 'nombres, y volvemos a tener dos números para lo mismo.');
  assert.equal(new Set(Object.values(UNIDADES).map((u) => u.plural)).size, preguntas.length,
    '🔴 dos unidades comparten nombre en plural: en un mensaje serían indistinguibles.');
  assert.match(fraseConPregunta(22, 'MARCAS_ESCRITAS'), /22 marcas escritas — ¿cuántos/);
});

test('SCRUM-714 · 🔴 el detector VE un número desnudo, y NO grita por uno que ya lleva unidad', () => {
  // El control positivo y el negativo juntos: sin el segundo, el detector podría estar marcando
  // todo y parecería que funciona.
  assert.deepEqual(numeroSinUnidad('hoy hay 14 marcadores'), ['hoy hay 14 marcadores'],
    '🔴 un número de marcadores SIN unidad no se detecta: es el defecto entero.');
  assert.deepEqual(numeroSinUnidad('hoy hay 14 marcas escritas'), [],
    '🔴 FALSO POSITIVO: una cifra que YA lleva su unidad se está señalando. Un guard que grita '
    + 'por lo correcto se apaga en una semana, y entonces deja de ver lo incorrecto.');
  // Y no se mete donde no le llaman: una cifra que no habla de microcopy no es asunto suyo.
  assert.deepEqual(numeroSinUnidad('el PDF tiene 14 páginas'), []);
});

// ═══ ③ LA VÍCTIMA ════════════════════════════════════════════════════════════════════════

test('SCRUM-714 · 🔴 `exportView.js` NO dice «sin aprobar» de un texto que el fundador FIRMÓ', () => {
  const vista = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/exportView.js'), 'utf8');
  const TEXTO = 'No hay facturas en este periodo.';
  assert.ok(vista.includes(TEXTO),
    `🔴 GUARD CIEGO: ya no se pinta «${TEXTO}» en \`exportView.js\`, así que este control no está `
    + 'mirando el sitio que cree. Si el texto se movió, hay que traer este guard con él.');

  // El estado vacío del libro está APROBADO y APLICADO desde el 17-ago-2026.
  const registro = fs.readFileSync(path.join(RAIZ, 'docs/MICROCOPY_APROBADA_SIN_APLICAR.md'), 'utf8');
  assert.ok(registro.includes(TEXTO),
    '🔴 el texto ha desaparecido del registro de aprobaciones: sin él, «está aprobado» sería una '
    + 'afirmación sin respaldo.');

  // 🔴 Y AQUÍ ESTABA LA VÍCTIMA: el comentario decía lo contrario de lo que dice el registro.
  const i = vista.indexOf(TEXTO);
  const antes = vista.slice(Math.max(0, i - 1400), i);
  assert.equal(/Microcopy PROPUESTA, sin aprobar/.test(antes), false,
    '🔴 el comentario que precede al estado vacío del libro vuelve a decir «Microcopy PROPUESTA, '
    + 'sin aprobar». Ese texto lo firmó el FUNDADOR el 17-ago-2026 y consta como APLICADO. La '
    + 'víctima no es el profesional: es la siguiente sesión que lo lea y lo «corrija».');

  // Y el otro medio defecto: citaba un texto que no existe en el árbol.
  assert.equal(vista.includes('No hay facturas emitidas en ese periodo'), false,
    '🔴 ha vuelto la cita a «No hay facturas emitidas en ese periodo.», que NO EXISTE en ningún '
    + 'sitio del árbol. Un comentario que cita un texto inventado es peor que uno que no cita '
    + 'nada: parece una fuente.');
});

// ═══ ④ EL TRINQUETE: LOS INSTRUMENTOS NO VUELVEN AL NÚMERO DESNUDO ═══════════════════════

test('SCRUM-714 · 🔴 los instrumentos que ya dicen su unidad no vuelven a quitarla', () => {
  // No se exige a todos de golpe —eso sería un rojo de nacimiento que alguien apagaría—: se fija
  // lo que YA está bien para que no retroceda, y se declara lo que falta.
  const CON_UNIDAD = [
    ['scripts/censo-marcadores.mjs', /marcasEscritas|superficiesPintadas/],
    ['tests/_unidades-de-microcopy.mjs', /MARCAS_ESCRITAS/],
  ];
  const sinDecirlo = [];
  for (const [rel, re] of CON_UNIDAD) {
    const src = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
    if (!re.test(src)) sinDecirlo.push(rel);
  }
  assert.deepEqual(sinDecirlo, [],
    '🔴 estos instrumentos han dejado de nombrar su unidad:\n    ' + sinDecirlo.join('\n    ')
    + '\n\n  Su número vuelve a ser una cifra desnuda, y la siguiente sesión que lo compare con\n'
    + '  otro instrumento leerá una contradicción donde sólo hay dos poblaciones distintas.');
});
