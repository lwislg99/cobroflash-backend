// tests/scrum418-credencial-de-produccion.test.mjs — SCRUM-418
//
// ¿HAY UNA CREDENCIAL DE PRODUCCIÓN EN UN ÁRBOL DE TRABAJO, Y LO CAZA ALGUIEN?
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL HUECO QUE CIERRA, MEDIDO EL 10-AGO-2026 EJECUTANDO EL GUARD
//
// SCRUM-383 ya declaraba `DATABASE_URL` en `DESTINOS_ESPERADOS` como PRODUCCIÓN. Parecía cubierto.
// No lo estaba, y el motivo es más incómodo que un olvido: **el guard la aprobaba**.
//
//   comprobarClaveVsDestino('DATABASE_URL', <a producción>, 'cobroflash-b1')  →  `cuadra` ✅
//
// Y es correcto para la pregunta que ese guard hace —«¿apunta a donde promete su nombre?»—: la
// clave promete producción y a producción va. El problema es que ésa no es la única pregunta. La
// segunda, que nadie hacía, es **si esa credencial debería existir en este árbol siquiera**.
//
// Peor todavía, el veredicto estaba INVERTIDO respecto del riesgo: `DATABASE_URL` apuntando a
// staging FALLABA, y apuntando a producción PASABA. El guard era más severo con la variante
// inofensiva que con la peligrosa.
//
// Medido sobre el barredor entero (`comprobarEsteArbol`), con un `.env` que lleva las tres claves
// legítimas más una `DATABASE_URL` a producción:
//
//   versión de `main`   → fallos = 0   (PASA EN VERDE)
//   con este ticket     → fallos = 1   (CAE, nombrando worktree, clave y host)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// POR QUÉ SE VIGILA POR DESTINO Y NO POR NOMBRE
//
// Una lista de nombres prohibidos sólo caza los nombres que alguien se acordó de escribir.
// Renombras la clave a `DATABASE_URL_PROD`, `URL_BUENA` o `TMP_1` y pasa. El host de producción
// es el mismo se llame como se llame la variable, así que la pregunta se le hace al destino.
//
// ⚠️ Este fichero NUNCA lee un `.env` real ni imprime una URL: todas las de aquí son inventadas,
// y del resultado sólo salen host y base (`parseBDSegura`, regla R7 / SCRUM-226).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OK, NO_PUDE_RESOLVER, PRODUCCION_EN_ARBOL, HOST_PRODUCCION,
  comprobarClaveVsDestino, comprobarCredencialDeProduccion, clavesDeConexion,
} from '../scripts/_clave-vs-destino.mjs';
import { comprobarEsteArbol } from '../scripts/comprobar-claves-bd.mjs';

// Credenciales INVENTADAS. Ninguna sale de ningún `.env`.
const STAGING = 'postgresql://u:p@acela.proxy.rlwy.net:5432/railway';
const DEV     = 'postgresql://u:p@acela.proxy.rlwy.net:5432/yaqu_dev_javier';
const PROD    = 'postgresql://u:p@autorack.proxy.rlwy.net:5432/railway';

/** El `.env` sano de un carril: las tres claves legítimas y ni una de producción. */
const ENV_SANO = Object.freeze({
  DATABASE_URL_STAGING: STAGING,
  DATABASE_URL_DEV: DEV,
  DATABASE_URL_TESTS: STAGING,   // en b1/b2/b3 la base de pruebas del carril es `railway`
});

const EN_B1 = { raiz: 'C:/Users/x/cobroflash-b1' };

// ── R1 · UNA CREDENCIAL DE PRODUCCIÓN EN EL ÁRBOL CAE, Y DICE DÓNDE ──────────────────────

