// tests/scrum1396c-los-declarados-solo-bajan.test.mjs — SCRUM-1396c
//
// LOS 28 SITIOS QUE DESTAPÓ EL CENSO AL EMPAREJAR POR ÁMBITO ENTRAN DECLARADOS, Y LA LISTA SÓLO BAJA
//
// SCRUM-1396 cambió `scripts/_censo-mkdtemp.mjs` para que un borrado sólo cubra a SU variable, no a
// cualquiera que se llame igual. Con eso, ③ de SCRUM-864c acusó 28 sitios que ya estaban en `main`
// (2 con fuga medida, 22 por su forma, 4 sin medir; 11 los creó la cuenta de Luis y 17 la de
// Javier). El fundador decidió (SCRUM-1396 c.21095, 27-oct-2026) que entren DECLARADOS, uno a uno,
// con su motivo y quién los retira, en `scripts/_mkdtemp-declarados.json`, y que:
//   · la lista sólo pueda BAJAR — un sitio que sale de ella sin arreglarse, o uno nuevo, es rojo;
//   · todo sitio NUEVO acuse.
//
// Se reúsa el trinquete de la casa (`contraDeclarados`, SCRUM-1349): el árbol tiene EXACTAMENTE los
// declarados. Lo que aquél no tiene es que la lista no crezca: aquí se compara con la lista tal como
// la creó su primer commit, leída de la historia. Sin historia (clon superficial) dice CIEGO.
//
// Sin gate: ni BD, ni red, ni navegador, ni `dist/`.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  censar, clasificaFuente, motivosParaNoFiarse, contraSitiosDeclarados, leerSitiosDeclarados,
  subeRespectoA, RUTA_SITIOS_DECLARADOS, MOTIVOS_DE_SITIO, QUIEN_RETIRA,
} from '../scripts/_censo-mkdtemp.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NL = '\n';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Las ESCAPA dejan de contar como fuga: un sitio nuevo que devuelve su directorio pasa.
    fichero: 'scripts/_censo-mkdtemp.mjs',
    de: 'export const fugasDe = (censo) => [...sinCierre(censo), ...sinDueno(censo)];',
    a: 'export const fugasDe = (censo) => [...sinCierre(censo)];',
    cae: '🔴 ③ CONTROL POSITIVO SEMBRADO',
  },
  {
    // La lista puede crecer: un fichero que no estaba al nacer pasa.
    fichero: 'scripts/_censo-mkdtemp.mjs',
    de: '    if (!antes) sube.push(`${fichero}: no estaba en la lista que creó la decisión`);',
    a: '    if (!antes) continue;',
    cae: '🔴 ② LA LISTA SÓLO BAJA',
  },
  {
    // Alguien sube a mano las llamadas de un declarado.
    fichero: 'scripts/_mkdtemp-declarados.json',
    de: '"tests/scrum899-sesion-lista-blanca.test.mjs": { "llamadas": 1,',
    a: '"tests/scrum899-sesion-lista-blanca.test.mjs": { "llamadas": 2,',
    cae: '🔴 ② LA LISTA SÓLO BAJA',
  },
];

const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

const CENSO = censar(RAIZ);
const HOY = leerSitiosDeclarados(RAIZ);
const total = (lista) => Object.values(lista).reduce((s, d) => s + d.llamadas, 0);

// Una función que crea su temporal y lo devuelve: la forma ESCAPA, fabricada aquí y no tomada del
// árbol (el día que alguien arregle los 28, un positivo prestado se quedaría mudo).
const SEMBRADO = 'tests/sembrado-scrum1396c.test.mjs';
const FUENTE_SEMBRADA = [
  "import fs from 'node:fs';",
  "import os from 'node:os';",
  "import path from 'node:path';",
  'function crea() {',
  "  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sembrado-'));",
  '  return dir;',
  '}',
  'crea();',
].join(NL);

