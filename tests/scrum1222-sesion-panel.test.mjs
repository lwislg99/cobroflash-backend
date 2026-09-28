// tests/scrum1222-sesion-panel.test.mjs — SCRUM-1222
//
// La herramienta de QA que entra al panel de yaqu.app con la cuenta demo. Aquí NO se sale a la
// red: `fetch` es un doble que apunta cada llamada, y el secreto y la sesión viven en ficheros
// temporales fuera del árbol. Lo que se prueba es lo que la hace segura de autorizar con una regla
// estrecha: sólo lectura, sólo yaqu.app, fail-closed, y que ni el secreto ni la cookie se impriman.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { temporal, borrarTemporal } from './_temporal.mjs'; // SCRUM-864 · se borra pase lo que pase
import {
  ejecutar, peticion, urlDelPanel, cookieDeSesion, Rechazo, RUTA_LOGIN, RUTA_SECRETO, RUTA_SESION,
} from '../scripts/qa/sesion-panel.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(RAIZ, 'scripts', 'qa', 'sesion-panel.mjs');
const SECRETO = 'secreto-de-prueba-1222-no-debe-salir';
const TOKEN = 'tok1222abcdef';

function respuesta(status, cuerpo = '', cabeceras = {}) {
  return { status, headers: new Headers(cabeceras), text: async () => cuerpo };
}

/** Un banco con ficheros temporales y un fetch que apunta y responde lo que se le diga. */
function banco({ secreto = SECRETO, sesion = null, responde }) {
  const dir = temporal('scrum1222-');
  const rutaSecreto = path.join(dir, 'secreto.txt');
  const rutaSesion = path.join(dir, 'sesion.txt');
  if (secreto !== null) fs.writeFileSync(rutaSecreto, secreto);
  if (sesion !== null) fs.writeFileSync(rutaSesion, sesion);
  const llamadas = [];
  const salida = { out: [], err: [] };
  const fetchFn = async (url, init) => { llamadas.push({ url, ...init }); return responde(url, init); };
  const correr = (argv) => ejecutar(argv, {
    fetchFn, rutaSecreto, rutaSesion, out: (s) => salida.out.push(s), err: (s) => salida.err.push(s),
  });
  const limpiar = () => borrarTemporal(dir);
  return { correr, llamadas, salida, rutaSesion, limpiar };
}

const todo = (b) => [...b.salida.out, ...b.salida.err].join('\n');

test('SCRUM-1222 · rutas fijas: el secreto y la sesión viven fuera del repositorio', () => {
  // Las rutas son de la máquina Windows donde se usa la herramienta. Se juzgan como rutas de
  // Windows también en el CI (Linux): allí `path.resolve('C:/…')` las pegaba al directorio de
  // trabajo y las daba por «dentro del repo» (el rojo de la primera pasada de #1881).
  const raiz = RAIZ.replace(/\\/g, '/').toLowerCase();
  for (const r of [RUTA_SECRETO, RUTA_SESION]) {
    assert.ok(path.win32.isAbsolute(r), `${r} no es una ruta absoluta`);
    assert.ok(!r.replace(/\\/g, '/').toLowerCase().startsWith(raiz), `${r} cae dentro del repo`);
  }
  // El secreto no se lee de una variable de entorno: el script no mira `process.env` en absoluto.
  const fuente = fs.readFileSync(CLI, 'utf8');
  assert.equal(/process\.env/.test(fuente), false, 'el script lee process.env: el secreto sólo puede venir de RUTA_SECRETO');
});

test('SCRUM-1222 · login correcto: 200 + pf_session → sesión guardada, y NI secreto NI cookie en la salida', async () => {
  const b = banco({ responde: () => respuesta(200, '{"ok":true}', { 'set-cookie': `pf_session=${TOKEN}; Path=/; HttpOnly` }) });
  try {
    assert.equal(await b.correr(['login']), 0, todo(b));
    assert.equal(b.llamadas.length, 1);
    const [l] = b.llamadas;
    assert.equal(l.url, `https://yaqu.app${RUTA_LOGIN}`);
    assert.equal(l.method, 'POST');
    assert.equal(l.redirect, 'manual');
    assert.deepEqual(JSON.parse(l.body), { email: 'demo@yaqu.app', secret: SECRETO });
    assert.equal(fs.readFileSync(b.rutaSesion, 'utf8').trim(), `pf_session=${TOKEN}`);
    assert.equal(todo(b).includes(SECRETO), false, 'el SECRETO aparece en la salida');
    assert.equal(todo(b).includes(TOKEN), false, 'la COOKIE de sesión aparece en la salida');
  } finally { b.limpiar(); }
});

test('SCRUM-1222 · fail-closed: sin secreto → CIEGO, exit 2, NADA por stdout y sin tocar la red', async () => {
  for (const secreto of [null, '   \n']) {
    const b = banco({ secreto, responde: () => { throw new Error('no debía llamar'); } });
    try {
      assert.equal(await b.correr(['login']), 2);
      assert.deepEqual(b.salida.out, [], 'un CIEGO no imprime nada por stdout');
      assert.match(b.salida.err.join('\n'), /CIEGO/);
      assert.equal(b.llamadas.length, 0);
    } finally { b.limpiar(); }
  }
});

