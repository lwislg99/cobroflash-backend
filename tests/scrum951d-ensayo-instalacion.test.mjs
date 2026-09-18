// tests/scrum951d-ensayo-instalacion.test.mjs — SCRUM-951d · lo que cazó el ENSAYO de la instalación
//
// El 18-sep-2026 la Sesión 5 siguió `docs/equipo/instalacion-maquina-nueva.md` al pie de la letra en
// esta máquina, con un clon nuevo, una instalación de prueba y el prefijo `ensayo-`. La lista de
// verificación salió «OK · 14 comprobaciones» y, aun así, la única sesión de prueba NO LLEGÓ A
// ARRANCAR: se quedó `blocked` en «approve 1 new project MCP server (playwright)». Dos verdes que
// no lo eran, y este fichero fija los dos:
//
//   · MCP DEL PROYECTO — un servidor de `.mcp.json` que nadie ha decidido bloquea toda sesión de
//     fondo lanzada en el repo. Sin decidir = FALLA; decidido en cualquier sitio que lea Claude
//     Code = OK. El checkout de Luis lo tiene decidido como cambio LOCAL sin commitear, así que
//     ningún clon lo hereda.
//   · AVISO DE USO — `uso.mjs` guarda siempre en `%LOCALAPPDATA%\yaqu-equipo\uso.json`. Con la
//     instalación en otra carpeta, el VERDE era de OTRA instalación: ahora es AVISO y dice qué
//     fichero leyó.
//
// Las funciones se prueban puras, con la «casa» y el repo en un temporal: nada de este fichero lee
// la máquina en la que corre.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { temporal } from './_temporal.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const c = await import(pathToFileURL(path.join(RAIZ, 'scripts', 'equipo', 'comprobar-instalacion.mjs')).href);

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/equipo/comprobar-instalacion.mjs',
    de: '  if (sinDecidir.length === 0) return',
    a: '  if (true) return',
    cae: '🔴 ROJO: un servidor de .mcp.json sin decidir da FALLA',
  },
  {
    fichero: 'scripts/equipo/comprobar-instalacion.mjs',
    de: "  if (fuentes.some((j) => j.enableAllProjectMcpServers === true)) {",
    a: '  if (false) {',
    cae: 'enableAllProjectMcpServers en los settings del usuario lo decide todo',
  },
  {
    fichero: 'scripts/equipo/comprobar-instalacion.mjs',
    de: "    if (p && rutaComparable(clave, plataforma) === rutaComparable(repo, plataforma)) fuentes.push(p);",
    a: '',
    cae: 'la decisión guardada en la entrada del proyecto de ~/.claude.json cuenta',
  },
  {
    fichero: 'scripts/equipo/comprobar-instalacion.mjs',
    de: '  const sinBom = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;',
    a: '  const sinBom = texto;',
    cae: 'unos settings con BOM (como los de origin/main) se leen',
  },
  {
    fichero: 'scripts/equipo/comprobar-instalacion.mjs',
    de: "  if (status === 0 && vu?.veredicto === 'VERDE') return deOtra ?",
    a: "  if (status === 0 && vu?.veredicto === 'VERDE') return false ?",
    cae: '🔴 ROJO: un VERDE leído del uso.json de OTRA carpeta es AVISO, no OK',
  },
  {
    // Lo que el CI de Linux del #1516 cazó: con el dirname del host, «\» no parte en posix.
    fichero: 'scripts/equipo/comprobar-instalacion.mjs',
    de: "  const dirnameDe = plataforma === 'win32' ? path.win32.dirname : path.posix.dirname;",
    a: '  const dirnameDe = path.posix.dirname;',
    cae: 'el uso.json de ESTA instalación sigue siendo OK (en Windows, sin mirar la caja ni las barras)',
  },
];

function banco() {
  const dir = temporal('scrum951d-');
  const repo = path.join(dir, 'repo');
  const casa = path.join(dir, 'casa');
  fs.mkdirSync(path.join(repo, '.claude'), { recursive: true });
  fs.mkdirSync(path.join(casa, '.claude'), { recursive: true });
  const escribir = (f, obj, bom = false) => fs.writeFileSync(f, (bom ? String.fromCharCode(0xfeff) : '') + JSON.stringify(obj, null, 2));
  escribir(path.join(repo, '.mcp.json'), { mcpServers: { playwright: { command: 'npx' } } });
  // Lo que trae origin/main el 18-sep-2026: settings del repo SIN decisión sobre MCP, y con BOM.
  escribir(path.join(repo, '.claude', 'settings.local.json'), { permissions: { allow: [] } }, true);
  escribir(path.join(repo, '.claude', 'settings.json'), { hooks: {} });
  return { repo, casa, escribir };
}

test('🔴 ROJO: un servidor de .mcp.json sin decidir da FALLA', () => {
  const b = banco();
  const [v, detalle] = c.juzgarMcp({ repo: b.repo, casa: b.casa, plataforma: 'win32' });
  assert.equal(v, 'FALLA', `🔴 un clon recién hecho pasa la lista y su primera sesión de fondo se bloquea: ${detalle}`);
  assert.match(detalle, /playwright/, 'la FALLA no dice qué servidor falta');
});

