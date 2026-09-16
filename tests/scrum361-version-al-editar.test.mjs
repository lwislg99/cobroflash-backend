// tests/scrum361-version-al-editar.test.mjs — SCRUM-361 (H6 · fase 2)
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA VÍCTIMA, EN UNA LÍNEA
//
// Dos pestañas, o dos personas del mismo equipo, abren el mismo albarán. Una corrige las líneas y
// guarda. La otra guarda después, con lo que tenía en pantalla. **El trabajo de la primera
// desaparece y nadie se entera.** No hay error, no hay aviso, y el AuditLog anota «de v:3 a v:4»
// como si hubiera sido una edición normal.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTE FICHERO ES DISTINTO DEL DE LA FASE 1, Y NO SU COPIA
//
// `scrum361-version-al-firmar.test.mjs` vigila el momento de FIRMAR: que el CLIENTE no selle un
// contenido que no vio. Éste vigila el momento de EDITAR: que un PROFESIONAL no borre el trabajo
// de otro. Son las dos caras de la misma puerta, y la fase 1 solo cerró una — el PATCH seguía
// haciendo `version: { increment: 1 }` a ciegas.
//
// 🔴 LA REGLA ES UNA SOLA, Y ESO SE VIGILA AQUÍ. La comparación no se ha reimplementado: delega en
// la de la fase 1. Dos funciones que hoy dicen lo mismo pueden separarse mañana sin que nadie lo
// note, y un guard que vigila una divergencia es peor que una divergencia imposible. El test del
// final es lo que impide que alguien la reimplemente «para no importar de firma».
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// La herramienta de la casa para leer un fuente SIN comentarios (SCRUM-193). Gana ella: un guard
// que prohíbe una palabra cae sobre el comentario que explica la prohibición, y en la fase 1 ese
// defecto mordió por quinta vez.
import { leerFuente } from './_guard-texto.mjs';

import {
  puedeEditarEstaVersion,
  ERROR_ALBARAN_CAMBIADO_AL_EDITAR,
} from '../dist/modules/jobs/domain/albaranEdicion.js';
import { ERROR_ALBARAN_CAMBIADO } from '../dist/modules/jobs/domain/albaranFirmante.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const F_ADMIN = path.join(RAIZ, 'src', 'modules', 'jobs', 'app', 'routes', 'albaranes.routes.ts');
const F_PUBLICA = path.join(RAIZ, 'src', 'modules', 'jobs', 'app', 'routes', 'albaranPublic.routes.ts');
const F_DOMINIO = path.join(RAIZ, 'src', 'modules', 'jobs', 'domain', 'albaranEdicion.ts');
const F_FIRMANTE = path.join(RAIZ, 'src', 'modules', 'jobs', 'domain', 'albaranFirmante.ts');
const F_FRONT = path.join(RAIZ, 'public', 'dashboard', 'js', 'jobDetailView.js');

// ── 🔴 EL TEST QUE DECIDE ────────────────────────────────────────────────────────────────

test('SCRUM-361 f2 · 🔴 dos ediciones a la vez: la segunda RECHAZA y no se pierde nada', () => {
  // Ana abre la v:3 y guarda → el albarán queda en v:4. Bruno tenía abierta la MISMA v:3 y guarda
  // después. Hoy, sin esto, la escritura de Bruno entra y la de Ana deja de existir.
  const r = puedeEditarEstaVersion(3, 4);

  assert.equal(r.ok, false,
    '🔴 UNA EDICIÓN ESTÁ PISANDO A OTRA EN SILENCIO.\n\n' +
    '  Es el defecto entero de esta fase: dos personas abren el mismo albarán, la segunda en\n' +
    '  guardar sobrescribe el trabajo de la primera, y NADA lo dice — ni un error, ni un aviso.\n' +
    '  El AuditLog lo anota como una edición normal, así que ni siquiera queda la sospecha.\n' +
    '  El trabajo perdido no se puede recuperar: no hay historial de filas (decisión del fundador).');

  assert.equal(r.error, ERROR_ALBARAN_CAMBIADO_AL_EDITAR,
    `🔴 el código es «${r.error}»: quien lo lea en un log tiene que saber QUÉ pasó sin abrir el fichero`);
});

