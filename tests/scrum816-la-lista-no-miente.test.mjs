// SCRUM-816 · LA LISTA DE TRABAJOS Y EL DETALLE DICEN LO MISMO — porque comen lo mismo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO: LA ESCALERA ERA ÚNICA Y LA COMIDA ERA DISTINTA
//
// SCRUM-366 sacó `jobNextAction` a su propio módulo para que la lista y el detalle no pudieran
// discrepar, y su guard comprueba que las dos superficies LLAMEN a esa escalera. Pasaba en verde.
//
// Y aun así discrepaban. Porque la escalera **no ramifica por el estado del Trabajo**: decide por
// sus ALBARANES y sus FACTURAS, y el serializador de la LISTA no mandaba ninguno de los dos —
// `albaranes` e `invoices` los añadía sólo `serializeJobDetail`. Con los dos campos ausentes,
// `Array.isArray(undefined)` es `false`, la escalera los trata como listas vacías y cae SIEMPRE
// al nivel 5: `+ Nuevo albarán`, en las veinte filas, incluidas las once SIN AGENDAR y las que ya
// tenían un albarán emitido.
//
// 🔒 Una sola fuente alimentada con dos datos distintos no es una sola fuente.
//
// Medido en navegador el 7-sep-2026, antes de tocar nada: 9 de 10 filas ofrecían «+ Nuevo
// albarán» —una de ellas CERRADA—, y metiendo un albarán emitido en el lote las 9 pasaban a
// «Enviar para firmar». Control positivo: la causa está probada, no deducida.
//
// Este fichero es la red que corre SIEMPRE (sin navegador, sin BD, sin red). La que mide el
// candado pulsando de verdad es `npm run guard:lista-trabajos`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

const LISTA = leer('public/dashboard/js/jobsView.js');
const HOJA = leer('public/dashboard/css/styles.css');
const RUTAS = leer('src/modules/jobs/app/routes/jobs.routes.ts');
const ESCALERA = leer('public/dashboard/js/jobNextAction.js');

/** La escalera, EJECUTADA. Comprobar que el fichero existe no dice si decide bien. */
function cargarEscalera() {
  const ctx = { window: {}, fmtMoneyEs: (n, cur) => `${Number(n).toFixed(2)} ${cur || 'EUR'}` };
  vm.createContext(ctx);
  vm.runInContext(ESCALERA, ctx);
  return ctx.window.jobNextAction;
}

// ═══ ① EL SERIALIZADOR DE LA LISTA MANDA LO QUE LA ESCALERA LEE ═════════════════════════════

test('SCRUM-816 · SUELO: la escalera se carga y DISTINGUE según los albaranes', () => {
  const jobNextAction = cargarEscalera();
  assert.equal(typeof jobNextAction, 'function', '🔴 ESCÁNER CIEGO: la escalera no se pudo cargar.');

  const base = { id: 1, status: 'en_curso', customer: { phone: null }, invoices: [], remaining: null };
  // Si la escalera contestara lo mismo con y sin albaranes, todo lo de abajo sería cierto por
  // vacío: el ticket entero se apoya en que ESTE dato cambia la respuesta.
  const sin = jobNextAction({ ...base, albaranes: [] });
  const con = jobNextAction({ ...base, albaranes: [{ id: 9, estado: 'emitido' }] });
  assert.equal(sin.kind, 'nuevo', '🔴 sin albaranes la escalera debería proponer crear el primero');
  assert.equal(con.kind, 'firmar', '🔴 con un albarán emitido debería proponer enviarlo a firmar');
  assert.notEqual(sin.label, con.label, '🔴 ESCÁNER CIEGO: la escalera no cambia de respuesta con el dato que este ticket hace viajar.');
});

