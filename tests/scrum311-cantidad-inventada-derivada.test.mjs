// tests/scrum311-cantidad-inventada-derivada.test.mjs — SCRUM-311 (guard estructural, sin gate).
//
// NADIE INVENTA UNA CANTIDAD QUE EL PRO DEJÓ VACÍA — Y AHORA SE MIRA EN TODAS PARTES.
//
// SCRUM-271 arregló sus tres puntos y están bien. Lo que falla es su RED: lee dos rutas escritas
// a mano, que son justo los dos ficheros que ya arregló. Un guard que enumera solo protege lo que
// ya está protegido. Esto no revierte 271: AMPLÍA su red.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { censarCantidadInventada, EXCEPCIONES_CON_MOTIVO, esExcepcion } from './_censo-cantidad-inventada.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');

// ── CENSO DERIVADO ───────────────────────────────────────────────────────────
// `public/dashboard/js/` es donde vive el front del pro: los formularios que producen importes.
// La landing (`public/*.html`) no tiene formularios de líneas y `src/` es servidor (no hay
// `<input>`), así que quedan fuera y queda DICHO — no se omiten en silencio.
const RAIZ_FRONT = path.join(RAIZ, 'public', 'dashboard', 'js');

function ficheros(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficheros(p, out);
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');
const CENSO = ficheros(RAIZ_FRONT).map((p) => censarCantidadInventada(fs.readFileSync(p, 'utf8'), rel(p)));
const FICHEROS = CENSO.length;
const LECTURAS = CENSO.reduce((t, c) => t + c.lecturasDeValue, 0);
const HALLAZGOS = CENSO.flatMap((c) => c.hallazgos);

// ── SUELO ────────────────────────────────────────────────────────────────────
test('SCRUM-311 · SUELO: el censo recorrió el front de verdad', () => {
  assert.ok(FICHEROS >= 20,
    `🔴 solo ${FICHEROS} ficheros recorridos: el recorrido está roto y este guard daría verde por ` +
    'no mirar. Es exactamente el defecto que este ticket viene a cerrar.');
});

test('SCRUM-311 · SUELO: el detector VE las lecturas de input que hay', () => {
  assert.ok(LECTURAS >= 200,
    `🔴 el detector solo vio ${LECTURAS} lecturas de \`.value\` en ${FICHEROS} ficheros. En este ` +
    'front hay muchas más: «no hay patrón» y «no supe mirar» son el mismo número.');
});

// ── CONTROL POSITIVO · el defecto ORIGINAL de 271 sigue cazándose ────────────
// 271 ya lo arregló, así que en el árbol de hoy no queda. Se reproduce su FORMA para demostrar
// que derivar no ha EMPEORADO la red — que sería el colmo en este ticket.
test('SCRUM-311 · POSITIVO: la forma original de SCRUM-271 se sigue cazando', () => {
  const homeViewOriginal = `
    const qty = Number(l.qtyInput.value) || 1;
    lines.push({ concept: l.concept, qty });
  `;
  const r = censarCantidadInventada(homeViewOriginal, 'homeView.js');
  assert.equal(r.hallazgos.length, 1, 'el caso original tiene que caer: si no, la red ha empeorado');
  assert.equal(r.hallazgos[0].reserva, '1');
});

test('SCRUM-311 · POSITIVO: cualquier reserva numérica no-cero cae, no solo el 1', () => {
  for (const mal of ['|| 1', '|| "2"', "|| '10'", '|| 1.5']) {
    const r = censarCantidadInventada(`const q = line.qtyInput.value ${mal};`, 'x.js');
    assert.equal(r.hallazgos.length, 1, `la reserva ${mal} tenía que caer`);
  }
});

// ── 🔴 CONTROL NEGATIVO · los 36 usos legítimos de quotesView.js ─────────────
// Un guard que los tumbe vive en rojo y alguien lo desactiva. Un guard silenciado no protege nada.
test('SCRUM-311 · NEGATIVO: las tres familias legítimas NO caen', () => {
  const legitimos = [
    ['|| ""', 'reserva vacía: parseFloat("") es NaN y se trata aparte'],
    ["|| ''", 'ídem con comillas simples'],
    ['|| 0', 'cero significa cero'],
    ['|| "0"', 'cero como cadena'],
  ];
  for (const [expr, porque] of legitimos) {
    const r = censarCantidadInventada(`const q = line.qtyInput.value ${expr};`, 'x.js');
    assert.deepEqual(r.hallazgos, [], `NO puede caer — ${porque}`);
  }
});

test('SCRUM-311 · NEGATIVO: el IVA POR DEFECTO del merchant no es una cantidad inventada', () => {
  // `|| "21"` es no-cero como el 1 peligroso: no se separa por la forma del literal, sino por el
  // SUJETO. Un campo `*Default*` es un ajuste cuyo valor por defecto ES ese; caer a él restaura
  // lo configurado en vez de inventar nada.
  const r = censarCantidadInventada('const v = fieldVatDefault.input.value || "21";', 'x.js');
  assert.deepEqual(r.hallazgos, [],
    'el IVA por defecto no es una entrada de línea: tumbarlo dejaría el guard en rojo permanente');
});

test('SCRUM-311 · NEGATIVO: el fichero real de quotesView no dispara sus 36 usos legítimos', () => {
  const c = censarCantidadInventada(
    fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/quotesView.js'), 'utf8'),
    'public/dashboard/js/quotesView.js',
  );
  const sinExcepcion = c.hallazgos.filter((h) => !esExcepcion(h));
  assert.deepEqual(sinExcepcion, [],
    '🔴 el guard está tumbando usos legítimos de quotesView.js. De sus 37 apariciones de `||` ' +
    'sobre una lectura de input, 36 son correctas: un guard que las caza se acaba desactivando.');
});

// ── EL REPO, HOY ─────────────────────────────────────────────────────────────
test('SCRUM-311 · ningún sitio del front inventa una cantidad', () => {
  const vivos = HALLAZGOS.filter((h) => !esExcepcion(h));
  const detalle = vivos.map((h) => `   · ${h.ruta}:${h.linea} — \`${h.sujeto} || ${h.reserva}\``).join('\n');
  assert.equal(vivos.length, 0,
    '🔴 SCRUM-271/311: una lectura de input cae a un número distinto de cero. Un `<input ' +
    'type="number">` vacío devuelve "", y ahí se convierte en una cantidad que el pro NO escribió:\n' +
    detalle);
});

test('SCRUM-311 · toda excepción viva lleva su motivo escrito', () => {
  // Una excepción sin motivo se hereda para siempre. Y si el sitio se arregla, la excepción debe
  // desaparecer con él: una excepción que ya no corresponde a nada es ruido que enseña a ignorar.
  for (const e of EXCEPCIONES_CON_MOTIVO) {
    assert.ok(e.motivo && e.motivo.length > 40, `la excepción de ${e.ruta}:${e.linea} no explica por qué`);
    assert.match(e.motivo, /SCRUM-\d+/, 'una excepción pendiente de decisión cita su ticket');
    const c = censarCantidadInventada(fs.readFileSync(path.join(RAIZ, e.ruta), 'utf8'), e.ruta);
    assert.ok(c.hallazgos.some((h) => h.linea === e.linea),
      `🔴 la excepción de ${e.ruta}:${e.linea} ya no corresponde a nada: bórrala`);
  }
});
