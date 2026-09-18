# Normas comunes del equipo de sesiones

> 🔴 **ESTE FICHERO TIENE UN SOLO DUEÑO: LA SESIÓN 0 DEL EQUIPO DE LUIS, Y VALE PARA LOS DOS
> EQUIPOS.** Nadie más lo edita — ni las otras sesiones, ni Codex, ni los orquestadores, ni ningún
> puesto del equipo de Javier.
>
> **Quien descubra una norma la escribe en SU informe y se la reporta a la Sesión 0**, que la mete
> aquí. El equipo de Javier no puede escribirle a la S0 (otra máquina, otra cuenta): **propone por
> Jira**, con un ticket con las etiquetas `equipo-javier` y `area-s0` y el texto exacto que propone
> (`dos-equipos.md` §5). Las frases de canon propias de cada puesto van a su ficha, que no choca con
> nadie.
>
> El motivo está medido: en una semana se mandó a CUATRO sesiones distintas escribir normas en
> este mismo fichero (A12, A13, A14, A15, A16 y varias frases de canon). El resultado fue el
> PR #1214 — 51 ficheros y tres tickets parados por un conflicto AQUÍ. **Cuatro manos en un
> fichero es un conflicto garantizado**, y no lo causó la herramienta: lo causó repartir el
> trabajo mal.

Estas normas aplican a todas las sesiones de los DOS equipos, sin excepción.
Tu identidad y tus trampas propias están en la ficha de tu puesto
(docs/equipo/sesion-N.md en el equipo de Luis; los puestos de los dos
equipos, en docs/equipo/dos-equipos.md).
Las trampas de la MÁQUINA (Windows, Git Bash, PowerShell 5.1, gh), que
valen para los dos equipos porque usan la misma máquina tipo, están en
docs/equipo/trampas-del-entorno.md.
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

**Un agente o un workflow que MIDE trabaja en un worktree fijado a
`origin/main`** (`git worktree add <ruta ABSOLUTA> origin/main`), nunca
en un árbol compartido ni en uno que otra sesión pueda mover. ✗ Falla:
el 29-jul-2026 un censo de 12 agentes concluyó que dos funciones «no
existen en el repositorio»; existían desde hacía dos horas, pero los
agentes leyeron un árbol compartido que otra sesión había dejado 9
commits atrás.

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
- 🔴 **«No tengo X» es una afirmación sobre el entorno, y se mide
  como cualquier otra ANTES de decirla.** Una herramienta diferida se
  busca con `ToolSearch`; un binario que no está en el PATH, por su
  ruta completa. «No está en el PATH» no es «no está». ✗ Falla, tres
  veces medidas: «no hay acceso a Jira» (el MCP estaba conectado,
  29-jul), «`gh` no está instalado» repetido durante días (estaba en
  `C:\Program Files\GitHub CLI\gh.exe`, 15-sep) y «no hay Playwright»
  (el MCP existía, 7-sep).
- **Auditar por mutación: primero la BASE sin mutar.** Sin ella, un
  test inestable que cae se lee como un mutante que muere. Y un
  instrumento que no produce salida (un proceso lanzado con demasiados
  ficheros en Windows, por ejemplo) es **CIEGO**, no una fila con
  `null`: se declara ciego e invalida la fila. ✗ Falla: SCRUM-844
  (15-sep), cinco mutantes dieron «pass null · fail null» y parecían
  resultados.

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
- 🔴 **El control del sufijo va en SU PROPIO comando, justo antes del
  PRIMER push, y el push en el comando SIGUIENTE** solo si salió vacío.
  El control, entero: los PR en CUALQUIER estado cuyo head case
  `^scrum-0*NNN[a-z]?-`, `git ls-remote --heads origin` anclado al
  NOMBRE de la ref (no a una subcadena: «858» casó dentro de un SHA),
  y `git log origin/main --grep=SCRUM-NNN` (un PR mergeado borra su
  rama y `ls-remote` ya no lo ve). Con un control positivo sobre una
  rama que EXISTA HOY. ✗ Falla: 17-sep, SCRUM-895; el control MOSTRÓ
  el PR ajeno, pero iba encadenado con `;` al `git push` y el push salió
  igual. Un sufijo libre al empezar caduca en minutos (15-sep: 836d).
- **Cada push siguiente, también en su propio comando, después de
  `git ls-remote --heads origin <rama>`.** El repo auto-mergea y BORRA
  la rama al mergear: si ya no existe y tu punta está en `main`
  (`merge-base --is-ancestor`), NO se empuja — un push así recrea la
  rama y abre un PR residuo. Y se empuja con `git push origin
  HEAD:<rama>`, no con el nombre a secas, que empuja la rama LOCAL
  homónima aunque estés en otra. Nunca un push detrás de un `git merge`
  en la misma orden: si el merge falla, el push sale igual.
