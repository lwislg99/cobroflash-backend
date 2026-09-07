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
  'libroRegistroView.js': 1,
  'parteDetailView.js': 1,
  'productsView.js': 3,
  'providersView.js': 3,
  'quotesView.js': 3,
  'settingsView.js': 2,
  'switchFormaJuridica.js': 4,
  'tipoDestinatarioPendiente.js': 2,
};
const TOTAL_DE_SITIOS = Object.values(CENSO_DE_SITIOS).reduce((t, n) => t + n, 0);

/**
 * LOS QUE PINTAN Y NO CUENTAN — y **por qué**, que es la mitad que faltaba.
 *
 * Un hueco sin motivo escrito se lee como un olvido, y alguien lo «arregla» mañana inventando
 * contadores. Éstos NO son olvidos: **los siete están en el censo de `SCRUM-402`**, comprobado
 * mecánicamente abajo leyendo SUS claves, y cada uno tiene además al menos un test que lo nombra
 * y habla del marcador. O sea: hay instrumento, lo que no hay es un CONTADOR — y no lo hay porque
 * un contador cuenta RANURAS, que es un juicio humano, y ninguno de estos siete lo necesita para
 * lo que ya se les vigila.
 *
 * 🔴 LO QUE SÍ LES FALTABA, y es lo que cubre este fichero: el censo de SCRUM-402 cuenta
 * LITERALES, así que en los que pintan a través de una constante su número es el de la
 * DECLARACIÓN y no se mueve al añadir usos. Ahí es donde entraba una ranura nueva sin que nadie
 * la viera, y ahí es donde muerde el censo de sitios de arriba.
 */
const PINTAN_Y_NO_CUENTAN = {
  'exportView.js': 'sus dos ranuras son literales dentro del HTML de la vista; SCRUM-402 las ve una a una',
  'libroRegistroView.js': 'la pantalla entera va marcada por decisión escrita en su cabecera, y `scrum296-pantalla-libro` la compara ranura a ranura',
  'parteDetailView.js': 'su propio comentario dice que entra en el censo de SCRUM-402 con su número',
  'providersView.js': 'mensajes de error y respaldo de último recurso; `scrum644-trinquete-mensaje-crudo` los vigila',
  'settingsView.js': 'rótulo del modo de emisión, cubierto por `scrum298-modo-visible`',
  'switchFormaJuridica.js': 'los rótulos del control, cubiertos por `scrum574-switch-forma-juridica`',
  'tipoDestinatarioPendiente.js': 'el aviso entero es la ranura; `scrum615` y `scrum622` la sujetan',
};

/**
 * EL OTRO LADO DEL HUECO, y es el que decide la recomendación: ficheros que DECLARAN ranuras
 * pendientes y NO pintan ni un marcador. Un contador por fichero es el ÚNICO instrumento posible
 * aquí, porque en el árbol no hay nada que leer — y por eso los contadores no sobran: hacen falta
 * exactamente donde el árbol se queda mudo, y no donde ya habla.
 */
const CUENTAN_Y_NO_PINTAN = ['customersView.js', 'filtroClientes.js', 'jobDetailView.js', 'quoteDireccionObra.js'];

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

test('SCRUM-755 · los que pintan y no cuentan: cada uno con su MOTIVO escrito', () => {
  const panel = ranurasDelPanel(RAIZ);
  const hoy = Object.keys(panel).filter((f) => contadoresDe(path.join(JS, f)).length === 0).sort();
  assert.deepEqual(hoy, Object.keys(PINTAN_Y_NO_CUENTAN).sort(),
    '🔴 ha cambiado la lista de ficheros que pintan marcador SIN declarar contador.\n' +
    '  Si es uno nuevo: o declara su contador, o entra arriba CON SU MOTIVO — un hueco en blanco\n' +
    '  se lee como un olvido y alguien lo «arregla» inventando un número. Si uno ha salido porque\n' +
    '  ya cuenta lo suyo, quítalo: bajar es para lo que sirve un censo.');

  // Y el motivo no puede ser una cadena vacía puesta para callar al guard.
  for (const [f, motivo] of Object.entries(PINTAN_Y_NO_CUENTAN)) {
    assert.ok(motivo && motivo.length > 20, `«${f}» está en la lista con un motivo que no dice nada`);
  }
});

test('SCRUM-755 · ninguno de ellos está DESNUDO: los cubre el censo de SCRUM-402', () => {
  // No se copia aquí el censo de SCRUM-402: se LEEN sus claves. Copiarlo sería crear la segunda
  // lista a mano que este ticket entero viene a evitar.
  const fuente402 = fs.readFileSync(path.join(RAIZ, 'tests/scrum402-marcador-no-se-pinta.test.mjs'), 'utf8');
  const ini = fuente402.indexOf('const CENSO = Object.freeze({');
  const bloque = fuente402.slice(ini, fuente402.indexOf('});', ini));
  const censo402 = new Set([...bloque.matchAll(/^\s*'([^']+\.js)':\s*\d+/gm)].map((m) => m[1]));

  // SUELO: si el lector no encuentra el censo ajeno, el «todos cubiertos» de abajo sería el
  // verde de no haber mirado.
  assert.ok(censo402.size > 5, `sólo leo ${censo402.size} entradas del censo de SCRUM-402: no lo estoy leyendo`);
  assert.ok(censo402.has('invoicesView.js'), 'no encuentro una entrada conocida en el censo de SCRUM-402');

  const desnudos = Object.keys(PINTAN_Y_NO_CUENTAN).filter((f) => !censo402.has(f));
  assert.deepEqual(desnudos, [],
    `🔴 ESTOS PINTAN MARCADOR, NO CUENTAN, Y NO LOS CONOCE NADIE:\n    ${desnudos.join('\n    ')}\n\n` +
    '  Es el caso peor de los tres: ni contador que pueda desincronizarse ni censo que lo mire.');
});

test('SCRUM-755 · el otro lado del hueco: los que CUENTAN y no pintan siguen ahí', () => {
  // Éstos son la razón por la que los contadores NO sobran, y por la que la recomendación de este
  // ticket no es «un contador por fichero»: aquí el árbol no tiene nada que leer.
  const mudos = CUENTAN_Y_NO_PINTAN.filter((f) => {
    const cont = contadoresDe(path.join(JS, f));
    return cont.length > 0 && cont.reduce((t, c) => t + c.valor, 0) > 0 && ranurasDe(path.join(JS, f)).length === 0;
  });
  assert.deepEqual(mudos.sort(), [...CUENTAN_Y_NO_PINTAN].sort(),
    '🔴 ha cambiado el grupo de ficheros que declaran ranuras pendientes SIN pintar marcador.\n' +
    '  Si uno ha empezado a pintar, entra en el censo de sitios de arriba. Si su contador bajó a\n' +
    '  cero, sácalo de aquí. Este grupo es el argumento de por qué el contador sigue haciendo\n' +
    '  falta: es el único instrumento que puede verlos.');
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
