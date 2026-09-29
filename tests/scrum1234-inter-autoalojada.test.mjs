// tests/scrum1234-inter-autoalojada.test.mjs — SCRUM-1234 (sale de SCRUM-1196 ①)
//
// La fuente Inter se servía desde Google (hoja en un host, letras en otro), y cada visita a las
// páginas del cliente final —pago, recibo, albarán, portal, presupuesto, perfil— mandaba su IP a
// Google sin estar en la política. Ahora se sirve desde `/fonts/`.
//
// Lo que este fichero fija, y cada cosa con su suelo para no dar verde a ciegas:
//   ① ni `public/` ni `src/` nombran los dos hosts de Google Fonts (en código ni en comentarios);
//   ② las 16 superficies que la cargaban piden AHORA `/fonts/inter.css` — si alguna la perdiera,
//      se pintaría con la letra del sistema: un cambio visual que ① no vería;
//   ③ `inter.css` apunta solo a ficheros que existen en `public/fonts/`, y trae los 7 subconjuntos
//      y los 5 grosores que servía Google (35 declaraciones), con `font-display: swap`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hojasDeLaPagina } from './_scripts-de-la-pagina.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Partido a propósito: escrito entero, este mismo fichero casaría consigo (trampa de autorreferencia).
const HOSTS = ['fonts.google' + 'apis.com', 'fonts.gs' + 'tatic.com'];

const SUPERFICIES = [
  'public/index.html',
  'public/login.html',
  'public/register.html',
  'public/precios.html',
  'public/privacidad.html',
  'public/terminos.html',
  'public/dashboard/index.html',
  'src/modules/billing/app/routes/payBank.routes.ts',
  'src/modules/billing/app/routes/payBizum.routes.ts',
  'src/modules/billing/app/routes/payInvoice.routes.ts',
  'src/modules/billing/app/routes/payMp.routes.ts',
  'src/modules/billing/app/routes/receipt.routes.ts',
  'src/modules/jobs/app/routes/albaranPublic.routes.ts',
  'src/modules/system/app/routes/customerPortal.routes.ts',
  'src/modules/system/app/routes/quoteDecisionLanding.routes.ts',
  'src/modules/system/domain/publicProfile.service.ts',
];

function ficheros(dir, out = []) {
  for (const e of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) ficheros(rel, out);
    else if (/\.(html|css|js|mjs|ts|json|webmanifest|svg)$/.test(e.name)) out.push(rel);
  }
  return out;
}

test('SCRUM-1234 · 🔴 ni public/ ni src/ nombran los hosts de Google Fonts', () => {
  const todos = [...ficheros('public'), ...ficheros('src')];
  // SUELO: un recorrido vacío daría «cero apariciones» sin haber mirado nada.
  assert.ok(todos.length > 200, `CIEGO: solo recorrí ${todos.length} ficheros`);
  assert.ok(todos.includes('src/app.ts') && todos.includes('public/dashboard/index.html'), 'CIEGO: el recorrido no ve los ficheros de siempre');
  const con = [];
  for (const f of todos) {
    const t = fs.readFileSync(path.join(RAIZ, f), 'utf8');
    for (const h of HOSTS) if (t.includes(h)) con.push(`${f} → ${h}`);
  }
  assert.deepEqual(con, [], '🔴 vuelve a haber una referencia a Google Fonts: la IP del visitante sale a un tercero que la política no declara (SCRUM-1196).');
});

test('SCRUM-1234 · 🔴 las 16 superficies cargan /fonts/inter.css (sin ella, se pintan con otra letra)', () => {
  // Con el extractor ÚNICO de `<link>` (SCRUM-676), no con otra búsqueda de texto: una etiqueta
  // comentada no cuenta y el orden de los atributos no importa. En los .ts la página es una
  // plantilla, y el extractor la lee igual porque el marcado está literal dentro.
  const sin = SUPERFICIES.filter((f) => !hojasDeLaPagina(fs.readFileSync(path.join(RAIZ, f), 'utf8')).locales.includes('/fonts/inter.css'));
  assert.deepEqual(sin, [], '🔴 estas superficies ya no cargan Inter');
});

test('SCRUM-1234 · inter.css: 35 declaraciones, 7 subconjuntos × 5 grosores, todos los ficheros existen', () => {
  const css = fs.readFileSync(path.join(RAIZ, 'public/fonts/inter.css'), 'utf8');
  const caras = [...css.matchAll(/@font-face \{([^}]*)\}/g)].map((m) => m[1]);
  assert.equal(caras.length, 35, `se esperaban las 35 declaraciones de Google; hay ${caras.length}`);
  const grosores = new Set(caras.map((c) => (c.match(/font-weight: (\d+);/) || [])[1]));
  assert.deepEqual([...grosores].sort(), ['400', '500', '600', '700', '800'], 'grosores DISCRETOS, como los servía Google (un rango cambiaría los intermedios)');
  const urls = new Set(caras.map((c) => (c.match(/url\(([^)]+)\)/) || [])[1]));
  assert.equal(urls.size, 7, `7 ficheros, uno por subconjunto; hay ${urls.size}`);
  for (const u of urls) {
    assert.match(u, /^\/fonts\/inter-[a-z-]+\.woff2$/, `URL no local: ${u}`);
    assert.ok(fs.existsSync(path.join(RAIZ, 'public', u)), `🔴 inter.css apunta a ${u} y no existe`);
  }
  assert.ok(caras.every((c) => /font-display: swap;/.test(c)), 'se pierde `display=swap`: el texto quedaría invisible mientras carga');
  assert.ok(fs.existsSync(path.join(RAIZ, 'public/fonts/OFL.txt')), 'la licencia OFL viaja con la fuente');
});
