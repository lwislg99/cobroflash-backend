// tests/scrum631-la-unicidad-tiene-vigilante.test.mjs — SCRUM-631
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA GARANTÍA QUE SE PODÍA PERDER SIN QUE NADIE LO DIJERA
//
// La opción B mueve la unicidad del nombre de producto a un ÍNDICE PARCIAL, que vive FUERA de
// `prisma/schema.prisma` porque Prisma 6.18 no sabe declararlo. Medido el 5-sep-2026:
//
//   · `db push` NO se lo lleva («already in sync», índice intacto) — la advertencia heredada
//     valía para un índice TOTAL, no para uno parcial: en el mismo disparo Prisma propuso
//     `DROP INDEX` del total y no dijo nada del parcial.
//   · 🔴 PERO EL PREVIEW DICE LO MISMO CON EL ÍNDICE Y SIN ÉL: no distingue los dos estados.
//     El peligro no es que se lo lleven — es que nada lo recrea y NADA NOTA SU AUSENCIA.
//
// Y no había quien lo notara: los dos guardianes de la casa miran COLUMNAS (`schemaDrift.ts:25`
// lo declara; `constanciaDelAlter.ts:58` consulta `information_schema.columns`). Un índice no
// tenía vigilante. Esto es el vigilante.
//
// ── EL CONTROL NEGATIVO NO ES HIPOTÉTICO, Y ES EL CORAZÓN DE ESTE TEST ────────────────────
// En `products` convive HOY `products_merchant_id_name_search_idx`: MISMAS DOS COLUMNAS, NO
// único. Un guard que mirara sólo las columnas lo daría por bueno y saldría verde con la
// garantía perdida. El corpus de aquí es el catálogo REAL de dev, leído el 5-sep-2026, con ese
// índice dentro a propósito.
//
// ── POR QUÉ EL ENGANCHE SE COMPRUEBA POR AST Y NO POR TEXTO ───────────────────────────────
// `src.includes('assertUnicidadDeNombre')` seguiría VERDE tras borrar la llamada, porque el
// `import` mantiene la palabra viva en el fichero. Es el defecto exacto de SCRUM-745. La técnica
// se DERIVA de `scrum222-deriva-arranque.test.mjs:324`, que ya la resolvió para el guard hermano.
//
// ⚠️ ESCALÓN 3 DECLARADO: `llamadasEnTests` de `_alcance-desde-entradas.mjs` hace exactamente
// esta búsqueda por AST, pero está ACOTADA al directorio `tests/`; generalizarla tocaría un
// helper compartido por otros tests, más riesgo del que este ticket pide. Y `quienLoImporta` no
// sirve: contesta «quién lo importa», y el import SOBREVIVE justo cuando se borra la llamada,
// que es el defecto a cazar.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url'; // SCRUM-730: `pathname` no decodifica el espacio
import ts from 'typescript';

import {
  TABLA,
  COLUMNAS,
  clasificarIndice,
  evaluarUnicidad,
  desenlaceDeArranque,
  comprobarUnicidadDeNombre,
} from '../dist/core/db/unicidadNombreProducto.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * EL CATÁLOGO REAL de `products` en dev, leído el 5-sep-2026 con el índice parcial ya aplicado.
 * No es un fixture inventado: es lo que devuelve `CONSULTA_INDICES`, con sus seis índices.
 */
const CATALOGO_REAL = [
  { nombre: 'products_merchant_id_idx', unico: false, columnas: ['merchant_id'], predicado: null },
  { nombre: 'products_merchant_id_name_search_idx', unico: false, columnas: ['merchant_id', 'name_search'], predicado: null },
  { nombre: 'products_merchant_id_name_search_key', unico: true, columnas: ['merchant_id', 'name_search'], predicado: null },
  { nombre: 'products_merchant_nombre_activo_key', unico: true, columnas: ['merchant_id', 'name_search'], predicado: '(is_active = true)' },
  { nombre: 'products_pkey', unico: true, columnas: ['id'], predicado: null },
  { nombre: 'products_provider_id_idx', unico: false, columnas: ['provider_id'], predicado: null },
];

const sinLosDeNombre = () => CATALOGO_REAL.filter(
  (i) => !(i.unico && (i.columnas || []).includes('name_search')),
);

