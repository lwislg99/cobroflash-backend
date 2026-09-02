// tests/scrum351-topologia-node-modules.test.mjs — SCRUM-351
//
// EL TEST QUE DECIDE SI ESTE TICKET SIRVE es el del junction. Probar el comprobador SOLO en la
// configuración de hoy —cuatro `node_modules` propios— sería fijar la premisa otra vez, en la
// dirección contraria: un método que siempre contesta «no comparten» acierta hoy y miente el día
// que alguien enlace un worktree, que es el día en que hace falta.
//
// Por eso las dos configuraciones se PROVOCAN sobre árboles de mentira, con el mecanismo real
// (`fs.symlinkSync(..., 'junction')`, que es lo que hace `mklink /J` y no necesita privilegios):
//   · enlazados            → tiene que decir COMPARTEN, y NOMBRAR cuáles;
//   · sin `node_modules`   → resuelven hacia arriba: COMPARTEN también, y es el caso invisible;
//   · propios              → no comparten.
//
// Y el suelo, que es la otra mitad: un árbol que no se puede leer sale como CIEGO. «Cero» y «no
// supe mirar» nunca son el mismo número.
//
// ⚠️ NO se toca el `node_modules` de nadie: todo ocurre bajo `os.tmpdir()`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import {
  resolverNodeModules,
  topologia,
  veredicto,
  worktreesDelRepo,
} from '../scripts/topologia-node-modules.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

/** Un banco de árboles de mentira. Devuelve la base y una función para hacer worktrees. */
function banco() {
  const base = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'scrum351-')));
  const arbol = (nombre) => {
    const d = path.join(base, nombre);
    fs.mkdirSync(d, { recursive: true });
    return d;
  };
  return { base, arbol, limpiar: () => fs.rmSync(base, { recursive: true, force: true, maxRetries: 3 }) };
}

/** `node_modules` propio, con un marcador dentro para que sea un directorio de verdad. */
function conNodeModulesPropio(arbol) {
  const nm = path.join(arbol, 'node_modules');
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(path.join(nm, '.marca'), 'x');
  return nm;
}

// ── CONTROL POSITIVO DEL LECTOR ──────────────────────────────────────────────────────────────

test('SCRUM-351 · CONTROL POSITIVO: git lista los worktrees y este árbol está entre ellos', () => {
  const wt = worktreesDelRepo(RAIZ);
  assert.ok(wt.ok, `🔴 no se ha podido listar los worktrees: ${wt.motivo}. Sin esto, lo de abajo no mide nada.`);
  const real = fs.realpathSync.native(RAIZ).toLowerCase();
  const estan = wt.raices.map((r) => fs.realpathSync.native(r).toLowerCase());
  assert.ok(estan.includes(real),
    '🔴 el árbol donde corre la suite NO sale en el listado de worktrees: el lector está ciego y ' +
    'cualquier veredicto sobre «quién comparte con quién» estaría hablando de otro conjunto.');
});

// ── 🔴 EL ROJO POR EL MECANISMO ①: ENLAZADOS ─────────────────────────────────────────────────

