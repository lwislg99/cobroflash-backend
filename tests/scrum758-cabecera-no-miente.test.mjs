// tests/scrum758-cabecera-no-miente.test.mjs — SCRUM-758
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA CABECERA DE UNA ENTRADA DEL LOG NO PUEDE CONTRADECIR A SU PROPIO CUERPO
//
// UNA LÍNEA COSTÓ UN TICKET ENTERO. `docs/MIGRATIONS_PENDING.md:575` decía «🔴 SIN APLICAR en
// ninguna de las tres» mientras su cuerpo tenía **dos de las tres casillas marcadas**, con
// verificación por `information_schema` incluida. De esa línea salieron: un enunciado falso
// («nueve migraciones que MUTAN datos no constan»), y una hipótesis equivocada sobre por qué
// producción estaba caída.
//
// Nadie miraba esa concordancia. Ahora sí.
//
// ── LA REGLA, SACADA DEL VOCABULARIO DEL PROPIO DOCUMENTO ───────────────────────────────
//
// El log dice el estado de dos maneras: en la CABECERA (`## … — ✅ APLICADO en las TRES bases`)
// y, cuando las tiene, en CASILLAS del cuerpo (`- [x] **producción · autorack** — aplicado…`).
// Las casillas son lo único que una máquina puede leer sin adivinar, así que la regla se apoya
// en ellas:
//
//   · cabecera «SIN APLICAR en ninguna»  → el cuerpo NO puede tener ni una casilla marcada
//   · cabecera «APLICADO … en las TRES»  → el cuerpo NO puede tener ninguna sin marcar
//   · cabecera «PARCIAL»                 → tiene que haber de las dos
//
// ── ⚠️ LO QUE ESTE GUARD **NO** VE, Y SE DICE EN VOZ ALTA ───────────────────────────────
//
// La mayoría de las entradas del documento **no exponen casillas**: dicen su estado en prosa, y
// este guard **no las juzga**. No las da por buenas: las declara NO MEDIBLES.
//
// 🔴 Y ese reparto NO se escribe aquí como número, a propósito (SCRUM-737): una cifra de recuento
// en un comentario envejece en silencio, que es literalmente el defecto que este fichero viene a
// impedir un piso más arriba. **Lo cuenta el propio guard** y lo imprime en su suelo:
// «entradas: N · con casillas (juzgables): N · en prosa (NO medibles por este guard): N».
//
// 🔴 Y NO se han metido las tablas por base, aunque parecían población fácil: el detector daba
// FALSOS POSITIVOS. La tabla de la línea 230 lista Host / Nombre de base / Recuento de facturas
// —discriminadores de destino, no estados de migración— y un guard que la leyera como estado
// gritaría sobre una entrada sana. Un guard que cría lobos se acaba apagando, así que se queda
// fuera y se dice por qué.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url'; // NUNCA `new URL().pathname`: no decodifica (SCRUM-730)

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOC = 'docs/MIGRATIONS_PENDING.md';

