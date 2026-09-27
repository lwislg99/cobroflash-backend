// SCRUM-1175 (916a, PR-A) · Horas y desplazamiento del parte de trabajo, con selector de hora.
//
// 🔴 LO QUE NO SE PUEDE ROMPER: `entrada` y `salida` son `String?` de TEXTO LIBRE. Un
// `<input type="time">` con `value="8h"` sale VACÍO, y el siguiente `change` guardaría el vacío
// encima del dato del profesional: pérdida silenciosa. Si el valor guardado no es HH:MM, el campo
// se queda de TEXTO con su valor. Es aceptación del ticket (SCRUM-916, comentario 17251).
//
// Y la guía «La hora se elige, no se escribe.» está firmada CON CONDICIÓN: sólo cuando los dos
// campos son un selector de verdad. Con un campo de texto, la frase es falsa en esa pantalla.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const RAIZ = path.resolve(import.meta.dirname, '..');
const JS = path.join(RAIZ, 'public', 'dashboard', 'js', 'parteDetailView.js');
const CSS = path.join(RAIZ, 'public', 'dashboard', 'css', 'styles.css');
const GUIA = 'La hora se elige, no se escribe.';

function pintar(parte) {
  const contenedor = { innerHTML: '' };
  const ctx = {
    console, window: null,
    document: { createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, innerHTML: '' }) },
    Date, Array, Object, String, Number, JSON, Math,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(JS, 'utf8'), ctx, { filename: 'parteDetailView.js' });
  assert.equal(ctx.renderParte(contenedor, parte), true, '🔴 la vista se negó a pintar');
  // SUELO: una pantalla que pinta poco hace verdes todos los «no contiene».
  assert.ok(contenedor.innerHTML.length > 1500, `🔴 CIEGO: pintó ${contenedor.innerHTML.length} caracteres`);
  return contenedor.innerHTML;
}

const BASE = Object.freeze({
  id: 7, numero: 'PT-2026-001', clienteNombre: 'Comunidad Los Olivos',
  fecha: '2026-09-02T08:00:00.000Z', obra: 'C/ Mayor 3', referencia: 'REF-778',
  entrada: '09:15', salida: '12:45', desplazamientos: 1, kilometros: 12.5,
  tecnicos: ['Israel'], tipo: 'mantenimiento',
  lineas: [{ bloque: 'mano_obra', unds: 2, descripcion: 'Revisión' }],
  notas: '', estado: 'borrador',
  puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
});
const FIRMADO = { ...BASE, estado: 'firmado', puedeEditarContenido: { ok: false, motivo: 'firmado' } };

/** La etiqueta `<input …>` que escribe esa columna, o null. */
function casilla(html, nombre) {
  const m = html.match(new RegExp(`<input[^>]*data-parte-campo="${nombre}"[^>]*>`));
  return m ? m[0] : null;
}

test('SCRUM-1175 · HH:MM guardado → selector de hora con su valor, «Ahora» y la guía', () => {
  const html = pintar(BASE);
  for (const [nombre, valor] of [['entrada', '09:15'], ['salida', '12:45']]) {
    const c = casilla(html, nombre);
    assert.ok(c, `🔴 no hay casilla de ${nombre}`);
    assert.match(c, /type="time"/, `🔴 ${nombre} con HH:MM sigue siendo texto`);
    assert.ok(c.includes(`value="${valor}"`), `🔴 ${nombre} perdió su valor: ${c}`);
    assert.ok(html.includes(`data-parte-ahora="${nombre}"`), `🔴 falta «Ahora» en ${nombre}`);
  }
  assert.ok(html.includes(GUIA), '🔴 con los dos selectores la guía firmada debería salir');
  assert.ok(html.includes('Horas y desplazamiento'), '🔴 falta el título del paso');
});

test('SCRUM-1175 · 🔴 PÉRDIDA SILENCIOSA: un valor que NO es HH:MM se queda de TEXTO con su valor', () => {
  // Formas reales de apuntar una hora a mano. Ninguna cabe en `type="time"`.
  for (const viejo of ['8h', '8.30', '8:30', '08:30h', 'por la mañana', '24:00', '08:60']) {
    const html = pintar({ ...BASE, entrada: viejo });
    const c = casilla(html, 'entrada');
    assert.ok(c, `🔴 con entrada «${viejo}» desapareció la casilla`);
    assert.match(c, /type="text"/, `🔴 «${viejo}» se pinta en un selector que lo BORRARÍA: ${c}`);
    const esperado = viejo.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    assert.ok(c.includes(`value="${esperado}"`), `🔴 «${viejo}» no conserva su valor: ${c}`);
    assert.ok(!html.includes('data-parte-ahora="entrada"'), `🔴 «Ahora» sobre «${viejo}» lo pisaría`);
    // La otra, que sí es HH:MM, sigue siendo selector: la regla va campo a campo.
    assert.match(casilla(html, 'salida'), /type="time"/, '🔴 la salida HH:MM dejó de ser selector');
    // Y la guía NO: con un campo de texto, «no se escribe» es falso en esta pantalla.
    assert.ok(!html.includes(GUIA), `🔴 la guía afirma «no se escribe» con «${viejo}» escrito a mano`);
  }
});

