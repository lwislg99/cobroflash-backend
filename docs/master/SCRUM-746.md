# SCRUM-746 · La barrera está en el comando, y las dos rutas que tocan producción no son un comando

**Fecha:** 4-sep-2026 · **Carril:** barrera de producción (AA2) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `291b86739079a8b069992deb45fb876f944b8050` · 2026-09-04T23:12:30+01:00
**Medido en:** host `DESKTOP-A24926K` · rama `scrum-746-la-barrera-y-la-indireccion`

**Tanda:** **5.405 pruebas · 5.317 en verde · 0 fallos · 88 saltadas**, con `main` ya mergeado
dentro y medida DESPUÉS del último cambio, entrada incluida.

La base sobre `main` limpio, medida al empezar sobre un worktree recién nacido de
`b74f523910fdb371c098a7f265a5a60e0eae3425`, daba **5.383 · 5.295 · 0 fallos · 88 saltadas**.
**Los +22: 5 son de este ticket** (medidos corriendo el fichero solo) y **17** vienen del `main`
nuevo que se mergeó dentro —SCRUM-744, 745 y 648—. **No hay comparación de fan-out nombre a
nombre**, así que ese reparto es aritmética, no medición.

> ⛔ **ESTE TICKET MIDE Y PROPONE. NO ELIGE.** El encargo lo dice y estoy de acuerdo: esto toca la
> barrera de producción y la decisión no es mía. Lo que va aquí es el rojo medido, el censo, las dos
> salidas con sus consecuencias y **mi criterio escrito**. Lo único que se ha construido es un
> trinquete para que la exposición **no crezca mientras se decide**.
>
> ⛔ **No se ha ejecutado ninguna de las dos rutas.** Ni contra producción ni contra nada: al hook se
> le da la misma entrada que recibiría —el JSON del tool call— y se mira su veredicto. Es una función
> pura sobre esa entrada.

---

## 🔴 EL ROJO, PRIMERO

| lo que se teclea | ¿lo ve el hook? |
|---|---|
| `bash scripts/db-push-prod` | **🔴 PASA** |
| `npm run db:push` | **🔴 PASA** |
| `npm run db:seed` | **🔴 PASA** |
| `npx prisma db push` (contraste) | BLOQUEA |
| `prisma db seed` (contraste, desde SCRUM-744) | BLOQUEA |

**La causa es de una línea:** el hook es un `PreToolUse` y recibe **lo que Claude teclea**. Lo que
ese comando desencadena por dentro —otro `bash`, un `npm run`, un `ts-node`— **no vuelve a pasar
por él**. No es un fallo del patrón: el patrón funciona. Es que **la barrera está en el sitio
equivocado para estas dos rutas**.

## 🔴 Y LO PRIMERO ES CORREGIRME: MI HALLAZGO DE SCRUM-744 EXAGERABA

Escribí que `bash scripts/db-push-prod` *«no cruza la barrera»* y lo dejé ahí. Es cierto **y es
engañoso**, porque ese script **tiene su propia barrera, y es más fuerte que la del hook**:

1. **Puerta del árbol** (SCRUM-685): se niega a arrancar desde un checkout atrasado.
2. **Host-check**: dice a qué base apunta, sin imprimir la URL.
3. **Preview obligatorio** con suelo anti-silencio: si no produce salida, aborta.
4. **Guard de borrado**: si el diff borra algo, **aborta sin llegar a pedir el GO**.
5. **GO explícito tecleado por una persona**, y sin TTY se aborta.
6. Se **auto-crea el sentinel** justo antes del push y lo borra después.

**Lo que de verdad falta ahí no es la barrera: es que el hook no puede confirmarla.** Y el punto 6
merece decirse tal cual: **el script se concede a sí mismo la autorización de un solo uso.** Es
razonable —ya ha pasado por cinco puertas— pero significa que **el sentinel no es una autorización
del fundador cuando se llega por esta ruta**, y quien lea el hook creerá que sí.

