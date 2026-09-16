// tests/scrum865-un-solo-minimo-para-la-landing.test.mjs — SCRUM-865
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// DOS GUARDS MIDEN LA MISMA PÁGINA: TIENEN QUE PEDIRLE LO MISMO
//
// `guard-objetivo-tactil` y `guard-a11y-landing` miden los dos la landing publicada a 1280 px.
// SCRUM-711 alineó el primero con DESIGN.md —«≥44px en móvil (el escritorio se queda en 36px a
// propósito)»— y el segundo se quedó con un `const MINIMO_TACTIL = 44;` propio, escrito a mano.
// Desde ese día pedían cosas distintas a la misma página en escritorio.
//
// 🔴 LA CAUSA NO ES EL NÚMERO, ES QUE ESTUVIERA REPETIDO. Un umbral escrito dos veces diverge en
// cuanto alguien decide sobre uno de los dos; es la misma lección que SCRUM-562 dejó escrita con el
// árbitro («una copia en línea es lo que dejó que estos dos midieran distinto durante dos días»).
// Por eso aquí no se arregla poniendo 36 a mano en el segundo: se importa `minimoPara`.
//
// ── POR QUÉ ESTE GUARD NECESITA SONDAS Y NO LE BASTAN SUS TÁCTILES ──────────────────────────
// Los dos que mide —el logo y «Ver planes →»— miden 45 y 47 px. Están tan por encima del umbral
// que **un mínimo mal aplicado no se notaría**: el guard saldría verde con 44, con 36 y con 12.
// Las sondas de umbral son lo único que hace que su verde signifique algo:
//     40 px a 360 → CAE   ·   30 px a 1280 → CAE   ·   37 px a 1280 → PASA
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { soloCodigo } from './_solo-codigo.mjs';
import { minimoPara, CORTE_MOVIL, MINIMO_TACTIL, MINIMO_ESCRITORIO } from '../scripts/_medidor-de-toque.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => soloCodigo(fs.readFileSync(path.join(RAIZ, rel), 'utf8'));

const LANDING = 'scripts/guard-a11y-landing.mjs';
const TACTIL = 'scripts/guard-objetivo-tactil.mjs';

test('SCRUM-865 · 🔴 SUELO: estoy leyendo los dos guards, y miden lo que creo', () => {
  const a = leer(LANDING);
  const b = leer(TACTIL);
  assert.match(a, /TACTILES/, `🔴 CIEGO: ${LANDING} no trae su lista de táctiles: no estoy leyendo lo que creo.`);
  for (const [rel, src] of [[LANDING, a], [TACTIL, b]]) {
    assert.match(src, /const ANCHOS = \[1280, 360\];/,
      `🔴 CIEGO: ${rel} ya no mide la landing a 1280 y 360, así que la comparación de abajo no habla de la misma página.`);
  }
});

test('SCRUM-865 · 🔒 los dos guards toman el mínimo del MISMO sitio', () => {
  for (const rel of [LANDING, TACTIL]) {
    assert.match(leer(rel), /import\s*\{[^}]*\bminimoPara\b[^}]*\}\s*from\s*'\.\/_medidor-de-toque\.mjs'/,
      `🔴 ${rel} no importa \`minimoPara\` del medidor común: vuelve a decidir por su cuenta qué exige, `
      + 'y dos guards sobre la misma página divergen en cuanto alguien decide sobre uno.');
    assert.match(leer(rel), /minimoPara\(ancho\)/,
      `🔴 ${rel} importa \`minimoPara\` pero no lo usa con el ancho: el mínimo volvería a ser uno para todos.`);
  }
});

test('SCRUM-865 · 🔴 la landing ya no escribe su propio umbral', () => {
  const src = leer(LANDING);
  assert.doesNotMatch(src, /const\s+MINIMO_TACTIL\s*=\s*\d+/,
    '🔴 ha vuelto un umbral escrito a mano en el guard de la landing. El número no es el problema: '
    + 'tenerlo dos veces es lo que hizo que los dos guards divergieran (SCRUM-865).');
  assert.doesNotMatch(src, /INTERACTIVOS,\s*MINIMO_TACTIL\)/,
    '🔴 la medición vuelve a usar el mínimo de móvil para TODOS los anchos: a 1280 exigiría más de lo '
    + 'que dice DESIGN.md.');
  assert.match(src, /INTERACTIVOS,\s*MIN\)/,
    '🔴 la medición ya no recibe el mínimo de SU ancho.');
});

test('SCRUM-865 · las tres sondas de umbral siguen en el guard, con su veredicto por ancho', () => {
  const src = leer(LANDING);
  for (const [id, alto] of [['__sonda-40', 40], ['__sonda-30', 30], ['__sonda-37', 37]]) {
    assert.ok(src.includes(id),
      `🔴 falta la sonda \`${id}\`: sin ella, este guard sale verde con el mínimo mal puesto, porque sus `
      + 'dos táctiles (45 y 47 px) están muy por encima de cualquier umbral.');
    assert.ok(src.includes(`height:${alto}px`),
      `🔴 la sonda de ${alto} px ya no mide ${alto} px en el HTML que inyecta el guard.`);
  }
  assert.match(src, /ancho <= CORTE_MOVIL \? SONDAS_MOVIL : SONDAS_ESCRITORIO/,
    '🔴 las sondas ya no reparten su veredicto entre móvil y escritorio.');
});

test('SCRUM-865 · 🔒 los tres veredictos, con la MISMA función que usa el guard', () => {
  // Lo que las sondas comprueban en navegador, dicho aquí como aritmética: si `minimoPara` cambiara,
  // estos tres cambiarían con él — y el guard se pondría rojo por sus sondas.
  assert.ok(40 < minimoPara(360), '🔴 40 px a 360 NO cae: el móvil ha dejado de exigir 44.');
  assert.ok(30 < minimoPara(1280), '🔴 30 px a 1280 NO cae: el guard se queda ciego en escritorio.');
  assert.ok(37 >= minimoPara(1280), '🔴 37 px a 1280 NO pasa: la landing vuelve a exigir en escritorio más '
    + 'de lo que dice DESIGN.md, que es justo la divergencia que cierra este ticket.');
  // Y el corte es el mismo para los dos guards, porque sale del mismo sitio.
  assert.equal(minimoPara(CORTE_MOVIL), MINIMO_TACTIL, '🔴 el corte ha dejado de ser inclusivo en móvil.');
  assert.equal(minimoPara(CORTE_MOVIL + 1), MINIMO_ESCRITORIO, '🔴 justo por encima del corte no se exige escritorio.');
});
