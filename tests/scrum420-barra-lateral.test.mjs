// tests/scrum420-barra-lateral.test.mjs — SCRUM-420 (B1 · incremento 2)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL TEST QUE DECIDE ES EL POSITIVO: **cada entrada lleva a una pantalla que existe.**
//
// Una entrada que apunta a nada es peor que no tenerla: es una promesa rota cada vez que el
// profesional la pulsa. Y no es hipotético en este bloque — la entrada `Cobros` que pide el diseño
// no tiene pantalla (es B4, SCRUM-285), y por eso NO se ha puesto.
//
// El segundo, y sale de un hallazgo de hoy: el guard **ENUMERA** el diseño contra la barra y
// declara **qué falta Y qué sobra**. Contar es lo que dejó pasar lo de `NOTAS INTERNAS` en el
// bloque G (SCRUM-411, 3ª entrega): nueve bloques pedidos, nueve construidos, y uno no era el que
// el diseño pedía.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizar, entradasDelDiseno, entradasDeLaBarra, vistasDelRouter,
  VISTA_POR_ROTULO, AUSENCIAS_CONOCIDAS, ANADIDAS_DECLARADAS, VISTAS_SIN_ENTRADA,
} from './_barra-lateral.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const F_DISENO = path.join(RAIZ, 'docs/diseno/bloque-b.md');
const F_HTML = path.join(RAIZ, 'public/dashboard/index.html');
const F_APP = path.join(RAIZ, 'public/dashboard/js/app.js');

const DISENO = entradasDelDiseno(F_DISENO);
const BARRA = entradasDeLaBarra(F_HTML);
const ROUTER = vistasDelRouter(F_APP);

const vistasEnBarra = new Set(BARRA.entradas.map((e) => e.vista));

// ═══ SUELOS ═══════════════════════════════════════════════════════════════════════════════
//
// «La barra está vacía» y «no supe leerla» dan el mismo verde en un guard que solo compare
// conjuntos: dos listas vacías coinciden perfectamente. Los suelos van ANTES que nada.

test('SCRUM-420 · SUELO: el escáner VE la barra', () => {
  assert.ok(BARRA.entradas.length >= 12,
    `🔴 ESCÁNER CIEGO: solo veo ${BARRA.entradas.length} entradas de navegación en index.html ` +
    '(esperaba ≥12). Cero entradas y una barra correcta NO pueden dar el mismo verde: si el ' +
    'recorrido del <nav> se ha roto, arréglalo antes de creerte ningún resultado de abajo.');
  assert.ok(BARRA.grupos.length >= 3,
    `🔴 solo ${BARRA.grupos.length} rótulos de grupo: el recorrido no está viendo las secciones.`);
});

test('SCRUM-420 · SUELO: el escáner VE el diseño y VE el router', () => {
  assert.ok(DISENO.entradas.length >= 14,
    `🔴 el diseño §B1 devolvió ${DISENO.entradas.length} entradas (esperaba ≥14): o cambió el ` +
    'formato del bloque cercado, o el lector se rompió. Sin diseño no hay contra qué contrastar.');
  assert.ok(ROUTER.size >= 15,
    `🔴 solo ${ROUTER.size} vistas leídas del router: si esto se rompe, «la pantalla no existe» ` +
    'pasaría a ser la respuesta para todas.');
});

// ═══ ① EL POSITIVO ════════════════════════════════════════════════════════════════════════

test('SCRUM-420 · ① cada entrada de la barra LLEVA A UNA PANTALLA QUE EXISTE', () => {
  const rotas = BARRA.entradas
    .filter((e) => !ROUTER.has(e.vista))
    .map((e) => `«${e.rotulo}» → data-view="${e.vista}" (no hay case en renderView)`);
  assert.deepEqual(rotas, [],
    '🔴 hay entradas que apuntan a una pantalla que NO EXISTE. Una entrada rota es una promesa ' +
    'rota cada vez que el profesional la pulsa — peor que no tenerla:\n   · ' + rotas.join('\n   · '));
});

