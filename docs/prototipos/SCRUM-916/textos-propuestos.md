# SCRUM-916 · Textos NUEVOS, propuestos y SIN firmar

En `parte-de-trabajo.html` salen subrayados (interruptor de la barra negra). Todo lo que NO está aquí ya existe hoy
en el producto y se reutiliza **literal**. Pendientes de firma (regla 30).

## ① ¿Qué has hecho?

| texto | qué es |
|---|---|
| «¿Qué has hecho?» | el título del primer paso. Hoy el rótulo es «Dicta lo que has hecho», que nombra el medio y no la pregunta |
| «Cuéntalo como se lo contarías a un compañero. Lo ordenamos en líneas y tú lo corriges.» | la guía del paso |
| «Toca y habla. No hace falta que sea ordenado.» | bajo el micrófono, en reposo |
| «Escuchando… toca para parar.» | mientras dicta |
| «o escríbelo» | el separador entre dictar y teclear |
| «Por ejemplo: he estado tres horas cambiando el compresor y he puesto dos metros de tubo.» | marcador del campo de texto |
| «Esto es lo que he entendido. Quita lo que no cuadre.» | encabeza las líneas que propone la IA |
| «de lo que has dictado: «tres horas y media»» | bajo cada línea propuesta: **de dónde sale**, para poder juzgarla |
| «Añadir las líneas marcadas» | el botón que las mete en el parte |
| «Se apunta en el parte. Podrás cambiarlo antes de firmar.» | dice que no es irreversible |

**Se conservan literales:** «Ordenar en líneas», «Mano de obra», «Materiales», «Añadir línea»,
«Todavía no has apuntado nada.»

## ② Horas y desplazamiento

| texto | qué es |
|---|---|
| «Horas y desplazamiento» | el título del segundo paso |
| «La hora se elige, no se escribe.» | la guía |
| «Ahora» | el botón que pone la hora actual |
| «Tiempo en la obra» + «3 h 30 min» | la duración, que **hoy no se dice en ningún sitio** aunque el dato ya existe |
| «Revisa las horas» + «La salida es antes que la entrada» | lo que hoy nadie comprueba |
| «horas» · «km» | las unidades al lado del campo |

**Se conservan literales:** «Entrada», «Salida», «Desplazamiento», «Kilómetros».

## ③ Firmas

| texto | qué es |
|---|---|
| «Firmas» | el título del tercer paso |
| «Sin las dos firmas el parte no se cierra.» | la guía |

**⛔ NADA de la firma sin conexión se toca.** Estos dos son los textos FIRMADOS de SCRUM-919 (comentario 15799) y
salen literales, palabra por palabra:
- «Una firma sin nombre no identifica a nadie. Escribe el nombre de quien firma el parte.»
- «Sin conexión. La firma está guardada en este móvil y se enviará cuando vuelva la señal con YaQu abierto. No hace
  falta volver a firmar.»

Y también se conservan literales: «Firmar aquí mismo», «Firma del técnico», «Confirmar firma», «Nombre de quien
firma», «Falta la firma del cliente para cerrar el parte.», «Falta la firma del técnico para cerrar el parte.», y el
aviso de sin cobertura del panel («Sin cobertura. Ves lo que ya tenías en el móvil; lo demás se cargará cuando vuelva
la conexión.»).

| texto | qué es |
|---|---|
| «N firma guardada en este móvil» / «N firmas guardadas en este móvil» | cuántas hay en la cola, en la franja de sin cobertura. Hoy el panel dice que no hay cobertura pero **no dice cuántas firmas esperan** |

## Datos del parte (el bloque plegado)

| texto | qué es |
|---|---|
| «Datos del parte» | el título del bloque |
| «Obra y referencia» | agrupa Dirección de la obra y REF |
| «La del trabajo, si no pones otra» | marcador de la dirección |
| «Tu referencia interna, si usas alguna» | marcador de REF |
| «Los del trabajo» · «Sin elegir» · «Solo tú» · «Sin notas» | los resúmenes que se ven con cada línea cerrada |
| «Quién más ha estado en la obra» | marcador de Técnicos |
| «Lo que haya que dejar dicho.» | marcador de Notas |

**Se conservan literales:** «Dirección de la obra», «REF», «Técnicos», «Tipo de intervención»,
«Reparación / asistencia», «Mantenimiento», «Instalación», «Notas».

## La cabecera y la barra de abajo

| texto | qué es |
|---|---|
| «Sin cerrar» / «Firmado» | el estado del parte, que hoy no se dice |
| «Sin cobertura» (píldora) | — |
| «N líneas» / «Sin líneas todavía» · «Sin horas» | lo que lleva puesto, en la barra |
| «Cerrar el parte» | la acción final, deshabilitada hasta que se pueda |

## 🔴 Lo que NO propongo

- **Nada del camino de la firma sin conexión.** SCRUM-890 y SCRUM-919 lo dejaron funcionando y verificado en staging
  el 17-sep. Este rediseño lo enseña en su sitio y no lo roza.
- **Ningún texto para el error del dictado.** Hoy el dictado está aparcado (SCRUM-889) y no sé qué falla puede dar la
  Web Speech API en cada navegador. Proponer un mensaje de error sin haber visto el error es inventarse un hueco.
