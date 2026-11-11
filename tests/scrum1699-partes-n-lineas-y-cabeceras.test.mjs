// tests/scrum1699-partes-n-lineas-y-cabeceras.test.mjs — SCRUM-1699 (PILOTO-1, T6 de SCRUM-1686)
//
// Sin gate: monta «Partes por valorar» en el banco. Ni BD, ni red, ni navegador.
//
// Dos textos firmados (SCRUM-1686 c.21471 sobre la tanda c.21470):
//   N10 · la fila dice «{n} líneas» / «1 línea», no «{n} ⚬» (un glifo que no decía qué contaba).
//   N11 · el detalle rotula sus columnas «Cant. · Precio ud. · Importe» (extiende el alcance de las
//         firmadas nº 18-19; sin literal nuevo).
// Y la propiedad que hace que N11 sirva: el rótulo cae ENCIMA de su columna. Por eso cabecera y
// línea usan las MISMAS clases de columna, y las de números no encogen (si encogieran, cada línea
// las pondría a una altura distinta según su descripción: medido a 390 en yaqu.app).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { datosDelCenso, ARGUMENTOS_DEL_CENSO } from '../scripts/_datos-del-censo.mjs';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { ejecutableDe } from './_guard-texto.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FN = 'renderPartesOficinaView';
const esperar = async () => { for (let i = 0; i < 8; i++) await new Promise((res) => setImmediate(res)); };
const clases = (n) => String(n.className || '').split(/\s+/).filter(Boolean);
const COLUMNAS = ['po-col-cant', 'po-col-precio', 'po-col-importe'];

const linea = (id, bloque, descripcion, unds) => ({ id, bloque, descripcion, unds, precioUnitario: null, importe: null });
const PARTE = {
  id: 'p-1699', numero: 'PT-1699', clienteNombre: 'Cliente 1699', obra: null,
  puedeEditarPrecios: { ok: true },
  lineas: [linea(1, 'mano_obra', 'Espera al portero', 2), linea(2, 'mano_obra', 'Tiempo en obra', 4),
    linea(3, 'materiales', 'Cable', 2), linea(4, 'materiales', 'Bombilla', 3)],
};

async function montar() {
  const dc = datosDelCenso();
  dc.enVista(FN);
  const datos = (url, ...resto) => {
    if (/^\/admin\/partes\/[^/]+\/oficina$/.test(String(url))) return PARTE;
    const r = dc.datos(url, ...resto);
    if (String(url) === '/admin/partes/oficina/pendientes' && r && Array.isArray(r.pendientes) && r.pendientes.length >= 1) {
      // Uno con UNA línea y otro con cuatro: el singular y el plural en la misma lista.
      const base = r.pendientes[0];
      return { ...r, pendientes: [{ ...base, id: 'uno-1699', numero: 'P-1', lineas: [PARTE.lineas[0]] },
        { ...base, id: PARTE.id, numero: PARTE.numero, lineas: PARTE.lineas }] };
    }
    return r;
  };
  const r = await pintarVista(cargarDashboard(RAIZ, { datos }), FN, ...(ARGUMENTOS_DEL_CENSO[FN] || []));
  assert.equal(r.error, null, `🔴 NO PUDE MIRAR: la vista revienta al montarse: ${r.error && r.error.message}`);
  await esperar();
  const porId = (id) => todos(r.contenedor).filter((n) => n.id === id);
  assert.equal(porId('po-lista').length, 1, '🔴 NO PUDE MIRAR: no está `#po-lista`.');
  const filas = todos(porId('po-lista')[0]).filter((n) => clases(n).includes('customers-card'));
  assert.equal(filas.length, 2, `🔴 CIEGO: monté dos partes y la lista pinta ${filas.length} filas.`);
  return { filas, detalle: porId('po-detalle')[0] };
}

const textos = (n) => todos(n).map((x) => String(x.textContent || '')).filter(Boolean);

