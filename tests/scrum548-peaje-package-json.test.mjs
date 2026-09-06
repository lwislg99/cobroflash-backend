// tests/scrum548-peaje-package-json.test.mjs — SCRUM-548
//
// UN CONFLICTO QUE SE RESUELVE SIEMPRE IGUAL NO ES UN CONFLICTO: ES UN PEAJE.
//
// Medido reproduciendo cada merge del repositorio (`npm run censo:conflictos-package`): los tres
// últimos conflictos de `package.json` fueron los DOS lados AÑADIENDO scripts en el mismo punto,
// cero líneas borradas. Se resolvieron siempre igual — se conservan los dos.
//
// ── LO QUE ESTE FICHERO VIGILA, Y POR QUÉ ───────────────────────────────────────────────────
// El coste del peaje no es resolverlo: es que cada merge obligaba a mirar `package.json` a mano, y
// dos de esas veces eso destapó un defecto que nadie buscaba. **Los hallazgos fueron suerte del
// conflicto, no del proceso**, y la suerte se acaba. Aquí se sujeta lo que sustituye a la suerte:
//   · que el censo de guards siga contando TODOS los declarados;
//   · que el detector de solape —la parte derivable de esa revisión manual— siga discriminando;
//   · que nadie vuelva a escribir en un //comentario una cifra que caduca con el commit de otro.
//
// 🔴 NO puede decir que el conflicto haya dejado de pasar: eso lo mide el censo, que tarda ~85 s
//    sobre el historial completo y por eso NO está aquí. Lo que sí se ejercita es su clasificador,
//    que es la parte que puede estar mal; el recorrido es mecánico.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clasificarConflicto, clavesAnadidas, familiaDe } from '../scripts/censo-conflictos-package.mjs';
import { censarSolape, objetivoDe, esDeNavegador, ficheroDe } from '../scripts/_solape-de-guards.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
const SCRIPTS = PKG.scripts || {};

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① EL AVISO LITERAL DE LA FICHA · el censo tiene que seguir contándolos TODOS
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-548 · 🔴 el censo de guards sigue viendo TODOS los declarados', () => {
  const declarados = Object.keys(SCRIPTS).filter((k) => k.startsWith('guard:'));
  const deNavegador = declarados.filter((g) => esDeNavegador(SCRIPTS, g));
  const s = censarSolape(RAIZ);

  assert.equal(s.declarados, declarados.length,
    '🔴 el censo ve menos `guard:*` de los que hay declarados en package.json.');
  assert.equal(s.navegador, deNavegador.length,
    '🔴 el censo ve menos guards de navegador de los que se declaran como tales.\n'
    + '  Es el aviso literal de la ficha: si tras un cambio cuenta menos, se ha roto el\n'
    + '  instrumento que mide el coste — y un total más bajo se lee como «cuestan poco».');

  // SUELO con número: sabemos que hay nueve. Si el detector deja de reconocerlos, esto lo dice
  // en vez de celebrar un cero.
  assert.ok(deNavegador.length >= 9,
    `🔴 CIEGO: sólo ${deNavegador.length} guards de navegador. Había nueve el 20-ago-2026. O se han\n`
    + '  retirado —y hay que decirlo— o `esDeNavegador` dejó de reconocerlos por su //comentario.');

  // Y que cada uno tenga su fichero: un declarado sin fichero baja el total en silencio.
  for (const g of deNavegador) {
    const f = ficheroDe(SCRIPTS, g);
    assert.ok(f && fs.existsSync(path.join(RAIZ, f)),
      `🔴 \`${g}\` está declarado y su fichero no está en el disco: el total saldría más bajo.`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② EL SOLAPE · la parte derivable de la revisión que antes hacía falta un conflicto
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-548 · el detector de solape entiende las DOS formas de escribir el destino', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum548-'));
  try {
    fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
    const escribir = (n, cuerpo) => fs.writeFileSync(path.join(dir, 'scripts', n), cuerpo);

    // Las dos grafías que conviven en la casa, más la que NO se puede resolver.
    escribir('a.mjs', 'await page.goto(`http://127.0.0.1:${PUERTO}/index.html`, { waitUntil: "load" });\n');
    escribir('b.mjs', "await page.goto('http://127.0.0.1:' + puerto + '/index.html', { waitUntil: 'load' });\n");
    escribir('c.mjs', 'await page.goto(`http://127.0.0.1:${PUERTO}/`, { waitUntil: "load" });\n');
    escribir('d.mjs', 'await page.goto(`http://127.0.0.1:${PUERTO}${ruta}`, { waitUntil: "load" });\n');

    assert.deepEqual(objetivoDe(dir, 'scripts/a.mjs').rutas, ['/index.html'], '🔴 no entiende la plantilla');
    assert.deepEqual(objetivoDe(dir, 'scripts/b.mjs').rutas, ['/index.html'],
      '🔴 no entiende la CONCATENACIÓN. La primera versión de esto cortaba en la primera comilla y\n'
      + '  tres guards distintos salían con el destino inventado «http://127.0.0.1:».');
    assert.deepEqual(objetivoDe(dir, 'scripts/c.mjs').rutas, ['/index.html'],
      '🔴 `/` e `/index.html` son LA MISMA página: sin normalizar, cinco guards sobre la landing\n'
      + '  parecerían dos grupos y uno suelto.');

    // 🔴 EL SUELO DEL DETECTOR, y va en la dirección incómoda.
    const d = objetivoDe(dir, 'scripts/d.mjs');
    assert.equal(d.derivado, true,
      '🔴 ha resuelto un destino que sale de una variable. Una versión anterior lo dejaba en cadena\n'
      + '  vacía —o sea `/index.html`— y entonces decía «no resueltos: ninguno» habiendo uno: un\n'
      + '  destino inventado, y encima hacia el lado cómodo.');
    assert.deepEqual(d.rutas, [], '🔴 además le ha atribuido una ruta literal.');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SCRUM-548 · los solapes de hoy son los medidos, y lo no resuelto se declara', () => {
  const s = censarSolape(RAIZ);
  const resumen = s.solapes.map((x) => `${x.guards.length}×${x.ruta}`).sort();
  assert.deepEqual(resumen, ['2×/medicion.html', '5×/index.html'],
    '🔴 HA CAMBIADO QUIÉN MIDE QUÉ PÁGINA.\n'
    + '  No es un defecto por sí solo —dos guards pueden mirar cosas distintas de la misma\n'
    + '  página—, pero es el sitio donde mirar. SCRUM-546 encontró un solape de dos por pura\n'
    + '  suerte de un conflicto de merge; medidos, sobre la landing son cinco.\n'
    + `  Ahora mismo: ${JSON.stringify(s.solapes)}`);

  // SCRUM-648 (fase B) · entra `guard:caja-semaforo`: sirve su página desde una ruta VIRTUAL
  // (`/__caja-semaforo.html`), igual que `guard:caja-avisos`, así que el censo no puede derivar su
  // destino de un fichero del árbol. Se declara para que ese hueco no se lea como «no solapa».
  // Medido: no comparte página con ninguno — es la única que sirve esa ruta.
  // SCRUM-776 · entra `guard:caja-documento-suelto`, por lo mismo: sirve DOS rutas virtuales
  // (`/__caja-justificante.html` y `/__caja-factura.html`), una por modo, así que su destino
  // tampoco sale de un fichero del árbol. Medido: no comparte página con ninguno.
  // 🔴 SCRUM-791 · entra `guard:objetivo-tactil`, y ENTRA A MEDIAS, que es lo interesante: sigue
  // midiendo `/` (la landing) con un `goto` literal —por eso sigue contando en el `5×/index.html`
  // de arriba— pero sus DOS superficies nuevas del panel se sirven desde rutas virtuales elegidas
  // EN UN BUCLE (`${PUERTO}${s.ruta}`), y de una variable no se deriva ningún destino.
  //
  // Este guard me cazó a mí: la entrada de SCRUM-791 decía que no hacía falta mirar el solape
  // «porque no se añade un guard nuevo, se amplía uno». Era falso — ampliarlo cambió su destino.
  //
  // MEDIDO: las dos rutas nuevas (`/__quotes` y `/__jobdetail`) no las sirve ningún otro guard.
  assert.deepEqual(s.noResueltos, ['guard:contraste', 'guard:caja-semaforo', 'guard:caja-documento-suelto', 'guard:caja-datos-del-cliente', 'guard:objetivo-tactil'],
    '🔴 ha cambiado el conjunto de guards cuyo destino NO se puede derivar. Se declaran para que\n'
    + '  su solape invisible no se lea como «no tiene».');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ EL CLASIFICADOR DE CONFLICTOS · peaje vs conflicto de verdad
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-548 · el clasificador separa el peaje del conflicto de verdad', () => {
  // Los dos lados sólo añaden → se conservan los dos, no hay nada que decidir.
  assert.equal(clasificarConflicto({ mas: 2, menos: 0 }, { mas: 2, menos: 0 }), 'DOS SCRIPTS NUEVOS');
  assert.equal(clasificarConflicto({ mas: 2, menos: 0 }, { mas: 8, menos: 0 }), 'DOS SCRIPTS NUEVOS');
  // Alguien cambió lo que ya estaba → ahí el conflicto hace su trabajo.
  assert.equal(clasificarConflicto({ mas: 1, menos: 1 }, { mas: 1, menos: 0 }), 'MODIFICACION REAL');
  assert.equal(clasificarConflicto({ mas: 1, menos: 1 }, { mas: 1, menos: 1 }), 'MODIFICACION REAL');
  // Y si no hay dato, no se inventa una clase.
  assert.equal(clasificarConflicto(null, { mas: 1, menos: 0 }), 'INDETERMINADO');
});