**La ruta de verdad desprotegida es la otra.** `npm run db:seed` → `prisma db seed` →
`ts-node prisma/seed.ts` → **`new PrismaClient()` a secas**: sin puerta del árbol, sin host-check,
sin preview, sin GO. Hace `upsert` sobre el merchant 1 —nombre, NIF, dirección, plan,
`planExpiresAt`— contra **lo que apunte `DATABASE_URL`**.

## PASO 0

**ENTRADA.** Cualquiera de las sesiones —hoy trece árboles— teclea un comando. El hook lo intercepta
(`.claude/settings.json`, matcheado a Bash y PowerShell). La víctima es la base del fundador.

**MECANISMO — hay DOS, y ésa es la pregunta del ticket.**
* **En el comando:** `guard-dangerous.mjs`. Ve lo que se teclea. Ciego a la indirección.
* **En la conexión:** `scripts/_clave-vs-destino.mjs` — `exigirDestinoCorrecto(clave, url, worktree)`
  y `exigirNoProduccion`. Vigilan **por destino, no por nombre**, y su propio comentario ya explica
  por qué: *«un guard que sólo vigila las claves que le enseñaron deja pasar justo la que no
  conoce»*. Hoy lo llaman **dos** scripts.

## El censo del punto de conexión

Población: **384** ficheros `.ts/.mjs/.js` en `src/`, `scripts/` y `prisma/`. **20 construyen un
`PrismaClient`.**

| | |
|---|---|
| **ACOTADOS por su clave** (leen `_STAGING`/`_DEV`/`_TESTS`: no pueden llegar a producción) | **8** |
| **Pueden alcanzar producción** (usan la `DATABASE_URL` del entorno) | **12** |
| … de ésos, **comprueban el destino** | **7** |
| … **sin comprobación** | **5** |

🔴 **Y de esos 5, TRES no son un problema — decirlo es la mitad del trabajo:**

| fichero | por qué NO es un hallazgo |
|---|---|
| `src/core/db/prisma.ts` | es el cliente de **la app**: su destino correcto **es** producción |
| `scripts/censo-vias-de-cobro.mjs` | **sólo lee**, y ya lleva su suelo de «ciego» |
| `scripts/backfill-quote-numbers.mjs` | escribe, pero exige `--apply` explícito (mitigación, no guarda) |

**Quedan DOS que escriben contra lo que apunte `DATABASE_URL` sin nada:**

* **`prisma/seed.ts`** — el del encargo.
* **`scripts/backup-restore.mjs`** — **y éste no estaba en el encargo**. Restaura un backup: es el
  más destructivo de los veinte, y tampoco comprueba a dónde apunta.

## LAS DOS SALIDAS, con sus consecuencias

### (A) Resolver la indirección: que el hook siga `bash x.sh` y `npm run y`

**Qué haría.** Leer el fichero o el `package.json`, sacar el comando real y volver a evaluarlo.

**Lo que gana.** Cubre las dos rutas nombradas **sin tocar código de producto**.

**Lo que cuesta, y por qué no me convence:**
* **Es una carrera que el hook no puede ganar.** Hoy son `bash` y `npm run`. Mañana un script que
  llame a otro, un `Makefile`, un `npm run` que expanda a `npm run` — y siempre queda la última
  puerta: **un comando construido en tiempo de ejecución**, que ningún lector de ficheros ve. El
  propio hook lleva la ofuscación declarada como hueco desde SCRUM-176 por este mismo motivo.
* **El hook pasaría a LEER FICHEROS del disco.** Hoy es una función pura sobre su entrada, y eso es
  lo que permite probarlo entero sin tocar nada. En cuanto lee ficheros, su veredicto depende del
  estado del árbol y se vuelve mucho más difícil de verificar — y **es el guard que más falta hace
  que sea verificable**.
