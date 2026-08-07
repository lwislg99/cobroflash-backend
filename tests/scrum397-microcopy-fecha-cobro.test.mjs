// tests/scrum397-microcopy-fecha-cobro.test.mjs — SCRUM-397
//
// El microcopy oficial de la fecha de cobro no puede nombrar un mecanismo APAGADO o INALCANZABLE.
// Se devolvieron DOS versiones por esto: una nombraba «Bizum automático» (que no existe en
// pantalla) y otra «efectivo» (que ninguna ruta escribe). Los dos Bizum están en `false`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ANCLA, MECANISMOS, valorDeBandera, estaVivo, extraerMicrocopys, comprobar, comprobarEnDisco,
} from '../scripts/_guard-microcopy-mecanismo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const APROBADO = 'Los cobros con tarjeta los confirma la pasarela: la fecha y la hora las pone ' +
  'ella, no tú. Los que marcas tú a mano quedan con la fecha en que los marcaste.';

// Estado REAL de hoy, escrito a mano para que el test no dependa de leer el repo.
const FLAGS_HOY = `  BIZUM_MANUAL_ENABLED: false,\n  BIZUM_AUTO_ENABLED: false,\n  OTRA: true,`;
const CODIGO_HOY = `method: 'card', method: 'bizum_manual', method: 'mp'`; // 'cash' NO aparece
const doc = (texto) => [{ ruta: 'docs/master/SCRUM-397.md', texto: `<!-- ${ANCLA} -->\n> ${texto}` }];

// ── ① EL CASO: las dos versiones devueltas vuelven a caer ────────────────────────────────

test('SCRUM-397 · 🔴 si la frase vuelve a nombrar BIZUM, el guard cae', () => {
  const r = comprobar({
    ficheros: doc('Cuando te pagan con tarjeta o Bizum, la fecha del cobro la registra la pasarela, no tú.'),
    fuenteFlags: FLAGS_HOY, fuenteCodigo: CODIGO_HOY,
  });
  assert.equal(r.ok, false, '🔴 dejó pasar la 1ª versión devuelta: nombra un mecanismo apagado');
  assert.match(r.salida, /bizum/i, '🔴 no NOMBRA el mecanismo que está apagado');
  assert.match(r.salida, /BIZUM_MANUAL_ENABLED=false/, '🔴 no dice POR QUÉ está apagado, con su bandera');
  assert.match(r.salida, /APAGADO/);
});

test('SCRUM-397 · 🔴 si vuelve a nombrar EFECTIVO, el guard cae — y por otro motivo', () => {
  const r = comprobar({
    ficheros: doc('Tarjeta y Bizum se confirman solos. Transferencia y efectivo los confirmas tú.'),
    fuenteFlags: FLAGS_HOY, fuenteCodigo: CODIGO_HOY,
  });
  assert.equal(r.ok, false, '🔴 dejó pasar la 2ª versión devuelta');
  // El efectivo no está apagado por bandera: es que NADIE lo escribe. El motivo tiene que decirlo.
  assert.match(r.salida, /ninguna ruta del código lo escribe|inalcanzable/,
    '🔴 dice que está «apagado» cuando el problema es que es INALCANZABLE. Son dos cosas distintas ' +
    'y quien lea el rojo tiene que saber cuál le toca arreglar.');
});

// ── ② CONTROL POSITIVO ───────────────────────────────────────────────────────────────────

test('SCRUM-397 · CONTROL POSITIVO: la frase APROBADA pasa', () => {
  const r = comprobar({ ficheros: doc(APROBADO), fuenteFlags: FLAGS_HOY, fuenteCodigo: CODIGO_HOY });
  assert.equal(r.ok, true,
    `🔴 bloqueó la frase aprobada por el fundador: ${r.salida}. Un guard que no deja pasar el ` +
    'texto oficial se desactiva el primer día.');
  assert.match(r.salida, /tarjeta.*vivo/i);
});

// ── ③ VIGILA EL HECHO, NO LA PALABRA ─────────────────────────────────────────────────────

test('SCRUM-397 · 🔴 con BIZUM_MANUAL_ENABLED encendido, nombrar Bizum PASA', () => {
  // Lo que hace sostenible el guard: el día que se encienda, no hay que tocarlo.
  const encendido = `  BIZUM_MANUAL_ENABLED: true,\n  BIZUM_AUTO_ENABLED: false,`;
  const r = comprobar({
    ficheros: doc('Los cobros con tarjeta y Bizum los confirma la pasarela.'),
    fuenteFlags: encendido, fuenteCodigo: CODIGO_HOY,
  });
  assert.equal(r.ok, true,
    '🔴 sigue bloqueando Bizum con su bandera ENCENDIDA. Entonces no vigila el mecanismo: vigila ' +
    'la palabra, y habría que desactivarlo el día que se encienda — que es como mueren los guards.');
});

