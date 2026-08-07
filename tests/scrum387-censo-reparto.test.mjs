// tests/scrum387-censo-reparto.test.mjs — SCRUM-387
//
// EL CENSO CRUZA `main` CONTRA JIRA, Y ESTE FICHERO COMPRUEBA QUE EL CRUCE CRUZA.
//
// El defecto que hay detrás costó tres reconstrucciones en un día: Jira no se transiciona al
// mergear, así que dice «por hacer» de cosas que llevan un día en `main` — y el reparto se hace
// desde Jira. `main` sabe qué está HECHO; Jira sabe qué hay que HACER; nadie las cruzaba.
//
// ── POR QUÉ EL SUELO ES LA PARTE SERIA ──────────────────────────────────────────────────────
// «Cero desfases» y «no supe leer el directorio» son **el mismo número con significados
// opuestos**. Este ticket existe literalmente porque un vacío se leyó al revés: un `ls-remote`
// sin resultados se tomó como «rama borrada = mergeada», cuando también podía significar «rama
// que nunca llegó». Un censo que no encuentra nada tiene que GRITAR, no tranquilizar.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  numeroDeEntrada, ticketsConEntrada, numeroDeClave,
  agruparRamas, cruzar, motivosParaNoFiarse, alarmasDeRama,
} from '../scripts/_censo-reparto.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-387 · SUELO: sin entradas, el censo NO dice «todo alineado» — dice que no ha mirado', () => {
  const motivos = motivosParaNoFiarse({
    entradas: new Map(),
    abiertos: [{ key: 'SCRUM-1' }],
    ramas: { total: 3 },
  });
  assert.ok(motivos.length > 0, 'con CERO entradas el censo se declara fiable: es el fallo exacto que este ticket cierra');
  assert.match(motivos.join(' '), /docs\/master/, 'el motivo tiene que decir DÓNDE no ha mirado');
});

test('SCRUM-387 · SUELO: sin tickets de Jira tampoco se informa', () => {
  const motivos = motivosParaNoFiarse({ entradas: new Map([[1, 'a']]), abiertos: [], ramas: { total: 3 } });
  assert.ok(motivos.length > 0, 'cero abiertos con 70+ en el tablero es un fallo de consulta, no un tablero limpio');
});

test('SCRUM-387 · SUELO: sin ramas tampoco — no se puede afirmar que no hay duplicados', () => {
  const motivos = motivosParaNoFiarse({ entradas: new Map([[1, 'a']]), abiertos: [{ key: 'SCRUM-1' }], ramas: { total: 0 } });
  assert.ok(motivos.length > 0);
});

test('SCRUM-387 · SUELO: con las tres fuentes pobladas, el censo SÍ se declara fiable', () => {
  // El hermano positivo. Sin él, los tres de arriba pasarían aunque `motivosParaNoFiarse`
  // devolviera siempre algo — y el censo no informaría nunca.
  const motivos = motivosParaNoFiarse({
    entradas: new Map([[304, 'docs/master/SCRUM-304.md']]),
    abiertos: [{ key: 'SCRUM-304' }],
    ramas: { total: 2 },
  });
  assert.deepEqual(motivos, []);
});

// ── LOS DOS CONTROLES QUE PIDE EL TICKET ─────────────────────────────────────────────────────

test('SCRUM-387 · CONTROL POSITIVO: cerrado en Jira + entrada en main = alineado, no desfase', () => {
  const entradas = new Map([[304, 'docs/master/SCRUM-304.md']]);
  const r = cruzar({ entradas, abiertos: [{ key: 'SCRUM-999', estado: 'Tareas por hacer' }] });
  assert.deepEqual(r.desfases, [], 'un ticket cerrado con su entrada NO puede salir como desfase');
  assert.deepEqual(r.enMainYCerrado.map((x) => x.clave), ['SCRUM-304']);
});

test('SCRUM-387 · CONTROL NEGATIVO: abierto en Jira + entrada en main sale NOMBRADO', () => {
  const entradas = new Map([[304, 'docs/master/SCRUM-304.md']]);
  const r = cruzar({ entradas, abiertos: [{ key: 'SCRUM-304', estado: 'Tareas por hacer' }] });
  assert.equal(r.desfases.length, 1);
  // NOMBRADO es el requisito, no contado: «hay 7 desfases» no sirve para repartir.
  assert.equal(r.desfases[0].clave, 'SCRUM-304');
  assert.equal(r.desfases[0].fichero, 'docs/master/SCRUM-304.md', 'el desfase tiene que decir dónde está la evidencia');
});

test('SCRUM-387 · abierto SIN entrada es cola normal, no alarma', () => {
  const r = cruzar({ entradas: new Map([[1, 'x']]), abiertos: [{ key: 'SCRUM-500' }] });
  assert.deepEqual(r.desfases, []);
  assert.deepEqual(r.abiertoSinEntrada.map((x) => x.clave), ['SCRUM-500']);
});

// ── ROJO POR EL MECANISMO ────────────────────────────────────────────────────────────────────