test('SCRUM-351 · 🔴 con un JUNCTION, dice COMPARTEN y NOMBRA cuáles', () => {
  const b = banco();
  try {
    const wtA = b.arbol('wtA');
    const wtB = b.arbol('wtB');
    const wtC = b.arbol('wtC');
    const nmA = conNodeModulesPropio(wtA);
    conNodeModulesPropio(wtC);
    // El montaje que este proyecto usó de verdad: `mklink /J`. `fs.symlinkSync` con tipo
    // 'junction' crea EXACTAMENTE eso en Windows, y sin necesitar elevación.
    fs.symlinkSync(nmA, path.join(wtB, 'node_modules'), 'junction');

    const t = topologia({ raices: [wtA, wtB, wtC] });
    assert.ok(t.ok, `🔴 no se ha podido medir: ${t.motivo}`);
    assert.equal(t.ciegos.length, 0, '🔴 algún árbol de juguete ha salido ciego: el caso no se ha llegado a probar.');

    assert.equal(t.comparten.length, 1,
      '🔴 CON UN JUNCTION DELANTE, EL COMPROBADOR NO VE QUE SE COMPARTA. Es el ticket entero: un ' +
      'método que solo acierta en la configuración de hoy vuelve a fijar la premisa, y el día que ' +
      'alguien enlace un worktree dirá «regenera tranquilo» mientras rompe la tanda de otro.');

    const grupo = t.comparten[0];
    assert.deepEqual([...grupo.raices].sort(), [wtA, wtB].sort(),
      '🔴 no nombra a los DOS que comparten. «Alguien comparte» no sirve: hay que saber a quién avisar.');
    assert.ok(!grupo.raices.includes(wtC), '🔴 mete en el grupo a un árbol que tiene el suyo propio.');

    // Y por vías, que es lo que se lee en el informe.
    const via = Object.fromEntries(t.arboles.map((a) => [a.raiz, a.via]));
    assert.equal(via[wtA], 'propio');
    assert.equal(via[wtB], 'enlace', '🔴 el enlace no se reconoce como enlace.');
    assert.equal(via[wtC], 'propio');

    const texto = veredicto(t);
    assert.match(texto, /COMPARTEN/, '🔴 el veredicto no dice que comparten.');
    assert.ok(texto.includes(wtB), '🔴 el veredicto no nombra el worktree enlazado.');
  } finally {
    b.limpiar();
  }
});

// ── 🔴 EL ROJO POR EL MECANISMO ②: SIN `node_modules` — EL INVISIBLE ─────────────────────────

test('SCRUM-351 · 🔴 sin `node_modules` propio se resuelve HACIA ARRIBA, y eso también es compartir', () => {
  // No hay ningún enlace que inspeccionar: un método basado en `lstat` diría «no existe» y se
  // quedaría tan ancho. Node, en cambio, cargará el del padre — y dos hermanos así comparten
  // cliente de Prisma sin que nada lo delate. Está documentado en docs/PLAN_EJECUCION_Y_PARALELO.md
  // como la vía peor, justo por eso.
  const b = banco();
  try {
    const padre = b.arbol('repo');
    conNodeModulesPropio(padre);
    const wtX = path.join(padre, 'sub', 'wtX');
    const wtY = path.join(padre, 'sub', 'wtY');
    fs.mkdirSync(wtX, { recursive: true });
    fs.mkdirSync(wtY, { recursive: true });

    const t = topologia({ raices: [wtX, wtY, padre] });
    assert.ok(t.ok, `🔴 no se ha podido medir: ${t.motivo}`);
    assert.equal(t.comparten.length, 1,
      '🔴 dos worktrees SIN `node_modules` dentro del mismo repo usan el del padre y el comprobador ' +
      'no lo ve. Es el mecanismo que no deja huella, y por eso es el que muerde.');
    assert.deepEqual([...t.comparten[0].raices].sort(), [padre, wtX, wtY].sort(),
      '🔴 no nombra a los tres que acaban en el mismo `node_modules`.');
    const via = Object.fromEntries(t.arboles.map((a) => [a.raiz, a.via]));
    assert.equal(via[wtX], 'ascendente', '🔴 no distingue «resuelve hacia arriba» de «tiene el suyo».');
  } finally {
    b.limpiar();
  }
});

// ── EL CONTROL NEGATIVO: LA CONFIGURACIÓN DE HOY ─────────────────────────────────────────────

test('SCRUM-351 · CONTROL NEGATIVO: con `node_modules` propios NO dice que compartan', () => {
  const b = banco();
  try {
    const arboles = ['w1', 'w2', 'w3'].map((n) => {
      const d = b.arbol(n);
      conNodeModulesPropio(d);
      return d;
    });
    const t = topologia({ raices: arboles });
    assert.ok(t.ok);
    assert.equal(t.ciegos.length, 0);
    assert.equal(t.comparten.length, 0,
      '🔴 dice que comparten tres árboles independientes: nacería en rojo y se desactivaría en una tarde.');
    assert.match(veredicto(t), /NO COMPARTEN/, '🔴 el veredicto no afirma lo que sí ha medido.');
  } finally {
    b.limpiar();
  }
});

