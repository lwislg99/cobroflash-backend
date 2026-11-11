// tests/scrum1680-ficha-terminar-y-cerrar.test.mjs — SCRUM-1680 A+B (S2, PILOTO-1)
//
// A · «✅ Marcar terminado» y «Cerrar trabajo» sólo existían en el «⋯» de la LISTA de Trabajos
//     (`jobsView.js`). Quien estaba en la FICHA no podía acabar el trabajo.
//     Arreglo: las dos acciones suben a la cabecera de la ficha por el registro
//     (`jobActionsRegistry.js`), con los MISMOS literales y la MISMA petición que la lista:
//       · «✅ Marcar terminado» → secundaria, sólo en `en_curso` → PATCH {status:'terminado'}
//       · «Cerrar trabajo»      → «⋯» (acto irreversible, SCRUM-344), sólo si `puedeCerrarTrabajo`
//         → el modal con `jobCierreSection` entera → PATCH {status:'cerrado'}
// B · un Trabajo CERRADO seguía pidiendo «Hacer presupuesto» (hueco `sin-presupuesto`).
//     «Enviar para firmar» de la fila del albarán SE QUEDA: decisión de producto del orquestador
//     (11-nov-2026) — cerrar no vuelve infirmable un albarán.
//
// Se mide el DOM RENDERIZADO: `renderJobDetailView` con el dashboard entero (banco de vistas).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function trabajo(extra) {
  return {
    id: 79, status: 'en_curso', createdAt: '2026-11-10T10:00:00.000Z', titulo: 'Cambio de grifo',
    customer: { id: 5, name: 'Cliente Uno' },
    asignados: [], operario: null, albaranes: [], gastos: [], notes: '',
    quote: null, direccion: null, totalAceptado: null, totalCobrado: 0,
    ...extra,
  };
}

async function ficha(job) {
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
  // El «⋯» no mete sus opciones en el DOM hasta que se abre: se recogen al construirlo.
  const enOverflow = [];
  const overflowOriginal = banco.ctx.overflowMenu;
  banco.ctx.overflowMenu = (els, o) => { enOverflow.push(...els); return overflowOriginal(els, o); };
  // El modal se cuelga del `body` del documento, fuera del contenedor de la vista.
  const modales = [];
  const modalOriginal = banco.ctx.jobsModal;
  banco.ctx.jobsModal = (titulo, cuerpo, acciones) => {
    modales.push({ titulo, cuerpo });
    return modalOriginal(titulo, cuerpo, acciones);
  };
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `🔴 SUELO: la ficha no monta (${r.error && r.error.message})`);
  const n = todos(r.contenedor);
  const h2 = n.find((x) => String(x.tagName || '').toUpperCase() === 'H2');
  assert.ok(h2 && /Cambio de grifo/.test(String(h2.textContent)), '🔴 CIEGO: la cabecera no se ha pintado');
  const cabecera = n.find((x) => /\bdetail-head-acciones\b/.test(String(x.className || '')));
  assert.ok(cabecera, '🔴 CIEGO: no encuentro la barra de acciones de la cabecera');
  return { banco, n, cabecera: todos(cabecera), enOverflow, modales, peticiones };
}

const conTexto = (lista, texto) => lista.filter((x) => String(x.textContent || '').trim() === texto);
const esBoton = (x) => String(x.tagName || '').toUpperCase() === 'BUTTON';

test('SCRUM-1680 A · 🔴 en curso: «✅ Marcar terminado» en la cabecera de la ficha, y termina el trabajo', async () => {
  const f = await ficha(trabajo({ status: 'en_curso' }));
  const b = conTexto(f.cabecera, '✅ Marcar terminado').filter(esBoton);
  assert.equal(b.length, 1, `🔴 la ficha de un trabajo en curso no ofrece terminarlo. Cabecera: ${JSON.stringify(f.cabecera.filter(esBoton).map((x) => x.textContent))}`);
  await b[0].click();
  await new Promise((res) => setTimeout(res, 0));
  assert.deepEqual(f.peticiones, [{ url: '/admin/jobs/79', method: 'PATCH', body: { status: 'terminado' } }]);
});

test('SCRUM-1680 A · 🔴 terminado: «Cerrar trabajo» en el «⋯» de la ficha, con la explicación entera, y cierra', async () => {
  const f = await ficha(trabajo({ status: 'terminado' }));
  const b = conTexto(f.enOverflow, 'Cerrar trabajo');
  assert.equal(b.length, 1, `🔴 la ficha de un trabajo terminado no ofrece cerrarlo. «⋯»: ${JSON.stringify(f.enOverflow.map((x) => x.textContent))}`);
  await b[0].click();
  assert.equal(f.modales.length, 1, '🔴 «Cerrar trabajo» no abre el modal del cierre');
  assert.equal(f.modales[0].titulo, 'Cerrar trabajo');
  const dentro = todos(f.modales[0].cuerpo);
  // Los textos los pone `jobCierreSection` desde `CIERRE_TEXTOS`: aquí sólo se comprueba que está ENTERA.
  const ctx = f.banco.ctx;
  for (const ranura of ['titulo', 'explicacion', 'boton']) {
    const t = ctx.textoCierre(ranura, '');
    assert.ok(dentro.some((x) => String(x.textContent || '') === t), `🔴 falta «${t}» (${ranura}) en el modal del cierre`);
  }
  const confirmar = dentro.filter(esBoton).find((x) => x.textContent === ctx.textoCierre('boton', ''));
  await confirmar.click();
  await new Promise((res) => setTimeout(res, 0));
  assert.deepEqual(f.peticiones, [{ url: '/admin/jobs/79', method: 'PATCH', body: { status: 'cerrado' } }]);
});

test('SCRUM-1680 A · control: ni terminar ni cerrar donde la FSM no lo admite (agendado, cerrado)', async () => {
  for (const status of ['agendado', 'cerrado']) {
    const f = await ficha(trabajo({ status }));
    const todo = [...f.cabecera, ...f.enOverflow];
    assert.equal(conTexto(todo, '✅ Marcar terminado').length, 0, `${status}: ofrece «Marcar terminado»`);
    assert.equal(conTexto(todo, 'Cerrar trabajo').length, 0, `${status}: ofrece «Cerrar trabajo»`);
  }
  // Y en curso no se ofrece cerrar (la FSM sólo cierra desde `terminado`).
  const f = await ficha(trabajo({ status: 'en_curso' }));
  assert.equal(conTexto(f.enOverflow, 'Cerrar trabajo').length, 0, 'en_curso: ofrece «Cerrar trabajo»');
});

test('SCRUM-1680 B · 🔴 un trabajo CERRADO no pide «Hacer presupuesto»', async () => {
  // Control positivo del buscador: el mismo trabajo sin presupuesto, en curso, SÍ lo pide.
  const vivo = await ficha(trabajo({ status: 'en_curso' }));
  assert.ok(conTexto(vivo.n, 'Hacer presupuesto').length > 0, '🔴 CIEGO: el hueco «Hacer presupuesto» no sale ni en curso');
  const cerrado = await ficha(trabajo({ status: 'cerrado' }));
  assert.equal(conTexto(cerrado.n, 'Hacer presupuesto').length, 0, '🔴 el trabajo cerrado sigue pidiendo «Hacer presupuesto»');
});
