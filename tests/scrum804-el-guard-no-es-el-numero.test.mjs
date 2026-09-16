// tests/scrum804-el-guard-no-es-el-numero.test.mjs — SCRUM-804
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// Un fichero con el número del ticket puesto NO es prueba de que el ticket esté hecho
// ══════════════════════════════════════════════════════════════════════════════════════════
//
// ── LA TRAMPA, MEDIDA ─────────────────────────────────────────────────────────────────────
// `tests/scrum727-constancia-del-vigia.test.mjs` existe, está verde, y vigila el vigía del
// despliegue. El ticket SCRUM-727 habla de que «la lista de Trabajos es un desastre». Mismo
// número, otro sujeto. Contar ficheros habría dado ese ticket por hecho.
//
// ── EL PUNTO CIEGO QUE ESTE GUARD EXISTE PARA QUE NO VUELVA ───────────────────────────────
// La primera versión del detector sólo veía literales pegados al lector. El SCRUM-806 —control
// positivo del encargo— salió NO HECHO porque la casa arma la ruta antes:
//     const PORTAL = path.join(RAIZ, 'src/modules/system/app/routes/customerPortal.routes.ts');
//     const sf = (f) => ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), …);
// El literal no toca `readFileSync`: toca `path.join`, y lo que se lee es la VARIABLE. Con el
// armador dentro, el censo pasó de 45 candidatos a 54. Ese es el rojo que estos tests guardan.
//
// ── Y EL FRENO DEL ARMADOR ────────────────────────────────────────────────────────────────
// Contar un `path.join` a `src/` sin exigir que el fichero LEA convertiría «mencionar una ruta»
// en prueba — el mismo error que el `'dist'` suelto de SCRUM-763. Por eso el filtro de salida.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url'; // NUNCA `new URL().pathname`: no decodifica (SCRUM-730)
import { aseveraSobreProducto, parteDeLaTanda, veredictoDe, esParaguas } from '../scripts/censo-abiertos-vs-guards.mjs';
import { anclaEnElRepositorio } from './_ancla-en-el-repositorio.mjs'; // SCRUM-796

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// 🔴 `fichero`, `de`, `a` y `cae` van como LITERAL, nunca por constante ni concatenados:
// `lecturaDeDeclaraciones` los lee por AST y sólo acepta cadenas literales. Escribí
// `fichero: FUENTE` y las tres declaraciones salieron INCOMPLETAS — el guard de SCRUM-745 las
// cazó en la tanda, que es exactamente para lo que SCRUM-757 lo puso ahí.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/censo-abiertos-vs-guards.mjs',
    de: '      if (nom && (LECTORES.has(nom) || ARMADORES.has(nom))) {',
    a: '      if (nom && LECTORES.has(nom)) {',
    cae: 'la ruta ARMADA con path.join cuenta: es como lee la casa (el caso del 806)',
  },
  {
    fichero: 'scripts/censo-abiertos-vs-guards.mjs',
    de: "  return pruebas.filter((p) => p.via === 'import' || LECTORES.has(p.via) || hayLector);",
    a: '  return pruebas;',
    cae: 'mencionar una ruta de producto sin LEER nada no prueba nada',
  },
  {
    fichero: 'scripts/censo-abiertos-vs-guards.mjs',
    de: "  if (guardsVivos.length > 0 && aterrizo) return 'HECHO';",
    a: "  if (guardsVivos.length > 0) return 'HECHO';",
    cae: 'un guard verde sin aterrizaje no es HECHO',
  },
];

test('el ancla de cada mutación sigue viva en el REPOSITORIO (SCRUM-796)', () => {
  for (const m of MUTACIONES_QUE_ME_TUMBAN) {
    const r = anclaEnElRepositorio(m, RAIZ);
    if (!r.medible) continue;
    assert.ok(r.viva, `el ancla de «${m.cae}» ya no está en ${m.fichero} (${r.origen})`);
  }
});

