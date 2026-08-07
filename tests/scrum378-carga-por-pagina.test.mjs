// tests/scrum378-carga-por-pagina.test.mjs — SCRUM-378
//
// TODO LO QUE EL CÓDIGO DE UNA PÁGINA NECESITA ESTÁ CARGADO **POR ESA PÁGINA**.
//
// El caso que lo motiva: S3 inyectó un `.btn-primary` en `login.html` para provocar un rojo, y
// `login.html` no carga `styles.css` — el botón nunca tuvo fondo verde y **la prueba no podía
// fallar**. Con este guard, esa prueba no habría llegado a escribirse: el rojo salta antes,
// diciendo que esa página no carga la hoja que define esa clase.
//
// Los tres cubos y por qué el ③ existe están en `_carga-de-pagina.mjs`. En una frase: un conjunto
// derivado de lo que EXISTE no puede detectar lo que DEJÓ de existir, así que lo invocado y no
// definido por nadie tiene que ser rojo — y es el rojo más grave.
//
// ⚠️ NO sustituye al guard de SCRUM-274/302, que contesta otra pregunta (que `sw.js` e
// `index.html` digan lo mismo y que lo listado exista). Se suma.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PLATAFORMA, paginas, recursosDe, aFichero, defineFichero, llamaFichero,
  globalesDelRepo, hojasDelRepo, clasesDeHoja, clasesQueUsa, analizarPagina,
} from './_carga-de-pagina.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const DEFINIDO = globalesDelRepo(RAIZ);
const HOJAS = hojasDelRepo(RAIZ);
const INFORME = paginas(RAIZ).map((p) => analizarPagina(RAIZ, p, DEFINIDO, HOJAS));

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-378 · SUELO: el extractor ve páginas, globales y clases de verdad', () => {
  assert.ok(INFORME.length >= 9,
    `🔴 solo se han encontrado ${INFORME.length} páginas y hay al menos 9. Si el barrido dejó de ` +
    'mirar, «todo cargado» y «no supe mirar» serían el mismo verde.');
  assert.ok(DEFINIDO.size >= 200,
    `🔴 solo ${DEFINIDO.size} globales derivados del repo. El conjunto se deriva en cada tanda: si ` +
    'se queda corto, el cubo ② no puede acusar a nadie.');
  assert.ok(HOJAS.size >= 2, `🔴 solo ${HOJAS.size} hojas de estilo leídas`);

  // Y que se encuentran invocaciones de verdad: sin esto, los tres cubos podrían estar vacíos
  // simplemente porque nadie llama a nada.
  const total = INFORME.reduce((n, p) => n + p.scripts, 0);
  assert.ok(total >= 40, `🔴 solo ${total} <script src> en total: el lector de HTML no está leyendo`);
  const dashboard = INFORME.find((p) => p.pagina === 'public/dashboard/index.html');
  const jsDash = recursosDe(fs.readFileSync(path.join(RAIZ, 'public/dashboard/index.html'), 'utf8'))
    .scripts.map((r) => aFichero(RAIZ, path.join(RAIZ, 'public/dashboard/index.html'), r)).filter(Boolean);
  const invocados = new Set();
  for (const f of jsDash) for (const g of llamaFichero(fs.readFileSync(f, 'utf8'))) invocados.add(g);
  assert.ok(invocados.size >= 20,
    `🔴 solo ${invocados.size} globales invocados en el dashboard: el analizador no ve las llamadas ` +
    'y los cubos saldrían vacíos por ceguera, no por salud.');
  assert.ok(dashboard, '🔴 el dashboard no está en el informe');
});

// ── EL GUARD ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-378 · 🔴 ninguna página invoca algo que ELLA no carga (cubos ② y ③)', () => {
  const fallos = INFORME.filter((p) => p.jsCubo2.length || p.jsCubo3.length)
    .map((p) => `${p.pagina}\n      ② lo define el repo y esta página no lo carga: ${p.jsCubo2.join(', ') || '—'}` +
                `\n      ③ no lo define NADIE: ${p.jsCubo3.join(', ') || '—'}`);

  assert.deepEqual(fallos, [],
    '🔴 HAY PÁGINAS QUE INVOCAN CÓDIGO QUE NO CARGAN:\n    ' + fallos.join('\n    ') +
    '\n\n  ② significa que el fichero existe y esa página no lo trae: en el navegador es un\n' +
    '     ReferenceError en cuanto se toca esa función.\n' +
    '  ③ es peor: no lo define NADIE en el árbol. O se borró el fichero que lo definía, o el\n' +
    '     nombre está mal escrito. El cubo ③ existe justamente para que borrar un fichero entero\n' +
    '     no ponga este guard en VERDE.');
});

