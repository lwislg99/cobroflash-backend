// tests/scrum429-cliente-privado.test.mjs — SCRUM-429
//
// EL CLIENTE SE REGENERA SOLO, PERO **SOLO DONDE HACERLO NO ROMPE A NADIE**.
//
// ── LAS DOS CAUSAS ──────────────────────────────────────────────────────────────────────────
// `prisma/schema.prisma` viaja con la rama; el cliente generado NO.
//
//   (A) tu propio cambio de rama → tu cliente se queda viejo sin que nadie más toque nada;
//   (B) otro worktree, si `node_modules` es un JUNCTION al de otro.
//
// **Ningún aislamiento arregla la (A)** — le pasó a un worktree con `node_modules` REAL y propio, y
// se diagnosticó como (B) porque el mensaje del guard solo nombraba ésa. Lo único que cierra las dos
// es que la regeneración ocurra sola; y eso **solo es seguro si el cliente es privado**, porque con
// junction regenerar arregla el tuyo y rompe el de quien esté corriendo tests.
//
// Por eso la condición no se supone: se DERIVA con `lstat`.
//
// Sin gate: funciones puras y ficheros temporales. Ni BD, ni red.
import test from 'node:test';
import { soloEjecutable } from './_guard-texto.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { clienteEsPrivado } from '../scripts/_prisma-sync.mjs';
import { comprobarCliente } from '../scripts/_prisma-client-guard.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

test('SCRUM-429 · SUELO: sin cliente que mirar, se declara CIEGO — no da verde', () => {
  // Sería ridículo repetir aquí el defecto que perseguimos: si el detector no localiza el cliente
  // generado, «no hay divergencia» y «no supe mirar» serían el mismo verde. El guard ya falla
  // cerrado; esto lo fija para que nadie lo relaje.
  // La ruta va como URL `file://`: es el contrato de `comprobarCliente` (mismo uso que en
  // `scrum235`). Pasar una ruta de Windows a pelo hace que el `import()` lance un error de ESM
  // opaco en vez de declararse ciego — papercut anotado, no es de este ticket.
  return comprobarCliente({ rutaCliente: pathToFileURL(path.join(os.tmpdir(), 'no-existe-cliente-prisma')).href })
    .then((r) => {
      assert.equal(r.ok, false,
        '🔴 con un cliente inexistente el guard da VERDE. Dos conjuntos vacíos son iguales, así que '
        + 'eso no es «todo bien»: es no haber comparado nada.');
      assert.match(r.mensaje, /NO SE PUEDE COMPARAR|no significaría nada|falla cerrado/i,
        '🔴 no se declara ciego: el mensaje tiene que decir que no pudo comparar, no acusar');
    });
});

test('SCRUM-429 · un `node_modules` REAL es privado; un JUNCTION no', () => {
  // Se construyen los dos casos aquí mismo, con un junction de verdad, para no depender de cómo
  // esté montada la máquina el día que esto corra.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum429-'));
  const real = path.join(dir, 'real');
  const enlace = path.join(dir, 'enlace');
  fs.mkdirSync(real);
  try {
    fs.symlinkSync(real, enlace, 'junction');
  } catch {
    // Sin privilegios para crear el enlace no se puede afirmar nada, y afirmarlo igual sería
    // exactamente el verde hueco que este fichero persigue.
    assert.fail('🔴 no se pudo crear un junction de prueba: este test no puede demostrar nada aquí');
  }
  try {
    assert.equal(clienteEsPrivado(real), true, '🔴 un directorio real se toma por compartido');
    assert.equal(clienteEsPrivado(enlace), false,
      '🔴 UN JUNCTION SE TOMA POR PRIVADO. Con eso, el automatismo regeneraría sobre un cliente '
      + 'compartido y rompería la medición de quien estuviera corriendo tests — el daño exacto que '
      + 'este ticket vino a quitar.');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SCRUM-429 · si no se puede saber, NO se decide por omisión', () => {
  // `null` y `false` llevan al mismo sitio (no regenerar) a propósito: la duda no se resuelve a
  // favor de actuar. Se comprueba que devuelve `null` y no `true`, que es el fallo que importa.
  assert.equal(clienteEsPrivado(path.join(os.tmpdir(), 'ni-existe-esto-429')), null,
    '🔴 con una ruta que no existe se responde algo distinto de `null`: si respondiera `true`, el '
    + 'automatismo regeneraría sin saber sobre qué');
});

test('SCRUM-429 · `pretest` sincroniza ANTES y el guard sigue DETRÁS', () => {
  // 🔴 EL ORDEN ES EL TICKET. Sincronizar después del guard no serviría de nada (el guard ya habría
  // abortado), y quitar el guard dejaría el automatismo sin vigilante: el día que se deshaga
  // querríamos enterarnos por él y no por una medición corrompida.
  const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
  const pre = pkg.scripts.pretest;
  assert.ok(pre, '🔴 no hay `pretest`');
  const iSync = pre.indexOf('_prisma-sync.mjs');
  const iGuard = pre.indexOf('_prisma-client-guard.mjs');
  assert.ok(iSync >= 0, '🔴 `pretest` ya no sincroniza el cliente: vuelve la causa (A) a mano');
  assert.ok(iGuard >= 0,
    '🔴 EL GUARD HA DESAPARECIDO DE `pretest`. Es lo único que ha hecho detectable esta divergencia '
    + 'seis veces, y se queda aunque la regeneración sea automática.');
  assert.ok(iSync < iGuard,
    '🔴 el guard corre ANTES que la sincronización: abortaría la tanda antes de que el automatismo '
    + 'pudiera arreglar nada, y el automatismo no serviría para nada.');
});

test('SCRUM-429 · el automatismo NO llama a `npx` ni pasa por un shell', () => {
  // `npx prisma` se baja `prisma@latest` cuando falta el local y genera desde OTRA versión
  // (SCRUM-385): sería cambiar un cliente equivocado por otro. Y el `.cmd` de `.bin` exige
  // `shell: true` en Windows, que arrastra un aviso de deprecación por los argumentos sin escapar.
  const s = fs.readFileSync(path.join(RAIZ, 'scripts/_prisma-sync.mjs'), 'utf8');
  const ejecutable = soloEjecutable(s);
  assert.ok(!/npx/.test(ejecutable), '🔴 el automatismo llama a `npx`: puede generar desde otra versión');
  assert.ok(!/shell:\s*true|shell:\s*process\.platform/.test(ejecutable),
    '🔴 el automatismo pasa por un shell: vuelve el aviso de deprecación y el escapado de argumentos');
  assert.match(ejecutable, /prisma[/\\]build[/\\]index\.js|'prisma',\s*'build'/,
    '🔴 ya no invoca el CLI local de prisma por su JS: se pierde la garantía de versión');
});
