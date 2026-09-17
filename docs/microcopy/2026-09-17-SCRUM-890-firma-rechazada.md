# Una firma que quedó pendiente y el servidor no ha registrado

Aprobado por el orquestador por delegación del fundador · SCRUM-890 comentario 15665

Firmado el 17-sep-2026 a las 10:10 CEST (comentario escrito a las 10:20 CEST). **Aplicado en el mismo
acto** (regla 30).

## Texto aprobado, literal

> La firma que quedó pendiente no se ha podido registrar. Vuelve a firmar el parte.

## Dónde se pinta

`public/dashboard/js/parteDetailView.js` — clave `TEXTOS.firmaRechazada`, en la sección de firmas
del parte (`.alert warning`, `role="alert"`), al abrir un parte que tiene un recuadro SIN firmar y
una constancia de rechazo para ese recuadro.

La constancia la deja `colaDeFirmas.js` en IndexedDB (almacén `firmasRechazadas`) cuando una firma
encolada sin red se intenta subir al vaciar la cola y el servidor la rechaza por el documento. Se
borra cuando ese recuadro se vuelve a firmar con éxito.

Si el código del rechazo es `parte_vacio`, no sale este texto sino el ya firmado
`TEXTOS.parteVacioNoSeFirma` (`2026-09-16-SCRUM-890-parte-vacio-no-se-firma.md`).

## Qué cambió

Antes no había texto: la firma rechazada salía de la cola y ninguna pantalla lo decía. El
profesional creía firmado un parte que seguía en borrador.

## Límite aceptado

Con el parte ya abierto cuando se vacía la cola, el aviso no aparece en ese momento: sale al volver
a abrir el parte.
