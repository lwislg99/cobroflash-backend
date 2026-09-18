// tests/scrum864c-el-temporal-no-vuelve.test.mjs — SCRUM-864c
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CIERRE EN ORIGEN QUE FALTABA: EL QUE IMPIDE QUE VUELVA
//
// SCRUM-864 convirtió 27 sitios el 16-sep-2026 y los dejó en cero. Un día después, el 17-sep,
// el censo encontró **dos llamadas nuevas** con el mismo defecto: `tests/scrum899b` (nacida en
// `373e9b1f`) y `docs/master/evidencias/SCRUM-866/censo-866.mjs` (en `820c224d`). Ninguna de las
// dos existía cuando aquel ticket midió.
//
// El motivo no es que nadie leyera el registro: es que **el censo no lo corría nadie**. Vivía en
// `docs/master/evidencias/scrum864/censo-mkdtemp.mjs`, que es la FOTO de aquella tanda. Cero
// citas suyas en `tests/` y en `scripts/`, comprobado. Convertir 27 sitios arregla 27 sitios; no
// impide que nazca el 28.
//
//     🔒 Una prohibición sin mecanismo es una frase.
//
// Esto es el mecanismo: el censo por AST corre EN LA TANDA y exige que las CUATRO categorías que
// dejan basura se queden en CERO.
//
//   ⚠️ NO GARANTIZADA — se borra, pero sólo por el camino feliz. Un `assert` que falla lo salta.
//   🔴 SIN LIMPIEZA ... — no se borra en ninguna parte.
//   ↗️ ESCAPA ........ — el directorio sale por un `return`: lo limpiaría el llamador.
//   ⚙️ FÁBRICA ....... — lo crea una fábrica: lo limpiaría quien la llama.
//
// ── POR QUÉ LAS DOS ÚLTIMAS TAMBIÉN, SI SCRUM-864 LAS DEJÓ FUERA CON BUEN ARGUMENTO ──────────
//
// Aquel ticket las declaró y no las tocó, y su razón era correcta: la limpieza es del llamador y
// acusar al fichero que las crea sería acusar al sitio equivocado — el falso positivo que ya se
// había comido su primer censo (34 acusados, 27 reales). Lo que nadie midió entonces es la
// consecuencia. El 17-sep-2026, contando TMPDIR en sólo lectura:
//
//   · 1.982 restos creados en veinticuatro horas, y **todos** de esas dos categorías:
//     `yaqu-182-` (una fábrica), `scrum861-`, `scrum723-`, `scrum846-`, `yaqu-853c-<pid>-`…
//   · y de las que SCRUM-864 SÍ convirtió, **ninguno**: `scrum385-` tenía 1.867 restos acumulados
//     y 0 nuevos; `scrum727-`, 749 acumulados y 0 nuevos.
//
// El mismo directorio, antes y después: donde se aplicó el mecanismo la fuga paró en seco. Así
// que «lo limpia el llamador» decía de quién era la responsabilidad, no lo que pasaba — el
// llamador no se acuerda. Y el arreglo no obliga a reestructurar a nadie: `temporal()` limpia sin
// que el llamador tenga que enterarse.
//
// ── LO QUE ESTE GUARD **NO** VE, dicho aquí en vez de prometido ──────────────────────────────
//
//   · **Un `SIGKILL` no ejecuta ningún manejador de salida**, así que un proceso matado a lo
//     bruto deja su directorio aunque use `temporal()`. Es el límite del mecanismo, no de esto.
//   · **Sólo ve lo que se llama `mkdtemp*`.** Un directorio hecho a mano con `mkdirSync` sobre
//     `os.tmpdir()` no pasa por aquí; de eso se ocupa el censo de SCRUM-824, que mira dónde se
//     CREA cada cosa.
//   · Un verde aquí dice que ninguna llamada NUEVA nace sin cierre. **No dice nada sobre los
//     restos ya acumulados en TMPDIR**, que no se tocan (ver `docs/master/SCRUM-864.md` §4).
//
// ⛔ No borra nada, no mira TMPDIR, no toca `src/`. Sin estado ni flag nuevos (27), sin
//    dependencias (36): `typescript` ya estaba en el árbol.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  censar, clasificaFuente, motivosParaNoFiarse, sinCierre, sinDueno, comoLinea, DECLARADAS,
} from '../scripts/_censo-mkdtemp.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NL = '\n';

