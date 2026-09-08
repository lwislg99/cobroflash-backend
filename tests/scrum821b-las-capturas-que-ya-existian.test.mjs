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
// La lista VIEJA no se escribe a mano: se LEE de `origin/main`, que es donde vive. Copiarla aquí
// sería fijar mi transcripción, no el hecho.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { vistasDelBarrido } from '../scripts/_vistas-del-barrido.mjs';
// 🔴 SCRUM-723 · CONTRA EL PUNTO DE PARTIDA DE LA RAMA, NUNCA CONTRA `origin/main`.
//
// La primera versión de este fichero leía `origin/main:…`, y el guard de SCRUM-723 la tumbó con
// razón: `origin/main` SE MUEVE. Comparar contra la punta hace que un guard acuse a una rama
// limpia el día que otro PR toque su fichero — le pasó a SCRUM-605 el 4-sep-2026. El punto de
// partida es un COMMIT, y no se mueve. El motor se importa; no se escribe un segundo `merge-base`.
import { baseDeLaRama, contenidoEnLaBase } from './_base-de-la-rama.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVIDENCIAS = path.join(RAIZ, 'docs', 'evidencias', 'demo-final');

/** El `slug` de una captura: el nombre sin su prefijo de orden. `06-customers` → `customers`. */
const slug = (nombre) => String(nombre).replace(/^\d+-/, '');

/**
 * La lista de vistas que el barrido fotografiaba ANTES del arreglo, leída del PUNTO DE PARTIDA.
 *
 * 🔴 SE LEE, NO SE COPIA. Una transcripción aquí fijaría lo que yo escribí, no lo que había — y
 * quien la mirara no sabría si el test compara contra el pasado o contra mi memoria. Si no se
 * puede resolver la base, esto se declara CIEGO en vez de comparar contra una lista vacía.
 */
function listaVieja() {
  const { contenido, base } = contenidoEnLaBase(RAIZ, 'scripts/capture-demo.mjs');
  if (!base) return { ok: false, porque: 'no se pudo resolver el punto de partida de la rama' };
  if (contenido == null) return { ok: false, porque: `\`capture-demo.mjs\` no existe en ${base.ref}` };
  const i = contenido.indexOf('const AUTH_VIEWS = [');
  if (i < 0) return { ok: false, porque: `no encuentro \`AUTH_VIEWS\` en la versión de ${base.ref}` };
  const bloque = contenido.slice(i, contenido.indexOf('];', i));
  const pares = [...bloque.matchAll(/\['([^']+)',\s*'([^']+)'\]/g)]
    .map((m) => ({ nombre: m[1], url: m[2] }));
  return { ok: true, pares, base };
}

/** Los BYTES de un fichero en el punto de partida. `utf8` no vale: aquí se comparan PNG. */
function bytesEnLaBase(ruta) {
  const base = baseDeLaRama(RAIZ);
  if (!base) return null;
  try {
    return execFileSync('git', ['show', `${base.sha}:${ruta}`],
      { cwd: RAIZ, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null; // no estaba en la base: la crea esta rama, y no hay contra qué comparar
  }
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
    const enLaBase = bytesEnLaBase(rel);
    if (!enLaBase) continue; // no estaba en la base: no hay contra qué comparar
    comparadas += 1;
    const antes = createHash('sha256').update(enLaBase).digest('hex');
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
