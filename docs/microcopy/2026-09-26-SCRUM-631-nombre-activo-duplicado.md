# SCRUM-631 · nombre cogido al REACTIVAR un producto

**Aprobado por el orquestador por delegación del fundador** el 2026-09-26 — SCRUM-631 comentario 17180.

## El literal, tal cual se pinta

`public/dashboard/js/productsView.js`, `PV_NOMBRE_ACTIVO_DUPLICADO`, usado en la línea 890
(rama `activando` del manejador de «Activar/Desactivar») cuando el servidor devuelve
`name_duplicate` al reactivar:

> Ya tienes otro producto activo con ese nombre.

## Por qué NO es el mismo texto que `PV_NOMBRE_DUPLICADO` (SCRUM-641)

`PV_NOMBRE_DUPLICADO` («Ya tienes un producto con ese nombre») se lee con el campo del nombre
delante, en un ALTA. Al pulsar «Activar» no hay campo que cambiar y el choque es con OTRO
producto que está ACTIVO — el texto lo dice, o el profesional lee un mensaje de alta sobre una
acción que no es un alta.

## Qué cambió, y por qué llevaba 22 días parado

El texto ya estaba escrito desde el 4-sep-2026; lo que faltaba no era redacción, era medir la
caja. La sesión que lo escribió no pudo abrir un navegador en su máquina (`guard-caja-avisos.mjs`
fallaba igual) y dejó el marcador puesto hasta que se midiera de verdad — 22 días bloqueados por
una herramienta, no por una decisión de producto.

## La caja, medida en el DOM renderizado con la CSS real del sitio (mismo método que SCRUM-641)

- 929 px → 1 línea, sobra.
- 390 px → 1 línea: el candidato de 46 caracteres cabe.
- 320 px → 2 líneas (mismo comportamiento que el texto ya aprobado de SCRUM-641).

## Sin salida explícita, a propósito

El botón «Editar» vive en la misma fila que «Activar» y abre el modal donde se cambia el nombre:
la pantalla ya deja el siguiente paso a la vista, así que el texto no necesita repetirlo.
