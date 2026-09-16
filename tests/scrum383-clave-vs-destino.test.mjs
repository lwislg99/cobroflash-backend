// tests/scrum383-clave-vs-destino.test.mjs — SCRUM-383
//
// EL ACCIDENTE QUE ESTO IMPIDE, medido el 6-ago-2026:
//
//   cobroflash-backend → DATABASE_URL_STAGING → acela/yaqu_dev_javier   (DESARROLLO)
//   cobroflash-b1/b2/b3 → DATABASE_URL_STAGING → acela/railway          (STAGING)
//
// **Un solo nombre de variable, dos bases distintas.** Cuál te toca depende de en qué directorio
// estés parado, y ningún comando te lo recuerda. Las dos viven en el MISMO host, así que
// `_db-guard.mjs` —que valida el hostname— las da por iguales: para él las dos son «acela».
//
// Por eso el guard compara host **Y NOMBRE DE BASE**. Sin el nombre de base sería decorado: el
// caso real que hay que cazar es precisamente dos bases del mismo host.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DESTINOS_ESPERADOS,
  OK, NO_CUADRA, NO_PUDE_RESOLVER, CLAVE_DESCONOCIDA, WORKTREE_NO_DECLARADO,
  comprobarClaveVsDestino,
  exigirDestinoCorrecto,
  nombreDeWorktree,
} from '../scripts/_clave-vs-destino.mjs';

// URLs de mentira, con credenciales inventadas: este fichero NUNCA lee un `.env` real.
const STAGING = 'postgresql://u:p@acela.proxy.rlwy.net:5432/railway';
const DEV     = 'postgresql://u:p@acela.proxy.rlwy.net:5432/yaqu_dev_javier';
const PROD    = 'postgresql://u:p@autorack.proxy.rlwy.net:5432/railway';

// ── ① EL CASO BUENO ──────────────────────────────────────────────────────────────────────

test('SCRUM-383 · cuando la clave apunta a donde promete, pasa', () => {
  assert.equal(comprobarClaveVsDestino('DATABASE_URL_STAGING', STAGING, 'b2').veredicto, OK);
  assert.equal(comprobarClaveVsDestino('DATABASE_URL_DEV', DEV, 'backend').veredicto, OK);
  assert.equal(comprobarClaveVsDestino('DATABASE_URL', PROD, 'backend').veredicto, OK);
});

// ── ② 🔴 EL CASO REAL: MISMO HOST, BASE DISTINTA ─────────────────────────────────────────

test('SCRUM-383 · 🔴 EL CASO MEDIDO: `_STAGING` apuntando a dev CAE, aunque el host sea el mismo', () => {
  const r = comprobarClaveVsDestino('DATABASE_URL_STAGING', DEV, 'cobroflash-backend');

  assert.equal(r.veredicto, NO_CUADRA,
    '🔴 EL GUARD NO CAZA EL CASO QUE EXISTE PARA CAZAR. `DATABASE_URL_STAGING` apuntando a ' +
    '`yaqu_dev_javier` es exactamente lo que se midió el 6-ago-2026 en el worktree principal. ' +
    'Si esto pasa en verde, una migración «a staging» puede caer en desarrollo.');

  // 🔴 Y el rojo tiene que decir LAS DOS COSAS: qué prometía y a qué apunta. «No cuadra» a secas
  // obliga a adivinar en qué dirección está el error.
  assert.match(r.mensaje, /STAGING/, '🔴 el rojo no dice qué PROMETÍA la clave');
  assert.match(r.mensaje, /railway/, '🔴 el rojo no dice la base esperada');
  assert.match(r.mensaje, /yaqu_dev_javier/, '🔴 el rojo no dice a qué apunta DE VERDAD');
  // Y en qué worktree, que es el contexto invisible: el mismo nombre significa cosas distintas
  // según el directorio.
  assert.match(r.mensaje, /cobroflash-backend/,
    '🔴 el rojo NO DICE EN QUÉ WORKTREE está. Es el dato que falta siempre: la misma clave ' +
    'significa una base u otra según el directorio, y nada te lo recuerda.');
});

