// tests/scrum1288b-el-importe-pegado-a-la-moneda.test.mjs — SCRUM-1288b
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA TERCERA FORMA DEL CENSO DEL GEMELO CRUDO (`scripts/_censo-gemelo-crudo.mjs`): SIN_FORMATEAR.
//
// SCRUM-1288 arregló siete avisos que decían «1234.50 EUR», y su punto 4 pedía que el octavo saliera
// en rojo. El trinquete de SCRUM-1452 (forma IMPORTE) ya caza `toFixed(2)` + moneda en `src/`. Lo
// que NO podía ver —medido el 9-oct-2026— es el importe que llega YA HECHO TEXTO por un parámetro:
// el `toFixed(2)` está en quien llama, en otro fichero, y el aviso sólo escribe `${total} ${currency}`.
// Había tres así, vivos, en los correos al profesional (`merchantNotifications.ts`).
//
// SIN_FORMATEAR mira desde el otro lado: busca la MONEDA y exige que el valor que lleva pegado salga
// de un formateador de importes de la casa. Entra en el mismo trinquete que NUMERO e IMPORTE
// (`tests/scrum1452-gemelo-crudo.test.mjs`); aquí van su suelo y sus fabricados.
//
// 🔴 SI TE SALE ROJO EL TRINQUETE POR UN SITIO NUEVO: `formatMoneyEs(valor, moneda)`. Si el importe
// te llega por un parámetro, que llegue el NÚMERO y se formatee donde se escribe la moneda.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  RAIZ, censar, censarFuente, comparar, acusada, porIdentidad,
  DECLARADOS, RETIRADAS, DEUDA, HELPERS_IMPORTE,
  IMPORTE, SIN_FORMATEAR,
} from '../scripts/_censo-gemelo-crudo.mjs';
import { temporal } from './_temporal.mjs';

const REAL = censar(RAIZ);

const censo = (lineas) => {
  const r = censarFuente('src/fabricado.ts', lineas.join('\n'));
  assert.equal(r.error, null, `el fabricado no parsea: ${r.error}`);
  return r;
};
const formas = (r) => r.filas.map((f) => `${f.forma}:${f.destino}`);

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① SUELO — sobre el árbol de verdad.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1288b · SUELO: el censo ve la forma en el árbol real, y ve los formateadores que la libran', () => {
  assert.ok(REAL.ficheros > 250, `🔴 población sospechosamente pequeña: ${REAL.ficheros} ficheros .ts en src/`);
  assert.deepEqual(REAL.noAnalizables, []);
  const vivas = REAL.filas.filter((f) => f.forma === SIN_FORMATEAR);
  assert.ok(vivas.length > 0 || [...RETIRADAS.keys()].some((id) => id.startsWith(`${SIN_FORMATEAR}|`)),
    '🔴 CIEGO: cero sitios SIN_FORMATEAR y ninguno declarado como retirado. El árbol los tenía el 9-oct-2026.');
  // El control del otro lado: los formateadores por los que se libra un sitio EXISTEN con ese nombre.
  // Si alguien renombra `formatMoneyEs`, la lista se queda apuntando a nada y todo sitio arreglado
  // saldría acusado; pero también al revés: un nombre que ya no existe no puede librar a nadie.
  const utils = fs.readFileSync(path.join(RAIZ, 'src', 'core', 'utils', 'utils.ts'), 'utf8');
  for (const nombre of ['formatMoneyEs', 'formatImporteEs']) {
    assert.ok(HELPERS_IMPORTE.has(nombre) && new RegExp(`export function ${nombre}\\b`).test(utils),
      `🔴 \`${nombre}\` ya no se exporta de src/core/utils/utils.ts con ese nombre: HELPERS_IMPORTE apunta a nada.`);
  }
});

