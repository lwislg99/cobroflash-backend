// tests/scrum534d-extractores-a-mano.test.mjs — SCRUM-534d
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL MISMO DEFECTO, EN DOS INSTRUMENTOS, CON DOS MESES DE DIFERENCIA.
//
// `docs/master/SCRUM-718.md:49`, del 6-sep-2026, lo dejó escrito para su censo:
//
//   >>> «la ruta real es `docs/Sprint Scrum/…` y **mi clase de caracteres no admitía el espacio**,
//   >>> así que la cortaba en "docs/Sprint"» <<<
//
// El 16-sep-2026, el censo de documentos citados (SCRUM-534b) **nació con el mismo fallo**: cortaba
// `docs/Srpint Scrum/…` por la mitad y acusaba de fantasma a un trozo de una cita perfecta.
//
// 🔒 **Un defecto que reaparece en otro instrumento no es mala suerte: es que nadie lo tenía
// atado.** Escribirlo dentro del módulo ayuda a quien abre ese módulo; no impide que el siguiente
// censo se escriba a mano con la misma clase de caracteres.
//
// ── QUÉ MIDE, Y POR QUÉ ESA UNIDAD ─────────────────────────────────────────────────────────
//
// Los **extractores de rutas `.md` escritos a mano**: una expresión regular que saca un `.md` con
// su ruta de dentro de un texto, en un fichero que **no usa el módulo compartido**. No se persigue
// el defecto concreto (el espacio), se persigue **la duplicación que lo hace posible**: mientras
// haya extractores sueltos, cada uno tendrá sus propios agujeros y habrá que descubrirlos de uno
// en uno. El agujero del espacio se mide ADEMÁS, y sólo para probar que el instrumento ejecuta de
// verdad la expresión que dice estar mirando.
//
// ⚠️ NO es «prohibido usar expresiones regulares con .md». El módulo compartido tiene la suya —es
// la única que debe existir— y este guard la reconoce como la fuente, no como una infracción.
//
// ── 🔴 CÓMO SE DECIDE QUÉ ES UN EXTRACTOR: POR SONDA, NO POR LA FORMA DEL TEXTO ────────────
//
// Las dos primeras versiones de este criterio miraban **cómo estaba escrita** la expresión, y las
// dos se equivocaron contra el árbol de verdad:
//
//   ① «cualquier expresión que nombre un .md» → 17 acusados, y casi todos eran filtros de NOMBRE:
//      validan cómo se llama un fichero que ya se tiene, leyendo un `readdir`. **No pueden cortar
//      por un espacio, porque no leen prosa.**
//   ② «la que lleve la barra dentro de una clase de caracteres» → 0 acusados, y el cero era
//      falso: la expresión ARREGLADA de hoy lleva la barra FUERA de la clase, así que el criterio
//      no reconocía ni al propio módulo compartido. **Un criterio que no ve la versión buena
//      tampoco habría visto la mala si se hubiera escrito con otra forma.**
//
// Es, otra vez, un detector que sólo ve la forma que su autor tenía en la cabeza — el mismo
// defecto que este guard viene a impedir, cometido al escribirlo.
//
//   >>> Por eso ahora no se mira el texto de la expresión: SE EJECUTA contra dos sondas. <<<
//
// Es extractor de rutas quien, corriendo sobre `docs/SprintScrum/X.md`, devuelve una ruta CON
// barra. Y admite el espacio quien, corriendo sobre `docs/Sprint Scrum/X.md`, la devuelve entera.
// Eso no depende de cómo esté escrita, y es la misma pregunta dentro de seis meses.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * El commit que ARREGLÓ el extractor (SCRUM-534c, 16-sep-2026). Su PADRE lleva la versión que
 * nació rota. Se guarda el del arreglo y no el del padre a propósito: el arreglo es lo que se
 * encuentra en `git log`, y el padre se deriva con `^` sin copiar un segundo SHA a mano.
 */
export const COMMIT_DEL_ARREGLO = 'a79a6b29';

