// public/dashboard/js/parteVisita.js — SCRUM-1697
//
// «VISITA {n} DE {m}» EN LA CABECERA DEL PARTE (N4; M2 del máster, 073c67ade).
// Un trabajo tiene varios partes, uno por visita, y la visita ES su parte. Se cuentan los partes
// del trabajo por `fecha` y, a igual fecha, por `numero`; `m` = todos, también los borradores.
// Con uno solo no se dice nada: N4 es «con varios en el trabajo».
//
// Fichero aparte a propósito: LEE el trabajo (GET /admin/jobs/:id trae `partes`, SCRUM-1671) pero
// no pinta ninguna acción, así que no es una superficie en el sentido del guard de SCRUM-366.
// El texto firmado sigue en `PARTE_TEXTOS.visitaDeLas` (parteDetailView.js).
(function () {
  'use strict';

  function visitaDelParte(parteId, partes) {
    if (!Array.isArray(partes) || partes.length < 2) return null;
    var ordenados = partes.slice().sort(function (a, b) {
      var fa = Date.parse(a && a.fecha), fb = Date.parse(b && b.fecha);
      if (fa !== fb) return (isNaN(fa) ? Infinity : fa) - (isNaN(fb) ? Infinity : fb);
      return String((a && a.numero) || '').localeCompare(String((b && b.numero) || ''), 'es', { numeric: true });
    });
    for (var i = 0; i < ordenados.length; i++) {
      if (ordenados[i] && String(ordenados[i].id) === String(parteId)) return { n: i + 1, m: ordenados.length };
    }
    return null;
  }

  // Pone «· Visita n de m» tras el número. FALLA CERRADO: sin trabajo, sin lista, sin texto o con la
  // lectura caída, la cabecera se queda sin número — uno equivocado en un papel firmado es peor.
  async function pintarVisita(contenedor, parte, pedir) {
    if (!contenedor || !parte || parte.jobId === null || parte.jobId === undefined || parte.jobId === '') return;
    if (typeof pedir !== 'function') return;
    var textos = window.PARTE_TEXTOS;
    if (!textos || typeof textos.visitaDeLas !== 'string') return;
    var trabajo;
    try { trabajo = await pedir('/admin/jobs/' + parte.jobId); } catch (_e) { return; }
    var v = visitaDelParte(parte.id, trabajo && trabajo.partes);
    if (!v) return;
    var hueco = contenedor.querySelector('[data-parte-visita="1"]');
    if (!hueco) return;
    hueco.textContent = '· ' + textos.visitaDeLas.replace('{n}', String(v.n)).replace('{m}', String(v.m));
  }

  window.parteVisitaDelParte = visitaDelParte;
  window.partePintarVisita = pintarVisita;
})();
