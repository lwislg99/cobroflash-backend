// tests/scrum792-barra-alcanzable-en-movil.test.mjs — SCRUM-792 (CONT-09)
//
// Sin gate: banco de vistas y lectura del CSS. Ni BD, ni red, ni navegador.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// A ≤640 px LA BARRA DE SELECCIÓN SE VE SIEMPRE, TAMBIÉN CON CERO.
//
// LA VÍCTIMA: el profesional con 300 clientes en el móvil. A ≤640 px el `thead` está oculto —y con
// él la casilla de «seleccionar todos»— y la barra, que se escribió EXACTAMENTE para suplirla,
// nacía cerrada con cero seleccionados. Las DOS vías se ocultaban A LA VEZ: para llegar al control
// que marca todas había que marcar una a mano. Medido en navegador a 390 px: **0 vías alcanzables**.
//
// ── QUÉ PUEDE Y QUÉ NO PUEDE JUZGAR ESTE FICHERO ────────────────────────────────────────────
// 🔴 EL BANCO NO EVALÚA CSS, así que la VISIBILIDAD real no se decide aquí: se mide en navegador
// (queda en `docs/master/SCRUM-792.md`, con los cuatro casos). Aquí se vigilan las dos cosas que
// SÍ son comprobables sin motor de maquetado y que son las que se rompen solas:
//   ① que el umbral NO se haya duplicado — las dos reglas comparten `@media`;
//   ② que el JS mantenga su contrato (la clase, y el literal ya aprobado con cero).
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const CSS = path.join(RAIZ, 'public/dashboard/css/styles.css');
const VISTA = path.join(RAIZ, 'public/dashboard/js/customersView.js');

const CLIENTES = [
  { id: 1, name: 'Fincas Soler', phone: '34000000001', email: 'a@b.es', notes: '', createdAt: '2026-01-15T10:00:00Z' },
  { id: 2, name: 'Carmen Ruiz', phone: '34000000002', email: 'c@d.es', notes: '', createdAt: '2026-02-20T10:00:00Z' },
];

async function lista() {
  const banco = cargarDashboard(RAIZ, {
    datos: (u) => (/\/admin\/customers/.test(String(u)) ? CLIENTES
      : (/\/admin\/merchant/.test(String(u)) ? { id: 1, name: 'X' } : [])),
  });
  const r = await pintarVista(banco, 'renderCustomersView');
  assert.equal(r.error, null, `🔴 la lista no monta: ${r.error && r.error.message}`);
  return r;
}
const TODOS = 'Seleccionar todos';
const enTd = (x) => { let p = x._padre; while (p) { if (p.tagName === 'TD') return true; p = p._padre; } return false; };
const barra = (raiz) => todos(raiz).find((n) => n.tagName === 'DIV'
  && (n.hijos || []).some((x) => x.tagName === 'INPUT' && x.getAttribute && x.getAttribute('aria-label') === TODOS));
const spanBarra = (raiz) => todos(barra(raiz)).find((n) => n.tagName === 'SPAN');
const casillasFila = (raiz) => todos(raiz).filter((n) => n.tagName === 'INPUT' && n.type === 'checkbox'
  && n.getAttribute && n.getAttribute('aria-label') && n.getAttribute('aria-label') !== TODOS && enTd(n));

/**
 * 🔴 SIN COMENTARIOS, Y ESTO NO ES HIGIENE: ES EL DEFECTO QUE ESTE FICHERO SE HIZO A SÍ MISMO.
 *
 * El comentario que explica la regla de SCRUM-792 CITA el texto «@media (max-width: 640px)». Los
 * dos lectores de abajo buscan esa cadena y empezaban a contar llaves DENTRO del comentario, así
 * que se comían el resto de la hoja y las reglas base «desaparecían». El test salía ROJO sobre un
 * CSS correcto — con el mensaje «falta la regla base», que acusaba al sitio equivocado.
 *
 * Es el clásico de la casa: **un guard de TEXTO se caza a sí mismo en el comentario que explica
 * lo que vigila.** Se quitan los comentarios ANTES de leer, una sola vez, para los dos lectores.
 */
