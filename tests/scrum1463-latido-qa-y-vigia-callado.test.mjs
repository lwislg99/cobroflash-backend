// SCRUM-1463 · EL LATIDO DICE SI LA CUENTA QA VIVE Y QUIÉN LA RENUEVA, y un vigía parado no es «sin avisos».
//
// Medido el 6-oct-2026: la sesión QA estuvo muerta del 3 al 6-oct y el latido no la miraba; y con
// SCRUM-1459 la sección VIGÍA salía en ✅ igual con el vigía corriendo que con el vigía parado.
// Las frases de `estado` de abajo son las que escribe `scripts/qa/sesion-panel.mjs`.
//
// Sólo lo PURO: ni `gh` ni la petición a producción se prueban aquí.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  seccionQA, pasadaDelVigia, seccionVigia, salidaDe, informe, NOTAS_FIJAS, HORAS_DE_VIGIA_CALLADO, SALIDA_CIEGO, SALIDA_AVISO, SALIDA_OK,
} from '../scripts/equipo/latido.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const AHORA = Date.parse('2026-10-06T11:30:00Z');
const corrida = (created_at, conclusion = 'success', status = 'completed') => ({ created_at, status, conclusion });

// ── QA ────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1463 · QA VIVA: sección en verde, con la cuenta y hasta cuándo, tal como lo dice su instrumento', () => {
  const s = seccionQA({ codigo: 0, lineas: ['VIVA — GET /admin/me → 200 (demo@yaqu.app); según su fichero caduca el 2026-10-07T11:20:00Z, dentro de 23 h 50 min (hora del servidor).'] });
  assert.equal(s.pudo, true);
  assert.equal(s.alertas.length, 0);
  assert.match(s.poblacion, /VIVA — GET \/admin\/me → 200 \(demo@yaqu\.app\); según su fichero caduca el 2026-10-07T11:20:00Z/);
  assert.equal(salidaDe([s]), SALIDA_OK);
});

test('SCRUM-1463 · 🔴 QA MUERTA: es alerta, lleva el comando ENTERO y dice QUIÉN la renueva (no el fundador)', () => {
  const s = seccionQA({ codigo: 1, lineas: [
    'MUERTA — GET /admin/me → 401 (demo@yaqu.app); según su fichero caducó el 2026-10-03T16:37:00Z, hace 2 d 18 h (hora del servidor).',
    'SE RENUEVA con: node scripts/qa/sesion-panel.mjs login demo@yaqu.app  (lee el secreto de C:/Users/Admin/.yaqu-qa-secret.txt; receta en docs/RUNBOOKS.md R23)',
  ] });
  assert.equal(s.pudo, true);
  assert.equal(s.alertas.length, 1);
  const l = s.alertas[0].linea;
  assert.match(l, /MUERTA — GET \/admin\/me → 401/);
  assert.match(l, /caducó el 2026-10-03T16:37:00Z/);
  assert.match(l, /node scripts\/qa\/sesion-panel\.mjs login demo@yaqu\.app/);
  assert.match(l, /LA RENUEVA EL ORQUESTADOR, o cualquier sesión de esta máquina/);
  assert.match(l, /no hace falta el fundador/);
  assert.match(l, /nadie prueba «cerrar sesión»/);
  assert.equal(salidaDe([s]), SALIDA_AVISO);
});