test('SCRUM-383 · el host solo NO basta, y por eso se compara también la base', () => {
  // Las dos URLs comparten host. Un guard que solo mirase el hostname las daría por iguales —
  // que es justo lo que hace `_db-guard.mjs` y lo que dejó pasar este problema.
  const mismoHost = (a, b) => new URL(a).hostname === new URL(b).hostname;
  assert.equal(mismoHost(STAGING, DEV), true,
    '🔴 el caso de prueba ya no comparte host: entonces no prueba lo que dice probar, porque el ' +
    'guard de hostname también lo cazaría y este fichero sería redundante.');

  assert.equal(comprobarClaveVsDestino('DATABASE_URL_STAGING', DEV, 'x').veredicto, NO_CUADRA);
  assert.equal(comprobarClaveVsDestino('DATABASE_URL_DEV', STAGING, 'x').veredicto, NO_CUADRA,
    '🔴 tampoco caza el cruce inverso: dev apuntando a staging es el accidente MÁS caro de los dos');
});

test('SCRUM-383 · 🔴 apuntar a PRODUCCIÓN desde una clave que no es la de producción, cae', () => {
  const r = comprobarClaveVsDestino('DATABASE_URL_STAGING', PROD, 'b2');
  assert.equal(r.veredicto, NO_CUADRA);
  assert.match(r.mensaje, /autorack/, '🔴 el rojo no nombra el host real al que se iba a conectar');
});

// ── ③ SUELO: «no pude comprobarlo» NO es «cuadra» ────────────────────────────────────────

test('SCRUM-383 · 🔴 SUELO: si no puede resolver el destino, FALLA (no pasa en verde)', () => {
  // Es literalmente el hueco que quedó nombrado al concluir sobre producción: el chequeo de
  // arranque devuelve `arranca: true` cuando NO PUDO comprobar, y eso hace que «está bien» y
  // «no supe mirar» acaben en el mismo sitio. Aquí no.
  for (const malo of ['', '   ', null, undefined, 'no soy una url', 'postgresql://sin-barra']) {
    const r = comprobarClaveVsDestino('DATABASE_URL_STAGING', malo, 'b2');
    assert.equal(r.veredicto, NO_PUDE_RESOLVER,
      `🔴 con la URL «${String(malo)}» el veredicto fue «${r.veredicto}» en vez de no_pude_resolver. ` +
      '«Coincide» y «no supe mirar» son el mismo verde en pantalla y lo contrario en significado.');
    assert.notEqual(r.veredicto, OK);
    assert.match(r.mensaje, /NO SE SABE/);
  }
});

test('SCRUM-383 · una clave no declarada no se aprueba «por defecto»: se dice', () => {
  const r = comprobarClaveVsDestino('DATABASE_URL_INVENTADA', STAGING, 'b2');
  assert.equal(r.veredicto, CLAVE_DESCONOCIDA,
    '🔴 una clave sin destino declarado ha pasado. Contra ella no se puede comprobar NADA, así ' +
    'que aprobarla es aprobar a ciegas.');
  assert.match(r.mensaje, /DATABASE_URL_INVENTADA/);
});

// ── ④ EL ENGANCHE: LANZA ANTES DE CUALQUIER OPERACIÓN DE ESQUEMA ─────────────────────────

test('SCRUM-383 · `exigirDestinoCorrecto` LANZA salvo que cuadre — incluido el «no pude»', () => {
  assert.doesNotThrow(() => exigirDestinoCorrecto('DATABASE_URL_STAGING', STAGING, 'b2'));
  assert.throws(() => exigirDestinoCorrecto('DATABASE_URL_STAGING', DEV, 'backend'), /NO APUNTA A DONDE DICE/);
  assert.throws(() => exigirDestinoCorrecto('DATABASE_URL_STAGING', '', 'b2'), /NO SE PUDO RESOLVER/,
    '🔴 con el destino sin resolver ha dejado seguir. El suelo tiene que valer también aquí: ' +
    'es el punto por el que pasan las operaciones de esquema.');
});

