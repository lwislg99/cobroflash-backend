// tests/scrum1536d-forales-y-canarias-fuera.test.mjs — SCRUM-1536d
//
// Decidido por el fundador (Jira SCRUM-1536 c.20218 y c.20225): los domicilios fiscales forales
// (País Vasco y Navarra) y Canarias NO ENTRAN en YaQu por ahora, y Canarias tampoco para quien
// trabaja allí con el domicilio fuera. Diseño: tramo «SCRUM-1536c» de `docs/master/SCRUM-1536.md`.
//
// Cómo mide, por las puertas reales:
//   · A · el ALTA, por la consola del equipo (`altaDeMerchant.js`, la única puerta que crea hoy:
//     `POST /auth/register` da 409) y `registerMerchant` por debajo, contra la base en memoria de
//     SCRUM-1522e, que apunta qué se le pide a `merchant.create`. Un alta foral, una canaria por
//     domicilio, dos por trabajo en Canarias y, de CONTROL, Madrid y Bizkaia, que sí se crean.
//   · B · AJUSTES, por la RUTA `PUT /admin/merchant` de `dist/app.js`, con su sesión y su
//     `requireRole`: no se saca el manejador de su ruta.
//   · La PANTALLA: la sentencia del `catch` de Empresa en `settingsView.js`, ejecutada con el error
//     que devuelve la ruta y el `mensajeParaPersona` de `api.js`.
//   · Los TEXTOS: los de `dist/` contra la ficha firmada de `docs/microcopy/`.
//
// Lo que NO mide: Postgres (la columna la mide `scrum1515` en el banco desechable), ni yaqu.app.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { aprobacionesDeMicrocopy } from './_microcopy-aprobada.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const GUION = path.join(RAIZ, 'dist', 'modules', 'auth', 'app', 'cli', 'altaDeMerchant.js');
const DOBLE = path.join(RAIZ, 'tests', '_scrum1522e-doble-de-base.cjs');
const REGLA = path.join(RAIZ, 'dist', 'modules', 'auth', 'domain', 'territorioDeAlta.js');
const FICHA = 'docs/microcopy/2026-10-22-SCRUM-1536-exclusion-territorial.md';

/**
 * Las mutaciones que este test tiene que tumbar, con el contrato del meta-guard
 * (`scripts/meta-guard-mutaciones.mjs`): sin la puerta del alta (el código de antes), sin la vía
 * del trabajo en Canarias, y sin el rechazo de Ajustes.
 */
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'src/modules/auth/domain/auth.service.ts', de: 'const domicilioFiscalForal = territorioDeAlta(country, timezone, params.domicilio);', a: 'const domicilioFiscalForal = false as const;', cae: 'A · el alta: forales y Canarias no se crean' },
  { fichero: 'src/modules/auth/domain/territorioDeAlta.ts', de: "if (zona === ZONA_DE_CANARIAS) throw rechazo('territorio_excluido', 'trabajo');", a: '', cae: 'A · el alta: forales y Canarias no se crean' },
  { fichero: 'src/modules/system/merchantAdmin.ts', de: 'if (data.domicilioFiscalForal === true) throw new TerritorioError();', a: '', cae: 'B · Ajustes' },
];

const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1536d-'));
test.after(() => fs.rmSync(carpeta, { recursive: true, force: true }));

