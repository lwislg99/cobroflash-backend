// SCRUM-1675 · verificación EN PANTALLA en yaqu.app, cuenta QA (merchant 46), parte #11 (borrador).
//   node verificar.mjs <antes|despues> <ancho> <arbol> <salida>
// «antes»  = el JS que sirve producción.  «despues» = parteDetailView.js y almacenLocal.js del árbol.
// 🔴 NO ESCRIBE EN EL PARTE: cualquier PATCH/POST/PUT/DELETE a /admin/partes que no sea
// /dictado (que devuelve una propuesta y no guarda, SCRUM-683b ④) se ABORTA y se cuenta.
// «Añadir al parte» NO se pulsa.
import fs from 'node:fs';
import path from 'node:path';
import { abrir } from './lib.mjs';

const [modo, anchoTxt, arbol, salida] = process.argv.slice(2);
const ancho = Number(anchoTxt) || 390;
const PARTE = 11;
fs.mkdirSync(salida, { recursive: true });
const s = await abrir(ancho, ancho < 600 ? 844 : 800);
const p = s.page;

const abortadas = [];
const servidas = [];
await s.ctx.route('**/admin/partes/**', (route) => {
  const r = route.request();
  if (r.method() !== 'GET' && !r.url().endsWith('/dictado')) {
    abortadas.push(`${r.method()} ${r.url().replace('https://yaqu.app', '')}`);
    return route.abort();
  }
  return route.continue();
});
if (modo === 'despues') {
  for (const f of ['parteDetailView.js', 'almacenLocal.js']) {
    await s.ctx.route(`**/dashboard/js/${f}*`, (route) => {
      servidas.push(f);
      return route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8',
        body: fs.readFileSync(path.join(arbol, 'public/dashboard/js', f), 'utf8') });
    });
  }
}

const DICTADO = 'He cambiado el grifo de la cocina por uno monomando y he revisado la llave de paso. Una hora de trabajo.';
await p.goto(`https://yaqu.app/dashboard/#parte-detail/${PARTE}`, { waitUntil: 'networkidle' });
await p.waitForSelector('#parte-dictado', { timeout: 15000 });
await p.locator('#parte-dictado').fill(DICTADO);
const t0 = Date.now();
await p.getByRole('button', { name: /Ordenar en líneas/ }).click();
for (let i = 0; i < 60; i++) {
  await p.waitForTimeout(500);
  if (await p.locator('[data-propuesta-confirmar]').count()) break;
  if (await p.locator('[data-dictado-aviso] *').count()) break;
}
// Lo corregido a mano: una cantidad en la primera línea (sin pulsar «Añadir al parte»).
if (process.env.CORREGIR === '1' && await p.locator('[data-propuesta-unds="1"]').count()) {
  await p.locator('[data-propuesta-unds="1"]').first().fill('2');
  await p.waitForTimeout(300);
}
const antesDeRecargar = {
  primeraCantidad: await p.locator('[data-propuesta-unds="1"]').first().inputValue().catch(() => null),
  anadirApagado: await p.locator('[data-propuesta-confirmar]').first().isDisabled().catch(() => null),
  dictado: await p.locator('#parte-dictado').inputValue(),
  lineasPropuestas: await p.locator('[data-propuesta="1"]').count(),
  ordenarTardo_s: Math.round((Date.now() - t0) / 1000),
  claveEnElMovil: await p.evaluate((id) => localStorage.getItem('yaqu_parte_dictado_' + id) !== null, PARTE),
};
await p.locator('[data-parte-dictado]').scrollIntoViewIfNeeded();
const sufijo = process.env.CORREGIR === '1' ? '-corregido' : '';
await p.screenshot({ path: path.join(salida, `${modo}${sufijo}-1-ordenado-${ancho}.png`) });

// LA RECARGA (como cuando el móvil se bloquea o se cambia de app).
await p.reload({ waitUntil: 'networkidle' });
await p.waitForSelector('#parte-dictado', { timeout: 15000 });
await p.waitForTimeout(800);
const trasRecargar = {
  primeraCantidad: await p.locator('[data-propuesta-unds="1"]').first().inputValue().catch(() => null),
  dictado: await p.locator('#parte-dictado').inputValue(),
  lineasPropuestas: await p.locator('[data-propuesta="1"]').count(),
  anadirAlParte: await p.locator('[data-propuesta-confirmar]').count(),
  anadirApagado: await p.locator('[data-propuesta-confirmar]').first().isDisabled().catch(() => null),
};
await p.locator('[data-parte-dictado]').scrollIntoViewIfNeeded();
await p.screenshot({ path: path.join(salida, `${modo}${sufijo}-2-tras-recargar-${ancho}.png`) });

// Limpieza del móvil de prueba: este navegador muere aquí, pero se deja dicho.
await p.evaluate((id) => localStorage.removeItem('yaqu_parte_dictado_' + id), PARTE);

const informe = { modo, ancho, parte: PARTE, servidasDesdeElArbol: [...new Set(servidas)], antesDeRecargar, trasRecargar,
  dictadoIgual: trasRecargar.dictado === DICTADO, escriturasAbortadas: abortadas, log: s.log };
fs.writeFileSync(path.join(salida, `${modo}${sufijo}-${ancho}.json`), JSON.stringify(informe, null, 2));
console.log(JSON.stringify(informe, null, 1));
await s.browser.close();
