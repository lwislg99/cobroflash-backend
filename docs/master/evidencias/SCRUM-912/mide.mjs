// docs/master/evidencias/SCRUM-912/mide.mjs — SCRUM-912 · lecturas REALES en staging, contadas.
//
// Uso: node mide.mjs <sha-esperado> <email-qa> <n-lecturas>
//   · Aborta si la URL no es staging, o si /version no es el SHA esperado: sin el código nuevo
//     desplegado, un 404 de la ruta se leería como «no funciona» (A21: el sujeto tiene que existir).
//   · TOPE DURO de 5 lecturas (permiso del orquestador, 18-sep): la clave de staging es la de
//     producción y cada lectura gasta cupo real.
//   · El secreto de QA se lee EN RUNTIME del fichero de fuera del repo y no se imprime (regla 9).
//   · Escribe en staging UNA fila: la `authSession` del test-login. La lectura no guarda nada.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { TICKETS } from './tickets.mjs';

const BASE = 'https://yaqu-staging-production.up.railway.app';
const SECRETO = 'D:/MILLONARIO/cobroFlash/e2e-staging-secret.txt';
const CHROME = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1223',
  'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const TOPE_DURO = 5;

const [sha, email, nArg] = process.argv.slice(2);
const n = Number(nArg);
if (!/^[0-9a-f]{40}$/.test(sha || '') || !email || !Number.isInteger(n) || n < 1) {
  throw new Error('uso: node mide.mjs <sha-40> <email-qa> <n-lecturas>');
}
if (n > TOPE_DURO || n > TICKETS.length) throw new Error(`como mucho ${Math.min(TOPE_DURO, TICKETS.length)} lecturas`);

const version = await fetch(`${BASE}/version`).then((r) => r.json());
if (version.version !== sha) throw new Error(`staging sirve ${version.version}, no ${sha}: el código nuevo no está`);
console.log(`staging /version = ${version.version} ✓`);

// ── Las fotos: el HTML del ticket, fotografiado por chrome-headless-shell ──────────────────
// El temporal se borra SIEMPRE (también si algo falla): las fotos se regeneran desde tickets.mjs.
const fotos = [];
const dir = fs.mkdtempSync(path.join(process.env.TEMP || '.', 'tickets-912-'));
try {
  for (const t of TICKETS.slice(0, n)) {
    const html = path.join(dir, `${t.id}.html`);
    const png = path.join(dir, `${t.id}.png`);
    fs.writeFileSync(html, t.html);
    spawnSync(CHROME, ['--headless', '--hide-scrollbars', `--screenshot=${png}`, '--window-size=400,520', pathToFileURL(html).href]);
    if (!fs.existsSync(png) || fs.statSync(png).size < 1000) throw new Error(`no se generó la foto de ${t.id}`);
    fotos.push({ t, dataUrl: `data:image/png;base64,${fs.readFileSync(png).toString('base64')}`, bytes: fs.statSync(png).size });
  }
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(`fotos: ${fotos.map((f) => `${f.t.id} ${f.bytes} B`).join(' · ')}`);

// ── Sesión de QA ──────────────────────────────────────────────────────────────────────────
const linea = fs.readFileSync(SECRETO, 'utf8').split(/\r?\n/).find((l) => l.startsWith('E2E_TEST_LOGIN_SECRET='));
if (!linea) throw new Error('el fichero de secretos no trae E2E_TEST_LOGIN_SECRET');
const login = await fetch(`${BASE}/auth/test-login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, secret: linea.slice('E2E_TEST_LOGIN_SECRET='.length).trim() }),
});
const cookie = (login.headers.get('set-cookie') || '').match(/pf_session=[^;]+/)?.[0];
if (login.status !== 200 || !cookie) throw new Error(`test-login: ${login.status} (sin cookie)`);
console.log('sesión de QA ✓');

// ── Las lecturas ──────────────────────────────────────────────────────────────────────────
const resultados = [];
for (const f of fotos) {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/admin/expenses/leer-ticket`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ imagen: f.dataUrl }),
  });
  const ms = Date.now() - t0;
  const json = await r.json().catch(() => null);
  const campos = Object.entries(f.t.verdad).map(([campo, esperado]) => {
    const leido = json?.propuesta?.[campo];
    return { campo, esperado, leido, ok: leido === esperado };
  });
  const fila = { ticket: f.t.id, status: r.status, ms, modelo: json?.modelo, error: json?.error,
    aciertos: `${campos.filter((c) => c.ok).length}/${campos.length}`, campos,
    descartados: json?.descartados, veredicto: json?.justificante?.veredicto, propuesta: json?.propuesta };
  resultados.push(fila);
  console.log(`\n${f.t.id}: HTTP ${r.status} en ${ms} ms · modelo ${fila.modelo} · aciertos ${fila.aciertos} · veredicto ${fila.veredicto}${fila.error ? ` · error ${fila.error}` : ''}`);
  for (const c of campos) console.log(`  ${c.ok ? '✓' : '✗'} ${c.campo.padEnd(22)} esperado ${JSON.stringify(c.esperado)} · leído ${JSON.stringify(c.leido)}`);
  if (fila.descartados?.length) console.log(`  descartados: ${JSON.stringify(fila.descartados)}`);
}

const salida = path.join(import.meta.dirname, 'lecturas-staging.json');
fs.writeFileSync(salida, JSON.stringify({ sha, cuando: new Date().toISOString(), lecturas: resultados }, null, 2) + '\n');
console.log(`\n${resultados.length} lecturas gastadas · resultado en ${salida}`);
