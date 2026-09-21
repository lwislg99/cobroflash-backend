// SCRUM-996 · el suelo de arranque se MIDE (gasto-arranque.mjs) y se BAJA (norma.mjs).
//
// Dos instrumentos, y los dos pueden mentir por omisión, así que este fichero les pone delante
// casos con la respuesta conocida y exige que SE HAYAN EJECUTADO (A21: una cobaya que no arranca
// da el mismo resultado que un arreglo perfecto). Cada caso comprueba que el script imprimió su
// línea de población —la de fuente en `norma.mjs`, `POBLACION:` en `gasto-arranque.mjs`— antes de
// mirar lo que dice.
//
//   norma.mjs         13 de 24 secciones al arrancar, el resto en un ÍNDICE. Falla en ALTO (salida 2)
//                     si una sección falta, se retitula o se repite; nunca imprime un subconjunto en
//                     verde. Se prueba contra el fichero REAL del repo y contra fixtures rotos a
//                     mano, y los bytes impresos se recalculan aquí con un parser independiente.
//   gasto-arranque    U1 (suelo), U8 y lectura = U8 − U1 sobre jsonl FABRICADOS con usage conocido,
//                     con un mensaje repetido (vale el ÚLTIMO usage). Población cero = salida 2.
//                     El tope del traspaso se prueba EN el borde (5.120 B cabe, 5.121 no).
//
// Todo lo que se crea cuelga de `os.tmpdir()` (SCRUM-824) y se borra al terminar. Los scripts se
// lanzan con ruta ABSOLUTA y sin depender de la zona horaria (las fechas llevan `Z`).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ARRANQUE, normalizar, parsearSecciones } from '../scripts/equipo/norma.mjs';
import {
  ejecutar, medirTraspaso, resumenDeSesion, slugDeCwd, turnosDeEntradas,
} from '../scripts/equipo/gasto-arranque.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NORMA = path.join(RAIZ, 'scripts', 'equipo', 'norma.mjs');
const GASTO = path.join(RAIZ, 'scripts', 'equipo', 'gasto-arranque.mjs');
const YO = fileURLToPath(import.meta.url);
const NORMAS_REALES = path.join(RAIZ, 'docs', 'equipo', '00-normas-comunes.md');

const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum996-'));
after(() => fs.rmSync(raiz, { recursive: true, force: true }));

/** Escribe un fichero dentro del temporal y devuelve su ruta absoluta. */
function escribir(relativa, contenido) {
  const destino = path.join(raiz, relativa);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, contenido);
  return destino;
}

