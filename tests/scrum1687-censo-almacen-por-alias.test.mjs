// tests/scrum1687-censo-almacen-por-alias.test.mjs — SCRUM-1687
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL DEFECTO (medido por S4 el 10-nov-2026): el censo de almacenamiento reconocía el almacén por el
// TEXTO del receptor. `localStorage.setItem(…)` existía para él; `const a = window.localStorage;
// a.setItem(…)` o `function f(almacen) { almacen.setItem(…) }` NO existían: ni se contaban ni se les
// exigía purga al cerrar sesión (SCRUM-457).
//
// Medido por S3 el 11-nov-2026 sobre main `4d8043854`: de 29 llamadas `X.setItem/getItem/removeItem`
// en `public/`, el censo veía 22. Las 7 ciegas eran DOS escrituras reales —
//   · `arranqueSinCobertura.js:45`  `almacen.setItem(…)`   (parámetro; el almacén llega desde app.js)
//   · `almacenLocal.js:436`         `teclas.setItem(…)`    (alias de `teclasDelNavegador()`)
// — más sus lecturas y borrados. Las dos claves SÍ se purgan, pero porque alguien las ató a mano.
//
// ⚠️ La forma del arreglo es la que pide el ticket: no se le enseña al censo «otro nombre» (eso
// sería el mismo defecto con otro texto). Se sigue el VALOR por el AST, y lo que no se sabe seguir
// sale como «(almacén no resuelto)» —fail-closed—, en vez de no existir.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { temporal } from './_temporal.mjs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { censarAlmacenamiento, NO_RESUELTO } from './_censo-almacenamiento-publico.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ts = createRequire(import.meta.url)('typescript');
const NL = '\n';

/** Un `public/` de mentira FUERA del árbol (SCRUM-824); `temporal` lo borra al acabar (SCRUM-864). */
function arbolDeMentira(ficheros) {
  const raiz = temporal('scrum1687-');
  for (const [rel, texto] of Object.entries(ficheros)) {
    const abs = path.join(raiz, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, texto);
  }
  return raiz;
}

const resumen = (a) => `${a.fichero}:${a.linea} ${a.almacen}.${a.op}`;

// ═══ ① EL CONTROL POSITIVO VIVO: los dos casos de main tienen que APARECER ════════════════

test('SCRUM-1687 · el censo VE la escritura por parámetro de arranqueSinCobertura.js, y la resuelve a localStorage', () => {
  const accesos = censarAlmacenamiento(path.join(RAIZ, 'public'), RAIZ);
  const caso = accesos.filter((a) => a.fichero === 'public/dashboard/js/arranqueSinCobertura.js' && a.escribe);
  assert.deepEqual(caso.map((a) => [a.almacen, a.claveResuelta && a.claveResuelta.valor]),
    [['localStorage', 'yaqu_sesion_sin_cobertura']],
    `🔴 el censo no ve \`almacen.setItem(CLAVE_SESION_SIN_COBERTURA, …)\` o no sabe en qué almacén cae: ` +
    `${JSON.stringify(caso.map(resumen))}. El almacén le llega como PARÁMETRO desde app.js ` +
    '(`guardarCopiaDeSesion(window.localStorage, me)`); si esto vuelve a salir vacío, «0 sin purgar» ' +
    'en SCRUM-457 es ceguera, no limpieza.');
});

test('SCRUM-1687 · el censo VE la escritura por alias de almacenLocal.js (`teclas = teclasDelNavegador()`)', () => {
  const accesos = censarAlmacenamiento(path.join(RAIZ, 'public'), RAIZ);
  const caso = accesos.filter((a) => a.fichero === 'public/dashboard/js/almacenLocal.js' && a.escribe);
  assert.deepEqual(caso.map((a) => [a.almacen, a.claveResuelta && a.claveResuelta.tipo, a.claveResuelta && a.claveResuelta.valor]),
    [['localStorage', 'prefijo', 'yaqu_firma_rechazada_']],
    `🔴 el censo no ve \`teclas.setItem(PREFIJO_FIRMA_RECHAZADA + …)\`: ${JSON.stringify(caso.map(resumen))}. ` +
    '`teclas` es el valor de `teclasDelNavegador()`, que devuelve `localStorage`.');
});

// ═══ ② NINGUNA LLAMADA SE QUEDA FUERA: resuelta o «no resuelta», pero en el censo ═══════════

test('SCRUM-1687 · toda llamada X.setItem/getItem/removeItem de public/ está en el censo (nada desaparece)', () => {
  // Se cuenta con un recorrido INDEPENDIENTE del censo: solo la forma de la llamada, sin decidir nada
  // sobre el receptor. Si el censo vuelve a descartar por el nombre, aquí sale la diferencia.
  const OPS = ['setItem', 'getItem', 'removeItem'];
  const esperadas = [];
  (function recorre(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) { recorre(abs); continue; }
      if (!/\.(html|js)$/.test(e.name)) continue;
      const rel = path.relative(RAIZ, abs).replace(/\\/g, '/');
      const texto = fs.readFileSync(abs, 'utf8');
      const trozos = abs.endsWith('.html')
        ? [...texto.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
          .map((m) => ({ codigo: m[1], off: texto.slice(0, m.index).split('\n').length - 1 }))
        : [{ codigo: texto, off: 0 }];
      for (const { codigo, off } of trozos) {
        const sf = ts.createSourceFile('x.js', codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
        (function w(n) {
          if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
              && OPS.includes(n.expression.name.text)) {
            esperadas.push(`${rel}:${off + sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`);
          }
          ts.forEachChild(n, w);
        })(sf);
      }
    }
  })(path.join(RAIZ, 'public'));

  const censadas = new Set(censarAlmacenamiento(path.join(RAIZ, 'public'), RAIZ)
    .filter((a) => a.almacen !== 'cookie').map((a) => `${a.fichero}:${a.linea}`));
  assert.ok(esperadas.length >= 25,
    `🔴 SUELO: el recorrido independiente solo vio ${esperadas.length} llamadas (el 11-nov eran 29). No ha mirado.`);
  assert.deepEqual(esperadas.filter((e) => !censadas.has(e)), [],
    '🔴 estas llamadas a la API de almacenamiento NO están en el censo, ni como resueltas ni como ' +
    '«no resueltas»: para SCRUM-457 y SCRUM-336 no existen.');
});

