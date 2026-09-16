// tests/scrum864-el-temporal-que-se-borra.test.mjs — SCRUM-864
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL MECANISMO QUE LIMPIA TIENE QUE ESTAR VIGILADO COMO CUALQUIER OTRO
//
// `tests/_temporal.mjs` promete que un directorio temporal se borra **pase lo que pase**. Una
// promesa así, sin test, es exactamente lo que este ticket vino a arreglar: `mkdtempSync` también
// «se limpiaba» — en el camino feliz.
//
// 🔴 Y LO PIDIÓ UN GUARD, NO YO: el helper entró sin test propio y `scrum824` («el conjunto de
// ficheros SIN PROBAR no crece») se puso rojo con él dentro. Se arregla el código, no el guard.
//
// ⛔ Este fichero NO BORRA NADA de TMPDIR que no haya creado él mismo, y sólo por su prefijo.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { temporal, borrarTemporal, temporalesPendientes } from './_temporal.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PREFIJO = 'scrum864-test-';

/** Sólo los de ESTE test. Nunca se mira, ni se toca, nada más de TMPDIR. */
const mios = () => fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith(PREFIJO));

test('SCRUM-864 · SUELO: crea el directorio de verdad y lo declara pendiente', () => {
  const antes = temporalesPendientes().length;
  const dir = temporal(PREFIJO);
  assert.ok(fs.existsSync(dir), '🔴 no ha creado nada: sin esto, todo lo demás mide el vacío');
  assert.ok(fs.statSync(dir).isDirectory(), '🔴 lo creado no es un directorio');
  assert.equal(temporalesPendientes().length, antes + 1,
    '🔴 el registro no lo ha anotado. Si no está en el registro, la limpieza de salida no lo verá '
    + 'y la promesa del módulo no se cumple para él.');
  borrarTemporal(dir);
});

test('SCRUM-864 · `borrarTemporal` lo quita del disco Y del registro', () => {
  const dir = temporal(PREFIJO);
  borrarTemporal(dir);
  assert.equal(fs.existsSync(dir), false, '🔴 sigue en disco');
  assert.equal(temporalesPendientes().includes(dir), false,
    '🔴 sigue en el registro: al salir se intentaría borrar algo que ya no está. Con `force` no '
    + 'rompe, pero el registro estaría mintiendo sobre lo que queda vivo.');
});

test('SCRUM-864 · ✅ dos llamadas dan directorios DISTINTOS', () => {
  const a = temporal(PREFIJO);
  const b = temporal(PREFIJO);
  assert.notEqual(a, b,
    '🔴 dos llamadas devuelven el mismo directorio: dos tests que lo usaran a la vez se pisarían '
    + 'los ficheros, y el segundo mediría lo que escribió el primero.');
  borrarTemporal(a);
  borrarTemporal(b);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL QUE DECIDE · un proceso que REVIENTA no deja el directorio
//
// No se puede comprobar dentro de este proceso: lo que se vigila es lo que pasa **al salir**. Así
// que se lanza un proceso hijo que crea uno y muere con una excepción sin capturar.
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-864 · 🔴 EL QUE DECIDE: un proceso que muere por excepción NO deja el temporal', () => {
  const antes = new Set(mios());
  const hijo = `
    import { temporal } from ${JSON.stringify(pathToFileURL(path.join(RAIZ, 'tests/_temporal.mjs')).href)};
    const dir = temporal('${PREFIJO}');
    console.log(dir);            // testigo de ejecución: sin esto, un hijo que no arranca da 0
    throw new Error('revienta a propósito');
  `;
  const f = path.join(temporal(PREFIJO), 'hijo.mjs');
  fs.writeFileSync(f, hijo);
  const r = spawnSync(process.execPath, [f], { cwd: RAIZ, shell: false, encoding: 'utf8' });

  // SUELO: el hijo tiene que haber llegado a crear el directorio. Un hijo que no arranca deja
  // cero restos, y ese cero se lee igual que «limpió» — es el error que ya cazó el banco.
  const creado = (r.stdout || '').trim().split('\n').pop();
  assert.ok(creado && creado.includes(PREFIJO),
    `🔴 CIEGO: el hijo no llegó a crear nada (stdout: ${JSON.stringify((r.stdout || '').slice(0, 120))}, `
    + `stderr: ${JSON.stringify((r.stderr || '').slice(0, 200))}). Sin creación no hay nada que limpiar.`);
  assert.notEqual(r.status, 0, '🔴 el hijo tenía que morir por la excepción y ha salido bien');

  assert.equal(fs.existsSync(creado), false,
    `🔴 el proceso murió y dejó ${creado} en TMPDIR. Es EXACTAMENTE el defecto de SCRUM-864: `
    + '24.740 restos nuestros de 55.229 entradas, todos de temporales que nadie borró.');

  for (const n of mios()) if (!antes.has(n)) fs.rmSync(path.join(os.tmpdir(), n), { recursive: true, force: true });
});

test('SCRUM-864 · ✅ POSITIVO: un proceso que termina BIEN tampoco lo deja, y sale con 0', () => {
  const antes = new Set(mios());
  const hijo = `
    import { temporal } from ${JSON.stringify(pathToFileURL(path.join(RAIZ, 'tests/_temporal.mjs')).href)};
    console.log(temporal('${PREFIJO}'));
  `;
  const f = path.join(temporal(PREFIJO), 'hijo-ok.mjs');
  fs.writeFileSync(f, hijo);
  const r = spawnSync(process.execPath, [f], { cwd: RAIZ, shell: false, encoding: 'utf8' });

  const creado = (r.stdout || '').trim().split('\n').pop();
  assert.ok(creado && creado.includes(PREFIJO), '🔴 CIEGO: el hijo no creó nada');
  assert.equal(r.status, 0, '🔴 el camino feliz ha dejado de salir con 0: el helper rompe algo');
  assert.equal(fs.existsSync(creado), false, '🔴 el camino feliz deja el directorio');

  for (const n of mios()) if (!antes.has(n)) fs.rmSync(path.join(os.tmpdir(), n), { recursive: true, force: true });
});

test('SCRUM-864 · ⚠️ lo que el helper NO promete, dicho en su propia cabecera', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, 'tests/_temporal.mjs'), 'utf8');
  assert.match(fuente, /SIGKILL/,
    '🔴 la cabecera ha dejado de decir que un `SIGKILL` no ejecuta ningún manejador de salida. Un '
    + 'mecanismo de limpieza que no declara su límite se lee como una garantía total, y entonces '
    + 'nadie vuelve a mirar el directorio.');
});
