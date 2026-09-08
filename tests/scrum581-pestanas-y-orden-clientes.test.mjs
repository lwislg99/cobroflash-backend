// tests/scrum581-pestanas-y-orden-clientes.test.mjs — SCRUM-581 (CONT-08)
//
// Las pestañas Todos|Empresas|Personas y el orden de la lista de clientes.
//
// 🔴 POR QUÉ SE PRUEBA AQUÍ Y NO CON UN GUARD DE NAVEGADOR: los nueve guards de navegador NO
// cubren el dashboard — lo midió S3 y está abierto como SCRUM-628. Por eso la DECISIÓN vive en
// `filtroClientes.js` sin DOM: para que esta pantalla tenga red en `npm test`, que es donde la
// hay. Los guards de navegador sólo valen aquí como no-regresión de la landing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const FC = require(path.join(RAIZ, 'public/dashboard/js/filtroClientes.js'));

/**
 * EL CASO REAL DE HOY, medido en el PASO 0: 15 filas y `contact_kind` NULL en todas. Se añaden
 * dos declaradas para poder ejercitar también el caso de mañana; el de hoy son las NULL.
 */
const HOY = [
  { id: 1, name: 'Zorrilla', contactKind: null },
  { id: 2, name: 'álvarez', contactKind: null },
  { id: 3, name: 'Álvarez', contactKind: null },
  { id: 4, name: 'Bermúdez', contactKind: undefined },
];
const MANANA = [
  { id: 5, name: 'Acme SL', contactKind: 'EMPRESA' },
  { id: 6, name: 'Chus', contactKind: 'PERSONA' },
];

test('SCRUM-581 · 🔴 CONTROL NEGATIVO: «Todos» sin tocar el orden es EXACTAMENTE la lista de hoy', () => {
  // El defecto es `createdAt desc` y lo pone el servidor (`listCustomers`). Aquí eso se traduce
  // en: no se reordena y no se quita nada. Si esto cambia, es una REGRESIÓN, no una mejora.
  const lote = HOY.concat(MANANA);
  const visto = FC.aplicar(lote, FC.POR_DEFECTO.pestana, FC.POR_DEFECTO.orden);
  assert.deepEqual(visto.map((c) => c.id), lote.map((c) => c.id),
    '🔴 con «Todos» y sin tocar el orden, la lista ha cambiado respecto a la que mandó el servidor.\n'
    + '  El defecto tiene que seguir siendo el de hoy: quien abre la pantalla y no toca nada ve\n'
    + '  exactamente lo mismo que antes de este ticket.');
  assert.equal(FC.POR_DEFECTO.orden, 'RECIENTES', '🔴 el orden por defecto ha dejado de ser el del servidor.');
  assert.equal(FC.POR_DEFECTO.pestana, 'TODOS', '🔴 la pestaña por defecto ha dejado de ser «Todos».');
});

test('SCRUM-581 · 🔴 EL CASO DE HOY: 15 NULL → «Todos» los enseña, las otras dos salen VACÍAS', () => {
  // Es el caso real medido: 0 filas con valor, 15 en NULL. Una pestaña que enseñara algo aquí
  // estaría inventando una clasificación que nadie ha declarado.
  const soloNull = HOY;
  assert.equal(FC.filtrarPorPestana(soloNull, 'TODOS').length, soloNull.length,
    '🔴 «Todos» ha dejado de enseñar las filas sin clasificar.');
  assert.deepEqual(FC.filtrarPorPestana(soloNull, 'EMPRESA'), [],
    '🔴 una fila con `contactKind` NULL ha aparecido en «Empresas».\n'
    + '  NULL no «es» nada: es «nadie lo ha declarado». Meterla en un lado por comodidad es\n'
    + '  exactamente `resolveTipoDestinatario` otra vez (SCRUM-615).');
  assert.deepEqual(FC.filtrarPorPestana(soloNull, 'PERSONA'), [],
    '🔴 una fila con `contactKind` NULL ha aparecido en «Personas». Ver el mensaje de arriba.');
});