test('SCRUM-397 · 🔴 y si se apagara la TARJETA, la frase aprobada dejaría de pasar', () => {
  // El otro sentido: el guard no da por buena la frase para siempre.
  const sinTarjeta = `method: 'bizum_manual'`; // ya nadie escribe 'card'
  const r = comprobar({ ficheros: doc(APROBADO), fuenteFlags: FLAGS_HOY, fuenteCodigo: sinTarjeta });
  assert.equal(r.ok, false,
    '🔴 aprobó la frase aunque la tarjeta ya no se escriba en ninguna ruta. El texto oficial no es ' +
    'cierto para siempre: lo es mientras su mecanismo lo sea.');
});

// ── ④ SUELO ──────────────────────────────────────────────────────────────────────────────

test('SCRUM-397 · 🔴 SUELO: si el ancla desaparece, NO es un verde', () => {
  const r = comprobar({
    ficheros: [{ ruta: 'docs/master/SCRUM-397.md', texto: '> Una frase sin marcar.' }],
    fuenteFlags: FLAGS_HOY, fuenteCodigo: CODIGO_HOY,
  });
  assert.equal(r.ok, false,
    '🔴 dio verde sin haber encontrado el texto que vigila. «Cero infracciones» y «no encontré ' +
    'nada que mirar» dan el mismo verde y significan lo contrario.');
  assert.match(r.salida, /SUELO/);
});

test('SCRUM-397 · 🔴 SUELO: una bandera ilegible NO se supone encendida', () => {
  const v = estaVivo('bizum', { fuenteFlags: 'nada aquí', fuenteCodigo: CODIGO_HOY });
  assert.equal(v.vivo, null, '🔴 decidió sin poder leer la bandera');
  assert.match(v.motivo, /no se pudo leer/);
  const r = comprobar({
    ficheros: doc('Los cobros con Bizum los confirma la pasarela.'),
    fuenteFlags: 'nada aquí', fuenteCodigo: CODIGO_HOY,
  });
  assert.equal(r.ok, false, '🔴 aprobó con el estado de la bandera desconocido');
});

test('SCRUM-397 · leer una bandera de flags.ts, y distinguir no-declarada de false', () => {
  assert.equal(valorDeBandera(FLAGS_HOY, 'BIZUM_MANUAL_ENABLED'), false);
  assert.equal(valorDeBandera(FLAGS_HOY, 'OTRA'), true);
  assert.equal(valorDeBandera(FLAGS_HOY, 'NO_EXISTE'), null,
    '🔴 una bandera no declarada tiene que ser `null`, no `false`: no es lo mismo «apagada» que ' +
    '«no está»');
});

// ── ⑤ EL ESTADO REAL DEL REPO ────────────────────────────────────────────────────────────

test('SCRUM-397 · el texto oficial está en la entrada, con su ancla', () => {
  const md = fs.readFileSync(path.join(RAIZ, 'docs/master/SCRUM-397.md'), 'utf8');
  assert.ok(md.includes(ANCLA), `🔴 falta el ancla «${ANCLA}» en la entrada`);
  const micros = extraerMicrocopys([{ ruta: 'x', texto: md }]);
  assert.equal(micros.length, 1, '🔴 se esperaba EXACTAMENTE un microcopy oficial marcado');
  assert.match(micros[0].texto, /Los cobros con tarjeta los confirma la pasarela/,
    '🔴 el texto marcado no es el aprobado por el fundador el 7-ago-2026');
  assert.doesNotMatch(micros[0].texto, /bizum/i, '🔴 el texto oficial ha vuelto a nombrar Bizum');
  assert.doesNotMatch(micros[0].texto, /efectivo/i, '🔴 el texto oficial ha vuelto a nombrar efectivo');
});

test('SCRUM-397 · el repo REAL pasa su propio guard hoy', () => {
  const r = comprobarEnDisco(RAIZ);
  assert.equal(r.ok, true, `🔴 el repo no pasa el guard:\n${r.salida}`);
});

test('SCRUM-397 · los mecanismos declarados cubren los tres que se han discutido', () => {
  assert.deepEqual(Object.keys(MECANISMOS).sort(), ['bizum', 'efectivo', 'tarjeta']);
});
