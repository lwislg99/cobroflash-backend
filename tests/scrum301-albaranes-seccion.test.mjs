// tests/scrum301-albaranes-seccion.test.mjs — SCRUM-301 (C1)
//
// LOS ALBARANES PASAN A SER UN SITIO. Hasta aquí vivían dentro de cada Trabajo, así que «¿qué
// tengo sin firmar?» —la pregunta del lunes de un reformista con seis obras— obligaba a entrar
// obra por obra.
//
// Lo que este fichero tiene que dejar demostrado:
//
//   ① LOS CONTADORES CUADRAN CON LAS FILAS. La suma de cada eje es el total, siempre.
//   ② 🔴 SUELO — una consulta que falla NO produce ceros: revienta. Un contador de «sin firmar»
//      a 0 porque la lectura se rompió manda al profesional a casa tranquilo con tres albaranes
//      sin firmar. Cero de «no hay» y cero de «no supe mirar» son idénticos en pantalla.
//   ③ CENSO DERIVADO de los dos ejes, y guard: si el modelo gana un estado, aparece solo — y
//      nadie puede enumerarlos a mano en el navegador.
//   ④ 🔴 TENENCIA EJERCITADA, no deducida: dos merchants en la tienda falsa y se pregunta como
//      uno. El analizador de SCRUM-243 da por cubierta cualquier lectura en un handler que
//      mencione `merchantId` por el motivo que sea (medido en SCRUM-348), así que aquí no se
//      confía en él: se prueba el camino.
//   ⑤ CONTROL NEGATIVO — un cambio que NO debe mover ningún contador, contrastado con uno que sí.
//   ⑥ LOS DOS EJES NO SE APLANAN: el `parcial` sobrevive, que es el caso normal en obra por fases.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { ALBARAN_ESTADOS } from '../dist/modules/jobs/domain/albaran.service.js';
import { ESTADOS_COBRO } from '../dist/modules/jobs/domain/albaranFacturacion.js';
import {
  EJES_ALBARAN,
  contarAlbaranes,
  filtrarAlbaranes,
  listarAlbaranesDelMerchant,
} from '../dist/modules/jobs/domain/albaranesListado.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const F_VISTA = path.join(RAIZ, 'public', 'dashboard', 'js', 'albaranesView.js');
const F_INDEX = path.join(RAIZ, 'public', 'dashboard', 'index.html');
const F_APP = path.join(RAIZ, 'public', 'dashboard', 'js', 'app.js');
const VISTA = fs.readFileSync(F_VISTA, 'utf8');
const MARCA = '[PENDIENTE microcopy oficial]';

// ── LA TIENDA FALSA ──────────────────────────────────────────────────────────────────────
//
// Aplica el filtro TAL Y COMO SE LO PASEN, igual que Postgres. Es lo que hace que el test de
// tenencia pruebe algo: si el código olvidara el `merchantId`, esta tienda devolvería los
// albaranes del otro merchant y el rojo saldría solo.

const M_PROPIO = 7;
const M_AJENO = 9;

const TIENDA = {
  albaranes: [
    // merchant propio
    { id: 1, merchantId: M_PROPIO, jobId: 100, numero: 'ALB-2026-001', fecha: '2026-03-02T10:00:00.000Z', createdAt: '2026-03-01T09:00:00.000Z', estado: 'borrador', lineas: [{ concepto: 'Bajante', cantidad: 10, unidad: 'm', precioUnitario: 20, tipoIva: 21 }], invoiceId: null },
    { id: 2, merchantId: M_PROPIO, jobId: 100, numero: 'ALB-2026-002', fecha: '2026-03-05T10:00:00.000Z', createdAt: '2026-03-04T09:00:00.000Z', estado: 'emitido', lineas: [{ concepto: 'Grifería', cantidad: 2, unidad: 'ud', precioUnitario: 50, tipoIva: 21 }], invoiceId: null },
    { id: 3, merchantId: M_PROPIO, jobId: 101, numero: 'ALB-2026-003', fecha: '2026-03-09T10:00:00.000Z', createdAt: '2026-03-08T09:00:00.000Z', estado: 'firmado', lineas: [{ concepto: 'Alicatado', cantidad: 8, unidad: 'm2', precioUnitario: 30, tipoIva: 21 }], invoiceId: null },
    // …y éste está a MEDIAS: 4 de 8 facturados. Es el caso que se pierde si se aplanan los ejes.
    { id: 4, merchantId: M_PROPIO, jobId: 101, numero: 'ALB-2026-004', fecha: '2026-03-11T10:00:00.000Z', createdAt: '2026-03-10T09:00:00.000Z', estado: 'firmado', lineas: [{ concepto: 'Solado', cantidad: 8, unidad: 'm2', precioUnitario: 25, tipoIva: 21 }], invoiceId: null },
    // merchant AJENO — no puede salir por ningún sitio
    { id: 90, merchantId: M_AJENO, jobId: 900, numero: 'ALB-AJENO-001', fecha: '2026-03-03T10:00:00.000Z', createdAt: '2026-03-02T09:00:00.000Z', estado: 'firmado', lineas: [], invoiceId: null },
  ],
  jobs: [
    { id: 100, merchantId: M_PROPIO, titulo: 'Reforma baño Alcalá', customerId: 700 },
    { id: 101, merchantId: M_PROPIO, titulo: 'Obra nueva Chamberí', customerId: 701 },
    { id: 900, merchantId: M_AJENO, titulo: 'OBRA DEL VECINO', customerId: 900 },
  ],
  customers: [
    { id: 700, merchantId: M_PROPIO, name: 'Bar El Rincón', legalName: null },
    { id: 701, merchantId: M_PROPIO, name: 'Comunidad Alcalá', legalName: 'C.P. Alcalá 231' },
    { id: 900, merchantId: M_AJENO, name: 'CLIENTE DEL VECINO', legalName: null },
  ],
  libro: [
    { albaranId: 4, merchantId: M_PROPIO, lineaIndex: 0, cantidad: 4, invoiceId: 500 },
  ],
};

