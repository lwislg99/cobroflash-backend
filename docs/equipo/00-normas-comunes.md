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

- 🔴 **Un instrumento declara su POBLACIÓN, no sólo su resultado.**
  «0 fail» sin «sobre cuántos» no es un verde: es una frase. Lo mismo
  vale para cualquier censo, barrido o guard. Si tu salida no dice
  sobre qué población se calculó, nadie —tú incluido— puede saber si
  mide el proyecto o una esquina. Medido el 15-sep-2026: una tanda
  dijo «2.681 pass · 0 fail» habiendo mirado 355 ficheros de 781, y el
  verde era REAL para lo que miró. No lo cazó leer el resultado, sino
  exigirle al instrumento que dijera cuántos ficheros había visto.
  El mismo día, el primer censo de SCRUM-850 dijo «scripts: 0» sobre
  una superficie que tenía tres: lo destapó declarar la población.
- 🔴 **El código de salida es del ÚLTIMO tramo de la tubería.**
  `npm test | tail`, `| head`, `| grep` devuelven el suyo, así que una
  tanda EN ROJO sale `0`. Un `A; B` hace lo mismo. Si necesitas la
  salida, escríbela a un fichero —FUERA del árbol— y léela en un
  SEGUNDO comando. Lo vigila
  `tests/scrum850-la-poblacion-del-instrumento.test.mjs`.
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
- Ningún texto que vea el usuario sin firma. Vale la del fundador o la
  del orquestador por su **delegación permanente**
  (`docs/equipo/limites-del-fundador.md`, «Delegación permanente»),
  que SCRUM-861 hace comprobable: la firma delegada es un comentario de
  Jira y se registra en `docs/microcopy/` con la línea que fija su
  README («Aprobado por el orquestador por delegación del fundador»,
  con la fecha, el ticket y el número del comentario). Se propone el
  literal exacto y SE PARA hasta que llegue una de las dos. Que un
  texto exista en otra pantalla NO acredita que nadie lo firmara.
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

Un instrumento declara su población, no sólo su resultado.
«0 fail» sin «sobre cuántos» no es un verde: es una frase.
El código de salida es el del último tramo de la tubería.
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
Un instrumento que solo sabe callar no es un instrumento.
Si desactivas una comprobación de permisos para que tu robot pase, el
permiso tiene que volver a preguntarse en la puerta siguiente.
Un control que no se puede usar y no puede explicar por qué, no se
deshabilita: se quita.
Un acto irreversible no es nunca la acción principal.
Si tu medición tumba una decisión firmada, gana tu medición.
El coste no es lo que entra en el chat: es lo que el chat arrastra.
Un carácter que no se ve no lo caza una revisión: lo caza un recuento.

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

**Orden fijo del arranque de cada mensaje** (17-sep-2026): varias normas pedían «la primera
línea» y no decían cuál gana.

1. **Primera línea:** hora y SHA (esta norma).
2. **Segunda línea**, al recibir un encargo: su repetición en una línea (A16), y ahí mismo, si
   cae fuera de carril, la negativa (A20).
3. Si se acaba el uso o Claude Code ya no deja seguir, el aviso de A19 («traspaso listo») va
   **justo después de la hora y el SHA**.

    9-sep-2026 11:40 · medido sobre origin/main da5ac06ac169fca5d3692a63b10b01a6aed7d3d6 · worktree wt-verif5

Sin esas dos cosas el orquestador no puede distinguir un informe de hace diez
minutos de uno de hace seis horas, y ya ha mandado tres veces instrucciones
basadas en un estado que había dejado de existir.

    🔒 Un informe sin hora no es una foto del ahora: es una foto sin fecha, y el
       orquestador la va a leer como si fuera de hoy.

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

Al recibir un encargo, la sesión repite en UNA línea qué cree que se
le ha pedido, antes de empezar. Esa línea va justo después de la hora
y el SHA (orden fijo en A14). Si no coincide con lo que el
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

## A17 · Un ticket, una rama, un PR, y se empuja el mismo día

Si un ticket no cabe en un día, **se parte**. Nunca se apilan varios tickets en una rama: al
apilarlos, o entran todos o no entra ninguno.

    🔒 Un conflicto no lo causa la herramienta: lo causa una rama que vive demasiado.

