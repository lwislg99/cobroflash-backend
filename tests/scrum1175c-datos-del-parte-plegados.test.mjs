// SCRUM-1175 (916a, PR-C) · LOS DATOS DEL PARTE, PLEGADOS AL FINAL — y SCRUM-1189, el tipo que no
// se guardaba.
//
// Tres cosas que este fichero exige, montando la vista de verdad en el banco:
//   1. 🔴 SIN RETIRAR NI UN CAMPO. Plegar no es quitar: el inventario de casillas `data-parte-campo`
//      y de radios del tipo es EL MISMO antes y después, en el parte editable y en el firmado.
//      (Medido antes del cambio sobre origin/main 0a10475c con la misma forma de parte.)
//   2. Los textos firmados que se pintan, y los CUATRO firmados que NO se cumplen, ausentes:
//      «La del trabajo, si no pones otra», «Los del trabajo», «Solo tú», «Quién más ha estado en la
//      obra» (ver el bloque de TEXTOS de la vista y docs/master/SCRUM-1175.md).
//   3. 🔴 SCRUM-1189 · el viaje ENTERO del tipo: marcar → PATCH → recargar → sale marcado. No basta
//      con que el click dispare algo: lo que fallaba era que nada lo guardaba.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const BASE = Object.freeze({
  id: 7, numero: 'PT-2026-007', clienteNombre: 'Comunidad Los Olivos',
  fecha: '2026-09-02T08:00:00.000Z', obra: 'C/ Mayor 3', referencia: 'R-9',
  entrada: '08:00', salida: '11:30', desplazamientos: 1, kilometros: 12,
  tecnicos: ['Israel', 'Miguel'], tipo: 'mantenimiento',
  lineas: [{ bloque: 'mano_obra', unds: 2, descripcion: 'Revisión' }],
  notas: 'Dejar la llave al portero del edificio', estado: 'borrador',
  puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
});
const FIRMADO = { ...BASE, estado: 'firmado', puedeEditarContenido: { ok: false, motivo: 'firmado' } };
const VACIO = { ...BASE, obra: null, referencia: null, tecnicos: [], tipo: null, notas: null };

// El inventario de ANTES (origin/main 0a10475c, mismo parte). Los 7 de SCRUM-818 + notas.
const CAMPOS = ['obra', 'referencia', 'tecnicos', 'entrada', 'salida', 'desplazamientos', 'kilometros', 'notas'];
const TIPOS = ['reparacion_asistencia', 'mantenimiento', 'instalacion'];

const attr = (n, a) => (n.getAttribute ? n.getAttribute(a) : null);
const texto = (n) => todos(n).filter((x) => x.tagName === '#text' || !x.hijos?.length).map((x) => x.textContent || '').join(' ');

function pintar(parte) {
  const b = cargarDashboard(RAIZ);
  const c = b.mk('div');
  assert.equal(b.ctx.renderParte(c, parte), true, '🔴 SUELO: la vista se negó a pintar');
  return { b, c, n: todos(c) };
}

test('SCRUM-1175c · 🔴 INVENTARIO: los mismos 8 campos y los 3 tipos, editable y firmado', () => {
  const { n } = pintar(BASE);
  const campos = n.filter((x) => attr(x, 'data-parte-campo')).map((x) => attr(x, 'data-parte-campo'));
  assert.deepEqual([...campos].sort(), [...CAMPOS].sort(), '🔴 el parte editable ha perdido o ganado un campo');
  const radios = n.filter((x) => attr(x, 'type') === 'radio').map((x) => attr(x, 'value'));
  assert.deepEqual(radios, TIPOS, '🔴 faltan tipos de intervención');

  const f = pintar(FIRMADO).n;
  const datos = f.filter((x) => attr(x, 'data-parte-dato')).map((x) => attr(x, 'data-parte-dato'));
  assert.deepEqual([...datos].sort(), [...CAMPOS].sort(), '🔴 el parte firmado ha perdido un dato');
});

test('SCRUM-1175c · los cuatro datos van plegados, al final y DESPUÉS de las firmas', () => {
  const { n } = pintar(BASE);
  const plegables = n.filter((x) => attr(x, 'data-parte-plegable')).map((x) => attr(x, 'data-parte-plegable'));
  assert.deepEqual(plegables, ['obra', 'tipo', 'tecnicos', 'notas']);
  assert.ok(plegables.length && n.filter((x) => attr(x, 'data-parte-plegable')).every((x) => x.tagName === 'DETAILS'),
    '🔴 una línea plegable no es un <details>');
  const seccion = n.findIndex((x) => attr(x, 'data-parte-datos-del-parte'));
  const firmaCliente = n.findIndex((x) => attr(x, 'data-parte-firmas'));
  assert.ok(seccion > 0, '🔴 SUELO: no está la sección «Datos del parte»');
  assert.ok(firmaCliente > 0, '🔴 SUELO: no encuentro el paso de las firmas');
  assert.ok(seccion > firmaCliente, '🔴 los datos del parte siguen delante de las firmas');
  // Cada casilla de esos datos vive DENTRO de su línea plegada.
  for (const [clave, campos] of [['obra', ['obra', 'referencia']], ['tecnicos', ['tecnicos']], ['notas', ['notas']]]) {
    const linea = n.find((x) => attr(x, 'data-parte-plegable') === clave);
    const dentro = todos(linea).filter((x) => attr(x, 'data-parte-campo')).map((x) => attr(x, 'data-parte-campo'));
    assert.deepEqual(dentro, campos, `🔴 la línea «${clave}» no lleva sus campos`);
  }
});