- **Un conflicto en una cifra derivada** (censos, trinquetes, conteos)
  no se resuelve eligiendo lado ni sumando: se conservan las dos
  explicaciones y el número se **regenera** con su generador sobre el
  árbol fusionado, DESPUÉS de resolver todo lo demás. ✗ Falla:
  SCRUM-814, se dedujo 153 y el censo dijo 152.

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

**La lista de antes de correr una suite COMPLETA** (cada casilla, sí o no):

1. ¿He borrado `FORCE_COLOR` del entorno **en este mismo comando** y lo
   he comprobado (`-not (Test-Path Env:FORCE_COLOR)` da `True`)? El
   entorno desde el que se lanzan las sesiones lo trae puesto y lo
   heredan los hijos. ✗ Falla: SCRUM-928, tres instrumentos daban rojo
   sobre un árbol sano solo por el color.
2. ¿Tengo el **TURNO** del orquestador? Las suites completas van de UNA
   en UNA por máquina.
3. ¿He medido la **memoria libre en un comando APARTE**, y pasa el
   umbral del equipo (hoy 2.200 MB y ninguna otra suite en marcha)? Se
   lanza solo si pasa. ✗ Falla: una pasada murió a mitad con 2.101 MB y
   tres suites a la vez; relanzarla sin medir es la tercera muerte.
   No se baja el umbral para que quepa la tuya, ni se cierran programas
   del escritorio del jefe.
4. ¿Va el TAP a un fichero **FUERA del árbol**, y leo el código de
   salida de node en un SEGUNDO comando? (A3)
5. ¿Es la suite **posterior al último cambio**, incluido el expediente?
   Si escribes el expediente después, `npm run guards:entrada` otra vez.

**Y una pantalla no se da por buena con una captura: se mide el ESTADO
después de pulsar.** Una captura bonita no prueba que el botón funcione.
✗ Falla: 17-sep, SCRUM-917 se publicó con los botones del «⋯» muertos,
y las capturas eran perfectas. La medida es la del navegador (el DOM
ejecutado, el tamaño real, lo que cambia al pulsar), nunca la del CSS
leído: una caja CSS no es lo que ocupa.

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
Una operación que no se ejecutó se lee exactamente igual que un éxito.
Un rojo sin población no es un hallazgo: es un instrumento que no llegó a arrancar.
Una captura bonita no prueba que el botón funcione.
«No está en el PATH» no es «no está».
Un laboratorio que le presta su entorno al sujeto mide la suma de los dos.
Una idea de un jefe es una hipótesis con su literal, no una orden de construir.

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

## A13 · El ticket: abrir, coger, soltar y cerrar — como departamentos

*(Hasta el 18-sep-2026 decía «nada más coger un ticket: EN CURSO + ASIGNADO A LUIS». Con dos equipos
y dos jefes pasa a ser el ciclo entero, igual para los dos. Lo pidió el fundador: «dejar muy clara la
metodología de abrir tickets, como con departamentos, y ponerlos SIEMPRE en curso para no pisarnos».)*

Los dos equipos **no se hablan**: lo único que ven los dos es Jira y el repo. Por eso el ticket no es
papeleo, es el único canal. Cinco pasos, y cada uno con lo que lo haría fallar:

1. **ABRIR.** Todo ticket nace con **DOS etiquetas**: la del equipo (`equipo-luis` o `equipo-javier`) y
   la del área dueña según `dos-equipos.md` §3 (`area-s0` … `area-s5`, `area-j1` … `area-j6`). Si no casa
   con ningún área, **no se abre**: se le pregunta al orquestador. El título empieza por la zona en
   mayúsculas («GASTOS · …»). ✗ Falla: un ticket sin etiqueta de área; o con `sesion-J1`, que es una
   etiqueta VIEJA de agosto con otro significado (10 tickets la llevan) y no se reutiliza.
2. **COGER.** Antes de la primera línea, **se mira el ticket**. Si está En curso y es de otro puesto u
   otro equipo, **no se toca** y se avisa al orquestador. Si está libre: **En curso + asignado al JEFE
   del equipo que lo trabaja** (Luis o Javier: las sesiones no tienen cuenta de Jira) + un comentario
   «lo coge <puesto> · <hora de GitHub> · <SHA de origin/main>». ✗ Falla: 17-sep, SCRUM-890 y SCRUM-895,
   una sesión del otro equipo cogió dos tickets que el nuestro estaba trabajando sin que constara, y
   los dos lados hicieron el mismo trabajo.
