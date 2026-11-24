// SCRUM-1828b · Ajustes (`settingsView.js`): la CARGA y el GUARDADO dejan de pintar el error técnico
// crudo («No se han podido cargar los datos: API 500: internal_error», «Error al guardar: API 500: …»)
// y pasan por `mensajeParaPersona` (SCRUM-1233) con el rótulo que cada sitio ya pintaba, sin «: ».
// Decisión del fundador: SCRUM-1828 c.22597 («Cuenta como aprobado»); medición: c.22596.
//
// Banco de vistas con el `apiRequest` REAL de api.js (el error que fabrica de verdad, no uno a mano).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // «Vuelve el crudo al guardar»: el rótulo se pega otra vez a `err.message`.
    fichero: 'public/dashboard/js/settingsView.js',
    de: '        else setAlert("error", mensajeParaPersona(err, "Error al guardar"));\n',
    a: '        else setAlert("error", "Error al guardar: " + err.message);\n',
    cae: 'un 500 al GUARDAR pinta «Error al guardar»',
  },
];

const respuesta = (status, cuerpo) => ({
  ok: status >= 200 && status < 300, status, statusText: status === 500 ? 'Internal Server Error' : 'OK',
  headers: { get: () => 'application/json' },
  json: async () => cuerpo, blob: async () => ({}), text: async () => JSON.stringify(cuerpo),
});
const respiro = async () => { for (let i = 0; i < 10; i++) await new Promise((res) => setImmediate(res)); };

/** Monta Ajustes con `fetch` a medida; devuelve los nodos y el texto del aviso de `setAlert`. */
async function montar(fetch) {
  const banco = cargarDashboard(RAIZ, { red: { fetch } });
  const r = await pintarVista(banco, 'renderSettingsView');
  assert.equal(r.error, null, `🔴 CIEGO: Ajustes no se monta: ${r.error && r.error.message}`);
  await respiro();
  const nodos = todos(r.contenedor);
  const aviso = () => {
    const a = nodos.filter((n) => /^alert\b/.test(String(n.className || '')));
    assert.equal(a.length, 1, `🔴 CIEGO: espero UN aviso de setAlert y hay ${a.length}`);
    return { texto: String(a[0].textContent || ''), clase: String(a[0].className) };
  };
  const guardar = async () => {
    const form = nodos.find((n) => n._oyentes && (n._oyentes.submit || []).length);
    assert.ok(form, '🔴 CIEGO: no encuentro el formulario de Ajustes');
    await form._oyentes.submit[0]({ preventDefault() {} });
    await respiro();
  };
  return { aviso, guardar };
}

const esMerchant = (url) => /\/admin\/merchant$/.test(String(url));
// El mismo perfil mínimo que SCRUM-1102f: sin él, la validación del cliente para antes del PUT.
const PERFIL = { name: 'Fontanería QA', legalName: 'Fontanería QA SL', taxId: 'B00000000', address: 'C/ Mayor 1', whatsappPhone: '34000000027' };

test('SCRUM-1828b · 🔴 un 500 al CARGAR pinta «No se han podido cargar los datos», sin «API 500»', async () => {
  const p = await montar(async (url) => (esMerchant(url) ? respuesta(500, { error: 'internal_error' }) : respuesta(200, [])));
  const a = p.aviso();
  assert.match(a.clase, /error/, '🔴 CIEGO: el aviso no está en modo error: la carga no ha fallado');
  assert.equal(a.texto, 'No se han podido cargar los datos');
  assert.doesNotMatch(a.texto, /API 500|internal_error/);
});

test('SCRUM-1828b · 🔴 un 500 al GUARDAR pinta «Error al guardar», sin «API 500»', async () => {
  const p = await montar(async (url, opts) => {
    if (!esMerchant(url)) return respuesta(200, []);
    if (opts && opts.method === 'PUT') return respuesta(500, { error: 'internal_error' });
    return respuesta(200, PERFIL);
  });
  await p.guardar();
  const a = p.aviso();
  assert.match(a.clase, /error/, '🔴 CIEGO: el aviso no está en modo error: el guardado no ha fallado');
  assert.equal(a.texto, 'Error al guardar');
  assert.doesNotMatch(a.texto, /API 500|internal_error/);
});

test('SCRUM-1828b · CONTROL: el guardado que SÍ sale sigue pintando su texto de éxito', async () => {
  const p = await montar(async (url) => respuesta(200, esMerchant(url) ? PERFIL : []));
  await p.guardar();
  const a = p.aviso();
  assert.equal(a.texto, 'Datos de empresa guardados correctamente.');
  assert.match(a.clase, /success/);
});
