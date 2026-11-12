// src/modules/jobs/domain/visitaDelParte.ts — SCRUM-1697 (b)
//
// «VISITA {n} DE {m}» (N4) — LA REGLA, EN UN SOLO SITIO.
//
// M2 del máster (Parte L, SCRUM-1686, 073c67ade): un trabajo tiene varios partes, uno por visita, y la
// visita ES su parte (no es entidad ni estado). «Visita {n} de {m}» cuenta los partes del trabajo por
// `fecha` y, a igual fecha, por `numero`; `m` = todos los partes del trabajo, también los borradores.
//
// Puro: no toca base ni red. Quién le pasa la lista (y que sea SOLO la del merchant) es de la ruta.
//
// 🔴 El número se compara NUMÉRICO («PT-2026-9» antes que «PT-2026-10»). Por texto iría al revés en
// cuanto la serie pase de un dígito a dos, y el papel firmado diría una visita que no es.
//
// FALLA CERRADO: si el parte no está en la lista, `null` — nunca un número inventado. Que con uno solo
// no se pinte nada (N4 es «con varios en el trabajo») lo decide la pantalla, no esto: aquí se dice el
// hecho, 1 de 1.

export type VisitaDelParte = { visitaN: number | null; visitaM: number | null };

type ParteParaContar = { id: number; fecha: Date | string; numero: string | null };

const NUMERICO = new Intl.Collator('es', { numeric: true });

function tiempo(f: Date | string): number {
  const t = f instanceof Date ? f.getTime() : Date.parse(String(f));
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

export function visitaDelParte(parteId: number, partes: readonly ParteParaContar[]): VisitaDelParte {
  if (!Array.isArray(partes) || partes.length === 0) return { visitaN: null, visitaM: null };
  const ordenados = [...partes].sort((a, b) => {
    const ta = tiempo(a.fecha);
    const tb = tiempo(b.fecha);
    if (ta !== tb) return ta < tb ? -1 : 1;
    const porNumero = NUMERICO.compare(String(a.numero ?? ''), String(b.numero ?? ''));
    if (porNumero !== 0) return porNumero;
    return a.id - b.id; // mismo día y mismo número: orden estable, no aleatorio
  });
  const i = ordenados.findIndex((p) => p.id === parteId);
  if (i < 0) return { visitaN: null, visitaM: null };
  return { visitaN: i + 1, visitaM: ordenados.length };
}