test('SCRUM-1175c · los resúmenes: el dato si lo hay, y el texto firmado si no', () => {
  const lleno = pintar(BASE).n;
  const res = (n, k) => (n.find((x) => attr(x, 'data-parte-resumen') === k) || {}).textContent;
  assert.equal(res(lleno, 'obra'), 'C/ Mayor 3 · R-9');
  assert.equal(res(lleno, 'tipo'), 'Mantenimiento');
  assert.equal(res(lleno, 'tecnicos'), 'Israel, Miguel');
  assert.equal(res(lleno, 'notas'), 'Dejar la llave al portero de…');

  const vacio = pintar(VACIO).n;
  assert.equal(res(vacio, 'obra'), 'Sin dirección ni referencia');
  assert.equal(res(vacio, 'tipo'), 'Sin elegir');
  assert.equal(res(vacio, 'tecnicos'), 'Sin técnicos');
  assert.equal(res(vacio, 'notas'), 'Sin notas');
});

test('SCRUM-1175c · marcadores firmados en los campos, y NINGUNO de los cuatro que no se cumplen', () => {
  const { n, c } = pintar(VACIO);
  const pista = (k) => attr(n.find((x) => attr(x, 'data-parte-campo') === k), 'placeholder');
  assert.equal(pista('obra'), 'Dónde se ha hecho el trabajo');
  assert.equal(pista('referencia'), 'Tu referencia interna, si usas alguna');
  assert.equal(pista('tecnicos'), 'Quién ha estado en la obra');
  assert.equal(pista('notas'), 'Lo que haya que dejar dicho.');
  const html = c.innerHTML;
  assert.ok(html.length > 1500, `🔴 CIEGO: pintó ${html.length} caracteres`);
  for (const falso of ['La del trabajo, si no pones otra', 'Los del trabajo', 'Solo tú', 'Quién más ha estado en la obra']) {
    assert.ok(!html.includes(falso), `🔴 se pinta «${falso}», que no se cumple en el código`);
  }
});

test('SCRUM-1175c · las fichas del tipo miden 48 px de alto en la hoja', async () => {
  const fs = await import('node:fs');
  const css = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'css', 'styles.css'), 'utf8');
  const regla = css.match(/\.parte-tipo \.parte-tipo-ficha \{[^}]*\}/);
  assert.ok(regla, '🔴 no hay regla para las fichas del tipo');
  assert.match(regla[0], /min-height:\s*48px/);
  const cabeza = css.match(/\.parte-plegable-cabeza \{[^}]*\}/);
  assert.ok(cabeza, '🔴 no hay regla para la línea plegable');
  assert.match(cabeza[0], /min-height:\s*48px/);
});

// ── SCRUM-1189 ─────────────────────────────────────────────────────────────────────────────
function servidor(inicial) {
  let guardado = { ...inicial };
  const patches = [];
  const apiRequest = async (ruta, opts = {}) => {
    if ((opts.method || 'GET') === 'PATCH' && /\/admin\/partes\/7$/.test(ruta)) {
      const cuerpo = JSON.parse(opts.body);
      patches.push(cuerpo);
      guardado = { ...guardado, ...cuerpo };
      return guardado;
    }
    if (/\/admin\/partes\/7$/.test(ruta)) return { ...guardado };
    return {};
  };
  return { apiRequest, patches, leer: () => guardado };
}

async function montar(b, srv) {
  const c = b.mk('div');
  b.ctx.document.body.appendChild(c);
  const ok = await b.ctx.renderParteDetailView(c, 7, { apiRequest: srv.apiRequest });
  assert.notEqual(ok, false, '🔴 SUELO: la vista del parte no se ha montado');
  return c;
}

test('SCRUM-1189 · 🔴 marcar el tipo, guardar y RECARGAR devuelve el tipo marcado', async () => {
  const srv = servidor({ ...BASE, tipo: null });
  const b = cargarDashboard(RAIZ);
  const c = await montar(b, srv);
  const radios = todos(c).filter((x) => attr(x, 'name') === 'parte-tipo');
  assert.equal(radios.length, 3, '🔴 SUELO: no están los tres tipos');
  const instalacion = radios.find((x) => attr(x, 'value') === 'instalacion');
  instalacion.checked = true;
  assert.ok(instalacion.disparar('change') > 0, '🔴 el radio del tipo no tiene quien lo escuche');
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(srv.patches, [{ tipo: 'instalacion' }], '🔴 marcar el tipo no manda nada al servidor');
  assert.equal(srv.leer().tipo, 'instalacion');
  const resumen = todos(c).find((x) => attr(x, 'data-parte-resumen') === 'tipo');
  assert.equal(resumen.textContent, 'Instalación', '🔴 el resumen no dice el tipo recién marcado');

  // RECARGAR: otra vista, desde lo que quedó en el servidor.
  const c2 = await montar(cargarDashboard(RAIZ), srv);
  const marcado = todos(c2).filter((x) => attr(x, 'name') === 'parte-tipo' && attr(x, 'checked') != null)
    .map((x) => attr(x, 'value'));
  assert.deepEqual(marcado, ['instalacion'], '🔴 al recargar, el tipo marcado se ha perdido');
});

test('SCRUM-1189 · CONTROL: un parte firmado no guarda el tipo (los radios salen deshabilitados)', () => {
  const { n } = pintar(FIRMADO);
  const radios = n.filter((x) => attr(x, 'name') === 'parte-tipo');
  assert.equal(radios.length, 3);
  assert.ok(radios.every((x) => attr(x, 'disabled') != null), '🔴 un parte firmado deja cambiar el tipo');
});
