// tests/scrum817-orden-del-detalle-del-trabajo.test.mjs — SCRUM-817
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UNA PANTALLA SE ORDENA POR LO QUE SE HACE EN ELLA, NO POR CÓMO ESTÁN GUARDADOS LOS CAMPOS.
//
// «Quién ejecuta este trabajo» era el ÚLTIMO bloque, dentro de «Datos» y detrás de las notas
// internas — debajo del NOMBRE del trabajo, que se escribe una vez y no se vuelve a mirar. Es la
// decisión que el jefe toma cada mañana. Sube a lo primero.
//
// ⚠️ SCRUM-917g (21-sep-2026) RE-ANCLA cuatro de estos tests, cada uno con su motivo dentro. La
// decisión de fondo no se toca —«quién ejecuta» no puede estar enterrada—, pero la SUPERFICIE cambia:
// los cinco bloques sueltos son ahora cinco líneas de una tarjeta, «quién ejecuta» pasa a ir TERCERA
// (con los nombres ya leídos en la línea cerrada) y la casilla de precios sale de la barra de Documentos.
//
// 🔴 EL CONTROL QUE DECIDE SI UN REORDEN ES CORRECTO NO ES EL ASPECTO: SON LAS ACCIONES.
// Este proyecto ya estuvo a punto de pagarlo — sacar el selector de fecha de la lista de Trabajos
// habría borrado **la única forma de agendar un trabajo en todo el producto**, y sólo se vio
// porque alguien lo midió antes de ejecutar la decisión. Aquí se cuenta el inventario de acciones
// sobre el DOM MONTADO y se exige que no pierda ninguna.
//
// Medido al reordenar: **18 acciones antes y las mismas 18 después**, y los nodos pasan de 128 a
// 129 — el `div` de la sección nueva y nada más.
//
// ── ⛔ CERO RÓTULOS NUEVOS ───────────────────────────────────────────────────────────────
// El título del bloque que sube ya existía: lo pinta `construirSelectorAsignados`
// (`jobAsignados.js`, `titulo: 'Quién ejecuta este trabajo'`). Aquí sólo se le ha dado sección
// propia. No se ha inventado ni una palabra.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { inventario, perdidas } from './_inventario-detalle-trabajo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const EQUIPO = [{ id: 1, name: 'Javier P.' }, { id: 2, name: 'Javier Pereira' }];
// 🔴 SCRUM-823 · `status` ERA `'in_progress'`, QUE NO EXISTE EN EL PRODUCTO. La FSM tiene cinco
// estados y son `pendiente_agendar · agendado · en_curso · terminado · cerrado` (Parte L,
// `job.service.ts`); `in_progress` no aparece ni una vez en `src/modules/jobs/` ni en el schema.
// Este fichero era el ÚNICO sitio del árbol que lo usaba.
//
// No importaba mientras la escalera no mirase el estado — y por eso llevaba aquí sin molestar.
// Desde SCRUM-823 sí lo mira, y con un estado desconocido el CTA del héroe no se pinta: el test
// denunció «he perdido «+ Nuevo albarán»», que era verdad y por la razón equivocada. Se corrige el
// FIXTURE, que es lo que estaba mal, en vez de la lista de controles esperados.
const JOB = {
  id: 7, status: 'en_curso', createdAt: '2026-09-01T09:00:00Z', titulo: 'Revisión anual',
  customer: { id: 3, name: 'IES Ramón y Cajal' }, asignados: [EQUIPO[0]], operario: null,
  albaranes: [], gastos: [], notes: 'una nota', quote: { currency: 'EUR' },
  direccion: 'C/ Mayor 1', totalAceptado: 480, totalCobrado: 0,
};
/** SUELO del encargo: sin albaranes, sin gastos, sin técnicos y sin dirección. */
const JOB_VACIO = {
  id: 8, status: 'en_curso', createdAt: '2026-09-01T09:00:00Z', titulo: '',
  customer: { id: 3, name: 'IES' }, asignados: [], operario: null,
  albaranes: [], gastos: [], notes: '', quote: { currency: 'EUR' }, direccion: null,
};

