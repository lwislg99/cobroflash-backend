// tests/scrum720-marcadores-en-lo-pintado.test.mjs — SCRUM-720 / SCRUM-720c
//
// LA VÍCTIMA: el profesional que abre el parte en PRODUCCIÓN y ve corchetes donde debería haber
// rótulos. El fundador lo abrió el 4-sep-2026 y salían VEINTISÉIS.
//
// ── EL DEFECTO DEL CONTROL, que es lo que este fichero arregla ──────────────────────────────
// El censo de SCRUM-402 decía **1** mientras la pantalla enseñaba **26**, y las dos cifras eran
// correctas: ese censo cuenta LITERALES con la marca en el fuente, y esta vista la factoriza en
// una constante (`var M`) que concatena veintiséis veces. Un número honesto sobre el fichero y
// una pantalla llena de corchetes.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔒 QUÉ CUBRE ESTE GUARD Y QUÉ NO — dicho aquí y REPETIDO EN SU SALIDA
//
// Un guard cuyo nombre promete más de lo que cubre es peor que uno que no existe: quien lo lea
// dejará de mirar donde el guard no llega. La primera versión medía SÓLO lo que `renderParte`
// pinta, y eso dejaba fuera cinco textos —el pad de firma, el error al cargar y la propuesta del
// dictado— más los cuatro de otra pantalla. Estaba declarado en prosa, pero el nombre seguía
// prometiendo «lo pintado».
//
// AHORA SON DOS CAPAS, y la segunda cierra ese hueco:
//
//   ① LO QUE SE PINTA — la pantalla ejecutada en tres estados (borrador, firmado, sin líneas) y
//      los marcadores contados en el `innerHTML`. Es la capa que prueba que el rótulo LLEGA.
//   ② EL CATÁLOGO ENTERO — `window.PARTE_TEXTOS` (27 textos) y `TEXTOS_ASIGNADOS` (5), que son
//      los objetos de los que salen TODOS los rótulos de las dos pantallas, incluidos los de
//      caminos que este banco no sabe pintar.
//
// LO QUE SIGUE SIN CUBRIRSE, sin adornos: la capa ② prueba que el CATÁLOGO está limpio, no que
// cada uno de esos textos llegue de verdad a una pantalla. Un texto declarado y nunca pintado
// pasaría las dos capas.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const RAIZ = path.resolve(import.meta.dirname, '..');
const JS = path.join(RAIZ, 'public', 'dashboard', 'js');
const MARCADOR = '[PENDIENTE microcopy oficial]';

/** Lo que este guard vigila. Vive en una constante para que SALGA EN EL ROJO, no sólo aquí. */
const COBERTURA = [
  '① PINTADO   · parteDetailView.js en 3 estados: borrador, firmado, sin líneas',
  '② CATÁLOGO  · parteDetailView.js → window.PARTE_TEXTOS (todos sus rótulos)',
  '② CATÁLOGO  · jobAsignados.js    → TEXTOS_ASIGNADOS (otra pantalla, sí llega)',
  'NO CUBRE    · que cada texto del catálogo se PINTE de verdad (eso lo mira SCRUM-402)',
].join('\n    ');

/** El DOM de mentira mínimo. `innerHTML` se guarda tal cual se pinta. */
function montar(fichero) {
  const contenedor = { innerHTML: '', hijos: [] };
  const ctx = {
    console,
    window: null,
    document: {
      createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, innerHTML: '' }),
    },
    Date, Array, Object, String, Number, JSON,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(JS, fichero), 'utf8'), ctx, { filename: fichero });
  return { ctx, contenedor };
}

const PARTE = Object.freeze({
  id: 7,
  numero: 'PT-2026-001',
  clienteNombre: 'Comunidad Los Olivos',
  fecha: '2026-09-02T08:00:00.000Z',
  obra: 'C/ Mayor 3, portal B',
  referencia: 'REF-778',
  entrada: '09:15',
  salida: '11:40',
  desplazamientos: 1,
  kilometros: 12.5,
  tecnicos: ['Israel', 'Miguel', 'Jesús L.'],
  tipo: 'reparacion_asistencia',
  lineas: [
    { bloque: 'mano_obra', unds: 2.5, descripcion: 'Revisión de caldera' },
    { bloque: 'materiales', unds: 1, descripcion: 'Presostato' },
  ],
  notas: 'Se cambió el presostato.',
  estado: 'borrador',
  puedeEditarContenido: { ok: true, motivo: null },
  puedeEditarPrecios: { ok: true, motivo: null },
});

const ESTADOS = Object.freeze([
  ['borrador', PARTE],
  ['firmado', { ...PARTE, estado: 'firmado', puedeEditarContenido: { ok: false, motivo: 'firmado' } }],
  ['sin líneas', { ...PARTE, lineas: [] }],
]);

function pintado(parte) {
  const { ctx, contenedor } = montar('parteDetailView.js');
  assert.equal(typeof ctx.renderParte, 'function', '🔴 la vista no publica `renderParte`');
  assert.equal(ctx.renderParte(contenedor, parte), true, '🔴 la vista se negó a pintar');
  return contenedor.innerHTML;
}
const cuenta = (html) => (html.split(MARCADOR).length - 1);

