// tests/scrum1605-el-aviso-se-cierra.test.mjs — SCRUM-1605 · el aviso «Producción congelada» se cierra
// solo cuando producción vuelve a estar al día
//
// El #2455 se abrió el 14-oct-2026; la congelación de verdad del 21-23 oct comentó en él; y desde el
// 23-oct 22:42Z el vigía salió verde 17 pasadas seguidas con el Issue abierto (medido el 27-oct con
// `gh run list --workflow vigia-despliegue.yml`). El vigía abría y comentaba, pero no cerraba nunca:
// el único `gh issue close` del workflow era el del simulacro.
//
// Lo que se prueba, con las DOS mitades del trinquete:
//   ① la decisión (`decidirCierre`, pura): cierra con `al-dia` y sólo con `al-dia`;
//   ② la secuencia entera: congelada → comenta · al día → cierra · otra congelación → abre uno NUEVO;
//   ③ el CLI: una lista de Issues que no llega es «no se sabe» (salida 1), nunca «ningún aviso abierto»;
//   ④ el cableado del YAML: el paso existe, no corre en un simulacro y su marca es la del aviso.
// Lo que NO prueba: que la API de GitHub acepte el `gh issue close` (lo mismo que declara 1123).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODULO = path.join(RAIZ, 'scripts', 'vigia-despliegue-aviso.mjs');
const m = await import(pathToFileURL(MODULO).href);
const { MARCA_DE_CONGELADA } = await import(pathToFileURL(path.join(RAIZ, 'scripts', 'equipo', 'latido.mjs')).href);
const YAML = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'vigia-despliegue.yml'), 'utf8');

const MARCA = '<!-- vigia-despliegue:produccion-congelada -->';
// Renglones con la forma real (el de las 02:16Z es el del comentario del #2455 del 23-oct).
const CONGELADA = 'vigía · 2026-10-23T02:16:14Z · atrasado · prod=fe65a8b7 · main=82f3ea41 · hueco=37.6h · commits=229';
const AL_DIA_1 = 'vigía · 2026-10-23T22:42:30Z · al-dia · prod=82f3ea41 · main=82f3ea41 · hueco=0.0h · commits=0';
const AL_DIA_2 = 'vigía · 2026-10-24T02:14:40Z · al-dia · prod=91aa0c2e · main=91aa0c2e · hueco=0.0h · commits=0';
const CIEGA = 'vigía · 2026-10-24T04:00:00Z · no-supe-mirar · prod=? · main=? · hueco=? · commits=? · motivo=yaqu.app no contestó';
const AVISO = { number: 2455, body: `El vigía ha cantado…\n\n${MARCA}\n` };
const OTRO = { number: 2641, body: 'otro Issue, sin la marca' };

test('① CIERRA: lectura al-dia + aviso abierto → cerrar ese Issue, diciendo DESDE CUÁNDO está sana', () => {
  const d = m.decidirCierre({ issues: [OTRO, AVISO], marca: MARCA, renglon: AL_DIA_2, historial: [CONGELADA, AL_DIA_1, AL_DIA_2].join('\n'), runUrl: 'https://x/run/1' });
  assert.equal(d.accion, 'cerrar');
  assert.equal(d.numero, 2455);
  assert.match(d.comentario, /desde \*\*2026-10-23T22:42:30Z\*\* \(2 lecturas seguidas al día; la anterior, 2026-10-23T02:16:14Z, decía `atrasado`\)/);
  assert.match(d.comentario, /Issue NUEVO/);
  assert.ok(d.comentario.includes(AL_DIA_2), 'cita la lectura que lo cierra');
});

test('① sin la lectura anterior en el historial dice «al menos desde», no se inventa el principio', () => {
  const d = m.decidirCierre({ issues: [AVISO], marca: MARCA, renglon: AL_DIA_1, historial: AL_DIA_1 });
  assert.match(d.comentario, /al menos desde \*\*2026-10-23T22:42:30Z\*\* \(1 lectura seguida al día; el historial del vigía no llega más atrás\)/);
});

test('① NO CIERRA: atrasado, no-supe-mirar, simulacro, o nada abierto', () => {
  for (const renglon of [CONGELADA, CIEGA]) {
    const d = m.decidirCierre({ issues: [AVISO], marca: MARCA, renglon });
    assert.equal(d.accion, 'nada', renglon);
  }
  assert.equal(m.decidirCierre({ issues: [AVISO], marca: MARCA, renglon: AL_DIA_1, simulacro: true }).accion, 'nada');
  assert.equal(m.decidirCierre({ issues: [OTRO], marca: MARCA, renglon: AL_DIA_1 }).accion, 'nada');
  // «retrasado pero desplegando» sale 0 pero su renglón dice `atrasado`: tampoco cierra.
  assert.equal(m.decidirCierre({ issues: [AVISO], marca: MARCA, renglon: CONGELADA.replace('37.6h', '7.0h') }).accion, 'nada');
});