async function montar(job, equipo) {
  const banco = cargarDashboard(RAIZ);
  banco.ctx.apiRequest = async (u) => {
    if (/\/admin\/team/.test(u)) return equipo;
    if (/\/admin\/merchant/.test(u)) return { name: 'Epipe' };
    if (/\/admin\/partes/.test(u)) return { partes: [] };
    if (/gastos/.test(u)) return [];
    return job;
  };
  banco.ctx.appUserRole = 'admin';
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `🔴 SUELO: la vista no monta (${r.error && r.error.message})`);
  return r;
}

/**
 * Dónde cae cada bloque en el árbol.
 *
 * ── RE-ANCLAJE (SCRUM-917g) ────────────────────────────────────────────────────────────
 * Esta lista decía: «quién ejecuta» (por la clase de su título) · albaranes · tipo · datos · notas ·
 * gastos, seis bloques SUELTOS con su cabecera cada uno. 917g los junta: albaranes y, después,
 * UNA tarjeta «El trabajo» con cinco LÍNEAS plegables. Cambia la superficie —la clase
 * `job-asignados-titulo` ya no se pinta (el título lo dice el rótulo de la línea) y «Datos» se
 * llama «Nombre y dirección» por una firma (SCRUM-917 com. 15881)—, no el objeto de este test:
 * que el orden de la pantalla sea el DECIDIDO y que ningún bloque se pierda. Se busca por el
 * rótulo que se lee, que es lo que el profesional ve.
 */
const HITOS = [
  ['albaranes', (n) => String(n.textContent || '').trim() === 'Albaranes'],
  ['el trabajo', (n) => String(n.textContent || '').trim() === 'El trabajo'],
  ['el trabajo · tipo', (n) => String(n.textContent || '').trim() === 'Tipo de trabajo'],
  ['el trabajo · nombre y dirección', (n) => String(n.textContent || '').trim() === 'Nombre y dirección'],
  ['el trabajo · quién lo ejecuta', (n) => String(n.textContent || '').trim() === 'Quién lo ejecuta'],
  ['el trabajo · notas internas', (n) => String(n.textContent || '').trim() === 'Notas internas'],
  ['el trabajo · gastos', (n) => String(n.textContent || '').trim() === 'Gastos de este trabajo'],
];

// ═══ 🔴 EL ORDEN ══════════════════════════════════════════════════════════════════════════

