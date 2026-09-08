// tests/scrum821-la-lista-que-decide-que-se-mira.test.mjs — SCRUM-821
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔒 LA LISTA QUE DECIDE QUÉ SE MIRA ERA LA ÚNICA QUE NADIE MIRABA.
//
// `AUTH_VIEWS`, en `capture-demo.mjs`, era la CUARTA lista mantenida a mano de este árbol — y la
// que decide qué entra en el barrido visual. `HASH_VIEWS` tiene cinco ficheros de tests
// vigilándola; ésta tenía **cero**. Medido el 7-sep-2026, antes de tocar nada:
//
//   el menú OFRECE ....... 17
//   el barrido FOTOGRAFÍA. 12  (once del menú + `quotes-new`)
//   sin fotografiar ...... jobs · albaranes · partes-oficina · cobros · libro-registro · plans
//
// Son la cadena Tecnosel entera —trabajo, albarán, parte por valorar, cobro, libro de registro—:
// el recorrido del único usuario real que tiene el producto.
//
// 🔴 Y ESO EXPLICA SCRUM-720, que costó un día: la pantalla del parte llegó a producción sin CSS
// y con 26 marcadores a la vista **con el recorrido diciendo 8/8**. Con seis pantallas fuera del
// barrido, ese 8/8 no podía haber sido otra cosa.
//
// ⚠️ Y contra `HASH_VIEWS` faltaban DOS MÁS que el hallazgo no nombraba: `export` y `templates`.
// **Ocho, no seis.** Por eso ahora la lista se DERIVA de `HASH_VIEWS` — la que ya está vigilada —
// y este fichero compara las dos poblaciones en cada tanda.
//
// ⛔ `HASH_VIEWS` y sus cinco tests no se tocan: funcionan, y son el ejemplo que se copia.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  vistasDelMenu, vistasNavegablesPorHash, vistasDelBarrido, cotejarPoblaciones, HUECOS_DECLARADOS,
} from '../scripts/_vistas-del-barrido.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ═══ 🔴 SUELO ═════════════════════════════════════════════════════════════════════════════

test('SCRUM-821 · 🔴 SUELO: las dos poblaciones se leen, o esto se declara ciego', () => {
  const menu = vistasDelMenu(RAIZ);
  const hash = vistasNavegablesPorHash(RAIZ);
  assert.ok(menu.length >= 17,
    `🔴 sólo ${menu.length} destinos en el menú. Con esa población, «ninguna sin fotografiar» `
    + 'significaría que no he mirado.');
  assert.ok(hash.length >= menu.length,
    `🔴 \`HASH_VIEWS\` (${hash.length}) es más corta que el menú (${menu.length}): la derivación `
    + 'estaría dejando fuera pantallas que el menú sí ofrece.');

  // Y los suelos LANZAN de verdad, no devuelven cero: se prueba con un árbol que no existe.
  assert.throws(() => vistasDelMenu(path.join(RAIZ, 'no', 'existe')), /ENOENT|CIEGO/);
});

// ═══ 🔴 EL COTEJO, POR CONJUNTOS ══════════════════════════════════════════════════════════

test('SCRUM-821 · 🔴 toda pantalla que el menú OFRECE, el barrido la FOTOGRAFÍA', () => {
  const menu = vistasDelMenu(RAIZ);
  const foto = vistasDelBarrido(RAIZ).map((v) => v.vista);
  const { sinFoto, huecosVigentes } = cotejarPoblaciones(menu, foto);

  assert.deepEqual(sinFoto, [],
    `🔴 ${sinFoto.length} pantalla(s) que el menú ofrece y el barrido NO fotografía:\n`
    + `    ${sinFoto.join('\n    ')}\n`
    + '  Lo que no se fotografía no se mira, y lo que no se mira llega a producción sin CSS con el\n'
    + '  recorrido diciendo 8/8 (SCRUM-720). Si alguna NO SE PUEDE fotografiar, decláralas en\n'
    + '  `HUECOS_DECLARADOS` con su motivo: un hueco declarado se ve, uno callado no.');

  // Y si hay huecos declarados, se nombran en verde para que no se olviden.
  if (huecosVigentes.length) {
    console.log(`\n  ⚠️ ${huecosVigentes.length} hueco(s) DECLARADO(S), no callados:`);
    for (const v of huecosVigentes) console.log(`     ${v} — ${HUECOS_DECLARADOS[v]}`);
  }
});

test('SCRUM-821 · 🔴 CONJUNTOS, no cuentas: la comparación nombra QUIÉN falta', () => {
  // 🔴 La lección de SCRUM-727: doce y doce puede ser doce aciertos o seis y seis. Se prueba con
  // poblaciones inventadas —del mismo TAMAÑO— para que sólo pueda pasar comparando identidades.
  const r = cotejarPoblaciones(['a', 'b', 'c'], ['a', 'x', 'y']);
  assert.deepEqual(r.sinFoto, ['b', 'c'],
    '🔴 el cotejo da por bueno un conjunto distinto del mismo tamaño: está contando, no comparando.');
});

