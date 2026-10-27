// SCRUM-1056b · la pieza «Volver a llamar», medida en un navegador de verdad a 390 px.
// Sobre yaqu.app, cuenta QA, con las hojas de estilo de producción. NO ESCRIBE: la pieza no hace
// ninguna petición (sus `guardar` y `hecho` son aquí dos funciones de la sonda) y, además, el
// interceptor de comun.mjs corta todo lo que no sea GET (control positivo dentro).
// La pieza todavía no la monta ninguna pantalla: la sonda la carga y la monta en un bloque propio
// dentro del contenedor de vistas del panel.
//
//   node volver-a-llamar-390.mjs <clienteVolverALlamar.js> <carpeta de capturas> [styles.css]
// Con el tercer argumento sirve también esa hoja en lugar de la de producción; sin él, la de producción.
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { abrir } from './comun.mjs';

const local = process.argv[2] ? resolve(process.argv[2]) : null;
const capturas = process.argv[3] ? resolve(process.argv[3]) : null;
if (!local || !existsSync(local)) { console.log(`CIEGO: no existe ${local}`); console.log('EXIT=2'); process.exit(2); }
if (capturas) mkdirSync(capturas, { recursive: true });

const hoja = process.argv[4] ? resolve(process.argv[4]) : null;
if (hoja && !existsSync(hoja)) { console.log(`CIEGO: no existe ${hoja}`); console.log('EXIT=2'); process.exit(2); }
const RUTA = '/dashboard/js/clienteVolverALlamar.js';
const servir = { [RUTA]: local };
if (hoja) servir['/dashboard/css/styles.css'] = hoja;
const { browser, page, noGet, errores, build } = await abrir({ servir, viewport: { width: 390, height: 844 } });
console.log(`HOJA=${hoja ? `LOCAL ${hoja}` : 'la de producción'} · regla de la nota en la hoja cargada: ${await page.evaluate(() => [...document.styleSheets].some((h) => { try { return [...h.cssRules].some((r) => r.selectorText === '.volver-a-llamar-nota'); } catch { return false; } }))}`);
await page.addScriptTag({ url: RUTA });
const testigo = await page.evaluate(() => ({ pieza: typeof window.clienteVolverALlamar, montar: typeof window.clienteVolverALlamar?.montar, ancho: window.innerWidth }));
console.log(`SERVIDO=LOCAL ${local} · build del panel ${build} · TESTIGO=${JSON.stringify(testigo)}`);
if (testigo.montar !== 'function') { console.log('CIEGO: la pieza no se ha cargado'); await browser.close(); console.log('EXIT=2'); process.exit(2); }

// Un bloque propio dentro del contenedor de vistas, con la clase de tarjeta que ya usa la ficha.
await page.evaluate(() => {
  const vista = document.querySelector('#view-container');
  vista.innerHTML = '';
  const caja = document.createElement('div');
  caja.className = 'data-card';
  caja.id = 'sonda-volver-a-llamar';
  vista.appendChild(caja);
  window.__sonda = { guardar: [], hecho: 0, falla: false, estado: 'vencido' };
});
const montar = (llamada) => page.evaluate((l) => {
  const caja = document.querySelector('#sonda-volver-a-llamar');
  const s = window.__sonda;
  return window.clienteVolverALlamar.montar(caja, {
    llamada: l,
    guardar: (d) => { s.guardar.push(d); return s.falla ? Promise.reject(new Error('sonda')) : Promise.resolve({ dia: d.dia, nota: d.nota, estado: s.estado }); },
    hecho: () => { s.hecho += 1; return s.falla ? Promise.reject(new Error('sonda')) : Promise.resolve(); },
  });
}, llamada);

/** Lo que se ve y lo que mide, leído del DOM ya pintado. */
const medir = () => page.evaluate(() => {
  const caja = document.querySelector('#sonda-volver-a-llamar');
  const caj = (e) => { const r = e.getBoundingClientRect(); return { ancho: Math.round(r.width), alto: Math.round(r.height), izq: Math.round(r.left), der: Math.round(r.right) }; };
  const visibles = (sel) => [...caja.querySelectorAll(sel)].filter((e) => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0);
  return {
    titulo: visibles('.section-title').map((e) => e.textContent),
    parrafos: visibles('p').map((e) => e.textContent.length > 70 ? `${e.textContent.slice(0, 40)}… (${e.textContent.length} car.)` : e.textContent),
    rotulos: visibles('label').map((e) => `${e.textContent}→${e.htmlFor && document.getElementById(e.htmlFor) ? document.getElementById(e.htmlFor).tagName.toLowerCase() : 'SIN CAMPO'}`),
    botones: visibles('button').map((e) => ({ texto: e.textContent, apagado: e.disabled, ...caj(e) })),
    campos: visibles('input, textarea').map((e) => ({ tag: e.tagName.toLowerCase(), tipo: e.type, valor: e.value, ...caj(e) })),
    avisos: visibles('[role="alert"]').map((e) => e.textContent),
    caja: caj(caja),
    seSaleLaCaja: caja.scrollWidth > caja.clientWidth,
    seSaleLaPagina: document.documentElement.scrollWidth > window.innerWidth,
    hijoQueSeSale: [...caja.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > caja.getBoundingClientRect().right + 0.5).map((e) => e.tagName.toLowerCase()),
  };
});
const pulsar = (texto) => page.evaluate((t) => { const b = [...document.querySelectorAll('#sonda-volver-a-llamar button')].find((e) => e.textContent === t); if (b) b.click(); return !!b; }, texto);
const foto = async (nombre) => { if (capturas) await page.locator('#sonda-volver-a-llamar').screenshot({ path: join(capturas, nombre) }); };