**La evidencia, medida el 9-sep-2026:** el **PR #1214** —3 tickets, 17 commits, 2 días, 51
ficheros— llevaba horas parado por dos conflictos, y no entró hasta el 9-sep a las 08:53Z. El
**PR #1209** de la Sesión 5 —1 ticket, 1 día— se abrió, se armó, pasó CI y **se mergeó solo sin que
nadie mirara**.

La diferencia entre los dos no es la suerte ni la complejidad del trabajo: es cuánto tiempo
estuvo la rama separada de `main` mientras las otras cinco sesiones mergeaban debajo.

## A18 · Un ticket puede estar ACABADO y seguir abierto

Es el reverso de la regla 42. **SCRUM-833** llevaba «En curso» con su rama ya dentro de `main`
desde hacía horas, y su enunciado seguía afirmando una bomba «a 4 ramas» que ya no existía.

Antes de trabajar un ticket se comprueba si su rama ya es ancestro de `main`:

    git merge-base --is-ancestor <sha> origin/main

    🔒 «Mergear no es acabar; pero acabar tampoco es cerrar, y un tablero puede mentir en las
        dos direcciones.»

⚠️ **Y el enunciado tampoco acertaba el número, que es la otra mitad del mismo aviso.** El
ticket decía «a 4 ramas» de un umbral concreto, `dentro.length > 10`, y ese margen **nunca fue
4**: medido, era **7** al empezar y **5** al terminar. El **47** que se citó es de OTRO aserto
—`inst.ramas.length > 50`, el tercero de la familia, que apareció dentro del mismo fichero— y
hoy es 57. Dos umbrales distintos con dos márgenes distintos, y atribuirle a uno el número del
otro es la misma clase de error que la norma viene a cortar: **un número heredado de un
enunciado no es una medición.**

### Un suelo de «no reproducido» limita lo que el cierre AFIRMA, no si el ticket se cierra

*(SCRUM-941, 18-sep-2026.)* Si el síntoma no se reproduce:

1. se declara **«no reproducido»**, con cuántos intentos y en qué condiciones;
2. se cierra **SOLO** si lo entregado no depende de reproducirlo —el mecanismo que convierte la
   próxima vez en un rojo ruidoso, probado con un caso fabricado y su mutación— y está en `main`
   por efecto;
3. el cierre dice **«cerrado, causa no demostrada»**, con la hipótesis y la condición de
   reapertura.

Si nada de lo entregado se sostiene sin reproducir, **NO se cierra**: se aparca como «no
reproducido», con fecha.

Nace de **SCRUM-858**. Su suelo decía «si no se consigue reproducir el cuelgue, se declara así y
no se cierra el ticket», y juntaba dos reglas. La primera («no reproducirlo no prueba que esté
arreglado») es correcta y se cumplió en cinco comentarios seguidos. La segunda ataba el cierre a
algo que el equipo no controla —que el cuelgue volviera solo— y contradecía al punto 4 del propio
ticket, que existía para que la próxima vez **no** hiciera falta reproducirlo. El orquestador lo
cerró contra ese suelo por escrito, con su motivo y sin afirmar la causa, y mandó la norma a su
dueña: ése es el procedimiento para un suelo mal escrito. **Lo que no puede volverse costumbre es
saltarse un suelo por decisión propia**, o ningún suelo vale nada. Por eso se arregla la
redacción, no la obediencia: el suelo se escribe como «si no se reproduce, se declara así y el
cierre no puede afirmar la causa», no como «no se cierra».

    🔒 Un ticket que solo se puede cerrar si el fallo vuelve solo no se cierra nunca, y un ticket
       que no se cierra nunca también miente.

## A19 · El PUESTO es fijo; la SESIÓN se releva

Hay seis puestos, de la S0 a la S5, y **siempre están los seis ocupados**. El puesto dura lo que dure
el equipo. Lo que se cambia, cuando toca, es la sesión que lo ocupa: se lanza una sesión NUEVA en
segundo plano, que lee lo suyo y sigue donde lo dejó la anterior sin arrastrar su contexto.

