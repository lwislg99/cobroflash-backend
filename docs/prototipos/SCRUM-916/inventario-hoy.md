# SCRUM-916 · El parte de trabajo de HOY, medido

Medido en **staging** el 17-sep-2026 sobre `fa9ff832`, con la sesión QA, sobre el parte **PT-2026-007** (cliente Lucía
Romero, con una línea de mano de obra). A 1280 × 900 y a 390 × 844 táctil. Capturas en `capturas/`.

## 1 · Los campos, uno a uno

| campo | tipo real | ancho a 390 | ancho a 1280 |
|---|---|---|---|
| Dirección de la obra | `text` | 366 px | 487 px |
| REF | `text` | 366 px | 487 px |
| **Entrada** | **`text`** | 366 px | 487 px |
| **Salida** | **`text`** | 366 px | 487 px |
| Desplazamiento | `number` | 366 px | 487 px |
| Kilómetros | `number` | 366 px | 487 px |
| Técnicos | `text` | 366 px | 487 px |
| Tipo de intervención | 3 × `radio` | **13 × 13 px** | 13 × 13 px |
| Dicta lo que has hecho | `textarea` | 366 × 88 px | 984 × 88 px |
| UNDS (línea) | `number` | 80 px | 80 px |
| Descripción (línea) | `text` | 184 px | 802 px |
| Notas | `text` | 366 px | 487 px |

| | 390 | 1280 |
|---|---|---|
| alto total de la página | **1.738 px** (ventana 844) | 1.403 px (ventana 900) |
| scroll horizontal | no | no |
| controles por debajo de 44 px | **19** | **19** |

## 2 · Lo que estas cuentas significan

**① Entrada y Salida son cajas de texto.** Medido: `type="text"`. No hay selector de hora, no sale el teclado
numérico, no hay formato y nadie valida que la salida sea después de la entrada. Es el campo que un técnico rellena
de pie, con una mano, y es el que peor está.

**② Siete campos idénticos antes de nada.** Dirección de la obra, REF, Entrada, Salida, Desplazamiento, Kilómetros y
Técnicos: **el mismo tipo de caja, el mismo alto (44 px) y el mismo ancho**. A 1280 son siete rectángulos vacíos de
487 px que llenan la primera pantalla. Nada dice cuál importa, porque todos pesan igual.

**③ Y son campos administrativos.** Ninguno de los siete es «lo que he hecho». Lo que el técnico viene a apuntar
—el trabajo— empieza **después** de los siete, pasados unos 550 px a 1280.

**④ «Desplazamiento» y «Kilómetros» ocupan 487 px para un número de dos cifras.** Son `number`, que está bien, pero
a todo el ancho y sin unidad a la vista.

**⑤ Los tres radios del tipo de intervención miden 13 × 13 px.** Con el dedo, en obra, eso no se acierta. Son parte
de los 19 controles por debajo de 44 px.

**⑥ La firma queda al final de 1.738 px.** A 390 hay que recorrer **más de dos pantallas** para llegar a lo que
cierra el parte. Y los dos botones salen pegados: el texto de la página los lee como
«Firmar aquí mismoFirma del técnico».

**⑦ Mano de obra y Materiales son dos tablas de dos columnas** con cabecera «UNDS · Descripción», una con una línea y
otra con «Todavía no has apuntado nada.»

## 3 · ⚠️ Una corrección al ticket, medida

El ticket dice que «"Dicta lo que has hecho" + "Ordenar en líneas" **ocupan media pantalla**». No es media pantalla:
el `textarea` mide 88 px y el botón 44, y con sus rótulos el bloque entero son **unos 215 px**, o sea el **24 % de la
ventana de 900 px** a 1280, y el **12 % de la página entera**.

**Pero la queja de debajo es correcta, y el tamaño no era el problema.** Lo que falla es **dónde está** —después de
los siete campos administrativos, cuando debería ser lo primero— y que **no parece un dictado**: es un `textarea`
vacío con un rótulo encima que dice «Usa el micrófono de tu teclado», o sea, el producto le pide al usuario que se
busque la vida con el teclado del móvil. Mover el bloque arriba y darle forma de dictado arregla la queja; encogerlo
no habría arreglado nada.

## 4 · Orden de la pantalla hoy, de arriba abajo

1. PT-2026-007 · nombre del cliente
2. Dirección de la obra · REF
3. Entrada · Salida
4. Desplazamiento · Kilómetros
5. Técnicos
6. Tipo de intervención (3 radios)
7. **Dicta lo que has hecho** + «Ordenar en líneas»
8. Mano de obra (tabla UNDS · Descripción) + «Añadir línea»
9. Materiales (tabla UNDS · Descripción) + «Añadir línea»
10. Notas
11. «Firmar aquí mismo» · «Firma del técnico» + «Falta la firma del cliente para cerrar el parte.» y
    «Falta la firma del técnico para cerrar el parte.»

**Lo que el técnico viene a hacer es el 7 y el 11. Están en el séptimo y el undécimo lugar.**

## 5 · Lo que NO se toca

- **La firma sin conexión** (SCRUM-890 y SCRUM-919) funciona igual: se encola, el pad dice «Sin conexión. La firma
  está guardada en este móvil y se enviará cuando vuelva la señal con YaQu abierto. No hace falta volver a firmar.»,
  y al volver la red la cola se vacía sola. Verificado en staging el 17-sep. **Este rediseño no lo roza.**
- Los avisos «Falta la firma del cliente para cerrar el parte.» y «Falta la firma del técnico para cerrar el parte.»
  son texto de hoy: se conservan literales.
- «El parte sigue sin ser una factura.», «Todavía no has apuntado nada.», «Ordenar en líneas», «Añadir línea»,
  «Firmar aquí mismo», «Firma del técnico», los tres tipos de intervención: literales.
- El dictado va por la **Web Speech API del navegador**, no por una API de transcripción: el audio no sale del móvil
  (SCRUM-71). Ordenar el texto en líneas sí usa la IA, la gratuita de SCRUM-912.
