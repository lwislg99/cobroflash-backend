// tests/scrum1430-sesion-qa-estado.test.mjs — SCRUM-1430
//
// La sesión que abre `POST /auth/test-login` muere a las 24 h y no suena nada: el 2-oct-2026 todas
// las verificaciones en producción se cayeron a la misma hora y se supo por un 401 a mitad de una
// medición. `sesion-panel.mjs estado` contesta ANTES de gastar la sonda: VIVA · MUERTA · NO SE
// PUEDE SABER. Aquí no se sale a la red: `fetch` es un doble, y la sesión y su fichero de
// caducidad viven en un temporal fuera del árbol.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { temporal, borrarTemporal } from './_temporal.mjs';
import {
  ejecutar, rutaCaducidadDe, leerCaducidad, RUTA_SESION, RUTA_SONDA, VIDA_SESION_MS,
} from '../scripts/qa/sesion-panel.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECRETO = 'secreto-de-prueba-1430-no-debe-salir';
const TOKEN = 'tok1430abcdef';
const COOKIE = `pf_session=${TOKEN}`;
const APERTURA = Date.parse('2026-10-01T13:18:30Z'); // la hora real de la sesión que murió
const HORA = 60 * 60 * 1000;
const fecha = (ms) => new Date(ms).toUTCString();

function respuesta(status, cuerpo = '', cabeceras = {}) {
  return { status, headers: new Headers(cabeceras), text: async () => cuerpo };
}

/** Banco: ficheros temporales, reloj local que se fija, y un fetch que apunta lo que sale. */
function banco({ responde, reloj = APERTURA }) {
  const dir = temporal('scrum1430-');
  const rutaSecreto = path.join(dir, 'secreto.txt');
  const rutaSesion = path.join(dir, 'sesion.txt');
  fs.writeFileSync(rutaSecreto, SECRETO);
  const b = { rutaSesion, rutaCaducidad: rutaCaducidadDe(rutaSesion), llamadas: [], out: [], err: [], reloj, responde };
  const fetchFn = async (url, init) => { b.llamadas.push({ url, ...init }); return b.responde(url, init); };
  b.correr = (argv) => {
    b.out.length = 0; b.err.length = 0;
    return ejecutar(argv, { fetchFn, rutaSecreto, rutaSesion, ahora: () => b.reloj, out: (s) => b.out.push(s), err: (s) => b.err.push(s) });
  };
  b.todo = () => [...b.out, ...b.err].join('\n');
  b.limpiar = () => borrarTemporal(dir);
  return b;
}

/** Abre una sesión por `login` con el servidor diciendo que son las APERTURA. */
async function abierta(b) {
  b.responde = () => respuesta(200, '{"ok":true}', { 'set-cookie': `${COOKIE}; Path=/; HttpOnly; Max-Age=2592000`, date: fecha(APERTURA) });
  assert.equal(await b.correr(['login', 'qa@example.test']), 0, b.todo());
  b.llamadas.length = 0;
  b.responde = () => { throw new Error('no debía llamar'); };
}

test('SCRUM-1430 · login deja la caducidad AL LADO: hora del SERVIDOR + 24 h, no el Max-Age de la cookie ni el reloj local', async () => {
  // El reloj local va 3 h adelantado y la cookie declara 30 días: ninguno de los dos manda.
  const b = banco({ reloj: APERTURA + 3 * HORA });
  try {
    await abierta(b);
    const d = JSON.parse(fs.readFileSync(b.rutaCaducidad, 'utf8'));
    assert.equal(d.abiertaEn, '2026-10-01T13:18:30Z');
    assert.equal(d.caducaEn, '2026-10-02T13:18:30Z');
    assert.equal(d.correo, 'qa@example.test');
    assert.equal(fs.readFileSync(b.rutaCaducidad, 'utf8').includes(TOKEN), false, 'la cookie está en el fichero de caducidad');
    assert.equal(fs.readFileSync(b.rutaCaducidad, 'utf8').includes(SECRETO), false);
  } finally { b.limpiar(); }
});

