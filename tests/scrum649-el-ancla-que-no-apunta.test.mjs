// tests/scrum649-el-ancla-que-no-apunta.test.mjs — SCRUM-649
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LOS CONTROLES DE «EL SHA EXISTE», Y EL QUE DECIDE
//
// `RE_ANCLA` comprueba que el sha tenga FORMA de sha. Un ancla inventada tiene esa forma y
// pasaba en verde. Medido antes de tocar nada, sobre `SCRUM-16.md:3`: cambiar UN dígito del sha
// —manteniendo los 40 hexadecimales— dejaba el guard en **0 rojos**.
//
// Aquí no se re-prueba lo que ya prueba `scrum267`: se prueba que el arreglo distingue, que no
// tumba anclas buenas, y que lo que cerró SCRUM-859 sigue cerrado.
//
// ⚠️ TODO SE EJERCE EN MEMORIA, sobre el registro real y sin escribir un byte en el árbol. La
// primera versión mutaba un fichero de `docs/master/` y corría el guard en un proceso hijo; la
// tumbó SCRUM-824 con toda la razón (la tanda va a concurrencia 12: otro fichero puede estar
// leyendo ese directorio) y de paso me mordió `NODE_TEST_CONTEXT`, que hace que el hijo se niegue
// a ejecutar y salga con 0. Las dos cosas están contadas en `docs/master/SCRUM-649.md`.
//
// ⚠️ NOTA DE TANDA: este fichero importa del guard —es donde viven `trocearEntradas` y
// `sondaDeExistencia`—, e importar un fichero de tests EJECUTA sus tests. Los 14 de
// `scrum267` corren también dentro de éste y el total de la tanda sube en 14. Se dice.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  trocearEntradas, sondaDeExistencia, anclasMuertas, shasVivos, entradasTroceadas, RE_ANCLA,
} from './scrum267-ancla-de-medicion.test.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GUARD = path.join(RAIZ, 'tests/scrum267-ancla-de-medicion.test.mjs');
const DIR = path.join(RAIZ, 'docs/master');

/** Lo que el meta-guard de la casa EJECUTA contra este fichero. */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'tests/scrum267-ancla-de-medicion.test.mjs',
    de: "    .filter((e) => e.sha && !resuelve(e.sha) && !(e.clave in exentas))",
    a: "    .filter((e) => false && e.sha && !resuelve(e.sha) && !(e.clave in exentas))",
    cae: 'SCRUM-649 · 🔴 EL QUE DECIDE: un sha bien formado e INEXISTENTE hace caer el guard',
  },
];

const git = (args, input) =>
  execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8', input, stdio: 'pipe' });

const resuelve = (sha) => /\bcommit\b/.test(git(['cat-file', '--batch-check'], sha + '\n'));

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-649 · SUELO: hay anclas que mirar, y la sonda pasa su control', () => {
  const s = sondaDeExistencia((args, input) => git(args, input));
  assert.equal(s.vale, true, `🔴 CIEGO: ${s.motivo}`);

  const anclas = entradasDelRegistro();
  assert.ok(anclas.length > 300,
    `🔴 CIEGO: sólo ${anclas.length} anclas censadas. Un verde sobre eso no significa nada.`);
});

/**
 * Las entradas del registro que llevan ancla, LEÍDAS CON EL LECTOR DEL GUARD.
 *
 * No con una réplica propia: una réplica se escribe igual hoy y distinta en dos meses, y entonces
 * este control estaría midiendo un árbol que el guard no ve. Es el defecto que SCRUM-700 cazó en
 * mi tanda de esta misma semana.
 */
