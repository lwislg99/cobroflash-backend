// tests/scrum665a-congelar-el-emisor.test.mjs — SCRUM-665 (A)
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA PRUEBA ES EL CONTRASTE, NO LA RESPUESTA
//
// «Con las columnas puestas, el PDF no cambia» no demuestra nada por sí solo: un banco roto que
// devuelve siempre el mismo papel también lo diría. Lo que decide es que **las dos ramas
// respondan DISTINTO** al mismo estímulo:
//
//   ✅ POSITIVO · fila CON las siete columnas → se cambia el perfil → el papel NO cambia.
//   🔴 NEGATIVO · la MISMA fila con las columnas a NULL → el mismo cambio → el papel SÍ cambia.
//
// Si las dos salieran igual, el banco no estaría midiendo el mecanismo sino su propio ruido.
//
// ⚠️ SE COMPARA POR CONTENIDO, NO POR BYTES. Medido en SCRUM-665: dos pasadas del mismo PDF con
// datos idénticos dan ficheros distintos —el formato lleva algo no determinista dentro— y el
// TAMAÑO sí es estable. Una diferencia de bytes aquí no significaría nada.
//
// ⚠️ Y CADA CASO DEJA SU TESTIGO: la lección de SCRUM-864. Un banco cuya cobaya no llega a
// ejecutarse da exactamente el mismo resultado que un arreglo perfecto.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { temporal } from './_temporal.mjs'; // SCRUM-864

const {
  congelarEmisor, emisorDelDocumento, CAMPOS_CONGELADOS_EMISOR,
} = await import('../dist/modules/invoicing/domain/emisorCongelado.js');
const { generateInvoicePdf } = await import('../dist/modules/invoicing/infra/pdf/pdf.service.js');
const { textoDePdf, contiene } = await import('./_pdf-texto.mjs');

const CAJA = temporal('scrum665a-');

const DIRECCION_DE_ENTONCES = 'Calle Mayor 1, 28001 Madrid';
const DIRECCION_DE_HOY = 'Poligono Industrial Sur, nave 7, 28914 Leganes';

/** El perfil del merchant, en dos momentos. Lo único que cambia es la dirección. */
const ficha = (direccion) => ({
  name: 'Fontaneria QA',
  legalName: 'Fontaneria QA S.L.',
  taxId: 'B12345678',
  address: direccion,
  logoUrl: null,
  phone: null,
  email: 'pro@ejemplo.test',
});

/** La factura tal y como la pinta `generateInvoicePdf`, con el emisor que se le pase. */
function paramsFactura(emisor, invoiceId) {
  return {
    number: '2026-CF-0007',
    invoiceId,
    merchantId: 9001,
    merchant: {
      name: emisor.name, legalName: emisor.legalName, taxId: emisor.taxId,
      address: emisor.address, logoUrl: emisor.logoUrl, phone: emisor.phone, email: emisor.email,
    },
    customer: { name: 'Ferreteria Pepe', legalName: 'Ferreteria Pepe SL', taxId: 'B99999999', email: null, phone: null },
    currency: 'EUR',
    total: '480.00',
    qrData: 'INV:2026-CF-0007|AMOUNT:480.00|CUR:EUR',
    vfHash: 'abc123def456',
    createdAt: new Date('2026-06-15T10:00:00Z'),
    lines: [{ description: 'Reparacion de bajante', qty: 1, price: 396.69, tax: 0.21 }],
    type: 'F1',
    rectifiesNumber: null,
    watermark: null,
    stageLabel: null,
    country: 'ES',
  };
}