function lectorFalso(tienda = TIENDA, espia = {}) {
  espia.filtros = [];
  const mismos = (fila, merchantId) => fila.merchantId === merchantId;
  return {
    async albaranes(filtro) {
      espia.filtros.push({ metodo: 'albaranes', ...filtro });
      return tienda.albaranes.filter((a) => filtro.merchantId === undefined || mismos(a, filtro.merchantId));
    },
    async jobs(filtro) {
      espia.filtros.push({ metodo: 'jobs', ...filtro });
      return tienda.jobs.filter((j) => (filtro.merchantId === undefined || mismos(j, filtro.merchantId)) && filtro.ids.includes(j.id));
    },
    async customers(filtro) {
      espia.filtros.push({ metodo: 'customers', ...filtro });
      return tienda.customers.filter((c) => (filtro.merchantId === undefined || mismos(c, filtro.merchantId)) && filtro.ids.includes(c.id));
    },
    async libro(filtro) {
      espia.filtros.push({ metodo: 'libro', ...filtro });
      return tienda.libro.filter((l) => (filtro.merchantId === undefined || mismos(l, filtro.merchantId)) && filtro.albaranIds.includes(l.albaranId));
    },
  };
}

// ── ① LOS CONTADORES CUADRAN ─────────────────────────────────────────────────────────────

test('SCRUM-301 · ① la suma de cada eje ES el total: los contadores cuadran con las filas', async () => {
  const { filas, contadores } = await listarAlbaranesDelMerchant(M_PROPIO, lectorFalso());
  assert.equal(filas.length, 4, '🔴 la población de prueba no es la que este test cree');
  assert.equal(contadores.total, filas.length);

  const sumaEstado = Object.values(contadores.porEstado).reduce((a, b) => a + b, 0);
  assert.equal(sumaEstado, contadores.total,
    `🔴 LAS PESTAÑAS NO CUADRAN CON LA TABLA: suman ${sumaEstado} y hay ${contadores.total} filas.\n\n` +
    '  Un contador que no cuadra con lo que se pinta debajo es peor que no tener contador: el\n' +
    '  profesional decide con el número, no con la tabla.');

  const sumaCobro = Object.values(contadores.porCobro).reduce((a, b) => a + b, 0);
  assert.equal(sumaCobro, contadores.total, '🔴 el eje de facturación no cuadra con el total');

  assert.deepEqual(contadores.porEstado, { borrador: 1, emitido: 1, firmado: 2 });
  assert.deepEqual(contadores.porCobro, { sin_facturar: 3, parcial: 1, facturado: 0 });
});

test('SCRUM-301 · todo valor del eje tiene contador AUNQUE sea cero', () => {
  // Una pestaña que desaparece cuando su contador es 0 convierte «no tienes ninguno sin firmar»
  // en «esa pregunta ya no existe». El cero se enseña.
  const c = contarAlbaranes([]);
  assert.deepEqual(Object.keys(c.porEstado).sort(), [...ALBARAN_ESTADOS].sort());
  assert.deepEqual(Object.keys(c.porCobro).sort(), [...ESTADOS_COBRO].sort());
  assert.equal(c.total, 0);
});

// ── ② 🔴 SUELO: LA CONSULTA CEGADA FALLA, NO DEVUELVE CEROS ──────────────────────────────

test('SCRUM-301 · ② 🔴 SUELO: sin población no se devuelven ceros, se lanza', () => {
  for (const ausencia of [null, undefined, 'no soy una lista', 42]) {
    assert.throws(() => contarAlbaranes(ausencia), /sin_poblacion/,
      `🔴 con \`${String(ausencia)}\` en vez de filas, los contadores han devuelto NÚMEROS.\n\n` +
      '  Ese es exactamente el fallo del ticket: una pantalla tranquila construida sobre una\n' +
      '  lectura que no ocurrió. «Cero sin firmar» y «no supe mirar» se ven idénticos.');
  }
});