function entradasDelRegistro() {
  return entradasTroceadas()
    .map((e) => ({ ...e, sha: (RE_ANCLA.exec(e.cuerpo) || [])[1] }))
    .filter((e) => e.sha);
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL QUE DECIDE · un sha bien formado e INEXISTENTE cae, nombrando fichero y línea
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-649 · 🔴 EL QUE DECIDE: un sha bien formado e INEXISTENTE hace caer el guard', () => {
  // Se ejerce la decisión del guard sobre el registro REAL —las 797 anclas del árbol, no una
  // maqueta—, cambiándole UN dígito a una de ellas **en memoria**. Las dos direcciones en la
  // misma pasada: con el sha bueno no sale nada, con el inventado sale ése y sólo ése.
  //
  // ⚠️ Y NO SE ESCRIBE UN BYTE EN EL ÁRBOL, a propósito. La primera versión de este control
  // mutaba el fichero de verdad y corría el guard en un hijo. SCRUM-824 la tumbó, y tenía razón:
  // la tanda corre a concurrencia 12 y otro fichero puede estar leyendo `docs/master/` en ese
  // mismo instante. Un control que fabrica rojos intermitentes acaba apagado, y con él el guard.
  const entradas = entradasDelRegistro();
  assert.ok(entradas.length > 300,
    `🔴 CIEGO: sólo ${entradas.length} entradas con ancla: un rojo aquí no diría gran cosa.`);

  const victima = entradas.find((e) => e.sha && resuelve(e.sha));
  assert.ok(victima, '🔴 CIEGO: no encuentro ningún ancla cuyo sha resuelva.');

  const inventado = (victima.sha[0] === '0' ? '1' : '0') + victima.sha.slice(1);
  assert.match(inventado, /^[0-9a-f]{40}$/,
    '🔴 el sustituto tiene que tener la MISMA forma: si no, no se prueba nada de SCRUM-649.');
  assert.equal(resuelve(inventado), false,
    '🔴 CONTROL ROTO: el sha inventado resuelve. Con eso, lo de abajo no probaría nada.');

  const vivo = new Set(shasVivos([...new Set(entradas.map((e) => e.sha))],
    (args, input) => git(args, input)));
  const sonda = (sha) => vivo.has(sha);

  // ✅ La mitad POSITIVA, primero: tal cual está el árbol, esta entrada NO sale.
  assert.deepEqual(anclasMuertas([victima], sonda), [],
    `🔴 el guard acusa a ${victima.fichero}:${victima.linea}, cuyo sha SÍ resuelve. Un control `
    + 'que acusa a los buenos no distingue nada.');

  // 🔴 Y ahora la misma entrada con un dígito cambiado — y se comprueba que el cambio ENTRÓ.
  const mutada = { ...victima, cuerpo: victima.cuerpo.replace(victima.sha, inventado) };
  assert.notEqual(mutada.cuerpo, victima.cuerpo, '🔴 la mutación no ha cambiado nada.');
  assert.ok(mutada.cuerpo.includes(inventado), '🔴 el sha inventado no está en el cuerpo mutado.');

  const caidas = anclasMuertas([mutada], sonda);
  assert.equal(caidas.length, 1,
    '🔴 el guard sigue en VERDE con un ancla que no apunta a ningún sitio. Eso es exactamente '
    + 'el defecto de SCRUM-649: tener FORMA de sha no es existir.');
  assert.match(caidas[0], new RegExp(victima.fichero.replace('.', '\\.')),
    `🔴 el guard cae pero NO NOMBRA el fichero (${victima.fichero}): un rojo que no dice dónde `
    + 'cuesta la vuelta entera.');
  assert.match(caidas[0], new RegExp(':' + victima.linea + '\\b'),
    '🔴 el guard cae pero no dice en qué LÍNEA.');
  assert.match(caidas[0], new RegExp(inventado),
    '🔴 el guard cae pero no nombra el SHA que no resuelve.');

  // Y sobre el registro ENTERO: exactamente una más que ahora mismo, no un rojo genérico.
  const antes = anclasMuertas(entradas, sonda);
  const despues = anclasMuertas(entradas.map((e) => (e === victima ? mutada : e)), sonda);
  assert.equal(despues.length, antes.length + 1,
    `🔴 sobre las ${entradas.length} entradas reales, cambiar UN dígito pasa de ${antes.length} a `
    + `${despues.length} hallazgos. Tenía que subir en exactamente uno: ni cero (no lo ve) ni más `
    + '(está acusando a otros de paso).');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ✅ POSITIVO · las anclas reales siguen pasando. TODAS.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-649 · ✅ POSITIVO: TODAS las anclas reales resuelven — ni un rojo intermitente', () => {
  // Si el arreglo tumbara anclas buenas porque no sabe resolverlas, habría fabricado un rojo
  // intermitente y alguien lo relajaría. Se comprueba una por una, no «en general».
  const anclas = entradasDelRegistro();
  const shas = [...new Set(anclas.map((a) => a.sha))];
  const vivo = shasVivos(shas, (args, input) => git(args, input));

  // La lista declarada de las que NO resuelven, leída del guard (no copiada aquí).
  const declaradas = new Set([...fs.readFileSync(GUARD, 'utf8')
    .matchAll(/'([^']+\.md#[^']*)':\s*SHA_NO_RESUELVE,/g)].map((m) => m[1]));

  const rotas = anclas.filter((a) => !vivo.has(a.sha) && !declaradas.has(a.clave))
    .map((a) => `${a.fichero}:${a.linea} — ${a.sha}`);
  assert.deepEqual(rotas, [],
    `🔴 hay anclas buenas que este guard no sabe resolver:\n  ${rotas.join('\n  ')}\n`
    + '  Eso no es un ancla mala: es un guard que no sabe mirar, y se relaja en dos semanas.');

  assert.equal(shas.length - vivo.size, declaradas.size,
    `🔴 no resuelven ${shas.length - vivo.size} shas y hay ${declaradas.size} declarados. `
    + 'Los números tienen que cuadrar o el censo no describe el árbol.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ✅ NEGATIVO · lo que cerró SCRUM-859 sigue cerrado
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-649 · ✅ NEGATIVO: SCRUM-859 sigue cerrado — tope de 5 e identidad', () => {
  const fuente = fs.readFileSync(GUARD, 'utf8');
  assert.match(fuente, /TOPE_INVISIBLE_HASTA_859 = 5;/,
    '🔴 el tope de INVISIBLE_HASTA_859 ha dejado de ser 5.');
  const usos = [...fuente.matchAll(/:\s*INVISIBLE_HASTA_859,/g)].length;
  assert.equal(usos, 5, `🔴 hay ${usos} usos de INVISIBLE_HASTA_859 y el motivo está cerrado en 5.`);
  assert.match(fuente, /identidadDeEntrada\(e\.tituloCompleto\)/,
    '🔴 la clave ha vuelto a ser posicional: referenciar por posición caduca.');

  // Y ejercido, no sólo leído: insertar una entrada no puede mover una clave.
  const texto = fs.readFileSync(path.join(DIR, 'SCRUM-244.md'), 'utf8');
  const titulos = (t) => trocearEntradas(t).map((e) => e.tituloCompleto);
  const l = texto.split('\n');
  const corte = l.findIndex((x, i) => i > 0 && /^# /.test(x));
  const conNueva = [...l.slice(0, corte),
    '# SCRUM-244 · insertada por el control de SCRUM-649', '',
    '**Medido contra:** `origin/main` = `' + 'a'.repeat(40) + '` · 2026-09-15T12:00:00+02:00', '',
    ...l.slice(corte)].join('\n');
  const antes = titulos(texto);
  const despues = titulos(conNueva);
  assert.deepEqual(antes.filter((t) => !despues.includes(t)), [],
    '🔴 insertar una entrada ha hecho desaparecer títulos: la identidad ya no es estable.');
});
