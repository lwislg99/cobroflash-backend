// tests/scrum1681b-cierre-avisa-albaran-sin-firmar.test.mjs — SCRUM-1681 ② (PILOTO-1)
//
// Sin gate: monta la ficha del trabajo en el banco. Ni BD, ni red, ni navegador.
//
// «Cerrar trabajo» con un albarán EMITIDO y sin firmar cerraba sin decir nada. Ahora el modal del
// cierre lo avisa con el texto firmado n.º 4 (SCRUM-1656 c.21405) y, con 2 o más, con su plural
// (firmado en SCRUM-1656 c.21408 ②c). Avisa, no bloquea: cerrar sigue siendo un clic.
//
// Los literales van aquí CARÁCTER A CARÁCTER (regla 39): cambiarlos sin firma nueva sale rojo.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import regla from '../public/dashboard/js/jobsCierreTrabajo.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const FIRMADO_UNO = 'Este trabajo tiene 1 albarán sin firmar. Si lo cierras, se queda así.';
const FIRMADO_DOS = 'Este trabajo tiene 2 albaranes sin firmar. Si lo cierras, se quedan así.';

function trabajo(albaranes) {
  return {
    id: 79, status: 'terminado', createdAt: '2026-11-10T10:00:00.000Z', titulo: 'Cambio de grifo',
    customer: { id: 5, name: 'Cliente Uno' },
    asignados: [], operario: null, albaranes, gastos: [], notes: '',
    quote: null, direccion: null, totalAceptado: null, totalCobrado: 0,
  };
}

async function abrirCierre(job) {
  const banco = cargarDashboard(RAIZ);
  const peticiones = [];
  banco.ctx.apiRequest = async (u, opts) => {
    const url = String(u);
    if (opts && opts.method && opts.method !== 'GET') {
      peticiones.push({ url, method: opts.method, body: opts.body ? JSON.parse(opts.body) : null });
      return { ok: true };
    }
    if (/\/admin\/team/.test(url)) return [];
    if (/\/admin\/merchant/.test(url)) return { name: 'Negocio QA' };
    if (/\/admin\/partes/.test(url)) return { partes: [] };
    if (/gastos/.test(url)) return [];
    return job;
  };
  banco.ctx.appUserRole = 'admin';
  const enOverflow = [];
  const overflowOriginal = banco.ctx.overflowMenu;
  banco.ctx.overflowMenu = (els, o) => { enOverflow.push(...els); return overflowOriginal(els, o); };
  const modales = [];
  const modalOriginal = banco.ctx.jobsModal;
  banco.ctx.jobsModal = (titulo, cuerpo, acciones) => { modales.push({ titulo, cuerpo }); return modalOriginal(titulo, cuerpo, acciones); };
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `🔴 SUELO: la ficha no monta (${r.error && r.error.message})`);
  const b = enOverflow.filter((x) => String(x.textContent || '').trim() === 'Cerrar trabajo');
  assert.equal(b.length, 1, '🔴 CIEGO: la ficha de un trabajo terminado no ofrece «Cerrar trabajo».');
  await b[0].click();
  assert.equal(modales.length, 1, '🔴 CIEGO: «Cerrar trabajo» no abre el modal.');
  const dentro = todos(modales[0].cuerpo);
  return { banco, dentro, peticiones };
}

const textos = (dentro) => dentro.map((x) => String(x.textContent || '').trim());
const alb = (estado, i) => ({ id: 100 + i, numero: 'AB' + i, estado });

test('SCRUM-1681 ② · los dos literales son los FIRMADOS, carácter a carácter', () => {
  assert.equal(regla.textoAvisoSinFirmar(1), FIRMADO_UNO);
  assert.equal(regla.textoAvisoSinFirmar(2), FIRMADO_DOS);
});

