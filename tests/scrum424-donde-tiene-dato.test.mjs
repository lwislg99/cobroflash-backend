// tests/scrum424-donde-tiene-dato.test.mjs — SCRUM-424 (G3)
//
// EL BLOQUE «DÓNDE» DEJA DE SER CÓDIGO INALCANZABLE.
//
// SCRUM-318 construyó el bloque del rail con su enlace a mapa —la ventaja que ningún facturador
// tiene— y lo dejó probado. Pero `Job.direccion` no la escribía NADIE, así que `bloqueDonde`
// devolvía `null` SIEMPRE y el enlace no llegaba a una pantalla jamás. Un constructor probado que
// nadie puede alcanzar es código muerto con tests verdes.
//
// Este guard vigila la CADENA ENTERA, no el constructor: que exista el escritor (la ranura de
// `direccion` en el PATCH), que el rótulo aprobado esté puesto, y —lo que más importa— que abrir
// ese escritor NO deje sin verificar ninguna firma ya emitida.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 REGLA 29 · POR QUÉ ESTO NO ES UN «AÑADIR UN CAMPO MÁS»
//
// Los sobres de firma **v:1** calculan su `obra` desde `Job.direccion`, y la leen EN VIVO al
// verificar (`albaranBarrido.ts` le pasa el `job.direccion` de HOY: nadie guardó una copia). Todos
// los v:1 se sellaron con `null`, porque nadie la escribía. Así que escribirla ahora en un Trabajo
// con un albarán v:1 haría que su hash recalculado dejara de coincidir — **«no coincide» sobre un
// albarán intacto**, sin que nadie haya tocado la evidencia.
//
// Por eso el escritor se niega en ese caso, y por eso el test R4 de abajo es el que de verdad
// justifica esta tarea.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

const BLOQUES = require_(path.join(RAIZ, 'public/dashboard/js/jobRailBlocks.js'));
const VISTA = soloEjecutable(leer('public/dashboard/js/jobDetailView.js'), { almohadillaEsComentario: false });
const RUTA = soloEjecutable(leer('src/modules/jobs/app/routes/jobs.routes.ts'), { almohadillaEsComentario: false });

const {
  normalizarJobDireccion,
  versionLeeJobDireccion,
  albaranesConFirmaQueDependeDelTrabajo,
  JOB_DIRECCION_MAX,
} = await import('../dist/modules/jobs/domain/jobDireccion.js');

const { obraSegunVersion, ALBARAN_CONTENIDO_VERSION_ACTUAL } =
  await import('../dist/modules/jobs/domain/albaran.service.js');

const DIRECCION = 'Av. Rey Juan Carlos 145, 28919 Leganés (Madrid)';

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-424 · SUELO: el escáner encuentra `bloqueDonde` y el corpus que vigila', () => {
  assert.equal(
    typeof BLOQUES.bloqueDonde, 'function',
    '🔴 ESCÁNER CIEGO: no encuentro `bloqueDonde` en jobRailBlocks.js. O se renombró, o se movió — ' +
      'y en los dos casos TODOS los tests de abajo pasarían sin mirar el bloque que dicen vigilar. ' +
      'ARREGLA EL ESCÁNER, no el número.',
  );
  // Y el suelo de los dos ficheros que se leen por texto: un recorte vacío hace pasar cualquier
  // comprobación de «contiene».
  assert.ok(
    RUTA.includes("router.patch('/:id'") && RUTA.length > 2000,
    `🔴 ESCÁNER CIEGO: el ejecutable de jobs.routes.ts mide ${RUTA.length} caracteres y no ` +
      'contiene el PATCH. Las comprobaciones de la ranura de escritura saldrían verdes por vacío.',
  );
  assert.ok(
    VISTA.includes('job-nombre') && VISTA.length > 2000,
    `🔴 ESCÁNER CIEGO: el ejecutable de jobDetailView.js mide ${VISTA.length} caracteres y no ` +
      'contiene el campo del nombre, que es el vecino del que se añade aquí.',
  );
  // Suelo del propio dominio: si el módulo no cargara, todo lo de la regla 29 sería un verde vacío.
  assert.equal(typeof albaranesConFirmaQueDependeDelTrabajo, 'function', '🔴 ESCÁNER CIEGO: no carga `jobDireccion`');
});