test('SCRUM-387 · ROJO POR EL MECANISMO: quitar una entrada cambia el censo NOMBRANDO el ticket', () => {
  const abiertos = [{ key: 'SCRUM-304', estado: 'Tareas por hacer' }];
  const con = cruzar({ entradas: ticketsConEntrada(['docs/master/SCRUM-304.md']), abiertos });
  const sin = cruzar({ entradas: ticketsConEntrada([]), abiertos });

  assert.deepEqual(con.desfases.map((x) => x.clave), ['SCRUM-304'], 'con la entrada, sale como desfase');
  assert.deepEqual(sin.desfases, [], 'sin la entrada, deja de ser desfase');
  // Y lo importante: no desaparece del censo, CAMBIA DE CUBO. Un ticket que se esfuma del informe
  // al borrarle la entrada sería un censo que se puede silenciar borrando ficheros.
  assert.deepEqual(sin.abiertoSinEntrada.map((x) => x.clave), ['SCRUM-304']);
});

// ── LO QUE DERIVA, DERIVADO DE VERDAD ────────────────────────────────────────────────────────

test('SCRUM-387 · el número sale del NOMBRE del fichero, y lo que no es entrada se ignora', () => {
  assert.equal(numeroDeEntrada('docs/master/SCRUM-304.md'), 304);
  assert.equal(numeroDeEntrada('docs/master/README.md'), null, 'el README no es un ticket');
  assert.equal(numeroDeEntrada('docs/master/SCRUM-304-borrador.md'), null, 'un nombre que no es exacto no cuenta como entrada');
  assert.equal(numeroDeClave('SCRUM-304'), 304);
  assert.equal(numeroDeClave('scrum-304-albaranes-tabla'), 304);
  assert.equal(numeroDeClave('main'), null);
});

// ── ALARMAS DE RAMA ──────────────────────────────────────────────────────────────────────────

test('SCRUM-387 · dos ramas SIN MERGEAR con el mismo número es alarma, y sale con sus nombres', () => {
  const ramas = agruparRamas([
    'aaa\trefs/heads/scrum-300-campos-albaran',
    'bbb\trefs/heads/scrum-300-firmado-por',
    'ccc\trefs/heads/scrum-311-censo',
  ], () => false); // ninguna mergeada
  const alarmas = alarmasDeRama(ramas);
  assert.equal(alarmas.length, 1);
  assert.equal(alarmas[0].clave, 'SCRUM-300');
  assert.deepEqual(alarmas[0].ramas, ['scrum-300-campos-albaran', 'scrum-300-firmado-por']);
});

test('SCRUM-387 · una rama YA MERGEADA no cuenta como trabajo en paralelo', () => {
  // Medido en el árbol real: 99 de 143 ramas ya están en main. Contarlas convertía 7 alarmas
  // útiles en 21 inútiles, y una alarma que casi siempre es falsa deja de leerse.
  const filas = ['aaa\trefs/heads/scrum-300-uno', 'bbb\trefs/heads/scrum-300-dos'];
  const todasMergeadas = agruparRamas(filas, () => true);
  assert.deepEqual(alarmasDeRama(todasMergeadas), [], 'dos ramas ya en main no son dos personas construyendo');
  const unaViva = agruparRamas(filas, (sha) => sha === 'aaa');
  assert.deepEqual(alarmasDeRama(unaViva), [], 'con una sola viva tampoco hay paralelismo');
});

test('SCRUM-387 · lo INDETERMINADO no se cuenta como mergeado', () => {
  // No saber no es lo mismo que descartar. Si `merge-base` no puede responder, la rama sigue
  // pesando en la alarma: es justo la lectura al revés que originó este ticket.
  const ramas = agruparRamas(['aaa\trefs/heads/scrum-300-uno', 'bbb\trefs/heads/scrum-300-dos'], () => null);
  assert.equal(ramas.indeterminadas, 2);
  assert.equal(ramas.enMain, 0);
  assert.equal(alarmasDeRama(ramas).length, 1, 'dos ramas de estado desconocido siguen siendo una alarma');
});

// ── CONTRA EL ÁRBOL DE VERDAD ────────────────────────────────────────────────────────────────
//
// SE LEE EL ÁRBOL DE TRABAJO, NO `origin/main`, Y ESO ES UNA DECISIÓN DECLARADA.
//
// La primera versión hacía `git ls-tree origin/main -- docs/master/` y **tumbó el PR en CI**:
//
//     fatal: Not a valid object name origin/main
//
// **CI no tiene `origin/main` fetcheado.** Es la SEGUNDA vez en dos días que un guard se cae por
// darlo por hecho — la primera fue SCRUM-291, que lo resolvió trayéndose la referencia DENTRO del
// repo (un sha256 congelado) en vez de pedirla a un ref remoto.
//
// ⚠️ LO QUE NO SE HA HECHO, Y ERA LA TENTACIÓN: saltarse la comprobación cuando falta la
// referencia. Eso haría que «no pude mirar» se leyera igual que «miré y no hay desfases» — que es
// LITERALMENTE el defecto que este fichero existe para cazar. Un guard que no puede mirar no sale
// verde.
//
// Qué se mide entonces: **el árbol bajo prueba**, que tras el merge SERÁ `main`. Es la referencia
// correcta para un guard de PR —comprueba lo que se va a mergear, no lo que ya estaba— y no
// depende de red, de remotos ni de cómo haya hecho el checkout el runner.
//
// El CLI (`scripts/censo-reparto.mjs`) sigue leyendo `origin/main` A PROPÓSITO y eso NO es una
// incoherencia: ahí la pregunta es otra —«¿qué hay hecho AHORA MISMO para poder repartir?»— y el
// árbol local de quien lo ejecuta puede tener entradas a medio escribir. Corre en un portátil con
// remoto, no en CI, y si el ref falta lo dice y sale con error.

