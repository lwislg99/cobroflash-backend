// tests/scrum1148-tactil-lista-presupuestos.test.mjs
//
// SCRUM-1148 (AB6, defecto de paso) · la lista de presupuestos: «⬇ CSV» de la cabecera medía 31 px de
// toque en yaqu.app y «Ver detalle» de cada fila 30,7 (medido el 7-oct-2026 a 390, 700, 929 y 1280:
// 19 pulsables cortos de 36). El arreglo es una regla POR CONTENEDOR: dos clases que pone
// `quotesListView.js` y una regla de `styles.css` que les da el alto. `.btn-sm` global no se toca.
//
// 🔴 QUÉ MIDE ESTO Y QUÉ NO. Node no pinta: aquí NO se miden píxeles. Se ata lo que hace que los
// píxeles salgan — que TODO `.btn-sm` que la lista pinta en esos dos sitios cuelgue de un contenedor
// con su clase, y que la hoja les dé el mínimo de DESIGN.md a cada lado del corte de móvil. Es un
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

const DE_CABECERA = 'quotes-list-acciones';
const DE_FILA = 'quotes-list-fila-acciones';

const clasesDe = (n) => String((n && n.className) || '').split(/\s+/).filter(Boolean);
const antepasado = (n, cumple) => { for (let p = n._padre; p; p = p._padre) if (cumple(p)) return p; return null; };

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

test('SCRUM-1148 · 🔴 cada botón pequeño de la lista es HIJO DIRECTO del contenedor que le da el alto', async () => {
  const { enCabecera, enFila } = await pequenosDeLaLista();
  for (const n of enCabecera) {
    assert.ok(clasesDe(n._padre).includes(DE_CABECERA),
      `🔴 «${rotulo(n)}» cuelga de un contenedor sin la clase \`${DE_CABECERA}\` (lleva «${n._padre.className}»): `
      + 'la regla de styles.css es `> .btn-sm`, así que se queda en los 30 px de `.btn-sm`. Medido en yaqu.app: 31 px de toque.');
  }
  for (const n of enFila) {
    assert.ok(clasesDe(n._padre).includes(DE_FILA),
      `🔴 «${rotulo(n)}» cuelga de un contenedor sin la clase \`${DE_FILA}\` (lleva «${n._padre.className}»): `
      + 'se queda en los 30 px de `.btn-sm`. Medido en yaqu.app: 30,7 px de toque de 641 px de ancho en adelante.');
  }
});

test('SCRUM-1148 · 🔴 la hoja da a esos dos contenedores el mínimo de escritorio, y el táctil hasta el corte de móvil', () => {
  const sel = `\\.${DE_CABECERA} > \\.btn-sm,\\s*\\.${DE_FILA} > \\.btn-sm\\s*\\{\\s*min-height:\\s*(\\d+)px;?\\s*\\}`;
  const enMedia = new RegExp(`@media \\(max-width: (\\d+)px\\) \\{\\s*${sel}\\s*\\}`).exec(CSS);
  assert.ok(enMedia, '🔴 CIEGO o roto: no encuentro la regla de los dos contenedores DENTRO de un `@media (max-width: …)`. '
    + 'Sin ella, entre 641 y 768 px «Ver detalle» mide 30,7 px donde se exigen 44 (medido a 700).');
  assert.equal(Number(enMedia[1]), CORTE_MOVIL, `🔴 el corte de la hoja (${enMedia[1]}) no es el del medidor (${CORTE_MOVIL}): entre los dos queda una franja sin su mínimo`);
  assert.ok(Number(enMedia[2]) >= MINIMO_TACTIL, `🔴 hasta ${CORTE_MOVIL} px la hoja da ${enMedia[2]} px y el mínimo táctil es ${MINIMO_TACTIL}`);

  const antes = CSS.slice(0, enMedia.index);
  const base = [...antes.matchAll(new RegExp(sel, 'g'))].pop();
  assert.ok(base, '🔴 CIEGO o roto: no encuentro la regla de los dos contenedores FUERA del `@media` (la de escritorio), antes de la de móvil.');
  assert.ok(Number(base[1]) >= MINIMO_ESCRITORIO, `🔴 en escritorio la hoja da ${base[1]} px y el mínimo es ${MINIMO_ESCRITORIO}`);
  // La de escritorio tiene que estar SUELTA: si la encerrara otro `@media`, a 1280 no aplicaría.
  const abiertas = (antes.slice(0, base.index).match(/\{/g) || []).length;
  const cerradas = (antes.slice(0, base.index).match(/\}/g) || []).length;
  assert.equal(abiertas, cerradas, '🔴 la regla de escritorio está dentro de otro bloque: no vale para todos los anchos');
});
