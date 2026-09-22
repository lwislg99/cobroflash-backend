// scripts/censo-guards-gateados.mjs — SCRUM-754c
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ¿SOBRE CUÁNTOS GUARDS SE PUEDE EMITIR UN VEREDICTO HUECO?
//
// Un guard cuyos tests NO CORREN no está mudo ni vivo: no se ha mirado. Hasta SCRUM-754c el
// meta-guard no sabía distinguirlo —`node:test` emite `test:pass` para un test saltado, con
// `data.skip` puesto— así que la puerta abría sobre un test que no corrió, se mutaba, «seguía
// pasando», y salía MUDO. Eso ya está cerrado en el instrumento; esto CUENTA la superficie.
//
// 🔴 SE EJECUTAN LOS FICHEROS. No se deduce del fuente: un `{ skip: !ENABLED && '…' }` depende de
// una variable de entorno, y leerlo estáticamente diría lo que el código PODRÍA hacer, no lo que
// hace en esta máquina y con este entorno — que es justo la diferencia que importa, porque el
// job del meta-guard corre SIN BASE POR DISEÑO.
//
// ── LOS DOS NÚMEROS, Y NO SON EL MISMO ──────────────────────────────────────────────────────
//   ① GATEADOS ....... ficheros de test cuyos tests son TODOS saltados. Es la superficie: el
//                      sitio donde un veredicto hueco PODRÍA emitirse.
//   ② EXPUESTOS ...... de ésos, los que además llevan `MUTACIONES_QUE_ME_TUMBAN`. Es donde el
//                      veredicto hueco SE EMITE de verdad. Medido el 8-sep-2026: **cero**.
//
// Que ② sea cero hoy no hace decorativo a este censo: es un trinquete que se abre solo (patrón de
// SCRUM-537). El día que alguien declare una mutación en uno de los gateados, ② deja de ser cero
// y esto se pone ROJO — sin que nadie tenga que acordarse de mirar.
//
// ── SUELO ───────────────────────────────────────────────────────────────────────────────────
// Si ① sale CERO, el censo está roto: sabemos que hay gateados (los de `QA_DB_TEST`,
// `LIBRO_PG_URL`, `A55_DB_TEST`, `BOT_SUITE_TEST`). Un cero ahí es «no he sabido mirar», no «no
// hay», y sale CIEGO en vez de verde. Igual si no se ve ni un fichero.
//
// ⚠️ CUESTA LO QUE CUESTA: ejecuta la carpeta `tests/` entera, así que tarda del orden de la
// suite. Por eso NO está en `npm test` ni en `--solo-censo`: es un comando propio.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import { run } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ejecutadoDirectamente } from './_puerta-de-entrada.mjs';
import { censoDeDeclaraciones } from './meta-guard-mutaciones.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_TESTS = path.join(RAIZ, 'tests');

export const SALIDA_CIEGO = 2;
export const SALIDA_EXPUESTO = 1;

/**
 * Clasifica UN evento de `node:test`.
 *
 * 🔴 `test:pass` CON `skip` NO es un aprobado: es un test que no corrió. Y `test:fail` se deja en
 * paz aunque traiga `skip` — medido: `t.skip()` dentro del cuerpo no detiene la ejecución, así que
 * lo que sigue puede lanzar y eso es un fallo de verdad. Tratarlo como ceguera se tragaría rojos.
 */
export function clasificarEvento(ev) {
  if (ev.type === 'test:pass') return ev.data?.skip ? 'saltado' : 'real';
  if (ev.type === 'test:fail') return 'caido';
  return null;
}

/** Los `.test.mjs` del árbol. */
export function ficherosDeTest(dir = DIR_TESTS) {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort();
}