test('SCRUM-1430 · login sin cabecera Date: abre la sesión, NO inventa una hora y borra la caducidad de la sesión anterior', async () => {
  const b = banco({});
  try {
    await abierta(b);
    assert.ok(fs.existsSync(b.rutaCaducidad), 'control: la primera sesión dejó su fichero');
    b.responde = () => respuesta(200, '{"ok":true}', { 'set-cookie': 'pf_session=otra1430; Path=/' });
    assert.equal(await b.correr(['login', 'qa@example.test']), 0, b.todo());
    assert.equal(fs.existsSync(b.rutaCaducidad), false, 'quedó la caducidad de la sesión ANTERIOR al lado de la cookie nueva');
    assert.match(b.err.join('\n'), /NO se guarda la caducidad/);
    assert.equal(await b.correr(['estado', '--sin-red']), 2);
  } finally { b.limpiar(); }
});

test('SCRUM-1430 · estado --sin-red: VIVA antes de su hora y MUERTA después, sin tocar la red', async () => {
  const b = banco({});
  try {
    await abierta(b);
    b.reloj = APERTURA + 23 * HORA;
    assert.equal(await b.correr(['estado', '--sin-red']), 0, b.todo());
    assert.match(b.out[0], /^VIVA — /);
    assert.match(b.out[0], /2026-10-02T13:18:30Z, dentro de 1 h 0 min/);
    assert.match(b.out[0], /NO se ha preguntado al servidor/);

    b.reloj = APERTURA + VIDA_SESION_MS; // el instante exacto ya es muerta: el servidor compara `<`
    assert.equal(await b.correr(['estado', '--sin-red']), 1);
    assert.deepEqual(b.out, [], 'una MUERTA no escribe por stdout');
    assert.match(b.err[0], /^MUERTA — /);
    assert.match(b.err[1], /^SE RENUEVA con: node scripts\/qa\/sesion-panel\.mjs login qa@example\.test /);

    b.reloj = APERTURA + 26 * HORA + 5 * 60 * 1000;
    assert.equal(await b.correr(['estado', '--sin-red']), 1);
    assert.match(b.err[0], /caducó el 2026-10-02T13:18:30Z, hace 2 h 5 min/);
    assert.equal(b.llamadas.length, 0, '--sin-red salió a la red');
    assert.equal(b.todo().includes(TOKEN), false, 'la cookie aparece en la salida');
  } finally { b.limpiar(); }
});

test('SCRUM-1430 · fail-closed: sin sesión, sin fichero, fichero roto o de OTRA cookie → NO SE PUEDE SABER, exit 2, nada por stdout', async () => {
  const sin = banco({ responde: () => { throw new Error('no debía llamar'); } });
  try {
    assert.equal(await sin.correr(['estado']), 2);
    assert.equal(await sin.correr(['estado', '--sin-red']), 2);
    assert.match(sin.err[0], /^NO SE PUEDE SABER — no hay sesión guardada/);
    assert.equal(sin.llamadas.length, 0, 'sin sesión no hay nada que sondear');
  } finally { sin.limpiar(); }

  const b = banco({});
  try {
    await abierta(b);
    const bueno = fs.readFileSync(b.rutaCaducidad, 'utf8');
    assert.equal(await b.correr(['estado', '--sin-red']), 0, 'control positivo: con el fichero bueno dice VIVA');

    // La cookie de hoy: la escribió un login anterior a este fichero (o una mano), sin caducidad.
    fs.rmSync(b.rutaCaducidad);
    assert.equal(await b.correr(['estado', '--sin-red']), 2);
    assert.match(b.err[0], /^NO SE PUEDE SABER — no hay fichero de caducidad/);

    fs.writeFileSync(b.rutaCaducidad, '{ esto no es json');
    assert.equal(await b.correr(['estado', '--sin-red']), 2);
    assert.match(b.err[0], /no se entiende/);

    fs.writeFileSync(b.rutaCaducidad, JSON.stringify({ ...JSON.parse(bueno), caducaEn: 'mañana' }));
    assert.equal(await b.correr(['estado', '--sin-red']), 2);
    assert.match(b.err[0], /no lleva una hora válida/);

    // Otra mano reescribe la cookie: el fichero bueno ya no habla de ella.
    fs.writeFileSync(b.rutaCaducidad, bueno);
    fs.writeFileSync(b.rutaSesion, 'pf_session=escrita-a-mano-1430\n');
    assert.equal(await b.correr(['estado', '--sin-red']), 2);
    assert.match(b.err[0], /de OTRA cookie/);
    assert.deepEqual(b.out, []);
    assert.ok(leerCaducidad(b.rutaCaducidad, COOKIE).caducaMs > 0, 'control: con SU cookie el mismo fichero sí vale');
  } finally { b.limpiar(); }
});

