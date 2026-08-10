// tests/scrum313-pantalla-numeracion.test.mjs — SCRUM-313 (D2) · la pantalla de la continuidad.
//
// El mecanismo (`arranqueDeSerie`) ya entró con A4 y tiene sus tests. Esto cubre **la pantalla**:
// que la pregunta lleve el año dentro y salga de la fecha actual, que la vista previa la resuelva
// QUIEN DECIDE, y que las dos ramas lleguen enteras de punta a punta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const VISTA = 'public/dashboard/js/onboardingView.js';

const { arranqueDeSerie } = await import('../dist/core/validation/fiscalInput.js');
const { vistaPreviaSerie } = await import('../dist/modules/invoicing/domain/vistaPreviaSerie.js');
const { formatInvoiceNumber, resolveSeriesSeq } = await import('../dist/modules/invoicing/domain/invoiceNumber.service.js');

const leerVista = () => fs.readFileSync(path.join(RAIZ, VISTA), 'utf8');
/** Un número REAL de la serie, compuesto por quien los compone. */
const num = (seq) => formatInvoiceNumber('CF', 2026, seq);

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CAMBIO DE AÑO — obligatorio, y es el clásico que se descubre en enero
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-313 · un alta el 31-dic y otra el 1-ene producen arranques DISTINTOS', () => {
  // Dos altas idénticas salvo la fecha. Si el año se cablease, las dos darían lo mismo y la del
  // 1 de enero escribiría un arranque que `resolveSeriesSeq` descarta — el usuario creería
  // continuar y su factura saldría con el número 1.
  // ⚠️ Las fechas se construyen en hora LOCAL, no con un instante UTC. `getFullYear()` es local, y
  // eso es lo correcto —el ejercicio fiscal de un autónomo español es su año local—, pero significa
  // que `2026-12-31T23:59:00Z` en UTC+2 YA es 1 de enero: un fixture en UTC probaría dos veces el
  // mismo año y este test saldría verde sin haber cruzado la frontera. Medido: lo hizo.
  const finDeAño = new Date(2026, 11, 31, 23, 59).getFullYear();
  const añoNuevo = new Date(2027, 0, 1, 0, 1).getFullYear();
  assert.equal(finDeAño, 2026, 'suelo del fixture: la fecha de fin de año tiene que ser del año viejo');
  assert.equal(añoNuevo, 2027, 'suelo del fixture: la de año nuevo, del nuevo');

  const a = arranqueDeSerie({ vieneDeOtroSitio: true, ultimoNumero: 41, año: finDeAño, numerosDeLaSerie: [] });
  const b = arranqueDeSerie({ vieneDeOtroSitio: true, ultimoNumero: 41, año: añoNuevo, numerosDeLaSerie: [] });

  assert.notEqual(a.invoiceSeriesYear, b.invoiceSeriesYear,
    '🔴 las dos altas declaran el MISMO año. El 1 de enero se estaría escribiendo una continuidad ' +
    'del año pasado, y el emisor la descartaría devolviendo 1.');
  assert.equal(vistaPreviaSerie('CF', a, finDeAño), '2026-CF-042');
  assert.equal(vistaPreviaSerie('CF', b, añoNuevo), '2027-CF-042',
    '🔴 el número previsto del año nuevo no lleva el año nuevo.');
});