// ── EL COSTE, SIN RELOJ (SCRUM-520) ──────────────────────────────────────────────────────────
//
// 🔴 LO QUE HABÍA AQUÍ ERA UN CRONÓMETRO, Y MEDÍA LA MÁQUINA, NO EL COMPROBADOR.
//
// `assert.ok(ms < 2000)` sobre RELOJ DE PARED. Medido en SCRUM-520: 206 · 205 · 204 ms aislado
// —diez veces por debajo del límite— y **3.508 ms dentro de la suite completa**. El mismo código,
// el mismo día, dos veredictos opuestos; y con cuatro sesiones lanzando la suite a la vez, el rojo
// sale a diario. Un guard que falla por la carga de la máquina no enseña a arreglar nada: enseña a
// ignorar rojos, que es el daño que no se deshace.
//
// SUBIR EL LÍMITE NO LO ARREGLA: mueve el punto donde vuelve a fallar. Y el tiempo aquí nunca fue
// el hecho — era un PROXY del hecho. Lo dice el propio mensaje del aserto que se retira:
// «un comprobador que se NOTA EN LA TANDA se desactiva al primer roce». Lo que importaba es que el
// comprobador **haga poco trabajo**, y eso se puede medir directamente.
//
// ── QUÉ SE MIDE AHORA, Y POR QUÉ ES EL MISMO HECHO ───────────────────────────────────────────
// El trabajo de este comprobador es SUBIR por el árbol de directorios: un `lstat` por ancestro
// hasta dar con un `node_modules`, y un `realpath` cuando lo encuentra. Eso es acotado y no
// depende de la carga. La única forma de que este comprobador «se note» es que empiece a
// RECORRER `node_modules` por dentro —decenas de miles de ficheros—, y eso se ve contando
// operaciones, no cronometrando.
//
//   1. cero operaciones DENTRO de un `node_modules`      (lo que lo haría caro)
//   2. el gasto cabe en su TECHO ESTRUCTURAL              (profundidad de cada ruta, calculada)
//   3. el gasto NO CRECE con el TAMAÑO de `node_modules`  (200 paquetes cuestan lo mismo que 1)
//   4. dos pasadas seguidas dan el MISMO número           (si no, el instrumento no vale)
//
// ⚠️ LÍMITE DECLARADO DEL INSTRUMENTO: el `spawnSync` de git NO se puede interceptar desde fuera
// —`import { spawnSync }` crea un binding que ya no mira el objeto del módulo—, así que el
// contador no lo ve. Ese hueco se tapa aparte, por AST, en el último test: git se invoca UNA vez
// y fuera del recorrido por árbol.

/** Operaciones de disco de una llamada. Sin reloj: el mismo número con la máquina vacía o llena. */
function midiendoElGasto(fn) {
  const ops = [];
  const guardadas = {
    lstatSync: fs.lstatSync,
    statSync: fs.statSync,
    readdirSync: fs.readdirSync,
    readFileSync: fs.readFileSync,
    opendirSync: fs.opendirSync,
    native: fs.realpathSync.native,
  };
  const anota = (nombre, real) => (p, ...resto) => {
    ops.push({ op: nombre, ruta: String(p) });
    return real(p, ...resto);
  };
  fs.lstatSync = anota('lstat', guardadas.lstatSync);
  fs.statSync = anota('stat', guardadas.statSync);
  fs.readdirSync = anota('readdir', guardadas.readdirSync);
  fs.readFileSync = anota('readFile', guardadas.readFileSync);
  fs.opendirSync = anota('opendir', guardadas.opendirSync);
  fs.realpathSync.native = anota('realpath', guardadas.native);
  try {
    const valor = fn();
    // ENTRAR en un `node_modules` tiene DOS formas, y la primera version de esto solo veia una:
    //
    //   · mirar algo que CUELGA de el   → la ruta lleva algo detras;
    //   · LISTARLO                      → la ruta es la misma, pero se pide su contenido.
    //
    // 🔴 LO ENCONTRO UN ROJO: con la regla anterior, meter un `readdirSync(node_modules)` en el
    // comprobador —que es exactamente la degradacion cara que esto vigila— pasaba en VERDE,
    // porque la ruta del listado es el propio directorio. Un `lstat` o un `realpath` SOBRE el
    // directorio si es legitimo: es lo que este comprobador viene a hacer.
    const LISTAR = new Set(['readdir', 'opendir']);
    const dentro = ops.filter((o) => /node_modules[\\/]./.test(o.ruta)
      || (LISTAR.has(o.op) && /node_modules/.test(o.ruta)));
    return { valor, gasto: { ops, total: ops.length, dentro } };
  } finally {
    fs.lstatSync = guardadas.lstatSync;
    fs.statSync = guardadas.statSync;
    fs.readdirSync = guardadas.readdirSync;
    fs.readFileSync = guardadas.readFileSync;
    fs.opendirSync = guardadas.opendirSync;
    fs.realpathSync.native = guardadas.native;
  }
}

