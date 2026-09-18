// tests/scrum899d-aviso-de-uso.test.mjs — SCRUM-899d · el aviso de uso (statusLine → uso.json)
//
// LO QUE ESTE FICHERO VIGILA: que `uso.mjs leer` SÓLO diga VERDE (salida 0) con una lectura fresca y
// válida. Un fichero que no existe, ilegible, viejo, del futuro, de una ventana ya reiniciada o
// «refrescado» por un repintado sin llamada a la API se lee como NO_PUDE_MIRAR (salida 2). Nunca verde.
//
// EL CONTROL: cada caso NO_PUDE_MIRAR sale de la MISMA lectura que el control da VERDE en el mismo
// instante, cambiando UNA cosa. Sin el control, «todo da NO_PUDE_MIRAR» lo cumpliría también un
// lector que no sabe decir otra cosa.
//
// La forma del JSON de entrada es la que arma Claude Code 2.1.276 para el statusLine (leída en su
// binario el 18-sep-2026): `rate_limits.five_hour.{used_percentage, resets_at}` con `resets_at` en
// segundos Unix, y `cost.total_api_duration_ms`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { temporal } from './_temporal.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(RAIZ, 'scripts', 'equipo', 'uso.mjs');
const u = await import(pathToFileURL(SCRIPT).href);

// El rojo de cada pieza, declarado: lo ejecuta `npm run meta:mutaciones`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/equipo/uso.mjs',
    de: '  if (edadMs > maxEdadMin * 60 * 1000) return',
    a: '  if (false) return',
    cae: '🔴 una lectura VIEJA es NO_PUDE_MIRAR, nunca verde',
  },
  {
    fichero: 'scripts/equipo/uso.mjs',
    de: '    if (!visto || visto.api_ms !== apiMs) {',
    a: '    if (true) {',
    cae: '🔴 un REPINTADO sin llamada a la API no renueva la hora de la lectura',
  },
  {
    fichero: 'scripts/equipo/uso.mjs',
    de: "  if (texto === null) return noPude('el fichero no existe o no se pudo abrir');",
    a: "  if (texto === null) return { veredicto: 'VERDE', motivo: 'x' };",
    cae: '🔴 un fichero que no existe es NO_PUDE_MIRAR, nunca verde',
  },
  {
    fichero: 'scripts/equipo/uso.mjs',
    de: '  if (cinco.resets_at * 1000 <= ahoraMs) return',
    a: '  if (false) return',
    cae: '🔴 una ventana ya reiniciada es NO_PUDE_MIRAR: el dato es de la anterior',
  },
];

const raiz = temporal('scrum899d-');
const T0 = Date.parse('2026-09-18T08:00:00.000Z');
const MIN = 60 * 1000;
const RESET = Math.floor(T0 / 1000) + 3 * 3600; // la ventana acaba 3 h después de T0

/** El JSON que Claude Code pasa por stdin al statusLine (forma de 2.1.276). */
function entradaStatusLine({ sesion = 'sesion-a', apiMs = 12000, usado = 42, reset = RESET, conLimites = true } = {}) {
  return {
    session_id: sesion,
    version: '2.1.276',
    model: { id: 'claude-opus-5', display_name: 'Opus 5' },
    cost: { total_cost_usd: 1.5, total_duration_ms: 90000, total_api_duration_ms: apiMs },
    ...(conLimites && { rate_limits: {
      five_hour: { used_percentage: usado, resets_at: reset },
      seven_day: { used_percentage: 10, resets_at: reset + 86400 },
    } }),
  };
}

/** Una lectura válida escrita en T0: la base del control. */
function registroControl() {
  return u.registrar(null, entradaStatusLine(), T0);
}
const juzgar = (reg, ahora = T0 + MIN, op) => u.juzgar(typeof reg === 'string' ? reg : JSON.stringify(reg), ahora, op);

function correr(args, stdin) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.FORCE_COLOR;
  return spawnSync(process.execPath, [SCRIPT, ...args], { input: stdin, encoding: 'utf8', env });
}

test('CONTROL: una lectura fresca y válida da VERDE — el lector SABE decir verde', () => {
  const r = juzgar(registroControl());
  assert.equal(r.veredicto, 'VERDE', JSON.stringify(r));
  assert.equal(r.usado, 42);
});

test('lo que no se puede mirar es NO_PUDE_MIRAR, cambiando UNA cosa respecto al control', () => {
  const control = registroControl();
  const casos = {
    'no existe': () => u.juzgar(null, T0 + MIN),
    'vacío': () => juzgar(''),
    'no es JSON': () => juzgar('{"formato":1,'),
    'formato desconocido': () => juzgar({ ...control, formato: 99 }),
    'sin lectura vigente': () => juzgar({ ...control, vigente: null }),
    'porcentaje que no es número': () => juzgar({ ...control, vigente: { ...control.vigente, five_hour: { ...control.vigente.five_hour, used_percentage: '42' } } }),
    'hora ilegible': () => juzgar({ ...control, vigente: { ...control.vigente, leido_en: 'ayer' } }),
    'vieja (11 min > 10)': () => juzgar(control, T0 + 11 * MIN),
    'del futuro (+5 min)': () => juzgar(control, T0 - 5 * MIN),
    'ventana ya reiniciada': () => juzgar(u.registrar(null, entradaStatusLine({ reset: Math.floor(T0 / 1000) + 30 }), T0)),
    'parámetro inválido': () => juzgar(control, T0 + MIN, { maxEdadMin: Number('diez') }),
  };
  for (const [nombre, caso] of Object.entries(casos)) {
    const r = caso();
    assert.equal(r.veredicto, 'NO_PUDE_MIRAR', `${nombre}: ${JSON.stringify(r)}`);
  }
  // Y el control, en el mismo instante, sigue en VERDE: lo que cambió es lo único que difiere.
  assert.equal(juzgar(control).veredicto, 'VERDE');
});