/** `git`, o `null` si no se puede preguntar. Ese `null` NO es una respuesta: quien lo recibe decide. */
function git(args) {
  try {
    return execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

/** El módulo compartido: la única expresión que debe existir. */
export const MODULO = 'scripts/_documentos-citados.mjs';

/** La población declarada. Un censo sin población declarada no es un censo. */
export const POBLACION = Object.freeze([{ dir: 'tests', ext: '.mjs' }, { dir: 'scripts', ext: '.mjs' }]);

/**
 * Las dos mutaciones que tienen que tumbar este guard (SCRUM-745).
 *
 * Las dos tocan el MÓDULO y no este fichero, y es a propósito: una declaración que mutara su
 * propio test se encontraría a sí misma —el texto de `de` vive también dentro de la declaración—
 * y la sustitución caería en la declaración en vez de en el código. Es SCRUM-349 con otra ropa.
 */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Reabrir el agujero de SCRUM-718: la expresión deja de admitir el espacio.
    fichero: 'scripts/_documentos-citados.mjs',
    de: '(?: [A-Z][\\w.-]*)+',
    a: '',
    cae: 'SCRUM-534d · 🔴 MUTACIÓN: quitar el espacio de la expresión reabre el agujero, y ENTRA',
  },
  {
    // Quitarle la barra: deja de ser un extractor de RUTAS y pasa a ser un filtro de nombre. El
    // censo se queda sin módulo que reconocer y tiene que decir CIEGO, no «0 malos».
    fichero: 'scripts/_documentos-citados.mjs',
    de: '|[\\w.-]+)\\/)*',
    a: '|[\\w.-]+))*',
    cae: 'SCRUM-534d · 🔴 ningún extractor de rutas .md se escribe A MANO',
  },
];

/**
 * Las dos sondas: el defecto de SCRUM-718 escrito como DATO, no como opinión sobre una expresión.
 * Van con texto alrededor a propósito — un extractor de prosa tiene que encontrar la ruta DENTRO
 * de una frase, que es justo lo que un filtro de nombre anclado no hace.
 */
export const SONDA_SIN_ESPACIO = 'Ver docs/SprintScrum/X.md ahora';
export const SONDA_CON_ESPACIO = 'Ver docs/Sprint Scrum/X.md ahora';

const BARRA_INV = '\\';

/**
 * Los literales de expresión regular del fichero, con su línea.
 *
 * Se leen carácter a carácter y no con otra expresión regular, por dos motivos medidos: una barra
 * dentro de una clase de caracteres NO cierra el literal, y una barra escapada tampoco. Un `grep`
 * se los come y devuelve medio literal, que luego no compila y acaba contado como «no
 * clasificado» — ruido inventado por el instrumento.
 *
 * ⚠️ ALCANCE DECLARADO: se reconocen los literales que abren tras `=`, `(`, `,` o `:`. Con sólo
 * `=` —la primera versión— el censo veía 9 literales y UN extractor; abriendo a los otros tres ve
 * 20 y DOS, y el segundo era de verdad: `scrum242` extraía inline dentro de un `matchAll(…)`. Lo
 * que quede fuera de esas cuatro aperturas no está medido, y por eso el veredicto de un fichero
 * sin literales reconocibles no es «está bien»: es que no entra en población.
 */
