// tests/scrum514-aprobado-y-aplicado.test.mjs — SCRUM-514
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UN TEXTO APROBADO QUE NO LLEGA A LA PANTALLA ES UNA DECISIÓN QUE NO SIRVIÓ DE NADA.
//
// El ticket nació porque nadie sabía QUÉ quedaba por aplicar: la respuesta exigía cruzar a mano
// `docs/MICROCOPY_APROBADA_SIN_APLICAR.md` con el código, y ese cruce caducaba el día siguiente.
// Medido el 3-sep-2026: **no quedaba ni un texto aprobado sin aplicar** fuera de lo aparcado a
// propósito. Este guard es lo que impide que vuelva a hacer falta medirlo a mano.
//
// 🔴 LO QUE VIGILA, y es lo contrario de lo que vigila SCRUM-402:
//   · 402 mira que no se PINTE un marcador sin aprobar.
//   · éste mira que todo lo APROBADO esté pintado.
// Son las dos mitades de la regla 30, y hasta hoy sólo existía la primera: se podía aprobar un
// texto, no aplicarlo nunca, y ninguna tanda decía nada. Es exactamente lo que pasó durante tres
// semanas con los rótulos del 17-ago.
//
// ⚠️ LA FUENTE SON LOS DOS SITIOS DONDE VIVEN LAS APROBACIONES, y nada más: ni este comentario,
// ni un ticket, ni un informe. Desde SCRUM-709 son `docs/microcopy/` (las nuevas, una por fichero)
// y el registro congelado; se leen con SU lector —`_microcopy-aprobada.mjs`— y no con un segundo
// barrido propio. Si cambian, este guard cambia con ellos sin que nadie lo actualice: la lista NO
// se copia aquí.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aprobacionesDeMicrocopy } from './_microcopy-aprobada.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Los textos aprobados, DE LOS DOS SITIOS DONDE VIVEN.
 *
 * 🔴 SCRUM-709 partió la fuente en dos y este guard nació leyendo sólo una:
 *   · `docs/microcopy/` — una aprobación, un fichero. Donde van las NUEVAS.
 *   · `docs/MICROCOPY_APROBADA_SIN_APLICAR.md` — el registro CONGELADO hasta el 3-sep.
 *
 * Leer sólo el congelado habría sido exactamente la ceguera que `_microcopy-aprobada.mjs` avisa:
 * un texto aprobado HOY y no aplicado no lo vería nadie, y este guard existe justo para eso. Se
 * usa SU lector y no se escribe un segundo: dos barridos de lo mismo divergen.
 *
 * De cada sitio se saca lo que ese sitio usa para el texto aprobado:
 *   · el registro → la ÚLTIMA columna de sus tablas;
 *   · un fichero de aprobación → las CITAS bajo el encabezado «Texto aprobado».
 * Las citas se limitan a esa sección a propósito: el registro está lleno de notas en `>` que no
 * son copy, y meterlas convertiría el guard en ruido.
 *
 * Se descarta lo que no es copy —rutas, identificadores en mayúsculas, fragmentos cortos—. El
 * filtro es por FORMA, nunca por contenido: excluir un texto por lo que dice sería decidir por el
 * fundador.
 */
function textosAprobados() {
  const out = new Set();
  for (const ap of aprobacionesDeMicrocopy()) {
    if (ap.origen === 'fichero') { for (const t of citasDeTextoAprobado(ap.texto)) out.add(t); continue; }
    for (const t of celdasDeTabla(ap.texto)) out.add(t);
  }
  return [...out];
}

