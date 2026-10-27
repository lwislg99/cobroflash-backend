// SCRUM-1056c · ¿qué dice la pieza «Volver a llamar» cuando FALLA «Hecho»? En navegador, a 390 px.
// Sobre yaqu.app, cuenta QA. NO ESCRIBE: la pieza no hace peticiones (`guardar` y `hecho` son dos
// funciones de la sonda, que fallan cuando se les dice) y comun.mjs corta todo lo que no sea GET.
//
//   node fallo-de-hecho-390.mjs - <carpeta de capturas>                         → la pieza que sirve PRODUCCIÓN
//   node fallo-de-hecho-390.mjs <clienteVolverALlamar.js> <carpeta de capturas> → sirve ese fichero en su lugar
// La pieza la carga ya el índice del panel: no se inyecta. La sonda no decide qué texto es el bueno:
// imprime el que sale en cada fallo, y quien la lanza compara las dos pasadas.
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { abrir } from './comun.mjs';

const local = process.argv[2] && process.argv[2] !== '-' ? resolve(process.argv[2]) : null;
const capturas = process.argv[3] ? resolve(process.argv[3]) : null;
if (local && !existsSync(local)) { console.log(`CIEGO: no existe ${local}`); console.log('EXIT=2'); process.exit(2); }
if (capturas) mkdirSync(capturas, { recursive: true });
const RUTA = '/dashboard/js/clienteVolverALlamar.js';
const { browser, page, noGet, errores, build } = await abrir({ servir: local ? { [RUTA]: local } : {}, viewport: { width: 390, height: 844 } });

const fuente = await page.evaluate(async (r) => (await fetch(r)).text(), RUTA);
const testigo = await page.evaluate(() => ({ pieza: typeof window.clienteVolverALlamar, montar: typeof window.clienteVolverALlamar?.montar, claves: Object.keys(window.clienteVolverALlamar?.TEXTOS || {}), ancho: window.innerWidth }));
console.log(`SERVIDO=${local ? `LOCAL ${local}` : 'la pieza de PRODUCCIÓN'} · build del panel ${build}`);
console.log(`TESTIGO=${JSON.stringify({ pieza: testigo.pieza, montar: testigo.montar, ancho: testigo.ancho, tieneNoMarcado: testigo.claves.includes('noMarcado'), elFuenteLoLleva: fuente.includes('noMarcado'), textos: testigo.claves.length })}`);
if (testigo.montar !== 'function') { console.log('CIEGO: la pieza no está en el panel'); await browser.close(); console.log('EXIT=2'); process.exit(2); }

await page.evaluate(() => {
  const vista = document.querySelector('#view-container');
  vista.innerHTML = '';
  const caja = document.createElement('div');
  caja.className = 'data-card';
  caja.id = 'sonda-volver-a-llamar';
  vista.appendChild(caja);
  window.__sonda = { guardar: 0, hecho: 0, falla: true };
  window.clienteVolverALlamar.montar(caja, {
    llamada: { dia: '2026-10-13', nota: 'Llamar por la tarde', estado: 'hoy' },
    guardar: (d) => { window.__sonda.guardar += 1; return window.__sonda.falla ? Promise.reject(new Error('sonda')) : Promise.resolve({ dia: d.dia, nota: d.nota, estado: 'hoy' }); },
    hecho: () => { window.__sonda.hecho += 1; return window.__sonda.falla ? Promise.reject(new Error('sonda')) : Promise.resolve(); },
  });
});
const medir = () => page.evaluate(() => {
  const caja = document.querySelector('#sonda-volver-a-llamar');
  const visibles = (sel) => [...caja.querySelectorAll(sel)].filter((e) => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0);
  return {
    parrafos: visibles('p').map((e) => e.textContent),
    botones: visibles('button').map((e) => ({ texto: e.textContent, apagado: e.disabled, alto: Math.round(e.getBoundingClientRect().height) })),
    avisos: visibles('[role="alert"]').map((e) => ({ texto: e.textContent, clase: e.className, ancho: Math.round(e.getBoundingClientRect().width), alto: Math.round(e.getBoundingClientRect().height) })),
    cajaAncho: Math.round(caja.getBoundingClientRect().width),
    seSale: caja.scrollWidth > caja.clientWidth || document.documentElement.scrollWidth > window.innerWidth || [...caja.querySelectorAll('*')].some((e) => e.getBoundingClientRect().right > caja.getBoundingClientRect().right + 0.5),
  };
});
const pulsar = (texto) => page.evaluate((t) => { const b = [...document.querySelectorAll('#sonda-volver-a-llamar button')].find((e) => e.textContent === t); if (b) b.click(); return !!b; }, texto);
const filas = [];
const apunta = async (que) => { await page.waitForTimeout(200); filas.push({ que, ...(await medir()) }); };

await apunta('CONTROL · en reposo, antes de pulsar nada');
if (!(await pulsar('Hecho'))) { console.log('CIEGO: no hay botón «Hecho»'); await browser.close(); console.log('EXIT=2'); process.exit(2); }
await apunta('«Hecho» que FALLA');
if (capturas) await page.locator('#sonda-volver-a-llamar').screenshot({ path: join(capturas, `1056c-390-fallo-de-hecho-${local ? 'rama' : 'produccion'}.png`) });
await pulsar('Hecho');
await apunta('«Hecho» que FALLA por segunda vez');
await pulsar('Cambiar');
await pulsar('Guardar');
await apunta('«Cambiar» → «Guardar» que FALLA');
await pulsar('Cancelar');
await apunta('«Cancelar»: vuelta al reposo');
await page.evaluate(() => { window.__sonda.falla = false; });
await pulsar('Hecho');
await apunta('CONTROL · «Hecho» que ENTRA');
const visto = await page.evaluate(() => window.__sonda);

console.log('--- FILAS (ancho de ventana 390)');
let cortos = 0; let fuera = 0;
for (const f of filas) {
  console.log(`\n· ${f.que}`);
  console.log(`    se lee  : ${f.parrafos.map((p) => `«${p}»`).join(' ; ') || '—'}`);
  console.log(`    botones : ${f.botones.map((b) => `«${b.texto}» alto ${b.alto}${b.apagado ? ' APAGADO' : ''}`).join(' ; ') || 'NINGUNO'}`);
  console.log(`    avisos  : ${f.avisos.length} · ${f.avisos.map((a) => `«${a.texto}» [${a.clase}] ${a.ancho}×${a.alto}`).join(' ; ') || 'ninguno'}`);
  console.log(`    caja    : ${f.cajaAncho} de ancho · algo se sale: ${f.seSale}`);
  cortos += f.botones.filter((b) => b.alto < 44).length;
  if (f.seSale) fuera += 1;
}
console.log(`\nlo que recibió la sonda: guardar=${visto.guardar} · hecho=${visto.hecho}`);
console.log(`peticiones que no son GET durante la sonda: ${noGet.length}`);
console.log(`errores de página: ${errores.join(' · ') || 'ninguno'}`);
console.log(`RESUMEN · al fallar «Hecho» dice: ${JSON.stringify(filas[1].avisos.map((a) => a.texto))} · al fallar «Guardar» dice: ${JSON.stringify(filas[3].avisos.map((a) => a.texto))}`);
console.log(`POBLACION=${filas.length} estados · botones de menos de 44 px de alto=${cortos} · estados con algo fuera de la caja=${fuera}`);
await browser.close();
const codigo = cortos || fuera || noGet.length || errores.length ? 1 : 0;
console.log(`EXIT=${codigo}`);
process.exit(codigo);
