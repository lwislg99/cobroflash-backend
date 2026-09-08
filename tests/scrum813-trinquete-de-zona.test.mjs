// tests/scrum813-trinquete-de-zona.test.mjs — SCRUM-813
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA RED QUE SÍ CORRE SIEMPRE.
//
// El trinquete de verdad —`npm run trinquete:zona`— barre 800 ficheros en dos zonas y cuesta
// minutos, así que vive fuera de `npm test`, en su propio job del CI, como `meta:mutaciones`.
//
// Ese reparto tiene un agujero conocido y esta casa ya lo ha pagado: **un instrumento que sólo
// corre en un sitio se pudre en silencio entre pasada y pasada**. Basta que alguien cambie una
// constante, que `run()` deje de emitir lo que se le lee, o que la sonda de `TZ` deje de llegar,
// para que la pasada siguiente devuelva un cero perfecto que nadie sabrá leer como avería.
//
// Aquí se corre **el mismo camino de medición**, con los mismos canarios y las mismas zonas, y
// sólo sobre ellos: cuatro ficheros minúsculos en vez de ochocientos. Segundos. Lo caro es barrer
// el árbol; comprobar que el aparato VE, no.
//
// ── 🔴 EL CONTROL QUE DECIDE, Y ESTÁ EN LOS DOS SENTIDOS ───────────────────────────────────
//
//   ① METE UN TEST QUE DEPENDA DE LA ZONA → EL TRINQUETE TIENE QUE HABLAR. Es exactamente lo que
//      no pasó el 4-sep-2026, cuando SCRUM-592 metió tres y nada dijo nada. Aquí se provoca en
//      cada tanda con dos canarios dependientes, uno por signo de desfase.
//
//   ② LOS QUE YA FIJAN SU ZONA NO SE DENUNCIAN. Un detector que marca a los inocentes marca el
//      árbol entero y se desactiva por ruido en una semana — que es la otra forma de no tener
//      trinquete. Dos canarios fijados lo comprueban.
//
// ⛔ LO QUE ESTE FICHERO NO HACE: barrer el árbol. Su verde NO dice que no haya tests nuevos
// dependientes de zona — eso sólo lo dice la pasada completa. Dice que el aparato que lo mira
// sigue viendo.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';   // SCRUM-730: `pathname` no decodifica el espacio
import { execFileSync } from 'node:child_process'; // SCRUM-813b: contrastar la marca contra git

