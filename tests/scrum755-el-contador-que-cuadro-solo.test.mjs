// tests/scrum755-el-contador-que-cuadro-solo.test.mjs — SCRUM-755
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UN CONTADOR QUE PUEDE DESINCRONIZARSE Y VOLVER A CUADRAR SOLO NO ES UN CONTADOR
//
// ── LO QUE PASÓ ─────────────────────────────────────────────────────────────────────────
// `INV_SIN_APROBAR` valía 1. SCRUM-648 fase B estrenó su ranura de microcopy SIN SUBIRLO, así
// que durante un día el contador DECÍA 1 HABIENDO 2. Al firmarse aquel rótulo y retirarse su
// marcador, volvió a haber 1 — y el contador quedó correcto **solo**.
//
// 🔴 EL FINAL FELIZ ES EL PROBLEMA: nunca detectó nada. Estuvo equivocado un día y volvió a
// acertar por coincidencia. Si nadie hubiera firmado, seguiría diciendo 1 con 2 marcadores en
// pantalla y NADA lo habría dicho.
//
// ── ¿SE PODÍA DERIVAR EN VEZ DE RECORDARSE? NO, Y ESTÁ MEDIDO ───────────────────────────
// Era la primera pregunta, y la respuesta honesta es que no, por dos motivos MEDIDOS y no
// razonados:
//
//   1. **Son unidades distintas.** El contador cuenta RANURAS (textos pendientes de firma); el
//      árbol da SITIOS DE LLAMADA. `quotesView.js` pinta el mismo rótulo pendiente en varias
//      líneas y su contador dice **una** ranura, correctamente. En `productsView.js` pasa lo
//      mismo con su respaldo. Derivar el contador de los sitios daría otro número y ROMPERÍA
//      lo que hoy está bien. El desglose por fichero, con su hora, está en el censo de abajo.
//   2. **Hay ranuras SIN marcador en pantalla**, por decisión de cada ticket
//      (`filtroClientes.js` declara 7 y no pinta ninguno; `jobDetailView.js`, 2 y ninguno).
//      Eso no está en el árbol: no hay nada que leer.
//
// Así que el contador se queda, y lo que se construye es lo de la obligación 2: que ESTRENAR
// UNA RANURA CON MARCADOR sin decirlo ponga algo en rojo. Antes no ponía nada — está medido
// abajo, en el ticket, con la suite entera en verde tras inyectar una ranura nueva.
//
// ── QUÉ CUBRE Y QUÉ NO ──────────────────────────────────────────────────────────────────
// ✅ Cubre: cualquier ranura NUEVA que pinte el marcador, en CUALQUIER fichero del panel —
//    también en los que no declaran contador ninguno, que son la mayoría de los que lo pintan.
// 🔴 NO cubre: una ranura pendiente que nazca SIN marcador. Eso es una decisión de ticket que
//    no deja rastro mecánico, y decir lo contrario sería vender cobertura que no existe.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url'; // NUNCA `new URL().pathname`: no decodifica (SCRUM-730)

import { ranurasDelPanel, ranurasDe, contadoresDe, MARCA } from './_ranuras-con-marcador.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = path.join(RAIZ, 'public/dashboard/js');

/**
 * EL CENSO CONGELADO — medido el 7-sep-2026 contra `origin/main` = 349350c8.
 *
 * Por FICHERO y cantidad de SITIOS, igual que el censo de SCRUM-243: anclar a `fichero:línea`
 * pondría esto en rojo cada vez que alguien añade un import diez líneas más arriba, y un guard
 * que grita sin motivo se acaba puenteando igual que uno que no grita nunca.
 *
 * Este número NO es el contador de nadie: es lo que el árbol pinta. Cuando cambie —arriba o
 * abajo— hay que tocarlo A MANO, y ahí es donde alguien se acuerda de mirar el `*_SIN_APROBAR`
 * del fichero. Ése es todo el mecanismo: convertir «nadie se enteró» en «alguien lo afirmó».
 */
const CENSO_DE_SITIOS = {
  'albaranDesdePresupuestoModal.js': 6,
  'atajoNuevo.js': 1,
  'exportView.js': 2,
  'invoicesView.js': 1,
  'jobAsignados.js': 1,
  'libroRegistroView.js': 1,
  'parteDetailView.js': 1,
  'patronDetalleAcciones.js': 1,
  'productsView.js': 3,
  'providersView.js': 3,
  'quotesView.js': 3,
  'settingsSubmenus.js': 1,
  'settingsView.js': 2,
  'switchFormaJuridica.js': 5,
  'tipoDestinatarioPendiente.js': 2,
};
const TOTAL_DE_SITIOS = Object.values(CENSO_DE_SITIOS).reduce((t, n) => t + n, 0); // 33

