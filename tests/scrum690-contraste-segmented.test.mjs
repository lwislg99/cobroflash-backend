// tests/scrum690-contraste-segmented.test.mjs — SCRUM-690
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL LADO ACTIVO DE `.segmented` NO PUEDE DISTINGUIRSE CASI SÓLO POR LA TINTA
//
// Este ticket lo abrió una medición de SCRUM-689: al estilar las pestañas de clientes se midió el
// sistema del que heredaban y salió que **`--surface` y `--bg` son casi el mismo color**. El fondo
// de la pastilla activa daba **1,07:1** contra la barra — o sea, ninguna señal.
//
// VÍCTIMA HOY, en pantallas que ya usa un profesional. `.segmented` es el control «uno de N» de:
//   · el switch Producto | Servicio del catálogo   (`switchTipoArticulo.js`)
//   · el switch Empresa | Persona del cliente      (`switchFormaJuridica.js`, CONT-01)
// y en los dos el lado activo **cambia lo que hace el formulario**: esconde coste, margen y
// proveedor en uno; cambia qué campos se piden en el otro. Con sol en la pantalla o el brillo
// bajo, no ver qué lado está puesto no es un problema estético.
//
// ── LO QUE VIGILA ESTE FICHERO, Y LO QUE NO PUEDE VIGILAR ────────────────────────────────
// Vigila que las CUATRO señales estén declaradas y que los tokens no se cambien por valores
// sueltos. **No puede ver qué aspecto tiene la pantalla**: eso se midió en navegador y los
// números están en `docs/master/SCRUM-690.md`.
//
// 🔴 Y ÉSA ES LA LECCIÓN DEL TICKET ANTERIOR, QUE VALE PARA ÉSTE:
//    **una tanda verde no puede ver qué aspecto tiene una pantalla.**
//    En SCRUM-689 los tests estaban en verde con los rótulos solapados unos encima de otros. Lo
//    destapó una captura. Un guard de CSS comprueba que las reglas existan; que el resultado se
//    vea bien es otra pregunta, y se contesta mirando.
//
// Sin gate: lee ficheros. Ni BD, ni red, ni navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hojasDelDashboard } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Los DOS consumidores del componente, censados el 2-sep-2026 sobre `main`. */
const CONSUMIDORES = [
  'public/dashboard/js/switchTipoArticulo.js',   // Producto | Servicio (catálogo)
  'public/dashboard/js/switchFormaJuridica.js',  // Empresa | Persona (cliente)
];

function cssDelDashboard() {
  return hojasDelDashboard(RAIZ).map((h) => fs.readFileSync(h, 'utf8')).join('\n');
}

/** Reglas cuyo selector menciona el texto dado, sin comentarios. (Mismo criterio que SCRUM-689.) */
function reglasCuyoSelector(css, incluye) {
  const limpio = String(css).replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  for (const m of limpio.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1].includes(incluye)) out.push({ selector: m[1].trim(), cuerpo: m[2].trim() });
  }
  return out;
}

/**
 * El contraste WCAG entre dos colores `#rrggbb`. Vive aquí y no en el navegador para que el
 * CONTROL POSITIVO del medidor corra en la tanda: si esto no sabe separar un 17:1 de un 1,07:1,
 * ningún número que produzca significa nada.
 */
export function contraste(hexA, hexB) {
  const lum = (hex) => {
    const h = hex.replace('#', '');
    const v = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const [a, b] = [lum(hexA), lum(hexB)];
  return +(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2));
}

/** El valor de un token de `public/tokens.css`. */
function token(nombre) {
  const css = fs.readFileSync(path.join(RAIZ, 'public/tokens.css'), 'utf8');
  const m = new RegExp(`--${nombre}:\\s*([^;]+);`).exec(css);
  assert.ok(m, `🔴 el token --${nombre} ya no existe en tokens.css`);
  return m[1].trim();
}

// ═══ ① CONTROL POSITIVO DEL MEDIDOR ══════════════════════════════════════════════════════
//
// Lo pide el encargo con esas palabras: «si tu medidor no sabe distinguir un 17:1 de un 1,07:1,
// no mide nada». Se comprueba contra valores conocidos ANTES de usarlo para nada.

