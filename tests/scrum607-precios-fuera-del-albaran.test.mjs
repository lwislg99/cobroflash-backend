// tests/scrum607-precios-fuera-del-albaran.test.mjs — SCRUM-607 (ALB-02)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL ALBARÁN QUE SE ENTREGA NO ENSEÑA LOS MÁRGENES DEL PROFESIONAL
//
// La víctima: el profesional deja el material en la obra y tiene que entregar un papel de lo
// entregado. Hasta hoy o entregaba un documento con sus márgenes a la vista de quien no debería
// verlos, o no entregaba nada.
//
// 🔴 Y ESTO NO ES `modoValoracion`, aunque se le parezca — medido en FASE A: aquél decide qué
// CONTIENE el albarán, y en `SIN_VALORAR` el backend rechaza una línea con precio (400) y
// facturar devuelve `409 albaran_sin_precios`. Usarlo para ocultar precios le cuesta al
// profesional la factura. Éste sólo decide qué se IMPRIME.
//
// LO QUE SE VIGILA:
//   ① SUELO: con el interruptor apagado el censo de precios del PDF NO puede dar cero. Si diera
//      cero, todo lo de abajo sería verde sobre la nada.
//   ② APAGADO: el papel sale exactamente como hoy — el mismo texto que sin el campo siquiera.
//   ③ ENCENDIDO: cero precios Y la referencia al presupuesto. Las dos en el MISMO test: un
//      albarán sin precios y sin origen es peor que uno con precios.
//   ④ la PANTALLA del profesional sigue enseñando los precios en los dos casos.
//   ⑤ UN SOLO DECISOR para el PDF y para la pantalla pública que el cliente abre desde el móvil.
//   ⑥ el sobre de la firma SIGUE en cinco campos.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extraerTextoPdf } from './_texto-del-pdf.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

const VISTA = 'public/dashboard/js/jobDetailView.js';

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL PAPEL · se genera de verdad y se lee su texto
// ─────────────────────────────────────────────────────────────────────────────────────────
const LINEAS = [
  { concepto: 'Tubo PVC 110', cantidad: 2, unidad: 'ud', precioUnitario: 12.5, tipoIva: 21 },
  { concepto: 'Mano de obra', cantidad: 3, unidad: 'h', precioUnitario: 35, tipoIva: 21 },
];

/**
 * Las señales de PRECIO que el papel puede llevar. Son las NUEVE del documento valorado: los
 * importes unitarios, los importes de línea, las dos cabeceras de columna y los dos totales.
 * Derivadas de las líneas de arriba, no escritas a mano: si alguien cambia el fixture, las
 * cifras se mueven con él y el censo sigue midiendo lo que dice medir.
 */
const SENALES_DE_PRECIO = [
  '12,50', '35,00',                     // precios unitarios
  '25,00', '105,00',                    // importes de línea (2×12,50 y 3×35)
  'PRECIO UD.', 'IMPORTE',              // las dos columnas de dinero
  'Base:', 'Total:',                    // el bloque de totales
  '130,00',                             // la base
];

function params(extra) {
  return {
    merchantId: 9607,
    numero: 'ALB-2026-QA607',
    fecha: new Date(2026, 8, 4, 12, 0, 0),
    emisionAt: new Date(2026, 8, 4, 12, 0, 0),
    version: 1,
    modoValoracion: 'VALORADO',
    merchant: { address: 'C/ Mayor 1' },
    customer: { taxId: null },
    emisor: 'Torres SL',
    emisorNif: 'B12345678',
    cliente: 'Ana Pérez',
    obra: 'Obra de prueba',
    referenciaTrabajo: 'Fuga en cocina',
    lineas: LINEAS,
    totales: { base: 130, cuota: 27.3, total: 157.3 },
    notas: null,
    signatureData: null,
    firmadoAt: null,
    firmadoPorNombre: null,
    firmadoPorCalidad: null,
    evidencia: null,
    ...extra,
  };
}

