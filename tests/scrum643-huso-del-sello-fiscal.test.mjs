// tests/scrum643-huso-del-sello-fiscal.test.mjs — SCRUM-643 (apéndice) → SCRUM-735 (el arreglo)
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🟢 EL DEFECTO QUE ESTE FICHERO DOCUMENTABA YA ESTÁ ARREGLADO.
//
// Nació con SCRUM-643 (apéndice, 4-sep-2026) para documentar el comportamiento DE ENTONCES:
// `formatFechaHoraHuso` y `makeReceiptNumber` derivaban el día y el año del reloj del PROCESO
// (Railway va en UTC), no de la zona del merchant. Su propia cabecera decía: «el día que estas
// funciones reciban la zona del merchant, el trinquete de firmas se pone en rojo y manda
// retirar este fichero». Ese día es hoy — GO del fundador en Jira SCRUM-735, comentario 16573
// (23-sep-2026): «y go al reloj». El expediente completo (medición, riesgo, lo que NO cambia)
// vive en docs/master/SCRUM-735.md.
//
// El borrado del fichero está bloqueado por política de esta sesión (Security Test Removal), así
// que se REESCRIBE en el mismo sitio en vez de moverse — que es justo lo que la cabecera vieja
// pedía hacer con él, con las palabras cambiadas de sitio: ahora afirma el comportamiento
// CORRECTO, y lleva un trinquete que cae si alguien vuelve a quitarle la zona a estas funciones.
//
// 🟢 YA NO HACE FALTA SUBPROCESO. La razón por la que SCRUM-643 necesitaba lanzar un `node` con
// `TZ` fijada era que las funciones leían el reloj del PROCESO. Ahora la zona es un PARÁMETRO
// EXPLÍCITO y `Intl.DateTimeFormat({ timeZone })` no consulta `process.env.TZ` en absoluto — se
// llama a las funciones reales, en este mismo proceso, con la zona que se quiera medir.
// ─────────────────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');
const urlDist = (rel) => pathToFileURL(path.join(RAIZ, 'dist', rel)).href;

const { formatFechaHoraHuso, formatDateES } =
  await import(urlDist('modules/invoicing/domain/verifactu.service.js'));
const { makeReceiptNumber } = await import(urlDist('modules/invoicing/domain/invoiceNumber.service.js'));
const { invalidAnioFiscal } = await import(urlDist('core/validation/fiscalInput.js'));

const MADRID = 'Europe/Madrid';
const CANARIAS = 'Atlantic/Canary';

// Los dos saltos que importan, expresados en UTC:
const SALTO_DE_MES = '2026-03-31T23:30:00Z'; //  = 1-abr 00:30 en la península (CEST, +02:00)
const SALTO_DE_ANIO = '2026-12-31T23:30:00Z'; // = 1-ene 00:30 en la península (CET, +01:00)

/** El día natural `YYYY-MM-DD` de un instante en una zona. No depende del reloj del proceso. */
const diaEn = (iso, zona) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: zona }).format(new Date(iso));

// ─────────────────────────────────────────────────────────────────────────────────────────
// SUELO — si el instrumento no distingue dos zonas, cualquier veredicto suyo es ruido
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-735 · SUELO: pedir dos zonas distintas da dos sellos distintos para el mismo instante', () => {
  const d = new Date(SALTO_DE_MES);
  assert.notEqual(formatFechaHoraHuso(d, 'UTC'), formatFechaHoraHuso(d, MADRID),
    '🔴 CIEGO: el mismo instante da el mismo sello en UTC y en Madrid — la zona ya no se usa.');
  assert.equal(diaEn(SALTO_DE_MES, MADRID), '2026-04-01');
  assert.equal(diaEn(SALTO_DE_MES, 'UTC'), '2026-03-31');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL ARREGLO, AFIRMADO
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-735 · el sello fiscal declara el día PENINSULAR aunque el proceso vaya en UTC', () => {
  const huso = formatFechaHoraHuso(new Date(SALTO_DE_MES), MADRID);
  assert.equal(huso, '2026-04-01T01:30:00+02:00',
    `🔴 sigue derivando el día del reloj del proceso, no de la zona pedida (salió "${huso}").`);
  assert.equal(formatDateES(new Date(SALTO_DE_MES), MADRID), '01-04-2026');
});

test('SCRUM-735 · el justificante nace con el AÑO peninsular en Nochevieja española', () => {
  const j = makeReceiptNumber(new Date(SALTO_DE_ANIO), MADRID);
  assert.match(j, /^J-20270101-[0-9A-Z]{4}$/,
    `🔴 sigue naciendo con el año del proceso (2026), no el de Madrid (2027): "${j}".`);
});