test('SCRUM-1699 · N10: la fila dice «1 línea» / «4 líneas», nunca «⚬»', async () => {
  const { filas } = await montar();
  assert.ok(textos(filas[0]).includes('1 línea'), `🔴 un parte de UNA línea no dice «1 línea»: ${JSON.stringify(textos(filas[0]))}`);
  assert.ok(textos(filas[1]).includes('4 líneas'), `🔴 un parte de cuatro no dice «4 líneas»: ${JSON.stringify(textos(filas[1]))}`);
  for (const f of filas) {
    assert.ok(!textos(f).some((t) => t.includes('⚬')), '🔴 vuelve el glifo «⚬» sin palabra.');
  }
});

test('SCRUM-1699 · N11: cada bloque rotula «Cant. · Precio ud. · Importe» y cada línea va debajo, columna a columna', async () => {
  const { filas, detalle } = await montar();
  assert.ok(detalle, '🔴 NO PUDE MIRAR: no está `#po-detalle`.');
  filas[1].click();
  await esperar();
  const nodos = todos(detalle);
  const cabs = nodos.filter((n) => clases(n).includes('po-bloque-cab'));
  assert.equal(cabs.length, 2, `🔴 hay ${cabs.length} cabeceras de bloque; el parte trae mano de obra Y materiales.`);
  const esperadas = [['Mano de obra', 'Cant.', 'Precio ud.', 'Importe'], ['Materiales', 'Cant.', 'Precio ud.', 'Importe']];
  cabs.forEach((h, i) => {
    assert.deepEqual(h.hijos.map((c) => c.textContent), esperadas[i], `🔴 la cabecera del bloque ${i + 1} no es la firmada.`);
    assert.deepEqual(h.hijos.slice(1).map((c) => c.className), COLUMNAS, '🔴 los rótulos no llevan las clases de su columna.');
  });
  const lineas = nodos.filter((n) => clases(n).includes('po-linea'));
  assert.equal(lineas.length, PARTE.lineas.length, `🔴 CIEGO: ${lineas.length} líneas pintadas de ${PARTE.lineas.length}.`);
  for (const l of lineas) {
    // La misma clase, en el MISMO orden que la cabecera: así el rótulo cae encima de su columna.
    const cols = l.hijos.map((c) => clases(c).find((k) => k.startsWith('po-col-'))).filter(Boolean);
    assert.deepEqual(cols, ['po-col-desc', ...COLUMNAS], `🔴 una línea pinta sus columnas como ${JSON.stringify(cols)}.`);
  }
});

test('SCRUM-1699 · la hoja: las columnas de números no encogen y el móvil va DETRÁS de la regla base', () => {
  const css = ejecutableDe(fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8'), { ancla: '#po-detalle', almohadillaEsComentario: false });
  for (const [c, ancho] of [['po-col-cant', 60], ['po-col-precio', 110], ['po-col-importe', 100]]) {
    const re = new RegExp(`#po-detalle \\.${c}\\s*\\{([^}]*)\\}`);
    const m = re.exec(css);
    assert.ok(m, `🔴 no hay regla \`#po-detalle .${c}\`.`);
    assert.match(m[1], new RegExp(`flex:\\s*0 0 ${ancho}px`), `🔴 \`.${c}\` no es \`flex: 0 0 ${ancho}px\`: si encoge, la cabecera se descuadra.`);
  }
  // El `gap` de la línea pisaba el del móvil cuando la regla base iba DETRÁS del @media (4 px de
  // descuadre medidos a 390). Con la misma especificidad, gana la última.
  const base = css.indexOf('#po-detalle .po-linea {');
  const movil = css.search(/@media \(max-width: 480px\) \{\s*[^@]*#po-detalle \.po-linea \{ gap/);
  assert.ok(base >= 0, '🔴 NO PUDE MIRAR: no está la regla base `#po-detalle .po-linea`.');
  assert.ok(movil >= 0, '🔴 NO PUDE MIRAR: no está el `gap` del móvil para `.po-linea`.');
  assert.ok(base < movil, '🔴 la regla base de `.po-linea` va DETRÁS del @media del móvil y le pisa el `gap`.');
});
