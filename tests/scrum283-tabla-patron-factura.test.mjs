// SCRUM-283 (B2) · LA TABLA — el guard que verifica el registro declarativo contra el censo.
//
// El censo (scrum283-censo) ENUMERA lo que existe. Este guard comprueba que cada acción censada
// TIENE SITIO en la tabla (registro), que la tabla respeta las cinco reglas, y que ninguna acción
// desaparece en la reorganización — el fallo mudo que esta tarea existe para cazar.
//
// Importa las DOS fuentes: el censo (AST de la vista) y el registro (la tabla declarada). Nadie
// escribe la lista a mano: el censo la deriva, el registro la declara, y aquí se cruzan.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { censarAccionesFactura } from './_censo-acciones-factura.mjs';
import registro from '../public/dashboard/js/invoiceActionsRegistry.js';

const { INVOICE_ACTION_REGISTRY, INVOICE_STATES, destinoEfectivo } = registro;

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = path.join(RAIZ, 'public', 'dashboard', 'js', 'invoiceDetailView.js');
const censo = censarAccionesFactura(fs.readFileSync(VISTA, 'utf8'));

const DESTINOS_VALIDOS = new Set(['primaria', 'secundaria', 'overflow', 'seccion-propia', 'oculta']);
const CTXS = [{ hayCharge: true }, { hayCharge: false }];

/** Reparte las acciones del registro por destino, en un estado y contexto dados. */
function layout(reg, estado, ctx) {
  const g = { primaria: [], secundaria: [], overflow: [], 'seccion-propia': [], oculta: [] };
  for (const a of reg) g[destinoEfectivo(a, estado, ctx)].push(a.id);
  return g;
}
const clonar = (reg) => reg.map((a) => ({ ...a, destinos: { ...a.destinos } }));

// ═════════════════════════════════════════════════════════════════════════════════════════
// NINGUNA ACCIÓN SIN SITIO — el corazón de la tarea
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-283 · ninguna acción del censo se queda sin sitio (y ningún sitio sin acción)', () => {
  const idsCenso = new Set(censo.acciones.map((a) => a.id));
  const idsReg = new Set(INVOICE_ACTION_REGISTRY.map((a) => a.id));

  for (const a of censo.acciones) {
    assert.ok(
      idsReg.has(a.id),
      `🔴 la acción ${a.id} (L${a.linea}) EXISTE en la vista y NO tiene sitio en la tabla. Una acción ` +
        'que desaparece en una reorganización es el fallo mudo de esta tarea.',
    );
  }
  for (const a of INVOICE_ACTION_REGISTRY) {
    assert.ok(
      idsCenso.has(a.id),
      `🔴 el registro declara un sitio para ${a.id}, que el censo NO encuentra en la vista (fantasma).`,
    );
  }
  // seccion-propia cuenta como destino VÁLIDO: por eso btnAnular no sale huérfana y el guard no da
  // rojo en falso el primer día (un guard que da rojo en falso es un guard que alguien silencia).
  for (const a of INVOICE_ACTION_REGISTRY) {
    for (const st of INVOICE_STATES) {
      assert.ok(DESTINOS_VALIDOS.has(a.destinos[st]), `🔴 ${a.id} sin destino válido en ${st}: «${a.destinos[st]}»`);
    }
  }
});

