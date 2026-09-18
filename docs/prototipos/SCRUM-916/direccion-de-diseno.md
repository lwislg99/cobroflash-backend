# SCRUM-916 · Dirección de diseño del parte de trabajo

Nace del fundador: **«parece rudimentario, no un software caro y moderno»**. Y de quién lo usa: **un técnico de pie,
en la obra, con el móvil en una mano y a veces sin cobertura.**

## 1 · La pregunta que ordena la pantalla

> 🔒 **Una pantalla se ordena por lo que se HACE en ella, no por lo que hay que guardar en la base de datos.**

Hoy el parte está ordenado por campos: dirección, referencia, horas, kilómetros, técnicos, tipo… y **lo que el
técnico viene a apuntar —el trabajo— es el noveno bloque**, pasados siete cajas idénticas. La firma, que es lo que
cierra el parte, es lo último de 1.738 px: más de dos pantallas de móvil.

El orden nuevo es el orden del trabajo: **① qué has hecho → ② cuánto has tardado → ③ firmas.** Todo lo demás, que es
administrativo y casi siempre se queda como venía, se pliega al final.

## 2 · ① Qué has hecho

**Primero, y con forma de dictado.** Hoy es un `textarea` vacío con el rótulo «Usa el micrófono de tu teclado. Luego
lo ordenamos» — el producto le pide al usuario que se busque la vida. Aquí hay un botón de micrófono de 76 px, y
debajo, separado por un «o escríbelo», la caja de texto para quien prefiera teclear.

**La voz propone, el humano corrige.** Al ordenar, las líneas salen **con una casilla por línea**, marcadas, y cada
una dice **de qué parte del dictado sale** («de lo que has dictado: "tres horas y media"»). Es el patrón de
`aiQuoteAssistant` que el máster manda copiar, y aquí pesa más que en un presupuesto: **un presupuesto se rehace; un
parte firmado hay que anularlo.**

**El dato que no se puede perder:** el dictado es la **Web Speech API del navegador**, no una API de transcripción.
El audio **no sale del móvil**: sin fichero que guardar, sin coste por minuto y sin superficie RGPD nueva (SCRUM-71).
Lo que usa IA es convertir el TEXTO en líneas, con la gratuita de SCRUM-912.

## 3 · ② Horas y desplazamiento

**La hora se elige, no se escribe.** Hoy Entrada y Salida son `type="text"`: ni teclado numérico, ni formato, ni
nadie comprueba nada. Aquí son `type="time"`, con un botón **«Ahora»** al lado — que es lo que de verdad hace un
técnico: llega y marca.

**Se dice cuánto ha durado.** «Tiempo en la obra · 3 h 30 min». El dato ya existe (es una resta) y hoy no se enseña.
Y si la salida es antes que la entrada, **se dice en el sitio** en vez de dejar pasar un parte imposible.

**Desplazamiento y kilómetros dejan de ocupar 487 px** para dos cifras: campos estrechos con su unidad al lado.

## 4 · ③ Firmas

Un paso propio, con **una caja por firma** y el estado a la vista, en vez de dos botones pegados al final de la
página. Los avisos de hoy («Falta la firma del cliente para cerrar el parte.») se conservan **palabra por palabra**,
dentro de su caja.

⛔ **La firma sin conexión no se toca.** SCRUM-890 y SCRUM-919 la dejaron funcionando y verificada en staging el
17-sep: se encola, el pad dice el texto firmado, y al volver la red la cola se vacía sola sin recargar. El prototipo
lleva un conmutador «Simular sin cobertura» para **enseñarlo**, no para cambiarlo. Lo único que añade es decir
**cuántas firmas esperan** en el móvil, que hoy no se dice.

## 5 · Lo administrativo, recogido

Dirección de la obra, REF, Técnicos, Tipo de intervención y Notas pasan a un bloque «Datos del parte» con cuatro
líneas plegables, **cerradas**, cada una con su valor a la derecha para no tener que abrirlas. Es el mismo patrón que
el fundador aprobó en el editor de presupuesto (SCRUM-915 v3). **No se retira ni un campo**: cambia dónde vive y
cuánto pesa.

Y los tres tipos de intervención dejan de ser radios de **13 × 13 px** —que con el dedo, en obra, no se aciertan—
para ser fichas de 48 px.

## 6 · ⚠️ Donde la medida corrige al ticket

El ticket dice que el bloque del dictado «ocupa media pantalla». Medido: **215 px, el 24 % de la ventana** a 1280.
No es media pantalla. Pero eso no salva la queja: **el problema era el sitio, no el tamaño.** Si me hubiera limitado
a encogerlo, habría arreglado una cifra y no el defecto.

## 7 · Lo que este prototipo no prueba

El dictado real y la IA que ordena las líneas están **simulados**: el micrófono rellena un texto de ejemplo y las
propuestas están escritas a mano. Lo que sí se prueba es la forma —casilla por línea, de dónde sale cada una, y que
se puede quitar lo que no cuadre antes de que entre—. Cuánto acierta la IA con un dictado de verdad es otra medición,
y hace falta hacerla antes de construir esto.
