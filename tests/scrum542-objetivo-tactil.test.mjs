// tests/scrum542-objetivo-tactil.test.mjs — SCRUM-542
//
// LA RED QUE SÍ CORRE SIEMPRE. El árbitro de verdad es `npm run guard:objetivo-tactil`, que abre
// Edge, hace scroll y pregunta punto por punto qué activaría el dedo. Este fichero NO lo
// sustituye: la suite no arranca navegador (misma decisión que el resto de guards de navegador —
// cuántos son y qué cuestan lo dice `npm run censo:guards-navegador`, no un número escrito aquí,
// que caduca).
//
// ── LO QUE ESTE FICHERO NO PUEDE DECIR, Y SE DICE CON ESAS PALABRAS ─────────────────────────
// 🔴 NO puede decir que un táctil llegue a 44 px. Medido en este ticket: el botón principal de
//    `.cta-band` tenía `min-height` de sobra —caja de 61,8 px— y a 360 px sólo respondían 41,5,
//    porque un círculo decorativo del padre le comía los 20 de arriba. En el HTML las dos
//    situaciones se escriben IGUAL. Sólo el navegador sabe qué recibe el toque.
// Aquí se vigila que las PIEZAS sigan puestas y que el guard no desaparezca ni se le baje el
// listón.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANDING = fs.readFileSync(path.join(RAIZ, 'public', 'index.html'), 'utf8');
const GUARD_RUTA = path.join(RAIZ, 'scripts', 'guard-objetivo-tactil.mjs');
const PKG = fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8');

const veces = (texto, aguja) => texto.split(aguja).length - 1;

// ── ① SUELO ────────────────────────────────────────────────────────────────────────────────
test('SCRUM-542 · SUELO: la landing y el guard se leen enteros', () => {
  assert.ok(LANDING.length > 20000, '🔴 CIEGO: public/index.html vino demasiado corto.');
  const n = (LANDING.match(/<section/g) || []).length;
  assert.ok(n >= 9, `🔴 CIEGO: sólo veo ${n} secciones. El verde de abajo no significaría nada.`);
  assert.ok(fs.existsSync(GUARD_RUTA), '🔴 CIEGO: no existe scripts/guard-objetivo-tactil.mjs.');
});

// ── ② LAS CINCO PIEZAS, UNA VEZ CADA UNA ───────────────────────────────────────────────────
// ⚠️ Se busca la DECLARACIÓN COMPLETA, no el trozo suelto. `pointer-events:none` aparece 4 veces
//    en el fichero —dos de ellas ajenas a este ticket y una dentro de mi propio comentario— así
//    que contar el trozo suelto no distinguiría «puesto» de «mencionado». Es la trampa de la
//    autorreferencia, y aquí se evita anclando a algo que sólo puede ser la regla.
const PIEZAS = [
  {
    que: 'la decoración de .cta-band ya no intercepta el toque',
    ancla: '.cta-band::after{content:"";pointer-events:none;',
    porque: 'sin esto, a 360 px el botón principal pierde sus 20 px de arriba (medido: 41,5 de 61,8).',
  },
  {
    que: 'los enlaces del nav tienen los 2 px de padding que faltaban',
    ancla: '.nav-links a.t{padding:11px 13px;',
    porque: 'con 9px medían 40,9. AB6 son 44, y «casi» no es un umbral.',
  },
  {
    que: '«Volver a empezar» tiene alto mínimo',
    ancla: 'gap:6px;min-height:44px}',
    porque: 'medía 28,5 px. Ya era inline-flex centrado, así que el min-height manda.',
  },
  {
    que: 'los enlaces del pie dejaron de ser cajas en línea de 17 px',
    ancla: 'margin-left:18px;display:inline-flex;align-items:center;min-height:44px}',
    porque: 'eran los peores del fichero: 17,5 px, menos de la mitad de AB6. Un `min-height` a '
      + 'secas NO les habría servido: en `display:inline` el alto no se aplica.',
  },
  {
    que: 'sólo los .p-link que son ENLACE llevan el alto mínimo',
    ancla: '.prod a.p-link{min-height:44px}',
    porque: 'los 6 de #todo son `<span>` sin href ni manejador: no son táctiles. Si alguien '
      + 'quita la `a` del selector, estira seis tarjetas publicadas sin que nadie gane nada.',
  },
];

for (const p of PIEZAS) {
  test(`SCRUM-542 · sigue puesta: ${p.que}`, () => {
    assert.equal(veces(LANDING, p.ancla), 1,
      `🔴 falta o está duplicada la regla \`${p.ancla}\` — ${p.porque}`);
  });
}