3. **SOLTAR.** Si una sesión lo deja a medias (relevo, fin de uso), lo dice en un **comentario** con el
   punto exacto: rama, último SHA y el siguiente paso. ✗ Falla: un ticket En curso que nadie trabaja y
   que el otro equipo no se atreve a tocar.
4. **CERRAR.** Solo por **efecto medido**, con el comentario de la evidencia. **Cierra el orquestador del
   equipo dueño**, nunca una sesión y nunca el otro equipo (A18; `orquestador.md` §10bis.16).
5. **LIMPIAR.** Una vez por semana, cada orquestador revisa SUS abiertos: hechos, duplicados, superados.
   Y **el estado se cambia en cuanto deja de ser verdad**, no en la limpieza: un ticket en «Acción del
   fundador» que ya no espera a ningún jefe pasa a su estado real ese mismo turno. ✗ Falla: el 18-sep, el
   censo de los 80 abiertos encontró SCRUM-774, 779 y 864 en «Acción del fundador» sin esperarle ya; un
   estado desfasado es justo el pisotón que este ciclo existe para evitar.

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

**La hora sale de GitHub, nunca del reloj de la máquina:** la cabecera `Date:` de `gh api -i zen`
(en Git Bash, SIN barra delante: MSYS convierte `/zen` en una ruta y la cabecera sale vacía). ✗ Falla:
el 15-sep-2026 el reloj de la máquina de Luis iba **5 min 33 s adelantado**, y un PR salía «creado»
cinco minutos antes del push que lo abrió. El desfase cambia: no se corrige, se evita.

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

Cada equipo tiene sus puestos (el de Luis, de la S0 a la S5; el de Javier, de J1 a J6: `dos-equipos.md`),
y **siempre están ocupados**. El puesto dura lo que dure el equipo. Lo que se cambia, cuando toca, es la sesión que lo ocupa: se lanza una sesión NUEVA en
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
  2. la sesión escribe su traspaso en la memoria del proyecto (`project_sN_traspaso.md` para
     `sesion-N`; `project_<puesto>_traspaso.md` para el resto, y `project_orquestador_traspaso.md` el
     orquestador), más su línea en `MEMORY.md`, para alguien que NO ha visto su chat. ⚠️ La memoria es
     de la MÁQUINA y de la CARPETA: el otro equipo no la ve nunca. Lo que tenga que saber el otro
     equipo va al repo o a Jira, no aquí;
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
- 🔴 **Las autorizaciones de un jefe NO se heredan.** Un GO de dinero, un alta en un servicio de
  terceros o un borrado que un jefe (Luis o Javier) escribió en el chat de una sesión valen para ESA
  sesión.
  - La nueva no los usa hasta que un jefe se los escriba a ella.
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

### La familia entera: una operación que NO se ejecutó se lee igual que un éxito

*(Añadido el 18-sep-2026 desde el traspaso de la Sesión 3 del 17-sep: cuatro veces en una tanda, y
ninguna la cazó el código de salida.)* No es solo la cobaya del banco: **cualquier operación** puede no
ejecutarse y dejar exactamente la misma salida que si hubiera ido bien. Por eso todo log de un banco,
una sonda o una suite lleva en su primera línea la **POBLACIÓN** y en la última el **`EXIT=`**, y el
informe cita las dos. Los cuatro casos medidos:

1. `npm` en un `.cmd` sin `call`: el script muere ahí y el job sale 0.
2. Un comentario largo con acentos en un `.cmd`: cmd lee por posición y se come dos caracteres de cada
   línea; sale 0.
3. `[IO.File]::ReadAllText('ruta/relativa')` resuelve contra el directorio del PROCESO: la mutación no
   se aplicó y la traza decía «mutante puesto» con el `git diff` vacío. → rutas ABSOLUTAS y el
   `git diff --numstat` impreso al lado de la afirmación.
4. Un `NODE_OPTIONS` puesto para el sujeto mató al `node --test` que lo corría: exit 1 y cero recuentos.

- **Un rojo sin población no es un hallazgo: es un instrumento que no llegó a arrancar.** Un exit 1 con
  cero recuentos se parece muchísimo a un descubrimiento.
- **Un control positivo puede salir VACÍO y no disparar.** Un testigo tiene que EXISTIR HOY: el control
  del sufijo con una rama ya mergeada y borrada salía vacío, y su «0» no valía nada.
- **Un laboratorio que le presta su entorno al sujeto mide la suma de los dos.** El entorno del sujeto se
  construye a mano, no con `{ ...process.env }` a pelo (SCRUM-928c: el color del chat entraba en el
  sujeto).

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