test('SCRUM-313 · el año de la pantalla sale de la fecha actual, NUNCA cableado', () => {
  const codigo = leerVista().replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  assert.match(codigo, /const ANIO_EN_CURSO = new Date\(\)\.getFullYear\(\)/,
    '🔴 el año de la pregunta ya no sale de la fecha actual.');
  // Ningún año literal de cuatro cifras en el código de la vista: es la forma en que esto se
  // rompe — alguien escribe 2026 «para probar» y se queda.
  assert.doesNotMatch(codigo, /\b20\d{2}\b/,
    '🔴 hay un año cableado en la vista. El 1 de enero preguntaría por el año equivocado, y eso ' +
    'no se descubre en diciembre: se descubre en enero con un cliente delante.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA VISTA PREVIA — se la pide a quien decide, no la calcula
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-313 · la vista previa coincide EXACTAMENTE con lo que emitiría resolveSeriesSeq', () => {
  const año = 2026;
  for (const ultimo of [1, 9, 41, 99, 100, 998]) {
    const par = arranqueDeSerie({ vieneDeOtroSitio: true, ultimoNumero: ultimo, año, numerosDeLaSerie: [] });
    const previa = vistaPreviaSerie('CF', par, año);
    // Lo que saldría de verdad: se le pregunta a los dos deciden, sin copiar el formato.
    const real = formatInvoiceNumber('CF', año, resolveSeriesSeq(par, año));
    assert.equal(previa, real,
      `🔴 con ${ultimo} la vista previa dice «${previa}» y el emisor daría «${real}». Dos sitios ` +
      'calculando el mismo número es cómo la pantalla promete una cosa y la factura hace otra.');
  }
});

test('SCRUM-313 · la vista previa NO se calcula en el navegador', () => {
  // Si el front compusiera el número, sería un segundo sitio con el formato dentro. Se le pide al
  // servidor, que lo resuelve con quien decide.
  const codigo = leerVista().replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.match(codigo, /onboarding\/serie\/previa/,
    '🔴 la vista ya no pide la vista previa al servidor.');
  assert.doesNotMatch(codigo, /padStart\(\s*3|['"`]-CF-|\$\{a[nñ]o\}-/,
    '🔴 la vista ha empezado a componer el número por su cuenta. Eso es una copia del formato, y ' +
    'una copia se queda vieja sin avisar.');
});

test('SCRUM-313 · el módulo de vista previa IMPORTA a quien decide y no lo reimplementa', () => {
  const src = fs.readFileSync(path.join(RAIZ, 'src/modules/invoicing/domain/vistaPreviaSerie.ts'), 'utf8');
  const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.match(codigo, /import \{ formatInvoiceNumber, resolveSeriesSeq \}/,
    '🔴 la vista previa ya no importa a quien decide.');
  assert.doesNotMatch(codigo, /padStart|invoiceSeriesYear === |\?\s*.*:\s*1/,
    '🔴 la vista previa ha reimplementado la regla del año o el formato. Tiene que PREGUNTAR.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS DOS CARAS — el negativo Y el positivo
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-313 · CONTROL NEGATIVO — «No, empiezo ahora» no hereda, ni desde la pantalla', () => {
  // La pantalla manda `ultimoNumero: undefined` en esa rama, pero el servidor no se fía: el
  // mecanismo ignora el número cuando `vieneDeOtroSitio` es false. Se comprueba el caso hostil —
  // que la petición traiga un número igualmente.
  const r = arranqueDeSerie({ vieneDeOtroSitio: false, ultimoNumero: 900, año: 2026, numerosDeLaSerie: [] });
  assert.equal(r.ok, true);
  assert.equal(r.nextInvoiceNumber, 1,
    '🔴 quien empieza de cero hereda un número que venía en la petición.');
  assert.equal(vistaPreviaSerie('CF', r, 2026), '2026-CF-001');
});

test('SCRUM-313 · CONTROL POSITIVO — el que SÍ pone número, emite con ese número', () => {
  // Hace falta porque aquí el requisito se cumple por AUSENCIA: sin este test, la pantalla podría
  // estar rechazándolo todo —o devolviendo siempre 1— y el control negativo seguiría en verde.
  const r = arranqueDeSerie({ vieneDeOtroSitio: true, ultimoNumero: 41, año: 2026, numerosDeLaSerie: [] });
  assert.equal(r.ok, true, '🔴 se rechaza un arranque perfectamente válido');
  assert.equal(r.nextInvoiceNumber, 42);
  assert.equal(vistaPreviaSerie('CF', r, 2026), '2026-CF-042',
    '🔴 el que declara la 41 no acaba emitiendo la 42.');
  assert.notEqual(vistaPreviaSerie('CF', r, 2026), '2026-CF-001',
    '🔴 la pantalla está devolviendo el arranque por defecto: acepta la respuesta y la tira.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA PUERTA DE A4 Y LA MICROCOPY
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-313 · la ruta responde el choque con el MISMO texto aprobado del bloqueo', () => {
  // Es el mismo hecho —la serie ya tiene facturas— y contarlo de dos maneras haría parecer que
  // son dos reglas distintas.
  const app = fs.readFileSync(path.join(RAIZ, 'src/app.ts'), 'utf8');
  assert.match(app, /onboarding\/serie/, '🔴 no existe la ruta del arranque');
  assert.match(app, /TIT_SERIE_YA_EMITIDA[\s\S]{0,200}MSG_SERIE_YA_EMITIDA/,
    '🔴 el choque no reutiliza el texto aprobado del bloqueo de serie.');
});

test('SCRUM-313 · la microcopy aprobada está literal en la pantalla', () => {
  const v = leerVista();
  for (const frase of [
    '¿Ya has facturado en ${ANIO_EN_CURSO}?',
    'No, empiezo ahora',
    '¿Cuál fue el número de tu última factura de ${ANIO_EN_CURSO}?',
    'Seguimos por ahí para que tu numeración no tenga saltos.',
    'Tu primera factura con YaQu será:',
    'Compruébalo bien: cuando emitas esa factura, este número ya no se puede cambiar.',
    'Es correcto',
  ]) {
    assert.ok(v.includes(frase), `🔴 falta la microcopy aprobada: «${frase}»`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-313 · SUELO: el censo encuentra dónde se ESCRIBE el arranque', () => {
  // «Nadie lo escribe» y «no supe mirar» son el mismo número.
  const ficheros = [];
  const anda = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) anda(p);
      else if (/\.ts$/.test(e.name)) ficheros.push(p);
    }
  };
  anda(path.join(RAIZ, 'src'));
  assert.ok(ficheros.length > 50, `🔴 el barrido solo ve ${ficheros.length} ficheros: no recorre el árbol.`);

  const escriben = ficheros.filter((p) => {
    const s = fs.readFileSync(p, 'utf8');
    return s.includes('nextInvoiceNumber:') && s.includes('invoiceSeriesYear:');
  }).map((p) => path.relative(RAIZ, p).replace(/\\/g, '/'));

  assert.ok(escriben.length > 0,
    '🔴 CERO sitios escriben el par del arranque. No significa «nadie lo toca»: significa que el ' +
    'censo no está mirando, y sin él nada de lo de arriba está verificado contra el producto.');
  assert.ok(escriben.some((f) => f === 'src/app.ts'),
    '🔴 el censo no encuentra la ruta del arranque, que es quien lo escribe.');
});

test('SCRUM-313 · el par se escribe SIEMPRE junto, nunca medio', () => {
  // La trampa fiscal: `nextInvoiceNumber` sin `invoiceSeriesYear` reinicia la serie en silencio.
  // Se comprueba que ningún `data:` de la ruta escriba uno sin el otro.
  // ⚠️ Se cuentan las ESCRITURAS, no las menciones: `invoiceSeriesYear` aparece también en los
  // `select:` de lectura, y contarlas todas daba un descuadre falso (medido: 4 contra 6). Un
  // guard que grita sin motivo se acaba desactivando, y con él se pierde el que sí importaba.
  const app = fs.readFileSync(path.join(RAIZ, 'src/app.ts'), 'utf8');
  const escrituraNumero = (app.match(/nextInvoiceNumber:\s*arranque\./g) || []).length;
  const escrituraAño    = (app.match(/invoiceSeriesYear:\s*arranque\./g) || []).length;
  assert.ok(escrituraNumero > 0,
    '🔴 no se ve ninguna escritura del arranque: el guard no está mirando donde cree.');
  assert.equal(escrituraNumero, escrituraAño,
    `🔴 hay ${escrituraNumero} escrituras del número y ${escrituraAño} del año. Uno sin el otro ` +
    'reinicia la serie en 1 EN SILENCIO, y el profesional emitiría un número que YA usó en su ' +
    'programa anterior.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA PUERTA DE ÚLTIMA OPORTUNIDAD
//
// Es la mitad que de verdad importa, y por una razón de perfil: **quien se salta el asistente es
// exactamente quien viene de otro programa con facturas ya emitidas**. El que se sienta a
// contestarlo suele ser el que empieza de cero, o sea aquel para quien la pregunta da igual.
// ═════════════════════════════════════════════════════════════════════════════════════════

const { debeOfrecerArranqueDeSerie } = await import('../dist/core/validation/fiscalInput.js');

test('SCRUM-313 · CONTROL POSITIVO — quien se saltó el asistente y no ha emitido SÍ ve la puerta', () => {
  // Sin este test la puerta puede no salirle a NADIE y el control negativo seguiría en verde:
  // «no se la enseñamos a quien ya emitió» se cumple perfectamente si no se la enseñamos a nadie.
  assert.equal(
    debeOfrecerArranqueDeSerie({ invoiceSeriesYear: null, año: 2026, numerosDeLaSerie: [] }),
    true,
    '🔴 a quien nunca declaró su numeración y no ha emitido no se le pregunta. Es EL perfil que\n' +
    '  viene de otro programa: si no se le pregunta aquí, su primera factura sale con el número\n' +
    '  equivocado y ya no hay vuelta atrás.');
  // Y el caso del año viejo: declaró en 2025 y estamos en 2026 → su serie de este año no existe.
  assert.equal(
    debeOfrecerArranqueDeSerie({ invoiceSeriesYear: 2025, año: 2026, numerosDeLaSerie: [] }),
    true,
    '🔴 quien declaró el año pasado no vuelve a ser preguntado este año, y su serie de este año ' +
    'todavía no está declarada — `resolveSeriesSeq` la trataría como nueva.');
});

test('SCRUM-313 · CONTROL NEGATIVO — quien YA emitió con nosotros NO ve la puerta', () => {
  // Ofrecerle elegir el arranque a quien ya arrancó es ofrecerle romper su propia correlatividad,
  // y eso no se arregla después: una factura emitida no se edita (regla 29).
  assert.equal(
    debeOfrecerArranqueDeSerie({ invoiceSeriesYear: null, año: 2026, numerosDeLaSerie: [num(1)] }),
    false,
    '🔴 se le ofrece cambiar el arranque a alguien que YA emitió. Eso es ofrecerle romper su ' +
    'propia numeración, y encima cuando ya no tiene arreglo.');
  assert.equal(
    debeOfrecerArranqueDeSerie({ invoiceSeriesYear: 2026, año: 2026, numerosDeLaSerie: [num(1), num(2)] }),
    false);
});

test('SCRUM-313 · quien YA declaró este año no vuelve a ver la puerta', () => {
  // No es que esté prohibido: es que no hay nada que preguntar. Repetir la pregunta a quien ya
  // contestó convierte una ayuda en un obstáculo.
  assert.equal(
    debeOfrecerArranqueDeSerie({ invoiceSeriesYear: 2026, año: 2026, numerosDeLaSerie: [] }),
    false,
    '🔴 se repite la pregunta a quien ya la contestó este año.');
});

test('SCRUM-313 · la condición se DERIVA, no se guarda una bandera de «ya preguntado»', () => {
  // Una bandera se desincroniza el día que alguien la ponga sin escribir el par, y entonces la
  // puerta deja de salirle justo a quien más la necesita. La condición usa `invoiceSeriesYear`,
  // que es LA MISMA que `resolveSeriesSeq` usa para decidir que la serie arranca en 1: si el
  // emisor la trataría como nueva, es que nadie declaró su arranque.
  const src = fs.readFileSync(path.join(RAIZ, 'src/core/validation/fiscalInput.ts'), 'utf8');
  const cuerpo = src.slice(src.indexOf('export function debeOfrecerArranqueDeSerie'));
  assert.match(cuerpo, /invoiceSeriesYear !== params\.año/,
    '🔴 la puerta ya no decide por `invoiceSeriesYear`. Si decide por una bandera aparte, habrá ' +
    'dos verdades sobre si la serie está declarada y la del emisor es la que manda.');
  assert.doesNotMatch(cuerpo.slice(0, 400), /preguntad[oa]|yaPreguntado|serieDeclarada/,
    '🔴 ha aparecido una bandera de «ya preguntado».');
});

test('SCRUM-313 · el veredicto de la puerta lo calcula el SERVIDOR, no la pantalla', () => {
  const app = fs.readFileSync(path.join(RAIZ, 'src/app.ts'), 'utf8');
  assert.match(app, /puertaSerieDisponible: debeOfrecerArranqueDeSerie\(/,
    '🔴 `/admin/me` ya no resuelve la puerta. Si la regla se reimplementa en el navegador habrá ' +
    'dos criterios sobre cuándo se puede tocar la numeración, y el del navegador es el fácil de ' +
    'equivocar.');
});
