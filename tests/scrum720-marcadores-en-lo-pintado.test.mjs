// tests/scrum720-marcadores-en-lo-pintado.test.mjs — SCRUM-720
//
// LA VÍCTIMA: el profesional que abre el parte en PRODUCCIÓN y ve veintiséis `[PENDIENTE microcopy
// oficial]` en su pantalla.
//
// ── EL DEFECTO DEL CONTROL, QUE ES LO QUE HAY QUE ARREGLAR AQUÍ ─────────────────────────────
// El censo de SCRUM-402 decía **1** mientras la pantalla enseñaba **26**, y las dos cifras eran
// correctas: ese censo cuenta LITERALES con la marca en el fuente, y esta vista la factoriza en
// una constante (`var M`) que luego concatena veintiséis veces. Un número honesto sobre el fichero
// y una pantalla llena de corchetes.
//
// Así que este guard no mira el fuente: **mira lo que la vista PINTA**. Se ejecuta la pantalla en
// un DOM de mentira —el mismo banco que usa SCRUM-652c, sin dependencias nuevas (regla 36)— y se
// cuentan los marcadores en el `innerHTML` resultante.
//
// 🔴 EL TRINQUETE NO ES «CERO» PORQUE HOY NO ES CERO, y decirlo importa: el fundador firmó 21
// rótulos y quedan DIEZ sin firmar, listados en `docs/microcopy/`. Poner 0 aquí sería pedir que
// alguien invente esos diez textos (regla 30). El número BAJA cuando se firmen, y no puede subir.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const RAIZ = path.resolve(import.meta.dirname, '..');
const JS = path.join(RAIZ, 'public', 'dashboard', 'js');
const MARCADOR = '[PENDIENTE microcopy oficial]';

/** El DOM de mentira mínimo para esta pantalla. `innerHTML` se guarda tal cual se pinta. */
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

/** Lo que la pantalla PINTA para un parte dado. */
function pintado(parte) {
  const { ctx, contenedor } = montar('parteDetailView.js');
  assert.equal(typeof ctx.renderParte, 'function', '🔴 la vista no publica `renderParte`');
  assert.equal(ctx.renderParte(contenedor, parte), true, '🔴 la vista se negó a pintar');
  return contenedor.innerHTML;
}

const cuenta = (html) => (html.split(MARCADOR).length - 1);

// ═══════════════════════════════════════════════════════════════════════════════════════════
// SUELO — si la pantalla no pintara nada, «cero marcadores» sería ceguera
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-720 · 🔴 SUELO: la pantalla PINTA de verdad antes de contar nada', () => {
  const html = pintado(PARTE);
  assert.ok(html.length > 500,
    `🔴 CIEGO: la pantalla ha pintado ${html.length} caracteres. Contar marcadores sobre una `
    + 'cadena vacía daría cero y parecería una buena noticia.');
  // Y pinta CONTENIDO de verdad, no un esqueleto: los dos bloques y una línea real.
  assert.ok(html.includes('Revisión de caldera'), '🔴 no ha pintado la línea de mano de obra');
  assert.ok(html.includes('data-parte-bloque="materiales"'), '🔴 no ha pintado el bloque de materiales');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LO QUE DECIDE: los marcadores que LLEGAN A LA PANTALLA
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * Los estados que este banco SÍ alcanza. Se cuentan los tres, no sólo el fácil: con el parte en
 * borrador salen 0 marcadores y quedarse ahí sería un cero de mentira.
 */
const ESTADOS = Object.freeze([
  ['borrador', PARTE],
  ['firmado', { ...PARTE, estado: 'firmado', puedeEditarContenido: { ok: false, motivo: 'firmado' } }],
  ['sin líneas', { ...PARTE, lineas: [] }],
]);

// Medido el 4-sep-2026 sobre esos tres estados, tras firmar el fundador 21 rótulos.
// Es «Firmado. El contenido ya no se toca.», que sigue sin firma.
const MARCADORES_PINTADOS = 1;

