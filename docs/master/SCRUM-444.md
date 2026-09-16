# SCRUM-444 · los avisos dejan de pisarse

**Medido contra:** `origin/main` = `c47d03655aacd7fe78044f89e7c55a7d467cbb5b` · 2026-08-10T18:59:45+01:00

**10-ago-2026** · sesión 1 · **UI vanilla (regla 4)** · sin gate, corre en `npm test`

Llega un segundo aviso antes de que el profesional termine de leer el primero, y el primero
desaparece. Se queda con la mitad de lo que ha pasado y **sin forma de recuperarla**.

⚠️ **Depende de SCRUM-443**: esta rama sale de `scrum-443-toast-legible`, que aún no está en `main`.
Hay que mergear ése primero.

## PASO 0

* **ENTRADA:** no hay pantalla. El aviso lo dispara **cualquier** acción que termine bien o mal —
  51 llamadas a `showToast` repartidas por 12 ficheros, la mayoría en `jobDetailView.js` (17) y
  `exportView.js` (10). Se llega a esto desde todo el producto, y por eso se rompe en todas partes.
* **MECANISMO: no existe.** `showToast` empezaba con `getElementById('yaqu-toast')?.remove()` y usaba
  un `id` único: **un solo aviso a la vez, por construcción**. No había cola, ni pila, ni nada que
  reutilizar. Aquí sí había que construir.

### Por qué sale ahora

El `remove()` llevaba ahí desde siempre y era invisible porque la ventana de colisión eran 5 s.
**SCRUM-443 alargó los errores hasta 15 s** —correcto y medido— y con ello multiplicó esa ventana.
No es motivo para revertirlo: **arreglar la duración destapó el defecto de al lado.**

## Lo medido antes de elegir la forma

**① ¿Cuándo se dan dos avisos seguidos de verdad?** El caso frecuente **no es** el profesional
haciendo dos acciones: es **el mismo mensaje otra vez**. «No se pudieron guardar las notas» está en
DOS sitios (`jobsView.js:383` y `jobDetailView.js:2593`) y se dispara **al perder el foco**, así que
corregir, volver a salir del campo y volver a fallar produce el mismo texto repetido. De 10 mensajes
de error distintos, 2 aparecen en más de un sitio.

**② ¿Un ÉXITO puede borrar un ERROR?** **Sí, por construcción**: el `remove()` era incondicional y no
miraba el tipo. Y es el caso peor —un «guardado» de 3 s tapando un fallo que se estaba leyendo—, con
30 avisos `ok` frente a 12 `error` en el árbol.

**③ La mezcla de tipos** no existía: sólo cabía uno. Ahora conviven, y sólo los `error` llevan botón
de cierre (SCRUM-443).

## Lo construido — dos reglas, no una

* **Mensajes DISTINTOS → se apilan.** Ninguno se pierde. Pila en columna **inversa**: el más nuevo
  aparece abajo, donde estaba el aviso único de siempre, así que nada salta de sitio bajo el dedo.
* **El MISMO mensaje otra vez → NO se apila: se le reinicia el reloj.** Sale de la medición ①: dos
  copias idénticas ocupan el doble, no dicen nada nuevo y tapan los avisos que sí son distintos.
  «Mismo» es texto **y** tipo: un `ok` y un `error` con el mismo texto son dos avisos, porque dicen
  cosas opuestas.

El reloj se programa en **un solo sitio** (`programarCierre`), para que refrescar un aviso repetido
sea exactamente lo mismo que estrenarlo. En dos sitios, uno acabaría divergiendo del otro sin que
nadie se entere.

**No se toca la duración de SCRUM-443.** Se actualizó UN assert suyo —el que miraba la FORMA del
código, no el comportamiento— porque el reloj cambió de sitio; sigue exigiendo lo mismo: que un
`null` no programe cierre.

## ⚠️ Tres correcciones al banco de vistas, y una de ellas evitó un falso hallazgo

`tests/_banco-vistas.mjs` no era fiel al navegador en tres cosas que este ticket necesita:

1. **`remove()` era un NO-OP** y **`children` no existía** — una vista que gestiona una lista de
   nodos se medía en un DOM donde quitar no quita.
2. **`reg.porId` sólo se rellenaba desde `innerHTML`**, así que un `id` asignado a mano nunca se
   encontraba. 🔴 **Esto iba a producir un falso hallazgo aquí mismo**: la pila no aparecía, se
   creaba una nueva por aviso, y «no se apilan» habría sido culpa del banco.
3. **`porId` no se limpiaba al quitar un nodo**, así que un contenedor borrado se seguía
   «encontrando». **Lo cazó la propia prueba de rojo**: la inyección del defecto salía VERDE porque
   los avisos seguían escribiéndose en la pila muerta.

Las tres van en la misma dirección —hacerlo fiel— y es lo que su propia cabecera pide: *«un banco
infiel no mide de menos: mide OTRA COSA, y su rojo se lee igual que un hallazgo»*. El merge con
`main` trajo además las mejoras de SCRUM-285 al mismo nodo (oyentes que se disparan); **conviven las
dos**.

## Verificado en rojo — con post-condición de que la mutación llegó al disco

| inyección | resultado |
|---|---|
| **devolver el borrado** de la pila al entrar (el defecto original) | **5 tests caen**, incluidos los dos de comportamiento: *«EL PRIMER ERROR HA DESAPARECIDO al llegar el segundo. Quedan 1: ["Segundo error, distinto del primero"]»* y *«UN «GUARDADO» HA BORRADO UN ERROR»* |
| **que el repetido se apile** en vez de refrescarse | *«el mismo mensaje se ha apilado 4 veces… tapan los avisos que sí son distintos»* |
| **CONTROL NEGATIVO**: cambiar un color del aviso | **9/9 verde** — no todo cambio en el fichero los tira |

🔴 **El primer intento del primer rojo salió VERDE en los tests de comportamiento**, y era el banco
(punto 3 de arriba), no el producto. Se corrigió el banco y se repitió: entonces cayeron los cinco.
Un rojo que sale verde por la herramienta es una prueba **no ejecutada**.

## Lo que NO cubre — declarado

* **El tope: cuatro avisos a la vez.** Al llegar el quinto se retira **el más antiguo**, que es el
  que más tiempo ha tenido para leerse. **Es el único caso en que este ticket sigue perdiendo un
  aviso**, y se dice en vez de presentarlo como resuelto. Con cuatro simultáneos ya no hay nada que
  leer: hay una pared.
* **No hay animación de entrada ni salida.** Los avisos aparecen y desaparecen en seco, igual que
  antes.
* **No se agrupan por tipo ni se ordenan por gravedad**: llegan en el orden en que ocurren.

## Ficheros

* `public/dashboard/js/api.js` — la pila, el refresco del repetido y `programarCierre`.
* `tests/_banco-vistas.mjs` — las tres correcciones de fidelidad.
* `tests/scrum444-avisos-no-se-pisan.test.mjs` (nuevo, 9 tests, sin gate).
* `tests/scrum443-toast-legible.test.mjs` — un assert reapuntado a `programarCierre`.