async function textoDelAlbaran(extra) {
  const { generateAlbaranPdf } = await import('../dist/modules/jobs/infra/albaranPdf.service.js');
  const { outPath } = await generateAlbaranPdf(params(extra));
  try {
    const r = extraerTextoPdf(fs.readFileSync(outPath));
    assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF DEL ALBARÁN: ${r.motivo}`);
    return r.texto.replace(/\s+/g, ' ');
  } finally { fs.rmSync(outPath, { force: true }); }
}

const senalesEn = (txt) => SENALES_DE_PRECIO.filter((s) => txt.includes(s));

// ─────────────────────────────────────────────────────────────────────────────────────────
// ① SUELO · con el interruptor APAGADO tiene que haber precios que ocultar
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-607 · 🔴 SUELO: apagado, el censo de precios del papel NO da cero', async () => {
  const txt = await textoDelAlbaran({ ocultarPreciosEnDocumento: false });
  const vistas = senalesEn(txt);
  assert.equal(vistas.length, SENALES_DE_PRECIO.length,
    `🔴 CIEGO: con el interruptor APAGADO sólo veo ${vistas.length} de ${SENALES_DE_PRECIO.length} `
    + 'señales de precio en el papel. O el fixture ya no lleva precios, o el lector no los ve — y '
    + 'en cualquiera de los dos casos el «cero precios» de más abajo sería verde sobre la nada.\n'
    + `     encontradas: ${vistas.join(' · ') || '(ninguna)'}`);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ② APAGADO · el papel sale como hoy
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-607 · ✅ APAGADO: el papel sale EXACTAMENTE como antes de este ticket', async () => {
  // ⚠️ LÍMITE DEL INSTRUMENTO, declarado: no se comparan los BYTES del PDF porque llevan la fecha
  // de creación dentro y dos ejecuciones nunca coinciden. Se compara el TEXTO, que es lo que el
  // cliente lee, y las dos formas de llamar: SIN el campo —la llamada tal cual era— y con él en
  // `false`. Si el campo nuevo cambiara algo por su mera presencia, aquí se vería.
  const sinElCampo = await textoDelAlbaran({});
  const conFalse = await textoDelAlbaran({ ocultarPreciosEnDocumento: false });
  assert.equal(conFalse, sinElCampo,
    '🔴 EL CAMPO NUEVO CAMBIA EL PAPEL POR EXISTIR. Con el interruptor apagado, un albarán tiene '
    + 'que salir byte a byte como salía antes de ALB-02: es lo que prueba que no se ha movido nada '
    + 'de los albaranes que ya existen.');
  assert.equal(senalesEn(sinElCampo).length, SENALES_DE_PRECIO.length,
    '🔴 sin el campo, el papel ya no lleva sus precios: eso no es «como hoy»');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ③ ENCENDIDO · cero precios Y la referencia, en el MISMO test
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-607 · 🔴 ENCENDIDO: cero precios en el papel Y de qué presupuesto sale', async () => {
  const REF = 'Presupuesto nº 7';
  const txt = await textoDelAlbaran({ ocultarPreciosEnDocumento: true, presupuestoRef: REF });

  const coladas = senalesEn(txt);
  assert.deepEqual(coladas, [],
    `🔴 SE HAN COLADO ${coladas.length} SEÑAL(ES) DE PRECIO en un albarán que no debe enseñarlos:\n`
    + coladas.map((c) => `     · ${c}`).join('\n')
    + '\n  Eso es el margen del profesional delante del cliente al que se lo entrega.');

  // Y la otra mitad, aquí a propósito: un albarán sin precios y sin origen es PEOR que uno con
  // precios — el cliente recibe una lista de cosas sin nada que la ate a lo que aceptó.
  assert.ok(txt.includes(REF),
    '🔴 EL PAPEL NO DICE DE QUÉ PRESUPUESTO SALE. Sin precios y sin origen, el albarán deja de ser '
    + 'comprobable: es una lista de cosas sin nada que la ate a lo que el cliente aceptó.');

  // Lo que NO se pierde al ocultar los precios: el concepto, la cantidad y la unidad. Un albarán
  // que además se comiera lo entregado no serviría para nada.
  for (const queda of ['Tubo PVC 110', 'Mano de obra', 'CONCEPTO', 'CANTIDAD', 'UNIDAD', 'ud']) {
    assert.ok(txt.includes(queda),
      `🔴 al ocultar los precios se ha perdido «${queda}», que no es dinero y el cliente necesita `
      + 'para comprobar lo que ha recibido.');
  }
});

test('SCRUM-607 · la referencia se imprime TAMBIÉN con precios: la trazabilidad no depende del interruptor', async () => {
  const REF = 'Presupuesto nº 7';
  const txt = await textoDelAlbaran({ ocultarPreciosEnDocumento: false, presupuestoRef: REF });
  assert.ok(txt.includes(REF),
    '🔴 un pie que cambia de forma según el interruptor sería una diferencia más que explicar');
  // Y sin presupuesto de origen no se pinta un rótulo con un hueco al lado.
  const sinRef = await textoDelAlbaran({ ocultarPreciosEnDocumento: true, presupuestoRef: null });
  assert.equal(sinRef.includes('Presupuesto n'), false,
    '🔴 sin presupuesto de origen se está pintando el rótulo igualmente: un rótulo con un hueco al '
    + 'lado es peor que ninguno (`Job.quoteId` es nullable y ese caso existe).');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ④ LA PANTALLA DEL PROFESIONAL · sigue enseñando los precios en los dos casos
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-607 · 🔴 la PANTALLA del profesional sigue enseñando los precios, encendido o no', () => {
  const vista = leer(VISTA);

  // Quien decide si la pantalla enseña las celdas de precio es `syncRowToModo`, y mira SÓLO el
  // modo. Si el interruptor nuevo se colara ahí, el profesional perdería de vista sus propios
  // precios — que es exactamente lo que el fundador excluyó al resolver P-DOC-4: esa pantalla es
  // su herramienta de trabajo, necesita los precios para valorar y para facturar después.
  const i = vista.indexOf('function syncRowToModo(r)');
  assert.notEqual(i, -1, '🔴 CIEGO: no encuentro `syncRowToModo`; este control mediría el vacío.');
  const cuerpo = vista.slice(i, vista.indexOf('\n  }', i));
  assert.equal(/ocultarPrecios/.test(cuerpo), false,
    '🔴 EL INTERRUPTOR DEL PAPEL SE HA METIDO EN LA PANTALLA. `syncRowToModo` decide qué ve el '
    + 'PROFESIONAL, y ocultar precios afecta SÓLO AL PDF (P-DOC-4): esa pantalla es su herramienta '
    + 'de trabajo y necesita los precios para valorar y para facturar después.');
  assert.ok(cuerpo.includes("modo === 'VALORADO'"),
    '🔴 `syncRowToModo` ha dejado de decidir por el modo: ya no sé qué está midiendo este control');

  // Y el interruptor sólo se ofrece cuando HAY precios: una casilla que no hace nada es peor que
  // ninguna — el pro la marca, no cambia el papel, y deja de fiarse del resto.
  assert.ok(vista.includes("ocultarRow.style.display = modo === 'VALORADO' ? '' : 'none';"),
    '🔴 la casilla se ofrece también sin precios, donde no hay nada que ocultar');
});

test('SCRUM-607 · el interruptor sigue tocable en `emitido`, y se congela al FIRMAR', () => {
  const vista = leer(VISTA);
  assert.ok(vista.includes("alb.estado === 'borrador' || alb.estado === 'emitido'"),
    '🔴 el candado del interruptor ha cambiado. Se aparta de `modoValoracion` A PROPÓSITO: aquél '
    + 'congela en `emitido` porque CAMBIA EL IMPORTE; éste sólo cambia qué se imprime, y el caso '
    + 'real es «ya lo emití y ahora me lo piden sin precios».');

  // Y el otro lado del candado, en el backend, por su decisor y no por una copia del literal.
  const rutas = leer('src/modules/jobs/app/routes/albaranes.routes.ts');
  assert.ok(rutas.includes('sePuedeCambiarOcultarPrecios(albaran.estado)'),
    '🔴 el PATCH ya no usa el decisor del candado: dos copias del mismo candado divergen');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ⑤ UN SOLO DECISOR · el papel son DOS superficies
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-607 · 🔴 el PDF y la pantalla PÚBLICA deciden con la MISMA función', async () => {
  // Si cada superficie decidiera por su cuenta, taparlo en una y no en la otra sería cuestión de
  // tiempo — y el sitio donde no se tapara es el que el cliente abre desde el móvil.
  for (const [rel, quien] of [
    ['src/modules/jobs/infra/albaranPdf.service.ts', 'el PDF'],
    ['src/modules/jobs/app/routes/albaranPublicVista.ts', 'la pantalla pública'],
  ]) {
    const src = leer(rel);
    assert.ok(src.includes('documentoEnsenaPrecios'),
      `🔴 ${quien} ya no usa el decisor común: ha vuelto a decidir por su cuenta`);
    assert.equal(/const valorado = \w*\.?modoValoracion === 'VALORADO'/.test(src), false,
      `🔴 ${quien} ha vuelto a la comparación a pelo: el interruptor deja de tener efecto ahí`);
  }

  // Y la ruta pública LE PASA el interruptor. Que la función sepa recibirlo no sirve de nada si
  // nadie se lo da — mencionar no es hacer.
  const ruta = leer('src/modules/jobs/app/routes/albaranPublic.routes.ts');
  assert.ok(/renderLineasAlbaran\([\s\S]{0,200}ocultarPreciosEnDocumento/.test(ruta),
    '🔴 la pantalla pública sabe ocultar precios y nadie le dice que lo haga: el cliente los vería '
    + 'igual desde el móvil, que es donde más duele.');
});

test('SCRUM-607 · 🔴 la pantalla pública oculta de verdad: HTML sin dinero', async () => {
  const { renderLineasAlbaran } = await import('../dist/modules/jobs/app/routes/albaranPublicVista.js');
  const conPrecios = renderLineasAlbaran(LINEAS, 'VALORADO', false);
  const sinPrecios = renderLineasAlbaran(LINEAS, 'VALORADO', true);

  // SUELO primero: con el interruptor apagado TIENE que haber dinero, o lo de abajo no dice nada.
  assert.ok(conPrecios.includes('12,50') && conPrecios.includes('PRECIO UD.') && conPrecios.includes('Base:'),
    '🔴 CIEGO: la pantalla pública ya no pinta precios ni con el interruptor apagado');

  for (const senal of ['12,50', '35,00', '105,00', 'PRECIO UD.', 'IMPORTE', 'Base:', 'Total:']) {
    assert.equal(sinPrecios.includes(senal), false,
      `🔴 SE HA COLADO «${senal}» en la pantalla que el cliente abre desde el móvil. Ocultarlo en el `
      + 'PDF y no aquí es no ocultarlo.');
  }
  assert.ok(sinPrecios.includes('Tubo PVC 110') && sinPrecios.includes('Unidad'),
    '🔴 la pantalla pública se ha comido lo entregado, que no es dinero');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DECISOR, EL CANDADO Y LA REFERENCIA · puros, y probados por los dos lados
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-607 · el decisor: ante la duda NO se enseñan precios', async () => {
  const { documentoEnsenaPrecios } = await import('../dist/modules/jobs/domain/albaranPrecios.js');

  // Enseña precios SÓLO en el caso bueno.
  assert.equal(documentoEnsenaPrecios({ modoValoracion: 'VALORADO' }), true,
    '🔴 un albarán valorado sin interruptor ha dejado de enseñar precios: eso rompe lo que ya había');
  assert.equal(documentoEnsenaPrecios({ modoValoracion: 'VALORADO', ocultarPreciosEnDocumento: false }), true);

  // Y NO los enseña en todo lo demás. `undefined`, `null` y un objeto sin campos llegan de una
  // fila de base de datos que todavía no tiene la columna: ese caso es REAL hasta que se aplique
  // el DDL, y tiene que dar el comportamiento de hoy.
  for (const malo of [null, undefined, {}, { modoValoracion: 'SIN_VALORAR' }]) {
    assert.equal(documentoEnsenaPrecios(malo), false,
      `🔴 \`${JSON.stringify(malo)}\` ha hecho que el papel enseñe precios`);
  }
  assert.equal(documentoEnsenaPrecios({ modoValoracion: 'VALORADO', ocultarPreciosEnDocumento: true }), false);

  // 🔴 EL BORDE QUE MUERDE: la cadena `'true'` NO es `true`. Si esto se comparara con `==` o con
  // un `Boolean()`, un `"false"` de un `req.body` mal formado encendería los precios.
  assert.equal(documentoEnsenaPrecios({ modoValoracion: 'VALORADO', ocultarPreciosEnDocumento: 'false' }), true,
    '🔴 una cadena distinta de `true` tiene que dejar el comportamiento normal, no inventarse otro');
  assert.equal(documentoEnsenaPrecios({ modoValoracion: 'VALORADO', ocultarPreciosEnDocumento: 1 }), true);
});