// ── ① CONTROL POSITIVO — las dos formas legítimas se reconocen ────────────────────────────

test('SCRUM-631 · POSITIVO: el índice TOTAL de hoy cuenta como garantía', () => {
  const total = CATALOGO_REAL.find((i) => i.nombre === 'products_merchant_id_name_search_key');
  assert.equal(clasificarIndice(total), 'total');
  const r = evaluarUnicidad(sinLosDeNombre().concat([total]));
  assert.equal(r.estado, 'garantizada');
  assert.equal(r.forma, 'total');
});

test('SCRUM-631 · POSITIVO: el índice PARCIAL sobre activos cuenta como garantía', () => {
  const parcial = CATALOGO_REAL.find((i) => i.nombre === 'products_merchant_nombre_activo_key');
  assert.equal(parcial.predicado, '(is_active = true)', 'el predicado real medido en dev');
  assert.equal(clasificarIndice(parcial), 'parcial-activos');
  const r = evaluarUnicidad(sinLosDeNombre().concat([parcial]));
  assert.equal(r.estado, 'garantizada');
  assert.equal(r.forma, 'parcial-activos');
});

test('SCRUM-631 · los DOS estados de la migración valen (antes, durante y después)', () => {
  assert.equal(evaluarUnicidad(CATALOGO_REAL).estado, 'garantizada');
});

// ── ② CONTROL NEGATIVO — lo que NO puede contar ───────────────────────────────────────────

test('SCRUM-631 · 🔴 NEGATIVO: el índice NO ÚNICO sobre las mismas columnas NO cuenta', () => {
  const trampa = CATALOGO_REAL.find((i) => i.nombre === 'products_merchant_id_name_search_idx');
  assert.deepEqual(trampa.columnas, ['merchant_id', 'name_search'], 'la trampa es real: mismas columnas');
  assert.equal(trampa.unico, false);
  assert.equal(
    clasificarIndice(trampa), null,
    'un indice NO unico sobre (merchant_id, name_search) no garantiza nada, y existe HOY',
  );
});

test('SCRUM-631 · NEGATIVO: un índice único de OTRAS columnas no cuenta', () => {
  assert.equal(clasificarIndice(CATALOGO_REAL.find((i) => i.nombre === 'products_pkey')), null);
});

test('SCRUM-631 · NEGATIVO: un parcial sobre los INACTIVOS no cuenta', () => {
  assert.equal(clasificarIndice({
    nombre: 'al_reves', unico: true, columnas: ['merchant_id', 'name_search'],
    predicado: '(is_active = false)',
  }), null);
});

test('SCRUM-631 · NEGATIVO: un parcial con otra condición cualquiera no cuenta', () => {
  assert.equal(clasificarIndice({
    nombre: 'otra_cosa', unico: true, columnas: ['merchant_id', 'name_search'],
    predicado: '(price > (0)::numeric)',
  }), null);
});

test('SCRUM-631 · PERDIDA: sin ningún único sobre esas columnas, el veredicto es «perdida»', () => {
  const r = evaluarUnicidad(sinLosDeNombre());
  assert.equal(r.estado, 'perdida');
  assert.ok(r.mirados > 0, 'y se dice cuántos se miraron, para poder contrastarlo');
});

// ── ③ EL SUELO — «no supe mirar» no puede escribirse igual que «se ha perdido» ─────────────

test('SCRUM-631 · 🔴 SUELO: lista VACÍA es «no pude comprobar», NUNCA «perdida»', () => {
  const r = evaluarUnicidad([]);
  assert.equal(
    r.estado, 'no-pude-comprobar',
    'products tiene siempre su clave primaria: cero indices significa que la consulta no esta '
    + 'mirando esa tabla, no que la garantia se haya perdido',
  );
  assert.notEqual(r.estado, 'perdida');
});

test('SCRUM-631 · SUELO: un fallo de la base NO se vuelve «perdida» ni lanza', async () => {
  const r = await comprobarUnicidadDeNombre({
    cliente: { $queryRawUnsafe: async () => { throw new Error('conexion caida'); } },
  });
  assert.equal(r.estado, 'no-pude-comprobar');
  assert.match(r.motivo, /conexion caida/);
});

