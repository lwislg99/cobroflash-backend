// tests/scrum1399-el-anterior-de-una-anulacion.test.mjs — SCRUM-1399
//
// `scripts/sobre-soap-prueba-aeat.mjs` guarda en `tmp/ultimo-registro.json` el registro al que se
// encadena el sobre siguiente. Guardaba la serie y la fecha PROPIAS de la pasada para cualquier
// tipo. Una anulación no se identifica por una serie propia: se identifica por la factura que
// anula. Así que el sobre que seguía a una anulación nombraba como «registro anterior» una serie
// que no es de ningún registro. La huella sí era la buena: lo que fallaba era la identificación.
//
// Con ese guion se envía a mano la tanda de S1-D, que pide registros de alta, anulación y R1
// aceptados EN CADENA: los sobres posteriores a una anulación son justo los que salían mal.
//
// 🔴 EL SCRIPT SE EJECUTA EN UNA COPIA, NUNCA EN EL ÁRBOL — mismo motivo y misma forma que
// `tests/scrum1398-la-sonda-de-colision.test.mjs`: el script deriva su raíz de dónde está y
// escribe ahí el puntero de la cadena, que es el estado real de lo enviado a la AEAT. El arnés
// (`raizAislada`, `correr`) se repite aquí en vez de sacarlo a un ayudante porque sacarlo obliga
// a reescribir aquel test, que es de otro ticket; el caso ⑧ comprueba la separación.
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

// Lo que el script carga de `dist/`, leído de SU fuente.
const MODULOS_DE_DIST = [...fs.readFileSync(SCRIPT, 'utf8').matchAll(/path\.join\(raiz, '(dist\/[^']+\.js)'\)/g)]
  .map((m) => m[1]);

// El meta-guard de la casa ejecuta esto. Son las maneras de deshacer el arreglo sin que el guion
// deje de generar un sobre que valida: volver a guardar la serie o la fecha de la pasada, encadenar
// a otra huella, darle a la R1 la identidad de la factura que rectifica, y dejar pasar el puntero
// que escribió el guion viejo.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El puntero vuelve a guardar la serie de la pasada: el defecto del ticket, tal cual.
    fichero: 'scripts/sobre-soap-prueba-aeat.mjs',
    de: "? { serie: objetivo.numSerieFactura, fecha: objetivo.fechaExpedicion, identifica: 'factura-anulada' }",
    a: "? { serie: SERIE, fecha: objetivo.fechaExpedicion, identifica: 'factura-anulada' }",
    cae: '① tras una anulación, el sobre siguiente nombra como anterior la SERIE de la factura anulada',
  },
  {
    // La serie es la buena y la fecha es la de la pasada: media identidad sigue sin ser de nadie.
    fichero: 'scripts/sobre-soap-prueba-aeat.mjs',
    de: "? { serie: objetivo.numSerieFactura, fecha: objetivo.fechaExpedicion, identifica: 'factura-anulada' }",
    a: "? { serie: objetivo.numSerieFactura, fecha: FECHA, identifica: 'factura-anulada' }",
    cae: '② tras una anulación, el sobre siguiente nombra como anterior la FECHA de la factura anulada',
  },
  {
    // Se guarda la huella a la que se encadenó este registro en vez de la suya: la cadena salta uno.
    fichero: 'scripts/sobre-soap-prueba-aeat.mjs',
    de: 'fechaExpedicion: identidad.fecha, huella, tipo: TIPO,',
    a: 'fechaExpedicion: identidad.fecha, huella: prevHash, tipo: TIPO,',
    cae: '③ la huella del anterior sigue siendo la de la ANULACIÓN, no la del alta anulada',
  },
  {
    // El arreglo se pasa de largo y trata la R1 como una anulación.
    fichero: 'scripts/sobre-soap-prueba-aeat.mjs',
    de: "const identidad = TIPO === 'anulacion'",
    a: "const identidad = TIPO !== 'alta'",
    cae: '⑥ lo que NO cambia: tras un alta o una R1, el anterior es la serie propia de ese registro',
  },
  {
    // El puntero del guion viejo vuelve a valer.
    fichero: 'scripts/sobre-soap-prueba-aeat.mjs',
    de: "if (anterior && anterior.tipo === 'anulacion' && anterior.identifica !== 'factura-anulada') {",
    a: "if (false && anterior.tipo === 'anulacion' && anterior.identifica !== 'factura-anulada') {",
    cae: '⑦ un puntero de anulación escrito por el guion VIEJO no se usa: sale 1 y no escribe nada',
  },
];

