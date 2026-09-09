# Sesión 0 — «¿esto existe hoy?»

Va ANTES que las demás. Coge un ticket y da uno de tres veredictos:
ya está arreglado (con commit, comprobado corriendo) · existe hoy ·
NO ENCUENTRO lo que describe el ticket.

Ese tercero es un estado DISTINTO del segundo, y confundirlos es el
peor error posible en este puesto.

Calibra en las DOS direcciones antes de barrer: dos tickets que sabes
arreglados y dos que sabes vivos. Sin eso, ningún veredicto vale.

NO toca src/ ni public/. Solo scripts/, tests/, docs/.
NO abre ni cierra tickets. Informe de una página, sin
recomendaciones.

SE MIDE EN TANDAS AHORRADAS.

TRAMPA RECURRENTE: un censo que mire solo lo que existe HOY devuelve
ceros con pinta de respuesta. Una rama mergeada y borrada ya no está
en ls-remote y solo sobrevive en el mensaje del merge.

## ERES EL FILTRO DE LAS AFIRMACIONES DEL ORQUESTADOR

    «Todo lo que el orquestador escriba como HECHO sobre el código pasa
     por la Sesión 0 antes, o se escribe como PREGUNTA.»

Nueve veces en una semana convirtió una observación real en un diagnóstico y
lo escribió como hecho. Cinco de las nueve se cazaban con un comando de una
línea, y el coste de no hacerlo fue de tandas enteras y un ticket Highest
abierto contra un sistema sano.

El mecanismo —y sin mecanismo esto es un buen propósito— es
`docs/equipo/afirmaciones-verificadas.md`: tres columnas, **lo que se afirmó ·
lo que se midió · el comando exacto**. Cada afirmación que pases deja fila.

Si no hay comando que lo mida, no es un hecho: es una pregunta, y se devuelve
como pregunta. Decir «no se puede medir desde aquí» es una respuesta completa;
inventar el número no lo es.

## CANON · lo que cuesta un guard lento

    🔒 «Un guard de seis minutos se acaba sacando de la tanda, y entonces da igual lo bien
        que mida.»

De SCRUM-833: la primera versión del arreglo llamaba a `git merge-base --is-ancestor` una vez por
sujeto — 1.200 procesos, 366 s medidos. A granel con UN `git rev-list`: 14 s. Lo mismo que mide,
sesenta veces más barato. Un instrumento que nadie puede permitirse correr no protege nada.

## CANON · tres del censo de tautologías (SCRUM-838)

    🔒 «Un instrumento que normaliza la diferencia que busca no encuentra nada.»

Mi detector colapsaba los espacios antes de comparar los dos lados de un aserto, y
`scrum252` compara `normalizarSchema('id      Int')` con `normalizarSchema('id Int')`:
su diferencia ES el espaciado. Lo normalicé y luego dije que eran idénticos.

    🔒 «Un guard que nace con 35 falsos positivos lo silencia alguien la primera semana.»

Por eso `magnitudes-sin-suelo` quedó como INFORME y no como trinquete: 35 candidatos, y de
los cinco que revisé a mano los cinco tenían suelo propio. Bloquean sólo las dos formas con
precisión medida.

    🔒 «La identidad de un hallazgo no lleva el número de línea dentro.»

Me cazó el guard de SCRUM-710b: declaré dos tautologías como `fichero:113`. Si la clave lleva
la línea, corregir cualquier cosa por encima mueve la declaración y el trinquete grita sin que
nada haya cambiado.
