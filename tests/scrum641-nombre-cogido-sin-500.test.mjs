// tests/scrum641-nombre-cogido-sin-500.test.mjs — SCRUM-641
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS DOS MITADES DEL MISMO CAMINO.
//
// ① El servidor daba la forma equivocada. `PUT /:id` no capturaba `P2002`, así que editar un
//    producto hacia un nombre ya cogido caía al `internal_error` de abajo: **500**. Un 500 dice
//    «se ha roto el servidor»; un 409 dice «ese nombre ya está cogido». Son mensajes distintos
//    para quien mira y arreglos distintos para quien programa.
//
// ② El cliente lo pintaba sin traducir. `throw new Error(data?.error || "Error actualizando…")`
//    hace que el identificador GANE al respaldo en castellano, y el aviso pinta `e.message`: un
//    fontanero mirando su catálogo leía literalmente `name_duplicate`.
//
// Van juntas porque arreglar sólo una deja al profesional leyendo otro identificador crudo, o
// leyendo el texto bueno detrás de un 500 que no debería existir. Y se destapan a la vez: en
// cuanto SCRUM-631 haga que reactivar un producto sea normal, este camino pasa de raro a
// frecuente.
//
// 🔴 EL DESNUDADO DE COMENTARIOS NO ES COSMÉTICA. El comentario que explica el arreglo en
// `products.routes.ts` nombra `P2002`, `409` y `name_duplicate`. Un guard de texto sin desnudar
// se cazaría A SÍ MISMO en la prosa que explica la prohibición — ya pasó dos veces (SCRUM-614 y
// SCRUM-617). Por eso hay control positivo de que el desnudado NO se ha comido el código.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTAS = path.join(RAIZ, 'src/modules/products/app/routes/products.routes.ts');
const VISTA = path.join(RAIZ, 'public/dashboard/js/productsView.js');

/** Quita `//…` y `/*…*\/`. Lo que quede es código, no prosa sobre el código. */
function desnudar(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n');
}