- **Cuándo se releva** (lo decide el orquestador). Hay tres casos:
  1. al terminar una entrega verificada, **si el contexto de la sesión pasa de 300k**;
  2. si la sesión lleva **más de 1 hora parada**. La caché de prompt caduca a la hora, y el siguiente
     mensaje reescribe la conversación entera; Claude Code lo avisa con «Idle… re-cache about Nk
     tokens»;
  3. al empezar la tanda del día siguiente.
- **Cuándo NO se releva:**
  - **Nunca a mitad de una entrega.**
  - Tampoco en cada tarea: si una entrega se cierra por debajo de 300k, el siguiente encargo entra
    en la misma sesión.
  - Si el uso se acaba o Claude Code no deja seguir, el traspaso se deja ANTES. El último informe
    lo dice justo después de la hora y el SHA (A14): «traspaso listo: el siguiente encargo, en
    sesión nueva».
- **Cómo se releva:**
  1. el orquestador pide el traspaso;
  2. la sesión escribe `project_sN_traspaso.md` en la memoria del proyecto, más su línea en
     `MEMORY.md`, para alguien que NO ha visto su chat;
  3. contesta **«traspaso listo»** por el canal y **PARA**, sin un comando más;
  4. el orquestador la detiene y lanza la sesión nueva con el prompt estándar y el encargo concreto;
  5. la nueva lee desde `origin/main` el `CLAUDE.md`, estas normas, su `sesion-N.md`, su fila de la
     tabla §11bis y su traspaso, y se presenta por el canal: «Sesión N lista · <siguiente paso>».

  El lanzador y su protocolo son de la S5 (`scripts/equipo/sesion.mjs`, `orquestador-autonomo.md`).
- **Qué lleva el traspaso.** Es corto, y lo que no esté aquí la sesión nueva no lo sabe:
  1. **cabecera**: hora de GitHub y SHA de `origin/main` (A14);
  2. **en `main` por efecto**: PR, qué lleva y SHA de merge de 40 caracteres;
  3. **a medias**: rama, head, PR si lo hay, y el **siguiente paso exacto** (el comando o la
     pantalla, no «seguir con»);
  4. **worktrees y bancos**: ruta, rama, si está empujado, y dónde vive lo que no está en git (el
     scratchpad se borra con la sesión: A8);
  5. **cola** de su carril, en orden;
  6. **autorizaciones que hay que volver a pedir** (punto siguiente).
- 🔴 **Las autorizaciones del fundador NO se heredan.** Un GO de dinero, un alta en un servicio de
  terceros o un borrado que el fundador escribió en el chat de una sesión valen para ESA sesión.
  - La nueva no los usa hasta que el fundador se los escriba a ella.
  - El traspaso dice qué estaba autorizado y que hay que pedirlo otra vez, **sin copiar datos
    personales**.
- **El traspaso se lleva al día mientras se trabaja**, no solo cuando se pide: si el uso se corta de
  golpe, lo que no esté escrito se pierde.
- **Nunca se reanuda una sesión grande y fría**, ni para «acabar lo que quedaba»: se lanza una nueva
  y se lee el traspaso.
- **La sesión nueva arranca en la MISMA CARPETA.** La memoria va por carpeta: abierta en otra, no
  encuentra el traspaso y arranca a ciegas creyendo que arranca limpio.

⚠️ **Cuarta versión, 17-sep-2026, y SUPERA a la del 16-sep.**
- **Lo que decía la del 16-sep:** «por defecto el MISMO chat; el tamaño NO es motivo; chat nuevo solo
  si lleva >1 h parado o Claude Code no deja seguir».
- **La prueba que lo cambió:** la prueba de relevo de SCRUM-899. Se lanzó una Sesión 0 nueva en segundo
  plano, que leyó las normas y su traspaso desde `origin/main` y se presentó por el canal (su primer
  informe lleva la hora de GitHub 14:58:39Z).
- **La decisión del fundador** (transmitida por el orquestador, sin cita directa en este fichero): «en
  vez de iniciar con caché antiguo, iniciamos nueva sesión».
- **El ajuste**, hacia las 15:30Z: NO en cada tarea, sino en los tres casos de arriba, y siempre con
  los seis puestos ocupados. Consta en la memoria del proyecto, `feedback_relevo_sesion_fresca.md`.