// Un NIF con la forma de uno, que no es de nadie: aquí no se envía nada y la AEAT no lo ve.
const NIF = '00000000T';
const NOMBRE = 'Prueba De Laboratorio';

/**
 * Una raíz desechable con el script dentro y `dist/` alcanzable. Devuelve su ruta.
 *
 * `punteroPrevio`, si llega, se deja escrito como puntero de la cadena ANTES de la primera pasada.
 * Se escribe AQUÍ y no en el caso que lo pide para que se vea de dónde cuelga: del `temporal()`
 * de dos líneas más arriba. Escrito desde el caso, a través de una ruta que devuelve otra función,
 * el censo de SCRUM-824 no podía probar que no cayera en el árbol.
 */
function raizAislada(punteroPrevio = null) {
  const dir = temporal('scrum1399-anterior-');
  if (punteroPrevio !== null) {
    fs.mkdirSync(path.join(dir, 'tmp'));
    fs.writeFileSync(path.join(dir, 'tmp', 'ultimo-registro.json'), punteroPrevio);
  }
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.copyFileSync(SCRIPT, path.join(dir, 'scripts', path.basename(SCRIPT)));
  for (const rel of MODULOS_DE_DIST) {
    const pasarela = path.join(dir, rel);
    fs.mkdirSync(path.dirname(pasarela), { recursive: true });
    fs.writeFileSync(pasarela, `module.exports = require(${JSON.stringify(path.join(RAIZ, rel))});\n`);
  }
  return dir;
}

const rutaSobre = (dir) => path.join(dir, 'tmp', 'sobre-soap-prueba-aeat.xml');
const rutaPuntero = (dir) => path.join(dir, 'tmp', 'ultimo-registro.json');

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
  const sobre = fs.existsSync(rutaSobre(dir)) ? fs.readFileSync(rutaSobre(dir), 'utf8') : null;
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, sobre, ...partes(sobre) };
}

/**
 * Del sobre, lo que identifica al registro ANTERIOR (el bloque `RegistroAnterior`) y la huella
 * PROPIA del registro, que es la única `Huella` que queda fuera de ese bloque.
 */
function partes(sobre) {
  if (!sobre) return { anterior: null, huellaPropia: null };
  const bloque = sobre.match(/<sum1:RegistroAnterior>([\s\S]*?)<\/sum1:RegistroAnterior>/);
  const campo = (texto, n) => (texto.match(new RegExp(`<sum1:${n}>([^<]*)</sum1:${n}>`)) || [])[1] ?? null;
  const fuera = bloque ? sobre.replace(bloque[0], '') : sobre;
  return {
    anterior: bloque ? {
      serie: campo(bloque[1], 'NumSerieFactura'),
      fecha: campo(bloque[1], 'FechaExpedicionFactura'),
      huella: campo(bloque[1], 'Huella'),
    } : null,
    huellaPropia: campo(fuera, 'Huella'),
  };
}

/**
 * La secuencia del hallazgo: alta `A-0001` → anulación de `A-0001` → alta `A-0002`. A la
 * anulación se le fuerzan una serie y una fecha propias que NO son de ningún registro, para que
 * se vea cuál de las dos identidades viaja al sobre siguiente.
 */
