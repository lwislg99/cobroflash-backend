// tests/scrum643-huso-del-sello-fiscal.test.mjs — SCRUM-643 (apéndice: el censo que faltaba)
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 ESTE FICHERO DOCUMENTA UN DEFECTO VIVO. NO ES UNA PROMESA CUMPLIDA.
//
// SCRUM-643 (fase ③) sacó el reloj de la máquina de los TRES cálculos de la recapitulativa y de
// `avisoDeFacturacion`. El censo por AST de este apéndice encontró que **el camino de emisión
// fiscal se quedó fuera**: `formatFechaHoraHuso` y `makeReceiptNumber` siguen derivando un día
// —y un AÑO— del reloj del PROCESO, y el proceso de Railway va en UTC.
//
// Lo que estos tests afirman es EL COMPORTAMIENTO DE HOY, no el deseado. Están escritos para
// CAER el día que alguien arregle el defecto: cuando estas funciones reciban la zona del
// merchant, el trinquete de firmas del final se pone en rojo y manda retirar este fichero.
//
// ⛔ POR QUÉ AQUÍ NO SE ARREGLA: el arreglo toca el camino de emisión —el valor de
// `formatFechaHoraHuso` entra en la huella SHA-256 del registro de facturación y se remite a la
// AEAT en `FechaHoraHusoGenRegistro`—. Eso es STOP del fundador (AA1.4), y una factura emitida
// no se edita ni se borra (regla 29). Se mide, se deja atado y se para.
//
// 🔴 LA ZONA SE FIJA EN UN SUBPROCESO, SIEMPRE. Estas funciones leen el reloj del proceso, así
// que la única forma honesta de medirlas es arrancar un `node` con `TZ` puesta: cambiar
// `process.env.TZ` en caliente no reconfigura el ICU ya cargado, y el test mediría la máquina
// donde corre — que es justo el defecto de SCRUM-640 repetido en el instrumento.
// ─────────────────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');
const urlDist = (rel) => pathToFileURL(path.join(RAIZ, 'dist', rel)).href;

const UTC = 'UTC';
const MADRID = 'Europe/Madrid';
const CANARIAS = 'Atlantic/Canary';

// Los dos saltos que importan, expresados en UTC:
const SALTO_DE_MES = '2026-03-31T23:30:00Z'; //  = 1-abr 00:30 en la península (CEST, +02:00)
const SALTO_DE_ANIO = '2026-12-31T23:30:00Z'; // = 1-ene 00:30 en la península (CET, +01:00)

/** El día natural `YYYY-MM-DD` de un instante en una zona. No depende del reloj del proceso. */
const diaEn = (iso, zona) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: zona }).format(new Date(iso));

/**
 * Llama a las funciones REALES del camino de emisión con el proceso arrancado en `zona`.
 * Sólo IMPORTA lo que ya está exportado: no extrae helpers, no cambia firmas, no toca el
 * camino de emisión (regla 38 — leer sí, modificar no).
 */
function sello(zona, instanteISO) {
  const guion = `
    const { formatFechaHoraHuso } = await import(process.argv[1]);
    const { makeReceiptNumber } = await import(process.argv[2]);
    const d = new Date(process.argv[3]);
    console.log(JSON.stringify({
      zonaEfectiva: Intl.DateTimeFormat().resolvedOptions().timeZone,
      huso: formatFechaHoraHuso(d),
      justificante: makeReceiptNumber(d),
    }));
  `;
  const salida = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', guion,
      urlDist('modules/invoicing/domain/verifactu.service.js'),
      urlDist('modules/invoicing/domain/invoiceNumber.service.js'),
      instanteISO],
    { cwd: RAIZ, env: { ...process.env, TZ: zona }, encoding: 'utf8' },
  );
  const r = JSON.parse(salida);
  // El subproceso DEBE haber arrancado en la zona pedida. Si `TZ` no se propaga —pasa en Git
  // Bash, que convierte `Europe/Madrid` en una ruta— el test estaría comparando UTC contra UTC
  // y saldría verde sin haber medido nada.
  assert.equal(r.zonaEfectiva, zona,
    `🔴 INSTRUMENTO CIEGO: pedí TZ=${zona} y el subproceso arrancó en ${r.zonaEfectiva}. ` +
    'Lo medido no es lo que dice el nombre del caso.');
  return { ...r, dia: r.huso.slice(0, 10), anio: r.huso.slice(0, 4) };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// SUELO — si el instrumento no distingue dos zonas, cualquier veredicto suyo es ruido
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-643 · SUELO: el arnés arranca en la zona pedida y SABE distinguir dos zonas', () => {
  const enUtc = sello(UTC, SALTO_DE_MES);
  const enMadrid = sello(MADRID, SALTO_DE_MES);

  assert.notEqual(enUtc.huso, enMadrid.huso,
    '🔴 CIEGO: el MISMO instante da el MISMO sello en UTC y en Madrid. O `TZ` no llega al ' +
    'subproceso, o estas funciones ya dejaron de leer el reloj del proceso — y entonces este ' +
    'fichero entero sobra.');

  // Y el día natural de referencia se calcula sin el reloj del proceso, o mediría lo mismo dos veces.
  assert.equal(diaEn(SALTO_DE_MES, MADRID), '2026-04-01');
  assert.equal(diaEn(SALTO_DE_MES, UTC), '2026-03-31');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, AFIRMADO COMO ESTÁ HOY
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-643 · 🔴 DEFECTO VIVO: con el proceso en UTC, el sello fiscal declara el día ANTERIOR', () => {
  const r = sello(UTC, SALTO_DE_MES);

  // Comportamiento ACTUAL, afirmado tal cual:
  assert.equal(r.huso, '2026-03-31T23:30:00+00:00');
  assert.equal(r.dia, '2026-03-31');

  // Y lo que ese día debería ser para un emisor peninsular:
  assert.equal(diaEn(SALTO_DE_MES, MADRID), '2026-04-01');
  assert.notEqual(r.dia, diaEn(SALTO_DE_MES, MADRID),
    '✅ Si esto ya coincide, el defecto está ARREGLADO: retira este fichero y anótalo.');
});