test('SCRUM-816 · 🔴 el CAMPO AUSENTE y el campo VACÍO se leen igual — por eso había que mandarlo', () => {
  const jobNextAction = cargarEscalera();
  const base = { id: 1, status: 'en_curso', customer: { phone: null }, remaining: null };

  // Ésta es la avería, escrita como test: un Trabajo CON albarán emitido, servido por un
  // serializador que no manda el campo, es indistinguible de uno que no tiene ninguno.
  const comoLoMandabaLaLista = jobNextAction({ ...base });               // sin `albaranes` ni `invoices`
  const unTrabajoSinNada = jobNextAction({ ...base, albaranes: [], invoices: [] });
  assert.equal(
    comoLoMandabaLaLista.kind, unTrabajoSinNada.kind,
    '🔴 ESCÁNER CIEGO: si omitir el campo YA no equivaliera a lista vacía, este test estaría\n' +
    '  midiendo otra cosa y el de abajo no probaría nada.',
  );
  assert.equal(comoLoMandabaLaLista.kind, 'nuevo');
});

test('SCRUM-816 · `serializeJob` (la LISTA) manda `albaranes` e `invoices`', () => {
  const codigo = soloEjecutable(RUTAS);

  // El serializador del listado, acotado a su cuerpo: buscar en el fichero entero encontraría los
  // del DETALLE y daría un verde que no es.
  const desde = codigo.indexOf('async function serializeJob(job: Job, refs?: JobRefs)');
  const hasta = codigo.indexOf('async function serializeJobDetail(');
  assert.ok(desde > 0 && hasta > desde, '🔴 ESCÁNER CIEGO: no encuentro el cuerpo de `serializeJob`. ¿Se renombró?');
  const cuerpo = codigo.slice(desde, hasta);

  for (const campo of ['albaranes', 'invoices']) {
    assert.ok(
      new RegExp('\\n\\s*' + campo + ',').test(cuerpo),
      `🔴 \`serializeJob\` NO devuelve \`${campo}\`.\n\n` +
      '  Es el defecto entero de SCRUM-816: la escalera de la siguiente acción decide por los\n' +
      '  albaranes y las facturas del Trabajo, y sin ellos cae siempre al nivel 5 — «+ Nuevo\n' +
      '  albarán» en las veinte filas, incluida una CERRADA. Y la lista y el detalle pasan a\n' +
      '  decir cosas distintas del mismo Trabajo sin que nada avise.',
    );
  }
});

test('SCRUM-816 · los albaranes de la lista viajan EN LOTE, no una consulta por fila', () => {
  const codigo = soloEjecutable(RUTAS);

  assert.ok(
    /albaranesPorJob/.test(codigo),
    '🔴 no existe el lote `albaranesPorJob`. Sin él, resolver los albaranes dentro de\n' +
    '  `serializeJob` es UNA CONSULTA POR FILA: el N+1 que SCRUM-58 quitó (2910 ms contra 1270).',
  );
  const desde = codigo.indexOf('async function loadJobRefs');
  const hasta = codigo.indexOf('async function quotesDeJob');
  assert.ok(desde > 0 && hasta > desde, '🔴 ESCÁNER CIEGO: no encuentro `loadJobRefs`.');
  const lote = codigo.slice(desde, hasta);
  assert.ok(
    /prisma\.albaran\.findMany/.test(lote),
    '🔴 el lote no consulta los albaranes: `loadJobRefs` es el único sitio donde puede hacerse\n' +
    '  una vez para las 200 filas.',
  );
  // Regla 2 aunque la clave ajena ya ate: la FK garantiza que el albarán EXISTE, no que sea de
  // este negocio.
  const consulta = lote.slice(lote.indexOf('prisma.albaran.findMany'), lote.indexOf('prisma.albaran.findMany') + 320);
  assert.ok(
    /merchantId/.test(consulta),
    '🔴 la consulta de albaranes del lote no acota por `merchantId` (regla 2).',
  );
});

// ═══ ② LO QUE LA PANTALLA DEJA DE REPETIR, Y LO QUE NO PIERDE ═══════════════════════════════