test('SCRUM-1463 · QA, CIEGO antes que verde: «no se puede saber», un código sin su frase, o un reventón NO son «viva»', () => {
  const casos = {
    'no se puede saber': { codigo: 2, lineas: ['NO SE PUEDE SABER — no hay sesión guardada en C:/Users/Admin/.yaqu-qa-sesion.txt. Entra antes con: node scripts/qa/sesion-panel.mjs login'] },
    'sonda sin respuesta': { codigo: 2, lineas: ['NO SE PUEDE SABER — GET /admin/me → 502: ni 2xx ni 401, el servidor no ha dicho si la sesión vale.'] },
    'reventó': { codigo: undefined, lineas: ['reventó: fetch failed'] },
    'sale 0 sin decir VIVA': { codigo: 0, lineas: [] },
    'sale 0 diciendo otra cosa': { codigo: 0, lineas: ['uso: sesion-panel.mjs <orden>'] },
    'sale 1 sin decir MUERTA': { codigo: 1, lineas: ['RECHAZADO — estado: argumento desconocido'] },
    'código desconocido': { codigo: 7, lineas: ['VIVA — eso dice'] },
  };
  for (const [nombre, e] of Object.entries(casos)) {
    const s = seccionQA(e);
    assert.equal(s.pudo, false, nombre);
    assert.equal(salidaDe([s]), SALIDA_CIEGO, nombre);
    assert.ok(s.motivo.length > 10, nombre);
  }
  assert.match(seccionQA(casos['no se puede saber']).motivo, /^NO SE PUEDE SABER — no hay sesión guardada/);
  assert.match(seccionQA(casos['reventó']).motivo, /código ninguno: reventó, dijo: reventó: fetch failed/);
});

// ── el puntero a lo que el latido NO mide ─────────────────────────────────────────────────────

test('SCRUM-1463 · el puntero de Jira sale en cada latido, no cambia la salida, y el comando que señala EXISTE y sigue pidiendo lo que el puntero dice', () => {
  const verde = [seccionQA({ codigo: 0, lineas: ['VIVA — GET /admin/me → 200'] })];
  const con = informe(verde, { ahora: AHORA, notas: NOTAS_FIJAS });
  const sin = informe(verde, { ahora: AHORA });
  assert.match(con, /ℹ️ JIRA · .* NO lo hace el latido: no tiene credenciales de Jira/);
  assert.match(con, /node scripts\/abierto-con-trabajo-en-main\.mjs --jira <foto\.json …>/);
  assert.match(con, /la foto vale 12 h/);
  assert.match(con, /NO es «terminado»/);
  assert.doesNotMatch(sin, /JIRA/);
  // No es una sección: ni alerta ni ciega. La última línea es la misma con y sin él.
  assert.equal(con.split('\n').pop(), sin.split('\n').pop());
  assert.match(con.split('\n').pop(), /nada que atender \(salida 0\)/);
  assert.equal(salidaDe(verde), SALIDA_OK);
  // Un puntero a un comando que ya no existe, o que ha cambiado de argumentos, es peor que no tenerlo.
  const fuente = fs.readFileSync(path.join(RAIZ, 'scripts', 'abierto-con-trabajo-en-main.mjs'), 'utf8');
  assert.match(fuente, /argv\.indexOf\('--jira'\)/);
  assert.match(fuente, /\[--horas-max 12\]/);
});

// ── el vigía callado ──────────────────────────────────────────────────────────────────────────

test('SCRUM-1463 · un vigía que corrió hace poco: sin alerta, y la línea dice cuándo', () => {
  const p = pasadaDelVigia([corrida('2026-10-06T09:28:53Z'), corrida('2026-10-06T01:33:55Z')], AHORA);
  assert.equal(p.ciego, undefined);
  assert.equal(p.alertas.length, 0);
  assert.equal(p.texto, 'última pasada del vigía hace 2.0 h (success)');
  // Justo por debajo del tope todavía es silencio normal (el hueco mayor medido es de 10,1 h).
  assert.equal(pasadaDelVigia([corrida('2026-10-05T23:45:00Z')], AHORA).alertas.length, 0);
  assert.equal(HORAS_DE_VIGIA_CALLADO, 12);
});