test('SCRUM-301 · ② 🔴 SUELO: si la lectura revienta, el listado revienta con ella', async () => {
  const lectorRoto = {
    ...lectorFalso(),
    async albaranes() { throw new Error('la base no contesta'); },
  };
  await assert.rejects(
    () => listarAlbaranesDelMerchant(M_PROPIO, lectorRoto),
    /la base no contesta/,
    '🔴 EL LISTADO SE HA TRAGADO EL FALLO DE LECTURA y ha devuelto algo. Quien lo pinte enseñará ' +
    'ceros que parecen «no tienes nada pendiente». La ruta tiene que poder devolver 500.');

  // Y el contraste: con la lectura sana, sí resuelve. Sin esto, el rechazo de arriba pasaría
  // igual con un listado roto del todo que lanzase siempre.
  const ok = await listarAlbaranesDelMerchant(M_PROPIO, lectorFalso());
  assert.equal(ok.contadores.total, 4);
});

// ── ③ CENSO DERIVADO DE LOS DOS EJES ─────────────────────────────────────────────────────

test('SCRUM-301 · ③ los ejes se DERIVAN del modelo, no se enumeran', () => {
  assert.deepEqual([...EJES_ALBARAN.estado], [...ALBARAN_ESTADOS],
    '🔴 el eje de estado ha dejado de derivarse de ALBARAN_ESTADOS');
  assert.deepEqual([...EJES_ALBARAN.cobro], [...ESTADOS_COBRO],
    '🔴 el eje de facturación ha dejado de derivarse de ESTADOS_COBRO');

  // Y son DOS ejes distintos, no cinco casillas planas. Si alguien los fusionara, esto cae.
  assert.equal(EJES_ALBARAN.estado.length, 3, '🔴 el enum del documento tiene 3 valores: borrador|emitido|firmado');
  assert.equal(EJES_ALBARAN.cobro.length, 3, '🔴 el eje de cobro tiene 3 valores: el `parcial` es uno de ellos');
  for (const v of EJES_ALBARAN.cobro) {
    assert.equal(EJES_ALBARAN.estado.includes(v), false,
      `🔴 «${v}» aparece en los DOS ejes: se han aplanado. Aplanarlos obliga a inventar un estado ` +
      'que no existe y pierde el `parcial`, que en una obra por fases es el caso normal.');
  }
});

test('SCRUM-301 · ③ un estado NUEVO del modelo aparece solo, no se descarta en silencio', () => {
  // El día que la Parte L gane un estado, el contador tiene que enseñarlo. Si lo tirase, la
  // pestaña «Todos» seguiría cuadrando y esos albaranes no estarían en ninguna pestaña.
  const filas = [
    { estado: 'borrador', estadoCobro: 'sin_facturar' },
    { estado: 'anulado_hipotetico', estadoCobro: 'sin_facturar' },
  ];
  const c = contarAlbaranes(filas);
  assert.equal(c.porEstado.anulado_hipotetico, 1,
    '🔴 un estado que el eje no conoce se está descartando: sus albaranes desaparecerían de la ' +
    'pantalla sin que nadie lo note');
  assert.equal(Object.values(c.porEstado).reduce((a, b) => a + b, 0), c.total,
    '🔴 con un estado desconocido, las pestañas dejan de cuadrar con el total');
});

/** Literales de cadena de un fuente JS/TS, por AST (un `grep` no distingue un comentario). */
function literalesDe(fuente) {
  const sf = ts.createSourceFile('x.js', fuente, ts.ScriptTarget.Latest, true);
  const out = [];
  const visita = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(n.text);
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return out;
}

test('SCRUM-301 · ③ 🔴 la vista NO enumera los estados: los recibe', () => {
  // ⚠️ Las DOS funciones de presentación (`claseEstado` / `claseCobro`) quedan fuera del barrido, y
  // no es una excepción de conveniencia: el peligro que este guard persigue es que un estado NUEVO
  // DESAPAREZCA de la pantalla. Un mapa de valor→clase CSS no puede esconder nada porque tiene
  // caso por defecto — el albarán se pinta igual, con la píldora neutra. Lo que sí escondería es
  // enumerar los estados para construir pestañas o para filtrar, y eso sigue vigilado.
  //
  // La exención se paga con el assert de abajo: las dos tienen que TENER ese caso por defecto.
  const presentacion = ['claseEstado', 'claseCobro'];
  let barrido = VISTA;
  for (const nombre of presentacion) {
    const cuerpo = cuerpoDe(VISTA, nombre);
    assert.ok(cuerpo, `🔴 no se encuentra \`${nombre}\` en la vista: la exención estaría mirando al aire`);
    assert.match(cuerpo, /return (?!.*if)[^;]+;\s*}$/s,
      `🔴 \`${nombre}\` no termina en un return por defecto: un estado nuevo se quedaría SIN clase ` +
      'y la exención de este guard dejaría de estar justificada.');
    barrido = barrido.replace(cuerpo, '');
  }

  const literales = literalesDe(barrido);
  assert.ok(literales.length > 20,
    `🔴 el analizador solo ha encontrado ${literales.length} literales en la vista: o el fichero ` +
    'cambió de forma o no se está leyendo. Con un analizador ciego este guard pasa en verde vacío.');

  const enumerados = [...ALBARAN_ESTADOS, ...ESTADOS_COBRO].filter((v) => literales.includes(v));
  assert.deepEqual(enumerados, [],
    '🔴 LA VISTA ESCRIBE A MANO VALORES DEL MODELO: ' + enumerados.join(', ') +
    '\n\n  Una lista escrita a mano no avisa de lo que le falta: el día que el modelo gane un\n' +
    '  estado, esta pantalla lo esconderá en silencio y sus albaranes no estarán en ninguna\n' +
    '  pestaña. Los ejes llegan en la respuesta (`ejes.estado`, `ejes.cobro`) ya derivados.\n' +
    '  Las CLASES CSS por estado no cuentan como enumerar: son presentación, y su caso por\n' +
    '  defecto cubre cualquier valor nuevo.');

  // EN ROJO: el analizador tiene que ver un literal cuando lo hay.
  assert.ok(literalesDe("const x = 'firmado';").includes('firmado'),
    '🔴 el analizador no ve un literal evidente: entonces el guard de arriba no vigila nada');
});

