// docs/master/evidencias/SCRUM-1145/pagina.mjs — la ficha del cliente MONTADA (vistas reales, banco de
// `_pagina-panel.mjs`) con la pestaña «Sitios» abierta, para mirarla en un navegador a 320, 390 y
// 1280 px. Escribe `lista.html` (fiscal + dos sitios, uno con nombre y dirección largos), `formulario.html`
// (el alta abierta) y `vacio.html` (sin sitios guardados) en la carpeta que se le pase (obligatoria).
// Uso: node docs/master/evidencias/SCRUM-1145/pagina.mjs <dir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from '../../../../tests/_banco-vistas.mjs';
import { serializar } from '../../../../scripts/_pagina-panel.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const OUT = process.argv[2];
if (!OUT) { console.error('Uso: node docs/master/evidencias/SCRUM-1145/pagina.mjs <dir>'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

const CLIENTE = {
  id: 7, name: 'Comunidad de Propietarios Av. del Puerto 118', phone: '34000000003', mobile: null, email: null, notes: null,
  portalToken: null, createdAt: '2026-01-15T10:00:00Z', waOptOut: false, taxId: 'H12345678', tags: null,
  billingAddress: 'Avenida del Puerto 118', billingPostalCode: '46022', billingCity: 'Valencia', billingProvince: 'Valencia', billingCountry: 'ES',
};
const SITIOS = [
  { id: 1, name: 'Nave del polígono', address: 'Polígono Industrial Fuente del Jarro, calle Ciudad de Sevilla 42, nave 7', city: 'Paterna',
    postalCode: '46988', province: 'Valencia', country: 'ES', contactName: 'Vicente (encargado de mantenimiento)', phone: '34000000004' },
  { id: 2, name: 'Piso 3ºB', address: null, city: null, postalCode: null, province: null, country: null, contactName: null, phone: null },
];
const STATS = { totalQuotes: 0, acceptedQuotes: 0, totalBilled: 0, totalPaid: 0, totalExpenses: 0, profit: 0 };
const servidor = (sitios) => (ruta) => {
  const u = String(ruta);
  if (/\/sites$/.test(u)) return { sitios };
  if (/\/detail$/.test(u)) return { customer: CLIENTE, quotes: [], invoices: [], events: [], stats: STATS };
  if (/\/historial/.test(u)) return { trabajos: [], partesSueltos: [] };
  if (/\/whatsapp/.test(u)) return { waOptOut: false, mensajes: [] };
  return /\/admin\/merchant/.test(u) ? { id: 1, name: 'Fontanería Soler' } : [];
};
const css = ['public/tokens.css', 'public/dashboard/css/styles.css'].map((f) => fs.readFileSync(path.join(RAIZ, f), 'utf8')).join('\n');
const espera = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); };

for (const [nombre, sitios, abrirAlta] of [['lista', SITIOS, false], ['formulario', SITIOS, true], ['vacio', [], false]]) {
  const banco = cargarDashboard(RAIZ, { rol: 'admin', datos: servidor(sitios) });
  const r = await pintarVista(banco, 'renderCustomer360View', CLIENTE.id);
  if (r.error) { console.error(`CIEGO · ${nombre}: ${r.error.message}`); process.exit(2); }
  await espera();
  const pestana = todos(r.contenedor).find((n) => n.dataset?.key === 'sitios');
  if (!pestana) { console.error(`CIEGO · ${nombre}: no hay pestaña «Sitios»`); process.exit(2); }
  pestana.disparar('click'); await espera();
  if (abrirAlta) {
    const b = todos(r.contenedor).find((n) => n.id === 'c360-sitio-nuevo');
    if (!b) { console.error(`CIEGO · ${nombre}: no hay «+ Nuevo sitio»`); process.exit(2); }
    b.disparar('click'); await espera();
  }
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<style>${css}</style></head><body><main class="main-content">${serializar(r.contenedor)}</main></body></html>`;
  fs.writeFileSync(path.join(OUT, `${nombre}.html`), html);
  console.log(`${nombre}.html · ${todos(r.contenedor).length} nodos`);
}
console.log(`carpeta: ${OUT}`);
