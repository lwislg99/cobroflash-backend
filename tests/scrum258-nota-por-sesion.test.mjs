// tests/scrum258-nota-por-sesion.test.mjs — SCRUM-258 · la nota del turno es de la SESIÓN.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, Y ES MAYOR QUE SU ENUNCIADO
//
// La nota vivía en una ruta fija: `%TEMP%\yaqu-turno-staging.json`. Un fichero por EQUIPO. El
// ticket describe la mitad benigna —dos sesiones se pisan la nota y la primera se queda soltando
// a mano—. La otra mitad es peor, y **no necesita que caduque nada**:
//
//   1. B lanza su tanda (turno libre) → `guardarNota` escribe la marca de B encima de la de A.
//   2. A ejecuta `turno:soltar`, por costumbre o desde un script de limpieza.
//   3. `leerNota` le devuelve la marca de B; el marcador de la BD ES el de B, así que coincide.
//   4. **A suelta el turno VIVO de B.** En silencio, con la tanda de B escribiendo. El turno queda
//      libre para un tercero: dos sesiones sobre la misma base, que es el desastre exacto que
//      SCRUM-188 existe para impedir.
//
// El paso 3-4 solo era posible porque `soltarLock` comparaba **la cadena del marcador y nada
// más**: quien llegara con la marca correcta soltaba, fuera suyo el turno o no. Por eso este
// ticket tiene dos mitades y no una — la ruta y la comprobación del dueño.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { MARCADOR, componerMarca, soltarLock, TTL_POR_DEFECTO_MS } from '../scripts/_staging-lock.mjs';
import { dueñoActual, tokenDeSesion } from '../scripts/_identidad-sesion.mjs';
import { ficheroNota, guardarNota, leerNota, borrarNota } from '../scripts/_turno-nota.mjs';
import { barrer, ficherosDe } from './_identificadores-sueltos.mjs';

const RAIZ = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const T0 = Date.parse('2026-08-04T12:00:00.000Z');
const min = (n) => n * 60 * 1000;
const OTRA_SESION = 'DESKTOP-T5MONF5.a4ca185471'; // MISMA máquina, otro árbol

function clienteFalso({ marca, ahoraMs = T0, db = 'railway' }) {
  const estado = { marca, ahoraMs, db, comentarioSchema: 'standard public schema' };
  const cli = {
    estado,
    async $queryRawUnsafe(sql) {
      if (sql.includes('pg_namespace')) return [{ comentario: estado.comentarioSchema }];
      return [{ db: estado.db, marca: estado.marca, ahora: new Date(estado.ahoraMs) }];
    },
    async $executeRawUnsafe(sql) {
      if (sql.includes('advisory')) return 1;
      const m = /, '([^']*)'\); END \$\$;$/.exec(sql);
      assert.ok(m, `SQL inesperado: ${sql}`);
      if (!sql.includes('COMMENT ON SCHEMA')) estado.marca = m[1];
      return 1;
    },
    async $transaction(fn) { return fn(cli); },
  };
  return cli;
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA RUTA · una nota por sesión
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-258 · la ruta de la nota es distinta por árbol y la MISMA entre procesos', () => {
  // Las dos condiciones a la vez: si no fuera estable, `soltar` no encontraría lo que `tomar`
  // escribió (el defecto de SCRUM-249 de vuelta); si no fuera distinta, seguirían pisándose.
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-258-'));
  const arbolA = path.join(base, 'sesion-a');
  const arbolB = path.join(base, 'sesion-b');
  try {
    for (const a of [arbolA, arbolB]) {
      fs.mkdirSync(path.join(a, 'sub'), { recursive: true });
      fs.writeFileSync(path.join(a, '.git'), 'gitdir: ../fantasia\n');
    }
    assert.notEqual(ficheroNota(arbolA), ficheroNota(arbolB),
      '🔴 dos árboles distintos comparten fichero de nota. Es el defecto entero: la sesión que ' +
      'escriba después deja a la otra sin poder soltar — y peor, le presta su marca.');
    assert.equal(ficheroNota(arbolA), ficheroNota(path.join(arbolA, 'sub')),
      '🔴 la ruta cambia dentro del MISMO árbol: `soltar` no encontraría lo que escribió `tomar`.');
    assert.doesNotMatch(ficheroNota(arbolA), new RegExp(`p${process.pid}\\b`),
      '🔴 la ruta cayó al fallback por PID; entonces no se está midiendo árbol contra árbol');
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('SCRUM-258 · la ruta NO depende de nada que el humano exporte', () => {
  // La tentación era resolverlo con una variable de entorno. Se descartó por lo mismo que en
  // SCRUM-253: una ruta que depende de que alguien se acuerde de exportar algo vuelve a fallar
  // en silencio el día que no se acuerde. La ruta sale del árbol, y punto.
  const antes = ficheroNota(RAIZ);
  const entornoOriginal = { ...process.env };
  try {
    process.env.YAQU_TURNO_NOTA = 'C:/otra/cosa.json';
    process.env.TMPDIR_YAQU = 'C:/otra';
    assert.equal(ficheroNota(RAIZ), antes,
      '🔴 la ruta de la nota se puede mover con una variable de entorno. Eso reintroduce la ' +
      'clase de fallo que SCRUM-253 le quitó al dueño: identidad declarada en vez de derivada.');
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in entornoOriginal)) delete process.env[k];
  }
});

