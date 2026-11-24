// SCRUM-1828c · Ajustes (`settingsView.js`), la SEGUNDA mitad: la vista previa del resumen semanal,
// el guardado de la página pública, el QR del perfil y «Eliminar datos de ejemplo» pasan por
// `mensajeParaPersona` (SCRUM-1233) con el rótulo que cada sitio ya pintaba, sin «: » y sin el crudo.
// Decisión del fundador: SCRUM-1828 c.22597 («Cuenta como aprobado»); medición: c.22596. Misma forma
// que `scrum1828b-ajustes-carga-y-guardado-sin-crudo.test.mjs`.
//
// Banco de vistas con el `apiRequest` REAL de api.js (el error que fabrica de verdad, no uno a mano).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // «Vuelve el crudo al eliminar»: el rótulo se pega otra vez a `e.message`.
    fichero: 'public/dashboard/js/settingsView.js',
    de: "        salida.textContent = mensajeParaPersona(e, 'No se pudo eliminar');\n",
    a: "        salida.textContent = 'No se pudo eliminar: ' + (e?.data?.message || e.message);\n",
    cae: 'un 500 al ELIMINAR los datos de ejemplo pinta «No se pudo eliminar»',
  },
];

const respuesta = (status, cuerpo) => ({
  ok: status >= 200 && status < 300, status, statusText: status === 500 ? 'Internal Server Error' : 'OK',
  headers: { get: () => 'application/json' },
  json: async () => cuerpo, blob: async () => ({}), text: async () => JSON.stringify(cuerpo),
});
const respiro = async () => { for (let i = 0; i < 10; i++) await new Promise((res) => setImmediate(res)); };

const QR_RESPALDO = 'No hemos podido generar el QR con esas opciones. Prueba a cambiar el color o el tamaño.';
// El perfil mínimo de SCRUM-1828b, con `slug` (sin él no se pinta la página pública ni el QR) y como
// cuenta demo (sin ella no existe «Eliminar datos de ejemplo»).
const PERFIL = {
  name: 'Fontanería QA', legalName: 'Fontanería QA SL', taxId: 'B00000000', address: 'C/ Mayor 1',
  whatsappPhone: '34000000027', slug: 'fontaneria-qa', esCuentaDemo: true,
};
const esMerchant = (url) => /\/admin\/merchant$/.test(String(url));

/** Monta Ajustes con `fetch` a medida; los nodos se buscan en TODO el documento (el modal va al body). */
async function montar(fetch) {
  const banco = cargarDashboard(RAIZ, { red: { fetch } });
  const r = await pintarVista(banco, 'renderSettingsView');
  assert.equal(r.error, null, `🔴 CIEGO: Ajustes no se monta: ${r.error && r.error.message}`);
  await respiro();
  const nodos = () => todos(banco.ctx.document.body);
  const porId = (id) => {
    const n = nodos().find((x) => x.id === id);
    assert.ok(n, `🔴 CIEGO: no encuentro #${id}`);
    return n;
  };
  const pulsar = async (n) => {
    const oy = (n._oyentes && n._oyentes.click) || [];
    assert.ok(oy.length, `🔴 CIEGO: «${n.textContent}» no tiene oyente de clic`);
    await oy[0]({ currentTarget: n, target: n, preventDefault() {} });
    await respiro();
  };
  const boton = (texto) => {
    const n = nodos().find((x) => String(x.textContent || '').trim() === texto && x._oyentes && (x._oyentes.click || []).length);
    assert.ok(n, `🔴 CIEGO: no encuentro el botón «${texto}»`);
    return n;
  };
  const aviso = () => {
    const a = nodos().filter((n) => /^alert\b/.test(String(n.className || '')));
    assert.equal(a.length, 1, `🔴 CIEGO: espero UN aviso de setAlert y hay ${a.length}`);
    return { texto: String(a[0].textContent || ''), clase: String(a[0].className) };
  };
  return { porId, pulsar, boton, aviso };
}

