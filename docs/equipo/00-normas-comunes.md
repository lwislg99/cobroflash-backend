# Normas comunes del equipo de sesiones

> 🔴 **ESTE FICHERO TIENE UN SOLO DUEÑO: LA SESIÓN 0.** Nadie más lo edita — ni las otras cinco
> sesiones, ni Codex, ni el orquestador.
>
> **Quien descubra una norma la escribe en SU informe y se la reporta a la Sesión 0**, que la mete
> aquí. Las frases de canon propias de cada sesión van a su `docs/equipo/sesion-N.md`, que no
> choca con nadie.
>
> El motivo está medido: en una semana se mandó a CUATRO sesiones distintas escribir normas en
> este mismo fichero (A12, A13, A14, A15, A16 y varias frases de canon). El resultado fue el
> PR #1214 — 51 ficheros y tres tickets parados por un conflicto AQUÍ. **Cuatro manos en un
> fichero es un conflicto garantizado**, y no lo causó la herramienta: lo causó repartir el
> trabajo mal.

Estas normas aplican a todas las sesiones, sin excepción.
Tu identidad y tus trampas propias están en docs/equipo/sesion-N.md.
Quien coordina también tiene ficha, y con sus trampas medidas dentro:
docs/equipo/orquestador.md.

## A1 · Cada tanda, antes de nada

    ./node_modules/.bin/prisma generate
    git fetch origin && git rev-list --count HEAD..origin/main

Si ese contador NO es 0, tu árbol no es main y ningún número que
saques de él describe el proyecto. Se han pillado árboles a 446, 463,
1.933 y 2.817 commits de distancia dando cifras perfectamente
creíbles de árboles que ya no existían.

  Un banco viejo no da error: da un número que parece bueno.

Nunca `npx prisma`: descarga un CLI distinto (SCRUM-385). El cliente
de Prisma se comparte entre worktrees y se desfasa — da errores de
«columna que no existe» sobre columnas que sí están en el esquema.

## A2 · PASO 0 — ¿el defecto existe HOY?

Antes de escribir una línea, compruebas que el defecto ocurre hoy,
CORRIENDO, no leyendo. Si no ocurre: PARAS, lo dices, y no gastas la
tanda. En una sola semana se gastaron dieciséis tandas en defectos ya
arreglados.

## A3 · Cómo se mide aquí

- Un CERO nunca significa «está limpio»: significa «no he mirado».
  Todo barrido lleva un control que demuestre que el instrumento ve
  algo que sabemos que está.
- Contar texto no es contar cosas. Un prefijo no es un nombre, y una
  subcadena tampoco.
- Un control positivo que se cumple sobre el VACÍO no es un control:
  es una tautología con forma de prueba. `new Set([]).size ===
  [].length` es `0 === 0`; comparar «» con «» da «idéntico».
- Comprueba el INSTRUMENTO, no solo el resultado. Mirar las muestras
  a ojo funciona cuando el error se ve, y hace falta justo cuando no.
- Dos sondas INDEPENDIENTES valen más que el doble de cobertura:
  comparar lo nuevo contra lo viejo puede dar «de acuerdo» dentro del
  error. Cuando dos sondas discrepan, la discrepancia ES el dato.
- Un instrumento que provoca el estado que va a comprobar no puede
  detectar que ese estado no se produce solo.
- Compara CONJUNTOS, no cuentas. Un número igual deja pasar «he
  perdido una y he ganado otra».
- Corrido o no cuenta. «Debería funcionar» no es un veredicto.
- Si tu instrumento y tu conclusión se contradicen, gana el
  instrumento — después de comprobar el instrumento.

## A4 · Git (AA2)

- Rama propia siempre. Nunca commits en main.
- Nunca reescribes historia: ni rebase, ni --force, ni amend sobre
  algo ya empujado.
- Para traer main: `git merge origin/main` DENTRO de tu rama.
- Un merge SIN conflictos no es un merge correcto: comprueba que no
  se está perdiendo el trabajo de alguien en silencio.
