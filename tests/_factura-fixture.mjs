// tests/_factura-fixture.mjs — crea facturas de test con vfEstado EXPLÍCITO y OBLIGATORIO.
//
// POR QUÉ EXISTE (nace del arreglo de 7 tests a la vez): desde SCRUM-205 el schema tiene la columna
// `vf_estado` con default `'pendiente_de_sellado'`, y una factura pendiente NO produce PDF/XML/export
// (`puedeProducirDocumento`, selladoEstado.ts). Un `prisma.invoice.create` a pelo la deja pendiente
// EN SILENCIO — y siete tests que creaban la factura así se cayeron con `invoice_pendiente_de_sellado`
// el día que la BD tuvo la columna. El default está para que un camino OLVIDADO quede visible, no
// para que los tests se lo salten.
//
// Este helper OBLIGA a declarar el estado — el octavo test no puede nacer con el mismo defecto:
//   vfEstado: 'sellado'    → factura FISCAL ya sellada (merchant ES + NIF, número real de factura).
//   vfEstado: 'no_aplica'  → NO entra en la cadena VeriFactu (merchant no-ES / sin NIF / justificante).
// Es lo que daría `estadoAlNacer` según el merchant; ponerlo al revés es el «verde que no comprueba
// nada» de SCRUM-237. Si dudas cuál toca, mira el merchant: ¿country 'ES' Y taxId? → sellado; si no → no_aplica.
//
// Los estados válidos se importan de la FUENTE (selladoEstado.ts, ya compilado en dist por `npm test`):
// una sola lista, sin copia que pueda derivar.
import { SELLADO_HECHO, SELLADO_NO_APLICA, SELLADO_PENDIENTE } from '../dist/modules/invoicing/domain/selladoEstado.js';
import { applyVeriFactu } from '../dist/modules/invoicing/domain/verifactu.service.js';

const ESTADOS_VALIDOS = new Set([SELLADO_HECHO, SELLADO_NO_APLICA, SELLADO_PENDIENTE]);

/**
 * Como `prisma.invoice.create`, pero recibe el objeto `data` directamente y EXIGE `vfEstado`.
 *   const inv = await crearFactura(prisma, { merchantId, customerId, number, …, vfEstado: 'sellado' });
 */
export function crearFactura(prisma, data) {
  if (!data || typeof data !== 'object' || !ESTADOS_VALIDOS.has(data.vfEstado)) {
    throw new Error(
      `crearFactura: 'vfEstado' es OBLIGATORIO y explícito (uno de: ${[...ESTADOS_VALIDOS].join(', ')}). ` +
      'Sin él la factura nace \'pendiente_de_sellado\' y no produce PDF/XML (SCRUM-205). ' +
      'Declara la intención: \'sellado\' si es fiscal (ES + NIF), \'no_aplica\' si no lo es.',
    );
  }
  return prisma.invoice.create({ data });
}

/**
 * Crea una factura FISCAL DECLARABLE. En vez de fingir un `vfHash` —que la verificación de cadena
 * (SCRUM-145/173) RECHAZA, dejando la factura EXCLUIDA del registro—, la sella DE VERDAD con
 * `applyVeriFactu`: la misma huella que usa la emisión (patrón aceptado de scrum173/207), con hash
 * real + `vfTimestamp` y encadenada. Nace pendiente, se sella, y queda 'sellado'.
 *
 * Cuándo usarla: cuando el test EJERCITA el camino fiscal (export VeriFactu, ZIP con XML, gate). Si
 * solo necesitas una factura que produzca PDF y no es fiscal (merchant sin NIF), usa `crearFactura`
 * con `vfEstado: 'no_aplica'` — más barato. NO pongas `vfHash` ni `vfEstado` en `data`: los pone esto.
 *
 * @param {string} taxId  el NIF del merchant (`merchant.taxId`), que entra en la huella.
 */
export async function crearFacturaDeclarable(prisma, data, taxId) {
  if (!taxId) {
    throw new Error(
      'crearFacturaDeclarable: falta el NIF (merchant.taxId). Sin NIF una factura no entra en la ' +
      'cadena VeriFactu ni es declarable — usa crearFactura con vfEstado: \'no_aplica\'.',
    );
  }
  const invoice = await crearFactura(prisma, { ...data, vfEstado: SELLADO_PENDIENTE }); // nace pendiente
  await applyVeriFactu(invoice, taxId, prisma); // huella REAL + vfTimestamp, encadenada (scrum173/207)
  await prisma.invoice.update({ where: { id: invoice.id }, data: { vfEstado: SELLADO_HECHO } });
  return invoice;
}
