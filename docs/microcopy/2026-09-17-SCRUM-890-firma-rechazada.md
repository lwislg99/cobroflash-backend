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

La constancia la deja `colaDeFirmas.js` en `localStorage` (`yaqu_firma_rechazada_<clave>`) cuando
una firma encolada sin red se intenta subir al vaciar la cola y el servidor la rechaza por el
documento. Se borra cuando ese recuadro se vuelve a firmar con éxito y al cerrar sesión.

Si el código del rechazo es `parte_vacio`, no sale este texto sino el ya firmado
`TEXTOS.parteVacioNoSeFirma` (firmado el 16-sep-2026 en este mismo ticket, comentario 15623).

## Qué cambió

Antes no había texto: la firma rechazada salía de la cola y ninguna pantalla lo decía. El
profesional creía firmado un parte que seguía en borrador.

## Límite aceptado

Con el parte ya abierto cuando se vacía la cola, el aviso no aparece en ese momento: sale al volver
a abrir el parte.

## Límite declarado: el código `invalid_id` (SCRUM-1352, 1-oct-2026)

«Vuelve a firmar el parte» promete que repetir sirve. Con el código `invalid_id` no serviría:
repetir daría el mismo no. Ese código está en la lista de rechazos definitivos de
`colaDeFirmas.js`, así que este texto se pintaría también con él.

Medido el 1-oct-2026 en yaqu.app: **no se alcanza firmando desde el pad**. El servidor sólo
contesta `invalid_id` cuando el id del parte no es un entero, y el pad sólo se abre sobre un parte
que el servidor acaba de entregar con su id entero. Por eso el texto no se cambia ni se calla.

El límite caduca si la firma del parte gana otro origen de `invalid_id` o si el parte pasa a
abrirse sin red. La medición entera está en `docs/master/SCRUM-1352.md`.
