// tests/scrum987-valido-hasta-en-el-pdf.test.mjs — SCRUM-987
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// «VÁLIDO HASTA EL {FECHA LARGA}» EN EL PDF DEL PRESUPUESTO — Y LA MISMA FRASE QUE LEE EL CLIENTE
//
// El papel que el profesional manda por correo o WhatsApp no decía hasta cuándo vale el precio: la
// validez sólo se enseñaba en la landing donde el cliente decide. Medido el 21-sep-2026 con el
// generador real: un PDF con `validUntil` en los parámetros salía sin rastro de la validez.
//
// ── LO QUE ESTE FICHERO SOSTIENE ────────────────────────────────────────────────────────────────
//
//   ① la FRASE, escrita a mano aquí: «Válido hasta el 15 de octubre de 2026». Si el test importara
//      la constante del dominio para compararla consigo misma, un rótulo cambiado seguiría verde.
//   ② la FECHA sale en la zona del NEGOCIO (SCRUM-633) y con el respaldo `creación + 30 d` de los
//      presupuestos anteriores a A16.2 — que es lo que ya hacía la landing.
//   ③ un presupuesto YA FIRMADO sale SIN la línea (regla conservadora: su papel no cambia de aspecto
//      porque `GET /admin/quotes/:id/pdf` regenere y sobrescriba el `pdfUrl`). Las TRES marcas de la
//      firma, cada una por separado.
//   ④ el PDF y la landing dicen LO MISMO sobre el mismo presupuesto: se ejecutan los dos.
//   ⑤ las cuatro puertas del PDF delegan en el constructor, y la frase vive en UN sitio.
//
// Población declarada: cada test dice sobre cuántos casos mide. Un cero de «no aparece» sólo cuenta
// con su positivo al lado (el mismo presupuesto SIN firmar sí la lleva).
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { extraerTextoPdf } from './_texto-del-pdf.mjs';
import { soloCodigo } from './_solo-codigo.mjs';
import { clavesDelConstructor, puertasSinLosCampos } from './_puertas-del-presupuesto.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

const { textoDeValidez } = await import('../dist/modules/quotes/domain/validez.js');
const { paramsDePresupuestoParaPdf } = await import('../dist/modules/quotes/domain/presupuestoParaPdf.js');
const { generateQuotePdf } = await import('../dist/modules/invoicing/infra/pdf/pdf.service.js');
const { renderQuoteDetail } = await import('../dist/modules/system/app/routes/quoteDecisionLanding.routes.js');

const MADRID = { timezone: 'Europe/Madrid' };
/** 14-oct 23:30 UTC = 15-oct 01:30 en Madrid: el instante donde la zona cambia el DÍA. */
const CRUCE_DE_MEDIANOCHE = '2026-10-14T23:30:00Z';

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① y ② · LA FRASE Y LA FECHA
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-987 · SUELO: la función DISTINGUE (dos fechas dan dos frases; la zona cambia el día)', () => {
  const a = textoDeValidez({ validUntil: '2026-10-15T10:00:00Z', merchant: MADRID });
  const b = textoDeValidez({ validUntil: '2026-10-16T10:00:00Z', merchant: MADRID });
  assert.ok(a && b, '🔴 SUELO: la función no devuelve nada ni para una fecha buena');
  assert.notEqual(a, b, '🔴 SUELO: dos fechas distintas dan la MISMA frase: todo lo de abajo mediría una función muda');
  const enMadrid = textoDeValidez({ validUntil: CRUCE_DE_MEDIANOCHE, merchant: MADRID });
  const enUtc = textoDeValidez({ validUntil: CRUCE_DE_MEDIANOCHE, merchant: null });
  assert.notEqual(enMadrid, enUtc, '🔴 SUELO: la zona del merchant no cambia el día ni en el instante que lo cambia');
});

