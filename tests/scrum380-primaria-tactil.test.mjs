// SCRUM-380 · LA ACCIÓN PRINCIPAL DE UNA PANTALLA NO PUEDE SER UN `btn-sm`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, MEDIDO EN UN NAVEGADOR
//
// El CTA del héroe del Trabajo —la SIGUIENTE acción, la que decide `jobNextAction`— se pintaba
// con `btn-primary btn-sm` y salía a **30×124,9 px** a 360 y a 390. Es la acción que se pulsa de
// pie, en una obra, con una mano y con guantes: era el objetivo táctil MÁS PEQUEÑO de su pantalla.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL ARREGLO VA EN LA CLASE DEL BOTÓN, NO EN EL CSS — y el primer intento fue el equivocado
//
// Subir `.btn-primary.btn-sm` a 44 px en móvil choca de frente con el control negativo de
// SCRUM-352: «el bump no debe convertir un `btn-sm` en un botón normal». Ese guard tiene razón y
// se respeta ENTERO.
//
// El defecto no era que `btn-sm` midiera 30. Era que **la primaria de una pantalla fuera un
// `btn-sm`**. Se le quita el modificador a ESE botón y `btn-sm` sigue midiendo 30 para todo lo
// demás — cero conflicto, y el control negativo de 352 sigue verde.
//
// ⚠️ De paso, la lección del selector: el primer intento usó `.btn.btn-primary.btn-sm` y otro
// guard lo cazó, porque el CSS promete que las variantes «funcionan solas» y el código las usa sin
// la clase base. **Un arreglo que parece completo y cubre la mitad es peor que ninguno.**

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const JOB = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/jobDetailView.js'), 'utf8');
const CSS = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');

/** El bloque del CTA del héroe: desde `jobNextAction(job` hasta su `addEventListener`. */
function bloqueCta() {
  const i = JOB.indexOf('const nextAct = jobNextAction(job');
  assert.ok(i > 0, '🔴 no encuentro el CTA del héroe: ¿cambió de nombre `jobNextAction`?');
  return JOB.slice(i, i + 1600);
}

test('SCRUM-380 · SUELO: el CTA del héroe existe y se le pone una clase', () => {
  // Sin esto, los asserts de abajo pasarían por no encontrar nada.
  const b = bloqueCta();
  assert.match(b, /cta\.className\s*=/, '🔴 el CTA ya no recibe clase: revisar antes de fiarse del verde');
});

test('SCRUM-380 · 🔴 el CTA del Trabajo NO es un `btn-sm`', () => {
  const b = bloqueCta();
  const m = b.match(/cta\.className\s*=\s*'([^']+)'/);
  assert.ok(m, '🔴 no puedo leer la clase del CTA');
  assert.ok(
    !m[1].split(/\s+/).includes('btn-sm'),
    `🔴 la PRIMARIA de la pantalla del Trabajo ha vuelto a ser \`btn-sm\` (clase: «${m[1]}»).\n\n`
    + '  Medido: eso son 30×124,9 px a 360 y 390 — el objetivo táctil más pequeño de la pantalla,\n'
    + '  y es el botón que se pulsa con guantes. El arreglo NO es subir `btn-sm` en el CSS (eso\n'
    + '  rompe el control negativo de SCRUM-352): es que la primaria no lleve ese modificador.',
  );
  assert.ok(m[1].includes('btn-primary'), 'y sigue siendo la primaria');
});

test('SCRUM-380 · el control negativo de SCRUM-352 se respeta: `btn-sm` sigue en 30', () => {
  // La otra mitad. Si alguien «arregla» esto por el CSS, este assert lo caza aquí además de en
  // el guard de 352 — y con el motivo delante.
  assert.match(CSS, /\.btn\.btn-sm\s*\{[^}]*min-height:\s*30px/,
    '🔴 `.btn.btn-sm` ha dejado de medir 30: eso es el bump que SCRUM-352 prohíbe');
  assert.ok(!/\.btn-primary\.btn-sm\s*\{[^}]*min-height:\s*44px/.test(CSS),
    '🔴 alguien ha subido `.btn-primary.btn-sm` a 44 en el CSS: es el intento que choca con 352');
});

// ── EL CENSO: ¿es un botón o es un patrón? ──────────────────────────────────

test('SCRUM-380 · CENSO: qué otras pantallas usan `btn-primary btn-sm`', () => {
  // El fundador lo pidió explícito: «si hay más de una, esto no es un botón, es un patrón».
  // Este test NO falla por el censo — lo DECLARA. Convertirlo en prohibición pondría rojas trece
  // pantallas de golpe y sería un rediseño encubierto (Parte AB).
  const dir = path.join(RAIZ, 'public/dashboard/js');
  const sitios = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.js')) continue;
    const codigo = fs.readFileSync(path.join(dir, f), 'utf8');
    codigo.split('\n').forEach((l, i) => {
      if (/className\s*=\s*['"]btn-primary btn-sm['"]/.test(l)) sitios.push(`${f}:${i + 1}`);
    });
  }
  assert.ok(sitios.length > 0, '🔴 el censo no ve ninguno: el detector no está mirando');
  // El CTA del Trabajo ya NO está entre ellos: es lo que arregla este ticket.
  assert.ok(!sitios.some((s) => s.startsWith('jobDetailView.js:63')),
    '🔴 el CTA del héroe sigue en el censo de `btn-primary btn-sm`');
  console.log(`      [censo SCRUM-380] ${sitios.length} usos de \`btn-primary btn-sm\` siguen en pie: ${sitios.join(', ')}`);
});