- Antes de empezar: `git ls-remote --heads origin | grep <número>`.
  Si ya hay rama de ese ticket, paras y lo dices.
- CI prueba el MERGE, no la rama. Tu suite verde en tu árbol no
  predice el CI.
- «Main se ha movido mucho» y «main se ha movido DONDE YO TOCO» son
  cosas distintas. Solo la segunda invalida una rama.
- Mergear no es acabar: un ticket no está cerrado hasta que su
  despliegue está verde.

## A5 · El orden del esquema

① decisión → ② ALTER aditivo en las TRES bases (dev, staging,
producción), que aplica el colaborador → ③ un solo PR con esquema +
código + tests. NUNCA ③ sin ②. Nunca `db push` contra producción. El
DDL sale de `prisma migrate diff` y de ningún otro sitio.
Verificar un ALTER exige DOS controles de tipos DISTINTOS más
`current_database()`: dos del mismo tipo no distinguen «la columna
existe» de «me está contestando otra tabla».

## A6 · Antes de decir que está

BUILD primero, y miras su código de salida ANTES que los tests.

  Un build roto no es un rojo: es un verde que no vale.
  (Pasaron 27 tests contra un dist/ viejo.)

Luego suite completa + `guards:entrada`. Y NO encadenes el push a
otra cosa: corre la suite después del último cambio, mira el
resultado, y entonces empuja.

## A7 · Lo que no se toca, nunca

- prisma/schema.prisma sin ALTER aplicado antes.
- El camino de emisión fiscal: leerlo sí, modificarlo es STOP.
- Ningún texto que vea el usuario sin firma del fundador. Se propone
  el literal exacto y SE PARA. Que un texto exista en otra pantalla
  NO acredita que lo firmara él.
- Ninguna cadena de conexión, usuario, contraseña o clave, en ningún
  fichero, comentario ni mensaje. Ni real ni de ejemplo.
- Frontend vanilla, sin bundler, sin framework de CSS. Ni un `style=`
  en línea.
- Un hallazgo de otro carril se REPORTA, no se arregla.
- Dependencia o coste nuevo: lo decide el fundador.
- Un hallazgo solo es ticket si tiene víctima HOY. Tope 3 por tanda.
- Un guard en rojo se arregla cambiando el CÓDIGO, nunca lo que el
  guard exige. Si el arreglo pasa por relajar el guard, se para y se
  dice.
- La excepción que parece un descuido puede ser el único sitio donde
  una regla está sujeta. Antes de uniformar, lee por qué es distinta.

## A8 · Cómo se entrega

Rama y SHA de 40 caracteres COMPLETO. No lo cortes.
El banco SE SUBE: el scratchpad es efímero y ya se perdió uno, y
costó una tanda entera. Si no está en git, no existe. Y los
instrumentos se comitean ANTES de tocarlos.
Registro de máster: un fichero por número de ticket. Si ya existe,
ANEXAS una sección (SCRUM-Nb, Nc…) y no escribes encima.

## A9 · Cuando algo te sale mal, lo cuentas tú

Las mejores entregas de este equipo llevan dentro un error propio
confesado sin que nadie preguntara.

  Un informe sin errores propios es un informe que no ha mirado.

## A10 · Frases de la casa

Un prefijo no es un nombre, y una subcadena tampoco.
Cero no es «está limpio»: es «no he mirado».
CI prueba el MERGE, no la rama.
Una ventana fija es una tolerancia disfrazada.
Un build roto no es un rojo: es un verde que no vale.
Referenciar por posición caduca. Referenciar por identidad no.
Una prohibición sin mecanismo es una frase.
Un número derivado no se elige: se recalcula.
«Exactamente una vez» no es alcanzable cruzando un límite de proceso.
Si parece un campo y no se puede escribir, la pantalla ha mentido.
Si la acción no cambia con el estado de la fila, no es la acción de
la fila.
Una pantalla se ordena por lo que se hace en ella, no por cómo están
guardados los campos.
La lista que decide qué se mira es la única que nadie mira.
Contar no es avisar.
Un instrumento que solo sabe callar no es un instrumento.
Si desactivas una comprobación de permisos para que tu robot pase, el
permiso tiene que volver a preguntarse en la puerta siguiente.