test('SCRUM-1430 · estado con sonda: un GET a /admin/me, y la hora que cuenta es la del servidor', async () => {
  const b = banco({});
  try {
    await abierta(b);
    b.reloj = APERTURA + 40 * HORA; // el reloj local dice que murió hace mucho; el servidor, que no
    b.responde = () => respuesta(200, '{"merchantId":46}', { date: fecha(APERTURA + 2 * HORA) });
    assert.equal(await b.correr(['estado']), 0, b.todo());
    assert.equal(b.llamadas.length, 1);
    assert.equal(b.llamadas[0].method, 'GET');
    assert.equal(b.llamadas[0].url, `https://yaqu.app${RUTA_SONDA}`);
    assert.equal(b.llamadas[0].headers.cookie, COOKIE);
    assert.equal(b.llamadas[0].body, undefined);
    assert.match(b.out[0], /^VIVA — GET \/admin\/me → 200 \(qa@example\.test\); .*dentro de 22 h 0 min \(hora del servidor\)/);
    assert.equal(b.todo().includes(TOKEN), false, 'la cookie aparece en la salida');
    assert.equal(b.todo().includes('merchantId'), false, 'estado no vuelca el cuerpo de la sonda');
  } finally { b.limpiar(); }
});

test('SCRUM-1430 · la sonda MANDA: 401 es MUERTA, y si llega antes de su hora nombra el logout', async () => {
  const b = banco({});
  try {
    await abierta(b);
    b.responde = () => respuesta(401, '{"error":"unauthorized"}', { date: fecha(APERTURA + 25 * HORA) });
    assert.equal(await b.correr(['estado']), 1);
    assert.match(b.err[0], /^MUERTA — GET \/admin\/me → 401/);
    assert.match(b.err[0], /caducó el 2026-10-02T13:18:30Z, hace 1 h 0 min/);
    assert.equal(/ANTES de su hora/.test(b.err[0]), false, 'una caducidad normal no acusa a nadie de logout');
    // MUERTA dice la cura ENTERA: el comando, con el correo de la sesión que murió.
    assert.match(b.err[1], /^SE RENUEVA con: node scripts\/qa\/sesion-panel\.mjs login qa@example\.test /);
    assert.match(b.err[1], /RUNBOOKS\.md R23/);
    assert.equal(b.err.join('\n').includes(SECRETO), false, 'la cura imprime el secreto');

    b.responde = () => respuesta(401, '', { date: fecha(APERTURA + 5 * HORA) });
    assert.equal(await b.correr(['estado']), 1);
    assert.match(b.err[0], /ANTES de su hora/);
    assert.match(b.err[0], /POST \/auth\/logout/);

    // Sin fichero de caducidad la sonda sigue contestando: es el caso de la cookie de hoy.
    fs.rmSync(b.rutaCaducidad);
    assert.equal(await b.correr(['estado']), 1);
    assert.match(b.err[0], /^MUERTA — .*caducidad no conocida/);
    assert.match(b.err[1], /^SE RENUEVA con: node scripts\/qa\/sesion-panel\.mjs login <correo de la cuenta> /);
    b.responde = () => respuesta(200, '{}', { date: fecha(APERTURA + 5 * HORA) });
    assert.equal(await b.correr(['estado']), 0);
    assert.match(b.out[0], /^VIVA — .*caducidad no conocida/);
  } finally { b.limpiar(); }
});

