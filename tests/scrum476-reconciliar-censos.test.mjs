// tests/scrum476-reconciliar-censos.test.mjs — SCRUM-476
//
// EL TEST QUE DECIDE si este ticket sirve **no es que los dos censos den el mismo número**. No
// tienen por qué: cuentan cosas distintas y las dos son legítimas. Lo que decide es que, cuando
// difieran, la diferencia **quede explicada por lo que cada uno cuenta** — y que cuando NO se
// pueda explicar, el aviso caiga nombrando cuál cuenta qué.
//
// «Difieren y no sé por qué» es exactamente el resultado que este ticket existe para no dejar.
//
// 🔴 Y NO SE ESCRIBE NINGÚN RECUENTO ESPERADO. Un `assert.equal(arboles, 4)` sería la premisa
// falsa del mes que viene: es literalmente el defecto del que nace este ticket, vuelto contra él.
// Lo que se exige es que el censo NO sea cero (cero es ceguera) y que el árbol donde corre la
// suite esté dentro — control positivo DERIVADO, no literal.
//
// ⚠️ NO se toca el `node_modules` de nadie: los montajes se provocan bajo `os.tmpdir()`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { avisoDeDesfase, diagnosticar } from './_desfase-node-modules.mjs';
import {
  QUE_CUENTA,
  censoDeDirectoriosNodeModules,
  exigenciasDe,
  informe,
  reconciliar,
} from './_reconciliar-censos.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

/** Un banco de árboles de mentira, con lock de verdad y paquetes de juguete. */
function banco() {
  const base = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'scrum476-')));
  return {
    base,
    /** Árbol con su `package.json` + `package-lock.json` exigiendo `deps` = {nombre: version}. */
    arbol(nombre, deps) {
      const d = path.join(base, nombre);
      fs.mkdirSync(d, { recursive: true });
      if (deps) {
        const dependencies = Object.fromEntries(Object.keys(deps).map((n) => [n, `^${deps[n]}`]));
        const packages = Object.fromEntries(Object.entries(deps).map(([n, v]) => [`node_modules/${n}`, { version: v }]));
        fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify({ name: nombre, dependencies }));
        fs.writeFileSync(path.join(d, 'package-lock.json'), JSON.stringify({ name: nombre, packages }));
      }
      return d;
    },
    /** `node_modules` real con los paquetes indicados instalados. */
    instalar(arbol, paquetes) {
      const nm = path.join(arbol, 'node_modules');
      fs.mkdirSync(nm, { recursive: true });
      for (const [n, v] of Object.entries(paquetes)) {
        fs.mkdirSync(path.join(nm, n), { recursive: true });
        fs.writeFileSync(path.join(nm, n, 'package.json'), JSON.stringify({ name: n, version: v }));
      }
      return nm;
    },
    /** El montaje real de este proyecto: `mklink /J`, que `fs.symlinkSync` reproduce sin elevación. */
    enlazar(arbol, destino) {
      fs.symlinkSync(destino, path.join(arbol, 'node_modules'), 'junction');
    },
    limpiar: () => fs.rmSync(base, { recursive: true, force: true, maxRetries: 3 }),
  };
}

// ── CONTROL POSITIVO: los dos censos contestan sobre el árbol de verdad ──────────────────────

test('SCRUM-476 · CONTROL POSITIVO: la reconciliación contesta, y el árbol donde corre está dentro', () => {
  const r = reconciliar({ cwd: RAIZ });
  assert.ok(r.ok, `🔴 NO SUPE MIRAR sobre el árbol real: ${r.motivo}. Sin esto, lo de abajo no mide nada.`);
  assert.ok(r.filas.length > 0,
    '🔴 población CERO. «No hay árboles» y «no supe listarlos» darían el mismo verde, y el segundo ' +
    'deja a alguien reconciliando el conjunto vacío consigo mismo.');

  const real = fs.realpathSync.native(RAIZ).toLowerCase();
  const dentro = r.filas.some((f) => fs.realpathSync.native(f.raiz).toLowerCase() === real);
  assert.ok(dentro,
    '🔴 el árbol donde corre la suite NO sale en la población: los dos censos estarían hablando de ' +
    'otro conjunto, que es justo el defecto que este ticket viene a cerrar.');

  // Los dos censos han contado ALGO. Cuánto, no se fija: eso caduca.
  assert.ok(r.contados.topologia > 0, '🔴 la TOPOLOGÍA no ha contado ni un árbol.');
  assert.ok(r.contados.desfase > 0, '🔴 el censo de DESFASE no ha contado ni un árbol.');
});