test('NO_PUDE_MIRAR nunca sale con 0, y AVISO tampoco', () => {
  assert.equal(u.SALIDA.VERDE, 0);
  assert.notEqual(u.SALIDA.NO_PUDE_MIRAR, 0);
  assert.notEqual(u.SALIDA.AVISO, 0);
});

test('a partir del umbral es AVISO', () => {
  assert.equal(juzgar(u.registrar(null, entradaStatusLine({ usado: 85 }), T0)).veredicto, 'AVISO');
  assert.equal(juzgar(u.registrar(null, entradaStatusLine({ usado: 84.9 }), T0)).veredicto, 'VERDE');
});

test('un REPINTADO sin llamada a la API no rejuvenece el dato; una llamada nueva, sí', () => {
  const primero = u.registrar(null, entradaStatusLine({ apiMs: 12000 }), T0);
  // 11 min después, Claude Code repinta por temporizador: mismo total_api_duration_ms.
  const repintado = u.registrar(primero, entradaStatusLine({ apiMs: 12000 }), T0 + 11 * MIN);
  assert.equal(repintado.vigente.leido_en, primero.vigente.leido_en);
  assert.equal(juzgar(repintado, T0 + 11 * MIN).veredicto, 'NO_PUDE_MIRAR');
  // Control: si hubo llamada (el total cambia), la lectura se renueva y vuelve a ser verde.
  const llamada = u.registrar(primero, entradaStatusLine({ apiMs: 15000 }), T0 + 11 * MIN);
  assert.equal(juzgar(llamada, T0 + 11 * MIN).veredicto, 'VERDE');
});

test('sin llamadas todavía (api_ms 0) o sin rate_limits no hay lectura vigente, y lo dice', () => {
  assert.equal(u.registrar(null, entradaStatusLine({ apiMs: 0 }), T0).vigente, null);
  const sin = u.registrar(null, entradaStatusLine({ conLimites: false }), T0);
  assert.equal(sin.vigente, null);
  assert.equal(sin.ultima_llamada.trae_rate_limits, false);
  const r = juzgar(sin);
  assert.equal(r.veredicto, 'NO_PUDE_MIRAR');
  assert.match(r.motivo, /no le pasa rate_limits/);
  // Una sesión sin dato NO pisa la lectura de otra.
  const mixto = u.registrar(registroControl(), entradaStatusLine({ sesion: 'sesion-b', conLimites: false }), T0 + MIN);
  assert.equal(mixto.vigente.sesion, 'sesion-a');
  assert.equal(juzgar(mixto).veredicto, 'VERDE');
});

test('POR EFECTO: statusLine → escribir → leer, con el proceso de verdad', () => {
  const fichero = path.join(raiz, 'efecto', 'uso.json');
  // Antes de escribir: no existe → salida 2 (control de que el fichero no venía de antes).
  const antes = correr(['leer', '--fichero', fichero]);
  assert.equal(antes.status, 2, antes.stdout + antes.stderr);

  const reset = Math.floor(Date.now() / 1000) + 3600;
  const e = correr(['escribir', '--fichero', fichero], JSON.stringify(entradaStatusLine({ reset })));
  assert.equal(e.status, 0, e.stderr);
  // Testigo de ejecución (A21): pintó la línea y el fichero existe.
  assert.match(e.stdout, /^uso 5h 42% · reinicia \d\d:\d\d/);
  assert.ok(fs.existsSync(fichero), 'escribir no dejó el fichero');

  const l = correr(['leer', '--fichero', fichero]);
  assert.equal(l.status, 0, l.stdout + l.stderr);
  assert.equal(JSON.parse(l.stdout).veredicto, 'VERDE');

  const aviso = correr(['leer', '--fichero', fichero, '--umbral', '40']);
  assert.equal(aviso.status, 1, aviso.stdout);

  // Ilegible en disco → 2.
  fs.writeFileSync(fichero, 'basura');
  const ilegible = correr(['leer', '--fichero', fichero]);
  assert.equal(ilegible.status, 2, ilegible.stdout);
  assert.equal(JSON.parse(ilegible.stdout).veredicto, 'NO_PUDE_MIRAR');
});

test('escribir con una entrada ilegible no rompe la barra: pinta «sin dato» y sale con 0', () => {
  const fichero = path.join(raiz, 'basura', 'uso.json');
  const e = correr(['escribir', '--fichero', fichero], 'esto no es json');
  assert.equal(e.status, 0, e.stderr);
  assert.equal(e.stdout.trim(), 'uso 5h: sin dato');
  const l = correr(['leer', '--fichero', fichero]);
  assert.equal(l.status, 2, l.stdout);
});
