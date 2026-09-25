// tests/scrum1038-leer-el-ticket-gasto.test.mjs — SCRUM-1038
//
// EL BOTÓN «LEER EL TICKET» EN EL ALTA DE GASTO.
//
// `POST /admin/expenses/leer-ticket` (SCRUM-912) ya existía y ninguna pantalla lo llamaba (S1,
// comentario SCRUM-1038 del 22-sep: «no hace falta ningún ajuste de servidor»). Este fichero mide
// la mitad de S2: el botón, el relleno del formulario y los tres avisos.
//
// ── LO QUE SE MIDE, Y POR QUÉ CON EL DASHBOARD ENTERO ───────────────────────────────────────
// Se usa `cargarDashboard` (el banco de SCRUM-417/432/704) y no un doble a mano: `apiRequest` es
// el de verdad —`api.js` PISA cualquier doble— así que lo que se ejercita es el código de
// `err.code` que de verdad distingue `lecturas_agotadas` de cualquier otro fallo, no una promesa
// que el test decide de antemano.
//
// ⚠️ EL MINI-DOM NO TIENE `File`/`FileReader` REALES (`FileReader: class {}` en el banco): se
// sustituye `ctx.FileReader` DESPUÉS de cargar el dashboard, ANTES de disparar el clic — la
// resolución de `FileReader` dentro de `fotoParaGuardar` es en tiempo de EJECUCIÓN, así que ve el
// reemplazo. `banco/_banco-vistas.mjs` gana un `selectedOptions` de `<select>` que no tenía (el
// mismo hueco que `prepend` o `classList`): sin él, elegir proveedor por NIF revienta el banco, no
// el producto.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Textos firmados: SCRUM-1038 comentario 16942 (docs/microcopy/2026-09-25-SCRUM-1038-leer-el-ticket.md).
const TEXTO_LEER = 'Leer el ticket';
const TEXTO_LEYENDO = 'Leyendo…';
const AVISO_TOPE = 'Has llegado al máximo de 5 lecturas de ticket hoy. Escribe los datos a mano.';
const AVISO_FALLO = 'No hemos podido leer este ticket. Escribe los datos a mano.';

const EV = { preventDefault() {}, stopPropagation() {} };
const FOTO_FALSA = { name: 'ticket.jpg', _dataUrl: 'data:image/jpeg;base64,QUJD' };

/** Sustituye al `FileReader` del navegador: resuelve en un microtask, como el real. */
class FileReaderFalso {
  readAsDataURL(file) {
    this.result = (file && file._dataUrl) || 'data:image/jpeg;base64,QUJD';
    Promise.resolve().then(() => { if (typeof this.onload === 'function') this.onload(); });
  }
}

function jsonOk(body) {
  return {
    ok: true, status: 200, headers: { get: () => 'application/json' },
    json: async () => body, blob: async () => ({}), text: async () => JSON.stringify(body),
  };
}
function jsonFail(status, body) {
  return {
    ok: false, status, headers: { get: () => 'application/json' },
    json: async () => body, blob: async () => ({}), text: async () => JSON.stringify(body),
  };
}

/** Un `fetch` que sirve proveedores/trabajos vacíos por defecto y las respuestas de lectura EN ORDEN. */
function fetchDeGastos({ providers = [], jobs = [], lecturas = [] } = {}) {
  let n = 0;
  const enviadas = [];
  const fetch = async (url, opts = {}) => {
    const u = String(url);
    enviadas.push({ url: u, metodo: (opts && opts.method) || 'GET', body: opts && opts.body });
    if (/\/admin\/providers/.test(u)) return jsonOk(providers);
    if (/\/admin\/jobs/.test(u)) return jsonOk(jobs);
    if (/\/admin\/expenses\/leer-ticket/.test(u)) {
      const r = lecturas[Math.min(n, lecturas.length - 1)];
      n++;
      return r;
    }
    return jsonOk({});
  };
  return { fetch, enviadas, llamadasLeerTicket: () => enviadas.filter((e) => /leer-ticket/.test(e.url)).length };
}

async function ticks(n = 10) { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); }

/** Abre el modal de alta, deja pasar la carga de proveedores/trabajos y elige la foto falsa. */
async function prepararConFoto(banco) {
  banco.ctx.openExpenseModal(null);
  await ticks();
  const fileInput = banco.ctx.document.getElementById('exp-receipt');
  const btn = banco.ctx.document.getElementById('exp-leer-ticket');
  fileInput.files = [FOTO_FALSA];
  fileInput.disparar('change');
  return { fileInput, btn };
}

/** Dispara el/los oyentes de `click` y espera a que TODOS terminen. */
async function pulsar(btn) {
  const fns = (btn._oyentes && btn._oyentes.click) || [];
  assert.ok(fns.length > 0, '🔴 el botón no tiene ningún oyente de clic registrado');
  await Promise.all(fns.map((fn) => fn.call(btn, EV)));
}

