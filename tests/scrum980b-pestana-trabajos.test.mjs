// SCRUM-980 (segunda mitad) · LA PESTAÑA «TRABAJOS» Y LA «PRÓXIMA VISITA» EN LA FICHA DEL CLIENTE.
//
// Sin base de datos y en cada `npm test`: la ficha 360 REAL montada en el banco de vistas, con la
// respuesta de `/detail` y de `/historial` servidas por ruta, y midiendo el ESTADO DESPUÉS DE PULSAR
// (A6): la pestaña, sus filas, los enlaces a parte y albarán con sus fotos, «Ver más trabajos» y los
// partes sin trabajo. Y los negativos: sin próxima visita no hay línea, y si `/historial` falla la
// ficha sale como antes, sin la pestaña.
//
// Textos firmados por delegación: docs/microcopy/2026-09-21-SCRUM-980-historial-del-cliente.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const esperar = () => new Promise((r) => setTimeout(r, 20));

const DETAIL = {
  customer: { id: 7, name: 'Ana 980', phone: telefonoDePrueba(1), createdAt: '2025-01-01T00:00:00Z' },
  quotes: [], invoices: [], events: [],
  stats: { totalQuotes: 0, acceptedQuotes: 0, totalBilled: 0, totalPaid: 0, totalExpenses: 0, profit: 0 },
};
const PAGINA_1 = {
  proximaVisita: { trabajoId: 3, fecha: '2026-10-05T08:00:00Z' },
  trabajos: [{
    id: 1, titulo: 'Caldera <b>', estado: 'terminado', scheduledAt: '2026-03-01T09:00:00Z', createdAt: '2026-02-01T09:00:00Z',
    partes: [{ id: 5, numero: 'PT-2026-005', fecha: '2026-03-01T09:00:00Z', estado: 'firmado' }],
    albaranes: [{ id: 9, numero: 'ALB-2026-009', fecha: '2026-03-01T09:00:00Z', estado: 'firmado', fotos: 3 }],
  }],
  partesSueltos: [{ id: 6, numero: 'PT-2026-006', fecha: '2026-04-01T09:00:00Z', estado: 'borrador' }],
  siguiente: 1,
};
const PAGINA_2 = {
  trabajos: [{ id: 2, titulo: 'Grifo', estado: 'cerrado', scheduledAt: null, createdAt: '2025-06-01T09:00:00Z', partes: [], albaranes: [] }],
  partesSueltos: [],
};

function banco(historial) {
  return cargarDashboard(RAIZ, {
    datos: (url) => {
      if (/\/historial\?despuesDe=1$/.test(url)) return PAGINA_2;
      if (/\/historial$/.test(url)) {
        if (historial instanceof Error) throw historial;
        return historial;
      }
      if (/\/detail$/.test(url)) return DETAIL;
      return [];
    },
  });
}
// El texto de CADA nodo, no solo de las hojas: el botón del albarán lleva su número como texto
// propio y el «📷 n» en un hijo, y leyendo solo hojas el número se perdía.
const texto = (n) => todos(n).map((x) => x.textContent || '').join(' ');
const botones = (raiz) => todos(raiz).filter((n) => String(n.tagName || n.nodeName).toLowerCase() === 'button');
const boton = (raiz, re) => botones(raiz).find((b) => re.test(b.textContent || ''));

test('SCRUM-980 · los textos firmados, tal cual', () => {
  const b = banco(PAGINA_1);
  const H = b.ctx.historialCliente;
  assert.ok(H, 'la pieza no se publica en window');
  // Por JSON: la pieza vive en otro contexto `vm`, y sus arrays no comparten prototipo con los de aquí.
  assert.deepEqual(JSON.parse(JSON.stringify(H.TEXTOS)), {
    pestana: 'Trabajos', vacio: 'Sin trabajos', proxima: 'Próxima visita: ',
    columnas: ['Fecha', 'Trabajo', 'Estado', 'Documentos'], verMas: 'Ver más trabajos', sueltos: 'Partes sin trabajo',
  });
  assert.equal(H.tituloPestana(4, false), 'Trabajos (4)');
  assert.equal(H.tituloPestana(20, true), 'Trabajos (20+)');
  assert.equal(H.ariaFotos(1), '1 foto');
  assert.equal(H.ariaFotos(3), '3 fotos');
  assert.equal(H.fechaProxima(null), null);
  assert.equal(H.fechaProxima('no-es-fecha'), null);
  assert.match(H.fechaProxima('2026-10-05T08:00:00Z'), /oct 2026/);
});