* **Multiplica el falso positivo.** SCRUM-176 y SCRUM-454 son la historia de este hook aflojándose
  para no bloquear lo legítimo. Seguir indirecciones mete texto ajeno —el contenido de un script—
  en el ámbito de los patrones. `db-push-prod` **contiene la cadena `npx prisma db push`**: al
  seguirlo, el hook bloquearía **la ruta guiada, que es la buena**, y la sesión con prisa acabaría
  tecleando el `npx prisma db push` a pelo. **La barrera empujaría hacia el camino peor.**
* **Y no arregla lo que de verdad duele:** `seed.ts` seguiría sin saber a dónde apunta si alguien
  lo lanza con `ts-node prisma/seed.ts`, que no es ni `bash` ni `npm run`.

### (B) Vigilar en el punto de CONEXIÓN, como ya hace `exigirDestinoCorrecto`

**Qué haría.** Que quien construye un cliente que puede alcanzar producción **declare a dónde va**.
El mecanismo existe, está probado y lo usan siete scripts.

**Lo que gana.**
* **Protege sea cual sea la ruta**: `npm run`, `ts-node`, un script nuevo que nadie revisó, o un
  compañero ejecutándolo a mano sin Claude por medio — que hoy **no pasa por ninguna barrera**.
* Es **la pregunta correcta**: no «cómo se escribió esto» sino «¿a qué base voy a escribir?».
* **Cierra `seed.ts` y `backup-restore.mjs`**, que es donde está el daño medido.

**Lo que cuesta, y hay que decirlo:**
* **No cubre `db push`.** Ese abre su conexión **dentro del binario de Prisma**, no en nuestro
  código: por (B) no pasa. Lo que protege ahí es la barrera propia del script, que ya existe.
* Toca ficheros de producto (`prisma/seed.ts`), aunque sea para añadir dos líneas.
* Un `PrismaClient` nuevo puede nacer sin la guarda. **Por eso este ticket deja el trinquete**: si
  aparece uno que puede alcanzar producción y no comprueba el destino, la tanda cae y lo nombra.

## 🔴 MI CRITERIO, que es lo que se me pidió

**(B), y (A) no.** Y la razón de fondo no es de coste: es que **(A) vigila la ortografía y (B) vigila
el hecho** — la misma distinción que cerró SCRUM-744 hace dos horas. Seguir indirecciones es
perseguir formas de escribir un comando; comprobar el destino es preguntar a qué base se va a
escribir, que es lo único que importa.

**Y hay un argumento que decide, por encima de todos:** la barrera del comando **sólo existe cuando
Claude teclea**. Un compañero que abra una terminal y ejecute `npm run db:seed` no pasa por el hook
—ni pasará nunca, con (A) o sin ella—. **(B) es la única de las dos que protege también a las
personas.**

**Lo que propongo, en el orden en que yo lo haría:**

1. **`prisma/seed.ts`** — `exigirNoProduccion` antes del primer `upsert`. Dos líneas, cero riesgo,
   cierra la ruta que el encargo señala. *Y si el fundador quiere sembrar producción alguna vez, que
   sea con una variable explícita, no por olvido.*
2. **`scripts/backup-restore.mjs`** — igual. Es el más destructivo de los veinte.
3. **El sentinel de `db-push-prod`**: hoy el script se lo concede a sí mismo. **Propongo que no lo
   cree**, y que si hace falta lo ponga una persona — o que al menos lo diga en su salida, porque
   ahora mismo un lector del hook creerá que hubo un OK del fundador que no hubo.
4. **(A) no.** Y si se decidiera hacerla, **que no sea a costa de (B)**: (A) sin (B) deja la casa
   protegida sólo cuando escribe Claude.

**Lo que NO propongo:** tocar `db-push-prod`, más allá del punto 3. Sus cinco puertas son mejores
que lo que el hook podría añadir, y meterse ahí sin necesidad es tocar la ruta de producción por
gusto.

## El residuo del sentinel, medido

