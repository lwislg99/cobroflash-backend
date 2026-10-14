# El aviso del panel antes de crear una revisión

**Aprobado por el orquestador por delegación del fundador** el 13-oct-2026 — SCRUM-1302 comentario 19475.

La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`. Firma la
propuesta de SCRUM-1302 comentario 19456 tal cual, con su conducta y sin estrecharla a `sent`.

## Texto aprobado, literal

W1 · en negrita. `{numero}` es el de la versión sobre la que actúa el botón (la vigente), tal como lo
pinta la lista (`P7`, `P7.1`):

> Al crear la revisión, el enlace de {numero} dejará de valer.

W2 · debajo:

> Quien lo abra verá que hay una versión más reciente y ya no podrá aceptar. Envíale la nueva a tu cliente cuando esté lista.

Los dos botones del aviso son «Crear revisión» (firmado en SCRUM-688) y «Cancelar» (ya firmado en
otras pantallas; la propuesta de c.19456 lo nombraba).

## Dónde se pinta

`public/dashboard/js/quoteRevisiones.js`, `TEXTOS_AVISO` y `pintarAvisoDelEnlace`, en la sección
«Revisiones» de la ficha del presupuesto.

## La conducta firmada con él

1. Sale ANTES del POST. El primer clic no crea nada: pinta el aviso en el sitio, con los dos botones.
   Crea el segundo clic. «Cancelar» lo deja como estaba.
2. Sólo cuando el enlace va a morir: la versión vigente está en `draft`, `sent` o `expired`. Es la
   misma condición que la página del enlace antiguo (`ESTADOS_CON_ENLACE_VIVO`, en los dos
   ficheros), a propósito. No se estrecha a `sent`: copiar el enlace ya es entregarlo y el estado se
   queda en `draft` (SCRUM-1297), así que un borrador no prueba que el enlace no haya salido.
   `expired` entra por c.19636, con la página: su enlace pasa de «caducó» a «hay una versión más
   reciente».
3. El estado ya viaja en cada fila de `revisiones` (`quoteAdmin.ts`): no se toca el servidor.

Lo sujeta `tests/scrum1302p-el-aviso-antes-de-crear-la-revision.test.mjs`.

## Qué cambió

Antes, un clic en «Crear revisión» hacía el POST sin preguntar y saltaba a la ficha nueva, sin un
solo texto que nombrara el enlace del cliente (medido el 13-oct-2026:
`docs/master/evidencias/SCRUM-1302/crear-revision-no-avisa/`).

## Lo que queda sin firmar en esta pantalla

- Un recordatorio en la ficha del borrador nuevo para quien crea la revisión y se olvida de enviarla
  (riesgo declarado en c.19456; otra pantalla y otro texto, no propuesto).
