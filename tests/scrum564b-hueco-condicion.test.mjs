// tests/scrum564b-hueco-condicion.test.mjs — SCRUM-564 (documentar la condición)
//
// Sin gate: lee ficheros. Ni BD, ni red, ni servidor. La medición en navegador vive aparte
// (`scripts/medir-hueco-condicion.mjs`) y sus números están congelados en `_hueco-condicion.mjs`:
// aquí se vigila que no se muevan en silencio y que sigan hablando de los textos de hoy.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 UNA MEDIDA CONGELADA QUE NADIE VIGILA ES UNA MEDIDA CADUCADA
//
// Si alguien reescribe uno de los diez textos, los caracteres que caben dejan de ser los
// medidos — y el fundador estaría eligiendo la frase con el hueco de ayer.
// ─────────────────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as censoF from '../scripts/censo-anclas-bloque-f.mjs';
import { veredictos, censar, leerLanding, FALSA } from '../scripts/_afirmaciones-publicadas.mjs';
import {
  HUECOS, CONDICIONES, clasificar, palabraMasLarga, veredictoDeSitio,
  JUNTO, LEJOS, NINGUNO, CABE, NO_CABE,
} from '../scripts/_hueco-condicion.mjs';
import { generar, DESTINO, diez } from '../scripts/citar-hueco-condicion.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = leerLanding(RAIZ);

/** Lo medido el 21-ago-2026. */
const CUANTAS = 10;
const GRUPOS_HOY = { [JUNTO]: 7, [LEJOS]: 3, [NINGUNO]: 0 };
const SITIOS = ['junto al texto', 'pie del bloque', 'pie de la seccion'];

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · menos de diez es mirar a medias; más, un hallazgo
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SUELO · siguen siendo diez, y si no, se nombra la diferencia', () => {
  const lista = diez(html, RAIZ);
  assert.ok(lista.length > 0,
    '🔴 CIEGO: cero afirmaciones falsas. Están medidas: son diez. Un cero se leería como «no hay '
    + 'nada que documentar», que es la conclusión más cara que puede dar este fichero.');
  assert.equal(lista.length, CUANTAS,
    `🔴 el censo devuelve ${lista.length} y se midieron ${CUANTAS} · diferencia ${lista.length - CUANTAS}.\n`
    + '      → si son MENOS, alguien arregló o reescribió una: di cuál y actualiza la medida.\n'
    + '      → si son MÁS, hay copy publicado nuevo que promete un medio que no existe. TAMBIÉN '
    + 'es hallazgo, y hay que medirle el hueco antes de que el fundador elija la frase.');
});

