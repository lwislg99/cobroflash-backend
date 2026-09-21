# «El trabajo», plegable, en el detalle del Trabajo — SCRUM-917g

**Aprobado por el orquestador por delegación del fundador** el 2026-09-21 — SCRUM-917 comentario 15881.

**Aprobado por el orquestador por delegación del fundador** el 2026-09-21 — SCRUM-917 comentario 16142.

**Aplicado en el mismo acto** (regla 30), en el corte 917g: `public/dashboard/js/jobTrabajoPlegable.js`
(los literales, en `TEXTOS_EL_TRABAJO`, fuente única) y `public/dashboard/js/jobDetailView.js` (que los lee).
La delegación es la permanente de `docs/equipo/limites-del-fundador.md`, sección «Delegación permanente»,
línea de microcopy.

Dos firmas, y cada una cubre lo suyo:

- **Comentario 15881** — todos los textos de `docs/prototipos/SCRUM-917/textos-propuestos.md`, «El detalle»,
  salvo los dos de «cobrado de más», que el comentario 15994 deja **NO firmados** también en el detalle.
- **Comentario 16142** — SÓLO «1 gasto» y «N gastos» para la línea de gastos cuando hay gastos (con N = 0 se
  queda «Sin gastos», ya firmado en el 15881). Y una decisión que no es un texto: se quita la casilla
  «Incluir precios en el parte» de la barra de Documentos (más abajo, «Qué se retira»).

## Textos aprobados, literales

Los dichos por el comentario **15881**:

> El trabajo

> Nombre y dirección

> Quién lo ejecuta

> Sin nombre

> Sin gastos

> No tienes equipo

> Por ejemplo: cambio de cuadro en el 3º B

> El nombre es lo que verás en la lista. Si lo dejas vacío, se usa el del cliente.

> Lo que necesites recordar de este trabajo.

> Dar de alta a alguien

Los dichos por el comentario **16142**:

> 1 gasto

> N gastos

## Lo que ya existía y sólo cambia de sitio

No se firman ahora: constan en sus fichas y en el producto. Se listan para que quien busque dónde viven
hoy los encuentre.

| texto | dónde estaba | dónde está ahora |
|---|---|---|
| «Tipo de trabajo» | título de la sección suelta | rótulo de la primera línea de «El trabajo» |
| «Notas internas» | título de la sección suelta (10-ago-2026, SCRUM-427) | rótulo de la línea de notas |
| «Gastos de este trabajo» | título de la sección suelta | rótulo de la línea de gastos |
| «Sin asignar» | valor del selector de quién ejecuta (firmado el 4-sep-2026) | valor cerrado de la línea «Quién lo ejecuta» |
| «Solo tú las ves» | píldora de la sección de notas (la misma que en Presupuestos) | valor cerrado de la línea de notas |

## Dónde se pinta

| texto | dónde |
|---|---|
| «El trabajo» | título de la tarjeta que agrupa las cinco líneas, tras Documentos |
| «Nombre y dirección» · «Quién lo ejecuta» | rótulos de sus líneas |
| «Sin nombre» | valor cerrado de «Nombre y dirección» cuando el Trabajo no tiene nombre |
| «Sin gastos» · «1 gasto» · «N gastos» | valor cerrado de la línea de gastos, según cuántos haya |
| «No tienes equipo» | valor cerrado de «Quién lo ejecuta» SÓLO cuando se leyó el equipo y no había nadie a quien asignar |
| «Por ejemplo: cambio de cuadro en el 3º B» | marcador del campo del nombre del Trabajo |
| «El nombre es lo que verás en la lista. Si lo dejas vacío, se usa el del cliente.» | explicación, junto al campo del nombre |
| «Lo que necesites recordar de este trabajo.» | marcador del campo de notas |
| «Dar de alta a alguien» | botón del caso sin equipo; lleva a la pantalla de equipo |

## Qué cambió, y por qué

- **Antes:** Tipo · Datos · Quién ejecuta · Notas internas · Gastos eran cinco secciones sueltas, cada una
  con su cabecera. A 390 px las cinco quedaban bajo el pliegue (medido en
  `docs/master/evidencias/SCRUM-917/salida-paso0-detalle-f.txt`).
- **Ahora:** son cinco **líneas** de una sola tarjeta, cerradas, con su valor a la derecha para saber qué
  hay dentro sin abrirlas.
- **«Datos» pasa a llamarse «Nombre y dirección»:** es la misma sección; cambia la palabra que firmó el
  fundador.
- **El marcador de las notas ya no es el de Presupuestos, a propósito.** Antes decía «Anota detalles del
  trabajo, acuerdos verbales, recordatorios…» en las dos pantallas; ahora el detalle del Trabajo lleva el
  firmado arriba. Lo vigila `tests/scrum427-notas-internas-detalle.test.mjs`, que exige el literal firmado
  y que el viejo no vuelva.
- **Tres casos de una línea cerrada que NO se mezclan** («Quién lo ejecuta»): hay nombres → los nombres;
  no hay y se SABE que no hay a quién asignar → «No tienes equipo»; no hay y sí hay equipo (o no se sabe)
  → «Sin asignar». «No tienes equipo» no se dice por defecto: sería afirmar lo que no se sabe.
- **Sin dato, la línea de gastos no dice nada** (ni «Sin gastos»): una lista que no se pudo leer y una
  lista vacía se leen igual en pantalla, y una de las dos manda a meter otra vez un gasto ya guardado.

## Qué se retira (no son textos nuevos)

- **La casilla «Incluir precios en el parte» sale de la barra de Documentos** y se queda SÓLO la de dentro de
  la hoja de alta del albarán (decisión del comentario 16142). «Dentro del parte» es esa hoja, no el
  `ParteTrabajo`.
- **El botón «Cambiar» del tipo de trabajo** ya no existe como botón suelto: la propia línea «Tipo de
  trabajo» es el control, y al abrirla se elige entre las dos tarjetas de siempre. El prototipo aprobado
  (`docs/prototipos/SCRUM-917/`) no lo lleva. Al técnico, que no puede cambiar el tipo,
  la línea abierta le explica por qué (la nota que ya existía), en lugar de un «Cambiar» deshabilitado.

## Lo que esta ficha NO firma

- **Ninguna suma de importes en la línea de gastos.** SCRUM-370 y SCRUM-403: sin totales, y no consta si el
  importe guardado es base o con IVA.
- **El marcador de dirección del prototipo** («Calle, número, piso»): no está en `textos-propuestos.md`, así
  que se queda el de hoy.
- **El emoji del tipo** en el valor de la línea.
- **El bloque «Quién lo ejecuta» del rail** (fila 579 del prototipo): exige un sexto bloque en el censo del
  rail y un rótulo en mayúsculas que no está firmado así. Propuesta de corte aparte.
- **Los dos textos de «cobrado de más»** (comentario 15994): siguen sin firmar también aquí.
