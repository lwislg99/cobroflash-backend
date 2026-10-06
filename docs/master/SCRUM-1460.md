# SCRUM-1460 · Tras firmar en el pad, la ficha del albarán recuerda mandar la copia

**Medido contra:** `origin/main` = `3746d0351af6b56c88f6a53fce695eef51913d4f` · 2026-10-06T12:12:00Z
A9: sin fallo que generalice — faltaba un texto, no había una conducta rota; lo que se vio del instrumento va abajo, en «Hallazgo del banco»

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y antes de editar). Un aviso nuevo en `public/dashboard/js/albaranDetailView.js` con el componente `.alert` que ya existe (`info` y `warning`), dentro del envoltorio de la caja de firma: sin clases, sin estilos y sin tokens nuevos.

6-oct-2026 · **S4** · rama `scrum-1460-recordatorio-de-la-copia`.

## De dónde viene

El ticket nació como defecto («la copia firmada no se envía nunca») y dejó de serlo al leer SCRUM-15, 47, 49 y 62 enteros: que el pad no envíe sola la copia es el diseño (SCRUM-47, manual a propósito; SCRUM-49 puso el automático sólo para la firma remota). Lo que sí se midió en yaqu.app (c.18315) es que tras «Confirmar firma» no hay nada que recuerde mandarla: lo único que se lee es «A salvo — Guardado en YaQu. Ya no depende de este móvil.»

La decisión está en SCRUM-1460 c.18330: va el recordatorio, el envío automático desde el pad queda descartado y los botones no cambian de sitio. El c.18374 la amplía al caso del pad abierto (abajo).

## Qué cambia

- Dos textos firmados (c.18330), en `TEXTO_COPIA_SIN_ENVIAR` y `TEXTO_COPIA_SIN_WHATSAPP`. Ficha: `docs/microcopy/2026-10-06-SCRUM-1460-recordatorio-de-la-copia.md`.
- `recordatorioDeLaCopia(...)`, puro: decide cuál toca, o ninguno.
- Sale sólo en la ficha que queda al cerrarse el pad, en dos casos: al confirmar la firma (c.18330), y al cerrarlo cuando la firma subió por la cola mientras estaba abierto (c.18374, ampliación pedida desde esta rama: ahí la frase es cierta y hay alguien mirando). El pad se lo dice al refresco (`refrescar({ recienFirmadoEnElPad: true })`) y el refresco a la ficha que pinta; la recarga siguiente ya no lo lleva.
- Va debajo de la caja «A salvo» y encima de los botones, en el mismo envoltorio que la caja.
- Cada texto nombra un botón y sólo sale si ese botón está en la barra. Se mira en los botones ya resueltos, no en una segunda lectura del registro de acciones.
- La barra de acciones se cuelga de la página después de resolver los botones (antes, al crearla). El orden en pantalla es el mismo.

`albaranActionsRegistry.js` no se toca: los botones se quedan como están (firmado en c.18330).

## Decisiones tomadas al construir

- **Si el servidor no dice si el cliente puede recibir WhatsApp**, el botón de enviar se ofrece (así lo resuelve ya el registro) y sale el primer texto. El segundo exige saber que el canal falta.
- **Tono:** `info` para «envíasela», `warning` para «no podemos». `role="status"`, no `alert`: no es un error.
- **Si el envío por WhatsApp falla**, el recordatorio se queda: la ficha no se repinta y el fallo se dice arriba, como antes.

## Verificado, ejecutando

En `tests/scrum1351-viaje-firma-sin-red-albaran.test.mjs`, bloque SCRUM-1460: diez tests sobre la vista, el pad, la cola y el almacén de verdad en el banco. Al montaje se le añaden dos mandos (`cliente`, `respuestaWhatsApp`); lo que afirmaban los tests que ya había no cambia.

- **Contra la vista de antes: 7 rojos.** Los dos que pasaban eran el límite de la cola (una negación, verde por construcción) y «mandarla lo quita», al que le faltaba su suelo: se le añadió.
- **Con el cambio: 44 de 44** (el viaje entero más `tests/scrum379-recarga-sin-await.test.mjs`).
- **Siete mutantes de la vista, los siete mueren** y la base pasa: el aviso de la cola arrastra el recordatorio · sale en toda ficha firmada · el envío por WhatsApp lo arrastra al refrescar · el cierre del pad con la firma subida no lo trae · sin canal dice el primer texto · se cuelga después de la barra · va suelto, fuera del envoltorio.

## Límites, escritos en la firma y no resueltos aquí

- **La firma que sube desde la cola sin el pad abierto** no trae recordatorio: nadie está mirando la ficha.
- **La ficha recargada o reabierta** no lo trae: no sabe si la copia se mandó. Eso pide un dato del servidor (carril S1).
- **Firmar desde la hoja del Trabajo**, si existe ese camino (carril S2): sin mirar.

## Lo que NO está medido

- **En yaqu.app:** nada todavía. Se mide cuando mergee y despliegue, con la cuenta QA (merchant 46) y su albarán `emitido`, firma simulada desde la sonda. Va en el comentario de entrega del ticket.
- **El cliente sin WhatsApp en pantalla:** la cuenta QA no tiene ese caso; en yaqu.app sólo se podrá ver parcheando la lectura.
- **Ancho de los dos textos a 320 px:** sin medir hasta verlo en pantalla. Son 61 y 87 caracteres en un `.alert`, que envuelve.

## Hallazgo del banco, sin tocar

`tests/_banco-vistas.mjs:309` — `insertBefore(h)` ignora el nodo de referencia y pone el hijo el PRIMERO. Una vista que inserte «antes de la barra» quedaría en el banco al principio de la página, y un test de orden mediría otra cosa. Aquí no se usa `insertBefore` por eso. El banco no es de este carril: dicho al orquestador.