test('SCRUM-581 · 🔴 NINGUNA fila cae en una pestaña que no le corresponde', () => {
  const lote = HOY.concat(MANANA);
  const empresas = FC.filtrarPorPestana(lote, 'EMPRESA');
  const personas = FC.filtrarPorPestana(lote, 'PERSONA');

  for (const c of empresas) {
    assert.equal(c.contactKind, 'EMPRESA',
      `🔴 «Empresas» ha devuelto a #${c.id} («${c.name}»), cuyo contactKind es `
      + `${JSON.stringify(c.contactKind)}. El filtro está enseñando de más.`);
  }
  for (const c of personas) {
    assert.equal(c.contactKind, 'PERSONA',
      `🔴 «Personas» ha devuelto a #${c.id} («${c.name}»), cuyo contactKind es `
      + `${JSON.stringify(c.contactKind)}. El filtro está enseñando de más.`);
  }
  assert.deepEqual(empresas.map((c) => c.id), [5], '🔴 «Empresas» no devuelve exactamente la empresa.');
  assert.deepEqual(personas.map((c) => c.id), [6], '🔴 «Personas» no devuelve exactamente la persona.');

  // 📌 La consecuencia asumida, comprobada: mientras haya NULLs, Empresas + Personas NO suma Todos.
  const todos = FC.filtrarPorPestana(lote, 'TODOS');
  assert.ok(empresas.length + personas.length < todos.length,
    '🔴 Empresas + Personas ya suma Todos: o no quedan NULLs, o algo los está clasificando solo.');
});

test('SCRUM-581 · el orden A-Z pone «Álvarez» y «alvarez» donde el usuario los busca', () => {
  const az = FC.ordenar(HOY, 'AZ').map((c) => c.name);
  // Acentos y mayúsculas juntos, y antes de «Bermúdez» y «Zorrilla». Un sort binario habría
  // puesto «Zorrilla» antes que «álvarez» (mayúsculas primero) y «Álvarez» al final del todo.
  assert.equal(az[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''), 'alvarez',
    `🔴 el primero debería ser un «Álvarez»; salió «${az[0]}». Orden binario en vez de localeCompare.`);
  assert.equal(az[1].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''), 'alvarez',
    `🔴 los dos «Álvarez» tienen que quedar juntos; el segundo salió «${az[1]}».`);
  assert.deepEqual(az.slice(2), ['Bermúdez', 'Zorrilla'],
    `🔴 el resto no queda alfabético: ${JSON.stringify(az)}`);
});

