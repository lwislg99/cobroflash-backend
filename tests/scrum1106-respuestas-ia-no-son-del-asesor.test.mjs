// SCRUM-1106 · UNA RESPUESTA DE IA NO SE PRESENTA COMO DEL ASESOR.
//
// El 23-sep-2026 se volcaron a `docs/legal/PREGUNTAS_ASESOR.md` y a `docs/producto/CONTABILIDAD.md`
// unas respuestas a Q-C1…Q-C8 rotuladas «RESPONDIDA por el asesor fiscal». El 30-sep el fundador
// contestó que **las escribió una herramienta** (SCRUM-1261, comentario 17638, decisión ①). Durante
// una semana, quien leyera esos dos documentos para construir 1051-1055 o 1073 lo hacía sobre una
// respuesta de IA con aspecto de dictamen: el alcance de 1051 «se estrechó MUY» por ella, y a 1053
// se le formuló una pregunta al fundador sobre su «la retención es CERO».
//
// Esto fija las DOS mitades:
//   · las siete respuestas de ese lote (Q-C1 a Q-C5, Q-C7, Q-C8) llevan la marca de IA, en los dos
//     documentos, y ninguna vuelve a decir «RESPONDIDA»/«RESUELTA»;
//   · lo que se apoya en una cita comprobada por script —Q-C9— CONSERVA su «RESPONDIDA por cita»:
//     un arreglo que marcara todo como IA pasaría la primera mitad y borraría una fuente real.
//
// Y una regla que no depende de la lista: ningún documento de `docs/legal/` ni `docs/producto/`
// atribuye «al asesor» una respuesta fechada el 23-sep-2026. Cuando conteste un profesional de
// verdad, su respuesta llevará su fecha y su nombre, no la de este lote.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { casosEscritos } from './_casos-escritos.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const PREGUNTAS = 'docs/legal/PREGUNTAS_ASESOR.md';
const CONTABILIDAD = 'docs/producto/CONTABILIDAD.md';
const DEL_LOTE = ['Q-C1', 'Q-C2', 'Q-C3', 'Q-C4', 'Q-C5', 'Q-C7', 'Q-C8'];
const MARCA_IA = 'RESPUESTA DE IA (23-sep-2026), SIN REVISIÓN PROFESIONAL (SCRUM-1261, c.17638)';

const leer = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');

/** La línea que ABRE la entrada de cada pregunta: `**Q-C1.**` en PREGUNTAS, `| Q-C1 |` en la tabla. */
function entradas(texto) {
  const salida = new Map();
  for (const l of texto.split('\n')) {
    const m = l.match(/^(?:\*\*(Q-C\d)\.\*\*|\| (Q-C\d) \|)/);
    if (m) salida.set(m[1] || m[2], l);
  }
  return salida;
}

/** Atribuye al asesor una respuesta del lote del 23-sep. */
const RE_ATRIBUCION = /(respondid[ao]s?|resuelt[ao]s?)[^\n]{0,40}asesor[^\n]{0,20}\(23-sep-2026\)|asesor[^\n]{0,20}\(23-sep-2026\)/i;

test('SCRUM-1106 · 🔴 AUTOPRUEBA: el detector ve la atribución y no ve la marca de IA', () => {
  // Mismo token, las dos caras: si el detector no ve el caso malo, el verde de abajo no vale.
  assert.match('✅ **RESPONDIDA por el asesor fiscal (23-sep-2026) →', RE_ATRIBUCION,
    '🔴 el detector no reconoce la atribución exacta que había en main el 30-sep.');
  assert.doesNotMatch(`⚠️ **${MARCA_IA} →`, RE_ATRIBUCION,
    '🔴 el detector confunde la marca de IA con una atribución al asesor.');
  // Y la tabla del documento: una fila fabricada con la marca vieja se reconoce como entrada.
  const e = entradas('| Q-C3 | ~~Suplidos~~ **RESPONDIDA (23-sep-2026) → SCRUM-1054.** |');
  assert.ok(e.has('Q-C3'), '🔴 el lector de entradas no ve una fila de tabla: los asertos de abajo estarían ciegos.');
});

const FILAS = [PREGUNTAS, CONTABILIDAD];
const casoa = casosEscritos(FILAS, (f) => `SCRUM-1106 · ${f}: las siete del lote llevan la marca de IA`, (f) => {
  const e = entradas(leer(f));
  for (const q of DEL_LOTE) {
    const l = e.get(q);
    assert.ok(l, `🔴 SUELO: no encuentro la entrada ${q} en ${f}. Si se ha movido, el guard está ciego.`);
    assert.ok(l.includes(MARCA_IA),
      `🔴 ${q} en ${f} ya no dice que es una respuesta de IA sin revisión profesional:\n    ${l.slice(0, 160)}\n`
      + '  Decisión ① del fundador, SCRUM-1261 comentario 17638: la escribió una herramienta.');
    assert.doesNotMatch(l, /\b(RESPONDIDA|RESUELTA)\b/,
      `🔴 ${q} en ${f} vuelve a darse por respondida:\n    ${l.slice(0, 160)}`);
  }
});
const casob = casosEscritos(FILAS, (f) => `SCRUM-1106 · ${f}: Q-C9 conserva su «RESPONDIDA por cita» (control)`, (f) => {
  const l = entradas(leer(f)).get('Q-C9');
  assert.ok(l, `🔴 SUELO: no encuentro Q-C9 en ${f}.`);
  assert.match(l, /RESPONDIDA por cita/,
    `🔴 Q-C9 en ${f} ha perdido su marca. Se apoya en LIVA arts. 7 y 20 cotejados por script, no en `
    + 'el lote del 23-sep: marcarla como IA borraría una fuente real.');
  assert.ok(!l.includes(MARCA_IA), `🔴 Q-C9 en ${f} lleva la marca de IA y no es del lote.`);
});
test('SCRUM-1106 · docs/legal/PREGUNTAS_ASESOR.md: las siete del lote llevan la marca de IA', casoa(0));
test('SCRUM-1106 · docs/legal/PREGUNTAS_ASESOR.md: Q-C9 conserva su «RESPONDIDA por cita» (control)', casob(0));
test('SCRUM-1106 · docs/producto/CONTABILIDAD.md: las siete del lote llevan la marca de IA', casoa(1));
test('SCRUM-1106 · docs/producto/CONTABILIDAD.md: Q-C9 conserva su «RESPONDIDA por cita» (control)', casob(1));
casoa.todos();
casob.todos();

test('SCRUM-1106 · ningún documento de legal/ ni producto/ atribuye al asesor el lote del 23-sep', () => {
  const ficheros = ['docs/legal', 'docs/producto'].flatMap((d) => fs.readdirSync(path.join(RAIZ, d))
    .filter((n) => n.endsWith('.md')).map((n) => `${d}/${n}`));
  assert.ok(ficheros.includes(PREGUNTAS) && ficheros.includes(CONTABILIDAD),
    '🔴 SUELO: la población no incluye los dos documentos que motivaron esto.');
  const malas = [];
  for (const f of ficheros) {
    leer(f).split('\n').forEach((l, i) => { if (RE_ATRIBUCION.test(l)) malas.push(`${f}:${i + 1}  ${l.slice(0, 120)}`); });
  }
  assert.deepEqual(malas, [],
    '🔴 Estas líneas atribuyen «al asesor» una respuesta del 23-sep-2026, que escribió una herramienta '
    + '(SCRUM-1261, c.17638):\n    ' + malas.join('\n    '));
});
