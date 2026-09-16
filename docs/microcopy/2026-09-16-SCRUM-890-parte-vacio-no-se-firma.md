# Por qué no se firma un parte vacío, y qué hacer

**Aprobado por el orquestador por delegación del fundador** el 16-sep-2026 — SCRUM-890 comentario 15623.
**Aplicado en el mismo acto** (regla 30).

## Texto aprobado, literal

> Este parte está vacío y no se puede firmar. Apunta lo que has hecho y vuelve a intentarlo.

## Dónde se pinta

`public/dashboard/js/parteDetailView.js` — clave `TEXTOS.parteVacioNoSeFirma`, en dos sitios:

- **Junto al botón de firmar**, dentro de la sección de firmas del parte (`.alert warning`,
  `role="alert"`), cuando se pulsa firmar en un parte sin ninguna línea. El pad no se abre: el
  servidor lo rechazaría seguro y el cliente firmaría para nada.
- **Dentro del pad de firma**, cuando la pantalla traía líneas y el servidor responde 409
  `parte_vacio` (las quitó la oficina entre medias). El pad no se cierra.

## Qué cambió

Antes no había texto: el 409 se tragaba en silencio y el pad se cerraba como si el cliente hubiera
firmado. La propuesta de la sesión decía «no tiene ninguna línea» y «vuelve a firmar»; la firma lo
cambió a «está vacío» y «vuelve a intentarlo», porque el cliente todavía no ha firmado.

## Qué queda sin firmar en esa pantalla

El aviso genérico de una firma encolada que el servidor rechaza al vaciar la cola con un código
distinto de `parte_vacio` (segundo PR de SCRUM-890): se propondrá aparte.
