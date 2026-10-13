// tests/scrum1148-tactil-lista-presupuestos.test.mjs
//
// SCRUM-1148 (AB6, defecto de paso) · la lista de presupuestos: «⬇ CSV» de la cabecera medía 31 px de
// toque en yaqu.app y «Ver detalle» de cada fila 30,7 (medido el 7-oct-2026 a 390, 700, 929 y 1280:
// 19 pulsables cortos de 36). El arreglo es UNA regla de `styles.css` acotada a esta lista por el ancla
// que ya lleva (`#quotes-count`). `.btn-sm` global no se toca, y el marcado de la lista TAMPOCO:
// `guard:lista-trabajos` exige que el HTML de Presupuestos salga idéntico al de la base.
//
// 🔴 QUÉ MIDE ESTO Y QUÉ NO. Node no pinta: aquí NO se miden píxeles. Se ata lo que hace que los
// píxeles salgan — que la hoja dé el mínimo de DESIGN.md a cada lado del corte de móvil, y que TODO
// `.btn-sm` que la lista pinta en esos dos sitios esté donde el selector de la hoja lo busca. Es un
// PROXY y se dice. Los píxeles se miden en navegador (registro: docs/master/SCRUM-1148.md, parte 3).
//
// Los mínimos y el corte NO se escriben aquí: salen de `scripts/_medidor-de-toque.mjs`, que es con lo
// que se mide. Si alguien cambia el corte, este test se entera.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { CORTE_MOVIL, MINIMO_ESCRITORIO, MINIMO_TACTIL } from '../scripts/_medidor-de-toque.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// SIN comentarios: los de la hoja citan reglas enteras, llaves incluidas, y casarían como si fueran código.
const CSS = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// Los dos selectores de la hoja, tal cual. El test de estructura de abajo los RECORRE a mano sobre
// lo que la lista pinta: si aquí cambia uno, hay que cambiar también lo que se exige allí.
const DE_CABECERA = '.data-card:has(#quotes-count) .data-card-header > div > .btn-sm';
const DE_FILA = '.data-card:has(#quotes-count) td.cell-actions > div > .btn-sm';

const clasesDe = (n) => String((n && n.className) || '').split(/\s+/).filter(Boolean);
const antepasado = (n, cumple) => { for (let p = n._padre; p; p = p._padre) if (cumple(p)) return p; return null; };
const esTarjeta = (p) => clasesDe(p).includes('data-card');
const llevaElAncla = (tarjeta) => todos(tarjeta).some((d) => d.id === 'quotes-count' || d._id === 'quotes-count');

const presupuesto = (id, status) => ({
  id, number: id, customerName: `Cliente ${id}`, customerPhone: null, createdAt: '2026-10-07T09:00:00Z',
  currency: 'EUR', totalAmount: 100 + id, status, method: null, chargeId: null, internalNotes: null,
  tags: null, waDelivery: null,
});
// Dos filas, y una PENDIENTE DE APROBAR: es la única que pinta el segundo botón de la fila («✓ Aprobar»).
const LISTA = [presupuesto(1, 'sent'), presupuesto(2, 'pending_approval')];

async function pequenosDeLaLista() {
  const banco = cargarDashboard(RAIZ, { datos: (ruta) => (String(ruta).startsWith('/admin/quotes') ? LISTA : {}) });
  const r = await pintarVista(banco, 'renderQuotesListView');
  assert.equal(r.error, null, `la lista no se monta: ${r.error}`);
  const pequenos = todos(r.contenedor).filter((n) => ['A', 'BUTTON'].includes(n.tagName) && clasesDe(n).includes('btn-sm'));
  const enCabecera = pequenos.filter((n) => antepasado(n, (p) => clasesDe(p).includes('data-card-header')));
  const enFila = pequenos.filter((n) => antepasado(n, (p) => p.tagName === 'TD' && clasesDe(p).includes('cell-actions')));
  return { enCabecera, enFila };
}
const rotulo = (n) => String(n._texto || n._html || '').trim();

test('SCRUM-1148 · SUELO: la lista pinta los botones pequeños que este test dice vigilar', async () => {
  const { enCabecera, enFila } = await pequenosDeLaLista();
  assert.equal(enCabecera.length, 1, `🔴 CIEGO: esperaba UN botón pequeño en la cabecera («⬇ CSV») y hay ${enCabecera.length}: ${enCabecera.map(rotulo).join(' · ')}`);
  assert.match(rotulo(enCabecera[0]), /CSV/, '🔴 CIEGO: el botón pequeño de la cabecera ya no es el del CSV');
  // 2 «Ver detalle» + 1 «✓ Aprobar» (la fila pendiente, con rol admin, que es el del banco por defecto).
  assert.equal(enFila.length, 3, `🔴 CIEGO: esperaba 3 botones pequeños en las filas y hay ${enFila.length}: ${enFila.map(rotulo).join(' · ')}`);
  assert.equal(enFila.filter((n) => /Ver detalle/.test(rotulo(n))).length, 2, '🔴 CIEGO: no salen los dos «Ver detalle»');
  assert.equal(enFila.filter((n) => /Aprobar/.test(rotulo(n))).length, 1, '🔴 CIEGO: no sale «✓ Aprobar»: la fila pendiente no se ha pintado como tal');
});

