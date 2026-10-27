// Banco (sólo lectura) de los controles cortos de Configuración que el tramo 962b de SCRUM-962 dio a J3.
// Reusa el instrumento de 962b: `scripts/_banco-lista.mjs` (vista VIVA con los scripts del índice) y el
// árbitro `__areaDeToque` de `scripts/_medidor-de-toque.mjs`. Pulsa cada pestaña con un clic real.
//
// Uso: node banco-44.mjs <raiz del repo> <carpeta public a servir> [<salida.json>]
//   · <raiz>    de dónde se importan los instrumentos (siempre el árbol de trabajo);
//   · <public>  qué pantalla se mide: la del árbol (DESPUÉS) o una copia de origin/main (ANTES).
//
// Vara: la de DESIGN.md §5, `minimoPara(ancho)` (44 hasta 768, 36 por encima). Se imprime también si
// llega a 44, porque los `select` y el color se dejan a 44 en todas las anchuras (como `fCriterioCaja`).
//
// CONTROL POSITIVO SEMBRADO (no prestado del árbol): en cada pestaña medida se inyecta un `<select>` de
// 20 px. Si el árbitro no lo da corto, la fila es CIEGA y el banco sale 2. Un rojo real sale 1; verde, 0.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(process.argv[2]);
const PUBLICO = path.resolve(process.argv[3]);
const imp = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);
const puppeteer = (await import(pathToFileURL(createRequire(path.join(RAIZ, 'package.json')).resolve('puppeteer-core')).href)).default;
const { servirListas, abrirNavegador, abrirVista } = await imp('scripts/_banco-lista.mjs');
const { FUENTE_MEDIDOR, minimoPara } = await imp('scripts/_medidor-de-toque.mjs');

// Comercio completo (como 962b) + dos cláusulas, para que se pinten los «Quitar» de cada fila.
const DATOS = `(ruta) => {
  if (/\\/admin\\/merchant$/.test(ruta)) return { id: 1, name: 'Fontanería Soler', country: 'ES', currency: 'EUR', slug: 'fontaneria-soler', publicProfileEnabled: true, profileZones: ['Valencia'], slugChangedAt: null,
    clausulasPresupuesto: [{ id: 'a', titulo: 'Garantía', texto: 'Seis meses.' }, { id: 'b', titulo: 'Plazo', texto: 'Diez días.' }] };
  if (/\\/admin\\/team/.test(ruta)) return [];
  return [];
}`;

// Los objetivos: pestaña → [nombre, selector]. Todos los que tienen que aparecer; si falta uno, CIEGO.
const OBJETIVOS = {
  facturacion: [
    ['select Retención de IRPF', '#retencion-irpf-tipo'],
    ['select ¿Qué tipo de actividad tienes?', '#actividad-tipo'],
    ['button Añadir condición', '#clausulas-anadir'],
    ['button Quitar (fila 1 de cláusulas)', '[data-clausula-quitar="0"]'],
  ],
  marca: [['input[color] color de marca', '#brand-color-input']],
  // SCRUM-1577c: el enlace de «Tu página pública», por su destino (no por su clase, que el ANTES no tiene).
  publica: [['a enlace yaqu.app/p/… (Tu página pública)', '.alert.success a[href^="/p/"]']],
};
const SONDA = '<select id="__sonda44" style="height:20px;min-height:0;padding:0;font-size:10px"><option>x</option></select>';

const MEDIR = `(async (OBJ, SONDA) => {
  // La sonda va PEGADA al primer objetivo de la pestaña: así comparte su contenedor pintado.
  const ancla = document.querySelector(OBJ[0][1]);
  if (ancla) ancla.insertAdjacentHTML('beforebegin', SONDA);
  const sonda = document.getElementById('__sonda44');
  const ms = sonda ? await window.__areaDeToque(sonda, 'select', { scroll: true }) : { error: 'NO SE PUDO SEMBRAR' };
  if (sonda) sonda.remove();
  const out = [];
  for (const [nombre, sel] of OBJ) {
    const el = document.querySelector(sel);
    if (!el) { out.push({ nombre, falta: true }); continue; }
    const r = el.getBoundingClientRect();
    const m = await window.__areaDeToque(el, sel, { scroll: true });
    out.push({ nombre, caja: +r.height.toFixed(1), anchoCaja: +r.width.toFixed(1), tocable: m.tocable ?? null, error: m.error || null, cls: el.className || '' });
  }
  return { sonda: ms.tocable ?? null, sondaError: ms.error || null, sondaCaja: ms.caja ?? null, out };
})`;

const ANCHOS = [320, 390, 929];
const { srv, puerto } = await servirListas(PUBLICO, [{ ruta: '/conf', fnVista: 'renderSettingsView', datos: DATOS, modoEmision: 'fiscal' }]);
const { browser } = await abrirNavegador(puppeteer);
const filas = [];
let ciego = 0, rojo = 0;
for (const ancho of ANCHOS) {
  const { page, errores } = await abrirVista(browser, puerto, '/conf', ancho);
  for (const [pestana, obj] of Object.entries(OBJETIVOS)) {
    await page.click(`.settings-nav [data-submenu="${pestana}"]`);
    await new Promise((ok) => setTimeout(ok, 150));
    const r = await page.evaluate(`${FUENTE_MEDIDOR};${MEDIR}(${JSON.stringify(obj)}, ${JSON.stringify(SONDA)})`);
    const sondaVe = r.sonda !== null && r.sonda < 44;
    if (!sondaVe) { ciego++; console.log(`sonda CIEGA @${ancho} ${pestana}: caja ${r.sondaCaja} · ${r.sondaError}`); }
    for (const o of r.out) {
      const min = minimoPara(ancho);
      const veredicto = !sondaVe || o.falta || o.tocable === null ? 'CIEGO' : o.tocable >= min ? 'VERDE' : 'ROJO';
      if (veredicto === 'CIEGO') ciego++; else if (veredicto === 'ROJO') rojo++;
      filas.push({ ancho, pestana, sonda: r.sonda, minimo: min, veredicto, a44: o.tocable >= 44, ...o });
    }
  }
  if (errores && errores.length) console.log(`errores de página @${ancho}:`, JSON.stringify(errores).slice(0, 300));
  await page.close();
}
await browser.close();
srv.close();
if (process.argv[4]) fs.writeFileSync(process.argv[4], JSON.stringify(filas, null, 1));
console.log(`público medido: ${PUBLICO}`);
console.log('| ancho | control | caja (alto×ancho) | toque | mínimo §5 | ¿≥44? | sonda sembrada | veredicto |');
console.log('|---|---|---|---|---|---|---|---|');
for (const f of filas) console.log(`| ${f.ancho} | ${f.nombre} | ${f.falta ? '—' : f.caja + "×" + f.anchoCaja} | ${f.tocable ?? '—'} | ${f.minimo} | ${f.a44 ? 'sí' : 'no'} | ${f.sonda} | ${f.veredicto} |`);
const total = filas.length;
console.log(`\npoblación: ${total} mediciones (${Object.values(OBJETIVOS).flat().length} controles × ${ANCHOS.length} anchos) · ROJO ${rojo} · CIEGO ${ciego} · VERDE ${total - rojo - filas.filter((f) => f.veredicto === 'CIEGO').length}`);
process.exit(ciego ? 2 : rojo ? 1 : 0);