test('SCRUM-1430 · fail-closed de la sonda: 302, 404, 500, 503 y red caída → NO SE PUEDE SABER, nunca VIVA ni MUERTA', async () => {
  const b = banco({});
  try {
    await abierta(b);
    const casos = [
      ['302', () => respuesta(302, '', { location: 'https://yaqu.app/login' })],
      ['404', () => respuesta(404, 'Not Found')],
      ['500', () => respuesta(500, '')],
      ['503', () => respuesta(503, '')],
      ['red caída', () => { throw new Error('ECONNREFUSED'); }],
    ];
    for (const [nombre, responde] of casos) {
      b.responde = responde;
      assert.equal(await b.correr(['estado']), 2, nombre);
      assert.deepEqual(b.out, [], `${nombre}: escribió por stdout`);
      assert.match(b.err[0], /^NO SE PUEDE SABER — /, nombre);
    }
  } finally { b.limpiar(); }
});

test('SCRUM-1430 · get con 401 dice lo que su fichero sabe de la caducidad', async () => {
  const b = banco({});
  try {
    await abierta(b);
    b.responde = () => respuesta(401, '');
    assert.equal(await b.correr(['get', '/admin/jobs']), 1);
    assert.match(b.err.join('\n'), /caducó o no vale/);
    assert.match(b.err.join('\n'), /fichero de caducidad dice 2026-10-02T13:18:30Z/);
    fs.rmSync(b.rutaCaducidad);
    assert.equal(await b.correr(['get', '/admin/jobs']), 1);
    assert.match(b.err.join('\n'), /caducidad no conocida/);
  } finally { b.limpiar(); }
});

test('SCRUM-1430 · uso: un argumento que no es --sin-red sale 3 sin leer ni sondear', async () => {
  const b = banco({ responde: () => { throw new Error('no debía llamar'); } });
  try {
    assert.equal(await b.correr(['estado', '--sin-rde']), 3);
    assert.equal(b.llamadas.length, 0);
  } finally { b.limpiar(); }
});

test('SCRUM-1430 · el fichero de caducidad de verdad vive al lado de la sesión, fuera del repositorio', () => {
  const r = rutaCaducidadDe(RUTA_SESION);
  assert.ok(r.startsWith(RUTA_SESION), 'no vive al lado de la sesión');
  assert.ok(path.win32.isAbsolute(r));
  assert.equal(r.replace(/\\/g, '/').toLowerCase().startsWith(RAIZ.replace(/\\/g, '/').toLowerCase()), false, 'cae dentro del repo');
});

test('SCRUM-1430 · las 24 h del instrumento son las del servidor: el handler de test-login crea la sesión con la MISMA vida', () => {
  // Se LEE el camino del servidor, no se toca. Si allí cambian las 24 h y aquí no, `estado
  // --sin-red` diría VIVA de una sesión muerta (o al revés): este test es lo que lo impide.
  const fuente = fs.readFileSync(path.join(RAIZ, 'src', 'modules', 'auth', 'app', 'routes', 'auth.routes.ts'), 'utf8');
  const desde = fuente.indexOf("router.post('/test-login'");
  assert.ok(desde >= 0, 'no encuentro el handler de /test-login: el test no puede comparar nada');
  const hasta = fuente.indexOf('router.post(', desde + 1);
  const handler = fuente.slice(desde, hasta === -1 ? undefined : hasta);
  const vidas = [...handler.matchAll(/expiresAt:\s*new Date\(Date\.now\(\)\s*\+\s*([0-9*\s]+)\)/g)];
  assert.equal(vidas.length, 1, `esperaba UNA vida de sesión en el handler de test-login y hay ${vidas.length}`);
  const ms = vidas[0][1].split('*').map((n) => Number(n.trim())).reduce((a, n) => a * n, 1);
  assert.ok(Number.isFinite(ms) && ms > 0, `no sé leer «${vidas[0][1]}»`);
  assert.equal(VIDA_SESION_MS, ms, 'la vida de la sesión de test-login cambió en el servidor: cambia VIDA_SESION_MS con ella');
});