test('SCRUM-1175 · vacío → selector (no hay nada que perder) y la guía sale', () => {
  const html = pintar({ ...BASE, entrada: null, salida: '' });
  assert.match(casilla(html, 'entrada'), /type="time"/);
  assert.match(casilla(html, 'salida'), /type="time"/);
  assert.ok(html.includes(GUIA));
  assert.ok(!html.includes('Tiempo en la obra'), '🔴 duración inventada sin horas');
});

test('SCRUM-1175 · la duración: «3 h 30 min», y el aviso si la salida es antes', () => {
  assert.ok(pintar(BASE).includes('3 h 30 min'), '🔴 09:15 → 12:45 no dice 3 h 30 min');
  assert.ok(pintar({ ...BASE, salida: '09:45' }).includes('30 min'));
  assert.ok(pintar({ ...BASE, salida: '11:15' }).includes('2 h<'));

  const mal = pintar({ ...BASE, entrada: '12:00', salida: '09:00' });
  assert.ok(mal.includes('Revisa las horas') && mal.includes('La salida es antes que la entrada'),
    '🔴 salida anterior a la entrada y nadie lo dice');
  assert.ok(!mal.includes('Tiempo en la obra'));

  // Iguales: no es «antes», y no se pinta nada.
  const igual = pintar({ ...BASE, salida: '09:15' });
  assert.ok(!igual.includes('La salida es antes') && !igual.includes('Tiempo en la obra'));
  // Con una hora de texto libre no se resta nada.
  assert.ok(!pintar({ ...BASE, entrada: '8h' }).includes('Tiempo en la obra'));
});

test('SCRUM-1175 · parte FIRMADO: ni selector ni «Ahora» ni guía ni aviso; la duración sí', () => {
  const html = pintar(FIRMADO);
  assert.ok(!html.includes('data-parte-campo='), '🔴 un parte firmado abre un campo (T3)');
  assert.ok(!html.includes('data-parte-ahora'), '🔴 «Ahora» en un parte firmado');
  assert.ok(!html.includes(GUIA));
  assert.ok(html.includes('09:15') && html.includes('12:45'), '🔴 las horas firmadas ya no se ven');
  assert.ok(html.includes('3 h 30 min'), 'la duración es un dato derivado y cierto: se enseña');
  const mal = pintar({ ...FIRMADO, entrada: '12:00', salida: '09:00' });
  assert.ok(!mal.includes('Revisa las horas'), '🔴 pide revisar algo que ya no se puede tocar');
});

test('SCRUM-1175 · «km» al lado de los kilómetros; «horas» NO al lado del desplazamiento', () => {
  const html = pintar(BASE);
  assert.match(html, /data-parte-campo="kilometros"[^>]*>\s*<span class="parte-campo-unidad">km<\/span>/,
    '🔴 falta la unidad de los kilómetros');
  // `desplazamientos` es un ENTERO (recuento): llamarlo «horas» afirmaría lo que el dato no es.
  assert.doesNotMatch(html, /data-parte-campo="desplazamientos"[^>]*>\s*<span class="parte-campo-unidad">/,
    '🔴 el desplazamiento lleva unidad: el dato es un recuento entero, no horas');
  assert.match(casilla(html, 'desplazamientos'), /type="number"/);
});

test('SCRUM-1175 · el «Ahora» se cablea y guarda por el mismo camino que un cambio a mano', () => {
  const src = fs.readFileSync(JS, 'utf8');
  assert.match(src, /querySelectorAll\('\[data-parte-ahora\]'\)/, '🔴 «Ahora» pintado y sin cablear');
  assert.match(src, /guardarLaCasilla\[nombre\]\(\)/, '🔴 «Ahora» no guarda por el camino del change');
});

test('SCRUM-1175 · «Ahora» cumple el objetivo táctil de 44 px', () => {
  const css = fs.readFileSync(CSS, 'utf8');
  const regla = css.match(/\.parte-ahora\s*\{[^}]*\}/);
  assert.ok(regla, '🔴 .parte-ahora sin regla');
  assert.match(regla[0], /min-height:\s*44px/);
});
