// SCRUM-302 (C2) · DUPLICAR UN ALBARÁN — el mecanismo, no la lista.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE ESTE FICHERO EXISTE PARA IMPEDIR, y no es lo que parece
//
// Lo obvio sería un test de «el duplicado no copia la firma». Ése hace falta y está abajo, pero
// **solo sabe lo que hoy se nos ocurrió enumerar**. El fallo que de verdad da miedo es otro:
//
//   Dentro de tres meses alguien añade un campo a `Albaran`. El duplicado se lo lleva EN SILENCIO.
//   Si ese campo es evidencial, hemos fabricado un documento que afirma algo que no pasó.
//
// Por eso el guard NO comprueba «no copies estos campos malos»: **deriva los campos del modelo y
// falla cuando aparece uno SIN CLASIFICAR**. La pregunta se le hace a quien añade el campo, en el
// momento en que lo añade, que es el único momento en que alguien sabe la respuesta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';
const { CAMPOS_QUE_VIAJAN, CAMPOS_QUE_NO_VIAJAN, datosDuplicado } =
  await import(DIST + 'modules/jobs/domain/albaranDuplicado.js');

/**
 * Los campos de `model Albaran`, DERIVADOS del schema.
 *
 * Se lee el modelo, no una lista escrita aquí: una lista escrita aquí envejecería igual que el
 * test que viene a sustituir, y con el mismo silencio.
 */
