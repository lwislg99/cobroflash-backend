// tests/scrum1179c-censo-clics-informativo.test.mjs — SCRUM-1179 (parte C, 2/7)
//
// `censo:clics-del-80` pulsa de verdad la fila de las cinco listas del panel. No corría en ningún
// sitio; desde aquí corre en cada PR, en el job INFORMATIVO de navegador, y no bloquea.
//
// Y fija lo que lo tenía CIEGO: «la fila no navega» y «la fila revienta al pulsarla» salían con el
// mismo «NO». Así estuvo pintando «Facturas: NO navega» mientras el clic lanzaba
// `ReferenceError: cb is not defined` (invoicesView.js, desde SCRUM-845) y en producción la fila de
// una factura no abría nada. Ahora lee los errores de la página antes y después de pulsar, y un
// error sale con su propia salida (1), distinta de «no supe medir» (2).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CI = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'ci.yml'), 'utf8');
const CENSO = 'scripts/censo-clics-del-80.mjs';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El censo pasa a poder tumbar el job sin que nadie lo haya decidido.
    fichero: '.github/workflows/ci.yml',
    de: "      - name: censo:clics-del-80 (informativo — NO bloquea)\n        if: always()\n        continue-on-error: true\n",
    a: "      - name: censo:clics-del-80 (informativo — NO bloquea)\n        if: always()\n",
    cae: 'SCRUM-1179-C · clics-del-80 corre en el job INFORMATIVO, siempre, y NO bloquea',
  },
  {
    // Vuelve la ceguera: un error al pulsar se leería como «NO navega».
    fichero: CENSO,
    de: '    if (despues.errores.length > antes.errores) {',
    a: '    if (false) {',
    cae: 'SCRUM-1179-C · clics-del-80 distingue «no navega» de «revienta al pulsar»',
  },
  {
    // El control se mira y se ignora: el censo mediría aunque no supiera ver el error.
    fichero: CENSO,
    de: '  if (!veQuieta || !veRota) {',
    a: '  if (false) {',
    cae: 'SCRUM-1179-C · clics-del-80 lleva su CONTROL: una fila quieta y una que revienta, antes de medir',
  },
];

/** El bloque de un job de `ci.yml`, de su clave a la siguiente clave de job. */
function job(nombre) {
  const lineas = CI.split('\n');
  const i = lineas.findIndex((l) => l === `  ${nombre}:`);
  if (i < 0) return null;
  let j = i + 1;
  while (j < lineas.length && !/^ {2}[a-z][\w-]*:\s*$/.test(lineas[j])) j++;
  return lineas.slice(i, j).join('\n');
}

/** El código sin comentarios de línea: el comentario que explica la regla no puede sostenerla. */
const sinComentarios = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

test('SCRUM-1179-C · clics-del-80 corre en el job INFORMATIVO, siempre, y NO bloquea', () => {
  const bloque = job('guards-visuales');
  assert.ok(bloque, 'no encuentro el job guards-visuales en ci.yml');
  const paso = bloque.split(/\n(?= {6}- )/).find((p) => /npm run -s censo:clics-del-80/.test(p));
  assert.ok(paso, 'el paso del censo no está en el job de guards de navegador');
  assert.match(paso, /\n {8}if: always\(\)/, 'tiene que correr también con los guards en rojo');
  assert.match(paso, /\n {8}continue-on-error: true/, 'NO bloquea');
  assert.match(paso, /GITHUB_STEP_SUMMARY/, 'la tabla se deja donde se lee');
  assert.match(paso, /NO SUPO MEDIR/, 'un censo ciego lo dice');
  assert.match(paso, /REVIENTA AL PULSARLA/, 'y un error al pulsar se dice aparte, no como «no supo medir»');
  assert.ok(!/name: build \+ tests/.test(bloque), 'el job obligatorio es otro');
});

test('SCRUM-1179-C · clics-del-80 distingue «no navega» de «revienta al pulsar»', () => {
  const c = sinComentarios(fs.readFileSync(path.join(RAIZ, CENSO), 'utf8'));
  assert.match(c, /errores: window\.__errores\.length,/, 'cuenta los errores ANTES de pulsar');
  assert.match(c, /errores: window\.__errores,/, 'y los lee DESPUÉS');
  assert.match(c, /if \(despues\.errores\.length > antes\.errores\) \{/, 'un error nuevo al pulsar no es «no navega»');
  assert.match(c, /window\.__errores\.slice\(\)/, 'una vista que ya falló al pintarse no se sondea');
  assert.match(c, /if \(rotos\.length\) process\.exit\(1\);/, 'y sale con 1, distinto del 2 de «no supe medir»');
});

test('SCRUM-1179-C · clics-del-80 lleva su CONTROL: una fila quieta y una que revienta, antes de medir', () => {
  // El comportamiento (que sin el detector el censo sale con 2 en vez de pintar «NO») se comprobó
  // corriéndolo en Edge con la mutación puesta; aquí, sin navegador, se fija que el control existe,
  // que usa la MISMA función que mide las listas, y que su fallo corta la medición con 2.
  const c = sinComentarios(fs.readFileSync(path.join(RAIZ, CENSO), 'utf8'));
  const i = c.indexOf('control-1179c');
  const bucle = c.indexOf('for (const l of LISTAS)');
  assert.ok(i > 0 && bucle > 0 && i < bucle, 'el control va ANTES de medir las listas');
  assert.match(c, /const quieta = await pulsarLaFila\(page, await page\.evaluate\(SONDA\)\);/);
  assert.match(c, /const rota = await pulsarLaFila\(page, await page\.evaluate\(SONDA\)\);/);
  assert.match(c, /const \{ navega, via, errorAlPulsar \} = await pulsarLaFila\(page, s\);/, 'las listas pasan por la misma función');
  const corte = c.slice(c.indexOf('if (!veQuieta || !veRota) {'));
  assert.ok(c.includes('if (!veQuieta || !veRota) {'), 'un control que falla corta la medición');
  assert.match(corte.slice(0, 400), /process\.exit\(2\);/, 'y sale con 2: no supo medir');
});
