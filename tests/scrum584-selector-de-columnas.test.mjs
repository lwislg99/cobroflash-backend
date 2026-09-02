// tests/scrum584-selector-de-columnas.test.mjs — SCRUM-584 (CONT-11)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL SELECTOR DE COLUMNAS. Y LO PRIMERO: SIRVE PARA AÑADIR, NO PARA QUITAR.
//
// El encargo original decía que a 360 px había «scroll horizontal permanente». **Se midió y era
// al revés** (343 = 343): la tabla no es una tabla, es una pila de tarjetas
// (`table--stack-mobile`, `thead` en `display:none`), y lo que pasa es que el CSS oculta cuatro
// columnas con `col-hide-mobile` y **nadie podía encenderlas**. El profesional que vive del email
// o de las notas no los veía en el móvil y no tenía forma de pedirlos.
//
// El coste de encender es VERTICAL y lo asume quien enciende: la fila pasa de 153 px a 222 px con
// las cuatro (medido a 360 px, en navegador). Por eso se puede deshacer.
//
// 🔴 SIN SALIDA MUERTA, Y POR CONSTRUCCIÓN: `Nombre` y las acciones son FIJAS. Apagarlo todo es
// imposible, así que la lista no puede quedarse inservible — y no hace falta un mínimo artificial
// que alguien tenga que recordar. Un control que te deja sin pantalla es peor que no tenerlo.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
const FC = require_(path.join(RAIZ, 'public/dashboard/js/filtroClientes.js'));
const VISTA = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/customersView.js'), 'utf8');

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · sin población no hay veredicto
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-584 · SUELO: la lista de columnas existe y tiene las de hoy', () => {
  assert.ok(Array.isArray(FC.COLUMNAS) && FC.COLUMNAS.length >= 8,
    `🔴 ESCÁNER CIEGO: veo ${FC.COLUMNAS && FC.COLUMNAS.length} columnas. Con la lista vacía, `
    + '«esa columna no está» y «no supe mirar» dan el mismo verde.');
  assert.ok(FC.columnasElegibles().length >= 5,
    '🔴 no hay columnas elegibles: el control no ofrecería nada.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LO QUE NO SE PUEDE PERDER
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-584 · 🔴 F1: el teléfono NACE VISIBLE, y es ocultable pero nunca por defecto', () => {
  const tel = FC.COLUMNAS.filter((c) => c.id === 'telefono')[0];
  assert.ok(tel, '🔴 ha desaparecido la columna del teléfono.');
  assert.equal(tel.ocultaEnMovil, false,
    '🔴 F1 ROTO: el teléfono nace OCULTO. Es donde YaQu gana a Holded, que ni lo tiene como '
    + 'columna: puede apagarlo el profesional, nunca el producto.');
  // Con la preferencia vacía —un navegador recién estrenado— se ve.
  assert.equal(FC.claseDeColumna('telefono', []), '',
    '🔴 F1 ROTO: con la preferencia vacía el teléfono no se ve.');
  // Y es OCULTABLE: está entre las elegibles, no es fija.
  assert.equal(tel.fija, false,
    '🔴 el teléfono se ha vuelto fijo: F1 dice que el profesional PUEDE ocultarlo si lo decide.');
});

test('SCRUM-584 · 🔴 F3: las acciones NO son ocultables', () => {
  const acciones = FC.COLUMNAS.filter((c) => c.id === 'acciones')[0];
  assert.ok(acciones, '🔴 ha desaparecido la columna de acciones.');
  assert.equal(acciones.fija, true,
    '🔴 F3 ROTO: las acciones son ocultables. Editar · Portal · Historial van por fila y no se '
    + 'apagan: sin ellas la fila deja de poder hacer nada.');
  assert.equal(FC.columnasElegibles().some((c) => c.id === 'acciones'), false,
    '🔴 las acciones salen en el control: ofrecer algo que no se puede hacer.');
  for (const accion of ['Editar', 'Portal', 'Historial']) {
    assert.ok(VISTA.includes(accion), `🔴 F3 ROTO: ha desaparecido la acción «${accion}».`);
  }
});

