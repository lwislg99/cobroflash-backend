import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * SCRUM-189 — una cita CIERTA pero ambigua envejece igual de mal que una falsa.
 *
 * «regla 3 del runbook» era verdad y aun así mandaba al sitio equivocado. En este repo hay
 * CUATRO numeraciones distintas que compiten por esa frase:
 *
 *   · docs/QA/SUITE_REGRESION.md → «Runbook de ejecución…»      (1-7)
 *   · docs/QA/SUITE_REGRESION.md → «Escribir verificaciones…»   (1-9)  ← lo que casi todas citaban
 *   · docs/QA/SUITE_REGRESION.md → «Migraciones…»               (1-…)
 *   · docs/RUNBOOKS.md           → R1-R8 (operativa: pagos, Meta, SIF…)
 *
 * Y el detalle que lo remata: la sección que SÍ se llama «Runbook» es la primera, mientras que
 * casi todas las citas apuntaban a la segunda. Quien abriera el fichero llamado RUNBOOKS.md
 * leería «R3 · Pago cobrado pero webhook perdido» y concluiría que la cita está podrida.
 *
 * LA FORMA CORRECTA cita el FICHERO y la FRASE, no el número: un número se renumera en cuanto
 * alguien inserta un punto en medio, y entonces la cita miente sin que nadie toque la cita.
 */

const DIRS = ['tests', 'scripts', 'docs', 'src'];
const AMBIGUA = /\b(regla|principio|trampa|punto)\s+\d+\s+del\s+runbook/i;

function ficheros() {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (/\.(mjs|js|ts|md)$/.test(e.name)) out.push(f);
    }
  };
  for (const d of DIRS) {
    const abs = path.join(raiz, d);
    if (fs.existsSync(abs)) walk(abs);
  }
  return out.sort();
}

test('SCRUM-189: nadie vuelve a citar "regla N del runbook"', () => {
  const culpables = [];
  for (const f of ficheros()) {
    // Se lee normalizando finales de línea: en un checkout de Windows (CRLF) un patrón
    // anclado se comporta distinto que en Linux, y un guard que solo falla en un sistema
    // operativo es medio guard (lección de SCRUM-128).
    const src = fs.readFileSync(f, 'utf8').replace(/\r/g, '');
    // Este mismo fichero EXPLICA el patrón prohibido, así que lo contiene: se excluye a sí
    // mismo. Trampa de auto-referencia de SCRUM-129 — un guard que se lee a sí mismo nace
    // rojo contra su propia documentación.
    if (path.basename(f) === 'scrum189-citas-inequivocas.test.mjs') continue;
    src.split('\n').forEach((linea, i) => {
      if (AMBIGUA.test(linea)) culpables.push(`${path.relative(raiz, f)}:${i + 1}`);
    });
  }

  assert.deepEqual(
    culpables, [],
    `\n\n🔴 Cita ambigua "regla N del runbook" en:\n` +
    culpables.map((c) => `   · ${c}`).join('\n') +
    '\n\nEn este repo compiten CUATRO numeraciones: las tres listas de SUITE_REGRESION.md y las\n' +
    'R1-R8 de RUNBOOKS.md. Cita el FICHERO y la FRASE, no el número:\n' +
    '  docs/QA/SUITE_REGRESION.md «*Pruébalo en rojo, modo por modo…*»\n' +
    'La frase sobrevive a una renumeración; el número, no.\n'
  );
});

test('SCRUM-189: el detector VE el patrón prohibido (guarda de presencia)', () => {
  // Sin esto, el guard de arriba pasaría en vacío el día que alguien cambie la regex o mueva
  // los directorios — indistinguible de "todo correcto".
  assert.ok(AMBIGUA.test('esto es la regla 3 del runbook, mira'), 'el detector no reconoce la forma que prohíbe');
  assert.ok(AMBIGUA.test('la TRAMPA 5 DEL RUNBOOK'), 'el detector debe ser insensible a mayúsculas');
  assert.ok(!AMBIGUA.test('SUITE_REGRESION.md «*Pruébalo en rojo*»'), 'la forma CORRECTA no puede dispararlo');
  assert.ok(!AMBIGUA.test('regla 29 del máster'), 'las citas al máster son otra cosa: lista canónica única');
});

test('SCRUM-189: las frases citadas existen de verdad en el fichero citado', () => {
  // Una cita inequívoca que apunta a una frase inexistente es igual de inútil que la ambigua.
  // Esto ata las citas nuevas al texto real: si alguien reescribe el principio, esto avisa.
  const doc = fs.readFileSync(path.join(raiz, 'docs', 'QA', 'SUITE_REGRESION.md'), 'utf8').replace(/\r/g, '');
  const FRASES = [
    'Que la garantía estructural corra en `npm test` normal, sin gate',
    'Toda comprobación por AUSENCIA necesita antes un assert de que lo buscado existe',
    'Pruébalo en rojo, modo por modo, y déjalo escrito en el commit',
    'Que un mecanismo pille algo por casualidad NO demuestra que cubra esa clase',
    'Nunca leas el resultado de una herramienta a través de una tubería',
  ];
  for (const frase of FRASES) {
    assert.ok(
      doc.includes(frase),
      `la frase citada ya no está en SUITE_REGRESION.md: «${frase}». O se reescribió el principio (actualiza las citas) o se borró (peor).`
    );
  }
});