/** Las citas `> …` que van bajo un encabezado «Texto aprobado». */
function citasDeTextoAprobado(md) {
  const out = [];
  let dentro = false;
  for (const linea of md.split('\n')) {
    if (/^#{1,6}\s/.test(linea)) { dentro = /texto\s+aprobado/i.test(linea); continue; }
    if (!dentro) continue;
    const m = /^>\s?(.+)$/.exec(linea.trim());
    if (m && m[1].trim().length >= 4) out.push(m[1].trim());
  }
  return out;
}

/** La última columna de las tablas del registro congelado. */
function celdasDeTabla(md) {
  const out = new Set();
  for (const linea of md.split('\n')) {
    const t0 = linea.trim();
    if (!t0.startsWith('|') || /^\|\s*-+/.test(t0)) continue;
    const celdas = t0.split('|').map((c) => c.trim()).filter(Boolean);
    const ultima = celdas[celdas.length - 1] || '';
    for (const m of ultima.matchAll(/`([^`]+)`/g)) {
      const t = m[1].trim();
      if (t.length < 4) continue;
      if (/^[\w.\-/]+\.(js|ts|md)/.test(t)) continue;      // rutas de fichero
      if (/^[A-Z_]{4,}$/.test(t)) continue;                 // constantes
      if (!/[ áéíóúñÁÉÍÓÚÑ]/.test(t) && t.length < 8) continue;
      // 🔴 Las PLANTILLAS se quedan fuera del cruce, y no es una excepción de conveniencia: un
      // texto como `{N} facturas` NUNCA aparece literal en el código porque el código lo
      // COMPONE (`n + ' facturas'`). Buscarlo tal cual daría un rojo permanente por algo que sí
      // está aplicado — medido: `libroRegistroView.js:49`. Lo que el guard puede afirmar de una
      // plantilla es que su parte fija esté, y eso ya lo cubre el resto de la fila.
      if (/{[^}]+}/.test(t)) continue;
      out.add(t);
    }
  }
  return [...out];
}

/** Todo el código donde puede vivir un texto de pantalla. */
function corpus() {
  const ficheros = [];
  const walk = (d, ext) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p, ext); continue; }
      if (ext.test(e.name)) ficheros.push(p);
    }
  };
  walk(path.join(RAIZ, 'public'), /\.(js|ts|html)$/);
  walk(path.join(RAIZ, 'src'), /\.ts$/);
  return { texto: ficheros.map((f) => fs.readFileSync(f, 'utf8')).join('\n'), cuantos: ficheros.length };
}

/**
 * 🔴 LO QUE SE SABE QUE NO ESTÁ APLICADO, CON SU MOTIVO Y QUIÉN LO DESBLOQUEA.
 *
 * No es una lista de perdón: es deuda declarada. Cada entrada dice por qué no se aplica y qué
 * tiene que pasar para que salga de aquí. Una excepción sin eso vuelve a ser el defecto que este
 * ticket cierra — un texto aprobado que nadie aplica y del que nadie se acuerda.
 */
const APARCADOS = [
  {
    texto: 'Modo no reconocido',
    motivo: 'RESPALDO del modo de emisión (`settingsView.js:213`). Aparcado por la REGLA 26: el '
      + 'texto que explica qué emite una cuenta toca claims fiscales y se responde sólo con el '
      + 'guion H2. Lo desbloquea el fundador, no una sesión.',
  },
  {
    texto: 'No hemos podido identificar qué emite esta cuenta. Escríbenos antes de emitir nada.',
    motivo: 'La otra mitad del mismo respaldo (`settingsView.js:219`). Mismo motivo y mismo '
      + 'desbloqueo: regla 26.',
  },
];

// ═══ ① SUELO ═════════════════════════════════════════════════════════════════════════════

test('SCRUM-514 · SUELO: la fuente se lee y tiene textos de sobra', () => {
  const t = textosAprobados();
  assert.ok(t.length >= 60,
    `🔴 CIEGO: sólo he extraído ${t.length} textos aprobados de los DOS sitios donde viven. Todo `
    + 'lo que diga este fichero se apoya en esa población: con menos, un «todo aplicado» no '
    + 'significa nada. ¿Ha cambiado el formato de las tablas o el de `docs/microcopy/`?');
  const { cuantos } = corpus();
  assert.ok(cuantos >= 200,
    `🔴 CIEGO: sólo he barrido ${cuantos} ficheros de código. Un texto «no encontrado» podría ser `
    + 'que no lo he buscado bien.');
});

test('SCRUM-514 · SUELO: el cruce sabe decir SÍ y sabe decir NO', () => {
  // Sin esto, un «cero sin aplicar» podría ser un corpus vacío que lo contiene todo o nada.
  const { texto } = corpus();
  assert.equal(texto.includes('Volver a generar el PDF'), true,
    '🔴 el cruce no encuentra un texto que SÍ está aplicado: no sabría distinguir.');
  assert.equal(texto.includes('Texto que nadie ha aprobado jamas 9x7'), false,
    '🔴 el cruce encuentra un texto inventado: está diciendo que sí a todo.');
});

// ═══ ② LO QUE VIGILA ═════════════════════════════════════════════════════════════════════

test('SCRUM-514 · 🔴 TODO texto APROBADO está aplicado (salvo lo aparcado, con su motivo)', () => {
  const { texto } = corpus();
  const aparcados = new Set(APARCADOS.map((a) => a.texto));
  const sinAplicar = textosAprobados()
    .filter((t) => !texto.includes(t))
    .filter((t) => !aparcados.has(t));

  assert.deepEqual(sinAplicar, [],
    '🔴 HAY TEXTO APROBADO QUE NO LLEGA A LA PANTALLA:\n    '
    + sinAplicar.map((t) => JSON.stringify(t)).join('\n    ')
    + `\n\n  El fundador lo firmó y un profesional no lo está viendo. O se aplica —copiándolo de `
    + 'la aprobación LITERAL, con sus tildes y su «…» de un solo carácter— o se aparca AQUÍ con su '
    + 'motivo y quién lo desbloquea. Lo que no vale es dejarlo sin decidir: eso es lo que estuvo '
    + 'tres semanas pasando.');
});

test('SCRUM-514 · 🔴 cada APARCADO sigue sin aplicar, y lleva su motivo', () => {
  // Una excepción que sobrevive al motivo que la justificaba parece una decisión y ya no protege
  // nada (SCRUM-450). Si el texto SE APLICA, la entrada tiene que salir de aquí.
  const { texto } = corpus();
  for (const a of APARCADOS) {
    assert.ok(a.motivo && a.motivo.length > 60,
      `🔴 el aparcado «${a.texto}» no lleva motivo escrito, o es demasiado corto para revisarlo.`);
    assert.equal(texto.includes(a.texto), false,
      `🔴 «${a.texto}» YA ESTÁ APLICADO, así que esta excepción sobra: bórrala de \`APARCADOS\` `
      + '(no la dejes «por si acaso»: una lista que no se limpia deja de leerse).');
  }
  assert.ok(APARCADOS.length > 0,
    '🔴 la lista de aparcados está vacía. Si de verdad no queda ninguno, este test sobra y se '
    + 'retira A MANO diciéndolo; no se deja una lista vacía por simetría.');
});

