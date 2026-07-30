// SCRUM-239 · EL ANCLA DEL RECIBO ES EL CÓDIGO, NO LA IDENTIDAD DEL COMMIT.
//
// El guard de evidencia (SCRUM-161) existe para una propiedad concreta, y la dice su propio
// fuente: «la evidencia caduca sola en cuanto TOCAS UNA LÍNEA». O sea: **el código que la tanda
// ejercitó tiene que ser el mismo que se va a cerrar.**
//
// `commit === HEAD` no era esa propiedad — era un PROXY de ella. Y los proxies fallan en los DOS
// sentidos, que es exactamente lo que este fichero fija con un test por sentido:
//
//   (a) DEMASIADO ESTRICTO · el bucle. AA1.2 obliga a anotar la tarea en el máster en un commit
//       aparte, así que toda tarea terminaba invalidando su propio recibo. Un criterio que no se
//       puede cumplir no se cumple: se EXCUSA. Y un guard que se excusa de rutina está muerto.
//
//   (b) DEMASIADO LAXO · el agujero, y el que de verdad importaba: `git rev-parse HEAD` no ve el
//       árbol de trabajo. Corres la tanda, editas `src/`, NO commiteas, cierras — y el recibo
//       seguía siendo «válido». Justo el descuido que el criterio existía para impedir.
//
// EL RIESGO DE ESTE CAMBIO, y por eso el test (b) es el importante: si el criterio nuevo no caza
// la edición sin commitear, se ha cambiado un proxy por otro y no se ha arreglado nada.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  esCodigo,
  NO_ES_CODIGO,
  huellaDeCodigo,
  SUELO_FICHEROS_CODIGO,
  validarEvidencia,
  CLAVES_HIJOS,
  SUELO_TOTAL,
} from '../scripts/_evidencia-tanda.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Un recibo bueno, al que cada test le rompe UNA cosa. */
function reciboBueno({ huella = 'a'.repeat(40), commit = 'c'.repeat(40) } = {}) {
  return JSON.stringify({
    commit,
    huella,
    huellaFicheros: 556,
    terminadaEn: new Date().toISOString(),
    total: SUELO_TOTAL, pass: SUELO_TOTAL, fail: 0, skip: 0,
    ficheros: 400,
    hijos: Object.fromEntries(CLAVES_HIJOS.map((k) => [k, { exit: 0, tests: 1, pass: 1, fail: 0 }])),
    runner: 'scripts/test-staging-gated.mjs',
  });
}

const validar = (over = {}) => validarEvidencia({
  texto: reciboBueno(),
  commitActual: 'c'.repeat(40),
  huellaActual: { huella: 'a'.repeat(40), ficheros: 556 },
  ahoraMs: Date.now(),
  ficherosEsperados: 10,
  ...over,
});

const claves = (res) => res.problemas.map((p) => p.clave).sort();

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CONTROL
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-239 · el control: recibo y árbol con el MISMO código → válido', () => {
  const res = validar();
  assert.deepEqual(res.problemas, [], 'el recibo bueno tiene que pasar');
  assert.equal(res.ok, true);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// (a) EL BUCLE · un commit que no toca código YA NO invalida el recibo
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-239 · (a) commit distinto con el MISMO código → sigue VÁLIDO (el bucle, cerrado)', () => {
  // Esto es literalmente el commit del máster de AA1.2: HEAD avanza, el código no se ha tocado.
  // Con el criterio viejo (`commit === HEAD`) esto daba `commit-viejo` y el recibo moría.
  const res = validar({ commitActual: 'd'.repeat(40) });
  assert.deepEqual(res.problemas, [],
    '🔴 EL BUCLE SIGUE ABIERTO: anotar el resultado en el máster invalida la evidencia del ' +
    'resultado. El acto de registrar la prueba no puede destruir la prueba.');
});

test('SCRUM-239 · los ficheros de docs NO son código (es lo que rompe el bucle)', () => {
  for (const r of ['docs/YAQU_MASTER.md', 'docs/QA/SUITE_REGRESION.md', 'CLAUDE.md', 'AGENTS.md',
                   '.claude/evidencia-tanda.json']) {
    assert.equal(esCodigo(r), false, `🔴 «${r}» cuenta como código: el bucle vuelve`);
  }
});