test('SCRUM-258 · la nota se describe a sí misma: una marca ajena no se devuelve', () => {
  // Segunda barrera. La ruta ya es propia, pero un fichero heredado o un `%TEMP%` compartido
  // entre usuarios no puede convertirse en «suelta esto».
  const ruta = ficheroNota();
  const habia = fs.existsSync(ruta) ? fs.readFileSync(ruta, 'utf8') : null;
  try {
    guardarNota({ marca: 'YAQU_STAGING lock:mia@2026-08-04T12:00:00.000Z', db: 'railway' });
    assert.equal(leerNota(), 'YAQU_STAGING lock:mia@2026-08-04T12:00:00.000Z',
      'suelo: la nota propia SÍ se lee, o lo de abajo no prueba nada');

    fs.writeFileSync(ruta, JSON.stringify({
      marca: 'YAQU_STAGING lock:ajena@2026-08-04T12:00:00.000Z', db: 'railway', dueño: OTRA_SESION,
    }), 'utf8');
    assert.equal(leerNota(), null,
      '🔴 se devuelve una marca de OTRA sesión. Con ella, `soltar` encuentra el marcador que ' +
      'coincide y le suelta el turno vivo a su dueño.');

    fs.writeFileSync(ruta, JSON.stringify({ marca: 'YAQU_STAGING lock:vieja@2026-08-04T12:00:00.000Z' }), 'utf8');
    assert.equal(leerNota(), null,
      '🔴 una nota SIN dueño (escrita por código anterior) se da por propia. No saber de quién ' +
      'es una marca es razón suficiente para no soltar con ella.');
  } finally {
    borrarNota();
    if (habia !== null) fs.writeFileSync(ruta, habia, 'utf8');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SOLTAR · comparar la cadena no es comprobar de quién es
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-258 · EL CASO GRAVE — con la marca correcta pero AJENA, no se suelta', async () => {
  const marcaAjena = componerMarca(OTRA_SESION, T0 - min(5));
  const cli = clienteFalso({ marca: marcaAjena });

  const r = await soltarLock(cli, { marcaPropia: marcaAjena, dueño: dueñoActual() });

  assert.equal(r.soltado, false,
    '🔴 se soltó el turno de OTRA sesión. La marca coincidía —viene de la nota compartida, o de ' +
    'un `--marca` pegado a mano— pero el turno no era nuestro. Soltarlo deja a esa tanda\n' +
    '  escribiendo sobre una base que figura LIBRE, y a un tercero tomándola.');
  assert.equal(r.motivo, 'ajeno', 'y el motivo tiene que distinguirse de «la marca no coincide»');
  assert.equal(cli.estado.marca, marcaAjena, 'el marcador ajeno no se ha tocado');
});

test('SCRUM-258 · el turno PROPIO se sigue soltando igual', async () => {
  // Sin esto, el de arriba se satisface no soltando nunca.
  const mia = componerMarca(dueñoActual(), T0 - min(5));
  const cli = clienteFalso({ marca: mia });

  const r = await soltarLock(cli, { marcaPropia: mia, dueño: dueñoActual() });

  assert.equal(r.soltado, true, '🔴 ya no se puede soltar el turno propio: el arreglo se pasó de frenada');
  assert.equal(cli.estado.marca, MARCADOR, 'y el marcador queda limpio');
});

test('SCRUM-258 · sin dueño se conserva el comportamiento anterior', async () => {
  // `dueño` es opcional a propósito para no romper a un llamador que no lo pase; lo que impide
  // que los de esta casa se lo dejen es el guard de más abajo.
  const marcaAjena = componerMarca(OTRA_SESION, T0 - min(5));
  const cli = clienteFalso({ marca: marcaAjena });
  const r = await soltarLock(cli, { marcaPropia: marcaAjena });
  assert.equal(r.soltado, true, 'sin dueño no hay nada que comprobar: se comporta como antes');
});

test('SCRUM-258 · los llamadores de casa SÍ pasan el dueño', () => {
  // Derivado: cualquier fichero que llame a `soltarLock` tiene que pasarle el dueño. Si no, la
  // comprobación existe y no la usa nadie — el verde más hueco posible.
  const llamadas = [];
  for (const rel of [...ficherosDe(RAIZ, 'scripts'), ...ficherosDe(RAIZ, 'tests')]) {
    if (rel.endsWith('_staging-lock.mjs')) continue; // es donde vive; no se llama a sí misma
    const codigo = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
    if (!codigo.includes('soltarLock')) continue;
    const sf = ts.createSourceFile(rel, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visitar = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'soltarLock') {
        llamadas.push({ rel, linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
          pasaDueño: /dueño\s*:/.test(n.arguments[1]?.getText(sf) ?? '') });
      }
      n.forEachChild(visitar);
    };
    visitar(sf);
  }

  const deProduccion = llamadas.filter((l) => l.rel.startsWith('scripts/'));
  assert.ok(deProduccion.length >= 2,
    `🔴 el barrido solo encuentra ${deProduccion.length} llamadas a \`soltarLock\` en scripts/; ` +
    'son al menos dos (el runner y el CLI). Si no las ve, su verde no dice nada.');

  const sinDueño = deProduccion.filter((l) => !l.pasaDueño).map((l) => `${l.rel}:${l.linea}`);
  assert.deepEqual(sinDueño, [],
    '🔴 estas llamadas sueltan el turno SIN decir quién lo suelta:\n\n' +
    sinDueño.map((s) => `      ${s}`).join('\n') + '\n\n' +
    '  Sin `dueño`, `soltarLock` vuelve a comparar solo la cadena del marcador y una marca\n' +
    '  ajena la suelta igual.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// GUARD · nada de estado por MÁQUINA en las herramientas
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-258 · ningún script guarda estado en una ruta fija compartida por la máquina', () => {
  // Derivado: se recorre `scripts/` entero. `mkdtempSync` queda fuera POR SU FORMA —crea un
  // directorio único en cada llamada, así que no puede ser estado compartido— y no por estar en
  // una lista. Cualquier ruta fija bajo el temporal tiene que llevar el token de la sesión.
  const hallazgos = [];
  let vistos = 0;
  for (const rel of ficherosDe(RAIZ, 'scripts')) {
    const codigo = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
    if (!codigo.includes('tmpdir')) continue;
    const sf = ts.createSourceFile(rel, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visitar = (n) => {
      if (ts.isCallExpression(n) && /tmpdir$/.test(n.expression.getText(sf))) {
        vistos += 1;
        let unico = false;
        let conToken = false;
        for (let a = n.parent; a; a = a.parent) {
          if (!ts.isCallExpression(a)) continue;
          const txt = a.expression.getText(sf);
          if (/mkdtemp/.test(txt)) { unico = true; break; }
          if (/tokenDeSesion/.test(a.getText(sf))) { conToken = true; break; }
        }
        if (!unico && !conToken) {
          hallazgos.push(`${rel}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`);
        }
      }
      n.forEachChild(visitar);
    };
    visitar(sf);
  }

  assert.ok(vistos >= 1,
    '🔴 el analizador no encuentra ni un uso de `tmpdir()` en scripts/. O desapareció el estado ' +
    'local del turno, o dejó de reconocer la forma: en los dos casos ha dejado de vigilar algo.');
  assert.deepEqual(hallazgos, [],
    '🔴 hay estado en una ruta fija del temporal, o sea compartida por TODA la máquina:\n\n' +
    hallazgos.map((h) => `      ${h}`).join('\n') + '\n\n' +
    '  Dos sesiones del mismo equipo se lo pisan. Con la nota del turno eso llegaba a que una\n' +
    '  soltara el turno VIVO de la otra. La ruta lleva `tokenDeSesion()`, o el directorio se\n' +
    '  crea con `mkdtemp` (único por llamada).');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// GUARD · un script que ningún test ejecuta no tiene red
// ═════════════════════════════════════════════════════════════════════════════════════════
//
// SCRUM-253 dejó `scripts/turno-staging.mjs` llamando a `dueñoActual()` SIN IMPORTARLO, y llegó
// así a `main`: `ReferenceError` al teclear `turno:tomar`, con la suite en 1196 verdes. Ningún
// test importa ese CLI —hacerlo lanzaría acciones contra staging—, así que no había nada que
// pudiera verlo. Este guard es estático: mira sin ejecutar.

// Residuo MEDIDO el 4-ago-2026 sobre 261 ficheros. Los dos son callbacks que corren DENTRO DEL
// NAVEGADOR y llegan a `page.evaluate` a través de un `waitFor` local, o sea indirectamente:
// reconocerlos pediría análisis entre funciones. No es una lista de excepciones y se comporta
// como el censo de SCRUM-267 — NO PUEDE CRECER, y si BAJA también falla, para que la mejora
// quede anotada en vez de pasar desapercibida.
const RESIDUO = { 'scripts/e2e-critico.mjs': 2 };

test('SCRUM-258 · SUELO: el analizador recorre los scripts de verdad', () => {
  const n = ficherosDe(RAIZ, 'scripts').length + ficherosDe(RAIZ, 'tests').length;
  assert.ok(n >= 200,
    `🔴 el barrido solo ve ${n} ficheros; se midieron 261 el 4-ago-2026. Un analizador que no ` +
    'recorre nada da «0 identificadores sueltos» y eso significa «no miré», no «está limpio».');
});

test('SCRUM-258 · ningún script usa un nombre que no existe', () => {
  const sueltos = [...barrer(RAIZ, 'scripts'), ...barrer(RAIZ, 'tests')];

  const porFichero = {};
  for (const s of sueltos) porFichero[s.fichero] = (porFichero[s.fichero] ?? 0) + 1;

  assert.deepEqual(porFichero, RESIDUO,
    '🔴 el censo de identificadores sin declarar ha cambiado:\n\n' +
    sueltos.map((s) => `      ${s.fichero}:${s.linea}  ${s.nombre}`).join('\n') + '\n\n' +
    '  Si SUBIÓ: alguien usa un nombre que no está importado ni declarado. Eso es un\n' +
    '  `ReferenceError` esperando a que alguien ejecute ese camino — y si es un script que\n' +
    '  ningún test ejecuta, la suite seguirá verde mientras el comando revienta. Pasó\n' +
    '  exactamente así en SCRUM-253.\n\n' +
    '  Si BAJÓ: enhorabuena, y actualiza el censo de arriba para que quede anotado.');
});
