// tests/scrum1452-gemelo-crudo.test.mjs — SCRUM-1452
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LOS DOS GUARDS DEL PATRÓN GEMELO, sobre `scripts/_censo-gemelo-crudo.mjs`:
//
//   NUMERO  · un valor interpolado detrás de un `#` que no pasa por el helper del número.
//   IMPORTE · un `toFixed(2)` en un texto que lleva una moneda, en vez de `formatMoneyEs`.
//
// Cada uno es un TRINQUETE con sus dos mitades: un sitio NUEVO es rojo, y una BAJADA que nadie ha
// declarado también (una bajada sin dueño es un censo roto hasta que se demuestre lo contrario).
//
// 🔴 SI ESTE TEST TE SALE ROJO POR UN SITIO NUEVO: usa el helper (`displayQuoteNumber` y familia
// para el número, `formatMoneyEs` para el importe). La lista `DECLARADOS` no es la salida: sólo
// entra en ella lo que se demuestre LEGITIMO, con su motivo. Y si arreglaste uno de los declarados,
// baja su `n` o mueve la entrada a `RETIRADAS` con tu ticket.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  RAIZ, censar, censarFuente, comparar, acusada, porIdentidad,
  DECLARADOS, RETIRADAS, PUESTOS, DEUDA, LEGITIMO,
  NUMERO, IMPORTE, DENTRO, FUERA, NO_DECIDIBLE,
} from '../scripts/_censo-gemelo-crudo.mjs';
import { temporal } from './_temporal.mjs';

const REAL = censar(RAIZ);
const de = (forma) => REAL.filas.filter((f) => f.forma === forma);

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① SUELO — sobre el árbol de verdad. «No pude mirar» no da verde.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1452 · SUELO: el censo declara su población y no deja ningún fichero sin analizar', () => {
  assert.ok(REAL.ficheros > 250, `🔴 población sospechosamente pequeña: ${REAL.ficheros} ficheros .ts en src/`);
  assert.deepEqual(REAL.noAnalizables, [],
    '🔴 NO PUDE MIRAR estos ficheros, y por tanto no sé si tienen un crudo: un fichero sin analizar '
    + 'no cuenta como cero. Arregla el fichero (o el censo, si es él quien no sabe leerlo).');
});

