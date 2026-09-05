// tests/scrum599-navegacion-documentos-y-atajo.test.mjs — SCRUM-599 (DOC-09) · absorbe SCRUM-585
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// TRES FORMAS DE LLEGAR A CREAR, SEGÚN EL TIPO. Y ahora una sola.
//
// El mismo profesional, en la misma sesión, se encontraba: Presupuestos con un submenú
// («Historial» / «Crear nuevo»), Albaranes y Facturas yendo directos a la lista, y ningún atajo
// de teclado en ninguna parte. Ahora cada tipo abre SU LISTA y la creación es el botón primario
// de esa pantalla, con la tecla «N» impresa en el propio botón.
//
// 🔴 UN SOLO MECANISMO PARA LAS CUATRO LISTAS, incluida Clientes (CONT-12, absorbido). Si hubiera
// dos implementaciones del atajo, el ticket estaría mal hecho — y hay un test que lo mide.
//
// 🔴 Y EL MOTOR YA EXISTÍA: `app.js` tenía un `keydown` global que escuchaba la «n» y ya se
// protegía de las cuatro situaciones peligrosas. Lo que hacía era abrir SIEMPRE la cotización
// rápida. No nace un segundo manejador: la condición se extrajo a `sePuedeDisparar` —pura, y por
// eso probable sin navegador— y el destino pasa a decidirlo la vista.
//
// ⚠️ ALBARANES SE QUEDA FUERA, Y NO ES UN OLVIDO: el único endpoint de creación es
// `POST /admin/jobs/{jobId}/albaranes`, que EXIGE un Trabajo. No existe crear un albarán suelto,
// así que un botón en la lista global sería una promesa rota — lo que el propio menú prohíbe:
// «una entrada que apunta a nada es una promesa rota cada vez que se pulsa».
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');

const INDEX = leer('public/dashboard/index.html');
const APP = leer('public/dashboard/js/app.js');

/** La pieza, ejecutada: es más fuerte que buscar su forma en el fuente con un regex. */
function pieza() {
  return cargarDashboard(RAIZ).ctx.atajoNuevo;
}

/** Un evento de teclado de mentira, con lo que mira la condición. */
function tecla(k, extra = {}) {
  return { key: k, metaKey: false, ctrlKey: false, altKey: false, target: null, ...extra };
}
const SIN_MODALES = { querySelector: () => null };

// ═══ ① EL MENÚ: UNA ENTRADA POR TIPO ═════════════════════════════════════════════════════

test('SCRUM-599 · 🔴 Presupuestos ya NO tiene submenú, y su entrada abre la LISTA', () => {
  assert.equal(/data-view="quotes-new"/.test(INDEX), false,
    '🔴 sigue habiendo un subítem «Crear nuevo» en el menú: entonces Presupuestos sigue siendo el '
    + 'único tipo con dos caminos y el profesional se sigue encontrando tres formas distintas.');
  assert.equal(/nav-subitems/.test(INDEX), false,
    '🔴 queda el contenedor del submenú.');
  assert.match(INDEX, /nav-item nav-item-parent" type="button" data-view="quotes-list"/,
    '🔴 la entrada de Presupuestos no lleva a la lista. Sin `data-view` no navega a ningún sitio.');

  // Y las otras tres siguen siendo entradas directas, que es a lo que se unifica.
  for (const v of ['albaranes', 'invoices', 'customers']) {
    assert.match(INDEX, new RegExp(`data-view="${v}"`),
      `🔴 ha desaparecido la entrada de menú de «${v}».`);
  }
});

