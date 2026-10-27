// SCRUM-1152c · EL VERDE DE `guards:entrada` DICE DÓNDE ACABA.
//
// EL DEFECTO (17-oct-2026, medido por S3 y el orquestador): la lista `GUARDS` es CERRADA a propósito
// (SCRUM-976) y está bien. Lo que engañaba era su verde: «✓ 14 guards de entrada en verde… La entrada
// puede empujarse». Ese día seis PR de tres sesiones cayeron en el CI por guards de árbol entero que no
// están en la lista (SCRUM-1560). El verde no era falso: era más ANCHO que lo medido.
//
// Lo que se comprueba: el verde ya no promete el empuje, dice que NO garantiza el CI, y nombra la
// familia de fuera con la orden lista para pegar. Y que esa familia existe en el árbol y deja de
// nombrarse sola si algún día entra en la lista (como 1294 en #2538).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { soloCodigo } from './_solo-codigo.mjs';
import { GUARDS, FUERA_DE_LA_LISTA, cierreDelVerde, TECHO_MS } from '../scripts/guards-entrada.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('🔴 el verde ya NO dice «puede empujarse», y SÍ dice que no garantiza el CI', () => {
  const v = cierreDelVerde({ ejecutados: 160, ms: 12_300 });
  assert.doesNotMatch(v, /puede empujarse/i, v);
  assert.match(v, /NO dice que el CI pase/, v);
  assert.match(v, new RegExp(`pasan los ${GUARDS.length} de ESTA lista, y sólo eso`), v);
});

test('la primera línea conserva la forma que lee scrum976 (`✓ N guards de entrada en verde (M tests`)', () => {
  const [primera] = cierreDelVerde({ ejecutados: 160, ms: 12_300 }).split('\n');
  assert.match(primera, new RegExp(`^✓ ${GUARDS.length} guards de entrada en verde \\(160 tests, 12\\.3 s de ${TECHO_MS / 1000}\\)`));
});

test('🔴 nombra la familia de fuera con la orden lista para pegar', () => {
  const v = cierreDelVerde({ ejecutados: 160, ms: 12_300 });
  const otros = FUERA_DE_LA_LISTA.filter((f) => !GUARDS.some((g) => g.fichero === f));
  assert.ok(otros.length > 0, 'la familia de fuera está vacía: entonces este verde no tiene nada que nombrar');
  const orden = v.split('\n').find((l) => l.trim().startsWith('node --test '));
  assert.ok(orden, `no sale la orden:\n${v}`);
  assert.deepEqual(orden.trim().replace(/^node --test /, '').split(' '), otros);
});

test('✅ CONTROL: lo que ya está en la lista deja de nombrarse; con toda la familia dentro, no sale la orden', () => {
  const conUno = [...GUARDS, { fichero: FUERA_DE_LA_LISTA[0], porque: 'x' }];
  const v = cierreDelVerde({ guards: conUno, ejecutados: 160, ms: 1000 });
  assert.ok(!v.includes(FUERA_DE_LA_LISTA[0]), v);
  assert.ok(v.includes(FUERA_DE_LA_LISTA[1]), v);
  const conTodos = [...GUARDS, ...FUERA_DE_LA_LISTA.map((fichero) => ({ fichero, porque: 'x' }))];
  const w = cierreDelVerde({ guards: conTodos, ejecutados: 160, ms: 1000 });
  assert.doesNotMatch(w, /node --test/, w);
  // Y la promesa acotada sigue: el CI corre más que la lista, esté quien esté dentro.
  assert.match(w, /NO dice que el CI pase/, w);
});

test('🔴 cada fichero de la familia EXISTE: una orden con una ruta muerta se pega y falla', () => {
  for (const f of FUERA_DE_LA_LISTA) assert.ok(fs.existsSync(path.join(RAIZ, f)), `no existe ${f}`);
});

test('el comando de verdad pinta ESTE cierre en verde (en el código, sin comentarios)', () => {
  const codigo = soloCodigo(fs.readFileSync(path.join(RAIZ, 'scripts', 'guards-entrada.mjs'), 'utf8'), 'guards-entrada.mjs');
  assert.match(codigo, /console\.log\(`\\n\$\{cierreDelVerde\(\{ ejecutados, ms \}\)\}`\)/);
  assert.doesNotMatch(codigo, /puede empujarse/);
});
