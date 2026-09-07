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

import {
  AUSENTE, CANARIOS, CENSADAS, SALIDA_APAGADA, SALIDA_CIEGO, SALIDA_HABLA, SALIDA_OK, ZONAS,
  arbolQuieto, cambianDeVeredicto, claveDe, entornoLimpio, escribirCanarios, ficherosDeLaTanda,
  juzgarCanarios, marcaDelArbol, medirEnZona, sondaDeZona, veredicto,
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
