// tests/scrum1184-vista-previa-en-el-alta.test.mjs — SCRUM-1184 · trozo 3 (pantalla, S2)
//
// «Siguiente número: AB260005.» EN LA HOJA DE «NUEVO ALBARÁN».
//
// Texto FIRMADO por el orquestador (SCRUM-1184, c.17342), con el número real. La ruta es de S1 (trozo 1,
// mismo PR): `GET /admin/albaranes/serie` → `{ siguiente }`; 409 `serie_sin_anio` sin texto.
//
// Se mide EL VIAJE: el número lo produce la función REAL del servidor (`siguienteNumeroDeAlbaran`, de
// `dist`) sobre un contador de prueba → la respuesta de la ruta → la ficha del Trabajo montada →
// «+ Nuevo albarán» → la hoja dice exactamente ese número. Todas las altas acaban en esta hoja
// (`openAlbCrearSheet`): el «Nuevo albarán» de la pestaña Albaranes solo navega hasta el Trabajo.
// FALLA CERRADO: 409, error o respuesta sin `siguiente` → no se pinta nada.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cargarDashboard, pintarVista } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { siguienteNumeroDeAlbaran } = await import(pathToFileURL(path.join(RAIZ, 'dist/modules/jobs/domain/albaranSerie.js')).href);

const JOB = {
  id: 42, status: 'en_curso', createdAt: '2026-09-01T09:00:00Z', titulo: 'Reparación caldera',
  customer: { id: 5, name: 'Cliente Uno', phone: null, mobile: null },
  asignados: [], operario: null, albaranes: [], gastos: [], notes: '',
  quote: null, direccion: null, totalAceptado: 0, totalCobrado: 0,
};

function errorDeApi(status, data) {
  const e = new Error(`API ${status}`);
  e.status = status;
  e.data = data;
  return e;
}

/** Lo que responde la ruta de S1 con este contador: la MISMA función que usa `albaranes.routes.ts`. */
async function respuestaDeLaRuta(contador) {
  const db = { merchant: { findUnique: async () => contador } };
  const siguiente = await siguienteNumeroDeAlbaran(db, 1, new Date('2026-09-28T12:00:00Z'));
  return { siguiente };
}

async function hojaDeAlta(serie) {
  const banco = cargarDashboard(RAIZ);
  const pedidas = [];
  banco.ctx.apiRequest = async (u, opts = {}) => {
    const url = String(u);
    if (/\/admin\/albaranes\/serie$/.test(url)) {
      pedidas.push(url);
      if (serie instanceof Error) throw serie;
      return serie;
    }
    if (/\/admin\/team/.test(url)) return [];
    if (/\/admin\/merchant/.test(url)) return { name: 'Epipe' };
    if (/\/admin\/partes/.test(url)) return { partes: [] };
    if (/gastos/.test(url)) return [];
    return JOB;
  };
  banco.ctx.appUserRole = 'admin';
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `🔴 SUELO: la ficha no monta (${r.error && r.error.message})`);
  const doc = banco.ctx.document;
  const nuevo = [...doc.querySelectorAll('button')].find((b) => String(b.textContent).trim() === '+ Nuevo albarán');
  assert.ok(nuevo, '🔴 CIEGO: no encuentro «+ Nuevo albarán»');
  for (const f of (nuevo._oyentes && nuevo._oyentes.click) || []) await f.call(nuevo, { type: 'click', target: nuevo, preventDefault() {}, stopPropagation() {} });
  await new Promise((ok) => setTimeout(ok, 50));
  const overlays = doc.querySelectorAll('.modal-overlay');
  const hoja = overlays[overlays.length - 1];
  assert.ok(hoja, '🔴 CIEGO: «+ Nuevo albarán» no abre la hoja');
  assert.equal(pedidas.length, 1, '🔴 la hoja no pide el siguiente número a `GET /admin/albaranes/serie`');
  const p = hoja.querySelector('.alb-siguiente-numero');
  assert.ok(p, '🔴 CIEGO: la hoja no tiene el hueco de la vista previa');
  return { visible: !p.hidden, texto: String(p.textContent || '') };
}

test('SCRUM-1184 · 🔴 EL VIAJE: la hoja dice el número que da el servidor, con el texto firmado', async () => {
  const serie = await respuestaDeLaRuta({ nextAlbaranNumber: 5, albaranSeriesYear: 2026, timezone: 'Europe/Madrid' });
  assert.equal(typeof serie.siguiente, 'string', 'SUELO: la función del servidor no da número');
  const { visible, texto } = await hojaDeAlta(serie);
  assert.equal(visible, true, '🔴 el profesional no ve el siguiente número al crear el albarán');
  assert.equal(texto, `Siguiente número: ${serie.siguiente}.`, 'el texto firmado es «Siguiente número: AB260005.», con el número real');
});

test('SCRUM-1184 · 🔴 FALLA CERRADO: 409 `serie_sin_anio` → no se pinta ningún número', async () => {
  const { visible, texto } = await hojaDeAlta(errorDeApi(409, { error: 'serie_sin_anio' }));
  assert.equal(visible, false, '🔴 con la serie sin año se enseña un número que confirmaría el reinicio silencioso');
  assert.equal(texto, '');
});

test('SCRUM-1184 · FALLA CERRADO: una respuesta sin `siguiente` string no pinta nada', async () => {
  for (const r of [{}, { siguiente: null }, { siguiente: '   ' }, null]) {
    const { visible } = await hojaDeAlta(r);
    assert.equal(visible, false, `🔴 con ${JSON.stringify(r)} se pinta la vista previa`);
  }
});
