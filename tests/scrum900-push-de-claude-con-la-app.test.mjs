// tests/scrum900-push-de-claude-con-la-app.test.mjs — SCRUM-900
//
// CUANDO CLAUDE ARREGLA UN PR, SU PUSH TIENE QUE SALIR CON LA LLAVE DE LA APP.
//
// Medido el 17-sep-2026: los pushes de `claude.yml` autenticaban como `github-actions[bot]`, y
// GitHub deja sus runs en `action_required` con 0 jobs (5 de 6 desde el 14-sep; caso vivo #1383).
// El PR armado no entra y nada lo dice.
//
// 🔴 LA CAUSA NO ERA EL TOKEN QUE SE LE PASA A LA ACCIÓN, que ya era el de la App (c4be62b7).
// Era la credencial que DEJA EL CHECKOUT. `actions/checkout@v6` con `persist-credentials` (por
// defecto `true`) guarda el `GITHUB_TOKEN` como cabecera `http.https://github.com/.extraheader`
// en un fichero APARTE, enlazado con `includeIf.gitdir:` (log del run 35200459742).
// `claude-code-action` busca esa cabecera en la config local para quitarla, no la ve —«No
// existing authentication headers to remove»— y pone el token de la App solo en la URL remota.
// Git manda la cabecera en la primera petición: la URL no llega a usarse.
//
// Este test no lee el YAML y confía: EJECUTA git contra un servidor HTTP local, con la
// credencial que el checkout real de `claude.yml` dejaría, y mira qué token llega.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFile, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = '.github/workflows/claude.yml';

// El rojo, declarado: lo ejecuta `npm run meta:mutaciones`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El defecto del 17-sep: el checkout vuelve a dejar el GITHUB_TOKEN como cabecera.
    fichero: '.github/workflows/claude.yml',
    de: 'persist-credentials: false',
    a: 'persist-credentials: true',
    cae: '🔴 ROJO/POSITIVO: el push de Claude autentica con la llave de la App, no con el GITHUB_TOKEN del checkout',
  },
];

const TOKEN_CHECKOUT = 'TOKEN_DEL_CHECKOUT';
const TOKEN_APP = 'TOKEN_DE_LA_APP_YAQU_BOT';

// ═════════════════════════════════════════════════════════════════════════════════════════
// Lectura del workflow
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Los pasos de `steps:`, cada uno como su bloque de texto. */
function pasos(texto) {
  const lineas = texto.split('\n');
  const inicios = [];
  lineas.forEach((l, i) => { if (/^\s*- (uses|name|id):/.test(l)) inicios.push(i); });
  return inicios.map((ini, k) => lineas.slice(ini, inicios[k + 1] ?? lineas.length).join('\n'));
}