test('SCRUM-584 · 🔴 SIN SALIDA MUERTA: apagarlo TODO es imposible', () => {
  // No se comprueba «queda al menos una»: se comprueba que la lista SIEMPRE tiene fijas, que es
  // lo que lo hace imposible. Un mínimo que hay que recordar se olvida; una fija, no.
  const fijas = FC.COLUMNAS.filter((c) => c.fija);
  assert.ok(fijas.length >= 2,
    '🔴 no hay columnas fijas: apagándolo todo la lista se quedaría inservible.');
  assert.ok(fijas.some((c) => c.id === 'nombre'),
    '🔴 `Nombre` ha dejado de ser fija: una lista de clientes sin nombre no es una lista.');

  // Y con TODO apagado, las fijas siguen visibles.
  const nada = [];
  assert.equal(FC.claseDeColumna('nombre', nada), '', '🔴 el nombre se esconde con todo apagado.');
  assert.equal(FC.claseDeColumna('acciones', nada), '', '🔴 las acciones se esconden.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL SUELO CON CONTROL POSITIVO: encender una columna la enseña Y las demás siguen
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-584 · 🔴 encender UNA columna la enseña, y las demás siguen como estaban', () => {
  // Una tabla vacía pasa cualquier test de «esa columna está». Por eso se comprueba a la vez que
  // la encendida aparece Y que las otras NO se han movido.
  const antes = FC.COLUMNAS.map((c) => FC.claseDeColumna(c.id, []));
  const despues = FC.COLUMNAS.map((c) => FC.claseDeColumna(c.id, ['email']));

  const iEmail = FC.COLUMNAS.findIndex((c) => c.id === 'email');
  assert.equal(antes[iEmail], 'col-hide-mobile', '🔴 SUELO: el email no estaba oculto de partida.');
  assert.equal(despues[iEmail], '', '🔴 encender «Email» no lo enseña.');

  // CONTROL POSITIVO: las demás no cambian. Si el mecanismo apagara todo lo no elegido, esto lo dice.
  for (let i = 0; i < FC.COLUMNAS.length; i++) {
    if (i === iEmail) continue;
    assert.equal(despues[i], antes[i],
      `🔴 encender «Email» ha cambiado «${FC.COLUMNAS[i].texto}». El selector AÑADE: no puede `
      + 'apagar lo que el profesional no ha tocado.');
  }
});

test('SCRUM-584 · 🔴 CONTROL NEGATIVO: sin nada guardado, la pantalla es la de HOY', () => {
  // Nadie se encuentra la pantalla cambiada sin pedirlo. Éstas son las clases de hoy, exactas.
  const hoy = { id: '', nombre: '', telefono: '', email: 'col-hide-mobile', notas: 'col-hide-mobile',
    etiquetas: 'col-hide-mobile', alta: 'col-hide-mobile', acciones: '' };
  for (const [id, clase] of Object.entries(hoy)) {
    assert.equal(FC.claseDeColumna(id, []), clase,
      `🔴 con la preferencia vacía, «${id}» no sale como hoy.`);
  }
});

test('SCRUM-584 · 🔴 lo guardado se respeta, y la basura NO rompe la pantalla', () => {
  // `localStorage` lo escribe cualquiera y sobrevive a los despliegues. Los tres casos malos caen
  // al mismo sitio —la preferencia vacía, que es «lo de hoy»— en vez de reventar la tabla.
  assert.deepEqual(FC.normalizarColumnas(['email', 'notas']), ['email', 'notas']);
  assert.deepEqual(FC.normalizarColumnas(['email', 'email']), ['email'], '🔴 no deduplica.');
  assert.deepEqual(FC.normalizarColumnas(['columnaQueYaNoExiste']), [],
    '🔴 una columna retirada sigue contando: el día que se quite una, la tabla se descuadra.');
  for (const basura of [null, undefined, 'email', 42, { email: true }]) {
    assert.deepEqual(FC.normalizarColumnas(basura), [],
      `🔴 con ${JSON.stringify(basura)} guardado no se vuelve a «lo de hoy».`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL `colSpan` DEJA DE SER UNA CONSTANTE — y es la mitad del ticket
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-584 · 🔴 el `colSpan` de los vacíos sale de la MISMA lista que la cabecera', () => {
  // Antes había dos `colSpan = 8` escritos a mano, y otra sesión los tuvo que recalcular al entrar
  // «Etiquetas». Un número copiado envejece en silencio: **un vacío descuadrado no lo ve ninguna
  // tanda**, porque el estado vacío sólo se pinta cuando no hay clientes.
  assert.equal(FC.colSpanDeLaTabla(), FC.COLUMNAS.length,
    '🔴 el `colSpan` y la cabecera ya no salen del mismo sitio.');
  assert.deepEqual([...VISTA.matchAll(/td\.colSpan = \d+/g)].map((m) => m[0]), [],
    '🔴 ha vuelto un `colSpan` con el número a mano.');
  assert.ok([...VISTA.matchAll(/td\.colSpan = FC\.colSpanDeLaTabla\(\)/g)].length >= 2,
    '🔴 no todos los vacíos derivan su `colSpan` de la lista.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA PANTALLA, EJECUTADA · mencionar no es hacer
// ═════════════════════════════════════════════════════════════════════════════════════════
async function pantalla() {
  const banco = cargarDashboard(RAIZ, { datos: {} });
  const crear = banco.ctx.document.createElement;
  banco.ctx.document.createElement = function (tag) {
    const n = crear.call(this, tag);
    if (String(tag).toLowerCase() === 'form' && typeof n.reset !== 'function') n.reset = function () {};
    return n;
  };
  const r = await pintarVista(banco, 'renderCustomersView');
  assert.equal(r.error, null, `🔴 la pantalla de clientes revienta: ${r.error && r.error.message}`);
  return r;
}

test('SCRUM-584 · 🔴 el control SE MONTA, con una casilla por columna elegible', async () => {
  const r = await pantalla();
  const box = todos(r.contenedor).find((n) => String(n.className || '').includes('columnas-selector'));
  assert.ok(box, '🔴 el selector de columnas no llega al DOM: que el módulo decida no lo pinta.');

  const casillas = todos(r.contenedor).filter((n) => n.type === 'checkbox' && n.dataset && n.dataset.columna);
  assert.equal(casillas.length, FC.columnasElegibles().length,
    `🔴 hay ${casillas.length} casillas y ${FC.columnasElegibles().length} columnas elegibles.`);

  // 🔴 La casilla describe LO QUE HAY, no lo que se ha tocado: el teléfono nace MARCADO porque
  // hoy se ve. Si naciera desmarcada, el control mentiría sobre la pantalla.
  const tel = casillas.find((c) => c.dataset.columna === 'telefono');
  assert.equal(tel.checked, true, '🔴 el teléfono nace desmarcado y sin embargo se ve: el control miente.');
  const email = casillas.find((c) => c.dataset.columna === 'email');
  assert.equal(email.checked, false, '🔴 el email nace marcado y sin embargo está oculto en móvil.');
});

test('SCRUM-584 · 🔴 los CINCO controles conviven: buscador, pestañas, etiqueta, orden y columnas', async () => {
  // Los cuatro de antes siguen funcionando COMBINADOS con el nuevo. Si el selector hubiera
  // reemplazado la toolbar en vez de sumarse, esto lo dice.
  const r = await pantalla();
  const t = todos(r.contenedor);
  assert.ok(t.some((n) => String(n.placeholder || '').includes('Buscar')), '🔴 falta el buscador.');
  assert.ok(t.some((n) => String(n.className || '').includes('customers-tab')), '🔴 faltan las pestañas.');
  assert.ok(t.some((n) => n.tagName === 'SELECT' && String(n._texto || '').includes(FC.TEXTOS_ETIQUETAS.sinFiltro))
    || t.filter((n) => n.tagName === 'SELECT').length >= 2, '🔴 falta el filtro de etiqueta.');
  assert.ok(t.filter((n) => n.tagName === 'SELECT').length >= 2, '🔴 falta el selector de orden.');
  assert.ok(t.some((n) => String(n.className || '').includes('columnas-selector')), '🔴 falta el de columnas.');
});

test('SCRUM-584 · la vista no repite la lista de columnas: la lee de la pieza', () => {
  // Dos sitios que declaran las mismas columnas divergen — es el defecto que dejó dos `colSpan`
  // copiados a mano.
  const codigo = VISTA.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  assert.match(codigo, /FC\.columnasDeLaTabla\(\)/, '🔴 la cabecera no sale de la pieza.');
  assert.equal(/\{ t: "ID" \}/.test(codigo), false,
    '🔴 ha vuelto la lista de cabeceras escrita a mano en la vista.');
  assert.equal(/"col-hide-mobile"/.test(codigo), false,
    '🔴 la vista vuelve a escribir `col-hide-mobile` a mano: esa clase la decide `claseDeColumna`, '
    + 'y una escrita a mano se salta la preferencia del profesional.');
});

test('SCRUM-584 · la preferencia se guarda EN EL NAVEGADOR, y su fallo no rompe nada', () => {
  assert.match(VISTA, /localStorage\.getItem\(CLAVE_COLUMNAS\)/, '🔴 no se lee la preferencia.');
  assert.match(VISTA, /localStorage\.setItem\(CLAVE_COLUMNAS/, '🔴 no se guarda la preferencia.');
  // 🔴 Y las dos van dentro de `try`: un navegador con el almacenamiento bloqueado no puede
  // dejar la lista de clientes sin pintar.
  const leer = VISTA.slice(VISTA.indexOf('function leerColumnas'), VISTA.indexOf('function guardarColumnas'));
  assert.match(leer, /try \{/, '🔴 la lectura de la preferencia no está protegida.');
  assert.match(VISTA.slice(VISTA.indexOf('function guardarColumnas')), /try \{/,
    '🔴 el guardado no está protegido.');
});

test('SCRUM-584 · el rótulo del control sale de la pieza y NO es un marcador', () => {
  assert.equal(FC.TEXTOS_COLUMNAS.control, 'Columnas',
    '🔴 el rótulo del control ha cambiado sin pasar por quien lo aprueba (regla 30).');
  assert.equal(/PENDIENTE|^\[/.test(FC.TEXTOS_COLUMNAS.control), false,
    '🔴 el rótulo es un MARCADOR: el censo llegó a cero y esto lo rompería.');
  assert.match(VISTA, /FC\.TEXTOS_COLUMNAS\.control/, '🔴 la vista repite el texto en vez de leerlo.');
});
