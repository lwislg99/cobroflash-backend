// tests/scrum629-telefono-que-no-se-destruye.test.mjs — SCRUM-629
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UN TEST QUE COMPARA DOS CADENAS VACÍAS PASA, Y NO HA MEDIDO NADA.
//
// Es peor que un test ausente: el ausente no da confianza. Éste sí.
//
// 🔴 LA PREMISA DEL TICKET NO ERA EXACTA, y hay que decirlo antes que nada. Decía que
// `telefonoDePrueba(1)` «se convierte en cadena vacía al normalizar». MEDIDO: no. El número
// COMPLETO —`34000000001`— sobrevive intacto a `normalizePhone`, y lo hace para todo índice que
// quepa en el rango (barrido de 206). Lo que se destruye es el TRAMO NACIONAL, los 9 dígitos sin
// el `34`, que es lo que sale de escribir `.slice(2)` a mano:
//
//     telefonoDePrueba(1)          = 34000000001   → normalizePhone → "34000000001"   ✅
//     telefonoDePrueba(1).slice(2) = 000000001     → normalizePhone → ""               🔴
//
// El `00` de cabeza se lee como prefijo internacional y se quita; quedan 7 dígitos, no pasan el
// `^\d{8,15}$`, y sale la cadena vacía.
//
// LA DISTINCIÓN NO ES UN MATIZ: decide dónde va el arreglo. Si el defecto estuviera en el número
// completo, habría que mover el rango — y eso cambiaría los números que ya usan otros fixtures,
// que es exactamente la regresión que este ticket prohíbe. Como está en el tramo, el suelo va en
// LA OPERACIÓN que lo produce, y los números no se tocan.
//
// LO QUE SE CONSTRUYE: `tramoNacionalDePrueba(n)` en el helper —sitio único— que FALLA EN VOZ
// ALTA en la zona mala en vez de devolver callando algo que se destruye.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url'; // SCRUM-730: `pathname` no decodifica; esto sí.
import {
  telefonoDePrueba, tramoNacionalDePrueba, PRIMER_INDICE_NACIONAL_ESTABLE,
} from '../scripts/_telefonos-prueba.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { normalizePhone } = await import('../dist/core/utils/utils.js');

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · el instrumento tiene que saber ver el defecto antes de contar nada
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-629 · SUELO: `normalizePhone` de verdad destruye el tramo, y de verdad respeta el completo', () => {
  // Sin esto, todo lo de abajo podría estar midiendo un `normalizePhone` que ya no hace nada.
  assert.equal(normalizePhone('000000001'), '',
    '🔴 CIEGO: el `00` ya no se come el tramo. Si el comportamiento cambió, este fichero entero '
    + 'mide otra cosa y hay que releerlo, no ajustar los números.');
  assert.equal(normalizePhone('34000000001'), '34000000001',
    '🔴 CIEGO: el número COMPLETO ya no sobrevive. Eso sería un defecto MUCHO mayor que el de '
    + 'este ticket: lo usan todos los fixtures del repo.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① LA FRONTERA · barrida, no razonada
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-629 · 🔴 LA FRONTERA está donde dice la constante, comprobada a los DOS lados', () => {
  // El comportamiento del `00` ya sorprendió una vez. Aquí no se deduce: se mide.
  const muere = (n) => normalizePhone(telefonoDePrueba(n).slice(2)) === '';

  assert.equal(muere(PRIMER_INDICE_NACIONAL_ESTABLE - 1), true,
    `🔴 ${PRIMER_INDICE_NACIONAL_ESTABLE - 1} debería destruirse y no lo hace: la frontera se ha movido.`);
  assert.equal(muere(PRIMER_INDICE_NACIONAL_ESTABLE), false,
    `🔴 ${PRIMER_INDICE_NACIONAL_ESTABLE} debería sobrevivir y no lo hace: la frontera se ha movido.`);

  // Y no es un salto suelto: por debajo mueren TODOS y por encima sobreviven TODOS.
  for (const n of [1, 2, 9, 99, 9999, 999999, 9999999]) {
    assert.equal(muere(n), true, `🔴 ${n} está por debajo de la frontera y NO se destruye.`);
  }
  for (const n of [10000000, 12345678, 23456789, 99999999]) {
    assert.equal(muere(n), false, `🔴 ${n} está por encima de la frontera y SE destruye.`);
  }
});