test('SCRUM-817 · 🔴 el orden decidido: albaranes y «El trabajo» con sus cinco líneas — y «quién ejecuta» se lee SIN abrir', async () => {
  // ── RE-ANCLAJE (SCRUM-917g) ──────────────────────────────────────────────────────────
  // Antes: «quién ejecuta» PRIMERO. Ahora va TERCERA línea de «El trabajo», en el orden del
  // prototipo aprobado (`docs/prototipos/SCRUM-917/`), y esto NO es olvidar lo que 817 defendía:
  //
  //   «Es la decisión que el jefe toma cada mañana y no puede quedar enterrada debajo del NOMBRE del
  //    trabajo, que se escribe una vez y no se vuelve a mirar.»
  //
  // Lo que enterraba «quién ejecuta» era la ALTURA de lo que tenía encima: un bloque de formulario
  // entero. Ahora lo de encima son líneas cerradas de 44 px, y sobre todo la línea CERRADA ya dice
  // los nombres —el principio sobrevive donde importa: el jefe LEE a quién le toca sin abrir nada—.
  // Se conservan las dos mitades: el orden decidido, y esa lectura sin abrir (el segundo bloque).
  const r = await montar(JOB, EQUIPO);
  const nodos = todos(r.contenedor);

  const posiciones = HITOS.map(([nombre, casa]) => ({ nombre, i: nodos.findIndex(casa) }));
  const perdidos = posiciones.filter((p) => p.i < 0).map((p) => p.nombre);
  assert.deepEqual(perdidos, [],
    `🔴 SUELO: no encuentro ${perdidos.length} bloque(s) en el árbol montado. Sin ellos, «están en `
    + 'orden» significaría «no los he visto».');

  assert.deepEqual(posiciones.slice().sort((a, b) => a.i - b.i).map((p) => p.nombre),
    HITOS.map(([n]) => n),
    '🔴 el orden de la pantalla no es el decidido: albaranes, y después «El trabajo» con Tipo · Nombre '
    + 'y dirección · Quién lo ejecuta · Notas internas · Gastos, como en el prototipo aprobado.');

  // La otra mitad, la de 817: quien ejecuta se LEE sin abrir. `JOB` tiene un técnico asignado.
  const linea = nodos.find((n) => n.dataset && n.dataset.linea === 'quien');
  assert.ok(linea, '🔴 SUELO: no encuentro la línea «Quién lo ejecuta» (`data-linea="quien"`).');
  const valor = todos(linea).find((n) => String(n.className || '').includes('detail-plega-valor'));
  assert.ok(valor, '🔴 SUELO: la línea «Quién lo ejecuta» no tiene valor a la derecha.');
  assert.equal(String(valor.textContent || '').trim(), EQUIPO[0].name,
    '🔴 la línea «Quién lo ejecuta» CERRADA no dice a quién le toca. Es lo único que salvaba el '
    + 'principio de SCRUM-817 al bajar de PRIMERA a TERCERA: si obliga a abrirla, el jefe vuelve a '
    + 'tener que buscar lo que decide cada mañana.');
});

// ═══ 🔴 EL CONTROL QUE DECIDE: NINGUNA FUNCIÓN PERDIDA ════════════════════════════════════

test('SCRUM-817 · 🔴 el reorden no pierde NI UNA acción', async () => {
  const r = await montar(JOB, EQUIPO);
  const hoy = inventario(r.contenedor);

  // Las 18 de la medición previa al reorden, una por una. No es un número: es la lista, porque un
  // número deja pasar «he perdido una y he ganado otra».
  const ANTES = [
    'A:Abrir en mapa',
    'BUTTON', 'BUTTON',
    'BUTTON:+ Nuevo albarán', 'BUTTON:+ Nuevo albarán',
    'BUTTON:Cambiar', 'BUTTON:Cancelar',
    'BUTTON:Consolidar seleccionados',
    'BUTTON:Facturar el trabajo',
    'BUTTON:Trabajos',
    'BUTTON:🧾 Consolidar en factura',
    'INPUT', 'INPUT', 'INPUT',
    'TEXTAREA',
    'aria-label=Javier P.', 'aria-label=Javier Pereira',
    'data-abrir-parte=1',
  ].sort();

  // ── RE-ANCLAJE (SCRUM-917g) ──────────────────────────────────────────────────────────
  // El inventario de 18 pierde DOS controles y ninguno por descuido: se DECLARAN aquí, cada uno con
  // su motivo y dónde vive ahora la función. `perdidas()` compara CONJUNTOS, así que el test exige
  // que lo perdido sea EXACTAMENTE esto —ni una acción más (que sería un reorden que borra algo), ni
  // una menos (que sería una retirada que ya no se produce y nadie miró)—.
  const RETIRADAS_A_PROPOSITO = [
    {
      accion: 'BUTTON:Cambiar',
      motivo: 'la fila «Tipo de trabajo · Cambiar» se sustituye por la línea plegable de «El trabajo»: la '
        + 'propia línea es el control, y no queda un botón suelto que abra otro control',
      vive: 'las DOS tarjetas de tipo dentro de la línea «Tipo de trabajo» (más abajo se comprueba)',
    },
    {
      accion: 'INPUT',
      motivo: 'la casilla «Incluir precios en el parte» de la barra de Documentos: decisión del '
        + 'orquestador, SCRUM-917 com. 16142 punto 2',
      vive: 'la MISMA casilla dentro de la hoja de alta del albarán (`buildAlbEditor`); la vigila SCRUM-319',
    },
  ];
  assert.deepEqual(perdidas(ANTES, hoy).sort(), RETIRADAS_A_PROPOSITO.map((x) => x.accion).sort(),
    '🔴 EL INVENTARIO NO PIERDE LO DECLARADO, Y SÓLO ESO. Reordenar no puede quitar nada por su cuenta: '
    + 'si falta una acción que NO está en RETIRADAS_A_PROPOSITO se ha borrado una manera de hacer algo y '
    + 'puede ser la única que había; si una declarada NO se ha perdido, la retirada ya no ocurre y la '
    + 'lista miente.');

  // 🔒 La función de «Cambiar» NO se pierde: vive en las dos tarjetas de tipo, que ahora están dentro
  // de la línea. Sin esto, declarar «Cambiar» como retirado sería declarar que ya no se puede cambiar
  // el tipo — que es una bandera fiscal.
  const linea = todos(r.contenedor).find((n) => n.dataset && n.dataset.linea === 'tipo');
  assert.ok(linea, '🔴 SUELO: no encuentro la línea «Tipo de trabajo» (`data-linea="tipo"`).');
  const tarjetas = todos(linea).filter((n) => String(n.tagName || '').toUpperCase() === 'BUTTON'
    && n.getAttribute && n.getAttribute('aria-pressed') != null);
  assert.equal(tarjetas.length, 2,
    '🔴 la línea «Tipo de trabajo» no lleva las DOS tarjetas de tipo. Retirar «Cambiar» sólo es '
    + 'legítimo si la función se quedó: sin las tarjetas, nadie puede cambiar el tipo del Trabajo.');
});