// ── ④ EL DESENLACE — qué pasa EN PRODUCCIÓN, sin arrancar producción ──────────────────────

test('SCRUM-631 · en PRODUCCIÓN, la garantía perdida NO deja arrancar', () => {
  const d = desenlaceDeArranque(evaluarUnicidad(sinLosDeNombre()), 'production');
  assert.equal(d.arranca, false);
  assert.match(d.mensaje, /SE HA PERDIDO/);
  assert.match(d.mensaje, /scrum-631-paso-1-crear-indice-parcial/, 'y dice qué aplicar');
});

test('SCRUM-631 · fuera de producción sólo AVISA (en local el esquema está a medias)', () => {
  const d = desenlaceDeArranque(evaluarUnicidad(sinLosDeNombre()), 'development');
  assert.equal(d.arranca, true);
  assert.equal(d.nivel, 'warn');
});

test('SCRUM-631 · «no pude comprobar» arranca, y JAMÁS dice que todo está bien', () => {
  const d = desenlaceDeArranque({ estado: 'no-pude-comprobar', motivo: 'x.' }, 'production');
  assert.equal(d.arranca, true, 'un hipo de red no debe tumbar produccion');
  assert.equal(d.nivel, 'error', 'pero se grita');
  assert.match(d.mensaje, /no pude comprobar/);
  // ⚠️ NO se comprueba que falte la frase «todo bien»: el mensaje la CONTIENE, dentro de su
  //    propia negación («esto NO significa que esté todo bien»). Una aserción sobre el token
  //    suelto leía esa negación como si fuera una afirmación — me la tumbó este test al correrlo.
  //    Lo que importa es que NO afirme la garantía y que DIGA que no se sabe.
  assert.doesNotMatch(d.mensaje, /garantizada/);
  assert.match(d.mensaje, /NO significa que esté todo bien/);
  assert.match(d.mensaje, /no se sabe/);
});

test('SCRUM-631 · cuando está garantizada, el log DICE QUÉ FORMA encontró', () => {
  const d = desenlaceDeArranque(evaluarUnicidad(CATALOGO_REAL), 'production');
  assert.equal(d.arranca, true);
  assert.match(d.mensaje, /total|parcial/);
});

test('SCRUM-631 · la tabla y las columnas vigiladas son las del ticket', () => {
  assert.equal(TABLA, 'products');
  assert.deepEqual([...COLUMNAS], ['merchant_id', 'name_search']);
});

// ── ⑤ EL ENGANCHE — un guard que no se llama es una decoración ────────────────────────────

test('GUARD · src/index.ts ESPERA a assertUnicidadDeNombre ANTES de app.listen', () => {
  const ruta = path.join(RAIZ, 'src', 'index.ts');
  const sf = ts.createSourceFile(
    ruta, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS,
  );
  const recorrer = (n, visita) => { visita(n); n.forEachChild((h) => recorrer(h, visita)); };

  let listen = null;
  recorrer(sf, (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && n.expression.name.text === 'listen') listen = n;
  });
  assert.ok(listen, 'no se encontro app.listen() en src/index.ts');

  let fn = listen.parent;
  while (fn && !ts.isFunctionDeclaration(fn)) fn = fn.parent;
  assert.ok(fn, 'app.listen ya no esta dentro de una funcion: el arranque no espera a nada');

  const awaitA = (nombre) => {
    let hallado = null;
    recorrer(fn.body, (n) => {
      if (ts.isAwaitExpression(n) && ts.isCallExpression(n.expression)
        && ts.isIdentifier(n.expression.expression)
        && n.expression.expression.text === nombre) hallado = n;
    });
    return hallado;
  };

  const mio = awaitA('assertUnicidadDeNombre');
  assert.ok(mio, 'el arranque no ESPERA a assertUnicidadDeNombre: el guard no vigila nada');
  assert.ok(mio.end < listen.getStart(sf), 'tiene que ir ANTES de escuchar, no despues');

  const hermano = awaitA('assertSchemaSinDeriva');
  assert.ok(hermano, 'el guard hermano ha desaparecido del arranque');
  assert.ok(
    hermano.end < mio.getStart(sf),
    'assertUnicidadDeNombre tiene que ir DESPUES de assertSchemaSinDeriva: si la columna no '
    + 'existe, la unicidad sobre ella no significa nada',
  );
});

