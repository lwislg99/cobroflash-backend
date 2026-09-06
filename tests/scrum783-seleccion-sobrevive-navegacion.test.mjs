// tests/scrum783-seleccion-sobrevive-navegacion.test.mjs — SCRUM-783 (CONT-09)
//
// Sin gate: banco de vistas. Ni BD, ni red, ni navegador.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA SELECCIÓN SOBREVIVE A LA NAVEGACIÓN. NO SOBREVIVE A RECARGAR.
//
// LA VÍCTIMA: el profesional marca doce clientes, entra en la ficha de uno para comprobar algo
// ANTES de actuar sobre los doce, y vuelve. Hasta hoy había perdido los doce, sin aviso.
// Comprobar antes de actuar es lo que hace alguien prudente, y el mecanismo castigaba la
// prudencia. Decisión del asesor, 6-sep-2026.
//
// ── 🔴 LOS TRES QUE DECIDEN, Y EL TERCERO ES EL LÍMITE ──────────────────────────────────────
// ① Marcar tres, navegar a la ficha 360, volver → siguen los TRES. Medido antes: 3 → 0.
// ② FILTRAR sigue RECORTANDO. Es el comportamiento bueno de SCRUM-582 y este ticket no puede
//    cambiarlo: si se guardara lo que ya no se ve, el contador diría «12» con tres filas en
//    pantalla, y así es como se borra lo que nadie quería borrar.
// ③ RECARGAR vacía la selección. Sin este control, «sobrevive» se convierte en «no se va nunca»,
//    que es pasarse de frenada y tiene precedente.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
// 🔴 EL LECTOR OFICIAL de mutaciones, importado y no reescrito.
import { mutacionesDeclaradas } from '../scripts/meta-guard-mutaciones.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const VISTA = path.join(RAIZ, 'public/dashboard/js/customersView.js');
const ESTE_FICHERO = path.join(RAIZ, 'tests/scrum783-seleccion-sobrevive-navegacion.test.mjs');

const CLIENTES = [
  { id: 1, name: 'Fincas Soler', phone: '34000000001', email: 'a@b.es', notes: '', createdAt: '2026-01-15T10:00:00Z' },
  { id: 2, name: 'Carmen Ruiz', phone: '34000000002', email: 'c@d.es', notes: '', createdAt: '2026-02-20T10:00:00Z' },
  { id: 3, name: 'Talleres Vega', phone: '34000000003', email: 'e@f.es', notes: '', createdAt: '2026-03-05T10:00:00Z' },
];

/**
 * 🔴 UNA «PÁGINA»: un contexto nuevo del banco. Los scripts clásicos se evalúan UNA vez por carga,
 * así que un contexto nuevo es literalmente una RECARGA — y ésa es la línea que separa lo que este
 * ticket conserva de lo que tira. Volver a montar la vista DENTRO de la misma página es navegar.
 *
 * El mock HONRA `?search=`: sin eso la lista devolvería siempre los tres y el caso del buscador no
 * se ejercitaría. Es el defecto que declaré sin medir en SCRUM-582.
 */
function nuevaPagina() {
  return cargarDashboard(RAIZ, {
    datos: (url) => {
      const u = String(url || '');
      if (/\/admin\/customers/.test(u)) {
        const q = (u.match(/[?&]search=([^&]*)/) || [])[1];
        if (!q) return CLIENTES;
        const t = decodeURIComponent(q).toLowerCase();
        return CLIENTES.filter((c) => (c.name + ' ' + c.phone + ' ' + c.email).toLowerCase().includes(t));
      }
      if (/\/admin\/merchant/.test(u)) return { id: 1, name: 'Fontanería Soler' };
      return [];
    },
  });
}

const TODOS = 'Seleccionar todos';
const enTd = (x) => { let p = x._padre; while (p) { if (p.tagName === 'TD') return true; p = p._padre; } return false; };
const casillasFila = (raiz) => todos(raiz).filter((n) => n.tagName === 'INPUT' && n.type === 'checkbox'
  && n.getAttribute && n.getAttribute('aria-label') && n.getAttribute('aria-label') !== TODOS && enTd(n));
