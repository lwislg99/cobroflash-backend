# SCRUM-917 · Dirección de diseño de la lista de Trabajos y del detalle

Nace de dos capturas del fundador y de una frase: **«parece rudimentario»**. Y de una segunda frase, que es la que
manda: quiere ver de un vistazo **qué toca hacer hoy** y **cuánto falta por cobrar**.

## 1 · La regla que ordena todo lo demás

> 🔒 **Una pantalla correcta puede sentirse pobre, y entonces el arreglo casi nunca es deshacer la decisión: es cómo
> se presenta.**

Casi todo lo que se ve mal en Trabajos está **bien decidido y mal presentado**. Las fusiones de columnas, los grupos,
los candados de la asignación, la escalera de la acción siguiente: todo eso tiene su ticket y su motivo, y sigue
siendo cierto hoy (comprobado en `inventario-hoy.md`). Lo que falla es que **tres columnas de cinco dicen lo mismo en
todas las filas**, que **doce botones verdes idénticos no jerarquizan nada** y que en el detalle **la misma cifra sale
siete veces**.

Hay tres excepciones —tres cosas mal decididas— y van en §4.

## 2 · La lista

**La pantalla contesta las dos preguntas ANTES de la lista.** Dos cifras arriba: «Para hoy · N trabajos» y
«Por cobrar · 6.296,31 €». La segunda **no existe hoy en ningún sitio** de esta pantalla: los filtros cuentan
trabajos, no euros, y para saber cuánto le deben hay que salirse de Trabajos.

**La fila no repite lo que dice su cabecera.** Hoy, bajo «⏳ Sin agendar · 12», cada una de las doce filas vuelve a
poner una píldora «SIN AGENDAR». El grupo ya lo dijo tres píxeles más arriba. La columna «Cuándo» enseña la fecha
cuando la hay, y cuando no la hay no enseña nada.

**La cifra grande pasa a ser lo que falta.** Hoy lo grande es el total del presupuesto y lo que falta va debajo,
pequeño, y dicho al revés: «0,00 € de 417,45 €» obliga a restar. La pregunta del jefe es cuánto le deben.

**Una sola primaria, y es la del dinero.** Doce «Agendar» verdes idénticos no ordenan: si todo es primario, nada lo
es. «Agendar», «▶ Empezar» y «✅ Marcar terminado» siguen exactamente donde están y hacen exactamente lo mismo, en
secundaria. La primaria se reserva para «💰 Cobrar el resto · N €», que es el momento del dinero (AB1). **Ninguna
función se retira**: el «⋯» conserva las seis entradas de hoy.

**La columna de técnicos desaparece como columna** y baja a la línea del cliente, y **sólo si hay equipo dado de
alta**. Con el equipo vacío decía «Sin asignar» en 13 de 13 filas: 122 px que no distinguen una fila de otra. Es la
misma regla que el producto ya aplica con el chip de cobro (SCRUM-363) y con «Total aceptado» (SCRUM-651):
**ausente no es cero, y lo que no consta no se afirma.** El prototipo lleva un conmutador en su barra negra para ver
los dos casos.

## 3 · El detalle

**El dinero se dice una vez.** Hoy «590,00 €» sale siete veces en la misma pantalla: como Aceptado, como Facturado,
como Cobrado, como «TOTAL ACEPTADO» a 2,2 rem, dos veces dentro de «Cobrado 590,00 € de 590,00 €» y otra en el rail.
Nueve importes para dos valores. Aquí hay **una franja**: la cifra grande es lo que falta, al lado el aceptado y el
cobrado, y debajo la barra. Tres cifras, una vez cada una.

**El título es el TRABAJO, no el cliente.** Hoy el nombre del cliente sale cinco veces, tres de ellas en los 139 px
de la cabecera: las migas lo dicen dos veces ellas solas. El cliente ya vive en el rail, entero y con su teléfono.

**«Lo que falta» son huecos, y cada uno lleva su enlace.** Se conserva la idea de SCRUM-320 —enumerar huecos no
exige elegir uno— y se le quita el rótulo que promete dinero cuando lo que falta es entrega.

**Lo que se edita, plegado y en un solo sitio.** Tipo de trabajo, Nombre y dirección, Quién lo ejecuta, Notas y
Gastos eran cinco secciones sueltas que empezaban pasados los 900 px: todas bajo el pliegue, cada una gastando su
cabecera en versalitas. Ahora son cinco líneas plegables dentro de «El trabajo», **cerradas**, cada una con su valor
a la derecha para que no haga falta abrirlas para saber qué hay dentro. Es el mismo patrón que el fundador aprobó en
el editor de presupuesto (SCRUM-915 v3).

**«Incluir precios en el parte» se va dentro del parte.** Hoy es una casilla suelta entre «+ Nuevo albarán» y
«Parte de trabajo». No se toca ni una palabra de su texto: cambia dónde vive, que es donde tiene efecto.

## 4 · 🔴 Lo que sí está mal decidido

1. **La lista no dice cuánto falta por cobrar, en euros.** No es estilo: el dato no está. Es la mitad de lo que el
   fundador quiere ver de un vistazo.
2. **«Qué falta para cobrar» se pinta cuando lo que falta no es dinero.** En un Trabajo PAGADO, con la barra al
   100 % y «Te falta por cobrar 0,00 €», esa cabecera afirma algo falso. Son dos preguntas distintas y se separan.
3. **Cobrado mayor que el importe se enseña mudo.** «539,05 €» arriba y «628,60 € de 539,05 €» debajo, sin una
   palabra. O es legítimo y hay que nombrarlo, o es un defecto y hay que verlo; callarlo es la única opción que no
   vale. ⚠️ **El prototipo propone la FORMA, no la decisión**: saber si cobrar de más es legítimo es del carril de
   la S1, y hasta que lo diga esto no se construye.

## 5 · Lo que NO se toca, y es deliberado

Los grupos y su microcopy aprobada (SCRUM-428) · la tabla compartida con sus cuatro listas hermanas (SCRUM-727b) ·
el candado de que asignar y agendar no se disparan con el gesto de navegar (SCRUM-727b/823) · «Cerrar trabajo» en el
«⋯» con su explicación entera, porque un acto irreversible no es nunca la acción principal (SCRUM-344/823) · la
escalera de `jobNextAction` (SCRUM-31 F4): cambia cuánto pesa en pantalla, no cuál es · la lista fusionada de
documentos (SCRUM-31 F5) · el rail con cliente, presupuesto y responsable (SCRUM-318).

## 6 · Lo que este prototipo NO puede decir

El merchant de staging **no tiene equipo**, así que los 13 «Sin asignar» que medí son texto, no selectores. El
fundador vio en su captura selectores repetidos, que es el caso **con** equipo. Esa repetición no la he medido y no
la afirmo: lo que sí vale para los dos casos es que con el equipo vacío la columna no informa nunca.
