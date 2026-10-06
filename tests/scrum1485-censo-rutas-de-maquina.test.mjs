// SCRUM-1485 · NINGÚN TEST COMPARA UNA RUTA DE LA MÁQUINA CON UN «/» ESCRITO A MANO.
//
// El 6-oct-2026 un test que en Windows daba «12 de 12» dejó en rojo el check obligatorio del PR #2221
// durante tres horas (docs/master/SCRUM-1473.md, tramo 1473b). Hacía rutas con `path.join` —«\» en
// Windows, «/» en el CI— y les pegaba una «/» a mano antes de compararlas. En esta máquina no hay Linux
// donde verlo antes de empujar, así que se caza LEYENDO: `scripts/equipo/censo-rutas-de-maquina.mjs`.
//
// QUÉ VIGILA ESTE GUARD: la forma que se ve en el propio sitio (veredicto LITERAL del censo).
// QUÉ NO: una ruta que llega a la comparación por un parámetro, un array u otro módulo. El censo lo
// declara en `LO_QUE_NO_VE` y lo imprime siempre; un verde de aquí no absuelve eso.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { analizar, censar, claveDe, LO_QUE_NO_VE } from '../scripts/equipo/censo-rutas-de-maquina.mjs';

// El rojo, declarado: lo ejecuta `npm run meta:mutaciones`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El censo deja de mirar `.includes()`: el renglón que tumbó el CI ya no es un sumidero.
    fichero: 'scripts/equipo/censo-rutas-de-maquina.mjs',
    de: "const METODOS = new Set(['startsWith', 'endsWith', 'includes', 'indexOf', 'lastIndexOf']);",
    a: "const METODOS = new Set(['startsWith', 'endsWith', 'indexOf', 'lastIndexOf']);",
    cae: 'SCRUM-1485 · 🔴 EL CASO: el test de SCRUM-1473 tal como cayó en el CI se acusa; el arreglado, no',
  },
  {
    // Un separador pegado a mano a la ruta deja de contar.
    fichero: 'scripts/equipo/censo-rutas-de-maquina.mjs',
    de: "    const veredicto = (niveles.includes(2) || frente === 'literal-sep') ? 'LITERAL'",
    a: "    const veredicto = (frente === 'literal-sep') ? 'LITERAL'",
    cae: 'SCRUM-1485 · 🔴 EL CASO: el test de SCRUM-1473 tal como cayó en el CI se acusa; el arreglado, no',
  },
  {
    // Normalizar deja de curar: todo test que hace lo correcto pasa a estar acusado.
    fichero: 'scripts/equipo/censo-rutas-de-maquina.mjs',
    de: '        if (quien.arguments.length && esSeparador(quien.arguments[0])) return 0;',
    a: '        if (quien.arguments.length && esSeparador(quien.arguments[0])) return 1;',
    cae: 'SCRUM-1485 · normalizar a «/» CURA: lo normalizado ya no es una ruta de máquina',
  },
  {
    // Una ruta de máquina contra un texto con «/» deja de ser LITERAL.
    fichero: 'scripts/equipo/censo-rutas-de-maquina.mjs',
    de: "    if (ts.isStringLiteralLike(n)) return tieneSep(n.text) ? 'literal-sep' : 'literal-sin-sep';",
    a: "    if (ts.isStringLiteralLike(n)) return 'literal-sin-sep';",
    cae: 'SCRUM-1485 · los cuatro veredictos, cada uno con su caso: LITERAL, MAQUINA, INOCUO y NO-LEIDO',
  },
];

const RAIZ = path.resolve(import.meta.dirname, '..');
const CABECERA = [
  "import path from 'node:path';",
  "import fs from 'node:fs';",
  "import assert from 'node:assert/strict';",
];
const leer = (lineas) => {
  const r = analizar([...CABECERA, ...lineas].join('\n'), 'cobaya.mjs');
  assert.equal(r.leido, true, 'SUELO: la cobaya se tiene que poder leer');
  return r;
};
const veredictos = (r) => r.hallazgos.map((h) => h.veredicto);

