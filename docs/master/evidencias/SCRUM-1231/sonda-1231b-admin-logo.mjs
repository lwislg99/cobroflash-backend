// SCRUM-1231 · ¿Qué pasa en yaqu.app/admin.html con el campo «Logo (URL opcional)»?
// Cuenta QA. Casos: (URL) se pega una URL externa y se guarda · (NADA) se guarda sin tocar nada.
//
//   node admin-logo.mjs                 → el admin.html de producción
//   node admin-logo.mjs <admin.html>    → sirve ese fichero en su lugar
//
// LOS PUT DE LA PÁGINA NO SALEN NUNCA. La sonda pasa el cuerpo que la página iba a mandar por el
// MISMO esquema que el servidor (`dist/core/validation/schemas.js`, env DIST) con la misma lógica
// de `app.ts` (un logo idéntico al guardado no se valida) y contesta ella con ese veredicto.
//
// RELLENA=1 · antes de guardar, la sonda escribe un valor de pega en los campos que la cuenta QA
//   tiene vacíos (el servidor rechaza cada cadena vacía), para que lo ÚNICO que decida sea el logo.
// REAL=1 · aparte de la página, TRES PUT directos al servidor de verdad, de una sola clave:
//   `{logoUrl: ''}` y `{logoUrl: 'https://example.com/logo.png'}`, que sólo salen si el esquema dice
//   400 (un 400 no escribe nada), y `{}` como control positivo (no cambia ningún campo): si los tres
//   dieran 400, el servidor estaría rechazando todo y los dos primeros no dirían nada del logo.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { abrir, BASE } from './comun.mjs';

const local = process.argv[2] && process.argv[2] !== '-' ? resolve(process.argv[2]) : null;
if (local && !existsSync(local)) { console.log(`CIEGO: no existe ${local}`); console.log('EXIT=2'); process.exit(2); }
const dist = process.env.DIST ? resolve(process.env.DIST) : null;
if (!dist || !existsSync(dist)) { console.log('CIEGO: falta DIST=<…/dist/core/validation/schemas.js>'); console.log('EXIT=2'); process.exit(2); }
const { merchantProfileUpdateSchema, sinLogoHeredadoIntacto } = await import(pathToFileURL(dist).href);
const REAL = process.env.REAL === '1';

// CONTROL del esquema cargado: una URL externa cae y una imagen subida pasa. Si no, la puerta no vale.
const cae = !merchantProfileUpdateSchema.safeParse({ logoUrl: 'https://example.com/logo.png' }).success;
const pasa = merchantProfileUpdateSchema.safeParse({ logoUrl: 'data:image/png;base64,AAAA' }).success;
console.log(`ESQUEMA=${dist} · control: URL externa ${cae ? 'cae' : 'PASA'} · imagen subida ${pasa ? 'pasa' : 'CAE'}`);
if (!cae || !pasa) { console.log('CIEGO: el esquema cargado no distingue una URL de una imagen subida'); console.log('EXIT=2'); process.exit(2); }

const { browser, page, errores, build } = await abrir();
console.log(`SERVIDO=${local ? `LOCAL ${local}` : 'el admin.html de producción'} · build del panel ${build} · REAL=${REAL ? '1 (tres PUT directos de una clave, al final)' : '0 (nada sale)'} · RELLENA=${process.env.RELLENA === '1' ? '1' : '0'}`);
if (local) await page.route((url) => new URL(url).pathname === '/admin.html', (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: readFileSync(local, 'utf8') }));

const puts = [];
await page.route((url) => new URL(url).pathname === '/admin/merchant', async (route) => {
  const req = route.request();
  if (req.method() !== 'PUT') return route.fallback();
  const cuerpo = req.postDataJSON();
  const guardado = await page.evaluate(() => (window.currentMerchantDeLaSonda ?? null));
  let v = merchantProfileUpdateSchema.safeParse(cuerpo);
  if (!v.success && v.error.issues.some((i) => i.path[0] === 'logoUrl')) v = merchantProfileUpdateSchema.safeParse(sinLogoHeredadoIntacto(cuerpo, guardado && guardado.logoUrl));
  const campos = v.success ? [] : [...new Set(v.error.issues.map((i) => String(i.path[0])))];
  const apunte = { claves: Object.keys(cuerpo), logoUrl: 'logoUrl' in cuerpo ? (cuerpo.logoUrl === '' ? '«» (cadena vacía)' : `${String(cuerpo.logoUrl).slice(0, 32)}${String(cuerpo.logoUrl).length > 32 ? '…' : ''} (${String(cuerpo.logoUrl).length} car.)`) : 'NO VIAJA', esquema: v.success ? 'lo aceptaría' : `400 por ${campos.join(', ')}` };
  puts.push(apunte);
  apunte.hecho = `NO salió · contestado por la sonda (${v.success ? 200 : 400})`;
  if (v.success) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...(guardado || {}), ...cuerpo }) });
  return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'validation_error' }) });
});