Medido con el hook: al **dejar pasar** un `db push` con el sentinel puesto, **el sentinel se borra**.
El hook no puede saber qué pasa después —el usuario aún puede denegar el permiso en el prompt de
Claude Code—, así que **una autorización del fundador se puede gastar sin que se ejecute nada**.

Ya estaba declarado en el propio hook como residuo conocido. Se deja **medido en un test**, no
arreglado: cerrarlo exige saber qué ocurre después de la decisión del hook, y desde el hook no hay
forma. **Es un hueco de diseño del punto de enganche, no un descuido.**

## Lo único que se construye aquí: un trinquete

`tests/scrum746-barrera-y-punto-de-conexion.test.mjs` (5 tests). No cierra nada — **impide que
crezca**:

* fija el rojo (las tres rutas por indirección no llegan al hook) **con el mensaje al revés**: el día
  que alguien lo cierre, el test cae diciendo *«enhorabuena, actualiza este documento»*;
* **cae si aparece un punto de conexión NUEVO** que pueda alcanzar producción sin comprobar el
  destino, y lo nombra;
* comprueba que los dos expuestos **siguen existiendo y siguen escribiendo** — un trinquete sobre
  una lista que ya no describe nada es peor que ninguno;
* y fija el residuo del sentinel.

La lista de los dos expuestos y de los tres que no son un problema **va a mano y con motivo**, no
derivada: derivarla haría que el número subiera solo cada vez que alguien añade un script que sólo
lee, y el ruido acaba desactivando el guard.

## La decisión de SCRUM-744 que llegó tarde, y dónde ha acabado

El asesor decidió meter **`db seed`** en la lista de subcomandos bloqueados. Lo commiteé en la rama
de SCRUM-744, **pero ese PR se mergeó antes de que yo lo empujara**, así que el cambio venía aquí de
todos modos. Está en esta rama, con su motivo, y el censo de SCRUM-744 pasa de 7 a 8 bloqueados.

⚠️ **`prisma db seed` ya cae; `npm run db:seed` sigue pasando.** Eso no es un fallo de la decisión:
es exactamente el hueco que este ticket mide, y ninguna línea del hook lo cierra.

## Ficheros

`tests/scrum746-barrera-y-punto-de-conexion.test.mjs` (**nuevo**, 5 tests) ·
`.claude/hooks/guard-dangerous.mjs` (+`db seed`, la decisión del asesor) ·
`tests/scrum744-el-guard-mira-la-accion.test.mjs` (su censo: `db seed` pasa a bloqueado, 7→8) ·
esta entrada.

**No se ha tocado:** `prisma/seed.ts` · `scripts/backup-restore.mjs` · `scripts/db-push-prod` ·
`package.json` · `prisma/schema.prisma` · sin dependencias nuevas (regla 36). **Nada de lo que la
propuesta recomienda se ha hecho**: es una propuesta.

## 🔴 Los huecos que declaro

1. **No he ejecutado ninguna de las dos rutas**, ni contra un destino inofensivo. El veredicto del
   hook se mide dándole su entrada; **lo que los scripts hacen por dentro lo sé por LECTURA**, no
   por haberlo visto correr.
2. **El censo de puntos de conexión es por TEXTO** (`new PrismaClient(`) sobre el fuente completo,
   sin filtrar comentarios. Los 20 se revisaron a mano, pero el barrido puede contar de más si
   alguien escribe la construcción en un comentario.
3. **«Acotado por su clave» se decide porque el fichero NOMBRA `_STAGING`/`_DEV`/`_TESTS`.** Un
   fichero que la nombre en un mensaje y lea `DATABASE_URL` saldría acotado sin serlo. Ninguno de
   los ocho lo hace hoy —los miré—, pero el criterio es más flojo de lo que parece.
4. **No he medido qué pasa si `DATABASE_URL` no está definida** en un árbol de trabajo, que es el
   caso normal aquí (los `.env` llevan `_STAGING`/`_DEV`/`_TESTS`). Es probable que `seed.ts`
   simplemente falle al conectar — **probable no es medido**, y cambia bastante la urgencia.
