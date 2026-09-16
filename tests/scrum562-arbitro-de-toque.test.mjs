// tests/scrum562-arbitro-de-toque.test.mjs — SCRUM-562
//
// EL IDIOMA QUE PRODUCÍA VERDES FALSOS.
//
//     const toca = (y) => document.elementsFromPoint(cx, y).includes(el);
//
// Pregunta «¿está el elemento en la pila?», y contesta que sí aunque haya otra cosa ENCIMA. Su
// fallo va en la dirección cómoda. Lo destapó SCRUM-542: un decorativo de 420×420 sin
// `pointer-events:none` se comía los 20 px superiores del botón principal — caja 61,8, área real
// 41,5, invisible a 1280 y en cualquier revisión del CSS.
//
// ── LO QUE ESTE FICHERO NO PUEDE DECIR ─────────────────────────────────────────────────────
// 🔴 NO puede decir que ningún objetivo esté tapado. Eso sólo lo sabe el navegador:
//    `npm run guard:objetivo-tactil` y `npm run guard:a11y-landing`. Aquí se vigila que el
//    idioma malo no vuelva, que el medidor único conserve sus tres piezas, y que los dos guards
//    sigan colgando de él en vez de llevar cada uno su copia — que es como llegaron a medir
//    distinto.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  censarIdioma, censarPseudos, clasificar, reglasDePseudo, SUPERFICIE_PUBLICA, ZONAS_VENDIDAS,
} from '../scripts/censo-arbitro-de-toque.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① SUELO · un cero aquí parece una respuesta
// ═════════════════════════════════════════════════════════════════════════════════════════

const IDIOMA = censarIdioma(RAIZ);

test('SCRUM-562 · 🔴 SUELO: el censo del idioma VE llamadas de verdad', () => {
  assert.ok(IDIOMA.length >= 10,
    `🔴 CIEGO: sólo ${IDIOMA.length} llamadas en todo el árbol. Con el recorrido roto, «no queda `
    + 'ni un uso del idioma viejo» y «no supe mirar» dan el mismo cero.');
  // Y que vea las DOS zonas: si sólo viera la nuestra, el reparto de abajo no significaría nada.
  assert.ok(IDIOMA.some((x) => !x.vendido), '🔴 no ve ni una llamada en nuestro código');
  assert.ok(IDIOMA.some((x) => x.vendido), `🔴 no ve ninguna en ${ZONAS_VENDIDAS.join(' / ')}`);
});

