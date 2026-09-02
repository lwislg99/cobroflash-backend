// tests/scrum655b-revision-con-llamador.test.mjs — SCRUM-655 (T6) · FASE B
//
// «CUÁLES HAY, Y CUÁL ESTÁ VIGENTE» — Y QUÉ PASA SI ESA PREGUNTA TIENE DOS RESPUESTAS.
//
// Los presupuestos reales de Tecnosel se numeran «P2004226.1»: el «.1» es una REVISIÓN. El cliente
// pide un cambio, se rehace el presupuesto y el número base NO cambia — cambia el sufijo. La
// pantalla tiene que poder contestar dos cosas: qué versiones hay, y cuál es la buena HOY.
//
// Sin gate: funciones puras. Ni BD, ni red, ni navegador. Y eso es deliberado — la regla del
// ticket vive en `vistaDeRevisiones`, que es lo que corre el endpoint, y no dentro del endpoint:
// ahí sólo se podría probar con base de datos y quedaría detrás de un gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {
  numeroConRevision, vigenteDe, esVigente,
  vigenteUnicaDe, revisionesDe, vistaDeRevisiones,
  nuevaRevisionDe, REVISION_HEREDA, REVISION_NO_HEREDA, REVISION_LA_PONE_EL_SISTEMA,
} from '../dist/modules/quotes/domain/revision.js';

const RAIZ = path.resolve(import.meta.dirname, '..');
const BASE = 'P2004226';

/** Una fila del grupo tal y como la arma el endpoint (`comoFila` en quoteAdmin.ts). */
const fila = (id, revision, firmado = false) => ({ id, numero: BASE, revision, firmado });

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 0 · SUELO — si las piezas no cargan o no hacen nada, todo lo de abajo pasaría en vacío.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-655b · SUELO: las piezas existen y CONTESTAN', () => {
  for (const [nombre, fn] of [
    ['vigenteUnicaDe', vigenteUnicaDe], ['revisionesDe', revisionesDe],
    ['vistaDeRevisiones', vistaDeRevisiones], ['nuevaRevisionDe', nuevaRevisionDe],
  ]) {
    assert.equal(typeof fn, 'function', `🔴 «${nombre}» no se ha cargado`);
  }
  const v = vistaDeRevisiones(fila(1, 0), [fila(1, 0)]);
  assert.equal(v.vigenteId, 1, '🔴 la vista no contesta sobre el caso más simple que existe');
  assert.equal(v.revisiones.length, 1);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 1 · 🔴 CONTROL POSITIVO, Y VA PRIMERO
//       Un presupuesto SIN revisiones sale EXACTAMENTE como salía: enumerado y sin «.0».
//       Añadir el camino nuevo y romper el viejo da el mismo verde en los tests del nuevo.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-655b · 🔴 CONTROL POSITIVO ① un presupuesto sin revisiones se pinta IGUAL que hoy', () => {
  const solo = fila(7, 0);
  const v = vistaDeRevisiones(solo, [solo]);
  assert.equal(v.numero, BASE,
    `🔴 se ha pintado «${v.numero}». Un documento que pone «.0» le está diciendo al cliente que `
    + 'existe otra versión, y no existe. El caso normal —el 99% de los presupuestos— tiene que salir '
    + 'exactamente como salía antes de este ticket.');
  assert.equal(v.revisiones.length, 1, '🔴 ha aparecido una versión que nadie creó');
  assert.equal(v.revisiones[0].esVigente, true, '🔴 el único documento que hay no está vigente');
  assert.equal(v.vigenteId, 7);
});

