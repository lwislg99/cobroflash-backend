// tests/scrum1349-entorno-prestado-solo-baja.test.mjs — SCRUM-1349
//
// LA LISTA DE LOS QUE PRESTAN EL ENTORNO A SU HIJO SOLO PUEDE BAJAR
//
// `scripts/_censo-entorno-prestado.mjs` (SCRUM-1153, SCRUM-1289b) cuenta los `node` hijos que
// heredan FORCE_COLOR / NODE_OPTIONS / NODE_TEST_CONTEXT. Era INFORMATIVO: ningún test exigía
// nada, así que nada impedía que entrara uno nuevo. Aquí se declaran los de hoy uno a uno, con
// dueño y motivo (`scripts/_entorno-prestado-declarados.json`), y se exige que el árbol tenga
// EXACTAMENTE esos: uno nuevo es un rojo; uno arreglado obliga a borrar su entrada.
//
// 🔴 Y EL CENSO SE PRUEBA EN LOS DOS SENTIDOS. El 1-oct-2026 acusó a tres bancos que estaban
// limpios: borraban las tres variables con un `for…of` y el censo solo reconocía el `delete`
// escrito a mano. Las cegueras anteriores iban todas hacia «no vi nada»; ésta va al revés —«no
// reconozco cómo lo hiciste» salía como «lo hiciste mal»— y manda a alguien a arreglar lo que
// funciona. Por eso cada control positivo de abajo tiene su pareja: acusa al sucio Y no acusa al
// limpio escrito de otra forma.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  clasificaFuente, censar, motivosParaNoFiarse, contraDeclarados, comoLinea, NO_RESPONDE_DE,
} from '../scripts/_censo-entorno-prestado.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTA_DECLARADOS = path.join(RAIZ, 'scripts', '_entorno-prestado-declarados.json');

/** Lee la lista. No hay valor por defecto: si no se lee o una entrada viene coja, lanza. */
function declarados() {
  const json = JSON.parse(fs.readFileSync(RUTA_DECLARADOS, 'utf8'));
  const f = json.ficheros;
  assert.ok(f && typeof f === 'object' && !Array.isArray(f), '🔴 falta `ficheros` en la lista de declarados');
  for (const [fichero, d] of Object.entries(f)) {
    assert.ok(Number.isInteger(d.llamadas) && d.llamadas > 0,
      `🔴 «${fichero}»: \`llamadas\` tiene que ser un entero mayor que 0 (una entrada que llega a 0 se BORRA)`);
    assert.ok(typeof d.dueno === 'string' && /^[SJ]\d$/.test(d.dueno), `🔴 «${fichero}»: sin dueño (S0…S5, J1…J6)`);
    assert.equal(typeof d.confirmado, 'boolean', `🔴 «${fichero}»: \`confirmado\` tiene que decir true o false`);
    assert.ok(typeof d.motivo === 'string' && d.motivo.length > 20, `🔴 «${fichero}»: el motivo no dice nada`);
  }
  return f;
}

// Un hijo que corre `node --test` con el entorno construido de la forma `limpieza`.
const conLimpieza = (limpieza) => [
  "import { spawnSync } from 'node:child_process';",
  'export function medir(ruta) {',
  '  const entorno = { ...process.env };',
  `  ${limpieza}`,
  "  const r = spawnSync(process.execPath, ['--test', ruta], { cwd: '.', encoding: 'utf8', env: entorno });",
  '  return r.status;',
  '}',
].join('\n');

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① EL CENSO, EN LOS DOS SENTIDOS
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1349 · ✅ NO ACUSA A UN LIMPIO: borrar las tres en un `for…of` sobre una lista literal es limpiar', () => {
  const h = clasificaFuente('fabricado.mjs',
    conLimpieza("for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];"));
  assert.equal(h.length, 1, '🔴 el censo no ve la llamada: este caso no prueba nada');
  assert.equal(h[0].acusado, false, `🔴 FALSO ACUSADO, el del 1-oct-2026: ${comoLinea(h[0])}`);
  assert.equal(h[0].envClase, 'A_MANO');
});

test('SCRUM-1349 · 🔴 SIGUE ACUSANDO AL SUCIO: el mismo bucle con DOS de las tres dice cuál falta', () => {
  const h = clasificaFuente('fabricado.mjs',
    conLimpieza("for (const k of ['FORCE_COLOR', 'NODE_TEST_CONTEXT']) delete entorno[k];"));
  assert.equal(h.length, 1);
  assert.equal(h[0].acusado, true, '🔴 el arreglo del bucle se ha pasado: da por limpio a quien deja NODE_OPTIONS');
  assert.equal(h[0].envClase, 'SPREAD_A_MEDIAS');
  assert.deepEqual(h[0].faltan, ['NODE_OPTIONS']);
});