test('SCRUM-418 · 🔴 `DATABASE_URL` a PRODUCCIÓN en un árbol de trabajo hace CAER el barrido', () => {
  const r = comprobarEsteArbol({ env: { ...ENV_SANO, DATABASE_URL: PROD }, ...EN_B1 });

  assert.ok(r.fallos > 0,
    '🔴 el barrido pasa EN VERDE con una credencial de producción en el árbol. Es exactamente lo ' +
    'que hacía la versión anterior: `DATABASE_URL` → producción daba «cuadra» y no sumaba fallo.');

  // El mensaje tiene que servir para ACTUAR, no solo para alarmar: sin las tres cosas, quien lo
  // lee no sabe en qué árbol está el problema ni qué clave quitar.
  assert.match(r.salida, /CREDENCIAL DE PRODUCCIÓN EN UN ÁRBOL DE TRABAJO/);
  assert.match(r.salida, /cobroflash-b1/, '🔴 el rojo no nombra el WORKTREE.');
  assert.match(r.salida, /DATABASE_URL\b/, '🔴 el rojo no nombra la CLAVE.');
  assert.match(r.salida, new RegExp(HOST_PRODUCCION.replace(/\./g, '\\.')), '🔴 el rojo no nombra el HOST.');

  // El veredicto, no sólo el texto: un mensaje se puede escribir a mano, un veredicto lo decide
  // la lógica y es lo que un llamador puede consultar sin leer prosa.
  assert.equal(comprobarCredencialDeProduccion('DATABASE_URL', PROD, 'cobroflash-b1').veredicto,
    PRODUCCION_EN_ARBOL);
});

test('SCRUM-418 · 🔴 y da igual CÓMO SE LLAME: se vigila el destino, no el nombre', () => {
  // La lección del ticket: un guard que sólo vigila las claves que le enseñaron deja pasar justo
  // la que no conoce. `DATABASE_URL_PROD` no está en `DESTINOS_ESPERADOS` ni lo estará nunca.
  for (const clave of ['DATABASE_URL_PROD', 'URL_BUENA', 'TMP_1']) {
    const r = comprobarEsteArbol({ env: { ...ENV_SANO, [clave]: PROD }, ...EN_B1 });
    assert.ok(r.fallos > 0, `🔴 «${clave}» apunta a producción y el barrido pasa en verde.`);
    assert.match(r.salida, new RegExp(clave), `🔴 el rojo no nombra «${clave}».`);
  }
});

test('SCRUM-418 · ⚠️ HERMANO POSITIVO: el guard de SCRUM-383 sigue diciendo que esto «cuadra»', () => {
  // No es un defecto suyo y NO se toca: contesta otra pregunta, y para ella la respuesta es esa.
  // Está aquí porque es la razón entera de que haga falta la segunda comprobación — y porque si
  // alguien «arreglara» 383 para que fallase, este assert se lo diría en vez de dejarlo pasar
  // como una mejora silenciosa que rompe la coherencia declarada de la tabla.
  assert.equal(comprobarClaveVsDestino('DATABASE_URL', PROD, 'cobroflash-b1').veredicto, OK,
    '🔴 si esto ha dejado de ser «cuadra», la tabla de destinos ha cambiado de significado y hay ' +
    'que revisar SCRUM-383 antes que este fichero.');
});

// ── R2 · CONTROL POSITIVO: LOS TRES DESTINOS LEGÍTIMOS SIGUEN PASANDO ────────────────────

test('SCRUM-418 · CONTROL POSITIVO: un árbol sano sigue pasando, y con las 3 claves miradas', () => {
  const r = comprobarEsteArbol({ env: { ...ENV_SANO }, ...EN_B1 });
  assert.equal(r.fallos, 0, `🔴 un árbol sano ha empezado a fallar:\n${r.salida}`);
  assert.equal(r.comprobadas, 3, '🔴 no se comprobaron las tres claves obligatorias.');
  assert.equal(r.conexiones, 3, '🔴 el barrido por destino no miró las tres cadenas de conexión.');

  // Y una por una, para que un verde no pueda venir de «no había nada que mirar».
  for (const [clave, url] of Object.entries(ENV_SANO)) {
    assert.equal(comprobarCredencialDeProduccion(clave, url, 'cobroflash-b1').veredicto, OK,
      `🔴 «${clave}» ha dejado de considerarse un destino legítimo.`);
  }
});

test('SCRUM-418 · el árbol PRINCIPAL también pasa (su base de pruebas es otra, y es correcto)', () => {
  const r = comprobarEsteArbol({
    env: { ...ENV_SANO, DATABASE_URL_TESTS: DEV },   // en `cobroflash-backend` la del carril es dev
    raiz: 'C:/Users/x/cobroflash-backend',
  });
  assert.equal(r.fallos, 0, `🔴 el árbol principal falla estando sano:\n${r.salida}`);
});

// ── R3 · LO QUE LO SEPARA DE UN GUARD DE ORTOGRAFÍA ──────────────────────────────────────

