// tests/scrum821b-las-capturas-que-ya-existian.test.mjs — SCRUM-821 (el ✅ POSITIVO que faltaba)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LAS QUE YA SE FOTOGRAFIABAN TIENEN QUE SALIR IGUAL — comparadas por HASH DE IMAGEN.
//
// El ticket pedía dos cosas y la rama de SCRUM-821 trae una: derivar `AUTH_VIEWS` y comparar las
// dos poblaciones por CONJUNTOS. Falta la otra mitad, que es la que protege lo que YA funcionaba:
//
//   > «las 11 que ya se fotografiaban salen IGUAL, comparadas por hash»  ← hash de IMAGEN
//
// Sin esto, el arreglo podría añadir las seis que faltaban Y romper en silencio alguna de las que
// ya salían — que es la forma más cara de «arreglar»: se gana cobertura y se pierde verdad.
//
// ── ⚠️ QUÉ SE PUEDE COMPROBAR AQUÍ, Y QUÉ NO ────────────────────────────────────────────────
//
// `capture-demo.mjs` necesita **navegador y `https://yaqu.app`**. Esta tanda no arranca navegador
// y no toca producción, así que **no re-fotografía**. Lo que sí se puede afirmar sin nada de eso,
// y es lo que de verdad estaba en riesgo:
//
//   ① las capturas que YA existen en el repo **no las ha tocado este arreglo** — hash de imagen,
//      byte a byte, contra las que están commiteadas;
//   ② cada pantalla que la lista vieja fotografiaba **sigue fotografiándose, y es LA MISMA
//      pantalla**: misma URL y mismo `slug`. Si el arreglo hubiera reordenado o perdido una, aquí
//      cae nombrándola.
//
// 🔴 SCRUM-821c · LA LISTA VIEJA YA NO SE LEE DE GIT: está CONGELADA en `_foto-antes-de-821.mjs`.
// Leerla en ejecución medía EL CHECKOUT y no el código, y murió sola el día que 821 se mergeó.
// El motivo largo, con el rojo reproducido y las DOS mitades del espejo, está en esa foto.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { vistasDelBarrido } from '../scripts/_vistas-del-barrido.mjs';
// 🔴 SCRUM-723 · CONTRA EL PUNTO DE PARTIDA DE LA RAMA, NUNCA CONTRA `origin/main`.
//
// La primera versión de este fichero leía `origin/main:…`, y el guard de SCRUM-723 la tumbó con
// razón: `origin/main` SE MUEVE. Comparar contra la punta hace que un guard acuse a una rama
// limpia el día que otro PR toque su fichero — le pasó a SCRUM-605 el 4-sep-2026. El punto de
// partida es un COMMIT, y no se mueve. El motor se importa; no se escribe un segundo `merge-base`.
// SCRUM-821c: la foto CONGELADA sustituye a la lectura de git. Ver `_foto-antes-de-821.mjs`.
import { VISTAS_ANTES_DE_821, COMMIT_DE_LA_FOTO } from './_foto-antes-de-821.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVIDENCIAS = path.join(RAIZ, 'docs', 'evidencias', 'demo-final');

/** El `slug` de una captura: el nombre sin su prefijo de orden. `06-customers` → `customers`. */
const slug = (nombre) => String(nombre).replace(/^\d+-/, '');

/**
 * La lista de vistas que el barrido fotografiaba ANTES del arreglo.
 *
 * 🔴 SCRUM-821c · SE LEE DE UNA FOTO CONGELADA, NO DE GIT. La versión anterior la leía de
 * `capture-demo.mjs` en el punto de partida de la rama, buscando `const AUTH_VIEWS = [`. Ese
 * literal DEJÓ DE EXISTIR el día que SCRUM-821 se mergeó —su ticket era justamente que la lista
 * dejara de mantenerse a mano—, así que toda rama nacida después nace con un punto de partida
 * donde no está, y los tres casos salían CIEGOS con el job entero en rojo.
 *
 * El fondo no era el literal: era que el espejo se movía. Un test que lee git en ejecución mide
 * EL CHECKOUT —profundidad del clon, si la base ya se mergeó, qué runner—, y nada de eso es una
 * propiedad del producto. La foto está en `_foto-antes-de-821.mjs`, commiteada, con el commit del
 * que salió y el motivo de por qué no se «actualiza».
 *
 * ⚠️ El SUELO no se pierde: si la foto llegara vacía o descabalada, esto se declara CIEGO igual
 * que antes. Ceguera y verde siguen sin ser el mismo resultado.
 */
function listaVieja() {
  const pares = VISTAS_ANTES_DE_821.map((v) => ({ nombre: v.nombre, url: v.url }));
  if (!pares.length) return { ok: false, porque: 'la foto congelada de `_foto-antes-de-821.mjs` está VACÍA' };
  return { ok: true, pares, base: { ref: `la foto congelada (${COMMIT_DE_LA_FOTO.slice(0, 8)})` } };
}

/**
 * El `sha256` que tenía la captura ANTES de SCRUM-821, de la foto congelada.
 *
 * 🔴 ESTO TAMBIÉN ERA ESPEJO, y era el peor de los dos porque NO daba rojo. Antes se leía con
 * `git show <base>:<ruta>`, y una vez 821 mergeado el punto de partida YA CONTIENE las capturas
 * de hoy: se comparaba cada fichero contra sí mismo. Verde garantizado sobre nada.
 */