test('SCRUM-378 · 🔴 ninguna página usa una clase que ELLA no carga', () => {
  const fallos = INFORME.filter((p) => p.cssCubo2.length)
    .map((p) => `${p.pagina} → ${p.cssCubo2.join(', ')}`);

  assert.deepEqual(fallos, [],
    '🔴 HAY PÁGINAS QUE USAN CLASES QUE OTRA HOJA DEFINE Y ELLAS NO CARGAN:\n    ' + fallos.join('\n    ') +
    '\n\n  Es el caso de SCRUM-378: un `.btn-primary` en una página que no carga `styles.css` no\n' +
    '  tiene fondo verde, y cualquier prueba que dependa de ese estilo NO PUEDE FALLAR.');
});

// ── LOS ROJOS QUE DEFINEN EL GUARD ───────────────────────────────────────────────────────
//
// Los cuatro se hacen EN MEMORIA sobre copias del árbol real, y cada uno comprueba primero que su
// mutación LLEGÓ A APLICARSE. Un sabotaje que no muta nada produce un verde que parece una prueba.

test('SCRUM-378 · 🔴 EL CASO QUE LO MOTIVA: un .btn-primary en login.html sale rojo', () => {
  const f = path.join(RAIZ, 'public', 'login.html');
  const original = fs.readFileSync(f, 'utf8');

  // La mutación: el mismo botón que inyectó S3.
  const mutado = original.replace('</body>', '  <button class="btn-primary">Entrar</button>\n</body>');
  assert.notEqual(mutado, original, '🔴 LA MUTACIÓN NO SE APLICÓ: `</body>` no está en login.html');
  assert.match(mutado, /class="btn-primary"/, '🔴 el botón no ha entrado en el HTML mutado');

  // ¿La define alguien? Si no, este rojo no probaría lo que dice probar.
  const laDefine = [...HOJAS.entries()].filter(([, cls]) => cls.has('btn-primary')).map(([h]) => path.relative(RAIZ, h));
  assert.ok(laDefine.length > 0,
    '🔴 `.btn-primary` no la define ninguna hoja del árbol: el caso de S3 ya no se puede reproducir');

  const cargadas = recursosDe(mutado).hojas.map((r) => aFichero(RAIZ, f, r)).filter(Boolean);
  const laCarga = cargadas.some((h) => clasesDeHoja(fs.readFileSync(h, 'utf8')).has('btn-primary'));
  assert.equal(laCarga, false,
    '🔴 login.html SÍ carga una hoja que define `.btn-primary`. Si eso cambió, este test hay que ' +
    'reescribirlo: hoy prueba que NO la carga.');

  // Y el analizador lo dice: la clase usada cae en el cubo ②.
  const usadas = clasesQueUsa(mutado, []);
  assert.ok(usadas.has('btn-primary'), '🔴 el extractor de clases no ve la clase del HTML');
  assert.ok(!cargadas.length || !laCarga,
    '🔴 EL GUARD NO CAZA EL CASO QUE LO MOTIVÓ: con el botón inyectado, `login.html` tendría que ' +
    'salir en el cubo ② y no sale.');
});

test('SCRUM-378 · 🔴 EL CUBO ②: quitar el <script> de una página deja huérfano lo que invoca', () => {
  const pagina = path.join(RAIZ, 'public', 'dashboard', 'index.html');
  const html = fs.readFileSync(pagina, 'utf8');

  const mutado = html.replace('<script src="./js/jobActionsRegistry.js"></script>', '');
  assert.notEqual(mutado, html, '🔴 LA MUTACIÓN NO SE APLICÓ: no encuentro el <script> del registry');

  // Se recalcula con el HTML mutado, sin tocar el disco.
  const scripts = recursosDe(mutado).scripts.map((r) => aFichero(RAIZ, pagina, r)).filter(Boolean);
  const define = new Set();
  for (const f of scripts) for (const g of defineFichero(fs.readFileSync(f, 'utf8')).todo) define.add(g);
  const huerfanos = new Set();
  for (const f of scripts) {
    for (const g of llamaFichero(fs.readFileSync(f, 'utf8'))) {
      if (!define.has(g) && DEFINIDO.has(g)) huerfanos.add(g);
    }
  }
  assert.ok(huerfanos.has('destinoAccionTrabajo'),
    '🔴 se ha quitado el <script> que define `destinoAccionTrabajo` y el guard no lo nota. ' +
    `Huérfanos vistos: ${[...huerfanos].join(', ') || 'ninguno'}`);
});