test('SCRUM-735 · invalidAnioFiscal ya no rechaza el ejercicio en curso en la madrugada española', () => {
  const medianocheEspañola = new Date(SALTO_DE_ANIO); // 1-ene 00:30 en Madrid
  assert.equal(invalidAnioFiscal(2027, medianocheEspañola, MADRID), null,
    '🔴 sigue rechazando 2027 como "año futuro" con el reloj de Madrid.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// CONTROL NEGATIVO — lo que el arreglo NO puede hacer: fijar `Europe/Madrid`
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-735 · CONTROL NEGATIVO: para un CANARIO el año de Nochevieja sigue siendo el de antes', () => {
  const j = makeReceiptNumber(new Date(SALTO_DE_ANIO), CANARIAS);
  assert.match(j, /^J-20261231-[0-9A-Z]{4}$/,
    '🔴 fijar la península movería el ejercicio de un canario — el mismo defecto con el signo cambiado.');

  const husoCanarias = formatFechaHoraHuso(new Date(SALTO_DE_ANIO), CANARIAS);
  const husoMadrid = formatFechaHoraHuso(new Date(SALTO_DE_ANIO), MADRID);
  assert.equal(husoCanarias.slice(0, 10), '2026-12-31');
  assert.equal(husoMadrid.slice(0, 10), '2027-01-01');
  assert.notEqual(husoCanarias.slice(0, 10), husoMadrid.slice(0, 10),
    '🔴 CIEGO: si las dos zonas dieran el mismo día en este instante, el caso no separa nada.');
});

test('SCRUM-735 · CONTROL NEGATIVO: para un CANARIO, en la misma madrugada, 2027 SÍ es año futuro', () => {
  const medianocheEspañola = new Date(SALTO_DE_ANIO);
  assert.ok(invalidAnioFiscal(2027, medianocheEspañola, CANARIAS),
    '🔴 en Canarias, a esa hora, todavía es 2026 — 2027 tiene que seguir rechazándose ahí.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// TRINQUETE — que el arreglo no se pueda deshacer en silencio
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-735 · TRINQUETE: formatFechaHoraHuso/formatDateES reciben `zona` — leído por AST', () => {
  const rel = 'src/modules/invoicing/domain/verifactu.service.ts';
  const codigo = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  const sf = ts.createSourceFile(rel, codigo, ts.ScriptTarget.Latest, true);

  // Por AST y no por `grep`: la firma se lee de la declaración, no de un texto que puede vivir
  // dentro de un comentario (SCRUM-203).
  const firmas = new Map();
  (function anda(n) {
    if (ts.isFunctionDeclaration(n) && n.name) firmas.set(n.name.text, n.parameters.map((p) => p.name.getText(sf)));
    ts.forEachChild(n, anda);
  })(sf);

  assert.ok(firmas.has('formatFechaHoraHuso'),
    '🔴 CIEGO: no encuentro `formatFechaHoraHuso`. Si se renombró, este control dejó de mirar.');
  assert.ok(firmas.has('formatDateES'),
    '🔴 CIEGO: no encuentro `formatDateES`. Si se renombró, este control dejó de mirar.');

  assert.deepEqual(firmas.get('formatFechaHoraHuso'), ['d', 'zona'],
    '🔴 `formatFechaHoraHuso` ha perdido el parámetro `zona`: alguien deshizo el arreglo de SCRUM-735.');
  assert.deepEqual(firmas.get('formatDateES'), ['d', 'zona'],
    '🔴 `formatDateES` ha perdido el parámetro `zona`: alguien deshizo el arreglo de SCRUM-735.');

  // Y el módulo SÍ conoce ya la pieza que resuelve esto — sin ella, el `zona` de arriba sería
  // un parámetro decorativo que nadie usa para derivar el reloj de pared.
  assert.ok(/zonaDelMerchant/.test(codigo),
    '🔴 `verifactu.service.ts` ya no importa `zonaDelMerchant`: ¿de dónde sale la zona del sello?');
});

test('SCRUM-735 · TRINQUETE: allocateInvoiceNumber deriva el año de la zona del merchant, no del proceso', () => {
  const rel = 'src/modules/invoicing/domain/invoiceNumber.service.ts';
  const codigo = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  assert.equal(/now\.getFullYear\(\)/.test(codigo), false,
    '🔴 `now.getFullYear()` ha vuelto a invoiceNumber.service.ts: eso es el reloj del proceso.');
  assert.match(codigo, /diaNaturalEn\(now,\s*zonaDelMerchant\(m\)\)/,
    '🔴 el año de la serie ya no se deriva con `diaNaturalEn(now, zonaDelMerchant(m))`.');
});