async function cargar() {
  await page.goto(`${BASE}/admin.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /cargado|Error/.test(document.querySelector('#merchant-status span')?.textContent || ''), null, { timeout: 15000 });
  // Lo que hay guardado, para la puerta: se lee del GET que hizo la propia página. NO se imprime.
  await page.evaluate(() => { window.currentMerchantDeLaSonda = currentMerchant; });
  return page.evaluate(() => {
    const campo = document.getElementById('merchant-logoUrl');
    const logo = currentMerchant && currentMerchant.logoUrl;
    const vacios = ['name', 'legalName', 'taxId', 'address', 'invoiceSeriesPrefix', 'whatsappPhone'].filter((k) => !(document.getElementById('merchant-' + k)?.value || '').trim());
    return {
      estado: document.querySelector('#merchant-status span')?.textContent,
      hayCampo: !!campo,
      etiqueta: campo ? document.querySelector('label[for="merchant-logoUrl"]')?.textContent : null,
      marcador: campo ? campo.getAttribute('placeholder') : null,
      valorCampo: campo ? campo.value.length : null,
      logoGuardado: logo == null ? 'ninguno (null)' : (/^data:image\//.test(logo) ? `imagen subida (${logo.length} car.)` : (/^https?:/.test(logo) ? 'URL EXTERNA' : 'otra cosa')),
      vacios,
      controlesDelFormulario: document.querySelectorAll('#merchant-form input, #merchant-form select').length,
    };
  });
}

const RELLENA = process.env.RELLENA === '1';
async function guardar() {
  const antes = puts.length;
  if (RELLENA) {
    const rellenados = await page.evaluate(() => {
      const pega = { legalName: 'Sonda QA SL', taxId: 'B00000000', address: 'Calle de la Sonda 1', invoiceSeriesPrefix: 'QA', whatsappPhone: '34600000000', name: 'Sonda QA' };
      const hechos = [];
      for (const [k, v] of Object.entries(pega)) { const el = document.getElementById('merchant-' + k); if (el && !el.value.trim()) { el.value = v; hechos.push(k); } }
      return hechos;
    });
    console.log(`  RELLENADOS POR LA SONDA (no salen de la página): ${rellenados.join(', ') || 'ninguno'}`);
  }
  await page.click('#btn-save-merchant');
  await page.waitForFunction(() => !/Guardando/.test(document.querySelector('#merchant-status span')?.textContent || ''), null, { timeout: 15000 });
  await page.waitForTimeout(300);
  const visto = await page.evaluate(() => ({ texto: document.querySelector('#merchant-status span')?.textContent, clase: document.getElementById('merchant-status').className }));
  return { ...visto, put: puts.length > antes ? puts[puts.length - 1] : null };
}

const filas = [];
let c = await cargar();
console.log(`AL CARGAR=${JSON.stringify(c)}`);
if (!/cargado/.test(c.estado || '')) { console.log('CIEGO: admin.html no cargó el perfil'); console.log('EXIT=2'); await browser.close(); process.exit(2); }

if (c.hayCampo) {
  await page.fill('#merchant-logoUrl', 'https://example.com/logo.png');
  filas.push(['URL · se pega https://example.com/logo.png y se guarda', await guardar()]);
  c = await cargar();
}
filas.push(['NADA · se guarda sin tocar nada', await guardar()]);

console.log('--- FILAS (caso | logoUrl en el cuerpo | veredicto del esquema | qué se hizo con el PUT | lo que dice la página | clase del aviso)');
for (const [caso, r] of filas) console.log(`${caso} | ${r.put ? r.put.logoUrl : 'no hubo PUT'} | ${r.put ? r.put.esquema : '-'} | ${r.put ? r.put.hecho : '-'} | «${r.texto}» | ${r.clase}`);
console.log(`claves del último cuerpo: ${filas.at(-1)[1].put ? filas.at(-1)[1].put.claves.join(', ') : '-'}`);

if (REAL) {
  console.log('--- DIRECTOS AL SERVIDOR DE VERDAD (una clave; sin pasar por la página)');
  for (const [nombre, cuerpo, esperaRechazo] of [['logoUrl vacío', { logoUrl: '' }, true], ['logoUrl URL externa', { logoUrl: 'https://example.com/logo.png' }, true], ['CONTROL POSITIVO cuerpo vacío', {}, false]]) {
    const v = merchantProfileUpdateSchema.safeParse(cuerpo);
    if (esperaRechazo && v.success) { console.log(`${nombre} | NO SALE: el esquema lo aceptaría`); continue; }
    const r = await page.request.put(`${BASE}/admin/merchant`, { data: cuerpo });
    let error = null; try { error = (await r.json()).error ?? null; } catch { /* sin cuerpo JSON */ }
    console.log(`${nombre} | esquema: ${v.success ? 'lo aceptaría' : '400'} | servidor: ${r.status()}${error ? ` (${error})` : ''}`);
  }
}

// Después de todo: ¿sigue el logo guardado como estaba?
const fin = await cargar();
console.log(`AL ACABAR=${JSON.stringify({ logoGuardado: fin.logoGuardado, estado: fin.estado })}`);
console.log(`errores de página: ${errores.join(' · ') || 'ninguno'}`);
console.log(`POBLACION=${filas.length} guardados · PUT vistos=${puts.length}`);
await browser.close();
console.log('EXIT=0');