import {
  AUSENTE, CANARIOS, CENSADAS, SALIDA_APAGADA, SALIDA_CIEGO, SALIDA_HABLA, SALIDA_OK, ZONAS,
  arbolQuieto, cambianDeVeredicto, claveDe, entornoLimpio, escribirCanarios, ficherosDeLaTanda,
  ESCRITURAS_DE_LA_TANDA, huellaPorRuta, juzgarCanarios, marcaDelArbol, medirEnZona,
  sondaDeZona, veredicto,
} from '../scripts/_trinquete-de-zona.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 🔴 MUTACIONES_QUE_ME_TUMBAN · SCRUM-745. Cada una imita el defecto que este guard promete cazar.
// Se ejecutan con `npm run meta:mutaciones`: aplica, exige el ROJO, restaura y compara bytes.
export const MUTACIONES_QUE_ME_TUMBAN = [
  // ① EL TRINQUETE SE QUEDA MUDO: el diferencial deja de encontrar nada, que es la avería que
  //    convierte una pasada completa en un cero perfecto sin significado.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: '    if (distintos.size > 1) {',
    a: '    if (false) {',
    cae: 'el trinquete HABLA: un test que depende de la zona sale denunciado',
  },
  // ② EL TRINQUETE GRITA A TODO: denuncia también a los que fijan su zona. Así se apaga por ruido.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: '    if (distintos.size > 1) {',
    a: '    if (distintos.size >= 1) {',
    cae: 'el trinquete NO denuncia a los tests que YA fijan su zona',
  },
  // ③ LA ZONA DEJA DE LLEGAR AL HIJO: las dos pasadas medirían la MISMA zona y el diferencial
  //    saldría vacío — un cero perfecto que no significa nada. Es la avería que la sonda existe
  //    para cazar, y aquí se provoca de verdad en vez de aflojar la comparación.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: '  const env = { ...base, TZ: zona };',
    a: '  const env = { ...base };',
    cae: 'SUELO: la zona LLEGA al proceso hijo, y se comprueba antes de medir',
  },
  // ④ UNA CENSADA QUE SE APAGA DEJA DE SER ROJA: el peor movimiento de los dos, en silencio.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: '  const apagadas = censadas.filter((c) => !vistas.has(c.clave));',
    a: '  const apagadas = [];',
    cae: 'una CENSADA que deja de cambiar de veredicto pone el trinquete en ROJO',
  },
  // ⑤ EL SUELO SE CAE: cero dependientes teniendo censadas vuelve a leerse como «no hay».
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: '  const cieloRaso = cambianEnElArbol.length === 0 && censadas.length > 0;',
    a: '  const cieloRaso = false;',
    cae: 'SUELO: CERO dependientes teniendo censadas NO es un cero — es CIEGO',
  },
  // ─────────────────────────────────────────────────────────────────────────────────────────
  // SCRUM-813b · las tres del DETALLE POR RUTA. Las tres se han provocado a mano antes de
  // escribirlas aquí, y las tres tumbaron SU caso y sólo el suyo.
  // ─────────────────────────────────────────────────────────────────────────────────────────
  // ⑥ EL SUELO DEL DETALLE SE CAE: un árbol que se movió pero cuyo troceado por ruta no supo
  //    leer pasaría por QUIETO. Es la única forma en que este refinamiento podría abrir un
  //    agujero, así que es la que más falta hace vigilar.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    // ⚠️ REAPUNTADA en SCRUM-813c: la condición ganó `!amparadas.length` al acotar el sujeto, y
    // el texto viejo pasó a casar CERO veces — o sea que esta mutación se aplicaba sobre nada y
    // pasaba en verde sin haber mutado. Lo cazó la comprobación de anclas del propio ticket.
    de: '  if (!rutas.length && !amparadas.length && antes.huella !== despues.huella) {',
    a: '  if (false) {',
    cae: 'SUELO: si el detalle por ruta NO ve nada pero la huella global cambió, sigue siendo CIEGO',
  },
  // ⑦ EL CIEGO VUELVE A SER MUDO: sigue cerrando la puerta, pero deja de decir QUÉ se movió — que
  //    es exactamente el defecto que este apartado cierra.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: '    for (const x of rutas) cambios.push(`${x.ruta}   ${x.antes} → ${x.despues}`);',
    a: '    for (const x of rutas) cambios.push("el contenido del arbol cambio");',
    cae: 'EL QUE DECIDE: un fichero de TEST tocado durante la medición sigue siendo CIEGO',
  },
  // ⑧ LA MARCA DEJA DE TRAER EL DETALLE: el instrumento vuelve a tirar el resultado después de
  //    calcularlo, que es la avería original con otra cara.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: '    porRuta: huellaPorRuta(estado.stdout, diff.stdout),',
    a: '    porRuta: new Map(),',
    cae: 'la marca REAL trae el detalle, y cuadra con lo que dice git',
  },
  // ─────────────────────────────────────────────────────────────────────────────────────────
  // SCRUM-813c · las tres del SUJETO ACOTADO. Las tres provocadas a mano antes de escribirlas:
  // cada una tumbó SU caso y sólo el suyo.
  // ─────────────────────────────────────────────────────────────────────────────────────────
  // ⑨ LA LISTA SE VUELVE ZONA FRANCA: se ampara TODO, y entonces tocar un fichero de `tests/`
  //    durante la medición ya no ciega. Es la forma en que este acotado apagaría la puerta.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: '      if (laEscribeLaTanda(r, declaradas)) amparadas.push(movimiento);',
    a: '      if (true) amparadas.push(movimiento);',
    cae: 'EL QUE DECIDE: un fichero de TEST tocado a mano DURANTE la medición sigue siendo CIEGO',
  },
  // ⑩ SE QUITA EL SUELO DE LA LISTA VACÍA: vaciar la declaración devolvería la puerta al estado
  //    de antes —cegando siempre— y encima en verde, sin que nadie lo hubiera decidido.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: '  if (!declaradas.length) {',
    a: '  if (false) {',
    cae: 'SUELO: con la lista de escrituras VACÍA es CIEGO, no «árbol limpio»',
  },
  // ⑪ NADA SE AMPARA: el acotado deja de existir y el instrumento vuelve a callarse en cada
  //    pasada de CI. Es el defecto que este apartado cierra.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: '  return declaradas.some((d) => r === d.ruta',
    a: '  return [].some((d) => r === d.ruta',
    cae: 'POSITIVO: la tanda escribiendo LO SUYO no ciega — el trinquete EMITE veredicto',
  },
];

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① SUELO · sin esto, todo lo de abajo pasa sin medir
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-813 · SUELO: la zona LLEGA al proceso hijo, y se comprueba antes de medir', () => {
  // El prefijo `TZ=x node` de Git Bash NO funciona en Windows (medido en SCRUM-640). Lo que sí
  // funciona es `TZ` como ENTORNO de un proceso hijo, y es lo único que este instrumento usa.
  // Si esto cayera, cada «pasada por zona» estaría midiendo la zona de la máquina y el censo
  // devolvería un cero que no significa nada.
  for (const zona of ZONAS) {
    const s = sondaDeZona(zona);
    assert.equal(s.ok, true,
      `🔴 CIEGO: pedí \`${zona}\` al hijo y el hijo ve \`${s.vista || '(nada)'}\`. Sin esto, las dos `
      + 'pasadas medirían LA MISMA zona y el diferencial sería siempre vacío.');
  }
});

test('SCRUM-813 · SUELO: la línea base existe, está bien formada y APUNTA A ALGO REAL', () => {
  assert.ok(CENSADAS.length > 0,
    '🔴 la lista de censadas está VACÍA. El 7-sep-2026 había TRES medidas. O se han arreglado —y '
    + 'entonces esto se retira a mano diciéndolo, con SCRUM-643 §2·A decidido— o alguien la ha '
    + 'vaciado para que el trinquete se callara.');

  for (const c of CENSADAS) {
    const [fichero, ...resto] = c.clave.split('::');
    const prueba = resto.join('::');
    assert.ok(prueba, `🔴 clave sin nombre de prueba: ${c.clave}`);
    assert.ok(c.porque && c.parado_en,
      `🔴 \`${c.clave}\` no dice por qué está censada ni dónde está parada. Una lista de claves sin `
      + 'motivo es una lista blanca.');

    // 🔴 ANCLADA POR IDENTIDAD, no por posición (SCRUM-710b): el fichero tiene que existir y el
    // nombre de la prueba tiene que estar DENTRO. Si alguien renombra la prueba, esto lo dice
    // aquí y en una línea, en vez de dejar que la pasada completa lo llame «apagada» dentro de
    // trece minutos.
    const abs = path.join(RAIZ, fichero);
    assert.ok(fs.existsSync(abs), `🔴 la censada apunta a un fichero que no existe: ${fichero}`);
    assert.ok(fs.readFileSync(abs, 'utf8').includes(prueba),
      `🔴 \`${fichero}\` ya no contiene una prueba llamada «${prueba}». O se renombró —y hay que `
      + 'actualizar la clave— o se borró, y entonces hay que decidir qué pasa con lo que estaba '
      + 'parado en SCRUM-643 §2·A.');
  }
});