const sinCrudo = (texto) => assert.doesNotMatch(texto, /API 500|internal_error|:\s*$/);

test('SCRUM-1828c · 🔴 :783 · un 500 en la VISTA PREVIA pinta «No se pudo cargar la vista previa», sin «API 500»', async () => {
  const p = await montar(async (url) => {
    if (/\/admin\/digest\/preview/.test(String(url))) return respuesta(500, { error: 'internal_error' });
    return respuesta(200, esMerchant(url) ? PERFIL : []);
  });
  await p.pulsar(p.boton('Vista previa'));
  const a = p.aviso();
  assert.match(a.clase, /error/, '🔴 CIEGO: el aviso no está en modo error: la vista previa no ha fallado');
  assert.equal(a.texto, 'No se pudo cargar la vista previa');
  sinCrudo(a.texto);
});

test('SCRUM-1828c · 🔴 :1603 · un 500 con `message` en blanco al guardar la PÁGINA PÚBLICA pinta su rótulo', async () => {
  // Con un 500 sin `message` este sitio YA pintaba el rótulo (c.22596): no pintaba `err.message`.
  // Lo que cambia al pasar por el helper es la frase vacía del servidor, que antes salía tal cual.
  const p = await montar(async (url, opts) => {
    if (esMerchant(url) && opts && opts.method === 'PUT') return respuesta(500, { error: 'internal_error', message: '   ' });
    return respuesta(200, esMerchant(url) ? PERFIL : []);
  });
  await p.pulsar(p.porId('pp-save'));
  assert.equal(String(p.porId('pp-msg').textContent), 'No se pudo guardar. Inténtalo de nuevo.');
});

test('SCRUM-1828c · 🔴 :1696 · un 500 con `message` en blanco en el QR pinta su rótulo', async () => {
  // Igual que :1603: el cuerpo del `fetch` ya caía al rótulo sin `message`; la frase vacía, no.
  const p = await montar(async (url) => {
    if (/public-profile-qr/.test(String(url))) return respuesta(500, { error: 'contraste_insuficiente', message: '  ' });
    return respuesta(200, esMerchant(url) ? PERFIL : []);
  });
  const err = p.porId('qr-error');
  assert.equal(err.hidden, false, '🔴 CIEGO: el QR no ha pasado por su camino de error');
  assert.equal(String(err.textContent), QR_RESPALDO);
});

test('SCRUM-1828c · 🔴 :1872 · un 500 al ELIMINAR los datos de ejemplo pinta «No se pudo eliminar»', async () => {
  const p = await montar(async (url) => {
    if (/datos-ejemplo\/eliminar/.test(String(url))) return respuesta(500, { error: 'internal_error' });
    return respuesta(200, esMerchant(url) ? PERFIL : []);
  });
  await p.pulsar(p.boton('Eliminar datos de ejemplo'));
  await p.pulsar(p.porId('de-si'));
  const salida = p.porId('datos-ejemplo').hijos[1];
  assert.equal(String(salida.textContent), 'No se pudo eliminar');
  sinCrudo(String(salida.textContent));
});

test('SCRUM-1828c · CONTROL: el borrado que SÍ sale sigue diciendo qué borró', async () => {
  const p = await montar(async (url) => {
    if (/datos-ejemplo\/eliminar/.test(String(url))) return respuesta(200, { ok: true, clientes: 1, presupuestos: 2, facturas: 3 });
    return respuesta(200, esMerchant(url) ? PERFIL : []);
  });
  await p.pulsar(p.boton('Eliminar datos de ejemplo'));
  await p.pulsar(p.porId('de-si'));
  assert.equal(String(p.porId('datos-ejemplo').hijos[1].textContent),
    'Listo. Hemos eliminado 1 clientes, 2 presupuestos y 3 facturas de ejemplo.');
});