// ── 🔴 EL TEST QUE DECIDE ────────────────────────────────────────────────────────────────────

test('SCRUM-476 · 🔴 EL QUE DECIDE: sobre el MISMO árbol, lo que difiere está EXPLICADO', () => {
  const r = reconciliar({ cwd: RAIZ });
  assert.ok(r.ok, `🔴 ${r.motivo}`);

  assert.deepEqual(r.sinExplicar.map((d) => d.mensaje), [],
    '🔴 HAY UNA DIFERENCIA ENTRE LOS DOS CENSOS QUE NADIE PUEDE EXPLICAR. No hace falta que den el ' +
    'mismo número —cuentan cosas distintas—, pero sí que se sepa POR QUÉ difieren. El detalle:\n' +
    (r.sinExplicar[0]?.mensaje || ''));

  // Y el informe NO puede firmar «reconciliados» si ha quedado algún árbol sin mirar.
  const texto = informe(r);
  if (r.ciegos.topologia.length || r.ciegos.desfase.length) {
    assert.doesNotMatch(texto, /✔ RECONCILIADOS/,
      '🔴 firma «reconciliados» con árboles sin medir: es una afirmación sobre un conjunto en el ' +
      'que hay alguien a quien no se ha mirado.');
    assert.match(texto, /falta\(n\) árboles por medir/, '🔴 no dice qué le falta por mirar.');
  } else {
    assert.match(texto, /✔ RECONCILIADOS/, '🔴 no afirma lo que sí ha medido.');
  }
});

// ── 🔴 EL ROJO POR EL MECANISMO ①: LA DISCREPANCIA REAL, PROVOCADA ───────────────────────────

test('SCRUM-476 · 🔴 con un JUNCTION y locks distintos, el aviso NOMBRA cuál cuenta qué', () => {
  // El caso exacto de la contradicción de este ticket, en pequeño: dos árboles que la TOPOLOGÍA
  // pone en el mismo grupo (mismo directorio real) y a los que el DESFASE da veredictos opuestos.
  // Los dos aciertan — y el informe tiene que decir por qué, no elegir uno.
  const b = banco();
  try {
    const a = b.arbol('wtA', { alfa: '1.0.0' });
    b.instalar(a, { alfa: '1.0.0' });                       // al día contra SU lock
    const bb = b.arbol('wtB', { alfa: '1.0.0', beta: '2.0.0' }); // su lock pide UNA MÁS
    b.enlazar(bb, path.join(a, 'node_modules'));            // …pero usa el directorio de A

    const r = reconciliar({ raices: [a, bb] });
    assert.ok(r.ok, `🔴 ${r.motivo}`);

    const d = r.discrepancias.find((x) => x.tipo === 'mismo-destino-veredictos-distintos');
    assert.ok(d,
      '🔴 EL DETECTOR NO VE LA DISCREPANCIA. Dos árboles en el mismo directorio con veredictos ' +
      'opuestos es el caso entero: si esto pasa callando, volvemos a «difieren y no sé por qué».');
    assert.equal(d.explicada, true, '🔴 la marca como inexplicable cuando sus locks SÍ difieren.');

    // El aviso tiene que nombrar CUÁL CUENTA QUÉ, no solo que hay lío.
    assert.match(d.mensaje, /TOPOLOGÍA/, '🔴 el aviso no nombra el censo de topología.');
    assert.match(d.mensaje, /DESFASE/, '🔴 el aviso no nombra el censo de desfase.');
    assert.match(d.mensaje, /realpath|directorio `node_modules` REAL/,
      '🔴 no dice que la topología agrupa por el DESTINO REAL: sin eso, «difieren» no explica nada.');
    assert.match(d.mensaje, /package-lock\.json/,
      '🔴 no dice que el desfase mide contra el LOCK de cada árbol, que es justo lo que los separa.');
    assert.match(d.mensaje, /beta/,
      '🔴 EL AVISO NO NOMBRA LA DEPENDENCIA que produce la diferencia. «Difieren» a secas obliga a ' +
      'adivinar, y adivinar es como se abrió un ticket sobre un defecto que no existía (SCRUM-471).');
    assert.ok(d.mensaje.includes(a) && d.mensaje.includes(bb), '🔴 no nombra a los DOS árboles del grupo.');

    // Y las exigencias son de verdad distintas: la explicación no es una excusa.
    assert.notEqual(exigenciasDe(a), exigenciasDe(bb));
    assert.match(informe(r), /LA DIFERENCIA SE EXPLICA/);
  } finally {
    b.limpiar();
  }
});