/** Trocea el fichero de rutas en bloques, uno por `router.<verbo>(`. */
function bloquesDeRuta(src) {
  const marcas = [...src.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']*)'/g)];
  return marcas.map((m, i) => ({
    verbo: m[1].toUpperCase(),
    ruta: m[2],
    cuerpo: src.slice(m.index, i + 1 < marcas.length ? marcas[i + 1].index : src.length),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// LAS RUTAS MASIVAS, DECLARADAS CON SU MOTIVO — y no es una lista para ir creciendo.
//
// El reparto NO es «tres rutas de creación con un criterio». Medido: son MASIVA vs UNA SOLA
// FILA, y las dos formas son correctas en su sitio. En una carga masiva un duplicado se SALTA y
// la operación entera sigue siendo un éxito (idempotencia de ONBOARD-2, y el `skipped` del CSV);
// en una escritura de una fila el duplicado ES el fallo de esa operación.
// ─────────────────────────────────────────────────────────────────────────────────────────
const MASIVAS_DECLARADAS = Object.freeze({
  'POST /load-catalog':
    'Carga masiva del catálogo por gremio (ONBOARD-2). Se traga el P2002 A PROPÓSITO para ser '
    + 'idempotente: recargar el catálogo no puede duplicar lo que ya está. La retira quien decida '
    + 'que recargar deba fallar en vez de saltar.',
  'POST /import':
    'Import de CSV. El duplicado se cuenta como `skipped` y la respuesta es 200 con el reparto '
    + '(SCRUM-339, contrato alineado con el import de clientes). La retira quien cambie ese contrato.',
});

test('SCRUM-641 · SUELO: el desnudado NO se ha comido el código', () => {
  const crudo = fs.readFileSync(RUTAS, 'utf8');
  const limpio = desnudar(crudo);

  // Sin esto, un desnudador que devolviera cadena vacía dejaría todo lo de abajo en verde eterno.
  assert.ok(limpio.includes("router.put('/:id'"), 'el desnudado se ha llevado las rutas por delante.');
  assert.ok(limpio.includes("router.post('/'"), 'el desnudado se ha llevado POST / por delante.');
  assert.ok(limpio.length > crudo.length * 0.4,
    `el desnudado dejó ${limpio.length} de ${crudo.length} bytes: se ha comido código, no prosa.`);

  // Y que de verdad QUITA prosa: el comentario del arreglo nombra las tres palabras que este
  // fichero busca. Si siguiera ahí, el guard se cazaría a sí mismo.
  assert.ok(crudo.includes('SCRUM-641'), 'suelo del suelo: el comentario del arreglo existe.');
  assert.ok(!limpio.includes('SCRUM-641'), 'el desnudado NO está quitando los comentarios.');
});

test('SCRUM-641 · toda escritura de UNA FILA contesta 409 al chocar con el nombre', () => {
  const limpio = desnudar(fs.readFileSync(RUTAS, 'utf8'));
  const bloques = bloquesDeRuta(limpio);

  // Derivado, no escrito a mano: escribe una fila quien llama a `createProduct`/`updateProduct`.
  const escriben = bloques.filter((b) => /\b(createProduct|updateProduct)\s*\(/.test(b.cuerpo));
  assert.ok(escriben.length >= 3,
    `🔴 CIEGO: sólo veo ${escriben.length} rutas que escriban productos. El detector dejó de `
    + 'reconocerlas y cualquier verde de abajo no significa nada.');

  const sinTraducir = [];
  for (const b of escriben) {
    const clave = `${b.verbo} ${b.ruta}`;
    if (MASIVAS_DECLARADAS[clave]) continue;
    const ok = /P2002/.test(b.cuerpo)
      && /\b409\b/.test(b.cuerpo)
      && /name_duplicate/.test(b.cuerpo);
    if (!ok) sinTraducir.push(clave);
  }

  assert.deepEqual(sinTraducir, [],
    '🔴 UNA ESCRITURA DE UNA FILA DEVUELVE 500 CUANDO EL NOMBRE YA ESTÁ COGIDO:\n'
    + sinTraducir.map((r) => '   · ' + r).join('\n')
    + '\n\n  Un 500 dice «se ha roto el servidor» y manda a mirar los logs; lo que pasa es que\n'
    + '  el nombre está cogido, que es un 409 y una frase para el profesional. Se copia el\n'
    + '  criterio de `POST /`, no se inventa uno nuevo. Si esta ruta es MASIVA y se traga el\n'
    + '  duplicado a propósito, decláralo en MASIVAS_DECLARADAS con su motivo.');
});

test('SCRUM-641 · CONTROL NEGATIVO: las MASIVAS se comportan exactamente como antes', () => {
  const limpio = desnudar(fs.readFileSync(RUTAS, 'utf8'));
  const bloques = bloquesDeRuta(limpio);
  const carga = bloques.find((b) => b.ruta === '/load-catalog');

  assert.ok(carga, 'no encuentro POST /load-catalog: el troceador dejó de verla.');
  // Sus DOS bucles siguen tragándose el duplicado y siguiendo. Si esto cambiara, recargar el
  // catálogo del gremio pasaría a fallar en vez de ser idempotente.
  const tragadas = [...carga.cuerpo.matchAll(/if\s*\(\s*e\?\.code\s*!==\s*'P2002'\s*\)\s*throw e/g)];
  assert.equal(tragadas.length, 2,
    `🔴 los bucles de load-catalog ya no se tragan el P2002 igual (${tragadas.length} de 2). `
    + 'Has cambiado lo que ya funcionaba: la idempotencia de ONBOARD-2.');
  assert.ok(!/name_duplicate/.test(carga.cuerpo),
    '🔴 load-catalog ha empezado a devolver 409: era masiva y saltaba duplicados.');

  // Y la que YA contestaba 409 sigue contestándolo, con el MISMO código.
  const post = bloques.find((b) => b.verbo === 'POST' && b.ruta === '/');
  assert.ok(/409/.test(post.cuerpo) && /name_duplicate/.test(post.cuerpo));
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② LA PANTALLA
// ═════════════════════════════════════════════════════════════════════════════════════════

const banco = cargarDashboard(RAIZ, {});
const mensajeDeError = banco.ctx.mensajeDeErrorCatalogo;
const MARCADOR = banco.ctx.PV_MARCADOR_MICROCOPY;

test('SCRUM-641 · SUELO: el dashboard carga y publica el traductor', () => {
  assert.equal(banco.fallos.length, 0, 'algún script del dashboard no cargó: nada de abajo vale.');
  assert.equal(typeof mensajeDeError, 'function');
  assert.equal(MARCADOR, '[PENDIENTE microcopy oficial]');
});

test('SCRUM-641 · el identificador NO llega a la pantalla — y el caso se distingue', () => {
  const salida = mensajeDeError('name_duplicate', 'Error actualizando.');

  assert.ok(!salida.includes('name_duplicate'),
    '🔴 `name_duplicate` sigue llegando a la pantalla. Es el defecto entero.');
  // Es un control de varios lados: si este caso dijera lo mismo que el respaldo genérico, la
  // pantalla perdería la distinción que este ticket vino a dar.
  assert.notEqual(salida, 'Error actualizando.',
    '🔴 el caso del nombre cogido ya no se distingue de un error cualquiera.');
  assert.equal(salida, banco.ctx.PV_NOMBRE_DUPLICADO,
    '🔴 el traductor no está pintando el texto aprobado.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// LA MICROCOPY · aprobada por el ASESOR, provisional a la espera del fundador
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-641 · 🔴 el texto está aprobado, y el contador dice cuántos faltan por firmar', () => {
  const vista = fs.readFileSync(VISTA, 'utf8');

  // ① Sin marcador: el asesor lo aprobó con las cajas medidas delante (929 y 390 px).
  const linea = vista.split('\n').find((l) => l.startsWith('const PV_NOMBRE_DUPLICADO ='));
  assert.ok(linea, '🔴 CIEGO: no encuentro la constante `PV_NOMBRE_DUPLICADO`');
  assert.equal(linea.includes('[PENDIENTE'), false,
    '🔴 `PV_NOMBRE_DUPLICADO` ha vuelto a llevar marcador. Si el texto se retira, la entrada de '
    + '`productsView.js` tiene que volver a PINTAR en el censo de SCRUM-402 en el mismo commit.');

  // Y lo que se pinta de verdad tampoco lo lleva — la constante y el camino son dos cosas.
  assert.equal(mensajeDeError('name_duplicate', 'Error actualizando.').includes('[PENDIENTE'), false,
    '🔴 el marcador ha vuelto al camino que ve el profesional.');

  // ② EL CONTADOR, que es lo que distingue «sin marcador» de «firmado por el fundador» — la
  // avería que cerró SCRUM-726. Es UNA ranura y el número tiene que decirlo: si mañana entra un
  // segundo texto sin firma y esto se queda en 1, el hueco deja de estar declarado y el texto
  // entra en pantalla en silencio.
  const m = vista.match(/const PV_SIN_APROBAR = (\d+);/);
  assert.ok(m, '🔴 no hay contador de ranuras sin firmar: «sin marcador» se leería como «aprobado»');
  assert.equal(Number(m[1]), 1,
    `🔴 el contador dice ${m[1]} y el traductor estrena 1 texto sin firma. O ha entrado uno nuevo `
    + 'sin declararlo, o el fundador ha firmado y no se ha anotado.');

  // ③ Y NO ESTÁ EN `docs/microcopy/`, que es el registro del FUNDADOR: `constaAprobado()` lo
  // barre (SCRUM-726), así que meter ahí la firma del asesor la haría pasar por la suya.
  const dir = path.join(RAIZ, 'docs/microcopy');
  const registros = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  assert.equal(registros.some((f) => f.includes('641')), false,
    '🔴 hay un registro de SCRUM-641 en `docs/microcopy/`. Esta aprobación es del ASESOR y '
    + 'provisional: su sitio es `docs/master/SCRUM-641.md`. En ese directorio se leería como la '
    + 'firma del fundador.');
});

test('SCRUM-641 · un código SIN mapear cae al respaldo que ya estaba escrito, no al código', () => {
  // `forbidden`, `trial_expired`, `not_found`… El respaldo NO es microcopy nueva: es la frase en
  // castellano que cada llamada ya traía y que el identificador estaba tapando.
  for (const codigo of ['forbidden', 'trial_expired', 'not_found', 'empty_update', 'invalid_id']) {
    const salida = mensajeDeError(codigo, 'Error actualizando.');
    assert.equal(salida, 'Error actualizando.', `«${codigo}» no cayó al respaldo.`);
    assert.ok(!salida.includes(codigo), `«${codigo}» sigue llegando a la pantalla.`);
  }
});

test('SCRUM-641 · CONTROL NEGATIVO: una frase de verdad pasa intacta', () => {
  // 🔴 Sin esto, un traductor que devolviera SIEMPRE el respaldo pasaría los dos casos de arriba
  // y se habría cargado todos los mensajes ya redactados del resto de la pantalla.
  const frase = 'No se pudo cargar /admin/merchant';
  assert.equal(mensajeDeError(frase, 'Error.'), frase);
  assert.equal(mensajeDeError('Error listando productos', 'Error.'), 'Error listando productos');
  // Y sin nada que decir, el respaldo.
  assert.equal(mensajeDeError('', 'Error.'), 'Error.');
  assert.equal(mensajeDeError(null, 'Error.'), 'Error.');
});

test('SCRUM-641 · la vista ya no pinta `e.message` a pelo en ningún sitio', () => {
  const limpio = desnudar(fs.readFileSync(VISTA, 'utf8'));

  // Suelo: que el desnudado no se haya comido la vista.
  assert.ok(limpio.includes('setAlert('), 'el desnudado se llevó la vista por delante.');

  const crudos = limpio.split('\n')
    .map((l, i) => ({ l: i + 1, t: l.trim() }))
    .filter((x) => /\b(setAlert|toast|textContent\s*=)\b[^;\n]*\b\w+\.message\b/.test(x.t))
    .filter((x) => !/mensajeDeErrorCatalogo\(/.test(x.t));

  assert.deepEqual(crudos.map((x) => `${x.l}: ${x.t}`), [],
    '🔴 QUEDAN SITIOS QUE PINTAN EL MENSAJE SIN TRADUCIR. Cuando el servidor contesta con un\n'
    + '  identificador, ahí es donde acaba en la pantalla del profesional.');
});