5. **La propuesta no está probada.** No he escrito la guarda de `seed.ts` ni medido su coste; si al
   implementarla apareciera un falso positivo, el orden que propongo podría cambiar.
6. **`.claude/settings.json` no se ha revisado**: doy por hecho que el hook sigue enganchado a Bash
   y PowerShell y a nada más. Es lo que dice el propio hook, no lo que he medido hoy.

## HALLAZGOS FUERA DE CARRIL — una línea cada uno

* `scripts/backup-restore.mjs` restaura un backup contra lo que apunte `DATABASE_URL` **sin comprobar el destino**: no estaba en el encargo y es el más destructivo de los veinte constructores.
* `scripts/db-push-prod` **se auto-crea el sentinel** (`touch .claude/allow-db-push`) antes del push: quien lea el hook creerá que hubo una autorización del fundador que por esa ruta no existe.
* Ninguna barrera de esta casa protege a **una persona en una terminal**: el hook sólo existe cuando escribe Claude, y siete de los doce constructores que pueden alcanzar producción dependen de que quien los lance sepa lo que hace.
* Mi propio hallazgo de SCRUM-744 sobre `db-push-prod` **exageraba**: decir «no cruza la barrera» sin decir «tiene cinco puertas propias» habría mandado a la siguiente sesión a blindar lo que ya estaba blindado.


---

# SCRUM-746 · FASE B · La guarda, donde se escribe

**Fecha:** 4-sep-2026 · **Carril:** barrera de producción (AA2) · **Gate:** sin gate — corre en `npm test`

> 📎 Esta entrada es de la **fase B**: la EJECUCIÓN de lo que la fase A midió y propuso. La fase A
> —el rojo, el censo del punto de conexión y las dos salidas con su criterio— abre este fichero, y
> se mezcló a `main` mientras ésta estaba en vuelo. El asesor adoptó la salida (B) y **cambió el
> orden**: primero lo irreversible.

**Medido contra:** `origin/main` = `9545711d5172e24f1f985471a39c25bcc1062841` · 2026-09-04T23:47:23+01:00
**Medido en:** host `DESKTOP-A24926K` · rama `scrum-746b-guarda-en-la-conexion`

**Tanda:** **5.413 pruebas · 5.325 en verde · 0 fallos · 88 saltadas**, con `main` ya mergeado
dentro y medida DESPUÉS del último cambio, entrada incluida.

La base sobre `main` limpio, medida al empezar sobre un worktree recién nacido de
`b54423162c3dca9f25dd160c928a70fb371f3c6f`, daba **5.400 · 5.312 · 0 fallos · 88 saltadas**.
**Los +13: 8 son de este fichero de tests** y **5** son los de la fase A, que entraron con el `main`
mezclado después de tomar la base. **No hay comparación de
fan-out nombre a nombre**, así que el reparto es aritmética, no medición.

> ⛔ **Ninguna de las tres rutas se ha ejecutado.** Ni contra producción, ni contra staging, ni
> contra la base desechable. Las dos reglas son funciones **puras sobre una URL**, así que su rojo
> y su verde se ejercitan con cadenas inventadas — que es la única forma de probar un candado que
> existe para NO ejecutarse.

---

## 🔴 PRIMERO, EL HUECO QUE YO MISMA DECLARÉ, PORQUE CAMBIA LA URGENCIA

La fase A lo dejó escrito: *«no he medido qué pasa si `DATABASE_URL` no está definida»*. Medido
ahora, sin conectar con nada (sin URL no hay conexión posible):

| | |
|---|---|
| `new PrismaClient()` sin `DATABASE_URL` | **no lanza** |
| la **primera consulta** | **lanza**: `Environment variable not found: DATABASE_URL` |
| `.env` de un árbol de trabajo | **no lleva `DATABASE_URL`** (sólo `_STAGING`, `_DEV`, `_TESTS`) |
| `loadEnv.ts` | carga `.env.local` y `.env`; **no mapea** ninguna clave a `DATABASE_URL` |

