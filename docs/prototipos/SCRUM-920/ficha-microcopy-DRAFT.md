# SCRUM-920 · Los textos de Gastos (rediseño 4/4) — BORRADOR DE FICHA

> ⛔ **ESTO ES UN BORRADOR y NO cuenta como aprobación.** Vive en `docs/prototipos/SCRUM-920/` a propósito: un
> «Texto aprobado» dentro de `docs/microcopy/` pone en rojo `scrum514-aprobado-y-aplicado` hasta que el código lo pinte.
> **Lo mueve la Sesión 2, en el mismo PR que pinta los textos**, a
> `docs/microcopy/2026-09-20-SCRUM-920-textos-de-gastos.md`, y ya lleva la firma con su comentario de Jira (15992).

## Firma

**Aprobado por el orquestador por delegación del fundador** el 20-sep-2026 — SCRUM-920 comentario 15992.

El comentario existe y lo leí en Jira el 20-sep-2026 (creado 2026-09-20T15:22:54+02:00 = 13:22:54 Z; el propio
comentario dice «~13:50Z», que no coincide con la hora de Jira). Firma con tres cambios del orquestador sobre la
propuesta de la Sesión 4, ya incorporados abajo. **Esta línea sólo cuenta cuando la ficha viva en `docs/microcopy/`**
(la lee `constaAprobado`); aquí es un borrador.

## Dónde se pinta

`public/dashboard/js/expensesView.js` (lista y alta) y la vista nueva del detalle del gasto. Prototipo de referencia:
`docs/prototipos/SCRUM-920/gastos.html`.

## Texto aprobado

Con una sola excepción, todo lo de esta lista es NUEVO. La excepción está marcada.

### El alta

> Guardamos la foto como tu copia. Los datos fiscales salen de los campos de abajo.
> 1 · La foto del ticket
> Hazla ahora, que el papel lo tienes delante. Lo demás lo puedes rellenar luego.
> Haz la foto del ticket
> 📷 Hacer foto
> Elegir foto o archivo
> Ahora no tengo el ticket
> Foto guardada
> Si no se lee bien, repítela.
> Verla
> Quitarla
> 2 · Qué es y cuánto
> ✓ Con esto ya se guarda. Lo de abajo es opcional.
> 3 · Datos de la factura del proveedor
> Opcional

### La lista

> Todos · N
> Sin foto · N
> Sin foto
> Sin trabajo
> Todos los trabajos
> Es la suma de lo que estás viendo, no la del mes.
> Ningún gasto con esos filtros
> Prueba con otro mes, otra categoría u otro trabajo.
> Quitar los filtros

**Formato aprobado** (plantillas con hueco; el número y el mes salen del dato):

- `<Mes> de <año> · N gastos` (plural)
- `<Mes> de <año> · 1 gasto` (singular, `1 gasto` literal, sin repetir el número)
- `Todos · N` y `Sin foto · N` (el chip lleva su cuenta)

### El detalle y el «⋯» de la fila

> La foto del ticket
> Ver a tamaño completo
> Cambiar la foto
> De este gasto no guardaste ninguna foto.
> 📷 Añadir la foto ahora
> Datos de la factura del proveedor
> Editar
> Ver trabajo
> Este gasto no cuenta para el margen de ningún trabajo.
> Vincular a un trabajo
> Ver la foto
> 📷 Añadir la foto

## Qué cambió respecto a lo que había

- **Una palabra en un texto firmado por el fundador (SCRUM-324 E3, 10-ago-2026):** «de arriba» → «de abajo». Con la
  foto primero, los campos quedan debajo. Es una posición, no una afirmación fiscal.
- **Tres cambios del orquestador sobre la propuesta de la Sesión 4:** (1) fuera la palabra «justificante» de los tres
  sitios (es un término fiscal y SCRUM-612 decide si se retira): «La foto del ticket» y «Ver la foto»; (2) fuera el
  triángulo: «Sin foto»; (3) el singular «1 gasto».
- **Un literal REUSADO, no nuevo:** «Ver trabajo» ya está firmado (`btnVerTrabajo`, SCRUM-302, `docs/master/SCRUM-302.md`).
  Se usa tal cual en vez de «Ver el trabajo».

## Lo que queda sin firmar en esta pantalla

- Los dos textos de la lectura del ticket con IA (SCRUM-912): «Hemos leído el importe y la fecha de la foto. Revísalos:
  lo que se guarda es lo que pongas tú.» y «leído de la foto». **No se construyen en esta serie.**
- **Aceptar PDF** en la foto: sin decisión (S1 y fundador). Se queda `image/*`.
- Cualquier frase sobre deducibilidad o «qué falta»: **no se propone**; espera al asesor (SCRUM-324 E3).