// ── ⑥ LA MICROCOPY DEL REACTIVAR — sin firmar, y por eso MARCADA ─────────────────────────

test('SCRUM-631 · el texto de reactivar lleva marcador: no lo ha firmado nadie', () => {
  const vista = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/productsView.js'), 'utf8');

  // ① El literal existe y NACE MARCADO. Sin caja medida no se puede aprobar (regla 30), y la
  //    caja NO se pudo medir: el navegador de esta máquina no arranca — control hecho con
  //    `guard-caja-avisos.mjs`, que falla igual. Está declarado en el fichero y en el máster.
  const linea = vista.split(String.fromCharCode(10)).find((l) => l.includes('PV_MARCADOR_MICROCOPY + '));
  assert.ok(linea, '🔴 CIEGO: no encuentro el literal de reactivar');
  assert.match(linea, /Ya tienes otro producto activo con ese nombre/);

  // ② Y EL CONTADOR lo declara. Son DOS ranuras sin firma: la de SCRUM-641 (aprobada por el
  //    asesor, pendiente del fundador) y ésta (sin aprobar por nadie). Si alguien quita el
  //    marcador sin subir el número, el texto entraría en pantalla como si estuviera firmado.
  const m = vista.match(/const PV_SIN_APROBAR = (\d+);/);
  assert.ok(m, '🔴 no hay contador de ranuras sin firmar');
  assert.equal(Number(m[1]), 2,
    '🔴 el contador no declara las dos ranuras sin firma. El guard gemelo de SCRUM-641 mira el '
    + 'mismo número: si se cambia aquí y no allí, uno de los dos miente.');
});

test('SCRUM-631 · el camino de Activar usa el literal propio, no el del alta', () => {
  const vista = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/productsView.js'), 'utf8');
  // Por AST no: esto es una expresión dentro de un handler y lo que importa es que el literal
  // del REACTIVAR aparezca en la rama de `activando`. Se comprueba que las dos piezas estén en
  // la misma sentencia, que es lo que un `includes` suelto no distinguiría.
  const sent = vista.split(String.fromCharCode(10)).findIndex((l) => l.includes('activando && codigo === PV_COD_NOMBRE_DUPLICADO'));
  assert.ok(sent > 0, '🔴 el camino de Activar ya no distingue el nombre cogido');
  const siguiente = vista.split(String.fromCharCode(10))[sent + 1];
  assert.match(siguiente, /PV_NOMBRE_ACTIVO_DUPLICADO/,
    '🔴 la rama de ACTIVAR ya no usa su propio texto: volvería a decir el del alta');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS MUTACIONES QUE ME TUMBAN — SCRUM-745
//
// ⚠️ LAS DOS SON SOBRE `src/index.ts`, Y NO ES CASUALIDAD. El meta-guard NO reconstruye `dist`
// antes de correr el test mutado (medido: lanza `node --test` y nada más), así que mutar
// `src/core/db/unicidadNombreProducto.ts` sería INERTE — el test importa el compilado, seguiría
// verde, y este guard parecería mudo sin serlo. `src/index.ts` sí se lee DE DISCO aquí.
//
// Las demás pruebas de este fichero no son guards de texto: comparan VALORES devueltos por
// funciones puras, así que no tienen la clase de mudez que este mecanismo persigue.
// ═════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El defecto entero: el guard existe, se importa, y nadie lo llama. El `import` mantiene la
    // palabra viva en el fichero — por eso un guard de TEXTO seguiría verde aquí.
    fichero: 'src/index.ts',
    de: '  await assertUnicidadDeNombre();',
    a: '  // await assertUnicidadDeNombre();',
    cae: 'GUARD · src/index.ts ESPERA a assertUnicidadDeNombre ANTES de app.listen',
  },
  {
    // La otra mitad: el orden. Si el de esquema desaparece, preguntar por la unicidad de una
    // columna que puede no existir no significa nada.
    fichero: 'src/index.ts',
    de: '  await assertSchemaSinDeriva();',
    a: '  await assertUnicidadDeNombre();',
    cae: 'GUARD · src/index.ts ESPERA a assertUnicidadDeNombre ANTES de app.listen',
  },
];
