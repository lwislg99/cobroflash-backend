// tests/scrum655c-pantalla-revisiones.test.mjs — SCRUM-655c (fila 9)
//
// LA VÍCTIMA: un gerente que manda al cliente la versión equivocada de `P2004226.1` porque la
// pantalla le enseñó dos «vigentes», o le dijo «ésta es la única» de un presupuesto que tiene tres.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL TEST QUE VALE MÁS QUE LOS DEMÁS, Y NO ES EL DE «DOS VIGENTES»
//
// El empate ya está resuelto en el servidor: `vistaDeRevisiones` llama a `vigenteUnicaDe` ANTES de
// mapear, y ésa LANZA. Medido el 3-sep-2026, ejecutado:
//
//     esVigente(A) → true          esVigente(B) → true
//     vigenteUnicaDe(empate) → RevisionesAmbiguas
//     vigenteUnicaDe([])     → CensoDeRevisionesCiego
//
// Así que lo que hay que vigilar NO es que la pantalla pinte bien un empate: es que **no pueda
// llegar a verlo**. Si deriva la vigente por su cuenta, se salta esa puerta y pinta dos sin que
// nada falle. Un mecanismo que ya no se puede eludir vale más que uno que se comprueba.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const MODULO = path.join(RAIZ, 'public', 'dashboard', 'js', 'quoteRevisiones.js');
const FUENTE = fs.readFileSync(MODULO, 'utf8');

// El payload tal y como lo manda `getQuoteDetailAdmin` (`quoteAdmin.ts:154-163`).
const TRES = {
  numeroConRevision: 'P2004226.2',
  vigenteId: 33,
  revisiones: [
    { id: 11, revision: 0, numero: 'P2004226', status: 'sent', firmado: true, total: '1200.00', vigente: false },
    { id: 22, revision: 1, numero: 'P2004226.1', status: 'sent', firmado: false, total: '1310.00', vigente: false },
    { id: 33, revision: 2, numero: 'P2004226.2', status: 'draft', firmado: false, total: '1290.00', vigente: true },
  ],
};

