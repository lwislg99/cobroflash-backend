// docs/master/evidencias/SCRUM-1833/pagina.mjs — la ficha del cliente MONTADA (vistas reales, banco de
// `tests/_banco-vistas.mjs`) con la pestaña «Equipos» abierta, para mirarla en un navegador a 390 y 1280 px.
// Patrón: docs/master/evidencias/SCRUM-1145/pagina.mjs (Sitios); el doble de `fetch` es el de
// tests/scrum1833c-pestana-equipos.test.mjs, porque el estado de error necesita un 500.
// Escribe en la carpeta que se le pase (obligatoria): lista.html (admin, tres equipos, uno con textos largos),
// alta.html («+ Nuevo equipo» pulsado), editar.html («Editar» del primero pulsado), tecnico.html (rol técnico:
// sin «Eliminar»), vacio.html (sin equipos) y error.html (la lista contesta 500).
// Uso: node docs/master/evidencias/SCRUM-1833/pagina.mjs <dir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from '../../../../tests/_banco-vistas.mjs';
import { serializar } from '../../../../scripts/_pagina-panel.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const OUT = process.argv[2];
if (!OUT) { console.error('Uso: node docs/master/evidencias/SCRUM-1833/pagina.mjs <dir>'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

const CLIENTE = {
  id: 7, name: 'Comunidad de Propietarios Av. del Puerto 118', phone: '34000000003', mobile: null, email: null, notes: null,
  portalToken: null, createdAt: '2026-01-15T10:00:00Z', waOptOut: false, taxId: 'H12345678', tags: null,
  billingAddress: 'Avenida del Puerto 118', billingPostalCode: '46022', billingCity: 'Valencia', billingProvince: 'Valencia', billingCountry: 'ES',
};
const EQUIPOS = [
  { id: 41, customerId: 7, type: 'Caldera', name: 'Caldera de la cocina', brand: 'Vaillant', modelName: 'ecoTEC plus',
    serialNumber: 'SN-777', installedOn: '2024-03-05', warrantyUntil: '2027-01-01', createdAt: '2026-11-20T10:00:00.000Z', updatedAt: '2026-11-20T10:00:00.000Z' },
  { id: 42, customerId: 7, type: 'Aire acondicionado', name: 'Split del salón', brand: null, modelName: null,
    serialNumber: null, installedOn: null, warrantyUntil: null, createdAt: '2026-11-21T10:00:00.000Z', updatedAt: '2026-11-21T10:00:00.000Z' },
  { id: 43, customerId: 7, type: 'Bomba de calor aerotérmica', name: 'Equipo de producción de agua caliente sanitaria del cuarto de máquinas de la cubierta',
    brand: 'Mitsubishi Electric', modelName: 'Ecodan PUHZ-SHW112YAA Hydrobox EHSD-VM2D', serialNumber: '7ZW04512-AB-2023-000981',
    installedOn: '2023-06-30', warrantyUntil: '2028-06-30', createdAt: '2026-11-22T10:00:00.000Z', updatedAt: '2026-11-22T10:00:00.000Z' },
];
const STATS = { totalQuotes: 0, acceptedQuotes: 0, totalBilled: 0, totalPaid: 0, totalExpenses: 0, profit: 0 };
const css = ['public/tokens.css', 'public/dashboard/css/styles.css'].map((f) => fs.readFileSync(path.join(RAIZ, f), 'utf8')).join('\n');
const espera = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); };

function fetchDoble(equipos) {
  return async (url) => {
    const pu = new URL(String(url), 'http://banco.invalid'); const u = pu.pathname;
    let r;
    if (/\/admin\/customers\/\d+\/equipos(\/\d+)?$/.test(u)) r = equipos;
    else if (/\/detail$/.test(u)) r = { status: 200, json: { customer: CLIENTE, quotes: [], invoices: [], events: [], stats: STATS } };
    else if (/\/historial/.test(u)) r = { status: 200, json: { trabajos: [], partesSueltos: [] } };
    else if (/\/whatsapp/.test(u)) r = { status: 200, json: { waOptOut: false, mensajes: [] } };
    else if (/\/documentos$/.test(u)) r = { status: 200, json: { documentos: [], limites: {} } };
    else if (/\/sites$/.test(u)) r = { status: 200, json: { sitios: [] } };
    else if (/\/admin\/merchant/.test(u)) r = { status: 200, json: { id: 1, name: 'Fontanería Soler' } };
    else r = { status: 200, json: [] };
    const ok = r.status >= 200 && r.status < 300;
    return { ok, status: r.status, headers: { get: () => 'application/json' }, blob: async () => ({}),
      json: async () => r.json, text: async () => JSON.stringify(r.json) };
  };
}

const ESTADOS = [
  ['lista', 'admin', { status: 200, json: { equipos: EQUIPOS } }, null],
  ['alta', 'admin', { status: 200, json: { equipos: EQUIPOS } }, 'nuevo-equipo'],
  ['editar', 'admin', { status: 200, json: { equipos: EQUIPOS } }, 'editar'],
  ['tecnico', 'tecnico', { status: 200, json: { equipos: EQUIPOS } }, null],
  ['vacio', 'admin', { status: 200, json: { equipos: [] } }, null],
  ['error', 'admin', { status: 500, json: { error: 'internal_error' } }, null],
];

for (const [nombre, rol, equipos, accion] of ESTADOS) {
  const fetch = fetchDoble(equipos);
  const banco = cargarDashboard(RAIZ, { rol, red: { navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } }, fetch } });
  if (banco.fallos.length) { console.error(`CIEGO · ${nombre}: un script del panel no cargó`); process.exit(2); }
  const r = await pintarVista(banco, 'renderCustomer360View', CLIENTE.id);
  if (r.error) { console.error(`CIEGO · ${nombre}: ${r.error.message}`); process.exit(2); }
  await espera();
  const pestana = todos(r.contenedor).find((n) => n.tagName === 'BUTTON' && n.dataset?.key === 'equipos');
  if (!pestana) { console.error(`CIEGO · ${nombre}: no hay pestaña «Equipos»`); process.exit(2); }
  pestana.disparar('click'); await espera();
  const filas = todos(r.contenedor).filter((n) => n.tagName === 'LI' && n.dataset?.equipo).length;
  if (accion) {
    const b = todos(r.contenedor).find((n) => n.tagName === 'BUTTON' && n.dataset?.accion === accion);
    if (!b) { console.error(`CIEGO · ${nombre}: no hay botón «${accion}»`); process.exit(2); }
    b.disparar('click'); await espera();
  }
  const eliminar = todos(r.contenedor).filter((n) => n.tagName === 'BUTTON' && n.dataset?.accion === 'eliminar').length;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<style>${css}</style></head><body><main class="main-content">${serializar(r.contenedor)}</main></body></html>`;
  fs.writeFileSync(path.join(OUT, `${nombre}.html`), html);
  console.log(`${nombre}.html · rol ${rol} · filas ${filas} · botones «eliminar» ${eliminar} · ${todos(r.contenedor).length} nodos`);
}
console.log(`carpeta: ${OUT}`);
