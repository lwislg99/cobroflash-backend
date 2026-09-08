// tests/scrum644-trinquete-mensaje-crudo.test.mjs — SCRUM-644
//
// NADA VIGILABA QUE UNA VISTA NUEVA VOLVIERA A PINTAR `e.message`.
//
// SCRUM-641 arregló `productsView.js`; SCRUM-644 arregla `providersView.js`. Pero arreglar copias
// no cierra la puerta, y ésa es la familia de defecto de esta casa: el dinero (seis copias), el
// contador de scripts (cuatro conflictos), el vocabulario de códigos (dos capas). **El entregable
// de este ticket es el trinquete**, no los dos ficheros.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE ESTE FICHERO FIJA
//
// ① Un `.message` del servidor pintado sin traducir HACE CAER LA TANDA, nombrando fichero y línea.
// ② El censo heredado —57 sitios en 16 ficheros— NO CRECE. Si baja, se anota.
// ③ `productsView` y `providersView` se quedan en CERO: lo arreglado no se desarregla.
// ④ Las rutas MASIVAS siguen tragándose el P2002. Es idempotencia deliberada de ONBOARD-2.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { censo, crudosDe, PINTORES, TRADUCTORES } from './_censo-mensaje-crudo.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const MARCADOR = '[PENDIENTE microcopy oficial]';

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SUELO, EN LAS DOS DIRECCIONES
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-644 · 🔴 SUELO: el detector VE un `.message` pintado crudo', () => {
  assert.equal(crudosDe('c.js', 'setAlert("error", e.message || "x");').length, 1,
    '🔴 el detector no ve el caso conocido. Entonces su cero de abajo no significaría nada.');
  assert.equal(crudosDe('c.js', 'setStatus("error", err && err.message ? err.message : "x");').length, 1,
    '🔴 el detector no ve la forma con ternario, que es la mitad de los sitios del censo.');
});