**Conclusión, y baja la urgencia:** hoy `npm run db:seed` en un árbol de trabajo **falla en seco al
primer `upsert`**, sin tocar nada. El riesgo **no es «por defecto»**.

🔴 **Y el camino real del accidente sigue ahí, escrito en nuestra propia documentación:** la
cabecera de `scripts/db-push-prod` dice cómo apuntar a staging —
`DATABASE_URL="postgresql://…acela…" bash scripts/db-push-prod`—. **Basta con seguir en la misma
terminal.** Exportas la variable para una cosa y la siguiente la hereda.

## Lo que se cierra, en el orden del asesor

Yo propuse `seed.ts` primero. El asesor lo cambió y **el motivo es mejor que el mío**: no es de
esfuerzo, es de **daño irreversible**. Un `upsert` sobre un merchant es malo, acotado y deshacible;
una restauración sobrescribe una base **entera** y eso no se deshace.

### ① `scripts/backup-restore.mjs` — lo irreversible

Su cabecera decía —y sigue diciendo— *«NO se ejecuta contra producción ni staging: usa
`_scratch-run.mjs`, que lo impide»*. **Es verdad y no bastaba:** el script tiene su **propia entrada
de línea de comandos** (`process.argv[2]`), así que
`DATABASE_URL=… node scripts/backup-restore.mjs fichero.gz.enc` no pasaba por el runner ni por
ninguna otra puerta. **La protección vivía un nivel más allá de la acción** — que es el defecto de
todo este día, con otra cara.

Ahora comprueba el destino **antes de construir el cliente**. El orden es la regla: una
comprobación después de conectar ya ha elegido a dónde. Hay una mutación (②) que sólo mueve la
comprobación de sitio, y cae.

### ② `prisma/seed.ts` — el único de los tres

Esta casa tiene **tres sembradores**. `scripts/seed-demo.mjs` y `scripts/seed-video.mjs` llaman a
`destinoSembrable` desde SCRUM-381. `prisma/seed.ts` hacía `new PrismaClient()` **a secas**, y su
`upsert` pisa nombre, NIF, dirección, plan y `planExpiresAt` del merchant 1.

**No era una regla que faltara: era un llamador que faltaba.**

### ③ `scripts/db-push-prod` — sólo la autoconcesión

Se quita **una línea**: `mkdir -p .claude && touch .claude/allow-db-push` (y su `rm -f`). Nada más.

El sentinel es la autorización de un solo uso que el hook exige antes de un `db push`, y el script
**se la concedía a sí mismo**. La intención era buena —a esa altura ya han pasado cinco puertas—
pero el efecto no: **quien lea el hook creerá que hubo un OK del fundador, y por esa ruta no lo
hubo**. Y no era necesario: el hook intercepta lo que teclea Claude, no lo que hace un script por
dentro, así que el `npx prisma db push` de la línea siguiente **no pasa por él**. El `touch` no
desbloqueaba nada — sólo dejaba escrito un permiso que nadie había dado.

⚠️ **Las cinco puertas no se tocan**, y hay un test que exige que sigan las cinco (árbol,
host-check, suelo anti-silencio, guard de borrado, GO explícito). La mutación ⑦ rompe una y cae.

## 🔴 NO HAY REGLA NUEVA, y era la instrucción

* **`destinoSembrable`** ya existía (SCRUM-381, en `scripts/_db-guard.mjs`). Se llama, no se copia.
* **`destinoDesechable`** es **la que `_scratch-run.mjs` venía ejecutando desde SCRUM-242**, sacada
  a `_db-guard.mjs` para que la llamen **los dos**. El runner ya no tiene su copia inline, y hay un
  test que lo exige.

**Y son DOS reglas, no una con un parámetro.** La diferencia es **staging**: un sembrador *añade*
filas y puede escribir ahí; una restauración lo *sobrescribe entero*, y staging es de todo el
equipo. Una función con un flag es una función a la que un día se le pasa el flag equivocado, y esa
diferencia es una base perdida.