/** Lanza un script con `node` y ruta absoluta; sin colores heredados. Si no arranca, revienta. */
function correr(script, args, { cwd = raiz, env = {} } = {}) {
  const entorno = { ...process.env, ...env };
  delete entorno.FORCE_COLOR;
  delete entorno.NO_COLOR;
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd, env: entorno, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  assert.ifError(r.error);
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

const lineasDe = (s) => s.split('\n');
const EXIT_FINAL = /EXIT=(\d+)\s*$/;
const exitImpreso = (stdout) => Number(EXIT_FINAL.exec(stdout)?.[1]);

// ═════════════════════════════════════════════════════════════════════════════════════════════
// norma.mjs
// ═════════════════════════════════════════════════════════════════════════════════════════════

const TEXTO_REAL = normalizar(fs.readFileSync(NORMAS_REALES));
const IDS_ARRANQUE = ['A1', 'A2', 'A3', 'A4', 'A7', 'A8', 'A9', 'A13', 'A14', 'A16', 'A19', 'A20', 'A24'];
const MARCADOR = 'Cuarta versión';
const RE_FUENTE = /^norma\.mjs · origen (.+) · (\d+) B · sha256 ([0-9a-f]{8}) · (\d+) secciones$/m;
const RE_PIE = /^norma\.mjs · impresas=(\d+) · (\d+) B de (\d+) B \((\d+) %\) · sin leer=(\d+) · EXIT=(\d+)$/m;

/** Parser INDEPENDIENTE del de norma.mjs: id → líneas de su sección, sin blancos al final. */
function seccionesIndependientes(texto) {
  const lineas = texto.split('\n');
  const cabezas = [];
  lineas.forEach((l, i) => {
    const m = /^## (A\d+) · /.exec(l);
    if (m) cabezas.push({ id: m[1], i });
  });
  const out = new Map();
  cabezas.forEach((c, k) => {
    const trozo = lineas.slice(c.i, k + 1 < cabezas.length ? cabezas[k + 1].i : lineas.length);
    while (trozo.length && trozo[trozo.length - 1].trim() === '') trozo.pop();
    out.set(c.id, trozo);
  });
  return out;
}

/** Lo que el arranque tiene que imprimir de una sección: entera, salvo A19 (corta en el marcador). */
function textoEsperado(id, lineas) {
  if (id !== 'A19') return lineas.join('\n');
  const i = lineas.findIndex((l, k) => k > 0 && l.includes(MARCADOR));
  assert.ok(i > 0, `A21: el fichero real ya no tiene «${MARCADOR}» en A19: el corte no tiene sujeto`);
  const previas = lineas.slice(0, i);
  while (previas.length && previas[previas.length - 1].trim() === '') previas.pop();
  return previas.join('\n');
}

const SECCIONES_REALES = seccionesIndependientes(TEXTO_REAL);

/** Una línea larga y ÚNICA de la historia de A19 (la que el corte deja fuera). */
function lineaDeLaHistoria() {
  const lineas = SECCIONES_REALES.get('A19');
  const desde = lineas.findIndex((l, k) => k > 0 && l.includes(MARCADOR));
  for (let k = lineas.length - 1; k > desde; k--) {
    if (lineas[k].length >= 40 && TEXTO_REAL.split(lineas[k]).length === 2) return lineas[k];
  }
  return assert.fail('A21: no hay ninguna línea larga y única tras el marcador de A19: el control no tiene sujeto');
}

function sinSeccion(texto, id, siguiente) {
  const lineas = texto.split('\n');
  const a = lineas.findIndex((l) => l.startsWith(`## ${id} · `));
  const b = lineas.findIndex((l) => l.startsWith(`## ${siguiente} · `));
  assert.ok(a > 0 && b > a, `A21: no encuentro ${id}/${siguiente} en el fichero real`);
  return [...lineas.slice(0, a), ...lineas.slice(b)].join('\n');
}

test('SCRUM-996 · norma · SUELO: el fichero real tiene secciones y las 13 de arranque están en él', () => {
  assert.ok(SECCIONES_REALES.size >= IDS_ARRANQUE.length, `solo ${SECCIONES_REALES.size} secciones en el fichero real`);
  for (const id of IDS_ARRANQUE) assert.ok(SECCIONES_REALES.has(id), `${id} no está en 00-normas-comunes.md`);
  assert.deepEqual(ARRANQUE.map((a) => a.id), IDS_ARRANQUE, 'la lista ARRANQUE de norma.mjs no es la del encargo');
});

test('SCRUM-996 · norma · el fichero real: 13 secciones de arranque (texto exacto), ~43 % de los bytes, índice con el resto', () => {
  const r = correr(NORMA, ['--fichero', NORMAS_REALES]);
  const fuente = RE_FUENTE.exec(r.stdout);
  assert.ok(fuente, `A21: no salió la línea de fuente; stdout:\n${r.stdout.slice(0, 400)}\nstderr:\n${r.stderr.slice(0, 400)}`);
  assert.equal(r.status, 0, r.stdout.slice(-400));
  assert.equal(Number(fuente[2]), Buffer.byteLength(TEXTO_REAL), 'los bytes de la línea de fuente no son los del fichero');
  assert.equal(Number(fuente[4]), SECCIONES_REALES.size, 'el nº de secciones no es el que cuenta el parser independiente');

  const lineas = lineasDe(r.stdout);
  const titulares = lineas.filter((l) => /^## A\d+ · /.test(l)).map((l) => /^## (A\d+) /.exec(l)[1]);
  assert.deepEqual(titulares, IDS_ARRANQUE, 'las secciones impresas tienen que ser EXACTAMENTE las 13 de arranque');

  // El texto de cada una es el del fichero, byte a byte (A19 cortada en su marcador).
  let bytesEsperados = 0;
  for (const id of IDS_ARRANQUE) {
    const esperado = textoEsperado(id, SECCIONES_REALES.get(id));
    assert.ok(r.stdout.includes(esperado), `el texto impreso de ${id} no es el del fichero`);
    bytesEsperados += Buffer.byteLength(esperado);
  }

  // El índice lista EXACTAMENTE las que no se han impreso.
  const aIndice = lineas.findIndex((l) => l.startsWith('ÍNDICE de lo que NO has leído'));
  assert.ok(aIndice > 0, 'no hay índice de lo no leído');
  const indice = lineas.slice(aIndice + 1).filter((l) => /^A\d+ · /.test(l)).map((l) => /^(A\d+) /.exec(l)[1]);
  const restoEsperado = [...SECCIONES_REALES.keys()].filter((id) => !IDS_ARRANQUE.includes(id));
  assert.ok(restoEsperado.length > 0, 'A21: sin secciones fuera del arranque, el índice no tiene sujeto');
  assert.deepEqual(indice, restoEsperado);
  for (const id of restoEsperado) {
    const bytes = Buffer.byteLength(SECCIONES_REALES.get(id).join('\n'));
    assert.ok(r.stdout.includes(`(${bytes} B)`), `el índice no dice ${bytes} B para ${id}`);
  }

  const pie = RE_PIE.exec(r.stdout);
  assert.ok(pie, `no hay pie con población; stdout:\n${r.stdout.slice(-300)}`);
  assert.equal(Number(pie[1]), 13);
  assert.equal(Number(pie[2]), bytesEsperados, 'los bytes impresos no coinciden con el recálculo independiente');
  assert.equal(Number(pie[3]), Buffer.byteLength(TEXTO_REAL));
  assert.equal(Number(pie[5]), restoEsperado.length);
  const pct = (100 * Number(pie[2])) / Number(pie[3]);
  assert.ok(pct >= 35 && pct <= 60, `el arranque ya no pesa ~43 % del fichero: ${pct.toFixed(1)} %`);
  assert.equal(Number(pie[6]), r.status, 'el EXIT= impreso no es el estado real del proceso');
});

test('SCRUM-996 · norma · A19 se corta ANTES de «Cuarta versión» y lo declara; --entera la trae completa', () => {
  const historia = lineaDeLaHistoria();
  const cortada = correr(NORMA, ['--fichero', NORMAS_REALES]);
  assert.ok(RE_FUENTE.test(cortada.stdout), 'A21: la cobaya no arrancó');
  assert.ok(!cortada.stdout.includes(historia), 'A19 sigue imprimiendo su historia: el corte no funciona');
  assert.ok(cortada.stdout.includes('[A19 cortada antes de «Cuarta versión» (historia); `norma.mjs A19 --entera` la trae completa]'),
    'el corte no se declara');

  const entera = correr(NORMA, ['--fichero', NORMAS_REALES, '--entera']);
  assert.ok(RE_FUENTE.test(entera.stdout), 'A21: la cobaya no arrancó');
  assert.ok(entera.stdout.includes(historia), '--entera no trae la historia de A19');
  assert.ok(!entera.stdout.includes('[A19 cortada'), '--entera no debería declarar un corte');
  const bytes = (o) => Number(RE_PIE.exec(o.stdout)[2]);
  assert.ok(bytes(entera) > bytes(cortada), '--entera tiene que imprimir MÁS bytes que el arranque cortado');
});

test('SCRUM-996 · norma · falta A13 → NO PUDE MIRAR, salida 2 y NADA impreso en verde', () => {
  const f = escribir('sin-a13.md', sinSeccion(TEXTO_REAL, 'A13', 'A14'));
  const r = correr(NORMA, ['--fichero', f]);
  assert.equal(r.status, 2, r.stdout.slice(0, 400));
  assert.match(r.stdout, /NO PUDE MIRAR: la sección A13 no está o cambió de título/);
  assert.ok(!/^## A\d+ · /m.test(r.stdout), 'imprimió secciones aunque no pudo dar el conjunto completo');
  assert.equal(exitImpreso(r.stdout), 2);
});

test('SCRUM-996 · norma · A9 retitulada (o renumerada) → salida 2: referenciar por posición caduca', () => {
  const f = escribir('a9-retitulada.md', TEXTO_REAL.replace('## A9 · Cuando algo te sale mal', '## A9 · Otra cosa distinta'));
  assert.notEqual(TEXTO_REAL, fs.readFileSync(f, 'utf8'), 'A21: el fixture es idéntico al real: no cambió nada');
  const r = correr(NORMA, ['--fichero', f]);
  assert.equal(r.status, 2, r.stdout.slice(0, 400));
  assert.match(r.stdout, /NO PUDE MIRAR: la sección A9 no está o cambió de título/);
  assert.ok(!/^## A\d+ · /m.test(r.stdout));
});

test('SCRUM-996 · norma · un id repetido es ambiguo → salida 2', () => {
  const f = escribir('a5-dos-veces.md', `${TEXTO_REAL}\n\n## A5 · Repetida a mano\n\ntexto\n`);
  const r = correr(NORMA, ['--fichero', f]);
  assert.equal(r.status, 2, r.stdout.slice(0, 400));
  assert.match(r.stdout, /NO PUDE MIRAR: la sección A5 aparece dos veces/);
});

test('SCRUM-996 · norma · sin la línea «Cuarta versión», A19 sale ENTERA y lo declara', () => {
  const lineas = TEXTO_REAL.split('\n');
  const i = lineas.findIndex((l) => l.includes(MARCADOR));
  assert.ok(i > 0, 'A21: el fichero real ya no tiene el marcador');
  const f = escribir('sin-marcador.md', [...lineas.slice(0, i), ...lineas.slice(i + 1)].join('\n'));
  const r = correr(NORMA, ['--fichero', f]);
  assert.ok(RE_FUENTE.test(r.stdout), 'A21: la cobaya no arrancó');
  assert.equal(r.status, 0, r.stdout.slice(-400));
  assert.ok(r.stdout.includes('[A19: no encontré el corte; impresa entera]'), 'no declara que no encontró el corte');
  assert.ok(r.stdout.includes(lineaDeLaHistoria()), 'A19 no salió entera');
});

test('SCRUM-996 · norma · el mismo fichero en CRLF da las mismas secciones y los mismos bytes', () => {
  const lf = escribir('normas-lf.md', TEXTO_REAL);
  const crlf = escribir('normas-crlf.md', TEXTO_REAL.replace(/\n/g, '\r\n'));
  assert.ok(fs.readFileSync(crlf).includes(Buffer.from('\r\n')), 'A21: el fixture CRLF no tiene CRLF');
  const a = correr(NORMA, ['--fichero', lf]);
  const b = correr(NORMA, ['--fichero', crlf]);
  assert.ok(RE_FUENTE.test(a.stdout) && RE_FUENTE.test(b.stdout), 'A21: alguna cobaya no arrancó');
  assert.equal(a.status, 0);
  assert.equal(b.status, 0);
  const fa = RE_FUENTE.exec(a.stdout);
  const fb = RE_FUENTE.exec(b.stdout);
  assert.deepEqual([fb[2], fb[3], fb[4]], [fa[2], fa[3], fa[4]], 'bytes, sha256 o nº de secciones cambian con CRLF');
  assert.deepEqual(lineasDe(b.stdout).slice(1), lineasDe(a.stdout).slice(1), 'el resto de la salida cambia con CRLF');
  assert.ok(!b.stdout.includes('\r'), 'la salida arrastra CR');
});

test('SCRUM-996 · norma · SIN --fichero lee de git (bytes crudos, CRLF incluido) y si no puede, sale con 2', () => {
  const repo = path.join(raiz, 'repo');
  fs.mkdirSync(path.join(repo, 'docs', 'equipo'), { recursive: true });
  const git = (...args) => {
    const g = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
    assert.equal(g.status, 0, `git ${args.join(' ')}: ${g.stderr}`);
  };
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'norma@example.invalid');
  git('config', 'user.name', 'norma');
  git('config', 'core.autocrlf', 'false');
  fs.writeFileSync(path.join(repo, 'docs', 'equipo', '00-normas-comunes.md'), TEXTO_REAL.replace(/\n/g, '\r\n'));
  git('add', 'docs/equipo/00-normas-comunes.md');
  git('commit', '-q', '-m', 'normas en CRLF');

  const ok = correr(NORMA, ['--origen', 'HEAD'], { cwd: repo });
  const fuente = RE_FUENTE.exec(ok.stdout);
  assert.ok(fuente, `A21: la cobaya no arrancó; stdout:\n${ok.stdout.slice(0, 300)}`);
  assert.equal(ok.status, 0);
  assert.equal(fuente[1], 'HEAD:docs/equipo/00-normas-comunes.md');
  assert.equal(Number(fuente[2]), Buffer.byteLength(TEXTO_REAL), 'un blob CRLF debe medirse con LF');
  assert.equal(lineasDe(ok.stdout).filter((l) => /^## A\d+ · /.test(l)).length, 13);

  // Sin origen legible NO cae al árbol de trabajo: es NO PUDE MIRAR.
  const roto = correr(NORMA, ['--origen', 'refs/heads/no-existe-996'], { cwd: repo });
  assert.equal(roto.status, 2, roto.stdout.slice(0, 400));
  assert.match(roto.stdout, /NO PUDE MIRAR: .*\(¿git fetch origin\?\)/);
  assert.ok(!/^## A\d+ · /m.test(roto.stdout));
  assert.equal(exitImpreso(roto.stdout), 2);
});

test('SCRUM-996 · norma · A23 imprime solo esa sección; un id desconocido y un fichero inexistente salen con 2', () => {
  const una = correr(NORMA, ['A23', '--fichero', NORMAS_REALES]);
  assert.ok(RE_FUENTE.test(una.stdout), 'A21: la cobaya no arrancó');
  assert.equal(una.status, 0);
  assert.deepEqual(lineasDe(una.stdout).filter((l) => /^## A\d+ · /.test(l)).map((l) => /^## (A\d+)/.exec(l)[1]), ['A23']);
  assert.ok(una.stdout.includes(SECCIONES_REALES.get('A23').join('\n')), 'A23 no salió entera');
  assert.equal(Number(RE_PIE.exec(una.stdout)[1]), 1);
  assert.ok(!una.stdout.includes('ÍNDICE'), 'un id pedido no imprime el índice del arranque');

  const dos = correr(NORMA, ['a22', 'A23', '--fichero', NORMAS_REALES]);
  assert.deepEqual(lineasDe(dos.stdout).filter((l) => /^## A\d+ · /.test(l)).map((l) => /^## (A\d+)/.exec(l)[1]), ['A22', 'A23']);

  const desconocido = correr(NORMA, ['A99', '--fichero', NORMAS_REALES]);
  assert.equal(desconocido.status, 2);
  assert.match(desconocido.stdout, /NO PUDE MIRAR: la sección A99 no existe/);
  assert.ok(!/^## A\d+ · /m.test(desconocido.stdout));

  const inexistente = correr(NORMA, ['--fichero', path.join(raiz, 'no-existe.md')]);
  assert.equal(inexistente.status, 2);
  assert.match(inexistente.stdout, /NO PUDE MIRAR: no pude leer/);
  assert.equal(exitImpreso(inexistente.stdout), 2);

  const rarito = correr(NORMA, ['--lo-que-sea']);
  assert.equal(rarito.status, 2);
});

test('SCRUM-996 · norma · --lista enumera TODAS las secciones con su tamaño y --todo imprime el fichero entero', () => {
  const lista = correr(NORMA, ['--lista', '--fichero', NORMAS_REALES]);
  assert.ok(RE_FUENTE.test(lista.stdout), 'A21: la cobaya no arrancó');
  assert.equal(lista.status, 0);
  const ids = lineasDe(lista.stdout).filter((l) => /^A\d+ · /.test(l)).map((l) => /^(A\d+) /.exec(l)[1]);
  assert.deepEqual(ids, [...SECCIONES_REALES.keys()]);

  const todo = correr(NORMA, ['--todo', '--fichero', NORMAS_REALES]);
  assert.ok(RE_FUENTE.test(todo.stdout), 'A21: la cobaya no arrancó');
  assert.equal(todo.status, 0);
  assert.ok(todo.stdout.includes(TEXTO_REAL.replace(/\n+$/, '')), '--todo no imprime el fichero entero');
});

test('SCRUM-996 · norma · los `###` no parten secciones', () => {
  const p = parsearSecciones('cabecera\n\n## A1 · Uno\n\ntexto\n\n### A1.1 · sub\n\nmás\n\n## A2 · Dos\n\nfin\n');
  assert.deepEqual(p.secciones.map((s) => s.id), ['A1', 'A2']);
  assert.ok(p.secciones[0].texto.includes('### A1.1 · sub'));
  assert.equal(p.cabecera, 'cabecera');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// gasto-arranque.mjs
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Reparte un contexto U en input 3 + creation 100 + read (U − 103). Output aparte: NO cuenta en U. */
const usage = (U) => ({
  input_tokens: 3, cache_creation_input_tokens: 100, cache_read_input_tokens: U - 103, output_tokens: 50,
});

let secuencia = 0;
const uuid = () => `u-${++secuencia}`;

/**
 * Fabrica una sesión: `jobs/job-<nombre>/state.json` + su jsonl. Cada turno i tiene su `U` FINAL
 * (la última línea de ese `message.id`); `previos` son líneas anteriores del MISMO mensaje con
 * otro usage (deben perder). `tools` van en una línea previa y su resultado en una entrada `user`.
 */
function fabricarSesion(jobsRel, nombre, { turnos, t0 = '2026-09-21T12:00:00.000Z', rota = false }) {
  // `jobsRel` es un NOMBRE dentro de `raiz`, no una ruta: así lo que se crea se ve colgar de tmpdir (SCRUM-824).
  const dir = path.join(raiz, jobsRel, `job-${nombre}`);
  const jsonl = path.join(dir, `${nombre}.jsonl`);
  const lineas = [];
  turnos.forEach((t, i) => {
    const id = `msg_${nombre}_${i + 1}`;
    const timestamp = new Date(Date.parse(t0) + i * 1000).toISOString();
    for (const previo of t.previos || []) {
      lineas.push(JSON.stringify({ type: 'assistant', timestamp, uuid: uuid(), message: { id, usage: usage(previo), content: [{ type: 'text', text: 'parcial' }] } }));
    }
    for (const h of t.tools || []) {
      lineas.push(JSON.stringify({
        type: 'assistant', timestamp, uuid: uuid(),
        message: { id, usage: usage(t.U - 1), content: [{ type: 'tool_use', id: h.id, name: h.nombre, input: h.input }] },
      }));
    }
    lineas.push(JSON.stringify({ type: 'assistant', timestamp, uuid: uuid(), message: { id, usage: usage(t.U), content: [{ type: 'text', text: 'final' }] } }));
    for (const h of t.tools || []) {
      lineas.push(JSON.stringify({
        type: 'user', timestamp, uuid: uuid(),
        message: { content: [{ type: 'tool_result', tool_use_id: h.id, content: 'x'.repeat(h.bytes) }] },
      }));
    }
  });
  if (rota) lineas.push('{"type":"assistant","message":{"id":"cortada');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(jsonl, `${lineas.join('\n')}\n`);
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({
    state: 'stopped', respawnFlags: ['-n', nombre, '--permission-mode', 'auto'], linkScanPath: jsonl,
  }));
}

/** N turnos con U = base + paso·i (i desde 1). */
const rampa = (N, base, paso) => Array.from({ length: N }, (_, i) => ({ U: base + paso * (i + 1) }));

const gasto = (jobsRel, args) => correr(GASTO, args, { env: { CLAUDE_JOBS_DIR: path.join(raiz, jobsRel) } });
const RE_POBLACION = /^POBLACION: (\d+) state\.json · (\d+) con jsonl · (\d+) con actividad en la ventana · (\d+) con ≥ (\d+) turnos/m;

// Sesión A: 10 turnos, U_i = 103 + 1000·i. Turnos 1 y 8 con líneas PREVIAS que no valen (última gana).
const JOBS_A = 'jobs-a';
const U_A = Array.from({ length: 10 }, (_, i) => 103 + 1000 * (i + 1));
fabricarSesion(JOBS_A, 'sX', {
  rota: true,
  turnos: U_A.map((U, i) => ({
    U,
    previos: i === 0 ? [11, 900000] : i === 7 ? [999999] : [],
    tools: i === 2 ? [{ id: 'tu_read', nombre: 'Read', input: { file_path: '/x/y.md' }, bytes: 1234 }]
      : i === 4 ? [{ id: 'tu_ps', nombre: 'PowerShell', input: { command: 'git status' }, bytes: 7000 }] : [],
  })),
});

test('SCRUM-996 · gasto · U1, U8 y lectura EXACTOS con un mensaje repetido (vale el último usage)', () => {
  const r = gasto(JOBS_A, ['sesiones', '--min-turnos', '8']);
  const pob = RE_POBLACION.exec(r.stdout);
  assert.ok(pob, `A21: no salió la línea POBLACION; stdout:\n${r.stdout.slice(0, 400)}\nstderr:\n${r.stderr.slice(0, 400)}`);
  assert.deepEqual(pob.slice(1).map(Number), [1, 1, 1, 1, 8]);
  const fila = /^sX\s+turnos=\s*(\d+) Σcontexto=(\d+) U1=(\d+) U8=(\d+) lectura=(-?\d+) → suelo ([\d.]+) % · lectura ([\d.]+) %/m.exec(r.stdout);
  assert.ok(fila, `no hay fila de la sesión sX:\n${r.stdout}`);
  const total = U_A.reduce((s, x) => s + x, 0);
  assert.equal(Number(fila[1]), 10, 'turnos: las líneas repetidas de un mensaje no son turnos');
  assert.equal(Number(fila[2]), total, 'Σcontexto');
  assert.equal(Number(fila[3]), U_A[0], 'U1 tiene que ser el último usage del mensaje 1, no el primero ni el mayor');
  assert.equal(Number(fila[4]), U_A[7], 'U8 tiene que ser el último usage del mensaje 8');
  assert.equal(Number(fila[5]), U_A[7] - U_A[0], 'lectura = U8 − U1');
  assert.equal(fila[6], ((100 * U_A[0] * 10) / total).toFixed(1), '% suelo');
  assert.equal(fila[7], ((100 * (U_A[7] - U_A[0]) * 2) / total).toFixed(1), '% lectura');
  assert.match(r.stdout, /líneas rotas=1 /, 'la línea cortada del jsonl no se declara');
  assert.match(r.stdout, /pesos SUPUESTOS.*input 1 · cache-write 1,25 · cache-read 0,1 · output 5/, 'los pesos supuestos no se imprimen');
  // Esta rampa lee 25 % en el arranque: el criterio tiene que decir NO CUMPLE y salir con 1.
  assert.match(r.stdout, /CRITERIO SCRUM-996: U8 mediano=8103 \(objetivo ≤ 90000\) · lectura\/contexto=25\.0 % \(objetivo ≤ 10 %\) · NO CUMPLE/);
  assert.equal(r.status, 1);
  assert.equal(exitImpreso(r.stdout), r.status, 'el EXIT= impreso no es el estado real del proceso');
});

test('SCRUM-996 · gasto · una sesión que SÍ cumple sale con 0 y dice CUMPLE', () => {
  const jobs = 'jobs-b';
  fabricarSesion(jobs, 'sB', { turnos: rampa(60, 50000, 10) });
  const r = gasto(jobs, ['sesiones', '--min-turnos', '8']);
  assert.ok(RE_POBLACION.test(r.stdout), 'A21: la cobaya no arrancó');
  assert.match(r.stdout, /CRITERIO SCRUM-996: U8 mediano=50080 \(objetivo ≤ 90000\) · lectura\/contexto=0\.1 % \(objetivo ≤ 10 %\) · CUMPLE/);
  assert.equal(r.status, 0);
  assert.equal(exitImpreso(r.stdout), 0);

  // --desde filtra por el timestamp del primer turno, y exige huso.
  const antes = gasto(jobs, ['sesiones', '--min-turnos', '8', '--desde', '2026-09-21T11:00:00Z']);
  assert.ok(RE_POBLACION.test(antes.stdout));
  assert.equal(antes.status, 0);
  const despues = gasto(jobs, ['sesiones', '--min-turnos', '8', '--desde', '2026-09-21T13:00:00Z']);
  assert.ok(RE_POBLACION.test(despues.stdout), 'A21: la cobaya no arrancó');
  assert.equal(despues.status, 2, 'ninguna sesión empezó después: población cero, no un verde');
  const sinHuso = gasto(jobs, ['sesiones', '--desde', '2026-09-21T12:00:00']);
  assert.equal(sinHuso.status, 2);
  assert.match(sinHuso.stdout, /--desde necesita una fecha ISO con huso/);
});

test('SCRUM-996 · gasto · --nombre s5 casa con s5-21x pero no con s50 ni s1-21y', () => {
  const jobs = 'jobs-c';
  for (const n of ['s5-21x', 's50', 's1-21y']) fabricarSesion(jobs, n, { turnos: rampa(10, 50000, 10) });
  const r = gasto(jobs, ['sesiones', '--min-turnos', '8', '--nombre', 's5']);
  const pob = RE_POBLACION.exec(r.stdout);
  assert.ok(pob, 'A21: la cobaya no arrancó');
  assert.deepEqual(pob.slice(1, 5).map(Number), [3, 3, 3, 1]);
  assert.match(r.stdout, /^s5-21x\s/m);
  assert.doesNotMatch(r.stdout, /^s50\s/m);
  assert.doesNotMatch(r.stdout, /^s1-21y\s/m);
  assert.equal(r.status, 0);
});

test('SCRUM-996 · gasto · ninguna sesión (directorio vacío, sin jsonl o inexistente) → salida 2, nunca un verde', () => {
  const vacio = 'jobs-vacio';
  fs.mkdirSync(path.join(raiz, vacio), { recursive: true });
  const r = gasto(vacio, ['sesiones']);
  assert.match(r.stdout, /^POBLACION: 0 state\.json/m, 'A21: no declara su población');
  assert.equal(r.status, 2);
  assert.match(r.stdout, /NO PUDE MIRAR: cero sesiones/);
  assert.equal(exitImpreso(r.stdout), 2);

  const sinJsonl = 'jobs-sin-jsonl';
  fs.mkdirSync(path.join(raiz, sinJsonl, 'job-x'), { recursive: true });
  fs.writeFileSync(path.join(raiz, sinJsonl, 'job-x', 'state.json'),
    JSON.stringify({ respawnFlags: ['-n', 'sZ'], linkScanPath: path.join(raiz, sinJsonl, 'no-existe.jsonl') }));
  const s = gasto(sinJsonl, ['sesiones']);
  assert.match(s.stdout, /^POBLACION: 1 state\.json · 0 con jsonl/m, 'A21: no declara su población');
  assert.equal(s.status, 2);

  const inexistente = gasto('jobs-no-existe', ['sesiones']);
  assert.equal(inexistente.status, 2);
  assert.match(inexistente.stdout, /NO PUDE MIRAR: no pude listar/);

  for (const sub of ['resultados', 'arranque sZ']) {
    const o = gasto(vacio, sub.split(' '));
    assert.match(o.stdout, /^POBLACION: 0 state\.json/m, `A21: ${sub} no declara su población`);
    assert.equal(o.status, 2, `${sub} con población cero tiene que salir con 2`);
  }
  assert.equal(gasto(vacio, ['nada']).status, 2);
  assert.equal(gasto(vacio, []).status, 2);
});

test('SCRUM-996 · gasto · arranque: tabla por turno con salto, herramienta, objetivo y bytes devueltos', () => {
  const r = gasto(JOBS_A, ['arranque', 'sX']);
  assert.match(r.stdout, /^POBLACION: 1 state\.json · 1 con jsonl · 1 con el nombre «sX»$/m, `A21: la cobaya no arrancó:\n${r.stdout.slice(0, 300)}`);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^=== sX · turnos=10 · suelo\(turno 1\)=1103$/m);
  assert.match(r.stdout, /^t01 U=1103 Δ=1103 Δsig=1000 res=0B/m);
  assert.match(r.stdout, /^t03 U=3103 Δ=1000 Δsig=1000 res=1234B\s+Read:\/x\/y\.md\(1234B\)$/m);
  assert.match(r.stdout, /^t05 U=5103 Δ=1000 Δsig=1000 res=7000B\s+PowerShell:git status\(7000B\)$/m);
  assert.match(r.stdout, /^t08 U=8103 /m);
  assert.equal(r.stdout.split('\n').filter((l) => /^t\d\d /.test(l)).length, 10);
  const corto = gasto(JOBS_A, ['arranque', 'sX', '--turnos', '4']);
  assert.equal(corto.stdout.split('\n').filter((l) => /^t\d\d /.test(l)).length, 4);
  assert.equal(gasto(JOBS_A, ['arranque', 'sNoExiste']).status, 2);
});

test('SCRUM-996 · gasto · resultados: coste ponderado de lo que devuelven las herramientas, con los grandes aparte', () => {
  const r = gasto(JOBS_A, ['resultados', '--min-turnos', '8']);
  assert.match(r.stdout, RE_POBLACION, `A21: la cobaya no arrancó:\n${r.stdout.slice(0, 300)}`);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /2,2 B\/token/, 'la estimación de 2,2 B/token no se declara');
  assert.match(r.stdout, /RESULTADOS: 2 resultados de herramienta casados con su llamada · 0 sin llamada casada/);
  // Independiente: coste total = Σ (input·1 + creation·1,25 + read·0,1 + output·5); un resultado del
  // turno t se paga una vez como cache-write y se relee en los N−t−1 turnos siguientes.
  const N = 10;
  const total = U_A.reduce((s, U) => s + 3 + 100 * 1.25 + (U - 103) * 0.1 + 50 * 5, 0);
  const coste = (bytes, turno) => (bytes / 2.2) * (1.25 + 0.1 * (N - turno - 1));
  const pct = (x) => ((100 * x) / total).toFixed(1);
  const read = coste(1234, 3);
  const ps = coste(7000, 5);
  assert.ok(r.stdout.includes(`Todo lo que devuelven las herramientas: ${pct(read + ps)} % del coste`));
  assert.ok(r.stdout.includes(`resultados ≥ 6000 B: 1 (50.0 % de los resultados) = ${pct(ps)} % del coste`));
  assert.ok(r.stdout.includes(`PowerShell n=1 media=7000B ${pct(ps)} %`));
  assert.ok(r.stdout.includes(`Read n=1 ${pct(read)} %`));
});

test('SCRUM-996 · gasto · traspaso: 6.000 B excede el tope (1), 4.000 B cabe (0), en el borde 5.120 cabe y 5.121 no, inexistente 2', () => {
  const de = (bytes, dir = `t${bytes}`) => escribir(path.join(dir, 'project_s5_traspaso.md'), 'a'.repeat(bytes));
  const excede = correr(GASTO, ['traspaso', '--fichero', de(6000)]);
  assert.match(excede.stdout, /^POBLACION: 1 fichero$/m, `A21: la cobaya no arrancó:\n${excede.stdout.slice(0, 300)}`);
  assert.equal(excede.status, 1);
  assert.match(excede.stdout, /EXCEDE EL TOPE por 880 B/);
  assert.match(excede.stdout, /mueve lo histórico y las trampas a project_s5_historial\.md/);
  assert.match(excede.stdout, /6000 B \(≈ 2727 tokens a 2,2 B\/token, estimación\) · tope 5120 B/);
  assert.equal(exitImpreso(excede.stdout), 1);

  const cabe = correr(GASTO, ['traspaso', '--fichero', de(4000)]);
  assert.match(cabe.stdout, /^POBLACION: 1 fichero$/m);
  assert.equal(cabe.status, 0);
  assert.match(cabe.stdout, /OK: dentro del tope \(1120 B de margen\)/);
  assert.equal(exitImpreso(cabe.stdout), 0);

  const justo = correr(GASTO, ['traspaso', '--fichero', de(5120)]);
  assert.match(justo.stdout, /^POBLACION: 1 fichero$/m);
  assert.equal(justo.status, 0, 'un traspaso de EXACTAMENTE el tope cabe (≤ tope)');
  const uno = correr(GASTO, ['traspaso', '--fichero', de(5121)]);
  assert.match(uno.stdout, /^POBLACION: 1 fichero$/m);
  assert.equal(uno.status, 1, 'un byte por encima del tope ya no cabe');

  const tope = correr(GASTO, ['traspaso', '--fichero', de(4000, 'otro'), '--tope', '3000']);
  assert.equal(tope.status, 1);
  assert.match(tope.stdout, /tope 3000 B/);

  const inexistente = correr(GASTO, ['traspaso', '--fichero', path.join(raiz, 'no-existe', 'project_s5_traspaso.md')]);
  assert.equal(inexistente.status, 2);
  assert.match(inexistente.stdout, /NO PUDE MIRAR: no pude leer/);
  assert.match(inexistente.stdout, /^POBLACION: 0 ficheros$/m);

  const vacio = correr(GASTO, ['traspaso', '--fichero', escribir('vacio/project_s5_traspaso.md', '')]);
  assert.equal(vacio.status, 2, 'un traspaso vacío no es un traspaso: 2, no un verde');
});

test('SCRUM-996 · gasto · traspaso <sN> resuelve la ruta desde el cwd (D:\\… → D--…) y rechaza nombres de puesto peligrosos', () => {
  assert.equal(slugDeCwd('D:\\MILLONARIO\\cobroFlash\\cobroflash-backend'), 'D--MILLONARIO-cobroFlash-cobroflash-backend');
  const cwd = 'D:\\MILLONARIO\\cobroFlash\\cobroflash-backend';
  const memoria = path.join(raiz, 'home', '.claude', 'projects', 'D--MILLONARIO-cobroFlash-cobroflash-backend', 'memory');
  fs.mkdirSync(memoria, { recursive: true });
  fs.writeFileSync(path.join(memoria, 'project_s5_traspaso.md'), 'a'.repeat(4000));
  const r = ejecutar(['traspaso', 's5'], { home: path.join(raiz, 'home'), cwd });
  assert.equal(r.codigo, 0, r.texto);
  assert.ok(r.texto.includes(path.join(memoria, 'project_s5_traspaso.md')));
  assert.match(r.texto, /EXIT=0\n$/);
  const otro = ejecutar(['traspaso', 's9'], { home: path.join(raiz, 'home'), cwd });
  assert.equal(otro.codigo, 2, 'sin traspaso de ese puesto: NO PUDE MIRAR');
  assert.match(otro.texto, /project_s9_traspaso\.md/);
  for (const malo of ['../x', 'a/b', '..']) {
    assert.equal(ejecutar(['traspaso', malo], { home: raiz, cwd }).codigo, 2, `«${malo}» no puede ser un puesto`);
  }
});

test('SCRUM-996 · gasto · funciones puras: dedupe por message.id, U sin output, borde del tope, < 8 turnos no tiene U8', () => {
  const asis = (id, U, out = 0) => ({ type: 'assistant', message: { id, usage: { input_tokens: 1, cache_creation_input_tokens: 2, cache_read_input_tokens: U - 3, output_tokens: out }, content: [] } });
  const turnos = turnosDeEntradas([asis('a', 10), asis('a', 20, 999), asis('b', 30), { type: 'assistant', message: { id: 'c', content: [] } }, asis('a', 40)]);
  assert.deepEqual(turnos.map((t) => [t.id, t.U]), [['a', 40], ['b', 30]], 'orden de primera aparición, último usage, sin turnos sin usage');
  assert.equal(resumenDeSesion(turnos), null, 'con 2 turnos no hay turno 8');

  assert.equal(medirTraspaso(5120, 5120).excede, false);
  assert.equal(medirTraspaso(5121, 5120).excede, true);
  assert.equal(medirTraspaso(5121, 5120).exceso, 1);
  assert.equal(medirTraspaso(4000, 5120).margen, 1120);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// Higiene de los tres ficheros
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-996 · higiene · los tres ficheros nuevos no tienen bytes de control ni BOM', () => {
  const ficheros = [NORMA, GASTO, YO];
  assert.equal(ficheros.length, 3);
  const cuenta = [];
  for (const f of ficheros) {
    const buf = fs.readFileSync(f);
    assert.ok(buf.length > 0, `A21: ${f} está vacío: el control no tiene sujeto`);
    cuenta.push(`${path.basename(f)}=${buf.length} B`);
    assert.ok(!(buf[0] === 239 && buf[1] === 187 && buf[2] === 191), `${f} empieza con BOM`);
    const malos = [];
    buf.forEach((b, i) => { if ((b < 32 && b !== 9 && b !== 10 && b !== 13) || b === 127) malos.push(`byte ${b} en ${i}`); });
    assert.deepEqual(malos, [], `${f} tiene bytes de control (${cuenta.join(', ')})`);
  }
});