let nId = 90000;
/** Pinta el papel de `doc` con el perfil `viva` de hoy y devuelve su TEXTO. */
async function papel(doc, viva) {
  const emisor = emisorDelDocumento(doc, viva);
  const { outPath } = await generateInvoicePdf(paramsFactura(emisor, nId += 1));
  const copia = `${CAJA}/f-${nId}.pdf`;
  fs.copyFileSync(outPath, copia);
  const texto = textoDePdf(copia);
  // TESTIGO DE EJECUCIÓN (SCRUM-864): si esto no es legible, todo lo de abajo compara vacíos —
  // y dos vacíos son iguales, así que el positivo saldría verde sin haber medido nada.
  assert.ok(contiene(texto, '2026-CF-0007'),
    '🔴 CIEGO: no sé leer este PDF. Dos textos vacíos coinciden, así que el «no cambia» del '
    + 'positivo sería falso.');
  return { texto, congelado: emisor.congelado };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// SUELO
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-665A · SUELO: el escritor produce las SIETE claves, ni una menos', () => {
  const copia = congelarEmisor(ficha(DIRECCION_DE_ENTONCES));
  const claves = Object.keys(copia).sort();
  assert.deepEqual(claves, [...CAMPOS_CONGELADOS_EMISOR].sort(),
    '🔴 el escritor no produce exactamente los campos declarados. Un campo que falte no rompe '
    + 'nada al emitir: simplemente no viaja, y se descubre cuando el papel viejo cambia.');
  assert.equal(CAMPOS_CONGELADOS_EMISOR.length, 7,
    `🔴 la lista declara ${CAMPOS_CONGELADOS_EMISOR.length} campos y son 7. Si alguien la amplía, `
    + 'el ALTER de la base tiene que ampliarse con ella o el escritor escribirá en el vacío.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL QUE DECIDE · el contraste
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-665A · 🔴 EL CONTRASTE: con las columnas NO cambia; con ellas a NULL SÍ cambia', async () => {
  // La factura se emite HOY, con la dirección de entonces.
  const congelado = congelarEmisor(ficha(DIRECCION_DE_ENTONCES));

  // Y el merchant corrige su dirección después. Es el caso REAL del ticket.
  const hoy = ficha(DIRECCION_DE_HOY);

  // ── ✅ POSITIVO · la fila lleva sus siete columnas ────────────────────────────────────────
  const antes = await papel(congelado, ficha(DIRECCION_DE_ENTONCES));
  const despues = await papel(congelado, hoy);
  assert.equal(antes.congelado, true, '🔴 el lector no está usando la columna: mide otra cosa');
  assert.equal(despues.congelado, true, '🔴 el lector se ha ido a la ficha viva teniendo columna');
  assert.equal(antes.texto, despues.texto,
    '🔴 EL PAPEL DE UNA FACTURA EMITIDA HA CAMBIADO al editar el perfil. Es exactamente el defecto '
    + 'de SCRUM-665 y choca con la regla 29: lo emitido no cambia.');
  assert.ok(contiene(antes.texto, DIRECCION_DE_ENTONCES),
    '🔴 SUELO: el papel congelado no lleva la dirección de entonces, así que «no cambia» podría '
    + 'ser que no llevara ninguna.');

  // ── 🔴 NEGATIVO · la MISMA fila, con las columnas a NULL (una factura vieja) ───────────────
  const vieja = {}; // ni una de las siete: es una factura anterior al escritor
  const antesV = await papel(vieja, ficha(DIRECCION_DE_ENTONCES));
  const despuesV = await papel(vieja, hoy);
  assert.equal(antesV.congelado, false, '🔴 el lector dice «congelado» sobre una fila sin columnas');
  assert.notEqual(antesV.texto, despuesV.texto,
    '🔴 EL NEGATIVO NO CAE: con las columnas a NULL el papel TENDRÍA que cambiar, porque se lee el '
    + 'perfil en vivo. Si no cambia, el banco no está midiendo el mecanismo — las dos ramas '
    + 'responden igual y el positivo de arriba no prueba nada.');
  assert.ok(contiene(despuesV.texto, DIRECCION_DE_HOY),
    '🔴 la rama viva no ha traído la dirección nueva: el estímulo no llegó');
});

