# SCRUM-904 · aviso de pestaña en el checklist de configuración

**Aprobado por el orquestador por delegación del fundador** el 2026-09-26 — SCRUM-904 comentario 17138.

## El literal, tal cual se pinta

`public/dashboard/js/settingsSubmenus.js`, `checklistEstaEnLaPestana(rotuloCampo, rotuloPestana)`,
usado en la fila del checklist de `settingsView.js` (`renderReadinessCard`) para cada acción con
`focus` que sigue pendiente:

> «{rótulo del campo}» está en la pestaña {pestaña}.

Ejemplo real, con los datos de hoy: «"NIF/CIF" está en la pestaña Empresa.»

## Qué cambió

Antes «Completar →» llevaba a la pestaña correcta (arreglado en la primera pasada de SCRUM-904,
17-sep) pero no la nombraba antes de llegar. Este aviso sale bajo la descripción de cada acción
pendiente que apunta a un campo (`focus`), no a la fila de Connect (que tiene su propio texto y no
usa `focus`).

## Por qué NO es el mismo texto que SCRUM-894

`avisoFaltaEnOtraPestana` (SCRUM-894) empieza con «Para guardar, rellena…» porque ese aviso sale al
fallar un intento de GUARDAR. Aquí nadie está guardando: se navega desde una lista de pendientes, y
«Para guardar» sería falso.

## Condición de la firma

Rótulo del campo y rótulo de la pestaña salen SIEMPRE de lo que la pantalla ya muestra (el
`<label>` real del campo, leído del DOM; `rotuloDeSubmenu()` para la pestaña) — nunca de un nombre
interno escrito a mano. Así el texto no puede desfasarse de la pantalla.
