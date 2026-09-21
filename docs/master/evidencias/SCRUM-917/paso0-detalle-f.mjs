// SCRUM-917g · PASO 0 del corte F — ¿«El trabajo» sigue siendo cinco secciones sueltas HOY? (A2)
//
// Hermano de `paso0-detalle.mjs` (917e). No decide nada: cuenta, y dice sobre qué población contó.
// Lo que el corte F viene a arreglar (docs/prototipos/SCRUM-917/inventario-hoy.md, textos-propuestos.md
// y el com. 15994 de SCRUM-917):
//   · Tipo de trabajo · Datos · Quién ejecuta · Notas internas · Gastos: CINCO secciones sueltas, cada
//     una con su cabecera, que empiezan pasados los 900 px;
//   · «Incluir precios en el parte» es una casilla suelta en la barra de Documentos.
//
// Se mide en el navegador, sobre el DOM resuelto, con los MISMOS scripts que declara
// `public/dashboard/index.html` (scripts/_detalle-917.mjs). Un cero no es «está limpio»: lleva su
// testigo de ejecución (A21) y, además, un caso que SÍ debe tener cada cosa (control positivo).
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from '../../../../scripts/_navegador.mjs';
import { levantarBanco, pintarDetalle, CASOS_F } from '../../../../scripts/_detalle-917.mjs';

let suelo = 0;
const ANCHOS = [1280, 390];

console.log('# SCRUM-917g · PASO 0 — el detalle del Trabajo, las CINCO secciones sueltas, medido HOY');
console.log(`POBLACIÓN: ${CASOS_F.length} casos (${CASOS_F.map((c) => c.id).join(', ')}) × ${ANCHOS.length} anchuras (${ANCHOS.join(', ')}) · banco con equipo\n`);

// «Con equipo» para que la sección de quién ejecuta se pinte de verdad; sin equipo el banco antiguo
// contestaba `[]`, que la vista toma por «no se ha leído nada» y quita la sección.
const banco = await levantarBanco({ conEquipo: true });
const nav = await lanzarNavegador(puppeteer, { headless: 'new' });

for (const ancho of ANCHOS) {
  const page = await nav.newPage();
  await page.setViewport({ width: ancho, height: ancho === 390 ? 844 : 900 });
  await page.goto(banco.base, { waitUntil: 'networkidle0' });

  for (const caso of CASOS_F) {
    const testigo = await pintarDetalle(page, caso.id);
    if (!testigo.ok) {
      console.log(`  🟡 SUELO · Trabajo ${caso.id} a ${ancho}px NO se pintó (${testigo.por}) — no cuento nada de este caso`);
      suelo++;
      continue;
    }
    const m = await page.evaluate(() => {
      const c = document.getElementById('view');
      const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
      const abajo = (e) => Math.round(e.getBoundingClientRect().top + window.scrollY);
      const porTitulo = (t) => [...c.querySelectorAll('.detail-section')]
        .find((s) => { const h = s.querySelector('.detail-section-title'); return h && norm(h.textContent) === t; });
      const trozos = {
        tipo: porTitulo('Tipo de trabajo'),
        datos: porTitulo('Datos'),
        quien: c.querySelector('[data-seccion="asignados"]'),
        notas: c.querySelector('[data-seccion="notas"]'),
        gastos: c.querySelector('[data-seccion="gastos"]'),
      };
      const filas = Object.entries(trozos).map(([k, e]) => ({
        k, existe: !!e, y: e ? abajo(e) : null, alto: e ? Math.round(e.getBoundingClientRect().height) : null,
      }));
      const barra = c.querySelector('.job-doc-toolbar');
      const casillaPrecios = barra
        ? [...barra.querySelectorAll('label')].filter((l) => /Incluir precios en el parte/.test(l.textContent)).length
        : -1;
      return {
        filas,
        detalles: c.querySelectorAll('details').length,
        casillaPrecios,
        barraExiste: !!barra,
        altoPagina: Math.round(document.documentElement.scrollHeight),
        alto: window.innerHeight,
      };
    });
    const existen = m.filas.filter((f) => f.existe);
    const bajoElPliegue = existen.filter((f) => f.y > m.alto).length;
    const altoTotal = existen.reduce((s, f) => s + f.alto, 0);
    console.log(`Trabajo ${caso.id} a ${ancho}px · ${testigo.nodos} nodos`);
    console.log(`  secciones sueltas: ${existen.length} de 5 (${m.filas.map((f) => `${f.k}${f.existe ? '@' + f.y : '·NO'}`).join(' ')})`);
    console.log(`  bajo el pliegue (y > ${m.alto}): ${bajoElPliegue} de ${existen.length} · alto sumado de las secciones: ${altoTotal} px`);
    console.log(`  <details> en la pantalla: ${m.detalles} · casilla «Incluir precios en el parte» en la barra de Documentos: ${m.casillaPrecios}`);
  }
  await page.close();
}

await nav.close();
await banco.cerrar();
console.log(`\nSUELOS (casos no medidos): ${suelo}`);
process.exit(suelo ? 2 : 0);
