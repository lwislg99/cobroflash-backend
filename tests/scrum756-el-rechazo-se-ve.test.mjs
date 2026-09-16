// tests/scrum756-el-rechazo-se-ve.test.mjs — SCRUM-756
//
// Sin gate: monta el dashboard en el banco de vistas. Ni BD, ni red, ni servidor.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UN FORMULARIO QUE PUEDE RECHAZAR TIENE QUE PODER DECIRLO POR SÍ MISMO
//
// LA VÍCTIMA: el profesional con el cliente delante. Entra al dashboard, va a Presupuestos,
// abre «+ Nuevo cliente» desde el selector, pulsa Guardar sin nombre — y NO PASA NADA. No
// falla, no avisa, no se cierra. Se queda quieto. En un producto que promete un presupuesto en
// 30 segundos, ése es el peor modo de fallo que hay: el que no se distingue de estar colgado.
//
// ── EL MECANISMO, MEDIDO (SCRUM-591) ───────────────────────────────────────────────────
//
// `avisar` nace como no-op (`customersView.js`) y sólo se sustituye DENTRO de
// `renderCustomersView`, que corre únicamente al navegar a Clientes (`app.js`). Quien no ha
// pasado por esa pantalla no tiene caja de avisos, así que:
//
//     avisar("error", "El nombre es obligatorio.")   →   function () {}
//
// La validación NO está rota —rechaza perfectamente—; lo que falta es que se vea.
//
// ── LA DECISIÓN DEL FUNDADOR (5-sep-2026), Y POR QUÉ NO ES EL ARREGLO OBVIO ────────────
//
// 🔴 LA CAJA DEL AVISO PERTENECE AL MODAL, no a la vista que lo abrió: la protección vive
// donde está la acción, no un nivel más allá.
//
// El arreglo barato —que `quotesView` llame a `configurar`— está MEDIDO y suspende: `avisar`
// es UN SOLO valor global, así que en cuanto el usuario visita Clientes, los avisos del alta
// abierta desde el DOCUMENTO se pintan en la caja de CLIENTES, que no está en pantalla. Un
// aviso pintado donde nadie mira es tan invisible como no pintarlo, y además PARECE arreglado.
// Eso es lo que vigila el tercer test de este fichero.
//
// MICROCOPY: ninguna nueva. Se reutilizan los mensajes que el formulario ya emitía
// («El nombre es obligatorio.», «Error guardando cliente: …»). Esto construye el CONTINENTE,
// no el texto — por eso no lleva marcador ni contador.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DIR_JS = path.join(RAIZ, 'public/dashboard/js');

const MENSAJE = 'El nombre es obligatorio.';

function banco() {
  const pedidas = [];
  const b = cargarDashboard(RAIZ, {
    red: {
      navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
      fetch: async (url, opts) => {
        pedidas.push(String(url) + ' ' + ((opts && opts.method) || 'GET'));
        return {
          ok: true, status: 200, headers: { get: () => 'application/json' },
          json: async () => ({ coincidencias: [], items: [], customers: [] }), text: async () => '{}',
        };
      },
    },
  });
  return { b, pedidas };
}

/** Monta la pantalla de Clientes DE VERDAD y devuelve su contenedor. */
async function montarClientes(b) {
  const cont = b.ctx.document.createElement('div');
  b.ctx.document.body.appendChild(cont);
  const r = b.ctx.renderCustomersView(cont);
  if (r && r.then) await r;
  return cont;
}

/** El nodo del modal compartido, o `null` si no está abierto. */
function nodoDelModal(b) {
  return todos(b.ctx.document.body)
    .find((n) => String(n.className || '').split(' ').includes('modal-overlay')) || null;
}

/** Envía el formulario del modal (el último `<form>` montado). */
async function enviarElFormulario(b) {
  const f = todos(b.ctx.document.body).filter((n) => n.tagName === 'FORM').pop();
  assert.ok(f, '🔴 SUELO: no hay formulario montado, así que esta prueba no mediría nada.');
  const oyentes = (f._oyentes && f._oyentes.submit) || [];
  assert.ok(oyentes.length > 0, '🔴 SUELO: el formulario no tiene oyente de `submit`.');
  for (const fn of oyentes) await fn({ preventDefault() {} });
}

