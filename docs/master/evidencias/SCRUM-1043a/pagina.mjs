// docs/master/evidencias/SCRUM-1043a/pagina.mjs — la lista de Clientes MONTADA (vistas reales, banco de
// `_pagina-panel.mjs`) con tres clientes —deuda, sin deuda, parcial con garantía— para mirarla en un
// navegador a 320, 390 y 1280 px. Escribe `admin.html`, `admin-filtro.html` y `tecnico.html` en la
// carpeta que se le pase (obligatoria). Uso: node docs/master/evidencias/SCRUM-1043a/pagina.mjs <dir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from '../../../../tests/_banco-vistas.mjs';
import { serializar } from '../../../../scripts/_pagina-panel.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
// La carpeta la pone quien lo llama: el HTML se queda para el navegador, así que no hay temporal que borrar (SCRUM-864c).
const OUT = process.argv[2];
if (!OUT) { console.error('Uso: node docs/master/evidencias/SCRUM-1043a/pagina.mjs <dir>'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const base = { phone: '34000000001', email: null, notes: '', tags: null, createdAt: '2026-01-15T10:00:00Z' };
const LOTE = [
  { ...base, id: 1, name: 'Administración de Fincas Soler y Asociados', saldoPendiente: 1250 },
  { ...base, id: 2, name: 'Carmen Ruiz', phone: '34000000002' },
  { ...base, id: 3, name: 'Comunidad de Propietarios Av. del Puerto 118', phone: '34000000003', saldoPendiente: 9999.99,
    garantiaRetenida: { total: 900, retenciones: [
      { importe: 500, liberacionDia: '2026-09-01', aviso: true }, { importe: 400, liberacionDia: '2027-03-15', aviso: false }] } },
];
const servidor = (rol) => (ruta) => {
  if (!String(ruta).startsWith('/admin/customers')) return /\/admin\/merchant/.test(ruta) ? { id: 1, name: 'Fontanería Soler' } : [];
  const q = new URLSearchParams(String(ruta).split('?')[1] || '');
  let f = rol === 'admin' ? LOTE : LOTE.map(({ saldoPendiente, garantiaRetenida, ...c }) => c);
  if (rol === 'admin' && q.get('conDeuda') === '1') f = f.filter((c) => c.saldoPendiente > 0 || c.garantiaRetenida);
  return f;
};
const css = ['public/tokens.css', 'public/dashboard/css/styles.css'].map((f) => fs.readFileSync(path.join(RAIZ, f), 'utf8')).join('\n');
const espera = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); };

for (const [nombre, rol, filtro] of [['admin', 'admin', false], ['admin-filtro', 'admin', true], ['tecnico', 'tecnico', false]]) {
  const banco = cargarDashboard(RAIZ, { rol, datos: servidor(rol) });
  const r = await pintarVista(banco, 'renderCustomersView');
  if (r.error) { console.error(`CIEGO · ${nombre}: ${r.error.message}`); process.exit(2); }
  await espera();
  if (filtro) {
    const b = todos(r.contenedor).find((n) => n.dataset?.filtro === 'conDeuda');
    if (!b) { console.error(`CIEGO · ${nombre}: no hay botón`); process.exit(2); }
    b.disparar('click'); await espera();
  }
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<style>${css}</style></head><body><main class="main-content">${serializar(r.contenedor)}</main></body></html>`;
  fs.writeFileSync(path.join(OUT, `${nombre}.html`), html);
  console.log(`${nombre}.html · ${todos(r.contenedor).length} nodos`);
}
console.log(`carpeta: ${OUT}`);