test('SCRUM-562 · 🔴 SUELO: y ve las llamadas concretas que sabemos que existen', () => {
  // Nombradas. Si el filtro se aprieta de más, esto lo dice en vez de celebrar un cero.
  const nuestras = IDIOMA.filter((x) => !x.vendido).map((x) => x.rel);
  for (const rel of ['scripts/_medidor-de-toque.mjs', 'scripts/guard-objetivo-tactil.mjs']) {
    assert.ok(nuestras.includes(rel), `🔴 CIEGO: el censo no ve la llamada de ${rel}, y está ahí.`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② EL TRINQUETE · cero usos del idioma malo en nuestro código
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-562 · 🔴 nadie vuelve a preguntar por PERTENENCIA a la pila', () => {
  const malos = IDIOMA.filter((x) => !x.vendido && x.clase === 'PERTENENCIA');
  assert.deepEqual(malos.map((x) => `${x.rel}:${x.linea}`), [],
    '🔴 HA VUELTO EL IDIOMA QUE DA POR BUENO LO QUE OTRO ELEMENTO TAPA.\n'
    + '  `elementsFromPoint(...).includes(el)` contesta que sí aunque algo esté encima. Su fallo\n'
    + '  produce VERDES, así que nadie lo nota hasta que un usuario no puede pulsar.\n'
    + '  Usa `scripts/_medidor-de-toque.mjs`, que ya trae el árbitro, el centro y el afinado.');
});

test('SCRUM-562 · y ningún uso nuestro se queda sin clasificar', () => {
  const dudosos = IDIOMA.filter((x) => !x.vendido && x.clase === 'OTRO');
  assert.deepEqual(dudosos.map((x) => `${x.rel}:${x.linea}`), [],
    '🔴 hay llamadas que el clasificador no entiende. No se dan por buenas: míralas y, si el uso\n'
    + '  es legítimo, enseña al clasificador a reconocerlo.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ EL CLASIFICADOR · si no distingue, el trinquete de arriba no vale nada
// ═════════════════════════════════════════════════════════════════════════════════════════

// ⚠️ LOS CORPUS SE ARMAN POR CONCATENACIÓN, Y NO ES CAPRICHO. Escritos tal cual, el censo de
//    ESTE MISMO TICKET los contaría como llamadas de verdad y este fichero saldría como deuda
//    nuestra: el instrumento entraría en su propia población. Se esquiva por construcción y no
//    con una lista de exclusión, porque excluir el fichero entero taparía también un uso malo
//    de verdad escrito aquí algún día.
const EFP = 'document.elements' + 'FromPoint';
const EFP1 = 'document.element' + 'FromPoint';

test('SCRUM-562 · el clasificador distingue las cuatro clases', () => {
  const CASOS = [
    ['TOPE', `const a = ${EFP}(x, y)[0];`],
    ['TOPE', `const pila = ${EFP}(x, y);\nreturn pila[0] === el;`],
    ['PERTENENCIA', `const toca = (y) => ${EFP}(cx, y).includes(el);`],
    ['PERTENENCIA', `const pila = ${EFP}(x, y);\nreturn pila.some((n) => n === el);`],
    ['POSICION', `const stack = ${EFP}(x, y);\nconst i = stack.findIndex((n) => n === el);\nfor (const n of stack.slice(i + 1)) {}`],
    ['SINGULAR', `const target = ${EFP1}(e.clientX, e.clientY);`],
  ];
  for (const [esperada, trozo] of CASOS) {
    assert.equal(clasificar(trozo), esperada,
      `🔴 «${trozo.split('\n')[0]}» se clasificó como ${clasificar(trozo)} y es ${esperada}.`);
  }
});

test('SCRUM-562 · 🔴 ante la duda dice OTRO, nunca TOPE', () => {
  // El sesgo importa: un clasificador que ante lo raro contesta «correcto» convierte cada caso
  // que no entiende en un aprobado silencioso — el mismo fallo que este ticket viene a quitar.
  const raro = `const pila = ${EFP}(x, y);\nmandarloAOtroSitio(pila);`;
  assert.equal(clasificar(raro), 'OTRO',
    '🔴 ha dado por bueno un uso que no entiende. Ante la duda, OTRO: se mira, no se aprueba.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ UN SOLO MEDIDOR · lo que dejó que dos guards midieran distinto fue tener dos copias
// ═════════════════════════════════════════════════════════════════════════════════════════

const MEDIDOR = leer('scripts/_medidor-de-toque.mjs');

const PIEZAS = [
  ['arriba.closest(SEL) === el', 'el árbitro. Con `.includes(el)` un elemento TAPADO cuenta como tocable.'],
  ['let top = cy, bottom = cy;', 'se expande DESDE EL CENTRO. El bucle viejo salía de los bordes de la caja '
    + 'y sólo hacia fuera: nunca encogía, así que un elemento tapado por arriba seguía devolviendo '
    + 'el alto de su caja aunque el árbitro fuese el bueno.'],
  ['const afinar = (bueno, malo)', 'el afinado por bisección. Sin él, un objetivo de 44,0 exactos se '
    + 'lee 43,5 por cuantización y se denuncia un defecto de CSS que no existe.'],
  ['el detector no lo alcanza ni en su centro', 'el control positivo del propio detector.'],
  ['no sabe decir que no', 'el control negativo: 400 px más abajo no puede seguir siendo suyo.'],
];
for (const [ancla, porque] of PIEZAS) {
  test(`SCRUM-562 · el medidor conserva: ${ancla.slice(0, 34)}`, () => {
    assert.ok(MEDIDOR.includes(ancla), `🔴 el medidor perdió \`${ancla}\` — ${porque}`);
  });
}

test('SCRUM-562 · los dos guards cuelgan del medidor único', () => {
  for (const rel of ['scripts/guard-objetivo-tactil.mjs', 'scripts/guard-a11y-landing.mjs']) {
    assert.match(leer(rel), /_medidor-de-toque\.mjs/,
      `🔴 ${rel} ya no importa el medidor común. Volver a tener una copia en línea es exactamente\n`
      + '  lo que dejó que estos dos midieran distinto durante dos días.');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ⑤ LOS PSEUDO-ELEMENTOS · y el control de que NO se pide `pointer-events:none` para todos
// ═════════════════════════════════════════════════════════════════════════════════════════

const PSEUDOS = censarPseudos(SUPERFICIE_PUBLICA.map((r) => r));

test('SCRUM-562 · 🔴 SUELO: el censo de pseudo-elementos lee CSS de verdad', () => {
  assert.ok(PSEUDOS.length >= 15,
    `🔴 CIEGO: sólo ${PSEUDOS.length} reglas de pseudo-elemento en toda la superficie pública. El `
    + 'extractor no está leyendo el CSS, y un cero de candidatos se leería como «no hay riesgo».');
  assert.equal(PSEUDOS.filter((p) => p.error).length, 0,
    `🔴 hay ficheros declarados que no existen: ${JSON.stringify(PSEUDOS.filter((p) => p.error))}`);
});

test('SCRUM-562 · ✅ CONTROL: una ampliación INTENCIONADA no se marca como candidata', () => {
  // `.announce a::after` amplía el área del enlace de 23,6 a 47 px a propósito (SCRUM-543). Un
  // censo que pidiera `pointer-events:none` para todo pseudo-elemento rompería ese arreglo bueno.
  const amplian = PSEUDOS.filter((p) => p.clase === 'AMPLIA SU PROPIA AREA');
  assert.ok(amplian.length >= 1,
    '🔴 no reconoce ninguna ampliación intencionada. Entonces la clase no existe de hecho y el\n'
    + '  día que alguien mire los candidatos, le pedirá que rompa el arreglo de «Ver planes →».');
  for (const p of amplian) {
    assert.equal(p.clase, 'AMPLIA SU PROPIA AREA');
    assert.ok(!p.protegido, `🔴 ${p.base} ya lleva pointer-events:none: no ilustra el caso.`);
  }
});

test('SCRUM-562 · el clasificador de pseudo-elementos distingue las cuatro clases', () => {
  const css = [
    '.tapa::after{content:"";position:absolute;inset:0}',            // CANDIDATO
    '.segura::after{content:"";position:absolute;inset:0;pointer-events:none}', // PROTEGIDO
    '.announce a::after{content:"";position:absolute;top:-12px;bottom:-12px}',  // AMPLIA
    '.vineta li::before{content:"·";margin-right:4px}',              // EN FLUJO
  ].join('\n');
  const r = reglasDePseudo(css);
  assert.equal(r.length, 4, `🔴 esperaba 4 reglas y saqué ${r.length}: el extractor de CSS falla.`);
});

test('SCRUM-562 · los candidatos de hoy son exactamente los cinco medidos', () => {
  const hoy = PSEUDOS.filter((p) => p.clase === 'CANDIDATO').map((p) => p.rel + ' — ' + p.base).sort();
  assert.deepEqual(hoy, [
    'public/index.html — .beat-label .pulse',
    'public/index.html — .hero',
    'public/index.html — .iphone',
    'public/index.html — .phone',
    'public/index.html — .price-card li',
  ],
  '🔴 HA CAMBIADO EL CONJUNTO DE DECORATIVOS QUE PUEDEN COMERSE UN TOQUE.\n'
  + '  Esto NO es un veredicto —hoy ninguno tapa nada, y quien lo decide es el guard de\n'
  + '  navegador—, es un mapa de dónde mirar. Si ha crecido, mide el nuevo antes de darlo por\n'
  + `  inofensivo.\n  Ahora mismo: ${JSON.stringify(hoy, null, 2)}`);
});