test('SCRUM-643 · 🔴 DEFECTO VIVO: en Nochevieja española el justificante nace con el AÑO anterior', () => {
  const r = sello(UTC, SALTO_DE_ANIO);

  // Comportamiento ACTUAL: la serie del justificante lleva el día del PROCESO.
  assert.match(r.justificante, /^J-20261231-[0-9A-Z]{4}$/);
  assert.equal(r.anio, '2026');

  // En España ya es 2027: es la numeración correlativa cayendo en el ejercicio equivocado.
  assert.equal(diaEn(SALTO_DE_ANIO, MADRID), '2027-01-01');
  assert.notEqual(r.anio, diaEn(SALTO_DE_ANIO, MADRID).slice(0, 4),
    '✅ Si esto ya coincide, el defecto está ARREGLADO: retira este fichero y anótalo.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// CONTROL NEGATIVO — lo que NO debe hacerlo caer, y además desmonta el arreglo fácil
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-643 · CONTROL NEGATIVO: para un CANARIO el «año anterior» es el año CORRECTO', () => {
  const r = sello(CANARIAS, SALTO_DE_ANIO);

  // Canarias va en UTC+0 en invierno: a las 23:30Z del 31-dic allí TODAVÍA es 2026.
  assert.equal(r.anio, '2026');
  assert.equal(diaEn(SALTO_DE_ANIO, CANARIAS), '2026-12-31');
  assert.equal(r.anio, diaEn(SALTO_DE_ANIO, CANARIAS).slice(0, 4),
    '🔴 Para un merchant canario este resultado es el BUENO.');

  // 🔴 LA LECCIÓN, y es la razón de que este control exista: el arreglo NO es «poner
  // Europe/Madrid». Fijar la península declararía peninsular a un canario y le movería el
  // ejercicio fiscal — el mismo error de SCRUM-643 con el signo cambiado. La zona tiene que
  // ser la DEL MERCHANT (`zonaDelMerchant`), que es la pieza que ya existe y que estas
  // funciones todavía no reciben.
  assert.notEqual(diaEn(SALTO_DE_ANIO, CANARIAS), diaEn(SALTO_DE_ANIO, MADRID),
    '🔴 CIEGO: si Canarias y Madrid dieran el mismo día en este instante, el caso elegido no ' +
    'separa las dos zonas y no prueba nada.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// TRINQUETE — que el arreglo NO pueda pasar en silencio
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-643 · 🔴 TRINQUETE: estas funciones NO reciben zona hoy — el día que la reciban, esto cae', () => {
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

  assert.deepEqual(firmas.get('formatFechaHoraHuso'), ['d'],
    '✅ `formatFechaHoraHuso` ha cambiado de firma. Si ya recibe la zona del merchant, el ' +
    'defecto está arreglado: retira este fichero y anótalo en docs/master/SCRUM-643.md.');
  assert.deepEqual(firmas.get('formatDateES'), ['d'],
    '✅ `formatDateES` ha cambiado de firma. Mismo caso que arriba.');

  // Y el módulo NO conoce todavía la pieza que resolvería esto.
  assert.equal(/zonaDelMerchant|diaNaturalEn|mesNaturalEn/.test(codigo), false,
    '✅ `verifactu.service.ts` ya importa la primitiva de zona: el defecto está en vías de ' +
    'arreglo y esta caracterización hay que revisarla.');
});
