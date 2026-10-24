// tests/scrum1550b-sonda-por-texto.test.mjs — SCRUM-1550b
//
// Sin gate: ni BD, ni red. Ejecuta la función pura de la sonda y el propio instrumento sobre HEAD, con
// una lista de sondas VACÍA en el temporal del sistema (solo corren sus controles).
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL AUTO-DESCARTE DE LA SONDA MIRA EL TEXTO DE LA LÍNEA, NO LA RUTA DEL FICHERO
//
// `docs/master/evidencias/SCRUM-1550/contenido.mjs` descartaba toda línea de `git grep` que nombrara
// SCRUM-<n>, y la línea lleva delante la RUTA. Así, el DDL de `docs/sql/scrum-1310c-claves-ajenas-ddl.sql`
// no podía contar nunca para 1310: la sonda de `sondas.json` decía «SIGUE SIN HACER · 0» con el DDL
// dentro (SCRUM-1310 c.20822).
//
// Lo que este fichero fija:
//   ① `lineaCuenta`: cuenta una línea limpia en un fichero cuya ruta nombra el ticket; descarta la que
//      NOMBRA el ticket en su texto y las del registro y las evidencias del propio ticket;
//   ② el instrumento entero: su control RUTA sembrada (9997) da exactamente 1 y sale 0;
//   ③ la semilla dice lo que el control necesita: dos líneas con la semilla, una que nombra el ticket.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { lineaCuenta, partirLinea, SEMILLA_RUTA, FICHERO_RUTA } from '../docs/master/evidencias/SCRUM-1550/contenido.mjs';
import { reMencion } from '../scripts/abierto-con-trabajo-en-main.mjs';

// Vistas en ROJO a mano el 24-oct (registro, tramo 1550b): cada una tumba lo que dice `cae`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'docs/master/evidencias/SCRUM-1550/contenido.mjs', de: '  if (reMencion(n).test(texto)) return false;', a: '  if (reMencion(n).test(ruta + texto)) return false;',
    cae: '① cuenta la línea limpia aunque su RUTA nombre el ticket' },
  { fichero: 'docs/master/evidencias/SCRUM-1550/contenido.mjs', de: '  if (reMencion(n).test(texto)) return false;', a: '',
    cae: '① descarta la línea que solo NOMBRA el ticket' },
  { fichero: 'docs/master/evidencias/SCRUM-1550/semilla-ruta-SCRUM-9997.txt', de: 'SCRUM-9997 semilla-del-control-de-ruta-scrum1550b', a: 'semilla-del-control-de-ruta-scrum1550b',
    cae: '② el instrumento: control RUTA sembrada' },
];

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SONDA = path.join(RAIZ, 'docs/master/evidencias/SCRUM-1550/contenido.mjs');
// Los datos son FABRICADOS, con un ticket inventado (9996) y rutas que no existen; van ya partidos en
// `{ ruta, texto }`, sin número de línea, porque «ruta:nº» es la forma de un anclaje por posición (scrum710b).
const DDL = 'ALTER TABLE "public"."t" ADD CONSTRAINT "t_x_fkey" FOREIGN KEY ("x")';
const cuenta = (ruta, texto) => lineaCuenta({ ruta, texto }, 9996);

test('① parte la línea de git grep en ruta y texto, y el texto puede llevar dos puntos', () => {
  assert.deepEqual(partirLinea(`docs/sql/scrum-9996c-inventado.sql:46:-- a: ${DDL}`), { ruta: 'docs/sql/scrum-9996c-inventado.sql', texto: `-- a: ${DDL}` });
  assert.equal(partirLinea('sin formato de git grep'), null);
  assert.equal(lineaCuenta(partirLinea('sin formato de git grep'), 9996), false);
});

test('① cuenta la línea limpia aunque su RUTA nombre el ticket (la forma del caso de 1310c)', () => {
  assert.equal(cuenta('docs/sql/scrum-9996c-inventado.sql', DDL), true);
  assert.equal(cuenta('tests/scrum9996b-inventado.test.mjs', DDL), true);
  // la frontera del número: las evidencias de OTRO ticket que empieza igual no son las suyas
  assert.equal(cuenta('docs/master/evidencias/SCRUM-99960/inventado.txt', DDL), true);
});

test('① descarta la línea que solo NOMBRA el ticket, y la de su registro o sus evidencias', () => {
  assert.equal(cuenta('docs/sql/inventado.sql', `-- pendiente de SCRUM-9996: ${DDL}`), false);
  assert.equal(cuenta('docs/sql/inventado.sql', 'ver scrum-9996 c.1'), false);
  assert.equal(cuenta('docs/master/SCRUM-9996.md', DDL), false);
  assert.equal(cuenta('docs/master/evidencias/SCRUM-9996/inventado.txt', DDL), false);
  assert.equal(cuenta('docs/master/evidencias/SCRUM-9996b/inventado.txt', DDL), false);
});

test('② el instrumento: control RUTA sembrada SCRUM-9997 → 1 de 1, y sale 0', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1550b-'));
  try {
    const vacio = path.join(dir, 'sondas.json');
    fs.writeFileSync(vacio, JSON.stringify({ tickets: [] }));
    let codigo = 0; let out = '';
    try { out = execFileSync(process.execPath, [SONDA, '--sondas', vacio, '--ref', 'HEAD'], { cwd: RAIZ, encoding: 'utf8', timeout: 120000 }); }
    catch (e) { codigo = e.status; out = String(e.stdout || ''); }
    assert.match(out, /^población: 0 ticket\(s\)/m, `el instrumento no llegó a la tabla:\n${out}`);
    assert.match(out, /control RUTA sembrada SCRUM-9997 → 1 de 1 ✅/, out);
    assert.equal(codigo, 0, out);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('③ la semilla: su ruta nombra el ticket, y de sus dos líneas con la semilla solo una lo nombra', () => {
  assert.equal(reMencion(9997).test(FICHERO_RUTA), true, 'la ruta tiene que nombrar SCRUM-9997');
  const lineas = fs.readFileSync(path.join(RAIZ, 'docs/master/evidencias/SCRUM-1550', FICHERO_RUTA), 'utf8').split(/\r?\n/).filter((l) => l.includes(SEMILLA_RUTA));
  assert.equal(lineas.length, 2, lineas.join('\n'));
  assert.equal(lineas.filter((l) => reMencion(9997).test(l)).length, 1, lineas.join('\n'));
});
