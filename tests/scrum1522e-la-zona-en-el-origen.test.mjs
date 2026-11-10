// tests/scrum1522e-la-zona-en-el-origen.test.mjs — SCRUM-1522e
//
// Medido en SCRUM-1522 (Jira c.19288 y c.19294): ningún camino de `src/` escribía `timezone`. Todo
// comercio nuevo nacía con la zona a NULL, y sin zona el día se le cuenta en UTC: a uno peninsular,
// entre las 00:00 y las 02:00 de su reloj, el sistema le dice que todavía es ayer.
//
// Decidido por el fundador (Jira c.19297): la zona se guarda en el alta y sale de la PROVINCIA. De
// las 52, dos van con la hora de Canarias y las otras cincuenta con la peninsular.
//
// Cómo mide: el alta REAL de `dist/` —la consola del equipo, que es hoy la única puerta que crea
// comercios, y `registerMerchant` por debajo— contra una base en memoria que apunta qué se le pide
// a `merchant.create` (`_scrum1522e-doble-de-base.cjs`). No se copia la tabla aquí: se le pregunta
// a la de `dist/`.
//
// Lo que NO mide: que la columna de Postgres reciba el valor. Eso lo mide, en el banco desechable,
// `tests/scrum1515-nuestra-puerta-de-alta.test.mjs` (el comercio A nace allí en Las Palmas).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const GUION = path.join(RAIZ, 'dist', 'modules', 'auth', 'app', 'cli', 'altaDeMerchant.js');
const TABLA = path.join(RAIZ, 'dist', 'modules', 'auth', 'domain', 'zonaDeLaProvincia.js');
const DOBLE = path.join(RAIZ, 'tests', '_scrum1522e-doble-de-base.cjs');

const PENINSULA = 'Europe/Madrid';
const CANARIAS = 'Atlantic/Canary';

const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1522e-'));
test.after(() => fs.rmSync(carpeta, { recursive: true, force: true }));

let serie = 0;
/**
 * La consola, lanzada como la lanza una persona: otro proceso, desde una carpeta vacía y con SU
 * entorno escrito a mano (nada del runner). Delante va el doble de la base. Devuelve el código de
 * salida, lo que la consola DIJO y lo que se pidió crear.
 */