// ── 🔴 EL ROJO POR EL MECANISMO ②: LA QUE NO TIENE EXCUSA ────────────────────────────────────

test('SCRUM-476 · 🔴 mismo directorio y MISMAS exigencias con veredictos distintos: SIN EXPLICAR', () => {
  // Este caso es FÍSICAMENTE IMPOSIBLE de montar con directorios de verdad —es el mismo
  // `node_modules` medido contra el mismo lock—, así que sin inyectar un censo que mienta esta
  // rama no la ejercitaría nadie y sería un verde permanente. SCRUM-351 se llevó ese susto con su
  // suelo: la mutación no daba rojo porque el caso elegido entraba por otra puerta.
  const b = banco();
  try {
    const a = b.arbol('wtA', { alfa: '1.0.0' });
    b.instalar(a, { alfa: '1.0.0' });
    const bb = b.arbol('wtB', { alfa: '1.0.0' });          // lock IDÉNTICO
    b.enlazar(bb, path.join(a, 'node_modules'));

    assert.equal(exigenciasDe(a), exigenciasDe(bb), '🔴 el montaje del caso está mal: los locks difieren.');

    const mentiroso = (raiz) => (raiz === bb
      ? { faltan: ['gamma'], distintas: [], miradas: 1 }
      : { faltan: [], distintas: [], miradas: 1 });

    const r = reconciliar({ raices: [a, bb], censoDesfase: mentiroso });
    assert.ok(r.ok, `🔴 ${r.motivo}`);
    assert.equal(r.sinExplicar.length, 1,
      '🔴 NO CAZA LA DISCREPANCIA SIN EXCUSA. Mismo directorio y misma vara de medir con dos ' +
      'veredictos es un instrumento mintiendo, y pasarlo por alto es dejar el ticket abierto.');
    assert.match(r.sinExplicar[0].mensaje, /SIN EXPLICACIÓN/);
    assert.match(r.sinExplicar[0].mensaje, /TOPOLOGÍA/);
    assert.match(r.sinExplicar[0].mensaje, /DESFASE/);
    assert.match(informe(r), /1 discrepancia\(s\) SIN EXPLICAR/, '🔴 el informe la firma como si nada.');
    assert.doesNotMatch(informe(r), /✔ RECONCILIADOS/, '🔴 firma «reconciliados» con una discrepancia viva.');
  } finally {
    b.limpiar();
  }
});

// ── 🔴 EL ROJO POR EL MECANISMO ③: LOS TOTALES DIFIEREN, Y ESO TAMBIÉN SE DICE ───────────────

