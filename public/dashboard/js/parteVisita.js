// public/dashboard/js/parteVisita.js — SCRUM-1697
//
// «VISITA {n} DE {m}» EN LA CABECERA DEL PARTE (N4; M2 del máster, 073c67ade).
// Un trabajo tiene varios partes, uno por visita, y la visita ES su parte. El recuento lo hace el
// SERVIDOR (SCRUM-1697 (b), `visitaDelParte.ts`): GET /admin/partes/:id trae `visitaN` y `visitaM`,
// contados por `fecha` y, a igual fecha, por `numero` (numérico), con los borradores dentro, solo
// del merchant y con su propia puerta por rol. Esta pantalla ya no lee el trabajo: hasta la (b)
// pedía GET /admin/jobs/:id para contar aquí, y eso es lo que el guard de SCRUM-366 no quiere.
//
// Lo único que decide la pantalla: con uno solo no se dice nada (N4 es «con varios en el trabajo»).
// El texto firmado sigue en `PARTE_TEXTOS.visitaDeLas` (parteDetailView.js).
(function () {
  'use strict';

  function entero(x) {
    return typeof x === 'number' && Number.isInteger(x) && x > 0;
  }

  // Lo que el servidor manda, comprobado. FALLA CERRADO: sin los dos números, con uno que no sea un
  // entero positivo, con n > m o con un solo parte, `null` — uno equivocado en un papel firmado es
  // peor que ninguno.
  function visitaDelParte(parte) {
    if (!parte) return null;
    var n = parte.visitaN, m = parte.visitaM;
    if (!entero(n) || !entero(m) || n > m || m < 2) return null;
    return { n: n, m: m };
  }

  // Pone «· Visita n de m» tras el número. No pide nada: lo que hay que pintar ya vino con el parte.
  function pintarVisita(contenedor, parte) {
    if (!contenedor) return;
    var textos = window.PARTE_TEXTOS;
    if (!textos || typeof textos.visitaDeLas !== 'string') return;
    var v = visitaDelParte(parte);
    if (!v) return;
    var hueco = contenedor.querySelector('[data-parte-visita="1"]');
    if (!hueco) return;
    hueco.textContent = '· ' + textos.visitaDeLas.replace('{n}', String(v.n)).replace('{m}', String(v.m));
  }

  window.parteVisitaDelParte = visitaDelParte;
  window.partePintarVisita = pintarVisita;
})();