test('SCRUM-980 · la ficha: próxima visita, pestaña, filas, enlaces, fotos, «Ver más» y partes sin trabajo', async () => {
  const b = banco(PAGINA_1);
  const r = await pintarVista(b, 'renderCustomer360View', 7);
  assert.equal(r.error, null, `la ficha no se monta: ${r.error}`);
  const raiz = r.contenedor;

  const proxima = todos(raiz).find((n) => String(n.className || '').includes('historial-proxima'));
  assert.ok(proxima, '🔴 hay próxima visita y la cabecera no la pinta');
  assert.match(proxima.textContent, /^Próxima visita: .*oct 2026/);

  const tab = boton(raiz, /^Trabajos \(/);
  assert.ok(tab, '🔴 no hay pestaña «Trabajos»');
  assert.equal(tab.textContent, 'Trabajos (1+)', 'con página siguiente, el «+»');
  // SUELO: las otras dos siguen ahí.
  assert.ok(boton(raiz, /^Presupuestos \(|^Cotizaciones \(/) && boton(raiz, /^Facturas \(/), 'SUELO: faltan las pestañas de siempre');

  tab.click();
  await esperar();
  const fila = todos(raiz).find((n) => n.dataset && n.dataset.trabajo === '1');
  assert.ok(fila, '🔴 al pulsar la pestaña no aparece la fila del trabajo');
  const t = texto(fila);
  // El título lleva marcado: tiene que salir como TEXTO y no crear un elemento. Se compara contra
  // el título del propio dato, sin escribir el marcado otra vez (SCRUM-553 cuenta esas etiquetas).
  assert.ok(t.includes(PAGINA_1.trabajos[0].titulo), 'el título sale como TEXTO (lo escribe el profesional)');
  assert.ok(todos(fila).every((n) => String(n.tagName || n.nodeName).toLowerCase() !== 'b'),
    '🔴 el título del trabajo se ha interpretado como marcado: creó un elemento en negrita en la fila');
  assert.ok(t.includes('Terminado'), 'el estado, con la etiqueta de jobStatusMeta');
  assert.ok(t.includes('PT-2026-005') && t.includes('ALB-2026-009'), '🔴 faltan los enlaces al parte o al albarán');
  const fotos = todos(fila).find((n) => String(n.className || '').includes('historial-fotos'));
  assert.ok(fotos && fotos.textContent.includes('📷 3'), '🔴 el albarán no enseña sus fotos');
  assert.equal(fotos.getAttribute('aria-label'), '3 fotos');
  assert.ok(texto(raiz).includes('Partes sin trabajo') && texto(raiz).includes('PT-2026-006'), '🔴 no salen los partes sin trabajo');

  // El enlace al parte abre su ficha. `appState` y `renderAppView` los pone el arranque de app.js,
  // que el banco no ejecuta: se dejan como en el producto y se mira A DÓNDE se navega.
  b.ctx.appState = {};
  const abiertas = [];
  b.ctx.renderAppView = (v) => abiertas.push(v);
  boton(fila, /PT-2026-005/).click();
  assert.equal(b.ctx.appState.parteId, 5, '🔴 el enlace al parte no abre SU parte');
  assert.deepEqual(abiertas, ['parte-detail']);
  boton(fila, /ALB-2026-009/).click();
  assert.equal(b.ctx.appState.albaranId, 9, '🔴 el enlace al albarán no abre SU albarán');
  assert.equal(abiertas[1], 'albaran-detail');

  // «Ver más trabajos» trae la página 2 y la pestaña deja de decir «+».
  const b2 = banco(PAGINA_1);
  const r2 = await pintarVista(b2, 'renderCustomer360View', 7);
  boton(r2.contenedor, /^Trabajos \(/).click();
  await esperar();
  const mas = boton(r2.contenedor, /^Ver más trabajos$/);
  assert.ok(mas, '🔴 hay más páginas y no se ofrece «Ver más trabajos»');
  mas.click();
  await esperar();
  assert.ok(todos(r2.contenedor).some((n) => n.dataset && n.dataset.trabajo === '2'), '🔴 «Ver más» no añade la página siguiente');
  assert.ok(todos(r2.contenedor).some((n) => n.dataset && n.dataset.trabajo === '1'), '🔴 «Ver más» ha borrado la primera página');
  assert.equal(boton(r2.contenedor, /^Trabajos \(/).textContent, 'Trabajos (2)');
  assert.equal(boton(r2.contenedor, /^Ver más trabajos$/), undefined, 'sin más páginas, el botón desaparece');
});

test('SCRUM-980 · NEGATIVOS: sin próxima visita no hay línea; sin trabajos, «Sin trabajos»; si /historial falla, la ficha sale igual', async () => {
  const sinNada = await pintarVista(banco({ trabajos: [], partesSueltos: [] }), 'renderCustomer360View', 7);
  assert.equal(sinNada.error, null);
  assert.equal(todos(sinNada.contenedor).find((n) => String(n.className || '').includes('historial-proxima')), undefined,
    '🔴 sin próxima visita se pinta la línea (ausente no es cero)');
  const tab = boton(sinNada.contenedor, /^Trabajos \(/);
  assert.equal(tab.textContent, 'Trabajos (0)');
  tab.click();
  await esperar();
  assert.ok(texto(sinNada.contenedor).includes('Sin trabajos'), '🔴 sin trabajos no se dice');

  const caido = await pintarVista(banco(new Error('500')), 'renderCustomer360View', 7);
  assert.equal(caido.error, null, `🔴 si /historial falla, la ficha entera se cae: ${caido.error}`);
  assert.ok(boton(caido.contenedor, /^Facturas \(/), 'SUELO: la ficha se ha pintado');
  assert.equal(boton(caido.contenedor, /^Trabajos \(/), undefined, 'sin historial no se ofrece una pestaña vacía que mienta');
});

test('SCRUM-980 · parte-detail está en DETALLES, con su aviso firmado y vuelta a Trabajos', () => {
  const app = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/app.js'), 'utf8');
  assert.match(app, /'parte-detail':\s*\{ clave: 'parteId',\s*lista: 'jobs',\s*ruta: \(id\) => '\/admin\/partes\/' \+ id,\s*aviso: 'Ese parte ya no existe\.' \}/,
    '🔴 parte-detail no está en DETALLES: recargar estando en un parte lo pierde');
});
