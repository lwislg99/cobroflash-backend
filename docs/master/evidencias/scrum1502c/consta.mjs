// Contraste: la función de la casa (aprobacionesDeMicrocopy / comoConstaAprobado) sobre los
// literales que gobiernan las marcas que miro. Uso: node consta.mjs <raíz del árbol>
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const RAIZ = process.argv[2];
const m = await import(pathToFileURL(path.join(RAIZ, 'tests/_microcopy-aprobada.mjs')).href);
const casos = [
  ['POSITIVO registro congelado', 'Marcar como cobrada'],
  ['POSITIVO registro congelado', 'Criterio de caja'],
  ['POSITIVO registro congelado', 'Enviar a aprobación'],
  ['POSITIVO addendum', 'Falta la cantidad — ponla tú'],
  ['CERO inventado', 'Zanahoria púrpura de control'],
  ['quotesAdmin:395', 'La factura se creó pero no se pudo registrar. No la entregues todavía; se reintenta solo.'],
  ['reportsView:1195', 'Desglose por empleado'],
  ['reportsView:1195', 'Empleados incluidos en la suma'],
  ['reportsView:1195', 'Toca para quitar o añadir a la suma.'],
  ['jobRailBlocks:19', 'RESPONSABLE'],
  ['jobRailBlocks:19', 'PRESUPUESTO'],
  ['scrum291:99', 'Esta serie ya tiene facturas emitidas'],
  ['homeView:779', 'Cobros sin presupuesto'],
  ['homeView:779', 'Total cobrado'],
  ['scrum609b:75', 'Esto es'],
  ['scrum593b:89', 'Añadir texto en el documento'],
  ['jobDetailView:217 (fuera de las 27)', 'aceptados y sin facturar'],
  ['jobDetailView:217 (fuera de las 27)', 'Falta emitir la factura'],
];
const todas = m.aprobacionesDeMicrocopy();
console.log(`población de la casa: ${todas.length} aprobaciones`);
for (const [d, t] of casos) {
  let r; try { r = m.comoConstaAprobado(t); } catch (e) { r = 'ERROR ' + e.message; }
  console.log(`${d} · «${t.slice(0, 50)}» → ${JSON.stringify(r)}`);
}