test('SCRUM-283 · SUELO: registro vacío o vista sin acciones → falla, no «0 sin sitio»', () => {
  assert.ok(INVOICE_ACTION_REGISTRY.length > 0, '🔴 SUELO: el registro está vacío');
  assert.ok(censo.acciones.length > 0, '🔴 SUELO: el censo no ve ninguna acción en la vista');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS CINCO REGLAS, sobre la tabla
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-283 · regla 1 (≤1 primaria) y regla 2 (≤2 secundarias) en los 4 estados × contexto', () => {
  for (const st of INVOICE_STATES) {
    for (const ctx of CTXS) {
      const g = layout(INVOICE_ACTION_REGISTRY, st, ctx);
      assert.ok(
        g.primaria.length <= 1,
        `🔴 ${st} (charge=${ctx.hayCharge}) tiene ${g.primaria.length} primarias [${g.primaria}]. Regla 1: como mucho una.`,
      );
      assert.ok(g.secundaria.length <= 2, `🔴 ${st} tiene ${g.secundaria.length} secundarias [${g.secundaria}]. Regla 2: máximo dos.`);
      assert.ok(g['seccion-propia'].length <= 1, `🔴 ${st} tiene más de una acción en sección propia`);
    }
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LOS DOS OCUPANTES de la primaria de `pending` — con chargeId y sin él
// «Si solo se prueba uno, no se ha probado el diseño.»
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-283 · pending · CON chargeId → la primaria es Confirmar Bizum (btnBizum)', () => {
  const g = layout(INVOICE_ACTION_REGISTRY, 'pending', { hayCharge: true });
  assert.deepEqual(g.primaria, ['btnBizum'], `🔴 con cobro en vuelo, la primaria de pending debe ser btnBizum; es [${g.primaria}]`);
});

test('SCRUM-283 · pending · SIN chargeId → la primaria es Marcar como pagada (btnTogglePaid)', () => {
  const g = layout(INVOICE_ACTION_REGISTRY, 'pending', { hayCharge: false });
  assert.deepEqual(g.primaria, ['btnTogglePaid'], `🔴 sin cobro en vuelo, la primaria de pending debe ser btnTogglePaid; es [${g.primaria}]`);
  // Ninguna de las dos desaparece: cada una es primaria en SU contexto. Fundirlas habría borrado una.
  const conCharge = layout(INVOICE_ACTION_REGISTRY, 'pending', { hayCharge: true }).primaria;
  assert.notDeepEqual(conCharge, g.primaria, '🔴 las dos primarias contextuales colapsaron en la misma: se fundió una');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA TABLA, estado por estado — cada test cae NOMBRANDO su estado (rojo por el mecanismo x4)
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-283 · fila `pending`: primaria contextual · 2 secundarias · Anular en sección propia', () => {
  const g = layout(INVOICE_ACTION_REGISTRY, 'pending', { hayCharge: false });
  assert.equal(g.secundaria.length, 2, `🔴 pending debe tener 2 secundarias; tiene [${g.secundaria}]`);
  assert.deepEqual(g['seccion-propia'], ['btnAnular'], `🔴 pending: Anular va en sección propia; hay [${g['seccion-propia']}]`);
  assert.ok(g.overflow.length >= 1, '🔴 pending: el ⋮ no puede quedar vacío');
});

test('SCRUM-283 · fila `paid`: sin primaria · 2 secundarias · «Marcar como PENDIENTE» en ⋮', () => {
  for (const ctx of CTXS) {
    const g = layout(INVOICE_ACTION_REGISTRY, 'paid', ctx);
    assert.deepEqual(g.primaria, [], `🔴 paid no lleva primaria; tiene [${g.primaria}]`);
    assert.equal(g.secundaria.length, 2, `🔴 paid debe tener 2 secundarias; tiene [${g.secundaria}]`);
    assert.ok(g.overflow.includes('btnTogglePaid'), '🔴 paid: «Marcar como PENDIENTE» (btnTogglePaid) va en el ⋮');
  }
});

test('SCRUM-283 · fila `annulled`: sin primaria · solo PDF de secundaria · Rectificar NO se pinta (SCRUM-308)', () => {
  for (const ctx of CTXS) {
    const g = layout(INVOICE_ACTION_REGISTRY, 'annulled', ctx);
    assert.deepEqual(g.primaria, [], `🔴 annulled no lleva primaria; tiene [${g.primaria}]`);
    assert.deepEqual(g.secundaria, ['btnPdf'], `🔴 annulled: solo PDF de secundaria; tiene [${g.secundaria}]`);
    assert.ok(
      !g.overflow.includes('btnRectify') && !g.primaria.includes('btnRectify') && !g.secundaria.includes('btnRectify'),
      '🔴 annulled: Rectificar NO se pinta (decisión de SCRUM-308). Solo se oculta en el front; /rectify y el back no se tocan.',
    );
  }
});

test('SCRUM-283 · fila `R1`: sin primaria · solo PDF de secundaria · solo Regenerar en ⋮', () => {
  for (const ctx of CTXS) {
    const g = layout(INVOICE_ACTION_REGISTRY, 'R1', ctx);
    assert.deepEqual(g.primaria, [], `🔴 R1 no lleva primaria; tiene [${g.primaria}]`);
    assert.deepEqual(g.secundaria, ['btnPdf'], `🔴 R1: solo PDF de secundaria; tiene [${g.secundaria}]`);
    assert.deepEqual(g.overflow, ['btnRegen'], `🔴 R1: solo Regenerar PDF en el ⋮; tiene [${g.overflow}]`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ROJO POR EL MECANISMO — romper la fila de CADA estado lo delata (los cuatro, no uno)
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-283 · rojo por el mecanismo: meter una 2ª primaria en cualquier estado rompe la regla 1', () => {
  for (const st of INVOICE_STATES) {
    const mut = clonar(INVOICE_ACTION_REGISTRY);
    // btnRegen vive en overflow en los 4 estados; ascenderlo a primaria crea una 2ª primaria en
    // pending, y una 1ª indebida en paid/annulled/R1. En AMBOS casos la fila deja de cumplir su forma.
    mut.find((a) => a.id === 'btnRegen').destinos[st] = 'primaria';
    const gConCarga = layout(mut, st, { hayCharge: true });
    const gSinCarga = layout(mut, st, { hayCharge: false });
    const primarias = st === 'pending' ? gSinCarga.primaria : gConCarga.primaria;
    const esperadas = st === 'pending' ? 1 : 0; // pending tiene 1; los otros 0
    assert.ok(
      primarias.length > esperadas,
      `🔴 el mecanismo NO detecta una primaria de más en «${st}»: sería ciego a que la reorganización rompa esa fila`,
    );
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// REGLA 29 — el patrón NO abre la puerta a editar/borrar una factura emitida, en ningún estado
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-283 · regla 29: ningún estado surfacea editar/borrar de una emitida', () => {
  // Las acciones de EDICIÓN/BORRADO de una factura viven en el hueco «Borrador» y llegan con
  // SCRUM-289 — aquí NO se construyen. Ninguna puede aparecer en la vista ni en la tabla de hoy.
  const PROHIBIDAS = ['btnEmitir', 'btnModificar', 'btnEditar', 'btnDuplicar', 'btnGuardarPlantilla', 'btnBorrarBorrador', 'btnBorrar', 'btnEliminar'];
  const idsCenso = censo.acciones.map((a) => a.id);
  const idsReg = INVOICE_ACTION_REGISTRY.map((a) => a.id);
  for (const p of PROHIBIDAS) {
    assert.ok(!idsCenso.includes(p), `🔴 REGLA 29: la vista de una factura emitida surfacea «${p}» (editar/borrar). Eso es SCRUM-289, no aquí.`);
    assert.ok(!idsReg.includes(p), `🔴 REGLA 29: la tabla declara sitio para «${p}» (editar/borrar de una emitida).`);
  }
  // Las únicas acciones que alteran una emitida son las PERMITIDAS (regla 29): rectificar (→R1) y
  // anular (baja con registro, en su sección). El toggle cambia ESTADO de cobro, no edita el
  // documento. Ninguna borra ni reescribe la factura.
  const mutadoras = { btnRectify: 'emite una R1', btnAnular: 'baja con registro (sección propia)' };
  for (const id of Object.keys(mutadoras)) {
    assert.ok(idsCenso.includes(id), `🔴 falta ${id}: la vía permitida de la regla 29 (${mutadoras[id]}) tiene que existir`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONTROL NEGATIVO — un cambio que NO debe hacer caer el guard
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-283 · control negativo: reordenar el ⋮ de un estado NO rompe la tabla', () => {
  // Mover una acción DENTRO del mismo destino (overflow) es cosmético: el guard de «sin sitio» y las
  // reglas 1/2 no deben inmutarse. Distingue «cambió el orden» de «desapareció/cambió de peso».
  const mut = clonar(INVOICE_ACTION_REGISTRY);
  const i = mut.findIndex((a) => a.id === 'btnRegen');
  const j = mut.findIndex((a) => a.id === 'btnDispute');
  [mut[i], mut[j]] = [mut[j], mut[i]]; // intercambia posiciones en el array (mismo destino overflow)
  for (const st of INVOICE_STATES) {
    const antes = layout(INVOICE_ACTION_REGISTRY, st, { hayCharge: false });
    const despues = layout(mut, st, { hayCharge: false });
    assert.deepEqual(new Set(despues.primaria), new Set(antes.primaria), `🔴 reordenar cambió la primaria de ${st}`);
    assert.deepEqual(new Set(despues.secundaria), new Set(antes.secundaria), `🔴 reordenar cambió las secundarias de ${st}`);
    assert.deepEqual(new Set(despues.overflow), new Set(antes.overflow), `🔴 reordenar cambió el conjunto del ⋮ de ${st}`);
  }
});
