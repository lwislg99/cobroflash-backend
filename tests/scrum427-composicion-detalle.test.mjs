// tests/scrum427-composicion-detalle.test.mjs — SCRUM-427 (tramo 2)
//
// EL ENUMERADOR: ¿tiene el detalle del Trabajo las secciones que el diseño de G dice, y sólo ésas?
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 ENUMERA, NO CUENTA — y ése es el ticket entero
//
// G4 «salía cuadrado» porque **4 + 5 = 9**: el número de secciones coincidía con el esperado y el
// CONTENIDO no. Un guard que compara longitudes da verde con la composición equivocada **y encima
// tranquiliza**, que es lo peor de las dos cosas. Aquí se comparan CONJUNTOS y el fallo dice las
// dos listas: qué FALTA y qué SOBRA, cada una con sus nombres.
//
// Las dos direcciones no son la misma pregunta:
//   · FALTA  → una promesa del diseño que la pantalla no cumple.
//   · SOBRA  → superficie que nadie diseñó. Puede ser un acierto posterior —y entonces se ENMIENDA
//              el diseño, con cita y fecha— o un descuido que nadie declaró. Las dos salidas son
//              legítimas; lo que no vale es que no se note.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  compararComposicion, seccionesDelDiseno, seccionesPintadas, normalizar,
  ENMIENDAS, SOBRANTES_SIN_DECIDIR, LARGO_MAX,
} from './_composicion-detalle.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── SUELO ────────────────────────────────────────────────────────────────────────────────
//
// «Cero secciones» y «composición correcta» NO pueden dar el mismo verde: si el escáner deja de
// encontrar nada —porque cambia el marcado, porque el fichero se parte, porque el recuadro del
// diseño se reescribe—, un `faltan: [], sobran: []` sería técnicamente cierto y completamente
// hueco. Se exige que las dos fuentes tengan contenido ANTES de comparar nada.

test('SCRUM-427 · 🔴 SUELO: sin secciones que leer, el enumerador se declara CIEGO', () => {
  const diseno = seccionesDelDiseno(RAIZ);
  const pintadas = seccionesPintadas(RAIZ);

  assert.ok(diseno.length >= 3,
    `🔴 el diseño de G ha devuelto ${diseno.length} secciones. O el recuadro de §4 cambió de forma, ` +
    'o el extractor dejó de entenderlo. Comparar contra una lista vacía daría verde siempre.');
  assert.ok(pintadas.length >= 4,
    `🔴 sólo se han encontrado ${pintadas.length} secciones pintadas en jobDetailView.js. Un ` +
    'escáner que no ve la pantalla no puede afirmar que la pantalla está bien.');
});

test('SCRUM-427 · 🔴 SUELO: el escáner no se desborda y coge código por rótulo', () => {
  // Éste no es teórico: el primer patrón casó con la ASIGNACIÓN `h.className =
  // 'detail-section-title';` y se comió 300 líneas de código como si fueran el nombre de una
  // sección. Un escáner que devuelve basura ensucia el veredicto y sigue pareciendo que mide.
  for (const s of seccionesPintadas(RAIZ)) {
    assert.ok(s.length <= LARGO_MAX,
      `🔴 el rótulo «${s.slice(0, 60)}…» tiene ${s.length} caracteres: el patrón se ha desbordado ` +
      'y está capturando código, no títulos.');
  }
});

// ── EL ENUMERADOR ────────────────────────────────────────────────────────────────────────

test('SCRUM-427 · la composición del detalle CUADRA con el diseño de G — enumerando', () => {
  const r = compararComposicion(RAIZ);

  assert.deepEqual(r.faltan, [],
    `🔴 EL DISEÑO PIDE SECCIONES QUE LA PANTALLA NO TIENE: ${r.faltan.join(', ')}.\n\n` +
    `   diseño (§4): ${r.diseno.join(' · ')}\n` +
    `   pantalla   : ${r.pintadas.join(' · ')}\n\n` +
    '   O se construye lo que falta, o se enmienda el diseño diciendo por qué ya no se quiere.');

  assert.deepEqual(r.sobran, [],
    `🔴 LA PANTALLA PINTA SECCIONES QUE EL DISEÑO NO LISTA Y NADIE HA DECLARADO: ${r.sobran.join(', ')}.\n\n` +
    `   diseño (§4): ${r.diseno.join(' · ')}\n` +
    `   pantalla   : ${r.pintadas.join(' · ')}\n\n` +
    '   No es necesariamente un error —puede ser una decisión posterior y mejor—, pero tiene que\n' +
    '   estar DICHA: enmienda en `docs/diseno/bloque-g.md` §4 con su cita y su fecha, o entrada en\n' +
    '   `SOBRANTES_SIN_DECIDIR` mientras se decide. Lo que no vale es que aparezca en silencio.');
});