test('SCRUM-418 · 🔴 nombre CORRECTO y host EQUIVOCADO también cae', () => {
  // Si sólo mirase nombres, `DATABASE_URL_STAGING` sería un nombre perfectamente legítimo y
  // pasaría apuntando a donde fuera. Lo que se comprueba es el DESTINO.
  const aProduccion = comprobarEsteArbol({ env: { ...ENV_SANO, DATABASE_URL_STAGING: PROD }, ...EN_B1 });
  assert.ok(aProduccion.fallos > 0, '🔴 `DATABASE_URL_STAGING` apuntando a PRODUCCIÓN pasa en verde.');
  assert.match(aProduccion.salida, /CREDENCIAL DE PRODUCCIÓN|NO APUNTA A DONDE DICE/);

  // Y el caso que ya cazaba SCRUM-383 sigue cazado: staging apuntando a desarrollo. Los dos
  // guards conviven; ninguno tapa al otro.
  const aDesarrollo = comprobarEsteArbol({ env: { ...ENV_SANO, DATABASE_URL_STAGING: DEV }, ...EN_B1 });
  assert.ok(aDesarrollo.fallos > 0, '🔴 `DATABASE_URL_STAGING` apuntando a DESARROLLO pasa en verde.');
  assert.match(aDesarrollo.salida, /NO APUNTA A DONDE DICE/);
});

// ── R4 · SUELO: UN GUARD QUE NO MIRA NADA SE DECLARA CIEGO ───────────────────────────────

test('SCRUM-418 · 🔴 SUELO: sin ninguna cadena de conexión, el barrido se declara CIEGO', () => {
  const r = comprobarEsteArbol({ env: {}, ...EN_B1 });
  assert.ok(r.fallos > 0, '🔴 con el entorno VACÍO el barrido termina en verde. «No hay credencial ' +
    'de producción» y «no supe mirar» son el mismo número aquí y significan lo contrario.');
  assert.match(r.salida, /SUELO: no se leyó ni una sola cadena de conexión/);
  assert.equal(r.conexiones, 0);
});

test('SCRUM-418 · 🔴 SUELO: una URL ilegible NO es «no es producción»', () => {
  const r = comprobarCredencialDeProduccion('DATABASE_URL_TESTS', 'esto-no-es-una-url', 'cobroflash-b1');
  assert.equal(r.veredicto, NO_PUDE_RESOLVER,
    '🔴 una URL que no se puede leer ha salido como OK. No se puede afirmar que NO sea producción ' +
    'algo cuyo destino no se ha llegado a leer.');
  assert.notEqual(r.veredicto, OK);
});

// ── EL DETECTOR DE CADENAS DE CONEXIÓN: NI DE MÁS NI DE MENOS ────────────────────────────

test('SCRUM-418 · `clavesDeConexion` mira los valores que SON URLs de base, y sólo ésos', () => {
  const env = {
    DATABASE_URL_TESTS: STAGING,
    RARA: PROD,                                  // sin «DATABASE» en el nombre: entra igual
    WHATSAPP_ACCESS_TOKEN: 'EAAsecretoquenosemira',
    RESEND_API_KEY: 're_algo',
    VACIA: '',
  };
  const encontradas = clavesDeConexion(env).map((x) => x.clave).sort();
  assert.deepEqual(encontradas, ['DATABASE_URL_TESTS', 'RARA'],
    '🔴 el detector no coge exactamente las cadenas de conexión. De más significaría parsear ' +
    'secretos que no son suyos; de menos, dejar una credencial sin mirar.');

  // Que un token de Meta o una clave de Stripe NO se toquen no es cosmética: este barrido recorre
  // un `.env` entero, y lo único que puede leer son valores que ya son URLs de base de datos.
  assert.equal(clavesDeConexion({ WHATSAPP_ACCESS_TOKEN: 'EAAxxx' }).length, 0);
});

test('SCRUM-418 · el detector no se deja engañar por comillas ni espacios del `.env`', () => {
  // `.env` reales llevan comillas y espacios; si el detector se los tragara, la credencial de
  // producción entrecomillada sería invisible para el barrido — y `parseBDSegura` sí las quita.
  const env = { A: '"' + PROD + '"', B: "  " + PROD, C: "'" + STAGING + "'" };
  assert.equal(clavesDeConexion(env).length, 3, '🔴 comillas o espacios esconden una conexión.');
  const r = comprobarEsteArbol({ env: { ...ENV_SANO, ESCONDIDA: '"' + PROD + '"' }, ...EN_B1 });
  assert.ok(r.fallos > 0, '🔴 una credencial de producción ENTRECOMILLADA pasa en verde.');
});