export function literalesRegex(fuente) {
  const fuera = [];
  const lineas = fuente.split('\n');
  for (let n = 0; n < lineas.length; n++) {
    const l = lineas[n];
    for (const m of l.matchAll(/[=(,:]\s*\//g)) {
      let i = m.index + m[0].length;
      let dentroClase = false;
      let cuerpo = '';
      for (; i < l.length; i++) {
        const c = l[i];
        if (c === BARRA_INV) { cuerpo += c + (l[i + 1] || ''); i++; continue; }
        if (c === '[') dentroClase = true;
        else if (c === ']') dentroClase = false;
        else if (c === '/' && !dentroClase) break;
        cuerpo += c;
      }
      if (i >= l.length) continue;          // no cierra en esta línea: no es un literal
      const flags = (l.slice(i + 1).match(/^[gimsuy]*/) || [''])[0];
      fuera.push({ linea: n + 1, cuerpo, flags, texto: l.trim() });
    }
  }
  return fuera;
}

/** Lo que la expresión saca de la sonda, o `null` si no se puede compilar ni ejecutar. */
function casar(lit, sonda) {
  let re;
  try {
    re = new RegExp(lit.cuerpo, lit.flags.replace(/g/g, '') + 'g');
  } catch {
    return null;
  }
  try {
    return [...sonda.matchAll(re)].map((x) => x[1] || x[0]);
  } catch {
    return null;
  }
}

/**
 * Los literales del fichero que SE COMPORTAN como extractores de rutas `.md`.
 *
 * El veredicto lo da la sonda: sacar de una frase algo que lleva barra y termina en `.md`. Un
 * filtro de nombre anclado no saca nada de una frase, y uno de sufijo saca el `.md` sin barra.
 * Ninguno de los dos puede tener el agujero de SCRUM-718, y acusarlos sería pedirles que deleguen
 * en un módulo que no les sirve de nada.
 */
export function extractoresDeRutas(fuente) {
  const fuera = [];
  for (const lit of literalesRegex(fuente)) {
    if (!lit.cuerpo.includes('.md')) continue;
    const sin = casar(lit, SONDA_SIN_ESPACIO);
    if (sin === null) { fuera.push({ ...lit, compila: false, admiteEspacio: null }); continue; }
    if (!sin.some((x) => x.includes('/') && x.endsWith('.md'))) continue;   // filtro de nombre
    const con = casar(lit, SONDA_CON_ESPACIO) || [];
    fuera.push({ ...lit, compila: true, admiteEspacio: con.some((x) => x.includes('Sprint Scrum')) });
  }
  return fuera;
}

/**
 * ¿Los extractores de este fichero admiten un ESPACIO dentro de un segmento de ruta?
 *
 * `null` cuando el fichero no define ninguno — y ese `null` NO es «está bien»: quien lo recibe
 * tiene que decidir, y aquí se decide contarlo del lado malo. Con varios, manda el peor: basta uno
 * que corte para que el fichero corte.
 */
export function admiteEspacio(fuente) {
  const ex = extractoresDeRutas(fuente).filter((x) => x.compila);
  if (ex.length === 0) return null;
  return ex.every((x) => x.admiteEspacio === true);
}

/** ¿El fichero se apoya en el módulo compartido en vez de extraer por su cuenta? */
const USA_EL_MODULO = /_documentos-citados|citasPorLinea|citasNormalizadas/;

/**
 * Los extractores de rutas `.md` del árbol, con su veredicto.
 *
 * 🔴 EL CUBO `NO_CLASIFICADO` VA DEL LADO MALO, y es deliberado: si el criterio no alcanza a un
 * fichero —un literal que no compila, y por tanto no se puede sondar—, el censo **no puede decir
 * que está bien**. Contarlo como sano sería exactamente la clase de cero que aquí se persigue.
 */
export function censar(raiz = RAIZ) {
  const filas = [];
  for (const { dir, ext } of POBLACION) {
    const abs = path.join(raiz, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) {
      if (!f.endsWith(ext)) continue;
      const rel = `${dir}/${f}`;
      const fuente = fs.readFileSync(path.join(abs, f), 'utf8');
      const ex = extractoresDeRutas(fuente);
      if (ex.length === 0) continue;                         // no extrae rutas: fuera de población
      const esElModulo = rel === MODULO;
      const delega = USA_EL_MODULO.test(fuente) && !esElModulo;
      const sinCompilar = ex.some((x) => !x.compila);
      filas.push({
        fichero: rel,
        lineas: ex.map((x) => x.linea),
        esElModulo,
        delega,
        admiteEspacio: admiteEspacio(fuente),
        // Sano: el módulo, o quien delega en él. Lo demás es un extractor suelto.
        veredicto: esElModulo ? 'MODULO'
          : (sinCompilar ? 'NO_CLASIFICADO' : (delega ? 'DELEGA' : 'A_MANO')),
      });
    }
  }
  return {
    poblacion: filas.length,
    filas,
    modulo: filas.filter((x) => x.veredicto === 'MODULO'),
    delegan: filas.filter((x) => x.veredicto === 'DELEGA'),
    aMano: filas.filter((x) => x.veredicto === 'A_MANO'),
    noClasificados: filas.filter((x) => x.veredicto === 'NO_CLASIFICADO'),
  };
}

// ═══ PATA 1 · 🔴 ROJO REAL: encuentra el extractor roto sin que se lo digan ══════════════════

test('SCRUM-534d · 🔴 ROJO REAL: reconoce el extractor ROTO —la versión anterior— sin nombrarlo', () => {
  // 🔴 LA VERSIÓN ROTA NO SE ESCRIBE A MANO: SE SACA DE GIT. Copiarla en una cadena obliga a
  // reescaparla, y ahí se pierde justo lo que se quiere medir — pasó al construir esto: los
  // escapes se perdían y el control acabó evaluando una expresión que no existió nunca.
  const antes = git(['show', `${COMMIT_DEL_ARREGLO}^:${MODULO}`]);
  const ahora = git(['show', `${COMMIT_DEL_ARREGLO}:${MODULO}`]);
  assert.ok(antes && ahora,
    '🔴 CIEGO: git no devuelve las dos versiones del módulo. El control no ha medido nada, y eso '
    + 'no es lo mismo que haber medido bien. Necesita la historia completa (`fetch-depth: 0`).');

  assert.equal(admiteEspacio(antes), false,
    '🔴 NO RECONOCE EL EXTRACTOR ROTO. Es la expresión con la que nació el censo de la fase b — la '
    + 'que cortaba `docs/Srpint Scrum/…` por la mitad—, sacada de git, no reescrita. Si el guard no '
    + 'la ve, no ve el defecto que viene a impedir.');
  assert.equal(admiteEspacio(ahora), true,
    '🔴 tampoco distingue la versión ARREGLADA: entonces su veredicto no depende del espacio y este '
    + 'control no mide lo que dice medir.');
});

// ═══ PATA 2 · ✅ VERDE REAL: no salta con el módulo compartido bien usado ════════════════════

test('SCRUM-534d · ✅ VERDE REAL: acusa al suelto y RESPETA al que delega, en la misma pasada', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum534d-'));
  try {
    fs.mkdirSync(path.join(dir, 'tests'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
    // El módulo compartido, con su expresión: es la fuente, no una infracción.
    fs.writeFileSync(path.join(dir, 'scripts', '_documentos-citados.mjs'),
      ['export const CITA = /((?:[A-Za-z0-9_.-]+(?: [A-Za-z0-9_.-]+)*\\/)+[A-Za-z0-9_.-]+\\.md)/g;', ''].join('\n'));
    // ① EL USO CORRECTO: pide las citas al módulo y no tiene expresión propia. Queda FUERA de
    //    población —no es un extractor—, que es distinto de «aprobado»: no se le juzga.
    fs.writeFileSync(path.join(dir, 'tests', 'bueno.test.mjs'),
      ["import { citasPorLinea } from '../scripts/_documentos-citados.mjs';",
        'export const usa = (t) => citasPorLinea(t).citas;', ''].join('\n'));
    // ② EL MIXTO: se apoya en el módulo y ADEMÁS arrastra una expresión vieja. Se le cuenta como
    //    DELEGA, que es generoso a propósito y por eso se dice: el criterio no puede saber cuál de
    //    las dos usa de verdad, y un guard que acusa por la duda acaba silenciado.
    fs.writeFileSync(path.join(dir, 'tests', 'mixto.test.mjs'),
      ["import { citasNormalizadas } from '../scripts/_documentos-citados.mjs';",
        'const VIEJA = /(docs\\/[A-Za-z0-9_/-]+\\.md)/g;',
        'export const x = [citasNormalizadas, VIEJA];', ''].join('\n'));
    // ③ EL SUELTO, que extrae por su cuenta: el censo tiene que verlo en la misma pasada. Sin este
    //    fichero, un «0 A MANO» no distinguiría «no hay» de «no mira».
    fs.writeFileSync(path.join(dir, 'tests', 'malo.test.mjs'),
      ['const RE = /(docs\\/[A-Za-z0-9_/-]+\\.md)/g;', 'export const re = RE;', ''].join('\n'));

    const c = censar(dir);
    assert.equal(c.modulo.length, 1, '🔴 no reconoce al módulo compartido como la fuente.');
    assert.deepEqual(c.aMano.map((x) => x.fichero), ['tests/malo.test.mjs'],
      `🔴 el censo no acusa SÓLO al extractor suelto: ${JSON.stringify(c.aMano.map((x) => x.fichero))}. `
      + 'Si le falta, su cero en el árbol de verdad no significa «no hay» sino «no mira»; si le '
      + 'sobra, está marcando el uso correcto y se apagará en una semana, con razón.');
    assert.deepEqual(c.delegan.map((x) => x.fichero), ['tests/mixto.test.mjs'],
      `🔴 el MIXTO no sale como DELEGA: ${JSON.stringify(c.delegan.map((x) => x.fichero))}.`);
    assert.equal(c.filas.some((x) => x.fichero === 'tests/bueno.test.mjs'), false,
      '🔴 el que usa el módulo SIN expresión propia ha entrado en población. No es un extractor: '
      + 'meterlo infla el denominador y hace que el porcentaje de sanos parezca mérito del guard.');
    assert.deepEqual(c.noClasificados, [], '🔴 hay no clasificados en un banco que no los tiene.');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ═══ PATA 3 · 🔴 SUELO: cero extractores es CIEGO, no «cero malos» ═══════════════════════════

test('SCRUM-534d · 🔴 SUELO: con CERO extractores aborta CIEGO, no informa «0 malos»', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum534d-vacio-'));
  try {
    fs.mkdirSync(path.join(dir, 'tests'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'tests', 'x.test.mjs'), 'export const nada = 1;\n');
    const c = censar(dir);
    assert.equal(c.poblacion, 0, '🔴 inventa extractores donde no los hay.');
    // El guard del árbol real (abajo) exige población > 0 ANTES de dar veredicto. Aquí se
    // comprueba que ese cero es distinguible: `poblacion 0` y `aMano 0` NO son lo mismo.
    assert.deepEqual(c.aMano, [],
      '🔴 con población cero debería no haber veredicto que dar, ni bueno ni malo.');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ═══ PATA 4 · 🔴 MUTACIÓN, y se comprueba que MUTÓ ══════════════════════════════════════════

test('SCRUM-534d · 🔴 MUTACIÓN: quitar el espacio de la expresión reabre el agujero, y ENTRA', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, MODULO), 'utf8');
  assert.equal(admiteEspacio(fuente), true,
    '🔴 el módulo compartido de HOY ya no admite el espacio: o se ha revertido el arreglo de la '
    + 'fase c, o este guard ha dejado de leer la expresión correcta.');

  // La mutación: se le quita el tramo que admite el espacio. El ancla se comprueba ANTES —una
  // sustitución que no entra y un guard que no detecta dan exactamente la misma salida.
  const DE = '(?: [A-Z][' + BARRA_INV + 'w.-]*)+';
  const veces = fuente.split(DE).length - 1;
  assert.equal(veces, 1,
    `🔴 LA MUTACIÓN NO PUEDE ENTRAR: el ancla «${DE}» aparece ${veces} veces y debe aparecer `
    + 'exactamente 1.');
  const mutado = fuente.replace(DE, '');
  assert.notEqual(mutado, fuente, '🔴 la sustitución no ha cambiado el texto: no ha mutado nada.');

  assert.equal(admiteEspacio(mutado), false,
    '🔴 CON EL ESPACIO QUITADO, EL GUARD SIGUE DICIENDO QUE ESTÁ BIEN. Entonces no está mirando la '
    + 'propiedad que dice mirar, y el agujero de SCRUM-718 podría volver sin que nadie lo note.');
});

// ═══ EL GUARD DEL ÁRBOL REAL, con su población declarada ════════════════════════════════════

test('SCRUM-534d · 🔴 ningún extractor de rutas .md se escribe A MANO', (t) => {
  const c = censar();

  // 🔴 SUELO: cero extractores es ceguera, no salud. El módulo compartido existe, así que el
  // censo tiene que ver al menos uno.
  assert.ok(c.poblacion > 0,
    '🔴 CIEGO: el censo no ha encontrado NINGÚN extractor de rutas .md en todo el árbol, y el '
    + 'módulo compartido tiene uno. «0 extractores» y «0 malos» se leen igual y significan lo '
    + 'contrario.');
  assert.equal(c.modulo.length, 1,
    `🔴 CIEGO: el módulo compartido no está entre los ${c.poblacion} extractores vistos. El censo `
    + 'mira donde no es.');

  t.diagnostic(`población: ${c.poblacion} ficheros con extractor de rutas · ${c.modulo.length} módulo · `
    + `${c.delegan.length} delegan · ${c.aMano.length} A MANO · ${c.noClasificados.length} no clasificados`);
  for (const f of c.filas) {
    t.diagnostic(`  ${f.veredicto.padEnd(15)} ${f.fichero}:${f.lineas.join(',')} · admite espacio: ${f.admiteEspacio}`);
  }

  // 🔴 Los NO CLASIFICADOS cuentan del lado malo: no poder decidir no es poder aprobar.
  const malos = [...c.aMano, ...c.noClasificados];
  assert.deepEqual(malos.map((x) => `${x.fichero} (${x.veredicto})`), [],
    '🔴 HAY EXTRACTORES DE RUTAS .md ESCRITOS A MANO:\n    '
    + malos.map((x) => `${x.fichero}:${x.lineas.join(',')} — ${x.veredicto}`).join('\n    ')
    + '\n\n  Cada extractor suelto tiene sus propios agujeros, y hay que descubrirlos de uno en\n'
    + '  uno. Pasó: SCRUM-718 documentó en septiembre que su clase de caracteres no admitía el\n'
    + '  espacio, y dos meses después el censo de SCRUM-534b nació con el mismo fallo.\n\n'
    + `  Se arregla usando \`${MODULO}\` —\`citasPorLinea\` y \`citasNormalizadas\`— en vez de\n`
    + '  escribir la expresión otra vez. Si ese módulo no sirve para tu caso, amplíalo ahí: es\n'
    + '  el sitio donde el arreglo le llega a todos.');
});