// ═══ ③ CONTROL NEGATIVO ══════════════════════════════════════════════════════════════════

test('SCRUM-514 · CONTROL NEGATIVO: un texto NO aprobado no entra por estar en el código', () => {
  // El guard mira en una sola dirección: de la fuente al código. Que una frase exista en el
  // producto no la convierte en aprobada — para eso está SCRUM-402, que mira la otra mitad.
  const aprobados = textosAprobados();
  // Medido: este texto existe en el código y NO en la fuente (comprobado con grep antes de
  // elegirlo; el primero que probé sí estaba en la fuente y el control no probaba nada).
  assert.equal(aprobados.includes('Sin líneas.'), false,
    '🔴 un texto que sólo vive en el código aparece como «aprobado»: el extractor está leyendo '
    + 'algo que no son las tablas de la fuente.');
});

test('SCRUM-514 · CONTROL NEGATIVO: el extractor no se traga rutas ni constantes', () => {
  const t = textosAprobados();
  const basura = t.filter((x) => /^[A-Z_]{4,}$/.test(x) || /\.(js|ts|md)$/.test(x));
  assert.deepEqual(basura, [],
    `🔴 el extractor ha metido cosas que no son copy: ${basura.join(', ')}. Con ruido dentro, el `
    + 'guard acabaría rojo por un nombre de fichero y alguien lo apagaría.');
});