/**
 * Los ficheros que pintan marcador y NO declaran ningún contador. **DIEZ de quince**, medido.
 * No se les inventa un contador: cuántas RANURAS son es un juicio humano —una ranura puede
 * pintarse en tres sitios— y eso no lo decide quien programa. Lo que sí se puede es impedir que
 * la lista CREZCA: un marcador nuevo en un fichero que no cuenta nada es la misma historia otra
 * vez, un escalón más abajo.
 */
const HUERFANOS = [
  'exportView.js', 'jobAsignados.js', 'libroRegistroView.js', 'parteDetailView.js',
  'patronDetalleAcciones.js', 'providersView.js', 'settingsSubmenus.js', 'settingsView.js',
  'switchFormaJuridica.js', 'tipoDestinatarioPendiente.js',
];

/**
 * Lo que tumba a este guard. Las dos ESTRENAN UNA RANURA sin tocar ningún contador, que es
 * exactamente lo que pasó en SCRUM-648 fase B y lo que hoy no ponía nada en rojo.
 * El campo `a` va como literal único, sin concatenar, para que el meta-guard pueda leerlo.
 */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // 🔴 POR LA CONSTANTE, y ahí está la grieta que este guard cubre y el trinquete de SCRUM-402
    // no: aquél cuenta LITERALES por AST —lo dice él mismo— y el único literal de este fichero es
    // la DECLARACIÓN de `INV_MARCADOR_MICROCOPY`, que no se mueve por añadirle usos. Medido: con
    // esta mutación SCRUM-402 se queda VERDE. Es la forma exacta del incidente de SCRUM-648 B.
    fichero: 'public/dashboard/js/invoicesView.js',
    de: '  const INV_SIN_APROBAR = 1;',
    a: '  const INV_SIN_APROBAR = 1;\n  const INV_ROTULO_NUEVO = INV_MARCADOR_MICROCOPY + \' nuevo\';',
    cae: 'SCRUM-755 · 🔴 EL ÁRBOL PINTA MÁS MARCADORES DE LOS DECLARADOS',
  },
  {
    fichero: 'public/dashboard/js/homeView.js',
    de: 'async function renderHomeView',
    a: 'const HOME_RANURA_NUEVA = \'[PENDIENTE microcopy oficial] rótulo nuevo\';\nasync function renderHomeView',
    cae: 'SCRUM-755 · 🔴 UN FICHERO NUEVO EMPIEZA A PINTAR MARCADOR',
  },
];

test('SCRUM-755 · SUELO: el lector VE los marcadores que hay (si no, el cero de abajo no vale)', () => {
  const panel = ranurasDelPanel(RAIZ);
  const total = Object.values(panel).reduce((t, s) => t + s.length, 0);
  assert.ok(total >= 20,
    `el lector sólo encuentra ${total} sitios con marcador en todo el panel. ` +
    'Un número bajo aquí no es una buena noticia: es un instrumento que dejó de mirar.');

  // Y que sabe leer las DOS formas, porque la casa usa las dos.
  const porVia = Object.values(panel).flat().reduce((a, s) => (a[s.via] = (a[s.via] || 0) + 1, a), {});
  assert.ok(porVia.literal > 0, 'el lector no ve ni un marcador escrito como literal');
  assert.ok(porVia.constante > 0, 'el lector no ve ni un marcador puesto a través de su constante');
});

