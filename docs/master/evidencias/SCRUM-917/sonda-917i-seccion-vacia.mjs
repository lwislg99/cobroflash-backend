// SCRUM-917 · ¿La ficha del Trabajo cuelga alguna sección SIN NADA DENTRO?
// Sobre yaqu.app, cuenta QA. Sólo GET (control positivo del interceptor en comun.mjs).
//
//   node seccion-vacia.mjs            → lo que sirve producción
//   node seccion-vacia.mjs <carpeta>  → sirve <carpeta>/jobDetailView.js en su lugar
//
// Tres casos por ancho, y los tres tienen que pintar tres pantallas DISTINTAS (c.15994):
//   SIN  · el Trabajo como lo devuelve producción, que tiene que venir sin importe (totalAceptado null)
//   CON  · el mismo, con `totalAceptado: 500, totalCobrado: 200` puestos POR LA SONDA en la respuesta
//   CERO · el mismo, con `totalAceptado: 0, totalCobrado: 0` puestos POR LA SONDA (SCRUM-651: consta)
// En CON y CERO los DATOS no son de producción; la vista que los pinta, sí.
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { abrir } from './comun.mjs';

const carpeta = process.argv[2] && process.argv[2] !== '-' ? resolve(process.argv[2]) : null;
const servir = {};
if (carpeta) {
  const ruta = join(carpeta, 'jobDetailView.js');
  if (!existsSync(ruta)) { console.log(`CIEGO: no existe ${ruta}`); console.log('EXIT=2'); process.exit(2); }
  servir['/dashboard/js/jobDetailView.js'] = ruta;
}

const CASOS = [
  ['SIN', null],
  ['CON', { totalAceptado: 500, totalCobrado: 200 }],
  ['CERO', { totalAceptado: 0, totalCobrado: 0 }],
];
const ANCHOS = [{ width: 1280, height: 900 }, { width: 390, height: 844 }];
const filas = [];
let vaciasTotal = 0;
let ciego = null;