function propuestaCompleta() {
  return {
    concept: 'Tubería PVC 20mm', amount: 12.1, baseAmount: 10, vatRate: 21, vatAmount: 2.1,
    date: '2026-09-20', providerInvoiceDate: '2026-09-20', providerInvoiceNumber: 'A-2026/114',
    proveedorNombre: 'Leroy Merlin', nifProveedor: 'A58818501', providerId: 42,
  };
}

function bancoBase(opts) {
  const fix = fetchDeGastos(opts);
  const banco = cargarDashboard(RAIZ, { red: { fetch: fix.fetch } });
  banco.ctx.FileReader = FileReaderFalso;
  return { banco, fix };
}

// ═══ SUELO ═══════════════════════════════════════════════════════════════════════════════

test('SCRUM-1038 · SUELO: el dashboard carga, y expensesView.js está entre los scripts', () => {
  const { banco } = bancoBase();
  assert.deepEqual(banco.fallos, [],
    `🔴 el banco no ha podido cargar los scripts: ${JSON.stringify(banco.fallos)}`);
  assert.ok(banco.scripts.some((s) => /expensesView\.js$/.test(s)),
    '🔴 expensesView.js no está entre los scripts del dashboard: esto mediría otra pantalla');
  assert.equal(typeof banco.ctx.openExpenseModal, 'function',
    '🔴 openExpenseModal no está publicada en window: el banco no puede abrir el modal');
});

// ═══ ① EL BOTÓN: escondido, aparece con foto, texto firmado ════════════════════════════════

test('SCRUM-1038 · ① el botón empieza escondido y aparece al elegir una foto, con el texto firmado', async () => {
  const { banco } = bancoBase();
  banco.ctx.openExpenseModal(null);
  await ticks();
  const btn = banco.ctx.document.getElementById('exp-leer-ticket');
  assert.ok(btn, '🔴 el modal no pinta #exp-leer-ticket');
  assert.equal(btn.style.display, 'none', '🔴 el botón se ve ANTES de elegir foto');
  assert.equal(btn.textContent, TEXTO_LEER,
    `🔴 el texto del botón no es el firmado (SCRUM-1038 comentario 16942): «${btn.textContent}»`);

  const fileInput = banco.ctx.document.getElementById('exp-receipt');
  fileInput.files = [FOTO_FALSA];
  fileInput.disparar('change');
  assert.equal(btn.style.display, 'inline-block', '🔴 el botón sigue escondido con una foto ya elegida');
});

test('SCRUM-1038 · ① sin foto elegida, el botón vuelve a esconderse', async () => {
  const { banco } = bancoBase();
  banco.ctx.openExpenseModal(null);
  await ticks();
  const fileInput = banco.ctx.document.getElementById('exp-receipt');
  const btn = banco.ctx.document.getElementById('exp-leer-ticket');
  fileInput.files = [FOTO_FALSA];
  fileInput.disparar('change');
  assert.equal(btn.style.display, 'inline-block', 'suelo: con foto, visible');
  fileInput.files = [];
  fileInput.disparar('change');
  assert.equal(btn.style.display, 'none', '🔴 al quitar la foto el botón se queda visible');
});

// ═══ ② LECTURA COMPLETA: rellena todo, incluido el proveedor por NIF ════════════════════════

test('SCRUM-1038 · 🔴 ② lectura completa rellena TODOS los campos y engancha el proveedor por NIF', async () => {
  const propuesta = propuestaCompleta();
  const { banco, fix } = bancoBase({
    providers: [{ id: 42, name: 'Leroy Merlin', taxId: 'A58818501' }],
    lecturas: [jsonOk({ ok: true, propuesta, descartados: [] })],
  });
  const { btn } = await prepararConFoto(banco);
  await pulsar(btn);

  const $ = (id) => banco.ctx.document.getElementById(id);
  assert.equal($('exp-concept').value, propuesta.concept, '🔴 no rellena el concepto');
  assert.equal(Number($('exp-amount').value), propuesta.amount, '🔴 no rellena el importe');
  assert.equal(Number($('exp-base').value), propuesta.baseAmount, '🔴 no rellena la base imponible');
  assert.equal(Number($('exp-vatrate').value), propuesta.vatRate, '🔴 no rellena el tipo de IVA');
  assert.equal(Number($('exp-vatamount').value), propuesta.vatAmount, '🔴 no rellena la cuota de IVA');
  assert.equal($('exp-provinvnum').value, propuesta.providerInvoiceNumber, '🔴 no rellena el nº de factura');
  assert.equal($('exp-provinvdate').value, propuesta.providerInvoiceDate, '🔴 no rellena la fecha de factura');
  assert.equal($('exp-date').value, propuesta.date, '🔴 no rellena la fecha del gasto');
  assert.equal($('exp-providerid').value, String(propuesta.providerId),
    '🔴 no engancha el proveedor que casa por NIF (SCRUM-961b)');
  assert.equal($('exp-provider-nif').value, propuesta.nifProveedor,
    '🔴 el NIF no se refleja al enganchar el proveedor de su ficha');
  assert.equal($('exp-error').style.display, 'none', '🔴 una lectura completa no debería mostrar ningún aviso');
  assert.equal(fix.llamadasLeerTicket(), 1, 'suelo: se ha llamado una vez al endpoint');
});

