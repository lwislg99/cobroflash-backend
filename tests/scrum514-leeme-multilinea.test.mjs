// tests/scrum514-leeme-multilinea.test.mjs — SCRUM-514 · el LÉEME del ZIP conserva sus saltos.
//
// 🔴 UN TEXTO APROBADO QUE SE ENTREGA DE OTRA FORMA QUE LA APROBADA NO ES EL TEXTO APROBADO.
//
// El LÉEME es el único de los 81 textos que es multilínea DE VERDAD: 15 líneas, cuatro en blanco y
// un subrayado de «=». Y su forma es la mitad de su sentido — sin los saltos, el título se pega al
// primer párrafo y el subrayado queda en medio de una frase.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTE GUARD NO MIRA EL FUENTE, Y ES TODO EL PUNTO
//
// El precedente del 13-ago: un aviso que se pintaba con `appendChild` y lo borraba cuatro líneas
// después un `innerHTML`. El test estaba VERDE porque el texto **sí estaba en el .js**. Verificar
// que el fichero cambió no basta: hay que verificar que el RESULTADO cambió.
//
// Aquí el «resultado» no es un nodo del DOM: es el CONTENIDO DEL FICHERO que entra en el ZIP. Así
// que se comprueba lo que se le pasa a `archive.append(...)`, que es el byte a byte que el
// profesional abre. Un `.join(' ')` de más aplanaría el texto sin que nadie lo notara hasta abrirlo.
//
// ⚠️ Y por eso NO lleva `white-space: pre-line`: eso es CSS y esto es un `.txt`. Ponérselo sería
// proteger con la herramienta de otro sitio — y dejaría creer que está cubierto.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { LEEME } = await import('../dist/modules/exports/domain/portabilidadCompleta.js');
const RUTAS = fs.readFileSync(
  path.join(RAIZ, 'src/modules/exports/app/routes/exports.routes.ts'), 'utf8');

test('SCRUM-514 · SUELO: el LÉEME se carga y tiene contenido', () => {
  assert.equal(typeof LEEME, 'string', '🔴 CIEGO: `LEEME` no se exporta como cadena.');
  assert.ok(LEEME.length > 200, `🔴 CIEGO: el LÉEME mide ${LEEME.length} caracteres. Si se ha vaciado, ` +
    'todo lo de abajo pasaría sobre una cadena corta sin comprobar nada.');
});

test('SCRUM-514 · 🔴 EL QUE DECIDE: el LÉEME conserva sus saltos de línea', () => {
  const lineas = LEEME.split('\n');
  assert.ok(lineas.length >= 14,
    `🔴 EL LÉEME SE HA APLANADO: ${lineas.length} línea(s) donde tiene que haber 15.\n\n` +
    '  Un `.join(" ")` en vez de `.join("\n")`, o un texto reescrito de corrido, deja el ZIP con\n' +
    '  el título pegado al primer párrafo y el subrayado «=====» en medio de una frase. El fichero\n' +
    '  habría cambiado y el texto seguiría estando: por eso esto NO se comprueba sobre el fuente.');
  assert.ok(LEEME.includes('\n\n'),
    '🔴 el LÉEME ha perdido sus LÍNEAS EN BLANCO: sus cuatro párrafos se leen como uno solo.');
  assert.equal(lineas[0], 'Tus datos de YaQu', '🔴 la primera línea ya no es el título aprobado.');
  assert.ok(/^=+$/.test(lineas[1]),
    `🔴 la segunda línea tiene que ser el subrayado del título y es «${lineas[1]}».`);
});

test('SCRUM-514 · el texto es el APROBADO, y no promete lo que no hay', () => {
  for (const frase of [
    'Este ZIP contiene una copia de tus datos en YaQu',
    'Lo has descargado tú desde tu panel, y nadie más lo recibe.',
    'yaqu.app/privacidad',
  ]) {
    assert.ok(LEEME.includes(frase), `🔴 falta del LÉEME aprobado: «${frase}»`);
  }
  assert.ok(!LEEME.includes('[PENDIENTE'), '🔴 ha vuelto el marcador al LÉEME.');

  // 🔴 DOS DECISIONES DEL FUNDADOR, y las dos son comprobables:
  //  ① NO copia el aviso del art. 15 — apunta a la política. Duplicarlo crearía DOS FUENTES del
  //    mismo hecho legal, y el día que una cambie la otra miente.
  //  ② NO enumera los CSV. Una lista a mano es la siguiente que se queda vieja.
  for (const duplicado of ['finalidad', 'destinatarios', 'plazo de conservación']) {
    assert.ok(!LEEME.toLowerCase().includes(duplicado),
      `🔴 el LÉEME ha empezado a copiar el aviso del art. 15 («${duplicado}»). Eso es una SEGUNDA ` +
      'fuente del mismo hecho legal: apunta a la política de privacidad, no la repitas.');
  }
  assert.ok(!/\.csv/i.test(LEEME),
    '🔴 el LÉEME enumera ficheros CSV a mano. Si hace falta una lista, se DERIVA de lo que el ZIP ' +
    'mete de verdad — una escrita a mano es la siguiente que se queda vieja.');
});

test('SCRUM-514 · 🔴 y es EL LÉEME lo que entra en el ZIP, no otra cosa', () => {
  // Sin esto, el texto podría ser perfecto y el ZIP llevar dentro cualquier otra cadena.
  assert.match(RUTAS, /archive\.append\(LEEME, \{ name: 'LEEME\.txt' \}\)/,
    '🔴 el ZIP ya no mete `LEEME` como `LEEME.txt`. El texto puede estar impecable y no llegar: es ' +
    'exactamente el defecto del 13-ago, donde lo pintado se sobrescribía cuatro líneas después.');
});