test('SCRUM-1687 · ninguna ESCRITURA de public/ se queda con el almacén sin resolver', () => {
  // Una lectura o un borrado sin resolver no cambia ningún veredicto (el purgado de SCRUM-457 los
  // recorre a propósito con un parámetro). Una ESCRITURA sí: no se sabe qué se guarda ni dónde.
  const ciegas = censarAlmacenamiento(path.join(RAIZ, 'public'), RAIZ)
    .filter((a) => a.escribe && a.almacen === NO_RESUELTO);
  assert.deepEqual(ciegas.map((a) => `${a.fichero}:${a.linea} (${a.receptor})`), [],
    '🔴 hay escrituras cuyo almacén el censo no sabe seguir. No pasan por «no hay problema»: o el ' +
    'código se escribe para que el valor se pueda seguir, o se le enseña al censo esa forma.');
});

// ═══ ③ LAS FORMAS, UNA A UNA, sobre un árbol de mentira ═════════════════════════════════

test('SCRUM-1687 · alias, retorno de función, parámetro y global de otro fichero se resuelven al almacén', () => {
  const raiz = arbolDeMentira({
    'public/dashboard/js/a.js': [
      'const alias = window.localStorage;',
      "alias.setItem('k_alias', '1');",
      'function dameAlmacen() { try { return typeof sessionStorage !== "undefined" ? sessionStorage : null; } catch (_e) { return null; } }',
      'function usaRetorno() { const t = dameAlmacen(); t.setItem("k_retorno", "1"); }',
      'function guarda(almacen, v) { almacen.setItem("k_param", v); }',
      'var GLOBAL_ALM = localStorage;',
    ].join(NL),
    'public/dashboard/js/b.js': [
      'guarda(window.localStorage, 1);',
      'guarda(localStorage, 2);',
      "GLOBAL_ALM.setItem('k_global', '1');",
    ].join(NL),
  });
  const accesos = censarAlmacenamiento(path.join(raiz, 'public'), raiz).filter((a) => a.escribe);
  assert.deepEqual(accesos.map((a) => [a.claveResuelta && a.claveResuelta.valor, a.almacen]).sort(),
    [['k_alias', 'localStorage'], ['k_global', 'localStorage'], ['k_param', 'localStorage'], ['k_retorno', 'sessionStorage']],
    `🔴 alguna forma no se resuelve: ${JSON.stringify(accesos.map(resumen))}`);
});

test('SCRUM-1687 · lo que NO se sabe seguir sale como «no resuelto»: nunca desaparece y nunca se adivina', () => {
  const raiz = arbolDeMentira({
    'public/dashboard/js/c.js': [
      // parámetro sin ninguna llamada: no hay de dónde sacar el valor
      'function huerfana(alm) { alm.setItem("k_huerfana", "1"); }',
      // parámetro llamado con DOS almacenes distintos: elegir uno sería adivinar
      'function ambos(alm) { alm.setItem("k_ambos", "1"); }',
      'ambos(localStorage); ambos(sessionStorage);',
      // `let` reasignado: el inicializador ya no dice lo que vale
      'let mutable = localStorage; mutable = otraCosa();',
      'mutable.setItem("k_mutable", "1");',
      // un objeto que NO es almacén pero tiene `setItem`: fail-closed, se ve y se declara
      'const lista = crearLista();',
      'lista.setItem("k_lista", "1");',
    ].join(NL),
  });
  const accesos = censarAlmacenamiento(path.join(raiz, 'public'), raiz).filter((a) => a.escribe);
  assert.deepEqual(accesos.map((a) => [a.claveResuelta && a.claveResuelta.valor, a.almacen]).sort(),
    [['k_ambos', NO_RESUELTO], ['k_huerfana', NO_RESUELTO], ['k_lista', NO_RESUELTO], ['k_mutable', NO_RESUELTO]],
    `🔴 ${JSON.stringify(accesos.map(resumen))}`);
  for (const a of accesos) {
    assert.ok(a.receptor, `🔴 ${resumen(a)} sale sin el texto del receptor: quien lo lea no sabe qué mirar.`);
  }
});

test('SCRUM-1687 · un parámetro que se llama `localStorage` NO es el almacén global', () => {
  // El caso inverso del defecto: el nombre dice «almacén» y el valor puede ser otra cosa.
  const raiz = arbolDeMentira({
    'public/dashboard/js/d.js': [
      'function sombra(localStorage) { localStorage.setItem("k_sombra", "1"); }',
      'sombra(crearOtraCosa());',
    ].join(NL),
  });
  const accesos = censarAlmacenamiento(path.join(raiz, 'public'), raiz).filter((a) => a.escribe);
  assert.deepEqual(accesos.map((a) => a.almacen), [NO_RESUELTO],
    `🔴 el censo se ha fiado del NOMBRE del parámetro: ${JSON.stringify(accesos.map(resumen))}`);
});