// Los renglones que importan del test de SCRUM-1473: VIEJO, como estaban en la punta que cayó en el CI
// (`db94a77986f0d61a087897bef45fecd2d6061388`); NUEVO, como quedaron al arreglarlo. El fichero entero de
// hoy se lee además del árbol, más abajo.
const VIEJO = [
  'const foto = (raiz) => {',
  '  const out = [];',
  '  const baja = (d) => {',
  '    for (const e of fs.readdirSync(d, { withFileTypes: true })) {',
  '      const p = path.join(d, e.name);',
  '      if (e.isDirectory()) { out.push(`${path.relative(raiz, p)}/`); baja(p); } else out.push(`${path.relative(raiz, p)} x`);',
  '    }',
  '  };',
  '  baja(raiz);',
  '  return out;',
  '};',
  "const fuera = (f) => f.filter((l) => !l.startsWith(path.join('vieja001', 'tmp') + path.sep));",
  "const despues = foto('.');",
  "assert.ok(despues.includes(`${path.join('vieja001', 'tmp')}/`), 'la carpeta se queda');",
];
const NUEVO = [
  'const foto = (raiz) => {',
  '  const out = [];',
  "  const rel = (p) => path.relative(raiz, p).split(path.sep).join('/');",
  '  const baja = (d) => {',
  '    for (const e of fs.readdirSync(d, { withFileTypes: true })) {',
  '      const p = path.join(d, e.name);',
  '      if (e.isDirectory()) { out.push(`${rel(p)}/`); baja(p); } else out.push(`${rel(p)} x`);',
  '    }',
  '  };',
  '  baja(raiz);',
  '  return out;',
  '};',
  "const fuera = (f) => f.filter((l) => l === 'vieja001/tmp/' || !l.startsWith('vieja001/tmp/'));",
  "const despues = foto('.');",
  "assert.ok(despues.includes('vieja001/tmp/'), 'la carpeta se queda');",
];

test('SCRUM-1485 · 🔴 EL CASO: el test de SCRUM-1473 tal como cayó en el CI se acusa; el arreglado, no', () => {
  const viejo = leer(VIEJO);
  const acusado = viejo.hallazgos.filter((h) => h.veredicto === 'LITERAL');
  assert.equal(acusado.length, 1, `el renglón que comparaba con la «/» pegada no sale LITERAL: ${JSON.stringify(viejo.hallazgos)}`);
  assert.equal(acusado[0].sumidero, '.includes()');
  assert.match(acusado[0].texto, /despues\.includes/);
  // El filtro por prefijo se VE, pero el censo no sabe de dónde viene `l`: lo deja para una persona.
  assert.deepEqual(viejo.hallazgos.filter((h) => h.sumidero === '.startsWith()').map((h) => h.veredicto), ['NO-LEIDO']);
  // Y el sitio donde NACÍA la ruta rara (la «/» pegada dentro de `foto`) sale como mezcla, aunque vaya a un array.
  assert.deepEqual(viejo.mezclas.map((m) => m.linea - CABECERA.length), [6, 14]);

  const nuevo = leer(NUEVO);
  assert.deepEqual(nuevo.hallazgos, [], 'el arreglado compara texto con texto: no hay nada que acusar');
  assert.deepEqual(nuevo.mezclas, []);

  // Y el fichero de verdad, el que hoy está en el árbol.
  const real = censar(RAIZ, ['tests/scrum1473-latido-disco-y-barrido.test.mjs']);
  assert.equal(real.poblacion, 1);
  assert.deepEqual(real.sinLeer, []);
  assert.ok(real.filas.length > 0, 'SUELO: en ese test hay comparaciones con rutas, y el censo las ve');
  assert.deepEqual(real.literal, []);
  assert.deepEqual(real.mezclas, []);
});