test('SCRUM-1463 · 🔴 EL CASO: el vigía dejó de correr — pasa del tope y lo dice con las horas, no «sin avisos»', () => {
  const p = pasadaDelVigia([corrida('2026-10-05T23:15:00Z')], AHORA);
  assert.equal(p.alertas.length, 1);
  assert.match(p.alertas[0].linea, /el vigía NO CORRE desde hace 12\.3 h \(2026-10-05T23:15Z\) y se le pide cada 3 h/);
  assert.match(p.alertas[0].linea, /NO es que no haya atascos/);
  // Tres días y medio parado se dice en días.
  assert.match(pasadaDelVigia([corrida('2026-10-02T19:30:00Z')], AHORA).alertas[0].linea, /desde hace 3\.7 días \(88 h\)/);
  // Una corrida en cola o corriendo AHORA no cuenta como que ya miró.
  const enCola = pasadaDelVigia([corrida('2026-10-06T11:29:00Z', null, 'queued'), corrida('2026-10-05T20:00:00Z')], AHORA);
  assert.match(enCola.alertas[0].linea, /NO CORRE desde hace 15\.5 h/);
});

test('SCRUM-1463 · 🔴 la última pasada terminó MAL: es alerta aunque sea de hace diez minutos', () => {
  const p = pasadaDelVigia([corrida('2026-10-06T11:20:00Z', 'failure'), corrida('2026-10-06T08:20:00Z')], AHORA);
  assert.equal(p.alertas.length, 1);
  assert.match(p.alertas[0].linea, /la última pasada del vigía \(2026-10-06T11:20Z\) terminó en FAILURE: NO miró\. La última buena es de hace 3\.2 h/);
  const ninguna = pasadaDelVigia([corrida('2026-10-06T11:20:00Z', 'failure'), corrida('2026-10-06T08:20:00Z', 'cancelled')], AHORA);
  assert.match(ninguna.alertas[0].linea, /Ninguna buena entre las 2 que llegaron/);
});

test('SCRUM-1463 · el vigía, CIEGO antes que verde: sin corridas legibles no se sabe si sigue mirando', () => {
  for (const [nombre, corridas] of [['no llegaron', null], ['lista vacía', []], ['sólo en cola', [corrida('2026-10-06T11:29:00Z', null, 'queued')]], ['sin fecha', [{ status: 'completed', conclusion: 'success' }]]]) {
    const p = pasadaDelVigia(corridas, AHORA);
    assert.ok(p.ciego && p.ciego.length > 10, nombre);
    assert.equal(p.alertas.length, 0, nombre);
  }
});

test('SCRUM-1463 · en la SECCIÓN: la pasada va delante de los avisos, su alerta se suma, y su ceguera ciega la sección', () => {
  const base = { issue: 1241, comentarios: [], abiertos: [2128], ahora: AHORA };
  // Sin avisos y con el vigía corriendo: verde, y la línea dice cuándo corrió.
  const bien = seccionVigia({ ...base, pasadas: [corrida('2026-10-06T09:28:53Z')] });
  assert.equal(bien.pudo, true);
  assert.equal(bien.alertas.length, 0);
  assert.match(bien.poblacion, /^última pasada del vigía hace 2\.0 h \(success\) · issue #1241 · 0 comentarios/);
  // 🔴 Sin avisos y con el vigía PARADO: antes era el mismo verde.
  const parado = seccionVigia({ ...base, pasadas: [corrida('2026-10-02T19:30:00Z')] });
  assert.equal(parado.alertas.length, 1);
  assert.equal(salidaDe([parado]), SALIDA_AVISO);
  // No se pudo leer cuándo corrió: ciega, aunque los avisos sí se leyeran.
  const ciego = seccionVigia({ ...base, pasadas: null });
  assert.equal(ciego.pudo, false);
  assert.match(ciego.motivo, /no sé si sigue mirando/);
  assert.equal(salidaDe([ciego]), SALIDA_CIEGO);
  // Y si lo ciego son los avisos, la sección sigue ciega aunque el vigía corra.
  assert.equal(seccionVigia({ ...base, comentarios: undefined, pasadas: [corrida('2026-10-06T09:28:53Z')] }).pudo, false);
});
