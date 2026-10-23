// SCRUM-1132 · LA TARJETA DE NOTAS EN LA FICHA DEL CLIENTE.
//
// Sin base de datos y en cada `npm test`: la ficha 360 REAL montada en el banco de vistas, con
// `/detail` y `/notes` servidas por ruta. El navegador de verdad, el clic y la ruta real los mide
// `npm run guard:notas-en-la-ficha`; aquí va lo que tiene que valer en CADA tanda:
//
//   · los cuatro textos de la pieza son los del registro de la firma (c.19617), carácter a carácter;
//   · la tarjeta pinta las notas con fecha y autor y NO repite la «Nota fija» (forma B: cabecera);
//   · al técnico no se le pinta ni se le piden las notas (las rutas son `requireRole('admin')`);
//   · el error dice «No se pudo guardar:» + el motivo del servidor SÓLO si viene en `message`.
//
// Textos firmados por el fundador: docs/microcopy/2026-10-14-SCRUM-1132-notas-del-cliente.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { aprobacionesDeMicrocopy } from './_microcopy-aprobada.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const esperar = () => new Promise((r) => setTimeout(r, 20));

/**
 * Los defectos que este test tiene que cazar (contrato del meta-guard, SCRUM-745). Los aplica
 * `npm run meta:mutaciones` contra este test y `docs/master/evidencias/SCRUM-1132/mutar.mjs`
 * contra `guard:notas-en-la-ficha`, en navegador.
 */
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'public/dashboard/js/customerDetailView.js', de: 'filter((n) => n && !n.esFija)', a: 'filter((n) => n)',
    cae: 'la tarjeta pinta las notas con fecha y autor, sin repetir la Nota fija' },
  { fichero: 'public/dashboard/js/customerDetailView.js', de: "      campo.value = '';\n", a: '',
    cae: 'el clic en «Añadir nota» manda el texto, vacía el campo y pinta la nota nueva' },
  { fichero: 'public/dashboard/js/customerDetailView.js', de: "{ method: 'POST', body: JSON.stringify({ texto: campo.value }) }", a: '{}',
    cae: 'el clic en «Añadir nota» manda el texto, vacía el campo y pinta la nota nueva' },
  { fichero: 'public/dashboard/js/customerDetailView.js', de: "window.mensajeParaPersona(err, '')", a: "(err && err.message) || ''",
    cae: 'el error: el motivo del servidor sólo si viene en `message`, nunca la tripa' },
  { fichero: 'public/dashboard/js/customerDetailView.js', de: "if (window.appUserRole === 'admin') {\n    const notasCard", a: "if (true) {\n    const notasCard",
    cae: 'al técnico ni se le pinta la tarjeta ni se le piden las notas' },
  { fichero: 'public/dashboard/js/customerDetailView.js', de: "boton.className = 'btn-secondary';", a: "boton.className = 'btn-secondary btn-sm';",
    cae: 'el clic en «Añadir nota» manda el texto, vacía el campo y pinta la nota nueva' },
];

const FIJA = 'Texto heredado de la cabecera';
const DETAIL = {
  customer: { id: 7, name: 'Ana 1132', notes: FIJA, createdAt: '2025-01-01T00:00:00Z' },
  quotes: [], invoices: [], events: [],
  stats: { totalQuotes: 0, acceptedQuotes: 0, totalBilled: 0, totalPaid: 0, totalExpenses: 0, profit: 0 },
};
const NOTAS = {
  notas: [
    { id: 2, texto: 'Trae repuesto de la marca de siempre', fecha: '2026-10-01T09:30:00Z', autor: 'Marta 1132', esFija: false },
    { id: 'fija', texto: FIJA, fecha: null, autor: null, esFija: true },
  ],
};

function banco({ rol = 'admin', notas = NOTAS } = {}) {
  const pedidas = [];
  const b = cargarDashboard(RAIZ, {
    rol,
    datos: (url) => {
      pedidas.push(url);
      if (/\/detail$/.test(url)) return DETAIL;
      if (/\/notes$/.test(url)) return notas;
      if (/\/historial$/.test(url)) return { trabajos: [], partesSueltos: [] };
      return [];
    },
  });
  return { b, pedidas };
}
const texto = (n) => todos(n).map((x) => x.textContent || '').join(' ');
const tarjeta = (raiz) => todos(raiz).find((n) => n.dataset && n.dataset.tarjeta === 'notas');

test('SCRUM-1132 · los cuatro textos son los del registro de la firma, carácter a carácter', () => {
  const registro = aprobacionesDeMicrocopy().find((a) => a.ticket === 'SCRUM-1132' && a.ranura === 'notas-del-cliente');
  assert.ok(registro, '🔴 no está el registro de la firma de SCRUM-1132 en docs/microcopy/');
  const { b } = banco();
  const T = JSON.parse(JSON.stringify(b.ctx.notasCliente.TEXTOS));
  assert.deepEqual(Object.values(T).sort(), [...registro.literales].sort(),
    '🔴 los textos de la tarjeta y los firmados no son los mismos: un texto que no está firmado no se pinta');
});

