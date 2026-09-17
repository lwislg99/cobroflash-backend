// docs/master/evidencias/scrum907b/veredicto-en-staging.mjs — SCRUM-907b
//
// EL VEREDICTO DE SCRUM-907 EN STAGING, en navegador y contra la ficha de verdad.
//
//   node docs/master/evidencias/scrum907b/veredicto-en-staging.mjs
//
// Qué contesta: ¿la ficha de un Trabajo con cobro de MÁS pinta los dos avisos?
//   · el de «Qué falta para cobrar»   → `.cobro-aviso`
//   · el del bloque «Dinero» del rail → `.detail-rail-linea--aviso`
//
// NO ESCRIBE NADA: los tres sujetos ya existían en staging y esta sonda sólo los mira. Regla 9: no
// imprime ninguna URL ni ningún secreto, sólo el hash de la vista y lo leído en pantalla.
//
// ── POR QUÉ HAY TRES SUJETOS Y NO UNO ────────────────────────────────────────────────────────
// Si la sonda no supiera encontrar el aviso, el 3102 saldría «sin aviso» exactamente igual que un
// 3100 sano, y los dos ceros se leerían igual. Con los tres, una sonda muda se delata porque salen
// TODOS iguales. Es la otra mitad de A21: el caso que tiene que salir verde es el único que puede
// destapar un banco que no mide.
//
// ── SUELO ────────────────────────────────────────────────────────────────────────────────────
// Si la ficha no se pinta, sale con 2 (NO SUPE MEDIR), que NO es «no avisa». Salidas: 0 de acuerdo,
// 1 hallazgo, 2 ciego.
//
// ⚠️ Los ids son de la base de staging del 17-sep-2026. Si cambian, se vuelven a sacar con
// `buscar-casos-cobrado-de-mas.mjs`, que está al lado: no se escriben a mano.
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from '../../../../scripts/_navegador.mjs';
import { BASE, sesionQA } from '../../../../tests/banco-scrum911/_entorno.mjs';

const SUJETOS = [
  { id: 3102, espera: 'AVISO', nota: 'aceptado 539,05 · cobrado 628,60 · exceso 89,55' },
  { id: 3100, espera: 'SIN AVISO', nota: 'aceptado 243,14 · cobrado 243,14 (cuadrado)' },
  { id: 3103, espera: 'SIN AVISO', nota: 'aceptado 970,23 · cobrado 291,07 (falta por cobrar)' },
];
const ANCHOS = [1280, 390];

// Lo que corre DENTRO de la página, en cadena (censo de SCRUM-258).
const LEER = new Function(`
  var t = function (s) { var e = document.querySelector(s); return e ? e.textContent.replace(/\\s+/g, ' ').trim() : null; };
  var todos = function (s) { return Array.prototype.map.call(document.querySelectorAll(s), function (e) { return e.textContent.replace(/\\s+/g, ' ').trim(); }); };
  return {
    // ¿estamos de verdad en la ficha? Sin esto, una pantalla vacía daría «sin aviso» y parecería sana.
    hayFicha: !!document.querySelector('.detail-page'),
    faltaPorCobrar: t('.cobro-linea--total .cobro-linea__importe'),
    avisoSeccion: t('.cobro-aviso'),
    avisoRail: t('.detail-rail-linea--aviso'),
    lineasRail: todos('.detail-rail-linea')
  };
`);

const { cookie } = await sesionQA();
const [ckNombre, ...resto] = cookie.split('=');
const ckValor = resto.join('=');
const dominio = new URL(BASE).hostname;

const filas = [];
const navegador = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
try {
  for (const ancho of ANCHOS) {
    for (const s of SUJETOS) {
      // Un contexto POR MEDICIÓN: el panel guarda cosas en `localStorage` y lo de un sujeto se
      // arrastraría al siguiente.
      const contexto = await navegador.createBrowserContext();
      const pag = await contexto.newPage();
      const errores = [];
      pag.on('pageerror', (e) => errores.push(String(e.message || e)));
      try {
        await pag.setViewport({ width: ancho, height: 1000, isMobile: ancho < 800, hasTouch: ancho < 800 });
        await contexto.setCookie({ name: ckNombre, value: ckValor, domain: dominio, path: '/', secure: true });
        await pag.goto(`${BASE}/dashboard/index.html#jobs-detail/${s.id}`, { waitUntil: 'networkidle0', timeout: 45000 });
        const pintada = await pag.waitForSelector('.detail-page', { timeout: 20000 }).then(() => true, () => false);
        if (!pintada) { filas.push({ ancho, s, ciego: `la ficha no se pintó (errores: ${errores.join(' | ') || 'ninguno'})` }); continue; }
        await new Promise((ok) => setTimeout(ok, 1500));
        filas.push({ ancho, s, r: await pag.evaluate(LEER), errores });
      } finally { await contexto.close(); }
    }
  }
} finally { await navegador.close(); }

console.log('');
console.log('  SCRUM-907 · VEREDICTO EN STAGING — «Has cobrado {importe} más de lo aceptado.»');
console.log(`  POBLACIÓN: ${SUJETOS.length} Trabajos × ${ANCHOS.length} anchos = ${SUJETOS.length * ANCHOS.length} mediciones`);
console.log('  ' + '─'.repeat(104));
let mal = 0, ciegos = 0;
for (const f of filas) {
  const cab = `  ${String(f.ancho).padStart(4)}px · job ${f.s.id} (${f.s.nota}) · se espera ${f.s.espera}`;
  if (f.ciego) { console.log(`${cab}\n        🔴 CIEGO: ${f.ciego}`); ciegos++; continue; }
  const r = f.r;
  const hay = !!(r.avisoSeccion || r.avisoRail);
  // Para el sujeto con exceso se exigen LOS DOS avisos, no «alguno»: el defecto estaba en dos
  // piezas distintas y arreglar una sola habría dado un verde a medias.
  const acierta = f.s.espera === 'AVISO' ? (!!r.avisoSeccion && !!r.avisoRail) : !hay;
  if (!acierta) mal++;
  console.log(cab);
  console.log(`        sección: falta por cobrar = ${r.faltaPorCobrar ?? '—'}  ·  aviso = ${r.avisoSeccion ? '«' + r.avisoSeccion + '»' : 'ninguno'}`);
  console.log(`        rail:    aviso = ${r.avisoRail ? '«' + r.avisoRail + '»' : 'ninguno'}  ·  líneas del rail: ${r.lineasRail.length}`);
  console.log(`        → ${acierta ? '✔ de acuerdo' : '🔴 NO COINCIDE con lo esperado'}`);
  if (f.errores.length) console.log(`        errores de página: ${f.errores.join(' | ')}`);
}
console.log('  ' + '─'.repeat(104));
if (ciegos) { console.error(`\n  🔴 NO SUPE MEDIR en ${ciegos} de ${filas.length}. Esto NO es un veredicto.\n`); process.exit(2); }
if (mal) { console.error(`\n  🔴 ${mal} de ${filas.length} mediciones NO dicen lo que tenían que decir.\n`); process.exit(1); }
console.log(`\n  ✔ las ${filas.length} mediciones de acuerdo: avisa donde hay exceso y calla donde no lo hay.\n`);