test('SCRUM-361 f2 · 🔴 CONTROL POSITIVO: con la versión al día se guarda IGUAL QUE HOY', () => {
  // Y es el que hace que el resto signifique algo. Un mecanismo que bloquea siempre no protege:
  // estorba, y acaba desactivado — el final de SCRUM-450. El 99,9 % de las ediciones son ésta.
  for (const v of [1, 2, 7, 99, 1234]) {
    const r = puedeEditarEstaVersion(v, v);
    assert.equal(r.ok, true,
      `🔴 con la MISMA versión (v:${v}) no deja guardar. El camino normal —un profesional solo, ` +
      'editando su albarán— acaba de romperse, y este mecanismo se desactivará al primer roce.');
  }
});

test('SCRUM-361 f2 · 🔴 SUELO: sin versión NO se escribe — «no la mandó» ≠ «mandó la correcta»', () => {
  // LA DECISIÓN, y va escrita porque es donde se decide si esto sirve: un PATCH sin versión se
  // RECHAZA. Un dashboard viejo en la caché del service worker, o un cliente de API anterior a
  // esta fase, no la manda — y tratarlo como «coincide» abriría por la puerta de atrás justo el
  // agujero que esta fase cierra, en silencio y para siempre.
  //
  // Manda la asimetría de coste: un guardado rechazado cuesta recargar y repetir; una edición
  // pisada NO SE DESHACE, y encima parece que se guardó.
  for (const nada of [undefined, null, '', '3', NaN, Infinity, 3.5, {}, [], true]) {
    const r = puedeEditarEstaVersion(nada, 3);
    assert.equal(r.ok, false,
      `🔴 se acepta escribir con version=${JSON.stringify(nada) ?? String(nada)} contra la v:3 real. ` +
      '«No sé qué estaba viendo este editor» se está leyendo como «estaba viendo lo mismo».');
    assert.equal(r.error, ERROR_ALBARAN_CAMBIADO_AL_EDITAR, '🔴 y ni siquiera lo nombra igual');
  }

  // CONTROL del suelo, DENTRO del mismo test: el 3 de verdad sí pasa. Sin esto, todo lo de arriba
  // se cumpliría con una función que devuelve `false` siempre y nadie podría editar nada.
  assert.equal(puedeEditarEstaVersion(3, 3).ok, true,
    '🔴 rechaza también la versión correcta: entonces el bucle de arriba no distingue nada.');
});

test('SCRUM-361 f2 · el rechazo se distingue por CÓDIGO, no por texto, y no se confunde con el de firmar', () => {
  const r = puedeEditarEstaVersion(3, 4);

  // Lo que el front usará para distinguirlo. Comparable por igualdad, no por `includes` sobre una
  // frase que mañana se reformula.
  assert.equal(ERROR_ALBARAN_CAMBIADO_AL_EDITAR, 'albaran_cambiado_al_editar',
    '🔴 el código cambió de nombre: quien lo comprobara por `err.code` deja de reconocerlo.');

  // 🔴 Y NO es el mismo que el de firmar: la acción que le toca al front es otra —allí «míralo
  // otra vez antes de firmar», aquí «tus cambios no se han guardado»—, y un solo código para las
  // dos obligaría a mirar la URL para saber qué pasó.
  assert.notEqual(ERROR_ALBARAN_CAMBIADO_AL_EDITAR, ERROR_ALBARAN_CAMBIADO,
    '🔴 editar y firmar devuelven el MISMO código: el front no puede distinguir dos situaciones ' +
    'que piden acciones distintas.');

  // La microcopy del profesional NO está aprobada todavía (regla 30), así que esta fase manda
  // código y NO mensaje. Si algún día aparece un `message` aquí, es que alguien escribió un texto
  // que el asesor no ha visto.
  assert.equal(r.message, undefined,
    '🔴 hay un `message` para el profesional que el asesor no ha aprobado (regla 30). Esta fase ' +
    'manda el código; el texto se propone en docs/master/SCRUM-361.md § fase 2 y se aprueba aparte.');
});

