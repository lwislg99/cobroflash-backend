// tests/scrum1183-trabajos-csv.test.mjs — SCRUM-1183
//
// Sin gate: lee ficheros y monta Informes en el banco. Ni BD, ni red, ni servidor.
//
// `GET /admin/exports/jobs.csv` (SCRUM-25) existía y suelto no lo bajaba nadie: sólo salía dentro
// del paquete de «Descargar datos». Ahora Informes tiene «⬇ Trabajos CSV» al lado de los otros
// CSV. Lo que se vigila:
//   ① el botón está, con su rótulo firmado (c.19799) y apuntando a jobs.csv;
//   ② lleva el MISMO rango de año que «Presupuestos CSV»: las dos rutas filtran por `createdAt`
//     con from/to (`exports.routes.ts`), así que un año distinto sería un fichero de otro periodo;
//   ③ la ficha de la firma consta, por ticket y ranura (SCRUM-1306).
// (La pieza de operarios del mismo ticket está SUSTITUIDA por el hub de Equipo, c.17343: no se construye.)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { aprobacionesDeMicrocopy } from './_microcopy-aprobada.mjs';

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

test('SCRUM-1183 · las dos rutas filtran por la MISMA fecha, que es lo que hace válido el mismo año', () => {
  const src = fs.readFileSync(path.join(RAIZ, 'src/modules/exports/app/routes/exports.routes.ts'), 'utf8');
  const cuerpo = (ruta) => {
    const i = src.indexOf(`router.get('${ruta}'`);
    assert.ok(i !== -1, `🔴 CIEGO: no encuentro ${ruta} en exports.routes.ts.`);
    const j = src.indexOf('router.get(', i + 1);
    return src.slice(i, j === -1 ? undefined : j);
  };
  for (const ruta of ['/jobs.csv', '/quotes.csv']) {
    assert.match(cuerpo(ruta), /where\.createdAt\.gte = from/, `🔴 ${ruta} ya no filtra por createdAt: el año del botón diría otra cosa.`);
  }
});

test('SCRUM-1183 · la firma del rótulo consta en SU ficha de docs/microcopy/', () => {
  const ficha = aprobacionesDeMicrocopy().find((a) => a.ticket === 'SCRUM-1183' && a.ranura === 'trabajos-csv');
  assert.ok(ficha && ficha.aprobada, '🔴 no hay ficha firmada de SCRUM-1183 en docs/microcopy/.');
  assert.ok(ficha.literales.includes('Trabajos CSV'), '🔴 «Trabajos CSV» no está en la ficha de SCRUM-1183.');
});
