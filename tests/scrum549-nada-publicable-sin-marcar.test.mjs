// tests/scrum549-nada-publicable-sin-marcar.test.mjs — SCRUM-549.
//
// La pregunta que faltaba. Los guards del bloque F vigilan que **lo marcado** no se publique;
// ninguno vigilaba que **todo lo publicable** estuviera marcado. Lo que se le olvida a alguien
// marcar se publica sin que nada diga nada — le pasó al titular del bloque de contacto, y lo cazó
// un extractor por casualidad.
import test from 'node:test';
import { ejecutableDe } from './_guard-texto.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  censar, infracciones, elementosOcultos, loDesocultaUnScript,
  CensoCiego, CUARENTENA, CUARENTENA_MAX, MARCADORES,
} from '../scripts/_censo-microcopy-sin-marcar.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-549 · 🔴 SUELO: sin elementos ocultos, el censo se declara CIEGO', () => {
  const vacio = fs.mkdtempSync(path.join(RAIZ, 'tests', '.tmp-549-'));
  try {
    fs.mkdirSync(path.join(vacio, 'public'), { recursive: true });
    fs.writeFileSync(path.join(vacio, 'public', 'index.html'), '<html><body><p>nada oculto</p></body></html>');
    assert.throws(() => censar(vacio), CensoCiego,
      '🔴 el censo ha contestado sin encontrar ni un `hidden`. La landing tiene seis: un cero ' +
      'significa que el detector dejó de reconocerlos, y entonces todo pasa sin mirar.');
  } finally { fs.rmSync(vacio, { recursive: true, force: true }); }
});

test('SCRUM-549 · SUELO: sobre la landing real, el censo ve los elementos ocultos', () => {
  const c = censar(RAIZ);
  assert.ok(c.length >= 4, '🔴 solo ' + c.length + ' elementos ocultos: el detector no está mirando donde cree');
  assert.ok(c.some((e) => e.marcado), '🔴 ninguno marcado — imposible con el bloque F puesto');
  assert.ok(c.some((e) => !e.marcado), '🔴 ninguno sin marcar — imposible con la barra de anuncio puesta');
});

// ── EL DETECTOR, PROBADO EN LOS DOS SENTIDOS ─────────────────────────────────────────────────

test('SCRUM-549 · el detector acepta atributos EN CUALQUIER ORDEN (SCRUM-553)', () => {
  // Es la cuarta vez esta semana que un extractor se queda ciego por pedir el `>` pegado.
  const casos = [
    '<section id="a" hidden>',
    '<section hidden id="b">',
    '<section id="c" class="x" hidden data-microcopy="PENDIENTE_FUNDADOR">',
    '<section\n  id="d"\n  hidden\n  data-propuesta="microcopy-sin-aprobar">',
  ];
  for (const c of casos) {
    const r = elementosOcultos(c);
    assert.equal(r.length, 1, '🔴 no ha visto el `hidden` en: ' + JSON.stringify(c));
  }
  // Y NO confunde un atributo que solo CONTIENE la palabra.
  assert.equal(elementosOcultos('<section data-nota="esto no está hidden">').length, 0,
    '🔴 ha contado como oculto un elemento cuyo texto de atributo dice «hidden»');
});

test('SCRUM-549 · el detector ve quién desoculta, y no se lo inventa', () => {
  const html = '<div id="x" hidden></div><script>var e=document.getElementById(\'x\'); e.hidden=false;</script>';
  assert.equal(loDesocultaUnScript(RAIZ, html, 'x'), true, '🔴 no ha visto el desocultado por id');
  assert.equal(loDesocultaUnScript(RAIZ, '<div id="y" hidden></div>', 'y'), false,
    '🔴 dice que algo se desoculta cuando no hay ni un script que lo toque');
});

// ── LA REGLA ─────────────────────────────────────────────────────────────────────────────────

test('SCRUM-549 · 🔴 nada publicable sin marcar: cada elemento oculto tiene su explicación', () => {
  const c = censar(RAIZ);
  const malos = infracciones(c);
  assert.deepEqual(malos.map((m) => m.id + ' → ' + m.clase), [],
    '🔴 HAY ALGO PUBLICABLE SIN EXPLICACIÓN:' + String.fromCharCode(10) +
    malos.map((m) => '   · ' + (m.id || '(sin id)') + ' (línea ' + m.linea + '): ' + m.clase).join(String.fromCharCode(10)) +
    String.fromCharCode(10) + String.fromCharCode(10) +
    '  Un elemento que nace `hidden` solo puede estar en dos sitios: MARCADO como pendiente de\n' +
    '  aprobación (y entonces ningún script puede desocultarlo, porque eso sería publicar copy\n' +
    '  sin aprobar), o SIN marcar porque es copy ya aprobado que se enseña cuando hay dato.\n' +
    '  Lo que no encaja en ninguno de los dos es exactamente lo que este guard existe para ver.');
});