// ── ④ 🔴 TENENCIA, EJERCITADA ────────────────────────────────────────────────────────────

test('SCRUM-301 · ④ 🔴 un merchant NO ve los albaranes de otro (ni en filas ni en contadores)', async () => {
  const espia = {};
  const { filas, contadores } = await listarAlbaranesDelMerchant(M_PROPIO, lectorFalso(TIENDA, espia));

  assert.equal(filas.some((f) => f.numero.includes('AJENO')), false,
    '🔴 SE ESTÁ ENSEÑANDO EL ALBARÁN DE OTRO MERCHANT. En un listado nuevo esto se cuela con ' +
    'facilidad, y aquí saldría con el nombre de SU cliente y el título de SU obra.');
  assert.equal(contadores.total, 4, '🔴 el contador incluye albaranes de otro merchant');
  assert.equal(JSON.stringify(filas).includes('VECINO'), false,
    '🔴 se ha filtrado el nombre del cliente o del trabajo de otro merchant');

  // Y que el filtro VIAJA en cada consulta, no que el fichero mencione `merchantId` por ahí.
  const sinFiltro = espia.filtros.filter((f) => f.merchantId !== M_PROPIO);
  assert.deepEqual(sinFiltro, [],
    '🔴 alguna consulta se ha hecho SIN el merchantId correcto: ' + JSON.stringify(sinFiltro));
  assert.ok(espia.filtros.length >= 4, '🔴 no se han ejercitado las cuatro lecturas');

  // Contraste: preguntando como el OTRO merchant sí sale el suyo — si no, este test pasaría
  // igual con un listado que no devuelve nada nunca.
  const ajeno = await listarAlbaranesDelMerchant(M_AJENO, lectorFalso());
  assert.equal(ajeno.filas.length, 1);
  assert.equal(ajeno.filas[0].numero, 'ALB-AJENO-001');
});

// ── ⑤ CONTROL NEGATIVO ───────────────────────────────────────────────────────────────────

test('SCRUM-301 · ⑤ control negativo: cambiar el CONTENIDO no mueve ningún contador', async () => {
  const antes = (await listarAlbaranesDelMerchant(M_PROPIO, lectorFalso())).contadores;

  // Un cambio real que NO afecta a ningún eje: más líneas, otro título de obra, otro cliente.
  const tocada = JSON.parse(JSON.stringify(TIENDA));
  tocada.albaranes[0].lineas.push({ concepto: 'Extra', cantidad: 1, unidad: 'ud', precioUnitario: 10, tipoIva: 21 });
  tocada.jobs[0].titulo = 'Otro título completamente distinto';
  tocada.customers[0].name = 'Otro cliente';
  const despues = (await listarAlbaranesDelMerchant(M_PROPIO, lectorFalso(tocada))).contadores;

  assert.deepEqual(despues, antes,
    '🔴 los contadores se mueven con cambios que no son de estado ni de facturación. Un contador ' +
    'que reacciona a cualquier cosa deja de significar lo que dice su pestaña.');

  // Y el contraste, para que el `deepEqual` de arriba no pase por ser incapaz de cambiar:
  // facturar lo que quedaba del albarán 4 lo mueve de `parcial` a `facturado`.
  const facturada = JSON.parse(JSON.stringify(TIENDA));
  facturada.libro.push({ albaranId: 4, merchantId: M_PROPIO, lineaIndex: 0, cantidad: 4, invoiceId: 501 });
  const movida = (await listarAlbaranesDelMerchant(M_PROPIO, lectorFalso(facturada))).contadores;
  assert.deepEqual(movida.porCobro, { sin_facturar: 3, parcial: 0, facturado: 1 },
    '🔴 completar lo que faltaba por facturar NO ha movido el contador: entonces el control ' +
    'negativo de arriba no prueba nada, porque los contadores no cambian nunca.');
});

