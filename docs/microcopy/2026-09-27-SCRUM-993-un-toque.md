# SCRUM-993 · «Entregar y enviar a firmar» — un toque para crear, emitir y enviar el albarán

**Aprobado por el orquestador por delegación del fundador** el 2026-09-27 — SCRUM-993 comentario 17261 (rótulo), 17262 (condiciones) y 17263 (texto del fallo de envío y última condición del interino).

## Los literales, tal cual se pintan

`public/dashboard/js/jobDetailView.js`, hoja de alta del albarán (`buildAlbEditor`, llamada desde `openAlbCrearSheet`):

1. «Entregar y enviar a firmar» — rótulo del botón secundario y del botón de continuar de la confirmación.
2. «Esto emite el albarán —los datos del cliente quedan fijos en el documento— y lo envía a firmar por WhatsApp.» — texto de la confirmación, SOLO cuando el cliente tiene teléfono o móvil.
3. ~~«Esto emite el albarán —los datos del cliente quedan fijos en el documento— y lo envía a firmar.»~~ — **RETIRADO** el 2026-09-28 (SCRUM-993 comentario 17327): sin número NO se ofrece el botón (opción A), así que la variante sin canal ya no se pinta en ningún caso. No se sustituye por otro texto.
4. «Albarán emitido — el envío por WhatsApp falló, reenvíalo desde el trabajo.» — aviso (toast, tono `warn`) cuando la cadena crea y emite bien pero el envío por WhatsApp falla (incluido el 409 que LANZA `apiRequest`).
5. «✓ Albarán entregado y enviado a firmar.» — aviso de éxito, aprobado el 2026-09-28 en SCRUM-993 comentario 17327, con condición de verdad: SOLO cuando la respuesta del envío trae `sent === true` (`sendSuccessBody`, `src/lib/sendOutcome.ts`, único sitio que lo pone).
6. «No se pudo completar la entrega. El albarán queda en borrador en este trabajo.» — aviso (toast, `warn`) cuando EMITIR falla después de crear; aprobado el 2026-09-28 en SCRUM-993 comentario 17337. Comprobado antes de pintar: «Borrador» es la palabra con que la ficha del trabajo rotula ese estado (`jobDetAlbEstado`), y la fila aparece en la lista de albaranes de esa ficha al refrescar.

## Por qué estos textos, y no otros

**El rótulo** nombra las DOS acciones que dispara (entregar = crear + emitir; enviar a firmar), no es fiscal y no promete nada que las tres rutas ya existentes no vayan a hacer.

**La confirmación NO pregunta «¿seguro?».** El motivo no es dar un checkpoint bonito de repaso: es que **emitir congela los datos del cliente dentro del documento** (SCRUM-841), y un solo toque congelaría esos datos sin que el profesional lo viera pasar — un paso irreversible detrás de un gesto. La confirmación dice lo que va a pasar, para que el paso irreversible se vea antes de darse.

**Desde el 2026-09-28 (opción A, comentario 17327) el botón solo existe si hay número**, y lo que sigue queda como historia de la 1ª vuelta. **El texto nombraba el canal condicionalmente** porque el envío es *best-effort*: sin número de contacto (o al tope diario de J6) no sale, y decir «por WhatsApp» cuando no va a intentarse sería una promesa falsa. El criterio (`job.customer?.phone || job.customer?.mobile`) es **INTERINO**: el dato preciso (`tieneNumeroDeContacto`, calculado con `canalDeWhatsApp`) solo existe hoy en el detalle del PRESUPUESTO (SCRUM-1166); cuando SCRUM-1171 lo añada también al detalle del Trabajo, la condición se cambia por él. Se acepta divergir del criterio de SCRUM-1166/1171 aquí porque esta condición solo decide si un TEXTO nombra un canal, no si una acción de envío se ofrece — el daño de una discrepancia lo acota la condición 4 (el aviso de fallo).

**El aviso de fallo dice PRIMERO lo que sí pasó.** Si el envío falla después de emitir, el albarán ya está emitido — irreversible — y un aviso genérico («No se pudo enviar por WhatsApp») dejaría creer que no ha pasado nada. Copia la forma de un texto ya firmado que resuelve el mismo problema (SCRUM-126, `collect-rest`: «Cobro creado — el WhatsApp falló, reenvíalo desde Cobros»). «Reenvíalo desde el trabajo» es cierto: la escalera del Trabajo y la fila del albarán (`albaranAccion.js`) ofrecen «Enviar para firmar» sobre un albarán ya emitido, las dos en la misma pantalla.

## Diseño de la interacción

Botón SECUNDARIO en la hoja de alta (`openAlbCrearSheet`/`buildAlbEditor`), junto a «Guardar». **No sustituye ni colapsa la escalera** de `jobNextAction.js` (SCRUM-366): si el envío falla a medio camino, el albarán queda emitido y la escalera sigue ofreciendo «Enviar para firmar» como hoy. Si la escalera de tres pasos es el problema de fondo, eso es un rediseño con su propio ticket (SCRUM-917), no algo que se decide de rebote aquí.

El primer clic en «Entregar y enviar a firmar» NO ejecuta nada: abre un paso de confirmación DENTRO de la misma hoja (mismo patrón que «LA REVISIÓN ANTES DE EMITIR» de facturas, SCRUM-292 — un componente que el profesional ya conoce). Solo el botón de continuar de esa confirmación dispara las tres llamadas encadenadas: crear → emitir → enviar a firmar, reutilizando el ÚNICO sitio de creación que vigila SCRUM-303/606 (`crearAlbaran`).

## Condición de construcción cumplida

`entregar`/`confirmContinuar`/`confirmCancelar` están DECLARADOS en `tests/scrum412-primaria-nunca-es-sm.test.mjs` (acción de modal, no primaria de pantalla). El trinquete de estilos en línea (SCRUM-713c) y el de clases desnudas (SCRUM-666b) no suben: la confirmación reutiliza `.alert.info` y una única clase nueva con regla (`.alb-confirmar-fila`).

## Test de contrato

- `tests/scrum993-boton-un-toque.test.mjs` (DOM real, banco de `_banco-vistas.mjs`): el primer clic no ejecuta nada; el texto de la confirmación varía con/sin teléfono; «Continuar» encadena las tres llamadas en orden con una sola alta; un envío fallido deja el toast con el texto firmado; «Cancelar» no llama a nada; y el CONTROL de que «Guardar» sigue haciendo exactamente una sola llamada de creación, sin emitir ni enviar.
