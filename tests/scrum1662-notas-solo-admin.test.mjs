// tests/scrum1662-notas-solo-admin.test.mjs — SCRUM-1662 · mitad de FRONT (S2)
//
// Sin gate: monta la ficha del Trabajo en el banco de vistas con la red doblada. Ni BD, ni red real.
//
// La mitad de servidor (S1, misma PR) deja de dar `notes` al operario y su `PATCH {notes}` le devuelve
// 403. La norma tras SCRUM-89: el front va en el MISMO PR. Si la línea «Notas internas» y su editor se
// siguieran pintando, el operario vería una nota vacía y al guardar recibiría un 403.
// Lista BLANCA: sólo el admin la ve; un rol desconocido cae al lado seguro (SCRUM-147). Cero textos
// nuevos (firma de 1662, c.21555): no se pinta nada en su lugar.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOTA = 'Nota interna 1662 (prueba)';

const linea = (n) => (n.dataset && n.dataset.linea) || (n.getAttribute && n.getAttribute('data-linea')) || null;

async function ficha(rol) {
  const job = {
    id: 42, status: 'en_curso', createdAt: '2026-09-01T09:00:00Z', titulo: 'Reparación caldera',
    customer: { id: 5, name: 'Cliente Uno 1662' },
    asignados: [], operario: null, albaranes: [], gastos: [], notes: NOTA,
    quote: null, direccion: null, totalAceptado: 0, totalCobrado: 0,
  };
  const banco = cargarDashboard(RAIZ);
  banco.ctx.apiRequest = async (u) => {
    const url = String(u);
    if (/\/admin\/team/.test(url)) return [];
    if (/\/admin\/merchant/.test(url)) return { name: 'Taller' };
    if (/\/admin\/partes/.test(url)) return { partes: [] };
    if (/gastos/.test(url)) return [];
    return job;
  };
  banco.ctx.appUserRole = rol;
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `🔴 SUELO: la ficha no monta con rol ${rol} (${r.error && r.error.message})`);
  const n = todos(r.contenedor);
  // Control de ceguera: el bloque «El trabajo» y su línea de gastos tienen que estar, o «no hay
  // línea de notas» no dice nada.
  const lineas = n.map(linea).filter(Boolean);
  assert.ok(lineas.includes('gastos'), `🔴 CIEGO: con rol ${rol} no se pintó el bloque «El trabajo» (líneas: ${JSON.stringify(lineas)})`);
  return {
    lineas,
    textareas: n.filter((x) => String(x.tagName || '').toLowerCase() === 'textarea').length,
    textoNota: n.some((x) => x.value === NOTA || String(x.textContent || '').includes(NOTA)),
  };
}

test('SCRUM-1662 · CONTROL: el admin conserva la línea «Notas internas» con su editor y su nota', async () => {
  const a = await ficha('admin');
  assert.ok(a.lineas.includes('notas'), `🔴 el admin perdió la línea de notas: ${JSON.stringify(a.lineas)}`);
  assert.ok(a.textareas >= 1 && a.textoNota, '🔴 NO PUDE MIRAR: el editor de notas del admin no lleva la nota sembrada');
});

test('SCRUM-1662 · 🔴 el operario NO ve la línea de notas ni su editor', async () => {
  const t = await ficha('tecnico');
  assert.ok(!t.lineas.includes('notas'), `🔴 al operario se le pinta «Notas internas»: ${JSON.stringify(t.lineas)}`);
  assert.equal(t.textareas, 0, '🔴 al operario se le pinta el editor de notas (su PATCH le da 403)');
  assert.ok(!t.textoNota, '🔴 la nota interna se le pinta al operario');
});

test('SCRUM-1662 · 🔴 un rol desconocido cae al lado seguro: tampoco la ve (SCRUM-147)', async () => {
  const d = await ficha('oficina');
  assert.ok(!d.lineas.includes('notas') && d.textareas === 0, `🔴 un rol desconocido ve las notas: ${JSON.stringify(d.lineas)}`);
});
