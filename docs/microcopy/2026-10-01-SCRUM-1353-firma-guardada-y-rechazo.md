# SCRUM-1353 · el albarán dice la firma que guarda el móvil y el rechazo del servidor

**Aprobado por el orquestador por delegación del fundador** el 2026-10-01 — SCRUM-1353 comentario 17881.

Aplicado en el mismo acto (regla 30). Un texto sin su conducta no está aprobado: las dos van juntas
en ese comentario.

## Texto aprobado

Aviso antes de abrir el pad, cuando ya hay una firma de este albarán en la cola del móvil:

> Ya hay una firma de este albarán guardada en este móvil. Si firmas otra vez, la nueva sustituye a la anterior.

Albarán sin firmar con una firma encolada que el servidor rechazó para siempre al subirla:

> La firma que quedó pendiente no se ha podido registrar. Vuelve a firmar el albarán.

## Texto reutilizado en un contexto nuevo

La caja del estado ① de `public/dashboard/js/estadoFirma.js` (`TEXTO_FIRMA`), ya aprobada para un
albarán firmado, se pinta ahora también en uno que el servidor sigue dando por emitido cuando su
firma está en la cola. No se copia el literal: se pinta la misma caja con `pintarEstadoDeFirma`.

## Dónde se pinta

`public/dashboard/js/albaranDetailView.js`:

- `TEXTO_YA_HAY_FIRMA_GUARDADA` — en el `confirm` de «Firmar aquí mismo». La cola se consulta en el
  clic, no al pintar: quien firma sin red y cancela el pad sigue en la misma pantalla.
- `TEXTO_FIRMA_RECHAZADA_ALBARAN` — `.alert warning`, `role="alert"`, bajo los chips de estado.
- La caja — en el mismo sitio, con `data-firma-guardada-aqui`.

## Qué cambió

Antes, un albarán con su firma guardada en el móvil se reabría igual que uno sin firmar, y firmarlo
otra vez reemplazaba la guardada sin decirlo. Y una firma rechazada al subir la cola salía de ella
sin que el albarán lo contara (sólo lo decía el parte). Medido en SCRUM-1351.

Con una firma guardada ya no se ofrece «Enviar para firmar»: serían dos firmas en dos dispositivos.

## Límites declarados

- **Con el código `invalid_id` el aviso de rechazo NO se pinta.** «Vuelve a firmar» promete que
  repetir sirve, y con ese código repetir da el mismo no. No hay texto firmado para ese caso, así
  que no se dice nada. El texto del parte tiene hoy ese mismo agujero: SCRUM-1352.
- Si hay un rechazo y además una firma nueva en la cola, manda la caja: ya volvió a firmar.
- Si el servidor ya da el albarán por firmado, el rechazo es viejo y no se pinta.
- Si el almacén del móvil no se puede leer, no se pinta nada ni se pregunta nada.
- La caja y la retirada de «Enviar para firmar» aparecen al abrir el detalle. Una pantalla que ya
  estaba abierta cuando se encoló la firma no se repinta sola (defecto declarado en
  `tests/scrum1351-viaje-firma-sin-red-albaran.test.mjs`, de otro carril).

## Guard

`tests/scrum1351-viaje-firma-sin-red-albaran.test.mjs`, bloque SCRUM-1353: cada caso de arriba por
ejecución, con la vista, el pad, la cola y el almacén reales.