// El rojo de cada pieza, declarado: lo ejecuta `npm run meta:mutaciones`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/_censo-mkdtemp.mjs',
    de: "    if (ts.isBlock(p) && p.parent && ts.isTryStatement(p.parent) && p.parent.finallyBlock === p) return 'finally';",
    a: '    if (false) return null;',
    cae: '🔴 ① CASO CONOCIDO: el censo distingue las cinco formas que le pongo delante, y no acusa a quien limpia',
  },
  // SCRUM-933: esta segunda nombraba el test ①, y con ella puesta ① seguía VERDE. Ninguno de sus
  // nueve casos borra una variable que no sea la del temporal, así que «cualquier borrado vale»
  // y «sólo vale el mío» le contestan lo mismo. La mata ①b, que existe para eso.
  {
    fichero: 'scripts/_censo-mkdtemp.mjs',
    de: "      if (!b.ids.has(d.nombre)) return false;",
    a: '      if (!b.ids.has(d.nombre)) return true;',
    cae: '🔴 ①b EL BORRADO DE OTRO NO ES EL MÍO: un finally que borra otra variable no cubre mi temporal',
  },
];

// ═══ ① EL CASO CONOCIDO ══════════════════════════════════════════════════════════════════════
//
// Entradas FABRICADAS cuya respuesta se sabe de antemano, porque un cero sin un caso conocido
// delante no se puede juzgar (SCRUM-846): no distingue «el árbol está limpio» de «el detector
// está roto». Y cada una lleva su mitad negativa: formas que el censo NO debe acusar.

const CASOS = [
  {
    espera: 'GARANTIZADA',
    porque: 'el borrado cuelga de un `finally`: si el cuerpo revienta, se borra igual',
    fuente: [
      "const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'caso-'));",
      'try { usar(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }',
    ],
  },
  {
    espera: 'GARANTIZADA',
    porque: 'un hook `after` del runner corre aunque el test falle',
    fuente: [
      "const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'caso-'));",
      'after(() => fs.rmSync(dir, { recursive: true, force: true }));',
    ],
  },
  {
    espera: 'GARANTIZADA',
    porque: "`process.on('exit')` corre también en `process.exit(n)`, que es como sale el runner",
    fuente: [
      "const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'caso-'));",
      "process.on('exit', () => fs.rmSync(dir, { recursive: true, force: true }));",
    ],
  },
  {
    espera: 'GARANTIZADA',
    porque: 'el nombre guarda una ruta DE DENTRO, y la limpieza correcta sube un nivel con `dirname`',
    fuente: [
      "const copia = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'caso-')), 'x.mjs');",
      'try { usar(copia); } finally { fs.rmSync(path.dirname(copia), { recursive: true, force: true }); }',
    ],
  },
  {
    espera: 'NO_GARANTIZADA',
    porque: 'se borra, pero por el camino feliz: un `assert` que falla se salta esa línea. ES EL DEFECTO',
    fuente: [
      "const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'caso-'));",
      'usar(dir);',
      'fs.rmSync(dir, { recursive: true, force: true });',
    ],
  },
  {
    espera: 'SIN_LIMPIEZA',
    porque: 'no se borra en ninguna parte del fichero',
    fuente: [
      "const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'caso-'));",
      'usar(dir);',
    ],
  },
  {
    espera: 'SIN_LIMPIEZA',
    porque: 'borrar el FICHERO de dentro no borra el directorio: contarlo como limpieza sería el falso negativo',
    fuente: [
      "const copia = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'caso-')), 'x.mjs');",
      'try { usar(copia); } finally { fs.rmSync(copia); }',
    ],
  },
  {
    espera: 'ESCAPA',
    porque: 'el directorio sale por un `return`: quien puede borrarlo es el llamador, no este fichero',
    fuente: [
      'function banco() {',
      "  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'caso-'));",
      '  return dir;',
      '}',
    ],
  },
  {
    espera: 'FABRICA',
    porque: 'una fábrica no nombra el directorio: lo nombra cada llamador, y allí se juzga',
    fuente: [
      "const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'caso-'));",
    ],
  },
];