const barra = (raiz) => todos(raiz).find((n) => n.tagName === 'DIV'
  && (n.hijos || []).some((x) => x.tagName === 'INPUT' && x.getAttribute && x.getAttribute('aria-label') === TODOS));
const contador = (raiz) => { const b = barra(raiz); return b ? todos(b).find((n) => n.tagName === 'SPAN' && /seleccionad/.test(String(n.textContent || ''))) : null; };
const buscador = (raiz) => todos(raiz).find((n) => n.tagName === 'INPUT' && n.type !== 'checkbox'
  && String(n.placeholder || '').toLowerCase().includes('busc'));
const marcadas = (raiz) => casillasFila(raiz).filter((c) => c.checked).length;
/** El buscador arranca un `setTimeout` de 300 ms. Esperar menos es NO ejercitar el caso. */
const esperarBusqueda = () => new Promise((r) => setTimeout(r, 450));

/** Monta la lista y marca las tres filas. Devuelve la página, para poder volver a montarla. */
async function conLasTresMarcadas() {
  const pagina = nuevaPagina();
  const r = await pintarVista(pagina, 'renderCustomersView');
  assert.equal(r.error, null, `🔴 la lista no monta: ${r.error && r.error.message}`);
  const cbs = casillasFila(r.contenedor);
  assert.equal(cbs.length, 3, `🔴 CIEGO: ${cbs.length} filas montadas; esperaba 3.`);
  for (const cb of cbs) { cb.checked = true; cb.disparar('change'); }
  assert.equal(marcadas(r.contenedor), 3, '🔴 CIEGO: no consigo marcar las tres ni antes de empezar.');
  return { pagina, r };
}

// ═══ ① EL QUE DECIDE ═════════════════════════════════════════════════════════════════════

test('SCRUM-783 · 🔴 EL QUE DECIDE: marcar tres, ver una ficha y VOLVER deja los TRES', async () => {
  const { pagina, r } = await conLasTresMarcadas();

  // NAVEGAR: se pulsa la fila, que es lo que el producto hace — `openCustomer360` llama a
  // `renderAppView('customer-360')`. NO abre un modal: cambia de vista.
  const fila = todos(r.contenedor).filter((n) => n.tagName === 'TR')
    .find((t) => todos(t).some((x) => x.tagName === 'INPUT' && x.type === 'checkbox'));
  assert.ok(fila, '🔴 CIEGO: no encuentro una fila de cliente que pulsar.');
  fila.disparar('click');

  // VOLVER: la vista se monta OTRA VEZ, en la MISMA página.
  const r2 = await pintarVista(pagina, 'renderCustomersView');
  assert.equal(r2.error, null, `🔴 la lista no vuelve a montar: ${r2.error && r2.error.message}`);

  assert.equal(marcadas(r2.contenedor), 3,
    `🔴 al volver de la ficha quedan ${marcadas(r2.contenedor)} marcadas de 3. El profesional que `
    + 'entra a comprobar algo antes de actuar pierde su trabajo, y el mecanismo castiga al prudente.');
  const c = contador(r2.contenedor);
  assert.ok(c && /^3 clientes seleccionados$/.test(String(c.textContent).trim()),
    `🔴 el contador dice «${c && c.textContent}» al volver, y tenía que decir «3 clientes seleccionados».`);
  // ⚠️ SCRUM-792 movió el `display` de la barra al CSS (la decisión depende del ANCHO y eso sólo
  // lo sabe una `@media`), así que aquí ya NO se puede mirar `style.display`: el banco no evalúa
  // CSS. Lo que sí es contrato del JS —y lo único que este banco puede juzgar— es la CLASE.
  // La visibilidad de verdad se mide en navegador (`scripts/guard-caja-barra-seleccion.mjs`).
  assert.equal(barra(r2.contenedor).classList.contains('barra-seleccion--vacia'), false,
    '🔴 la barra se marca como VACÍA al volver: hay tres seleccionados y el CSS la cerraría.');
});

