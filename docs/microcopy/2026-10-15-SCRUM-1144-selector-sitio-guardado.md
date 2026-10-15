# Elegir un sitio guardado del cliente para la dirección de la obra

**Aprobado por el orquestador por delegación del fundador** el 26-sep-2026 — SCRUM-1144 comentario 17121.

**Aprobado por el orquestador por delegación del fundador** el 15-oct-2026 — SCRUM-1144 comentario 19789.

La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`. Las dos firmas
son del ORQUESTADOR, no del fundador. El comentario 19789 lo dice así, con su motivo: aplica la
forma ya firmada de la casa («No se pudo… Inténtalo de nuevo.») a un sujeto nuevo.

## Texto aprobado, literal

El botón, bajo el campo libre de la dirección de la obra (modo «Personalizada»). Comentario 17121:

> Elegir un sitio guardado

Lo que dice la lista cuando el cliente no tiene ningún sitio. Comentario 17121:

> Este cliente no tiene sitios guardados todavía.

El aviso de cuando falla `GET /admin/customers/:id/sites`. Comentario 19789:

> No se pudieron cargar los sitios guardados. Inténtalo de nuevo.

## Dónde se pinta

- `public/dashboard/js/sitiosGuardados.js`, `TEXTOS.boton`, `TEXTOS.sinSitios` y `TEXTOS.errorCarga`,
  que pinta su `montarSelector`.
- Lo montan dos pantallas, debajo de su «Dirección de la obra»: el editor de presupuestos
  (`quotesView.js`, paso «Ajustes del documento», modo «Personalizada») y la ficha del Trabajo
  (`jobDetailView.js`, bloque «Datos»).