test('SCRUM-1038 · ② el cuerpo de la petición lleva la imagen', async () => {
  const { banco, fix } = bancoBase({ lecturas: [jsonOk({ ok: true, propuesta: propuestaCompleta(), descartados: [] })] });
  const { btn } = await prepararConFoto(banco);
  await pulsar(btn);
  const enviada = fix.enviadas.find((e) => /leer-ticket/.test(e.url));
  assert.ok(enviada, '🔴 no ha llegado ninguna petición a leer-ticket');
  assert.equal(enviada.metodo, 'POST', '🔴 la petición no es POST');
  const cuerpo = JSON.parse(enviada.body);
  assert.equal(cuerpo.imagen, FOTO_FALSA._dataUrl, '🔴 la imagen que llega al servidor no es la foto elegida');
});

// ═══ ③ LECTURA PARCIAL: solo rellena lo que llega, y NO borra lo ya escrito ═════════════════

test('SCRUM-1038 · 🔴 ③ lectura parcial: solo toca los campos que trae, y no borra lo ya tecleado', async () => {
  const { banco } = bancoBase({
    lecturas: [jsonOk({
      ok: true,
      propuesta: {
        concept: null, amount: 12.1, baseAmount: null, vatRate: null, vatAmount: null,
        date: null, providerInvoiceDate: null, providerInvoiceNumber: null,
        proveedorNombre: null, nifProveedor: null, providerId: null,
      },
      descartados: [{ campo: 'baseAmount', motivo: 'no_cuadra_con_el_total' }],
    })],
  });
  const { btn } = await prepararConFoto(banco);
  const $ = (id) => banco.ctx.document.getElementById(id);
  $('exp-concept').value = 'Ya escrito a mano';

  await pulsar(btn);

  assert.equal($('exp-concept').value, 'Ya escrito a mano',
    '🔴 una lectura parcial ha BORRADO un campo que el profesional ya había escrito (AC#4)');
  assert.equal(Number($('exp-amount').value), 12.1, '🔴 no ha rellenado el único campo que sí trajo la lectura');
  assert.equal($('exp-error').style.display, 'none',
    '🔴 una lectura parcial (con al menos un campo) no es una lectura vacía: no debería avisar');
});

// ═══ ④ LECTURA VACÍA: foto borrosa, sin texto, o que no es un ticket ════════════════════════

test('SCRUM-1038 · 🔴 ④ lectura vacía (todo null): avisa con el texto firmado y no toca el formulario', async () => {
  const vacia = {
    concept: null, amount: null, baseAmount: null, vatRate: null, vatAmount: null,
    date: null, providerInvoiceDate: null, providerInvoiceNumber: null,
    proveedorNombre: null, nifProveedor: null, providerId: null,
  };
  const { banco } = bancoBase({ lecturas: [jsonOk({ ok: true, propuesta: vacia, descartados: [] })] });
  const { btn } = await prepararConFoto(banco);
  const $ = (id) => banco.ctx.document.getElementById(id);
  $('exp-concept').value = 'Lo que ya había';

  await pulsar(btn);

  const error = $('exp-error');
  assert.equal(error.style.display, 'block', '🔴 una lectura vacía no muestra ningún aviso');
  assert.equal(error.textContent, AVISO_FALLO,
    `🔴 el aviso de lectura vacía no es el texto firmado: «${error.textContent}»`);
  assert.equal($('exp-concept').value, 'Lo que ya había', '🔴 una lectura vacía ha tocado el formulario (AC#4)');
});

// ═══ ⑤ EL TOPE DE 5/DÍA: mensaje claro, nunca un código técnico (AC#3) ══════════════════════

test('SCRUM-1038 · 🔴 ⑤ el tope de 5 lecturas al día avisa con SU texto, no con el código', async () => {
  const { banco } = bancoBase({ lecturas: [jsonFail(429, { ok: false, error: 'lecturas_agotadas' })] });
  const { btn } = await prepararConFoto(banco);
  await pulsar(btn);
  const error = banco.ctx.document.getElementById('exp-error');
  assert.equal(error.style.display, 'block', '🔴 el tope alcanzado no muestra ningún aviso');
  assert.equal(error.textContent, AVISO_TOPE,
    `🔴 el aviso del tope no es el texto firmado: «${error.textContent}»`);
  assert.doesNotMatch(error.textContent, /lecturas_agotadas|429|error t[eé]cnico/i,
    '🔴 se ha colado un código técnico en el aviso (AC#3: nunca un error técnico)');
});