test('SCRUM-420 · ① `export` y `templates` SIGUEN alcanzables tras salir/quedarse', () => {
  // `export` sale de la barra: su camino nuevo es el enlace de Configuración › Tus datos. Si esto
  // cae, la reorganización se ha comido una pantalla.
  const vista = fs.readFileSync(path.join(RAIZ, "public/dashboard/js/settingsView.js"), "utf8");
  assert.match(vista, /renderAppView\('export'\)/,
    '🔴 `Descargar datos` ya no está en la barra Y no hay enlace a `export` en Configuración: la ' +
    'pantalla de SCRUM-244 se ha quedado sin ningún camino. Sacar una entrada sin dejar camino no ' +
    'es reordenar, es perder la pantalla.');
  assert.match(vista, /renderDescargarDatosCard\(panelDeSuperficie\("renderDescargarDatosCard"\)\)/,
    '🔴 la tarjeta existe pero no se monta: declarada y no montada es la regresión que la ' +
    'declaración existe para impedir (misma lección que las provisionales de SCRUM-284).');
  // ── SCRUM-432 · POR QUÉ ESTA MITAD CAMBIÓ ────────────────────────────────────────────────
  // Hasta el 10-ago exigía `templates` EN la barra, y tenía razón: su pestaña no existía y sacarla
  // la dejaba sin camino. Ahora la pestaña existe, así que mantener aquella exigencia sería fijar
  // el estado anterior como requisito — el test caería el día que alguien hace el trabajo bien.
  // Lo que se exige ahora es lo mismo de siempre, contra el camino de hoy: que haya UNO.
  assert.ok(!vistasEnBarra.has('templates'),
    '🔴 `Plantillas` ha vuelto a la barra. El diseño §B1 la quiere solo como pestaña dentro de ' +
    'Presupuestos («se usa desde ahí y solo desde ahí»): dos caminos es el desorden que B1 arregla.');
  const tabs = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/quotesTabs.js'), 'utf8');
  assert.match(tabs, /vista: 'templates'/,
    '🔴 `Plantillas` no está en la barra Y la pestaña no la declara: la vista `templates` se ha ' +
    'quedado sin ningún camino. Que CARGUE de verdad lo mide `scrum432`; esto es la composición.');
});

// ═══ ② ENUMERA CONTRA EL DISEÑO: qué falta Y qué sobra ════════════════════════════════════

test('SCRUM-420 · ② toda entrada del diseño está en la barra, o es una AUSENCIA con ticket', () => {
  const sinTraducir = [];
  const faltan = [];
  for (const e of DISENO.entradas) {
    const clave = normalizar(e.rotulo);
    if (!(clave in VISTA_POR_ROTULO)) { sinTraducir.push(e.rotulo); continue; }
    const vista = VISTA_POR_ROTULO[clave];
    if (vista && vistasEnBarra.has(vista)) continue;
    if (clave in AUSENCIAS_CONOCIDAS) continue; // declarada, y con ticket (se exige abajo)
    faltan.push(`«${e.rotulo}» (grupo ${e.grupo})`);
  }
  assert.deepEqual(sinTraducir, [],
    '🔴 el diseño propone entradas que el cruce no sabe traducir a una vista. NO se ignoran: un ' +
    'cruce incompleto tiene que ser ruidoso:\n   · ' + sinTraducir.join('\n   · '));
  assert.deepEqual(faltan, [],
    '🔴 FALTAN en la barra entradas que el diseño §B1 pide, y no están declaradas como ausencia ' +
    'conocida:\n   · ' + faltan.join('\n   · '));
});

test('SCRUM-420 · ② toda entrada de la barra la pide el diseño, o está DECLARADA como añadida', () => {
  const rotulosDelDiseno = new Set(DISENO.entradas.map((e) => normalizar(e.rotulo)));
  const vistasDelDiseno = new Set(
    [...rotulosDelDiseno].map((r) => VISTA_POR_ROTULO[r]).filter(Boolean));

  const sobran = BARRA.entradas
    .filter((e) => !e.esSubitem)
    .filter((e) => !vistasDelDiseno.has(e.vista) && !(e.vista in ANADIDAS_DECLARADAS))
    .map((e) => `«${e.rotulo}» → ${e.vista} (grupo ${e.grupo})`);

  assert.deepEqual(sobran, [],
    '🔴 SOBRAN en la barra entradas que el diseño no lista y que nadie ha declarado. Este lado del ' +
    'guard existe por un caso real: en el bloque G la cuenta de bloques cuadraba y uno de ellos no ' +
    'era el que el diseño pedía (SCRUM-411, 3ª entrega). Mirar solo lo que falta no es ' +
    'contrastar:\n   · ' + sobran.join('\n   · '));
});