let serie = 0;
/** La consola, lanzada como la lanza una persona (mismo arnés que scrum1522e). */
async function porLaConsola(campos) {
  assert.ok(fs.existsSync(GUION), `🔴 CIEGO: no existe ${path.relative(RAIZ, GUION)} (¿falta el build?)`);
  const apunte = path.join(carpeta, `altas-${++serie}.json`);
  const env = { SCRUM1522E_ALTAS_EN: apunte, SMTP_URL: '', RESEND_API_KEY: '', DISABLE_CRONS: 'true' };
  for (const k of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA']) if (process.env[k]) env[k] = process.env[k];
  const argumentos = Object.entries({ name: 'Reformas 1536d', email: `alta-${serie}-1536d@test.local`, ...campos }).flatMap(([k, v]) => [`--${k}`, v]);
  const hijo = spawn(process.execPath, ['--require', DOBLE, GUION, ...argumentos], { cwd: carpeta, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let salida = ''; let errores = '';
  hijo.stdout.on('data', (d) => { salida += d; });
  hijo.stderr.on('data', (d) => { errores += d; });
  const reloj = setTimeout(() => hijo.kill(), 60_000);
  const codigo = await new Promise((ok) => hijo.on('close', (c, senal) => ok(senal ? `matado (${senal})` : c)));
  clearTimeout(reloj);
  assert.ok(fs.existsSync(apunte), `🔴 CIEGO: la consola no dejó su apunte (salió ${codigo})\n${salida}\n${errores}`);
  const { altas } = JSON.parse(fs.readFileSync(apunte, 'utf8'));
  const dicho = salida.split(/\r?\n/).filter((l) => l.startsWith('{"resultado"')).map((l) => JSON.parse(l)).at(-1) ?? null;
  return { codigo, dicho, altas, salida, errores };
}

const NO_NO = { 'domicilio-foral': 'no', 'domicilio-canarias': 'no' };

/** Los textos de quien queda fuera en el alta, tal como los lleva el rechazo de la regla de `dist/`. */
function textosDelAlta() {
  const { territorioDeAlta } = requiere(REGLA);
  const texto = (...args) => { try { territorioDeAlta(...args); } catch (e) { return e.texto; } return null; };
  return { T1A: texto('ES', 'Europe/Madrid', { foral: true, canarias: false }), T1A_TRABAJO: texto('ES', 'Atlantic/Canary', { foral: false, canarias: false }) };
}

test('SCRUM-1536d · A · el alta: forales y Canarias no se crean, con su texto firmado; Madrid y Bizkaia sí', async () => {
  const { T1A, T1A_TRABAJO } = textosDelAlta();
  const fuera = async (campos, motivo, texto) => {
    const r = await porLaConsola(campos);
    assert.deepEqual([r.codigo, r.dicho?.error, r.dicho?.motivo, r.dicho?.texto, r.altas.length], [2, 'territorio_excluido', motivo, texto, 0],
      `🔴 ${JSON.stringify(campos)} tenía que quedar fuera por «${motivo}» sin crear nada\n${r.salida}\n${r.errores}`);
  };
  // Las cuatro vías por las que se queda fuera.
  await fuera({ provincia: 'Madrid', 'domicilio-foral': 'si', 'domicilio-canarias': 'no' }, 'domicilio', T1A);
  await fuera({ provincia: 'Madrid', 'domicilio-foral': 'no', 'domicilio-canarias': 'SÍ' }, 'domicilio', T1A);
  await fuera({ provincia: '  las PALMAS ', ...NO_NO }, 'trabajo', T1A_TRABAJO);
  await fuera({ provincia: 'Santa Cruz de Tenerife', ...NO_NO }, 'trabajo', T1A_TRABAJO);
  // Con las dos razones a la vez manda el domicilio: es la frase que cubre las dos.
  await fuera({ provincia: 'Las Palmas', 'domicilio-foral': 'no', 'domicilio-canarias': 'si' }, 'domicilio', T1A);

  // CONTROL: los que entran. Bizkaia también: lo foral va por domicilio, no por dónde se trabaja.
  for (const provincia of ['Madrid', 'Bizkaia']) {
    const r = await porLaConsola({ provincia, ...NO_NO });
    assert.deepEqual([r.codigo, r.dicho?.resultado, r.altas.length], [0, 'creado', 1], `🔴 ${provincia} con «no» y «no» tenía que crearse\n${r.salida}\n${r.errores}`);
    assert.deepEqual([r.altas[0].timezone, r.altas[0].domicilioFiscalForal], ['Europe/Madrid', false], `🔴 ${provincia}: el alta no guarda la zona y el «no» foral`);
  }
});

test('SCRUM-1536d · A · en España las dos respuestas son obligatorias; fuera de España no se preguntan', async () => {
  const sinCrear = async (campos, error) => {
    const r = await porLaConsola(campos);
    assert.deepEqual([r.codigo, r.dicho?.error, r.altas.length], [2, error, 0], `🔴 ${JSON.stringify(campos)} tenía que rechazarse con «${error}»\n${r.salida}\n${r.errores}`);
  };
  await sinCrear({ provincia: 'Madrid' }, 'domicilio_fiscal_required');
  await sinCrear({ provincia: 'Madrid', 'domicilio-foral': 'no' }, 'domicilio_fiscal_required');
  await sinCrear({ provincia: 'Madrid', 'domicilio-foral': 'quizá', 'domicilio-canarias': 'no' }, 'argumentos');
  await sinCrear({ country: 'PT', ...NO_NO }, 'domicilio_fiscal_desconocido');
  // La provincia se sigue mirando antes: el alta de antes (sin nada) dice lo que decía.
  await sinCrear({}, 'provincia_required');
  // Positivo de la última negación: PT sin respuestas sí se crea, sin zona y sin respuesta foral.
  const pt = await porLaConsola({ country: 'PT' });
  assert.deepEqual([pt.codigo, pt.altas.length, pt.altas[0]?.timezone, 'domicilioFiscalForal' in (pt.altas[0] ?? {})], [0, 1, null, false], `🔴 un alta de Portugal sin respuestas tenía que crearse como hasta hoy\n${pt.salida}`);
});

test('SCRUM-1536d · los tres textos de `dist/` son, letra a letra, los de la ficha firmada', () => {
  const textos = { ...textosDelAlta(), T2A: requiere(REGLA).TEXTO_FORAL_EN_AJUSTES };
  const ficha = aprobacionesDeMicrocopy().find((a) => a.ruta.replaceAll('\\', '/').endsWith(FICHA));
  assert.ok(ficha, `🔴 CIEGO: no encuentro la ficha ${FICHA} entre las aprobaciones`);
  assert.ok(ficha.aprobada, `🔴 la ficha ${FICHA} no cuenta como aprobada`);
  for (const [nombre, texto] of Object.entries(textos)) {
    assert.ok(typeof texto === 'string' && texto.length > 20, `🔴 CIEGO: ${nombre} no es un texto`);
    assert.ok(ficha.literales.includes(texto), `🔴 ${nombre} no es literal de la ficha firmada: «${texto}»`);
  }
  assert.equal(new Set(Object.values(textos)).size, 3, '🔴 CIEGO: dos de los tres textos son el mismo');
  // Control negativo con el mismo lector: un texto descartado en c.20225 (T1b) no consta en ella.
  assert.ok(!ficha.literales.includes('Lo sentimos: de momento YaQu no está disponible en el País Vasco, Navarra ni Canarias.'), '🔴 CIEGO: la ficha da por firmado un texto descartado');
});

test('SCRUM-1536d · B · Ajustes: «Sí» foral se rechaza por la RUTA con el texto firmado y no se guarda nada; la pantalla lo pinta', async () => {
  const { TEXTO_FORAL_EN_AJUSTES: T2A } = requiere(REGLA);
  process.env.SMTP_URL = '';
  process.env.RESEND_API_KEY = '';
  process.env.DISABLE_CRONS = 'true';
  const { db } = requiere(DOBLE); // la base en memoria, delante de `dist/`
  // La sesión del propietario del comercio 7: lo único que `requireAuth` pide a la base. El doble
  // no deja cambiar sus tablas genéricas (cada lectura da una nueva), así que se pone delante.
  const escrituras = [];
  const hoy = Date.now();
  const sesion = { findUnique: async () => ({ id: 1, type: 'session', token: 't', merchantId: 7, teamMemberId: null, teamMember: null, expiresAt: new Date(hoy + 3_600_000),
    merchant: { id: 7, name: 'Reformas 1536d', email: 'b-1536d@test.local', plan: 'pro', planExpiresAt: null, onboardingCompleted: true, isPlatformOwner: false } }) };
  db.merchant.update = async (a) => { escrituras.push(a); return { id: 7, ...a.data }; };
  const fP = requiere.resolve(path.join(RAIZ, 'dist', 'core', 'db', 'prisma.js'));
  requiere.cache[fP].exports.prisma = new Proxy({}, { get: (_t, nombre) => (nombre === 'authSession' ? sesion : db[nombre]) });
  const { app } = requiere(path.join(RAIZ, 'dist', 'app.js'));
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const guardar = (cuerpo) => new Promise((resolve, reject) => {
    const datos = Buffer.from(JSON.stringify(cuerpo));
    const req = http.request({ host: '127.0.0.1', port: server.address().port, path: '/admin/merchant', method: 'PUT', agent: false,
      headers: { 'Content-Type': 'application/json', 'Content-Length': datos.length, Cookie: 'pf_session=t' } },
    (res) => { let d = ''; res.setEncoding('utf8'); res.on('data', (t) => { d += t; }); res.on('end', () => resolve({ status: res.statusCode, texto: d })); });
    req.on('error', reject);
    req.end(datos);
  });
  try {
    const si = await guardar({ name: 'Reformas 1536d', domicilioFiscalForal: true });
    assert.equal(si.status, 409, `🔴 el «Sí» foral tenía que dar 409 y dio ${si.status}: ${si.texto.slice(0, 200)}`);
    const cuerpo = JSON.parse(si.texto);
    assert.deepEqual(cuerpo, { error: 'territorio_excluido', message: T2A }, '🔴 la ruta no contesta el código y el texto firmado, con dos claves y ninguna más');
    assert.equal(escrituras.length, 0, `🔴 EL «SÍ» FORAL SE HA GUARDADO (o algo de su formulario): ${JSON.stringify(escrituras)}`);
    // CONTROL: «No» y «no consta» se guardan, por la misma ruta y la misma sesión.
    for (const valor of [false, null]) {
      const r = await guardar({ name: 'Reformas 1536d', domicilioFiscalForal: valor });
      assert.equal(r.status, 200, `🔴 domicilioFiscalForal=${valor} tenía que guardarse y dio ${r.status}: ${r.texto.slice(0, 200)}`);
    }
    assert.deepEqual(escrituras.map((e) => [e.where.id, e.data.domicilioFiscalForal]), [[7, false], [7, null]], '🔴 «No» y «no consta» no llegaron al update del comercio de la sesión');

    // LA PANTALLA: la sentencia del `catch` de Empresa, ejecutada con el error que da `apiRequest`
    // para ese 409 (`err.code` y `err.data`, api.js) y el `mensajeParaPersona` real de `api.js`.
    const vista = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'js', 'settingsView.js'), 'utf8');
    const sentencia = vista.match(/if \(err && err\.code === "territorio_excluido"\)[^\n]*\n\s*else setAlert\([^\n]*\);/);
    assert.ok(sentencia, '🔴 CIEGO: no encuentro en settingsView.js la rama de `territorio_excluido` del guardado de Empresa');
    const api = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'js', 'api.js'), 'utf8');
    const funcion = api.match(/function mensajeParaPersona\(err, respaldo\) \{[\s\S]*?\n\}/);
    assert.ok(funcion, '🔴 CIEGO: no encuentro `mensajeParaPersona` en api.js');
    const pinta = (err) => { const avisos = []; new Function('err', 'setAlert', `${funcion[0]}\n${sentencia[0]}`)(err, (tipo, texto) => avisos.push([tipo, texto])); return avisos; };
    const err = Object.assign(new Error(cuerpo.message), { status: 409, code: cuerpo.error, data: cuerpo });
    assert.deepEqual(pinta(err), [['error', T2A]], '🔴 la pantalla no pinta el texto firmado, entero y solo');
    assert.deepEqual(pinta(Object.assign(new Error('API 500: internal_error'), { code: 'internal_error' })), [['error', 'Error al guardar: API 500: internal_error']],
      '🔴 CIEGO: cualquier otro error ya no cae en el aviso de siempre');
  } finally {
    await new Promise((r) => server.close(r));
  }
});