test('SCRUM-1485 · los cuatro veredictos, cada uno con su caso: LITERAL, MAQUINA, INOCUO y NO-LEIDO', () => {
  assert.deepEqual(veredictos(leer(["const rel = path.relative('a', 'b');", "if (rel.startsWith('tests/x')) process.exit(1);"])), ['LITERAL']);
  assert.deepEqual(veredictos(leer(["assert.equal(path.join('a', 'b'), 'a/b');"])), ['LITERAL']);
  assert.deepEqual(veredictos(leer(["assert.deepEqual([path.join('a', 'b')], ['a/b']);"])), ['LITERAL']);
  assert.deepEqual(veredictos(leer(["const ok = /^tests\\//.test(path.relative('a', 'b'));"])), ['LITERAL']);
  assert.deepEqual(veredictos(leer(["const RAIZ = path.resolve('.');", "const ok = path.resolve('x').startsWith(RAIZ + path.sep);"])), ['MAQUINA']);
  assert.deepEqual(veredictos(leer(["const rel = path.relative('a', 'b');", "const fuera = rel.startsWith('..');"])), ['INOCUO']);
  assert.deepEqual(veredictos(leer(["const ok = /[\\\\/]tests[\\\\/]/.test(path.resolve('x'));"])), ['INOCUO']);
  assert.deepEqual(veredictos(leer(["const dentro = (f) => f.startsWith(path.join('a', 'b'));"])), ['NO-LEIDO']);
});

test('SCRUM-1485 · normalizar a «/» CURA: lo normalizado ya no es una ruta de máquina', () => {
  assert.deepEqual(leer(["const rel = path.relative('a', 'b').split(path.sep).join('/');", "if (rel.startsWith('tests/x')) process.exit(1);"]).hallazgos, []);
  assert.deepEqual(leer(["const rel = path.relative('a', 'b').replace(/\\\\/g, '/');", "if (rel === 'tests/x') process.exit(1);"]).hallazgos, []);
  assert.deepEqual(leer(["const rel = path.relative('a', 'b').replaceAll(path.sep, '/');", "if (rel === 'tests/x') process.exit(1);"]).hallazgos, []);
  assert.deepEqual(leer(["const rel = path.posix.join('a', 'b');", "if (rel === 'a/b') process.exit(1);"]).hallazgos, []);
  // Y al revés: lo que se junta CON el separador de la máquina vuelve a serlo.
  assert.deepEqual(veredictos(leer(["const rel = 'a/b'.split('/').join(path.sep);", "if (rel === 'a/b') process.exit(1);"])), ['LITERAL']);
});

test('SCRUM-1485 · sigue un nombre hasta su `const` y una llamada hasta su función local; un parámetro, no', () => {
  // Por la función local que devuelve la ruta sin normalizar.
  assert.deepEqual(veredictos(leer(["const rel = (p) => path.relative('.', p);", "if (rel('x') === 'a/b') process.exit(1);"])), ['LITERAL']);
  // Por los nombres sueltos del import.
  const sueltos = analizar(["import { join, sep } from 'node:path';", "const a = join('a', 'b') === 'a/b';", "const b = 'x'.includes(sep);"].join('\n'), 'c.mjs');
  assert.deepEqual(sueltos.hallazgos.map((h) => h.veredicto), ['LITERAL', 'INOCUO']);
  // El MISMO nombre ligado en otro ámbito como parámetro no hereda nada: se cuentan cosas, no texto.
  assert.deepEqual(leer(["const rel = path.relative('a', 'b');", "const f = (rel) => rel.startsWith('tests/x');"]).hallazgos, []);
  // Y un comentario que contiene el patrón no es código.
  assert.deepEqual(leer(["// assert.equal(path.join('a', 'b'), 'a/b');", 'const x = 1;']).hallazgos, []);
});