test('SCRUM-783 · 🔴 y la CASILLA DE CADA FILA lo refleja al volver, no sólo el contador', async () => {
  // Es la mutación de SCRUM-582 (`casillaFila.checked = false` dejaba los catorce tests verdes):
  // que el contador diga 3 no prueba que el profesional VEA sus tres marcas.
  const { pagina, r } = await conLasTresMarcadas();
  todos(r.contenedor).filter((n) => n.tagName === 'TR')
    .find((t) => todos(t).some((x) => x.tagName === 'INPUT' && x.type === 'checkbox'))
    .disparar('click');
  const r2 = await pintarVista(pagina, 'renderCustomersView');
  const cbs = casillasFila(r2.contenedor);
  assert.equal(cbs.length, 3, `🔴 CIEGO: ${cbs.length} casillas tras volver.`);
  assert.deepEqual(cbs.map((c) => c.checked), [true, true, true],
    '🔴 el contador puede decir 3 y las casillas salir apagadas: eso es peor que perder la '
    + 'selección, porque el profesional no sabe sobre qué va a actuar.');
});

// ═══ ② POSITIVO: FILTRAR SIGUE RECORTANDO ════════════════════════════════════════════════

test('SCRUM-783 · ✅ POSITIVO: BUSCAR sigue RECORTANDO la selección, y el recorte es DEFINITIVO', async () => {
  // 🔴 Este caso NO se ejercitaba en SCRUM-582 y lo declaré como hueco. El motivo era medible: el
  // buscador arranca un `setTimeout` de **300 ms** y yo esperaba 60, así que la lista nunca
  // repintaba y el «sobrevive» habría sido un verde sobre nada.
  const { r } = await conLasTresMarcadas();
  const b = buscador(r.contenedor);
  assert.ok(b, '🔴 CIEGO: no encuentro el buscador.');

  b.value = 'Carmen';
  b.disparar('input');
  await esperarBusqueda();
  assert.equal(casillasFila(r.contenedor).length, 1,
    '🔴 CIEGO: la búsqueda no ha repintado, así que este control no está midiendo su caso.');
  assert.equal(marcadas(r.contenedor), 1,
    '🔴 la selección NO se ha recortado a lo visible. Guardar lo que ya no se ve deja un contador '
    + 'que miente, y así es como se borra lo que nadie quería borrar.');

  b.value = '';
  b.disparar('input');
  await esperarBusqueda();
  assert.equal(casillasFila(r.contenedor).length, 3, '🔴 no vuelven las tres filas.');
  assert.equal(marcadas(r.contenedor), 1,
    '🔴 lo recortado ha REAPARECIDO al quitar el filtro. Recortar es definitivo: si volviera, el '
    + 'profesional actuaría sobre clientes que creía haber soltado.');
});

test('SCRUM-783 · 🔴 EL INVARIANTE: nunca hay marcados FUERA de la pantalla', async () => {
  // Es lo que hace que el contador no pueda mentir, y por eso este ticket NO necesita un texto
  // nuevo: si la selección persistiera SIN recortarse, habría seleccionados invisibles y la barra
  // tendría que explicarlo. Con el recorte en cada pintado, «N seleccionados» siempre es N en
  // pantalla. Se comprueba DESPUÉS de navegar, que es lo que este ticket cambia.
  const { pagina, r } = await conLasTresMarcadas();
  const b = buscador(r.contenedor);
  b.value = 'Carmen'; b.disparar('input'); await esperarBusqueda();

  todos(r.contenedor).filter((n) => n.tagName === 'TR')
    .find((t) => todos(t).some((x) => x.tagName === 'INPUT' && x.type === 'checkbox'))
    .disparar('click');
  const r2 = await pintarVista(pagina, 'renderCustomersView');

  const cbs = casillasFila(r2.contenedor);
  const n = cbs.filter((c) => c.checked).length;
  const c = contador(r2.contenedor);
  const dice = Number((String(c && c.textContent).match(/^(\d+)/) || [])[1] ?? -1);
  assert.equal(dice, n,
    `🔴 el contador dice ${dice} y en pantalla hay ${n} casillas marcadas. Hay selección invisible: `
    + 'la barra está mintiendo.');
  assert.ok(n <= cbs.length, '🔴 hay más marcados que filas: imposible salvo que se guarde lo oculto.');
});

