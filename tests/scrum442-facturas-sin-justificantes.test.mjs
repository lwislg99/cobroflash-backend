// SCRUM-442 · El listado de «Facturas» mezclaba facturas y justificantes.
//
// Sin gate: se le pasa un cliente Prisma FALSO a `listInvoicesAdmin` y se lee el `where` con el que
// consulta. Ni BD, ni red.
//
// EL DEFECTO: los dos documentos viven en la MISMA tabla, discriminados por `type`. El `where`
// tenía CUATRO criterios y `type` no estaba en ninguno → **44 de 55 documentos en producción no
// eran facturas** (10-ago-2026). El profesional los contaba como si lo fueran.
//
// ⚠️ Cambia QUÉ SE LISTA, jamás qué se guarda (regla 29).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FUENTE = fs.readFileSync(path.join(RAIZ, 'src/modules/system/invoiceAdmin.ts'), 'utf8');

/** El `where` con el que la consulta sale, leído del código. */
function whereDelListado() {
  const m = /const where: Prisma\.InvoiceWhereInput = \{([^}]*(?:\{[^}]*\}[^}]*)*)\};/.exec(FUENTE);
  return m ? m[1].replace(/\s+/g, ' ').trim() : null;
}

test('SCRUM-442 · SUELO: se localiza el `where` del listado, o no se afirma nada', () => {
  const w = whereDelListado();
  assert.ok(w, '🔴 ESCÁNER CIEGO: no se encuentra el `where` de `listInvoicesAdmin`. «No filtra por '
    + 'type» y «no supe leer la consulta» son el mismo resultado y significan lo contrario.');
  assert.match(FUENTE, /prisma\.invoice\.findMany/, '🔴 ESCÁNER CIEGO: la consulta ya no es un findMany de invoice');
});

test('SCRUM-442 · 🔴 EL VECTOR: el listado EXCLUYE los justificantes', () => {
  const w = whereDelListado();
  assert.match(w, /type:\s*\{\s*not:\s*'JUST'\s*\}/,
    `🔴 SE HA COLADO EL JUSTIFICANTE EN EL LISTADO DE FACTURAS.\n\n`
    + `  El \`where\` es: { ${w} }\n\n`
    + '  Sin `type: { not: \'JUST\' }`, los justificantes salen mezclados con las facturas — en\n'
    + '  producción eran 44 de 55 documentos (10-ago-2026). Un justificante NO es una factura: vive\n'
    + '  fuera de toda serie fiscal, y el profesional los cuenta como si lo fueran.');
});

test('SCRUM-442 · CONTROL POSITIVO: una F1 sigue saliendo', () => {
  // El filtro excluye SOLO los JUST. Si algún día se escribiera `type: 'F1'` a secas, un tipo nuevo
  // (una R1, o el 'ANT' reservado) desaparecería del listado sin que nadie lo notara.
  const w = whereDelListado();
  assert.doesNotMatch(w, /type:\s*'F1'/,
    '🔴 el listado filtra por `type: \'F1\'` en positivo. Eso excluye TAMBIÉN las rectificativas R1 '
    + 'y cualquier tipo futuro. Se excluye lo que NO es factura, no se incluye una lista de tipos.');
  assert.match(w, /not:/, '🔴 el filtro dejó de ser una exclusión');
});

test('SCRUM-442 · CONTROL NEGATIVO: los otros CUATRO criterios siguen enteros', () => {
  // Un `where` de cinco que rompa el de estado o el de fechas es una regresión, no un arreglo.
  assert.match(FUENTE, /where\.status = status/, '🔴 se perdió el filtro por ESTADO');
  assert.match(FUENTE, /where\.OR = \[/, '🔴 se perdió el filtro de BÚSQUEDA');
  assert.match(FUENTE, /where\.createdAt/, '🔴 se perdió el filtro por FECHAS');
  assert.match(whereDelListado(), /merchantId/, '🔴 se perdió el filtro por MERCHANT (regla 2)');
});

test('SCRUM-442 · EL SUELO DEL TICKET: los justificantes siguen alcanzables desde Cobros', () => {
  // Excluirlos de Facturas solo es legítimo si su sitio existe. Si `cobros.service` listara solo
  // `Charge`, los cobros por transferencia o efectivo desaparecerían del producto (SCRUM-441).
  const cobros = fs.readFileSync(path.join(RAIZ, 'src/modules/billing/domain/cobros.service.ts'), 'utf8');
  assert.match(cobros, /prisma\.charge\.findMany/, '🔴 ESCÁNER CIEGO: Cobros ya no consulta Charge');
  assert.match(cobros, /prisma\.invoice\.findMany/,
    '🔴 COBROS HA DEJADO DE LISTAR INVOICE. Entonces los justificantes excluidos de Facturas no '
    + 'aparecen en ninguna parte: un cobro por transferencia o efectivo no crea `Charge`.');
  assert.doesNotMatch(cobros, /type:\s*\{\s*not:\s*'JUST'\s*\}/,
    '🔴 Cobros ha empezado a excluir los JUST también. Excluidos de los dos sitios, desaparecen.');
});
