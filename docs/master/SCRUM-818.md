# SCRUM-818 · La cabecera del parte deja de mentir: los siete son campos

**Medido contra:** `origin/main` = `f2d1589041d04e5f465cc4deba010f5563ffea72` · 2026-09-07T14:45:48+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-818-parte-de-trabajo`

## PASO 0 — la tabla de los siete, que decidía el ticket

**Ninguno era columna nueva y los siete tenían camino de escritura.** Medido ejecutando
`permisoDeCampos`, no leyendo el código: los siete están en `CAMPOS_CONTENIDO`, editables en
`borrador` y bloqueados en `firmado`, y el `PATCH` los escribe con su tipo.

| Rótulo | Columna | ¿Existe? | ¿Se escribe? | Veredicto |
|---|---|---|---|---|
| Dirección de la obra | `obra String?` | sí | cadena | campo editable |
| REF | `referencia String?` | sí | cadena | campo editable |
| Entrada | `entrada String?` | sí | cadena | campo editable |
| Salida | `salida String?` | sí | cadena | campo editable |
| Desplazamiento | `desplazamientos Int?` | sí | entero validado | campo editable |
| Kilómetros | `kilometros Decimal?` | sí | número validado | campo editable |
| Técnicos | `tecnicos Json` | sí | lista validada | campo editable **y prellenado** |

**Técnicos: prellenado Y editable, las dos cosas.** El parte nacía con `[]` y el técnico reescribía
lo que el sistema ya sabía. Ahora se copian los asignados del Trabajo (SCRUM-650) **al crearlo**, y
a partir de ahí es un campo suyo: **no es un valor derivado que se recalcule**. El parte es la
prueba de lo que PASÓ, no el registro de lo que se planeó, y lo firma un cliente que puede
discutirlo — si al final fue otro, manda quien fue de verdad y **nada lo revierte al guardar**.

## Lo que se hizo

- **Los siete, campos de verdad**, con su clase y sin un `style=` en línea. Desplazamiento y
  kilómetros abren **teclado numérico**.
- **Un parte firmado no abre ni un hueco** (T3, SCRUM-652): se enseña el dato, que es lo contrario
  de dejar la pantalla muda.
- **Las líneas: dos campos con borde**, la cantidad estrecha con teclado numérico y la descripción
  con el ancho. Antes era `2  Tiempo de espera` sin bordes y no se veía dónde tocar.
- **El grupo de los tres tipos ya dice de qué es.** El rótulo **no estrena texto**: «Tipo de
  intervención» lo firmó el fundador en SCRUM-703 para este mismo vocabulario cerrado.
- **Vacío es `null`, no cero.** Borrar los kilómetros es un dato AUSENTE; 0 km es haber ido y no
  recorrer nada. En un papel que se factura no son lo mismo.

## Verificación

- **Capturas con viewport REAL por CDP** (`chrome-headless-shell`), porque el MCP de Playwright no
  conectó en esta sesión (`CONNECT_TIMEOUT`). **390 px: `scrollWidth` 390 = `clientWidth` 390, sin
  scroll horizontal**, con una descripción larga de verdad. 1280: igual.
- **22 objetivos táctiles medidos en el navegador, 0 por debajo de 44 px** en los dos anchos.
- **Cero marcadores** en el DOM en los tres estados.
- **El candado de SCRUM-725, en los dos sentidos**: el aviso aparece con un dato inventado, **en su
  línea y después de la descripción que lo lleva**, y NO aparece con el dato respaldado.
- **BUILD limpio (exit 0) antes de mirar los tests.** Suite y guards en verde.

## Tres premisas del ticket que no se sostenían

1. **Los objetivos táctiles ya estaban hechos** en SCRUM-720d. No eran parte del trabajo.
2. **Las dos reglas de `.parte-quitar-linea` NO eran duplicadas: eran complementarias** —el aspecto
   en una y el área táctil en la otra—. Borrar cualquiera rompía algo, así que **se funden en una**.
   Lo que sí era cierto es el defecto de fondo: una búsqueda encontró sólo la primera y concluyó
   que la «×» no llegaba a 44 px cuando sí llega. Me pasó a mí.
3. El `expiresAt @map("vencimiento")` de `Charge` queda documentado **en el esquema** (SCRUM-722), y
   se comprobó que **no cambia el DDL**: 426 columnas, `deriva-prod.sql` sin cambios.

## Lo que queda, y por qué

**La segunda cabecera de las líneas —la de la descripción— no se pinta todavía.** Su literal es
texto nuevo y lo firma el fundador (regla 30). Poner ahí un marcador lo dejaría a la vista del
técnico, que es justo lo que SCRUM-720 cerró. **Propuesta: «Descripción»**, que es la palabra del
impreso.

---

## Addendum · «Descripción», firmada (7-sep-2026)

El fundador firmó el único texto que quedaba: **«Descripción»**, la cabecera de la segunda columna
de las líneas. Es la palabra del impreso, así que no estrena vocabulario — mismo criterio que
«UNDS», «Mano de obra», «Entrada» o «REF». Consta en
`docs/microcopy/2026-09-07-SCRUM-818-cabecera-de-la-descripcion.md`.

Con eso las líneas ya tienen **las dos cabeceras** que pedía el ticket, y el parte queda **sin un
solo texto sin firmar**.

Y quedan confirmadas dos cosas que se midieron aquí y que el fundador ha dado por buenas:

- **Las dos reglas de `.parte-quitar-linea` no eran duplicadas sino complementarias.** Borrar la de
  arriba, como pedía el encargo, habría dejado la «×» como un botón por defecto. Fundirlas en una
  es lo que cierra el problema que el encargo señalaba mal.
- **Vacío es `null`, no cero.** Borrar los kilómetros es un dato ausente; 0 km es haber ido y no
  recorrer nada. En un papel que se factura no son lo mismo.

⚠️ **Lo que NO se toca, y queda anotado:** a 390 px una descripción larga se ve cortada dentro de su
campo («Sustitución del videogr…»). El dato está entero y el campo hace scroll, pero de un vistazo
no se lee completo. No está en el ticket y no se arregla de paso.
