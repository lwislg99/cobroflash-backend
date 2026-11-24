// src/modules/billing/app/routes/detalleDeLaFactura.ts
// SCRUM-1794b · la tabla de líneas y el desglose de una factura, como FUNCIÓN PURA exportada.
//
// Nació sin exportar dentro de `payInvoice.routes.ts` (SCRUM-1787h). Sale a su módulo para que el correo
// de la factura (`email.service.ts`, S1) la llame sin reescribirla: decisión del orquestador J en
// SCRUM-1794 c.22461 (punto 3), sobre la medición de c.22459. Se ha movido tal cual: la página de pago
// pinta lo mismo, byte a byte (`tests/scrum1794b-detalle-de-la-factura-exportado.test.mjs`, oro
// capturado antes de moverla). Ningún texto nuevo.
//
// PURA: no lee la base, ni el reloj, ni el entorno. Recibe la factura ya leída y devuelve HTML.
import { esc, formatMoneyEs } from '../../../../core/utils/utils';
import { pieDePresupuesto } from '../../../quotes/domain/presentacionIva'; // SCRUM-1787h: el desglose de la página del presupuesto (S1)

/** Lo que la función lee de la factura: `Invoice.total` y `Invoice.lines` (Json), tal como vienen de la fila. */
export type FacturaConLineas = { total: unknown; lines: unknown };

/**
 * SCRUM-1787h · EL DETALLE DE LÍNEAS DE LA FACTURA, COMO EN LA PÁGINA DEL PRESUPUESTO.
 *
 * Decisión del fundador (SCRUM-1787 c.22327, «1-Sí»): el cliente que abre el enlace de pago ve las
 * líneas de la factura. Se LEEN de la factura emitida (`Invoice.lines`); la emisión no se toca.
 *
 * Rótulos: ninguno nuevo. La tabla y el desglose son los de `quoteDecisionLanding.routes.ts`
 * (`renderQuoteDetail`): cabecera «Concepto · Cant. · Importe», importe de línea = cantidad × precio
 * (neto, el IVA va debajo), y las filas de `pieDePresupuesto` («Base imponible», «IVA (21%)» y, si hay
 * descuento, «Suma de líneas» y «Descuento») con el mismo `rotuloEnLaPagina`.
 *
 * 🔴 SÓLO SI CUADRA — la regla va DENTRO, para que quien la llame la herede. Devuelve `''` (no pinta
 * nada) si:
 *   · la factura no trae líneas, o el desglose no tiene «Base imponible»;
 *   · base + IVA (con sus descuentos) NO es el `total` de la factura, al medio céntimo (suplidos, otro
 *     motor de redondeo: SCRUM-624). Vale para la página y para el correo;
 *   · `importeDelCobro` es un número y NO es el total de la factura (el cobro no es la factura entera).
 *     La página de pago pasa el importe del COBRO, porque arriba dice «Importe a pagar» con esa cifra.
 *     Quien no tiene cobro que comparar (el correo de la factura, c.22459 ③) pasa `null`, y sólo
 *     se aplica la condición anterior.
 * En esos casos, una tabla debajo diría otra cifra que la de arriba, y explicarlo pediría un texto sin
 * firmar (regla 39): se queda sin pintar.
 *
 * El HTML lleva CLASES (`lines-table`, `totals-block`, `totals-row`), ningún `style=` (CSP de la página
 * de pago, SCRUM-1723/1773). Quien lo pinte fuera de esa página pone sus propios estilos.
 *
 * @param invoice          la factura leída (`total`, `lines`), o `null` si no hay.
 * @param importeDelCobro  el importe del cobro que la página enseña, o `null` si no hay cobro que comparar.
 * @param currency         la moneda del importe (`EUR`…), para `formatMoneyEs`.
 * @returns el HTML de la tabla y el desglose, o `''` si no cuadra.
 */
export function detalleDeLaFactura(
  invoice: FacturaConLineas | null,
  importeDelCobro: number | null,
  currency: string,
): string {
  const lineas: any[] = Array.isArray(invoice?.lines) ? (invoice!.lines as any[]) : [];
  if (lineas.length === 0) return '';
  const money = (n: number) => esc(formatMoneyEs(n, currency));
  const pie = pieDePresupuesto({ lineas, modo: 'sumar', nombreImpuesto: 'IVA' });
  const desdeBase = pie.filas.findIndex((f) => f.etiqueta === 'Base imponible:');
  if (desdeBase < 0) return '';
  const sumaDelDesglose = pie.filas.slice(desdeBase).reduce((s, f) => s + f.importe, 0);
  const totalFactura = Number(invoice!.total);
  const cuadra = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.005;
  if (!cuadra(sumaDelDesglose, totalFactura)) return '';
  if (importeDelCobro !== null && !cuadra(importeDelCobro, totalFactura)) return '';

  const rotuloEnLaPagina = (etiqueta: string) => {
    // «IVA 21%:» → «IVA (21%)», sin expresión regular (SCRUM-1325: ninguna mira texto sin declarar).
    const sinDosPuntos = etiqueta.endsWith(':') ? etiqueta.slice(0, -1) : etiqueta;
    if (sinDosPuntos.startsWith('IVA ') && sinDosPuntos.endsWith('%')) {
      return `IVA (${sinDosPuntos.slice(4)})`;
    }
    return sinDosPuntos;
  };
  // Una cabecera de apartado (SCRUM-655) viaja sin cantidad ni precio: concepto sí, importe vacío.
  const importeDeLinea = (l: any) => {
    const neto = Number(l?.qty) * Number(l?.price);
    return l?.qty != null && l?.price != null && Number.isFinite(neto) ? money(neto) : '';
  };
  return `
    <table class="lines-table">
      <thead><tr><th>Concepto</th><th>Cant.</th><th>Importe</th></tr></thead>
      <tbody>${lineas.map((l: any) => `
        <tr>
          <td>${esc(l?.concept ?? '')}</td>
          <td>${esc(l?.qty ?? '')}</td>
          <td>${importeDeLinea(l)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="totals-block">
      ${pie.filas.map((f) => `
      <div class="totals-row"><span>${esc(rotuloEnLaPagina(f.etiqueta))}</span><span>${money(f.importe)}</span></div>`).join('')}
    </div>`;
}