// ═══ ⑥ CUALQUIER OTRO FALLO: el mismo aviso genérico, y tampoco toca el formulario ══════════

for (const [nombre, respuesta] of [
  ['sin IA configurada (503)', jsonFail(503, { ok: false, error: 'ai_not_configured' })],
  ['cuota de Google agotada (429, no es nuestro tope)', jsonFail(429, { ok: false, error: 'ai_cuota_diaria_agotada' })],
  ['formato que la IA no pudo parsear (422)', jsonFail(422, { ok: false, error: 'ai_could_not_parse' })],
  ['fallo interno (500)', jsonFail(500, { ok: false, error: 'internal_error' })],
]) {
  test(`SCRUM-1038 · ⑥ fallo del servidor — ${nombre} — avisa con el genérico y no toca nada`, async () => {
    const { banco } = bancoBase({ lecturas: [respuesta] });
    const { btn } = await prepararConFoto(banco);
    const $ = (id) => banco.ctx.document.getElementById(id);
    $('exp-amount').value = '7';

    await pulsar(btn);

    const error = $('exp-error');
    assert.equal(error.style.display, 'block', `🔴 ${nombre}: no muestra ningún aviso`);
    assert.equal(error.textContent, AVISO_FALLO, `🔴 ${nombre}: el aviso no es el genérico firmado`);
    assert.equal($('exp-amount').value, '7', `🔴 ${nombre}: ha tocado un campo con el formulario (AC#4)`);
  });
}

test('SCRUM-1038 · ⑥ un fallo de RED (sin conexión) también avisa con el genérico', async () => {
  const fix = fetchDeGastos();
  const banco = cargarDashboard(RAIZ, {
    red: {
      fetch: async (url, opts) => {
        if (/\/admin\/expenses\/leer-ticket/.test(String(url))) throw new TypeError('Failed to fetch');
        return fix.fetch(url, opts);
      },
    },
  });
  banco.ctx.FileReader = FileReaderFalso;
  const { btn } = await prepararConFoto(banco);
  await pulsar(btn);
  const error = banco.ctx.document.getElementById('exp-error');
  assert.equal(error.style.display, 'block', '🔴 un fallo de red no muestra ningún aviso');
  assert.equal(error.textContent, AVISO_FALLO, '🔴 el aviso de un fallo de red no es el genérico firmado');
});

// ═══ ⑦ DOBLE CLIC Y EL ESTADO MIENTRAS LEE ══════════════════════════════════════════════════

test('SCRUM-1038 · 🔴 ⑦ el botón se desactiva mientras lee, y un doble clic no llama dos veces', async () => {
  const { banco, fix } = bancoBase({ lecturas: [jsonOk({ ok: true, propuesta: propuestaCompleta(), descartados: [] })] });
  const { btn } = await prepararConFoto(banco);

  const fns = btn._oyentes.click || [];
  assert.ok(fns.length > 0, 'suelo: el botón tiene oyente de clic');
  const p1 = fns[0].call(btn, EV);
  assert.equal(btn.disabled, true, '🔴 el botón no se deshabilita nada más pulsar');
  assert.equal(btn.textContent, TEXTO_LEYENDO,
    `🔴 el texto mientras lee no es el firmado: «${btn.textContent}»`);
  const p2 = fns[0].call(btn, EV); // el «doble clic» del caso límite (comentario 16241)
  await Promise.all([p1, p2]);

  assert.equal(fix.llamadasLeerTicket(), 1,
    `🔴 el doble clic ha llamado ${fix.llamadasLeerTicket()} veces al servidor: se está pagando cuota de más`);
  assert.equal(btn.disabled, false, '🔴 el botón no vuelve a activarse al terminar');
  assert.equal(btn.textContent, TEXTO_LEER, '🔴 el botón no recupera su texto de reposo al terminar');
});

test('SCRUM-1038 · ⑦ pulsar sin foto elegida no hace nada (no hay `files[0]`)', async () => {
  const { banco, fix } = bancoBase();
  banco.ctx.openExpenseModal(null);
  await ticks();
  const btn = banco.ctx.document.getElementById('exp-leer-ticket');
  // El botón sigue escondido (①), pero por si algo lo mostrara sin foto: el oyente se protege solo.
  await pulsar(btn);
  assert.equal(fix.llamadasLeerTicket(), 0, '🔴 sin foto elegida, se ha llamado igual al endpoint');
});
