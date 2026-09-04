#!/usr/bin/env node
// scripts/meta-guard-mutaciones.mjs — SCRUM-745
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ¿PUEDE CADA GUARD DECLARAR LA MUTACIÓN QUE LO HACE CAER, Y ALGUIEN EJECUTARLAS?
//
// La pregunta nació de tres trinquetes escritos el mismo día que nacieron MUDOS: comparaban por
// TEXTO (`src.includes('nombreDeFuncion')`) en vez de por identidad, así que seguían VERDES sobre
// el defecto que venían a vigilar — el `import` y el comentario que explica la regla mantienen la
// palabra viva en el fichero aunque la llamada haya desaparecido.
//
// 🔴 Y LO IMPORTANTE: a los tres los encontró lo mismo, y no fue una revisión. Se leen
// perfectamente bien. Los encontró INYECTAR EL DEFECTO Y EXIGIR VER EL ROJO. Eso hoy depende de
// que a alguien se le ocurra hacerlo. Esto lo mecaniza.
//
// ── EN QUÉ SE DIFERENCIA DE SCRUM-719 (`censo:mudez`), que ya existe ─────────────────────────
// Aquél aplica UNA mutación uniforme —vaciar `soloEjecutable`— a los guards que llaman a ese
// filtro, y mide ceguera ante un fuente VACÍO. Medido: los guards de SCRUM-740 y SCRUM-741 no
// llaman al filtro, así que para su censo son «NO APLICA»: invisibles.
//
// Y el defecto es otro: el de aquí sobrevive con el fichero LLENO. Vaciar el fuente pondría
// rojos a estos guards (dirían «no encuentro»), o sea que saldrían VIVOS y sanos. Por eso hace
// falta una mutación POR GUARD: la única que caza a un guard es la que imita exactamente el
// defecto que ese guard promete cazar.
//
// ── EL CONTRATO ─────────────────────────────────────────────────────────────────────────────
// Un guard declara, en su propio fichero:
//
//     export const MUTACIONES_QUE_ME_TUMBAN = [
//       { fichero: 'tests/x.test.mjs', de: '<texto exacto>', a: '<texto exacto>',
//         cae: '<nombre del test que TIENE que ponerse rojo>' },
//     ];
//
// Vive junto al guard a propósito: un registro central se queda atrás en cuanto alguien mueve un
// guard, y lo que no vive al lado no se actualiza.
//
// 🔴 SE LEE POR AST, SIN IMPORTAR EL FICHERO. Importarlo ejecutaría sus tests, y un meta-guard
// que ejecuta lo que va a mutar se mete en su propia carrera.
//
// ⛔ LA MUTACIÓN NUNCA SE COMMITEA: se restaura en un `finally` y se VERIFICA byte a byte contra
// los bytes originales de disco. Si no cuadra, se sale con código 3 gritándolo. Es la disciplina
// de `censo-mudez.mjs` (SCRUM-719) y la de SCRUM-570: el árbitro son los bytes de disco, no el
// blob de git — un fichero normalizado tiene el blob limpio con CR en la copia de trabajo.
//
// SALIDAS: 0 todo vivo · 1 algún guard NO cayó (es mudo) · 2 no supe medir (ciego) · 3 no pude
// restaurar un fichero (grave: hay que mirar el árbol a mano).
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url'; // SCRUM-730: `pathname` no decodifica
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_TESTS = path.join(RAIZ, 'tests');

export const SALIDA_MUDO = 1;
export const SALIDA_CIEGO = 2;
export const SALIDA_NO_RESTAURADO = 3;

/**
 * Lee las mutaciones declaradas en un fichero, POR AST y sin ejecutarlo.
 *
 * Devuelve `[]` si no declara ninguna — no es un error: la mayoría de los guards todavía no lo
 * hacen, y este mecanismo se adopta guard a guard.
 */