test('SCRUM-599 · 🔴 SUELO + el destino `quotes-new` SIGUE ALCANZABLE (censo de caminos)', () => {
  // 🔴 ES LA LECCIÓN DE LA CASA: «se retiró una entrada de menú dejando la vista sin ningún
  // camino». Se censa el panel ENTERO, no una lista a mano.
  const dir = path.join(RAIZ, 'public/dashboard/js');
  const caminos = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    // Sin comentarios: este ticket dejó escrito «quotes-new» en varias explicaciones, y un censo
    // que casara con ellas contaría caminos que no existen.
    const codigo = src.replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n')
      .filter((l) => !/^\s*\/\//.test(l)).join('\n');
    for (const m of codigo.matchAll(/renderAppView\(\s*['"]quotes-new['"]/g)) {
      caminos.push(`${f}:${codigo.slice(0, m.index).split('\n').length}`);
    }
  }
  assert.ok(caminos.length >= 4,
    `🔴 SÓLO ${caminos.length} caminos llevan a crear un presupuesto: ${caminos.join(', ')}. Al `
    + 'retirar el submenú hay que demostrar que sigue alcanzable, y con tan pocos este censo no '
    + 'lo demuestra: un cero aquí sería la pantalla sin ninguna puerta.');
  assert.ok(caminos.some((c) => c.startsWith('quotesListView.js')),
    `🔴 el botón primario de LA PROPIA LISTA no navega a la creación. Caminos vistos: `
    + `${caminos.join(', ')}. Era el defecto que este ticket estuvo a punto de introducir: el `
    + 'botón pulsaba el subítem del menú, así que al retirarlo se quedaba inerte y en silencio.');
});

test('SCRUM-599 · 🔴 y el botón de la lista NO depende de que exista un botón del menú', () => {
  const q = leer('public/dashboard/js/quotesListView.js');
  const codigo = q.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.equal(/querySelector\(['"]\.nav-item\[data-view="quotes-new"\]['"]\)/.test(codigo), false,
    '🔴 ha vuelto el `querySelector` del subítem del menú. Ese botón ya no existe: el `if` se '
    + 'traga el `null` y la creación se queda sin camino desde su propia lista, sin un solo error '
    + 'en consola.');
});

// ═══ ② EL ATAJO: UN SOLO MECANISMO ═══════════════════════════════════════════════════════

test('SCRUM-599 · 🔴 UN SOLO MECANISMO: no hay un segundo manejador del atajo', () => {
  const dir = path.join(RAIZ, 'public/dashboard/js');
  const sospechosos = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    if (f === 'atajoNuevo.js') continue;
    const codigo = fs.readFileSync(path.join(dir, f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n')
      .filter((l) => !/^\s*\/\//.test(l)).join('\n');
    // Un `keydown` de documento que compare con la «n» y no pase por la pieza.
    for (const m of codigo.matchAll(/document\.addEventListener\(\s*['"]keydown['"][\s\S]{0,600}?\}\s*\)/g)) {
      const bloque = m[0];
      if (/['"]n['"]|['"]N['"]/.test(bloque) && !/atajoNuevo/.test(bloque)) sospechosos.push(f);
    }
  }
  assert.deepEqual([...new Set(sospechosos)], [],
    `🔴 hay otro manejador de la «n» fuera de la pieza: ${sospechosos.join(', ')}. El ticket lo `
    + 'dice con esas palabras: «MISMO MECANISMO, NO DOS». Dos implementaciones divergen el día '
    + 'que alguien arregle una de ellas.');
  assert.match(APP, /atajoNuevo\.sePuedeDisparar|A\.sePuedeDisparar/,
    '🔴 `app.js` ya no usa la condición de la pieza: se ha vuelto a escribir una copia.');
});

test('SCRUM-599 · 🔴 LAS CUATRO LISTAS registran su destino, y Clientes es una de ellas', async () => {
  // CONT-12 absorbido: si Clientes no registrara, habría hecho falta un segundo mecanismo.
  const esperado = { renderQuotesListView: 'quotes-list', renderInvoicesView: 'invoices',
    renderCustomersView: 'customers' };
  for (const [fn, vista] of Object.entries(esperado)) {
    const banco = cargarDashboard(RAIZ);
    const r = await pintarVista(banco, fn);
    assert.equal(r.error, null, `🔴 ${fn} no se monta: ${r.error}`);
    assert.deepEqual(banco.ctx.atajoNuevo.vistasConAtajo(), [vista],
      `🔴 al montar ${fn} la vista «${vista}» NO ha registrado destino para la «N»: el atajo no `
      + 'abriría nada ahí.');
    assert.equal(typeof banco.ctx.atajoNuevo.accionDe(vista), 'function',
      `🔴 «${vista}» registró algo que no se puede ejecutar.`);
  }
});

// ═══ ③ LO QUE NO PUEDE PASAR — un test por condición ═════════════════════════════════════

test('SCRUM-599 · 🔴 la «N» NO se dispara escribiendo en un campo', () => {
  const A = pieza();
  for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) {
    assert.equal(A.sePuedeDisparar(tecla('n', { target: { tagName: tag } }), SIN_MODALES), false,
      `🔴 con el foco en un <${tag.toLowerCase()}> el atajo se dispara. Un fontanero escribiendo `
      + '«Nueva caldera» acabaría en una pantalla de creación con lo escrito a medias.');
  }
  assert.equal(
    A.sePuedeDisparar(tecla('n', { target: { tagName: 'DIV', isContentEditable: true } }), SIN_MODALES),
    false, '🔴 en un campo editable el atajo se dispara.');
});

test('SCRUM-599 · 🔴 la «N» NO se dispara con un modal abierto', () => {
  const A = pieza();
  const CON_MODAL = { querySelector: (sel) => (sel === A.SELECTOR_MODAL ? {} : null) };
  assert.equal(A.sePuedeDisparar(tecla('n'), CON_MODAL), false,
    '🔴 con un modal delante la «N» abre otra creación encima. La tecla es del modal.');
  // Y el suelo de este caso: sin modal SÍ pasa, o el test estaría midiendo otra cosa.
  assert.equal(A.sePuedeDisparar(tecla('n'), SIN_MODALES), true,
    '🔴 SUELO: tampoco pasa sin modal, así que el caso de arriba no prueba nada.');
});

test('SCRUM-599 · 🔴 la «N» NO secuestra Ctrl+N, Cmd+N ni Alt+N', () => {
  const A = pieza();
  for (const mod of ['ctrlKey', 'metaKey', 'altKey']) {
    assert.equal(A.sePuedeDisparar(tecla('n', { [mod]: true }), SIN_MODALES), false,
      `🔴 con ${mod} pulsado el atajo se dispara. \`Ctrl+N\` es del navegador: quien lo pulsa `
      + 'quiere una ventana nueva, y quitárselo es romperle el sistema operativo.');
  }
});

test('SCRUM-599 · 🔴 y sin poder mirar si hay modal, NO se dispara', () => {
  // «No supe comprobar» no es «no hay modal». Ante la duda no abrir es recuperable; abrir encima
  // de un formulario a medio llenar, no.
  const A = pieza();
  assert.equal(A.sePuedeDisparar(tecla('n'), null), false,
    '🔴 sin documento que consultar el atajo se dispara igual.');
  assert.equal(A.sePuedeDisparar(tecla('n'), {}), false,
    '🔴 con un documento que no sabe buscar, el atajo se dispara.');
});

test('SCRUM-599 · CONTROL POSITIVO: la «n» y la «N» a secas SÍ se disparan', () => {
  // Si tras tanta prohibición no quedara ningún caso que pase, el atajo estaría muerto y todos
  // los tests de arriba seguirían verdes.
  const A = pieza();
  assert.equal(A.sePuedeDisparar(tecla('n'), SIN_MODALES), true, '🔴 la «n» no dispara nada.');
  assert.equal(A.sePuedeDisparar(tecla('N'), SIN_MODALES), true,
    '🔴 con mayúsculas no dispara: quien tenga el bloqueo puesto no tendría atajo.');
  assert.equal(A.sePuedeDisparar(tecla('m'), SIN_MODALES), false,
    '🔴 CONTROL NEGATIVO: otra tecla cualquiera también dispara.');
});

// ═══ ④ MICROCOPY Y LA TECLA EN EL BOTÓN ══════════════════════════════════════════════════

test('SCRUM-599 · el microcopy es el APROBADO, literal, y sin marcadores', () => {
  const A = pieza();
  // Uno a uno y no con `deepEqual`: la pieza vive en el contexto del banco, así que su objeto
  // tiene OTRO prototipo y la comparación profunda falla por el realm, no por el copy — un rojo
  // que no habla de lo que este test vigila.
  const APROBADOS = [
    ['quotes-list', 'Nuevo presupuesto'],
    ['invoices', 'Nueva factura'],
    ['customers', 'Nuevo cliente'],
    // 5-sep-2026 (SCRUM-606 · ALB-01): la CUARTA lista, firmada por el asesor el mismo dia que
    // entro. Su caja, medida en navegador antes de pedir la firma: 128,1 px en 284 utiles a 390.
    ['albaranes', 'Nuevo albarán'],
  ];
  for (const [vista, texto] of APROBADOS) {
    assert.equal(A.textoDe(vista), texto,
      `🔴 el rótulo de «${vista}» ha cambiado sin pasar por quien lo aprueba (regla 30).`);
    assert.equal(/PENDIENTE|\[\[/.test(texto), false,
      `🔴 «${texto}» es un MARCADOR, y esto se ve en pantalla.`);
  }
  // 🔴 VUELVEN A CUADRAR el 5-sep-2026: los CUATRO rotulos estan firmados y `SIN_APROBAR` es 0.
  // La suma se conserva ASI —aprobados + sin firmar = total— y no se vuelve a la igualdad simple:
  // con esta forma, un quinto rotulo que entre sin firma sube el total Y tiene que subir el
  // contador, o esto cae. La igualdad simple solo lo cazaba mientras el contador fuera 0.
  assert.equal(Object.keys(A.TEXTOS).length, APROBADOS.length + A.SIN_APROBAR,
    `🔴 hay ${Object.keys(A.TEXTOS).length} rótulos, ${APROBADOS.length} aprobados y `
    + `${A.SIN_APROBAR} declarados sin firma: las cuentas no cuadran, ha entrado uno a escondidas.`);
  // 🔴 4-sep-2026 · 3 → 0: EL FUNDADOR FIRMÓ LOS TRES RÓTULOS. El registro de la aprobación está
  // en `docs/microcopy/2026-09-04-SCRUM-599-atajo-nuevo.md`.
  //
  // La constante NO se retira, y el cero no relaja nada: sigue siendo una igualdad exacta. Lo que
  // dice ahora es «las tres que hay están firmadas», no «no hay nada que declarar» — así que el
  // día que una cuarta lista estrene su atajo, su rótulo nace sin firma, este número sube y esto
  // cae. Un cero que no se puede mover en silencio es lo contrario de un guard apagado.
  // 🔴 5-sep-2026 · subio a 1 y volvio a 0 el MISMO DIA (SCRUM-606): entro «Nuevo albarán» sin
  // firma y el asesor lo firmo en la misma sesion, retirando marcador y contador en el mismo
  // commit. El cero sigue sin poder moverse en silencio: es una igualdad exacta.
  assert.equal(A.SIN_APROBAR, 0,
    '🔴 el recuento de ranuras a la espera de firma ya no es cero: o ha entrado un rótulo nuevo '
    + 'sin firmar, o alguien ha movido el número sin decir por qué.');
  assert.equal(A.TECLA, 'N', '🔴 la tecla que se pinta ha dejado de ser la «N».');
});

test('SCRUM-599 · 🔴 la tecla se pinta EN el botón, en las tres listas', async () => {
  for (const fn of ['renderQuotesListView', 'renderInvoicesView', 'renderCustomersView']) {
    const banco = cargarDashboard(RAIZ);
    const r = await pintarVista(banco, fn);
    assert.equal(r.error, null, `🔴 ${fn} no se monta: ${r.error}`);
    const teclas = todos(r.contenedor).filter((n) => n.tagName === 'KBD');
    assert.equal(teclas.length, 1,
      `🔴 en ${fn} hay ${teclas.length} teclas pintadas y debía haber UNA.`);
    assert.equal(teclas[0].textContent, 'N', '🔴 la tecla pintada no es la «N».');
    assert.equal(teclas[0].className, 'btn-atajo', '🔴 la tecla no lleva su clase.');
    // Y va DENTRO del botón primario, no suelta al lado.
    assert.equal(teclas[0].parentNode && teclas[0].parentNode.tagName, 'BUTTON',
      '🔴 la tecla no está dentro de un botón: sería un adorno suelto en la cabecera.');
  }
});

test('SCRUM-599 · CONTROL NEGATIVO: renombrar un rótulo NO tumba el censo de caminos', () => {
  // El censo de caminos mide DESTINOS (`renderAppView('quotes-new')`), no textos. Si midiera
  // textos, cambiar «Nuevo presupuesto» por otra cosa lo tumbaría y el guard estaría vigilando
  // el copy en vez de la navegación, que es lo que importa aquí.
  const q = leer('public/dashboard/js/quotesListView.js');
  const renombrado = q.split('"Nuevo presupuesto"').join('"Otro rótulo cualquiera"');
  assert.notEqual(renombrado, q, '🔴 SUELO: el rótulo no está donde creo, la prueba no vale.');
  assert.match(renombrado, /renderAppView\(\s*["']quotes-new["']/,
    '🔴 al renombrar el rótulo se ha perdido el camino: el censo estaría atado al copy.');
});

test('SCRUM-599 · el CSS de la tecla existe y no se come el objetivo táctil', () => {
  const css = leer('public/dashboard/css/styles.css');
  assert.match(css, /\.btn-atajo\s*\{/, '🔴 no hay estilo para la tecla: saldría como texto suelto.');
  const bloque = css.slice(css.indexOf('.btn-atajo {'), css.indexOf('.btn-atajo {') + 400);
  assert.match(bloque, /pointer-events:\s*none/,
    '🔴 la tecla puede recibir el toque por su cuenta. El objetivo táctil es el BOTÓN entero '
    + '(AB6): un recuadro de 11px dentro de él no es un segundo destino.');
  assert.match(css, /max-width:\s*640px\)\s*\{\s*\.btn-atajo\s*\{\s*display:\s*none/,
    '🔴 la tecla se sigue pintando en móvil, donde no hay teclado y donde menos sitio hay.');
});