test('SCRUM-655b · 🔴 CONTROL POSITIVO ② y la revisión SÍ se pinta, con su punto', () => {
  // El contraste del control de arriba: si `numeroConRevision` devolviera siempre el número pelado,
  // el ① pasaría igual de verde y no estaría midiendo nada.
  assert.equal(numeroConRevision({ numero: BASE, revision: 1 }), 'P2004226.1');
  assert.equal(numeroConRevision({ numero: BASE, revision: 2 }), 'P2004226.2');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 2 · 🔴 DOS VIGENTES A LA VEZ NO ES UNA RESPUESTA
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-655b · 🔴 dos revisiones empatadas PARAN, y el rojo las NOMBRA', () => {
  const grupo = [fila(1, 0), fila(2, 1), fila(3, 1)];   // dos «.1»

  assert.throws(
    () => vigenteUnicaDe(grupo),
    (e) => {
      assert.equal(e.name, 'RevisionesAmbiguas',
        '🔴 con DOS revisiones «.1» el mecanismo ha contestado una en vez de parar. «Cuál está '
        + 'vigente» con dos respuestas no es una respuesta: la pantalla enseñaría una versión y el '
        + 'PDF podría enseñar la otra, y nadie vería nunca que hay dos.');
      assert.match(e.message, /P2004226\.1/,
        '🔴 el rojo NO NOMBRA a las empatadas. Un guard que dice «hay un empate» sin decir entre '
        + 'quiénes obliga a buscarlas a mano en la base, y eso es lo que hace que no se mire.');
      assert.match(e.message, /revisión 1/);
      return true;
    },
  );

  // 🔴 Y CAE CON EL MECANISMO VIEJO. Esto es lo que prueba que la pieza nueva hacía falta: la
  // anterior NO falla — recorre y se queda con la primera que vio, así que devuelve una respuesta
  // con toda la pinta de ser buena. Si `vigenteDe` ya hubiera parado, el test de arriba estaría
  // aprobando código que ya existía.
  const loQueContestabaAntes = vigenteDe(grupo);
  assert.equal(loQueContestabaAntes.id, 2,
    '🔴 `vigenteDe` ya no resuelve el empate en silencio. Si ahora falla, el rojo de arriba no '
    + 'prueba que `vigenteUnicaDe` añadiera nada: comprueba cuál de las dos cambió.');
  // Y esto es PEOR de lo que parecía, y salió midiendo: `esVigente` compara {numero, revisión},
  // así que con un empate las DOS contestan `true`. No es que una desaparezca de la pantalla: es
  // que las dos se pintan como «la vigente» a la vez, y ahí no hay nada que mirar para saber cuál
  // vale. `vistaDeRevisiones` no puede llegar a eso porque `vigenteUnicaDe` para antes — y ése es
  // justo el orden que hay que conservar.
  assert.equal(esVigente(fila(2, 1), grupo), true);
  assert.equal(esVigente(fila(3, 1), grupo), true,
    '🔴 el mecanismo viejo ya distingue entre dos empatadas. Si esto es `false` ahora, comprueba '
    + 'qué cambió: el rojo de arriba dejaría de estar probando que `vigenteUnicaDe` añadía algo.');
});