async function porLaConsola(campos) {
  assert.ok(fs.existsSync(GUION), `🔴 CIEGO: no existe ${path.relative(RAIZ, GUION)} (¿falta el build?)`);
  const apunte = path.join(carpeta, `altas-${++serie}.json`);
  const env = { SCRUM1522E_ALTAS_EN: apunte, SMTP_URL: '', RESEND_API_KEY: '', DISABLE_CRONS: 'true' };
  for (const k of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA']) if (process.env[k]) env[k] = process.env[k];
  const argumentos = Object.entries(campos).flatMap(([k, v]) => [`--${k}`, v]);
  const hijo = spawn(process.execPath, ['--require', DOBLE, GUION, ...argumentos], { cwd: carpeta, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let salida = ''; let errores = '';
  hijo.stdout.on('data', (d) => { salida += d; });
  hijo.stderr.on('data', (d) => { errores += d; });
  const reloj = setTimeout(() => hijo.kill(), 60_000);
  const codigo = await new Promise((ok) => hijo.on('close', (c, senal) => ok(senal ? `matado (${senal})` : c)));
  clearTimeout(reloj);
  // El testigo de que el doble corrió: sin su fichero, «0 altas» sería un proceso que no arrancó.
  assert.ok(fs.existsSync(apunte), `🔴 CIEGO: la consola no dejó su apunte (salió ${codigo})\n${salida}\n${errores}`);
  const { altas } = JSON.parse(fs.readFileSync(apunte, 'utf8'));
  const dicho = salida.split(/\r?\n/).filter((l) => l.startsWith('{"resultado"')).map((l) => JSON.parse(l));
  return { codigo, dicho: dicho.at(-1) ?? null, altas, salida, errores };
}

let correos = 0;
const correo = () => `alta-${++correos}-1522e@test.local`;

/** Un alta que TIENE que crear, y la zona con la que nace. */
async function naceEn(campos) {
  const r = await porLaConsola({ name: 'Reformas 1522e', email: correo(), ...campos });
  assert.equal(r.codigo, 0, `🔴 la consola tenía que crear y salió ${r.codigo}: ${JSON.stringify(campos)}\n${r.salida}\n${r.errores}`);
  assert.equal(r.altas.length, 1, `🔴 se esperaba UN alta y hubo ${r.altas.length}: ${JSON.stringify(campos)}`);
  assert.equal(r.dicho?.resultado, 'creado', `🔴 la consola salió 0 sin decir qué creó\n${r.salida}`);
  return { guardada: r.altas[0].timezone ?? null, dicha: r.dicho.merchant.timezone ?? null, pais: r.altas[0].country };
}

/** Un alta que NO puede crear: sale 2, dice por qué y no pide crear nada. */
async function noNace(campos, error) {
  const r = await porLaConsola({ name: 'Reformas 1522e', email: correo(), ...campos });
  assert.deepEqual([r.codigo, r.dicho?.error, r.altas.length], [2, error, 0],
    `🔴 ${JSON.stringify(campos)} tenía que rechazarse con «${error}» y sin crear nada\n${r.salida}\n${r.errores}`);
}

test('SCRUM-1522e · la tabla tiene las 52 provincias: dos con la hora de Canarias y cincuenta con la peninsular', () => {
  assert.ok(fs.existsSync(TABLA), `🔴 CIEGO: no existe ${path.relative(RAIZ, TABLA)} (¿falta el build?)`);
  const { zonaDeAlta } = requiere(TABLA);
  // La tabla no se copia ni se importa: se le pregunta a la función. Los nombres los dice su propio
  // rechazo, y la zona de cada uno, la misma llamada que hace el alta.
  let nombresDichos = [];
  assert.throws(() => zonaDeAlta('ES'), (e) => { nombresDichos = e.provincias; return e.code === 'provincia_required'; });
  assert.ok(Array.isArray(nombresDichos), '🔴 CIEGO: el rechazo no dice qué provincias admite la tabla');
  const PROVINCIAS = nombresDichos.map((nombre) => [nombre, zonaDeAlta('ES', nombre)]);
  const { zonaValida, diaNaturalEn } = requiere(path.join(RAIZ, 'dist', 'core', 'zonaDelMerchant.js'));
  assert.equal(PROVINCIAS.length, 52, `🔴 son 52 (50 provincias, Ceuta y Melilla) y la tabla tiene ${PROVINCIAS.length}`);

  const plano = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const nombres = PROVINCIAS.map(([nombre]) => plano(nombre));
  assert.equal(new Set(nombres).size, 52, '🔴 hay dos provincias que, sin tildes ni mayúsculas, se llaman igual');
  assert.ok(nombres.every((n) => n.length >= 4), '🔴 hay un nombre de provincia vacío o roto');

  const enCanarias = PROVINCIAS.filter(([, zona]) => zona === CANARIAS).map(([nombre]) => nombre).sort();
  const enPeninsula = PROVINCIAS.filter(([, zona]) => zona === PENINSULA);
  assert.deepEqual(enCanarias, ['Las Palmas', 'Santa Cruz de Tenerife'], '🔴 con la hora de Canarias van Las Palmas y Santa Cruz de Tenerife, y sólo ellas');
  assert.equal(enPeninsula.length, 50, `🔴 con la hora peninsular van 50 y hay ${enPeninsula.length}`);
  assert.equal(enCanarias.length + enPeninsula.length, PROVINCIAS.length, '🔴 hay una provincia con una zona que no es ninguna de las dos');
  for (const lugar of ['ceuta', 'melilla', 'illes balears']) {
    assert.ok(enPeninsula.some(([nombre]) => plano(nombre) === lugar), `🔴 ${lugar} no está entre las de la hora peninsular`);
  }

  // Las dos zonas son relojes que el motor conoce, y DISTINTOS: si fueran el mismo, la tabla no
  // distinguiría nada y todo lo de arriba seguiría en verde.
  assert.ok(zonaValida(CANARIAS) && zonaValida(PENINSULA), '🔴 el motor no conoce una de las dos zonas');
  assert.equal(zonaValida('Atlantic/Canarias'), false, '🔴 CIEGO: `zonaValida` da por buena una zona inventada');
  const medianoche = new Date('2026-07-15T22:30:00Z'); // 00:30 del 16 en la península, 23:30 del 15 en Canarias
  assert.deepEqual([diaNaturalEn(medianoche, PENINSULA), diaNaturalEn(medianoche, CANARIAS)], ['2026-07-16', '2026-07-15'],
    '🔴 la península y Canarias no están en días distintos a las 22:30Z de un día de verano');
});

// SCRUM-1536d: un alta de España contesta además las dos preguntas del domicilio fiscal (Jira
// SCRUM-1536 c.20225). Con «no» y «no» la zona sigue saliendo de la provincia, como aquí se mide.
const NO_NO = { 'domicilio-foral': 'no', 'domicilio-canarias': 'no' };

test('SCRUM-1522e · un alta de España guarda la zona de su provincia, y la consola dice cuál', async () => {
  // 🔵 SCRUM-1536d (decisión del fundador, Jira SCRUM-1536 c.20225 ①: Canarias fuera también por
  // dónde se trabaja): las dos de la hora de Canarias YA NO NACEN. Hasta el 22-oct este caso decía
  // que nacían con esa zona; ahora se comprueba que no crean nada, y por qué. Que la tabla les siga
  // dando la hora de Canarias lo mide el primer test de este fichero, y es lo que las deja fuera.
  await noNace({ provincia: '  las PALMAS ', ...NO_NO }, 'territorio_excluido');
  await noNace({ provincia: 'Santa Cruz de Tenerife', country: 'ES', ...NO_NO }, 'territorio_excluido');
  // Y de las otras cincuenta: una corriente, una con tilde tecleada sin ella y Ceuta.
  assert.deepEqual(await naceEn({ provincia: 'Madrid', ...NO_NO }), { guardada: PENINSULA, dicha: PENINSULA, pais: 'ES' });
  assert.deepEqual(await naceEn({ provincia: 'a coruna', ...NO_NO }), { guardada: PENINSULA, dicha: PENINSULA, pais: 'ES' });
  assert.deepEqual(await naceEn({ provincia: 'Ceuta', ...NO_NO }), { guardada: PENINSULA, dicha: PENINSULA, pais: 'ES' });
});

test('SCRUM-1522e · un comercio de España sin provincia no se crea: ni a NULL ni de ninguna manera', async () => {
  await noNace({}, 'provincia_required'); // el alta de antes: sólo nombre y correo
  await noNace({ country: 'es' }, 'provincia_required'); // el país en minúsculas sigue siendo España
  await noNace({ provincia: '   ' }, 'provincia_required');
  await noNace({ provincia: 'Lisboa' }, 'provincia_desconocida');
  // El positivo de esas mismas negaciones: con la provincia, ese país en minúsculas SÍ crea.
  assert.deepEqual(await naceEn({ country: 'es', provincia: 'Lugo', ...NO_NO }), { guardada: PENINSULA, dicha: PENINSULA, pais: 'es' });
});

test('SCRUM-1522e · fuera de España el comercio nace sin zona, como hasta hoy: no hay tabla de otros países', async () => {
  assert.deepEqual(await naceEn({ country: 'PT' }), { guardada: null, dicha: null, pais: 'PT' });
  // Una provincia de la tabla no vale para otro país: no se guarda una zona que nadie ha medido.
  await noNace({ country: 'PT', provincia: 'Madrid' }, 'provincia_desconocida');
});

test('SCRUM-1522e · el origen mismo: `registerMerchant` no deja crear un comercio de España sin zona, lo llame quien lo llame', async () => {
  process.env.SMTP_URL = '';
  process.env.RESEND_API_KEY = '';
  const { altas } = requiere(DOBLE); // delante de `dist/`: pone la base en memoria en su sitio
  const { registerMerchant } = requiere(path.join(RAIZ, 'dist', 'modules', 'auth', 'domain', 'auth.service.js'));

  await assert.rejects(registerMerchant({ name: 'Sin provincia', email: 'origen-1-1522e@test.local' }), { code: 'provincia_required' },
    '🔴 EL ORIGEN SIGUE ABIERTO: `registerMerchant` crea un comercio de España sin provincia');
  await assert.rejects(registerMerchant({ name: 'Provincia rara', email: 'origen-2-1522e@test.local', country: 'ES', provincia: 'Lisboa' }), { code: 'provincia_desconocida' });
  assert.equal(altas.length, 0, `🔴 un alta rechazada llegó a pedir un \`merchant.create\`: ${JSON.stringify(altas)}`);

  // SCRUM-1536d: con la provincia, las dos respuestas del domicilio; y una de Canarias ya no nace
  // (Jira SCRUM-1536 c.20225), así que la que nace con zona es peninsular.
  await assert.rejects(registerMerchant({ name: 'En Canarias', email: 'origen-5-1522e@test.local', provincia: 'Santa Cruz de Tenerife', domicilio: { foral: false, canarias: false } }), { code: 'territorio_excluido' });
  await registerMerchant({ name: 'Con provincia', email: 'origen-3-1522e@test.local', provincia: 'Valencia', domicilio: { foral: false, canarias: false } });
  await registerMerchant({ name: 'De fuera', email: 'origen-4-1522e@test.local', country: 'MX' });
  assert.deepEqual(altas.map((a) => [a.email, a.country, a.timezone]), [
    ['origen-3-1522e@test.local', 'ES', PENINSULA],
    ['origen-4-1522e@test.local', 'MX', null],
  ]);
  // Lo que no puede volver a pasar, dicho sobre TODO lo que se pidió crear: ninguno de España sin zona.
  const deEspana = altas.filter((a) => String(a.country).trim().toUpperCase() === 'ES');
  assert.ok(deEspana.length >= 1, '🔴 CIEGO: no se ha creado ningún comercio de España con el que comprobarlo');
  assert.deepEqual(deEspana.filter((a) => a.timezone !== CANARIAS && a.timezone !== PENINSULA), [], '🔴 UN COMERCIO DE ESPAÑA HA NACIDO SIN ZONA');
});