test('SCRUM-1288b · los tres correos al profesional que motivaron la forma están VISTOS: vivos y declarados DEUDA, o retirados con su ticket', () => {
  const vivas = porIdentidad(REAL.filas);
  const LOS_TRES = [
    'SIN_FORMATEAR|src/modules/messaging/domain/merchantNotifications.ts::sendMerchantPaymentEmail',
    'SIN_FORMATEAR|src/modules/messaging/domain/merchantNotifications.ts::sendMerchantQuoteAcceptedEmail',
    'SIN_FORMATEAR|src/modules/messaging/domain/merchantNotifications.ts::sendTechQuoteApprovedEmail',
  ];
  for (const id of LOS_TRES) {
    if (RETIRADAS.has(id)) {
      assert.ok(!vivas.has(id), `🔴 ${id} está en RETIRADAS y sigue vivo.`);
      continue;
    }
    assert.ok(vivas.has(id), `🔴 el censo ha dejado de ver ${id}, y no está en RETIRADAS: o se arregló sin declararlo, o el censo se ha quedado ciego.`);
    assert.equal(DECLARADOS.get(id)?.clase, DEUDA, `🔴 ${id} lo lee el profesional: es DEUDA, no puede pasar a LEGITIMO.`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② FABRICADOS — positivos: cada camino por el que un importe llega crudo a su moneda.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1288b · 🔴 el importe que llega por un PARÁMETRO ya hecho texto se acusa (la forma de los tres correos)', () => {
  const r = censo([
    'export async function avisar(params: { amount: string; currency: string }) {',
    '  const { amount, currency } = params;',
    '  const subject = `Pago recibido: ${amount} ${currency}`;',
    '  return enviar({ subject, html: `<b>${amount} ${currency}</b>` });',
    '}',
  ]);
  assert.deepEqual(formas(r), ['SIN_FORMATEAR:NO_DECIDIBLE', 'SIN_FORMATEAR:FUERA']);
  assert.ok(r.filas.every(acusada));
});

test('SCRUM-1288b · 🔴 por una variable, con otros decimales, con la coma a mano, sin formato o con toLocaleString(): se acusan', () => {
  const casos = {
    'por una variable': ['export const f = (x: number) => { const t = x.toFixed(2); return { text: `Cobrado ${t} €` }; };'],
    'toFixed(0)': ['export const f = (x: number) => ({ text: `Cobrado ${x.toFixed(0)} €` });'],
    'la coma a mano': ["export const f = (x: number) => ({ text: 'Cobrado ' + x.toFixed(2).replace('.', ',') + ' €' });"],
    'el número tal cual': ['export const f = (x: number) => ({ text: `Cobrado ${x} EUR` });'],
    'toLocaleString() sin locale': ["export const f = (x: number) => ({ text: 'Cobrado ' + x.toLocaleString() + ' €' });"],
    'con «euros» escrito': ['export const f = (x: number) => ({ text: `Cobrado ${x} euros` });'],
    'moneda en variable, por suma': ["export const f = (x: number, currency: string) => ({ text: 'Cobrado ' + x + ' ' + currency });"],
    'pegado sin espacio': ['export const f = (x: number) => ({ text: `Cobrado ${x}€` });'],
    'con &nbsp;': ['export const f = (x: number) => ({ html: `<b>${x}&nbsp;€</b>` });'],
  };
  for (const [nombre, lineas] of Object.entries(casos)) {
    assert.deepEqual(formas(censo(lineas)), ['SIN_FORMATEAR:FUERA'], `🔴 no acusa: ${nombre}`);
  }
});

test('SCRUM-1288b · 🔴 una envoltura de escape no lava el valor: `${esc(total)} €` se acusa', () => {
  assert.deepEqual(formas(censo(['export const f = (total: string) => ({ html: `<b>${esc(total)} €</b>` });'])), ['SIN_FORMATEAR:FUERA']);
  assert.deepEqual(formas(censo(['export const f = (total: number) => ({ html: `<b>${String(total)} €</b>` });'])), ['SIN_FORMATEAR:FUERA']);
});

test('SCRUM-1288b · un `toFixed(2)` pegado a la moneda es UNA fila IMPORTE, no dos', () => {
  const r = censo(['export const f = (x: number, currency: string) => ({ text: `Cobrado ${x.toFixed(2)} ${currency}` });']);
  assert.deepEqual(formas(r), [`${IMPORTE}:FUERA`]);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ③ FABRICADOS — negativos DERIVADOS: el mismo texto, arreglado, por cada camino que libra.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1288b · con el formateador de la casa no se acusa: directo, por un `const`, envuelto en esc() y por las dos ramas de un ternario', () => {
  const casos = {
    directo: ['export const f = (x: number, currency: string) => ({ text: `Cobrado ${formatImporteEs(x)} ${currency}` });'],
    'por un const': ['export const f = (x: number) => { const t = fmtImporte(x); return { text: `Cobrado ${t} €` }; };'],
    'envuelto en esc()': ['export const f = (x: number) => ({ html: `<b>${esc(formatImporteEs(x))} €</b>` });'],
    'las dos ramas': ["export const f = (x: number | null) => ({ text: `Cobrado ${x === null ? '—' : formatImporteEs(x)} €` });"],
    'formatMoneyEs, que ya trae la moneda': ['export const f = (x: number, currency: string) => ({ text: `Cobrado ${formatMoneyEs(x, currency)}` });'],
  };
  for (const [nombre, lineas] of Object.entries(casos)) assert.deepEqual(formas(censo(lineas)), [], `acusa lo que está bien: ${nombre}`);
});

test('SCRUM-1288b · 🔴 a un formateador LOCAL no se le cree por el nombre: se mira su cuerpo', () => {
  const bueno = censo([
    'export function pdf(doc: any, total: number, currency: string) {',
    '  function fmt(v: number) { return fmtImporte(v); }',
    '  const money = (n: number) => formatMoneyEs(n, currency);',
    "  doc.text(fmt(total) + ' ' + currency);",
    '  doc.text(`${money(total)} €`);',
    '}',
  ]);
  assert.deepEqual(formas(bueno), [], 'un `fmt` y un `money` locales que SÓLO devuelven el formateador de la casa libran.');
  const malo = censo([
    'export function pdf(doc: any, total: number, currency: string) {',
    '  function fmt(v: number) { return v.toFixed(2); }',
    "  doc.text(fmt(total) + ' ' + currency);",
    '}',
  ]);
  assert.deepEqual(formas(malo), ['SIN_FORMATEAR:FUERA'], '🔴 un `fmt` local que devuelve `toFixed(2)` tiene nombre de formateador y no lo es.');
  const importado = censo(['export const f = (x: number) => ({ text: `Cobrado ${fmt(x)} €` });']);
  assert.deepEqual(formas(importado), ['SIN_FORMATEAR:FUERA'], '🔴 un `fmt` que no se declara a la vista no libra: no se sabe qué devuelve.');
});

test('SCRUM-1288b · 🔴 el `const` se sigue por ÁMBITO: un homónimo en otra función no lava, y un parámetro tapa al de fuera', () => {
  const homonimo = censo([
    'export const buena = (x: number) => { const total = formatImporteEs(x); return total; };',
    'export const mala = (total: string) => ({ text: `Cobrado ${total} €` });',
  ]);
  assert.deepEqual(formas(homonimo), ['SIN_FORMATEAR:FUERA'], '🔴 un `const total` formateado en OTRA función no dice nada del parámetro `total` de ésta.');
  const tapado = censo([
    'const total = formatImporteEs(1);',
    'export const mala = (total: string) => ({ text: `Cobrado ${total} €` });',
    'export const buena = () => ({ text: `Cobrado ${total} €` });',
  ]);
  assert.deepEqual(tapado.filas.map((f) => f.identidad), ['SIN_FORMATEAR|src/fabricado.ts::mala']);
  const conLet = censo(['export const f = (x: number) => { let t = formatImporteEs(x); t = String(x); return { text: `Cobrado ${t} €` }; };']);
  assert.deepEqual(formas(conLet), ['SIN_FORMATEAR:FUERA'], '🔴 un `let` puede haber cambiado antes de llegar al texto: no libra.');
});

test('SCRUM-1288b · lo que no es un importe pegado a una moneda no se acusa, y un registro interno es DENTRO', () => {
  const casos = {
    'la moneda dos veces': ['export const f = (currency: string) => ({ text: `${currency} ${currency}` });'],
    'el valor no toca la moneda': ['export const f = (n: number, x: string) => ({ text: `${n} líneas, total en EUR: ${x}` });'],
    'una palabra que empieza igual': ['export const f = (n: number) => ({ text: `${n} europeos` });'],
    'un comentario': ['// antes decía `${amount} ${currency}` y `${total} €`: se retiró', 'export const a = 1;'],
  };
  for (const [nombre, lineas] of Object.entries(casos)) assert.deepEqual(formas(censo(lineas)), [], `acusa lo que no es: ${nombre}`);
  const log = censo(['export const f = (x: number) => { console.log(`cobrado ${x} EUR`); };']);
  assert.deepEqual(formas(log), ['SIN_FORMATEAR:DENTRO']);
  assert.ok(!log.filas.some(acusada), 'un `console.log` no lo lee el profesional.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ④ DE EXTREMO A EXTREMO — un fichero NUEVO en un árbol: el trinquete lo da por nuevo.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1288b · 🔴 un aviso nuevo con el importe crudo, en un fichero nuevo de `src/`, sale como NUEVO en `comparar`', () => {
  const dir = temporal('yaqu-1288b-');
  fs.mkdirSync(path.join(dir, 'src', 'modules', 'avisos'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'modules', 'avisos', 'octavo.ts'),
    'export async function avisarOctavo(p: { total: string; currency: string; to: string }) {\n'
    + '  await sendWhatsAppText({ to: p.to, text: `Te han pagado ${p.total} ${p.currency}` });\n'
    + '}\n');
  fs.writeFileSync(path.join(dir, 'src', 'modules', 'avisos', 'bueno.ts'),
    'export async function avisarBien(p: { total: number; currency: string; to: string }) {\n'
    + '  await sendWhatsAppText({ to: p.to, text: `Te han pagado ${formatMoneyEs(p.total, p.currency)}` });\n'
    + '}\n');
  const r = censar(dir);
  assert.equal(r.ficheros, 2);
  assert.deepEqual(r.noAnalizables, []);
  assert.deepEqual(comparar(r.filas, new Map(), new Map()).nuevas, ['SIN_FORMATEAR|src/modules/avisos/octavo.ts::avisarOctavo (1)']);
  // Y contra la lista de verdad: no hay ninguna entrada que lo tape.
  assert.deepEqual(comparar(r.filas, DECLARADOS, RETIRADAS).nuevas, ['SIN_FORMATEAR|src/modules/avisos/octavo.ts::avisarOctavo (1)']);
});