/** Ejecuta y devuelve, por fichero, cuántos tests corrieron de verdad y cuántos se saltaron. */
export async function medirGateados(ficheros) {
  const porFichero = new Map();
  const flujo = run({
    files: ficheros.map((f) => (path.isAbsolute(f) ? f : path.join(DIR_TESTS, f))),
    cwd: RAIZ,
    forceExit: true,
    timeout: 300000,
    concurrency: true,
  });
  for await (const ev of flujo) {
    const clase = clasificarEvento(ev);
    if (!clase) continue;
    const f = ev.data.file ? path.basename(ev.data.file) : '(sin fichero)';
    if (!porFichero.has(f)) porFichero.set(f, { reales: 0, saltados: 0 });
    const r = porFichero.get(f);
    if (clase === 'saltado') r.saltados++; else r.reales++;
  }
  return porFichero;
}

/** El veredicto del censo, en forma PURA para poder probarlo sin ejecutar la carpeta entera. */
export function veredictoDelCenso(porFichero, guardsConDeclaracion) {
  const vistos = [...porFichero.keys()];
  const gateados = [...porFichero.entries()]
    .filter(([, r]) => r.reales === 0 && r.saltados > 0)
    .map(([f, r]) => ({ fichero: f, saltados: r.saltados }));
  const expuestos = gateados.filter((g) => guardsConDeclaracion.has(g.fichero));

  if (vistos.length === 0) {
    return { ok: false, ciego: 'no se ha visto NI UN fichero de test. El censo no ha mirado nada.' };
  }
  if (gateados.length === 0) {
    return {
      ok: false,
      ciego: 'CERO ficheros con todos sus tests gateados. Eso no es «no hay»: el árbol tiene tests '
        + 'gateados por `QA_DB_TEST`, `LIBRO_PG_URL`, `A55_DB_TEST` y `BOT_SUITE_TEST`, así que un '
        + 'cero aquí significa que la clasificación no está viendo los saltos — que es exactamente '
        + 'el defecto que este censo viene a vigilar.',
    };
  }
  return { ok: true, vistos: vistos.length, gateados, expuestos };
}

async function principal() {
  const ficheros = ficherosDeTest();
  console.log(`censo de gateados · ejecutando ${ficheros.length} ficheros de \`tests/\`…`);
  const porFichero = await medirGateados(ficheros);

  const conDeclaracion = new Set(
    censoDeDeclaraciones().filter((c) => c.mutaciones.length).map((c) => c.guard),
  );
  const v = veredictoDelCenso(porFichero, conDeclaracion);

  if (!v.ok) {
    console.error(`\n🔴 CIEGO · ${v.ciego}`);
    process.exit(SALIDA_CIEGO);
  }

  console.log(`\nficheros vistos: ${v.vistos}`);
  console.log(`① GATEADOS (todos sus tests saltados): ${v.gateados.length}`);
  for (const g of v.gateados) console.log(`   · ${g.fichero} → ${g.saltados} saltado(s), 0 reales`);
  console.log(`\n② EXPUESTOS (gateados que ADEMÁS declaran mutaciones): ${v.expuestos.length}`);

  if (v.expuestos.length) {
    for (const e of v.expuestos) console.log(`   🔴 ${e.fichero}`);
    console.error('\n🔴 VEREDICTO HUECO EN CURSO: estos guards reciben un veredicto del meta-guard y '
      + 'sus tests NO CORREN en este entorno. Lo que salga sobre ellos no dice nada del guard.\n'
      + '   Desde SCRUM-754c el meta-guard los saca CIEGOS en vez de MUDOS, así que no mienten — '
      + 'pero siguen sin medirse. O se les da un test que corra sin base, o se retira su '
      + 'declaración: un guard que nadie puede juzgar no debería declarar que se le juzgue.');
    process.exit(SALIDA_EXPUESTO);
  }
  console.log('   ninguno. El meta-guard no está emitiendo ningún veredicto hueco.');
}

if (ejecutadoDirectamente(import.meta.url)) {
  principal().catch((e) => { console.error('🔴 CIEGO ·', e?.message || e); process.exit(SALIDA_CIEGO); });
}