// ── R1 · POSITIVO: con dirección, el bloque y el enlace ──────────────────────────────────────

test('SCRUM-424 · 🔴 R1 · POSITIVO: un Trabajo CON dirección pinta el bloque y el enlace lleva ahí', () => {
  const b = BLOQUES.bloqueDonde({ direccion: DIRECCION });
  assert.ok(b, '🔴 con dirección de verdad NO sale el bloque DÓNDE: el enlace a mapa sigue siendo inalcanzable');
  assert.equal(b.id, 'donde');

  const pintado = b.lineas.map((l) => l.texto).join(' ');
  assert.equal(pintado, DIRECCION, '🔴 lo que se pinta no es la dirección que se guardó');

  // El enlace lleva A ESA dirección, no a otra ni a ninguna parte.
  assert.equal(
    b.enlace.href,
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(DIRECCION)}`,
    '🔴 el `href` del mapa no sale del texto que se pinta: el pro leería una cosa y conduciría a otra',
  );
  assert.ok(b.enlace.href.includes(encodeURIComponent('Leganés')), '🔴 la dirección no viaja dentro del enlace');
});

test('SCRUM-424 · 🔴 R1b · el rótulo APROBADO está puesto, y ya no es un marcador', () => {
  const b = BLOQUES.bloqueDonde({ direccion: DIRECCION });
  assert.equal(
    b.enlace.texto, 'Abrir en mapa',
    '🔴 el rótulo del enlace no es el aprobado por el asesor el 10-ago-2026 (regla 30).',
  );
  assert.ok(
    !String(b.enlace.texto).includes('[PENDIENTE'),
    '🔴 el enlace sigue rotulado con el marcador de microcopy sin aprobar. Ahora que el bloque SÍ ' +
      'se pinta, ese marcador llegaría a la pantalla de un profesional (SCRUM-402).',
  );
});

// ── R2 · NEGATIVO: lo que ya funcionaba no se puede romper ───────────────────────────────────

test('SCRUM-424 · 🔴 R2 · NEGATIVO: sin dirección NO hay bloque vacío ni enlace a ninguna parte', () => {
  for (const direccion of [null, undefined, '', '   ']) {
    assert.equal(
      BLOQUES.bloqueDonde({ direccion }), null,
      `🔴 con direccion=${JSON.stringify(direccion)} se construye el bloque DÓNDE. Abrir el escritor ` +
        'no puede convertir «sin dato» en «bloque vacío»: un enlace a mapa sin dirección abre el ' +
        'mapa en ninguna parte y parece un fallo del móvil, no nuestro.',
    );
  }
  // Y el normalizador del backend hace lo mismo: vacío se queda VACÍO, nunca cae a otra dirección.
  for (const v of [null, undefined, '', '   ', '\t\n']) {
    assert.equal(
      normalizarJobDireccion(v), null,
      `🔴 normalizarJobDireccion(${JSON.stringify(v)}) no da null: se guardaría una cadena vacía y ` +
        '«sin dirección» dejaría de ser UN solo estado.',
    );
  }
  assert.equal(normalizarJobDireccion(`  ${DIRECCION}  `), DIRECCION, '🔴 no se recortan los espacios');
  assert.equal(normalizarJobDireccion('x'.repeat(400)).length, JOB_DIRECCION_MAX, '🔴 no se aplica el tope');
});

// ── R3 · ROJO POR EL MECANISMO ───────────────────────────────────────────────────────────────

test('SCRUM-424 · 🔴 R3 · si se quita la ESCRITURA, el bloque vuelve a ser inalcanzable', () => {
  // El rojo de este ticket NO es «el constructor funciona» —eso ya lo probaba SCRUM-318 y seguía
  // sin pintarse nunca—. Es que EXISTA quien escribe el dato. Se mira la ranura en el PATCH.
  assert.ok(
    /req\.body\?\.direccion !== undefined/.test(RUTA),
    '🔴 EL BLOQUE DÓNDE HA VUELTO A SER INALCANZABLE: `PATCH /admin/jobs/:id` ya no acepta ' +
      '`direccion`, así que nadie puede escribirla, así que `bloqueDonde` devuelve null SIEMPRE y ' +
      'el enlace a mapa no llega a ninguna pantalla. Es exactamente el estado del que venimos: ' +
      'código construido, probado y muerto.',
  );
  assert.ok(
    /data\.direccion = nueva/.test(RUTA),
    '🔴 el PATCH lee `direccion` pero no la guarda: acepta el campo y lo tira, que es peor que no ' +
      'aceptarlo — el pro teclea, no da error, y no se guarda nada.',
  );
  // Y la otra mitad de la cadena: el campo por el que se teclea.
  assert.ok(
    /job-direccion/.test(VISTA) && /direccion: nueva/.test(VISTA),
    '🔴 la vista ya no tiene el campo de la dirección de la obra, o no lo manda en el PATCH: la ' +
      'ruta aceptaría el dato y nadie se lo daría nunca.',
  );
  // El rail NO edita (patrón B2): el campo va en «Datos», nunca en la columna derecha.
  const i = VISTA.indexOf('function pintarBloqueRail');
  const j = VISTA.indexOf('\nfunction ', i + 1);
  assert.ok(i >= 0 && j > i, '🔴 ESCÁNER CIEGO: no se encuentra `pintarBloqueRail`');
  assert.ok(
    !VISTA.slice(i, j).includes('job-direccion'),
    '🔴 el campo de la dirección se ha colado en el rail. El rail es contexto de SOLO LECTURA ' +
      '(patrón B2, regla 4) y su propio guard de SCRUM-318 prohíbe que cree un `input`.',
  );
});

// ── R4 · REGLA 29 · LO QUE MÁS IMPORTA ───────────────────────────────────────────────────────

test('SCRUM-424 · 🔴 R4 · REGLA 29: escribir la dirección NO deja sin verificar una firma emitida', () => {
  // El criterio se PREGUNTA a `obraSegunVersion`, que es quien de verdad decide, en vez de
  // comparar `v === 1`. Primero el control de que la sonda mide algo.
  assert.equal(
    versionLeeJobDireccion(1), true,
    '🔴 la sonda dice que un sobre v:1 NO lee `Job.direccion`. Es falso —`obraSegunVersion(1, …)` ' +
      'devuelve `jobDireccion`— y con esta respuesta el escritor dejaría pasar justo el caso que ' +
      'rompe firmas.',
  );
  assert.equal(
    versionLeeJobDireccion(ALBARAN_CONTENIDO_VERSION_ACTUAL), false,
    '🔴 la sonda dice que la versión de HOY lee `Job.direccion`. Si eso fuera cierto, esta tarea ' +
      'no se podría hacer: cada firma nueva quedaría atada a un campo editable.',
  );
  // Suelo de la sonda: las dos ramas tienen que dar resultados DISTINTOS, o «true» y «false»
  // significarían lo mismo y las dos afirmaciones de arriba serían decorativas.
  assert.notEqual(
    obraSegunVersion(1, { jobDireccion: 'A', lugarEntrega: 'B' }),
    obraSegunVersion(ALBARAN_CONTENIDO_VERSION_ACTUAL, { jobDireccion: 'A', lugarEntrega: 'B' }),
    '🔴 SUELO: las dos versiones dan lo MISMO con las mismas fuentes — la sonda no distingue nada.',
  );

  // El caso que se bloquea: un Trabajo con un albarán firmado en v:1.
  const conV1 = [
    { numero: 'ALB-2026-001', evidenciaFirma: { v: 1, contentHash: 'da39a3ee' } },
    { numero: 'ALB-2026-002', evidenciaFirma: null },
  ];
  assert.deepEqual(
    albaranesConFirmaQueDependeDelTrabajo(conV1), ['ALB-2026-001'],
    '🔴 NO SE DETECTA la firma v:1 que depende de `Job.direccion`. Escribir la dirección haría que ' +
      'el hash recalculado de ese albarán dejara de coincidir: «no coincide» sobre un documento ' +
      'que nadie ha tocado. Una evidencia emitida no se toca nunca (regla 29).',
  );

  // El caso que SÍ se permite: firmado con la versión de hoy, o sin firmar.
  const soloV2 = [
    { numero: 'ALB-2026-003', evidenciaFirma: { v: ALBARAN_CONTENIDO_VERSION_ACTUAL, contentHash: 'x' } },
    { numero: 'ALB-2026-004', evidenciaFirma: null },
    { numero: 'ALB-2026-005', evidenciaFirma: undefined },
  ];
  assert.deepEqual(
    albaranesConFirmaQueDependeDelTrabajo(soloV2), [],
    '🔴 se bloquea un Trabajo cuyas firmas NO dependen de `Job.direccion`. Bloquear de más deja el ' +
      'bloque DÓNDE inalcanzable para casi todo el mundo, que es el defecto que esto viene a cerrar.',
  );
  assert.deepEqual(albaranesConFirmaQueDependeDelTrabajo([]), [], '🔴 un Trabajo sin albaranes se bloquea');
});

test('SCRUM-424 · 🔴 R4b · la ruta CORTA antes del `update`, y lo hace consultando por merchant', () => {
  // ⚠️ SE BUSCA LA LLAMADA `…(`, NO EL NOMBRE. Escrito como `/albaranesConFirmaQueDependeDelTrabajo/`
  // el `import` de la cabecera bastaba para dejarlo verde: probado por mutación —quitando la
  // llamada y dejando el import, esta aserción PASABA— y el rojo salía por el suelo de abajo con un
  // mensaje que culpa al escáner. Un guard que manda a arreglar el test cuando lo roto es el código
  // es peor que no tenerlo.
  const iLlamada = RUTA.indexOf('albaranesConFirmaQueDependeDelTrabajo(');
  assert.ok(
    iLlamada > 0,
    '🔴 EL PATCH YA NO COMPRUEBA LAS FIRMAS antes de escribir `direccion`. Sin esa comprobación, un ' +
      'Trabajo con un albarán firmado en v:1 queda con su firma sin poder verificarse y NADIE se ' +
      'entera: no hay error, no hay aviso, el hash simplemente deja de cuadrar el día que alguien ' +
      'mire. Una evidencia emitida no se toca nunca (regla 29).',
  );
  assert.ok(
    /ERROR_DIRECCION_SELLADA/.test(RUTA) && /status\(409\)/.test(RUTA),
    '🔴 el corte no devuelve un 409 con su código: «no se pudo» sin motivo obliga a adivinar',
  );
  // Regla 2: la consulta de albaranes filtra por merchant. Sin esto, un Trabajo de otro merchant
  // podría decidir si este puede escribir.
  //
  // El recorte sale de la LLAMADA localizada arriba. Escrito como `indexOf(nombre)` encontraba el
  // `import` de la cabecera y medía los 500 caracteres anteriores al import, que no contienen
  // ninguna consulta: salió ROJO con el código correcto. El primer sospechoso de un rojo raro es
  // el escáner.
  const trozo = RUTA.slice(Math.max(0, iLlamada - 500), iLlamada);
  assert.ok(
    trozo.includes('prisma.albaran.findMany'),
    '🔴 ESCÁNER CIEGO: el recorte anterior a la llamada no contiene la consulta que debería estar ' +
      'vigilando. Cualquier cosa que se compruebe sobre él es un verde vacío.',
  );
  assert.ok(
    /merchantId: req\.merchantId/.test(trozo),
    '🔴 la consulta de albaranes no filtra por `merchantId` (regla 2, multi-tenant).',
  );
});
