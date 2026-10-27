// SCRUM-1150b · ¿Qué LEE el profesional cuando «Crear revisión» falla, por cada código del servidor?
// Sobre yaqu.app, cuenta QA, presupuesto 206. NO ESCRIBE: el POST /admin/quotes/:id/revisiones lo
// contesta la sonda (control positivo del interceptor en comun.mjs); a producción sólo llegan GET.
// A cada código se le pone SIEMPRE un `message`: el firmado donde toca y un diagnóstico de
// programador en los demás, para ver si llega a la pantalla.
//
//   node revision-error.mjs                       → el quoteRevisiones.js de producción
//   node revision-error.mjs <quoteRevisiones.js>  → sirve ese fichero en su lugar
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { abrir } from './comun.mjs';

const local = process.argv[2] && process.argv[2] !== '-' ? resolve(process.argv[2]) : null;
if (local && !existsSync(local)) { console.log(`CIEGO: no existe ${local}`); console.log('EXIT=2'); process.exit(2); }
const QUOTE = Number(process.env.QUOTE || 206);
const L2R = 'No se puede crear una revisión: este presupuesto tiene un descuento global y varios tipos de IVA. Duplícalo, pon el descuento en cada línea y envíaselo al cliente para que lo firme.';
const DIAG = 'DOS VIGENTES A LA VEZ: 2004226.1 (revisión 1) y 2004226.1 (revisión 1). «Cuál está vigente» con dos respuestas no es una respuesta. Elegir una de las dos aquí sería peor que fallar: la pantalla enseñaría una y el PDF podría enseñar la otra.';
const CASOS = [
  [409, 'quote_sin_numero', DIAG], [404, 'quote_not_found', DIAG], [400, 'descuento_global_con_varios_iva', L2R],
  [409, 'revisiones_dos_vigentes', DIAG], [409, 'revisiones_sin_leer', DIAG], [409, 'revision_no_posterior', DIAG],
  [409, 'revisiones_sin_la_propia', DIAG], [400, 'invalid_quote_id', DIAG], [500, 'internal_error', DIAG],
  [409, 'un_codigo_que_nace_manana', DIAG],
];
const VENTANAS = [{ width: 390, height: 844 }, { width: 1280, height: 800 }];

let cola = [];
const filas = [];
let builds = new Set();
for (const viewport of VENTANAS) {
  const { browser, page, noGet, errores, build } = await abrir({
    servir: local ? { '/dashboard/js/quoteRevisiones.js': local } : {},
    viewport,
    respuestas: (metodo, ruta) => {
      if (metodo !== 'POST' || !/^\/admin\/quotes\/\d+\/revisiones$/.test(ruta)) return null;
      const r = cola.shift();
      return r ? { status: r[0], body: { error: r[1], message: r[2] } } : null;
    },
  });
  builds.add(build);
  const abrirFicha = async () => {
    await page.evaluate(() => renderAppView('home'));
    await page.waitForTimeout(300);
    await page.evaluate((id) => { location.hash = `#quotes-detail/${id}`; }, QUOTE);
    await page.waitForSelector('[data-revision-crear]', { state: 'attached', timeout: 15000 });
    await page.waitForTimeout(400);
  };
  const leer = () => page.evaluate(() => [...document.querySelectorAll('[data-revision-error]')].map((a) => {
    const r = a.getBoundingClientRect();
    const alto = parseFloat(getComputedStyle(a).lineHeight) || 20;
    return { texto: a.textContent, role: a.getAttribute('role'), ancho: Math.round(r.width), altoPx: Math.round(r.height), lineas: Math.round(r.height / alto), enVentana: r.top >= 0 && r.bottom <= innerHeight, desborda: a.scrollWidth > a.clientWidth + 1 };
  }));
  const pulsar = async () => {
    await page.evaluate(() => { const b = document.querySelector('[data-revision-crear]'); b.scrollIntoView({ block: 'center' }); b.click(); });
    await page.waitForTimeout(500);
  };
  for (const c of CASOS) {
    await abrirFicha();
    noGet.length = 0; cola = [c];
    await pulsar();
    filas.push({ ventana: `${viewport.width}×${viewport.height}`, que: `${c[0]} ${c[1]}`, posts: noGet.filter((n) => n.metodo === 'POST').length, avisos: await leer() });
  }
  // DOS FALLOS SEGUIDOS en la misma ficha.
  await abrirFicha();
  noGet.length = 0; cola = [[409, 'quote_sin_numero', DIAG], [404, 'quote_not_found', DIAG]];
  await pulsar(); await pulsar();
  filas.push({ ventana: `${viewport.width}×${viewport.height}`, que: 'DOS FALLOS SEGUIDOS (sin número, luego no existe)', posts: noGet.filter((n) => n.metodo === 'POST').length, avisos: await leer() });
  if (errores.length) console.log(`errores de página (${viewport.width}): ${errores.join(' · ')}`);
  await browser.close();
}
console.log(`SERVIDO=${local ? `LOCAL ${local}` : 'el quoteRevisiones.js de producción'} · build del panel ${[...builds].join(',')} · presupuesto ${QUOTE}`);
console.log('--- FILAS (ventana | lo que contesta la sonda | POST vistos | avisos | role | líneas · caja | ¿entero en la ventana? | lo que se LEE)');
let rotas = 0;
for (const f of filas) {
  if (!f.avisos.length || !f.posts) { rotas += 1; console.log(`${f.ventana} | ${f.que} | POST=${f.posts} | CIEGO: no hay aviso`); continue; }
  const a = f.avisos.at(-1);
  console.log(`${f.ventana} | ${f.que} | POST=${f.posts} | avisos=${f.avisos.length} | role=${a.role} | ${a.lineas} líneas · ${a.ancho}×${a.altoPx} | ${a.enVentana ? 'sí' : 'NO'}${a.desborda ? ' · DESBORDA' : ''} | «${a.texto.length > 110 ? `${a.texto.slice(0, 110)}… (${a.texto.length} car.)` : a.texto}»`);
}
console.log(`POBLACION=${filas.length} filas · rotas=${rotas}`);
console.log(`EXIT=${rotas ? 1 : 0}`);
process.exit(rotas ? 1 : 0);