/** Todo el texto de un subárbol. `null` como raíz devuelve cadena vacía, no revienta. */
function textoDe(raiz) {
  if (!raiz) return '';
  return todos(raiz).map((n) => n.textContent || '').join(' | ');
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-756 · SUELO: el dashboard monta y el formulario compartido se abre con campos', () => {
  const { b } = banco();
  assert.equal(b.fallos.length, 0,
    '🔴 algún script del dashboard revienta al cargarse:\n    '
    + b.fallos.map((f) => f.script + ': ' + f.error).join('\n    '));
  b.ctx.window.altaClienteModal.abrirNuevo({ alGuardar: () => {} });
  const campos = todos(b.ctx.document.body).filter((n) => n.tagName === 'INPUT');
  assert.ok(campos.length >= 5,
    `🔴 SUELO: el formulario tiene ${campos.length} campos. No se ha montado, así que todo lo de `
    + 'abajo sería cierto sobre nada.');
  assert.ok(nodoDelModal(b), '🔴 SUELO: no encuentro el nodo del modal (`.modal-overlay`).');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LOS TRES CONTROLES
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-756 · 🔴 EL QUE DECIDE: sin pasar por Clientes, el rechazo SE VE', async () => {
  const { b } = banco();

  // La escena exacta: dashboard → Presupuestos → «+ Nuevo cliente». NUNCA se abrió Clientes,
  // así que nadie ha llamado a `configurar` y no hay caja prestada.
  b.ctx.window.altaClienteModal.abrirNuevo({ alGuardar: () => {} });
  await enviarElFormulario(b);

  const enElModal = textoDe(nodoDelModal(b));
  assert.ok(enElModal.includes(MENSAJE),
    '🔴 EL RECHAZO NO SE VE. El profesional pulsa Guardar con el cliente delante, el formulario\n'
    + `   rechaza —bien— y no lo dice: «${MENSAJE}» no aparece por ninguna parte del modal.\n\n`
    + '   La validación NO está rota. Lo que falta es la caja: `avisar` sigue siendo el no-op\n'
    + '   con el que nace, porque sólo `renderCustomersView` lo sustituye.\n\n'
    + '   Texto encontrado en el modal:\n     ' + (enElModal.slice(0, 400) || '(vacío)'));
});

test('SCRUM-756 · ✅ CONTROL POSITIVO: desde Clientes el aviso sigue en LA CAJA DE CLIENTES', async () => {
  const { b } = banco();
  const contClientes = await montarClientes(b);

  // La entrada de siempre: el botón de la tabla de Clientes.
  b.ctx.window.altaClienteModal.abrir('create', null);
  await enviarElFormulario(b);

  assert.ok(textoDe(contClientes).includes(MENSAJE),
    '🔴 SE HA ROTO LO QUE FUNCIONABA: abriendo desde la pantalla de Clientes, el aviso ya no\n'
    + '   aparece en su caja. El arreglo tenía que AÑADIR una caja al modal, no mudar la que ya\n'
    + '   existía.\n\n   Texto en el contenedor de Clientes:\n     '
    + (textoDe(contClientes).slice(0, 400) || '(vacío)'));
});