// ═══ 🔴 EL SUELO DEL ENCARGO: UN TRABAJO SIN NADA ═════════════════════════════════════════

test('SCRUM-817 · 🔴 sin albaranes, sin gastos, sin técnicos y sin dirección: nada en blanco', async () => {
  const r = await montar(JOB_VACIO, []);
  const nodos = todos(r.contenedor);
  const texto = nodos.map((n) => String(n.textContent || '')).join(' ');

  assert.ok(r.nodos > 40,
    `🔴 con el trabajo vacío sólo se pintan ${r.nodos} nodos: la pantalla se está quedando en `
    + 'blanco en vez de decir que no hay nada.');

  // 🔴 Cero marcadores en el DOM. `jobAsignados.js` DECLARA uno (`MARCA_ASIGNADOS`) pero sólo lo
  // exporta — nunca lo pinta. Se comprueba sobre el árbol, que es donde importa.
  const marcadores = (texto.match(/\[PENDIENTE microcopy oficial\]/g) || []).length;
  assert.equal(marcadores, 0,
    `🔴 ${marcadores} marcador(es) «[PENDIENTE microcopy oficial]» a la vista del profesional.`);

  // Y los bloques siguen ahí diciendo lo suyo, no desaparecidos.
  //
  // RE-ANCLAJE (SCRUM-917g): aquí se SALTABA «quién ejecuta» porque «sin equipo el selector se declara
  // y no se pinta». Con la tarjeta «El trabajo» ya no hay excepción que hacer: la línea «Quién lo
  // ejecuta» se pinta SIEMPRE —sin cuerpo que abrir cuando no se pudo leer el equipo, que es este
  // caso (`[]`)—, y una línea que desaparece con el trabajo vacío sería justo el «nada en blanco» que
  // este test vigila. Se quita el `continue`: la exigencia sube, no baja.
  for (const [nombre, casa] of HITOS) {
    assert.ok(nodos.some(casa), `🔴 el bloque «${nombre}» desaparece con el trabajo vacío`);
  }
});

// ═══ 📌 LA PREMISA QUE NO SE PUEDE MOVER ══════════════════════════════════════════════════

