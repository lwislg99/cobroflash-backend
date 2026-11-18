// tests/scrum1749-ficha-una-rellena.test.mjs — SCRUM-1749 · mitad FICHA (S2)
//
// Sin gate: monta la ficha del Trabajo en el banco de vistas con la red doblada. Ni BD, ni red real.
//
// La regla (SCRUM-1739 c.22030, aplicada a la ficha en SCRUM-1749 c.22041): «como mucho UNA rellena
// por pantalla, y es el paso que hace avanzar el trabajo HOY».
//   · sin agendar            → «Agendar» con contorno: NINGUNA rellena.
//   · agendado PARA HOY      → «▶ Empezar» rellena.
//   · agendado otro día      → «▶ Empezar» con contorno.
//   · en curso               → «+ Nuevo parte» rellena (donde está, opción a); el albarán, contorno.
//   · terminado con resto    → «💰 Cobrar el resto (…)» rellena.
//   · terminado sin resto    → el albarán («Enviar para firmar») con contorno: NINGUNA (techo, no suelo).
// La escalera no cambia: los rótulos son los mismos que antes; aquí sólo se mira cuánto pesan.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const clases = (n) => String((n && n.className) || '').split(/\s+/).filter(Boolean);
const texto = (n) => String((n && n.textContent) || '').replace(/\s+/g, ' ').trim();
const DIA = 86400000;

async function ficha(extra, { sinGrupo = false, factura = true } = {}) {
  const job = Object.assign({
    id: 42, status: 'en_curso', createdAt: '2026-09-01T09:00:00Z', titulo: 'Reparación caldera',
    customer: { id: 5, name: 'Cliente Uno 1749', phone: null },
    asignados: [], operario: null, albaranes: [], gastos: [], notes: null, scheduledAt: null,
    quote: { currency: 'EUR', total: 500 }, direccion: null, invoices: [], remaining: null,
    tipoOperacion: 'OPERACIONES_SUELTAS',
  }, extra || {});
  const banco = cargarDashboard(RAIZ);
  banco.ctx.apiRequest = async (u) => {
    const url = String(u);
    if (/\/admin\/team/.test(url)) return [];
    if (/\/admin\/merchant/.test(url)) return { name: 'Taller' };
    if (/\/admin\/partes/.test(url)) return { partes: [] };
    if (/gastos/.test(url)) return [];
    return job;
  };
  banco.ctx.appUserRole = 'admin';
  banco.ctx.facturaFiscalDisponible = () => factura;
  if (banco.ctx.window) banco.ctx.window.facturaFiscalDisponible = () => factura;
  if (sinGrupo) banco.ctx.grupoDeTrabajo = undefined;
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `🔴 SUELO: la ficha no monta en ${job.status} (${r.error && r.error.message})`);
  const botones = todos(r.contenedor).filter((n) => n.tagName && String(n.tagName).toUpperCase() === 'BUTTON');
  assert.ok(botones.length > 3, `🔴 CIEGO: la ficha en ${job.status} pintó ${botones.length} botones`);
  // Lo que no se VE no compite: la barra de «Consolidar seleccionados» nace con `display:none` y sólo
  // se abre en modo selección (SCRUM-412 la declara por eso). Se mira el botón y TODOS sus padres.
  const oculto = (n) => {
    for (let x = n; x; x = x.parentNode) {
      const s = x.style || {};
      if (x.hidden || s.display === 'none' || /display\s*:\s*none/.test(String(s.cssText || ''))) return true;
    }
    return false;
  };
  const rellenas = botones.filter((b) => clases(b).includes('btn-primary') && !oculto(b)).map(texto);
  // CONTROL del filtro: tiene que haber quitado ALGO (la barra de consolidar existe siempre). Si no
  // quitara nada, «oculto» estaría ciego y el recuento de abajo no significaría lo que dice.
  assert.ok(botones.some((b) => texto(b) === 'Consolidar seleccionados' && oculto(b)),
    '🔴 CONTROL: «Consolidar seleccionados» no sale como oculto: el filtro de visibilidad no ve el `display:none`');
  const de = (rotulo) => botones.find((b) => texto(b).startsWith(rotulo));
  return { rellenas, de };
}

const esRellena = (b) => clases(b).includes('btn-primary');