test('① FALLA CERRADO: sin marca, sin lista de Issues o sin renglón legible → no-se-sabe, nunca «nada»', () => {
  assert.equal(m.decidirCierre({ issues: [AVISO], renglon: AL_DIA_1 }).accion, 'no-se-sabe');
  assert.equal(m.decidirCierre({ issues: null, marca: MARCA, renglon: AL_DIA_1 }).accion, 'no-se-sabe');
  assert.equal(m.decidirCierre({ issues: [AVISO], marca: MARCA, renglon: '' }).accion, 'no-se-sabe');
  assert.equal(m.decidirCierre({ issues: [AVISO], marca: MARCA, renglon: 'al-dia' }).accion, 'no-se-sabe');
});

test('🔴 ② LAS DOS MITADES: congelada → comenta · al día → cierra · otra congelación → abre uno NUEVO', () => {
  let abiertos = [OTRO, AVISO];
  // congelada, con el aviso abierto: comenta en él (lo de siempre)
  assert.deepEqual([m.decidirAviso({ issues: abiertos, marca: MARCA, renglon: CONGELADA, runUrl: 'u' }).accion,
    m.decidirCierre({ issues: abiertos, marca: MARCA, renglon: CONGELADA }).accion], ['comentar', 'nada']);
  // al día: se cierra
  const c = m.decidirCierre({ issues: abiertos, marca: MARCA, renglon: AL_DIA_1, historial: `${CONGELADA}\n${AL_DIA_1}` });
  assert.equal(c.accion, 'cerrar');
  abiertos = abiertos.filter((i) => i.number !== c.numero);
  // otra congelación: ya no hay aviso abierto, así que se CREA uno, con la lectura de hoy en el cuerpo
  const nuevo = m.decidirAviso({ issues: abiertos, marca: MARCA, renglon: CONGELADA, runUrl: 'u' });
  assert.equal(nuevo.accion, 'crear');
  assert.ok(nuevo.cuerpo.includes('2026-10-23T02:16:14Z'), 'el aviso nuevo lleva la fecha de su congelación en el CUERPO');
  // y al día sin nada abierto, no hace nada
  assert.equal(m.decidirCierre({ issues: abiertos, marca: MARCA, renglon: AL_DIA_2 }).accion, 'nada');
});

function cli(env) {
  const r = spawnSync(process.execPath, [MODULO, 'cerrar'], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, VIGIA_MARCA: MARCA, VIGIA_RENGLON: AL_DIA_1, ...env },
  });
  return { status: r.status, json: JSON.parse(r.stdout.trim()) };
}

test('🔴 ③ CLI `cerrar`: sin VIGIA_ISSUES_JSON es no-se-sabe (salida 1), no «ningún aviso abierto»', () => {
  const sin = cli({});
  assert.equal(sin.status, 1);
  assert.equal(sin.json.accion, 'no-se-sabe');
  assert.equal(cli({ VIGIA_ISSUES_JSON: '{roto' }).json.accion, 'no-se-sabe');
  // CONTROL: con la lista, el mismo CLI sí decide
  const con = cli({ VIGIA_ISSUES_JSON: JSON.stringify([AVISO]), VIGIA_HISTORIAL: `${CONGELADA}\n${AL_DIA_1}` });
  assert.deepEqual([con.status, con.json.accion, con.json.numero], [0, 'cerrar', 2455]);
  assert.equal(cli({ VIGIA_ISSUES_JSON: '[]' }).json.accion, 'nada');
});

/** El bloque de un paso del YAML, desde su `- name:` hasta el siguiente paso. */
function paso(nombre) {
  const i = YAML.indexOf(`- name: ${nombre}`);
  assert.ok(i >= 0, `no está el paso «${nombre}»`);
  const fin = YAML.indexOf('\n      - name: ', i + 1);
  return YAML.slice(i, fin < 0 ? undefined : fin);
}

test('🔴 ④ el YAML: el paso de cierre existe, sólo con salida 0, nunca en simulacro, y «no pude» sale en ROJO', () => {
  const p = paso('Cerrar el aviso si producción vuelve a estar al día (SCRUM-1605)');
  const si = /\n\s+if: (.+)\n/.exec(p)[1];
  assert.match(si, /!inputs\.simulacro/);
  assert.match(si, /steps\.vigia\.outputs\.salida == '0'/);
  assert.match(p, /node scripts\/vigia-despliegue-aviso\.mjs cerrar/);
  assert.match(p, /gh issue close "\$NUMERO"/);
  assert.match(p, /--jq '\.state'/, 'comprueba en GitHub que quedó cerrado');
  // Las tres salidas de «no pude» (API muda, decisión ciega, no consta cerrado) terminan en exit 1.
  assert.equal((p.match(/::error::/g) || []).length, 3);
  assert.equal((p.match(/\n\s+exit 1\n/g) || []).length, 3);
  // Después del vigía (lee su salida).
  assert.ok(YAML.indexOf(p) > YAML.indexOf('- name: ¿Está producción corriendo lo que hay en main?'));
});

test('🔴 ④ una sola marca: la del paso de aviso, la del de cierre y la que lee el latido son la MISMA', () => {
  const marcaDe = (nombre) => /MARCA: "(.+)"/.exec(paso(nombre))[1];
  assert.equal(marcaDe('Avisar de verdad si el vigía cantó (Issue de GitHub)'), MARCA_DE_CONGELADA);
  assert.equal(marcaDe('Cerrar el aviso si producción vuelve a estar al día (SCRUM-1605)'), MARCA_DE_CONGELADA);
});
