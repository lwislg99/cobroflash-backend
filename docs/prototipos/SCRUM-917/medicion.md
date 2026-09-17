# SCRUM-917 · Medición del prototipo

Chromium 148 local (puppeteer-core), `file://`, 17-sep-2026, rama `scrum-917-prototipo`. Recorrido automatizado en
cada anchura: lista → conmutar «sin equipo» y volver → abrir «Bar El Puerto» → inventario.

| Anchura | Errores de consola | Scroll horizontal | Controles < 44 px | Alto de la lista | Alto del detalle |
|---|---|---|---|---|---|
| 1280 × 900 | 0 | no | **0** | 1.755 px | 1.380 px |
| 390 × 844 táctil | 0 | no | **0** | 3.125 px | 2.285 px |

## Lo que se vino a arreglar, con la cuenta de antes y la de después

| | hoy en staging | en el prototipo |
|---|---|---|
| Filas que repiten la píldora de su cabecera de grupo | **12 de 13** | **0** |
| Acciones primarias verdes en la lista | **12** («Agendar», idénticas) | **1** (la del dinero) |
| Filas que dicen «Sin asignar» con el equipo vacío | **13 de 13** | **0** (la línea no se pinta) |
| ¿Dice la pantalla, en euros, cuánto falta por cobrar? | **no** | **sí**: «Por cobrar · 6.296,31 €», antes de la lista |
| Cifras en la zona del dinero del detalle | **9 apariciones para 2 valores** (590,00 € siete veces) | **3 apariciones para 3 valores** |
| Alto de la cabecera del detalle | 139 px | **121 px** |
| Controles por debajo de 44 px | 32 a 1280 · 26 en el detalle | **0 y 0** |
| Cobrado mayor que el importe | se enseña mudo | se nombra: «⚠︎ cobrado de más · 89,55 €» |

**Cómo se cuenta «la zona del dinero», que es la comparación que importa.** Hoy son tres sitios diciendo lo mismo:
la sección «Qué falta para cobrar», el titular «Total aceptado» con su barra, y el bloque DINERO del rail. Entre los
tres salen nueve importes para dos valores distintos. En el prototipo esa zona es **una franja y una tarjeta**, y se
miden igual: 740,00 € (lo que falta), 1.240,00 € (aceptado) y 500,00 € (cobrado), **una vez cada uno**. Los importes
de cada documento de la lista no entran en la cuenta ni aquí ni allí: son de documentos distintos.

## Comprobaciones de comportamiento

| qué | resultado |
|---|---|
| Con equipo dado de alta, la línea del técnico aparece | sí, en 7 de 13 filas (las que no tienen técnico dicen «Sin asignar») |
| **Sin** equipo dado de alta, esa línea desaparece | sí, **0 de 13**: la misma regla del hueco que SCRUM-651 |
| Las cinco líneas de «El trabajo» llegan cerradas | **5 de 5**, y se abren en el sitio |
| El detalle ya no dice «Qué falta para cobrar» en un Trabajo pagado | correcto: la franja dice «Te falta por cobrar» sólo cuando falta, y los huecos de entrega van en «Lo que falta» |
| El aviso de «cobrado de más» aparece | 1 fila, la que lo tiene |
| Grupos | 🔨 En curso · 📅 Hoy · 📅 Esta semana · ⏳ Sin agendar · 🗓 Más adelante · ✅ Terminados — cobra el resto (con su suma y su salvedad) · 🔒 Cerrados |
| Inventario «antes → después» | 29 filas en 7 grupos, 3 marcadas como **mal decididas** |

## Tres cosas que encontró la propia medición y hubo que arreglar

No se cuentan aquí para hacer bulto: se cuentan porque la primera versión del prototipo tenía los mismos defectos
que venía a quitar, y sin medirla no se habrían visto.

1. **«620,00 €» salía cinco veces en el detalle.** La tarjeta «Lo que falta» repetía la cifra que la franja acababa
   de decir. Ahora «Lo que falta» sólo dice lo que NO es dinero; el dinero lo dice la franja. Si un Trabajo no tiene
   presupuesto —y por tanto no hay franja—, entonces sí se dice ahí, porque si no no se diría en ningún sitio.
2. **La cabecera del detalle medía 186 px**, más que los 139 que venía a arreglar. Se puso en dos columnas en
   escritorio y bajó a 121 px.
3. **El conmutador «con equipo / sin equipo» estaba entre los filtros**, con el mismo aspecto que ellos. Es andamio
   del prototipo, no producto, y un control del prototipo que se parece a uno de la pantalla enseña una función que
   no existe. Se subió a la barra negra de arriba, con los demás controles del andamio.

## Dos fallos de MI instrumento, dichos porque dieron verdes falsos

1. Al pasar el script de medida por PowerShell, el carácter `€` se corrompió y el contador de cifras dejó de
   encontrar ninguna: el informe decía «cifras repetidas: ninguna», que es justo lo que yo quería leer. Se reescribió
   el patrón con `€` y se le puso un **control positivo** (cuántas cifras ve en total): si ve cero, es que está
   ciego, no que la pantalla esté limpia.
2. El selector de «la zona del dinero» metía la primera tarjeta dos veces, así que toda cifra salía ×2. Se vio
   porque **todas** salían exactamente dos veces, que es demasiada casualidad.

## Cómo se contaron los «controles < 44 px»

Dos exclusiones declaradas, las mismas que en SCRUM-915: la barra negra `.proto` es el andamio del prototipo y no
cuenta; y un checkbox de 20 px dentro de una etiqueta de ≥ 44 px cumple, porque el blanco de toque es la etiqueta.

## Los datos del prototipo

Salen de la medición de staging (`inventario-hoy.md`): mismos clientes, mismos importes, mismos estados. Se añaden
un Trabajo «en curso» y dos «terminados» que en staging no había, porque sin ellos no se puede enseñar el momento del
dinero, que es la razón de ser de esta pantalla. El anticipo de «Bar El Puerto» es 500 de 1.240 y **no la mitad justa
a propósito**: con 620 de 1.240, «lo cobrado» y «lo que falta» salen iguales por casualidad y la medida no puede
distinguir si la pantalla repite una cifra o enseña dos hechos distintos.