test('SCRUM-581 · ordenar NO muta lo que mandó el servidor', () => {
  // Si `sort` mutara el lote, el orden «Más recientes» dejaría de ser el del servidor en cuanto
  // alguien pulsara A-Z una vez — y el control negativo pasaría en la primera carga y fallaría
  // en la segunda, que es la clase de fallo que nadie reproduce.
  const lote = HOY.concat(MANANA);
  const antes = lote.map((c) => c.id);
  FC.ordenar(lote, 'AZ');
  assert.deepEqual(lote.map((c) => c.id), antes, '🔴 `ordenar` ha mutado la lista de entrada.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 MICROCOPY · ESTE TEST SE INVIRTIÓ EL 2-sep-2026
//
// Exigía que los seis rótulos LLEVARAN el marcador. El fundador lo retiró de la pantalla con
// estas palabras: «nada de marcadores en pantalla». La premisa caducó por una decisión legítima,
// así que el test no se borra: afirma lo contrario, y sigue pudiendo fallar.
//
// ⚠️ Y vigila la mitad que NO cambió: los seis textos SIGUEN SIN APROBAR. Retirar el corchete
// visible no aprueba nada, y sin este trinquete «no se pinta el marcador» se convertiría en «ya
// está aprobado» sin que nadie lo decidiera.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-581 · 🔴 NINGÚN rótulo lleva marcador en pantalla', () => {
  const ranuras = [...FC.PESTANAS, ...FC.ORDENES, FC.VACIO_PESTANA];
  assert.equal(ranuras.length, 6, '🔴 ha cambiado el número de ranuras de microcopy.');
  for (const r of ranuras) {
    const rotulo = FC.etiqueta(r);
    assert.equal(rotulo.includes('[PENDIENTE'), false,
      `🔴 el rótulo «${rotulo}» pinta un marcador. La pantalla es de un profesional que paga: `
      + 'un corchete de proceso interno no es cosa suya (decisión del fundador, 2-sep-2026).');
    assert.equal(rotulo.includes('['), false, `🔴 «${rotulo}» lleva un corchete.`);
    // SUELO: y no está vacío. «Sin marcador» y «sin rótulo» darían el mismo verde en la
    // comprobación de arriba, y un botón sin texto es peor que uno con corchetes.
    assert.ok(rotulo.trim().length > 0, '🔴 SUELO: hay una ranura con el rótulo VACÍO.');
  }
  // CONTROL del propio detector: sabe ver un corchete cuando lo hay.
  assert.equal('[PENDIENTE microcopy oficial] Todos'.includes('[PENDIENTE'), true,
    '🔴 el detector no reconoce un marcador: sus «false» de arriba no significarían nada.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ✅ MICROCOPY APROBADA POR EL FUNDADOR EL 2-sep-2026 · Y FIJADA CON `===`
//
// Los seis textos están firmados. Se fijan LITERALES —no con `match`, no con `includes`— para
// que nadie los cambie sin pasar por el fundador: un `match` dejaría colar una coma, un acento
// o un «Personas físicas» sin que nada chillara, y microcopy aprobada que deriva sola es
// microcopy que deja de estar aprobada sin que nadie lo decida (regla 30).
//
// 🔴 UNA CORRECCIÓN SUYA QUE MERECE QUEDAR ESCRITA: mi propuesta para el vacío era «Ningún
// cliente clasificado así todavía», y **miente cuando hay una búsqueda activa** — ahí el motivo
// de que no salga nadie no es la clasificación, es la búsqueda. El texto aprobado no nombra la
// causa: dice lo que se ve y ofrece la salida.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-581 · ✅ los SEIS textos son EXACTAMENTE los aprobados', () => {
  const APROBADOS = {
    TODOS: 'Todos',
    EMPRESA: 'Empresas',
    PERSONA: 'Personas',
    RECIENTES: 'Más recientes',
    AZ: 'Nombre A-Z',
  };
  for (const r of [...FC.PESTANAS, ...FC.ORDENES]) {
    assert.equal(FC.etiqueta(r), APROBADOS[r.id],
      `🔴 el rótulo de «${r.id}» ya no es el aprobado el 2-sep-2026. Dice ${JSON.stringify(FC.etiqueta(r))} `
      + `y el fundador firmó ${JSON.stringify(APROBADOS[r.id])}. No se cambia sin pasar por él.`);
  }
  // SUELO: y son los CINCO, no un subconjunto. Si alguien quita una pestaña, el bucle de arriba
  // pasaría sin mirarla — «todos los que hay están bien» y «no hay ninguno» darían el mismo verde.
  assert.deepEqual([...FC.PESTANAS, ...FC.ORDENES].map((r) => r.id),
    ['TODOS', 'EMPRESA', 'PERSONA', 'RECIENTES', 'AZ'],
    '🔴 han cambiado las ranuras: hay una de más, una de menos o en otro orden.');
});

test('SCRUM-581 · ✅ el vacío de pestaña son sus DOS líneas aprobadas', () => {
  assert.equal(FC.etiqueta(FC.VACIO_PESTANA), 'Aquí no hay ningún cliente todavía.',
    '🔴 la primera línea del vacío no es la aprobada.');
  assert.equal(FC.subtitulo(FC.VACIO_PESTANA), 'Marca cada cliente como empresa o persona al editarlo.',
    '🔴 la segunda línea del vacío no es la aprobada.');

  // 🔴 Y NO VUELVE EL TEXTO QUE EL FUNDADOR RECHAZÓ, que mentía con una búsqueda activa.
  const dos = FC.etiqueta(FC.VACIO_PESTANA) + ' ' + FC.subtitulo(FC.VACIO_PESTANA);
  assert.equal(dos.includes('clasificado así todavía'), false,
    '🔴 ha vuelto el texto rechazado: dice que el motivo es la clasificación, y con una búsqueda '
    + 'activa el motivo es la búsqueda.');
});

test('SCRUM-581 · 🔴 NO queda ninguna ranura sin aprobar — y el número sigue existiendo', () => {
  // 🔴 SUBE A 4 CON SCRUM-580 (CONT-07), y es el contador haciendo su trabajo: las SEIS de
  // este ticket las firmo el FUNDADOR, y las CUATRO de las etiquetas las aprobo el ASESOR,
  // provisionales a la espera de el. Este numero existia valiendo 0 exactamente para esto.
  // SCRUM-584 · SUBE A 5: el rótulo del selector de columnas, del asesor y a la espera del
  // fundador. El contador haciendo su trabajo: una ranura nueva declara su estado antes de
  // pintarse.
  // 🔴 SCRUM-582 (CONT-09) · SUBE A 7, y son DOS ranuras en estados DISTINTOS:
  //   · «Seleccionar todos» — el nombre accesible de la casilla de cabecera. Lo APROBÓ EL ASESOR
  //     el 4-sep-2026 y espera al fundador, así que cuenta aquí.
  //   · el CONTADOR de selección — no lo ha aprobado NADIE todavía: va con marcador visible, y
  //     por eso  entra además en el censo de SCRUM-402.
  // Contarlas juntas en un solo número no las confunde: el estado de cada una está escrito en la
  // pieza, y este contador sólo dice CUÁNTAS le faltan al fundador.
  assert.equal(FC.SIN_APROBAR, 7,
    '🔴 hay ranuras de microcopy sin firmar. Si se ha añadido una pestaña o un orden nuevo, su '
    + 'texto NO está aprobado y tiene que contarse aquí antes de pintarse.');

  // El número se queda aunque valga 0: es el sitio donde una ranura nueva declara que nace sin
  // aprobar. Sin él, un texto nuevo entraría en pantalla en silencio — que es justo lo que el
  // marcador impedía y lo que ya no se ve.
  assert.equal(typeof FC.SIN_APROBAR, 'number',
    '🔴 ha desaparecido el contador de ranuras sin aprobar: el hueco se queda sin sitio donde '
    + 'declararse.');
  assert.equal(FC.MARCADOR, undefined,
    '🔴 ha vuelto la constante del marcador a la pieza: el fundador lo retiró de la pantalla.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL BUSCADOR SE COMBINA CON EL FILTRO, NO SE SUSTITUYE
//
// Es lo que pedía el encargo y lo que NINGÚN test cubría. El buscador va al SERVIDOR
// (`loadCustomers(searchInput.value)`) y las pestañas filtran en el navegador sobre lo que ese
// servidor devolvió. O sea que se combinan por construcción — pero «por construcción» es
// exactamente el tipo de afirmación que deja de ser cierta el día que alguien reordena dos
// líneas, y entonces buscar borraría el filtro (o al revés) sin que nada chillara.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-581 · 🔴 buscar Y filtrar a la vez: el filtro se aplica SOBRE el resultado de buscar', () => {
  // Lo que devolvería el servidor al buscar «mar»: dos empresas, una persona y un sin clasificar.
  const loteBuscado = [
    { id: 1, name: 'Marmoles Sur', contactKind: 'EMPRESA' },
    { id: 2, name: 'Marta Ruiz', contactKind: 'PERSONA' },
    { id: 3, name: 'Marina Obras', contactKind: 'EMPRESA' },
    { id: 4, name: 'Marcos Gil', contactKind: null },
  ];
  const empresas = FC.aplicar(loteBuscado, 'EMPRESA', 'RECIENTES');

  // SUELO CON CONTROL POSITIVO: devuelve ALGUNA. Un filtro que devuelve cero pasaría cualquier
  // comprobación de «no salen personas» — es el patrón más caro de la casa.
  assert.ok(empresas.length > 0,
    '🔴 SUELO: el filtro sobre un resultado de búsqueda devuelve CERO. Entonces «no salen '
    + 'personas» no significa nada: no sale nadie.');
  assert.deepEqual(empresas.map((c) => c.id), [1, 3],
    '🔴 el filtro no se aplica sobre lo que devolvió el buscador: buscar y filtrar tienen que '
    + 'COMBINARSE, no sustituirse.');

  // Y la otra mitad: el filtro NO reintroduce a nadie que la búsqueda había dejado fuera.
  assert.equal(FC.aplicar(loteBuscado, 'EMPRESA', 'AZ').some((c) => c.id === 99), false,
    '🔴 el filtro devuelve a alguien que la búsqueda no había traído: estaría leyendo otra lista.');
});

test('SCRUM-581 · 🔴 y el ORDEN también se combina con la búsqueda', () => {
  // 🔴 EL CONJUNTO NO ESTÁ ORDENADO POR id: si lo estuviera, este test no distinguiría el orden
  // alfabético del orden de inserción y pasaría con `ordenar` devolviendo la lista tal cual.
  const loteBuscado = [
    { id: 7, name: 'Zapata Reformas', contactKind: 'EMPRESA' },
    { id: 3, name: 'Álvarez Instalaciones', contactKind: 'EMPRESA' },
    { id: 9, name: 'Marmoles Sur', contactKind: 'EMPRESA' },
  ];
  const az = FC.aplicar(loteBuscado, 'EMPRESA', 'AZ');
  assert.deepEqual(az.map((c) => c.name),
    ['Álvarez Instalaciones', 'Marmoles Sur', 'Zapata Reformas'],
    '🔴 el orden A-Z no se aplica sobre el resultado de la búsqueda.');
  // CONTROL NEGATIVO: sin pedir A-Z, se respeta lo que mandó el servidor.
  assert.deepEqual(FC.aplicar(loteBuscado, 'EMPRESA', 'RECIENTES').map((c) => c.id), [7, 3, 9],
    '🔴 reordena sin que nadie se lo pida: el orden de hoy dependería de haber tocado el selector.');
});