// ── ⑤ LA TABLA DECLARA LAS TRES BASES, Y CON NOMBRE DE BASE ──────────────────────────────

test('SCRUM-383 · la tabla de destinos cubre las tres bases y NINGUNA se identifica solo por host', () => {
  const claves = Object.keys(DESTINOS_ESPERADOS);
  assert.ok(claves.length >= 3, `🔴 solo hay ${claves.length} destinos declarados; las bases son tres`);

  // staging y dev comparten host: si alguna de las dos se declarara sin `base`, el guard no
  // podría distinguirlas y volveríamos al agujero de partida.
  const staging = DESTINOS_ESPERADOS.DATABASE_URL_STAGING;
  const dev = DESTINOS_ESPERADOS.DATABASE_URL_DEV;
  assert.equal(staging.host, dev.host, '🔴 el caso ya no es «mismo host, base distinta»: revisa este test');
  assert.ok(staging.base && dev.base,
    '🔴 staging o dev se declaran SIN nombre de base. Comparten host, así que sin la base el ' +
    'guard las da por iguales — que es exactamente el agujero que este fichero cierra.');
  assert.notEqual(staging.base, dev.base);
});

// ── ⑥ `DATABASE_URL_TESTS` · LA BASE DE PRUEBAS DEL CARRIL, DECLARADA POR WORKTREE ───────
//
// El tercer concepto: los seis consumidores de la tanda no quieren «staging» ni «dev», quieren
// la base de pruebas de SU carril. Que sea distinta por worktree NO es el defecto — el defecto
// era un nombre que PROMETÍA staging y daba dev. Éste describe algo verdadero en los cuatro
// sitios, y la diferencia decisiva es que **se puede declarar y verificar**.

test('SCRUM-383 · `_TESTS` cuadra con la base que le toca a CADA carril', () => {
  assert.equal(comprobarClaveVsDestino('DATABASE_URL_TESTS', DEV, 'cobroflash-backend').veredicto, OK);
  for (const w of ['cobroflash-b1', 'cobroflash-b2', 'cobroflash-b3']) {
    assert.equal(comprobarClaveVsDestino('DATABASE_URL_TESTS', STAGING, w).veredicto, OK,
      `🔴 en ${w} la base de pruebas del carril es \`railway\` y no ha cuadrado`);
  }
});

test('SCRUM-383 · 🔴 `_TESTS` apuntando a la base de OTRO carril CAE, y dice en cuál está', () => {
  // El accidente que vigila: el árbol principal escribiendo en la base que comparten b1/b2/b3.
  const r = comprobarClaveVsDestino('DATABASE_URL_TESTS', STAGING, 'cobroflash-backend');
  assert.equal(r.veredicto, NO_CUADRA,
    '🔴 el principal apuntando a `railway` ha pasado. Es la base de los otros TRES carriles: ' +
    'la tanda de aquí crearía y borraría merchants sobre las fixtures vivas de otra sesión.');
  assert.match(r.mensaje, /cobroflash-backend/, '🔴 no dice EN QUÉ WORKTREE está');
  assert.match(r.mensaje, /yaqu_dev_javier/, '🔴 no dice qué base le tocaba a este carril');
  assert.match(r.mensaje, /railway/, '🔴 no dice a qué base apunta de verdad');

  // Y el cruce inverso: un carril b apuntando a la del principal.
  assert.equal(comprobarClaveVsDestino('DATABASE_URL_TESTS', DEV, 'cobroflash-b2').veredicto, NO_CUADRA);
});

test('SCRUM-383 · 🔴 SUELO: en un worktree NO declarado, `_TESTS` no se aprueba «por defecto»', () => {
  // Un árbol nuevo no tiene base asignada. Aprobarlo sería aprobar sin saber contra qué.
  for (const w of ['cobroflash-b4', 'otro-sitio', '', null, undefined]) {
    const r = comprobarClaveVsDestino('DATABASE_URL_TESTS', STAGING, w);
    assert.equal(r.veredicto, WORKTREE_NO_DECLARADO,
      `🔴 con el worktree «${String(w)}» el veredicto fue «${r.veredicto}». Sin saber qué base le ` +
      'toca a este carril, «cuadra» es una afirmación que nadie ha comprobado.');
    assert.notEqual(r.veredicto, OK);
  }
  // Y el enganche que usan las operaciones de esquema tiene que LANZAR también aquí.
  assert.throws(() => exigirDestinoCorrecto('DATABASE_URL_TESTS', STAGING, 'cobroflash-b4'),
    /NO SE PUEDE COMPROBAR EN ESTE ÁRBOL/);
});