test('SCRUM-1132 · la tarjeta pinta las notas con fecha y autor, sin repetir la Nota fija', async () => {
  const { b, pedidas } = banco();
  const r = await pintarVista(b, 'renderCustomer360View', 7);
  assert.equal(r.error, null, `la ficha no se monta: ${r.error}`);
  await esperar();
  const t = tarjeta(r.contenedor);
  assert.ok(t, '🔴 la ficha no tiene tarjeta de notas');
  assert.ok(pedidas.some((u) => /\/admin\/customers\/7\/notes$/.test(u)), '🔴 la ficha no pide las notas');
  const T = b.ctx.notasCliente.TEXTOS;
  assert.ok(texto(t).includes(T.titulo) && texto(t).includes(T.boton), 'SUELO: la tarjeta lleva su título y su botón');
  const nota = todos(t).find((n) => n.dataset && n.dataset.nota === '2');
  assert.ok(nota, '🔴 la nota con fecha no se pinta');
  assert.ok(texto(nota).includes('Trae repuesto') && texto(nota).includes('Marta 1132') && /oct 2026/.test(texto(nota)),
    '🔴 la nota tiene que llevar texto, fecha y autor');
  assert.ok(!texto(t).includes(FIJA), '🔴 la tarjeta repite la Nota fija: la forma firmada (B) la deja sólo en la cabecera');
  assert.ok(texto(r.contenedor).includes(FIJA), 'SUELO: la Nota fija sigue en la cabecera');
  assert.ok(!texto(t).includes(T.vacio), 'con una nota no dice «Sin notas»');
});

test('SCRUM-1132 · sin notas con fecha, la tarjeta dice «Sin notas» (aunque haya Nota fija)', async () => {
  const { b } = banco({ notas: { notas: [NOTAS.notas[1]] } });
  const r = await pintarVista(b, 'renderCustomer360View', 7);
  await esperar();
  const t = tarjeta(r.contenedor);
  assert.ok(t, 'SUELO: hay tarjeta');
  assert.ok(texto(t).includes(b.ctx.notasCliente.TEXTOS.vacio), '🔴 sin notas con fecha no dice «Sin notas»');
});

test('SCRUM-1132 · el clic en «Añadir nota» manda el texto, vacía el campo y pinta la nota nueva', async () => {
  const lista = NOTAS.notas.slice();
  const posts = [];
  const b = cargarDashboard(RAIZ, {
    datos: (url, opts) => {
      if (/\/detail$/.test(url)) return DETAIL;
      if (/\/historial$/.test(url)) return { trabajos: [], partesSueltos: [] };
      if (/\/notes$/.test(url) && opts && opts.method === 'POST') {
        const { texto: t } = JSON.parse(opts.body);
        posts.push(t);
        const nueva = { id: 9, texto: t, fecha: '2026-10-23T08:00:00Z', autor: 'Marta 1132', esFija: false };
        lista.unshift(nueva);
        return nueva;
      }
      if (/\/notes$/.test(url)) return { notas: lista.slice() };
      return [];
    },
  });
  const r = await pintarVista(b, 'renderCustomer360View', 7);
  await esperar();
  const t = tarjeta(r.contenedor);
  assert.ok(t, 'SUELO: hay tarjeta');
  const campo = todos(t).find((n) => String(n.tagName || n.nodeName).toLowerCase() === 'textarea');
  const boton = todos(t).find((n) => String(n.tagName || n.nodeName).toLowerCase() === 'button');
  assert.ok(campo && boton, 'SUELO: la tarjeta tiene campo y botón');
  assert.equal(boton.textContent, b.ctx.notasCliente.TEXTOS.boton);
  // La variante pequeña se queda en 30 px también en móvil (DESIGN.md §5): ésta es la acción de la tarjeta.
  assert.ok(!/\bbtn-sm\b/.test(String(boton.className)), '🔴 el botón es `btn-sm`: 30 px de toque en móvil');
  campo.value = 'Llamar antes de subir';
  boton.click();
  await esperar();
  assert.deepEqual(posts, ['Llamar antes de subir'], '🔴 el clic no manda el texto escrito');
  assert.equal(campo.value, '', '🔴 tras guardar, el campo no se vacía');
  const nueva = todos(t).find((n) => n.dataset && n.dataset.nota === '9');
  assert.ok(nueva && texto(nueva).includes('Llamar antes de subir'), '🔴 la nota guardada no aparece en la tarjeta');
});

test('SCRUM-1132 · al técnico ni se le pinta la tarjeta ni se le piden las notas', async () => {
  const { b, pedidas } = banco({ rol: 'tecnico' });
  const r = await pintarVista(b, 'renderCustomer360View', 7);
  await esperar();
  assert.ok(pedidas.some((u) => /\/detail$/.test(u)), 'SUELO: la ficha del técnico se ha pedido');
  assert.equal(tarjeta(r.contenedor), undefined, '🔴 al técnico se le pinta la tarjeta: las rutas son requireRole(admin)');
  assert.ok(!pedidas.some((u) => /\/notes$/.test(u)), '🔴 la ficha del técnico pide /notes (sería un 403)');
});

test('SCRUM-1132 · el error: el motivo del servidor sólo si viene en `message`, nunca la tripa', () => {
  const { b } = banco();
  const N = b.ctx.notasCliente;
  const conMotivo = { data: { error: 'nota_vacia', message: 'Escribe algo antes de guardar la nota.' }, message: 'Escribe algo antes de guardar la nota.' };
  assert.equal(N.textoDelError(conMotivo), N.TEXTOS.error + ' Escribe algo antes de guardar la nota.');
  const sinMotivo = { data: { error: 'internal_error' }, message: 'API 500: internal_error' };
  // SUELO: el error SÍ trae la tripa (lo que compone `_pedir` sin `message`); si no la trajera, la
  // negación de abajo saldría verde sin mirar nada.
  assert.ok(/API|internal_error/.test(sinMotivo.message), 'SUELO: el error de prueba trae el código interno');
  assert.ok(!/API|internal_error/.test(N.textoDelError(sinMotivo)), '🔴 un 500 sin message enseña el código interno');
  assert.ok(N.textoDelError(sinMotivo).startsWith(N.TEXTOS.error));
  const sinRed = { sinRed: true, message: 'Failed to fetch' };
  assert.ok(!/Failed to fetch/.test(N.textoDelError(sinRed)), '🔴 sin red enseña el error del navegador');
});
