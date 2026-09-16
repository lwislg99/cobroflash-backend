# SCRUM-597 · Los cinco rótulos de «quién lleva el documento»

**Aprobado por el fundador el 8-sep-2026**, literal: «me parecen genial los rótulos».

Aplicados en el mismo acto en `public/dashboard/js/documentoAsignados.js`, el selector que
comparten la ficha del presupuesto y la de la factura.

| Ranura | Texto aprobado |
|---|---|
| Etiqueta del campo | `Responsable` |
| Cuando no hay nadie asignado | `Sin asignar` |
| Si un técnico intenta cambiarlo | `Solo un administrador puede cambiar el responsable.` |
| Si aún no hay equipo | `Aún no tienes a nadie en tu equipo. Añade a alguien en Equipo.` |
| Si falla el guardado | `No se ha podido guardar el responsable. Inténtalo otra vez.` |

## Lo que esta firma apaga

Los cinco nacieron con `[PENDIENTE microcopy oficial]` y se veían en pantalla a propósito: el
mecanismo no existe sin texto —un selector sin rótulos no se puede usar—, y el marcador era la
única forma de que nadie encendiera por descuido un texto sin firmar.

Con la firma, el marcador **desaparece**: se retiran la constante `MARCA_DOC_ASIGNADOS` y su
contador `DOC_ASIGNADOS_SIN_APROBAR`, y las entradas de `documentoAsignados.js` se **borran** de
los dos censos —SCRUM-402 (marcas escritas) y SCRUM-755 (sitios pintados)—, que es lo que
corresponde cuando no queda ninguno (SCRUM-424 / SCRUM-405: la entrada se borra, no se pone a 0).

## Una nota sobre el rótulo, para que no sorprenda al leer el código

El rótulo firmado es **«Responsable»**, en singular, y el dato de debajo admite **varios**: la
tabla puente `quote_assignees` / `invoice_assignees` es N a N y el selector es de casillas.

No es una incoherencia: la palabra que ve el profesional y el nombre interno del dato no tienen
por qué coincidir, y aquí no coinciden a propósito. Queda dicho aquí porque quien lea
`asignados` en el código y «Responsable» en la pantalla se lo va a preguntar.