function altaAnulacionAlta() {
  const dir = raizAislada();
  const alta = correr(dir, ['--serie-propia', 'A-0001', '--fecha-propia', '01-09-2026']);
  const anulacion = correr(dir, ['--tipo', 'anulacion', '--serie-propia', 'NO-ES-DE-NADIE', '--fecha-propia', '15-09-2026']);
  const tercero = correr(dir, ['--serie-propia', 'A-0002', '--fecha-propia', '02-09-2026']);
  assert.deepEqual([alta.status, anulacion.status, tercero.status], [0, 0, 0],
    alta.stderr + anulacion.stderr + tercero.stderr);
  // Que la anulación anuló lo que se cree: sin esto, lo de abajo compararía contra otra factura.
  assert.match(anulacion.sobre, /<sum1:NumSerieFacturaAnulada>A-0001</);
  assert.match(anulacion.sobre, /<sum1:FechaExpedicionFacturaAnulada>01-09-2026</);
  assert.ok(tercero.anterior, 'el tercer sobre no lleva RegistroAnterior: no hay nada que mirar');
  return { dir, alta, anulacion, tercero };
}

test('SCRUM-1399 · ⓪ la copia aislada tiene de dónde cargar: el script declara sus módulos de dist y existen', () => {
  console.log('  [SCRUM-1399] módulos de dist que carga el script: ' + MODULOS_DE_DIST.length);
  assert.ok(MODULOS_DE_DIST.length >= 3, 'no supe leer qué carga el script de dist/: la copia aislada saldría vacía');
  for (const rel of MODULOS_DE_DIST) {
    assert.ok(fs.existsSync(path.join(RAIZ, rel)), `falta ${rel}: ¿se ha compilado?`);
  }
});

test('SCRUM-1399 · ① tras una anulación, el sobre siguiente nombra como anterior la SERIE de la factura anulada', () => {
  const { tercero } = altaAnulacionAlta();
  assert.equal(tercero.anterior.serie, 'A-0001',
    `el registro anterior lleva la serie «${tercero.anterior.serie}», que no es la de la factura anulada`);
});

test('SCRUM-1399 · ② tras una anulación, el sobre siguiente nombra como anterior la FECHA de la factura anulada', () => {
  const { tercero } = altaAnulacionAlta();
  assert.equal(tercero.anterior.fecha, '01-09-2026',
    `el registro anterior lleva la fecha «${tercero.anterior.fecha}», que no es la de la factura anulada`);
});

test('SCRUM-1399 · ③ la huella del anterior sigue siendo la de la ANULACIÓN, no la del alta anulada', () => {
  // Lo que cambia es a QUIÉN se nombra, no a qué se encadena: el registro anterior del tercero es
  // la anulación, y su huella es la de la anulación aunque la serie y la fecha sean las del alta.
  const { alta, anulacion, tercero } = altaAnulacionAlta();
  assert.match(anulacion.huellaPropia ?? '', /^[0-9A-F]{64}$/i, 'no supe leer la huella de la anulación');
  assert.notEqual(anulacion.huellaPropia, alta.huellaPropia, 'la anulación y el alta tienen la misma huella: no distinguiría nada');
  assert.equal(tercero.anterior.huella, anulacion.huellaPropia);
});

test('SCRUM-1399 · ④ sin banderas, que es como se usa: el anterior es la factura anulada y no la serie que se generó la pasada', () => {
  const dir = raizAislada();
  const alta = correr(dir, []);
  const anulacion = correr(dir, ['--tipo', 'anulacion']);
  const tercero = correr(dir, []);
  assert.deepEqual([alta.status, anulacion.status, tercero.status], [0, 0, 0], anulacion.stderr + tercero.stderr);
  const serieDelAlta = (alta.sobre.match(/<sum1:NumSerieFactura>([^<]*)</) || [])[1];
  const fechaDelAlta = (alta.sobre.match(/<sum1:FechaExpedicionFactura>([^<]*)</) || [])[1];
  assert.match(serieDelAlta ?? '', /^PRUEBA-AEAT-\d{6}$/);
  assert.deepEqual([tercero.anterior.serie, tercero.anterior.fecha], [serieDelAlta, fechaDelAlta]);
});