test('SCRUM-816 · ESTADO y FECHA son una sola columna, y el cobro NO se pierde', () => {
  const codigo = soloEjecutable(LISTA, { almohadillaEsComentario: false });

  // ⚠️ `<th[^>]*>` Y NO `<th>`: un extractor con el `>` pegado deja de casar en cuanto alguien le
  // pone un atributo al `<th>` —y el de IMPORTE ya lo lleva—, así que se volvería verde sin que
  // el defecto se hubiera arreglado. Es lo que cuenta el censo de SCRUM-553.
  assert.ok(
    !/<th[^>]*>Estado<\/th>/.test(codigo),
    '🔴 sigue la columna ESTADO. Contestaba lo mismo que FECHA —«¿cuándo se hace esto?»— y su\n' +
    '  celda apilaba dos insignias de dimensiones distintas: una de agenda y otra de cobro.',
  );
  assert.ok(/<th[^>]*>Fecha<\/th>/.test(codigo), '🔴 ha desaparecido también FECHA: la fusión se ha comido la columna buena.');

  // 🔴 EL CONTROL DEL TICKET: la información de cobro NO se pierde, sigue estando en un solo
  // sitio. Vive en la celda de IMPORTE y ya estaba ahí — la insignia sólo la repetía peor.
  assert.ok(
    /jobs-importe-cobrado/.test(codigo) && /de \$\{fmtMoneyEs\(referencia, cur\)\}/.test(codigo),
    '🔴 SE HA PERDIDO EL COBRO. La insignia se quita porque el importe cobrado ya se dice en la\n' +
    '  celda de IMPORTE («597,14 € de 1.194,27 €»). Si esa línea desaparece, el cambio deja de\n' +
    '  ser «no repetir» y pasa a ser «borrar un dato de dinero».',
  );
  assert.ok(
    !/cobroPillClass/.test(codigo),
    '🔴 la fila vuelve a pintar la insignia de cobro. El dato ya está dos columnas antes, con sus\n' +
    '  dos cifras en vez de con una palabra.',
  );
});

test('SCRUM-816 · el subtítulo de la cabecera se ha borrado y el estado vacío conserva el suyo', () => {
  const SUBTITULO = 'Tus trabajos: los que vienen de un presupuesto aceptado';
  const VACIO = 'Todavía no tienes ningún trabajo';
  assert.ok(
    !new RegExp(SUBTITULO).test(soloEjecutable(LISTA, { almohadillaEsComentario: false })),
    '🔴 el subtítulo sigue pintándose. Era la TERCERA presentación de la misma pantalla.',
  );
  assert.ok(
    LISTA.includes(VACIO),
    '🔴 SE HA BORRADO EL TEXTO EQUIVOCADO. El que se va es el subtítulo de la cabecera; el del\n' +
    '  estado vacío (SCRUM-651, fundador 2-sep-2026) es el que explica la pantalla a quien no\n' +
    '  tiene ni un Trabajo, y ahí es donde hace falta.',
  );
});

// ═══ ③ EL CANDADO — el MECANISMO. Pulsarlo de verdad es `guard:lista-trabajos` ══════════════

test('SCRUM-816 · 🔒 la guarda de navegación de la fila pregunta por el HECHO, no por la forma', () => {
  const codigo = soloEjecutable(LISTA, { almohadillaEsComentario: false });

  assert.ok(
    /closest\('\[data-fila-no-navega\]'\)/.test(codigo),
    '🔴 LA GUARDA VUELVE A SER UNA LISTA DE ETIQUETAS.\n\n' +
    '  Decía `closest(\'button, a, input, textarea, select, label\')`. El desplegable de técnicos\n' +
    '  tiene un `<summary>` y un `<div>`, que no son ninguna de esas seis: pulsar el hueco entre\n' +
    '  dos nombres navegaba al Trabajo en mitad de una asignación. Comprobado en rojo.\n' +
    '  🔒 Un prefijo no es un nombre, y una lista de etiquetas se satisface dejando de enumerar.',
  );
  assert.ok(
    /data-fila-no-navega/.test(codigo.slice(codigo.indexOf('function celdaTecnicosConDesplegable'))),
    '🔴 el desplegable no se declara como control de la fila, así que la guarda del hecho no lo ve.',
  );
});