test('SCRUM-1396c · ① cada declarado lleva motivo y quién lo retira, y la población no está vacía', () => {
  assert.deepEqual(motivosParaNoFiarse(CENSO), [], '🔴 CIEGO: el censo no está en condiciones de afirmar nada.');
  const entradas = Object.entries(HOY);
  assert.ok(entradas.length > 0,
    `🔴 la lista de ${RUTA_SITIOS_DECLARADOS} está vacía: se arreglaron todos. Retira este test y la lista con ella.`);
  for (const [fichero, d] of entradas) {
    assert.ok(Number.isInteger(d.llamadas) && d.llamadas >= 1, `🔴 «${fichero}»: \`llamadas\` tiene que ser un entero ≥ 1 (si es 0, se borra la entrada)`);
    assert.ok(MOTIVOS_DE_SITIO.includes(d.motivo), `🔴 «${fichero}»: motivo «${d.motivo}» no es uno de ${MOTIVOS_DE_SITIO.join(' / ')}`);
    assert.ok(QUIEN_RETIRA.includes(d.retira), `🔴 «${fichero}»: retira «${d.retira}» no es uno de ${QUIEN_RETIRA.join(' / ')}`);
    assert.ok(typeof d.detalle === 'string' && d.detalle.length > 0, `🔴 «${fichero}»: sin detalle`);
  }
});

test('SCRUM-1396c · 🔴 ② LA LISTA SÓLO BAJA: nada que no estuviera en el commit que la creó', () => {
  assert.equal(git('rev-parse', '--is-shallow-repository'), 'false',
    '🔴 CIEGO: el clon es superficial y no se puede leer el commit que creó la lista.');
  const altas = git('log', '--diff-filter=A', '--reverse', '--format=%H', '--', RUTA_SITIOS_DECLARADOS);
  const nace = altas ? altas.split(NL)[0] : '';
  assert.match(nace, /^[0-9a-f]{40}$/,
    `🔴 CIEGO: ningún commit crea ${RUTA_SITIOS_DECLARADOS}. Si la estás creando ahora, comitéala antes de correr esto.`);
  const NACIMIENTO = JSON.parse(git('show', `${nace}:${RUTA_SITIOS_DECLARADOS}`)).ficheros;

  // La lista que nació es la que decidió el fundador (c.21095): 28 sitios, 17 de J6 y 11 de SCRUM-1621.
  const de = (lista, quien) => total(Object.fromEntries(Object.entries(lista).filter(([, d]) => d.retira === quien)));
  assert.deepEqual([total(NACIMIENTO), de(NACIMIENTO, 'J6'), de(NACIMIENTO, 'SCRUM-1621')], [28, 17, 11],
    `🔴 el commit ${nace.slice(0, 9)} no creó la lista decidida en SCRUM-1396 c.21095 (28 = 17 J6 + 11 SCRUM-1621)`);

  // Controles del comparador, sobre la lista de nacimiento: igual no sube, bajar no sube, crecer sí.
  assert.deepEqual(subeRespectoA(NACIMIENTO, NACIMIENTO), [], '🔴 la lista contra sí misma «sube»: el comparador no distingue');
  const [uno, d1] = Object.entries(NACIMIENTO)[0];
  const sinUno = Object.fromEntries(Object.entries(NACIMIENTO).filter(([f]) => f !== uno));
  assert.deepEqual(subeRespectoA(NACIMIENTO, sinUno), [], '🔴 borrar un arreglado cuenta como subir');
  assert.equal(subeRespectoA(NACIMIENTO, { ...NACIMIENTO, [SEMBRADO]: { ...d1 } }).length, 1, '🔴 un fichero nuevo en la lista NO sube');
  assert.equal(subeRespectoA(NACIMIENTO, { ...NACIMIENTO, [uno]: { ...d1, llamadas: d1.llamadas + 1 } }).length, 1,
    '🔴 una llamada de más en un declarado NO sube');

  assert.deepEqual(subeRespectoA(NACIMIENTO, HOY), [], [
    '',
    `🔴 ${RUTA_SITIOS_DECLARADOS} HA CRECIDO respecto al commit que la creó (${nace.slice(0, 9)}):`,
    ...subeRespectoA(NACIMIENTO, HOY).map((s) => '    ' + s),
    '',
    '  Esa lista es la de los sitios que había el 27-oct-2026 (SCRUM-1396 c.21095) y SÓLO BAJA.',
    '  Un temporal nuevo se crea con `temporal()` de tests/_temporal.mjs, que borra al salir el proceso.',
  ].join(NL));
});