// ── ⑥ EL `parcial` SOBREVIVE, Y EL BUSCADOR BUSCA ────────────────────────────────────────

test('SCRUM-301 · ⑥ el eje derivado conserva el PARCIAL (lo que se perdería al aplanar)', async () => {
  const { filas } = await listarAlbaranesDelMerchant(M_PROPIO, lectorFalso());
  const aMedias = filas.find((f) => f.numero === 'ALB-2026-004');
  assert.equal(aMedias.estadoCobro, 'parcial',
    '🔴 un albarán con 4 de 8 facturados NO sale como `parcial`. Es el caso NORMAL en una obra ' +
    'por fases, y es justo el que desaparece si los dos ejes se aplanan en cinco pestañas.');
  assert.equal(aMedias.estado, 'firmado',
    '🔴 y sigue estando FIRMADO: el ciclo del documento y el de cobro son ejes distintos');
});

test('SCRUM-301 · el buscador encuentra por número, cliente y trabajo (y sin acentos)', async () => {
  const { filas } = await listarAlbaranesDelMerchant(M_PROPIO, lectorFalso());
  assert.equal(filtrarAlbaranes(filas, '002').length, 1, '🔴 no busca por número');
  // Los DOS albaranes del Trabajo 100 son de «Bar El Rincón»: buscar el cliente los trae a los dos.
  assert.equal(filtrarAlbaranes(filas, 'rincon').length, 2, '🔴 no busca por cliente sin acento');
  assert.equal(filtrarAlbaranes(filas, 'chamberi').length, 2, '🔴 no busca por trabajo sin acento');
  assert.equal(filtrarAlbaranes(filas, '').length, filas.length, '🔴 sin texto debe devolver todo');
  assert.equal(filtrarAlbaranes(filas, 'zzz').length, 0);
});

// ── LA COLUMNA QUE ES LA VENTAJA, Y EL CABLEADO ──────────────────────────────────────────

test('SCRUM-301 · 🏆 cada fila lleva su TRABAJO, con id para poder enlazarlo', async () => {
  // Ellos no pueden tener esta columna: sus albaranes cuelgan de un cliente. Saber que dos
  // albaranes sin firmar son de la MISMA obra cambia lo que haces: una llamada, no dos.
  const { filas } = await listarAlbaranesDelMerchant(M_PROPIO, lectorFalso());
  for (const f of filas) {
    assert.ok(Number.isInteger(f.jobId), `🔴 la fila ${f.numero} no lleva jobId: no se puede enlazar`);
    assert.ok(f.trabajo, `🔴 la fila ${f.numero} no lleva el título del Trabajo`);
  }
  const deLaMismaObra = filas.filter((f) => f.jobId === 101);
  assert.equal(deLaMismaObra.length, 2, '🔴 la población de prueba debía tener dos albaranes de una misma obra');
  assert.equal(new Set(deLaMismaObra.map((f) => f.trabajo)).size, 1,
    '🔴 dos albaranes del mismo Trabajo enseñan títulos distintos');
});

/**
 * Los `src` que index.html CARGA de verdad, con los comentarios HTML fuera.
 *
 * Medido en rojo: la primera versión de este guard buscaba el nombre del fichero en el HTML entero
 * y **comentar el `<script>` la dejaba en verde** — el texto seguía ahí dentro. Un guard que no
 * distingue una etiqueta viva de una comentada no vigila el cableado, vigila la ortografía.
 */
function scriptsCargados(html) {
  const sinComentarios = html.replace(/<!--[\s\S]*?-->/g, '');
  return [...sinComentarios.matchAll(/<script[^>]*\ssrc=["']([^"']+)["']/g)].map((m) => m[1]);
}

test('SCRUM-301 · la sección está CABLEADA: menú, ruta y script', () => {
  const index = fs.readFileSync(F_INDEX, 'utf8');
  const app = fs.readFileSync(F_APP, 'utf8');

  assert.match(index, /data-view="albaranes"/,
    '🔴 no hay entrada de menú `albaranes`. B1 (SCRUM-284) NO la creó —su propia entrada del ' +
    'registro dice «solo el censo, no toca la sidebar»—, así que la crea este ticket.');

  const scripts = scriptsCargados(index);
  assert.ok(scripts.length > 20,
    `🔴 solo se han leído ${scripts.length} scripts de index.html: el lector no está leyendo`);
  assert.ok(scripts.includes('./js/albaranesView.js'),
    '🔴 la vista NO se carga en index.html: no existiría en el navegador. Comentar la etiqueta ' +
    'cuenta como no cargarla — el fichero se queda escrito y la pantalla, vacía.');
  assert.match(app, /case 'albaranes':/, '🔴 la vista no está enrutada en app.js');
  assert.match(app, /renderAlbaranesView/, '🔴 app.js no llama a la vista');
  assert.match(VISTA, /window\.renderAlbaranesView = renderAlbaranesView/,
    '🔴 la vista no se publica en `window`: app.js no la encontraría');

  // El detalle (C2) ya tiene sección propia a la que pertenecer.
  assert.match(app, /'albaran-detail' \? 'albaranes'/,
    '🔴 el detalle del albarán sigue marcando «Trabajos» en el menú, ahora que tiene sección propia');
});