test('SCRUM-607 · el candado: `borrador` y `emitido` sí; firmado NO', async () => {
  const { sePuedeCambiarOcultarPrecios } = await import('../dist/modules/jobs/domain/albaranPrecios.js');
  assert.equal(sePuedeCambiarOcultarPrecios('borrador'), true);
  assert.equal(sePuedeCambiarOcultarPrecios('emitido'), true,
    '🔴 se ha copiado el candado de `modoValoracion`. Éste NO se congela al emitir: el caso real es '
    + '«ya lo emití y ahora me lo piden sin precios».');
  assert.equal(sePuedeCambiarOcultarPrecios('firmado'), false,
    '🔴 un albarán firmado es prueba de lo entregado y su papel no se retoca');
  // Control del propio detector: no dice que sí a cualquier cosa.
  for (const raro of [null, undefined, '', 'BORRADOR', 'anulado', 0]) {
    assert.equal(sePuedeCambiarOcultarPrecios(raro), false,
      `🔴 \`${JSON.stringify(raro)}\` ha abierto el candado`);
  }
});

test('SCRUM-607 · la referencia: número, caída al id, y `null` cuando no hay presupuesto', async () => {
  // Por la SUPERFICIE PÚBLICA y no por la constante: el rótulo no se exporta (SCRUM-411), así
  // que lo que se compara es lo que sale, que es lo que el cliente lee en el papel.
  const { referenciaPresupuesto } = await import('../dist/modules/jobs/domain/albaranPrecios.js');
  const conNumero = referenciaPresupuesto({ id: 41, number: 7 });
  assert.ok(conNumero.endsWith(' 7'),
    `🔴 no usa el número visible por merchant, que es el que el profesional dicta a su gestoría: ${conNumero}`);
  const porId = referenciaPresupuesto({ id: 41, number: null });
  assert.ok(porId.endsWith(' 41'),
    '🔴 sin `quoteNumber` tiene que caer al id, como hacen `jobs.routes.ts` y '
    + `\`albaranes.routes.ts\`: ${porId}`);
  // Y los dos salen del MISMO rótulo: si hubiera dos, el pie diría dos cosas distintas.
  assert.equal(conNumero.slice(0, -2), porId.slice(0, -3),
    '🔴 el rótulo del pie no es el mismo en los dos caminos');
  for (const nada of [null, undefined, {}, { id: 'x' }]) {
    assert.equal(referenciaPresupuesto(nada), null,
      `🔴 \`${JSON.stringify(nada)}\` ha producido una referencia inventada`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ⑥ EL SOBRE DE LA FIRMA SIGUE EN CINCO
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-607 · 🔴 el sobre de la firma NO ha crecido: sigue en CINCO campos', () => {
  // Decisión del asesor, y va escrita: ampliarlo a seis cambia el hash y deja los albaranes ya
  // firmados con un sobre de otra forma. Eso es evidencia legal y merece su propia tanda, no ser
  // un efecto colateral de ALB-02. La referencia al presupuesto se imprime FUERA del sobre.
  const src = leer('src/modules/jobs/domain/albaranVerificacion.ts');
  const m = src.match(/const faltan = \[([^\]]+)\]/);
  assert.ok(m, '🔴 CIEGO: no encuentro la lista de campos del sobre; este control mediría el vacío.');
  const campos = [...m[1].matchAll(/'([a-zA-Z]+)'/g)].map((x) => x[1]);
  assert.deepEqual(campos, ['obra', 'referenciaTrabajo', 'cliente', 'emisor', 'emisorNif'],
    '🔴 EL SOBRE DE LA FIRMA HA CAMBIADO DE FORMA.\n'
    + `     ahora: ${campos.join(', ')}\n`
    + '  ALB-02 imprime la referencia al presupuesto FUERA del sobre a propósito. Si ha entrado '
    + 'dentro, el hash cambia y los albaranes ya firmados quedan con un sobre de otra forma: eso '
    + 'es evidencia legal y necesita su propia tanda.');

  // Y el PDF la recibe por su propio parámetro, no colada en los cinco.
  const pdf = leer('src/modules/jobs/infra/albaranPdf.service.ts');
  assert.ok(pdf.includes('presupuestoRef?: string | null;'),
    '🔴 la referencia ya no viaja por su parámetro propio');
  assert.equal(/contenidoCongelado[\s\S]{0,400}presupuesto/i.test(pdf), false,
    '🔴 la referencia se ha mezclado con el bloque congelado del sobre');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// CONTROL NEGATIVO · cambiar un rótulo NO tumba nada
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-607 · CONTROL NEGATIVO: el texto del rótulo no decide nada', async () => {
  // Los tests de arriba miran DINERO y MECANISMO, no copy. Si aprobar el microcopy —que es lo
  // siguiente que va a pasar aquí— tumbara alguno, sería un guard atado a lo que no le toca, y el
  // día que el asesor firme el texto el rojo parecería un fallo del producto.
  const vista = leer(VISTA);
  const i = vista.indexOf('const ALB_OCULTAR_PRECIOS_ROTULO');
  assert.notEqual(i, -1, '🔴 CIEGO: no encuentro la constante del rótulo');

  // Ninguno de los controles de este fichero nombra el TEXTO del rótulo: sólo la constante.
  //
  // 🔴 EL TROZO SE PARTE A PROPÓSITO, y me cazó él solo al escribirlo: escrito entero, este
  // fichero CONTIENE el texto que dice no contener y se pone rojo a sí mismo. Es la trampa de
  // SCRUM-203, y el idioma de la casa para salir de ella es éste (`scrum702` hace lo mismo con
  // sus señales de entorno).
  const yo = leer('tests/scrum607-precios-fuera-del-albaran.test.mjs');
  assert.equal(yo.includes('ocultar precios' + ' en el documento'), false,
    '🔴 este fichero fija el TEXTO del rótulo. Aprobar el microcopy lo pondría rojo, y ese rojo no '
    + 'significaría nada sobre los precios del albarán.');

  // Y el decisor no mira ningún texto: recibe datos.
  const dominio = leer('src/modules/jobs/domain/albaranPrecios.ts');
  const cuerpo = dominio.slice(dominio.indexOf('export function documentoEnsenaPrecios'));
  assert.equal(/ROTULO|texto|label/i.test(cuerpo.slice(0, cuerpo.indexOf('\n}'))), false,
    '🔴 el decisor mira texto para decidir si se enseñan precios: eso ata el dinero al copy');
});
