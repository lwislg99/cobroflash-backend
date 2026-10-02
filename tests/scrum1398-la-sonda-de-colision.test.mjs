// tests/scrum1398-la-sonda-de-colision.test.mjs — SCRUM-1398
//
// La sonda de colisión de `scripts/sobre-soap-prueba-aeat.mjs` (`--serie-propia` y
// `--fecha-propia`) hizo una medición contra la AEAT el 28-sep-2026 y estuvo cuatro días fuera
// del repositorio, sin comitear, en un árbol compartido. Este fichero sujeta lo que esa
// herramienta tiene que seguir haciendo para que la medición se pueda repetir.
//
// 🔴 EL SCRIPT SE EJECUTA EN UNA COPIA, NUNCA EN EL ÁRBOL. Deriva su raíz de DÓNDE ESTÁ y
// escribe en `<raíz>/tmp/` el puntero de la cadena (`ultimo-registro.json`). Ese puntero no
// está en git y es el estado real de lo enviado a la AEAT: un test que generase un sobre en
// sitio lo ADELANTARÍA a un registro que la AEAT no ha visto nunca. Por eso cada caso copia
// el script a un temporal y le pone delante tres pasarelas a `dist/`. El caso ⑤ comprueba que
// esa separación funciona, no la supone.
//
// ⛔ Sólo LEE y EJECUTA el script (regla 38). No toca `src/`, no envía nada, no usa la red.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { temporal } from './_temporal.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(RAIZ, 'scripts', 'sobre-soap-prueba-aeat.mjs');

// Lo que el script carga de `dist/`. Se lee de SU fuente, no se copia aquí a mano: si mañana
// carga un cuarto módulo, la copia aislada lo tiene sin que nadie se acuerde de este fichero.
const MODULOS_DE_DIST = [...fs.readFileSync(SCRIPT, 'utf8').matchAll(/path\.join\(raiz, '(dist\/[^']+\.js)'\)/g)]
  .map((m) => m[1]);

// El meta-guard de la casa ejecuta esto. Son los tres modos de estropear la sonda sin que deje
// de generar un sobre: que una bandera no fuerce nada, que las dos lecturas de «serie» se
// vuelvan a confundir, y que una fecha mal formada llegue a la AEAT.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // `--fecha-propia` deja de leerse: el sobre sale con la fecha de hoy y nadie lo nota.
    fichero: 'scripts/sobre-soap-prueba-aeat.mjs',
    de: "const FECHA_FORZADA = arg('fecha-propia');",
    a: "const FECHA_FORZADA = arg('fecha-propia-x');",
    cae: '① con las dos banderas, el sobre lleva ESA serie y ESA fecha, y lo avisa',
  },
  {
    // La bandera de la sonda vuelve a ser `--serie`, que ya significa «la factura que se anula».
    fichero: 'scripts/sobre-soap-prueba-aeat.mjs',
    de: "const SERIE_FORZADA = arg('serie-propia');",
    a: "const SERIE_FORZADA = arg('serie');",
    cae: '⑤ las banderas de la sonda NO son --serie ni --fecha',
  },
  {
    // La validación del formato deja de abortar.
    fichero: 'scripts/sobre-soap-prueba-aeat.mjs',
    de: 'if (FECHA_FORZADA && !/',
    a: 'if (false && !/',
    cae: '③ una --fecha-propia con otro formato FALLA CERRADO',
  },
];

// Un NIF con la forma de uno, que no es de nadie: aquí no se envía nada y la AEAT no lo ve.
const NIF = '00000000T';
const NOMBRE = 'Prueba De Laboratorio';

function fechaDeMadrid() {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const g = (k) => p.find((x) => x.type === k).value;
  return `${g('day')}-${g('month')}-${g('year')}`;
}

/** Una raíz desechable con el script dentro y `dist/` alcanzable. Devuelve su ruta. */
function raizAislada() {
  const dir = temporal('scrum1398-sonda-');
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.copyFileSync(SCRIPT, path.join(dir, 'scripts', path.basename(SCRIPT)));
  for (const rel of MODULOS_DE_DIST) {
    const pasarela = path.join(dir, rel);
    fs.mkdirSync(path.dirname(pasarela), { recursive: true });
    fs.writeFileSync(pasarela, `module.exports = require(${JSON.stringify(path.join(RAIZ, rel))});\n`);
  }
  return dir;
}

function correr(dir, extra) {
  // El entorno del hijo se construye a mano: con el del runner dentro, un hijo de `node --test`
  // no ejecuta lo que se le pide (SCRUM-1308), y el color del chat entra en su salida.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_OPTIONS;
  delete env.FORCE_COLOR;
  const r = spawnSync(process.execPath,
    [path.join(dir, 'scripts', path.basename(SCRIPT)), '--nif', NIF, '--nombre', NOMBRE, ...extra],
    { encoding: 'utf8', env });
  const xml = path.join(dir, 'tmp', 'sobre-soap-prueba-aeat.xml');
  const sobre = fs.existsSync(xml) ? fs.readFileSync(xml, 'utf8') : null;
  const campo = (n) => (sobre ? [...sobre.matchAll(new RegExp(`<sum1:${n}>([^<]*)</sum1:${n}>`, 'g'))].map((m) => m[1]) : []);
  return {
    status: r.status, stdout: r.stdout, stderr: r.stderr, sobre,
    series: campo('NumSerieFactura'), fechas: campo('FechaExpedicionFactura'), huellas: campo('Huella'),
    escribio: fs.existsSync(path.join(dir, 'tmp')) ? fs.readdirSync(path.join(dir, 'tmp')).sort() : [],
  };
}