## El control negativo, que era el filo

> *«Un `seed` contra la base de DEV tiene que seguir funcionando SIN fricción. Si el arreglo obliga
> a teclear algo para sembrar en dev, se desactivará en una semana.»*

**Cero fricción añadida, y está medido:** la URL de dev vive **en el mismo host que staging**
(`acela.proxy.rlwy.net/yaqu_dev_javier`), que ya está en `DESTINOS_SEMBRABLES`. Un
`DATABASE_URL=<dev> npm run db:seed` pasa **exactamente igual que antes**. El test lo fija para
dev, staging, `localhost`, `127.0.0.1` y `[::1]`.

Lo único que deja de poder hacerse es lo que nadie quería hacer.

## 🔴 Y DOS DEFECTOS MÍOS QUE CAZÓ EL TEST ANTES DE SALIR DE AQUÍ

**① `destinoDesechable` dejaba pasar una URL con host VACÍO.** `parseBDSegura('postgresql://')`
devuelve `{ host: '', … }` —parseable pero sin destino— y mi lista **negra** («ni producción ni
staging») lo daba por bueno.

La lección es de forma, no de caso: **una lista negra sólo sabe decir que no a lo que le enseñaron;
una lista blanca falla cerrada con lo raro.** `destinoSembrable` no cae ahí porque exige que el host
**esté** en su lista. Aquí no se puede usar lista blanca —la base desechable es la que sea: un
contenedor, un Postgres local, otro puerto—, así que **la limitación se declara** en el código y se
exige que al menos **haya** host.

**② Mi propio test buscaba el `touch` sobre el fuente crudo… y casaba con MI PROPIO COMENTARIO** —el
que explica que esa línea se quitó—. Es el defecto que llevo cazando todo el día, esta vez en mí:
*el sitio natural donde se escribe el nombre de lo prohibido es la explicación de la prohibición*.
Ahora filtra con `soloEjecutable` (el filtro ÚNICO de la casa, SCRUM-700/719, con
`almohadillaEsComentario` porque bash comenta con `#`), **y lleva suelo**: si el filtro devolviera
poco texto, los asertos pasarían sobre la nada.

## 🟢 Y EL TRINQUETE DE LA FASE A DISPARÓ, QUE ES LA MEJOR PRUEBA DE QUE SERVÍA

La tanda final de esta fase cayó. No por un defecto: por **mi propio trinquete de la fase A**, con
el mensaje que le escribí al revés:

> 🟢 UN EXPUESTO CONOCIDO YA NO SALE: ,  — si le has
> puesto guarda de destino, quítalo y anótalo en la entrada.

Es exactamente para lo que se escribió así: **un guard que sabe decir que ha dejado de hacer falta
no se convierte en ruido**. Se hizo lo que pedía, y de paso el trinquete se dio la vuelta: ahora
vigila que **lo cerrado no se reabra** —si alguien le quita la guarda a cualquiera de los dos,
cae— y que los dos **sigan escribiendo**, porque una guarda sobre algo que ya no escribe sobra y
hay que decirlo en vez de arrastrarla.

## Verificado en rojo — ocho mutaciones

Cada una guarda los BYTES, comprueba que cambió **ese** fichero, corre **los míos y los AJENOS que
ya vigilaban estas piezas** —`scrum381` de la semilla y `scrum242` de la restauración—, restaura y
verifica con `Buffer.compare`. Árbol limpio al final.