test('SCRUM-1222 · fail-closed: un login que no da 200 con cookie lo DICE y sale 1, sin guardar sesión', async () => {
  const casos = [
    ['404 (ruta apagada / secreto / correo)', () => respuesta(404, 'Not Found')],
    ['200 SIN cookie', () => respuesta(200, '{"ok":true}')],
    ['500', () => respuesta(500, '{"error":"internal_error"}')],
    ['red caída', () => { throw new Error('ECONNREFUSED'); }],
  ];
  for (const [nombre, responde] of casos) {
    const b = banco({ responde });
    try {
      assert.equal(await b.correr(['login']), 1, nombre);
      assert.match(b.salida.err.join('\n'), /NO PUDE (ENTRAR|MIRAR)/, nombre);
      assert.equal(fs.existsSync(b.rutaSesion), false, `${nombre}: guardó una sesión`);
      assert.equal(todo(b).includes(SECRETO), false, `${nombre}: el secreto sale en el error`);
    } finally { b.limpiar(); }
  }
});

test('SCRUM-1222 · get: GET con la cookie guardada; no 2xx sale 1 y lo dice; sin sesión, CIEGO', async () => {
  const ok = banco({ sesion: `pf_session=${TOKEN}`, responde: () => respuesta(200, '[{"id":1}]') });
  try {
    assert.equal(await ok.correr(['get', '/admin/jobs']), 0, todo(ok));
    assert.equal(ok.llamadas[0].method, 'GET');
    assert.equal(ok.llamadas[0].url, 'https://yaqu.app/admin/jobs');
    assert.equal(ok.llamadas[0].headers.cookie, `pf_session=${TOKEN}`);
    assert.equal(ok.llamadas[0].redirect, 'manual');
    assert.ok(ok.salida.out.includes('[{"id":1}]'));
    assert.equal(todo(ok).includes(TOKEN), false, 'la cookie aparece en la salida');
  } finally { ok.limpiar(); }

  for (const [status, extra, patron] of [[401, {}, /caducó/], [302, { location: 'https://otro.example/x' }, /NO se sigue/]]) {
    const b = banco({ sesion: `pf_session=${TOKEN}`, responde: () => respuesta(status, '', extra) });
    try {
      assert.equal(await b.correr(['get', '/admin/jobs']), 1, String(status));
      assert.deepEqual(b.salida.out, [], `${status}: un no-2xx no se imprime como si fuera la respuesta`);
      assert.match(b.salida.err.join('\n'), patron);
      assert.match(b.salida.err.join('\n'), /NO es «no hay nada»/);
    } finally { b.limpiar(); }
  }

  const sin = banco({ responde: () => { throw new Error('no debía llamar'); } });
  try {
    assert.equal(await sin.correr(['get', '/admin/jobs']), 2);
    assert.deepEqual(sin.salida.out, []);
    assert.equal(sin.llamadas.length, 0);
  } finally { sin.limpiar(); }
});

test('SCRUM-1222 · SOLO LECTURA: cualquier método que no sea GET se rechaza ANTES de la red', async () => {
  const llamadas = [];
  const f = async (...a) => { llamadas.push(a); return respuesta(200); };
  for (const m of ['POST', 'PUT', 'PATCH', 'DELETE', 'post']) {
    await assert.rejects(peticion(f, m, '/admin/jobs'), Rechazo, m);
  }
  // El único POST admitido es el del login, y sólo a esa ruta exacta.
  await assert.rejects(peticion(f, 'POST', `${RUTA_LOGIN}/../admin/jobs`), Rechazo);
  assert.equal(llamadas.length, 0, 'un método rechazado llegó a la red');
  // Control positivo: el GET sí sale (si no, «0 llamadas» no probaría nada).
  await peticion(f, 'GET', '/admin/jobs');
  assert.equal(llamadas.length, 1);
});

test('SCRUM-1222 · SÓLO yaqu.app: rutas absolutas, //host y \\\\host se rechazan', async () => {
  for (const r of ['https://evil.example/x', 'http://yaqu.app/x', '//evil.example/x', '/\\evil.example/x', 'admin/jobs', '']) {
    assert.throws(() => urlDelPanel(r), Rechazo, r);
  }
  assert.equal(urlDelPanel('/admin/jobs?x=1').href, 'https://yaqu.app/admin/jobs?x=1');
  const b = banco({ sesion: `pf_session=${TOKEN}`, responde: () => { throw new Error('no debía llamar'); } });
  try {
    assert.equal(await b.correr(['get', 'https://evil.example/admin']), 3);
    assert.match(b.salida.err.join('\n'), /tiene que empezar/);
    assert.equal(b.llamadas.length, 0);
  } finally { b.limpiar(); }
});

test('SCRUM-1222 · cookieDeSesion sólo acepta pf_session con valor', () => {
  assert.equal(cookieDeSesion(respuesta(200, '', { 'set-cookie': 'otra=1; Path=/' })), null);
  assert.equal(cookieDeSesion(respuesta(200, '', { 'set-cookie': 'pf_session=; Path=/' })), null);
  assert.equal(cookieDeSesion(respuesta(200, '', { 'set-cookie': `pf_session=${TOKEN}; HttpOnly` })), `pf_session=${TOKEN}`);
});

test('SCRUM-1222 · la CLI de verdad: orden desconocida y host ajeno salen 3 sin tocar la red', () => {
  // Sólo caminos que se rechazan ANTES de leer ficheros o salir a la red: este test no toca producción.
  for (const argv of [[], ['borrar', '/admin/jobs'], ['get', 'https://evil.example/x']]) {
    const r = spawnSync(process.execPath, [CLI, ...argv], { encoding: 'utf8', timeout: 20_000 });
    assert.equal(r.status, 3, `${argv.join(' ')}: ${r.stderr}`);
    assert.equal(r.stdout, '');
  }
});