test('SCRUM-1681 ② · 🔴 con UN albarán emitido sin firmar, el modal del cierre lo avisa (singular)', async () => {
  const f = await abrirCierre(trabajo([alb('emitido', 1), alb('firmado', 2), alb('borrador', 3)]));
  assert.ok(textos(f.dentro).includes(FIRMADO_UNO), `🔴 el modal no avisa. Textos: ${JSON.stringify(textos(f.dentro).filter(Boolean).slice(0, 8))}`);
});

// SCRUM-1681c · MEDIDO en yaqu.app el 11-nov-2026 (build 073c67ade, trabajo #76 con 3 emitidos): el aviso
// estaba en el DOM con su texto firmado y NO SE VEÍA — `p.alert` a secas, y styles.css oculta todo `.alert`
// sin modificador de color (`display: none`). Los tests de arriba miraban el texto, no que se pudiera leer.
// El conjunto de modificadores que lo hacen visible se DERIVA de la hoja, no se escribe aquí.
test('SCRUM-1681 ② · 🔴 el aviso lleva un modificador de color que la hoja NO oculta (se VE, no sólo está)', async () => {
  const hoja = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');
  const m = hoja.match(/\.alert((?::not\(\.[a-z-]+\))+)\s*\{\s*display:\s*none/);
  assert.ok(m, '🔴 NO PUDE MIRAR: no encuentro la regla `.alert:not(…){display:none}` en styles.css; sin ella este test no prueba nada');
  const visibles = [...m[1].matchAll(/:not\(\.([a-z-]+)\)/g)].map((x) => x[1]);
  assert.ok(visibles.length >= 3, `🔴 NO PUDE MIRAR: leo ${visibles.length} modificadores en la regla`);
  const f = await abrirCierre(trabajo([alb('emitido', 1)]));
  const aviso = f.dentro.find((x) => String(x.textContent || '').trim() === FIRMADO_UNO);
  assert.ok(aviso, '🔴 SUELO: no encuentro el nodo del aviso');
  const clases = String(aviso.className || '').split(/\s+/);
  assert.ok(clases.includes('alert') && clases.some((c) => visibles.includes(c)),
    `🔴 el aviso lleva «${aviso.className}»: styles.css lo pinta con display:none. Le falta uno de: ${visibles.join(', ')}`);
});

test('SCRUM-1681 ② · 🔴 con DOS emitidos sin firmar, el plural firmado', async () => {
  const f = await abrirCierre(trabajo([alb('emitido', 1), alb('emitido', 2)]));
  assert.ok(textos(f.dentro).includes(FIRMADO_DOS), '🔴 con dos albaranes el modal no da el plural firmado.');
});

test('SCRUM-1681 ② · sin emitidos sin firmar (firmados o borradores), NO hay aviso — y cerrar sigue siendo un clic', async () => {
  const f = await abrirCierre(trabajo([alb('firmado', 1), alb('borrador', 2)]));
  assert.ok(!textos(f.dentro).some((t) => /sin firmar/.test(t)), '🔴 avisa sin motivo.');
  const confirmar = f.dentro.find((x) => String(x.tagName || '').toUpperCase() === 'BUTTON'
    && x.textContent === f.banco.ctx.textoCierre('boton', ''));
  await confirmar.click();
  await new Promise((res) => setTimeout(res, 0));
  assert.deepEqual(f.peticiones, [{ url: '/admin/jobs/79', method: 'PATCH', body: { status: 'cerrado' } }]);
});

test('SCRUM-1681 ② · con aviso, cerrar NO se bloquea: el mismo PATCH', async () => {
  const f = await abrirCierre(trabajo([alb('emitido', 1)]));
  const confirmar = f.dentro.find((x) => String(x.tagName || '').toUpperCase() === 'BUTTON'
    && x.textContent === f.banco.ctx.textoCierre('boton', ''));
  assert.ok(confirmar, '🔴 CIEGO: no encuentro el botón de cerrar dentro del modal.');
  await confirmar.click();
  await new Promise((res) => setTimeout(res, 0));
  assert.deepEqual(f.peticiones, [{ url: '/admin/jobs/79', method: 'PATCH', body: { status: 'cerrado' } }]);
});