// ⚠️ LO QUE ESTE BANCO NO ALCANZA, DICHO AQUÍ Y NO DESCUBIERTO EN PRODUCCIÓN: de los diez textos
// que quedan sin firmar, cinco viven en caminos que no se pintan con `renderParte` —el pad de
// firma, el aviso de error al cargar y la propuesta del dictado— y otros cuatro están en
// `jobAsignados.js`, que es otra pantalla. Este trinquete NO los vigila. Están listados con su
// literal en `docs/microcopy/2026-09-04-SCRUM-720-rotulos-del-parte.md`.
test('SCRUM-720 · 🔴 los marcadores que se PINTAN no suben, y el rojo los nombra', () => {
  let n = 0;
  let html = '';
  for (const [, parte] of ESTADOS) {
    const trozo = pintado(parte);
    html += trozo;
    n += cuenta(trozo);
  }

  if (n > MARCADORES_PINTADOS) {
    const trozos = html.split(MARCADOR).slice(1)
      .map((t) => t.slice(0, 60).replace(/<[^>]*>/g, ' ').trim());
    assert.fail(
      `🔴 HAN SUBIDO LOS MARCADORES EN PANTALLA: ${n} (el tope es ${MARCADORES_PINTADOS}).\n`
      + '    Esto es lo que el profesional LEE, no una cuenta sobre el fichero. El texto nuevo no '
      + 'se inventa: se propone al fundador (regla 30) y se aplica con su registro en '
      + '`docs/microcopy/`.\n    ' + trozos.join('\n    '));
  }
  if (n < MARCADORES_PINTADOS) {
    assert.fail(
      `✅ han bajado, que es la dirección buena: ${n} < ${MARCADORES_PINTADOS}. Baja el tope en este `
      + 'mismo commit y anota qué se firmó. Un trinquete que sólo sabe subir deja de significar algo.');
  }
  assert.equal(n, MARCADORES_PINTADOS);
});

test('SCRUM-720 · ✅ los rótulos FIRMADOS se pintan limpios, uno por uno', () => {
  const html = pintado(PARTE);
  // Una muestra de los 21, la que se ve sí o sí con este parte. Si alguno volviera a salir
  // marcado, el `includes` del marcador pegado delante lo caza.
  const FIRMADOS = [
    'Dirección de la obra', 'REF', 'Entrada', 'Salida', 'Desplazamiento', 'Kilómetros',
    'Técnicos', 'Mano de obra', 'Materiales', 'UNDS', 'Notas', 'Añadir línea',
    'Dicta lo que has hecho', 'Ordenar en líneas',
  ];
  const marcados = FIRMADOS.filter((t) => html.includes(MARCADOR + ' ' + t));
  assert.deepEqual(marcados, [],
    `🔴 rótulos FIRMADOS que han vuelto a salir con corchetes: ${JSON.stringify(marcados)}`);

  const ausentes = FIRMADOS.filter((t) => !html.includes(t));
  assert.deepEqual(ausentes, [],
    `🔴 rótulos firmados que ya no se pintan: ${JSON.stringify(ausentes)}. Aplicar la microcopy no `
    + 'puede llevarse el rótulo por delante.');
});

test('SCRUM-720 · 🔴 el MECANISMO sigue vivo: la constante no se retiró', () => {
  // Vaciarlo no es retirarlo. Tiene que seguir existiendo para el rótulo que alguien añada mañana
  // sin firmar — si desaparece, el siguiente texto sin aprobar entra en pantalla sin marca y nadie
  // lo ve hasta que lo lee un cliente.
  const fuente = fs.readFileSync(path.join(JS, 'parteDetailView.js'), 'utf8');
  assert.ok(fuente.includes(MARCADOR),
    '🔴 se ha retirado el marcador de la pantalla del parte. El mecanismo se VACÍA, no se quita.');
  const asignados = fs.readFileSync(path.join(JS, 'jobAsignados.js'), 'utf8');
  assert.ok(asignados.includes(MARCADOR),
    '🔴 se ha retirado el marcador del selector de quién ejecuta.');
});