test('SCRUM-629 · 🔴 el número COMPLETO no se destruye NUNCA — ahí no había defecto', () => {
  const barrido = [];
  for (let i = 0; i <= 200; i++) barrido.push(i);
  barrido.push(9999999, 10000000, 12345678, 99999999);

  const destruidos = barrido.filter((n) => {
    const t = telefonoDePrueba(n);
    return normalizePhone(t) !== t;
  });
  assert.deepEqual(destruidos, [],
    '🔴 un teléfono de prueba COMPLETO se destruye al normalizar. Eso rompería los fixtures de '
    + 'todo el repo, no sólo los de este ticket.');
  assert.ok(barrido.length >= 200, '🔴 SUELO: el barrido se ha quedado sin casos.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② EL SUELO EN EL HELPER · falla en voz alta, no devuelve callando
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-629 · 🔴 `tramoNacionalDePrueba` FALLA en la zona mala en vez de devolver ""', () => {
  for (const n of [1, 2, 263, 9999999]) {
    assert.throws(() => tramoNacionalDePrueba(n), /cadena vacía|CADENA VACÍA/i,
      `🔴 el índice ${n} produce un tramo que se destruye y el helper lo devolvió en silencio.`);
  }
  // Y el mensaje SIRVE: dice qué hacer, no sólo que no.
  try {
    tramoNacionalDePrueba(1);
    assert.fail('no lanzó');
  } catch (e) {
    assert.match(e.message, /telefonoDePrueba/, '🔴 el mensaje no dice cuál es la alternativa.');
    assert.match(e.message, new RegExp(String(PRIMER_INDICE_NACIONAL_ESTABLE)),
      '🔴 el mensaje no dice desde qué índice es seguro.');
  }
});

test('SCRUM-629 · en la zona segura devuelve el tramo, y sobrevive de verdad', () => {
  for (const n of [10000000, 12345678, 23456789]) {
    const tramo = tramoNacionalDePrueba(n);
    assert.equal(tramo, telefonoDePrueba(n).slice(2), `🔴 el tramo de ${n} no es el del número.`);
    assert.notEqual(normalizePhone(tramo), '',
      `🔴 el helper ha devuelto un tramo de la zona «segura» que AUN ASÍ se destruye (${n}).`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ CONTROL NEGATIVO · los números que ya se usan NO se han movido
// ═════════════════════════════════════════════════════════════════════════════════════════

// Los valores EXACTOS que hoy producen los índices que aparecen en fixtures del repo. Si el
// arreglo los moviera, cualquier fixture que compare contra un literal se rompería en silencio —
// y eso sería una regresión mucho peor que la trampa que este ticket cierra.
const NUMEROS_CONGELADOS = Object.freeze({
  1: '34000000001',
  2: '34000000002',
  42: '34000000042',
  263: '34000000263',
  12345678: '34012345678',
  23456789: '34023456789',
});

test('SCRUM-629 · 🔴 CONTROL NEGATIVO: los índices de hoy dan EXACTAMENTE los mismos números', () => {
  for (const [n, esperado] of Object.entries(NUMEROS_CONGELADOS)) {
    assert.equal(telefonoDePrueba(Number(n)), esperado,
      `🔴 REGRESIÓN: telefonoDePrueba(${n}) ha cambiado de valor. Los fixtures que lo usan `
      + 'comparan contra el número, no contra la función.');
  }
  // Y el helper sigue rechazando lo que no cabe, igual que antes.
  assert.throws(() => telefonoDePrueba(100000000), /no cabe/);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ EL CENSO DE LLAMADORES · con población y con el cero declarado
// ═════════════════════════════════════════════════════════════════════════════════════════

const CARPETAS = ['tests', 'scripts', 'src', 'public', 'prisma'];
const EXTS = new Set(['.mjs', '.js', '.ts', '.cjs']);

function ficheros(dir, acc = []) {
  const abs = path.join(RAIZ, dir);
  if (!fs.existsSync(abs)) return acc;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = dir + '/' + e.name;
    if (e.isDirectory()) {
      if (['node_modules', 'dist', '.git'].includes(e.name)) continue;
      ficheros(rel, acc);
    } else if (EXTS.has(path.extname(e.name))) acc.push(rel);
  }
  return acc;
}

/**
 * 🔴 EL `.slice(2)` A MANO SOBRE UN TELÉFONO DE PRUEBA — que es donde nace la trampa.
 *
 * Se busca por lo que HACE: recortar los dos primeros caracteres de algo que salió del helper.
 * Poner el suelo en el helper no sirve de nada si el `.slice(2)` se sigue escribiendo al lado.
 */
function recortesAMano(src) {
  const out = [];
  for (const m of src.matchAll(/telefonoDePrueba\([^)]*\)\s*\.\s*slice\(\s*2\s*\)/g)) {
    out.push(src.slice(0, m.index).split('\n').length);
  }
  return out;
}

/**
 * CENSO MEDIDO el 4-sep-2026 sobre `origin/main` = 8303db7524d3e0e90659c49f840d47adefaf6d5f.
 *
 * Población: 1.194 ficheros. Llamadas al helper con índice literal: 18, de las cuales 14 en la
 * zona mala. **DAÑO REAL: CERO** — ninguna se destruye, porque todas usan el número COMPLETO.
 *
 * El único sitio que recorta a mano es `scrum578-duplicados-identificador.test.mjs`, y lo hace
 * A PROPÓSITO en su suelo: fija que el tramo de `telefonoDePrueba(1)` da `""`, que es la misma
 * trampa que este ticket cierra, escrita como aserción. Se declara y no se toca — es de otro
 * ticket, y su verde es información, no descuido.
 */
const RECORTES_DECLARADOS = Object.freeze({
  'tests/scrum578-duplicados-identificador.test.mjs': 1,
});

test('SCRUM-629 · 🔴 nadie recorta el prefijo A MANO sin declararlo', () => {
  const todos = CARPETAS.flatMap((c) => ficheros(c));
  assert.ok(todos.length >= 300,
    `🔴 CIEGO: sólo veo ${todos.length} ficheros. Un censo sin corpus da cero por no mirar.`);

  // CONTROL POSITIVO del detector: tiene que cazar la forma exacta que busca.
  assert.equal(recortesAMano('const x = telefonoDePrueba(1).slice(2);').length, 1,
    '🔴 CIEGO: el detector no reconoce el recorte a mano. Su cero no significaría nada.');
  assert.equal(recortesAMano('const x = tramoNacionalDePrueba(1);').length, 0,
    '🔴 FALSO POSITIVO: el detector acusa al idioma correcto.');

  // Dos exclusiones, y las dos por CONSTRUCCIÓN, no por deuda:
  //   · este fichero, que escribe la forma mala en su propio control positivo;
  //   · el HELPER, que es donde VIVE la operación — `tramoNacionalDePrueba` recorta ahí dentro,
  //     que es justamente el punto de tener un sitio único. Acusarlo sería pedirle que no se
  //     implemente a sí mismo.
  const EXCLUIDOS = ['tests/scrum629-telefono-que-no-se-destruye.test.mjs', 'scripts/_telefonos-prueba.mjs'];
  const actual = {};
  for (const f of todos) {
    if (EXCLUIDOS.includes(f)) continue;
    const n = recortesAMano(fs.readFileSync(path.join(RAIZ, f), 'utf8')).length;
    if (n) actual[f] = n;
  }

  const nuevos = Object.keys(actual).filter((f) => !(f in RECORTES_DECLARADOS));
  assert.deepEqual(nuevos, [],
    '🔴 ALGUIEN RECORTA EL PREFIJO A MANO:\n'
    + nuevos.map((f) => `   · ${f} (${actual[f]})`).join('\n')
    + '\n\n  `telefonoDePrueba(n).slice(2)` con un índice pequeño devuelve un tramo que la\n'
    + '  normalización convierte en "". Dos vacíos comparan iguales y el test pasa sin medir.\n'
    + `  Usa \`tramoNacionalDePrueba(n)\`, que falla en voz alta por debajo de ${PRIMER_INDICE_NACIONAL_ESTABLE}.`);

  // El trinquete aprieta también dentro del declarado: si gana otro recorte, cae.
  for (const [f, n] of Object.entries(RECORTES_DECLARADOS)) {
    assert.equal(actual[f] || 0, n,
      `🔴 \`${f}\` declaraba ${n} recorte(s) y ahora tiene ${actual[f] || 0}.`);
  }
});
