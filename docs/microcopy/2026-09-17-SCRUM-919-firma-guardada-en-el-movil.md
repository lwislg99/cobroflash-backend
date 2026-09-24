# El pad sin red, cuando la firma ya está guardada en el móvil

Aprobado por el orquestador por delegación del fundador · SCRUM-919 comentario 15799

Firmado el 17-sep-2026. **Aplicado en el mismo acto** (regla 30).

## Texto aprobado, literal

> Sin conexión. La firma está guardada en este móvil y se enviará cuando vuelva la señal con YaQu abierto. No hace falta volver a firmar.

## Dónde se pinta

`public/dashboard/js/albaranDetailView.js`, `mensajeDeFalloAlFirmar(e, { encolada })`: dentro del pad de firma del
albarán y del parte, cuando no hay red y la firma SÍ quedó guardada en la cola del móvil. El pad no se cierra sin la
confirmación del servidor (SCRUM-404).

Si la firma NO se pudo guardar en el móvil, se sigue pintando el texto de antes («No se ha podido conectar. La firma
sigue en pantalla: inténtalo otra vez cuando tengas señal.»), que es el verdadero en ese caso.

## Por qué «con YaQu abierto»

La cola se vacía al volver la red y al volver a primer plano, pero sólo con la aplicación abierta: no hay envío en
segundo plano (sin Background Sync en iOS, sin push). El texto no promete lo que no pasa.