// ── ③ CONTROL DE LOS DETECTORES ────────────────────────────────────────────────────────────
// Cinco anclas que aparecen una vez cada una podrían ser cinco anclas que casan con cualquier
// cosa. Se comprueba contra un corpus que NO las tiene: si alguna saltara ahí, el verde de
// arriba no diría nada.
test('SCRUM-542 · control: las cinco anclas saben decir que NO', () => {
  // ⚠️ El corpus es SÓLO CSS a propósito, con los CASI-ACIERTOS dentro: el padding viejo del
  //    nav y un min-height de 44 suelto en otra regla. Si un ancla casara con eso, estaría
  //    mirando el trozo y no la regla. (Y sin etiquetas HTML pegadas: SCRUM-553 mide eso, y un
  //    corpus de mentira cuenta igual que un extractor de verdad.)
  const sinNada = '.cta-band::after{content:""}.foo{min-height:44px}.nav-links a.t{padding:9px 13px;color:red}';
  for (const p of PIEZAS) {
    assert.equal(veces(sinNada, p.ancla), 0,
      `🔴 el ancla de «${p.que}» casa con un corpus que no la tiene: no discrimina.`);
  }
});

// ── ④ EL GUARD NO SE VACÍA POR DENTRO ──────────────────────────────────────────────────────
// Que el fichero exista no es que siga midiendo. Estas cuatro son las que hacen que su verde
// signifique algo; si desaparecen, el guard sigue pasando y ya no mide nada.
// ⚠️ SCRUM-562 · SE MIRAN LOS DOS FICHEROS, y el motivo importa más que el cambio: el árbitro,
//    el afinado y los controles se mudaron a `scripts/_medidor-de-toque.mjs` para que este guard
//    y el de SCRUM-543 no puedan volver a medir distinto. Las comprobaciones de abajo SIGUEN al
//    mecanismo a su sitio nuevo; borrarlas porque «ya no están aquí» habría dejado de vigilar
//    justo lo que se acababa de centralizar.
const MEDIDOR_RUTA = path.join(RAIZ, 'scripts', '_medidor-de-toque.mjs');
const GUARD = fs.readFileSync(GUARD_RUTA, 'utf8') + '\n' + fs.readFileSync(MEDIDOR_RUTA, 'utf8');
const TRIPAS = [
  ['MINIMO_TACTIL = 44', 'AB6 no se baja. Si algún caso no puede llegar, va a EXCEPCIONES con su motivo — no se toca el umbral. (Vive en `_medidor-de-toque.mjs` desde SCRUM-562: un solo umbral para todos los guards.)'],
  ['scrollIntoView', 'sin scroll, `elementsFromPoint` no ve el pie y el censo devuelve cero defectos por ceguera.'],
  ['.closest(INTERACTIVOS) === el', 'el árbitro. Con `.includes(el)` un elemento TAPADO cuenta como tocable.'],
  ['CIEGO: cero táctiles medidos', 'el suelo: un cero tiene que fallar, no aprobar.'],
  ['const ANCHOS = [1280, 360];', 'los dos anchos: un arreglo que sirva en uno y rompa el otro no vale.'],
];
for (const [ancla, porque] of TRIPAS) {
  test(`SCRUM-542 · el guard conserva: ${ancla}`, () => {
    assert.ok(GUARD.includes(ancla), `🔴 el guard perdió \`${ancla}\` — ${porque}`);
  });
}

// ── ⑤ NINGUNA EXCEPCIÓN SIN MOTIVO ─────────────────────────────────────────────────────────
// Hoy la lista está vacía. El día que alguien meta una, que no pueda meterla a secas: una
// excepción sin motivo y sin quién la retira no es una excepción, es un umbral bajado en voz baja.
test('SCRUM-542 · toda excepción declarada trae su motivo', () => {
  const i = GUARD.indexOf('const EXCEPCIONES = [');
  assert.ok(i > 0, '🔴 CIEGO: no encuentro la lista de excepciones en el guard.');
  const bloque = GUARD.slice(i, GUARD.indexOf('];', i));
  const entradas = veces(bloque, 'sel:');
  assert.equal(veces(bloque, 'motivo:'), entradas,
    `🔴 hay ${entradas} excepción(es) y ${veces(bloque, 'motivo:')} motivo(s). Sin motivo escrito, no es una excepción.`);
});

// ── ⑥ EL COMANDO SIGUE ENGANCHADO ──────────────────────────────────────────────────────────
test('SCRUM-542 · el guard tiene comando npm y su //comentario', () => {
  assert.equal(veces(PKG, '"guard:objetivo-tactil"'), 1, '🔴 falta el comando en package.json.');
  assert.equal(veces(PKG, '"//guard:objetivo-tactil"'), 1,
    '🔴 falta el //comentario que dice qué mide y por qué. Un comando sin explicación se borra el día que estorba.');
});