// ═══ ③ EL LÍMITE ═════════════════════════════════════════════════════════════════════════

test('SCRUM-783 · ✅ EL LÍMITE: RECARGAR la página vacía la selección', async () => {
  // Sin esto, «sobrevive a la navegación» se convierte en «no se va nunca». Recargar es empezar de
  // cero y así se espera: la decisión del asesor tiene las DOS mitades y las dos se prueban.
  const { r } = await conLasTresMarcadas();
  assert.equal(marcadas(r.contenedor), 3);

  const otra = nuevaPagina();                    // contexto NUEVO = scripts re-evaluados = recarga
  const r2 = await pintarVista(otra, 'renderCustomersView');
  assert.equal(r2.error, null, `🔴 no monta tras recargar: ${r2.error && r2.error.message}`);
  assert.equal(marcadas(r2.contenedor), 0,
    `🔴 tras RECARGAR quedan ${marcadas(r2.contenedor)} marcadas. La selección se ha hecho `
    + 'persistente de verdad, y eso es otra decisión y otro ticket.');
  assert.equal(barra(r2.contenedor).classList.contains('barra-seleccion--vacia'), true,
    '🔴 la barra NO se marca como vacía tras recargar, con cero seleccionados.');
});

// ═══ ④ DÓNDE VIVE EL ESTADO — las dos prohibiciones del encargo ══════════════════════════