/** El valor de una clave dentro de un bloque, ignorando comentarios. `null` si no está. */
function valor(bloque, clave) {
  for (const l of bloque.split('\n')) {
    const sinComentario = l.replace(/\s+#.*$/, '');
    const m = sinComentario.match(new RegExp(`^\\s*(?:- )?${clave}:\\s*(.+?)\\s*$`));
    if (m) return m[1].replace(/^['"]|['"]$/g, '');
  }
  return null;
}

function checkoutDe(texto) {
  const lista = pasos(texto).filter((b) => /^\s*- uses: actions\/checkout@/m.test(b) || /\n\s*uses: actions\/checkout@/.test(b));
  return lista;
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// Banco: git de verdad contra un servidor HTTP local
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * Qué token autentica un `git ls-remote` en un repo preparado como lo deja el runner.
 *
 * @param {{persisteCredencial: boolean}} o  si el checkout deja su cabecera (includeIf)
 * @returns {Promise<{token: string|null, peticiones: string[]}>}
 */
async function tokenQueLlega({ persisteCredencial }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum900-'));
  const peticiones = [];
  const servidor = http.createServer((req, res) => {
    const auth = req.headers.authorization || '';
    peticiones.push(auth);
    if (!auth) { res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="scrum900"' }); res.end(); return; }
    res.writeHead(404); res.end();
  });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const puerto = servidor.address().port;
  try {
    const repo = path.join(dir, 'repo');
    execFileSync('git', ['init', '-q', repo]);
    const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
    const gitdir = git('rev-parse', '--absolute-git-dir').trim().replace(/\\/g, '/');

    if (persisteCredencial) {
      // Lo que deja `actions/checkout@v6` (run 35200459742): la cabecera en un fichero aparte,
      // enlazado por `includeIf.gitdir:`. Aquí la URL es la del servidor local.
      const cred = path.join(dir, 'git-credentials.config');
      const b64 = Buffer.from(`x-access-token:${TOKEN_CHECKOUT}`).toString('base64');
      fs.writeFileSync(cred, `[http "http://127.0.0.1:${puerto}/"]\n\textraheader = AUTHORIZATION: basic ${b64}\n`);
      git('config', '--local', `includeIf.gitdir:${gitdir}.path`, cred.replace(/\\/g, '/'));
    }
    // Lo que hace `claude-code-action`: el token que recibe, en la URL remota.
    git('remote', 'add', 'origin', `http://x-access-token:${TOKEN_APP}@127.0.0.1:${puerto}/repo.git`);

    await new Promise((ok) => {
      execFile('git', ['-C', repo, '-c', 'credential.helper=', '-c', 'core.askPass=', 'ls-remote', 'origin'],
        { env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: '' }, timeout: 20000 }, () => ok());
    });
  } finally {
    servidor.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const primera = peticiones.find((a) => a) || '';
  const m = primera.match(/^basic\s+(.+)$/i);
  const token = m ? Buffer.from(m[1], 'base64').toString().replace(/^x-access-token:/, '') : null;
  return { token, peticiones };
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════════════════════════════════

test('🔴 SUELO del banco: distingue la cabecera del checkout de la URL con la llave de la App', async () => {
  // Si el banco diera lo mismo en los dos casos, el veredicto de abajo no mediría nada.
  const conCabecera = await tokenQueLlega({ persisteCredencial: true });
  const sinCabecera = await tokenQueLlega({ persisteCredencial: false });
  assert.ok(conCabecera.peticiones.length > 0 && sinCabecera.peticiones.length > 0,
    '🔴 NO PUDE MIRAR: git no llegó al servidor local. Sin peticiones no hay veredicto.');
  assert.equal(conCabecera.token, TOKEN_CHECKOUT,
    `🔴 NO PUDE MIRAR: con la cabecera del checkout llegó ${conCabecera.token}. El banco no reproduce el defecto medido.`);
  assert.equal(sinCabecera.token, TOKEN_APP,
    `🔴 NO PUDE MIRAR: sin cabecera llegó ${sinCabecera.token}. El banco no ve la URL con la llave de la App.`);
});

test('🔴 ROJO/POSITIVO: el push de Claude autentica con la llave de la App, no con el GITHUB_TOKEN del checkout', async () => {
  const texto = fs.readFileSync(path.join(RAIZ, WORKFLOW), 'utf8');
  const checkouts = checkoutDe(texto);
  assert.equal(checkouts.length, 1,
    `🔴 ESCÁNER CIEGO: encuentro ${checkouts.length} pasos de checkout en ${WORKFLOW}, y esperaba 1.`);
  // `persist-credentials` ausente vale `true` (valor por defecto de actions/checkout).
  const persiste = (valor(checkouts[0], 'persist-credentials') ?? 'true') !== 'false';
  const { token } = await tokenQueLlega({ persisteCredencial: persiste });
  assert.equal(token, TOKEN_APP,
    `🔴 el checkout de ${WORKFLOW} deja su credencial (persist-credentials ≠ false), y git la manda antes que\n` +
    '  la URL con la llave de la App: el push de Claude sale como github-actions[bot], su CI queda en\n' +
    '  action_required con 0 jobs y el PR armado se queda parado sin aviso (SCRUM-900, #1383).');
});

test('la acción recibe la llave de la App (sin ella, quitar la cabecera no basta)', () => {
  const texto = fs.readFileSync(path.join(RAIZ, WORKFLOW), 'utf8');
  const accion = pasos(texto).filter((b) => /uses: anthropics\/claude-code-action@/.test(b));
  assert.equal(accion.length, 1, `🔴 ESCÁNER CIEGO: encuentro ${accion.length} pasos de claude-code-action.`);
  assert.match(valor(accion[0], 'github_token') || '', /steps\.token\.outputs\.token/,
    '🔴 `github_token` de la acción ya no es la llave de la App: su push no dispararía CI aunque el checkout no deje cabecera.');
});
