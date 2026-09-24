# SCRUM-916 · Medición del prototipo

Chromium 148 local (puppeteer-core), `file://`, 17-sep-2026, rama `scrum-916-prototipo`. Recorrido automatizado en
cada anchura: dictar → ordenar en líneas → aceptar las marcadas → poner las horas al revés y luego bien → conmutar
«sin cobertura» → firmar → inventario.

| Anchura | Errores de consola | Scroll horizontal | Controles < 44 px | Alto de la página |
|---|---|---|---|---|
| 1280 × 900 | 0 | no | **0** | 1.582 px |
| 390 × 844 táctil | 0 | no | **0** | 2.052 px |

## Lo que se vino a arreglar, con la cuenta de antes y la de después

| | hoy en staging | en el prototipo |
|---|---|---|
| ¿Dónde empieza «lo que has hecho»? | el **9.º** bloque, pasados los siete campos administrativos | el **1.º**: a 238 px a 390, a 162 px a 1280 |
| ¿Dónde está la firma? | la **última** cosa de 1.738 px | el 3.º de 4 bloques, a 1.259 px de 2.052 |
| Entrada y Salida | `type="text"` | `type="time"`, con botón «Ahora» |
| ¿Se dice cuánto ha durado la visita? | no | sí: «Tiempo en la obra · 3 h 30 min», calculado |
| ¿Avisa si la salida es antes que la entrada? | no | sí: «Revisa las horas · La salida es antes que la entrada» |
| Campos de texto a la vista al llegar | 7, todos iguales | **5**, y ninguno administrativo (son el dictado y los de las líneas) |
| Bloques administrativos | 5 campos sueltos arriba | **4 plegables, los 4 cerrados**, al final |
| Controles por debajo de 44 px | **19** | **0** |
| Los tres tipos de intervención | radios de 13 × 13 px | fichas de 48 px de alto |

## Los tres pasos, medidos

| paso | alto a 1280 | alto a 390 | empieza en (390) |
|---|---|---|---|
| ① ¿Qué has hecho? | 438 px | 459 px | 238 px |
| ② Horas y desplazamiento | 311 px | 534 px | 711 px |
| ③ Firmas | 236 px | 386 px | 1.259 px |
| Datos del parte (plegado) | 270 px | 270 px | 1.659 px |

## Comportamiento comprobado

| qué | resultado |
|---|---|
| El dictado produce texto y «Ordenar en líneas» se habilita | sí |
| Las líneas salen **con casilla por línea**, todas marcadas | **3 de 3**, y cada una dice de qué parte del dictado sale |
| Las horas al revés se dicen en el sitio | «REVISA LAS HORAS · La salida es antes que la entrada» |
| Las horas bien dan la duración | «TIEMPO EN LA OBRA · 3 h 30 min» |
| Los cuatro plegables llegan cerrados | **4 de 4** |
| Hay `type="time"` de verdad | sí, 2 |
| **El pad sin cobertura dice los dos textos firmados de SCRUM-919** | sí, literales: «Una firma sin nombre no identifica a nadie. Escribe el nombre de quien firma **el parte**.» y «Sin conexión. La firma está guardada en este móvil y se enviará cuando vuelva la señal con YaQu abierto. No hace falta volver a firmar.» |
| Al firmar sin cobertura, la firma queda y se dice | «✓ Lucía Romero · sin enviar» y «1 firma guardada en este móvil» |

## Un defecto REAL que encontró la medida y que la vista no veía

Al firmar sin cobertura, **la firma no se registraba**: el informe decía `firmaCliente: null` mientras la captura se
veía perfecta. La causa: la hoja llevaba `onclick="event.stopPropagation()"` para que tocar dentro no la cerrara, y
eso **impedía que sus propios botones llegaran al manejador**. «Confirmar firma» no hacía nada.

Arreglado en los dos sitios: ahora la hoja se cierra sólo si se toca el fondo o la «×». **El prototipo de SCRUM-917
tenía el mismo patrón y el mismo defecto latente**, y se ha arreglado también allí; se volvió a medir 917 después y
sigue en verde.

> 🔒 Una captura bonita no prueba que el botón funcione. Lo prueba pulsarlo y mirar el estado.

## ⚠️ Una corrección al ticket

El ticket dice que el bloque del dictado «ocupa media pantalla». **Medido: son unos 215 px**, el 24 % de la ventana
de 900 px a 1280 y el 12 % de la página. No es media pantalla. Pero la queja de debajo es correcta y el tamaño no era
el problema: lo que falla es **dónde está** (el 9.º bloque) y que **no parece un dictado** —es un `textarea` vacío con
el rótulo «Usa el micrófono de tu teclado», o sea, el producto le pide al usuario que se busque la vida—. Subirlo al
primer lugar y darle forma de dictado arregla la queja; encogerlo no habría arreglado nada.

## Cómo se contaron los «controles < 44 px»

Las dos exclusiones de siempre, declaradas: la barra negra `.proto` es andamio del prototipo y no cuenta; y un
checkbox de 22 px dentro de una etiqueta de ≥ 44 px cumple, porque el blanco de toque es la etiqueta.

## Qué NO se ha medido aquí

El dictado real (Web Speech API) y la IA que ordena el texto en líneas. El prototipo **simula** las dos: el micrófono
rellena un texto de ejemplo y las líneas propuestas están escritas a mano. Lo que sí se mide es **la forma**: que las
propuestas salgan con casilla por línea, que digan de qué parte del dictado vienen, y que el humano pueda quitar lo
que no cuadre antes de que entre en el parte.