- *Lectura de la Sesión 0, no palabras del fundador:* el umbral de 300k que el 16-sep se retiró vuelve
  porque lo que se rechazó entonces era **abrir chats a mano**, y el relevo lo lanza el orquestador
  sin que el fundador haga nada.

Lo que sigue es la historia anterior, sin tocar:

⚠️ **Corregida TRES veces por el fundador el 16-sep-2026.** La primera versión decía «chat nuevo
cuando se cierra el ticket, o cuando la conversación pasa de ~300k». La segunda («¿por qué un chat
nuevo? no tiene sentido») retiró el cierre de ticket y bajó el umbral a ~200k, y así entró en `main`
(commit `ccad89cd`). **La tercera, esa misma noche hacia las 21:25 CEST, es la
decisión FINAL y es la que dice esta norma:** «no quiero abrir tantos chats nuevos; nos mantenemos
y cuando se les acabe el límite de caché, ahí abrimos nuevos». El umbral de tamaño queda RETIRADO.
Consta en la memoria del proyecto (`feedback_sesion_300k_traspaso.md`), que es donde se apuntó, y
en `docs/equipo/traspaso.md` §3bis, que marcaba esta norma como contradicción abierta hasta hoy
(17-sep-2026). La medición de abajo no cambia; lo que cambió es la lectura que hace el fundador de
ella: acepta el coste de arrastrar el contexto a cambio de no gestionar chats nuevos, y lo que sí
se evita es reescribirlo en frío.

    🔒 El coste no es lo que entra en el chat: es lo que el chat arrastra.

**Medido por la Sesión 0 el 16-sep-2026**, sobre los transcripts de 7 conversaciones (1.146 turnos,
599,68M de tokens, deduplicados por `message.id`):

- El **94,7 %** es caché LEÍDA: la conversación entera que cada turno vuelve a mandar. Lo que
  escribo es el 0,5 %. Lo caro no es lo que un turno trae de las herramientas: es el tamaño de la
  conversación que ese turno reenvía, haga lo que haga.
- El **62,6 %** del arrastre sale de turnos con el contexto por encima de 600k. Por debajo de 300k,
  el 8,6 %. Un turno por encima de 600k arrastra de media **762k**; uno por debajo de 100k, **45k**.
- **39 turnos —el 3,4 %— escriben el 80,7 % de toda la caché creada**, ~598k cada uno: son
  arranques o reanudaciones de un contexto grande con la caché ya caducada. Reanudar un chat viejo
  no «sigue donde estaba»: lo vuelve a pagar entero.

El comando, con la ventana fija de la medición, está en la fila del 16-sep de
`docs/equipo/afirmaciones-verificadas.md`.

⚠️ **Lo que la medición NO dice, declarado:** la ventana pedida eran tres días, pero los turnos que
caen dentro van del 15-sep 09:15Z al 16-sep 12:49Z — **28 horas**, no tres días. Y el «39» depende
de un umbral (escribir más de 200k de caché en un turno); con «crea más de lo que lee» salen 46
turnos y el 82,7 %. La conclusión no cambia con ninguno de los dos; la cifra, sí.

## A20 · Si el encargo cae fuera de tu carril, lo dices y no empiezas

Si el encargo cae fuera de tu carril (tabla §11bis de `docs/equipo/orquestador.md`), lo dices en
la línea de A16 y no empiezas.

    🔒 Estar libre no te hace dueña del ticket: te hace la que tiene que avisar.

Solo se empieza si la **primera línea del prompt** declara la excepción con su motivo, que es lo
que la tabla le pide al orquestador. Un encargo fuera de carril sin esa línea es un error del
reparto, no una orden, y se caza en la línea de A16 o ya no se caza: pasada esa línea, la
sesión trabaja como si el ticket fuera suyo.

**Medido el 17-sep-2026**, el mismo día en que nació la tabla: la Sesión 5 (automatización)
recibió un albarán y la Sesión 3 (bancos) un pago. Y la Sesión 0 (consultoría) había dejado
escrito y listo para empujar un arreglo en `src/` y `public/` (SCRUM-892): nadie lo paró antes de
la primera línea y acabó siendo una excepción declarada **después**, porque rehacerlo costaba un
chat entero.

## A21 · Una cobaya que no se ejecuta da el mismo resultado que un arreglo perfecto