## A16 · Repite el encargo en una línea antes de empezar

Al recibir un encargo, la sesión repite en UNA línea qué cree que se
le ha pedido, antes de empezar. Si no coincide con lo que el
orquestador quiso decir, se ve en el momento.

Nace de dos sucesos del 9-sep-2026, y los dos son del mismo tipo: un
encargo de cuatro puntos que NO llegó a la sesión, y un «el arreglo
que ya hiciste» sobre algo que estaba a medias. Ninguno de los dos se
habría visto hasta tres días después. La línea cuesta cinco segundos y
es el único punto del proceso donde emisor y receptor comparan lo que
creen que dice el mensaje.

Corolario: si el encargo no te llegó, se dice. NO se reconstruye de
memoria — un encargo inventado se parece mucho a uno recibido, y
trabajar sobre él cuesta la tanda entera.

## A11 · Cómo se actualiza esto

Cuando una sesión comete un error que volvería a cometer, se
actualiza su línea de trampa recurrente. Cuando una frase nace de una
medición, entra en A10. NO se añade una norma por cada susto: una
norma que no ha costado nada dos veces es una norma que nadie lee.

## A12 · Antes de cambiar una POBLACIÓN, se censa quién mide sobre ella

Ramas, ficheros, tablas, filas. Antes de barrer, borrar o renombrar en masa, se
busca qué guards toman esa población como magnitud.

    🔒 Un barrido correcto que rompe main sigue rompiendo main.

Nace medido: el 8-sep-2026 se barrieron 456 ramas ya mergeadas —correctamente,
todas con su trabajo dentro de `main`— y el suelo de SCRUM-804, que exigía «558
ramas remotas», dejó el check obligatorio en rojo **para los 22 PR abiertos a la
vez**. La orden era buena; lo que faltó fue mirar quién medía sobre eso.

## A13 · Nada más coger un ticket: EN CURSO + ASIGNADO A LUIS

En Jira, **antes de la primera línea de código, no después.**

Un ticket que se trabaja sin estar En curso es trabajo que el colaborador no
puede ver, y dos sesiones pueden cogerlo a la vez.

## A14 · Todo informe empieza con la hora y el SHA

Dos datos, en la PRIMERA línea: la **fecha y hora** en que se midió, y el **SHA
de `origin/main`** sobre el que se midió.

    9-sep-2026 11:40 · medido sobre origin/main da5ac06a · worktree wt-verif5

Sin esas dos cosas el orquestador no puede distinguir un informe de hace diez
minutos de uno de hace seis horas, y ya ha mandado tres veces instrucciones
basadas en un estado que había dejado de existir.

    🔒 Un informe sin hora no es una foto del ahora: es una foto sin fecha, y el
       orquestador la va a leer como si fuera de hoy.

## A17 · Un ticket, una rama, un PR, y se empuja el mismo día

Si un ticket no cabe en un día, **se parte**. Nunca se apilan varios tickets en una rama: al
apilarlos, o entran todos o no entra ninguno.

    🔒 Un conflicto no lo causa la herramienta: lo causa una rama que vive demasiado.

**La evidencia, medida:** el **PR #1214** —3 tickets, 17 commits, 2 días, 51 ficheros— lleva horas
parado por dos conflictos. El **PR #1209** de la Sesión 5 —1 ticket, 1 día— se abrió, se armó,
pasó CI y **se mergeó solo sin que nadie mirara**.

La diferencia entre los dos no es la suerte ni la complejidad del trabajo: es cuánto tiempo
estuvo la rama separada de `main` mientras las otras cinco sesiones mergeaban debajo.
