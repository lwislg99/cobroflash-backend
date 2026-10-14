# Archivar un presupuesto: la ficha y la lista

**Aprobado por el orquestador por delegación del fundador** el 14-oct-2026 — SCRUM-1273 comentario 19605.

La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`. Los textos
los propuso S2 en el comentario 19604; el orquestador firmó nueve tal cual y **cambió T2**: el
presupuesto archivado vuelve a salir solo si el cliente lo acepta (decisión 1 del mismo comentario),
y el texto tenía que decirlo.

## Texto aprobado, literal

T1 · el botón de la ficha (`quoteActionsRegistry.js`, `QUOTE_ACTION_ROTULOS.btnArchivar`):

> Archivar

T2 · la confirmación (`quotesDetailView.js`, `TEXTOS_ARCHIVO.confirmar`):

> ¿Archivar este presupuesto? Dejará de salir en tu lista. Podrás desarchivarlo cuando quieras, y si tu cliente llega a aceptarlo volverá a salir.

T3 · el aviso en la ficha de un archivado (`TEXTOS_ARCHIVO.avisoArchivado`):

> Presupuesto archivado. No sale en tu lista de presupuestos.

T4 · el botón de ese aviso (`TEXTOS_ARCHIVO.desarchivar`):

> Desarchivar

T5 y T6 · el aviso al terminar (`TEXTOS_ARCHIVO.archivado`, `TEXTOS_ARCHIVO.desarchivado`):

> Presupuesto archivado.

> Presupuesto desarchivado.

T7 y T8 · los fallos (`TEXTOS_ARCHIVO.errorArchivar`, `TEXTOS_ARCHIVO.errorDesarchivar`):

> No se pudo archivar el presupuesto. Inténtalo de nuevo.

> No se pudo desarchivar el presupuesto. Inténtalo de nuevo.

T9 · la opción del selector de estado y la lista vacía (`quotesListView.js`, `TEXTOS_ARCHIVADOS`):

> Archivados

> No tienes presupuestos archivados.

T10 · el `message` del 409 de `POST /admin/quotes/:id/archivar`. **Lo escribe la ruta (S1)**; la
ficha lo enseña tal cual, y sólo en ese 409:

> Solo se puede archivar un borrador, uno rechazado o uno caducado.

## Lo que esta firma no cubre

- La palabra es «presupuesto» en todos los mercados. En México, Colombia, Perú y Chile el panel dice
  «cotización» (`appLocale.quote`), y estos textos no se adaptan: la firma es del literal español.
- La marca «Archivado» en el resultado del buscador queda escrita como remedio si molesta
  (comentario 19605, decisión 2), **sin construir y sin texto firmado**.