test('decidido en los settings locales del repo (lo que tiene el checkout de Luis) da OK', () => {
  const b = banco();
  b.escribir(path.join(b.repo, '.claude', 'settings.local.json'), { disabledMcpjsonServers: ['playwright'] }, true);
  assert.deepEqual(c.juzgarMcp({ repo: b.repo, casa: b.casa, plataforma: 'win32' })[0], 'OK');
});

test('unos settings con BOM (como los de origin/main) se leen', () => {
  const b = banco();
  b.escribir(path.join(b.repo, '.claude', 'settings.local.json'), { enabledMcpjsonServers: ['playwright'] }, true);
  const [v, detalle] = c.juzgarMcp({ repo: b.repo, casa: b.casa, plataforma: 'win32' });
  assert.equal(v, 'OK', `🔴 el BOM tumba la lectura: ${detalle}`);
});

test('enableAllProjectMcpServers en los settings del usuario lo decide todo', () => {
  const b = banco();
  b.escribir(path.join(b.casa, '.claude', 'settings.json'), { enableAllProjectMcpServers: true });
  assert.equal(c.juzgarMcp({ repo: b.repo, casa: b.casa, plataforma: 'win32' })[0], 'OK');
});

test('la decisión guardada en la entrada del proyecto de ~/.claude.json cuenta', () => {
  const b = banco();
  // La clave con otra caja y otras barras: en Windows es la misma carpeta.
  const clave = b.repo.replace(/\\/g, '/').toUpperCase();
  b.escribir(path.join(b.casa, '.claude.json'), { projects: { [clave]: { disabledMcpjsonServers: ['playwright'] } } });
  assert.equal(c.juzgarMcp({ repo: b.repo, casa: b.casa, plataforma: 'win32' })[0], 'OK');
  // CONTROL: la entrada de OTRO proyecto no decide por éste.
  b.escribir(path.join(b.casa, '.claude.json'), { projects: { 'C:/otro/repo': { disabledMcpjsonServers: ['playwright'] } } });
  assert.equal(c.juzgarMcp({ repo: b.repo, casa: b.casa, plataforma: 'win32' })[0], 'FALLA');
});

test('SUELO: un settings ilegible es NO-PUDE-MIRAR, nunca OK; sin .mcp.json no hay nada que decidir', () => {
  const b = banco();
  fs.writeFileSync(path.join(b.repo, '.claude', 'settings.json'), '{ esto no es json');
  assert.equal(c.juzgarMcp({ repo: b.repo, casa: b.casa, plataforma: 'win32' })[0], 'NO-PUDE-MIRAR');
  fs.rmSync(path.join(b.repo, '.mcp.json'));
  assert.equal(c.juzgarMcp({ repo: b.repo, casa: b.casa, plataforma: 'win32' })[0], 'OK');
});

test('🔴 ROJO: un VERDE leído del uso.json de OTRA carpeta es AVISO, no OK', () => {
  const destino = 'C:/Users/X/.claude/jobs/ensayo/inst';
  const vu = { veredicto: 'VERDE', motivo: 'uso 74% < 85%', fichero: 'C:\\Users\\X\\AppData\\Local\\yaqu-equipo\\uso.json' };
  const [v, detalle] = c.juzgarUso({ status: 0, vu, destino, plataforma: 'win32' });
  assert.equal(v, 'AVISO', `🔴 el aviso de uso de otra instalación pasa por el de ésta: ${detalle}`);
  assert.ok(detalle.includes(vu.fichero), 'el AVISO no dice qué fichero leyó');
  assert.equal(c.juzgarUso({ status: 1, vu: { ...vu, veredicto: 'AVISO' }, destino, plataforma: 'win32' })[0], 'AVISO');
});

test('el uso.json de ESTA instalación sigue siendo OK (en Windows, sin mirar la caja ni las barras)', () => {
  const destino = 'C:/Users/X/AppData/Local/yaqu-equipo';
  const vu = { veredicto: 'VERDE', motivo: 'uso 74% < 85%', fichero: 'c:\\users\\x\\appdata\\local\\yaqu-equipo\\uso.json' };
  assert.equal(c.juzgarUso({ status: 0, vu, destino, plataforma: 'win32' })[0], 'OK');
  // Lo que ya vigilaba 951a no cambia: sin lectura es AVISO, y salida y veredicto que no cuadran, FALLA.
  assert.equal(c.juzgarUso({ status: 2, vu: { ...vu, veredicto: 'NO_PUDE_MIRAR' }, destino, plataforma: 'win32' })[0], 'AVISO');
  assert.equal(c.juzgarUso({ status: 0, vu: { ...vu, veredicto: 'AVISO' }, destino, plataforma: 'win32' })[0], 'FALLA');
});
