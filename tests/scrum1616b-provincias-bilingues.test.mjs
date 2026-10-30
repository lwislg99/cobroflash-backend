// tests/scrum1616b-provincias-bilingues.test.mjs — SCRUM-1616b
//
// Firmado por el fundador (Jira SCRUM-1616 c.21066, sobre la medición de c.21062): la tabla de
// `zonaDeLaProvincia` acepta las cuatro formas dobles del INE (Araba/Álava · Alicante/Alacant ·
// Castellón/Castelló · Valencia/València) y el código INE (01…52, Ceuta 51 y Melilla 52), sin dejar
// de aceptar los nombres de hoy; y el alta por consola (`--provincia`) admite las dos cosas.
//
// Cómo mide: la función de `dist/` (la misma llamada que hace el alta) y, para la consola, el alta
// REAL de `dist/` contra la base en memoria de SCRUM-1522e (`_scrum1522e-doble-de-base.cjs`).
//
// Lo que NO mide: que la lista de nombres que da el rechazo siga siendo la misma (eso lo cuenta
// `scrum1522e`, que exige 52 nombres distintos), ni Postgres, ni yaqu.app.
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

/**
 * Las mutaciones que este test tiene que tumbar, con el contrato del meta-guard
 * (`scripts/meta-guard-mutaciones.mjs`): sin los códigos y sin las formas dobles (el código de antes).
 */
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'src/modules/auth/domain/zonaDeLaProvincia.ts', de: '  ...ZONA_POR_CODIGO,', a: '', cae: 'el código INE' },
  { fichero: 'src/modules/auth/domain/zonaDeLaProvincia.ts', de: '  ...FORMAS_DOBLES.map(([doble, ine]) => [plano(doble), ZONA_POR_CODIGO.get(ine)] as const),', a: '', cae: 'las cuatro formas dobles' },
];

/**
 * Código INE → el nombre que la tabla lleva hoy. Fuente: INE, «Relación de provincias con sus
 * códigos» (https://www.ine.es/daco/daco42/codmun/cod_provincia.htm), cotejada fila a fila en el
 * tramo J4 de `docs/master/SCRUM-1616.md` (descargada el 27-oct-2026, 15:27:26Z).
 */
const INE = {
  '01': 'Álava', '02': 'Albacete', '03': 'Alicante', '04': 'Almería', '05': 'Ávila', '06': 'Badajoz',
  '07': 'Illes Balears', '08': 'Barcelona', '09': 'Burgos', '10': 'Cáceres', '11': 'Cádiz', '12': 'Castellón',
  '13': 'Ciudad Real', '14': 'Córdoba', '15': 'A Coruña', '16': 'Cuenca', '17': 'Girona', '18': 'Granada',
  '19': 'Guadalajara', '20': 'Gipuzkoa', '21': 'Huelva', '22': 'Huesca', '23': 'Jaén', '24': 'León',
  '25': 'Lleida', '26': 'La Rioja', '27': 'Lugo', '28': 'Madrid', '29': 'Málaga', '30': 'Murcia',
  '31': 'Navarra', '32': 'Ourense', '33': 'Asturias', '34': 'Palencia', '35': 'Las Palmas', '36': 'Pontevedra',
  '37': 'Salamanca', '38': 'Santa Cruz de Tenerife', '39': 'Cantabria', '40': 'Segovia', '41': 'Sevilla', '42': 'Soria',
  '43': 'Tarragona', '44': 'Teruel', '45': 'Toledo', '46': 'Valencia', '47': 'Valladolid', '48': 'Bizkaia',
  '49': 'Zamora', '50': 'Zaragoza', '51': 'Ceuta', '52': 'Melilla',
};

/** Las cuatro formas dobles del INE (c.21066 ②) y la mitad castellana que la tabla ya lleva. */
const DOBLES = [['Araba/Álava', 'Álava'], ['Alicante/Alacant', 'Alicante'], ['Castellón/Castelló', 'Castellón'], ['Valencia/València', 'Valencia']];

function tabla() {
  assert.ok(fs.existsSync(TABLA), `🔴 CIEGO: no existe ${path.relative(RAIZ, TABLA)} (¿falta el build?)`);
  return requiere(TABLA).zonaDeAlta;
}

/** El código del rechazo, o `null` si no lanzó. */
function rechazo(zonaDeAlta, ...args) {
  try { zonaDeAlta(...args); } catch (e) { return e.code; }
  return null;
}

test('SCRUM-1616b · los nombres de hoy siguen dando la misma zona, y el mapa INE los cubre a todos', () => {
  const zonaDeAlta = tabla();
  let nombres = [];
  assert.throws(() => zonaDeAlta('ES'), (e) => { nombres = e.provincias; return e.code === 'provincia_required'; });
  // Control: el mapa del test nombra exactamente las 52 de la tabla. Si no, lo de abajo mide otra lista.
  assert.deepEqual([...Object.values(INE)].sort(), [...nombres].sort(), '🔴 el mapa INE del test no es la lista de nombres de la tabla');
  const canarias = nombres.filter((n) => zonaDeAlta('ES', n) === CANARIAS).sort();
  assert.deepEqual(canarias, ['Las Palmas', 'Santa Cruz de Tenerife'], '🔴 Las Palmas y Santa Cruz de Tenerife ya no son las de Canarias');
  assert.equal(nombres.filter((n) => zonaDeAlta('ES', n) === PENINSULA).length, 50, '🔴 las 50 peninsulares ya no dan la hora peninsular');
});