test('SCRUM-1399 · ⑤ anulando una factura señalada con --serie y --fecha, el anterior es ESA y no la última alta', () => {
  const dir = raizAislada();
  const alta = correr(dir, ['--serie-propia', 'A-0001', '--fecha-propia', '01-09-2026']);
  const anulacion = correr(dir, ['--tipo', 'anulacion', '--serie', 'OBJETIVO-0007', '--fecha', '20-08-2026']);
  const tercero = correr(dir, ['--serie-propia', 'A-0002', '--fecha-propia', '02-09-2026']);
  assert.deepEqual([alta.status, anulacion.status, tercero.status], [0, 0, 0], anulacion.stderr + tercero.stderr);
  assert.deepEqual([tercero.anterior.serie, tercero.anterior.fecha], ['OBJETIVO-0007', '20-08-2026']);
});

test('SCRUM-1399 · ⑥ lo que NO cambia: tras un alta o una R1, el anterior es la serie propia de ese registro', () => {
  // Una R1 es un alta con otro tipo de factura y SÍ tiene serie propia. Si el arreglo le diera
  // también la identidad de la factura sobre la que opera, el defecto cambiaría de sitio.
  const dir = raizAislada();
  const alta = correr(dir, ['--serie-propia', 'A-0001', '--fecha-propia', '01-09-2026']);
  const r1 = correr(dir, ['--tipo', 'r1', '--serie-propia', 'R-0001', '--fecha-propia', '03-09-2026']);
  const tercero = correr(dir, ['--serie-propia', 'A-0002', '--fecha-propia', '04-09-2026']);
  assert.deepEqual([alta.status, r1.status, tercero.status], [0, 0, 0], r1.stderr + tercero.stderr);
  assert.match(r1.sobre, /<sum1:TipoFactura>R1</);
  assert.deepEqual([r1.anterior.serie, r1.anterior.fecha, r1.anterior.huella], ['A-0001', '01-09-2026', alta.huellaPropia]);
  assert.deepEqual([tercero.anterior.serie, tercero.anterior.fecha, tercero.anterior.huella], ['R-0001', '03-09-2026', r1.huellaPropia]);
});

test('SCRUM-1399 · ⑦ un puntero de anulación escrito por el guion VIEJO no se usa: sale 1 y no escribe nada', () => {
  // El guion viejo dejaba en el puntero, tras una anulación, la serie de la pasada. Ese fichero
  // sobrevive al arreglo (vive fuera de git), y encadenarse a él repetiría el defecto entero.
  const viejo = JSON.stringify({
    idEmisorFactura: NIF, numSerieFactura: 'PRUEBA-AEAT-123456', fechaExpedicion: '15-09-2026',
    huella: 'A'.repeat(64), tipo: 'anulacion',
  }, null, 2);
  const dir = raizAislada(viejo);
  const r = correr(dir, ['--serie-propia', 'A-0002', '--fecha-propia', '02-09-2026']);
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stderr, /SCRUM-1399/);
  assert.match(r.stderr, /PRUEBA-AEAT-123456/);
  assert.equal(fs.readFileSync(rutaPuntero(dir), 'utf8'), viejo, 'el puntero cambió: la cadena avanzó desde un anterior que no vale');
  assert.deepEqual(fs.readdirSync(path.join(dir, 'tmp')), ['ultimo-registro.json'],
    'se escribió algo más que el puntero que ya estaba: un sobre encadenado a un anterior que no vale');
});

test('SCRUM-1399 · ⑧ la separación funciona: el script escribió en su copia y el tmp/ del árbol no se ha movido', () => {
  const real = path.join(RAIZ, 'tmp');
  const foto = () => (fs.existsSync(real)
    ? fs.readdirSync(real).sort().map((f) => {
      const s = fs.statSync(path.join(real, f));
      return `${f}|${s.size}|${s.mtimeMs}`;
    }).join('\n')
    : null);
  const antes = foto();
  const { dir } = altaAnulacionAlta();
  assert.ok(fs.existsSync(rutaPuntero(dir)), 'la copia no tiene puntero: el script no escribió donde se esperaba');
  assert.equal(foto(), antes, 'el tmp/ REAL del árbol cambió: el test ha generado sobres en sitio');
});
