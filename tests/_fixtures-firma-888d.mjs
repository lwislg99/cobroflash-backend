// tests/_fixtures-firma-888d.mjs — SCRUM-888 punto 1: los presupuestos con los que se mide la página de firma.
//
// Fechas FIJAS y sin «ahora»: `renderQuoteDetail` es determinista con ellas (medido), así que su
// HTML se puede congelar byte a byte. La huella de los presupuestos SIN descuento se tomó con el
// código ANTERIOR al arreglo; si el arreglo mueve un solo byte de esas páginas, cambia.

const MERCHANT = { name: 'Electricidad QA', legalName: null, logoUrl: null, address: null, country: 'ES', timezone: 'Europe/Madrid' };

export const presupuesto = (over = {}) => ({
  id: 1874, quoteNumber: 3, currency: 'EUR', total: 0, status: 'sent',
  createdAt: new Date('2026-09-16T10:00:00Z'), validUntil: null,
  paymentTerms: 'FULL_UPFRONT', customBillingPlan: null, discountGlobalAmount: null,
  merchant: MERCHANT, customer: { name: 'Cliente' }, lines: [],
  ...over,
});

/** C1, C2 y C4 de SCRUM-883 y los bordes que el arreglo no puede tocar. [nombre, presupuesto, tiersInfo] */
export const FIXTURES_SIN_DESCUENTO = [
  ['C1 · todo 21 %, con el céntimo del punto 4', presupuesto({ total: '243.14', lines: [
    { concept: 'Magnetotérmico 2P 16A', qty: 3, price: 9.99, tax: 0.21 },
    { concept: 'Diferencial 40A 30mA', qty: 1, price: 42.35, tax: 0.21 },
    { concept: 'Cable 2,5 mm² (m)', qty: 37, price: 0.875, tax: 0.21 },
    { concept: 'Mano de obra (h)', qty: 2.5, price: 38.5, tax: 0.21 },
  ] })],
  ['C2 · IVA mixto 10 % y 21 %, 50/50', presupuesto({ total: '531.24', paymentTerms: 'FIFTY_FIFTY', lines: [
    { concept: 'Mano de obra instalación (h)', qty: 6, price: 36.35, tax: 0.10 },
    { concept: 'Mecanismos (ud)', qty: 14, price: 4.19, tax: 0.10 },
    { concept: 'Material eléctrico', qty: 1, price: 187.44, tax: 0.21 },
  ] })],
  ['C4 · plan propio Señal 30 % / Resto 70 %', presupuesto({ total: '970.23', paymentTerms: 'MANUAL',
    customBillingPlan: [{ percentage: 0.3, label: 'Señal' }, { percentage: 0.7, label: 'Resto al terminar' }], lines: [
      { concept: 'Wallbox 7,4 kW', qty: 1, price: 689, tax: 0.21 },
      { concept: 'Cable 6 mm² (m)', qty: 23, price: 2.37, tax: 0.21 },
      { concept: 'Protección sobretensiones', qty: 1, price: 58.33, tax: 0.21 },
    ] })],
  ['dto 0 y global a cero en texto: NO son descuento', presupuesto({ total: '121.00', discountGlobalAmount: '0.00', lines: [
    { concept: 'Revisión', qty: 1, price: 100, dto: 0, tax: 0.21 },
  ] })],
  ['todo al 0 %: sin bloque de IVA', presupuesto({ total: '80.00', lines: [
    { concept: 'Suplido tasas', qty: 1, price: 80, tax: 0 },
  ] })],
  ['modo «IVA no incluido»: la página sigue en «sumar» (hueco declarado)', presupuesto({ total: '121.00', ivaModo: 'no_incluido', lines: [
    { concept: 'Revisión', qty: 1, price: 100, tax: 0.21 },
  ] })],
  ['con opciones a elegir (tiers)', presupuesto({ total: '242.00', lines: [
    { concept: 'Opción mejor', qty: 2, price: 100, tax: 0.21 },
  ] }), { min: 121 }],
  ['sin líneas', presupuesto({ total: '0.00', lines: [] })],
];