test('SCRUM-690 · 🔴 CONTROL POSITIVO: el medidor de contraste distingue de verdad', () => {
  assert.equal(contraste('#000000', '#ffffff'), 21, '🔴 el máximo teórico no sale 21: el medidor está roto.');
  assert.equal(contraste('#ffffff', '#ffffff'), 1, '🔴 dos colores idénticos no dan 1.');

  // Y sobre los tokens REALES, los dos números que abrieron este ticket.
  const alto = contraste(token('ink'), token('surface'));
  const bajo = contraste(token('surface'), token('bg'));
  assert.ok(alto > 15, `🔴 la tinta sobre la superficie debería ir muy sobrada de AA y da ${alto}.`);
  assert.ok(bajo < 1.2, `🔴 --surface contra --bg debería ser casi indistinguible y da ${bajo}.`);
  assert.ok(alto > bajo * 10,
    `🔴 el medidor no separa el caso bueno del malo: ${alto} vs ${bajo}. Un instrumento que no ` +
    'distingue eso no puede sostener ninguna afirmación sobre contraste.');
});

test('SCRUM-690 · 🔴 el defecto que abrió el ticket SIGUE SIENDO CIERTO sobre los tokens', () => {
  // No se «arregla» cambiando `--surface` ni `--bg`: eso repintaría el producto entero. El fondo
  // sigue valiendo 1,07:1 y por eso hacen falta las otras señales. Si algún día alguien separa
  // esos dos tokens, este test cae y hay que venir a decir que el motivo del ticket cambió.
  const fondo = contraste(token('surface'), token('bg'));
  assert.ok(fondo < 1.2,
    `🔴 --surface y --bg ya NO son casi el mismo color (${fondo}:1). Es buena noticia, pero ` +
    'invalida el motivo escrito de este ticket: revísalo antes de seguir fiándote de él.');
});

// ═══ ② EL COMPONENTE: CUATRO SEÑALES ═════════════════════════════════════════════════════

test('SCRUM-690 · 🔴 SUELO: el censo encuentra el componente en el CSS del dashboard', () => {
  const css = cssDelDashboard();
  assert.ok(css.length > 5000, `🔴 CENSO CIEGO: ${css.length} bytes de CSS.`);
  assert.ok(reglasCuyoSelector(css, '.segmented-option').length >= 3,
    '🔴 CENSO CIEGO: no encuentro las reglas de `.segmented-option`. Un cero aquí sería ceguera, ' +
    'no un hallazgo — y este ticket nace justo de un número mal leído.');
});

test('SCRUM-690 · el lado ACTIVO lleva las CUATRO señales', () => {
  const activo = reglasCuyoSelector(cssDelDashboard(), '.segmented-input:checked');
  assert.ok(activo.length > 0, '🔴 no hay regla para el lado activo del segmented.');
  const cuerpo = activo.map((r) => r.cuerpo).join(' ');

  for (const [prop, porQue] of [
    ['background', 'el fondo, que por sí solo da 1,07:1'],
    ['color', 'la tinta'],
    ['border-color', 'el BORDE — señal de FORMA, se ve sin distinguir el tono'],
    ['box-shadow', 'la ELEVACIÓN — la otra señal que no depende del color'],
  ]) {
    assert.match(cuerpo, new RegExp(`${prop}\\s*:`),
      `🔴 al lado activo le falta «${prop}» (${porQue}). Con menos de cuatro señales, quien no ` +
      'distinga el color no sabe qué lado está puesto — y aquí el lado cambia lo que hace el ' +
      'formulario: esconde coste y proveedor en el catálogo, cambia los campos en la ficha.');
  }
  assert.match(cuerpo, /var\(--shadow-md\)/,
    '🔴 la elevación no es `--shadow-md`. `--shadow-sm` es «Reposo» (4 % de opacidad) y era ' +
    'justamente lo que no se veía; el token de «Elevado» es el que separa la pastilla del fondo.');
});

test('SCRUM-690 · 🔴 el borde está RESERVADO en la base: el activo no da salto de layout', () => {
  const base = reglasCuyoSelector(cssDelDashboard(), '.segmented-option')
    .find((r) => r.selector === '.segmented-option');
  assert.ok(base, '🔴 no hay regla base para `.segmented-option`.');
  assert.match(base.cuerpo, /border:\s*1px solid transparent/,
    '🔴 el borde no está reservado con `transparent`, y eso rompe DOS cosas, las dos medidas:\n' +
    '   ① la regla del activo sólo declara `border-color`: sin el `width`/`style` de aquí, el ' +
    'borde computa 0px y LA SEÑAL DE FORMA DESAPARECE ENTERA — el guard de las cuatro señales ' +
    'seguiría verde porque la propiedad está escrita, pero no se pinta nada.\n' +
    '   ② y declarar el borde completo sólo en el activo da un salto de layout de 2 px al ' +
    'seleccionarlo (medido: 162 vs 160). Un control que se mueve al tocarlo se siente roto.');
});