test('SCRUM-548 · sabe decir DÓNDE cae el conflicto', () => {
  const diff = ['+    "//guard:nuevo": "…",', '+    "guard:nuevo": "node scripts/x.mjs",', '-    "viejo": "…",'].join('\n');
  assert.deepEqual(clavesAnadidas(diff), ['//guard:nuevo', 'guard:nuevo'],
    '🔴 no extrae las claves añadidas, o cuenta también las borradas.');
  assert.equal(familiaDe('guard:nuevo'), 'guard');
  assert.equal(familiaDe('//censo:x'), 'censo');
  assert.equal(familiaDe('test'), '(sin familia)');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ QUE NO VUELVA LA CIFRA QUE CADUCA
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * Un recuento de guards escrito a mano, o un total en segundos atribuido al conjunto.
 *
 * ⚠️ La primera versión exigía «N guards DE NAVEGADOR» y se le escapaba «SIETE guards y 45,9 s
 *    en serie», que es literalmente una de las tres frases que este ticket vino a retirar. Lo
 *    cazó el control de abajo. Ahora basta con un número pegado a «guards»: el criterio no es de
 *    qué familia sean, es que **el número lo invalida el commit de otro**.
 */
const N = '(dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|\\d+)';
const CIFRAS_QUE_CADUCAN = [
  // Un RECUENTO DE LA POBLACIÓN: «los siete guards», «hay nueve guards», «cuenta 9 guards».
  new RegExp(`\\b(los|las|hay|son|suman|cuenta)\\s+${N}\\s+guards?\\b`, 'i'),
  new RegExp(`\\b${N}\\s+guards?\\s+de\\s+navegador\\b`, 'i'),
  // Un TOTAL en segundos atribuido al conjunto.
  /de\s+los\s+[\d.,]+\s*s\b/i,
  /[\d.,]+\s*s\s+en\s+serie/i,
];

// ⚠️ Y LO QUE NO CADUCA NO SE PERSIGUE. «dos guards escritos con dos días de diferencia medían la
//    misma página» es un HECHO de 2026 y seguirá siendo verdad en 2027: no lo invalida el commit
//    de nadie. Perseguirlo obligaría a borrar el motivo por el que existe el censo, que es
//    justamente lo que hace que alguien no lo retire. Lo que caduca es el RECUENTO de la
//    población y el TOTAL de su coste.

test('SCRUM-548 · ningún //comentario cita un número de guards ni un total en segundos', () => {
  const malos = [];
  for (const [k, v] of Object.entries(SCRIPTS)) {
    if (!k.startsWith('//')) continue;
    for (const re of CIFRAS_QUE_CADUCAN) if (re.test(String(v))) malos.push(k + '  →  ' + String(v).match(re)[0]);
  }
  assert.deepEqual(malos, [],
    '🔴 HAY UNA CIFRA QUE CADUCA CON EL COMMIT DE OTRO.\n\n'
    + '  Pasó con «siete guards y 45,9 s», que estaba escrito en tres sitios y llevaba días siendo\n'
    + '  falso: son nueve. Un número así no envejece por su culpa — lo invalida el trabajo de otra\n'
    + '  sesión, así que nadie lo revisa.\n\n'
    + '  Y el TOTAL además no es estable ni en la misma máquina: medido, 54 s y 49,6 s en dos\n'
    + '  pasadas seguidas (−8 %), con un guard variando un 29 %. Por eso tampoco hay trinquete\n'
    + '  sobre el coste: sería rojo o verde por suerte, y un rojo permanente es el que el segundo\n'
    + '  que lo ve desactiva.\n\n'
    + '  Remite a `npm run censo:guards-navegador`. El coste de UN guard sí puede escribirse: es\n'
    + `  suyo y no cambia cuando otro añade el suyo.\n  Encontrado: ${JSON.stringify(malos, null, 2)}`);
});

test('SCRUM-548 · ✅ CONTROL: el detector de cifras caducadas sabe encontrarlas', () => {
  // Sin esto, el verde de arriba podría significar «no hay ninguna» o «no sé buscarlas».
  const VIEJOS = [
    'Cuesta 15,9 s de los 45,9 s que suman los siete guards de navegador',
    'Cuesta 6,2 s de los 45,9 s de los siete guards de navegador.',
    'medido hoy, SIETE guards y 45,9 s en serie',
  ];
  for (const v of VIEJOS) {
    assert.ok(CIFRAS_QUE_CADUCAN.some((re) => re.test(v)),
      `🔴 no reconoce como caducada «${v}», que es literalmente lo que había escrito.`);
  }
  // Y que no muerda lo que SÍ puede escribirse: el coste propio de un guard.
  const BUENO = 'Cuesta unos 16 s. Cuantos guards de navegador hay lo dice `npm run censo:guards-navegador`.';
  assert.ok(!CIFRAS_QUE_CADUCAN.some((re) => re.test(BUENO)),
    '🔴 marca como caducado un texto correcto: el coste propio de un guard no depende de nadie más.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ⑤ LA CONVENCIÓN, DONDE LA LEE QUIEN AÑADE UN GUARD
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-548 · la convención está escrita en package.json y dice las cinco cosas', () => {
  const c = String(SCRIPTS['//guards'] || '');
  assert.ok(c, '🔴 falta la entrada `//guards`. La convención tiene que estar donde la lee quien\n'
    + '  añade un guard, no en un documento que no va a abrir.');
  for (const [trozo, porque] of [
    ['ESPERADO', 'que el conflicto es esperado — si no, la próxima sesión lo trata como avería'],
    ['SE CONSERVAN LOS DOS', 'cómo se resuelve, que es siempre igual'],
    ['alfabeticamente', 'por qué ordenar no lo arregla'],
    ['AUTORIDAD', 'por qué no se mudan a otro fichero'],
    ['censo:guards-navegador', 'qué correr al añadir uno, que es lo que sustituye a la suerte'],
  ]) {
    assert.ok(c.includes(trozo), `🔴 la convención no dice ${porque} (falta «${trozo}»).`);
  }
});
