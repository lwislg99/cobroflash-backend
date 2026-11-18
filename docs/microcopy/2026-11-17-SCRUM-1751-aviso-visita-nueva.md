# El aviso antes de empezar una visita nueva

**Aprobado por el orquestador por delegación del fundador** el 17-nov-2026 — SCRUM-1656 comentario 21978 (la delegación general de firma), usada en SCRUM-1751, cuya descripción lleva estos literales.
**Aplicado en el mismo acto** (regla 30).

## Textos aprobados, literales

> ¿Empezar una visita nueva?

> El último parte de este trabajo ya está firmado. Si sigues, se crea un parte nuevo para otra visita.

> Crear parte nuevo

> Cancelar

## Dónde se pintan

`public/dashboard/js/jobDocsReparto.js`, `AVISO_VISITA_NUEVA` (`titulo`, `cuerpo`, `crear`), que pinta
`avisarDeVisitaNueva` en el modal de la casa. «Cancelar» es el botón que `jobsModal`
(`public/dashboard/js/jobAgendar.js`) pone en el pie de todos sus modales: ya estaba en pantalla.

El aviso sale desde las dos puertas al parte, y sólo cuando el último parte del trabajo está firmado
y no hay ningún borrador:

- «Abrir parte», en la fila del trabajo en curso de la lista (`jobsView.js`).
- «+ Nuevo parte», en la sección Partes de la ficha del trabajo (`jobDetailView.js`).

«Crear parte nuevo» es la acción principal; «Cancelar» cierra sin crear nada.

## Qué cambió

Antes no había aviso: con el último parte firmado, las dos puertas creaban un parte nuevo sin decir
nada. Con un borrador, o sin ningún parte todavía, todo sigue como estaba.

## Lo que queda sin firmar

Nada en este aviso.
