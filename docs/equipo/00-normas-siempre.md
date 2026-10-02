# Lo que llega SIEMPRE — A9 y A10 de las normas comunes

> Texto CANÓNICO de A9 y A10 (SCRUM-1294). `CLAUDE.md` lo importa con `@`, así que está cargado en
> TODA sesión de los dos equipos sin que nadie lo lea. `00-normas-comunes.md` solo apunta aquí: una
> regla escrita dos veces son dos reglas que divergen. Dueña: S0. **A10 admite una línea añadida por
> cualquier puesto de los dos equipos, en su propio PR** (es la excepción de carril declarada en
> `dos-equipos.md` §3.4). Tope del fichero: 16 KB — al llegar, la S0 poda (A11).

## A9 · Cuando algo te sale mal, lo cuentas tú

Las mejores entregas de este equipo llevan dentro un error propio
confesado sin que nadie preguntara.

  Un informe sin errores propios es un informe que no ha mirado.

**Un fallo no se convierte en una nota. Se convierte en una COMPROBACIÓN.**
Si no se puede convertir, se dice que no se puede y se queda como aviso —
pero sin fingir que apuntarlo lo arregla.

Por qué: una norma nacida de un fallo la escribe el que falló y la lee
otro que nunca lo tuvo: recibe la regla sin la cicatriz. Apuntar no
corrige (medido el 29-sep: el orquestador apuntó por la mañana «comprueba
antes de repartir», y por la tarde repartió cinco tareas sin comprobar).
Lo que sí corrigió, todas las veces, fue algo de fuera que comprobó EN EL
MOMENTO DE ACTUAR: un hook que paró, una sesión que se negó con la medición
delante. El objetivo alcanzable no es no fallar: es **que el mismo fallo
no pueda ocurrir dos veces**.

Y se escribe donde lo lean TODAS, no en un mensaje al orquestador (muere
con su sesión) ni solo en tu traspaso (lo lee solo tu puesto). En cada
registro `docs/master/SCRUM-N.md`, bajo su ancla, va UNA línea, por este
orden de preferencia:

    A9: comprobación → `<ruta del test, guard o hook que ya lo impide>`
    A9: aviso → A10 «<frase literal>» — no se pudo comprobar: <por qué>
    A9: aviso → cicatriz <puesto> «<frase literal>» — no se pudo comprobar: <por qué>
    A9: sin fallo que generalice — <por qué>

El aviso va a **A10** (abajo) si le sirve a todos, o a las **cicatrices de
tu puesto** (`docs/equipo/cicatrices/<puesto>.md`) si es un tropiezo tuyo:
en una línea física, en el MISMO PR. Las cicatrices NO son el traspaso: el
traspaso dice dónde lo dejaste y caduca en una tanda; una cicatriz dice en
qué se equivoca tu puesto, y no caduca. Cada una lleva su comprobación al
lado, o dice que no la tiene y por qué.

Mecanismo: `tests/scrum1294-a9-leccion-en-a10.test.mjs`, en el check
obligatorio. Desde el 2026-09-30 salen ROJO: un tramo de registro sin
línea `A9:`, una comprobación cuya ruta no existe, un aviso cuya frase no
está LITERAL donde dice, y una cicatriz sin comprobación ni motivo.

A11 sigue mandando: una frase es una línea, no un párrafo, y el detalle se
queda en el registro. El índice de la memoria (`MEMORY.md`) NO es el
destino: es de UNA máquina (el otro equipo no lo ve) y se corta en la
línea 200 o a los 25.000 B (medido el 29-sep: iba al 72 %).

## A10 · Frases de la casa