// ── EL CAMINO: LA VERSIÓN VIAJA, VUELVE, Y SE MIRA ANTES DE ESCRIBIR ─────────────────────

test('SCRUM-361 f2 · 🔴 el PATCH compara ANTES de escribir, y no incrementa a ciegas', () => {
  const fuente = leerFuente(F_ADMIN);

  const iComparacion = fuente.indexOf('puedeEditarEstaVersion(req.body?.version, albaran.version)');
  assert.notEqual(iComparacion, -1,
    '🔴 UNA EDICIÓN PISA A OTRA EN SILENCIO: el PATCH no compara la versión que trae el editor ' +
    'con la que hay ahora.\n\n' +
    '  Vuelve a hacer `version: { increment: 1 }` a ciegas, así que de dos personas editando el\n' +
    '  mismo albarán la segunda en guardar borra el trabajo de la primera — sin error y sin\n' +
    '  aviso. Y no hay historial de filas del que recuperarlo.');

  // 🔴 EL ORDEN IMPORTA, y por eso se mide y no se supone: una comparación escrita DESPUÉS del
  // `update` no protege de nada. Se lee la posición de las dos cosas en el fichero.
  const iEscritura = fuente.indexOf('version: { increment: 1 }');
  assert.notEqual(iEscritura, -1,
    '🔴 no se encuentra el incremento de versión en el PATCH: o cambió de forma —y este guard ' +
    'dejó de mirar lo que cree— o el albarán ya no versiona su contenido.');
  assert.ok(iComparacion < iEscritura,
    '🔴 la comparación está DESPUÉS de la escritura: para cuando se comprueba, la edición de la ' +
    'otra persona ya se ha perdido.');
});

test('SCRUM-361 f2 · el dashboard MANDA la versión que abrió (si no, el servidor no tiene contra qué comparar)', () => {
  const fuente = leerFuente(F_FRONT);

  assert.match(fuente, /version:\s*alb\.version/,
    '🔴 el editor del dashboard NO manda la versión que abrió. Con el suelo de esta fase, eso deja ' +
    'al profesional sin poder guardar NADA — y sin ella el servidor no puede distinguir «vengo de ' +
    'la versión buena» de «no sé de cuál vengo».');

  // CONTROL POSITIVO del propio filtro: si `leerFuente` devolviera vacío —o el fichero cambiara de
  // sitio— el `match` de arriba fallaría por la razón equivocada y el de abajo lo dice.
  assert.ok(fuente.length > 5000,
    `🔴 solo se han leído ${fuente.length} caracteres del dashboard: el guard está mirando un fichero vacío.`);
});

// ── 🔴 UNA SOLA REGLA DE VERSIÓN: LA DIVERGENCIA, IMPOSIBLE EN VEZ DE VIGILADA ───────────