Todo banco que compare un ANTES con un DESPUÉS hace que su cobaya deje un **testigo de ejecución**
—un fichero, una línea en stdout— y **aborta si falta**. Un cero de algo que no llegó a correr se
lee exactamente igual que un cero de algo que funciona.

    🔒 «Antes de creerte el resultado, comprueba que el sujeto existió.»

**Medido (SCRUM-864):** el banco importaba el helper con una ruta absoluta de Windows sin
`file://`, así que la cobaya de DESPUÉS no arrancaba y dejaba **0 restos porque no creaba
ninguno**. Iba a publicarse como «defecto arreglado». Lo cazó el **control positivo**, no el que
decidía — que es la otra mitad del aviso: el caso que tenía que salir verde es el único que puede
delatar a un banco mudo.

⚠️ **Nació como A19 y se renumeró a A21** (autorización de la Sesión 0, 17-sep-2026): `main` ya
tenía una A19 y una A20. La renumeración deja un coste declarado, y el aviso es de Luis: **una
norma renumerada rompe todo lo que la cite por número.** Aquí no rompió nada —se comprobó:
`tests/scrum665a-congelar-el-emisor.test.mjs`, el otro fichero de este PR, no cita ninguna norma
por número— pero el coste existe y es el de siempre:

    🔒 Referenciar por posición caduca. Referenciar por identidad no.

## A22 · Los caracteres de control se escriben con `\x`, nunca con `\u`

Lo que una sesión escribe como `\uXXXX` **aterriza en disco como el carácter LITERAL**. Funciona
igual, y por eso es peligroso: no se ve en un diff, ni en el visor, ni en una revisión a ojo, y
**un NUL convierte el fichero en binario para git y para GitHub** («Binary file not shown»).

- Se escribe `\x1b`, `\x00`, `\x1f`, `\x08`. Esas formas aterrizan intactas.
- Y se **CUENTA**, no se relee: después de escribir, los bytes de control del fichero (todos
  menos TAB, LF y CR) tienen que ser **0**:

      ([IO.File]::ReadAllBytes($f) | Where-Object { ($_ -lt 32 -and $_ -notin 9,10,13) -or $_ -eq 127 }).Count

- Si hace falta el byte de verdad (un separador de `git log --format`, por ejemplo), se construye
  en tiempo de ejecución (`String.fromCharCode(31)`), no se escribe.

**Medido por la Sesión 0 el 18-sep-2026** (SCRUM-941), en su propia escritura y en el árbol:

1. **Reproducido escribiendo:** 7 de 7 secuencias `\u` probadas aterrizaron como el carácter
   (ESC, NUL, BEL, TAB, DEL, …); las formas `\x07`, `\x1b` y `\033`, 3 de 3 intactas. Es de la
   herramienta, no un descuido. Según sus traspasos, el 17-sep les pasó a dos sesiones
   independientes (la 3 y la 5), con 17 bytes entre las dos.
2. **`main` llevó un ESC literal en su línea principal durante 16 merges seguidos**, de #1467
   (17-sep, 19:08Z) a #1480 (20:11Z), hasta que lo limpió #1481.
3. **Dos tests de `main` son binarios para git** (al escribir esto; el arreglo va en SCRUM-942):
   `tests/scrum806-el-pdf-del-portal.test.mjs` (1 NUL) y
   `tests/scrum807-esquemas-del-href.test.mjs` (4 NUL). El `--numstat` de sus commits de entrada
   da «- -»: **su contenido no lo ha visto nadie nunca en un diff.**
4. **Ya había costado un guard ciego:** `docs/master/SCRUM-428.md` cuenta un metacarácter de
   regex que entró como retroceso (0x08) y dejó un patrón que «no casa con nada».

⚠️ **Lo que sostiene esta norma es un guard, no la buena voluntad** (SCRUM-942, carril de la
Sesión 3): una prohibición sin mecanismo es una frase. Y la trampa que decide si ese guard sirve
también está medida: **no puede usar `git grep -I`**. Un NUL convierte el fichero en «binario» y
el `-I` se lo salta, así que quedaría ciego justo ante el caso peor.

    🔒 Un carácter que no se ve no lo caza una revisión: lo caza un recuento.