test('SCRUM-987 · 🔴 LA FRASE FIRMADA, escrita a mano: «Válido hasta el 15 de octubre de 2026»', () => {
  assert.equal(
    textoDeValidez({ validUntil: '2026-10-15T10:00:00Z', merchant: MADRID }),
    'Válido hasta el 15 de octubre de 2026',
    '🔴 la frase no es la firmada (SCRUM-915 comentario 16165): sin emoji, «Válido hasta el» + fecha larga');
  // Con un Date y con una cadena: la columna llega de Prisma como Date y del JSON como cadena.
  assert.equal(
    textoDeValidez({ validUntil: new Date('2026-10-15T10:00:00Z'), merchant: MADRID }),
    'Válido hasta el 15 de octubre de 2026', '🔴 un `Date` no da la misma frase que su cadena ISO');
  // El día va con DOS cifras, como lo pintaba la landing (`day: '2-digit'`).
  assert.equal(
    textoDeValidez({ validUntil: '2026-11-05T10:00:00Z', merchant: MADRID }),
    'Válido hasta el 05 de noviembre de 2026', '🔴 el día ya no sale con dos cifras: la landing lo pintaba así');
  assert.equal(/[\u{1F300}-\u{1FAFF}☀-➿⏳]/u.test(textoDeValidez({ validUntil: '2026-10-15T10:00:00Z', merchant: MADRID })), false,
    '🔴 la frase lleva emoji: el ⏳ es de la página, y las fuentes estándar del PDF no lo dibujan');
});

test('SCRUM-987 · 🔴 la fecha sale en la zona del NEGOCIO, no en la de la máquina (SCRUM-633)', () => {
  assert.equal(textoDeValidez({ validUntil: CRUCE_DE_MEDIANOCHE, merchant: MADRID }),
    'Válido hasta el 15 de octubre de 2026', '🔴 en Madrid ya es 15: la fecha salió en UTC');
  assert.equal(textoDeValidez({ validUntil: CRUCE_DE_MEDIANOCHE, merchant: { timezone: null } }),
    'Válido hasta el 14 de octubre de 2026', '🔴 sin zona declarada la regla es UTC (SCRUM-643)');
  assert.equal(textoDeValidez({ validUntil: CRUCE_DE_MEDIANOCHE, merchant: { timezone: 'No/Existe' } }),
    'Válido hasta el 14 de octubre de 2026', '🔴 una zona corrupta tiene que caer a UTC, no tumbar el documento');
});

test('SCRUM-987 · el respaldo `creación + 30 d` de los presupuestos sin `validUntil`, y gana la columna', () => {
  assert.equal(textoDeValidez({ validUntil: null, createdAt: '2026-09-16T10:00:00Z', merchant: MADRID }),
    'Válido hasta el 16 de octubre de 2026', '🔴 el respaldo ya no es creación + 30 días');
  assert.equal(textoDeValidez({ createdAt: new Date('2026-09-16T10:00:00Z'), merchant: MADRID }),
    'Válido hasta el 16 de octubre de 2026', '🔴 `validUntil` ausente (no sólo null) no cae al respaldo');
  assert.equal(textoDeValidez({ validUntil: '2026-10-15T10:00:00Z', createdAt: '2026-09-16T10:00:00Z', merchant: MADRID }),
    'Válido hasta el 15 de octubre de 2026', '🔴 el respaldo PISA a la columna: si hay `validUntil`, manda él');
});