test('SCRUM-1616b · el código INE: 01…52 dan la zona de su provincia', () => {
  const zonaDeAlta = tabla();
  const mal = Object.entries(INE).filter(([ine, nombre]) => {
    try { return zonaDeAlta('ES', ine) !== zonaDeAlta('ES', nombre); } catch { return true; }
  }).map(([ine]) => ine);
  assert.deepEqual(mal, [], `🔴 códigos INE que no dan la zona de su provincia: ${mal.join(', ')}`);
  assert.deepEqual([zonaDeAlta('ES', '35'), zonaDeAlta('ES', '38')], [CANARIAS, CANARIAS], '🔴 35 y 38 no dan la hora de Canarias');
  assert.deepEqual([zonaDeAlta('ES', '51'), zonaDeAlta('ES', '52')], [PENINSULA, PENINSULA], '🔴 Ceuta (51) y Melilla (52) no dan la hora peninsular');
  assert.equal(zonaDeAlta('ES', ' 46 '), PENINSULA, '🔴 un código con espacios alrededor no se reconoce');
  // Lo que NO es un código INE sigue sin serlo.
  for (const no of ['00', '53', '99', '1', '046']) {
    assert.equal(rechazo(zonaDeAlta, 'ES', no), 'provincia_desconocida', `🔴 «${no}» no es un código INE y se ha aceptado`);
  }
  assert.equal(rechazo(zonaDeAlta, 'MX', '28'), 'provincia_desconocida', '🔴 con otro país, un código INE tiene que rechazarse como cualquier provincia');
});

test('SCRUM-1616b · las cuatro formas dobles del INE dan la zona de su mitad castellana', () => {
  const zonaDeAlta = tabla();
  for (const [doble, castellano] of DOBLES) {
    assert.notEqual(rechazo(zonaDeAlta, 'ES', doble), 'provincia_desconocida', `🔴 «${doble}» da provincia_desconocida`);
    assert.equal(zonaDeAlta('ES', doble), zonaDeAlta('ES', castellano), `🔴 «${doble}» no da la zona de «${castellano}»`);
    // Como los nombres de hoy: sin tildes ni mayúsculas también.
    assert.equal(zonaDeAlta('ES', doble.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()), PENINSULA, `🔴 «${doble}» sin tildes y en mayúsculas no se reconoce`);
  }
  // Control: la otra mitad SOLA no se ha firmado, y no entra.
  for (const no of ['Araba', 'Alacant', 'Castelló', 'València/']) {
    assert.equal(rechazo(zonaDeAlta, 'ES', no), 'provincia_desconocida', `🔴 «${no}» no está firmado y se ha aceptado`);
  }
});

const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1616b-'));
test.after(() => fs.rmSync(carpeta, { recursive: true, force: true }));

let serie = 0;
/** La consola, lanzada como la lanza una persona (mismo arnés que scrum1522e y scrum1536d). */
async function porLaConsola(campos) {
  assert.ok(fs.existsSync(GUION), `🔴 CIEGO: no existe ${path.relative(RAIZ, GUION)} (¿falta el build?)`);
  const apunte = path.join(carpeta, `altas-${++serie}.json`);
  const env = { SCRUM1522E_ALTAS_EN: apunte, SMTP_URL: '', RESEND_API_KEY: '', DISABLE_CRONS: 'true' };
  for (const k of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA']) if (process.env[k]) env[k] = process.env[k];
  const argumentos = Object.entries({ name: 'Reformas 1616b', email: `alta-${serie}-1616b@test.local`, 'domicilio-foral': 'no', 'domicilio-canarias': 'no', ...campos }).flatMap(([k, v]) => [`--${k}`, v]);
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

test('SCRUM-1616b · la consola: --provincia admite la forma doble y el código INE', async () => {
  for (const provincia of ['Valencia/València', '28']) {
    const r = await porLaConsola({ provincia });
    assert.deepEqual([r.codigo, r.dicho?.resultado, r.altas.length, r.altas[0]?.timezone], [0, 'creado', 1, PENINSULA],
      `🔴 --provincia «${provincia}» tenía que crear con la hora peninsular\n${r.salida}\n${r.errores}`);
  }
  // Un código canario cae por la vía del trabajo en Canarias, igual que su nombre (SCRUM-1536d).
  const canaria = await porLaConsola({ provincia: '35' });
  assert.deepEqual([canaria.codigo, canaria.dicho?.error, canaria.dicho?.motivo, canaria.altas.length], [2, 'territorio_excluido', 'trabajo', 0],
    `🔴 --provincia 35 (Las Palmas) tenía que quedar fuera por trabajo en Canarias\n${canaria.salida}\n${canaria.errores}`);
  // Y uno que no existe se rechaza con el mismo mensaje de hoy: los mismos 52 nombres.
  const nula = await porLaConsola({ provincia: '53' });
  assert.deepEqual([nula.codigo, nula.dicho?.error, nula.dicho?.provincias?.length, nula.altas.length], [2, 'provincia_desconocida', 52, 0],
    `🔴 --provincia 53 tenía que rechazarse con la lista de 52 nombres\n${nula.salida}\n${nula.errores}`);
});