test('SCRUM-655b · 🔴 el empate revienta la VISTA entera, no sólo la pieza', () => {
  // Lo que corre el endpoint es `vistaDeRevisiones`. Si el empate sólo parase en la pieza suelta,
  // la pantalla seguiría contestando.
  assert.throws(() => vistaDeRevisiones(fila(2, 1), [fila(1, 0), fila(2, 1), fila(3, 1)]),
    (e) => e.name === 'RevisionesAmbiguas',
    '🔴 la vista que sirve `GET /admin/quotes/:id` contesta con dos vigentes en el grupo.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 3 · 🔴 EL SUELO DE CEGUERA
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-655b · 🔴 un censo de revisiones que no se ve NI A SÍ MISMO se declara ciego', () => {
  const propia = fila(9, 0);

  // ⚠️ El segundo caso lleva OTRO número base a propósito: `revisionesDe` identifica por
  // {numero, revisión}, no por `id`. Escrito con el mismo número, «otro documento» era el MISMO
  // y el suelo no saltaba — lo dijo el rojo, no yo.
  const deOtroDocumento = { id: 4, numero: 'P9999999', revision: 0, firmado: false };
  for (const [caso, grupo] of [['vacío', []], ['de otro documento', [deOtroDocumento]]]) {
    assert.throws(
      () => revisionesDe(propia, grupo),
      (e) => {
        assert.equal(e.name, 'CensoDeRevisionesCiego',
          `🔴 el censo ${caso} ha pasado por bueno. Todo presupuesto es al menos SU PROPIA `
          + 'revisión, así que un listado que no lo contiene no significa «no tiene otras versiones»: '
          + 'significa que no se ha leído nada — agrupado por un `quoteNumber` nulo, por otro '
          + 'merchant, o sin leer. Y con ese cero la pantalla diría «no hay otras versiones» de un '
          + 'documento que sí las tiene.');
        return true;
      },
    );
  }
  // Y el contraste: viéndose a sí misma, contesta.
  assert.equal(revisionesDe(propia, [propia]).length, 1);
});

test('SCRUM-655b · 🔴 y el grupo llega ORDENADO, de la vieja a la nueva', () => {
  const orden = revisionesDe(fila(2, 1), [fila(3, 2), fila(1, 0), fila(2, 1)]).map((q) => q.revision);
  assert.deepEqual(orden, [0, 1, 2],
    `🔴 el grupo sale ${JSON.stringify(orden)}. La pantalla lista versiones de un documento: `
    + 'desordenadas, quien las lee no puede saber cuál vino después de cuál.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 4 · 🔴 UN PRESUPUESTO FIRMADO NO SE REESCRIBE
// ═════════════════════════════════════════════════════════════════════════════════════════

/** La versión firmada del caso real: el cliente vio ESTO y puso su trazo encima. */
const FIRMADA = Object.freeze({
  id: 41, merchantId: 7, quoteNumber: 2004226, revision: 0,
  customerId: 3, currency: 'EUR', total: '1250.00',
  lines: [{ concept: 'Cuadro general', qty: 1, price: 1250 }],
  status: 'accepted',
  signatureUrl: 'data:image/png;base64,TRAZO-DEL-CLIENTE',
  acceptedAt: '2026-08-30T10:00:00.000Z',
  evidence: { ip: '10.0.0.1', canal: 'whatsapp' },
  decisionChannel: 'whatsapp', decisionComment: 'Adelante',
  chargeId: 88, decisionToken: 'tok-publico', pdfUrl: '/pdf/41.pdf',
  paymentTerms: '50/50', teamMemberId: 11,
});

/** Huella del contenido: si cambia una sola línea, cambia. */
const huella = (o) => JSON.stringify(o, Object.keys(o).sort());

test('SCRUM-655b · 🔴 CONTROL NEGATIVO: crear la revisión NO altera la anterior. Ni una línea', () => {
  const antes = huella(FIRMADA);
  const nueva = nuevaRevisionDe(FIRMADA, 1);

  assert.equal(huella(FIRMADA), antes,
    '🔴 CREAR LA REVISIÓN HA TOCADO LA VERSIÓN ANTERIOR.'
    + '  Y la anterior está FIRMADA: la firma cubre lo que el cliente VIO. Reescribirla deja un '
    + 'trazo de tinta encima de un documento que ya no es el que se firmó, y el día que ese cliente '
    + 'diga «yo no pedí esto» no hay dónde mirarlo.');

  assert.equal('id' in nueva, false,
    '🔴 la revisión nueva trae un `id`. Con `id` hay a quién sobrescribir, y entonces «crear una '
    + 'revisión» y «editar la firmada» son la misma llamada con un parámetro distinto.');
  assert.notEqual(nueva.lines, undefined, '🔴 la revisión nace sin el contenido que hay que cambiar');
});

test('SCRUM-655b · 🔴 la revisión NO hereda la firma, ni la decisión, ni el cobro', () => {
  const nueva = nuevaRevisionDe(FIRMADA, 1);
  for (const [campo, motivo] of Object.entries(REVISION_NO_HEREDA)) {
    assert.equal(campo in nueva, false,
      `🔴 la revisión ha heredado «${campo}», y no puede: ${motivo}.`
      + '  Heredar cualquiera de estos es la forma silenciosa de reescribir lo firmado: la versión '
      + 'nueva nace pareciendo aceptada, o firmada, o cobrada, sin que nadie la haya visto.');
  }
  assert.equal(nueva.status, 'draft',
    `🔴 la revisión nace en «${nueva.status}». Nadie la ha visto todavía.`);
});

test('SCRUM-655b · 🔴 EL NÚMERO BASE NO CAMBIA — eso es lo que la hace una revisión', () => {
  const nueva = nuevaRevisionDe(FIRMADA, 1);
  assert.equal(nueva.quoteNumber, FIRMADA.quoteNumber,
    '🔴 la revisión ha cambiado de número base. Entonces no es «P2004226.1»: es otro presupuesto, '
    + 'y el cliente recibe un documento con un número que nunca había visto.');
  assert.equal(nueva.revision, 1);
  assert.equal(numeroConRevision({ numero: BASE, revision: nueva.revision }), 'P2004226.1');
});

test('SCRUM-655b · 🔴 y el contenido SÍ viaja: revisar es partir de lo anterior', () => {
  // El contraste del test de arriba: si `nuevaRevisionDe` devolviera un objeto casi vacío, «no
  // hereda la firma» pasaría igual de verde y la revisión nacería en blanco.
  const nueva = nuevaRevisionDe(FIRMADA, 1);
  assert.deepEqual(nueva.lines, FIRMADA.lines, '🔴 la revisión nace SIN las líneas del original');
  assert.equal(nueva.total, FIRMADA.total);
  assert.equal(nueva.customerId, FIRMADA.customerId);
  assert.equal(nueva.paymentTerms, FIRMADA.paymentTerms);
});

test('SCRUM-655b · 🔴 no se puede crear una revisión que EMPATE con la que se revisa', () => {
  // Es el mismo empate del § 2, cerrado por el otro lado: revisar la `.1` cuando ya existe una
  // `.2` crearía una segunda `.2` si el número saliera de «la que miro + 1».
  for (const n of [0, 1, -1]) {
    assert.throws(() => nuevaRevisionDe({ ...FIRMADA, revision: 1 }, n),
      (e) => e.name === 'RevisionesAmbiguas',
      `🔴 se ha aceptado crear la revisión ${n} partiendo de la 1: eso mete dos filas con la misma `
      + 'revisión en el grupo, y «cuál está vigente» deja de tener respuesta.');
  }
  assert.equal(nuevaRevisionDe({ ...FIRMADA, revision: 1 }, 2).revision, 2);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 5 · 🔴 EL REPARTO DE CAMPOS ES CERRADO, Y SE CONTRASTA CON EL ESQUEMA
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Los campos ESCALARES de `model Quote`, leídos del esquema. Las relaciones no son datos. */
function camposEscalaresDeQuote() {
  const txt = fs.readFileSync(path.join(RAIZ, 'prisma/schema.prisma'), 'utf8');
  const m = /^model Quote \{$([\s\S]*?)^\}$/m.exec(txt);
  assert.ok(m, '🔴 no se encuentra `model Quote` en el esquema: el contraste mediría el vacío.');
  const ESCALARES = /^(Int|String|Boolean|DateTime|Decimal|Json|Float|BigInt|Bytes)\??$/;
  const campos = [];
  for (const linea of m[1].split(/\r?\n/)) {
    const l = linea.replace(/\/\/.*$/, '').trim();
    if (!l || l.startsWith('@@')) continue;
    const [nombre, tipo] = l.split(/\s+/);
    if (tipo && ESCALARES.test(tipo)) campos.push(nombre);
  }
  return campos;
}

test('SCRUM-655b · SUELO: el lector del esquema VE los campos de Quote', () => {
  const campos = camposEscalaresDeQuote();
  assert.ok(campos.length >= 30,
    `🔴 sólo se han leído ${campos.length} campos de \`Quote\`. Con una lista corta, «todos `
    + 'clasificados» sería verdad sin significar nada.');
  for (const imprescindible of ['lines', 'signatureUrl', 'revision', 'quoteNumber']) {
    assert.ok(campos.includes(imprescindible),
      `🔴 el lector no ve «${imprescindible}», que está en el esquema: mide otra cosa.`);
  }
});

test('SCRUM-655b · 🔴 TODO campo de Quote está clasificado: una columna nueva NO se pierde en silencio', () => {
  const clasificados = new Set([
    ...REVISION_HEREDA,
    ...Object.keys(REVISION_NO_HEREDA),
    ...Object.keys(REVISION_LA_PONE_EL_SISTEMA),
  ]);
  const sinClasificar = camposEscalaresDeQuote().filter((c) => !clasificados.has(c));

  assert.deepEqual(sinClasificar, [],
    `🔴 HAY ${sinClasificar.length} CAMPO(S) DE \`Quote\` QUE NADIE HA CLASIFICADO: `
    + `${sinClasificar.join(', ')}.`
    + '  Al crear una revisión, un campo sin clasificar simplemente NO VIAJA — y eso no falla: la '
    + 'revisión nace sin ese dato y nadie se entera hasta que el cliente lo echa de menos en el '
    + 'documento. Decide si la revisión lo HEREDA (es contenido), si NO lo hereda (es de la versión '
    + 'anterior: su firma, su decisión, su cobro) o si LO PONE EL SISTEMA, y dilo en '
    + '`revision.ts`. Lo que no vale es que se caiga sin que nadie lo mire.');
});

test('SCRUM-655b · 🔴 y ningún campo está en DOS sitios a la vez', () => {
  const listas = [
    ['REVISION_HEREDA', [...REVISION_HEREDA]],
    ['REVISION_NO_HEREDA', Object.keys(REVISION_NO_HEREDA)],
    ['REVISION_LA_PONE_EL_SISTEMA', Object.keys(REVISION_LA_PONE_EL_SISTEMA)],
  ];
  const visto = new Map();
  for (const [nombre, campos] of listas) {
    for (const c of campos) {
      assert.equal(visto.has(c), false,
        `🔴 «${c}» está en ${visto.get(c)} y en ${nombre}. Un campo con dos reglas tiene la que `
        + 'gane el orden de las líneas, y eso deja de ser una decisión para ser una casualidad.');
      visto.set(c, nombre);
    }
  }
  // Y cada motivo dice algo: una tabla de motivos vacíos no es una decisión documentada.
  for (const [campo, motivo] of [...Object.entries(REVISION_NO_HEREDA), ...Object.entries(REVISION_LA_PONE_EL_SISTEMA)]) {
    assert.ok(typeof motivo === 'string' && motivo.length > 20,
      `🔴 «${campo}» está clasificado sin motivo legible. El motivo es lo que revisa el humano.`);
  }
});