## A23 · Cómo se escribe un guard — la lista de comprobación

*(18-sep-2026, SCRUM-951b.)* Hasta hoy esto vivía en la memoria de UNA máquina, en cuatro notas que
mordieron una y otra vez; el equipo de Javier no la tiene. Un guard se da por bueno cuando **todas**
las casillas dicen sí. Cada una lleva el caso que la haría fallar.

| # | la pregunta (sí / no) | ✗ falla si… |
|---|---|---|
| 1 | ¿He **barrido antes** de escribirlo, por si la prohibición ya está rota hoy? Si lo está, es un **hallazgo que se reporta aparte**, antes que el guard. | el guard nace con la violación dentro, callada en una excepción |
| 2 | Si busca un patrón **por texto**, ¿lee el código **SIN comentarios**? El comentario que explica por qué se retiró algo CONTIENE lo que se retiró. | nace verde con la regresión puesta, o rojo contra su propia prosa (mordió 4 veces el 27-jul) |
| 3 | ¿El recorte de comentarios parte por líneas (`/\r?\n/`) y no usa `.*$`? En JS `.` no casa `\r`, y el repo tiene ficheros CRLF. | el recorte no quita nada en un fichero CRLF y el guard vuelve a leerse a sí mismo (SCRUM-406) |
| 4 | ¿Los selectores CSS van **anclados a principio de línea** (`'\n.clase {'`)? | `.clase {` casa con `.otra > .clase {` |
| 5 | ¿Cuenta **cosas** y no texto: nombres por AST, en su ámbito, y no por regex sobre el fichero? (A3) | un `for-of` en otra parte del fichero «liga» cualquier nombre (SCRUM-846) |
| 6 | ¿Declara su **POBLACIÓN** y tiene **SUELO** («no pude mirar» no da verde)? (A3, A21) | dice «0 violaciones» sin decir sobre cuántos ficheros |
| 7 | Si es un **trinquete**, ¿tiene sus DOS mitades: «no sube» Y «no baja en silencio»? Una bajada que nadie ha hecho es un instrumento roto hasta que se demuestre lo contrario. | el número de deuda baja de 9 a 8 porque el escáner se descarriló, y nadie mira dos veces un número que mejora (SCRUM-814) |
| 8 | ¿Lo he visto en **ROJO** antes de darlo por bueno, con una violación REAL del tipo que dice prevenir, y comprobando que la inyección **se aplicó** (el `git diff --numstat` al lado)? (`docs/METODO_YAQU.md`) | un rojo que no se inyectó y un verde son indistinguibles |
| 9 | Antes de inyectar, ¿he hecho **commit de TODO el árbol** (`git add -A`) y he puesto **su SHA en el informe**? Incluido el fichero que estoy editando en ese momento. | `git checkout -- f` para deshacer la inyección se lleva el arreglo sin commitear (4 roturas: SCRUM-316, 415, 474, 441) |
| 10 | ¿He hecho **`npm run build`** entre una inyección y la siguiente? Los tests corren contra `dist/`. | revertir el fuente deja la inyección dentro del build y el rojo siguiente sale contaminado (SCRUM-367) |
| 11 | ¿He revertido con `git restore --source=HEAD` y comprobado con `git status --porcelain` que lo mío sigue ahí? Y tras un merge con conflicto, ¿he repetido **TODOS** los rojos? | entra en main un guard incapaz de fallar con un registro que dice lo contrario |
| 12 | Si el rojo no llega ni a compilar, ¿he añadido una aserción PERMANENTE del mecanismo por otra vía? | la afirmación de runtime que justificaba el guard se queda en prosa (SCRUM-500) |
| 13 | ¿Los **datos de prueba** ejercitan el camino? Un fixture cómodo (`id: 1`, el merchant demo) apaga puertas sin tocar el guard. | la regla del ticket no la comprueba ninguna línea de prueba (SCRUM-290) |
| 14 | ¿Las **excepciones** van en una ALLOWLIST visible con su motivo al lado, y se le dicen al jefe? | una excepción silenciosa convierte un fallo en una característica |
| 15 | Si guarda arrays con números, ¿van **uno por línea**? (lo vigila `tests/scrum710b`) | dos tickets cambian números de la misma línea y el conflicto parece que se pisan |
| 16 | ¿Cuánto **tarda**? Un guard de minutos acaba fuera de la tanda (canon de `sesion-0.md`). | 1.200 procesos de `git` y 366 s donde un solo `rev-list` daba 14 s (SCRUM-833) |

    🔒 Un guard que nunca has visto fallar es un guard que no sabes si funciona.