/** El techo NO es un número elegido: sale de la forma del árbol. Un `lstat` por ancestro, más uno. */
function techoEstructural(arboles) {
  return arboles.reduce(
    (suma, a) => suma + path.resolve(a.raiz).split(/[\\/]/).filter(Boolean).length + 2,
    0,
  );
}

/** El reparto por tipo de operación, para que dos diferencias no se compensen entre sí. */
function porTipo(gasto) {
  const c = {};
  for (const o of gasto.ops) c[o.op] = (c[o.op] || 0) + 1;
  return JSON.stringify(c);
}

test('SCRUM-351 · CONTROL NEGATIVO: sobre el árbol de verdad contesta, y sin coste', () => {
  // 🔴 A PROPÓSITO NO SE COMPRUEBA **QUÉ** CONTESTA. Exigir «independientes» pondría la suite en
  // rojo el día que el fundador enlace los worktrees — que es una decisión suya y una configuración
  // legítima. Eso sería fijar la premisa otra vez, solo que al revés. Lo que sí se exige es que
  // conteste algo, que no sea ciego y que le cueste poco.
  const { valor: t, gasto } = midiendoElGasto(() => topologia({ cwd: RAIZ }));

  assert.ok(t.ok, `🔴 NO SUPE MIRAR sobre el árbol real: ${t.motivo}`);
  assert.equal(t.ciegos.length, 0,
    `🔴 hay árboles que no se han podido leer: ${t.ciegos.map((c) => c.ciego).join(' · ')}`);
  assert.ok(t.arboles.length >= 1, '🔴 no se ha medido ni un árbol.');
  assert.ok(veredicto(t).length > 0);

  // SUELO DE CEGUERA DEL INSTRUMENTO. Un cero aquí se leería como «topología perfecta», y sería
  // «no supe mirar»: si el contador no ve NADA es que el parche no llegó al `fs` que usa el script,
  // y entonces los dos asertos de debajo pasarían sin haber medido nada.
  assert.ok(gasto.total > 0,
    '🔴 EL CONTADOR NO HA VISTO NI UNA OPERACIÓN DE DISCO, y el comprobador acaba de recorrer '
    + `${t.arboles.length} árboles. El instrumento está ciego: lo que sigue no mide el coste, mide `
    + 'nada. «Cero» y «no supe mirar» nunca son el mismo número.');

  assert.deepEqual(gasto.dentro.map((o) => `${o.op} ${o.ruta}`), [],
    '🔴 EL COMPROBADOR HA ENTRADO DENTRO DE UN `node_modules`.\n\n'
    + '  Ahí hay decenas de miles de ficheros: es la única forma de que esto pase de milisegundos a\n'
    + '  segundos y de que alguien acabe desactivándolo. Para decir quién comparte con quién basta\n'
    + '  con RESOLVER la ruta; leer su contenido no aporta un dato y cuesta la tanda entera.');

  const techo = techoEstructural(t.arboles);
  assert.ok(gasto.total <= techo,
    `🔴 ${gasto.total} operaciones de disco para ${t.arboles.length} árboles, y el techo estructural `
    + `es ${techo}.\n\n`
    + '  Ese techo no es un número elegido a ojo: es un `lstat` por ancestro de cada ruta más el\n'
    + '  `realpath` final, que es exactamente lo que el método dice hacer. Pasarse significa que ha\n'
    + '  empezado a recorrer algo, y recorrer es lo que lo vuelve caro.');
});