for (const viewport of ANCHOS) {
  const { browser, page, noGet, errores, build } = await abrir({ servir, viewport });
  console.log(`ANCHO=${viewport.width} · SERVIDO=${carpeta ? `LOCAL ${carpeta} (jobDetailView.js)` : 'lo de producción'} · build ${build}`);

  // TESTIGO de que lo servido es lo que se ejecuta: dónde se cuelga el resumen en el fuente que corre.
  const testigo = await page.evaluate(() => {
    const f = String(renderJobDetailView);
    const cuelga = f.indexOf('body.appendChild(sumSec)');
    const guarda = f.indexOf('if (job.totalAceptado != null)');
    return { cuelga: cuelga >= 0, guarda: guarda >= 0, cuelgaDentroDeLaGuarda: cuelga > guarda && guarda >= 0 };
  });
  console.log(`TESTIGO=${JSON.stringify(testigo)}`);
  if (!testigo.cuelga || !testigo.guarda) ciego = 'el fuente que corre no tiene ni el montaje del resumen ni su guarda: la sonda mira otra pantalla';

  const lista = await page.evaluate(async () => { const r = await apiRequest('/admin/jobs'); return Array.isArray(r) ? r : (r.jobs || r.items || r.data || []); });
  const sinImporte = lista.filter((j) => j.totalAceptado == null);
  console.log(`POBLACION=${lista.length} Trabajos en la cuenta · ${sinImporte.length} sin importe (totalAceptado null)`);
  if (!sinImporte.length) { ciego = 'no hay ningún Trabajo sin importe en la cuenta'; await browser.close(); break; }
  const id = sinImporte[0].id;
  console.log(`TRABAJO=${id}`);

  for (const [nombre, parche] of CASOS) {
    let tocadas = 0;
    const casa = (url) => new URL(url).pathname === `/admin/jobs/${id}`;
    const h = async (route) => {
      if (route.request().method() !== 'GET' || !parche) return route.fallback();
      const r = await route.fetch();
      const cuerpo = await r.json();
      // El Trabajo puede venir a pelo o envuelto: se parchea donde esté `totalAceptado`.
      const diana = ('totalAceptado' in cuerpo) ? cuerpo : (cuerpo.job && 'totalAceptado' in cuerpo.job ? cuerpo.job : null);
      if (!diana) return route.fulfill({ response: r });
      Object.assign(diana, parche); tocadas++;
      return route.fulfill({ response: r, json: cuerpo });
    };
    await page.route(casa, h);
    await page.evaluate((i) => { window.appState = window.appState || {}; window.appState.jobId = i; renderAppView('jobs-detail'); }, id);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => {
      const pagina = document.querySelector('.detail-page');
      if (!pagina) return null;
      const CON_ALGO = 'img,svg,input,button,select,textarea,canvas,a';
      const secciones = [...pagina.querySelectorAll('.detail-section')].map((s) => {
        const caja = s.getBoundingClientRect();
        const visible = caja.height > 0 && getComputedStyle(s).display !== 'none';
        const texto = (s.textContent || '').replace(/\s+/g, ' ').trim();
        return {
          alto: Math.round(caja.height * 10) / 10,
          visible,
          vacia: visible && texto === '' && !s.querySelector(CON_ALGO),
          texto: texto.slice(0, 44),
          html: texto === '' ? s.outerHTML.slice(0, 120) : null,
        };
      });
      const franja = pagina.querySelector('.detail-dinero');
      return {
        titulo: pagina.querySelector('.detail-head h2')?.textContent ?? null,
        secciones,
        franja: franja ? franja.textContent.replace(/\s+/g, ' ').trim() : null,
        barra: !!pagina.querySelector('.detail-dinero__barra'),
        desborde: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    await page.unroute(casa, h);
    if (!m) { ciego = `caso ${nombre} a ${viewport.width}: la ficha no se montó`; continue; }
    if (parche && tocadas === 0) ciego = `caso ${nombre} a ${viewport.width}: la sonda no llegó a parchear la respuesta`;
    const visibles = m.secciones.filter((s) => s.visible);
    const vacias = visibles.filter((s) => s.vacia);
    vaciasTotal += vacias.length;
    filas.push({ ancho: viewport.width, caso: nombre, titulo: m.titulo, secciones: visibles.length, vacias: vacias.length, altos: vacias.map((s) => s.alto).join(',') || '-', franja: m.franja, barra: m.barra, desborde: m.desborde, parcheadas: tocadas });
    for (const s of vacias) console.log(`  VACIA @${viewport.width} ${nombre}: ${s.alto} px · ${s.html}`);
    console.log(`  @${viewport.width} ${nombre}: ${visibles.map((s) => `[${s.alto} «${s.texto.slice(0, 22)}»]`).join(' ')}`);
  }
  console.log(`no-GET @${viewport.width}: ${noGet.map((n) => `${n.metodo} ${n.ruta} → ${n.hecho}`).join(' · ') || 'ninguna'}`);
  console.log(`errores de página @${viewport.width}: ${errores.join(' · ') || 'ninguno'}`);
  await browser.close();
}

console.log('--- FILAS (ancho | caso | título | secciones visibles | VACÍAS | alto de las vacías | franja del dinero | barra | desborde px | respuestas parcheadas)');
for (const f of filas) console.log(`${f.ancho} | ${f.caso} | «${f.titulo}» | ${f.secciones} | ${f.vacias} | ${f.altos} | ${f.franja ? `«${f.franja}»` : 'no hay'} | ${f.barra ? 'sí' : 'no'} | ${f.desborde} | ${f.parcheadas}`);

// DISCRIMINACIÓN: los tres casos de un mismo ancho tienen que dar tres franjas distintas.
for (const a of ANCHOS.map((v) => v.width)) {
  const franjas = filas.filter((f) => f.ancho === a).map((f) => String(f.franja));
  if (franjas.length === CASOS.length && new Set(franjas).size !== CASOS.length) ciego = `a ${a} los tres casos no pintan tres franjas distintas: ${JSON.stringify(franjas)}`;
}
if (filas.length !== CASOS.length * ANCHOS.length && !ciego) ciego = `se esperaban ${CASOS.length * ANCHOS.length} filas y hay ${filas.length}`;

console.log(`POBLACION_MEDIDA=${filas.length} pantallas · SECCIONES_VACIAS=${vaciasTotal}`);
if (ciego) { console.log(`CIEGO: ${ciego}`); console.log('EXIT=2'); process.exit(2); }
console.log(`EXIT=${vaciasTotal ? 1 : 0}`);
process.exit(vaciasTotal ? 1 : 0);