test('SCRUM-1398 · ⓪ la copia aislada tiene de dónde cargar: el script declara sus módulos de dist y existen', () => {
  console.log('  [SCRUM-1398] módulos de dist que carga el script: ' + MODULOS_DE_DIST.length);
  assert.ok(MODULOS_DE_DIST.length >= 3, 'no supe leer qué carga el script de dist/: la copia aislada saldría vacía');
  for (const rel of MODULOS_DE_DIST) {
    assert.ok(fs.existsSync(path.join(RAIZ, rel)), `falta ${rel}: ¿se ha compilado?`);
  }
});

test('SCRUM-1398 · ① con las dos banderas, el sobre lleva ESA serie y ESA fecha, y lo avisa', () => {
  const r = correr(raizAislada(), ['--serie-propia', 'SONDA-0001', '--fecha-propia', '27-09-2026']);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.deepEqual(r.series, ['SONDA-0001']);
  assert.deepEqual(r.fechas, ['27-09-2026']);
  assert.match(r.stdout, /SONDA DE COLISIÓN: serie=SONDA-0001 fecha=27-09-2026/);
});

test('SCRUM-1398 · ② la medición del 28-sep se puede repetir: misma serie, dos fechas, dos registros distintos', () => {
  const dir = raizAislada();
  const a = correr(dir, ['--serie-propia', 'SONDA-0001', '--fecha-propia', '27-09-2026']);
  const b = correr(dir, ['--serie-propia', 'SONDA-0001', '--fecha-propia', '28-09-2026']);
  assert.deepEqual([a.status, b.status], [0, 0], a.stderr + b.stderr);
  assert.deepEqual([a.series[0], b.series[0]], ['SONDA-0001', 'SONDA-0001']);
  assert.deepEqual([a.fechas[0], b.fechas[0]], ['27-09-2026', '28-09-2026']);
  // El segundo se ENCADENA al primero (por eso `series` trae dos: el registro y su anterior).
  // Si saliera como «primer registro», la AEAT contestaría 2007 y la sonda no mediría la colisión.
  assert.match(b.sobre, /<sum1:RegistroAnterior>/);
  assert.equal(a.huellas.length, 1);
  assert.equal(b.huellas[0], a.huellas[0], 'el anterior del segundo no es el primero');
});

test('SCRUM-1398 · ③ una --fecha-propia con otro formato FALLA CERRADO: sale 1 y no escribe nada', () => {
  const r = correr(raizAislada(), ['--serie-propia', 'SONDA-0001', '--fecha-propia', '2026-09-27']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--fecha-propia debe ser dd-mm-aaaa/);
  assert.deepEqual(r.escribio, [], 'escribió algo antes de abortar: la cadena habría avanzado sin sobre');
});

test('SCRUM-1398 · ④ sin banderas hace lo de siempre: serie de prueba nueva, fecha de hoy y ningún aviso de sonda', () => {
  const antes = fechaDeMadrid();
  const r = correr(raizAislada(), []);
  const despues = fechaDeMadrid();
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.series[0], /^PRUEBA-AEAT-\d{6}$/);
  assert.ok([antes, despues].includes(r.fechas[0]), `fecha ${r.fechas[0]}, y hoy es ${antes}`);
  assert.doesNotMatch(r.stdout, /SONDA DE COLISIÓN/);
});

test('SCRUM-1398 · ⑤ las banderas de la sonda NO son --serie ni --fecha, que siguen señalando la factura que se anula', () => {
  // Primero un alta, como en el uso real: una anulación que fuese el PRIMER registro de la cadena
  // la aborta el propio script (su control `nifEnEmisor` busca `IDEmisorFactura`, y una anulación
  // sólo lo lleva dentro del registro anterior). Es de `main`, anterior a la sonda: ver el registro.
  const dir = raizAislada();
  const alta = correr(dir, []);
  const r = correr(dir, ['--tipo', 'anulacion', '--serie', 'OBJETIVO-0007', '--fecha', '01-09-2026']);
  assert.deepEqual([alta.status, r.status], [0, 0], r.stderr + r.stdout);
  assert.match(r.sobre, /<sum1:NumSerieFacturaAnulada>OBJETIVO-0007</);
  assert.match(r.sobre, /<sum1:FechaExpedicionFacturaAnulada>01-09-2026</);
  assert.doesNotMatch(r.stdout, /SONDA DE COLISIÓN/);
});

test('SCRUM-1398 · ⑥ la separación funciona: el script escribió en su copia y el tmp/ del árbol no se ha movido', () => {
  const real = path.join(RAIZ, 'tmp', 'ultimo-registro.json');
  const foto = () => (fs.existsSync(real) ? fs.readFileSync(real, 'utf8') : null);
  const antes = foto();
  const dir = raizAislada();
  const r = correr(dir, ['--serie-propia', 'SONDA-0001', '--fecha-propia', '27-09-2026']);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.deepEqual(r.escribio, ['sobre-soap-prueba-aeat.xml', 'ultima-alta.json', 'ultimo-registro.json']);
  assert.equal(JSON.parse(r.stdout.slice(r.stdout.indexOf('{'))).fichero, path.join(dir, 'tmp', 'sobre-soap-prueba-aeat.xml'));
  assert.equal(foto(), antes, 'el puntero REAL de la cadena cambió: el test ha generado un sobre en el árbol');
});