test('SCRUM-821 · 🔴 EL ROJO DEL MECANISMO VIEJO: con la lista a mano faltaban SEIS', () => {
  // La lista que `capture-demo.mjs` llevaba escrita a mano hasta el 7-sep-2026. Se conserva como
  // DATO para que el detector tenga que seguir sabiendo cazar el defecto que motivó el ticket: un
  // guard que ya no puede ponerse rojo ante su propio caso no es un guard, es un comentario.
  const LISTA_A_MANO = ['home', 'quotes-new', 'quotes-list', 'customers', 'products', 'invoices',
    'reports', 'quote-requests', 'expenses', 'providers', 'team', 'settings'];

  const { sinFoto } = cotejarPoblaciones(vistasDelMenu(RAIZ), LISTA_A_MANO);
  assert.deepEqual(sinFoto,
    ['albaranes', 'cobros', 'jobs', 'libro-registro', 'partes-oficina', 'plans'],
    '🔴 el cotejo ya no caza el defecto original: con la lista vieja fallaban EXACTAMENTE esas '
    + 'seis — la cadena Tecnosel entera— y tiene que seguir diciendo cuáles son.');
  assert.equal(sinFoto.length, 6);
});

// ═══ ✅ CONTROL POSITIVO, ENUMERADO ═══════════════════════════════════════════════════════

test('SCRUM-821 · ✅ las 17 del menú se fotografían, una a una', () => {
  const foto = new Set(vistasDelBarrido(RAIZ).map((v) => v.vista));
  const faltan = [];
  for (const vista of vistasDelMenu(RAIZ)) if (!foto.has(vista)) faltan.push(vista);
  assert.deepEqual(faltan, [], `🔴 no se fotografían: ${faltan.join(', ')}`);

  // Y las SEIS del hallazgo, nombradas: si alguna vuelve a caerse, el rojo dice cuál.
  for (const v of ['jobs', 'albaranes', 'partes-oficina', 'cobros', 'libro-registro', 'plans']) {
    assert.ok(foto.has(v),
      `🔴 «${v}» ha vuelto a quedarse fuera del barrido. Es una de las seis de la cadena Tecnosel.`);
  }
  // Y las dos que el hallazgo original no vio.
  for (const v of ['export', 'templates']) {
    assert.ok(foto.has(v), `🔴 «${v}» fuera del barrido: contra \`HASH_VIEWS\` faltaban OCHO, no seis.`);
  }
});

test('SCRUM-821 · ✅ el barrido no se inventa pantallas: todo lo que fotografía es navegable', () => {
  // El contrapeso: sin esto, «no falta ninguna» se podría conseguir fotografiando cosas de más.
  const hash = new Set(vistasNavegablesPorHash(RAIZ));
  const inventadas = vistasDelBarrido(RAIZ).map((v) => v.vista).filter((v) => !hash.has(v));
  assert.deepEqual(inventadas, [],
    `🔴 el barrido visita ${inventadas.length} vista(s) que no son navegables por hash: `
    + `${inventadas.join(', ')}. Una captura de una URL que no abre nada es una imagen en blanco.`);
});

// ═══ ✅ CONTROL NEGATIVO: TIENE QUE PODER VOLVER A PONERSE ROJO ═══════════════════════════

test('SCRUM-821 · ✅ CONTROL NEGATIVO: quitar una del barrido lo pone ROJO, NOMBRÁNDOLA', () => {
  // 🔴 Si tras el arreglo no puede volver a ponerse rojo, no es un guard: es un comentario.
  const menu = vistasDelMenu(RAIZ);
  const foto = vistasDelBarrido(RAIZ).map((v) => v.vista);

  // Se le quita `partes-oficina` — la que cae justo dentro del hueco que motivó el ticket.
  const mutilado = foto.filter((v) => v !== 'partes-oficina');
  const r = cotejarPoblaciones(menu, mutilado);
  assert.deepEqual(r.sinFoto, ['partes-oficina'],
    '🔴 quitar una pantalla del barrido NO pone el cotejo en rojo, o no dice cuál falta.');

  // Y quitando dos, salen las dos: el rojo no se queda en la primera.
  const dos = foto.filter((v) => v !== 'jobs' && v !== 'cobros');
  assert.deepEqual(cotejarPoblaciones(menu, dos).sinFoto, ['cobros', 'jobs']);
});

test('SCRUM-821 · ✅ un hueco DECLARADO no enrojece, y uno CADUCADO se dice', () => {
  // Declarar un hueco lo hace visible sin romper la tanda — que es la diferencia entre un hueco
  // que se ve y uno que se calla. Y cuando deja de serlo, hay que enterarse.
  const huecos = { plans: 'de mentira, sólo para este control' };
  const menu = ['home', 'plans'];
  assert.deepEqual(cotejarPoblaciones(menu, ['home'], huecos).sinFoto, [],
    '🔴 un hueco declarado sigue enrojeciendo: entonces nadie declarará ninguno');
  assert.deepEqual(cotejarPoblaciones(menu, ['home'], huecos).huecosVigentes, ['plans']);
  assert.deepEqual(cotejarPoblaciones(menu, ['home', 'plans'], huecos).huecosCaducados, ['plans'],
    '🔴 un hueco que ya no lo es pasa desapercibido, y la declaración se pudre');
});

// ═══ 📌 LA LISTA YA NO SE MANTIENE A MANO ═════════════════════════════════════════════════

test('SCRUM-821 · 📌 `capture-demo.mjs` DERIVA su lista, no la escribe', async () => {
  const { leerFuente } = await import('./_guard-texto.mjs');
  const src = leerFuente(path.join(RAIZ, 'scripts/capture-demo.mjs'), { ancla: 'AUTH_VIEWS' });

  assert.match(src, /vistasDelBarrido\(/,
    '🔴 `capture-demo.mjs` ha dejado de derivar su lista. Volver a escribirla a mano es volver al '
    + 'defecto: la lista que decide qué se mira sería otra vez la única que nadie mira.');
  assert.doesNotMatch(src, /\['\d\d-[a-z-]+',\s*'\/dashboard\/#/,
    '🔴 ha vuelto una lista de pantallas escrita a mano en `capture-demo.mjs`.');
});
