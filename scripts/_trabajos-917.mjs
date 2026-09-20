// scripts/_trabajos-917.mjs — SCRUM-917c
//
// LOS TRABAJOS DE MUESTRA DEL REDISEÑO DE LA LISTA, en un solo sitio. Los usan el guard
// (`guard:lista-trabajos-917`) y las capturas (`capturas-lista-trabajos-917.mjs`): si cada uno
// llevara los suyos, el día que uno cambie estarían midiendo una pantalla y fotografiando otra (la
// misma razón por la que existe `_trabajos-de-muestra.mjs` para SCRUM-816).
//
// La FORMA es la de `serializeJob` (jobs.routes.ts), con `tituloPropio` (SCRUM-917d).
import { EQUIPO } from './_trabajos-de-muestra.mjs';

// Las fechas se calculan AL CORRER, en la hora local de esta máquina, que es la del navegador que
// pinta: «hoy» tiene que ser hoy, o el grupo «📅 Hoy» se mediría sobre un día que no es.
export const ahora = new Date();
const enDias = (d, h, m = 0) => new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + d, h, m).toISOString();

export function trabajo(id, cliente, o) {
  const ref = o.ref === undefined ? null : o.ref;
  const cobrado = o.cobrado || 0;
  return {
    id,
    status: o.status,
    scheduledAt: o.fecha || null,
    assignedUserId: null,
    notes: null,
    createdAt: '2026-09-01T09:00:00.000Z',
    titulo: o.titulo || cliente,
    tituloPropio: o.titulo || null,
    direccion: null,
    totalAceptado: ref,
    totalCobrado: cobrado,
    estadoCobro: ref == null ? null : (cobrado <= 0 ? 'Pendiente' : (cobrado >= ref ? 'Pagado' : 'Parcial')),
    importeReferencia: ref,
    customer: { id: 100 + id, name: cliente, phone: null },
    operarioId: null,
    operario: null,
    asignados: o.asignados || [],
    tipoOperacion: 'TRABAJO_UNICO',
    quote: ref == null ? null : { id, number: id, total: o.totalPresupuesto || ref, currency: o.moneda || 'EUR', paymentTerms: null },
    remaining: o.resto ? { amount: o.resto, currency: o.moneda || 'EUR' } : null,
    nextStage: null,
    pendingStagesCount: 0,
    hasCustomPlan: false,
    albaranes: o.albaranes || [],
    invoices: [],
  };
}

// Doce Trabajos: los cinco estados, los tres casos de dinero (falta, cobrado del todo, sin eje) y
// el caso que NO se construye (cobrado de más), que tiene que pintarse COMO HOY.
export const TRABAJOS = [
  trabajo(1, 'Ana Cuadro', { status: 'en_curso', fecha: enDias(-1, 9), ref: 590, titulo: 'Cambio de cuadro eléctrico', asignados: [EQUIPO[0]] }),
  trabajo(2, 'Comunidad Los Olivos', { status: 'agendado', fecha: enDias(0, 16, 30), ref: 380, cobrado: 190, titulo: 'Revisión anual del portero', asignados: [EQUIPO[1]] }),
  trabajo(3, 'Recarga Garaje', { status: 'agendado', fecha: enDias(2, 8), ref: 970.23, cobrado: 291.07 }),
  trabajo(4, 'Lucía Romero', { status: 'pendiente_agendar', ref: 590 }),
  trabajo(5, 'QA Cinco', { status: 'pendiente_agendar', ref: 417.45 }),
  trabajo(6, 'Taller Hnos. Vega', { status: 'pendiente_agendar', titulo: 'Urgencia: sin luz en nave' }),
  trabajo(7, 'Cliente Electricista', { status: 'terminado', fecha: enDias(-7, 10), ref: 539.05, cobrado: 628.6 }),
  trabajo(8, 'Bar El Puerto', { status: 'terminado', fecha: enDias(-6, 12), ref: 1240, cobrado: 500, resto: 740, titulo: 'Cámara frigorífica', asignados: [EQUIPO[0], EQUIPO[1]] }),
  trabajo(9, 'Inmobiliaria Sur', { status: 'terminado', fecha: enDias(-9, 9, 30) }),
  trabajo(10, 'Hotel Arenal', { status: 'agendado', fecha: enDias(11, 9), ref: 2150 }),
  trabajo(11, 'Pilar Ibáñez', { status: 'cerrado', fecha: enDias(-20, 11), ref: 145, cobrado: 145 }),
  trabajo(12, 'Pagado Entero', { status: 'terminado', fecha: enDias(-5, 9), ref: 300, cobrado: 300 }),
];

// Las dos veces que «Por cobrar» NO se pinta: con la lista truncada (200 filas, el `take` de
// `GET /admin/jobs`) la suma sería de una parte que parece el todo; con dos monedas, una suma de
// euros y dólares no es un importe.
export const DOSCIENTOS = Array.from({ length: 200 }, (_, i) => trabajo(1000 + i, 'Cliente ' + i, { status: 'pendiente_agendar', ref: 100 }));
export const DOS_MONEDAS = [
  trabajo(1, 'En Euros', { status: 'pendiente_agendar', ref: 100 }),
  trabajo(2, 'En Dólares', { status: 'pendiente_agendar', ref: 100, moneda: 'USD' }),
];