test('SCRUM-755 · 🔴 EL QUE DECIDE: estrenar una ranura con marcador sin declararla se ve', () => {
  const panel = ranurasDelPanel(RAIZ);
  const reales = Object.fromEntries(Object.entries(panel).map(([f, s]) => [f, s.length]));

  const nuevos = Object.keys(reales).filter((f) => !(f in CENSO_DE_SITIOS));
  const idos = Object.keys(CENSO_DE_SITIOS).filter((f) => !(f in reales));
  const distintos = Object.keys(CENSO_DE_SITIOS)
    .filter((f) => f in reales && reales[f] !== CENSO_DE_SITIOS[f])
    .map((f) => `${f}: censo ${CENSO_DE_SITIOS[f]} → ahora ${reales[f]} (líneas ${panel[f].map((s) => s.linea).join(', ')})`);

  const pista = '\n\n  Si la ranura es LEGÍTIMA: actualiza el censo de arriba Y MIRA el `*_SIN_APROBAR`' +
    '\n  del fichero — es justo el paso que se saltó SCRUM-648 fase B y por el que el contador' +
    '\n  estuvo un día diciendo 1 habiendo 2. Si la ranura ya está firmada, el número BAJA.';

  assert.deepEqual(nuevos, [], `🔴 FICHEROS QUE EMPIEZAN A PINTAR MARCADOR y no estaban en el censo:\n    ${nuevos.join('\n    ')}${pista}`);
  assert.deepEqual(distintos, [], `🔴 EL ÁRBOL YA NO PINTA LO QUE EL CENSO DICE:\n    ${distintos.join('\n    ')}${pista}`);
  assert.deepEqual(idos, [], `🔴 FICHEROS DEL CENSO QUE YA NO PINTAN MARCADOR (¿se firmó el rótulo?):\n    ${idos.join('\n    ')}${pista}`);

  const total = Object.values(reales).reduce((t, n) => t + n, 0);
  assert.equal(total, TOTAL_DE_SITIOS, `el total de sitios con marcador es ${total} y el censo declara ${TOTAL_DE_SITIOS}`);
});

test('SCRUM-755 · los huérfanos no crecen: un marcador nuevo donde no se cuenta nada, en rojo', () => {
  const panel = ranurasDelPanel(RAIZ);
  const huerfanosHoy = Object.keys(panel).filter((f) => contadoresDe(path.join(JS, f)).length === 0).sort();
  assert.deepEqual(huerfanosHoy, [...HUERFANOS].sort(),
    '🔴 ha cambiado la lista de ficheros que pintan marcador SIN declarar ningún contador.\n' +
    '  Si es uno nuevo: o declara su contador, o entra aquí con su motivo. Si uno ha salido\n' +
    '  porque ya cuenta lo suyo, quítalo de la lista: bajar es para lo que sirve un censo.');
  assert.equal(huerfanosHoy.length, 10, 'el número de huérfanos ha cambiado');
});

test('SCRUM-755 · lo que este guard NO cubre, dicho aquí y no en una nota al pie', () => {
  // Una ranura pendiente SIN marcador no deja rastro en el árbol. Se comprueba que ese caso
  // EXISTE de verdad —no es una excusa teórica— para que nadie lea este fichero pensando que
  // cubre todo: `filtroClientes.js` declara 7 pendientes y no pinta ni un marcador.
  const fc = path.join(JS, 'filtroClientes.js');
  const contadores = contadoresDe(fc);
  const sitios = ranurasDe(fc);
  assert.ok(contadores.length > 0 && contadores[0].valor > 0,
    'filtroClientes.js ya no declara pendientes: busca otro ejemplo para este límite antes de borrarlo');
  assert.equal(sitios.length, 0,
    'filtroClientes.js ha empezado a pintar marcador: el ejemplo del límite ya no vale y hay que reescribirlo');
});

test('SCRUM-755 · EL LECTOR OFICIAL ME VE — la declaración no vale si el meta-guard no la lee', async () => {
  const { mutacionesDeclaradas } = await import('../scripts/meta-guard-mutaciones.mjs');
  const fuente = fs.readFileSync(path.join(RAIZ, 'tests/scrum755-el-contador-que-cuadro-solo.test.mjs'), 'utf8');
  const mias = mutacionesDeclaradas(fuente, 'scrum755.test.mjs');
  assert.equal(mias.length, MUTACIONES_QUE_ME_TUMBAN.length,
    `🔴 EL META-GUARD VE ${mias.length} DE MIS ${MUTACIONES_QUE_ME_TUMBAN.length} MUTACIONES. ` +
    'Una declaración con forma propia sale INVISIBLE y el meta-guard no lo dice: pasaría por ' +
    'cobertura sin serlo.');
});

test('SCRUM-755 · el marcador que se busca es el de la casa, no uno inventado aquí', () => {
  // Suelo del suelo: si alguien cambia el texto del marcador en el panel y no aquí, este guard
  // se quedaría mirando una cadena que ya no existe y saldría verde por no encontrar nada.
  const invoices = fs.readFileSync(path.join(JS, 'invoicesView.js'), 'utf8');
  assert.ok(invoices.includes(MARCA),
    `el marcador que busca este guard (${MARCA}) ya no aparece en invoicesView.js: ` +
    'o cambió el texto oficial, o el guard se quedó ciego. Las dos cosas se arreglan aquí.');
});
