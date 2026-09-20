// docs/prototipos/SCRUM-920/medir-tablas-390.mjs — ¿qué listas del panel se recorren de lado a 390 px?
//
// Encargo de fondo de SCRUM-920: el defecto de la tabla que hay que arrastrar con el pulgar ha salido
// en el editor (SCRUM-139 F1) y en Gastos. Si reaparece pantalla por pantalla, el arreglo no es
// pantalla por pantalla. Esto CUENTA en qué pantallas pasa hoy, en staging, con la sesión QA.
//
// Sólo LEE: abre cada vista y mide cada `.table-scroll` (scrollWidth frente a clientWidth). No pulsa
// nada que escriba. Una vista sin filas no dice nada (su tabla no se pinta): se informa como
// «sin población», NO como limpia.
//
// Uso: igual que medir-hoy.mjs (el secreto en el entorno, nunca impreso).

import { arrancar, entrar, dormir, BASE } from '../../master/evidencias/SCRUM-307/sin-red/_conductor.mjs';

const VISTAS = ['home', 'cobros', 'quotes-list', 'customers', 'products', 'providers', 'invoices', 'expenses',
  'reports', 'templates', 'jobs', 'libro-registro', 'albaranes', 'partes-oficina', 'quote-requests', 'team'];

const { page, cerrar } = await arrancar();
await entrar(page);
await page.goto(BASE + '/dashboard/', { waitUntil: 'load' });
for (let i = 0; i < 30 && !(await page.evaluate(() => typeof window.renderAppView === 'function')); i++) await dormir(500);

// CONTROL POSITIVO: una caja sembrada de 600 px en 200 tiene que contarse como desborde.
const positivo = await page.evaluate(() => {
  const d = document.createElement('div');
  d.className = 'table-scroll'; d.style.width = '200px';
  d.innerHTML = '<table class="table"><tr><td style="width:600px">x</td></tr></table>';
  document.body.appendChild(d);
  const r = d.scrollWidth > d.clientWidth + 1;
  d.remove();
  return r;
});
console.log(`control positivo (caja sembrada 600 en 200): ${positivo ? 'la ve' : 'CIEGO'}`);

const filas = [];
for (const v of VISTAS) {
  await page.evaluate((vista) => { try { window.renderAppView(vista); } catch (e) { /* se informa abajo */ } }, v);
  let r = null;
  for (let i = 0; i < 16; i++) {
    await dormir(500);
    r = await page.evaluate(() => {
      const cajas = [...document.querySelectorAll('.table-scroll')].filter((c) => c.offsetParent !== null);
      return {
        cajas: cajas.length,
        filas: cajas.reduce((n, c) => n + c.querySelectorAll('tbody tr').length, 0),
        desbordan: cajas.filter((c) => c.scrollWidth > c.clientWidth + 1).map((c) => `${c.scrollWidth}>${c.clientWidth}`),
        clases: cajas.map((c) => (c.querySelector('table') ? c.querySelector('table').className : '(sin tabla)')),
      };
    });
    if (r.filas > 0) break;
  }
  filas.push({ vista: v, ...r });
}
await cerrar();

for (const f of filas) {
  const veredicto = f.cajas === 0 ? 'sin tabla' : f.filas === 0 ? 'SIN POBLACIÓN (no dice nada)' : f.desbordan.length ? 'SE RECORRE DE LADO' : 'no desborda';
  console.log(`${f.vista.padEnd(15)} cajas=${f.cajas} filas=${f.filas} · ${veredicto}${f.desbordan.length ? ' · ' + f.desbordan.join(', ') : ''} · tabla: ${f.clases.join(' | ')}`);
}