test('SCRUM-361 f2 · 🔴 la comparación DELEGA en la fase 1: no hay una segunda implementación', () => {
  // POR QUÉ ESTE TEST ES EL SEGURO DE LOS DEMÁS. La alternativa a delegar era reimplementar la
  // comparación aquí y añadir un guard que comparase las dos. Pero dos implementaciones que
  // derivan en silencio dan rechazos falsos o —peor— ediciones pisadas que nadie detecta, dentro
  // del mecanismo que existe justamente para detectarlas. No hay dos: la segunda ES la primera.
  //
  // Este test es lo que impide que la próxima sesión la reimplemente «para no importar de firma».
  const fuente = leerFuente(F_DOMINIO);
  const sf = ts.createSourceFile('albaranEdicion.ts', fuente, ts.ScriptTarget.Latest, true);

  let cuerpo = null;
  const buscar = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === 'puedeEditarEstaVersion') cuerpo = n.body;
    ts.forEachChild(n, buscar);
  };
  buscar(sf);

  // CONTROL POSITIVO del escáner, antes de afirmar nada sobre lo que contiene: si la función
  // cambiara de nombre o de forma, todo lo de abajo pasaría por no encontrar nada que mirar.
  assert.ok(cuerpo,
    '🔴 no se ha encontrado `puedeEditarEstaVersion` en el AST de albaranEdicion.ts: este guard ' +
    'estaría dando verde sobre un conjunto vacío.');

  const llamadas = [];
  const identificadores = [];
  const ver = (n) => {
    if (ts.isCallExpression(n)) llamadas.push(n.expression.getText(sf));
    if (ts.isIdentifier(n)) identificadores.push(n.text);
    ts.forEachChild(n, ver);
  };
  ver(cuerpo);

  assert.ok(llamadas.includes('puedeFirmarEstaVersion'),
    '🔴 `puedeEditarEstaVersion` YA NO DELEGA en la comparación de la fase 1.\n\n' +
    '  Ahora hay DOS reglas de versión en el árbol. Hoy dirán lo mismo; el día que una cambie —un\n' +
    '  `>=` por un `===`, un entero que pasa a aceptarse como cadena— se separarán EN SILENCIO, y\n' +
    '  el mecanismo que existe para detectar ediciones pisadas empezará a mentir en una de las dos\n' +
    '  superficies. Si de verdad tienen que separarse, que sea una decisión escrita, no un descuido.');

  // 🔴 RESPALDO DE LA NEGACIÓN (SCRUM-237), y no es burocracia: el `!includes` de abajo sería
  // VERDE PERMANENTE si el token no existiera en ninguna parte o si el escáner mirase el fichero
  // equivocado — el bug de scrum73 exacto. El hermano afirma lo que la negación da por supuesto:
  // que `isInteger` es un token REAL y encontrable, y que vive en la fase 1, que es su sitio.
  const fase1 = leerFuente(F_FIRMANTE);
  assert.ok(fase1.includes('isInteger'),
    '🔴 la validación de entero ya no está en `albaranFirmante.ts`. O se movió —y entonces la ' +
    'negación de aquí abajo dejó de significar nada— o la fase 1 dejó de validar el entero y ' +
    'ahora una versión «3» en cadena podría colarse como buena.');

  // Y la señal de que alguien la reimplementó a mano: la validación de entero vive en la fase 1.
  assert.ok(!identificadores.includes('isInteger'),
    '🔴 `puedeEditarEstaVersion` valida el entero POR SU CUENTA: eso es la segunda implementación ' +
    'entrando por la puerta de atrás, aunque todavía llame a la de la fase 1.');
});

// ── REGRESIÓN: LA FASE 1 NO SE HA TOCADO ────────────────────────────────────────────────

test('SCRUM-361 f2 · REGRESIÓN: el camino de firma pública sigue exactamente igual', () => {
  // Regla 38: el mecanismo de firma se LEE, modificarlo es STOP. Esta fase no lo ha tocado, y eso
  // se comprueba en vez de prometerse.
  const fuente = leerFuente(F_PUBLICA);

  assert.match(fuente, /puedeFirmarEstaVersion\(req\.body\?\.version, albaran\.version\)/,
    '🔴 la comparación de la fase 1 ha desaparecido de la ruta pública de firma. Esta fase no ' +
    'debía tocarla: un cliente puede volver a firmar un contenido que no vio.');

  // Y el guard de la fase 1 que prohíbe recalcular el hash en el navegador sigue teniendo objeto:
  // esta fase tampoco ha metido criptografía en el cliente.
  for (const rastro of ['crypto.subtle', 'computeAlbaranContentHash', 'contenidoCanonico', 'sha256', 'digest(']) {
    assert.ok(!fuente.includes(rastro),
      `🔴 la página pública menciona «${rastro}» EN CÓDIGO: se está recalculando el hash en el cliente.`);
  }

  // El dashboard tampoco: el editor manda un entero, no una huella.
  const front = leerFuente(F_FRONT);
  for (const rastro of ['crypto.subtle', 'computeAlbaranContentHash', 'sha256', 'digest(']) {
    assert.ok(!front.includes(rastro),
      `🔴 el dashboard menciona «${rastro}» EN CÓDIGO: esta fase no necesita ningún hash en el ` +
      'navegador, y duplicarlo es exactamente lo que H0 midió que no se hiciera.');
  }
});
