// SCRUM-153 (a) — el estado `annulled` en serializers y vistas (sin gate: solo lee ficheros y
// llama a funciones puras; ni BD ni red).
//
// EL PROBLEMA, dicho por quien lo construyó: la ruta de anulación existía y sellaba bien, pero
// **ningún serializer contemplaba `annulled`**, así que una factura anulada se pintaba como
// PENDIENTE. La cadena fiscal estaba impecable y la pantalla mentía — y la pantalla es donde el
// pro decide si persigue un cobro.
//
// LA CAUSA no era «faltaba un estado»: era **el `else` que se lo tragaba**. Los dos sitios que
// pintaban el estado (listado y detalle) eran ternarios que acababan en `: 'PENDIENTE'`, así que
// CUALQUIER estado no previsto se disfrazaba del más inocente. Por eso el arreglo no es añadir
// una rama más, es un mapeo canónico donde lo desconocido se ve.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { soloEjecutable } from './_guard-texto.mjs';
import registro from '../public/dashboard/js/invoiceActionsRegistry.js'; // SCRUM-283: la visibilidad por estado vive aquí

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const js = (f) => fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'js', f), 'utf8');

const API = js('api.js');
const LISTADO = js('invoicesView.js');
const DETALLE = js('invoiceDetailView.js');

// El front es vanilla y no se importa: se evalúa el mapeo canónico en un `window` de mentira.
function cargarInvoiceStatusMeta() {
  const win = {};
  const cuerpo = API.slice(API.indexOf('function invoiceStatusMeta'), API.indexOf('window.invoiceStatusMeta'));
  // eslint-disable-next-line no-new-func
  return new Function(`${cuerpo}; return invoiceStatusMeta;`)();
}
const invoiceStatusMeta = cargarInvoiceStatusMeta();

// ── 1. El estado que faltaba ─────────────────────────────────────────────────────────────

test('SCRUM-153 · una factura ANULADA no se pinta como pendiente', () => {
  const meta = invoiceStatusMeta('annulled');
  assert.equal(
    meta.label,
    'ANULADA',
    '🔴 EL BUG. Una factura anulada mostrándose como PENDIENTE hace que el pro persiga un cobro ' +
      'de un documento que él mismo dio de baja ante la AEAT.',
  );
  assert.notEqual(meta.pillClass, 'status-pill-pending', 'y su color no puede ser el de pendiente');
});

test('SCRUM-153 · los estados que ya funcionaban siguen igual', () => {
  assert.deepEqual(invoiceStatusMeta('paid'), { label: 'PAGADA', pillClass: 'status-pill-accepted' });
  assert.deepEqual(invoiceStatusMeta('pending'), { label: 'PENDIENTE', pillClass: 'status-pill-pending' });
  assert.deepEqual(invoiceStatusMeta('expired'), { label: 'VENCIDA', pillClass: 'status-pill-rejected' });
});

test('SCRUM-153 · ANULADA y VENCIDA comparten color pero NO etiqueta', () => {
  // Las dos dicen «de aquí no viene dinero», así que comparten pill. Lo que las distingue es el
  // texto — DESIGN.md exige que el color no sea el único canal de información.
  assert.equal(invoiceStatusMeta('annulled').pillClass, invoiceStatusMeta('expired').pillClass);
  assert.notEqual(invoiceStatusMeta('annulled').label, invoiceStatusMeta('expired').label);
});

// ── 2. Lo desconocido se VE, no se disfraza ──────────────────────────────────────────────

test('SCRUM-153 · un estado sin mapear no se disfraza del más inocente', () => {
  const meta = invoiceStatusMeta('rectificada_futura');
  assert.equal(
    meta.label,
    'RECTIFICADA_FUTURA',
    '🔴 Un estado nuevo cayendo a «PENDIENTE» es EXACTAMENTE el bug de este ticket. Si mañana ' +
      'la Parte L gana un estado y nadie lo mapea, tiene que verse raro en pantalla — no ' +
      'colarse como pendiente de cobro.',
  );
  assert.equal(meta.pillClass, 'status-pill-draft', 'neutro: no afirma nada sobre el dinero');
});

// ── 3. Las dos vistas usan el mapeo, y ya no tienen el suyo ──────────────────────────────

test('SCRUM-153 · listado y detalle usan el mapeo canónico', () => {
  for (const [nombre, fuente] of [['invoicesView.js', LISTADO], ['invoiceDetailView.js', DETALLE]]) {
    const codigo = soloEjecutable(fuente);
    assert.ok(
      codigo.includes('invoiceStatusMeta('),
      `🔴 ${nombre} ya no usa el mapeo canónico`,
    );
    assert.ok(
      !/'PENDIENTE'\s*;|:\s*'PENDIENTE'/.test(codigo),
      `🔴 ${nombre} ha recuperado su ternario propio con «PENDIENTE» de última rama. Eran DOS ` +
        `copias que había que acordarse de tocar a la vez, y las dos se tragaban lo desconocido.`,
    );
  }
});

// ── 4. Una anulada no vuelve: ni en el backend ni en la pantalla ─────────────────────────

test('SCRUM-153 · el detalle no ofrece «Marcar como PAGADA» sobre una anulada', () => {
  // Tras SCRUM-283 la visibilidad por estado vive en el REGISTRO declarativo, no en un `if` de la
  // vista. La garantía es la misma —Parte L no declara transición que salga de `annulled`— y ahora
  // la fija el registro: btnTogglePaid (Marcar como PAGADA/PENDIENTE) queda OCULTA en annulled, así
  // que el patrón no lo pinta en ningún destino (primaria/secundaria/⋮).
  const toggle = registro.INVOICE_ACTION_REGISTRY.find((a) => a.id === 'btnTogglePaid');
  assert.ok(toggle, '🔴 btnTogglePaid ya no está en el registro de acciones de la factura');
  assert.equal(
    toggle.destinos.annulled, 'oculta',
    '🔴 el registro deja «Marcar como PAGADA/PENDIENTE» visible sobre una anulada. El backend lo ' +
      'rechaza con 409, pero un botón que siempre falla es peor que no tenerlo: enseña que la ' +
      'pantalla miente. La Parte L no declara NINGUNA transición que salga de `annulled`.',
  );
});

test('SCRUM-153 · el guard del backend está donde manda, no solo en la UI', () => {
  const servicio = soloEjecutable(
    fs.readFileSync(path.join(RAIZ, 'src', 'modules', 'system', 'invoiceAdmin.ts'), 'utf8'),
  );
  assert.ok(
    /existing\.status === 'annulled' && status !== 'annulled'/.test(servicio),
    '🔴 falta la guarda de estado ORIGEN en `updateInvoiceStatusAdmin`. Sin ella, un PATCH con ' +
      "status:'paid' sobre una anulada la resucita como pagada: un documento dado de baja ante " +
      'la AEAT, con su registro de anulación sellado y encadenado, reapareciendo como cobrado.',
  );
});