test('SCRUM-690 · los colores salen de TOKENS, no de valores sueltos', () => {
  const reglas = reglasCuyoSelector(cssDelDashboard(), '.segmented');
  const cuerpos = reglas.map((r) => r.cuerpo).join(' ');
  const literales = [...cuerpos.matchAll(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g)].map((m) => m[0]);
  assert.deepEqual(literales, [],
    '🔴 HAY COLORES LITERALES EN EL COMPONENTE:\n    ' + literales.join('\n    ') +
    '\n\n  `DESIGN.md` es la única fuente de tokens. Un valor suelto elegido a ojo es deuda con ' +
    'apariencia de arreglo: el día que cambie la paleta, este control se queda con el color viejo.');
  assert.match(cuerpos, /var\(--/, '🔴 SUELO: no se usa ni un token; el detector miraría en vacío.');
});

// ═══ ③ LOS CONSUMIDORES — que un componente mejore no prueba que ellos mejoren ═══════════

test('SCRUM-690 · los DOS consumidores siguen usando el componente', () => {
  // «Mencionar no es hacer» aplicado al CSS: si un switch dejara de usar `.segmented`, arreglar el
  // componente no le llegaría, y este fichero seguiría en verde diciendo que todo está bien.
  for (const rel of CONSUMIDORES) {
    const src = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
    for (const clase of ['segmented', 'segmented-option', 'segmented-input']) {
      assert.ok(src.includes(`'${clase}'`) || src.includes(`"${clase}"`) || src.includes(`${clase}'`),
        `🔴 ${rel} ya no usa la clase «${clase}». El arreglo del componente no le llegaría, y este ` +
        'guard seguiría verde sobre un consumidor que se quedó fuera.');
    }
  }
});

test('SCRUM-690 · 🔴 SUELO del censo de consumidores: son EXACTAMENTE los que se declaran', () => {
  // Si aparece un tercero, tiene que constar: el arreglo le afecta y su pantalla no se ha mirado.
  const dir = path.join(RAIZ, 'public/dashboard/js');
  const usan = fs.readdirSync(dir).filter((f) => f.endsWith('.js'))
    .filter((f) => /class\s*=\s*['"]segmented|className\s*=\s*['"][^'"]*segmented/.test(fs.readFileSync(path.join(dir, f), 'utf8')))
    .map((f) => `public/dashboard/js/${f}`)
    .sort();
  assert.ok(usan.length > 0, '🔴 CENSO CIEGO: cero consumidores. Los hay — el censo no sabe mirar.');
  assert.deepEqual(usan, [...CONSUMIDORES].sort(),
    '🔴 LA LISTA DE CONSUMIDORES DE `.segmented` HA CAMBIADO:\n    ' + usan.join('\n    ') +
    '\n\n  Si ha entrado uno nuevo, su pantalla NO se ha medido en navegador y hay que hacerlo ' +
    'antes de darlo por bueno. Si ha salido uno, quítalo de `CONSUMIDORES` con su motivo.');
});

// ═══ ④ CONTROL NEGATIVO ══════════════════════════════════════════════════════════════════

test('SCRUM-690 · 🔴 NEGATIVO: tocar un COMENTARIO del CSS no tumba nada', () => {
  const conRegla = '.segmented-option:has(.segmented-input:checked) { border-color: var(--border); }';
  const soloComentario = '/* .segmented-option:has(.segmented-input:checked) — pendiente, ver SCRUM-690 */';

  assert.equal(reglasCuyoSelector(conRegla, '.segmented-input:checked').length, 1,
    '🔴 SUELO del negativo: el detector no ve una regla de verdad.');
  assert.equal(reglasCuyoSelector(soloComentario, '.segmented-input:checked').length, 0,
    '🔴 un comentario se está contando como CSS: con eso, borrar el estilo y dejar la explicación ' +
    'pasaría en verde. Y este fichero y el bloque de `styles.css` nombran el selector en prosa.');
  assert.equal(reglasCuyoSelector(conRegla + '\n' + soloComentario, '.segmented-input:checked').length, 1,
    '🔴 añadir un comentario ha cambiado el recuento de reglas.');
});