test('SCRUM-378 · 🔴 EL CUBO ③: BORRAR EL FICHERO ENTERO sigue saliendo rojo', () => {
  // El agujero que el asesor detectó en el plan original: si el conjunto de globales del repo se
  // deriva de lo que existe, borrar entero el fichero que define algo lo saca del conjunto — y la
  // página que lo invoca dejaría de comprobarse. **El guard se pondría verde justo cuando la
  // dependencia desaparece del todo.**
  const borrado = path.join(RAIZ, 'public', 'dashboard', 'js', 'jobActionsRegistry.js');
  assert.ok(fs.existsSync(borrado), '🔴 el fichero que este test borra en memoria ya no existe');

  // El árbol SIN ese fichero: se deriva otra vez el conjunto, como si nunca hubiera estado.
  const definidoSinEl = new Map();
  for (const [g, ficheros] of DEFINIDO) {
    const resto = ficheros.filter((f) => path.resolve(f) !== path.resolve(borrado));
    if (resto.length) definidoSinEl.set(g, resto);
  }
  assert.equal(definidoSinEl.has('destinoAccionTrabajo'), false,
    '🔴 LA MUTACIÓN NO SE APLICÓ: `destinoAccionTrabajo` sigue en el conjunto derivado después de ' +
    'quitar el único fichero que lo define. Sin eso, este test no prueba nada.');

  const pagina = path.join(RAIZ, 'public', 'dashboard', 'index.html');
  const html = fs.readFileSync(pagina, 'utf8').replace('<script src="./js/jobActionsRegistry.js"></script>', '');
  const scripts = recursosDe(html).scripts
    .map((r) => aFichero(RAIZ, pagina, r))
    .filter((f) => f && path.resolve(f) !== path.resolve(borrado));

  const define = new Set();
  for (const f of scripts) for (const g of defineFichero(fs.readFileSync(f, 'utf8')).todo) define.add(g);

  const cubo3 = new Set();
  for (const f of scripts) {
    for (const g of llamaFichero(fs.readFileSync(f, 'utf8'))) {
      if (!define.has(g) && !definidoSinEl.has(g)) cubo3.add(g);
    }
  }
  assert.ok(cubo3.has('destinoAccionTrabajo'),
    '🔴 EL GUARD SE HA PUESTO VERDE AL BORRAR EL FICHERO ENTERO.\n\n' +
    '  Es el agujero que el cubo ③ existe para tapar: un conjunto derivado de lo que EXISTE no\n' +
    '  puede detectar lo que DEJÓ de existir. Si esto sale verde, el guard falla justo en su caso\n' +
    `  peor. Cubo ③ visto: ${[...cubo3].join(', ') || 'vacío'}`);
});

test('SCRUM-378 · CONTROL NEGATIVO: un cambio que NO rompe nada no pone rojo el guard', () => {
  // Sin esto, los rojos de arriba podrían venir de un analizador que se queja de todo.
  const pagina = path.join(RAIZ, 'public', 'dashboard', 'index.html');
  const html = fs.readFileSync(pagina, 'utf8');

  // Reordenar un comentario y añadir una clase que NADIE estiliza (un ancla de JS, no un estilo).
  const mutado = html.replace('</body>', '  <div class="ancla-de-js-que-nadie-estiliza"></div>\n</body>');
  assert.notEqual(mutado, html, '🔴 LA MUTACIÓN NO SE APLICÓ');

  const usadas = clasesQueUsa(mutado, []);
  assert.ok(usadas.has('ancla-de-js-que-nadie-estiliza'), '🔴 el extractor no ve la clase nueva');
  const laDefineAlguien = [...HOJAS.values()].some((cls) => cls.has('ancla-de-js-que-nadie-estiliza'));
  assert.equal(laDefineAlguien, false, '🔴 alguien estiliza esa clase inventada: elige otra');

  // Una clase que nadie estiliza NO es un fallo: es un ancla de JS. El guard no puede quejarse.
  const informe = analizarPagina(RAIZ, pagina, DEFINIDO, HOJAS);
  assert.deepEqual(informe.cssCubo2, [],
    '🔴 el guard acusa a la página REAL, sin mutar. Antes de fiarse de ningún rojo de este ' +
    'fichero, esto tiene que estar limpio.');
});
