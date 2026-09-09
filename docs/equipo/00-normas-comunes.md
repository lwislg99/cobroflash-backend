# Normas comunes del equipo de sesiones

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
- `git stash` NO se usa para apartar trabajo: su almacén es COMPARTIDO
  entre worktrees y `stash@{0}` puede ser de otra sesión. Ver **A15**.

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
Si el borrado de una rama puede cambiar tu medición, no estabas midiendo el
trabajo: estabas midiendo el envase.
Dos anclas para la misma comprobación no son redundancia: son la próxima
contradicción esperando fecha.
Un `git stash pop` a ciegas es un `git checkout` del trabajo de otro encima
del tuyo.

## A11 · Cómo se actualiza esto

Cuando una sesión comete un error que volvería a cometer, se
actualiza su línea de trampa recurrente. Cuando una frase nace de una
medición, entra en A10. NO se añade una norma por cada susto: una
norma que no ha costado nada dos veces es una norma que nadie lee.

## A12 · Antes de cambiar una población, se censa quién mide sobre ella

Antes de cambiar una POBLACIÓN (ramas, ficheros, tablas, filas), se censa qué
guards miden sobre ella. **Un barrido correcto que rompe `main` sigue rompiendo
`main`.**

## A13 · Coger un ticket es moverlo en Jira, no empezar a escribir

Nada más coger un ticket: **EN CURSO + ASIGNADO A LUIS** en Jira. Antes de la
primera línea de código, no después. Un ticket que se trabaja sin estar En curso
es trabajo que el colaborador no puede ver, y dos sesiones pueden cogerlo a la vez.

## A14 · Todo informe empieza con la hora y el SHA

Todo informe empieza con la **FECHA Y HORA de la medición** y el **SHA de
`origin/main`** sobre el que se midió. Sin esas dos cosas, el orquestador no puede
distinguir un informe de hace diez minutos de uno de hace seis horas — y ya ha
mandado tres veces instrucciones basadas en un estado que había dejado de existir.

## A15 · `git stash` es estado COMPARTIDO: no se usa para apartar trabajo

El almacén de `git stash` es **compartido entre todos los worktrees del
mismo repositorio**, igual que los refs. `stash@{0}` puede ser de otra
sesión.

Por tanto: **NO se usa `git stash` para apartar trabajo.** Se usa un commit
temporal en la propia rama, que es local a la rama y no lo puede tocar nadie
más:

```bash
git commit -m "wip: apartado"
# … lo que tuvieras que medir …
git reset --soft HEAD~1
```

Si aun así hay que mirar un stash: `git stash list` PRIMERO, se comprueba de
quién es por su mensaje, y **NUNCA se usa `pop` — solo `apply`**, que conserva
la entrada.

> Medido dos veces. La sesión 2 se llevó un stash ajeno hace unos días, y el
> 8-sep-2026 la sesión 3 repitió: un `git stash push` de cuatro ficheros no
> llegó a crear entrada, y el `pop` siguiente sacó al árbol el stash de la
> sesión de SCRUM-713 —cuatro ficheros seguidos y tres sin seguir— con
> conflictos encima del trabajo propio. No se perdió nada porque un `pop` con
> conflictos CONSERVA la entrada, y porque se verificó `git stash list` antes
> de tocar el árbol. Dos veces es un patrón, no un accidente.

🔒 Un `git stash pop` a ciegas es un `git checkout` del trabajo de otro encima
del tuyo.

## A16 · Repite el encargo en una línea antes de empezar

Al recibir un encargo, la sesión repite en UNA línea qué cree que se le ha pedido,
antes de empezar. Los mensajes se pierden y nadie se entera hasta tres días después.