test('SCRUM-987 · sin fecha que decir, se calla: nunca «Invalid Date» en un papel del cliente', () => {
  for (const [caso, fuente] of [
    ['ni columna ni creación', { merchant: MADRID }],
    ['columna nula y sin creación', { validUntil: null, createdAt: null }],
    ['un dato que no es fecha', { validUntil: 'no-es-una-fecha', merchant: MADRID }],
    ['creación corrupta', { validUntil: null, createdAt: 'ayer' }],
  ]) {
    assert.equal(textoDeValidez(fuente), null, `🔴 ${caso}: tenía que ser null y dio ${JSON.stringify(textoDeValidez(fuente))}`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ · EL CONSTRUCTOR: UN FIRMADO SALE SIN LA LÍNEA
// ═════════════════════════════════════════════════════════════════════════════════════════

const FILA = {
  id: 9871, quoteNumber: 4, currency: 'EUR', total: { toString: () => '121.00' },
  lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 }],
  createdAt: new Date('2026-09-16T10:00:00Z'),
  validUntil: new Date('2026-10-15T10:00:00Z'),
};
const MERCH = { id: 1, name: 'Taller', country: 'ES', timezone: 'Europe/Madrid' };
const CLI = { name: 'Cliente' };
const params = (quote, merchant = MERCH) => paramsDePresupuestoParaPdf({ quote, merchant, customer: CLI });

test('SCRUM-987 · el constructor compone la frase para un presupuesto SIN firmar (el positivo)', () => {
  assert.equal(params(FILA).validez, 'Válido hasta el 15 de octubre de 2026',
    '🔴 SUELO del bloque de firmados: un borrador tiene que llevar la línea, o «no la lleva» no significaría nada');
});

test('SCRUM-987 · 🔴 REGLA CONSERVADORA: cada una de las TRES marcas de la firma quita la línea', () => {
  const marcas = {
    'acceptedAt (cuándo aceptó)': { acceptedAt: new Date('2026-09-20T10:00:00Z') },
    'signatureUrl (el trazo)': { signatureUrl: 'data:image/png;base64,xx' },
    'evidenciaFirma (el sobre sellado, SCRUM-805)': { evidenciaFirma: { contentHash: 'h', firmadoAt: '2026-09-20T10:00:00Z' } },
  };
  for (const [nombre, marca] of Object.entries(marcas)) {
    assert.equal(params({ ...FILA, ...marca }).validez, null,
      `🔴 un presupuesto con ${nombre} sigue llevando «Válido hasta»: su papel cambiaría de aspecto al regenerarse`);
  }
  // Y las marcas VACÍAS no cuentan como firma (un borrador con las columnas a null lleva la línea).
  assert.equal(params({ ...FILA, acceptedAt: null, signatureUrl: null, evidenciaFirma: null }).validez,
    'Válido hasta el 15 de octubre de 2026', '🔴 un `null` en las marcas se leyó como «firmado»');
});

test('SCRUM-987 · el constructor le pasa al dominio la zona DEL MERCHANT y el respaldo de creación', () => {
  assert.equal(params({ ...FILA, validUntil: new Date(CRUCE_DE_MEDIANOCHE) }).validez, 'Válido hasta el 15 de octubre de 2026',
    '🔴 el constructor no pasa la zona del merchant: el papel diría el 14');
  assert.equal(params({ ...FILA, validUntil: new Date(CRUCE_DE_MEDIANOCHE) }, { ...MERCH, timezone: null }).validez,
    'Válido hasta el 14 de octubre de 2026', '🔴 el control: sin zona el mismo instante tiene que dar el 14');
  assert.equal(params({ ...FILA, validUntil: null }).validez, 'Válido hasta el 16 de octubre de 2026',
    '🔴 el constructor no pasa `createdAt`: un presupuesto sin `validUntil` saldría sin línea');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL PAPEL · se ejecuta el generador real y se LEE lo que imprime
// ═════════════════════════════════════════════════════════════════════════════════════════

async function textoDelPapel(p, quoteId) {
  const { outPath } = await generateQuotePdf({ ...p, quoteId });
  const r = extraerTextoPdf(fs.readFileSync(outPath));
  assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}. Un texto vacío pasaría por «no dice nada».`);
  assert.ok(r.texto.includes('121,00'), '🔴 SUELO: el documento ni siquiera trae su total');
  return r.texto;
}

test('SCRUM-987 · 🔴 EL PAPEL lleva «Válido hasta el …» debajo del número y antes del emisor', async () => {
  const texto = await textoDelPapel(params(FILA), 9871);
  const i = texto.indexOf('Válido hasta el 15 de octubre de 2026');
  assert.notEqual(i, -1, '🔴 el PDF de un presupuesto sin firmar NO lleva la línea de validez');
  const iNumero = texto.indexOf('#4');
  const iEmisor = texto.indexOf('Emisor:');
  assert.ok(iNumero !== -1 && iEmisor !== -1, '🔴 SUELO: no encuentro el número ni el emisor para medir el sitio');
  assert.ok(iNumero < i && i < iEmisor,
    '🔴 la línea no está en su sitio: tiene que ir en la cabecera, DESPUÉS del número y ANTES del emisor');
  assert.equal(texto.split('Válido hasta').length - 1, 1, '🔴 la línea sale más de una vez');
});

test('SCRUM-987 · 🔴 un presupuesto SIN la línea sale exactamente como salía (el generador la pinta sólo si llega)', async () => {
  const sin = await textoDelPapel({ ...params(FILA), validez: null }, 9872);
  assert.equal(sin.includes('Válido hasta'), false, '🔴 con `validez: null` el PDF sigue diciendo «Válido hasta»');
  const ausente = { ...params(FILA) }; delete ausente.validez;
  assert.equal((await textoDelPapel(ausente, 9873)), sin,
    '🔴 la clave AUSENTE y la clave a null dan papeles distintos: un llamador antiguo del generador cambiaría');
});

test('SCRUM-987 · 🔴 un presupuesto FIRMADO sale con el MISMO texto que sin la línea, y su positivo sí la lleva', async () => {
  const firmado = { ...FILA, acceptedAt: new Date('2026-09-20T10:00:00Z'), signatureUrl: null };
  const delFirmado = await textoDelPapel(params(firmado), 9874);
  assert.equal(delFirmado.includes('Válido hasta'), false, '🔴 el papel de un FIRMADO lleva «Válido hasta»');
  // La misma fila sin la línea forzada: si el constructor no la quitara, estos dos textos diferirían.
  const igualSinLaLinea = await textoDelPapel({ ...params(firmado), validez: null }, 9875);
  assert.equal(delFirmado, igualSinLaLinea, '🔴 el papel del firmado no es el de siempre: algo más ha cambiado');
  // El control positivo: la MISMA fila sin las marcas de firma sí la lleva, y su texto ES distinto.
  const delBorrador = await textoDelPapel(params({ ...firmado, acceptedAt: null }), 9876);
  assert.ok(delBorrador.includes('Válido hasta el 15 de octubre de 2026'), '🔴 SUELO: el borrador equivalente no lleva la línea');
  assert.notEqual(delBorrador, delFirmado, '🔴 SUELO: la comparación no distingue un papel con la línea de uno sin ella');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ · EL PDF Y LA LANDING DICEN LO MISMO: se ejecutan los dos sobre el mismo presupuesto
// ═════════════════════════════════════════════════════════════════════════════════════════

/** El presupuesto tal como llega a la landing (`include: { merchant, customer }`). */
const paraLaLanding = ({ validUntil, createdAt, timezone }) => ({
  id: 9879, quoteNumber: 4, currency: 'EUR', total: 121, status: 'sent',
  createdAt: new Date(createdAt), validUntil: validUntil ? new Date(validUntil) : null,
  paymentTerms: null, customBillingPlan: null, discountGlobalAmount: null,
  merchant: { id: 1, name: 'Taller', legalName: null, logoUrl: null, address: null, country: 'ES', timezone },
  customer: { name: 'Cliente' },
  lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 }],
});

/** La frase que lee el cliente en la página: lo que hay dentro del badge, sin el ⏳. */
const fraseDeLaPagina = (html) => {
  const m = html.match(/<div class="validity-badge">⏳ ([^<]+)<\/div>/);
  return m ? m[1] : null;
};

test('SCRUM-987 · 🔴 el PDF y la landing dicen LA MISMA frase (con columna, con respaldo y cruzando la medianoche)', async () => {
  const casos = [
    ['columna explícita, Madrid', { validUntil: '2026-10-15T10:00:00Z', createdAt: '2026-09-16T10:00:00Z', timezone: 'Europe/Madrid' }, 'Válido hasta el 15 de octubre de 2026'],
    ['respaldo creación + 30 d', { validUntil: null, createdAt: '2026-09-16T10:00:00Z', timezone: 'Europe/Madrid' }, 'Válido hasta el 16 de octubre de 2026'],
    ['cruce de medianoche, Madrid', { validUntil: CRUCE_DE_MEDIANOCHE, createdAt: '2026-09-16T10:00:00Z', timezone: 'Europe/Madrid' }, 'Válido hasta el 15 de octubre de 2026'],
    ['el mismo instante, sin zona declarada', { validUntil: CRUCE_DE_MEDIANOCHE, createdAt: '2026-09-16T10:00:00Z', timezone: null }, 'Válido hasta el 14 de octubre de 2026'],
  ];
  let i = 0;
  for (const [nombre, datos, esperada] of casos) {
    const q = paraLaLanding(datos);
    const enLaPagina = fraseDeLaPagina(renderQuoteDetail(q, 'tok'));
    assert.equal(enLaPagina, esperada, `🔴 ${nombre}: la LANDING no dice «${esperada}» (dice ${JSON.stringify(enLaPagina)})`);
    const enElPapel = await textoDelPapel(paramsDePresupuestoParaPdf({ quote: q, merchant: q.merchant, customer: q.customer }), 9880 + i++);
    assert.ok(enElPapel.includes(esperada), `🔴 ${nombre}: el PDF no dice «${esperada}» y la página sí`);
  }
  assert.equal(i, 4, '🔴 SUELO: no se recorrieron los cuatro casos');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ⑤ · LAS PUERTAS Y EL SITIO ÚNICO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-987 · las puertas del PDF llevan `validez` (por el constructor) y el constructor la produce', () => {
  assert.ok(clavesDelConstructor().includes('validez'),
    '🔴 el constructor no produce `validez`: ninguna puerta la llevaría');
  assert.deepEqual(puertasSinLosCampos(['validez']), [],
    '🔴 hay una puerta del PDF de presupuesto que no lleva `validez`: ese papel saldría sin la línea');
  // La cuarta puerta —la landing, que regenera el papel al firmar— no está en el censo compartido:
  // se comprueba aparte que también delega en el constructor y no arma su objeto a mano.
  const landing = soloCodigo(leer('src/modules/system/app/routes/quoteDecisionLanding.routes.ts'));
  assert.match(landing, /generateQuotePdf\(paramsDePresupuestoParaPdf\(/,
    '🔴 la landing arma el PDF por su cuenta: su papel no llevaría la regla del firmado');
});

test('SCRUM-987 · la frase vive en UN sitio: ni la landing ni el generador la escriben', () => {
  const dominio = soloCodigo(leer('src/modules/quotes/domain/validez.ts'));
  assert.equal(dominio.split('Válido hasta el').length - 1, 1, '🔴 el dominio tiene que escribir el rótulo UNA vez');
  for (const rel of [
    'src/modules/system/app/routes/quoteDecisionLanding.routes.ts',
    'src/modules/invoicing/infra/pdf/pdf.service.ts',
    'src/modules/quotes/domain/presupuestoParaPdf.ts',
  ]) {
    assert.equal(soloCodigo(leer(rel)).includes('Válido hasta'), false,
      `🔴 ${rel} escribe «Válido hasta» a mano: sería el segundo sitio que formula la frase, y dos sitios acaban diciendo dos fechas`);
  }
  assert.match(soloCodigo(leer('src/modules/system/app/routes/quoteDecisionLanding.routes.ts')), /textoDeValidez\(/,
    '🔴 la landing ya no pide la frase a `textoDeValidez`');
});

test('SCRUM-987 · la ficha de microcopy lleva la frase y la línea de la firma delegada con su comentario', () => {
  const ficha = leer('docs/microcopy/2026-09-21-SCRUM-987-valido-hasta-en-el-pdf.md');
  assert.ok(ficha.includes('Válido hasta el {fecha larga}'), '🔴 la ficha no lleva el literal firmado');
  assert.match(ficha, /\*\*Aprobado por el orquestador por delegación del fundador\*\* el 21-sep-2026 — SCRUM-915 comentario 16165\./,
    '🔴 la ficha no lleva la línea de la firma delegada (SCRUM-861) con su comentario');
});