export function mutacionesDeclaradas(codigo, nombre = 'x.mjs') {
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const out = [];
  const textoDe = (nodo) => (ts.isStringLiteralLike(nodo) ? nodo.text : null);

  const v = (n) => {
    if (ts.isVariableDeclaration(n) && n.name && ts.isIdentifier(n.name)
        && n.name.text === 'MUTACIONES_QUE_ME_TUMBAN' && n.initializer
        && ts.isArrayLiteralExpression(n.initializer)) {
      for (const el of n.initializer.elements) {
        if (!ts.isObjectLiteralExpression(el)) continue;
        const m = {};
        for (const p of el.properties) {
          if (!ts.isPropertyAssignment(p) || !p.name) continue;
          const clave = p.name.getText(sf).replace(/['"]/g, '');
          const valor = textoDe(p.initializer);
          if (valor !== null) m[clave] = valor;
        }
        if (m.fichero && m.de && typeof m.a === 'string' && m.cae) out.push(m);
      }
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  return out;
}

/** Todos los guards que declaran mutaciones, con las suyas. */
export function censoDeDeclaraciones(dir = DIR_TESTS) {
  const out = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.test.mjs'))) {
    const ms = mutacionesDeclaradas(fs.readFileSync(path.join(dir, f), 'utf8'), f);
    if (ms.length) out.push({ guard: f, mutaciones: ms });
  }
  return out;
}

/** ¿El test `nombre` aparece como FALLIDO en esta salida de `node --test`? */
export function cayo(salida, nombre) {
  // Se busca la línea de fallo del reporter, no la mención del nombre: el nombre aparece también
  // en la línea de la lista de tests que pasan.
  return salida.split('\n').some((l) => /^\s*(✖|not ok)/.test(l) && l.includes(nombre));
}

/** ¿El test `nombre` aparece como PASADO en esta salida de `node --test`? */
export function paso(salida, nombre) {
  return salida.split('\n').some((l) => /^\s*(✔|ok\s)/.test(l) && l.includes(nombre));
}

/**
 * 🔴 SCRUM-748 · LA LÍNEA BASE, Y POR QUÉ NO SE RECONOCE EL MENSAJE DE ERROR.
 *
 * Este meta-guard llamaba MUDO a todo lo que no caía, y eso metía por la misma puerta dos cosas
 * distintas: **«el guard no cayó»** y **«el guard no llegó a ejecutarse»**.
 *
 * Pasó en CI con `scrum748`. Su fichero llama a `cargarDashboard` en el top level, y el job no
 * compilaba, así que `_banco-vistas.mjs` no encontraba `dist/` y **el fichero entero moría antes
 * de registrar un solo test**. La línea `✖ <nombre>` nunca se imprimía, este script no la
 * encontraba, y dictaba MUDO sobre un guard que **con `dist/` presente cae con las dos
 * mutaciones**. El guard nunca estuvo mudo: mintió el rótulo.
 *
 * ⛔ Y NO SE ARREGLA RECONOCIENDO `Cannot find module` ni ninguna otra cadena de fallo. Un
 * detector que reconoce mensajes sólo sabe decir que no a lo que le enseñaron — es la lista negra
 * de siempre, y caduca con el primer fallo que nadie previó.
 *
 * SE ARREGLA POR LÍNEA BASE: antes de mutar nada se corre el fichero LIMPIO. Si el test que la
 * declaración nombra no aparece **en verde** ahí, no hay nada que juzgar y **ni siquiera se muta**:
 * es CIEGO. Los tres estados quedan separados por construcción y no porque alguien acierte un
 * texto.
 *
 * Y de propina cierra un caso que antes no se veía: una declaración que nombra un test
 * **renombrado o borrado** salía MUDA —acusaba al guard— y ahora sale CIEGA, que es lo que es.
 */
function correr(guard) {
  const r = spawnSync(process.execPath,
    ['--test', '--test-force-exit', '--test-reporter=spec', path.join(DIR_TESTS, guard)],
    { encoding: 'utf8', cwd: RAIZ, timeout: 300000 });
  return (r.stdout || '') + (r.stderr || '');
}

function aplicarUna(mut, guard, salidaLimpia) {
  const abs = path.join(RAIZ, mut.fichero);
  if (!fs.existsSync(abs)) return { ok: false, ciego: `el fichero \`${mut.fichero}\` no existe` };

  // 🔴 PUERTA 1 · ¿EXISTE EN VERDE LO QUE VAMOS A JUZGAR? Si el test que la declaración nombra no
  // pasó en la pasada limpia —porque el fichero no cargó, porque está renombrado, porque ya
  // fallaba— no hay nada que juzgar sobre él, y NI SIQUIERA SE MUTA.
  if (!paso(salidaLimpia, mut.cae)) {
    return {
      ok: false,
      ciego: `el test «${mut.cae}» NO aparece EN VERDE en la pasada limpia, así que no se ha `
        + 'mutado nada. O el fichero no llegó a ejecutarse (una dependencia que falta: '
        + '`dist/` sin compilar, por ejemplo), o ese test ya fallaba, o el nombre de la '
        + 'declaración caducó. NO es que el guard esté mudo: es que no se ha podido medir.',
    };
  }

  const ORIGINAL = fs.readFileSync(abs); // los BYTES de disco (SCRUM-570), no el blob
  const texto = ORIGINAL.toString('utf8');
  if (!texto.includes(mut.de)) {
    return { ok: false, ciego: `el ancla no está en \`${mut.fichero}\`: la declaración caducó` };
  }

  let resultado;
  try {
    fs.writeFileSync(abs, texto.replace(mut.de, mut.a));
    if (Buffer.compare(fs.readFileSync(abs), ORIGINAL) === 0) {
      return { ok: false, ciego: 'la mutación no cambió el fichero: no probaría nada' };
    }
    const salida = correr(guard);
    resultado = cayo(salida, mut.cae)
      ? { ok: true }
      : { ok: false, mudo: `el guard NO cayó. Test que debía ponerse rojo: «${mut.cae}»` };
  } finally {
    fs.writeFileSync(abs, ORIGINAL);
    if (Buffer.compare(fs.readFileSync(abs), ORIGINAL) !== 0) {
      console.error(`🔴🔴 NO PUDE RESTAURAR \`${mut.fichero}\`. MÍRALO A MANO ANTES DE SEGUIR.`);
      process.exit(SALIDA_NO_RESTAURADO);
    }
  }
  return resultado;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('meta-guard-mutaciones.mjs')) {
  const censo = censoDeDeclaraciones();
  if (!censo.length) {
    console.error('🔴 CIEGO: ningún guard declara mutaciones. No he medido nada.');
    process.exit(SALIDA_CIEGO);
  }
  const mudos = [];
  const ciegos = [];
  let vivas = 0;
  for (const { guard, mutaciones } of censo) {
    // La línea base se corre UNA VEZ por guard, no por mutación: es la misma pasada limpia para
    // todas las suyas y duplicarla sólo costaría reloj.
    const salidaLimpia = correr(guard);
    for (const mut of mutaciones) {
      const r = aplicarUna(mut, guard, salidaLimpia);
      if (r.ok) { vivas += 1; console.log(`  ✔ ${guard} · ${mut.cae}`); }
      else if (r.mudo) { mudos.push(`${guard} · ${r.mudo}`); console.log(`  ✖ ${guard} · MUDO`); }
      else { ciegos.push(`${guard} · ${r.ciego}`); console.log(`  ? ${guard} · CIEGO`); }
    }
  }
  console.log(`\nvivas ${vivas} · mudas ${mudos.length} · ciegas ${ciegos.length}`);
  if (ciegos.length) console.error('🔴 CIEGO:\n  · ' + ciegos.join('\n  · '));
  if (mudos.length) {
    console.error('🔴 GUARDS MUDOS — pasan en verde sobre el defecto que dicen vigilar:\n  · '
      + mudos.join('\n  · '));
    process.exit(SALIDA_MUDO);
  }
  if (ciegos.length) process.exit(SALIDA_CIEGO);
}