test('SCRUM-1452 · SUELO: ve las dos formas, y distingue un texto que sale de un registro interno', () => {
  assert.ok(de(NUMERO).length > 0, '🔴 CIEGO: cero sitios de NUMERO sobre un árbol que los tiene.');
  assert.ok(de(IMPORTE).length > 0, '🔴 CIEGO: cero sitios de IMPORTE sobre un árbol que los tiene.');
  assert.ok(REAL.filas.some((f) => f.destino === DENTRO), '🔴 no distingue: ningún sitio DENTRO, y el árbol tiene `console.log` con «#…».');
  assert.ok(REAL.filas.some((f) => f.destino === FUERA), '🔴 no distingue: ningún sitio FUERA, y el árbol tiene `text:` con «#…».');
  assert.ok(REAL.sueltos > 0, '🔴 CIEGO: cero `toFixed(2)` fuera de un texto. Los hay (cálculos, XML): el censo ha dejado de verlos.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② EL TRINQUETE — el árbol es EXACTAMENTE el declarado.
// ═════════════════════════════════════════════════════════════════════════════════════════════

const DIFERENCIA = comparar(REAL.filas);
const lineasDe = (ids) => REAL.filas
  .filter((f) => acusada(f) && ids.some((x) => x.startsWith(f.identidad)))
  .map((f) => `${f.fichero}:${f.linea} [${f.destino} · ${f.sumidero}] ${f.valor}`);

test('SCRUM-1452 · 🔴 TRINQUETE: ningún sitio NUEVO con un número o un importe en crudo', () => {
  const nuevas = [...DIFERENCIA.nuevas, ...DIFERENCIA.suben];
  assert.deepEqual(nuevas, [],
    '🔴 CRUDO NUEVO en un texto que no se ha podido demostrar que se queda dentro. Las líneas:\n  '
    + lineasDe(nuevas).join('\n  ')
    + '\nNUMERO → el número visible de un documento sale de su helper (`displayQuoteNumber`, '
    + '`numeroConRevision`, `formatInvoiceNumber`…), no de `#${id}`. IMPORTE → `formatMoneyEs(valor, moneda)`, '
    + 'no `toFixed(2)` más la moneda. NO lo añadas a `DECLARADOS` para que pase: ahí sólo entra lo LEGITIMO.');
});

test('SCRUM-1452 · 🔴 TRINQUETE: ninguna entrada declarada ha BAJADO sin declararlo', () => {
  assert.deepEqual(DIFERENCIA.bajan, [],
    '🔴 Hay menos sitios que los declarados. Si lo arreglaste: baja su `n` en `DECLARADOS`, o mueve la '
    + 'entrada a `RETIRADAS` con tu ticket si ya no queda ninguno. Si NO lo arreglaste nadie, el censo '
    + 'se ha quedado ciego para ese sitio: sospecha del censo antes que del código.');
});

test('SCRUM-1452 · ninguna identidad RETIRADA ha vuelto a aparecer', () => {
  assert.deepEqual(DIFERENCIA.resucitadas, [],
    '🔴 Una identidad que se declaró arreglada vuelve a tener un crudo: o el arreglo se revirtió, o ha '
    + 'nacido otro sitio en la misma función.');
});

test('SCRUM-1452 · cada entrada declarada lleva su clase, su motivo y quién la retira', () => {
  const mal = [];
  for (const [id, d] of DECLARADOS) {
    if (!/^(?:NUMERO|IMPORTE)\|src\/.+\.ts::.+$/.test(id)) mal.push(`${id}: la identidad no es «FORMA|src/….ts::función»`);
    if (!Number.isInteger(d.n) || d.n < 1) mal.push(`${id}: n=${d.n}`);
    if (typeof d.motivo !== 'string' || d.motivo.trim().length < 20) mal.push(`${id}: sin motivo que se pueda leer`);
    if (d.clase === DEUDA) { if (!PUESTOS.test(d.retira ?? '')) mal.push(`${id}: DEUDA sin el puesto que la retira (${d.retira})`); }
    else if (d.clase === LEGITIMO) { if (d.retira !== null) mal.push(`${id}: LEGITIMO no lo retira nadie, y dice ${d.retira}`); }
    else mal.push(`${id}: clase desconocida (${d.clase})`);
    if (RETIRADAS.has(id)) mal.push(`${id}: está a la vez en DECLARADOS y en RETIRADAS`);
  }
  for (const [id, ticket] of RETIRADAS) {
    if (!/^SCRUM-\d+/.test(String(ticket))) mal.push(`${id}: RETIRADA sin el ticket que la arregló`);
  }
  assert.deepEqual(mal, []);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ③ LO QUE EL CENSO POR TEXTO NO VEÍA — sitios REALES del árbol, por su identidad.
// SCRUM-1444 buscaba `#${…}` con `.id`, `Id` o `quoteNumber` dentro; estos tres no lo llevan.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1452 · ve en el árbol real lo que el patrón de texto de SCRUM-1444 no casa', () => {
  const vivas = porIdentidad(REAL.filas);
  const NO_VISTOS_POR_TEXTO = [
    'NUMERO|src/modules/quotes/domain/sendQuote.service.ts::sendQuoteWhatsAppToCustomer',
    'NUMERO|src/modules/billing/app/routes/payCard.routes.ts::GET /card/:token',
    'NUMERO|src/modules/jobs/app/routes/jobs.routes.ts::GET /:id/ics',
  ];
  const patronDeTexto = /#\$\{[^}]*(\.id|Id|quoteNumber)[^}]*\}/;
  for (const id of NO_VISTOS_POR_TEXTO) {
    if (RETIRADAS.has(id)) continue;
    assert.ok(vivas.has(id), `🔴 el censo ha dejado de ver ${id}, y no está en RETIRADAS.`);
    const filas = REAL.filas.filter((f) => f.identidad === id && acusada(f));
    const lineas = fs.readFileSync(path.join(RAIZ, filas[0].fichero), 'utf8').split(/\r?\n/);
    const casaPorTexto = filas.filter((f) => patronDeTexto.test(lineas[f.linea - 1]));
    assert.deepEqual(casaPorTexto, [], `control: se eligió ${id} porque el texto NO lo casaba, y ahora sí.`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ④ FABRICADOS — cada forma, con su positivo y su negativo DERIVADO (el mismo texto, arreglado).
// ═════════════════════════════════════════════════════════════════════════════════════════════

const censo = (lineas) => {
  const r = censarFuente('src/fabricado.ts', lineas.join('\n'));
  assert.equal(r.error, null, `el fabricado no parsea: ${r.error}`);
  return r;
};
const formas = (r) => r.filas.map((f) => `${f.forma}:${f.destino}`);

test('SCRUM-1452 · 🔴 NUMERO: `#${q.id}` en un `text:` se acusa, FUERA y marcado como sólo id', () => {
  const r = censo(['export const aviso = (q: { id: number }) => ({ text: `Presupuesto #${q.id} listo` });']);
  assert.deepEqual(formas(r), ['NUMERO:FUERA']);
  assert.equal(r.filas[0].soloId, true);
  assert.equal(r.filas[0].identidad, 'NUMERO|src/fabricado.ts::aviso');
});

test('SCRUM-1452 · NUMERO negativo derivado: el mismo texto con `displayQuoteNumber` no se acusa', () => {
  const r = censo(['export const aviso = (q: any, m: any) => ({ text: `Presupuesto #${displayQuoteNumber(q, m)} listo` });']);
  assert.deepEqual(formas(r), []);
});

test('SCRUM-1452 · 🔴 NUMERO: lo ve por concatenación y partido en varias líneas (el texto no lo ve)', () => {
  const concatenado = censo(["export function titulo(q: { quoteNumber: number }) { return { title: 'Presupuesto #' + q.quoteNumber + ' enviado' }; }"]);
  assert.deepEqual(formas(concatenado), ['NUMERO:FUERA']);
  const partido = censo([
    'export function titulo(q: { quoteNumber: number | null; id: number }) {',
    '  return { subject: `Presupuesto #${',
    '    q.quoteNumber',
    '      ?? q.id',
    '  } enviado` };',
    '}',
  ]);
  assert.deepEqual(formas(partido), ['NUMERO:FUERA']);
});

test('SCRUM-1452 · NUMERO: en un `console.log` es DENTRO y no se acusa; por una variable es NO_DECIDIBLE y sí', () => {
  const log = censo(['export function f(q: { id: number }) { console.log(`[quotes] enviado #${q.id}`); }']);
  assert.deepEqual(formas(log), ['NUMERO:DENTRO']);
  assert.deepEqual(log.filas.filter(acusada), []);
  const variable = censo(['export function f(q: { id: number }) { const cuerpo = `Presupuesto #${q.id}`; return cuerpo; }']);
  assert.deepEqual(formas(variable), ['NUMERO:NO_DECIDIBLE']);
  assert.equal(variable.filas.filter(acusada).length, 1,
    '🔴 un destino que no se pudo decidir se ha dado por bueno: NO_DECIDIBLE se acusa igual que FUERA.');
});

test('SCRUM-1452 · NUMERO: una entidad HTML `&#${n};` no es el número de un documento', () => {
  const r = censo(['export const entidad = (n: number) => ({ html: `&#${n};` });']);
  assert.deepEqual(formas(r), []);
});

test('SCRUM-1452 · 🔴 IMPORTE: `toFixed(2)` con la moneda escrita o interpolada se acusa', () => {
  const escrita = censo(['export const linea = (t: number) => ({ text: `Total: ${t.toFixed(2)} €` });']);
  assert.deepEqual(formas(escrita), ['IMPORTE:FUERA']);
  const interpolada = censo(['export const linea = (t: number, inv: { currency: string }) => ({ text: `Total: ${Number(t).toFixed(2)} ${inv.currency}` });']);
  assert.deepEqual(formas(interpolada), ['IMPORTE:FUERA']);
  const lejos = censo(['export const linea = (a: number, b: number, cur: string) => ({ text: `Recibidos ${a.toFixed(2)} de ${b.toFixed(2)} ${cur}` });']);
  assert.deepEqual(formas(lejos), ['IMPORTE:FUERA', 'IMPORTE:FUERA'],
    '🔴 sólo acusa el importe que TOCA la moneda: en «Recibidos A de B EUR» los dos son importes.');
});

test('SCRUM-1452 · IMPORTE negativo derivado: con `formatMoneyEs`, y el `toFixed(2)` sin moneda, no se acusan', () => {
  const conHelper = censo(['export const linea = (t: number, cur: string) => ({ text: `Total: ${formatMoneyEs(t, cur)}` });']);
  assert.deepEqual(formas(conHelper), []);
  const xml = censo(['export const nodo = (t: number) => `<sum1:ImporteTotal>${t.toFixed(2)}</sum1:ImporteTotal>`;']);
  assert.deepEqual(formas(xml), []);
  assert.equal(xml.enTextoSinMoneda, 1, 'el `toFixed(2)` de un XML se CUENTA aparte, no desaparece.');
  const calculo = censo(['export const redondeo = (t: number) => Number(t.toFixed(2));']);
  assert.deepEqual(formas(calculo), []);
  assert.equal(calculo.sueltos, 1);
  const otrosDecimales = censo(['export const linea = (t: number) => ({ text: `${t.toFixed(1)} €` });']);
  assert.deepEqual(formas(otrosDecimales), []);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⑤ NO SE LEE A SÍ MISMO — un comentario y una cadena que EXPLICAN el patrón no son el patrón.
// (Un guard por texto casa con el comentario que lo describe; éste mira nodos.)
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1452 · un comentario que contiene el patrón no se acusa', () => {
  const r = censo([
    '// antes decía `Presupuesto #${q.id}` y `${t.toFixed(2)} €`: se retiró',
    '/* text: `Cobro #${charge.id}` · `${n.toFixed(2)} ${currency}` */',
    "export const ayuda = 'se escribe `#${id}` sólo en un log, y nunca `toFixed(2)` con la moneda';",
  ]);
  assert.deepEqual(r.filas, []);
  assert.equal(r.sueltos + r.enTextoSinMoneda, 0);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⑥ FAIL-CLOSED — lo que no se puede analizar se NOMBRA; lo que no tiene población, LANZA.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1452 · 🔴 un fuente que no parsea devuelve su error, no cero filas', () => {
  const r = censarFuente('src/roto.ts', 'export const x = { text: `Presupuesto #${q.id}` ;');
  assert.match(String(r.error), /no parsea \(src\/roto\.ts:1\)/);
});

test('SCRUM-1452 · 🔴 `censar` nombra el fichero que no pudo analizar, y sigue viendo los demás', () => {
  const dir = temporal('yaqu-1452-');
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'bueno.ts'), 'export const a = (q: { id: number }) => ({ text: `Presupuesto #${q.id}` });\n');
  fs.writeFileSync(path.join(dir, 'src', 'roto.ts'), 'export const b = { text: `Total ${t.toFixed(2)} €` ;\n');
  const r = censar(dir);
  assert.equal(r.ficheros, 2);
  assert.deepEqual(r.noAnalizables.map((x) => x.fichero), ['src/roto.ts']);
  assert.deepEqual(r.filas.map((f) => f.identidad), ['NUMERO|src/bueno.ts::a']);
  assert.deepEqual(comparar(r.filas, new Map(), new Map()).nuevas, ['NUMERO|src/bueno.ts::a (1)']);
});

test('SCRUM-1452 · 🔴 un árbol sin ficheros LANZA: cero ficheros es «no he mirado»', () => {
  const sinSrc = temporal('yaqu-1452-');
  assert.throws(() => censar(sinSrc), /CIEGO.*ni un fichero/s);
  const vacio = temporal('yaqu-1452-');
  fs.mkdirSync(path.join(vacio, 'src'));
  assert.throws(() => censar(vacio), /CIEGO.*ni un fichero/s);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⑦ LAS DOS MITADES DEL TRINQUETE, con una lista fabricada (no depende del árbol real).
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1452 · `comparar` distingue nuevo, sube, baja y resucitada', () => {
  const dos = censo([
    'export const a = (q: { id: number }) => ({ text: `Presupuesto #${q.id}`, title: `Cobro #${q.id}` });',
  ]).filas;
  const id = 'NUMERO|src/fabricado.ts::a';
  const con = (n) => new Map([[id, { n, clase: DEUDA, retira: 'S1', motivo: 'fabricado para el test' }]]);
  assert.deepEqual(comparar(dos, con(2), new Map()), { nuevas: [], suben: [], bajan: [], resucitadas: [] });
  assert.deepEqual(comparar(dos, new Map(), new Map()).nuevas, [`${id} (2)`]);
  assert.deepEqual(comparar(dos, con(1), new Map()).suben, [`${id}: declarados 1, hay 2`]);
  assert.deepEqual(comparar(dos, con(3), new Map()).bajan, [`${id}: declarados 3, hay 2`]);
  assert.deepEqual(comparar([], con(2), new Map()).bajan, [`${id}: declarados 2, hay 0`]);
  assert.deepEqual(comparar(dos, new Map(), new Map([[id, 'SCRUM-1452']])).resucitadas, [id]);
});

test('SCRUM-1452 · NO_DECIDIBLE existe como destino propio y se nombra', () => {
  assert.notEqual(NO_DECIDIBLE, FUERA);
  assert.ok(REAL.filas.some((f) => f.destino === NO_DECIDIBLE && f.sumidero.length > 0),
    'el censo real tiene destinos que no se pueden decidir, y cada uno dice qué lo consume.');
});