test('SCRUM-783 · 🔴 el estado vive en el ÁMBITO DEL SCRIPT: ni en el DOM ni en almacenamiento', async () => {
  const fuente = fs.readFileSync(VISTA, 'utf8');
  const sf = ts.createSourceFile('customersView.js', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

  // (a) `seleccion` se declara en el TOP LEVEL, no dentro de `renderCustomersView`. Si vuelve al
  //     cierre, nace vacía en cada montaje y el ticket se deshace sin que se note.
  let declarada = null;
  const v = (n) => {
    if (ts.isVariableDeclaration(n) && n.name && ts.isIdentifier(n.name) && n.name.text === 'seleccion') {
      let p = n.parent; let dentroDeFuncion = false;
      while (p) { if (ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isArrowFunction(p)) { dentroDeFuncion = true; break; } p = p.parent; }
      declarada = { dentroDeFuncion, linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 };
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  assert.ok(declarada, '🔴 CIEGO: no encuentro la declaración de `seleccion` en la vista.');
  assert.equal(declarada.dentroDeFuncion, false,
    `🔴 \`seleccion\` ha vuelto a declararse DENTRO de una función (línea ${declarada.linea}). En el `
    + 'cierre de `renderCustomersView` nace vacía en cada montaje: la selección se pierde otra vez '
    + 'al volver de la ficha, y ningún test de pantalla lo nota si no se navega.');

  // (b) NI EN EL DOM NI EN ALMACENAMIENTO. Estado colgado del DOM es lo que mató la tecla «N»
  //     (SCRUM-777); `sessionStorage` sobreviviría a la recarga, que es justo lo prohibido.
  const ejecutable = fuente.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  const cerca = ejecutable.split('\n').filter((l) => /seleccion/.test(l));
  assert.ok(cerca.length > 0, '🔴 CIEGO: ninguna línea ejecutable nombra `seleccion`.');

  // 🔴 HERMANO DEL TOKEN (SCRUM-237). Las dos negaciones de abajo son del tipo que se queda VERDE
  // PARA SIEMPRE si el token deja de poder aparecer: nadie sabría si es que no está o es que el
  // detector no lo busca bien. Así que primero se le enseña un caso de RESPUESTA CONOCIDA con las
  // MISMAS expresiones, y las cuatro ramas tienen que casar.
  assert.match('x = sessionStorage.getItem("k")', /sessionStorage|localStorage/,
    '🔴 el detector no ve `sessionStorage`: su «no aparece» de abajo no valdría nada.');
  assert.match('x = localStorage.setItem("k", v)', /sessionStorage|localStorage/,
    '🔴 el detector no ve `localStorage`.');
  assert.match('n.dataset.seleccion = "1"', /\.dataset\.|setAttribute\(\s*['"]data-/,
    '🔴 el detector no ve `.dataset.`.');
  assert.match('n.setAttribute("data-seleccion", "1")', /\.dataset\.|setAttribute\(\s*['"]data-/,
    '🔴 el detector no ve `setAttribute("data-…")`.');
  for (const l of cerca) {
    assert.doesNotMatch(l, /sessionStorage|localStorage/,
      `🔴 la selección se está guardando en almacenamiento: «${l.trim()}». Sobreviviría a RECARGAR, `
      + 'y el asesor decidió que recargar empieza de cero.');
    assert.doesNotMatch(l, /\.dataset\.|setAttribute\(\s*['"]data-/,
      `🔴 la selección se está colgando del DOM: «${l.trim()}». Es lo que mató la tecla «N» en toda `
      + 'la aplicación (SCRUM-777).');
  }
});

// ═══ ⑤ LAS MUTACIONES, LEÍDAS POR EL LECTOR OFICIAL ═════════════════════════════════════

test('SCRUM-783 · 🔴 el LECTOR OFICIAL del meta-guard VE mis mutaciones, y las ve enteras', () => {
  const vistas = mutacionesDeclaradas(fs.readFileSync(ESTE_FICHERO, 'utf8'), path.basename(ESTE_FICHERO));
  assert.equal(vistas.length, MUTACIONES_QUE_ME_TUMBAN.length,
    `🔴 declaro ${MUTACIONES_QUE_ME_TUMBAN.length} mutaciones y el lector oficial ve ${vistas.length}. `
    + 'Las que no ve NO SE EJECUTAN, y el meta-guard saldría verde sin haber tumbado nada.');
  for (const m of MUTACIONES_QUE_ME_TUMBAN) {
    const suya = vistas.find((x) => x.cae === m.cae);
    assert.ok(suya, `🔴 el lector oficial no ve la mutación «${m.cae}».`);
    assert.equal(suya.de, m.de, `🔴 el lector lee otro \`de\` para «${m.cae}».`);
  }
  // Y que cada `de` exista UNA vez, y que cada `cae` nombre un test de este fichero.
  const nombres = [...fs.readFileSync(ESTE_FICHERO, 'utf8').matchAll(/^test\('([^']+)'/gm)].map((x) => x[1]);
  for (const m of MUTACIONES_QUE_ME_TUMBAN) {
    const src = fs.readFileSync(path.join(RAIZ, m.fichero), 'utf8');
    assert.equal(src.split(m.de).length - 1, 1,
      `🔴 el texto de «${m.cae}» aparece ${src.split(m.de).length - 1} veces en ${m.fichero}; hace falta UNA.`);
    assert.ok(nombres.some((n) => n.includes(m.cae)),
      `🔴 la mutación dice que cae «${m.cae}» y ningún test de este fichero se llama así: saldría CIEGA.`);
  }
});

/**
 * 🔴 LAS MUTACIONES QUE TIENEN QUE TUMBARME (contrato de SCRUM-745).
 */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // ① El estado vuelve al cierre: es EXACTAMENTE el defecto que este ticket arregla, y en el
    // diff no parece nada — una línea que cambia de sitio.
    fichero: 'public/dashboard/js/customersView.js',
    de: 'let seleccion = [];\n\nfunction renderCustomersView(container) {',
    a: 'function renderCustomersView(container) {\n  let seleccion = [];',
    cae: 'EL QUE DECIDE: marcar tres, ver una ficha y VOLVER deja los TRES',
  },
  {
    // ② Se deja de recortar a lo visible: la selección persistiría ENTERA al filtrar, el contador
    // diría más de lo que hay en pantalla y la barra pasaría a mentir.
    fichero: 'public/dashboard/js/customersView.js',
    de: '    seleccion = FC.limitarAVisibles(seleccion, visibles);',
    a: '    seleccion = seleccion.slice();',
    cae: 'POSITIVO: BUSCAR sigue RECORTANDO la selección, y el recorte es DEFINITIVO',
  },
];