test('SCRUM-549 · ✅ CONTROL POSITIVO: el copy YA aprobado no dispara el guard', () => {
  // Sin esto, «vigila lo nuevo» y «se queja de todo» dan el mismo rojo.
  const c = censar(RAIZ);
  const porDato = c.filter((e) => e.clase === 'oculto-por-dato');
  assert.ok(porDato.length >= 2,
    '🔴 el guard ya no reconoce como legítimos los bloques que se ocultan por DATO (la barra de ' +
    'anuncio y el banner founding). Si los empieza a acusar, se convierte en ruido y acaba ' +
    'desactivado — que es justo lo que la ficha pedía evitar.');
  for (const e of porDato) assert.ok(!infracciones(c).includes(e), '🔴 acusa a ' + e.id + ', que es copy aprobado');
  // Y el copy publicado normal (todo lo que NO lleva `hidden`) ni siquiera entra en el censo.
  const html = fs.readFileSync(path.join(RAIZ, 'public', 'index.html'), 'utf8');
  assert.ok(html.includes('<section id="como"') || html.includes('id="como"'),
    'suelo del control positivo: la sección publicada de referencia sigue en la página');
  assert.ok(!censar(RAIZ).some((e) => e.id === 'como'),
    '🔴 el censo ha metido una sección publicada y sin `hidden`: exigiría marcar copy ya aprobado');
});

test('SCRUM-549 · AUTOPRUEBA: un bloque nuevo, oculto y sin marcar, SÍ se ve', () => {
  const dir = fs.mkdtempSync(path.join(RAIZ, 'tests', '.tmp-549b-'));
  try {
    fs.mkdirSync(path.join(dir, 'public'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'public', 'index.html'),
      '<section id="nuevo" hidden><h2>Un titular que nadie ha aprobado</h2></section>');
    const c = censar(dir);
    const malos = infracciones(c);
    assert.equal(malos.length, 1, '🔴 no ha visto el bloque nuevo sin marcar');
    assert.equal(malos[0].id, 'nuevo');
    assert.match(malos[0].clase, /SIN-MARCAR/,
      '🔴 lo ha visto pero no lo ha clasificado como lo que es');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ── LA TRAMPA QUE LA FICHA AVISÓ ─────────────────────────────────────────────────────────────

test('SCRUM-549 · 🔴 el guard NO busca la palabra «PROPUESTA» en el texto', () => {
  // F5-1 dice, dentro del copy, «PROPUESTA · La diferencia». Un guard que buscara esa cadena
  // daría rojo permanente sobre un texto legítimo — o alguien la excluiría y con ella excluiría a
  // las de verdad. Se mira la ESTRUCTURA (el atributo), no el vocabulario.
  const fuente = fs.readFileSync(path.join(RAIZ, 'scripts', '_censo-microcopy-sin-marcar.mjs'), 'utf8');
  // SUELO (SCRUM-719): el ancla son LOS MARCADORES QUE ESTE TEST YA COMPROBABA — sólo que los
  // comprobaba sobre `fuente`, el texto CRUDO, que es el paso de antes. Sobre el filtrado sí
  // responden a la pregunta que importa: ¿el texto donde busco «PROPUESTA» es el censo?
  const sinComentarios = ejecutableDe(fuente, { ancla: [...MARCADORES], donde: '_censo-microcopy-sin-marcar.mjs' });
  assert.doesNotMatch(sinComentarios, /['"`]PROPUESTA/,
    '🔴 el censo ha empezado a buscar la cadena «PROPUESTA» en el texto. El copy de F5-1 la lleva ' +
    'dentro: eso es un rojo permanente sobre un texto legítimo, y la salida fácil (excluirla) se ' +
    'lleva por delante a las de verdad.');
  // (la comprobación de los marcadores vive ahora en el ancla de arriba, sobre el texto FILTRADO)
});

// ── LA CUARENTENA, CON TOPE ──────────────────────────────────────────────────────────────────

test('SCRUM-549 · 🔴 la cuarentena tiene tope, dueño y motivo — no es una excepción muda', () => {
  const ids = Object.keys(CUARENTENA);
  assert.ok(ids.length <= CUARENTENA_MAX,
    '🔴 la cuarentena ha crecido a ' + ids.length + ' (tope ' + CUARENTENA_MAX + '). Baja, no sube: ' +
    'cada entrada es copy sin aprobar que hoy se publica.');
  for (const id of ids) {
    assert.ok(CUARENTENA[id].ticket, '🔴 ' + id + ' en cuarentena sin ticket');
    assert.ok(CUARENTENA[id].decide, '🔴 ' + id + ' sin decir QUIÉN lo decide: un pendiente sin dueño no se cierra');
    assert.ok(CUARENTENA[id].motivo && CUARENTENA[id].motivo.length > 30, '🔴 ' + id + ' sin motivo legible');
  }
  // Y lo que está en cuarentena tiene que seguir SIENDO una infracción: si se arregla de verdad,
  // la entrada sobra y este test lo dice en vez de dejarla ahí para siempre.
  const c = censar(RAIZ);
  for (const id of ids) {
    const e = c.find((x) => x.id === id);
    assert.ok(e, '🔴 la cuarentena nombra `' + id + '`, que ya no existe en la landing: bórrala');
    assert.ok(e.clase !== 'marcado-y-oculto' && e.clase !== 'oculto-por-dato',
      '🔴 `' + id + '` ya cumple la regla (' + e.clase + '): retírala de la cuarentena, que su sitio ' +
      'es estar vacía.');
  }
});