test('SUELO · la medida congelada cubre los diez, en los dos anchos y en los tres sitios', () => {
  const ids = diez(html, RAIZ).map((v) => v.id);
  for (const ancho of CONDICIONES.anchos) {
    assert.ok(HUECOS[ancho], `🔴 CIEGO: no hay medida a ${ancho} px`);
    for (const id of ids) {
      assert.ok(HUECOS[ancho][id], `🔴 ${id} no tiene medida a ${ancho} px: su hueco es desconocido, no cero`);
      for (const s of SITIOS) {
        assert.ok(HUECOS[ancho][id][s], `🔴 ${id} sin medida del sitio «${s}» a ${ancho} px`);
      }
    }
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LOS TEXTOS · si cambian, el hueco medido ya no es el suyo
// ═════════════════════════════════════════════════════════════════════════════════════════
test('los diez textos son los del marcado, byte a byte', () => {
  const porId = new Map(censar(html).todas.map((u) => [u.id, u.texto]));
  const bruto = fs.readFileSync(path.join(RAIZ, 'public/index.html'));
  for (const v of diez(html, RAIZ)) {
    const delCenso = porId.get(v.id);
    assert.equal(delCenso, v.texto, `🔴 ${v.id}: el texto del veredicto no es el del censo`);
    assert.equal(Buffer.compare(Buffer.from(delCenso, 'utf8'), Buffer.from(v.texto, 'utf8')), 0,
      `🔴 ${v.id}: coincide como cadena y no byte a byte`);
    const b = Buffer.from(v.texto, 'utf8');
    const i = bruto.indexOf(b);
    assert.notEqual(i, -1, `🔴 ${v.id}: «${v.texto}» no está así en el fichero`);
    assert.equal(Buffer.compare(bruto.subarray(i, i + b.length), b), 0,
      `🔴 ${v.id}: aparece pero no byte a byte`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONTROL POSITIVO · si el criterio no distingue nada, la lista es ruido
// ═════════════════════════════════════════════════════════════════════════════════════════
test('CONTROL POSITIVO · el copy publicado que no promete medios NO está en la lista', () => {
  const ids = new Set(diez(html, RAIZ).map((v) => v.id));
  const control = ['todo/h2#1', 'como/h3#2', 'precios/p#1', 'faq/div#4'];
  for (const id of control) {
    assert.equal(ids.has(id), false,
      `🔴 «${id}» está en la lista de los diez y no promete ningún medio de pago: el criterio no `
      + 'distingue nada y la lista es ruido.');
  }
  // y el contraste: los que sí prometen, están
  for (const id of ['como/p#4', 'precios/li#3', 'probar/span#42']) {
    assert.ok(ids.has(id), `🔴 «${id}» promete un medio que hoy no existe y NO está en la lista`);
  }
});

test('EL LÉXICO ES SUELO · ocho de los diez nombran un medio concreto, y los dos que no están dichos', () => {
  const MEDIOS = /tarjeta|bizum|transferencia/i;
  const lista = diez(html, RAIZ);
  const conMedio = lista.filter((v) => MEDIOS.test(v.texto));
  const sinMedio = lista.filter((v) => !MEDIOS.test(v.texto));
  assert.equal(conMedio.length, 8, '🔴 ha cambiado cuántos nombran un medio concreto');
  assert.deepEqual(sinMedio.map((v) => v.id).sort(), ['faq/div#3', 'probar/span#15'],
    '🔴 han cambiado los dos que NO nombran medio. Ésos son los que hay que releer con el texto '
    + 'delante antes de darlos por falsos: ' + JSON.stringify(sinMedio.map((v) => v.id)));
  // y que el documento los explique uno por uno, en vez de esconderlos en el recuento
  const doc = fs.readFileSync(path.join(RAIZ, DESTINO), 'utf8');
  for (const v of sinMedio) {
    assert.ok(doc.includes('`' + v.id + '`'), `🔴 el documento no menciona ${v.id}`);
  }
  assert.match(doc, /demasiado estricto/,
    '🔴 el documento ya no dice que uno de los diez es un veredicto mío corregido');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA CLASIFICACIÓN · derivada de la medida, no escrita a mano
// ═════════════════════════════════════════════════════════════════════════════════════════
test('el reparto en grupos es el medido', () => {
  const cuenta = { [JUNTO]: 0, [LEJOS]: 0, [NINGUNO]: 0 };
  for (const v of diez(html, RAIZ)) cuenta[clasificar(v.id, v.texto).grupo]++;
  assert.deepEqual(cuenta, GRUPOS_HOY,
    '🔴 el reparto cambió. Si un texto ha dejado de admitir nota junto a la afirmación, VUELVE AL '
    + 'FUNDADOR: la única salida que le queda es cambiar el texto.\n      hoy: ' + JSON.stringify(cuenta));
});

test('un sitio donde la sonda no se ve NO cuenta como que cabe', () => {
  // El defecto que se comió dos intentos: sin exigir que la sonda se vea, el binario concluía
  // «caben 400 caracteres» dentro de un `<details>` cerrado. Aquí se fija que `visible:false`
  // manda sobre cualquier número.
  const v = veredictoDeSitio('probar/span#42', 'Tarjeta', 'junto al texto');
  assert.equal(v.veredicto, NO_CABE, '🔴 un hueco donde no se ve nada sale como que cabe');
  assert.match(v.motivo, /no llega a verse/);
  assert.equal(HUECOS[1280]['probar/span#42']['junto al texto'].visible, false,
    '🔴 la medida congelada dice ahora que sí se ve: vuelve a medir antes de fiarte del grupo');
});

test('el umbral se deriva del propio texto, no es un número a ojo', () => {
  assert.equal(palabraMasLarga('Cobro con tarjeta, Bizum y transferencia'), 13,
    '🔴 la palabra más larga ya no se calcula igual; el umbral de todos los textos se mueve con ella');
  const c = clasificar('precios/li#3', 'Cobro con tarjeta, Bizum y transferencia');
  const junto = c.sitios.find((s) => s.sitio === 'junto al texto');
  assert.equal(junto.minimo, 26, '🔴 el umbral de precios/li#3 ya no es el doble de su palabra más larga');
  assert.ok(junto.peor < junto.minimo,
    '🔴 junto al texto de la fila de precios ahora cabría una frase: vuelve a medirlo, porque era '
    + 'el caso difícil (6 caracteres a 1280)');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// NI UNA PALABRA DE LA CONDICIÓN
// ═════════════════════════════════════════════════════════════════════════════════════════
test('🔴 no se ha escrito ninguna redacción de la condición (regla 30)', () => {
  // El riesgo real de este ticket es colar una frase «de ejemplo» que acabe publicada. Se
  // comprueba que ni el módulo ni el documento traen una nota redactada para pegar.
  const doc = fs.readFileSync(path.join(RAIZ, DESTINO), 'utf8');
  const modulo = fs.readFileSync(path.join(RAIZ, 'scripts/_hueco-condicion.mjs'), 'utf8');
  const SOSPECHOSAS = [
    /solo (?:por )?transferencia (?:de|por) momento/i,
    /pr[oó]ximamente (?:con )?tarjeta/i,
    /disponible (?:muy )?pronto/i,
    /\*\s*tarjeta y bizum/i,
  ];
  for (const re of SOSPECHOSAS) {
    assert.equal(re.test(doc), false, `🔴 el documento trae una redacción de la condición: ${re}`);
    assert.equal(re.test(modulo), false, `🔴 el módulo trae una redacción de la condición: ${re}`);
  }
  assert.match(doc, /no hay ni una palabra de la condición/i,
    '🔴 el documento ya no declara que la frase es del fundador');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL DOCUMENTO NO SE QUEDA VIEJO
// ═════════════════════════════════════════════════════════════════════════════════════════
test('el documento en disco es el que sale de la medida de hoy', () => {
  const enDisco = fs.readFileSync(path.join(RAIZ, DESTINO), 'utf8');
  const norm = (s) => s.replace(/\r\n/g, '\n');
  assert.equal(norm(enDisco), norm(generar(html, RAIZ)),
    '🔴 el documento está desfasado. Regenéralo:\n      node scripts/citar-hueco-condicion.mjs');
});

test('el generador se declara ciego en vez de escribir un documento vacío', () => {
  assert.throws(() => generar('<html><body></body></html>', RAIZ), /CIEGO/,
    '🔴 produce documento aunque no haya podido mirar');
});

test('la medida dice CÓMO se tomó, o sus números no tienen unidades', () => {
  for (const k of ['fecha', 'navegador', 'anchos', 'sonda', 'relleno', 'detalles', 'arbitroDeToque']) {
    assert.ok(CONDICIONES[k], `🔴 la medida no declara «${k}»`);
  }
  assert.match(CONDICIONES.arbitroDeToque, /closest/,
    '🔴 el árbitro de toque ya no es `closest`: `elementsFromPoint().includes()` da por bueno lo que otro tapa');
  assert.deepEqual(CONDICIONES.anchos, [360, 1280]);
});

test('ninguna nota le roba área de toque a nadie — en los dos anchos', () => {
  let sitios = 0;
  for (const ancho of CONDICIONES.anchos) {
    for (const id of Object.keys(HUECOS[ancho])) {
      for (const s of SITIOS) {
        sitios++;
        assert.deepEqual(HUECOS[ancho][id][s].roba, [],
          `🔴 ${id} · ${s} a ${ancho}px: la nota le quita el toque a ` + JSON.stringify(HUECOS[ancho][id][s].roba));
      }
    }
  }
  assert.equal(sitios, 60, '🔴 CIEGO: no se han comprobado los 60 sitios (10 × 3 × 2 anchos)');
});