test('SCRUM-864c · 🔴 ① CASO CONOCIDO: el censo distingue las cinco formas que le pongo delante, y no acusa a quien limpia', () => {
  const dichas = CASOS.map((c) => {
    const r = clasificaFuente('fabricado.mjs', c.fuente.join(NL));
    return { espera: c.espera, dice: r.length === 1 ? r[0].categoria : `🔴 ${r.length} llamadas, esperaba 1`, porque: c.porque };
  });
  assert.deepEqual(
    dichas.filter((d) => d.dice !== d.espera),
    [],
    '🔴 EL CENSO NO CLASIFICA LO QUE SE LE PONE DELANTE. Mientras esto no esté verde, el cero del test ③ no '
    + 'significa nada: no distinguiría «no hay restos» de «el detector está roto».',
  );

  // ── LA MITAD NEGATIVA ──────────────────────────────────────────────────────────────────────
  // Sin ella, un censo que dijera «sí» a todo pasaría los nueve casos de arriba.
  assert.deepEqual(clasificaFuente('vacio.mjs', "const x = 1;\nfs.rmSync('/tmp/loquesea');"), [],
    '🔴 el censo ACUSA a un fichero que no crea ningún temporal: contesta lo mismo a todo.');
  assert.deepEqual(clasificaFuente('mencion.mjs', "// aquí se habla de mkdtempSync y no se llama\nconst s = 'mkdtempSync';"), [],
    '🔴 el censo cuenta una MENCIÓN como una llamada: eso es lo que hace `grep`, y por eso esto va por AST.');
});

// ═══ ①b EL EMPAREJAMIENTO POR NOMBRE (SCRUM-933) ════════════════════════════════════════════
//
// El censo decide qué borrado es de qué temporal POR EL NOMBRE de la variable. Los nueve casos de
// ① no lo ponen a prueba: en todos, el único `rmSync` del fichero borra la variable del temporal.
// Así que un censo que aceptara CUALQUIER borrado como limpieza de CUALQUIER temporal los pasaba
// igual. Medido el 18-sep-2026: con `return false` → `return true` en el filtro de
// `scripts/_censo-mkdtemp.mjs`, `scrum864c` seguía 3/3 en verde y salía con 0.
//
// Y es la dirección peligrosa: un fichero que no borra su temporal pero borra OTRA cosa en un
// `finally` salía GARANTIZADO. El trinquete ③ tampoco podía verlo: esa mutación sólo quita
// acusaciones, y sobre un árbol que ya está en cero no hay ninguna que quitar.
//
// Los cuatro casos se diferencian en QUÉ variable borra el `finally`, nada más.

const DE_OTRO = [
  {
    espera: 'GARANTIZADA',
    porque: 'CONTROL: la misma forma borrando MI variable en el `finally`. Sin él, los SIN_LIMPIEZA de '
      + 'abajo podrían ser un censo que ya no reconoce el `finally` en esta forma',
    fuente: [
      "const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'caso-'));",
      'const otro = rutaDeOtraCosa();',
      'try { usar(dir, otro); } finally { fs.rmSync(dir, { recursive: true, force: true }); }',
    ],
  },
  {
    espera: 'SIN_LIMPIEZA',
    porque: 'el `finally` borra OTRA variable: mi temporal no se borra en ninguna parte',
    fuente: [
      "const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'caso-'));",
      'const otro = rutaDeOtraCosa();',
      'try { usar(dir, otro); } finally { fs.rmSync(otro, { recursive: true, force: true }); }',
    ],
  },
  {
    espera: 'NO_GARANTIZADA',
    porque: 'el mío se borra por el camino feliz; el `finally` que hay es de otro y no lo asciende',
    fuente: [
      "const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'caso-'));",
      'const otro = rutaDeOtraCosa();',
      'try { usar(dir, otro); } finally { fs.rmSync(otro, { recursive: true, force: true }); }',
      'fs.rmSync(dir, { recursive: true, force: true });',
    ],
  },
  {
    espera: 'SIN_LIMPIEZA',
    porque: 'el nombre guarda una ruta DE DENTRO y el `finally` sube con `dirname`… pero desde OTRA variable',
    fuente: [
      "const copia = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'caso-')), 'x.mjs');",
      'const otro = rutaDeOtraCosa();',
      'try { usar(copia, otro); } finally { fs.rmSync(path.dirname(otro), { recursive: true, force: true }); }',
    ],
  },
];

test('SCRUM-864c · 🔴 ①b EL BORRADO DE OTRO NO ES EL MÍO: un finally que borra otra variable no cubre mi temporal', () => {
  const dichas = DE_OTRO.map((c) => {
    const r = clasificaFuente('fabricado.mjs', c.fuente.join(NL));
    return { espera: c.espera, dice: r.length === 1 ? r[0].categoria : `🔴 ${r.length} llamadas, esperaba 1`, porque: c.porque };
  });
  assert.deepEqual(
    dichas.filter((d) => d.dice !== d.espera),
    [],
    '🔴 EL CENSO CUENTA COMO LIMPIEZA DE MI TEMPORAL EL BORRADO DE OTRA VARIABLE. Un fichero que no borra '
    + 'su directorio pero borra otra cosa en un `finally` saldría GARANTIZADO, y el trinquete ③ no lo '
    + 'vería nunca. Mira el filtro de `suyos` en `clasificaFuente` (`scripts/_censo-mkdtemp.mjs`).',
  );
});