Un instrumento declara su población, no sólo su resultado.
«0 fail» sin «sobre cuántos» no es un verde: es una frase.
El código de salida es el del último tramo de la tubería.
Un prefijo no es un nombre, y una subcadena tampoco.
Cero no es «está limpio»: es «no he mirado».
CI prueba el MERGE, no la rama.
Una dependencia entre dos PR escrita en el prompt de UNA sesión no existe para la otra: o es un guard, o no es nada. (SCRUM-1358)
Una ventana fija es una tolerancia disfrazada.
Un build roto no es un rojo: es un verde que no vale.
Referenciar por posición caduca. Referenciar por identidad no.
Una prohibición sin mecanismo es una frase.
Un número derivado no se elige: se recalcula.
«Exactamente una vez» no es alcanzable cruzando un límite de proceso.
Si parece un campo y no se puede escribir, la pantalla ha mentido.
Si la acción no cambia con el estado de la fila, no es la acción de la fila.
Una pantalla se ordena por lo que se hace en ella, no por cómo están guardados los campos.
La lista que decide qué se mira es la única que nadie mira.
Contar no es avisar.
Si el borrado de una rama puede cambiar tu medición, no estabas midiendo el trabajo: estabas midiendo el envase.
Dos anclas para la misma comprobación no son redundancia: son la próxima contradicción esperando fecha.
Un `git stash pop` a ciegas es un `git checkout` del trabajo de otro encima del tuyo.
Un instrumento que solo sabe callar no es un instrumento.
Si desactivas una comprobación de permisos para que tu robot pase, el permiso tiene que volver a preguntarse en la puerta siguiente.
Un control que no se puede usar y no puede explicar por qué, no se deshabilita: se quita.
Un acto irreversible no es nunca la acción principal.
Si tu medición tumba una decisión firmada, gana tu medición.
El coste no es lo que entra en el chat: es lo que el chat arrastra.
Un carácter que no se ve no lo caza una revisión: lo caza un recuento.
Una operación que no se ejecutó se lee exactamente igual que un éxito.
Un rojo sin población no es un hallazgo: es un instrumento que no llegó a arrancar.
Una captura bonita no prueba que el botón funcione.
«No está en el PATH» no es «no está».
Un detector que acierta y publica donde nadie lee produce el mismo resultado que uno ciego. (SCRUM-1350)
Antes de llamar mecanismo a lo que has visto, di sobre cuántos elementos lo mediste: un instante no es un régimen. (SCRUM-1350)
Un laboratorio que le presta su entorno al sujeto mide la suma de los dos.
Una idea de un jefe es una hipótesis con su literal, no una orden de construir.
El límite de 200 líneas es del índice de la memoria, no de CLAUDE.md: mide cuál carga antes de recortar. (SCRUM-1294)
Un dato copiado de un registro lleva la fecha en que se midió, no la de hoy. (SCRUM-1154)
Empujar no es entregar: antes de cerrar, mira el check obligatorio de tu último push, o di que no lo miraste. (SCRUM-1298)
Una red de seguridad que no caza tiene el mismo aspecto que una que no tuvo nada que cazar. (SCRUM-1302)
Que un commit no esté en main no dice que su contenido no esté: el trabajo entra por otra rama o bajo otro número. Se compara contenido, no ancestría ni número. (SCRUM-1348)
Un lanzamiento que no cuaja dice lo mismo que uno que sí: «backgrounded» y un id. (SCRUM-1357)
El panel vacío no es «no existe»: cuando el panel y el registro de trabajos discrepan, manda el registro. (SCRUM-1357)
Un fichero que corre y pierde su informe se ve idéntico a un fichero sin tests; sólo el recuento lo distingue. (SCRUM-1366)
Escrito no es corriendo, ni propagado, ni entregado: un mecanismo cuenta desde que deja rastro de haber corrido. (SCRUM-1356)
Limpiar la máquina borra pruebas: el libro se escribe antes de parar, no después. (SCRUM-1357)
El `updatedAt` de una fila no es la versión de un trozo de esa fila. (SCRUM-1285)
Un dato correcto bajo una etiqueta verde no se lee: la etiqueta manda sobre el contenido. (SCRUM-1368)
Lo que se deduce de NO haber visto algo no vale si algo no se pudo mirar: se queda sin juzgar. (SCRUM-1336)
Un test que saca el handler de su ruta prueba el handler, no la ruta: sigue verde con el gate puesto y con el gate quitado. (SCRUM-1344)
Lo que el repositorio llama inferencia puede estar ya medido en Jira: antes de pedir una medición se lee el ticket entero, comentarios incluidos. (SCRUM-1398)
Un criterio que casa por la forma de la frase casa con una convención que nadie acordó: calibrado sobre una muestra, grita o calla con la siguiente. (SCRUM-1372)
Quien cierra no clasifica su propio «no lo vi»: pedírselo es justo lo que una auditoría existe para no creerse. (SCRUM-1372)
La discrepancia solo es el dato si las dos sondas hablan el mismo idioma: con dos traducciones, la discrepancia es ruido. (SCRUM-1295)
