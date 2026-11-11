// tests/scrum1692-parte-abierta-se-marca.test.mjs — SCRUM-1692 (PILOTO-1, X3 de SCRUM-1686)
//
// Sin gate: monta «Partes por valorar» en el banco con los datos del censo. Ni BD, ni red, ni navegador.
//
// El recorrido de SCRUM-1686 midió que, al abrir un parte, su fila de la lista no se distinguía de
// las demás y el detalle de abajo parecía un duplicado. Ahora la fila abierta lleva
// `aria-current="true"` (el lector de pantalla la anuncia como «actual») y un estilo de selección
// que NO es nuevo: el mismo marcado de `.quote-cliente-opcion[aria-pressed="true"]` (borde de marca,
// un píxel más por dentro y fondo `--brand-tint`), que no depende sólo del color (WCAG 1.4.1).
//
// Tres mitades: (1) nada marcado antes de abrir, (2) se marca LA abierta y sólo ella —y la marca se
// mueve con el siguiente clic—, (3) la hoja de estilos la pinta con tokens que ya existen.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { datosDelCenso, ARGUMENTOS_DEL_CENSO } from '../scripts/_datos-del-censo.mjs';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FN = 'renderPartesOficinaView';
const esperar = async () => { for (let i = 0; i < 6; i++) await new Promise((res) => setImmediate(res)); };
const clases = (n) => String(n.className || '').split(/\s+/).filter(Boolean);
const marca = (f) => (f.getAttribute ? f.getAttribute('aria-current') : null);

async function montar() {
  const dc = datosDelCenso();
  dc.enVista(FN);
  // Con DOS partes, para poder ver que la marca se MUEVE y no se acumula.
  const datos = (url, ...resto) => {
    if (/^\/admin\/partes\/[^/]+\/oficina$/.test(String(url))) throw new Error('sin contrato en el censo');
    const r = dc.datos(url, ...resto);
    if (String(url) === '/admin/partes/oficina/pendientes' && r && Array.isArray(r.pendientes) && r.pendientes.length === 1) {
      return { ...r, pendientes: [r.pendientes[0], { ...r.pendientes[0], id: 'otro-1692', numero: 'P-1692' }] };
    }
    return r;
  };
  const r = await pintarVista(cargarDashboard(RAIZ, { datos }), FN, ...(ARGUMENTOS_DEL_CENSO[FN] || []));
  assert.equal(r.error, null, `🔴 NO PUDE MIRAR: la vista revienta al montarse: ${r.error && r.error.message}`);
  await esperar();
  const lista = todos(r.contenedor).filter((n) => n.id === 'po-lista');
  assert.equal(lista.length, 1, '🔴 NO PUDE MIRAR: no está `#po-lista`.');
  const filas = todos(lista[0]).filter((n) => clases(n).includes('customers-card'));
  assert.ok(filas.length >= 2, `🔴 CIEGO: hacen falta dos filas para ver que la marca se mueve; hay ${filas.length}.`);
  return filas;
}

test('SCRUM-1692 · antes de abrir ningún parte, ninguna fila está marcada', async () => {
  const filas = await montar();
  for (const f of filas) assert.equal(marca(f), null, '🔴 una fila sale marcada sin haberla abierto.');
});

test('SCRUM-1692 · la fila abierta lleva `aria-current="true"`, sólo ella, y la marca sigue al clic', async () => {
  const filas = await montar();
  filas[0].click();
  await esperar();
  assert.equal(marca(filas[0]), 'true', '🔴 la fila abierta no lleva `aria-current="true"`: no se distingue ni se anuncia.');
  assert.equal(marca(filas[1]), null, '🔴 una fila NO abierta también sale marcada.');
  filas[1].click();
  await esperar();
  assert.equal(marca(filas[1]), 'true', '🔴 al abrir otro parte su fila no se marca.');
  assert.equal(marca(filas[0]), null, '🔴 la marca se ACUMULA: la fila anterior sigue marcada.');
  // La clase no cambia: el banco de SCRUM-1285 localiza la fila por `className === 'customers-card'`.
  for (const f of filas) assert.equal(f.className, 'customers-card', `🔴 la fila lleva «${f.className}».`);
});

test('SCRUM-1692 · la hoja pinta la fila marcada con el MISMO marcado de selección que ya existe', () => {
  const css = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const regla = /#po-lista\s*>\s*button\.customers-card\[aria-current="true"\]\s*\{([^}]*)\}/.exec(css);
  assert.ok(regla, '🔴 no hay `#po-lista > button.customers-card[aria-current="true"]`: la fila abierta no se ve.');
  assert.match(regla[1], /border-color:\s*var\(--brand\)/, '🔴 sin el borde de marca.');
  assert.match(regla[1], /background:\s*var\(--brand-tint\)/, '🔴 sin el fondo `--brand-tint`.');
  assert.match(regla[1], /box-shadow:\s*inset 0 0 0 1px var\(--brand\)/, '🔴 sin el píxel por dentro: sólo cambia el color (WCAG 1.4.1).');
  // El mismo marcado que el de `.quote-cliente-opcion`: si un día cambia allí, este test lo dice.
  const modelo = /\.quote-cliente-opcion\[aria-pressed="true"\]\s*\{([^}]*)\}/.exec(css);
  assert.ok(modelo, '🔴 NO PUDE MIRAR: no encuentro el modelo `.quote-cliente-opcion[aria-pressed="true"]`.');
  const norma = (s) => s.split(';').map((x) => x.trim()).filter(Boolean).sort().join(';');
  assert.equal(norma(regla[1]), norma(modelo[1]), '🔴 la selección de la fila se ha apartado del marcado que ya existe.');
  const foco = /#po-lista\s*>\s*button\.customers-card\[aria-current="true"\]:focus-visible\s*\{([^}]*)\}/.exec(css);
  assert.ok(foco && /var\(--ring\)/.test(foco[1]), '🔴 con el foco en la fila marcada, el anillo `--ring` se pierde.');
});
