// SCRUM-1681 ① · los modales de Trabajos («Agendar», «Cerrar trabajo», «Técnicos») tienen relleno.
//
// Los tres salen del MISMO ayudante, `jobsModal()` (`public/dashboard/js/jobAgendar.js`), que monta
// `.modal.jobs-modal` y le mete DENTRO, sin `.modal-header` ni `.modal-body`, el título, el cuerpo y
// el pie. `.modal` no pone relleno (lo ponen sus hijos `.modal-header`/`.modal-body`/`.modal-footer`)
// y `.jobs-modal` tampoco lo ponía: medido en yaqu.app el 10-nov-2026 (SCRUM-1658) con
// `getComputedStyle`, `padding: 0px` y el título a 0 px del borde, a 390 y a 1280. «Trabajo nuevo»
// (`.modal-body`) va a 24 px a los lados: ése es el objetivo de la aceptación.
//
// QUÉ MIDE ESTO, y qué no: lee de la hoja el relleno de la regla `.jobs-modal` y comprueba que ninguna
// otra regla que alcance al modal en móvil se lo quite; y que el ayudante sigue poniendo esa clase.
// Lo que se ve en pantalla está medido con navegador y escrito en `docs/master/SCRUM-1681.md`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// El filtro de comentarios es el COMPARTIDO (SCRUM-700): sobre la hoja CSS quita los `/* */` y deja
// las dos reglas que esto mira. Medido al escribirlo: 3 833 de 3 853 declaraciones sobreviven; las
// 20 que no son líneas con `//` (`url(https://…)`), ninguna de `.jobs-modal` ni de `.modal`.
// Con SUELO (SCRUM-1395): el ancla es la regla que este test mira; si el filtro la borrara, lo dice.
import { ejecutableDe } from './_guard-texto.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const CSS = leer('public/dashboard/css/styles.css');
const AYUDANTE = leer('public/dashboard/js/jobAgendar.js');

/** Cada regla de la hoja (sin comentarios) como { selectores[], cuerpo }. Entra también en @media. */
function reglas(css) {
  const limpio = ejecutableDe(css, { ancla: '.jobs-modal' });
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(limpio))) {
    out.push({ selectores: m[1].split(',').map((s) => s.trim()), cuerpo: m[2] });
  }
  return out;
}

/** Los cuatro lados del relleno de un cuerpo de regla, o null si no declara `padding`. */
function relleno(cuerpo) {
  const m = /(?:^|;)\s*padding\s*:\s*([^;]+)/.exec(cuerpo);
  if (!m) return null;
  const v = m[1].trim().split(/\s+/).map(parseFloat);
  const [a, b = a, c = a, d = b] = v;
  return { arriba: a, derecha: b, abajo: c, izquierda: d };
}

test('SCRUM-1681 · el ayudante de los modales de Trabajos sigue montando `.modal.jobs-modal`', () => {
  assert.match(AYUDANTE, /function jobsModal\s*\(/, 'no encuentro `jobsModal()` en jobAgendar.js');
  assert.match(AYUDANTE, /className\s*=\s*'modal jobs-modal'/,
    'el panel ya no lleva `modal jobs-modal`: este test mediría una regla que nadie usa');
});

test('SCRUM-1681 · `.jobs-modal` pone 24 px de relleno a los cuatro lados (como «Trabajo nuevo»)', () => {
  const propias = reglas(CSS).filter((r) => r.selectores.includes('.jobs-modal'));
  assert.ok(propias.length > 0, 'no hay ninguna regla `.jobs-modal` en styles.css');
  const conRelleno = propias.map((r) => relleno(r.cuerpo)).filter(Boolean);
  assert.ok(conRelleno.length > 0,
    '`.jobs-modal` no declara `padding`: el título y los botones van pegados al borde (0 px medido en prod)');
  for (const p of conRelleno) {
    for (const [lado, px] of Object.entries(p)) {
      assert.ok(px >= 24, `\`.jobs-modal\` deja ${px} px ${lado}; el objetivo son 24 px como \`.modal-body\``);
    }
  }
});

test('SCRUM-1681 · ninguna regla del modal en móvil le quita el relleno', () => {
  // La hoja inferior de <640 px (`.modal-overlay .modal`) gana en especificidad a `.jobs-modal`:
  // si algún día declara `padding`, se come el de los modales de Trabajos sin que nadie lo vea.
  const quePisan = reglas(CSS).filter((r) =>
    r.selectores.some((s) => /(^|\s)\.modal$/.test(s) && s !== '.modal') && relleno(r.cuerpo));
  assert.deepEqual(quePisan.map((r) => r.selectores.join(', ')), [],
    'una regla más específica que `.jobs-modal` declara `padding` sobre `.modal`');
});