function camposDelModelo() {
  const schema = fs.readFileSync(path.join(RAIZ, 'prisma', 'schema.prisma'), 'utf8');
  const m = schema.match(/^model Albaran \{([\s\S]*?)^\}/m);
  assert.ok(m, '🔴 ESCÁNER CIEGO: no encuentro `model Albaran` en schema.prisma');
  return m[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//') && !l.startsWith('@@'))
    .map((l) => l.match(/^(\w+)\s+\w/))
    .filter(Boolean)
    .map((x) => x[1]);
}

test('SCRUM-302 · SUELO: el modelo se lee y trae campos de verdad', () => {
  // Sin esto, «ningún campo sin clasificar» y «no encontré ningún campo» son el mismo verde.
  const campos = camposDelModelo();
  assert.ok(campos.length >= 15,
    `🔴 ESCÁNER CIEGO: solo he derivado ${campos.length} campos de \`Albaran\`. El parser del ` +
    'schema se ha quedado corto y el guard de abajo pasaría sin mirar casi nada.');
  // Anclas: si estos tres dejan de salir, es que se está leyendo otra cosa.
  for (const esperado of ['lineas', 'signatureUrl', 'evidenciaFirma']) {
    assert.ok(campos.includes(esperado), `🔴 ESCÁNER CIEGO: no veo el campo \`${esperado}\``);
  }
});

test('SCRUM-302 · 🔴 TODO campo de `Albaran` está clasificado, y en UN solo cubo', () => {
  const campos = camposDelModelo();
  const viaja = new Set(Object.keys(CAMPOS_QUE_VIAJAN));
  const noViaja = new Set(Object.keys(CAMPOS_QUE_NO_VIAJAN));

  const sinClasificar = campos.filter((c) => !viaja.has(c) && !noViaja.has(c));
  assert.deepEqual(
    sinClasificar, [],
    '🔴 HAY CAMPOS DE `Albaran` SIN CLASIFICAR:\n    ' + sinClasificar.join('\n    ') + '\n\n' +
    '  Cada campo tiene que caer en UNO de los dos cubos de `albaranDuplicado.ts`:\n' +
    '    · CAMPOS_QUE_VIAJAN     — describe el trabajo (el pro lo tecleaba igual mañana)\n' +
    '    · CAMPOS_QUE_NO_VIAJAN  — es un HECHO que ocurrió sobre el documento anterior\n\n' +
    '  No es burocracia: si el campo nuevo es evidencial y el duplicado se lo lleva, el documento\n' +
    '  nuevo AFIRMA algo que no ha pasado. Y eso no da error en ninguna parte — por eso la\n' +
    '  pregunta se hace aquí, al añadirlo, que es cuando alguien sabe la respuesta.',
  );

  const enLosDos = campos.filter((c) => viaja.has(c) && noViaja.has(c));
  assert.deepEqual(enLosDos, [], '🔴 campos en LOS DOS cubos: la clasificación no decide nada');

  // Y al revés: nada clasificado que ya no exista en el modelo. Un cubo que nombra fantasmas deja
  // de describir el modelo y nadie se entera.
  const fantasmas = [...viaja, ...noViaja].filter((c) => !campos.includes(c));
  assert.deepEqual(fantasmas, [],
    '🔴 la clasificación nombra campos que ya no están en `Albaran`: ' + fantasmas.join(', '));
});

test('SCRUM-302 · cada campo clasificado dice POR QUÉ', () => {
  // Un cubo sin motivos es una lista, y una lista no se puede discutir cuando alguien quiera mover
  // un campo de sitio.
  for (const [cubo, mapa] of [['VIAJAN', CAMPOS_QUE_VIAJAN], ['NO VIAJAN', CAMPOS_QUE_NO_VIAJAN]]) {
    for (const [campo, motivo] of Object.entries(mapa)) {
      assert.ok(typeof motivo === 'string' && motivo.trim().length >= 20,
        `🔴 «${campo}» está en ${cubo} sin un motivo que se pueda leer: ${JSON.stringify(motivo)}`);
    }
  }
});

test('SCRUM-302 · 🔴 EL DUPLICADO NO SE LLEVA LA FIRMA, ni nada que afirme un hecho', () => {
  // El albarán de ayer: firmado, con evidencia, con PDF y ya facturado.
  const ayer = {
    id: 7, merchantId: 1, jobId: 42, numero: 'ALB-2026-0003',
    fecha: new Date('2026-07-20T10:00:00Z'),
    modoValoracion: 'VALORADO',
    lineas: [{ concepto: 'Bajante PVC 110', cantidad: 3, unidad: 'm' }],
    estado: 'firmado', version: 4,
    signatureUrl: 'data:image/png;base64,LAFIRMADELCLIENTE',
    firmadoAt: new Date('2026-07-20T18:30:00Z'),
    firmaToken: 'a1b2c3d4e5f6',
    enviadoParaFirmaAt: new Date('2026-07-20T17:00:00Z'),
    evidenciaFirma: { v: 1, canal: 'remoto', ip: '88.1.2.3', contentHash: 'abc' },
    notas: 'Acceso por el patio',
    pdfUrl: '/pdf/ALB-2026-0003.pdf',
    createdAt: new Date('2026-07-19T08:00:00Z'),
    updatedAt: new Date('2026-07-20T18:30:00Z'),
    invoiceId: 99,
  };

  const copia = datosDuplicado(ayer);

  assert.equal(
    copia.signatureUrl, undefined,
    '🔴 EL DUPLICADO SE LLEVA LA FIRMA DEL CLIENTE.\n\n' +
    '  El cliente NO ha firmado este documento. Copiar su firma a un parte nuevo es falsificar un\n' +
    '  documento — no un fallo de UI: un papel que dice que alguien aceptó algo que no ha visto.',
  );
  assert.equal(copia.evidenciaFirma, undefined,
    '🔴 se lleva la EVIDENCIA de la firma (IP, UA, hash del contenido firmado) del otro documento');
  assert.equal(copia.firmadoAt, undefined, '🔴 se lleva la fecha de firma');
  assert.equal(copia.firmaToken, undefined, '🔴 se lleva el token de la página pública del original');
  assert.equal(copia.invoiceId, undefined, '🔴 nace ya facturado por una factura que no lo consumió');
  assert.equal(copia.pdfUrl, undefined, '🔴 apunta al PDF del original, con su número y su firma dentro');
  assert.equal(copia.numero, undefined, '🔴 se lleva el número de serie del original');

  // Y lo que SÍ tiene que llevarse, que es el motivo de duplicar.
  assert.equal(copia.jobId, 42);
  assert.equal(copia.modoValoracion, 'VALORADO');
  assert.deepEqual(copia.lineas, ayer.lineas, '🔴 no se lleva las líneas: entonces no duplica nada');
  assert.equal(copia.notas, 'Acceso por el patio');

  // Nace en borrador y con fecha de hoy, como fija el ticket.
  assert.equal(copia.estado, 'borrador', '🔴 no nace en borrador');
  const hoy = new Date();
  assert.ok(Math.abs(copia.fecha.getTime() - hoy.getTime()) < 60_000,
    '🔴 el duplicado no nace con la fecha de HOY: se lleva la de la visita del original');
});

test('SCRUM-302 · el duplicado se construye SUMANDO, no copiando y borrando', () => {
  // Restar deja pasar lo que nadie se acordó de restar — que es el fallo entero de este módulo.
  // Se comprueba con un campo que el modelo NO tiene: si se copiara el origen, aparecería.
  const copia = datosDuplicado({ jobId: 1, merchantId: 1, lineas: [], campoInventado: 'no debería estar' });
  assert.equal(
    copia.campoInventado, undefined,
    '🔴 el duplicado arrastra campos que no están clasificados: se está copiando el origen y ' +
    'borrando lo que sobra. Sumar es lo único que no deja pasar lo que nadie miró.',
  );
});
