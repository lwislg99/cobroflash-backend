// SCRUM-363 · «PAGADO» DEJA DE SER INALCANZABLE, Y «PARCIAL» DEJA DE MENTIR.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO
//
// `estadoCobroFor(cobrado, aceptado)` hacía: `if (a > 0 && c >= a) 'Pagado'; if (c > 0) 'Parcial'`.
// Con `totalAceptado` **null o 0**, un Trabajo cobrado se quedaba en «Parcial» PARA SIEMPRE: el
// pro cobraba, el dinero entraba, y el Trabajo seguía diciendo que faltaba. La pestaña «Pagado»
// no lo enseñaba nunca, así que perseguía un pago que ya tenía. **Nadie veía un error.**
//
// Y no es un caso raro: es el camino NUEVO. En staging ya hay 5 de 8 Trabajos sin presupuesto
// (SCRUM-51), y la factura suelta de A0 los multiplica.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA DECISIÓN (fundador): el importe de referencia, en este orden
//
//   1. el total ACEPTADO, si existe y es > 0;
//   2. si no, el total FACTURADO, si existe y es > 0;
//   3. si no hay ninguno → **el Trabajo NO TIENE EJE DE COBRO**: no se pinta chip. Nada.
//
// El paso 3 es el que importa. «Parcial» es una AFIRMACIÓN sobre el dinero de alguien: no pintar
// nada es verdad, pintar «Parcial» no lo es.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';
const { estadoCobroFor, importeDeReferencia } = await import(DIST + 'modules/jobs/domain/job.service.js');
const leer = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');

// ═════════════════════════════════════════════════════════════════════════════════════════
// 1 · LOS DOS CASOS QUE SE ESCAPABAN — y son DOS, no uno
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-363 · totalAceptado NULL + cobro que lo cubre → NO se queda en Parcial', () => {
  // El caso del enunciado: Trabajo sin presupuesto, factura de 100, cobrados 100.
  const estado = estadoCobroFor(100, null, 100);
  assert.notEqual(
    estado, 'Parcial',
    '🔴 SIGUE ATRAPADO EN PARCIAL. El pro ha cobrado el trabajo entero y la app le dice que falta; ' +
      'la pestaña «Pagado» no lo enseña nunca, así que persigue un pago que ya tiene.',
  );
  assert.equal(estado, 'Pagado');
});

test('SCRUM-363 · totalAceptado CERO + cobro que lo cubre → tampoco', () => {
  // 🔑 ES UN TEST APARTE Y NO UN CASO MÁS DEL ANTERIOR. `0` se cuela por las comprobaciones de
  // nulos (`!= null` lo deja pasar, `??` no lo sustituye) y llega al cálculo como un importe
  // legítimo. Un solo test con `null` habría dado verde con el defecto vivo para el `0`.
  const estado = estadoCobroFor(100, 0, 100);
  assert.notEqual(estado, 'Parcial', '🔴 el CERO se cuela por las comprobaciones de nulos');
  assert.equal(estado, 'Pagado');
});

test('SCRUM-363 · el orden del importe de referencia es el decidido', () => {
  assert.equal(importeDeReferencia(200, 100), 200, 'manda el ACEPTADO cuando existe');
  assert.equal(importeDeReferencia(0, 100), 100, 'sin aceptado, el FACTURADO');
  assert.equal(importeDeReferencia(null, 100), 100);
  assert.equal(importeDeReferencia(0, 0), null, 'sin ninguno, NO hay eje');
  assert.equal(importeDeReferencia(null, null), null);
  assert.equal(importeDeReferencia(undefined, undefined), null);
  // Negativos y basura tampoco son un eje: un importe de referencia que no se puede comparar
  // no es un importe de referencia.
  assert.equal(importeDeReferencia(-50, null), null);
  assert.equal(importeDeReferencia('mucho', null), null);
  assert.equal(importeDeReferencia(NaN, Infinity), null);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 2 · EL SUELO · ante la duda NO se devuelve el estado intermedio
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-363 · SUELO: sin importe de referencia NO se devuelve «Parcial» ni «Pendiente»', () => {
  // Devolver el estado intermedio ante la duda es EXACTAMENTE lo que produjo este defecto.
  for (const [cobrado, aceptado, facturado, caso] of [
    [100, null, null, 'cobrado sin ninguna referencia'],
    [100, 0, 0, 'cobrado con las dos a cero'],
    [0, null, null, 'sin cobrar y sin referencia'],
    [50, undefined, undefined, 'referencias ausentes'],
    [50, 'x', {}, 'referencias que no son números'],
  ]) {
    const estado = estadoCobroFor(cobrado, aceptado, facturado);
    assert.equal(
      estado, null,
      `🔴 con ${caso} devuelve «${estado}» en vez de nada. Un Trabajo sin eje de cobro no admite ` +
        'NINGUNA afirmación sobre su dinero: no pintar es verdad, «Parcial» no lo es.',
    );
  }
});