// ── MICROCOPY (regla 30) ─────────────────────────────────────────────────────────────────

/**
 * Las CUATRO ranuras que el asesor aprobó el 5-ago-2026 (tres tal cual, una con retoque).
 *
 * El guard cambió de trabajo: hasta la aprobación exigía el marcador; ahora compara **ranura a
 * ranura** contra el texto aprobado, porque **retocar copy aprobada es una decisión del asesor**, no
 * un detalle de implementación. Mismo patrón que dejó escrito SCRUM-303.
 */
const COPY_APROBADA = {
  seccion: 'Albaranes',
  pestanaTodos: 'Todos',
  estados: { borrador: 'Borradores', emitido: 'Emitidos', firmado: 'Firmados' },
  columnas: ['Nº', 'Emisión', 'Entrega', 'Cliente', 'Trabajo', 'Estado'],
  filtroTodos: 'Facturación: todos',
  cobro: { sin_facturar: 'sin facturar', parcial: 'parcial', facturado: 'facturado' },
};

/**
 * Las CINCO ranuras de estado, firmadas después de las cuatro de estructura. Cada una va atada a SU
 * SITIO en el código, no a «aparece en el fichero»: el texto correcto en la ranura equivocada tiene
 * que salir rojo igual que un texto cambiado.
 */
const COPY_RANURAS = {
  avisoError: 'No se han podido cargar los albaranes. Vuelve a intentarlo.',
  sufijoRecuento: ' en total',
  buscadorVisible: 'Buscar por nº, cliente o trabajo',
  buscadorAria: 'Buscar albaranes',
  vacioSinAlbaranes: 'Todavía no hay albaranes',
  vacioConFiltros: 'Ningún albarán coincide con los filtros',
};

/**
 * Lee el texto de cada ranura DEL AST, en el sitio exacto donde se usa.
 *
 * No vale buscar la cadena por el fichero: eso daría verde con el texto del vacío-con-filtros puesto
 * en el vacío-sin-albaranes, que es un error de producto —le diría «no tienes ninguno» a quien tiene
 * doce y filtró mal— y no de ortografía.
 */
function ranurasDeLaVista(fuente) {
  const sf = ts.createSourceFile('x.js', fuente, ts.ScriptTarget.Latest, true);
  const r = {};
  const texto = (n) => (n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null);

  const visita = (n) => {
    // `aviso.textContent = '…'` · `subtitle.textContent = contadores.total + ' en total'`
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isPropertyAccessExpression(n.left) && n.left.name.text === 'textContent' &&
        ts.isIdentifier(n.left.expression)) {
      const destino = n.left.expression.text;
      if (destino === 'aviso') r.avisoError = texto(n.right);
      if (destino === 'subtitle' && ts.isBinaryExpression(n.right)) {
        const suf = texto(n.right.right);
        if (suf !== null) r.sufijoRecuento = suf;
      }
    }
    // `buscador.placeholder = '…'`
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isPropertyAccessExpression(n.left) && n.left.name.text === 'placeholder' &&
        ts.isIdentifier(n.left.expression) && n.left.expression.text === 'buscador') {
      r.buscadorVisible = texto(n.right);
    }
    // `buscador.setAttribute('aria-label', '…')`
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) &&
        n.expression.name.text === 'setAttribute' && ts.isIdentifier(n.expression.expression) &&
        n.expression.expression.text === 'buscador' && texto(n.arguments[0]) === 'aria-label') {
      r.buscadorAria = texto(n.arguments[1]);
    }
    // El ternario de los dos vacíos: `filas.length === 0 ? '…' : '…'`
    if (ts.isConditionalExpression(n) && /filas\.length\s*===\s*0/.test(n.condition.getText(sf))) {
      r.vacioSinAlbaranes = texto(n.whenTrue);
      r.vacioConFiltros = texto(n.whenFalse);
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return r;
}

/** La regla de plural de la vista, replicada aquí para poder carear sus resultados. */
function etiquetaEstadoSegunLaVista(valor) {
  const cuerpo = VISTA.slice(VISTA.indexOf('function etiquetaEstado('), VISTA.indexOf('function etiquetaCobro('));
  // eslint-disable-next-line no-new-func
  return new Function(cuerpo + '; return etiquetaEstado(' + JSON.stringify(valor) + ');')();
}
function etiquetaCobroSegunLaVista(valor) {
  const cuerpo = VISTA.slice(VISTA.indexOf('function etiquetaCobro('), VISTA.indexOf('function esc('));
  // eslint-disable-next-line no-new-func
  return new Function(cuerpo + '; return etiquetaCobro(' + JSON.stringify(valor) + ');')();
}