test('SCRUM-476 · 🔴 un árbol que solo cuenta UNO de los dos censos no pasa por «bien»', () => {
  const b = banco();
  try {
    const conLock = b.arbol('conLock', { alfa: '1.0.0' });
    b.instalar(conLock, { alfa: '1.0.0' });
    const sinLock = b.arbol('sinLock', null);   // tiene `node_modules`, no tiene lock
    b.instalar(sinLock, { alfa: '1.0.0' });

    const r = reconciliar({ raices: [conLock, sinLock] });
    assert.ok(r.ok, `🔴 ${r.motivo}`);
    assert.equal(r.contados.topologia, 2, '🔴 la topología no cuenta un árbol cuya ruta sí resuelve.');
    assert.equal(r.contados.desfase, 1, '🔴 el desfase cuenta un árbol del que no puede leer el lock.');

    const d = r.discrepancias.find((x) => x.tipo === 'alcance-distinto');
    assert.ok(d,
      '🔴 los dos censos dan totales distintos y NADIE LO DICE. Un total sin su alcance se lee como ' +
      'el tamaño del problema, y de ahí salió la cabecera que abre este ticket.');
    assert.match(d.mensaje, /TOPOLOGÍA/);
    assert.match(d.mensaje, /DESFASE/);
    assert.ok(d.mensaje.includes(sinLock), '🔴 no nombra el árbol que se ha quedado a medio medir.');
    assert.doesNotMatch(informe(r), /✔ RECONCILIADOS/,
      '🔴 firma «reconciliados» con un árbol que solo la mitad de los instrumentos ha sabido mirar.');
  } finally {
    b.limpiar();
  }
});

// ── EL SUELO: CERO NUNCA ES «TODO CUADRA» ────────────────────────────────────────────────────

test('SCRUM-476 · SUELO: población vacía se declara CIEGA, no reconciliada', () => {
  const r = reconciliar({ raices: [] });
  assert.equal(r.ok, false, '🔴 con la lista vacía se contesta que cuadran: dos conjuntos vacíos son iguales.');
  assert.match(informe(r), /NO SUPE MIRAR/);
  assert.doesNotMatch(informe(r), /✔/, '🔴 un fallo de lectura no puede llevar un visto bueno.');
});

test('SCRUM-476 · SUELO: un censo que dice OK y devuelve cero árboles tampoco pasa', () => {
  // 🔴 ESTE CASO SE AÑADIÓ PORQUE LA MUTACIÓN NO DABA ROJO. Con la lista vacía la topología ya
  // sale por su propia puerta (`ok:false`), así que la rama «me han contestado que sí y no traen
  // ni un árbol» no la ejercitaba nadie: quitarla dejaba los 11 tests en verde. Es el mismo susto
  // que SCRUM-351 se llevó con su suelo, y se caza igual — provocando la llamada que falta.
  const vacio = () => ({ ok: true, arboles: [], grupos: [], comparten: [], ciegos: [], sinDependencias: [] });
  const r = reconciliar({ raices: ['x'], censoTopologia: vacio });
  assert.equal(r.ok, false,
    '🔴 un censo que contesta OK con cero árboles se acepta como reconciliación. «No hay nada que ' +
    'reconciliar» y «no supe mirar» acaban dando el mismo verde, y el segundo es el que muerde.');
  assert.match(informe(r), /NO SUPE MIRAR/);
});

test('SCRUM-476 · SUELO: fuera de un repo git no se inventa una reconciliación', () => {
  const fuera = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum476-nogit-'));
  try {
    const r = reconciliar({ cwd: fuera });
    assert.equal(r.ok, false, '🔴 sin git detrás devuelve un veredicto: se lo está inventando.');
    assert.match(informe(r), /NO SUPE MIRAR/);
  } finally {
    fs.rmSync(fuera, { recursive: true, force: true });
  }
});

