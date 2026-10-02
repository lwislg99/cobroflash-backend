# SCRUM-1422 · La ficha abierta del parte se entera de que su firma ha subido

**Medido contra:** `origin/main` = `b06d474d32e59e2bb04b62fa7fcaf5c3c84fb486` · 2026-10-02T12:54:34Z
A9: comprobación → `tests/scrum1422-el-parte-escucha-la-cola.test.mjs`

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y antes de editar). Cambio de lógica en `public/dashboard/js/parteDetailView.js`: sin marcado, sin estilos y **sin texto**.

2-oct-2026 · **S4** (`s4-2octb`) · rama `scrum-1422-el-parte-escucha-la-cola`, **apilada** sobre `scrum-1420-la-ficha-recuerda-el-aviso` (PR #2154, mi mitad de SCRUM-1420, aún sin mergear al escribir esto).

## PASO 0 · el defecto existía, y no era el de SCRUM-1420

El orquestador preguntó si el parte tenía el hueco de SCRUM-1420 (olvidar el aviso de la cola cuando llega con el pad abierto). Medido **ejecutando**, con una sonda sobre `tests/_banco-almacen-local.mjs` y el código de `origin/main` `a2fe215e`:

| Paso | Resultado |
|---|---|
| Pintar la ficha | suscripciones a `alConfirmarseFirmas`: **0** |
| Firmar sin red | la firma queda en la cola (`firma:parte:7`) |
| Vuelve la red, se vacía la cola | sube, y la cola **sí avisa** (`{tipo:'parte', documentoId:7}`) |
| La ficha después | sigue ofreciendo firmar; **0** lecturas |
| Control: repintar a mano | deja de ofrecer firmar y dice que ya firmó |

O sea: la ficha sabía pintar «firmado»; nadie se lo decía. No oía el aviso **nunca**, tampoco con el pad cerrado.

## Qué cambia (`parteDetailView.js`)

- La ficha se suscribe a `alConfirmarseFirmas` (contrato en `docs/master/SCRUM-1373.md`), sólo por los recuadros que aún no están firmados (`parte`, `parte-tecnico`) y sólo por SU parte.
- Con el pad cerrado, se pone al día al llegar el aviso.
- Con el pad abierto **no** se repinta: se apunta, y se pone al día cuando el pad avisa de que se cerró (`onClose`, contrato en `docs/master/SCRUM-1420.md`). `firmarParte` pasa `onClose` en el mismo objeto de opciones, así que le llega igual al pad real que al inyectado.
- Una ficha que ya no está en pantalla se suelta sola, y cada pintado suelta la escucha del anterior.
- **Se lee antes de pintar.** Si la lectura falla, la ficha se queda como estaba. `renderParteDetailView` gana un cuarto argumento, `parteYaTraido`, para pintar lo ya leído; no va en `opciones` porque las opciones se heredan en cada repintado.

## Decisión tomada al construir (aceptación 5)

Con la firma ya subida y la lectura fallando había dos salidas sin texto nuevo: tapar la ficha con «no se pudo cargar» o dejarla como estaba. Se deja como estaba: el técnico no ha hecho nada y la pantalla no debe romperse sola. **Lo que eso deja sin arreglar:** en ese caso la ficha sigue ofreciendo firmar hasta que se reabra. Es el estado de antes de este ticket, no uno nuevo.

## Verificado, ejecutando

`tests/scrum1422-el-parte-escucha-la-cola.test.mjs`, 9 tests. Código real de la vista, la cola y el almacén; el pad es fingido, deja `[data-sp-aviso]` en el documento y cumple el contrato de cierre.

- **Antes del cambio: 5 rojos, 4 verdes.** Rojos: firma del cliente, firma del técnico, pad abierto y luego cerrado, reabrir la ficha, lectura que falla (su suelo: nadie intentaba leer). Verdes, los cuatro controles de «no pasa nada»: cierre sin aviso, firmar con red, aviso de otro documento, ficha fuera de pantalla.
- **Después: 9 de 9.**

⚠️ Para quien escriba otro test del cierre: los pads falsos de `scrum890b` y `scrum919` sólo guardan `onConfirm`. Un test del cierre tiene que llamar él a `onClose`, o no mide nada.

## Lo que NO está medido, y lo que queda fuera

- **No visto en yaqu.app.**
- El pad real con la ficha del parte: aquí el pad es fingido. El real lo mide `tests/scrum1420-el-pad-avisa-al-cerrarse.test.mjs`, solo.
- Si el aviso llega mientras el técnico escribe en un campo de un parte que acaba de firmarse, la ficha se repinta y lo tecleado no guardado se pierde. El servidor ya no lo aceptaría (el parte está firmado), pero no lo he ejecutado.
- Fuera: la ficha del parte no dice que hay una firma guardada en el móvil, ni pregunta antes de reemplazarla (lo que SCRUM-1353 hizo en el albarán). Pide texto: ticket aparte.
