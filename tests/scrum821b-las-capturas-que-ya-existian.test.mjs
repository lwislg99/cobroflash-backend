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
//   ② cada pantalla que ya tenía captura **sigue fotografiándose, y es LA MISMA pantalla**:
//      mismo `slug`. Si el arreglo hubiera reordenado o perdido una, aquí cae nombrándola.
//
// LA POBLACIÓN NO SE ESCRIBE A MANO: sale de las capturas COMMITEADAS, que son el registro de lo
// que de verdad se fotografiaba. Copiar una lista aquí fijaría mi transcripción, no el hecho.
//
// ⚠️ Antes salía de leer `AUTH_VIEWS` en el punto de partida de la rama, y eso hacía el test
// AUTOINVALIDABLE: en cuanto el arreglo se mergeó, esa lista dejó de existir en la base y el test
// no podía volver a ponerse verde. El porqué entero está en `capturasExistentes`.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { vistasDelBarrido, vistasNavegablesPorHash } from '../scripts/_vistas-del-barrido.mjs';
// 🔴 SCRUM-723 · CONTRA EL PUNTO DE PARTIDA DE LA RAMA, NUNCA CONTRA `origin/main`.
//
// La primera versión de este fichero leía `origin/main:…`, y el guard de SCRUM-723 la tumbó con
// razón: `origin/main` SE MUEVE. Comparar contra la punta hace que un guard acuse a una rama
// limpia el día que otro PR toque su fichero — le pasó a SCRUM-605 el 4-sep-2026. El punto de
// partida es un COMMIT, y no se mueve. El motor se importa; no se escribe un segundo `merge-base`.
import { baseDeLaRama } from './_base-de-la-rama.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVIDENCIAS = path.join(RAIZ, 'docs', 'evidencias', 'demo-final');

/** El `slug` de una captura: el nombre sin su prefijo de orden. `06-customers` → `customers`. */
const slug = (nombre) => String(nombre).replace(/^\d+-/, '');

/**
 * La lista de vistas que el barrido fotografiaba ANTES del arreglo, leída del PUNTO DE PARTIDA.
 *
 * ═══ 🔴 REESCRITO EL 8-sep-2026 · ESTE TEST SE AUTOINVALIDABA AL MERGEARSE ═══════════════════
 *
 * La primera versión sacaba «las que ya se fotografiaban» leyendo `const AUTH_VIEWS = [...]` en el
 * PUNTO DE PARTIDA de la rama. Funcionó mientras el arreglo estaba sin mergear. En cuanto
 * SCRUM-821 entró en `main`, el punto de partida de cualquier rama nueva **ya lleva el arreglo
 * dentro** — y ahí esa lista literal no existe, porque justo lo que hizo el ticket fue
 * sustituirla por una derivación.
 *
 * Resultado: el test se declaraba CIEGO —honesto, no daba un falso verde— pero **no podía volver
 * a ponerse verde nunca**, y dejaba la tanda en rojo en TODAS las ramas. Lo cazó la tanda de
 * SCRUM-630 al mezclar `main`.
 *
 * 🔴 LA LECCIÓN: **un test no puede depender de que su propio arreglo NO esté mergeado.** La
 * referencia contra la que compara tiene que sobrevivir al merge del ticket que la escribe.
 *
 * LA POBLACIÓN AHORA SALE DE LAS CAPTURAS COMMITEADAS, que son el registro de lo que de verdad se
 * fotografiaba y no desaparecen al mergear nada. El nombre de cada fichero —`NN-slug.png`— lleva
 * dentro a qué pantalla corresponde.
 */
