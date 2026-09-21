// SCRUM-920d · ¿tiene el servicio la clave de Gemini? Sin gastar una lectura y sin enviar ninguna foto.
// Uso: node docs/master/evidencias/scrum920/sonda-gemini-configurada.mjs
// Staging, merchant QA. Manda POST /admin/expenses/leer-ticket con un cuerpo que NO es una imagen.
// La ruta (expenses.routes.ts) contesta en este orden, y por eso la sonda no llega nunca a Google:
//   1) sin GEMINI_API_KEY            → 503 ai_not_configured
//   2) con clave, cuerpo que no es foto → 400 imagen_*  (antes de contar el tope de 5 y de salir a Google)
// O sea: 503 = SIN clave · 400 = CON clave. Cualquier otra cosa no dice nada y se declara.
// El secreto se lee en tiempo de ejecucion y no se imprime (regla 9).
import fs from 'node:fs';

const BASE = 'https://yaqu-staging-production.up.railway.app';
if (!/yaqu-staging/.test(BASE)) { console.error('no es staging'); process.exit(2); }
const m = fs.readFileSync('D:/MILLONARIO/cobroFlash/e2e-staging-secret.txt', 'utf8').match(/^E2E_TEST_LOGIN_SECRET=(.+)$/m);
if (!m) { console.error('sin clave de login'); process.exit(2); }
console.log('TESTIGO · sonda de la clave de Gemini contra ' + BASE);

const login = await fetch(BASE + '/auth/test-login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'qa@staging.yaqu', secret: m[1].trim() }),
});
if (login.status !== 200) { console.log('login ' + login.status); console.log('EXIT=1'); process.exit(1); }
const galleta = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
if (!/pf_session=/.test(galleta)) { console.log('login 200 pero sin pf_session'); console.log('EXIT=1'); process.exit(1); }

const version = await (await fetch(BASE + '/version')).json().catch(() => null);
console.log('version desplegada:', version && version.version);

// El cuerpo NO es una foto: `parsearImagen` lo rechaza antes de nada que cuente o salga a la red.
const r = await fetch(BASE + '/admin/expenses/leer-ticket', {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie: galleta },
  body: JSON.stringify({ imagen: 'no-es-una-foto' }),
});
const cuerpo = await r.json().catch(() => null);
console.log(`POST leer-ticket con cuerpo que no es foto -> ${r.status} ${JSON.stringify(cuerpo)}`);

// Control positivo del instrumento: sin cookie la ruta tiene que negarse (401), no contestar 503/400.
const sinSesion = await fetch(BASE + '/admin/expenses/leer-ticket', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ imagen: 'no-es-una-foto' }),
});
console.log(`control: la misma llamada SIN sesion -> ${sinSesion.status} (tiene que ser 401)`);

let veredicto = 'NO CONCLUYENTE';
if (r.status === 503 && cuerpo && cuerpo.error === 'ai_not_configured') veredicto = 'SIN clave de Gemini';
else if (r.status === 400 && cuerpo && /^imagen_/.test(String(cuerpo.error))) veredicto = 'CON clave de Gemini';
console.log('veredicto para staging: ' + veredicto);
console.log('EXIT=' + (veredicto !== 'NO CONCLUYENTE' && sinSesion.status === 401 ? 0 : 1));