test('SCRUM-1349 · 🔴 SIGUE ACUSANDO AL SUCIO: sin ninguna limpieza, las tres', () => {
  const h = clasificaFuente('fabricado.mjs', conLimpieza('// nada'));
  assert.equal(h[0].acusado, true);
  assert.equal(h[0].envClase, 'SPREAD_SIN_LIMPIAR');
  assert.deepEqual(h[0].faltan, ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']);
});

test('SCRUM-1349 · 🔴 lo que no se puede LEER no limpia: una lista que no es literal, o un bucle sobre otra variable', () => {
  const noLiteral = clasificaFuente('fabricado.mjs',
    conLimpieza('for (const k of LISTA_QUE_VIENE_DE_FUERA) delete entorno[k];'));
  assert.equal(noLiteral[0].acusado, true, '🔴 da por limpia una lista que no ha podido leer');
  const otraVariable = clasificaFuente('fabricado.mjs',
    conLimpieza("for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete otroObjeto[k];"));
  assert.equal(otraVariable[0].acusado, true, '🔴 da por limpio a `entorno` porque se borró de OTRO objeto');
  const claveSuelta = clasificaFuente('fabricado.mjs',
    conLimpieza("for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[otra];"));
  assert.equal(claveSuelta[0].acusado, true, '🔴 da por limpio un `delete` cuya clave no es la variable del bucle');
});

test('SCRUM-1349 · ✅ CONTROL REAL: los tres bancos del 1-oct-2026 salen limpios leídos del árbol', () => {
  const BANCOS = ['tests/banco-scrum1102f/mutar.mjs', 'tests/banco-scrum1322/mutar.mjs', 'tests/banco-scrum1329/mutar.mjs'];
  const vivos = BANCOS.filter((b) => fs.existsSync(path.join(RAIZ, b)));
  // Los bancos de un ticket se retiran; si no queda ninguno, este caso no mide y lo DICE.
  assert.ok(vivos.length > 0, '🔴 NO MEDIDO: no queda ninguno de los tres bancos. Retira este caso; los fabricados de arriba siguen cubriendo la forma.');
  for (const b of vivos) {
    const h = clasificaFuente(b, fs.readFileSync(path.join(RAIZ, b), 'utf8'));
    assert.ok(h.length > 0, `🔴 el censo ya no ve ninguna llamada en ${b}: no prueba nada`);
    assert.deepEqual(h.filter((l) => l.acusado).map(comoLinea), [], `🔴 vuelve a acusar a un banco limpio: ${b}`);
  }
});

test('SCRUM-1349 · el «me fío» del censo dice de qué NO responde', () => {
  assert.ok(typeof NO_RESPONDE_DE === 'string' && NO_RESPONDE_DE.length > 40);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② EL TRINQUETE
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1349 · 🔴 los que prestan el entorno son EXACTAMENTE los declarados: ni uno más, y el que se arregla se borra', () => {
  const c = censar(RAIZ);
  const motivos = motivosParaNoFiarse(c);
  assert.deepEqual(motivos, [], `🔴 NO MEDIDO, el censo está ciego: ${motivos.join(' · ')}`);
  assert.ok(c.ficheros > 500 && c.limpios.length > 0,
    `🔴 NO MEDIDO: población ${c.ficheros} ficheros, ${c.limpios.length} llamadas limpias. Sin una limpia a la vista no se sabe si distingue.`);

  const { nuevos, sobran } = contraDeclarados(c.acusados, declarados());
  const detalle = c.acusados.map((l) => `    ${comoLinea(l)}`).join('\n');
  assert.deepEqual(nuevos, [],
    `🔴 HAY UN \`node\` HIJO NUEVO QUE HEREDA EL ENTORNO DE QUIEN LO LANZA: ${nuevos.join(' · ')}\n\n${detalle}\n\n`
    + '  Arréglalo donde nace: `const entorno = { ...process.env };` y borra FORCE_COLOR, NODE_OPTIONS y\n'
    + '  NODE_TEST_CONTEXT antes de pasarlo como `env`. Esta lista NO sube.\n'
    + `  ⚠️ Antes de arreglar nada, ABRE el fichero: el censo no responde de ${NO_RESPONDE_DE}.\n`
    + `  Población: ${c.ficheros} ficheros · ${c.nuestras.length} llamadas · ${c.limpios.length} limpias · ${c.acusados.length} acusadas.`);
  assert.deepEqual(sobran, [],
    `🔴 EL TRINQUETE PUEDE APRETAR Y NO SE HA APRETADO: ${sobran.join(' · ')}\n`
    + '  Ya no se acusan. BORRA su entrada de scripts/_entorno-prestado-declarados.json (o baja `llamadas`) en este commit.\n'
    + cruceDe(sobran));
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ②bis QUIÉN DECLARÓ Y QUIÉN ARREGLÓ
// ═════════════════════════════════════════════════════════════════════════════════════════
//
// El 1-oct-2026 este trinquete dejó la rama principal en rojo sin que nadie hubiera hecho nada
// mal: #2077 DECLARÓ `scrum928` y `scrum976`, #1990 los ARREGLÓ, cada uno pasó su CI por
// separado y entraron con 34 segundos de diferencia. Juntos, la lista declaraba dos ficheros que
// ya no se acusaban. El cruce estaba AVISADO —pero en el encargo de una sesión, y el PR era de
// otra—: una dependencia entre dos PR escrita en el prompt de uno no existe para el otro.
//
// Lo que este rojo no decía es lo único que hacía falta para arreglarlo en un minuto: QUÉ commit
// metió la entrada y QUÉ commit dejó limpio el fichero. Ahora lo dice el propio mensaje, leyendo
// la historia. No evita el cruce —dos PR verdes por separado se siguen pudiendo cruzar, y eso
// sólo lo quita probar cada PR contra la punta en el momento de entrar—; evita que el rojo haya
// que investigarlo.

const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
};

/**
 * El PR que trajo un commit: el merge de PR más ANTIGUO que desciende de él. Sin `--first-parent`
 * a propósito: el commit sólo se alcanza por el SEGUNDO padre de su merge, y con esa opción el
 * merge que lo trajo no sale (medido: daba `null` para un commit que entró por el #2077).
 */
function prDe(sha) {
  const merges = git('log', '--merges', '--ancestry-path', '--reverse', '--format=%s', `${sha}..HEAD`) || '';
  for (const asunto of merges.split('\n')) {
    const m = /^Merge pull request #(\d+)/.exec(asunto);
    if (m) return `#${m[1]}`;
  }
  return null;
}

/**
 * Para un fichero de la lista: el commit que metió su entrada y el último que tocó el fichero.
 * Cada mitad viene con su sha y su asunto, o en `null` si la historia no alcanza para saberlo —
 * que se DICE, no se calla: «no lo sé» no es «nadie».
 */
export function procedenciaDe(fichero) {
  const uno = (salida) => {
    const [sha, ...resto] = (salida || '').split('\n')[0].split(' ');
    return /^[0-9a-f]{7,40}$/.test(sha || '') ? { sha, asunto: resto.join(' '), pr: prDe(sha) } : null;
  };
  return {
    // `-S` da los commits que cambian CUÁNTAS veces aparece la cadena: mientras la entrada siga
    // en la lista, el más reciente es el que la metió.
    declaro: uno(git('log', '-1', '--format=%h %s', `-S"${fichero}"`, '--', 'scripts/_entorno-prestado-declarados.json')),
    arreglo: uno(git('log', '-1', '--no-merges', '--format=%h %s', '--', fichero)),
  };
}

const comoProcedencia = (p) => (p ? `${p.sha}${p.pr ? ` (${p.pr})` : ''} · ${p.asunto}` : 'NO LO SÉ: la historia de este clon no alcanza');

/** El párrafo que acompaña al rojo de «puede apretar»: por cada entrada, quién y quién. */
function cruceDe(sobran) {
  const lineas = ['  Quién declaró cada una y quién dejó limpio su fichero (leído de la historia):'];
  for (const s of sobran) {
    const fichero = s.replace(/ \(.*$/, '');
    const p = procedenciaDe(fichero);
    lineas.push(`    ${fichero}`);
    lineas.push(`      la declaró:        ${comoProcedencia(p.declaro)}`);
    lineas.push(`      la dejó limpia:    ${comoProcedencia(p.arreglo)}`);
  }
  lineas.push('  Si son dos PR distintos, se han cruzado: borra la entrada el que entró SEGUNDO, o quien lo vea primero.');
  return lineas.join('\n');
}

test('SCRUM-1349 · el rojo de «puede apretar» sabe decir quién declaró la entrada y quién tocó el fichero', () => {
  const lista = Object.keys(declarados());
  // Sin entradas no hay con qué probarlo, y se DICE: el día que la lista llegue a cero este caso
  // se retira junto con ella.
  assert.ok(lista.length > 0, '🔴 NO MEDIDO: la lista de declarados está vacía. Retira este caso con ella.');
  assert.equal(git('rev-parse', '--is-shallow-repository'), 'false',
    '🔴 NO MEDIDO: el clon es superficial y la historia no se puede leer (el checkout de CI lleva `fetch-depth: 0`, SCRUM-388)');

  for (const fichero of lista) {
    const p = procedenciaDe(fichero);
    assert.ok(p.declaro && p.declaro.asunto.length > 0,
      `🔴 no sé decir qué commit declaró «${fichero}»: el rojo del trinquete volvería a salir sin nombre`);
    assert.ok(p.arreglo && p.arreglo.asunto.length > 0, `🔴 no sé decir qué commit tocó «${fichero}» por última vez`);
    // El commit que se nombra como declarante tiene que haber tocado la LISTA: si no, el `-S` ha
    // casado otra cosa y el mensaje señalaría a quien no fue.
    const tocados = git('show', '--name-only', '--format=', p.declaro.sha) || '';
    assert.ok(tocados.split('\n').includes('scripts/_entorno-prestado-declarados.json'),
      `🔴 el commit que nombro como declarante de «${fichero}» (${p.declaro.sha}) no tocó la lista`);
  }

  // LA MITAD QUE DICE «NO LO SÉ»: un fichero que nunca estuvo en la lista no tiene declarante, y
  // eso sale como tal en vez de inventarse uno.
  assert.equal(procedenciaDe('tests/nunca-estuvo-en-la-lista-1349.test.mjs').declaro, null,
    '🔴 le atribuye un declarante a un fichero que nunca se declaró');
  assert.match(cruceDe(['tests/nunca-estuvo-en-la-lista-1349.test.mjs (-1)']), /NO LO SÉ/,
    '🔴 cuando no sabe quién declaró, el mensaje no lo dice');
  // El PR: la lista nació en el #2077, y sus entradas de entonces tienen que decirlo. (Las que
  // entren después dirán el suyo; sólo se exige a las que declaró aquel commit.)
  const delNacimiento = lista.map((f) => procedenciaDe(f).declaro).filter((d) => d.asunto.includes('la lista solo baja'));
  assert.ok(delNacimiento.length > 0, '🔴 NO MEDIDO: no queda ninguna entrada del commit que creó la lista; busca otro testigo del PR');
  for (const d of delNacimiento) assert.equal(d.pr, '#2077', `🔴 no sé decir por qué PR entró ${d.sha}: saldría un commit sin su PR`);
  // Y el mensaje entero nombra un commit de verdad para una entrada de verdad.
  assert.match(cruceDe([`${lista[0]} (-1)`]), /la declaró: +[0-9a-f]{7,}/, '🔴 el mensaje del cruce no nombra el commit que declaró');
});

test('SCRUM-1349 · 🔴 CONTROL POSITIVO DEL TRINQUETE: un acusado de mentira SALTA, y uno arreglado también', () => {
  const lista = declarados();
  const c = censar(RAIZ);
  const limpio = contraDeclarados(c.acusados, lista);
  assert.deepEqual(limpio, { nuevos: [], sobran: [] }, '🔴 la base no está limpia: este control no distingue nada');

  // Uno nuevo, en un fichero que no está declarado.
  const inventado = clasificaFuente('tests/inventado-scrum1349.test.mjs', conLimpieza('// nada'));
  assert.equal(inventado[0].acusado, true);
  const conNuevo = contraDeclarados([...c.acusados, ...inventado], lista);
  assert.deepEqual(conNuevo.nuevos, ['tests/inventado-scrum1349.test.mjs (+1)'], '🔴 EL TRINQUETE NO VE A UN ACUSADO NUEVO');

  // Una llamada de más en un fichero que YA está declarado: tampoco pasa.
  const [declarado] = Object.keys(lista);
  const deMas = contraDeclarados([...c.acusados, { ...inventado[0], fichero: declarado }], lista);
  assert.equal(deMas.nuevos.length, 1, '🔴 una llamada de más en un fichero declarado pasa en silencio');

  // Y hacia abajo: si uno deja de acusarse, lo dice.
  const sinUno = contraDeclarados(c.acusados.filter((l) => l.fichero !== declarado), lista);
  assert.equal(sinUno.sobran.length, 1, '🔴 EL TRINQUETE NO SE ENTERA DE QUE UNO SE ARREGLÓ: nunca apretaría');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS MUTACIONES QUE ME TUMBAN (SCRUM-745) · las ejecuta `npm run meta:mutaciones`
// ═════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El censo vuelve a no reconocer el bucle: acusa a un limpio.
    fichero: 'scripts/_censo-entorno-prestado.mjs',
    de: 'if (delBucle) for (const k of delBucle) borradas.add(k);',
    a: 'if (false) for (const k of delBucle) borradas.add(k);',
    cae: 'NO ACUSA A UN LIMPIO',
  },
  {
    // El trinquete deja de mirar los ficheros que no conoce.
    fichero: 'scripts/_censo-entorno-prestado.mjs',
    de: 'if (!d) nuevos.push(`${fichero} (+${n})`);',
    a: 'if (!d) continue;',
    cae: 'CONTROL POSITIVO DEL TRINQUETE',
  },
  {
    // Entra uno de verdad: uno de los arreglados vuelve a heredar.
    fichero: 'tests/scrum949-el-suelo-como-cociente.test.mjs',
    de: '  delete env.FORCE_COLOR;\n',
    a: '',
    cae: 'son EXACTAMENTE los declarados',
  },
];