const NOTA_LARGA = 'Quedó en mirar el presupuesto de la caldera con su hermano y contestar antes del puente; si no coge, probar por la tarde, que por la mañana trabaja. Supercalifragilisticoespialidosoconunapalabralarguisimaquenocabeenunalinea.';
const filas = [];
const apunta = async (que) => { const m = await medir(); filas.push({ que, ...m }); return m; };

await montar({ dia: null, nota: null, estado: null });
await apunta('sin fecha');
await montar({ dia: '2026-12-01', nota: 'Llamar por la tarde', estado: 'futuro' });
await apunta('con fecha, para más adelante');
await montar({ dia: '2026-10-13', nota: '', estado: 'hoy' });
await apunta('toca hoy, sin nota');
await montar({ dia: '2026-10-01', nota: NOTA_LARGA, estado: 'vencido' });
await apunta('vencida, con una nota larga y una palabra que no cabe');
await foto('1056b-390-vencida-nota-larga.png');

// El viaje: «Cambiar» → escribir → «Guardar» que FALLA → el aviso → «Guardar» que entra.
await pulsar('Cambiar');
await apunta('formulario, abierto con «Cambiar»');
await page.fill('#sonda-volver-a-llamar input[type="date"]', '2020-02-03');
await page.fill('#sonda-volver-a-llamar textarea', 'Quedó en mirarlo');
await page.evaluate(() => { window.__sonda.falla = true; });
await pulsar('Guardar');
await page.waitForTimeout(200);
await apunta('formulario, tras un «Guardar» que falla');
await foto('1056b-390-formulario-con-fallo.png');
await page.evaluate(() => { window.__sonda.falla = false; });
await pulsar('Guardar');
await page.waitForTimeout(200);
await apunta('tras guardar una fecha PASADA (el servidor de la sonda contesta «vencido»)');
await pulsar('Hecho');
await page.waitForTimeout(200);
await apunta('tras «Hecho»');
const visto = await page.evaluate(() => window.__sonda);

console.log('--- FILAS (ancho de ventana 390)');
let cortos = 0; let fuera = 0;
for (const f of filas) {
  console.log(`\n· ${f.que}`);
  console.log(`    título   : ${f.titulo.join(' · ') || 'NINGUNO'}`);
  console.log(`    se lee   : ${f.parrafos.map((p) => `«${p}»`).join(' ; ') || '—'}`);
  if (f.rotulos.length) console.log(`    rótulos  : ${f.rotulos.join(' ; ')}`);
  if (f.campos.length) console.log(`    campos   : ${f.campos.map((c) => `${c.tag}${c.tag === 'input' ? `[${c.tipo}]` : ''} ${c.ancho}×${c.alto} «${c.valor}»`).join(' ; ')}`);
  console.log(`    botones  : ${f.botones.map((b) => `«${b.texto}» ${b.ancho}×${b.alto}${b.apagado ? ' APAGADO' : ''}`).join(' ; ') || 'NINGUNO'}`);
  console.log(`    avisos   : ${f.avisos.map((a) => `«${a}»`).join(' ; ') || 'ninguno'}`);
  console.log(`    caja     : ${f.caja.ancho} de ancho (de ${f.caja.izq} a ${f.caja.der}) · se sale la caja: ${f.seSaleLaCaja} · se sale la página: ${f.seSaleLaPagina} · hijos que asoman: ${f.hijoQueSeSale.join(',') || 'ninguno'}`);
  cortos += f.botones.filter((b) => b.alto < 44).length + f.campos.filter((c) => c.alto < 44).length;
  if (f.seSaleLaCaja || f.seSaleLaPagina || f.hijoQueSeSale.length) fuera += 1;
}
console.log(`\nlo que recibió la sonda: guardar=${JSON.stringify(visto.guardar)} · hecho=${visto.hecho}`);
console.log(`peticiones que no son GET durante la sonda: ${noGet.length}`);
console.log(`errores de página: ${errores.join(' · ') || 'ninguno'}`);
console.log(`POBLACION=${filas.length} estados · controles de menos de 44 px de alto=${cortos} · estados con algo fuera de la caja=${fuera}`);
await browser.close();
console.log(`EXIT=${cortos || fuera || noGet.length || errores.length ? 1 : 0}`);
process.exit(cortos || fuera || noGet.length || errores.length ? 1 : 0);
