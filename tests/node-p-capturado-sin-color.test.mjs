// Toda captura de `node -p` en un workflow va envuelta en `String(…)`.
//
// `node -p` imprime el resultado con `util.inspect`, y `util.inspect` COLOREA números, booleanos y
// `undefined` cuando el entorno trae FORCE_COLOR — aunque la salida vaya a una tubería. Una
// captura `VAR="$(node -p …)"` recibe entonces `\x1b[33mtrue\x1b[39m`, que no es igual a "true".
//
// Medido el 18-sep-2026 (Node del equipo, FORCE_COLOR=1): número → 11 bytes con 2 ESC en vez de
// 1; booleano → 14 bytes en vez de 4; `String(…)` → sin ESC en los dos. El caso que lo hizo
// urgente es `vigia-atascados.yml`: con el booleano coloreado, `[ "$EMPEORA" = "true" ]` fallaba y
// el vigía escribía «SIN CAMBIOS A PEOR» SIN AVISAR a nadie. Hoy Actions no trae FORCE_COLOR, así
// que no rompe; el día que lo traiga, rompe callado. De ahí la regla y este guard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '..');
const WORKFLOWS = path.join(RAIZ, '.github', 'workflows');

// Una captura es un `node -p|-pe|--print` DENTRO de `$(…)`. Lo que se imprime al log sin capturar
// no entra: nadie lo compara.
const CAPTURA = /\$\([^)]*?\bnode\s+(?:-pe|-p|--print)\s+(['"])/;

/** Devuelve [{fichero, linea, expr}] de cada captura de `node -p` en el texto. */
export function capturasDeNodeP(texto, fichero = '(texto)') {
  const halladas = [];
  texto.split(/\r?\n/).forEach((l, i) => {
    const m = CAPTURA.exec(l);
    if (!m) return;
    const comilla = m[1];
    const desde = m.index + m[0].length;
    const hasta = l.indexOf(comilla, desde);
    const expr = hasta === -1 ? l.slice(desde) : l.slice(desde, hasta);
    halladas.push({ fichero, linea: i + 1, expr });
  });
  return halladas;
}

const envuelta = (expr) => /^\s*(?:try\s*\{\s*)?String\(/.test(expr);

function censo() {
  return fs.readdirSync(WORKFLOWS)
    .filter((f) => /\.ya?ml$/.test(f))
    .flatMap((f) => capturasDeNodeP(fs.readFileSync(path.join(WORKFLOWS, f), 'utf8'), f));
}

test('node -p capturado: toda captura en un workflow va envuelta en String(…)', () => {
  const todas = censo();
  // POBLACIÓN: hoy son 7 (3 en vigia-atascados, 4 en conflicto-de-registro). Un censo que no
  // encuentra ninguna no ha mirado — no es un verde.
  assert.ok(todas.length >= 7, `el censo solo encontró ${todas.length} capturas: el detector no ve lo que debería`);
  const sueltas = todas.filter((c) => !envuelta(c.expr));
  assert.deepEqual(
    sueltas.map((c) => `${c.fichero}:${c.linea}  ${c.expr}`),
    [],
    'captura de `node -p` sin String(…): con FORCE_COLOR saldrá con códigos de color',
  );
});

test('node -p capturado: CONTROL — el detector marca una captura sin envolver', () => {
  const inyectado = [
    '          EMPEORA="$(node -p "require(\'./veredicto.json\').empeora")"',
    '          N="$(X="$Y" node -pe "Math.round(1.4)")"',
    '          C="$(printf \'%s\' "$V" | node -pe \'JSON.parse(require("fs").readFileSync(0,"utf8")).causa\')"',
    '          node -p "\'solo al log \'+1"',
  ].join('\n');
  const c = capturasDeNodeP(inyectado);
  assert.equal(c.length, 3, 'las tres capturas se ven; la línea que solo imprime al log no cuenta');
  assert.equal(c.filter((x) => !envuelta(x.expr)).length, 3, 'las tres sin envolver se marcan');
  assert.ok(envuelta('String(require(\'./x.json\').n)'));
  assert.ok(envuelta('try { String(JSON.parse(s).accion) } catch { "" }'));
});

test('node -p capturado: el riesgo es REAL en este Node, y String(…) lo quita', () => {
  const env = { ...process.env, FORCE_COLOR: '1' };
  delete env.NODE_TEST_CONTEXT; // heredada, cambia la salida del hijo
  delete env.NO_COLOR;
  const correr = (expr) => {
    const r = spawnSync(process.execPath, ['-p', expr], { env, encoding: 'utf8' });
    assert.equal(r.status, 0, `node -p ${expr} falló: ${r.stderr}`);
    return r.stdout.trim();
  };
  // Control positivo: sin String(), con color, SÍ sale el escape. Si un día Node deja de
  // colorear, este aserto cae y avisa de que la regla ya no protege de nada que exista.
  assert.ok(correr('7').includes('\x1b['), 'número sin String() con FORCE_COLOR: se esperaba color');
  assert.ok(correr('true').includes('\x1b['), 'booleano sin String() con FORCE_COLOR: se esperaba color');
  assert.equal(correr('String(7)'), '7');
  assert.equal(correr('String(true)'), 'true');
});
