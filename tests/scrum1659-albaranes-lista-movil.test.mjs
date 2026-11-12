// tests/scrum1659-albaranes-lista-movil.test.mjs — SCRUM-1659 (PILOTO-1)
//
// Sin gate: lee styles.css y albaranesView.js, y monta la lista en el banco. Ni BD, ni red, ni navegador.
//
// Medido en yaqu.app el 10-nov-2026 (cuenta QA, build d7fb55ea1), a 390 px:
//   · la cuarta pestaña, «Firmados», acababa en x=460 con la tarjeta en 378: la fila de pestañas pedía
//     447 px en 364 y NO desplazaba (`overflow-x: visible`), así que la tarjeta la recortaba y sólo
//     asomaban 24 px («Fir», sin su contador), sin forma de traerla entera;
//   · el buscador medía 34 px de alto y el filtro de facturación 36 (AB6 pide ≥44 en móvil);
//   · la vista escribía seis `style.cssText` (título, subtítulo, buscador, filtro, aviso y su detalle).
// Los píxeles se miden en navegador (registro en docs/master/SCRUM-1659.md, con capturas antes/después);
// este test vigila lo que los sostiene: las reglas EN SU @media, ACOTADAS a esta lista, y que la vista
// pinte las clases que esas reglas nombran.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Sin comentarios por el escáner compartido (SCRUM-694/962g: sobre styles.css también vale).
const CSS = soloCodigo(fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8'), 'styles.css');
const VISTA = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/albaranesView.js'), 'utf8');
const MOVIL = '(max-width: 640px)';

/** Reglas con la condición de su @media (null = nivel superior). Un nivel de anidamiento basta aquí. */
function reglas(css) {
  const out = [];
  const recorrer = (t, media) => {
    let i = 0;
    while (i < t.length) {
      const abre = t.indexOf('{', i);
      if (abre < 0) break;
      const preludio = t.slice(i, abre).trim();
      let prof = 1, j = abre + 1;
      while (j < t.length && prof > 0) { if (t[j] === '{') prof++; else if (t[j] === '}') prof--; j++; }
      const cuerpo = t.slice(abre + 1, j - 1);
      if (preludio.startsWith('@media')) recorrer(cuerpo, preludio.replace(/^@media\s*/, '').replace(/\s+/g, ' '));
      else if (!preludio.startsWith('@')) out.push({ media, sel: preludio.split(',').map((s) => s.replace(/\s+/g, ' ').trim()), cuerpo });
      i = j;
    }
  };
  recorrer(css, null);
  return out;
}
const REGLAS = reglas(CSS);
const en = (media, sel, decl) => REGLAS.some((r) => r.media === media && r.sel.includes(sel) && decl.test(r.cuerpo));

function red(datos) {
  const resp = (data) => ({
    ok: true, status: 200, statusText: '200', headers: { get: () => 'application/json' },
    json: async () => data, blob: async () => ({}), text: async () => JSON.stringify(data),
  });
  return {
    fetch: async (url) => (/\/admin\/albaranes(\?|$)/.test(String(url)) ? resp(datos) : resp({})),
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
  };
}
const LISTADO = {
  filas: [{ id: 1, numero: 'AB260006', emisionAt: '2026-11-10T10:00:00Z', fecha: '2026-11-10T10:00:00Z', cliente: 'Ana Ruiz',
    trabajo: 'Cambio de grifo', jobId: 1, estado: 'borrador', modoValoracion: 'VALORADO', quote: null, estadoFacturacion: 'sin_facturar' }],
  ejes: { estado: ['borrador', 'emitido', 'firmado'], cobro: ['sin_facturar', 'parcial', 'facturado'] },
  contadores: { total: 1, porEstado: { borrador: 1 }, porCobro: { sin_facturar: 1 } },
};
const conClase = (n, c) => typeof n.className === 'string' && n.className.split(' ').includes(c);

test('SCRUM-1659 · CONTROL: el lector de reglas ve la fila de pestañas compartida, fuera de toda @media', () => {
  assert.ok(en(null, '.data-card-tabs', /display:\s*flex/),
    '🔴 NO PUDE MIRAR: no encuentro `.data-card-tabs { display: flex }` — o el lector falla o la regla cambió, y lo de abajo no probaría nada');
  assert.ok(REGLAS.filter((r) => r.media === MOVIL).length > 20, '🔴 NO PUDE MIRAR: no veo reglas dentro de @media (max-width: 640px)');
});

test('SCRUM-1659 · a ≤640 px las pestañas de ESTA lista desplazan en vez de cortarse, y ninguna se encoge', () => {
  assert.ok(en(MOVIL, '.alb-lista .data-card-tabs', /overflow-x:\s*auto/),
    '🔴 sin `overflow-x: auto` la cuarta pestaña («Firmados») queda recortada por la tarjeta a 390 px: asoman 24 px y no hay forma de traerla entera');
  assert.ok(en(MOVIL, '.alb-lista .data-card-tabs', /overflow-y:\s*hidden/),
    '🔴 sin `overflow-y: hidden` el subrayado (margin-bottom: -1px) deja 1 px de desplazamiento vertical en la fila');
  assert.ok(en(MOVIL, '.alb-lista .data-card-tab', /flex-shrink:\s*0/),
    '🔴 sin `flex-shrink: 0` las pestañas se estrujan y parten «Borradores 2» en dos líneas en vez de desplazar');
  assert.ok(en(MOVIL, '.alb-lista .data-card-tab', /white-space:\s*nowrap/), '🔴 una pestaña se parte en dos líneas');
});

test('SCRUM-1659 · a ≤640 px el buscador y el filtro de esta lista miden 44 px (AB6)', () => {
  assert.ok(en(MOVIL, '.alb-lista .data-card-toolbar > .input', /min-height:\s*44px/),
    '🔴 el buscador (34 px) y el filtro de facturación (36 px) siguen por debajo de 44 a 390 px');
});

test('SCRUM-1659 · lo ACOTADO: la regla compartida `.data-card-tabs` no cambia (las listas hermanas no están medidas)', () => {
  const tocadas = REGLAS.filter((r) => r.sel.includes('.data-card-tabs') && /overflow/.test(r.cuerpo));
  assert.deepEqual(tocadas.map((r) => r.media), [], '🔴 alguien cambió el desplazamiento de la fila de pestañas COMPARTIDA: mueve Facturas, Presupuestos y Clientes sin medirlas');
});

test('SCRUM-1659 · la vista pinta las clases que las reglas nombran y no escribe ningún `style.cssText`', async () => {
  const banco = cargarDashboard(RAIZ, { red: red(LISTADO) });
  banco.ctx.appModoEmision = 'fiscal';
  const v = await pintarVista(banco, 'renderAlbaranesView');
  assert.ok(!v.error, `🔴 SUELO: la lista no se pinta: ${v.error && v.error.message}`);
  await new Promise((r) => setTimeout(r, 40));
  const nodos = todos(v.contenedor);
  assert.ok(nodos.some((n) => n.tagName === 'TR' && n.hijos.some((h) => conClase(h, 'cell-status'))), '🔴 SUELO: no veo la fila del albarán');
  const raiz = nodos.find((n) => conClase(n, 'data-card'));
  assert.ok(raiz && conClase(raiz, 'alb-lista'), '🔴 la tarjeta de la lista no lleva `alb-lista`: las reglas de móvil no la alcanzan');
  const deRaiz = todos(raiz);
  assert.ok(deRaiz.some((n) => conClase(n, 'data-card-tabs')), '🔴 la fila de pestañas no cuelga de `.alb-lista`');
  const toolbar = deRaiz.find((n) => conClase(n, 'data-card-toolbar'));
  assert.ok(toolbar, '🔴 no encuentro la barra del buscador');
  const inputs = toolbar.hijos.filter((h) => conClase(h, 'input')).map((h) => h.tagName);
  assert.deepEqual(inputs, ['INPUT', 'SELECT'], '🔴 el buscador y el filtro ya no son hijos directos `.input` de la barra: `> .input` no los alcanza');
  const n = (soloCodigo(VISTA, 'albaranesView.js').match(/\.style\.cssText\s*=/g) || []).length;
  assert.equal(n, 0, `🔴 albaranesView.js vuelve a escribir ${n} \`style.cssText\` (regla 4: ni un estilo en línea)`);
});