test('SCRUM-363 · CONTROL: con eje, los tres estados siguen saliendo', () => {
  // Sin esto, «devolver null siempre» pasaría el suelo y rompería el semáforo entero.
  assert.equal(estadoCobroFor(0, 100), 'Pendiente');
  assert.equal(estadoCobroFor(40, 100), 'Parcial');
  assert.equal(estadoCobroFor(100, 100), 'Pagado');
  assert.equal(estadoCobroFor(150, 100), 'Pagado', 'cobrar de más sigue siendo pagado');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 3 · ARRASTRE · listado y detalle ven el MISMO estado
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-363 · el detalle DELEGA en el serializer del listado: no puede divergir', () => {
  const rutas = leer('src', 'modules', 'jobs', 'app', 'routes', 'jobs.routes.ts');
  assert.match(rutas, /async function serializeJobDetail\(job: any\) \{\s*\n\s*const base = await serializeJob\(job\);/,
    '🔴 el detalle ha dejado de derivar del serializer del listado: entonces el estado se calcula ' +
    'en dos sitios y el defecto puede volver en uno solo');
  // Y el estado se calcula UNA vez.
  const veces = (rutas.match(/estadoCobroFor\(/g) || []).length;
  assert.equal(veces, 1, `🔴 hay ${veces} cálculos del estado de cobro: uno es el contrato, dos son una divergencia`);
});

test('SCRUM-363 · la lista NO decide el eje por su cuenta', () => {
  // 🔑 La divergencia que este arreglo podía INTRODUCIR: el listado gateaba el chip con
  // `aceptado > 0`, un segundo criterio. En cuanto el eje puede venir de lo facturado, el mismo
  // Trabajo saldría «Pagado» en el detalle y sin chip en la lista.
  const lista = leer('public', 'dashboard', 'js', 'jobsView.js');
  const codigo = lista.replace(/^\s*\/\/.*$/gm, ''); // sin comentarios: el guard no se caza a sí mismo
  assert.match(codigo, /const showCobro = !!j\.estadoCobro/,
    '🔴 la lista vuelve a decidir por su cuenta si hay eje de cobro');
  assert.doesNotMatch(codigo, /const showCobro = aceptado > 0/,
    '🔴 ha vuelto el criterio propio del listado');
  assert.match(leer('src', 'modules', 'jobs', 'app', 'routes', 'jobs.routes.ts'), /importeReferencia: importeDeReferencia\(/,
    '🔴 el backend no manda el eje, así que la interfaz no tiene más remedio que derivarlo');
});

test('SCRUM-363 · sin eje, el detalle no pinta chip (ni vacío ni «null»)', () => {
  const detalle = leer('public', 'dashboard', 'js', 'jobDetailView.js');
  assert.match(
    detalle, /job\.estadoCobro \? `<span class="status-pill \$\{cobroCls\}">/,
    '🔴 el detalle pinta el chip incondicionalmente: con estado nulo saldría un pill vacío, que es ' +
    'la misma afirmación falsa con otra cara',
  );
});

test('SCRUM-363 · la TERCERA superficie, el CSV, tampoco afirma nada sin eje', async () => {
  // El export usa el MISMO semáforo (`exportData.ts`), así que hereda el arreglo. Lo que había
  // que comprobar es qué imprime con `null`: una celda vacía es verdad; la palabra «null» en un
  // fichero que abre el profesional sería el mismo defecto con otra cara.
  const { csvRow } = await import(DIST + 'modules/exports/domain/exportData.js');
  assert.equal(csvRow(['Trabajo', estadoCobroFor(100, null, null), 'fin']), 'Trabajo;;fin');
  assert.match(leer('src', 'modules', 'exports', 'domain', 'exportData.ts'), /estadoCobroFor\(cobrado, aceptado\)/,
    '🔴 el export ha dejado de usar el semáforo compartido: sería un cuarto criterio');
});