test('SCRUM-1396c · 🔴 ③ CONTROL POSITIVO SEMBRADO: un sitio nuevo acusa, dentro y fuera de un fichero declarado', () => {
  const sembrado = clasificaFuente(SEMBRADO, FUENTE_SEMBRADA);
  // Sin esto, lo de abajo compara listas vacías: si el sembrado no acusa, el control está CIEGO.
  assert.deepEqual(sembrado.map((l) => l.categoria), ['ESCAPA'],
    '🔴 CIEGO: el sitio sembrado ya no sale ESCAPA, así que este control no siembra nada.');

  const conSembrado = { ...CENSO, ESCAPA: [...CENSO.ESCAPA, ...sembrado] };
  assert.deepEqual(contraSitiosDeclarados(conSembrado, HOY).nuevos, [`${SEMBRADO} (+1)`],
    '🔴 UN SITIO NUEVO FUERA DE LA LISTA NO ACUSA');

  const [declarado] = Object.keys(HOY);
  const deMas = { ...CENSO, ESCAPA: [...CENSO.ESCAPA, { ...sembrado[0], fichero: declarado }] };
  assert.equal(contraSitiosDeclarados(deMas, HOY).nuevos.length, 1,
    `🔴 una llamada de más en un fichero declarado («${declarado}») pasa en silencio`);
});

test('SCRUM-1396c · ④ CONTROL NEGATIVO: los declarados no acusan, y salir de la lista sin arreglarse sí', () => {
  const hoy = contraSitiosDeclarados(CENSO, HOY);
  assert.deepEqual(hoy, { nuevos: [], sobran: [] }, [
    '🔴 el árbol no tiene EXACTAMENTE los declarados:',
    `    nuevos: ${hoy.nuevos.join(' · ') || '—'}`,
    `    sobran: ${hoy.sobran.join(' · ') || '—'}`,
    '  El detalle y cómo se arregla, en ③ de tests/scrum864c-el-temporal-no-vuelve.test.mjs.',
  ].join(NL));
  assert.equal(total(HOY), CENSO.ESCAPA.length + CENSO.NO_GARANTIZADA.length + CENSO.SIN_LIMPIEZA.length + CENSO.FABRICA.length,
    '🔴 las llamadas declaradas no son las que el censo acusa');

  // Sacar uno de la lista sin tocar su fichero: vuelve a acusar.
  const [fuera] = Object.keys(HOY);
  const sinEl = Object.fromEntries(Object.entries(HOY).filter(([f]) => f !== fuera));
  assert.equal(contraSitiosDeclarados(CENSO, sinEl).nuevos.length, 1,
    `🔴 sacar «${fuera}» de la lista sin arreglarlo pasa en silencio`);

  // Y arreglarlo sin borrar su entrada: el trinquete pide apretar.
  const arreglado = { ...CENSO, ESCAPA: CENSO.ESCAPA.filter((l) => l.fichero !== fuera),
    NO_GARANTIZADA: CENSO.NO_GARANTIZADA.filter((l) => l.fichero !== fuera) };
  assert.equal(contraSitiosDeclarados(arreglado, HOY).sobran.length, 1,
    '🔴 EL TRINQUETE NO SE ENTERA DE QUE UNO SE ARREGLÓ: nunca apretaría');
});