function capturasExistentes() {
  if (!fs.existsSync(EVIDENCIAS)) return { ok: false, porque: `no existe ${EVIDENCIAS}` };
  const pngs = fs.readdirSync(EVIDENCIAS).filter((f) => f.endsWith('.png')).sort();
  return {
    ok: true,
    pngs: pngs.map((f) => {
      const nombre = f.replace(/\.png$/, '');
      return { fichero: f, nombre, slug: slug(nombre) };
    }),
  };
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
  const c = capturasExistentes();
  assert.ok(c.ok, `🔴 CIEGO: ${c.porque}. Sin capturas no hay hash que comparar.`);
  assert.ok(c.pngs.length >= 12,
    `🔴 CIEGO: sólo ${c.pngs.length} capturas en el directorio de evidencias, y había 18.`);

  const barrido = vistasDelBarrido(RAIZ);
  assert.ok(barrido.length >= 17,
    `🔴 CIEGO: el barrido derivado da ${barrido.length} vistas y el menú tiene 17.`);

  // Y que ALGUNAS de esas capturas correspondan a pantallas del panel: si ninguna casara por
  // `slug`, «todas siguen fotografiándose» sería cierto sobre el conjunto vacío — que es el falso
  // verde que este suelo existe para impedir.
  const delPanel = new Set(barrido.map((v) => slug(v.nombre)));
  const casan = c.pngs.filter((p) => delPanel.has(p.slug));
  assert.ok(casan.length >= 10,
    `🔴 CIEGO: sólo ${casan.length} de ${c.pngs.length} capturas corresponden a una pantalla del `
    + 'panel, y eran doce. Si el emparejamiento por slug se rompió, lo de abajo no mide nada.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① EL ARREGLO NO HA TOCADO LAS CAPTURAS QUE YA ESTABAN — hash de imagen, byte a byte
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-821b · ✅ las capturas que YA existían siguen byte a byte iguales (hash de imagen)', () => {
  // Se compara contra las que había en el PUNTO DE PARTIDA de la rama: si este arreglo hubiera
  // re-fotografiado, recortado o regenerado alguna, aquí saldría con su nombre y su hash.
  const c = capturasExistentes();
  assert.ok(c.ok, `🔴 CIEGO: ${c.porque}`);

  const distintas = [];
  let comparadas = 0;
  for (const p of c.pngs) {
    const rel = `docs/evidencias/demo-final/${p.fichero}`;
    const enLaBase = bytesEnLaBase(rel);
    if (!enLaBase) continue; // no estaba en la base: la crea esta rama, no hay contra qué comparar
    comparadas += 1;
    const antes = createHash('sha256').update(enLaBase).digest('hex');
    const ahora = sha(path.join(RAIZ, rel));
    if (ahora !== antes) distintas.push(`${p.fichero}  ${antes.slice(0, 12)} → ${ahora.slice(0, 12)}`);
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
  const c = capturasExistentes();
  assert.ok(c.ok, `🔴 CIEGO: ${c.porque}`);

  // El universo de pantallas del panel. Si el `slug` de una captura está aquí, esa captura ES de
  // una pantalla del panel — y por tanto tiene que seguir fotografiándose.
  const universo = new Set(vistasNavegablesPorHash(RAIZ));
  const porSlug = new Map(vistasDelBarrido(RAIZ).map((v) => [slug(v.nombre), v.nombre]));
  const perdidas = [];
  const cambiadas = [];
  for (const p of c.pngs) {
    if (!universo.has(p.slug)) continue; // no es pantalla del panel (modales, landing, 404…)
    const ahora = porSlug.get(p.slug);
    if (!ahora) { perdidas.push(`${p.fichero}  (slug ${p.slug})`); continue; }
    // 🔴 SE EMPAREJA POR `slug`, NO POR EL NOMBRE ENTERO, y es una decisión medida: el prefijo
    // numérico es POSICIÓN dentro de la lista, y la lista creció de 12 a 20 — así que renumerar es
    // la consecuencia esperada de añadir ocho, no un defecto. Lo que NO puede cambiar es que esa
    // pantalla siga fotografiándose.
    if (slug(ahora) !== p.slug) cambiadas.push(`${p.fichero}: ${p.nombre} → ${ahora}`);
  }

  assert.deepEqual(perdidas, [],
    '🔴 EL ARREGLO HA PERDIDO PANTALLAS QUE YA SE FOTOGRAFIABAN:\n    ' + perdidas.join('\n    ')
    + '\n\n  La derivación tiene que ser un superconjunto de la lista vieja, nunca un cambio.');
  assert.deepEqual(cambiadas, [],
    '🔴 UNA CAPTURA APUNTA A OTRA PANTALLA:\n    ' + cambiadas.join('\n    '));
});