test('SCRUM-301 · la copy APROBADA está, ranura a ranura, y el marcador se ha retirado', () => {
  const index = fs.readFileSync(F_INDEX, 'utf8');
  const app = fs.readFileSync(F_APP, 'utf8');

  assert.ok(index.includes('>' + COPY_APROBADA.seccion + '<'),
    `🔴 el rótulo del menú ya no es «${COPY_APROBADA.seccion}». Está APROBADO: cambiarlo es una ` +
    'decisión del asesor, no un retoque de implementación.');
  assert.ok(app.includes("viewTitle.textContent = '" + COPY_APROBADA.seccion + "'"),
    `🔴 el título de la pantalla ya no es «${COPY_APROBADA.seccion}»`);
  assert.equal(index.includes(MARCA + ' Albaranes'), false,
    '🔴 el menú sigue con el marcador sobre un texto YA APROBADO: el marcador existe para molestar ' +
    'hasta que hay aprobación, y ya la hay.');

  for (const [valor, esperado] of Object.entries(COPY_APROBADA.estados)) {
    assert.equal(etiquetaEstadoSegunLaVista(valor), esperado,
      `🔴 la pestaña de «${valor}» ya no dice «${esperado}». Los cuatro rótulos de las pestañas ` +
      'están aprobados; si la regla de plural deja de producirlos, hay que decirlo, no cambiarlos.');
  }
  for (const [valor, esperado] of Object.entries(COPY_APROBADA.cobro)) {
    assert.equal(etiquetaCobroSegunLaVista(valor), esperado,
      `🔴 la opción de facturación «${valor}» ya no dice «${esperado}»`);
  }
  assert.ok(VISTA.includes("'" + COPY_APROBADA.filtroTodos + "'"),
    `🔴 el filtro ya no dice «${COPY_APROBADA.filtroTodos}». El retoque aprobado fue precisamente ` +
    'ése: «todos» concuerda con «albaranes», que es lo que se cuenta; «todas» arrastra a pensar en ' +
    'facturas, el objeto que este filtro NO cuenta.');
  assert.equal(VISTA.includes('facturación: todas'), false,
    '🔴 ha vuelto «todas», que es exactamente lo que el retoque corrigió');

  const cabeceras = VISTA.slice(VISTA.indexOf("thead.innerHTML"), VISTA.indexOf('</tr>'));
  for (const c of COPY_APROBADA.columnas) {
    assert.ok(cabeceras.includes("'" + c + "'"), `🔴 la columna «${c}» ya no se llama así`);
  }

  // Las píldoras de la fila imprimen el VALOR del modelo, que es dato y no copy — y es lo que
  // impide que alguien vuelva a escribir «Enviado» donde el modelo dice `emitido`.
  assert.match(VISTA, /pill\.textContent = f\.estado;/,
    '🔴 la píldora de estado ha dejado de imprimir el valor del modelo');
});

test('SCRUM-301 · las CINCO ranuras de estado dicen su texto FIRMADO, cada una en su sitio', () => {
  const r = ranurasDeLaVista(VISTA);

  // SUELO: si el lector no encuentra las ranuras, los asserts de abajo compararían `undefined`
  // contra `undefined`... o peor, pasarían por casualidad. Se exige encontrarlas TODAS.
  const ausentes = Object.keys(COPY_RANURAS).filter((k) => typeof r[k] !== 'string');
  assert.deepEqual(ausentes, [],
    '🔴 el lector de ranuras no ha encontrado: ' + ausentes.join(', ') +
    '\n\n  O la vista cambió de forma, o el lector dejó de mirar donde debía. En los dos casos este\n' +
    '  guard estaría comparando aire.');

  for (const [ranura, firmado] of Object.entries(COPY_RANURAS)) {
    assert.equal(r[ranura], firmado,
      `🔴 LA RANURA «${ranura}» YA NO DICE SU TEXTO FIRMADO.\n` +
      `     firmado:  ${JSON.stringify(firmado)}\n` +
      `     y ahora:  ${JSON.stringify(r[ranura])}\n\n` +
      '  Estos textos los firmó el asesor: cambiarlos —aunque sea una letra— es decisión suya, no\n' +
      '  un retoque de implementación.');
  }

  // Y el marcador ya no PINTA nada aquí: las nueve ranuras están firmadas.
  //
  // ⚠️ Sobre LITERALES, no sobre el fichero. La primera versión de este assert miró el fuente entero
  // y salió roja sola: la cabecera de la vista cuenta que «se entregó con [PENDIENTE microcopy
  // oficial] en cada rótulo», así que el guard se cazaba a sí mismo en la prosa que lo explica —el
  // clásico de la casa (SCRUM-176/168/3/193). Un marcador citado en un comentario no llega a
  // ninguna pantalla; uno en una cadena, sí.
  const marcados = literalesDe(VISTA).filter((t) => t.includes(MARCA));
  assert.deepEqual(marcados, [],
    '🔴 queda `[PENDIENTE microcopy oficial]` en un texto que se PINTA, y las nueve ranuras de esta ' +
    'pantalla están firmadas. Un marcador sobre texto aprobado se despliega tal cual y se lee en ' +
    'producción — que es lo que pasó con SCRUM-303 hasta que entró su aprobación.');
});