function sinComentarios(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/** El CSS SIN sus bloques `@media`: lo que aplica en cualquier ancho. Mismo lector que abajo. */
function quitarMedia(cssConComentarios) {
  const css = sinComentarios(cssConComentarios);
  let out = ''; let i = 0;
  const re = /@media\s*[^{]+\{/g;
  let m;
  while ((m = re.exec(css))) {
    out += css.slice(i, m.index);
    let j = re.lastIndex; let prof = 1;
    while (j < css.length && prof > 0) { if (css[j] === '{') prof++; else if (css[j] === '}') prof--; j++; }
    i = j; re.lastIndex = j;
  }
  return out + css.slice(i);
}

/** Los bloques `@media` del CSS, con su condición y su cuerpo. Por conteo de llaves. */
function bloquesMedia(cssConComentarios) {
  const css = sinComentarios(cssConComentarios);
  const out = [];
  const re = /@media\s*([^{]+)\{/g;
  let m;
  while ((m = re.exec(css))) {
    let i = re.lastIndex; let prof = 1;
    while (i < css.length && prof > 0) { if (css[i] === '{') prof++; else if (css[i] === '}') prof--; i++; }
    out.push({ condicion: m[1].trim(), cuerpo: css.slice(re.lastIndex, i - 1) });
  }
  return out;
}

// ═══ ① EL UMBRAL NO SE DUPLICA ═══════════════════════════════════════════════════════════

test('SCRUM-792 · 🔴 EL UMBRAL VIVE UNA SOLA VEZ: las dos reglas comparten el MISMO `@media`', () => {
  // 🔴 ES MEDIO TICKET. Un `@media` no admite variables, así que la derivación más fuerte que hay
  // en CSS plano es la CO-LOCACIÓN: si el umbral cambia, cambia para las dos a la vez. Repetir el
  // número en dos bloques es la regla 2 esperando a morder — el día que uno se mueva, en el móvil
  // se ocultarán otra vez las dos vías y nadie se enterará hasta que lo cuente un profesional.
  const css = fs.readFileSync(CSS, 'utf8');
  const bloques = bloquesMedia(css);

  // SUELO: si el lector de bloques no encuentra ninguno, lo de abajo no significa nada.
  assert.ok(bloques.length > 5,
    `🔴 CIEGO: sólo leo ${bloques.length} bloques \`@media\` en la hoja. El lector está roto.`);

  const conThead = bloques.filter((b) => /\.table--stack-mobile\s+thead\s*\{\s*display:\s*none/.test(b.cuerpo));
  assert.equal(conThead.length, 1,
    `🔴 la regla que esconde el \`thead\` aparece en ${conThead.length} bloques \`@media\`. `
    + 'Con cero no hay nada que vigilar; con dos, ya hay dos umbrales.');

  assert.match(conThead[0].cuerpo, /\.barra-seleccion\.barra-seleccion--vacia\s*\{\s*display:\s*flex/,
    `🔴 la regla que ABRE la barra con cero NO está en el mismo bloque que la que esconde el `
    + `\`thead\` (${conThead[0].condicion}). Están separadas, así que el umbral existe DOS veces: `
    + 'el día que alguien mueva uno, en el móvil volverán a ocultarse las dos vías de «seleccionar '
    + 'todo» y no lo va a cazar nada.');

  // Y CONTROL POSITIVO DEL LECTOR: tiene que saber decir que NO en un bloque que no la lleva.
  const otros = bloques.filter((b) => b !== conThead[0]);
  assert.ok(otros.some((b) => !/\.barra-seleccion\.barra-seleccion--vacia/.test(b.cuerpo)),
    '🔴 el lector encuentra la regla en TODOS los bloques: no está discriminando, y su «sí» de '
    + 'arriba valdría lo mismo que un sello.');
});

test('SCRUM-792 · 🔴 y el `display` de la barra NO vuelve a escribirse en línea desde el JS', () => {
  // Un `style.display` en línea gana a cualquier regla: mientras viviera ahí, la `@media` no
  // podría decidir nada y el arreglo quedaría muerto sin que ningún test lo notara.
  const fuente = fs.readFileSync(VISTA, 'utf8');
  const ejecutable = fuente.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  // Hermano del token (SCRUM-237): primero se comprueba que el detector VE la forma que busca.
  assert.match('barraSeleccion.style.display = "flex";', /barraSeleccion\.style\.display/,
    '🔴 el detector no reconoce su propia forma: su «no aparece» no valdría nada.');
  assert.doesNotMatch(ejecutable, /barraSeleccion\.style\.display/,
    '🔴 el `display` de la barra ha vuelto al JS en línea. Gana a la `@media`, así que en el móvil '
    + 'la barra volvería a nacer cerrada con cero y las dos vías se ocultarían otra vez.');
});

// ═══ ② EL CONTRATO DEL JS ════════════════════════════════════════════════════════════════

test('SCRUM-792 · 🔴 con CERO la barra se marca VACÍA y dice el literal YA APROBADO', () => {
  // ⛔ NO hay literal nuevo: es `FC.TEXTOS_SELECCION.todos`, el mismo texto que esta casilla lleva
  // hoy como `aria-label`. Hacerlo visible es derivación, no invención (regla 30).
  const banco = cargarDashboard(RAIZ, { datos: () => [] });
  const FC = banco.ctx.filtroClientes;
  assert.ok(FC && FC.TEXTOS_SELECCION && FC.TEXTOS_SELECCION.todos,
    '🔴 CIEGO: no encuentro `FC.TEXTOS_SELECCION.todos` en el contexto.');

  return lista().then((r) => {
    const b = barra(r.contenedor);
    assert.ok(b, '🔴 CIEGO: no encuentro la barra.');
    assert.equal(b.classList.contains('barra-seleccion--vacia'), true,
      '🔴 con cero seleccionados la barra NO se marca como vacía: el CSS no sabría distinguirla.');
    assert.equal(spanBarra(r.contenedor).textContent, FC.TEXTOS_SELECCION.todos,
      `🔴 con cero, la barra dice «${spanBarra(r.contenedor).textContent}» y tenía que decir el `
      + `literal ya aprobado «${FC.TEXTOS_SELECCION.todos}». «0 clientes seleccionados» es una `
      + 'frase que nadie ve y que en el móvil ocupa el sitio del control que hay que pulsar.');
  });
});

test('SCRUM-792 · ✅ desde UNO, el contador sustituye al literal — exactamente como hoy', async () => {
  const r = await lista();
  const cbs = casillasFila(r.contenedor);
  assert.ok(cbs.length >= 1, `🔴 CIEGO: ${cbs.length} filas.`);
  cbs[0].checked = true; cbs[0].disparar('change');

  const b = barra(r.contenedor);
  assert.equal(b.classList.contains('barra-seleccion--vacia'), false,
    '🔴 con uno seleccionado la barra sigue marcada como vacía.');
  assert.equal(spanBarra(r.contenedor).textContent, '1 cliente seleccionado',
    `🔴 desde uno tiene que mandar el contador, y dice «${spanBarra(r.contenedor).textContent}».`);

  // Y de vuelta a cero: el literal reaparece. Sin esto, «cambia a contador» podría ser un camino
  // de ida — y la barra se quedaría en móvil sin su rótulo para siempre.
  cbs[0].checked = false; cbs[0].disparar('change');
  assert.equal(b.classList.contains('barra-seleccion--vacia'), true,
    '🔴 al soltar el último, la barra no vuelve a marcarse vacía.');
  assert.equal(spanBarra(r.contenedor).textContent, 'Seleccionar todos',
    '🔴 al volver a cero no reaparece el literal: el cambio era sólo de ida.');
});

test('SCRUM-792 · 🔴 la clase se ESCRIBE y NUNCA se lee: es un reflejo, no un almacén', async () => {
  // La verdad sigue siendo `seleccion` (SCRUM-783). Si alguien empezara a LEER la clase para
  // decidir algo, el DOM pasaría a ser fuente de verdad — que es lo que mató la tecla «N»
  // (SCRUM-777). La diferencia entre reflejo y almacén es exactamente ésa: quién pregunta.
  const fuente = fs.readFileSync(VISTA, 'utf8');
  const ejecutable = fuente.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

  // Hermano del token (SCRUM-237): el detector tiene que ver las dos formas de LEER una clase.
  assert.match("if (x.classList.contains('barra-seleccion--vacia'))", /classList\.contains|matches\(/,
    '🔴 el detector no ve `classList.contains`.');
  assert.match("if (x.matches('.barra-seleccion--vacia'))", /classList\.contains|matches\(/,
    '🔴 el detector no ve `matches(`.');

  const lineas = ejecutable.split('\n').filter((l) => /barra-seleccion--vacia/.test(l));
  assert.ok(lineas.length > 0, '🔴 CIEGO: ninguna línea ejecutable nombra la clase.');
  for (const l of lineas) {
    assert.doesNotMatch(l, /classList\.contains|matches\(/,
      `🔴 la clase se está LEYENDO: «${l.trim()}». Deja de ser un reflejo y pasa a ser una fuente `
      + 'de verdad en el DOM.');
  }
  assert.equal(lineas.filter((l) => /classList\.toggle/.test(l)).length, 1,
    '🔴 la clase tiene que escribirse en UN solo sitio, con `classList.toggle`.');
});

// ═══ ③ LO QUE NO PUEDE CAMBIAR ═══════════════════════════════════════════════════════════

test('SCRUM-792 · ✅ POSITIVO: en ESCRITORIO la regla base sigue cerrando la barra con cero', () => {
  // El defecto se midió en móvil y el arreglo se acota ahí. Fuera de la `@media`, la regla base
  // tiene que seguir escondiendo la barra vacía: si no, la barra aparecería en escritorio con
  // cero, que es arreglar de más.
  // 🔴 LOS BLOQUES SE QUITAN CON EL MISMO LECTOR POR CONTEO DE LLAVES, no con una expresión
  // regular. La primera versión usaba `/@media[^{]+\{(?:[^{}]|\{[^{}]*\})*\}/g` y este test salía
  // ROJO sobre un CSS correcto: esa expresión no aguanta el anidamiento y se comía de más. Dos
  // formas de leer lo mismo es la regla 2 otra vez — se deriva del lector que ya existe.
  const css = fs.readFileSync(CSS, 'utf8');
  const fuera = quitarMedia(css);
  assert.ok(fuera.length > css.length * 0.4,
    `🔴 CIEGO: quitando las \`@media\` queda el ${((fuera.length / css.length) * 100).toFixed(0)} % `
    + 'de la hoja. El lector se está comiendo de más y este control mediría un CSS que no existe.');
  assert.match(fuera, /\.barra-seleccion\s*\{\s*display:\s*flex/,
    '🔴 falta la regla base de la barra fuera de toda `@media`.');
  assert.match(fuera, /\.barra-seleccion\.barra-seleccion--vacia\s*\{\s*display:\s*none/,
    '🔴 la regla base ya NO esconde la barra vacía: en escritorio aparecería con cero '
    + 'seleccionados, y eso es cambiar lo que no había que cambiar.');
});

/** 🔴 LAS MUTACIONES QUE TIENEN QUE TUMBARME (contrato de SCRUM-745). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // ① El umbral se duplica: la regla del móvil sale del bloque compartido a uno propio. El
    // comportamiento de HOY no cambia —el número es el mismo—, así que sólo lo caza el guard de
    // co-locación. Es exactamente la forma en que la regla 2 muerde: dos verdades que hoy
    // coinciden.
    fichero: 'public/dashboard/css/styles.css',
    de: '  .barra-seleccion.barra-seleccion--vacia { display: flex; }',
    a: '}\n@media (max-width: 640px) {\n  .barra-seleccion.barra-seleccion--vacia { display: flex; }',
    cae: 'EL UMBRAL VIVE UNA SOLA VEZ: las dos reglas comparten el MISMO `@media`',
  },
  {
    // ② Con cero vuelve el contador: «0 clientes seleccionados» ocupando en el móvil el sitio del
    // control que hay que pulsar, y estrenando en pantalla una frase que nadie había visto.
    fichero: 'public/dashboard/js/customersView.js',
    de: '    contadorSeleccion.textContent = seleccion.length > 0\n      ? FC.textoDelContador(seleccion.length)\n      : FC.TEXTOS_SELECCION.todos;',
    a: '    contadorSeleccion.textContent = FC.textoDelContador(seleccion.length);',
    cae: 'con CERO la barra se marca VACÍA y dice el literal YA APROBADO',
  },
];