test('SCRUM-1485 · un mensaje que nombra una ruta no es una mezcla; una «/» PEGADA a la ruta, sí', () => {
  assert.deepEqual(leer(["const m = `no cuelga de ${path.resolve('x')}: mira docs/equipo`;"]).mezclas, []);
  assert.equal(leer(["const m = `${path.resolve('x')}/dentro`;"]).mezclas.length, 1);
  assert.equal(leer(["const m = path.resolve('x') + '/dentro';"]).mezclas.length, 1);
  assert.equal(leer(["const m = 'prefijo/' + path.join('a', 'b');"]).mezclas.length, 1);
});

test('SCRUM-1485 · 🔴 FAIL-CLOSED: un fichero que no se puede leer se CUENTA, no se da por limpio', () => {
  const r = analizar('const = ;', 'roto.mjs');
  assert.equal(r.leido, false);
  assert.ok(r.motivo, 'dice por qué no lo leyó');
  const c = censar(RAIZ, ['tests/no-existe-este-fichero-1485.test.mjs']);
  assert.equal(c.poblacion, 1);
  assert.equal(c.sinLeer.length, 1, 'un fichero que no está no es un fichero sin hallazgos');
  assert.ok(LO_QUE_NO_VE.length >= 4, 'lo que el censo no ve va declarado en el propio instrumento');
});

// Los LITERAL que hay hoy y son correctos. Cada uno con su motivo y con quién lo retira. Un elemento por línea.
const DECLARADOS = [
  {
    // Pregunta QUÉ máquina es para escoger el separador AJENO y probar que `resolver()` no lo devuelve.
    // Es el único sitio donde comparar `path.sep` con un literal es justo lo que se quiere.
    // Lo retira: quien retire ese test (SCRUM-521, carril del resolvedor de importadores).
    clave: String.raw`tests/scrum521-resolvedor-de-importadores.test.mjs · const ajeno = path.sep === '\\' ? '/' : '\\';`,
  },
];

test('SCRUM-1485 · GUARD: en `tests/` ninguna ruta de máquina se compara con un separador escrito a mano', () => {
  const c = censar(RAIZ);
  // SUELO: que haya mirado, y que sepa ver comparaciones con rutas. Las cifras del día, en el registro.
  assert.ok(c.poblacion > 1000, `SUELO: sólo ha leído ${c.poblacion} ficheros de tests/`);
  assert.deepEqual(c.sinLeer, [], '🔴 hay ficheros de tests/ que el censo no ha sabido leer: para ésos está CIEGO');
  assert.ok(c.conRutas > 500, `SUELO: sólo ${c.conRutas} ficheros tocan rutas; el censo ha dejado de reconocerlas`);
  assert.ok(c.filas.length > 20, `SUELO: sólo ve ${c.filas.length} comparaciones con rutas en todo tests/`);

  const hoy = new Set(c.literal.map(claveDe));
  const declarados = new Set(DECLARADOS.map((d) => d.clave));
  const nuevos = [...hoy].filter((k) => !declarados.has(k));
  const sobran = [...declarados].filter((k) => !hoy.has(k));
  assert.deepEqual(nuevos, [],
    '🔴 Este test compara una ruta hecha con `path` (en Windows lleva «\\», en el CI «/») con un separador escrito a mano.\n'
    + '  En tu máquina puede pasar y en el CI caer, o al revés: es lo que tuvo #2221 tres horas en rojo.\n'
    + "  Cura: normaliza la ruta antes de compararla — `ruta.split(path.sep).join('/')` — y compara con «/».\n"
    + '  Para verlos todos: node scripts/equipo/censo-rutas-de-maquina.mjs\n'
    + '  Si de verdad es correcto, se declara en DECLARADOS de este fichero, con su motivo y quién lo retira.');
  assert.deepEqual(sobran, [],
    '🔴 Un LITERAL declarado ya no está: o se arregló (quítalo de DECLARADOS) o el censo ha dejado de verlo.');
});