test('SCRUM-301 · el guard vigila LA RANURA, no «que el texto aparezca en el fichero»', () => {
  // La prueba de que la comparación está atada al sitio: se intercambian los dos vacíos. Los dos
  // textos siguen estando en el fichero, palabra por palabra —un guard que buscara por el fuente
  // daría verde—, pero cada uno está en la ranura del otro.
  //
  // Y no es un matiz de tests: con los textos cruzados, a quien tiene doce albaranes y filtra mal se
  // le diría «todavía no hay albaranes».
  const cruzada = VISTA.replace(
    `filas.length === 0 ? '${COPY_RANURAS.vacioSinAlbaranes}' : '${COPY_RANURAS.vacioConFiltros}'`,
    `filas.length === 0 ? '${COPY_RANURAS.vacioConFiltros}' : '${COPY_RANURAS.vacioSinAlbaranes}'`);
  assert.notEqual(cruzada, VISTA, '🔴 el sabotaje no ha cambiado nada: el ternario cambió de forma');

  const r = ranurasDeLaVista(cruzada);
  assert.notEqual(r.vacioSinAlbaranes, COPY_RANURAS.vacioSinAlbaranes,
    '🔴 EL LECTOR NO DISTINGUE LAS DOS RAMAS DEL TERNARIO: con los textos intercambiados sigue ' +
    'leyendo lo mismo, así que el guard no vigila la ranura — solo comprueba que las palabras ' +
    'están escritas en alguna parte.');
  assert.equal(r.vacioSinAlbaranes, COPY_RANURAS.vacioConFiltros,
    '🔴 el lector no está leyendo la rama verdadera del ternario');

  // Y el texto que el asesor DESCARTÓ para esa ranura tampoco puede colarse.
  const descartado = 'Ningún albarán coincide con esa búsqueda';
  assert.equal(VISTA.includes(descartado), false,
    `🔴 aparece «${descartado}», que es la variante DESCARTADA: se eligió «los filtros» porque esa ` +
    'rama se alcanza también desde la pestaña de estado y desde el filtro de facturación, no solo ' +
    'escribiendo en el buscador.');
});

test('SCRUM-301 · el recuento no inventa plural: «1 en total» se escribe así', () => {
  // El sufijo firmado es « en total» y la plantilla NO ramifica. Un plural inventado («1 en
  // totales») saldría de ramificar por el número, así que se comprueba que no hay tal rama.
  const r = ranurasDeLaVista(VISTA);
  assert.equal(1 + r.sufijoRecuento, '1 en total', '🔴 el singular no sale como «1 en total»');
  assert.equal(5 + r.sufijoRecuento, '5 en total', '🔴 el plural no sale como «5 en total»');
  assert.equal(/en total(es|\(es\)|s)/.test(VISTA), false,
    '🔴 hay un plural inventado sobre «en total». En español «1 en total» es correcto: no se ramifica.');
});

// ── LA PANTALLA NO PINTA CEROS CUANDO FALLA ──────────────────────────────────────────────

/** Cuerpo de una función declarada en el fuente, por AST. */
function cuerpoDe(fuente, nombre) {
  const sf = ts.createSourceFile('x.js', fuente, ts.ScriptTarget.Latest, true);
  let cuerpo = null;
  const visita = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.name.text === nombre && n.body) cuerpo = n.body.getText(sf);
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return cuerpo;
}

test('SCRUM-301 · 🔴 el camino de ERROR no dibuja pestañas ni contadores', () => {
  const error = cuerpoDe(VISTA, 'pintarError');
  const exito = cuerpoDe(VISTA, 'pintar');
  assert.ok(error && exito,
    '🔴 no se han encontrado `pintarError` / `pintar` en la vista: el guard estaría mirando al aire');

  assert.equal(error.includes('data-card-tabs'), false,
    '🔴 EL CAMINO DE ERROR DIBUJA PESTAÑAS. Con la consulta rota, esas pestañas enseñarían ceros — ' +
    'y un 0 en «sin firmar» manda al profesional a casa tranquilo con tres albaranes sin firmar.');
  assert.ok(exito.includes('data-card-tabs'),
    '🔴 el camino de ÉXITO no dibuja pestañas: entonces el assert de arriba no distingue nada');
  assert.ok(error.includes("'alert error'"),
    '🔴 el aviso de error no lleva tono. `.alert` SIN modificador está oculta por CSS (styles.css): ' +
    'sería un error invisible, que es peor que ninguno (lección de SCRUM-303/350).');
  assert.ok(exito.includes('contadores.total'), '🔴 el camino de éxito no usa los contadores del servidor');
});