test('SCRUM-813 · SUELO: la tanda que el trinquete barre es la MISMA que corre `npm test`', () => {
  // Si `ficherosDeLaTanda` se quedara corto, el trinquete barrería medio árbol y su cero sería
  // un cero de lo que miró, no del árbol.
  const vistos = ficherosDeLaTanda(RAIZ);
  const enDisco = fs.readdirSync(path.join(RAIZ, 'tests')).filter((f) => f.endsWith('.test.mjs'));
  assert.equal(vistos.length, enDisco.length,
    `🔴 el trinquete ve ${vistos.length} ficheros y en \`tests/\` hay ${enDisco.length}.`);
  assert.ok(vistos.length > 300,
    `🔴 sólo ${vistos.length} ficheros: eso no es la tanda de esta casa.`);
  assert.ok(vistos.includes(path.join(RAIZ, 'tests', path.basename(fileURLToPath(import.meta.url)))),
    '🔴 el barrido no incluye ni a este fichero.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② 🔴 EL CONTROL QUE DECIDE · se PROVOCA el caso, no se predice (regla 13)
//
// Se miden los cuatro canarios por el camino real —proceso hijo con `TZ` de entorno, `run()` de
// `node:test`, diferencial entre las dos zonas— y se comprueba lo que sale. Es la ÚNICA prueba
// de este fichero que cuesta segundos, y es la que vale.
// ═════════════════════════════════════════════════════════════════════════════════════════════

const dirCanarios = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum813-'));
const canarios = escribirCanarios(path.join(dirCanarios, 'canarios'));
const medidas = ZONAS.map((zona) => medirEnZona({
  zona,
  ficheros: canarios.map((c) => c.ruta),
  raiz: RAIZ,
  salida: path.join(dirCanarios, `${zona.replace(/\W/g, '_')}.json`),
}));
const cambian = medidas.every((m) => m.ok) ? cambianDeVeredicto(medidas) : [];
const denunciados = new Set(cambian.map((c) => c.fichero));
const denunciado = (c) => denunciados.has(c.rutaClave);

test('SCRUM-813 · SUELO: las dos pasadas de canarios midieron de verdad', () => {
  for (const m of medidas) {
    assert.equal(m.ok, true, `🔴 la pasada en \`${m.zona}\` no dejó medida: ${m.porque}`);
    assert.equal(m.zonaVista, m.zona,
      `🔴 pedí \`${m.zona}\` y el hijo corrió en \`${m.zonaVista}\`.`);
    assert.equal(m.veredictos.size, CANARIOS.length,
      `🔴 en \`${m.zona}\` se vieron ${m.veredictos.size} pruebas de ${CANARIOS.length} canarios. `
      + 'Un canario que no llega a registrarse no puede denunciar nada.');
  }
});

test('SCRUM-813 · 🔴 el trinquete HABLA: un test que depende de la zona sale denunciado', () => {
  // ESTE es el control del encargo: se mete un test nuevo que depende de la zona y el instrumento
  // tiene que decirlo. Son dos, uno por signo de desfase, y hacen falta los dos: con un solo
  // canario, un juego de zonas todo al oeste (o todo al este) daría verde sin haberlo ganado.
  for (const c of canarios.filter((x) => x.clase === 'dependiente')) {
    assert.ok(denunciado(c),
      `🔴 EL TRINQUETE NO HABLA. El canario \`${c.fichero}\` depende de la zona de la máquina y NO `
      + `ha salido denunciado. ${c.porque}\n`
      + `  Denunciados: ${[...denunciados].join(', ') || '(ninguno)'}\n`
      + `  Zonas medidas: ${ZONAS.join(', ')} — si se han cambiado, comprueba que cubren los DOS `
      + 'signos de desfase.');
  }
});

test('SCRUM-813 · 🔴 el trinquete NO denuncia a los tests que YA fijan su zona', () => {
  // El otro sentido, y es igual de decisivo: un detector que marca a los correctos marca el árbol
  // entero, y a la segunda semana alguien lo desactiva «porque da falsos». Ahí muere el guard.
  for (const c of canarios.filter((x) => x.clase === 'fijado')) {
    assert.equal(denunciado(c), false,
      `🔴 RUIDO: el canario \`${c.fichero}\` fija su zona (o no habla de fechas) y aun así ha salido `
      + `denunciado. ${c.porque}`);
  }
});

test('SCRUM-813 · los canarios juzgan al instrumento, y el veredicto lo dice', () => {
  const j = juzgarCanarios(cambian, canarios);
  assert.deepEqual(j.fallos, [], '🔴 el autocontrol del trinquete falla');
  assert.equal(j.ok, true);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ③ EL VEREDICTO · se prueba sin correr la tanda, con medidas de mentira
// ═════════════════════════════════════════════════════════════════════════════════════════════

const medidaFalsa = (zona, pares) => ({ zona, ok: true, veredictos: new Map(pares) });
const DOS_MEDIDAS = [medidaFalsa('A', [['x::y', 'pass']]), medidaFalsa('B', [['x::y', 'fail']])];
const CONTROLES_OK = { ok: true, fallos: [] };
const censada = (clave) => ({ clave, porque: '…', parado_en: '…' });
const cambio = (clave) => ({ clave, fichero: clave.split('::')[0], prueba: clave.split('::')[1], porZona: [] });

test('SCRUM-813 · 🔴 una prueba dependiente NO censada pone el trinquete en ROJO', () => {
  const v = veredicto({
    cambianEnElArbol: [cambio('tests/nuevo.test.mjs::algo que mide la máquina')],
    censadas: [],
    medidas: DOS_MEDIDAS,
    controles: CONTROLES_OK,
  });
  assert.equal(v.estado, 'HABLA');
  assert.equal(v.salida, SALIDA_HABLA);
  assert.equal(v.nuevas.length, 1);
});

test('SCRUM-813 · una prueba dependiente que SÍ está censada no lo pone en rojo', () => {
  const clave = 'tests/x.test.mjs::y';
  const v = veredicto({
    cambianEnElArbol: [cambio(clave)],
    censadas: [censada(clave)],
    medidas: DOS_MEDIDAS,
    controles: CONTROLES_OK,
  });
  assert.equal(v.estado, 'OK');
  assert.equal(v.salida, SALIDA_OK);
});

test('SCRUM-813 · 🔴 una CENSADA que deja de cambiar de veredicto pone el trinquete en ROJO', () => {
  // El movimiento peligroso de verdad: los tres rojos de SCRUM-592 son HOY la única evidencia
  // automática de un defecto de numeración fiscal sin decidir (SCRUM-643 §2·A). Fijarles la zona
  // los pone verdes y APAGA LA ALARMA. Un trinquete que sólo mira hacia arriba lo deja pasar.
  const viva = 'tests/x.test.mjs::sigue cambiando';
  const apagada = 'tests/x.test.mjs::ésta ya no';
  const v = veredicto({
    cambianEnElArbol: [cambio(viva)],
    censadas: [censada(viva), censada(apagada)],
    medidas: DOS_MEDIDAS,
    controles: CONTROLES_OK,
  });
  assert.equal(v.estado, 'APAGADA');
  assert.equal(v.salida, SALIDA_APAGADA);
  assert.deepEqual(v.apagadas.map((a) => a.clave), [apagada]);
});

test('SCRUM-813 · 🔴 SUELO: CERO dependientes teniendo censadas NO es un cero — es CIEGO', () => {
  // Lo pide el encargo con estas palabras: «si el censo devuelve cero tests dependientes de zona,
  // falla declarándose ciego — hay tres medidos». Y la diferencia con APAGADA no es cosmética: si
  // desaparecen ALGUNAS, el instrumento midió y lo que hay que mirar es qué se arregló; si no
  // queda NINGUNA, lo primero que hay que mirar es el instrumento.
  const v = veredicto({
    cambianEnElArbol: [],
    censadas: [censada('tests/x.test.mjs::y'), censada('tests/x.test.mjs::z')],
    medidas: DOS_MEDIDAS,
    controles: CONTROLES_OK,
  });
  assert.equal(v.estado, 'CIEGO');
  assert.equal(v.salida, SALIDA_CIEGO);
  assert.equal(v.cieloRaso, true);

  // Y con la lista base VACÍA —el día que 643 §2·A se decida y se borren a mano— un cero es un
  // cero de verdad: el suelo deja de aplicar y el instrumento sigue vigilado por sus canarios.
  const sinCensadas = veredicto({
    cambianEnElArbol: [], censadas: [], medidas: DOS_MEDIDAS, controles: CONTROLES_OK,
  });
  assert.equal(sinCensadas.estado, 'OK');
  assert.equal(sinCensadas.salida, SALIDA_OK);
});

test('SCRUM-813 · una NUEVA manda sobre el suelo: primero se dice lo que ha entrado', () => {
  // Si una nueva entra el mismo día que las censadas dejan de verse, lo urgente es la nueva.
  const v = veredicto({
    cambianEnElArbol: [cambio('tests/nuevo.test.mjs::algo')],
    censadas: [censada('tests/x.test.mjs::y')],
    medidas: DOS_MEDIDAS,
    controles: CONTROLES_OK,
  });
  assert.equal(v.estado, 'HABLA');
  assert.equal(v.salida, SALIDA_HABLA);
  assert.equal(v.apagadas.length, 1, '🔴 y la apagada no se pierde: viaja en el mismo informe');
});

test('SCRUM-813 · 🔴 sin controles, o con una pasada muda, se declara CIEGO y NO opina del árbol', () => {
  const conControlesRotos = veredicto({
    cambianEnElArbol: [],
    censadas: CENSADAS,
    medidas: DOS_MEDIDAS,
    controles: { ok: false, fallos: ['el canario dependiente no salió denunciado'] },
  });
  assert.equal(conControlesRotos.estado, 'CIEGO');
  assert.equal(conControlesRotos.salida, SALIDA_CIEGO);

  const pasadaMuda = veredicto({
    cambianEnElArbol: [],
    censadas: CENSADAS,
    medidas: [medidaFalsa('A', []), medidaFalsa('B', [['x::y', 'pass']])],
    controles: CONTROLES_OK,
  });
  assert.equal(pasadaMuda.estado, 'CIEGO', '🔴 una pasada que no vio NI UNA prueba no es un cero');

  const pasadaRota = veredicto({
    cambianEnElArbol: [],
    censadas: CENSADAS,
    medidas: [{ zona: 'A', ok: false, porque: 'el hijo murió', veredictos: new Map() }, DOS_MEDIDAS[1]],
    controles: CONTROLES_OK,
  });
  assert.equal(pasadaRota.estado, 'CIEGO');

  const unaSolaZona = veredicto({
    cambianEnElArbol: [],
    censadas: CENSADAS,
    medidas: [DOS_MEDIDAS[0]],
    controles: CONTROLES_OK,
  });
  assert.equal(unaSolaZona.estado, 'CIEGO', '🔴 con una sola zona no hay diferencial que medir');
});

test('SCRUM-813 · una prueba que EXISTE en una zona y no en la otra también cambia de veredicto', () => {
  // Un fichero que muere al cargar en una zona sola es la forma más gorda de dependencia de zona,
  // y no se puede escapar por no tener «pass» ni «fail» en las dos.
  const cambian2 = cambianDeVeredicto([
    medidaFalsa('A', [['x::y', 'pass']]),
    medidaFalsa('B', []),
  ]);
  assert.equal(cambian2.length, 1);
  assert.equal(cambian2[0].porZona.find((p) => p.zona === 'B').veredicto, AUSENTE);
});

test('SCRUM-813 · 🔴 el hijo NO hereda `NODE_TEST_CONTEXT` ni `NODE_OPTIONS`, y sí el resto', () => {
  // 🔴 ESTE TEST EXISTE PORQUE LA AVERÍA OCURRIÓ, y ocurrió justo aquí: este mismo fichero corre
  // DENTRO de `node --test`, así que sus hijos heredaban `NODE_TEST_CONTEXT=child-v8` — y con esa
  // variable puesta el `run()` del nieto devuelve CERO eventos. La red que vigila al trinquete
  // medía cero canarios, y su cero se leía como «el trinquete no ve».
  const env = entornoLimpio('UTC', {
    NODE_TEST_CONTEXT: 'child-v8',
    NODE_OPTIONS: '--test-reporter=tap --test-reporter-destination=/tmp/tanda.tap',
    LIBRO_PG_URL: 'postgresql://x', QA_DB_TEST: '1', TZ: 'Europe/Madrid',
  });
  assert.equal(env.NODE_TEST_CONTEXT, undefined,
    '🔴 el hijo heredaría el contexto de test y su `run()` devolvería cero eventos');
  assert.equal(env.NODE_OPTIONS, undefined,
    '🔴 el hijo heredaría los reporters de la tanda y escribiría encima de su informe');
  assert.equal(env.TZ, 'UTC', '🔴 la zona pedida tiene que GANAR a la del entorno');
  assert.equal(env.LIBRO_PG_URL, 'postgresql://x',
    '🔴 sin las variables de banco, los tests que las piden se saltarían EN LAS DOS ZONAS y el '
    + 'trinquete saldría verde sin haberlos mirado');
  assert.equal(env.QA_DB_TEST, '1');
});

test('SCRUM-813 · 🔴 si el árbol se MUEVE entre las dos pasadas, el veredicto es CIEGO', () => {
  // El diferencial compara dos pasadas. Decenas de guards de esta casa LEEN el árbol, así que un
  // fichero editado a mitad les cambia el veredicto por un motivo que no es la zona: un hallazgo
  // FALSO. Y un hallazgo falso es lo que hace que alguien apague el guard.
  const marca = marcaDelArbol();
  if (!marca.ok) {
    // Sin git no se puede comprobar. Se DECLARA y no se pasa en verde en silencio.
    assert.fail(`no se pudo tomar la marca del árbol: ${marca.porque}`);
  }
  assert.equal(arbolQuieto(marca, marca).cambios.length, 0,
    '🔴 la misma marca dos veces sale como «se movió»: el detector no distingue nada');

  const movido = arbolQuieto(marca, { ...marca, huella: 'otra cosa' });
  assert.equal(movido.cambios.length, 1);

  const v = veredicto({
    cambianEnElArbol: [],
    censadas: CENSADAS,
    medidas: DOS_MEDIDAS,
    controles: CONTROLES_OK,
    quieto: movido,
  });
  assert.equal(v.estado, 'CIEGO');
  assert.equal(v.salida, SALIDA_CIEGO);
});

test('SCRUM-813 · la clave se escribe igual en Windows y en Linux', () => {
  // El CI corre en ubuntu y esta casa desarrolla en Windows. Una clave con `\` no casaría con la
  // misma clave con `/`, y la línea base entera saldría «apagada» al cruzar de sistema.
  const clave = claveDe(path.join(RAIZ, 'tests', 'x.test.mjs'), 'una prueba', RAIZ);
  assert.equal(clave, 'tests/x.test.mjs::una prueba');
  assert.equal(clave.includes('\\'), false);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ④ EL TRINQUETE ESTÁ CONECTADO · un instrumento que nadie ejecuta no existe
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-813 · 🔴 el trinquete tiene comando propio Y job de CI: no depende de que alguien se acuerde', () => {
  // ES LA MITAD QUE FALTABA EN SCRUM-640. Aquel censo se midió una vez, salió un número, y el
  // número se quedó en un documento; dos días después el defecto volvió a entrar. Si esto no
  // corre solo en cada PR, lo que hay es otra medición de una vez con más comentarios.
  const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['trinquete:zona'], 'node scripts/trinquete-de-zona.mjs',
    '🔴 el comando `trinquete:zona` ha desaparecido de package.json');

  const ci = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'ci.yml'), 'utf8');
  assert.ok(ci.includes('npm run trinquete:zona'),
    '🔴 EL CI YA NO LO CORRE. Sin job, el trinquete vuelve a ser una medición que hay que '
    + 'acordarse de teclear — que es exactamente lo que permitió que SCRUM-592 reintrodujera los '
    + 'tres dos días después de arreglarlos.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-813b · EL CIEGO DICE QUÉ RUTA SE MOVIÓ
//
// EL DEFECTO: el instrumento medía las dos pasadas enteras, los cuatro canarios y las tres
// censadas, y entonces resumía el árbol a UN hash y tiraba el resto. Un CIEGO que sólo sabe decir
// «el contenido del árbol cambió» no permite distinguir «la tanda escribió algo» de «alguien
// editó un fichero mientras corría» — dos causas con arreglos OPUESTOS. Y ante esa duda, la
// salida cómoda es relajar la puerta, que es justo lo que no se puede hacer.
//
// ⛔ LO QUE ESTOS CASOS FIJAN NO ES UNA EXCEPCIÓN: es que la puerta sigue igual de cerrada y
//    ADEMÁS nombra. Cualquier ruta que se mueva sigue siendo CIEGO.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-813b · SUELO: la huella por ruta SEPARA los ficheros, no los mezcla en un hash', () => {
  // Dos ficheros que cambian a la vez tienen que dar DOS señales. Con un hash común daban una
  // sola, indivisible — que es el defecto que este apartado cierra.
  const estado = ' M scripts/uno.mjs\n?? tests/nuevo.test.mjs\n';
  const diff = 'diff --git a/scripts/uno.mjs b/scripts/uno.mjs\n@@\n-a\n+b\n';
  const h = huellaPorRuta(estado, diff);

  assert.ok(h instanceof Map, 'la huella por ruta tiene que ser un mapa ruta → señal');
  assert.deepEqual([...h.keys()].sort(), ['scripts/uno.mjs', 'tests/nuevo.test.mjs']);
  assert.match(h.get('scripts/uno.mjs'), /diff:/, 'el fichero que aparece en el diff lleva su contenido');
  assert.match(h.get('tests/nuevo.test.mjs'), /^estado:/, 'el que sólo sale en `status` lleva su código');

  // CONTROL POSITIVO del detalle: cambiar el contenido de UNO cambia SÓLO su señal.
  const h2 = huellaPorRuta(estado, 'diff --git a/scripts/uno.mjs b/scripts/uno.mjs\n@@\n-a\n+DISTINTO\n');
  assert.notEqual(h.get('scripts/uno.mjs'), h2.get('scripts/uno.mjs'), 'el contenido no se está mirando');
  assert.equal(h.get('tests/nuevo.test.mjs'), h2.get('tests/nuevo.test.mjs'),
    '🔴 cambiar un fichero mueve la señal de OTRO: el detalle no separa por ruta');
});

test('SCRUM-813b · 🔴 EL QUE DECIDE: un fichero de TEST tocado durante la medición sigue siendo CIEGO — y ahora se NOMBRA', () => {
  // Es el caso que la puerta existe para cazar: alguien edita un fichero que la medición JUZGA
  // mientras las dos pasadas corren. Antes salía CIEGO sin decir cuál; ahora sale CIEGO y lo dice.
  const antes = {
    ok: true, head: 'abc', huella: 'A',
    porRuta: huellaPorRuta(' M tests/quoteNumber.test.mjs\n', 'diff --git a/tests/quoteNumber.test.mjs b/tests/quoteNumber.test.mjs\n@@\n-uno\n'),
  };
  const despues = {
    ok: true, head: 'abc', huella: 'B',
    porRuta: huellaPorRuta(' M tests/quoteNumber.test.mjs\n', 'diff --git a/tests/quoteNumber.test.mjs b/tests/quoteNumber.test.mjs\n@@\n-otro\n'),
  };

  const q = arbolQuieto(antes, despues);
  assert.equal(q.cambios.length, 1, 'un fichero de test movido tiene que salir como movimiento');
  assert.equal(q.rutas.length, 1);
  assert.equal(q.rutas[0].ruta, 'tests/quoteNumber.test.mjs',
    '🔴 el CIEGO no NOMBRA el fichero que se movió: vuelve a ser inaccionable');

  // Y el veredicto sigue siendo CIEGO: nombrar no es perdonar.
  const v = veredicto({
    cambianEnElArbol: [], censadas: CENSADAS, medidas: DOS_MEDIDAS, controles: CONTROLES_OK, quieto: q,
  });
  assert.equal(v.estado, 'CIEGO', '🔴 la puerta se ha abierto: un fichero de test movido ya no ciega');
  assert.equal(v.salida, SALIDA_CIEGO);
  assert.ok(v.motivos.some((m) => m.includes('tests/quoteNumber.test.mjs')),
    'el motivo del CIEGO tiene que llevar el nombre del fichero');
});

test('SCRUM-813b · 🔴 SUELO: si el detalle por ruta NO ve nada pero la huella global cambió, sigue siendo CIEGO', () => {
  // Sin este suelo, el refinamiento SERÍA un agujero: bastaría con que el troceado por ruta no
  // supiera leer un diff raro para que un árbol movido pasara por quieto. Un detector que no sabe
  // deja la puerta CERRADA, no abierta.
  const iguales = huellaPorRuta('', '');
  const q = arbolQuieto(
    { ok: true, head: 'abc', huella: 'A', porRuta: iguales },
    { ok: true, head: 'abc', huella: 'B', porRuta: iguales },
  );
  assert.equal(q.rutas.length, 0, 'el detalle no ve nada: es el caso que este suelo cubre');
  assert.equal(q.cambios.length, 1, '🔴 el árbol se movió y el instrumento lo da por quieto');
  assert.match(q.cambios[0], /NO supo decir dónde/, 'el motivo tiene que declarar la ceguera, no disimularla');
});

test('SCRUM-813b · CONTROL NEGATIVO: dos marcas iguales NO producen ni un movimiento', () => {
  // Si esto fallara, el instrumento gritaría en cada pasada y acabaría apagado.
  const m = { ok: true, head: 'abc', huella: 'A', porRuta: huellaPorRuta(' M x.mjs\n', '') };
  const q = arbolQuieto(m, { ...m, porRuta: huellaPorRuta(' M x.mjs\n', '') });
  assert.equal(q.cambios.length, 0);
  assert.equal(q.rutas.length, 0);
});

test('SCRUM-813b · la marca REAL trae el detalle, y cuadra con lo que dice git', () => {
  // Control positivo contra git de verdad, sólo lectura: lo que `marcaDelArbol` mete en `porRuta`
  // tiene que ser exactamente lo que `git status --porcelain` está viendo en este árbol. Sin esto,
  // los casos de arriba probarían una función que el instrumento no usa.
  const m = marcaDelArbol();
  if (!m.ok) assert.fail(`no se pudo tomar la marca del árbol: ${m.porque}`);
  assert.ok(m.porRuta instanceof Map, '🔴 la marca ya no trae el detalle por ruta');

  const porcelain = execFileSync('git', ['status', '--porcelain'], { cwd: RAIZ, encoding: 'utf8' });
  const deGit = new Set(porcelain.split('\n').filter((l) => l.trim())
    .map((l) => l.slice(3).trim().split(' -> ').pop()));
  for (const r of deGit) {
    assert.ok(m.porRuta.has(r), `🔴 git ve \`${r}\` con cambios y la marca no lo tiene`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-813c · EL SUJETO DE LA QUIETUD SE ACOTA: lo que la medición JUZGA, no lo que ESCRIBE
//
// EL CIEGO de CI, ya con nombre gracias al detalle de SCRUM-813b:
//
//     árbol 🔴 SE MOVIÓ durante la medición
//        · scrum659/   (no aparecía) → estado:??
//
// Un directorio que la propia tanda crea al correr. Exigir quietud sobre lo que la medición
// escribe es pedirle a la tanda que no corra; exigirla sobre lo que la medición JUZGA —los
// ficheros de `tests/` y de `src/`, que es lo que los guards leen— es la puerta de verdad.
//
// ⛔ LA EXCEPCIÓN ES UNA LISTA CERRADA, NO UNA ZONA FRANCA, y estos casos lo fijan en los dos
//    sentidos: lo declarado no ciega, y TODO lo demás sigue cegando.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Dos marcas que sólo difieren en las rutas que se le digan. */
const marcasQueMueven = (rutas) => {
  const antes = { ok: true, head: 'abc', huella: 'A', porRuta: new Map() };
  const despues = { ok: true, head: 'abc', huella: 'B', porRuta: new Map(rutas.map((r) => [r, 'estado:??'])) };
  return [antes, despues];
};

test('SCRUM-813c · ✅ POSITIVO: la tanda escribiendo LO SUYO no ciega — el trinquete EMITE veredicto', () => {
  // Es el caso que se estaba comiendo el instrumento: la pasada funcionaba entera y se callaba.
  const [antes, despues] = marcasQueMueven(['scrum659/']);
  const q = arbolQuieto(antes, despues);

  assert.deepEqual(q.cambios, [], '🔴 lo que la propia medición ESCRIBE sigue cegando: no se ha acotado nada');
  assert.equal(q.amparadas.length, 1, 'la ruta declarada tiene que salir, no desaparecer');
  assert.equal(q.amparadas[0].ruta, 'scrum659/');

  // Y con el árbol así, el veredicto se EMITE: 3 censadas vistas, 3 censadas. Lo que ya salía.
  const v = veredicto({
    cambianEnElArbol: CENSADAS.map((c) => cambio(c.clave)),
    censadas: CENSADAS,
    medidas: DOS_MEDIDAS,
    controles: CONTROLES_OK,
    quieto: q,
  });
  assert.equal(v.estado, 'OK', `🔴 el trinquete sigue sin emitir veredicto: ${JSON.stringify(v.motivos)}`);
  assert.equal(v.salida, SALIDA_OK);
  assert.equal(v.nuevas.length, 0);
  assert.equal(v.apagadas.length, 0, '🔴 una censada se ha apagado: los tres de SCRUM-592 tienen que seguir ahí');
});

test('SCRUM-813c · 🔴 EL QUE DECIDE: un fichero de TEST tocado a mano DURANTE la medición sigue siendo CIEGO', () => {
  // Si esto dejara de cegar, la puerta se habría apagado en vez de acotarse. Es el caso por el
  // que la comprobación existe: alguien edita lo que la medición JUZGA mientras las dos pasadas
  // corren, y los guards que leen el árbol cambian de veredicto por eso y no por la zona.
  const [antes, despues] = marcasQueMueven(['tests/quoteNumber.test.mjs']);
  const q = arbolQuieto(antes, despues);

  assert.equal(q.amparadas.length, 0, '🔴 un fichero de `tests/` se está amparando como escritura de la tanda');
  assert.equal(q.cambios.length, 1);
  assert.equal(q.rutas[0].ruta, 'tests/quoteNumber.test.mjs', 'el CIEGO tiene que NOMBRARLO');

  const v = veredicto({
    cambianEnElArbol: [], censadas: CENSADAS, medidas: DOS_MEDIDAS, controles: CONTROLES_OK, quieto: q,
  });
  assert.equal(v.estado, 'CIEGO', '🔴 LA PUERTA SE HA APAGADO: tocar un test durante la medición ya no ciega');
  assert.equal(v.salida, SALIDA_CIEGO);
  assert.ok(v.motivos.some((m) => m.includes('tests/quoteNumber.test.mjs')));
});

test('SCRUM-813c · 🔴 la excepción es CERRADA: lo que NO está declarado ciega, aunque se le parezca', () => {
  // Un `src/` cualquiera, y un directorio con nombre PARECIDO al declarado. Los dos ciegan.
  for (const ruta of ['src/core/utils/utils.ts', 'scrum659bis/', 'otro/scrum659/']) {
    const [antes, despues] = marcasQueMueven([ruta]);
    const q = arbolQuieto(antes, despues);
    assert.equal(q.amparadas.length, 0, `🔴 \`${ruta}\` se está amparando sin estar declarada`);
    assert.equal(q.cambios.length, 1, `🔴 \`${ruta}\` ha dejado de cegar: la lista se ha vuelto una zona franca`);
  }

  // Y el directorio declarado SÍ ampara lo que cuelga de él — un fixture no es una ruta sola.
  const [a2, d2] = marcasQueMueven(['scrum659/pagina-1.pdf']);
  const q2 = arbolQuieto(a2, d2);
  assert.equal(q2.cambios.length, 0, 'un directorio declarado tiene que amparar su contenido');
  assert.equal(q2.amparadas.length, 1);
});

test('SCRUM-813c · 🔴 SUELO: con la lista de escrituras VACÍA es CIEGO, no «árbol limpio»', () => {
  // Una lista vacía NO significa «la tanda no escribe nada»: significa que la declaración se
  // perdió. Sin este suelo, vaciarla devolvería la puerta al estado de antes sin que nadie lo
  // hubiera decidido — y encima en verde.
  const [antes, despues] = marcasQueMueven(['scrum659/']);
  const q = arbolQuieto(antes, despues, []);
  assert.equal(q.cambios.length, 1, '🔴 con la lista vacía el instrumento da el árbol por quieto');
  assert.match(q.cambios[0], /VACÍA/, 'el motivo tiene que decir que la declaración se ha perdido');
});

test('SCRUM-813c · la lista declarada es EXACTAMENTE ésta, y cada entrada dice quién y por qué', () => {
  // Fijada por CONTENIDO: si crece, este caso cae y alguien tiene que escribir el motivo aquí Y
  // en la lista. Una lista de excepciones que engorda sola acaba tapando el defecto que evita.
  assert.deepEqual(ESCRITURAS_DE_LA_TANDA.map((e) => e.ruta), ['scrum659/'],
    '🔴 HA CAMBIADO LA LISTA DE ESCRITURAS DE LA TANDA. Cada entrada es una ruta que deja de '
    + 'cegar: se añade con su medición delante, nunca para que el trinquete se calle.');

  for (const e of ESCRITURAS_DE_LA_TANDA) {
    assert.ok(e.quien && e.porque && e.expresion,
      `🔴 \`${e.ruta}\` no dice quién la escribe, por qué, o con qué expresión. Una excepción sin `
      + 'motivo es una lista blanca.');

    // 🔴 ANCLADA POR IDENTIDAD, NO POR POSICIÓN (SCRUM-710b): el fichero tiene que existir Y
    // seguir conteniendo LA EXPRESIÓN que lo hace escribir dentro del árbol.
    //
    // Esto es lo que hace la entrada AUTOVERIFICABLE, y es la mitad que evita que una lista de
    // excepciones se pudra: el día que alguien arregle ese respaldo a `os.tmpdir()`, este caso
    // CAE y obliga a retirar la excepción. Sin él, la entrada seguiría amparando una ruta que ya
    // nadie escribe — y una excepción que sobra es exactamente cómo una lista engorda.
    assert.ok(fs.existsSync(path.join(RAIZ, e.quien)),
      `🔴 \`${e.ruta}\` dice que la escribe \`${e.quien}\`, y ese fichero no existe.`);
    assert.ok(fs.readFileSync(path.join(RAIZ, e.quien), 'utf8').includes(e.expresion),
      `🔴 \`${e.quien}\` ya NO contiene \`${e.expresion}\`. O se arregló —y entonces esta entrada `
      + 'SOBRA y hay que retirarla— o se reescribió y la excepción está amparando otra cosa.');
  }
});
