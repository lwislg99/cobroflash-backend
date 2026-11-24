// tests/scrum1578-movil-en-export-clientes.test.mjs — SCRUM-1578
//
// 🔴 EL EXPORT DE CLIENTES TIRABA EL MÓVIL. La consulta lo traía (findMany sin select) y
// `clienteRow` lo descartaba al montar la fila. Desde SCRUM-590 el móvil y el fijo son dos
// campos, así que quien tenía sólo móvil salía del export SIN TELÉFONO.
//
// ── LOS DOS USOS ─────────────────────────────────────────────────────────────────────────
// La cabecera y la fila de clientes son UNA, compartida por:
//   · `buildClientes`              → GET /admin/exports/customers.csv (el SUELTO), y
//   · `buildClientesReferenciados` → el clientes.csv del PAQUETE ZIP.
// La divergencia de SCRUM-104 entre ambos es de FILTRO (qué clientes entran), y este test NO
// la toca: dobla la consulta y mira sólo la FORMA del CSV que sale. Por eso los tres controles
// se corren sobre LOS DOS — una columna añadida a uno solo sería el defecto.
//
// ── LOS CONTROLES ────────────────────────────────────────────────────────────────────────
//   ① un cliente CON móvil sale con él, bajo «Móvil», en los dos sitios;
//   ② uno SIN móvil (null, o el campo ausente) no gana `undefined`/`null` ni descoloca nada;
//   ③ 🔴 se CUENTAN las celdas de la cabecera y las de cada fila y se COMPARAN, y además cada
//      celda se lee por el NOMBRE de su columna: el desplazamiento silencioso del CSV (cada dato
//      bajo el rótulo de al lado) es lo que un `includes(móvil)` no vería nunca.
// El CSV se relee con el parser del IMPORTADOR (`trocearCsv`), que honra comillas: una nota con
// `;` no puede pasar por una columna de más.
//
// ── EL BANCO ─────────────────────────────────────────────────────────────────────────────
// `dist/` real con `prisma.customer.findMany` doblado (la forma de SCRUM-1483). El doble EVALÚA
// `merchantId` y el `id.in` de los referenciados: lo que no sabe evaluar LANZA, no contesta.
import test from 'node:test';
import assert from 'node:assert/strict';

const { prisma } = await import('../dist/core/db/prisma.js');
const { buildClientes, buildClientesReferenciados, csvBody } =
  await import('../dist/modules/exports/domain/exportData.js');
const { trocearCsv } = await import('../dist/core/csv/csv.js');
const { ETIQUETA_CAMPO } = await import('../dist/modules/system/domain/importarClientes.service.js');

const MIO = 77; // no es el 1: el 1 es el demo
const ALTA = new Date('2026-07-15T10:00:00Z');

const CON_MOVIL = {
  id: 501, merchantId: MIO, name: 'CON-MOVIL', legalName: 'Con Móvil SL', taxId: 'B12345678',
  phone: '910000001', mobile: '612000001', email: 'con@movil.test',
  // `;` y comillas dentro: si la fila no se escapara bien, aquí saldría una celda de más.
  notes: 'portal 3; llamar "antes" de las 9', waOptOut: false, createdAt: ALTA,
};
const SIN_MOVIL_NULL = {
  id: 502, merchantId: MIO, name: 'SIN-MOVIL-NULL', legalName: null, taxId: null,
  phone: '910000002', mobile: null, email: null, notes: null, waOptOut: true, createdAt: ALTA,
};
// El campo AUSENTE (no null): una fila montada de un objeto sin `mobile` tampoco puede escribir «undefined».
const { mobile: _fuera, ...SIN_MOVIL_AUSENTE } = { ...SIN_MOVIL_NULL, id: 503, name: 'SIN-MOVIL-AUSENTE' };
const AJENO = { ...CON_MOVIL, id: 999, merchantId: 1, name: 'AJENO', mobile: '699999999' };
const TABLA = [CON_MOVIL, SIN_MOVIL_NULL, SIN_MOVIL_AUSENTE, AJENO];

function casa(fila, where) {
  for (const [clave, pide] of Object.entries(where ?? {})) {
    if (clave === 'merchantId') { if (fila.merchantId !== pide) return false; }
    else if (clave === 'id' && Array.isArray(pide?.in)) { if (!pide.in.includes(fila.id)) return false; }
    else if (clave === 'createdAt') { /* el rango no es lo que se mide aquí: entra todo */ }
    else throw new Error(`🔴 DOBLE CIEGO: no sé evaluar la clave \`${clave}\` del where — amplía el doble, no la ignores`);
  }
  return true;
}

async function conTabla(fn) {
  const original = prisma.customer.findMany;
  prisma.customer.findMany = async (args) => {
    // Lo firmado: SIN tocar la consulta. Si un día lleva `select`, el móvil podría no venir y
    // este test, al doblarla, no lo vería — así que lo dice en vez de pasar en verde.
    assert.equal(args.select, undefined, '🔴 CIEGO: la consulta de clientes ahora lleva `select`; el doble no la representa');
    return TABLA.filter((f) => casa(f, args.where));
  };
  try { return await fn(); } finally { prisma.customer.findMany = original; }
}