test('SCRUM-644 · 🔴 CONTROL NEGATIVO: lo que SÍ pasa por el traductor no se acusa', () => {
  // Sin esto, un detector que acusara siempre también pasaría la prueba de arriba — y entonces
  // arreglar un sitio no lo sacaría del censo, que es justo lo que hace inútil a un trinquete.
  assert.equal(crudosDe('c.js', 'setAlert("error", mensajeDeErrorProveedor(e && e.message, "x"));').length, 0,
    '🔴 acusa a un sitio YA traducido.');
  assert.equal(crudosDe('c.js', 'setAlert("error", "texto fijo");').length, 0,
    '🔴 acusa a un aviso con texto literal, que no viene del servidor.');
  assert.equal(crudosDe('c.js', 'const t = e.message; guardar(t);').length, 0,
    '🔴 acusa a un `.message` que NO se pinta. Leerlo para decidir no es enseñarlo.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL TRINQUETE — el entregable
//
// El censo heredado se declara ENTERO, fichero a fichero. No se arregla aquí: `jobDetailView` y
// `quotesDetailView` son de otros carriles, y `products` lo lleva S1 en CAT-01. Lo que este
// trinquete impide es que la lista CREZCA.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Medido el 2-sep-2026 sobre `public/dashboard/js` (66 ficheros). Cada número es un TECHO.
 *
 * 🔴 Bajar está bien y hay que ANOTARLO aquí en el mismo commit que lo baja. Subir hace caer la
 * tanda nombrando fichero y línea. Un fichero que no esté en esta tabla tiene techo CERO.
 */
const CENSO_HEREDADO = Object.freeze({
  'albaranDetailView.js': 9,
  'api.js': 1,
  'app.js': 1,
  'csvImport.js': 2,
  'customersView.js': 3,
  'expensesView.js': 1,
  'exportView.js': 1,
  'homeView.js': 2,
  'invoiceDetailView.js': 4,
  'jobDetailView.js': 11,
  'jobsView.js': 2,
  'plansView.js': 2,
  'quotesDetailView.js': 9,
  'quotesView.js': 5,
  'settingsView.js': 3,
  'teamView.js': 1,
});

test('SCRUM-644 · 🔴 SUELO del censo: mira el dashboard entero y encuentra la población', () => {
  const r = censo(RAIZ);
  assert.ok(r.ficherosMirados > 50,
    `🔴 el censo sólo ha mirado ${r.ficherosMirados} ficheros: no está mirando el dashboard.`);
  assert.ok(r.hallazgos.length > 0,
    '🔴 el censo no encuentra NI UN sitio. O están todos arreglados —y entonces hay que vaciar la\n'
    + '  tabla de arriba en este mismo commit— o el detector se ha quedado ciego.');
});

test('SCRUM-644 · 🔴 EL TRINQUETE: ningún fichero pinta MÁS `.message` crudos que su techo', () => {
  const porFichero = new Map();
  for (const h of censo(RAIZ).hallazgos) {
    const base = h.fichero.split('/').pop();
    if (!porFichero.has(base)) porFichero.set(base, []);
    porFichero.get(base).push(h);
  }

  const excesos = [];
  for (const [base, sitios] of porFichero) {
    const techo = CENSO_HEREDADO[base] || 0;
    if (sitios.length > techo) {
      excesos.push(`  ${base}: ${sitios.length} sitios y el techo es ${techo}\n`
        + sitios.map((s) => `      ${s.fichero}:${s.linea}  ${s.pintor}(…)  ${s.fragmento}`).join('\n'));
    }
  }
  assert.deepEqual(excesos, [],
    '🔴 SE PINTA UN `.message` DEL SERVIDOR SIN TRADUCIR. Un identificador como `name_duplicate`\n'
    + '  en pantalla no es un mensaje mal redactado: es una tubería interna asomando a la interfaz.\n'
    + '  Pásalo por un traductor de la pantalla, como `mensajeDeErrorProveedor` (SCRUM-644) o\n'
    + '  `mensajeDeErrorCatalogo` (SCRUM-641). NO en `api.js`: es zona sin marcador por decisión.\n\n'
    + excesos.join('\n'));
});

test('SCRUM-644 · 🔴 y el censo heredado NO CRECE por la puerta de atrás', () => {
  // El de arriba caza un fichero que se pase de su techo. Éste caza que la TABLA engorde: subir un
  // número para que el otro test pase es exactamente cómo muere un trinquete.
  const total = Object.values(CENSO_HEREDADO).reduce((a, b) => a + b, 0);
  assert.ok(total <= 57,
    `🔴 el censo heredado ha subido a ${total}. Sólo puede BAJAR. Si un fichero necesita más sitios,\n`
    + '  el arreglo es traducirlos, no ampliarle el techo.');
  assert.equal(censo(RAIZ).hallazgos.length <= total, true,
    '🔴 hay más sitios en el árbol que en la tabla.');
});

test('SCRUM-644 · 🔴 lo ARREGLADO se queda en cero: products y providers', () => {
  for (const base of ['productsView.js', 'providersView.js']) {
    const sitios = crudosDe(base, leer(`public/dashboard/js/${base}`));
    assert.deepEqual(sitios.map((s) => s.linea), [],
      `🔴 ${base} vuelve a pintar un \`.message\` crudo. SCRUM-641/644 lo cerraron:\n`
      + sitios.map((s) => `      :${s.linea}  ${s.fragmento}`).join('\n'));
    assert.equal(CENSO_HEREDADO[base], undefined,
      `🔴 ${base} ha vuelto a la tabla del censo heredado. Su techo es CERO.`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ANTES Y DESPUÉS, ejecutando el traductor de verdad
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/** `providersView.js` cuelga sus funciones de `window`, como en el navegador. */
function cargarProvidersView() {
  const win = {};
  const fuente = leer('public/dashboard/js/providersView.js');
  new Function('window', 'document', 'console', fuente)(
    win, { createElement: () => ({ style: {}, classList: { add() {} }, appendChild() {} }) },
    { warn() {} },
  );
  return win;
}

test('SCRUM-644 · 🔴 ANTES: la mitad A sigue metiendo el código crudo en el Error', () => {
  // No se ha tocado: es lo que hace que el defecto exista. Lo que cambia es quién lo pinta.
  const fuente = leer('public/dashboard/js/providersView.js');
  assert.match(fuente, /throw new Error\(data\?\.error \|\| "Error creando proveedor"\)/,
    '🔴 la mitad A ha cambiado. Este control compara ANTES contra DESPUÉS y necesita el ANTES.');

  // Y ésta es la cadena que llegaba a la pantalla, ejecutada:
  const data = { ok: false, error: 'name_duplicate' };
  const e = new Error(data?.error || 'Error creando proveedor.');
  assert.equal(e.message || 'Error creando proveedor.', 'name_duplicate',
    '🔴 el identificador ya no gana al respaldo; entonces el defecto no era éste.');
});

test('SCRUM-644 · 🔴 DESPUÉS: sale el MARCADOR, no el identificador', () => {
  const win = cargarProvidersView();
  assert.equal(typeof win.mensajeDeErrorProveedor, 'function',
    '🔴 `providersView` no expone su traductor: el control no puede ejecutarlo.');

  const salida = win.mensajeDeErrorProveedor('name_duplicate', 'Error creando proveedor.');
  assert.ok(salida.startsWith(MARCADOR),
    `🔴 no sale el marcador de microcopy, sale «${salida}».`);
  assert.equal(salida.includes('name_duplicate'), false,
    `🔴 el identificador sigue llegando a la pantalla: «${salida}»`);
});

test('SCRUM-644 · un código SIN mapear cae al respaldo en castellano, no al identificador', () => {
  const win = cargarProvidersView();
  const salida = win.mensajeDeErrorProveedor('empty_update', 'Error actualizando proveedor.');
  assert.equal(salida, 'Error actualizando proveedor.',
    `🔴 un código sin mapear no cae al respaldo: «${salida}»`);
  // Y una frase de verdad pasa entera: no se pisa lo que ya estaba bien escrito.
  assert.equal(win.mensajeDeErrorProveedor('No se pudo conectar', 'x'), 'No se pudo conectar');
});

test('SCRUM-644 · `provider_in_use` conserva su texto EXACTO: se mudó, no se reescribió', () => {
  const win = cargarProvidersView();
  assert.equal(
    win.mensajeDeErrorProveedor('provider_in_use', 'Error borrando proveedor.'),
    'No se puede borrar el proveedor porque está asignado a uno o más productos.',
    '🔴 el texto que ya existía ha cambiado. Mudarlo al mapa no autoriza a reescribirlo (regla 30).');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LA LECCIÓN DE SCRUM-575: SE CUENTAN MARCAS, NO RÓTULOS
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-644 · 🔴 el censo de marcadores cuenta MARCAS, no el literal', () => {
  // Si se contara el literal `[PENDIENTE microcopy oficial]`, este fichero sumaría UNO —la
  // constante— aunque lleve varias superficies marcadas. Es el defecto de SCRUM-575: otro ticket
  // reutiliza la constante, el censo no sube, y entra una pantalla sin firmar en silencio.
  const fuente = leer('public/dashboard/js/providersView.js');
  const literales = fuente.split(MARCADOR).length - 1;
  const usos = fuente.split('PRV_MARCADOR_MICROCOPY').length - 1;
  assert.equal(literales, 1, '🔴 el marcador se ha escrito a mano más de una vez.');
  assert.ok(usos > literales,
    `🔴 SUELO: sólo ${usos} referencias a la constante. Si contar el literal diera lo mismo que\n`
    + '  contar las marcas, este test no estaría midiendo la diferencia que denuncia.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// CONTROL NEGATIVO: LO QUE NO SE PUEDE ROMPER
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-644 · 🔴 las rutas MASIVAS siguen tragándose el P2002 (idempotencia de ONBOARD-2)', () => {
  // `POST /load-catalog` y `POST /import` ignoran el duplicado A PROPÓSITO: se pueden relanzar sin
  // romper nada. Si empezaran a devolver 409, esto no sería un arreglo: sería romper una decisión.
  const rutas = leer('src/modules/products/app/routes/products.routes.ts');
  assert.equal(rutas.split("if (e?.code !== 'P2002') throw e").length - 1, 2,
    '🔴 las dos rutas masivas ya no ignoran el P2002. Eso rompe la idempotencia de ONBOARD-2.');
  // Y las SINGULARES sí lo traducen: es la distinción que hace que lo de arriba no sea un descuido.
  assert.ok(rutas.includes("error: 'name_duplicate'"),
    '🔴 las rutas singulares han dejado de devolver `name_duplicate`.');
});

test('SCRUM-644 · las dos listas del censo se escriben A MANO (criterio de SCRUM-645)', () => {
  // Si el censo dedujera los pintores o los traductores, un caso nuevo entraría solo: se daría por
  // bueno sin que nadie lo decidiera, o quedaría fuera sin que nadie se enterara.
  const modulo = leer('tests/_censo-mensaje-crudo.mjs');
  assert.match(modulo, /export const PINTORES = Object\.freeze\(\[/, '🔴 los pintores ya no se declaran.');
  assert.match(modulo, /export const TRADUCTORES = Object\.freeze\(\[/, '🔴 los traductores ya no se declaran.');
  assert.ok(PINTORES.length >= 2 && TRADUCTORES.length >= 2, '🔴 alguna lista se ha vaciado.');
  assert.equal(/import[^\n]*from '\.\.\/public/.test(modulo), false,
    '🔴 el censo ha empezado a importar del código que vigila. Entonces hereda la lista de quien\n'
    + '  emite y el trinquete queda inerte — es justo lo que SCRUM-645 cerró en la puerta.');
});