test('SCRUM-816 · el guardado del desplegable REVIERTE lo que se ve si falla', () => {
  const codigo = soloEjecutable(LISTA, { almohadillaEsComentario: false });
  const desde = codigo.indexOf('function celdaTecnicosConDesplegable');
  assert.ok(desde > 0, '🔴 ESCÁNER CIEGO: no encuentro el desplegable. ¿Se renombró?');
  const cuerpo = codigo.slice(desde, codigo.indexOf('function tecnicosParaElFiltro', desde) > 0
    ? codigo.indexOf('function tecnicosParaElFiltro', desde) : codigo.length);

  assert.ok(/catch \(err\)/.test(cuerpo), '🔴 el guardado no trata el fallo.');
  assert.ok(
    /antesMarcados\[i\]/.test(cuerpo) && /antesNombres/.test(cuerpo),
    '🔴 NO REVIERTE. Un desplegable que se queda con el nombre puesto y no lo ha guardado es peor\n' +
    '  que no tenerlo: la pantalla afirma una asignación que no existe.',
  );
  // 🔴 Y el estado anterior se RECONSTRUYE. `change` salta DESPUÉS de que el navegador haya
  // cambiado la casilla, así que leerlas todas devuelve el estado NUEVO — con eso, revertir
  // dejaba la marca puesta. Lo cazó `guard:lista-trabajos` corriendo, no leyendo.
  assert.ok(
    /c === cb \? !c\.checked : c\.checked/.test(cuerpo),
    '🔴 el estado anterior se está LEYENDO de las casillas, y en `change` eso ya es el estado\n' +
    '  nuevo: la reversión no revertiría nada. La única casilla que cambió es la del evento.',
  );
  assert.ok(
    /avisoDeFallo\('No se pudo guardar'/.test(cuerpo),
    '🔴 el fallo no se DICE. Revertir en silencio deja al jefe creyendo que asignó.',
  );
});

test('SCRUM-816 · cero microcopy nueva: los literales del desplegable ya estaban en pantalla', () => {
  const codigo = soloEjecutable(LISTA, { almohadillaEsComentario: false });
  // Los tres que usa el control nuevo, y los tres son de SCRUM-727b / firmados el 4-sep-2026.
  for (const literal of ['Sin asignar', '✓ Técnicos: ', '✓ Sin asignar']) {
    assert.ok(
      codigo.includes(literal),
      `🔴 falta el literal «${literal}», que es el que ya se usaba. Si el control estrena texto,\n` +
      '  necesita firma del fundador (regla 30) y este ticket se cerró con CERO microcopy nueva.',
    );
  }
});

// ═══ ④ EL ANCHO Y EL FILTRO ═════════════════════════════════════════════════════════════════

test('SCRUM-816 · el tope de ancho se ha ido, y no era compartido', () => {
  assert.ok(
    !/\.jobs-pantalla\s*\{[^}]*max-width:\s*980px/.test(HOJA),
    '🔴 vuelve el `max-width: 980px`. Medido en Edge con setViewport real: a 1700 px la tabla de\n' +
    '  Trabajos acababa en 978 px y las otras cuatro listas llegaban a 1402. Media pantalla en\n' +
    '  blanco, en la pantalla desde la que el jefe reparte el día.',
  );
  // Y NO era compartido: la clase existe en la hoja y en su vista, en ningún sitio más. Si
  // apareciera en una tercera, tocarla movería otra pantalla y el alcance del ticket sería otro.
  const dondeSale = fs.readdirSync(path.join(RAIZ, 'public', 'dashboard', 'js'))
    .filter((f) => f.endsWith('.js') && leer(`public/dashboard/js/${f}`).includes('jobs-pantalla'));
  assert.deepEqual(
    dondeSale, ['jobsView.js'],
    '🔴 `.jobs-pantalla` ha aparecido en otra vista: ' + dondeSale.join(', ') + '.\n' +
    '  Deja de ser el envoltorio de UNA pantalla y tocarlo mueve las demás.',
  );
});

test('SCRUM-816 · el filtro de técnico busca EN CLIENTE: ni una petición nueva', () => {
  const codigo = soloEjecutable(LISTA, { almohadillaEsComentario: false });

  assert.ok(/type = 'search'/.test(codigo), '🔴 no hay caja de búsqueda en el filtro de técnico.');
  assert.ok(
    /sinTildes/.test(codigo),
    '🔴 la búsqueda compara con tildes. «sanchis» no encontraría a «Toni Sanchís», que es\n' +
    '  exactamente donde se usa.',
  );
  // 🔴 NI UNA PETICIÓN. El ticket pedía copiar `nuevaFacturaModal` (búsqueda en servidor con
  // espera de 250 ms) y eso aquí sobra: `/admin/team` ya trae el equipo entero. Sin segunda
  // consulta no hay respuesta lenta que pueda pisar a la última — la carrera no se esquiva, no
  // existe.
  // ⚠️ EL ANCLA ES CÓDIGO, NO UN COMENTARIO. La primera versión buscaba el rótulo «EL FILTRO POR
  // TÉCNICO», que `soloEjecutable` acababa de borrar: el índice salía -1, el bloque empezaba en 0
  // y abarcaba `renderJobsView` entera con sus `apiRequest`. El test caía por su propio corte.
  const desdeFiltro = codigo.indexOf('const tecnicos = tecnicosParaElFiltro');
  const hastaFiltro = codigo.indexOf('const porCobro', desdeFiltro);
  assert.ok(desdeFiltro > 0 && hastaFiltro > desdeFiltro, '🔴 ESCÁNER CIEGO: no acoté el bloque del filtro.');
  const bloque = codigo.slice(desdeFiltro, hastaFiltro);
  assert.ok(/pintarOpciones/.test(bloque), '🔴 ESCÁNER CIEGO: el bloque acotado no es el del filtro.');
  assert.ok(
    !/apiRequest/.test(bloque) && !/setTimeout/.test(bloque),
    '🔴 el buscador de técnicos ha pasado a consultar al servidor (o a esperar). Con el equipo ya\n' +
    '  cargado eso sólo añade una carrera que hoy no puede existir.',
  );
  // Y no llama a `paint()`: repintar la barra en cada tecla destruiría este mismo `<input>` y con
  // él el foco — la segunda letra no se podría escribir.
  assert.ok(
    /buscador\.addEventListener\('input', \(\) => \{\s*jobsTecnicoBusqueda = buscador\.value;\s*pintarOpciones\(\);/.test(bloque),
    '🔴 escribir dispara algo más que repintar las opciones. Si repinta la barra, el foco se\n' +
    '  pierde en la primera tecla.',
  );
});

test('SCRUM-816 · las clases nuevas del desplegable tienen regla en la hoja', () => {
  // La lección de SCRUM-666: una clase que la vista escribe y la hoja no conoce se pinta sin
  // estilo y nadie se entera hasta que se abre la pantalla.
  for (const clase of ['jobs-tecnicos-menu', 'jobs-tecnicos-resumen', 'jobs-tecnicos-lista', 'jobs-filtro-tecnico-buscar']) {
    assert.ok(
      new RegExp('\\.' + clase + '[\\s,{:]').test(HOJA),
      `🔴 la clase \`.${clase}\` la escribe la vista y la hoja no la conoce.`,
    );
  }
  // Y la rejilla de móvil ya no reserva un área para una celda que no existe.
  //
  // 🔒 SE LEE LA HOJA SIN COMENTARIOS, y no es un detalle: la regla lleva encima el comentario
  // que EXPLICA por qué se ha quitado el área `status`, y la primera versión de este test se
  // cazó a sí misma en esa explicación. Un guard de texto casa con el comentario que describe lo
  // que prohíbe — le ha pasado a esta casa cuatro veces.
  const hojaSinComentarios = HOJA.replace(/\/\*[\s\S]*?\*\//g, '');
  const movil = hojaSinComentarios.slice(hojaSinComentarios.indexOf('.table--trabajos tbody tr.jobs-fila'));
  const rejilla = movil.slice(0, movil.indexOf('}'));
  assert.ok(rejilla.includes('grid-template-areas'), '🔴 ESCÁNER CIEGO: no acoté la rejilla de la card.');
  assert.ok(
    !/status/.test(rejilla),
    '🔴 la card de móvil sigue reservando el área `status`, cuya celda se retiró: un renglón de\n' +
    '  aire en una pantalla que a 390 px ya iba justa.',
  );
});