function shaEnLaFoto(nombre) {
  const v = VISTAS_ANTES_DE_821.find((x) => x.nombre === nombre);
  return v ? v.sha256 : null;
}

const sha = (f) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SUELO · sin esto, «las que ya existían salen igual» sería cierto sobre un conjunto vacío
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-821b · 🔴 SUELO: se leen las dos cosas que se comparan, o esto se declara CIEGO', () => {
  const vieja = listaVieja();
  assert.ok(vieja.ok, `🔴 CIEGO: no se pudo leer la lista vieja de \`origin/main\`: ${vieja.porque}`);
  assert.ok(vieja.pares.length >= 10,
    `🔴 CIEGO: la lista vieja da ${vieja.pares.length} vistas y tenía DOCE. Si el extractor se `
    + 'rompió, «todas siguen ahí» sería cierto sobre casi nada.');

  assert.ok(fs.existsSync(EVIDENCIAS),
    `🔴 CIEGO: no existe \`${path.relative(RAIZ, EVIDENCIAS)}\`. Sin capturas no hay hash que comparar.`);
  const pngs = fs.readdirSync(EVIDENCIAS).filter((f) => f.endsWith('.png'));
  assert.ok(pngs.length >= 12,
    `🔴 CIEGO: sólo ${pngs.length} capturas en el directorio de evidencias, y había 18.`);

  const barrido = vistasDelBarrido(RAIZ);
  assert.ok(barrido.length >= 17,
    `🔴 CIEGO: el barrido derivado da ${barrido.length} vistas y el menú tiene 17.`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① EL ARREGLO NO HA TOCADO LAS CAPTURAS QUE YA ESTABAN — hash de imagen, byte a byte
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-821b · ✅ las capturas que YA existían siguen byte a byte iguales (hash de imagen)', () => {
  // Se compara contra las que había en el PUNTO DE PARTIDA de la rama: si este arreglo hubiera
  // re-fotografiado, recortado o regenerado alguna, aquí saldría con su nombre y su hash.
  const vieja = listaVieja();
  assert.ok(vieja.ok, `🔴 CIEGO: ${vieja.porque}`);

  const distintas = [];
  let comparadas = 0;
  for (const v of vieja.pares) {
    const rel = `docs/evidencias/demo-final/${v.nombre}.png`;
    const abs = path.join(RAIZ, rel);
    if (!fs.existsSync(abs)) continue; // no todas las de la lista tienen captura commiteada
    const antes = shaEnLaFoto(v.nombre);
    if (!antes) continue; // no tenía captura congelada: no hay contra qué comparar
    comparadas += 1;
    const ahora = sha(abs);
    if (ahora !== antes) distintas.push(`${v.nombre}.png  ${antes.slice(0, 12)} → ${ahora.slice(0, 12)}`);
  }

  // 🔴 SUELO del propio caso: un cero de diferencias sobre CERO comparaciones no es un cero.
  assert.ok(comparadas >= 10,
    `🔴 CIEGO: sólo se han comparado ${comparadas} capturas. Sabemos que hay doce en la lista vieja `
    + 'y dieciocho en el directorio: un «ninguna cambió» sobre esto no significa nada.');

  assert.deepEqual(distintas, [],
    '🔴 EL ARREGLO HA CAMBIADO CAPTURAS QUE YA ESTABAN:\n    ' + distintas.join('\n    ')
    + '\n\n  Añadir las que faltaban no puede costar las que ya salían.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② CADA PANTALLA QUE YA SE FOTOGRAFIABA SIGUE FOTOGRAFIÁNDOSE, Y ES LA MISMA
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-821b · ✅ ninguna de las que ya salían se ha perdido, y apuntan a la MISMA pantalla', () => {
  // Lo que de verdad estaba en riesgo al cambiar una lista a mano por una derivada: que la
  // derivación añada seis y, de paso, se deje una de las doce por el camino.
  const vieja = listaVieja();
  assert.ok(vieja.ok, `🔴 CIEGO: ${vieja.porque}`);

  const porUrl = new Map(vistasDelBarrido(RAIZ).map((v) => [v.url, v.nombre]));
  const perdidas = [];
  const cambiadas = [];
  for (const v of vieja.pares) {
    const ahora = porUrl.get(v.url);
    if (!ahora) { perdidas.push(`${v.nombre}  (${v.url})`); continue; }
    // 🔴 SE COMPARA EL `slug`, NO EL NOMBRE ENTERO, y es una decisión medida: el prefijo numérico
    // es POSICIÓN dentro de la lista, y la lista creció de 12 a 20 — así que renumerar es la
    // consecuencia esperada de añadir ocho, no un defecto. Lo que NO puede cambiar es a qué
    // pantalla apunta cada captura, y eso es el `slug` + la URL.
    if (slug(ahora) !== slug(v.nombre)) cambiadas.push(`${v.url}: ${v.nombre} → ${ahora}`);
  }

  assert.deepEqual(perdidas, [],
    '🔴 EL ARREGLO HA PERDIDO PANTALLAS QUE YA SE FOTOGRAFIABAN:\n    ' + perdidas.join('\n    ')
    + '\n\n  La derivación tiene que ser un superconjunto de la lista vieja, nunca un cambio.');
  assert.deepEqual(cambiadas, [],
    '🔴 UNA CAPTURA APUNTA A OTRA PANTALLA:\n    ' + cambiadas.join('\n    '));
});