test('SCRUM-420 · ② `Cobros` sale como AUSENCIA CONOCIDA, no en silencio', () => {
  // Control positivo del mecanismo de ausencias: si mañana alguien construye la pantalla de Cobros
  // y pone su entrada, este test NO cae — cae el de abajo, que exige que la declaración se retire.
  assert.ok('cobros' in AUSENCIAS_CONOCIDAS,
    '🔴 `Cobros` es la única entrada del diseño que no está en la barra y tiene que estar ' +
    'declarada. Una ausencia que no se nombra es una ausencia perdida.');
  assert.equal(VISTA_POR_ROTULO.cobros, null,
    '🔴 si `Cobros` ya tiene vista, deja de ser una ausencia: quita la declaración y pon la entrada.');
  assert.ok(!ROUTER.has('cobros'),
    '🔴 la vista `cobros` YA EXISTE en el router. Buena noticia, y la barra tiene que reflejarla: ' +
    'añade la entrada (rótulo «Cobros», ya aprobado) y retira la ausencia de `AUSENCIAS_CONOCIDAS`.');
});

test('SCRUM-420 · toda ausencia conocida cita un ticket ABIERTO y explica por qué', () => {
  // 🔴 LA LECCIÓN DE ESTE TICKET, convertida en guard. El hueco de la sidebar estaba declarado en
  // `docs/master/SCRUM-284.md:416` y SCRUM-284 se CERRÓ: un hueco anotado en un ticket cerrado no
  // está en ninguna lista. Por eso aquí el ticket es obligatorio y no basta con el motivo.
  for (const [clave, d] of Object.entries(AUSENCIAS_CONOCIDAS)) {
    assert.match(String(d.ticket), /^SCRUM-\d+$/,
      `🔴 la ausencia «${clave}» no cita ningún ticket. Un hueco sin ticket abierto no es un hueco ` +
      'declarado: es uno que todavía no se ha notado.');
    assert.ok(d.motivo && d.motivo.length > 60,
      `🔴 la ausencia «${clave}» no explica por qué no está ni qué la va a cerrar.`);
  }
});

test('SCRUM-420 · toda añadida declarada explica por qué está en la barra', () => {
  assert.ok(Object.keys(ANADIDAS_DECLARADAS).length >= 1,
    '🔴 suelo: sin ninguna añadida, este test pasaría por vacío y no diría nada.');
  for (const [clave, d] of Object.entries(ANADIDAS_DECLARADAS)) {
    assert.ok(d.motivo && d.motivo.length > 60,
      `🔴 la añadida «${clave}» no explica por qué está en la barra si el diseño no la lista.`);
  }
  // SCRUM-432: `templates` ya no es una añadida — dejó de estar en la barra. Pasó a
  // `VISTAS_SIN_ENTRADA`, y allí se le sigue exigiendo su ticket (abajo).
  assert.ok(!('templates' in ANADIDAS_DECLARADAS),
    '🔴 `Plantillas` no puede estar declarada como añadida Y fuera de la barra a la vez: una de ' +
    'las dos listas está mintiendo.');
});

// ═══ ③ LAS VISTAS SIN ENTRADA, TAMBIÉN ENUMERADAS ════════════════════════════════════════

test('SCRUM-420 · ③ toda vista del router tiene entrada, o está declarada sin ella', () => {
  const huerfanas = [...ROUTER]
    .filter((v) => !vistasEnBarra.has(v) && !(v in VISTAS_SIN_ENTRADA))
    .sort();
  assert.deepEqual(huerfanas, [],
    '🔴 hay pantallas construidas a las que la barra no lleva y que nadie ha declarado. Una ' +
    'pantalla sin camino es trabajo entregado que el profesional no puede alcanzar:\n   · ' +
    huerfanas.join('\n   · '));
});