test('SCRUM-520 · el gasto NO CRECE con el TAMAÑO de `node_modules`', () => {
  // Éste es el aserto que sustituye de verdad al cronómetro: si el comprobador fuera caro, lo sería
  // POR EL TAMAÑO del árbol de dependencias. Se mide con dos árboles idénticos salvo en eso.
  const b = banco();
  try {
    const flaco = b.arbol('flaco');
    conNodeModulesPropio(flaco);

    const gordo = b.arbol('gordo');
    const nmGordo = conNodeModulesPropio(gordo);
    for (let i = 0; i < 200; i++) fs.writeFileSync(path.join(nmGordo, `paquete-${i}`), 'x');

    const a = midiendoElGasto(() => topologia({ raices: [flaco] }));
    const z = midiendoElGasto(() => topologia({ raices: [gordo] }));

    assert.ok(a.gasto.total > 0 && z.gasto.total > 0,
      '🔴 el contador no ha visto nada en un árbol de mentira: instrumento ciego, no árbol barato.');
    assert.equal(z.gasto.total, a.gasto.total,
      `🔴 UN \`node_modules\` CON 200 ENTRADAS CUESTA ${z.gasto.total} OPERACIONES Y UNO CON 1 CUESTA `
      + `${a.gasto.total}.\n\n`
      + '  El coste dependería del tamaño del árbol de dependencias, así que crecería con el\n'
      + '  proyecto y un día se notaría en la tanda. Resolver una ruta no puede depender de cuántos\n'
      + '  paquetes haya detrás.');
  } finally {
    b.limpiar();
  }
});

test('SCRUM-520 · la medida es DETERMINISTA sobre un conjunto FIJO', () => {
  // La condicion de cierre del ticket. Se prueba sobre un banco propio y no sobre los worktrees
  // del repo, y el motivo es el defecto que este ticket viene a matar:
  //
  // 🔴 HAY CUATRO SESIONES TRABAJANDO A LA VEZ. Si una crea o quita un worktree entre las dos
  // pasadas, el conjunto medido cambia, el numero cambia, y este test daria ROJO por algo que no
  // es el comprobador — exactamente la enfermedad del cronometro, con otra cara. Sobre un conjunto
  // fijo no hay nada que se mueva por debajo.
  const b = banco();
  try {
    const raices = ['a', 'b', 'c'].map((n) => {
      const d = b.arbol(n);
      conNodeModulesPropio(d);
      return d;
    });
    const primera = midiendoElGasto(() => topologia({ raices }));
    const segunda = midiendoElGasto(() => topologia({ raices }));

    assert.ok(primera.gasto.total > 0, '🔴 el contador esta ciego: dos ceros iguales no son determinismo.');
    assert.equal(segunda.gasto.total, primera.gasto.total,
      `🔴 dos pasadas seguidas sobre EL MISMO conjunto dan ${primera.gasto.total} y ${segunda.gasto.total} `
      + 'operaciones. La medida no es determinista, asi que su veredicto depende de algo que no es el '
      + 'arbol — que es el defecto del cronometro que este ticket retira.');
    assert.equal(porTipo(segunda.gasto), porTipo(primera.gasto),
      '🔴 el TOTAL coincide pero el reparto por tipo de operacion no: se estan compensando dos '
      + 'diferencias, y eso es casualidad, no determinismo.');
  } finally {
    b.limpiar();
  }
});

test('SCRUM-520 · y sobre el arbol REAL, cuando nadie mueve worktrees por debajo', () => {
  // El mismo hecho sobre el arbol de verdad. Aqui SI se puede mover el suelo —otra sesion creando
  // o quitando un worktree—, asi que se reintenta hasta que dos pasadas midan EL MISMO conjunto.
  // Si nunca coinciden, eso NO es no-determinismo: es trasiego de worktrees, y se dice con ese
  // nombre en vez de acusar al comprobador.
  const raicesDe = (t) => JSON.stringify(t.arboles.map((a) => a.raiz));
  let primera, segunda;
  for (let intento = 0; intento < 3; intento++) {
    primera = midiendoElGasto(() => topologia({ cwd: RAIZ }));
    segunda = midiendoElGasto(() => topologia({ cwd: RAIZ }));
    if (raicesDe(primera.valor) === raicesDe(segunda.valor)) {
      assert.ok(primera.gasto.total > 0, '🔴 el contador esta ciego sobre el arbol real.');
      assert.equal(segunda.gasto.total, primera.gasto.total,
        `🔴 el MISMO conjunto de ${primera.valor.arboles.length} arboles cuesta ${primera.gasto.total} y `
        + `luego ${segunda.gasto.total} operaciones. Nada se ha movido por debajo: la medida no es determinista.`);
      assert.equal(porTipo(segunda.gasto), porTipo(primera.gasto),
        '🔴 el total coincide y el reparto por tipo no: eso es casualidad, no determinismo.');
      return;
    }
  }
  assert.fail(
    '🔴 EN TRES INTENTOS NO HA HABIDO DOS PASADAS SEGUIDAS SOBRE EL MISMO CONJUNTO DE ARBOLES.\n\n'
    + `  Ultima medida: ${primera.valor.arboles.length} y luego ${segunda.valor.arboles.length}. Alguien esta creando o\n`
    + '  quitando worktrees continuamente. No es el comprobador el que falla, pero tampoco se puede\n'
    + '  afirmar nada sobre el arbol mientras el suelo se mueve — y callarlo seria un verde hueco.');
});

