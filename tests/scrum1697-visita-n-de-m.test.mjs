// SCRUM-1697 (T4 de la ③ de SCRUM-1686) · «VISITA {n} DE {m}» EN LA CABECERA DEL PARTE.
//
// M2 del máster (073c67ade, SCRUM-1686 c.21479): un trabajo, varios partes, uno por visita; «la
// visita ES su parte». «Visita {n} de {m}» (N4) cuenta los partes del trabajo por `fecha` y, a igual
// fecha, por `numero`; `m` = todos los partes del trabajo, también los borradores.
// Texto FIRMADO: N4 de la tanda N1-N13 de SCRUM-1686 (c.21471 según el máster) — «Visita {n} de {m}»,
// cabecera del parte, con varios en el trabajo.
//
// Desde SCRUM-1697 (b) el recuento lo hace el SERVIDOR (`visitaDelParte.ts`, fijado en
// `scrum1697b-visita-en-el-servidor.test.mjs`): GET /admin/partes/:id trae `visitaN`/`visitaM`. La
// pantalla ya no lee el trabajo. Lo que se fija AQUÍ es lo que queda en la pantalla:
//   ① pinta lo que manda el servidor, con el texto firmado, tras el número del parte, y NO pide nada;
//   ② con un solo parte en el trabajo no se dice nada (N4 es «con varios»): el servidor dice 1 de 1;
//   ③ falla cerrado: sin los números, con uno que no es un entero positivo o con n > m, sin número.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const BASE = Object.freeze({
  id: 17, numero: 'PT-2026-009', clienteNombre: 'Cliente de pruebas', jobId: 77,
  fecha: '2026-11-11T08:00:00.000Z', obra: null, referencia: null,
  entrada: '09:10', salida: '11:40', desplazamientos: 1, kilometros: 8,
  tecnicos: [], tipo: null,
  lineas: [{ bloque: 'mano_obra', unds: 1, descripcion: 'Revisión' }],
  notas: null, estado: 'firmado', firmoElCliente: true, firmoElTecnico: false,
  puedeEditarContenido: { ok: false, motivo: 'firmado' }, puedeEditarPrecios: { ok: true, motivo: null },
  visitaN: 3, visitaM: 4,
});

const attr = (n, a) => (n.getAttribute ? n.getAttribute(a) : null);
const texto = (n) => todos(n).map((x) => x._texto || '').join('').replace(/\s+/g, ' ').trim();
const visitaEn = (c) => {
  const n = todos(c).find((x) => attr(x, 'data-parte-visita') === '1');
  return n ? texto(n) : null;
};

// Pinta el parte y la visita como lo hace la ficha; devuelve lo que dice la cabecera y lo que se pidió.
async function cabecera(parte) {
  const b = cargarDashboard(RAIZ);
  const c = b.mk('div');
  assert.equal(b.ctx.renderParte(c, parte), true, '🔴 SUELO: la vista se negó a pintar');
  assert.equal(visitaEn(c), '', 'antes de pintar la visita la cabecera no lleva número');
  const pedidas = [];
  const pedir = async (ruta) => { pedidas.push(ruta); return {}; };
  await b.ctx.partePintarVisita(c, parte, pedir);
  return { visita: visitaEn(c), pedidas };
}

test('SCRUM-1697 · el texto es el firmado (N4), literal', () => {
  const b = cargarDashboard(RAIZ);
  assert.equal(b.ctx.PARTE_TEXTOS.visitaDeLas, 'Visita {n} de {m}');
});

test('SCRUM-1697 ① la cabecera dice «· Visita n de m» con lo que trae el parte, sin leer el trabajo', async () => {
  const { visita, pedidas } = await cabecera(BASE);
  assert.equal(visita, '· Visita 3 de 4');
  assert.deepEqual(pedidas, [], '🔴 la pantalla no pide nada: ni /admin/jobs/:id (guard de SCRUM-366) ni otra cosa');
});

test('SCRUM-1697 ①bis la FICHA entera, al abrirse, solo pide el parte y pinta la visita que trae', async () => {
  const b = cargarDashboard(RAIZ);
  const c = b.mk('div');
  const pedidas = [];
  const apiRequest = async (ruta, o = {}) => {
    pedidas.push(`${(o.method || 'GET').toUpperCase()} ${ruta}`);
    if (ruta === '/admin/partes/17' && !o.method) return { ...BASE };
    throw new Error('ruta no esperada: ' + ruta);
  };
  assert.equal(await b.ctx.renderParteDetailView(c, 17, { apiRequest }), true, '🔴 SUELO: la ficha no se pintó');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(visitaEn(c), '· Visita 3 de 4');
  assert.deepEqual(pedidas.filter((p) => p.startsWith('GET ')), ['GET /admin/partes/17'],
    '🔴 la ficha del parte no lee el trabajo: la visita viene en su propio GET (contrato de SCRUM-1697 (b))');
});

test('SCRUM-1697 ② con un solo parte en el trabajo no se dice «Visita 1 de 1»', async () => {
  assert.equal((await cabecera({ ...BASE, visitaN: 1, visitaM: 1 })).visita, '');
  assert.equal((await cabecera({ ...BASE, visitaN: 1, visitaM: 2 })).visita, '· Visita 1 de 2', '🔴 SUELO: con dos, sí');
});

test('SCRUM-1697 ③ falla cerrado: sin los números, con basura o con n > m, la cabecera se queda sin número', async () => {
  const casos = [
    { visitaN: null, visitaM: null },           // el servidor no lo encontró en la lista, o el parte no tiene trabajo
    { visitaN: undefined, visitaM: undefined }, // un servidor de antes de la (b)
    { visitaN: 3, visitaM: null },
    { visitaN: '3', visitaM: '4' },
    { visitaN: 0, visitaM: 4 },
    { visitaN: 2.5, visitaM: 4 },
    { visitaN: 5, visitaM: 4 },
  ];
  for (const v of casos) {
    const { visita, pedidas } = await cabecera({ ...BASE, ...v });
    assert.equal(visita, '', `con ${JSON.stringify(v)} no se pone un número`);
    assert.deepEqual(pedidas, []);
  }
});