/** Las entradas `## …` del log, con su cuerpo y el recuento de casillas. */
export function entradasDelLog(texto) {
  const L = texto.split('\n');
  const cabeceras = [];
  L.forEach((l, i) => { if (/^## /.test(l)) cabeceras.push(i); });
  return cabeceras.map((ini, k) => {
    const fin = k + 1 < cabeceras.length ? cabeceras[k + 1] : L.length;
    const cuerpo = L.slice(ini + 1, fin);
    return {
      linea: ini + 1,
      titulo: L[ini].slice(3).trim(),
      marcadas: cuerpo.filter((l) => /^\s*-\s*\[x\]/i.test(l)).length,
      sinMarcar: cuerpo.filter((l) => /^\s*-\s*\[ \]/.test(l)).length,
    };
  });
}

/**
 * Lo que la CABECERA afirma sobre la cobertura, o `null` si no afirma nada legible.
 *
 * `ninguna` · `todas` · `parcial`. El vocabulario sale del documento, no de mi cabeza.
 */
export function afirmacionDeLaCabecera(titulo) {
  const t = titulo.toUpperCase();
  if (/SIN APLICAR EN NINGUNA/.test(t)) return 'ninguna';
  if (/PARCIAL/.test(t)) return 'parcial';
  if (/APLICAD[AO].*(EN LAS TRES|TAMBIÉN EN DEV)/.test(t)) return 'todas';
  if (/APLICAD[AO].*SOLO EN DEV/.test(t)) return 'parcial'; // «solo en DEV» = ni todas ni ninguna
  return null;
}

/** El desacuerdo entre cabecera y cuerpo, o `null` si concuerdan. */
export function contradiccion(e) {
  const dice = afirmacionDeLaCabecera(e.titulo);
  if (dice === null) return null;
  if (e.marcadas + e.sinMarcar === 0) return null; // sin casillas no hay nada que contrastar
  if (dice === 'ninguna' && e.marcadas > 0) {
    return `la cabecera dice SIN APLICAR EN NINGUNA y el cuerpo tiene ${e.marcadas} casilla(s) MARCADA(S)`;
  }
  if (dice === 'todas' && e.sinMarcar > 0) {
    return `la cabecera dice APLICADO EN LAS TRES y el cuerpo tiene ${e.sinMarcar} casilla(s) SIN MARCAR`;
  }
  if (dice === 'parcial' && (e.marcadas === 0 || e.sinMarcar === 0)) {
    return `la cabecera dice PARCIAL y el cuerpo no lo es (marcadas: ${e.marcadas}, sin marcar: ${e.sinMarcar})`;
  }
  return null;
}

const TEXTO = fs.readFileSync(path.join(RAIZ, DOC), 'utf8');
const ENTRADAS = entradasDelLog(TEXTO);
const CON_CASILLAS = ENTRADAS.filter((e) => e.marcadas + e.sinMarcar > 0);

test('SCRUM-758 · SUELO: el guard VE entradas, y sabe cuántas puede juzgar', () => {
  assert.ok(
    ENTRADAS.length > 20,
    `🔴 GUARD CIEGO: sólo ${ENTRADAS.length} entradas \`## \` en ${DOC}. Si el documento cambió de `
      + 'forma, este guard dejó de mirar y su verde no significa nada.',
  );
  assert.ok(
    CON_CASILLAS.length >= 2,
    `🔴 GUARD CIEGO: ${CON_CASILLAS.length} entradas con casillas. Con menos de dos no hay `
      + 'población que juzgar, y un «ninguna miente» sería indistinguible de «no supe mirar». '
      + 'Si el documento dejó de usar casillas, este guard necesita otra señal — no un verde.',
  );
  // Lo que NO se juzga se dice, no se calla.
  const noMedibles = ENTRADAS.length - CON_CASILLAS.length;
  assert.ok(noMedibles >= 0);
  console.log(`      · entradas: ${ENTRADAS.length} · con casillas (juzgables): ${CON_CASILLAS.length}`
    + ` · en prosa (NO medibles por este guard): ${noMedibles}`);
});

test('SCRUM-758 · ✅ CONTROL POSITIVO: el detector CAZA una cabecera que miente (fabricada)', () => {
  // Sin esto, el verde de abajo no distingue «ninguna miente» de «mi detector no ve nada».
  const fabricada = { titulo: 'X — 🔴 SIN APLICAR en ninguna de las tres', marcadas: 2, sinMarcar: 1 };
  assert.ok(contradiccion(fabricada), '🔴 el detector NO ve una cabecera que miente');
  assert.match(contradiccion(fabricada), /MARCADA/);

  // Y DISCRIMINA: una que concuerda no se caza.
  assert.equal(contradiccion({ titulo: 'X — 🔴 SIN APLICAR en ninguna de las tres', marcadas: 0, sinMarcar: 3 }), null);
  assert.equal(contradiccion({ titulo: 'X — ✅ APLICADO en las TRES bases', marcadas: 3, sinMarcar: 0 }), null);
  assert.equal(contradiccion({ titulo: 'X — 🟡 PARCIAL', marcadas: 3, sinMarcar: 3 }), null);
  // Una cabecera sin vocabulario de cobertura no se juzga: no se inventa un veredicto.
  assert.equal(contradiccion({ titulo: 'X — notas sueltas', marcadas: 2, sinMarcar: 1 }), null);
});

test('SCRUM-758 · 🔴 NINGUNA cabecera del log contradice a su propio cuerpo', () => {
  const mentirosas = CON_CASILLAS
    .map((e) => ({ e, motivo: contradiccion(e) }))
    .filter((x) => x.motivo);

  assert.deepEqual(
    mentirosas.map((x) => `${DOC}:${x.e.linea} — ${x.motivo}`),
    [],
    '🔴 HAY UNA CABECERA QUE DICE LO CONTRARIO QUE SU CUERPO:\n    · '
      + mentirosas.map((x) => `${DOC}:${x.e.linea}\n        título: ${x.e.titulo.slice(0, 100)}\n        ${x.motivo}`).join('\n    · ')
      + '\n\n  Una línea así no es cosmética: la de :575 fabricó un ticket entero con un enunciado\n'
      + '  falso y una hipótesis equivocada sobre por qué producción estaba caída. Quien lea el\n'
      + '  título y no baje al cuerpo se lleva lo contrario de lo que pasó.\n\n'
      + '  Se arregla el TÍTULO para que diga lo que dicen las casillas — nunca al revés: las\n'
      + '  casillas llevan fecha, autor y verificación; el título es un resumen.',
  );
});

test('SCRUM-758 · ✅ CONTROL POSITIVO sobre el documento REAL: la entrada PARCIAL pasa', () => {
  // Si el guard saltara en TODAS, se habría roto por el otro lado. `SCRUM-195` tiene tres
  // casillas marcadas (paso 1, en las tres bases) y tres sin marcar (paso 2, en ninguna): su
  // «🟡 PARCIAL» es exactamente lo que dice su cuerpo, y tiene que pasar.
  const parcial = CON_CASILLAS.find((e) => /PARCIAL/i.test(e.titulo));
  assert.ok(parcial, '🔴 ya no existe la entrada PARCIAL: este control positivo se quedó sin sujeto');
  assert.ok(parcial.marcadas > 0 && parcial.sinMarcar > 0, 'y sigue siendo mixta');
  assert.equal(
    contradiccion(parcial), null,
    `🔴 el guard acusa a una entrada SANA (${DOC}:${parcial.linea}). Se ha roto por el otro lado.`,
  );
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA COBERTURA DECLARADA DEL LOG — que el propio documento diga qué NO ve
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-758 · el log DECLARA que no cubre migraciones de DATOS', () => {
  // Medido en este ticket: el aplicador oficial (`aplicar-sql-dev.mjs`) sólo ejecuta la lista
  // BLANCA de formas aditivas, así que RECHAZA todo DML por diseño. Una migración de datos se
  // aplica por otra vía, y esa vía no pasa por el aplicador que escribe aquí. Si el documento no
  // lo dice, aparenta una completitud que no tiene — y eso es lo que fabricó este ticket.
  assert.match(
    TEXTO, /NO CUBRE LAS MIGRACIONES DE DATOS/,
    `🔴 ${DOC} no declara su cobertura. Un log que aparenta completitud es peor que uno que dice `
      + 'qué no ve: quien lo lea entero seguirá sin saber que las migraciones de DATOS no pasan '
      + 'por aquí.',
  );
  assert.match(
    TEXTO, /lista blanca/i,
    '🔴 la declaración no nombra el MECANISMO (la lista blanca del aplicador). Sin el porqué es '
      + 'una frase bonita, y una frase bonita se borra en el primer refactor del documento.',
  );
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS MUTACIONES · las tres deshacen la entrega por una vía distinta
// ═════════════════════════════════════════════════════════════════════════════════════════

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // ① Vuelve la cabecera mentirosa, tal cual estaba. Es el defecto de este ticket.
    fichero: 'docs/MIGRATIONS_PENDING.md',
    de: '## LOTE ÚNICO · 9 columnas en 4 tablas (SCRUM-403 · A5 · E4 · SCRUM-195 · SCRUM-16/142) — 🟡 PARCIAL: ✅ APLICADO en staging y producción (10-ago-2026) · ⏳ pendiente en desarrollo',
    a: '## LOTE ÚNICO · 9 columnas en 4 tablas (SCRUM-403 · A5 · E4 · SCRUM-195 · SCRUM-16/142) — 🔴 SIN APLICAR en ninguna de las tres',
    cae: 'SCRUM-758 · 🔴 NINGUNA cabecera del log contradice a su propio cuerpo',
  },
  {
    // ② El log deja de declarar su cobertura y vuelve a aparentar completitud.
    fichero: 'docs/MIGRATIONS_PENDING.md',
    de: '> ## 🔴 ESTE LOG **NO CUBRE LAS MIGRACIONES DE DATOS** — SCRUM-758 (6-sep-2026)',
    a: '> ## 🔴 Nota sobre el aplicador — SCRUM-758 (6-sep-2026)',
    cae: 'SCRUM-758 · el log DECLARA que no cubre migraciones de DATOS',
  },
  {
    // ③ El detector deja de ver el caso «dice ninguna y hay marcadas». Sin esta mutación, el
    // verde del guard sobre el documento ya corregido no distinguiría «no miente» de «no miro».
    fichero: 'tests/scrum758-cabecera-no-miente.test.mjs',
    de: "  if (dice === 'ninguna' && e.marcadas > 0) {",
    a: '  if (false) {',
    cae: 'SCRUM-758 · ✅ CONTROL POSITIVO: el detector CAZA una cabecera que miente (fabricada)',
  },
];

test('SCRUM-758 · EL LECTOR OFICIAL me ve: las tres declaraciones, con sus cuatro campos', async () => {
  const { mutacionesDeclaradas } = await import('../scripts/meta-guard-mutaciones.mjs');
  const yo = fileURLToPath(import.meta.url);
  const vistas = mutacionesDeclaradas(fs.readFileSync(yo, 'utf8'), path.basename(yo));

  assert.equal(
    vistas.length, MUTACIONES_QUE_ME_TUMBAN.length,
    `🔴 declaro ${MUTACIONES_QUE_ME_TUMBAN.length} y el lector oficial ve ${vistas.length}.`,
  );
  assert.deepEqual(
    vistas.map((m) => ({ fichero: m.fichero, de: m.de, a: m.a, cae: m.cae })),
    MUTACIONES_QUE_ME_TUMBAN.map((m) => ({ fichero: m.fichero, de: m.de, a: m.a, cae: m.cae })),
    '🔴 el lector oficial lee algo distinto de lo que está escrito aquí',
  );
  for (const m of MUTACIONES_QUE_ME_TUMBAN) {
    assert.ok(
      fs.readFileSync(path.join(RAIZ, m.fichero), 'utf8').includes(m.de),
      `🔴 el ancla ya no está en ${m.fichero}: «${m.de.trim().slice(0, 70)}…»`,
    );
  }
});