function montar() {
  const contenedor = { innerHTML: '' };
  const ctx = { console, window: null, Date, Array, Object, String, Number, JSON };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(FUENTE, ctx, { filename: 'quoteRevisiones.js' });
  return { ctx, contenedor };
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL INVARIANTE: la pantalla NO decide cuál es la vigente
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Los patrones con los que una pantalla DERIVA la vigente en vez de recibirla. */
const DERIVAR = [
  { patron: /Math\.max/, que: 'Math.max — está buscando la revisión más alta' },
  { patron: /\.sort\s*\(/, que: 'un sort — está ordenando para quedarse con una' },
  { patron: /revision\s*[<>]/, que: 'una comparación de `revision`' },
  { patron: /[<>]=?\s*[a-zA-Z_$][\w$]*\.revision\b/, que: 'una comparación contra `.revision`' },
  { patron: /\besVigente\s*\(/, que: 'una llamada a esVigente — ése es el que empata' },
  { patron: /\bvigenteDe\s*\(/, que: 'vigenteDe — el que resuelve el empate en silencio' },
];

test('SCRUM-655c · 🔴 EL INVARIANTE: la pantalla no deriva la vigente, la RECIBE', () => {
  const codigo = soloCodigo(FUENTE, 'quoteRevisiones.js');

  // SUELO del despojador: la cabecera de este módulo EXPLICA lo que prohíbe —cita `esVigente`,
  // `vigenteDe` y `Math.max`—, así que sobre el fichero entero este guard se cazaría a sí mismo.
  // Si el despojador se comiera el código, «no deriva» sería cierto y hueco.
  assert.ok(codigo.includes('function pintarRevisiones'),
    '🔴 CIEGO: el despojador se ha llevado el código que hay que mirar');
  assert.ok(/esVigente|vigenteDe|Math\.max/.test(FUENTE),
    '🔴 CIEGO AL REVÉS: el fichero ya no menciona esos nombres ni en sus comentarios, así que este ' +
    'guard no está distinguiendo comentario de código — no prueba nada.');

  const derivando = DERIVAR.filter((d) => d.patron.test(codigo)).map((d) => d.que);
  assert.deepEqual(derivando, [],
    '🔴 LA PANTALLA ESTÁ DERIVANDO CUÁL ES LA VIGENTE: ' + derivando.join(' · ') + '.\n' +
    '   Esa pregunta la contesta el servidor (`vistaDeRevisiones` → `vigente` y `vigenteId`), y\n' +
    '   contestarla otra vez aquí es tener DOS criterios para un mismo hecho.\n' +
    '   🔴 Y NO ES ESTILO, ESTÁ MEDIDO: ante un empate `esVigente` devuelve `true` para LAS DOS\n' +
    '   filas. El servidor no deja que eso llegue —`vigenteUnicaDe` LANZA antes de mapear—, pero\n' +
    '   una pantalla que deriva por su cuenta se salta esa puerta y pinta dos vigentes sin que\n' +
    '   falle nada. Usa el `vigente` que ya viene en cada fila.');

  // CONTROL POSITIVO del detector: sobre una pantalla que SÍ deriva, tiene que saltar. Sin esto,
  // un detector roto —una regex que no casa nunca— daría exactamente el mismo verde.
  const QUE_DERIVA = 'var alta = Math.max.apply(null, filas.map(function (f) { return f.revision; }));';
  assert.ok(DERIVAR.some((d) => d.patron.test(QUE_DERIVA)),
    '🔴 el detector no caza ni el caso evidente: su verde no significaría nada');
});

test('SCRUM-655c · 🔴 Y CAE CON EL MECANISMO VIEJO: el `vigente` sale del payload, no del orden', () => {
  const { ctx, contenedor } = montar();

  // El payload dice que la vigente es la 33. Se le da la lista en un orden que induce a error —la
  // vigente NO es la última— para que un «me quedo con la última» quede a la vista.
  const desordenado = {
    vigenteId: 33,
    revisiones: [
      { id: 33, revision: 2, numero: 'P2004226.2', firmado: false, vigente: true },
      { id: 11, revision: 0, numero: 'P2004226', firmado: true, vigente: false },
      { id: 22, revision: 1, numero: 'P2004226.1', firmado: false, vigente: false },
    ],
  };
  ctx.pintarRevisiones(contenedor, desordenado, 33);

  const vigentes = (contenedor.innerHTML.match(/data-revision-vigente="1"/g) || []).length;
  assert.equal(vigentes, 1, `🔴 se han pintado ${vigentes} vigentes y el payload declara UNA`);
  assert.ok(/data-revision-fila="33"[^>]*data-revision-vigente="1"/.test(contenedor.innerHTML),
    '🔴 la marca de vigente NO está en la fila que el servidor dice. Si se estuviera derivando por ' +
    'orden o por revisión más alta, aquí se vería: la vigente viene la PRIMERA a propósito.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL SUELO: cero revisiones es CEGUERA
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-655c · 🔴 SUELO: cero revisiones NO se pinta como «esta es la única versión»', () => {
  const { ctx, contenedor } = montar();

  for (const roto of [null, undefined, {}, { revisiones: [] }, { revisiones: 'nada' }]) {
    contenedor.innerHTML = '';
    const ok = ctx.pintarRevisiones(contenedor, roto, 1);
    assert.equal(ok, false, `🔴 «${JSON.stringify(roto)}» se ha dado por pintado`);
    assert.ok(contenedor.innerHTML.includes('data-revisiones-ciego="1"'),
      '🔴 UN CERO SE ESTÁ PINTANDO COMO «no hay otras versiones». Todo presupuesto es al menos la ' +
      'suya: un cero aquí es el grupo mal armado, y con él el gerente manda al cliente una versión ' +
      'creyendo que no hay otra.');
    assert.ok(!contenedor.innerHTML.includes('data-revisiones-unica="1"'),
      '🔴 se está afirmando «única versión» sin poder leer la lista');
  }

  // Y `revisionesOCeguera` distingue las dos cosas, que es de donde sale todo lo anterior.
  assert.equal(ctx.revisionesOCeguera({ revisiones: [] }), null);
  assert.equal(ctx.revisionesOCeguera(TRES).length, 3, '🔴 el lector no ve las que sí están');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONTROL POSITIVO y la regla de lo firmado
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-655c · CONTROL POSITIVO: un presupuesto SIN revisiones se pinta como hoy', () => {
  const { ctx, contenedor } = montar();
  const UNA = { vigenteId: 5, revisiones: [{ id: 5, revision: 0, numero: 'P2004230', firmado: false, vigente: true }] };

  const ok = ctx.pintarRevisiones(contenedor, UNA, 5);
  assert.equal(ok, true, 'una sola versión es un caso legítimo, no una ceguera');
  assert.ok(contenedor.innerHTML.includes('data-revisiones-unica="1"'),
    '🔴 no se dice que es la única versión');
  assert.ok(!contenedor.innerHTML.includes('data-revisiones-lista="1"'),
    '🔴 se pinta un selector de UNA cosa: eso es ruido, no información');
  // Y su número sale enumerado, sin «.0» — como salía antes de que existiera esto.
  assert.ok(!contenedor.innerHTML.includes('.0'), '🔴 ha aparecido un «.0» que el papel no lleva');
});

test('SCRUM-655c · 🔴 una revisión FIRMADA no se ofrece para editar', () => {
  const { ctx, contenedor } = montar();

  assert.equal(ctx.puedeEditarseLaRevision({ firmado: true }), false,
    '🔴 se ofrece editar una revisión FIRMADA. Un presupuesto firmado no se reescribe: pedir ' +
    'cambios sobre él crea una revisión NUEVA. Editarlo sería cambiar lo que el cliente firmó.');
  assert.equal(ctx.puedeEditarseLaRevision({ firmado: false }), true);

  ctx.pintarRevisiones(contenedor, TRES, 33);
  const html = contenedor.innerHTML;
  assert.ok(/data-revision-fila="11"[\s\S]*?data-revision-etiqueta="firmada"/.test(html),
    '🔴 la revisión firmada no se marca como tal');
  // ⛔ Y en ninguna fila hay un camino de edición ni de creación: esta pantalla es SOLO lectura.
  assert.ok(!/data-revision-editar|data-revision-nueva|Crear revisi/i.test(html),
    '🔴 la pantalla ofrece crear o editar una revisión. El POST que la crea NO está aprobado, y ' +
    'un botón que el servidor no atiende es peor que no tenerlo.');
});

test('SCRUM-655c · la versión abierta no se ofrece «ver», y las otras sí', () => {
  const { ctx, contenedor } = montar();
  ctx.pintarRevisiones(contenedor, TRES, 33);
  const html = contenedor.innerHTML;

  assert.ok(!html.includes('data-revision-ver="33"'),
    '🔴 se ofrece «ver» la versión que ya está abierta');
  assert.ok(html.includes('data-revision-ver="11"') && html.includes('data-revision-ver="22"'),
    '🔴 no se puede llegar a las otras versiones: entonces el selector no selecciona');
  assert.ok(html.includes('P2004226.1'), '🔴 no se pinta el número con su revisión');
});

test('SCRUM-655c · ⛔ el módulo no toca dinero ni pinta importes', () => {
  const codigo = soloCodigo(FUENTE, 'quoteRevisiones.js');
  for (const patron of [/€/, /\btotal\b/, /precio/i]) {
    assert.ok(!patron.test(codigo),
      `🔴 el selector de revisiones pinta dinero (${patron}). Compara versiones, no importes: el ` +
      'total de cada una se ve al abrirla.');
  }
});