test('SCRUM-383 · el worktree se identifica por su NOMBRE, venga suelto o como ruta', () => {
  // El CLI pasa la raíz absoluta del árbol; los tests pasan el nombre. Las dos formas valen, y
  // el mensaje NUNCA enseña la ruta: es información del disco de quien lo corre.
  assert.equal(nombreDeWorktree('c:\\Users\\x\\cobroflash-b2'), 'cobroflash-b2');
  assert.equal(nombreDeWorktree('/home/x/cobroflash-b2/'), 'cobroflash-b2');
  assert.equal(nombreDeWorktree('cobroflash-b2'), 'cobroflash-b2');
  assert.equal(nombreDeWorktree(''), null);

  const r = comprobarClaveVsDestino('DATABASE_URL_TESTS', STAGING, 'c:\\Users\\x\\cobroflash-backend');
  assert.equal(r.veredicto, NO_CUADRA, '🔴 no resolvió el worktree desde una ruta absoluta');
  assert.doesNotMatch(r.mensaje, /Users/,
    '🔴 el mensaje enseña la RUTA del disco. Solo se nombra el worktree; la ruta es ruido e ' +
    'información de la máquina de alguien (mismo criterio que `_identidad-sesion.mjs`).');
});

test('SCRUM-383 · los cuatro worktrees del reparto están declarados', () => {
  const mapa = DESTINOS_ESPERADOS.DATABASE_URL_TESTS.porWorktree;
  assert.deepEqual(Object.keys(mapa).sort(),
    ['cobroflash-b1', 'cobroflash-b2', 'cobroflash-b3', 'cobroflash-backend']);
  // El reparto MEDIDO: el principal aislado en dev, los tres carriles b compartiendo staging.
  assert.equal(mapa['cobroflash-backend'], 'yaqu_dev_javier');
  assert.equal(mapa['cobroflash-b1'], 'railway');
  assert.notEqual(mapa['cobroflash-backend'], mapa['cobroflash-b1'],
    '🔴 si los cuatro carriles apuntaran a la misma base, este ticket habría cambiado el ' +
    'comportamiento en vez de arreglar el nombre — y el aislamiento por carril es deliberado.');
});

// ── ⑦ EL MAPA MEDIDO ESTÁ ESCRITO, Y SIGUE ESTÁNDOLO ─────────────────────────────────────

test('SCRUM-383 · el mapa medido de los cuatro worktrees sigue en el documento', () => {
  // Una medición que no está en el repo se pierde con la sesión. Y si alguien la borra, el
  // mensaje del guard apunta a un sitio donde ya no hay nada.
  // ⚠️ `fileURLToPath`, NO `url.pathname`: la ruta de este repo lleva un espacio («Javier
  // Pereira») y `pathname` lo entrega como `%20`, así que el fichero «no existe». Ese error se
  // lee como «el mapa ha desaparecido» cuando lo que ha fallado es el lector.
  const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const doc = fs.readFileSync(path.join(raiz, 'docs', 'MIGRATIONS_PENDING.md'), 'utf8');
  assert.match(doc, /MAPA MEDIDO el 6-ago-2026/,
    '🔴 el mapa medido de los cuatro worktrees ha desaparecido de MIGRATIONS_PENDING.md, y el ' +
    'mensaje de rojo de este guard remite a él.');
  for (const w of ['cobroflash-backend', 'cobroflash-b1', 'cobroflash-b2', 'cobroflash-b3']) {
    assert.ok(doc.includes(w), `🔴 el mapa ya no dice qué base toca \`${w}\``);
  }
});