test('SCRUM-420 · ③ `operarios` es excepción CONOCIDA y cita SCRUM-433', () => {
  // El asesor: «una excepción sin ticket deja de ser excepción y pasa a ser el comportamiento».
  assert.ok(ROUTER.has('operarios'), 'suelo: si la vista ya no existe, esta excepción sobra.');
  assert.equal(VISTAS_SIN_ENTRADA.operarios.ticket, 'SCRUM-433',
    '🔴 `operarios` no puede pasar de largo en silencio: se mide en SCRUM-433.');
  assert.equal(VISTAS_SIN_ENTRADA.export.ticket, 'SCRUM-420',
    '🔴 `export` sale de la barra en ESTE ticket: su declaración tiene que decirlo.');
  assert.equal(VISTAS_SIN_ENTRADA.templates.ticket, 'SCRUM-432',
    '🔴 `templates` salió de la barra en SCRUM-432 y su declaración tiene que citarlo: una vista ' +
    'sin entrada y sin ticket deja de ser una decisión y pasa a ser un olvido.');
});

// ═══ ④ LO QUE YA FUNCIONABA SIGUE FUNCIONANDO ════════════════════════════════════════════

test('SCRUM-420 · ④ los submenús de Configuración siguen intactos y alcanzables', async () => {
  const mapa = (await import('../public/dashboard/js/settingsSubmenus.js')).default;
  assert.equal(mapa.SUBMENUS.length, 10,
    '🔴 esta barra NO rehace Configuración: los diez submenús de B1 están construidos y ' +
    'alcanzables, y se quedan como están.');
  assert.ok(vistasEnBarra.has('settings'),
    '🔴 sin entrada `Configuración` los diez submenús quedan inalcanzables de un plumazo.');
  // El enlace nuevo vive DENTRO de «Tus datos», así que ese submenú deja de estar vacío. Las dos
  // mitades van juntas: el trinquete de SCRUM-284 (sentido ④) cae si se separan.
  assert.equal(mapa.ASIGNACION_SUPERFICIE.renderDescargarDatosCard, 'datos',
    '🔴 el enlace a «Descargar datos» tiene que estar colocado en el mapa, no a mano.');
  assert.ok(!('datos' in mapa.VACIOS_DECLARADOS),
    '🔴 `datos` ya tiene contenido y sigue declarado vacío. Un hueco declarado que ya no lo es ' +
    'deja de ser una nota y pasa a ser un permiso.');
});

test('SCRUM-420 · ④ el rótulo del Libro de registro pierde el marcador y NADA MÁS lo lleva', () => {
  const html = fs.readFileSync(F_HTML, "utf8");
  assert.match(html, /id="nav-libro-registro-label">Libro de registro</,
    '🔴 el rótulo aprobado es exactamente «Libro de registro», sin marcador.');
  const conMarcador = BARRA.entradas
    .filter((e) => e.rotulo.includes('[PENDIENTE'))
    .map((e) => `${e.vista}: ${e.rotulo}`);
  assert.deepEqual(conMarcador, [],
    '🔴 queda microcopy sin aprobar en la barra. Es lo primero que ve el profesional cada día:\n   · ' +
    conMarcador.join('\n   · '));
});

test('SCRUM-420 · ④ los grupos son los del diseño, en su orden', () => {
  // El diseño los escribe en mayúsculas dentro del bloque; la barra los escribe en capital y el
  // CSS los sube (`text-transform: uppercase`). Se comparan normalizados, que es lo que ve el ojo.
  const delDiseno = DISENO.grupos.filter((g) => g !== '(sin rótulo)').map(normalizar);
  assert.deepEqual(BARRA.grupos.map(normalizar), delDiseno,
    `🔴 los grupos de la barra no son los del diseño ni en contenido ni en orden.\n` +
    `   diseño: ${delDiseno.join(' · ')}\n   barra : ${BARRA.grupos.map(normalizar).join(' · ')}`);
  // Y los tres primeros van SIN rótulo de grupo: «son el trabajo del día».
  const primeros = BARRA.entradas.slice(0, 3).map((e) => e.vista);
  assert.deepEqual(primeros, ['home', 'quote-requests', 'jobs'],
    '🔴 los tres primeros tienen que ir sin rótulo de grupo y en el orden del diseño.');
});