test('SCRUM-817 · 📌 la casilla de precios vive SÓLO dentro de la hoja de alta del albarán, nunca en el flujo del parte', async () => {
  // 🔴 «Incluir precios en el parte» NO gobierna el parte de trabajo: gobierna el `modoValoracion`
  // del ALBARÁN. La palabra «parte» ahí es herencia de cuando el albarán era lo único que había.
  //
  // ── RE-ANCLAJE (SCRUM-917g) ────────────────────────────────────────────────────────────
  // Este test decía que la casilla seguía PEGADA a «+ Nuevo albarán» en la barra de Documentos. Esa
  // premisa la retira una decisión firmada (SCRUM-917 com. 16142, punto 2): se quita la casilla de la
  // barra y se deja SÓLO la de dentro de la hoja de alta del albarán, que se abre siempre prellenada
  // (quien la marca escribe los precios a mano). Desaparece una SUPERFICIE —«pegada al botón»—; el
  // PRINCIPIO no se mueve: **la casilla gobierna el `modoValoracion` del albarán y no se lleva al
  // bloque del parte de trabajo**, que la ataría a un documento que no gobierna. «Dentro del parte»
  // en el com. 16142 es la hoja de alta, NO el `ParteTrabajo`.
  //
  // Se mide sobre el árbol MONTADO, no por el nombre de una variable: lo que importa es que en la
  // pantalla, al cargar, no haya NINGUNA casilla de precios —ni en la barra ni junto al parte—, y que
  // el único sitio del código donde se pinta sea la función de la hoja de alta.
  const r = await montar(JOB, EQUIPO);
  const nodos = todos(r.contenedor);

  // SUELO: el botón «+ Nuevo albarán» está (si no, «no hay casilla junto a él» no dice nada).
  const botones = nodos.filter((n) => String(n.tagName || '').toUpperCase() === 'BUTTON'
    && String(n.textContent || '').trim() === '+ Nuevo albarán');
  assert.ok(botones.length > 0,
    '🔴 SUELO: no encuentro «+ Nuevo albarán» en el árbol montado; sin él, «la barra ya no lleva la '
    + 'casilla» no mide nada.');

  const conCasilla = nodos.filter((n) => /Incluir precios en el parte/.test(String(n.textContent || '')));
  assert.deepEqual(conCasilla.map((n) => n.tagName), [],
    '🔴 ha vuelto la casilla «Incluir precios en el parte» a la pantalla del Trabajo (al cargar, sin abrir '
    + 'la hoja de alta). SCRUM-917 com. 16142 la retiró de la barra: el modo con precios se elige SÓLO '
    + 'dentro de la hoja de alta del albarán.');
  for (const b of botones) {
    const hermanos = (b._padre && b._padre.hijos) || [];
    assert.ok(!hermanos.some((h) => todos(h).some((n) => String(n.tagName || '').toUpperCase() === 'INPUT')),
      '🔴 hay un `input` en la misma barra que «+ Nuevo albarán»: es la casilla que 917g retiró.');
  }

  // Y en el código: el único sitio que escribe el rótulo de la casilla es `buildAlbEditor`, la hoja de
  // alta. (La cuenta y el AST completos los lleva SCRUM-319; aquí, la mitad que dice «no en el parte».)
  const { leerFuente } = await import('./_guard-texto.mjs');
  const src = leerFuente(path.join(RAIZ, 'public/dashboard/js/jobDetailView.js'),
    { ancla: 'buildAlbEditor' });
  const iEditor = src.indexOf('function buildAlbEditor');
  const iCasilla = src.indexOf('Incluir precios en el parte');
  assert.ok(iEditor >= 0 && iCasilla > iEditor,
    '🔴 la casilla ya no se pinta dentro de `buildAlbEditor` (la hoja de alta del albarán): o se ha '
    + 'movido al parte de trabajo —que no gobierna `modoValoracion`— o se ha perdido.');
  assert.equal(src.indexOf('Incluir precios en el parte', iCasilla + 1), -1,
    '🔴 la casilla se pinta en MÁS de un sitio del código: el modo con precios se elegiría en dos lugares.');
});