test('SCRUM-387 · SUELO: el directorio de entradas existe y no vuelve vacío', () => {
  // Antes de contar nada. «Cero entradas» y «he leído el sitio equivocado» son indistinguibles
  // desde el número, así que la ausencia del directorio se nombra en vez de contarse como cero.
  const dir = path.join(RAIZ, 'docs/master');
  let ficheros;
  try {
    ficheros = fs.readdirSync(dir);
  } catch (e) {
    assert.fail(
      `🔴 no se pudo leer ${dir} (${e && e.code ? e.code : e}).\n\n`
      + '  Este censo no puede afirmar «cero desfases» sin haber mirado. «No pude leer el\n'
      + '  directorio» y «lo leí y está todo alineado» no pueden dar el mismo resultado: ésa es\n'
      + '  exactamente la confusión que originó SCRUM-387.');
  }
  assert.ok(ficheros.length > 0, `🔴 ${dir} está VACÍO. No es «todo alineado»: es que no hay nada que cruzar`);
});

test('SCRUM-387 · el árbol bajo prueba trae las entradas que se esperan de él', () => {
  const ficheros = fs.readdirSync(path.join(RAIZ, 'docs/master'));
  const entradas = ticketsConEntrada(ficheros);
  assert.ok(entradas.size >= 60,
    `solo ${entradas.size} entradas derivadas de docs/master/: o el trinquete de SCRUM-273 ha dejado de cumplirse, o este test está leyendo otro sitio`);
  assert.ok(entradas.has(304), 'SCRUM-304 tiene entrada — si no se ve, el derivador no está mirando donde cree');
});

/**
 * ¿Este fuente ARRANCA PROCESOS? (o sea: ¿puede depender de git, y por tanto de un ref remoto?)
 *
 * Se mira por AST y no por texto, y el motivo lo aprendí en rojo aquí mismo: la primera versión
 * buscaba la cadena `origin/main` en el fichero y **se cazó a sí misma** — no en un comentario,
 * como suele, sino en su propio MENSAJE DE ERROR y en su control positivo. La forma de la trampa
 * cambia; la trampa es la misma (SCRUM-203).
 *
 * Y la propiedad estructural es además la correcta: lo que no puede hacer un guard de PR no es
 * «escribir cierta cadena», es **ir a buscar su referencia fuera del árbol bajo prueba**.
 */
function arrancaProcesos(ruta) {
  const codigo = fs.readFileSync(path.join(RAIZ, ruta), 'utf8');
  const sf = ts.createSourceFile(ruta, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const hallazgos = [];
  (function mirar(n) {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)
        && /child_process/.test(n.moduleSpecifier.text)) {
      hallazgos.push(`importa ${n.moduleSpecifier.text}`);
    }
    if (ts.isCallExpression(n) && /^(exec|execSync|execFile|execFileSync|spawn|spawnSync)$/.test(n.expression.getText(sf))) {
      hallazgos.push(`llama a ${n.expression.getText(sf)}()`);
    }
    ts.forEachChild(n, mirar);
  })(sf);
  return hallazgos;
}

test('SCRUM-387 · el censo no va a buscar su referencia FUERA del árbol bajo prueba', () => {
  // El guard del guard. Sin esto, alguien vuelve a meter `git ls-tree origin/main` en el camino de
  // lectura y el PR se cae en CI — van dos veces en dos días, y las dos se descubrieron en rojo.
  //
  // El CLI (`scripts/censo-reparto.mjs`) queda FUERA a propósito y con motivo escrito: corre en un
  // portátil con remoto, su pregunta es «¿qué hay hecho AHORA MISMO?» y para eso `origin/main` es
  // la referencia correcta. No corre en CI.
  for (const f of ['tests/scrum387-censo-reparto.test.mjs', 'scripts/_censo-reparto.mjs']) {
    assert.deepEqual(arrancaProcesos(f), [],
      `${f} arranca procesos: si eso es git, su referencia vive fuera del árbol y CI —que no tiene \`origin/main\` fetcheado— lo tumbará. La referencia de un guard de PR es el ÁRBOL BAJO PRUEBA`);
  }
  // Hermano positivo (SCRUM-237): el detector SÍ encuentra algo cuando lo hay, así que un
  // `deepEqual([])` verde significa algo. El CLI es el control: sabemos que arranca git.
  assert.ok(arrancaProcesos('scripts/censo-reparto.mjs').length > 0,
    'el detector no ve los procesos del CLI, que sí los tiene: entonces tampoco vería los de nadie');
});
