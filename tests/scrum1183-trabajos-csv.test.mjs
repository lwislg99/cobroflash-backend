// tests/scrum1183-trabajos-csv.test.mjs — SCRUM-1183
//
// Sin gate: lee ficheros y monta Informes en el banco. Ni BD, ni red, ni servidor.
//
// `GET /admin/exports/jobs.csv` (SCRUM-25) existía y suelto no lo bajaba nadie: sólo salía dentro
// del paquete de «Descargar datos». Ahora Informes tiene «⬇ Trabajos CSV» al lado de los otros
// CSV. Lo que se vigila:
//   ① el botón está, con su rótulo firmado (c.19799) y apuntando a jobs.csv;
//   ② lleva el MISMO rango de año que «Presupuestos CSV», aunque NO sobre la misma fecha: trabajos
//     por fecha prevista (SCRUM-106), presupuestos por alta. Lo dice el test SCRUM-1183b, abajo;
//   ③ la ficha de la firma consta, por ticket y ranura (SCRUM-1306).
// (La pieza de operarios del mismo ticket está SUSTITUIDA por el hub de Equipo, c.17343: no se construye.)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { aprobacionesDeMicrocopy } from './_microcopy-aprobada.mjs';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rotulo = (n) => String(n._texto || n._html || '').trim();
const aRuta = (r, ruta) => todos(r.contenedor).filter((n) => n.tagName === 'A' && String(n.href || '').split('?')[0] === ruta);
const esperar = async () => { for (let i = 0; i < 6; i++) await new Promise((res) => setImmediate(res)); };

// El año de los enlaces lo pone `load()` al FINAL, tras pintar el P&L: sin un P&L con su forma real
// no llega, y el control de ceguera de abajo lo dice. Forma vacía, la de `scrum1049`.
const PL_VACIO = {
  months: Array.from({ length: 12 }, (_, i) => ({ label: String(i), revenue: 0, expenses: 0, profit: 0 })),
  totals: { revenue: 0, expenses: 0, profit: 0, maintenance: 0 },
  prevYear: { revenue: 0, expenses: 0, profit: 0 },
  currency: 'EUR',
  byEmployee: [],
};
const datos = (url) => (/\/admin\/reports\/pl\?/.test(String(url)) ? PL_VACIO : {});

async function informes() {
  const r = await pintarVista(cargarDashboard(RAIZ, { datos, rol: 'admin' }), 'renderReportsView');
  assert.equal(r.error, null, `🔴 NO PUDE MIRAR: Informes revienta al montarse: ${r.error && r.error.message}`);
  await esperar();
  return r;
}

test('SCRUM-1183 · Informes tiene «⬇ Trabajos CSV», UNO, apuntando a jobs.csv', async () => {
  const r = await informes();
  assert.equal(aRuta(r, '/admin/exports/quotes.csv').length, 1,
    '🔴 CIEGO: no está «Presupuestos CSV»; sin su hermano, lo de abajo no mide la fila de exportar.');
  const jobs = aRuta(r, '/admin/exports/jobs.csv');
  assert.equal(jobs.length, 1, '🔴 Informes no tiene (o tiene repetida) la descarga de trabajos.');
  assert.equal(rotulo(jobs[0]), '⬇ Trabajos CSV', '🔴 el rótulo no es el firmado en SCRUM-1183 c.19799.');
});

test('SCRUM-1183 · 🔴 «Trabajos CSV» lleva el MISMO rango de año que «Presupuestos CSV»', async () => {
  const r = await informes();
  const [quotes] = aRuta(r, '/admin/exports/quotes.csv');
  const [jobs] = aRuta(r, '/admin/exports/jobs.csv');
  const consulta = (n) => String(n.href).split('?')[1] || '';
  assert.match(consulta(quotes), /^from=\d{4}-01-01&to=\d{4}-12-31$/,
    '🔴 CIEGO: «Presupuestos CSV» no tiene aún su año; comparar con él no probaría nada.');
  assert.equal(consulta(jobs), consulta(quotes),
    '🔴 los trabajos se descargarían de otro periodo que los presupuestos del mismo año.');
});

// SCRUM-1183b · Este test decía que las dos rutas filtraban por `createdAt`, y lo «comprobaba»
// leyendo el `where` que exports.routes.ts construye y NO USA: el filtro que corre está en
// exportData.ts (`buildTrabajos` / `buildPresupuestos`). En yaqu.app, los dos trabajos sin agendar
// de la cuenta QA salían sin filtro y en NINGÚN año. Ahora se lee el campo que de verdad se pasa
// a `whereRango`, sin comentarios, y se dice lo que es: el mismo año, sobre fechas distintas.
test('SCRUM-1183b · el año de «Trabajos CSV» es la fecha PREVISTA; el de «Presupuestos CSV», el alta', () => {
  // Sin comentarios con el scanner de la casa (SCRUM-693/694), no con un regex propio.
  const src = soloCodigo(fs.readFileSync(path.join(RAIZ, 'src/modules/exports/domain/exportData.ts'), 'utf8'), 'exportData.ts');
  const campo = (fn) => {
    const i = src.indexOf(`export async function ${fn}(`);
    assert.ok(i !== -1, `🔴 CIEGO: no encuentro ${fn} en exportData.ts.`);
    const j = src.indexOf('export ', i + 1);
    const m = src.slice(i, j === -1 ? undefined : j).match(/whereRango\(\s*merchantId\s*,\s*rango\s*,\s*([^,)]+)/);
    assert.ok(m, `🔴 CIEGO: ${fn} ya no filtra con whereRango(merchantId, rango, <campo>).`);
    const arg = m[1].trim();
    if (/^'[^']+'$/.test(arg)) return arg.slice(1, -1);
    const c = src.match(new RegExp(`const ${arg}\\s*=\\s*'([^']+)'`));
    assert.ok(c, `🔴 CIEGO: no resuelvo ${arg} a un literal.`);
    return c[1];
  };
  assert.equal(campo('buildPresupuestos'), 'createdAt',
    '🔴 quotes.csv ya no filtra por fecha de alta: el comentario de reportsView.js y SCRUM-1183b mienten.');
  assert.equal(campo('buildTrabajos'), 'scheduledAt',
    '🔴 jobs.csv ya no filtra por fecha prevista (SCRUM-106): el comentario de reportsView.js y SCRUM-1183b mienten.');
});

test('SCRUM-1183 · la firma del rótulo consta en SU ficha de docs/microcopy/', () => {
  const ficha = aprobacionesDeMicrocopy().find((a) => a.ticket === 'SCRUM-1183' && a.ranura === 'trabajos-csv');
  assert.ok(ficha && ficha.aprobada, '🔴 no hay ficha firmada de SCRUM-1183 en docs/microcopy/.');
  assert.ok(ficha.literales.includes('Trabajos CSV'), '🔴 «Trabajos CSV» no está en la ficha de SCRUM-1183.');
});