test('SCRUM-1749 · sin agendar: «Agendar» sale con CONTORNO y no hay ninguna rellena', async () => {
  const f = await ficha({ status: 'pendiente_agendar' });
  const b = f.de('Agendar');
  assert.ok(b, '🔴 SUELO: la ficha sin agendar ya no ofrece «Agendar»');
  assert.ok(!esRellena(b), `🔴 «Agendar» sigue rellena: «${b.className}»`);
  assert.deepEqual(f.rellenas, [], `🔴 rellenas en sin agendar: ${JSON.stringify(f.rellenas)}`);
});

test('SCRUM-1749 · 🔴 agendado PARA HOY: «▶ Empezar» es la ÚNICA rellena, y sin `btn-sm`', async () => {
  const f = await ficha({ status: 'agendado', scheduledAt: new Date().toISOString() });
  const b = f.de('▶ Empezar');
  assert.ok(b, '🔴 SUELO: el agendado de hoy no ofrece «▶ Empezar»');
  assert.ok(esRellena(b) && !clases(b).includes('btn-sm'), `🔴 «▶ Empezar» de hoy no es la primaria: «${b.className}»`);
  assert.deepEqual(f.rellenas, ['▶ Empezar']);
});

test('SCRUM-1749 · agendado para OTRO día: «▶ Empezar» con contorno', async () => {
  const f = await ficha({ status: 'agendado', scheduledAt: new Date(Date.now() + 3 * DIA).toISOString() });
  const b = f.de('▶ Empezar');
  assert.ok(b, '🔴 SUELO: el agendado de otro día no ofrece «▶ Empezar»');
  assert.ok(!esRellena(b), `🔴 «▶ Empezar» de otro día sale rellena: «${b.className}»`);
  assert.deepEqual(f.rellenas, []);
});

test('SCRUM-1749 · 🔴 CONTROL: sin `grupoDeTrabajo` no se sabe qué es hoy, y NO se rellena (falla cerrado)', async () => {
  const f = await ficha({ status: 'agendado', scheduledAt: new Date().toISOString() }, { sinGrupo: true });
  const b = f.de('▶ Empezar');
  assert.ok(b, '🔴 SUELO: sin la función, el botón tampoco debería desaparecer');
  assert.ok(!esRellena(b), '🔴 sin la regla de «hoy» se rellenó igual: una segunda definición de hoy');
});

test('SCRUM-1749 · 🔴 en curso: la rellena es «+ Nuevo parte» y el albarán de la escalera va con contorno', async () => {
  const f = await ficha({ status: 'en_curso' });
  const parte = f.de('+ Nuevo parte');
  const alb = f.de('+ Nuevo albarán');
  assert.ok(parte && alb, '🔴 SUELO: en curso faltan «+ Nuevo parte» o «+ Nuevo albarán»');
  assert.ok(esRellena(parte) && !clases(parte).includes('btn-sm'), `🔴 «+ Nuevo parte» no es la primaria: «${parte.className}»`);
  assert.ok(!esRellena(alb), `🔴 «+ Nuevo albarán» sigue rellena: «${alb.className}»`);
  assert.deepEqual(f.rellenas, ['+ Nuevo parte']);
});

test('SCRUM-1749 · terminado CON resto: «💰 Cobrar el resto» es la única rellena', async () => {
  const f = await ficha({ status: 'terminado', remaining: { amount: 120, currency: 'EUR' } });
  assert.equal(f.rellenas.length, 1, `🔴 rellenas: ${JSON.stringify(f.rellenas)}`);
  assert.ok(f.rellenas[0].startsWith('💰 Cobrar el resto'), `🔴 la rellena no es el cobro: ${f.rellenas[0]}`);
});

test('SCRUM-1749 · terminado SIN resto: el albarán con contorno y NINGUNA rellena (techo, no suelo)', async () => {
  const f = await ficha({ status: 'terminado', albaranes: [{ id: 7, estado: 'emitido', numero: 'AB260001' }] });
  const b = f.de('Enviar para firmar');
  assert.ok(b, '🔴 SUELO: el terminado con albarán emitido no ofrece «Enviar para firmar»');
  assert.ok(!esRellena(b), `🔴 «Enviar para firmar» sigue rellena: «${b.className}»`);
  assert.deepEqual(f.rellenas, []);
});