test('SCRUM-1148 · 🔴 cada botón pequeño de la lista está DONDE el selector de la hoja lo busca', async () => {
  const { enCabecera, enFila } = await pequenosDeLaLista();
  const dentroDeLaTarjetaConAncla = (n) => {
    const tarjeta = antepasado(n, esTarjeta);
    return !!tarjeta && llevaElAncla(tarjeta);
  };
  for (const n of enCabecera) {
    const padre = n._padre; const abuelo = padre && padre._padre;
    assert.ok(padre && padre.tagName === 'DIV' && abuelo && clasesDe(abuelo).includes('data-card-header'),
      `🔴 «${rotulo(n)}» ya no es \`.data-card-header > div > .btn-sm\`: la regla de styles.css no lo alcanza y se queda en los 30 px de \`.btn-sm\`. Medido en yaqu.app: 31 px de toque.`);
    assert.ok(dentroDeLaTarjetaConAncla(n), `🔴 «${rotulo(n)}» no está dentro de una \`.data-card\` que contenga \`#quotes-count\`: el \`:has()\` de la hoja no casa.`);
  }
  for (const n of enFila) {
    const padre = n._padre; const abuelo = padre && padre._padre;
    assert.ok(padre && padre.tagName === 'DIV' && abuelo && abuelo.tagName === 'TD' && clasesDe(abuelo).includes('cell-actions'),
      `🔴 «${rotulo(n)}» ya no es \`td.cell-actions > div > .btn-sm\`: la regla de styles.css no lo alcanza. Medido en yaqu.app: 30,7 px de toque de 641 px de ancho en adelante.`);
    assert.ok(dentroDeLaTarjetaConAncla(n), `🔴 «${rotulo(n)}» no está dentro de una \`.data-card\` que contenga \`#quotes-count\`: el \`:has()\` de la hoja no casa.`);
  }
});

test('SCRUM-1148 · 🔴 la hoja da a esos dos sitios el mínimo de escritorio, y el táctil hasta el corte de móvil', () => {
  const lit = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sel = `${lit(DE_CABECERA)},\\s*${lit(DE_FILA)}\\s*\\{\\s*min-height:\\s*(\\d+)px;?\\s*\\}`;
  const enMedia = new RegExp(`@media \\(max-width: (\\d+)px\\) \\{\\s*${sel}\\s*\\}`).exec(CSS);
  assert.ok(enMedia, '🔴 CIEGO o roto: no encuentro la regla de la lista DENTRO de un `@media (max-width: …)`. '
    + 'Sin ella, entre 641 y 768 px «Ver detalle» mide 30,7 px donde se exigen 44 (medido a 700).');
  assert.equal(Number(enMedia[1]), CORTE_MOVIL, `🔴 el corte de la hoja (${enMedia[1]}) no es el del medidor (${CORTE_MOVIL}): entre los dos queda una franja sin su mínimo`);
  assert.ok(Number(enMedia[2]) >= MINIMO_TACTIL, `🔴 hasta ${CORTE_MOVIL} px la hoja da ${enMedia[2]} px y el mínimo táctil es ${MINIMO_TACTIL}`);

  const antes = CSS.slice(0, enMedia.index);
  const base = [...antes.matchAll(new RegExp(sel, 'g'))].pop();
  assert.ok(base, '🔴 CIEGO o roto: no encuentro la regla de la lista FUERA del `@media` (la de escritorio), antes de la de móvil.');
  assert.ok(Number(base[1]) >= MINIMO_ESCRITORIO, `🔴 en escritorio la hoja da ${base[1]} px y el mínimo es ${MINIMO_ESCRITORIO}`);
  // La de escritorio tiene que estar SUELTA: si la encerrara otro `@media`, a 1280 no aplicaría.
  const abiertas = (antes.slice(0, base.index).match(/\{/g) || []).length;
  const cerradas = (antes.slice(0, base.index).match(/\}/g) || []).length;
  assert.equal(abiertas, cerradas, '🔴 la regla de escritorio está dentro de otro bloque: no vale para todos los anchos');
});