test('SCRUM-520 · git se invoca UNA vez, y fuera del recorrido por árbol', () => {
  // El hueco declarado del contador: `import { spawnSync }` crea un binding que ya no mira el
  // objeto del módulo, así que parchear `child_process` desde fuera NO lo intercepta —comprobado—.
  // Un proceso por árbol serían cientos de procesos y sí se notaría en la tanda, así que el hueco
  // se tapa por AST: los comentarios no son nodos, de modo que esto no se caza a sí mismo
  // explicándose (SCRUM-203).
  const fuente = fs.readFileSync(path.join(RAIZ, 'scripts/topologia-node-modules.mjs'), 'utf8');
  const sf = ts.createSourceFile('topologia.mjs', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

  const llamadas = [];
  (function anda(n) {
    if (ts.isCallExpression(n) && n.expression.getText(sf) === 'spawnSync') {
      let f = n.parent;
      while (f && !ts.isFunctionDeclaration(f)) f = f.parent;
      llamadas.push(f && f.name ? f.name.getText(sf) : '(fuera de función)');
    }
    ts.forEachChild(n, anda);
  })(sf);

  assert.deepEqual(llamadas, ['worktreesDelRepo'],
    `🔴 \`spawnSync\` se llama desde ${JSON.stringify(llamadas)}.\n\n`
    + '  Tiene que haber UNA sola llamada y vivir en `worktreesDelRepo`, que corre una vez. Metida\n'
    + '  en `resolverNodeModules` —que corre por árbol— serían cientos de procesos, y ESO sí se\n'
    + '  nota en la tanda. El contador de operaciones no puede ver esto, por eso se mira aquí.');
});

// ── EL SUELO: «NO SUPE MIRAR» NUNCA ES «SON INDEPENDIENTES» ──────────────────────────────────

test('SCRUM-351 · SUELO: un enlace ROTO sale CIEGO, no «propio»', () => {
  // El enlace está y el destino no: es lo que queda cuando alguien borra el compartido, y aquí ya
  // pasó dos veces (docs/ERRORES_ASESOR.md). Llamarlo «propio» invitaría a regenerar sobre un
  // montaje que no se conoce, que es el desenlace más caro de todos.
  const b = banco();
  try {
    const destino = b.arbol('destino');
    const nmDestino = conNodeModulesPropio(destino);
    const roto = b.arbol('roto');
    fs.symlinkSync(nmDestino, path.join(roto, 'node_modules'), 'junction');
    fs.rmSync(nmDestino, { recursive: true, force: true });

    const r = resolverNodeModules(roto);
    assert.ok(r.ciego,
      `🔴 un enlace roto se ha respondido como "${r.via}". Un fallo de lectura contado como ` +
      'respuesta es literalmente el fallo que este comprobador viene a matar.');

    const sano = b.arbol('sano');
    conNodeModulesPropio(sano);
    const t = topologia({ raices: [roto, sano] });
    assert.equal(t.ciegos.length, 1, '🔴 el ciego no se cuenta como ciego.');
    const texto = veredicto(t);
    assert.doesNotMatch(texto, /NO COMPARTEN/,
      '🔴 CON UN ÁRBOL SIN MEDIR, EL VEREDICTO AFIRMA «no comparten». Es una afirmación sobre un ' +
      'conjunto en el que hay alguien a quien no se ha mirado: el cambiazo de siempre.');
    assert.match(texto, /NO SE HAN PODIDO MIRAR|NO SUPE MIRAR/, '🔴 el veredicto no avisa de que faltan árboles por medir.');
  } finally {
    b.limpiar();
  }
});

test('SCRUM-351 · SUELO: un fallo al MIRAR no se traga como «aquí no hay»', () => {
  // 🔴 ESTE CASO SE AÑADIÓ PORQUE LA MUTACIÓN NO DABA ROJO. Cambiando el `if (err.code ===
  // 'ENOENT')` por un `if (true)` —o sea, tragándose CUALQUIER fallo de lectura como una ausencia
  // y siguiendo a mirar al padre— los 10 tests seguían en verde. El caso estaba mal elegido: el
  // del enlace roto entra por `realpath`, no por `lstat`, así que esa rama no la ejercitaba nadie.
  //
  // Las causas realistas de esa rama son EACCES / EPERM / EIO, y Windows no deja provocarlas sin
  // elevación. Lo que sí se puede es hacer fallar la MISMA llamada por algo que no sea la
  // ausencia, que es exactamente la distinción que el código tiene que respetar.
  const raizIlegible = `C:${path.sep}x${String.fromCharCode(0)}y`;
  const r = resolverNodeModules(raizIlegible);
  assert.ok(r.ciego,
    `🔴 un fallo al leer se ha respondido como "${r.via}". Seguir subiendo tras un error que NO es ` +
    'ENOENT convierte «no pude mirar» en «aquí no había», y de ahí sale un veredicto sobre un ' +
    'árbol que nadie ha leído.');
  assert.match(r.ciego, /node_modules/, '🔴 el ciego no dice ni qué ruta no se pudo leer.');
});

test('SCRUM-351 · SUELO: si git no contesta, se dice NO SUPE MIRAR', () => {
  const fuera = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum351-nogit-'));
  try {
    const t = topologia({ cwd: fuera });
    assert.equal(t.ok, false, '🔴 fuera de un repo git el comprobador devuelve un veredicto: se lo está inventando.');
    assert.match(veredicto(t), /NO SUPE MIRAR/,
      '🔴 no se declara ciego. «Cero worktrees» y «no supe leer el listado» darían la misma respuesta.');
    assert.doesNotMatch(veredicto(t), /✔/, '🔴 un fallo de lectura no puede llevar un visto bueno.');
  } finally {
    fs.rmSync(fuera, { recursive: true, force: true });
  }
});

test('SCRUM-351 · SUELO: cero árboles que medir no es «no comparte nadie»', () => {
  const t = topologia({ raices: [] });
  assert.equal(t.ok, false, '🔴 con la lista vacía se contesta que no comparten: dos conjuntos vacíos son iguales.');
  assert.match(veredicto(t), /NO SUPE MIRAR/);
});

// ── QUE LA CORRECCIÓN NO SE DESHAGA ──────────────────────────────────────────────────────────

test('SCRUM-351 · el mensaje del guard de Prisma manda a MEDIR, no afirma el montaje', async () => {
  // Requisito POSITIVO, no una lista de frases prohibidas: se exige que el remedio nombre el
  // comprobador. Un guard de texto que persiguiera la frase falsa se cazaría a sí mismo en el
  // comentario que explica la prohibición — y encima envejecería con cada reescritura.
  const { mensaje } = await import('../scripts/_prisma-client-guard.mjs');
  const texto = mensaje({ direccion: 'falta', tipo: 'campo', modelo: 'Invoice', campo: 'x', columna: 'x' });
  assert.match(texto, /npm run topologia/,
    '🔴 el mensaje que se lee al fallar no dice CÓMO comprobar si el `node_modules` se comparte. ' +
    'De un mensaje que lo daba por hecho salió la regla «no regeneres», y esa regla costó una ' +
    'decisión equivocada en cada dirección (SCRUM-461).');
});

test('SCRUM-351 · el comprobador corre desde npm', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts?.topologia?.includes('topologia-node-modules'),
    '🔴 no hay `npm run topologia`. Un método que hay que recordar de memoria no se usa, y lo que ' +
    'se vuelve a usar es la frase escrita — que es como se llegó aquí.');
});