test('SCRUM-427 · CONTROL POSITIVO: las cuatro del diseño están, una a una', () => {
  // Sin esto, «faltan: []» podría venir de un diseño que no se supo leer. Se nombran las cuatro.
  const { diseno, pintadas } = compararComposicion(RAIZ);
  for (const s of ['que falta para cobrar', 'albaranes', 'gastos', 'notas internas']) {
    assert.ok(diseno.includes(s), `🔴 «${s}» ya no se lee del §4 del diseño.`);
    assert.ok(pintadas.some((p) => p.includes(s) || s.includes(p)), `🔴 «${s}» no se pinta.`);
  }
});

// ── LAS EXCEPCIONES, VIGILADAS ───────────────────────────────────────────────────────────

test('SCRUM-427 · `FACTURAS` está ENMENDADA en el diseño, no sólo tolerada aquí', () => {
  // Una excepción que sólo vive en el guard es invisible para quien lee el diseño. La enmienda
  // tiene que estar EN el documento, y esto lo comprueba leyéndolo.
  const md = fs.readFileSync(path.join(RAIZ, 'docs/diseno/bloque-g.md'), 'utf8');
  assert.match(md, /ENMIENDA/i, '🔴 el diseño no declara ninguna enmienda.');
  assert.match(md, /SCRUM-319/, '🔴 la enmienda de FACTURAS no cita su decisión.');
  assert.ok(ENMIENDAS.facturas && ENMIENDAS.facturas.fuente.includes('SCRUM-319'),
    '🔴 la enmienda del guard no apunta a su fuente.');
});

test('SCRUM-427 · TRINQUETE: los sobrantes sin decidir NO crecen, y siguen ahí', () => {
  const r = compararComposicion(RAIZ);
  // Igualdad, no «≤»: los declarados pueden quedarse mientras se decide, pero uno nuevo sin
  // decisión pone esto en rojo. Y si uno declarado DESAPARECE, también — para que la lista no se
  // quede hablando de secciones que ya no existen.
  assert.deepEqual(
    r.pendientesPresentes.sort(), Object.keys(SOBRANTES_SIN_DECIDIR).sort(),
    '🔴 la lista de sobrantes SIN DECIDIR ya no coincide con la realidad. Si has añadido una ' +
    'sección, decláralas; si has retirado una, quítala de `SOBRANTES_SIN_DECIDIR` en el mismo ' +
    'commit — una excepción que sobrevive a lo que excepcionaba es una excepción que nadie retiró.');

  // Y cada una tiene que decir de dónde sale y qué falta decidir: una entrada sin motivo es una
  // lista de nombres, y dentro de un mes nadie sabrá por qué están.
  for (const [nombre, d] of Object.entries(SOBRANTES_SIN_DECIDIR)) {
    assert.ok(d.origen && d.origen.length > 30, `🔴 «${nombre}» no declara su origen.`);
    assert.ok(d.pendiente && d.pendiente.includes('?'), `🔴 «${nombre}» no dice qué hay que decidir.`);
  }
});

test('SCRUM-427 · una enmienda que autoriza algo que ya NO se pinta, se caza', () => {
  const r = compararComposicion(RAIZ);
  assert.deepEqual(r.enmendadasNoPintadas, [],
    `🔴 hay enmiendas que autorizan secciones inexistentes: ${r.enmendadasNoPintadas.join(', ')}. ` +
    'Una excepción que sobrevive a lo que excepcionaba deja de ser una decisión y pasa a ser ruido.');
});

// ── LA MICROCOPY APROBADA ────────────────────────────────────────────────────────────────

test('SCRUM-427 · el rótulo es «Notas internas», sin emoji', () => {
  const js = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/jobDetailView.js'), 'utf8');
  const m = /<h3[^>]*class="detail-section-title"[^>]*>([^<]*Notas[^<]*)</.exec(js);
  assert.ok(m, '🔴 no se encuentra el rótulo de notas.');
  assert.equal(m[1].trim(), 'Notas internas',
    '🔴 la microcopy aprobada (10-ago-2026) es «Notas internas» a secas. Entró con un 📝 delante y ' +
    'ninguna de las otras seis secciones del detalle lleva emoji: rompía el registro de la pantalla.');

  // Y ninguna sección del detalle lleva emoji en su título — la regla, no sólo este caso.
  for (const s of seccionesPintadas(RAIZ)) {
    assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(s), `🔴 «${s}» lleva emoji en el título.`);
  }
});