// ═══ ② EL SUELO ══════════════════════════════════════════════════════════════════════════════

/** El 17-sep-2026 el censo miraba 1.763 ficheros y veía 81 llamadas con limpieza garantizada. */
const SUELO_FICHEROS = 1200;
const CENSO = censar(RAIZ);

test('SCRUM-864c · ② SUELO: el censo VE el árbol y DISTINGUE, así que su cero se puede leer', () => {
  assert.deepEqual(motivosParaNoFiarse(CENSO), [],
    '🔴 CIEGO: el censo no está en condiciones de afirmar nada sobre el árbol.');
  assert.ok(CENSO.ficheros >= SUELO_FICHEROS,
    `🔴 CIEGO: sólo ${CENSO.ficheros} ficheros mirados, y el 17-sep-2026 eran 1.763. El censo no está `
    + 'recorriendo el árbol: su cero del test ③ sería el de un instrumento que no ha mirado.');
  assert.equal(CENSO.declaradas.length, DECLARADAS.size,
    `🔴 las ${DECLARADAS.size} llamadas DECLARADAS con motivo ya no aparecen donde se declararon. Si el fichero `
    + 'cambió de sitio o de forma, la declaración está tapando otra cosa: revísala en `scripts/_censo-mkdtemp.mjs`.');
});

// ═══ ③ EL TRINQUETE ══════════════════════════════════════════════════════════════════════════

test('SCRUM-864c · 🔴 ③ NINGÚN temporal nuevo nace sin borrarse: las cuatro categorías de fuga = 0', () => {
  const fugas = [...sinCierre(CENSO), ...sinDueno(CENSO)];
  assert.deepEqual(fugas.map(comoLinea), [], [
    '',
    `🔴 HAY ${fugas.length} LLAMADA(S) A \`mkdtempSync\` QUE NO BORRAN SU DIRECTORIO PASE LO QUE PASE:`,
    '',
    ...fugas.map((f) => `      [${f.categoria}] ` + comoLinea(f)),
    '',
    '  QUÉ SIGNIFICA',
    '    · NO_GARANTIZADA / SIN_LIMPIEZA — o no se borra nunca, o sólo si todo sale bien, y entonces un',
    '      `assert` que falla se salta el borrado.',
    '    · ESCAPA / FABRICA — el directorio se va de esta función y su limpieza queda en manos del que lo',
    '      recibe. Medido el 17-sep-2026: el llamador NO se acuerda. Esas dos categorías eran el 100% de',
    '      los 1.982 restos que aparecieron en veinticuatro horas.',
    '    Medido el 16-sep-2026: 24.740 restos nuestros en TMPDIR, de 55.229 entradas. Crece solo.',
    '',
    '  CÓMO SE ARREGLA (una línea, no hace falta preguntar a nadie)',
    "    import { temporal } from './_temporal.mjs';        // desde scripts/: '../tests/_temporal.mjs'",
    "    const dir = temporal('scrum000-');                 // donde ponía fs.mkdtempSync(path.join(os.tmpdir(), …))",
    '    El helper lleva un registro en memoria y lo vacía al salir el proceso, así que vale igual en un test,',
    '    en un helper de módulo y en un script — sin envolver el cuerpo en un `try`.',
    '    Y vale IGUAL en una fábrica o en algo que devuelve el directorio: ahí está su gracia, que no',
    '    depende de que el llamador se acuerde. Si prefieres el `finally`, también cuenta; y un hook',
    "    `after` del runner, y `process.on('exit')` — pero sólo si están en el MISMO fichero que crea.",
    '',
    '  SI DE VERDAD HACE FALTA CONSERVARLO (para inspeccionar algo después)',
    '    Se DECLARA en `DECLARADAS` de `scripts/_censo-mkdtemp.mjs`, con el motivo al lado.',
    '    Un conservado sin declarar no es una decisión: es una fuga.',
    '',
    '  ⚠️ ESTE GUARD NO LO VE TODO: un SIGKILL no limpia nada, y sólo mira lo que se llama `mkdtemp*`.',
    '     Lo que no ve está escrito en la cabecera de este fichero.',
  ].join(NL));
});
