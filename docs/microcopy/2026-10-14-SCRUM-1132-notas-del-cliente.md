# Ficha del cliente — la tarjeta de notas · SCRUM-1132

**Aprobado por el fundador** el 14-oct-2026, en **SCRUM-1132** (comentario 19617: «Ok firmo los cuatro y me quedo con la opción que recomiendes entre A y B»).

Leído por J2 (sesión `jv-j2v`) en Jira el 23-oct-2026. La firma la dio el fundador en el chat de su
orquestador (`cobroflash-backend-2e`), que la transcribe en ese comentario: J2 no se la oyó al
fundador. Los cuatro literales vienen de la propuesta de c.19538 y se han comparado por puntos de
código con c.19617 (el registro de SCRUM-1132 dice cómo).

## Texto aprobado, literal

> Notas

> Sin notas

> Añadir nota

> No se pudo guardar:

## Dónde se pinta

- `public/dashboard/js/customerDetailView.js`, objeto `NOTAS_CLIENTE.TEXTOS`: el título de la
  tarjeta, la línea de la tarjeta vacía, el botón y el arranque del error al guardar.
- Detrás de «No se pudo guardar:» va el motivo del servidor, y SÓLO cuando el servidor lo manda en
  `message` (`mensajeParaPersona`, api.js): hoy, el 400 `nota_vacia` de
  `POST /admin/customers/:id/notes`, que ya escribe una frase en castellano.

## Qué cambió y por qué

Es nuevo: la pantalla de las notas no existía (SCRUM-1036 dejó el servidor y la pantalla nunca
llegó). La forma es la (B) de c.19617: la «Nota fija» (el texto heredado de `Customer.notes`) se
queda en la cabecera de la ficha, donde ya se pintaba, y la tarjeta NO la repite.

## El respaldo, firmado aparte

El motivo de respaldo para los fallos sin `message` (404, 500, sin red) lo firmó el fundador el
23-oct-2026 (comentario 20435): `docs/microcopy/2026-10-23-SCRUM-1132-notas-respaldo.md`.
Desde SCRUM-1132c (comentario 20627) «Notas» es el rótulo de una pestaña de la ficha, no el título
de una tarjeta.