test('SCRUM-239 · la superficie se define por EXCLUSIÓN, no por allowlist', () => {
  // Un directorio de fuente NUEVO tiene que contar como código sin que nadie lo apunte. Una
  // allowlist falla aquí EN SILENCIO: lo nuevo queda fuera de la huella y el recibo sobrevive a
  // un cambio de código. Es la familia de SUELO_TOTAL y de las tres listas que mató SCRUM-199.
  for (const r of ['src/app.ts', 'tests/x.test.mjs', 'scripts/y.mjs', 'prisma/schema.prisma',
                   'public/dashboard/js/z.js', 'package.json', '.github/workflows/ci.yml',
                   'un-modulo-que-hoy-no-existe/index.ts', 'src/modules/nuevo/loQueSea.ts']) {
    assert.equal(esCodigo(r), true, `🔴 «${r}» NO cuenta como código: un cambio ahí no invalidaría el recibo`);
  }
  assert.ok(NO_ES_CODIGO.length <= 4,
    '🔴 la lista de exclusiones está creciendo: cada entrada es un sitio donde se puede cambiar ' +
    'el comportamiento sin invalidar el recibo. Justifica cada una o no la añadas.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// (b) EL AGUJERO · el que importa. Código cambiado con el MISMO commit → INVÁLIDO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-239 · (b) MISMO commit y código distinto → INVÁLIDO, y lo dice sin commitear', () => {
  const res = validar({ huellaActual: { huella: 'b'.repeat(40), ficheros: 556 } });
  assert.deepEqual(claves(res), ['codigo-cambiado'],
    '🔴 EL AGUJERO SIGUE ABIERTO: se ha cambiado un proxy por otro. Editar código sin commitear ' +
    'es el descuido MÁS probable, y es justo el que este guard existe para impedir.');
  // El diagnóstico tiene que nombrar el caso, porque el remedio se lee distinto: si el commit es
  // el mismo, lo que hay son cambios en el árbol de trabajo y `git status` los enseña.
  const d = res.problemas[0].detalle;
  assert.match(d, /SIN\s+COMMITEAR/i, '🔴 no dice que son cambios sin commitear');
  assert.match(d, /git status/, '🔴 no dice dónde mirarlos');
});

test('SCRUM-239 · el criterio es la HUELLA, no el commit: commit igual no basta', () => {
  // La forma más directa de comprobar que el commit ya no decide: dejarlo idéntico en las dos
  // puntas y mover solo la huella. Si algo siguiera mirando el commit, esto pasaría.
  const res = validar({ commitActual: 'c'.repeat(40), huellaActual: { huella: 'z'.repeat(40), ficheros: 556 } });
  assert.equal(res.ok, false, '🔴 el commit sigue mandando sobre la huella');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// FAIL-CLOSED · «no comparable» NO es «igual»
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-239 · sin huella actual (git roto) → NO COMPARABLE, nunca válido', () => {
  // El modo de fallo peor posible sería que dos huellas ausentes se leyeran como iguales: verde
  // sin haber mirado un solo fichero. Es el mismo verde hueco de siempre, en su forma más cara.
  const res = validar({ huellaActual: null });
  assert.deepEqual(claves(res), ['no-comparable']);
  assert.equal(res.ok, false);
});

test('SCRUM-239 · un recibo SIN huella (anterior a este ticket) se rechaza', () => {
  const viejo = JSON.parse(reciboBueno());
  delete viejo.huella;
  const res = validar({ texto: JSON.stringify(viejo) });
  assert.ok(claves(res).includes('incompleto'),
    '🔴 un recibo pre-SCRUM-239 colaría: no tiene con qué compararse');
});

test('SCRUM-239 · dos ausencias NO se cancelan (el caso degenerado)', () => {
  const viejo = JSON.parse(reciboBueno());
  delete viejo.huella;
  const res = validar({ texto: JSON.stringify(viejo), huellaActual: null });
  assert.equal(res.ok, false, '🔴 recibo sin huella + huella incalculable dio VÁLIDO: verde hueco');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CÁLCULO · con un `git` inyectado, sin tocar disco
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Un `git` de mentira: devuelve el listado que se le dé y un hash por línea de stdin. */
function gitFalso(ficheros, { hashes = null, fallaEn = null } = {}) {
  return (args, stdin) => {
    if (fallaEn && args[0] === fallaEn) return null;
    if (args[0] === 'ls-files') return ficheros.join('\n') + '\n';
    if (args[0] === 'hash-object') {
      const rutas = stdin.split('\n').filter(Boolean);
      return rutas.map((r, i) => (hashes ? hashes[i] : `h${r.length}`)).join('\n') + '\n';
    }
    return null;
  };
}

const muchos = (n, pre = 'src/f') => Array.from({ length: n }, (_, i) => `${pre}${i}.ts`);

test('SCRUM-239 · SUELO: menos ficheros de la cuenta → null, no una huella a medias', () => {
  // Si `ls-files` devuelve cuatro cosas porque el repo está roto o se corre desde otro sitio, la
  // respuesta correcta es «no comparable», no una huella que luego se compare con otra igual de
  // rota. Sin este suelo, dos cálculos rotos dan verde.
  assert.equal(huellaDeCodigo(gitFalso(muchos(SUELO_FICHEROS_CODIGO - 1))), null);
  assert.ok(huellaDeCodigo(gitFalso(muchos(SUELO_FICHEROS_CODIGO))));
});

test('SCRUM-239 · git que falla → null (fail-closed), en cualquiera de los dos pasos', () => {
  assert.equal(huellaDeCodigo(gitFalso(muchos(200), { fallaEn: 'ls-files' })), null);
  assert.equal(huellaDeCodigo(gitFalso(muchos(200), { fallaEn: 'hash-object' })), null);
});

test('SCRUM-239 · si vuelven menos hashes que ficheros, no se adivina: null', () => {
  const git = (args, stdin) => {
    if (args[0] === 'ls-files') return muchos(200).join('\n');
    return muchos(199).map(() => 'aa').join('\n'); // uno de menos: salida truncada
  };
  assert.equal(huellaDeCodigo(git), null,
    '🔴 emparejar rutas y hashes desalineados daría una huella PLAUSIBLE y falsa');
});

test('SCRUM-239 · la huella no depende del ORDEN en que git liste los ficheros', () => {
  // `ls-files` ordena, pero la huella no puede depender de que lo siga haciendo: si cambiara el
  // orden, todos los recibos se invalidarían a la vez y nadie sabría por qué.
  const fich = muchos(150);
  const a = huellaDeCodigo(gitFalso([...fich]));
  const b = huellaDeCodigo(gitFalso([...fich].reverse()));
  assert.equal(a.huella, b.huella);
});

test('SCRUM-239 · la huella IGNORA docs y cuenta solo código', () => {
  const conDocs = [...muchos(150), 'docs/YAQU_MASTER.md', 'CLAUDE.md', '.claude/evidencia-tanda.json'];
  const sinDocs = muchos(150);
  assert.equal(huellaDeCodigo(gitFalso(conDocs)).huella, huellaDeCodigo(gitFalso(sinDocs)).huella,
    '🔴 la documentación entra en la huella: el bucle de SCRUM-239 vuelve');
  assert.equal(huellaDeCodigo(gitFalso(conDocs)).ficheros, 150);
});

test('SCRUM-239 · cambiar el CONTENIDO de un fichero cambia la huella', () => {
  const fich = muchos(150);
  const a = huellaDeCodigo(gitFalso(fich, { hashes: fich.map(() => 'aaaa') }));
  const b = huellaDeCodigo(gitFalso(fich, { hashes: fich.map((_, i) => (i === 7 ? 'bbbb' : 'aaaa')) }));
  assert.notEqual(a.huella, b.huella, '🔴 un fichero distinto da la misma huella: no mide contenido');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONTRA EL REPO DE VERDAD · que el cálculo funcione fuera del laboratorio
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-239 · contra este repo: la huella se calcula y supera el suelo', () => {
  const git = (args, stdin) => {
    const r = spawnSync('git', args, { cwd: RAIZ, encoding: 'utf8', input: stdin, maxBuffer: 64 * 1024 * 1024 });
    return r.status === 0 ? (r.stdout ?? '') : null;
  };
  const h = huellaDeCodigo(git);
  assert.ok(h, '🔴 no se pudo calcular la huella en el repo real');
  assert.match(h.huella, /^[0-9a-f]{40}$/);
  assert.ok(h.ficheros > SUELO_FICHEROS_CODIGO, `solo ${h.ficheros} ficheros de código`);
  // Determinista: dos cálculos seguidos sobre el mismo árbol tienen que coincidir, o el criterio
  // sería un generador de falsos positivos y acabaría desactivado.
  assert.equal(huellaDeCodigo(git).huella, h.huella, '🔴 la huella no es estable entre dos lecturas');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS DOS PUNTAS · el runner y el verificador no pueden calcular cosas distintas
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-239 · runner y verificador IMPORTAN el mismo cálculo, no lo reimplementan', () => {
  // La lección de SCRUM-199: dos copias del mismo dato divergen, y aquí divergir significa que
  // el recibo nunca vuelve a validar (o peor, que valida siempre).
  for (const f of ['test-staging-gated.mjs', 'verificar-evidencia-tanda.mjs']) {
    const src = fs.readFileSync(path.join(RAIZ, 'scripts', f), 'utf8');
    assert.match(src, /huellaDeCodigo/, `🔴 ${f} no usa huellaDeCodigo`);
    assert.match(src, /from '\.\/_evidencia-tanda\.mjs'/, `🔴 ${f} no lo importa de la fuente única`);
    assert.doesNotMatch(src, /createHash\(/,
      `🔴 ${f} calcula su propio hash: dos cálculos que pueden divergir`);
  }
});

test('SCRUM-239 · el runner guarda la huella Y el commit (criterio + contexto)', () => {
  const src = fs.readFileSync(path.join(RAIZ, 'scripts', 'test-staging-gated.mjs'), 'utf8');
  assert.match(src, /huella: huella\?\.huella/, '🔴 el recibo no lleva la huella: no habría criterio');
  assert.match(src, /^\s*commit,$/m,
    '🔴 el recibo ya no lleva el commit: es el CONTEXTO que hace reconciliable la medición ' +
    '(«toda medición declara su contexto»), aunque haya dejado de ser el criterio');
});