const USOS = {
  'CSV suelto (buildClientes)': () => buildClientes(MIO, { from: undefined, to: undefined }),
  'clientes.csv del ZIP (buildClientesReferenciados)': () => buildClientesReferenciados(MIO, [501, 502, 503]),
};

/** El CSV tal cual sale (con BOM y \r\n), releído con el parser del importador. */
async function leer(uso) {
  const data = await conTabla(USOS[uso]);
  const texto = csvBody(data);
  const { cabecera, filas } = trocearCsv(texto);
  return { texto, cabecera, filas };
}

const fila = (filas, cabecera, nombre) => {
  const f = filas.find((r) => r[cabecera.indexOf('Nombre')] === nombre);
  assert.ok(f, `🔴 CIEGO: no encuentro la fila de ${nombre}`);
  return Object.fromEntries(cabecera.map((col, i) => [col, f[i]]));
};

test('SCRUM-1578: el rótulo es el del importador, no uno inventado', () => {
  assert.equal(ETIQUETA_CAMPO.mobile, 'Móvil', '🔴 CIEGO: el rótulo de referencia del importador ha cambiado; revisa la cabecera del export');
});

for (const uso of Object.keys(USOS)) {
  test(`SCRUM-1578 · ${uso}: ③ cabecera y CADA fila tienen las mismas celdas`, async () => {
    const { cabecera, filas } = await leer(uso);
    assert.equal(filas.length, 3, `🔴 CIEGO: esperaba los 3 clientes de MIO (el ajeno fuera), salen ${filas.length}`);
    for (const f of filas) {
      assert.equal(f.length, cabecera.length,
        `🔴 DESPLAZAMIENTO: la cabecera tiene ${cabecera.length} columnas y la fila ${f.length}:\n  ${cabecera.join(' | ')}\n  ${f.join(' | ')}`);
    }
  });

  test(`SCRUM-1578 · ${uso}: ① el móvil sale bajo «Móvil», junto a «Teléfono»`, async () => {
    const { cabecera, filas } = await leer(uso);
    const iTel = cabecera.indexOf('Teléfono');
    const iMov = cabecera.indexOf(ETIQUETA_CAMPO.mobile);
    assert.ok(iMov >= 0, `🔴 falta la columna «Móvil»: ${cabecera.join(' | ')}`);
    assert.equal(cabecera.filter((c) => c === 'Móvil').length, 1, 'una sola columna «Móvil»');
    assert.equal(iMov, iTel + 1, `«Móvil» va justo después de «Teléfono» (decisión del orquestador): ${cabecera.join(' | ')}`);

    // Cada celda por el NOMBRE de su columna: si el móvil se colara en otra posición, «Teléfono»
    // o «Email» dejarían de tener su valor y esto lo diría.
    const c = fila(filas, cabecera, 'CON-MOVIL');
    assert.equal(c['Teléfono'], CON_MOVIL.phone, 'el fijo sigue en «Teléfono»');
    assert.equal(c['Móvil'], CON_MOVIL.mobile, 'el móvil en «Móvil»');
    assert.equal(c['Email'], CON_MOVIL.email, '«Email» no se ha corrido');
    assert.equal(c['Notas'], CON_MOVIL.notes, 'la nota con `;` y comillas vuelve entera');
    assert.equal(c['Baja WhatsApp'], 'No');
    assert.equal(c['Fecha de alta'], '2026-07-15', 'la última columna sigue siendo la fecha de alta');
  });

  test(`SCRUM-1578 · ${uso}: ② sin móvil la celda va vacía, sin «undefined» ni «null»`, async () => {
    const { texto, cabecera, filas } = await leer(uso);
    for (const nombre of ['SIN-MOVIL-NULL', 'SIN-MOVIL-AUSENTE']) {
      const c = fila(filas, cabecera, nombre);
      assert.equal(c['Móvil'], '', `${nombre}: «Móvil» vacío`);
      assert.equal(c['Teléfono'], SIN_MOVIL_NULL.phone, `${nombre}: el fijo no se mueve`);
      assert.equal(c['Baja WhatsApp'], 'Sí', `${nombre}: «Baja WhatsApp» no se ha corrido`);
      assert.equal(c['Fecha de alta'], '2026-07-15', `${nombre}: la fecha de alta en su sitio`);
    }
    assert.ok(!/undefined|null/.test(texto), `🔴 el CSV escribe «undefined»/«null»:\n${texto}`);
  });
}

test('SCRUM-1578: los dos usos llevan EXACTAMENTE la misma cabecera', async () => {
  // En serie, no Promise.all: dos dobles a la vez se restaurarían cruzados.
  const [ua, ub] = Object.keys(USOS);
  const a = await leer(ua);
  const b = await leer(ub);
  assert.deepEqual(a.cabecera, b.cabecera, 'la cabecera es UNA (SCRUM-104 diverge en el filtro, no en las columnas)');
});