test('la ruta ARMADA con path.join cuenta: es como lee la casa (el caso del 806)', () => {
  const comoLaCasa = [
    "import fs from 'node:fs';",
    "import path from 'node:path';",
    "const RAIZ = path.join('x', '..');",
    "const PORTAL = path.join(RAIZ, 'src/modules/system/app/routes/customerPortal.routes.ts');",
    "const texto = fs.readFileSync(PORTAL, 'utf8');",
  ].join('\n');
  const p = aseveraSobreProducto(comoLaCasa, 'comoLaCasa.test.mjs');
  assert.ok(p.length > 0, 'el detector no ve la ruta armada: vuelve el punto ciego del 806');
  assert.ok(p.some((x) => x.a.includes('customerPortal.routes.ts')));

  // Y el caso REAL, no una imitación: el guard del 806 vive en el árbol.
  const real = path.join(RAIZ, 'tests/scrum806-el-pdf-del-portal.test.mjs');
  if (fs.existsSync(real)) {
    assert.ok(
      aseveraSobreProducto(fs.readFileSync(real, 'utf8'), 'scrum806.test.mjs').length > 0,
      'el guard del SCRUM-806 asevera sobre producto y el detector no lo ve',
    );
  }
});

test('mencionar una ruta de producto sin LEER nada no prueba nada', () => {
  const soloMenciona = ["import path from 'node:path';", "const P = path.join('x', 'src/core/db.ts');"].join('\n');
  assert.equal(aseveraSobreProducto(soloMenciona, 'm.test.mjs').length, 0);

  const niEso = ["import test from 'node:test';", "test('x', () => {});"].join('\n');
  assert.equal(aseveraSobreProducto(niEso, 'n.test.mjs').length, 0);
});

test('un guard verde sin aterrizaje no es HECHO', () => {
  const guard = [{ fichero: 'tests/x.test.mjs', pruebas: [{ via: 'import', a: '../dist/a.js', linea: 1 }] }];
  assert.equal(veredictoDe({ guardsVivos: guard, aterrizo: true }), 'HECHO');
  assert.equal(veredictoDe({ guardsVivos: guard, aterrizo: false }), 'NO HECHO');
});

test('que EXISTA un fichero con el número no basta, y una épica no se juzga', () => {
  // sin guard vivo no hay HECHO, por muchos ficheros que lleven el número
  assert.equal(veredictoDe({ guardsVivos: [], aterrizo: true }), 'NO HECHO');
  // la entrada que declara que no construyó manda sobre el guard
  assert.equal(veredictoDe({ guardsVivos: [{}], aterrizo: true, noConstruye: true }), 'NO HECHO');
  // épicas y bloques paraguas no se juzgan por el árbol
  assert.equal(veredictoDe({ noMedible: true, guardsVivos: [{}], aterrizo: true }), 'NO MEDIBLE');
  assert.ok(esParaguas('BLOQUE A · Núcleo fiscal'));
  assert.ok(esParaguas('BLOQUE 1 · Contactos — lote aprobado 24-ago-2026 contra Holded (17 tickets)'));
  assert.ok(!esParaguas('🔴 El PDF de una factura EMITIDA se regenera con el código de hoy'));
});

test('el parte por fichero sale de los EVENTOS, porque el TAP no atribuye', () => {
  const jsonl = [
    JSON.stringify({ f: 'C:/r/tests/a.test.mjs', n: 'uno', ok: true, skip: false }),
    JSON.stringify({ f: 'C:/r/tests/a.test.mjs', n: 'dos', ok: true, skip: true }),
    JSON.stringify({ f: 'C:/r/tests/b.test.mjs', n: 'tres', ok: false, skip: false }),
  ].join('\n');
  const parte = parteDeLaTanda(jsonl);
  assert.equal(parte.get('a.test.mjs').ok, 1);
  assert.equal(parte.get('a.test.mjs').saltados, 1);
  assert.equal(parte.get('b.test.mjs').fallos, 1);
});