test('SCRUM-665A · ✅ ninguna factura VIEJA cambia de aspecto por este cambio', async () => {
  // Una factura anterior al escritor sale EXACTAMENTE como salía antes: por la ficha viva.
  const vieja = {};
  const conLector = await papel(vieja, ficha(DIRECCION_DE_ENTONCES));

  // Y «como antes» no es una opinión: se pinta el mismo papel SIN pasar por el lector, que es
  // literalmente lo que hace `src/lib/invoicing.ts` hoy.
  const f = ficha(DIRECCION_DE_ENTONCES);
  const { outPath } = await generateInvoicePdf(paramsFactura({
    name: f.name, legalName: f.legalName, taxId: f.taxId, address: f.address,
    logoUrl: f.logoUrl, phone: f.phone, email: f.email,
  }, nId += 1));
  const copia = `${CAJA}/hoy.pdf`;
  fs.copyFileSync(outPath, copia);
  const comoHoy = textoDePdf(copia);

  assert.ok(contiene(comoHoy, '2026-CF-0007'), '🔴 CIEGO: no sé leer el papel de control');
  assert.equal(conLector.texto, comoHoy,
    '🔴 una factura sin columnas sale DISTINTA de como sale hoy. El lector tenía que ser '
    + 'transparente para ellas, y no lo es.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL CENTINELA · la mitad del diseño que no se puede «arreglar»
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-665A · 🔴 el centinela es `merchantName`, y NO se mira el NIF', () => {
  // Un merchant real puede no tener NIF puesto todavía. Si el lector preguntara por `taxId`,
  // toda factura suya se leería como «no congelada» y volvería a la ficha viva — el defecto
  // entero, de vuelta, por la puerta de atrás.
  const sinNif = congelarEmisor({ ...ficha(DIRECCION_DE_ENTONCES), taxId: null });
  const leido = emisorDelDocumento(sinNif, ficha(DIRECCION_DE_HOY));
  assert.equal(leido.congelado, true,
    '🔴 una factura CONGELADA sin NIF se está leyendo como no congelada. Es el falso negativo que '
    + '`clienteCongelado` documentó y que aquí volvería a abrir el agujero (SCRUM-215).');
  assert.equal(leido.address, DIRECCION_DE_ENTONCES, '🔴 ha traído la dirección de hoy');
});

test('SCRUM-665A · 🔴 sin columna y sin ficha viva NO se inventa un emisor: falla', () => {
  assert.throws(() => emisorDelDocumento({}, null), /documento_sin_emisor_congelado_ni_ficha_viva/,
    '🔴 se ha pintado un documento fiscal con el emisor en blanco en vez de fallar. Un papel sin '
    + 'emisor es peor que un error: el error lo ve la casa, el papel lo ve el cliente.');
});

test('SCRUM-665A · ⚠️ el escritor NO rellena el nombre con un respaldo', () => {
  // Poner aquí un `?? 'Sin nombre'` convertiría el centinela en basura: una factura vieja y una
  // con el nombre perdido dejarían de distinguirse.
  const copia = congelarEmisor({ ...ficha(DIRECCION_DE_ENTONCES), name: null });
  assert.equal(copia.merchantName, null,
    '🔴 el escritor ha inventado un nombre. Entonces `merchantName != null` deja de significar '
    + '«esta factura pasó por el escritor» y el lector pierde su único criterio.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🗓️ LA CADUCIDAD · la RED, no la nota (mecanismo de P-DOC-8)
//
// Estas siete columnas existen por UNA razon concreta: hoy el PDF de una factura emitida SE
// REGENERA, porque no hay almacenamiento persistente (medido en SCRUM-665, el CoMO). El dia que
// SCRUM-665(B) guarde el papel de verdad —va con la mudanza a Europa, SCRUM-863— el PDF deja de
// regenerarse y **estas columnas pierden su lector**: se quedan ahi, escribiendose en cada
// emision, sin que nadie las lea y sin que nadie avise.
//
// P-DOC-8 enseño que una caducidad necesita DOS cosas: una fecha con su motivo, y un DISPARADOR
// EVALUABLE que pueda adelantarla. Esto es el disparador. No es prosa: es un rojo.
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-665A · 🗓️ LA PREMISA DE LAS SIETE COLUMNAS SIGUE EN PIE: el PDF aun se REGENERA', async () => {
  const ts = (await import('typescript')).default;
  const fuente = fs.readFileSync(new URL('../src/lib/invoicing.ts', import.meta.url), 'utf8');
  const sf = ts.createSourceFile('invoicing.ts', fuente, ts.ScriptTarget.ES2022, true);

  // Se busca la llamada DENTRO de `ensureInvoicePdf`, no en cualquier sitio del fichero: lo que
  // sostiene la premisa es que ESA funcion siga repintando.
  let dentro = null;
  const ver = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.name.text === 'ensureInvoicePdf') dentro = n;
    ts.forEachChild(n, ver);
  };
  ts.forEachChild(sf, ver);

  assert.ok(dentro, '🔴 CIEGO: no encuentro `ensureInvoicePdf` en `src/lib/invoicing.ts`. Sin '
    + 'localizarla, este caso no puede afirmar nada sobre si regenera o no.');

  let regenera = false;
  const ver2 = (n) => {
    if (ts.isCallExpression(n)) {
      const e = n.expression;
      const nom = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : '';
      if (nom === 'generateInvoicePdf') regenera = true;
    }
    ts.forEachChild(n, ver2);
  };
  ts.forEachChild(dentro, ver2);

  assert.equal(regenera, true,
    '🗓️ ESTE ROJO NO ES UN FALLO: ES EL AVISO DE QUE UNA DECISION HA CADUCADO.\n\n'
    + '  `ensureInvoicePdf` ha dejado de llamar a `generateInvoicePdf`, asi que el PDF de una\n'
    + '  factura emitida YA NO SE REGENERA — probablemente porque SCRUM-665(B) guarda el papel\n'
    + '  (SCRUM-863, la mudanza a Europa).\n\n'
    + '  Esa era la UNICA razon de las siete columnas congeladas del emisor\n'
    + '  (`emisorCongelado.ts`, SCRUM-665A). Sin regeneracion no tienen lector: se seguirian\n'
    + '  escribiendo en cada emision y no las leeria nadie.\n\n'
    + '  QUE HACER — se DECIDE y se escribe, no se ensancha este test para que pase:\n'
    + '   (a) retirar el lector y las siete columnas, con su ALTER de baja; o\n'
    + '   (b) conservarlas con motivo NUEVO escrito —por ejemplo reimprimir con fidelidad si se\n'
    + '       pierde el fichero, que es la salida C del ticket— y girar este caso.\n\n'
    + '  FECHA LIMITE si nadie lo toca antes: 16-mar-2027, seis meses desde la firma. No es\n'
    + '  sagrada: es un tope para que la decision no se convierta en olvido. Quien la mueva,\n'
    + '  que escriba por que.');
});