| se rompe a propósito | cae por |
|---|---|
| ① la restauración deja de comprobar el destino | «comprueba el destino ANTES de construir el cliente» |
| ② la comprobación se mueve **después** del cliente | la misma — **el orden es la regla** |
| ③ la semilla vuelve a no comprobar nada | «los TRES sembradores llaman a la misma regla» |
| ④ `destinoDesechable` deja pasar staging | «son DOS reglas distintas, y la diferencia es staging» |
| ⑤ vuelve a pasar el host vacío | «sin URL, las dos fallan CERRADO» |
| ⑥ vuelve la autoconcesión del sentinel | «ya NO se concede el sentinel a sí mismo» |
| ⑦ se cae **una de las cinco puertas** de `db-push-prod` | la misma — este ticket no las tocaba |
| ⑧ **CONTROL NEGATIVO**: se reescribe un comentario | **no cae** |

La ⑥ vale doble: la línea que inyecta va **en código**, no en el comentario que explica que se
quitó — así que además demuestra que el filtro de comentarios funciona.

## Ficheros

`scripts/_db-guard.mjs` (+`destinoDesechable`, la regla del runner extraída) ·
`scripts/_scratch-run.mjs` (usa la extraída; se le quita la copia inline) ·
`scripts/backup-restore.mjs` (comprueba el destino antes de conectar) ·
`prisma/seed.ts` (llama a `destinoSembrable`, como sus dos hermanos) ·
`scripts/db-push-prod` (**−1 línea**: la autoconcesión) ·
`tests/scrum746b-guarda-en-la-conexion.test.mjs` (**nuevo**, 8 tests) · esta entrada.

**No se ha tocado:** las cinco puertas de `db-push-prod` · `destinoSembrable` ni
`DESTINOS_SEMBRABLES` · el hook `guard-dangerous.mjs` · `package.json` ·
`prisma/schema.prisma` · ningún test existente · sin dependencias nuevas (regla 36).

## 🔴 Los huecos que declaro

1. **`destinoDesechable` es una lista NEGRA**, y por eso un host desconocido **pasa**. Es
   deliberado —la base desechable puede ser cualquier cosa— pero significa que si mañana apareciera
   un tercer host peligroso con otro nombre, esta regla no lo vería. `destinoSembrable` no tiene ese
   problema porque es lista blanca.
2. **No he ejecutado ninguna restauración ni ninguna siembra**, ni siquiera contra la base
   desechable. Sé que la guarda decide bien porque es pura y está probada; **no he visto el camino
   completo correr**.
3. **`prisma/seed.ts` importa de `scripts/`** por `import()` dinámico. `tsconfig.json` sólo incluye
   `src`, así que no pasa por `npm run build` — pero **no he corrido `prisma db seed`** para verlo
   resolver en ts-node. Si ese import fallara, el fallo sería al arrancar el sembrador, no silencioso.
4. **Quedan 4 constructores de cliente que pueden alcanzar producción sin comprobar destino**, de
   los 12 censados en la fase A: la app (correcto), uno que sólo lee, uno con `--apply` y
   `backfill-quote-jobid`. Este ticket cierra los DOS que escriben sin nada; los demás siguen
   apuntados en el trinquete de la fase A.
5. **No he tocado el residuo del sentinel** —que se consume aunque el usuario deniegue después—.
   Sigue siendo un hueco de diseño del punto de enganche, medido en la fase A.
6. **`npm run db:seed` y `bash scripts/db-push-prod` siguen sin cruzar el hook.** Este ticket no lo
   arregla: lo hace irrelevante para el daño, poniendo la guarda donde se escribe.

## HALLAZGOS FUERA DE CARRIL — una línea cada uno

* `scripts/backfill-quote-jobid.mjs` usa `parseBDSegura` pero **no** una de las dos reglas de destino: mira la URL sin decidir sobre ella, que es la forma más fácil de parecer protegido.
* La cabecera de `scripts/db-push-prod` **enseña a exportar `DATABASE_URL`** para apuntar a staging, y esa variable **se hereda en la misma terminal**: es el camino documentado por el que un `seed` o un `restore` acaban donde no debían.
* `prisma/seed.ts` no lo compila `tsc` (`include: ["src"]`), así que **ningún type-check lo cubre**: un error de tipos ahí no aparece hasta que alguien lo ejecuta.