test('SCRUM-756 · 🔴 LA TRAMPA: tras visitar Clientes, el aviso del DOCUMENTO no va a su caja', async () => {
  const { b } = banco();
  const contClientes = await montarClientes(b);

  // El usuario YA pasó por Clientes —así que `configurar` ya corrió— y ahora abre el alta desde
  // el selector de un documento. La caja de Clientes NO está delante.
  b.ctx.window.altaClienteModal.abrirNuevo({ alGuardar: () => {} });
  await enviarElFormulario(b);

  assert.ok(!textoDe(contClientes).includes(MENSAJE),
    '🔴 EL AVISO SE HA PINTADO EN UNA PANTALLA QUE NO ESTÁ DELANTE. El alta se abrió desde el\n'
    + '   DOCUMENTO y el mensaje ha ido a la caja de CLIENTES, porque `avisar` es un solo valor\n'
    + '   global y la última vista que llamó a `configurar` se lo quedó.\n\n'
    + '   Es el arreglo que PARECE bueno: el mensaje existe, pero nadie lo ve.');

  assert.ok(textoDe(nodoDelModal(b)).includes(MENSAJE),
    '🔴 …y tampoco está en el modal, así que el rechazo sigue siendo invisible.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL DESPLAZAMIENTO · la mitad que SÍ se puede medir
//
// ⚠️ ESTE TEST MIDE LA MECÁNICA, NO EL EFECTO. Que el aviso quede a la vista de un humano
// depende del motor de maquetado, y aquí no hay: el banco no implementa `scrollIntoView`. Lo
// que SÍ es medible —y barato— es que se llame, UNA vez, SOBRE EL NODO DE LA CAJA y sólo
// cuando hay algo que enseñar. Esa mitad se mide; la otra se declara en la entrada de máster.
//
// Un cambio sin ejercitar dentro de un ticket cuya tesis es «lo que no se ve no cuenta» sería
// incoherente con el propio ticket (fundador, 5-sep-2026).
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * Pone un espía de `scrollIntoView` en TODOS los nodos del modal y devuelve las llamadas.
 *
 * En todos, y no sólo en la caja, a propósito: así el test puede afirmar sobre QUÉ nodo se
 * llamó. Espiando sólo la caja, un `scrollIntoView` sobre el nodo equivocado saldría como
 * «no se llamó», que es un diagnóstico distinto.
 */
function espiarScroll(b) {
  const llamadas = [];
  for (const n of todos(b.ctx.document.body)) {
    n.scrollIntoView = function (opts) { llamadas.push({ nodo: n, opts }); };
  }
  return llamadas;
}

test('SCRUM-756 · el aviso SE TRAE A LA VISTA: una vez, y sobre la caja', async () => {
  const { b } = banco();
  b.ctx.window.altaClienteModal.abrirNuevo({ alGuardar: () => {} });

  const llamadas = espiarScroll(b);
  assert.equal(llamadas.length, 0,
    '🔴 SUELO: abrir el modal ya desplaza algo, así que lo de abajo no distinguiría.');

  await enviarElFormulario(b);

  // 🔴 UNA, no dos. El envío llama al aviso DOS veces —primero `(null, "")` para limpiar y
  // luego el error—, y la de limpiar no debe desplazar nada: ahí no hay nada que enseñar.
  // Ese `(null, "")` es el control negativo, y viene dentro del mismo flujo real.
  assert.equal(llamadas.length, 1,
    `🔴 se ha desplazado ${llamadas.length} veces y tiene que ser UNA. Si son dos, la llamada `
    + 'que LIMPIA el aviso está desplazando también, y eso mueve la pantalla sin motivo.');

  const nodo = llamadas[0].nodo;
  assert.ok(String(nodo.textContent || '').includes(MENSAJE),
    '🔴 SE HA DESPLAZADO AL NODO EQUIVOCADO: el nodo traído a la vista no es el que lleva el\n'
    + `   mensaje. Contenido del nodo desplazado: ${JSON.stringify(String(nodo.textContent || '').slice(0, 120))}`);
  assert.ok(String(nodo.className || '').split(' ').includes('alert'),
    `🔴 el nodo desplazado no es la caja de avisos: className=${JSON.stringify(nodo.className)}`);
});

test('SCRUM-756 · CONTROL NEGATIVO: la llamada que LIMPIA el aviso no desplaza', async () => {
  const { b } = banco();
  b.ctx.window.altaClienteModal.abrirNuevo({ alGuardar: () => {} });

  // 🔴 EL PRIMER INTENTO DE ESTE CONTROL ESTABA MAL, y queda escrito porque la trampa es fina:
  // se puso el nombre esperando que «sin rechazo no hay aviso», y el envío con ÉXITO también
  // avisa —«Cliente creado correctamente.»—, así que desplazaba y el rojo acusaba al caso, no
  // al detector.
  //
  // Lo que de verdad hay que medir es que el aviso VACÍO no mueva la pantalla. Y el flujo real
  // lo trae dentro: `onModalSubmit` llama al aviso DOS veces —`(null, "")` para limpiar y
  // luego el resultado—, así que un solo desplazamiento por envío ES la prueba de que el de
  // limpieza no desplaza. Se ejercita por el camino bueno, donde el de limpieza va delante.
  const nombre = todos(b.ctx.document.body).find((n) => n.tagName === 'INPUT' && n.name === 'name');
  assert.ok(nombre, '🔴 SUELO: no hay campo de nombre, así que este caso no prueba nada.');
  nombre.value = 'Talleres Ruiz';

  const llamadas = espiarScroll(b);
  await enviarElFormulario(b);

  assert.equal(llamadas.length, 1,
    `🔴 se ha desplazado ${llamadas.length} veces en un envío que emite DOS avisos (la limpieza `
    + 'y el resultado). Si son dos, el aviso VACÍO está moviendo la pantalla: ruido, y encima '
    + 'tapando lo que el profesional mira.');
  assert.ok(String(llamadas[0].nodo.className || '').split(' ').includes('alert'),
    '🔴 el nodo desplazado no es la caja de avisos.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CENSO · ¿cuántas costuras más tienen esta forma?
// ═════════════════════════════════════════════════════════════════════════════════════════

/** ¿Es una función con el cuerpo VACÍO? Ésa es la forma del no-op que se traga la llamada. */
function cuerpoVacio(init) {
  if (!init) return false;
  if (!ts.isFunctionExpression(init) && !ts.isArrowFunction(init)) return false;
  return init.body && ts.isBlock(init.body) && init.body.statements.length === 0;
}

/**
 * Las COSTURAS de un fichero: un no-op de módulo que además se REASIGNA y se INVOCA.
 *
 * Las tres condiciones juntas son el patrón, y ninguna sobra: sin reasignación no es una
 * costura sino una función vacía a secas; sin invocación no se traga nada.
 */
function costurasNoOp(codigo, nombre = 'x.js') {
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const noops = new Map();
  const reasignados = new Set();
  const invocados = new Set();
  const v = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && cuerpoVacio(n.initializer)) {
      noops.set(n.name.text, sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1);
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isIdentifier(n.left)) reasignados.add(n.left.text);
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) invocados.add(n.expression.text);
    ts.forEachChild(n, v);
  };
  v(sf);
  const out = [];
  for (const [nm, linea] of noops) {
    if (reasignados.has(nm) && invocados.has(nm)) out.push({ nombre: nm, linea });
  }
  return out;
}

test('SCRUM-756 · SUELO DEL CENSO: el detector DISTINGUE las tres condiciones', () => {
  assert.equal(costurasNoOp('let a = function () {}; function c(o){ a = o.x; } a("m");').length, 1,
    '🔴 CIEGO: no ve el patrón fabricado.');
  assert.equal(costurasNoOp('let f = function () {}; f();').length, 0,
    '🔴 FALSO ROJO: un no-op que nadie reasigna no es una costura.');
  assert.equal(costurasNoOp('let f = function () {}; f = g;').length, 0,
    '🔴 FALSO ROJO: un no-op que nadie invoca no se traga nada.');
  assert.equal(costurasNoOp('let f = function () { a(); }; f = g; f();').length, 0,
    '🔴 FALSO ROJO: una función CON cuerpo no es un no-op.');
});

test('SCRUM-756 · el censo de costuras no-op del dashboard no crece a escondidas', () => {
  const ficheros = fs.readdirSync(DIR_JS).filter((f) => f.endsWith('.js'));
  assert.ok(ficheros.length >= 70,
    `🔴 ESCÁNER CIEGO: sólo veo ${ficheros.length} vistas en ${DIR_JS}. El censo de abajo no vale.`);

  const hallados = [];
  for (const f of ficheros) {
    for (const c of costurasNoOp(fs.readFileSync(path.join(DIR_JS, f), 'utf8'), f)) {
      hallados.push(`${f} · \`${c.nombre}\``);
    }
  }

  // 🔴 CERO SERÍA CEGUERA, NO LIMPIEZA: `avisar` y `trasGuardar` existen y están medidos. Si este
  // censo devolviera 0, el detector se habría roto — y un 0 se lee como «no hay».
  assert.ok(hallados.length >= 2,
    `🔴 CIEGO: el censo devuelve ${hallados.length} costuras y hay DOS medidas en `
    + '`customersView.js` (`avisar` y `trasGuardar`). ARREGLA EL DETECTOR, no el número.');

  // Medido el 5-sep-2026: DOS, las dos del formulario compartido. `trasGuardar` es la otra mitad
  // del mismo patrón y se queda: su no-op es INOCUO —el documento no tiene tabla que recargar, y
  // así está escrito— pero es la misma forma, y si un día recarga algo tendrá el mismo agujero.
  assert.deepEqual(hallados.sort(), [
    'customersView.js · `avisar`',
    'customersView.js · `trasGuardar`',
  ], '🔴 HA CAMBIADO EL CENSO DE COSTURAS NO-OP:\n    ' + hallados.join('\n    ')
    + '\n\n  Una costura que nace no-op se traga la llamada mientras nadie la rellene, y quien la\n'
    + '  llama no se entera. Si es nueva, que la caja viva donde está la acción (SCRUM-756).');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS MUTACIONES QUE ME TUMBAN (SCRUM-745) · `npm run meta:mutaciones`
//
// Las dos imitan el defecto REAL, cada una por un lado distinto:
//   ① la caja del modal desaparece del DOM → el rechazo vuelve a ser invisible.
//   ② el modal vuelve a delegar en la costura global → reaparece la trampa de la caja ajena.
// ═════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'public/dashboard/js/customersView.js',
    de: '    modalAlertBox.textContent = msg || "";',
    a: '    modalAlertBox.textContent = "";',
    cae: 'EL QUE DECIDE: sin pasar por Clientes, el rechazo SE VE',
  },
  {
    fichero: 'public/dashboard/js/customersView.js',
    de: '    if (avisarEnLaVista) return avisar(tipo, msg);',
    a: '    return avisar(tipo, msg);',
    cae: 'LA TRAMPA: tras visitar Clientes, el aviso del DOCUMENTO no va a su caja',
  },
  {
    // ③ el desplazamiento desaparece. Sin esta mutación, la parte MECÁNICA del `scrollIntoView`
    // viajaría sin que nadie haya visto caer su guard — y un guard que no se ha visto fallar es
    // una decoración, no un guard.
    fichero: 'public/dashboard/js/customersView.js',
    de: '      try { modalAlertBox.scrollIntoView({ block: "nearest" }); } catch (_e) { /* el banco no lo trae */ }',
    a: '      /* mutación: sin desplazamiento */',
    cae: 'el aviso SE TRAE A LA VISTA: una vez, y sobre la caja',
  },
];
