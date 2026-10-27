# El botón de crear revisión, y su aviso de fallo

**Aprobado por el fundador** el 16-sep-2026, en **SCRUM-688**.
**Aplicado en el mismo acto** (regla 30).

## Textos aprobados, literales

> Crear revisión

> No se ha podido crear la revisión. Vuelve a intentarlo.

## Dónde se pintan

`public/dashboard/js/quoteRevisiones.js` — el bloque de revisiones de la ficha de un presupuesto.

- **`Crear revisión`** es el rótulo del único botón que esa pantalla ofrece. Se pinta **sobre la
  versión vigente**, que decide el servidor, y llama a `POST /admin/quotes/:id/revisiones`.
- **`No se ha podido crear la revisión. Vuelve a intentarlo.`** es el aviso cuando ese POST falla
  **sin que el servidor mande un motivo propio**. Cuando sí lo manda —`quote_not_found`,
  `quote_sin_numero`, `revisiones_ambiguas`— se enseña **el suyo**, no éste: el motivo no se
  inventa.

  *(Corregido el 9-oct-2026, SCRUM-1150. La frase de arriba describe lo que la pantalla hacía el
  16-sep y se deja como estaba; ya no es así. El texto aprobado NO cambia. Lo que cambia es cuándo
  sale: la pantalla decide por el código, `quote_not_found` y `quote_sin_numero` tienen literal
  propio y firmado, y `revisiones_ambiguas` dejó de existir: son cuatro códigos y hoy todos leen
  este general. El detalle, en la ficha de SCRUM-1150 de este mismo directorio.)*

## De dónde venían

Nacieron el **15-sep-2026**, con el POST, en un bloque `TEXTOS_SIN_APROBAR` **separado a
propósito** de los seis rótulos firmados el 3-sep-2026, y con un centinela que se leía en la
propia pantalla —`⛔ PENDIENTE DE MICROCOPY (SCRUM-688)`— para que, si llegaba a producción sin
firmar, se viera solo. Esta sesión **no escribió ninguno de los dos**: los marcó y los pidió.

Con la firma, **el bloque de pendientes desaparece entero**. No se deja vacío: una caja que ya no
distingue nada sólo puede engañar al que la lea después.

## Voz

`No se ha podido crear la revisión. Vuelve a intentarlo.` está en la voz pasiva de la casa —«no se
ha podido», nunca «no hemos podido»—, la misma del aviso de abrir el parte (SCRUM-402) y la de los
otros dos rótulos de esta pantalla (`No se ha podido leer el historial de revisiones.`).

## Qué queda sin firmar en esa pantalla

**Nada.** Medido tras aplicarlo: cero apariciones de `PENDIENTE DE MICROCOPY` en
`quoteRevisiones.js`, y sus **ocho** rótulos —seis del 3-sep, dos de hoy— tienen aprobación en
registro.