/** El catálogo de textos de una pantalla, tal como ella lo publica. */
function catalogo(fichero, clave) {
  if (fichero === 'jobAsignados.js') {
    const front = {};
    new Function('window', fs.readFileSync(path.join(JS, fichero), 'utf8'))(front);
    return front[clave] || {};
  }
  return montar(fichero).ctx[clave] || {};
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// SUELO
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-720 · 🔴 SUELO: la pantalla PINTA y los catálogos TIENEN textos', () => {
  const html = pintado(PARTE);
  assert.ok(html.length > 500,
    `🔴 CIEGO: la pantalla pintó ${html.length} caracteres. Contar marcadores sobre una cadena `
    + 'casi vacía daría cero y parecería una buena noticia.');
  assert.ok(html.includes('Revisión de caldera'), '🔴 no pintó la línea de mano de obra');
  assert.ok(html.includes('data-parte-bloque="materiales"'), '🔴 no pintó el bloque de materiales');

  const parte = catalogo('parteDetailView.js', 'PARTE_TEXTOS');
  const asig = catalogo('jobAsignados.js', 'TEXTOS_ASIGNADOS');
  assert.ok(Object.keys(parte).length >= 20,
    `🔴 CIEGO: sólo ${Object.keys(parte).length} textos en PARTE_TEXTOS y hay 27 medidos.`);
  assert.ok(Object.keys(asig).length >= 4,
    `🔴 CIEGO: sólo ${Object.keys(asig).length} textos en TEXTOS_ASIGNADOS y hay 5 medidos.`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ① LO QUE SE PINTA
// ═══════════════════════════════════════════════════════════════════════════════════════════

// Medido el 4-sep-2026, tras firmar el fundador los 31 rótulos de estas dos pantallas.
const PINTADOS = 0;

test('SCRUM-720 · 🔴 ① CERO marcadores en el DOM, en LOS TRES estados', () => {
  const porEstado = ESTADOS.map(([nombre, parte]) => {
    const html = pintado(parte);
    return { nombre, n: cuenta(html), html };
  });
  const total = porEstado.reduce((a, e) => a + e.n, 0);

  // Un cero en UN estado no es un cero: con el parte en borrador ya salía 0 antes de firmar nada.
  assert.equal(porEstado.length, 3, '🔴 se han dejado de medir los tres estados');

  if (total !== PINTADOS) {
    const detalle = porEstado.map((e) => `${e.nombre}: ${e.n}`).join(' · ');
    const trozos = porEstado.flatMap((e) => e.html.split(MARCADOR).slice(1)
      .map((t) => `[${e.nombre}] ` + t.slice(0, 60).replace(/<[^>]*>/g, ' ').trim()));
    assert.fail(
      `🔴 MARCADORES EN PANTALLA: ${total} (el tope es ${PINTADOS}). Por estado → ${detalle}\n`
      + '    Esto es lo que el profesional LEE. El texto nuevo no se inventa: se propone al '
      + 'fundador (regla 30) y se registra en `docs/microcopy/`.\n    ' + trozos.join('\n    ')
      + `\n\n    COBERTURA DE ESTE GUARD:\n    ${COBERTURA}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ② EL CATÁLOGO ENTERO — la capa que cierra el hueco de la anterior
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-720c · 🔴 ② NINGÚN texto del catálogo lleva marcador, ni los que el banco no pinta', () => {
  const sucios = [];
  for (const [fichero, clave] of [
    ['parteDetailView.js', 'PARTE_TEXTOS'],
    ['jobAsignados.js', 'TEXTOS_ASIGNADOS'],
  ]) {
    for (const [k, v] of Object.entries(catalogo(fichero, clave))) {
      if (typeof v === 'string' && v.includes(MARCADOR)) sucios.push(`${fichero} → ${k}: ${v}`);
    }
  }
  assert.deepEqual(sucios, [],
    '🔴 QUEDAN TEXTOS SIN FIRMAR EN EL CATÁLOGO. Éstos NO los caza la capa ①: viven en caminos que '
    + 'este banco no sabe pintar —el pad de firma, el error al cargar, la propuesta del dictado— o '
    + `en otra pantalla.\n    ${sucios.join('\n    ')}\n\n    COBERTURA DE ESTE GUARD:\n    ${COBERTURA}`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL MECANISMO
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-720 · 🔴 el MECANISMO sigue vivo: las constantes NO se retiran', () => {
  // Vaciarlo no es retirarlo. Tiene que seguir existiendo para el rótulo que alguien añada mañana
  // sin firmar — si desaparece, el próximo texto sin aprobar llega a pantalla sin marca y nadie
  // lo ve hasta que lo lee un cliente.
  for (const fichero of ['parteDetailView.js', 'jobAsignados.js']) {
    const fuente = fs.readFileSync(path.join(JS, fichero), 'utf8');
    assert.ok(fuente.includes(MARCADOR),
      `🔴 se ha retirado el marcador de ${fichero}. El mecanismo se VACÍA, no se quita.`);
  }
});

test('SCRUM-720c · este guard DICE qué cubre y qué no', () => {
  // Que la cobertura viva en una constante y no sólo en un comentario es lo que hace que salga en
  // el rojo. Un guard que promete de más hace que quien lo lea deje de mirar donde no llega.
  assert.match(COBERTURA, /NO CUBRE/,
    '🔴 la cobertura ha dejado de declarar su hueco. Si algún día lo cubre entero, se dice; '
    + 'mientras tanto, el hueco se nombra.');
  assert.match(COBERTURA, /① PINTADO/);
  assert.match(COBERTURA, /② CATÁLOGO/);
});