test('SCRUM-476 · SUELO: el censo de directorios `node_modules` no puede dar cero', () => {
  // No se exige un número: se exige que no sea CERO. Sabemos que aquí hay `node_modules` —la suite
  // está corriendo con él— así que un cero significaría que el barrido no supo mirar, no que no
  // haya. El recuento del día va FECHADO en `docs/master/SCRUM-476.md`, no aquí.
  const c = censoDeDirectoriosNodeModules([RAIZ]);
  assert.ok(c.directoriosNodeModules > 0,
    '🔴 CERO directorios `node_modules` en el árbol donde corre la suite. Eso no es un censo ' +
    'vacío: es un barrido ciego, y «cero» y «no supe mirar» nunca son el mismo número.');
  assert.deepEqual(c.ilegibles, [], `🔴 hay rutas que no se han podido leer: ${c.ilegibles.join(' · ')}`);
});

// ── QUE LA CONTRADICCIÓN NO SE REPITA ────────────────────────────────────────────────────────

test('SCRUM-476 · el censo de la cabecera de 471 NO alimenta a su comprobador', () => {
  // La hipótesis cara era que el guard de 471 estuviera CALIBRADO contra aquel recuento y fallara
  // en falso hoy. Se descarta midiendo, no leyendo el comentario: el veredicto es función del
  // árbol que se le pasa y de nada más. Dos árboles idénticos salvo por el contenido, en el mismo
  // proceso, tienen que dar veredictos opuestos.
  const b = banco();
  try {
    const bueno = b.arbol('bueno', { alfa: '1.0.0' });
    b.instalar(bueno, { alfa: '1.0.0' });
    const malo = b.arbol('malo', { alfa: '1.0.0' });
    b.instalar(malo, {});

    assert.equal(avisoDeDesfase(bueno), null, '🔴 un árbol al día produce aviso: no lee el árbol.');
    assert.match(avisoDeDesfase(malo) || '', /alfa/, '🔴 un árbol desfasado no produce aviso.');
    assert.equal(diagnosticar(bueno).faltan.length, 0);
    assert.deepEqual(diagnosticar(malo).faltan, ['alfa']);

    // Y ningún recuento de aquel PASO 0 vive en el CUERPO de las funciones —solo en el comentario—,
    // así que no hay nada calibrado que pueda caducar. Se mira el código, no la prosa.
    const cuerpos = [avisoDeDesfase, diagnosticar].map((f) => f.toString()).join('\n');
    for (const n of ['200', '147', '144', '91', '53']) {
      assert.doesNotMatch(cuerpos, new RegExp(`\\b${n}\\b`),
        `🔴 el número ${n} del censo de aquel PASO 0 aparece DENTRO del comprobador: entonces sí ` +
        'estaría calibrado contra un mundo que ya no existe.');
    }
  } finally {
    b.limpiar();
  }
});

test('SCRUM-476 · la cabecera de 471 manda a MEDIR y remite a la reconciliación', () => {
  // Requisito POSITIVO, no una lista de frases prohibidas: no se persigue el recuento —es una
  // medición fechada, o sea historia, y reescribirla sería falsificar el registro—, se exige que
  // quien lo lea encuentre a la vez el método de hoy y por qué aquel número no describe este disco.
  const cabecera = fs.readFileSync(path.join(RAIZ, 'tests', 'scrum471-node-modules-al-dia.test.mjs'), 'utf8')
    .split('\n').slice(0, 40).join('\n');
  assert.match(cabecera, /npm run topologia/,
    '🔴 la cabecera lleva un recuento y no dice cómo sacar el de HOY. Un puntero al método no ' +
    'caduca; un recuento sí, y ése es el ticket entero.');
  assert.match(cabecera, /SCRUM-476/,
    '🔴 la cabecera no remite a la reconciliación, así que quien lea el número vuelve a quedarse ' +
    'con la contradicción y sin la explicación.');
});

test('SCRUM-476 · las dos frases de «qué cuenta cada censo» nombran su instrumento', () => {
  assert.match(QUE_CUENTA.topologia, /SCRUM-351/);
  assert.match(QUE_CUENTA.desfase, /SCRUM-471/);
  assert.notEqual(QUE_CUENTA.topologia, QUE_CUENTA.desfase);
});
